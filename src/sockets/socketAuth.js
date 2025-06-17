const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');

// Middleware de autenticación para sockets
const authenticateSocket = async (socket, next) => {
  try {
    // Obtener token del handshake
    const token = socket.handshake.auth?.token || 
                  socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
                  socket.request.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      logger.warn('Socket connection attempted without token', {
        socketId: socket.id,
        ip: socket.request.connection.remoteAddress
      });
      return next(new Error('Token de autenticación requerido'));
    }

    // Verificar JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      logger.warn('Invalid JWT token in socket connection', {
        socketId: socket.id,
        error: jwtError.message,
        ip: socket.request.connection.remoteAddress
      });
      return next(new Error('Token inválido'));
    }

    // Verificar que el token es de acceso (no refresh)
    if (decoded.type && decoded.type !== 'access') {
      logger.warn('Wrong token type for socket connection', {
        socketId: socket.id,
        tokenType: decoded.type,
        userId: decoded.userId
      });
      return next(new Error('Tipo de token inválido'));
    }

    // Buscar usuario en la base de datos
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        escort: {
          select: {
            id: true,
            isVerified: true,
            maxPosts: true,
            currentPosts: true
          }
        },
        agency: {
          select: {
            id: true,
            isVerified: true,
            totalEscorts: true
          }
        },
        client: {
          select: {
            id: true,
            points: true,
            isPremium: true,
            premiumTier: true,
            premiumUntil: true,
            dailyMessageLimit: true,
            messagesUsedToday: true,
            canViewPhoneNumbers: true,
            canSendImages: true,
            canSendVoiceMessages: true,
            canAccessPremiumProfiles: true,
            prioritySupport: true,
            canSeeOnlineStatus: true
          }
        },
        admin: {
          select: {
            id: true,
            role: true,
            permissions: true
          }
        },
        settings: {
          select: {
            showOnline: true,
            showLastSeen: true,
            allowDirectMessages: true,
            messageNotifications: true
          }
        }
      }
    });

    if (!user) {
      logger.warn('Socket connection with non-existent user', {
        socketId: socket.id,
        userId: decoded.userId,
        ip: socket.request.connection.remoteAddress
      });
      return next(new Error('Usuario no encontrado'));
    }

    // Verificar que la cuenta está activa
    if (!user.isActive) {
      logger.warn('Socket connection with inactive account', {
        socketId: socket.id,
        userId: user.id,
        email: user.email
      });
      return next(new Error('Cuenta desactivada'));
    }

    // Verificar que la cuenta no está baneada
    if (user.isBanned) {
      logger.warn('Socket connection with banned account', {
        socketId: socket.id,
        userId: user.id,
        email: user.email,
        banReason: user.banReason
      });
      return next(new Error('Cuenta suspendida'));
    }

    // Verificar configuraciones de privacidad para chat
    if (!user.settings?.allowDirectMessages && socket.nsp.name.includes('chat')) {
      logger.info('Socket connection denied - direct messages disabled', {
        socketId: socket.id,
        userId: user.id
      });
      return next(new Error('Mensajes directos deshabilitados'));
    }

    // Verificar límites de conexión por usuario (opcional)
    const maxConnectionsPerUser = parseInt(process.env.MAX_SOCKET_CONNECTIONS_PER_USER) || 5;
    const userSockets = await getUserActiveConnections(user.id, socket.nsp);
    
    if (userSockets >= maxConnectionsPerUser) {
      logger.warn('Socket connection limit exceeded', {
        socketId: socket.id,
        userId: user.id,
        activeConnections: userSockets,
        limit: maxConnectionsPerUser
      });
      return next(new Error('Límite de conexiones simultáneas excedido'));
    }

    // Agregar información del usuario al socket
    socket.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      userType: user.userType,
      isActive: user.isActive,
      lastActiveAt: user.lastActiveAt,
      settings: user.settings,
      escort: user.escort,
      agency: user.agency,
      client: user.client,
      admin: user.admin
    };

    // Registrar conexión exitosa
    logger.info('Socket authenticated successfully', {
      socketId: socket.id,
      userId: user.id,
      userType: user.userType,
      namespace: socket.nsp.name,
      ip: socket.request.connection.remoteAddress,
      userAgent: socket.request.headers['user-agent']
    });

    // Actualizar última actividad del usuario
    await updateUserLastActivity(user.id, socket.request.connection.remoteAddress);

    // Continuar con la conexión
    next();

  } catch (error) {
    logger.error('Socket authentication error:', error);
    next(new Error('Error de autenticación'));
  }
};

// Middleware de autorización por rol para sockets
const authorizeSocketRole = (allowedRoles) => {
  return (socket, next) => {
    try {
      const userType = socket.user?.userType;
      
      if (!userType) {
        return next(new Error('Usuario no autenticado'));
      }

      if (!allowedRoles.includes(userType)) {
        logger.warn('Socket authorization failed - insufficient role', {
          socketId: socket.id,
          userId: socket.user.id,
          userType,
          allowedRoles,
          namespace: socket.nsp.name
        });
        return next(new Error('Permisos insuficientes'));
      }

      logger.debug('Socket authorized successfully', {
        socketId: socket.id,
        userId: socket.user.id,
        userType,
        namespace: socket.nsp.name
      });

      next();
    } catch (error) {
      logger.error('Socket authorization error:', error);
      next(new Error('Error de autorización'));
    }
  };
};

