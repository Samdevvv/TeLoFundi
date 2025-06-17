const { prisma } = require('../config/database');
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Configurar transportador de email
const createEmailTransporter = () => {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn('Email configuration missing - email notifications disabled');
    return null;
  }

  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Crear notificación
const createNotification = async (notificationData) => {
  try {
    const {
      userId,
      type,
      title,
      message,
      priority = 'NORMAL',
      data = {},
      actionUrl,
      actionText,
      expiresAt,
      deliveryMethods = ['push']
    } = notificationData;

    // Validar que el usuario existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        settings: {
          select: {
            emailNotifications: true,
            pushNotifications: true,
            messageNotifications: true,
            likeNotifications: true,
            boostNotifications: true
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verificar configuraciones de usuario
    const shouldSend = checkUserNotificationSettings(user.settings, type);
    if (!shouldSend) {
      logger.debug('Notification blocked by user settings', { userId, type });
      return null;
    }

    // Crear notificación en base de datos
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        priority,
        data,
        actionUrl,
        actionText,
        expiresAt,
        deliveryMethod: deliveryMethods
      }
    });

    // Enviar según métodos de entrega
    const deliveryResults = await Promise.allSettled([
      // Push notification
      deliveryMethods.includes('push') ? sendPushNotification(user, notification) : null,
      
      // Email notification
      deliveryMethods.includes('email') ? sendEmailNotification(user, notification) : null,
      
      // SMS notification (placeholder)
      deliveryMethods.includes('sms') ? sendSMSNotification(user, notification) : null
    ]);

    // Actualizar estado de entrega
    const successfulDeliveries = deliveryResults
      .filter(result => result.status === 'fulfilled' && result.value)
      .length;

    if (successfulDeliveries > 0) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          isSent: true,
          sentAt: new Date()
        }
      });
    }

    logger.info('Notification created and sent', {
      notificationId: notification.id,
      userId,
      type,
      deliveryMethods,
      successfulDeliveries
    });

    return notification;
  } catch (error) {
    logger.error('Error creating notification:', error);
    throw error;
  }
};

// Verificar configuraciones de notificación del usuario
const checkUserNotificationSettings = (settings, notificationType) => {
  if (!settings) return true; // Default: permitir todas

  const typeMapping = {
    'MESSAGE': 'messageNotifications',
    'LIKE': 'likeNotifications',
    'FAVORITE': 'likeNotifications',
    'BOOST_EXPIRED': 'boostNotifications',
    'PAYMENT_SUCCESS': 'emailNotifications',
    'PAYMENT_FAILED': 'emailNotifications',
    'AGENCY_INVITE': 'emailNotifications',
    'VERIFICATION_COMPLETED': 'emailNotifications',
    'MEMBERSHIP_REQUEST': 'emailNotifications'
  };

  const settingKey = typeMapping[notificationType];
  return settingKey ? settings[settingKey] : true;
};

// Enviar notificación push
const sendPushNotification = async (user, notification) => {
  try {
    // Obtener tokens de dispositivos activos
    const deviceTokens = await prisma.deviceToken.findMany({
      where: {
        userId: user.id,
        isActive: true
      }
    });

    if (deviceTokens.length === 0) {
      logger.debug('No active device tokens found', { userId: user.id });
      return false;
    }

    // Aquí integrarías con FCM, APNs, etc.
    // Por ahora simulamos el envío
    const pushPayload = {
      title: notification.title,
      body: notification.message,
      data: {
        notificationId: notification.id,
        type: notification.type,
        actionUrl: notification.actionUrl,
        ...notification.data
      }
    };

    // Simular envío exitoso
    logger.info('Push notification sent (simulated)', {
      userId: user.id,
      deviceCount: deviceTokens.length,
      payload: pushPayload
    });

    return true;
  } catch (error) {
    logger.error('Error sending push notification:', error);
    return false;
  }
};

