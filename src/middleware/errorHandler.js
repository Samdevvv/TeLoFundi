const { Prisma } = require('@prisma/client');
const logger = require('../utils/logger');

// Clase personalizada para errores de la aplicación
class AppError extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Manejo de errores de Prisma
const handlePrismaError = (error) => {
  logger.error('Error de Prisma:', { error: error.message, code: error.code });

  switch (error.code) {
    case 'P2002':
      // Violación de constraint único
      const fields = error.meta?.target || ['campo'];
      return new AppError(
        `Ya existe un registro con ese ${fields.join(', ')}`, 
        409, 
        'DUPLICATE_ENTRY'
      );
    
    case 'P2025':
      // Registro no encontrado
      return new AppError(
        'El registro solicitado no fue encontrado', 
        404, 
        'NOT_FOUND'
      );
    
    case 'P2003':
      // Violación de foreign key
      return new AppError(
        'Error de relación: el registro referenciado no existe', 
        400, 
        'FOREIGN_KEY_VIOLATION'
      );
    
    case 'P2014':
      // Required relation violation
      return new AppError(
        'La operación falló por dependencias requeridas', 
        400, 
        'RELATION_VIOLATION'
      );
    
    case 'P2021':
      // Table not found
      return new AppError(
        'Error en la base de datos: tabla no encontrada', 
        500, 
        'DATABASE_ERROR'
      );
    
    case 'P2022':
      // Column not found
      return new AppError(
        'Error en la base de datos: columna no encontrada', 
        500, 
        'DATABASE_ERROR'
      );
    
    default:
      return new AppError(
        'Error en la base de datos', 
        500, 
        'DATABASE_ERROR'
      );
  }
};

// Manejo de errores de validación de Joi
const handleJoiError = (error) => {
  const errors = error.details.map(detail => ({
    field: detail.path.join('.'),
    message: detail.message.replace(/['"]/g, ''),
    value: detail.context?.value
  }));

  return {
    success: false,
    message: 'Error de validación',
    errors,
    timestamp: new Date().toISOString()
  };
};

// Manejo de errores de JWT
const handleJWTError = () => {
  return new AppError('Token inválido', 401, 'INVALID_TOKEN');
};

const handleJWTExpiredError = () => {
  return new AppError('Token expirado', 401, 'TOKEN_EXPIRED');
};

// Manejo de errores de Multer
const handleMulterError = (error) => {
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return new AppError(
        'El archivo es demasiado grande', 
        400, 
        'FILE_TOO_LARGE'
      );
    case 'LIMIT_FILE_COUNT':
      return new AppError(
        'Demasiados archivos', 
        400, 
        'TOO_MANY_FILES'
      );
    case 'LIMIT_UNEXPECTED_FILE':
      return new AppError(
        'Campo de archivo inesperado', 
        400, 
        'UNEXPECTED_FILE'
      );
    default:
      return new AppError(
        'Error al subir archivo', 
        400, 
        'UPLOAD_ERROR'
      );
  }
};

// Envío de error en desarrollo
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    error: err,
    message: err.message,
    stack: err.stack,
    errorCode: err.errorCode,
    timestamp: new Date().toISOString()
  });
};

// Envío de error en producción
const sendErrorProd = (err, res) => {
  // Errores operacionales, seguros para mostrar al cliente
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errorCode: err.errorCode,
      timestamp: new Date().toISOString()
    });
  } else {
    // Error de programación, no revelar detalles
    logger.error('ERROR:', err);

    res.status(500).json({
      success: false,
      message: 'Algo salió mal',
      errorCode: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
  }
};

// Middleware global de manejo de errores
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  logger.error('Error global:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    user: req.user?.id || 'No autenticado'
  });

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Manejo específico de diferentes tipos de errores
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      error = handlePrismaError(error);
    } else if (error instanceof Prisma.PrismaClientValidationError) {
      error = new AppError('Error de validación en la base de datos', 400, 'VALIDATION_ERROR');
    } else if (error.name === 'ValidationError' && error.details) {
      // Error de Joi
      return res.status(400).json(handleJoiError(error));
    } else if (error.name === 'JsonWebTokenError') {
      error = handleJWTError();
    } else if (error.name === 'TokenExpiredError') {
      error = handleJWTExpiredError();
    } else if (error.name === 'MulterError') {
      error = handleMulterError(error);
    } else if (error.code === 'ENOENT') {
      error = new AppError('Archivo no encontrado', 404, 'FILE_NOT_FOUND');
    } else if (error.type === 'entity.parse.failed') {
      error = new AppError('JSON inválido', 400, 'INVALID_JSON');
    }

    sendErrorProd(error, res);
  }
};

// Middleware para capturar rutas no encontradas
const notFoundHandler = (req, res, next) => {
  const err = new AppError(`No se encontró la ruta ${req.originalUrl}`, 404, 'ROUTE_NOT_FOUND');
  next(err);
};

// Wrapper para funciones async
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = {
  AppError,
  globalErrorHandler,
  notFoundHandler,
  catchAsync
};