// Middleware para verificar permisos específicos de admin
const authorizeAdminSocket = (requiredPermissions = []) => {
  return (socket, next) => {
    try {
      const user = socket.user;
      
      if (!user || user.userType !== 'ADMIN') {
        return next(new Error('Acceso de administrador requerido'));
      }

      if (!user.admin) {
        return next(new Error('Datos de administrador no encontrados'));
      }

      // Verificar permisos específicos si se requieren
      if (requiredPermissions.length > 0) {
        const userPermissions = user.admin.permissions || [];
        const hasPermission = requiredPermissions.some(permission => 
          userPermissions.includes(permission)
        );

        if (!hasPermission) {
          logger.warn('Admin socket authorization failed - missing permissions', {
            socketId: socket.id,
            userId: user.id,
            adminRole: user.admin.role,
            requiredPermissions,
            userPermissions
          });
          return next(new Error('Permisos de administrador insuficientes'));
        }
      }

      logger.info('Admin socket authorized', {
        socketId: socket.id,
        userId: user.id,
        adminRole: user.admin.role,
        requiredPermissions
      });

      next();
    } catch (error) {
      logger.error('Admin socket authorization error:', error);
      next(new Error('Error de autorización de administrador'));
    }
  };
};

// Middleware para verificar estado premium de clientes
const requirePremiumSocket = (socket, next) => {
  try {
    const user = socket.user;
    
    if (!user || user.userType !== 'CLIENT') {
      return next(new Error('Solo clientes pueden acceder'));
    }

    if (!user.client) {
      return next(new Error('Datos de cliente no encontrados'));
    }

    // Verificar si es premium y no ha expirado
    const now = new Date();
    const isPremiumActive = user.client.isPremium && 
                           (!user.client.premiumUntil || user.client.premiumUntil > now);

    if (!isPremiumActive) {
      logger.info('Premium socket access denied - not premium or expired', {
        socketId: socket.id,
        userId: user.id,
        isPremium: user.client.isPremium,
        premiumUntil: user.client.premiumUntil
      });
      return next(new Error('Suscripción premium requerida'));
    }

    logger.debug('Premium socket access granted', {
      socketId: socket.id,
      userId: user.id,
      premiumTier: user.client.premiumTier,
      premiumUntil: user.client.premiumUntil
    });

    next();
  } catch (error) {
    logger.error('Premium socket authorization error:', error);
    next(new Error('Error verificando suscripción premium'));
  }
};

// Middleware para verificar verificación de escort/agency
const requireVerifiedSocket = (socket, next) => {
  try {
    const user = socket.user;
    
    if (!user) {
      return next(new Error('Usuario no autenticado'));
    }

    let isVerified = false;

    if (user.userType === 'ESCORT' && user.escort) {
      isVerified = user.escort.isVerified;
    } else if (user.userType === 'AGENCY' && user.agency) {
      isVerified = user.agency.isVerified;
    } else {
      // Otros tipos de usuario se consideran "verificados" por defecto
      isVerified = true;
    }

    if (!isVerified) {
      logger.info('Verified socket access denied - not verified', {
        socketId: socket.id,
        userId: user.id,
        userType: user.userType
      });
      return next(new Error('Cuenta verificada requerida'));
    }

    logger.debug('Verified socket access granted', {
      socketId: socket.id,
      userId: user.id,
      userType: user.userType
    });

    next();
  } catch (error) {
    logger.error('Verified socket authorization error:', error);
    next(new Error('Error verificando estado de verificación'));
  }
};

