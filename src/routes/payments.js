const express = require('express');
const router = express.Router();

// Middleware
const { authenticate } = require('../middleware/auth');
const { 
  validateBoostPayment,
  validatePointsPayment,
  validatePremiumPayment,
  validateVerificationPayment,
  validatePointsPurchase // ✅ AGREGADO para las nuevas rutas de puntos
} = require('../middleware/validation');

// Controllers - ✅ IMPORTACIÓN COMPLETA CON TODAS LAS FUNCIONES
const {
  getBoostPricing,
  getVerificationPricing,
  createAdditionalPostPaymentIntent,
  confirmAdditionalPostPayment,
  createBoostPaymentIntent,
  createVerificationPaymentIntent,
  confirmBoostPayment,
  confirmVerificationPayment,
  createPointsPaymentIntent,
  confirmPointsPayment,
  getPointsPurchaseHistory,      // ✅ AGREGADA
  handlePointsWebhook,           // ✅ AGREGADA
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
 *     AdditionalPostPaymentRequest:
 *       type: object
 *       required:
 *         - postData
 *       properties:
 *         postData:
 *           type: object
 *           required:
 *             - title
 *             - description
 *             - phone
 *           properties:
 *             title:
 *               type: string
 *               minLength: 3
 *               maxLength: 100
 *               example: "Hermosa escort en zona norte"
 *             description:
 *               type: string
 *               minLength: 10
 *               maxLength: 2000
 *               example: "Descripción detallada del servicio..."
 *             phone:
 *               type: string
 *               pattern: "^\\+?[1-9]\\d{7,14}$"
 *               example: "+1234567890"
 *             images:
 *               type: array
 *               items:
 *                 type: string
 *                 format: uri
 *               maxItems: 10
 *               example: ["https://example.com/image1.jpg"]
 *             locationId:
 *               type: string
 *               nullable: true
 *               example: "cm123location456"
 *             services:
 *               type: string
 *               maxLength: 1000
 *               example: "Masajes, compañía, etc."
 *             rates:
 *               type: object
 *               additionalProperties:
 *                 type: number
 *                 minimum: 0
 *               example: {"1h": 150, "2h": 280}
 *             availability:
 *               type: object
 *               example: {"monday": ["9:00-17:00"], "tuesday": ["10:00-18:00"]}
 *             premiumOnly:
 *               type: boolean
 *               default: false
 *             tags:
 *               type: array
 *               items:
 *                 type: string
 *               maxItems: 10
 *               example: ["vip", "outcall", "incall"]
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
 *         - packageId
 *       properties:
 *         packageId:
 *           type: string
 *           example: "cm123package456"
 *           description: "ID del paquete de puntos a comprar"
 *         paymentMethod:
 *           type: string
 *           enum: [card, paypal]
 *           example: "card"
 *         couponCode:
 *           type: string
 *           maxLength: 20
 *           example: "DISCOUNT10"
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
 *         paymentMethod:
 *           type: string
 *           enum: [stripe, points]
 *           default: "stripe"
 *           example: "stripe"
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
 *           enum: [BOOST, PREMIUM, POINTS, VERIFICATION, SUBSCRIPTION, TIP, COMMISSION, POST_ADDITIONAL]
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
 *     
 *     PointsPurchase:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "cm123purchase456"
 *         amount:
 *           type: number
 *           example: 39.99
 *         currency:
 *           type: string
 *           example: "USD"
 *         status:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, REFUNDED]
 *           example: "COMPLETED"
 *         description:
 *           type: string
 *           example: "Paquete Medium - 500 puntos + 50 bonus"
 *         packageName:
 *           type: string
 *           example: "Medium"
 *         totalPoints:
 *           type: integer
 *           example: 550
 *         basePoints:
 *           type: integer
 *           example: 500
 *         bonusPoints:
 *           type: integer
 *           example: 50
 *         createdAt:
 *           type: string
 *           format: date-time
 *         completedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 */

// ============================================================================
// 🎯 RUTAS DE PRICING (PÚBLICAS Y PRIVADAS)
// ============================================================================

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

// ============================================================================
// 📝 RUTAS PARA POSTS ADICIONALES (ESCORTS)
// ============================================================================

/**
 * @swagger
 * /api/payments/additional-post/create-intent:
 *   post:
 *     summary: Crear intención de pago para post adicional (escorts)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdditionalPostPaymentRequest'
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
 *                         postTitle:
 *                           type: string
 *                           example: "Hermosa escort en zona norte"
 *                         currentPosts:
 *                           type: integer
 *                           example: 4
 *                         postNumber:
 *                           type: integer
 *                           example: 5
 *                         description:
 *                           type: string
 *                           example: "Pago por post adicional #5"
 *       400:
 *         description: Error de validación o límites alcanzados
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Solo escorts pueden crear posts adicionales
 */
router.post('/additional-post/create-intent', 
  authenticate, 
  createAdditionalPostPaymentIntent
);

