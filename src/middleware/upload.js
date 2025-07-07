const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const sharp = require('sharp');
const { uploadToCloudinary, uploadMultipleToCloudinary, deleteFromCloudinary } = require('../services/uploadService');
const logger = require('../utils/logger');

// ============================================================================
// 🔧 CONFIGURACIONES BASE Y VALIDACIONES - COMPLETAS
// ============================================================================

// Configuración de tipos de archivos permitidos
const allowedFileTypes = {
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  documents: ['.pdf', '.doc', '.docx', '.txt'],
  all: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.txt']
};

// Configuración de límites de tamaño por tipo - OPTIMIZADA
const fileSizeLimits = {
  avatar: 3 * 1024 * 1024,      // 3MB para avatares
  post: 8 * 1024 * 1024,        // 8MB para imágenes de posts
  chat: 5 * 1024 * 1024,        // 5MB para imágenes de chat
  agency: 5 * 1024 * 1024,      // 5MB para documentos de agencia
  document: 10 * 1024 * 1024,   // 10MB para documentos
  default: 5 * 1024 * 1024      // 5MB por defecto
};

// Crear directorios si no existen (solo para desarrollo local)
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.info('Directory created', { path: dirPath });
  }
};

// ============================================================================
// 📦 CONFIGURACIÓN DE STORAGE - COMPLETA
// ============================================================================

// Configuración de almacenamiento local (solo para desarrollo)
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath;
    
    // Determinar carpeta según el tipo de archivo
    if (file.fieldname === 'avatar') {
      uploadPath = path.join(__dirname, '../../imagenes/avatars');
    } else if (file.fieldname === 'images' || file.fieldname === 'postImages') {
      uploadPath = path.join(__dirname, '../../imagenes/posts');
    } else if (file.fieldname === 'cedulaFrente' || file.fieldname === 'cedulaTrasera') {
      uploadPath = path.join(__dirname, '../../imagenes/agency');
    } else if (file.fieldname === 'documents') {
      uploadPath = path.join(__dirname, '../../imagenes/documents');
    } else if (file.fieldname === 'chatImage') {
      uploadPath = path.join(__dirname, '../../imagenes/chat');
    } else {
      uploadPath = path.join(__dirname, '../../imagenes/temp');
    }
    
    // Asegurar que el directorio existe
    ensureDirectoryExists(uploadPath);
    
    cb(null, uploadPath);
  },
  
  filename: (req, file, cb) => {
    // Generar nombre único para el archivo
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const timestamp = Date.now();
    
    // Formato: timestamp_uniqueId_fieldname_originalName.ext
    const fileName = `${timestamp}_${uniqueSuffix}_${file.fieldname}${fileExtension}`;
    
    cb(null, fileName);
  }
});

// Configuración de almacenamiento en memoria (para Cloudinary) - SIEMPRE USAR EN PRODUCCIÓN
const memoryStorage = multer.memoryStorage();

// Función para determinar el storage según el entorno
const getStorage = () => {
  // En producción o cuando Cloudinary está configurado, usar memory storage
  if (process.env.NODE_ENV === 'production' || process.env.CLOUDINARY_CLOUD_NAME) {
    return memoryStorage;
  }
  return localStorage;
};

// ============================================================================
// 🔍 FILTROS DE ARCHIVOS MEJORADOS - COMPLETOS
// ============================================================================

