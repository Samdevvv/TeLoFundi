// src/api/admin/admin.controller.js
const adminService = require('../../services/adminService');
const metricService = require('../../services/metricService');
const logger = require('../../utils/logger');

/**
 * Controlador para el panel de administración
 */
class AdminController {
  /**
   * Obtiene estadísticas generales del sistema
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async getSystemStats(req, res) {
    try {
      const stats = await adminService.getSystemStats();
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error(`Error al obtener estadísticas: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas del sistema',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene solicitudes de agencia pendientes
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async getPendingAgencyRequests(req, res) {
    try {
      const { page = 1, limit = 10, status = 'pendiente' } = req.query;
      
      const requests = await adminService.getPendingAgencyRequests({
        page: parseInt(page),
        limit: parseInt(limit),
        status
      });
      
      res.status(200).json({
        success: true,
        data: requests
      });
    } catch (error) {
      logger.error(`Error al obtener solicitudes: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al obtener solicitudes de agencia',
        error: error.message
      });
    }
  }
  
  /**
   * Procesa una solicitud de agencia
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async processAgencyRequest(req, res) {
    try {
      const { requestId } = req.params;
      const { approved, notes } = req.body;
      const adminId = req.user.id;
      
      if (approved === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Debe especificar si la solicitud es aprobada o rechazada'
        });
      }
      
      const result = await adminService.processAgencyRequest(
        requestId,
        approved === true || approved === 'true',
        adminId,
        notes || ''
      );
      
      res.status(200).json({
        success: true,
        message: approved 
          ? 'Solicitud de agencia aprobada con éxito' 
          : 'Solicitud de agencia rechazada',
        data: result
      });
    } catch (error) {
      logger.error(`Error al procesar solicitud: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al procesar solicitud de agencia',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene usuarios por tipo
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async getUsers(req, res) {
    try {
      const { type } = req.params;
      const { page = 1, limit = 20, query, status, startDate, endDate } = req.query;
      
      // Validar tipo de usuario
      const validTypes = ['cliente', 'perfil', 'agencia', 'admin'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Tipo de usuario inválido'
        });
      }
      
      const users = await adminService.getUsers(type, {
        page: parseInt(page),
        limit: parseInt(limit),
        query,
        status,
        startDate,
        endDate
      });
      
      res.status(200).json({
        success: true,
        data: users
      });
    } catch (error) {
      logger.error(`Error al obtener usuarios: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al obtener usuarios',
        error: error.message
      });
    }
  }
  
  /**
   * Activa o desactiva un usuario
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async toggleUserStatus(req, res) {
    try {
      const { userId } = req.params;
      const { active, reason } = req.body;
      const adminId = req.user.id;
      
      if (active === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Debe especificar si el usuario será activado o desactivado'
        });
      }
      
      const result = await adminService.toggleUserStatus(
        userId,
        active === true || active === 'true',
        adminId,
        reason || ''
      );
      
      res.status(200).json({
        success: true,
        message: active 
          ? 'Usuario activado con éxito' 
          : 'Usuario desactivado con éxito',
        data: result
      });
    } catch (error) {
      logger.error(`Error al cambiar estado de usuario: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al cambiar estado de usuario',
        error: error.message
      });
    }
  }
  
  /**
   * Elimina un usuario
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async deleteUser(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminId = req.user.id;
      
      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Debe proporcionar una razón para la eliminación'
        });
      }
      
      await adminService.deleteUser(userId, adminId, reason);
      
      res.status(200).json({
        success: true,
        message: 'Usuario eliminado con éxito'
      });
    } catch (error) {
      logger.error(`Error al eliminar usuario: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al eliminar usuario',
        error: error.message
      });
    }
  }
  
  /**
   * Verifica un perfil manualmente
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async verifyProfile(req, res) {
    try {
      const { profileId } = req.params;
      const { approved, notes, method } = req.body;
      const adminId = req.user.id;
      
      if (approved === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Debe especificar si el perfil será verificado o rechazado'
        });
      }
      
      const result = await adminService.verifyProfileByAdmin(
        profileId,
        adminId,
        approved === true || approved === 'true',
        {
          notes: notes || '',
          method: method || 'admin_verification'
        }
      );
      
      res.status(200).json({
        success: true,
        message: approved 
          ? 'Perfil verificado con éxito' 
          : 'Verificación de perfil rechazada',
        data: result
      });
    } catch (error) {
      logger.error(`Error al verificar perfil: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al verificar perfil',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene métricas detalladas del sistema
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async getDetailedMetrics(req, res) {
    try {
      const { startDate, endDate, groupBy = 'daily' } = req.query;
      
      // Para una implementación real, se implementaría un servicio específico para métricas de admin
      // Aquí usamos el servicio general de métricas como ejemplo
      
      // Simulamos datos para este ejemplo
      const currentDate = new Date();
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      // Generar datos de ejemplo
      const registrations = this._generateSampleTimeSeriesData(oneMonthAgo, currentDate, groupBy);
      const revenue = this._generateSampleTimeSeriesData(oneMonthAgo, currentDate, groupBy, 100, 1000);
      const activeUsers = this._generateSampleTimeSeriesData(oneMonthAgo, currentDate, groupBy, 50, 200);
      
      res.status(200).json({
        success: true,
        data: {
          startDate: oneMonthAgo,
          endDate: currentDate,
          groupBy,
          metrics: {
            registrations,
            revenue,
            activeUsers
          }
        }
      });
    } catch (error) {
      logger.error(`Error al obtener métricas detalladas: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al obtener métricas detalladas',
        error: error.message
      });
    }
  }
  
  /**
   * Genera datos de series temporales para ejemplos
   * @param {Date} startDate - Fecha de inicio
   * @param {Date} endDate - Fecha de fin
   * @param {string} groupBy - Agrupación (daily, weekly, monthly)
   * @param {number} min - Valor mínimo
   * @param {number} max - Valor máximo
   * @returns {Array} - Datos generados
   * @private
   */
  _generateSampleTimeSeriesData(startDate, endDate, groupBy, min = 5, max = 50) {
    const data = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      data.push({
        date: new Date(currentDate),
        value: Math.floor(Math.random() * (max - min + 1)) + min
      });
      
      // Incrementar fecha según agrupación
      switch (groupBy) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        default:
          currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    
    return data;
  }
}

module.exports = new AdminController();