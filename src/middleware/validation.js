const Joi = require('joi');
const { AppError } = require('./errorHandler');
const logger = require('../utils/logger');

// Función helper para validar requests
const validateRequest = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Mostrar todos los errores
      allowUnknown: false, // No permitir campos adicionales
      stripUnknown: true // Remover campos no definidos
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/['"]/g, ''),
        value: detail.context?.value
      }));

      logger.warn('Validation error', {
        endpoint: req.originalUrl,
        method: req.method,
        errors,
        userId: req.user?.id
      });

      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors,
        errorCode: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }

    // Reemplazar el objeto original con el valor validado
    req[property] = value;
    next();
  };
};

// Esquemas de validación para autenticación
const registerSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'El email debe tener un formato válido',
      'any.required': 'El email es requerido'
    }),
  
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.alphanum': 'El username solo puede contener letras y números',
      'string.min': 'El username debe tener al menos 3 caracteres',
      'string.max': 'El username no puede tener más de 30 caracteres',
      'any.required': 'El username es requerido'
    }),
  
  firstName: Joi.string()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/)
    .required()
    .messages({
      'string.min': 'El nombre debe tener al menos 2 caracteres',
      'string.max': 'El nombre no puede tener más de 50 caracteres',
      'string.pattern.base': 'El nombre solo puede contener letras',
      'any.required': 'El nombre es requerido'
    }),
  
  lastName: Joi.string()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/)
    .required()
    .messages({
      'string.min': 'El apellido debe tener al menos 2 caracteres',
      'string.max': 'El apellido no puede tener más de 50 caracteres',
      'string.pattern.base': 'El apellido solo puede contener letras',
      'any.required': 'El apellido es requerido'
    }),
  
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'La contraseña debe tener al menos 8 caracteres',
      'string.max': 'La contraseña no puede tener más de 128 caracteres',
      'string.pattern.base': 'La contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 carácter especial',
      'any.required': 'La contraseña es requerida'
    }),
  
  userType: Joi.string()
    .valid('ESCORT', 'AGENCY', 'CLIENT')
    .required()
    .messages({
      'any.only': 'El tipo de usuario debe ser ESCORT, AGENCY o CLIENT',
      'any.required': 'El tipo de usuario es requerido'
    }),
  
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .optional()
    .messages({
      'string.pattern.base': 'El teléfono debe tener un formato válido (ej: +1234567890)'
    }),
  
  bio: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'La biografía no puede tener más de 500 caracteres'
    }),
  
  website: Joi.string()
    .uri()
    .optional()
    .messages({
      'string.uri': 'El website debe tener un formato válido'
    }),
  
  locationId: Joi.string()
    .optional(),
  
  // Campos específicos para escorts
  age: Joi.number()
    .integer()
    .min(18)
    .max(80)
    .when('userType', {
      is: 'ESCORT',
      then: Joi.optional(),
      otherwise: Joi.forbidden()
    })
    .messages({
      'number.min': 'La edad debe ser mayor a 18 años',
      'number.max': 'La edad debe ser menor a 80 años'
    }),
  
  services: Joi.array()
    .items(Joi.string().max(100))
    .max(10)
    .when('userType', {
      is: 'ESCORT',
      then: Joi.optional(),
      otherwise: Joi.forbidden()
    })
    .messages({
      'array.max': 'No puedes agregar más de 10 servicios'
    })
});

const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'El email debe tener un formato válido',
      'any.required': 'El email es requerido'
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'La contraseña es requerida'
    }),
  
  rememberMe: Joi.boolean()
    .optional()
    .default(false)
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'El email debe tener un formato válido',
      'any.required': 'El email es requerido'
    })
});

const resetPasswordSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'any.required': 'El token de restablecimiento es requerido'
    }),
  
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'La contraseña debe tener al menos 8 caracteres',
      'string.max': 'La contraseña no puede tener más de 128 caracteres',
      'string.pattern.base': 'La contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 carácter especial',
      'any.required': 'La nueva contraseña es requerida'
    })
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      'any.required': 'La contraseña actual es requerida'
    }),
  
  newPassword: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'La nueva contraseña debe tener al menos 8 caracteres',
      'string.max': 'La nueva contraseña no puede tener más de 128 caracteres',
      'string.pattern.base': 'La nueva contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 carácter especial',
      'any.required': 'La nueva contraseña es requerida'
    })
});

