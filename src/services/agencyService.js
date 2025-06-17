const { prisma } = require('../config/database');
const logger = require('../utils/logger');

// Obtener agencias disponibles para escorts
const getAvailableAgencies = async (escortId, filters = {}) => {
  try {
    const { page = 1, limit = 20, country, city, verified, search } = filters;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Verificar que el usuario sea escort
    const escort = await prisma.escort.findUnique({
      where: { userId: escortId },
      include: {
        agencyMemberships: {
          where: { status: { in: ['ACTIVE', 'PENDING'] } }
        }
      }
    });

    if (!escort) {
      throw new Error('Escort no encontrado');
    }

    // IDs de agencias donde ya está o tiene solicitud pendiente
    const excludeAgencyIds = escort.agencyMemberships.map(m => m.agencyId);

    const whereClause = {
      user: {
        isActive: true,
        isBanned: false,
        userType: 'AGENCY',
        ...(country && {
          location: {
            country: { contains: country, mode: 'insensitive' }
          }
        }),
        ...(city && {
          location: {
            city: { contains: city, mode: 'insensitive' }
          }
        }),
        ...(search && {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { bio: { contains: search, mode: 'insensitive' } },
            { website: { contains: search, mode: 'insensitive' } }
          ]
        })
      },
      ...(verified !== undefined && { isVerified: verified === 'true' }),
      ...(excludeAgencyIds.length > 0 && {
        id: { notIn: excludeAgencyIds }
      })
    };

    const [agencies, totalCount] = await Promise.all([
      prisma.agency.findMany({
        where: whereClause,
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
              profileViews: true,
              createdAt: true,
              location: {
                select: {
                  country: true,
                  city: true
                }
              },
              reputation: {
                select: {
                  overallScore: true,
                  trustScore: true
                }
              }
            }
          },
          memberships: {
            where: { status: 'ACTIVE' },
            include: {
              escort: {
                include: {
                  user: {
                    select: {
                      firstName: true,
                      avatar: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: [
          { isVerified: 'desc' },
          { totalEscorts: 'desc' },
          { user: { reputation: { overallScore: 'desc' } } }
        ],
        skip: offset,
        take: parseInt(limit)
      }),
      prisma.agency.count({ where: whereClause })
    ]);

    const formattedAgencies = agencies.map(agency => ({
      id: agency.id,
      userId: agency.user.id,
      name: `${agency.user.firstName} ${agency.user.lastName}`,
      avatar: agency.user.avatar,
      bio: agency.user.bio,
      website: agency.user.website,
      phone: agency.user.phone,
      isVerified: agency.isVerified,
      location: agency.user.location,
      stats: {
        totalEscorts: agency.totalEscorts,
        verifiedEscorts: agency.verifiedEscorts,
        activeEscorts: agency.activeEscorts,
        profileViews: agency.user.profileViews
      },
      reputation: agency.user.reputation,
      sampleEscorts: agency.memberships.slice(0, 3).map(m => ({
        name: m.escort.user.firstName,
        avatar: m.escort.user.avatar,
        isVerified: m.escort.isVerified
      })),
      createdAt: agency.user.createdAt
    }));

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalCount,
      pages: Math.ceil(totalCount / parseInt(limit)),
      hasNext: parseInt(page) * parseInt(limit) < totalCount,
      hasPrev: parseInt(page) > 1
    };

    return { agencies: formattedAgencies, pagination };
  } catch (error) {
    logger.error('Error getting available agencies:', error);
    throw error;
  }
};

// Enviar solicitud para unirse a agencia
const sendJoinRequest = async (escortId, agencyId, message = null) => {
  try {
    // Verificar que el escort existe
    const escort = await prisma.escort.findUnique({
      where: { userId: escortId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            avatar: true,
            email: true
          }
        },
        agencyMemberships: {
          where: {
            agencyId,
            status: { in: ['PENDING', 'ACTIVE'] }
          }
        }
      }
    });

    if (!escort) {
      throw new Error('Escort no encontrado');
    }

    // Verificar que la agencia existe
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            id: true
          }
        }
      }
    });

    if (!agency) {
      throw new Error('Agencia no encontrada');
    }

    // Verificar que no hay membresía existente
    if (escort.agencyMemberships.length > 0) {
      const existingMembership = escort.agencyMemberships[0];
      if (existingMembership.status === 'ACTIVE') {
        throw new Error('Ya eres miembro de esta agencia');
      }
      if (existingMembership.status === 'PENDING') {
        throw new Error('Ya tienes una solicitud pendiente con esta agencia');
      }
    }

    // Crear solicitud de membresía
    const membership = await prisma.agencyMembership.create({
      data: {
        escortId: escort.id,
        agencyId,
        status: 'PENDING',
        role: 'MEMBER'
      }
    });

    // Crear notificación para la agencia
    await prisma.notification.create({
      data: {
        userId: agency.user.id,
        type: 'MEMBERSHIP_REQUEST',
        title: 'Nueva solicitud de membresía',
        message: `${escort.user.firstName} ${escort.user.lastName} quiere unirse a tu agencia`,
        data: {
          membershipId: membership.id,
          escortId: escort.id,
          escortName: `${escort.user.firstName} ${escort.user.lastName}`,
          escortAvatar: escort.user.avatar,
          message: message || null
        }
      }
    });

    logger.info('Join request sent', {
      membershipId: membership.id,
      escortId,
      agencyId,
      escortName: `${escort.user.firstName} ${escort.user.lastName}`,
      agencyName: `${agency.user.firstName} ${agency.user.lastName}`
    });

    return {
      membershipId: membership.id,
      status: 'PENDING',
      agencyName: `${agency.user.firstName} ${agency.user.lastName}`,
      message: 'Solicitud enviada exitosamente'
    };
  } catch (error) {
    logger.error('Error sending join request:', error);
    throw error;
  }
};

