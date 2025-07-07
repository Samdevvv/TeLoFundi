const express = require('express');
const multer = require('multer');
const router = express.Router();

// Middlewares
const { authenticate } = require('../middleware/auth');
const { validateUser } = require('../middleware/validation');

// Controllers
const {
  createPost,
  checkPostLimits,
  getFeed,
  getTrendingPosts,
  getDiscoveryPosts,
  getPostById,
  updatePost,
  deletePost,
  likePost,
  toggleFavorite,
  getMyPosts
} = require('../controllers/postController');

// ✅ CONFIGURACIÓN DIRECTA DE MULTER - SIN ARCHIVOS EXTERNOS
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Solo log en desarrollo
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 MULTER File filter - Processing file:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype
    });
  }

  // Tipos de archivo permitidos
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
  }
};

// ✅ MULTER PARA POSTS (múltiples imágenes)
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB por imagen
    files: 5 // Máximo 5 imágenes
  }
});

const uploadPostImages = upload.array('images', 5);

// ✅ MIDDLEWARE DE DEBUG CONDICIONAL - SOLO EN DESARROLLO
const debugMulter = process.env.NODE_ENV === 'development' ? (req, res, next) => {
  console.log('🔍 === MULTER DEBUG START ===');
  console.log('🔍 URL:', req.originalUrl);
  console.log('🔍 Method:', req.method);
  console.log('🔍 Content-Type:', req.get('content-type'));
  console.log('🔍 Content-Length:', req.get('content-length'));
  
  // Debug del body antes de multer
  console.log('🔍 Body status:', {
    hasBody: !!req.body,
    bodyKeys: Object.keys(req.body || {}),
    bodyType: typeof req.body,
    isEmpty: Object.keys(req.body || {}).length === 0
  });

  // Debug de headers importantes
  console.log('🔍 Headers:', {
    authorization: req.get('authorization') ? 'Present' : 'Missing',
    contentType: req.get('content-type'),
    contentLength: req.get('content-length')
  });

  // Debug del usuario autenticado (si existe)
  console.log('🔍 User info:', {
    hasUser: !!req.user,
    userId: req.user?.id,
    username: req.user?.username
  });

  // Debug de archivos antes de multer (normalmente vacío)
  console.log('🔍 Files before multer:', {
    hasFiles: !!req.files,
    filesCount: req.files?.length || 0
  });

  console.log('🔍 === MULTER DEBUG END ===');
  next();
} : (req, res, next) => next(); // En producción, simplemente continúa

// ✅ MIDDLEWARE PARA PROCESAR CLOUDINARY DESPUÉS DE MULTER - OPTIMIZADO
const processCloudinary = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('☁️ Processing Cloudinary upload...');
      console.log('☁️ Files received by multer:', req.files?.length || 0);
    }

    if (!req.files || req.files.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('ℹ️ No files to upload to Cloudinary');
      }
      return next();
    }

    const { uploadMultipleToCloudinary } = require('../services/uploadService');

    // ✅ OPCIONES CORREGIDAS SIN 'type' - SOLO OPCIONES VÁLIDAS DE CLOUDINARY
    const cloudinaryOptions = {
      folder: 'telofundi/posts',
      userId: req.user?.id,
      generateVariations: true,
      tags: ['post', 'telofundi'],
      context: { userId: req.user?.id }
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('📤 Uploading to Cloudinary...', {
        filesCount: req.files.length,
        userId: req.user?.id,
        folder: cloudinaryOptions.folder
      });
    }

    const uploadResult = await uploadMultipleToCloudinary(req.files, cloudinaryOptions);
    
    if (uploadResult.totalUploaded === 0) {
      throw new Error('No se pudo subir ningún archivo a Cloudinary');
    }

    req.uploadedFiles = uploadResult.successful;
    req.failedUploads = uploadResult.failed;

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Cloudinary upload completed:', {
        successful: uploadResult.totalUploaded,
        failed: uploadResult.totalFailed
      });
    }

    next();

  } catch (error) {
    console.error('❌ Cloudinary upload error:', error);
    req.uploadError = error.message;
    next(); // Continuar sin bloquear
  }
};

