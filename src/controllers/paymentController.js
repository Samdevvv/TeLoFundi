const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { prisma } = require('../config/database');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Obtener precios de boosts disponibles
const getBoostPricing = catchAsync(async (req, res) => {
  const pricing = await prisma.boostPricing.findMany({
    where: { isActive: true },
    orderBy: [
      { type: 'asc' },
      { duration: 'asc' }
    ]
  });

  res.status(200).json({
    success: true,
    data: pricing,
    timestamp: new Date().toISOString()
  });
});

// ✅ NUEVO: Obtener precios de verificación disponibles
const getVerificationPricing = catchAsync(async (req, res) => {
  const pricing = await prisma.verificationPricing.findMany({
    where: { isActive: true },
    orderBy: { cost: 'asc' }
  });

  res.status(200).json({
    success: true,
    data: pricing,
    timestamp: new Date().toISOString()
  });
});

// Crear intención de pago para boost
const createBoostPaymentIntent = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { postId, pricingId } = req.body;

  // ✅ CORREGIDO: Validación de inputs
  if (!postId || !pricingId) {
    throw new AppError('PostId y pricingId son requeridos', 400, 'MISSING_REQUIRED_FIELDS');
  }

  // Verificar que el post existe y pertenece al usuario
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      authorId: userId,
      isActive: true
    }
  });

  if (!post) {
    throw new AppError('Post no encontrado o no tienes permisos', 404, 'POST_NOT_FOUND');
  }

  // Verificar pricing
  const pricing = await prisma.boostPricing.findUnique({
    where: {
      id: pricingId,
      isActive: true
    }
  });

  if (!pricing) {
    throw new AppError('Plan de boost no encontrado', 404, 'PRICING_NOT_FOUND');
  }

  // Verificar límites diarios si aplica
  if (pricing.maxBoosts) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const boostsToday = await prisma.boost.count({
      where: {
        userId,
        createdAt: { gte: today }
      }
    });

    if (boostsToday >= pricing.maxBoosts) {
      throw new AppError(`Límite diario de ${pricing.maxBoosts} boosts alcanzado`, 400, 'DAILY_BOOST_LIMIT');
    }
  }

  // ✅ CORREGIDO: Validación de precio
  if (!pricing.price || pricing.price <= 0) {
    throw new AppError('Precio de boost inválido', 400, 'INVALID_BOOST_PRICE');
  }

  // Crear PaymentIntent con Stripe
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(pricing.price * 100), // Stripe usa centavos
    currency: 'usd',
    metadata: {
      type: 'boost',
      userId,
      postId,
      pricingId,
      userType: req.user.userType
    },
    description: `Boost ${pricing.type} para post "${post.title}"`,
    automatic_payment_methods: {
      enabled: true
    }
  });

  // ✅ CORREGIDO: Crear registro de pago con mejor manejo de clientId
  const paymentData = {
    amount: pricing.price,
    currency: 'USD',
    status: 'PENDING',
    type: 'BOOST',
    description: `Boost ${pricing.type} - ${pricing.duration}h`,
    stripePaymentId: paymentIntent.id,
    metadata: {
      postId,
      pricingId,
      boostType: pricing.type,
      duration: pricing.duration
    }
  };

  // Solo agregar clientId si el usuario es CLIENT
  if (req.user.userType === 'CLIENT' && req.user.client?.id) {
    paymentData.clientId = req.user.client.id;
  }

  const payment = await prisma.payment.create({
    data: paymentData
  });

  logger.info('Boost payment intent created', {
    paymentIntentId: paymentIntent.id,
    paymentId: payment.id,
    userId,
    postId,
    amount: pricing.price,
    boostType: pricing.type
  });

  res.status(200).json({
    success: true,
    data: {
      clientSecret: paymentIntent.client_secret,
      paymentId: payment.id,
      amount: pricing.price,
      boostType: pricing.type,
      duration: pricing.duration
    },
    timestamp: new Date().toISOString()
  });
});

