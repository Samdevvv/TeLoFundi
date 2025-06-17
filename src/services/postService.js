const { prisma } = require('../config/database');
const logger = require('../utils/logger');

// Calcular scores de algoritmo para posts
const calculatePostScores = async (postId) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          include: {
            reputation: true,
            escort: true,
            agency: true
          }
        },
        likes: true,
        favorites: true,
        interactions: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24 horas
            }
          }
        },
        boosts: {
          where: {
            isActive: true,
            expiresAt: { gt: new Date() }
          }
        }
      }
    });

    if (!post) return null;

    // Factores para el algoritmo
    const factors = {
      // Factor tiempo (posts más recientes tienen ventaja)
      timeFactor: calculateTimeFactor(post.createdAt),
      
      // Factor engagement (likes, favorites, interactions)
      engagementFactor: calculateEngagementFactor(post),
      
      // Factor de calidad del autor
      authorQualityFactor: calculateAuthorQualityFactor(post.author),
      
      // Factor de boost activo
      boostFactor: calculateBoostFactor(post.boosts),
      
      // Factor de completitud del post
      contentQualityFactor: calculateContentQualityFactor(post),
      
      // Factor de localización (relevancia geográfica)
      locationFactor: calculateLocationFactor(post)
    };

    // Calcular scores finales
    const discoveryScore = calculateDiscoveryScore(factors);
    const trendingScore = calculateTrendingScore(factors, post.interactions);
    const qualityScore = calculateQualityScore(factors);
    const overallScore = calculateOverallPostScore(factors);

    // Actualizar post con nuevos scores
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        discoveryScore,
        trendingScore,
        qualityScore,
        score: overallScore,
        engagementRate: factors.engagementFactor.rate,
        lastScoreUpdate: new Date()
      }
    });

    logger.debug('Post scores calculated', {
      postId,
      scores: { discoveryScore, trendingScore, qualityScore, overallScore },
      factors: Object.keys(factors)
    });

    return {
      postId,
      scores: {
        discovery: discoveryScore,
        trending: trendingScore,
        quality: qualityScore,
        overall: overallScore
      },
      factors
    };
  } catch (error) {
    logger.error('Error calculating post scores:', error);
    return null;
  }
};

// Factor tiempo - posts recientes tienen ventaja
const calculateTimeFactor = (createdAt) => {
  const hoursAgo = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  
  if (hoursAgo < 1) return 1.0;
  if (hoursAgo < 6) return 0.9;
  if (hoursAgo < 24) return 0.8;
  if (hoursAgo < 72) return 0.6;
  if (hoursAgo < 168) return 0.4; // 1 semana
  return 0.2;
};

// Factor engagement - interacciones del post
const calculateEngagementFactor = (post) => {
  const likesCount = post.likes?.length || 0;
  const favoritesCount = post.favorites?.length || 0;
  const views = post.views || 1; // Evitar división por 0
  
  const engagementRate = ((likesCount + favoritesCount * 2) / views) * 100;
  const normalizedRate = Math.min(100, engagementRate);
  
  return {
    rate: normalizedRate,
    factor: Math.min(1.5, normalizedRate / 50) // Max 1.5x boost
  };
};

// Factor calidad del autor
const calculateAuthorQualityFactor = (author) => {
  let factor = 0.5; // Base factor
  
  if (author.reputation) {
    factor += (author.reputation.overallScore / 100) * 0.3;
    factor += (author.reputation.trustScore / 100) * 0.2;
  }
  
  // Bonus por verificación
  if (author.escort?.isVerified || author.agency?.isVerified) {
    factor += 0.2;
  }
  
  // Bonus por rating alto (para escorts)
  if (author.escort?.rating && author.escort.rating > 4.0) {
    factor += 0.1;
  }
  
  return Math.min(1.5, factor);
};

// Factor boost activo
const calculateBoostFactor = (boosts) => {
  if (!boosts || boosts.length === 0) return 1.0;
  
  const activeBoost = boosts[0];
  const multiplier = activeBoost.pricing?.multiplier || 1.5;
  
  // Verificar si el boost sigue activo
  if (new Date() < activeBoost.expiresAt) {
    return multiplier;
  }
  
  return 1.0;
};

