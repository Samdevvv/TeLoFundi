const Joi = require('joi');
const { AppError } = require('./errorHandler');
const logger = require('../utils/logger');

// ✅ AGREGADO: validateRegistration específica
const validateRegistration = (req, res, next) => {
  console.log('🔍 VALIDANDO REGISTRO:', Object.keys(req.body));

  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Debe ser un email válido',
      'any.required': 'El email es requerido'
    }),
    username: Joi.string().min(3).max(30).alphanum().required().messages({
      'string.min': 'El username debe tener al menos 3 caracteres',
      'string.max': 'El username no puede exceder 30 caracteres',
      'string.alphanum': 'El username solo puede contener letras y números',
      'any.required': 'El username es requerido'
    }),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
      'string.min': 'La contraseña debe tener al menos 8 caracteres',
      'string.pattern.base': 'La contraseña debe tener al menos una mayúscula, una minúscula y un número',
      'any.required': 'La contraseña es requerida'
    }),
    firstName: Joi.string().min(2).max(50).trim().required().messages({
      'string.min': 'El nombre debe tener al menos 2 caracteres',
      'any.required': 'El nombre es requerido'
    }),
    lastName: Joi.string().min(2).max(50).trim().allow('').messages({
      'string.min': 'El apellido debe tener al menos 2 caracteres'
    }),
    userType: Joi.string().valid('ESCORT', 'AGENCY', 'CLIENT').required().messages({
      'any.only': 'El tipo de usuario debe ser ESCORT, AGENCY o CLIENT',
      'any.required': 'El tipo de usuario es requerido'
    }),
    phone: Joi.string().pattern(/^\+?[1-9]\d{7,14}$/).allow('').messages({
      'string.pattern.base': 'Debe ser un número de teléfono válido'
    }),
    bio: Joi.string().max(500).trim().allow(''),
    website: Joi.string().uri().allow(''),
    locationId: Joi.string().allow(''),
    age: Joi.number().integer().min(18).max(80).messages({
      'number.min': 'Debes ser mayor de 18 años',
      'number.max': 'La edad máxima es 80 años'
    }),
    services: Joi.array().items(Joi.string().trim()).max(20),
    termsAccepted: Joi.boolean().valid(true).messages({
      'any.only': 'Debes aceptar los términos y condiciones'
    })
  });

  const { error, value } = schema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      value: err.context?.value
    }));

    console.log('❌ ERRORES DE VALIDACIÓN DE REGISTRO:', errors);
    return next(new AppError('Errores de validación', 400, 'VALIDATION_ERROR', errors));
  }

  console.log('✅ VALIDACIÓN DE REGISTRO EXITOSA');
  req.validatedData = value;
  next();
};

// ✅ AGREGADO: validateLogin específica  
const validateLogin = (req, res, next) => {
  console.log('🔍 VALIDANDO LOGIN:', Object.keys(req.body));

  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Debe ser un email válido',
      'any.required': 'El email es requerido'
    }),
    password: Joi.string().required().messages({
      'any.required': 'La contraseña es requerida'
    }),
    rememberMe: Joi.boolean().default(false)
  });

  const { error, value } = schema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      value: err.context?.value
    }));

    console.log('❌ ERRORES DE VALIDACIÓN DE LOGIN:', errors);
    return next(new AppError('Errores de validación', 400, 'VALIDATION_ERROR', errors));
  }

  console.log('✅ VALIDACIÓN DE LOGIN EXITOSA');
  req.validatedData = value;
  next();
};

// ✅ AGREGADO: validatePasswordReset específica
const validatePasswordReset = (req, res, next) => {
  console.log('🔍 VALIDANDO PASSWORD RESET:', Object.keys(req.body));

  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Debe ser un email válido',
      'any.required': 'El email es requerido'
    })
  });

  const { error, value } = schema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      value: err.context?.value
    }));

    console.log('❌ ERRORES DE VALIDACIÓN DE PASSWORD RESET:', errors);
    return next(new AppError('Errores de validación', 400, 'VALIDATION_ERROR', errors));
  }

  console.log('✅ VALIDACIÓN DE PASSWORD RESET EXITOSA');
  req.validatedData = value;
  next();
};

