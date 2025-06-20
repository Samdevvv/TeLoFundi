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
const { 
  sendPasswordResetEmail,
  sendWelcomeEmail 
} = require('../services/authService');
const logger = require('../utils/logger');

// ✅ HELPER MEJORADO PARA CALCULAR COMPLETITUD DEL PERFIL
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

// ✅ REGISTRO NORMAL (EMAIL/PASSWORD)
const register = catchAsync(async (req, res) => {
  console.log('🚀 REGISTRO NORMAL - DATOS RECIBIDOS:', JSON.stringify(req.body, null, 2));

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

  logger.info('🔐 INICIANDO REGISTRO NORMAL:', {
    email,
    username,
    firstName,
    lastName,
    userType
  });

  // Validar email único
  const emailIsUnique = await isEmailUnique(email);
  if (!emailIsUnique) {
    logger.warn('❌ Email ya existe:', email);
    throw new AppError('Este email ya está registrado', 409, 'EMAIL_EXISTS');
  }

  // Validar username único
  const usernameIsUnique = await isUsernameUnique(username);
  if (!usernameIsUnique) {
    logger.warn('❌ Username ya existe:', username);
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

  try {
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
            showInDiscovery: userType !== 'CLIENT',
            showInTrending: userType !== 'CLIENT',
            showInSearch: true,
            contentFilter: 'MODERATE'
          }
        },
        // Crear reputación inicial
        reputation: {
          create: {
            overallScore: 50.0,
            responseRate: 0.0,
            profileCompleteness: calculateInitialProfileCompleteness(userData, userType),
            trustScore: 25.0,
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

    // ✅ ENVIAR EMAIL DE BIENVENIDA (NO BLOQUEAR SI FALLA)
    try {
      await sendWelcomeEmail(user);
      logger.info('✅ Email de bienvenida enviado exitosamente');
    } catch (emailError) {
      logger.warn('⚠️ No se pudo enviar email de bienvenida:', emailError.message);
      // No bloqueamos el registro si falla el email
    }

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

    logger.info('✅ Registro normal completado exitosamente:', {
      userId: user.id,
      username: user.username,
      userType: user.userType
    });

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

  } catch (error) {
    logger.error('💥 Error en registro de usuario:', {
      email,
      username,
      userType,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
});

// ✅ LOGIN NORMAL (EMAIL/PASSWORD)
const login = catchAsync(async (req, res) => {
  const { email, password, rememberMe } = req.body;

  console.log('🔐 LOGIN NORMAL - DATOS RECIBIDOS:', { email, hasPassword: !!password, rememberMe });

  logger.info('🔐 INICIANDO LOGIN NORMAL:', { email, rememberMe: !!rememberMe, ip: req.ip });

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
    logger.warn('❌ Usuario no encontrado:', email);
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
    logger.warn('❌ Contraseña inválida para usuario:', user.username);
    logger.logAuth('login', user.id, email, false, {
      reason: 'invalid_password',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    throw new AppError('Credenciales inválidas', 401, 'INVALID_CREDENTIALS');
  }

  // Verificar si la cuenta está activa
  if (!user.isActive) {
    logger.warn('❌ Cuenta inactiva:', user.username);
    throw new AppError('Cuenta desactivada', 401, 'ACCOUNT_INACTIVE');
  }

  // Verificar si la cuenta está baneada
  if (user.isBanned) {
    logger.warn('❌ Cuenta baneada:', user.username);
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
  const refreshTokenGen = generateRefreshToken(user.id);

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

  logger.info('✅ Login normal completado exitosamente:', {
    userId: user.id,
    username: user.username,
    userType: user.userType
  });

  res.status(200).json({
    success: true,
    message: 'Login exitoso',
    data: {
      user: userResponse,
      token,
      refreshToken: refreshTokenGen,
      expiresIn: tokenExpiration
    },
    timestamp: new Date().toISOString()
  });
});

// ✅ GOOGLE OAUTH - INICIAR AUTENTICACIÓN
const googleAuth = (req, res, next) => {
  // Obtener tipo de usuario desde query params
  const userType = req.query.userType || 'CLIENT';
  
  console.log('🚀 GOOGLE AUTH INICIADO:', { userType, ip: req.ip });
  
  if (!['ESCORT', 'AGENCY', 'CLIENT'].includes(userType)) {
    logger.warn('❌ Tipo de usuario no válido para Google OAuth:', userType);
    return res.status(400).json({
      success: false,
      message: 'Tipo de usuario no válido',
      errorCode: 'INVALID_USER_TYPE',
      timestamp: new Date().toISOString()
    });
  }

  logger.info('🔍 Iniciando Google OAuth:', {
    userType,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Iniciar flujo de Google OAuth
  initiateGoogleAuth(userType)(req, res, next);
};

// ✅ GOOGLE OAUTH - CALLBACK
const googleCallback = (req, res, next) => {
  console.log('📲 GOOGLE CALLBACK RECIBIDO:', {
    query: req.query,
    session: req.session?.pendingUserType
  });

  logger.info('📲 Google OAuth callback recibido');
  
  handleGoogleCallback(req, res, next);
};

// Logout
const logout = catchAsync(async (req, res) => {
  logger.info('🔐 LOGOUT:', {
    userId: req.user.id,
    username: req.user.username,
    ip: req.ip
  });

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
    const decoded = verifyRefreshToken(token);
    
    if (decoded.type !== 'refresh') {
      throw new AppError('Token inválido', 401, 'INVALID_REFRESH_TOKEN');
    }

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

    const newToken = generateToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);

    logger.logAuth('refresh_token', user.id, user.email, true, { ip: req.ip });

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

// ✅ SOLICITAR RESTABLECIMIENTO DE CONTRASEÑA - COMPLETAMENTE CORREGIDO
const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  console.log('🔐 FORGOT PASSWORD SOLICITADO:', { email, ip: req.ip });
  logger.info('🔐 INICIANDO FORGOT PASSWORD:', { email, ip: req.ip });

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });

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
    console.log('❌ Usuario no encontrado para email:', email);
    // Responder como exitoso por seguridad (no revelar si existe el email)
    return res.status(200).json(successResponse);
  }

  console.log('✅ Usuario encontrado:', { id: user.id, email: user.email, firstName: user.firstName });

  // Generar token de reset seguro
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

  console.log('🔑 Token generado:', { resetToken, expiry: resetTokenExpiry });

  // Guardar token en la base de datos
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: resetToken,
      passwordResetExpiry: resetTokenExpiry
    }
  });

  console.log('💾 Token guardado en base de datos');

  // ✅ ENVIAR EMAIL DE RESET CON MANEJO DE ERRORES MEJORADO
  try {
    console.log('📧 Intentando enviar email de reset...');
    
    // ✅ LOG DE CONFIGURACIÓN ANTES DEL ENVÍO
    console.log('📧 Configuración de email:', {
      EMAIL_HOST: process.env.EMAIL_HOST,
      EMAIL_PORT: process.env.EMAIL_PORT,
      EMAIL_USER: process.env.EMAIL_USER,
      EMAIL_PASS: process.env.EMAIL_PASS ? `${process.env.EMAIL_PASS.substring(0, 4)}****` : '❌ NO CONFIGURADO',
      EMAIL_FROM: process.env.EMAIL_FROM,
      EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
      FRONTEND_URL: process.env.FRONTEND_URL
    });

    const emailSent = await sendPasswordResetEmail(user, resetToken);
    
    if (emailSent) {
      console.log('✅ Email de reset enviado exitosamente:', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      logger.info('✅ Email de reset enviado exitosamente:', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('❌ No se pudo enviar email de reset:', {
        userId: user.id,
        email: user.email,
        reason: 'email_service_error',
        timestamp: new Date().toISOString()
      });
      logger.warn('❌ No se pudo enviar email de reset:', {
        userId: user.id,
        email: user.email,
        reason: 'email_service_error',
        timestamp: new Date().toISOString()
      });
      
      // ✅ EN DESARROLLO, MOSTRAR MÁS INFORMACIÓN
      if (process.env.NODE_ENV === 'development') {
        return res.status(500).json({
          success: false,
          message: 'Error enviando email de restablecimiento',
          error: 'EMAIL_SEND_FAILED',
          debug: {
            emailConfigured: !!process.env.EMAIL_USER && !!process.env.EMAIL_PASS,
            userFound: true,
            tokenGenerated: true
          },
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch (emailError) {
    console.error('💥 Error enviando email de reset:', {
      userId: user.id,
      email: user.email,
      error: emailError.message,
      code: emailError.code,
      stack: emailError.stack,
      timestamp: new Date().toISOString()
    });
    logger.error('💥 Error enviando email de reset:', {
      userId: user.id,
      email: user.email,
      error: emailError.message,
      code: emailError.code,
      timestamp: new Date().toISOString()
    });
    
    // ✅ EN DESARROLLO, MOSTRAR ERROR ESPECÍFICO
    if (process.env.NODE_ENV === 'development') {
      return res.status(500).json({
        success: false,
        message: 'Error enviando email de restablecimiento',
        error: emailError.message,
        code: emailError.code,
        debug: {
          emailConfigured: !!process.env.EMAIL_USER && !!process.env.EMAIL_PASS,
          userFound: true,
          tokenGenerated: true,
          errorType: emailError.code || 'UNKNOWN'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  logger.logAuth('forgot_password', user.id, email, true, { ip: req.ip });

  res.status(200).json(successResponse);
});

// ✅ RESTABLECER CONTRASEÑA - ACTUALIZADO
const resetPassword = catchAsync(async (req, res) => {
  const { token, password } = req.body;

  console.log('🔐 RESET PASSWORD SOLICITADO:', { hasToken: !!token, hasPassword: !!password, ip: req.ip });

  // Buscar usuario con token válido y no expirado
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpiry: {
        gt: new Date() // Mayor que la fecha actual (no expirado)
      }
    }
  });

  if (!user) {
    logger.warn('❌ Token de reset inválido o expirado:', { token, ip: req.ip });
    throw new AppError('Token de restablecimiento inválido o expirado', 400, 'INVALID_RESET_TOKEN');
  }

  // Hash de la nueva contraseña
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

  logger.info('✅ Contraseña restablecida exitosamente:', {
    userId: user.id,
    email: user.email,
    ip: req.ip
  });

  logger.logAuth('reset_password', user.id, user.email, true, { ip: req.ip });

  res.status(200).json({
    success: true,
    message: 'Contraseña restablecida exitosamente',
    timestamp: new Date().toISOString()
  });
});

// Verificar email
const verifyEmail = catchAsync(async (req, res) => {
  const { token } = req.body;

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: token,
      emailVerified: false
    }
  });

  if (!user) {
    throw new AppError('Token de verificación inválido', 400, 'INVALID_VERIFICATION_TOKEN');
  }

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

  const verificationToken = crypto.randomBytes(32).toString('hex');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken: verificationToken
    }
  });

  logger.info('Email verification resent', {
    userId: user.id,
    email: user.email
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

  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    logger.logAuth('change_password', user.id, user.email, false, {
      reason: 'invalid_current_password',
      ip: req.ip
    });
    throw new AppError('Contraseña actual incorrecta', 400, 'INVALID_CURRENT_PASSWORD');
  }

  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    throw new AppError('La nueva contraseña debe ser diferente a la actual', 400, 'SAME_PASSWORD');
  }

  const saltRounds = 12;
  const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedNewPassword,
      updatedAt: new Date()
    }
  });

  logger.logAuth('change_password', user.id, user.email, true, { ip: req.ip });

  res.status(200).json({
    success: true,
    message: 'Contraseña cambiada exitosamente',
    timestamp: new Date().toISOString()
  });
});

// ✅ FUNCIÓN DE PRUEBA PARA TESTING DE EMAILS (SOLO DESARROLLO)
const testEmail = catchAsync(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    throw new AppError('Endpoint de prueba no disponible en producción', 403, 'TEST_DISABLED');
  }

  const { email, type } = req.body;

  if (!email) {
    throw new AppError('Email es requerido', 400, 'EMAIL_REQUIRED');
  }

  // Usuario de prueba
  const testUser = {
    id: 'test-user-id',
    firstName: 'Usuario',
    lastName: 'Prueba',
    email: email,
    userType: 'CLIENT'
  };

  const testToken = 'test-token-123456789';

  try {
    let result = false;
    let emailType = '';

    switch (type) {
      case 'reset':
        result = await sendPasswordResetEmail(testUser, testToken);
        emailType = 'restablecimiento de contraseña';
        break;
      case 'welcome':
        const { sendWelcomeEmail } = require('../services/authService');
        result = await sendWelcomeEmail(testUser);
        emailType = 'bienvenida';
        break;
      case 'verification':
        const { sendVerificationEmail } = require('../services/authService');
        result = await sendVerificationEmail(testUser, testToken);
        emailType = 'verificación';
        break;
      default:
        throw new AppError('Tipo de email no válido. Usa: reset, welcome, verification', 400, 'INVALID_TYPE');
    }

    if (result) {
      logger.info('✅ Email de prueba enviado exitosamente:', {
        type: emailType,
        to: email,
        timestamp: new Date().toISOString()
      });

      res.status(200).json({
        success: true,
        message: `Email de ${emailType} enviado exitosamente`,
        data: {
          emailType,
          recipient: email,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      throw new AppError(`Error enviando email de ${emailType}`, 500, 'EMAIL_SEND_ERROR');
    }
  } catch (error) {
    logger.error('❌ Error en prueba de email:', {
      error: error.message,
      type,
      email,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
});

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
  googleCallback,
  testEmail
};