const express = require('express');
const router = express.Router();

// Middleware de autenticación y validación
const { 
  requireEscortOrAgency, 
  requireOwnership,
  optionalAuth 
} = require('../middleware/auth');
const { 
  validateCreatePost, 
  validateUpdatePost, 
  validatePagination 
} = require('../middleware/validation');
const { 
  postLimiter, 
  uploadLimiter, 
  searchLimiter 
} = require('../middleware/rateLimiter');

// MIDDLEWARES DE UPLOAD INTEGRADOS CON CLOUDINARY
const {
  uploadPostImages,
  processAndUploadToCloud,
  validateFileTypes,
  cleanFileMetadata,
  addUploadInfo,
  handleMulterError
} = require('../middleware/upload');

// Controllers - NOMBRES CORREGIDOS PARA COINCIDIR CON EL CONTROLADOR
const {
  createPost,
  getFeed,              // Era getAllPosts
  getPostById,
  updatePost,
  deletePost,
  likePost,             // Unificado (era likePost y unlikePost)
  toggleFavorite,       // Era addToFavorites y removeFromFavorites
  getMyPosts,           // Era getUserFavorites y getUserLikes  
  getTrendingPosts,
  getDiscoveryPosts     // Era getDiscoverPosts
} = require('../controllers/postController');

/**
 * @swagger
 * components:
 *   schemas:
 *     Post:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "cm123post456"
 *         title:
 *           type: string
 *           example: "Anuncio de ejemplo"
 *         description:
 *           type: string
 *           example: "Descripción detallada del anuncio"
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           example: ["https://res.cloudinary.com/telofundi/image/upload/v1234567890/telofundi/posts/post_user123_1234567890_abc123.webp"]
 *         phone:
 *           type: string
 *           example: "+1234567890"
 *         services:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Masajes", "Compañía"]
 *         rates:
 *           type: object
 *           example: {"1h": 100, "2h": 180}
 *         views:
 *           type: integer
 *           example: 150
 *         likes:
 *           type: integer
 *           example: 25
 *         isActive:
 *           type: boolean
 *           example: true
 *         isTrending:
 *           type: boolean
 *           example: false
 *         isFeatured:
 *           type: boolean
 *           example: false
 *         premiumOnly:
 *           type: boolean
 *           example: false
 *         score:
 *           type: number
 *           format: float
 *           example: 85.5
 *         authorId:
 *           type: string
 *           example: "cm123user456"
 *         author:
 *           $ref: '#/components/schemas/User'
 *         location:
 *           type: object
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         lastBoosted:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         isLiked:
 *           type: boolean
 *           example: false
 *           description: Si el usuario actual ha dado like
 *         isFavorited:
 *           type: boolean
 *           example: false
 *           description: Si está en favoritos del usuario actual
 *     
 *     CreatePostRequest:
 *       type: object
 *       required:
 *         - title
 *         - description
 *         - phone
 *       properties:
 *         title:
 *           type: string
 *           minLength: 5
 *           maxLength: 100
 *           example: "Servicios de masajes relajantes"
 *         description:
 *           type: string
 *           minLength: 10
 *           maxLength: 2000
 *           example: "Ofrezco servicios de masajes relajantes y terapéuticos..."
 *         phone:
 *           type: string
 *           example: "+1234567890"
 *         services:
 *           type: array
 *           items:
 *             type: string
 *           maxItems: 15
 *           example: ["Masajes", "Relajación", "Terapéutico"]
 *         rates:
 *           type: object
 *           example: {"1h": 100, "2h": 180, "overnight": 500}
 *         availability:
 *           type: object
 *           example: {"mon": ["9-17"], "tue": ["10-18"]}
 *         locationId:
 *           type: string
 *           example: "cm123location456"
 *         premiumOnly:
 *           type: boolean
 *           default: false
 *           example: false
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           maxItems: 10
 *           example: ["masajes", "relajante", "terapeutico"]
 *         removeImages:
 *           type: array
 *           items:
 *             type: string
 *           description: URLs de imágenes a eliminar (solo para actualización)
 *           example: ["https://res.cloudinary.com/old-image.jpg"]
 *
 *     CloudinaryImageResponse:
 *       type: object
 *       properties:
 *         url:
 *           type: string
 *           example: "https://res.cloudinary.com/telofundi/image/upload/v1234567890/telofundi/posts/post_user123_1234567890_abc123.webp"
 *         publicId:
 *           type: string
 *           example: "telofundi/posts/post_user123_1234567890_abc123"
 *         size:
 *           type: integer
 *           example: 456789
 *         format:
 *           type: string
 *           example: "webp"
 *         width:
 *           type: integer
 *           example: 1200
 *         height:
 *           type: integer
 *           example: 900
 *         optimized:
 *           type: boolean
 *           example: true
 *         variations:
 *           type: object
 *           properties:
 *             thumbnail:
 *               type: string
 *             small:
 *               type: string
 *             medium:
 *               type: string
 */