// Middleware para rate limiting de sockets
const socketRateLimit = (options = {}) => {
  const { 
    windowMs = 60000, // 1 minuto
    maxConnections = 10,
    maxEvents = 100 
  } = options;

  const connectionCounts = new Map();
  const eventCounts = new Map();

  return (socket, next) => {
    try {
      const userId = socket.user?.id;
      const ip = socket.request.connection.remoteAddress;
      const identifier = userId || ip;
      const now = Date.now();

      // Limpiar contadores antiguos
      const windowStart = now - windowMs;
      
      // Verificar límite de conexiones
      if (!connectionCounts.has(identifier)) {
        connectionCounts.set(identifier, []);
      }
      
      const userConnections = connectionCounts.get(identifier);
      const recentConnections = userConnections.filter(time => time > windowStart);
      
      if (recentConnections.length >= maxConnections) {
        logger.warn('Socket connection rate limit exceeded', {
          socketId: socket.id,
          identifier,
          connections: recentConnections.length,
          limit: maxConnections,
          windowMs
        });
        return next(new Error('Demasiadas conexiones. Intenta más tarde.'));
      }

      // Registrar nueva conexión
      recentConnections.push(now);
      connectionCounts.set(identifier, recentConnections);

      // Configurar rate limiting para eventos
      socket.use((packet, next) => {
        const eventName = packet[0];
        const eventKey = `${identifier}:${eventName}`;
        
        if (!eventCounts.has(eventKey)) {
          eventCounts.set(eventKey, []);
        }
        
        const userEvents = eventCounts.get(eventKey);
        const recentEvents = userEvents.filter(time => time > Date.now() - windowMs);
        
        if (recentEvents.length >= maxEvents) {
          logger.warn('Socket event rate limit exceeded', {
            socketId: socket.id,
            identifier,
            eventName,
            events: recentEvents.length,
            limit: maxEvents
          });
          return next(new Error(`Demasiados eventos ${eventName}. Intenta más tarde.`));
        }
        
        recentEvents.push(Date.now());
        eventCounts.set(eventKey, recentEvents);
        
        next();
      });

      // Limpiar al desconectar
      socket.on('disconnect', () => {
        connectionCounts.delete(identifier);
        
        // Limpiar eventos del usuario
        for (const [key] of eventCounts.entries()) {
          if (key.startsWith(`${identifier}:`)) {
            eventCounts.delete(key);
          }
        }
      });

      next();
    } catch (error) {
      logger.error('Socket rate limit error:', error);
      next(new Error('Error en rate limiting'));
    }
  };
};

// Obtener conexiones activas de un usuario
const getUserActiveConnections = async (userId, namespace) => {
  try {
    const sockets = await namespace.fetchSockets();
    return sockets.filter(socket => socket.user?.id === userId).length;
  } catch (error) {
    logger.error('Error getting user active connections:', error);
    return 0;
  }
};

// Actualizar última actividad del usuario
const updateUserLastActivity = async (userId, ip) => {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastActiveAt: new Date(),
        lastLoginIP: ip
      }
    });
  } catch (error) {
    // Log error but don't fail the connection
    logger.error('Error updating user last activity:', error);
  }
};

// Desconectar todas las sesiones de un usuario (útil para baneos)
const disconnectUserSockets = async (userId, namespace, reason = 'Account suspended') => {
  try {
    const sockets = await namespace.fetchSockets();
    const userSockets = sockets.filter(socket => socket.user?.id === userId);
    
    for (const socket of userSockets) {
      socket.emit('force_disconnect', { reason });
      socket.disconnect(true);
    }

    logger.info('User sockets disconnected', {
      userId,
      socketsDisconnected: userSockets.length,
      reason
    });

    return userSockets.length;
  } catch (error) {
    logger.error('Error disconnecting user sockets:', error);
    return 0;
  }
};

// Validar datos de eventos de socket
const validateSocketEvent = (schema) => {
  return (socket, next) => {
    socket.use((packet, next) => {
      const [eventName, data] = packet;
      
      if (schema[eventName]) {
        const { error } = schema[eventName].validate(data);
        if (error) {
          logger.warn('Socket event validation failed', {
            socketId: socket.id,
            userId: socket.user?.id,
            eventName,
            error: error.details[0]?.message
          });
          return next(new Error(`Datos inválidos para ${eventName}: ${error.details[0]?.message}`));
        }
      }
      
      next();
    });
    
    next();
  };
};

// Logging mejorado para eventos de socket
const logSocketEvents = (events = []) => {
  return (socket, next) => {
    socket.use((packet, next) => {
      const [eventName, data] = packet;
      
      if (events.length === 0 || events.includes(eventName)) {
        logger.info('Socket event received', {
          socketId: socket.id,
          userId: socket.user?.id,
          userType: socket.user?.userType,
          eventName,
          namespace: socket.nsp.name,
          timestamp: new Date().toISOString(),
          // No loggear datos sensibles en producción
          ...(process.env.NODE_ENV === 'development' && { data })
        });
      }
      
      next();
    });
    
    next();
  };
};

// Middleware para verificar configuraciones de usuario
const checkUserSettings = (settingName) => {
  return (socket, next) => {
    try {
      const userSettings = socket.user?.settings;
      
      if (!userSettings || !userSettings[settingName]) {
        logger.info('Socket access denied by user settings', {
          socketId: socket.id,
          userId: socket.user?.id,
          setting: settingName,
          value: userSettings?.[settingName]
        });
        return next(new Error('Funcionalidad deshabilitada en configuración'));
      }
      
      next();
    } catch (error) {
      logger.error('Error checking user settings:', error);
      next(new Error('Error verificando configuración'));
    }
  };
};

module.exports = {
  authenticateSocket,
  authorizeSocketRole,
  authorizeAdminSocket,
  requirePremiumSocket,
  requireVerifiedSocket,
  socketRateLimit,
  getUserActiveConnections,
  disconnectUserSockets,
  validateSocketEvent,
  logSocketEvents,
  checkUserSettings,
  updateUserLastActivity
};