// Obtener solicitudes pendientes de una agencia
const getAgencyJoinRequests = async (agencyUserId, filters = {}) => {
  try {
    const { page = 1, limit = 20, status = 'PENDING' } = filters;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Verificar que el usuario es agencia
    const agency = await prisma.agency.findUnique({
      where: { userId: agencyUserId }
    });

    if (!agency) {
      throw new Error('Agencia no encontrada');
    }

    const whereClause = {
      agencyId: agency.id,
      status: status.toUpperCase()
    };

    const [requests, totalCount] = await Promise.all([
      prisma.agencyMembership.findMany({
        where: whereClause,
        include: {
          escort: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                  bio: true,
                  phone: true,
                  email: true,
                  profileViews: true,
                  createdAt: true,
                  location: {
                    select: {
                      country: true,
                      city: true
                    }
                  },
                  reputation: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: parseInt(limit)
      }),
      prisma.agencyMembership.count({ where: whereClause })
    ]);

    const formattedRequests = requests.map(request => ({
      membershipId: request.id,
      status: request.status,
      role: request.role,
      escort: {
        id: request.escort.id,
        userId: request.escort.user.id,
        name: `${request.escort.user.firstName} ${request.escort.user.lastName}`,
        avatar: request.escort.user.avatar,
        bio: request.escort.user.bio,
        phone: request.escort.user.phone,
        email: request.escort.user.email,
        isVerified: request.escort.isVerified,
        rating: request.escort.rating,
        age: request.escort.age,
        services: request.escort.services,
        location: request.escort.user.location,
        reputation: request.escort.user.reputation,
        profileViews: request.escort.user.profileViews,
        createdAt: request.escort.user.createdAt
      },
      requestedAt: request.createdAt,
      approvedAt: request.approvedAt,
      approvedBy: request.approvedBy
    }));

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalCount,
      pages: Math.ceil(totalCount / parseInt(limit)),
      hasNext: parseInt(page) * parseInt(limit) < totalCount,
      hasPrev: parseInt(page) > 1
    };

    return { requests: formattedRequests, pagination };
  } catch (error) {
    logger.error('Error getting agency join requests:', error);
    throw error;
  }
};

