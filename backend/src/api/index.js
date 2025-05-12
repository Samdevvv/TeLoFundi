// src/api/index.js
const express = require('express');
const router = express.Router();

// Importar rutas
const authRoutes = require('./auth/auth.routes');
const userRoutes = require('./user/user.routes');
const profileRoutes = require('./profile/profile.routes');
const agencyRoutes = require('./agency/agency.routes');
const pointsRoutes = require('./points/points.routes');
const searchRoutes = require('./search/search.routes');
const chatRoutes = require('./chat/chat.routes');
const adminRoutes = require('./admin/admin.routes');
const paymentRoutes = require('./payment/payment.routes');
const notificationRoutes = require('./notification/notification.routes');

// Configurar rutas
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/profiles', profileRoutes);
router.use('/agencies', agencyRoutes);
router.use('/points', pointsRoutes);
router.use('/search', searchRoutes);
router.use('/chat', chatRoutes);
router.use('/admin', adminRoutes);
router.use('/payments', paymentRoutes);
router.use('/notifications', notificationRoutes);

// Ruta raíz de la API
router.get('/', (req, res) => {
  res.status(200).json({
    message: 'API de TeLoFundi funcionando correctamente',
    version: '1.0.0'
  });
});

module.exports = router;