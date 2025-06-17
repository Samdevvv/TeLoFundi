const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

// Configuración de Prisma basada en el entorno
const prismaConfig = {
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
  errorFormat: 'pretty'
};

// Crear instancia de Prisma
const prisma = new PrismaClient(prismaConfig);

// Middleware para logging personalizado
prisma.$use(async (params, next) => {
  const before = Date.now();
  
  try {
    const result = await next(params);
    const after = Date.now();
    
    // Log de queries lentas (más de 1 segundo)
    if (after - before > 1000) {
      logger.logPerformance('Database Query', after - before, {
        model: params.model,
        action: params.action,
        query: params.args
      });
    }
    
    return result;
  } catch (error) {
    const after = Date.now();
    
    // Log de errores de base de datos
    logger.logError(error, {
      model: params.model,
      action: params.action,
      duration: after - before,
      query: params.args
    });
    
    throw error;
  }
});

// Middleware para soft deletes
prisma.$use(async (params, next) => {
  // Interceptar eliminaciones para hacer soft delete
  if (params.action === 'delete') {
    params.action = 'update';
    params.args['data'] = { deletedAt: new Date() };
  }
  
  if (params.action === 'deleteMany') {
    params.action = 'updateMany';
    if (params.args.data != undefined) {
      params.args.data['deletedAt'] = new Date();
    } else {
      params.args['data'] = { deletedAt: new Date() };
    }
  }
  
  return next(params);
});

// Middleware para filtrar registros eliminados (soft delete)
prisma.$use(async (params, next) => {
  const modelsWithSoftDelete = [
    'User', 'Post', 'Message', 'Agency', 'Escort', 'Client', 
    'AgencyMembership', 'AgencyInvitation', 'EscortVerification',
    'Review', 'Report', 'Notification', 'Payment', 'Boost', 'Ban'
  ];
  
  if (modelsWithSoftDelete.includes(params.model)) {
    if (params.action === 'findUnique' || params.action === 'findFirst') {
      params.args.where['deletedAt'] = null;
    }
    
    if (params.action === 'findMany') {
      if (params.args.where) {
        if (params.args.where.deletedAt == undefined) {
          params.args.where['deletedAt'] = null;
        }
      } else {
        params.args['where'] = { deletedAt: null };
      }
    }
    
    if (params.action === 'count') {
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

// Conexión y manejo de eventos
prisma.$connect()
  .then(() => {
    logger.info('🗄️  Conexión a la base de datos establecida correctamente');
  })
  .catch((error) => {
    logger.error('❌ Error al conectar con la base de datos:', error);
    process.exit(1);
  });

// Manejo de eventos de Prisma
prisma.$on('error', (e) => {
  logger.error('Error de Prisma:', e);
});

prisma.$on('warn', (e) => {
  logger.warn('Advertencia de Prisma:', e);
});

if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug(`Query: ${e.query} - Params: ${e.params} - Duration: ${e.duration}ms`);
  });
}

// Función para cerrar conexión gracefully
const closePrisma = async () => {
  await prisma.$disconnect();
  logger.info('🗄️  Conexión a la base de datos cerrada');
};

// Función para verificar la salud de la base de datos
const checkDatabaseHealth = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    logger.error('Database health check failed:', error);
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
    // Eliminar datos de prueba con email de ejemplo
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test'
        }
      }
    });
    
    logger.info('Datos de prueba eliminados correctamente');
  } catch (error) {
    logger.error('Error al limpiar datos de prueba:', error);
    throw error;
  }
};

// Función para estadísticas de la base de datos
const getDatabaseStats = async () => {
  try {
    const stats = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.message.count(),
      prisma.favorite.count(),
      prisma.like.count()
    ]);

    return {
      users: stats[0],
      posts: stats[1],
      messages: stats[2],
      favorites: stats[3],
      likes: stats[4],
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error obteniendo estadísticas de BD:', error);
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