// Responder a solicitud de membresía (aprobar/rechazar)
const respondToJoinRequest = async (agencyUserId, membershipId, decision, commissionRate = null) => {
  try {
    // Verificar que el usuario es agencia
    const agency = await prisma.agency.findUnique({
      where: { userId: agencyUserId }
    });

    if (!agency) {
      throw new Error('Agencia no encontrada');
    }

    // Buscar la membresía
    const membership = await prisma.agencyMembership.findFirst({
      where: {
        id: membershipId,
        agencyId: agency.id,
        status: 'PENDING'
      },
      include: {
        escort: {
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
        }
      }
    });

    if (!membership) {
      throw new Error('Solicitud de membresía no encontrada');
    }

    const isApproved = decision === 'APPROVED';
    const newStatus = isApproved ? 'ACTIVE' : 'REJECTED';

    // Actualizar membresía
    const updatedMembership = await prisma.agencyMembership.update({
      where: { id: membershipId },
      data: {
        status: newStatus,
        approvedBy: agencyUserId,
        approvedAt: new Date(),
        ...(isApproved && commissionRate && { commissionRate })
      }
    });

    if (isApproved) {
      // Incrementar contador de escorts en agencia
      await prisma.agency.update({
        where: { id: agency.id },
        data: {
          totalEscorts: { increment: 1 },
          activeEscorts: { increment: 1 }
        }
      });
    }

    // Crear notificación para el escort
    await prisma.notification.create({
      data: {
        userId: membership.escort.user.id,
        type: isApproved ? 'MEMBERSHIP_REQUEST' : 'MEMBERSHIP_REQUEST', // Cambiar cuando tengamos más tipos
        title: isApproved ? 'Solicitud aprobada' : 'Solicitud rechazada',
        message: isApproved 
          ? `Tu solicitud para unirte a la agencia ha sido aprobada`
          : `Tu solicitud para unirte a la agencia ha sido rechazada`,
        data: {
          membershipId: membership.id,
          agencyId: agency.id,
          status: newStatus,
          ...(isApproved && { commissionRate })
        }
      }
    });

    logger.info('Membership request responded', {
      membershipId,
      agencyId: agency.id,
      escortId: membership.escort.id,
      decision: newStatus,
      approvedBy: agencyUserId
    });

    return {
      membershipId,
      status: newStatus,
      escortName: `${membership.escort.user.firstName} ${membership.escort.user.lastName}`,
      message: isApproved ? 'Solicitud aprobada exitosamente' : 'Solicitud rechazada'
    };
  } catch (error) {
    logger.error('Error responding to join request:', error);
    throw error;
  }
};

