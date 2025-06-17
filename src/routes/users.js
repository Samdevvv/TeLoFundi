const express = require('express');
const router = express.Router();

// Middleware de autenticación y validación
const { 
  requireUserType, 
  requireOwnership, 
  checkClientLimits 
} = require('../middleware/auth');
const { 
  validateUpdateProfile, 
  validatePagination 
} = require('../middleware/validation');
const { uploadLimiter } = require('../middleware/rateLimiter');

// NUEVOS MIDDLEWARES DE UPLOAD INTEGRADOS CON CLOUDINARY
const {
  uploadAvatar,
  processAndUploadToCloud,
  validateFileTypes,
  cleanFileMetadata,
  addUploadInfo,
  handleMulterError
} = require('../middleware/upload');

// Controllers - NOMBRES CORREGIDOS
const {
  getUserProfile,
  updateUserProfile,
  uploadProfilePicture,
  deleteProfilePicture,
  getUserById,
  searchUsers,
  getDiscoverUsers,
  getTrendingUsers,
  getUserStats,
  blockUser,
  unblockUser,
  getBlockedUsers,
  updateUserSettings,
  getUserSettings,
  deleteUserAccount,
  reportUser,
  getCloudinaryStats // NUEVO: Para admins
} = require('../controllers/userController');

/**
 * @swagger
 * components:
 *   schemas:
 *     UserProfile:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "cm123abc456"
 *         username:
 *           type: string
 *           example: "usuario123"
 *         firstName:
 *           type: string
 *           example: "Juan"
 *         lastName:
 *           type: string
 *           example: "Pérez"
 *         avatar:
 *           type: string
 *           nullable: true
 *           example: "https://res.cloudinary.com/telofundi/image/upload/v1234567890/telofundi/avatars/avatar_user123_1234567890_abc123.webp"
 *         bio:
 *           type: string
 *           nullable: true
 *           example: "Descripción del usuario"
 *         phone:
 *           type: string
 *           nullable: true
 *           example: "+1234567890"
 *         website:
 *           type: string
 *           nullable: true
 *           example: "https://miwebsite.com"
 *         userType:
 *           type: string
 *           enum: [ESCORT, AGENCY, CLIENT, ADMIN]
 *           example: "ESCORT"
 *         profileViews:
 *           type: integer
 *           example: 150
 *         isActive:
 *           type: boolean
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         lastActiveAt:
 *           type: string
 *           format: date-time
 *         location:
 *           type: object
 *           nullable: true
 *         reputation:
 *           type: object
 *           nullable: true
 *         escort:
 *           type: object
 *           nullable: true
 *         agency:
 *           type: object
 *           nullable: true
 *         client:
 *           type: object
 *           nullable: true
 *     
 *     UpdateProfileRequest:
 *       type: object
 *       properties:
 *         firstName:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *           example: "Juan"
 *         lastName:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *           example: "Pérez"
 *         bio:
 *           type: string
 *           maxLength: 500
 *           example: "Mi nueva biografía"
 *         phone:
 *           type: string
 *           example: "+1234567890"
 *         website:
 *           type: string
 *           format: uri
 *           example: "https://miwebsite.com"
 *         locationId:
 *           type: string
 *           example: "cm123location456"
 *         age:
 *           type: integer
 *           minimum: 18
 *           maximum: 80
 *           example: 25
 *         services:
 *           type: array
 *           items:
 *             type: string
 *           maxItems: 10
 *           example: ["Masajes", "Compañía"]
 *         rates:
 *           type: object
 *           example: {"1h": 100, "2h": 180}
 *         languages:
 *           type: array
 *           items:
 *             type: string
 *           maxItems: 10
 *           example: ["Español", "Inglés"]
 *
 *     CloudinaryUploadResponse:
 *       type: object
 *       properties:
 *         url:
 *           type: string
 *           example: "https://res.cloudinary.com/telofundi/image/upload/v1234567890/avatar.webp"
 *         publicId:
 *           type: string
 *           example: "telofundi/avatars/avatar_user123_1234567890_abc123"
 *         size:
 *           type: integer
 *           example: 245760
 *         format:
 *           type: string
 *           example: "webp"
 *         width:
 *           type: integer
 *           example: 400
 *         height:
 *           type: integer
 *           example: 400
 *         optimized:
 *           type: boolean
 *           example: true
 */



/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Obtener perfil del usuario autenticado
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/profile', getUserProfile);

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Actualizar perfil del usuario
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *     responses:
 *       200:
 *         description: Perfil actualizado exitosamente
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
 *                   example: "Perfil actualizado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/profile', validateUpdateProfile, updateUserProfile);

