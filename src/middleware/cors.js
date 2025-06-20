const cors = require('cors');

const corsOptions = {
  origin: function (origin, callback) {
    // Lista de dominios permitidos - AGREGADO 5173
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5173', // ← CAMBIADO DE 3001 A 5173
      'http://localhost:3000',
      'http://localhost:5173', // ← AGREGADO ESPECÍFICAMENTE
      'http://127.0.0.1:5173',  // ← AGREGADO ESPECÍFICAMENTE
      'http://localhost:3001',  // Mantenido por compatibilidad
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
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 200,
  maxAge: 86400
};

module.exports = cors(corsOptions);