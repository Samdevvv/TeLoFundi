const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const { authenticateSocket } = require('./socketAuth');

// Usuarios conectados en memoria
const connectedUsers = new Map();
const userSockets = new Map(); // userId -> Set of socketIds

// Configurar eventos de chat
const setupChatSocket = (io) => {
  // Middleware de autenticación
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    const userType = socket.user.userType;
    
    logger.info('User connected to chat', {
      userId,
      userType,
      socketId: socket.id
    });

    // Agregar usuario a la lista de conectados
    connectedUsers.set(socket.id, {
      userId,
      userType,
      connectedAt: new Date(),
      lastSeen: new Date()
    });

    // Mapear usuario a sockets (un usuario puede tener múltiples conexiones)
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // Actualizar estado online del usuario
    updateUserOnlineStatus(userId, true);

    // Unirse a sala personal
    socket.join(`user_${userId}`);

    // Obtener chats del usuario y unirse a sus salas
    joinUserChats(socket, userId);

    // Eventos del chat
    setupChatEvents(socket, io);

    // Eventos de typing
    setupTypingEvents(socket, io);

    // Eventos de presencia
    setupPresenceEvents(socket, io);

    // Manejar desconexión
    socket.on('disconnect', () => {
      handleDisconnect(socket, userId);
    });
  });
};

// Unirse a los chats del usuario
const joinUserChats = async (socket, userId) => {
  try {
    const userChats = await prisma.chatMember.findMany({
      where: { userId },
      include: {
        chat: {
          select: { id: true, isGroup: true }
        }
      }
    });

    for (const membership of userChats) {
      socket.join(`chat_${membership.chat.id}`);
    }

    logger.debug('User joined chat rooms', {
      userId,
      chatsJoined: userChats.length
    });
  } catch (error) {
    logger.error('Error joining user chats:', error);
  }
};

// Configurar eventos principales del chat
const setupChatEvents = (socket, io) => {
  const userId = socket.user.id;
  const userType = socket.user.userType;

  // Enviar mensaje
  socket.on('send_message', async (data) => {
    try {
      await handleSendMessage(socket, io, data);
    } catch (error) {
      logger.error('Error handling send_message:', error);
      socket.emit('error', { message: 'Error enviando mensaje' });
    }
  });

  // Marcar mensaje como leído
  socket.on('mark_read', async (data) => {
    try {
      await handleMarkRead(socket, io, data);
    } catch (error) {
      logger.error('Error handling mark_read:', error);
    }
  });

  // Obtener historial de chat
  socket.on('get_chat_history', async (data) => {
    try {
      await handleGetChatHistory(socket, data);
    } catch (error) {
      logger.error('Error handling get_chat_history:', error);
      socket.emit('error', { message: 'Error obteniendo historial' });
    }
  });

  // Crear nuevo chat
  socket.on('create_chat', async (data) => {
    try {
      await handleCreateChat(socket, io, data);
    } catch (error) {
      logger.error('Error handling create_chat:', error);
      socket.emit('error', { message: 'Error creando chat' });
    }
  });

  // Obtener lista de chats
  socket.on('get_chats', async () => {
    try {
      await handleGetChats(socket);
    } catch (error) {
      logger.error('Error handling get_chats:', error);
      socket.emit('error', { message: 'Error obteniendo chats' });
    }
  });

  // Buscar usuarios para chat
  socket.on('search_users', async (data) => {
    try {
      await handleSearchUsers(socket, data);
    } catch (error) {
      logger.error('Error handling search_users:', error);
      socket.emit('error', { message: 'Error buscando usuarios' });
    }
  });
};

// Configurar eventos de typing
const setupTypingEvents = (socket, io) => {
  const userId = socket.user.id;

  // Usuario está escribiendo
  socket.on('typing_start', (data) => {
    const { chatId } = data;
    socket.to(`chat_${chatId}`).emit('user_typing', {
      userId,
      chatId,
      isTyping: true
    });
  });

  // Usuario dejó de escribir
  socket.on('typing_stop', (data) => {
    const { chatId } = data;
    socket.to(`chat_${chatId}`).emit('user_typing', {
      userId,
      chatId,
      isTyping: false
    });
  });
};

