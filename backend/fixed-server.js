// fixed-server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

// Logger simple para depuración
const simpleLogger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg, obj) => console.error(`[ERROR] ${msg}`, obj),
  debug: (msg) => console.log(`[DEBUG] ${msg}`)
};

// Crear una aplicación express básica
const app = express();

// Middleware básico
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ message: 'API TeLoFundi - Servidor de Prueba', time: new Date().toISOString() });
});

app.get('/api', (req, res) => {
  res.json({ message: 'API de TeLoFundi - Endpoint de API funcionando' });
});

// Instancia de Prisma
const prisma = new PrismaClient();

// Puerto del servidor
const PORT = process.env.PORT || 5000;

// Iniciar el servidor
async function startServer() {
  try {
    console.log('Iniciando servidor...');
    console.log(`Puerto configurado: ${PORT}`);
    console.log(`Modo: ${process.env.NODE_ENV || 'development'}`);
    
    console.log('Intentando conectar a la base de datos...');
    await prisma.$connect();
    console.log('Conexión a la base de datos establecida correctamente');
    
    // Verificar que la tabla 'system_settings' existe
    try {
      const count = await prisma.$queryRaw`SELECT COUNT(*) FROM system_settings`;
      console.log('Tabla system_settings verificada correctamente');
    } catch (error) {
      console.error('Error verificando tabla system_settings. La base de datos puede necesitar migración:', error.message);
    }
    
    // Iniciar el servidor
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en el puerto ${PORT} en modo ${process.env.NODE_ENV || 'development'}`);
    });
    
    return true;
  } catch (error) {
    console.error(`Error iniciando el servidor: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Manejar excepciones no capturadas
process.on('uncaughtException', (err) => {
  console.error('Excepción no capturada:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesa rechazada no manejada:', reason);
});

// Iniciar el servidor
console.log('Preparando inicio de TeLoFundi API...');
startServer()
  .then(() => console.log('Servidor iniciado exitosamente'))
  .catch(err => {
    console.error('Error fatal al iniciar el servidor:', err);
    process.exit(1);
  });