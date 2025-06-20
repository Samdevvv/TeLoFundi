const multer = require('multer');
const { uploadToCloudinary, uploadMultipleToCloudinary } = require('../services/uploadService');
const logger = require('../utils/logger');

// ✅ CONFIGURACIÓN DE MEMORIA PARA CLOUDINARY
const storage = multer.memoryStorage();

// ✅ FILTRO DE ARCHIVOS
const fileFilter = (req, file, cb) => {
  console.log('🔍 File filter - Processing file:', {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  // Tipos de archivo permitidos
  const allowedTypes = {
    'image/jpeg': true,
    'image/jpg': true,
    'image/png': true,
    'image/webp': true,
    'image/gif': true,
    'application/pdf': true, // Para documentos
    'application/msword': true,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true
  };

  if (allowedTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
  }
};

// ✅ CONFIGURACIÓN BASE DE MULTER
const multerConfig = {
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo
    files: 5 // Máximo 5 archivos
  }
};

// ✅ MIDDLEWARE ESPECÍFICOS POR TIPO DE UPLOAD
const uploadMiddleware = {
  // Para posts (múltiples imágenes)
  posts: multer({
    ...multerConfig,
    limits: {
      fileSize: 8 * 1024 * 1024, // 8MB por imagen
      files: 5 // Máximo 5 imágenes
    }
  }).array('images', 5),

  // Para avatars (una sola imagen)
  avatar: multer({
    ...multerConfig,
    limits: {
      fileSize: 3 * 1024 * 1024, // 3MB para avatars
      files: 1
    }
  }).single('avatar'),

  // Para chat (una imagen)
  chat: multer({
    ...multerConfig,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB para chat
      files: 1
    }
  }).single('image'),

  // Para documentos
  documents: multer({
    ...multerConfig,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB para documentos
      files: 10
    }
  }).array('documents', 10)
};

// ✅ MIDDLEWARE PARA PROCESAR UPLOADS A CLOUDINARY
const processCloudinaryUpload = (uploadType = 'post') => {
  return async (req, res, next) => {
    try {
      console.log('☁️ Processing Cloudinary upload:', {
        type: uploadType,
        hasFiles: !!req.files || !!req.file,
        filesCount: req.files?.length || (req.file ? 1 : 0),
        userId: req.user?.id
      });

      if (!req.files && !req.file) {
        console.log('ℹ️ No files to upload, skipping Cloudinary processing');
        return next();
      }

      const cloudinaryOptions = {
        folder: `telofundi/${uploadType}s`,
        type: uploadType,
        userId: req.user?.id,
        generateVariations: uploadType === 'avatar' || uploadType === 'post'
      };

      if (req.files && req.files.length > 0) {
        // Múltiples archivos
        console.log('📤 Uploading multiple files to Cloudinary...');
        const uploadResult = await uploadMultipleToCloudinary(req.files, cloudinaryOptions);
        
        if (uploadResult.totalUploaded === 0) {
          throw new Error('No se pudo subir ningún archivo a Cloudinary');
        }

        if (uploadResult.totalFailed > 0) {
          logger.warn('Some files failed to upload to Cloudinary:', {
            failed: uploadResult.totalFailed,
            successful: uploadResult.totalUploaded,
            userId: req.user?.id
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
        userId: req.user?.id,
        filesCount: req.files?.length || (req.file ? 1 : 0)
      });

      // No bloquear la request si Cloudinary falla
      // Podrías implementar fallback a almacenamiento local aquí
      req.uploadError = error.message;
      next();
    }
  };
};

// ✅ MIDDLEWARE COMBINADO PARA POSTS
const handlePostUpload = [
  uploadMiddleware.posts,
  processCloudinaryUpload('post')
];

// ✅ MIDDLEWARE COMBINADO PARA AVATARS
const handleAvatarUpload = [
  uploadMiddleware.avatar,
  processCloudinaryUpload('avatar')
];

// ✅ MIDDLEWARE COMBINADO PARA CHAT
const handleChatUpload = [
  uploadMiddleware.chat,
  processCloudinaryUpload('chat')
];

// ✅ MANEJO DE ERRORES DE MULTER
const handleMulterError = (error, req, res, next) => {
  console.error('🔥 Multer error:', error);

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          message: 'Archivo muy grande',
          errorCode: 'FILE_TOO_LARGE',
          details: `El archivo excede el tamaño máximo permitido`,
          maxSize: '8MB para posts, 3MB para avatars'
        });

      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Demasiados archivos',
          errorCode: 'TOO_MANY_FILES',
          details: 'Máximo 5 archivos para posts, 1 para avatars'
        });

      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Campo de archivo inesperado',
          errorCode: 'UNEXPECTED_FILE_FIELD',
          details: `Campo recibido: ${error.field}`
        });

      default:
        return res.status(400).json({
          success: false,
          message: 'Error de upload',
          errorCode: 'UPLOAD_ERROR',
          details: error.message
        });
    }
  }

  // Error de filtro de archivos
  if (error.message.includes('Tipo de archivo no permitido')) {
    return res.status(400).json({
      success: false,
      message: 'Tipo de archivo no permitido',
      errorCode: 'INVALID_FILE_TYPE',
      details: 'Solo se permiten imágenes (JPG, PNG, GIF, WebP) y documentos (PDF, DOC)',
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
    });
  }

  // Otros errores
  next(error);
};

// ✅ MIDDLEWARE DE DEBUG PARA DESARROLLO
const debugUpload = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 === UPLOAD DEBUG ===');
    console.log('🔍 URL:', req.originalUrl);
    console.log('🔍 Method:', req.method);
    console.log('🔍 Content-Type:', req.get('content-type'));
    console.log('🔍 Content-Length:', req.get('content-length'));
    console.log('🔍 Has files:', !!req.files || !!req.file);
    console.log('🔍 Files count:', req.files?.length || (req.file ? 1 : 0));
    console.log('🔍 Body keys:', Object.keys(req.body || {}));
    
    if (req.files) {
      console.log('🔍 Files details:', req.files.map(f => ({
        fieldname: f.fieldname,
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size
      })));
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

module.exports = {
  uploadMiddleware,
  handlePostUpload,
  handleAvatarUpload,
  handleChatUpload,
  processCloudinaryUpload,
  handleMulterError,
  debugUpload
};