const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const passport = require('passport');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

// NUEVAS IMPORTACIONES PARA CLOUDINARY
const { configureCloudinary } = require('./config/cloudinary');

// Importar configuraciones
const { setupSwagger } = require('./config/swagger');
const { configurePassport } = require('./config/auth');
const corsConfig = require('./middleware/cors');
const { globalErrorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Importar rutas
const routes = require('./routes');

const app = express();

// INICIALIZAR CLOUDINARY AL ARRANCAR LA APP
const initializeCloudinary = () => {
  try {
    const isConfigured = configureCloudinary();
    
    if (isConfigured) {
      logger.info('✅ Cloudinary initialized successfully');
      
      // Log de configuración de folders
      logger.info('📁 Cloudinary folders configured:', {
        avatars: 'telofundi/avatars',
        posts: 'telofundi/posts',
        chat: 'telofundi/chat',
        documents: 'telofundi/documents',
        temp: 'telofundi/temp'
      });
      
      // Log de transformaciones disponibles
      logger.info('🔄 Image transformations enabled:', {
        avatar: '400x400 (face-focused)',
        post: '1200x900 (limit)',
        thumbnail: '300x225 (fill)',
        chat: '800x600 (limit)'
      });
      
    } else {
      logger.warn('⚠️  Cloudinary not configured - using local storage');
      logger.warn('💡 Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET for production');
    }
    
    return isConfigured;
  } catch (error) {
    logger.error('❌ Error initializing Cloudinary:', error);
    return false;
  }
};

// Inicializar Cloudinary
const cloudinaryEnabled = initializeCloudinary();

// ✅ FIX CRÍTICO 1: CORS DEBE IR PRIMERO
app.use(corsConfig);

// ✅ FIX CRÍTICO 2: JSON PARSING COMPLETAMENTE CORREGIDO
app.use(express.json({ 
  limit: '15mb',
  strict: true,
  verify: (req, res, buf, encoding) => {
    // Verificación adicional antes del parsing
    const contentType = req.get('content-type') || '';
    
    // ✅ CRÍTICO: Verificar si es FormData ANTES de parsing
    if (contentType.includes('multipart/form-data') || contentType.includes('boundary=')) {
      const error = new Error('FormData detected - should not be processed as JSON');
      error.status = 400;
      error.type = 'FORMDATA_JSON_CONFLICT';
      throw error;
    }
  },
  type: function(req) {
    const contentType = req.get('content-type') || '';
    
    // ✅ CRÍTICO: Log detallado para debugging uploads
    if (req.originalUrl.includes('/posts') && req.method === 'POST') {
      console.log('🔍 === JSON Parser Evaluation ===');
      console.log('🔍 Content-Type:', contentType);
      console.log('🔍 URL:', req.originalUrl);
      console.log('🔍 Method:', req.method);
    }
    
    // ✅ CRÍTICO: RECHAZAR EXPLÍCITAMENTE TODO FormData
    if (contentType.includes('multipart/form-data')) {
      console.log('❌ REJECTING multipart/form-data - letting multer handle it');
      return false;
    }
    
    if (contentType.includes('boundary=')) {
      console.log('❌ REJECTING boundary - letting multer handle it');
      return false;
    }
    
    // ✅ CRÍTICO: RECHAZAR application/octet-stream
    if (contentType.includes('application/octet-stream')) {
      console.log('❌ REJECTING octet-stream - binary data');
      return false;
    }
    
    // ✅ CRÍTICO: Solo aceptar JSON puro y explícito
    const isJson = contentType.startsWith('application/json');
    
    if (req.originalUrl.includes('/posts') && req.method === 'POST') {
      console.log('🔍 Is JSON?', isJson);
      console.log('🔍 === End JSON Parser Evaluation ===');
    }
    
    return isJson;
  }
}));

// ✅ URL-encoded parser - MEJORADO para evitar conflictos
app.use(express.urlencoded({ 
  extended: true, 
  limit: '15mb',
  parameterLimit: 50,
  type: function(req) {
    const contentType = req.get('content-type') || '';
    
    // ✅ CRÍTICO: Solo procesar formularios URL-encoded, NUNCA multipart
    if (contentType.includes('multipart/form-data') || contentType.includes('boundary=')) {
      return false;
    }
    
    return contentType.startsWith('application/x-www-form-urlencoded');
  }
}));

// ✅ MIDDLEWARE DE INTERCEPTACIÓN CRÍTICA ANTES DE RUTAS
app.use('/api/posts', (req, res, next) => {
  if (req.method === 'POST') {
    console.log('🚨 === INTERCEPTING POST TO /posts ===');
    console.log('🚨 Content-Type:', req.get('content-type'));
    console.log('🚨 Content-Length:', req.get('content-length'));
    console.log('🚨 Body type:', typeof req.body);
    console.log('🚨 Body keys:', Object.keys(req.body || {}));
    console.log('🚨 Body is empty (should be TRUE for FormData):', Object.keys(req.body || {}).length === 0);
    
    // ✅ VERIFICAR SI EL JSON PARSER INTERCEPTÓ INCORRECTAMENTE
    const isFormData = req.get('content-type')?.includes('multipart');
    const hasBodyContent = Object.keys(req.body || {}).length > 0;
    
    if (isFormData && hasBodyContent) {
      console.error('🚨 🚨 CRITICAL ERROR: JSON PARSER INTERCEPTED FORMDATA! 🚨 🚨');
      console.error('🚨 This should NEVER happen. FormData was parsed as JSON.');
      console.error('🚨 Body content:', req.body);
      
      return res.status(400).json({
        success: false,
        message: 'Error de configuración del servidor: FormData fue parseado como JSON',
        errorCode: 'FORMDATA_PARSING_ERROR',
        details: 'El servidor está mal configurado. Contacta al administrador.',
        debug: {
          contentType: req.get('content-type'),
          bodyType: typeof req.body,
          bodyKeys: Object.keys(req.body || {}),
          hasBodyContent,
          isFormData
        }
      });
    }
    
    if (isFormData) {
      console.log('✅ FormData detected - body is properly empty, multer will handle parsing');
    } else {
      console.log('✅ Non-FormData request - body parsing OK');
    }
    
    console.log('🚨 === END INTERCEPTING ===');
  }
  next();
});

// ✅ FIX CRÍTICO 3: MIDDLEWARE DE DEBUG MEJORADO Y REORGANIZADO
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    // Debug específico para uploads de posts
    if (req.originalUrl.includes('/posts') && req.method === 'POST') {
      console.log('🔍 === POST UPLOAD DEBUG ===');
      console.log('🔍 Method:', req.method);
      console.log('🔍 URL:', req.originalUrl);
      console.log('🔍 Content-Type:', req.get('content-type'));
      console.log('🔍 Content-Length:', req.get('content-length'));
      console.log('🔍 Is FormData:', req.get('content-type')?.includes('multipart/form-data'));
      console.log('🔍 Is JSON:', req.get('content-type')?.includes('application/json'));
      console.log('🔍 Body parsed by middleware:', !!req.body && typeof req.body === 'object');
      console.log('🔍 Body keys count:', Object.keys(req.body || {}).length);
      
      // ✅ VALIDACIÓN CRÍTICA
      if (req.get('content-type')?.includes('multipart') && Object.keys(req.body || {}).length > 0) {
        console.error('❌ ❌ CRITICAL: FormData has body content - JSON parser intercepted! ❌ ❌');
      } else if (req.get('content-type')?.includes('multipart')) {
        console.log('✅ FormData correctly has empty body - multer will handle it');
      }
      
      console.log('🔍 === END DEBUG ===');
    }
    
    // Debug para updates de perfil
    if (req.method === 'PUT' && req.originalUrl.includes('/profile') && !req.originalUrl.includes('/picture')) {
      console.log('🔍 === PROFILE UPDATE DEBUG ===');
      console.log('🔍 Method:', req.method);
      console.log('🔍 URL:', req.originalUrl);
      console.log('🔍 Content-Type:', req.get('content-type'));
      console.log('🔍 Body exists:', !!req.body);
      console.log('🔍 Body type:', typeof req.body);
      console.log('🔍 Body keys:', Object.keys(req.body || {}));
      
      if (req.body && Object.keys(req.body).length > 0) {
        console.log('🔍 Body preview:', JSON.stringify(req.body).substring(0, 200) + '...');
      } else {
        console.log('❌ Body is empty or null!');
      }
      console.log('🔍 === END DEBUG ===');
    }
    
    next();
  });
}

