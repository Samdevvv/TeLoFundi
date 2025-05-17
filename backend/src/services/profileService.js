// src/services/profileService.js
const { PrismaClient } = require("@prisma/client");
const logger = require("../utils/logger");
const slugify = require("slugify");
const crypto = require("crypto");

const prisma = new PrismaClient();

class ProfileService {
  /**
   * Obtiene un perfil por su ID
   * @param {string} profileId - ID del perfil
   * @param {boolean} includePrivate - Incluir información privada
   * @returns {Promise<Object>} - Perfil encontrado
   */
  async getProfileById(profileId, includePrivate = false) {
    try {
      // Seleccionar campos según si es información pública o privada
      const select = {
        id: true,
        displayName: true,
        slug: true,
        gender: true,
        age: true,
        description: true,
        shortDescription: true,
        verificationStatus: true,
        verifiedAt: true,
        height: true,
        weight: true,
        eyeColor: true,
        hairColor: true,
        skinTone: true,
        nationality: true,
        languages: true,
        location: true,
        travelAvailability: true,
        travelDestinations: true,
        services: true,
        priceHour: true,
        priceAdditionalHour: true,
        priceOvernight: true,
        priceWeekend: true,
        currency: true,
        paymentMethods: true,
        availabilityStatus: true,
        availabilitySchedule: true,
        isIndependent: true,
        isFeatured: true,
        searchBoostFactor: true,
        hasHealthCertificate: true,
        orientation: true,
        personalityTags: true,
        interests: true,
        tattoos: true,
        piercings: true,
        smoker: true,
        educationLevel: true,
        aboutMe: true,
        user: {
          select: {
            profileImageUrl: true,
            lastLogin: true,
          },
        },
        agency: includePrivate
          ? {
              select: {
                id: true,
                name: true,
                slug: true,
                verificationStatus: true,
              },
            }
          : false,
        images: {
          where: {
            isApproved: true,
            isPublic: true
          },
          select: {
            id: true,
            imageUrl: true,
            thumbnailUrl: true,
            mediumUrl: true,
            isMain: true,
            description: true,
            orderPosition: true,
            blurHash: true,
            dimensions: true
          },
          orderBy: {
            orderPosition: "asc"
          }
        }
      };

      // Si es vista privada, incluir campos adicionales
      if (includePrivate) {
        select.realName = true;
        select.birthDate = true;
        select.contactMethods = true;
        select.preferredContactHours = true;
        select.priceTravel = true;
        select.discountPackages = true;
        // También corregir aquí - usar "images" en lugar de "profileImages"
        select.images = {
          select: {
            id: true,
            imageUrl: true,
            thumbnailUrl: true,
            mediumUrl: true,
            isMain: true,
            isPublic: true,
            isPrivate: true,
            description: true,
            orderPosition: true,
            blurHash: true,
            dimensions: true,
            tags: true,
          },
          orderBy: {
            orderPosition: "asc",
          },
        };
      }

      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        select,
      });

      if (!profile) {
        throw new Error("Perfil no encontrado");
      }

      // Registrar vista si no es consulta privada (no contabilizar vistas del propio usuario o agencia)
      if (!includePrivate) {
        await this.registerProfileView(profileId, null);
      }

