const { prisma } = require('../config/database');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { sanitizeString } = require('../utils/validators');
const logger = require('../utils/logger');

// Obtener métricas generales de la aplicación
const getAppMetrics = catchAsync(async (req, res) => {
  const { period = 'current', startDate, endDate } = req.query;

  // Calcular fechas según el período
  let dateFilter = {};
  const now = new Date();

  switch (period) {
    case 'today':
      dateFilter = {
        gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      };
      break;
    case 'week':
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
      dateFilter = {
        gte: new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()),
        lt: new Date()
      };
      break;
    case 'month':
      dateFilter = {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
        lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
      };
      break;
    case 'custom':
      if (startDate && endDate) {
        dateFilter = {
          gte: new Date(startDate),
          lt: new Date(endDate)
        };
      }
      break;
    default: // current - sin filtro de fecha
      break;
  }

  try {
    const [
      userStats,
      postStats,
      chatStats,
      paymentStats,
      reportStats,
      topLocations,
      growthStats,
      engagementStats
    ] = await Promise.all([
      // Estadísticas de usuarios - CORREGIDO: sin deletedAt
      Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { userType: 'ESCORT' } }),
        prisma.user.count({ where: { userType: 'AGENCY' } }),
        prisma.user.count({ where: { userType: 'CLIENT' } }),
        prisma.user.count({ where: { userType: 'ADMIN' } }),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { isBanned: true } }),
        // CORREGIDO: sin deletedAt
        prisma.escort.count({ where: { isVerified: true } }),
        prisma.client.count({ where: { isPremium: true } }),
        prisma.user.count({ 
          where: { 
            emailVerified: true,
            ...(period !== 'current' && { createdAt: dateFilter })
          } 
        })
      ]),

      // Estadísticas de posts
      Promise.all([
        prisma.post.count({ where: { isActive: true } }),
        prisma.post.count({ 
          where: { 
            isActive: true,
            ...(period !== 'current' && { createdAt: dateFilter })
          } 
        }),
        prisma.post.aggregate({
          _sum: { views: true },
          _avg: { views: true }
        }).catch(() => ({ _sum: { views: 0 }, _avg: { views: 0 } })),
        prisma.like.count({
          ...(period !== 'current' && {
            where: { createdAt: dateFilter }
          })
        }).catch(() => 0),
        prisma.favorite.count({
          ...(period !== 'current' && {
            where: { createdAt: dateFilter }
          })
        }).catch(() => 0)
      ]),

      // Estadísticas de chat
      Promise.all([
        prisma.chat.count().catch(() => 0),
        prisma.message.count({
          ...(period !== 'current' && {
            where: { createdAt: dateFilter }
          })
        }).catch(() => 0),
        prisma.message.count({
          where: {
            isRead: false,
            ...(period !== 'current' && { createdAt: dateFilter })
          }
        }).catch(() => 0)
      ]),

      // Estadísticas de pagos
      Promise.all([
        prisma.payment.aggregate({
          _sum: { amount: true },
          _count: true,
          where: {
            status: 'COMPLETED',
            ...(period !== 'current' && { createdAt: dateFilter })
          }
        }).catch(() => ({ _sum: { amount: 0 }, _count: 0 })),
        prisma.payment.groupBy({
          by: ['type'],
          where: {
            status: 'COMPLETED',
            ...(period !== 'current' && { createdAt: dateFilter })
          },
          _sum: { amount: true },
          _count: true
        }).catch(() => []),
        prisma.boost.count({
          where: {
            isActive: true,
            ...(period !== 'current' && { createdAt: dateFilter })
          }
        }).catch(() => 0)
      ]),

      // Estadísticas de reportes - CORREGIDO: manejo de errores
      Promise.all([
        prisma.report.count().catch(() => 0),
        prisma.report.count({ where: { status: 'PENDING' } }).catch(() => 0),
        prisma.report.count({ where: { status: 'RESOLVED' } }).catch(() => 0),
        prisma.report.groupBy({
          by: ['reason'],
          _count: true,
          orderBy: { _count: { reason: 'desc' } }
        }).catch(() => [])
      ]),

      // Top ubicaciones
      prisma.user.groupBy({
        by: ['locationId'],
        where: {
          locationId: { not: null },
          isActive: true
        },
        _count: true,
        orderBy: { _count: { locationId: 'desc' } },
        take: 10
      }).catch(() => []),

      // Estadísticas de crecimiento (últimos 30 días)
      prisma.user.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        _count: true,
        orderBy: { createdAt: 'asc' }
      }).catch(() => []),

      // Métricas de engagement
      Promise.all([
        prisma.userInteraction.count({
          where: {
            type: 'VIEW',
            ...(period !== 'current' && { createdAt: dateFilter })
          }
        }).catch(() => 0),
        prisma.userInteraction.count({
          where: {
            type: 'LIKE',
            ...(period !== 'current' && { createdAt: dateFilter })
          }
        }).catch(() => 0),
        prisma.userInteraction.count({
          where: {
            type: 'CHAT',
            ...(period !== 'current' && { createdAt: dateFilter })
          }
        }).catch(() => 0)
      ])
    ]);

    // Obtener información de ubicaciones de forma segura
    let locations = [];
    if (topLocations && topLocations.length > 0) {
      const locationIds = topLocations.map(loc => loc.locationId).filter(Boolean);
      if (locationIds.length > 0) {
        locations = await prisma.location.findMany({
          where: { id: { in: locationIds } }
        }).catch(() => []);
      }
    }

    const locationMap = new Map(locations.map(loc => [loc.id, loc]));

    // Formatear datos con valores seguros
    const metrics = {
      users: {
        total: userStats[0] || 0,
        escorts: userStats[1] || 0,
        agencies: userStats[2] || 0,
        clients: userStats[3] || 0,
        admins: userStats[4] || 0,
        active: userStats[5] || 0,
        banned: userStats[6] || 0,
        verifiedEscorts: userStats[7] || 0,
        premiumClients: userStats[8] || 0,
        emailVerified: userStats[9] || 0
      },
      posts: {
        total: postStats[0] || 0,
        newPosts: postStats[1] || 0,
        totalViews: postStats[2]._sum.views || 0,
        avgViews: Math.round(postStats[2]._avg.views || 0),
        totalLikes: postStats[3] || 0,
        totalFavorites: postStats[4] || 0
      },
      chat: {
        totalChats: chatStats[0] || 0,
        totalMessages: chatStats[1] || 0,
        unreadMessages: chatStats[2] || 0
      },
      payments: {
        totalRevenue: paymentStats[0]._sum.amount || 0,
        totalTransactions: paymentStats[0]._count || 0,
        byType: (paymentStats[1] || []).reduce((acc, item) => {
          acc[item.type] = {
            count: item._count,
            amount: item._sum.amount || 0
          };
          return acc;
        }, {}),
        activeBoosts: paymentStats[2] || 0
      },
      reports: {
        total: reportStats[0] || 0,
        pending: reportStats[1] || 0,
        resolved: reportStats[2] || 0,
        byReason: (reportStats[3] || []).reduce((acc, item) => {
          acc[item.reason] = item._count;
          return acc;
        }, {})
      },
      locations: (topLocations || []).map(loc => ({
        location: locationMap.get(loc.locationId),
        userCount: loc._count
      })).filter(loc => loc.location),
      growth: (growthStats || []).reduce((acc, item) => {
        const date = item.createdAt.toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + item._count;
        return acc;
      }, {}),
      engagement: {
        views: engagementStats[0] || 0,
        likes: engagementStats[1] || 0,
        chats: engagementStats[2] || 0
      }
    };

    // Crear/actualizar registro de métricas para historial de forma segura
    try {
      await prisma.appMetrics.create({
        data: {
          totalUsers: metrics.users.total,
          totalEscorts: metrics.users.escorts,
          totalAgencies: metrics.users.agencies,
          totalClients: metrics.users.clients,
          totalAdmins: metrics.users.admins,
          totalPosts: metrics.posts.total,
          totalPayments: metrics.payments.totalRevenue,
          totalRevenue: metrics.payments.totalRevenue,
          activeUsers: metrics.users.active,
          bannedUsers: metrics.users.banned,
          verifiedEscorts: metrics.users.verifiedEscorts,
          premiumClients: metrics.users.premiumClients,
          totalMessages: metrics.chat.totalMessages,
          totalBoosts: metrics.payments.activeBoosts,
          basicClients: Math.max(0, metrics.users.clients - metrics.users.premiumClients),
          premiumClientsTier: metrics.users.premiumClients,
          vipClients: 0, // TODO: Calcular VIP específicamente
          topCountries: locations.slice(0, 5).map(loc => ({
            country: loc.country,
            count: topLocations.find(tl => tl.locationId === loc.id)?._count || 0
          }))
        }
      });
    } catch (metricsError) {
      // Log error but don't fail the request
      console.warn('Error saving metrics to appMetrics table:', metricsError.message);
    }

    res.status(200).json({
      success: true,
      data: {
        metrics,
        period,
        generatedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in getAppMetrics:', error);
    throw new AppError('Error al obtener métricas de la aplicación', 500, 'METRICS_ERROR');
  }
});