/**
 * @swagger
 * components:
 *   schemas:
 *     Post:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "cm123abc456"
 *         title:
 *           type: string
 *           example: "Servicios de acompañamiento VIP"
 *         description:
 *           type: string
 *           example: "Ofrezco servicios de alta calidad..."
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           example: ["https://res.cloudinary.com/telofundi/image/upload/v1234567890/telofundi/posts/post_1.webp"]
 *         author:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             username:
 *               type: string
 *             avatar:
 *               type: string
 *         likes:
 *           type: integer
 *           example: 15
 *         views:
 *           type: integer
 *           example: 120
 *         isLiked:
 *           type: boolean
 *           example: false
 *         isFavorited:
 *           type: boolean
 *           example: false
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

// ✅ RUTAS PÚBLICAS (sin autenticación)

/**
 * @swagger
 * /api/posts/feed:
 *   get:
 *     summary: Obtener feed de posts públicos
 *     tags: [Posts]
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
 *     responses:
 *       200:
 *         description: Feed de posts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Post'
 */
router.get('/feed', getFeed);

/**
 * @swagger
 * /api/posts/trending:
 *   get:
 *     summary: Obtener posts en tendencia
 *     tags: [Posts]
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
 *     responses:
 *       200:
 *         description: Posts en tendencia
 */
router.get('/trending', getTrendingPosts);

/**
 * @swagger
 * /api/posts/discover:
 *   get:
 *     summary: Obtener posts para descubrir
 *     tags: [Posts]
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
 *     responses:
 *       200:
 *         description: Posts para descubrir
 */
router.get('/discover', getDiscoveryPosts);

// ✅ RUTAS PROTEGIDAS CON PATHS ESPECÍFICOS (DEBEN IR ANTES DE /:postId)

/**
 * @swagger
 * /api/posts/limits:
 *   get:
 *     summary: Verificar límites de posts del usuario
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Información de límites
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
 *                     canCreateFreePost:
 *                       type: boolean
 *                     freePostsRemaining:
 *                       type: integer
 *                     totalPosts:
 *                       type: integer
 *                     freePostsLimit:
 *                       type: integer
 *                     additionalPostCost:
 *                       type: number
 *                       example: 3.00
 */
router.get('/limits', authenticate, validateUser, checkPostLimits);

/**
 * @swagger
 * /api/posts/my:
 *   get:
 *     summary: Obtener mis posts
 *     tags: [Posts]
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, deleted, all]
 *           default: active
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [recent, oldest, popular, likes]
 *           default: recent
 *     responses:
 *       200:
 *         description: Mis posts
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
 *                     posts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Post'
 *                     pagination:
 *                       type: object
 *                     stats:
 *                       type: object
 *       401:
 *         description: No autorizado
 */
router.get('/my', authenticate, validateUser, getMyPosts);

/**
 * @swagger
 * /api/posts:
 *   post:
 *     summary: Crear nuevo post con imágenes
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 100
 *                 example: "Servicios de acompañamiento VIP"
 *               description:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 2000
 *                 example: "Ofrezco servicios de alta calidad para caballeros distinguidos..."
 *               phone:
 *                 type: string
 *                 example: "+1234567890"
 *               services:
 *                 type: string
 *                 description: "JSON string con servicios (para FormData)"
 *                 example: '["Masajes", "Compañía", "Cenas"]'
 *               locationId:
 *                 type: string
 *                 example: "cm123location"
 *               isPaidPost:
 *                 type: string
 *                 enum: ["true", "false"]
 *                 description: "String porque viene de FormData"
 *                 example: "false"
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Hasta 5 imágenes, máximo 8MB cada una
 *             required:
 *               - title
 *               - description
 *               - phone
 *     responses:
 *       201:
 *         description: Post creado exitosamente
 *       400:
 *         description: Error de validación o archivos
 *       401:
 *         description: No autorizado
 *       402:
 *         description: Pago requerido para post adicional
 */
