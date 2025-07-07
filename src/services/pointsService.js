/**
 * ====================================================================
 * 💰 POINTS SERVICE - LÓGICA DE NEGOCIO TELOPOINTS
 * ====================================================================
 * Maneja toda la lógica del sistema de puntos TeloFundi
 */

const { prisma } = require('../config/database');
const logger = require('../utils/logger');

// ============================================================================
// CONFIGURACIONES DEL SISTEMA DE PUNTOS
// ============================================================================

const POINTS_CONFIG = {
  // Puntos por login diario
  DAILY_LOGIN_POINTS: 5,
  
  // Configuración de rachas
  MAX_STREAK_DAYS: 30,
  STREAK_BONUS_THRESHOLD: 7, // A partir de 7 días da bonus
  STREAK_BONUS_MULTIPLIER: 1.5, // 50% más puntos
  
  // Registro inicial
  REGISTRATION_BONUS: 10,
  
  // Costos de acciones premium (en puntos)
  ACTIONS: {
    PREMIUM_DAY: {
      PREMIUM: 25, // 1 día de tier PREMIUM
      VIP: 50      // 1 día de tier VIP
    },
    CHAT_PRIORITY: 10,    // 48h de prioridad en chats
    EXTRA_FAVORITE: 15,   // 1 favorito adicional permanente
    PROFILE_BOOST: 20,    // 12h de boost de perfil
    PHONE_ACCESS: 8,      // Acceso a 1 número de teléfono
    IMAGE_MESSAGE: 5      // Enviar 1 mensaje con imagen
  },
  
  // Límites por tier
  TIER_LIMITS: {
    BASIC: {
      dailyMessageLimit: 5,
      maxFavorites: 5,
      canViewPhoneNumbers: false,
      canSendImages: false,
      canSendVoiceMessages: false,
      canAccessPremiumProfiles: false,
      prioritySupport: false,
      canSeeOnlineStatus: false
    },
    PREMIUM: {
      dailyMessageLimit: 50,
      maxFavorites: 25,
      canViewPhoneNumbers: true,
      canSendImages: true,
      canSendVoiceMessages: false,
      canAccessPremiumProfiles: true,
      prioritySupport: false,
      canSeeOnlineStatus: true
    },
    VIP: {
      dailyMessageLimit: -1, // Ilimitado
      maxFavorites: 100,
      canViewPhoneNumbers: true,
      canSendImages: true,
      canSendVoiceMessages: true,
      canAccessPremiumProfiles: true,
      prioritySupport: true,
      canSeeOnlineStatus: true
    }
  }
};

// ============================================================================
// FUNCIONES PRINCIPALES DE PUNTOS
// ============================================================================

/**
 * Obtener balance y estadísticas de puntos de un cliente
 */
const getClientPoints = async (clientId) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        points: true,
        isPremium: true,
        premiumUntil: true,
        premiumTier: true,
        lastDailyPointsClaim: true,
        dailyLoginStreak: true,
        totalDailyPointsEarned: true,
        totalPointsEarned: true,
        totalPointsSpent: true,
        pointsLastUpdated: true,
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!client) {
      throw new Error('Cliente no encontrado');
    }

    // Verificar elegibilidad para puntos diarios
    const dailyEligibility = await checkDailyLoginEligibility(clientId);
    
    // Verificar estado de premium temporal
    const premiumStatus = await checkPremiumExpiration(clientId);

    return {
      currentBalance: client.points,
      totalEarned: client.totalPointsEarned,
      totalSpent: client.totalPointsSpent,
      dailyStreak: client.dailyLoginStreak,
      totalDailyEarned: client.totalDailyPointsEarned,
      lastUpdate: client.pointsLastUpdated,
      premium: {
        isActive: premiumStatus.isActive,
        tier: premiumStatus.tier,
        expiresAt: premiumStatus.expiresAt,
        timeRemaining: premiumStatus.timeRemaining
      },
      dailyLogin: {
        eligible: dailyEligibility.eligible,
        nextClaimAt: dailyEligibility.nextClaimAt,
        streak: client.dailyLoginStreak,
        bonusMultiplier: calculateStreakBonus(client.dailyLoginStreak)
      },
      user: client.user
    };
  } catch (error) {
    logger.error('Error getting client points:', error);
    throw error;
  }
};

