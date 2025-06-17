const { prisma } = require('../config/database');
const logger = require('../utils/logger');

// Procesar mensaje antes de envío
const processMessageBeforeSend = async (senderId, receiverId, messageData) => {
  try {
    const { content, messageType, isPremiumMessage } = messageData;

    // Obtener datos del sender y receiver
    const [sender, receiver] = await Promise.all([
      prisma.user.findUnique({
        where: { id: senderId },
        include: {
          client: true,
          settings: true
        }
      }),
      prisma.user.findUnique({
        where: { id: receiverId },
        include: {
          settings: true,
          blockedUsers: {
            where: { blockedId: senderId }
          }
        }
      })
    ]);

    if (!sender || !receiver) {
      throw new Error('Usuario no encontrado');
    }

    // Verificaciones de seguridad y permisos
    const validationResult = await validateMessagePermissions(sender, receiver, messageData);
    if (!validationResult.canSend) {
      throw new Error(validationResult.reason);
    }

    // Calcular costo en puntos
    const pointsCost = calculateMessagePointsCost(sender, messageType, isPremiumMessage);

    // Filtrar contenido inapropiado
    const filteredContent = await filterMessageContent(content, sender.settings?.contentFilter);

    // Detectar spam
    const spamCheck = await detectSpamMessage(senderId, content);
    if (spamCheck.isSpam) {
      throw new Error('Mensaje detectado como spam');
    }

    return {
      processedMessage: {
        content: filteredContent,
        messageType,
        isPremiumMessage,
        costPoints: pointsCost
      },
      validations: validationResult,
      spamCheck
    };
  } catch (error) {
    logger.error('Error processing message before send:', error);
    throw error;
  }
};

// Validar permisos para enviar mensaje
const validateMessagePermissions = async (sender, receiver, messageData) => {
  const validations = {
    canSend: true,
    reasons: [],
    warnings: []
  };

  // Verificar si el receptor permite mensajes directos
  if (!receiver.settings?.allowDirectMessages) {
    validations.canSend = false;
    validations.reasons.push('El usuario no permite mensajes directos');
  }

  // Verificar si está bloqueado
  if (receiver.blockedUsers && receiver.blockedUsers.length > 0) {
    validations.canSend = false;
    validations.reasons.push('Has sido bloqueado por este usuario');
  }

  // Verificar límites de cliente
  if (sender.userType === 'CLIENT') {
    const clientLimits = await checkClientMessageLimits(sender);
    if (!clientLimits.canSend) {
      validations.canSend = false;
      validations.reasons.push(clientLimits.reason);
    }
    
    // Verificar capacidades según tier
    const tierValidation = validateClientTierCapabilities(sender.client, messageData);
    if (!tierValidation.canSend) {
      validations.canSend = false;
      validations.reasons.push(...tierValidation.reasons);
    }
  }

  // Verificar rate limiting
  const rateLimitCheck = await checkMessageRateLimit(sender.id);
  if (!rateLimitCheck.allowed) {
    validations.canSend = false;
    validations.reasons.push('Límite de velocidad excedido, espera un momento');
  }

  return {
    canSend: validations.canSend,
    reason: validations.reasons.join('. '),
    warnings: validations.warnings
  };
};

// Verificar límites de mensajes de cliente
const checkClientMessageLimits = async (user) => {
  if (user.userType !== 'CLIENT' || !user.client) {
    return { canSend: true };
  }

  const client = user.client;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Resetear contador si es nuevo día
  if (client.lastMessageReset < today) {
    await prisma.client.update({
      where: { id: client.id },
      data: {
        messagesUsedToday: 0,
        lastMessageReset: today
      }
    });
    client.messagesUsedToday = 0;
  }

  // Verificar límite diario
  const dailyLimit = client.premiumTier === 'VIP' ? Infinity : client.dailyMessageLimit;
  
  if (client.messagesUsedToday >= dailyLimit) {
    return {
      canSend: false,
      reason: `Límite diario de ${dailyLimit} mensajes alcanzado. Actualiza tu cuenta para enviar más.`,
      remainingMessages: 0
    };
  }

  return {
    canSend: true,
    remainingMessages: dailyLimit === Infinity ? 'unlimited' : dailyLimit - client.messagesUsedToday
  };
};

