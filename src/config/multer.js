const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const sharp = require('sharp');
const logger = require('../utils/logger');

// Configuración de tipos de archivos permitidos
const allowedFileTypes = {
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  documents: ['.pdf', '.doc', '.docx', '.txt'],
  all: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.txt']
};

// Configuración de límites de tamaño por tipo - OPTIMIZADA
const fileSizeLimits = {
  avatar: 3 * 1024 * 1024,      // 3MB para avatares (aumentado)
  post: 8 * 1024 * 1024,        // 8MB para imágenes de posts (aumentado)
  chat: 5 * 1024 * 1024,        // 5MB para imágenes de chat
  document: 10 * 1024 * 1024,   // 10MB para documentos
  default: 5 * 1024 * 1024      // 5MB por defecto
};

// Crear directorios si no existen
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.info('Directory created', { path: dirPath });
  }
};

// Configuración de almacenamiento local (solo para desarrollo)
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath;
    
    // Determinar carpeta según el tipo de archivo
    if (file.fieldname === 'avatar') {
      uploadPath = path.join(__dirname, '../../imagenes/avatars');
    } else if (file.fieldname === 'images' || file.fieldname === 'postImages') {
      uploadPath = path.join(__dirname, '../../imagenes/posts');
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
    
    // Formato: timestamp_uniqueId_originalName.ext
    const fileName = `${timestamp}_${uniqueSuffix}${fileExtension}`;
    
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

// Filtro de archivos mejorado
const fileFilter = (allowedTypes = 'all') => {
  return (req, file, cb) => {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();
    
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
    
    cb(null, true);
  };
};

// Validación avanzada de calidad de imagen
const validateImageQuality = async (file) => {
  try {
    if (!file.mimetype.startsWith('image/')) {
      return { valid: true }; // No es imagen, no validar
    }

    const metadata = await sharp(file.buffer).metadata();
    
    // Rechazar imágenes muy pequeñas
    if (metadata.width < 100 || metadata.height < 100) {
      return { 
        valid: false, 
        message: 'Imagen demasiado pequeña (mínimo 100x100px)' 
      };
    }
    
    // Rechazar imágenes excesivamente grandes (más de 8K)
    if (metadata.width > 8000 || metadata.height > 8000) {
      return { 
        valid: false, 
        message: 'Imagen demasiado grande (máximo 8000x8000px)' 
      };
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

// Configuraciones específicas para diferentes tipos de uploads - OPTIMIZADAS

// Avatar de usuario
const avatarUpload = multer({
  storage: getStorage(),
  limits: {
    fileSize: fileSizeLimits.avatar,
    files: 1
  },
  fileFilter: fileFilter('images')
});

// Imágenes de posts (hasta 5 imágenes)
const postImagesUpload = multer({
  storage: getStorage(),
  limits: {
    fileSize: fileSizeLimits.post,
    files: 5
  },
  fileFilter: fileFilter('images')
});

// Imágenes para chat (1 imagen por mensaje)
const chatImageUpload = multer({
  storage: getStorage(),
  limits: {
    fileSize: fileSizeLimits.chat,
    files: 1
  },
  fileFilter: fileFilter('images')
});

// Documentos de verificación
const documentsUpload = multer({
  storage: getStorage(),
  limits: {
    fileSize: fileSizeLimits.document,
    files: 10
  },
  fileFilter: fileFilter('documents')
});

// Upload genérico
const genericUpload = multer({
  storage: getStorage(),
  limits: {
    fileSize: fileSizeLimits.default,
    files: 10
  },
  fileFilter: fileFilter('all')
});

// Middleware para manejo de errores de multer - MEJORADO
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    let message = 'Error subiendo archivo';
    let code = 'UPLOAD_ERROR';
    let statusCode = 400;
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        const maxSize = getMaxFileSizeForField(error.field);
        message = `Archivo demasiado grande. Máximo permitido: ${Math.round(maxSize / 1024 / 1024)}MB`;
        code = 'FILE_TOO_LARGE';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Demasiados archivos';
        code = 'TOO_MANY_FILES';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Campo de archivo inesperado';
        code = 'UNEXPECTED_FIELD';
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

// Validar configuración de multer
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

// Inicializar configuración
const config = validateConfig();

module.exports = {
  avatarUpload,
  postImagesUpload,
  chatImageUpload,
  documentsUpload,
  genericUpload,
  handleMulterError,
  validateUploadedFiles,
  validateUserLimits,
  cleanupTempFiles,
  cleanupOnError,
  logFileUpload,
  fileFilter,
  allowedFileTypes,
  fileSizeLimits,
  config
};