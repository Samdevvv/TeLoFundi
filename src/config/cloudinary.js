// src/config/cloudinary.js - Configuración centralizada de Cloudinary
const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');

// Configurar Cloudinary
const configureCloudinary = () => {
  const config = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
    // Configuraciones adicionales
    upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET || undefined,
    folder: 'telofundi'
  };

  cloudinary.config(config);

  // Verificar configuración
  if (!config.cloud_name || !config.api_key || !config.api_secret) {
    logger.warn('Cloudinary credentials missing - falling back to local storage');
    return false;
  }

  logger.info('Cloudinary configured successfully', { 
    cloud_name: config.cloud_name,
    folder: config.folder 
  });
  
  return true;
};

// Preset de transformaciones comunes
const TRANSFORMATIONS = {
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
  post_main: {
    width: 1200,
    height: 900,
    crop: 'limit',
    quality: 'auto:good',
    format: 'webp',
    fetch_format: 'auto',
    dpr: 'auto'
  },
  post_thumbnail: {
    width: 400,
    height: 300,
    crop: 'fill',
    quality: 'auto:eco',
    format: 'webp',
    fetch_format: 'auto'
  },
  chat_image: {
    width: 800,
    height: 600,
    crop: 'limit',
    quality: 'auto:good',
    format: 'webp',
    fetch_format: 'auto'
  }
};

// Función para generar URLs con transformaciones
const generateTransformedUrl = (publicId, transformationType = 'post_main') => {
  const transformation = TRANSFORMATIONS[transformationType];
  return cloudinary.url(publicId, { transformation });
};

// Función para crear multiple versiones de una imagen
const createImageVariations = async (publicId) => {
  try {
    const variations = {};
    
    // Crear diferentes tamaños
    Object.keys(TRANSFORMATIONS).forEach(key => {
      if (key !== 'avatar') { // Avatar no necesita variaciones
        variations[key] = generateTransformedUrl(publicId, key);
      }
    });

    return variations;
  } catch (error) {
    logger.error('Error creating image variations:', error);
    return {};
  }
};

// Validar archivo antes de subir
const validateFileForUpload = (file, type = 'image') => {
  const errors = [];
  
  // Validar tamaño según tipo
  const maxSizes = {
    avatar: 3 * 1024 * 1024,      // 3MB
    post: 8 * 1024 * 1024,        // 8MB  
    chat: 5 * 1024 * 1024,        // 5MB
    document: 10 * 1024 * 1024    // 10MB
  };
  
  const maxSize = maxSizes[type] || maxSizes.post;
  if (file.size > maxSize) {
    errors.push(`File too large. Max size: ${maxSize / 1024 / 1024}MB`);
  }
  
  // Validar tipo MIME
  const allowedTypes = {
    image: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  };
  
  const fileType = file.mimetype.startsWith('image/') ? 'image' : 'document';
  if (!allowedTypes[fileType].includes(file.mimetype)) {
    errors.push(`Invalid file type: ${file.mimetype}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Configuración por defecto
const DEFAULT_CONFIG = {
  folders: {
    avatars: 'telofundi/avatars',
    posts: 'telofundi/posts',
    chat: 'telofundi/chat',
    documents: 'telofundi/documents',
    temp: 'telofundi/temp'
  },
  quality: {
    avatar: 'auto:good',
    post: 'auto:good',
    chat: 'auto:good',
    thumbnail: 'auto:eco'
  }
};

module.exports = {
  cloudinary,
  configureCloudinary,
  TRANSFORMATIONS,
  generateTransformedUrl,
  createImageVariations,
  validateFileForUpload,
  DEFAULT_CONFIG
};