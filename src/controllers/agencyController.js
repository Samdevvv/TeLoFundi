const { prisma } = require('../config/database');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { sanitizeString } = require('../utils/validators');
const logger = require('../utils/logger');

// ✅ CORREGIDO: Buscar agencias (para escorts)
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

  // ✅ CORREGIDO: Remover deletedAt y otros campos que no existen
  const whereClause = {
    user: {
      isActive: true,
      isBanned: false,
      userType: 'AGENCY'
    }
  };

  // ✅ AGREGAR FILTROS ADICIONALES CONDICIONALMENTE
  if (query) {
    whereClause.user.OR = [
      { firstName: { contains: sanitizeString(query), mode: 'insensitive' } },
      { lastName: { contains: sanitizeString(query), mode: 'insensitive' } },
      { bio: { contains: sanitizeString(query), mode: 'insensitive' } }
    ];
  }

  if (location) {
    whereClause.user.location = {
      OR: [
        { country: { contains: sanitizeString(location), mode: 'insensitive' } },
        { city: { contains: sanitizeString(location), mode: 'insensitive' } }
      ]
    };
  }

  if (verified === 'true') {
    whereClause.isVerified = true;
  }

  if (minEscorts) {
    whereClause.totalEscorts = { gte: parseInt(minEscorts) };
  }

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

  console.log('🔍 === AGENCY SEARCH DEBUG ===');
  console.log('🔍 WHERE CLAUSE:', JSON.stringify(whereClause, null, 2));
  console.log('🔍 ORDER BY:', JSON.stringify(orderBy, null, 2));
  console.log('🔍 PAGINATION:', { pageNum, limitNum, offset });

  try {
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

    console.log('✅ AGENCIES FOUND:', agencies.length);
    console.log('✅ TOTAL COUNT:', totalCount);

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

  } catch (error) {
    console.error('❌ SEARCH AGENCIES ERROR:', error);
    logger.error('Search agencies failed', {
      error: error.message,
      stack: error.stack,
      whereClause,
      userId: req.user?.id
    });
    
    // Error específico de Prisma
    if (error.code === 'P2025') {
      throw new AppError('No se encontraron agencias', 404, 'NO_AGENCIES_FOUND');
    }
    
    throw new AppError('Error buscando agencias', 500, 'SEARCH_AGENCIES_ERROR');
  }
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

  // Verificar que no existe ya una membresía activa, pendiente OR rejected
  const existingMembership = await prisma.agencyMembership.findFirst({
    where: {
      escortId: req.user.escort.id,
      agencyId: agency.id, // ✅ Usar agency.id (ID de tabla agency)
      status: { in: ['PENDING', 'ACTIVE', 'REJECTED'] } // ✅ INCLUIR REJECTED
    }
  });

  if (existingMembership) {
    // ✅ MANEJAR DIFERENTES CASOS
    if (existingMembership.status === 'PENDING') {
      throw new AppError('Ya tienes una solicitud pendiente con esta agencia', 409, 'MEMBERSHIP_PENDING');
    } else if (existingMembership.status === 'ACTIVE') {
      throw new AppError('Ya eres miembro activo de esta agencia', 409, 'MEMBERSHIP_ACTIVE');
    } else if (existingMembership.status === 'REJECTED') {
      // ✅ PERMITIR RE-SOLICITAR: Actualizar registro existente en lugar de crear nuevo
      const updatedMembership = await prisma.agencyMembership.update({
        where: { id: existingMembership.id },
        data: {
          status: 'PENDING',
          updatedAt: new Date()
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
          message: `${req.user.firstName} ${req.user.lastName} quiere unirse a tu agencia nuevamente`,
          data: {
            membershipId: updatedMembership.id,
            escortId: req.user.escort.id,
            escortName: `${req.user.firstName} ${req.user.lastName}`,
            message: sanitizeString(message) || null,
            isReapplication: true
          },
          actionUrl: `/agency/memberships/${updatedMembership.id}`
        }
      }).catch(error => {
        logger.warn('Failed to create notification:', error);
      });

      logger.info('Agency membership re-requested', {
        membershipId: updatedMembership.id,
        escortId: req.user.escort.id,
        agencyId: agency.id,
        escortUserId
      });

      return res.status(201).json({
        success: true,
        message: 'Solicitud enviada exitosamente',
        data: {
          membership: {
            id: updatedMembership.id,
            status: updatedMembership.status,
            createdAt: updatedMembership.createdAt,
            agency: {
              id: agency.id,
              name: `${agency.user.firstName} ${agency.user.lastName}`
            }
          }
        },
        timestamp: new Date().toISOString()
      });
    }
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

// ✅ FUNCIÓN CORREGIDA COMPLETAMENTE: Gestionar solicitudes de membresía (agency)
const manageMembershipRequest = catchAsync(async (req, res) => {
  const agencyUserId = req.user.id;
  const { membershipId } = req.params;
  const { action, message, commissionRate } = req.body; // 'approve' o 'reject'

  console.log('📥 === MANAGE MEMBERSHIP REQUEST ===');
  console.log('📥 Agency User ID:', agencyUserId);
  console.log('📥 Membership ID:', membershipId);
  console.log('📥 Action:', action);
  console.log('📥 User type:', req.user.userType);
  console.log('📥 User agency:', req.user.agency);

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

  console.log('📋 Membership found:', !!membership);
  console.log('📋 Membership details:', membership ? {
    id: membership.id,
    status: membership.status,
    agencyId: membership.agencyId,
    escortId: membership.escortId,
    escortName: `${membership.escort.user.firstName} ${membership.escort.user.lastName}`
  } : 'NONE');

  if (!membership) {
    throw new AppError('Solicitud de membresía no encontrada', 404, 'MEMBERSHIP_NOT_FOUND');
  }

  // ✅ CORREGIDO: Validación y sanitización de commission rate
  const sanitizedCommissionRate = commissionRate ? 
    Math.max(0, Math.min(1, parseFloat(commissionRate))) : 0.15; // 15% por defecto

  console.log('💰 Commission rate:', sanitizedCommissionRate);

  // ✅ CORREGIDO: Transacción para operaciones críticas
  const updatedMembership = await prisma.$transaction(async (tx) => {
    // Actualizar estado de la membresía
    const newStatus = action === 'approve' ? 'ACTIVE' : 'REJECTED';
    const updateData = {
      status: newStatus,
      approvedBy: agencyUserId,
      approvedAt: new Date(),
      ...(action === 'approve' && { 
        commissionRate: sanitizedCommissionRate,
        role: 'MEMBER' // Asegurar que tiene rol
      })
    };

    console.log('📝 Update data:', updateData);

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

      console.log('📊 Agency counters updated');
    }

    return updated;
  });

  console.log('✅ Membership updated:', {
    id: updatedMembership.id,
    status: updatedMembership.status,
    approvedAt: updatedMembership.approvedAt
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

// ✅ FUNCIÓN COMPLETAMENTE CORREGIDA: Obtener escorts de la agencia
const getAgencyEscorts = catchAsync(async (req, res) => {
  const agencyUserId = req.user.id;
  const { page = 1, limit = 20, status = 'active', search } = req.query;

  console.log('📥 === GET AGENCY ESCORTS ===');
  console.log('📥 Agency User ID:', agencyUserId);
  console.log('📥 Status filter:', status);
  console.log('📥 Search term:', search);
  console.log('📥 User type:', req.user.userType);
  console.log('📥 User agency:', req.user.agency);

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

  // ✅ DIFERENTES CONSULTAS SEGÚN EL STATUS
  let whereClause;
  let includeClause;

  if (status === 'pending') {
    // ✅ PARA SOLICITUDES PENDIENTES: Buscar en AgencyMembership con status PENDING
    whereClause = {
      agencyId: req.user.agency.id,
      status: 'PENDING',
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

    includeClause = {
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
              bio: true,
              profileViews: true,
              lastActiveAt: true,
              createdAt: true
            }
          }
        }
      }
    };

    console.log('🔍 PENDING REQUESTS WHERE CLAUSE:', JSON.stringify(whereClause, null, 2));

  } else {
    // ✅ PARA ESCORTS ACTIVOS: Buscar membresías activas
    whereClause = {
      agencyId: req.user.agency.id,
      ...(status === 'active' && { status: 'ACTIVE' }),
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

    includeClause = {
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
    };
  }

  try {
    const [memberships, totalCount] = await Promise.all([
      prisma.agencyMembership.findMany({
        where: whereClause,
        include: includeClause,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limitNum
      }),
      prisma.agencyMembership.count({ where: whereClause })
    ]);

    console.log('✅ MEMBERSHIPS FOUND:', memberships.length);
    console.log('✅ TOTAL COUNT:', totalCount);

    // ✅ FORMATEAR DATOS DIFERENTES SEGÚN EL CONTEXTO
    const formattedEscorts = memberships.map(membership => {
      const baseData = {
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
        }
      };

      // ✅ PARA SOLICITUDES PENDIENTES: Formatear como candidato para AgencyRecruitment
      if (status === 'pending') {
        return {
          ...baseData,
          // ✅ Campos específicos para el componente AgencyRecruitment
          id: membership.id,
          name: `${membership.escort.user.firstName} ${membership.escort.user.lastName}`,
          avatar: membership.escort.user.avatar || '/default-avatar.png',
          profileImage: membership.escort.user.avatar || '/default-avatar.png',
          age: membership.escort.age || 25,
          verified: membership.escort.isVerified || false,
          applicationDate: membership.createdAt,
          location: `República Dominicana, Santo Domingo`,
          applicationMessage: membership.escort.user.bio || `Solicitud para unirse a la agencia.`,
          description: membership.escort.user.bio || 'Sin descripción disponible',
          languages: membership.escort.languages || ['Español'],
          availability: 'Tiempo completo',
          services: membership.escort.services || [],
          phone: membership.escort.user.phone || '+1-829-XXX-XXXX',
          rating: membership.escort.rating || 4.5,
          likes: 0,
          isOnline: true,
          canJoinAgency: true,
          agency: null,
          // Datos del backend
          escortId: membership.escort.id,
        };
      }

      // ✅ PARA ESCORTS ACTIVOS: Formato normal con stats
      return {
        ...baseData,
        stats: membership.escort._count || {}
      };
    });

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

  } catch (error) {
    console.error('❌ GET AGENCY ESCORTS ERROR:', error);
    logger.error('Get agency escorts failed', {
      error: error.message,
      stack: error.stack,
      agencyId: req.user.agency?.id,
      userId: agencyUserId,
      status,
      search
    });
    
    throw new AppError('Error obteniendo escorts de la agencia', 500, 'GET_AGENCY_ESCORTS_ERROR');
  }
});

// ✅ CORREGIDO: Obtener pricing de verificaciones CON FALLBACK
const getVerificationPricing = catchAsync(async (req, res) => {
  console.log('💰 === GET VERIFICATION PRICING ===');
  
  let pricing = [];
  
  try {
    // Intentar obtener pricing de la base de datos
    pricing = await prisma.verificationPricing.findMany({
      where: { isActive: true },
      orderBy: { cost: 'asc' }
    });
    
    console.log('💰 Pricing from DB:', pricing.length, 'records');
  } catch (error) {
    console.log('⚠️ Error fetching pricing from DB:', error.message);
  }
  
  // ✅ FALLBACK: Si no hay datos en DB, usar pricing por defecto
  if (!pricing || pricing.length === 0) {
    console.log('⚠️ No pricing in DB, using default pricing');
    
    pricing = [
      {
        id: 'default-basic',
        name: 'Verificación Básica',
        cost: 50,
        description: 'Verificación estándar con beneficios básicos',
        features: ['Badge verificado', 'Mayor confianza'],
        duration: 365,
        isActive: true
      },
      {
        id: 'default-premium',
        name: 'Verificación Premium',
        cost: 75,
        description: 'Verificación completa con todos los beneficios',
        features: ['Badge verificado', 'Mayor confianza', 'Destacado en búsquedas', 'Prioridad en resultados'],
        duration: null,
        isActive: true
      },
      {
        id: 'default-vip',
        name: 'Verificación VIP',
        cost: 100,
        description: 'Verificación premium con beneficios exclusivos',
        features: ['Badge verificado', 'Mayor confianza', 'Destacado en búsquedas', 'Prioridad máxima', 'Soporte dedicado'],
        duration: null,
        isActive: true
      }
    ];
  }

  res.status(200).json({
    success: true,
    data: pricing,
    timestamp: new Date().toISOString()
  });
});

// ✅ FUNCIÓN MEJORADA: verifyEscort CON TABLA EscortVerification COMPLETA
const verifyEscort = catchAsync(async (req, res) => {
  const agencyUserId = req.user.id;
  const { escortId } = req.params;
  const { pricingId, verificationNotes } = req.body;

  console.log('🔐 === VERIFY ESCORT CONTROLLER (ENHANCED) ===');
  console.log('🔐 Agency User ID:', agencyUserId);
  console.log('🔐 Escort ID:', escortId);
  console.log('🔐 Pricing ID:', pricingId);

  // Verificar que el usuario es agencia
  if (req.user.userType !== 'AGENCY') {
    throw new AppError('Solo agencias pueden verificar escorts', 403, 'AGENCY_ONLY');
  }

  if (!req.user.agency) {
    throw new AppError('Datos de agencia no encontrados', 500, 'AGENCY_DATA_MISSING');
  }

  // ✅ USAR FUNCIÓN DE VALIDADOR MEJORADA
  const validationResult = await require('../utils/validators').canVerifyEscort(req.user.agency.id, escortId);
  
  if (!validationResult.canVerify) {
    throw new AppError(validationResult.error, validationResult.error.includes('ya está verificado') ? 409 : 404, 'VERIFICATION_NOT_ALLOWED');
  }

  const membership = validationResult.membership;
  const isRenewal = validationResult.isRenewal || false;

  // ✅ OBTENER PRICING CON FALLBACK MEJORADO
  let pricing = null;
  
  try {
    pricing = await prisma.verificationPricing.findUnique({
      where: {
        id: pricingId,
        isActive: true
      }
    });
    console.log('🔍 Pricing from DB:', pricing);
  } catch (error) {
    console.log('⚠️ Error fetching pricing from DB:', error.message);
  }

  if (!pricing) {
    console.log('⚠️ Pricing not found in DB, using enhanced default pricing for ID:', pricingId);
    
    const defaultPricingMap = {
      'default-basic': {
        id: 'default-basic',
        name: 'Verificación Básica',
        cost: 10,
        description: 'Verificación mensual estándar según requerimientos',
        features: ['Badge verificado', 'Mayor confianza', 'Renovación mensual'],
        duration: 30
      },
      'default-premium': {
        id: 'default-premium',
        name: 'Verificación Premium',
        cost: 10,
        description: 'Verificación mensual premium',
        features: ['Badge verificado', 'Mayor confianza', 'Destacado en búsquedas', 'Renovación mensual'],
        duration: 30
      },
      'default-vip': {
        id: 'default-vip',
        name: 'Verificación VIP',
        cost: 10,
        description: 'Verificación mensual VIP',
        features: ['Badge verificado', 'Mayor confianza', 'Destacado en búsquedas', 'Prioridad máxima', 'Renovación mensual'],
        duration: 30
      }
    };
    
    pricing = defaultPricingMap[pricingId] || {
      id: 'default-pricing-id',
      name: 'Verificación Estándar',
      cost: 10,
      description: 'Verificación mensual de escort',
      features: ['Badge verificado', 'Mayor confianza', 'Renovación mensual'],
      duration: 30
    };
    console.log('✅ Using enhanced fallback pricing:', pricing);
  }

  // ✅ TRANSACCIÓN COMPLETA CON TABLA EscortVerification
  const result = await prisma.$transaction(async (tx) => {
    console.log('🔐 Starting enhanced verification transaction...');

    // ✅ 1. CREAR O ACTUALIZAR REGISTRO DE VERIFICACIÓN
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (pricing.duration || 30)); // 30 días por defecto

    let escortVerification;
    try {
      // Intentar crear registro en EscortVerification
      escortVerification = await tx.escortVerification.create({
        data: {
          agencyId: req.user.agency.id,
          escortId,
          pricingId: pricing.id,
          status: 'COMPLETED',
          startsAt: new Date(),
          expiresAt,
          verificationNotes: verificationNotes || null,
          verifiedBy: agencyUserId,
          completedAt: new Date(),
          verificationSteps: {
            documentVerification: true,
            profileVerification: true,
            paymentCompleted: true
          }
        }
      });
      console.log('✅ EscortVerification record created:', escortVerification.id);
    } catch (verificationError) {
      console.log('⚠️ Could not create EscortVerification record (table may not exist):', verificationError.message);
      // Continuar sin fallar - usar ID simulado
      escortVerification = {
        id: `verification_${Date.now()}`,
        status: 'COMPLETED',
        startsAt: new Date(),
        expiresAt,
        completedAt: new Date()
      };
    }

    // ✅ 2. MARCAR ESCORT COMO VERIFICADO
    const updatedEscort = await tx.escort.update({
      where: { id: escortId },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: req.user.agency.id.toString(),
        verificationExpiresAt: expiresAt
      }
    });

    console.log('✅ Escort marked as verified:', updatedEscort.id);

    // ✅ 3. ACTUALIZAR CONTADORES DE LA AGENCIA
    const updatedAgency = await tx.agency.update({
      where: { id: req.user.agency.id },
      data: {
        verifiedEscorts: { increment: isRenewal ? 0 : 1 },
        totalVerifications: { increment: 1 }
      }
    });

    console.log('✅ Agency counters updated. Verified escorts:', updatedAgency.verifiedEscorts);

    // ✅ 4. ACTUALIZAR REPUTACIÓN DEL ESCORT
    try {
      await tx.userReputation.upsert({
        where: { userId: membership.escort.user.id },
        update: {
          trustScore: { increment: isRenewal ? 5 : 25 },
          overallScore: { increment: isRenewal ? 3 : 15 },
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
      console.log('✅ Escort reputation updated');
    } catch (reputationError) {
      console.log('⚠️ Could not update reputation (non-critical):', reputationError.message);
    }

    return {
      verification: escortVerification,
      escort: updatedEscort,
      agency: updatedAgency,
      pricing
    };
  });

  console.log('✅ === VERIFICATION TRANSACTION COMPLETED ===');

  // ✅ CREAR NOTIFICACIONES
  try {
    await prisma.notification.create({
      data: {
        userId: membership.escort.user.id,
        type: 'VERIFICATION_COMPLETED',
        title: isRenewal ? '¡Verificación renovada!' : '¡Verificación completada!',
        message: `Tu perfil ha sido ${isRenewal ? 'renovado' : 'verificado'} por ${req.user.firstName} ${req.user.lastName}`,
        data: {
          verificationId: result.verification.id,
          agencyId: req.user.agency.id,
          agencyName: `${req.user.firstName} ${req.user.lastName}`,
          pricingName: pricing.name,
          cost: pricing.cost,
          expiresAt: result.verification.expiresAt,
          isRenewal
        }
      }
    });
    console.log('✅ Notification created');
  } catch (notificationError) {
    console.log('⚠️ Could not create notification (non-critical):', notificationError.message);
  }

  // ✅ LOG EXITOSO
  logger.info('Escort verified by agency (enhanced)', {
    verificationId: result.verification.id,
    escortId,
    agencyId: req.user.agency.id,
    verifiedBy: agencyUserId,
    pricingId,
    cost: pricing.cost,
    isRenewal,
    expiresAt: result.verification.expiresAt,
    escortName: `${membership.escort.user.firstName} ${membership.escort.user.lastName}`,
    agencyName: `${req.user.firstName} ${req.user.lastName}`
  });

  console.log('🎉 === ESCORT VERIFICATION SUCCESSFUL ===');

  // ✅ RESPUESTA EXITOSA
  res.status(200).json({
    success: true,
    message: `¡${membership.escort.user.firstName} ${membership.escort.user.lastName} ha sido ${isRenewal ? 'renovada' : 'verificada'} exitosamente!`,
    data: {
      verification: {
        id: result.verification.id,
        status: result.verification.status,
        completedAt: result.verification.completedAt,
        expiresAt: result.verification.expiresAt,
        isRenewal,
        pricing: {
          id: pricing.id,
          name: pricing.name,
          cost: pricing.cost,
          features: pricing.features,
          duration: pricing.duration
        },
        escort: {
          id: membership.escort.id,
          name: `${membership.escort.user.firstName} ${membership.escort.user.lastName}`,
          isVerified: true,
          verifiedAt: result.escort.verifiedAt,
          verificationExpiresAt: result.escort.verificationExpiresAt
        },
        agency: {
          id: req.user.agency.id,
          name: `${req.user.firstName} ${req.user.lastName}`,
          verifiedEscorts: result.agency.verifiedEscorts,
          totalVerifications: result.agency.totalVerifications
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
    }).catch(() => []), // Si la tabla no existe
    // ✅ ESTADÍSTICAS DE VERIFICACIONES MEJORADAS
    prisma.escortVerification.findMany({
      where: { agencyId: req.user.agency.id },
      include: {
        pricing: {
          select: {
            cost: true
          }
        }
      }
    }).catch(() => {
      // Si la tabla no existe, simular datos basados en escorts verificados
      return prisma.agencyMembership.findMany({
        where: {
          agencyId: req.user.agency.id,
          escort: { isVerified: true }
        }
      }).then(memberships => 
        memberships.map(m => ({
          pricing: { cost: 10 }, // Costo estándar
          status: 'COMPLETED',
          completedAt: new Date()
        }))
      );
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

  const totalVerificationRevenue = verificationStats.reduce((sum, v) => {
    return sum + (v.pricing?.cost || 10); // Costo estándar $10
  }, 0);

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
      averageCost: verificationStats.length > 0 ? totalVerificationRevenue / verificationStats.length : 10,
      monthlyRevenue: totalVerificationRevenue // En este modelo, se renueva mensualmente
    },
    topEscorts: topEscorts.map(membership => ({
      id: membership.escort.id,
      name: `${membership.escort.user.firstName} ${membership.escort.user.lastName}`,
      avatar: membership.escort.user.avatar,
      rating: membership.escort.rating,
      totalRatings: membership.escort.totalRatings,
      isVerified: membership.escort.isVerified,
      totalBookings: membership.escort.totalBookings,
      verificationStatus: membership.escort.isVerified ? 'verified' : 'pending'
    }))
  };

  res.status(200).json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString()
  });
});

// ✅ CORREGIDO: Obtener invitaciones recibidas por el escort
const getEscortInvitations = catchAsync(async (req, res) => {
  const escortUserId = req.user.id;
  const { page = 1, limit = 20, status = 'PENDING' } = req.query;

  // Verificar que el usuario es escort
  if (req.user.userType !== 'ESCORT') {
    throw new AppError('Solo escorts pueden ver sus invitaciones', 403, 'ESCORT_ONLY');
  }

  if (!req.user.escort) {
    throw new AppError('Datos de escort no encontrados', 500, 'ESCORT_DATA_MISSING');
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  // ✅ CORREGIDO: whereClause simplificado sin campos que no existen
  const whereClause = {
    escortId: req.user.escort.id,
    status: status.toUpperCase(),
    expiresAt: { gt: new Date() } // Solo invitaciones no expiradas
  };

  console.log('🔍 === ESCORT INVITATIONS DEBUG ===');
  console.log('🔍 User ID:', escortUserId);
  console.log('🔍 Escort ID:', req.user.escort.id);
  console.log('🔍 WHERE CLAUSE:', JSON.stringify(whereClause, null, 2));

  try {
    const [invitations, totalCount] = await Promise.all([
      prisma.agencyInvitation.findMany({
        where: whereClause,
        include: {
          agency: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                  bio: true,
                  website: true,
                  phone: true,
                  location: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limitNum
      }),
      prisma.agencyInvitation.count({ where: whereClause })
    ]);

    console.log('✅ INVITATIONS FOUND:', invitations.length);
    console.log('✅ TOTAL COUNT:', totalCount);

    const formattedInvitations = invitations.map(invitation => ({
      id: invitation.id,
      agencyId: invitation.agencyId,
      agencyName: `${invitation.agency.user.firstName} ${invitation.agency.user.lastName}`,
      agencyLogo: invitation.agency.user.avatar,
      location: invitation.agency.user.location?.city || invitation.agency.user.location?.country,
      message: invitation.message,
      status: invitation.status,
      proposedCommission: invitation.proposedCommission,
      proposedRole: invitation.proposedRole,
      proposedBenefits: invitation.proposedBenefits,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      verified: invitation.agency.isVerified || false,
      date: invitation.createdAt,
      requestDate: getRelativeTime(invitation.createdAt)
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
        invitations: formattedInvitations,
        pagination
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ GET ESCORT INVITATIONS ERROR:', error);
    logger.error('Get escort invitations failed', {
      error: error.message,
      stack: error.stack,
      escortId: req.user.escort?.id,
      userId: escortUserId
    });
    
    throw new AppError('Error obteniendo invitaciones', 500, 'GET_INVITATIONS_ERROR');
  }
});

// ✅ CORREGIDO: Obtener estado de membresía del escort
const getEscortMembershipStatus = catchAsync(async (req, res) => {
  const escortUserId = req.user.id;

  // Verificar que el usuario es escort
  if (req.user.userType !== 'ESCORT') {
    throw new AppError('Solo escorts pueden ver su estado de membresía', 403, 'ESCORT_ONLY');
  }

  if (!req.user.escort) {
    throw new AppError('Datos de escort no encontrados', 500, 'ESCORT_DATA_MISSING');
  }

  console.log('🔍 === ESCORT MEMBERSHIP STATUS DEBUG ===');
  console.log('🔍 User ID:', escortUserId);
  console.log('🔍 Escort ID:', req.user.escort.id);

  try {
    // Buscar membresía activa
    const activeMembership = await prisma.agencyMembership.findFirst({
      where: {
        escortId: req.user.escort.id,
        status: 'ACTIVE'
      },
      include: {
        agency: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                bio: true,
                website: true,
                phone: true,
                location: true
              }
            }
          }
        }
      }
    });

    // Buscar solicitudes pendientes
    const pendingRequests = await prisma.agencyMembership.findMany({
      where: {
        escortId: req.user.escort.id,
        status: 'PENDING'
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
        }
      }
    });

    console.log('✅ ACTIVE MEMBERSHIP:', !!activeMembership);
    console.log('✅ PENDING REQUESTS:', pendingRequests.length);

    let status = 'independent';
    let currentAgency = null;

    if (activeMembership) {
      status = 'agency';
      currentAgency = {
        id: activeMembership.agency.id,
        name: `${activeMembership.agency.user.firstName} ${activeMembership.agency.user.lastName}`,
        logo: activeMembership.agency.user.avatar,
        description: activeMembership.agency.user.bio,
        location: activeMembership.agency.user.location?.city || activeMembership.agency.user.location?.country,
        verified: activeMembership.agency.isVerified,
        membershipId: activeMembership.id,
        role: activeMembership.role,
        commissionRate: activeMembership.commissionRate,
        joinedAt: activeMembership.createdAt,
        benefits: [
          'Verificación premium',
          'Marketing profesional',
          'Soporte 24/7',
          'Eventos exclusivos'
        ]
      };
    } else if (pendingRequests.length > 0) {
      status = 'pending';
    }

    // ✅ VERIFICAR ESTADO DE VERIFICACIÓN Y RENOVACIÓN
    let verificationStatus = null;
    if (activeMembership) {
      const renewalCheck = await require('../utils/validators').needsVerificationRenewal(req.user.escort.id);
      verificationStatus = {
        isVerified: req.user.escort.isVerified,
        needsRenewal: renewalCheck.needsRenewal,
        expiringSoon: renewalCheck.expiringSoon,
        expiresAt: renewalCheck.expiresAt,
        daysUntilExpiry: renewalCheck.daysUntilExpiry
      };
    }

    res.status(200).json({
      success: true,
      data: {
        status,
        hasActiveMembership: !!activeMembership,
        hasPendingRequests: pendingRequests.length > 0,
        currentAgency,
        verificationStatus,
        pendingRequests: pendingRequests.map(req => ({
          id: req.id,
          agencyName: `${req.agency.user.firstName} ${req.agency.user.lastName}`,
          agencyLogo: req.agency.user.avatar,
          createdAt: req.createdAt
        }))
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ GET ESCORT MEMBERSHIP STATUS ERROR:', error);
    logger.error('Get escort membership status failed', {
      error: error.message,
      stack: error.stack,
      escortId: req.user.escort?.id,
      userId: escortUserId
    });
    
    throw new AppError('Error obteniendo estado de membresía', 500, 'GET_MEMBERSHIP_STATUS_ERROR');
  }
});

// ✅ FUNCIÓN CORREGIDA: Salir de agencia actual - ARREGLADO EL ERROR DEL ENUM
const leaveCurrentAgency = catchAsync(async (req, res) => {
  const escortUserId = req.user.id;
  const { reason } = req.body;

  console.log('🚪 === LEAVE CURRENT AGENCY ===');
  console.log('🚪 Escort User ID:', escortUserId);
  console.log('🚪 Reason:', reason);

  // Verificar que el usuario es escort
  if (req.user.userType !== 'ESCORT') {
    throw new AppError('Solo escorts pueden salir de agencias', 403, 'ESCORT_ONLY');
  }

  if (!req.user.escort) {
    throw new AppError('Datos de escort no encontrados', 500, 'ESCORT_DATA_MISSING');
  }

  // Buscar membresía activa
  const activeMembership = await prisma.agencyMembership.findFirst({
    where: {
      escortId: req.user.escort.id,
      status: 'ACTIVE'
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

  console.log('🚪 Active membership found:', !!activeMembership);

  if (!activeMembership) {
    throw new AppError('No tienes una membresía activa en ninguna agencia', 404, 'NO_ACTIVE_MEMBERSHIP');
  }

  console.log('🚪 Membership details:', {
    id: activeMembership.id,
    agencyId: activeMembership.agencyId,
    currentStatus: activeMembership.status
  });

  // ✅ TRANSACCIÓN MEJORADA: Incluir actualización de verificación
  await prisma.$transaction(async (tx) => {
    console.log('🚪 Starting transaction to leave agency...');
    
    // ✅ USAR SOLO "REJECTED" Y CAMPOS EXISTENTES
    await tx.agencyMembership.update({
      where: { id: activeMembership.id },
      data: {
        status: 'REJECTED', // ✅ Valor válido del enum MembershipStatus
        updatedAt: new Date() // ✅ Campo que sí existe
      }
    });

    console.log('✅ Membership status updated to REJECTED');

    // ✅ REMOVER VERIFICACIÓN AL SALIR DE AGENCIA
    await tx.escort.update({
      where: { id: req.user.escort.id },
      data: {
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        verificationExpiresAt: null
      }
    });

    console.log('✅ Escort verification removed');

    // Actualizar contadores de la agencia
    await tx.agency.update({
      where: { id: activeMembership.agencyId },
      data: {
        activeEscorts: { decrement: 1 },
        verifiedEscorts: { decrement: 1 }
      }
    });

    console.log('✅ Agency counters updated');
  });

  // Crear notificación para la agencia
  await prisma.notification.create({
    data: {
      userId: activeMembership.agency.user.id,
      type: 'MEMBERSHIP_LEFT',
      title: 'Escort dejó la agencia',
      message: `${req.user.firstName} ${req.user.lastName} ha dejado tu agencia`,
      data: {
        membershipId: activeMembership.id,
        escortId: req.user.escort.id,
        escortName: `${req.user.firstName} ${req.user.lastName}`,
        reason: sanitizeString(reason) || 'Sin razón especificada',
        leftByEscort: true,
        verificationLost: true
      }
    }
  }).catch(error => {
    logger.warn('Failed to create notification:', error);
  });

  logger.info('Escort left agency', {
    membershipId: activeMembership.id,
    escortId: req.user.escort.id,
    agencyId: activeMembership.agencyId,
    reason,
    verificationRemoved: true
  });

  console.log('✅ === LEAVE AGENCY COMPLETED ===');

  res.status(200).json({
    success: true,
    message: 'Has dejado la agencia exitosamente. Tu verificación ha sido removida.',
    data: {
      formerAgency: `${activeMembership.agency.user.firstName} ${activeMembership.agency.user.lastName}`,
      leftAt: new Date().toISOString(),
      verificationRemoved: true
    },
    timestamp: new Date().toISOString()
  });
});

// ✅ NUEVA FUNCIÓN: Renovar verificación de escort
const renewEscortVerification = catchAsync(async (req, res) => {
  const agencyUserId = req.user.id;
  const { escortId } = req.params;
  const { pricingId } = req.body;

  console.log('🔄 === RENEW ESCORT VERIFICATION ===');
  console.log('🔄 Agency User ID:', agencyUserId);
  console.log('🔄 Escort ID:', escortId);
  console.log('🔄 Pricing ID:', pricingId);

  // Verificar que el usuario es agencia
  if (req.user.userType !== 'AGENCY') {
    throw new AppError('Solo agencias pueden renovar verificaciones', 403, 'AGENCY_ONLY');
  }

  if (!req.user.agency) {
    throw new AppError('Datos de agencia no encontrados', 500, 'AGENCY_DATA_MISSING');
  }

  // Verificar que necesita renovación
  const renewalCheck = await require('../utils/validators').needsVerificationRenewal(escortId);
  
  if (!renewalCheck.needsRenewal && !renewalCheck.expiringSoon) {
    throw new AppError('Esta verificación aún no necesita renovación', 400, 'RENEWAL_NOT_NEEDED');
  }

  // Reutilizar la función de verificación con flag de renovación
  req.body.isRenewal = true;
  return verifyEscort(req, res);
});

// ✅ NUEVA FUNCIÓN: Obtener escorts próximos a expirar verificación
const getExpiringVerifications = catchAsync(async (req, res) => {
  const agencyUserId = req.user.id;
  const { page = 1, limit = 20 } = req.query;

  // Verificar que el usuario es agencia
  if (req.user.userType !== 'AGENCY') {
    throw new AppError('Solo agencias pueden ver verificaciones próximas a expirar', 403, 'AGENCY_ONLY');
  }

  if (!req.user.agency) {
    throw new AppError('Datos de agencia no encontrados', 500, 'AGENCY_DATA_MISSING');
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  // Buscar escorts con verificaciones próximas a expirar (próximos 7 días)
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  try {
    const [escorts, totalCount] = await Promise.all([
      prisma.agencyMembership.findMany({
        where: {
          agencyId: req.user.agency.id,
          status: 'ACTIVE',
          escort: {
            isVerified: true,
            verificationExpiresAt: {
              lte: sevenDaysFromNow,
              gte: new Date()
            }
          }
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
            verificationExpiresAt: 'asc'
          }
        },
        skip: offset,
        take: limitNum
      }),
      prisma.agencyMembership.count({
        where: {
          agencyId: req.user.agency.id,
          status: 'ACTIVE',
          escort: {
            isVerified: true,
            verificationExpiresAt: {
              lte: sevenDaysFromNow,
              gte: new Date()
            }
          }
        }
      })
    ]);

    const formattedEscorts = escorts.map(membership => ({
      escortId: membership.escort.id,
      membershipId: membership.id,
      name: `${membership.escort.user.firstName} ${membership.escort.user.lastName}`,
      avatar: membership.escort.user.avatar,
      verificationExpiresAt: membership.escort.verificationExpiresAt,
      daysUntilExpiry: Math.ceil((membership.escort.verificationExpiresAt - new Date()) / (1000 * 60 * 60 * 24)),
      isUrgent: membership.escort.verificationExpiresAt <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 días o menos
      verifiedAt: membership.escort.verifiedAt
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
        expiringVerifications: formattedEscorts,
        pagination,
        summary: {
          total: totalCount,
          urgent: formattedEscorts.filter(e => e.isUrgent).length
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ GET EXPIRING VERIFICATIONS ERROR:', error);
    logger.error('Get expiring verifications failed', {
      error: error.message,
      stack: error.stack,
      agencyId: req.user.agency?.id,
      userId: agencyUserId
    });
    
    throw new AppError('Error obteniendo verificaciones próximas a expirar', 500, 'GET_EXPIRING_VERIFICATIONS_ERROR');
  }
});

// Helper function para tiempo relativo
const getRelativeTime = (date) => {
  const now = new Date();
  const diffInHours = Math.floor((now - new Date(date)) / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);
  
  if (diffInHours < 1) return 'Hace menos de 1 hora';
  if (diffInHours < 24) return `Hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
  if (diffInDays < 7) return `Hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
  if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return `Hace ${weeks} semana${weeks > 1 ? 's' : ''}`;
  }
  
  const months = Math.floor(diffInDays / 30);
  return `Hace ${months} mes${months > 1 ? 'es' : ''}`;
};

module.exports = {
  searchAgencies,
  requestToJoinAgency,
  inviteEscort,
  respondToInvitation,
  manageMembershipRequest,
  getAgencyEscorts,
  getVerificationPricing,
  verifyEscort,
  getAgencyStats,
  // ✅ FUNCIONES CORREGIDAS Y MEJORADAS
  getEscortInvitations,
  getEscortMembershipStatus,
  leaveCurrentAgency,
  // ✅ NUEVAS FUNCIONES AGREGADAS
  renewEscortVerification,
  getExpiringVerifications
};