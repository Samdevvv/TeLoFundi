const express = require('express');
const router = express.Router();
const multer = require('multer');
const { AppError } = require('../middleware/errorHandler');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');

// Middleware de autenticación
const { authenticate } = require('../middleware/auth');

// ✅ SOLO IMPORTAR VALIDACIONES QUE EXISTEN
const { 
  validateChatMessage,
  validatePagination
  // ❌ REMOVIDAS: funciones que no existen en validation middleware
} = require('../middleware/validation');

// ✅ MIDDLEWARES DE UPLOAD SIMPLIFICADOS - TODOS DEFINIDOS AQUÍ
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido en chat'), false);
    }
  }
});

// ✅ MIDDLEWARE PARA VALIDAR CAPACIDADES DE CHAT POR TIPO DE USUARIO
const validateChatCapabilities = async (req, res, next) => {
  try {
    const user = req.user;
    const { messageType = 'TEXT', isPremiumMessage = false } = req.body;

    // Verificar límites específicos por tipo de usuario
    if (user.userType === 'CLIENT') {
      const client = user.client;
      if (!client) {
        return next(new AppError('Datos de cliente no encontrados', 500, 'CLIENT_DATA_MISSING'));
      }

      // Verificar límites diarios
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (client.lastMessageReset < today) {
        await prisma.client.update({
          where: { id: client.id },
          data: {
            messagesUsedToday: 0,
            lastMessageReset: today
          }
        });
        client.messagesUsedToday = 0;
      }

      // Verificar límite diario
      if (client.messagesUsedToday >= client.dailyMessageLimit && !client.isPremium) {
        return next(new AppError(
          `Has alcanzado tu límite diario de ${client.dailyMessageLimit} mensajes. Actualiza a premium para mensajes ilimitados.`,
          400,
          'DAILY_MESSAGE_LIMIT_REACHED'
        ));
      }

      // Verificar capacidades según tipo de mensaje
      if (messageType === 'IMAGE' && !client.canSendImages && !client.isPremium) {
        return next(new AppError('Tu cuenta no permite enviar imágenes. Actualiza a Premium o VIP.', 403, 'IMAGES_NOT_ALLOWED'));
      }

      if (messageType === 'AUDIO' && !client.canSendVoiceMessages && client.premiumTier !== 'VIP') {
        return next(new AppError('Los mensajes de voz requieren cuenta VIP.', 403, 'VOICE_NOT_ALLOWED'));
      }

      // Verificar mensajes premium
      if (isPremiumMessage && client.premiumTier === 'BASIC') {
        return next(new AppError('Los mensajes premium requieren cuenta Premium o VIP.', 403, 'PREMIUM_MESSAGE_NOT_ALLOWED'));
      }

      // Calcular costo en puntos
      let pointsCost = 0;
      if (isPremiumMessage) {
        pointsCost = 5;
      } else if (messageType === 'IMAGE') {
        pointsCost = 2;
      } else if (messageType === 'AUDIO' || messageType === 'VIDEO') {
        pointsCost = 4;
      } else if (messageType === 'FILE') {
        pointsCost = 3;
      } else {
        pointsCost = 1;
      }

      // Verificar puntos suficientes
      if (client.points < pointsCost) {
        return next(new AppError('Puntos insuficientes para enviar mensaje', 400, 'INSUFFICIENT_POINTS'));
      }

      req.pointsCost = pointsCost;
    }

    next();
  } catch (error) {
    logger.error('Error validating chat capabilities:', error);
    next(new AppError('Error validando capacidades de chat', 500, 'CHAT_VALIDATION_ERROR'));
  }
};

