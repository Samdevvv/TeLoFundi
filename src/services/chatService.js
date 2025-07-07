const { prisma } = require('../config/database');
const logger = require('../utils/logger');

// ✅ NUEVO: Validador específico para chat tripartito
const validateDisputeChatAccess = async (userId, chatId) => {
  try {
    const chatMember = await prisma.chatMember.findUnique({
      where: {
        userId_chatId: {
          userId,
          chatId
        }
      },
      include: {
        chat: {
          select: {
            isDisputeChat: true,
            disputeStatus: true,
            disputeReason: true
          }
        }
      }
    });

    if (!chatMember) {
      return { hasAccess: false, error: 'No eres miembro de este chat de disputa' };
    }

    if (!chatMember.chat.isDisputeChat) {
      return { hasAccess: false, error: 'Este no es un chat de disputa' };
    }

    if (chatMember.chat.disputeStatus !== 'ACTIVE') {
      return { 
        hasAccess: false, 
        error: 'Este chat de disputa está cerrado',
        status: chatMember.chat.disputeStatus
      };
    }

    return {
      hasAccess: true,
      member: chatMember,
      disputeInfo: {
        status: chatMember.chat.disputeStatus,
        reason: chatMember.chat.disputeReason,
        remainingMessages: chatMember.maxMessages - chatMember.messageCount
      }
    };
  } catch (error) {
    logger.error('Error validating dispute chat access:', error);
    return { hasAccess: false, error: 'Error validando acceso al chat de disputa' };
  }
};

// ✅ NUEVO: Crear notificación para chat tripartito
const createDisputeNotification = async (chatId, userIds, type, message) => {
  try {
    const notifications = userIds.map(userId => ({
      userId,
      title: 'Chat de Disputa',
      message,
      type: 'SYSTEM',
      priority: 'HIGH',
      data: {
        chatId,
        disputeType: type,
        actionRequired: true
      }
    }));

    await prisma.notification.createMany({
      data: notifications
    });

    logger.info('Dispute notifications created', {
      chatId,
      userIds,
      type,
      count: notifications.length
    });
  } catch (error) {
    logger.error('Error creating dispute notifications:', error);
  }
};

// ✅ NUEVO: Obtener información completa de chat tripartito
const getDisputeChatInfo = async (chatId, userId) => {
  try {
    const chat = await prisma.chat.findUnique({
      where: {
        id: chatId,
        isDisputeChat: true
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                userType: true,
                avatar: true
              }
            }
          }
        },
        messages: {
          where: {
            deletedAt: null
          },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                userType: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!chat) {
      return { chat: null, error: 'Chat de disputa no encontrado' };
    }

    // Verificar que el usuario es miembro
    const userMember = chat.members.find(member => member.userId === userId);
    if (!userMember) {
      return { chat: null, error: 'No tienes acceso a este chat de disputa' };
    }

    // Separar miembros por tipo
    const admin = chat.members.find(m => m.user.userType === 'ADMIN');
    const escort = chat.members.find(m => m.user.userType === 'ESCORT');
    const agency = chat.members.find(m => m.user.userType === 'AGENCY');

    return {
      chat: {
        ...chat,
        participantes: {
          admin: admin?.user || null,
          escort: escort?.user || null,
          agency: agency?.user || null
        },
        userInfo: {
          remainingMessages: userMember.maxMessages - userMember.messageCount,
          messageCount: userMember.messageCount,
          maxMessages: userMember.maxMessages,
          canSendMessages: userMember.messageCount < userMember.maxMessages || userMember.user.userType === 'ADMIN'
        }
      }
    };
  } catch (error) {
    logger.error('Error getting dispute chat info:', error);
    return { chat: null, error: 'Error obteniendo información del chat de disputa' };
  }
};

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

  // ✅ MEJORADO: Verificar límites de cliente con validación robusta
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

// ✅ MEJORADO: Verificar límites de mensajes de cliente
const checkClientMessageLimits = async (user) => {
  if (user.userType !== 'CLIENT' || !user.client) {
    return { canSend: true };
  }

  const client = user.client;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Resetear contador si es nuevo día
  if (!client.lastMessageReset || client.lastMessageReset < today) {
    await prisma.client.update({
      where: { id: client.id },
      data: {
        messagesUsedToday: 0,
        lastMessageReset: today
      }
    });
    client.messagesUsedToday = 0;
  }

  // ✅ CORREGIDO: Verificar límite diario según tier
  let dailyLimit = client.dailyMessageLimit || 5; // 5 mensajes para BASIC
  
  // Premium y VIP tienen mensajes ilimitados
  if (client.isPremium || ['PREMIUM', 'VIP'].includes(client.premiumTier)) {
    dailyLimit = -1; // Ilimitado
  }
  
  if (dailyLimit !== -1 && client.messagesUsedToday >= dailyLimit) {
    return {
      canSend: false,
      reason: `Límite diario de ${dailyLimit} mensajes alcanzado. Actualiza tu cuenta para enviar más.`,
      remainingMessages: 0,
      currentTier: client.premiumTier
    };
  }

  return {
    canSend: true,
    remainingMessages: dailyLimit === -1 ? 'unlimited' : dailyLimit - client.messagesUsedToday,
    currentTier: client.premiumTier
  };
};

