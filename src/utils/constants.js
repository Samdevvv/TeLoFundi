// Tipos de usuario
const USER_TYPES = {
  ESCORT: 'ESCORT',
  AGENCY: 'AGENCY',
  CLIENT: 'CLIENT',
  ADMIN: 'ADMIN'
};

// Roles de admin
const ADMIN_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MODERATOR: 'MODERATOR'
};

// Tiers premium para clientes
const PREMIUM_TIERS = {
  BASIC: 'BASIC',
  PREMIUM: 'PREMIUM',
  VIP: 'VIP'
};

// Estados de membresía en agencias
const MEMBERSHIP_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED'
};

// Estados de invitaciones
const INVITATION_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED'
};

// Estados de verificación
const VERIFICATION_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED'
};

// Tipos de mensaje
const MESSAGE_TYPES = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  FILE: 'FILE',
  AUDIO: 'AUDIO',
  VIDEO: 'VIDEO',
  SYSTEM: 'SYSTEM',
  LOCATION: 'LOCATION',
  CONTACT: 'CONTACT'
};

// Razones de reporte
const REPORT_REASONS = {
  SPAM: 'SPAM',
  INAPPROPRIATE_CONTENT: 'INAPPROPRIATE_CONTENT',
  FAKE_PROFILE: 'FAKE_PROFILE',
  SCAM: 'SCAM',
  HARASSMENT: 'HARASSMENT',
  COPYRIGHT: 'COPYRIGHT',
  UNDERAGE: 'UNDERAGE',
  VIOLENCE: 'VIOLENCE',
  FRAUD: 'FRAUD',
  IMPERSONATION: 'IMPERSONATION',
  ADULT_CONTENT: 'ADULT_CONTENT',
  OTHER: 'OTHER'
};

// Estados de reporte
const REPORT_STATUS = {
  PENDING: 'PENDING',
  REVIEWED: 'REVIEWED',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
  ESCALATED: 'ESCALATED'
};

// Tipos de notificación
const NOTIFICATION_TYPES = {
  MESSAGE: 'MESSAGE',
  LIKE: 'LIKE',
  FAVORITE: 'FAVORITE',
  REVIEW: 'REVIEW',
  BOOST_EXPIRED: 'BOOST_EXPIRED',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  AGENCY_INVITE: 'AGENCY_INVITE',
  VERIFICATION_COMPLETED: 'VERIFICATION_COMPLETED',
  MEMBERSHIP_REQUEST: 'MEMBERSHIP_REQUEST',
  SYSTEM: 'SYSTEM',
  TRENDING: 'TRENDING',
  PROMOTION: 'PROMOTION',
  SECURITY_ALERT: 'SECURITY_ALERT',
  SUBSCRIPTION_EXPIRING: 'SUBSCRIPTION_EXPIRING',
  NEW_FOLLOWER: 'NEW_FOLLOWER',
  POST_APPROVED: 'POST_APPROVED',
  POST_REJECTED: 'POST_REJECTED'
};

// Estados de pago
const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  CANCELLED: 'CANCELLED',
  DISPUTED: 'DISPUTED',
  PROCESSING: 'PROCESSING'
};

// Tipos de pago
const PAYMENT_TYPES = {
  BOOST: 'BOOST',
  PREMIUM: 'PREMIUM',
  POINTS: 'POINTS',
  VERIFICATION: 'VERIFICATION',
  SUBSCRIPTION: 'SUBSCRIPTION',
  TIP: 'TIP',
  COMMISSION: 'COMMISSION'
};

// Tipos de boost
const BOOST_TYPES = {
  BASIC: 'BASIC',      // 24 horas
  PREMIUM: 'PREMIUM',  // 48 horas  
  FEATURED: 'FEATURED', // 72 horas
  SUPER: 'SUPER',      // 7 días
  MEGA: 'MEGA'         // 30 días
};

