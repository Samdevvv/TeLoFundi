/**
 * ====================================================================
 * 👤 USER SERVICE - GESTIÓN DE USUARIOS CON TELOPOINTS
 * ====================================================================
 * Maneja usuarios, límites dinámicos y integración con sistema de puntos
 */

const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const pointsService = require('./pointsService'); // ✅ INTEGRACIÓN

// ============================================================================
// CONFIGURACIONES DE LÍMITES
// ============================================================================

const DEFAULT_LIMITS = {
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
};

// ============================================================================
// FUNCIONES PRINCIPALES DE USUARIOS
// ============================================================================

/**
 * Obtener perfil completo del usuario incluyendo sistema de puntos
 */
const getUserProfile = async (userId, includePrivate = false) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        escort: {
          include: {
            agencyMemberships: {
              include: {
                agency: {
                  select: {
                    id: true,
                    user: {
                      select: {
                        username: true,
                        firstName: true,
                        lastName: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        agency: {
          include: {
            memberships: {
              include: {
                escort: {
                  select: {
                    id: true,
                    isVerified: true,
                    user: {
                      select: {
                        username: true,
                        firstName: true,
                        lastName: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        client: true, // ✅ INCLUIR DATOS DE CLIENTE
        location: true,
        reputation: true,
        settings: true,
        _count: {
          select: {
            posts: { where: { isActive: true } },
            favorites: true,
            likes: true
          }
        }
      }
    });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // ✅ NUEVO: Obtener datos de puntos si es cliente
    let pointsData = null;
    let limitsData = null;
    
    if (user.userType === 'CLIENT' && user.client) {
      try {
        // Obtener datos de puntos
        pointsData = await pointsService.getClientPoints(user.client.id);
        
        // Obtener límites actuales
        limitsData = await getClientLimits(user.client.id);
      } catch (error) {
        logger.warn('Error getting points data for profile', { userId, error: error.message });
      }
    }

    // Filtrar información privada si no está autorizado
    const profile = {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      bio: user.bio,
      userType: user.userType,
      isActive: user.isActive,
      accountStatus: user.accountStatus,
      profileViews: user.profileViews,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
      location: user.location,
      reputation: user.reputation,
      counts: user._count,
      
      // ✅ NUEVO: Datos específicos del cliente con puntos
      ...(user.userType === 'CLIENT' && {
        client: {
          ...user.client,
          points: pointsData,
          limits: limitsData
        }
      }),
      
      // Datos específicos del escort
      ...(user.userType === 'ESCORT' && {
        escort: {
          ...user.escort,
          agencyMemberships: user.escort.agencyMemberships
        }
      }),
      
      // Datos específicos de la agencia
      ...(user.userType === 'AGENCY' && {
        agency: {
          ...user.agency,
          members: user.agency.memberships
        }
      })
    };

    // Incluir información privada si está autorizado
    if (includePrivate) {
      profile.email = user.email;
      profile.phone = user.phone;
      profile.settings = user.settings;
      profile.emailVerified = user.emailVerified;
      profile.lastLoginIP = user.lastLoginIP;
    }

    return profile;
  } catch (error) {
    logger.error('Error getting user profile:', error);
    throw error;
  }
};

/**
 * Actualizar límites dinámicos del cliente
 */
const updateClientLimits = async (clientId, newLimits) => {
  try {
    const validFields = [
      'dailyMessageLimit',
      'maxFavorites',
      'canViewPhoneNumbers',
      'canSendImages',
      'canSendVoiceMessages',
      'canAccessPremiumProfiles',
      'prioritySupport',
      'canSeeOnlineStatus'
    ];

    // Filtrar solo campos válidos
    const updateData = {};
    Object.keys(newLimits).forEach(key => {
      if (validFields.includes(key)) {
        updateData[key] = newLimits[key];
      }
    });

    if (Object.keys(updateData).length === 0) {
      throw new Error('No hay campos válidos para actualizar');
    }

    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: updateData
    });

    logger.info('Client limits updated', {
      clientId,
      updatedFields: Object.keys(updateData),
      newLimits: updateData
    });

    return updatedClient;
  } catch (error) {
    logger.error('Error updating client limits:', error);
    throw error;
  }
};

/**
 * Obtener límites actuales del cliente
 */
const getClientLimits = async (clientId) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        dailyMessageLimit: true,
        messagesUsedToday: true,
        maxFavorites: true,
        currentFavorites: true,
        canViewPhoneNumbers: true,
        canSendImages: true,
        canSendVoiceMessages: true,
        canAccessPremiumProfiles: true,
        prioritySupport: true,
        canSeeOnlineStatus: true,
        isPremium: true,
        premiumTier: true,
        premiumUntil: true,
        lastMessageReset: true
      }
    });

    if (!client) {
      throw new Error('Cliente no encontrado');
    }

    // Verificar si necesita reset diario
    const now = new Date();
    const lastReset = client.lastMessageReset;
    const needsReset = !lastReset || 
      (now.getDate() !== lastReset.getDate() || 
       now.getMonth() !== lastReset.getMonth() || 
       now.getFullYear() !== lastReset.getFullYear());

    // Reset automático si es necesario
    if (needsReset && client.messagesUsedToday > 0) {
      await resetDailyLimits(clientId);
      client.messagesUsedToday = 0;
    }

    const messagesRemaining = client.dailyMessageLimit === -1 
      ? -1 // Ilimitado
      : Math.max(0, client.dailyMessageLimit - client.messagesUsedToday);

    const favoritesRemaining = Math.max(0, client.maxFavorites - client.currentFavorites);

    return {
      messages: {
        limit: client.dailyMessageLimit,
        used: client.messagesUsedToday,
        remaining: messagesRemaining,
        unlimited: client.dailyMessageLimit === -1
      },
      favorites: {
        limit: client.maxFavorites,
        used: client.currentFavorites,
        remaining: favoritesRemaining
      },
      permissions: {
        canViewPhoneNumbers: client.canViewPhoneNumbers,
        canSendImages: client.canSendImages,
        canSendVoiceMessages: client.canSendVoiceMessages,
        canAccessPremiumProfiles: client.canAccessPremiumProfiles,
        prioritySupport: client.prioritySupport,
        canSeeOnlineStatus: client.canSeeOnlineStatus
      },
      premium: {
        isActive: client.isPremium,
        tier: client.premiumTier,
        expiresAt: client.premiumUntil
      },
      lastReset: client.lastMessageReset,
      needsReset
    };
  } catch (error) {
    logger.error('Error getting client limits:', error);
    throw error;
  }
};

/**
 * Resetear límites diarios
 */
const resetDailyLimits = async (clientId) => {
  try {
    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: {
        messagesUsedToday: 0,
        lastMessageReset: new Date()
      }
    });

    logger.info('Daily limits reset', { clientId });
    return updatedClient;
  } catch (error) {
    logger.error('Error resetting daily limits:', error);
    throw error;
  }
};

/**
 * Verificar y actualizar expiración de premium
 */
const checkPremiumExpiration = async (clientId) => {
  try {
    // Usar la función del pointsService que ya maneja esto
    return await pointsService.checkPremiumExpiration(clientId);
  } catch (error) {
    logger.error('Error checking premium expiration:', error);
    throw error;
  }
};

/**
 * Aplicar beneficios premium a un cliente
 */
const applyPremiumBenefits = async (clientId, tier, duration = null) => {
  try {
    if (!['PREMIUM', 'VIP'].includes(tier)) {
      throw new Error('Tier premium inválido');
    }

    const benefits = DEFAULT_LIMITS[tier];
    let updateData = { ...benefits };

    // Si se especifica duración, calcular fecha de expiración
    if (duration) {
      const expirationDate = new Date(Date.now() + duration * 60 * 60 * 1000);
      updateData.isPremium = true;
      updateData.premiumTier = tier;
      updateData.premiumUntil = expirationDate;
    }

    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: updateData
    });

    logger.info('Premium benefits applied', {
      clientId,
      tier,
      duration,
      benefits: Object.keys(benefits)
    });

    return updatedClient;
  } catch (error) {
    logger.error('Error applying premium benefits:', error);
    throw error;
  }
};

