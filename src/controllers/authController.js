const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { prisma } = require('../config/database');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { 
  generateToken, 
  generateRefreshToken, 
  verifyRefreshToken 
} = require('../middleware/auth');
const { initiateGoogleAuth, handleGoogleCallback } = require('../config/auth');
const { 
  isEmailUnique, 
  isUsernameUnique, 
  sanitizeString 
} = require('../utils/validators');
const logger = require('../utils/logger');

// Registro de usuario
const register = catchAsync(async (req, res) => {
  const {
    email,
    username,
    firstName,
    lastName,
    password,
    userType,
    phone,
    bio,
    website,
    locationId,
    age,
    services
  } = req.body;

  // Validar email único
  const emailIsUnique = await isEmailUnique(email);
  if (!emailIsUnique) {
    throw new AppError('Este email ya está registrado', 409, 'EMAIL_EXISTS');
  }

  // Validar username único
  const usernameIsUnique = await isUsernameUnique(username);
  if (!usernameIsUnique) {
    throw new AppError('Este username ya está en uso', 409, 'USERNAME_EXISTS');
  }

  // Hash de la contraseña
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Preparar datos del usuario
  const userData = {
    email: email.toLowerCase(),
    username: username.toLowerCase(),
    firstName: sanitizeString(firstName),
    lastName: sanitizeString(lastName),
    password: hashedPassword,
    userType,
    phone: phone || null,
    bio: sanitizeString(bio) || null,
    website: website || null,
    locationId: locationId || null,
    isActive: true,
    lastActiveAt: new Date()
  };

  // Crear usuario con datos específicos según el tipo
  const user = await prisma.user.create({
    data: {
      ...userData,
      // Crear perfil específico según tipo de usuario
      ...(userType === 'ESCORT' && {
        escort: {
          create: {
            age: age || null,
            services: services || [],
            maxPosts: 5,
            currentPosts: 0,
            isVerified: false
          }
        }
      }),
      ...(userType === 'AGENCY' && {
        agency: {
          create: {
            isVerified: false,
            totalEscorts: 0,
            verifiedEscorts: 0,
            totalVerifications: 0,
            activeEscorts: 0
          }
        }
      }),
      ...(userType === 'CLIENT' && {
        client: {
          create: {
            points: 10, // Puntos de bienvenida
            isPremium: false,
            premiumTier: 'BASIC',
            dailyMessageLimit: 10,
            canViewPhoneNumbers: false,
            canSendImages: false,
            canSendVoiceMessages: false,
            canAccessPremiumProfiles: false,
            prioritySupport: false,
            canSeeOnlineStatus: false,
            messagesUsedToday: 0,
            lastMessageReset: new Date()
          }
        }
      }),
      // Crear configuraciones por defecto
      settings: {
        create: {
          emailNotifications: true,
          pushNotifications: true,
          messageNotifications: true,
          likeNotifications: true,
          boostNotifications: true,
          showOnline: true,
          showLastSeen: true,
          allowDirectMessages: true,
          showPhoneNumber: false,
          showInDiscovery: userType !== 'CLIENT', // Clientes ocultos por defecto
          showInTrending: userType !== 'CLIENT',
          showInSearch: true,
          contentFilter: 'MODERATE'
        }
      },
      // Crear reputación inicial
      reputation: {
        create: {
          overallScore: 50.0, // Score inicial neutro
          responseRate: 0.0,
          profileCompleteness: calculateInitialProfileCompleteness(userData, userType),
          trustScore: 25.0, // Score inicial bajo hasta verificación
          discoveryScore: 10.0,
          trendingScore: 0.0,
          qualityScore: 30.0
        }
      }
    },
    include: {
      escort: true,
      agency: true,
      client: true,
      settings: true,
      reputation: true,
      location: true
    }
  });

  // Generar tokens
  const token = generateToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  // Log del registro exitoso
  logger.logAuth('register', user.id, user.email, true, {
    userType,
    method: 'email_password',
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Respuesta sin datos sensibles
  const userResponse = {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    avatar: user.avatar,
    userType: user.userType,
    phone: user.phone,
    bio: user.bio,
    website: user.website,
    isActive: user.isActive,
    profileViews: user.profileViews,
    createdAt: user.createdAt,
    location: user.location,
    settings: user.settings,
    reputation: user.reputation,
    [userType.toLowerCase()]: user[userType.toLowerCase()]
  };

  res.status(201).json({
    success: true,
    message: 'Usuario registrado exitosamente',
    data: {
      user: userResponse,
      token,
      refreshToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    },
    timestamp: new Date().toISOString()
  });
});

// Login de usuario
const login = catchAsync(async (req, res) => {
  const { email, password, rememberMe } = req.body;

  // Buscar usuario por email
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      escort: true,
      agency: true,
      client: true,
      admin: true,
      settings: true,
      reputation: true,
      location: true
    }
  });

  if (!user) {
    logger.logAuth('login', null, email, false, {
      reason: 'user_not_found',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    throw new AppError('Credenciales inválidas', 401, 'INVALID_CREDENTIALS');
  }

  // Verificar contraseña
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    logger.logAuth('login', user.id, email, false, {
      reason: 'invalid_password',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    throw new AppError('Credenciales inválidas', 401, 'INVALID_CREDENTIALS');
  }

  // Verificar si la cuenta está activa
  if (!user.isActive) {
    logger.logAuth('login', user.id, email, false, {
      reason: 'account_inactive',
      ip: req.ip
    });
    throw new AppError('Cuenta desactivada', 401, 'ACCOUNT_INACTIVE');
  }

  // Verificar si la cuenta está baneada
  if (user.isBanned) {
    logger.logAuth('login', user.id, email, false, {
      reason: 'account_banned',
      banReason: user.banReason,
      ip: req.ip
    });
    throw new AppError(`Cuenta suspendida: ${user.banReason}`, 403, 'ACCOUNT_BANNED');
  }

  // Actualizar último login
  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLogin: new Date(),
      lastActiveAt: new Date(),
      lastLoginIP: req.ip
    }
  });

  // Generar tokens
  const tokenExpiration = rememberMe ? '30d' : (process.env.JWT_EXPIRES_IN || '7d');
  const token = generateToken(user.id, tokenExpiration);
  const refreshToken = generateRefreshToken(user.id);

  // Log del login exitoso
  logger.logAuth('login', user.id, email, true, {
    userType: user.userType,
    rememberMe,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Respuesta sin datos sensibles
  const userResponse = {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    avatar: user.avatar,
    userType: user.userType,
    phone: user.phone,
    bio: user.bio,
    website: user.website,
    isActive: user.isActive,
    profileViews: user.profileViews,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    location: user.location,
    settings: user.settings,
    reputation: user.reputation,
    [user.userType.toLowerCase()]: user[user.userType.toLowerCase()]
  };

  res.status(200).json({
    success: true,
    message: 'Login exitoso',
    data: {
      user: userResponse,
      token,
      refreshToken,
      expiresIn: tokenExpiration
    },
    timestamp: new Date().toISOString()
  });
});

// Logout
const logout = catchAsync(async (req, res) => {
  // En un sistema con JWT stateless, el logout es principalmente del lado del cliente
  // Pero podemos actualizar la última actividad del usuario
  
  await prisma.user.update({
    where: { id: req.user.id },
    data: { lastActiveAt: new Date() }
  });

  logger.logAuth('logout', req.user.id, req.user.email, true, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(200).json({
    success: true,
    message: 'Sesión cerrada exitosamente',
    timestamp: new Date().toISOString()
  });
});

// Refresh token
const refreshToken = catchAsync(async (req, res) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    throw new AppError('Refresh token requerido', 400, 'REFRESH_TOKEN_REQUIRED');
  }

  try {
    // Verificar refresh token
    const decoded = verifyRefreshToken(token);
    
    if (decoded.type !== 'refresh') {
      throw new AppError('Token inválido', 401, 'INVALID_REFRESH_TOKEN');
    }

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        isActive: true,
        isBanned: true
      }
    });

    if (!user || !user.isActive || user.isBanned) {
      throw new AppError('Usuario no válido', 401, 'INVALID_USER');
    }

    // Generar nuevos tokens
    const newToken = generateToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);

    logger.logAuth('refresh_token', user.id, user.email, true, {
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      message: 'Token renovado exitosamente',
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.logAuth('refresh_token', null, null, false, {
      error: error.message,
      ip: req.ip
    });
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw new AppError('Refresh token inválido o expirado', 401, 'INVALID_REFRESH_TOKEN');
    }
    throw error;
  }
});