// Configuración de boost
const BOOST_CONFIG = {
  [BOOST_TYPES.BASIC]: {
    duration: 24 * 60 * 60 * 1000, // 24 horas en ms
    price: 5.00,
    multiplier: 1.5,
    name: 'Boost Básico'
  },
  [BOOST_TYPES.PREMIUM]: {
    duration: 48 * 60 * 60 * 1000, // 48 horas en ms
    price: 8.00,
    multiplier: 2.0,
    name: 'Boost Premium'
  },
  [BOOST_TYPES.FEATURED]: {
    duration: 72 * 60 * 60 * 1000, // 72 horas en ms
    price: 12.00,
    multiplier: 2.5,
    name: 'Boost Destacado'
  },
  [BOOST_TYPES.SUPER]: {
    duration: 7 * 24 * 60 * 60 * 1000, // 7 días en ms
    price: 25.00,
    multiplier: 3.0,
    name: 'Super Boost'
  },
  [BOOST_TYPES.MEGA]: {
    duration: 30 * 24 * 60 * 60 * 1000, // 30 días en ms
    price: 80.00,
    multiplier: 4.0,
    name: 'Mega Boost'
  }
};

// Configuración de puntos
const POINTS_CONFIG = {
  // Acciones que cuestan puntos (para clientes)
  COSTS: {
    CHAT_MESSAGE: 1,
    PROFILE_VIEW: 2,
    PHONE_NUMBER_ACCESS: 5,
    IMAGE_MESSAGE: 3,
    PRIORITY_SUPPORT: 10,
    TIP: 1 // Por punto enviado como tip
  },
  
  // Paquetes de compra de puntos
  PACKAGES: {
    BASIC: { points: 50, price: 5.00 },
    STANDARD: { points: 120, price: 10.00 },
    PREMIUM: { points: 300, price: 20.00 },
    VIP: { points: 750, price: 45.00 },
    MEGA: { points: 1500, price: 80.00 }
  },
  
  // Puntos ganados por acciones (para escorts/agencias)
  REWARDS: {
    PROFILE_COMPLETION: 10,
    FIRST_POST: 5,
    EMAIL_VERIFICATION: 5,
    PHONE_VERIFICATION: 10,
    IDENTITY_VERIFICATION: 25
  }
};

// Configuración de clientes por tier
const CLIENT_TIER_CONFIG = {
  [PREMIUM_TIERS.BASIC]: {
    dailyMessageLimit: 10,
    canViewPhoneNumbers: false,
    canSendImages: false,
    canSendVoiceMessages: false,
    canAccessPremiumProfiles: false,
    prioritySupport: false,
    canSeeOnlineStatus: false,
    monthlyPrice: 0
  },
  [PREMIUM_TIERS.PREMIUM]: {
    dailyMessageLimit: 50,
    canViewPhoneNumbers: true,
    canSendImages: true,
    canSendVoiceMessages: false,
    canAccessPremiumProfiles: true,
    prioritySupport: false,
    canSeeOnlineStatus: true,
    monthlyPrice: 19.99
  },
  [PREMIUM_TIERS.VIP]: {
    dailyMessageLimit: -1, // Ilimitado
    canViewPhoneNumbers: true,
    canSendImages: true,
    canSendVoiceMessages: true,
    canAccessPremiumProfiles: true,
    prioritySupport: true,
    canSeeOnlineStatus: true,
    monthlyPrice: 49.99
  }
};

