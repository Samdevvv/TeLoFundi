// src/api/notification/notification.routes.js
const express = require('express');
const notificationController = require('./notification.controller');
const { authMiddleware } = require('../../middleware/auth');
const { adminOnly } = require('../../middleware/role');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: API para gestión de notificaciones
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Obtiene las notificaciones del usuario
 *     tags: [Notifications]
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
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Solo notificaciones no leídas
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filtrar por tipo de notificación
 *     responses:
 *       200:
 *         description: Notificaciones obtenidas con éxito
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.get('/', authMiddleware, notificationController.getUserNotifications);

/**
 * @swagger
 * /api/notifications/{notificationId}/read:
 *   post:
 *     summary: Marca una notificación como leída
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la notificación
 *     responses:
 *       200:
 *         description: Notificación marcada como leída
 *       400:
 *         description: ID de notificación requerido
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Notificación no encontrada
 *       500:
 *         description: Error del servidor
 */
router.post('/:notificationId/read', authMiddleware, notificationController.markAsRead);

/**
 * @swagger
 * /api/notifications/read-all:
 *   post:
 *     summary: Marca todas las notificaciones como leídas
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notificaciones marcadas como leídas
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.post('/read-all', authMiddleware, notificationController.markAllAsRead);

/**
 * @swagger
 * /api/notifications/{notificationId}:
 *   delete:
 *     summary: Elimina una notificación
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la notificación
 *     responses:
 *       200:
 *         description: Notificación eliminada con éxito
 *       400:
 *         description: ID de notificación requerido
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Notificación no encontrada
 *       500:
 *         description: Error del servidor
 */
router.delete('/:notificationId', authMiddleware, notificationController.deleteNotification);

/**
 * @swagger
 * /api/notifications/device:
 *   post:
 *     summary: Registra un dispositivo para notificaciones push
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceToken
 *               - deviceType
 *             properties:
 *               deviceToken:
 *                 type: string
 *               deviceType:
 *                 type: string
 *                 enum: [desktop, mobile, tablet, app_android, app_ios]
 *               deviceName:
 *                 type: string
 *               deviceModel:
 *                 type: string
 *               osVersion:
 *                 type: string
 *               appVersion:
 *                 type: string
 *     responses:
 *       200:
 *         description: Dispositivo registrado con éxito
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.post('/device', authMiddleware, notificationController.registerDevice);

/**
 * @swagger
 * /api/notifications/email-preferences:
 *   put:
 *     summary: Actualiza las preferencias de correo
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newsletters:
 *                 type: boolean
 *               promotions:
 *                 type: boolean
 *               systemNotifications:
 *                 type: boolean
 *               chatNotifications:
 *                 type: boolean
 *               contactNotifications:
 *                 type: boolean
 *               paymentNotifications:
 *                 type: boolean
 *               verificationNotifications:
 *                 type: boolean
 *               unsubscribeAll:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Preferencias actualizadas con éxito
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.put('/email-preferences', authMiddleware, notificationController.updateEmailPreferences);

/**
 * @swagger
 * /api/notifications/send:
 *   post:
 *     summary: Envía una notificación (solo admin)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - type
 *               - title
 *               - content
 *             properties:
 *               userId:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [mensaje_nuevo, contacto_nuevo, puntos_ganados, verificacion_completada, cupon_expirando, sorteo_ganado, servicio_expirando, perfil_actualizado, pago_completado, pago_fallido, sistema, recordatorio]
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               sendEmail:
 *                 type: boolean
 *                 default: false
 *               sendPush:
 *                 type: boolean
 *                 default: false
 *               sendSms:
 *                 type: boolean
 *                 default: false
 *               deepLink:
 *                 type: string
 *               referenceId:
 *                 type: string
 *               referenceType:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *               importance:
 *                 type: string
 *                 enum: [low, normal, high]
 *                 default: normal
 *     responses:
 *       200:
 *         description: Notificación enviada con éxito
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
router.post('/send', authMiddleware, adminOnly, notificationController.sendNotification);

module.exports = router;