// Obtener perfil del usuario autenticado
const getUserProfile = catchAsync(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      escort: true,
      agency: true,
      client: true,
      admin: true,
      settings: true,
      reputation: true,
      location: true,
      posts: {
        where: { isActive: true },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          images: true,
          views: true,
          likes: true,
          createdAt: true
        }
      },
      _count: {
        select: {
          posts: { where: { isActive: true } },
          favorites: true,
          likes: true
        }
      }
    }
  });

  if (!user) {
    throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
  }

  // Respuesta sin datos sensibles
  const userResponse = {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    avatar: user.avatar,
    userType: user.userType,
    phone: user.phone,
    bio: user.bio,
    website: user.website,
    isActive: user.isActive,
    profileViews: user.profileViews,
    lastLogin: user.lastLogin,
    lastActiveAt: user.lastActiveAt,
    createdAt: user.createdAt,
    location: user.location,
    settings: user.settings,
    reputation: user.reputation,
    posts: user.posts,
    stats: user._count,
    [user.userType.toLowerCase()]: user[user.userType.toLowerCase()]
  };

  res.status(200).json({
    success: true,
    data: userResponse,
    timestamp: new Date().toISOString()
  });
});

// Solicitar restablecimiento de contraseña
const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });

  // Siempre responder con éxito por seguridad (no revelar si el email existe)
  const successResponse = {
    success: true,
    message: 'Si el email existe, se ha enviado un enlace de restablecimiento',
    timestamp: new Date().toISOString()
  };

  if (!user) {
    logger.logAuth('forgot_password', null, email, false, {
      reason: 'email_not_found',
      ip: req.ip
    });
    return res.status(200).json(successResponse);
  }

  // Generar token de restablecimiento
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

  // Guardar token en base de datos (necesitarás agregar estos campos al modelo User)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      // Estos campos necesitan ser agregados al schema de Prisma
      passwordResetToken: resetToken,
      passwordResetExpiry: resetTokenExpiry
    }
  });

  // Aquí enviarías el email con el token
  // Por ahora solo loggeamos
  logger.info('Password reset requested', {
    userId: user.id,
    email: user.email,
    resetToken, // En producción, NO loggear el token
    ip: req.ip
  });

  logger.logAuth('forgot_password', user.id, email, true, {
    ip: req.ip
  });

  res.status(200).json(successResponse);
});

