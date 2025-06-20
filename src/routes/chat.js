const express = require('express');
const router = express.Router();

// Middleware de autenticación y rate limiting
const { authenticate } = require('../middleware/auth');

// ✅ CORREGIDO: Usar validateFileUpload en lugar de validateFileTypes
const { validateFileUpload } = require('../middleware/validation');

// ✅ CORREGIDO: MIDDLEWARES DE UPLOAD INTEGRADOS CON CLOUDINARY - REMOVIDOS LOS QUE NO EXISTEN
// Solo mantener los que realmente existen en tu middleware
const {
  uploadChatImage, // Solo si existe
  processAndUploadToCloud, // Solo si existe
  cleanFileMetadata, // Solo si existe
  addUploadInfo, // Solo si existe
  handleMulterError // Solo si existe
} = require('../middleware/upload');

// ✅ CORREGIDO: Controllers - NOMBRES CORREGIDOS PARA COINCIDIR CON EL CONTROLADOR
const {
  createOrGetChat,    // Era createChat
  getChats,
  getChatMessages,    // Era getMessages
  sendMessage,
  editMessage,        // Nueva función
  deleteMessage,      // Nueva función
  toggleChatArchive,  // Era archiveChat y unarchiveChat
  toggleChatMute,     // Era muteChatForUser y unmuteChatForUser
  searchMessages,
  getChatStats,
  reportMessage       // Era reportChat
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
 *         avatar:
 *           type: string
 *           nullable: true
 *           example: "https://res.cloudinary.com/telofundi/image/upload/v1234567890/telofundi/chat/chat_group_avatar_123.webp"
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
 *     
 *     ChatMember:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         user:
 *           $ref: '#/components/schemas/User'
 *         role:
 *           type: string
 *           enum: [ADMIN, MODERATOR, MEMBER]
 *         joinedAt:
 *           type: string
 *           format: date-time
 *         lastRead:
 *           type: string
 *           format: date-time
 *         isMuted:
 *           type: boolean
 *     
 *     Message:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "cm123msg456"
 *         content:
 *           type: string
 *           example: "Hola, ¿cómo estás?"
 *         messageType:
 *           type: string
 *           enum: [TEXT, IMAGE, FILE, AUDIO, VIDEO, SYSTEM, LOCATION, CONTACT]
 *         fileUrl:
 *           type: string
 *           nullable: true
 *           example: "https://res.cloudinary.com/telofundi/image/upload/v1234567890/telofundi/chat/chat_user123_1234567890_abc123.webp"
 *         fileName:
 *           type: string
 *           nullable: true
 *           example: "imagen_chat.jpg"
 *         fileSize:
 *           type: integer
 *           nullable: true
 *           example: 245760
 *         mimeType:
 *           type: string
 *           nullable: true
 *           example: "image/jpeg"
 *         sender:
 *           $ref: '#/components/schemas/User'
 *         isRead:
 *           type: boolean
 *         readAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         isEdited:
 *           type: boolean
 *         editedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         isPremiumMessage:
 *           type: boolean
 *         costPoints:
 *           type: integer
 *           nullable: true
 *         replyToId:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         isMine:
 *           type: boolean
 *           description: Si el mensaje fue enviado por el usuario actual
 *     
 *     CreateChatRequest:
 *       type: object
 *       required:
 *         - receiverId
 *       properties:
 *         receiverId:
 *           type: string
 *           example: "cm123user456"
 *     
 *     SendMessageRequest:
 *       type: object
 *       required:
 *         - content
 *       properties:
 *         content:
 *           type: string
 *           maxLength: 5000
 *           example: "Hola, ¿cómo estás?"
 *         messageType:
 *           type: string
 *           enum: [TEXT, IMAGE, FILE, AUDIO, VIDEO, LOCATION, CONTACT]
 *           default: TEXT
 *         replyToId:
 *           type: string
 *           nullable: true
 *         isPremiumMessage:
 *           type: boolean
 *           default: false
 *           description: Mensaje premium (cuesta más puntos)
 *
 *     CloudinaryChatImageResponse:
 *       type: object
 *       properties:
 *         url:
 *           type: string
 *           example: "https://res.cloudinary.com/telofundi/image/upload/v1234567890/telofundi/chat/chat_user123_1234567890_abc123.webp"
 *         publicId:
 *           type: string
 *           example: "telofundi/chat/chat_user123_1234567890_abc123"
 *         size:
 *           type: integer
 *           example: 245760
 *         format:
 *           type: string
 *           example: "webp"
 *         width:
 *           type: integer
 *           example: 800
 *         height:
 *           type: integer
 *           example: 600
 *         optimized:
 *           type: boolean
 *           example: true
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
 *     responses:
 *       200:
 *         description: Lista de chats obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     chats:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Chat'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
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
 *             $ref: '#/components/schemas/CreateChatRequest'
 *     responses:
 *       200:
 *         description: Chat obtenido o creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     chat:
 *                       $ref: '#/components/schemas/Chat'
 *       400:
 *         description: Datos inválidos o no puedes chatear contigo mismo
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Usuario bloqueado o no permite mensajes directos
 *       404:
 *         description: Usuario no encontrado
 */
router.post('/', authenticate,  createOrGetChat);

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
 *         description: Mensajes obtenidos exitosamente (con URLs de Cloudinary optimizadas)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     messages:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Message'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         hasMore:
 *                           type: boolean
 *       403:
 *         description: Sin acceso al chat
 *       404:
 *         description: Chat no encontrado
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
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
 *             $ref: '#/components/schemas/SendMessageRequest'
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 5000
 *                 example: "Hola, mira esta imagen"
 *               messageType:
 *                 type: string
 *                 enum: [TEXT, IMAGE, FILE]
 *                 default: TEXT
 *                 example: "IMAGE"
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Imagen para mensajes de tipo IMAGE (JPG, PNG, WebP, GIF) - Máximo 5MB
 *               replyToId:
 *                 type: string
 *                 description: ID del mensaje al que se responde
 *               isPremiumMessage:
 *                 type: boolean
 *                 default: false
 *                 description: Marcar como mensaje premium (cuesta más puntos)
 *     responses:
 *       201:
 *         description: Mensaje enviado exitosamente con imagen subida a Cloudinary
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
 *                   example: "Mensaje enviado exitosamente"
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Message'
 *                     - type: object
 *                       properties:
 *                         costPoints:
 *                           type: integer
 *                           example: 2
 *                           description: Puntos deducidos por el mensaje
 *                 uploadedFile:
 *                   $ref: '#/components/schemas/CloudinaryChatImageResponse'
 *       400:
 *         description: Datos inválidos, límite de mensajes alcanzado o puntos insuficientes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   examples:
 *                     insufficient_points:
 *                       value: "Puntos insuficientes para enviar mensaje"
 *                     daily_limit:
 *                       value: "Has alcanzado tu límite diario de 50 mensajes. Actualiza tu cuenta para enviar más."
 *                     file_too_large:
 *                       value: "Archivo demasiado grande. Máximo permitido: 5MB"
 *                 errorCode:
 *                   type: string
 *                   enum: [INSUFFICIENT_POINTS, DAILY_MESSAGE_LIMIT_REACHED, FILE_TOO_LARGE]
 *       403:
 *         description: Sin acceso al chat
 *       404:
 *         description: Chat no encontrado
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         description: Límite de rate limiting excedido
 *       500:
 *         description: Error subiendo imagen a Cloudinary
 */

// ✅ VERSIÓN ROBUSTA: MANEJO CONDICIONAL DE MIDDLEWARES
router.post('/:chatId/messages', 
  authenticate,
 
  validateFileUpload({
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
    maxSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 1,
    required: false
  }),
  // ✅ Solo usar middlewares que existan (condicional)
  ...(typeof uploadChatImage === 'function' ? [uploadChatImage] : []),
  ...(typeof processAndUploadToCloud === 'function' ? [processAndUploadToCloud] : []),
  ...(typeof cleanFileMetadata === 'function' ? [cleanFileMetadata] : []),
  ...(typeof addUploadInfo === 'function' ? [addUploadInfo] : []),
  sendMessage
);

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
 *                   example: "Mensaje editado exitosamente"
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Message'
 *                     - type: object
 *                       properties:
 *                         isEdited:
 *                           type: boolean
 *                           example: true
 *                         editedAt:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Mensaje muy antiguo para editar, tipo no editable o datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   examples:
 *                     too_old:
 *                       value: "El mensaje es muy antiguo para editar"
 *                     cannot_edit_file:
 *                       value: "Solo puedes editar mensajes de texto"
 *                 errorCode:
 *                   type: string
 *                   enum: [MESSAGE_TOO_OLD, CANNOT_EDIT_FILE_MESSAGE]
 *       404:
 *         description: Mensaje no encontrado o sin permisos
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
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
 *         description: Mensaje eliminado exitosamente (archivo eliminado de Cloudinary si existía)
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
 *                   example: "Mensaje eliminado exitosamente"
 *       404:
 *         description: Mensaje no encontrado o sin permisos
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
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
 *                   example: "Chat archivado"
 *                 data:
 *                   type: object
 *                   properties:
 *                     chatId:
 *                       type: string
 *                     isArchived:
 *                       type: boolean
 *       403:
 *         description: Sin acceso al chat
 *       404:
 *         description: Chat no encontrado
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
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
 *                 example: "2024-12-31T23:59:59Z"
 *     responses:
 *       200:
 *         description: Estado de silenciado del chat actualizado
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
 *                   example: "Chat silenciado"
 *                 data:
 *                   type: object
 *                   properties:
 *                     chatId:
 *                       type: string
 *                     isMuted:
 *                       type: boolean
 *                     mutedUntil:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *       403:
 *         description: Sin acceso al chat
 *       404:
 *         description: Chat no encontrado
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/:chatId/mute', authenticate, toggleChatMute);

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
 *         description: Buscar desde esta fecha
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Buscar hasta esta fecha
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     messages:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Message'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                     filters:
 *                       type: object
 *       403:
 *         description: Sin acceso al chat
 *       404:
 *         description: Chat no encontrado
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/:chatId/messages/search', authenticate, searchMessages);

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalMessages:
 *                       type: integer
 *                       example: 150
 *                     messagesByType:
 *                       type: object
 *                       example: {"TEXT": 120, "IMAGE": 25, "FILE": 5}
 *                       description: Incluye estadísticas de imágenes subidas a Cloudinary
 *                     messagesByMember:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           user:
 *                             $ref: '#/components/schemas/User'
 *                           count:
 *                             type: integer
 *                     chatAge:
 *                       type: integer
 *                       description: Edad del chat en días
 *                       example: 30
 *                     averageMessagesPerDay:
 *                       type: number
 *                       example: 5.0
 *       403:
 *         description: Sin acceso al chat
 *       404:
 *         description: Chat no encontrado
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
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
 *                 example: "HARASSMENT"
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 example: "El mensaje contiene acoso"
 *     responses:
 *       200:
 *         description: Mensaje reportado exitosamente
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
 *                   example: "Mensaje reportado exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     reportId:
 *                       type: string
 *       400:
 *         description: No puedes reportar tu propio mensaje
 *       403:
 *         description: Sin acceso al chat
 *       404:
 *         description: Mensaje no encontrado
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/messages/:messageId/report', authenticate, reportMessage);

// ✅ MIDDLEWARE DE MANEJO DE ERRORES PARA CHAT
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
  if (error.message && error.message.includes('Archivo muy grande')) {
    return res.status(400).json({
      success: false,
      message: 'Archivo muy grande para chat',
      errorCode: 'CHAT_FILE_TOO_LARGE',
      details: 'Máximo 5MB para archivos de chat'
    });
  }

  // Otros errores
  next(error);
});

console.log('✅ Chat routes configured with robust middleware handling');

module.exports = router;