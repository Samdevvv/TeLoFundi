const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');

// Mapa para almacenar conexiones activas
const activeConnections = new Map();

// Configurar autenticación de Socket.IO
const setupSocketAuth = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        logger.warn('Socket connection attempt without token', {
          socketId: socket.id,
          ip: socket.handshake.address
        });
        return next(new Error('Authentication error'));
      }

      // Verificar token JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Buscar usuario en la base de datos
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          userType: true,
          isActive: true,
          isBanned: true
        }
      });

      if (!user || !user.isActive || user.isBanned) {
        logger.warn('Socket connection attempt with invalid user', {
          socketId: socket.id,
          userId: decoded.userId,
          userActive: user?.isActive,
          userBanned: user?.isBanned
        });
        return next(new Error('Authentication error'));
      }

      // Agregar información del usuario al socket
      socket.userId = user.id;
      socket.user = user;
      
      logger.info('Socket authenticated successfully', {
        socketId: socket.id,
        userId: user.id,
        userType: user.userType
      });

      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });
};

// Configurar eventos de chat
const setupChatSocket = (io) => {
  io.on('connection', (socket) => {
    const userId = socket.userId;
    const user = socket.user;

    logger.info('User connected via socket', {
      socketId: socket.id,
      userId,
      userType: user.userType
    });

    // Almacenar conexión activa
    activeConnections.set(userId, {
      socketId: socket.id,
      socket,
      user,
      connectedAt: new Date(),
      lastActivity: new Date()
    });

    // Unir al usuario a su sala personal
    socket.join(`user_${userId}`);

    // Actualizar estado de conexión del usuario
    updateUserOnlineStatus(userId, true);

    // Evento: Usuario se une a un chat específico
    socket.on('join_chat', async (data) => {
      try {
        const { chatId } = data;
        
        // Verificar que el usuario es miembro del chat
        const membership = await prisma.chatMember.findFirst({
          where: {
            userId,
            chatId,
            chat: {
              deletedAt: null
            }
          }
        });

        if (!membership) {
          socket.emit('error', { message: 'No tienes acceso a este chat' });
          return;
        }

        socket.join(`chat_${chatId}`);
        
        // Actualizar última actividad
        await prisma.chatMember.update({
          where: { id: membership.id },
          data: { lastRead: new Date() }
        });

        socket.emit('joined_chat', { chatId });
        
        logger.info('User joined chat', {
          userId,
          chatId,
          socketId: socket.id
        });

      } catch (error) {
        logger.error('Error joining chat:', error);
        socket.emit('error', { message: 'Error al unirse al chat' });
      }
    });

    // Evento: Usuario abandona un chat
    socket.on('leave_chat', (data) => {
      const { chatId } = data;
      socket.leave(`chat_${chatId}`);
      socket.emit('left_chat', { chatId });
      
      logger.info('User left chat', {
        userId,
        chatId,
        socketId: socket.id
      });
    });

    // Evento: Enviar mensaje
    socket.on('send_message', async (data) => {
      try {
        const { chatId, content, messageType = 'TEXT', replyToId } = data;

        // Verificar membership
        const membership = await prisma.chatMember.findFirst({
          where: {
            userId,
            chatId,
            chat: {
              deletedAt: null
            }
          }
        });

        if (!membership) {
          socket.emit('error', { message: 'No tienes acceso a este chat' });
          return;
        }

        // Verificar rate limit básico (30 mensajes por minuto)
        const oneMinuteAgo = new Date(Date.now() - 60000);
        const recentMessages = await prisma.message.count({
          where: {
            senderId: userId,
            chatId,
            createdAt: {
              gte: oneMinuteAgo
            }
          }
        });

        if (recentMessages >= 30) {
          socket.emit('error', { 
            message: 'Demasiados mensajes enviados, espera un momento',
            errorCode: 'RATE_LIMIT_EXCEEDED'
          });
          return;
        }

        // Crear el mensaje
        const message = await prisma.message.create({
          data: {
            content,
            messageType,
            senderId: userId,
            chatId,
            replyToId: replyToId || null
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
            replyTo: replyToId ? {
              select: {
                id: true,
                content: true,
                sender: {
                  select: {
                    username: true,
                    firstName: true
                  }
                }
              }
            } : false
          }
        });

        // Actualizar última actividad del chat
        await prisma.chat.update({
          where: { id: chatId },
          data: { lastActivity: new Date() }
        });

        // Emitir mensaje a todos los miembros del chat
        io.to(`chat_${chatId}`).emit('new_message', message);

        // Actualizar contador de mensajes del miembro
        await prisma.chatMember.update({
          where: { id: membership.id },
          data: { 
            messagesCount: {
              increment: 1
            }
          }
        });

        logger.info('Message sent', {
          messageId: message.id,
          senderId: userId,
          chatId,
          messageType
        });

      } catch (error) {
        logger.error('Error sending message:', error);
        socket.emit('error', { message: 'Error al enviar mensaje' });
      }
    });

    // Evento: Marcar mensajes como leídos
    socket.on('mark_read', async (data) => {
      try {
        const { chatId, messageId } = data;

        // Verificar membership
        const membership = await prisma.chatMember.findFirst({
          where: {
            userId,
            chatId
          }
        });

        if (!membership) {
          return;
        }

        // Actualizar último mensaje leído
        await prisma.chatMember.update({
          where: { id: membership.id },
          data: { lastRead: new Date() }
        });

        // Marcar mensaje específico como leído si se proporciona
        if (messageId) {
          await prisma.message.updateMany({
            where: {
              id: messageId,
              chatId,
              NOT: {
                senderId: userId // No marcar propios mensajes
              }
            },
            data: {
              isRead: true,
              readAt: new Date()
            }
          });
        }

        // Notificar al remitente que su mensaje fue leído
        socket.to(`chat_${chatId}`).emit('message_read', {
          chatId,
          messageId,
          readBy: userId
        });

      } catch (error) {
        logger.error('Error marking message as read:', error);
      }
    });

    // Evento: Usuario está escribiendo
    socket.on('typing', (data) => {
      const { chatId, isTyping } = data;
      socket.to(`chat_${chatId}`).emit('user_typing', {
        userId,
        username: user.username,
        isTyping
      });
    });

    // Evento: Solicitar lista de chats
    socket.on('get_chats', async () => {
      try {
        const chats = await prisma.chat.findMany({
          where: {
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
                    username: true,
                    firstName: true,
                    lastName: true,
                    avatar: true,
                    userType: true
                  }
                }
              }
            },
            messages: {
              take: 1,
              orderBy: {
                createdAt: 'desc'
              },
              include: {
                sender: {
                  select: {
                    username: true,
                    firstName: true
                  }
                }
              }
            },
            _count: {
              select: {
                messages: {
                  where: {
                    isRead: false,
                    NOT: {
                      senderId: userId
                    }
                  }
                }
              }
            }
          },
          orderBy: {
            lastActivity: 'desc'
          }
        });

        socket.emit('chats_list', chats);

      } catch (error) {
        logger.error('Error getting chats:', error);
        socket.emit('error', { message: 'Error obteniendo chats' });
      }
    });

    // Evento: Obtener mensajes de un chat
    socket.on('get_messages', async (data) => {
      try {
        const { chatId, page = 1, limit = 50 } = data;

        // Verificar membership
        const membership = await prisma.chatMember.findFirst({
          where: {
            userId,
            chatId
          }
        });

        if (!membership) {
          socket.emit('error', { message: 'No tienes acceso a este chat' });
          return;
        }

        const messages = await prisma.message.findMany({
          where: { chatId },
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
            replyTo: {
              select: {
                id: true,
                content: true,
                sender: {
                  select: {
                    username: true,
                    firstName: true
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: limit,
          skip: (page - 1) * limit
        });

        socket.emit('messages_list', {
          chatId,
          messages: messages.reverse(),
          page,
          hasMore: messages.length === limit
        });

      } catch (error) {
        logger.error('Error getting messages:', error);
        socket.emit('error', { message: 'Error obteniendo mensajes' });
      }
    });

    // Evento: Actualizar actividad del usuario
    socket.on('activity', () => {
      const connection = activeConnections.get(userId);
      if (connection) {
        connection.lastActivity = new Date();
      }
    });

    // Evento de desconexión
    socket.on('disconnect', (reason) => {
      logger.info('User disconnected', {
        socketId: socket.id,
        userId,
        reason
      });

      // Remover de conexiones activas
      activeConnections.delete(userId);

      // Actualizar estado offline del usuario
      updateUserOnlineStatus(userId, false);

      // Salir de todas las salas
      socket.leaveAll();
    });

    // Manejar errores de socket
    socket.on('error', (error) => {
      logger.error('Socket error:', {
        socketId: socket.id,
        userId,
        error: error.message
      });
    });
  });
};

// Función para actualizar estado online del usuario
const updateUserOnlineStatus = async (userId, isOnline) => {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastActiveAt: new Date(),
        ...(isOnline ? {} : { lastLogin: new Date() })
      }
    });
  } catch (error) {
    logger.error('Error updating user online status:', error);
  }
};

