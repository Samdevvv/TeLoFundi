// src/server.js
require('dotenv').config();
const http = require('http');
const app = require('./app');
const logger = require('./utils/logger');
const { PrismaClient } = require('@prisma/client');

// Instancia de Prisma
const prisma = new PrismaClient();

// Puerto del servidor
const PORT = process.env.PORT || 5000;

// Crear servidor HTTP
const server = http.createServer(app);

// Manejar cierre adecuado de conexiones
async function gracefulShutdown(signal) {
  logger.info(`${signal} recibido. Cerrando servidor...`);
  
  server.close(async () => {
    logger.info('Servidor HTTP cerrado.');
    
    try {
      // Cerrar la conexión de Prisma
      await prisma.$disconnect();
      logger.info('Conexión a la base de datos cerrada.');
      process.exit(0);
    } catch (err) {
      logger.error('Error al cerrar conexión de BD:', err);
      process.exit(1);
    }
  });
}

// Escuchar peticiones
server.listen(PORT, async () => {
  logger.info(`Servidor corriendo en el puerto ${PORT} en modo ${process.env.NODE_ENV || 'development'}`);
  
  try {
    // Probar conexión con la base de datos
    await prisma.$connect();
    logger.info('Conexión a la base de datos establecida correctamente');
  } catch (error) {
    logger.error(`Error conectando a la base de datos: ${error.message}`, { error });
    // No cerramos el servidor, sólo logueamos el error
  }
});

// Manejar señales de cierre
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Manejar excepciones no capturadas
process.on('uncaughtException', (err) => {
  logger.error('Excepción no capturada:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Promesa rechazada no manejada:', { reason, promise });
});