const express = require('express');
const router = express.Router();

// ✅ CORREGIDO: Importar middleware de autenticación
const { authenticate } = require('../middleware/auth');
const { validatePagination } = require('../middleware/validation');

// Controllers
const {
  getUserFavorites,
  addToFavorites,
  removeFromFavorites,
  getUserLikes,
  addLike,
  removeLike,
  getFavoritesStats
} = require('../controllers/favoritesController');

/**
 * @swagger
 * components:
 *   schemas:
 *     Favorite:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "cm123fav456"
 *         userId:
 *           type: string
 *           example: "cm123user456"
 *         postId:
 *           type: string
 *           example: "cm123post456"
 *         post:
 *           $ref: '#/components/schemas/Post'
 *         isNotified:
 *           type: boolean
 *           example: true
 *           description: Si quiere recibir notificaciones de este post
 *         createdAt:
 *           type: string
 *           format: date-time
 *     
 *     Like:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "cm123like456"
 *         userId:
 *           type: string
 *           example: "cm123user456"
 *         postId:
 *           type: string
 *           example: "cm123post456"
 *         post:
 *           $ref: '#/components/schemas/Post'
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/favorites:
 *   get:
 *     summary: Obtener posts favoritos del usuario
 *     tags: [Favorites]
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
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, postCreatedAt]
 *           default: createdAt
 *         description: Ordenar por fecha de favorito o fecha del post
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *       - in: query
 *         name: userType
 *         schema:
 *           type: string
 *           enum: [ESCORT, AGENCY]
 *         description: Filtrar por tipo de autor del post
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filtrar por ubicación
 *     responses:
 *       200:
 *         description: Lista de posts favoritos
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
 *                     favorites:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Favorite'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                     filters:
 *                       type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// ✅ CORREGIDO: Agregado middleware authenticate
router.get('/', authenticate, validatePagination, getUserFavorites);

/**
 * @swagger
 * /api/favorites/{postId}:
 *   post:
 *     summary: Agregar post a favoritos
 *     tags: [Favorites]
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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isNotified:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *                 description: Recibir notificaciones de actualizaciones del post
 *     responses:
 *       201:
 *         description: Post agregado a favoritos exitosamente
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
 *                   example: "Post agregado a favoritos"
 *                 data:
 *                   $ref: '#/components/schemas/Favorite'
 *       400:
 *         description: Post ya está en favoritos
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Post no encontrado
 *       409:
 *         description: Post ya está en favoritos
 */
// ✅ CORREGIDO: Agregado middleware authenticate
router.post('/:postId', authenticate, addToFavorites);

/**
 * @swagger
 * /api/favorites/{postId}:
 *   delete:
 *     summary: Remover post de favoritos
 *     tags: [Favorites]
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
 *         description: Post removido de favoritos exitosamente
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
 *                   example: "Post removido de favoritos"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Post no encontrado en favoritos
 */
// ✅ CORREGIDO: Agregado middleware authenticate
router.delete('/:postId', authenticate, removeFromFavorites);

/**
 * @swagger
 * /api/favorites/likes:
 *   get:
 *     summary: Obtener posts con like del usuario
 *     tags: [Favorites]
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
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, postCreatedAt]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Lista de posts con like
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
 *                     likes:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Like'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// ✅ CORREGIDO: Agregado middleware authenticate
router.get('/likes', authenticate, validatePagination, getUserLikes);

/**
 * @swagger
 * /api/favorites/likes/{postId}:
 *   post:
 *     summary: Dar like a un post
 *     tags: [Favorites]
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
 *       201:
 *         description: Like agregado exitosamente
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
 *                     like:
 *                       $ref: '#/components/schemas/Like'
 *                     totalLikes:
 *                       type: integer
 *                       example: 26
 *       400:
 *         description: Ya has dado like a este post o no puedes dar like a tu propio post
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Post no encontrado
 *       409:
 *         description: Ya has dado like a este post
 */
// ✅ CORREGIDO: Agregado middleware authenticate
router.post('/likes/:postId', authenticate, addLike);

/**
 * @swagger
 * /api/favorites/likes/{postId}:
 *   delete:
 *     summary: Quitar like de un post
 *     tags: [Favorites]
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
 *         description: Like removido exitosamente
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
 *                   example: "Like removido"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalLikes:
 *                       type: integer
 *                       example: 24
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Like no encontrado
 */
// ✅ CORREGIDO: Agregado middleware authenticate
router.delete('/likes/:postId', authenticate, removeLike);

/**
 * @swagger
 * /api/favorites/stats:
 *   get:
 *     summary: Obtener estadísticas de favoritos y likes del usuario
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas de favoritos y likes
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
 *                     totalFavorites:
 *                       type: integer
 *                       example: 15
 *                     totalLikes:
 *                       type: integer
 *                       example: 48
 *                     favoritesThisWeek:
 *                       type: integer
 *                       example: 3
 *                     likesThisWeek:
 *                       type: integer
 *                       example: 12
 *                     topCategories:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           userType:
 *                             type: string
 *                             example: "ESCORT"
 *                           count:
 *                             type: integer
 *                             example: 10
 *                     recentActivity:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [favorite, like]
 *                           postId:
 *                             type: string
 *                           postTitle:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// ✅ CORREGIDO: Agregado middleware authenticate
router.get('/stats', authenticate, getFavoritesStats);

module.exports = router;