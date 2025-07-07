const { prisma } = require('../config/database');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { sanitizeString } = require('../utils/validators');
const { uploadToCloudinary, deleteFromCloudinary } = require('../services/uploadService');
const chatService = require('../services/chatService');
const logger = require('../utils/logger');

// ✅ NUEVO: Crear chat desde perfil de usuario (botón "Chat" en perfil)
const createChatFromProfile = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user.id;

  // Validar que no sea el mismo usuario
  if (currentUserId === userId) {
    throw new AppError('No puedes chatear contigo mismo', 400, 'CANNOT_CHAT_WITH_SELF');
  }

  // Verificar que el usuario del perfil existe y está activo
  const targetUser = await prisma.user.findUnique({
    where: { 
      id: userId,
      isActive: true,
      isBanned: false
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      avatar: true,
      userType: true,
      lastActiveAt: true,
      settings: {
        select: {
          allowDirectMessages: true
        }
      },
      blockedUsers: {
        where: {
          blockedId: currentUserId
        },
        select: { id: true }
      }
    }
  });

  if (!targetUser) {
    throw new AppError('Usuario no encontrado o no disponible', 404, 'USER_NOT_FOUND');
  }

  // Verificar configuraciones de privacidad
  if (!targetUser.settings?.allowDirectMessages) {
    throw new AppError('Este usuario no permite mensajes directos', 403, 'DIRECT_MESSAGES_DISABLED');
  }

  // Verificar si estás bloqueado
  if (targetUser.blockedUsers.length > 0) {
    throw new AppError('No puedes enviar mensajes a este usuario', 403, 'USER_BLOCKED_YOU');
  }

  // Verificar si has bloqueado al usuario
  const hasBlocked = await prisma.userBlock.findUnique({
    where: {
      blockerId_blockedId: {
        blockerId: currentUserId,
        blockedId: userId
      }
    }
  });

  if (hasBlocked) {
    throw new AppError('Has bloqueado a este usuario', 403, 'YOU_BLOCKED_USER');
  }

  // Verificar límites de cliente si aplica
  if (req.user.userType === 'CLIENT') {
    const canCreate = await chatService.canCreateNewChat(currentUserId, req.user.userType);
    if (!canCreate.canCreate) {
      throw new AppError(canCreate.error, 400, 'CHAT_LIMIT_REACHED');
    }
  }

  // Buscar chat existente
  let chat = await prisma.chat.findFirst({
    where: {
      isGroup: false,
      isDisputeChat: false,
      AND: [
        {
          members: {
            some: {
              userId: currentUserId
            }
          }
        },
        {
          members: {
            some: {
              userId: userId
            }
          }
        }
      ]
    },
    select: {
      id: true,
      lastActivity: true,
      createdAt: true
    }
  });

  let isNewChat = false;

  // Si no existe chat, crear uno nuevo
  if (!chat) {
    chat = await prisma.chat.create({
      data: {
        isGroup: false,
        isPrivate: true,
        isDisputeChat: false,
        members: {
          create: [
            {
              userId: currentUserId,
              role: 'MEMBER'
            },
            {
              userId: userId,
              role: 'MEMBER'
            }
          ]
        }
      },
      select: {
        id: true,
        lastActivity: true,
        createdAt: true
      }
    });

    isNewChat = true;

    logger.info('New chat created from profile', {
      chatId: chat.id,
      currentUserId,
      targetUserId: userId,
      targetUserType: targetUser.userType
    });

    // Crear interacción para algoritmos
    try {
      await prisma.userInteraction.create({
        data: {
          userId: currentUserId,
          targetUserId: userId,
          type: 'CHAT',
          weight: 3.0, // Mayor peso por iniciar chat desde perfil
          source: 'profile',
          deviceType: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'desktop'
        }
      });
    } catch (error) {
      // Ignorar errores de interacción
      logger.warn('Failed to create interaction from profile chat:', error);
    }
  } else {
    // Actualizar actividad del chat existente
    await prisma.chat.update({
      where: { id: chat.id },
      data: { lastActivity: new Date() }
    });

    logger.info('Existing chat opened from profile', {
      chatId: chat.id,
      currentUserId,
      targetUserId: userId
    });
  }

  // Marcar chat como prioritario si es cliente premium
  if (req.user.userType === 'CLIENT' && req.user.client) {
    try {
      await chatService.markChatAsPriority(chat.id, userId, req.user.client.id);
    } catch (error) {
      logger.warn('Failed to mark chat as priority:', error);
    }
  }

  res.status(200).json({
    success: true,
    message: isNewChat ? 'Chat iniciado exitosamente' : 'Chat abierto exitosamente',
    data: {
      chatId: chat.id,
      isNewChat,
      otherUser: {
        id: targetUser.id,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        username: targetUser.username,
        avatar: targetUser.avatar,
        userType: targetUser.userType,
        lastActiveAt: targetUser.lastActiveAt
      },
      redirectUrl: `/chat/${chat.id}` // URL para redirección en frontend
    },
    timestamp: new Date().toISOString()
  });
});

