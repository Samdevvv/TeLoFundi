const { prisma } = require('../config/database');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { sanitizeString } = require('../utils/validators');
const logger = require('../utils/logger');

// Buscar agencias (para escorts)
const searchAgencies = catchAsync(async (req, res) => {
  const {
    q: query,
    location,
    verified,
    minEscorts,
    page = 1,
    limit = 20,
    sortBy = 'relevance'
  } = req.query;

  // ✅ CORREGIDO: Validación de paginación consistente
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  // Construir filtros de búsqueda
  const whereClause = {
    user: {
      isActive: true,
      isBanned: false,
      userType: 'AGENCY'
    },
    ...(query && {
      user: {
        ...whereClause.user,
        OR: [
          { firstName: { contains: sanitizeString(query), mode: 'insensitive' } },
          { lastName: { contains: sanitizeString(query), mode: 'insensitive' } },
          { bio: { contains: sanitizeString(query), mode: 'insensitive' } }
        ]
      }
    }),
    ...(location && {
      user: {
        ...whereClause.user,
        location: {
          OR: [
            { country: { contains: sanitizeString(location), mode: 'insensitive' } },
            { city: { contains: sanitizeString(location), mode: 'insensitive' } }
          ]
        }
      }
    }),
    ...(verified === 'true' && { isVerified: true }),
    ...(minEscorts && { totalEscorts: { gte: parseInt(minEscorts) } })
  };

  // Configurar ordenamiento
  let orderBy = {};
  switch (sortBy) {
    case 'newest':
      orderBy = { user: { createdAt: 'desc' } };
      break;
    case 'oldest':
      orderBy = { user: { createdAt: 'asc' } };
      break;
    case 'escorts':
      orderBy = { totalEscorts: 'desc' };
      break;
    case 'verified':
      orderBy = [{ isVerified: 'desc' }, { totalEscorts: 'desc' }];
      break;
    default: // relevance
      orderBy = [
        { isVerified: 'desc' },
        { totalEscorts: 'desc' },
        { user: { profileViews: 'desc' } }
      ];
  }

  const [agencies, totalCount] = await Promise.all([
    prisma.agency.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            bio: true,
            website: true,
            phone: true,
            profileViews: true,
            createdAt: true,
            location: true,
            settings: {
              select: {
                showPhoneNumber: true
              }
            }
          }
        },
        _count: {
          select: {
            memberships: {
              where: { status: 'ACTIVE' }
            },
            verifications: {
              where: { status: 'COMPLETED' }
            }
          }
        }
      },
      orderBy,
      skip: offset,
      take: limitNum
    }),
    prisma.agency.count({ where: whereClause })
  ]);

  // Registrar búsqueda si hay usuario autenticado
  if (req.user && query) {
    await prisma.searchHistory.create({
      data: {
        userId: req.user.id,
        query: sanitizeString(query),
        filters: { type: 'agencies', location, verified, minEscorts, sortBy },
        results: totalCount,
        clicked: false
      }
    }).catch(error => {
      logger.warn('Failed to save search history:', error);
    });
  }

  const formattedAgencies = agencies.map(agency => ({
    id: agency.id,
    user: agency.user,
    isVerified: agency.isVerified,
    verifiedAt: agency.verifiedAt,
    totalEscorts: agency.totalEscorts,
    verifiedEscorts: agency.verifiedEscorts,
    activeEscorts: agency.activeEscorts,
    totalVerifications: agency.totalVerifications,
    defaultCommissionRate: agency.defaultCommissionRate,
    stats: {
      activeMemberships: agency._count.memberships,
      completedVerifications: agency._count.verifications
    }
  }));

  const pagination = {
    page: pageNum,
    limit: limitNum,
    total: totalCount,
    pages: Math.ceil(totalCount / limitNum),
    hasNext: pageNum * limitNum < totalCount,
    hasPrev: pageNum > 1
  };

  res.status(200).json({
    success: true,
    data: {
      agencies: formattedAgencies,
      pagination,
      filters: {
        query,
        location,
        verified,
        minEscorts,
        sortBy
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Solicitar unirse a una agencia (escort)
const requestToJoinAgency = catchAsync(async (req, res) => {
  const escortUserId = req.user.id;
  const { agencyId } = req.params;
  const { message } = req.body;

  // Verificar que el usuario es escort
  if (req.user.userType !== 'ESCORT') {
    throw new AppError('Solo escorts pueden solicitar unirse a agencias', 403, 'ESCORT_ONLY');
  }

  // ✅ CORREGIDO: Verificación consistente de que el escort existe
  if (!req.user.escort) {
    throw new AppError('Datos de escort no encontrados', 500, 'ESCORT_DATA_MISSING');
  }

  // ✅ CORREGIDO: Usar userId en lugar de id para buscar agencia
  const agency = await prisma.agency.findUnique({
    where: { userId: agencyId }, // ✅ Cambiado de id a userId
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          isActive: true,
          isBanned: true
        }
      }
    }
  });

  if (!agency || !agency.user.isActive || agency.user.isBanned) {
    throw new AppError('Agencia no encontrada o no disponible', 404, 'AGENCY_NOT_FOUND');
  }

  // Verificar que no existe ya una membresía activa o pendiente
  const existingMembership = await prisma.agencyMembership.findFirst({
    where: {
      escortId: req.user.escort.id,
      agencyId: agency.id, // ✅ Usar agency.id (ID de tabla agency)
      status: { in: ['PENDING', 'ACTIVE'] }
    }
  });

  if (existingMembership) {
    const statusText = existingMembership.status === 'PENDING' ? 'pendiente' : 'activa';
    throw new AppError(`Ya tienes una membresía ${statusText} con esta agencia`, 409, 'MEMBERSHIP_EXISTS');
  }

  // Crear solicitud de membresía
  const membership = await prisma.agencyMembership.create({
    data: {
      escortId: req.user.escort.id,
      agencyId: agency.id, // ✅ Usar agency.id
      status: 'PENDING',
      role: 'MEMBER'
    },
    include: {
      escort: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true,
              profileViews: true
            }
          }
        }
      },
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
  });

  // Crear notificación para la agencia
  await prisma.notification.create({
    data: {
      userId: agency.user.id,
      type: 'MEMBERSHIP_REQUEST',
      title: 'Nueva solicitud de membresía',
      message: `${req.user.firstName} ${req.user.lastName} quiere unirse a tu agencia`,
      data: {
        membershipId: membership.id,
        escortId: req.user.escort.id,
        escortName: `${req.user.firstName} ${req.user.lastName}`,
        message: sanitizeString(message) || null
      },
      actionUrl: `/agency/memberships/${membership.id}`
    }
  }).catch(error => {
    logger.warn('Failed to create notification:', error);
  });

  logger.info('Agency membership requested', {
    membershipId: membership.id,
    escortId: req.user.escort.id,
    agencyId: agency.id,
    escortUserId
  });

  res.status(201).json({
    success: true,
    message: 'Solicitud enviada exitosamente',
    data: {
      membership: {
        id: membership.id,
        status: membership.status,
        createdAt: membership.createdAt,
        agency: {
          id: agency.id,
          name: `${agency.user.firstName} ${agency.user.lastName}`
        }
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Invitar escort a la agencia (agency)
const inviteEscort = catchAsync(async (req, res) => {
  const agencyUserId = req.user.id;
  const { escortId } = req.params;
  const {
    message,
    proposedCommission = 0.1,
    proposedRole = 'MEMBER',
    proposedBenefits
  } = req.body;

  // Verificar que el usuario es agencia
  if (req.user.userType !== 'AGENCY') {
    throw new AppError('Solo agencias pueden invitar escorts', 403, 'AGENCY_ONLY');
  }

  // ✅ CORREGIDO: Verificación consistente de que la agencia existe
  if (!req.user.agency) {
    throw new AppError('Datos de agencia no encontrados', 500, 'AGENCY_DATA_MISSING');
  }

  // ✅ CORREGIDO: Sanitización de inputs
  const sanitizedMessage = sanitizeString(message);
  const sanitizedCommission = Math.max(0, Math.min(1, parseFloat(proposedCommission) || 0.1));

  // Verificar que el escort existe y está activo
  const escort = await prisma.escort.findUnique({
    where: { id: escortId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          isActive: true,
          isBanned: true
        }
      }
    }
  });

  if (!escort || !escort.user.isActive || escort.user.isBanned) {
    throw new AppError('Escort no encontrado o no disponible', 404, 'ESCORT_NOT_FOUND');
  }

  // Verificar que no existe ya una invitación pendiente o membresía activa
  const [existingInvitation, existingMembership] = await Promise.all([
    prisma.agencyInvitation.findFirst({
      where: {
        agencyId: req.user.agency.id,
        escortId,
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      }
    }),
    prisma.agencyMembership.findFirst({
      where: {
        escortId,
        agencyId: req.user.agency.id,
        status: { in: ['PENDING', 'ACTIVE'] }
      }
    })
  ]);

  if (existingInvitation) {
    throw new AppError('Ya existe una invitación pendiente para este escort', 409, 'INVITATION_EXISTS');
  }

  if (existingMembership) {
    throw new AppError('Este escort ya es miembro de tu agencia', 409, 'ESCORT_ALREADY_MEMBER');
  }

  // Crear invitación
  const invitation = await prisma.agencyInvitation.create({
    data: {
      agencyId: req.user.agency.id,
      escortId,
      message: sanitizedMessage || null,
      proposedCommission: sanitizedCommission,
      proposedRole,
      proposedBenefits: proposedBenefits || null,
      invitedBy: agencyUserId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
    },
    include: {
      agency: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true
            }
          }
        }
      },
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
  });

  // Crear notificación para el escort
  await prisma.notification.create({
    data: {
      userId: escort.user.id,
      type: 'AGENCY_INVITE',
      title: 'Invitación de agencia',
      message: `${req.user.firstName} ${req.user.lastName} te ha invitado a unirte a su agencia`,
      data: {
        invitationId: invitation.id,
        agencyId: req.user.agency.id,
        agencyName: `${req.user.firstName} ${req.user.lastName}`,
        proposedCommission: sanitizedCommission,
        proposedRole,
        message: sanitizedMessage || null
      },
      actionUrl: `/escort/invitations/${invitation.id}`
    }
  }).catch(error => {
    logger.warn('Failed to create notification:', error);
  });

  logger.info('Escort invited to agency', {
    invitationId: invitation.id,
    agencyId: req.user.agency.id,
    escortId,
    invitedBy: agencyUserId
  });

  res.status(201).json({
    success: true,
    message: 'Invitación enviada exitosamente',
    data: {
      invitation: {
        id: invitation.id,
        status: invitation.status,
        proposedCommission: invitation.proposedCommission,
        proposedRole: invitation.proposedRole,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        escort: {
          id: escort.id,
          name: `${escort.user.firstName} ${escort.user.lastName}`
        }
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Responder a invitación de agencia (escort)
const respondToInvitation = catchAsync(async (req, res) => {
  const escortUserId = req.user.id;
  const { invitationId } = req.params;
  const { action, message } = req.body; // 'accept' o 'reject'

  // Verificar que el usuario es escort
  if (req.user.userType !== 'ESCORT') {
    throw new AppError('Solo escorts pueden responder invitaciones', 403, 'ESCORT_ONLY');
  }

  // ✅ CORREGIDO: Verificación consistente
  if (!req.user.escort) {
    throw new AppError('Datos de escort no encontrados', 500, 'ESCORT_DATA_MISSING');
  }

  // ✅ CORREGIDO: Validación de acción
  if (!['accept', 'reject'].includes(action)) {
    throw new AppError('Acción inválida. Debe ser "accept" o "reject"', 400, 'INVALID_ACTION');
  }

  // Buscar invitación
  const invitation = await prisma.agencyInvitation.findFirst({
    where: {
      id: invitationId,
      escortId: req.user.escort.id,
      status: 'PENDING',
      expiresAt: { gt: new Date() }
    },
    include: {
      agency: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }
    }
  });

  if (!invitation) {
    throw new AppError('Invitación no encontrada o expirada', 404, 'INVITATION_NOT_FOUND');
  }

  // Actualizar estado de la invitación
  const newStatus = action === 'accept' ? 'ACCEPTED' : 'REJECTED';
  const updatedInvitation = await prisma.agencyInvitation.update({
    where: { id: invitationId },
    data: {
      status: newStatus,
      respondedAt: new Date()
    }
  });

  let membership = null;

  // ✅ CORREGIDO: Transacción para operaciones críticas
  if (action === 'accept') {
    const result = await prisma.$transaction(async (tx) => {
      // Crear membresía
      const newMembership = await tx.agencyMembership.create({
        data: {
          escortId: req.user.escort.id,
          agencyId: invitation.agencyId,
          status: 'ACTIVE',
          role: invitation.proposedRole,
          commissionRate: invitation.proposedCommission,
          approvedBy: invitation.invitedBy,
          approvedAt: new Date()
        }
      });

      // Actualizar contadores de la agencia
      await tx.agency.update({
        where: { id: invitation.agencyId },
        data: {
          totalEscorts: { increment: 1 },
          activeEscorts: { increment: 1 }
        }
      });

      return newMembership;
    });

    membership = result;
  }

  // Crear notificación para la agencia
  const notificationMessage = action === 'accept' 
    ? `${req.user.firstName} ${req.user.lastName} aceptó tu invitación`
    : `${req.user.firstName} ${req.user.lastName} rechazó tu invitación`;

  await prisma.notification.create({
    data: {
      userId: invitation.agency.user.id,
      type: 'AGENCY_INVITE',
      title: `Respuesta a invitación`,
      message: notificationMessage,
      data: {
        invitationId: invitation.id,
        escortId: req.user.escort.id,
        escortName: `${req.user.firstName} ${req.user.lastName}`,
        action,
        membershipId: membership?.id || null,
        message: sanitizeString(message) || null
      }
    }
  }).catch(error => {
    logger.warn('Failed to create notification:', error);
  });

  logger.info('Agency invitation responded', {
    invitationId: invitation.id,
    escortId: req.user.escort.id,
    agencyId: invitation.agencyId,
    action
  });

  res.status(200).json({
    success: true,
    message: action === 'accept' ? 'Invitación aceptada exitosamente' : 'Invitación rechazada',
    data: {
      invitation: updatedInvitation,
      membership: membership
    },
    timestamp: new Date().toISOString()
  });
});

// Gestionar solicitudes de membresía (agency)
const manageMembershipRequest = catchAsync(async (req, res) => {
  const agencyUserId = req.user.id;
  const { membershipId } = req.params;
  const { action, message, commissionRate } = req.body; // 'approve' o 'reject'

  // Verificar que el usuario es agencia
  if (req.user.userType !== 'AGENCY') {
    throw new AppError('Solo agencias pueden gestionar membresías', 403, 'AGENCY_ONLY');
  }

  // ✅ CORREGIDO: Verificación consistente
  if (!req.user.agency) {
    throw new AppError('Datos de agencia no encontrados', 500, 'AGENCY_DATA_MISSING');
  }

  // ✅ CORREGIDO: Validación de acción
  if (!['approve', 'reject'].includes(action)) {
    throw new AppError('Acción inválida. Debe ser "approve" o "reject"', 400, 'INVALID_ACTION');
  }

  // Buscar solicitud de membresía
  const membership = await prisma.agencyMembership.findFirst({
    where: {
      id: membershipId,
      agencyId: req.user.agency.id,
      status: 'PENDING'
    },
    include: {
      escort: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }
    }
  });

  if (!membership) {
    throw new AppError('Solicitud de membresía no encontrada', 404, 'MEMBERSHIP_NOT_FOUND');
  }

  // ✅ CORREGIDO: Validación y sanitización de commission rate
  const sanitizedCommissionRate = commissionRate ? 
    Math.max(0, Math.min(1, parseFloat(commissionRate))) : null;

  // ✅ CORREGIDO: Transacción para operaciones críticas
  const updatedMembership = await prisma.$transaction(async (tx) => {
    // Actualizar estado de la membresía
    const newStatus = action === 'approve' ? 'ACTIVE' : 'REJECTED';
    const updateData = {
      status: newStatus,
      approvedBy: agencyUserId,
      approvedAt: new Date(),
      ...(action === 'approve' && sanitizedCommissionRate && { 
        commissionRate: sanitizedCommissionRate 
      })
    };

    const updated = await tx.agencyMembership.update({
      where: { id: membershipId },
      data: updateData
    });

    // Si aprueba, actualizar contadores de la agencia
    if (action === 'approve') {
      await tx.agency.update({
        where: { id: req.user.agency.id },
        data: {
          totalEscorts: { increment: 1 },
          activeEscorts: { increment: 1 }
        }
      });
    }

    return updated;
  });

  // Crear notificación para el escort
  const notificationMessage = action === 'approve'
    ? `Tu solicitud para unirte a ${req.user.firstName} ${req.user.lastName} fue aprobada`
    : `Tu solicitud para unirte a ${req.user.firstName} ${req.user.lastName} fue rechazada`;

  await prisma.notification.create({
    data: {
      userId: membership.escort.user.id,
      type: 'MEMBERSHIP_REQUEST',
      title: action === 'approve' ? 'Solicitud aprobada' : 'Solicitud rechazada',
      message: notificationMessage,
      data: {
        membershipId: membership.id,
        agencyId: req.user.agency.id,
        agencyName: `${req.user.firstName} ${req.user.lastName}`,
        action,
        commissionRate: sanitizedCommissionRate || null,
        message: sanitizeString(message) || null
      }
    }
  }).catch(error => {
    logger.warn('Failed to create notification:', error);
  });

  logger.info('Membership request managed', {
    membershipId: membership.id,
    agencyId: req.user.agency.id,
    escortId: membership.escortId,
    action,
    managedBy: agencyUserId
  });

  res.status(200).json({
    success: true,
    message: action === 'approve' ? 'Solicitud aprobada exitosamente' : 'Solicitud rechazada',
    data: {
      membership: updatedMembership
    },
    timestamp: new Date().toISOString()
  });
});

// Obtener escorts de la agencia
const getAgencyEscorts = catchAsync(async (req, res) => {
  const agencyUserId = req.user.id;
  const { page = 1, limit = 20, status = 'active', search } = req.query;

  // Verificar que el usuario es agencia
  if (req.user.userType !== 'AGENCY') {
    throw new AppError('Solo agencias pueden ver sus escorts', 403, 'AGENCY_ONLY');
  }

  // ✅ CORREGIDO: Verificación consistente
  if (!req.user.agency) {
    throw new AppError('Datos de agencia no encontrados', 500, 'AGENCY_DATA_MISSING');
  }

  // ✅ CORREGIDO: Validación de paginación consistente
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  // Filtros según status
  const whereClause = {
    agencyId: req.user.agency.id,
    ...(status === 'active' && { status: 'ACTIVE' }),
    ...(status === 'pending' && { status: 'PENDING' }),
    ...(status === 'all' && {}),
    ...(search && {
      escort: {
        user: {
          OR: [
            { firstName: { contains: sanitizeString(search), mode: 'insensitive' } },
            { lastName: { contains: sanitizeString(search), mode: 'insensitive' } },
            { username: { contains: sanitizeString(search), mode: 'insensitive' } }
          ]
        }
      }
    })
  };

  const [memberships, totalCount] = await Promise.all([
    prisma.agencyMembership.findMany({
      where: whereClause,
      include: {
        escort: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatar: true,
                phone: true,
                profileViews: true,
                lastActiveAt: true,
                createdAt: true
              }
            },
            _count: {
              select: {
                agencyMemberships: {
                  where: { status: 'ACTIVE' }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limitNum
    }),
    prisma.agencyMembership.count({ where: whereClause })
  ]);

  const formattedEscorts = memberships.map(membership => ({
    membershipId: membership.id,
    status: membership.status,
    role: membership.role,
    commissionRate: membership.commissionRate,
    joinedAt: membership.createdAt,
    approvedAt: membership.approvedAt,
    escort: {
      id: membership.escort.id,
      user: membership.escort.user,
      isVerified: membership.escort.isVerified,
      rating: membership.escort.rating,
      totalRatings: membership.escort.totalRatings,
      age: membership.escort.age,
      services: membership.escort.services,
      currentPosts: membership.escort.currentPosts,
      totalBookings: membership.escort.totalBookings,
      stats: membership.escort._count
    }
  }));

  const pagination = {
    page: pageNum,
    limit: limitNum,
    total: totalCount,
    pages: Math.ceil(totalCount / limitNum),
    hasNext: pageNum * limitNum < totalCount,
    hasPrev: pageNum > 1
  };

  res.status(200).json({
    success: true,
    data: {
      escorts: formattedEscorts,
      pagination,
      filters: {
        status,
        search
      }
    },
    timestamp: new Date().toISOString()
  });
});

// ✅ NUEVO: Obtener pricing de verificaciones
const getVerificationPricing = catchAsync(async (req, res) => {
  const pricing = await prisma.verificationPricing.findMany({
    where: { isActive: true },
    orderBy: { cost: 'asc' }
  });

  res.status(200).json({
    success: true,
    data: pricing,
    timestamp: new Date().toISOString()
  });
});

// Verificar escort (agency) - FUNCIÓN CLAVE DEL REQUERIMIENTO
const verifyEscort = catchAsync(async (req, res) => {
  const agencyUserId = req.user.id;
  const { escortId } = req.params;
  const { pricingId, verificationNotes } = req.body;

  // Verificar que el usuario es agencia
  if (req.user.userType !== 'AGENCY') {
    throw new AppError('Solo agencias pueden verificar escorts', 403, 'AGENCY_ONLY');
  }

  // ✅ CORREGIDO: Verificación consistente
  if (!req.user.agency) {
    throw new AppError('Datos de agencia no encontrados', 500, 'AGENCY_DATA_MISSING');
  }

  // Verificar que el escort es miembro activo de la agencia
  const membership = await prisma.agencyMembership.findFirst({
    where: {
      escortId,
      agencyId: req.user.agency.id,
      status: 'ACTIVE'
    },
    include: {
      escort: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }
    }
  });

  if (!membership) {
    throw new AppError('El escort no es miembro activo de tu agencia', 404, 'ESCORT_NOT_MEMBER');
  }

  // Verificar que no está ya verificado
  if (membership.escort.isVerified) {
    throw new AppError('Este escort ya está verificado', 409, 'ESCORT_ALREADY_VERIFIED');
  }

  // Obtener pricing de verificación
  const pricing = await prisma.verificationPricing.findUnique({
    where: {
      id: pricingId,
      isActive: true
    }
  });

  if (!pricing) {
    throw new AppError('Plan de verificación no encontrado', 404, 'PRICING_NOT_FOUND');
  }

  // ✅ CORREGIDO: Verificar que no hay verificación en progreso
  const existingVerification = await prisma.escortVerification.findFirst({
    where: {
      escortId,
      agencyId: req.user.agency.id,
      status: { in: ['PENDING', 'COMPLETED'] }
    }
  });

  if (existingVerification) {
    throw new AppError('Ya existe una verificación para este escort', 409, 'VERIFICATION_EXISTS');
  }

  // ✅ CORREGIDO: Transacción para operaciones críticas
  const result = await prisma.$transaction(async (tx) => {
    // Crear verificación
    const verification = await tx.escortVerification.create({
      data: {
        agencyId: req.user.agency.id,
        escortId,
        pricingId,
        membershipId: membership.id,
        status: 'COMPLETED', // En producción sería PENDING hasta completar pago
        verificationNotes: sanitizeString(verificationNotes) || null,
        verifiedBy: agencyUserId,
        completedAt: new Date()
      }
    });

    // Marcar escort como verificado
    await tx.escort.update({
      where: { id: escortId },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: req.user.agency.id.toString() // ID de la agencia que verificó
      }
    });

    // Actualizar contadores de la agencia
    await tx.agency.update({
      where: { id: req.user.agency.id },
      data: {
        verifiedEscorts: { increment: 1 },
        totalVerifications: { increment: 1 }
      }
    });

    // Actualizar reputación del escort
    await tx.userReputation.upsert({
      where: { userId: membership.escort.user.id },
      update: {
        trustScore: { increment: 25 },
        overallScore: { increment: 15 },
        lastScoreUpdate: new Date()
      },
      create: {
        userId: membership.escort.user.id,
        overallScore: 15,
        trustScore: 25,
        responseRate: 0,
        profileCompleteness: 0,
        discoveryScore: 0,
        trendingScore: 0,
        qualityScore: 0,
        spamScore: 0,
        reportScore: 0,
        lastScoreUpdate: new Date()
      }
    });

    return verification;
  });

  // Crear notificación para el escort
  await prisma.notification.create({
    data: {
      userId: membership.escort.user.id,
      type: 'VERIFICATION_COMPLETED',
      title: '¡Verificación completada!',
      message: `Tu perfil ha sido verificado por ${req.user.firstName} ${req.user.lastName}`,
      data: {
        verificationId: result.id,
        agencyId: req.user.agency.id,
        agencyName: `${req.user.firstName} ${req.user.lastName}`,
        pricingName: pricing.name
      }
    }
  }).catch(error => {
    logger.warn('Failed to create notification:', error);
  });

  logger.info('Escort verified by agency', {
    verificationId: result.id,
    escortId,
    agencyId: req.user.agency.id,
    verifiedBy: agencyUserId,
    pricingId,
    cost: pricing.cost
  });

  res.status(200).json({
    success: true,
    message: 'Escort verificado exitosamente',
    data: {
      verification: {
        id: result.id,
        status: result.status,
        completedAt: result.completedAt,
        pricing: {
          name: pricing.name,
          cost: pricing.cost,
          features: pricing.features
        },
        escort: {
          id: membership.escort.id,
          name: `${membership.escort.user.firstName} ${membership.escort.user.lastName}`,
          isVerified: true
        }
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Obtener estadísticas de la agencia
const getAgencyStats = catchAsync(async (req, res) => {
  const agencyUserId = req.user.id;

  // Verificar que el usuario es agencia
  if (req.user.userType !== 'AGENCY') {
    throw new AppError('Solo agencias pueden ver estadísticas', 403, 'AGENCY_ONLY');
  }

  // ✅ CORREGIDO: Verificación consistente
  if (!req.user.agency) {
    throw new AppError('Datos de agencia no encontrados', 500, 'AGENCY_DATA_MISSING');
  }

  const [
    membershipStats,
    invitationStats,
    verificationStats,
    topEscorts
  ] = await Promise.all([
    // Estadísticas de membresías
    prisma.agencyMembership.groupBy({
      by: ['status'],
      where: { agencyId: req.user.agency.id },
      _count: true
    }),
    // Estadísticas de invitaciones
    prisma.agencyInvitation.groupBy({
      by: ['status'],
      where: { agencyId: req.user.agency.id },
      _count: true
    }),
    // Estadísticas de verificaciones
    prisma.escortVerification.findMany({
      where: { agencyId: req.user.agency.id },
      include: {
        pricing: {
          select: {
            cost: true
          }
        }
      }
    }),
    // Top escorts por rating
    prisma.agencyMembership.findMany({
      where: {
        agencyId: req.user.agency.id,
        status: 'ACTIVE'
      },
      include: {
        escort: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true
              }
            }
          }
        }
      },
      orderBy: {
        escort: {
          rating: 'desc'
        }
      },
      take: 5
    })
  ]);

  // Procesar estadísticas
  const membershipsByStatus = membershipStats.reduce((acc, item) => {
    acc[item.status] = item._count;
    return acc;
  }, {});

  const invitationsByStatus = invitationStats.reduce((acc, item) => {
    acc[item.status] = item._count;
    return acc;
  }, {});

  const totalVerificationRevenue = verificationStats.reduce((sum, v) => sum + v.pricing.cost, 0);

  const stats = {
    memberships: {
      total: membershipStats.reduce((sum, item) => sum + item._count, 0),
      byStatus: membershipsByStatus,
      active: membershipsByStatus.ACTIVE || 0,
      pending: membershipsByStatus.PENDING || 0
    },
    invitations: {
      total: invitationStats.reduce((sum, item) => sum + item._count, 0),
      byStatus: invitationsByStatus,
      pending: invitationsByStatus.PENDING || 0,
      accepted: invitationsByStatus.ACCEPTED || 0,
      rejected: invitationsByStatus.REJECTED || 0
    },
    verifications: {
      total: verificationStats.length,
      totalRevenue: totalVerificationRevenue,
      averageCost: verificationStats.length > 0 ? totalVerificationRevenue / verificationStats.length : 0
    },
    topEscorts: topEscorts.map(membership => ({
      id: membership.escort.id,
      name: `${membership.escort.user.firstName} ${membership.escort.user.lastName}`,
      avatar: membership.escort.user.avatar,
      rating: membership.escort.rating,
      totalRatings: membership.escort.totalRatings,
      isVerified: membership.escort.isVerified,
      totalBookings: membership.escort.totalBookings
    }))
  };

  res.status(200).json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString()
  });
});

module.exports = {
  searchAgencies,
  requestToJoinAgency,
  inviteEscort,
  respondToInvitation,
  manageMembershipRequest,
  getAgencyEscorts,
  getVerificationPricing, // ✅ NUEVO
  verifyEscort,
  getAgencyStats
};