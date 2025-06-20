// tests/createAdmin.js
// Script para crear usuario administrador
// Ubicación: backend/tests/createAdmin.js
// Ejecutar desde backend/: node tests/createAdmin.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');

// Configurar Prisma desde tests/ hacia la raíz del proyecto
const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    console.log('🚀 Iniciando creación de usuario administrador...');
    console.log('📁 Ejecutando desde:', __dirname);
    console.log('📁 Directorio de trabajo:', process.cwd());

    // Datos del administrador
    const adminData = {
      email: 'admin@telofundi.com',
      username: 'superadmin',
      firstName: 'Super',
      lastName: 'Admin',
      password: 'Admin123!', // Cambiar por una contraseña segura
      userType: 'ADMIN'
    };

    // Verificar si ya existe un admin con este email
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminData.email }
    });

    if (existingAdmin) {
      console.log('❌ Ya existe un usuario administrador con este email:', adminData.email);
      console.log('💡 Usuario existente:', {
        id: existingAdmin.id,
        email: existingAdmin.email,
        username: existingAdmin.username,
        userType: existingAdmin.userType
      });
      return;
    }

    // Verificar si ya existe un username
    const existingUsername = await prisma.user.findUnique({
      where: { username: adminData.username }
    });

    if (existingUsername) {
      console.log('❌ Ya existe un usuario con este username:', adminData.username);
      return;
    }

    // Hash de la contraseña
    console.log('🔐 Hasheando contraseña...');
    const hashedPassword = await bcrypt.hash(adminData.password, 12);

    // Crear usuario administrador usando transacción
    console.log('📝 Creando usuario administrador...');
    
    const admin = await prisma.$transaction(async (tx) => {
      // 1. Crear usuario base
      const newUser = await tx.user.create({
        data: {
          email: adminData.email.toLowerCase(),
          username: adminData.username,
          firstName: adminData.firstName,
          lastName: adminData.lastName,
          password: hashedPassword,
          userType: 'ADMIN',
          isActive: true,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          lastLogin: new Date(),
          lastActiveAt: new Date(),
          profileViews: 0
        }
      });

      // 2. Crear perfil de administrador
      const adminProfile = await tx.admin.create({
        data: {
          userId: newUser.id,
          role: 'SUPER_ADMIN', // Rol de super administrador
          permissions: [
            'USER_MANAGEMENT',
            'CONTENT_MODERATION',
            'FINANCIAL_MANAGEMENT',
            'SYSTEM_SETTINGS',
            'ANALYTICS_ACCESS',
            'SUPPORT_MANAGEMENT'
          ],
          // Usar los campos correctos según el schema
          canDeletePosts: true,
          canBanUsers: true,
          canModifyPrices: true,
          canAccessMetrics: true,
          totalBans: 0,
          totalReports: 0,
          totalVerifications: 0
        }
      });

      // 3. Crear configuraciones por defecto
      const settings = await tx.userSettings.create({
        data: {
          userId: newUser.id,
          emailNotifications: true,
          pushNotifications: true,
          messageNotifications: true,
          likeNotifications: false, // Admin no necesita notificaciones de likes
          boostNotifications: false,
          showOnline: false, // Admin puede estar oculto
          showLastSeen: false,
          allowDirectMessages: false, // Admin no recibe mensajes directos
          showPhoneNumber: false,
          showInDiscovery: false, // Admin no aparece en descubrimiento
          showInTrending: false,
          showInSearch: false, // Admin no aparece en búsquedas
          contentFilter: 'NONE' // Admin puede ver todo el contenido
        }
      });

      // 4. Crear reputación inicial
      const reputation = await tx.userReputation.create({
        data: {
          userId: newUser.id,
          overallScore: 100.0, // Score máximo para admin
          responseRate: 100.0,
          profileCompleteness: 100.0,
          trustScore: 100.0,
          discoveryScore: 0.0, // No necesita aparecer en discovery
          trendingScore: 0.0,
          qualityScore: 100.0,
          totalViews: 0,
          totalLikes: 0,
          totalMessages: 0,
          totalFavorites: 0,
          lastScoreUpdate: new Date()
        }
      });

      // Retornar usuario completo
      return await tx.user.findUnique({
        where: { id: newUser.id },
        include: {
          admin: true,
          settings: true,
          reputation: true
        }
      });
    });

    console.log('✅ Usuario administrador creado exitosamente!');
    console.log('');
    console.log('📋 DATOS DEL ADMINISTRADOR:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🆔 ID:', admin.id);
    console.log('📧 Email:', admin.email);
    console.log('👤 Username:', admin.username);
    console.log('🏷️ Nombre:', `${admin.firstName} ${admin.lastName}`);
    console.log('🔑 Contraseña:', adminData.password);
    console.log('👑 Tipo:', admin.userType);
    console.log('🛡️ Rol:', admin.admin.role);
    console.log('✅ Activo:', admin.isActive);
    console.log('✉️ Email verificado:', admin.emailVerified);
    console.log('📅 Creado:', admin.createdAt.toISOString());
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('🔐 PERMISOS DEL ADMINISTRADOR:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    admin.admin.permissions.forEach(permission => {
      console.log(`✓ ${permission}`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('💡 PARA CONECTARTE:');
    console.log('1. Usa estas credenciales en el login de tu aplicación');
    console.log('2. El usuario tiene permisos completos de super administrador');
    console.log('3. Cambia la contraseña después del primer login');
    console.log('');
    console.log('⚠️  IMPORTANTE: Guarda estas credenciales en un lugar seguro');

  } catch (error) {
    console.error('❌ Error creando usuario administrador:', error);
    
    // Detalles específicos de errores comunes
    if (error.code === 'P2002') {
      console.error('💡 Error: Ya existe un usuario con este email o username');
      console.error('   Detalle:', error.meta);
    } else if (error.code === 'P2025') {
      console.error('💡 Error: Registro no encontrado - verifica la estructura de la base de datos');
    } else if (error.code === 'P1001') {
      console.error('💡 Error: No se puede conectar a la base de datos');
      console.error('   Verifica que la base de datos esté corriendo y la configuración en .env');
    } else {
      console.error('💡 Error detallado:', error.message);
      console.error('💡 Stack trace:', error.stack);
    }
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Conexión a la base de datos cerrada');
  }
}

