const {
  avatarUpload,
  postImagesUpload,
  chatImageUpload,
  documentsUpload,
  genericUpload,
  handleMulterError,
  validateUploadedFiles,
  validateUserLimits,
  cleanupOnError,
  logFileUpload
} = require('../config/multer');
const { 
  uploadToCloudinary, 
  uploadMultipleToCloudinary,
  deleteFromCloudinary,
  isCloudinaryConfigured 
} = require('../services/uploadService');
const logger = require('../utils/logger');

// Middleware para subir avatar de usuario - OPTIMIZADO
const uploadAvatar = (req, res, next) => {
  cleanupOnError(req, res, () => {
    avatarUpload.single('avatar')(req, res, (err) => {
      if (err) {
        return handleMulterError(err, req, res, next);
      }
      validateUploadedFiles(req, res, () => {
        validateUserLimits(req, res, () => {
          logFileUpload(req, res, next);
        });
      });
    });
  });
};

// Middleware para subir múltiples imágenes de posts - OPTIMIZADO
const uploadPostImages = (req, res, next) => {
  cleanupOnError(req, res, () => {
    postImagesUpload.array('images', 5)(req, res, (err) => {
      if (err) {
        return handleMulterError(err, req, res, next);
      }
      validateUploadedFiles(req, res, () => {
        validateUserLimits(req, res, () => {
          logFileUpload(req, res, next);
        });
      });
    });
  });
};

// NUEVO: Middleware para subir imagen de chat
const uploadChatImage = (req, res, next) => {
  cleanupOnError(req, res, () => {
    chatImageUpload.single('image')(req, res, (err) => {
      if (err) {
        return handleMulterError(err, req, res, next);
      }
      validateUploadedFiles(req, res, () => {
        validateUserLimits(req, res, () => {
          logFileUpload(req, res, next);
        });
      });
    });
  });
};

// Middleware para subir documentos de verificación - OPTIMIZADO
const uploadDocuments = (req, res, next) => {
  cleanupOnError(req, res, () => {
    documentsUpload.array('documents', 10)(req, res, (err) => {
      if (err) {
        return handleMulterError(err, req, res, next);
      }
      validateUploadedFiles(req, res, () => {
        validateUserLimits(req, res, () => {
          logFileUpload(req, res, next);
        });
      });
    });
  });
};

// Middleware para upload genérico - MEJORADO
const uploadGeneric = (fieldName, maxFiles = 1, allowedTypes = 'all') => {
  return (req, res, next) => {
    cleanupOnError(req, res, () => {
      const uploadMethod = maxFiles === 1 ? 
        genericUpload.single(fieldName) : 
        genericUpload.array(fieldName, maxFiles);
      
      uploadMethod(req, res, (err) => {
        if (err) {
          return handleMulterError(err, req, res, next);
        }
        validateUploadedFiles(req, res, () => {
          validateUserLimits(req, res, () => {
            validateFileTypes(allowedTypes)(req, res, () => {
              logFileUpload(req, res, next);
            });
          });
        });
      });
    });
  };
};

