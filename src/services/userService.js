const { prisma } = require('../config/database');
const logger = require('../utils/logger');

// Buscar usuarios con filtros avanzados
const searchUsersAdvanced = async (filters, pagination, currentUserId = null) => {
  const {
    query,
    userType,
    locationId,
    isVerified,
    ageMin,
    ageMax,
    services,
    priceRange,
    rating,
    languages,
    bodyType,
    ethnicity,
    isOnline
  } = filters;

  const { page = 1, limit = 20, sortBy = 'relevance' } = pagination;
  const skip = (page - 1) * limit;

  // Construir filtros base
  const where = {
    isActive: true,
    isBanned: false,
    settings: {
      showInSearch: true
    }
  };

  // Excluir usuario actual
  if (currentUserId) {
    where.id = { not: currentUserId };
  }

  // Filtro de texto
  if (query) {
    where.OR = [
      { username: { contains: query, mode: 'insensitive' } },
      { firstName: { contains: query, mode: 'insensitive' } },
      { lastName: { contains: query, mode: 'insensitive' } },
      { bio: { contains: query, mode: 'insensitive' } }
    ];
  }

  // Filtro por tipo de usuario
  if (userType && ['ESCORT', 'AGENCY'].includes(userType)) {
    where.userType = userType;
  }

  // Filtro por ubicación
  if (locationId) {
    where.locationId = locationId;
  }

  // Filtros específicos para escorts
  if (userType === 'ESCORT') {
    const escortFilters = {};

    if (isVerified === 'true') {
      escortFilters.isVerified = true;
    }

    if (ageMin || ageMax) {
      escortFilters.age = {};
      if (ageMin) escortFilters.age.gte = parseInt(ageMin);
      if (ageMax) escortFilters.age.lte = parseInt(ageMax);
    }

    if (services && Array.isArray(services) && services.length > 0) {
      escortFilters.services = {
        hasSome: services
      };
    }

    if (rating) {
      escortFilters.rating = {
        gte: parseFloat(rating)
      };
    }

    if (languages && Array.isArray(languages) && languages.length > 0) {
      escortFilters.languages = {
        hasSome: languages
      };
    }

    if (bodyType) {
      escortFilters.bodyType = bodyType;
    }

    if (ethnicity) {
      escortFilters.ethnicity = ethnicity;
    }

    if (Object.keys(escortFilters).length > 0) {
      where.escort = escortFilters;
    }
  }

  // Filtros específicos para agencias
  if (userType === 'AGENCY') {
    const agencyFilters = {};

    if (isVerified === 'true') {
      agencyFilters.isVerified = true;
    }

    if (Object.keys(agencyFilters).length > 0) {
      where.agency = agencyFilters;
    }
  }

  // Filtro de usuarios online (últimos 15 minutos)
  if (isOnline === 'true') {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    where.lastActiveAt = {
      gte: fifteenMinutesAgo
    };
  }

  // Construir ordenamiento
  let orderBy = {};
  switch (sortBy) {
    case 'newest':
      orderBy = { createdAt: 'desc' };
      break;
    case 'oldest':
      orderBy = { createdAt: 'asc' };
      break;
    case 'popular':
      orderBy = [
        { profileViews: 'desc' },
        { reputation: { overallScore: 'desc' } }
      ];
      break;
    case 'rating':
      orderBy = [
        { reputation: { overallScore: 'desc' } },
        { profileViews: 'desc' }
      ];
      break;
    case 'online':
      orderBy = [
        { lastActiveAt: 'desc' },
        { reputation: { discoveryScore: 'desc' } }
      ];
      break;
    case 'distance':
      // En una implementación real, usarías coordenadas geográficas
      orderBy = { createdAt: 'desc' };
      break;
    default:
      orderBy = [
        { reputation: { discoveryScore: 'desc' } },
        { reputation: { overallScore: 'desc' } }
      ];
  }

  try {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          escort: {
            select: {
              isVerified: true,
              rating: true,
              totalRatings: true,
              age: true,
              height: true,
              weight: true,
              bodyType: true,
              ethnicity: true,
              hairColor: true,
              eyeColor: true,
              services: true,
              languages: true,
              rates: true,
              availability: true
            }
          },
          agency: {
            select: {
              isVerified: true,
              totalEscorts: true,
              activeEscorts: true,
              verifiedEscorts: true
            }
          },
          location: true,
          reputation: {
            select: {
              overallScore: true,
              discoveryScore: true,
              trustScore: true
            }
          },
          _count: {
            select: {
              posts: { where: { isActive: true } }
            }
          }
        },
        orderBy,
        skip,
        take: limit
      }),
      prisma.user.count({ where })
    ]);

    return {
      users,
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
    logger.error('Error in advanced user search:', error);
    throw error;
  }
};

