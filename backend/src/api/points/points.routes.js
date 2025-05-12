// src/api/points/points.routes.js
const express = require('express');
const pointsController = require('./points.controller');
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Points
 *   description: API para sistema de puntos y cupones
 */

/**
 * @swagger
 * /api/points/award:
 *   post:
 *     summary: Otorga puntos a un usuario (solo admin)
 *     tags: [Points]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - action
 *               - points
 *             properties:
 *               userId:
 *                 type: string
 *               action:
 *                 type: string
 *                 enum: [registro, login_diario, contacto_perfil, compra, referido, uso_plataforma, sorteo, completar_perfil, verificacion, recompensa_admin, devolucion]
 *               points:
 *                 type: integer
 *               referenceId:
 *                 type: string
 *               referenceType:
 *                 type: string
 *               description:
 *                 type: string
 *               expirationDays:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Puntos otorgados con éxito
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 */
router.post('/award', authMiddleware, roleMiddleware(['admin']), pointsController.awardPoints);

/**
 * @swagger
 * /api/points/login-daily:
 *   post:
 *     summary: Otorga puntos por login diario
 *     tags: [Points]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Puntos otorgados o ya recibidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 *       500:
 *         description: Error del servidor
 */
router.post('/login-daily', authMiddleware, pointsController.awardDailyLoginPoints);

/**
 * @swagger
 * /api/points/transactions:
 *   get:
 *     summary: Obtiene el historial de transacciones de puntos
 *     tags: [Points]
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
 *           default: 20
 *         description: Límite de resultados por página
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           enum: [registro, login_diario, contacto_perfil, compra, referido, uso_plataforma, sorteo, completar_perfil, verificacion, recompensa_admin, devolucion]
 *         description: Filtrar por tipo de acción
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
 *       - in: query
 *         name: includeExpired
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Incluir transacciones expiradas
 *     responses:
 *       200:
 *         description: Transacciones obtenidas con éxito
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.get('/transactions', authMiddleware, pointsController.getTransactions);

/**
 * @swagger
 * /api/points/balance-history:
 *   get:
 *     summary: Obtiene el historial de saldo de puntos
 *     tags: [Points]
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
 *           default: 20
 *         description: Límite de resultados por página
 *     responses:
 *       200:
 *         description: Historial obtenido con éxito
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.get('/balance-history', authMiddleware, pointsController.getBalanceHistory);

/**
 * @swagger
 * /api/points/coupons:
 *   get:
 *     summary: Obtiene los cupones disponibles del usuario
 *     tags: [Points]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Mostrar cupones activos o usados
 *       - in: query
 *         name: expired
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Incluir cupones expirados
 *     responses:
 *       200:
 *         description: Cupones obtenidos con éxito
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.get('/coupons', authMiddleware, pointsController.getUserCoupons);

/**
 * @swagger
 * /api/points/coupons/transfer:
 *   post:
 *     summary: Transfiere un cupón a otro usuario
 *     tags: [Points]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - couponId
 *               - toUserId
 *             properties:
 *               couponId:
 *                 type: string
 *               toUserId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cupón transferido con éxito
 *       400:
 *         description: Datos inválidos o cupón no transferible
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.post('/coupons/transfer', authMiddleware, pointsController.transferCoupon);

/**
 * @swagger
 * /api/points/coupons/use:
 *   post:
 *     summary: Usa un cupón
 *     tags: [Points]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - couponId
 *             properties:
 *               couponId:
 *                 type: string
 *               usedFor:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cupón utilizado con éxito
 *       400:
 *         description: Datos inválidos o cupón no disponible
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.post('/coupons/use', authMiddleware, pointsController.useCoupon);

/**
 * @swagger
 * /api/points/coupons/validate/{code}:
 *   get:
 *     summary: Valida un código de cupón
 *     tags: [Points]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Código del cupón
 *     responses:
 *       200:
 *         description: Resultado de la validación
 *       400:
 *         description: Código inválido
 *       500:
 *         description: Error del servidor
 */
router.get('/coupons/validate/:code', pointsController.validateCoupon);

/**
 * @swagger
 * /api/points/packages:
 *   get:
 *     summary: Obtiene los paquetes de cupones disponibles
 *     tags: [Points]
 *     responses:
 *       200:
 *         description: Paquetes obtenidos con éxito
 *       500:
 *         description: Error del servidor
 */
router.get('/packages', pointsController.getCouponPackages);

module.exports = router;