// ✅ CORREGIDO: Middleware validateUpdateProfile que procesa campos de escort correctamente
const validateUpdateProfile = (req, res, next) => {
  console.log('🔍 VALIDANDO BODY:', req.body);
  console.log('🔍 TAMAÑO DEL BODY:', Object.keys(req.body).length, 'campos');
  console.log('🔍 CAMPOS RECIBIDOS:', Object.keys(req.body));

  const schema = Joi.object({
    // Campos básicos de usuario
    firstName: Joi.string().min(2).max(50).trim().messages({
      'string.min': 'El nombre debe tener al menos 2 caracteres',
      'string.max': 'El nombre no puede exceder 50 caracteres'
    }),
    lastName: Joi.string().min(2).max(50).trim().allow('').messages({
      'string.min': 'El apellido debe tener al menos 2 caracteres'
    }),
    bio: Joi.string().max(500).trim().allow('').messages({
      'string.max': 'La descripción no puede exceder 500 caracteres'
    }),
    phone: Joi.string().pattern(/^\+?[1-9]\d{7,14}$/).allow('').messages({
      'string.pattern.base': 'Debe ser un número de teléfono válido'
    }),
    website: Joi.string().uri().allow('').messages({
      'string.uri': 'Debe ser una URL válida'
    }),
    locationId: Joi.string().allow(''),
    
    // ✅ CORREGIDO: Campos específicos para escorts con validaciones mejoradas
    age: Joi.number().integer().min(18).max(80).messages({
      'number.base': 'La edad debe ser un número',
      'number.integer': 'La edad debe ser un número entero',
      'number.min': 'Debes ser mayor de 18 años',
      'number.max': 'La edad máxima es 80 años'
    }),
    height: Joi.number().integer().min(140).max(220).messages({
      'number.min': 'La altura mínima es 140cm',
      'number.max': 'La altura máxima es 220cm'
    }),
    weight: Joi.number().integer().min(40).max(150).messages({
      'number.min': 'El peso mínimo es 40kg',
      'number.max': 'El peso máximo es 150kg'
    }),
    bodyType: Joi.string().valid('SLIM', 'ATHLETIC', 'CURVY', 'FULL_FIGURED', 'MUSCULAR').allow('').messages({
      'any.only': 'Tipo de cuerpo inválido'
    }),
    ethnicity: Joi.string().valid('LATINA', 'CAUCASIAN', 'AFRO', 'ASIAN', 'MIXED', 'OTHER').allow('').messages({
      'any.only': 'Etnia inválida'
    }),
    hairColor: Joi.string().valid('BLACK', 'BROWN', 'BLONDE', 'RED', 'OTHER').allow('').messages({
      'any.only': 'Color de cabello inválido'
    }),
    eyeColor: Joi.string().valid('BROWN', 'BLUE', 'GREEN', 'HAZEL', 'BLACK', 'GRAY').allow('').messages({
      'any.only': 'Color de ojos inválido'
    }),
    
    // ✅ ARRAYS: Validar correctamente servicios, idiomas, etc.
    services: Joi.array().items(Joi.string().trim().min(1)).max(20).messages({
      'array.base': 'Los servicios deben ser una lista',
      'array.max': 'Máximo 20 servicios permitidos',
      'string.min': 'Cada servicio debe tener al menos 1 caracter'
    }),
    languages: Joi.array().items(Joi.string().trim().min(1)).max(10).messages({
      'array.base': 'Los idiomas deben ser una lista',
      'array.max': 'Máximo 10 idiomas permitidos'
    }),
    specialties: Joi.array().items(Joi.string().trim().min(1)).max(15).messages({
      'array.base': 'Las especialidades deben ser una lista',
      'array.max': 'Máximo 15 especialidades permitidas'
    }),
    hobbies: Joi.array().items(Joi.string().trim().min(1)).max(10).messages({
      'array.base': 'Los hobbies deben ser una lista',
      'array.max': 'Máximo 10 hobbies permitidos'
    }),
    personalityTraits: Joi.array().items(Joi.string().trim().min(1)).max(10).messages({
      'array.base': 'Los rasgos de personalidad deben ser una lista',
      'array.max': 'Máximo 10 rasgos permitidos'
    }),
    outcallAreas: Joi.array().items(Joi.string().trim().min(1)).max(10).messages({
      'array.base': 'Las áreas de outcall deben ser una lista',
      'array.max': 'Máximo 10 áreas permitidas'
    }),
    
    // ✅ OBJETOS: Validar tarifas, disponibilidad, etc.
    rates: Joi.object().pattern(
      Joi.string().valid('30min', '1h', '2h', '3h', '4h', 'overnight', 'dinner', 'travel'),
      Joi.number().positive().max(100000)
    ).messages({
      'object.base': 'Las tarifas deben ser un objeto',
      'number.positive': 'Las tarifas deben ser números positivos',
      'number.max': 'Tarifa máxima: $100,000'
    }),
    
    availability: Joi.object().pattern(
      Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
      Joi.array().items(Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$/))
    ).messages({
      'object.base': 'La disponibilidad debe ser un objeto',
      'string.pattern.base': 'Formato de hora inválido (HH:MM-HH:MM)'
    }),
    
    measurements: Joi.object().pattern(
      Joi.string().valid('bust', 'waist', 'hips'),
      Joi.number().positive().max(200)
    ).messages({
      'object.base': 'Las medidas deben ser un objeto',
      'number.positive': 'Las medidas deben ser números positivos'
    }),
    
    workingHours: Joi.object({
      start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
      timezone: Joi.string().allow('')
    }).messages({
      'string.pattern.base': 'Formato de hora inválido (HH:MM)'
    }),
    
    socialMedia: Joi.object().pattern(
      Joi.string().valid('instagram', 'twitter', 'facebook', 'tiktok', 'onlyfans'),
      Joi.string().trim().max(100)
    ).messages({
      'object.base': 'Las redes sociales deben ser un objeto'
    }),
    
    // ✅ CAMPOS DE TEXTO LARGOS
    aboutMe: Joi.string().max(1000).trim().allow('').messages({
      'string.max': 'La descripción "Sobre mí" no puede exceder 1000 caracteres'
    }),
    education: Joi.string().max(200).trim().allow('').messages({
      'string.max': 'La educación no puede exceder 200 caracteres'
    }),
    incallLocation: Joi.string().max(100).trim().allow('').messages({
      'string.max': 'La ubicación incall no puede exceder 100 caracteres'
    }),
    
    // ✅ ENUMS
    experience: Joi.string().valid('NEW', 'BEGINNER', 'INTERMEDIATE', 'EXPERIENCED', 'EXPERT').allow('').messages({
      'any.only': 'Nivel de experiencia inválido'
    }),
    preferredClientType: Joi.string().valid('EXECUTIVES', 'TOURISTS', 'REGULARS', 'COUPLES', 'ANY').allow('').messages({
      'any.only': 'Tipo de cliente preferido inválido'
    })
  });

  const { error, value } = schema.validate(req.body, { 
    abortEarly: false,
    allowUnknown: false, // ✅ CORREGIDO: No permitir campos desconocidos
    stripUnknown: true,  // Remover campos desconocidos
    convert: true        // Convertir tipos automáticamente
  });

  if (error) {
    const errors = error.details.map(err => ({
      field: err.path.join('.'),
      message: getCustomErrorMessage(err),
      value: err.context?.value,
      type: err.type
    }));

    console.log('❌ ERRORES DE VALIDACIÓN DETALLADOS:');
    errors.forEach((err, index) => {
      console.log(`   ${index + 1}. Campo: "${err.field}"`);
      console.log(`      Mensaje: ${err.message}`);
      console.log(`      Valor recibido: ${JSON.stringify(err.value)}`);
      console.log(`      Tipo de error: ${err.type}`);
      console.log(`      ---`);
    });

    return next(new AppError('Errores de validación', 400, 'VALIDATION_ERROR', errors));
  }

  console.log('✅ VALIDACIÓN EXITOSA - Datos procesados:', Object.keys(value).length, 'campos');
  console.log('✅ CAMPOS VALIDADOS:', Object.keys(value));
  req.validatedData = value;
  next();
};