// ✅ MIDDLEWARES DE VALIDACIÓN SIMPLES (DEFINIDOS AQUÍ)
const validateFileUpload = (options = {}) => {
  return (req, res, next) => {
    if (!req.file && options.required) {
      return next(new AppError('Archivo requerido', 400, 'FILE_REQUIRED'));
    }
    
    if (req.file) {
      const { allowedTypes = [], maxSize = 5 * 1024 * 1024 } = options;
      
      if (allowedTypes.length > 0 && !allowedTypes.includes(req.file.mimetype)) {
        return next(new AppError('Tipo de archivo no permitido', 400, 'INVALID_FILE_TYPE'));
      }
      
      if (req.file.size > maxSize) {
        return next(new AppError('Archivo muy grande', 400, 'FILE_TOO_LARGE'));
      }
    }
    
    next();
  };
};

const validateDisputeMessage = (req, res, next) => {
  const { content } = req.body;
  
  if (!content || content.trim().length === 0) {
    return next(new AppError('Contenido del mensaje es requerido', 400, 'MISSING_MESSAGE_CONTENT'));
  }
  
  if (content.length > 1000) {
    return next(new AppError('Mensaje muy largo. Máximo 1000 caracteres en disputas', 400, 'MESSAGE_TOO_LONG'));
  }
  
  next();
};

const validateCreateDisputeChat = (req, res, next) => {
  const { escortId, agencyId, reason } = req.body;
  
  if (!escortId || !agencyId || !reason) {
    return next(new AppError('escortId, agencyId y reason son requeridos', 400, 'MISSING_REQUIRED_FIELDS'));
  }
  
  if (reason.length < 10) {
    return next(new AppError('La razón debe tener al menos 10 caracteres', 400, 'REASON_TOO_SHORT'));
  }
  
  next();
};

const validateCloseDisputeChat = (req, res, next) => {
  const { resolution } = req.body;
  
  if (!resolution || resolution.trim().length === 0) {
    return next(new AppError('Resolución es requerida', 400, 'MISSING_RESOLUTION'));
  }
  
  if (resolution.length < 20) {
    return next(new AppError('La resolución debe tener al menos 20 caracteres', 400, 'RESOLUTION_TOO_SHORT'));
  }
  
  next();
};

const validateMessageSearch = (req, res, next) => {
  const { q: query, messageType, dateFrom, dateTo } = req.query;
  
  if (!query && !messageType && !dateFrom && !dateTo) {
    return next(new AppError('Al menos un criterio de búsqueda es requerido', 400, 'MISSING_SEARCH_CRITERIA'));
  }
  
  if (dateFrom && isNaN(Date.parse(dateFrom))) {
    return next(new AppError('Fecha desde inválida', 400, 'INVALID_DATE_FROM'));
  }
  
  if (dateTo && isNaN(Date.parse(dateTo))) {
    return next(new AppError('Fecha hasta inválida', 400, 'INVALID_DATE_TO'));
  }
  
  next();
};

const validateChatMute = (req, res, next) => {
  const { mutedUntil } = req.body;
  
  if (mutedUntil && isNaN(Date.parse(mutedUntil))) {
    return next(new AppError('Fecha de silenciado inválida', 400, 'INVALID_MUTE_DATE'));
  }
  
  next();
};

// ✅ CONTROLLERS COMPLETOS
const {
  createOrGetChat,
  getChats,
  getChatMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  toggleChatArchive,
  toggleChatMute,
  searchMessages,
  getChatStats,
  reportMessage,
  // ✅ NUEVO: Funciones para chat tripartito
  createDisputeChat,
  getDisputeChats,
  closeDisputeChat,
  addDisputeMessage,
  // ✅ NUEVO: Función para crear chat desde perfil
  createChatFromProfile
} = require('../controllers/chatController');