// Validar capacidades según tier de cliente
const validateClientTierCapabilities = (client, messageData) => {
  const validations = {
    canSend: true,
    reasons: []
  };

  if (!client) return validations;

  const { messageType, isPremiumMessage } = messageData;

  // Verificar capacidades según tier
  switch (messageType) {
    case 'IMAGE':
      if (!client.canSendImages) {
        validations.canSend = false;
        validations.reasons.push('Tu cuenta no permite enviar imágenes. Actualiza a Premium o VIP.');
      }
      break;
    
    case 'AUDIO':
      if (!client.canSendVoiceMessages) {
        validations.canSend = false;
        validations.reasons.push('Tu cuenta no permite enviar mensajes de voz. Actualiza a VIP.');
      }
      break;
  }

  // Verificar mensajes premium
  if (isPremiumMessage && client.premiumTier === 'BASIC') {
    validations.canSend = false;
    validations.reasons.push('Los mensajes premium requieren cuenta Premium o VIP.');
  }

  return validations;
};

// Calcular costo en puntos del mensaje
const calculateMessagePointsCost = (sender, messageType, isPremiumMessage) => {
  if (sender.userType !== 'CLIENT') return 0;

  let cost = 0;
  
  // Costo base según tipo
  switch (messageType) {
    case 'TEXT':
      cost = 1;
      break;
    case 'IMAGE':
      cost = 2;
      break;
    case 'AUDIO':
    case 'VIDEO':
      cost = 3;
      break;
    case 'FILE':
      cost = 2;
      break;
    default:
      cost = 1;
  }

  // Multiplicador por mensaje premium
  if (isPremiumMessage) {
    cost *= 5;
  }

  return cost;
};

// Filtrar contenido inapropiado
const filterMessageContent = async (content, filterLevel = 'MODERATE') => {
  try {
    if (!content || typeof content !== 'string') return content;

    // Lista de palabras prohibidas por nivel
    const filters = {
      NONE: [],
      MODERATE: [
        // Palabras básicas prohibidas
        'spam', 'scam', 'fraud'
      ],
      STRICT: [
        // Lista más extensa
        'spam', 'scam', 'fraud', 'fake', 'bot'
      ]
    };

    const prohibitedWords = filters[filterLevel] || filters.MODERATE;
    let filteredContent = content;

    // Aplicar filtros
    prohibitedWords.forEach(word => {
      const regex = new RegExp(word, 'gi');
      filteredContent = filteredContent.replace(regex, '*'.repeat(word.length));
    });

    // Detectar y filtrar URLs sospechosas
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = content.match(urlRegex);
    
    if (urls && filterLevel !== 'NONE') {
      // Por ahora solo loggear URLs, en producción podrías validar contra lista negra
      logger.info('URLs detected in message', { urls, filterLevel });
    }

    return filteredContent;
  } catch (error) {
    logger.error('Error filtering message content:', error);
    return content; // Retornar original si hay error
  }
};

// Detectar spam en mensajes
const detectSpamMessage = async (senderId, content) => {
  try {
    const spamIndicators = {
      isSpam: false,
      confidence: 0,
      reasons: []
    };

    // Verificar mensajes repetidos recientes
    const recentMessages = await prisma.message.findMany({
      where: {
        senderId,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Últimos 5 minutos
        }
      },
      select: { content: true }
    });

    // Detectar contenido repetido
    const duplicateCount = recentMessages.filter(msg => msg.content === content).length;
    if (duplicateCount >= 3) {
      spamIndicators.isSpam = true;
      spamIndicators.confidence += 0.8;
      spamIndicators.reasons.push('Contenido repetido múltiples veces');
    }

    // Detectar velocidad de envío alta
    if (recentMessages.length >= 10) {
      spamIndicators.confidence += 0.6;
      spamIndicators.reasons.push('Velocidad de envío muy alta');
    }

    // Detectar patrones de spam en contenido
    const spamPatterns = [
      /click here/i,
      /visit my website/i,
      /free money/i,
      /guaranteed/i,
      /\$\$\$/,
      /urgent/i
    ];

    const patternMatches = spamPatterns.filter(pattern => pattern.test(content)).length;
    if (patternMatches >= 2) {
      spamIndicators.confidence += 0.7;
      spamIndicators.reasons.push('Contiene patrones típicos de spam');
    }

    // Determinar si es spam basado en confianza
    if (spamIndicators.confidence >= 0.7) {
      spamIndicators.isSpam = true;
    }

    // Log de detección de spam
    if (spamIndicators.isSpam) {
      logger.warn('Spam message detected', {
        senderId,
        confidence: spamIndicators.confidence,
        reasons: spamIndicators.reasons,
        contentLength: content.length
      });
    }

    return spamIndicators;
  } catch (error) {
    logger.error('Error detecting spam message:', error);
    return { isSpam: false, confidence: 0, reasons: [] };
  }
};

