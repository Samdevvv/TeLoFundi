const crypto = require('crypto');
const { APP_LIMITS } = require('./constants');

// Función para generar respuestas paginadas estándar
const createPaginatedResponse = (data, page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total),
      totalPages,
      hasNext,
      hasPrev,
      nextPage: hasNext ? page + 1 : null,
      prevPage: hasPrev ? page - 1 : null
    }
  };
};

// Función para generar respuesta exitosa estándar
const createSuccessResponse = (data, message = 'Operación exitosa') => {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };
};

// Función para generar respuesta de error estándar
const createErrorResponse = (message, errorCode = null, errors = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  if (errorCode) {
    response.errorCode = errorCode;
  }

  if (errors) {
    response.errors = errors;
  }

  return response;
};

// Función para limpiar objeto de datos sensibles
const sanitizeUser = (user, includeEmail = false) => {
  const sanitized = {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    avatar: user.avatar,
    userType: user.userType,
    bio: user.bio,
    phone: user.phone,
    website: user.website,
    isActive: user.isActive,
    profileViews: user.profileViews,
    createdAt: user.createdAt,
    lastActiveAt: user.lastActiveAt,
    location: user.location
  };

  if (includeEmail) {
    sanitized.email = user.email;
  }

  // Agregar datos específicos del tipo de usuario
  if (user.escort) sanitized.escort = user.escort;
  if (user.agency) sanitized.agency = user.agency;
  if (user.client && includeEmail) sanitized.client = user.client; // Solo incluir si es el propio usuario
  if (user.admin && includeEmail) sanitized.admin = user.admin;
  if (user.settings && includeEmail) sanitized.settings = user.settings;
  if (user.reputation) sanitized.reputation = user.reputation;

  return sanitized;
};

// Función para generar slug único
const generateSlug = (text, maxLength = 50) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remover caracteres especiales
    .replace(/[\s_-]+/g, '-') // Reemplazar espacios y guiones con un guión
    .replace(/^-+|-+$/g, '') // Remover guiones al inicio y final
    .substring(0, maxLength);
};

// Función para generar ID único corto
const generateShortId = (length = 8) => {
  return crypto.randomBytes(length).toString('hex').substring(0, length);
};

// Función para calcular distancia entre dos coordenadas (Haversine)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radio de la Tierra en km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distancia en km
};

const toRadians = (degrees) => {
  return degrees * (Math.PI/180);
};

// Función para formatear números grandes
const formatNumber = (num) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

// Función para formatear duración en texto legible
const formatDuration = (milliseconds) => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} día${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hora${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} minuto${minutes > 1 ? 's' : ''}`;
  return `${seconds} segundo${seconds > 1 ? 's' : ''}`;
};

// Función para calcular tiempo relativo
const getRelativeTime = (date) => {
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'hace un momento';
  if (diffMinutes < 60) return `hace ${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''}`;
  if (diffHours < 24) return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 7) return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  if (diffDays < 30) return `hace ${Math.floor(diffDays / 7)} semana${Math.floor(diffDays / 7) > 1 ? 's' : ''}`;
  if (diffDays < 365) return `hace ${Math.floor(diffDays / 30)} mes${Math.floor(diffDays / 30) > 1 ? 'es' : ''}`;
  return `hace ${Math.floor(diffDays / 365)} año${Math.floor(diffDays / 365) > 1 ? 's' : ''}`;
};

// Función para validar y parsear coordenadas
const parseCoordinates = (latitude, longitude) => {
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  
  if (isNaN(lat) || isNaN(lon)) {
    return null;
  }
  
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return null;
  }
  
  return { latitude: lat, longitude: lon };
};

// Función para generar hash de archivo
const generateFileHash = (buffer) => {
  return crypto.createHash('md5').update(buffer).digest('hex');
};

// Función para obtener extensión de archivo
const getFileExtension = (filename) => {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toLowerCase();
};

// Función para validar tipo MIME
const isValidMimeType = (mimeType, allowedTypes) => {
  return allowedTypes.includes(mimeType);
};

// Función para generar nombre de archivo único
const generateUniqueFilename = (originalName) => {
  const extension = getFileExtension(originalName);
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  return `${timestamp}-${randomString}.${extension}`;
};

// Función para calcular score de trending
const calculateTrendingScore = (views, likes, comments, createdAt, lastBoosted = null) => {
  const now = new Date();
  const ageHours = (now - new Date(createdAt)) / (1000 * 60 * 60);
  const boostMultiplier = lastBoosted && (now - new Date(lastBoosted)) < 24 * 60 * 60 * 1000 ? 2 : 1;
  
  // Fórmula de trending similar a Reddit/HackerNews
  const engagementScore = (likes * 2) + (comments * 3) + views;
  const timeDecay = Math.pow(ageHours + 2, 1.8);
  
  return (engagementScore * boostMultiplier) / timeDecay;
};

// Función para calcular score de descubrimiento
const calculateDiscoveryScore = (profileCompleteness, trustScore, recentActivity, userType) => {
  const baseScore = (profileCompleteness * 0.3) + (trustScore * 0.4) + (recentActivity * 0.3);
  
  // Multiplayer según tipo de usuario
  const typeMultiplier = {
    'ESCORT': 1.2,
    'AGENCY': 1.1,
    'CLIENT': 0.8
  };
  
  return baseScore * (typeMultiplier[userType] || 1);
};

// Función para obtener configuración de paginación
const getPaginationConfig = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(
    APP_LIMITS.SEARCH_RESULTS_PER_PAGE,
    Math.max(1, parseInt(query.limit) || APP_LIMITS.SEARCH_RESULTS_PER_PAGE)
  );
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
};

// Función para obtener configuración de ordenamiento
const getSortConfig = (query, defaultSort = 'createdAt', defaultOrder = 'desc') => {
  const sortBy = query.sortBy || defaultSort;
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
  
  return { [sortBy]: sortOrder };
};

// Función para escapar texto para búsqueda
const escapeSearchText = (text) => {
  return text
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escapar caracteres especiales de regex
    .trim();
};

// Función para dividir array en chunks
const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

// Función para delay/sleep
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Función para retry con backoff exponencial
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i === maxRetries) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, i);
      await sleep(delay);
    }
  }
};

// Función para validar email format (más específica)
const isValidEmailFormat = (email) => {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
};

// Función para generar código de verificación numérico
const generateVerificationCode = (length = 6) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Función para generar color aleatorio en hexadecimal
const generateRandomColor = () => {
  return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
};

// Función para calcular porcentaje de similitud entre strings
const calculateStringSimilarity = (str1, str2) => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

// Función para calcular distancia de edición (Levenshtein)
const getEditDistance = (str1, str2) => {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

module.exports = {
  createPaginatedResponse,
  createSuccessResponse,
  createErrorResponse,
  sanitizeUser,
  generateSlug,
  generateShortId,
  calculateDistance,
  formatNumber,
  formatDuration,
  getRelativeTime,
  parseCoordinates,
  generateFileHash,
  getFileExtension,
  isValidMimeType,
  generateUniqueFilename,
  calculateTrendingScore,
  calculateDiscoveryScore,
  getPaginationConfig,
  getSortConfig,
  escapeSearchText,
  chunkArray,
  sleep,
  retryWithBackoff,
  isValidEmailFormat,
  generateVerificationCode,
  generateRandomColor,
  calculateStringSimilarity,
  getEditDistance
};