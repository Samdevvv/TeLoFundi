const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const passport = require('passport');

// NUEVAS IMPORTACIONES PARA CLOUDINARY
const { configureCloudinary } = require('./config/cloudinary');
const { handleMulterError } = require('./middleware/upload');

// Importar configuraciones
const { setupSwagger } = require('./config/swagger');
const { configurePassport } = require('./config/auth');
const corsConfig = require('./middleware/cors');
const { globalErrorHandler } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');
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

// Configurar Passport
configurePassport();

// MIDDLEWARES DE SEGURIDAD CON CLOUDINARY
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      // AGREGAR DOMINIOS DE CLOUDINARY PARA IMÁGENES
      imgSrc: [
        "'self'", 
        "data:", 
        "https://res.cloudinary.com",
        "https://cloudinary.com",
        "https://*.cloudinary.com"  // Para diferentes CDN regions
      ],
      // PERMITIR CONEXIONES A CLOUDINARY PARA UPLOADS
      connectSrc: [
        "'self'",
        "https://api.cloudinary.com",
        "https://res.cloudinary.com"
      ],
      // PERMITIR FORMULARIOS MULTIPART PARA UPLOADS
      formAction: ["'self'"]
    },
  },
}));

// CORS
app.use(corsConfig);

// Compresión
app.use(compression());

// Rate limiting
app.use('/api/', generalLimiter);

// Logger HTTP
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('combined', { 
    stream: { 
      write: message => logger.info(message.trim()) 
    },
    skip: (req, res) => {
      // No loggear uploads de archivos para evitar spam
      return req.url.includes('/upload') || req.url.includes('/messages');
    }
  }));
} else {
  app.use(morgan('common', { 
    stream: { 
      write: message => logger.info(message.trim()) 
    }
  }));
}

// PARSERS OPTIMIZADOS PARA UPLOADS
app.use(express.json({ 
  limit: '15mb',  // Aumentado para metadata de Cloudinary
  verify: (req, res, buf) => {
    // Agregar información del body size para monitoring
    req.bodySize = buf.length;
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '15mb',
  parameterLimit: 50  // Límite de parámetros para seguridad
}));

// Inicializar Passport
app.use(passport.initialize());

// MIDDLEWARE PARA INFORMACIÓN DE UPLOAD EN HEADERS
app.use((req, res, next) => {
  // Agregar headers útiles para el frontend
  res.set({
    'X-Upload-Enabled': cloudinaryEnabled ? 'cloudinary' : 'local',
    'X-Max-File-Size': '8MB',
    'X-Supported-Formats': 'jpg,jpeg,png,webp,gif,pdf,doc,docx'
  });
  
  // Información de limits por tipo de usuario en development
  if (process.env.NODE_ENV === 'development' && req.user) {
    res.set('X-User-Type', req.user.userType);
  }
  
  next();
});

// SERVIR ARCHIVOS ESTÁTICOS (Solo para desarrollo/fallback)
if (!cloudinaryEnabled || process.env.NODE_ENV === 'development') {
  app.use('/uploads', express.static('imagenes', {
    maxAge: '1d',  // Cache de 1 día
    etag: true,
    lastModified: true
  }));
  logger.info('📁 Static file serving enabled for local storage');
}

// HEALTH CHECK MEJORADO
app.get('/health', async (req, res) => {
  const healthData = {
    success: true,
    message: 'TeLoFundi API está funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database: 'connected',  // Podrías agregar verificación real
      cloudinary: cloudinaryEnabled ? 'enabled' : 'disabled',
      storage: cloudinaryEnabled ? 'cloudinary' : 'local'
    },
    limits: {
      maxFileSize: '8MB',
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'doc', 'docx'],
      maxFilesPerUpload: 5
    }
  };

  // En production, agregar verificación real de servicios
  if (process.env.NODE_ENV === 'production') {
    try {
      // Verificar Cloudinary si está habilitado
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

// ENDPOINT PARA INFORMACIÓN DE UPLOAD (Útil para frontend)
app.get('/api/upload/info', (req, res) => {
  const uploadInfo = {
    success: true,
    data: {
      enabled: true,
      provider: cloudinaryEnabled ? 'cloudinary' : 'local',
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
        cdnDelivery: cloudinaryEnabled
      }
    },
    timestamp: new Date().toISOString()
  };

  // Agregar límites específicos por tipo de usuario si está autenticado
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

// Rutas principales
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
    features: {
      cloudinaryEnabled,
      fileUploads: true,
      realTimeChat: true,
      userProfiles: true,
      postManagement: true
    }
  });
});

// MIDDLEWARE PARA MANEJO DE ERRORES DE MULTER/CLOUDINARY
app.use(handleMulterError);

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta ${req.originalUrl} no encontrada`,
    documentation: '/api-docs',
    suggestion: 'Verifica la URL o consulta la documentación'
  });
});

// MIDDLEWARE GLOBAL DE MANEJO DE ERRORES MEJORADO
app.use((error, req, res, next) => {
  // Log específico para errores de upload
  if (error.code && error.code.startsWith('UPLOAD_')) {
    logger.error('Upload error:', {
      code: error.code,
      message: error.message,
      userId: req.user?.id,
      fileInfo: {
        fieldname: req.file?.fieldname,
        size: req.file?.size,
        mimetype: req.file?.mimetype
      }
    });
  }
  
  // Log específico para errores de Cloudinary
  if (error.message && error.message.includes('cloudinary')) {
    logger.error('Cloudinary error:', {
      message: error.message,
      userId: req.user?.id,
      endpoint: req.originalUrl
    });
  }
  
  // Pasar al handler global
  globalErrorHandler(error, req, res, next);
});

// FUNCIONES DE UTILIDAD PARA MONITOREO
const getAppStatus = () => {
  return {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cloudinaryEnabled,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  };
};

// Agregar función al app para acceso externo
app.getStatus = getAppStatus;

// LOGGING DE INICIO
logger.info('🚀 Express app configured with features:', {
  cloudinary: cloudinaryEnabled,
  environment: process.env.NODE_ENV,
  cors: true,
  compression: true,
  rateLimiting: true,
  swagger: true,
  staticFiles: !cloudinaryEnabled,
  security: 'helmet + CSP'
});

module.exports = app;