/**
 * Agregar puntos a un cliente
 */
const addPoints = async (clientId, amount, type, description, metadata = {}) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Obtener saldo actual
      const currentClient = await tx.client.findUnique({
        where: { id: clientId },
        select: { points: true }
      });

      if (!currentClient) {
        throw new Error('Cliente no encontrado');
      }

      const balanceBefore = currentClient.points;
      const balanceAfter = balanceBefore + amount;

      // Actualizar puntos del cliente
      const updatedClient = await tx.client.update({
        where: { id: clientId },
        data: {
          points: { increment: amount },
          totalPointsEarned: { increment: amount },
          pointsLastUpdated: new Date()
        }
      });

      // Crear transacción de puntos
      const transaction = await tx.pointTransaction.create({
        data: {
          clientId,
          amount,
          type,
          description,
          balanceBefore,
          balanceAfter,
          metadata,
          source: metadata.source || 'system'
        }
      });

      // Crear registro en historial
      await tx.pointsHistory.create({
        data: {
          clientId,
          type,
          amount,
          description,
          balanceBefore,
          balanceAfter,
          metadata,
          source: metadata.source || 'system'
        }
      });

      return {
        transaction,
        newBalance: balanceAfter,
        pointsAdded: amount
      };
    });

    logger.info('Points added successfully', {
      clientId,
      amount,
      type,
      newBalance: result.newBalance
    });

    return result;
  } catch (error) {
    logger.error('Error adding points:', error);
    throw error;
  }
};

/**
 * Gastar puntos de un cliente
 */
const spendPoints = async (clientId, amount, type, description, metadata = {}) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verificar saldo suficiente
      const currentClient = await tx.client.findUnique({
        where: { id: clientId },
        select: { points: true }
      });

      if (!currentClient) {
        throw new Error('Cliente no encontrado');
      }

      if (currentClient.points < amount) {
        throw new Error('Saldo insuficiente de puntos');
      }

      const balanceBefore = currentClient.points;
      const balanceAfter = balanceBefore - amount;

      // Actualizar puntos del cliente
      const updatedClient = await tx.client.update({
        where: { id: clientId },
        data: {
          points: { decrement: amount },
          totalPointsSpent: { increment: amount },
          pointsLastUpdated: new Date()
        }
      });

      // Crear transacción de puntos (negativa)
      const transaction = await tx.pointTransaction.create({
        data: {
          clientId,
          amount: -amount,
          type,
          description,
          balanceBefore,
          balanceAfter,
          metadata,
          source: metadata.source || 'system'
        }
      });

      // Crear registro en historial (negativo)
      await tx.pointsHistory.create({
        data: {
          clientId,
          type,
          amount: -amount,
          description,
          balanceBefore,
          balanceAfter,
          metadata,
          source: metadata.source || 'system'
        }
      });

      return {
        transaction,
        newBalance: balanceAfter,
        pointsSpent: amount
      };
    });

    logger.info('Points spent successfully', {
      clientId,
      amount,
      type,
      newBalance: result.newBalance
    });

    return result;
  } catch (error) {
    logger.error('Error spending points:', error);
    throw error;
  }
};

/**
 * Verificar elegibilidad para reclamar puntos diarios
 */