// Función para obtener usuarios conectados
const getConnectedUsers = () => {
  return Array.from(activeConnections.values()).map(conn => ({
    userId: conn.user.id,
    username: conn.user.username,
    userType: conn.user.userType,
    connectedAt: conn.connectedAt,
    lastActivity: conn.lastActivity
  }));
};

// Función para enviar notificación a un usuario específico
const sendNotificationToUser = (userId, notification) => {
  const connection = activeConnections.get(userId);
  if (connection) {
    connection.socket.emit('notification', notification);
    return true;
  }
  return false;
};

// Función para enviar mensaje a un chat específico
const sendMessageToChat = (chatId, event, data) => {
  // Esta función será usada por controllers para enviar mensajes
  const io = require('../app').get('io');
  if (io) {
    io.to(`chat_${chatId}`).emit(event, data);
  }
};

// Limpiar conexiones inactivas cada 5 minutos
setInterval(() => {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

  for (const [userId, connection] of activeConnections.entries()) {
    if (connection.lastActivity < fiveMinutesAgo) {
      logger.info('Removing inactive connection', {
        userId,
        lastActivity: connection.lastActivity
      });
      
      connection.socket.disconnect();
      activeConnections.delete(userId);
      updateUserOnlineStatus(userId, false);
    }
  }
}, 5 * 60 * 1000);

module.exports = {
  setupSocketAuth,
  setupChatSocket,
  getConnectedUsers,
  sendNotificationToUser,
  sendMessageToChat,
  activeConnections
};