// Obtener usuarios recomendados basados en el algoritmo
const getRecommendedUsers = async (userId, userType, limit = 20) => {
  try {
    // Obtener interacciones del usuario para personalizar recomendaciones
    const userInteractions = await prisma.userInteraction.findMany({
      where: { userId },
      select: {
        targetUserId: true,
        type: true,
        weight: true
      },
      take: 100,
      orderBy: { createdAt: 'desc' }
    });

    // Obtener IDs de usuarios con los que ya interactuó
    const interactedUserIds = [...new Set(userInteractions.map(i => i.targetUserId))];

    // Filtros base
    const where = {
      isActive: true,
      isBanned: false,
      id: { 
        not: userId,
        notIn: interactedUserIds // Excluir usuarios con los que ya interactuó
      },
      settings: {
        showInDiscovery: true
      }
    };

    // Filtrar por tipo de usuario según el contexto
    if (userType === 'CLIENT') {
      where.userType = { in: ['ESCORT', 'AGENCY'] };
    } else if (userType === 'ESCORT') {
      where.userType = { in: ['CLIENT', 'AGENCY'] };
    } else if (userType === 'AGENCY') {
      where.userType = { in: ['ESCORT', 'CLIENT'] };
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        escort: {
          select: {
            isVerified: true,
            rating: true,
            totalRatings: true,
            services: true
          }
        },
        agency: {
          select: {
            isVerified: true,
            totalEscorts: true,
            activeEscorts: true
          }
        },
        location: true,
        reputation: {
          select: {
            overallScore: true,
            discoveryScore: true,
            trustScore: true
          }
        },
        _count: {
          select: {
            posts: { where: { isActive: true } }
          }
        }
      },
      orderBy: [
        { reputation: { discoveryScore: 'desc' } },
        { reputation: { overallScore: 'desc' } },
        { profileViews: 'desc' }
      ],
      take: limit
    });

    return users;
  } catch (error) {
    logger.error('Error getting recommended users:', error);
    throw error;
  }
};

// Actualizar score de descubrimiento de usuarios
const updateDiscoveryScores = async () => {
  try {
    // Obtener todos los usuarios activos
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        isBanned: false
      },
      include: {
        reputation: true,
        escort: true,
        agency: true,
        _count: {
          select: {
            posts: { where: { isActive: true } },
            likes: true,
            favorites: true
          }
        }
      }
    });

    const updatePromises = users.map(async (user) => {
      const now = new Date();
      const daysSinceCreated = Math.floor((now - user.createdAt) / (1000 * 60 * 60 * 24));
      const daysSinceLastActive = user.lastActiveAt 
        ? Math.floor((now - user.lastActiveAt) / (1000 * 60 * 60 * 24))
        : 30;

      let discoveryScore = 50; // Base score

      // Factor de actividad reciente (30% del score)
      if (daysSinceLastActive === 0) discoveryScore += 15;
      else if (daysSinceLastActive <= 1) discoveryScore += 12;
      else if (daysSinceLastActive <= 3) discoveryScore += 8;
      else if (daysSinceLastActive <= 7) discoveryScore += 4;
      else if (daysSinceLastActive <= 14) discoveryScore += 2;
      else if (daysSinceLastActive > 30) discoveryScore -= 10;

      // Factor de completitud del perfil (20% del score)
      const profileCompleteness = user.reputation?.profileCompleteness || 0;
      discoveryScore += (profileCompleteness / 100) * 10;

      // Factor de verificación (15% del score)
      if (user.userType === 'ESCORT' && user.escort?.isVerified) discoveryScore += 8;
      if (user.userType === 'AGENCY' && user.agency?.isVerified) discoveryScore += 8;

      // Factor de engagement (20% del score)
      const postsCount = user._count.posts;
      const likesCount = user._count.likes;
      const favoritesCount = user._count.favorites;
      
      if (postsCount > 0) discoveryScore += 3;
      if (postsCount >= 3) discoveryScore += 2;
      if (likesCount > 10) discoveryScore += 3;
      if (favoritesCount > 5) discoveryScore += 2;

      // Factor de novedad (10% del score)
      if (daysSinceCreated <= 7) discoveryScore += 5; // Boost para nuevos usuarios
      if (daysSinceCreated <= 30) discoveryScore += 3;

      // Factor de reputación (5% del score)
      const overallScore = user.reputation?.overallScore || 0;
      discoveryScore += (overallScore / 100) * 2;

      // Normalizar score entre 0 y 100
      discoveryScore = Math.max(0, Math.min(100, discoveryScore));

      return prisma.userReputation.update({
        where: { userId: user.id },
        data: {
          discoveryScore,
          lastScoreUpdate: now
        }
      });
    });

    await Promise.all(updatePromises);
    logger.info('Discovery scores updated for all users');
  } catch (error) {
    logger.error('Error updating discovery scores:', error);
    throw error;
  }
};

