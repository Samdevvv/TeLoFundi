const Joi = require('joi');
const { AppError } = require('./errorHandler');
const logger = require('../utils/logger');

// ============================================================================
// 🔍 VALIDACIONES DE AUTENTICACIÓN (SIMPLIFICADAS) - CON businessLicense OPCIONAL
// ============================================================================

// ✅ VALIDACIÓN DE REGISTRO SIMPLIFICADA - Con businessLicense opcional
const validateRegistration = (req, res, next) => {
  console.log('🔍 VALIDANDO REGISTRO SIMPLIFICADO:', Object.keys(req.body));

  const { userType } = req.body;
  const isAgency = userType === 'AGENCY';

  // ✅ SCHEMA SIMPLIFICADO - Solo campos esenciales - CON businessLicense opcional
  const baseSchema = {
    email: Joi.string().email().required().messages({
      'string.email': 'Debe ser un email válido',
      'any.required': 'El email es requerido'
    }),
    firstName: Joi.string().min(2).max(50).trim().required().messages({
      'string.min': 'El nombre debe tener al menos 2 caracteres',
      'string.max': 'El nombre no puede exceder 50 caracteres',
      'any.required': 'El nombre es requerido'
    }),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
      'string.min': 'La contraseña debe tener al menos 8 caracteres',
      'string.pattern.base': 'La contraseña debe tener al menos una mayúscula, una minúscula y un número',
      'any.required': 'La contraseña es requerida'
    }),
    userType: Joi.string().valid('ESCORT', 'AGENCY', 'CLIENT').required().messages({
      'any.only': 'El tipo de usuario debe ser ESCORT, AGENCY o CLIENT',
      'any.required': 'El tipo de usuario es requerido'
    }),
    
    // ✅ SOLO PARA AGENCIAS - Campos obligatorios si userType es AGENCY - CON businessLicense opcional
    ...(isAgency && {
      companyName: Joi.string().min(2).max(100).trim().required().messages({
        'string.min': 'El nombre de la empresa debe tener al menos 2 caracteres',
        'string.max': 'El nombre de la empresa no puede exceder 100 caracteres',
        'any.required': 'El nombre de la empresa es requerido para agencias'
      }),
      contactPerson: Joi.string().min(2).max(100).trim().required().messages({
        'string.min': 'El nombre de contacto debe tener al menos 2 caracteres',
        'string.max': 'El nombre de contacto no puede exceder 100 caracteres',
        'any.required': 'El nombre de la persona de contacto es requerido para agencias'
      }),
      address: Joi.string().min(10).max(200).trim().required().messages({
        'string.min': 'La dirección debe tener al menos 10 caracteres',
        'string.max': 'La dirección no puede exceder 200 caracteres',
        'any.required': 'La dirección es requerida para agencias'
      }),
      // ✅ AGREGAR businessLicense como campo opcional
      businessLicense: Joi.string().trim().optional().messages({
        'string.base': 'La licencia de negocio debe ser texto'
      })
    })
  };

  const schema = Joi.object(baseSchema);

  const { error, value } = schema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: true,
    allowUnknown: false,
    convert: true
  });

  if (error) {
    const errors = error.details.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      value: err.context?.value
    }));

    console.log('❌ ERRORES DE VALIDACIÓN DE REGISTRO SIMPLIFICADO:', errors);
    return next(new AppError('Errores de validación', 400, 'VALIDATION_ERROR', errors));
  }

  console.log('✅ VALIDACIÓN DE REGISTRO SIMPLIFICADO EXITOSA');
  req.validatedData = value;
  next();
};

// ✅ VALIDACIÓN ESPECÍFICA PARA LOGIN - Sin cambios
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

// ✅ VALIDACIÓN PARA PASSWORD RESET - Sin cambios
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