// Esquemas para perfil de usuario
const updateProfileSchema = Joi.object({
  firstName: Joi.string()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/)
    .optional()
    .messages({
      'string.min': 'El nombre debe tener al menos 2 caracteres',
      'string.max': 'El nombre no puede tener más de 50 caracteres',
      'string.pattern.base': 'El nombre solo puede contener letras'
    }),
  
  lastName: Joi.string()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/)
    .optional()
    .messages({
      'string.min': 'El apellido debe tener al menos 2 caracteres',
      'string.max': 'El apellido no puede tener más de 50 caracteres',
      'string.pattern.base': 'El apellido solo puede contener letras'
    }),
  
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .optional()
    .allow('')
    .messages({
      'string.pattern.base': 'El teléfono debe tener un formato válido'
    }),
  
  bio: Joi.string()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'La biografía no puede tener más de 500 caracteres'
    }),
  
  website: Joi.string()
    .uri()
    .optional()
    .allow('')
    .messages({
      'string.uri': 'El website debe tener un formato válido'
    }),
  
  locationId: Joi.string()
    .optional()
    .allow(null),
  
  // Campos específicos para escorts
  age: Joi.number()
    .integer()
    .min(18)
    .max(80)
    .optional()
    .messages({
      'number.min': 'La edad debe ser mayor a 18 años',
      'number.max': 'La edad debe ser menor a 80 años'
    }),
  
  height: Joi.string()
    .max(10)
    .optional()
    .allow('')
    .messages({
      'string.max': 'La altura no puede tener más de 10 caracteres'
    }),
  
  weight: Joi.string()
    .max(10)
    .optional()
    .allow('')
    .messages({
      'string.max': 'El peso no puede tener más de 10 caracteres'
    }),
  
  bodyType: Joi.string()
    .max(50)
    .optional()
    .allow('')
    .messages({
      'string.max': 'El tipo de cuerpo no puede tener más de 50 caracteres'
    }),
  
  ethnicity: Joi.string()
    .max(50)
    .optional()
    .allow('')
    .messages({
      'string.max': 'La etnia no puede tener más de 50 caracteres'
    }),
  
  hairColor: Joi.string()
    .max(30)
    .optional()
    .allow('')
    .messages({
      'string.max': 'El color de cabello no puede tener más de 30 caracteres'
    }),
  
  eyeColor: Joi.string()
    .max(30)
    .optional()
    .allow('')
    .messages({
      'string.max': 'El color de ojos no puede tener más de 30 caracteres'
    }),
  
  services: Joi.array()
    .items(Joi.string().max(100))
    .max(10)
    .optional()
    .messages({
      'array.max': 'No puedes agregar más de 10 servicios'
    }),
  
  rates: Joi.object()
    .pattern(Joi.string(), Joi.number().positive())
    .optional()
    .messages({
      'number.positive': 'Las tarifas deben ser números positivos'
    }),
  
  availability: Joi.object()
    .pattern(Joi.string(), Joi.array().items(Joi.string()))
    .optional(),
  
  languages: Joi.array()
    .items(Joi.string().max(50))
    .max(10)
    .optional()
    .messages({
      'array.max': 'No puedes agregar más de 10 idiomas'
    })
});

// Esquemas para posts/anuncios
const createPostSchema = Joi.object({
  title: Joi.string()
    .min(5)
    .max(100)
    .required()
    .messages({
      'string.min': 'El título debe tener al menos 5 caracteres',
      'string.max': 'El título no puede tener más de 100 caracteres',
      'any.required': 'El título es requerido'
    }),
  
  description: Joi.string()
    .min(10)
    .max(2000)
    .required()
    .messages({
      'string.min': 'La descripción debe tener al menos 10 caracteres',
      'string.max': 'La descripción no puede tener más de 2000 caracteres',
      'any.required': 'La descripción es requerida'
    }),
  
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      'string.pattern.base': 'El teléfono debe tener un formato válido',
      'any.required': 'El teléfono es requerido'
    }),
  
  services: Joi.array()
    .items(Joi.string().max(100))
    .max(15)
    .optional()
    .messages({
      'array.max': 'No puedes agregar más de 15 servicios'
    }),
  
  rates: Joi.object()
    .pattern(Joi.string(), Joi.number().positive())
    .optional()
    .messages({
      'number.positive': 'Las tarifas deben ser números positivos'
    }),
  
  availability: Joi.object()
    .pattern(Joi.string(), Joi.array().items(Joi.string()))
    .optional(),
  
  locationId: Joi.string()
    .optional(),
  
  premiumOnly: Joi.boolean()
    .optional()
    .default(false),
  
  expiresAt: Joi.date()
    .greater('now')
    .optional()
    .messages({
      'date.greater': 'La fecha de expiración debe ser futura'
    })
});

const updatePostSchema = createPostSchema.fork(
  ['title', 'description', 'phone'],
  (schema) => schema.optional()
);

