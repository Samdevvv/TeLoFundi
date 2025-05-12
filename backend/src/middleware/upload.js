// src/middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Asegurarse de que existen los directorios para subidas
const createUploadDir = (dir) => {
  const fullPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
  return fullPath;
};

// Crear directorios para diferentes tipos de subidas
const uploadsDir = createUploadDir('uploads');
const profileImagesDir = createUploadDir('uploads/profiles');
const verificationDocsDir = createUploadDir('uploads/verification');
const tempUploadsDir = createUploadDir('uploads/temp');

// Configuración de almacenamiento para perfiles
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profileImagesDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user.id;
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    const ext = path.extname(file.originalname);
    cb(null, `profile-${userId}-${uniqueSuffix}${ext}`);
  }
});

// Configuración de almacenamiento para documentos de verificación
const verificationStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, verificationDocsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    const ext = path.extname(file.originalname);
    cb(null, `verification-${uniqueSuffix}${ext}`);
  }
});

// Configuración de almacenamiento temporal
const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    const ext = path.extname(file.originalname);
    cb(null, `temp-${uniqueSuffix}${ext}`);
  }
});

// Filtro para validar tipos de archivos de imagen
const imageFileFilter = (req, file, cb) => {
  // Aceptar solo imágenes
  if (
    file.mimetype === 'image/jpeg' ||
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/webp' ||
    file.mimetype === 'image/gif'
  ) {
    cb(null, true);
  } else {
    cb(new Error('Formato de archivo no soportado. Solo se aceptan imágenes (JPEG, PNG, WEBP, GIF).'), false);
  }
};

// Filtro para documentos de verificación
const documentFileFilter = (req, file, cb) => {
  // Aceptar imágenes y documentos PDF
  if (
    file.mimetype === 'image/jpeg' ||
    file.mimetype === 'image/png' ||
    file.mimetype === 'application/pdf'
  ) {
    cb(null, true);
  } else {
    cb(new Error('Formato de archivo no soportado. Solo se aceptan imágenes (JPEG, PNG) y documentos PDF.'), false);
  }
};

// Configuraciones de Multer
const profileUpload = multer({
  storage: profileStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  }
});

const verificationUpload = multer({
  storage: verificationStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo
  }
});

const tempUpload = multer({
  storage: tempStorage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB máximo
  }
});

// Middleware de manejo de errores para Multer
const handleMulterError = (uploadMiddleware) => {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // Error de Multer
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'El archivo excede el tamaño máximo permitido.'
          });
        }
        logger.error(`Error de Multer: ${err.message}`, { error: err });
        return res.status(400).json({
          success: false,
          message: `Error al subir archivo: ${err.message}`
        });
      } else if (err) {
        // Otro tipo de error
        logger.error(`Error en carga de archivo: ${err.message}`, { error: err });
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      
      // Si no hay error, continuar
      next();
    });
  };
};

// Función para procesar y optimizar imágenes (opcional, requiere sharp)
const processImage = async (filePath, options = {}) => {
  try {
    // Aquí se podría implementar la optimización con sharp
    // Por ejemplo:
    // const sharp = require('sharp');
    // await sharp(filePath)
    //   .resize(options.width || 800)
    //   .jpeg({ quality: options.quality || 80 })
    //   .toFile(outputPath);
    
    logger.info(`[Simulado] Procesando imagen: ${filePath}`);
    return { success: true, path: filePath };
  } catch (error) {
    logger.error(`Error al procesar imagen: ${error.message}`, { error });
    return { success: false, error: error.message };
  }
};

// Función para mover archivo temporal a destino final
const moveFile = (sourcePath, destinationDir, newFilename) => {
  try {
    const ext = path.extname(sourcePath);
    const destinationPath = path.join(destinationDir, `${newFilename}${ext}`);
    
    fs.renameSync(sourcePath, destinationPath);
    
    return {
      success: true,
      path: destinationPath,
      filename: path.basename(destinationPath)
    };
  } catch (error) {
    logger.error(`Error al mover archivo: ${error.message}`, { error });
    return {
      success: false,
      error: error.message
    };
  }
};

// Función para eliminar un archivo
const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`Error al eliminar archivo: ${error.message}`, { error });
    return false;
  }
};

// Middleware para subir una sola imagen de perfil
const uploadProfileImage = handleMulterError(profileUpload.single('image'));

// Middleware para subir múltiples imágenes de perfil (máximo 5)
const uploadProfileImages = handleMulterError(profileUpload.array('images', 5));

// Middleware para subir un solo documento de verificación
const uploadVerificationDocument = handleMulterError(verificationUpload.single('document'));

// Middleware para subir múltiples documentos de verificación (máximo 3)
const uploadVerificationDocuments = handleMulterError(verificationUpload.array('documents', 3));

// Middleware para subir archivos temporales
const uploadTempFile = handleMulterError(tempUpload.single('file'));
const uploadTempFiles = handleMulterError(tempUpload.array('files', 10));

