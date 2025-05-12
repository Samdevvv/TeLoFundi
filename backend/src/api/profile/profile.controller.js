// src/api/profile/profile.controller.js
const profileService = require('../../services/profileService');
const logger = require('../../utils/logger');

class ProfileController {
  /**
   * Obtiene información de un perfil por su ID
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async getProfileById(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar si es el propio perfil o una agencia asociada
      const isOwnProfile = req.user && req.user.id === id;
      const isAssociatedAgency = req.user && req.user.role === 'agencia';
      
      // Incluir información privada solo para el propio perfil o su agencia
      const includePrivate = isOwnProfile || isAssociatedAgency;
      
      const profile = await profileService.getProfileById(id, includePrivate);
      
      res.status(200).json({
        success: true,
        data: profile
      });
    } catch (error) {
      logger.error(`Error al obtener perfil: ${error.message}`, { error });
      res.status(error.message.includes('no encontrado') ? 404 : 500).json({
        success: false,
        message: error.message.includes('no encontrado') 
          ? 'Perfil no encontrado' 
          : 'Error al obtener información del perfil',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene información de un perfil por su slug
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async getProfileBySlug(req, res) {
    try {
      const { slug } = req.params;
      
      const profile = await profileService.getProfileBySlug(slug);
      
      res.status(200).json({
        success: true,
        data: profile
      });
    } catch (error) {
      logger.error(`Error al obtener perfil por slug: ${error.message}`, { error });
      res.status(error.message.includes('no encontrado') ? 404 : 500).json({
        success: false,
        message: error.message.includes('no encontrado') 
          ? 'Perfil no encontrado' 
          : 'Error al obtener información del perfil',
        error: error.message
      });
    }
  }
  
  /**
   * Actualiza un perfil
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const profileData = req.body;
      
      // Solo el propio perfil puede actualizarse
      if (req.user.role !== 'perfil') {
        return res.status(403).json({
          success: false,
          message: 'No autorizado para actualizar este perfil'
        });
      }
      
      const updatedProfile = await profileService.updateProfile(userId, profileData);
      
      res.status(200).json({
        success: true,
        message: 'Perfil actualizado con éxito',
        data: updatedProfile
      });
    } catch (error) {
      logger.error(`Error al actualizar perfil: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al actualizar perfil',
        error: error.message
      });
    }
  }
  
  /**
   * Registra un contacto con un perfil
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async contactProfile(req, res) {
    try {
      const { profileId, contactMethod, contactData } = req.body;
      const clientId = req.user.id;
      
      // Verificar que el usuario sea un cliente
      if (req.user.role !== 'cliente') {
        return res.status(403).json({
          success: false,
          message: 'Solo los clientes pueden contactar perfiles'
        });
      }
      
      // Metadatos adicionales
      const metadata = {
        initiatedBy: clientId,
        notes: req.body.notes,
        location: req.body.location,
        deviceInfo: {
          ip: req.ip,
          userAgent: req.headers['user-agent']
        }
      };
      
      const result = await profileService.registerProfileContact(
        clientId,
        profileId,
        contactMethod,
        contactData,
        metadata
      );
      
      res.status(200).json({
        success: true,
        message: 'Contacto registrado con éxito',
        data: result
      });
    } catch (error) {
      logger.error(`Error al contactar perfil: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al registrar contacto',
        error: error.message
      });
    }
  }
  
  /**
   * Registra una vista a un perfil
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async viewProfile(req, res) {
    try {
      const { profileId } = req.body;
      const viewerId = req.user ? req.user.id : null;
      
      // Metadatos adicionales
      const metadata = {
        ipAddress: req.ip,
        sessionId: req.body.sessionId,
        deviceType: req.body.deviceType || 'desktop',
        deviceInfo: {
          userAgent: req.headers['user-agent']
        },
        referrer: req.headers.referer,
        duration: req.body.duration,
        location: req.body.location,
        searchQuery: req.body.searchQuery
      };
      
      await profileService.registerProfileView(profileId, viewerId, metadata);
      
      res.status(200).json({
        success: true,
        message: 'Vista registrada con éxito'
      });
    } catch (error) {
      logger.error(`Error al registrar vista: ${error.message}`, { error });
      // Responder éxito de todos modos para no interrumpir la experiencia
      res.status(200).json({
        success: true,
        message: 'Vista registrada'
      });
    }
  }
  
  /**
   * Agrega o elimina un perfil de favoritos
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async toggleFavorite(req, res) {
    try {
      const { profileId, action } = req.body;
      const clientId = req.user.id;
      
      // Verificar que el usuario sea un cliente
      if (req.user.role !== 'cliente') {
        return res.status(403).json({
          success: false,
          message: 'Solo los clientes pueden gestionar favoritos'
        });
      }
      
      const add = action === 'add';
      const result = await profileService.toggleFavoriteProfile(clientId, profileId, add);
      
      res.status(200).json({
        success: true,
        message: add ? 'Perfil agregado a favoritos' : 'Perfil eliminado de favoritos',
        data: result
      });
    } catch (error) {
      logger.error(`Error al gestionar favorito: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al gestionar favorito',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene los perfiles favoritos del cliente
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async getFavorites(req, res) {
    try {
      const clientId = req.user.id;
      
      // Verificar que el usuario sea un cliente
      if (req.user.role !== 'cliente') {
        return res.status(403).json({
          success: false,
          message: 'Solo los clientes pueden ver sus favoritos'
        });
      }
      
      // Opciones de paginación
      const options = {
        page: parseInt(req.query.page || 1),
        limit: parseInt(req.query.limit || 20)
      };
      
      const result = await profileService.getFavoriteProfiles(clientId, options);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error(`Error al obtener favoritos: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al obtener perfiles favoritos',
        error: error.message
      });
    }
  }
  
  /**
   * Gestiona las imágenes de un perfil
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async manageProfileImage(req, res) {
    try {
      const profileId = req.user.id;
      const imageData = req.body;
      
      // Verificar que el usuario sea un perfil
      if (req.user.role !== 'perfil') {
        return res.status(403).json({
          success: false,
          message: 'Solo los perfiles pueden gestionar sus imágenes'
        });
      }
      
      const result = await profileService.manageProfileImage(profileId, imageData);
      
      res.status(200).json({
        success: true,
        message: imageData.id ? 'Imagen actualizada' : 'Imagen agregada',
        data: result
      });
    } catch (error) {
      logger.error(`Error al gestionar imagen: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al gestionar imagen de perfil',
        error: error.message
      });
    }
  }
  
  /**
   * Elimina una imagen de un perfil
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async deleteProfileImage(req, res) {
    try {
      const profileId = req.user.id;
      const { imageId } = req.params;
      
      // Verificar que el usuario sea un perfil
      if (req.user.role !== 'perfil') {
        return res.status(403).json({
          success: false,
          message: 'Solo los perfiles pueden eliminar sus imágenes'
        });
      }
      
      await profileService.deleteProfileImage(imageId, profileId);
      
      res.status(200).json({
        success: true,
        message: 'Imagen eliminada con éxito'
      });
    } catch (error) {
      logger.error(`Error al eliminar imagen: ${error.message}`, { error });
      res.status(error.message.includes('no encontrada') || error.message.includes('No autorizado') ? 400 : 500).json({
        success: false,
        message: 'Error al eliminar imagen',
        error: error.message
      });
    }
  }
  
  /**
   * Cambia la agencia de un perfil o lo hace independiente
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async changeAgency(req, res) {
    try {
      const profileId = req.user.id;
      const { agencyId } = req.body;
      
      // Verificar que el usuario sea un perfil
      if (req.user.role !== 'perfil') {
        return res.status(403).json({
          success: false,
          message: 'Solo los perfiles pueden cambiar de agencia'
        });
      }
      
      const result = await profileService.changeAgency(profileId, agencyId);
      
      res.status(200).json({
        success: true,
        message: agencyId 
          ? 'Solicitud de cambio a nueva agencia enviada' 
          : 'Perfil cambiado a independiente',
        data: result
      });
    } catch (error) {
      logger.error(`Error al cambiar agencia: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al cambiar agencia',
        error: error.message
      });
    }
  }
}

module.exports = new ProfileController();