// Configurar eventos de presencia
const setupPresenceEvents = (socket, io) => {
  const userId = socket.user.id;

  // Obtener usuarios online
  socket.on('get_online_users', () => {
    const onlineUsers = getOnlineUsers();
    socket.emit('online_users', onlineUsers);
  });

  // Actualizar última vez visto
  socket.on('update_last_seen', () => {
    updateLastSeen(userId);
  });
};

// Manejar envío de mensajes
const handleSendMessage = async (socket, io, data) => {
  const senderId = socket.user.id;
  const senderType = socket.user.userType;
  const { chatId, receiverId, content, messageType = 'TEXT', fileUrl, fileName } = data;

  // Validaciones
  if (!content && !fileUrl) {
    socket.emit('error', { message: 'Mensaje vacío' });
    return;
  }

  if (content && content.length > 5000) {
    socket.emit('error', { message: 'Mensaje muy largo' });
    return;
  }

  let chat;
  let isNewChat = false;

  // Si no hay chatId, crear chat directo
  if (!chatId && receiverId) {
    chat = await findOrCreateDirectChat(senderId, receiverId);
    isNewChat = !chat.existed;
  } else if (chatId) {
    // Verificar que el usuario pertenece al chat
    chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        members: {
          some: { userId: senderId }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                userType: true,
                client: {
                  select: {
                    dailyMessageLimit: true,
                    messagesUsedToday: true,
                    isPremium: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!chat) {
      socket.emit('error', { message: 'Chat no encontrado o sin permisos' });
      return;
    }
  } else {
    socket.emit('error', { message: 'Chat o receptor requerido' });
    return;
  }

  // Verificar límites de mensajes para clientes
  if (senderType === 'CLIENT') {
    const clientData = socket.user.client;
    if (!clientData.isPremium && clientData.messagesUsedToday >= clientData.dailyMessageLimit) {
      socket.emit('error', { 
        message: 'Límite diario de mensajes alcanzado',
        code: 'DAILY_LIMIT_REACHED'
      });
      return;
    }
  }

  // Determinar receptor (para chats directos)
  let receiverMember = null;
  if (!chat.isGroup) {
    receiverMember = chat.members.find(m => m.userId !== senderId);
  }

  // Verificar costos de puntos (para clientes premium enviando a escorts)
  let pointsCost = 0;
  if (senderType === 'CLIENT' && receiverMember) {
    const receiverUser = receiverMember.user;
    if (receiverUser.userType === 'ESCORT') {
      // Los clientes básicos pagan por mensaje a escorts
      if (!socket.user.client.isPremium) {
        pointsCost = 1; // 1 punto por mensaje
        
        if (socket.user.client.points < pointsCost) {
          socket.emit('error', { 
            message: 'Puntos insuficientes',
            code: 'INSUFFICIENT_POINTS'
          });
          return;
        }
      }
    }
  }

  try {
    // Crear mensaje
    const message = await prisma.message.create({
      data: {
        content,
        messageType,
        fileUrl,
        fileName,
        senderId,
        receiverId: receiverMember?.userId || null,
        chatId: chat.id,
        costPoints: pointsCost,
        isPremiumMessage: pointsCost > 0
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            userType: true
          }
        }
      }
    });

    // Descontar puntos si aplica
    if (pointsCost > 0) {
      await prisma.client.update({
        where: { userId: senderId },
        data: {
          points: { decrement: pointsCost },
          totalPointsSpent: { increment: pointsCost }
        }
      });

      // Crear transacción de puntos
      await prisma.pointTransaction.create({
        data: {
          clientId: socket.user.client.id,
          amount: -pointsCost,
          type: 'CHAT_MESSAGE',
          description: `Mensaje a ${receiverMember?.user.userType || 'usuario'}`,
          messageId: message.id,
          balanceBefore: socket.user.client.points,
          balanceAfter: socket.user.client.points - pointsCost
        }
      });
    }

    // Incrementar contador de mensajes diarios para clientes
    if (senderType === 'CLIENT') {
      await prisma.client.update({
        where: { userId: senderId },
        data: {
          messagesUsedToday: { increment: 1 },
          totalMessagesUsed: { increment: 1 }
        }
      });
    }

    // Actualizar último mensaje del chat
    await prisma.chat.update({
      where: { id: chat.id },
      data: { lastActivity: new Date() }
    });

    // Si es un chat nuevo, hacer que ambos usuarios se unan a la sala
    if (isNewChat) {
      socket.join(`chat_${chat.id}`);
      if (receiverMember) {
        const receiverSockets = userSockets.get(receiverMember.userId);
        if (receiverSockets) {
          receiverSockets.forEach(socketId => {
            const receiverSocket = io.sockets.sockets.get(socketId);
            if (receiverSocket) {
              receiverSocket.join(`chat_${chat.id}`);
            }
          });
        }
      }
    }

    // Emitir mensaje a todos los miembros del chat
    io.to(`chat_${chat.id}`).emit('new_message', {
      id: message.id,
      chatId: chat.id,
      content: message.content,
      messageType: message.messageType,
      fileUrl: message.fileUrl,
      fileName: message.fileName,
      senderId: message.senderId,
      sender: message.sender,
      costPoints: message.costPoints,
      isPremiumMessage: message.isPremiumMessage,
      createdAt: message.createdAt,
      isRead: false
    });

    // Enviar notificación push si el receptor no está online
    if (receiverMember && !isUserOnline(receiverMember.userId)) {
      await createMessageNotification(message, receiverMember.userId);
    }

    // Confirmar envío al remitente
    socket.emit('message_sent', {
      id: message.id,
      chatId: chat.id,
      tempId: data.tempId, // ID temporal del frontend
      pointsUsed: pointsCost,
      success: true
    });

    logger.info('Message sent successfully', {
      messageId: message.id,
      chatId: chat.id,
      senderId,
      receiverId: receiverMember?.userId,
      messageType,
      pointsCost,
      isNewChat
    });

  } catch (error) {
    logger.error('Error sending message:', error);
    socket.emit('error', { message: 'Error enviando mensaje' });
  }
};

