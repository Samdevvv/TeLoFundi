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
// Aquí se pueden importar más rutas según se vayan implementando

// Configurar rutas
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/profiles', profileRoutes);
router.use('/agencies', agencyRoutes);
router.use('/points', pointsRoutes);
router.use('/search', searchRoutes);
router.use('/chat', chatRoutes);
// Aquí se pueden configurar más rutas según se vayan implementando

// Ruta raíz de la API
router.get('/', (req, res) => {
  res.status(200).json({
    message: 'API de TeLoFundi funcionando correctamente',
    version: '1.0.0'
  });
});

module.exports = router;