// ✅ NUEVO: Crear chat tripartito para disputas (solo admins)
const createDisputeChat = catchAsync(async (req, res) => {
  const { escortId, agencyId, reason } = req.body;
  const adminId = req.user.id;

  // Verificar que solo admins pueden crear chats tripartitos
  if (req.user.userType !== 'ADMIN') {
    throw new AppError('Solo administradores pueden crear chats de disputa', 403, 'ADMIN_ONLY');
  }

  // Validar que escort y agencia existen y están relacionados
  const membership = await prisma.agencyMembership.findFirst({
    where: {
      escortId,
      agencyId,
      status: 'ACTIVE'
    },
    include: {
      escort: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true
            }
          }
        }
      },
      agency: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true
            }
          }
        }
      }
    }
  });

  if (!membership) {
    throw new AppError('No existe una relación activa entre el escort y la agencia', 400, 'NO_ACTIVE_MEMBERSHIP');
  }

  // Verificar que no existe ya un chat de disputa activo entre estos usuarios
  const existingDispute = await prisma.chat.findFirst({
    where: {
      isDisputeChat: true,
      disputeStatus: 'ACTIVE',
      members: {
        every: {
          userId: {
            in: [adminId, membership.escort.user.id, membership.agency.user.id]
          }
        }
      }
    }
  });

  if (existingDispute) {
    throw new AppError('Ya existe un chat de disputa activo entre estos usuarios', 400, 'DISPUTE_ALREADY_EXISTS');
  }

  // Crear chat tripartito
  const disputeChat = await prisma.chat.create({
    data: {
      isGroup: true,
      isDisputeChat: true,
      disputeStatus: 'ACTIVE',
      disputeReason: reason,
      name: `Disputa: ${membership.escort.user.firstName} - ${membership.agency.user.firstName}`,
      description: `Chat tripartito para resolver disputa. Razón: ${reason}`,
      members: {
        create: [
          {
            userId: adminId,
            role: 'ADMIN',
            maxMessages: 10 // Admin puede enviar más mensajes
          },
          {
            userId: membership.escort.user.id,
            role: 'MEMBER',
            maxMessages: 3 // Escort limitado a 3 mensajes
          },
          {
            userId: membership.agency.user.id,
            role: 'MEMBER',
            maxMessages: 3 // Agencia limitada a 3 mensajes
          }
        ]
      }
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              userType: true
            }
          }
        }
      }
    }
  });

  // Enviar mensaje de sistema inicial
  await prisma.message.create({
    data: {
      content: `Chat de disputa iniciado por el administrador. Razón: ${reason}. Cada parte puede enviar máximo 3 mensajes para exponer su caso.`,
      messageType: 'SYSTEM',
      senderId: adminId,
      chatId: disputeChat.id
    }
  });

  // Crear notificaciones para los participantes
  await chatService.createDisputeNotification(
    disputeChat.id,
    [membership.escort.user.id, membership.agency.user.id],
    'DISPUTE_CREATED',
    `Se ha creado un chat de disputa. Razón: ${reason}`
  );

  logger.info('Dispute chat created', {
    chatId: disputeChat.id,
    adminId,
    escortId,
    agencyId,
    reason
  });

  res.status(201).json({
    success: true,
    message: 'Chat de disputa creado exitosamente',
    data: {
      chat: disputeChat
    },
    timestamp: new Date().toISOString()
  });
});

// ✅ NUEVO: Obtener chats de disputa (solo admins)
const getDisputeChats = catchAsync(async (req, res) => {
  const { status = 'ACTIVE' } = req.query;
  const userId = req.user.id;

  // Verificar que solo admins pueden ver chats de disputa
  if (req.user.userType !== 'ADMIN') {
    throw new AppError('Solo administradores pueden ver chats de disputa', 403, 'ADMIN_ONLY');
  }

  const disputeChats = await prisma.chat.findMany({
    where: {
      isDisputeChat: true,
      ...(status && { disputeStatus: status }),
      members: {
        some: {
          userId
        }
      }
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              userType: true
            }
          }
        }
      },
      messages: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: {
          content: true,
          createdAt: true,
          messageType: true,
          sender: {
            select: {
              firstName: true,
              userType: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Obtener resumen de disputas
  const summary = await chatService.getDisputeChatsummary();

  res.status(200).json({
    success: true,
    data: {
      disputeChats,
      summary,
      total: disputeChats.length
    },
    timestamp: new Date().toISOString()
  });
});

// ✅ NUEVO: Cerrar chat de disputa (solo admins)
const closeDisputeChat = catchAsync(async (req, res) => {
  const { chatId } = req.params;
  const { resolution, finalDecision } = req.body;
  const adminId = req.user.id;

  // Verificar que solo admins pueden cerrar disputas
  if (req.user.userType !== 'ADMIN') {
    throw new AppError('Solo administradores pueden cerrar disputas', 403, 'ADMIN_ONLY');
  }

  // Verificar que el chat existe y es de disputa
  const disputeChat = await prisma.chat.findFirst({
    where: {
      id: chatId,
      isDisputeChat: true,
      members: {
        some: {
          userId: adminId
        }
      }
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              userType: true
            }
          }
        }
      }
    }
  });

  if (!disputeChat) {
    throw new AppError('Chat de disputa no encontrado', 404, 'DISPUTE_CHAT_NOT_FOUND');
  }

  if (disputeChat.disputeStatus === 'CLOSED') {
    throw new AppError('La disputa ya está cerrada', 400, 'DISPUTE_ALREADY_CLOSED');
  }

  // Actualizar estado del chat
  await prisma.chat.update({
    where: { id: chatId },
    data: {
      disputeStatus: 'CLOSED'
    }
  });

  // Enviar mensaje de cierre
  await prisma.message.create({
    data: {
      content: `DISPUTA CERRADA POR ADMINISTRADOR\n\nResolución: ${resolution}\n\nDecisión final: ${finalDecision}\n\nEste chat queda cerrado y no se pueden enviar más mensajes.`,
      messageType: 'SYSTEM',
      senderId: adminId,
      chatId
    }
  });

  // Notificar a los participantes
  const participantIds = disputeChat.members
    .filter(member => member.user.userType !== 'ADMIN')
    .map(member => member.userId);

  await chatService.createDisputeNotification(
    chatId,
    participantIds,
    'DISPUTE_CLOSED',
    `La disputa ha sido cerrada. Resolución: ${resolution}`
  );

  logger.info('Dispute chat closed', {
    chatId,
    adminId,
    resolution,
    finalDecision
  });

  res.status(200).json({
    success: true,
    message: 'Chat de disputa cerrado exitosamente',
    data: {
      chatId,
      disputeStatus: 'CLOSED',
      resolution,
      finalDecision
    },
    timestamp: new Date().toISOString()
  });
});