// ✅ NUEVO: Crear intención de pago para verificación
const createVerificationPaymentIntent = catchAsync(async (req, res) => {
  const { escortId, pricingId } = req.body;
  const agencyUserId = req.user.id;

  // Verificar que el usuario es agencia
  if (req.user.userType !== 'AGENCY') {
    throw new AppError('Solo agencias pueden pagar verificaciones', 403, 'AGENCY_ONLY');
  }

  // ✅ Verificación consistente de que la agencia existe
  if (!req.user.agency) {
    throw new AppError('Datos de agencia no encontrados', 500, 'AGENCY_DATA_MISSING');
  }

  // ✅ Validación de inputs
  if (!escortId || !pricingId) {
    throw new AppError('EscortId y pricingId son requeridos', 400, 'MISSING_REQUIRED_FIELDS');
  }

  // Verificar que el escort es miembro activo de la agencia
  const membership = await prisma.agencyMembership.findFirst({
    where: {
      escortId,
      agencyId: req.user.agency.id,
      status: 'ACTIVE'
    },
    include: {
      escort: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }
    }
  });

  if (!membership) {
    throw new AppError('El escort no es miembro activo de tu agencia', 404, 'ESCORT_NOT_MEMBER');
  }

  // Verificar que no está ya verificado
  if (membership.escort.isVerified) {
    throw new AppError('Este escort ya está verificado', 409, 'ESCORT_ALREADY_VERIFIED');
  }

  // Obtener pricing de verificación
  const pricing = await prisma.verificationPricing.findUnique({
    where: {
      id: pricingId,
      isActive: true
    }
  });

  if (!pricing) {
    throw new AppError('Plan de verificación no encontrado', 404, 'PRICING_NOT_FOUND');
  }

  // ✅ Validación de precio
  if (!pricing.cost || pricing.cost <= 0) {
    throw new AppError('Precio de verificación inválido', 400, 'INVALID_VERIFICATION_PRICE');
  }

  // Verificar que no hay verificación en progreso
  const existingVerification = await prisma.escortVerification.findFirst({
    where: {
      escortId,
      agencyId: req.user.agency.id,
      status: { in: ['PENDING', 'COMPLETED'] }
    }
  });

  if (existingVerification) {
    throw new AppError('Ya existe una verificación para este escort', 409, 'VERIFICATION_EXISTS');
  }

  // Crear PaymentIntent con Stripe
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(pricing.cost * 100), // Stripe usa centavos
    currency: 'usd',
    metadata: {
      type: 'verification',
      agencyUserId,
      escortId,
      pricingId,
      userType: req.user.userType,
      agencyId: req.user.agency.id
    },
    description: `Verificación ${pricing.name} para ${membership.escort.user.firstName} ${membership.escort.user.lastName}`,
    automatic_payment_methods: {
      enabled: true
    }
  });

  // Crear registro de pago
  const payment = await prisma.payment.create({
    data: {
      amount: pricing.cost,
      currency: 'USD',
      status: 'PENDING',
      type: 'VERIFICATION',
      description: `Verificación ${pricing.name}`,
      stripePaymentId: paymentIntent.id,
      // Los pagos de verificación no tienen clientId porque los hace la agencia
      metadata: {
        escortId,
        pricingId,
        agencyId: req.user.agency.id,
        verificationType: pricing.name,
        membershipId: membership.id
      }
    }
  });

  logger.info('Verification payment intent created', {
    paymentIntentId: paymentIntent.id,
    paymentId: payment.id,
    agencyUserId,
    escortId,
    amount: pricing.cost,
    verificationType: pricing.name
  });

  res.status(200).json({
    success: true,
    data: {
      clientSecret: paymentIntent.client_secret,
      paymentId: payment.id,
      amount: pricing.cost,
      verificationType: pricing.name,
      escort: {
        id: membership.escort.id,
        name: `${membership.escort.user.firstName} ${membership.escort.user.lastName}`
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Confirmar pago de boost
const confirmBoostPayment = catchAsync(async (req, res) => {
  const { paymentId } = req.params;
  const userId = req.user.id;

  // Buscar pago
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      status: 'PENDING',
      type: 'BOOST'
    }
  });

  if (!payment) {
    throw new AppError('Pago no encontrado', 404, 'PAYMENT_NOT_FOUND');
  }

  // ✅ CORREGIDO: Verificar que el pago pertenece al usuario
  if (payment.metadata.userId !== userId) {
    throw new AppError('No tienes permisos para este pago', 403, 'PAYMENT_ACCESS_DENIED');
  }

  // Verificar estado en Stripe
  const paymentIntent = await stripe.paymentIntents.retrieve(payment.stripePaymentId);

  if (paymentIntent.status !== 'succeeded') {
    throw new AppError('El pago no ha sido completado', 400, 'PAYMENT_NOT_COMPLETED');
  }

  // Obtener datos del boost
  const pricing = await prisma.boostPricing.findUnique({
    where: { id: payment.metadata.pricingId }
  });

  if (!pricing) {
    throw new AppError('Plan de boost no encontrado', 404, 'BOOST_PRICING_NOT_FOUND');
  }

  const post = await prisma.post.findUnique({
    where: { id: payment.metadata.postId }
  });

  if (!post) {
    throw new AppError('Post no encontrado', 404, 'POST_NOT_FOUND');
  }

  // ✅ CORREGIDO: Transacción para operaciones críticas
  const result = await prisma.$transaction(async (tx) => {
    // Calcular métricas antes del boost
    const metricsBefore = {
      views: post.views || 0,
      clicks: post.clicks || 0,
      engagement: post.engagementRate || 0
    };

    // Crear boost
    const boost = await tx.boost.create({
      data: {
        pricingId: payment.metadata.pricingId,
        userId,
        postId: payment.metadata.postId,
        viewsBefore: metricsBefore.views,
        clicksBefore: metricsBefore.clicks,
        engagementBefore: metricsBefore.engagement,
        expiresAt: new Date(Date.now() + pricing.duration * 60 * 60 * 1000) // horas a milisegundos
      }
    });

    // Actualizar post con boost
    await tx.post.update({
      where: { id: payment.metadata.postId },
      data: {
        lastBoosted: new Date(),
        score: { increment: pricing.multiplier * 10 },
        trendingScore: { increment: pricing.multiplier * 5 },
        isFeatured: pricing.type === 'FEATURED' || pricing.type === 'SUPER' || pricing.type === 'MEGA'
      }
    });

    // Actualizar pago como completado
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        processorFee: paymentIntent.application_fee_amount ? 
          paymentIntent.application_fee_amount / 100 : null,
        netAmount: (paymentIntent.amount - (paymentIntent.application_fee_amount || 0)) / 100
      }
    });

    return boost;
  });

  // Crear notificación (manejo de errores)
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: 'BOOST_ACTIVATED',
        title: 'Boost activado',
        message: `Tu post "${post.title}" ha sido potenciado por ${pricing.duration} horas`,
        data: {
          boostId: result.id,
          postId: post.id,
          boostType: pricing.type,
          duration: pricing.duration,
          expiresAt: result.expiresAt.toISOString()
        }
      }
    });
  } catch (error) {
    logger.warn('Failed to create boost notification:', error);
  }

  logger.info('Boost payment confirmed', {
    paymentId,
    boostId: result.id,
    userId,
    postId: post.id,
    amount: payment.amount,
    boostType: pricing.type,
    expiresAt: result.expiresAt
  });

  res.status(200).json({
    success: true,
    message: 'Boost activado exitosamente',
    data: {
      boost: {
        id: result.id,
        type: pricing.type,
        duration: pricing.duration,
        expiresAt: result.expiresAt,
        multiplier: pricing.multiplier
      },
      post: {
        id: post.id,
        title: post.title,
        isFeatured: pricing.type === 'FEATURED' || pricing.type === 'SUPER' || pricing.type === 'MEGA'
      }
    },
    timestamp: new Date().toISOString()
  });
});

