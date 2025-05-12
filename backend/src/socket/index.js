const socketIo = require('socket.io');
const logger = require('../utils/logger');

let io;

/**
 * Inicializar Socket.io
 * @param {Server} server - Servidor HTTP
 */
exports.init = (server) => {
  io = socketIo(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });
  
  io.on('connection', (socket) => {
    logger.info(`Cliente Socket.io conectado: ${socket.id}`);
    
    // Manejar desconexión
    socket.on('disconnect', () => {
      logger.info(`Cliente Socket.io desconectado: ${socket.id}`);
    });
  });
  
  return io;
};

/**
 * Obtener instancia de Socket.io
 * @returns {SocketIO.Server} Instancia de Socket.io
 */
exports.getIO = () => {
  if (!io) {
    throw new Error('Socket.io no inicializado');
  }
  return io;
};