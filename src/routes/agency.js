const express = require('express');
const router = express.Router();

// Middleware
const { authenticate } = require('../middleware/auth');

// ✅ CORREGIDO: Controllers - AGREGADAS FUNCIONES FALTANTES
const {
  searchAgencies,
  requestToJoinAgency,
  inviteEscort,
  respondToInvitation,
  manageMembershipRequest,
  getAgencyEscorts,
  getVerificationPricing,
  verifyEscort,
  getAgencyStats,
  // ✅ NUEVAS FUNCIONES AGREGADAS
  getEscortInvitations,
  getEscortMembershipStatus,
  leaveCurrentAgency
} = require('../controllers/agencyController');

/**
 * @swagger
 * components:
 *   schemas:
 *     Agency:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         user:
 *           $ref: '#/components/schemas/User'
 *         isVerified:
 *           type: boolean
 *         totalEscorts:
 *           type: integer
 *         verifiedEscorts:
 *           type: integer
 *         activeEscorts:
 *           type: integer
 *         defaultCommissionRate:
 *           type: number
 *           format: float
 *     
 *     AgencyInvitation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         agencyId:
 *           type: string
 *         escortId:
 *           type: string
 *         status:
 *           type: string
 *           enum: [PENDING, ACCEPTED, REJECTED, EXPIRED, CANCELLED]
 *         message:
 *           type: string
 *         proposedCommission:
 *           type: number
 *           format: float
 *         proposedRole:
 *           type: string
 *           enum: [OWNER, ADMIN, MANAGER, MEMBER]
 *         expiresAt:
 *           type: string
 *           format: date-time
 *     
 *     MembershipStatus:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [independent, agency, pending]
 *         hasActiveMembership:
 *           type: boolean
 *         hasPendingRequests:
 *           type: boolean
 *         currentAgency:
 *           type: object
 *           nullable: true
 *         pendingRequests:
 *           type: array
 *           items:
 *             type: object
 *     
 *     VerificationPricing:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *           example: "Premium Verification"
 *         cost:
 *           type: number
 *           example: 49.99
 *         description:
 *           type: string
 *           example: "Verificación premium con beneficios adicionales"
 *         features:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Badge verificado", "Prioridad en búsquedas", "Soporte premium"]
 *         duration:
 *           type: integer
 *           nullable: true
 *           example: 365
 *           description: "Duración en días (null = permanente)"
 *         isActive:
 *           type: boolean
 *           example: true
 */

/**
 * @swagger
 * /api/agency/search:
 *   get:
 *     summary: Buscar agencias (para escorts)
 *     tags: [Agency]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Término de búsqueda
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filtrar por ubicación
 *       - in: query
 *         name: verified
 *         schema:
 *           type: boolean
 *         description: Solo agencias verificadas
 *       - in: query
 *         name: minEscorts
 *         schema:
 *           type: integer
 *         description: Mínimo número de escorts
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
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [relevance, newest, oldest, escorts, verified]
 *           default: relevance
 *     responses:
 *       200:
 *         description: Lista de agencias encontradas
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
 *                         $ref: '#/components/schemas/Agency'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 */
router.get('/search', searchAgencies);

/**
 * @swagger
 * /api/agency/verification/pricing:
 *   get:
 *     summary: Obtener precios de verificación disponibles (agencias)
 *     tags: [Agency]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Precios de verificación obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VerificationPricing'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/verification/pricing', authenticate, getVerificationPricing);

/**
 * @swagger
 * /api/agency/{agencyId}/join:
 *   post:
 *     summary: Solicitar unirse a una agencia (escort)
 *     tags: [Agency]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agencyId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario de la agencia (userId, no agency.id)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: Mensaje opcional para la agencia
 *     responses:
 *       201:
 *         description: Solicitud enviada exitosamente
 *       403:
 *         description: Solo escorts pueden solicitar unirse
 *       409:
 *         description: Ya existe una membresía activa o pendiente
 */
router.post('/:agencyId/join', authenticate, requestToJoinAgency);

/**
 * @swagger
 * /api/agency/escorts/{escortId}/invite:
 *   post:
 *     summary: Invitar escort a la agencia
 *     tags: [Agency]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: escortId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *               proposedCommission:
 *                 type: number
 *                 format: float
 *                 default: 0.1
 *               proposedRole:
 *                 type: string
 *                 enum: [MEMBER, MANAGER]
 *                 default: MEMBER
 *               proposedBenefits:
 *                 type: object
 *     responses:
 *       201:
 *         description: Invitación enviada exitosamente
 *       403:
 *         description: Solo agencias pueden invitar escorts
 *       409:
 *         description: Ya existe una invitación o membresía
 */
router.post('/escorts/:escortId/invite', authenticate, inviteEscort);