// ✅ CORREGIDO: validatePagination con valores de sortBy faltantes
const validatePagination = (req, res, next) => {
  console.log('🔍 VALIDANDO QUERY:', req.query);
  console.log('🔍 TAMAÑO DEL QUERY:', Object.keys(req.query).length, 'campos');
  console.log('🔍 CAMPOS RECIBIDOS:', Object.keys(req.query));

  const schema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    verified: Joi.boolean(),
    location: Joi.string().trim(),
    userType: Joi.string().valid('ESCORT', 'AGENCY', 'CLIENT', 'ADMIN'),
    status: Joi.string().valid('active', 'inactive', 'pending', 'draft', 'rejected'),
    
    // ✅ CORREGIDO: Agregar valores faltantes para sortBy
    sortBy: Joi.string().valid(
      'recent',      // 🔴 AGREGADO - Este valor faltaba
      'relevance', 
      'newest', 
      'oldest', 
      'popular', 
      'rating',
      'createdAt',   // 🔴 AGREGADO
      'updatedAt',   // 🔴 AGREGADO
      'views',       // 🔴 AGREGADO
      'likes'        // 🔴 AGREGADO
    ).default('recent'),
    
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    q: Joi.string().trim(), // query de búsqueda
    
    // Filtros adicionales para búsquedas específicas
    minAge: Joi.number().integer().min(18).max(80),
    maxAge: Joi.number().integer().min(18).max(80),
    bodyType: Joi.string().valid('SLIM', 'ATHLETIC', 'CURVY', 'FULL_FIGURED', 'MUSCULAR'),
    ethnicity: Joi.string().valid('LATINA', 'CAUCASIAN', 'AFRO', 'ASIAN', 'MIXED', 'OTHER'),
    services: Joi.array().items(Joi.string()),
    languages: Joi.array().items(Joi.string()),
    minRate: Joi.number().positive(),
    maxRate: Joi.number().positive(),
    isOnline: Joi.boolean(),
    hasPhotos: Joi.boolean(),
    premiumOnly: Joi.boolean()
  });

  const { error, value } = schema.validate(req.query, { 
    abortEarly: false,
    stripUnknown: true,
    convert: true // Convertir tipos automáticamente
  });

  if (error) {
    const errors = error.details.map(err => ({
      field: err.path.join('.'),
      message: getCustomErrorMessage(err),
      value: err.context?.value,
      type: err.type
    }));

    console.log('❌ ERRORES DE VALIDACIÓN DETALLADOS:');
    errors.forEach((err, index) => {
      console.log(`   ${index + 1}. Campo: "${err.field}"`);
      console.log(`      Mensaje: ${err.message}`);
      console.log(`      Valor recibido: ${JSON.stringify(err.value)}`);
      console.log(`      Tipo de error: ${err.type}`);
      console.log(`      ---`);
    });

    return next(new AppError('Error de validación', 400, 'VALIDATION_ERROR', errors));
  }

  console.log('✅ VALIDACIÓN EXITOSA - Datos procesados:', Object.keys(value).length, 'campos');
  req.query = value;
  next();
};