/**
 * Remover beneficios premium (revertir a BASIC)
 */
const removePremiumBenefits = async (clientId) => {
  try {
    const basicBenefits = DEFAULT_LIMITS.BASIC;
    
    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: {
        ...basicBenefits,
        isPremium: false,
        premiumTier: 'BASIC',
        premiumUntil: null
      }
    });

    logger.info('Premium benefits removed, reverted to BASIC', { clientId });
    return updatedClient;
  } catch (error) {
    logger.error('Error removing premium benefits:', error);
    throw error;
  }
};

/**
 * Incrementar uso de mensaje diario
 */
const incrementMessageUsage = async (clientId) => {
  try {
    // Verificar límites actuales
    const limits = await getClientLimits(clientId);
    
    if (limits.messages.unlimited) {
      // Usuario con mensajes ilimitados, no incrementar contador
      return { success: true, unlimited: true };
    }

    if (limits.messages.remaining <= 0) {
      throw new Error('Límite diario de mensajes alcanzado');
    }

    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: {
        messagesUsedToday: { increment: 1 }
      }
    });

    logger.info('Message usage incremented', {
      clientId,
      newUsage: updatedClient.messagesUsedToday,
      limit: limits.messages.limit
    });

    return {
      success: true,
      unlimited: false,
      newUsage: updatedClient.messagesUsedToday,
      remaining: limits.messages.limit - updatedClient.messagesUsedToday
    };
  } catch (error) {
    logger.error('Error incrementing message usage:', error);
    throw error;
  }
};