const checkDailyLoginEligibility = async (clientId) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        lastDailyPointsClaim: true,
        dailyLoginStreak: true
      }
    });

    if (!client) {
      throw new Error('Cliente no encontrado');
    }

    const now = new Date();
    const lastClaim = client.lastDailyPointsClaim;

    // Si nunca ha reclamado, es elegible
    if (!lastClaim) {
      return {
        eligible: true,
        nextClaimAt: null,
        hoursSinceLastClaim: null
      };
    }

    // Calcular tiempo desde la última reclamación
    const hoursSinceLastClaim = (now - lastClaim) / (1000 * 60 * 60);
    
    // Debe esperar al menos 20 horas desde la última reclamación
    const isEligible = hoursSinceLastClaim >= 20;
    
    let nextClaimAt = null;
    if (!isEligible) {
      nextClaimAt = new Date(lastClaim.getTime() + 20 * 60 * 60 * 1000);
    }

    return {
      eligible: isEligible,
      nextClaimAt,
      hoursSinceLastClaim: Math.floor(hoursSinceLastClaim)
    };
  } catch (error) {
    logger.error('Error checking daily login eligibility:', error);
    throw error;
  }
};

/**
 * Procesar login diario y otorgar puntos
 */
const processDailyLogin = async (clientId) => {
  try {
    // Verificar elegibilidad
    const eligibility = await checkDailyLoginEligibility(clientId);
    
    if (!eligibility.eligible) {
      throw new Error('No elegible para reclamar puntos diarios aún');
    }

    const result = await prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: { id: clientId },
        select: {
          points: true,
          lastDailyPointsClaim: true,
          dailyLoginStreak: true,
          totalDailyPointsEarned: true
        }
      });

      const now = new Date();
      const lastClaim = client.lastDailyPointsClaim;
      
      // Calcular nueva racha
      let newStreak = 1;
      if (lastClaim) {
        const daysSinceLastClaim = Math.floor((now - lastClaim) / (1000 * 60 * 60 * 24));
        
        if (daysSinceLastClaim === 1) {
          // Mantener racha si fue ayer
          newStreak = Math.min(client.dailyLoginStreak + 1, POINTS_CONFIG.MAX_STREAK_DAYS);
        } else if (daysSinceLastClaim === 0) {
          // Mismo día, mantener racha actual
          newStreak = client.dailyLoginStreak;
        }
        // Si es más de 1 día, la racha se reinicia a 1
      }

      // Calcular puntos base y bonus
      const basePoints = POINTS_CONFIG.DAILY_LOGIN_POINTS;
      const streakMultiplier = calculateStreakBonus(newStreak);
      const pointsToGive = Math.floor(basePoints * streakMultiplier);

      const balanceBefore = client.points;
      const balanceAfter = balanceBefore + pointsToGive;

      // Actualizar cliente
      const updatedClient = await tx.client.update({
        where: { id: clientId },
        data: {
          points: { increment: pointsToGive },
          totalPointsEarned: { increment: pointsToGive },
          totalDailyPointsEarned: { increment: pointsToGive },
          lastDailyPointsClaim: now,
          dailyLoginStreak: newStreak,
          pointsLastUpdated: now
        }
      });

      // Crear transacción
      const transaction = await tx.pointTransaction.create({
        data: {
          clientId,
          amount: pointsToGive,
          type: newStreak >= POINTS_CONFIG.STREAK_BONUS_THRESHOLD ? 'STREAK_BONUS' : 'DAILY_LOGIN',
          description: `Login diario - Día ${newStreak} de racha${newStreak >= POINTS_CONFIG.STREAK_BONUS_THRESHOLD ? ' (Bonus de racha!)' : ''}`,
          balanceBefore,
          balanceAfter,
          metadata: {
            streakDay: newStreak,
            basePoints,
            streakMultiplier,
            isStreakBonus: newStreak >= POINTS_CONFIG.STREAK_BONUS_THRESHOLD
          },
          source: 'daily_login'
        }
      });

      // Crear historial
      await tx.pointsHistory.create({
        data: {
          clientId,
          type: newStreak >= POINTS_CONFIG.STREAK_BONUS_THRESHOLD ? 'STREAK_BONUS' : 'DAILY_LOGIN',
          amount: pointsToGive,
          description: `Login diario - Día ${newStreak} de racha`,
          balanceBefore,
          balanceAfter,
          metadata: {
            streakDay: newStreak,
            basePoints,
            streakMultiplier,
            timestamp: now.toISOString()
          },
          source: 'daily_login'
        }
      });

      return {
        pointsEarned: pointsToGive,
        streakDay: newStreak,
        basePoints,
        streakMultiplier,
        newBalance: balanceAfter,
        nextEligibleAt: new Date(now.getTime() + 20 * 60 * 60 * 1000),
        isStreakBonus: newStreak >= POINTS_CONFIG.STREAK_BONUS_THRESHOLD
      };
    });

    logger.info('Daily login processed', {
      clientId,
      pointsEarned: result.pointsEarned,
      streakDay: result.streakDay,
      newBalance: result.newBalance
    });

    return result;
  } catch (error) {
    logger.error('Error processing daily login:', error);
    throw error;
  }
};

