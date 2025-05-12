// prisma/setup.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Script para inicializar la base de datos con datos básicos
 */
async function main() {
  console.log('Inicializando la base de datos...');

  try {
    // Crear un usuario administrador
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@telofundi.com' },
      update: {},
      create: {
        email: 'admin@telofundi.com',
        passwordHash: '$2b$10$GJQyBj7A6Mm9VWRJ3VJbZO6TjYI4NXy5FKlugdoGMdWN.jFeCZiG.', // "admin123"
        role: 'admin',
        emailVerified: true,
        isActive: true,
      },
    });

    console.log('Usuario administrador creado:', adminUser.id);

    // Crear roles base
    const roles = [
      { name: 'superadmin', description: 'Super Administrador con todos los permisos', isSystem: true },
      { name: 'admin', description: 'Administrador del sistema', isSystem: true },
      { name: 'moderator', description: 'Moderador de contenido', isSystem: true },
      { name: 'client', description: 'Cliente registrado', isSystem: true },
      { name: 'profile', description: 'Perfil de acompañante', isSystem: true },
      { name: 'agency', description: 'Agencia de acompañantes', isSystem: true },
    ];

    for (const role of roles) {
      await prisma.role.upsert({
        where: { name: role.name },
        update: role,
        create: role,
      });
    }

    console.log('Roles base creados');

    // Asignar rol de superadmin al usuario administrador
    await prisma.userRoleMapping.upsert({
      where: {
        userId_roleId: {
          userId: adminUser.id,
          roleId: (await prisma.role.findUnique({ where: { name: 'superadmin' } })).id,
        },
      },
      update: {},
      create: {
        userId: adminUser.id,
        roleId: (await prisma.role.findUnique({ where: { name: 'superadmin' } })).id,
        createdBy: adminUser.id,
      },
    });

    console.log('Rol asignado al administrador');

    // Inicializar configuración del sistema
    await prisma.systemSetting.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        pointsForRegistration: 50,
        pointsForDailyLogin: 5,
        pointsForContact: 10,
        pointsForReferral: 25,
        pointsForProfileCompletion: 15,
        vipPointsMultiplier: 2.0,
        minPointsForCoupon: 100,
        pointsExpirationDays: 365,
        defaultCurrency: 'USD',
        minProfileImages: 1,
        maxProfileImages: 20,
        maxAgencyProfiles: 100,
        contactMethodsEnabled: ['telefono', 'whatsapp', 'chat_interno', 'email'],
        maintenanceMode: false,
        maintenanceMessage: null,
        maximumLoginAttempts: 5,
        accountLockoutMinutes: 30,
        verificationRequiredForProfiles: false,
        autoVerificationExpirationDays: 90,
        platformCommissionPercentage: 10.00,
        vipCommissionDiscount: 2.00,
        searchBoostVipFactor: 2,
        searchBoostFeaturedFactor: 3,
        searchBoostVerifiedFactor: 2,
        defaultSearchRadius: 50,
        defaultPaginationLimit: 20,
      },
    });

    console.log('Configuración del sistema inicializada');

    console.log('Base de datos inicializada con éxito');
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la función main
main();