/**
 * Verificar si el usuario puede realizar una acción
 */
const canUserPerformAction = async (userId, action) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        client: true
      }
    });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Verificaciones básicas
    if (!user.isActive) {
      return { allowed: false, reason: 'Cuenta inactiva' };
    }

    if (user.isBanned) {
      return { allowed: false, reason: 'Usuario baneado' };
    }

    // Si no es cliente, permitir la mayoría de acciones
    if (user.userType !== 'CLIENT' || !user.client) {
      return { allowed: true };
    }

    const limits = await getClientLimits(user.client.id);

    switch (action) {
      case 'send_message':
        if (limits.messages.unlimited || limits.messages.remaining > 0) {
          return { allowed: true };
        }
        return { 
          allowed: false, 
          reason: 'Límite diario de mensajes alcanzado',
          canUpgrade: true,
          upgradeOptions: ['PREMIUM', 'VIP']
        };

      case 'send_image':
        if (limits.permissions.canSendImages) {
          return { allowed: true };
        }
        return { 
          allowed: false, 
          reason: 'Función disponible solo para usuarios Premium',
          canUpgrade: true,
          upgradeOptions: ['PREMIUM', 'VIP']
        };

      case 'send_voice':
        if (limits.permissions.canSendVoiceMessages) {
          return { allowed: true };
        }
        return { 
          allowed: false, 
          reason: 'Función disponible solo para usuarios VIP',
          canUpgrade: true,
          upgradeOptions: ['VIP']
        };

      case 'view_phone':
        if (limits.permissions.canViewPhoneNumbers) {
          return { allowed: true };
        }
        return { 
          allowed: false, 
          reason: 'Acceso a teléfonos disponible solo para usuarios Premium',
          canUpgrade: true,
          upgradeOptions: ['PREMIUM', 'VIP'],
          canUsePoints: true,
          pointsCost: pointsService.POINTS_CONFIG.ACTIONS.PHONE_ACCESS
        };

      case 'add_favorite':
        if (limits.favorites.remaining > 0) {
          return { allowed: true };
        }
        return { 
          allowed: false, 
          reason: 'Límite de favoritos alcanzado',
          canUpgrade: true,
          upgradeOptions: ['PREMIUM', 'VIP'],
          canUsePoints: true,
          pointsCost: pointsService.POINTS_CONFIG.ACTIONS.EXTRA_FAVORITE
        };

      case 'access_premium_profile':
        if (limits.permissions.canAccessPremiumProfiles) {
          return { allowed: true };
        }
        return { 
          allowed: false, 
          reason: 'Acceso a perfiles premium disponible solo para usuarios Premium',
          canUpgrade: true,
          upgradeOptions: ['PREMIUM', 'VIP']
        };

      default:
        return { allowed: true };
    }
  } catch (error) {
    logger.error('Error checking user action permission:', error);
    throw error;
  }
};

/**
 * Procesar uso de puntos para acción específica
 */
