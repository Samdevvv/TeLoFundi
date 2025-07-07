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
const pointsRoutes = require('./points'); // ✅ NUEVO: Sistema TeloPoints

// Importar middlewares
const { authenticate, requireAdmin } = require('../middleware/auth');
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
router.get('/metrics', authenticate, requireAdmin, async (req, res) => {
  try {
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

// ============================================================================
// RUTAS DE LA API
// ============================================================================

// ✅ RUTAS PÚBLICAS (sin autenticación)
router.use('/auth', authRoutes);

// ✅ RUTAS CON AUTENTICACIÓN REQUERIDA
router.use('/users', userRoutes); // Ya maneja auth internamente
router.use('/posts', postRoutes); // Ya maneja auth/optionalAuth internamente
router.use('/chat', authenticate, chatRoutes); // Todas requieren auth
router.use('/agency', agencyRoutes); // Ya maneja auth internamente (/search es pública)
router.use('/favorites', authenticate, favoritesRoutes); // Todas requieren auth
router.use('/payments', authenticate, paymentRoutes); // Todas requieren auth
router.use('/points', authenticate, pointsRoutes); // ✅ NUEVO: Sistema TeloPoints

// ✅ RUTAS DE ADMINISTRACIÓN (requieren rol admin)
router.use('/admin', authenticate, requireAdmin, adminRoutes);

// Middleware para capturar rutas no encontradas en /api
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.originalUrl} no encontrado`,
    errorCode: 'ENDPOINT_NOT_FOUND',
    availableRoutes: [
      // Sistema
      'GET /api/status - Sistema: Estado de salud',
      'GET /api/metrics - Sistema: Métricas (Admin)',
      
      // Autenticación
      'POST /api/auth/login - Auth: Iniciar sesión',
      'POST /api/auth/register - Auth: Registrarse',
      'GET /api/auth/google - Auth: OAuth Google',
      
      // Usuarios
      'GET /api/users/profile - Usuarios: Mi perfil',
      'PUT /api/users/profile - Usuarios: Actualizar perfil',
      'GET /api/users/search - Usuarios: Buscar usuarios',
      
      // Posts
      'GET /api/posts/feed - Posts: Feed principal',
      'GET /api/posts/trending - Posts: Trending (público)',
      'POST /api/posts - Posts: Crear post',
      
      // Chat
      'GET /api/chat - Chat: Mis chats',
      'POST /api/chat - Chat: Crear chat',
      
      // Agencias
      'GET /api/agency/search - Agencias: Buscar (público)',
      'POST /api/agency/register - Agencias: Registrar',
      
      // Favoritos
      'GET /api/favorites - Favoritos: Mis favoritos',
      'POST /api/favorites/:postId - Favoritos: Agregar/quitar',
      
      // Pagos
      'GET /api/payments/boost/pricing - Pagos: Precios boost',
      'POST /api/payments/boost/intent - Pagos: Crear boost',
      'GET /api/payments/history - Pagos: Historial',
      
      // ✅ NUEVO: Sistema TeloPoints
      'GET /api/points/balance - Puntos: Mi balance',
      'GET /api/points/history - Puntos: Historial de puntos',
      'GET /api/points/packages - Puntos: Paquetes disponibles',
      'POST /api/points/daily-login - Puntos: Reclamar diarios',
      'POST /api/points/spend - Puntos: Usar puntos',
      'POST /api/points/purchase - Puntos: Comprar puntos',
      'POST /api/points/premium - Puntos: Activar premium',
      'GET /api/points/actions - Puntos: Acciones disponibles',
      'GET /api/points/streak - Puntos: Info de racha',
      'GET /api/points/config - Puntos: Configuración del sistema',
      
      // Administración
      'GET /api/admin/metrics - Admin: Métricas de app',
      'POST /api/points/admin/adjust - Admin: Ajustar puntos',
      'GET /api/points/admin/stats - Admin: Estadísticas de puntos'
    ],
    documentation: '/api-docs',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;