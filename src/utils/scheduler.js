const cron = require('node-cron');
const { prisma } = require('../config/database');
const logger = require('./logger');
const { updateAllPostScores, cleanupExpiredPosts } = require('../services/postService');
const { cleanupExpiredTokens } = require('../services/authService');

// NUEVA IMPORTACIÓN PARA CLOUDINARY
const { cleanupUnusedFiles, getCloudinaryUsage, deleteFromCloudinary } = require('../services/uploadService');

// Lista de tareas activas para poder detenerlas
const activeTasks = new Map();

// Limpiar boosts expirados - cada hora
const cleanupExpiredBoosts = cron.schedule('0 * * * *', async () => {
  try {
    logger.info('Starting expired boosts cleanup');
    
    const now = new Date();
    
    // Desactivar boosts expirados
    const expiredBoosts = await prisma.boost.updateMany({
      where: {
        isActive: true,
        expiresAt: { lt: now }
      },
      data: { 
        isActive: false 
      }
    });

    // Obtener posts que tenían boosts expirados para actualizar sus scores
    const postsWithExpiredBoosts = await prisma.post.findMany({
      where: {
        boosts: {
          some: {
            isActive: false,
            expiresAt: { lt: now, gte: new Date(now.getTime() - 60 * 60 * 1000) } // Expirados en la última hora
          }
        }
      },
      select: { id: true }
    });

    // Actualizar scores de posts afectados
    for (const post of postsWithExpiredBoosts) {
      await updateAllPostScores(1, post.id); // Actualizar solo este post
    }

    // Actualizar featured status de posts
    await prisma.post.updateMany({
      where: {
        isFeatured: true,
        boosts: {
          none: {
            isActive: true,
            pricing: {
              type: { in: ['FEATURED', 'SUPER', 'MEGA'] }
            }
          }
        }
      },
      data: { isFeatured: false }
    });

    logger.info('Expired boosts cleanup completed', {
      expiredBoosts: expiredBoosts.count,
      postsUpdated: postsWithExpiredBoosts.length
    });
  } catch (error) {
    logger.error('Error cleaning up expired boosts:', error);
  }
}, {
  scheduled: false,
  timezone: "UTC"
});

// Limpiar membresías premium expiradas - cada día a las 2 AM
const cleanupExpiredPremium = cron.schedule('0 2 * * *', async () => {
  try {
    logger.info('Starting expired premium cleanup');
    
    const now = new Date();
    
    // Encontrar clientes con premium expirado
    const expiredPremiumClients = await prisma.client.findMany({
      where: {
        isPremium: true,
        premiumUntil: { lt: now }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            email: true
          }
        }
      }
    });

    // Actualizar a básico
    const updatedClients = await prisma.client.updateMany({
      where: {
        isPremium: true,
        premiumUntil: { lt: now }
      },
      data: {
        isPremium: false,
        premiumTier: 'BASIC',
        premiumUntil: null,
        dailyMessageLimit: 10,
        canViewPhoneNumbers: false,
        canSendImages: false,
        canSendVoiceMessages: false,
        canAccessPremiumProfiles: false,
        prioritySupport: false,
        canSeeOnlineStatus: false
      }
    });

    // Crear notificaciones para clientes que perdieron premium
    for (const client of expiredPremiumClients) {
      await prisma.notification.create({
        data: {
          userId: client.user.id,
          type: 'SUBSCRIPTION_EXPIRING',
          title: 'Suscripción premium expirada',
          message: 'Tu suscripción premium ha expirado. Renueva para seguir disfrutando de los beneficios.',
          data: {
            previousTier: client.premiumTier,
            expiredAt: client.premiumUntil.toISOString()
          }
        }
      });
    }

    logger.info('Expired premium cleanup completed', {
      expiredClients: updatedClients.count,
      notificationsSent: expiredPremiumClients.length
    });
  } catch (error) {
    logger.error('Error cleaning up expired premium:', error);
  }
}, {
  scheduled: false,
  timezone: "UTC"
});