/**
 * Activar premium temporal con puntos
 */
const activatePremiumWithPoints = async (clientId, tier, duration = 24) => {
  try {
    // Validar tier
    if (!['PREMIUM', 'VIP'].includes(tier)) {
      throw new Error('Tier premium inválido');
    }

    // Calcular costo en puntos
    const pointsCost = POINTS_CONFIG.ACTIONS.PREMIUM_DAY[tier];
    
    const result = await prisma.$transaction(async (tx) => {
      // Verificar saldo
      const client = await tx.client.findUnique({
        where: { id: clientId },
        select: {
          points: true,
          isPremium: true,
          premiumUntil: true,
          premiumTier: true
        }
      });

      if (!client) {
        throw new Error('Cliente no encontrado');
      }

      if (client.points < pointsCost) {
        throw new Error(`Puntos insuficientes. Necesitas ${pointsCost} puntos para ${tier}`);
      }

      // Calcular nueva fecha de expiración
      const now = new Date();
      let newExpirationDate;
      
      if (client.isPremium && client.premiumUntil && client.premiumUntil > now) {
        // Si ya tiene premium activo, extender desde la fecha actual de expiración
        newExpirationDate = new Date(client.premiumUntil.getTime() + duration * 60 * 60 * 1000);
      } else {
        // Si no tiene premium o ya expiró, comenzar desde ahora
        newExpirationDate = new Date(now.getTime() + duration * 60 * 60 * 1000);
      }

      // Gastar puntos
      await spendPoints(clientId, pointsCost, 'PREMIUM_DAY', 
        `Activación de ${tier} por ${duration} horas`, 
        { tier, duration, source: 'premium_activation' }
      );

      // Aplicar beneficios premium
      const tierBenefits = POINTS_CONFIG.TIER_LIMITS[tier];
      
      const updatedClient = await tx.client.update({
        where: { id: clientId },
        data: {
          isPremium: true,
          premiumTier: tier,
          premiumUntil: newExpirationDate,
          ...tierBenefits
        }
      });

      // Crear registro de activación
      const activation = await tx.premiumActivation.create({
        data: {
          clientId,
          tier,
          duration,
          pointsCost,
          activatedAt: now,
          expiresAt: newExpirationDate,
          isActive: true,
          activatedBy: 'points'
        }
      });

      return {
        activation,
        tier,
        duration,
        pointsCost,
        expiresAt: newExpirationDate,
        benefits: tierBenefits,
        newBalance: client.points - pointsCost
      };
    });

    logger.info('Premium activated with points', {
      clientId,
      tier,
      duration,
      pointsCost,
      expiresAt: result.expiresAt
    });

    return result;
  } catch (error) {
    logger.error('Error activating premium with points:', error);
    throw error;
  }
};

/**
 * Obtener historial de puntos con paginación
 */
