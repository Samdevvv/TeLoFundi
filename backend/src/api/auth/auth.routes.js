// src/api/auth/auth.routes.js
const express = require('express');
const authController = require('./auth.controller');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: API para autenticación de usuarios
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registra un nuevo cliente
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - username
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               username:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuario registrado con éxito
 *       400:
 *         description: Datos de entrada inválidos
 *       409:
 *         description: El correo ya está registrado
 *       500:
 *         description: Error del servidor
 */
router.post('/register', authController.register);

/**
 * @swagger
 * /api/auth/profile/register:
 *   post:
 *     summary: Registra un nuevo perfil (acompañante)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - username
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               username:
 *                 type: string
 *               gender:
 *                 type: string
 *                 enum: [femenino, masculino, transgenero, otro]
 *     responses:
 *       201:
 *         description: Perfil registrado con éxito
 *       400:
 *         description: Datos de entrada inválidos
 *       409:
 *         description: El correo ya está registrado
 *       500:
 *         description: Error del servidor
 */
router.post('/profile/register', authController.registerProfile);

/**
 * @swagger
 * /api/auth/agency/register:
 *   post:
 *     summary: Registra una nueva agencia
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Solicitud de registro de agencia enviada
 *       400:
 *         description: Datos de entrada inválidos
 *       409:
 *         description: El correo ya está registrado
 *       500:
 *         description: Error del servidor
 */
router.post('/agency/register', authController.registerAgency);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Inicia sesión de un usuario
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               rememberMe:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Inicio de sesión exitoso
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: Credenciales incorrectas
 *       500:
 *         description: Error del servidor
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/auth/google:
 *   post:
 *     summary: Inicia sesión o registra con Google
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tokenId
 *             properties:
 *               tokenId:
 *                 type: string
 *               userType:
 *                 type: string
 *                 enum: [cliente, perfil, agencia]
 *                 default: cliente
 *               userData:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   email:
 *                     type: string
 *                   name:
 *                     type: string
 *                   picture:
 *                     type: string
 *     responses:
 *       200:
 *         description: Autenticación con Google exitosa
 *       400:
 *         description: Datos inválidos
 *       500:
 *         description: Error del servidor
 */
router.post('/google', authController.googleLogin);

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Refresca el token de acceso
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refrescado exitosamente
 *       400:
 *         description: Token no proporcionado
 *       401:
 *         description: Token inválido o expirado
 *       500:
 *         description: Error del servidor
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Cierra la sesión de un usuario
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionToken
 *             properties:
 *               sessionToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sesión cerrada exitosamente
 *       400:
 *         description: Token no proporcionado
 *       500:
 *         description: Error del servidor
 */
router.post('/logout', authController.logout);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Solicita un restablecimiento de contraseña
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Solicitud procesada
 *       400:
 *         description: Email no proporcionado
 *       500:
 *         description: Error del servidor
 */
router.post('/forgot-password', authController.requestPasswordReset);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Restablece la contraseña con un token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Contraseña restablecida con éxito
 *       400:
 *         description: Token inválido o expirado
 *       500:
 *         description: Error del servidor
 */
router.post('/reset-password', authController.resetPassword);

/**
 * @swagger
 * /api/auth/verify-email/{token}:
 *   get:
 *     summary: Verifica el correo electrónico
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Correo verificado con éxito
 *       400:
 *         description: Token inválido o expirado
 *       500:
 *         description: Error del servidor
 */
router.get('/verify-email/:token', authController.verifyEmail);

module.exports = router;