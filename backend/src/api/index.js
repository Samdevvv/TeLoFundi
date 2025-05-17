// src/api/index.js (Actualizado)
const express = require('express');
const router = express.Router();

// Importar todos los routers
const authRoutes = require('./auth/auth.routes');
const userRoutes = require('./user/user.routes');
const profileRoutes = require('./profile/profile.routes');
const clientRoutes = require('./client/client.routes');
const agencyRoutes = require('./agency/agency.routes');
const chatRoutes = require('./chat/chat.routes');
const searchRoutes = require('./search/search.routes');
const notificationRoutes = require('./notification/notification.routes');
const paymentRoutes = require('./payment/payment.routes');
const pointsRoutes = require('./points/points.routes');
const adminRoutes = require('./admin/admin.routes');
const metricsRoutes = require('./metrics/routes');
const uploadRoutes = require('./uploads/upload.routes'); // Agregar nueva ruta de uploads

// Montar los routers en las rutas correspondientes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/profiles', profileRoutes);
router.use('/clients', clientRoutes);
router.use('/agencies', agencyRoutes);
router.use('/chat', chatRoutes);
router.use('/search', searchRoutes);
router.use('/notifications', notificationRoutes);
router.use('/payments', paymentRoutes);
router.use('/points', pointsRoutes);
router.use('/admin', adminRoutes);
router.use('/metrics', metricsRoutes);
router.use('/uploads', uploadRoutes); // Montar rutas de uploads

// Ruta de prueba para verificar que el router funciona
router.get('/test', (req, res) => {
  res.json({
    message: 'API routes funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;