// Factor calidad del contenido
const calculateContentQualityFactor = (post) => {
  let factor = 0.3; // Base
  
  // Bonus por título descriptivo
  if (post.title && post.title.length >= 10) {
    factor += 0.1;
  }
  
  // Bonus por descripción completa
  if (post.description && post.description.length >= 50) {
    factor += 0.2;
  }
  
  // Bonus por imágenes
  const imageCount = post.images?.length || 0;
  factor += Math.min(0.3, imageCount * 0.1);
  
  // Bonus por información adicional
  if (post.services && post.services.length > 0) {
    factor += 0.1;
  }
  
  if (post.rates) {
    factor += 0.1;
  }
  
  return Math.min(1.0, factor);
};

// Factor localización
const calculateLocationFactor = (post) => {
  // Por ahora factor neutral, puede mejorarse con geolocalización
  return post.locationId ? 1.1 : 1.0;
};

// Score de descubrimiento
const calculateDiscoveryScore = (factors) => {
  const score = (
    factors.timeFactor * 30 +
    factors.engagementFactor.factor * 25 +
    factors.authorQualityFactor * 25 +
    factors.contentQualityFactor * 20
  ) * factors.locationFactor;
  
  return Math.min(100, Math.max(0, score));
};

// Score de trending
const calculateTrendingScore = (factors, recentInteractions) => {
  const recentEngagement = recentInteractions?.length || 0;
  const velocityBonus = Math.min(30, recentEngagement * 3); // Bonus por engagement reciente
  
  const score = (
    factors.timeFactor * 40 +
    factors.engagementFactor.factor * 30 +
    velocityBonus +
    factors.boostFactor * 10
  );
  
  return Math.min(100, Math.max(0, score));
};

// Score de calidad general
const calculateQualityScore = (factors) => {
  const score = (
    factors.contentQualityFactor * 40 +
    factors.authorQualityFactor * 35 +
    factors.engagementFactor.factor * 25
  );
  
  return Math.min(100, Math.max(0, score));
};

// Score general del post
const calculateOverallPostScore = (factors) => {
  const score = (
    factors.timeFactor * 20 +
    factors.engagementFactor.factor * 25 +
    factors.authorQualityFactor * 20 +
    factors.contentQualityFactor * 15 +
    factors.boostFactor * 20
  ) * factors.locationFactor;
  
  return Math.min(100, Math.max(0, score));
};

// Actualizar todos los scores de posts activos
const updateAllPostScores = async (batchSize = 100) => {
  try {
    let offset = 0;
    let totalProcessed = 0;
    let hasMore = true;

    while (hasMore) {
      const posts = await prisma.post.findMany({
        where: {
          isActive: true,
          deletedAt: null
        },
        select: { id: true },
        orderBy: { lastScoreUpdate: 'asc' },
        skip: offset,
        take: batchSize
      });

      if (posts.length === 0) {
        hasMore = false;
        break;
      }

      // Procesar posts en paralelo con límite
      const scorePromises = posts.map(post => calculatePostScores(post.id));
      await Promise.allSettled(scorePromises);

      totalProcessed += posts.length;
      offset += batchSize;

      logger.info('Post scores batch processed', {
        batch: Math.ceil(offset / batchSize),
        processed: posts.length,
        totalProcessed
      });

      // Pequeña pausa para evitar sobrecarga
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info('All post scores updated', { totalProcessed });
    return { processed: totalProcessed };
  } catch (error) {
    logger.error('Error updating all post scores:', error);
    throw error;
  }
};

// Obtener posts trending actuales
const getTrendingPosts = async (limit = 50, timeframe = 24) => {
  try {
    const timeLimit = new Date(Date.now() - timeframe * 60 * 60 * 1000);

    const trendingPosts = await prisma.post.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        createdAt: { gte: timeLimit },
        trendingScore: { gt: 10 }
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            userType: true,
            escort: {
              select: {
                isVerified: true,
                rating: true
              }
            },
            agency: {
              select: {
                isVerified: true
              }
            }
          }
        },
        _count: {
          select: {
            likes: true,
            favorites: true
          }
        }
      },
      orderBy: [
        { trendingScore: 'desc' },
        { engagementRate: 'desc' },
        { views: 'desc' }
      ],
      take: limit
    });

    // Marcar como trending y registrar en historial
    const trendingIds = trendingPosts.map(post => post.id);
    
    await Promise.all([
      // Marcar como trending
      prisma.post.updateMany({
        where: { id: { in: trendingIds } },
        data: { isTrending: true }
      }),
      
      // Registrar en historial
      ...trendingPosts.map((post, index) =>
        prisma.trendingHistory.create({
          data: {
            postId: post.id,
            position: index + 1,
            score: post.trendingScore,
            category: `${timeframe}h`
          }
        }).catch(() => {}) // Ignorar errores de duplicados
      )
    ]);

    return trendingPosts.map(post => ({
      id: post.id,
      title: post.title,
      description: post.description,
      images: post.images,
      trendingScore: post.trendingScore,
      engagementRate: post.engagementRate,
      views: post.views,
      createdAt: post.createdAt,
      author: post.author,
      stats: {
        likes: post._count.likes,
        favorites: post._count.favorites
      }
    }));
  } catch (error) {
    logger.error('Error getting trending posts:', error);
    return [];
  }
};