/**
 * @swagger
 * components:
 *   schemas:
 *     Chat:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "cm123chat456"
 *         name:
 *           type: string
 *           nullable: true
 *           example: "Chat con María"
 *         isGroup:
 *           type: boolean
 *           example: false
 *         isDisputeChat:
 *           type: boolean
 *           example: false
 *         disputeStatus:
 *           type: string
 *           enum: [ACTIVE, RESOLVED, ESCALATED, CLOSED]
 *         avatar:
 *           type: string
 *           nullable: true
 *         description:
 *           type: string
 *           nullable: true
 *         members:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ChatMember'
 *         lastMessage:
 *           $ref: '#/components/schemas/Message'
 *           nullable: true
 *         unreadCount:
 *           type: integer
 *           example: 3
 *         lastActivity:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/chat:
 *   get:
 *     summary: Obtener lista de chats del usuario
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: archived
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Incluir chats archivados
 *       - in: query
 *         name: includeDisputes
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Incluir chats de disputa (solo para admins)
 *     responses:
 *       200:
 *         description: Lista de chats obtenida exitosamente
 */
router.get('/', authenticate, getChats);

/**
 * @swagger
 * /api/chat:
 *   post:
 *     summary: Crear o obtener chat con otro usuario
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - receiverId
 *             properties:
 *               receiverId:
 *                 type: string
 *                 description: ID del usuario con quien chatear
 *     responses:
 *       200:
 *         description: Chat obtenido o creado exitosamente
 *       400:
 *         description: Datos inválidos o no puedes chatear contigo mismo
 *       403:
 *         description: Usuario bloqueado o no permite mensajes directos
 *       404:
 *         description: Usuario no encontrado
 */
router.post('/', authenticate, createOrGetChat);

/**
 * @swagger
 * /api/chat/profile/{userId}:
 *   post:
 *     summary: Crear chat desde perfil de usuario (botón "Chat" en perfil)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario del perfil
 *     responses:
 *       200:
 *         description: Chat creado/encontrado y usuario redirigido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Chat iniciado exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     chatId:
 *                       type: string
 *                       description: ID del chat para redirección
 *                     isNewChat:
 *                       type: boolean
 *                       description: Si es un chat nuevo o existente
 *                     otherUser:
 *                       type: object
 *                       description: Información del usuario del perfil
 *       403:
 *         description: No puedes chatear con este usuario
 *       404:
 *         description: Usuario no encontrado
 */
router.post('/profile/:userId', authenticate, createChatFromProfile);

/**
 * @swagger
 * /api/chat/dispute:
 *   post:
 *     summary: Crear chat tripartito para resolver disputa (solo admins)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - escortId
 *               - agencyId
 *               - reason
 *             properties:
 *               escortId:
 *                 type: string
 *                 description: ID del escort en disputa
 *               agencyId:
 *                 type: string
 *                 description: ID de la agencia en disputa
 *               reason:
 *                 type: string
 *                 description: Razón de la disputa
 *     responses:
 *       201:
 *         description: Chat de disputa creado exitosamente
 *       403:
 *         description: Solo administradores pueden crear chats de disputa
 */
router.post('/dispute', authenticate, validateCreateDisputeChat, createDisputeChat);

/**
 * @swagger
 * /api/chat/dispute:
 *   get:
 *     summary: Obtener chats de disputa (solo admins)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, RESOLVED, ESCALATED, CLOSED]
 *         description: Filtrar por estado de disputa
 *     responses:
 *       200:
 *         description: Lista de chats de disputa
 */
router.get('/dispute', authenticate, getDisputeChats);

/**
 * @swagger
 * /api/chat/dispute/{chatId}/close:
 *   post:
 *     summary: Cerrar chat de disputa (solo admins)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resolution
 *             properties:
 *               resolution:
 *                 type: string
 *                 description: Resolución de la disputa
 *               finalDecision:
 *                 type: string
 *                 description: Decisión final del administrador
 *     responses:
 *       200:
 *         description: Chat de disputa cerrado exitosamente
 */
router.post('/dispute/:chatId/close', authenticate, validateCloseDisputeChat, closeDisputeChat);