// Resetear límites diarios de mensajes - cada día a medianoche
const resetDailyLimits = cron.schedule('0 0 * * *', async () => {
  try {
    logger.info('Starting daily limits reset');
    
    // Resetear contadores de mensajes diarios
    const resetResult = await prisma.client.updateMany({
      where: {
        messagesUsedToday: { gt: 0 }
      },
      data: {
        messagesUsedToday: 0,
        lastMessageReset: new Date()
      }
    });

    // Resetear contadores de posts diarios (para views, clicks)
    await prisma.post.updateMany({
      where: {
        isActive: true
      },
      data: {
        viewsToday: 0,
        clicksToday: 0
      }
    });

    // Limpiar rate limits expirados
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const deletedRateLimits = await prisma.chatRateLimit.deleteMany({
      where: {
        windowStart: { lt: yesterday }
      }
    });

    logger.info('Daily limits reset completed', {
      clientsReset: resetResult.count,
      rateLimitsCleared: deletedRateLimits.count
    });
  } catch (error) {
    logger.error('Error resetting daily limits:', error);
  }
}, {
  scheduled: false,
  timezone: "UTC"
});

// Actualizar scores de posts - cada 6 horas
const updatePostScores = cron.schedule('0 */6 * * *', async () => {
  try {
    logger.info('Starting post scores update');
    
    const result = await updateAllPostScores(50); // Procesar en lotes de 50
    
    logger.info('Post scores update completed', {
      postsProcessed: result.processed
    });
  } catch (error) {
    logger.error('Error updating post scores:', error);
  }
}, {
  scheduled: false,
  timezone: "UTC"
});

// Limpiar posts expirados - cada 12 horas
const cleanupPosts = cron.schedule('0 */12 * * *', async () => {
  try {
    logger.info('Starting posts cleanup');
    
    const result = await cleanupExpiredPosts();
    
    logger.info('Posts cleanup completed', result);
  } catch (error) {
    logger.error('Error cleaning up posts:', error);
  }
}, {
  scheduled: false,
  timezone: "UTC"
});

// Limpiar tokens expirados - cada día a las 3 AM
const cleanupTokens = cron.schedule('0 3 * * *', async () => {
  try {
    logger.info('Starting tokens cleanup');
    
    await cleanupExpiredTokens();
    
    logger.info('Tokens cleanup completed');
  } catch (error) {
    logger.error('Error cleaning up tokens:', error);
  }
}, {
  scheduled: false,
  timezone: "UTC"
});

// NUEVA TAREA: Limpiar archivos temporales de Cloudinary - cada 6 horas
const cleanupCloudinaryTemp = cron.schedule('0 */6 * * *', async () => {
  try {
    logger.info('Starting Cloudinary temp files cleanup');
    
    // Limpiar archivos en carpeta temp de Cloudinary (más de 2 horas)
    const result = await cleanupUnusedFiles(0.1); // 0.1 días = ~2.4 horas
    
    logger.info('Cloudinary temp files cleanup completed', {
      filesDeleted: result.deleted || 0,
      success: result.success
    });
  } catch (error) {
    logger.error('Error cleaning up Cloudinary temp files:', error);
  }
}, {
  scheduled: false,
  timezone: "UTC"
});

// NUEVA TAREA: Limpiar archivos huérfanos de Cloudinary - cada domingo a las 3 AM
const cleanupCloudinaryOrphans = cron.schedule('0 3 * * 0', async () => {
  try {
    logger.info('Starting Cloudinary orphan files cleanup');
    
    // Obtener todas las URLs de archivos en la base de datos
    const [avatars, postImages, chatFiles] = await Promise.all([
      prisma.user.findMany({
        where: { 
          avatar: { not: null, contains: 'cloudinary' }
        },
        select: { avatar: true }
      }),
      prisma.post.findMany({
        where: {
          images: { not: null }
        },
        select: { images: true }
      }),
      prisma.message.findMany({
        where: {
          fileUrl: { not: null, contains: 'cloudinary' }
        },
        select: { fileUrl: true }
      })
    ]);

    // Extraer todas las URLs únicas
    const usedUrls = new Set();
    
    // Avatares
    avatars.forEach(user => {
      if (user.avatar) usedUrls.add(user.avatar);
    });
    
    // Imágenes de posts
    postImages.forEach(post => {
      if (post.images && Array.isArray(post.images)) {
        post.images.forEach(img => usedUrls.add(img));
      }
    });
    
    // Archivos de chat
    chatFiles.forEach(msg => {
      if (msg.fileUrl) usedUrls.add(msg.fileUrl);
    });

    logger.info('Cloudinary orphan cleanup analysis completed', {
      totalUrls: usedUrls.size,
      avatars: avatars.length,
      postImages: postImages.length,
      chatFiles: chatFiles.length
    });

    // Limpiar archivos antiguos no utilizados (más de 7 días)
    const cleanupResult = await cleanupUnusedFiles(7);
    
    logger.info('Cloudinary orphan files cleanup completed', {
      cleanupResult,
      referencedFiles: usedUrls.size
    });

  } catch (error) {
    logger.error('Error cleaning up Cloudinary orphan files:', error);
  }
}, {
  scheduled: false,
  timezone: "UTC"
});

