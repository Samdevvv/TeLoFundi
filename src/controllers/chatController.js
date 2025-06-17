const { prisma } = require('../config/database');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { sanitizeString } = require('../utils/validators');
const { uploadToCloudinary, deleteFromCloudinary } = require('../services/uploadService');
const logger = require('../utils/logger');

// Crear o obtener chat entre dos usuarios
const createOrGetChat = catchAsync(async (req, res) => {
  const senderId = req.user.id;
  const { receiverId } = req.body;

  // ✅ CORREGIDO: Validación de input
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

  // ✅ CORREGIDO: Verificar límites de cliente con validación
  if (req.user.userType === 'CLIENT') {
    await checkClientMessageLimits(req.user);
  }

  // Buscar chat existente entre los dos usuarios
  let chat = await prisma.chat.findFirst({
    where: {
      isGroup: false,
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
  const { page = 1, limit = 20, archived = false } = req.query;

  // ✅ CORREGIDO: Validación de paginación consistente
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  const chats = await prisma.chat.findMany({
    where: {
      members: {
        some: {
          userId,
          ...(archived === 'true' ? {} : { chat: { isArchived: false } })
        }
      },
      deletedAt: null
    },
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

  // ✅ CORREGIDO: Validación de input
  if (!chatId) {
    throw new AppError('ID del chat es requerido', 400, 'MISSING_CHAT_ID');
  }

  // ✅ CORREGIDO: Validación de paginación consistente
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

  // Marcar mensajes como leídos
  const unreadMessageIds = messages
    .filter(msg => msg.senderId !== userId && !msg.isRead)
    .map(msg => msg.id);

  if (unreadMessageIds.length > 0) {
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
      // Actualizar lastRead del miembro
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

  res.status(200).json({
    success: true,
    data: {
      messages: formattedMessages,
      pagination: {
        page: pageNum,
        limit: limitNum,
        hasMore: messages.length === limitNum
      }
    },
    timestamp: new Date().toISOString()
  });
});

// ✅ CORREGIDO: ENVIAR MENSAJE - OPTIMIZADO PARA CLOUDINARY CON VALIDACIONES
const sendMessage = catchAsync(async (req, res) => {
  const { chatId } = req.params;
  const senderId = req.user.id;
  const {
    content,
    messageType = 'TEXT',
    replyToId,
    isPremiumMessage = false
  } = req.body;

  // ✅ CORREGIDO: Validación de inputs
  if (!chatId) {
    throw new AppError('ID del chat es requerido', 400, 'MISSING_CHAT_ID');
  }

  if (!content && !req.uploadedFile) {
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

  // ✅ CORREGIDO: Verificar límites de cliente con validación mejorada
  let pointsCost = 0;
  if (req.user.userType === 'CLIENT') {
    const limits = await checkClientMessageLimits(req.user);
    
    // Calcular costo en puntos según el tipo de mensaje
    if (isPremiumMessage) {
      pointsCost = 5;
    } else if (messageType === 'IMAGE') {
      pointsCost = 2;
    } else if (messageType === 'FILE') {
      pointsCost = 3;
    } else if (messageType === 'AUDIO' || messageType === 'VIDEO') {
      pointsCost = 4;
    } else {
      pointsCost = 1;
    }

    // ✅ CORREGIDO: Verificar si tiene puntos suficientes
    if (!req.user.client) {
      throw new AppError('Datos de cliente no encontrados', 500, 'CLIENT_DATA_MISSING');
    }

    if (req.user.client.points < pointsCost) {
      throw new AppError('Puntos insuficientes para enviar mensaje', 400, 'INSUFFICIENT_POINTS');
    }
  }

  // ✅ CORREGIDO: PROCESAR ARCHIVO CON CLOUDINARY SI EXISTE
  let fileData = {};
  if (req.uploadedFile && (messageType === 'IMAGE' || messageType === 'FILE' || messageType === 'AUDIO' || messageType === 'VIDEO')) {
    // ✅ CORREGIDO: Validación de que uploadedFile tiene las propiedades necesarias
    if (!req.uploadedFile.secure_url) {
      throw new AppError('Error al procesar archivo subido', 500, 'FILE_UPLOAD_ERROR');
    }

    fileData = {
      fileUrl: req.uploadedFile.secure_url,
      fileName: req.uploadedFile.originalname || req.uploadedFile.original_filename || 'archivo',
      fileSize: req.uploadedFile.size || req.uploadedFile.bytes || 0,
      mimeType: req.uploadedFile.mimetype || req.uploadedFile.format || 'application/octet-stream'
    };

    logger.info('Chat file uploaded to Cloudinary', {
      chatId,
      senderId,
      fileUrl: req.uploadedFile.secure_url,
      publicId: req.uploadedFile.public_id,
      fileSize: fileData.fileSize,
      messageType
    });
  }

  // ✅ CORREGIDO: Transacción para operaciones críticas
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
            isGroup: true
          }
        }
      }
    });

    // Actualizar actividad del chat
    await tx.chat.update({
      where: { id: chatId },
      data: { lastActivity: new Date() }
    });

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

    // Actualizar contador de mensajes del miembro
    await tx.chatMember.update({
      where: {
        userId_chatId: {
          userId: senderId,
          chatId
        }
      },
      data: { messagesCount: { increment: 1 } }
    });

    return message;
  });

  // Registrar interacción para algoritmos
  const otherMembers = chatMember.chat.members;
  if (otherMembers.length > 0) {
    const receiverId = otherMembers[0].userId;
    
    // ✅ Crear interacción con manejo de errores
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
    hasFile: !!fileData.fileUrl
  });

  // ✅ CORREGIDO: Emitir evento de socket para tiempo real con manejo de errores
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

  res.status(201).json({
    success: true,
    message: 'Mensaje enviado exitosamente',
    data: {
      ...result,
      isMine: true
    },
    timestamp: new Date().toISOString()
  });
});