/**
 * @swagger
 * /api/chat/{chatId}/messages:
 *   get:
 *     summary: Obtener mensajes de un chat
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Obtener mensajes antes de esta fecha
 *     responses:
 *       200:
 *         description: Mensajes obtenidos exitosamente
 *       403:
 *         description: Sin acceso al chat
 *       404:
 *         description: Chat no encontrado
 */
router.get('/:chatId/messages', authenticate, getChatMessages);

/**
 * @swagger
 * /api/chat/{chatId}/messages:
 *   post:
 *     summary: Enviar mensaje a un chat (con soporte para imágenes/archivos en Cloudinary)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 5000
 *                 example: "Hola, ¿cómo estás?"
 *               messageType:
 *                 type: string
 *                 enum: [TEXT, IMAGE, FILE, AUDIO, VIDEO, LOCATION, CONTACT]
 *                 default: TEXT
 *               replyToId:
 *                 type: string
 *                 nullable: true
 *               isPremiumMessage:
 *                 type: boolean
 *                 default: false
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 5000
 *               messageType:
 *                 type: string
 *                 enum: [TEXT, IMAGE, FILE]
 *                 default: TEXT
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Imagen para mensajes de tipo IMAGE (JPG, PNG, WebP, GIF) - Máximo 5MB
 *               replyToId:
 *                 type: string
 *               isPremiumMessage:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Mensaje enviado exitosamente
 *       400:
 *         description: Datos inválidos, límite de mensajes alcanzado o puntos insuficientes
 *       403:
 *         description: Sin acceso al chat
 *       404:
 *         description: Chat no encontrado
 *       429:
 *         description: Límite de rate limiting excedido
 */
router.post('/:chatId/messages', 
  authenticate,
  validateChatCapabilities,
  upload.single('image'),
  validateFileUpload({
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
    maxSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 1,
    required: false
  }),
  validateChatMessage,
  sendMessage
);

/**
 * @swagger
 * /api/chat/dispute/{chatId}/messages:
 *   post:
 *     summary: Enviar mensaje en chat tripartito (máximo 3 por usuario)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Contenido del mensaje (máximo 1000 caracteres para disputas)
 *     responses:
 *       201:
 *         description: Mensaje de disputa enviado exitosamente
 *       400:
 *         description: Límite de mensajes alcanzado en chat tripartito
 *       403:
 *         description: Sin acceso al chat de disputa
 */
router.post('/dispute/:chatId/messages', authenticate, validateDisputeMessage, addDisputeMessage);

/**
 * @swagger
 * /api/chat/messages/{messageId}:
 *   put:
 *     summary: Editar mensaje (solo mensajes de texto)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 5000
 *                 example: "Mensaje editado"
 *     responses:
 *       200:
 *         description: Mensaje editado exitosamente
 *       400:
 *         description: Mensaje muy antiguo para editar, tipo no editable o datos inválidos
 *       404:
 *         description: Mensaje no encontrado o sin permisos
 */
router.put('/messages/:messageId', authenticate, editMessage);

/**
 * @swagger
 * /api/chat/messages/{messageId}:
 *   delete:
 *     summary: Eliminar mensaje (soft delete con limpieza de Cloudinary)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Mensaje eliminado exitosamente
 *       404:
 *         description: Mensaje no encontrado o sin permisos
 */
router.delete('/messages/:messageId', authenticate, deleteMessage);

/**
 * @swagger
 * /api/chat/{chatId}/archive:
 *   post:
 *     summary: Archivar/desarchivar chat (toggle)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Estado de archivo del chat actualizado
 *       403:
 *         description: Sin acceso al chat
 *       404:
 *         description: Chat no encontrado
 */
router.post('/:chatId/archive', authenticate, toggleChatArchive);

/**
 * @swagger
 * /api/chat/{chatId}/mute:
 *   post:
 *     summary: Silenciar/desilenciar chat (toggle)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mutedUntil:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 description: Timestamp hasta cuando silenciar (null para desilenciar)
 *     responses:
 *       200:
 *         description: Estado de silenciado del chat actualizado
 *       403:
 *         description: Sin acceso al chat
 *       404:
 *         description: Chat no encontrado
 */