// NUEVA TAREA: Verificar y reportar uso de Cloudinary - cada día a las 6 AM
const reportCloudinaryUsage = cron.schedule('0 6 * * *', async () => {
  try {
    logger.info('Starting Cloudinary usage report');
    
    const usage = await getCloudinaryUsage();
    
    if (usage) {
      const usagePercentages = {
        storage: usage.storage ? (usage.storage.used / usage.storage.limit * 100).toFixed(2) : 0,
        bandwidth: usage.bandwidth ? (usage.bandwidth.used / usage.bandwidth.limit * 100).toFixed(2) : 0,
        credits: usage.credits ? (usage.credits.used / usage.credits.limit * 100).toFixed(2) : 0
      };

      logger.info('Cloudinary usage report', {
        plan: usage.plan,
        storage: {
          used: `${(usage.storage?.used / 1024 / 1024).toFixed(2)}MB`,
          limit: `${(usage.storage?.limit / 1024 / 1024).toFixed(2)}MB`,
          percentage: `${usagePercentages.storage}%`
        },
        bandwidth: {
          used: `${(usage.bandwidth?.used / 1024 / 1024).toFixed(2)}MB`,
          limit: `${(usage.bandwidth?.limit / 1024 / 1024).toFixed(2)}MB`,
          percentage: `${usagePercentages.bandwidth}%`
        },
        credits: {
          used: usage.credits?.used || 0,
          limit: usage.credits?.limit || 0,
          percentage: `${usagePercentages.credits}%`
        },
        resources: usage.resources || 0
      });

      // Alertar si el uso es alto (>80%)
      const highUsageAlerts = [];
      if (parseFloat(usagePercentages.storage) > 80) {
        highUsageAlerts.push(`Storage: ${usagePercentages.storage}%`);
      }
      if (parseFloat(usagePercentages.bandwidth) > 80) {
        highUsageAlerts.push(`Bandwidth: ${usagePercentages.bandwidth}%`);
      }
      if (parseFloat(usagePercentages.credits) > 80) {
        highUsageAlerts.push(`Credits: ${usagePercentages.credits}%`);
      }

      if (highUsageAlerts.length > 0) {
        logger.warn('HIGH CLOUDINARY USAGE DETECTED', {
          alerts: highUsageAlerts,
          recommendation: 'Consider upgrading plan or cleaning up unused files'
        });

        // Crear notificación para administradores
        const admins = await prisma.user.findMany({
          where: { userType: 'ADMIN' },
          select: { id: true }
        });

        for (const admin of admins) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              type: 'SYSTEM_ALERT',
              title: 'Alto uso de Cloudinary detectado',
              message: `Uso alto detectado: ${highUsageAlerts.join(', ')}. Considera actualizar el plan.`,
              priority: 'HIGH',
              data: {
                usage: usagePercentages,
                alerts: highUsageAlerts
              }
            }
          });
        }
      }

      // Guardar métricas de uso en la base de datos
      await prisma.cloudinaryUsage.create({
        data: {
          plan: usage.plan,
          storageUsed: usage.storage?.used || 0,
          storageLimit: usage.storage?.limit || 0,
          bandwidthUsed: usage.bandwidth?.used || 0,
          bandwidthLimit: usage.bandwidth?.limit || 0,
          creditsUsed: usage.credits?.used || 0,
          creditsLimit: usage.credits?.limit || 0,
          totalResources: usage.resources || 0,
          recordedAt: new Date()
        }
      });

    } else {
      logger.warn('Could not retrieve Cloudinary usage data');
    }

  } catch (error) {
    logger.error('Error generating Cloudinary usage report:', error);
  }
}, {
  scheduled: false,
  timezone: "UTC"
});

