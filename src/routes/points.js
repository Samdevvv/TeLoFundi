/**
 * ====================================================================
 * 🛣️ POINTS ROUTES - RUTAS SISTEMA TELOPOINTS
 * ====================================================================
 * Define todas las rutas para el sistema de puntos
 */

const express = require('express');
const router = express.Router();

// Importar controladores
const pointsController = require('../controllers/pointsController');

// Importar middleware - ✅ CORREGIDO: Agregar requireRole
const { authenticate, requireRole } = require('../middleware/auth');
const {
  validatePointsSpend,
  validatePointsPurchase,
  validatePremiumActivation,
  validateAdminPointsAdjustment,
  validatePagination,
  validateUser
} = require('../middleware/validation');

// Importar rate limiting
const rateLimit = require('express-rate-limit');

/**
 * @swagger
 * components:
 *   schemas:
 *     PointsBalance:
 *       type: object
 *       properties:
 *         currentBalance:
 *           type: integer
 *           description: Balance actual de puntos
 *           example: 150
 *         totalEarned:
 *           type: integer
 *           description: Total de puntos ganados
 *           example: 500
 *         totalSpent:
 *           type: integer
 *           description: Total de puntos gastados
 *           example: 350
 *         dailyStreak:
 *           type: integer
 *           description: Días consecutivos de login
 *           example: 7
 *         premium:
 *           type: object
 *           properties:
 *             isActive:
 *               type: boolean
 *               example: false
 *             tier:
 *               type: string
 *               enum: [BASIC, PREMIUM, VIP]
 *               example: "BASIC"
 *             expiresAt:
 *               type: string
 *               format: date-time
 *               nullable: true
 *         dailyLogin:
 *           type: object
 *           properties:
 *             eligible:
 *               type: boolean
 *               example: true
 *             nextClaimAt:
 *               type: string
 *               format: date-time
 *               nullable: true
 *             streak:
 *               type: integer
 *               example: 7
 *             bonusMultiplier:
 *               type: number
 *               example: 1.5
 *     
 *     PointsTransaction:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "clxxx123"
 *         amount:
 *           type: integer
 *           description: Cantidad de puntos (positivo o negativo)
 *           example: 25
 *         type:
 *           type: string
 *           enum: [DAILY_LOGIN, PURCHASE, SPEND, BONUS_POINTS, ADMIN_ADJUSTMENT, PREMIUM_DAY]
 *           example: "DAILY_LOGIN"
 *         description:
 *           type: string
 *           example: "Login diario - Día 7 de racha"
 *         balanceBefore:
 *           type: integer
 *           example: 125
 *         balanceAfter:
 *           type: integer
 *           example: 150
 *         createdAt:
 *           type: string
 *           format: date-time
 *         metadata:
 *           type: object
 *           additionalProperties: true
 *     
 *     PointsPackage:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "pkg_basic"
 *         name:
 *           type: string
 *           example: "Paquete Básico"
 *         points:
 *           type: integer
 *           example: 100
 *         bonus:
 *           type: integer
 *           example: 20
 *         totalPoints:
 *           type: integer
 *           example: 120
 *         price:
 *           type: number
 *           example: 4.99
 *         isPopular:
 *           type: boolean
 *           example: false
 *         pricePerPoint:
 *           type: string
 *           example: "0.042"
 *     
 *     PointsAction:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "premium_vip"
 *         name:
 *           type: string
 *           example: "Premium VIP (1 día)"
 *         description:
 *           type: string
 *           example: "Activar VIP por 24 horas"
 *         cost:
 *           type: integer
 *           example: 50
 *         available:
 *           type: boolean
 *           example: true
 *         duration:
 *           type: string
 *           example: "24 horas"
 *           nullable: true
 *         type:
 *           type: string
 *           example: "per_use"
 *           nullable: true
 *   
 *   tags:
 *     - name: Points
 *       description: Sistema de puntos TeloPoints
 */

// ============================================================================
// CONFIGURACIÓN DE RATE LIMITING
// ============================================================================

