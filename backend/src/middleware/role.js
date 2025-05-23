// src/middleware/role.js
const logger = require('../utils/logger');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Middleware para verificar roles específicos
 * @param {string[]} allowedRoles - Roles permitidos
 * @returns {Function} - Middleware
 */
const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    try {
      // Verificar que el usuario está autenticado
      if (!req.user) {
        logger.debug('Intento de acceso a ruta protegida sin usuario autenticado');
        return res.status(401).json({
          success: false,
          message: 'No autorizado. Debe iniciar sesión.'
        });
      }

      // Registrar intento de acceso (para depuración)
      logger.debug(`Verificando acceso para usuario ${req.user.id} con rol ${req.user.role}. Roles permitidos: ${allowedRoles.join(', ')}`);

      // Verificar que el rol del usuario esté en la lista de roles permitidos
      if (!allowedRoles.includes(req.user.role)) {
        logger.debug(`Acceso denegado a usuario ${req.user.id} con rol ${req.user.role}`);
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado. No tiene los permisos necesarios.'
        });
      }

      logger.debug(`Acceso permitido a usuario ${req.user.id} con rol ${req.user.role}`);
      // Si el rol es válido, continuar
      next();
    } catch (error) {
      logger.error(`Error en middleware de roles: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al verificar permisos.'
      });
    }
  };
};

/**
 * Middleware para acceso sólo a administradores
 */
const adminOnly = roleMiddleware(['admin']);

/**
 * Middleware para acceso sólo a agencias
 */
const agencyOnly = roleMiddleware(['agencia']);

/**
 * Middleware para acceso sólo a perfiles
 */
const profileOnly = roleMiddleware(['perfil']);

/**
 * Middleware para acceso sólo a clientes
 */
const clientOnly = roleMiddleware(['cliente']);

/**
 * Middleware para acceso a admin o agencia
 */
const adminOrAgency = roleMiddleware(['admin', 'agencia']);

/**
 * Middleware para acceso a admin o perfil
 */
const adminOrProfile = roleMiddleware(['admin', 'perfil']);

/**
 * Middleware para verificar acceso a recursos propios
 * @param {string} resourceIdParam - Nombre del parámetro con el ID del recurso
 * @param {Function} getResourceOwner - Función para obtener el propietario del recurso
 * @returns {Function} - Middleware
 */
const resourceOwnerMiddleware = (resourceIdParam, getResourceOwner) => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceIdParam];
      if (!resourceId) {
        return res.status(400).json({
          success: false,
          message: `ID de recurso no proporcionado: ${resourceIdParam}`
        });
      }

      // Si es admin, permitir acceso sin verificar propiedad
      if (req.user.role === 'admin') {
        logger.debug(`Acceso admin a recurso ${resourceId} concedido automáticamente`);
        return next();
      }

      // Obtener propietario del recurso
      const resourceOwnerId = await getResourceOwner(resourceId);
      
      logger.debug(`Verificando propiedad: usuario ${req.user.id} intenta acceder al recurso ${resourceId} de propietario ${resourceOwnerId}`);

      // Verificar si el usuario autenticado es el propietario
      if (resourceOwnerId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No autorizado. No es propietario del recurso.'
        });
      }

      logger.debug(`Acceso a recurso propio permitido: ${resourceId}`);
      next();
    } catch (error) {
      logger.error(`Error en middleware de propietario: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al verificar propiedad del recurso.'
      });
    }
  };
};

/**
 * Middleware para acceso sólo a usuarios con membresía VIP
 * @param {boolean} strictMode - Si es true, rechaza no-VIP. Si es false, pasa una flag
 * @returns {Function} - Middleware
 */
