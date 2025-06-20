const winston = require('winston');
const path = require('path');

// ✅ NIVELES OPTIMIZADOS
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow', 
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// ✅ FORMATO CONCISO PARA CONSOLA - SIN TIMESTAMPS LARGOS
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }), // ✅ Solo hora
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    // ✅ FORMATO MÁS COMPACTO
    const { timestamp, level, message, ...meta } = info;
    
    let output = `${timestamp} ${level}: ${message}`;
    
    // Solo mostrar metadata si es relevante
    if (Object.keys(meta).length > 0 && process.env.LOG_VERBOSE === 'true') {
      output += ` ${JSON.stringify(meta)}`;
    }
    
    return output;
  })
);

// Formato para archivos (sin cambios)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// ✅ NIVEL MÁS RESTRICTIVO
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  if (env === 'production') return 'warn';
  if (env === 'test') return 'error';
  return process.env.LOG_LEVEL || 'info'; // ✅ Cambiar de 'debug' a 'info'
};

// Transports optimizados
const transports = [];

// Console transport
transports.push(
  new winston.transports.Console({
    level: level(),
    format: consoleFormat,
    silent: process.env.NODE_ENV === 'test' // ✅ Silenciar en tests
  })
);

// File transports solo en producción
if (process.env.NODE_ENV === 'production') {
  const fs = require('fs');
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880,
      maxFiles: 3, // ✅ Reducir archivos
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: fileFormat,
      maxsize: 5242880,
      maxFiles: 3, // ✅ Reducir archivos
    })
  );
}

// Crear el logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format: fileFormat,
  transports,
  exitOnError: false,
  silent: process.env.NODE_ENV === 'test'
});

// ✅ FUNCIONES HELPER OPTIMIZADAS - MÁS CONCISAS

// Función para log de requests HTTP - SIMPLIFICADA
logger.logRequest = (req, res, responseTime) => {
  // Solo log requests importantes o errores
  if (res.statusCode >= 400 || responseTime > 1000) {
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'http';
    
    logger.log(level, `${req.method} ${req.originalUrl} ${res.statusCode} - ${responseTime}ms`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      time: `${responseTime}ms`,
      user: req.user?.id || 'anonymous'
    });
  }
};

// Función para log de errores - CONCISA
logger.logError = (error, context = {}) => {
  logger.error(`💥 ${error.message}`, {
    name: error.name,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    ...context
  });
};

// Función para log de autenticación - SIMPLIFICADA
logger.logAuth = (action, email, success, details = {}) => {
  const emoji = success ? '✅' : '❌';
  const level = success ? 'info' : 'warn';
  
  logger.log(level, `${emoji} Auth ${action}: ${email}`, {
    action,
    email,
    success,
    ...details
  });
};

// ✅ NUEVA: Log de actividades específicas con emojis
logger.logActivity = (category, action, details = {}) => {
  const emojis = {
    auth: '🔐',
    profile: '👤', 
    post: '📝',
    chat: '💬',
    payment: '💳',
    upload: '📁',
    admin: '🛡️',
    db: '🗄️'
  };
  
  const emoji = emojis[category] || '🔍';
  logger.info(`${emoji} ${category.toUpperCase()}: ${action}`, details);
};

// Log de performance - SOLO PARA CASOS IMPORTANTES
logger.logPerformance = (operation, duration, details = {}) => {
  // Solo log si es lento
  if (duration > 1000) {
    logger.warn(`🐌 Slow ${operation}: ${duration}ms`, {
      operation,
      duration: `${duration}ms`,
      ...details
    });
  }
};

// Log de seguridad - CONCISO
logger.logSecurity = (event, severity, details = {}) => {
  const emojis = { high: '🚨', medium: '⚠️', low: '🔍' };
  const emoji = emojis[severity] || '🔍';
  const level = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
  
  logger.log(level, `${emoji} Security: ${event}`, {
    event,
    severity,
    ...details
  });
};

// Log de pagos - CONCISO
logger.logPayment = (action, amount, status, details = {}) => {
  const emoji = status === 'success' ? '✅' : status === 'failed' ? '❌' : '🔄';
  const level = status === 'failed' ? 'error' : 'info';
  
  logger.log(level, `${emoji} Payment ${action}: $${amount} - ${status}`, {
    action,
    amount,
    status,
    ...details
  });
};

// ✅ NUEVA: Log especializado para posts
logger.logPost = (action, postId, userId, details = {}) => {
  logger.logActivity('post', `${action} - Post:${postId?.substring(0,8)} User:${userId?.substring(0,8)}`, details);
};

// ✅ NUEVA: Log especializado para uploads  
logger.logUpload = (type, filename, size, userId) => {
  logger.logActivity('upload', `${type} uploaded: ${filename} (${Math.round(size/1024)}KB)`, {
    type,
    filename,
    size: `${Math.round(size/1024)}KB`,
    userId: userId?.substring(0,8)
  });
};

// ✅ FUNCIÓN PARA ALTERNAR MODO VERBOSE
logger.setVerbose = (verbose) => {
  process.env.LOG_VERBOSE = verbose ? 'true' : 'false';
  logger.info(`🔧 Verbose logging: ${verbose ? 'enabled' : 'disabled'}`);
};

// ✅ FUNCIÓN PARA STATS DE LOGGING
logger.getStats = () => {
  return {
    level: logger.level,
    transports: logger.transports.length,
    verbose: process.env.LOG_VERBOSE === 'true',
    environment: process.env.NODE_ENV
  };
};

module.exports = logger;