// Actualizar score de trending de usuarios
const updateTrendingScores = async () => {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Obtener interacciones recientes para cada usuario
    const recentInteractions = await prisma.userInteraction.groupBy({
      by: ['targetUserId'],
      where: {
        createdAt: {
          gte: last7Days
        },
        targetUserId: { not: null }
      },
      _count: {
        id: true
      },
      _sum: {
        weight: true
      }
    });

    const updatePromises = recentInteractions.map(async (interaction) => {
      const userId = interaction.targetUserId;
      if (!userId) return;

      // Obtener interacciones específicas de las últimas 24 horas
      const recent24hInteractions = await prisma.userInteraction.count({
        where: {
          targetUserId: userId,
          createdAt: {
            gte: last24Hours
          }
        }
      });

      let trendingScore = 0;

      // Factor de interacciones recientes (60% del score)
      const totalInteractions = interaction._count.id || 0;
      const interactionWeight = interaction._sum.weight || 0;
      
      trendingScore += Math.min(30, totalInteractions * 2); // Máximo 30 puntos
      trendingScore += Math.min(20, interactionWeight); // Máximo 20 puntos

      // Factor de velocidad de crecimiento (40% del score)
      trendingScore += Math.min(20, recent24hInteractions * 5); // Máximo 20 puntos

      // Bonus por actividad muy reciente
      if (recent24hInteractions > 5) trendingScore += 10;

      // Normalizar score entre 0 y 100
      trendingScore = Math.max(0, Math.min(100, trendingScore));

      return prisma.userReputation.update({
        where: { userId },
        data: {
          trendingScore,
          lastScoreUpdate: now
        }
      });
    });

    await Promise.all(updatePromises);
    logger.info('Trending scores updated for active users');
  } catch (error) {
    logger.error('Error updating trending scores:', error);
    throw error;
  }
};

// Obtener estadísticas de usuario
const getUserStats = async (userId) => {
  try {
    const stats = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        profileViews: true,
        createdAt: true,
        lastActiveAt: true,
        _count: {
          select: {
            posts: { where: { isActive: true } },
            likes: true,
            favorites: true,
            sentMessages: true,
            receivedMessages: true,
            interactions: true,
            receivedInteractions: true
          }
        },
        reputation: {
          select: {
            overallScore: true,
            responseRate: true,
            profileCompleteness: true,
            trustScore: true,
            discoveryScore: true,
            trendingScore: true,
            totalViews: true,
            totalLikes: true,
            totalMessages: true,
            totalFavorites: true
          }
        }
      }
    });

    if (!stats) {
      throw new Error('Usuario no encontrado');
    }

    // Calcular estadísticas adicionales
    const daysSinceJoined = Math.floor((new Date() - stats.createdAt) / (1000 * 60 * 60 * 24));
    const daysSinceLastActive = stats.lastActiveAt 
      ? Math.floor((new Date() - stats.lastActiveAt) / (1000 * 60 * 60 * 24))
      : null;

    return {
      ...stats,
      derived: {
        daysSinceJoined,
        daysSinceLastActive,
        averagePostsPerMonth: daysSinceJoined > 0 
          ? Math.round((stats._count.posts / daysSinceJoined) * 30 * 100) / 100
          : 0,
        engagementRate: stats._count.posts > 0 
          ? Math.round(((stats._count.likes + stats._count.favorites) / stats._count.posts) * 100) / 100
          : 0
      }
    };
  } catch (error) {
    logger.error('Error getting user stats:', error);
    throw error;
  }
};

// Bloquear/desbloquear usuario
const toggleUserBlock = async (blockerId, blockedId, reason = null) => {
  try {
    if (blockerId === blockedId) {
      throw new Error('No puedes bloquearte a ti mismo');
    }

    // Verificar si ya existe el bloqueo
    const existingBlock = await prisma.userBlock.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId
        }
      }
    });

    if (existingBlock) {
      // Desbloquear
      await prisma.userBlock.delete({
        where: { id: existingBlock.id }
      });

      logger.info('User unblocked', { blockerId, blockedId });
      return { action: 'unblocked', isBlocked: false };
    } else {
      // Bloquear
      await prisma.userBlock.create({
        data: {
          blockerId,
          blockedId,
          reason
        }
      });

      logger.info('User blocked', { blockerId, blockedId, reason });
      return { action: 'blocked', isBlocked: true };
    }
  } catch (error) {
    logger.error('Error toggling user block:', error);
    throw error;
  }
};