// Obtener escorts de una agencia
const getAgencyEscorts = async (agencyUserId, filters = {}) => {
  try {
    const { page = 1, limit = 20, status = 'ACTIVE', verified, search } = filters;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Verificar que el usuario es agencia
    const agency = await prisma.agency.findUnique({
      where: { userId: agencyUserId }
    });

    if (!agency) {
      throw new Error('Agencia no encontrada');
    }

    const whereClause = {
      agencyId: agency.id,
      status: status.toUpperCase(),
      ...(verified !== undefined && {
        escort: { isVerified: verified === 'true' }
      }),
      ...(search && {
        escort: {
          user: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { bio: { contains: search, mode: 'insensitive' } }
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
                  firstName: true,
                  lastName: true,
                  avatar: true,
                  bio: true,
                  phone: true,
                  email: true,
                  profileViews: true,
                  lastActiveAt: true,
                  createdAt: true,
                  location: {
                    select: {
                      country: true,
                      city: true
                    }
                  },
                  reputation: true
                }
              },
              posts: {
                where: { isActive: true },
                take: 3,
                orderBy: { createdAt: 'desc' },
                select: {
                  id: true,
                  title: true,
                  images: true,
                  views: true,
                  createdAt: true
                }
              }
            }
          }
        },
        orderBy: [
          { escort: { isVerified: 'desc' } },
          { escort: { rating: 'desc' } },
          { createdAt: 'desc' }
        ],
        skip: offset,
        take: parseInt(limit)
      }),
      prisma.agencyMembership.count({ where: whereClause })
    ]);

    const formattedEscorts = memberships.map(membership => ({
      membershipId: membership.id,
      membershipStatus: membership.status,
      role: membership.role,
      commissionRate: membership.commissionRate,
      joinedAt: membership.createdAt,
      permissions: {
        canPostForAgency: membership.canPostForAgency,
        canManageEscorts: membership.canManageEscorts,
        canAccessFinances: membership.canAccessFinances
      },
      escort: {
        id: membership.escort.id,
        userId: membership.escort.user.id,
        name: `${membership.escort.user.firstName} ${membership.escort.user.lastName}`,
        avatar: membership.escort.user.avatar,
        bio: membership.escort.user.bio,
        phone: membership.escort.user.phone,
        email: membership.escort.user.email,
        isVerified: membership.escort.isVerified,
        rating: membership.escort.rating,
        totalRatings: membership.escort.totalRatings,
        age: membership.escort.age,
        services: membership.escort.services,
        location: membership.escort.user.location,
        reputation: membership.escort.user.reputation,
        profileViews: membership.escort.user.profileViews,
        lastActiveAt: membership.escort.user.lastActiveAt,
        stats: {
          totalBookings: membership.escort.totalBookings,
          completedBookings: membership.escort.completedBookings,
          currentPosts: membership.escort.currentPosts
        },
        recentPosts: membership.escort.posts,
        createdAt: membership.escort.user.createdAt
      }
    }));

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalCount,
      pages: Math.ceil(totalCount / parseInt(limit)),
      hasNext: parseInt(page) * parseInt(limit) < totalCount,
      hasPrev: parseInt(page) > 1
    };

    return { escorts: formattedEscorts, pagination };
  } catch (error) {
    logger.error('Error getting agency escorts:', error);
    throw error;
  }
};

// Gestionar escort de agencia (cambiar role, permisos, etc.)
const manageAgencyEscort = async (agencyUserId, membershipId, updates) => {
  try {
    const { role, commissionRate, permissions = {} } = updates;

    // Verificar que el usuario es agencia
    const agency = await prisma.agency.findUnique({
      where: { userId: agencyUserId }
    });

    if (!agency) {
      throw new Error('Agencia no encontrada');
    }

    // Buscar la membresía
    const membership = await prisma.agencyMembership.findFirst({
      where: {
        id: membershipId,
        agencyId: agency.id,
        status: 'ACTIVE'
      },
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
    });

    if (!membership) {
      throw new Error('Membresía activa no encontrada');
    }

    // Preparar datos de actualización
    const updateData = {};
    
    if (role && ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'].includes(role)) {
      updateData.role = role;
    }
    
    if (commissionRate !== undefined && commissionRate >= 0 && commissionRate <= 1) {
      updateData.commissionRate = commissionRate;
    }

    if (permissions.canPostForAgency !== undefined) {
      updateData.canPostForAgency = permissions.canPostForAgency;
    }
    
    if (permissions.canManageEscorts !== undefined) {
      updateData.canManageEscorts = permissions.canManageEscorts;
    }
    
    if (permissions.canAccessFinances !== undefined) {
      updateData.canAccessFinances = permissions.canAccessFinances;
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('No hay cambios válidos para actualizar');
    }

    // Actualizar membresía
    const updatedMembership = await prisma.agencyMembership.update({
      where: { id: membershipId },
      data: updateData
    });

    logger.info('Agency escort managed', {
      membershipId,
      agencyId: agency.id,
      escortId: membership.escort.id,
      updates: updateData,
      managedBy: agencyUserId
    });

    return {
      membershipId,
      escortName: `${membership.escort.user.firstName} ${membership.escort.user.lastName}`,
      updates: updateData,
      message: 'Escort actualizado exitosamente'
    };
  } catch (error) {
    logger.error('Error managing agency escort:', error);
    throw error;
  }
};