// Función auxiliar para generar URLs para archivos subidos
const getFileUrl = (filename, type = 'profile') => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  let relativePath;

  switch (type) {
    case 'profile':
      relativePath = `/uploads/profiles/${filename}`;
      break;
    case 'verification':
      relativePath = `/uploads/verification/${filename}`;
      break;
    case 'temp':
      relativePath = `/uploads/temp/${filename}`;
      break;
    default:
      relativePath = `/uploads/${filename}`;
  }

  return `${baseUrl}${relativePath}`;
};

// Función para crear versiones redimensionadas de imágenes
const createThumbnail = async (originalPath, options = {}) => {
  try {
    // En una implementación real, usar sharp para crear miniaturas
    // Por ejemplo:
    // const sharp = require('sharp');
    // const pathInfo = path.parse(originalPath);
    // const thumbnailPath = path.join(pathInfo.dir, `${pathInfo.name}-thumb${pathInfo.ext}`);
    // await sharp(originalPath)
    //   .resize(options.width || 200, options.height || 200, { fit: 'cover' })
    //   .toFile(thumbnailPath);
    
    // Simulación
    logger.info(`[Simulado] Creando miniatura para: ${originalPath}`);
    const pathInfo = path.parse(originalPath);
    const thumbnailPath = path.join(pathInfo.dir, `${pathInfo.name}-thumb${pathInfo.ext}`);
    fs.copyFileSync(originalPath, thumbnailPath);
    
    return {
      success: true,
      path: thumbnailPath,
      filename: path.basename(thumbnailPath)
    };
  } catch (error) {
    logger.error(`Error al crear miniatura: ${error.message}`, { error });
    return {
      success: false,
      error: error.message
    };
  }
};

// Función para crear versión mediana de imágenes
const createMediumImage = async (originalPath, options = {}) => {
  try {
    // En una implementación real, usar sharp para crear imágenes medianas
    // Por ejemplo:
    // const sharp = require('sharp');
    // const pathInfo = path.parse(originalPath);
    // const mediumPath = path.join(pathInfo.dir, `${pathInfo.name}-medium${pathInfo.ext}`);
    // await sharp(originalPath)
    //   .resize(options.width || 600, null, { fit: 'inside' })
    //   .toFile(mediumPath);
    
    // Simulación
    logger.info(`[Simulado] Creando imagen mediana para: ${originalPath}`);
    const pathInfo = path.parse(originalPath);
    const mediumPath = path.join(pathInfo.dir, `${pathInfo.name}-medium${pathInfo.ext}`);
    fs.copyFileSync(originalPath, mediumPath);
    
    return {
      success: true,
      path: mediumPath,
      filename: path.basename(mediumPath)
    };
  } catch (error) {
    logger.error(`Error al crear imagen mediana: ${error.message}`, { error });
    return {
      success: false,
      error: error.message
    };
  }
};

// Middleware para manejar una subida de imagen de perfil completa (con procesamiento)
const handleProfileImageUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se subió ninguna imagen'
      });
    }

    // Procesar imagen original
    const processedImage = await processImage(req.file.path, { width: 1200 });
    if (!processedImage.success) {
      throw new Error(`Error al procesar imagen: ${processedImage.error}`);
    }

    // Crear miniatura
    const thumbnail = await createThumbnail(req.file.path);
    if (!thumbnail.success) {
      throw new Error(`Error al crear miniatura: ${thumbnail.error}`);
    }

    // Crear imagen mediana
    const mediumImage = await createMediumImage(req.file.path);
    if (!mediumImage.success) {
      throw new Error(`Error al crear imagen mediana: ${mediumImage.error}`);
    }

    // Agregar URLs a la solicitud
    req.fileUrls = {
      original: getFileUrl(req.file.filename, 'profile'),
      thumbnail: getFileUrl(thumbnail.filename, 'profile'),
      medium: getFileUrl(mediumImage.filename, 'profile')
    };

    next();
  } catch (error) {
    logger.error(`Error en middleware de imágenes: ${error.message}`, { error });
    
    // Limpiar archivos en caso de error
    if (req.file) {
      deleteFile(req.file.path);
    }
    
    return res.status(500).json({
      success: false,
      message: `Error al procesar imagen: ${error.message}`
    });
  }
};

// Limpieza periódica de archivos temporales (puede llamarse desde un cronjob)
const cleanTempUploads = () => {
  try {
    const now = Date.now();
    const files = fs.readdirSync(tempUploadsDir);
    
    let deletedCount = 0;
    files.forEach(file => {
      const filePath = path.join(tempUploadsDir, file);
      const stats = fs.statSync(filePath);
      
      // Eliminar archivos más antiguos de 24 horas
      const fileAge = now - stats.mtime.getTime();
      if (fileAge > 24 * 60 * 60 * 1000) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    });
    
    logger.info(`Limpieza de archivos temporales: ${deletedCount} archivos eliminados`);
    return deletedCount;
  } catch (error) {
    logger.error(`Error al limpiar uploads temporales: ${error.message}`, { error });
    return 0;
  }
};

module.exports = {
  uploadProfileImage,
  uploadProfileImages,
  uploadVerificationDocument,
  uploadVerificationDocuments,
  uploadTempFile,
  uploadTempFiles,
  handleProfileImageUpload,
  processImage,
  moveFile,
  deleteFile,
  getFileUrl,
  createThumbnail,
  createMediumImage,
  cleanTempUploads
};