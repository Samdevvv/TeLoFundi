const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const { prisma } = require('./database');
const logger = require('../utils/logger');
// ====================================================================
// Auth del config
// ====================================================================
// Configurar estrategia JWT
const configureJwtStrategy = () => {
  const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
    ignoreExpiration: false,
    passReqToCallback: false
  };

  passport.use(new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
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
        return done(null, false, { message: 'Usuario no encontrado' });
      }

      if (!user.isActive) {
        return done(null, false, { message: 'Cuenta desactivada' });
      }

      if (user.isBanned) {
        return done(null, false, { message: 'Cuenta suspendida' });
      }

      return done(null, user);
    } catch (error) {
      logger.error('Error en JWT Strategy:', error);
      return done(error, false);
    }
  }));
};

// ✅ GOOGLE OAUTH STRATEGY COMPLETA Y FUNCIONAL
const configureGoogleStrategy = () => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    logger.warn('🔴 Google OAuth no configurado - faltan variables de entorno');
    return false;
  }

  const googleOptions = {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
    scope: ['profile', 'email'],
    passReqToCallback: true
  };

  passport.use(new GoogleStrategy(googleOptions, async (req, accessToken, refreshToken, profile, done) => {
    try {
      logger.info('🟢 Google OAuth callback received', {
        profileId: profile.id,
        email: profile.emails?.[0]?.value,
        userType: req.session?.pendingUserType || 'CLIENT'
      });

      const email = profile.emails?.[0]?.value;
      const firstName = profile.name?.givenName || '';
      const lastName = profile.name?.familyName || '';
      const avatar = profile.photos?.[0]?.value || null;

      if (!email) {
        logger.error('❌ No se pudo obtener el email de Google');
        return done(new Error('No se pudo obtener el email de Google'), null);
      }

      // Buscar usuario existente por email
      let user = await prisma.user.findUnique({
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

      if (user) {
        // ✅ USUARIO EXISTENTE - LOGIN CON GOOGLE
        logger.info('✅ Usuario existente encontrado, actualizando login:', user.username);

        // Actualizar información de Google si es necesario
        const updateData = {
          lastLogin: new Date(),
          lastActiveAt: new Date(),
          lastLoginIP: req.ip || 'unknown'
        };

        // Solo actualizar avatar si no tiene uno
        if (!user.avatar && avatar) {
          updateData.avatar = avatar;
        }

        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
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

        // Verificaciones de seguridad
        if (!user.isActive) {
          logger.warn('❌ Cuenta desactivada:', user.email);
          return done(new Error('Cuenta desactivada'), null);
        }

        if (user.isBanned) {
          logger.warn('❌ Cuenta suspendida:', user.email);
          return done(new Error('Cuenta suspendida'), null);
        }

        // Log exitoso
        logger.logAuth('google_login', user.id, user.email, true, {
          method: 'google_oauth',
          existing_user: true,
          ip: req.ip
        });

        return done(null, user);
      }

      // ✅ NUEVO USUARIO - REGISTRO CON GOOGLE
      const userType = req.session?.pendingUserType || req.query?.userType || 'CLIENT';
      
      if (!['ESCORT', 'AGENCY', 'CLIENT'].includes(userType)) {
        logger.error('❌ Tipo de usuario no válido:', userType);
        return done(new Error('Tipo de usuario no válido'), null);
      }

      logger.info('🆕 Creando nuevo usuario con Google OAuth:', {
        email,
        userType,
        firstName,
        lastName
      });

      // Generar username único basado en el email
      let username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      if (username.length < 3) {
        username = `user${Date.now()}`;
      }

      let usernameExists = true;
      let counter = 0;

      while (usernameExists) {
        const checkUsername = counter === 0 ? username : `${username}${counter}`;
        const existingUser = await prisma.user.findUnique({
          where: { username: checkUsername }
        });
        
        if (!existingUser) {
          username = checkUsername;
          usernameExists = false;
        }
        counter++;

        // Prevenir bucle infinito
        if (counter > 100) {
          username = `user${Date.now()}${Math.floor(Math.random() * 1000)}`;
          break;
        }
      }

      // ✅ CREAR USUARIO CON GOOGLE OAUTH
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          username,
          firstName,
          lastName,
          avatar,
          userType,
          password: 'google_oauth', // Placeholder - no se usa para OAuth
          isActive: true,
          emailVerified: true, // Google ya verificó el email
          emailVerifiedAt: new Date(),
          lastLogin: new Date(),
          lastActiveAt: new Date(),
          lastLoginIP: req.ip || 'unknown',

          // ✅ CREAR PERFIL ESPECÍFICO SEGÚN TIPO DE USUARIO
          ...(userType === 'ESCORT' && {
            escort: {
              create: {
                maxPosts: 5,
                currentPosts: 0,
                isVerified: false,
                age: null,
                services: [],
                rates: {},
                availability: {}
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

          // ✅ CONFIGURACIONES POR DEFECTO
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

          // ✅ REPUTACIÓN INICIAL
          reputation: {
            create: {
              overallScore: 50.0,
              responseRate: 0.0,
              profileCompleteness: 60.0, // Mayor porque ya tiene nombre e imagen
              trustScore: 35.0, // Más alto por verificación de Google
              discoveryScore: 15.0,
              trendingScore: 0.0,
              qualityScore: 40.0
            }
          }
        },
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

      logger.info('✅ Usuario creado exitosamente con Google OAuth:', {
        id: user.id,
        username: user.username,
        email: user.email,
        userType: user.userType
      });

      // Log de registro exitoso
      logger.logAuth('google_register', user.id, user.email, true, {
        method: 'google_oauth',
        userType,
        new_user: true,
        ip: req.ip
      });

      return done(null, user);

    } catch (error) {
      logger.error('💥 Error en Google OAuth Strategy:', {
        error: error.message,
        stack: error.stack,
        profileId: profile?.id,
        email: profile?.emails?.[0]?.value
      });

      logger.logAuth('google_auth', null, profile?.emails?.[0]?.value, false, {
        error: error.message,
        profileId: profile?.id,
        ip: req.ip
      });

      return done(error, null);
    }
  }));

  logger.info('✅ Google OAuth Strategy configurada correctamente');
  return true;
};

// ✅ SERIALIZACIÓN PARA SESIONES
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
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
    done(null, user);
  } catch (error) {
    logger.error('Error en deserializeUser:', error);
    done(error, null);
  }
});

// ✅ FUNCIÓN PRINCIPAL DE CONFIGURACIÓN
const configurePassport = () => {
  try {
    configureJwtStrategy();
    const googleConfigured = configureGoogleStrategy();
    
    logger.info('🔐 Passport configurado correctamente:', {
      jwt: true,
      google: googleConfigured
    });

    return { jwt: true, google: googleConfigured };
  } catch (error) {
    logger.error('💥 Error configurando Passport:', error);
    throw error;
  }
};

// ✅ MIDDLEWARE PARA AUTENTICACIÓN OPCIONAL CON PASSPORT
const optionalPassportAuth = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      logger.error('Error en autenticación opcional:', err);
      return next();
    }
    
    if (user) {
      req.user = user;
    }
    
    next();
  })(req, res, next);
};

