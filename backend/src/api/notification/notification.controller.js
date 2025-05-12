// src/api/notification/notification.controller.js
const notificationService = require('../../services/notificationService');
const logger = require('../../utils/logger');

/**
 * Controlador para gestión de notificaciones
 */
class NotificationController {
  /**
   * Obtiene las notificaciones del usuario
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async getUserNotifications(req, res) {
    try {
      const userId = req.user.id;
      const { page, limit, unreadOnly, type } = req.query;
      
      const notifications = await notificationService.getUserNotifications(userId, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        unreadOnly: unreadOnly === 'true',
        type
      });
      
      res.status(200).json({
        success: true,
        data: notifications
      });
    } catch (error) {
      logger.error(`Error al obtener notificaciones: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al obtener notificaciones',
        error: error.message
      });
    }
  }
  
  /**
   * Marca una notificación como leída
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async markAsRead(req, res) {
    try {
      const userId = req.user.id;
      const { notificationId } = req.params;
      
      if (!notificationId) {
        return res.status(400).json({
          success: false,
          message: 'ID de notificación requerido'
        });
      }
      
      const notification = await notificationService.markAsRead(notificationId, userId);
      
      res.status(200).json({
        success: true,
        message: 'Notificación marcada como leída',
        data: notification
      });
    } catch (error) {
      logger.error(`Error al marcar notificación: ${error.message}`, { error });
      res.status(error.message.includes('no encontrada') ? 404 : 500).json({
        success: false,
        message: 'Error al marcar notificación como leída',
        error: error.message
      });
    }
  }
  
  /**
   * Marca todas las notificaciones como leídas
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;
      
      const count = await notificationService.markAllAsRead(userId);
      
      res.status(200).json({
        success: true,
        message: `${count} notificaciones marcadas como leídas`,
        count
      });
    } catch (error) {
      logger.error(`Error al marcar notificaciones: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al marcar notificaciones como leídas',
        error: error.message
      });
    }
  }
  
  /**
   * Elimina una notificación
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async deleteNotification(req, res) {
    try {
      const userId = req.user.id;
      const { notificationId } = req.params;
      
      if (!notificationId) {
        return res.status(400).json({
          success: false,
          message: 'ID de notificación requerido'
        });
      }
      
      await notificationService.deleteNotification(notificationId, userId);
      
      res.status(200).json({
        success: true,
        message: 'Notificación eliminada con éxito'
      });
    } catch (error) {
      logger.error(`Error al eliminar notificación: ${error.message}`, { error });
      res.status(error.message.includes('no encontrada') ? 404 : 500).json({
        success: false,
        message: 'Error al eliminar notificación',
        error: error.message
      });
    }
  }
  
  /**
   * Registra un dispositivo para notificaciones push
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async registerDevice(req, res) {
    try {
      const userId = req.user.id;
      const deviceInfo = req.body;
      
      if (!deviceInfo.deviceToken || !deviceInfo.deviceType) {
        return res.status(400).json({
          success: false,
          message: 'Token de dispositivo y tipo son requeridos'
        });
      }
      
      const device = await notificationService.registerDevice(userId, deviceInfo);
      
      res.status(200).json({
        success: true,
        message: 'Dispositivo registrado con éxito',
        data: device
      });
    } catch (error) {
      logger.error(`Error al registrar dispositivo: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al registrar dispositivo',
        error: error.message
      });
    }
  }
  
  /**
   * Actualiza las preferencias de correo
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async updateEmailPreferences(req, res) {
    try {
      const userId = req.user.id;
      const preferences = req.body;
      
      const result = await notificationService.updateEmailPreferences(userId, preferences);
      
      res.status(200).json({
        success: true,
        message: 'Preferencias de correo actualizadas',
        data: result
      });
    } catch (error) {
      logger.error(`Error al actualizar preferencias: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al actualizar preferencias de correo',
        error: error.message
      });
    }
  }
  
  /**
   * Envía una notificación (solo admin)
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async sendNotification(req, res) {
    try {
      const { userId, type, title, content, sendEmail, sendPush, sendSms, ...otherData } = req.body;
      
      if (!userId || !type || !title || !content) {
        return res.status(400).json({
          success: false,
          message: 'Usuario, tipo, título y contenido son requeridos'
        });
      }
      
      const notification = await notificationService.sendNotification(userId, {
        type,
        title,
        content,
        sendEmail: sendEmail === true || sendEmail === 'true',
        sendPush: sendPush === true || sendPush === 'true',
        sendSms: sendSms === true || sendSms === 'true',
        ...otherData
      });
      
      res.status(200).json({
        success: true,
        message: 'Notificación enviada con éxito',
        data: notification
      });
    } catch (error) {
      logger.error(`Error al enviar notificación: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al enviar notificación',
        error: error.message
      });
    }
  }
}

module.exports = new NotificationController();