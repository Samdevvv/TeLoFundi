const express = require('express');
const router = express.Router();

// ✅ MIDDLEWARE INTEGRADO: Todo desde auth.js
const { authenticate, requireAdmin, logAdminActivity } = require('../middleware/auth');

// ✅ Controllers - TODOS COINCIDEN CON EL CONTROLADOR (AGREGADAS LAS 3 FUNCIONES FALTANTES)
const {
  getAppMetrics,
  getPendingAgencies,    // ✅ AGREGADA
  approveAgency,         // ✅ AGREGADA
  rejectAgency,          // ✅ AGREGADA
  banUser,
  unbanUser,
  getBannedUsers,
  getPendingReports,
  resolveReport,
  getAllUsers,
  getUserDetails,
  updateAppSettings
} = require('../controllers/adminController');

/**
 * @swagger
 * components:
 *   schemas:
 *     AppMetrics:
 *       type: object
 *       properties:
 *         users:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *             escorts:
 *               type: integer
 *             agencies:
 *               type: integer
 *             clients:
 *               type: integer
 *             active:
 *               type: integer
 *             banned:
 *               type: integer
 *         posts:
 *           type: object
 *         chat:
 *           type: object
 *         payments:
 *           type: object
 *         reports:
 *           type: object
 *     
 *     Ban:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         reason:
 *           type: string
 *         severity:
 *           type: string
 *           enum: [WARNING, TEMPORARY, PERMANENT, SHADOW]
 *         bannedBy:
 *           type: string
 *         isActive:
 *           type: boolean
 *         expiresAt:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *     
 *     Report:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         reason:
 *           type: string
 *           enum: [SPAM, INAPPROPRIATE_CONTENT, FAKE_PROFILE, SCAM, HARASSMENT, COPYRIGHT, UNDERAGE, VIOLENCE, FRAUD, IMPERSONATION, ADULT_CONTENT, OTHER]
 *         description:
 *           type: string
 *         status:
 *           type: string
 *           enum: [PENDING, REVIEWED, RESOLVED, REJECTED, ESCALATED]
 *         severity:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *         evidence:
 *           type: object
 *         author:
 *           $ref: '#/components/schemas/User'
 *         targetUser:
 *           $ref: '#/components/schemas/User'
 *         post:
 *           type: object
 */

// ✅ APLICAR MIDDLEWARES A TODAS LAS RUTAS DE ADMIN
router.use(authenticate);
router.use(requireAdmin);

/**
 * @swagger
 * /api/admin/metrics:
 *   get:
 *     summary: Obtener métricas generales de la aplicación
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [current, today, week, month, custom]
 *           default: current
 *         description: Período de tiempo para las métricas
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de inicio (para período custom)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de fin (para período custom)
 *     responses:
 *       200:
 *         description: Métricas de la aplicación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     metrics:
 *                       $ref: '#/components/schemas/AppMetrics'
 *                     period:
 *                       type: string
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *       403:
 *         description: Acceso de administrador requerido
 */
router.get('/metrics', logAdminActivity('view_metrics'), getAppMetrics);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Obtener lista de todos los usuarios
 *     tags: [Admin]
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
 *       - in: query
 *         name: userType
 *         schema:
 *           type: string
 *           enum: [ESCORT, AGENCY, CLIENT, ADMIN]
 *         description: Filtrar por tipo de usuario
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, banned, inactive, all]
 *           default: all
 *         description: Filtrar por estado del usuario
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nombre, username o email
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [newest, oldest, lastLogin, profileViews, alphabetical]
 *           default: newest
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 */
router.get('/users', logAdminActivity('view_users'), getAllUsers);

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   get:
 *     summary: Obtener detalles completos de usuario
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalles completos del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: Información completa del usuario incluyendo historial
 *       404:
 *         description: Usuario no encontrado
 */
router.get('/users/:userId', logAdminActivity('view_user_details'), getUserDetails);

/**
 * @swagger
 * /api/admin/users/{userId}/ban:
 *   post:
 *     summary: Banear usuario
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
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
 *                 description: Motivo del baneo
 *               severity:
 *                 type: string
 *                 enum: [WARNING, TEMPORARY, PERMANENT, SHADOW]
 *                 default: TEMPORARY
 *               duration:
 *                 type: integer
 *                 description: Duración en días (para baneos temporales)
 *               evidence:
 *                 type: object
 *                 description: Evidencia del comportamiento inapropiado
 *     responses:
 *       200:
 *         description: Usuario baneado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     ban:
 *                       $ref: '#/components/schemas/Ban'
 *       400:
 *         description: No puedes banearte a ti mismo
 *       403:
 *         description: No puedes banear a otro administrador
 *       404:
 *         description: Usuario no encontrado
 *       409:
 *         description: Usuario ya está baneado
 */
router.post('/users/:userId/ban', logAdminActivity('ban_user'), banUser);

/**
 * @swagger
 * /api/admin/users/{userId}/unban:
 *   post:
 *     summary: Desbanear usuario
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Motivo del desbaneo
 *     responses:
 *       200:
 *         description: Usuario desbaneado exitosamente
 *       400:
 *         description: Usuario no está baneado
 *       404:
 *         description: Usuario no encontrado
 */
router.post('/users/:userId/unban', logAdminActivity('unban_user'), unbanUser);

/**
 * @swagger
 * /api/admin/banned-users:
 *   get:
 *     summary: Obtener lista de usuarios baneados
 *     tags: [Admin]
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
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [WARNING, TEMPORARY, PERMANENT, SHADOW]
 *         description: Filtrar por severidad del baneo
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nombre, username o email
 *     responses:
 *       200:
 *         description: Lista de usuarios baneados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     bans:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Ban'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 */
