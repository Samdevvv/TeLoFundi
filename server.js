const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = require('./src/app');
const { setupSocketAuth, setupChatSocket } = require('./src/sockets');
const logger = require('./src/utils/logger');

// NUEVA IMPORTACIÓN: Configuración de Cloudinary
const { configureCloudinary } = require('./src/config/cloudinary');

const PORT = process.env.PORT || 3000;

// INICIALIZAR CLOUDINARY AL ARRANCAR
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
      
      // Log de servicios externos
      const services = [];
      if (process.env.CLOUDINARY_CLOUD_NAME) services.push('Cloudinary');
      if (process.env.GOOGLE_CLIENT_ID) services.push('Google OAuth');
      if (process.env.STRIPE_SECRET_KEY) services.push('Stripe');
      
      if (services.length > 0) {
        logger.info(`🔗 Servicios externos: ${services.join(', ')}`);
      }

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

// MANEJO DE CIERRE GRACEFUL MEJORADO
const gracefulShutdown = (signal) => {
  logger.info(`📡 ${signal} recibido, iniciando cierre graceful...`);
  
  // Cerrar servidor HTTP
  server.close((err) => {
    if (err) {
      logger.error('Error cerrando servidor HTTP:', err);
      process.exit(1);
    }
    
    logger.info('✅ Servidor HTTP cerrado');
    
    // Cerrar conexiones de Socket.IO
    io.close(() => {
      logger.info('✅ Socket.IO cerrado');
    });

    // Aquí podrías agregar limpieza de otros recursos:
    // - Cerrar conexiones de base de datos
    // - Cancelar tareas programadas
    // - Limpiar archivos temporales
    
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

// MANEJO DE ERRORES NO CAPTURADOS MEJORADO
process.on('uncaughtException', (error) => {
  logger.error('💥 Error no capturado:', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  
  // En desarrollo, mostrar el error completo
  if (process.env.NODE_ENV === 'development') {
    console.error(error);
  }
  
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Promise rechazada no manejada:', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString(),
    timestamp: new Date().toISOString()
  });
  
  // En desarrollo, mostrar el error completo
  if (process.env.NODE_ENV === 'development') {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  }
  
  process.exit(1);
});

// MONITOREO DE MEMORIA (OPCIONAL)
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    logger.debug('Uso de memoria:', {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
    });
  }, 30000); // Cada 30 segundos
}

// INICIAR LA APLICACIÓN
startServer();

module.exports = server;