// Obtener usuarios bloqueados
const getBlockedUsers = async (userId, pagination = {}) => {
  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  try {
    const [blocks, total] = await Promise.all([
      prisma.userBlock.findMany({
        where: { blockerId: userId },
        include: {
          blocked: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true,
              userType: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.userBlock.count({ where: { blockerId: userId } })
    ]);

    return {
      blocks: blocks.map(block => ({
        id: block.id,
        reason: block.reason,
        createdAt: block.createdAt,
        user: block.blocked
      })),
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
    logger.error('Error getting blocked users:', error);
    throw error;
  }
};

// Verificar si un usuario está bloqueado
const isUserBlocked = async (blockerId, blockedId) => {
  try {
    const block = await prisma.userBlock.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId
        }
      }
    });

    return !!block;
  } catch (error) {
    logger.error('Error checking if user is blocked:', error);
    return false;
  }
};

// Actualizar última actividad del usuario
const updateUserActivity = async (userId, activityData = {}) => {
  try {
    const updateData = {
      lastActiveAt: new Date()
    };

    // Actualizar IP si se proporciona
    if (activityData.ip) {
      updateData.lastLoginIP = activityData.ip;
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    // Opcional: registrar interacción de actividad
    if (activityData.source) {
      await prisma.userInteraction.create({
        data: {
          userId,
          type: 'VIEW',
          weight: 0.1, // Peso muy bajo para actividad general
          source: activityData.source,
          deviceType: activityData.deviceType,
          sessionId: activityData.sessionId
        }
      }).catch(() => {}); // No fallar por error en tracking
    }

  } catch (error) {
    logger.error('Error updating user activity:', error);
    // No lanzar error ya que esto es tracking secundario
  }
};

// Limpiar datos antiguos de usuarios
const cleanupUserData = async () => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    // Limpiar historial de búsquedas antiguo
    await prisma.searchHistory.deleteMany({
      where: {
        createdAt: {
          lt: thirtyDaysAgo
        }
      }
    });

    // Limpiar interacciones muy antiguas (mantener solo del último año)
    await prisma.userInteraction.deleteMany({
      where: {
        createdAt: {
          lt: oneYearAgo
        }
      }
    });

    // Limpiar device tokens inactivos
    await prisma.deviceToken.deleteMany({
      where: {
        isActive: false,
        lastUsedAt: {
          lt: thirtyDaysAgo
        }
      }
    });

    logger.info('User data cleanup completed');
  } catch (error) {
    logger.error('Error cleaning up user data:', error);
    throw error;
  }
};

// Obtener configuraciones de usuario
const getUserSettings = async (userId) => {
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId }
    });

    if (!settings) {
      // Crear configuraciones por defecto si no existen
      return await prisma.userSettings.create({
        data: {
          userId,
          emailNotifications: true,
          pushNotifications: true,
          messageNotifications: true,
          likeNotifications: true,
          boostNotifications: true,
          showOnline: true,
          showLastSeen: true,
          allowDirectMessages: true,
          showPhoneNumber: false,
          showInDiscovery: true,
          showInTrending: true,
          showInSearch: true,
          contentFilter: 'MODERATE'
        }
      });
    }

    return settings;
  } catch (error) {
    logger.error('Error getting user settings:', error);
    throw error;
  }
};

// Actualizar configuraciones de usuario
const updateUserSettings = async (userId, settings) => {
  try {
    const updatedSettings = await prisma.userSettings.upsert({
      where: { userId },
      update: {
        ...settings,
        updatedAt: new Date()
      },
      create: {
        userId,
        ...settings
      }
    });

    logger.info('User settings updated', { userId, settingsUpdated: Object.keys(settings) });
    return updatedSettings;
  } catch (error) {
    logger.error('Error updating user settings:', error);
    throw error;
  }
};

module.exports = {
  searchUsersAdvanced,
  getRecommendedUsers,
  updateDiscoveryScores,
  updateTrendingScores,
  getUserStats,
  toggleUserBlock,
  getBlockedUsers,
  isUserBlocked,
  updateUserActivity,
  cleanupUserData,
  getUserSettings,
  updateUserSettings
};