router.get('/banned-users', logAdminActivity('view_banned_users'), getBannedUsers);

/**
 * @swagger
 * /api/admin/reports:
 *   get:
 *     summary: Obtener reportes pendientes
 *     tags: [Admin]
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
 *       - in: query
 *         name: reason
 *         schema:
 *           type: string
 *           enum: [SPAM, INAPPROPRIATE_CONTENT, FAKE_PROFILE, SCAM, HARASSMENT, COPYRIGHT, UNDERAGE, VIOLENCE, FRAUD, IMPERSONATION, ADULT_CONTENT, OTHER]
 *         description: Filtrar por motivo del reporte
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *         description: Filtrar por severidad
 *     responses:
 *       200:
 *         description: Lista de reportes pendientes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     reports:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Report'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 */
router.get('/reports', logAdminActivity('view_reports'), getPendingReports);

/**
 * @swagger
 * /api/admin/reports/{reportId}/resolve:
 *   put:
 *     summary: Resolver reporte
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject, ban_user, delete_post]
 *                 description: Acción a tomar
 *               resolution:
 *                 type: string
 *                 description: Descripción de la resolución
 *               actionTaken:
 *                 type: string
 *                 description: Acción específica tomada
 *               banDuration:
 *                 type: integer
 *                 description: Duración del baneo en días (si action es ban_user)
 *               banSeverity:
 *                 type: string
 *                 enum: [WARNING, TEMPORARY, PERMANENT, SHADOW]
 *                 default: TEMPORARY
 *     responses:
 *       200:
 *         description: Reporte resuelto exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     report:
 *                       $ref: '#/components/schemas/Report'
 *                     action:
 *                       type: string
 *       400:
 *         description: Reporte ya fue procesado o acción inválida
 *       404:
 *         description: Reporte no encontrado
 */
router.put('/reports/:reportId/resolve', logAdminActivity('resolve_report'), resolveReport);

// ✅ NUEVAS RUTAS AGREGADAS - GESTIÓN DE AGENCIAS

/**
 * @swagger
 * /api/admin/agencies/pending:
 *   get:
 *     summary: Obtener agencias pendientes de aprobación
 *     tags: [Admin]
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
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nombre, email o empresa
 *     responses:
 *       200:
 *         description: Lista de agencias pendientes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     agencies:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           requestId:
 *                             type: string
 *                           userId:
 *                             type: string
 *                           fullName:
 *                             type: string
 *                           documentNumber:
 *                             type: string
 *                           businessPhone:
 *                             type: string
 *                           businessEmail:
 *                             type: string
 *                           documentFrontImage:
 *                             type: string
 *                           documentBackImage:
 *                             type: string
 *                           status:
 *                             type: string
 *                           submittedAt:
 *                             type: string
 *                             format: date-time
 *                           userData:
 *                             type: object
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       403:
 *         description: Acceso de administrador requerido
 */
router.get('/agencies/pending', logAdminActivity('view_pending_agencies'), getPendingAgencies);

/**
 * @swagger
 * /api/admin/agencies/{agencyId}/approve:
 *   post:
 *     summary: Aprobar agencia pendiente
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agencyId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la solicitud de agencia a aprobar
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: Notas adicionales sobre la aprobación
 *     responses:
 *       200:
 *         description: Agencia aprobada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     approvedAt:
 *                       type: string
 *                       format: date-time
 *                     approvedBy:
 *                       type: string
 *       400:
 *         description: Solicitud ya fue procesada
 *       404:
 *         description: Solicitud de agencia no encontrada
 */
router.post('/agencies/:agencyId/approve', logAdminActivity('approve_agency'), approveAgency);

/**
 * @swagger
 * /api/admin/agencies/{agencyId}/reject:
 *   post:
 *     summary: Rechazar agencia pendiente
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agencyId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la solicitud de agencia a rechazar
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
 *                 description: Motivo del rechazo (obligatorio)
 *               notes:
 *                 type: string
 *                 description: Notas adicionales sobre el rechazo
 *     responses:
 *       200:
 *         description: Agencia rechazada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     rejectedAt:
 *                       type: string
 *                       format: date-time
 *                     rejectedBy:
 *                       type: string
 *                     reason:
 *                       type: string
 *       400:
 *         description: Razón del rechazo es obligatoria o solicitud ya fue procesada
 *       404:
 *         description: Solicitud de agencia no encontrada
 */
router.post('/agencies/:agencyId/reject', logAdminActivity('reject_agency'), rejectAgency);

/**
 * @swagger
 * /api/admin/settings:
 *   put:
 *     summary: Actualizar configuración de la aplicación
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maintenanceMode:
 *                 type: boolean
 *                 default: false
 *               registrationEnabled:
 *                 type: boolean
 *                 default: true
 *               maxPostsPerEscort:
 *                 type: integer
 *                 default: 5
 *               verificationCost:
 *                 type: number
 *                 default: 50
 *               commissionRate:
 *                 type: number
 *                 format: float
 *                 default: 0.1
 *               pointsPerDollar:
 *                 type: integer
 *                 default: 100
 *               featuredPostCost:
 *                 type: number
 *                 default: 10
 *     responses:
 *       200:
 *         description: Configuraciones actualizadas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     settings:
 *                       type: object
 *                     updatedBy:
 *                       type: string
 *       403:
 *         description: Se requieren permisos de super administrador
 */
router.put('/settings', logAdminActivity('update_settings'), updateAppSettings);

module.exports = router;