// ✅ MEJORADO: Validar capacidades según tier de cliente
const validateClientTierCapabilities = (client, messageData) => {
  const validations = {
    canSend: true,
    reasons: []
  };

  if (!client) return validations;

  const { messageType, isPremiumMessage } = messageData;

  // ✅ CORREGIDO: Verificar capacidades según tier
  switch (messageType) {
    case 'IMAGE':
      if (!client.canSendImages && !client.isPremium && client.premiumTier === 'BASIC') {
        validations.canSend = false;
        validations.reasons.push('Tu cuenta no permite enviar imágenes. Actualiza a Premium o VIP.');
      }
      break;
    
    case 'AUDIO':
      if (!client.canSendVoiceMessages && client.premiumTier !== 'VIP') {
        validations.canSend = false;
        validations.reasons.push('Los mensajes de voz requieren cuenta VIP.');
      }
      break;

    case 'VIDEO':
      if (client.premiumTier !== 'VIP') {
        validations.canSend = false;
        validations.reasons.push('Los mensajes de video requieren cuenta VIP.');
      }
      break;

    case 'FILE':
      if (!client.isPremium && client.premiumTier === 'BASIC') {
        validations.canSend = false;
        validations.reasons.push('El envío de archivos requiere cuenta Premium o VIP.');
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

// ✅ MEJORADO: Calcular costo en puntos del mensaje
const calculateMessagePointsCost = (sender, messageType, isPremiumMessage) => {
  if (sender.userType !== 'CLIENT') return 0;

  // ✅ CORREGIDO: Solo cobrar puntos a clientes básicos
  if (sender.client?.isPremium || ['PREMIUM', 'VIP'].includes(sender.client?.premiumTier)) {
    return 0; // Clientes premium no pagan puntos por mensajes
  }

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
      cost = 4;
      break;
    case 'FILE':
      cost = 3;
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
        'spam', 'scam', 'fraud', 'fake', 'bot'
      ],
      STRICT: [
        // Lista más extensa
        'spam', 'scam', 'fraud', 'fake', 'bot', 'virus', 'hack', 'cheat'
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

// ✅ MEJORADO: Detectar spam en mensajes
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
      select: { content: true, createdAt: true }
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

    // ✅ MEJORADO: Detectar patrones de spam en contenido
    const spamPatterns = [
      /click here/i,
      /visit my website/i,
      /free money/i,
      /guaranteed/i,
      /\$\$\$/,
      /urgent/i,
      /limited time/i,
      /act now/i,
      /whatsapp me/i,
      /telegram/i
    ];

    const patternMatches = spamPatterns.filter(pattern => pattern.test(content)).length;
    if (patternMatches >= 2) {
      spamIndicators.confidence += 0.7;
      spamIndicators.reasons.push('Contiene patrones típicos de spam');
    }

    // ✅ NUEVO: Detectar exceso de emojis o caracteres especiales
    const emojiCount = (content.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu) || []).length;
    const specialCharCount = (content.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/g) || []).length;
    
    if (emojiCount > 10 || specialCharCount > content.length * 0.3) {
      spamIndicators.confidence += 0.4;
      spamIndicators.reasons.push('Exceso de emojis o caracteres especiales');
    }

    // ✅ NUEVO: Detectar longitud sospechosa
    if (content.length > 2000) {
      spamIndicators.confidence += 0.3;
      spamIndicators.reasons.push('Mensaje excesivamente largo');
    }

    // Determinar si es spam basado en confianza
    if (spamIndicators.confidence >= 0.7) {
      spamIndicators.isSpam = true;
    }

    // Log de detección de spam
    if (spamIndicators.isSpam || spamIndicators.confidence > 0.5) {
      logger.warn('Potential spam message detected', {
        senderId,
        confidence: spamIndicators.confidence,
        reasons: spamIndicators.reasons,
        contentLength: content.length,
        isSpam: spamIndicators.isSpam
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

    // ✅ MEJORADO: Límites según tipo de usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { userType: true, client: { select: { premiumTier: true } } }
    });

    let limit = 10; // Default: 10 mensajes por minuto

    if (user?.userType === 'CLIENT') {
      if (user.client?.premiumTier === 'VIP') {
        limit = 30; // VIP: 30 mensajes por minuto
      } else if (user.client?.premiumTier === 'PREMIUM') {
        limit = 20; // Premium: 20 mensajes por minuto
      } else {
        limit = 5; // Basic: 5 mensajes por minuto
      }
    } else if (['ESCORT', 'AGENCY', 'ADMIN'].includes(user?.userType)) {
      limit = 25; // Sin restricciones severas para profesionales
    }

    const allowed = recentMessageCount < limit;

    return {
      allowed,
      remaining: allowed ? limit - recentMessageCount : 0,
      resetAt: new Date(now.getTime() + 60 * 1000),
      limit,
      used: recentMessageCount
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
    
    // ✅ MEJORADO: Registrar interacción para algoritmos
    await prisma.userInteraction.create({
      data: {
        userId: senderId,
        targetUserId: receiverId,
        type: 'CHAT',
        weight: 2.0,
        source: 'chat',
        deviceType: 'unknown' // Podría mejorarse con datos del request
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

// ✅ MEJORADO: Actualizar estadísticas de mensajes del usuario
const updateUserMessageStats = async (userId, action) => {
  try {
    const updateData = {};
    
    if (action === 'sent') {
      updateData.totalMessages = { increment: 1 };
    }

    // Actualizar reputación
    await prisma.userReputation.upsert({
      where: { userId },
      update: {
        ...updateData,
        lastScoreUpdate: new Date()
      },
      create: {
        userId,
        overallScore: 0,
        responseRate: 0,
        averageResponseTime: null,
        profileCompleteness: 0,
        trustScore: 0,
        totalViews: 0,
        totalLikes: 0,
        totalMessages: action === 'sent' ? 1 : 0,
        totalFavorites: 0,
        discoveryScore: 0,
        trendingScore: 0,
        qualityScore: 0,
        spamScore: 0,
        reportScore: 0,
        lastScoreUpdate: new Date()
      }
    }).catch(() => {}); // Ignorar si no se puede crear/actualizar

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

// Obtener top emojis en el chat
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

    // Regex mejorado para emojis
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
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

// ✅ NUEVO: Limpiar chats inactivos con consideración para disputas
const cleanupInactiveChats = async (daysInactive = 90) => {
  try {
    const cutoffDate = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000);

    // Marcar chats como archivados si no tienen actividad reciente
    // PERO no tocar chats de disputa activos
    const result = await prisma.chat.updateMany({
      where: {
        lastActivity: { lt: cutoffDate },
        isArchived: false,
        deletedAt: null,
        OR: [
          { isDisputeChat: false },
          { 
            isDisputeChat: true,
            disputeStatus: { in: ['RESOLVED', 'CLOSED'] }
          }
        ]
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

// ✅ NUEVO: Obtener resumen de chats tripartitos para admin
const getDisputeChatsummary = async () => {
  try {
    const [
      activeDisputes,
      resolvedDisputes,
      totalDisputes,
      averageResolutionTime
    ] = await Promise.all([
      // Disputas activas
      prisma.chat.count({
        where: {
          isDisputeChat: true,
          disputeStatus: 'ACTIVE'
        }
      }),
      // Disputas resueltas este mes
      prisma.chat.count({
        where: {
          isDisputeChat: true,
          disputeStatus: { in: ['RESOLVED', 'CLOSED'] },
          updatedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      // Total de disputas
      prisma.chat.count({
        where: {
          isDisputeChat: true
        }
      }),
      // Tiempo promedio de resolución (simplificado)
      calculateAverageDisputeResolutionTime()
    ]);

    return {
      activeDisputes,
      resolvedDisputes,
      totalDisputes,
      averageResolutionTime,
      resolutionRate: totalDisputes > 0 ? ((resolvedDisputes / totalDisputes) * 100).toFixed(1) : 0
    };
  } catch (error) {
    logger.error('Error getting dispute chat summary:', error);
    return {
      activeDisputes: 0,
      resolvedDisputes: 0,
      totalDisputes: 0,
      averageResolutionTime: 0,
      resolutionRate: 0
    };
  }
};

// ✅ NUEVO: Calcular tiempo promedio de resolución de disputas
const calculateAverageDisputeResolutionTime = async () => {
  try {
    const resolvedDisputes = await prisma.chat.findMany({
      where: {
        isDisputeChat: true,
        disputeStatus: { in: ['RESOLVED', 'CLOSED'] },
        updatedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Últimos 30 días
        }
      },
      select: {
        createdAt: true,
        updatedAt: true
      }
    });

    if (resolvedDisputes.length === 0) return 0;

    const totalTime = resolvedDisputes.reduce((sum, dispute) => {
      return sum + (dispute.updatedAt.getTime() - dispute.createdAt.getTime());
    }, 0);

    const averageMs = totalTime / resolvedDisputes.length;
    return Math.round(averageMs / (1000 * 60 * 60)); // Convertir a horas
  } catch (error) {
    logger.error('Error calculating average dispute resolution time:', error);
    return 0;
  }
};

// ✅ NUEVO: Validar si un usuario puede crear más chats
const canCreateNewChat = async (userId, userType) => {
  try {
    // Solo clientes básicos tienen límites
    if (userType !== 'CLIENT') {
      return { canCreate: true };
    }

    const client = await prisma.client.findUnique({
      where: { userId },
      select: {
        premiumTier: true,
        isPremium: true
      }
    });

    if (!client) {
      return { canCreate: false, error: 'Cliente no encontrado' };
    }

    // Premium y VIP sin límites
    if (client.isPremium || ['PREMIUM', 'VIP'].includes(client.premiumTier)) {
      return { canCreate: true };
    }

    // Contar chats activos del cliente básico
    const activeChats = await prisma.chatMember.count({
      where: {
        userId,
        chat: {
          isDisputeChat: false,
          deletedAt: null,
          lastActivity: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Últimos 7 días
          }
        }
      }
    });

    const maxChats = 5; // Límite para clientes básicos

    if (activeChats >= maxChats) {
      return {
        canCreate: false,
        error: `Has alcanzado el límite de ${maxChats} chats activos. Actualiza a Premium para chats ilimitados.`,
        currentChats: activeChats,
        maxChats
      };
    }

    return {
      canCreate: true,
      currentChats: activeChats,
      maxChats
    };
  } catch (error) {
    logger.error('Error checking chat creation limits:', error);
    return { canCreate: false, error: 'Error del sistema' };
  }
};

// ✅ NUEVO: Obtener prioridad de cliente en chat
const getClientChatPriority = async (clientId, chatId) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        premiumTier: true,
        isPremium: true,
        points: true
      }
    });

    if (!client) return { priority: 0 };

    // Calcular prioridad
    let priority = 0;

    // Base por tier
    if (client.premiumTier === 'VIP') {
      priority = 100;
    } else if (client.premiumTier === 'PREMIUM' || client.isPremium) {
      priority = 50;
    } else {
      priority = 1;
    }

    // Bonus por puntos gastados
    if (client.points > 100) {
      priority += 10;
    } else if (client.points > 50) {
      priority += 5;
    }

    return {
      priority,
      tier: client.premiumTier,
      isPremium: client.isPremium
    };
  } catch (error) {
    logger.error('Error getting client chat priority:', error);
    return { priority: 0 };
  }
};

// ✅ NUEVO: Marcar chat como prioritario para escorts
const markChatAsPriority = async (chatId, escortId, clientId) => {
  try {
    const clientPriority = await getClientChatPriority(clientId, chatId);
    
    if (clientPriority.priority > 10) {
      // Actualizar prioridad del chat member
      await prisma.chatMember.update({
        where: {
          userId_chatId: {
            userId: clientId,
            chatId
          }
        },
        data: {
          // Agregar campo de prioridad si no existe en el schema
          // Por ahora usamos el role para indicar prioridad
          role: clientPriority.priority > 50 ? 'ADMIN' : 'MEMBER'
        }
      });

      logger.info('Chat marked as priority', {
        chatId,
        clientId,
        escortId,
        priority: clientPriority.priority
      });
    }

    return clientPriority;
  } catch (error) {
    logger.error('Error marking chat as priority:', error);
    return { priority: 0 };
  }
};

module.exports = {
  // Funciones principales existentes
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
  updateUserMessageStats,
  
  // ✅ NUEVAS: Funciones para chat tripartito
  validateDisputeChatAccess,
  createDisputeNotification,
  getDisputeChatInfo,
  getDisputeChatsummary,
  calculateAverageDisputeResolutionTime,
  
  // ✅ NUEVAS: Funciones para límites y prioridad
  canCreateNewChat,
  getClientChatPriority,
  markChatAsPriority,
  
  // ✅ NUEVAS: Funciones de utilidad
  validateClientTierCapabilities
};