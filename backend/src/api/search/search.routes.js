// src/api/search/search.routes.js
const express = require('express');
const searchController = require('./search.controller');
const { optionalAuthMiddleware } = require('../../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Search
 *   description: API para búsqueda y filtrado
 */

/**
 * @swagger
 * /api/search/profiles:
 *   get:
 *     summary: Busca perfiles según criterios
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Texto de búsqueda
 *       - in: query
 *         name: gender
 *         schema:
 *           type: string
 *           enum: [femenino, masculino, transgenero, otro]
 *         description: Filtrar por género
 *       - in: query
 *         name: minAge
 *         schema:
 *           type: integer
 *         description: Edad mínima
 *       - in: query
 *         name: maxAge
 *         schema:
 *           type: integer
 *         description: Edad máxima
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Ciudad
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *         description: País
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Precio mínimo por hora
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Precio máximo por hora
 *       - in: query
 *         name: verificationStatus
 *         schema:
 *           type: string
 *           enum: [no_verificado, pendiente, verificado, rechazado, expirado]
 *         description: Estado de verificación
 *       - in: query
 *         name: availabilityStatus
 *         schema:
 *           type: string
 *           enum: [disponible, ocupado, no_disponible, vacaciones]
 *         description: Estado de disponibilidad
 *       - in: query
 *         name: languages
 *         schema:
 *           type: string
 *         description: Idiomas separados por coma
 *       - in: query
 *         name: services
 *         schema:
 *           type: string
 *         description: Servicios separados por coma
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: IDs de tags separados por coma
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: ID de categoría
 *       - in: query
 *         name: agencyId
 *         schema:
 *           type: string
 *         description: ID de agencia
 *       - in: query
 *         name: independent
 *         schema:
 *           type: boolean
 *         description: Sólo perfiles independientes
 *       - in: query
 *         name: travelAvailability
 *         schema:
 *           type: boolean
 *         description: Disponibilidad para viajar
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
 *         description: Resultados por página
 *       - in: query
 *         name: orderBy
 *         schema:
 *           type: string
 *           enum: [relevance, recent, price_low, price_high]
 *           default: relevance
 *         description: Ordenamiento
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *         description: ID de sesión para análisis
 *     responses:
 *       200:
 *         description: Resultados de búsqueda
 *       500:
 *         description: Error del servidor
 */
router.get('/profiles', optionalAuthMiddleware, searchController.searchProfiles);

/**
 * @swagger
 * /api/search/profile-click:
 *   post:
 *     summary: Registra un clic en un perfil desde los resultados
 *     tags: [Search]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - searchId
 *               - profileId
 *             properties:
 *               searchId:
 *                 type: string
 *               profileId:
 *                 type: string
 *               sessionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Clic registrado con éxito
 */
router.post('/profile-click', optionalAuthMiddleware, searchController.registerProfileClick);

/**
 * @swagger
 * /api/search/agencies:
 *   get:
 *     summary: Busca agencias según criterios
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Texto de búsqueda
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Ciudad
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *         description: País
 *       - in: query
 *         name: verificationStatus
 *         schema:
 *           type: string
 *           enum: [no_verificado, pendiente, verificado, rechazado, expirado]
 *         description: Estado de verificación
 *       - in: query
 *         name: minProfiles
 *         schema:
 *           type: integer
 *         description: Número mínimo de perfiles
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
 *         description: Resultados por página
 *     responses:
 *       200:
 *         description: Resultados de búsqueda
 *       500:
 *         description: Error del servidor
 */
router.get('/agencies', searchController.searchAgencies);

/**
 * @swagger
 * /api/search/categories:
 *   get:
 *     summary: Obtiene las categorías disponibles
 *     tags: [Search]
 *     responses:
 *       200:
 *         description: Categorías obtenidas con éxito
 *       500:
 *         description: Error del servidor
 */
router.get('/categories', searchController.getCategories);

/**
 * @swagger
 * /api/search/popular-tags:
 *   get:
 *     summary: Obtiene los tags populares
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Límite de tags a retornar
 *     responses:
 *       200:
 *         description: Tags obtenidos con éxito
 *       500:
 *         description: Error del servidor
 */
router.get('/popular-tags', searchController.getPopularTags);

module.exports = router;