// Actualizar métricas de la aplicación - cada día a las 4 AM
const updateAppMetrics = cron.schedule('0 4 * * *', async () => {
  try {
    logger.info('Starting app metrics update');
    
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Obtener métricas generales
    const [
      totalUsers,
      totalEscorts,
      totalAgencies,
      totalClients,
      totalAdmins,
      totalPosts,
      activeUsers,
      bannedUsers,
      verifiedEscorts,
      premiumClients,
      basicClients,
      vipClients,
      dailyActiveUsers,
      weeklyActiveUsers,
      monthlyActiveUsers
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { userType: 'ESCORT' } }),
      prisma.user.count({ where: { userType: 'AGENCY' } }),
      prisma.user.count({ where: { userType: 'CLIENT' } }),
      prisma.user.count({ where: { userType: 'ADMIN' } }),
      prisma.post.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isBanned: true } }),
      prisma.escort.count({ where: { isVerified: true } }),
      prisma.client.count({ where: { isPremium: true } }),
      prisma.client.count({ where: { premiumTier: 'BASIC' } }),
      prisma.client.count({ where: { premiumTier: 'VIP' } }),
      prisma.user.count({ where: { lastActiveAt: { gte: yesterday } } }),
      prisma.user.count({ where: { lastActiveAt: { gte: weekAgo } } }),
      prisma.user.count({ where: { lastActiveAt: { gte: monthAgo } } })
    ]);

    // Obtener métricas de pagos
    const paymentsResult = await prisma.payment.aggregate({
      where: {
        status: 'COMPLETED',
        completedAt: { gte: monthAgo }
      },
      _sum: { amount: true },
      _count: true
    });

    const totalRevenue = paymentsResult._sum.amount || 0;
    const totalPayments = paymentsResult._count || 0;

    // Obtener métricas de mensajes
    const totalMessages = await prisma.message.count({
      where: {
        createdAt: { gte: monthAgo }
      }
    });

    // Obtener métricas de boosts
    const totalBoosts = await prisma.boost.count({
      where: {
        createdAt: { gte: monthAgo }
      }
    });

    // NUEVAS MÉTRICAS DE CLOUDINARY
    const cloudinaryMetrics = await getCloudinaryUsageMetrics();

    // Calcular métricas derivadas
    const revenuePerUser = totalUsers > 0 ? totalRevenue / totalUsers : 0;
    const conversionRate = totalUsers > 0 ? (premiumClients / totalUsers) * 100 : 0;
    const premiumClientsTier = await prisma.client.count({ where: { premiumTier: 'PREMIUM' } });

    // Obtener top países y ciudades
    const topCountries = await prisma.user.groupBy({
      by: ['locationId'],
      _count: true,
      orderBy: { _count: 'desc' },
      take: 10,
      where: {
        locationId: { not: null }
      }
    });

    const locationIds = topCountries.map(t => t.locationId).filter(Boolean);
    const locations = await prisma.location.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, country: true, city: true }
    });

    const topCountriesData = topCountries.map(country => {
      const location = locations.find(l => l.id === country.locationId);
      return {
        country: location?.country || 'Unknown',
        city: location?.city || 'Unknown',
        users: country._count
      };
    });

    // Crear registro de métricas
    await prisma.appMetrics.create({
      data: {
        totalUsers,
        totalEscorts,
        totalAgencies,
        totalClients,
        totalAdmins,
        totalPosts,
        totalPayments,
        totalRevenue,
        activeUsers,
        bannedUsers,
        verifiedEscorts,
        premiumClients,
        basicClients,
        premiumClientsTier,
        vipClients,
        totalMessages,
        totalBoosts,
        dailyActiveUsers,
        weeklyActiveUsers,
        monthlyActiveUsers,
        revenuePerUser,
        conversionRate,
        topCountries: topCountriesData,
        topCities: topCountriesData.slice(0, 5),
        cloudinaryMetrics, // NUEVAS MÉTRICAS
        date: now
      }
    });

    // Limpiar métricas antiguas (mantener solo últimos 90 días)
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    await prisma.appMetrics.deleteMany({
      where: {
        date: { lt: threeMonthsAgo }
      }
    });

    logger.info('App metrics update completed', {
      totalUsers,
      totalRevenue,
      activeUsers,
      premiumClients,
      cloudinaryUsage: cloudinaryMetrics.storageUsedMB
    });
  } catch (error) {
    logger.error('Error updating app metrics:', error);
  }
}, {
  scheduled: false,
  timezone: "UTC"
});

