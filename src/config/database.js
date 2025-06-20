const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

// ✅ CONFIGURACIÓN OPTIMIZADA DE PRISMA - SIN LOGS GIGANTESCOS
const prismaConfig = {
  // 🔥 CAMBIO PRINCIPAL: Solo errores en desarrollo, nada en producción
  log: process.env.NODE_ENV === 'development' 
    ? [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' }
      ]
    : [],
  errorFormat: 'minimal' // ✅ Cambiar de 'pretty' a 'minimal'
};

// Crear instancia de Prisma
const prisma = new PrismaClient(prismaConfig);

// ✅ MIDDLEWARE OPTIMIZADO - LOGS CONCISOS
prisma.$use(async (params, next) => {
  const before = Date.now();
  
  try {
    const result = await next(params);
    const duration = Date.now() - before;
    
    // Solo log queries lentas (más de 500ms)
    if (duration > 500) {
      logger.warn(`🐌 Slow DB Query: ${params.model}.${params.action} - ${duration}ms`, {
        model: params.model,
        action: params.action,
        duration: `${duration}ms`
      });
    }
    
    // Log muy conciso para desarrollo
    if (process.env.NODE_ENV === 'development' && duration > 100) {
      logger.debug(`🔍 DB Query: ${params.model}.${params.action} - ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - before;
    
    // Log de errores de base de datos - CONCISO
    logger.error(`💥 DB Error: ${params.model}.${params.action}`, {
      model: params.model,
      action: params.action,
      duration: `${duration}ms`,
      error: error.message
    });
    
    throw error;
  }
});

// ✅ CORREGIDO: Lista actualizada SOLO con modelos que tienen deletedAt en el schema
const modelsWithDeletedAt = [
  'User', 'Post', 'Message', 
  'AgencyMembership', 'AgencyInvitation', 'EscortVerification',
  'Review', 'Report', 'Notification', 'Payment', 'Boost', 'Ban'
  // ❌ REMOVIDO: 'Escort', 'Client' - estos NO tienen deletedAt en el schema
];

// ✅ CORREGIDO: Middleware para soft deletes - SOLO modelos que TIENEN deletedAt
prisma.$use(async (params, next) => {
  if (params.action === 'delete' && modelsWithDeletedAt.includes(params.model)) {
    params.action = 'update';
    params.args['data'] = { deletedAt: new Date() };
  }
  
  if (params.action === 'deleteMany' && modelsWithDeletedAt.includes(params.model)) {
    params.action = 'updateMany';
    if (params.args.data != undefined) {
      params.args.data['deletedAt'] = new Date();
    } else {
      params.args['data'] = { deletedAt: new Date() };
    }
  }
  
  return next(params);
});

// ✅ CORREGIDO: Middleware para filtrar registros eliminados - SOLO modelos con deletedAt
prisma.$use(async (params, next) => {
  // ✅ VERIFICAR que el modelo esté en la lista de modelos con deletedAt
  if (modelsWithDeletedAt.includes(params.model)) {
    if (params.action === 'findUnique' || params.action === 'findFirst') {
      // ✅ VERIFICAR que args.where existe antes de agregar deletedAt
      if (!params.args) {
        params.args = {};
      }
      if (!params.args.where) {
        params.args.where = {};
      }
      params.args.where['deletedAt'] = null;
    }
    
    if (params.action === 'findMany') {
      if (!params.args) {
        params.args = {};
      }
      if (params.args.where) {
        if (params.args.where.deletedAt == undefined) {
          params.args.where['deletedAt'] = null;
        }
      } else {
        params.args['where'] = { deletedAt: null };
      }
    }
    
    if (params.action === 'count') {
      if (!params.args) {
        params.args = {};
      }
      if (params.args.where) {
        if (params.args.where.deletedAt == undefined) {
          params.args.where['deletedAt'] = null;
        }
      } else {
        params.args['where'] = { deletedAt: null };
      }
    }
  }
  
  return next(params);
});

// ✅ EVENTOS DE PRISMA OPTIMIZADOS - LOGS CONCISOS
prisma.$on('error', (e) => {
  logger.error('💥 Prisma Error:', {
    message: e.message,
    timestamp: new Date().toISOString()
  });
});

prisma.$on('warn', (e) => {
  logger.warn('⚠️  Prisma Warning:', {
    message: e.message,
    timestamp: new Date().toISOString()
  });
});

// ✅ ELIMINADO: El evento 'query' que causaba logs gigantescos
// Ya no hay prisma.$on('query') que imprimía las consultas completas

// Conexión optimizada
prisma.$connect()
  .then(() => {
    logger.info('🗄️  Database connected successfully');
  })
  .catch((error) => {
    logger.error('❌ Database connection failed:', { error: error.message });
    process.exit(1);
  });

// Función para cerrar conexión gracefully
const closePrisma = async () => {
  await prisma.$disconnect();
  logger.info('🗄️  Database connection closed');
};

// Función para verificar la salud de la base de datos
const checkDatabaseHealth = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    logger.error('Database health check failed:', { error: error.message });
    return { 
      status: 'unhealthy', 
      error: error.message,
      timestamp: new Date().toISOString() 
    };
  }
};

// Función para limpiar datos de prueba (solo en desarrollo)
const cleanupTestData = async () => {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Cleanup solo disponible en desarrollo');
  }
  
  try {
    const deleted = await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test'
        }
      }
    });
    
    logger.info(`🧹 Test data cleanup: ${deleted.count} records deleted`);
    return deleted.count;
  } catch (error) {
    logger.error('Error cleaning test data:', { error: error.message });
    throw error;
  }
};

// Función para estadísticas de la base de datos
const getDatabaseStats = async () => {
  try {
    const [users, posts, messages, favorites, likes] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.message.count(),
      prisma.favorite.count(),
      prisma.like.count()
    ]);

    const stats = {
      users,
      posts,
      messages,
      favorites,
      likes,
      timestamp: new Date().toISOString()
    };

    logger.info('📊 Database stats retrieved', stats);
    return stats;
  } catch (error) {
    logger.error('Error getting database stats:', { error: error.message });
    throw error;
  }
};

module.exports = {
  prisma,
  closePrisma,
  checkDatabaseHealth,
  cleanupTestData,
  getDatabaseStats
};