// src/api/payment/payment.controller.js
const paymentService = require('../../services/paymentService');
const logger = require('../../utils/logger');

/**
 * Controlador para gestión de pagos
 */
class PaymentController {
  /**
   * Crea un nuevo pago
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async createPayment(req, res) {
    try {
      const userId = req.user.id;
      
      // Extraer información del pago
      const paymentData = {
        ...req.body,
        userId,
        ipAddress: req.ip,
        deviceInfo: {
          userAgent: req.headers['user-agent']
        }
      };
      
      // Verificar campos requeridos
      const requiredFields = ['amount', 'paymentType', 'paymentMethodType', 'provider'];
      const missingFields = requiredFields.filter(field => !paymentData[field]);
      
      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Faltan campos requeridos: ${missingFields.join(', ')}`
        });
      }
      
      const payment = await paymentService.createPayment(paymentData);
      
      res.status(201).json({
        success: true,
        message: 'Pago creado con éxito',
        data: payment
      });
    } catch (error) {
      logger.error(`Error al crear pago: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al crear pago',
        error: error.message
      });
    }
  }
  
  /**
   * Procesa un pago
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async processPayment(req, res) {
    try {
      const { paymentId } = req.params;
      const providerData = req.body;
      
      if (!paymentId) {
        return res.status(400).json({
          success: false,
          message: 'ID de pago requerido'
        });
      }
      
      const payment = await paymentService.processPayment(paymentId, providerData);
      
      res.status(200).json({
        success: true,
        message: 'Pago procesado con éxito',
        data: payment
      });
    } catch (error) {
      logger.error(`Error al procesar pago: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al procesar pago',
        error: error.message
      });
    }
  }
  
  /**
   * Actualiza el estado de un pago
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async updatePaymentStatus(req, res) {
    try {
      const { paymentId } = req.params;
      const { status, reason } = req.body;
      const userId = req.user.id;
      
      if (!paymentId || !status || !reason) {
        return res.status(400).json({
          success: false,
          message: 'ID de pago, estado y razón son requeridos'
        });
      }
      
      // Validar estado
      const validStatuses = ['pendiente', 'procesando', 'completado', 'fallido', 'cancelado'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Estado de pago inválido'
        });
      }
      
      const payment = await paymentService.updatePaymentStatus(paymentId, status, reason, userId);
      
      res.status(200).json({
        success: true,
        message: `Estado de pago actualizado a ${status}`,
        data: payment
      });
    } catch (error) {
      logger.error(`Error al actualizar estado: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al actualizar estado de pago',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene los pagos de un usuario
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async getUserPayments(req, res) {
    try {
      const userId = req.user.id;
      const { page, limit, status, paymentType, startDate, endDate } = req.query;
      
      const payments = await paymentService.getUserPayments(userId, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        status,
        paymentType,
        startDate,
        endDate
      });
      
      res.status(200).json({
        success: true,
        data: payments
      });
    } catch (error) {
      logger.error(`Error al obtener pagos: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al obtener pagos',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene detalles de un pago
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async getPaymentDetails(req, res) {
    try {
      const { paymentId } = req.params;
      const userId = req.user.id;
      
      const payment = await paymentService.getPaymentDetails(paymentId, userId);
      
      res.status(200).json({
        success: true,
        data: payment
      });
    } catch (error) {
      logger.error(`Error al obtener detalles: ${error.message}`, { error });
      res.status(error.message.includes('no encontrado') ? 404 : 500).json({
        success: false,
        message: 'Error al obtener detalles del pago',
        error: error.message
      });
    }
  }
  
  /**
   * Solicita un reembolso
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async requestRefund(req, res) {
    try {
      const { paymentId } = req.params;
      const { reason } = req.body;
      const userId = req.user.id;
      
      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Razón del reembolso requerida'
        });
      }
      
      const refund = await paymentService.requestRefund(paymentId, userId, reason);
      
      res.status(200).json({
        success: true,
        message: 'Solicitud de reembolso enviada con éxito',
        data: refund
      });
    } catch (error) {
      logger.error(`Error al solicitar reembolso: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al solicitar reembolso',
        error: error.message
      });
    }
  }
  
  /**
   * Procesa un reembolso (admin)
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async processRefund(req, res) {
    try {
      const { refundId } = req.params;
      const { approved, notes } = req.body;
      const adminId = req.user.id;
      
      if (approved === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Debe especificar si el reembolso es aprobado o rechazado'
        });
      }
      
      const refund = await paymentService.processRefund(
        refundId,
        approved === true || approved === 'true',
        adminId,
        notes || ''
      );
      
      res.status(200).json({
        success: true,
        message: approved 
          ? 'Reembolso aprobado con éxito' 
          : 'Reembolso rechazado',
        data: refund
      });
    } catch (error) {
      logger.error(`Error al procesar reembolso: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al procesar reembolso',
        error: error.message
      });
    }
  }
}

module.exports = new PaymentController();