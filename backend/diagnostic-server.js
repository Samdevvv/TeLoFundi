// diagnostic-server.js (colocarlo en la raíz del proyecto)
require('dotenv').config();
const express = require('express');
const http = require('http');

// Manejadores de errores globales
process.on('uncaughtException', (err) => {
  console.error('EXCEPCIÓN NO CAPTURADA:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('PROMESA RECHAZADA NO MANEJADA:', reason);
});

// Crear una aplicación express mínima
const app = express();
app.get('/', (req, res) => res.json({ status: 'ok' }));

// Iniciar servidor paso a paso
console.log('1. Iniciando servidor de diagnóstico...');

// Cargar prisma solo para verificar conexión
console.log('2. Cargando Prisma...');
const { PrismaClient } = require('@prisma/client');
console.log('3. Prisma cargado. Creando instancia...');
const prisma = new PrismaClient();
console.log('4. Instancia de Prisma creada.');

// Crear servidor HTTP
console.log('5. Creando servidor HTTP...');
const server = http.createServer(app);
console.log('6. Servidor HTTP creado.');

// Puerto del servidor
const PORT = process.env.PORT || 3000; // Usar puerto diferente para no conflictuar
console.log(`7. Puerto configurado: ${PORT}`);

// Función asíncrona para conectar a BD e iniciar servidor
async function start() {
  console.log('8. Iniciando función de arranque...');
  try {
    console.log('9. Intentando conectar a la base de datos...');
    await prisma.$connect();
    console.log('10. Conexión a la base de datos establecida correctamente.');

    // Iniciar el servidor
    server.listen(PORT, () => {
      console.log(`11. Servidor de diagnóstico corriendo en el puerto ${PORT}`);
    });
  } catch (error) {
    console.error('ERROR en start():', error);
  }
}

// Iniciar el servidor
console.log('Llamando a start()...');
start()
  .then(() => console.log('start() completado exitosamente.'))
  .catch(error => console.error('Error en start():', error));
console.log('Llamada a start() realizada.');