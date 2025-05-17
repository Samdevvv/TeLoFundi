/**
 * Manejador de chats para Socket.IO
 */
const { prisma } = require('../config/prisma');
const logger = require('../utils/logger');
const chatService = require('../services/chatService');

/**
 * Registra los listeners de chat para un socket
 * @param {object} io - Instancia de Socket.IO
 * @param {object} socket - Socket del cliente
 */
const register = (io, socket) => {
  // Unirse a las salas de conversaciones del usuario
  joinUserConversations(socket);
  
  // Enviar mensaje
  socket.on('chat:send_message', async (data) => {
    try {
      const { conversationId, content, contentType = 'text', attachments } = data;
      const senderId = socket.user.id;
      
      // Validar datos básicos
      if (!conversationId || !content) {
        return socket.emit('error', { message: 'Datos incompletos' });
      }
      
      // Verificar que la conversación existe y el usuario es parte de ella
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          client: true,
          profile: true
        }
      });
      
      if (!conversation) {
        return socket.emit('error', { message: 'Conversación no encontrada' });
      }
      
      // Verificar que el usuario es parte de la conversación
      if (conversation.clientId !== senderId && conversation.profileId !== senderId) {
        return socket.emit('error', { message: 'No autorizado' });
      }
      
      // Determinar el recipient
      const recipientId = senderId === conversation.clientId ? conversation.profileId : conversation.clientId;
      
      // Crear el mensaje
      const message = await prisma.message.create({
        data: {
          conversationId,
          senderId,
          recipientId,
          content,
          contentType,
          attachments,
          status: 'enviado'
        },
        include: {
          sender: {
            select: {
              id: true,
              role: true,
              profileImageUrl: true,
              client: {
                select: {
                  username: true
                }
              },
              profile: {
                select: {
                  displayName: true
                }
              },
              agency: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      });
      
      // Actualizar la conversación
      await chatService.updateConversationLastMessage(conversationId, message);
      
      // Notificar al remitente (confirmación)
      socket.emit('chat:message_sent', message);
      
      // Notificar al destinatario
      io.to(`user:${recipientId}`).emit('chat:message_received', message);
      
      // Notificar actualización de conversación a ambas partes
      io.to(`conversation:${conversationId}`).emit('chat:conversation_updated', {
        id: conversationId,
        lastMessage: message.content,
        updatedAt: message.createdAt
      });
      
      // Si el destinatario está conectado, marcar como entregado
      const recipientSocketIds = io.sockets.adapter.rooms.get(`user:${recipientId}`);
      if (recipientSocketIds && recipientSocketIds.size > 0) {
        await chatService.markMessageAsDelivered(message.id);
        io.to(`user:${senderId}`).emit('chat:message_delivered', { messageId: message.id });
      }
      
    } catch (error) {
      logger.error(`Error al enviar mensaje: ${error.message}`);
      socket.emit('error', { message: 'Error al enviar mensaje' });
    }
  });
  
  // Marcar mensaje como leído
  socket.on('chat:read_message', async (data) => {
    try {
      const { messageId } = data;
      const userId = socket.user.id;
      
      if (!messageId) {
        return socket.emit('error', { message: 'ID de mensaje requerido' });
      }
      
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: {
          id: true,
          senderId: true,
          recipientId: true,
          conversationId: true,
          status: true
        }
      });
      
      // Verificar que el mensaje existe y es el destinatario
      if (!message || message.recipientId !== userId) {
        return socket.emit('error', { message: 'Mensaje no encontrado o no autorizado' });
      }
      
      // Solo actualizar si no está ya leído
      if (message.status !== 'leido') {
        await chatService.markMessageAsRead(messageId);
        
        // Notificar al remitente que su mensaje fue leído
        io.to(`user:${message.senderId}`).emit('chat:message_read', { messageId });
      }
      
    } catch (error) {
      logger.error(`Error al marcar mensaje como leído: ${error.message}`);
      socket.emit('error', { message: 'Error al procesar la solicitud' });
    }
  });
  
  // Marcar conversación como leída
  socket.on('chat:read_conversation', async (data) => {
    try {
      const { conversationId } = data;
      const userId = socket.user.id;
      
      if (!conversationId) {
        return socket.emit('error', { message: 'ID de conversación requerido' });
      }
      
      // Verificar que la conversación existe y el usuario es parte de ella
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          clientId: true,
          profileId: true
        }
      });
      
      if (!conversation || (conversation.clientId !== userId && conversation.profileId !== userId)) {
        return socket.emit('error', { message: 'Conversación no encontrada o no autorizado' });
      }
      
      // Determinar si es cliente o perfil para actualizar contadores
      const userType = conversation.clientId === userId ? 'client' : 'profile';
      
      // Marcar todos los mensajes no leídos como leídos
      await chatService.markConversationAsRead(conversationId, userId);
      
      // Actualizar contadores en la conversación
      const data = {};
      if (userType === 'client') {
        data.unreadClient = 0;
      } else {
        data.unreadProfile = 0;
      }
      
      await prisma.conversation.update({
        where: { id: conversationId },
        data
      });
      
      // Notificar al usuario que la conversación fue leída
      socket.emit('chat:conversation_read', { conversationId });
      
    } catch (error) {
      logger.error(`Error al marcar conversación como leída: ${error.message}`);
      socket.emit('error', { message: 'Error al procesar la solicitud' });
    }
  });
  
  // Escribiendo mensaje (typing)
  socket.on('chat:typing', (data) => {
    try {
      const { conversationId } = data;
      const userId = socket.user.id;
      
      if (!conversationId) {
        return;
      }
      
      // Transmitir evento de typing a todos en la conversación excepto al emisor
      socket.to(`conversation:${conversationId}`).emit('chat:user_typing', {
        conversationId,
        userId
      });
      
    } catch (error) {
      logger.error(`Error en evento typing: ${error.message}`);
    }
  });
  
  // Dejar de escribir
  socket.on('chat:stop_typing', (data) => {
    try {
      const { conversationId } = data;
      const userId = socket.user.id;
      
      if (!conversationId) {
        return;
      }
      
      // Transmitir evento a todos en la conversación excepto al emisor
      socket.to(`conversation:${conversationId}`).emit('chat:user_stop_typing', {
        conversationId,
        userId
      });
      
    } catch (error) {
      logger.error(`Error en evento stop typing: ${error.message}`);
    }
  });
  
  // Actualizar estado online para chats
  socket.on('chat:update_status', async (data) => {
    try {
      const { isAvailable, customStatus } = data;
      const userId = socket.user.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });
      
      // Solo aplicable a perfiles
      if (user && user.role === 'perfil') {
        const status = isAvailable ? 'disponible' : (customStatus || 'no_disponible');
        
        await prisma.profile.update({
          where: { id: userId },
          data: { availabilityStatus: status }
        });
        
        // Notificar a clientes que tienen conversación con este perfil
        const conversations = await prisma.conversation.findMany({
          where: { profileId: userId },
          select: { clientId: true }
        });
        
        const clientIds = conversations.map(c => c.clientId);
        
        for (const clientId of clientIds) {
          io.to(`user:${clientId}`).emit('chat:profile_status_changed', {
            profileId: userId,
            status
          });
        }
      }
      
    } catch (error) {
      logger.error(`Error al actualizar estado: ${error.message}`);
    }
  });
};

/**
 * Une al usuario a las salas de sus conversaciones
 * @param {object} socket - Socket del cliente
 */
const joinUserConversations = async (socket) => {
  try {
    const userId = socket.user.id;
    const role = socket.user.role;
    
    let conversations = [];
    
    // Obtener conversaciones según el rol
    if (role === 'cliente') {
      conversations = await prisma.conversation.findMany({
        where: { clientId: userId },
        select: { id: true }
      });
    } else if (role === 'perfil') {
      conversations = await prisma.conversation.findMany({
        where: { profileId: userId },
        select: { id: true }
      });
    } else if (role === 'admin') {
      // Para admin, obtener todas las conversaciones
      conversations = await prisma.conversation.findMany({
        select: { id: true }
      });
    }
    
    // Unir al socket a cada sala de conversación
    for (const conversation of conversations) {
      socket.join(`conversation:${conversation.id}`);
    }
    
    logger.info(`Usuario ${userId} unido a ${conversations.length} salas de conversación`);
    
  } catch (error) {
    logger.error(`Error al unir a salas de conversación: ${error.message}`);
  }
};

module.exports = {
  register
};