// src/services/metricService.js
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * Servicio para gestionar métricas y estadísticas
 */
class MetricService {
  /**
   * Obtiene métricas para un perfil
   * @param {string} profileId - ID del perfil
   * @param {string} period - Periodo (daily, weekly, monthly)
   * @returns {Promise<Object>} - Métricas del perfil
   */
  async getProfileMetrics(profileId, period = 'monthly') {
    try {
      // Obtener el perfil para verificar que existe
      const profile = await prisma.profile.findUnique({
        where: { id: profileId }
      });

      if (!profile) {
        throw new Error('Perfil no encontrado');
      }

      // Determinar fechas según periodo
      const { startDate, endDate } = this._getDateRangeForPeriod(period);

      // Obtener métricas almacenadas
      const storedMetrics = await prisma.profileMetric.findFirst({
        where: {
          profileId,
          metricsPeriod: period,
          periodStart: {
            gte: startDate
          },
          periodEnd: {
            lte: endDate
          }
        }
      });

      if (storedMetrics) {
        return storedMetrics;
      }

      // Si no existen métricas para el periodo actual, calcularlas
      return this._calculateProfileMetrics(profileId, period, startDate, endDate);
    } catch (error) {
      logger.error(`Error al obtener métricas de perfil: ${error.message}`, { error });
      throw new Error(`Error al obtener métricas de perfil: ${error.message}`);
    }
  }