const getPointsHistory = async (clientId, pagination = {}) => {
  const { page = 1, limit = 50, type = null } = pagination;
  const skip = (page - 1) * limit;

  try {
    const where = { clientId };
    if (type) {
      where.type = type;
    }

    const [history, total] = await Promise.all([
      prisma.pointsHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.pointsHistory.count({ where })
    ]);

    return {
      history,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  } catch (error) {
    logger.error('Error getting points history:', error);
    throw error;
  }
};

/**
 * Obtener paquetes de puntos disponibles
 */
const getAvailablePackages = async () => {
  try {
    const packages = await prisma.pointsPackage.findMany({
      where: { isActive: true },
      orderBy: [
        { isPopular: 'desc' },
        { price: 'asc' }
      ]
    });

    return packages.map(pkg => ({
      ...pkg,
      totalPoints: pkg.points + pkg.bonus,
      pricePerPoint: (pkg.price / (pkg.points + pkg.bonus)).toFixed(3)
    }));
  } catch (error) {
    logger.error('Error getting available packages:', error);
    throw error;
  }
};

/**
 * Crear compra de puntos
 */
const createPointsPurchase = async (clientId, packageId, paymentData = {}) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Obtener paquete
      const package = await tx.pointsPackage.findUnique({
        where: { id: packageId, isActive: true }
      });

      if (!package) {
        throw new Error('Paquete de puntos no encontrado o no disponible');
      }

      // Verificar cliente
      const client = await tx.client.findUnique({
        where: { id: clientId },
        select: { id: true, userId: true }
      });

      if (!client) {
        throw new Error('Cliente no encontrado');
      }

      const totalPoints = package.points + package.bonus;

      // Crear registro de compra
      const purchase = await tx.pointsPurchase.create({
        data: {
          clientId,
          packageId,
          pointsPurchased: package.points,
          bonusPoints: package.bonus,
          totalPoints,
          amountPaid: package.price,
          status: 'PENDING',
          stripePaymentId: paymentData.stripePaymentId || null
        }
      });

      return {
        purchase,
        package,
        totalPoints,
        client
      };
    });

    logger.info('Points purchase created', {
      clientId,
      packageId,
      purchaseId: result.purchase.id,
      totalPoints: result.totalPoints,
      amount: result.package.price
    });

    return result;
  } catch (error) {
    logger.error('Error creating points purchase:', error);
    throw error;
  }
};

/**
 * Confirmar compra de puntos (cuando el pago es exitoso)
 */