// Limpiar notificaciones antiguas - cada semana los domingos a las 1 AM
const cleanupOldNotifications = cron.schedule('0 1 * * 0', async () => {
  try {
    logger.info('Starting old notifications cleanup');
    
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Marcar notificaciones antiguas como leídas si no lo están
    const markedAsRead = await prisma.notification.updateMany({
      where: {
        isRead: false,
        createdAt: { lt: monthAgo }
      },
      data: { isRead: true }
    });

    // Eliminar notificaciones muy antiguas (3 meses)
    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const deletedNotifications = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: threeMonthsAgo }
      }
    });

    logger.info('Old notifications cleanup completed', {
      markedAsRead: markedAsRead.count,
      deleted: deletedNotifications.count
    });
  } catch (error) {
    logger.error('Error cleaning up old notifications:', error);
  }
}, {
  scheduled: false,
  timezone: "UTC"
});

// Calcular y actualizar reputaciones de usuarios - cada día a las 5 AM
const updateUserReputations = cron.schedule('0 5 * * *', async () => {
  try {
    logger.info('Starting user reputations update');
    
    const users = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        reputation: true,
        posts: {
          where: { isActive: true },
          select: { views: true, likes: true, favorites: true }
        },
        escort: {
          select: { rating: true, totalRatings: true, isVerified: true }
        },
        agency: {
          select: { isVerified: true, totalEscorts: true }
        },
        sentMessages: {
          where: {
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          },
          select: { isRead: true }
        }
      },
      take: 100 // Procesar en lotes
    });

    let updated = 0;

    for (const user of users) {
      try {
        // Calcular completitud del perfil
        let profileCompleteness = 0;
        const fields = ['firstName', 'lastName', 'bio', 'avatar', 'phone'];
        if (user.userType === 'AGENCY') fields.push('website');
        
        fields.forEach(field => {
          if (user[field]) profileCompleteness += 100 / fields.length;
        });

        // Calcular engagement
        const totalViews = user.posts.reduce((sum, post) => sum + post.views, 0);
        const totalLikes = user.posts.reduce((sum, post) => sum + post.likes.length, 0);
        const totalFavorites = user.posts.reduce((sum, post) => sum + post.favorites.length, 0);

        // Calcular tasa de respuesta (para mensajes)
        const totalMessages = user.sentMessages.length;
        const readMessages = user.sentMessages.filter(m => m.isRead).length;
        const responseRate = totalMessages > 0 ? (readMessages / totalMessages) * 100 : 0;

        // Calcular trust score
        let trustScore = 25; // Base
        if (user.escort?.isVerified || user.agency?.isVerified) trustScore += 30;
        if (user.escort?.rating && user.escort.rating > 4.0) trustScore += 20;
        if (user.escort?.totalRatings && user.escort.totalRatings > 10) trustScore += 15;
        if (profileCompleteness > 80) trustScore += 10;

        // Calcular scores de descubrimiento y trending
        const discoveryScore = Math.min(100, 
          (profileCompleteness * 0.3) + 
          (trustScore * 0.4) + 
          (responseRate * 0.3)
        );

        const trendingScore = Math.min(100,
          (totalViews / 100 * 20) + 
          (totalLikes * 5) + 
          (totalFavorites * 8) +
          (trustScore * 0.3)
        );

        // Overall score
        const overallScore = Math.min(100,
          (discoveryScore * 0.4) +
          (trustScore * 0.3) +
          (trendingScore * 0.2) +
          (profileCompleteness * 0.1)
        );

        // Actualizar reputación
        await prisma.userReputation.upsert({
          where: { userId: user.id },
          update: {
            overallScore,
            responseRate,
            profileCompleteness: Math.round(profileCompleteness),
            trustScore: Math.min(100, trustScore),
            discoveryScore,
            trendingScore,
            totalViews,
            totalLikes,
            totalFavorites,
            lastScoreUpdate: new Date()
          },
          create: {
            userId: user.id,
            overallScore,
            responseRate,
            profileCompleteness: Math.round(profileCompleteness),
            trustScore: Math.min(100, trustScore),
            discoveryScore,
            trendingScore,
            totalViews,
            totalLikes,
            totalFavorites,
            lastScoreUpdate: new Date()
          }
        });

        updated++;
      } catch (userError) {
        logger.error('Error updating reputation for user:', { userId: user.id, error: userError });
      }
    }

    logger.info('User reputations update completed', {
      usersProcessed: users.length,
      updated
    });
  } catch (error) {
    logger.error('Error updating user reputations:', error);
  }
}, {
  scheduled: false,
  timezone: "UTC"
});

