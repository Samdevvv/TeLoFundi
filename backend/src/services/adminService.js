// src/services/adminService.js
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * Servicio para administración del sistema
 */
class AdminService {
  /**
   * Obtiene todas las solicitudes de agencia pendientes
   * @param {Object} options - Opciones de paginación y filtrado
   * @returns {Promise<Object>} - Solicitudes pendientes
   */
  async getPendingAgencyRequests(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        status = 'pendiente'
      } = options;

      const skip = (page - 1) * limit;

      // Obtener solicitudes de agencia en estado pendiente
      const requests = await prisma.agencyRequest.findMany({
        where: {
          status
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              createdAt: true,
              profileImageUrl: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc'
        }
      });

      const total = await prisma.agencyRequest.count({
        where: {
          status
        }
      });

      return {
        requests,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`Error al obtener solicitudes de agencia: ${error.message}`, { error });
      throw new Error('Error al obtener solicitudes de agencia pendientes');
    }
  }

  /**
   * Aprueba o rechaza una solicitud de agencia
   * @param {string} requestId - ID de la solicitud
   * @param {boolean} approved - Aprobada o rechazada
   * @param {string} adminId - ID del administrador
   * @param {string} notes - Notas adicionales
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async processAgencyRequest(requestId, approved, adminId, notes = '') {
    try {
      // Iniciar transacción
      const result = await prisma.$transaction(async (tx) => {
        // Buscar la solicitud
        const request = await tx.agencyRequest.findUnique({
          where: {
            id: requestId
          },
          include: {
            user: true
          }
        });

        if (!request) {
          throw new Error('Solicitud no encontrada');
        }

        if (request.status !== 'pendiente') {
          throw new Error('La solicitud ya ha sido procesada');
        }

        // Actualizar la solicitud
        const updatedRequest = await tx.agencyRequest.update({
          where: {
            id: requestId
          },
          data: {
            status: approved ? 'aprobada' : 'rechazada',
            processedAt: new Date(),
            processedById: adminId,
            notes
          }
        });

        if (approved) {
          // Actualizar el usuario para convertirlo en agencia
          await tx.user.update({
            where: {
              id: request.userId
            },
            data: {
              role: 'agencia'
            }
          });

          // Crear entrada en la tabla de agencias
          await tx.agency.upsert({
            where: {
              id: request.userId
            },
            update: {
              verificationStatus: 'verificado',
              verifiedAt: new Date(),
              verifiedBy: adminId
            },
            create: {
              id: request.userId,
              name: request.agencyName || request.user.username || 'Nueva Agencia',
              slug: this._generateSlug(request.agencyName || request.user.username || 'nueva-agencia'),
              description: request.description || '',
              verificationStatus: 'verificado',
              verifiedAt: new Date(),
              verifiedBy: adminId
            }
          });

          // Enviar notificación al usuario
          await tx.notification.create({
            data: {
              userId: request.userId,
              type: 'sistema',
              title: 'Solicitud de agencia aprobada',
              content: 'Tu solicitud para convertirte en agencia ha sido aprobada. ¡Bienvenido!',
              deepLink: '/agency/dashboard',
              importance: 'high',
              sendEmail: true,
              sendPush: true
            }
          });
        } else {
          // Enviar notificación de rechazo
          await tx.notification.create({
            data: {
              userId: request.userId,
              type: 'sistema',
              title: 'Solicitud de agencia rechazada',
              content: `Tu solicitud para convertirte en agencia ha sido rechazada. Motivo: ${notes || 'No se proporcionó motivo.'}`,
              importance: 'high',
              sendEmail: true,
              sendPush: true
            }
          });
        }

        // Registrar la acción en el log del sistema
        await tx.systemLog.create({
          data: {
            userId: adminId,
            action: approved ? 'aprobar_agencia' : 'rechazar_agencia',
            entityType: 'agencia',
            entityId: request.userId,
            details: {
              requestId,
              notes
            }
          }
        });

        return updatedRequest;
      });

      return result;
    } catch (error) {
      logger.error(`Error al procesar solicitud de agencia: ${error.message}`, { error });
      throw new Error(`Error al procesar solicitud de agencia: ${error.message}`);
    }
  }

  /**
   * Obtiene usuarios por tipo y criterios
   * @param {string} userType - Tipo de usuario (cliente, perfil, agencia, admin)
   * @param {Object} options - Opciones de paginación y filtrado
   * @returns {Promise<Object>} - Usuarios encontrados
   */
  async getUsers(userType, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        query,
        status,
        startDate,
        endDate
      } = options;

      const skip = (page - 1) * limit;

      // Construir filtros
      const where = {
        role: userType,
        ...(query && {
          OR: [
            { email: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query } }
          ]
        }),
        ...(status && { isActive: status === 'active' }),
        ...(startDate && {
          createdAt: {
            gte: new Date(startDate)
          }
        }),
        ...(endDate && {
          createdAt: {
            lte: new Date(endDate)
          }
        })
      };

      // Obtener usuarios según el tipo
      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          isVip: true,
          vipLevel: true,
          lastLogin: true,
          createdAt: true,
          profileImageUrl: true,
          ...(userType === 'cliente' && {
            client: {
              select: {
                username: true,
                totalPoints: true,
                vipUntil: true,
                totalContacts: true
              }
            }
          }),
          ...(userType === 'perfil' && {
            profile: {
              select: {
                displayName: true,
                slug: true,
                gender: true,
                verificationStatus: true,
                totalViews: true,
                totalContacts: true,
                isFeatured: true
              }
            }
          }),
          ...(userType === 'agencia' && {
            agency: {
              select: {
                name: true,
                slug: true,
                verificationStatus: true,
                totalProfiles: true,
                rating: true
              }
            }
          })
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc'
        }
      });

      const total = await prisma.user.count({ where });

      return {
        users,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`Error al obtener usuarios: ${error.message}`, { error });
      throw new Error(`Error al obtener usuarios: ${error.message}`);
    }
  }

  /**
   * Modifica el estado de un usuario (activar/desactivar)
   * @param {string} userId - ID del usuario
   * @param {boolean} isActive - Estado a establecer (activo/inactivo)
   * @param {string} adminId - ID del administrador
   * @param {string} reason - Razón del cambio
   * @returns {Promise<Object>} - Usuario actualizado
   */
  async toggleUserStatus(userId, isActive, adminId, reason = '') {
    try {
      // Iniciar transacción
      const result = await prisma.$transaction(async (tx) => {
        // Buscar el usuario
        const user = await tx.user.findUnique({
          where: {
            id: userId
          }
        });

        if (!user) {
          throw new Error('Usuario no encontrado');
        }

        // Actualizar estado del usuario
        const updatedUser = await tx.user.update({
          where: {
            id: userId
          },
          data: {
            isActive
          }
        });

        // Registrar la acción en el log del sistema
        await tx.systemLog.create({
          data: {
            userId: adminId,
            action: isActive ? 'activar_usuario' : 'desactivar_usuario',
            entityType: 'usuario',
            entityId: userId,
            details: {
              reason,
              prevStatus: user.isActive
            }
          }
        });

        // Si se está desactivando, cerrar todas las sesiones activas
        if (!isActive) {
          await tx.userSession.updateMany({
            where: {
              userId,
              isActive: true
            },
            data: {
              isActive: false
            }
          });
        }

        // Enviar notificación al usuario
        await tx.notification.create({
          data: {
            userId,
            type: 'sistema',
            title: isActive ? 'Tu cuenta ha sido activada' : 'Tu cuenta ha sido desactivada',
            content: isActive 
              ? 'Tu cuenta ha sido activada. Ya puedes iniciar sesión.' 
              : `Tu cuenta ha sido desactivada. Motivo: ${reason || 'No se proporcionó motivo.'}`,
            importance: 'high',
            sendEmail: true
          }
        });

        return updatedUser;
      });

      return result;
    } catch (error) {
      logger.error(`Error al cambiar estado de usuario: ${error.message}`, { error });
      throw new Error(`Error al cambiar estado de usuario: ${error.message}`);
    }
  }

  /**
   * Elimina un usuario y todos sus datos relacionados
   * @param {string} userId - ID del usuario
   * @param {string} adminId - ID del administrador
   * @param {string} reason - Razón de la eliminación
   * @returns {Promise<boolean>} - True si se eliminó correctamente
   */
  async deleteUser(userId, adminId, reason = '') {
    try {
      // Obtener información del usuario antes de eliminarlo
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          role: true
        }
      });

      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      // Crear un backup de la información del usuario
      await prisma.deletedUser.create({
        data: {
          originalId: userId,
          email: user.email,
          role: user.role,
          deletedBy: adminId,
          reason,
          deletedAt: new Date()
        }
      });

      // Registrar la acción en el log del sistema
      await prisma.systemLog.create({
        data: {
          userId: adminId,
          action: 'eliminar_usuario',
          entityType: 'usuario',
          entityId: userId,
          details: {
            reason,
            userEmail: user.email,
            userRole: user.role
          }
        }
      });

      // Eliminar el usuario
      await prisma.user.delete({
        where: {
          id: userId
        }
      });

      return true;
    } catch (error) {
      logger.error(`Error al eliminar usuario: ${error.message}`, { error });
      throw new Error(`Error al eliminar usuario: ${error.message}`);
    }
  }

  /**
   * Obtiene estadísticas generales del sistema
   * @returns {Promise<Object>} - Estadísticas generales
   */
  async getSystemStats() {
    try {
      // Contar usuarios por tipo
      const userStats = await prisma.user.groupBy({
        by: ['role'],
        _count: {
          id: true
        }
      });

      // Convertir a objeto más amigable
      const userCounts = {
        total: 0,
        clientes: 0,
        perfiles: 0,
        agencias: 0,
        admin: 0
      };

      userStats.forEach(stat => {
        userCounts[stat.role] = stat._count.id;
        userCounts.total += stat._count.id;
      });

      // Obtener transacciones recientes
      const recentPayments = await prisma.payment.findMany({
        where: {
          status: 'completado'
        },
        take: 10,
        orderBy: {
          completedAt: 'desc'
        },
        select: {
          id: true,
          userId: true,
          amount: true,
          currency: true,
          paymentType: true,
          status: true,
          completedAt: true
        }
      });

      // Ingresos totales
      const revenue = await prisma.payment.aggregate({
        where: {
          status: 'completado'
        },
        _sum: {
          amount: true
        }
      });

      // Estadísticas de perfiles y agencias
      const profileStats = await prisma.profile.aggregate({
        _count: {
          id: true
        },
        _avg: {
          totalViews: true,
          totalContacts: true
        }
      });

      const agencyStats = await prisma.agency.aggregate({
        _count: {
          id: true
        },
        _avg: {
          totalProfiles: true,
          rating: true
        }
      });

      // Usuarios nuevos por día (últimos 7 días)
      const last7Days = new Date();
      last7Days.setDate(last7Days.getDate() - 7);

      const newUsers = await prisma.user.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: {
            gte: last7Days
          }
        },
        _count: {
          id: true
        }
      });

      return {
        userCounts,
        profileStats: {
          total: profileStats._count.id,
          avgViews: profileStats._avg.totalViews || 0,
          avgContacts: profileStats._avg.totalContacts || 0
        },
        agencyStats: {
          total: agencyStats._count.id,
          avgProfiles: agencyStats._avg.totalProfiles || 0,
          avgRating: agencyStats._avg.rating || 0
        },
        financialStats: {
          totalRevenue: revenue._sum.amount || 0,
          recentPayments
        },
        newUsers
      };
    } catch (error) {
      logger.error(`Error al obtener estadísticas del sistema: ${error.message}`, { error });
      throw new Error(`Error al obtener estadísticas del sistema: ${error.message}`);
    }
  }

  /**
   * Verifica perfiles manualmente (como administrador)
   * @param {string} profileId - ID del perfil
   * @param {string} adminId - ID del administrador
   * @param {boolean} approved - Aprobado o rechazado
   * @param {Object} verificationData - Datos de verificación
   * @returns {Promise<Object>} - Perfil actualizado
   */
  async verifyProfileByAdmin(profileId, adminId, approved, verificationData = {}) {
    try {
      // Obtener el perfil
      const profile = await prisma.profile.findUnique({
        where: { id: profileId }
      });

      if (!profile) {
        throw new Error('Perfil no encontrado');
      }

      // Iniciar transacción
      const result = await prisma.$transaction(async (tx) => {
        // Actualizar el estado de verificación del perfil
        const updatedProfile = await tx.profile.update({
          where: {
            id: profileId
          },
          data: {
            verificationStatus: approved ? 'verificado' : 'rechazado',
            verifiedAt: approved ? new Date() : null,
            verifiedBy: approved ? adminId : null,
            verificationExpires: approved 
              ? new Date(Date.now() + (90 * 24 * 60 * 60 * 1000)) // 90 días
              : null
          }
        });

        // Crear registro de verificación
        await tx.profileVerification.create({
          data: {
            profileId,
            agencyId: adminId, // En este caso usamos el ID del admin como si fuera agencia
            status: approved ? 'verificado' : 'rechazado',
            verificationDate: new Date(),
            expiresAt: approved 
              ? new Date(Date.now() + (90 * 24 * 60 * 60 * 1000)) // 90 días
              : null,
            verifiedBy: adminId,
            verificationMethod: verificationData.method || 'admin_verification',
            notes: verificationData.notes || 'Verificación por administrador',
            documentUrls: verificationData.documentUrls || null,
            verificationPhotoUrl: verificationData.photoUrl || null
          }
        });

        // Registrar la acción
        await tx.systemLog.create({
          data: {
            userId: adminId,
            action: approved ? 'verificar_perfil' : 'rechazar_verificacion',
            entityType: 'perfil',
            entityId: profileId,
            details: {
              method: verificationData.method || 'admin_verification',
              notes: verificationData.notes
            }
          }
        });

        // Notificar al usuario
        await tx.notification.create({
          data: {
            userId: profileId,
            type: 'verificacion_completada',
            title: approved ? 'Perfil verificado' : 'Verificación rechazada',
            content: approved 
              ? '¡Tu perfil ha sido verificado correctamente!' 
              : `La verificación de tu perfil ha sido rechazada. Motivo: ${verificationData.notes || 'No se proporcionó motivo.'}`,
            importance: 'high',
            sendEmail: true,
            sendPush: true
          }
        });

        return updatedProfile;
      });

      return result;
    } catch (error) {
      logger.error(`Error al verificar perfil: ${error.message}`, { error });
      throw new Error(`Error al verificar perfil: ${error.message}`);
    }
  }

  /**
   * Genera un slug único a partir de un nombre
   * @param {string} name - Nombre para generar el slug
   * @returns {string} - Slug generado
   * @private
   */
  _generateSlug(name) {
    // Convertir a minúsculas y reemplazar espacios con guiones
    const baseSlug = name
      .toLowerCase()
      .normalize('NFD') // Normalizar acentos
      .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
      .replace(/[^a-z0-9]+/g, '-') // Reemplazar caracteres especiales con guiones
      .replace(/^-+|-+$/g, '') // Eliminar guiones al inicio y final
      .substring(0, 50); // Limitar longitud

    // Añadir timestamp para asegurar unicidad
    return `${baseSlug}-${Date.now().toString().substring(7)}`;
  }
}

module.exports = new AdminService();