// ✅ NUEVO: Confirmar pago de verificación
const confirmVerificationPayment = catchAsync(async (req, res) => {
  const { paymentId } = req.params;
  const agencyUserId = req.user.id;

  // Verificar que el usuario es agencia
  if (req.user.userType !== 'AGENCY') {
    throw new AppError('Solo agencias pueden confirmar pagos de verificación', 403, 'AGENCY_ONLY');
  }

  if (!req.user.agency) {
    throw new AppError('Datos de agencia no encontrados', 500, 'AGENCY_DATA_MISSING');
  }

  // Buscar pago
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      status: 'PENDING',
      type: 'VERIFICATION'
    }
  });

  if (!payment) {
    throw new AppError('Pago no encontrado', 404, 'PAYMENT_NOT_FOUND');
  }

  // ✅ Verificar que el pago pertenece a la agencia
  if (payment.metadata.agencyId !== req.user.agency.id) {
    throw new AppError('No tienes permisos para este pago', 403, 'PAYMENT_ACCESS_DENIED');
  }

  // Verificar estado en Stripe
  const paymentIntent = await stripe.paymentIntents.retrieve(payment.stripePaymentId);

  if (paymentIntent.status !== 'succeeded') {
    throw new AppError('El pago no ha sido completado', 400, 'PAYMENT_NOT_COMPLETED');
  }

  // Obtener datos necesarios
  const [pricing, membership] = await Promise.all([
    prisma.verificationPricing.findUnique({
      where: { id: payment.metadata.pricingId }
    }),
    prisma.agencyMembership.findUnique({
      where: { id: payment.metadata.membershipId },
      include: {
        escort: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    })
  ]);

  if (!pricing) {
    throw new AppError('Plan de verificación no encontrado', 404, 'VERIFICATION_PRICING_NOT_FOUND');
  }

  if (!membership) {
    throw new AppError('Membresía no encontrada', 404, 'MEMBERSHIP_NOT_FOUND');
  }

  // ✅ CORREGIDO: Transacción para operaciones críticas
  const result = await prisma.$transaction(async (tx) => {
    // Crear verificación
    const verification = await tx.escortVerification.create({
      data: {
        agencyId: req.user.agency.id,
        escortId: payment.metadata.escortId,
        pricingId: payment.metadata.pricingId,
        membershipId: membership.id,
        status: 'COMPLETED',
        verifiedBy: agencyUserId,
        completedAt: new Date()
      }
    });

    // Marcar escort como verificado
    await tx.escort.update({
      where: { id: payment.metadata.escortId },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: req.user.agency.id.toString()
      }
    });

    // Actualizar contadores de la agencia
    await tx.agency.update({
      where: { id: req.user.agency.id },
      data: {
        verifiedEscorts: { increment: 1 },
        totalVerifications: { increment: 1 }
      }
    });

    // Actualizar reputación del escort
    await tx.userReputation.upsert({
      where: { userId: membership.escort.user.id },
      update: {
        trustScore: { increment: 25 },
        overallScore: { increment: 15 },
        lastScoreUpdate: new Date()
      },
      create: {
        userId: membership.escort.user.id,
        overallScore: 15,
        trustScore: 25,
        responseRate: 0,
        profileCompleteness: 0,
        discoveryScore: 0,
        trendingScore: 0,
        qualityScore: 0,
        spamScore: 0,
        reportScore: 0,
        lastScoreUpdate: new Date()
      }
    });

    // Actualizar pago como completado
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        processorFee: paymentIntent.application_fee_amount ? 
          paymentIntent.application_fee_amount / 100 : null,
        netAmount: (paymentIntent.amount - (paymentIntent.application_fee_amount || 0)) / 100
      }
    });

    return verification;
  });

  // Crear notificación para el escort
  try {
    await prisma.notification.create({
      data: {
        userId: membership.escort.user.id,
        type: 'VERIFICATION_COMPLETED',
        title: '¡Verificación completada!',
        message: `Tu perfil ha sido verificado por ${req.user.firstName} ${req.user.lastName}`,
        data: {
          verificationId: result.id,
          agencyId: req.user.agency.id,
          agencyName: `${req.user.firstName} ${req.user.lastName}`,
          pricingName: pricing.name
        }
      }
    });
  } catch (error) {
    logger.warn('Failed to create verification notification:', error);
  }

  logger.info('Verification payment confirmed', {
    paymentId,
    verificationId: result.id,
    agencyUserId,
    escortId: payment.metadata.escortId,
    amount: payment.amount,
    verificationType: pricing.name
  });

  res.status(200).json({
    success: true,
    message: 'Verificación completada exitosamente',
    data: {
      verification: {
        id: result.id,
        status: result.status,
        completedAt: result.completedAt,
        pricing: {
          name: pricing.name,
          cost: pricing.cost,
          features: pricing.features
        },
        escort: {
          id: membership.escort.id,
          name: `${membership.escort.user.firstName} ${membership.escort.user.lastName}`,
          isVerified: true
        }
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Crear intención de pago para puntos (clientes)
const createPointsPaymentIntent = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { pointsPackage } = req.body; // 'small', 'medium', 'large', 'premium'

  // Verificar que el usuario es cliente
  if (req.user.userType !== 'CLIENT') {
    throw new AppError('Solo clientes pueden comprar puntos', 403, 'CLIENT_ONLY');
  }

  // ✅ CORREGIDO: Verificación consistente de que el cliente existe
  if (!req.user.client) {
    throw new AppError('Datos de cliente no encontrados', 500, 'CLIENT_DATA_MISSING');
  }

  // ✅ CORREGIDO: Validación de input
  if (!pointsPackage) {
    throw new AppError('Paquete de puntos es requerido', 400, 'MISSING_POINTS_PACKAGE');
  }

  // Configuración de paquetes de puntos
  const pointsPackages = {
    small: { points: 100, price: 9.99, bonus: 0 },
    medium: { points: 500, price: 39.99, bonus: 50 },
    large: { points: 1000, price: 69.99, bonus: 150 },
    premium: { points: 2500, price: 149.99, bonus: 500 }
  };

  const selectedPackage = pointsPackages[pointsPackage];
  if (!selectedPackage) {
    throw new AppError('Paquete de puntos no válido', 400, 'INVALID_POINTS_PACKAGE');
  }

  const totalPoints = selectedPackage.points + selectedPackage.bonus;

  // ✅ CORREGIDO: Validación de precio
  if (!selectedPackage.price || selectedPackage.price <= 0) {
    throw new AppError('Precio de paquete inválido', 400, 'INVALID_PACKAGE_PRICE');
  }

  // Crear PaymentIntent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(selectedPackage.price * 100),
    currency: 'usd',
    metadata: {
      type: 'points',
      userId,
      pointsPackage,
      points: totalPoints.toString(),
      userType: req.user.userType
    },
    description: `Compra de ${totalPoints} puntos (${selectedPackage.points} + ${selectedPackage.bonus} bonus)`,
    automatic_payment_methods: {
      enabled: true
    }
  });

  // Crear registro de pago
  const payment = await prisma.payment.create({
    data: {
      amount: selectedPackage.price,
      currency: 'USD',
      status: 'PENDING',
      type: 'POINTS',
      description: `${totalPoints} puntos - ${pointsPackage}`,
      stripePaymentId: paymentIntent.id,
      clientId: req.user.client.id,
      metadata: {
        pointsPackage,
        basePoints: selectedPackage.points,
        bonusPoints: selectedPackage.bonus,
        totalPoints
      }
    }
  });

  logger.info('Points payment intent created', {
    paymentIntentId: paymentIntent.id,
    paymentId: payment.id,
    userId,
    pointsPackage,
    totalPoints,
    amount: selectedPackage.price
  });

  res.status(200).json({
    success: true,
    data: {
      clientSecret: paymentIntent.client_secret,
      paymentId: payment.id,
      package: {
        name: pointsPackage,
        basePoints: selectedPackage.points,
        bonusPoints: selectedPackage.bonus,
        totalPoints,
        price: selectedPackage.price
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Confirmar pago de puntos
const confirmPointsPayment = catchAsync(async (req, res) => {
  const { paymentId } = req.params;
  const userId = req.user.id;

  // Verificar que el usuario es cliente
  if (req.user.userType !== 'CLIENT') {
    throw new AppError('Solo clientes pueden confirmar pagos de puntos', 403, 'CLIENT_ONLY');
  }

  if (!req.user.client) {
    throw new AppError('Datos de cliente no encontrados', 500, 'CLIENT_DATA_MISSING');
  }

  // Buscar pago
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      clientId: req.user.client.id,
      status: 'PENDING',
      type: 'POINTS'
    }
  });

  if (!payment) {
    throw new AppError('Pago no encontrado', 404, 'PAYMENT_NOT_FOUND');
  }

  // Verificar estado en Stripe
  const paymentIntent = await stripe.paymentIntents.retrieve(payment.stripePaymentId);

  if (paymentIntent.status !== 'succeeded') {
    throw new AppError('El pago no ha sido completado', 400, 'PAYMENT_NOT_COMPLETED');
  }

  const totalPoints = parseInt(payment.metadata.totalPoints);
  const currentPoints = req.user.client.points || 0;

  // ✅ CORREGIDO: Transacción para operaciones críticas
  const result = await prisma.$transaction(async (tx) => {
    // Actualizar puntos del cliente
    const updatedClient = await tx.client.update({
      where: { userId },
      data: {
        points: { increment: totalPoints },
        totalPointsPurchased: { increment: totalPoints }
      }
    });

    // Crear transacción de puntos
    await tx.pointTransaction.create({
      data: {
        clientId: req.user.client.id,
        amount: totalPoints,
        type: 'PURCHASE',
        description: `Compra de puntos - ${payment.metadata.pointsPackage}`,
        cost: payment.amount,
        paymentId: payment.id,
        balanceBefore: currentPoints,
        balanceAfter: currentPoints + totalPoints
      }
    });

    // Actualizar pago
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        processorFee: paymentIntent.application_fee_amount ? 
          paymentIntent.application_fee_amount / 100 : null,
        netAmount: (paymentIntent.amount - (paymentIntent.application_fee_amount || 0)) / 100
      }
    });

    return updatedClient;
  });

  // Crear notificación
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: 'PAYMENT_SUCCESS',
        title: 'Puntos agregados',
        message: `Se han agregado ${totalPoints} puntos a tu cuenta`,
        data: {
          paymentId: payment.id,
          pointsAdded: totalPoints,
          newBalance: currentPoints + totalPoints,
          package: payment.metadata.pointsPackage
        }
      }
    });
  } catch (error) {
    logger.warn('Failed to create points notification:', error);
  }

  logger.info('Points payment confirmed', {
    paymentId,
    userId,
    pointsAdded: totalPoints,
    newBalance: currentPoints + totalPoints,
    amount: payment.amount
  });

  res.status(200).json({
    success: true,
    message: 'Puntos agregados exitosamente',
    data: {
      pointsAdded: totalPoints,
      newBalance: currentPoints + totalPoints,
      transaction: {
        id: payment.id,
        amount: payment.amount,
        package: payment.metadata.pointsPackage
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Crear intención de pago para premium (clientes)
const createPremiumPaymentIntent = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { tier, duration } = req.body; // tier: 'PREMIUM' | 'VIP', duration: 1, 3, 6, 12 (meses)

  // Verificar que el usuario es cliente
  if (req.user.userType !== 'CLIENT') {
    throw new AppError('Solo clientes pueden comprar premium', 403, 'CLIENT_ONLY');
  }

  if (!req.user.client) {
    throw new AppError('Datos de cliente no encontrados', 500, 'CLIENT_DATA_MISSING');
  }

  // ✅ CORREGIDO: Validación de inputs
  if (!tier || !duration) {
    throw new AppError('Tier y duración son requeridos', 400, 'MISSING_REQUIRED_FIELDS');
  }

  if (!['PREMIUM', 'VIP'].includes(tier)) {
    throw new AppError('Tier inválido. Debe ser PREMIUM o VIP', 400, 'INVALID_TIER');
  }

  if (!['1', '3', '6', '12'].includes(duration.toString())) {
    throw new AppError('Duración inválida. Debe ser 1, 3, 6 o 12 meses', 400, 'INVALID_DURATION');
  }

  // Configuración de precios premium
  const premiumPricing = {
    PREMIUM: {
      1: 19.99,
      3: 49.99,
      6: 89.99,
      12: 149.99
    },
    VIP: {
      1: 39.99,
      3: 99.99,
      6: 179.99,
      12: 299.99
    }
  };

  const durationNum = parseInt(duration);
  const price = premiumPricing[tier]?.[durationNum];
  
  if (!price) {
    throw new AppError('Plan premium no válido', 400, 'INVALID_PREMIUM_PLAN');
  }

  // Verificar si ya es premium del mismo tier o superior
  if (req.user.client.isPremium && req.user.client.premiumTier === tier) {
    // Calcular extensión en lugar de nueva suscripción
    const currentExpiry = req.user.client.premiumUntil || new Date();
    const newExpiry = new Date(Math.max(currentExpiry.getTime(), Date.now()) + durationNum * 30 * 24 * 60 * 60 * 1000);
    
    // Crear PaymentIntent para extensión
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(price * 100),
      currency: 'usd',
      metadata: {
        type: 'premium_extension',
        userId,
        tier,
        duration: duration.toString(),
        currentExpiry: currentExpiry.toISOString(),
        newExpiry: newExpiry.toISOString()
      },
      description: `Extensión ${tier} por ${duration} mes(es)`,
      automatic_payment_methods: {
        enabled: true
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        type: 'extension',
        tier,
        duration: durationNum,
        price,
        currentExpiry,
        newExpiry
      },
      timestamp: new Date().toISOString()
    });
  }

  // Crear PaymentIntent para nueva suscripción/upgrade
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(price * 100),
    currency: 'usd',
    metadata: {
      type: 'premium',
      userId,
      tier,
      duration: duration.toString()
    },
    description: `Suscripción ${tier} por ${duration} mes(es)`,
    automatic_payment_methods: {
      enabled: true
    }
  });

  // Crear registro de pago
  const payment = await prisma.payment.create({
    data: {
      amount: price,
      currency: 'USD',
      status: 'PENDING',
      type: 'PREMIUM',
      description: `${tier} - ${duration} mes(es)`,
      stripePaymentId: paymentIntent.id,
      clientId: req.user.client.id,
      metadata: {
        tier,
        duration: durationNum,
        upgradeFrom: req.user.client.premiumTier
      }
    }
  });

  logger.info('Premium payment intent created', {
    paymentIntentId: paymentIntent.id,
    paymentId: payment.id,
    userId,
    tier,
    duration: durationNum,
    amount: price
  });

  res.status(200).json({
    success: true,
    data: {
      clientSecret: paymentIntent.client_secret,
      paymentId: payment.id,
      tier,
      duration: durationNum,
      price,
      type: 'new_subscription'
    },
    timestamp: new Date().toISOString()
  });
});