// Esquemas para paginación
const paginationSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.min': 'La página debe ser mayor a 0'
    }),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .messages({
      'number.min': 'El límite debe ser mayor a 0',
      'number.max': 'El límite no puede ser mayor a 100'
    }),
  
  sortBy: Joi.string()
    .valid('createdAt', 'updatedAt', 'views', 'likes', 'score', 'lastBoosted')
    .default('createdAt')
    .messages({
      'any.only': 'El campo de ordenamiento no es válido'
    }),
  
  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .messages({
      'any.only': 'El orden debe ser asc o desc'
    }),
  
  search: Joi.string()
    .max(100)
    .optional()
    .messages({
      'string.max': 'La búsqueda no puede tener más de 100 caracteres'
    })
});

// Esquemas para chat
const sendMessageSchema = Joi.object({
  content: Joi.string()
    .min(1)
    .max(2000)
    .required()
    .messages({
      'string.min': 'El mensaje no puede estar vacío',
      'string.max': 'El mensaje no puede tener más de 2000 caracteres',
      'any.required': 'El contenido del mensaje es requerido'
    }),
  
  messageType: Joi.string()
    .valid('TEXT', 'IMAGE', 'FILE', 'AUDIO', 'VIDEO')
    .default('TEXT')
    .messages({
      'any.only': 'El tipo de mensaje no es válido'
    }),
  
  replyToId: Joi.string()
    .optional(),
  
  chatId: Joi.string()
    .required()
    .messages({
      'any.required': 'El ID del chat es requerido'
    })
});

// Esquemas de validación para pagos
const boostPaymentSchema = Joi.object({
  postId: Joi.string()
    .required()
    .messages({
      'any.required': 'El ID del post es requerido'
    }),
  
  pricingId: Joi.string()
    .required()
    .messages({
      'any.required': 'El ID del pricing es requerido'
    })
});

const pointsPaymentSchema = Joi.object({
  pointsPackage: Joi.string()
    .valid('small', 'medium', 'large', 'premium')
    .required()
    .messages({
      'any.only': 'El paquete de puntos debe ser small, medium, large o premium',
      'any.required': 'El paquete de puntos es requerido'
    })
});

const premiumPaymentSchema = Joi.object({
  tier: Joi.string()
    .valid('PREMIUM', 'VIP')
    .required()
    .messages({
      'any.only': 'El tier debe ser PREMIUM o VIP',
      'any.required': 'El tier es requerido'
    }),
  
  duration: Joi.number()
    .integer()
    .valid(1, 3, 6, 12)
    .required()
    .messages({
      'any.only': 'La duración debe ser 1, 3, 6 o 12 meses',
      'any.required': 'La duración es requerida'
    })
});

// ✅ NUEVO: Esquema de validación para pagos de verificación
const verificationPaymentSchema = Joi.object({
  escortId: Joi.string()
    .required()
    .messages({
      'any.required': 'El ID del escort es requerido'
    }),
  
  pricingId: Joi.string()
    .required()
    .messages({
      'any.required': 'El ID del pricing de verificación es requerido'
    })
});

// Middlewares de validación específicos
const validateRegistration = validateRequest(registerSchema);
const validateLogin = validateRequest(loginSchema);
const validatePasswordReset = validateRequest(forgotPasswordSchema);
const validateResetPassword = validateRequest(resetPasswordSchema);
const validateChangePassword = validateRequest(changePasswordSchema);
const validateUpdateProfile = validateRequest(updateProfileSchema);
const validateCreatePost = validateRequest(createPostSchema);
const validateUpdatePost = validateRequest(updatePostSchema);
const validatePagination = validateRequest(paginationSchema, 'query');
const validateSendMessage = validateRequest(sendMessageSchema);

// Middlewares de validación para pagos
const validateBoostPayment = validateRequest(boostPaymentSchema);
const validatePointsPayment = validateRequest(pointsPaymentSchema);
const validatePremiumPayment = validateRequest(premiumPaymentSchema);
const validateVerificationPayment = validateRequest(verificationPaymentSchema); // ✅ NUEVO

module.exports = {
  // Middlewares
  validateRegistration,
  validateLogin,
  validatePasswordReset,
  validateResetPassword,
  validateChangePassword,
  validateUpdateProfile,
  validateCreatePost,
  validateUpdatePost,
  validatePagination,
  validateSendMessage,
  validateBoostPayment,
  validatePointsPayment,
  validatePremiumPayment,
  validateVerificationPayment, // ✅ NUEVO
  
  // Esquemas (por si se necesitan directamente)
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
  createPostSchema,
  updatePostSchema,
  paginationSchema,
  sendMessageSchema,
  boostPaymentSchema,
  pointsPaymentSchema,
  premiumPaymentSchema,
  verificationPaymentSchema, // ✅ NUEVO
  
  // Función helper
  validateRequest
};