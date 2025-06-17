const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const logger = require('../utils/logger');

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Verificar configuración de Cloudinary
const verifyCloudinaryConfig = () => {
  const { cloud_name, api_key, api_secret } = cloudinary.config();
  
  if (!cloud_name || !api_key || !api_secret) {
    logger.warn('Cloudinary not configured, using local storage');
    return false;
  }
  
  logger.info('Cloudinary configured successfully', { cloud_name });
  return true;
};

const isCloudinaryConfigured = verifyCloudinaryConfig();

// Configuraciones de transformación por tipo de imagen
const transformations = {
  avatar: {
    width: 400,
    height: 400,
    crop: 'fill',
    gravity: 'face',
    quality: 'auto:good',
    format: 'webp',
    fetch_format: 'auto',
    dpr: 'auto'
  },
  post: {
    width: 1200,
    height: 900,
    crop: 'limit',
    quality: 'auto:good',
    format: 'webp',
    fetch_format: 'auto',
    dpr: 'auto'
  },
  thumbnail: {
    width: 300,
    height: 225,
    crop: 'fill',
    quality: 'auto:eco',
    format: 'webp',
    fetch_format: 'auto'
  },
  chat: {
    width: 800,
    height: 600,
    crop: 'limit',
    quality: 'auto:good',
    format: 'webp',
    fetch_format: 'auto'
  },
  document: {
    // Sin transformación para documentos
    resource_type: 'raw'
  }
};

// Función para optimizar imagen con Sharp (antes de subir a Cloudinary)
const optimizeImage = async (buffer, type = 'post') => {
  try {
    const config = transformations[type];
    if (!config || type === 'document') {
      return buffer;
    }

    let sharpInstance = sharp(buffer);
    
    // Obtener metadata de la imagen
    const metadata = await sharpInstance.metadata();
    logger.debug('Image metadata', {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: metadata.size
    });

    // Auto-rotar basado en EXIF
    sharpInstance = sharpInstance.rotate();

    // Redimensionar según configuración
    if (config.width && config.height) {
      sharpInstance = sharpInstance.resize(config.width, config.height, {
        fit: config.crop === 'fill' ? 'cover' : 'inside',
        position: config.gravity || 'center',
        withoutEnlargement: true
      });
    }

    // Aplicar compresión según formato
    let outputBuffer;
    switch (config.format) {
      case 'webp':
        outputBuffer = await sharpInstance
          .webp({ quality: 85, effort: 4 })
          .toBuffer();
        break;
      case 'jpeg':
        outputBuffer = await sharpInstance
          .jpeg({ quality: 85, progressive: true })
          .toBuffer();
        break;
      case 'png':
        outputBuffer = await sharpInstance
          .png({ compressionLevel: 8, adaptiveFiltering: true })
          .toBuffer();
        break;
      default:
        outputBuffer = await sharpInstance.toBuffer();
    }

    logger.debug('Image optimized', {
      originalSize: buffer.length,
      optimizedSize: outputBuffer.length,
      compressionRatio: ((buffer.length - outputBuffer.length) / buffer.length * 100).toFixed(2) + '%'
    });

    return outputBuffer;
  } catch (error) {
    logger.error('Error optimizing image:', error);
    return buffer; // Retornar buffer original si falla la optimización
  }
};

// Función principal para subir a Cloudinary
const uploadToCloudinary = async (file, folder = 'telofundi', options = {}) => {
  try {
    if (!isCloudinaryConfigured) {
      throw new Error('Cloudinary not configured');
    }

    let uploadBuffer;
    let fileType = 'post';
    let mimetype = 'image/jpeg';

    // Manejar diferentes tipos de input
    if (Buffer.isBuffer(file)) {
      uploadBuffer = file;
      mimetype = options.mimetype || 'image/jpeg';
      fileType = options.type || determineFileType(options.fieldname, folder);
    } else if (file.buffer) {
      uploadBuffer = file.buffer;
      mimetype = file.mimetype;
      fileType = determineFileType(file.fieldname, folder);
    } else {
      throw new Error('Invalid file format');
    }
    
    // Determinar tipo de archivo y optimizar si es imagen
    const isImage = mimetype.startsWith('image/');

    if (isImage && !options.skipOptimization) {
      uploadBuffer = await optimizeImage(uploadBuffer, fileType);
    }

    // Generar ID único
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const userId = options.userId || options.public_id?.includes('_') ? options.public_id.split('_')[1] : 'user';
    const publicId = options.public_id || `${fileType}_${userId}_${timestamp}_${random}`;

    // Configurar opciones de subida
    const uploadOptions = {
      folder,
      resource_type: isImage ? 'image' : 'raw',
      public_id: publicId,
      overwrite: false,
      unique_filename: true,
      use_filename: false,
      ...options
    };

    // Aplicar transformaciones específicas para imágenes
    if (isImage && transformations[fileType]) {
      const transform = transformations[fileType];
      uploadOptions.transformation = {
        width: transform.width,
        height: transform.height,
        crop: transform.crop,
        gravity: transform.gravity,
        quality: transform.quality,
        format: transform.format,
        fetch_format: transform.fetch_format,
        dpr: transform.dpr
      };
    }

    // Subir archivo
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      
      uploadStream.end(uploadBuffer);
    });

    // Generar variaciones de la imagen si es necesario
    let variations = {};
    if (isImage && fileType === 'post' && !options.skipVariations) {
      variations = await generateImageVariations(result.public_id);
    }

    const uploadResult = {
      public_id: result.public_id,
      secure_url: result.secure_url,
      url: result.url,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      created_at: result.created_at,
      folder,
      variations,
      optimized: isImage && !options.skipOptimization
    };

    logger.info('File uploaded to Cloudinary successfully', {
      publicId: result.public_id,
      url: result.secure_url,
      size: result.bytes,
      format: result.format,
      folder,
      hasVariations: Object.keys(variations).length > 0
    });

    return uploadResult;

  } catch (error) {
    logger.error('Error uploading to Cloudinary:', error);
    
    // Fallback a almacenamiento local si Cloudinary falla
    if (process.env.NODE_ENV !== 'production') {
      logger.info('Falling back to local storage');
      return await uploadToLocal(file, folder, options);
    }
    
    throw error;
  }
};