// Función para crear múltiples admins con diferentes roles
async function createMultipleAdmins() {
  const adminsToCreate = [
    {
      email: 'admin@telofundi.com',
      username: 'superadmin',
      firstName: 'Super',
      lastName: 'Admin',
      password: 'Admin123!',
      role: 'SUPER_ADMIN'
    },
    {
      email: 'moderator@telofundi.com',
      username: 'moderator',
      firstName: 'Content',
      lastName: 'Moderator',
      password: 'Moderator123!',
      role: 'MODERATOR'
    },
    {
      email: 'support@telofundi.com',
      username: 'support',
      firstName: 'Customer',
      lastName: 'Support',
      password: 'Support123!',
      role: 'SUPPORT'
    }
  ];

  console.log('🚀 Creando múltiples administradores...');
  
  for (const adminData of adminsToCreate) {
    try {
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: adminData.email },
            { username: adminData.username }
          ]
        }
      });

      if (existingUser) {
        console.log(`⏭️  Saltando ${adminData.username} - ya existe`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(adminData.password, 12);

      const admin = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: adminData.email.toLowerCase(),
            username: adminData.username,
            firstName: adminData.firstName,
            lastName: adminData.lastName,
            password: hashedPassword,
            userType: 'ADMIN',
            isActive: true,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            lastLogin: new Date(),
            lastActiveAt: new Date(),
            profileViews: 0
          }
        });

        await tx.admin.create({
          data: {
            userId: newUser.id,
            role: adminData.role,
            permissions: getPermissionsByRole(adminData.role),
            canDeletePosts: adminData.role !== 'SUPPORT',
            canBanUsers: adminData.role !== 'SUPPORT',
            canAccessMetrics: true,
            canModifyPrices: adminData.role === 'SUPER_ADMIN',
            totalBans: 0,
            totalReports: 0,
            totalVerifications: 0
          }
        });

        await tx.userSettings.create({
          data: {
            userId: newUser.id,
            emailNotifications: true,
            pushNotifications: true,
            messageNotifications: true,
            likeNotifications: false,
            boostNotifications: false,
            showOnline: false,
            showLastSeen: false,
            allowDirectMessages: false,
            showPhoneNumber: false,
            showInDiscovery: false,
            showInTrending: false,
            showInSearch: false,
            contentFilter: 'NONE'
          }
        });

        await tx.userReputation.create({
          data: {
            userId: newUser.id,
            overallScore: 100.0,
            responseRate: 100.0,
            profileCompleteness: 100.0,
            trustScore: 100.0,
            discoveryScore: 0.0,
            trendingScore: 0.0,
            qualityScore: 100.0,
            totalViews: 0,
            totalLikes: 0,
            totalMessages: 0,
            totalFavorites: 0,
            lastScoreUpdate: new Date()
          }
        });

        return newUser;
      });

      console.log(`✅ Creado: ${adminData.username} (${adminData.role}) - ${adminData.email}`);
      
    } catch (error) {
      console.error(`❌ Error creando ${adminData.username}:`, error.message);
    }
  }
}

// Función helper para obtener permisos según el rol
function getPermissionsByRole(role) {
  switch (role) {
    case 'SUPER_ADMIN':
      return [
        'USER_MANAGEMENT',
        'CONTENT_MODERATION',
        'FINANCIAL_MANAGEMENT',
        'SYSTEM_SETTINGS',
        'ANALYTICS_ACCESS',
        'SUPPORT_MANAGEMENT'
      ];
    case 'MODERATOR':
      return [
        'CONTENT_MODERATION',
        'USER_MANAGEMENT',
        'ANALYTICS_ACCESS'
      ];
    case 'SUPPORT':
      return [
        'SUPPORT_MANAGEMENT',
        'ANALYTICS_ACCESS'
      ];
    default:
      return ['ANALYTICS_ACCESS'];
  }
}