// MIDDLEWARE PRINCIPAL: Procesar y subir a Cloudinary - COMPLETAMENTE OPTIMIZADO
const processAndUploadToCloud = async (req, res, next) => {
  try {
    if (!req.file && !req.files) {
      return next();
    }

    // Verificar si Cloudinary está configurado
    if (!isCloudinaryConfigured) {
      logger.warn('Cloudinary not configured, files will be stored locally');
      return next();
    }

    const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];
    
    // Validación adicional antes de subir
    const validationResult = await validateBeforeUpload(files, req.user);
    if (!validationResult.isValid) {
      return res.status(400).json({
        success: false,
        message: validationResult.message,
        errorCode: validationResult.code,
        timestamp: new Date().toISOString()
      });
    }

    // Configurar opciones de upload según el contexto
    const uploadOptions = getUploadOptions(files[0], req);

    let uploadResult;

    if (files.length === 1) {
      // Upload único optimizado
      uploadResult = await uploadToCloudinary(files[0], uploadOptions.folder, {
        type: uploadOptions.type,
        userId: req.user?.id,
        public_id: generatePublicId(files[0], req.user, uploadOptions.type),
        generateVariations: uploadOptions.generateVariations
      });

      req.uploadedFile = {
        ...uploadResult,
        originalname: files[0].originalname,
        fieldname: files[0].fieldname,
        size: files[0].size,
        mimetype: files[0].mimetype
      };

    } else {
      // Upload múltiple optimizado
      uploadResult = await uploadMultipleToCloudinary(files, {
        folder: uploadOptions.folder,
        type: uploadOptions.type,
        userId: req.user?.id,
        generateVariations: uploadOptions.generateVariations
      });

      req.uploadedFiles = uploadResult.successful.map((result, index) => ({
        ...result,
        originalname: files[index]?.originalname,
        fieldname: files[index]?.fieldname,
        size: files[index]?.size,
        mimetype: files[index]?.mimetype
      }));

      // Log archivos fallidos si los hay
      if (uploadResult.failed.length > 0) {
        logger.warn('Some files failed to upload to Cloudinary', {
          successful: uploadResult.totalUploaded,
          failed: uploadResult.totalFailed,
          userId: req.user?.id,
          errors: uploadResult.failed.map(err => err.message)
        });

        // Si todos fallaron, retornar error
        if (uploadResult.totalUploaded === 0) {
          return res.status(500).json({
            success: false,
            message: 'Error subiendo archivos. Intenta de nuevo.',
            errorCode: 'ALL_UPLOADS_FAILED',
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    logger.info('Files uploaded to Cloudinary successfully', {
      count: files.length,
      successful: uploadResult.totalUploaded || 1,
      failed: uploadResult.totalFailed || 0,
      type: uploadOptions.type,
      folder: uploadOptions.folder,
      userId: req.user?.id
    });

    next();

  } catch (error) {
    logger.error('Error processing Cloudinary upload', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      filesCount: req.files?.length || (req.file ? 1 : 0)
    });
    
    res.status(500).json({
      success: false,
      message: 'Error procesando la subida de archivos',
      errorCode: 'CLOUD_UPLOAD_ERROR',
      timestamp: new Date().toISOString()
    });
  }
};

// NUEVO: Middleware para eliminar archivo de Cloudinary
const deleteFromCloud = (publicId) => {
  return async (req, res, next) => {
    try {
      if (!publicId) {
        return next();
      }

      if (!isCloudinaryConfigured) {
        logger.warn('Cannot delete from Cloudinary - not configured');
        return next();
      }

      const result = await deleteFromCloudinary(publicId);
      
      if (result.success) {
        logger.info('File deleted from Cloudinary', {
          publicId,
          userId: req.user?.id
        });
      } else {
        logger.warn('Failed to delete file from Cloudinary', {
          publicId,
          error: result.error,
          userId: req.user?.id
        });
      }

      req.cloudinaryDeletion = result;
      next();

    } catch (error) {
      logger.error('Error deleting from Cloudinary', {
        publicId,
        error: error.message,
        userId: req.user?.id
      });
      next(); // Continuar aunque falle la eliminación
    }
  };
};

// Middleware para validar tipos de archivo específicos - MEJORADO
const validateFileTypes = (allowedTypes = []) => {
  return (req, res, next) => {
    if (!req.file && !req.files) {
      return next();
    }

    // Si allowedTypes es string, convertir a array
    const allowed = Array.isArray(allowedTypes) ? allowedTypes : [allowedTypes];
    
    if (allowed.length === 0 || allowed.includes('all')) {
      return next();
    }

    const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];
    
    for (const file of files) {
      const isValid = allowed.some(type => {
        if (type.startsWith('image/')) {
          return file.mimetype.startsWith('image/');
        }
        if (type.startsWith('application/')) {
          return file.mimetype === type;
        }
        return file.mimetype.includes(type);
      });

      if (!isValid) {
        logger.warn('File type validation failed', {
          filename: file.originalname,
          mimetype: file.mimetype,
          allowedTypes: allowed,
          userId: req.user?.id
        });
        
        return res.status(400).json({
          success: false,
          message: `Tipo de archivo no permitido: ${file.mimetype}`,
          errorCode: 'INVALID_FILE_TYPE',
          allowedTypes: allowed,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    next();
  };
};

// NUEVO: Middleware para rate limiting de uploads con Redis/Cache
const rateLimitUploads = async (req, res, next) => {
  try {
    if (!req.file && !req.files) {
      return next();
    }

    const user = req.user;
    if (!user) {
      return next();
    }

    // Límites por tipo de usuario y por hora
    const hourlyLimits = {
      CLIENT: { files: 5, totalSize: 10 * 1024 * 1024 },      // 5 archivos, 10MB por hora
      ESCORT: { files: 15, totalSize: 50 * 1024 * 1024 },     // 15 archivos, 50MB por hora
      AGENCY: { files: 30, totalSize: 100 * 1024 * 1024 },    // 30 archivos, 100MB por hora
      ADMIN: { files: 100, totalSize: 500 * 1024 * 1024 }     // 100 archivos, 500MB por hora
    };

    const userLimit = hourlyLimits[user.userType] || hourlyLimits.CLIENT;
    const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    // Aquí podrías implementar verificación con Redis
    // Por ahora, loggeamos para monitoreo
    logger.debug('Upload rate limit check', {
      userId: user.id,
      userType: user.userType,
      filesCount: files.length,
      totalSize,
      limits: userLimit
    });

    // Verificación básica de límites por request
    if (files.length > userLimit.files / 4) { // Permitir 1/4 del límite por request
      return res.status(429).json({
        success: false,
        message: `Demasiados archivos en una sola subida. Máximo: ${Math.floor(userLimit.files / 4)}`,
        errorCode: 'TOO_MANY_FILES_PER_REQUEST',
        timestamp: new Date().toISOString()
      });
    }

    if (totalSize > userLimit.totalSize / 2) { // Permitir 1/2 del límite por request
      return res.status(429).json({
        success: false,
        message: `Archivos demasiado grandes. Máximo por subida: ${Math.floor(userLimit.totalSize / 2 / 1024 / 1024)}MB`,
        errorCode: 'FILES_TOO_LARGE_PER_REQUEST',
        timestamp: new Date().toISOString()
      });
    }

    next();

  } catch (error) {
    logger.error('Error checking upload rate limit', {
      error: error.message,
      userId: req.user?.id
    });
    next();
  }
};

// Middleware para limpiar metadatos de archivos subidos - MEJORADO
const cleanFileMetadata = (req, res, next) => {
  if (!req.file && !req.files) {
    return next();
  }

  const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];
  
  files.forEach(file => {
    // Remover información sensible del servidor
    delete file.destination;
    delete file.path;
    delete file.buffer; // IMPORTANTE: Limpiar buffer de memoria
    
    // Remover información interna de multer
    delete file.stream;
    delete file.encoding;
    
    // Mantener solo información segura y necesaria
    const safeFile = {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    };
    
    // Si existe filename (local storage), mantenerlo
    if (file.filename) {
      safeFile.filename = file.filename;
    }
    
    Object.keys(file).forEach(key => {
      if (!safeFile.hasOwnProperty(key)) {
        delete file[key];
      }
    });
    
    Object.assign(file, safeFile);
  });
  
  next();
};

// NUEVO: Middleware para agregar información completa de upload a la respuesta
const addUploadInfo = (req, res, next) => {
  if (!req.uploadedFile && !req.uploadedFiles) {
    return next();
  }

  const originalJson = res.json;
  
  res.json = function(data) {
    if (data && typeof data === 'object' && data.success !== false) {
      
      // Información de archivo único
      if (req.uploadedFile) {
        data.uploadedFile = {
          url: req.uploadedFile.secure_url,
          publicId: req.uploadedFile.public_id,
          size: req.uploadedFile.bytes || req.uploadedFile.size,
          format: req.uploadedFile.format,
          width: req.uploadedFile.width,
          height: req.uploadedFile.height,
          folder: req.uploadedFile.folder,
          variations: req.uploadedFile.variations || {},
          optimized: req.uploadedFile.optimized || false
        };
      }
      
      // Información de archivos múltiples
      if (req.uploadedFiles) {
        data.uploadedFiles = req.uploadedFiles.map(file => ({
          url: file.secure_url,
          publicId: file.public_id,
          size: file.bytes || file.size,
          format: file.format,
          width: file.width,
          height: file.height,
          fieldname: file.fieldname,
          originalname: file.originalname,
          variations: file.variations || {},
          optimized: file.optimized || false
        }));

        // Estadísticas del upload múltiple
        data.uploadStats = {
          totalFiles: req.uploadedFiles.length,
          totalSize: req.uploadedFiles.reduce((sum, file) => sum + (file.bytes || file.size || 0), 0),
          formats: [...new Set(req.uploadedFiles.map(file => file.format))],
          hasVariations: req.uploadedFiles.some(file => file.variations && Object.keys(file.variations).length > 0)
        };
      }

      // Información de eliminación si existe
      if (req.cloudinaryDeletion) {
        data.cloudinaryDeletion = req.cloudinaryDeletion;
      }
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

// FUNCIONES AUXILIARES

// Validar archivos antes de subir a Cloudinary
const validateBeforeUpload = async (files, user) => {
  try {
    // Verificar que hay archivos
    if (!files || files.length === 0) {
      return { isValid: false, message: 'No se encontraron archivos', code: 'NO_FILES' };
    }

    // Verificar límites por tipo de usuario
    const maxFiles = {
      CLIENT: 3,
      ESCORT: 5,
      AGENCY: 10,
      ADMIN: 20
    };

    const userMaxFiles = maxFiles[user?.userType] || maxFiles.CLIENT;
    
    if (files.length > userMaxFiles) {
      return { 
        isValid: false, 
        message: `Máximo ${userMaxFiles} archivos permitidos para tu tipo de cuenta`, 
        code: 'TOO_MANY_FILES' 
      };
    }

    // Validar cada archivo individualmente
    for (const file of files) {
      if (!file.buffer && !file.path) {
        return { 
          isValid: false, 
          message: 'Archivo corrupto o incompleto', 
          code: 'CORRUPTED_FILE' 
        };
      }

      // Verificar tamaño mínimo (evitar archivos vacíos)
      if (file.size < 100) {
        return { 
          isValid: false, 
          message: 'Archivo demasiado pequeño', 
          code: 'FILE_TOO_SMALL' 
        };
      }
    }

    return { isValid: true };

  } catch (error) {
    logger.error('Error validating files before upload', error);
    return { 
      isValid: false, 
      message: 'Error validando archivos', 
      code: 'VALIDATION_ERROR' 
    };
  }
};

// Obtener opciones de upload según contexto
const getUploadOptions = (file, req) => {
  const fieldname = file.fieldname;
  const userType = req.user?.userType || 'CLIENT';
  
  const configs = {
    avatar: {
      folder: 'telofundi/avatars',
      type: 'avatar',
      generateVariations: false
    },
    images: {
      folder: 'telofundi/posts',
      type: 'post',
      generateVariations: true
    },
    postImages: {
      folder: 'telofundi/posts',
      type: 'post',
      generateVariations: true
    },
    image: {
      folder: 'telofundi/chat',
      type: 'chat',
      generateVariations: false
    },
    documents: {
      folder: 'telofundi/documents',
      type: 'document',
      generateVariations: false
    }
  };

  return configs[fieldname] || {
    folder: 'telofundi/misc',
    type: 'misc',
    generateVariations: false
  };
};

// Generar public_id único
const generatePublicId = (file, user, type) => {
  const timestamp = Date.now();
  const userId = user?.id || 'anonymous';
  const random = Math.random().toString(36).substr(2, 6);
  
  return `${type}_${userId}_${timestamp}_${random}`;
};

module.exports = {
  // Middlewares principales
  uploadAvatar,
  uploadPostImages,
  uploadChatImage,
  uploadDocuments,
  uploadGeneric,
  
  // Procesamiento principal
  processAndUploadToCloud,
  deleteFromCloud,
  
  // Validaciones y seguridad
  validateFileTypes,
  rateLimitUploads,
  
  // Utilidades
  cleanFileMetadata,
  addUploadInfo,
  
  // Error handling
  handleMulterError,
  
  // Re-exports desde multer config
  validateUploadedFiles,
  validateUserLimits,
  cleanupOnError,
  logFileUpload
};