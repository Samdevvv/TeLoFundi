const winston = require('winston');
const path = require('path');

// Definir niveles de log personalizados
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Definir colores para cada nivel
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Agregar colores a winston
winston.addColors(colors);

// Formato para logs en consola (desarrollo)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Formato para logs en archivos (producción)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Función para determinar el nivel de log basado en el entorno
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Transports para diferentes entornos
const transports = [];

// Console transport (siempre presente)
transports.push(
  new winston.transports.Console({
    level: level(),
    format: consoleFormat
  })
);

// File transports (solo en producción o si se especifica)
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
  // Crear directorio de logs si no existe
  const fs = require('fs');
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Log de errores
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // Log combinado
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // Log de acceso HTTP
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'access.log'),
      level: 'http',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Crear el logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format: fileFormat,
  transports,
  exitOnError: false
});

// Función helper para logs estructurados
logger.logWithContext = (level, message, context = {}) => {
  const logData = {
    message,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    ...context
  };
  
  logger.log(level, message, logData);
};

// Función para log de requests HTTP
logger.logRequest = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || 'anonymous',
    userType: req.user?.userType || 'none'
  };

  const level = res.statusCode >= 400 ? 'warn' : 'http';
  logger.log(level, `${req.method} ${req.originalUrl} ${res.statusCode} - ${responseTime}ms`, logData);
};

// Función para log de errores con stack trace
logger.logError = (error, context = {}) => {
  const errorData = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...context
  };

  logger.error('Application Error', errorData);
};

// Función para log de autenticación
logger.logAuth = (action, userId, email, success, details = {}) => {
  const authData = {
    action,
    userId,
    email,
    success,
    timestamp: new Date().toISOString(),
    ...details
  };

  const level = success ? 'info' : 'warn';
  logger.log(level, `Auth ${action}: ${email} - ${success ? 'SUCCESS' : 'FAILED'}`, authData);
};

// Función para log de actividades de usuario
logger.logUserActivity = (userId, action, details = {}) => {
  const activityData = {
    userId,
    action,
    timestamp: new Date().toISOString(),
    ...details
  };

  logger.info(`User Activity: ${action}`, activityData);
};

// Función para log de métricas de performance
logger.logPerformance = (operation, duration, details = {}) => {
  const perfData = {
    operation,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...details
  };

  const level = duration > 1000 ? 'warn' : 'debug';
  logger.log(level, `Performance: ${operation} took ${duration}ms`, perfData);
};

// Función para log de seguridad
logger.logSecurity = (event, severity, details = {}) => {
  const securityData = {
    event,
    severity,
    timestamp: new Date().toISOString(),
    ...details
  };

  const level = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
  logger.log(level, `Security Event: ${event}`, securityData);
};

// Función para log de pagos
logger.logPayment = (userId, action, amount, status, details = {}) => {
  const paymentData = {
    userId,
    action,
    amount,
    status,
    timestamp: new Date().toISOString(),
    ...details
  };

  const level = status === 'failed' ? 'error' : 'info';
  logger.log(level, `Payment ${action}: ${amount} - ${status}`, paymentData);
};

module.exports = logger;