// ✅ CONFIGURAR SESIONES (OBLIGATORIO PARA GOOGLE OAUTH)
app.use(session({
  secret: process.env.JWT_SECRET || 'TeLoFundi_Session_Secret_2025',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 15, // 15 minutos
    httpOnly: true
  },
  name: 'telofundi.sid'
}));

// ✅ CONFIGURAR PASSPORT (DESPUÉS DE SESIONES)
app.use(passport.initialize());
app.use(passport.session());

// Configurar estrategias de Passport
configurePassport();

// MIDDLEWARES DE SEGURIDAD CON CLOUDINARY
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: [
        "'self'", 
        "data:", 
        "https://res.cloudinary.com",
        "https://cloudinary.com",
        "https://*.cloudinary.com"
      ],
      connectSrc: [
        "'self'",
        "https://api.cloudinary.com",
        "https://res.cloudinary.com"
      ],
      formAction: ["'self'"]
    },
  },
}));

// Compresión
app.use(compression());

// ✅ RATE LIMITING - DESACTIVADO CONDICIONALMENTE
const createRateLimitMiddleware = () => {
  // Si DISABLE_RATE_LIMIT está en true, retornar middleware que no hace nada
  if (process.env.DISABLE_RATE_LIMIT === 'true') {
    console.log('🚫 Rate limiting DESACTIVADO por variable de entorno');
    logger.info('🚫 Rate limiting DESACTIVADO por variable de entorno DISABLE_RATE_LIMIT=true');
    return (req, res, next) => next(); // No-op middleware
  }

  // Si no está desactivado, crear rate limiter normal
  console.log('🛡️ Rate limiting ACTIVADO');
  logger.info('🛡️ Rate limiting ACTIVADO');
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos por defecto
    max: (req) => {
      if (req.user) {
        switch (req.user.userType) {
          case 'ADMIN': return 1000;
          case 'AGENCY': return 500;
          case 'ESCORT': return 200;
          case 'CLIENT': return parseInt(process.env.RATE_LIMIT_MAX) || 100;
          default: return parseInt(process.env.RATE_LIMIT_MAX) || 100;
        }
      }
      return 50; // Usuarios no autenticados
    },
    message: {
      success: false,
      message: 'Demasiadas peticiones desde esta IP, intenta de nuevo más tarde.',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutos'
    },
    standardHeaders: true, // Retorna rate limit info en headers `RateLimit-*`
    legacyHeaders: false, // Desactiva headers `X-RateLimit-*`
    // Personalizar según el endpoint
    keyGenerator: (req) => {
      // Si el usuario está autenticado, usar su ID + IP
      if (req.user) {
        return `user:${req.user.id}:${req.ip}`;
      }
      // Si no, solo IP
      return req.ip;
    }
  });
};