// Limpiar posts expirados o inactivos
const cleanupExpiredPosts = async () => {
  try {
    const now = new Date();
    
    // Desactivar posts expirados
    const expiredResult = await prisma.post.updateMany({
      where: {
        isActive: true,
        expiresAt: { lt: now }
      },
      data: {
        isActive: false,
        deletedAt: now
      }
    });

    // Limpiar trending de posts antiguos
    const trendingResult = await prisma.post.updateMany({
      where: {
        isTrending: true,
        createdAt: {
          lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 días
        }
      },
      data: { isTrending: false }
    });

    // Limpiar boosts expirados
    const boostResult = await prisma.boost.updateMany({
      where: {
        isActive: true,
        expiresAt: { lt: now }
      },
      data: { isActive: false }
    });

    logger.info('Post cleanup completed', {
      expiredPosts: expiredResult.count,
      trendingCleared: trendingResult.count,
      expiredBoosts: boostResult.count
    });

    return {
      expiredPosts: expiredResult.count,
      trendingCleared: trendingResult.count,
      expiredBoosts: boostResult.count
    };
  } catch (error) {
    logger.error('Error cleaning up expired posts:', error);
    throw error;
  }
};

// Obtener estadísticas de post específico
const getPostAnalytics = async (postId, userId) => {
  try {
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        authorId: userId // Solo el autor puede ver analytics
      },
      include: {
        boosts: {
          orderBy: { createdAt: 'desc' }
        },
        interactions: {
          include: {
            user: {
              select: {
                userType: true,
                location: {
                  select: {
                    country: true,
                    city: true
                  }
                }
              }
            }
          }
        },
        trendingHistory: {
          orderBy: { date: 'desc' },
          take: 10
        }
      }
    });

    if (!post) return null;

    // Agrupar interacciones por tipo
    const interactionsByType = post.interactions.reduce((acc, interaction) => {
      const type = interaction.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(interaction);
      return acc;
    }, {});

    // Agrupar por tipo de usuario
    const interactionsByUserType = post.interactions.reduce((acc, interaction) => {
      const userType = interaction.user?.userType || 'UNKNOWN';
      acc[userType] = (acc[userType] || 0) + 1;
      return acc;
    }, {});

    // Agrupar por ubicación
    const interactionsByLocation = post.interactions.reduce((acc, interaction) => {
      const country = interaction.user?.location?.country || 'Unknown';
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {});

    // Métricas por día (últimos 30 días)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailyMetrics = await prisma.userInteraction.groupBy({
      by: ['createdAt'],
      where: {
        postId,
        createdAt: { gte: thirtyDaysAgo }
      },
      _count: true,
      orderBy: { createdAt: 'asc' }
    });

    // Formatear métricas diarias
    const dailyStats = dailyMetrics.reduce((acc, metric) => {
      const date = metric.createdAt.toISOString().split('T')[0];
      acc[date] = metric._count;
      return acc;
    }, {});

    // Calcular tasas de conversión
    const views = interactionsByType.VIEW?.length || 0;
    const likes = interactionsByType.LIKE?.length || 0;
    const favorites = interactionsByType.FAVORITE?.length || 0;
    const chats = interactionsByType.CHAT?.length || 0;

    const analytics = {
      overview: {
        totalViews: post.views,
        uniqueViews: post.uniqueViews,
        totalClicks: post.clicks,
        engagementRate: post.engagementRate,
        score: post.score,
        trendingScore: post.trendingScore,
        qualityScore: post.qualityScore
      },
      interactions: {
        byType: {
          views: views,
          likes: likes,
          favorites: favorites,
          chats: chats
        },
        byUserType: interactionsByUserType,
        byLocation: interactionsByLocation
      },
      conversions: {
        viewToLike: views > 0 ? (likes / views * 100).toFixed(2) : 0,
        viewToFavorite: views > 0 ? (favorites / views * 100).toFixed(2) : 0,
        viewToChat: views > 0 ? (chats / views * 100).toFixed(2) : 0
      },
      timeline: {
        daily: dailyStats,
        trending: post.trendingHistory.map(th => ({
          date: th.date,
          position: th.position,
          score: th.score
        }))
      },
      boosts: post.boosts.map(boost => ({
        id: boost.id,
        type: boost.pricing?.type,
        createdAt: boost.createdAt,
        expiresAt: boost.expiresAt,
        isActive: boost.isActive,
        viewsBefore: boost.viewsBefore,
        viewsAfter: boost.viewsAfter,
        performance: boost.viewsAfter > boost.viewsBefore ? 
          ((boost.viewsAfter - boost.viewsBefore) / boost.viewsBefore * 100).toFixed(2) : 0
      })),
      generatedAt: new Date().toISOString()
    };

    return analytics;
  } catch (error) {
    logger.error('Error getting post analytics:', error);
    return null;
  }
};

