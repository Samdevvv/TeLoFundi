/**
 * ====================================================================
 * 🎯 POINTS CONTROLLER - ENDPOINTS SISTEMA TELOPOINTS
 * ====================================================================
 * Maneja todos los endpoints del sistema de puntos
 */

const { prisma } = require('../config/database');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const pointsService = require('../services/pointsService');
const paymentService = require('../services/paymentService');
const userService = require('../services/userService');
const logger = require('../utils/logger');

// ============================================================================
// 💰 OBTENER BALANCE Y ESTADÍSTICAS DE PUNTOS
// ============================================================================

/**
 * GET /api/points/balance
 * Obtener balance actual + estadísticas completas
 */
const getPointsBalance = catchAsync(async (req, res) => {
  const userId = req.user.id;

  // Verificar que es cliente
  if (req.user.userType !== 'CLIENT') {
    throw new AppError('Solo los clientes tienen puntos', 403, 'CLIENT_ONLY');
  }

  if (!req.user.client) {
    throw new AppError('Datos de cliente no encontrados', 500, 'CLIENT_DATA_MISSING');
  }

  const pointsData = await pointsService.getClientPoints(req.user.client.id);

  logger.info('Points balance retrieved', {
    userId,
    clientId: req.user.client.id,
    currentBalance: pointsData.currentBalance
  });

  res.status(200).json({
    success: true,
    data: pointsData,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// 📋 HISTORIAL DE PUNTOS CON PAGINACIÓN
// ============================================================================

/**
 * GET /api/points/history
 * Obtener historial paginado de transacciones
 */
const getPointsHistory = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 20, type } = req.query;

  // Verificar que es cliente
  if (req.user.userType !== 'CLIENT') {
    throw new AppError('Solo los clientes tienen historial de puntos', 403, 'CLIENT_ONLY');
  }

  if (!req.user.client) {
    throw new AppError('Datos de cliente no encontrados', 500, 'CLIENT_DATA_MISSING');
  }

  const pagination = {
    page: parseInt(page),
    limit: parseInt(limit),
    type
  };

  const result = await pointsService.getPointsHistory(req.user.client.id, pagination);

  logger.info('Points history retrieved', {
    userId,
    clientId: req.user.client.id,
    page: pagination.page,
    limit: pagination.limit,
    type,
    total: result.pagination.total
  });

  res.status(200).json({
    success: true,
    data: result,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// 📦 PAQUETES DISPONIBLES PARA COMPRAR
// ============================================================================

/**
 * GET /api/points/packages
 * Obtener todos los paquetes de puntos disponibles
 */
const getPointsPackages = catchAsync(async (req, res) => {
  const packages = await pointsService.getAvailablePackages();

  res.status(200).json({
    success: true,
    data: {
      packages,
      currency: 'USD',
      paymentMethods: ['card', 'paypal']
    },
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// 🎁 LOGIN DIARIO Y RACHA
// ============================================================================

/**
 * GET /api/points/daily-status
 * Verificar estado del login diario
 */
const getDailyLoginStatus = catchAsync(async (req, res) => {
  const userId = req.user.id;

  // Verificar que es cliente
  if (req.user.userType !== 'CLIENT') {
    throw new AppError('Solo los clientes pueden reclamar puntos diarios', 403, 'CLIENT_ONLY');
  }

  if (!req.user.client) {
    throw new AppError('Datos de cliente no encontrados', 500, 'CLIENT_DATA_MISSING');
  }

  const eligibility = await pointsService.checkDailyLoginEligibility(req.user.client.id);
  const pointsData = await pointsService.getClientPoints(req.user.client.id);

  res.status(200).json({
    success: true,
    data: {
      eligible: eligibility.eligible,
      nextClaimAt: eligibility.nextClaimAt,
      hoursSinceLastClaim: eligibility.hoursSinceLastClaim,
      currentStreak: pointsData.dailyLogin.streak,
      bonusMultiplier: pointsData.dailyLogin.bonusMultiplier,
      basePoints: pointsService.POINTS_CONFIG.DAILY_LOGIN_POINTS,
      estimatedPoints: Math.floor(
        pointsService.POINTS_CONFIG.DAILY_LOGIN_POINTS * 
        pointsData.dailyLogin.bonusMultiplier
      )
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/points/daily-login
 * Reclamar puntos diarios
 */
const claimDailyPoints = catchAsync(async (req, res) => {
  const userId = req.user.id;

  // Verificar que es cliente
  if (req.user.userType !== 'CLIENT') {
    throw new AppError('Solo los clientes pueden reclamar puntos diarios', 403, 'CLIENT_ONLY');
  }

  if (!req.user.client) {
    throw new AppError('Datos de cliente no encontrados', 500, 'CLIENT_DATA_MISSING');
  }

  const result = await pointsService.processDailyLogin(req.user.client.id);

  // Crear notificación
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: 'DAILY_POINTS_AVAILABLE',
        title: '¡Puntos diarios reclamados!',
        message: `Has ganado ${result.pointsEarned} puntos. Racha: ${result.streakDay} días`,
        data: {
          pointsEarned: result.pointsEarned,
          streakDay: result.streakDay,
          newBalance: result.newBalance,
          isStreakBonus: result.isStreakBonus
        }
      }
    });
  } catch (error) {
    logger.warn('Failed to create daily points notification:', error);
  }

  logger.info('Daily points claimed', {
    userId,
    clientId: req.user.client.id,
    pointsEarned: result.pointsEarned,
    streakDay: result.streakDay,
    newBalance: result.newBalance
  });

  res.status(200).json({
    success: true,
    message: `¡Has ganado ${result.pointsEarned} puntos!`,
    data: result,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// 💳 COMPRA DE PUNTOS
// ============================================================================

/**
 * POST /api/points/purchase
 * Iniciar compra de puntos (crear PaymentIntent)
 */
const purchasePoints = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { packageId } = req.body;

  // Verificar que es cliente
  if (req.user.userType !== 'CLIENT') {
    throw new AppError('Solo los clientes pueden comprar puntos', 403, 'CLIENT_ONLY');
  }

  if (!req.user.client) {
    throw new AppError('Datos de cliente no encontrados', 500, 'CLIENT_DATA_MISSING');
  }

  if (!packageId) {
    throw new AppError('ID del paquete es requerido', 400, 'MISSING_PACKAGE_ID');
  }

  // Validar compra usando el servicio de pagos
  await paymentService.validatePointsPurchase(req.user.client.id, packageId);

  // Crear PaymentIntent
  const result = await paymentService.createPointsPaymentIntent(req.user.client.id, packageId);

  logger.info('Points purchase initiated', {
    userId,
    clientId: req.user.client.id,
    packageId,
    totalPoints: result.totalPoints,
    amount: result.package.price
  });

  res.status(200).json({
    success: true,
    message: 'Compra de puntos iniciada',
    data: {
      clientSecret: result.paymentIntent.client_secret,
      paymentId: result.payment.id,
      package: {
        id: result.package.id,
        name: result.package.name,
        basePoints: result.package.points,
        bonusPoints: result.package.bonus,
        totalPoints: result.totalPoints,
        price: result.package.price
      }
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * PUT /api/points/purchase/:id
 * Confirmar compra de puntos (webhook alternativo)
 */
const confirmPointsPurchase = catchAsync(async (req, res) => {
  const { id: paymentId } = req.params;
  const userId = req.user.id;

  // Verificar que es cliente
  if (req.user.userType !== 'CLIENT') {
    throw new AppError('Solo los clientes pueden confirmar compras de puntos', 403, 'CLIENT_ONLY');
  }

  if (!req.user.client) {
    throw new AppError('Datos de cliente no encontrados', 500, 'CLIENT_DATA_MISSING');
  }

  // Buscar pago pendiente
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      clientId: req.user.client.id,
      status: 'PENDING',
      type: 'POINTS'
    }
  });

  if (!payment) {
    throw new AppError('Pago no encontrado o ya procesado', 404, 'PAYMENT_NOT_FOUND');
  }

  // Procesar usando el servicio de pagos
  const result = await paymentService.processStripePayment(payment.stripePaymentId);

  if (result.alreadyProcessed) {
    return res.status(200).json({
      success: true,
      message: 'Compra ya procesada',
      data: { alreadyProcessed: true },
      timestamp: new Date().toISOString()
    });
  }

  logger.info('Points purchase confirmed manually', {
    userId,
    paymentId,
    processingResult: result.processingResult
  });

  res.status(200).json({
    success: true,
    message: 'Compra de puntos confirmada',
    data: result.processingResult,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// 💸 GASTAR PUNTOS EN ACCIONES
// ============================================================================

/**
 * GET /api/points/actions
 * Obtener acciones disponibles con puntos
 */
const getAvailableActions = catchAsync(async (req, res) => {
  const userId = req.user.id;

  // Verificar que es cliente
  if (req.user.userType !== 'CLIENT') {
    throw new AppError('Solo los clientes pueden usar puntos', 403, 'CLIENT_ONLY');
  }

  if (!req.user.client) {
    throw new AppError('Datos de cliente no encontrados', 500, 'CLIENT_DATA_MISSING');
  }

  const actions = await pointsService.getAvailableActions(req.user.client.id);

  res.status(200).json({
    success: true,
    data: actions,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/points/spend
 * Usar puntos para una acción específica
 */
const spendPoints = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { action, targetData = {} } = req.body;

  // Verificar que es cliente
  if (req.user.userType !== 'CLIENT') {
    throw new AppError('Solo los clientes pueden usar puntos', 403, 'CLIENT_ONLY');
  }

  if (!req.user.client) {
    throw new AppError('Datos de cliente no encontrados', 500, 'CLIENT_DATA_MISSING');
  }

  if (!action) {
    throw new AppError('Acción es requerida', 400, 'MISSING_ACTION');
  }

  // Validar acción
  const validActions = [
    'phone_access', 'image_message', 'extra_favorite', 
    'profile_boost', 'chat_priority'
  ];

  if (!validActions.includes(action)) {
    throw new AppError('Acción no válida', 400, 'INVALID_ACTION');
  }

  // Verificar si puede realizar la acción
  const permission = await userService.canUserPerformAction(userId, action);
  if (!permission.allowed && !permission.canUsePoints) {
    throw new AppError(permission.reason, 403, 'ACTION_NOT_ALLOWED');
  }

  // Usar puntos para la acción
  const result = await userService.usePointsForAction(userId, action, targetData);

  // Crear notificación
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: 'PAYMENT_SUCCESS',
        title: 'Puntos utilizados',
        message: `Has usado ${result.pointsSpent} puntos para: ${result.description}`,
        data: {
          action: result.action,
          pointsSpent: result.pointsSpent,
          newBalance: result.newBalance,
          description: result.description
        }
      }
    });
  } catch (error) {
    logger.warn('Failed to create points spend notification:', error);
  }

  logger.info('Points spent on action', {
    userId,
    clientId: req.user.client.id,
    action: result.action,
    pointsSpent: result.pointsSpent,
    newBalance: result.newBalance
  });

  res.status(200).json({
    success: true,
    message: `Puntos utilizados exitosamente para: ${result.description}`,
    data: result,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// ⭐ PREMIUM TEMPORAL CON PUNTOS
// ============================================================================

/**
 * POST /api/points/premium
 * Activar premium temporal con puntos
 */
const activatePremiumWithPoints = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { tier, duration = 24 } = req.body;

  // Verificar que es cliente
  if (req.user.userType !== 'CLIENT') {
    throw new AppError('Solo los clientes pueden activar premium', 403, 'CLIENT_ONLY');
  }

  if (!req.user.client) {
    throw new AppError('Datos de cliente no encontrados', 500, 'CLIENT_DATA_MISSING');
  }

  if (!tier || !['PREMIUM', 'VIP'].includes(tier)) {
    throw new AppError('Tier debe ser PREMIUM o VIP', 400, 'INVALID_TIER');
  }

  const result = await pointsService.activatePremiumWithPoints(
    req.user.client.id, 
    tier, 
    parseInt(duration)
  );

  // Crear notificación
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: 'PAYMENT_SUCCESS',
        title: `¡${tier} activado!`,
        message: `Has activado ${tier} por ${duration} horas usando ${result.pointsCost} puntos`,
        data: {
          tier: result.tier,
          duration: result.duration,
          pointsCost: result.pointsCost,
          expiresAt: result.expiresAt,
          newBalance: result.newBalance
        }
      }
    });
  } catch (error) {
    logger.warn('Failed to create premium activation notification:', error);
  }

  logger.info('Premium activated with points', {
    userId,
    clientId: req.user.client.id,
    tier: result.tier,
    duration: result.duration,
    pointsCost: result.pointsCost,
    expiresAt: result.expiresAt
  });

  res.status(200).json({
    success: true,
    message: `¡${tier} activado exitosamente!`,
    data: result,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// 📊 ESTADÍSTICAS Y INFORMACIÓN
// ============================================================================

/**
 * GET /api/points/streak
 * Obtener información detallada de la racha
 */
const getStreakInfo = catchAsync(async (req, res) => {
  const userId = req.user.id;

  // Verificar que es cliente
  if (req.user.userType !== 'CLIENT') {
    throw new AppError('Solo los clientes tienen racha de puntos', 403, 'CLIENT_ONLY');
  }

  if (!req.user.client) {
    throw new AppError('Datos de cliente no encontrados', 500, 'CLIENT_DATA_MISSING');
  }

  const pointsData = await pointsService.getClientPoints(req.user.client.id);
  const eligibility = await pointsService.checkDailyLoginEligibility(req.user.client.id);

  const streakInfo = {
    currentStreak: pointsData.dailyStreak,
    totalDailyEarned: pointsData.totalDailyEarned,
    canClaim: eligibility.eligible,
    nextClaimAt: eligibility.nextClaimAt,
    bonusMultiplier: pointsService.calculateStreakBonus(pointsData.dailyStreak),
    milestones: {
      next: pointsData.dailyStreak < 7 ? 7 : 
            pointsData.dailyStreak < 15 ? 15 : 
            pointsData.dailyStreak < 30 ? 30 : null,
      rewards: {
        7: 'Bonus de racha del 50%',
        15: 'Bonus de racha del 100%',
        30: 'Bonus máximo alcanzado'
      }
    },
    config: {
      basePoints: pointsService.POINTS_CONFIG.DAILY_LOGIN_POINTS,
      maxStreak: pointsService.POINTS_CONFIG.MAX_STREAK_DAYS,
      bonusThreshold: pointsService.POINTS_CONFIG.STREAK_BONUS_THRESHOLD
    }
  };

  res.status(200).json({
    success: true,
    data: streakInfo,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/points/config
 * Obtener configuración pública del sistema de puntos
 */
const getPointsConfig = catchAsync(async (req, res) => {
  const config = {
    dailyLogin: {
      basePoints: pointsService.POINTS_CONFIG.DAILY_LOGIN_POINTS,
      maxStreak: pointsService.POINTS_CONFIG.MAX_STREAK_DAYS,
      bonusThreshold: pointsService.POINTS_CONFIG.STREAK_BONUS_THRESHOLD,
      bonusMultiplier: pointsService.POINTS_CONFIG.STREAK_BONUS_MULTIPLIER
    },
    actions: pointsService.POINTS_CONFIG.ACTIONS,
    tiers: pointsService.POINTS_CONFIG.TIER_LIMITS,
    currency: 'USD',
    minimumBalance: 1
  };

  res.status(200).json({
    success: true,
    data: config,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// 🛠️ FUNCIONES ADMINISTRATIVAS
// ============================================================================

/**
 * POST /api/points/admin/adjust
 * Ajustar puntos manualmente (solo admins)
 */
const adminAdjustPoints = catchAsync(async (req, res) => {
  const { clientId, amount, reason } = req.body;
  const adminUserId = req.user.id;

  // Verificar que es admin
  if (req.user.userType !== 'ADMIN') {
    throw new AppError('Solo administradores pueden ajustar puntos', 403, 'ADMIN_ONLY');
  }

  if (!clientId || !amount || !reason) {
    throw new AppError('ClientId, amount y reason son requeridos', 400, 'MISSING_FIELDS');
  }

  // Verificar que el cliente existe
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { user: { select: { id: true, username: true } } }
  });

  if (!client) {
    throw new AppError('Cliente no encontrado', 404, 'CLIENT_NOT_FOUND');
  }

  const amountNum = parseInt(amount);
  if (amountNum === 0) {
    throw new AppError('Amount no puede ser 0', 400, 'INVALID_AMOUNT');
  }

  // Ajustar puntos
  const result = amountNum > 0 
    ? await pointsService.addPoints(
        clientId, 
        amountNum, 
        'ADMIN_ADJUSTMENT', 
        `Ajuste manual por admin: ${reason}`,
        { adminId: adminUserId, reason }
      )
    : await pointsService.spendPoints(
        clientId, 
        Math.abs(amountNum), 
        'ADMIN_ADJUSTMENT', 
        `Ajuste manual por admin: ${reason}`,
        { adminId: adminUserId, reason }
      );

  // Crear notificación para el cliente
  try {
    await prisma.notification.create({
      data: {
        userId: client.user.id,
        type: 'PAYMENT_SUCCESS',
        title: 'Ajuste de puntos',
        message: `Tu balance ha sido ajustado: ${amountNum > 0 ? '+' : ''}${amountNum} puntos`,
        data: {
          adjustment: amountNum,
          reason,
          newBalance: result.newBalance,
          adminAdjustment: true
        }
      }
    });
  } catch (error) {
    logger.warn('Failed to create admin adjustment notification:', error);
  }

  logger.info('Admin points adjustment', {
    adminUserId,
    clientId,
    clientUsername: client.user.username,
    adjustment: amountNum,
    reason,
    newBalance: result.newBalance
  });

  res.status(200).json({
    success: true,
    message: `Puntos ajustados exitosamente: ${amountNum > 0 ? '+' : ''}${amountNum}`,
    data: {
      adjustment: amountNum,
      newBalance: result.newBalance,
      reason,
      client: {
        id: client.id,
        username: client.user.username
      }
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/points/admin/stats
 * Estadísticas del sistema de puntos (solo admins)
 */
const getPointsSystemStats = catchAsync(async (req, res) => {
  const { timeframe = '30d' } = req.query;

  // Verificar que es admin
  if (req.user.userType !== 'ADMIN') {
    throw new AppError('Solo administradores pueden ver estadísticas', 403, 'ADMIN_ONLY');
  }

  // Obtener estadísticas usando el servicio de pagos
  const paymentStats = await paymentService.getPaymentStats(timeframe);

  // Estadísticas adicionales de puntos
  const [
    totalClientsWithPoints,
    averageBalance,
    topSpenders,
    dailyLoginStats
  ] = await Promise.all([
    prisma.client.count({
      where: { points: { gt: 0 } }
    }),
    prisma.client.aggregate({
      _avg: { points: true }
    }),
    prisma.client.findMany({
      where: { totalPointsSpent: { gt: 0 } },
      orderBy: { totalPointsSpent: 'desc' },
      take: 10,
      include: {
        user: {
          select: { username: true, firstName: true }
        }
      }
    }),
    prisma.client.aggregate({
      _avg: { dailyLoginStreak: true },
      _max: { dailyLoginStreak: true }
    })
  ]);

  const stats = {
    timeframe,
    overview: {
      totalClientsWithPoints,
      averageBalance: Math.round(averageBalance._avg.points || 0),
      averageStreak: Math.round(dailyLoginStats._avg.dailyLoginStreak || 0),
      maxStreak: dailyLoginStats._max.dailyLoginStreak || 0
    },
    points: paymentStats.points,
    revenue: paymentStats.revenue,
    topSpenders: topSpenders.map(client => ({
      username: client.user.username,
      name: client.user.firstName,
      totalSpent: client.totalPointsSpent,
      currentBalance: client.points
    })),
    generatedAt: new Date().toISOString()
  };

  res.status(200).json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// EXPORTAR MÓDULO
// ============================================================================

module.exports = {
  // Balance y estadísticas
  getPointsBalance,
  getPointsHistory,
  getPointsPackages,
  
  // Login diario
  getDailyLoginStatus,
  claimDailyPoints,
  getStreakInfo,
  
  // Compra de puntos
  purchasePoints,
  confirmPointsPurchase,
  
  // Uso de puntos
  getAvailableActions,
  spendPoints,
  activatePremiumWithPoints,
  
  // Configuración
  getPointsConfig,
  
  // Funciones administrativas
  adminAdjustPoints,
  getPointsSystemStats
};