// Manejar marcar como leído
const handleMarkRead = async (socket, io, data) => {
  const userId = socket.user.id;
  const { messageId, chatId } = data;

  try {
    if (messageId) {
      // Marcar mensaje específico como leído
      await prisma.message.update({
        where: {
          id: messageId,
          receiverId: userId
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });
    } else if (chatId) {
      // Marcar todos los mensajes del chat como leídos
      await prisma.message.updateMany({
        where: {
          chatId,
          receiverId: userId,
          isRead: false
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });

      // Actualizar lastRead del miembro
      await prisma.chatMember.updateMany({
        where: {
          chatId,
          userId
        },
        data: {
          lastRead: new Date()
        }
      });
    }

    // Notificar a otros usuarios del chat
    socket.to(`chat_${chatId}`).emit('messages_read', {
      userId,
      chatId,
      messageId: messageId || null,
      readAt: new Date()
    });

  } catch (error) {
    logger.error('Error marking messages as read:', error);
  }
};

// Obtener historial de chat
const handleGetChatHistory = async (socket, data) => {
  const userId = socket.user.id;
  const { chatId, page = 1, limit = 50 } = data;
  const offset = (page - 1) * limit;

  try {
    // Verificar que el usuario pertenece al chat
    const chatMember = await prisma.chatMember.findFirst({
      where: {
        chatId,
        userId
      }
    });

    if (!chatMember) {
      socket.emit('error', { message: 'No tienes acceso a este chat' });
      return;
    }

    // Obtener mensajes
    const messages = await prisma.message.findMany({
      where: { chatId },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            userType: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    });

    // Obtener información del chat
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                userType: true
              }
            }
          }
        }
      }
    });

    socket.emit('chat_history', {
      chatId,
      chat: {
        id: chat.id,
        isGroup: chat.isGroup,
        name: chat.name,
        members: chat.members.map(m => m.user)
      },
      messages: messages.reverse(),
      pagination: {
        page,
        limit,
        hasMore: messages.length === limit
      }
    });

  } catch (error) {
    logger.error('Error getting chat history:', error);
    socket.emit('error', { message: 'Error obteniendo historial' });
  }
};

