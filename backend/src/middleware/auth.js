// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * Middleware para verificar y proteger rutas con autenticación JWT
 * @param {Object} req - Objeto de petición
 * @param {Object} res - Objeto de respuesta
 * @param {Function} next - Función para continuar con el siguiente middleware
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Obtener token del header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado. Token no proporcionado',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado. Token no proporcionado',
      });
    }

    // Verificar token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Verificar que el usuario exista y esté activo
      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
      });

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no encontrado o inactivo',
        });
      }

      // Verificar si existe una sesión activa
      // Esto es opcional, pero añade seguridad
      const session = await prisma.userSession.findFirst({
        where: {
          userId: user.id,
          isActive: true,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!session) {
        return res.status(401).json({
          success: false,
          message: 'Sesión expirada o inválida',
        });
      }

      // Añadir información del usuario al objeto de solicitud
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        isVip: user.isVip,
      };

      // Continuar con el siguiente middleware
      next();
    } catch (error) {
      logger.error(`Error de autenticación: ${error.message}`, { error });
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expirado',
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Token inválido',
      });
    }
  } catch (error) {
    logger.error(`Error en middleware de autenticación: ${error.message}`, { error });
    
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor',
    });
  }
};

/**
 * Middleware para verificar roles específicos
 * @param {string[]} roles - Array de roles permitidos
 * @returns {Function} - Middleware de verificación de rol
 */
const roleMiddleware = (roles) => {
  return (req, res, next) => {
    // Verificar que exista un usuario autenticado
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado. Usuario no autenticado',
      });
    }

    // Verificar el rol
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. No tiene permisos suficientes',
      });
    }

    // Usuario tiene el rol adecuado, continuar
    next();
  };
};

/**
 * Middleware opcional para verificar la autenticación sin bloquear
 * Útil para rutas que funcionan con o sin autenticación pero que
 * pueden mostrar contenido personalizado si el usuario está autenticado
 */
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    // Obtener token del header
    const authHeader = req.headers.authorization;
    
    // Si no hay token, continuar sin usuario autenticado
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return next();
    }

    // Verificar token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Verificar que el usuario exista y esté activo
      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
      });

      if (user && user.isActive) {
        // Añadir información del usuario al objeto de solicitud
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          isVip: user.isVip,
        };
      }

      // Continuar con el siguiente middleware
      next();
    } catch (error) {
      // Si hay error, continuar sin usuario autenticado
      logger.debug(`Token opcional inválido: ${error.message}`);
      next();
    }
  } catch (error) {
    logger.error(`Error en middleware de autenticación opcional: ${error.message}`, { error });
    next();
  }
};

module.exports = {
  authMiddleware,
  roleMiddleware,
  optionalAuthMiddleware
};