      return profile;
    } catch (error) {
      logger.error(`Error al obtener perfil: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Obtiene un perfil por su slug
   * @param {string} slug - Slug del perfil
   * @param {boolean} includePrivate - Incluir información privada
   * @returns {Promise<Object>} - Perfil encontrado
   */
  async getProfileBySlug(slug, includePrivate = false) {
    try {
      const profile = await prisma.profile.findUnique({
        where: { slug },
        select: {
          id: true,
        },
      });

      if (!profile) {
        throw new Error("Perfil no encontrado");
      }

      return this.getProfileById(profile.id, includePrivate);
    } catch (error) {
      logger.error(`Error al obtener perfil por slug: ${error.message}`, {
        error,
      });
      throw error;
    }
  }

  /**
   * Actualiza un perfil
   * @param {string} profileId - ID del perfil
   * @param {Object} profileData - Datos a actualizar
   * @returns {Promise<Object>} - Perfil actualizado
   */
  async updateProfile(profileId, profileData) {
    try {
      // Crear una copia del objeto para manipularlo
      const dataToUpdate = { ...profileData };
      
      // Eliminar campos que no se pueden actualizar directamente
      delete dataToUpdate.id;
      delete dataToUpdate.user;
      delete dataToUpdate.agency;
      delete dataToUpdate.images;
      delete dataToUpdate.totalViews;
      delete dataToUpdate.totalContacts;
      delete dataToUpdate.totalFavorites;
      
      // Si se cambia el nombre para mostrar, generamos un nuevo slug
      if (dataToUpdate.displayName) {
        dataToUpdate.slug = this.generateSlug(dataToUpdate.displayName);
      }

      // Si se proporciona la fecha de nacimiento, calculamos la edad
      if (dataToUpdate.birthDate) {
        const birthDate = new Date(dataToUpdate.birthDate);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        if (
          monthDiff < 0 ||
          (monthDiff === 0 && today.getDate() < birthDate.getDate())
        ) {
          age--;
        }

        dataToUpdate.age = age;
      }
      
      // Asegurarse de que los campos numéricos son realmente números
      if (dataToUpdate.priceHour && typeof dataToUpdate.priceHour === 'string') {
        dataToUpdate.priceHour = parseFloat(dataToUpdate.priceHour);
      }
      
      if (dataToUpdate.priceAdditionalHour && typeof dataToUpdate.priceAdditionalHour === 'string') {
        dataToUpdate.priceAdditionalHour = parseFloat(dataToUpdate.priceAdditionalHour);
      }
      
      if (dataToUpdate.priceOvernight && typeof dataToUpdate.priceOvernight === 'string') {
        dataToUpdate.priceOvernight = parseFloat(dataToUpdate.priceOvernight);
      }
      
      if (dataToUpdate.priceWeekend && typeof dataToUpdate.priceWeekend === 'string') {
        dataToUpdate.priceWeekend = parseFloat(dataToUpdate.priceWeekend);
      }
      
      if (dataToUpdate.priceTravel && typeof dataToUpdate.priceTravel === 'string') {
        dataToUpdate.priceTravel = parseFloat(dataToUpdate.priceTravel);
      }
      
      if (dataToUpdate.height && typeof dataToUpdate.height === 'string') {
        dataToUpdate.height = parseInt(dataToUpdate.height, 10);
      }
      
      if (dataToUpdate.weight && typeof dataToUpdate.weight === 'string') {
        dataToUpdate.weight = parseInt(dataToUpdate.weight, 10);
      }
      
      // Manejar direcciones de imagen con formato blob
      const removeBlobs = (obj) => {
        if (!obj) return;
        
        Object.keys(obj).forEach(key => {
          if (typeof obj[key] === 'string' && obj[key].startsWith('blob:')) {
            // Si es un blob, eliminar este campo
            delete obj[key];
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            // Recursivamente verificar objetos anidados
            removeBlobs(obj[key]);
          }
        });
      };
      
      removeBlobs(dataToUpdate);

      console.log("Datos a actualizar:", dataToUpdate);

      // Realizar la actualización
      const updatedProfile = await prisma.profile.update({
        where: { id: profileId },
        data: dataToUpdate,
        select: {
          id: true,
          displayName: true,
          slug: true,
          gender: true,
          age: true,
          description: true,
          shortDescription: true,
          verificationStatus: true,
          height: true,
          weight: true,
          eyeColor: true,
          hairColor: true,
          nationality: true,
          location: true,
          travelAvailability: true,
          travelDestinations: true,
          services: true,
          priceHour: true,
          priceAdditionalHour: true,
          priceOvernight: true,
          priceWeekend: true,
          currency: true,
          paymentMethods: true,
          availabilityStatus: true,
          availabilitySchedule: true,
          contactMethods: true,
          preferredContactHours: true
        },
      });

      return updatedProfile;
    } catch (error) {
      logger.error(`Error al actualizar perfil: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Registra una vista a un perfil
   * @param {string} profileId - ID del perfil
   * @param {string|null} viewerId - ID del usuario que ve el perfil (opcional)
   * @param {Object} metadata - Metadatos adicionales
   * @returns {Promise<boolean>} - Resultado de la operación
   */
  async registerProfileView(profileId, viewerId = null, metadata = {}) {
    try {
      const {
        ipAddress,
        sessionId,
        deviceType,
        deviceInfo,
        referrer,
        duration,
        location,
        searchQuery,
      } = metadata;

      // Registrar vista
      await prisma.profileView.create({
        data: {
          profileId,
          viewerId,
          ipAddress,
          sessionId,
          deviceType,
          deviceInfo,
          referrer,
          duration,
          location,
          searchQuery,
        },
      });

      // Incrementar contador de vistas
      await prisma.profile.update({
        where: { id: profileId },
        data: {
          totalViews: {
            increment: 1,
          },
        },
      });

      return true;
    } catch (error) {
      logger.error(`Error al registrar vista de perfil: ${error.message}`, {
        error,
      });
      // No lanzamos el error para no interrumpir la experiencia del usuario
      return false;
    }
  }

  /**
   * Registra un contacto con un perfil
   * @param {string} clientId - ID del cliente
   * @param {string} profileId - ID del perfil
   * @param {string} contactMethod - Método de contacto
   * @param {string} contactData - Datos del contacto
   * @param {Object} metadata - Metadatos adicionales
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async registerProfileContact(
    clientId,
    profileId,
    contactMethod,
    contactData,
    metadata = {}
  ) {
    try {
      const { initiatedBy, notes, location, deviceInfo } = metadata;

      // Registrar contacto
      const contact = await prisma.profileContact.create({
        data: {
          clientId,
          profileId,
          contactMethod,
          contactData,
          initiatedBy,
          notes,
          location,
          deviceInfo,
        },
      });

      // Incrementar contador de contactos
      await prisma.profile.update({
        where: { id: profileId },
        data: {
          totalContacts: {
            increment: 1,
          },
        },
      });

      // Incrementar contador de contactos del cliente
      await prisma.client.update({
        where: { id: clientId },
        data: {
          totalContacts: {
            increment: 1,
          },
        },
      });

      return {
        success: true,
        contactId: contact.id,
      };
    } catch (error) {
      logger.error(`Error al registrar contacto: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Agrega o elimina un perfil de los favoritos de un cliente
   * @param {string} clientId - ID del cliente
   * @param {string} profileId - ID del perfil
   * @param {boolean} add - true para agregar, false para eliminar
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async toggleFavoriteProfile(clientId, profileId, add = true) {
    try {
      // Obtener cliente y sus favoritos actuales
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { favoriteProfiles: true },
      });

      if (!client) {
        throw new Error("Cliente no encontrado");
      }

      // Verificar si el perfil existe
      const profileExists = await prisma.profile.findUnique({
        where: { id: profileId },
        select: { id: true },
      });

      if (!profileExists) {
        throw new Error("Perfil no encontrado");
      }

      // Obtener favoritos actuales o array vacío
      let favorites = client.favoriteProfiles || [];

      // Convertir a array si es un objeto JSONB
      if (typeof favorites === "object" && !Array.isArray(favorites)) {
        favorites = Object.values(favorites);
      }

      // Filtrar favoritos o agregar perfil
      if (add) {
        if (!favorites.includes(profileId)) {
          favorites.push(profileId);
        }
      } else {
        favorites = favorites.filter((id) => id !== profileId);
      }

      // Actualizar cliente
      await prisma.client.update({
        where: { id: clientId },
        data: { favoriteProfiles: favorites },
      });

      return {
        success: true,
        isFavorite: add,
      };
    } catch (error) {
      logger.error(`Error al gestionar favorito: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Obtiene los perfiles favoritos de un cliente
   * @param {string} clientId - ID del cliente
   * @param {Object} options - Opciones de paginación
   * @returns {Promise<Array>} - Lista de perfiles favoritos
   */
  async getFavoriteProfiles(clientId, options = {}) {
    try {
      const { page = 1, limit = 20 } = options;
      const skip = (page - 1) * limit;

      // Obtener cliente y sus favoritos
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { favoriteProfiles: true },
      });

      if (!client || !client.favoriteProfiles) {
        return { profiles: [], total: 0 };
      }

      // Convertir a array si es un objeto JSONB
      let favorites = client.favoriteProfiles;
      if (typeof favorites === "object" && !Array.isArray(favorites)) {
        favorites = Object.values(favorites);
      }

      // Si no hay favoritos, devolver array vacío
      if (!favorites.length) {
        return { profiles: [], total: 0 };
      }

      // Obtener perfiles favoritos
      const profiles = await prisma.profile.findMany({
        where: {
          id: { in: favorites },
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
          images: {
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
        skip,
        take: limit,
      });

      // Contar total
      const total = favorites.length;

      return {
        profiles,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error(`Error al obtener favoritos: ${error.message}`, { error });
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
   * Gestionar imágenes de un perfil
   * @param {string} profileId - ID del perfil
   * @param {Object} imageData - Datos de la imagen
   * @returns {Promise<Object>} - Imagen creada o actualizada
   */
  async manageProfileImage(profileId, imageData) {
    try {
      // Crear una copia para manipular
      const dataToProcess = { ...imageData };
      
      // Verificar y eliminar URLs de blob
      if (dataToProcess.imageUrl && dataToProcess.imageUrl.startsWith('blob:')) {
        console.log("Detectada URL blob, sustituyendo por URL por defecto");
        dataToProcess.imageUrl = "/images/publicacion.jpg";
      }
      
      if (dataToProcess.thumbnailUrl && dataToProcess.thumbnailUrl.startsWith('blob:')) {
        dataToProcess.thumbnailUrl = "/images/publicacion.jpg";
      }
      
      if (dataToProcess.mediumUrl && dataToProcess.mediumUrl.startsWith('blob:')) {
        dataToProcess.mediumUrl = "/images/publicacion.jpg";
      }
      
      const {
        id,
        imageUrl,
        thumbnailUrl,
        mediumUrl,
        isMain,
        description,
        orderPosition,
        isPrivate = false,
      } = dataToProcess;

      // Si es una imagen principal, quitar el estado principal de otras imágenes
      if (isMain) {
        await prisma.profileImage.updateMany({
          where: {
            profileId,
            isMain: true,
          },
          data: {
            isMain: false,
          },
        });
      }

      // Si existe ID, actualizar imagen existente
      if (id) {
        const updatedImage = await prisma.profileImage.update({
          where: { id },
          data: {
            imageUrl,
            thumbnailUrl,
            mediumUrl,
            isMain,
            description,
            orderPosition,
            isPrivate,
          },
        });

        return updatedImage;
      }

      // Caso contrario, crear nueva imagen
      const newImage = await prisma.profileImage.create({
        data: {
          profileId,
          imageUrl,
          thumbnailUrl,
          mediumUrl,
          isMain,
          description,
          orderPosition,
          isPrivate,
          // Para facilitar pruebas, hacer que las imágenes estén aprobadas por defecto
          isApproved: true,
          isPublic: !isPrivate
        },
      });

      return newImage;
    } catch (error) {
      logger.error(`Error al gestionar imagen de perfil: ${error.message}`, {
        error,
      });
      throw error;
    }
  }

  /**
   * Elimina una imagen de un perfil
   * @param {string} imageId - ID de la imagen
   * @param {string} profileId - ID del perfil (para verificación)
   * @returns {Promise<boolean>} - Resultado de la operación
   */
  async deleteProfileImage(imageId, profileId) {
    try {
      // Verificar que la imagen pertenezca al perfil
      const image = await prisma.profileImage.findUnique({
        where: { id: imageId },
        select: { profileId: true, isMain: true },
      });

      if (!image) {
        throw new Error("Imagen no encontrada");
      }

      if (image.profileId !== profileId) {
        throw new Error("No autorizado para eliminar esta imagen");
      }

      // No permitir eliminar la imagen principal si es la única
      if (image.isMain) {
        const count = await prisma.profileImage.count({
          where: { profileId },
        });

        if (count <= 1) {
          throw new Error("No se puede eliminar la única imagen del perfil");
        }
      }

      // Eliminar imagen
      await prisma.profileImage.delete({
        where: { id: imageId },
      });

      // Si era la principal, asignar otra como principal
      if (image.isMain) {
        const nextImage = await prisma.profileImage.findFirst({
          where: { profileId },
          orderBy: { orderPosition: "asc" },
        });

        if (nextImage) {
          await prisma.profileImage.update({
            where: { id: nextImage.id },
            data: { isMain: true },
          });
        }
      }

      return true;
    } catch (error) {
      logger.error(`Error al eliminar imagen: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Cambiar perfil a una agencia o hacerlo independiente
   * @param {string} profileId - ID del perfil
   * @param {string|null} agencyId - ID de la agencia (null para independiente)
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async changeAgency(profileId, agencyId) {
    try {
      // Obtener perfil actual
      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        select: { agencyId: true },
      });

      if (!profile) {
        throw new Error("Perfil no encontrado");
      }

      const previousAgencyId = profile.agencyId;

      // Si se proporciona agencyId, verificar que exista
      if (agencyId) {
        const agency = await prisma.agency.findUnique({
          where: { id: agencyId },
          select: { id: true, verificationStatus: true },
        });

        if (!agency) {
          throw new Error("Agencia no encontrada");
        }
      }

      // Registrar el cambio
      await prisma.agencyChange.create({
        data: {
          profileId,
          previousAgencyId,
          newAgencyId: agencyId,
          requestedBy: profileId, // Asumimos que el perfil mismo solicita el cambio
          status: "pendiente",
          reason: agencyId
            ? "Cambio a nueva agencia"
            : "Cambio a independiente",
        },
      });

      // Actualizar perfil
      await prisma.profile.update({
        where: { id: profileId },
        data: {
          agencyId,
          isIndependent: !agencyId,
          // Al cambiar de agencia, el perfil pierde verificación
          verificationStatus: "no_verificado",
          verifiedAt: null,
          verifiedBy: null,
          verificationExpires: null,
        },
      });

      return {
        success: true,
        isIndependent: !agencyId,
        previousAgencyId,
        newAgencyId: agencyId,
      };
    } catch (error) {
      logger.error(`Error al cambiar agencia: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Busca perfiles con opciones de filtrado y paginación
   * @param {Object} filters - Filtros para la búsqueda
   * @param {Object} options - Opciones de paginación
   * @returns {Promise<Object>} - Perfiles encontrados y metadata
   */
  async searchProfiles(filters = {}, options = {}) {
    try {
      const {
        location,
        service,
        verified,
        priceMin,
        priceMax,
        gender,
        searchQuery,
      } = filters;

      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      // Construir condiciones de búsqueda
      const whereConditions = {
        hidden: false,
        user: {
          isActive: true,
        },
      };

      // Aplicar filtros si están definidos
      if (location) {
        whereConditions.location = {
          path: ["city"],
          string_contains: location,
        };
      }

      if (service) {
        whereConditions.services = {
          array_contains: service,
        };
      }

      if (verified === true) {
        whereConditions.verificationStatus = "verificado";
      }

      if (priceMin) {
        whereConditions.priceHour = {
          gte: parseFloat(priceMin),
        };
      }

      if (priceMax) {
        if (whereConditions.priceHour) {
          whereConditions.priceHour.lte = parseFloat(priceMax);
        } else {
          whereConditions.priceHour = {
            lte: parseFloat(priceMax),
          };
        }
      }

      if (gender) {
        whereConditions.gender = gender;
      }

      // Búsqueda general
      if (searchQuery) {
        whereConditions.OR = [
          { displayName: { contains: searchQuery, mode: "insensitive" } },
          { description: { contains: searchQuery, mode: "insensitive" } },
          { shortDescription: { contains: searchQuery, mode: "insensitive" } },
        ];
      }

      // Realizar búsqueda
      const [profiles, totalCount] = await prisma.$transaction([
        prisma.profile.findMany({
          where: whereConditions,
          select: {
            id: true,
            displayName: true,
            slug: true,
            gender: true,
            age: true,
            description: true,
            shortDescription: true,
            verificationStatus: true,
            nationality: true,
            location: true,
            priceHour: true,
            priceAdditionalHour: true,
            priceOvernight: true,
            priceWeekend: true,
            currency: true,
            availabilityStatus: true,
            isFeatured: true,
            services: true,
            totalViews: true,
            totalFavorites: true,
            totalContacts: true,
            contactMethods: true,
            availabilitySchedule: true,
            lastActivity: true,
            languages: true,
            user: {
              select: {
                profileImageUrl: true,
                lastLogin: true,
              },
            },
            // The field is 'images' instead of 'profileImages' according to your schema
            images: {
              where: {
                isApproved: true,
                isPublic: true,
              },
              select: {
                id: true,
                imageUrl: true,
                thumbnailUrl: true,
                mediumUrl: true,
                isMain: true,
                description: true,
              },
              orderBy: {
                isMain: "desc",
              },
            },
            profileTags: {
              select: {
                tag: {
                  select: {
                    name: true,
                  },
                },
              },
              take: 10,
            },
          },
          orderBy: [
            {
              isFeatured: "desc",
            },
            {
              searchBoostFactor: "desc",
            },
            {
              lastActivity: "desc",
            },
          ],
          skip,
          take: limit,
        }),
        prisma.profile.count({
          where: whereConditions,
        }),
      ]);

      // Calcular metadatos de paginación
      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        profiles,
        meta: {
          totalItems: totalCount,
          itemsPerPage: limit,
          currentPage: page,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
      };
    } catch (error) {
      logger.error(`Error al buscar perfiles: ${error.message}`, { error });
      throw new Error(`Error al buscar perfiles: ${error.message}`);
    }
  }
}

module.exports = new ProfileService();