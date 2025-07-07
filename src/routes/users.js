const express = require('express');
const multer = require('multer');
const router = express.Router();

// ✅ MIDDLEWARES DE AUTENTICACIÓN OPTIMIZADOS (CORREGIDO)
const { 
  authenticate,
  requireUserType, 
  requireOwnership, 
  checkClientLimits
} = require('../middleware/auth');

// ✅ VALIDACIONES SIMPLIFICADAS
const { 
  validateUpdateProfile, 
  validatePagination
} = require('../middleware/validation');

// ✅ CONTROLLERS - VERIFICANDO QUE TODAS LAS FUNCIONES EXISTEN
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
  deleteUserAccount, // ✅ AHORA DISPONIBLE
  reportUser,
  getCloudinaryStats
} = require('../controllers/userController');

// ✅ MIDDLEWARE SIMPLIFICADO PARA VALIDACIÓN DE USUARIO (CORREGIDO)
const validateUserAuth = [authenticate]; // Solo authenticate

// ✅ CONFIGURACIÓN DE MULTER PARA AVATARS (RESTAURADA)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB para avatars
    files: 1 // Máximo 1 imagen
  }
});

const uploadAvatar = upload.single('avatar');

// ✅ MIDDLEWARE PARA PROCESAR AVATAR EN CLOUDINARY (RESTAURADO Y OPTIMIZADO)
const processAvatarCloudinary = async (req, res, next) => {
  try {
    if (!req.file) {
      return next();
    }

    // Importar servicio de upload
    const { uploadToCloudinary } = require('../services/uploadService');

    const cloudinaryOptions = {
      folder: 'telofundi/avatars',
      type: 'avatar',
      userId: req.user?.id,
      generateVariations: false // Solo para avatars, no necesita variaciones
    };

    const uploadResult = await uploadToCloudinary(req.file, 'telofundi/avatars', cloudinaryOptions);
    
    // ✅ CRÍTICO: Crear req.uploadedFile para el controller
    req.uploadedFile = uploadResult;

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
 *         username:
 *           type: string
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         avatar:
 *           type: string
 *           nullable: true
 *         userType:
 *           type: string
 *           enum: [ESCORT, AGENCY, CLIENT, ADMIN]
 *         profileViews:
 *           type: integer
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Obtener perfil del usuario autenticado
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/profile', validateUserAuth, getUserProfile);

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Actualizar perfil del usuario
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.put('/profile', 
  validateUserAuth, 
  validateUpdateProfile, 
  updateUserProfile
);

/**
 * @swagger
 * /api/users/profile/picture:
 *   post:
 *     summary: Subir foto de perfil
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
 */
// ✅ RUTA CORREGIDA CON MIDDLEWARE DE CLOUDINARY RESTAURADO
router.post('/profile/picture', 
  validateUserAuth,         // Autenticación optimizada
  uploadAvatar,             // Multer - procesar archivo
  processAvatarCloudinary,  // ✅ RESTAURADO: Cloudinary - subir archivo
  uploadProfilePicture      // Controller
);

/**
 * @swagger
 * /api/users/profile/picture:
 *   delete:
 *     summary: Eliminar foto de perfil
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/profile/picture', validateUserAuth, deleteProfilePicture);

/**
 * @swagger
 * /api/users/search:
 *   get:
 *     summary: Buscar usuarios
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/search', 
  validateUserAuth, 
  validatePagination, 
  searchUsers
);

/**
 * @swagger
 * /api/users/discover:
 *   get:
 *     summary: Obtener usuarios recomendados
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/discover', 
  validateUserAuth, 
  validatePagination, 
  getDiscoverUsers
);

/**
 * @swagger
 * /api/users/trending:
 *   get:
 *     summary: Obtener usuarios en tendencia
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/trending', 
  validateUserAuth, 
  validatePagination, 
  getTrendingUsers
);

/**
 * @swagger
 * /api/users/stats:
 *   get:
 *     summary: Obtener estadísticas del usuario
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', validateUserAuth, getUserStats);

/**
 * @swagger
 * /api/users/blocked:
 *   get:
 *     summary: Obtener lista de usuarios bloqueados
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/blocked', 
  validateUserAuth, 
  validatePagination, 
  getBlockedUsers
);

/**
 * @swagger
 * /api/users/settings:
 *   get:
 *     summary: Obtener configuraciones del usuario
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/settings', validateUserAuth, getUserSettings);

/**
 * @swagger
 * /api/users/settings:
 *   put:
 *     summary: Actualizar configuraciones del usuario
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.put('/settings', validateUserAuth, updateUserSettings);

/**
 * @swagger
 * /api/users/cloudinary/stats:
 *   get:
 *     summary: Obtener estadísticas de uso de Cloudinary (Solo Admins)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/cloudinary/stats', 
  requireUserType('ADMIN'), 
  getCloudinaryStats
);

/**
 * @swagger
 * /api/users/account:
 *   delete:
 *     summary: Eliminar cuenta de usuario
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
// ✅ RUTA RESTAURADA - deleteUserAccount ahora disponible
router.delete('/account', validateUserAuth, deleteUserAccount);

/**
 * @swagger
 * /api/users/{userId}:
 *   get:
 *     summary: Obtener perfil público de un usuario
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:userId', 
  validateUserAuth, 
  checkClientLimits, 
  getUserById
);

/**
 * @swagger
 * /api/users/{userId}/block:
 *   post:
 *     summary: Bloquear usuario
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:userId/block', validateUserAuth, blockUser);

/**
 * @swagger
 * /api/users/{userId}/unblock:
 *   delete:
 *     summary: Desbloquear usuario
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:userId/unblock', validateUserAuth, unblockUser);

/**
 * @swagger
 * /api/users/{userId}/report:
 *   post:
 *     summary: Reportar usuario
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:userId/report', validateUserAuth, reportUser);

// ✅ MANEJO DE ERRORES DE MULTER SIMPLIFICADO
router.use((error, req, res, next) => {
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
      default:
        return res.status(400).json({
          success: false,
          message: 'Error de upload',
          errorCode: 'UPLOAD_ERROR',
          details: error.message
        });
    }
  }

  if (error.message.includes('Tipo de archivo no permitido')) {
    return res.status(400).json({
      success: false,
      message: 'Tipo de archivo no permitido',
      errorCode: 'INVALID_FILE_TYPE',
      details: 'Solo se permiten imágenes (JPG, PNG, GIF, WebP) para avatars'
    });
  }

  next(error);
});

// ✅ TEST CLOUDINARY PÚBLICO
router.get('/test/cloudinary-public', async (req, res) => {
  try {
    const cloudinary = require('cloudinary').v2;
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

console.log('✅ Users routes configured with RESTORED Cloudinary functionality');

module.exports = router;