// Editar mensaje
const editMessage = catchAsync(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.id;
  const { content } = req.body;

  // ✅ CORREGIDO: Validación de inputs
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
    }
  });

  if (!message) {
    throw new AppError('Mensaje no encontrado o no tienes permisos', 404, 'MESSAGE_NOT_FOUND');
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

  // ✅ CORREGIDO: Emitir evento de socket con manejo de errores
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

// ✅ CORREGIDO: ELIMINAR MENSAJE - CON LIMPIEZA DE CLOUDINARY MEJORADA
const deleteMessage = catchAsync(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.id;

  // ✅ CORREGIDO: Validación de input
  if (!messageId) {
    throw new AppError('ID del mensaje es requerido', 400, 'MISSING_MESSAGE_ID');
  }

  // Verificar que el mensaje existe y pertenece al usuario
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      senderId: userId,
      deletedAt: null
    }
  });

  if (!message) {
    throw new AppError('Mensaje no encontrado o no tienes permisos', 404, 'MESSAGE_NOT_FOUND');
  }

  // ✅ CORREGIDO: Eliminar archivo de Cloudinary si existe
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
      // Continuar con el proceso aunque falle la eliminación de Cloudinary
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

  // ✅ CORREGIDO: Emitir evento de socket con manejo de errores
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

  // ✅ CORREGIDO: Validación de input
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
          isArchived: true
        }
      }
    }
  });

  if (!chatMember) {
    throw new AppError('No tienes acceso a este chat', 403, 'CHAT_ACCESS_DENIED');
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
  const { mutedUntil } = req.body; // Timestamp o null para desactivar

  // ✅ CORREGIDO: Validación de input
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

  // ✅ CORREGIDO: Validación de fecha si se proporciona
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

  // ✅ CORREGIDO: Validaciones de input
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

  // ✅ CORREGIDO: Validación de paginación consistente
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

  // ✅ CORREGIDO: Validación de input
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

  // Obtener estadísticas
  const [
    totalMessages,
    messagesByType,
    messagesByMember,
    firstMessage
  ] = await Promise.all([
    // Total de mensajes
    prisma.message.count({
      where: {
        chatId,
        deletedAt: null
      }
    }),
    // Mensajes por tipo (incluye estadísticas de archivos de Cloudinary)
    prisma.message.groupBy({
      by: ['messageType'],
      where: {
        chatId,
        deletedAt: null
      },
      _count: true
    }),
    // Mensajes por miembro
    prisma.message.groupBy({
      by: ['senderId'],
      where: {
        chatId,
        deletedAt: null
      },
      _count: true
    }),
    // Primer mensaje
    prisma.message.findFirst({
      where: {
        chatId,
        deletedAt: null
      },
      orderBy: { createdAt: 'asc' },
      select: {
        createdAt: true
      }
    })
  ]);

  // Obtener información de miembros para estadísticas
  const members = await prisma.chatMember.findMany({
    where: { chatId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true
        }
      }
    }
  });

  const memberMap = new Map(members.map(m => [m.userId, m.user]));

  const stats = {
    totalMessages,
    messagesByType: messagesByType.reduce((acc, item) => {
      acc[item.messageType] = item._count;
      return acc;
    }, {}),
    messagesByMember: messagesByMember.map(item => ({
      user: memberMap.get(item.senderId),
      count: item._count
    })),
    chatAge: firstMessage ? 
      Math.floor((Date.now() - firstMessage.createdAt.getTime()) / (24 * 60 * 60 * 1000)) : 0,
    averageMessagesPerDay: firstMessage ? 
      totalMessages / Math.max(1, (Date.now() - firstMessage.createdAt.getTime()) / (24 * 60 * 60 * 1000)) : 0
  };

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

  // ✅ CORREGIDO: Validaciones de input
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
      severity: 'MEDIUM' // Default severity
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

// ✅ CORREGIDO: Función helper para verificar límites de cliente CON VALIDACIONES
const checkClientMessageLimits = async (user) => {
  if (user.userType !== 'CLIENT') {
    return { canSend: true };
  }

  // ✅ CORREGIDO: Verificación de que client existe
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
  let dailyLimit = client.dailyMessageLimit || 10; // Default para BASIC
  
  // VIP tiene mensajes ilimitados
  if (client.premiumTier === 'VIP') {
    dailyLimit = Infinity;
  }

  // ✅ CORREGIDO: Verificación más robusta del límite
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

// ✅ CORREGIDO: Función helper para extraer public_id de URL de Cloudinary MEJORADA
const extractPublicIdFromUrl = (cloudinaryUrl) => {
  try {
    if (!cloudinaryUrl || typeof cloudinaryUrl !== 'string' || !cloudinaryUrl.includes('cloudinary')) {
      return null;
    }
    
    // Extraer public_id de la URL de Cloudinary
    // Formato típico: https://res.cloudinary.com/[cloud]/[resource_type]/upload/v[version]/[public_id].[format]
    const matches = cloudinaryUrl.match(/\/v\d+\/([^/.]+)(?:\.[^/]*)?$/);
    if (matches && matches[1]) {
      return matches[1];
    }

    // Formato alternativo sin versión
    const altMatches = cloudinaryUrl.match(/\/upload\/([^/.]+)(?:\.[^/]*)?$/);
    if (altMatches && altMatches[1]) {
      return altMatches[1];
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
  reportMessage
};