// Aplicar el middleware condicional de rate limiting general
const rateLimitMiddleware = createRateLimitMiddleware();
app.use(rateLimitMiddleware);

// Rate limiting específico para auth endpoints (más estricto)
const authRateLimit = process.env.DISABLE_RATE_LIMIT === 'true' 
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 5, // Solo 5 intentos de login por IP cada 15 minutos
      message: {
        success: false,
        message: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.',
        errorCode: 'AUTH_RATE_LIMIT_EXCEEDED'
      }
    });

// Rate limiting para uploads (más permisivo)
const uploadRateLimit = process.env.DISABLE_RATE_LIMIT === 'true'
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 60 * 1000, // 1 minuto
      max: 10, // 10 uploads por minuto
      message: {
        success: false,
        message: 'Demasiados uploads. Espera un momento antes de subir más archivos.',
        errorCode: 'UPLOAD_RATE_LIMIT_EXCEEDED'
      }
    });

// Logger HTTP - SIMPLIFICADO
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev', { 
    stream: { 
      write: message => logger.info(message.trim()) 
    },
    skip: (req, res) => {
      return req.url.includes('/upload') || req.url.includes('/messages');
    }
  }));
}

// MIDDLEWARE PARA INFORMACIÓN DE UPLOAD EN HEADERS
app.use((req, res, next) => {
  res.set({
    'X-Upload-Enabled': cloudinaryEnabled ? 'cloudinary' : 'local',
    'X-Max-File-Size': '8MB',
    'X-Supported-Formats': 'jpg,jpeg,png,webp,gif,pdf,doc,docx',
    'X-Rate-Limiting': process.env.DISABLE_RATE_LIMIT === 'true' ? 'disabled' : 'enabled'
  });
  
  if (process.env.NODE_ENV === 'development' && req.user) {
    res.set('X-User-Type', req.user.userType);
  }
  
  next();
});