/**
 * @swagger
 * /api/payments/additional-post/confirm/{paymentId}:
 *   post:
 *     summary: Confirmar pago y crear post adicional
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
 *         description: Post adicional creado exitosamente
 *       400:
 *         description: Pago no completado o datos inválidos
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Solo escorts pueden confirmar pagos de posts
 *       404:
 *         description: Pago no encontrado
 */
router.post('/additional-post/confirm/:paymentId', authenticate, confirmAdditionalPostPayment);

// ============================================================================
// 🚀 RUTAS PARA BOOSTS
// ============================================================================

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
  validateBoostPayment, 
  createBoostPaymentIntent
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
 *       400:
 *         description: Pago no completado
 *       404:
 *         description: Pago no encontrado
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/boost/confirm/:paymentId', authenticate, confirmBoostPayment);

// ============================================================================
// ✅ RUTAS PARA VERIFICACIONES (AGENCIAS)
// ============================================================================

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
  validateVerificationPayment, 
  createVerificationPaymentIntent
);

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

// ============================================================================
// 💰 RUTAS PARA PUNTOS TELOFUNDI (CLIENTES)
// ============================================================================

/**
 * @swagger
 * /api/payments/points/create-intent:
 *   post:
 *     summary: Crear intención de pago para compra de puntos
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
 *                 message:
 *                   type: string
 *                   example: "PaymentIntent para puntos creado"
 *                 data:
 *                   type: object
 *                   properties:
 *                     clientSecret:
 *                       type: string
 *                       example: "pi_1234567890_secret_abcdef"
 *                     paymentId:
 *                       type: string
 *                       example: "cm123payment456"
 *                     package:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                           example: "Medium"
 *                         basePoints:
 *                           type: integer
 *                           example: 500
 *                         bonusPoints:
 *                           type: integer
 *                           example: 50
 *                         totalPoints:
 *                           type: integer
 *                           example: 550
 *                         price:
 *                           type: number
 *                           example: 39.99
 *       400:
 *         description: Paquete de puntos inválido
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Solo clientes pueden comprar puntos
 */
router.post('/points/create-intent', 
  authenticate, 
  validatePointsPurchase, 
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
 *                   example: "Compra de puntos confirmada exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     pointsAdded:
 *                       type: integer
 *                       example: 550
 *                     newBalance:
 *                       type: integer
 *                       example: 610
 *                     package:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         basePoints:
 *                           type: integer
 *                         bonusPoints:
 *                           type: integer
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
 * /api/payments/points/history:
 *   get:
 *     summary: Obtener historial de compras de puntos
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, REFUNDED]
 *         description: Filtrar por estado de la compra
 *     responses:
 *       200:
 *         description: Historial de compras obtenido exitosamente
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
 *                     purchases:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PointsPurchase'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 20
 *                         total:
 *                           type: integer
 *                           example: 15
 *                         pages:
 *                           type: integer
 *                           example: 1
 *                         hasNext:
 *                           type: boolean
 *                           example: false
 *                         hasPrev:
 *                           type: boolean
 *                           example: false
 *                     filters:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           nullable: true
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Solo clientes pueden ver historial de compras de puntos
 */
router.get('/points/history', authenticate, getPointsPurchaseHistory);

// ============================================================================
// ⭐ RUTAS PARA PREMIUM (CLIENTES)
// ============================================================================

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
 *       400:
 *         description: Plan premium inválido
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Solo clientes pueden comprar premium
 */
router.post('/premium/create-intent', 
  authenticate,
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

// ============================================================================
// 📊 RUTAS DE HISTORIAL Y ESTADÍSTICAS
// ============================================================================

/**
 * @swagger
 * /api/payments/history:
 *   get:
 *     summary: Obtener historial general de pagos
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
 *           enum: [BOOST, PREMIUM, POINTS, VERIFICATION, SUBSCRIPTION, TIP, COMMISSION, POST_ADDITIONAL]
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
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 20
 *                         total:
 *                           type: integer
 *                           example: 45
 *                         pages:
 *                           type: integer
 *                           example: 3
 *                         hasNext:
 *                           type: boolean
 *                           example: true
 *                         hasPrev:
 *                           type: boolean
 *                           example: false
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
 *         description: Tipo de usuario no válido para historial de pagos
 */
router.get('/history', authenticate, getPaymentHistory);

// ============================================================================
// 🔗 WEBHOOKS DE STRIPE
// ============================================================================

/**
 * @swagger
 * /api/payments/webhook/stripe:
 *   post:
 *     summary: Webhook general de Stripe para procesar eventos
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

/**
 * @swagger
 * /api/payments/webhook/points:
 *   post:
 *     summary: Webhook específico para puntos TeloFundi
 *     tags: [Payments]
 *     description: Endpoint interno para webhooks específicos de puntos. No requiere autenticación pero verifica la firma.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Evento de Stripe específico para puntos
 *     responses:
 *       200:
 *         description: Evento de puntos procesado exitosamente
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
 *       500:
 *         description: Error procesando webhook de puntos
 */
router.post('/webhook/points', express.raw({ type: 'application/json' }), handlePointsWebhook);

module.exports = router;