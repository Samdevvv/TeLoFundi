// src/api/payment/payment.routes.js
const express = require('express');
const paymentController = require('./payment.controller');
const { authMiddleware } = require('../../middleware/auth');
const { adminOnly } = require('../../middleware/role');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: API para gestión de pagos
 */

/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Crea un nuevo pago
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - paymentType
 *               - paymentMethodType
 *               - provider
 *             properties:
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *                 default: USD
 *               paymentType:
 *                 type: string
 *                 enum: [paquete_cupones, membresia_vip, servicio_destacado, verificacion, publicidad, suscripcion_agencia, comision_plataforma]
 *               referenceId:
 *                 type: string
 *               referenceType:
 *                 type: string
 *               paymentMethodType:
 *                 type: string
 *                 enum: [tarjeta_credito, tarjeta_debito, paypal, stripe, transferencia_bancaria, mercado_pago, crypto, apple_pay, google_pay, efectivo]
 *               paymentMethodId:
 *                 type: string
 *               provider:
 *                 type: string
 *                 enum: [stripe, paypal, mercado_pago]
 *               couponId:
 *                 type: string
 *               billingAddress:
 *                 type: object
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Pago creado con éxito
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.post('/', authMiddleware, paymentController.createPayment);

/**
 * @swagger
 * /api/payments/{paymentId}/process:
 *   post:
 *     summary: Procesa un pago
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del pago
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Pago procesado con éxito
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.post('/:paymentId/process', authMiddleware, paymentController.processPayment);

/**
 * @swagger
 * /api/payments/{paymentId}/status:
 *   put:
 *     summary: Actualiza el estado de un pago (Admin)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del pago
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *               - reason
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pendiente, procesando, completado, fallido, cancelado]
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Estado actualizado con éxito
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.put('/:paymentId/status', authMiddleware, adminOnly, paymentController.updatePaymentStatus);

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: Obtiene los pagos del usuario
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Límite de resultados por página
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pendiente, procesando, completado, fallido, reembolsado, disputado, cancelado]
 *         description: Filtrar por estado
 *       - in: query
 *         name: paymentType
 *         schema:
 *           type: string
 *         description: Filtrar por tipo de pago
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de inicio (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de fin (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Pagos obtenidos con éxito
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.get('/', authMiddleware, paymentController.getUserPayments);

/**
 * @swagger
 * /api/payments/{paymentId}:
 *   get:
 *     summary: Obtiene detalles de un pago
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del pago
 *     responses:
 *       200:
 *         description: Detalles obtenidos con éxito
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Pago no encontrado
 *       500:
 *         description: Error del servidor
 */
router.get('/:paymentId', authMiddleware, paymentController.getPaymentDetails);

/**
 * @swagger
 * /api/payments/{paymentId}/refund:
 *   post:
 *     summary: Solicita un reembolso
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del pago
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Solicitud enviada con éxito
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.post('/:paymentId/refund', authMiddleware, paymentController.requestRefund);

/**
 * @swagger
 * /api/payments/refunds/{refundId}/process:
 *   post:
 *     summary: Procesa un reembolso (Admin)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: refundId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del reembolso
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - approved
 *             properties:
 *               approved:
 *                 type: boolean
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reembolso procesado con éxito
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
router.post('/refunds/:refundId/process', authMiddleware, adminOnly, paymentController.processRefund);

module.exports = router;