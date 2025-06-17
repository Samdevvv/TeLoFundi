const { prisma } = require('../config/database');
const logger = require('./logger');

// Validador para verificar si un email ya existe
const isEmailUnique = async (email, excludeUserId = null) => {
  try {
    const whereClause = { email: email.toLowerCase() };
    if (excludeUserId) {
      whereClause.NOT = { id: excludeUserId };
    }

    const existingUser = await prisma.user.findFirst({
      where: whereClause
    });

    return !existingUser;
  } catch (error) {
    logger.error('Error verificando email único:', error);
    return false;
  }
};

// Validador para verificar si un username ya existe
const isUsernameUnique = async (username, excludeUserId = null) => {
  try {
    const whereClause = { username: username.toLowerCase() };
    if (excludeUserId) {
      whereClause.NOT = { id: excludeUserId };
    }

    const existingUser = await prisma.user.findFirst({
      where: whereClause
    });

    return !existingUser;
  } catch (error) {
    logger.error('Error verificando username único:', error);
    return false;
  }
};

// Validador para verificar si una ubicación existe
const isValidLocation = async (locationId) => {
  try {
    if (!locationId) return true; // Ubicación es opcional

    const location = await prisma.location.findUnique({
      where: { id: locationId }
    });

    return !!location;
  } catch (error) {
    logger.error('Error verificando ubicación:', error);
    return false;
  }
};

// Validador para verificar límites de posts por usuario
const canCreatePost = async (userId, userType) => {
  try {
    if (userType === 'AGENCY') {
      return { canCreate: true, remainingPosts: -1 }; // Ilimitado para agencias
    }

    if (userType === 'ESCORT') {
      const escort = await prisma.escort.findUnique({
        where: { userId },
        select: { maxPosts: true, currentPosts: true }
      });

      if (!escort) {
        return { canCreate: false, error: 'Perfil de escort no encontrado' };
      }

      const canCreate = escort.currentPosts < escort.maxPosts;
      const remainingPosts = escort.maxPosts - escort.currentPosts;

      return { canCreate, remainingPosts, maxPosts: escort.maxPosts };
    }

    // Clientes y admins no pueden crear posts normalmente
    return { canCreate: false, error: 'Tipo de usuario no puede crear posts' };
  } catch (error) {
    logger.error('Error verificando límites de posts:', error);
    return { canCreate: false, error: 'Error del sistema' };
  }
};

// Validador para verificar permisos de chat
const canSendMessage = async (senderId, receiverId, chatId) => {
  try {
    // Verificar que el usuario es miembro del chat
    const membership = await prisma.chatMember.findFirst({
      where: {
        userId: senderId,
        chatId: chatId,
        chat: {
          deletedAt: null
        }
      }
    });

    if (!membership) {
      return { canSend: false, error: 'No eres miembro de este chat' };
    }

    // Verificar que el receptor también es miembro (para chats directos)
    if (receiverId) {
      const receiverMembership = await prisma.chatMember.findFirst({
        where: {
          userId: receiverId,
          chatId: chatId
        }
      });

      if (!receiverMembership) {
        return { canSend: false, error: 'El destinatario no es miembro del chat' };
      }
    }

    // Verificar límites de cliente si aplica
    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      include: { client: true }
    });

    if (sender.userType === 'CLIENT' && sender.client) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Verificar si necesita resetear contador diario
      if (sender.client.lastMessageReset < today) {
        await prisma.client.update({
          where: { id: sender.client.id },
          data: {
            messagesUsedToday: 0,
            lastMessageReset: today
          }
        });
        sender.client.messagesUsedToday = 0;
      }

      // Verificar límite diario
      if (sender.client.messagesUsedToday >= sender.client.dailyMessageLimit) {
        return { 
          canSend: false, 
          error: 'Has alcanzado tu límite diario de mensajes',
          limit: sender.client.dailyMessageLimit,
          used: sender.client.messagesUsedToday
        };
      }
    }

    return { canSend: true };
  } catch (error) {
    logger.error('Error verificando permisos de chat:', error);
    return { canSend: false, error: 'Error del sistema' };
  }
};