// Restablecer contraseña
const resetPassword = catchAsync(async (req, res) => {
  const { token, password } = req.body;

  // Buscar usuario por token de restablecimiento
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpiry: {
        gt: new Date()
      }
    }
  });

  if (!user) {
    throw new AppError('Token de restablecimiento inválido o expirado', 400, 'INVALID_RESET_TOKEN');
  }

  // Hash nueva contraseña
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Actualizar contraseña y limpiar tokens
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpiry: null,
      updatedAt: new Date()
    }
  });

  logger.logAuth('reset_password', user.id, user.email, true, {
    ip: req.ip
  });

  res.status(200).json({
    success: true,
    message: 'Contraseña restablecida exitosamente',
    timestamp: new Date().toISOString()
  });
});

// Verificar email
const verifyEmail = catchAsync(async (req, res) => {
  const { token } = req.body;

  // Buscar usuario por token de verificación
  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: token,
      emailVerified: false
    }
  });

  if (!user) {
    throw new AppError('Token de verificación inválido', 400, 'INVALID_VERIFICATION_TOKEN');
  }

  // Marcar email como verificado
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerifiedAt: new Date()
    }
  });

  logger.logAuth('verify_email', user.id, user.email, true);

  res.status(200).json({
    success: true,
    message: 'Email verificado exitosamente',
    timestamp: new Date().toISOString()
  });
});

// Reenviar verificación de email
const resendVerification = catchAsync(async (req, res) => {
  const user = req.user;

  if (user.emailVerified) {
    throw new AppError('El email ya está verificado', 400, 'EMAIL_ALREADY_VERIFIED');
  }

  // Generar nuevo token de verificación
  const verificationToken = crypto.randomBytes(32).toString('hex');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken: verificationToken
    }
  });

  // Aquí enviarías el email de verificación
  logger.info('Email verification resent', {
    userId: user.id,
    email: user.email,
    verificationToken // En producción, NO loggear el token
  });

  res.status(200).json({
    success: true,
    message: 'Email de verificación reenviado',
    timestamp: new Date().toISOString()
  });
});

// Cambiar contraseña
const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = req.user;

  // Verificar contraseña actual
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    logger.logAuth('change_password', user.id, user.email, false, {
      reason: 'invalid_current_password',
      ip: req.ip
    });
    throw new AppError('Contraseña actual incorrecta', 400, 'INVALID_CURRENT_PASSWORD');
  }

  // Verificar que la nueva contraseña sea diferente
  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    throw new AppError('La nueva contraseña debe ser diferente a la actual', 400, 'SAME_PASSWORD');
  }

  // Hash nueva contraseña
  const saltRounds = 12;
  const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

  // Actualizar contraseña
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedNewPassword,
      updatedAt: new Date()
    }
  });

  logger.logAuth('change_password', user.id, user.email, true, {
    ip: req.ip
  });

  res.status(200).json({
    success: true,
    message: 'Contraseña cambiada exitosamente',
    timestamp: new Date().toISOString()
  });
});

// Google OAuth - Iniciar autenticación
const googleAuth = (req, res, next) => {
  // Obtener tipo de usuario desde query params
  const userType = req.query.userType || 'CLIENT';
  
  if (!['ESCORT', 'AGENCY', 'CLIENT'].includes(userType)) {
    return res.status(400).json({
      success: false,
      message: 'Tipo de usuario no válido',
      errorCode: 'INVALID_USER_TYPE'
    });
  }

  // Iniciar flujo de Google OAuth
  initiateGoogleAuth(userType)(req, res, next);
};

// Google OAuth - Callback
const googleCallback = (req, res, next) => {
  handleGoogleCallback(req, res, next);
};

// Función helper para calcular completitud inicial del perfil
const calculateInitialProfileCompleteness = (userData, userType) => {
  let completeness = 0;
  const fields = ['firstName', 'lastName', 'bio', 'phone'];
  
  if (userType === 'AGENCY') {
    fields.push('website');
  }
  
  fields.forEach(field => {
    if (userData[field]) {
      completeness += 100 / fields.length;
    }
  });
  
  return Math.round(completeness);
};

module.exports = {
  register,
  login,
  logout,
  refreshToken,
  getUserProfile,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  changePassword,
  googleAuth,
  googleCallback
};