// SERVIR ARCHIVOS ESTÁTICOS (Solo para desarrollo/fallback)
if (!cloudinaryEnabled || process.env.NODE_ENV === 'development') {
  app.use('/uploads', express.static('imagenes', {
    maxAge: '1d',
    etag: true,
    lastModified: true
  }));
  logger.info('📁 Static file serving enabled for local storage');
}

// ✅ MIDDLEWARE DE VALIDACIÓN FINAL ANTES DE RUTAS
app.use((req, res, next) => {
  // Solo para requests de POST a rutas de upload
  if (req.method === 'POST' && (
    req.originalUrl.includes('/posts') || 
    req.originalUrl.includes('/upload') ||
    req.originalUrl.includes('/picture')
  )) {
    const contentType = req.get('content-type') || '';
    const isFormData = contentType.includes('multipart/form-data');
    const hasBody = req.body && Object.keys(req.body).length > 0;
    
    console.log('🔍 === FINAL VALIDATION BEFORE ROUTES ===');
    console.log('🔍 Endpoint:', req.originalUrl);
    console.log('🔍 Is FormData:', isFormData);
    console.log('🔍 Has body content:', hasBody);
    console.log('🔍 Expected behavior:', isFormData ? 'Body should be empty' : 'Body can have content');
    
    // ✅ Si es FormData pero tiene contenido en body, es un error crítico
    if (isFormData && hasBody) {
      console.error('🚨 BLOCKING REQUEST: FormData was parsed by JSON middleware');
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor: Configuración de parsers incorrecta',
        errorCode: 'SERVER_PARSER_MISCONFIGURATION',
        details: 'FormData está siendo procesado por JSON parser en lugar de multer',
        timestamp: new Date().toISOString(),
        debug: process.env.NODE_ENV === 'development' ? {
          contentType,
          bodyKeys: Object.keys(req.body),
          bodyType: typeof req.body
        } : undefined
      });
    }
    
    console.log('✅ Validation passed - continuing to routes');
    console.log('🔍 === END FINAL VALIDATION ===');
  }
  
  next();
});

// HEALTH CHECK MEJORADO
app.get('/health', async (req, res) => {
  const healthData = {
    success: true,
    message: 'TeLoFundi API está funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database: 'connected',
      cloudinary: cloudinaryEnabled ? 'enabled' : 'disabled',
      storage: cloudinaryEnabled ? 'cloudinary' : 'local',
      session: 'enabled',
      passport: 'enabled',
      rateLimiting: process.env.DISABLE_RATE_LIMIT === 'true' ? 'disabled' : 'enabled',
      jsonParser: 'FIXED - Enhanced with verify function and FormData protection'
    },
    limits: {
      maxFileSize: '8MB',
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'doc', 'docx'],
      maxFilesPerUpload: 5,
      rateLimiting: process.env.DISABLE_RATE_LIMIT === 'true' ? 'DISABLED' : 'ENABLED'
    }
  };

  if (process.env.NODE_ENV === 'production') {
    try {
      if (cloudinaryEnabled) {
        const { getCloudinaryUsage } = require('./services/uploadService');
        const usage = await getCloudinaryUsage();
        if (usage) {
          healthData.services.cloudinary = 'healthy';
          healthData.cloudinaryStatus = {
            plan: usage.plan,
            creditsUsed: usage.credits?.used || 0,
            storageUsed: usage.storage?.used || 0
          };
        }
      }
    } catch (error) {
      logger.error('Health check - Cloudinary verification failed:', error);
      healthData.services.cloudinary = 'error';
    }
  }

  res.status(200).json(healthData);
});