// Crear nuevo chat
const handleCreateChat = async (socket, io, data) => {
  const userId = socket.user.id;
  const { receiverId, isGroup = false, name, memberIds = [] } = data;

  try {
    let chatData = {
      isGroup,
      name: isGroup ? name : null,
      members: {
        create: [
          { userId, role: 'ADMIN' }
        ]
      }
    };

    // Para chat directo
    if (!isGroup && receiverId) {
      // Verificar que no existe chat directo
      const existingChat = await findDirectChat(userId, receiverId);
      if (existingChat) {
        socket.emit('chat_created', {
          chat: existingChat,
          isExisting: true
        });
        return;
      }

      chatData.members.create.push({ userId: receiverId, role: 'MEMBER' });
    }

    // Para chat grupal
    if (isGroup && memberIds.length > 0) {
      memberIds.forEach(memberId => {
        if (memberId !== userId) {
          chatData.members.create.push({ userId: memberId, role: 'MEMBER' });
        }
      });
    }

    const chat = await prisma.chat.create({
      data: chatData,
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                userType: true
              }
            }
          }
        }
      }
    });

    // Hacer que todos los miembros se unan a la sala
    chat.members.forEach(member => {
      const memberSockets = userSockets.get(member.userId);
      if (memberSockets) {
        memberSockets.forEach(socketId => {
          const memberSocket = io.sockets.sockets.get(socketId);
          if (memberSocket) {
            memberSocket.join(`chat_${chat.id}`);
          }
        });
      }
    });

    // Notificar a todos los miembros
    io.to(`chat_${chat.id}`).emit('chat_created', {
      chat: {
        id: chat.id,
        isGroup: chat.isGroup,
        name: chat.name,
        members: chat.members.map(m => m.user),
        createdAt: chat.createdAt
      },
      isExisting: false
    });

    logger.info('Chat created successfully', {
      chatId: chat.id,
      createdBy: userId,
      isGroup,
      memberCount: chat.members.length
    });

  } catch (error) {
    logger.error('Error creating chat:', error);
    socket.emit('error', { message: 'Error creando chat' });
  }
};

// Obtener lista de chats del usuario
const handleGetChats = async (socket) => {
  const userId = socket.user.id;

  try {
    const chatMemberships = await prisma.chatMember.findMany({
      where: { userId },
      include: {
        chat: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    avatar: true,
                    userType: true
                  }
                }
              }
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                sender: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        chat: {
          lastActivity: 'desc'
        }
      }
    });

    const chats = chatMemberships.map(membership => {
      const chat = membership.chat;
      const lastMessage = chat.messages[0] || null;
      
      // Para chats directos, usar el nombre del otro usuario
      let chatName = chat.name;
      let chatAvatar = null;
      
      if (!chat.isGroup) {
        const otherMember = chat.members.find(m => m.userId !== userId);
        if (otherMember) {
          chatName = `${otherMember.user.firstName} ${otherMember.user.lastName}`;
          chatAvatar = otherMember.user.avatar;
        }
      }

      // Contar mensajes no leídos
      const unreadCount = chat.messages.filter(m => 
        m.receiverId === userId && !m.isRead
      ).length;

      return {
        id: chat.id,
        name: chatName,
        avatar: chatAvatar,
        isGroup: chat.isGroup,
        members: chat.members.map(m => m.user),
        lastMessage: lastMessage ? {
          id: lastMessage.id,
          content: lastMessage.content,
          messageType: lastMessage.messageType,
          senderName: `${lastMessage.sender.firstName} ${lastMessage.sender.lastName}`,
          createdAt: lastMessage.createdAt
        } : null,
        unreadCount,
        lastActivity: chat.lastActivity,
        lastRead: membership.lastRead
      };
    });

    socket.emit('chats_list', { chats });

  } catch (error) {
    logger.error('Error getting chats list:', error);
    socket.emit('error', { message: 'Error obteniendo chats' });
  }
};

