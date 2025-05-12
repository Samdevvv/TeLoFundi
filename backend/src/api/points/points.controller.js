// src/api/points/points.controller.js
const pointService = require('../../services/pointService');
const logger = require('../../utils/logger');

class PointsController {
  /**
   * Otorga puntos a un usuario
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async awardPoints(req, res) {
    try {
      const { userId, action, points, ...metadata } = req.body;
      
      // Verificar que el usuario sea admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No autorizado para otorgar puntos manualmente'
        });
      }
      
      // Validar datos requeridos
      if (!userId || !action || !points) {
        return res.status(400).json({
          success: false,
          message: 'Usuario, acción y puntos son requeridos'
        });
      }
      
      // Asignar usuario admin como creador
      metadata.createdBy = req.user.id;
      
      const result = await pointService.awardPoints(
        userId,
        action,
        parseInt(points),
        metadata
      );
      
      res.status(200).json({
        success: true,
        message: 'Puntos otorgados con éxito',
        data: result
      });
    } catch (error) {
      logger.error(`Error al otorgar puntos: ${error.message}`, { error });
      res.status(error.message.includes('no encontrado') ? 404 : 500).json({
        success: false,
        message: 'Error al otorgar puntos',
        error: error.message
      });
    }
  }
  
  /**
   * Otorga puntos por login diario
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async awardDailyLoginPoints(req, res) {
    try {
      const userId = req.user.id;
      
      // Verificar que el usuario sea cliente
      if (req.user.role !== 'cliente') {
        return res.status(403).json({
          success: false,
          message: 'Solo los clientes pueden recibir puntos por login'
        });
      }
      
      // Obtener configuración del sistema
      const systemSettings = await prisma.systemSetting.findFirst();
      const loginPoints = systemSettings?.pointsForDailyLogin || 5;
      
      const result = await pointService.awardPoints(
        userId,
        'login_diario',
        loginPoints,
        {
          description: 'Puntos por login diario'
        }
      );
      
      res.status(200).json({
        success: true,
        message: 'Puntos por login diario otorgados',
        data: result
      });
    } catch (error) {
      logger.error(`Error al otorgar puntos de login: ${error.message}`, { error });
      
      // Si ya recibió puntos hoy, no es un error grave
      if (error.message.includes('ya ha recibido puntos')) {
        return res.status(200).json({
          success: false,
          message: 'Ya ha recibido puntos por login hoy',
          alreadyAwarded: true
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error al otorgar puntos por login',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene el historial de transacciones de puntos
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async getTransactions(req, res) {
    try {
      const userId = req.user.id;
      
      // Opciones de filtrado y paginación
      const options = {
        page: parseInt(req.query.page || 1),
        limit: parseInt(req.query.limit || 20),
        action: req.query.action,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        includeExpired: req.query.includeExpired === 'true'
      };
      
      const result = await pointService.getPointTransactions(userId, options);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error(`Error al obtener transacciones: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al obtener historial de transacciones',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene el historial de saldo de puntos
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async getBalanceHistory(req, res) {
    try {
      const userId = req.user.id;
      
      // Opciones de paginación
      const options = {
        page: parseInt(req.query.page || 1),
        limit: parseInt(req.query.limit || 20)
      };
      
      const result = await pointService.getPointBalanceHistory(userId, options);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error(`Error al obtener historial de saldo: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al obtener historial de saldo',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene los cupones disponibles del usuario
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async getUserCoupons(req, res) {
    try {
      const userId = req.user.id;
      
      // Opciones de filtrado
      const options = {
        active: req.query.active !== 'false',
        expired: req.query.expired === 'true'
      };
      
      const coupons = await pointService.getUserCoupons(userId, options);
      
      res.status(200).json({
        success: true,
        data: coupons
      });
    } catch (error) {
      logger.error(`Error al obtener cupones: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al obtener cupones disponibles',
        error: error.message
      });
    }
  }
  
  /**
   * Transfiere un cupón a otro usuario
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async transferCoupon(req, res) {
    try {
      const fromUserId = req.user.id;
      const { couponId, toUserId } = req.body;
      
      if (!couponId || !toUserId) {
        return res.status(400).json({
          success: false,
          message: 'ID de cupón y usuario destino son requeridos'
        });
      }
      
      const result = await pointService.transferCoupon(
        couponId,
        fromUserId,
        toUserId
      );
      
      res.status(200).json({
        success: true,
        message: 'Cupón transferido con éxito',
        data: result
      });
    } catch (error) {
      logger.error(`Error al transferir cupón: ${error.message}`, { error });
      res.status(error.message.includes('no encontrado') || error.message.includes('no transferible') ? 400 : 500).json({
        success: false,
        message: 'Error al transferir cupón',
        error: error.message
      });
    }
  }
  
  /**
   * Usa un cupón
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async useCoupon(req, res) {
    try {
      const userId = req.user.id;
      const { couponId, usedFor } = req.body;
      
      if (!couponId) {
        return res.status(400).json({
          success: false,
          message: 'ID de cupón es requerido'
        });
      }
      
      const result = await pointService.useCoupon(
        couponId,
        userId,
        usedFor
      );
      
      res.status(200).json({
        success: true,
        message: 'Cupón utilizado con éxito',
        data: result
      });
    } catch (error) {
      logger.error(`Error al usar cupón: ${error.message}`, { error });
      res.status(error.message.includes('no encontrado') ? 400 : 500).json({
        success: false,
        message: 'Error al usar cupón',
        error: error.message
      });
    }
  }
  
  /**
   * Valida un código de cupón
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async validateCoupon(req, res) {
    try {
      const { code } = req.params;
      
      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Código de cupón es requerido'
        });
      }
      
      const result = await pointService.validateCouponCode(code);
      
      res.status(200).json({
        success: result.valid,
        data: result.coupon,
        message: result.valid ? 'Cupón válido' : result.error
      });
    } catch (error) {
      logger.error(`Error al validar cupón: ${error.message}`, { error });
      res.status(400).json({
        success: false,
        message: 'Error al validar cupón',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene los paquetes de cupones disponibles
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async getCouponPackages(req, res) {
    try {
      const packages = await pointService.getCouponPackages();
      
      res.status(200).json({
        success: true,
        data: packages
      });
    } catch (error) {
      logger.error(`Error al obtener paquetes: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al obtener paquetes de cupones',
        error: error.message
      });
    }
  }
}

module.exports = new PointsController();