/**
 * @swagger
 * /api/users/profile/picture:
 *   post:
 *     summary: Subir foto de perfil (Optimizado con Cloudinary)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Archivo de imagen (JPG, PNG, GIF, WebP) - Máximo 3MB
 *             required:
 *               - avatar
 *     responses:
 *       200:
 *         description: Foto de perfil subida exitosamente a Cloudinary
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
 *                   example: "Foto de perfil actualizada"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         avatar:
 *                           type: string
 *                           example: "https://res.cloudinary.com/telofundi/image/upload/v1234567890/telofundi/avatars/avatar_user123_1234567890_abc123.webp"
 *                         firstName:
 *                           type: string
 *                         lastName:
 *                           type: string
 *                         userType:
 *                           type: string
 *                     avatar:
 *                       type: string
 *                       example: "https://res.cloudinary.com/telofundi/image/upload/v1234567890/telofundi/avatars/avatar_user123_1234567890_abc123.webp"
 *                     cloudinary:
 *                       type: object
 *                       properties:
 *                         public_id:
 *                           type: string
 *                           example: "telofundi/avatars/avatar_user123_1234567890_abc123"
 *                         format:
 *                           type: string
 *                           example: "webp"
 *                         width:
 *                           type: integer
 *                           example: 400
 *                         height:
 *                           type: integer
 *                           example: 400
 *                         bytes:
 *                           type: integer
 *                           example: 245760
 *                 uploadedFile:
 *                   $ref: '#/components/schemas/CloudinaryUploadResponse'
 *       400:
 *         description: Error en el archivo o límites excedidos
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
 *                   example: "Archivo demasiado grande. Máximo permitido: 3MB"
 *                 errorCode:
 *                   type: string
 *                   example: "FILE_TOO_LARGE"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         description: Límite de uploads excedido
 *       500:
 *         description: Error subiendo a Cloudinary
 */