// Función para eliminar todos los admins (solo para testing)
async function deleteAllAdmins() {
  try {
    console.log('⚠️  ELIMINANDO TODOS LOS ADMINISTRADORES...');
    
    const admins = await prisma.user.findMany({
      where: { userType: 'ADMIN' },
      select: { id: true, email: true, username: true }
    });

    console.log(`📋 Encontrados ${admins.length} administradores`);

    for (const admin of admins) {
      await prisma.$transaction(async (tx) => {
        // Eliminar en orden correcto para evitar errores de FK
        await tx.userReputation.deleteMany({ where: { userId: admin.id } });
        await tx.userSettings.deleteMany({ where: { userId: admin.id } });
        await tx.admin.deleteMany({ where: { userId: admin.id } });
        await tx.user.delete({ where: { id: admin.id } });
      });
      
      console.log(`🗑️  Eliminado: ${admin.username} (${admin.email})`);
    }

    console.log('✅ Todos los administradores eliminados');
    
  } catch (error) {
    console.error('❌ Error eliminando administradores:', error);
  }
}

// Función para verificar la configuración de la base de datos
async function checkDatabaseConnection() {
  try {
    console.log('🔍 Verificando conexión a la base de datos...');
    await prisma.$connect();
    console.log('✅ Conexión exitosa a la base de datos');
    
    // Verificar que las tablas existen (PostgreSQL)
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `;
    console.log('📋 Tablas encontradas en PostgreSQL:', tables.length);
    
    // Verificar que las tablas principales existen
    const requiredTables = ['users', 'admins', 'user_settings', 'user_reputations'];
    const tableNames = tables.map(t => t.table_name);
    
    const missingTables = requiredTables.filter(table => !tableNames.includes(table));
    
    if (missingTables.length > 0) {
      console.warn('⚠️  Tablas faltantes:', missingTables);
      console.warn('💡 Ejecuta: npx prisma migrate dev');
      return false;
    }
    
    console.log('✅ Todas las tablas requeridas están presentes');
    return true;
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error.message);
    console.error('💡 Verifica:');
    console.error('   1. Que el archivo .env existe y tiene DATABASE_URL');
    console.error('   2. Que PostgreSQL está corriendo');
    console.error('   3. Que las migraciones han sido ejecutadas: npx prisma migrate dev');
    console.error('   4. Que la base de datos PostgreSQL está creada');
    console.error('   5. Que las credenciales de conexión son correctas');
    return false;
  }
}

// Función para mostrar ayuda
function showHelp() {
  console.log('🚀 CREADOR DE USUARIO ADMINISTRADOR');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('📁 Ubicación: backend/tests/createAdmin.js');
  console.log('');
  console.log('🔧 USO:');
  console.log('   node tests/createAdmin.js                    # Crear super admin');
  console.log('   node tests/createAdmin.js --multiple         # Crear múltiples roles');
  console.log('   node tests/createAdmin.js --delete-all       # Eliminar todos los admins');
  console.log('   node tests/createAdmin.js --check-db         # Verificar base de datos');
  console.log('   node tests/createAdmin.js --help             # Mostrar esta ayuda');
  console.log('');
  console.log('📋 NPM SCRIPTS (añadir a package.json):');
  console.log('   "create-admin": "node tests/createAdmin.js"');
  console.log('   "create-admins": "node tests/createAdmin.js --multiple"');
  console.log('');
  console.log('🔐 CREDENCIALES POR DEFECTO:');
  console.log('   Email:     admin@telofundi.com');
  console.log('   Username:  superadmin');
  console.log('   Password:  Admin123!');
  console.log('');
  console.log('⚠️  IMPORTANTE: Cambia la contraseña después del primer login');
  console.log('════════════════════════════════════════════════════════════════');
}

// Función principal - manejo de argumentos
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }
  
  if (args.includes('--check-db')) {
    await checkDatabaseConnection();
    return;
  }
  
  if (args.includes('--delete-all')) {
    const isConnected = await checkDatabaseConnection();
    if (isConnected) {
      await deleteAllAdmins();
    }
    return;
  }
  
  if (args.includes('--multiple')) {
    const isConnected = await checkDatabaseConnection();
    if (isConnected) {
      await createMultipleAdmins();
    }
    return;
  }
  
  // Función por defecto - crear un solo admin
  const isConnected = await checkDatabaseConnection();
  if (isConnected) {
    await createAdminUser();
  }
}

// Ejecutar función principal si el script se ejecuta directamente
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Error no capturado:', error);
    process.exit(1);
  });
}

module.exports = {
  createAdminUser,
  createMultipleAdmins,
  deleteAllAdmins,
  checkDatabaseConnection
};