const confirmPointsPurchase = async (purchaseId, paymentData = {}) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Obtener compra pendiente
      const purchase = await tx.pointsPurchase.findUnique({
        where: { id: purchaseId },
        include: {
          client: { select: { points: true } },
          package: true
        }
      });

      if (!purchase) {
        throw new Error('Compra no encontrada');
      }

      if (purchase.status !== 'PENDING') {
        throw new Error('La compra ya fue procesada');
      }

      const balanceBefore = purchase.client.points;
      const pointsToAdd = purchase.totalPoints;
      const balanceAfter = balanceBefore + pointsToAdd;

      // Actualizar estado de la compra
      const updatedPurchase = await tx.pointsPurchase.update({
        where: { id: purchaseId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          stripePaymentId: paymentData.stripePaymentId || purchase.stripePaymentId
        }
      });

      // Actualizar puntos del cliente
      await tx.client.update({
        where: { id: purchase.clientId },
        data: {
          points: { increment: pointsToAdd },
          totalPointsEarned: { increment: pointsToAdd },
          totalPointsPurchased: { increment: pointsToAdd },
          pointsLastUpdated: new Date()
        }
      });

      // Crear transacciones
      await tx.pointTransaction.create({
        data: {
          clientId: purchase.clientId,
          amount: purchase.pointsPurchased,
          type: 'PURCHASE',
          description: `Compra de puntos - ${purchase.package.name}`,
          cost: purchase.amountPaid,
          purchaseId: purchase.id,
          balanceBefore,
          balanceAfter: balanceBefore + purchase.pointsPurchased,
          metadata: {
            packageName: purchase.package.name,
            packageId: purchase.packageId,
            stripePaymentId: paymentData.stripePaymentId
          },
          source: 'purchase'
        }
      });

      // Si hay puntos bonus, crear transacción separada
      if (purchase.bonusPoints > 0) {
        await tx.pointTransaction.create({
          data: {
            clientId: purchase.clientId,
            amount: purchase.bonusPoints,
            type: 'BONUS_POINTS',
            description: `Puntos bonus - ${purchase.package.name}`,
            purchaseId: purchase.id,
            balanceBefore: balanceBefore + purchase.pointsPurchased,
            balanceAfter,
            metadata: {
              packageName: purchase.package.name,
              packageId: purchase.packageId,
              bonusFromPurchase: true
            },
            source: 'purchase_bonus'
          }
        });
      }

      // Crear registros en historial
      await tx.pointsHistory.create({
        data: {
          clientId: purchase.clientId,
          type: 'PURCHASE',
          amount: pointsToAdd,
          description: `Compra de ${purchase.package.name} - ${purchase.pointsPurchased} puntos + ${purchase.bonusPoints} bonus`,
          balanceBefore,
          balanceAfter,
          purchaseId: purchase.id,
          metadata: {
            packageName: purchase.package.name,
            basePoints: purchase.pointsPurchased,
            bonusPoints: purchase.bonusPoints,
            amountPaid: purchase.amountPaid,
            timestamp: new Date().toISOString()
          },
          source: 'purchase'
        }
      });

      return {
        purchase: updatedPurchase,
        pointsAdded: pointsToAdd,
        newBalance: balanceAfter,
        package: purchase.package
      };
    });

    logger.info('Points purchase confirmed', {
      purchaseId,
      clientId: result.purchase.clientId,
      pointsAdded: result.pointsAdded,
      newBalance: result.newBalance
    });

    return result;
  } catch (error) {
    logger.error('Error confirming points purchase:', error);
    throw error;
  }
};

/**
 * Procesar reembolso de puntos
 */
const processPointsRefund = async (purchaseId, reason = 'Reembolso solicitado') => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Obtener compra
      const purchase = await tx.pointsPurchase.findUnique({
        where: { id: purchaseId },
        include: { client: { select: { points: true } } }
      });

      if (!purchase || purchase.status !== 'COMPLETED') {
        throw new Error('Compra no encontrada o no completada');
      }

      const currentBalance = purchase.client.points;
      const pointsToDeduct = purchase.totalPoints;

      // Verificar que el cliente tenga suficientes puntos
      if (currentBalance < pointsToDeduct) {
        throw new Error('El cliente no tiene suficientes puntos para el reembolso');
      }

      // Actualizar estado de la compra
      await tx.pointsPurchase.update({
        where: { id: purchaseId },
        data: { status: 'REFUNDED' }
      });

      // Deducir puntos
      await tx.client.update({
        where: { id: purchase.clientId },
        data: {
          points: { decrement: pointsToDeduct },
          totalPointsSpent: { increment: pointsToDeduct },
          pointsLastUpdated: new Date()
        }
      });

      // Crear transacción de reembolso
      await tx.pointTransaction.create({
        data: {
          clientId: purchase.clientId,
          amount: -pointsToDeduct,
          type: 'REFUND',
          description: `Reembolso de compra - ${reason}`,
          purchaseId: purchase.id,
          balanceBefore: currentBalance,
          balanceAfter: currentBalance - pointsToDeduct,
          metadata: {
            originalPurchaseId: purchase.id,
            refundReason: reason,
            refundedPoints: pointsToDeduct,
            refundedAmount: purchase.amountPaid
          },
          source: 'refund'
        }
      });

      return {
        purchase,
        pointsDeducted: pointsToDeduct,
        newBalance: currentBalance - pointsToDeduct,
        refundReason: reason
      };
    });

    logger.info('Points refund processed', {
      purchaseId,
      clientId: result.purchase.clientId,
      pointsDeducted: result.pointsDeducted,
      newBalance: result.newBalance
    });

    return result;
  } catch (error) {
    logger.error('Error processing points refund:', error);
    throw error;
  }
};

