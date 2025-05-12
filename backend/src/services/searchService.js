// src/services/searchService.js
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class SearchService {
  /**
   * Busca perfiles según criterios
   * @param {Object} criteria - Criterios de búsqueda
   * @param {Object} options - Opciones de paginación
   * @param {Object} userInfo - Información del usuario que realiza la búsqueda
   * @returns {Promise<Object>} - Resultados de búsqueda
   */
  async searchProfiles(criteria, options = {}, userInfo = {}) {
    try {
      // Extraer criterios de búsqueda
      const {
        query,
        gender,
        minAge,
        maxAge,
        location,
        city,
        country,
        services,
        verificationStatus,
        availabilityStatus,
        minPrice,
        maxPrice,
        languages,
        nationality,
        features,
        tags,
        categoryId,
        agencyId,
        independent,
        travelAvailability,
      } = criteria;
      
      // Opciones de paginación y ordenamiento
      const {
        page = 1,
        limit = 20,
        orderBy = 'relevance' // relevance, recent, price_low, price_high
      } = options;
      
      const skip = (page - 1) * limit;
      
      // Construir condiciones de búsqueda
      const where = {
        isActive: true,
        hidden: false
      };
      
      // Búsqueda textual
      if (query) {
        where.OR = [
          { displayName: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { shortDescription: { contains: query, mode: 'insensitive' } }
        ];
      }
      
      // Filtro por género
      if (gender) {
        where.gender = gender;
      }
      
      // Filtro por edad
      if (minAge) {
        where.age = {
          ...where.age,
          gte: parseInt(minAge)
        };
      }
      
      if (maxAge) {
        where.age = {
          ...where.age,
          lte: parseInt(maxAge)
        };
      }
      
      // Filtro por ubicación
      if (city) {
        where.location = {
          path: '$.city',
          string_contains: city,
          mode: 'insensitive'
        };
      }
      
      if (country) {
        where.location = {
          path: '$.country',
          string_contains: country,
          mode: 'insensitive'
        };
      }
      
      // Filtro por precio
      if (minPrice) {
        where.priceHour = {
          ...where.priceHour,
          gte: parseFloat(minPrice)
        };
      }
      
      if (maxPrice) {
        where.priceHour = {
          ...where.priceHour,
          lte: parseFloat(maxPrice)
        };
      }
      
      // Filtro por estados
      if (verificationStatus) {
        where.verificationStatus = verificationStatus;
      }
      
      if (availabilityStatus) {
        where.availabilityStatus = availabilityStatus;
      }
      
      // Filtro por idiomas
      if (languages && languages.length > 0) {
        const langArray = Array.isArray(languages) ? languages : languages.split(',');
        // Usando JSON path para búsqueda en JSONB
        where.languages = {
          path: langArray.map(lang => `$.${lang}`),
          equals: true
        };
      }
      
      // Filtro por nacionalidad
      if (nationality) {
        where.nationality = nationality;
      }
      
      // Filtro por agencia o independiente
      if (agencyId) {
        where.agencyId = agencyId;
      } else if (independent === 'true' || independent === true) {
        where.isIndependent = true;
      }
      
      // Filtro por disponibilidad para viajar
      if (travelAvailability === 'true' || travelAvailability === true) {
        where.travelAvailability = true;
      }
      
      // Filtro por categoría (usando tags asociados a categoría)
      if (categoryId) {
        where.profileTags = {
          some: {
            tag: {
              categoryId
            }
          }
        };
      }
      
      // Filtro por tags específicos
      if (tags && tags.length > 0) {
        const tagArray = Array.isArray(tags) ? tags : tags.split(',');
        where.profileTags = {
          some: {
            tag: {
              id: { in: tagArray }
            }
          }
        };
      }
      
      // Filtro por características (tattoos, piercings, etc.)
      if (features) {
        const featuresObj = typeof features === 'string' ? JSON.parse(features) : features;
        Object.entries(featuresObj).forEach(([key, value]) => {
          if (value === true || value === 'true') {
            where[key] = true;
          }
        });
      }
      
      // Filtro por servicios
      if (services && services.length > 0) {
        const serviceArray = Array.isArray(services) ? services : services.split(',');
        // Simplificación, esto podría necesitar ajustes según la estructura de servicios
        serviceArray.forEach(service => {
          where.services = {
            path: `$.${service}`,
            equals: true
          };
        });
      }
      
      // Determinar ordenamiento
      let orderByClause;
      switch (orderBy) {
        case 'recent':
          orderByClause = { lastActivity: 'desc' };
          break;
        case 'price_low':
          orderByClause = { priceHour: 'asc' };
          break;
        case 'price_high':
          orderByClause = { priceHour: 'desc' };
          break;
        case 'relevance':
        default:
          // Orden por relevancia:
          // 1. Perfiles destacados
          // 2. Perfiles verificados
          // 3. Perfiles con actividad reciente
          // 4. Factor de impulso de búsqueda
          orderByClause = [
            { isFeatured: 'desc' },
            { verificationStatus: 'asc' }, // 'verificado' viene antes alfabéticamente
            { searchBoostFactor: 'desc' },
            { lastActivity: 'desc' }
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
          services: true,
          languages: true,
          lastActivity: true,
          user: {
            select: {
              profileImageUrl: true
            }
          },
          agency: {
            select: {
              name: true,
              slug: true
            }
          },
          profileImages: {
            where: {
              isApproved: true,
              isPublic: true,
              isMain: true
            },
            select: {
              id: true,
              thumbnailUrl: true,
              blurHash: true
            },
            take: 1
          },
          profileTags: {
            select: {
              tag: {
                select: {
                  id: true,
                  name: true,
                  slug: true
                }
              }
            }
          }
        },
        orderBy: orderByClause,
        skip,
        take: limit
      });
      
      // Contar total de perfiles que cumplen los criterios
      const total = await prisma.profile.count({ where });
      
      // Registrar búsqueda si hay información de usuario
      if (userInfo.sessionId || userInfo.userId) {
        await this.registerSearch(
          criteria,
          { total, limit, page },
          userInfo
        );
      }
      
      return {
        profiles,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error(`Error en búsqueda de perfiles: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Registra una búsqueda realizada
   * @param {Object} criteria - Criterios de búsqueda
   * @param {Object} results - Resultados de la búsqueda
   * @param {Object} userInfo - Información del usuario
   * @returns {Promise<Object>} - Búsqueda registrada
   */
  async registerSearch(criteria, results, userInfo) {
    try {
      const { userId, sessionId, ipAddress, deviceType, deviceInfo, location } = userInfo;
      
      // Crear registro de búsqueda
      const search = await prisma.userSearch.create({
        data: {
          userId,
          sessionId: sessionId || crypto.randomBytes(16).toString('hex'),
          searchQuery: criteria.query || '',
          filters: criteria,
          resultsCount: results.total,
          ipAddress,
          deviceType,
          deviceInfo,
          location,
          clickedProfiles: []
        }
      });
      
      return search;
    } catch (error) {
      // No lanzamos el error para no interrumpir la experiencia del usuario
      logger.error(`Error al registrar búsqueda: ${error.message}`, { error });
      return null;
    }
  }
  
  /**
   * Registra un clic en un perfil desde los resultados de búsqueda
   * @param {string} searchId - ID de la búsqueda
   * @param {string} profileId - ID del perfil
   * @param {Object} userInfo - Información del usuario
   * @returns {Promise<boolean>} - Resultado de la operación
   */
  async registerProfileClick(searchId, profileId, userInfo) {
    try {
      const { userId, sessionId } = userInfo;
      
      // Buscar la búsqueda
      const search = await prisma.userSearch.findFirst({
        where: {
          id: searchId,
          OR: [
            { userId },
            { sessionId }
          ]
        },
        select: {
          id: true,
          clickedProfiles: true
        }
      });
      
      if (!search) {
        return false;
      }
      
      // Añadir perfil a los clics
      let clickedProfiles = search.clickedProfiles || [];
      
      // Convertir a array si es objeto
      if (typeof clickedProfiles === 'object' && !Array.isArray(clickedProfiles)) {
        clickedProfiles = Object.values(clickedProfiles);
      }
      
      // Añadir perfil si no está en la lista
      if (!clickedProfiles.includes(profileId)) {
        clickedProfiles.push(profileId);
      }
      
      // Actualizar búsqueda
      await prisma.userSearch.update({
        where: { id: search.id },
        data: { clickedProfiles }
      });
      
      return true;
    } catch (error) {
      logger.error(`Error al registrar clic: ${error.message}`, { error });
      return false;
    }
  }
  
  /**
   * Busca agencias según criterios
   * @param {Object} criteria - Criterios de búsqueda
   * @param {Object} options - Opciones de paginación
   * @returns {Promise<Object>} - Resultados de búsqueda
   */
  async searchAgencies(criteria, options = {}) {
    try {
      // Extraer criterios de búsqueda
      const {
        query,
        city,
        country,
        verificationStatus,
        minProfiles
      } = criteria;
      
      // Opciones de paginación
      const {
        page = 1,
        limit = 20
      } = options;
      
      const skip = (page - 1) * limit;
      
      // Construir condiciones de búsqueda
      const where = {
        isActive: true
      };
      
      // Búsqueda textual
      if (query) {
        where.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { shortDescription: { contains: query, mode: 'insensitive' } }
        ];
      }
      
      // Filtro por ubicación
      if (city) {
        where.city = { contains: city, mode: 'insensitive' };
      }
      
      if (country) {
        where.country = { contains: country, mode: 'insensitive' };
      }
      
      // Filtro por estado de verificación
      if (verificationStatus) {
        where.verificationStatus = verificationStatus;
      }
      
      // Filtro por número mínimo de perfiles
      if (minProfiles) {
        where.totalProfiles = {
          gte: parseInt(minProfiles)
        };
      }
      
      // Consultar agencias
      const agencies = await prisma.agency.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          shortDescription: true,
          city: true,
          stateProvince: true,
          country: true,
          verificationStatus: true,
          logoUrl: true,
          coverImageUrl: true,
          totalProfiles: true,
          activeProfiles: true,
          verifiedProfiles: true,
          rating: true,
          totalRatings: true,
          isFeatured: true,
          featuredUntil: true,
          user: {
            select: {
              lastLogin: true
            }
          },
          _count: {
            select: {
              profiles: {
                where: {
                  isActive: true,
                  hidden: false
                }
              }
            }
          }
        },
        orderBy: [
          { isFeatured: 'desc' },
          { verificationStatus: 'asc' },
          { totalProfiles: 'desc' }
        ],
        skip,
        take: limit
      });
      
      // Contar total
      const total = await prisma.agency.count({ where });
      
      return {
        agencies,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error(`Error en búsqueda de agencias: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Obtiene las categorías disponibles
   * @returns {Promise<Array>} - Categorías disponibles
   */
  async getCategories() {
    try {
      const categories = await prisma.category.findMany({
        where: {
          isActive: true
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          iconUrl: true,
          displayOrder: true,
          tags: {
            where: {
              isActive: true
            },
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        },
        orderBy: {
          displayOrder: 'asc'
        }
      });
      
      return categories;
    } catch (error) {
      logger.error(`Error al obtener categorías: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Obtiene los tags populares
   * @param {number} limit - Límite de tags a retornar
   * @returns {Promise<Array>} - Tags populares
   */
  async getPopularTags(limit = 20) {
    try {
      // Obtener los tags más utilizados
      const tags = await prisma.tag.findMany({
        where: {
          isActive: true
        },
        select: {
          id: true,
          name: true,
          slug: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          _count: {
            select: {
              profileTags: true
            }
          }
        },
        orderBy: {
          profileTags: {
            _count: 'desc'
          }
        },
        take: limit
      });
      
      return tags;
    } catch (error) {
      logger.error(`Error al obtener tags populares: ${error.message}`, { error });
      throw error;
    }
  }
}

module.exports = new SearchService();