// Enviar notificaciones de premium próximo a expirar - cada día a las 10 AM
const notifyExpiringPremium = cron.schedule('0 10 * * *', async () => {
  try {
    logger.info('Starting expiring premium notifications');
    
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Usuarios con premium expirando en 3 días
    const expiringSoon = await prisma.client.findMany({
      where: {
        isPremium: true,
        premiumUntil: {
          gte: now,
          lte: threeDaysFromNow
        }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            settings: {
              select: { emailNotifications: true }
            }
          }
        }
      }
    });

    // Usuarios con premium expirando en 7 días
    const expiringLater = await prisma.client.findMany({
      where: {
        isPremium: true,
        premiumUntil: {
          gte: threeDaysFromNow,
          lte: sevenDaysFromNow
        }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            settings: {
              select: { emailNotifications: true }
            }
          }
        }
      }
    });

    // Crear notificaciones para expirando pronto (3 días)
    for (const client of expiringSoon) {
      await prisma.notification.create({
        data: {
          userId: client.user.id,
          type: 'SUBSCRIPTION_EXPIRING',
          title: 'Tu premium expira pronto',
          message: `Tu suscripción ${client.premiumTier} expira en 3 días. ¡Renueva ahora para no perder los beneficios!`,
          priority: 'HIGH',
          data: {
            tier: client.premiumTier,
            expiresAt: client.premiumUntil.toISOString(),
            daysLeft: 3
          }
        }
      });
    }

    // Crear notificaciones para expirando en una semana (7 días)
    for (const client of expiringLater) {
      await prisma.notification.create({
        data: {
          userId: client.user.id,
          type: 'SUBSCRIPTION_EXPIRING',
          title: 'Renueva tu premium',
          message: `Tu suscripción ${client.premiumTier} expira en una semana. Considera renovar para seguir disfrutando de los beneficios.`,
          priority: 'NORMAL',
          data: {
            tier: client.premiumTier,
            expiresAt: client.premiumUntil.toISOString(),
            daysLeft: 7
          }
        }
      });
    }

    logger.info('Expiring premium notifications sent', {
      expiringSoon: expiringSoon.length,
      expiringLater: expiringLater.length,
      totalNotifications: expiringSoon.length + expiringLater.length
    });
  } catch (error) {
    logger.error('Error sending expiring premium notifications:', error);
  }
}, {
  scheduled: false,
  timezone: "UTC"
});

// FUNCIONES AUXILIARES PARA CLOUDINARY

// Obtener métricas de uso de Cloudinary para las métricas de la app
const getCloudinaryUsageMetrics = async () => {
  try {
    const usage = await getCloudinaryUsage();
    
    if (usage) {
      return {
        plan: usage.plan,
        storageUsedMB: Math.round((usage.storage?.used || 0) / 1024 / 1024),
        storageLimitMB: Math.round((usage.storage?.limit || 0) / 1024 / 1024),
        bandwidthUsedMB: Math.round((usage.bandwidth?.used || 0) / 1024 / 1024),
        bandwidthLimitMB: Math.round((usage.bandwidth?.limit || 0) / 1024 / 1024),
        creditsUsed: usage.credits?.used || 0,
        creditsLimit: usage.credits?.limit || 0,
        totalResources: usage.resources || 0
      };
    }
    
    return null;
  } catch (error) {
    logger.error('Error getting Cloudinary usage metrics:', error);
    return null;
  }
};