// ✅ VALIDACIÓN ESPECÍFICA PARA AGENCIAS (middleware adicional) - CON businessLicense opcional
const validateAgencyRegistration = (req, res, next) => {
  console.log('🏢 VALIDACIÓN ADICIONAL PARA AGENCIAS');

  // Verificar que el userType sea AGENCY
  if (req.body.userType !== 'AGENCY') {
    return next(new AppError('Esta validación es solo para agencias', 400, 'INVALID_USER_TYPE'));
  }

  // Verificar que se hayan subido archivos de cédula (después del middleware de upload)
  if (!req.uploadedFiles || !req.uploadedFiles.cedulaFrente || !req.uploadedFiles.cedulaTrasera) {
    console.log('❌ ARCHIVOS DE CÉDULA FALTANTES:', {
      hasUploadedFiles: !!req.uploadedFiles,
      hasCedulaFrente: !!req.uploadedFiles?.cedulaFrente,
      hasCedulaTrasera: !!req.uploadedFiles?.cedulaTrasera
    });
    
    return next(new AppError(
      'Se requieren fotos de la cédula (frente y trasera) para el registro de agencias', 
      400, 
      'CEDULA_PHOTOS_REQUIRED'
    ));
  }

  // Verificar que las URLs de cédula sean válidas
  const cedulaFrente = req.uploadedFiles.cedulaFrente?.[0]?.secure_url;
  const cedulaTrasera = req.uploadedFiles.cedulaTrasera?.[0]?.secure_url;

  if (!cedulaFrente || !cedulaTrasera) {
    console.log('❌ URLs DE CÉDULA INVÁLIDAS:', {
      cedulaFrente: !!cedulaFrente,
      cedulaTrasera: !!cedulaTrasera
    });
    
    return next(new AppError(
      'Error procesando las fotos de cédula. Intenta nuevamente.', 
      500, 
      'CEDULA_UPLOAD_ERROR'
    ));
  }

  console.log('✅ VALIDACIÓN DE AGENCIA EXITOSA - Documentos válidos');
  next();
};

// ============================================================================
// 💰 NUEVAS VALIDACIONES PARA SISTEMA DE PUNTOS TELOFUNDI
// ============================================================================