// ✅ ENDPOINT DE TEST PARA FORMDATA
app.post('/api/test/formdata', (req, res) => {
  console.log('🧪 === FORMDATA TEST ENDPOINT ===');
  console.log('🧪 Content-Type:', req.get('content-type'));
  console.log('🧪 Body received:', req.body);
  console.log('🧪 Has FormData:', req.get('content-type')?.includes('multipart/form-data'));
  console.log('🧪 Body should be empty for FormData:', Object.keys(req.body || {}).length === 0);
  
  res.json({
    success: true,
    message: 'FormData test endpoint',
    contentType: req.get('content-type'),
    hasFormData: req.get('content-type')?.includes('multipart/form-data'),
    bodyEmpty: Object.keys(req.body || {}).length === 0,
    bodyKeys: Object.keys(req.body || {}),
    expectedBehavior: 'Body should be empty for FormData - multer will handle parsing',
    rateLimitingStatus: process.env.DISABLE_RATE_LIMIT === 'true' ? 'DISABLED' : 'ENABLED',
    timestamp: new Date().toISOString()
  });
});

// ✅ ENDPOINT DE TEST JSON (MANTENER)
app.post('/api/test/json', (req, res) => {
  console.log('🧪 === JSON TEST ENDPOINT ===');
  console.log('🧪 Content-Type:', req.get('content-type'));
  console.log('🧪 Content-Length:', req.get('content-length'));
  console.log('🧪 Body received:', req.body);
  console.log('🧪 Body type:', typeof req.body);
  console.log('🧪 Body keys:', Object.keys(req.body || {}));
  
  res.json({
    success: true,
    message: 'JSON parsing test successful',
    received: req.body,
    bodyKeys: Object.keys(req.body || {}),
    bodyType: typeof req.body,
    contentType: req.get('content-type'),
    contentLength: req.get('content-length'),
    rateLimitingStatus: process.env.DISABLE_RATE_LIMIT === 'true' ? 'DISABLED' : 'ENABLED',
    timestamp: new Date().toISOString()
  });
});