// ✅ NUEVO: Enviar mensaje en chat tripartito (con límites)
const addDisputeMessage = catchAsync(async (req, res) => {
  const { chatId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  if (!content || content.trim().length === 0) {
    throw new AppError('Contenido del mensaje es requerido', 400, 'MISSING_MESSAGE_CONTENT');
  }

  if (content.length > 1000) {
    throw new AppError('Mensaje muy largo. Máximo 1000 caracteres en disputas', 400, 'MESSAGE_TOO_LONG');
  }

  // Verificar que es un chat de disputa y está activo
  const disputeChat = await prisma.chat.findFirst({
    where: {
      id: chatId,
      isDisputeChat: true,
      disputeStatus: 'ACTIVE'
    },
    include: {
      members: {
        where: {
          userId
        }
      }
    }
  });

  if (!disputeChat) {
    throw new AppError('Chat de disputa no encontrado o cerrado', 404, 'DISPUTE_CHAT_NOT_FOUND');
  }

  const member = disputeChat.members[0];
  if (!member) {
    throw new AppError('No eres miembro de este chat de disputa', 403, 'NOT_DISPUTE_MEMBER');
  }

  // Verificar límite de mensajes (excepto para admins)
  if (req.user.userType !== 'ADMIN' && member.messageCount >= member.maxMessages) {
    throw new AppError(
      `Has alcanzado el límite de ${member.maxMessages} mensajes en este chat de disputa`,
      400,
      'DISPUTE_MESSAGE_LIMIT'
    );
  }

  // Transacción para crear mensaje y actualizar contador
  const result = await prisma.$transaction(async (tx) => {
    // Crear mensaje
    const message = await tx.message.create({
      data: {
        content: sanitizeString(content),
        messageType: 'TEXT',
        senderId: userId,
        chatId
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            userType: true
          }
        }
      }
    });

    // Actualizar contador de mensajes del miembro
    await tx.chatMember.update({
      where: {
        userId_chatId: {
          userId,
          chatId
        }
      },
      data: {
        messageCount: { increment: 1 }
      }
    });

    // Actualizar última actividad del chat
    await tx.chat.update({
      where: { id: chatId },
      data: { lastActivity: new Date() }
    });

    return message;
  });

  logger.info('Dispute message sent', {
    messageId: result.id,
    chatId,
    userId,
    userType: req.user.userType,
    messageCount: member.messageCount + 1,
    maxMessages: member.maxMessages
  });

  // Emitir evento de socket si está disponible
  try {
    if (req.app.get('io')) {
      req.app.get('io').to(chatId).emit('newDisputeMessage', {
        ...result,
        isMine: false
      });
    }
  } catch (error) {
    logger.warn('Failed to emit socket event:', error);
  }

  res.status(201).json({
    success: true,
    message: 'Mensaje de disputa enviado exitosamente',
    data: {
      ...result,
      isMine: true,
      remainingMessages: req.user.userType === 'ADMIN' ? 'unlimited' : Math.max(0, member.maxMessages - (member.messageCount + 1))
    },
    timestamp: new Date().toISOString()
  });
});

