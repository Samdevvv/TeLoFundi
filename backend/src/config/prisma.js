// src/config/prisma.js
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

// Opciones de configuración para Prisma
const options = {
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
};

// Crear una instancia de Prisma
const prisma = new PrismaClient(options);

// Eventos de logging
prisma.$on('query', (e) => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Prisma Query', { 
      query: e.query, 
      params: e.params, 
      duration: `${e.duration}ms` 
    });
  }
});

prisma.$on('error', (e) => {
  logger.error('Prisma Error', { error: e });
});

prisma.$on('info', (e) => {
  logger.info('Prisma Info', { message: e });
});

prisma.$on('warn', (e) => {
  logger.warn('Prisma Warning', { message: e });
});

module.exports = prisma;