// src/api/search/search.controller.js
const searchService = require('../../services/searchService');
const logger = require('../../utils/logger');

class SearchController {
  /**
   * Busca perfiles según criterios
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async searchProfiles(req, res) {
    try {
      // Extraer criterios de búsqueda del query
      const {
        query,
        gender,
        minAge,
        maxAge,
        location,
        city,
        country,
        services,
        verificationStatus,
        availabilityStatus,
        minPrice,
        maxPrice,
        languages,
        nationality,
        features,
        tags,
        categoryId,
        agencyId,
        independent,
        travelAvailability,
        page,
        limit,
        orderBy
      } = req.query;
      
      // Construir objeto de criterios
      const criteria = {
        query,
        gender,
        minAge,
        maxAge,
        location,
        city,
        country,
        services,
        verificationStatus,
        availabilityStatus,
        minPrice,
        maxPrice,
        languages,
        nationality,
        features,
        tags,
        categoryId,
        agencyId,
        independent,
        travelAvailability
      };
      
      // Opciones de paginación y ordenamiento
      const options = {
        page: parseInt(page || 1),
        limit: parseInt(limit || 20),
        orderBy
      };
      
      // Información del usuario para registro de búsqueda
      const userInfo = {
        userId: req.user?.id,
        sessionId: req.body.sessionId || req.query.sessionId,
        ipAddress: req.ip,
        deviceType: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'desktop',
        deviceInfo: {
          userAgent: req.headers['user-agent']
        },
        location: req.body.location
      };
      
      const results = await searchService.searchProfiles(criteria, options, userInfo);
      
      res.status(200).json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error(`Error en búsqueda de perfiles: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al buscar perfiles',
        error: error.message
      });
    }
  }
  
  /**
   * Registra un clic en un perfil desde los resultados
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async registerProfileClick(req, res) {
    try {
      const { searchId, profileId } = req.body;
      
      if (!searchId || !profileId) {
        return res.status(400).json({
          success: false,
          message: 'ID de búsqueda y perfil son requeridos'
        });
      }
      
      // Información del usuario
      const userInfo = {
        userId: req.user?.id,
        sessionId: req.body.sessionId
      };
      
      await searchService.registerProfileClick(searchId, profileId, userInfo);
      
      // Siempre devolver éxito para no interferir con la experiencia
      res.status(200).json({
        success: true
      });
    } catch (error) {
      logger.error(`Error al registrar clic: ${error.message}`, { error });
      // Responder éxito de todos modos
      res.status(200).json({
        success: true
      });
    }
  }
  
  /**
   * Busca agencias según criterios
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async searchAgencies(req, res) {
    try {
      // Extraer criterios de búsqueda
      const {
        query,
        city,
        country,
        verificationStatus,
        minProfiles,
        page,
        limit
      } = req.query;
      
      // Construir objeto de criterios
      const criteria = {
        query,
        city,
        country,
        verificationStatus,
        minProfiles
      };
      
      // Opciones de paginación
      const options = {
        page: parseInt(page || 1),
        limit: parseInt(limit || 20)
      };
      
      const results = await searchService.searchAgencies(criteria, options);
      
      res.status(200).json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error(`Error en búsqueda de agencias: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al buscar agencias',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene las categorías disponibles
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async getCategories(req, res) {
    try {
      const categories = await searchService.getCategories();
      
      res.status(200).json({
        success: true,
        data: categories
      });
    } catch (error) {
      logger.error(`Error al obtener categorías: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al obtener categorías',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene los tags populares
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async getPopularTags(req, res) {
    try {
      const { limit } = req.query;
      const tags = await searchService.getPopularTags(parseInt(limit || 20));
      
      res.status(200).json({
        success: true,
        data: tags
      });
    } catch (error) {
      logger.error(`Error al obtener tags populares: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al obtener tags populares',
        error: error.message
      });
    }
  }
}

module.exports = new SearchController();