const vipOnly = (strictMode = true) => {
  return (req, res, next) => {
    try {
      // Verificar que el usuario está autenticado
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'No autorizado. Debe iniciar sesión.'
        });
      }

      // Verificar si el usuario es VIP
      logger.debug(`Verificando acceso VIP para usuario ${req.user.id}, isVip: ${req.user.isVip}, strictMode: ${strictMode}`);
      
      if (!req.user.isVip) {
        if (strictMode) {
          return res.status(403).json({
            success: false,
            message: 'Acceso denegado. Esta función requiere membresía VIP.'
          });
        } else {
          // En modo permisivo, se pasa la flag y se continúa
          req.isVipAccess = false;
          logger.debug(`Acceso no-VIP permitido en modo permisivo para usuario ${req.user.id}`);
        }
      } else {
        req.isVipAccess = true;
        logger.debug(`Acceso VIP permitido para usuario ${req.user.id}`);
      }

      next();
    } catch (error) {
      logger.error(`Error en middleware VIP: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al verificar membresía VIP.'
      });
    }
  };
};

/**
 * Middleware para verificar si un perfil está verificado
 * @param {boolean} strictMode - Si es true, rechaza no verificados. Si es false, pasa una flag
 * @returns {Function} - Middleware
 */
const verifiedProfileOnly = (strictMode = true) => {
  return async (req, res, next) => {
    try {
      // Verificar que el usuario está autenticado
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'No autorizado. Debe iniciar sesión.'
        });
      }

      // Verificar que sea un perfil
      if (req.user.role !== 'perfil') {
        logger.debug(`Acceso denegado: usuario ${req.user.id} con rol ${req.user.role} no es un perfil`);
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado. Solo para perfiles.'
        });
      }

      // Obtener estado de verificación del perfil
      const profile = await prisma.profile.findUnique({
        where: { id: req.user.id },
        select: { verificationStatus: true }
      });

      if (!profile) {
        logger.debug(`Perfil no encontrado para usuario ${req.user.id}`);
        return res.status(404).json({
          success: false,
          message: 'Perfil no encontrado.'
        });
      }

      const isVerified = profile.verificationStatus === 'verificado';
      logger.debug(`Estado de verificación para perfil ${req.user.id}: ${profile.verificationStatus}, isVerified: ${isVerified}`);

      if (!isVerified && strictMode) {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado. Esta función requiere que su perfil esté verificado.'
        });
      }

      // Pasar flag de verificación
      req.isVerifiedProfile = isVerified;
      logger.debug(`Acceso permitido para perfil ${req.user.id}, verificado: ${isVerified}`);

      next();
    } catch (error) {
      logger.error(`Error en middleware de verificación: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al verificar estado de perfil.'
      });
    }
  };
};

/**
 * Middleware para verificar la propiedad de un perfil
 * @param {string} profileIdParam - Nombre del parámetro con el ID del perfil
 * @returns {Function} - Middleware
 */
const profileOwnerOrAgencyMiddleware = (profileIdParam) => {
  return async (req, res, next) => {
    try {
      const profileId = req.params[profileIdParam];
      if (!profileId) {
        return res.status(400).json({
          success: false,
          message: `ID de perfil no proporcionado: ${profileIdParam}`
        });
      }

      logger.debug(`Verificando acceso al perfil ${profileId} por el usuario ${req.user.id} con rol ${req.user.role}`);

      // Si es admin, permitir acceso sin verificar
      if (req.user.role === 'admin') {
        logger.debug(`Acceso admin permitido al perfil ${profileId}`);
        return next();
      }

      // Si es el propio perfil, permitir acceso
      if (req.user.id === profileId) {
        logger.debug(`Acceso permitido al propio perfil ${profileId}`);
        return next();
      }

      // Si es agencia, verificar relación con el perfil
      if (req.user.role === 'agencia') {
        const profile = await prisma.profile.findUnique({
          where: { id: profileId },
          select: { agencyId: true }
        });

        if (!profile) {
          logger.debug(`Perfil ${profileId} no encontrado`);
          return res.status(404).json({
            success: false,
            message: 'Perfil no encontrado.'
          });
        }

        // Verificar si la agencia está relacionada con el perfil
        logger.debug(`Agencia del perfil: ${profile.agencyId}, Agencia solicitante: ${req.user.id}`);
        
        if (profile.agencyId !== req.user.id) {
          return res.status(403).json({
            success: false,
            message: 'No autorizado. Este perfil no pertenece a su agencia.'
          });
        }

        logger.debug(`Acceso permitido a agencia ${req.user.id} para perfil ${profileId}`);
        return next();
      }

      // Si llega aquí, no tiene acceso
      logger.debug(`Acceso denegado para usuario ${req.user.id} con rol ${req.user.role} al perfil ${profileId}`);
      return res.status(403).json({
        success: false,
        message: 'No autorizado. No tiene acceso a este perfil.'
      });
    } catch (error) {
      logger.error(`Error en middleware de propietario de perfil: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al verificar acceso al perfil.'
      });
    }
  };
};

module.exports = {
  roleMiddleware,
  adminOnly,
  agencyOnly,
  profileOnly,
  clientOnly,
  adminOrAgency,
  adminOrProfile,
  resourceOwnerMiddleware,
  vipOnly,
  verifiedProfileOnly,
  profileOwnerOrAgencyMiddleware
};