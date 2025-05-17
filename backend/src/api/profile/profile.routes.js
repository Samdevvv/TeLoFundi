// src/api/profile/profile.routes.js
const express = require('express');
const profileController = require('./profile.controller');
const { authMiddleware, optionalAuthMiddleware } = require('../../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Profiles
 *   description: API para gestión de perfiles
 */

// Ruta de prueba para verificar que el router funciona
router.get('/test', (req, res) => {
  res.json({
    message: 'Router de perfiles funcionando correctamente',
    methods: Object.keys(profileController)
  });
});

/**
 * @swagger
 * /api/profiles:
 *   get:
 *     summary: Busca perfiles con opciones de filtrado y paginación
 *     tags: [Profiles]
 *     parameters:
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
 *         description: Límite de resultados por página
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filtro por ubicación
 *       - in: query
 *         name: service
 *         schema:
 *           type: string
 *         description: Filtro por servicio
 *       - in: query
 *         name: verified
 *         schema:
 *           type: boolean
 *         description: Filtro por verificación
 *       - in: query
 *         name: priceMin
 *         schema:
 *           type: number
 *         description: Precio mínimo
 *       - in: query
 *         name: priceMax
 *         schema:
 *           type: number
 *         description: Precio máximo
 *       - in: query
 *         name: gender
 *         schema:
 *           type: string
 *         description: Filtro por género
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Búsqueda general
 *     responses:
 *       200:
 *         description: Lista de perfiles encontrados
 *       500:
 *         description: Error del servidor
 */
router.get('/', optionalAuthMiddleware, profileController.searchProfiles);

/**
 * @swagger
 * /api/profiles/slug/{slug}:
 *   get:
 *     summary: Obtiene información de un perfil por su slug
 *     tags: [Profiles]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Slug del perfil
 *     responses:
 *       200:
 *         description: Información del perfil obtenida con éxito
 *       404:
 *         description: Perfil no encontrado
 *       500:
 *         description: Error del servidor
 */
router.get('/slug/:slug', optionalAuthMiddleware, profileController.getProfileBySlug);

/**
 * @swagger
 * /api/profiles/favorites:
 *   get:
 *     summary: Obtiene los perfiles favoritos del cliente
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Límite de resultados por página
 *     responses:
 *       200:
 *         description: Favoritos obtenidos con éxito
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 *       500:
 *         description: Error del servidor
 */
router.get('/favorites', authMiddleware, profileController.getFavorites);

/**
 * @swagger
 * /api/profiles/{id}:
 *   get:
 *     summary: Obtiene información de un perfil por su ID
 *     tags: [Profiles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del perfil
 *     responses:
 *       200:
 *         description: Información del perfil obtenida con éxito
 *       404:
 *         description: Perfil no encontrado
 *       500:
 *         description: Error del servidor
 */
router.get('/:id', optionalAuthMiddleware, profileController.getProfileById);

/**
 * @swagger
 * /api/profiles:
 *   put:
 *     summary: Actualiza un perfil
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Perfil actualizado con éxito
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 *       500:
 *         description: Error del servidor
 */
router.put('/', authMiddleware, profileController.updateProfile);

/**
 * @swagger
 * /api/profiles/contact:
 *   post:
 *     summary: Registra un contacto con un perfil
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - profileId
 *               - contactMethod
 *               - contactData
 *             properties:
 *               profileId:
 *                 type: string
 *               contactMethod:
 *                 type: string
 *                 enum: [telefono, whatsapp, chat_interno, email]
 *               contactData:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contacto registrado con éxito
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 *       500:
 *         description: Error del servidor
 */
router.post('/contact', authMiddleware, profileController.contactProfile);

/**
 * @swagger
 * /api/profiles/view:
 *   post:
 *     summary: Registra una vista a un perfil
 *     tags: [Profiles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - profileId
 *             properties:
 *               profileId:
 *                 type: string
 *               sessionId:
 *                 type: string
 *               deviceType:
 *                 type: string
 *               duration:
 *                 type: integer
 *               location:
 *                 type: object
 *               searchQuery:
 *                 type: string
 *     responses:
 *       200:
 *         description: Vista registrada con éxito
 */
router.post('/view', optionalAuthMiddleware, profileController.viewProfile);

/**
 * @swagger
 * /api/profiles/favorite:
 *   post:
 *     summary: Agrega o elimina un perfil de favoritos
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - profileId
 *               - action
 *             properties:
 *               profileId:
 *                 type: string
 *               action:
 *                 type: string
 *                 enum: [add, remove]
 *     responses:
 *       200:
 *         description: Operación exitosa
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 *       500:
 *         description: Error del servidor
 */
router.post('/favorite', authMiddleware, profileController.toggleFavorite);

/**
 * @swagger
 * /api/profiles/image:
 *   post:
 *     summary: Gestiona las imágenes de un perfil
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - imageUrl
 *             properties:
 *               id:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *               thumbnailUrl:
 *                 type: string
 *               mediumUrl:
 *                 type: string
 *               isMain:
 *                 type: boolean
 *               description:
 *                 type: string
 *               orderPosition:
 *                 type: integer
 *               isPrivate:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Imagen gestionada con éxito
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 *       500:
 *         description: Error del servidor
 */
router.post('/image', authMiddleware, profileController.manageProfileImage);

/**
 * @swagger
 * /api/profiles/image/{imageId}:
 *   delete:
 *     summary: Elimina una imagen de un perfil
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la imagen
 *     responses:
 *       200:
 *         description: Imagen eliminada con éxito
 *       400:
 *         description: Error de solicitud
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 *       500:
 *         description: Error del servidor
 */
router.delete('/image/:imageId', authMiddleware, profileController.deleteProfileImage);

/**
 * @swagger
 * /api/profiles/agency:
 *   post:
 *     summary: Cambia la agencia de un perfil o lo hace independiente
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               agencyId:
 *                 type: string
 *                 description: ID de la agencia (null para independiente)
 *     responses:
 *       200:
 *         description: Cambio de agencia exitoso
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 *       500:
 *         description: Error del servidor
 */
router.post('/agency', authMiddleware, profileController.changeAgency);

module.exports = router;