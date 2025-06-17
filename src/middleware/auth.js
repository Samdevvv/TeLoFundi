const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');
const { AppError } = require('./errorHandler');
const logger = require('../utils/logger');

// Middleware principal de autenticación
const authenticate = async (req, res, next) => {
  try {
    let token;

    // Extraer token del header Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // También verificar en x-access-token para compatibilidad
    else if (req.headers['x-access-token']) {
      token = req.headers['x-access-token'];
    }

    if (!token) {
      return next(new AppError('Token de acceso requerido', 401, 'NO_TOKEN'));
    }

    // Verificar token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Buscar usuario actual
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        escort: true,
        agency: true,
        client: true,
        admin: true,
        settings: true
      }
    });

    if (!currentUser) {
      return next(new AppError('El usuario del token ya no existe', 401, 'USER_NOT_FOUND'));
    }

    // Verificar si el usuario está activo
    if (!currentUser.isActive) {
      return next(new AppError('Cuenta desactivada', 401, 'ACCOUNT_INACTIVE'));
    }

    // Verificar si el usuario está baneado
    if (currentUser.isBanned) {
      return next(new AppError('Cuenta suspendida', 403, 'ACCOUNT_BANNED'));
    }

    // Verificar si la contraseña cambió después de la emisión del token
    const tokenIssuedAt = new Date(decoded.iat * 1000);
    if (currentUser.updatedAt && currentUser.updatedAt > tokenIssuedAt) {
      // Solo invalidar si cambió la contraseña específicamente
      // En una implementación real, necesitarías un campo passwordChangedAt
      logger.warn('Token issued before password change', {
        userId: currentUser.id,
        tokenIssuedAt,
        userUpdatedAt: currentUser.updatedAt
      });
    }

    // Agregar usuario a la request
    req.user = currentUser;

    // Log de autenticación exitosa
    logger.logAuth('token_verification', currentUser.id, currentUser.email, true, {
      userType: currentUser.userType,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Actualizar última actividad
    await prisma.user.update({
      where: { id: currentUser.id },
      data: { lastActiveAt: new Date() }
    });

    next();
  } catch (error) {
    logger.logAuth('token_verification', null, null, false, {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Token inválido', 401, 'INVALID_TOKEN'));
    } else if (error.name === 'TokenExpiredError') {
      return next(new AppError('Token expirado', 401, 'TOKEN_EXPIRED'));
    }
    
    return next(new AppError('Error de autenticación', 401, 'AUTH_ERROR'));
  }
};

// Middleware para verificar tipos de usuario específicos
const requireUserType = (...allowedTypes) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Usuario no autenticado', 401, 'NOT_AUTHENTICATED'));
    }

    if (!allowedTypes.includes(req.user.userType)) {
      logger.logSecurity('unauthorized_access_attempt', 'medium', {
        userId: req.user.id,
        userType: req.user.userType,
        requiredTypes: allowedTypes,
        endpoint: req.originalUrl,
        method: req.method,
        ip: req.ip
      });

      return next(new AppError('Permisos insuficientes', 403, 'INSUFFICIENT_PERMISSIONS'));
    }

    next();
  };
};

// Middleware para verificar si es admin
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Usuario no autenticado', 401, 'NOT_AUTHENTICATED'));
  }

  if (req.user.userType !== 'ADMIN') {
    logger.logSecurity('admin_access_attempt', 'high', {
      userId: req.user.id,
      userType: req.user.userType,
      endpoint: req.originalUrl,
      method: req.method,
      ip: req.ip
    });

    return next(new AppError('Acceso de administrador requerido', 403, 'ADMIN_REQUIRED'));
  }

  next();
};

// Middleware para verificar si es escort
const requireEscort = requireUserType('ESCORT');

// Middleware para verificar si es agencia
const requireAgency = requireUserType('AGENCY');

// Middleware para verificar si es cliente
const requireClient = requireUserType('CLIENT');

// Middleware para verificar si es escort o agencia
const requireEscortOrAgency = requireUserType('ESCORT', 'AGENCY');

