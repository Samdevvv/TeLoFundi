// src/services/notificationService.js
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const emailService = require('./emailService');

const prisma = new PrismaClient();

/**
 * Servicio para gestionar notificaciones
 */
class NotificationService {
  /**
   * Envía una notificación a un usuario
   * @param {string} userId - ID del usuario
   * @param {Object} notificationData - Datos de la notificación
   * @returns {Promise<Object>} - Notificación creada
   */
  async sendNotification(userId, notificationData) {
    try {
      // Verificar que el usuario existe
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      // Datos requeridos para la notificación
      const {
        type,
        title,
        content,
        referenceId,
        referenceType,
        deepLink,
        imageUrl,
        importance = 'normal',
        sendEmail = false,
        sendPush = false,
        sendSms = false
      } = notificationData;

      // Crear la notificación
      const notification = await prisma.notification.create({
        data: {
          userId,
          type,
          title,
          content,
          referenceId,
          referenceType,
          deepLink,
          imageUrl,
          importance,
          sendEmail,
          sendPush,
          sendSms,
          isSent: true
        }
      });

      // Enviar por correo si está habilitado
      if (sendEmail) {
        try {
          await this._sendEmailNotification(user, notification);
        } catch (error) {
          logger.error(`Error al enviar notificación por correo: ${error.message}`, { error });
          // No fallar toda la operación si el correo falla
        }
      }

      // Enviar por push si está habilitado
      if (sendPush) {
        try {
          await this._sendPushNotification(user, notification);
        } catch (error) {
          logger.error(`Error al enviar notificación push: ${error.message}`, { error });
          // No fallar toda la operación si el push falla
        }
      }

      // Enviar por SMS si está habilitado
      if (sendSms) {
        try {
          await this._sendSmsNotification(user, notification);
        } catch (error) {
          logger.error(`Error al enviar notificación SMS: ${error.message}`, { error });
          // No fallar toda la operación si el SMS falla
        }
      }

      // Emitir evento por socket (si está conectado)
      this._emitSocketEvent(userId, 'notification', notification);

      return notification;
    } catch (error) {
      logger.error(`Error al enviar notificación: ${error.message}`, { error });
      throw new Error(`Error al enviar notificación: ${error.message}`);
    }
  }