const usePointsForAction = async (userId, action, targetData = {}) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { client: true }
    });

    if (!user || user.userType !== 'CLIENT' || !user.client) {
      throw new Error('Solo los clientes pueden usar puntos');
    }

    const clientId = user.client.id;
    let pointsCost, description, actionType;

    switch (action) {
      case 'phone_access':
        pointsCost = pointsService.POINTS_CONFIG.ACTIONS.PHONE_ACCESS;
        actionType = 'PHONE_ACCESS';
        description = `Acceso a número de teléfono - ${targetData.username || 'Usuario'}`;
        break;

      case 'image_message':
        pointsCost = pointsService.POINTS_CONFIG.ACTIONS.IMAGE_MESSAGE;
        actionType = 'IMAGE_MESSAGE';
        description = 'Envío de mensaje con imagen';
        break;

      case 'extra_favorite':
        pointsCost = pointsService.POINTS_CONFIG.ACTIONS.EXTRA_FAVORITE;
        actionType = 'EXTRA_FAVORITE';
        description = 'Favorito adicional permanente';
        
        // Incrementar límite de favoritos
        await prisma.client.update({
          where: { id: clientId },
          data: {
            maxFavorites: { increment: 1 }
          }
        });
        break;

      case 'profile_boost':
        pointsCost = pointsService.POINTS_CONFIG.ACTIONS.PROFILE_BOOST;
        actionType = 'PROFILE_BOOST';
        description = 'Boost de perfil por 12 horas';
        
        // Aquí podrías implementar la lógica del boost
        // Por ahora solo registramos la transacción
        break;

      case 'chat_priority':
        pointsCost = pointsService.POINTS_CONFIG.ACTIONS.CHAT_PRIORITY;
        actionType = 'CHAT_PRIORITY';
        description = 'Prioridad en chat por 48 horas';
        
        // Implementar lógica de prioridad en chat
        break;

      default:
        throw new Error('Acción no válida');
    }

    // Gastar puntos
    const result = await pointsService.spendPoints(
      clientId,
      pointsCost,
      actionType,
      description,
      {
        action,
        targetData,
        userId,
        source: 'action_use'
      }
    );

    logger.info('Points used for action', {
      userId,
      clientId,
      action,
      pointsCost,
      newBalance: result.newBalance
    });

    return {
      success: true,
      action,
      pointsSpent: pointsCost,
      newBalance: result.newBalance,
      description
    };
  } catch (error) {
    logger.error('Error using points for action:', error);
    throw error;
  }
};

/**
 * Obtener estadísticas del usuario
 */
const getUserStatistics = async (userId) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        client: true,
        escort: true,
        agency: true,
        reputation: true,
        _count: {
          select: {
            posts: { where: { isActive: true } },
            favorites: true,
            likes: true,
            sentMessages: true,
            receivedMessages: true
          }
        }
      }
    });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    const baseStats = {
      userId: user.id,
      userType: user.userType,
      joinDate: user.createdAt,
      lastActive: user.lastActiveAt,
      profileViews: user.profileViews,
      reputation: user.reputation,
      activity: {
        postsCreated: user._count.posts,
        messagesSent: user._count.sentMessages,
        messagesReceived: user._count.receivedMessages,
        likesGiven: user._count.likes,
        favoritesAdded: user._count.favorites
      }
    };

    // Estadísticas específicas por tipo de usuario
    if (user.userType === 'CLIENT' && user.client) {
      try {
        const pointsData = await pointsService.getClientPoints(user.client.id);
        const limits = await getClientLimits(user.client.id);
        
        baseStats.client = {
          points: pointsData,
          limits,
          premiumHistory: await getPremiumHistory(user.client.id),
          pointsHistory: await getPointsUsageStats(user.client.id)
        };
      } catch (error) {
        logger.warn('Error getting client stats', { userId, error: error.message });
      }
    }

    if (user.userType === 'ESCORT' && user.escort) {
      baseStats.escort = {
        isVerified: user.escort.isVerified,
        rating: user.escort.rating,
        totalRatings: user.escort.totalRatings,
        currentPosts: user.escort.currentPosts,
        maxPosts: user.escort.maxPosts,
        totalBookings: user.escort.totalBookings,
        completedBookings: user.escort.completedBookings
      };
    }

    if (user.userType === 'AGENCY' && user.agency) {
      baseStats.agency = {
        isVerified: user.agency.isVerified,
        totalEscorts: user.agency.totalEscorts,
        verifiedEscorts: user.agency.verifiedEscorts,
        activeEscorts: user.agency.activeEscorts,
        totalVerifications: user.agency.totalVerifications
      };
    }

    return baseStats;
  } catch (error) {
    logger.error('Error getting user statistics:', error);
    throw error;
  }
};