router.post('/:chatId/mute', authenticate, validateChatMute, toggleChatMute);

/**
 * @swagger
 * /api/chat/{chatId}/messages/search:
 *   get:
 *     summary: Buscar mensajes en un chat específico
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Término de búsqueda
 *       - in: query
 *         name: messageType
 *         schema:
 *           type: string
 *           enum: [TEXT, IMAGE, FILE, AUDIO, VIDEO]
 *         description: Filtrar por tipo de mensaje
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Resultados de búsqueda obtenidos exitosamente
 *       403:
 *         description: Sin acceso al chat
 *       404:
 *         description: Chat no encontrado
 */
router.get('/:chatId/messages/search', authenticate, validateMessageSearch, searchMessages);

/**
 * @swagger
 * /api/chat/{chatId}/stats:
 *   get:
 *     summary: Obtener estadísticas de un chat específico
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Estadísticas del chat obtenidas exitosamente
 *       403:
 *         description: Sin acceso al chat
 *       404:
 *         description: Chat no encontrado
 */
router.get('/:chatId/stats', authenticate, getChatStats);

/**
 * @swagger
 * /api/chat/messages/{messageId}/report:
 *   post:
 *     summary: Reportar un mensaje específico
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 enum: [SPAM, INAPPROPRIATE_CONTENT, HARASSMENT, SCAM, OTHER]
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       200:
 *         description: Mensaje reportado exitosamente
 *       400:
 *         description: No puedes reportar tu propio mensaje
 *       403:
 *         description: Sin acceso al chat
 *       404:
 *         description: Mensaje no encontrado
 */
router.post('/messages/:messageId/report', authenticate, reportMessage);

// ✅ MIDDLEWARE DE MANEJO DE ERRORES ESPECÍFICO PARA CHAT
router.use((error, req, res, next) => {
  console.error('🔥 Chat route error:', error);

  // Error específico de validación de archivos
  if (error.message && error.message.includes('Tipo de archivo no permitido')) {
    return res.status(400).json({
      success: false,
      message: 'Tipo de archivo no permitido en chat',
      errorCode: 'INVALID_CHAT_FILE_TYPE',
      details: 'Solo se permiten imágenes (JPG, PNG, GIF, WebP) en el chat',
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    });
  }

  // Error de archivo muy grande
  if (error.message && error.message.includes('File too large')) {
    return res.status(400).json({
      success: false,
      message: 'Archivo muy grande para chat',
      errorCode: 'CHAT_FILE_TOO_LARGE',
      details: 'Máximo 5MB para archivos de chat'
    });
  }

  // Error de límite de mensajes en chat tripartito
  if (error.message && error.message.includes('Límite de mensajes')) {
    return res.status(400).json({
      success: false,
      message: 'Límite de mensajes alcanzado en chat tripartito',
      errorCode: 'DISPUTE_MESSAGE_LIMIT',
      details: 'Máximo 3 mensajes por usuario en chats de disputa'
    });
  }

  // Error de puntos insuficientes
  if (error.code === 'INSUFFICIENT_POINTS') {
    return res.status(400).json({
      success: false,
      message: 'Puntos insuficientes para enviar mensaje',
      errorCode: 'INSUFFICIENT_POINTS',
      details: 'Compra más puntos o espera hasta mañana para obtener puntos gratuitos'
    });
  }

  // Error de límite diario alcanzado
  if (error.code === 'DAILY_MESSAGE_LIMIT_REACHED') {
    return res.status(400).json({
      success: false,
      message: error.message,
      errorCode: 'DAILY_MESSAGE_LIMIT_REACHED',
      details: 'Actualiza a premium para mensajes ilimitados'
    });
  }

  // Otros errores
  next(error);
});

console.log('✅ Chat routes configured with complete features and profile chat integration');

module.exports = router;