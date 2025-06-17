const express = require('express');
const router = express.Router();

// Middleware
const { authenticate } = require('../middleware/auth');
const { paymentLimiter } = require('../middleware/rateLimiter');
const { 
  validateBoostPayment,
  validatePointsPayment,
  validatePremiumPayment,
  validateVerificationPayment // ✅ NUEVO
} = require('../middleware/validation');

// Controllers - ✅ AGREGADAS FUNCIONES FALTANTES
const {
  getBoostPricing,
  getVerificationPricing, // ✅ NUEVO
  createBoostPaymentIntent,
  createVerificationPaymentIntent, // ✅ NUEVO
  confirmBoostPayment,
  confirmVerificationPayment, // ✅ NUEVO
  createPointsPaymentIntent,
  confirmPointsPayment,
  createPremiumPaymentIntent,
  confirmPremiumPayment,
  getPaymentHistory,
  handleStripeWebhook
} = require('../controllers/paymentController');

/**
 * @swagger
 * components:
 *   schemas:
 *     BoostPricing:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "cm123boost456"
 *         type:
 *           type: string
 *           enum: [BASIC, PREMIUM, FEATURED, SUPER, MEGA]
 *           example: "PREMIUM"
 *         duration:
 *           type: integer
 *           example: 48
 *         price:
 *           type: number
 *           example: 19.99
 *         multiplier:
 *           type: number
 *           example: 1.5
 *         features:
 *           type: object
 *           example: {}
 *         maxBoosts:
 *           type: integer
 *           nullable: true
 *           example: 3
 *     
 *     VerificationPricing:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "cm123verify456"
 *         name:
 *           type: string
 *           example: "Premium Verification"
 *         cost:
 *           type: number
 *           example: 49.99
 *         description:
 *           type: string
 *           example: "Verificación premium con beneficios adicionales"
 *         features:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Badge verificado", "Prioridad en búsquedas", "Soporte premium"]
 *         duration:
 *           type: integer
 *           nullable: true
 *           example: 365
 *           description: "Duración en días (null = permanente)"
 *         isActive:
 *           type: boolean
 *           example: true
 *     
 *     PaymentIntent:
 *       type: object
 *       properties:
 *         clientSecret:
 *           type: string
 *           example: "pi_1234567890_secret_abcdef"
 *         paymentId:
 *           type: string
 *           example: "cm123payment456"
 *         amount:
 *           type: number
 *           example: 19.99
 *     
 *     BoostPaymentRequest:
 *       type: object
 *       required:
 *         - postId
 *         - pricingId
 *       properties:
 *         postId:
 *           type: string
 *           example: "cm123post456"
 *         pricingId:
 *           type: string
 *           example: "cm123pricing789"
 *     
 *     VerificationPaymentRequest:
 *       type: object
 *       required:
 *         - escortId
 *         - pricingId
 *       properties:
 *         escortId:
 *           type: string
 *           example: "cm123escort456"
 *         pricingId:
 *           type: string
 *           example: "cm123verify789"
 *     
 *     PointsPaymentRequest:
 *       type: object
 *       required:
 *         - pointsPackage
 *       properties:
 *         pointsPackage:
 *           type: string
 *           enum: [small, medium, large, premium]
 *           example: "medium"
 *     
 *     PremiumPaymentRequest:
 *       type: object
 *       required:
 *         - tier
 *         - duration
 *       properties:
 *         tier:
 *           type: string
 *           enum: [PREMIUM, VIP]
 *           example: "PREMIUM"
 *         duration:
 *           type: integer
 *           enum: [1, 3, 6, 12]
 *           example: 3
 *     
 *     Payment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "cm123payment456"
 *         amount:
 *           type: number
 *           example: 19.99
 *         currency:
 *           type: string
 *           example: "USD"
 *         status:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, REFUNDED, CANCELLED, DISPUTED, PROCESSING]
 *           example: "COMPLETED"
 *         type:
 *           type: string
 *           enum: [BOOST, PREMIUM, POINTS, VERIFICATION, SUBSCRIPTION, TIP, COMMISSION]
 *           example: "BOOST"
 *         description:
 *           type: string
 *           example: "Boost PREMIUM - 48h"
 *         createdAt:
 *           type: string
 *           format: date-time
 *         completedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 */