/**
 * @swagger
 * /api/posts:
 *   post:
 *     summary: Crear nuevo post/anuncio con imágenes (Cloudinary)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - phone
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 100
 *                 example: "Servicios de masajes relajantes"
 *               description:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 2000
 *                 example: "Ofrezco servicios de masajes relajantes y terapéuticos..."
 *               phone:
 *                 type: string
 *                 example: "+1234567890"
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 maxItems: 5
 *                 description: Hasta 5 imágenes (JPG, PNG, WebP) - Máximo 8MB cada una
 *               services:
 *                 type: string
 *                 description: JSON string array
 *                 example: '["Masajes", "Relajación"]'
 *               rates:
 *                 type: string
 *                 description: JSON string object
 *                 example: '{"1h": 100, "2h": 180}'
 *               availability:
 *                 type: string
 *                 description: JSON string object
 *                 example: '{"mon": ["9-17"], "tue": ["10-18"]}'
 *               locationId:
 *                 type: string
 *                 example: "cm123location456"
 *               premiumOnly:
 *                 type: boolean
 *                 default: false
 *               tags:
 *                 type: string
 *                 description: JSON string array
 *                 example: '["masajes", "relajante"]'
 *     responses:
 *       201:
 *         description: Post creado exitosamente con imágenes subidas a Cloudinary
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
 *                   example: "Anuncio creado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Post'
 *                 uploadedFiles:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CloudinaryImageResponse'
 *                 uploadStats:
 *                   type: object
 *                   properties:
 *                     totalFiles:
 *                       type: integer
 *                       example: 3
 *                     totalSize:
 *                       type: integer
 *                       example: 1234567
 *                     formats:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["webp", "jpg"]
 *                     hasVariations:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Error de validación o archivo
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
 *                   example: "Has alcanzado el límite de 5 anuncios activos"
 *                 errorCode:
 *                   type: string
 *                   example: "POST_LIMIT_REACHED"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Límite de posts alcanzado o permisos insuficientes
 *       429:
 *         description: Límite de uploads excedido
 *       500:
 *         description: Error subiendo imágenes a Cloudinary
 */