// Crear o obtener chat entre dos usuarios
const createOrGetChat = catchAsync(async (req, res) => {
  const senderId = req.user.id;
  const { receiverId } = req.body;

  // Validación de input
  if (!receiverId) {
    throw new AppError('ID del receptor es requerido', 400, 'MISSING_RECEIVER_ID');
  }

  if (senderId === receiverId) {
    throw new AppError('No puedes crear un chat contigo mismo', 400, 'CANNOT_CHAT_WITH_SELF');
  }

  // Verificar que el receptor existe y está activo
  const receiver = await prisma.user.findUnique({
    where: { 
      id: receiverId,
      isActive: true,
      isBanned: false
    },
    include: {
      settings: {
        select: {
          allowDirectMessages: true
        }
      },
      blockedUsers: {
        where: {
          blockedId: senderId
        },
        select: { id: true }
      }
    }
  });

  if (!receiver) {
    throw new AppError('Usuario no encontrado o no disponible', 404, 'USER_NOT_FOUND');
  }

  // Verificar si el receptor permite mensajes directos
  if (!receiver.settings?.allowDirectMessages) {
    throw new AppError('El usuario no permite mensajes directos', 403, 'DIRECT_MESSAGES_DISABLED');
  }

  // Verificar si estás bloqueado
  if (receiver.blockedUsers.length > 0) {
    throw new AppError('No puedes enviar mensajes a este usuario', 403, 'USER_BLOCKED_YOU');
  }

  // Verificar si has bloqueado al receptor
  const hasBlocked = await prisma.userBlock.findUnique({
    where: {
      blockerId_blockedId: {
        blockerId: senderId,
        blockedId: receiverId
      }
    }
  });

  if (hasBlocked) {
    throw new AppError('Has bloqueado a este usuario', 403, 'YOU_BLOCKED_USER');
  }

  // Verificar límites de cliente con validación
  if (req.user.userType === 'CLIENT') {
    await checkClientMessageLimits(req.user);
  }

  // Buscar chat existente entre los dos usuarios (excluir chats de disputa)
  let chat = await prisma.chat.findFirst({
    where: {
      isGroup: false,
      isDisputeChat: false,
      AND: [
        {
          members: {
            some: {
              userId: senderId
            }
          }
        },
        {
          members: {
            some: {
              userId: receiverId
            }
          }
        }
      ]
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true,
              userType: true,
              lastActiveAt: true
            }
          }
        }
      },
      messages: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: {
          content: true,
          createdAt: true,
          messageType: true
        }
      }
    }
  });

  // Si no existe chat, crear uno nuevo
  if (!chat) {
    chat = await prisma.chat.create({
      data: {
        isGroup: false,
        isPrivate: true,
        isDisputeChat: false,
        members: {
          create: [
            {
              userId: senderId,
              role: 'MEMBER'
            },
            {
              userId: receiverId,
              role: 'MEMBER'
            }
          ]
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatar: true,
                userType: true,
                lastActiveAt: true
              }
            }
          }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    logger.info('New chat created', {
      chatId: chat.id,
      senderId,
      receiverId
    });
  }

  // Actualizar última actividad del chat
  await prisma.chat.update({
    where: { id: chat.id },
    data: { lastActivity: new Date() }
  });

  res.status(200).json({
    success: true,
    data: {
      chat: {
        id: chat.id,
        isGroup: chat.isGroup,
        isDisputeChat: chat.isDisputeChat,
        members: chat.members,
        lastMessage: chat.messages[0] || null,
        lastActivity: chat.lastActivity,
        createdAt: chat.createdAt
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Obtener lista de chats del usuario
const getChats = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 20, archived = false, includeDisputes = false } = req.query;

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  // Construir filtros según tipo de usuario
  const whereClause = {
    members: {
      some: {
        userId,
        ...(archived === 'true' ? {} : { chat: { isArchived: false } })
      }
    },
    deletedAt: null
  };

  // Solo admins pueden ver chats de disputa
  if (includeDisputes === 'true' && req.user.userType === 'ADMIN') {
    // Incluir chats de disputa
  } else {
    // Excluir chats de disputa para usuarios normales
    whereClause.isDisputeChat = false;
  }

  const chats = await prisma.chat.findMany({
    where: whereClause,
    include: {
      members: {
        where: {
          userId: { not: userId }
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true,
              userType: true,
              lastActiveAt: true,
              settings: {
                select: {
                  showOnline: true,
                  showLastSeen: true
                }
              }
            }
          }
        }
      },
      messages: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          content: true,
          messageType: true,
          isRead: true,
          createdAt: true,
          senderId: true
        }
      },
      _count: {
        select: {
          messages: {
            where: {
              isRead: false,
              senderId: { not: userId }
            }
          }
        }
      }
    },
    orderBy: { lastActivity: 'desc' },
    skip: offset,
    take: limitNum
  });

  const formattedChats = chats.map(chat => ({
    id: chat.id,
    isGroup: chat.isGroup,
    isDisputeChat: chat.isDisputeChat,
    disputeStatus: chat.disputeStatus,
    name: chat.name,
    avatar: chat.avatar,
    isArchived: chat.isArchived,
    lastActivity: chat.lastActivity,
    // Para chats individuales, usar datos del otro usuario
    otherUser: chat.isGroup ? null : chat.members[0]?.user || null,
    lastMessage: chat.messages[0] || null,
    unreadCount: chat._count.messages,
    createdAt: chat.createdAt
  }));

  res.status(200).json({
    success: true,
    data: {
      chats: formattedChats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: chats.length,
        hasMore: chats.length === limitNum
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Obtener mensajes de un chat
const getChatMessages = catchAsync(async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;
  const { page = 1, limit = 50, before } = req.query;

  if (!chatId) {
    throw new AppError('ID del chat es requerido', 400, 'MISSING_CHAT_ID');
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
  const offset = (pageNum - 1) * limitNum;

  // Verificar que el usuario es miembro del chat
  const chatMember = await prisma.chatMember.findUnique({
    where: {
      userId_chatId: {
        userId,
        chatId
      }
    },
    include: {
      chat: {
        select: {
          isDisputeChat: true,
          disputeStatus: true
        }
      }
    }
  });

  if (!chatMember) {
    throw new AppError('No tienes acceso a este chat', 403, 'CHAT_ACCESS_DENIED');
  }

  // Construir filtros
  const whereClause = {
    chatId,
    deletedAt: null,
    ...(before && {
      createdAt: { lt: new Date(before) }
    })
  };

  const messages = await prisma.message.findMany({
    where: whereClause,
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          userType: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limitNum
  });

  // Marcar mensajes como leídos (solo si no es chat de disputa cerrado)
  const unreadMessageIds = messages
    .filter(msg => msg.senderId !== userId && !msg.isRead)
    .map(msg => msg.id);

  if (unreadMessageIds.length > 0 && 
      (!chatMember.chat.isDisputeChat || chatMember.chat.disputeStatus === 'ACTIVE')) {
    await Promise.all([
      prisma.message.updateMany({
        where: {
          id: { in: unreadMessageIds }
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      }),
      prisma.chatMember.update({
        where: {
          userId_chatId: {
            userId,
            chatId
          }
        },
        data: { lastRead: new Date() }
      })
    ]);
  }

  // Formatear mensajes (más recientes primero para scroll infinito)
  const formattedMessages = messages.reverse().map(message => ({
    id: message.id,
    content: message.content,
    messageType: message.messageType,
    fileUrl: message.fileUrl,
    fileName: message.fileName,
    fileSize: message.fileSize,
    mimeType: message.mimeType,
    isRead: message.isRead,
    readAt: message.readAt,
    isEdited: message.isEdited,
    editedAt: message.editedAt,
    costPoints: message.costPoints,
    isPremiumMessage: message.isPremiumMessage,
    replyToId: message.replyToId,
    createdAt: message.createdAt,
    sender: message.sender,
    isMine: message.senderId === userId
  }));

  // Información adicional para chats tripartitos
  let chatInfo = {};
  if (chatMember.chat.isDisputeChat) {
    chatInfo = {
      isDisputeChat: true,
      disputeStatus: chatMember.chat.disputeStatus,
      remainingMessages: req.user.userType === 'ADMIN' ? 'unlimited' : Math.max(0, chatMember.maxMessages - chatMember.messageCount)
    };
  }

  res.status(200).json({
    success: true,
    data: {
      messages: formattedMessages,
      chatInfo,
      pagination: {
        page: pageNum,
        limit: limitNum,
        hasMore: messages.length === limitNum
      }
    },
    timestamp: new Date().toISOString()
  });
});

// ENVIAR MENSAJE - OPTIMIZADO PARA CLOUDINARY CON VALIDACIONES ROBUSTAS
const sendMessage = catchAsync(async (req, res) => {
  const { chatId } = req.params;
  const senderId = req.user.id;
  const {
    content,
    messageType = 'TEXT',
    replyToId,
    isPremiumMessage = false
  } = req.body;

  // Validación de inputs
  if (!chatId) {
    throw new AppError('ID del chat es requerido', 400, 'MISSING_CHAT_ID');
  }

  if (!content && !req.file) {
    throw new AppError('Contenido del mensaje o archivo es requerido', 400, 'MISSING_MESSAGE_CONTENT');
  }

  if (!['TEXT', 'IMAGE', 'FILE', 'AUDIO', 'VIDEO'].includes(messageType)) {
    throw new AppError('Tipo de mensaje inválido', 400, 'INVALID_MESSAGE_TYPE');
  }

  // Verificar que el usuario es miembro del chat
  const chatMember = await prisma.chatMember.findUnique({
    where: {
      userId_chatId: {
        userId: senderId,
        chatId
      }
    },
    include: {
      chat: {
        include: {
          members: {
            where: {
              userId: { not: senderId }
            },
            include: {
              user: {
                select: {
                  id: true,
                  userType: true,
                  settings: {
                    select: {
                      allowDirectMessages: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!chatMember) {
    throw new AppError('No tienes acceso a este chat', 403, 'CHAT_ACCESS_DENIED');
  }

  // Verificar si es chat de disputa y aplicar restricciones
  if (chatMember.chat.isDisputeChat) {
    if (chatMember.chat.disputeStatus !== 'ACTIVE') {
      throw new AppError('No se pueden enviar mensajes en un chat de disputa cerrado', 403, 'DISPUTE_CHAT_CLOSED');
    }

    // Solo mensajes de texto en chats de disputa
    if (messageType !== 'TEXT') {
      throw new AppError('Solo se permiten mensajes de texto en chats de disputa', 400, 'DISPUTE_TEXT_ONLY');
    }

    // Verificar límite de mensajes (excepto para admins)
    if (req.user.userType !== 'ADMIN' && chatMember.messageCount >= chatMember.maxMessages) {
      throw new AppError(
        `Has alcanzado el límite de ${chatMember.maxMessages} mensajes en este chat de disputa`,
        400,
        'DISPUTE_MESSAGE_LIMIT'
      );
    }

    // Límite de caracteres para disputas
    if (content && content.length > 1000) {
      throw new AppError('Mensaje muy largo. Máximo 1000 caracteres en disputas', 400, 'MESSAGE_TOO_LONG');
    }
  }

  // Verificar límites de cliente con validación mejorada
  let pointsCost = 0;
  if (req.user.userType === 'CLIENT') {
    const limits = await checkClientMessageLimits(req.user);
    
    // El pointsCost ya fue calculado en el middleware validateChatCapabilities
    pointsCost = req.pointsCost || 0;

    // Verificar si tiene puntos suficientes
    if (!req.user.client) {
      throw new AppError('Datos de cliente no encontrados', 500, 'CLIENT_DATA_MISSING');
    }

    if (req.user.client.points < pointsCost) {
      throw new AppError('Puntos insuficientes para enviar mensaje', 400, 'INSUFFICIENT_POINTS');
    }
  }

  // PROCESAR ARCHIVO CON CLOUDINARY SI EXISTE
  let fileData = {};
  if (req.file && (messageType === 'IMAGE' || messageType === 'FILE' || messageType === 'AUDIO' || messageType === 'VIDEO')) {
    try {
      // Subir archivo a Cloudinary
      const uploadResult = await uploadToCloudinary(req.file.buffer, {
        folder: 'telofundi/chat',
        resource_type: 'auto',
        public_id: `chat_${senderId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });

      fileData = {
        fileUrl: uploadResult.secure_url,
        fileName: req.file.originalname || 'archivo_chat',
        fileSize: req.file.size || uploadResult.bytes || 0,
        mimeType: req.file.mimetype || uploadResult.format || 'application/octet-stream'
      };

      logger.info('Chat file uploaded to Cloudinary', {
        chatId,
        senderId,
        fileUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        fileSize: fileData.fileSize,
        messageType
      });
    } catch (uploadError) {
      logger.error('Error uploading chat file to Cloudinary:', uploadError);
      throw new AppError('Error subiendo archivo', 500, 'FILE_UPLOAD_ERROR');
    }
  }

  // Transacción para operaciones críticas
  const result = await prisma.$transaction(async (tx) => {
    // Crear mensaje
    const message = await tx.message.create({
      data: {
        content: sanitizeString(content) || '',
        messageType,
        senderId,
        chatId,
        replyToId: replyToId || null,
        isPremiumMessage,
        costPoints: pointsCost,
        ...fileData
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            userType: true
          }
        },
        chat: {
          select: {
            id: true,
            isGroup: true,
            isDisputeChat: true
          }
        }
      }
    });

    // Actualizar actividad del chat
    await tx.chat.update({
      where: { id: chatId },
      data: { lastActivity: new Date() }
    });

    // Para chats de disputa, actualizar contador de mensajes
    if (chatMember.chat.isDisputeChat && req.user.userType !== 'ADMIN') {
      await tx.chatMember.update({
        where: {
          userId_chatId: {
            userId: senderId,
            chatId
          }
        },
        data: {
          messageCount: { increment: 1 }
        }
      });
    }

    // Descontar puntos y actualizar estadísticas si es cliente
    if (req.user.userType === 'CLIENT' && pointsCost > 0) {
      await Promise.all([
        tx.client.update({
          where: { userId: senderId },
          data: {
            points: { decrement: pointsCost },
            messagesUsedToday: { increment: 1 },
            totalMessagesUsed: { increment: 1 }
          }
        }),
        tx.pointTransaction.create({
          data: {
            clientId: req.user.client.id,
            amount: -pointsCost,
            type: messageType === 'IMAGE' ? 'IMAGE_MESSAGE' : 'CHAT_MESSAGE',
            description: `Mensaje ${messageType.toLowerCase()} enviado en chat`,
            messageId: message.id,
            balanceBefore: req.user.client.points,
            balanceAfter: req.user.client.points - pointsCost
          }
        })
      ]);
    }

    // Actualizar contador de mensajes del miembro (para chats normales)
    if (!chatMember.chat.isDisputeChat) {
      await tx.chatMember.update({
        where: {
          userId_chatId: {
            userId: senderId,
            chatId
          }
        },
        data: { messagesCount: { increment: 1 } }
      });
    }

    return message;
  });

  // Registrar interacción para algoritmos
  const otherMembers = chatMember.chat.members;
  if (otherMembers.length > 0 && !chatMember.chat.isDisputeChat) {
    const receiverId = otherMembers[0].userId;
    
    try {
      await prisma.userInteraction.create({
        data: {
          userId: senderId,
          targetUserId: receiverId,
          type: 'CHAT',
          weight: isPremiumMessage ? 5.0 : (messageType === 'IMAGE' ? 3.0 : 2.0),
          source: 'chat',
          deviceType: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'desktop'
        }
      });

      // Actualizar métricas de reputación
      await prisma.userReputation.upsert({
        where: { userId: senderId },
        update: {
          totalMessages: { increment: 1 },
          lastScoreUpdate: new Date()
        },
        create: {
          userId: senderId,
          overallScore: 0,
          responseRate: 0,
          averageResponseTime: null,
          profileCompleteness: 0,
          trustScore: 0,
          totalViews: 0,
          totalLikes: 0,
          totalMessages: 1,
          totalFavorites: 0,
          discoveryScore: 0,
          trendingScore: 0,
          qualityScore: 0,
          spamScore: 0,
          reportScore: 0,
          lastScoreUpdate: new Date()
        }
      });
    } catch (error) {
      logger.warn('Failed to create user interaction or update reputation:', error);
    }
  }

  logger.info('Message sent', {
    messageId: result.id,
    chatId,
    senderId,
    messageType,
    pointsCost,
    isPremiumMessage,
    hasFile: !!fileData.fileUrl,
    isDisputeChat: chatMember.chat.isDisputeChat
  });

  // Emitir evento de socket para tiempo real con manejo de errores
  try {
    if (req.app.get('io')) {
      req.app.get('io').to(chatId).emit('newMessage', {
        ...result,
        isMine: false // Para otros usuarios
      });
    }
  } catch (error) {
    logger.warn('Failed to emit socket event:', error);
  }

  // Información adicional para respuesta
  let additionalInfo = {};
  if (chatMember.chat.isDisputeChat && req.user.userType !== 'ADMIN') {
    additionalInfo.remainingMessages = Math.max(0, chatMember.maxMessages - (chatMember.messageCount + 1));
  }

  res.status(201).json({
    success: true,
    message: 'Mensaje enviado exitosamente',
    data: {
      ...result,
      isMine: true,
      ...additionalInfo
    },
    timestamp: new Date().toISOString()
  });
});

// Editar mensaje
const editMessage = catchAsync(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.id;
  const { content } = req.body;

  if (!messageId) {
    throw new AppError('ID del mensaje es requerido', 400, 'MISSING_MESSAGE_ID');
  }

  if (!content || content.trim().length === 0) {
    throw new AppError('Contenido del mensaje es requerido', 400, 'MISSING_MESSAGE_CONTENT');
  }

  // Verificar que el mensaje existe y pertenece al usuario
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      senderId: userId,
      deletedAt: null
    },
    include: {
      chat: {
        select: {
          isDisputeChat: true,
          disputeStatus: true
        }
      }
    }
  });

  if (!message) {
    throw new AppError('Mensaje no encontrado o no tienes permisos', 404, 'MESSAGE_NOT_FOUND');
  }

  // No permitir edición en chats de disputa
  if (message.chat.isDisputeChat) {
    throw new AppError('No se pueden editar mensajes en chats de disputa', 400, 'CANNOT_EDIT_DISPUTE_MESSAGE');
  }

  // Verificar que el mensaje no es muy antiguo (máximo 24 horas)
  const maxEditTime = 24 * 60 * 60 * 1000; // 24 horas
  if (Date.now() - message.createdAt.getTime() > maxEditTime) {
    throw new AppError('El mensaje es muy antiguo para editar', 400, 'MESSAGE_TOO_OLD');
  }

  // Solo permitir editar mensajes de texto
  if (message.messageType !== 'TEXT') {
    throw new AppError('Solo puedes editar mensajes de texto', 400, 'CANNOT_EDIT_FILE_MESSAGE');
  }

  // Actualizar mensaje
  const updatedMessage = await prisma.message.update({
    where: { id: messageId },
    data: {
      content: sanitizeString(content),
      isEdited: true,
      editedAt: new Date()
    },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true
        }
      }
    }
  });

  logger.info('Message edited', {
    messageId,
    userId,
    chatId: message.chatId
  });

  // Emitir evento de socket con manejo de errores
  try {
    if (req.app.get('io')) {
      req.app.get('io').to(message.chatId).emit('messageEdited', updatedMessage);
    }
  } catch (error) {
    logger.warn('Failed to emit socket event:', error);
  }

  res.status(200).json({
    success: true,
    message: 'Mensaje editado exitosamente',
    data: updatedMessage,
    timestamp: new Date().toISOString()
  });
});

// ELIMINAR MENSAJE - CON LIMPIEZA DE CLOUDINARY MEJORADA
const deleteMessage = catchAsync(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.id;

  if (!messageId) {
    throw new AppError('ID del mensaje es requerido', 400, 'MISSING_MESSAGE_ID');
  }

  // Verificar que el mensaje existe y pertenece al usuario
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      senderId: userId,
      deletedAt: null
    },
    include: {
      chat: {
        select: {
          isDisputeChat: true,
          disputeStatus: true
        }
      }
    }
  });

  if (!message) {
    throw new AppError('Mensaje no encontrado o no tienes permisos', 404, 'MESSAGE_NOT_FOUND');
  }

  // No permitir eliminación en chats de disputa
  if (message.chat.isDisputeChat) {
    throw new AppError('No se pueden eliminar mensajes en chats de disputa', 400, 'CANNOT_DELETE_DISPUTE_MESSAGE');
  }

  // Eliminar archivo de Cloudinary si existe
  if (message.fileUrl && message.fileUrl.includes('cloudinary')) {
    try {
      const publicId = extractPublicIdFromUrl(message.fileUrl);
      if (publicId) {
        await deleteFromCloudinary(publicId);
        logger.info('Chat file deleted from Cloudinary', {
          messageId,
          publicId,
          fileUrl: message.fileUrl
        });
      }
    } catch (error) {
      logger.warn('Could not delete chat file from Cloudinary', {
        messageId,
        fileUrl: message.fileUrl,
        error: error.message
      });
    }
  }

  // Soft delete del mensaje
  await prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date() }
  });

  logger.info('Message deleted', {
    messageId,
    userId,
    chatId: message.chatId,
    hadFile: !!message.fileUrl
  });

  // Emitir evento de socket con manejo de errores
  try {
    if (req.app.get('io')) {
      req.app.get('io').to(message.chatId).emit('messageDeleted', { messageId });
    }
  } catch (error) {
    logger.warn('Failed to emit socket event:', error);
  }

  res.status(200).json({
    success: true,
    message: 'Mensaje eliminado exitosamente',
    timestamp: new Date().toISOString()
  });
});

// Archivar/desarchivar chat
const toggleChatArchive = catchAsync(async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;

  if (!chatId) {
    throw new AppError('ID del chat es requerido', 400, 'MISSING_CHAT_ID');
  }

  // Verificar que el usuario es miembro del chat
  const chatMember = await prisma.chatMember.findUnique({
    where: {
      userId_chatId: {
        userId,
        chatId
      }
    },
    include: {
      chat: {
        select: {
          id: true,
          isArchived: true,
          isDisputeChat: true
        }
      }
    }
  });

  if (!chatMember) {
    throw new AppError('No tienes acceso a este chat', 403, 'CHAT_ACCESS_DENIED');
  }

  // No permitir archivar chats de disputa
  if (chatMember.chat.isDisputeChat) {
    throw new AppError('No se pueden archivar chats de disputa', 400, 'CANNOT_ARCHIVE_DISPUTE_CHAT');
  }

  // Alternar estado de archivado
  const updatedChat = await prisma.chat.update({
    where: { id: chatId },
    data: { isArchived: !chatMember.chat.isArchived }
  });

  logger.info('Chat archive toggled', {
    chatId,
    userId,
    isArchived: updatedChat.isArchived
  });

  res.status(200).json({
    success: true,
    message: updatedChat.isArchived ? 'Chat archivado' : 'Chat desarchivado',
    data: {
      chatId,
      isArchived: updatedChat.isArchived
    },
    timestamp: new Date().toISOString()
  });
});

// Silenciar/activar notificaciones del chat
const toggleChatMute = catchAsync(async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;
  const { mutedUntil } = req.body;

  if (!chatId) {
    throw new AppError('ID del chat es requerido', 400, 'MISSING_CHAT_ID');
  }

  // Verificar que el usuario es miembro del chat
  const chatMember = await prisma.chatMember.findUnique({
    where: {
      userId_chatId: {
        userId,
        chatId
      }
    }
  });

  if (!chatMember) {
    throw new AppError('No tienes acceso a este chat', 403, 'CHAT_ACCESS_DENIED');
  }

  // Validación de fecha si se proporciona
  let mutedUntilDate = null;
  if (mutedUntil) {
    mutedUntilDate = new Date(mutedUntil);
    if (isNaN(mutedUntilDate.getTime())) {
      throw new AppError('Fecha de silenciado inválida', 400, 'INVALID_MUTE_DATE');
    }
  }

  // Actualizar configuración de silenciado
  const updatedMember = await prisma.chatMember.update({
    where: {
      userId_chatId: {
        userId,
        chatId
      }
    },
    data: {
      isMuted: !!mutedUntilDate,
      chat: {
        update: {
          mutedUntil: mutedUntilDate
        }
      }
    }
  });

  logger.info('Chat mute toggled', {
    chatId,
    userId,
    isMuted: !!mutedUntilDate,
    mutedUntil: mutedUntilDate
  });

  res.status(200).json({
    success: true,
    message: mutedUntilDate ? 'Chat silenciado' : 'Notificaciones activadas',
    data: {
      chatId,
      isMuted: !!mutedUntilDate,
      mutedUntil: mutedUntilDate
    },
    timestamp: new Date().toISOString()
  });
});

// Buscar mensajes en un chat
const searchMessages = catchAsync(async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;
  const { q: query, messageType, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

  if (!chatId) {
    throw new AppError('ID del chat es requerido', 400, 'MISSING_CHAT_ID');
  }

  if (!query && !messageType && !dateFrom && !dateTo) {
    throw new AppError('Al menos un criterio de búsqueda es requerido', 400, 'MISSING_SEARCH_CRITERIA');
  }

  // Verificar acceso al chat
  const chatMember = await prisma.chatMember.findUnique({
    where: {
      userId_chatId: {
        userId,
        chatId
      }
    }
  });

  if (!chatMember) {
    throw new AppError('No tienes acceso a este chat', 403, 'CHAT_ACCESS_DENIED');
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  // Construir filtros de búsqueda
  const whereClause = {
    chatId,
    deletedAt: null,
    ...(query && {
      content: {
        contains: sanitizeString(query),
        mode: 'insensitive'
      }
    }),
    ...(messageType && { messageType }),
    ...(dateFrom && {
      createdAt: {
        gte: new Date(dateFrom)
      }
    }),
    ...(dateTo && {
      createdAt: {
        ...whereClause.createdAt,
        lte: new Date(dateTo)
      }
    })
  };

  const [messages, totalCount] = await Promise.all([
    prisma.message.findMany({
      where: whereClause,
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limitNum
    }),
    prisma.message.count({ where: whereClause })
  ]);

  const pagination = {
    page: pageNum,
    limit: limitNum,
    total: totalCount,
    pages: Math.ceil(totalCount / limitNum),
    hasNext: pageNum * limitNum < totalCount,
    hasPrev: pageNum > 1
  };

  res.status(200).json({
    success: true,
    data: {
      messages: messages.map(msg => ({
        ...msg,
        isMine: msg.senderId === userId
      })),
      pagination,
      filters: {
        query,
        messageType,
        dateFrom,
        dateTo
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Obtener estadísticas del chat
const getChatStats = catchAsync(async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;

  if (!chatId) {
    throw new AppError('ID del chat es requerido', 400, 'MISSING_CHAT_ID');
  }

  // Verificar acceso al chat
  const chatMember = await prisma.chatMember.findUnique({
    where: {
      userId_chatId: {
        userId,
        chatId
      }
    }
  });

  if (!chatMember) {
    throw new AppError('No tienes acceso a este chat', 403, 'CHAT_ACCESS_DENIED');
  }

  // Obtener estadísticas usando el servicio
  const stats = await chatService.getChatAnalytics(chatId, userId);

  res.status(200).json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString()
  });
});

// Reportar mensaje/chat
const reportMessage = catchAsync(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.id;
  const { reason, description } = req.body;

  if (!messageId) {
    throw new AppError('ID del mensaje es requerido', 400, 'MISSING_MESSAGE_ID');
  }

  if (!reason) {
    throw new AppError('Razón del reporte es requerida', 400, 'MISSING_REPORT_REASON');
  }

  // Verificar que el mensaje existe
  const message = await prisma.message.findUnique({
    where: { 
      id: messageId,
      deletedAt: null
    },
    include: {
      chat: {
        include: {
          members: {
            where: { userId },
            select: { id: true }
          }
        }
      }
    }
  });

  if (!message) {
    throw new AppError('Mensaje no encontrado', 404, 'MESSAGE_NOT_FOUND');
  }

  // Verificar que el usuario es miembro del chat
  if (message.chat.members.length === 0) {
    throw new AppError('No tienes acceso a este chat', 403, 'CHAT_ACCESS_DENIED');
  }

  // No permitir reportar propio mensaje
  if (message.senderId === userId) {
    throw new AppError('No puedes reportar tu propio mensaje', 400, 'CANNOT_REPORT_OWN_MESSAGE');
  }

  // Crear reporte
  const report = await prisma.report.create({
    data: {
      reason,
      description: sanitizeString(description) || null,
      authorId: userId,
      targetUserId: message.senderId,
      evidence: {
        messageId,
        chatId: message.chatId,
        messageContent: message.content,
        messageType: message.messageType,
        fileUrl: message.fileUrl || null
      },
      severity: 'MEDIUM'
    }
  });

  logger.info('Message reported', {
    reportId: report.id,
    messageId,
    reporterId: userId,
    reportedUserId: message.senderId,
    reason,
    hadFile: !!message.fileUrl
  });

  res.status(200).json({
    success: true,
    message: 'Mensaje reportado exitosamente',
    data: {
      reportId: report.id
    },
    timestamp: new Date().toISOString()
  });
});

// Función helper para verificar límites de cliente CON VALIDACIONES
const checkClientMessageLimits = async (user) => {
  if (user.userType !== 'CLIENT') {
    return { canSend: true };
  }

  const client = user.client;
  if (!client) {
    throw new AppError('Datos de cliente no encontrados', 500, 'CLIENT_DATA_MISSING');
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Resetear contador diario si es necesario
  if (!client.lastMessageReset || client.lastMessageReset < today) {
    await prisma.client.update({
      where: { id: client.id },
      data: {
        messagesUsedToday: 0,
        lastMessageReset: today
      }
    });
    client.messagesUsedToday = 0;
  }

  // Verificar límite diario según tier
  let dailyLimit = client.dailyMessageLimit || 5; // Default para BASIC
  
  // VIP y Premium tienen mensajes ilimitados
  if (client.isPremium || ['PREMIUM', 'VIP'].includes(client.premiumTier)) {
    dailyLimit = -1; // Ilimitado
  }

  const messagesUsed = client.messagesUsedToday || 0;
  
  if (dailyLimit !== -1 && messagesUsed >= dailyLimit) {
    throw new AppError(
      `Has alcanzado tu límite diario de ${dailyLimit} mensajes. Actualiza tu cuenta para enviar más.`,
      400,
      'DAILY_MESSAGE_LIMIT_REACHED'
    );
  }

  return {
    canSend: true,
    messagesUsed: messagesUsed,
    dailyLimit: dailyLimit === -1 ? 'unlimited' : dailyLimit,
    pointsAvailable: client.points || 0
  };
};

// Función helper para extraer public_id de URL de Cloudinary MEJORADA
const extractPublicIdFromUrl = (cloudinaryUrl) => {
  try {
    if (!cloudinaryUrl || typeof cloudinaryUrl !== 'string' || !cloudinaryUrl.includes('cloudinary')) {
      return null;
    }
    
    // Extraer public_id de la URL de Cloudinary
    const matches = cloudinaryUrl.match(/\/v\d+\/([^/.]+)(?:\.[^/]*)?$/);
    if (matches && matches[1]) {
      return matches[1];
    }

    // Formato alternativo sin versión
    const altMatches = cloudinaryUrl.match(/\/upload\/([^/.]+)(?:\.[^/]*)?$/);
    if (altMatches && altMatches[1]) {
      return altMatches[1];
    }

    // Para archivos en carpetas (como telofundi/chat/...)
    const folderMatches = cloudinaryUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^/.]*)?$/);
    if (folderMatches && folderMatches[1]) {
      return folderMatches[1];
    }

    return null;
  } catch (error) {
    logger.error('Error extracting public_id from Cloudinary URL', {
      url: cloudinaryUrl,
      error: error.message
    });
    return null;
  }
};

module.exports = {
  createOrGetChat,
  getChats,
  getChatMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  toggleChatArchive,
  toggleChatMute,
  searchMessages,
  getChatStats,
  reportMessage,
  // ✅ NUEVAS: Funciones para chat tripartito
  createDisputeChat,
  getDisputeChats,
  closeDisputeChat,
  addDisputeMessage,
  // ✅ NUEVA: Función para crear chat desde perfil
  createChatFromProfile
};