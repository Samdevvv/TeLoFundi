const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Datos de seed
const seedData = {
  locations: [
    { country: 'República Dominicana', state: 'Distrito Nacional', city: 'Santo Domingo' },
    { country: 'República Dominicana', state: 'Santiago', city: 'Santiago de los Caballeros' },
    { country: 'República Dominicana', state: 'La Altagracia', city: 'Punta Cana' },
    { country: 'República Dominicana', state: 'Puerto Plata', city: 'Puerto Plata' },
    { country: 'República Dominicana', state: 'San Pedro de Macorís', city: 'San Pedro de Macorís' },
    { country: 'Estados Unidos', state: 'New York', city: 'New York' },
    { country: 'Estados Unidos', state: 'California', city: 'Los Angeles' },
    { country: 'Estados Unidos', state: 'Florida', city: 'Miami' },
    { country: 'España', state: 'Madrid', city: 'Madrid' },
    { country: 'España', state: 'Barcelona', city: 'Barcelona' },
  ],

  boostPricing: [
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
    },
    {
      type: 'SUPER',
      duration: 168, // 7 días
      price: 49.99,
      multiplier: 3.0,
      features: { priority: 'very_high', featured: true },
      maxBoosts: 1
    },
    {
      type: 'MEGA',
      duration: 720, // 30 días
      price: 99.99,
      multiplier: 4.0,
      features: { priority: 'maximum', featured: true },
      maxBoosts: 1
    }
  ],

  verificationPricing: [
    {
      name: 'Verificación Básica',
      cost: 25.00,
      description: 'Verificación de identidad básica',
      features: ['Verificación de ID', 'Badge verificado'],
      duration: 365 // días
    },
    {
      name: 'Verificación Premium',
      cost: 50.00,
      description: 'Verificación completa con documentos adicionales',
      features: ['Verificación de ID', 'Verificación de domicilio', 'Badge premium', 'Prioridad en búsquedas'],
      duration: 365 // días
    }
  ],

  subscriptionPlans: [
    {
      name: 'Cliente Básico',
      description: 'Plan gratuito con funcionalidades limitadas',
      price: 0,
      duration: 30,
      userType: 'CLIENT',
      features: ['10 mensajes diarios', 'Ver perfiles básicos'],
      maxPosts: null,
      maxImages: null,
      maxBoosts: null
    },
    {
      name: 'Cliente Premium',
      description: 'Plan premium para clientes con más beneficios',
      price: 19.99,
      duration: 30,
      userType: 'CLIENT',
      features: ['50 mensajes diarios', 'Ver números de teléfono', 'Enviar imágenes', 'Ver perfiles premium'],
      maxPosts: null,
      maxImages: null,
      maxBoosts: null
    },
    {
      name: 'Cliente VIP',
      description: 'Plan VIP con acceso completo',
      price: 39.99,
      duration: 30,
      userType: 'CLIENT',
      features: ['Mensajes ilimitados', 'Soporte prioritario', 'Mensajes de voz', 'Acceso completo'],
      maxPosts: null,
      maxImages: null,
      maxBoosts: null
    }
  ],

  tags: [
    { name: 'Masajes', slug: 'masajes', category: 'SERVICE', color: '#FF6B6B' },
    { name: 'Compañía', slug: 'compania', category: 'SERVICE', color: '#4ECDC4' },
    { name: 'Eventos', slug: 'eventos', category: 'SERVICE', color: '#45B7D1' },
    { name: 'Citas', slug: 'citas', category: 'SERVICE', color: '#96CEB4' },
    { name: 'VIP', slug: 'vip', category: 'SPECIAL', color: '#FECA57' },
    { name: 'Independiente', slug: 'independiente', category: 'GENERAL', color: '#FF9FF3' },
    { name: 'Verificada', slug: 'verificada', category: 'SPECIAL', color: '#54A0FF' },
    { name: 'Nuevas', slug: 'nuevas', category: 'GENERAL', color: '#5F27CD' },
    { name: 'Disponible 24/7', slug: 'disponible-24-7', category: 'PREFERENCE', color: '#00D2D3' },
    { name: 'Outcall', slug: 'outcall', category: 'PREFERENCE', color: '#FF6348' }
  ]
};

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...');

  try {
    // 1. Crear ubicaciones
    console.log('📍 Creando ubicaciones...');
    for (const location of seedData.locations) {
      await prisma.location.upsert({
        where: {
          country_state_city: {
            country: location.country,
            state: location.state,
            city: location.city
          }
        },
        update: {},
        create: location
      });
    }
    console.log(`✅ ${seedData.locations.length} ubicaciones creadas`);

    // 2. Crear precios de boost
    console.log('💰 Creando precios de boost...');
    for (const pricing of seedData.boostPricing) {
      await prisma.boostPricing.upsert({
        where: { type: pricing.type },
        update: pricing,
        create: pricing
      });
    }
    console.log(`✅ ${seedData.boostPricing.length} precios de boost creados`);

    // 3. Crear precios de verificación
    console.log('✅ Creando precios de verificación...');
    for (const pricing of seedData.verificationPricing) {
      await prisma.verificationPricing.upsert({
        where: { name: pricing.name },
        update: pricing,
        create: pricing
      });
    }
    console.log(`✅ ${seedData.verificationPricing.length} precios de verificación creados`);

    // 4. Crear planes de suscripción
    console.log('📋 Creando planes de suscripción...');
    for (const plan of seedData.subscriptionPlans) {
      await prisma.subscriptionPlan.upsert({
        where: { name: plan.name },
        update: plan,
        create: plan
      });
    }
    console.log(`✅ ${seedData.subscriptionPlans.length} planes de suscripción creados`);

    // 5. Crear tags
    console.log('🏷️ Creando tags...');
    for (const tag of seedData.tags) {
      await prisma.tag.upsert({
        where: { slug: tag.slug },
        update: tag,
        create: tag
      });
    }
    console.log(`✅ ${seedData.tags.length} tags creados`);

    // 6. Crear usuario administrador por defecto
    console.log('👤 Creando usuario administrador...');
    const adminLocation = await prisma.location.findFirst({
      where: { city: 'Santo Domingo' }
    });

    const adminPassword = await bcrypt.hash('Admin123!', 12);
    
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@telofundi.com' },
      update: {},
      create: {
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
            canAccessMetrics: true
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
            trustScore: 100.0,
            discoveryScore: 0.0,
            trendingScore: 0.0,
            qualityScore: 100.0
          }
        }
      }
    });
    console.log('✅ Usuario administrador creado');

    // 7. Crear usuarios de ejemplo
    console.log('👥 Creando usuarios de ejemplo...');
    
    // Escort de ejemplo
    const escortPassword = await bcrypt.hash('Escort123!', 12);
    const escortUser = await prisma.user.upsert({
      where: { email: 'escort@ejemplo.com' },
      update: {},
      create: {
        email: 'escort@ejemplo.com',
        username: 'maria_ejemplo',
        firstName: 'María',
        lastName: 'González',
        password: escortPassword,
        userType: 'ESCORT',
        bio: 'Profesional independiente con experiencia en servicios de compañía.',
        phone: '+1-809-555-0001',
        isActive: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        locationId: adminLocation?.id,
        escort: {
          create: {
            age: 25,
            services: ['Compañía', 'Eventos', 'Cenas'],
            maxPosts: 5,
            currentPosts: 0,
            isVerified: false
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
            showInDiscovery: true,
            showInTrending: true,
            showInSearch: true,
            contentFilter: 'MODERATE'
          }
        },
        reputation: {
          create: {
            overallScore: 75.0,
            responseRate: 85.0,
            profileCompleteness: 80.0,
            trustScore: 70.0,
            discoveryScore: 60.0,
            trendingScore: 0.0,
            qualityScore: 75.0
          }
        }
      }
    });

    // Agencia de ejemplo
    const agencyPassword = await bcrypt.hash('Agency123!', 12);
    const agencyUser = await prisma.user.upsert({
      where: { email: 'agencia@ejemplo.com' },
      update: {},
      create: {
        email: 'agencia@ejemplo.com',
        username: 'elite_agency',
        firstName: 'Elite',
        lastName: 'Agency',
        password: agencyPassword,
        userType: 'AGENCY',
        bio: 'Agencia premium con los mejores profesionales.',
        phone: '+1-809-555-0002',
        website: 'https://elite-agency.com',
        isActive: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        locationId: adminLocation?.id,
        agency: {
          create: {
            isVerified: false,
            totalEscorts: 0,
            verifiedEscorts: 0,
            totalVerifications: 0,
            activeEscorts: 0
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
            showInDiscovery: true,
            showInTrending: true,
            showInSearch: true,
            contentFilter: 'MODERATE'
          }
        },
        reputation: {
          create: {
            overallScore: 80.0,
            responseRate: 90.0,
            profileCompleteness: 90.0,
            trustScore: 75.0,
            discoveryScore: 70.0,
            trendingScore: 0.0,
            qualityScore: 80.0
          }
        }
      }
    });

    // Cliente de ejemplo
    const clientPassword = await bcrypt.hash('Client123!', 12);
    const clientUser = await prisma.user.upsert({
      where: { email: 'cliente@ejemplo.com' },
      update: {},
      create: {
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
            points: 100,
            isPremium: false,
            premiumTier: 'BASIC',
            dailyMessageLimit: 10,
            messagesUsedToday: 0,
            lastMessageReset: new Date()
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
            trustScore: 65.0,
            discoveryScore: 0.0,
            trendingScore: 0.0,
            qualityScore: 60.0
          }
        }
      }
    });

    console.log('✅ Usuarios de ejemplo creados');

    // 8. Crear métricas iniciales de la aplicación
    console.log('📊 Creando métricas iniciales...');
    await prisma.appMetrics.create({
      data: {
        totalUsers: 4,
        totalEscorts: 1,
        totalAgencies: 1,
        totalClients: 1,
        totalAdmins: 1,
        totalPosts: 0,
        totalPayments: 0,
        totalRevenue: 0,
        activeUsers: 4,
        bannedUsers: 0,
        verifiedEscorts: 0,
        premiumClients: 0,
        basicClients: 1,
        premiumClientsTier: 0,
        vipClients: 0,
        totalMessages: 0,
        totalBoosts: 0,
        dailyActiveUsers: 4,
        weeklyActiveUsers: 4,
        monthlyActiveUsers: 4,
        revenuePerUser: 0,
        conversionRate: 0,
        topCountries: [{ country: 'República Dominicana', users: 4 }],
        topCities: [{ city: 'Santo Domingo', users: 4 }],
        date: new Date()
      }
    });
    console.log('✅ Métricas iniciales creadas');

    console.log('\n🎉 Seed completado exitosamente!');
    console.log('\n📝 Datos creados:');
    console.log(`   📍 ${seedData.locations.length} ubicaciones`);
    console.log(`   💰 ${seedData.boostPricing.length} precios de boost`);
    console.log(`   ✅ ${seedData.verificationPricing.length} precios de verificación`);
    console.log(`   📋 ${seedData.subscriptionPlans.length} planes de suscripción`);
    console.log(`   🏷️ ${seedData.tags.length} tags`);
    console.log('   👤 1 administrador');
    console.log('   👥 3 usuarios de ejemplo');
    console.log('   📊 Métricas iniciales');

    console.log('\n🔑 Credenciales de acceso:');
    console.log('   Admin: admin@telofundi.com / Admin123!');
    console.log('   Escort: escort@ejemplo.com / Escort123!');
    console.log('   Agencia: agencia@ejemplo.com / Agency123!');
    console.log('   Cliente: cliente@ejemplo.com / Client123!');

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