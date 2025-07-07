const express = require('express');
const router = express.Router();

// Middleware
// const { authLimiter, registerLimiter, passwordResetLimiter } = require('../middleware/rateLimiter'); // ← COMENTADO PARA DESARROLLO
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validateRegistration, validateLogin, validatePasswordReset } = require('../middleware/validation');

// ✅ CORREGIDO: Importar middleware de upload correcto
const { handleAgencyUpload, handleMulterError } = require('../middleware/upload');

// Controllers (los crearemos después)
const {
  register,
  registerAgency, // ✅ FUNCIÓN ESPECÍFICA PARA AGENCIAS
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  changePassword,
  getUserProfile,
  googleAuth,
  googleCallback,
  testEmail
} = require('../controllers/authController');

/**
 * @swagger
 * components:
 *   schemas:
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - email
 *         - username
 *         - firstName
 *         - lastName
 *         - password
 *         - userType
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "usuario@ejemplo.com"
 *         username:
 *           type: string
 *           minLength: 3
 *           maxLength: 30
 *           example: "usuario123"
 *         firstName:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *           example: "Juan"
 *         lastName:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *           example: "Pérez"
 *         password:
 *           type: string
 *           minLength: 8
 *           example: "MiPassword123!"
 *         userType:
 *           type: string
 *           enum: [ESCORT, AGENCY, CLIENT]
 *           example: "CLIENT"
 *         phone:
 *           type: string
 *           nullable: true
 *           example: "+1234567890"
 *         bio:
 *           type: string
 *           nullable: true
 *           example: "Descripción del usuario"
 *         website:
 *           type: string
 *           nullable: true
 *           example: "https://miagencia.com"
 *         locationId:
 *           type: string
 *           nullable: true
 *           example: "cm123location456"
 *     
 *     AgencyRegisterRequest:
 *       type: object
 *       required:
 *         - email
 *         - username
 *         - firstName
 *         - lastName
 *         - password
 *         - companyName
 *         - businessLicense
 *         - contactPerson
 *         - address
 *         - cedulaFrente
 *         - cedulaTrasera
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "agencia@ejemplo.com"
 *         username:
 *           type: string
 *           minLength: 3
 *           maxLength: 30
 *           example: "agencia_vip"
 *         firstName:
 *           type: string
 *           example: "Juan"
 *         lastName:
 *           type: string
 *           example: "Pérez"
 *         password:
 *           type: string
 *           minLength: 8
 *           example: "MiPassword123!"
 *         companyName:
 *           type: string
 *           example: "Agencia VIP Services"
 *         businessLicense:
 *           type: string
 *           example: "RNC-123456789"
 *         contactPerson:
 *           type: string
 *           example: "Juan Pérez"
 *         address:
 *           type: string
 *           example: "Calle Principal #123, Santiago"
 *         phone:
 *           type: string
 *           nullable: true
 *           example: "+1809-555-0123"
 *         bio:
 *           type: string
 *           nullable: true
 *           example: "Agencia líder en servicios de acompañamiento"
 *         website:
 *           type: string
 *           nullable: true
 *           example: "https://agenciavip.com"
 *         locationId:
 *           type: string
 *           nullable: true
 *           example: "cm123location456"
 *         cedulaFrente:
 *           type: string
 *           format: binary
 *           description: "Foto de la cédula (frente)"
 *         cedulaTrasera:
 *           type: string
 *           format: binary
 *           description: "Foto de la cédula (trasera)"
 *     
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "usuario@ejemplo.com"
 *         password:
 *           type: string
 *           example: "MiPassword123!"
 *         rememberMe:
 *           type: boolean
 *           example: false
 *     
 *     AuthResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Autenticación exitosa"
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               $ref: '#/components/schemas/User'
 *             token:
 *               type: string
 *               example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *             refreshToken:
 *               type: string
 *               example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *             expiresIn:
 *               type: string
 *               example: "7d"
 *             verificationRequired:
 *               type: boolean
 *               example: true
 *               description: "Solo para agencias"
 *             verificationStatus:
 *               type: string
 *               enum: [PENDING, APPROVED, REJECTED]
 *               example: "PENDING"
 *               description: "Solo para agencias"
 *     
 *     AgencyPendingResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Solicitud de agencia recibida. Te notificaremos cuando sea aprobada."
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 username:
 *                   type: string
 *                 firstName:
 *                   type: string
 *                 lastName:
 *                   type: string
 *                 userType:
 *                   type: string
 *                   example: "AGENCY"
 *                 accountStatus:
 *                   type: string
 *                   example: "PENDING_APPROVAL"
 *                 canLogin:
 *                   type: boolean
 *                   example: false
 *             applicationStatus:
 *               type: string
 *               example: "PENDING_APPROVAL"
 *             estimatedReviewTime:
 *               type: string
 *               example: "24-48 horas"
 *             nextSteps:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["Nuestro equipo revisará tu documentación", "Te notificaremos por email"]
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrar nuevo usuario (Cliente, Escort)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         description: Email o username ya existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Demasiados intentos de registro
 */
router.post('/register', /* registerLimiter, */ validateRegistration, register);