// ✅ RESTO DE FUNCIONES ORIGINALES...
const validateCreatePost = (req, res, next) => {
  console.log('🔍 VALIDANDO POST CREATION:', {
    bodyKeys: Object.keys(req.body),
    filesCount: req.files ? req.files.length : 0
  });

  const schema = Joi.object({
    title: Joi.string().min(5).max(100).trim().required(),
    description: Joi.string().min(10).max(2000).trim().required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{7,14}$/).required(),
    
    // Campos opcionales
    services: Joi.array().items(Joi.string().trim()).max(15),
    rates: Joi.object().pattern(Joi.string(), Joi.number().positive()),
    availability: Joi.object(),
    locationId: Joi.string(),
    premiumOnly: Joi.boolean().default(false),
    tags: Joi.array().items(Joi.string().trim()).max(10),
    
    // Campos específicos para escorts
    workingHours: Joi.object(),
    outcallAreas: Joi.array().items(Joi.string().trim()).max(10),
    incallLocation: Joi.string().max(100).trim(),
    specialRequests: Joi.string().max(500).trim()
  });

  const { error, value } = schema.validate(req.body, { 
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: false
  });

  if (error) {
    const errors = error.details.map(err => ({
      field: err.path.join('.'),
      message: getCustomErrorMessage(err),
      value: err.context?.value
    }));

    console.log('❌ ERRORES DE VALIDACIÓN EN POST:', errors);

    return next(new AppError('Errores de validación en el post', 400, 'VALIDATION_ERROR', errors));
  }

  console.log('✅ VALIDACIÓN DE POST EXITOSA');
  req.validatedData = value;
  next();
};

