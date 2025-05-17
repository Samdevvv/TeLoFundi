/**
 * Funciones de validación para la aplicación
 */
const { body, param, query, validationResult } = require('express-validator');
const { z } = require('zod');

// Validación de errores en express-validator
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
};

// Validadores para usuarios
const userValidators = {
  register: [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
    body('role').isIn(['cliente', 'perfil', 'agencia']).withMessage('Rol inválido'),
    validateRequest
  ],
  
  login: [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').notEmpty().withMessage('La contraseña es requerida'),
    validateRequest
  ],
  
  updateProfile: [
    body('email').optional().isEmail().withMessage('Email inválido'),
    body('phone').optional().isMobilePhone().withMessage('Número de teléfono inválido'),
    validateRequest
  ]
};

// Validadores para perfiles
const profileValidators = {
  create: [
    body('displayName').notEmpty().withMessage('El nombre de exhibición es requerido'),
    body('gender').isIn(['femenino', 'masculino', 'transgenero', 'otro']).withMessage('Género inválido'),
    body('birthDate').optional().isDate().withMessage('Fecha de nacimiento inválida'),
    validateRequest
  ],
  
  update: [
    param('id').isUUID().withMessage('ID inválido'),
    body('displayName').optional().notEmpty().withMessage('El nombre de exhibición no puede estar vacío'),
    body('description').optional(),
    body('priceHour').optional().isNumeric().withMessage('El precio por hora debe ser un número'),
    validateRequest
  ],
  
  services: [
    param('id').isUUID().withMessage('ID inválido'),
    body('services').isObject().withMessage('Los servicios deben ser un objeto'),
    validateRequest
  ]
};

// Validadores para agencias
const agencyValidators = {
  create: [
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('description').optional(),
    body('contactPhone').optional().isMobilePhone().withMessage('Número de teléfono inválido'),
    body('contactEmail').optional().isEmail().withMessage('Email inválido'),
    validateRequest
  ],
  
  update: [
    param('id').isUUID().withMessage('ID inválido'),
    body('name').optional().notEmpty().withMessage('El nombre no puede estar vacío'),
    validateRequest
  ]
};

// Validadores para clientes
const clientValidators = {
  update: [
    param('id').isUUID().withMessage('ID inválido'),
    body('username').optional().isLength({ min: 3 }).withMessage('El nombre de usuario debe tener al menos 3 caracteres'),
    validateRequest
  ],
  
  favorite: [
    param('profileId').isUUID().withMessage('ID de perfil inválido'),
    validateRequest
  ]
};

// Validadores para pagos
const paymentValidators = {
  createPayment: [
    body('paymentType').isIn(['paquete_cupones', 'membresia_vip', 'servicio_destacado', 'verificacion', 'publicidad', 'suscripcion_agencia', 'comision_plataforma']).withMessage('Tipo de pago inválido'),
    body('amount').isNumeric().withMessage('El monto debe ser un número'),
    body('paymentMethodType').isIn(['tarjeta_credito', 'tarjeta_debito', 'paypal', 'stripe', 'transferencia_bancaria', 'mercado_pago', 'crypto', 'apple_pay', 'google_pay', 'efectivo']).withMessage('Método de pago inválido'),
    validateRequest
  ]
};

// Validadores para búsquedas
const searchValidators = {
  profiles: [
    query('query').optional(),
    query('gender').optional().isIn(['femenino', 'masculino', 'transgenero', 'otro', '']).withMessage('Género inválido'),
    query('page').optional().isInt({ min: 1 }).withMessage('Página inválida'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Límite inválido'),
    validateRequest
  ]
};

// Validadores para mensajes y chat
const chatValidators = {
  sendMessage: [
    body('conversationId').optional().isUUID().withMessage('ID de conversación inválido'),
    body('recipientId').optional().isUUID().withMessage('ID de destinatario inválido'),
    body('content').notEmpty().withMessage('El contenido es requerido'),
    validateRequest
  ],
  
  getConversation: [
    param('id').isUUID().withMessage('ID de conversación inválido'),
    validateRequest
  ]
};

// Schemas Zod para validación avanzada
const userSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  role: z.enum(['cliente', 'perfil', 'agencia', 'admin'], {
    errorMap: () => ({ message: 'Rol inválido' })
  })
});

const profileSchema = z.object({
  displayName: z.string().min(1, 'El nombre de exhibición es requerido'),
  gender: z.enum(['femenino', 'masculino', 'transgenero', 'otro'], {
    errorMap: () => ({ message: 'Género inválido' })
  }),
  birthDate: z.string().datetime().optional(),
  description: z.string().optional(),
  agencyId: z.string().uuid().optional().nullable(),
  services: z.record(z.any()).optional(),
  priceHour: z.number().positive().optional(),
  currency: z.string().default('USD')
});

// Validar con Zod
const validateZod = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      errors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
    });
  }
};

module.exports = {
  validateRequest,
  userValidators,
  profileValidators,
  agencyValidators,
  clientValidators,
  paymentValidators,
  searchValidators,
  chatValidators,
  validateZod,
  userSchema,
  profileSchema
};