// Middleware para verificar propiedad de recursos
const requireOwnership = (resourceIdParam = 'id', resourceModel = null) => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceIdParam];
      const userId = req.user.id;

      if (!resourceId) {
        return next(new AppError('ID de recurso requerido', 400, 'RESOURCE_ID_REQUIRED'));
      }

      // Si no se especifica modelo, asumir que el recurso tiene authorId
      if (!resourceModel) {
        // Para posts, mensajes, etc. que tienen authorId
        const resource = await prisma[req.route.path.split('/')[1]].findUnique({
          where: { id: resourceId },
          select: { authorId: true }
        });

        if (!resource) {
          return next(new AppError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND'));
        }

        if (resource.authorId !== userId && req.user.userType !== 'ADMIN') {
          return next(new AppError('No tienes permisos para este recurso', 403, 'RESOURCE_FORBIDDEN'));
        }
      } else {
        // Para modelos específicos
        let whereClause = { id: resourceId };
        
        // Determinar el campo de propiedad según el modelo
        switch (resourceModel) {
          case 'user':
            whereClause = { id: resourceId };
            break;
          case 'post':
            whereClause = { id: resourceId, authorId: userId };
            break;
          case 'message':
            whereClause = { id: resourceId, senderId: userId };
            break;
          default:
            whereClause = { id: resourceId, userId: userId };
        }

        const resource = await prisma[resourceModel].findFirst({
          where: whereClause
        });

        if (!resource && req.user.userType !== 'ADMIN') {
          return next(new AppError('Recurso no encontrado o sin permisos', 404, 'RESOURCE_NOT_FOUND'));
        }
      }

      next();
    } catch (error) {
      logger.error('Error verificando propiedad:', error);
      next(new AppError('Error verificando permisos', 500, 'PERMISSION_CHECK_ERROR'));
    }
  };
};

// Middleware para autenticación opcional (no falla si no hay token)
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.headers['x-access-token']) {
      token = req.headers['x-access-token'];
    }

    if (!token) {
      return next(); // Continuar sin autenticación
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        escort: true,
        agency: true,
        client: true,
        admin: true
      }
    });

    if (currentUser && currentUser.isActive && !currentUser.isBanned) {
      req.user = currentUser;
      
      // Actualizar última actividad
      await prisma.user.update({
        where: { id: currentUser.id },
        data: { lastActiveAt: new Date() }
      });
    }

    next();
  } catch (error) {
    // En autenticación opcional, los errores no detienen la ejecución
    next();
  }
};

// Middleware para verificar límites de cliente
const checkClientLimits = async (req, res, next) => {
  try {
    if (req.user.userType !== 'CLIENT') {
      return next(); // Solo aplica a clientes
    }

    const client = req.user.client;
    if (!client) {
      return next(new AppError('Datos de cliente no encontrados', 400, 'CLIENT_DATA_NOT_FOUND'));
    }

    // Verificar si es premium y no ha expirado
    if (client.isPremium && client.premiumUntil && new Date() > client.premiumUntil) {
      await prisma.client.update({
        where: { id: client.id },
        data: {
          isPremium: false,
          premiumTier: 'BASIC',
          premiumUntil: null
        }
      });
      
      // Actualizar datos en req.user
      req.user.client.isPremium = false;
      req.user.client.premiumTier = 'BASIC';
    }

    // Verificar límites según el tier
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Resetear contador diario si es necesario
    if (client.lastMessageReset < today) {
      await prisma.client.update({
        where: { id: client.id },
        data: {
          messagesUsedToday: 0,
          lastMessageReset: today
        }
      });
      req.user.client.messagesUsedToday = 0;
    }

    req.clientLimits = {
      dailyMessageLimit: client.dailyMessageLimit,
      messagesUsedToday: client.messagesUsedToday,
      canViewPhoneNumbers: client.canViewPhoneNumbers,
      canSendImages: client.canSendImages,
      canSendVoiceMessages: client.canSendVoiceMessages,
      canAccessPremiumProfiles: client.canAccessPremiumProfiles,
      canSeeOnlineStatus: client.canSeeOnlineStatus
    };

    next();
  } catch (error) {
    logger.error('Error verificando límites de cliente:', error);
    next(new AppError('Error verificando límites', 500, 'LIMIT_CHECK_ERROR'));
  }
};

// Función para generar token JWT
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Función para generar refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// Función para verificar refresh token
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
};

module.exports = {
  authenticate,
  requireUserType,
  requireAdmin,
  requireEscort,
  requireAgency,
  requireClient,
  requireEscortOrAgency,
  requireOwnership,
  optionalAuth,
  checkClientLimits,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken
};