// Verificar rate limiting para mensajes
const checkMessageRateLimit = async (userId) => {
  try {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    // Contar mensajes en el último minuto
    const recentMessageCount = await prisma.message.count({
      where: {
        senderId: userId,
        createdAt: { gte: oneMinuteAgo }
      }
    });

    // Límite: 10 mensajes por minuto
    const limit = 10;
    const allowed = recentMessageCount < limit;

    return {
      allowed,
      remaining: allowed ? limit - recentMessageCount : 0,
      resetAt: new Date(now.getTime() + 60 * 1000)
    };
  } catch (error) {
    logger.error('Error checking message rate limit:', error);
    return { allowed: true, remaining: 10, resetAt: new Date() };
  }
};

// Procesar mensaje después del envío
const processMessageAfterSend = async (messageId, senderId, receiverId) => {
  try {
    // Actualizar estadísticas del sender
    await updateUserMessageStats(senderId, 'sent');
    
    // Actualizar estadísticas del receiver
    await updateUserMessageStats(receiverId, 'received');
    
    // Registrar interacción para algoritmos
    await prisma.userInteraction.create({
      data: {
        userId: senderId,
        targetUserId: receiverId,
        type: 'CHAT',
        weight: 2.0
      }
    }).catch(() => {}); // Ignorar errores de duplicados

    // Actualizar última actividad del chat
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { chat: true }
    });

    if (message) {
      await prisma.chat.update({
        where: { id: message.chatId },
        data: { lastActivity: new Date() }
      });
    }

    logger.debug('Message processed after send', {
      messageId,
      senderId,
      receiverId
    });
  } catch (error) {
    logger.error('Error processing message after send:', error);
  }
};

// Actualizar estadísticas de mensajes del usuario
const updateUserMessageStats = async (userId, action) => {
  try {
    const updateData = {};
    
    if (action === 'sent') {
      updateData.totalMessages = { increment: 1 };
    }

    // Actualizar reputación
    await prisma.userReputation.update({
      where: { userId },
      data: updateData
    }).catch(() => {}); // Ignorar si no existe

    // Si es cliente, actualizar contadores específicos
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { userType: true }
    });

    if (user?.userType === 'CLIENT' && action === 'sent') {
      await prisma.client.update({
        where: { userId },
        data: {
          messagesUsedToday: { increment: 1 },
          totalMessagesUsed: { increment: 1 }
        }
      }).catch(() => {});
    }
  } catch (error) {
    logger.error('Error updating user message stats:', error);
  }
};

// Obtener estadísticas de chat
const getChatAnalytics = async (chatId, userId) => {
  try {
    // Verificar que el usuario es miembro del chat
    const membership = await prisma.chatMember.findUnique({
      where: {
        userId_chatId: {
          userId,
          chatId
        }
      }
    });

    if (!membership) {
      throw new Error('No tienes acceso a este chat');
    }

    const [
      totalMessages,
      messagesByType,
      messagesByMember,
      averageResponseTime,
      activityByHour,
      topEmojis
    ] = await Promise.all([
      // Total de mensajes
      prisma.message.count({
        where: {
          chatId,
          deletedAt: null
        }
      }),

      // Mensajes por tipo
      prisma.message.groupBy({
        by: ['messageType'],
        where: {
          chatId,
          deletedAt: null
        },
        _count: true
      }),

      // Mensajes por miembro
      prisma.message.groupBy({
        by: ['senderId'],
        where: {
          chatId,
          deletedAt: null
        },
        _count: true
      }),

      // Tiempo de respuesta promedio (simplificado)
      calculateAverageResponseTime(chatId),

      // Actividad por hora del día
      getActivityByHour(chatId),

      // Top emojis/reacciones (simulado)
      getTopEmojisInChat(chatId)
    ]);

    // Obtener información de miembros
    const members = await prisma.chatMember.findMany({
      where: { chatId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        }
      }
    });

    const memberMap = new Map(members.map(m => [m.userId, m.user]));

    return {
      overview: {
        totalMessages,
        totalMembers: members.length,
        averageResponseTime,
        chatAge: Math.floor((Date.now() - membership.joinedAt.getTime()) / (24 * 60 * 60 * 1000))
      },
      messages: {
        byType: messagesByType.reduce((acc, item) => {
          acc[item.messageType] = item._count;
          return acc;
        }, {}),
        byMember: messagesByMember.map(item => ({
          user: memberMap.get(item.senderId),
          count: item._count,
          percentage: ((item._count / totalMessages) * 100).toFixed(1)
        }))
      },
      activity: {
        byHour: activityByHour,
        topEmojis: topEmojis
      },
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error getting chat analytics:', error);
    throw error;
  }
};