/**
 * Calcular bonus de racha
 */
const calculateStreakBonus = (streakDays) => {
  if (streakDays >= POINTS_CONFIG.STREAK_BONUS_THRESHOLD) {
    return POINTS_CONFIG.STREAK_BONUS_MULTIPLIER;
  }
  return 1.0;
};

/**
 * Verificar y actualizar expiración de premium
 */
const checkPremiumExpiration = async (clientId) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        isPremium: true,
        premiumUntil: true,
        premiumTier: true
      }
    });

    if (!client) {
      throw new Error('Cliente no encontrado');
    }

    const now = new Date();
    let isActive = client.isPremium;
    let timeRemaining = null;

    // Verificar si el premium ha expirado
    if (client.isPremium && client.premiumUntil && client.premiumUntil <= now) {
      // Premium expirado, revertir a BASIC
      await prisma.client.update({
        where: { id: clientId },
        data: {
          isPremium: false,
          premiumTier: 'BASIC',
          premiumUntil: null,
          ...POINTS_CONFIG.TIER_LIMITS.BASIC
        }
      });

      // Desactivar activaciones vencidas
      await prisma.premiumActivation.updateMany({
        where: {
          clientId,
          isActive: true,
          expiresAt: { lte: now }
        },
        data: { isActive: false }
      });

      isActive = false;

      logger.info('Premium expired and reverted to BASIC', { clientId });
    } else if (client.isPremium && client.premiumUntil) {
      // Calcular tiempo restante
      timeRemaining = Math.max(0, client.premiumUntil - now);
    }

    return {
      isActive,
      tier: isActive ? client.premiumTier : 'BASIC',
      expiresAt: isActive ? client.premiumUntil : null,
      timeRemaining
    };
  } catch (error) {
    logger.error('Error checking premium expiration:', error);
    throw error;
  }
};

/**
 * Limpiar datos antiguos de puntos
 */
const cleanupExpiredPremium = async () => {
  try {
    const now = new Date();

    // Buscar activaciones expiradas
    const expiredActivations = await prisma.premiumActivation.findMany({
      where: {
        isActive: true,
        expiresAt: { lte: now }
      },
      include: {
        client: {
          select: {
            id: true,
            userId: true,
            user: { select: { username: true } }
          }
        }
      }
    });

    if (expiredActivations.length === 0) {
      logger.info('No expired premium activations found');
      return { processedCount: 0 };
    }

    // Procesar cada expiración
    for (const activation of expiredActivations) {
      await prisma.$transaction(async (tx) => {
        // Desactivar la activación
        await tx.premiumActivation.update({
          where: { id: activation.id },
          data: { isActive: false }
        });

        // Verificar si el cliente tiene otras activaciones activas
        const otherActiveActivations = await tx.premiumActivation.count({
          where: {
            clientId: activation.clientId,
            isActive: true,
            expiresAt: { gt: now }
          }
        });

        // Si no tiene otras activaciones activas, revertir a BASIC
        if (otherActiveActivations === 0) {
          await tx.client.update({
            where: { id: activation.clientId },
            data: {
              isPremium: false,
              premiumTier: 'BASIC',
              premiumUntil: null,
              ...POINTS_CONFIG.TIER_LIMITS.BASIC
            }
          });

          logger.info('Client premium reverted to BASIC', {
            clientId: activation.clientId,
            username: activation.client.user.username
          });
        }
      });
    }

    logger.info('Expired premium cleanup completed', {
      processedCount: expiredActivations.length
    });

    return { processedCount: expiredActivations.length };
  } catch (error) {
    logger.error('Error cleaning up expired premium:', error);
    throw error;
  }
};

