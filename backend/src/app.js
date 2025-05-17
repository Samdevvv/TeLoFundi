// src/app.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const path = require('path'); // Agregar esta línea
const swaggerUi = require('swagger-ui-express');
const swaggerConfig = require('./config/swagger');
const apiRoutes = require('./api');
const { notFoundHandler, errorHandler } = require('./middleware/error');
const logger = require('./utils/logger');

// Inicializar la aplicación Express
const app = express();

// Configuración de middleware básico
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // Permitir recursos cross-origin
})); // Seguridad para encabezados HTTP
app.use(cors({
  origin: ['http://localhost:5173', 'https://tu-dominio-produccion.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
})); // Habilitar CORS para el frontend
app.use(express.json()); // Parsing de cuerpo JSON
app.use(express.urlencoded({ extended: true })); // Parsing de URL encoded

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: message => logger.info(message.trim())
    }
  }));
}

// Rutas estáticas con configuración CORS
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  express.static(path.join(__dirname, '../uploads'))(req, res, next);
});

// Agregar esta línea para servir archivos desde la carpeta images con CORS configurado
app.use('/images', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  express.static(path.join(__dirname, '../images'))(req, res, next);
});

// Endpoints básicos
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'API TeLoFundi funcionando correctamente',
    version: '1.0.0',
    docs: '/api-docs'
  });
});

// Configuración de Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerConfig.specs));

// Rutas de la API
app.use('/api', apiRoutes);

// Manejo de rutas no encontradas
app.use(notFoundHandler);

// Manejo de errores
app.use(errorHandler);

module.exports = app;