router.post('/', 
  requireEscortOrAgency, 
  postLimiter,
  uploadLimiter,
  uploadPostImages,
  validateFileTypes(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']),
  processAndUploadToCloud,
  cleanFileMetadata,
  addUploadInfo,
  validateCreatePost,
  createPost
);

/**
 * @swagger
 * /api/posts/feed:
 *   get:
 *     summary: Obtener feed principal de posts
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
 *           maximum: 50
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filtrar por ubicación
 *       - in: query
 *         name: userType
 *         schema:
 *           type: string
 *           enum: [ESCORT, AGENCY]
 *         description: Filtrar por tipo de autor
 *       - in: query
 *         name: services
 *         schema:
 *           type: string
 *         description: Filtrar por servicios
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [recent, trending, popular, boosted]
 *           default: recent
 *       - in: query
 *         name: minAge
 *         schema:
 *           type: integer
 *           minimum: 18
 *         description: Edad mínima del autor (escorts)
 *       - in: query
 *         name: maxAge
 *         schema:
 *           type: integer
 *           maximum: 80
 *         description: Edad máxima del autor (escorts)
 *       - in: query
 *         name: verified
 *         schema:
 *           type: boolean
 *         description: Solo autores verificados
 *     responses:
 *       200:
 *         description: Feed de posts con imágenes optimizadas de Cloudinary
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
 *                       $ref: '#/components/schemas/Pagination'
 *                     filters:
 *                       type: object
 *                       properties:
 *                         location:
 *                           type: string
 *                         userType:
 *                           type: string
 *                         services:
 *                           type: string
 *                         sortBy:
 *                           type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/feed', validatePagination, getFeed);

/**
 * @swagger
 * /api/posts/discover:
 *   get:
 *     summary: Obtener posts recomendados
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 50
 *       - in: query
 *         name: algorithm
 *         schema:
 *           type: string
 *           enum: [mixed, quality, new, popular, personalized]
 *           default: mixed
 *     responses:
 *       200:
 *         description: Posts recomendados
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/discover', getDiscoveryPosts);

/**
 * @swagger
 * /api/posts/trending:
 *   get:
 *     summary: Obtener posts en tendencia
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 50
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [1h, 6h, 24h, 7d]
 *           default: 24h
 *         description: Marco temporal para trending
 *     responses:
 *       200:
 *         description: Posts en tendencia
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 */
router.get('/trending', getTrendingPosts);

/**
 * @swagger
 * /api/posts/my:
 *   get:
 *     summary: Obtener posts del usuario autenticado
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
 *           maximum: 100
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, deleted, all]
 *           default: active
 *     responses:
 *       200:
 *         description: Posts del usuario con información de boost y Cloudinary
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
 *                         allOf:
 *                           - $ref: '#/components/schemas/Post'
 *                           - type: object
 *                             properties:
 *                               isBoosted:
 *                                 type: boolean
 *                                 example: true
 *                               activeBoost:
 *                                 type: object
 *                                 nullable: true
 *                                 properties:
 *                                   id:
 *                                     type: string
 *                                   expiresAt:
 *                                     type: string
 *                                     format: date-time
 *                                   pricing:
 *                                     type: object
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                     status:
 *                       type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/my', validatePagination, getMyPosts);

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
 *         description: Detalles del post con imágenes de Cloudinary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Post'
 *                     - type: object
 *                       properties:
 *                         tags:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                               color:
 *                                 type: string
 *                         likesCount:
 *                           type: integer
 *                         favoritesCount:
 *                           type: integer
 *                         viewsCount:
 *                           type: integer
 *       403:
 *         description: Contenido premium - actualiza tu cuenta
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:postId', optionalAuth, getPostById);

/**
 * @swagger
 * /api/posts/{postId}:
 *   put:
 *     summary: Actualizar post con gestión de imágenes en Cloudinary
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
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 maxItems: 5
 *                 description: Nuevas imágenes a agregar
 *               removeImages:
 *                 type: string
 *                 description: JSON array de URLs de imágenes a eliminar
 *                 example: '["https://res.cloudinary.com/old-image.jpg"]'
 *               services:
 *                 type: string
 *                 description: JSON string array
 *               rates:
 *                 type: string
 *                 description: JSON string object
 *               availability:
 *                 type: string
 *                 description: JSON string object
 *               locationId:
 *                 type: string
 *               premiumOnly:
 *                 type: boolean
 *               tags:
 *                 type: string
 *                 description: JSON string array
 *     responses:
 *       200:
 *         description: Post actualizado exitosamente con gestión de imágenes
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
 *                   example: "Anuncio actualizado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Post'
 *                 uploadedFiles:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CloudinaryImageResponse'
 *                   description: Nuevas imágenes subidas
 *       400:
 *         description: Error de validación o demasiadas imágenes
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
 *                   example: "Máximo 5 imágenes permitidas en total"
 *                 errorCode:
 *                   type: string
 *                   example: "TOO_MANY_IMAGES"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put('/:postId', 
  requireOwnership('postId', 'post'),
  uploadLimiter,
  uploadPostImages,
  validateFileTypes(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']),
  processAndUploadToCloud,
  cleanFileMetadata,
  addUploadInfo,
  validateUpdatePost,
  updatePost
);

/**
 * @swagger
 * /api/posts/{postId}:
 *   delete:
 *     summary: Eliminar post (también elimina imágenes de Cloudinary)
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
 *         description: Post eliminado exitosamente (soft delete + limpieza Cloudinary)
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
 *                   example: "Anuncio eliminado exitosamente"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/:postId', requireOwnership('postId', 'post'), deletePost);

/**
 * @swagger
 * /api/posts/{postId}/like:
 *   post:
 *     summary: Dar/quitar like a un post (toggle)
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
 *         description: Like agregado/removido exitosamente
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
 *       400:
 *         description: No puedes dar like a tu propio anuncio
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post('/:postId/like', likePost);

/**
 * @swagger
 * /api/posts/{postId}/favorite:
 *   post:
 *     summary: Agregar/quitar de favoritos (toggle)
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
 *         description: Post agregado/removido de favoritos
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
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post('/:postId/favorite', toggleFavorite);

module.exports = router;