// ✅ MIDDLEWARE PARA AUTENTICACIÓN REQUERIDA CON PASSPORT
const requiredPassportAuth = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      logger.error('Error en autenticación requerida:', err);
      return res.status(500).json({
        success: false,
        message: 'Error interno de autenticación',
        errorCode: 'AUTH_INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      });
    }
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: info?.message || 'Token de acceso inválido',
        errorCode: 'INVALID_TOKEN',
        timestamp: new Date().toISOString()
      });
    }
    
    req.user = user;
    next();
  })(req, res, next);
};

// ✅ FUNCIÓN PARA INICIAR FLUJO DE GOOGLE OAUTH
const initiateGoogleAuth = (userType = 'CLIENT') => {
  return (req, res, next) => {
    logger.info('🚀 Iniciando Google OAuth:', {
      userType,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Guardar el tipo de usuario para después del callback
    req.session.pendingUserType = userType;
    
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      accessType: 'offline',
      prompt: 'consent'
    })(req, res, next);
  };
};

// ✅ FUNCIÓN PARA MANEJAR CALLBACK DE GOOGLE OAUTH
const handleGoogleCallback = (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user, info) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';

    if (err) {
      logger.error('💥 Error en Google OAuth callback:', err);
      
      // Limpiar sesión
      delete req.session.pendingUserType;
      
      // Redirigir al frontend con error
      const errorMessage = encodeURIComponent(err.message || 'Error en autenticación con Google');
      const redirectUrl = `${frontendUrl}/?auth=error&message=${errorMessage}`;
      return res.redirect(redirectUrl);
    }
    
    if (!user) {
      logger.warn('⚠️ Google OAuth callback sin usuario:', info);
      
      // Limpiar sesión
      delete req.session.pendingUserType;
      
      const errorMessage = encodeURIComponent('No se pudo autenticar con Google');
      const redirectUrl = `${frontendUrl}/?auth=error&message=${errorMessage}`;
      return res.redirect(redirectUrl);
    }
    
    try {
      // ✅ GENERAR JWT PARA EL USUARIO
      const { generateToken, generateRefreshToken } = require('../middleware/auth');
      const token = generateToken(user.id);
      const refreshToken = generateRefreshToken(user.id);
      
      // Limpiar datos de sesión
      delete req.session.pendingUserType;
      
      // ✅ PREPARAR DATOS DEL USUARIO (SIN DATOS SENSIBLES)
      const userData = {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        avatar: user.avatar,
        isActive: user.isActive,
        createdAt: user.createdAt
      };

      // ✅ REDIRIGIR AL FRONTEND CON EL TOKEN Y DATOS
      const queryParams = new URLSearchParams({
        auth: 'success',
        token: token,
        refreshToken: refreshToken,
        user: JSON.stringify(userData)
      });

      const redirectUrl = `${frontendUrl}/?${queryParams.toString()}`;
      
      logger.info('✅ Google OAuth completado exitosamente:', {
        userId: user.id,
        username: user.username,
        userType: user.userType,
        redirectUrl: `${frontendUrl}/?auth=success`
      });

      logger.logAuth('google_oauth_complete', user.id, user.email, true, {
        userType: user.userType,
        ip: req.ip
      });
      
      res.redirect(redirectUrl);

    } catch (error) {
      logger.error('💥 Error generando tokens para Google OAuth:', error);
      
      // Limpiar sesión
      delete req.session.pendingUserType;
      
      const errorMessage = encodeURIComponent('Error interno del servidor');
      const redirectUrl = `${frontendUrl}/?auth=error&message=${errorMessage}`;
      res.redirect(redirectUrl);
    }
  })(req, res, next);
};

module.exports = {
  configurePassport,
  optionalPassportAuth,
  requiredPassportAuth,
  initiateGoogleAuth,
  handleGoogleCallback
};