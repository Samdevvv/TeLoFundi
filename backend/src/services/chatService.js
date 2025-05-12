// src/services/chatService.js
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class ChatService {
  /**
   * Obtiene o crea una conversación entre un cliente y un perfil
   * @param {string} clientId - ID del cliente
   * @param {string} profileId - ID del perfil
   * @returns {Promise<Object>} - Conversación
   */
  async getOrCreateConversation(clientId, profileId) {
    try {
      // Verificar que el cliente exista
      const client = await prisma.client.findUnique({
        where: { id: clientId }
      });
      
      if (!client) {
        throw new Error('Cliente no encontrado');
      }
      
      // Verificar que el perfil exista
      const profile = await prisma.profile.findUnique({
        where: { id: profileId }
      });
      
      if (!profile) {
        throw new Error('Perfil no encontrado');
      }
      
      // Buscar conversación existente
      let conversation = await prisma.conversation.findUnique({
        where: {
          clientId_profileId: {
            clientId,
            profileId
          }
        },
        include: {
          client: {
            select: {
              id: true,
              username: true,
              user: {
                select: {
                  profileImageUrl: true
                }
              }
            }
          },
          profile: {
            select: {
              id: true,
              displayName: true,
              slug: true,
              verificationStatus: true,
              agency: {
                select: {
                  id: true,
                  name: true,
                  slug: true
                }
              },
              user: {
                select: {
                  profileImageUrl: true,
                  lastLogin: true
                }
              }
            }
          },
          messages: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 20,
            select: {
              id: true,
              senderId: true,
              recipientId: true,
              content: true,
              contentType: true,
              status: true,
              createdAt: true,
              attachments: true
            }
          }
        }
      });
      
      // Si no existe, crear nueva conversación
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            clientId,
            profileId,
            isActive: true
          },
          include: {
            client: {
              select: {
                id: true,
                username: true,
                user: {
                  select: {
                    profileImageUrl: true
                  }
                }
              }
            },
            profile: {
              select: {
                id: true,
                displayName: true,
                slug: true,
                verificationStatus: true,
                agency: {
                  select: {
                    id: true,
                    name: true,
                    slug: true
                  }
                },
                user: {
                  select: {
                    profileImageUrl: true,
                    lastLogin: true
                  }
                }
              }
            },
            messages: {
              orderBy: {
                createdAt: 'desc'
              },
              take: 20,
              select: {
                id: true,
                senderId: true,
                recipientId: true,
                content: true,
                contentType: true,
                status: true,
                createdAt: true,
                attachments: true
              }
            }
          }
        });
      }
      
      // Ordenar mensajes (más recientes primero)
      conversation.messages = conversation.messages.sort((a, b) => 
        new Date(a.createdAt) - new Date(b.createdAt)
      );
      
      return conversation;
    } catch (error) {
      logger.error(`Error al obtener/crear conversación: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Obtiene una conversación por su ID
   * @param {string} conversationId - ID de la conversación
   * @param {string} userId - ID del usuario solicitante
   * @returns {Promise<Object>} - Conversación
   */
  async getConversation(conversationId, userId) {
    try {
      // Buscar conversación
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          client: {
            select: {
              id: true,
              username: true,
              user: {
                select: {
                  profileImageUrl: true
                }
              }
            }
          },
          profile: {
            select: {
              id: true,
              displayName: true,
              slug: true,
              verificationStatus: true,
              agency: {
                select: {
                  id: true,
                  name: true,
                  slug: true
                }
              },
              user: {
                select: {
                  profileImageUrl: true,
                  lastLogin: true
                }
              }
            }
          },
          messages: {
            orderBy: {
              createdAt: 'asc'
            },
            take: 50,
            select: {
              id: true,
              senderId: true,
              recipientId: true,
              content: true,
              contentType: true,
              status: true,
              createdAt: true,
              attachments: true
            }
          }
        }
      });
      
      if (!conversation) {
        throw new Error('Conversación no encontrada');
      }
      
      // Verificar que el usuario sea participante de la conversación
      if (conversation.clientId !== userId && conversation.profileId !== userId) {
        throw new Error('No autorizado para acceder a esta conversación');
      }
      
      // Marcar mensajes como leídos si es el destinatario
      if (userId === conversation.clientId) {
        await this.markMessagesAsRead(conversationId, userId);
      } else if (userId === conversation.profileId) {
        await this.markMessagesAsRead(conversationId, userId);
      }
      
      return conversation;
    } catch (error) {
      logger.error(`Error al obtener conversación: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Obtiene todas las conversaciones de un usuario
   * @param {string} userId - ID del usuario
   * @returns {Promise<Array>} - Conversaciones
   */
  async getUserConversations(userId) {
    try {
      // Determinar si el usuario es cliente o perfil
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });
      
      if (!user) {
        throw new Error('Usuario no encontrado');
      }
      
      // Buscar conversaciones según rol
      let conversations;
      if (user.role === 'cliente') {
        conversations = await prisma.conversation.findMany({
          where: {
            clientId: userId,
            isActive: true
          },
          orderBy: {
            lastMessageAt: 'desc'
          },
          include: {
            profile: {
              select: {
                id: true,
                displayName: true,
                slug: true,
                verificationStatus: true,
                user: {
                  select: {
                    profileImageUrl: true,
                    lastLogin: true
                  }
                }
              }
            },
            messages: {
              orderBy: {
                createdAt: 'desc'
              },
              take: 1,
              select: {
                content: true,
                createdAt: true,
                senderId: true
              }
            }
          }
        });
      } else if (user.role === 'perfil') {
        conversations = await prisma.conversation.findMany({
          where: {
            profileId: userId,
            isActive: true
          },
          orderBy: {
            lastMessageAt: 'desc'
          },
          include: {
            client: {
              select: {
                id: true,
                username: true,
                user: {
                  select: {
                    profileImageUrl: true
                  }
                }
              }
            },
            messages: {
              orderBy: {
                createdAt: 'desc'
              },
              take: 1,
              select: {
                content: true,
                createdAt: true,
                senderId: true
              }
            }
          }
        });
      } else {
        throw new Error('Tipo de usuario no válido para chat');
      }
      
      return conversations;
    } catch (error) {
      logger.error(`Error al obtener conversaciones: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Envía un mensaje en una conversación
   * @param {string} conversationId - ID de la conversación
   * @param {string} senderId - ID del remitente
   * @param {string} recipientId - ID del destinatario
   * @param {string} content - Contenido del mensaje
   * @param {Object} metadata - Metadatos adicionales
   * @returns {Promise<Object>} - Mensaje creado
   */
 // src/services/chatService.js (continuación)
  async sendMessage(conversationId, senderId, recipientId, content, metadata = {}) {
    try {
      // Verificar que la conversación exista
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          clientId: true,
          profileId: true,
          isActive: true,
          isBlocked: true
        }
      });
      
      if (!conversation) {
        throw new Error('Conversación no encontrada');
      }
      
      if (!conversation.isActive || conversation.isBlocked) {
        throw new Error('Esta conversación no está disponible');
      }
      
      // Verificar que el remitente sea participante de la conversación
      if (conversation.clientId !== senderId && conversation.profileId !== senderId) {
        throw new Error('No autorizado para enviar mensajes en esta conversación');
      }
      
      // Verificar que el destinatario sea participante de la conversación
      if (conversation.clientId !== recipientId && conversation.profileId !== recipientId) {
        throw new Error('Destinatario no válido para esta conversación');
      }
      
      // Crear mensaje
      const { contentType, attachments } = metadata;
      const message = await prisma.message.create({
        data: {
          conversationId,
          senderId,
          recipientId,
          content,
          contentType: contentType || 'text',
          attachments,
          status: 'enviado'
        }
      });
      
      // Actualizar conversación (esto se hace en un trigger)
      // La conversación se actualiza con la última actividad, contador de mensajes, etc.
      
      // Crear notificación para el destinatario
      await prisma.notification.create({
        data: {
          userId: recipientId,
          type: 'mensaje_nuevo',
          title: 'Nuevo mensaje',
          content: 'Has recibido un nuevo mensaje',
          referenceId: conversationId,
          referenceType: 'conversation',
          deepLink: `/chat/${conversationId}`,
          sendPush: true
        }
      });
      
      return message;
    } catch (error) {
      logger.error(`Error al enviar mensaje: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Marca los mensajes como leídos
   * @param {string} conversationId - ID de la conversación
   * @param {string} userId - ID del usuario que lee los mensajes
   * @returns {Promise<number>} - Número de mensajes actualizados
   */
  async markMessagesAsRead(conversationId, userId) {
    try {
      // Verificar que la conversación exista
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          clientId: true,
          profileId: true
        }
      });
      
      if (!conversation) {
        throw new Error('Conversación no encontrada');
      }
      
      // Verificar que el usuario sea participante de la conversación
      if (conversation.clientId !== userId && conversation.profileId !== userId) {
        throw new Error('No autorizado para marcar mensajes en esta conversación');
      }
      
      // Determinar qué tipo de usuario es (cliente o perfil)
      let isClient = false;
      if (conversation.clientId === userId) {
        isClient = true;
      }
      
      // Actualizar mensajes no leídos
      const result = await prisma.message.updateMany({
        where: {
          conversationId,
          recipientId: userId,
          status: { in: ['enviado', 'entregado'] }
        },
        data: {
          status: 'leido',
          readAt: new Date()
        }
      });
      
      // Actualizar contadores de no leídos en la conversación
      if (isClient) {
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { unreadClient: 0 }
        });
      } else {
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { unreadProfile: 0 }
        });
      }
      
      return result.count;
    } catch (error) {
      logger.error(`Error al marcar mensajes como leídos: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Bloquea o desbloquea una conversación
   * @param {string} conversationId - ID de la conversación
   * @param {string} userId - ID del usuario que realiza la acción
   * @param {boolean} block - true para bloquear, false para desbloquear
   * @returns {Promise<Object>} - Conversación actualizada
   */
  async toggleBlockConversation(conversationId, userId, block) {
    try {
      // Verificar que la conversación exista
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          clientId: true,
          profileId: true,
          isBlocked: true,
          blockedBy: true
        }
      });
      
      if (!conversation) {
        throw new Error('Conversación no encontrada');
      }
      
      // Verificar que el usuario sea participante de la conversación
      if (conversation.clientId !== userId && conversation.profileId !== userId) {
        throw new Error('No autorizado para gestionar esta conversación');
      }
      
      // Si ya está en el estado deseado, no hacer nada
      if (conversation.isBlocked === block) {
        return conversation;
      }
      
      // Actualizar conversación
      const updatedConversation = await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          isBlocked: block,
          blockedBy: block ? userId : null
        }
      });
      
      return updatedConversation;
    } catch (error) {
      logger.error(`Error al bloquear/desbloquear conversación: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Archiva o desarchiva una conversación
   * @param {string} conversationId - ID de la conversación
   * @param {string} userId - ID del usuario que realiza la acción
   * @param {boolean} archive - true para archivar, false para desarchivar
   * @returns {Promise<Object>} - Conversación actualizada
   */
  async toggleArchiveConversation(conversationId, userId, archive) {
    try {
      // Verificar que la conversación exista
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          clientId: true,
          profileId: true,
          isArchived: true
        }
      });
      
      if (!conversation) {
        throw new Error('Conversación no encontrada');
      }
      
      // Verificar que el usuario sea participante de la conversación
      if (conversation.clientId !== userId && conversation.profileId !== userId) {
        throw new Error('No autorizado para gestionar esta conversación');
      }
      
      // Si ya está en el estado deseado, no hacer nada
      if (conversation.isArchived === archive) {
        return conversation;
      }
      
      // Actualizar conversación
      const updatedConversation = await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          isArchived: archive
        }
      });
      
      return updatedConversation;
    } catch (error) {
      logger.error(`Error al archivar/desarchivar conversación: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Obtiene los mensajes no leídos del usuario
   * @param {string} userId - ID del usuario
   * @returns {Promise<Object>} - Contadores de mensajes no leídos
   */
  async getUnreadMessagesCount(userId) {
    try {
      // Determinar si el usuario es cliente o perfil
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });
      
      if (!user) {
        throw new Error('Usuario no encontrado');
      }
      
      // Consultar mensajes no leídos según rol
      let totalCount = 0;
      let conversationsWithUnread = [];
      
      if (user.role === 'cliente') {
        // Obtener conversaciones con mensajes no leídos para cliente
        const conversations = await prisma.conversation.findMany({
          where: {
            clientId: userId,
            isActive: true,
            unreadClient: { gt: 0 }
          },
          select: {
            id: true,
            unreadClient: true,
            profileId: true,
            profile: {
              select: {
                displayName: true,
                slug: true
              }
            }
          }
        });
        
        conversationsWithUnread = conversations;
        totalCount = conversations.reduce((sum, conv) => sum + conv.unreadClient, 0);
      } else if (user.role === 'perfil') {
        // Obtener conversaciones con mensajes no leídos para perfil
        const conversations = await prisma.conversation.findMany({
          where: {
            profileId: userId,
            isActive: true,
            unreadProfile: { gt: 0 }
          },
          select: {
            id: true,
            unreadProfile: true,
            clientId: true,
            client: {
              select: {
                username: true
              }
            }
          }
        });
        
        conversationsWithUnread = conversations;
        totalCount = conversations.reduce((sum, conv) => sum + conv.unreadProfile, 0);
      }
      
      return {
        totalCount,
        conversationsWithUnread
      };
    } catch (error) {
      logger.error(`Error al obtener mensajes no leídos: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Elimina un mensaje para un usuario
   * @param {string} messageId - ID del mensaje
   * @param {string} userId - ID del usuario
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async deleteMessage(messageId, userId) {
    try {
      // Verificar que el mensaje exista
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: {
          id: true,
          senderId: true,
          recipientId: true,
          conversationId: true,
          deletedBySender: true,
          deletedByRecipient: true
        }
      });
      
      if (!message) {
        throw new Error('Mensaje no encontrado');
      }
      
      // Verificar que el usuario sea participante del mensaje
      if (message.senderId !== userId && message.recipientId !== userId) {
        throw new Error('No autorizado para eliminar este mensaje');
      }
      
      // Determinar tipo de actualización
      let updateData = {};
      if (message.senderId === userId) {
        updateData.deletedBySender = true;
      } else {
        updateData.deletedByRecipient = true;
      }
      
      // Actualizar mensaje
      const updatedMessage = await prisma.message.update({
        where: { id: messageId },
        data: updateData
      });
      
      // Si el mensaje fue eliminado por ambos, establecer estado a 'eliminado'
      if (updatedMessage.deletedBySender && updatedMessage.deletedByRecipient) {
        await prisma.message.update({
          where: { id: messageId },
          data: { status: 'eliminado' }
        });
      }
      
      return { success: true, messageId };
    } catch (error) {
      logger.error(`Error al eliminar mensaje: ${error.message}`, { error });
      throw error;
    }
  }
}

module.exports = new ChatService();