const validateChatMessage = (req, res, next) => {
  const schema = Joi.object({
    content: Joi.string().min(1).max(2000).trim().required(),
    messageType: Joi.string().valid('TEXT', 'IMAGE', 'FILE', 'VOICE').default('TEXT'),
    replyToId: Joi.string(),
    isPremiumMessage: Joi.boolean().default(false),
    
    // Para mensajes con ubicación
    latitude: Joi.number().min(-90).max(90),
    longitude: Joi.number().min(-180).max(180),
    locationName: Joi.string().max(100).trim()
  });

  const { error, value } = schema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(err => ({
      field: err.path.join('.'),
      message: getCustomErrorMessage(err),
      value: err.context?.value
    }));

    return next(new AppError('Error de validación en mensaje', 400, 'VALIDATION_ERROR', errors));
  }

  req.validatedData = value;
  next();
};

const validateReport = (req, res, next) => {
  const schema = Joi.object({
    reason: Joi.string().valid(
      'SPAM', 
      'INAPPROPRIATE_CONTENT', 
      'FAKE_PROFILE', 
      'SCAM', 
      'HARASSMENT', 
      'VIOLENCE', 
      'UNDERAGE', 
      'OTHER'
    ).required(),
    description: Joi.string().min(10).max(1000).trim().required(),
    evidence: Joi.array().items(Joi.string().uri()).max(5)
  });

  const { error, value } = schema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(err => ({
      field: err.path.join('.'),
      message: getCustomErrorMessage(err),
      value: err.context?.value
    }));

    return next(new AppError('Error de validación en reporte', 400, 'VALIDATION_ERROR', errors));
  }

  req.validatedData = value;
  next();
};

const validateUserSettings = (req, res, next) => {
  const schema = Joi.object({
    // Notificaciones
    emailNotifications: Joi.boolean(),
    pushNotifications: Joi.boolean(),
    messageNotifications: Joi.boolean(),
    likeNotifications: Joi.boolean(),
    boostNotifications: Joi.boolean(),
    
    // Privacidad
    showOnline: Joi.boolean(),
    showLastSeen: Joi.boolean(),
    allowDirectMessages: Joi.boolean(),
    showPhoneNumber: Joi.boolean(),
    showInDiscovery: Joi.boolean(),
    showInTrending: Joi.boolean(),
    showInSearch: Joi.boolean(),
    
    // Filtros de contenido
    contentFilter: Joi.string().valid('NONE', 'MODERATE', 'STRICT'),
    
    // Preferencias de búsqueda
    preferredAgeRange: Joi.object({
      min: Joi.number().integer().min(18).max(80),
      max: Joi.number().integer().min(18).max(80)
    }),
    preferredLocation: Joi.string().max(100),
    searchRadius: Joi.number().integer().min(1).max(100), // en km
    
    // Configuraciones de chat
    autoReplyEnabled: Joi.boolean(),
    autoReplyMessage: Joi.string().max(200).trim(),
    blockUnverifiedUsers: Joi.boolean(),
    requirePointsForMessages: Joi.boolean()
  });

  const { error, value } = schema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(err => ({
      field: err.path.join('.'),
      message: getCustomErrorMessage(err),
      value: err.context?.value
    }));

    return next(new AppError('Error de validación en configuraciones', 400, 'VALIDATION_ERROR', errors));
  }

  req.validatedData = value;
  next();
};