// ✅ FUNCIÓN CORREGIDA: Obtener agencias pendientes de verificación - SIN businessLicense
const getPendingAgencies = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // ✅ CORRECCIÓN: Buscar en AgencyRegistrationRequest, NO en Agency
  const whereClause = {
    status: 'PENDING', // ✅ Usar el campo correcto del modelo correcto
    ...(search && {
      OR: [
        { fullName: { contains: search, mode: 'insensitive' } },
        { businessEmail: { contains: search, mode: 'insensitive' } },
        { user: { 
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { username: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } }
          ]
        }}
      ]
    })
  };

  // ✅ BUSCAR EN AgencyRegistrationRequest en lugar de User
  const [agencies, totalCount] = await Promise.all([
    prisma.agencyRegistrationRequest.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            phone: true,
            bio: true,
            website: true,
            avatar: true,
            isActive: true,
            createdAt: true,
            lastLogin: true,
            location: {
              select: {
                country: true,
                city: true,
                state: true
              }
            }
          }
        }
      },
      orderBy: { submittedAt: 'desc' },
      skip: offset,
      take: parseInt(limit)
    }),
    prisma.agencyRegistrationRequest.count({ where: whereClause })
  ]);

  const pagination = {
    page: parseInt(page),
    limit: parseInt(limit),
    total: totalCount,
    pages: Math.ceil(totalCount / parseInt(limit)),
    hasNext: parseInt(page) * parseInt(limit) < totalCount,
    hasPrev: parseInt(page) > 1
  };

  // ✅ FORMATEAR RESPUESTA CON DATOS CORRECTOS - SIN businessLicense
  const formattedAgencies = agencies.map(request => ({
    requestId: request.id,
    userId: request.userId,
    
    // Datos del formulario de registro - SIN businessLicense
    fullName: request.fullName,
    documentNumber: request.documentNumber,
    businessPhone: request.businessPhone,
    businessEmail: request.businessEmail,
    documentFrontImage: request.documentFrontImage,
    documentBackImage: request.documentBackImage,
    
    // Estado de la solicitud
    status: request.status,
    submittedAt: request.submittedAt,
    reviewNotes: request.reviewNotes,
    rejectionReason: request.rejectionReason,
    
    // Datos del usuario asociado
    userData: {
      id: request.user.id,
      email: request.user.email,
      username: request.user.username,
      firstName: request.user.firstName,
      lastName: request.user.lastName,
      phone: request.user.phone,
      bio: request.user.bio,
      website: request.user.website,
      avatar: request.user.avatar,
      isActive: request.user.isActive,
      createdAt: request.user.createdAt,
      lastLogin: request.user.lastLogin,
      location: request.user.location
    }
  }));

  res.status(200).json({
    success: true,
    data: {
      agencies: formattedAgencies,
      pagination,
      filters: { search }
    },
    timestamp: new Date().toISOString()
  });
});

