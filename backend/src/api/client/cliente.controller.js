/**
 * Controladores para la API de clientes
 */
const { prisma } = require('../../config/prisma');
const clientService = require('../../services/clientService');
const pointService = require('../../services/pointService');
const logger = require('../../utils/logger');
const helpers = require('../../utils/helpers');

/**
 * Obtiene el perfil del cliente actual
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const getClientProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Verificar que es un cliente
    if (req.user.role !== 'cliente') {
      return res.status(403).json({
        success: false,
        message: 'Acceso no autorizado'
      });
    }
    
    const client = await clientService.getClientProfile(userId);
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Perfil de cliente no encontrado'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: client
    });
  } catch (error) {
    logger.error(`Error al obtener perfil de cliente: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener perfil de cliente',
      error: error.message
    });
  }
};

/**
 * Actualiza el perfil del cliente
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const updateClientProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, preferences } = req.body;
    
    // Verificar que es un cliente
    if (req.user.role !== 'cliente') {
      return res.status(403).json({
        success: false,
        message: 'Acceso no autorizado'
      });
    }
    
    // Verificar si el username ya existe
    if (username) {
      const existingClient = await prisma.client.findFirst({
        where: {
          username,
          id: { not: userId }
        }
      });
      
      if (existingClient) {
        return res.status(400).json({
          success: false,
          message: 'El nombre de usuario ya está en uso'
        });
      }
    }
    
    // Actualizar información del cliente
    const updatedClient = await clientService.updateClientProfile(userId, {
      username,
      preferences
    });
    
    return res.status(200).json({
      success: true,
      message: 'Perfil actualizado correctamente',
      data: updatedClient
    });
  } catch (error) {
    logger.error(`Error al actualizar perfil de cliente: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil de cliente',
      error: error.message
    });
  }
};

/**
 * Actualiza la imagen de perfil del cliente
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const updateProfileImage = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Verificar que es un cliente
    if (req.user.role !== 'cliente') {
      return res.status(403).json({
        success: false,
        message: 'Acceso no autorizado'
      });
    }
    
    // Verificar que se subió un archivo
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se ha subido ninguna imagen'
      });
    }
    
    // Actualizar la imagen de perfil
    const imageUrl = req.file.location || `/uploads/${req.file.filename}`;
    
    await prisma.user.update({
      where: { id: userId },
      data: { profileImageUrl: imageUrl }
    });
    
    return res.status(200).json({
      success: true,
      message: 'Imagen de perfil actualizada correctamente',
      data: { profileImageUrl: imageUrl }
    });
  } catch (error) {
    logger.error(`Error al actualizar imagen de perfil: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar imagen de perfil',
      error: error.message
    });
  }
};

/**
 * Obtiene los perfiles favoritos del cliente
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const getFavoriteProfiles = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    
    // Verificar que es un cliente
    if (req.user.role !== 'cliente') {
      return res.status(403).json({
        success: false,
        message: 'Acceso no autorizado'
      });
    }
    
    const favorites = await clientService.getFavoriteProfiles(
      userId,
      parseInt(page),
      parseInt(limit)
    );
    
    return res.status(200).json({
      success: true,
      ...favorites
    });
  } catch (error) {
    logger.error(`Error al obtener perfiles favoritos: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener perfiles favoritos',
      error: error.message
    });
  }
};

/**
 * Añade un perfil a favoritos
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const addProfileToFavorites = async (req, res) => {
  try {
    const userId = req.user.id;
    const { profileId } = req.params;
    
    // Verificar que es un cliente
    if (req.user.role !== 'cliente') {
      return res.status(403).json({
        success: false,
        message: 'Acceso no autorizado'
      });
    }
    
    // Verificar que el perfil existe
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { id: true }
    });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Perfil no encontrado'
      });
    }
    
    // Añadir a favoritos
    const result = await clientService.addProfileToFavorites(userId, profileId);
    
    return res.status(200).json({
      success: true,
      message: 'Perfil añadido a favoritos correctamente',
      data: result
    });
  } catch (error) {
    logger.error(`Error al añadir perfil a favoritos: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al añadir perfil a favoritos',
      error: error.message
    });
  }
};

/**
 * Elimina un perfil de favoritos
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const removeProfileFromFavorites = async (req, res) => {
  try {
    const userId = req.user.id;
    const { profileId } = req.params;
    
    // Verificar que es un cliente
    if (req.user.role !== 'cliente') {
      return res.status(403).json({
        success: false,
        message: 'Acceso no autorizado'
      });
    }
    
    // Eliminar de favoritos
    const result = await clientService.removeProfileFromFavorites(userId, profileId);
    
    return res.status(200).json({
      success: true,
      message: 'Perfil eliminado de favoritos correctamente',
      data: result
    });
  } catch (error) {
    logger.error(`Error al eliminar perfil de favoritos: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar perfil de favoritos',
      error: error.message
    });
  }
};

/**
 * Obtiene el historial de contactos del cliente
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const getContactHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    
    // Verificar que es un cliente
    if (req.user.role !== 'cliente') {
      return res.status(403).json({
        success: false,
        message: 'Acceso no autorizado'
      });
    }
    
    const contacts = await clientService.getClientContactHistory(
      userId,
      parseInt(page),
      parseInt(limit)
    );
    
    return res.status(200).json({
      success: true,
      ...contacts
    });
  } catch (error) {
    logger.error(`Error al obtener historial de contactos: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener historial de contactos',
      error: error.message
    });
  }
};

/**
 * Registra un contacto con un perfil
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const contactProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { profileId } = req.params;
    const { contactMethod, contactData } = req.body;
    
    // Verificar que es un cliente
    if (req.user.role !== 'cliente') {
      return res.status(403).json({
        success: false,
        message: 'Acceso no autorizado'
      });
    }
    
    // Verificar que el perfil existe
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { id: true, isActive: true, availabilityStatus: true }
    });
    
    if (!profile || !profile.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Perfil no encontrado o no disponible'
      });
    }
    
    // Registrar contacto
    const contact = await clientService.contactProfile({
      clientId: userId,
      profileId,
      contactMethod,
      contactData,
      initiatedBy: userId,
      deviceInfo: req.useragent || null
    });
    
    // Asignar puntos por contacto si aplica
    await pointService.awardPointsForContact(userId, profileId);
    
    return res.status(201).json({
      success: true,
      message: 'Contacto registrado correctamente',
      data: contact
    });
  } catch (error) {
    logger.error(`Error al contactar perfil: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al contactar perfil',
      error: error.message
    });
  }
};

/**
 * Obtiene los cupones del cliente
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const getClientCoupons = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status = 'active' } = req.query; // active, used, expired
    
    // Verificar que es un cliente
    if (req.user.role !== 'cliente') {
      return res.status(403).json({
        success: false,
        message: 'Acceso no autorizado'
      });
    }
    
    const coupons = await clientService.getClientCoupons(userId, status);
    
    return res.status(200).json({
      success: true,
      data: coupons
    });
  } catch (error) {
    logger.error(`Error al obtener cupones del cliente: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener cupones',
      error: error.message
    });
  }
};

/**
 * Obtiene el historial de puntos del cliente
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const getPointsHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    
    // Verificar que es un cliente
    if (req.user.role !== 'cliente') {
      return res.status(403).json({
        success: false,
        message: 'Acceso no autorizado'
      });
    }
    
    const pointsHistory = await pointService.getUserPointsHistory(
      userId,
      parseInt(page),
      parseInt(limit)
    );
    
    return res.status(200).json({
      success: true,
      ...pointsHistory
    });
  } catch (error) {
    logger.error(`Error al obtener historial de puntos: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener historial de puntos',
      error: error.message
    });
  }
};

/**
 * Obtiene la información de membresía VIP del cliente
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const getVipStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Verificar que es un cliente
    if (req.user.role !== 'cliente') {
      return res.status(403).json({
        success: false,
        message: 'Acceso no autorizado'
      });
    }
    
    const vipInfo = await clientService.getClientVipStatus(userId);
    
    return res.status(200).json({
      success: true,
      data: vipInfo
    });
  } catch (error) {
    logger.error(`Error al obtener estado VIP: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener información de membresía VIP',
      error: error.message
    });
  }
};

/**
 * Genera un código de referido para el cliente
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const generateReferralCode = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Verificar que es un cliente
    if (req.user.role !== 'cliente') {
      return res.status(403).json({
        success: false,
        message: 'Acceso no autorizado'
      });
    }
    
    // Verificar si ya tiene código de referido
    const client = await prisma.client.findUnique({
      where: { id: userId },
      select: { referralCode: true }
    });
    
    if (client.referralCode) {
      return res.status(400).json({
        success: false,
        message: 'Ya tienes un código de referido',
        data: { referralCode: client.referralCode }
      });
    }
    
    // Generar código de referido
    const referralCode = helpers.generateReferralCode(userId);
    
    // Actualizar cliente
    await prisma.client.update({
      where: { id: userId },
      data: { referralCode }
    });
    
    return res.status(200).json({
      success: true,
      message: 'Código de referido generado correctamente',
      data: { referralCode }
    });
  } catch (error) {
    logger.error(`Error al generar código de referido: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al generar código de referido',
      error: error.message
    });
  }
};

/**
 * Usa un código de referido
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const useReferralCode = async (req, res) => {
  try {
    const userId = req.user.id;
    const { referralCode } = req.body;
    
    // Verificar que es un cliente
    if (req.user.role !== 'cliente') {
      return res.status(403).json({
        success: false,
        message: 'Acceso no autorizado'
      });
    }
    
    // Verificar si ya usó un código de referido
    const client = await prisma.client.findUnique({
      where: { id: userId },
      select: { referredBy: true }
    });
    
    if (client.referredBy) {
      return res.status(400).json({
        success: false,
        message: 'Ya has utilizado un código de referido anteriormente'
      });
    }
    
    // Buscar cliente con ese código de referido
    const referrer = await prisma.client.findFirst({
      where: { referralCode }
    });
    
    if (!referrer) {
      return res.status(404).json({
        success: false,
        message: 'Código de referido inválido'
      });
    }
    
    // Verificar que no es el mismo usuario
    if (referrer.id === userId) {
      return res.status(400).json({
        success: false,
        message: 'No puedes usar tu propio código de referido'
      });
    }
    
    // Actualizar cliente
    await prisma.client.update({
      where: { id: userId },
      data: { referredBy: referrer.id }
    });
    
    // Otorgar puntos a ambos
    await pointService.awardPointsForReferral(referrer.id, userId);
    
    return res.status(200).json({
      success: true,
      message: 'Código de referido utilizado correctamente'
    });
  } catch (error) {
    logger.error(`Error al usar código de referido: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al usar código de referido',
      error: error.message
    });
  }
};

/**
 * Obtiene la configuración de notificaciones del cliente
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const getNotificationSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Verificar que es un cliente
    if (req.user.role !== 'cliente') {
      return res.status(403).json({
        success: false,
        message: 'Acceso no autorizado'
      });
    }
    
    const settings = await prisma.emailSetting.findUnique({
      where: { userId }
    });
    
    if (!settings) {
      // Crear configuración predeterminada
      const defaultSettings = await prisma.emailSetting.create({
        data: {
          userId,
          newsletters: false,
          promotions: false,
          systemNotifications: true,
          chatNotifications: true,
          contactNotifications: true,
          paymentNotifications: true,
          verificationNotifications: true
        }
      });
      
      return res.status(200).json({
        success: true,
        data: defaultSettings
      });
    }
    
    return res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error(`Error al obtener configuración de notificaciones: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener configuración de notificaciones',
      error: error.message
    });
  }
};

/**
 * Actualiza la configuración de notificaciones del cliente
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      newsletters,
      promotions,
      systemNotifications,
      chatNotifications,
      contactNotifications,
      paymentNotifications,
      verificationNotifications,
      unsubscribeAll
    } = req.body;
    
    // Verificar que es un cliente
    if (req.user.role !== 'cliente') {
      return res.status(403).json({
        success: false,
        message: 'Acceso no autorizado'
      });
    }
    
    // Preparar datos para actualizar
    const updateData = {};
    
    if (newsletters !== undefined) updateData.newsletters = newsletters;
    if (promotions !== undefined) updateData.promotions = promotions;
    if (systemNotifications !== undefined) updateData.systemNotifications = systemNotifications;
    if (chatNotifications !== undefined) updateData.chatNotifications = chatNotifications;
    if (contactNotifications !== undefined) updateData.contactNotifications = contactNotifications;
    if (paymentNotifications !== undefined) updateData.paymentNotifications = paymentNotifications;
    if (verificationNotifications !== undefined) updateData.verificationNotifications = verificationNotifications;
    if (unsubscribeAll !== undefined) {
      updateData.unsubscribeAll = unsubscribeAll;
      if (unsubscribeAll) {
        // Si se desinscribe de todo, establecer todo a false
        updateData.newsletters = false;
        updateData.promotions = false;
        updateData.systemNotifications = false;
        updateData.chatNotifications = false;
        updateData.contactNotifications = false;
        updateData.paymentNotifications = false;
        updateData.verificationNotifications = false;
      }
    }
    
    // Actualizar o crear configuración
    const settings = await prisma.emailSetting.upsert({
      where: { userId },
      update: {
        ...updateData,
        updatedAt: new Date()
      },
      create: {
        userId,
        ...updateData,
        updatedAt: new Date()
      }
    });
    
    return res.status(200).json({
      success: true,
      message: 'Configuración de notificaciones actualizada correctamente',
      data: settings
    });
  } catch (error) {
    logger.error(`Error al actualizar configuración de notificaciones: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar configuración de notificaciones',
      error: error.message
    });
  }
};

module.exports = {
  getClientProfile,
  updateClientProfile,
  updateProfileImage,
  getFavoriteProfiles,
  addProfileToFavorites,
  removeProfileFromFavorites,
  getContactHistory,
  contactProfile,
  getClientCoupons,
  getPointsHistory,
  getVipStatus,
  generateReferralCode,
  useReferralCode,
  getNotificationSettings,
  updateNotificationSettings
};