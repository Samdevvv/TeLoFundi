// src/api/admin/admin.routes.js
const express = require('express');
const adminController = require('./admin.controller');
const { authMiddleware } = require('../../middleware/auth');
const { adminOnly } = require('../../middleware/role');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: API para panel de administración
 */

/**
 * Middleware para todas las rutas de administración
 */
router.use(authMiddleware, adminOnly);

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Obtiene estadísticas generales del sistema
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas con éxito
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
router.get('/stats', adminController.getSystemStats);

/**
 * @swagger
 * /api/admin/metrics:
 *   get:
 *     summary: Obtiene métricas detalladas del sistema
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de inicio (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de fin (YYYY-MM-DD)
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: daily
 *         description: Agrupación de datos
 *     responses:
 *       200:
 *         description: Métricas obtenidas con éxito
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
router.get('/metrics', adminController.getDetailedMetrics);

/**
 * @swagger
 * /api/admin/agency-requests:
 *   get:
 *     summary: Obtiene solicitudes de agencia pendientes
 *     tags: [Admin]
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
 *           default: 10
 *         description: Límite de resultados por página
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pendiente, aprobada, rechazada]
 *           default: pendiente
 *         description: Estado de las solicitudes
 *     responses:
 *       200:
 *         description: Solicitudes obtenidas con éxito
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
router.get('/agency-requests', adminController.getPendingAgencyRequests);

/**
 * @swagger
 * /api/admin/agency-requests/{requestId}:
 *   post:
 *     summary: Procesa una solicitud de agencia
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la solicitud
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
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Solicitud procesada con éxito
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
router.post('/agency-requests/:requestId', adminController.processAgencyRequest);

/**
 * @swagger
 * /api/admin/users/{type}:
 *   get:
 *     summary: Obtiene usuarios por tipo
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [cliente, perfil, agencia, admin]
 *         description: Tipo de usuario
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
 *         name: query
 *         schema:
 *           type: string
 *         description: Texto de búsqueda
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Estado del usuario
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de inicio (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de fin (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Usuarios obtenidos con éxito
 *       400:
 *         description: Tipo de usuario inválido
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
router.get('/users/:type', adminController.getUsers);

/**
 * @swagger
 * /api/admin/users/{userId}/status:
 *   put:
 *     summary: Activa o desactiva un usuario
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - active
 *             properties:
 *               active:
 *                 type: boolean
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Estado de usuario actualizado con éxito
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
router.put('/users/:userId/status', adminController.toggleUserStatus);

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   delete:
 *     summary: Elimina un usuario
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
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
 *     responses:
 *       200:
 *         description: Usuario eliminado con éxito
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
router.delete('/users/:userId', adminController.deleteUser);

/**
 * @swagger
 * /api/admin/profiles/{profileId}/verify:
 *   post:
 *     summary: Verifica un perfil manualmente
 *     tags: [Admin]
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
 *               notes:
 *                 type: string
 *               method:
 *                 type: string
 *                 enum: [admin_verification, document, video_call]
 *                 default: admin_verification
 *     responses:
 *       200:
 *         description: Perfil verificado con éxito
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
router.post('/profiles/:profileId/verify', adminController.verifyProfile);

module.exports = router;