// ✅ FUNCIÓN CORREGIDA: Aprobar agencia - CON companyName requerido
const approveAgency = catchAsync(async (req, res) => {
  const adminUserId = req.user.id;
  const { agencyId } = req.params; // ✅ NOTA: Este debe ser requestId, no userId
  const { notes } = req.body;

  // ✅ BUSCAR en AgencyRegistrationRequest usando el ID de la solicitud
  const agencyRequest = await prisma.agencyRegistrationRequest.findUnique({
    where: { id: agencyId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          userType: true,
          username: true
        }
      }
    }
  });

  if (!agencyRequest) {
    throw new AppError('Solicitud de agencia no encontrada', 404, 'AGENCY_REQUEST_NOT_FOUND');
  }

  if (agencyRequest.status !== 'PENDING') {
    throw new AppError('Esta solicitud ya fue procesada', 400, 'REQUEST_ALREADY_PROCESSED');
  }

  // ✅ GENERAR companyName usando datos disponibles
  const companyName = `${agencyRequest.fullName} Agency` || 
                     `${agencyRequest.user.firstName} ${agencyRequest.user.lastName} Agency` ||
                     `${agencyRequest.user.username} Agency` ||
                     'Agencia de Escorts';

  // ✅ TRANSACCIÓN: Aprobar solicitud Y crear/actualizar registro Agency
  const result = await prisma.$transaction(async (tx) => {
    // 1. Actualizar la solicitud a APPROVED
    const updatedRequest = await tx.agencyRegistrationRequest.update({
      where: { id: agencyId },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedBy: adminUserId,
        reviewNotes: notes || null
      }
    });

    // 2. Crear o actualizar el registro Agency - SOLO campos mínimos seguros
    const agencyData = await tx.agency.upsert({
      where: { userId: agencyRequest.userId },
      create: {
        userId: agencyRequest.userId,
        companyName: companyName, // ✅ CAMPO REQUERIDO
        contactPerson: agencyRequest.fullName, // ✅ CAMPO REQUERIDO
        address: agencyRequest.user.location ? 
          `${agencyRequest.user.location.city}, ${agencyRequest.user.location.country}` : 
          'Dirección no especificada', // ✅ CAMPO REQUERIDO
        isVerified: true,
        verifiedAt: new Date(),
        totalEscorts: 0
      },
      update: {
        isVerified: true,
        verifiedAt: new Date(),
        companyName: companyName,
        contactPerson: agencyRequest.fullName,
        address: agencyRequest.user.location ? 
          `${agencyRequest.user.location.city}, ${agencyRequest.user.location.country}` : 
          'Dirección no especificada'
      }
    });

    // 3. Actualizar el status del usuario para permitir acceso
    await tx.user.update({
      where: { id: agencyRequest.userId },
      data: {
        accountStatus: 'ACTIVE', // ✅ Cambiar de PENDING_APPROVAL a ACTIVE
        canLogin: true // ✅ Permitir login
      }
    });

    return { updatedRequest, agencyData };
  });

  // Crear notificación para la agencia
  await prisma.notification.create({
    data: {
      userId: agencyRequest.userId,
      type: 'AGENCY_APPROVED',
      title: '¡Agencia aprobada!',
      message: 'Tu solicitud de agencia ha sido aprobada. Ya puedes acceder a todas las funcionalidades.',
      priority: 'HIGH',
      data: {
        approvedBy: adminUserId,
        approvedAt: new Date().toISOString(),
        notes: notes || null,
        companyName: companyName
      }
    }
  });

  // Actualizar estadísticas del admin
  await prisma.admin.update({
    where: { userId: adminUserId },
    data: { 
      totalAgencyApprovals: { increment: 1 }
    }
  });

  logger.logSecurity('agency_approved', 'medium', {
    requestId: agencyId,
    userId: agencyRequest.userId,
    fullName: agencyRequest.fullName,
    companyName: companyName,
    approvedBy: adminUserId,
    notes: notes || null
  });

  res.status(200).json({
    success: true,
    message: `Solicitud de agencia de ${agencyRequest.fullName} aprobada exitosamente`,
    data: {
      requestId: agencyId,
      userId: agencyRequest.userId,
      fullName: agencyRequest.fullName,
      companyName: companyName,
      approvedAt: new Date().toISOString(),
      approvedBy: adminUserId
    },
    timestamp: new Date().toISOString()
  });
});