const validateAuth = (req, res, next) => {
  const { action } = req.params;
  
  let schema;
  
  switch (action) {
    case 'register':
      schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required(),
        firstName: Joi.string().min(2).max(50).trim().required(),
        lastName: Joi.string().min(2).max(50).trim(),
        userType: Joi.string().valid('ESCORT', 'AGENCY', 'CLIENT').required(),
        phone: Joi.string().pattern(/^\+?[1-9]\d{7,14}$/),
        termsAccepted: Joi.boolean().valid(true).required(),
        age: Joi.number().integer().min(18).max(80)
      });
      break;
      
    case 'login':
      schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required(),
        rememberMe: Joi.boolean().default(false)
      });
      break;
      
    case 'forgot-password':
      schema = Joi.object({
        email: Joi.string().email().required()
      });
      break;
      
    case 'reset-password':
      schema = Joi.object({
        token: Joi.string().required(),
        password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required()
      });
      break;
      
    case 'change-password':
      schema = Joi.object({
        currentPassword: Joi.string().required(),
        newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required()
      });
      break;
      
    default:
      return next();
  }

  const { error, value } = schema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(err => ({
      field: err.path.join('.'),
      message: getCustomErrorMessage(err),
      value: err.context?.value
    }));

    return next(new AppError('Error de validación', 400, 'VALIDATION_ERROR', errors));
  }

  req.validatedData = value;
  next();
};

// ✅ NUEVO: Validaciones para pagos
const validateBoostPayment = (req, res, next) => {
  const schema = Joi.object({
    postId: Joi.string().required().messages({
      'any.required': 'ID del post es requerido'
    }),
    pricingId: Joi.string().required().messages({
      'any.required': 'ID del pricing es requerido'
    })
  });

  const { error, value } = schema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      value: err.context?.value
    }));

    return next(new AppError('Errores de validación', 400, 'VALIDATION_ERROR', errors));
  }

  req.validatedData = value;
  next();
};

const validateVerificationPayment = (req, res, next) => {
  const schema = Joi.object({
    escortId: Joi.string().required().messages({
      'any.required': 'ID del escort es requerido'
    }),
    pricingId: Joi.string().required().messages({
      'any.required': 'ID del pricing es requerido'
    })
  });

  const { error, value } = schema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      value: err.context?.value
    }));

    return next(new AppError('Errores de validación', 400, 'VALIDATION_ERROR', errors));
  }

  req.validatedData = value;
  next();
};

const validatePointsPayment = (req, res, next) => {
  const schema = Joi.object({
    pointsPackage: Joi.string().valid('small', 'medium', 'large', 'premium').required().messages({
      'any.required': 'Paquete de puntos es requerido',
      'any.only': 'Paquete debe ser: small, medium, large o premium'
    })
  });

  const { error, value } = schema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      value: err.context?.value
    }));

    return next(new AppError('Errores de validación', 400, 'VALIDATION_ERROR', errors));
  }

  req.validatedData = value;
  next();
};

const validatePremiumPayment = (req, res, next) => {
  const schema = Joi.object({
    tier: Joi.string().valid('PREMIUM', 'VIP').required().messages({
      'any.required': 'Tier es requerido',
      'any.only': 'Tier debe ser PREMIUM o VIP'
    }),
    duration: Joi.number().integer().valid(1, 3, 6, 12).required().messages({
      'any.required': 'Duración es requerida',
      'any.only': 'Duración debe ser 1, 3, 6 o 12 meses'
    })
  });

  const { error, value } = schema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      value: err.context?.value
    }));

    return next(new AppError('Errores de validación', 400, 'VALIDATION_ERROR', errors));
  }

  req.validatedData = value;
  next();
};

// ✅ NUEVA FUNCIÓN: validateUser - LA QUE FALTABA
const validateUser = (req, res, next) => {
  console.log('🔍 VALIDANDO USUARIO:', {
    userId: req.user?.id,
    userType: req.user?.userType,
    isActive: req.user?.isActive
  });

  // Verificar que el usuario esté presente (authenticate debe ejecutarse antes)
  if (!req.user || !req.user.id) {
    console.log('❌ Usuario no válido o no autenticado');
    return next(new AppError('Usuario no válido o no autenticado', 401, 'INVALID_USER'));
  }
  
  // Verificar que el usuario esté activo
  if (req.user.isActive === false) {
    console.log('❌ Usuario inactivo:', req.user.id);
    return next(new AppError('Usuario inactivo', 403, 'USER_INACTIVE'));
  }

  // Verificar que el usuario tenga un tipo válido
  const validUserTypes = ['ESCORT', 'AGENCY', 'CLIENT', 'ADMIN'];
  if (!validUserTypes.includes(req.user.userType)) {
    console.log('❌ Tipo de usuario inválido:', req.user.userType);
    return next(new AppError('Tipo de usuario inválido', 403, 'INVALID_USER_TYPE'));
  }

  console.log('✅ Usuario válido:', req.user.username || req.user.id);
  next();
};