  /**
   * Calcula y almacena métricas para un perfil
   * @param {string} profileId - ID del perfil
   * @param {string} period - Periodo (daily, weekly, monthly)
   * @param {Date} startDate - Fecha de inicio
   * @param {Date} endDate - Fecha de fin
   * @returns {Promise<Object>} - Métricas calculadas
   * @private
   */
  async _calculateProfileMetrics(profileId, period, startDate, endDate) {
    try {
      // Calcular vistas en el periodo
      const views = await prisma.profileView.count({
        where: {
          profileId,
          viewedAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      // Calcular contactos en el periodo
      const contacts = await prisma.profileContact.count({
        where: {
          profileId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      // Calcular chats iniciados en el periodo
      const chatsInitiated = await prisma.conversation.count({
        where: {
          profileId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      // Calcular apariciones en búsquedas
      const searchAppearances = await prisma.userSearch.count({
        where: {
          clickedProfiles: {
            path: '$[*]',
            array_contains: profileId
          },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      // Calcular favoritos
      const favoriteCount = await prisma.client.count({
        where: {
          favoriteProfiles: {
            path: '$[*]',
            array_contains: profileId
          }
        }
      });

      // Calcular clics a contacto
      const clicksToContactCount = await prisma.profileContact.count({
        where: {
          profileId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      // Calcular tasa de conversión (contactos / vistas)
      const contactConversionRate = views > 0 ? (contacts / views) * 100 : 0;

      // Calcular tiempo promedio de respuesta en chat (en segundos)
      const avgChatResponseTime = await this._calculateAvgChatResponseTime(profileId, startDate, endDate);

      // Calcular tiempo promedio de visualización
      const avgViewTime = await this._calculateAvgViewTime(profileId, startDate, endDate);

      // Calcular distribución geográfica
      const geographicDistribution = await this._calculateGeographicDistribution(profileId, startDate, endDate);

      // Calcular fuentes de tráfico
      const trafficSources = await this._calculateTrafficSources(profileId, startDate, endDate);

      // Calcular palabras clave de búsqueda
      const searchKeywords = await this._calculateSearchKeywords(profileId, startDate, endDate);

      // Crear o actualizar métricas
      const metrics = await prisma.profileMetric.upsert({
        where: {
          profileId_metricsPeriod_periodStart_periodEnd: {
            profileId,
            metricsPeriod: period,
            periodStart: startDate,
            periodEnd: endDate
          }
        },
        update: {
          viewsCount: views,
          contactsCount: contacts,
          chatsInitiatedCount: chatsInitiated,
          searchAppearancesCount: searchAppearances,
          favoriteCount,
          clicksToContactCount,
          contactConversionRate,
          avgChatResponseTime,
          avgViewTime,
          lastCalculated: new Date(),
          geographicDistribution,
          trafficSources,
          searchKeywords
        },
        create: {
          profileId,
          metricsPeriod: period,
          periodStart: startDate,
          periodEnd: endDate,
          viewsCount: views,
          contactsCount: contacts,
          chatsInitiatedCount: chatsInitiated,
          searchAppearancesCount: searchAppearances,
          favoriteCount,
          clicksToContactCount,
          contactConversionRate,
          avgChatResponseTime,
          avgViewTime,
          lastCalculated: new Date(),
          geographicDistribution,
          trafficSources,
          searchKeywords
        }
      });

      // Actualizar totales en el perfil
      await prisma.profile.update({
        where: { id: profileId },
        data: {
          totalViews: views,
          totalContacts: contacts,
          totalFavorites: favoriteCount
        }
      });

      return metrics;
    } catch (error) {
      logger.error(`Error al calcular métricas de perfil: ${error.message}`, { error });
      throw new Error(`Error al calcular métricas de perfil: ${error.message}`);
    }
  }

  /**
   * Calcula tiempo promedio de respuesta en chat
   * @param {string} profileId - ID del perfil
   * @param {Date} startDate - Fecha de inicio
   * @param {Date} endDate - Fecha de fin
   * @returns {Promise<number>} - Tiempo promedio en segundos
   * @private
   */
  async _calculateAvgChatResponseTime(profileId, startDate, endDate) {
    try {
      // Obtener conversaciones en el periodo
      const conversations = await prisma.conversation.findMany({
        where: {
          profileId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          id: true
        }
      });

      if (conversations.length === 0) {
        return 0;
      }

      const conversationIds = conversations.map(conv => conv.id);

      // Obtener mensajes de clientes y respuestas del perfil
      const messages = await prisma.message.findMany({
        where: {
          conversationId: {
            in: conversationIds
          },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: {
          createdAt: 'asc'
        },
        select: {
          conversationId: true,
          senderId: true,
          recipientId: true,
          createdAt: true
        }
      });

      // Calcular tiempos de respuesta
      const responseTimesByConversation = {};
      let totalResponseTime = 0;
      let countResponses = 0;

      messages.forEach((message, index) => {
        if (index === 0 || messages[index - 1].conversationId !== message.conversationId) {
          // Primer mensaje de la conversación o nueva conversación
          responseTimesByConversation[message.conversationId] = {
            lastClientMessage: message.senderId !== profileId ? message.createdAt : null,
            lastProfileMessage: message.senderId === profileId ? message.createdAt : null
          };
        } else {
          // Si es un mensaje del perfil y el anterior fue del cliente
          if (
            message.senderId === profileId && 
            responseTimesByConversation[message.conversationId].lastClientMessage
          ) {
            const responseTime = Math.floor(
              (message.createdAt - responseTimesByConversation[message.conversationId].lastClientMessage) / 1000
            );
            
            // Solo considerar respuestas en menos de 1 hora (3600 segundos)
            if (responseTime > 0 && responseTime < 3600) {
              totalResponseTime += responseTime;
              countResponses++;
            }
            
            responseTimesByConversation[message.conversationId].lastProfileMessage = message.createdAt;
          }
          
          // Si es un mensaje del cliente, actualizar último mensaje del cliente
          if (message.senderId !== profileId) {
            responseTimesByConversation[message.conversationId].lastClientMessage = message.createdAt;
          }
        }
      });

      return countResponses > 0 ? Math.floor(totalResponseTime / countResponses) : 0;
    } catch (error) {
      logger.error(`Error al calcular tiempo de respuesta: ${error.message}`, { error });
      return 0;
    }
  }

  /**
   * Calcula tiempo promedio de visualización
   * @param {string} profileId - ID del perfil
   * @param {Date} startDate - Fecha de inicio
   * @param {Date} endDate - Fecha de fin
   * @returns {Promise<number>} - Tiempo promedio en segundos
   * @private
   */
  async _calculateAvgViewTime(profileId, startDate, endDate) {
    try {
      // Obtener tiempos de visualización
      const viewsWithDuration = await prisma.profileView.findMany({
        where: {
          profileId,
          viewedAt: {
            gte: startDate,
            lte: endDate
          },
          duration: {
            not: null
          }
        },
        select: {
          duration: true
        }
      });

      if (viewsWithDuration.length === 0) {
        return 0;
      }

      // Calcular promedio
      const totalDuration = viewsWithDuration.reduce((sum, view) => sum + (view.duration || 0), 0);
      return Math.floor(totalDuration / viewsWithDuration.length);
    } catch (error) {
      logger.error(`Error al calcular tiempo de visualización: ${error.message}`, { error });
      return 0;
    }
  }

  /**
   * Calcula distribución geográfica
   * @param {string} profileId - ID del perfil
   * @param {Date} startDate - Fecha de inicio
   * @param {Date} endDate - Fecha de fin
   * @returns {Promise<Object>} - Distribución geográfica
   * @private
   */
  async _calculateGeographicDistribution(profileId, startDate, endDate) {
    try {
      // Obtener vistas con ubicación
      const viewsWithLocation = await prisma.profileView.findMany({
        where: {
          profileId,
          viewedAt: {
            gte: startDate,
            lte: endDate
          },
          location: {
            not: null
          }
        },
        select: {
          location: true
        }
      });

      if (viewsWithLocation.length === 0) {
        return {};
      }

      // Calcular distribución por país y ciudad
      const distribution = {
        countries: {},
        cities: {}
      };

      viewsWithLocation.forEach(view => {
        if (view.location) {
          const location = typeof view.location === 'string' 
            ? JSON.parse(view.location) 
            : view.location;

          if (location.country) {
            distribution.countries[location.country] = 
              (distribution.countries[location.country] || 0) + 1;
          }

          if (location.city) {
            distribution.cities[location.city] = 
              (distribution.cities[location.city] || 0) + 1;
          }
        }
      });

      // Convertir a porcentajes
      const total = viewsWithLocation.length;
      
      Object.keys(distribution.countries).forEach(country => {
        distribution.countries[country] = parseFloat(
          ((distribution.countries[country] / total) * 100).toFixed(2)
        );
      });

      Object.keys(distribution.cities).forEach(city => {
        distribution.cities[city] = parseFloat(
          ((distribution.cities[city] / total) * 100).toFixed(2)
        );
      });

      return distribution;
    } catch (error) {
      logger.error(`Error al calcular distribución geográfica: ${error.message}`, { error });
      return {};
    }
  }

  /**
   * Calcula fuentes de tráfico
   * @param {string} profileId - ID del perfil
   * @param {Date} startDate - Fecha de inicio
   * @param {Date} endDate - Fecha de fin
   * @returns {Promise<Object>} - Fuentes de tráfico
   * @private
   */
  async _calculateTrafficSources(profileId, startDate, endDate) {
    try {
      // Obtener vistas con referrer
      const viewsWithReferrer = await prisma.profileView.findMany({
        where: {
          profileId,
          viewedAt: {
            gte: startDate,
            lte: endDate
          },
          referrer: {
            not: null
          }
        },
        select: {
          referrer: true
        }
      });

      if (viewsWithReferrer.length === 0) {
        return {};
      }

      // Clasificar fuentes
      const sources = {
        search: 0,
        direct: 0,
        social: 0,
        other: 0,
        internal: 0
      };

      const searchEngines = ['google', 'bing', 'yahoo', 'duckduckgo'];
      const socialNetworks = ['facebook', 'instagram', 'twitter', 'tiktok', 'pinterest', 'youtube'];

      viewsWithReferrer.forEach(view => {
        const referrer = view.referrer?.toLowerCase() || '';

        if (!referrer || referrer.includes('direct')) {
          sources.direct++;
        } else if (referrer.includes(window.location.hostname)) {
          sources.internal++;
        } else if (searchEngines.some(engine => referrer.includes(engine))) {
          sources.search++;
        } else if (socialNetworks.some(network => referrer.includes(network))) {
          sources.social++;
        } else {
          sources.other++;
        }
      });

      // Convertir a porcentajes
      const total = viewsWithReferrer.length;
      
      Object.keys(sources).forEach(source => {
        sources[source] = parseFloat(
          ((sources[source] / total) * 100).toFixed(2)
        );
      });

      return sources;
    } catch (error) {
      logger.error(`Error al calcular fuentes de tráfico: ${error.message}`, { error });
      return {};
    }
  }

  /**
   * Calcula palabras clave de búsqueda
   * @param {string} profileId - ID del perfil
   * @param {Date} startDate - Fecha de inicio
   * @param {Date} endDate - Fecha de fin
   * @returns {Promise<Object>} - Palabras clave de búsqueda
   * @private
   */
  async _calculateSearchKeywords(profileId, startDate, endDate) {
    try {
      // Obtener búsquedas que llevaron al perfil
      const searches = await prisma.userSearch.findMany({
        where: {
          clickedProfiles: {
            path: '$[*]',
            array_contains: profileId
          },
          createdAt: {
            gte: startDate,
            lte: endDate
          },
          searchQuery: {
            not: null
          }
        },
        select: {
          searchQuery: true
        }
      });

      if (searches.length === 0) {
        return {};
      }

      // Contar frecuencia de términos
      const keywords = {};
      
      searches.forEach(search => {
        if (search.searchQuery) {
          const terms = search.searchQuery.toLowerCase().split(/\s+/);
          
          terms.forEach(term => {
            if (term.length > 2) { // Ignorar términos muy cortos
              keywords[term] = (keywords[term] || 0) + 1;
            }
          });
        }
      });

      // Ordenar por frecuencia y limitar a 20 términos
      const sortedKeywords = Object.entries(keywords)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .reduce((obj, [key, value]) => {
          obj[key] = value;
          return obj;
        }, {});

      return sortedKeywords;
    } catch (error) {
      logger.error(`Error al calcular palabras clave: ${error.message}`, { error });
      return {};
    }
  }

  /**
   * Obtiene métricas para una agencia
   * @param {string} agencyId - ID de la agencia
   * @param {string} period - Periodo (daily, weekly, monthly)
   * @returns {Promise<Object>} - Métricas de la agencia
   */
  async getAgencyMetrics(agencyId, period = 'monthly') {
    try {
      // Obtener la agencia para verificar que existe
      const agency = await prisma.agency.findUnique({
        where: { id: agencyId }
      });

      if (!agency) {
        throw new Error('Agencia no encontrada');
      }

      // Determinar fechas según periodo
      const { startDate, endDate } = this._getDateRangeForPeriod(period);

      // Obtener perfiles de la agencia
      const profiles = await prisma.profile.findMany({
        where: {
          agencyId
        },
        select: {
          id: true
        }
      });

      const profileIds = profiles.map(profile => profile.id);

      // Obtener métricas por perfil
      const profileMetrics = await Promise.all(
        profileIds.map(profileId => this.getProfileMetrics(profileId, period))
      );

      // Agregar métricas
      const aggregatedMetrics = this._aggregateProfileMetrics(profileMetrics);

      // Calcular métricas específicas de la agencia
      const agencySpecificMetrics = await this._calculateAgencySpecificMetrics(agencyId, profileIds, startDate, endDate);

      return {
        ...aggregatedMetrics,
        ...agencySpecificMetrics,
        period,
        startDate,
        endDate,
        totalProfiles: profileIds.length
      };
    } catch (error) {
      logger.error(`Error al obtener métricas de agencia: ${error.message}`, { error });
      throw new Error(`Error al obtener métricas de agencia: ${error.message}`);
    }
  }

  /**
   * Agrega métricas de perfiles
   * @param {Array} profileMetrics - Métricas de perfiles
   * @returns {Object} - Métricas agregadas
   * @private
   */
  _aggregateProfileMetrics(profileMetrics) {
    // Inicializar objeto de métricas agregadas
    const aggregated = {
      totalViews: 0,
      totalContacts: 0,
      totalChats: 0,
      totalSearchAppearances: 0,
      totalFavorites: 0,
      avgContactConversionRate: 0,
      avgResponseTime: 0,
      avgViewTime: 0,
      topProfiles: [],
      geographicDistribution: {
        countries: {},
        cities: {}
      },
      trafficSources: {
        search: 0,
        direct: 0,
        social: 0,
        other: 0,
        internal: 0
      }
    };

    if (profileMetrics.length === 0) {
      return aggregated;
    }

    // Sumar métricas numéricas
    profileMetrics.forEach(metric => {
      aggregated.totalViews += metric.viewsCount || 0;
      aggregated.totalContacts += metric.contactsCount || 0;
      aggregated.totalChats += metric.chatsInitiatedCount || 0;
      aggregated.totalSearchAppearances += metric.searchAppearancesCount || 0;
      aggregated.totalFavorites += metric.favoriteCount || 0;

      // Sumar valores para promedios
      if (metric.contactConversionRate) {
        aggregated.avgContactConversionRate += metric.contactConversionRate;
      }

      if (metric.avgChatResponseTime) {
        aggregated.avgResponseTime += metric.avgChatResponseTime;
      }

      if (metric.avgViewTime) {
        aggregated.avgViewTime += metric.avgViewTime;
      }

      // Combinar distribución geográfica
      if (metric.geographicDistribution) {
        const geo = typeof metric.geographicDistribution === 'string' 
          ? JSON.parse(metric.geographicDistribution) 
          : metric.geographicDistribution;
          
        if (geo.countries) {
          Object.entries(geo.countries).forEach(([country, value]) => {
            aggregated.geographicDistribution.countries[country] = 
              (aggregated.geographicDistribution.countries[country] || 0) + value;
          });
        }
          
        if (geo.cities) {
          Object.entries(geo.cities).forEach(([city, value]) => {
            aggregated.geographicDistribution.cities[city] = 
              (aggregated.geographicDistribution.cities[city] || 0) + value;
          });
        }
      }

      // Combinar fuentes de tráfico
      if (metric.trafficSources) {
        const sources = typeof metric.trafficSources === 'string' 
          ? JSON.parse(metric.trafficSources) 
          : metric.trafficSources;
          
        Object.entries(sources).forEach(([source, value]) => {
          if (aggregated.trafficSources[source] !== undefined) {
            aggregated.trafficSources[source] += value;
          }
        });
      }
    });

    // Calcular promedios
    aggregated.avgContactConversionRate = parseFloat(
      (aggregated.avgContactConversionRate / profileMetrics.length).toFixed(2)
    );
    
    aggregated.avgResponseTime = Math.floor(
      aggregated.avgResponseTime / profileMetrics.length
    );
    
    aggregated.avgViewTime = Math.floor(
      aggregated.avgViewTime / profileMetrics.length
    );

    // Normalizar distribución geográfica y fuentes de tráfico como promedio
    Object.keys(aggregated.geographicDistribution.countries).forEach(country => {
      aggregated.geographicDistribution.countries[country] = parseFloat(
        (aggregated.geographicDistribution.countries[country] / profileMetrics.length).toFixed(2)
      );
    });

    Object.keys(aggregated.geographicDistribution.cities).forEach(city => {
      aggregated.geographicDistribution.cities[city] = parseFloat(
        (aggregated.geographicDistribution.cities[city] / profileMetrics.length).toFixed(2)
      );
    });

    Object.keys(aggregated.trafficSources).forEach(source => {
      aggregated.trafficSources[source] = parseFloat(
        (aggregated.trafficSources[source] / profileMetrics.length).toFixed(2)
      );
    });

    return aggregated;
  }

  /**
   * Calcula métricas específicas de una agencia
   * @param {string} agencyId - ID de la agencia
   * @param {Array} profileIds - IDs de perfiles de la agencia
   * @param {Date} startDate - Fecha de inicio
   * @param {Date} endDate - Fecha de fin
   * @returns {Promise<Object>} - Métricas específicas
   * @private
   */
  async _calculateAgencySpecificMetrics(agencyId, profileIds, startDate, endDate) {
    try {
      // Calcular perfiles más populares
      const topProfiles = await prisma.profile.findMany({
        where: {
          id: {
            in: profileIds
          }
        },
        select: {
          id: true,
          displayName: true,
          slug: true,
          totalViews: true,
          totalContacts: true
        },
        orderBy: {
          totalViews: 'desc'
        },
        take: 5
      });

      // Calcular verificaciones realizadas
      const verifications = await prisma.profileVerification.count({
        where: {
          agencyId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      // Calcular nuevos perfiles
      const newProfiles = await prisma.profile.count({
        where: {
          agencyId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      // Calcular valoración promedio
      const rating = await prisma.agency.findUnique({
        where: {
          id: agencyId
        },
        select: {
          rating: true
        }
      });

      return {
        topProfiles,
        verifications,
        newProfiles,
        rating: rating?.rating || 0
      };
    } catch (error) {
      logger.error(`Error al calcular métricas de agencia: ${error.message}`, { error });
      return {
        topProfiles: [],
        verifications: 0,
        newProfiles: 0,
        rating: 0
      };
    }
  }

  /**
   * Obtiene métricas para un cliente
   * @param {string} clientId - ID del cliente
   * @returns {Promise<Object>} - Métricas del cliente
   */
  async getClientMetrics(clientId) {
    try {
      // Obtener el cliente para verificar que existe
      const client = await prisma.client.findUnique({
        where: { id: clientId }
      });

      if (!client) {
        throw new Error('Cliente no encontrado');
      }

      // Determinar fechas para el último mes
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);

      // Métricas de actividad
      const activityMetrics = await this._calculateClientActivityMetrics(clientId, startDate, endDate);

      // Métricas de puntos y cupones
      const pointsAndCoupons = await this._calculateClientPointsAndCoupons(clientId);

      // Métricas de gastos
      const spendingMetrics = await this._calculateClientSpendingMetrics(clientId, startDate, endDate);

      // Perfiles favoritos y más visitados
      const profilesMetrics = await this._calculateClientProfilesMetrics(clientId);

      return {
        ...activityMetrics,
        ...pointsAndCoupons,
        ...spendingMetrics,
        ...profilesMetrics,
        startDate,
        endDate
      };
    } catch (error) {
      logger.error(`Error al obtener métricas de cliente: ${error.message}`, { error });
      throw new Error(`Error al obtener métricas de cliente: ${error.message}`);
    }
  }

  /**
   * Calcula métricas de actividad para un cliente
   * @param {string} clientId - ID del cliente
   * @param {Date} startDate - Fecha de inicio
   * @param {Date} endDate - Fecha de fin
   * @returns {Promise<Object>} - Métricas de actividad
   * @private
   */
  async _calculateClientActivityMetrics(clientId, startDate, endDate) {
    try {
      // Conteo de logins
      const logins = await prisma.userSession.count({
        where: {
          userId: clientId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      // Conteo de búsquedas
      const searches = await prisma.userSearch.count({
        where: {
          userId: clientId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      // Conteo de perfiles visitados
      const profilesViewed = await prisma.profileView.count({
        where: {
          viewerId: clientId,
          viewedAt: {
            gte: startDate,
            lte: endDate
          }
        },
        distinct: ['profileId']
      });

      // Contactos realizados
      const contactsMade = await prisma.profileContact.count({
        where: {
          clientId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      // Mensajes enviados
      const messagesSent = await prisma.message.count({
        where: {
          senderId: clientId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      // Conversaciones activas
      const activeConversations = await prisma.conversation.count({
        where: {
          clientId,
          updatedAt: {
            gte: startDate
          }
        }
      });

      return {
        logins,
        searches,
        profilesViewed,
        contactsMade,
        messagesSent,
        activeConversations
      };
    } catch (error) {
      logger.error(`Error al calcular métricas de actividad de cliente: ${error.message}`, { error });
      return {
        logins: 0,
        searches: 0,
        profilesViewed: 0,
        contactsMade: 0,
        messagesSent: 0,
        activeConversations: 0
      };
    }
  }

  /**
   * Calcula métricas de puntos y cupones para un cliente
   * @param {string} clientId - ID del cliente
   * @returns {Promise<Object>} - Métricas de puntos y cupones
   * @private
   */
  async _calculateClientPointsAndCoupons(clientId) {
    try {
      // Obtener datos del cliente
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: {
          totalPoints: true,
          vipUntil: true
        }
      });

      // Puntos ganados en total
      const pointsEarned = await prisma.pointTransaction.aggregate({
        where: {
          userId: clientId,
          points: {
            gt: 0
          }
        },
        _sum: {
          points: true
        }
      });

      // Puntos gastados en total
      const pointsSpent = await prisma.pointTransaction.aggregate({
        where: {
          userId: clientId,
          points: {
            lt: 0
          }
        },
        _sum: {
          points: true
        }
      });

      // Cupones disponibles
      const availableCoupons = await prisma.userCoupon.count({
        where: {
          userId: clientId,
          isUsed: false,
          expiresAt: {
            gt: new Date()
          }
        }
      });

      // Cupones usados
      const usedCoupons = await prisma.userCoupon.count({
        where: {
          userId: clientId,
          isUsed: true
        }
      });

      // Status VIP
      const isVip = client.vipUntil ? client.vipUntil > new Date() : false;

      // Días restantes de VIP
      let vipDaysRemaining = 0;
      if (isVip && client.vipUntil) {
        const diffTime = Math.abs(client.vipUntil - new Date());
        vipDaysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      return {
        currentPoints: client.totalPoints || 0,
        pointsEarned: pointsEarned._sum.points || 0,
        pointsSpent: Math.abs(pointsSpent._sum.points || 0),
        availableCoupons,
        usedCoupons,
        isVip,
        vipDaysRemaining
      };
    } catch (error) {
      logger.error(`Error al calcular métricas de puntos de cliente: ${error.message}`, { error });
      return {
        currentPoints: 0,
        pointsEarned: 0,
        pointsSpent: 0,
        availableCoupons: 0,
        usedCoupons: 0,
        isVip: false,
        vipDaysRemaining: 0
      };
    }
  }

  /**
   * Calcula métricas de gastos para un cliente
   * @param {string} clientId - ID del cliente
   * @param {Date} startDate - Fecha de inicio
   * @param {Date} endDate - Fecha de fin
   * @returns {Promise<Object>} - Métricas de gastos
   * @private
   */
  async _calculateClientSpendingMetrics(clientId, startDate, endDate) {
    try {
      // Gastos totales
      const totalSpending = await prisma.payment.aggregate({
        where: {
          userId: clientId,
          status: 'completado'
        },
        _sum: {
          amount: true
        }
      });

      // Gastos en el periodo
      const periodSpending = await prisma.payment.aggregate({
        where: {
          userId: clientId,
          status: 'completado',
          completedAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: {
          amount: true
        }
      });

      // Gastos por tipo
      const spendingByType = await prisma.payment.groupBy({
        by: ['paymentType'],
        where: {
          userId: clientId,
          status: 'completado'
        },
        _sum: {
          amount: true
        }
      });

      // Transformar resultado a objeto
      const spendingByTypeObject = spendingByType.reduce((obj, item) => {
        obj[item.paymentType] = item._sum.amount;
        return obj;
      }, {});

      return {
        totalSpending: totalSpending._sum.amount || 0,
        periodSpending: periodSpending._sum.amount || 0,
        spendingByType: spendingByTypeObject
      };
    } catch (error) {
      logger.error(`Error al calcular métricas de gastos de cliente: ${error.message}`, { error });
      return {
        totalSpending: 0,
        periodSpending: 0,
        spendingByType: {}
      };
    }
  }

  /**
   * Calcula métricas de perfiles para un cliente
   * @param {string} clientId - ID del cliente
   * @returns {Promise<Object>} - Métricas de perfiles
   * @private
   */
  async _calculateClientProfilesMetrics(clientId) {
    try {
      // Obtener cliente
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: {
          favoriteProfiles: true
        }
      });

      let favoriteProfiles = [];
      if (client.favoriteProfiles && Array.isArray(client.favoriteProfiles)) {
        favoriteProfiles = await prisma.profile.findMany({
          where: {
            id: {
              in: client.favoriteProfiles
            }
          },
          select: {
            id: true,
            displayName: true,
            slug: true,
            gender: true,
            verificationStatus: true
          },
          take: 5
        });
      }

      // Perfiles más visitados
      const mostViewedProfiles = await prisma.profileView.groupBy({
        by: ['profileId'],
        where: {
          viewerId: clientId
        },
        _count: {
          viewerId: true
        },
        orderBy: {
          _count: {
            viewerId: 'desc'
          }
        },
        take: 5
      });

      // Obtener detalles de los perfiles más visitados
      const mostViewedProfilesDetails = await prisma.profile.findMany({
        where: {
          id: {
            in: mostViewedProfiles.map(p => p.profileId)
          }
        },
        select: {
          id: true,
          displayName: true,
          slug: true,
          gender: true,
          verificationStatus: true
        }
      });

      // Ordenar según el conteo original
      const sortedMostViewedProfiles = mostViewedProfiles.map(item => {
        const profile = mostViewedProfilesDetails.find(p => p.id === item.profileId);
        return {
          ...profile,
          viewCount: item._count.viewerId
        };
      });

      return {
        favoriteProfiles,
        mostViewedProfiles: sortedMostViewedProfiles
      };
    } catch (error) {
      logger.error(`Error al calcular métricas de perfiles de cliente: ${error.message}`, { error });
      return {
        favoriteProfiles: [],
        mostViewedProfiles: []
      };
    }
  }

  /**
   * Calcula rango de fechas según el periodo
   * @param {string} period - Periodo (daily, weekly, monthly)
   * @returns {Object} - Fechas de inicio y fin
   * @private
   */
  _getDateRangeForPeriod(period) {
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case 'daily':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'monthly':
      default:
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    return { startDate, endDate };
  }
}

module.exports = new MetricService();