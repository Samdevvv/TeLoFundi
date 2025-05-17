// src/api/metrics/routes.js (corregido)
/**
 * Rutas para la API de métricas
 */
const express = require('express');
const router = express.Router();

// Cambiar la importación que está fallando
// Incorrecto: const controller = require('./controller');
// Correcto: 
const controller = require('./metrics.controller'); // Si el archivo se llama así en tu directorio

const { authMiddleware } = require('../../middleware/auth');
const { roleMiddleware } = require('../../middleware/role');

// Rutas de métricas generales del usuario
router.get('/user', authMiddleware, controller.getUserMetrics);

// Rutas de métricas para perfiles
router.get('/profile/:profileId', authMiddleware, controller.getProfileDetailedMetrics);
router.get('/profile/:profileId/visits', authMiddleware, controller.getProfileVisitsMetrics);
router.get('/profile/:profileId/contacts', authMiddleware, controller.getProfileContactsMetrics);

// Rutas de métricas para agencias
router.get('/agency/:agencyId', authMiddleware, controller.getAgencyDetailedMetrics);
router.get('/agency/:agencyId/profiles', authMiddleware, controller.getAgencyProfilesMetrics);
router.get('/agency/:agencyId/revenue', authMiddleware, controller.getAgencyRevenueMetrics);

// Rutas de métricas para plataforma (solo admin)
router.get('/platform/traffic', authMiddleware, roleMiddleware(['admin']), controller.getTrafficMetrics);
router.get('/platform/overview', authMiddleware, roleMiddleware(['admin']), controller.getPlatformMetrics);
router.get('/platform/revenue', authMiddleware, roleMiddleware(['admin']), controller.getPlatformRevenueMetrics);
router.get('/platform/registrations', authMiddleware, roleMiddleware(['admin']), controller.getUserRegistrationMetrics);

// Exportar datos de métricas
router.post('/export', authMiddleware, controller.exportMetricsData);

module.exports = router;