// Confirmar pago premium
const confirmPremiumPayment = catchAsync(async (req, res) => {
  const { paymentId } = req.params;
  const userId = req.user.id;

  // Verificar que el usuario es cliente
  if (req.user.userType !== 'CLIENT') {
    throw new AppError('Solo clientes pueden confirmar pagos premium', 403, 'CLIENT_ONLY');
  }

  if (!req.user.client) {
    throw new AppError('Datos de cliente no encontrados', 500, 'CLIENT_DATA_MISSING');
  }

  // Buscar pago
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      clientId: req.user.client.id,
      status: 'PENDING',
      type: 'PREMIUM'
    }
  });

  if (!payment) {
    throw new AppError('Pago no encontrado', 404, 'PAYMENT_NOT_FOUND');
  }

  // Verificar estado en Stripe
  const paymentIntent = await stripe.paymentIntents.retrieve(payment.stripePaymentId);

  if (paymentIntent.status !== 'succeeded') {
    throw new AppError('El pago no ha sido completado', 400, 'PAYMENT_NOT_COMPLETED');
  }

  const tier = payment.metadata.tier;
  const duration = parseInt(payment.metadata.duration);

  // Calcular nueva fecha de expiración
  const currentExpiry = req.user.client.premiumUntil || new Date();
  const newExpiry = new Date(Math.max(currentExpiry.getTime(), Date.now()) + duration * 30 * 24 * 60 * 60 * 1000);

  // Configurar beneficios según tier
  const tierBenefits = {
    PREMIUM: {
      dailyMessageLimit: 50,
      canViewPhoneNumbers: true,
      canSendImages: true,
      canSendVoiceMessages: false,
      canAccessPremiumProfiles: true,
      prioritySupport: false,
      canSeeOnlineStatus: true
    },
    VIP: {
      dailyMessageLimit: -1, // Ilimitado
      canViewPhoneNumbers: true,
      canSendImages: true,
      canSendVoiceMessages: true,
      canAccessPremiumProfiles: true,
      prioritySupport: true,
      canSeeOnlineStatus: true
    }
  };

  // ✅ CORREGIDO: Transacción para operaciones críticas
  const result = await prisma.$transaction(async (tx) => {
    // Actualizar cliente
    const updatedClient = await tx.client.update({
      where: { userId },
      data: {
        isPremium: true,
        premiumTier: tier,
        premiumUntil: newExpiry,
        ...tierBenefits[tier]
      }
    });

    // Actualizar pago
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        processorFee: paymentIntent.application_fee_amount ? 
          paymentIntent.application_fee_amount / 100 : null,
        netAmount: (paymentIntent.amount - (paymentIntent.application_fee_amount || 0)) / 100
      }
    });

    return updatedClient;
  });

  // Crear notificación
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: 'PAYMENT_SUCCESS',
        title: `¡Bienvenido a ${tier}!`,
        message: `Tu suscripción ${tier} está activa hasta ${newExpiry.toLocaleDateString()}`,
        data: {
          paymentId: payment.id,
          tier,
          duration,
          expiresAt: newExpiry.toISOString(),
          benefits: tierBenefits[tier]
        }
      }
    });
  } catch (error) {
    logger.warn('Failed to create premium notification:', error);
  }

  logger.info('Premium payment confirmed', {
    paymentId,
    userId,
    tier,
    duration,
    expiresAt: newExpiry,
    amount: payment.amount
  });

  res.status(200).json({
    success: true,
    message: `Suscripción ${tier} activada exitosamente`,
    data: {
      tier,
      expiresAt: newExpiry,
      benefits: tierBenefits[tier],
      transaction: {
        id: payment.id,
        amount: payment.amount,
        duration
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Obtener historial de pagos
const getPaymentHistory = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 20, type, status } = req.query;

  // ✅ CORREGIDO: Validación de paginación consistente
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  // Solo clientes tienen historial de pagos directo
  if (req.user.userType !== 'CLIENT') {
    throw new AppError('Solo clientes pueden ver historial de pagos', 403, 'CLIENT_ONLY');
  }

  if (!req.user.client) {
    throw new AppError('Datos de cliente no encontrados', 500, 'CLIENT_DATA_MISSING');
  }

  const whereClause = {
    clientId: req.user.client.id,
    ...(type && { type: type.toUpperCase() }),
    ...(status && { status: status.toUpperCase() })
  };

  const [payments, totalCount] = await Promise.all([
    prisma.payment.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limitNum
    }),
    prisma.payment.count({ where: whereClause })
  ]);

  const pagination = {
    page: pageNum,
    limit: limitNum,
    total: totalCount,
    pages: Math.ceil(totalCount / limitNum),
    hasNext: pageNum * limitNum < totalCount,
    hasPrev: pageNum > 1
  };

  res.status(200).json({
    success: true,
    data: {
      payments,
      pagination,
      filters: { type, status }
    },
    timestamp: new Date().toISOString()
  });
});