// Sugerir mejoras para el post
const getPostOptimizationSuggestions = async (postId) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          include: {
            reputation: true
          }
        },
        _count: {
          select: {
            likes: true,
            favorites: true
          }
        }
      }
    });

    if (!post) return null;

    const suggestions = [];

    // Analizar contenido
    if (!post.title || post.title.length < 10) {
      suggestions.push({
        type: 'content',
        priority: 'high',
        message: 'Agrega un título más descriptivo (mínimo 10 caracteres)',
        impact: 'Mejora la visibilidad en búsquedas'
      });
    }

    if (!post.description || post.description.length < 50) {
      suggestions.push({
        type: 'content',
        priority: 'high',
        message: 'Expande la descripción (mínimo 50 caracteres)',
        impact: 'Aumenta el engagement y la confianza'
      });
    }

    if (!post.images || post.images.length === 0) {
      suggestions.push({
        type: 'visual',
        priority: 'critical',
        message: 'Agrega al menos una imagen',
        impact: 'Los posts con imágenes tienen 10x más engagement'
      });
    } else if (post.images.length < 3) {
      suggestions.push({
        type: 'visual',
        priority: 'medium',
        message: `Agrega más imágenes (tienes ${post.images.length}, máximo 5)`,
        impact: 'Más imágenes aumentan el tiempo de visualización'
      });
    }

    // Analizar información específica
    if (!post.services || post.services.length === 0) {
      suggestions.push({
        type: 'information',
        priority: 'medium',
        message: 'Especifica los servicios que ofreces',
        impact: 'Ayuda a los clientes a encontrarte más fácilmente'
      });
    }

    if (!post.rates) {
      suggestions.push({
        type: 'information',
        priority: 'medium',
        message: 'Agrega información de tarifas',
        impact: 'Mejora la transparencia y reduce consultas innecesarias'
      });
    }

    if (!post.locationId) {
      suggestions.push({
        type: 'location',
        priority: 'high',
        message: 'Agrega tu ubicación',
        impact: 'Aumenta la relevancia en búsquedas locales'
      });
    }

    // Analizar performance
    const engagementRate = post.engagementRate || 0;
    if (engagementRate < 5) {
      suggestions.push({
        type: 'performance',
        priority: 'medium',
        message: 'Tu tasa de engagement es baja',
        impact: 'Considera actualizar el contenido o usar un boost'
      });
    }

    // Sugerencias de boost
    if (post.views < 50 && !post.lastBoosted) {
      suggestions.push({
        type: 'promotion',
        priority: 'low',
        message: 'Considera usar un boost para aumentar visibilidad',
        impact: 'Los posts boosteados reciben 3-5x más vistas'
      });
    }

    return {
      postId,
      totalSuggestions: suggestions.length,
      suggestions: suggestions.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }),
      currentScores: {
        overall: post.score,
        quality: post.qualityScore,
        engagement: engagementRate
      },
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error getting post optimization suggestions:', error);
    return null;
  }
};

module.exports = {
  calculatePostScores,
  updateAllPostScores,
  getTrendingPosts,
  cleanupExpiredPosts,
  getPostAnalytics,
  getPostOptimizationSuggestions,
  calculateTimeFactor,
  calculateEngagementFactor,
  calculateOverallPostScore
};