/**
 * @swagger
 * /api/payments/boost/pricing:
 *   get:
 *     summary: Obtener precios de boosts disponibles
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Precios de boosts obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BoostPricing'
 */
router.get('/boost/pricing', getBoostPricing);

/**
 * @swagger
 * /api/payments/verification/pricing:
 *   get:
 *     summary: Obtener precios de verificación disponibles
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Precios de verificación obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VerificationPricing'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/verification/pricing', authenticate, getVerificationPricing);

/**
 * @swagger
 * /api/payments/boost/create-intent:
 *   post:
 *     summary: Crear intención de pago para boost
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BoostPaymentRequest'
 *     responses:
 *       200:
 *         description: Intención de pago creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/PaymentIntent'
 *                     - type: object
 *                       properties:
 *                         boostType:
 *                           type: string
 *                           example: "PREMIUM"
 *                         duration:
 *                           type: integer
 *                           example: 48
 *       400:
 *         description: Post no encontrado o datos inválidos
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Post o pricing no encontrado
 *       429:
 *         description: Límite diario de boosts alcanzado
 */
router.post('/boost/create-intent', 
  authenticate, 
  paymentLimiter, 
  validateBoostPayment, 
  createBoostPaymentIntent
);

/**
 * @swagger
 * /api/payments/verification/create-intent:
 *   post:
 *     summary: Crear intención de pago para verificación (agencias)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerificationPaymentRequest'
 *     responses:
 *       200:
 *         description: Intención de pago para verificación creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/PaymentIntent'
 *                     - type: object
 *                       properties:
 *                         verificationType:
 *                           type: string
 *                           example: "Premium Verification"
 *                         escort:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             name:
 *                               type: string
 *       400:
 *         description: Datos inválidos o escort ya verificado
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Solo agencias pueden pagar verificaciones
 *       404:
 *         description: Escort no es miembro activo o pricing no encontrado
 *       409:
 *         description: Ya existe una verificación para este escort
 */
router.post('/verification/create-intent', 
  authenticate, 
  paymentLimiter, 
  validateVerificationPayment, 
  createVerificationPaymentIntent
);

/**
 * @swagger
 * /api/payments/boost/confirm/{paymentId}:
 *   post:
 *     summary: Confirmar pago de boost
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del pago a confirmar
 *     responses:
 *       200:
 *         description: Boost activado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Boost activado exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     boost:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         type:
 *                           type: string
 *                         duration:
 *                           type: integer
 *                         expiresAt:
 *                           type: string
 *                           format: date-time
 *                         multiplier:
 *                           type: number
 *                     post:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         title:
 *                           type: string
 *                         isFeatured:
 *                           type: boolean
 *       400:
 *         description: Pago no completado
 *       404:
 *         description: Pago no encontrado
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/boost/confirm/:paymentId', authenticate, confirmBoostPayment);

/**
 * @swagger
 * /api/payments/verification/confirm/{paymentId}:
 *   post:
 *     summary: Confirmar pago de verificación
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del pago de verificación a confirmar
 *     responses:
 *       200:
 *         description: Verificación completada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Verificación completada exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     verification:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         status:
 *                           type: string
 *                           example: "COMPLETED"
 *                         completedAt:
 *                           type: string
 *                           format: date-time
 *                         pricing:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                             cost:
 *                               type: number
 *                             features:
 *                               type: array
 *                               items:
 *                                 type: string
 *                         escort:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             name:
 *                               type: string
 *                             isVerified:
 *                               type: boolean
 *                               example: true
 *       400:
 *         description: Pago no completado
 *       403:
 *         description: Solo agencias pueden confirmar pagos de verificación
 *       404:
 *         description: Pago no encontrado
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/verification/confirm/:paymentId', authenticate, confirmVerificationPayment);

/**
 * @swagger
 * /api/payments/points/create-intent:
 *   post:
 *     summary: Crear intención de pago para puntos
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PointsPaymentRequest'
 *     responses:
 *       200:
 *         description: Intención de pago creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/PaymentIntent'
 *                     - type: object
 *                       properties:
 *                         package:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                               example: "medium"
 *                             basePoints:
 *                               type: integer
 *                               example: 500
 *                             bonusPoints:
 *                               type: integer
 *                               example: 50
 *                             totalPoints:
 *                               type: integer
 *                               example: 550
 *                             price:
 *                               type: number
 *                               example: 39.99
 *       400:
 *         description: Paquete de puntos inválido
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Solo clientes pueden comprar puntos
 */