// Webhook de Stripe para procesar eventos
const handleStripeWebhook = catchAsync(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error('Stripe webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Manejar eventos de Stripe
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(event.data.object);
      break;
    default:
      logger.info(`Unhandled Stripe event type: ${event.type}`);
  }

  res.status(200).json({ received: true });
});

// Helper para manejar pago exitoso
const handlePaymentIntentSucceeded = async (paymentIntent) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { stripePaymentId: paymentIntent.id }
    });

    if (payment && payment.status === 'PENDING') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });

      logger.info('Payment confirmed via webhook', {
        paymentId: payment.id,
        stripePaymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100
      });
    }
  } catch (error) {
    logger.error('Error processing payment_intent.succeeded webhook:', error);
  }
};

// Helper para manejar pago fallido
const handlePaymentIntentFailed = async (paymentIntent) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { stripePaymentId: paymentIntent.id }
    });

    if (payment && payment.status === 'PENDING') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failureReason: paymentIntent.last_payment_error?.message || 'Payment failed'
        }
      });

      logger.info('Payment failed via webhook', {
        paymentId: payment.id,
        stripePaymentIntentId: paymentIntent.id,
        reason: paymentIntent.last_payment_error?.message
      });
    }
  } catch (error) {
    logger.error('Error processing payment_intent.payment_failed webhook:', error);
  }
};

module.exports = {
  getBoostPricing,
  getVerificationPricing, // ✅ NUEVO
  createBoostPaymentIntent,
  createVerificationPaymentIntent, // ✅ NUEVO
  confirmBoostPayment,
  confirmVerificationPayment, // ✅ NUEVO
  createPointsPaymentIntent,
  confirmPointsPayment,
  createPremiumPaymentIntent,
  confirmPremiumPayment,
  getPaymentHistory,
  handleStripeWebhook
};