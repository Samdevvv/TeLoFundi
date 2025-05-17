/**
 * Configuración principal de Socket.IO
 */
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config/auth');
const { prisma } = require('../config/prisma');
const chatHandler = require('./chatHandler');
const notificationHandler = require('./notificationHandler');
const logger = require('../utils/logger');

let io;

/**
 * Inicializa el servidor Socket.IO
 * @param {object} server - Servidor HTTP
 * @returns {object} - Instancia de Socket.IO
 */
const init = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Middleware de autenticación para sockets
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Autenticación requerida'));
      }
      
      const decoded = jwt.verify(token, config.jwtSecret);
      
      // Verificar que el usuario existe y está activo
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, role: true, isActive: true }
      });
      
      if (!user || !user.isActive) {
        return next(new Error('Usuario no encontrado o inactivo'));
      }
      
      // Guardar datos del usuario en el socket
      socket.user = {
        id: user.id,
        role: user.role
      };
      
      next();
    } catch (error) {
      logger.error(`Error de autenticación en socket: ${error.message}`);
      next(new Error('Token inválido'));
    }
  });

  // Manejo de conexiones
  io.on('connection', (socket) => {
    logger.info(`Usuario conectado: ${socket.user.id}, Rol: ${socket.user.role}`);
    
    // Unir al usuario a su sala personal
    socket.join(`user:${socket.user.id}`);
    
    // Actualizar estatus de usuario como conectado
    updateUserStatus(socket.user.id, true);
    
    // Registro de manejadores específicos
    chatHandler.register(io, socket);
    notificationHandler.register(io, socket);
    
    // Manejo de desconexión
    socket.on('disconnect', () => {
      logger.info(`Usuario desconectado: ${socket.user.id}`);
      updateUserStatus(socket.user.id, false);
    });
  });
  
  return io;
};

/**
 * Obtiene la instancia de Socket.IO
 * @returns {object} - Instancia de Socket.IO
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO no ha sido inicializado');
  }
  return io;
};

/**
 * Actualiza el estado de conexión del usuario
 * @param {string} userId - ID del usuario
 * @param {boolean} isOnline - Estado de conexión
 */
const updateUserStatus = async (userId, isOnline) => {
  try {
    const timestamp = new Date();
    
    // Actualizar según el tipo de usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    
    if (user.role === 'perfil') {
      await prisma.profile.update({
        where: { id: userId },
        data: {
          lastActivity: timestamp,
          availabilityStatus: isOnline ? 'disponible' : 'no_disponible'
        }
      });
    } else if (user.role === 'cliente') {
      await prisma.client.update({
        where: { id: userId },
        data: { lastActivity: timestamp }
      });
    } else if (user.role === 'agencia') {
      // Para agencias solo actualizamos la última actividad
      await prisma.user.update({
        where: { id: userId },
        data: { lastActivity: timestamp }
      });
    }
  } catch (error) {
    logger.error(`Error al actualizar estado de usuario: ${error.message}`);
  }
};

module.exports = {
  init,
  getIO
};