/**
 * Obtener historial de premium del cliente
 */
const getPremiumHistory = async (clientId) => {
  try {
    const history = await prisma.premiumActivation.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    return history.map(activation => ({
      id: activation.id,
      tier: activation.tier,
      duration: activation.duration,
      pointsCost: activation.pointsCost,
      activatedAt: activation.activatedAt,
      expiresAt: activation.expiresAt,
      isActive: activation.isActive,
      activatedBy: activation.activatedBy
    }));
  } catch (error) {
    logger.error('Error getting premium history:', error);
    return [];
  }
};

/**
 * Obtener estadísticas de uso de puntos
 */
const getPointsUsageStats = async (clientId) => {
  try {
    const [totalStats, recentTransactions] = await Promise.all([
      prisma.pointTransaction.groupBy({
        by: ['type'],
        where: { clientId },
        _sum: { amount: true },
        _count: true
      }),
      prisma.pointTransaction.findMany({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          type: true,
          amount: true,
          description: true,
          createdAt: true
        }
      })
    ]);

    const byType = totalStats.reduce((acc, stat) => {
      acc[stat.type] = {
        total: stat._sum.amount || 0,
        count: stat._count
      };
      return acc;
    }, {});

    return {
      byType,
      recentTransactions
    };
  } catch (error) {
    logger.error('Error getting points usage stats:', error);
    return { byType: {}, recentTransactions: [] };
  }
};

/**
 * Limpiar usuarios inactivos y datos antiguos
 */
const cleanupInactiveUsers = async () => {
  try {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    // Marcar como inactivos usuarios que no han estado activos en 1 año
    const inactiveCount = await prisma.user.updateMany({
      where: {
        lastActiveAt: {
          lt: oneYearAgo
        },
        isActive: true,
        userType: { not: 'ADMIN' } // No desactivar admins automáticamente
      },
      data: {
        isActive: false
      }
    });

    // Limpiar premium expirado hace más de 6 meses
    await prisma.premiumActivation.deleteMany({
      where: {
        isActive: false,
        expiresAt: {
          lt: sixMonthsAgo
        }
      }
    });

    logger.info('Inactive users cleanup completed', {
      inactiveUsersMarked: inactiveCount.count
    });

    return {
      inactiveUsersMarked: inactiveCount.count
    };
  } catch (error) {
    logger.error('Error cleaning up inactive users:', error);
    throw error;
  }
};

/**
 * Obtener usuarios que necesitan reset diario
 */
const getUsersNeedingDailyReset = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const users = await prisma.client.findMany({
      where: {
        OR: [
          { lastMessageReset: { lt: today } },
          { lastMessageReset: null }
        ],
        messagesUsedToday: { gt: 0 }
      },
      select: {
        id: true,
        userId: true,
        messagesUsedToday: true,
        lastMessageReset: true,
        user: {
          select: {
            username: true,
            isActive: true
          }
        }
      }
    });

    return users.filter(user => user.user.isActive);
  } catch (error) {
    logger.error('Error getting users needing daily reset:', error);
    return [];
  }
};

/**
 * Aplicar reset diario masivo
 */
const performDailyReset = async () => {
  try {
    const usersToReset = await getUsersNeedingDailyReset();
    
    if (usersToReset.length === 0) {
      logger.info('No users need daily reset');
      return { resetCount: 0 };
    }

    const resetPromises = usersToReset.map(user => 
      resetDailyLimits(user.id)
    );

    await Promise.all(resetPromises);

    logger.info('Daily reset completed', {
      resetCount: usersToReset.length,
      resetUsers: usersToReset.map(u => u.user.username)
    });

    return { resetCount: usersToReset.length };
  } catch (error) {
    logger.error('Error performing daily reset:', error);
    throw error;
  }
};

// ============================================================================
// EXPORTAR MÓDULO
// ============================================================================

module.exports = {
  getUserProfile,
  updateClientLimits,
  getClientLimits,
  resetDailyLimits,
  checkPremiumExpiration,
  applyPremiumBenefits,
  removePremiumBenefits,
  incrementMessageUsage,
  canUserPerformAction,
  usePointsForAction,
  getUserStatistics,
  getPremiumHistory,
  getPointsUsageStats,
  cleanupInactiveUsers,
  getUsersNeedingDailyReset,
  performDailyReset,
  DEFAULT_LIMITS
};