const rateLimit = require('express-rate-limit');
const { AppError } = require('./errorHandler');
const logger = require('../utils/logger');

// Rate limiter general para toda la API
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // 100 requests por ventana
  message: {
    success: false,
    message: 'Demasiadas peticiones desde esta IP, intenta de nuevo más tarde',
    errorCode: 'RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true, // Retorna rate limit info en headers `RateLimit-*`
  legacyHeaders: false, // Deshabilita headers `X-RateLimit-*`
  handler: (req, res) => {
    logger.warn(`Rate limit excedido para IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      method: req.method
    });
    
    res.status(429).json({
      success: false,
      message: 'Demasiadas peticiones desde esta IP, intenta de nuevo más tarde',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString(),
      retryAfter: Math.round(15 * 60) // 15 minutos en segundos
    });
  }
});

// Rate limiter estricto para autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos de login por IP por ventana
  skipSuccessfulRequests: true, // No contar requests exitosos
  message: {
    success: false,
    message: 'Demasiados intentos de autenticación, intenta de nuevo en 15 minutos',
    errorCode: 'AUTH_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  },
  handler: (req, res) => {
    logger.warn(`Auth rate limit excedido para IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      email: req.body?.email
    });
    
    res.status(429).json({
      success: false,
      message: 'Demasiados intentos de autenticación, intenta de nuevo en 15 minutos',
      errorCode: 'AUTH_RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString(),
      retryAfter: Math.round(15 * 60)
    });
  }
});

// Rate limiter para registro de usuarios
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 registros por IP por hora
  message: {
    success: false,
    message: 'Demasiados registros desde esta IP, intenta de nuevo en 1 hora',
    errorCode: 'REGISTER_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  },
  handler: (req, res) => {
    logger.warn(`Register rate limit excedido para IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      email: req.body?.email
    });
    
    res.status(429).json({
      success: false,
      message: 'Demasiados registros desde esta IP, intenta de nuevo en 1 hora',
      errorCode: 'REGISTER_RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString(),
      retryAfter: Math.round(60 * 60)
    });
  }
});

// Rate limiter para subida de archivos
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 uploads por IP por ventana
  message: {
    success: false,
    message: 'Demasiadas subidas de archivos, intenta de nuevo más tarde',
    errorCode: 'UPLOAD_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

// Rate limiter para mensajes de chat
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // 30 mensajes por minuto
  keyGenerator: (req) => {
    // Usar user ID si está autenticado, si no usar IP
    return req.user?.id || req.ip;
  },
  message: {
    success: false,
    message: 'Demasiados mensajes enviados, espera un momento',
    errorCode: 'CHAT_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

// Rate limiter para creación de posts
const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // 10 posts por usuario por hora
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
  message: {
    success: false,
    message: 'Demasiados posts creados, intenta de nuevo más tarde',
    errorCode: 'POST_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

// Rate limiter para búsquedas
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 60, // 60 búsquedas por minuto
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
  message: {
    success: false,
    message: 'Demasiadas búsquedas, espera un momento',
    errorCode: 'SEARCH_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

// Rate limiter para reportes
const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 reportes por usuario por ventana
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
  message: {
    success: false,
    message: 'Demasiados reportes enviados, intenta de nuevo más tarde',
    errorCode: 'REPORT_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

// Rate limiter para recovery de contraseña
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 intentos por IP por hora
  message: {
    success: false,
    message: 'Demasiados intentos de recuperación de contraseña, intenta de nuevo en 1 hora',
    errorCode: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

// Rate limiter para pagos
const paymentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // 10 intentos de pago por ventana
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
  message: {
    success: false,
    message: 'Demasiados intentos de pago, intenta de nuevo más tarde',
    errorCode: 'PAYMENT_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  },
  handler: (req, res) => {
    logger.warn(`Payment rate limit excedido para usuario: ${req.user?.id || req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      url: req.originalUrl,
      method: req.method
    });
    
    res.status(429).json({
      success: false,
      message: 'Demasiados intentos de pago, intenta de nuevo más tarde',
      errorCode: 'PAYMENT_RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString(),
      retryAfter: Math.round(5 * 60) // 5 minutos en segundos
    });
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  registerLimiter,
  uploadLimiter,
  chatLimiter,
  postLimiter,
  searchLimiter,
  reportLimiter,
  passwordResetLimiter,
  paymentLimiter
};