// ENDPOINT PARA INFORMACIÓN DE UPLOAD
app.get('/api/upload/info', (req, res) => {
  const uploadInfo = {
    success: true,
    data: {
      enabled: true,
      provider: cloudinaryEnabled ? 'cloudinary' : 'local',
      rateLimiting: process.env.DISABLE_RATE_LIMIT === 'true' ? 'disabled' : 'enabled',
      limits: {
        avatar: { maxSize: '3MB', maxFiles: 1, formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
        post: { maxSize: '8MB', maxFiles: 5, formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
        chat: { maxSize: '5MB', maxFiles: 1, formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
        document: { maxSize: '10MB', maxFiles: 10, formats: ['pdf', 'doc', 'docx'] }
      },
      features: {
        autoOptimization: cloudinaryEnabled,
        variationsGenerated: cloudinaryEnabled,
        transformationsAvailable: cloudinaryEnabled,
        cdnDelivery: cloudinaryEnabled,
        rateLimitingProtection: process.env.DISABLE_RATE_LIMIT !== 'true'
      }
    },
    timestamp: new Date().toISOString()
  };

  if (req.user) {
    const userLimits = {
      CLIENT: { dailyUploads: 10, maxFileSize: '2MB' },
      ESCORT: { dailyUploads: 50, maxFileSize: '8MB' },
      AGENCY: { dailyUploads: 100, maxFileSize: '10MB' },
      ADMIN: { dailyUploads: 'unlimited', maxFileSize: '20MB' }
    };
    
    uploadInfo.data.userLimits = userLimits[req.user.userType] || userLimits.CLIENT;
  }

  res.status(200).json(uploadInfo);
});

// Configurar Swagger
setupSwagger(app);

// ✅ APLICAR RATE LIMITS ESPECÍFICOS A RUTAS ANTES DE LAS RUTAS PRINCIPALES
app.use('/api/auth/login', authRateLimit);
app.use('/api/auth/register', authRateLimit);
app.use('/api/auth/forgot-password', authRateLimit);
app.use('/api/posts', uploadRateLimit);
app.use('/api/upload', uploadRateLimit);
app.use('/api/profile/picture', uploadRateLimit);

// ✅ RUTAS PRINCIPALES
app.use('/api', routes);

// Ruta por defecto
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Bienvenido a TeLoFundi API',
    version: process.env.npm_package_version || '1.0.0',
    documentation: '/api-docs',
    health: '/health',
    api: '/api',
    upload: '/api/upload/info',
    testJson: '/api/test/json',
    testFormData: '/api/test/formdata',
    features: {
      cloudinaryEnabled,
      fileUploads: true,
      realTimeChat: true,
      userProfiles: true,
      postManagement: true,
      googleOAuth: true,
      sessions: true,
      rateLimiting: process.env.DISABLE_RATE_LIMIT === 'true' ? 'DISABLED' : 'ENABLED',
      jsonParser: 'ENHANCED - FormData safe with verify function and interceptors',
      directMulter: true,
      formDataProtection: true
    }
  });
});

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta ${req.originalUrl} no encontrada`,
    documentation: '/api-docs',
    suggestion: 'Verifica la URL o consulta la documentación'
  });
});

// ✅ MIDDLEWARE GLOBAL DE MANEJO DE ERRORES MEJORADO
app.use((error, req, res, next) => {
  // ✅ MANEJO ESPECÍFICO DE ERRORES DE JSON PARSING
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    logger.error('JSON parsing error:', {
      message: error.message,
      endpoint: req.originalUrl,
      contentType: req.get('content-type'),
      contentLength: req.get('content-length')
    });
    
    // ✅ VERIFICAR SI ES UN REQUEST DE FORMDATA MAL MANEJADO
    if (req.get('content-type')?.includes('multipart/form-data')) {
      return res.status(400).json({
        success: false,
        message: 'Error: FormData siendo procesado como JSON',
        errorCode: 'FORMDATA_JSON_CONFLICT',
        details: 'Este endpoint debería procesar FormData con multer, no JSON',
        solution: 'Verifica que multer esté configurado correctamente en la ruta',
        timestamp: new Date().toISOString()
      });
    }
    
    return res.status(400).json({
      success: false,
      message: 'JSON inválido en el cuerpo de la petición',
      errorCode: 'INVALID_JSON',
      details: 'Verifica que el contenido sea JSON válido',
      timestamp: new Date().toISOString()
    });
  }
  
  // ✅ MANEJO ESPECÍFICO DE ERRORES DE VERIFY FUNCTION
  if (error.type === 'FORMDATA_JSON_CONFLICT') {
    logger.warn('FormData detected in JSON parser verify function:', {
      endpoint: req.originalUrl,
      contentType: req.get('content-type'),
      method: req.method
    });
    
    return res.status(400).json({
      success: false,
      message: 'Conflicto de procesamiento: FormData detectado en parser JSON',
      errorCode: 'FORMDATA_JSON_CONFLICT_VERIFY',
      details: 'El JSON parser detectó FormData y bloqueó el procesamiento',
      solution: 'Esta es la protección funcionando correctamente. Verifica el Content-Type del request.',
      timestamp: new Date().toISOString()
    });
  }
  
  // ✅ MANEJO DE ERRORES DE MULTER
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'Archivo demasiado grande',
      errorCode: 'FILE_TOO_LARGE',
      details: `El archivo supera el límite permitido`,
      timestamp: new Date().toISOString()
    });
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Campo de archivo inesperado',
      errorCode: 'UNEXPECTED_FILE_FIELD',
      details: 'El campo de archivo no coincide con la configuración esperada',
      timestamp: new Date().toISOString()
    });
  }
  
  // Pasar al handler global para otros errores
  globalErrorHandler(error, req, res, next);
});

// LOGGING DE INICIO MEJORADO
logger.info('🚀 Express app configured with ENHANCED JSON parser, FormData protection and CONDITIONAL Rate Limiting:', {
  cloudinary: cloudinaryEnabled,
  environment: process.env.NODE_ENV,
  cors: true,
  compression: true,
  rateLimiting: process.env.DISABLE_RATE_LIMIT === 'true' ? 'DISABLED' : 'ENABLED',
  swagger: true,
  staticFiles: !cloudinaryEnabled,
  security: 'helmet + CSP',
  sessions: true,
  passport: true,
  googleOAuth: true,
  jsonParser: 'ENHANCED - FormData safe with verify function and interceptors',
  bodyParser: 'ENHANCED - FormData safe with type filtering',
  directMulter: true,
  formDataProtection: true
});

console.log('✅ App.js COMPLETELY FIXED with CONDITIONAL RATE LIMITING');
console.log('🔒 Protection layers: verify function, type filtering, request interceptors, final validation');
console.log(`🚫 Rate limiting status: ${process.env.DISABLE_RATE_LIMIT === 'true' ? 'DISABLED' : 'ENABLED'}`);

module.exports = app;