router.post('/profile/picture', 
  uploadLimiter,
  uploadAvatar,
  validateFileTypes(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']),
  processAndUploadToCloud,
  cleanFileMetadata,
  addUploadInfo,
  uploadProfilePicture
);

/**
 * @swagger
 * /api/users/profile/picture:
 *   delete:
 *     summary: Eliminar foto de perfil (También elimina de Cloudinary)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Foto de perfil eliminada de la base de datos y Cloudinary
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
 *                   example: "Foto de perfil eliminada exitosamente"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete('/profile/picture', deleteProfilePicture);

/**
 * @swagger
 * /api/users/search:
 *   get:
 *     summary: Buscar usuarios
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Término de búsqueda
 *       - in: query
 *         name: userType
 *         schema:
 *           type: string
 *           enum: [ESCORT, AGENCY, CLIENT]
 *         description: Filtrar por tipo de usuario
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filtrar por ubicación
 *       - in: query
 *         name: verified
 *         schema:
 *           type: boolean
 *         description: Solo usuarios verificados
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Resultados por página
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [relevance, newest, oldest, popular, rating]
 *           default: relevance
 *         description: Campo para ordenar
 *     responses:
 *       200:
 *         description: Resultados de búsqueda
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/search', validatePagination, searchUsers);

/**
 * @swagger
 * /api/users/discover:
 *   get:
 *     summary: Obtener usuarios recomendados
 *     tags: [Users]
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
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Usuarios recomendados
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/discover', validatePagination, getDiscoverUsers);

/**
 * @swagger
 * /api/users/trending:
 *   get:
 *     summary: Obtener usuarios en tendencia
 *     tags: [Users]
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
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Usuarios en tendencia
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/trending', validatePagination, getTrendingUsers);

/**
 * @swagger
 * /api/users/stats:
 *   get:
 *     summary: Obtener estadísticas del usuario
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas del usuario
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
 *                     profileViews:
 *                       type: integer
 *                       example: 150
 *                     totalPosts:
 *                       type: integer
 *                       example: 5
 *                     totalLikes:
 *                       type: integer
 *                       example: 25
 *                     totalFavorites:
 *                       type: integer
 *                       example: 10
 *                     totalMessages:
 *                       type: integer
 *                       example: 45
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/stats', getUserStats);

/**
 * @swagger
 * /api/users/blocked:
 *   get:
 *     summary: Obtener lista de usuarios bloqueados
 *     tags: [Users]
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
 *     responses:
 *       200:
 *         description: Lista de usuarios bloqueados
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/blocked', validatePagination, getBlockedUsers);

/**
 * @swagger
 * /api/users/settings:
 *   get:
 *     summary: Obtener configuraciones del usuario
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuraciones del usuario
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
 *                     emailNotifications:
 *                       type: boolean
 *                       example: true
 *                     pushNotifications:
 *                       type: boolean
 *                       example: true
 *                     showOnline:
 *                       type: boolean
 *                       example: true
 *                     showInDiscovery:
 *                       type: boolean
 *                       example: true
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/settings', getUserSettings);

/**
 * @swagger
 * /api/users/settings:
 *   put:
 *     summary: Actualizar configuraciones del usuario
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailNotifications:
 *                 type: boolean
 *                 example: true
 *               pushNotifications:
 *                 type: boolean
 *                 example: true
 *               messageNotifications:
 *                 type: boolean
 *                 example: true
 *               likeNotifications:
 *                 type: boolean
 *                 example: true
 *               showOnline:
 *                 type: boolean
 *                 example: true
 *               showLastSeen:
 *                 type: boolean
 *                 example: true
 *               allowDirectMessages:
 *                 type: boolean
 *                 example: true
 *               showPhoneNumber:
 *                 type: boolean
 *                 example: false
 *               showInDiscovery:
 *                 type: boolean
 *                 example: true
 *               showInTrending:
 *                 type: boolean
 *                 example: true
 *               showInSearch:
 *                 type: boolean
 *                 example: true
 *               contentFilter:
 *                 type: string
 *                 enum: [NONE, MODERATE, STRICT]
 *                 example: "MODERATE"
 *     responses:
 *       200:
 *         description: Configuraciones actualizadas
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/settings', updateUserSettings);

/**
 * @swagger
 * /api/users/cloudinary/stats:
 *   get:
 *     summary: Obtener estadísticas de uso de Cloudinary (Solo Admins)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas de Cloudinary
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
 *                     plan:
 *                       type: string
 *                       example: "cloudinary-plus"
 *                     credits:
 *                       type: object
 *                       properties:
 *                         used:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                     storage:
 *                       type: object
 *                       properties:
 *                         used:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                     bandwidth:
 *                       type: object
 *                       properties:
 *                         used:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Acceso denegado - Solo administradores
 */
router.get('/cloudinary/stats', requireUserType(['ADMIN']), getCloudinaryStats);

/**
 * @swagger
 * /api/users/{userId}:
 *   get:
 *     summary: Obtener perfil público de un usuario
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Perfil público del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/:userId', checkClientLimits, getUserById);

/**
 * @swagger
 * /api/users/{userId}/block:
 *   post:
 *     summary: Bloquear usuario
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario a bloquear
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Comportamiento inapropiado"
 *     responses:
 *       200:
 *         description: Usuario bloqueado exitosamente
 *       400:
 *         description: No puedes bloquearte a ti mismo
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/:userId/block', blockUser);

/**
 * @swagger
 * /api/users/{userId}/unblock:
 *   delete:
 *     summary: Desbloquear usuario
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario a desbloquear
 *     responses:
 *       200:
 *         description: Usuario desbloqueado exitosamente
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete('/:userId/unblock', unblockUser);

/**
 * @swagger
 * /api/users/{userId}/report:
 *   post:
 *     summary: Reportar usuario
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario a reportar
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
 *                 enum: [SPAM, INAPPROPRIATE_CONTENT, FAKE_PROFILE, SCAM, HARASSMENT, OTHER]
 *                 example: "FAKE_PROFILE"
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 example: "Este perfil parece ser falso"
 *               evidence:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["https://example.com/screenshot1.jpg"]
 *     responses:
 *       201:
 *         description: Reporte enviado exitosamente
 *       400:
 *         description: No puedes reportarte a ti mismo
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/:userId/report', reportUser);

/**
 * @swagger
 * /api/users/account:
 *   delete:
 *     summary: Eliminar cuenta de usuario
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 example: "mi_password_actual"
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Ya no necesito la cuenta"
 *     responses:
 *       200:
 *         description: Cuenta eliminada exitosamente
 *       400:
 *         description: Contraseña incorrecta
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete('/account', deleteUserAccount);

// TEST CLOUDINARY PÚBLICO - REEMPLAZA EL CÓDIGO ANTERIOR
router.get('/test/cloudinary-public', async (req, res) => {
  try {
    const cloudinary = require('cloudinary').v2;
    
    // Test básico sin autenticación
    const testResult = await cloudinary.api.ping();
    
    res.json({
      success: true,
      message: '✅ Cloudinary funcionando perfectamente!',
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      status: 'connected',
      ping: testResult
    });
  } catch (error) {
    res.json({
      success: false,
      message: '❌ Error conectando a Cloudinary',
      error: error.message
    });
  }
});
module.exports = router;