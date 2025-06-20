const express = require('express');
const multer = require('multer');
const router = express.Router();

// ✅ MIDDLEWARES DE AUTENTICACIÓN
const { 
  authenticate,
  requireUserType, 
  requireOwnership, 
  checkClientLimits 
} = require('../middleware/auth');
const { 
  validateUpdateProfile, 
  validatePagination 
} = require('../middleware/validation');

// Controllers
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
  getCloudinaryStats
} = require('../controllers/userController');

// ✅ CONFIGURACIÓN DIRECTA DE MULTER PARA AVATARS
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  console.log('🔍 AVATAR File filter - Processing file:', {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype
  });

  // Tipos de archivo permitidos para avatars
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
  }
};

// ✅ MULTER PARA AVATARS (una sola imagen)
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB para avatars
    files: 1 // Máximo 1 imagen
  }
});

const uploadAvatar = upload.single('avatar');

// ✅ MIDDLEWARE DE DEBUG PARA AVATARS
const debugAvatar = (req, res, next) => {
  console.log('🔍 === AVATAR DEBUG ===');
  console.log('🔍 URL:', req.originalUrl);
  console.log('🔍 Method:', req.method);
  console.log('🔍 Content-Type:', req.get('content-type'));
  console.log('🔍 Content-Length:', req.get('content-length'));
  next();
};

// ✅ MIDDLEWARE PARA PROCESAR AVATAR EN CLOUDINARY
const processAvatarCloudinary = async (req, res, next) => {
  try {
    console.log('☁️ Processing avatar upload to Cloudinary...');
    console.log('☁️ File received by multer:', !!req.file);

    if (!req.file) {
      console.log('ℹ️ No file to upload to Cloudinary');
      return next();
    }

    // Importar servicio de upload
    const { uploadToCloudinary } = require('../services/uploadService');

    const cloudinaryOptions = {
      folder: 'telofundi/avatars',
      type: 'avatar',
      userId: req.user?.id,
      generateVariations: true
    };

    console.log('📤 Uploading avatar to Cloudinary...', {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      userId: req.user?.id
    });

    const uploadResult = await uploadToCloudinary(req.file, cloudinaryOptions);
    
    req.uploadedFile = uploadResult;

    console.log('✅ Avatar uploaded to Cloudinary successfully:', {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id
    });

    next();

  } catch (error) {
    console.error('❌ Avatar Cloudinary upload error:', error);
    req.uploadError = error.message;
    next(); // Continuar sin bloquear
  }
};

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
router.get('/profile', authenticate, getUserProfile);

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
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: "Juan"
 *               lastName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: "Pérez"
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Mi nueva biografía"
 *               phone:
 *                 type: string
 *                 example: "+1234567890"
 *               website:
 *                 type: string
 *                 format: uri
 *                 example: "https://miwebsite.com"
 *               age:
 *                 type: integer
 *                 minimum: 18
 *                 maximum: 80
 *                 example: 25
 *               services:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 10
 *                 example: ["Masajes", "Compañía"]
 *     responses:
 *       200:
 *         description: Perfil actualizado exitosamente
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/profile', authenticate, validateUpdateProfile, updateUserProfile);

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
 *       400:
 *         description: Error en el archivo o límites excedidos
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         description: Límite de uploads excedido
 *       500:
 *         description: Error subiendo a Cloudinary
 */
// ✅ RUTA DE UPLOAD DE AVATAR CORREGIDA
router.post('/profile/picture', 
  debugAvatar,              // Debug
  authenticate,             // Autenticación
  uploadAvatar,             // Multer - procesar archivo
  processAvatarCloudinary,  // Cloudinary - subir archivo
  uploadProfilePicture      // Controller
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
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete('/profile/picture', authenticate, deleteProfilePicture);

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
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/search', authenticate, validatePagination, searchUsers);

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
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/discover', authenticate, validatePagination, getDiscoverUsers);

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
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/trending', authenticate, validatePagination, getTrendingUsers);

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
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/stats', authenticate, getUserStats);

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
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/blocked', authenticate, validatePagination, getBlockedUsers);

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
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/settings', authenticate, getUserSettings);

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
 *               showOnline:
 *                 type: boolean
 *                 example: true
 *               showInDiscovery:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Configuraciones actualizadas
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/settings', authenticate, updateUserSettings);

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
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/:userId', authenticate, checkClientLimits, getUserById);

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
router.post('/:userId/block', authenticate, blockUser);

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
router.delete('/:userId/unblock', authenticate, unblockUser);

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
router.post('/:userId/report', authenticate, reportUser);

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
router.delete('/account', authenticate, deleteUserAccount);

// ✅ MIDDLEWARE DE MANEJO DE ERRORES DE MULTER PARA AVATARS
router.use((error, req, res, next) => {
  console.error('🔥 Users route error:', error);

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          message: 'Archivo muy grande',
          errorCode: 'FILE_TOO_LARGE',
          details: 'Máximo 3MB para avatars'
        });

      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Demasiados archivos',
          errorCode: 'TOO_MANY_FILES',
          details: 'Solo se permite 1 archivo para avatar'
        });

      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Campo de archivo inesperado',
          errorCode: 'UNEXPECTED_FILE_FIELD',
          details: `Campo esperado: avatar, recibido: ${error.field}`
        });

      default:
        return res.status(400).json({
          success: false,
          message: 'Error de upload',
          errorCode: 'UPLOAD_ERROR',
          details: error.message
        });
    }
  }

  // Error de filtro de archivos
  if (error.message.includes('Tipo de archivo no permitido')) {
    return res.status(400).json({
      success: false,
      message: 'Tipo de archivo no permitido',
      errorCode: 'INVALID_FILE_TYPE',
      details: 'Solo se permiten imágenes (JPG, PNG, GIF, WebP) para avatars',
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    });
  }

  // Otros errores
  next(error);
});

// TEST CLOUDINARY PÚBLICO - SIN AUTENTICACIÓN (por eso está al final)
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

console.log('✅ Users routes configured with DIRECT MULTER implementation');

module.exports = router;