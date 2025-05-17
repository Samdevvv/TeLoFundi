/**
 * Manejador de notificaciones para Socket.IO
 */
const { prisma } = require('../config/prisma');
const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');

/**
 * Registra los listeners de notificaciones para un socket
 * @param {object} io - Instancia de Socket.IO
 * @param {object} socket - Socket del cliente
 */
const register = (io, socket) => {
  // Marcar notificación como leída
  socket.on('notification:read', async (data) => {
    try {
      const { notificationId } = data;
      const userId = socket.user.id;
      
      if (!notificationId) {
        return socket.emit('error', { message: 'ID de notificación requerido' });
      }
      
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
        select: { id: true, userId: true, isRead: true }
      });
      
      // Verificar que la notificación existe y pertenece al usuario
      if (!notification || notification.userId !== userId) {
        return socket.emit('error', { message: 'Notificación no encontrada o no autorizada' });
      }
      
      // Solo actualizar si no está ya leída
      if (!notification.isRead) {
        await prisma.notification.update({
          where: { id: notificationId },
          data: {
            isRead: true,
            readAt: new Date()
          }
        });
        
        // Notificar al cliente que la notificación fue leída
        socket.emit('notification:marked_read', { notificationId });
      }
      
    } catch (error) {
      logger.error(`Error al marcar notificación como leída: ${error.message}`);
      socket.emit('error', { message: 'Error al procesar la solicitud' });
    }
  });
  
  // Marcar todas las notificaciones como leídas
  socket.on('notification:read_all', async () => {
    try {
      const userId = socket.user.id;
      
      // Actualizar todas las notificaciones no leídas
      const result = await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });
      
      // Notificar al cliente que todas las notificaciones fueron leídas
      socket.emit('notification:all_read', { count: result.count });
      
    } catch (error) {
      logger.error(`Error al marcar todas las notificaciones como leídas: ${error.message}`);
      socket.emit('error', { message: 'Error al procesar la solicitud' });
    }
  });
  
  // Suscribirse a tipos específicos de notificaciones
  socket.on('notification:subscribe', async (data) => {
    try {
      const { types = [] } = data;
      const userId = socket.user.id;
      
      // Almacenar preferencias de notificación
      if (types.length > 0) {
        await notificationService.updateNotificationPreferences(userId, types);
        socket.emit('notification:subscribed', { types });
      }
      
    } catch (error) {
      logger.error(`Error al suscribirse a notificaciones: ${error.message}`);
      socket.emit('error', { message: 'Error al procesar la solicitud' });
    }
  });
  
  // Desuscribirse de tipos específicos de notificaciones
  socket.on('notification:unsubscribe', async (data) => {
    try {
      const { types = [] } = data;
      const userId = socket.user.id;
      
      if (types.length > 0) {
        await notificationService.removeNotificationPreferences(userId, types);
        socket.emit('notification:unsubscribed', { types });
      }
      
    } catch (error) {
      logger.error(`Error al desuscribirse de notificaciones: ${error.message}`);
      socket.emit('error', { message: 'Error al procesar la solicitud' });
    }
  });
  
  // Obtener notificaciones no leídas al conectarse
  socket.on('notification:get_unread', async () => {
    try {
      const userId = socket.user.id;
      
      const unreadNotifications = await prisma.notification.findMany({
        where: {
          userId,
          isRead: false
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 50 // Limitar a las 50 más recientes
      });
      
      socket.emit('notification:unread_list', { notifications: unreadNotifications });
      
    } catch (error) {
      logger.error(`Error al obtener notificaciones no leídas: ${error.message}`);
      socket.emit('error', { message: 'Error al procesar la solicitud' });
    }
  });
  
  // Actualizar token de dispositivo para notificaciones push
  socket.on('notification:update_device_token', async (data) => {
    try {
      const { deviceToken, deviceType, deviceName, deviceModel, osVersion, appVersion } = data;
      const userId = socket.user.id;
      
      if (!deviceToken || !deviceType) {
        return socket.emit('error', { message: 'Token y tipo de dispositivo requeridos' });
      }
      
      // Verificar si ya existe el dispositivo
      const existingDevice = await prisma.userDevice.findFirst({
        where: {
          userId,
          deviceToken
        }
      });
      
      if (existingDevice) {
        // Actualizar dispositivo existente
        await prisma.userDevice.update({
          where: { id: existingDevice.id },
          data: {
            isActive: true,
            lastUsedAt: new Date(),
            deviceName,
            deviceModel,
            osVersion,
            appVersion
          }
        });
      } else {
        // Crear nuevo registro de dispositivo
        await prisma.userDevice.create({
          data: {
            userId,
            deviceToken,
            deviceType,
            deviceName,
            deviceModel,
            osVersion,
            appVersion
          }
        });
      }
      
      socket.emit('notification:device_registered', { success: true });
      
    } catch (error) {
      logger.error(`Error al actualizar token de dispositivo: ${error.message}`);
      socket.emit('error', { message: 'Error al registrar dispositivo' });
    }
  });
};

/**
 * Envía una notificación a través de Socket.IO
 * @param {object} io - Instancia de Socket.IO
 * @param {string} userId - ID del usuario destinatario
 * @param {string} type - Tipo de notificación
 * @param {object} data - Datos de la notificación
 */
const sendNotification = async (io, userId, type, data) => {
  try {
    // Crear notificación en la base de datos
    const notification = await notificationService.createNotification({
      userId,
      type,
      title: data.title,
      content: data.content,
      referenceId: data.referenceId,
      referenceType: data.referenceType,
      imageUrl: data.imageUrl,
      deepLink: data.deepLink
    });
    
    // Enviar notificación por socket
    io.to(`user:${userId}`).emit('notification:new', notification);
    
  } catch (error) {
    logger.error(`Error al enviar notificación: ${error.message}`);
  }
};

/**
 * Envía una notificación a múltiples usuarios
 * @param {object} io - Instancia de Socket.IO
 * @param {Array} userIds - IDs de usuarios destinatarios
 * @param {string} type - Tipo de notificación
 * @param {object} data - Datos de la notificación
 */
const sendMultipleNotifications = async (io, userIds, type, data) => {
  for (const userId of userIds) {
    await sendNotification(io, userId, type, data);
  }
};

module.exports = {
  register,
  sendNotification,
  sendMultipleNotifications
};