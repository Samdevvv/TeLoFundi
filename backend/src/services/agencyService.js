// src/services/agencyService.js
const { PrismaClient } = require("@prisma/client");
const logger = require("../utils/logger");
const slugify = require("slugify");
const crypto = require("crypto");

const prisma = new PrismaClient();

class AgencyService {
  /**
   * Obtiene una agencia por su ID
   * @param {string} agencyId - ID de la agencia
   * @param {boolean} includeProfiles - Incluir perfiles asociados
   * @returns {Promise<Object>} - Agencia encontrada
   */
  async getAgencyById(agencyId, includeProfiles = false) {
    try {
      const select = {
        id: true,
        name: true,
        slug: true,
        description: true,
        shortDescription: true,
        website: true,
        address: true,
        city: true,
        stateProvince: true,
        country: true,
        postalCode: true,
        verificationStatus: true,
        verifiedAt: true,
        logoUrl: true,
        coverImageUrl: true,
        galleryImages: true,
        socialMedia: true,
        businessHours: true,
        commissionRate: true,
        subscriptionTier: true,
        subscriptionExpires: true,
        paymentMethods: true,
        contactPhone: true,
        contactEmail: true,
        contactWhatsapp: true,
        totalProfiles: true,
        activeProfiles: true,
        verifiedProfiles: true,
        rating: true,
        totalRatings: true,
        featuredUntil: true,
        establishmentYear: true,
        isExclusive: true,
        user: {
          select: {
            id: true,
            lastLogin: true,
            createdAt: true,
          },
        },
      };

      // Incluir perfiles si se solicita
      if (includeProfiles) {
        select.profiles = {
          where: {
            isActive: true,
            hidden: false,
          },
          select: {
            id: true,
            displayName: true,
            slug: true,
            gender: true,
            age: true,
            shortDescription: true,
            verificationStatus: true,
            nationality: true,
            location: true,
            priceHour: true,
            currency: true,
            availabilityStatus: true,
            isFeatured: true,
            user: {
              select: {
                profileImageUrl: true,
              },
            },
            profileImages: {
              where: {
                isApproved: true,
                isPublic: true,
                isMain: true,
              },
              select: {
                thumbnailUrl: true,
                blurHash: true,
              },
              take: 1,
            },
          },
          orderBy: [
            { isFeatured: "desc" },
            { verificationStatus: "asc" }, // 'verificado' viene antes alfabéticamente
            { lastActivity: "desc" },
          ],
          take: 100, // Limitar a 100 perfiles por carga
        };
      }

      const agency = await prisma.agency.findUnique({
        where: { id: agencyId },
        select,
      });

      if (!agency) {
        throw new Error("Agencia no encontrada");
      }

      return agency;
    } catch (error) {
      logger.error(`Error al obtener agencia: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Obtiene una agencia por su slug
   * @param {string} slug - Slug de la agencia
   * @param {boolean} includeProfiles - Incluir perfiles asociados
   * @returns {Promise<Object>} - Agencia encontrada
   */
  async getAgencyBySlug(slug, includeProfiles = false) {
    try {
      const agency = await prisma.agency.findUnique({
        where: { slug },
        select: {
          id: true,
        },
      });

      if (!agency) {
        throw new Error("Agencia no encontrada");
      }

      return this.getAgencyById(agency.id, includeProfiles);
    } catch (error) {
      logger.error(`Error al obtener agencia por slug: ${error.message}`, {
        error,
      });
      throw error;
    }
  }

  /**
   * Actualiza una agencia
   * @param {string} agencyId - ID de la agencia
   * @param {Object} agencyData - Datos a actualizar
   * @returns {Promise<Object>} - Agencia actualizada
   */
  async updateAgency(agencyId, agencyData) {
    try {
      // Si se cambia el nombre, generar nuevo slug
      if (agencyData.name) {
        agencyData.slug = this.generateSlug(agencyData.name);
      }

      const updatedAgency = await prisma.agency.update({
        where: { id: agencyId },
        data: agencyData,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          shortDescription: true,
        },
      });

      return updatedAgency;
    } catch (error) {
      logger.error(`Error al actualizar agencia: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Obtiene los perfiles de una agencia
   * @param {string} agencyId - ID de la agencia
   * @param {Object} options - Opciones de filtrado y paginación
   * @returns {Promise<Object>} - Perfiles encontrados
   */
  async getAgencyProfiles(agencyId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        gender,
        minAge,
        maxAge,
        services,
        verificationStatus,
        availabilityStatus,
        orderBy = "featured", // 'featured', 'recent', 'price_asc', 'price_desc'
      } = options;

      const skip = (page - 1) * limit;

      // Construir condiciones de filtrado
      const where = {
        agencyId,
        isActive: true,
        hidden: false,
      };

      if (gender) {
        where.gender = gender;
      }

      if (minAge) {
        where.age = {
          ...where.age,
          gte: parseInt(minAge),
        };
      }

      if (maxAge) {
        where.age = {
          ...where.age,
          lte: parseInt(maxAge),
        };
      }

      if (verificationStatus) {
        where.verificationStatus = verificationStatus;
      }

      if (availabilityStatus) {
        where.availabilityStatus = availabilityStatus;
      }

      if (services && Array.isArray(services) && services.length > 0) {
        // Filtrar por servicios es más complejo en JSONB
        // Esto es una simplificación, puede necesitar ajustes según la estructura
        where.services = {
          path: services.map((service) => `$.${service}`),
          equals: true,
        };
      }

      // Determinar ordenamiento
      let orderByClause;
      switch (orderBy) {
        case "recent":
          orderByClause = { lastActivity: "desc" };
          break;
        case "price_asc":
          orderByClause = { priceHour: "asc" };
          break;
        case "price_desc":
          orderByClause = { priceHour: "desc" };
          break;
        case "featured":
        default:
          orderByClause = [
            { isFeatured: "desc" },
            { verificationStatus: "asc" },
            { lastActivity: "desc" },
          ];
      }

      // Consultar perfiles
      const profiles = await prisma.profile.findMany({
        where,
        select: {
          id: true,
          displayName: true,
          slug: true,
          gender: true,
          age: true,
          shortDescription: true,
          verificationStatus: true,
          nationality: true,
          location: true,
          priceHour: true,
          currency: true,
          availabilityStatus: true,
          isFeatured: true,
          lastActivity: true,
          user: {
            select: {
              profileImageUrl: true,
            },
          },
          profileImages: {
            where: {
              isApproved: true,
              isPublic: true,
              isMain: true,
            },
            select: {
              thumbnailUrl: true,
              blurHash: true,
            },
            take: 1,
          },
        },
        orderBy: orderByClause,
        skip,
        take: limit,
      });

      // Contar total de perfiles que cumplen los filtros
      const total = await prisma.profile.count({ where });

      return {
        profiles,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error(`Error al obtener perfiles de agencia: ${error.message}`, {
        error,
      });
      throw error;
    }
  }

  /**
   * Aprueba o rechaza la verificación de un perfil
   * @param {string} agencyId - ID de la agencia
   * @param {string} profileId - ID del perfil
   * @param {boolean} approved - true para aprobar, false para rechazar
   * @param {Object} verificationData - Datos adicionales de verificación
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async verifyProfile(agencyId, profileId, approved, verificationData = {}) {
    try {
      // Verificar que el perfil pertenezca a la agencia
      const profile = await prisma.profile.findFirst({
        where: {
          id: profileId,
          agencyId,
        },
      });

      if (!profile) {
        throw new Error("El perfil no pertenece a esta agencia");
      }

      // Obtener configuración del sistema para días de expiración
      const systemSettings = await prisma.systemSetting.findFirst();
      const expirationDays =
        systemSettings?.autoVerificationExpirationDays || 90;

      // Fecha de expiración
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

      // Actualizar estado de verificación
      const verificationStatus = approved ? "verificado" : "rechazado";

      // Crear registro de verificación
      const verification = await prisma.profileVerification.create({
        data: {
          profileId,
          agencyId,
          status: verificationStatus,
          verificationDate: new Date(),
          expiresAt: approved ? expiresAt : null,
          verifiedBy: verificationData.verifiedBy || agencyId,
          verificationMethod: verificationData.method || "document",
          verificationLocation: verificationData.location,
          notes: verificationData.notes,
          documentUrls: verificationData.documentUrls,
          verificationPhotoUrl: verificationData.photoUrl,
        },
      });

      // Actualizar perfil
      await prisma.profile.update({
        where: { id: profileId },
        data: {
          verificationStatus,
          verifiedAt: approved ? new Date() : null,
          verifiedBy: approved ? agencyId : null,
          verificationExpires: approved ? expiresAt : null,
        },
      });

      // Incrementar contador de perfiles verificados si se aprueba
      if (approved) {
        await prisma.agency.update({
          where: { id: agencyId },
          data: {
            verifiedProfiles: {
              increment: 1,
            },
          },
        });
      }

      // Crear notificación para el perfil
      await prisma.notification.create({
        data: {
          userId: profileId,
          type: "verificacion_completada",
          title: approved ? "Verificación Aprobada" : "Verificación Rechazada",
          content: approved
            ? "Tu perfil ha sido verificado exitosamente por tu agencia"
            : `Tu verificación ha sido rechazada. Motivo: ${
                verificationData.notes || "No especificado"
              }`,
          reference_id: verification.id,
          reference_type: "verification",
          send_email: true,
          send_push: true,
        },
      });

      return {
        success: true,
        verificationId: verification.id,
        status: verificationStatus,
      };
    } catch (error) {
      logger.error(`Error al verificar perfil: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Añade un perfil existente a una agencia
   * @param {string} agencyId - ID de la agencia
   * @param {string} profileId - ID del perfil
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async addProfileToAgency(agencyId, profileId) {
    try {
      // Verificar que el perfil exista y no tenga agencia
      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        select: {
          id: true,
          agencyId: true,
          isIndependent: true,
        },
      });

      if (!profile) {
        throw new Error("Perfil no encontrado");
      }

      if (profile.agencyId) {
        throw new Error("El perfil ya pertenece a una agencia");
      }

      if (!profile.isIndependent) {
        throw new Error("El perfil no está marcado como independiente");
      }

      // Crear solicitud de cambio de agencia
      await prisma.agencyChange.create({
        data: {
          profileId,
          previousAgencyId: null,
          newAgencyId: agencyId,
          requestedBy: agencyId,
          status: "pendiente",
        },
      });

      // No actualizamos directamente el perfil, esperamos a que acepte la solicitud

      return {
        success: true,
        message: "Solicitud enviada al perfil",
      };
    } catch (error) {
      logger.error(`Error al añadir perfil a agencia: ${error.message}`, {
        error,
      });
      throw error;
    }
  }

  /**
   * Responde a una solicitud de cambio de agencia
   * @param {string} profileId - ID del perfil
   * @param {string} requestId - ID de la solicitud
   * @param {boolean} accept - true para aceptar, false para rechazar
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async respondToAgencyRequest(profileId, requestId, accept) {
    try {
      // Verificar que la solicitud exista y sea para este perfil
      const request = await prisma.agencyChange.findFirst({
        where: {
          id: requestId,
          profileId,
          status: "pendiente",
        },
      });

      if (!request) {
        throw new Error("Solicitud no encontrada o ya procesada");
      }

      // Actualizar estado de la solicitud
      const status = accept ? "aprobado" : "rechazado";
      await prisma.agencyChange.update({
        where: { id: requestId },
        data: {
          status,
          approvedBy: accept ? profileId : null,
        },
      });

      // Si se acepta, actualizar perfil
      if (accept) {
        await prisma.profile.update({
          where: { id: profileId },
          data: {
            agencyId: request.newAgencyId,
            isIndependent: false,
            // Resetear verificación
            verificationStatus: "no_verificado",
            verifiedAt: null,
            verifiedBy: null,
            verificationExpires: null,
          },
        });
      }

      return {
        success: true,
        status,
        agencyId: accept ? request.newAgencyId : null,
      };
    } catch (error) {
      logger.error(`Error al responder solicitud: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Elimina un perfil de una agencia
   * @param {string} agencyId - ID de la agencia
   * @param {string} profileId - ID del perfil
   * @param {string} reason - Motivo de la eliminación
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async removeProfileFromAgency(agencyId, profileId, reason) {
    try {
      // Verificar que el perfil pertenezca a la agencia
      const profile = await prisma.profile.findFirst({
        where: {
          id: profileId,
          agencyId,
        },
      });

      if (!profile) {
        throw new Error("El perfil no pertenece a esta agencia");
      }

      // Registrar el cambio
      await prisma.agencyChange.create({
        data: {
          profileId,
          previousAgencyId: agencyId,
          newAgencyId: null,
          requestedBy: agencyId,
          status: "aprobado",
          reason,
        },
      });

      // Actualizar perfil
      await prisma.profile.update({
        where: { id: profileId },
        data: {
          agencyId: null,
          isIndependent: true,
          // Resetear verificación
          verificationStatus: "no_verificado",
          verifiedAt: null,
          verifiedBy: null,
          verificationExpires: null,
        },
      });

      // Crear notificación para el perfil
      await prisma.notification.create({
        data: {
          userId: profileId,
          type: "sistema",
          title: "Removido de agencia",
          content: `Has sido removido de la agencia. Motivo: ${
            reason || "No especificado"
          }`,
          send_email: true,
        },
      });

      return {
        success: true,
        message: "Perfil removido de la agencia exitosamente",
      };
    } catch (error) {
      logger.error(`Error al remover perfil: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Genera un slug a partir de un texto
   * @param {string} text - Texto para generar el slug
   * @returns {string} - Slug generado
   */
  generateSlug(text) {
    // Generar slug base
    let slug = slugify(text, {
      lower: true,
      strict: true,
      trim: true,
    });

    // Añadir sufijo aleatorio para evitar duplicados
    const randomSuffix = crypto.randomBytes(3).toString("hex");
    slug = `${slug}-${randomSuffix}`;

    return slug;
  }

  /**
   * Obtiene las solicitudes de cambio de agencia pendientes
   * @param {string} agencyId - ID de la agencia
   * @returns {Promise<Array>} - Solicitudes pendientes
   */
  async getPendingAgencyChanges(agencyId) {
    try {
      const requests = await prisma.agencyChange.findMany({
        where: {
          OR: [
            { newAgencyId: agencyId, status: "pendiente" },
            { previousAgencyId: agencyId, status: "pendiente" },
          ],
        },
        select: {
          id: true,
          status: true,
          changeDate: true,
          reason: true,
          profile: {
            select: {
              id: true,
              displayName: true,
              slug: true,
              gender: true,
              user: {
                select: {
                  profileImageUrl: true,
                },
              },
            },
          },
          previousAgency: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          newAgency: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          requestedBy: true,
        },
        orderBy: {
          changeDate: "desc",
        },
      });

      return requests;
    } catch (error) {
      logger.error(`Error al obtener solicitudes: ${error.message}`, { error });
      throw error;
    }
  }
}

module.exports = new AgencyService();