// ✅ FUNCIÓN CORREGIDA: Rechazar agencia - SIN businessLicense
const rejectAgency = catchAsync(async (req, res) => {
  const adminUserId = req.user.id;
  const { agencyId } = req.params; // requestId
  const { reason, notes } = req.body;

  if (!reason?.trim()) {
    throw new AppError('Razón del rechazo es obligatoria', 400, 'REJECTION_REASON_REQUIRED');
  }

  // Buscar solicitud de agencia
  const agencyRequest = await prisma.agencyRegistrationRequest.findUnique({
    where: { id: agencyId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  });

  if (!agencyRequest) {
    throw new AppError('Solicitud de agencia no encontrada', 404, 'AGENCY_REQUEST_NOT_FOUND');
  }

  if (agencyRequest.status !== 'PENDING') {
    throw new AppError('Esta solicitud ya fue procesada', 400, 'REQUEST_ALREADY_PROCESSED');
  }

  // Rechazar solicitud
  await prisma.agencyRegistrationRequest.update({
    where: { id: agencyId },
    data: {
      status: 'REJECTED',
      reviewedAt: new Date(),
      reviewedBy: adminUserId,
      rejectionReason: reason,
      reviewNotes: notes || null
    }
  });

  // Crear notificación para el usuario
  await prisma.notification.create({
    data: {
      userId: agencyRequest.userId,
      type: 'AGENCY_REJECTED',
      title: 'Solicitud de agencia rechazada',
      message: `Tu solicitud de agencia fue rechazada. Razón: ${reason}`,
      priority: 'HIGH',
      data: {
        rejectedBy: adminUserId,
        rejectedAt: new Date().toISOString(),
        reason,
        notes: notes || null
      }
    }
  });

  logger.logSecurity('agency_rejected', 'medium', {
    requestId: agencyId,
    userId: agencyRequest.userId,
    fullName: agencyRequest.fullName,
    rejectedBy: adminUserId,
    reason,
    notes: notes || null
  });

  res.status(200).json({
    success: true,
    message: `Solicitud de agencia de ${agencyRequest.fullName} rechazada`,
    data: {
      requestId: agencyId,
      userId: agencyRequest.userId,
      fullName: agencyRequest.fullName,
      rejectedAt: new Date().toISOString(),
      rejectedBy: adminUserId,
      reason
    },
    timestamp: new Date().toISOString()
  });
});

// Banear usuario
const banUser = catchAsync(async (req, res) => {
  const adminUserId = req.user.id;
  const { userId } = req.params;
  const {
    reason,
    severity = 'TEMPORARY',
    duration, // en días
    evidence
  } = req.body;

  // Verificar que el usuario a banear existe
  const userToBan = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      userType: true,
      firstName: true,
      lastName: true,
      isBanned: true
    }
  });

  if (!userToBan) {
    throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
  }

  // No permitir banear admins (excepto super admin)
  if (userToBan.userType === 'ADMIN' && req.user.admin.role !== 'SUPER_ADMIN') {
    throw new AppError('No puedes banear a otro administrador', 403, 'CANNOT_BAN_ADMIN');
  }

  // No permitir auto-baneo
  if (userId === adminUserId) {
    throw new AppError('No puedes banearte a ti mismo', 400, 'CANNOT_BAN_SELF');
  }

  // Verificar si ya está baneado
  if (userToBan.isBanned) {
    throw new AppError('El usuario ya está baneado', 409, 'USER_ALREADY_BANNED');
  }

  // Calcular fecha de expiración si es temporal
  let expiresAt = null;
  if (severity === 'TEMPORARY' && duration) {
    expiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
  }

  // Crear ban
  const ban = await prisma.ban.create({
    data: {
      userId,
      reason: sanitizeString(reason),
      bannedBy: adminUserId,
      adminId: req.user.admin.id,
      severity,
      expiresAt,
      evidence: evidence || null
    }
  });

  // Actualizar usuario
  await prisma.user.update({
    where: { id: userId },
    data: {
      isBanned: true,
      banReason: sanitizeString(reason)
    }
  });

  // Actualizar estadísticas del admin
  await prisma.admin.update({
    where: { userId: adminUserId },
    data: { totalBans: { increment: 1 } }
  });

  // Crear notificación para el usuario baneado
  await prisma.notification.create({
    data: {
      userId,
      type: 'SECURITY_ALERT',
      title: 'Cuenta suspendida',
      message: `Tu cuenta ha sido suspendida. Motivo: ${reason}`,
      priority: 'HIGH',
      data: {
        banId: ban.id,
        severity,
        expiresAt: expiresAt?.toISOString() || null,
        reason
      }
    }
  });

  logger.logSecurity('user_banned', 'high', {
    bannedUserId: userId,
    bannedUsername: userToBan.username,
    bannedUserType: userToBan.userType,
    adminId: adminUserId,
    reason,
    severity,
    expiresAt: expiresAt?.toISOString() || null,
    evidence
  });

  res.status(200).json({
    success: true,
    message: `Usuario ${userToBan.firstName} ${userToBan.lastName} baneado exitosamente`,
    data: {
      ban: {
        id: ban.id,
        reason: ban.reason,
        severity: ban.severity,
        expiresAt: ban.expiresAt,
        createdAt: ban.createdAt,
        user: {
          id: userToBan.id,
          username: userToBan.username,
          firstName: userToBan.firstName,
          lastName: userToBan.lastName,
          userType: userToBan.userType
        }
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Desbanear usuario
const unbanUser = catchAsync(async (req, res) => {
  const adminUserId = req.user.id;
  const { userId } = req.params;
  const { reason } = req.body;

  // Verificar que el usuario existe y está baneado
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      userType: true,
      isBanned: true
    }
  });

  if (!user) {
    throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
  }

  if (!user.isBanned) {
    throw new AppError('El usuario no está baneado', 400, 'USER_NOT_BANNED');
  }

  // Desactivar ban activo
  await prisma.ban.updateMany({
    where: {
      userId,
      isActive: true
    },
    data: {
      isActive: false,
      updatedAt: new Date()
    }
  });

  // Actualizar usuario
  await prisma.user.update({
    where: { id: userId },
    data: {
      isBanned: false,
      banReason: null
    }
  });

  // Crear notificación para el usuario
  await prisma.notification.create({
    data: {
      userId,
      type: 'SECURITY_ALERT',
      title: 'Cuenta reactivada',
      message: 'Tu cuenta ha sido reactivada. Ya puedes usar la plataforma normalmente.',
      priority: 'NORMAL',
      data: {
        unbannedBy: adminUserId,
        reason: reason || null
      }
    }
  });

  logger.logSecurity('user_unbanned', 'medium', {
    unbannedUserId: userId,
    unbannedUsername: user.username,
    adminId: adminUserId,
    reason: reason || 'No reason provided'
  });

  res.status(200).json({
    success: true,
    message: `Usuario ${user.firstName} ${user.lastName} desbaneado exitosamente`,
    data: {
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        isBanned: false
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Obtener lista de usuarios baneados
const getBannedUsers = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, severity, search } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const whereClause = {
    isActive: true,
    ...(severity && { severity }),
    ...(search && {
      user: {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      }
    })
  };

  const [bans, totalCount] = await Promise.all([
    prisma.ban.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            userType: true,
            avatar: true,
            createdAt: true,
            lastLogin: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: parseInt(limit)
    }),
    prisma.ban.count({ where: whereClause })
  ]);

  const pagination = {
    page: parseInt(page),
    limit: parseInt(limit),
    total: totalCount,
    pages: Math.ceil(totalCount / parseInt(limit)),
    hasNext: parseInt(page) * parseInt(limit) < totalCount,
    hasPrev: parseInt(page) > 1
  };

  res.status(200).json({
    success: true,
    data: {
      bans,
      pagination,
      filters: {
        severity,
        search
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Obtener reportes pendientes
const getPendingReports = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, reason, severity } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const whereClause = {
    status: 'PENDING',
    // CORREGIDO: removido deletedAt
    ...(reason && { reason }),
    ...(severity && { severity })
  };

  const [reports, totalCount] = await Promise.all([
    prisma.report.findMany({
      where: whereClause,
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            userType: true,
            avatar: true
          }
        },
        targetUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            userType: true,
            avatar: true
          }
        },
        post: {
          select: {
            id: true,
            title: true,
            description: true,
            images: true
          }
        }
      },
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' }
      ],
      skip: offset,
      take: parseInt(limit)
    }),
    prisma.report.count({ where: whereClause })
  ]);

  const pagination = {
    page: parseInt(page),
    limit: parseInt(limit),
    total: totalCount,
    pages: Math.ceil(totalCount / parseInt(limit)),
    hasNext: parseInt(page) * parseInt(limit) < totalCount,
    hasPrev: parseInt(page) > 1
  };

  res.status(200).json({
    success: true,
    data: {
      reports,
      pagination,
      filters: {
        reason,
        severity
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Resolver reporte
const resolveReport = catchAsync(async (req, res) => {
  const adminUserId = req.user.id;
  const { reportId } = req.params;
  const {
    action, // 'approve', 'reject', 'ban_user', 'delete_post'
    resolution,
    actionTaken,
    banDuration, // si action es 'ban_user'
    banSeverity = 'TEMPORARY'
  } = req.body;

  // Buscar reporte
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      targetUser: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          userType: true,
          isBanned: true
        }
      },
      post: {
        select: {
          id: true,
          title: true,
          authorId: true,
          isActive: true
        }
      }
    }
  });

  if (!report) {
    throw new AppError('Reporte no encontrado', 404, 'REPORT_NOT_FOUND');
  }

  if (report.status !== 'PENDING') {
    throw new AppError('Este reporte ya fue procesado', 400, 'REPORT_ALREADY_PROCESSED');
  }

  // Ejecutar acción según el tipo
  switch (action) {
    case 'ban_user':
      if (!report.targetUser) {
        throw new AppError('No hay usuario objetivo para banear', 400, 'NO_TARGET_USER');
      }

      if (report.targetUser.isBanned) {
        throw new AppError('El usuario ya está baneado', 400, 'USER_ALREADY_BANNED');
      }

      const expiresAt = banDuration ? 
        new Date(Date.now() + banDuration * 24 * 60 * 60 * 1000) : null;

      await prisma.ban.create({
        data: {
          userId: report.targetUser.id,
          reason: `Reporte resuelto: ${report.reason}`,
          bannedBy: adminUserId,
          adminId: req.user.admin.id,
          severity: banSeverity,
          expiresAt,
          evidence: {
            reportId: report.id,
            originalReason: report.reason,
            description: report.description
          }
        }
      });

      await prisma.user.update({
        where: { id: report.targetUser.id },
        data: {
          isBanned: true,
          banReason: `Reporte resuelto: ${report.reason}`
        }
      });
      break;

    case 'delete_post':
      if (!report.post) {
        throw new AppError('No hay post objetivo para eliminar', 400, 'NO_TARGET_POST');
      }

      if (!report.post.isActive) {
        throw new AppError('El post ya está eliminado', 400, 'POST_ALREADY_DELETED');
      }

      await prisma.post.update({
        where: { id: report.post.id },
        data: {
          isActive: false,
          deletedAt: new Date()
        }
      });
      break;

    case 'approve':
    case 'reject':
      // No se requiere acción adicional
      break;

    default:
      throw new AppError('Acción no válida', 400, 'INVALID_ACTION');
  }

  // Actualizar reporte
  const resolvedReport = await prisma.report.update({
    where: { id: reportId },
    data: {
      status: 'RESOLVED',
      resolution: sanitizeString(resolution),
      actionTaken: actionTaken || action,
      resolvedBy: adminUserId,
      resolvedAt: new Date()
    }
  });

  // Actualizar estadísticas del admin
  await prisma.admin.update({
    where: { userId: adminUserId },
    data: { totalReports: { increment: 1 } }
  });

  // Crear notificación para el reportante
  await prisma.notification.create({
    data: {
      userId: report.authorId,
      type: 'SYSTEM',
      title: 'Reporte procesado',
      message: `Tu reporte ha sido procesado. Acción tomada: ${actionTaken || action}`,
      data: {
        reportId: report.id,
        action: actionTaken || action,
        resolution
      }
    }
  });

  logger.info('Report resolved', {
    reportId: report.id,
    resolvedBy: adminUserId,
    action: actionTaken || action,
    targetUserId: report.targetUserId,
    targetPostId: report.postId
  });

  res.status(200).json({
    success: true,
    message: 'Reporte resuelto exitosamente',
    data: {
      report: resolvedReport,
      action: actionTaken || action
    },
    timestamp: new Date().toISOString()
  });
});

