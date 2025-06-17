const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const { prisma } = require('./database');
const logger = require('../utils/logger');

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
          settings: true
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

// Configurar estrategia de Google OAuth
const configureGoogleStrategy = () => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    logger.warn('Google OAuth no configurado - faltan variables de entorno');
    return;
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
      logger.info('Google OAuth callback received', {
        profileId: profile.id,
        email: profile.emails?.[0]?.value
      });

      const email = profile.emails?.[0]?.value;
      const firstName = profile.name?.givenName || '';
      const lastName = profile.name?.familyName || '';
      const avatar = profile.photos?.[0]?.value || null;

      if (!email) {
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
          settings: true
        }
      });

      if (user) {
        // Usuario ya existe - actualizar información de Google si es necesario
        if (!user.avatar && avatar) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { 
              avatar,
              lastLogin: new Date(),
              lastActiveAt: new Date()
            },
            include: {
              escort: true,
              agency: true,
              client: true,
              admin: true,
              settings: true
            }
          });
        } else {
          // Solo actualizar timestamps
          user = await prisma.user.update({
            where: { id: user.id },
            data: { 
              lastLogin: new Date(),
              lastActiveAt: new Date()
            },
            include: {
              escort: true,
              agency: true,
              client: true,
              admin: true,
              settings: true
            }
          });
        }

        if (!user.isActive) {
          return done(new Error('Cuenta desactivada'), null);
        }

        if (user.isBanned) {
          return done(new Error('Cuenta suspendida'), null);
        }

        logger.logAuth('google_login', user.id, user.email, true, {
          method: 'google_oauth',
          existing_user: true
        });

        return done(null, user);
      }

      // Usuario no existe - determinar tipo de usuario desde la sesión o query params
      const userType = req.session?.pendingUserType || req.query?.userType || 'CLIENT';
      
      if (!['ESCORT', 'AGENCY', 'CLIENT'].includes(userType)) {
        return done(new Error('Tipo de usuario no válido'), null);
      }

      // Generar username único basado en el email
      let username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
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
      }

      // Crear nuevo usuario con Google OAuth
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
          lastLogin: new Date(),
          lastActiveAt: new Date(),
          // Crear registros específicos según el tipo de usuario
          ...(userType === 'ESCORT' && {
            escort: {
              create: {
                maxPosts: 5,
                currentPosts: 0
              }
            }
          }),
          ...(userType === 'AGENCY' && {
            agency: {
              create: {}
            }
          }),
          ...(userType === 'CLIENT' && {
            client: {
              create: {
                points: 10, // Puntos de bienvenida
                premiumTier: 'BASIC',
                dailyMessageLimit: 10
              }
            }
          }),
          settings: {
            create: {
              emailNotifications: true,
              pushNotifications: true,
              showInDiscovery: userType !== 'CLIENT' // Clientes ocultos por defecto
            }
          }
        },
        include: {
          escort: true,
          agency: true,
          client: true,
          admin: true,
          settings: true
        }
      });

      logger.logAuth('google_register', user.id, user.email, true, {
        method: 'google_oauth',
        userType,
        new_user: true
      });

      return done(null, user);

    } catch (error) {
      logger.error('Error en Google OAuth Strategy:', error);
      logger.logAuth('google_auth', null, profile.emails?.[0]?.value, false, {
        error: error.message,
        profileId: profile.id
      });
      return done(error, null);
    }
  }));
};

// Serialización para sesiones (aunque usaremos JWT principalmente)
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
        settings: true
      }
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Función principal para configurar todas las estrategias
const configurePassport = () => {
  configureJwtStrategy();
  configureGoogleStrategy();
  
  logger.info('🔐 Passport configurado correctamente');
};

// Middleware para autenticación opcional con Passport
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

// Middleware para autenticación requerida con Passport
const requiredPassportAuth = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      logger.error('Error en autenticación requerida:', err);
      return res.status(500).json({
        success: false,
        message: 'Error interno de autenticación',
        errorCode: 'AUTH_INTERNAL_ERROR'
      });
    }
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: info?.message || 'Token de acceso inválido',
        errorCode: 'INVALID_TOKEN'
      });
    }
    
    req.user = user;
    next();
  })(req, res, next);
};

// Función para iniciar flujo de Google OAuth
const initiateGoogleAuth = (userType = 'CLIENT') => {
  return (req, res, next) => {
    // Guardar el tipo de usuario para después del callback
    req.session.pendingUserType = userType;
    
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      accessType: 'offline',
      prompt: 'consent'
    })(req, res, next);
  };
};

// Función para manejar callback de Google OAuth
const handleGoogleCallback = (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user, info) => {
    if (err) {
      logger.error('Error en Google OAuth callback:', err);
      
      // Redirigir al frontend con error
      const errorMessage = encodeURIComponent(err.message || 'Error en autenticación con Google');
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/error?message=${errorMessage}`;
      return res.redirect(redirectUrl);
    }
    
    if (!user) {
      logger.warn('Google OAuth callback sin usuario:', info);
      
      const errorMessage = encodeURIComponent('No se pudo autenticar con Google');
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/error?message=${errorMessage}`;
      return res.redirect(redirectUrl);
    }
    
    // Generar JWT para el usuario
    const { generateToken } = require('../middleware/auth');
    const token = generateToken(user.id);
    
    // Limpiar datos de sesión
    delete req.session.pendingUserType;
    
    // Redirigir al frontend con el token
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/success?token=${token}&user=${encodeURIComponent(JSON.stringify({
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      userType: user.userType,
      avatar: user.avatar
    }))}`;
    
    logger.logAuth('google_oauth_complete', user.id, user.email, true);
    
    res.redirect(redirectUrl);
  })(req, res, next);
};

module.exports = {
  configurePassport,
  optionalPassportAuth,
  requiredPassportAuth,
  initiateGoogleAuth,
  handleGoogleCallback
};