// src/api/user/user.routes.js
const express = require('express');
const userController = require('./user.controller');
const { authMiddleware } = require('../../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: API para gestión de usuarios
 */

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Obtiene el perfil del usuario autenticado
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil de usuario obtenido con éxito
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.get('/me', authMiddleware, userController.getMyProfile);

/**
 * @swagger
 * /api/users/me:
 *   put:
 *     summary: Actualiza el perfil del usuario autenticado
 *     tags: [Users]
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
 *       500:
 *         description: Error del servidor
 */
router.put('/me', authMiddleware, userController.updateMyProfile);

/**
 * @swagger
 * /api/users/change-password:
 *   post:
 *     summary: Cambia la contraseña del usuario autenticado
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
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contraseña actualizada con éxito
 *       400:
 *         description: Contraseña actual incorrecta
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.post('/change-password', authMiddleware, userController.changePassword);

/**
 * @swagger
 * /api/users/profile-image:
 *   put:
 *     summary: Actualiza la imagen de perfil del usuario
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
 *               - imageUrl
 *             properties:
 *               imageUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Imagen actualizada con éxito
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.put('/profile-image', authMiddleware, userController.updateProfileImage);

/**
 * @swagger
 * /api/users/preferences:
 *   put:
 *     summary: Actualiza las preferencias del usuario
 *     tags: [Users]
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
 *         description: Preferencias actualizadas con éxito
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.put('/preferences', authMiddleware, userController.updatePreferences);

/**
 * @swagger
 * /api/users/deactivate:
 *   post:
 *     summary: Desactiva la cuenta del usuario autenticado
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cuenta desactivada con éxito
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.post('/deactivate', authMiddleware, userController.deactivateAccount);

module.exports = router;