// Obtener lista de todos los usuarios para administración
const getAllUsers = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    userType,
    status = 'all', // 'active', 'banned', 'inactive', 'all'
    search,
    sortBy = 'newest'
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Construir filtros
  const whereClause = {
    ...(userType && { userType: userType.toUpperCase() }),
    ...(status === 'active' && { isActive: true, isBanned: false }),
    ...(status === 'banned' && { isBanned: true }),
    ...(status === 'inactive' && { isActive: false }),
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    })
  };

  // Configurar ordenamiento
  let orderBy = {};
  switch (sortBy) {
    case 'newest':
      orderBy = { createdAt: 'desc' };
      break;
    case 'oldest':
      orderBy = { createdAt: 'asc' };
      break;
    case 'lastLogin':
      orderBy = { lastLogin: 'desc' };
      break;
    case 'profileViews':
      orderBy = { profileViews: 'desc' };
      break;
    case 'alphabetical':
      orderBy = [{ firstName: 'asc' }, { lastName: 'asc' }];
      break;
    default:
      orderBy = { createdAt: 'desc' };
  }

  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        userType: true,
        avatar: true,
        isActive: true,
        isBanned: true,
        banReason: true,
        profileViews: true,
        emailVerified: true,
        createdAt: true,
        lastLogin: true,
        lastActiveAt: true,
        location: {
          select: {
            country: true,
            city: true
          }
        },
        escort: {
          select: {
            isVerified: true,
            rating: true,
            currentPosts: true
          }
        },
        agency: {
          select: {
            isVerified: true,
            totalEscorts: true
          }
        },
        client: {
          select: {
            isPremium: true,
            premiumTier: true,
            points: true
          }
        },
        _count: {
          select: {
            posts: { where: { isActive: true } },
            sentMessages: true,
            reports: true,
            reportsReceived: true
          }
        }
      },
      orderBy,
      skip: offset,
      take: parseInt(limit)
    }),
    prisma.user.count({ where: whereClause })
  ]);

  const pagination = {
    page: parseInt(page),
    limit: parseInt(limit),
    total: totalCount,
    pages: Math.ceil(totalCount / parseInt(limit)),
    hasNext: parseInt(page) * parseInt(limit) < totalCount,
    hasPrev: parseInt(page) > 1
  };

  res.status(200).json({
    success: true,
    data: {
      users,
      pagination,
      filters: {
        userType,
        status,
        search,
        sortBy
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Obtener detalles de usuario para admin
const getUserDetails = catchAsync(async (req, res) => {
  const { userId } = req.params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      escort: {
        include: {
          agencyMemberships: {
            include: {
              agency: {
                include: {
                  user: {
                    select: {
                      firstName: true,
                      lastName: true
                    }
                  }
                }
              }
            }
          },
          verifications: {
            include: {
              agency: {
                include: {
                  user: {
                    select: {
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
                include: {
                  user: {
                    select: {
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
      client: {
        include: {
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 10
          },
          pointTransactions: {
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        }
      },
      admin: true,
      settings: true,
      reputation: true,
      location: true,
      banHistory: {
        orderBy: { createdAt: 'desc' },
        take: 5
      },
      reports: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          targetUser: {
            select: {
              username: true,
              firstName: true,
              lastName: true
            }
          }
        }
      },
      reportsReceived: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          author: {
            select: {
              username: true,
              firstName: true,
              lastName: true
            }
          }
        }
      },
      _count: {
        select: {
          posts: { where: { isActive: true } },
          sentMessages: true,
          likes: true,
          favorites: true,
          interactions: true,
          receivedInteractions: true
        }
      }
    }
  });

  if (!user) {
    throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
  }

  res.status(200).json({
    success: true,
    data: user,
    timestamp: new Date().toISOString()
  });
});

// Actualizar configuración de la aplicación
const updateAppSettings = catchAsync(async (req, res) => {
  const adminUserId = req.user.id;
  const {
    maintenanceMode = false,
    registrationEnabled = true,
    maxPostsPerEscort = 5,
    verificationCost = 50,
    commissionRate = 0.1,
    pointsPerDollar = 100,
    featuredPostCost = 10
  } = req.body;

  // Verificar permisos de super admin para cambios críticos
  if (req.user.admin.role !== 'SUPER_ADMIN') {
    throw new AppError('Se requieren permisos de super administrador', 403, 'SUPER_ADMIN_REQUIRED');
  }

  // Por ahora, guardamos configuraciones en variables de entorno o base de datos
  // En una implementación real, tendrías una tabla de configuraciones

  logger.logSecurity('app_settings_updated', 'high', {
    adminId: adminUserId,
    changes: {
      maintenanceMode,
      registrationEnabled,
      maxPostsPerEscort,
      verificationCost,
      commissionRate,
      pointsPerDollar,
      featuredPostCost
    }
  });

  res.status(200).json({
    success: true,
    message: 'Configuraciones actualizadas exitosamente',
    data: {
      settings: {
        maintenanceMode,
        registrationEnabled,
        maxPostsPerEscort,
        verificationCost,
        commissionRate,
        pointsPerDollar,
        featuredPostCost
      },
      updatedBy: adminUserId
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = {
  getAppMetrics,
  getPendingAgencies,    // ✅ EXPORTADA Y CORREGIDA
  approveAgency,         // ✅ EXPORTADA Y CORREGIDA CON companyName
  rejectAgency,          // ✅ EXPORTADA Y CORREGIDA
  banUser,
  unbanUser,
  getBannedUsers,
  getPendingReports,
  resolveReport,
  getAllUsers,
  getUserDetails,
  updateAppSettings
};