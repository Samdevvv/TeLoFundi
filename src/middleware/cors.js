const cors = require('cors');

const corsOptions = {
  origin: function (origin, callback) {
    // Lista de dominios permitidos
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3001',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'https://telofundi.com',
      'https://www.telofundi.com',
      'https://app.telofundi.com'
    ];

    // Permitir requests sin origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Verificar si el origin está en la lista permitida
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Origin bloqueado por CORS:', origin);
      callback(new Error('No permitido por política CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Access-Token',
    'X-Refresh-Token',
    'x-api-key'
  ],
  exposedHeaders: [
    'Authorization',
    'X-Access-Token',
    'X-Refresh-Token',
    'X-Total-Count',
    'X-Current-Page',
    'X-Total-Pages'
  ],
  credentials: true, // Permitir cookies y headers de autenticación
  preflightContinue: false,
  optionsSuccessStatus: 200, // Para navegadores legacy
  maxAge: 86400 // 24 horas de cache para preflight
};

module.exports = cors(corsOptions);