  /**
   * Envía notificación por correo electrónico
   * @param {Object} user - Usuario destinatario
   * @param {Object} notification - Notificación a enviar
   * @returns {Promise<void>}
   * @private
   */
  async _sendEmailNotification(user, notification) {
    try {
      // Verificar preferencias de correo del usuario
      const emailSettings = await prisma.emailSetting.findUnique({
        where: { userId: user.id }
      });

      // No enviar si el usuario ha desactivado notificaciones por correo
      if (emailSettings && emailSettings.unsubscribeAll) {
        return;
      }

      // Verificar si el tipo de notificación está habilitado
      const isEnabled = this._isEmailNotificationEnabled(emailSettings, notification.type);
      if (!isEnabled) {
        return;
      }

      // Buscar plantilla apropiada
      const template = await this._findNotificationTemplate(notification.type, 'email');

      // Si no hay plantilla, usar contenido directo
      const emailContent = template ? 
        this._applyTemplateVariables(template.content, {
          user,
          notification
        }) : 
        notification.content;

      const emailSubject = template ?
        this._applyTemplateVariables(template.subject, {
          user,
          notification
        }) :
        notification.title;

      // Enviar correo
      await emailService.sendEmail({
        to: user.email,
        subject: emailSubject,
        html: emailContent,
        from: process.env.EMAIL_FROM || 'no-reply@telofundi.com',
        templateId: template?.id
      });

      // Actualizar notificación
      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailSent: true }
      });

      // Registrar el envío
      await prisma.emailLog.create({
        data: {
          userId: user.id,
          emailAddress: user.email,
          subject: emailSubject,
          templateId: template?.id,
          templateName: template?.name,
          status: 'enviado',
          emailProvider: 'sistema'
        }
      });
    } catch (error) {
      logger.error(`Error al enviar correo de notificación: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Verifica si un tipo de notificación está habilitado para correo
   * @param {Object} emailSettings - Configuración de correo
   * @param {string} notificationType - Tipo de notificación
   * @returns {boolean} - ¿Está habilitado?
   * @private
   */
  _isEmailNotificationEnabled(emailSettings, notificationType) {
    if (!emailSettings) {
      return true; // Por defecto, enviar notificaciones si no hay configuración
    }

    switch (notificationType) {
      case 'mensaje_nuevo':
        return emailSettings.chatNotifications;
      case 'contacto_nuevo':
        return emailSettings.contactNotifications;
      case 'puntos_ganados':
      case 'cupon_expirando':
      case 'sorteo_ganado':
        return emailSettings.promotions;
      case 'verificacion_completada':
        return emailSettings.verificationNotifications;
      case 'pago_completado':
      case 'pago_fallido':
        return emailSettings.paymentNotifications;
      case 'sistema':
      case 'recordatorio':
        return emailSettings.systemNotifications;
      default:
        return true;
    }
  }

  /**
   * Busca una plantilla de notificación
   * @param {string} notificationType - Tipo de notificación
   * @param {string} templateType - Tipo de plantilla (email, push, sms)
   * @returns {Promise<Object|null>} - Plantilla encontrada o null
   * @private
   */
  async _findNotificationTemplate(notificationType, templateType) {
    try {
      const template = await prisma.notificationTemplate.findFirst({
        where: {
          type: templateType,
          name: { contains: notificationType },
          isActive: true
        }
      });

      return template;
    } catch (error) {
      logger.error(`Error al buscar plantilla: ${error.message}`, { error });
      return null;
    }
  }

  /**
   * Aplica variables a una plantilla
   * @param {string} template - Contenido de la plantilla
   * @param {Object} variables - Variables a aplicar
   * @returns {string} - Plantilla con variables aplicadas
   * @private
   */
  _applyTemplateVariables(template, variables) {
    let result = template;
    
    // Usuario
    if (variables.user) {
      result = result.replace(/{{name}}/g, variables.user.username || 'Usuario');
      result = result.replace(/{{email}}/g, variables.user.email || '');
    }
    
    // Notificación
    if (variables.notification) {
      result = result.replace(/{{title}}/g, variables.notification.title || '');
      result = result.replace(/{{content}}/g, variables.notification.content || '');
    }
    
    // Otras variables específicas
    if (variables.points) {
      result = result.replace(/{{points}}/g, variables.points);
    }
    
    if (variables.action) {
      result = result.replace(/{{action}}/g, variables.action);
    }
    
    if (variables.discount) {
      result = result.replace(/{{discount}}/g, variables.discount);
    }
    
    if (variables.days) {
      result = result.replace(/{{days}}/g, variables.days);
    }
    
    return result;
  }

  /**
   * Envía notificación push
   * @param {Object} user - Usuario destinatario
   * @param {Object} notification - Notificación a enviar
   * @returns {Promise<void>}
   * @private
   */
  async _sendPushNotification(user, notification) {
    try {
      // Obtener dispositivos del usuario
      const devices = await prisma.userDevice.findMany({
        where: {
          userId: user.id,
          isActive: true
        }
      });

      if (devices.length === 0) {
        return;
      }

      // Buscar plantilla apropiada
      const template = await this._findNotificationTemplate(notification.type, 'push');

      // Preparar mensaje
      const payload = {
        title: notification.title,
        body: template ? 
          this._applyTemplateVariables(template.content, {
            user,
            notification
          }) : 
          notification.content,
        data: {
          notificationId: notification.id,
          deepLink: notification.deepLink || '',
          referenceId: notification.referenceId || '',
          referenceType: notification.referenceType || '',
          type: notification.type
        }
      };

      // Enviar a cada dispositivo
      // En un sistema real, usaríamos Firebase Cloud Messaging, OneSignal u otro servicio
      for (const device of devices) {
        logger.info(`[SIMULADO] Enviando notificación push a dispositivo ${device.deviceToken}`);
        // await firebaseAdmin.messaging().send({
        //   token: device.deviceToken,
        //   notification: {
        //     title: payload.title,
        //     body: payload.body
        //   },
        //   data: payload.data
        // });
      }

      // Actualizar notificación
      await prisma.notification.update({
        where: { id: notification.id },
        data: { pushSent: true }
      });
    } catch (error) {
      logger.error(`Error al enviar notificación push: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Envía notificación SMS
   * @param {Object} user - Usuario destinatario
   * @param {Object} notification - Notificación a enviar
   * @returns {Promise<void>}
   * @private
   */
  async _sendSmsNotification(user, notification) {
    try {
      // Verificar que el usuario tiene teléfono
      if (!user.phone) {
        return;
      }

      // Buscar plantilla apropiada
      const template = await this._findNotificationTemplate(notification.type, 'sms');

      // Preparar mensaje
      const message = template ? 
        this._applyTemplateVariables(template.content, {
          user,
          notification
        }) : 
        notification.content;

      // Enviar SMS (simulado)
      logger.info(`[SIMULADO] Enviando SMS a ${user.phone}: ${message}`);

      // Actualizar notificación
      await prisma.notification.update({
        where: { id: notification.id },
        data: { smsSent: true }
      });
    } catch (error) {
      logger.error(`Error al enviar notificación SMS: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Emite evento por socket
   * @param {string} userId - ID del usuario
   * @param {string} event - Nombre del evento
   * @param {Object} data - Datos del evento
   * @private
   */
  _emitSocketEvent(userId, event, data) {
    try {
      // En un sistema real, aquí conectaríamos con el sistema de sockets
      // Por ejemplo: io.to(userId).emit(event, data);
      logger.info(`[SIMULADO] Emitiendo evento ${event} para usuario ${userId}`);
    } catch (error) {
      logger.error(`Error al emitir evento socket: ${error.message}`, { error });
      // No lanzar error ya que esto no debe interrumpir el flujo
    }
  }

  /**
   * Marca una notificación como leída
   * @param {string} notificationId - ID de la notificación
   * @param {string} userId - ID del usuario
   * @returns {Promise<Object>} - Notificación actualizada
   */
  async markAsRead(notificationId, userId) {
    try {
      // Verificar que la notificación existe y pertenece al usuario
      const notification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId
        }
      });

      if (!notification) {
        throw new Error('Notificación no encontrada');
      }

      // Marcar como leída
      const updatedNotification = await prisma.notification.update({
        where: { id: notificationId },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });

      return updatedNotification;
    } catch (error) {
      logger.error(`Error al marcar notificación como leída: ${error.message}`, { error });
      throw new Error(`Error al marcar notificación como leída: ${error.message}`);
    }
  }

  /**
   * Marca todas las notificaciones de un usuario como leídas
   * @param {string} userId - ID del usuario
   * @returns {Promise<number>} - Número de notificaciones actualizadas
   */
  async markAllAsRead(userId) {
    try {
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

      return result.count;
    } catch (error) {
      logger.error(`Error al marcar notificaciones como leídas: ${error.message}`, { error });
      throw new Error(`Error al marcar notificaciones como leídas: ${error.message}`);
    }
  }

  /**
   * Obtiene las notificaciones de un usuario
   * @param {string} userId - ID del usuario
   * @param {Object} options - Opciones de paginación y filtrado
   * @returns {Promise<Object>} - Notificaciones paginadas
   */
  async getUserNotifications(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        unreadOnly = false,
        type
      } = options;

      const skip = (page - 1) * limit;

      // Construir filtros
      const where = {
        userId,
        ...(unreadOnly && { isRead: false }),
        ...(type && { type })
      };

      // Obtener notificaciones
      const notifications = await prisma.notification.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      });

      // Contar total
      const total = await prisma.notification.count({ where });

      // Contar no leídas
      const unreadCount = await prisma.notification.count({
        where: {
          userId,
          isRead: false
        }
      });

      return {
        notifications,
        unreadCount,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`Error al obtener notificaciones: ${error.message}`, { error });
      throw new Error(`Error al obtener notificaciones: ${error.message}`);
    }
  }

  /**
   * Elimina una notificación
   * @param {string} notificationId - ID de la notificación
   * @param {string} userId - ID del usuario
   * @returns {Promise<boolean>} - ¿Se eliminó correctamente?
   */
  async deleteNotification(notificationId, userId) {
    try {
      // Verificar que la notificación existe y pertenece al usuario
      const notification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId
        }
      });

      if (!notification) {
        throw new Error('Notificación no encontrada');
      }

      // Eliminar la notificación
      await prisma.notification.delete({
        where: { id: notificationId }
      });

      return true;
    } catch (error) {
      logger.error(`Error al eliminar notificación: ${error.message}`, { error });
      throw new Error(`Error al eliminar notificación: ${error.message}`);
    }
  }

  /**
   * Registra un dispositivo para notificaciones push
   * @param {string} userId - ID del usuario
   * @param {Object} deviceInfo - Información del dispositivo
   * @returns {Promise<Object>} - Dispositivo registrado
   */
  async registerDevice(userId, deviceInfo) {
    try {
      const {
        deviceToken,
        deviceType,
        deviceName,
        deviceModel,
        osVersion,
        appVersion
      } = deviceInfo;

      // Verificar datos requeridos
      if (!deviceToken || !deviceType) {
        throw new Error('Token de dispositivo y tipo son requeridos');
      }

      // Verificar si el dispositivo ya está registrado
      const existingDevice = await prisma.userDevice.findFirst({
        where: {
          userId,
          deviceToken
        }
      });

      if (existingDevice) {
        // Actualizar dispositivo existente
        return prisma.userDevice.update({
          where: { id: existingDevice.id },
          data: {
            isActive: true,
            deviceName,
            deviceModel,
            osVersion,
            appVersion,
            lastUsedAt: new Date()
          }
        });
      }

      // Crear nuevo dispositivo
      return prisma.userDevice.create({
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
    } catch (error) {
      logger.error(`Error al registrar dispositivo: ${error.message}`, { error });
      throw new Error(`Error al registrar dispositivo: ${error.message}`);
    }
  }

  /**
   * Actualiza las preferencias de correo electrónico
   * @param {string} userId - ID del usuario
   * @param {Object} preferences - Preferencias de correo
   * @returns {Promise<Object>} - Preferencias actualizadas
   */
  async updateEmailPreferences(userId, preferences) {
    try {
      // Verificar que el usuario existe
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      // Actualizar o crear preferencias
      return prisma.emailSetting.upsert({
        where: { userId },
        update: {
          ...preferences,
          updatedAt: new Date()
        },
        create: {
          userId,
          ...preferences
        }
      });
    } catch (error) {
      logger.error(`Error al actualizar preferencias de correo: ${error.message}`, { error });
      throw new Error(`Error al actualizar preferencias de correo: ${error.message}`);
    }
  }
}

module.exports = new NotificationService();