// Límites de la aplicación
const APP_LIMITS = {
  // Posts
  ESCORT_MAX_POSTS: 5,
  AGENCY_MAX_POSTS: -1, // Ilimitado
  POST_MAX_IMAGES: 5,
  POST_TITLE_MAX_LENGTH: 100,
  POST_DESCRIPTION_MAX_LENGTH: 2000,
  
  // Perfil
  BIO_MAX_LENGTH: 500,
  SERVICES_MAX_COUNT: 15,
  LANGUAGES_MAX_COUNT: 10,
  
  // Chat
  MESSAGE_MAX_LENGTH: 2000,
  CHAT_RATE_LIMIT_PER_MINUTE: 30,
  
  // Archivos
  IMAGE_MAX_SIZE: 5 * 1024 * 1024, // 5MB
  FILE_MAX_SIZE: 10 * 1024 * 1024, // 10MB
  VIDEO_MAX_SIZE: 50 * 1024 * 1024, // 50MB
  
  // Búsqueda
  SEARCH_QUERY_MAX_LENGTH: 100,
  SEARCH_RESULTS_PER_PAGE: 20,
  
  // Rate limiting
  API_RATE_LIMIT_PER_15MIN: 100,
  AUTH_RATE_LIMIT_PER_15MIN: 5,
  UPLOAD_RATE_LIMIT_PER_15MIN: 20
};

// Formatos de archivo permitidos
const ALLOWED_FILE_TYPES = {
  IMAGES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  DOCUMENTS: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  AUDIO: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
  VIDEO: ['video/mp4', 'video/webm', 'video/quicktime']
};

// URLs de términos y políticas
const LEGAL_URLS = {
  TERMS_OF_SERVICE: '/terms',
  PRIVACY_POLICY: '/privacy',
  COMMUNITY_GUIDELINES: '/guidelines',
  SAFETY_TIPS: '/safety'
};

// Configuración de SEO
const SEO_CONFIG = {
  DEFAULT_TITLE: 'TeLoFundi - Plataforma de Conexión',
  DEFAULT_DESCRIPTION: 'Conecta con escorts, agencias y clientes de manera segura y confiable',
  DEFAULT_KEYWORDS: 'escorts, agencias, clientes, conexión, seguro',
  DEFAULT_IMAGE: '/images/og-image.jpg'
};

// Códigos de error personalizados
const ERROR_CODES = {
  // Autenticación
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  ACCOUNT_BANNED: 'ACCOUNT_BANNED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  
  // Validación
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  USERNAME_EXISTS: 'USERNAME_EXISTS',
  
  // Permisos
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_FORBIDDEN: 'RESOURCE_FORBIDDEN',
  
  // Límites
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  POST_LIMIT_EXCEEDED: 'POST_LIMIT_EXCEEDED',
  MESSAGE_LIMIT_EXCEEDED: 'MESSAGE_LIMIT_EXCEEDED',
  FILE_SIZE_EXCEEDED: 'FILE_SIZE_EXCEEDED',
  
  // Recursos
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  POST_NOT_FOUND: 'POST_NOT_FOUND',
  CHAT_NOT_FOUND: 'CHAT_NOT_FOUND',
  
  // Pagos
  INSUFFICIENT_POINTS: 'INSUFFICIENT_POINTS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED'
};

// Eventos del sistema
const SYSTEM_EVENTS = {
  USER_REGISTERED: 'user.registered',
  USER_VERIFIED: 'user.verified',
  POST_CREATED: 'post.created',
  POST_BOOSTED: 'post.boosted',
  MESSAGE_SENT: 'message.sent',
  PAYMENT_COMPLETED: 'payment.completed',
  REPORT_SUBMITTED: 'report.submitted',
  USER_BANNED: 'user.banned'
};

module.exports = {
  USER_TYPES,
  ADMIN_ROLES,
  PREMIUM_TIERS,
  MEMBERSHIP_STATUS,
  INVITATION_STATUS,
  VERIFICATION_STATUS,
  MESSAGE_TYPES,
  REPORT_REASONS,
  REPORT_STATUS,
  NOTIFICATION_TYPES,
  PAYMENT_STATUS,
  PAYMENT_TYPES,
  BOOST_TYPES,
  BOOST_CONFIG,
  POINTS_CONFIG,
  CLIENT_TIER_CONFIG,
  APP_LIMITS,
  ALLOWED_FILE_TYPES,
  LEGAL_URLS,
  SEO_CONFIG,
  ERROR_CODES,
  SYSTEM_EVENTS
};