// Rate limiting para acciones sensibles
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 requests por ventana
  message: {
    success: false,
    error: 'Demasiadas solicitudes. Intenta nuevamente en 15 minutos.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting para compras
const purchaseLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // máximo 5 compras por hora
  message: {
    success: false,
    error: 'Límite de compras por hora alcanzado. Intenta más tarde.',
    code: 'PURCHASE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting para login diario
const dailyLoginLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 horas
  max: 3, // máximo 3 intentos por día
  message: {
    success: false,
    error: 'Límite de intentos de login diario alcanzado.',
    code: 'DAILY_LOGIN_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================================================
// MIDDLEWARE COMÚN PARA TODAS LAS RUTAS
// ============================================================================

// Aplicar autenticación y validación de usuario a todas las rutas
router.use(authenticate);
router.use(validateUser);

// ============================================================================
// 💰 RUTAS DE BALANCE Y ESTADÍSTICAS
// ============================================================================

/**
 * @swagger
 * /api/points/balance:
 *   get:
 *     summary: Obtener balance actual de puntos
 *     description: Obtiene el balance actual de puntos del cliente junto con estadísticas completas
 *     tags: [Points]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Balance obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/PointsBalance'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       403:
 *         description: Solo clientes pueden acceder
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Esta función es solo para clientes"
 *                 code:
 *                   type: string
 *                   example: "CLIENT_ONLY"
 */
router.get('/balance', pointsController.getPointsBalance);

/**
 * @swagger
 * /api/points/history:
 *   get:
 *     summary: Obtener historial de transacciones de puntos
 *     description: Obtiene el historial paginado de transacciones de puntos del cliente
 *     tags: [Points]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Elementos por página
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [DAILY_LOGIN, PURCHASE, SPEND, BONUS_POINTS, ADMIN_ADJUSTMENT, PREMIUM_DAY]
 *         description: Filtrar por tipo de transacción
 *     responses:
 *       200:
 *         description: Historial obtenido exitosamente
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
 *                     history:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PointsTransaction'
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
 *       403:
 *         description: Solo clientes pueden acceder
 */
router.get('/history', validatePagination, pointsController.getPointsHistory);

/**
 * @swagger
 * /api/points/config:
 *   get:
 *     summary: Obtener configuración del sistema de puntos
 *     description: Obtiene la configuración pública del sistema de puntos
 *     tags: [Points]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuración obtenida exitosamente
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
 *                     dailyLogin:
 *                       type: object
 *                       properties:
 *                         basePoints:
 *                           type: integer
 *                           example: 5
 *                         maxStreak:
 *                           type: integer
 *                           example: 30
 *                         bonusThreshold:
 *                           type: integer
 *                           example: 7
 *                         bonusMultiplier:
 *                           type: number
 *                           example: 1.5
 *                     actions:
 *                       type: object
 *                       additionalProperties: true
 *                     tiers:
 *                       type: object
 *                       additionalProperties: true
 *                     currency:
 *                       type: string
 *                       example: "USD"
 *                     minimumBalance:
 *                       type: integer
 *                       example: 1
 */
router.get('/config', pointsController.getPointsConfig);

// ============================================================================
// 📦 RUTAS DE PAQUETES Y COMPRAS
// ============================================================================

/**
 * @swagger
 * /api/points/packages:
 *   get:
 *     summary: Obtener paquetes de puntos disponibles
 *     description: Obtiene todos los paquetes de puntos disponibles para comprar
 *     tags: [Points]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Paquetes obtenidos exitosamente
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
 *                     packages:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PointsPackage'
 *                     currency:
 *                       type: string
 *                       example: "USD"
 *                     paymentMethods:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["card", "paypal"]
 */
router.get('/packages', pointsController.getPointsPackages);

/**
 * @swagger
 * /api/points/purchase:
 *   post:
 *     summary: Iniciar compra de puntos
 *     description: Crea un PaymentIntent para la compra de un paquete de puntos
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
 *               - packageId
 *             properties:
 *               packageId:
 *                 type: string
 *                 description: ID del paquete de puntos a comprar
 *                 example: "pkg_basic"
 *     responses:
 *       200:
 *         description: Compra iniciada exitosamente
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
 *                   example: "Compra de puntos iniciada"
 *                 data:
 *                   type: object
 *                   properties:
 *                     clientSecret:
 *                       type: string
 *                       description: Client secret de Stripe para completar el pago
 *                     paymentId:
 *                       type: string
 *                       description: ID del pago creado
 *                     package:
 *                       $ref: '#/components/schemas/PointsPackage'
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: Solo clientes pueden comprar puntos
 *       429:
 *         description: Límite de compras excedido
 */
router.post('/purchase', 
  purchaseLimiter,
  validatePointsPurchase,
  pointsController.purchasePoints
);

/**
 * @swagger
 * /api/points/purchase/{id}:
 *   put:
 *     summary: Confirmar compra de puntos
 *     description: Confirma manualmente una compra de puntos (webhook alternativo)
 *     tags: [Points]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del pago a confirmar
 *     responses:
 *       200:
 *         description: Compra confirmada exitosamente
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
 *                   example: "Compra de puntos confirmada"
 *                 data:
 *                   type: object
 *                   properties:
 *                     pointsAdded:
 *                       type: integer
 *                       example: 120
 *                     newBalance:
 *                       type: integer
 *                       example: 270
 *       404:
 *         description: Pago no encontrado
 *       403:
 *         description: Solo clientes pueden confirmar compras
 */
router.put('/purchase/:id',
  strictLimiter,
  pointsController.confirmPointsPurchase
);

// ============================================================================
// 🎁 RUTAS DE LOGIN DIARIO Y RACHA
// ============================================================================

/**
 * @swagger
 * /api/points/daily-status:
 *   get:
 *     summary: Verificar estado del login diario
 *     description: Verifica si el cliente puede reclamar puntos diarios y obtiene información de la racha
 *     tags: [Points]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estado obtenido exitosamente
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
 *                     eligible:
 *                       type: boolean
 *                       example: true
 *                     nextClaimAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     hoursSinceLastClaim:
 *                       type: integer
 *                       example: 22
 *                       nullable: true
 *                     currentStreak:
 *                       type: integer
 *                       example: 6
 *                     bonusMultiplier:
 *                       type: number
 *                       example: 1.0
 *                     basePoints:
 *                       type: integer
 *                       example: 5
 *                     estimatedPoints:
 *                       type: integer
 *                       example: 5
 *       403:
 *         description: Solo clientes pueden reclamar puntos diarios
 */
router.get('/daily-status', pointsController.getDailyLoginStatus);

/**
 * @swagger
 * /api/points/daily-login:
 *   post:
 *     summary: Reclamar puntos diarios
 *     description: Reclama los puntos diarios del cliente y actualiza la racha
 *     tags: [Points]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Puntos diarios reclamados exitosamente
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
 *                   example: "¡Has ganado 7 puntos!"
 *                 data:
 *                   type: object
 *                   properties:
 *                     pointsEarned:
 *                       type: integer
 *                       example: 7
 *                     streakDay:
 *                       type: integer
 *                       example: 7
 *                     basePoints:
 *                       type: integer
 *                       example: 5
 *                     streakMultiplier:
 *                       type: number
 *                       example: 1.5
 *                     newBalance:
 *                       type: integer
 *                       example: 157
 *                     nextEligibleAt:
 *                       type: string
 *                       format: date-time
 *                     isStreakBonus:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: No elegible para reclamar aún
 *       403:
 *         description: Solo clientes pueden reclamar puntos diarios
 *       429:
 *         description: Límite de intentos de login diario alcanzado
 */
router.post('/daily-login',
  dailyLoginLimiter,
  pointsController.claimDailyPoints
);

/**
 * @swagger
 * /api/points/streak:
 *   get:
 *     summary: Obtener información detallada de la racha
 *     description: Obtiene información completa sobre la racha de login diario del cliente
 *     tags: [Points]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Información de racha obtenida exitosamente
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
 *                     currentStreak:
 *                       type: integer
 *                       example: 7
 *                     totalDailyEarned:
 *                       type: integer
 *                       example: 85
 *                     canClaim:
 *                       type: boolean
 *                       example: false
 *                     nextClaimAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     bonusMultiplier:
 *                       type: number
 *                       example: 1.5
 *                     milestones:
 *                       type: object
 *                       properties:
 *                         next:
 *                           type: integer
 *                           example: 15
 *                           nullable: true
 *                         rewards:
 *                           type: object
 *                           additionalProperties:
 *                             type: string
 *                     config:
 *                       type: object
 *                       properties:
 *                         basePoints:
 *                           type: integer
 *                           example: 5
 *                         maxStreak:
 *                           type: integer
 *                           example: 30
 *                         bonusThreshold:
 *                           type: integer
 *                           example: 7
 *       403:
 *         description: Solo clientes tienen racha de puntos
 */
router.get('/streak', pointsController.getStreakInfo);

// ============================================================================
// 💸 RUTAS DE USO DE PUNTOS
// ============================================================================

/**
 * @swagger
 * /api/points/actions:
 *   get:
 *     summary: Obtener acciones disponibles con puntos
 *     description: Obtiene todas las acciones que se pueden realizar con puntos
 *     tags: [Points]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Acciones obtenidas exitosamente
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
 *                     currentPoints:
 *                       type: integer
 *                       example: 150
 *                     actions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PointsAction'
 *                     premiumStatus:
 *                       type: object
 *                       properties:
 *                         isActive:
 *                           type: boolean
 *                           example: false
 *                         tier:
 *                           type: string
 *                           example: "BASIC"
 *       403:
 *         description: Solo clientes pueden usar puntos
 */
router.get('/actions', pointsController.getAvailableActions);

/**
 * @swagger
 * /api/points/spend:
 *   post:
 *     summary: Usar puntos para una acción específica
 *     description: Gasta puntos del cliente para realizar una acción específica
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
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [phone_access, image_message, extra_favorite, profile_boost, chat_priority]
 *                 description: Tipo de acción a realizar
 *                 example: "phone_access"
 *               targetData:
 *                 type: object
 *                 description: Datos adicionales para la acción (opcional)
 *                 additionalProperties: true
 *                 example: {}
 *     responses:
 *       200:
 *         description: Puntos gastados exitosamente
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
 *                   example: "Puntos utilizados exitosamente para: Acceso a teléfono"
 *                 data:
 *                   type: object
 *                   properties:
 *                     action:
 *                       type: string
 *                       example: "phone_access"
 *                     pointsSpent:
 *                       type: integer
 *                       example: 8
 *                     newBalance:
 *                       type: integer
 *                       example: 142
 *                     description:
 *                       type: string
 *                       example: "Acceso a teléfono"
 *       400:
 *         description: Datos inválidos o puntos insuficientes
 *       403:
 *         description: Acción no permitida o solo clientes pueden usar puntos
 *       429:
 *         description: Demasiadas solicitudes
 */
router.post('/spend',
  strictLimiter,
  validatePointsSpend,
  pointsController.spendPoints
);

/**
 * @swagger
 * /api/points/premium:
 *   post:
 *     summary: Activar premium temporal con puntos
 *     description: Activa un tier premium temporal usando puntos del cliente
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
 *               - tier
 *             properties:
 *               tier:
 *                 type: string
 *                 enum: [PREMIUM, VIP]
 *                 description: Tier premium a activar
 *                 example: "PREMIUM"
 *               duration:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 168
 *                 default: 24
 *                 description: Duración en horas
 *                 example: 24
 *     responses:
 *       200:
 *         description: Premium activado exitosamente
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
 *                   example: "¡PREMIUM activado exitosamente!"
 *                 data:
 *                   type: object
 *                   properties:
 *                     tier:
 *                       type: string
 *                       example: "PREMIUM"
 *                     duration:
 *                       type: integer
 *                       example: 24
 *                     pointsCost:
 *                       type: integer
 *                       example: 25
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                     benefits:
 *                       type: object
 *                       additionalProperties: true
 *                     newBalance:
 *                       type: integer
 *                       example: 125
 *       400:
 *         description: Tier inválido o puntos insuficientes
 *       403:
 *         description: Solo clientes pueden activar premium
 *       429:
 *         description: Demasiadas solicitudes
 */
router.post('/premium',
  strictLimiter,
  validatePremiumActivation,
  pointsController.activatePremiumWithPoints
);

// ============================================================================
// 🛠️ RUTAS ADMINISTRATIVAS - ✅ CORREGIDAS
// ============================================================================

/**
 * @swagger
 * /api/points/admin/adjust:
 *   post:
 *     summary: Ajustar puntos manualmente (solo admins)
 *     description: Permite a los administradores ajustar manualmente los puntos de un cliente
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
 *               - clientId
 *               - amount
 *               - reason
 *             properties:
 *               clientId:
 *                 type: string
 *                 description: ID del cliente
 *                 example: "clxxx123"
 *               amount:
 *                 type: integer
 *                 description: Cantidad a ajustar (positivo para agregar, negativo para quitar)
 *                 example: 50
 *               reason:
 *                 type: string
 *                 description: Razón del ajuste
 *                 example: "Compensación por error del sistema"
 *     responses:
 *       200:
 *         description: Puntos ajustados exitosamente
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
 *                   example: "Puntos ajustados exitosamente: +50"
 *                 data:
 *                   type: object
 *                   properties:
 *                     adjustment:
 *                       type: integer
 *                       example: 50
 *                     newBalance:
 *                       type: integer
 *                       example: 200
 *                     reason:
 *                       type: string
 *                       example: "Compensación por error del sistema"
 *                     client:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: "clxxx123"
 *                         username:
 *                           type: string
 *                           example: "usuario123"
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: Solo administradores pueden ajustar puntos
 *       404:
 *         description: Cliente no encontrado
 */
router.post('/admin/adjust',
  requireRole('ADMIN'), // ✅ CORREGIDO: Ahora requireRole está exportado
  strictLimiter,
  validateAdminPointsAdjustment,
  pointsController.adminAdjustPoints
);

/**
 * @swagger
 * /api/points/admin/stats:
 *   get:
 *     summary: Estadísticas del sistema de puntos (solo admins)
 *     description: Obtiene estadísticas completas del sistema de puntos para administradores
 *     tags: [Points]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: "30d"
 *         description: Marco temporal para las estadísticas
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
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
 *                     timeframe:
 *                       type: string
 *                       example: "30d"
 *                     overview:
 *                       type: object
 *                       properties:
 *                         totalClientsWithPoints:
 *                           type: integer
 *                           example: 1250
 *                         averageBalance:
 *                           type: integer
 *                           example: 75
 *                         averageStreak:
 *                           type: integer
 *                           example: 5
 *                         maxStreak:
 *                           type: integer
 *                           example: 28
 *                     points:
 *                       type: object
 *                       properties:
 *                         totalDistributed:
 *                           type: integer
 *                           example: 45000
 *                         totalSpent:
 *                           type: integer
 *                           example: 32000
 *                         totalPurchased:
 *                           type: integer
 *                           example: 15000
 *                     revenue:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                           example: 1250.75
 *                         pointsSales:
 *                           type: number
 *                           example: 650.25
 *                     topSpenders:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           username:
 *                             type: string
 *                             example: "usuario123"
 *                           name:
 *                             type: string
 *                             example: "Juan"
 *                           totalSpent:
 *                             type: integer
 *                             example: 450
 *                           currentBalance:
 *                             type: integer
 *                             example: 125
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *       403:
 *         description: Solo administradores pueden ver estadísticas
 */
router.get('/admin/stats',
  requireRole('ADMIN'), // ✅ CORREGIDO: Ahora requireRole está exportado
  validatePagination,
  pointsController.getPointsSystemStats
);

// ============================================================================
// MIDDLEWARE DE MANEJO DE ERRORES ESPECÍFICO
// ============================================================================

// Manejo de errores específicos para rutas de puntos
router.use((error, req, res, next) => {
  // Log del error con contexto específico de puntos
  console.error('❌ Error en rutas de puntos:', {
    error: error.message,
    route: req.route?.path,
    method: req.method,
    userId: req.user?.id,
    userType: req.user?.userType,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Errores específicos del sistema de puntos
  if (error.code === 'INSUFFICIENT_POINTS') {
    return res.status(400).json({
      success: false,
      error: 'Puntos insuficientes',
      code: 'INSUFFICIENT_POINTS',
      data: {
        required: error.required,
        available: error.available,
        canPurchase: true
      }
    });
  }

  if (error.code === 'DAILY_LOGIN_ALREADY_CLAIMED') {
    return res.status(400).json({
      success: false,
      error: 'Ya reclamaste tus puntos diarios',
      code: 'DAILY_LOGIN_ALREADY_CLAIMED',
      data: {
        nextClaimAt: error.nextClaimAt
      }
    });
  }

  if (error.code === 'PREMIUM_ALREADY_ACTIVE') {
    return res.status(400).json({
      success: false,
      error: 'Ya tienes premium activo',
      code: 'PREMIUM_ALREADY_ACTIVE',
      data: {
        currentTier: error.currentTier,
        expiresAt: error.expiresAt
      }
    });
  }

  if (error.code === 'CLIENT_ONLY') {
    return res.status(403).json({
      success: false,
      error: 'Esta función es solo para clientes',
      code: 'CLIENT_ONLY'
    });
  }

  // Pasar otros errores al manejo global
  next(error);
});

module.exports = router;