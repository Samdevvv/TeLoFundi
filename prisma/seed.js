const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de la base de datos con sistema TeloPoints...');

  try {
    // Limpiar datos existentes (opcional - solo para desarrollo)
    console.log('🧹 Limpiando datos existentes...');
    await prisma.appMetrics.deleteMany();
    await prisma.premiumActivation.deleteMany();
    await prisma.pointsHistory.deleteMany();
    await prisma.pointsPurchase.deleteMany();
    await prisma.pointTransaction.deleteMany();
    await prisma.client.deleteMany();
    await prisma.admin.deleteMany();
    await prisma.agency.deleteMany();
    await prisma.escort.deleteMany();
    await prisma.userReputation.deleteMany();
    await prisma.userSettings.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.subscriptionPlan.deleteMany();
    await prisma.verificationPricing.deleteMany();
    await prisma.boostPricing.deleteMany();
    await prisma.pointsPackage.deleteMany();
    await prisma.location.deleteMany();

    console.log('✅ Datos limpiados');

    // 1. Crear ubicaciones
    console.log('📍 Creando ubicaciones...');
    const locations = await prisma.location.createMany({
      data: [
        { country: 'República Dominicana', state: 'Distrito Nacional', city: 'Santo Domingo' },
        { country: 'República Dominicana', state: 'Santiago', city: 'Santiago de los Caballeros' },
        { country: 'República Dominicana', state: 'La Altagracia', city: 'Punta Cana' },
        { country: 'Estados Unidos', state: 'New York', city: 'New York' },
        { country: 'Estados Unidos', state: 'Florida', city: 'Miami' },
        { country: 'España', state: 'Madrid', city: 'Madrid' }
      ]
    });
    console.log('✅ 6 ubicaciones creadas');

    // 2. Crear paquetes de puntos
    console.log('💰 Creando paquetes de puntos...');
    await prisma.pointsPackage.createMany({
      data: [
        {
          name: 'Starter',
          points: 50,
          price: 4.99,
          bonus: 5,
          description: 'Paquete inicial perfecto para comenzar'
        },
        {
          name: 'Basic',
          points: 100,
          price: 9.99,
          bonus: 15,
          isPopular: true,
          description: 'El más popular! Ideal para uso regular'
        },
        {
          name: 'Premium',
          points: 250,
          price: 19.99,
          bonus: 50,
          description: 'Para usuarios activos que quieren más'
        },
        {
          name: 'Mega',
          points: 500,
          price: 34.99,
          bonus: 125,
          description: 'La mejor oferta para usuarios VIP'
        }
      ]
    });
    console.log('✅ 4 paquetes de puntos creados');

    // 3. Crear precios de boost
    console.log('🚀 Creando precios de boost...');
    await prisma.boostPricing.createMany({
      data: [
        {
          type: 'BASIC',
          duration: 24,
          price: 9.99,
          multiplier: 1.5,
          features: { priority: 'low', featured: false },
          maxBoosts: 3
        },
        {
          type: 'PREMIUM',
          duration: 48,
          price: 19.99,
          multiplier: 2.0,
          features: { priority: 'medium', featured: false },
          maxBoosts: 2
        },
        {
          type: 'FEATURED',
          duration: 72,
          price: 29.99,
          multiplier: 2.5,
          features: { priority: 'high', featured: true },
          maxBoosts: 1
        }
      ]
    });
    console.log('✅ 3 precios de boost creados');

    // 4. Crear precios de verificación
    console.log('✅ Creando precios de verificación...');
    await prisma.verificationPricing.createMany({
      data: [
        {
          name: 'Verificación Básica',
          cost: 25.00,
          description: 'Verificación de identidad básica por 30 días',
          features: ['Verificación de ID', 'Badge verificado'],
          duration: 30
        },
        {
          name: 'Verificación Premium',
          cost: 50.00,
          description: 'Verificación completa por 30 días',
          features: ['Verificación completa', 'Badge premium'],
          duration: 30
        }
      ]
    });
    console.log('✅ 2 precios de verificación creados');

    // 5. Crear planes de suscripción
    console.log('📋 Creando planes de suscripción...');
    await prisma.subscriptionPlan.createMany({
      data: [
        {
          name: 'Cliente Básico',
          description: 'Plan gratuito con funcionalidades limitadas',
          price: 0,
          duration: 30,
          userType: 'CLIENT',
          features: ['5 mensajes diarios', 'Ver perfiles básicos']
        },
        {
          name: 'Cliente Premium',
          description: 'Plan premium para clientes',
          price: 19.99,
          duration: 30,
          userType: 'CLIENT',
          features: ['Mensajes ilimitados', 'Ver números de teléfono']
        }
      ]
    });
    console.log('✅ 2 planes de suscripción creados');

    // 6. Crear tags
    console.log('🏷️ Creando tags...');
    await prisma.tag.createMany({
      data: [
        { name: 'Masajes', slug: 'masajes', category: 'SERVICE', color: '#FF6B6B' },
        { name: 'Compañía', slug: 'compania', category: 'SERVICE', color: '#4ECDC4' },
        { name: 'VIP', slug: 'vip', category: 'SPECIAL', color: '#FECA57' },
        { name: 'Verificada', slug: 'verificada', category: 'SPECIAL', color: '#54A0FF' }
      ]
    });
    console.log('✅ 4 tags creados');

    // 7. Crear usuario administrador
    console.log('👤 Creando usuario administrador...');
    const adminLocation = await prisma.location.findFirst({
      where: { city: 'Santo Domingo' }
    });

    const adminPassword = await bcrypt.hash('Admin123!', 12);
    
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@telofundi.com',
        username: 'admin',
        firstName: 'Administrador',
        lastName: 'Sistema',
        password: adminPassword,
        userType: 'ADMIN',
        isActive: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        locationId: adminLocation?.id,
        admin: {
          create: {
            role: 'SUPER_ADMIN',
            permissions: ['ALL'],
            canDeletePosts: true,
            canBanUsers: true,
            canModifyPrices: true,
            canAccessMetrics: true,
            canApproveAgencies: true
          }
        },
        settings: {
          create: {
            emailNotifications: true,
            pushNotifications: true,
            messageNotifications: true,
            likeNotifications: true,
            boostNotifications: true,
            showOnline: true,
            showLastSeen: true,
            allowDirectMessages: true,
            showInDiscovery: false,
            showInTrending: false,
            showInSearch: true,
            contentFilter: 'MODERATE'
          }
        },
        reputation: {
          create: {
            overallScore: 100.0,
            responseRate: 100.0,
            profileCompleteness: 100.0,
            trustScore: 100.0
          }
        }
      }
    });
    console.log('✅ Usuario administrador creado');

    // 8. Crear cliente de ejemplo con puntos
    console.log('👥 Creando cliente de ejemplo...');
    const clientPassword = await bcrypt.hash('Client123!', 12);
    
    const clientUser = await prisma.user.create({
      data: {
        email: 'cliente@ejemplo.com',
        username: 'carlos_cliente',
        firstName: 'Carlos',
        lastName: 'Rodríguez',
        password: clientPassword,
        userType: 'CLIENT',
        bio: 'Cliente verificado.',
        isActive: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        locationId: adminLocation?.id,
        client: {
          create: {
            points: 50, // Cliente con puntos iniciales
            isPremium: false,
            premiumTier: 'BASIC',
            dailyMessageLimit: 5,
            messagesUsedToday: 0,
            lastMessageReset: new Date(),
            lastDailyPointsClaim: null,
            dailyLoginStreak: 0,
            totalDailyPointsEarned: 0,
            totalPointsEarned: 50,
            totalPointsSpent: 0,
            pointsLastUpdated: new Date()
          }
        },
        settings: {
          create: {
            emailNotifications: true,
            pushNotifications: true,
            messageNotifications: true,
            likeNotifications: true,
            boostNotifications: true,
            showOnline: true,
            showLastSeen: true,
            allowDirectMessages: true,
            showInDiscovery: false,
            showInTrending: false,
            showInSearch: true,
            contentFilter: 'MODERATE'
          }
        },
        reputation: {
          create: {
            overallScore: 60.0,
            responseRate: 75.0,
            profileCompleteness: 70.0,
            trustScore: 65.0
          }
        }
      }
    });

    // Crear transacción de registro para el cliente
    const clientRecord = await prisma.client.findUnique({
      where: { userId: clientUser.id }
    });

    if (clientRecord) {
      await prisma.pointTransaction.create({
        data: {
          clientId: clientRecord.id,
          amount: 50,
          type: 'REGISTRATION_BONUS',
          description: 'Puntos de bienvenida por registro',
          balanceBefore: 0,
          balanceAfter: 50,
          source: 'registration'
        }
      });

      await prisma.pointsHistory.create({
        data: {
          clientId: clientRecord.id,
          type: 'REGISTRATION_BONUS',
          amount: 50,
          description: 'Puntos de bienvenida por registro en TeloFundi',
          balanceBefore: 0,
          balanceAfter: 50,
          source: 'registration',
          metadata: {
            reason: 'new_user_bonus',
            timestamp: new Date().toISOString()
          }
        }
      });
    }

    console.log('✅ Cliente de ejemplo creado con sistema de puntos');

    // 9. Crear métricas iniciales
    console.log('📊 Creando métricas iniciales...');
    await prisma.appMetrics.create({
      data: {
        totalUsers: 2,
        totalEscorts: 0,
        totalAgencies: 0,
        totalClients: 1,
        totalAdmins: 1,
        totalPosts: 0,
        totalPayments: 0,
        totalRevenue: 0,
        activeUsers: 2,
        bannedUsers: 0,
        verifiedEscorts: 0,
        premiumClients: 0,
        basicClients: 1,
        premiumClientsTier: 0,
        vipClients: 0,
        totalMessages: 0,
        totalBoosts: 0,
        pendingAgencies: 0,
        totalVerifications: 0,
        expiredVerifications: 0,
        totalPointsSold: 50,
        totalPointsSpent: 0,
        pointsRevenue: 0,
        dailyLoginStreaks: 0,
        dailyActiveUsers: 2,
        weeklyActiveUsers: 2,
        monthlyActiveUsers: 2,
        revenuePerUser: 0,
        conversionRate: 0,
        topCountries: [{ country: 'República Dominicana', users: 2 }],
        topCities: [{ city: 'Santo Domingo', users: 2 }],
        date: new Date()
      }
    });
    console.log('✅ Métricas iniciales creadas');

    console.log('\n🎉 Seed completado exitosamente!');
    console.log('\n📝 Datos creados:');
    console.log('   📍 6 ubicaciones');
    console.log('   💰 4 paquetes de puntos');
    console.log('   🚀 3 precios de boost');
    console.log('   ✅ 2 precios de verificación');
    console.log('   📋 2 planes de suscripción');
    console.log('   🏷️ 4 tags');
    console.log('   👤 1 administrador');
    console.log('   👥 1 cliente con sistema de puntos');
    console.log('   💳 Transacciones de puntos iniciales');
    console.log('   📊 Métricas iniciales');

    console.log('\n🔑 Credenciales de acceso:');
    console.log('   Admin: admin@telofundi.com / Admin123!');
    console.log('   Cliente: cliente@ejemplo.com / Client123! (50 puntos)');

    console.log('\n🎯 Sistema TeloPoints configurado y listo!');

  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Error fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🔌 Conexión a la base de datos cerrada');
  });