router.post('/', 
  debugMulter,           // Debug condicional (solo desarrollo)
  authenticate,          // Autenticación
  validateUser,          // Validación de usuario
  uploadPostImages,      // Multer - procesar FormData
  processCloudinary,     // Cloudinary - subir archivos
  createPost             // Controller
);

// ✅ RUTAS CON PARÁMETROS (DEBEN IR AL FINAL)

/**
 * @swagger
 * /api/posts/{postId}:
 *   get:
 *     summary: Obtener post por ID
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del post
 *     responses:
 *       200:
 *         description: Detalles del post
 *       404:
 *         description: Post no encontrado
 */
router.get('/:postId', getPostById);

/**
 * @swagger
 * /api/posts/{postId}:
 *   put:
 *     summary: Actualizar post existente
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del post a actualizar
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 2000
 *               phone:
 *                 type: string
 *               services:
 *                 type: string
 *                 description: "JSON string con servicios"
 *               removeImages:
 *                 type: string
 *                 description: "JSON string con URLs de imágenes a eliminar"
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Nuevas imágenes (opcional)
 *     responses:
 *       200:
 *         description: Post actualizado exitosamente
 *       400:
 *         description: Error de validación
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No eres el propietario del post
 *       404:
 *         description: Post no encontrado
 */
router.put('/:postId', 
  debugMulter,           // Debug condicional
  authenticate,          // Autenticación
  validateUser,          // Validación de usuario
  uploadPostImages,      // Multer - procesar FormData
  processCloudinary,     // Cloudinary - subir archivos
  updatePost             // Controller
);

/**
 * @swagger
 * /api/posts/{postId}:
 *   delete:
 *     summary: Eliminar post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del post a eliminar
 *     responses:
 *       200:
 *         description: Post eliminado exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No eres el propietario del post
 *       404:
 *         description: Post no encontrado
 */
router.delete('/:postId', authenticate, validateUser, deletePost);

/**
 * @swagger
 * /api/posts/{postId}/like:
 *   post:
 *     summary: Dar/quitar like a un post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del post
 *     responses:
 *       200:
 *         description: Like actualizado exitosamente
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
 *                   example: "Like agregado"
 *                 data:
 *                   type: object
 *                   properties:
 *                     isLiked:
 *                       type: boolean
 *                       example: true
 *                     totalLikes:
 *                       type: integer
 *                       example: 16
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Post no encontrado
 */
router.post('/:postId/like', authenticate, validateUser, likePost);

/**
 * @swagger
 * /api/posts/{postId}/favorite:
 *   post:
 *     summary: Agregar/quitar de favoritos
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del post
 *     responses:
 *       200:
 *         description: Favorito actualizado exitosamente
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
 *                   example: "Agregado a favoritos"
 *                 data:
 *                   type: object
 *                   properties:
 *                     isFavorited:
 *                       type: boolean
 *                       example: true
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Post no encontrado
 */
router.post('/:postId/favorite', authenticate, validateUser, toggleFavorite);

// ✅ MIDDLEWARE DE MANEJO DE ERRORES DE MULTER
router.use((error, req, res, next) => {
  console.error('🔥 Posts route error:', error);

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          message: 'Archivo muy grande',
          errorCode: 'FILE_TOO_LARGE',
          details: 'Máximo 8MB por imagen'
        });

      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Demasiados archivos',
          errorCode: 'TOO_MANY_FILES',
          details: 'Máximo 5 imágenes por post'
        });

      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Campo de archivo inesperado',
          errorCode: 'UNEXPECTED_FILE_FIELD',
          details: `Campo recibido: ${error.field}. Campo esperado: "images"`
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
      details: 'Solo se permiten imágenes (JPG, PNG, GIF, WebP)',
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    });
  }

  // Otros errores
  next(error);
});

if (process.env.NODE_ENV === 'development') {
  console.log('✅ Posts routes configured with OPTIMIZED DEBUG and CLOUDINARY');
}

module.exports = router;