// Filtro de archivos mejorado y específico por tipo
const createFileFilter = (allowedTypes = 'all', specificMimes = null) => {
  return (req, file, cb) => {
    console.log('🔍 File filter - Processing file:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      allowedTypes,
      specificMimes
    });

    const fileExtension = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();
    
    // ✅ VALIDACIONES ESPECÍFICAS PARA AGENCIAS - MEJORADAS
    if (file.fieldname === 'cedulaFrente' || file.fieldname === 'cedulaTrasera') {
      const agencyAllowedMimes = ['image/jpeg', 'image/jpg', 'image/png'];
      const agencyAllowedExts = ['.jpg', '.jpeg', '.png'];
      
      // Verificar MIME type
      if (!agencyAllowedMimes.includes(mimeType)) {
        console.log('❌ Tipo MIME no permitido para cédula:', mimeType);
        const error = new Error(`Solo se permiten imágenes JPG, JPEG o PNG para documentos de cédula. Recibido: ${mimeType}`);
        error.code = 'INVALID_CEDULA_TYPE';
        return cb(error, false);
      }
      
      // Verificar extensión
      if (!agencyAllowedExts.includes(fileExtension)) {
        console.log('❌ Extensión no permitida para cédula:', fileExtension);
        const error = new Error(`Solo se permiten archivos .jpg, .jpeg o .png para documentos de cédula. Recibido: ${fileExtension}`);
        error.code = 'INVALID_CEDULA_EXT';
        return cb(error, false);
      }
      
      // Validar tamaño específico para cédulas (máximo 5MB)
      if (file.size && file.size > fileSizeLimits.agency) {
        console.log('❌ Archivo de cédula muy grande:', file.size);
        const error = new Error(`El archivo de cédula es muy grande. Máximo: ${Math.round(fileSizeLimits.agency / 1024 / 1024)}MB`);
        error.code = 'CEDULA_TOO_LARGE';
        return cb(error, false);
      }
      
      console.log('✅ Archivo de cédula válido:', file.fieldname);
      return cb(null, true);
    }
    
    // ✅ VALIDACIONES ESPECÍFICAS PARA POSTS - AÑADIDAS
    if (file.fieldname === 'images' || file.fieldname === 'postImages') {
      const postAllowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      const postAllowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      
      if (!postAllowedMimes.includes(mimeType)) {
        const error = new Error(`Tipo de imagen no permitido para posts: ${mimeType}. Permitidos: JPG, PNG, WebP, GIF`);
        error.code = 'INVALID_POST_IMAGE_TYPE';
        return cb(error, false);
      }
      
      if (!postAllowedExts.includes(fileExtension)) {
        const error = new Error(`Extensión no permitida para posts: ${fileExtension}`);
        error.code = 'INVALID_POST_IMAGE_EXT';
        return cb(error, false);
      }
      
      console.log('✅ Imagen de post válida:', file.fieldname);
      return cb(null, true);
    }
    
    // Usar MIME types específicos si se proporcionan
    if (specificMimes) {
      if (!specificMimes.includes(mimeType)) {
        console.log('❌ Tipo MIME no permitido:', mimeType);
        const error = new Error(`Tipo de archivo no permitido: ${mimeType}`);
        error.code = 'INVALID_MIME_TYPE';
        return cb(error, false);
      }
      console.log('✅ Archivo válido por MIME específico:', file.fieldname);
      return cb(null, true);
    }
    
    // Verificar extensión
    const allowedExtensions = allowedFileTypes[allowedTypes] || allowedFileTypes.all;
    if (!allowedExtensions.includes(fileExtension)) {
      const error = new Error(`Tipo de archivo no permitido: ${fileExtension}`);
      error.code = 'INVALID_FILE_TYPE';
      return cb(error, false);
    }
    
    // Verificar MIME type para mayor seguridad
    const allowedMimeTypes = {
      images: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
      documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
      all: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
    };
    
    const validMimeTypes = allowedMimeTypes[allowedTypes] || allowedMimeTypes.all;
    if (!validMimeTypes.includes(mimeType)) {
      const error = new Error(`Tipo MIME no permitido: ${mimeType}`);
      error.code = 'INVALID_MIME_TYPE';
      return cb(error, false);
    }
    
    // Verificar nombre del archivo
    if (!file.originalname || file.originalname.length > 255) {
      const error = new Error('Nombre de archivo inválido');
      error.code = 'INVALID_FILENAME';
      return cb(error, false);
    }
    
    // Verificar caracteres peligrosos en el nombre
    const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (dangerousChars.test(file.originalname)) {
      const error = new Error('Nombre de archivo contiene caracteres no permitidos');
      error.code = 'UNSAFE_FILENAME';
      return cb(error, false);
    }
    
    console.log('✅ Archivo válido:', file.fieldname);
    cb(null, true);
  };
};

// ============================================================================
// 🖼️ VALIDACIÓN DE CALIDAD DE IMAGEN - CORREGIDA Y COMPLETA
// ============================================================================

// Validación avanzada de calidad de imagen
const validateImageQuality = async (file) => {
  try {
    if (!file.mimetype.startsWith('image/')) {
      return { valid: true }; // No es imagen, no validar
    }

    const buffer = file.buffer || fs.readFileSync(file.path);
    const metadata = await sharp(buffer).metadata();
    
    // ✅ VALIDACIONES BÁSICAS PARA CÉDULAS (SIN RESTRICCIÓN DE ASPECTO)
    if (file.fieldname === 'cedulaFrente' || file.fieldname === 'cedulaTrasera') {
      // Rechazar imágenes muy pequeñas para cédulas (mínimo 100x100)
      if (metadata.width < 100 || metadata.height < 100) {
        return { 
          valid: false, 
          message: 'La imagen es muy pequeña (mínimo 100x100px). Asegúrate de que sea clara y legible.' 
        };
      }
      
      // Verificar que no sea excesivamente grande
      if (metadata.width > 4000 || metadata.height > 4000) {
        return { 
          valid: false, 
          message: 'La imagen es demasiado grande (máximo 4000x4000px)' 
        };
      }
      
      // ✅ ELIMINADA LA VALIDACIÓN DE ASPECTO RATIO - AHORA ACEPTA CUALQUIER PROPORCIÓN
      // Ya no validamos si la imagen "parece" una cédula por su proporción
      
    } else {
      // Validaciones para otros tipos de imagen
      if (metadata.width < 100 || metadata.height < 100) {
        return { 
          valid: false, 
          message: 'Imagen demasiado pequeña (mínimo 100x100px)' 
        };
      }
      
      if (metadata.width > 8000 || metadata.height > 8000) {
        return { 
          valid: false, 
          message: 'Imagen demasiado grande (máximo 8000x8000px)' 
        };
      }
    }
    
    // Rechazar imágenes corruptas
    if (!metadata.format) {
      return { 
        valid: false, 
        message: 'Archivo de imagen corrupto' 
      };
    }
    
    // Validar relación de aspecto para avatares
    if (file.fieldname === 'avatar') {
      const aspectRatio = metadata.width / metadata.height;
      if (aspectRatio < 0.5 || aspectRatio > 2) {
        return { 
          valid: false, 
          message: 'Relación de aspecto no válida para avatar (debe ser aproximadamente cuadrada)' 
        };
      }
    }
    
    return { valid: true };
  } catch (error) {
    logger.error('Error validating image quality:', error);
    return { 
      valid: false, 
      message: 'Error al procesar imagen' 
    };
  }
};