// ✅ VALIDACIÓN PARA COMPRA DE PUNTOS
const validatePointsPurchase = (req, res, next) => {
  console.log('💰 VALIDANDO COMPRA DE PUNTOS:', req.body);

  const schema = Joi.object({
    packageId: Joi.string().required().messages({
      'any.required': 'ID del paquete de puntos es requerido',
      'string.empty': 'ID del paquete no puede estar vacío'
    }),
    
    // Campos opcionales para metadata
    paymentMethod: Joi.string().valid('card', 'paypal').optional(),
    couponCode: Joi.string().max(20).trim().optional(),
    platform: Joi.string().valid('web', 'mobile', 'desktop').optional()
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

    console.log('❌ ERRORES EN VALIDACIÓN DE COMPRA DE PUNTOS:', errors);
    return next(new AppError('Error en datos de compra de puntos', 400, 'VALIDATION_ERROR', errors));
  }

  console.log('✅ VALIDACIÓN DE COMPRA DE PUNTOS EXITOSA');
  req.validatedData = value;
  next();
};

// ✅ VALIDACIÓN PARA GASTAR PUNTOS
const validatePointsSpend = (req, res, next) => {
  console.log('💸 VALIDANDO GASTO DE PUNTOS:', req.body);

  const schema = Joi.object({
    action: Joi.string().valid(
      'phone_access',
      'image_message', 
      'extra_favorite',
      'profile_boost',
      'chat_priority'
    ).required().messages({
      'any.required': 'Acción es requerida',
      'any.only': 'Acción debe ser: phone_access, image_message, extra_favorite, profile_boost, o chat_priority'
    }),
    
    targetData: Joi.object({
      // Para phone_access
      targetUserId: Joi.string().when('..action', {
        is: 'phone_access',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      username: Joi.string().max(50).optional(),
      
      // Para image_message
      chatId: Joi.string().when('..action', {
        is: 'image_message',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      
      // Para profile_boost
      boostType: Joi.string().valid('basic', 'premium', 'featured').when('..action', {
        is: 'profile_boost',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      duration: Joi.number().integer().min(1).max(72).when('..action', {
        is: 'profile_boost',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      
      // Para chat_priority
      priorityLevel: Joi.string().valid('normal', 'high', 'urgent').when('..action', {
        is: 'chat_priority',
        then: Joi.optional(),
        otherwise: Joi.forbidden()
      }),
      
      // Metadata general
      reason: Joi.string().max(200).trim().optional(),
      source: Joi.string().max(50).optional()
    }).default({}).optional(),
    
    confirmAction: Joi.boolean().default(false)
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

    console.log('❌ ERRORES EN VALIDACIÓN DE GASTO DE PUNTOS:', errors);
    return next(new AppError('Error en datos de gasto de puntos', 400, 'VALIDATION_ERROR', errors));
  }

  console.log('✅ VALIDACIÓN DE GASTO DE PUNTOS EXITOSA');
  req.validatedData = value;
  next();
};

// ✅ VALIDACIÓN PARA ACTIVACIÓN DE PREMIUM CON PUNTOS
const validatePremiumActivation = (req, res, next) => {
  console.log('⭐ VALIDANDO ACTIVACIÓN DE PREMIUM:', req.body);

  const schema = Joi.object({
    tier: Joi.string().valid('PREMIUM', 'VIP').required().messages({
      'any.required': 'Tier de premium es requerido',
      'any.only': 'Tier debe ser PREMIUM o VIP'
    }),
    
    duration: Joi.number().integer().min(1).max(168).default(24).messages({
      'number.base': 'Duración debe ser un número',
      'number.integer': 'Duración debe ser un número entero',
      'number.min': 'Duración mínima es 1 hora',
      'number.max': 'Duración máxima es 168 horas (7 días)'
    }),
    
    confirmCost: Joi.boolean().default(false),
    source: Joi.string().valid('mobile', 'web', 'desktop').optional()
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

    console.log('❌ ERRORES EN VALIDACIÓN DE ACTIVACIÓN PREMIUM:', errors);
    return next(new AppError('Error en datos de activación premium', 400, 'VALIDATION_ERROR', errors));
  }

  console.log('✅ VALIDACIÓN DE ACTIVACIÓN PREMIUM EXITOSA');
  req.validatedData = value;
  next();
};

// ✅ VALIDACIÓN PARA AJUSTES ADMINISTRATIVOS DE PUNTOS
const validateAdminPointsAdjustment = (req, res, next) => {
  console.log('🛠️ VALIDANDO AJUSTE ADMIN DE PUNTOS:', req.body);

  const schema = Joi.object({
    clientId: Joi.string().required().messages({
      'any.required': 'ID del cliente es requerido',
      'string.empty': 'ID del cliente no puede estar vacío'
    }),
    
    amount: Joi.number().integer().min(-10000).max(10000).not(0).required().messages({
      'any.required': 'Cantidad de puntos es requerida',
      'number.base': 'Cantidad debe ser un número',
      'number.integer': 'Cantidad debe ser un número entero',
      'number.min': 'Cantidad mínima es -10,000 puntos',
      'number.max': 'Cantidad máxima es 10,000 puntos',
      'any.invalid': 'La cantidad no puede ser 0'
    }),
    
    reason: Joi.string().min(5).max(200).trim().required().messages({
      'any.required': 'Razón del ajuste es requerida',
      'string.min': 'La razón debe tener al menos 5 caracteres',
      'string.max': 'La razón no puede exceder 200 caracteres'
    }),
    
    category: Joi.string().valid(
      'correction',
      'compensation', 
      'penalty',
      'bonus',
      'refund',
      'technical_issue',
      'customer_service'
    ).optional(),
    
    notifyClient: Joi.boolean().default(true),
    internalNotes: Joi.string().max(500).trim().optional()
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

    console.log('❌ ERRORES EN VALIDACIÓN DE AJUSTE ADMIN:', errors);
    return next(new AppError('Error en datos de ajuste administrativo', 400, 'VALIDATION_ERROR', errors));
  }

  console.log('✅ VALIDACIÓN DE AJUSTE ADMIN EXITOSA');
  req.validatedData = value;
  next();
};

// ============================================================================
// 🔄 VALIDACIONES ACTUALIZADAS PARA SISTEMA EXISTENTE
// ============================================================================

// ✅ VALIDACIÓN DE ACTUALIZACIÓN DE PERFIL - Ahora incluye campos que se dejaron vacíos en registro
const validateUpdateProfile = (req, res, next) => {
  console.log('🔍 VALIDANDO ACTUALIZACIÓN DE PERFIL:', req.body);
  console.log('🔍 TAMAÑO DEL BODY:', Object.keys(req.body).length, 'campos');
  console.log('🔍 CAMPOS RECIBIDOS:', Object.keys(req.body));

  const schema = Joi.object({
    // ✅ CAMPOS QUE AHORA SE PUEDEN COMPLETAR EN EL PERFIL
    firstName: Joi.string().min(2).max(50).trim().messages({
      'string.min': 'El nombre debe tener al menos 2 caracteres',
      'string.max': 'El nombre no puede exceder 50 caracteres'
    }),
    lastName: Joi.string().min(2).max(50).trim().allow('').messages({
      'string.min': 'El apellido debe tener al menos 2 caracteres'
    }),
    username: Joi.string().min(3).max(30).alphanum().messages({
      'string.min': 'El username debe tener al menos 3 caracteres',
      'string.max': 'El username no puede exceder 30 caracteres',
      'string.alphanum': 'El username solo puede contener letras y números'
    }),
    bio: Joi.string().max(500).trim().allow('', null).messages({
      'string.max': 'La descripción no puede exceder 500 caracteres'
    }),
    phone: Joi.string().pattern(/^\+?[1-9]\d{7,14}$/).allow('', null).messages({
      'string.pattern.base': 'Debe ser un número de teléfono válido'
    }),
    website: Joi.string().uri().allow('', null).messages({
      'string.uri': 'Debe ser una URL válida'
    }),
    locationId: Joi.string().allow('', null),
    
    // ✅ CAMPOS ESPECÍFICOS PARA ESCORTS con validaciones mejoradas
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
    bodyType: Joi.string().valid('SLIM', 'ATHLETIC', 'CURVY', 'FULL_FIGURED', 'MUSCULAR').allow('', null).messages({
      'any.only': 'Tipo de cuerpo inválido'
    }),
    ethnicity: Joi.string().valid('LATINA', 'CAUCASIAN', 'AFRO', 'ASIAN', 'MIXED', 'OTHER').allow('', null).messages({
      'any.only': 'Etnia inválida'
    }),
    hairColor: Joi.string().valid('BLACK', 'BROWN', 'BLONDE', 'RED', 'OTHER').allow('', null).messages({
      'any.only': 'Color de cabello inválido'
    }),
    eyeColor: Joi.string().valid('BROWN', 'BLUE', 'GREEN', 'HAZEL', 'BLACK', 'GRAY').allow('', null).messages({
      'any.only': 'Color de ojos inválido'
    }),
    
    // ✅ ARRAYS: Validar correctamente servicios, idiomas, etc.
    services: Joi.alternatives().try(
      Joi.string().max(1000).trim().allow('', null), // String libre según especificaciones
      Joi.array().items(Joi.string().trim().min(1)).max(20)
    ).messages({
      'string.max': 'Los servicios no pueden exceder 1000 caracteres',
      'array.max': 'Máximo 20 servicios permitidos'
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
      timezone: Joi.string().allow('', null)
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
    aboutMe: Joi.string().max(1000).trim().allow('', null).messages({
      'string.max': 'La descripción "Sobre mí" no puede exceder 1000 caracteres'
    }),
    education: Joi.string().max(200).trim().allow('', null).messages({
      'string.max': 'La educación no puede exceder 200 caracteres'
    }),
    incallLocation: Joi.string().max(100).trim().allow('', null).messages({
      'string.max': 'La ubicación incall no puede exceder 100 caracteres'
    }),
    
    // ✅ ENUMS
    experience: Joi.string().valid('NEW', 'BEGINNER', 'INTERMEDIATE', 'EXPERIENCED', 'EXPERT').allow('', null).messages({
      'any.only': 'Nivel de experiencia inválido'
    }),
    preferredClientType: Joi.string().valid('EXECUTIVES', 'TOURISTS', 'REGULARS', 'COUPLES', 'ANY').allow('', null).messages({
      'any.only': 'Tipo de cliente preferido inválido'
    })
  });

  const { error, value } = schema.validate(req.body, { 
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true,
    convert: true
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

// ✅ VALIDACIÓN DE PAGINACIÓN - Actualizada con más filtros
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
    status: Joi.string().valid('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED', 'active', 'inactive', 'pending', 'draft', 'rejected'),
    
    sortBy: Joi.string().valid(
      'recent',
      'relevance', 
      'newest', 
      'oldest', 
      'popular', 
      'rating',
      'createdAt',
      'updatedAt',
      'views',
      'likes',
      'points', // ✅ NUEVO: Para ordenar por puntos
      'streak', // ✅ NUEVO: Para ordenar por racha
      'amount'  // ✅ NUEVO: Para ordenar por monto
    ).default('recent'),
    
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    q: Joi.string().trim(),
    
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
    premiumOnly: Joi.boolean(),
    
    // ✅ NUEVOS: Filtros específicos para puntos
    type: Joi.string().valid(
      'PURCHASE', 'BONUS_POINTS', 'DAILY_LOGIN', 'REGISTRATION_BONUS', 
      'REFERRAL_REWARD', 'STREAK_BONUS', 'PREMIUM_DAY', 'CHAT_PRIORITY', 
      'EXTRA_FAVORITE', 'PROFILE_BOOST', 'PHONE_ACCESS', 'IMAGE_MESSAGE',
      'REFUND', 'ADMIN_ADJUSTMENT', 'EXPIRED_PREMIUM'
    ),
    minPoints: Joi.number().integer().min(0),
    maxPoints: Joi.number().integer().min(0),
    timeframe: Joi.string().valid('24h', '7d', '30d', '90d', '1y').default('30d'),
    
    // Filtros específicos para chat
    includeDisputes: Joi.boolean().default(false),
    archived: Joi.boolean().default(false)
  });

  const { error, value } = schema.validate(req.query, { 
    abortEarly: false,
    stripUnknown: true,
    convert: true
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

// ============================================================================
// 🔄 VALIDACIONES ORIGINALES MANTENIDAS
// ============================================================================

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
    services: Joi.alternatives().try(
      Joi.string().max(1000).trim().allow('', null), // String libre
      Joi.array().items(Joi.string().trim()).max(15)
    ),
    rates: Joi.object().pattern(Joi.string(), Joi.number().positive()),
    availability: Joi.object(),
    locationId: Joi.string().allow('', null),
    premiumOnly: Joi.boolean().default(false),
    tags: Joi.array().items(Joi.string().trim()).max(10),
    
    // Campos específicos para escorts
    workingHours: Joi.object(),
    outcallAreas: Joi.array().items(Joi.string().trim()).max(10),
    incallLocation: Joi.string().max(100).trim().allow('', null),
    specialRequests: Joi.string().max(500).trim().allow('', null)
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

// ✅ VALIDACIÓN ESPECÍFICA PARA MENSAJES DE CHAT
const validateChatMessage = (req, res, next) => {
  const schema = Joi.object({
    content: Joi.string().min(1).max(5000).trim().when('messageType', {
      is: Joi.valid('TEXT'),
      then: Joi.required(),
      otherwise: Joi.optional()
    }).messages({
      'string.min': 'El mensaje no puede estar vacío',
      'string.max': 'El mensaje no puede exceder 5000 caracteres',
      'any.required': 'El contenido del mensaje es requerido para mensajes de texto'
    }),
    messageType: Joi.string().valid('TEXT', 'IMAGE', 'FILE', 'AUDIO', 'VIDEO', 'LOCATION', 'CONTACT').default('TEXT'),
    replyToId: Joi.string().allow('', null).optional(),
    
    // ✅ NUEVO: Soporte para mensajes premium
    isPremiumMessage: Joi.boolean().default(false),
    usePoints: Joi.boolean().default(false), // Si usar puntos para enviar
    
    // Para mensajes con ubicación
    latitude: Joi.number().min(-90).max(90).when('messageType', {
      is: 'LOCATION',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    longitude: Joi.number().min(-180).max(180).when('messageType', {
      is: 'LOCATION',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    locationName: Joi.string().max(100).trim().allow('', null).optional()
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

// ============================================================================
// 💳 VALIDACIONES DE PAGOS ACTUALIZADAS
// ============================================================================

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

// ✅ ACTUALIZADA: Validación para pagos premium
const validatePremiumPayment = (req, res, next) => {
  const schema = Joi.object({
    tier: Joi.string().valid('PREMIUM', 'VIP').required().messages({
      'any.required': 'Tier es requerido',
      'any.only': 'Tier debe ser PREMIUM o VIP'
    }),
    duration: Joi.number().integer().valid(1, 3, 6, 12).required().messages({
      'any.required': 'Duración es requerida',
      'any.only': 'Duración debe ser 1, 3, 6 o 12 meses'
    }),
    
    // ✅ NUEVO: Soporte para compra con puntos vs dinero
    paymentMethod: Joi.string().valid('stripe', 'points').default('stripe'),
    confirmCost: Joi.boolean().default(false)
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

const validateUserSettings = (req, res, next) => {
  const schema = Joi.object({
    // Notificaciones
    emailNotifications: Joi.boolean().optional(),
    pushNotifications: Joi.boolean().optional(),
    messageNotifications: Joi.boolean().optional(),
    likeNotifications: Joi.boolean().optional(),
    boostNotifications: Joi.boolean().optional(),
    profileReminders: Joi.boolean().optional(), // ✅ NUEVO
    verificationReminders: Joi.boolean().optional(), // ✅ NUEVO
    
    // Privacidad
    showOnline: Joi.boolean().optional(),
    showLastSeen: Joi.boolean().optional(),
    allowDirectMessages: Joi.boolean().optional(),
    showPhoneNumber: Joi.boolean().optional(),
    showInDiscovery: Joi.boolean().optional(),
    showInTrending: Joi.boolean().optional(),
    showInSearch: Joi.boolean().optional(),
    
    // Filtros de contenido
    contentFilter: Joi.string().valid('NONE', 'MODERATE', 'STRICT').optional(),
    
    // ✅ NUEVAS: Configuraciones específicas para clientes
    pointsNotifications: Joi.boolean().optional(), // Notificaciones de puntos
    dailyLoginReminders: Joi.boolean().optional(), // Recordatorios de login diario
    premiumExpiryNotifications: Joi.boolean().optional(), // Notificaciones de expiración premium
    lowPointsWarning: Joi.boolean().optional(), // Aviso cuando quedan pocos puntos
    
    // Preferencias de búsqueda
    preferredAgeRange: Joi.object({
      min: Joi.number().integer().min(18).max(80),
      max: Joi.number().integer().min(18).max(80)
    }).optional(),
    preferredLocation: Joi.string().max(100).allow('', null).optional(),
    searchRadius: Joi.number().integer().min(1).max(100).optional(),
    
    // Configuraciones de chat
    autoReplyEnabled: Joi.boolean().optional(),
    autoReplyMessage: Joi.string().max(200).trim().allow('', null).optional(),
    blockUnverifiedUsers: Joi.boolean().optional(),
    requirePointsForMessages: Joi.boolean().optional()
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
      // ✅ SCHEMA SIMPLIFICADO PARA REGISTRO
      schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required(),
        firstName: Joi.string().min(2).max(50).trim().required(),
        userType: Joi.string().valid('ESCORT', 'AGENCY', 'CLIENT').required()
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

// ============================================================================
// 🔧 UTILIDADES Y HELPERS
// ============================================================================

// ✅ FUNCIÓN validateUser - Sin cambios
const validateUser = (req, res, next) => {
  console.log('🔍 VALIDANDO USUARIO:', {
    userId: req.user?.id,
    userType: req.user?.userType,
    isActive: req.user?.isActive
  });

  if (!req.user || !req.user.id) {
    console.log('❌ Usuario no válido o no autenticado');
    return next(new AppError('Usuario no válido o no autenticado', 401, 'INVALID_USER'));
  }
  
  if (req.user.isActive === false) {
    console.log('❌ Usuario inactivo:', req.user.id);
    return next(new AppError('Usuario inactivo', 403, 'USER_INACTIVE'));
  }

  const validUserTypes = ['ESCORT', 'AGENCY', 'CLIENT', 'ADMIN'];
  if (!validUserTypes.includes(req.user.userType)) {
    console.log('❌ Tipo de usuario inválido:', req.user.userType);
    return next(new AppError('Tipo de usuario inválido', 403, 'INVALID_USER_TYPE'));
  }

  console.log('✅ Usuario válido:', req.user.username || req.user.id);
  next();
};

// ✅ HELPER: Mensajes de error personalizados - ACTUALIZADO CON NUEVOS CASOS
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
    case 'any.invalid':
      if (context.invalids && context.invalids.includes(0)) {
        return 'El valor no puede ser 0';
      }
      return 'Valor inválido';
    case 'string.uri':
      return 'Debe ser una URL válida';
    case 'date.format':
      return 'Formato de fecha inválido';
    case 'date.greater':
      return 'La fecha debe ser futura';
    case 'date.min':
      return 'La fecha debe ser posterior a la fecha de inicio';
    case 'alternatives.match':
      return 'El formato proporcionado no es válido';
    default:
      return error.message;
  }
};

// ✅ HELPER: Validación de ID de MongoDB/Prisma
const validateId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!id || typeof id !== 'string' || !/^c[a-z0-9]{24,25}$/.test(id)) {
      return next(new AppError('ID inválido', 400, 'INVALID_ID'));
    }
    
    next();
  };
};

// ✅ HELPER: Validación específica para clientes (solo para rutas de puntos)
const validateClientOnly = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Usuario no autenticado', 401, 'UNAUTHENTICATED'));
  }

  if (req.user.userType !== 'CLIENT') {
    return next(new AppError('Esta función es solo para clientes', 403, 'CLIENT_ONLY'));
  }

  if (!req.user.client) {
    return next(new AppError('Datos de cliente no encontrados', 500, 'CLIENT_DATA_MISSING'));
  }

  next();
};

// ✅ HELPER: Validación específica para administradores
const validateAdminOnly = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Usuario no autenticado', 401, 'UNAUTHENTICATED'));
  }

  if (req.user.userType !== 'ADMIN') {
    return next(new AppError('Esta función es solo para administradores', 403, 'ADMIN_ONLY'));
  }

  next();
};

// ============================================================================
// 📤 EXPORTS COMPLETOS - TODAS LAS FUNCIONES INCLUIDAS
// ============================================================================

module.exports = {
  // ✅ Funciones de auth SIMPLIFICADAS - CON businessLicense opcional
  validateRegistration,   
  validateAgencyRegistration,
  validateLogin,          
  validatePasswordReset,  
  
  // ✅ NUEVAS: Funciones específicas para sistema de puntos
  validatePointsPurchase,
  validatePointsSpend,
  validatePremiumActivation,
  validateAdminPointsAdjustment,
  
  // Funciones de pagos ACTUALIZADAS
  validateBoostPayment,
  validateVerificationPayment,
  validatePremiumPayment,
  
  // Funciones principales ACTUALIZADAS
  validateUpdateProfile,  
  validatePagination,     
  validateCreatePost,     
  validateUserSettings,   
  validateAuth,           
  validateUser,
  validateChatMessage,
  
  // ✅ NUEVOS: Helpers específicos
  validateId,             
  validateClientOnly,
  validateAdminOnly,
  getCustomErrorMessage
};