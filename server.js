const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const morgan = require('morgan');
require('dotenv').config();

const app = require('./src/app');
const { setupSocketAuth, setupChatSocket } = require('./src/sockets');
const logger = require('./src/utils/logger');

// NUEVA IMPORTACIÓN: Configuración de Cloudinary
const { configureCloudinary } = require('./src/config/cloudinary');

const PORT = process.env.PORT || 3000;

// ✅ MIDDLEWARE DE LOGGING SIMPLIFICADO PARA EVITAR CONFLICTOS
const setupRequestLogging = () => {
  // Solo logging básico en desarrollo
  if (process.env.NODE_ENV === 'development') {
    // ✅ REMOVIDO EL MIDDLEWARE QUE INTERCEPTABA res.send
    // Eso estaba causando problemas con el parsing de JSON
    
    // Solo log de requests críticos
    app.use((req, res, next) => {
      if (req.method === 'PUT' && req.originalUrl.includes('/profile')) {
        logger.info('📨 PROFILE UPDATE REQUEST:', {
          method: req.method,
          url: req.originalUrl,
          contentType: req.get('Content-Type'),
          contentLength: req.get('Content-Length'),
          hasBody: !!req.body,
          bodyKeys: Object.keys(req.body || {}),
          timestamp: new Date().toISOString()
        });
      }
      next();
    });
  }
};

// MIDDLEWARE PARA CAPTURAR ERRORES DE PARSING - SIMPLIFICADO
const setupErrorLogging = () => {
  // Error de parsing JSON
  app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      logger.error('💥 JSON PARSING ERROR:', {
        message: err.message,
        url: req.originalUrl,
        method: req.method,
        contentType: req.get('Content-Type'),
        contentLength: req.get('Content-Length'),
        ip: req.ip
      });
      
      return res.status(400).json({
        success: false,
        message: 'JSON inválido en el body de la petición',
        errorCode: 'INVALID_JSON'
      });
    }
    next(err);
  });

  // Handler de errores global simplificado
  app.use((err, req, res, next) => {
    // Solo log errores realmente importantes
    if (err.status >= 500 || !err.status) {
      logger.error('💥 SERVER ERROR:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        url: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    }

    res.status(err.status || 500).json({
      success: false,
      message: process.env.NODE_ENV === 'development' ? err.message : 'Error interno del servidor',
      errorCode: err.errorCode || 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  });
};

// INICIALIZAR SERVICIOS
const initializeServices = async () => {
  try {
    // Configurar Cloudinary
    const cloudinaryConfigured = configureCloudinary();
    
    if (cloudinaryConfigured) {
      logger.info('✅ Cloudinary configurado correctamente');
      logger.info(`📦 Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
      logger.info('🔄 Modo: Memory storage (Production ready)');
    } else {
      logger.warn('⚠️  Cloudinary no configurado - usando almacenamiento local');
      logger.warn('🔧 Para producción, configura las variables CLOUDINARY_*');
    }

    // Verificar variables de entorno críticas
    const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      logger.error('❌ Variables de entorno faltantes:', missingVars);
      process.exit(1);
    }

    // Log de configuración de upload
    logger.info('📁 Configuración de uploads:', {
      cloudinaryEnabled: cloudinaryConfigured,
      environment: process.env.NODE_ENV,
      uploadMode: cloudinaryConfigured ? 'cloudinary' : 'local',
      maxFileSize: {
        avatar: '3MB',
        post: '8MB',
        chat: '5MB',
        document: '10MB'
      }
    });

    // ✅ CONFIGURAR LOGGING DE REQUESTS - SIMPLIFICADO
    setupRequestLogging();
    setupErrorLogging();
    logger.info('✅ Request logging configurado (simplificado)');

  } catch (error) {
    logger.error('Error inicializando servicios:', error);
    process.exit(1);
  }
};

// Crear servidor HTTP
const server = http.createServer(app);

// Configurar Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// ✅ LOGGING PARA SOCKET.IO - SIMPLIFICADO
io.on('connection', (socket) => {
  logger.info('🔌 SOCKET CONNECTED:', {
    socketId: socket.id,
    ip: socket.handshake.address,
    timestamp: new Date().toISOString()
  });

  socket.on('disconnect', (reason) => {
    logger.info('🔌 SOCKET DISCONNECTED:', {
      socketId: socket.id,
      reason,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('error', (error) => {
    logger.error('💥 SOCKET ERROR:', {
      socketId: socket.id,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  });
});

// Configurar autenticación de sockets
setupSocketAuth(io);

// Configurar eventos de chat
setupChatSocket(io);

// Hacer io disponible globalmente
app.set('io', io);

// FUNCIÓN DE INICIO OPTIMIZADA
const startServer = async () => {
  try {
    // Inicializar servicios primero
    await initializeServices();

    // Iniciar servidor
    server.listen(PORT, () => {
      logger.info('🚀 Servidor iniciado exitosamente');
      logger.info(`📱 API URL: http://localhost:${PORT}/api`);
      logger.info(`📚 Documentación: http://localhost:${PORT}/api-docs`);
      logger.info(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔌 Socket.IO: Habilitado`);
      logger.info(`💾 Base de datos: Conectada`);
      logger.info(`📋 Request logging: Simplificado para evitar conflictos`);
      
      // Log de servicios externos
      const services = [];
      if (process.env.CLOUDINARY_CLOUD_NAME) services.push('Cloudinary');
      if (process.env.GOOGLE_CLIENT_ID) services.push('Google OAuth');
      if (process.env.STRIPE_SECRET_KEY) services.push('Stripe');
      
      if (services.length > 0) {
        logger.info(`🔗 Servicios externos: ${services.join(', ')}`);
      }

      logger.info('=====================================');
      logger.info('🧪 Prueba tu API con: curl -X POST http://localhost:' + PORT + '/api/test/json -H "Content-Type: application/json" -d \'{"test":"data"}\'');
      logger.info('=====================================');
    });

  } catch (error) {
    logger.error('Error iniciando servidor:', error);
    process.exit(1);
  }
};

// Manejo de errores del servidor
server.on('error', (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

  switch (error.code) {
    case 'EACCES':
      logger.error(`❌ ${bind} requiere privilegios elevados`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.error(`❌ ${bind} ya está en uso`);
      process.exit(1);
      break;
    default:
      logger.error('Error del servidor:', error);
      throw error;
  }
});

// MANEJO DE CIERRE GRACEFUL
const gracefulShutdown = (signal) => {
  logger.info(`📡 ${signal} recibido, iniciando cierre graceful...`);
  
  server.close((err) => {
    if (err) {
      logger.error('Error cerrando servidor HTTP:', err);
      process.exit(1);
    }
    
    logger.info('✅ Servidor HTTP cerrado');
    
    io.close(() => {
      logger.info('✅ Socket.IO cerrado');
    });
    
    logger.info('✅ Aplicación cerrada correctamente');
    process.exit(0);
  });

  // Forzar cierre después de 30 segundos
  setTimeout(() => {
    logger.error('⏰ Tiempo de cierre excedido, forzando salida...');
    process.exit(1);
  }, 30000);
};

// Manejo de señales del sistema
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// MANEJO DE ERRORES NO CAPTURADOS
process.on('uncaughtException', (error) => {
  logger.error('💥 Error no capturado:', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  
  if (process.env.NODE_ENV === 'development') {
    console.error(error);
  }
  
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Promise rechazada no manejada:', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    timestamp: new Date().toISOString()
  });
  
  if (process.env.NODE_ENV === 'development') {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  }
  
  process.exit(1);
});

// INICIAR LA APLICACIÓN
startServer();

module.exports = server;