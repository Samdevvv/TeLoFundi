const express = require('express');
const router = express.Router();

// Importar todas las rutas
const authRoutes = require('./auth');
const userRoutes = require('./users');
const postRoutes = require('./posts');
const chatRoutes = require('./chat');
const agencyRoutes = require('./agency');
const adminRoutes = require('./admin');
const favoritesRoutes = require('./favorites');
const paymentRoutes = require('./payments');

// Importar middlewares
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

// Middleware para logging de requests
router.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logRequest(req, res, duration);
  });
  
  next();
});

/**
 * @swagger
 * components:
 *   responses:
 *     HealthCheck:
 *       description: Estado de salud de la API
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: true
 *               message:
 *                 type: string
 *                 example: "API funcionando correctamente"
 *               version:
 *                 type: string
 *                 example: "1.0.0"
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *               database:
 *                 type: object
 *                 properties:
 *                   status:
 *                     type: string
 *                     example: "connected"
 */

/**
 * @swagger
 * /api/status:
 *   get:
 *     summary: Verificar estado de la API
 *     tags: [System]
 *     responses:
 *       200:
 *         $ref: '#/components/responses/HealthCheck'
 */
router.get('/status', async (req, res) => {
  try {
    const { checkDatabaseHealth } = require('../config/database');
    const dbHealth = await checkDatabaseHealth();
    
    res.status(200).json({
      success: true,
      message: 'TeLoFundi API funcionando correctamente',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      database: dbHealth,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (error) {
    logger.error('Error en status check:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el sistema',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/metrics:
 *   get:
 *     summary: Obtener métricas básicas del sistema
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Métricas del sistema
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
 *                     database:
 *                       type: object
 *                     system:
 *                       type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/metrics', authenticate, async (req, res) => {
  try {
    // Solo admins pueden ver métricas completas
    if (req.user.userType !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Permisos insuficientes',
        errorCode: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const { getDatabaseStats } = require('../config/database');
    const dbStats = await getDatabaseStats();
    
    const systemMetrics = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid
    };

    res.status(200).json({
      success: true,
      data: {
        database: dbStats,
        system: systemMetrics,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error obteniendo métricas:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo métricas del sistema'
    });
  }
});

// Rutas de autenticación (públicas)
router.use('/auth', authRoutes);

// Rutas que requieren autenticación
router.use('/users', authenticate, userRoutes);
router.use('/posts', authenticate, postRoutes);
router.use('/chat', authenticate, chatRoutes);
router.use('/agency', authenticate, agencyRoutes);
router.use('/favorites', authenticate, favoritesRoutes);
router.use('/payments', authenticate, paymentRoutes);

// Rutas de administración (requieren rol admin)
router.use('/admin', authenticate, adminRoutes);

// Middleware para capturar rutas no encontradas en /api
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.originalUrl} no encontrado`,
    errorCode: 'ENDPOINT_NOT_FOUND',
    availableRoutes: [
      'GET /api/status',
      'GET /api/metrics',
      'POST /api/auth/login',
      'POST /api/auth/register',
      'GET /api/users/profile',
      'GET /api/posts',
      'GET /api/chat',
      'GET /api/agency',
      'GET /api/favorites',
      'GET /api/payments',
      'GET /api/admin'
    ],
    documentation: '/api-docs',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;