/**
 * @swagger
 * /api/agency/invitations/{invitationId}/respond:
 *   put:
 *     summary: Responder a invitación de agencia (escort)
 *     tags: [Agency]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invitationId
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
 *                 enum: [accept, reject]
 *               message:
 *                 type: string
 *                 description: Mensaje opcional de respuesta
 *     responses:
 *       200:
 *         description: Respuesta procesada exitosamente
 *       403:
 *         description: Solo escorts pueden responder invitaciones
 *       404:
 *         description: Invitación no encontrada o expirada
 */
router.put('/invitations/:invitationId/respond', authenticate, respondToInvitation);

/**
 * @swagger
 * /api/agency/memberships/{membershipId}/manage:
 *   put:
 *     summary: Gestionar solicitud de membresía (agencia)
 *     tags: [Agency]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: membershipId
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
 *                 enum: [approve, reject]
 *               message:
 *                 type: string
 *               commissionRate:
 *                 type: number
 *                 format: float
 *     responses:
 *       200:
 *         description: Solicitud procesada exitosamente
 *       403:
 *         description: Solo agencias pueden gestionar membresías
 *       404:
 *         description: Solicitud no encontrada
 */
router.put('/memberships/:membershipId/manage', authenticate, manageMembershipRequest);

/**
 * @swagger
 * /api/agency/escorts:
 *   get:
 *     summary: Obtener escorts de la agencia
 *     tags: [Agency]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, pending, all]
 *           default: active
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nombre o username
 *     responses:
 *       200:
 *         description: Lista de escorts de la agencia
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
 *                     escorts:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       403:
 *         description: Solo agencias pueden ver sus escorts
 */
router.get('/escorts', authenticate, getAgencyEscorts);

/**
 * @swagger
 * /api/agency/escorts/{escortId}/verify:
 *   post:
 *     summary: Verificar escort (agencia) - FUNCIÓN CLAVE
 *     tags: [Agency]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: escortId
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
 *               - pricingId
 *             properties:
 *               pricingId:
 *                 type: string
 *                 description: ID del plan de verificación
 *               verificationNotes:
 *                 type: string
 *                 description: Notas adicionales sobre la verificación
 *     responses:
 *       200:
 *         description: Escort verificado exitosamente
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
 *                     verification:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         status:
 *                           type: string
 *                         completedAt:
 *                           type: string
 *                           format: date-time
 *                         pricing:
 *                           type: object
 *                         escort:
 *                           type: object
 *       403:
 *         description: Solo agencias pueden verificar escorts
 *       404:
 *         description: Escort no es miembro activo de la agencia
 *       409:
 *         description: Escort ya está verificado
 */
router.post('/escorts/:escortId/verify', authenticate, verifyEscort);

/**
 * @swagger
 * /api/agency/stats:
 *   get:
 *     summary: Obtener estadísticas de la agencia
 *     tags: [Agency]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas de la agencia
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
 *                     memberships:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         byStatus:
 *                           type: object
 *                         active:
 *                           type: integer
 *                         pending:
 *                           type: integer
 *                     invitations:
 *                       type: object
 *                     verifications:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         totalRevenue:
 *                           type: number
 *                         averageCost:
 *                           type: number
 *                     topEscorts:
 *                       type: array
 *                       items:
 *                         type: object
 *       403:
 *         description: Solo agencias pueden ver estadísticas
 */
router.get('/stats', authenticate, getAgencyStats);

// ✅ ===================================================================
// ✅ NUEVAS RUTAS ESPECÍFICAS PARA ESCORTS
// ✅ ===================================================================

/**
 * @swagger
 * /api/agency/escort/invitations:
 *   get:
 *     summary: Obtener invitaciones recibidas (escort)
 *     tags: [Agency - Escort]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, ACCEPTED, REJECTED]
 *           default: PENDING
 *     responses:
 *       200:
 *         description: Lista de invitaciones recibidas
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
 *                     invitations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/AgencyInvitation'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       403:
 *         description: Solo escorts pueden ver sus invitaciones
 */
router.get('/escort/invitations', authenticate, getEscortInvitations);

/**
 * @swagger
 * /api/agency/escort/membership/status:
 *   get:
 *     summary: Obtener estado de membresía del escort
 *     tags: [Agency - Escort]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estado actual de membresía
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/MembershipStatus'
 *       403:
 *         description: Solo escorts pueden ver su estado de membresía
 */
router.get('/escort/membership/status', authenticate, getEscortMembershipStatus);

/**
 * @swagger
 * /api/agency/escort/membership/leave:
 *   post:
 *     summary: Salir de agencia actual (escort)
 *     tags: [Agency - Escort]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Razón opcional para dejar la agencia
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Has dejado la agencia exitosamente
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
 *                     formerAgency:
 *                       type: string
 *                     leftAt:
 *                       type: string
 *                       format: date-time
 *       403:
 *         description: Solo escorts pueden salir de agencias
 *       404:
 *         description: No tienes una membresía activa en ninguna agencia
 */
router.post('/escort/membership/leave', authenticate, leaveCurrentAgency);

module.exports = router;