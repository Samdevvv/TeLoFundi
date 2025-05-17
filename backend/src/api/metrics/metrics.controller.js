/**
 * Controladores para la API de métricas
 */
const { prisma } = require('../../config/prisma');
const metricService = require('../../services/metricService');
const logger = require('../../utils/logger');

/**
 * Obtiene las métricas generales del usuario según su rol
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const getUserMetrics = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const { period = 'month' } = req.query; // day, week, month, year
    
    let metrics;
    
    switch (role) {
      case 'perfil':
        metrics = await metricService.getProfileMetrics(userId, period);
        break;
      case 'cliente':
        metrics = await metricService.getClientMetrics(userId, period);
        break;
      case 'agencia':
        metrics = await metricService.getAgencyMetrics(userId, period);
        break;
      case 'admin':
        metrics = await metricService.getAdminMetrics(period);
        break;
      default:
        return res.status(403).json({
          success: false,
          message: 'Rol no autorizado para ver métricas'
        });
    }
    
    return res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error(`Error al obtener métricas de usuario: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener métricas',
      error: error.message
    });
  }
};

/**
 * Obtiene las métricas detalladas de un perfil
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const getProfileDetailedMetrics = async (req, res) => {
  try {
    const { profileId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { period = 'month' } = req.query; // day, week, month, year
    
    // Verificar permisos
    if (role !== 'admin' && role !== 'agencia' && !(role === 'perfil' && userId === profileId)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver estas métricas'
      });
    }
    
    // Si es agencia, verificar que el perfil pertenece a la agencia
    if (role === 'agencia') {
      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        select: { agencyId: true }
      });
      
      if (!profile || profile.agencyId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Este perfil no pertenece a tu agencia'
        });
      }
    }
    
    const metrics = await metricService.getDetailedProfileMetrics(profileId, period);
    
    return res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error(`Error al obtener métricas detalladas de perfil: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener métricas detalladas',
      error: error.message
    });
  }
};

/**
 * Obtiene las métricas de visitas para un perfil
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const getProfileVisitsMetrics = async (req, res) => {
  try {
    const { profileId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { period = 'month', interval = 'day' } = req.query; // period: day, week, month, year | interval: hour, day, week, month
    
    // Verificar permisos
    if (role !== 'admin' && role !== 'agencia' && !(role === 'perfil' && userId === profileId)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver estas métricas'
      });
    }
    
    // Si es agencia, verificar que el perfil pertenece a la agencia
    if (role === 'agencia') {
      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        select: { agencyId: true }
      });
      
      if (!profile || profile.agencyId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Este perfil no pertenece a tu agencia'
        });
      }
    }
    
    const metrics = await metricService.getProfileVisitMetrics(profileId, period, interval);
    
    return res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error(`Error al obtener métricas de visitas: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener métricas de visitas',
      error: error.message
    });
  }
};

/**
 * Obtiene las métricas de contactos para un perfil
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const getProfileContactsMetrics = async (req, res) => {
  try {
    const { profileId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { period = 'month', interval = 'day' } = req.query;
    
    // Verificar permisos
    if (role !== 'admin' && role !== 'agencia' && !(role === 'perfil' && userId === profileId)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver estas métricas'
      });
    }
    
    // Si es agencia, verificar que el perfil pertenece a la agencia
    if (role === 'agencia') {
      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        select: { agencyId: true }
      });
      
      if (!profile || profile.agencyId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Este perfil no pertenece a tu agencia'
        });
      }
    }
    
    const metrics = await metricService.getProfileContactMetrics(profileId, period, interval);
    
    return res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error(`Error al obtener métricas de contactos: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener métricas de contactos',
      error: error.message
    });
  }
};

/**
 * Obtiene las métricas de una agencia
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const getAgencyDetailedMetrics = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { period = 'month' } = req.query;
    
    // Verificar permisos
    if (role !== 'admin' && !(role === 'agencia' && userId === agencyId)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver estas métricas'
      });
    }
    
    const metrics = await metricService.getDetailedAgencyMetrics(agencyId, period);
    
    return res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error(`Error al obtener métricas detalladas de agencia: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener métricas detalladas',
      error: error.message
    });
  }
};

/**
 * Obtiene las métricas de perfiles para una agencia
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const getAgencyProfilesMetrics = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { period = 'month', sortBy = 'views' } = req.query; // sortBy: views, contacts, favorites
    
    // Verificar permisos
    if (role !== 'admin' && !(role === 'agencia' && userId === agencyId)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver estas métricas'
      });
    }
    
    const metrics = await metricService.getAgencyProfilesMetrics(agencyId, period, sortBy);
    
    return res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error(`Error al obtener métricas de perfiles de agencia: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener métricas de perfiles',
      error: error.message
    });
  }
};

/**
 * Obtiene las métricas de ingresos para una agencia
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const getAgencyRevenueMetrics = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { period = 'month', interval = 'day' } = req.query;
    
    // Verificar permisos
    if (role !== 'admin' && !(role === 'agencia' && userId === agencyId)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver estas métricas'
      });
    }
    
    const metrics = await metricService.getAgencyRevenueMetrics(agencyId, period, interval);
    
    return res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error(`Error al obtener métricas de ingresos: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener métricas de ingresos',
      error: error.message
    });
  }
};

/**
 * Obtiene las métricas de tráfico (búsquedas)
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const getTrafficMetrics = async (req, res) => {
  try {
    const role = req.user.role;
    const { period = 'month', interval = 'day' } = req.query;
    
    // Solo para administradores
    if (role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver estas métricas'
      });
    }
    
    const metrics = await metricService.getTrafficMetrics(period, interval);
    
    return res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error(`Error al obtener métricas de tráfico: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener métricas de tráfico',
      error: error.message
    });
  }
};

/**
 * Obtiene las métricas generales de la plataforma
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const getPlatformMetrics = async (req, res) => {
  try {
    const role = req.user.role;
    const { period = 'month' } = req.query;
    
    // Solo para administradores
    if (role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver estas métricas'
      });
    }
    
    const metrics = await metricService.getPlatformOverview(period);
    
    return res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error(`Error al obtener métricas de la plataforma: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener métricas de la plataforma',
      error: error.message
    });
  }
};

/**
 * Obtiene las métricas de ingresos de la plataforma
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const getPlatformRevenueMetrics = async (req, res) => {
  try {
    const role = req.user.role;
    const { period = 'month', interval = 'day' } = req.query;
    
    // Solo para administradores
    if (role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver estas métricas'
      });
    }
    
    const metrics = await metricService.getPlatformRevenueMetrics(period, interval);
    
    return res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error(`Error al obtener métricas de ingresos de la plataforma: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener métricas de ingresos',
      error: error.message
    });
  }
};

/**
 * Obtiene las métricas de registros de usuario
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const getUserRegistrationMetrics = async (req, res) => {
  try {
    const role = req.user.role;
    const { period = 'month', interval = 'day', userType } = req.query;
    
    // Solo para administradores
    if (role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver estas métricas'
      });
    }
    
    const metrics = await metricService.getUserRegistrationMetrics(period, interval, userType);
    
    return res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error(`Error al obtener métricas de registros: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener métricas de registros',
      error: error.message
    });
  }
};

/**
 * Exporta datos de métricas
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 */
const exportMetricsData = async (req, res) => {
  try {
    const { metricType, period, format = 'csv' } = req.body;
    const userId = req.user.id;
    const role = req.user.role;
    
    // Verificar permisos (solo admin o agencia puede exportar)
    if (role !== 'admin' && role !== 'agencia') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para exportar métricas'
      });
    }
    
    // Obtener datos según el tipo de métrica
    let data;
    switch (metricType) {
      case 'profile':
        // Si es agencia, verificar que el perfil pertenece a la agencia
        if (role === 'agencia' && req.body.profileId) {
          const profile = await prisma.profile.findUnique({
            where: { id: req.body.profileId },
            select: { agencyId: true }
          });
          
          if (!profile || profile.agencyId !== userId) {
            return res.status(403).json({
              success: false,
              message: 'Este perfil no pertenece a tu agencia'
            });
          }
        }
        
        data = await metricService.exportProfileMetrics(req.body.profileId, period);
        break;
      case 'agency':
        // Verificar que el usuario es admin o es la agencia correcta
        if (role === 'agencia' && req.body.agencyId !== userId) {
          return res.status(403).json({
            success: false,
            message: 'No puedes exportar métricas de otra agencia'
          });
        }
        
        data = await metricService.exportAgencyMetrics(req.body.agencyId, period);
        break;
      case 'platform':
        // Solo admin puede exportar métricas de plataforma
        if (role !== 'admin') {
          return res.status(403).json({
            success: false,
            message: 'No tienes permiso para exportar métricas de la plataforma'
          });
        }
        
        data = await metricService.exportPlatformMetrics(period);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Tipo de métrica no válido'
        });
    }
    
    // Preparar respuesta según formato solicitado
    if (format === 'json') {
      return res.status(200).json({
        success: true,
        data
      });
    } else if (format === 'csv') {
      // Servicio para convertir a CSV
      const csvData = await metricService.convertToCSV(data);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=metrics_${metricType}_${period}.csv`);
      return res.status(200).send(csvData);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Formato no soportado'
      });
    }
  } catch (error) {
    logger.error(`Error al exportar métricas: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error al exportar métricas',
      error: error.message
    });
  }
};

module.exports = {
  getUserMetrics,
  getProfileDetailedMetrics,
  getProfileVisitsMetrics,
  getProfileContactsMetrics,
  getAgencyDetailedMetrics,
  getAgencyProfilesMetrics,
  getAgencyRevenueMetrics,
  getTrafficMetrics,
  getPlatformMetrics,
  getPlatformRevenueMetrics,
  getUserRegistrationMetrics,
  exportMetricsData
};