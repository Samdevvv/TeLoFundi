/**
 * Funciones de ayuda para la aplicación
 */
const crypto = require('crypto');
const { format, addDays, isAfter } = require('date-fns');
const jwt = require('jsonwebtoken');
const config = require('../config/auth');

/**
 * Genera un token aleatorio
 * @param {number} bytes - Número de bytes
 * @returns {string} - Token hexadecimal
 */
const generateRandomToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Genera un código numérico aleatorio
 * @param {number} length - Longitud del código
 * @returns {string} - Código numérico
 */
const generateVerificationCode = (length = 6) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
};

/**
 * Genera un JWT token
 * @param {object} payload - Datos para el token
 * @param {string} expiresIn - Tiempo de expiración (default: '7d')
 * @returns {string} - JWT Token
 */
const generateJwtToken = (payload, expiresIn = '7d') => {
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
};

/**
 * Verifica un JWT token
 * @param {string} token - JWT token
 * @returns {object|null} - Datos del token o null si es inválido
 */
const verifyJwtToken = (token) => {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (error) {
    return null;
  }
};

/**
 * Calcula si un usuario tiene puntos suficientes
 * @param {number} userPoints - Puntos del usuario
 * @param {number} requiredPoints - Puntos requeridos
 * @returns {boolean} - True si tiene puntos suficientes
 */
const hasEnoughPoints = (userPoints, requiredPoints) => {
  return userPoints >= requiredPoints;
};

/**
 * Formatea una fecha
 * @param {Date} date - Fecha a formatear
 * @param {string} formatStr - Formato de salida (default: 'yyyy-MM-dd')
 * @returns {string} - Fecha formateada
 */
const formatDate = (date, formatStr = 'yyyy-MM-dd') => {
  return format(date, formatStr);
};

/**
 * Calcula la fecha de caducidad
 * @param {number} days - Días para vencer
 * @returns {Date} - Fecha de vencimiento
 */
const calculateExpiryDate = (days) => {
  return addDays(new Date(), days);
};

/**
 * Verifica si una fecha ya pasó
 * @param {Date} date - Fecha a verificar
 * @returns {boolean} - True si ya pasó la fecha
 */
const isExpired = (date) => {
  return !isAfter(date, new Date());
};

/**
 * Genera un slug desde un texto
 * @param {string} text - Texto para generar slug
 * @returns {string} - Slug generado
 */
const generateSlug = (text) => {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
};

/**
 * Obtiene el nombre de usuario del email
 * @param {string} email - Email
 * @returns {string} - Nombre de usuario
 */
const getUsernameFromEmail = (email) => {
  return email.split('@')[0];
};

/**
 * Genera un código de referido
 * @param {string} userId - ID del usuario
 * @returns {string} - Código de referido
 */
const generateReferralCode = (userId) => {
  return `REF${userId.substring(0, 6).toUpperCase()}`;
};

/**
 * Pagina resultados
 * @param {Array} items - Ítems a paginar
 * @param {number} page - Número de página
 * @param {number} limit - Límite por página
 * @returns {object} - Resultados paginados
 */
const paginateResults = (items, page = 1, limit = 20) => {
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const results = {
    total: items.length,
    page,
    limit,
    totalPages: Math.ceil(items.length / limit),
    data: items.slice(startIndex, endIndex)
  };
  
  if (startIndex > 0) {
    results.previousPage = page - 1;
  }
  
  if (endIndex < items.length) {
    results.nextPage = page + 1;
  }
  
  return results;
};

/**
 * Calcula la diferencia de edad en años
 * @param {Date} birthDate - Fecha de nacimiento
 * @returns {number} - Edad en años
 */
const calculateAge = (birthDate) => {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * Limpia un objeto eliminando propiedades nulas o indefinidas
 * @param {object} obj - Objeto a limpiar
 * @returns {object} - Objeto limpio
 */
const cleanObject = (obj) => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v != null)
  );
};

/**
 * Genera un número de factura
 * @returns {string} - Número de factura
 */
const generateInvoiceNumber = () => {
  const prefix = 'INV';
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${timestamp.substring(timestamp.length - 6)}-${random}`;
};

/**
 * Genera un cupón de descuento
 * @param {number} discount - Porcentaje de descuento
 * @returns {string} - Código de cupón
 */
const generateCouponCode = (discount) => {
  const prefix = discount >= 25 ? 'SUPER' : 'DESC';
  const random = generateRandomToken(4).toUpperCase();
  return `${prefix}${discount}${random}`;
};

module.exports = {
  generateRandomToken,
  generateVerificationCode,
  generateJwtToken,
  verifyJwtToken,
  hasEnoughPoints,
  formatDate,
  calculateExpiryDate,
  isExpired,
  generateSlug,
  getUsernameFromEmail,
  generateReferralCode,
  paginateResults,
  calculateAge,
  cleanObject,
  generateInvoiceNumber,
  generateCouponCode
};