// ============================================================================
// 📤 CONFIGURACIONES MULTER ESPECÍFICAS - COMPLETAS
// ============================================================================

// ✅ CONFIGURACIÓN ESPECÍFICA PARA AGENCIAS - COMPLETAMENTE CORREGIDA
const agencyMulterConfig = {
  storage: getStorage(),
  limits: {
    fileSize: fileSizeLimits.agency, // 5MB por archivo
    files: 2, // Exactamente 2 archivos (frente y trasera)
    fieldSize: 2 * 1024 * 1024, // 2MB para campos de texto
    fieldNameSize: 100, // 100 bytes para nombres de campos
    fields: 20 // Máximo 20 campos en total
  },
  fileFilter: createFileFilter('images', ['image/jpeg', 'image/jpg', 'image/png'])
};

// Avatar de usuario
const avatarMulterConfig = {
  storage: getStorage(),
  limits: {
    fileSize: fileSizeLimits.avatar,
    files: 1
  },
  fileFilter: createFileFilter('images')
};

// ✅ CONFIGURACIÓN PARA POSTS - CORREGIDA
const postMulterConfig = {
  storage: getStorage(),
  limits: {
    fileSize: fileSizeLimits.post,
    files: 5,
    fieldSize: 2 * 1024 * 1024,
    fieldNameSize: 100,
    fields: 30
  },
  fileFilter: createFileFilter('images', ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'])
};

// Imágenes para chat (1 imagen por mensaje)
const chatMulterConfig = {
  storage: getStorage(),
  limits: {
    fileSize: fileSizeLimits.chat,
    files: 1
  },
  fileFilter: createFileFilter('images')
};

// Documentos de verificación
const documentsMulterConfig = {
  storage: getStorage(),
  limits: {
    fileSize: fileSizeLimits.document,
    files: 10
  },
  fileFilter: createFileFilter('documents')
};

// Upload genérico
const genericMulterConfig = {
  storage: getStorage(),
  limits: {
    fileSize: fileSizeLimits.default,
    files: 10
  },
  fileFilter: createFileFilter('all')
};

// ============================================================================
// 🎯 MIDDLEWARES MULTER ESPECÍFICOS - COMPLETOS
// ============================================================================

// ✅ MIDDLEWARE ESPECÍFICO PARA AGENCIAS - COMPLETAMENTE CORREGIDO
const agencyUpload = multer(agencyMulterConfig).fields([
  { name: 'cedulaFrente', maxCount: 1 },
  { name: 'cedulaTrasera', maxCount: 1 }
]);

const avatarUpload = multer(avatarMulterConfig).single('avatar');
const postImagesUpload = multer(postMulterConfig).array('images', 5);
const chatImageUpload = multer(chatMulterConfig).single('image');
const documentsUpload = multer(documentsMulterConfig).array('documents', 10);
const genericUpload = multer(genericMulterConfig).array('files', 10);

// ============================================================================
// ✅ MIDDLEWARE DE VALIDACIÓN ESPECÍFICO PARA AGENCIAS - COMPLETO
// ============================================================================

// Middleware para validar que ambos archivos de cédula estén presentes
const validateAgencyFiles = (req, res, next) => {
  console.log('🏢 === VALIDANDO ARCHIVOS DE AGENCIA ===');
  console.log('🏢 Files recibidos:', {
    files: req.files ? Object.keys(req.files) : 'none',
    cedulaFrente: req.files?.cedulaFrente ? 'PRESENTE' : 'FALTANTE',
    cedulaTrasera: req.files?.cedulaTrasera ? 'PRESENTE' : 'FALTANTE'
  });

  // Verificar que req.files existe
  if (!req.files || typeof req.files !== 'object') {
    console.log('❌ No se recibieron archivos');
    return res.status(400).json({
      success: false,
      message: 'Se requieren documentos de cédula para el registro de agencia',
      errorCode: 'NO_FILES',
      details: {
        required: ['cedulaFrente', 'cedulaTrasera'],
        received: 'none'
      },
      timestamp: new Date().toISOString()
    });
  }

  // Verificar cedulaFrente
  if (!req.files.cedulaFrente || !req.files.cedulaFrente[0]) {
    console.log('❌ cedulaFrente faltante');
    return res.status(400).json({
      success: false,
      message: 'La foto frontal de la cédula es obligatoria',
      errorCode: 'MISSING_CEDULA_FRENTE',
      details: {
        required: 'cedulaFrente',
        received: Object.keys(req.files)
      },
      timestamp: new Date().toISOString()
    });
  }

  // Verificar cedulaTrasera
  if (!req.files.cedulaTrasera || !req.files.cedulaTrasera[0]) {
    console.log('❌ cedulaTrasera faltante');
    return res.status(400).json({
      success: false,
      message: 'La foto posterior de la cédula es obligatoria',
      errorCode: 'MISSING_CEDULA_TRASERA',
      details: {
        required: 'cedulaTrasera',
        received: Object.keys(req.files)
      },
      timestamp: new Date().toISOString()
    });
  }

  // Verificar que los archivos no estén vacíos
  const frontFile = req.files.cedulaFrente[0];
  const backFile = req.files.cedulaTrasera[0];

  if (!frontFile.buffer && !frontFile.path) {
    console.log('❌ Archivo cedulaFrente vacío');
    return res.status(400).json({
      success: false,
      message: 'El archivo de la foto frontal está vacío o corrupto',
      errorCode: 'EMPTY_CEDULA_FRENTE',
      timestamp: new Date().toISOString()
    });
  }

  if (!backFile.buffer && !backFile.path) {
    console.log('❌ Archivo cedulaTrasera vacío');
    return res.status(400).json({
      success: false,
      message: 'El archivo de la foto posterior está vacío o corrupto',
      errorCode: 'EMPTY_CEDULA_TRASERA',
      timestamp: new Date().toISOString()
    });
  }

  // Verificar tamaños de archivo
  if (frontFile.size === 0 || backFile.size === 0) {
    console.log('❌ Uno de los archivos tiene tamaño 0');
    return res.status(400).json({
      success: false,
      message: 'Uno de los archivos de cédula está vacío',
      errorCode: 'ZERO_SIZE_FILE',
      details: {
        frontSize: frontFile.size,
        backSize: backFile.size
      },
      timestamp: new Date().toISOString()
    });
  }

  console.log('✅ Validación de archivos de agencia exitosa');
  console.log('✅ Archivos validados:', {
    frontFile: {
      name: frontFile.originalname,
      size: frontFile.size,
      type: frontFile.mimetype
    },
    backFile: {
      name: backFile.originalname,
      size: backFile.size,
      type: backFile.mimetype
    }
  });

  next();
};

// ============================================================================
// 🔧 MIDDLEWARES AUXILIARES - COMPLETOS
// ============================================================================

// Middleware para validar archivos después de la subida - MEJORADO
const validateUploadedFiles = async (req, res, next) => {
  if (!req.files && !req.file) {
    return next();
  }
  
  const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];
  
  for (const file of files) {
    // Verificar que el archivo se subió correctamente
    if (!file.filename && !file.buffer) {
      logger.error('File upload incomplete', {
        originalname: file.originalname,
        fieldname: file.fieldname,
        userId: req.user?.id
      });
      
      return res.status(500).json({
        success: false,
        message: 'Error procesando archivo',
        errorCode: 'UPLOAD_INCOMPLETE',
        timestamp: new Date().toISOString()
      });
    }
    
    // Validar calidad de imagen si es necesario
    if (file.buffer && file.mimetype.startsWith('image/')) {
      const qualityCheck = await validateImageQuality(file);
      if (!qualityCheck.valid) {
        logger.warn('Image quality validation failed', {
          originalname: file.originalname,
          fieldname: file.fieldname,
          message: qualityCheck.message,
          userId: req.user?.id
        });
        
        return res.status(400).json({
          success: false,
          message: qualityCheck.message,
          errorCode: 'INVALID_IMAGE_QUALITY',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Log del archivo subido
    logger.info('File uploaded successfully', {
      originalname: file.originalname,
      filename: file.filename || 'memory',
      size: file.size,
      mimetype: file.mimetype,
      fieldname: file.fieldname,
      userId: req.user?.id
    });
  }
  
  next();
};

// Middleware para validar límites por usuario
const validateUserLimits = (req, res, next) => {
  if (!req.user) {
    return next();
  }

  const user = req.user;
  const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];
  
  if (!files || files.length === 0) {
    return next();
  }

  // Límites especiales por tipo de usuario
  const userLimits = {
    CLIENT: {
      maxFileSize: 2 * 1024 * 1024,    // 2MB
      maxFiles: 3
    },
    ESCORT: {
      maxFileSize: 8 * 1024 * 1024,    // 8MB
      maxFiles: 5
    },
    AGENCY: {
      maxFileSize: 10 * 1024 * 1024,   // 10MB
      maxFiles: 10
    },
    ADMIN: {
      maxFileSize: 20 * 1024 * 1024,   // 20MB
      maxFiles: 20
    }
  };

  const limits = userLimits[user.userType] || userLimits.CLIENT;

  // Verificar número de archivos
  if (files.length > limits.maxFiles) {
    return res.status(400).json({
      success: false,
      message: `Máximo ${limits.maxFiles} archivos permitidos para tu tipo de cuenta`,
      errorCode: 'USER_FILE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString()
    });
  }

  // Verificar tamaño de archivos
  for (const file of files) {
    if (file && file.size > limits.maxFileSize) {
      logger.warn('File size limit exceeded for user type', {
        filename: file.originalname,
        fileSize: file.size,
        userLimit: limits.maxFileSize,
        userType: user.userType,
        userId: user.id
      });
      
      return res.status(400).json({
        success: false,
        message: `Archivo demasiado grande para tu tipo de cuenta. Límite: ${Math.round(limits.maxFileSize / 1024 / 1024)}MB`,
        errorCode: 'USER_FILE_SIZE_EXCEEDED',
        details: {
          userLimit: limits.maxFileSize,
          fileSize: file.size,
          filename: file.originalname
        },
        timestamp: new Date().toISOString()
      });
    }
  }
  
  next();
};

// Función para obtener límite de tamaño por campo
const getMaxFileSizeForField = (fieldname) => {
  switch (fieldname) {
    case 'avatar':
      return fileSizeLimits.avatar;
    case 'images':
    case 'postImages':
      return fileSizeLimits.post;
    case 'chatImage':
      return fileSizeLimits.chat;
    case 'cedulaFrente':
    case 'cedulaTrasera':
      return fileSizeLimits.agency;
    case 'documents':
      return fileSizeLimits.document;
    default:
      return fileSizeLimits.default;
  }
};

// Función para limpiar archivos temporales
const cleanupTempFiles = (files) => {
  if (!files) return;
  
  const fileArray = Array.isArray(files) ? files : Object.values(files).flat();
  
  fileArray.forEach(file => {
    if (file.path && fs.existsSync(file.path)) {
      fs.unlink(file.path, (err) => {
        if (err) {
          logger.error('Error deleting temp file', {
            path: file.path,
            error: err.message
          });
        } else {
          logger.debug('Temp file deleted', { path: file.path });
        }
      });
    }
  });
};

// Middleware para limpiar archivos en caso de error
const cleanupOnError = (req, res, next) => {
  const originalSend = res.send;
  const originalJson = res.json;
  
  const cleanup = (data) => {
    // Si hay error (status >= 400), limpiar archivos temporales
    if (res.statusCode >= 400 && (req.files || req.file)) {
      cleanupTempFiles(req.files || req.file);
    }
  };
  
  res.send = function(data) {
    cleanup(data);
    return originalSend.call(this, data);
  };
  
  res.json = function(data) {
    cleanup(data);
    return originalJson.call(this, data);
  };
  
  next();
};

// Middleware para agregar información de archivos a los logs
const logFileUpload = (req, res, next) => {
  if (!req.files && !req.file) {
    return next();
  }

  const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];
  
  const fileInfo = files.map(file => ({
    originalname: file.originalname,
    size: file.size,
    mimetype: file.mimetype,
    fieldname: file.fieldname
  }));

  logger.info('Files processed by multer', {
    fileCount: files.length,
    totalSize: files.reduce((sum, file) => sum + file.size, 0),
    files: fileInfo,
    userId: req.user?.id,
    userType: req.user?.userType
  });

  next();
};

// ✅ MIDDLEWARE DE DEBUG PARA DESARROLLO - COMPLETO
const debugUpload = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 === UPLOAD DEBUG ===');
    console.log('🔍 URL:', req.originalUrl);
    console.log('🔍 Method:', req.method);
    console.log('🔍 Content-Type:', req.get('content-type'));
    console.log('🔍 Content-Length:', req.get('content-length'));
    console.log('🔍 Has files:', !!req.files || !!req.file);
    console.log('🔍 Files count:', req.files ? (Array.isArray(req.files) ? req.files.length : Object.keys(req.files).length) : (req.file ? 1 : 0));
    console.log('🔍 Body keys:', Object.keys(req.body || {}));
    
    if (req.files) {
      if (Array.isArray(req.files)) {
        console.log('🔍 Files details (array):', req.files.map(f => ({
          fieldname: f.fieldname,
          originalname: f.originalname,
          mimetype: f.mimetype,
          size: f.size
        })));
      } else {
        console.log('🔍 Files details (object):', Object.keys(req.files).map(key => ({
          field: key,
          files: req.files[key].map(f => ({
            originalname: f.originalname,
            mimetype: f.mimetype,
            size: f.size
          }))
        })));
      }
    }
    
    if (req.file) {
      console.log('🔍 File details:', {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
    }
    
    console.log('🔍 === END UPLOAD DEBUG ===');
  }
  next();
};

// ============================================================================
// ☁️ PROCESAMIENTO CLOUDINARY MEJORADO - COMPLETO
// ============================================================================

// ✅ MIDDLEWARE PARA PROCESAR UPLOADS A CLOUDINARY - MEJORADO Y COMPLETO
const processCloudinaryUpload = (uploadType = 'post') => {
  return async (req, res, next) => {
    try {
      console.log('☁️ Processing Cloudinary upload:', {
        type: uploadType,
        hasFiles: !!req.files || !!req.file,
        filesCount: req.files ? (Array.isArray(req.files) ? req.files.length : Object.keys(req.files).length) : (req.file ? 1 : 0),
        userId: req.user?.id || 'anonymous'
      });

      // ✅ DEBUG ESPECÍFICO PARA AGENCIAS
      if (uploadType === 'agency') {
        console.log('🏢 Agency upload details:', {
          files: req.files,
          fileKeys: req.files ? Object.keys(req.files) : 'none',
          cedulaFrente: req.files?.cedulaFrente,
          cedulaTrasera: req.files?.cedulaTrasera,
          hasFrente: !!(req.files?.cedulaFrente && req.files.cedulaFrente[0]),
          hasTrasera: !!(req.files?.cedulaTrasera && req.files.cedulaTrasera[0])
        });
      }

      if (!req.files && !req.file) {
        console.log('ℹ️ No files to upload, skipping Cloudinary processing');
        return next();
      }

      const cloudinaryOptions = {
        folder: `telofundi/${uploadType}s`,
        type: uploadType,
        userId: req.user?.id || 'anonymous',
        generateVariations: uploadType === 'avatar' || uploadType === 'post'
      };

      // ✅ MANEJO ESPECÍFICO PARA ARCHIVOS DE AGENCIA - COMPLETAMENTE CORREGIDO
      if (uploadType === 'agency' && req.files) {
        console.log('📤 Processing agency files...');
        
        const uploadedFiles = {};
        
        // Procesar cedulaFrente
        if (req.files.cedulaFrente && req.files.cedulaFrente[0]) {
          console.log('📄 Uploading cedulaFrente...');
          try {
            // Validar calidad de imagen antes de subir
            const qualityCheck = await validateImageQuality(req.files.cedulaFrente[0]);
            if (!qualityCheck.valid) {
              throw new Error(`Foto frontal de cédula: ${qualityCheck.message}`);
            }

            const frontResult = await uploadToCloudinary(req.files.cedulaFrente[0], {
              ...cloudinaryOptions,
              folder: 'telofundi/agency/cedulas',
              transformation: [
                { quality: 'auto' },
                { format: 'jpg' },
                { width: 1200, height: 800, crop: 'limit' }
              ]
            });
            uploadedFiles.cedulaFrente = frontResult;
            console.log('✅ cedulaFrente uploaded:', frontResult.secure_url);
          } catch (error) {
            console.error('❌ Error uploading cedulaFrente:', error);
            throw new Error(`Error subiendo foto frontal de cédula: ${error.message}`);
          }
        } else {
          console.log('❌ cedulaFrente not found in request');
          throw new Error('Foto frontal de cédula es requerida');
        }
        
        // Procesar cedulaTrasera
        if (req.files.cedulaTrasera && req.files.cedulaTrasera[0]) {
          console.log('📄 Uploading cedulaTrasera...');
          try {
            // Validar calidad de imagen antes de subir
            const qualityCheck = await validateImageQuality(req.files.cedulaTrasera[0]);
            if (!qualityCheck.valid) {
              throw new Error(`Foto posterior de cédula: ${qualityCheck.message}`);
            }

            const backResult = await uploadToCloudinary(req.files.cedulaTrasera[0], {
              ...cloudinaryOptions,
              folder: 'telofundi/agency/cedulas',
              transformation: [
                { quality: 'auto' },
                { format: 'jpg' },
                { width: 1200, height: 800, crop: 'limit' }
              ]
            });
            uploadedFiles.cedulaTrasera = backResult;
            console.log('✅ cedulaTrasera uploaded:', backResult.secure_url);
          } catch (error) {
            console.error('❌ Error uploading cedulaTrasera:', error);
            throw new Error(`Error subiendo foto posterior de cédula: ${error.message}`);
          }
        } else {
          console.log('❌ cedulaTrasera not found in request');
          throw new Error('Foto posterior de cédula es requerida');
        }
        
        req.uploadedFiles = uploadedFiles;
        
        console.log('✅ Agency files uploaded successfully:', {
          cedulaFrente: !!uploadedFiles.cedulaFrente,
          cedulaTrasera: !!uploadedFiles.cedulaTrasera,
          urls: {
            front: uploadedFiles.cedulaFrente?.secure_url,
            back: uploadedFiles.cedulaTrasera?.secure_url
          }
        });
        
      } else if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        // Múltiples archivos (posts)
        console.log('📤 Uploading multiple files to Cloudinary...');
        
        // Validar calidad de imágenes antes de subir
        for (const file of req.files) {
          const qualityCheck = await validateImageQuality(file);
          if (!qualityCheck.valid) {
            throw new Error(qualityCheck.message);
          }
        }

        const uploadResult = await uploadMultipleToCloudinary(req.files, cloudinaryOptions);
        
        if (uploadResult.totalUploaded === 0) {
          throw new Error('No se pudo subir ningún archivo a Cloudinary');
        }

        if (uploadResult.totalFailed > 0) {
          logger.warn('Some files failed to upload to Cloudinary:', {
            failed: uploadResult.totalFailed,
            successful: uploadResult.totalUploaded,
            userId: req.user?.id || 'anonymous'
          });
        }

        req.uploadedFiles = uploadResult.successful;
        req.failedUploads = uploadResult.failed;

        console.log('✅ Multiple files uploaded successfully:', {
          successful: uploadResult.totalUploaded,
          failed: uploadResult.totalFailed
        });

      } else if (req.file) {
        // Un solo archivo
        console.log('📤 Uploading single file to Cloudinary...');
        
        // Validar calidad de imagen antes de subir
        const qualityCheck = await validateImageQuality(req.file);
        if (!qualityCheck.valid) {
          throw new Error(qualityCheck.message);
        }

        const uploadResult = await uploadToCloudinary(req.file, cloudinaryOptions);
        
        req.uploadedFile = uploadResult;
        
        console.log('✅ Single file uploaded successfully:', {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id
        });
      }

      next();

    } catch (error) {
      console.error('❌ Cloudinary upload error:', error);
      logger.error('Cloudinary upload failed:', {
        error: error.message,
        uploadType,
        userId: req.user?.id || 'anonymous',
        filesCount: req.files ? (Array.isArray(req.files) ? req.files.length : Object.keys(req.files).length) : (req.file ? 1 : 0)
      });

      // Para agencias, esto es crítico - fallar la request
      if (uploadType === 'agency') {
        return next(error);
      }

      // Para otros tipos, no bloquear la request si Cloudinary falla
      req.uploadError = error.message;
      next();
    }
  };
};

// ============================================================================
// 🔗 MIDDLEWARES COMBINADOS - COMPLETOS
// ============================================================================

// ✅ MIDDLEWARE COMBINADO PARA AGENCIAS - COMPLETAMENTE CORREGIDO
const handleAgencyUpload = [
  (req, res, next) => {
    console.log('🏢 === INICIANDO UPLOAD DE AGENCIA ===');
    console.log('🏢 Content-Type:', req.get('Content-Type'));
    console.log('🏢 Content-Length:', req.get('Content-Length'));
    next();
  },
  agencyUpload,
  (req, res, next) => {
    console.log('🏢 === POST MULTER AGENCIA ===');
    console.log('🏢 Files recibidos:', {
      files: req.files ? Object.keys(req.files) : 'none',
      cedulaFrente: req.files?.cedulaFrente ? 'RECEIVED' : 'MISSING',
      cedulaTrasera: req.files?.cedulaTrasera ? 'RECEIVED' : 'MISSING'
    });
    next();
  },
  validateAgencyFiles, // ← NUEVO: Validar que ambos archivos estén presentes
  processCloudinaryUpload('agency')
];

// ✅ MIDDLEWARE COMBINADO PARA POSTS - CORREGIDO
const handlePostUpload = [
  (req, res, next) => {
    console.log('📝 === INICIANDO UPLOAD DE POST ===');
    console.log('📝 Content-Type:', req.get('Content-Type'));
    console.log('📝 Content-Length:', req.get('Content-Length'));
    next();
  },
  postImagesUpload,
  (req, res, next) => {
    console.log('📝 === POST MULTER POSTS ===');
    console.log('📝 Files recibidos:', req.files ? req.files.length : 'none');
    if (req.files && req.files.length > 0) {
      console.log('📝 Files details:', req.files.map(f => ({
        fieldname: f.fieldname,
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size
      })));
    }
    next();
  },
  validateUploadedFiles,
  processCloudinaryUpload('post')
];

// MIDDLEWARE COMBINADO PARA AVATARS
const handleAvatarUpload = [
  avatarUpload,
  validateUploadedFiles,
  processCloudinaryUpload('avatar')
];

// MIDDLEWARE COMBINADO PARA CHAT
const handleChatUpload = [
  chatImageUpload,
  validateUploadedFiles,
  processCloudinaryUpload('chat')
];

// ============================================================================
// 🚨 MANEJO DE ERRORES MEJORADO - COMPLETO
// ============================================================================

// Manejo de errores de multer - MEJORADO CON ERRORES ESPECÍFICOS DE AGENCIA
const handleMulterError = (error, req, res, next) => {
  console.error('🔥 Multer error:', {
    name: error.name,
    message: error.message,
    code: error.code,
    field: error.field,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });

  if (error instanceof multer.MulterError) {
    let message = 'Error subiendo archivo';
    let code = 'UPLOAD_ERROR';
    let statusCode = 400;
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        const maxSize = getMaxFileSizeForField(error.field);
        message = `Archivo demasiado grande. Máximo permitido: ${Math.round(maxSize / 1024 / 1024)}MB`;
        code = 'FILE_TOO_LARGE';
        
        // Mensaje específico para cédulas
        if (error.field === 'cedulaFrente' || error.field === 'cedulaTrasera') {
          message = `La foto de la cédula es muy grande. Máximo permitido: 5MB. Comprime la imagen e inténtalo de nuevo.`;
        }
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Demasiados archivos';
        code = 'TOO_MANY_FILES';
        
        // Mensaje específico para agencias
        if (error.field === 'cedulaFrente' || error.field === 'cedulaTrasera') {
          message = 'Solo se permite una foto por cada lado de la cédula (frente y trasera)';
        }
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = `Campo de archivo inesperado: '${error.field}'. Revisa los nombres de los campos en tu formulario.`;
        code = 'UNEXPECTED_FIELD';
        
        // Ayuda específica para agencias
        if (req.originalUrl && req.originalUrl.includes('agency')) {
          message = `Campo de archivo incorrecto: '${error.field}'. Para registro de agencia, usa 'cedulaFrente' y 'cedulaTrasera'.`;
        }
        break;
      case 'LIMIT_PART_COUNT':
        message = 'Demasiadas partes en el formulario';
        code = 'TOO_MANY_PARTS';
        statusCode = 413;
        break;
      case 'LIMIT_FIELD_KEY':
        message = 'Nombre de campo demasiado largo';
        code = 'FIELD_NAME_TOO_LONG';
        break;
      case 'LIMIT_FIELD_VALUE':
        message = 'Valor de campo demasiado largo';
        code = 'FIELD_VALUE_TOO_LONG';
        break;
      case 'LIMIT_FIELD_COUNT':
        message = 'Demasiados campos';
        code = 'TOO_MANY_FIELDS';
        break;
    }
    
    logger.warn('Multer error', {
      code: error.code,
      message,
      fieldname: error.field,
      userId: req.user?.id,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(statusCode).json({
      success: false,
      message,
      errorCode: code,
      details: {
        field: error.field,
        limit: error.limit
      },
      timestamp: new Date().toISOString()
    });
  }
  
  // ✅ ERRORES PERSONALIZADOS DEL FILEFILTER - ESPECÍFICOS PARA AGENCIAS
  if (error.code && ['INVALID_CEDULA_TYPE', 'INVALID_CEDULA_EXT', 'CEDULA_TOO_LARGE'].includes(error.code)) {
    logger.warn('Agency file filter error', {
      code: error.code,
      message: error.message,
      userId: req.user?.id
    });
    
    return res.status(400).json({
      success: false,
      message: error.message,
      errorCode: error.code,
      details: {
        requiredTypes: ['JPG', 'JPEG', 'PNG'],
        maxSize: '5MB',
        field: error.field
      },
      timestamp: new Date().toISOString()
    });
  }
  
  // ✅ ERRORES PERSONALIZADOS PARA POSTS
  if (error.code && ['INVALID_POST_IMAGE_TYPE', 'INVALID_POST_IMAGE_EXT'].includes(error.code)) {
    logger.warn('Post file filter error', {
      code: error.code,
      message: error.message,
      userId: req.user?.id
    });
    
    return res.status(400).json({
      success: false,
      message: error.message,
      errorCode: error.code,
      details: {
        requiredTypes: ['JPG', 'JPEG', 'PNG', 'WebP', 'GIF'],
        maxSize: '8MB',
        field: error.field
      },
      timestamp: new Date().toISOString()
    });
  }
  
  // Errores personalizados del fileFilter
  if (error.code && ['INVALID_FILE_TYPE', 'INVALID_MIME_TYPE', 'INVALID_FILENAME', 'UNSAFE_FILENAME'].includes(error.code)) {
    logger.warn('File filter error', {
      code: error.code,
      message: error.message,
      userId: req.user?.id
    });
    
    return res.status(400).json({
      success: false,
      message: error.message,
      errorCode: error.code,
      timestamp: new Date().toISOString()
    });
  }
  
  next(error);
};

// Validar configuración
const validateConfig = () => {
  const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || fileSizeLimits.default;
  const allowedTypes = process.env.ALLOWED_FILE_TYPES ? process.env.ALLOWED_FILE_TYPES.split(',') : allowedFileTypes.all;
  const cloudinaryConfigured = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY);
  
  logger.info('Multer configuration loaded', {
    maxFileSize,
    allowedTypes: allowedTypes.length,
    environment: process.env.NODE_ENV,
    storageType: cloudinaryConfigured ? 'memory (Cloudinary)' : 'disk (local)',
    cloudinaryConfigured
  });
  
  return { 
    maxFileSize, 
    allowedTypes, 
    cloudinaryConfigured 
  };
};

// Inicializar configuración
const config = validateConfig();

// ============================================================================
// 📤 EXPORTS COMPLETOS
// ============================================================================

module.exports = {
  // ✅ PRINCIPALES - MIDDLEWARES COMBINADOS
  handleAgencyUpload,        // ← COMPLETADO: Para registro de agencias
  handlePostUpload,          // Para posts con imágenes
  handleAvatarUpload,        // Para avatars de perfil
  handleChatUpload,          // Para imágenes de chat
  
  // ✅ MIDDLEWARES INDIVIDUALES MULTER
  agencyUpload,              // ← COMPLETADO: Multer específico para agencias
  avatarUpload,              // Multer para avatars
  postImagesUpload,          // Multer para posts
  chatImageUpload,           // Multer para chat
  documentsUpload,           // Multer para documentos
  genericUpload,             // Multer genérico
  
  // ✅ VALIDACIONES ESPECÍFICAS
  validateAgencyFiles,       // ← NUEVO: Validar archivos de cédula
  
  // ✅ PROCESAMIENTO CLOUDINARY
  processCloudinaryUpload,   // Middleware para Cloudinary
  
  // ✅ MANEJO DE ERRORES Y VALIDACIÓN
  handleMulterError,         // Manejo de errores mejorado
  validateUploadedFiles,     // Validación post-upload
  validateUserLimits,        // Límites por tipo de usuario
  
  // ✅ UTILIDADES
  cleanupTempFiles,          // Limpiar archivos temporales
  cleanupOnError,            // Limpiar en caso de error
  logFileUpload,             // Log de uploads
  debugUpload,               // Debug para desarrollo
  
  // ✅ CONFIGURACIONES Y HELPERS
  createFileFilter,          // Crear filtros personalizados
  allowedFileTypes,          // Tipos de archivo permitidos
  fileSizeLimits,            // Límites de tamaño
  config,                    // Configuración general
  getMaxFileSizeForField,    // Helper para límites
  validateImageQuality       // Validación de calidad de imagen mejorada
};