router.post('/points/create-intent', 
  authenticate, 
  paymentLimiter, 
  validatePointsPayment, 
  createPointsPaymentIntent
);

/**
 * @swagger
 * /api/payments/points/confirm/{paymentId}:
 *   post:
 *     summary: Confirmar pago de puntos
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del pago a confirmar
 *     responses:
 *       200:
 *         description: Puntos agregados exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Puntos agregados exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     pointsAdded:
 *                       type: integer
 *                       example: 550
 *                     newBalance:
 *                       type: integer
 *                       example: 610
 *                     transaction:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         amount:
 *                           type: number
 *                         package:
 *                           type: string
 *       400:
 *         description: Pago no completado
 *       404:
 *         description: Pago no encontrado
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Solo clientes pueden confirmar pagos de puntos
 */
router.post('/points/confirm/:paymentId', authenticate, confirmPointsPayment);

/**
 * @swagger
 * /api/payments/premium/create-intent:
 *   post:
 *     summary: Crear intención de pago para premium
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PremiumPaymentRequest'
 *     responses:
 *       200:
 *         description: Intención de pago creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/PaymentIntent'
 *                     - type: object
 *                       properties:
 *                         tier:
 *                           type: string
 *                           example: "PREMIUM"
 *                         duration:
 *                           type: integer
 *                           example: 3
 *                         price:
 *                           type: number
 *                           example: 49.99
 *                         type:
 *                           type: string
 *                           enum: [new_subscription, extension]
 *                           example: "new_subscription"
 *       400:
 *         description: Plan premium inválido
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Solo clientes pueden comprar premium
 */
router.post('/premium/create-intent', 
  authenticate, 
  paymentLimiter, 
  validatePremiumPayment, 
  createPremiumPaymentIntent
);

/**
 * @swagger
 * /api/payments/premium/confirm/{paymentId}:
 *   post:
 *     summary: Confirmar pago premium
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del pago a confirmar
 *     responses:
 *       200:
 *         description: Suscripción premium activada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Suscripción PREMIUM activada exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     tier:
 *                       type: string
 *                       example: "PREMIUM"
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                     benefits:
 *                       type: object
 *                       properties:
 *                         dailyMessageLimit:
 *                           type: integer
 *                         canViewPhoneNumbers:
 *                           type: boolean
 *                         canSendImages:
 *                           type: boolean
 *                         canSendVoiceMessages:
 *                           type: boolean
 *                         canAccessPremiumProfiles:
 *                           type: boolean
 *                         prioritySupport:
 *                           type: boolean
 *                         canSeeOnlineStatus:
 *                           type: boolean
 *                     transaction:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         amount:
 *                           type: number
 *                         duration:
 *                           type: integer
 *       400:
 *         description: Pago no completado
 *       404:
 *         description: Pago no encontrado
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Solo clientes pueden confirmar pagos premium
 */
router.post('/premium/confirm/:paymentId', authenticate, confirmPremiumPayment);

/**
 * @swagger
 * /api/payments/history:
 *   get:
 *     summary: Obtener historial de pagos
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
 *           default: 20
 *           maximum: 100
 *         description: Elementos por página
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [BOOST, PREMIUM, POINTS, VERIFICATION, SUBSCRIPTION, TIP, COMMISSION]
 *         description: Filtrar por tipo de pago
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, REFUNDED, CANCELLED, DISPUTED, PROCESSING]
 *         description: Filtrar por estado del pago
 *     responses:
 *       200:
 *         description: Historial de pagos obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     payments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Payment'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                     filters:
 *                       type: object
 *                       properties:
 *                         type:
 *                           type: string
 *                           nullable: true
 *                         status:
 *                           type: string
 *                           nullable: true
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Solo clientes pueden ver historial de pagos
 */
router.get('/history', authenticate, getPaymentHistory);

/**
 * @swagger
 * /api/payments/webhook/stripe:
 *   post:
 *     summary: Webhook de Stripe para procesar eventos
 *     tags: [Payments]
 *     description: Endpoint interno para webhooks de Stripe. No requiere autenticación pero verifica la firma.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Evento de Stripe
 *     responses:
 *       200:
 *         description: Evento procesado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 received:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Error de verificación de firma o formato del webhook
 */
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

module.exports = router;