// ✅ HELPER: Mensajes de error personalizados - MEJORADO
const getCustomErrorMessage = (error) => {
  const { type, context } = error;
  
  switch (type) {
    case 'string.email':
      return 'Debe ser un email válido';
    case 'string.min':
      return `Debe tener al menos ${context.limit} caracteres`;
    case 'string.max':
      return `No puede exceder ${context.limit} caracteres`;
    case 'string.pattern.base':
      if (context.key === 'password') {
        return 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número';
      }
      if (context.key === 'phone') {
        return 'Debe ser un número de teléfono válido';
      }
      return 'Formato no válido';
    case 'number.base':
      return 'Debe ser un número válido';
    case 'number.integer':
      return 'Debe ser un número entero';
    case 'number.min':
      return `Debe ser mayor o igual a ${context.limit}`;
    case 'number.max':
      return `Debe ser menor o igual a ${context.limit}`;
    case 'number.positive':
      return 'Debe ser un número positivo';
    case 'array.base':
      return 'Debe ser una lista/array';
    case 'array.max':
      return `No puede tener más de ${context.limit} elementos`;
    case 'object.base':
      return 'Debe ser un objeto válido';
    case 'any.required':
      return 'Este campo es requerido';
    case 'any.only':
      return `El valor debe ser uno de: ${context.valids.join(', ')}`;
    case 'string.uri':
      return 'Debe ser una URL válida';
    default:
      return error.message;
  }
};

// ✅ HELPER: Validación de ID de MongoDB/Prisma
const validateId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    // Validar formato de ID (ajustar según tu implementación)
    if (!id || typeof id !== 'string' || !/^c[a-z0-9]{24,25}$/.test(id)) {
      return next(new AppError('ID inválido', 400, 'INVALID_ID'));
    }
    
    next();
  };
};

// ✅ HELPER: Validación de archivos
const validateFileUpload = (options = {}) => {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB por defecto
    allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
    maxFiles = 1,
    required = false
  } = options;

  return (req, res, next) => {
    if (!req.files && !req.file) {
      if (required) {
        return next(new AppError('Se requiere al menos un archivo', 400, 'FILE_REQUIRED'));
      }
      return next();
    }

    const files = req.files || (req.file ? [req.file] : []);
    
    if (files.length > maxFiles) {
      return next(new AppError(`Máximo ${maxFiles} archivo(s) permitido(s)`, 400, 'TOO_MANY_FILES'));
    }

    for (const file of files) {
      if (file.size > maxSize) {
        const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
        return next(new AppError(`Archivo muy grande. Máximo: ${maxSizeMB}MB`, 400, 'FILE_TOO_LARGE'));
      }

      if (!allowedTypes.includes(file.mimetype)) {
        return next(new AppError(`Tipo de archivo no permitido. Tipos válidos: ${allowedTypes.join(', ')}`, 400, 'INVALID_FILE_TYPE'));
      }
    }

    next();
  };
};

// ✅ EXPORTS CORREGIDOS - TODAS LAS FUNCIONES INCLUIDAS
module.exports = {
  // Funciones de auth
  validateRegistration,   
  validateLogin,          
  validatePasswordReset,  
  
  // Funciones de pagos
  validateBoostPayment,
  validateVerificationPayment,
  validatePointsPayment,
  validatePremiumPayment,
  
  // Funciones principales
  validateUpdateProfile,  
  validatePagination,     
  validateCreatePost,     
  validateChatMessage,    
  validateReport,         
  validateUserSettings,   
  validateAuth,           
  validateId,             
  validateFileUpload,     
  getCustomErrorMessage,
  validateUser            // ✅ FUNCIÓN QUE FALTABA - AGREGADA
};