// Función para upload múltiple optimizada
const uploadMultipleToCloudinary = async (files, options = {}) => {
  try {
    const uploadPromises = files.map((file, index) => {
      const fileOptions = {
        ...options,
        public_id: `${options.type || 'post'}_${options.userId || 'user'}_${Date.now()}_${index}`,
        skipVariations: index > 0 // Solo generar variaciones para la primera imagen
      };
      
      return uploadToCloudinary(file, options.folder || 'telofundi/posts', fileOptions);
    });

    const results = await Promise.allSettled(uploadPromises);
    
    const successful = results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);
    
    const failed = results
      .filter(result => result.status === 'rejected')
      .map(result => result.reason);

    if (failed.length > 0) {
      logger.warn('Some files failed to upload', {
        successful: successful.length,
        failed: failed.length,
        errors: failed.map(err => err.message)
      });
    }

    return {
      successful,
      failed,
      totalUploaded: successful.length,
      totalFailed: failed.length
    };

  } catch (error) {
    logger.error('Error in multiple upload:', error);
    throw error;
  }
};

// Fallback: subir a almacenamiento local
const uploadToLocal = async (file, folder = 'misc', options = {}) => {
  try {
    const uploadDir = path.join(__dirname, '../../imagenes', folder);
    
    // Crear directorio si no existe
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generar nombre único
    let fileName;
    let fileBuffer;
    
    if (Buffer.isBuffer(file)) {
      const extension = options.mimetype ? options.mimetype.split('/')[1] : 'jpg';
      fileName = generateUniqueFileName(`file.${extension}`);
      fileBuffer = file;
    } else {
      fileName = generateUniqueFileName(file.originalname);
      fileBuffer = file.buffer;
    }
    
    const filePath = path.join(uploadDir, fileName);

    // Guardar archivo
    await fs.promises.writeFile(filePath, fileBuffer);

    const result = {
      public_id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      secure_url: `/uploads/${folder}/${fileName}`,
      url: `/uploads/${folder}/${fileName}`,
      format: path.extname(fileName).slice(1),
      bytes: fileBuffer.length,
      created_at: new Date().toISOString(),
      folder: 'local',
      local: true
    };

    logger.info('File uploaded to local storage', {
      path: filePath,
      size: fileBuffer.length,
      fileName
    });

    return result;

  } catch (error) {
    logger.error('Error uploading to local storage:', error);
    throw error;
  }
};

// Generar variaciones de imagen (thumbnails, etc.)
const generateImageVariations = async (publicId) => {
  try {
    const variations = {};

    // Thumbnail
    variations.thumbnail = cloudinary.url(publicId, {
      transformation: [
        { width: 300, height: 225, crop: 'fill', quality: 'auto:eco', format: 'webp' }
      ]
    });

    // Small
    variations.small = cloudinary.url(publicId, {
      transformation: [
        { width: 600, height: 450, crop: 'limit', quality: 'auto:good', format: 'webp' }
      ]
    });

    // Medium
    variations.medium = cloudinary.url(publicId, {
      transformation: [
        { width: 900, height: 675, crop: 'limit', quality: 'auto:good', format: 'webp' }
      ]
    });

    return variations;
  } catch (error) {
    logger.error('Error generating image variations:', error);
    return {};
  }
};

// Eliminar archivo de Cloudinary
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    if (!isCloudinaryConfigured) {
      logger.warn('Cannot delete from Cloudinary - not configured');
      return { success: false, error: 'Cloudinary not configured' };
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true
    });

    logger.info('File deleted from Cloudinary', {
      publicId,
      result: result.result
    });

    return { success: result.result === 'ok', result };

  } catch (error) {
    logger.error('Error deleting from Cloudinary:', error);
    return { success: false, error: error.message };
  }
};