/**
 * Obtener acciones disponibles con puntos
 */
const getAvailableActions = async (clientId) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        points: true,
        isPremium: true,
        premiumTier: true,
        currentFavorites: true,
        maxFavorites: true
      }
    });

    if (!client) {
      throw new Error('Cliente no encontrado');
    }

    const actions = [];

    // Premium Day
    Object.keys(POINTS_CONFIG.ACTIONS.PREMIUM_DAY).forEach(tier => {
      const cost = POINTS_CONFIG.ACTIONS.PREMIUM_DAY[tier];
      actions.push({
        id: `premium_${tier.toLowerCase()}`,
        name: `Premium ${tier} (1 día)`,
        description: `Activar ${tier} por 24 horas`,
        cost,
        available: client.points >= cost,
        benefits: Object.keys(POINTS_CONFIG.TIER_LIMITS[tier])
      });
    });

    // Otras acciones
    actions.push(
      {
        id: 'chat_priority',
        name: 'Prioridad en Chat',
        description: 'Aparecer primero en las conversaciones por 48 horas',
        cost: POINTS_CONFIG.ACTIONS.CHAT_PRIORITY,
        available: client.points >= POINTS_CONFIG.ACTIONS.CHAT_PRIORITY,
        duration: '48 horas'
      },
      {
        id: 'profile_boost',
        name: 'Boost de Perfil',
        description: 'Aumentar visibilidad de tu perfil por 12 horas',
        cost: POINTS_CONFIG.ACTIONS.PROFILE_BOOST,
        available: client.points >= POINTS_CONFIG.ACTIONS.PROFILE_BOOST,
        duration: '12 horas'
      },
      {
        id: 'phone_access',
        name: 'Acceso a Teléfono',
        description: 'Ver número de teléfono de un perfil',
        cost: POINTS_CONFIG.ACTIONS.PHONE_ACCESS,
        available: client.points >= POINTS_CONFIG.ACTIONS.PHONE_ACCESS,
        type: 'per_use'
      },
      {
        id: 'image_message',
        name: 'Mensaje con Imagen',
        description: 'Enviar un mensaje que incluya imagen',
        cost: POINTS_CONFIG.ACTIONS.IMAGE_MESSAGE,
        available: client.points >= POINTS_CONFIG.ACTIONS.IMAGE_MESSAGE,
        type: 'per_use'
      }
    );

    // Extra Favorite (solo si no ha alcanzado el máximo)
    if (client.currentFavorites < 100) { // Límite máximo general
      actions.push({
        id: 'extra_favorite',
        name: 'Favorito Adicional',
        description: 'Aumentar permanentemente tu límite de favoritos en 1',
        cost: POINTS_CONFIG.ACTIONS.EXTRA_FAVORITE,
        available: client.points >= POINTS_CONFIG.ACTIONS.EXTRA_FAVORITE,
        currentLimit: client.maxFavorites,
        newLimit: client.maxFavorites + 1
      });
    }

    return {
      currentPoints: client.points,
      actions,
      premiumStatus: {
        isActive: client.isPremium,
        tier: client.premiumTier
      }
    };
  } catch (error) {
    logger.error('Error getting available actions:', error);
    throw error;
  }
};

// ============================================================================
// EXPORTAR MÓDULO
// ============================================================================

module.exports = {
  getClientPoints,
  addPoints,
  spendPoints,
  checkDailyLoginEligibility,
  processDailyLogin,
  activatePremiumWithPoints,
  getPointsHistory,
  getAvailablePackages,
  createPointsPurchase,
  confirmPointsPurchase,
  processPointsRefund,
  calculateStreakBonus,
  checkPremiumExpiration,
  cleanupExpiredPremium,
  getAvailableActions,
  POINTS_CONFIG
};