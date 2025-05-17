// src/server.js (modificado con más puntos de diagnóstico)
// Carga las variables de entorno primero
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Intenta diferentes ubicaciones para el archivo .env
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env')
];

let envFound = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`Archivo .env encontrado en: ${envPath}`);
    dotenv.config({ path: envPath });
    envFound = true;
    break;
  }
}

if (!envFound) {
  console.warn('No se encontró el archivo .env en ninguna ubicación esperada');
  // Cargar configuración predeterminada
  dotenv.config();
}

console.log('Importando módulos principales...');
const http = require('http');

// Intercepta cualquier error a partir de este punto
process.on('uncaughtException', (err) => {
  console.error('EXCEPCIÓN NO CAPTURADA en la carga inicial:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('PROMESA RECHAZADA NO MANEJADA en la carga inicial:', reason);
});

console.log('Cargando app.js...');
try {
  const app = require('./app');
  console.log('app.js cargado correctamente');
} catch (error) {
  console.error('ERROR al cargar app.js:', error);
  process.exit(1);
}

console.log('Cargando logger.js...');
try {
  const logger = require('./utils/logger');
  console.log('logger.js cargado correctamente');
} catch (error) {
  console.error('ERROR al cargar logger.js:', error);
  process.exit(1);
}

console.log('Cargando prisma.js...');
try {
  const prisma = require('./config/prisma');
  console.log('prisma.js cargado correctamente');
} catch (error) {
  console.error('ERROR al cargar prisma.js:', error);
  process.exit(1);
}

// Reimportar los módulos ahora que sabemos que se cargan correctamente
const app = require('./app');
const logger = require('./utils/logger');
const prisma = require('./config/prisma');

// Log básico para verificar que el script se está ejecutando
console.log('Iniciando servidor...');

// Puerto del servidor
const PORT = process.env.PORT || 5000;

// Verificar variables de entorno críticas
console.log(`Puerto configurado: ${PORT}`);
console.log(`Modo: ${process.env.NODE_ENV || 'development'}`);
console.log('Variables DB cargadas:', {
  DB_HOST: process.env.DB_HOST || '[no definido]',
  DB_USER: process.env.DB_USER || '[no definido]',
  DB_NAME: process.env.DB_NAME || '[no definido]',
  DATABASE_URL: process.env.DATABASE_URL ? '[definido]' : '[no definido]'
});

// Verificar conexión a la base de datos antes de iniciar el servidor
async function startServer() {
  console.log('Función startServer iniciada');
  try {
    console.log('Intentando conectar a la base de datos...');
    // Probar conexión con la base de datos
    await prisma.$connect();
    console.log('Conexión a la base de datos establecida correctamente');
    
    // Crear servidor HTTP
    console.log('Creando servidor HTTP...');
    const server = http.createServer(app);
    
    // Escuchar peticiones
    console.log('Configurando escucha en puerto', PORT);
    server.listen(PORT, () => {
      console.log(`Servidor corriendo en el puerto ${PORT} en modo ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Servidor corriendo en el puerto ${PORT} en modo ${process.env.NODE_ENV || 'development'}`);
    });
    
    // Manejar señales de cierre
    console.log('Configurando manejadores de señales...');
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM', server));
    process.on('SIGINT', () => gracefulShutdown('SIGINT', server));
    
    console.log('Servidor configurado correctamente');
    return server;
  } catch (error) {
    console.error(`Error conectando a la base de datos: ${error.message}`);
    console.error(error.stack);
    logger.error(`Error conectando a la base de datos: ${error.message}`, { error });
    process.exit(1);
  }
}

// Manejar cierre adecuado de conexiones
async function gracefulShutdown(signal, server) {
  console.log(`${signal} recibido. Cerrando servidor...`);
  logger.info(`${signal} recibido. Cerrando servidor...`);
  
  server.close(async () => {
    console.log('Servidor HTTP cerrado.');
    logger.info('Servidor HTTP cerrado.');
    
    try {
      // Cerrar la conexión de Prisma
      await prisma.$disconnect();
      console.log('Conexión a la base de datos cerrada.');
      logger.info('Conexión a la base de datos cerrada.');
      process.exit(0);
    } catch (err) {
      console.error('Error al cerrar conexión de BD:', err);
      logger.error('Error al cerrar conexión de BD:', err);
      process.exit(1);
    }
  });
}

// Manejar excepciones no capturadas
process.on('uncaughtException', (err) => {
  console.error('Excepción no capturada:', err);
  logger.error('Excepción no capturada:', err);
  // No llamamos a gracefulShutdown aquí para evitar un posible error de referencia al servidor
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesa rechazada no manejada:', reason);
  logger.error('Promesa rechazada no manejada:', { reason, promise });
});

// Iniciar el servidor
console.log('Llamando a startServer()...');
startServer()
  .then(() => {
    console.log('startServer completado exitosamente');
  })
  .catch(err => {
    console.error('Error al iniciar el servidor:', err);
    process.exit(1);
  });
console.log('Función startServer ha sido invocada, esperando resultados...');