/**
 * @swagger
 * /api/auth/register/agency:
 *   post:
 *     summary: Registrar nueva agencia (con documentos de cédula) - REQUIERE APROBACIÓN MANUAL
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/AgencyRegisterRequest'
 *     responses:
 *       201:
 *         description: Agencia registrada, pendiente de verificación (NO incluye tokens de acceso)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AgencyPendingResponse'
 *       400:
 *         description: Error de validación o fotos de cédula faltantes
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
 *                   example: "Fotos de cédula (frente y trasera) son obligatorias"
 *                 errorCode:
 *                   type: string
 *                   example: "CEDULA_PHOTOS_REQUIRED"
 *       409:
 *         description: Email o username ya existe
 *       500:
 *         description: Error subiendo documentos a Cloudinary
 */
// ✅ RUTA CORREGIDA: Registro específico para agencias con upload de cédula
router.post('/register/agency', 
  // ✅ MIDDLEWARE DE UPLOAD PARA FOTOS DE CÉDULA
  handleAgencyUpload, // Este middleware maneja múltiples archivos y Cloudinary
  // ✅ VALIDACIÓN ESPECÍFICA
  validateRegistration,
  // ✅ CONTROLADOR ESPECÍFICO
  registerAgency,
  // ✅ MANEJO DE ERRORES DE MULTER
  handleMulterError
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/AuthResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         verificationStatus:
 *                           type: string
 *                           description: "Estado de verificación para agencias"
 *                           example: "PENDING"
 *                         accountStatus:
 *                           type: string
 *                           description: "Estado de la cuenta"
 *                           example: "ACTIVE"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Credenciales inválidas
 *       403:
 *         description: Cuenta suspendida, agencia pendiente o rechazada
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
 *                   example: "Tu solicitud está siendo revisada. Te notificaremos cuando sea aprobada."
 *                 errorCode:
 *                   type: string
 *                   example: "AGENCY_PENDING_APPROVAL"
 *       429:
 *         description: Demasiados intentos de login
 */
router.post('/login', /* authLimiter, */ validateLogin, login);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Cerrar sesión
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout exitoso
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
 *                   example: "Sesión cerrada exitosamente"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/logout', authenticate, logout);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Renovar token de acceso
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
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Token renovado exitosamente
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
 *                     token:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     expiresIn:
 *                       type: string
 *       401:
 *         description: Refresh token inválido o expirado
 */
router.post('/refresh', refreshToken);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Solicitar restablecimiento de contraseña
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
 *                 example: "usuario@ejemplo.com"
 *     responses:
 *       200:
 *         description: Email de restablecimiento enviado
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
 *                   example: "Email de restablecimiento enviado"
 *       429:
 *         description: Demasiados intentos de restablecimiento
 */
router.post('/forgot-password', /* passwordResetLimiter, */ validatePasswordReset, forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Restablecer contraseña
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
 *                 example: "reset-token-here"
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: "NuevaPassword123!"
 *     responses:
 *       200:
 *         description: Contraseña restablecida exitosamente
 *       400:
 *         description: Token inválido o expirado
 */
router.post('/reset-password', resetPassword);

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     summary: Verificar email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 example: "verification-token-here"
 *     responses:
 *       200:
 *         description: Email verificado exitosamente
 *       400:
 *         description: Token de verificación inválido
 */
router.post('/verify-email', verifyEmail);

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     summary: Reenviar email de verificación
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Email de verificación reenviado
 *       400:
 *         description: Email ya verificado
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/resend-verification', authenticate, resendVerification);

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     summary: Cambiar contraseña
 *     tags: [Auth]
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
 *                 example: "PasswordActual123!"
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 example: "NuevaPassword123!"
 *     responses:
 *       200:
 *         description: Contraseña cambiada exitosamente
 *       400:
 *         description: Contraseña actual incorrecta
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/change-password', authenticate, changePassword);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Obtener perfil del usuario autenticado
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/profile', authenticate, getUserProfile);

/**
 * @swagger
 * /api/auth/google:
 *   get:
 *     summary: Iniciar autenticación con Google
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: userType
 *         schema:
 *           type: string
 *           enum: [CLIENT, ESCORT, AGENCY]
 *         description: Tipo de usuario para registro
 *         example: CLIENT
 *     responses:
 *       302:
 *         description: Redirección a Google OAuth
 */
router.get('/google', googleAuth);

/**
 * @swagger
 * /api/auth/google/callback:
 *   get:
 *     summary: Callback de Google OAuth
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Código de autorización de Google
 *     responses:
 *       302:
 *         description: Redirección al frontend con token
 *       400:
 *         description: Error en autenticación con Google
 */
router.get('/google/callback', googleCallback);

/**
 * @swagger
 * /api/auth/test-email:
 *   post:
 *     summary: Probar envío de emails (Solo desarrollo)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - type
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "prueba@ejemplo.com"
 *               type:
 *                 type: string
 *                 enum: [reset, welcome, verification, agency_pending]
 *                 example: "reset"
 *     responses:
 *       200:
 *         description: Email de prueba enviado exitosamente
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
 *                   example: "Email de restablecimiento de contraseña enviado exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     emailType:
 *                       type: string
 *                       example: "restablecimiento de contraseña"
 *                     recipient:
 *                       type: string
 *                       example: "prueba@ejemplo.com"
 *                     timestamp:
 *                       type: string
 *                       example: "2025-01-19T10:30:00.000Z"
 *       400:
 *         description: Datos de entrada inválidos
 *       403:
 *         description: Endpoint no disponible en producción
 *       500:
 *         description: Error enviando email
 */

// ✅ RUTA DE PRUEBA PARA EMAILS (SOLO DESARROLLO)
if (process.env.NODE_ENV === 'development') {
  router.post('/test-email', testEmail);
}

module.exports = router;