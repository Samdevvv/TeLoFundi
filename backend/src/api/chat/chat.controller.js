/**
 * Controladores para la API de chat
 */
const { prisma } = require('../../config/prisma');
const chatService = require('../../services/chatService');
const logger = require('../../utils/logger');
const socket = require('../../socket');

/**
 * Obtiene conversaciones del usuario actual
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, search = '' } = req.query;
    
    const conversations = await chatService.getUserConversations(
      userId,
      req.user.role,
      parseInt(page),
      parseInt(limit),
      search
    );
    
    return res.status(200).json({
      success: true,
      ...conversations
    });
  } catch (error) {
    logger.error(`Error al obtener conversaciones: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener conversaciones',
      error: error.message
    });
  }
};

/**
 * Obtiene una conversación específica con sus mensajes
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const getConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Verificar que la conversación existe y el usuario es parte de ella
    const conversation = await chatService.getConversationWithMessages(id, userId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: conversation
    });
  } catch (error) {
    logger.error(`Error al obtener conversación: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener conversación',
      error: error.message
    });
  }
};

/**
 * Inicia una nueva conversación
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const startConversation = async (req, res) => {
  try {
    const { profileId, initialMessage } = req.body;
    const userId = req.user.id;
    
    // Verificar que el usuario es un cliente
    if (req.user.role !== 'cliente') {
      return res.status(403).json({
        success: false,
        message: 'Solo los clientes pueden iniciar conversaciones'
      });
    }
    
    // Verificar que el perfil existe
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { id: true, isActive: true, hidden: true }
    });
    
    if (!profile || !profile.isActive || profile.hidden) {
      return res.status(404).json({
        success: false,
        message: 'Perfil no encontrado o no disponible'
      });
    }
    
    // Intentar iniciar la conversación
    const result = await chatService.startConversation(userId, profileId, initialMessage);
    
    // Notificar al perfil por socket
    if (result.success) {
      const io = socket.getIO();
      io.to(`user:${profileId}`).emit('chat:new_conversation', {
        conversationId: result.conversation.id,
        client: result.client
      });
    }
    
    return res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    logger.error(`Error al iniciar conversación: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al iniciar conversación',
      error: error.message
    });
  }
};

/**
 * Envía un mensaje a una conversación existente
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const sendMessage = async (req, res) => {
  try {
    const { conversationId, content, contentType = 'text', attachments } = req.body;
    const senderId = req.user.id;
    
    // Validar datos básicos
    if (!conversationId || !content) {
      return res.status(400).json({
        success: false,
        message: 'ID de conversación y contenido requeridos'
      });
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
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada'
      });
    }
    
    // Verificar que el usuario es parte de la conversación
    if (conversation.clientId !== senderId && conversation.profileId !== senderId) {
      return res.status(403).json({
        success: false,
        message: 'No autorizado para enviar mensajes en esta conversación'
      });
    }
    
    // Determinar el recipient
    const recipientId = senderId === conversation.clientId ? conversation.profileId : conversation.clientId;
    
    // Crear el mensaje
    const message = await chatService.sendMessage({
      conversationId,
      senderId,
      recipientId,
      content,
      contentType,
      attachments
    });
    
    // Notificar por socket si está disponible
    try {
      const io = socket.getIO();
      io.to(`user:${recipientId}`).emit('chat:message_received', message);
      io.to(`conversation:${conversationId}`).emit('chat:conversation_updated', {
        id: conversationId,
        lastMessage: content,
        updatedAt: message.createdAt
      });
    } catch (error) {
      logger.warn(`Socket no disponible para notificaciones: ${error.message}`);
    }
    
    return res.status(201).json({
      success: true,
      message: 'Mensaje enviado correctamente',
      data: message
    });
  } catch (error) {
    logger.error(`Error al enviar mensaje: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al enviar mensaje',
      error: error.message
    });
  }
};

/**
 * Marca una conversación como leída
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const markConversationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Verificar que la conversación existe y el usuario es parte de ella
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { id: true, clientId: true, profileId: true }
    });
    
    if (!conversation || (conversation.clientId !== userId && conversation.profileId !== userId)) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada o no autorizado'
      });
    }
    
    // Determinar si es cliente o perfil para actualizar contadores
    const userType = conversation.clientId === userId ? 'client' : 'profile';
    
    // Marcar todos los mensajes no leídos como leídos
    await chatService.markConversationAsRead(id, userId);
    
    // Actualizar contadores en la conversación
    const data = {};
    if (userType === 'client') {
      data.unreadClient = 0;
    } else {
      data.unreadProfile = 0;
    }
    
    await prisma.conversation.update({
      where: { id },
      data
    });
    
    return res.status(200).json({
      success: true,
      message: 'Conversación marcada como leída'
    });
  } catch (error) {
    logger.error(`Error al marcar conversación como leída: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al marcar conversación como leída',
      error: error.message
    });
  }
};

/**
 * Actualiza el estado de disponibilidad para chat
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const updateChatStatus = async (req, res) => {
  try {
    const { availabilityStatus } = req.body;
    const userId = req.user.id;
    
    // Solo aplicable a perfiles
    if (req.user.role !== 'perfil') {
      return res.status(403).json({
        success: false,
        message: 'Operación solo permitida para perfiles'
      });
    }
    
    // Validar estado
    const validStatus = ['disponible', 'ocupado', 'no_disponible', 'vacaciones'];
    if (!validStatus.includes(availabilityStatus)) {
      return res.status(400).json({
        success: false,
        message: `Estado inválido. Debe ser uno de: ${validStatus.join(', ')}`
      });
    }
    
    // Actualizar perfil
    await prisma.profile.update({
      where: { id: userId },
      data: { availabilityStatus }
    });
    
    // Notificar por socket si está disponible
    try {
      const io = socket.getIO();
      
      // Obtener conversaciones para notificar a clientes
      const conversations = await prisma.conversation.findMany({
        where: { profileId: userId },
        select: { clientId: true }
      });
      
      const clientIds = [...new Set(conversations.map(c => c.clientId))];
      
      for (const clientId of clientIds) {
        io.to(`user:${clientId}`).emit('chat:profile_status_changed', {
          profileId: userId,
          status: availabilityStatus
        });
      }
    } catch (error) {
      logger.warn(`Socket no disponible para notificaciones: ${error.message}`);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Estado de disponibilidad actualizado correctamente'
    });
  } catch (error) {
    logger.error(`Error al actualizar estado de chat: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar estado de disponibilidad',
      error: error.message
    });
  }
};

/**
 * Obtiene mensajes de una conversación con paginación
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.id;
    
    // Verificar que la conversación existe y el usuario es parte de ella
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, clientId: true, profileId: true }
    });
    
    if (!conversation || (conversation.clientId !== userId && conversation.profileId !== userId)) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada o no autorizado'
      });
    }
    
    // Obtener mensajes paginados
    const messages = await chatService.getConversationMessages(
      conversationId,
      parseInt(page),
      parseInt(limit)
    );
    
    return res.status(200).json({
      success: true,
      ...messages
    });
  } catch (error) {
    logger.error(`Error al obtener mensajes: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener mensajes',
      error: error.message
    });
  }
};

/**
 * Archiva una conversación
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const archiveConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Verificar que la conversación existe y el usuario es parte de ella
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { id: true, clientId: true, profileId: true }
    });
    
    if (!conversation || (conversation.clientId !== userId && conversation.profileId !== userId)) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada o no autorizado'
      });
    }
    
    // Archivar conversación
    await prisma.conversation.update({
      where: { id },
      data: { isArchived: true }
    });
    
    return res.status(200).json({
      success: true,
      message: 'Conversación archivada correctamente'
    });
  } catch (error) {
    logger.error(`Error al archivar conversación: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al archivar conversación',
      error: error.message
    });
  }
};

/**
 * Bloquea una conversación y al usuario asociado
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const blockConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;
    
    // Verificar que la conversación existe y el usuario es parte de ella
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { id: true, clientId: true, profileId: true }
    });
    
    if (!conversation || (conversation.clientId !== userId && conversation.profileId !== userId)) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada o no autorizado'
      });
    }
    
    // Determinar qué usuario está bloqueando y a quién
    const isClient = conversation.clientId === userId;
    const blockedUserId = isClient ? conversation.profileId : conversation.clientId;
    
    // Bloquear conversación
    await prisma.conversation.update({
      where: { id },
      data: { 
        isBlocked: true,
        blockedBy: userId
      }
    });
    
    // Si es cliente, actualizar lista de perfiles bloqueados
    if (isClient) {
      await chatService.blockProfileForClient(userId, blockedUserId, reason);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Usuario bloqueado correctamente'
    });
  } catch (error) {
    logger.error(`Error al bloquear conversación: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al bloquear usuario',
      error: error.message
    });
  }
};

/**
 * Obtiene estadísticas de chat
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const getChatStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const stats = await chatService.getUserChatStats(userId, req.user.role);
    
    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error(`Error al obtener estadísticas de chat: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};

module.exports = {
  getConversations,
  getConversation,
  startConversation,
  sendMessage,
  markConversationAsRead,
  updateChatStatus,
  getMessages,
  archiveConversation,
  blockConversation,
  getChatStats
};