// Enviar notificación por email
const sendEmailNotification = async (user, notification) => {
  try {
    const transporter = createEmailTransporter();
    if (!transporter) {
      return false;
    }

    // Generar HTML del email
    const emailHtml = generateNotificationEmailHTML(user, notification);

    const mailOptions = {
      from: `"TeLoFundi" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: notification.title,
      html: emailHtml
    };

    await transporter.sendMail(mailOptions);
    
    logger.info('Email notification sent', {
      userId: user.id,
      email: user.email,
      notificationId: notification.id
    });

    return true;
  } catch (error) {
    logger.error('Error sending email notification:', error);
    return false;
  }
};

// Enviar notificación SMS (placeholder)
const sendSMSNotification = async (user, notification) => {
  try {
    // Placeholder para integración con Twilio, etc.
    logger.info('SMS notification sent (simulated)', {
      userId: user.id,
      phone: user.phone,
      message: notification.message
    });
    
    return true;
  } catch (error) {
    logger.error('Error sending SMS notification:', error);
    return false;
  }
};

// Generar HTML para email de notificación
const generateNotificationEmailHTML = (user, notification) => {
  const actionButton = notification.actionUrl ? 
    `<a href="${notification.actionUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0;">${notification.actionText || 'Ver más'}</a>` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${notification.title}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .priority-high { border-left: 4px solid #e74c3c; }
        .priority-urgent { border-left: 4px solid #c0392b; background: #fdf2f2; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${notification.title}</h1>
        </div>
        <div class="content ${notification.priority === 'HIGH' ? 'priority-high' : ''} ${notification.priority === 'URGENT' ? 'priority-urgent' : ''}">
          <h2>Hola ${user.firstName},</h2>
          <p>${notification.message}</p>
          
          ${actionButton}
          
          <p style="color: #666; font-size: 14px;">
            Esta notificación fue enviada porque tienes activadas las notificaciones por email. 
            Puedes cambiar tus preferencias en la configuración de tu cuenta.
          </p>
        </div>
        <div class="footer">
          <p>&copy; 2024 TeLoFundi. Todos los derechos reservados.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Enviar notificaciones masivas
const sendBulkNotifications = async (notifications) => {
  try {
    const results = [];
    const batchSize = 50; // Procesar en lotes

    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (notificationData) => {
        try {
          const notification = await createNotification(notificationData);
          return { success: true, notification };
        } catch (error) {
          logger.error('Error in bulk notification:', error);
          return { success: false, error: error.message, data: notificationData };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map(result => 
        result.status === 'fulfilled' ? result.value : { success: false, error: result.reason }
      ));

      // Pausa entre lotes para evitar sobrecarga
      if (i + batchSize < notifications.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    logger.info('Bulk notifications processed', {
      total: notifications.length,
      successful,
      failed
    });

    return {
      total: notifications.length,
      successful,
      failed,
      results
    };
  } catch (error) {
    logger.error('Error sending bulk notifications:', error);
    throw error;
  }
};

// Marcar notificación como leída
const markAsRead = async (notificationId, userId) => {
  try {
    const notification = await prisma.notification.update({
      where: {
        id: notificationId,
        userId // Asegurar que pertenece al usuario
      },
      data: {
        isRead: true
      }
    });

    return notification;
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    throw error;
  }
};

// Marcar todas las notificaciones como leídas
const markAllAsRead = async (userId) => {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false
      },
      data: {
        isRead: true
      }
    });

    logger.info('All notifications marked as read', {
      userId,
      count: result.count
    });

    return result.count;
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    throw error;
  }
};

// Limpiar notificaciones expiradas
const cleanupExpiredNotifications = async () => {
  try {
    const now = new Date();
    
    // Eliminar notificaciones expiradas
    const expiredResult = await prisma.notification.deleteMany({
      where: {
        expiresAt: { lt: now },
        deletedAt: null
      }
    });

    // Eliminar notificaciones leídas muy antiguas (más de 30 días)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oldReadResult = await prisma.notification.deleteMany({
      where: {
        isRead: true,
        createdAt: { lt: thirtyDaysAgo },
        deletedAt: null
      }
    });

    logger.info('Notifications cleanup completed', {
      expiredDeleted: expiredResult.count,
      oldReadDeleted: oldReadResult.count
    });

    return {
      expiredDeleted: expiredResult.count,
      oldReadDeleted: oldReadResult.count
    };
  } catch (error) {
    logger.error('Error cleaning up notifications:', error);
    throw error;
  }
};

// Obtener estadísticas de notificaciones
const getNotificationStats = async (userId = null, timeframe = '30d') => {
  try {
    let dateFilter = {};
    const now = new Date();

    switch (timeframe) {
      case '7d':
        dateFilter = { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case '30d':
        dateFilter = { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
        break;
      case '90d':
        dateFilter = { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
        break;
    }

    const whereClause = {
      createdAt: dateFilter,
      ...(userId && { userId })
    };

    const [
      totalNotifications,
      notificationsByType,
      notificationsByPriority,
      deliveryStats,
      readStats
    ] = await Promise.all([
      // Total de notificaciones
      prisma.notification.count({ where: whereClause }),

      // Por tipo
      prisma.notification.groupBy({
        by: ['type'],
        where: whereClause,
        _count: true
      }),

      // Por prioridad
      prisma.notification.groupBy({
        by: ['priority'],
        where: whereClause,
        _count: true
      }),

      // Estadísticas de entrega
      prisma.notification.aggregate({
        where: whereClause,
        _count: {
          isSent: true
        }
      }),

      // Estadísticas de lectura
      prisma.notification.aggregate({
        where: whereClause,
        _count: {
          isRead: true
        }
      })
    ]);

    const stats = {
      timeframe,
      total: totalNotifications,
      byType: notificationsByType.reduce((acc, item) => {
        acc[item.type] = item._count;
        return acc;
      }, {}),
      byPriority: notificationsByPriority.reduce((acc, item) => {
        acc[item.priority] = item._count;
        return acc;
      }, {}),
      delivery: {
        sent: deliveryStats._count.isSent,
        deliveryRate: totalNotifications > 0 ? 
          (deliveryStats._count.isSent / totalNotifications * 100).toFixed(2) : 0
      },
      engagement: {
        read: readStats._count.isRead,
        readRate: totalNotifications > 0 ? 
          (readStats._count.isRead / totalNotifications * 100).toFixed(2) : 0
      }
    };

    return stats;
  } catch (error) {
    logger.error('Error getting notification stats:', error);
    throw error;
  }
};

// Crear notificaciones del sistema automáticas
const createSystemNotifications = async () => {
  try {
    const notifications = [];

    // Notificar sobre boosts que expiran pronto
    const expiringBoosts = await prisma.boost.findMany({
      where: {
        isActive: true,
        expiresAt: {
          gte: new Date(),
          lte: new Date(Date.now() + 2 * 60 * 60 * 1000) // Próximas 2 horas
        }
      },
      include: {
        user: { select: { id: true } },
        post: { select: { title: true } }
      }
    });

    for (const boost of expiringBoosts) {
      notifications.push({
        userId: boost.user.id,
        type: 'BOOST_EXPIRED',
        title: 'Tu boost está por expirar',
        message: `El boost de "${boost.post.title}" expirará pronto`,
        priority: 'NORMAL',
        data: {
          boostId: boost.id,
          postTitle: boost.post.title,
          expiresAt: boost.expiresAt
        }
      });
    }

    // Notificar sobre suscripciones premium que expiran
    const expiringPremium = await prisma.client.findMany({
      where: {
        isPremium: true,
        premiumUntil: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Próximos 7 días
        }
      },
      include: {
        user: { select: { id: true } }
      }
    });

    for (const client of expiringPremium) {
      notifications.push({
        userId: client.user.id,
        type: 'SUBSCRIPTION_EXPIRING',
        title: 'Tu suscripción premium está por expirar',
        message: `Tu suscripción ${client.premiumTier} expira el ${client.premiumUntil.toLocaleDateString()}`,
        priority: 'HIGH',
        data: {
          tier: client.premiumTier,
          expiresAt: client.premiumUntil
        },
        actionUrl: '/premium/renew'
      });
    }

    // Enviar todas las notificaciones del sistema
    if (notifications.length > 0) {
      const result = await sendBulkNotifications(notifications);
      logger.info('System notifications created', {
        total: notifications.length,
        successful: result.successful
      });
      return result;
    }

    return { total: 0, successful: 0, failed: 0 };
  } catch (error) {
    logger.error('Error creating system notifications:', error);
    throw error;
  }
};

// Enviar digest diario de notificaciones
const sendDailyDigest = async (userId) => {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Obtener notificaciones del día anterior
    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        createdAt: { gte: yesterday },
        type: { notIn: ['SYSTEM'] } // Excluir notificaciones del sistema
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    if (notifications.length === 0) {
      return null; // No enviar digest si no hay notificaciones
    }

    // Agrupar por tipo
    const groupedNotifications = notifications.reduce((acc, notification) => {
      const type = notification.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(notification);
      return acc;
    }, {});

    // Crear digest
    const digestData = {
      userId,
      type: 'SYSTEM',
      title: 'Resumen diario de actividad',
      message: `Tienes ${notifications.length} notificaciones del día anterior`,
      priority: 'LOW',
      data: {
        notificationCount: notifications.length,
        groupedNotifications,
        date: yesterday.toISOString().split('T')[0]
      },
      deliveryMethods: ['email']
    };

    const digest = await createNotification(digestData);
    
    logger.info('Daily digest sent', {
      userId,
      notificationCount: notifications.length
    });

    return digest;
  } catch (error) {
    logger.error('Error sending daily digest:', error);
    throw error;
  }
};

// Registrar dispositivo para notificaciones push
const registerDevice = async (userId, deviceData) => {
  try {
    const { token, platform, deviceInfo } = deviceData;

    // Verificar si el token ya existe
    const existingToken = await prisma.deviceToken.findUnique({
      where: { token }
    });

    if (existingToken) {
      // Actualizar dispositivo existente
      const updatedToken = await prisma.deviceToken.update({
        where: { token },
        data: {
          userId,
          platform,
          deviceInfo,
          isActive: true,
          lastUsedAt: new Date()
        }
      });

      return updatedToken;
    }

    // Crear nuevo token
    const deviceToken = await prisma.deviceToken.create({
      data: {
        userId,
        token,
        platform,
        deviceInfo,
        isActive: true
      }
    });

    logger.info('Device registered for push notifications', {
      userId,
      platform,
      tokenId: deviceToken.id
    });

    return deviceToken;
  } catch (error) {
    logger.error('Error registering device:', error);
    throw error;
  }
};

// Desregistrar dispositivo
const unregisterDevice = async (token) => {
  try {
    const result = await prisma.deviceToken.updateMany({
      where: { token },
      data: { isActive: false }
    });

    logger.info('Device unregistered', { token, affected: result.count });
    return result.count > 0;
  } catch (error) {
    logger.error('Error unregistering device:', error);
    throw error;
  }
};

// Obtener plantillas de notificación
const getNotificationTemplates = () => {
  return {
    // Plantillas para diferentes tipos de notificaciones
    MESSAGE: {
      title: 'Nuevo mensaje',
      template: 'Tienes un nuevo mensaje de {senderName}',
      priority: 'NORMAL'
    },
    LIKE: {
      title: 'Nuevo like',
      template: 'A {userName} le gustó tu post "{postTitle}"',
      priority: 'LOW'
    },
    FAVORITE: {
      title: 'Nuevo favorito',
      template: '{userName} agregó tu post a favoritos',
      priority: 'LOW'
    },
    AGENCY_INVITE: {
      title: 'Invitación de agencia',
      template: '{agencyName} te ha invitado a unirte a su agencia',
      priority: 'HIGH'
    },
    VERIFICATION_COMPLETED: {
      title: '¡Verificación completada!',
      template: 'Tu perfil ha sido verificado exitosamente',
      priority: 'HIGH'
    },
    PAYMENT_SUCCESS: {
      title: 'Pago completado',
      template: 'Tu pago de ${amount} ha sido procesado exitosamente',
      priority: 'NORMAL'
    },
    PAYMENT_FAILED: {
      title: 'Pago fallido',
      template: 'Tu pago no pudo ser procesado. Por favor, intenta nuevamente.',
      priority: 'HIGH'
    },
    BOOST_EXPIRED: {
      title: 'Boost expirado',
      template: 'El boost de tu post "{postTitle}" ha expirado',
      priority: 'NORMAL'
    },
    SUBSCRIPTION_EXPIRING: {
      title: 'Suscripción por expirar',
      template: 'Tu suscripción {tier} expira en {days} días',
      priority: 'HIGH'
    }
  };
};

// Crear notificación usando plantilla
const createNotificationFromTemplate = async (templateType, userId, variables = {}) => {
  try {
    const templates = getNotificationTemplates();
    const template = templates[templateType];

    if (!template) {
      throw new Error(`Template not found: ${templateType}`);
    }

    // Reemplazar variables en el mensaje
    let message = template.template;
    Object.keys(variables).forEach(key => {
      const placeholder = `{${key}}`;
      message = message.replace(new RegExp(placeholder, 'g'), variables[key]);
    });

    const notificationData = {
      userId,
      type: templateType,
      title: template.title,
      message,
      priority: template.priority,
      data: variables
    };

    return await createNotification(notificationData);
  } catch (error) {
    logger.error('Error creating notification from template:', error);
    throw error;
  }
};

module.exports = {
  createNotification,
  createNotificationFromTemplate,
  sendBulkNotifications,
  markAsRead,
  markAllAsRead,
  cleanupExpiredNotifications,
  getNotificationStats,
  createSystemNotifications,
  sendDailyDigest,
  registerDevice,
  unregisterDevice,
  getNotificationTemplates,
  sendPushNotification,
  sendEmailNotification
};