// Validador para verificar si un usuario puede boostear
const canBoostPost = async (userId, postId) => {
  try {
    // Verificar que el post existe y pertenece al usuario
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        authorId: userId,
        isActive: true
      }
    });

    if (!post) {
      return { canBoost: false, error: 'Post no encontrado o no tienes permisos' };
    }

    // Verificar si el post ya está boosteado activamente
    const activeBoost = await prisma.boost.findFirst({
      where: {
        postId: postId,
        isActive: true,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (activeBoost) {
      return { 
        canBoost: false, 
        error: 'El post ya tiene un boost activo',
        expiresAt: activeBoost.expiresAt
      };
    }

    return { canBoost: true, post };
  } catch (error) {
    logger.error('Error verificando boost de post:', error);
    return { canBoost: false, error: 'Error del sistema' };
  }
};

// Validador para verificar membresía de agencia
const isAgencyMember = async (escortId, agencyId) => {
  try {
    const membership = await prisma.agencyMembership.findFirst({
      where: {
        escortId: escortId,
        agencyId: agencyId,
        status: 'ACTIVE'
      }
    });

    return !!membership;
  } catch (error) {
    logger.error('Error verificando membresía de agencia:', error);
    return false;
  }
};

// Validador para verificar si un escort puede ser verificado por una agencia
const canVerifyEscort = async (agencyId, escortId) => {
  try {
    // Verificar que la agencia existe y está activa
    const agency = await prisma.agency.findFirst({
      where: {
        id: agencyId,
        user: {
          isActive: true,
          isBanned: false
        }
      }
    });

    if (!agency) {
      return { canVerify: false, error: 'Agencia no encontrada o inactiva' };
    }

    // Verificar que el escort es miembro de la agencia
    const membership = await prisma.agencyMembership.findFirst({
      where: {
        escortId: escortId,
        agencyId: agencyId,
        status: 'ACTIVE'
      }
    });

    if (!membership) {
      return { canVerify: false, error: 'El escort no es miembro de tu agencia' };
    }

    // Verificar que el escort no está ya verificado
    const escort = await prisma.escort.findUnique({
      where: { id: escortId },
      select: { isVerified: true, verifiedAt: true }
    });

    if (escort?.isVerified) {
      return { 
        canVerify: false, 
        error: 'El escort ya está verificado',
        verifiedAt: escort.verifiedAt
      };
    }

    return { canVerify: true, membership };
  } catch (error) {
    logger.error('Error verificando posibilidad de verificar escort:', error);
    return { canVerify: false, error: 'Error del sistema' };
  }
};

// Validador para verificar límites de puntos de cliente
const hasEnoughPoints = async (clientId, requiredPoints) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { points: true }
    });

    if (!client) {
      return { hasEnough: false, error: 'Cliente no encontrado' };
    }

    return {
      hasEnough: client.points >= requiredPoints,
      currentPoints: client.points,
      requiredPoints
    };
  } catch (error) {
    logger.error('Error verificando puntos del cliente:', error);
    return { hasEnough: false, error: 'Error del sistema' };
  }
};

// Validador para archivos de imagen
const isValidImageFile = (file) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedMimes.includes(file.mimetype)) {
    return { isValid: false, error: 'Tipo de archivo no permitido. Solo JPEG, PNG, GIF y WebP' };
  }

  if (file.size > maxSize) {
    return { isValid: false, error: 'El archivo es demasiado grande. Máximo 5MB' };
  }

  return { isValid: true };
};

// Validador para verificar si un usuario puede acceder a un perfil premium
const canAccessPremiumProfile = async (userId, targetUserId) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { client: true }
    });

    if (!user) {
      return { canAccess: false, error: 'Usuario no encontrado' };
    }

    // Admins pueden acceder a todo
    if (user.userType === 'ADMIN') {
      return { canAccess: true };
    }

    // Escorts y agencias pueden ver perfiles básicos entre ellos
    if (['ESCORT', 'AGENCY'].includes(user.userType)) {
      return { canAccess: true };
    }

    // Para clientes, verificar si tienen acceso premium
    if (user.userType === 'CLIENT' && user.client) {
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        include: { 
          posts: { 
            where: { premiumOnly: true },
            take: 1 
          }
        }
      });

      // Si el perfil objetivo no tiene contenido premium, todos pueden acceder
      if (!targetUser?.posts?.length) {
        return { canAccess: true };
      }

      // Verificar si el cliente puede acceder a perfiles premium
      if (!user.client.canAccessPremiumProfiles) {
        return { 
          canAccess: false, 
          error: 'Necesitas una cuenta premium para ver este perfil',
          requiresPremium: true
        };
      }
    }

    return { canAccess: true };
  } catch (error) {
    logger.error('Error verificando acceso a perfil premium:', error);
    return { canAccess: false, error: 'Error del sistema' };
  }
};

// Función para sanitizar cadenas de texto
const sanitizeString = (str) => {
  if (!str || typeof str !== 'string') return str;
  
  return str
    .trim()
    .replace(/\s+/g, ' ') // Reemplazar múltiples espacios con uno solo
    .replace(/[<>]/g, ''); // Remover caracteres potencialmente peligrosos
};

// Función para validar y limpiar arrays
const sanitizeArray = (arr, maxLength = 10) => {
  if (!Array.isArray(arr)) return [];
  
  return arr
    .filter(item => item && typeof item === 'string')
    .map(item => sanitizeString(item))
    .slice(0, maxLength);
};

// Función para validar IDs de MongoDB/Prisma
const isValidId = (id) => {
  if (!id || typeof id !== 'string') return false;
  // Prisma usa cuid por defecto, pero esto puede cambiar según tu configuración
  return /^c[a-z0-9]{24,25}$/.test(id);
};

// Función para validar números de teléfono más específicamente
const isValidPhoneNumber = (phone) => {
  if (!phone) return true; // Es opcional
  
  // Remover espacios y caracteres especiales excepto +
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  
  // Validar formato internacional básico
  return /^\+?[1-9]\d{7,14}$/.test(cleanPhone);
};

// Función para validar emails más específicamente
const isValidEmail = (email) => {
  if (!email) return false;
  
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 255;
};

module.exports = {
  // Validadores de base de datos
  isEmailUnique,
  isUsernameUnique,
  isValidLocation,
  isAgencyMember,
  
  // Validadores de permisos
  canCreatePost,
  canSendMessage,
  canBoostPost,
  canVerifyEscort,
  canAccessPremiumProfile,
  
  // Validadores de recursos
  hasEnoughPoints,
  isValidImageFile,
  
  // Validadores de formato
  isValidId,
  isValidPhoneNumber,
  isValidEmail,
  
  // Funciones de sanitización
  sanitizeString,
  sanitizeArray
};