// Buscar usuarios para chat
const handleSearchUsers = async (socket, data) => {
  const userId = socket.user.id;
  const userType = socket.user.userType;
  const { query, userTypes = [], limit = 20 } = data;

  try {
    // Construir filtros de búsqueda
    const whereClause = {
      id: { not: userId },
      isActive: true,
      isBanned: false,
      OR: [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { username: { contains: query, mode: 'insensitive' } }
      ]
    };

    if (userTypes.length > 0) {
      whereClause.userType = { in: userTypes };
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        avatar: true,
        userType: true,
        lastActiveAt: true,
        escort: {
          select: {
            isVerified: true,
            rating: true
          }
        },
        agency: {
          select: {
            isVerified: true
          }
        }
      },
      orderBy: [
        { lastActiveAt: 'desc' },
        { firstName: 'asc' }
      ],
      take: limit
    });

    // Formatear resultados
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      username: user.username,
      avatar: user.avatar,
      userType: user.userType,
      isVerified: user.escort?.isVerified || user.agency?.isVerified || false,
      rating: user.escort?.rating || null,
      isOnline: isUserOnline(user.id),
      lastActiveAt: user.lastActiveAt
    }));

    socket.emit('users_search_results', {
      query,
      users: formattedUsers,
      total: formattedUsers.length
    });

  } catch (error) {
    logger.error('Error searching users:', error);
    socket.emit('error', { message: 'Error buscando usuarios' });
  }
};

// Funciones auxiliares

// Encontrar o crear chat directo
const findOrCreateDirectChat = async (userId1, userId2) => {
  // Buscar chat existente
  const existingChat = await findDirectChat(userId1, userId2);
  if (existingChat) {
    return { ...existingChat, existed: true };
  }

  // Crear nuevo chat directo
  const newChat = await prisma.chat.create({
    data: {
      isGroup: false,
      members: {
        create: [
          { userId: userId1, role: 'MEMBER' },
          { userId: userId2, role: 'MEMBER' }
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
              avatar: true,
              userType: true
            }
          }
        }
      }
    }
  });

  return { ...newChat, existed: false };
};

// Encontrar chat directo existente
const findDirectChat = async (userId1, userId2) => {
  const chat = await prisma.chat.findFirst({
    where: {
      isGroup: false,
      members: {
        every: {
          userId: { in: [userId1, userId2] }
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
              avatar: true,
              userType: true
            }
          }
        }
      }
    }
  });

  return chat;
};

// Actualizar estado online del usuario
const updateUserOnlineStatus = async (userId, isOnline) => {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastActiveAt: new Date(),
        ...(isOnline && { lastLogin: new Date() })
      }
    });
  } catch (error) {
    logger.error('Error updating user online status:', error);
  }
};

// Actualizar última vez visto
const updateLastSeen = async (userId) => {
  try {
    connectedUsers.forEach((user, socketId) => {
      if (user.userId === userId) {
        user.lastSeen = new Date();
      }
    });

    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() }
    });
  } catch (error) {
    logger.error('Error updating last seen:', error);
  }
};

// Verificar si usuario está online
const isUserOnline = (userId) => {
  return userSockets.has(userId) && userSockets.get(userId).size > 0;
};

// Obtener usuarios online
const getOnlineUsers = () => {
  const online = new Set();
  connectedUsers.forEach(user => online.add(user.userId));
  return Array.from(online);
};

// Crear notificación de mensaje
const createMessageNotification = async (message, receiverId) => {
  try {
    await prisma.notification.create({
      data: {
        userId: receiverId,
        type: 'MESSAGE',
        title: 'Nuevo mensaje',
        message: `${message.sender.firstName} te ha enviado un mensaje`,
        data: {
          messageId: message.id,
          chatId: message.chatId,
          senderId: message.senderId,
          senderName: `${message.sender.firstName} ${message.sender.lastName}`,
          preview: message.content?.substring(0, 100) || 'Archivo adjunto'
        }
      }
    });
  } catch (error) {
    logger.error('Error creating message notification:', error);
  }
};

// Manejar desconexión
const handleDisconnect = (socket, userId) => {
  logger.info('User disconnected from chat', {
    userId,
    socketId: socket.id
  });

  // Remover de usuarios conectados
  connectedUsers.delete(socket.id);

  // Remover de mapeo de usuario a sockets
  if (userSockets.has(userId)) {
    userSockets.get(userId).delete(socket.id);
    
    // Si no tiene más conexiones, remover completamente
    if (userSockets.get(userId).size === 0) {
      userSockets.delete(userId);
      
      // Actualizar estado offline
      updateUserOnlineStatus(userId, false);
    }
  }
};

// Obtener estadísticas de chat
const getChatStats = () => {
  return {
    connectedUsers: connectedUsers.size,
    uniqueUsers: userSockets.size,
    totalSockets: connectedUsers.size,
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  setupChatSocket,
  getChatStats,
  getOnlineUsers,
  isUserOnline
};