// Calcular tiempo promedio de respuesta
const calculateAverageResponseTime = async (chatId) => {
  try {
    const messages = await prisma.message.findMany({
      where: {
        chatId,
        deletedAt: null
      },
      orderBy: { createdAt: 'asc' },
      select: {
        senderId: true,
        createdAt: true
      }
    });

    if (messages.length < 2) return 0;

    const responseTimes = [];
    
    for (let i = 1; i < messages.length; i++) {
      const current = messages[i];
      const previous = messages[i - 1];
      
      // Solo calcular si es respuesta (diferente sender)
      if (current.senderId !== previous.senderId) {
        const responseTime = current.createdAt.getTime() - previous.createdAt.getTime();
        responseTimes.push(responseTime);
      }
    }

    if (responseTimes.length === 0) return 0;

    const averageMs = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    return Math.round(averageMs / (1000 * 60)); // Convertir a minutos
  } catch (error) {
    logger.error('Error calculating average response time:', error);
    return 0;
  }
};

// Obtener actividad por hora del día
const getActivityByHour = async (chatId) => {
  try {
    const messages = await prisma.message.findMany({
      where: {
        chatId,
        deletedAt: null,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Últimos 30 días
        }
      },
      select: { createdAt: true }
    });

    const hourlyActivity = new Array(24).fill(0);
    
    messages.forEach(message => {
      const hour = message.createdAt.getHours();
      hourlyActivity[hour]++;
    });

    return hourlyActivity.map((count, hour) => ({
      hour,
      messages: count
    }));
  } catch (error) {
    logger.error('Error getting activity by hour:', error);
    return [];
  }
};

// Obtener top emojis en el chat (simulado)
const getTopEmojisInChat = async (chatId) => {
  try {
    // En una implementación real, buscarías emojis en el contenido de mensajes
    const messages = await prisma.message.findMany({
      where: {
        chatId,
        messageType: 'TEXT',
        deletedAt: null
      },
      select: { content: true }
    });

    // Regex simple para emojis (esto se puede mejorar)
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu;
    const emojiCount = {};

    messages.forEach(message => {
      const emojis = message.content.match(emojiRegex);
      if (emojis) {
        emojis.forEach(emoji => {
          emojiCount[emoji] = (emojiCount[emoji] || 0) + 1;
        });
      }
    });

    return Object.entries(emojiCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([emoji, count]) => ({ emoji, count }));
  } catch (error) {
    logger.error('Error getting top emojis:', error);
    return [];
  }
};

// Limpiar chats inactivos
const cleanupInactiveChats = async (daysInactive = 90) => {
  try {
    const cutoffDate = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000);

    // Marcar chats como archivados si no tienen actividad reciente
    const result = await prisma.chat.updateMany({
      where: {
        lastActivity: { lt: cutoffDate },
        isArchived: false,
        deletedAt: null
      },
      data: {
        isArchived: true
      }
    });

    logger.info('Inactive chats cleaned up', {
      archivedChats: result.count,
      daysInactive,
      cutoffDate
    });

    return result.count;
  } catch (error) {
    logger.error('Error cleaning up inactive chats:', error);
    throw error;
  }
};

module.exports = {
  processMessageBeforeSend,
  processMessageAfterSend,
  validateMessagePermissions,
  checkClientMessageLimits,
  calculateMessagePointsCost,
  filterMessageContent,
  detectSpamMessage,
  checkMessageRateLimit,
  getChatAnalytics,
  cleanupInactiveChats,
  updateUserMessageStats
};