// Función para iniciar todas las tareas programadas
const startScheduler = () => {
  try {
    logger.info('Starting scheduler with all tasks');

    // Guardar referencias de las tareas
    activeTasks.set('cleanupExpiredBoosts', cleanupExpiredBoosts);
    activeTasks.set('cleanupExpiredPremium', cleanupExpiredPremium);
    activeTasks.set('resetDailyLimits', resetDailyLimits);
    activeTasks.set('updatePostScores', updatePostScores);
    activeTasks.set('cleanupPosts', cleanupPosts);
    activeTasks.set('cleanupTokens', cleanupTokens);
    activeTasks.set('updateAppMetrics', updateAppMetrics);
    activeTasks.set('cleanupOldNotifications', cleanupOldNotifications);
    activeTasks.set('updateUserReputations', updateUserReputations);
    activeTasks.set('notifyExpiringPremium', notifyExpiringPremium);
    
    // NUEVAS TAREAS DE CLOUDINARY
    activeTasks.set('cleanupCloudinaryTemp', cleanupCloudinaryTemp);
    activeTasks.set('cleanupCloudinaryOrphans', cleanupCloudinaryOrphans);
    activeTasks.set('reportCloudinaryUsage', reportCloudinaryUsage);

    // Iniciar todas las tareas
    activeTasks.forEach((task, name) => {
      task.start();
      logger.info(`Scheduled task started: ${name}`);
    });

    logger.info('All scheduled tasks started successfully', {
      totalTasks: activeTasks.size,
      tasks: Array.from(activeTasks.keys()),
      cloudinaryTasks: ['cleanupCloudinaryTemp', 'cleanupCloudinaryOrphans', 'reportCloudinaryUsage']
    });

    return true;
  } catch (error) {
    logger.error('Error starting scheduler:', error);
    return false;
  }
};

// Función para detener todas las tareas programadas
const stopScheduler = () => {
  try {
    logger.info('Stopping all scheduled tasks');

    activeTasks.forEach((task, name) => {
      task.stop();
      logger.info(`Scheduled task stopped: ${name}`);
    });

    activeTasks.clear();
    logger.info('All scheduled tasks stopped successfully');

    return true;
  } catch (error) {
    logger.error('Error stopping scheduler:', error);
    return false;
  }
};

// Función para obtener estado de las tareas
const getSchedulerStatus = () => {
  const status = {};
  
  activeTasks.forEach((task, name) => {
    status[name] = {
      running: task.running || false,
      scheduled: task.scheduled || false
    };
  });

  return {
    totalTasks: activeTasks.size,
    tasks: status,
    cloudinaryTasksActive: [
      'cleanupCloudinaryTemp',
      'cleanupCloudinaryOrphans', 
      'reportCloudinaryUsage'
    ].filter(name => status[name]?.running),
    lastCheck: new Date().toISOString()
  };
};

// Función para ejecutar una tarea específica manualmente
const runTask = async (taskName) => {
  try {
    logger.info(`Manually executing task: ${taskName}`);

    switch (taskName) {
      case 'cleanupExpiredBoosts':
        await cleanupExpiredBoosts._task();
        break;
      case 'cleanupExpiredPremium':
        await cleanupExpiredPremium._task();
        break;
      case 'resetDailyLimits':
        await resetDailyLimits._task();
        break;
      case 'updatePostScores':
        await updatePostScores._task();
        break;
      case 'cleanupPosts':
        await cleanupPosts._task();
        break;
      case 'cleanupTokens':
        await cleanupTokens._task();
        break;
      case 'updateAppMetrics':
        await updateAppMetrics._task();
        break;
      case 'cleanupOldNotifications':
        await cleanupOldNotifications._task();
        break;
      case 'updateUserReputations':
        await updateUserReputations._task();
        break;
      case 'notifyExpiringPremium':
        await notifyExpiringPremium._task();
        break;
      // NUEVAS TAREAS DE CLOUDINARY
      case 'cleanupCloudinaryTemp':
        await cleanupCloudinaryTemp._task();
        break;
      case 'cleanupCloudinaryOrphans':
        await cleanupCloudinaryOrphans._task();
        break;
      case 'reportCloudinaryUsage':
        await reportCloudinaryUsage._task();
        break;
      default:
        throw new Error(`Unknown task: ${taskName}`);
    }

    logger.info(`Task executed successfully: ${taskName}`);
    return { success: true, task: taskName };
  } catch (error) {
    logger.error(`Error executing task ${taskName}:`, error);
    return { success: false, task: taskName, error: error.message };
  }
};

// Manejar shutdown graceful
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, stopping scheduler');
  stopScheduler();
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, stopping scheduler');
  stopScheduler();
});

module.exports = {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  runTask
};