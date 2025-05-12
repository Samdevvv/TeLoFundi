// src/api/agency/agency.routes.js
const express = require('express');
const agencyController = require('./agency.controller');
const { authMiddleware, optionalAuthMiddleware } = require('../../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Agencies
 *   description: API para gestión de agencias
 */

/**
 * @swagger
 * /api/agencies/{id}:
 *   get:
 *     summary: Obtiene información de una agencia por su ID
 *     tags: [Agencies]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la agencia
 *       - in: query
 *         name: includeProfiles
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Incluir perfiles de la agencia
 *     responses:
 *       200:
 *         description: Información de la agencia obtenida con éxito
 *       404:
 *         description: Agencia no encontrada
 *       500:
 *         description: Error del servidor
 */
router.get('/:id', optionalAuthMiddleware, agencyController.getAgencyById);

/**
 * @swagger
 * /api/agencies/slug/{slug}:
 *   get:
 *     summary: Obtiene información de una agencia por su slug
 *     tags: [Agencies]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Slug de la agencia
 *       - in: query
 *         name: includeProfiles
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Incluir perfiles de la agencia
 *     responses:
 *       200:
 *         description: Información de la agencia obtenida con éxito
 *       404:
 *         description: Agencia no encontrada
 *       500:
 *         description: Error del servidor
 */
router.get('/slug/:slug', optionalAuthMiddleware, agencyController.getAgencyBySlug);

/**
 * @swagger
 * /api/agencies:
 *   put:
 *     summary: Actualiza una agencia
 *     tags: [Agencies]
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
 *         description: Agencia actualizada con éxito
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 *       500:
 *         description: Error del servidor
 */
router.put('/', authMiddleware, agencyController.updateAgency);

/**
 * @swagger
 * /api/agencies/{agencyId}/profiles:
 *   get:
 *     summary: Obtiene los perfiles de una agencia
 *     tags: [Agencies]
 *     parameters:
 *       - in: path
 *         name: agencyId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la agencia
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
 *         name: services
 *         schema:
 *           type: string
 *         description: Servicios separados por coma
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
 *         name: orderBy
 *         schema:
 *           type: string
 *           enum: [featured, recent, price_asc, price_desc]
 *           default: featured
 *         description: Ordenamiento
 *     responses:
 *       200:
 *         description: Perfiles obtenidos con éxito
 *       500:
 *         description: Error del servidor
 */
router.get('/:agencyId/profiles', optionalAuthMiddleware, agencyController.getAgencyProfiles);

/**
 * @swagger
 * /api/agencies/profile/{profileId}/verify:
 *   post:
 *     summary: Verifica un perfil
 *     tags: [Agencies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del perfil
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - approved
 *             properties:
 *               approved:
 *                 type: boolean
 *               method:
 *                 type: string
 *                 enum: [in_person, video_call, document]
 *               location:
 *                 type: string
 *               notes:
 *                 type: string
 *               documentUrls:
 *                 type: array
 *                 items:
 *                   type: string
 *               photoUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Perfil verificado con éxito
 *       400:
 *         description: Error de solicitud
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 *       500:
 *         description: Error del servidor
 */
router.post('/profile/:profileId/verify', authMiddleware, agencyController.verifyProfile);

/**
 * @swagger
 * /api/agencies/profile/add:
 *   post:
 *     summary: Añade un perfil a una agencia
 *     tags: [Agencies]
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
 *             properties:
 *               profileId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Solicitud enviada con éxito
 *       400:
 *         description: Error de solicitud
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 *       500:
 *         description: Error del servidor
 */
router.post('/profile/add', authMiddleware, agencyController.addProfileToAgency);

/**
 * @swagger
 * /api/agencies/request/respond:
 *   post:
 *     summary: Responde a una solicitud de cambio de agencia
 *     tags: [Agencies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requestId
 *               - accept
 *             properties:
 *               requestId:
 *                 type: string
 *               accept:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Respuesta procesada con éxito
 *       400:
 *         description: Error de solicitud
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 *       500:
 *         description: Error del servidor
 */
router.post('/request/respond', authMiddleware, agencyController.respondToAgencyRequest);

/**
 * @swagger
 * /api/agencies/profile/{profileId}/remove:
 *   post:
 *     summary: Elimina un perfil de una agencia
 *     tags: [Agencies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del perfil
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Perfil removido con éxito
 *       400:
 *         description: Error de solicitud
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 *       500:
 *         description: Error del servidor
 */
router.post('/profile/:profileId/remove', authMiddleware, agencyController.removeProfileFromAgency);

/**
 * @swagger
 * /api/agencies/pending-requests:
 *   get:
 *     summary: Obtiene las solicitudes de cambio de agencia pendientes
 *     tags: [Agencies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Solicitudes obtenidas con éxito
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 *       500:
 *         description: Error del servidor
 */
router.get('/pending-requests', authMiddleware, agencyController.getPendingAgencyChanges);

module.exports = router;