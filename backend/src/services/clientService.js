// src/services/clientService.js
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * Servicio para gestionar operaciones de clientes
 */
class ClientService {
  /**
   * Obtiene un cliente por su ID
   * @param {string} clientId - ID del cliente
   * @returns {Promise<Object>} - Cliente encontrado
   */
  async getClientById(clientId) {
    try {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        include: {
          user: {
            select: {
              email: true,
              isVip: true,
              vipLevel: true,
              profileImageUrl: true,
              createdAt: true,
              lastLogin: true
            }
          }
        }
      });

      if (!client) {
        throw new Error('Cliente no encontrado');
      }

      return client;
    } catch (error) {
      logger.error(`Error al obtener cliente: ${error.message}`, { error });
      throw new Error(`Error al obtener cliente: ${error.message}`);
    }
  }

  /**
   * Actualiza los datos de un cliente
   * @param {string} clientId - ID del cliente
   * @param {Object} clientData - Datos a actualizar
   * @returns {Promise<Object>} - Cliente actualizado
   */
  async updateClient(clientId, clientData) {
    try {
      // Verificar que el cliente existe
      const existingClient = await prisma.client.findUnique({
        where: { id: clientId }
      });

      if (!existingClient) {
        throw new Error('Cliente no encontrado');
      }

      // Extraer datos para tabla de usuario y de cliente
      const { username, preferences, ...userData } = clientData;

      // Iniciar transacción
      const updatedClient = await prisma.$transaction(async (tx) => {
        // Actualizar datos de usuario si hay
        if (Object.keys(userData).length > 0) {
          await tx.user.update({
            where: { id: clientId },
            data: userData
          });
        }

        // Actualizar datos de cliente
        const clientUpdate = await tx.client.update({
          where: { id: clientId },
          data: {
            ...(username !== undefined && { username }),
            ...(preferences !== undefined && { preferences })
          },
          include: {
            user: {
              select: {
                email: true,
                isVip: true,
                vipLevel: true,
                profileImageUrl: true
              }
            }
          }
        });

        return clientUpdate;
      });

      return updatedClient;
    } catch (error) {
      logger.error(`Error al actualizar cliente: ${error.message}`, { error });
      throw new Error(`Error al actualizar cliente: ${error.message}`);
    }
  }

  /**
   * Agrega o elimina un perfil de los favoritos del cliente
   * @param {string} clientId - ID del cliente
   * @param {string} profileId - ID del perfil
   * @param {boolean} add - Agregar (true) o eliminar (false)
   * @returns {Promise<Object>} - Cliente actualizado
   */
  async toggleFavoriteProfile(clientId, profileId, add = true) {
    try {
      // Verificar que el cliente existe
      const client = await prisma.client.findUnique({
        where: { id: clientId }
      });

      if (!client) {
        throw new Error('Cliente no encontrado');
      }

      // Verificar que el perfil existe
      const profile = await prisma.profile.findUnique({
        where: { id: profileId }
      });

      if (!profile) {
        throw new Error('Perfil no encontrado');
      }

      // Preparar el array de favoritos
      let favoriteProfiles = client.favoriteProfiles || [];
      
      // Convertir a array si no lo es (por si acaso)
      if (!Array.isArray(favoriteProfiles)) {
        favoriteProfiles = [];
      }

      if (add) {
        // Agregar perfil solo si no existe ya
        if (!favoriteProfiles.includes(profileId)) {
          favoriteProfiles.push(profileId);
        }
      } else {
        // Eliminar perfil
        favoriteProfiles = favoriteProfiles.filter(id => id !== profileId);
      }

      // Actualizar cliente
      const updatedClient = await prisma.client.update({
        where: { id: clientId },
        data: {
          favoriteProfiles
        }
      });

      // Si se agrega a favoritos, incrementar contador en el perfil
      if (add) {
        await prisma.profile.update({
          where: { id: profileId },
          data: {
            totalFavorites: {
              increment: 1
            }
          }
        });
      } else {
        // Si se elimina, decrementar contador si es mayor que 0
        await prisma.profile.updateMany({
          where: { 
            id: profileId,
            totalFavorites: { gt: 0 }
          },
          data: {
            totalFavorites: {
              decrement: 1
            }
          }
        });
      }

      return updatedClient;
    } catch (error) {
      logger.error(`Error al gestionar favorito: ${error.message}`, { error });
      throw new Error(`Error al gestionar favorito: ${error.message}`);
    }
  }

  /**
   * Obtiene los perfiles favoritos del cliente
   * @param {string} clientId - ID del cliente
   * @param {Object} options - Opciones de paginación
   * @returns {Promise<Object>} - Perfiles favoritos paginados
   */
  async getFavoriteProfiles(clientId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10
      } = options;

      // Verificar que el cliente existe
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { favoriteProfiles: true }
      });

      if (!client) {
        throw new Error('Cliente no encontrado');
      }

      // Si no hay favoritos, retornar lista vacía
      if (!client.favoriteProfiles || client.favoriteProfiles.length === 0) {
        return {
          profiles: [],
          pagination: {
            total: 0,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: 0
          }
        };
      }

      // Calcular paginación
      const skip = (page - 1) * limit;
      const take = parseInt(limit);
      
      // Asegurar que favoriteProfiles es un array
      const favoriteIds = Array.isArray(client.favoriteProfiles) 
        ? client.favoriteProfiles 
        : [];

      // Obtener perfiles favoritos
      const profiles = await prisma.profile.findMany({
        where: {
          id: {
            in: favoriteIds
          }
        },
        select: {
          id: true,
          displayName: true,
          slug: true,
          gender: true,
          age: true,
          description: true,
          shortDescription: true,
          verificationStatus: true,
          location: true,
          priceHour: true,
          currency: true,
          availabilityStatus: true,
          isFeatured: true,
          images: {
            where: {
              isMain: true
            },
            select: {
              imageUrl: true,
              thumbnailUrl: true,
              isApproved: true
            },
            take: 1
          },
          agency: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        },
        skip,
        take,
        orderBy: [
          { isFeatured: 'desc' },
          { verificationStatus: 'desc' },
          { totalViews: 'desc' }
        ]
      });

      const total = favoriteIds.length;

      return {
        profiles,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`Error al obtener favoritos: ${error.message}`, { error });
      throw new Error(`Error al obtener favoritos: ${error.message}`);
    }
  }

  /**
   * Agrega o elimina un perfil de los bloqueados del cliente
   * @param {string} clientId - ID del cliente
   * @param {string} profileId - ID del perfil
   * @param {boolean} block - Bloquear (true) o desbloquear (false)
   * @returns {Promise<Object>} - Cliente actualizado
   */
  async toggleBlockedProfile(clientId, profileId, block = true) {
    try {
      // Verificar que el cliente existe
      const client = await prisma.client.findUnique({
        where: { id: clientId }
      });

      if (!client) {
        throw new Error('Cliente no encontrado');
      }

      // Verificar que el perfil existe
      const profile = await prisma.profile.findUnique({
        where: { id: profileId }
      });

      if (!profile) {
        throw new Error('Perfil no encontrado');
      }

      // Preparar el array de bloqueados
      let blockedProfiles = client.blockedProfiles || [];
      
      // Convertir a array si no lo es (por si acaso)
      if (!Array.isArray(blockedProfiles)) {
        blockedProfiles = [];
      }

      if (block) {
        // Bloquear perfil solo si no está ya bloqueado
        if (!blockedProfiles.includes(profileId)) {
          blockedProfiles.push(profileId);
        }
      } else {
        // Desbloquear perfil
        blockedProfiles = blockedProfiles.filter(id => id !== profileId);
      }

      // Actualizar cliente
      const updatedClient = await prisma.client.update({
        where: { id: clientId },
        data: {
          blockedProfiles
        }
      });

      // Si se bloquea, también eliminar de favoritos si existe
      if (block && client.favoriteProfiles && Array.isArray(client.favoriteProfiles)) {
        if (client.favoriteProfiles.includes(profileId)) {
          await this.toggleFavoriteProfile(clientId, profileId, false);
        }
      }

      return updatedClient;
    } catch (error) {
      logger.error(`Error al gestionar bloqueo: ${error.message}`, { error });
      throw new Error(`Error al gestionar bloqueo: ${error.message}`);
    }
  }

  /**
   * Obtiene el historial de contactos del cliente
   * @param {string} clientId - ID del cliente
   * @param {Object} options - Opciones de paginación y filtrado
   * @returns {Promise<Object>} - Historial de contactos paginado
   */
  async getContactHistory(clientId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        profileId,
        contactMethod,
        startDate,
        endDate,
        orderBy = 'desc'
      } = options;

      // Verificar que el cliente existe
      const client = await prisma.client.findUnique({
        where: { id: clientId }
      });

      if (!client) {
        throw new Error('Cliente no encontrado');
      }

      // Preparar filtros
      const where = {
        clientId,
        ...(profileId && { profileId }),
        ...(contactMethod && { contactMethod }),
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

      // Calcular paginación
      const skip = (page - 1) * limit;
      const take = parseInt(limit);

      // Obtener contactos
      const contacts = await prisma.profileContact.findMany({
        where,
        include: {
          profile: {
            select: {
              displayName: true,
              slug: true,
              gender: true,
              images: {
                where: {
                  isMain: true
                },
                select: {
                  thumbnailUrl: true
                },
                take: 1
              }
            }
          }
        },
        skip,
        take,
        orderBy: {
          createdAt: orderBy.toLowerCase() === 'asc' ? 'asc' : 'desc'
        }
      });

      // Contar total
      const total = await prisma.profileContact.count({ where });

      return {
        contacts,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`Error al obtener historial de contactos: ${error.message}`, { error });
      throw new Error(`Error al obtener historial de contactos: ${error.message}`);
    }
  }

  /**
   * Registra un contacto con un perfil
   * @param {string} clientId - ID del cliente
   * @param {string} profileId - ID del perfil
   * @param {string} contactMethod - Método de contacto
   * @param {string} contactData - Datos de contacto
   * @param {Object} metadata - Metadatos adicionales
   * @returns {Promise<Object>} - Contacto registrado
   */
  async registerProfileContact(clientId, profileId, contactMethod, contactData, metadata = {}) {
    try {
      // Verificar que el cliente existe
      const client = await prisma.client.findUnique({
        where: { id: clientId }
      });

      if (!client) {
        throw new Error('Cliente no encontrado');
      }

      // Verificar que el perfil existe
      const profile = await prisma.profile.findUnique({
        where: { id: profileId }
      });

      if (!profile) {
        throw new Error('Perfil no encontrado');
      }

      // Verificar si el perfil está bloqueado por el cliente
      if (client.blockedProfiles && Array.isArray(client.blockedProfiles)) {
        if (client.blockedProfiles.includes(profileId)) {
          throw new Error('No puedes contactar a este perfil porque lo has bloqueado');
        }
      }

      // Iniciar transacción
      const result = await prisma.$transaction(async (tx) => {
        // Registrar contacto
        const contact = await tx.profileContact.create({
          data: {
            clientId,
            profileId,
            contactMethod,
            contactData,
            initiatedBy: metadata.initiatedBy || clientId,
            notes: metadata.notes,
            location: metadata.location,
            deviceInfo: metadata.deviceInfo
          }
        });

        // Actualizar contadores
        await tx.client.update({
          where: { id: clientId },
          data: {
            totalContacts: {
              increment: 1
            }
          }
        });

        await tx.profile.update({
          where: { id: profileId },
          data: {
            totalContacts: {
              increment: 1
            }
          }
        });

        // Otorgar puntos por contacto si es la primera vez en el día
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existingContact = await tx.profileContact.findFirst({
          where: {
            clientId,
            profileId,
            createdAt: {
              gte: today
            },
            pointsAwarded: true
          }
        });

        if (!existingContact) {
          // Obtener configuración del sistema
          const settings = await tx.systemSetting.findFirst();
          const pointsToAward = settings?.pointsForContact || 10;

          // Otorgar puntos
          if (pointsToAward > 0) {
            const pointTransaction = await tx.pointTransaction.create({
              data: {
                userId: clientId,
                action: 'contacto_perfil',
                points: pointsToAward,
                referenceId: profileId,
                referenceType: 'profile',
                description: `Puntos por contactar a ${profile.displayName}`
              }
            });

            // Actualizar puntos totales
            await tx.client.update({
              where: { id: clientId },
              data: {
                totalPoints: {
                  increment: pointsToAward
                }
              }
            });

            // Registrar historial de puntos
            await tx.pointBalanceHistory.create({
              data: {
                userId: clientId,
                previousBalance: client.totalPoints,
                newBalance: client.totalPoints + pointsToAward,
                transactionId: pointTransaction.id
              }
            });

            // Marcar contacto con puntos otorgados
            await tx.profileContact.update({
              where: { id: contact.id },
              data: {
                pointsAwarded: true,
                pointsTransactionId: pointTransaction.id
              }
            });
          }
        }

        return contact;
      });

      return result;
    } catch (error) {
      logger.error(`Error al registrar contacto: ${error.message}`, { error });
      throw new Error(`Error al registrar contacto: ${error.message}`);
    }
  }

  /**
   * Genera un código de referido único
   * @param {string} clientId - ID del cliente
   * @returns {Promise<string>} - Código generado
   */
  async generateReferralCode(clientId) {
    try {
      // Verificar que el cliente existe
      const client = await prisma.client.findUnique({
        where: { id: clientId }
      });

      if (!client) {
        throw new Error('Cliente no encontrado');
      }

      // Si ya tiene código, retornarlo
      if (client.referralCode) {
        return client.referralCode;
      }

      // Generar código único
      let referralCode;
      let isUnique = false;
      
      while (!isUnique) {
        // Generar código aleatorio de 8 caracteres
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        referralCode = `REF-${code}`;

        // Verificar si es único
        const existingCode = await prisma.client.findFirst({
          where: {
            referralCode
          }
        });

        if (!existingCode) {
          isUnique = true;
        }
      }

      // Guardar y retornar código
      await prisma.client.update({
        where: { id: clientId },
        data: {
          referralCode
        }
      });

      return referralCode;
    } catch (error) {
      logger.error(`Error al generar código de referido: ${error.message}`, { error });
      throw new Error(`Error al generar código de referido: ${error.message}`);
    }
  }

  /**
   * Procesa un referido
   * @param {string} referrerCode - Código de referido
   * @param {string} referredId - ID del cliente referido
   * @returns {Promise<Object>} - Resultado del procesamiento
   */
  async processReferral(referrerCode, referredId) {
    try {
      // Verificar que el referido existe
      const referred = await prisma.client.findUnique({
        where: { id: referredId }
      });

      if (!referred) {
        throw new Error('Cliente referido no encontrado');
      }

      // Si ya tiene un referente, no procesar
      if (referred.referredBy) {
        throw new Error('Este cliente ya fue referido anteriormente');
      }

      // Buscar referente por código
      const referrer = await prisma.client.findFirst({
        where: {
          referralCode: referrerCode
        }
      });

      if (!referrer) {
        throw new Error('Código de referido inválido');
      }

      // Evitar auto-referidos
      if (referrer.id === referredId) {
        throw new Error('No puedes referirte a ti mismo');
      }

      // Iniciar transacción
      const result = await prisma.$transaction(async (tx) => {
        // Actualizar cliente referido
        await tx.client.update({
          where: { id: referredId },
          data: {
            referredBy: referrer.id
          }
        });

        // Obtener configuración del sistema
        const settings = await tx.systemSetting.findFirst();
        const pointsToAward = settings?.pointsForReferral || 25;

        // Otorgar puntos al referente
        if (pointsToAward > 0) {
          const pointTransaction = await tx.pointTransaction.create({
            data: {
              userId: referrer.id,
              action: 'referido',
              points: pointsToAward,
              referenceId: referredId,
              referenceType: 'referral',
              description: `Puntos por referir a otro usuario`
            }
          });

          // Actualizar puntos totales
          await tx.client.update({
            where: { id: referrer.id },
            data: {
              totalPoints: {
                increment: pointsToAward
              }
            }
          });

          // Registrar historial de puntos
          await tx.pointBalanceHistory.create({
            data: {
              userId: referrer.id,
              previousBalance: referrer.totalPoints,
              newBalance: referrer.totalPoints + pointsToAward,
              transactionId: pointTransaction.id
            }
          });
        }

        return {
          success: true,
          referrerId: referrer.id,
          referredId,
          pointsAwarded: pointsToAward
        };
      });

      return result;
    } catch (error) {
      logger.error(`Error al procesar referido: ${error.message}`, { error });
      throw new Error(`Error al procesar referido: ${error.message}`);
    }
  }

  /**
   * Obtiene las preferencias de un cliente
   * @param {string} clientId - ID del cliente
   * @returns {Promise<Object>} - Preferencias del cliente
   */
  async getClientPreferences(clientId) {
    try {
      // Verificar que el cliente existe
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { preferences: true }
      });

      if (!client) {
        throw new Error('Cliente no encontrado');
      }

      return client.preferences || {};
    } catch (error) {
      logger.error(`Error al obtener preferencias: ${error.message}`, { error });
      throw new Error(`Error al obtener preferencias: ${error.message}`);
    }
  }

  /**
   * Actualiza las preferencias de un cliente
   * @param {string} clientId - ID del cliente
   * @param {Object} preferences - Nuevas preferencias
   * @returns {Promise<Object>} - Preferencias actualizadas
   */
  async updateClientPreferences(clientId, preferences) {
    try {
      // Verificar que el cliente existe
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { preferences: true }
      });

      if (!client) {
        throw new Error('Cliente no encontrado');
      }

      // Combinar preferencias existentes con nuevas
      const updatedPreferences = {
        ...(client.preferences || {}),
        ...preferences
      };

      // Actualizar cliente
      const updatedClient = await prisma.client.update({
        where: { id: clientId },
        data: {
          preferences: updatedPreferences
        },
        select: {
          preferences: true
        }
      });

      return updatedClient.preferences;
    } catch (error) {
      logger.error(`Error al actualizar preferencias: ${error.message}`, { error });
      throw new Error(`Error al actualizar preferencias: ${error.message}`);
    }
  }
}

module.exports = new ClientService();