// Eliminar múltiples archivos de Cloudinary
const deleteManyFromCloudinary = async (publicIds, resourceType = 'image') => {
  try {
    if (!isCloudinaryConfigured || !publicIds || publicIds.length === 0) {
      return { success: false, error: 'Cloudinary not configured or no IDs provided' };
    }

    const result = await cloudinary.api.delete_resources(publicIds, {
      resource_type: resourceType
    });

    logger.info('Multiple files deleted from Cloudinary', {
      count: publicIds.length,
      deleted: Object.keys(result.deleted).length
    });

    return { success: true, result };

  } catch (error) {
    logger.error('Error deleting multiple files from Cloudinary:', error);
    return { success: false, error: error.message };
  }
};

// Obtener información de archivo en Cloudinary
const getCloudinaryFileInfo = async (publicId, resourceType = 'image') => {
  try {
    if (!isCloudinaryConfigured) {
      return null;
    }

    const result = await cloudinary.api.resource(publicId, {
      resource_type: resourceType
    });

    return {
      public_id: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      created_at: result.created_at,
      secure_url: result.secure_url
    };

  } catch (error) {
    logger.error('Error getting Cloudinary file info:', error);
    return null;
  }
};

// Transformar imagen existente en Cloudinary
const transformCloudinaryImage = async (publicId, transformations) => {
  try {
    if (!isCloudinaryConfigured) {
      throw new Error('Cloudinary not configured');
    }

    const transformedUrl = cloudinary.url(publicId, {
      transformation: transformations
    });

    return transformedUrl;

  } catch (error) {
    logger.error('Error transforming Cloudinary image:', error);
    throw error;
  }
};

// Funciones auxiliares

const determineFileType = (fieldname, folder) => {
  if (fieldname === 'avatar' || folder.includes('avatar')) return 'avatar';
  if (fieldname === 'images' || fieldname === 'postImages' || folder.includes('post')) return 'post';
  if (fieldname === 'documents' || folder.includes('document')) return 'document';
  if (folder.includes('chat')) return 'chat';
  return 'post'; // Por defecto
};

const generatePublicId = (originalName) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  const nameWithoutExt = path.parse(originalName).name
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 20);
  
  return `${timestamp}_${nameWithoutExt}_${random}`;
};

const generateUniqueFileName = (originalName) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  const ext = path.extname(originalName);
  const nameWithoutExt = path.parse(originalName).name
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 20);
  
  return `${timestamp}_${nameWithoutExt}_${random}${ext}`;
};

// Validar tipo de archivo
const validateFileType = (file, allowedTypes = []) => {
  if (allowedTypes.length === 0) return true;
  
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype.toLowerCase();
  
  return allowedTypes.some(type => {
    if (type.startsWith('.')) {
      return fileExtension === type;
    }
    return mimeType.includes(type);
  });
};

// Validar tamaño de archivo
const validateFileSize = (file, maxSize) => {
  return file.buffer.length <= maxSize;
};

// Obtener estadísticas de uso de Cloudinary
const getCloudinaryUsage = async () => {
  try {
    if (!isCloudinaryConfigured) {
      return null;
    }

    const usage = await cloudinary.api.usage();
    
    return {
      plan: usage.plan,
      credits: usage.credits,
      objects: usage.objects,
      bandwidth: usage.bandwidth,
      storage: usage.storage,
      requests: usage.requests,
      resources: usage.resources,
      derived_resources: usage.derived_resources
    };

  } catch (error) {
    logger.error('Error getting Cloudinary usage:', error);
    return null;
  }
};

// Limpiar archivos temporales no utilizados
const cleanupUnusedFiles = async (olderThanDays = 7) => {
  try {
    if (!isCloudinaryConfigured) {
      return { success: false, error: 'Cloudinary not configured' };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // Buscar archivos antiguos en la carpeta temp
    const searchResult = await cloudinary.search
      .expression(`folder:telofundi/temp AND created_at<${cutoffDate.toISOString()}`)
      .sort_by([['created_at', 'desc']])
      .max_results(100)
      .execute();

    const publicIds = searchResult.resources.map(resource => resource.public_id);

    if (publicIds.length > 0) {
      const deleteResult = await deleteManyFromCloudinary(publicIds);
      
      logger.info('Cleanup completed', {
        filesFound: searchResult.total_count,
        filesDeleted: publicIds.length,
        olderThanDays
      });

      return { success: true, deleted: publicIds.length };
    }

    return { success: true, deleted: 0 };

  } catch (error) {
    logger.error('Error during cleanup:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  uploadToLocal,
  deleteFromCloudinary,
  deleteManyFromCloudinary,
  getCloudinaryFileInfo,
  transformCloudinaryImage,
  generateImageVariations,
  optimizeImage,
  validateFileType,
  validateFileSize,
  getCloudinaryUsage,
  cleanupUnusedFiles,
  isCloudinaryConfigured
};