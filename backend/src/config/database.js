// src/config/database.js
const { Pool } = require('pg');
const logger = require('../utils/logger');

// Crear una instancia de conexión a PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'C123456',
  database: process.env.DB_NAME || 'TeLoFundiDev',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Evento para cuando se crea una conexión
pool.on('connect', () => {
  logger.debug('Conexión a PostgreSQL establecida');
});

// Evento de error
pool.on('error', (err) => {
  logger.error('Error en el pool de conexiones PostgreSQL:', err);
});

/**
 * Ejecuta una consulta en la base de datos
 * @param {string} text - Consulta SQL
 * @param {Array} params - Parámetros para la consulta
 * @returns {Promise<Object>} - Resultado de la consulta
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Consulta ejecutada', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    logger.error('Error ejecutando consulta', { text, error });
    throw error;
  }
};

/**
 * Obtiene un cliente de la pool para realizar múltiples consultas en una transacción
 * @returns {Promise<Object>} - Cliente de la pool
 */
const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);

  // Sobrescribir función de liberación para debugging
  client.release = () => {
    logger.debug('Cliente regresado al pool');
    release();
  };

  return {
    query,
    release,
    client,
  };
};

module.exports = {
  query,
  getClient,
  pool,
};