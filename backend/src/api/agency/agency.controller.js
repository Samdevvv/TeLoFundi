// src/api/agency/agency.controller.js
const agencyService = require('../../services/agencyService');
const logger = require('../../utils/logger');

class AgencyController {
  /**
   * Obtiene información de una agencia por su ID
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async getAgencyById(req, res) {
    try {
      const { id } = req.params;
      const includeProfiles = req.query.includeProfiles === 'true';
      
      const agency = await agencyService.getAgencyById(id, includeProfiles);
      
      res.status(200).json({
        success: true,
        data: agency
      });
    } catch (error) {
      logger.error(`Error al obtener agencia: ${error.message}`, { error });
      res.status(error.message.includes('no encontrada') ? 404 : 500).json({
        success: false,
        message: error.message.includes('no encontrada') 
          ? 'Agencia no encontrada' 
          : 'Error al obtener información de la agencia',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene información de una agencia por su slug
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async getAgencyBySlug(req, res) {
    try {
      const { slug } = req.params;
      const includeProfiles = req.query.includeProfiles === 'true';
      
      const agency = await agencyService.getAgencyBySlug(slug, includeProfiles);
      
      res.status(200).json({
        success: true,
        data: agency
      });
    } catch (error) {
      logger.error(`Error al obtener agencia por slug: ${error.message}`, { error });
      res.status(error.message.includes('no encontrada') ? 404 : 500).json({
        success: false,
        message: error.message.includes('no encontrada') 
          ? 'Agencia no encontrada' 
          : 'Error al obtener información de la agencia',
        error: error.message
      });
    }
  }
  
  /**
   * Actualiza una agencia
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async updateAgency(req, res) {
    try {
      const agencyId = req.user.id;
      const agencyData = req.body;
      
      // Verificar que el usuario sea una agencia
      if (req.user.role !== 'agencia') {
        return res.status(403).json({
          success: false,
          message: 'No autorizado para actualizar esta agencia'
        });
      }
      
      const updatedAgency = await agencyService.updateAgency(agencyId, agencyData);
      
      res.status(200).json({
        success: true,
        message: 'Agencia actualizada con éxito',
        data: updatedAgency
      });
    } catch (error) {
      logger.error(`Error al actualizar agencia: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al actualizar agencia',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene los perfiles de una agencia
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async getAgencyProfiles(req, res) {
    try {
      const { agencyId } = req.params;
      
      // Opciones de filtrado y paginación
      const options = {
        page: parseInt(req.query.page || 1),
        limit: parseInt(req.query.limit || 20),
        gender: req.query.gender,
        minAge: req.query.minAge,
        maxAge: req.query.maxAge,
        services: req.query.services ? req.query.services.split(',') : null,
        verificationStatus: req.query.verificationStatus,
        availabilityStatus: req.query.availabilityStatus,
        orderBy: req.query.orderBy || 'featured'
      };
      
      const result = await agencyService.getAgencyProfiles(agencyId, options);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error(`Error al obtener perfiles: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al obtener perfiles de la agencia',
        error: error.message
      });
    }
  }
  
  /**
   * Verifica un perfil
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async verifyProfile(req, res) {
    try {
      const agencyId = req.user.id;
      const { profileId } = req.params;
      const { approved, ...verificationData } = req.body;
      
      // Verificar que el usuario sea una agencia
      if (req.user.role !== 'agencia') {
        return res.status(403).json({
          success: false,
          message: 'No autorizado para verificar perfiles'
        });
      }
      
      const result = await agencyService.verifyProfile(
        agencyId,
        profileId,
        approved === true || approved === 'true',
        verificationData
      );
      
      res.status(200).json({
        success: true,
        message: result.status === 'verificado' 
          ? 'Perfil verificado exitosamente' 
          : 'Verificación rechazada',
        data: result
      });
    } catch (error) {
      logger.error(`Error al verificar perfil: ${error.message}`, { error });
      res.status(error.message.includes('no pertenece') ? 400 : 500).json({
        success: false,
        message: 'Error al verificar perfil',
        error: error.message
      });
    }
  }
  
  /**
   * Añade un perfil a una agencia
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async addProfileToAgency(req, res) {
    try {
      const agencyId = req.user.id;
      const { profileId } = req.body;
      
      // Verificar que el usuario sea una agencia
      if (req.user.role !== 'agencia') {
        return res.status(403).json({
          success: false,
          message: 'No autorizado para añadir perfiles'
        });
      }
      
      const result = await agencyService.addProfileToAgency(agencyId, profileId);
      
      res.status(200).json({
        success: true,
        message: 'Solicitud enviada al perfil',
        data: result
      });
    } catch (error) {
      logger.error(`Error al añadir perfil: ${error.message}`, { error });
      res.status(error.message.includes('ya pertenece') || error.message.includes('no encontrado') ? 400 : 500).json({
        success: false,
        message: 'Error al añadir perfil a la agencia',
        error: error.message
      });
    }
  }
  
  /**
   * Responde a una solicitud de cambio de agencia
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async respondToAgencyRequest(req, res) {
    try {
      const profileId = req.user.id;
      const { requestId, accept } = req.body;
      
      // Verificar que el usuario sea un perfil
      if (req.user.role !== 'perfil') {
        return res.status(403).json({
          success: false,
          message: 'No autorizado para responder a solicitudes'
        });
      }
      
      const result = await agencyService.respondToAgencyRequest(
        profileId,
        requestId,
        accept === true || accept === 'true'
      );
      
      res.status(200).json({
        success: true,
        message: result.status === 'aprobado' 
          ? 'Solicitud aceptada' 
          : 'Solicitud rechazada',
        data: result
      });
    } catch (error) {
      logger.error(`Error al responder solicitud: ${error.message}`, { error });
      res.status(error.message.includes('no encontrada') ? 400 : 500).json({
        success: false,
        message: 'Error al responder a la solicitud',
        error: error.message
      });
    }
  }
  
  /**
   * Elimina un perfil de una agencia
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async removeProfileFromAgency(req, res) {
    try {
      const agencyId = req.user.id;
      const { profileId } = req.params;
      const { reason } = req.body;
      
      // Verificar que el usuario sea una agencia
      if (req.user.role !== 'agencia') {
        return res.status(403).json({
          success: false,
          message: 'No autorizado para remover perfiles'
        });
      }
      
      const result = await agencyService.removeProfileFromAgency(
        agencyId,
        profileId,
        reason
      );
      
      res.status(200).json({
        success: true,
        message: 'Perfil removido exitosamente',
        data: result
      });
    } catch (error) {
      logger.error(`Error al remover perfil: ${error.message}`, { error });
      res.status(error.message.includes('no pertenece') ? 400 : 500).json({
        success: false,
        message: 'Error al remover perfil',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene las solicitudes de cambio de agencia pendientes
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async getPendingAgencyChanges(req, res) {
    try {
      const agencyId = req.user.id;
      
      // Verificar que el usuario sea una agencia
      if (req.user.role !== 'agencia') {
        return res.status(403).json({
          success: false,
          message: 'No autorizado para ver solicitudes'
        });
      }
      
      const requests = await agencyService.getPendingAgencyChanges(agencyId);
      
      res.status(200).json({
        success: true,
        data: requests
      });
    } catch (error) {
      logger.error(`Error al obtener solicitudes: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al obtener solicitudes pendientes',
        error: error.message
      });
    }
  }
}

module.exports = new AgencyController();