// Remover escort de agencia
const removeEscortFromAgency = async (agencyUserId, membershipId) => {
  try {
    // Verificar que el usuario es agencia
    const agency = await prisma.agency.findUnique({
      where: { userId: agencyUserId }
    });

    if (!agency) {
      throw new Error('Agencia no encontrada');
    }

    // Buscar la membresía
    const membership = await prisma.agencyMembership.findFirst({
      where: {
        id: membershipId,
        agencyId: agency.id,
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
      throw new Error('Membresía activa no encontrada');
    }

    // Soft delete de la membresía
    await prisma.agencyMembership.update({
      where: { id: membershipId },
      data: {
        status: 'INACTIVE',
        deletedAt: new Date()
      }
    });

    // Decrementar contador de escorts
    await prisma.agency.update({
      where: { id: agency.id },
      data: {
        totalEscorts: { decrement: 1 },
        activeEscorts: { decrement: 1 }
      }
    });

    // Crear notificación para el escort
    await prisma.notification.create({
      data: {
        userId: membership.escort.user.id,
        type: 'MEMBERSHIP_REQUEST', // Cambiar cuando tengamos tipo específico
        title: 'Removido de agencia',
        message: `Has sido removido de la agencia`,
        data: {
          membershipId: membership.id,
          agencyId: agency.id,
          removedBy: agencyUserId
        }
      }
    });

    logger.info('Escort removed from agency', {
      membershipId,
      agencyId: agency.id,
      escortId: membership.escort.id,
      removedBy: agencyUserId
    });

    return {
      membershipId,
      escortName: `${membership.escort.user.firstName} ${membership.escort.user.lastName}`,
      message: 'Escort removido de la agencia exitosamente'
    };
  } catch (error) {
    logger.error('Error removing escort from agency:', error);
    throw error;
  }
};

// Invitar escort a agencia
const inviteEscortToAgency = async (agencyUserId, escortUserId, invitationData = {}) => {
  try {
    const { message, proposedCommission = 0.1, proposedRole = 'MEMBER', proposedBenefits = {} } = invitationData;

    // Verificar que el usuario es agencia
    const agency = await prisma.agency.findUnique({
      where: { userId: agencyUserId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!agency) {
      throw new Error('Agencia no encontrada');
    }

    // Verificar que el objetivo es escort
    const escort = await prisma.escort.findUnique({
      where: { userId: escortUserId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        agencyMemberships: {
          where: {
            agencyId: agency.id,
            status: { in: ['ACTIVE', 'PENDING'] }
          }
        }
      }
    });

    if (!escort) {
      throw new Error('Escort no encontrado');
    }

    // Verificar que no hay membresía o invitación existente
    if (escort.agencyMemberships.length > 0) {
      const existingMembership = escort.agencyMemberships[0];
      if (existingMembership.status === 'ACTIVE') {
        throw new Error('Este escort ya es miembro de tu agencia');
      }
      if (existingMembership.status === 'PENDING') {
        throw new Error('Ya hay una solicitud pendiente con este escort');
      }
    }

    // Verificar invitaciones existentes
    const existingInvitation = await prisma.agencyInvitation.findFirst({
      where: {
        agencyId: agency.id,
        escortId: escort.id,
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      }
    });

    if (existingInvitation) {
      throw new Error('Ya hay una invitación pendiente para este escort');
    }

    // Crear invitación
    const invitation = await prisma.agencyInvitation.create({
      data: {
        agencyId: agency.id,
        escortId: escort.id,
        message,
        proposedCommission,
        proposedRole,
        proposedBenefits,
        invitedBy: agencyUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
      }
    });

    // Crear notificación para el escort
    await prisma.notification.create({
      data: {
        userId: escortUserId,
        type: 'AGENCY_INVITE',
        title: 'Invitación de agencia',
        message: `${agency.user.firstName} ${agency.user.lastName} te ha invitado a unirte a su agencia`,
        data: {
          invitationId: invitation.id,
          agencyId: agency.id,
          agencyName: `${agency.user.firstName} ${agency.user.lastName}`,
          proposedCommission,
          proposedRole,
          message: message || null,
          expiresAt: invitation.expiresAt.toISOString()
        }
      }
    });

    logger.info('Escort invited to agency', {
      invitationId: invitation.id,
      agencyId: agency.id,
      escortId: escort.id,
      invitedBy: agencyUserId,
      proposedCommission,
      proposedRole
    });

    return {
      invitationId: invitation.id,
      escortName: `${escort.user.firstName} ${escort.user.lastName}`,
      agencyName: `${agency.user.firstName} ${agency.user.lastName}`,
      proposedCommission,
      proposedRole,
      expiresAt: invitation.expiresAt,
      message: 'Invitación enviada exitosamente'
    };
  } catch (error) {
    logger.error('Error inviting escort to agency:', error);
    throw error;
  }
};

// Responder a invitación de agencia (desde el escort)
const respondToAgencyInvitation = async (escortUserId, invitationId, response) => {
  try {
    // Verificar que el usuario es escort
    const escort = await prisma.escort.findUnique({
      where: { userId: escortUserId }
    });

    if (!escort) {
      throw new Error('Escort no encontrado');
    }

    // Buscar la invitación
    const invitation = await prisma.agencyInvitation.findFirst({
      where: {
        id: invitationId,
        escortId: escort.id,
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
      throw new Error('Invitación no encontrada o expirada');
    }

    const isAccepted = response === 'ACCEPTED';
    const newStatus = isAccepted ? 'ACCEPTED' : 'REJECTED';

    // Actualizar invitación
    await prisma.agencyInvitation.update({
      where: { id: invitationId },
      data: {
        status: newStatus,
        respondedAt: new Date()
      }
    });

    if (isAccepted) {
      // Crear membresía activa
      await prisma.agencyMembership.create({
        data: {
          escortId: escort.id,
          agencyId: invitation.agencyId,
          status: 'ACTIVE',
          role: invitation.proposedRole,
          commissionRate: invitation.proposedCommission,
          approvedBy: invitation.invitedBy,
          approvedAt: new Date()
        }
      });

      // Incrementar contador de escorts en agencia
      await prisma.agency.update({
        where: { id: invitation.agencyId },
        data: {
          totalEscorts: { increment: 1 },
          activeEscorts: { increment: 1 }
        }
      });
    }

    // Crear notificación para la agencia
    await prisma.notification.create({
      data: {
        userId: invitation.agency.user.id,
        type: 'AGENCY_INVITE',
        title: isAccepted ? 'Invitación aceptada' : 'Invitación rechazada',
        message: isAccepted 
          ? `Tu invitación ha sido aceptada`
          : `Tu invitación ha sido rechazada`,
        data: {
          invitationId: invitation.id,
          escortId: escort.id,
          status: newStatus,
          ...(isAccepted && {
            commissionRate: invitation.proposedCommission,
            role: invitation.proposedRole
          })
        }
      }
    });

    logger.info('Agency invitation responded', {
      invitationId,
      escortId: escort.id,
      agencyId: invitation.agencyId,
      response: newStatus
    });

    return {
      invitationId,
      status: newStatus,
      agencyName: `${invitation.agency.user.firstName} ${invitation.agency.user.lastName}`,
      message: isAccepted ? 'Te has unido a la agencia exitosamente' : 'Invitación rechazada'
    };
  } catch (error) {
    logger.error('Error responding to agency invitation:', error);
    throw error;
  }
};

// Obtener estadísticas de una agencia
const getAgencyStats = async (agencyUserId, timeframe = '30d') => {
  try {
    // Verificar que el usuario es agencia
    const agency = await prisma.agency.findUnique({
      where: { userId: agencyUserId },
      include: {
        user: {
          include: {
            reputation: true
          }
        }
      }
    });

    if (!agency) {
      throw new Error('Agencia no encontrada');
    }

    // Calcular rango de fechas
    const now = new Date();
    const daysAgo = parseInt(timeframe.replace('d', ''));
    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    const [
      totalEscorts,
      activeEscorts,
      verifiedEscorts,
      recentJoinRequests,
      totalPosts,
      totalViews,
      totalVerifications,
      topEscorts
    ] = await Promise.all([
      // Total escorts
      prisma.agencyMembership.count({
        where: {
          agencyId: agency.id,
          status: { in: ['ACTIVE', 'PENDING'] }
        }
      }),
      
      // Escorts activos
      prisma.agencyMembership.count({
        where: {
          agencyId: agency.id,
          status: 'ACTIVE'
        }
      }),
      
      // Escorts verificados
      prisma.agencyMembership.count({
        where: {
          agencyId: agency.id,
          status: 'ACTIVE',
          escort: { isVerified: true }
        }
      }),
      
      // Solicitudes recientes
      prisma.agencyMembership.count({
        where: {
          agencyId: agency.id,
          status: 'PENDING',
          createdAt: { gte: startDate }
        }
      }),
      
      // Total posts de escorts de la agencia
      prisma.post.count({
        where: {
          author: {
            escort: {
              agencyMemberships: {
                some: {
                  agencyId: agency.id,
                  status: 'ACTIVE'
                }
              }
            }
          },
          isActive: true
        }
      }),
      
      // Total vistas de posts
      prisma.post.aggregate({
        where: {
          author: {
            escort: {
              agencyMemberships: {
                some: {
                  agencyId: agency.id,
                  status: 'ACTIVE'
                }
              }
            }
          },
          isActive: true
        },
        _sum: { views: true }
      }),
      
      // Total verificaciones realizadas
      prisma.escortVerification.count({
        where: {
          agencyId: agency.id,
          status: 'COMPLETED'
        }
      }),
      
      // Top escorts por performance
      prisma.agencyMembership.findMany({
        where: {
          agencyId: agency.id,
          status: 'ACTIVE'
        },
        include: {
          escort: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                  reputation: true
                }
              },
              posts: {
                where: { isActive: true },
                select: {
                  views: true,
                  likes: true
                }
              }
            }
          }
        },
        take: 5
      })
    ]);

    // Procesar top escorts
    const processedTopEscorts = topEscorts.map(membership => {
      const totalPostViews = membership.escort.posts.reduce((sum, post) => sum + post.views, 0);
      const totalPostLikes = membership.escort.posts.reduce((sum, post) => sum + post.likes.length, 0);
      
      return {
        escortId: membership.escort.id,
        name: `${membership.escort.user.firstName} ${membership.escort.user.lastName}`,
        avatar: membership.escort.user.avatar,
        isVerified: membership.escort.isVerified,
        rating: membership.escort.rating,
        totalViews: totalPostViews,
        totalLikes: totalPostLikes,
        postsCount: membership.escort.posts.length,
        reputationScore: membership.escort.user.reputation?.overallScore || 0
      };
    }).sort((a, b) => b.totalViews - a.totalViews);

    const stats = {
      overview: {
        totalEscorts: agency.totalEscorts,
        activeEscorts,
        verifiedEscorts,
        verificationRate: activeEscorts > 0 ? (verifiedEscorts / activeEscorts * 100).toFixed(2) : 0,
        totalVerifications: agency.totalVerifications,
        recentJoinRequests
      },
      content: {
        totalPosts,
        totalViews: totalViews._sum.views || 0,
        averageViewsPerPost: totalPosts > 0 ? Math.round((totalViews._sum.views || 0) / totalPosts) : 0
      },
      performance: {
        agencyReputation: agency.user.reputation?.overallScore || 0,
        trustScore: agency.user.reputation?.trustScore || 0,
        profileViews: agency.user.profileViews
      },
      topEscorts: processedTopEscorts,
      timeframe,
      generatedAt: new Date().toISOString()
    };

    return stats;
  } catch (error) {
    logger.error('Error getting agency stats:', error);
    throw error;
  }
};

module.exports = {
  getAvailableAgencies,
  sendJoinRequest,
  getAgencyJoinRequests,
  respondToJoinRequest,
  getAgencyEscorts,
  manageAgencyEscort,
  removeEscortFromAgency,
  inviteEscortToAgency,
  respondToAgencyInvitation,
  getAgencyStats
};