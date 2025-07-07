const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const pointsService = require('./pointsService'); // ✅ NUEVO

// ============================================================================
// FUNCIONES PRINCIPALES DE PAGOS
// ============================================================================

// Procesar pago con Stripe
const processStripePayment = async (paymentIntentId, metadata = {}) => {
  try {
    // Obtener detalles del PaymentIntent desde Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Payment not completed. Status: ${paymentIntent.status}`);
    }

    // Buscar el pago en nuestra base de datos
    const payment = await prisma.payment.findUnique({
      where: { stripePaymentId: paymentIntentId },
      include: {
        client: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!payment) {
      throw new Error('Payment record not found in database');
    }

    if (payment.status === 'COMPLETED') {
      logger.warn('Payment already processed', { paymentId: payment.id });
      return { payment, alreadyProcessed: true };
    }

    // Procesar según el tipo de pago
    let processingResult;
    switch (payment.type) {
      case 'BOOST':
        processingResult = await processBoostPayment(payment, paymentIntent);
        break;
      case 'POINTS': // ✅ NUEVO
        processingResult = await processPointsPayment(payment, paymentIntent);
        break;
      case 'PREMIUM':
        processingResult = await processPremiumPayment(payment, paymentIntent);
        break;
      case 'VERIFICATION':
        processingResult = await processVerificationPayment(payment, paymentIntent);
        break;
      case 'POST_ADDITIONAL':
        processingResult = await processAdditionalPostPayment(payment, paymentIntent);
        break;
      default:
        throw new Error(`Unsupported payment type: ${payment.type}`);
    }

    // Actualizar estado del pago
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        processorFee: paymentIntent.application_fee_amount ? 
          paymentIntent.application_fee_amount / 100 : null,
        netAmount: (paymentIntent.amount - (paymentIntent.application_fee_amount || 0)) / 100,
        metadata: {
          ...payment.metadata,
          stripeChargeId: paymentIntent.latest_charge,
          processingResult
        }
      }
    });

    // Crear notificación de éxito
    await createPaymentSuccessNotification(payment, processingResult);

    // Log del éxito
    logger.info('Payment processed successfully', {
      paymentId: payment.id,
      type: payment.type,
      amount: payment.amount,
      clientId: payment.clientId,
      escortId: payment.escortId,
      agencyId: payment.agencyId,
      stripePaymentIntentId: paymentIntentId
    });

    return {
      payment: updatedPayment,
      processingResult,
      alreadyProcessed: false
    };
  } catch (error) {
    logger.error('Error processing Stripe payment:', error);
    
    // Marcar pago como fallido si existe
    try {
      await prisma.payment.updateMany({
        where: { stripePaymentId: paymentIntentId },
        data: {
          status: 'FAILED',
          failureReason: error.message
        }
      });
    } catch (updateError) {
      logger.error('Error updating failed payment status:', updateError);
    }
    
    throw error;
  }
};

// ============================================================================
// ✅ NUEVO: FUNCIONES ESPECÍFICAS PARA PUNTOS
// ============================================================================

/**
 * Crear PaymentIntent para compra de puntos
 */
const createPointsPaymentIntent = async (clientId, packageId) => {
  try {
    // Verificar paquete y cliente
    const [pointsPackage, client] = await Promise.all([
      prisma.pointsPackage.findUnique({
        where: { id: packageId, isActive: true }
      }),
      prisma.client.findUnique({
        where: { id: clientId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      })
    ]);

    if (!pointsPackage) {
      throw new Error('Paquete de puntos no encontrado o no disponible');
    }

    if (!client) {
      throw new Error('Cliente no encontrado');
    }

    const totalPoints = pointsPackage.points + pointsPackage.bonus;
    const amountInCents = Math.round(pointsPackage.price * 100);

    // Crear registro de pago
    const payment = await prisma.payment.create({
      data: {
        amount: pointsPackage.price,
        currency: 'USD',
        type: 'POINTS',
        description: `Compra de puntos - ${pointsPackage.name}`,
        clientId,
        status: 'PENDING',
        metadata: {
          packageId: pointsPackage.id,
          packageName: pointsPackage.name,
          basePoints: pointsPackage.points,
          bonusPoints: pointsPackage.bonus,
          totalPoints,
          userId: client.user.id
        }
      }
    });

    // Crear PaymentIntent en Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      metadata: {
        paymentId: payment.id,
        clientId,
        packageId: pointsPackage.id,
        packageName: pointsPackage.name,
        totalPoints: totalPoints.toString(),
        type: 'points_purchase'
      },
      description: `TeloFundi - ${pointsPackage.name} (${totalPoints} puntos)`,
      receipt_email: client.user.email
    });

    // Actualizar pago con Stripe PaymentIntent ID
    await prisma.payment.update({
      where: { id: payment.id },
      data: { stripePaymentId: paymentIntent.id }
    });

    logger.info('Points PaymentIntent created', {
      paymentId: payment.id,
      packageId: pointsPackage.id,
      totalPoints,
      amount: pointsPackage.price,
      clientId
    });

    return {
      paymentIntent,
      payment,
      package: pointsPackage,
      totalPoints
    };
  } catch (error) {
    logger.error('Error creating points PaymentIntent:', error);
    throw error;
  }
};

/**
 * Procesar pago de puntos completado
 */
const processPointsPayment = async (payment, paymentIntent) => {
  try {
    const { packageId, totalPoints } = payment.metadata;

    if (!payment.clientId) {
      throw new Error('Client ID not found in payment');
    }

    // Confirmar la compra de puntos usando el pointsService
    const result = await pointsService.confirmPointsPurchase(
      payment.metadata.purchaseId || await createPurchaseRecord(payment),
      {
        stripePaymentId: paymentIntent.id,
        paymentIntentId: paymentIntent.id
      }
    );

    return {
      type: 'points',
      pointsAdded: result.pointsAdded,
      newBalance: result.newBalance,
      package: result.package.name,
      basePoints: payment.metadata.basePoints,
      bonusPoints: payment.metadata.bonusPoints
    };
  } catch (error) {
    logger.error('Error processing points payment:', error);
    throw error;
  }
};

/**
 * Crear registro de compra si no existe
 */
const createPurchaseRecord = async (payment) => {
  try {
    const { packageId, basePoints, bonusPoints, totalPoints } = payment.metadata;

    const purchase = await prisma.pointsPurchase.create({
      data: {
        clientId: payment.clientId,
        packageId,
        pointsPurchased: parseInt(basePoints),
        bonusPoints: parseInt(bonusPoints),
        totalPoints: parseInt(totalPoints),
        amountPaid: payment.amount,
        status: 'PENDING',
        stripePaymentId: payment.stripePaymentId
      }
    });

    // Actualizar metadata del payment
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        metadata: {
          ...payment.metadata,
          purchaseId: purchase.id
        }
      }
    });

    return purchase.id;
  } catch (error) {
    logger.error('Error creating purchase record:', error);
    throw error;
  }
};

/**
 * Validar compra de puntos
 */
const validatePointsPurchase = async (clientId, packageId) => {
  try {
    // Verificar que el cliente existe
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        user: {
          select: {
            isActive: true,
            isBanned: true
          }
        }
      }
    });

    if (!client) {
      throw new Error('Cliente no encontrado');
    }

    if (!client.user.isActive) {
      throw new Error('Cuenta de usuario no activa');
    }

    if (client.user.isBanned) {
      throw new Error('Usuario baneado, no puede realizar compras');
    }

    // Verificar que el paquete existe y está activo
    const pointsPackage = await prisma.pointsPackage.findUnique({
      where: { id: packageId }
    });

    if (!pointsPackage) {
      throw new Error('Paquete de puntos no encontrado');
    }

    if (!pointsPackage.isActive) {
      throw new Error('Paquete de puntos no disponible');
    }

    // Verificar límites de compra (opcional)
    const recentPurchases = await prisma.pointsPurchase.count({
      where: {
        clientId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24 horas
        },
        status: 'COMPLETED'
      }
    });

    if (recentPurchases >= 10) { // Máximo 10 compras por día
      throw new Error('Límite de compras diarias alcanzado');
    }

    return {
      valid: true,
      client,
      package: pointsPackage
    };
  } catch (error) {
    logger.error('Error validating points purchase:', error);
    throw error;
  }
};

/**
 * Manejar webhook específico de puntos
 */
const handlePointsWebhook = async (stripeEvent) => {
  try {
    switch (stripeEvent.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = stripeEvent.data.object;
        if (paymentIntent.metadata.type === 'points_purchase') {
          await processStripePayment(paymentIntent.id);
        }
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = stripeEvent.data.object;
        if (failedPayment.metadata.type === 'points_purchase') {
          await handlePointsPaymentFailure(failedPayment.id, failedPayment.last_payment_error?.message);
        }
        break;

      case 'payment_intent.canceled':
        const canceledPayment = stripeEvent.data.object;
        if (canceledPayment.metadata.type === 'points_purchase') {
          await handlePointsPaymentCancellation(canceledPayment.id);
        }
        break;

      default:
        logger.info('Unhandled points webhook event', { type: stripeEvent.type });
    }
  } catch (error) {
    logger.error('Error handling points webhook:', error);
    throw error;
  }
};

/**
 * Manejar fallo en pago de puntos
 */
const handlePointsPaymentFailure = async (paymentIntentId, failureReason) => {
  try {
    // Buscar el pago
    const payment = await prisma.payment.findUnique({
      where: { stripePaymentId: paymentIntentId },
      include: {
        client: {
          include: {
            user: { select: { id: true } }
          }
        }
      }
    });

    if (!payment) {
      logger.warn('Payment not found for failed points PaymentIntent', { paymentIntentId });
      return;
    }

    // Actualizar estado del pago
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        failureReason
      }
    });

    // Actualizar compra si existe
    if (payment.metadata.purchaseId) {
      await prisma.pointsPurchase.update({
        where: { id: payment.metadata.purchaseId },
        data: { status: 'FAILED' }
      });
    }

    // Crear notificación de fallo
    if (payment.client?.user?.id) {
      await prisma.notification.create({
        data: {
          userId: payment.client.user.id,
          type: 'PAYMENT_FAILED',
          title: 'Compra de puntos fallida',
          message: 'Tu compra de puntos no pudo ser procesada. Intenta nuevamente.',
          priority: 'HIGH',
          data: {
            paymentId: payment.id,
            amount: payment.amount,
            packageName: payment.metadata.packageName,
            failureReason
          }
        }
      });
    }

    logger.info('Points payment failure handled', {
      paymentId: payment.id,
      paymentIntentId,
      failureReason
    });
  } catch (error) {
    logger.error('Error handling points payment failure:', error);
  }
};

/**
 * Manejar cancelación de pago de puntos
 */
const handlePointsPaymentCancellation = async (paymentIntentId) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { stripePaymentId: paymentIntentId }
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'CANCELLED' }
      });

      // Actualizar compra si existe
      if (payment.metadata.purchaseId) {
        await prisma.pointsPurchase.update({
          where: { id: payment.metadata.purchaseId },
          data: { status: 'CANCELLED' }
        });
      }
    }

    logger.info('Points payment cancellation handled', { paymentIntentId });
  } catch (error) {
    logger.error('Error handling points payment cancellation:', error);
  }
};

// ============================================================================
// FUNCIONES EXISTENTES (MANTENIDAS)
// ============================================================================

// Procesar pago de post adicional
const processAdditionalPostPayment = async (payment, paymentIntent) => {
  try {
    const { userId, postData } = payment.metadata;
    let parsedPostData;

    try {
      parsedPostData = JSON.parse(postData);
    } catch (error) {
      throw new Error('Invalid post data in payment metadata');
    }

    // Verificar que el usuario existe y es escort
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { escort: true }
    });

    if (!user || user.userType !== 'ESCORT' || !user.escort) {
      throw new Error('User not found or not an escort');
    }

    // Crear el post en una transacción
    const result = await prisma.$transaction(async (tx) => {
      // Crear el post
      const newPost = await tx.post.create({
        data: {
          title: parsedPostData.title?.trim(),
          description: parsedPostData.description?.trim(),
          phone: parsedPostData.phone?.trim(),
          images: parsedPostData.images || [],
          locationId: parsedPostData.locationId || user.locationId,
          services: parsedPostData.services || '',
          rates: parsedPostData.rates || null,
          availability: parsedPostData.availability || null,
          premiumOnly: parsedPostData.premiumOnly === 'true',
          authorId: userId,
          score: 15.0, // Score más alto por ser post pagado
          discoveryScore: 20.0,
          qualityScore: 60
        }
      });

      // Actualizar contador de posts del escort
      await tx.escort.update({
        where: { userId },
        data: { currentPosts: { increment: 1 } }
      });

      // Procesar tags si los hay
      if (parsedPostData.tags && Array.isArray(parsedPostData.tags)) {
        await Promise.all(
          parsedPostData.tags.map(async (tagName) => {
            const tag = await tx.tag.upsert({
              where: { name: tagName.toLowerCase() },
              update: { usageCount: { increment: 1 } },
              create: {
                name: tagName.toLowerCase(),
                slug: tagName.toLowerCase().replace(/\s+/g, '-'),
                usageCount: 1
              }
            });

            return tx.postTag.create({
              data: {
                postId: newPost.id,
                tagId: tag.id
              }
            });
          })
        );
      }

      // Actualizar reputación del usuario
      await tx.userReputation.upsert({
        where: { userId },
        update: {
          qualityScore: { increment: 10 },
          lastScoreUpdate: new Date()
        },
        create: {
          userId,
          overallScore: 10,
          responseRate: 0,
          profileCompleteness: 0,
          trustScore: 0,
          discoveryScore: 0,
          trendingScore: 0,
          qualityScore: 10,
          spamScore: 0,
          reportScore: 0,
          lastScoreUpdate: new Date()
        }
      });

      return newPost;
    });

    return {
      type: 'additional_post',
      postId: result.id,
      postTitle: result.title,
      userId,
      createdAt: result.createdAt
    };
  } catch (error) {
    logger.error('Error processing additional post payment:', error);
    throw error;
  }
};

// Procesar pago de boost
const processBoostPayment = async (payment, paymentIntent) => {
  try {
    const { postId, pricingId, userId } = payment.metadata;

    // Obtener pricing y post
    const [pricing, post] = await Promise.all([
      prisma.boostPricing.findUnique({ where: { id: pricingId } }),
      prisma.post.findUnique({ 
        where: { id: postId },
        include: { author: { select: { id: true } } }
      })
    ]);

    if (!pricing || !post) {
      throw new Error('Boost pricing or post not found');
    }

    // Verificar que el post pertenece al usuario
    if (post.authorId !== userId) {
      throw new Error('Post does not belong to user');
    }

    // Capturar métricas antes del boost
    const metricsBefore = {
      views: post.views,
      clicks: post.clicks,
      engagement: post.engagementRate
    };

    // Crear boost en transacción
    const result = await prisma.$transaction(async (tx) => {
      // Crear boost
      const boost = await tx.boost.create({
        data: {
          pricingId,
          userId: post.author.id,
          postId,
          viewsBefore: metricsBefore.views,
          clicksBefore: metricsBefore.clicks,
          engagementBefore: metricsBefore.engagement,
          expiresAt: new Date(Date.now() + pricing.duration * 60 * 60 * 1000)
        }
      });

      // Actualizar post con boost
      await tx.post.update({
        where: { id: postId },
        data: {
          lastBoosted: new Date(),
          score: { increment: pricing.multiplier * 10 },
          trendingScore: { increment: pricing.multiplier * 5 },
          isFeatured: ['FEATURED', 'SUPER', 'MEGA'].includes(pricing.type),
          hasActiveBoost: true,
          boostEndsAt: boost.expiresAt
        }
      });

      return boost;
    });

    return {
      type: 'boost',
      boostId: result.id,
      postId,
      boostType: pricing.type,
      duration: pricing.duration,
      expiresAt: result.expiresAt,
      multiplier: pricing.multiplier
    };
  } catch (error) {
    logger.error('Error processing boost payment:', error);
    throw error;
  }
};

// Procesar pago premium
const processPremiumPayment = async (payment, paymentIntent) => {
  try {
    const { tier, duration, userId } = payment.metadata;
    const durationMonths = parseInt(duration);

    if (!payment.clientId) {
      throw new Error('Client ID not found in payment');
    }

    // Obtener cliente actual
    const currentClient = await prisma.client.findUnique({
      where: { id: payment.clientId },
      select: { 
        userId: true,
        isPremium: true, 
        premiumUntil: true, 
        premiumTier: true 
      }
    });

    if (!currentClient) {
      throw new Error('Client not found');
    }

    // Calcular nueva fecha de expiración
    const currentExpiry = currentClient.premiumUntil || new Date();
    const newExpiry = new Date(Math.max(currentExpiry.getTime(), Date.now()) + durationMonths * 30 * 24 * 60 * 60 * 1000);

    // Configurar beneficios según tier
    const tierBenefits = getTierBenefits(tier);

    // Actualizar cliente
    const updatedClient = await prisma.client.update({
      where: { id: payment.clientId },
      data: {
        isPremium: true,
        premiumTier: tier,
        premiumUntil: newExpiry,
        ...tierBenefits
      }
    });

    return {
      type: 'premium',
      tier,
      duration: durationMonths,
      expiresAt: newExpiry,
      benefits: tierBenefits,
      upgraded: currentClient.premiumTier !== tier
    };
  } catch (error) {
    logger.error('Error processing premium payment:', error);
    throw error;
  }
};

// Procesar pago de verificación
const processVerificationPayment = async (payment, paymentIntent) => {
  try {
    const { escortId, pricingId, agencyId, membershipId, userId } = payment.metadata;

    // Buscar pricing y membership
    const [pricing, membership] = await Promise.all([
      prisma.verificationPricing.findUnique({ where: { id: pricingId } }),
      prisma.agencyMembership.findUnique({
        where: { id: membershipId },
        include: {
          escort: {
            include: {
              user: { select: { id: true } }
            }
          }
        }
      })
    ]);

    if (!pricing || !membership) {
      throw new Error('Verification pricing or membership not found');
    }

    // Procesar verificación en transacción
    const result = await prisma.$transaction(async (tx) => {
      // Crear verificación
      const verification = await tx.escortVerification.create({
        data: {
          agencyId,
          escortId,
          pricingId,
          membershipId,
          status: 'COMPLETED',
          verifiedBy: userId,
          completedAt: new Date(),
          startsAt: new Date(),
          expiresAt: new Date(Date.now() + (pricing.duration || 30) * 24 * 60 * 60 * 1000)
        }
      });

      // Marcar escort como verificado
      await tx.escort.update({
        where: { id: escortId },
        data: {
          isVerified: true,
          verifiedAt: new Date(),
          verifiedBy: agencyId,
          verificationExpiresAt: verification.expiresAt
        }
      });

      // Actualizar contadores de la agencia
      await tx.agency.update({
        where: { id: agencyId },
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

      return verification;
    });

    return {
      type: 'verification',
      verificationId: result.id,
      escortId,
      agencyId,
      completedAt: result.completedAt,
      expiresAt: result.expiresAt
    };
  } catch (error) {
    logger.error('Error processing verification payment:', error);
    throw error;
  }
};

// Obtener beneficios según tier premium
const getTierBenefits = (tier) => {
  const benefits = {
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

  return benefits[tier] || benefits.PREMIUM;
};

// Crear notificación de pago exitoso
const createPaymentSuccessNotification = async (payment, processingResult) => {
  try {
    let title, message, data, userId;

    // Determinar el usuario al que enviar la notificación
    if (payment.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: payment.clientId },
        include: { user: { select: { id: true } } }
      });
      userId = client?.user.id;
    } else if (payment.escortId) {
      const escort = await prisma.escort.findUnique({
        where: { id: payment.escortId },
        include: { user: { select: { id: true } } }
      });
      userId = escort?.user.id;
    } else if (payment.agencyId) {
      const agency = await prisma.agency.findUnique({
        where: { id: payment.agencyId },
        include: { user: { select: { id: true } } }
      });
      userId = agency?.user.id;
    }

    if (!userId) {
      logger.warn('No user ID found for payment notification', { paymentId: payment.id });
      return;
    }

    switch (payment.type) {
      case 'BOOST':
        title = 'Boost activado';
        message = `Tu post ha sido potenciado por ${processingResult.duration} horas`;
        data = {
          postId: processingResult.postId,
          boostType: processingResult.boostType,
          expiresAt: processingResult.expiresAt
        };
        break;
      
      case 'POINTS': // ✅ NUEVO
        title = 'Puntos agregados';
        message = `Se han agregado ${processingResult.pointsAdded} puntos a tu cuenta`;
        if (processingResult.bonusPoints > 0) {
          message += ` (incluye ${processingResult.bonusPoints} puntos bonus!)`;
        }
        data = {
          pointsAdded: processingResult.pointsAdded,
          basePoints: processingResult.basePoints,
          bonusPoints: processingResult.bonusPoints,
          newBalance: processingResult.newBalance,
          package: processingResult.package
        };
        break;
      
      case 'PREMIUM':
        title = `¡Bienvenido a ${processingResult.tier}!`;
        message = `Tu suscripción ${processingResult.tier} está activa`;
        data = {
          tier: processingResult.tier,
          expiresAt: processingResult.expiresAt,
          benefits: processingResult.benefits
        };
        break;
      
      case 'VERIFICATION':
        title = 'Verificación completada';
        message = 'La verificación ha sido procesada exitosamente';
        data = {
          verificationId: processingResult.verificationId,
          expiresAt: processingResult.expiresAt
        };
        break;

      case 'POST_ADDITIONAL':
        title = 'Post adicional creado';
        message = `Tu post "${processingResult.postTitle}" ha sido creado exitosamente`;
        data = {
          postId: processingResult.postId,
          postTitle: processingResult.postTitle
        };
        break;
      
      default:
        title = 'Pago completado';
        message = 'Tu pago ha sido procesado exitosamente';
        data = {};
    }

    await prisma.notification.create({
      data: {
        userId,
        type: 'PAYMENT_SUCCESS',
        title,
        message,
        data: {
          paymentId: payment.id,
          amount: payment.amount,
          ...data
        }
      }
    });
  } catch (error) {
    logger.error('Error creating payment success notification:', error);
    // No lanzar error, es solo notificación
  }
};

// Manejar fallos de pago
const handlePaymentFailure = async (paymentIntentId, failureReason) => {
  try {
    // Buscar y actualizar pago
    const payment = await prisma.payment.findUnique({
      where: { stripePaymentId: paymentIntentId }
    });

    if (!payment) {
      logger.warn('Payment not found for failed PaymentIntent', { paymentIntentId });
      return;
    }

    // Actualizar estado
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        failureReason
      }
    });

    // Determinar usuario para notificación
    let userId;
    if (payment.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: payment.clientId },
        include: { user: { select: { id: true } } }
      });
      userId = client?.user.id;
    } else if (payment.escortId) {
      const escort = await prisma.escort.findUnique({
        where: { id: payment.escortId },
        include: { user: { select: { id: true } } }
      });
      userId = escort?.user.id;
    } else if (payment.agencyId) {
      const agency = await prisma.agency.findUnique({
        where: { id: payment.agencyId },
        include: { user: { select: { id: true } } }
      });
      userId = agency?.user.id;
    }

    if (userId) {
      // Crear notificación de fallo
      await prisma.notification.create({
        data: {
          userId,
          type: 'PAYMENT_FAILED',
          title: 'Pago fallido',
          message: 'Tu pago no pudo ser procesado. Intenta nuevamente.',
          priority: 'HIGH',
          data: {
            paymentId: payment.id,
            amount: payment.amount,
            type: payment.type,
            failureReason
          }
        }
      });
    }

    logger.info('Payment failure handled', {
      paymentId: payment.id,
      paymentIntentId,
      failureReason
    });
  } catch (error) {
    logger.error('Error handling payment failure:', error);
  }
};

// Procesar reembolso
const processRefund = async (paymentId, amount = null, reason = '') => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId }
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'COMPLETED') {
      throw new Error('Payment is not completed');
    }

    // Crear reembolso en Stripe
    const refundAmount = amount ? Math.round(amount * 100) : undefined;
    const refund = await stripe.refunds.create({
      payment_intent: payment.stripePaymentId,
      amount: refundAmount,
      reason: 'requested_by_customer',
      metadata: {
        paymentId: payment.id,
        refundReason: reason
      }
    });

    // Actualizar pago
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'REFUNDED',
        refundReason: reason,
        metadata: {
          ...payment.metadata,
          refundId: refund.id,
          refundAmount: refund.amount / 100
        }
      }
    });

    // Procesar reversión según tipo de pago
    await processPaymentReversal(payment, refund.amount / 100);

    // Determinar usuario para notificación
    let userId;
    if (payment.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: payment.clientId },
        include: { user: { select: { id: true } } }
      });
      userId = client?.user.id;
    } else if (payment.escortId) {
      const escort = await prisma.escort.findUnique({
        where: { id: payment.escortId },
        include: { user: { select: { id: true } } }
      });
      userId = escort?.user.id;
    } else if (payment.agencyId) {
      const agency = await prisma.agency.findUnique({
        where: { id: payment.agencyId },
        include: { user: { select: { id: true } } }
      });
      userId = agency?.user.id;
    }

    if (userId) {
      // Crear notificación
      await prisma.notification.create({
        data: {
          userId,
          type: 'PAYMENT_SUCCESS', // Usar SUCCESS porque el reembolso es exitoso
          title: 'Reembolso procesado',
          message: `Tu reembolso de ${(refund.amount / 100).toFixed(2)} ha sido procesado`,
          data: {
            originalPaymentId: payment.id,
            refundAmount: refund.amount / 100,
            refundId: refund.id
          }
        }
      });
    }

    logger.info('Refund processed', {
      paymentId,
      refundId: refund.id,
      amount: refund.amount / 100,
      reason
    });

    return {
      refund,
      payment,
      success: true
    };
  } catch (error) {
    logger.error('Error processing refund:', error);
    throw error;
  }
};

// Procesar reversión de beneficios
const processPaymentReversal = async (payment, refundAmount) => {
  try {
    switch (payment.type) {
      case 'POINTS': // ✅ NUEVO
        if (payment.clientId && payment.metadata.purchaseId) {
          // Usar el servicio de puntos para procesar el reembolso
          await pointsService.processPointsRefund(
            payment.metadata.purchaseId,
            `Reembolso de pago - ${payment.id}`
          );
        }
        break;

      case 'PREMIUM':
        if (payment.clientId) {
          // Revertir premium si aún está activo
          await prisma.client.update({
            where: { id: payment.clientId },
            data: {
              isPremium: false,
              premiumTier: 'BASIC',
              premiumUntil: null,
              ...getTierBenefits('BASIC')
            }
          });
        }
        break;

      case 'BOOST':
        // Desactivar boost si aún está activo
        const { postId } = payment.metadata;
        if (postId) {
          await prisma.boost.updateMany({
            where: {
              postId,
              isActive: true
            },
            data: { isActive: false }
          });

          // Revertir cambios en el post
          await prisma.post.update({
            where: { id: postId },
            data: {
              hasActiveBoost: false,
              boostEndsAt: null,
              isFeatured: false
            }
          });
        }
        break;

      case 'POST_ADDITIONAL':
        // Marcar post como inactivo (soft delete)
        const postIdAdditional = payment.metadata.postId;
        if (postIdAdditional) {
          await prisma.post.update({
            where: { id: postIdAdditional },
            data: {
              isActive: false,
              deletedAt: new Date()
            }
          });

          // Decrementar contador de posts del escort
          if (payment.escortId) {
            await prisma.escort.update({
              where: { id: payment.escortId },
              data: { currentPosts: { decrement: 1 } }
            });
          }
        }
        break;

      // VERIFICATION no se revierte automáticamente por política
    }
  } catch (error) {
    logger.error('Error processing payment reversal:', error);
    // No lanzar error, el reembolso se procesó en Stripe
  }
};

// Obtener estadísticas de pagos
const getPaymentStats = async (timeframe = '30d') => {
  try {
    let dateFilter = {};
    const now = new Date();

    switch (timeframe) {
      case '7d':
        dateFilter = { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case '30d':
        dateFilter = { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
        break;
      case '90d':
        dateFilter = { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
        break;
    }

    const [
      totalRevenue,
      paymentsByType,
      paymentsByStatus,
      averageTransaction,
      revenueByUserType,
      pointsStats // ✅ NUEVO
    ] = await Promise.all([
      // Revenue total
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: dateFilter
        },
        _sum: { amount: true },
        _count: true
      }),

      // Pagos por tipo
      prisma.payment.groupBy({
        by: ['type'],
        where: {
          status: 'COMPLETED',
          createdAt: dateFilter
        },
        _sum: { amount: true },
        _count: true
      }),

      // Pagos por estado
      prisma.payment.groupBy({
        by: ['status'],
        where: { createdAt: dateFilter },
        _count: true
      }),

      // Transacción promedio
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: dateFilter
        },
        _avg: { amount: true }
      }),

      // Revenue por tipo de usuario
      prisma.$queryRaw`
        SELECT 
          CASE 
            WHEN "clientId" IS NOT NULL THEN 'CLIENT'
            WHEN "escortId" IS NOT NULL THEN 'ESCORT'
            WHEN "agencyId" IS NOT NULL THEN 'AGENCY'
            ELSE 'UNKNOWN'
          END as user_type,
          SUM(amount) as total_revenue,
          COUNT(*) as transaction_count
        FROM "payments"
        WHERE status = 'COMPLETED' 
        AND "createdAt" >= ${dateFilter.gte || new Date(0)}
        GROUP BY user_type
      `,

      // ✅ NUEVO: Estadísticas específicas de puntos
      prisma.pointsPurchase.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: dateFilter
        },
        _sum: {
          totalPoints: true,
          amountPaid: true
        },
        _count: true,
        _avg: {
          amountPaid: true,
          totalPoints: true
        }
      })
    ]);

    return {
      timeframe,
      revenue: {
        total: totalRevenue._sum.amount || 0,
        transactions: totalRevenue._count,
        average: averageTransaction._avg.amount || 0
      },
      byType: paymentsByType.reduce((acc, item) => {
        acc[item.type] = {
          revenue: item._sum.amount,
          count: item._count
        };
        return acc;
      }, {}),
      byStatus: paymentsByStatus.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {}),
      byUserType: revenueByUserType.reduce((acc, item) => {
        acc[item.user_type] = {
          revenue: parseFloat(item.total_revenue),
          transactions: parseInt(item.transaction_count)
        };
        return acc;
      }, {}),
      // ✅ NUEVO: Estadísticas de puntos
      points: {
        totalPointsSold: pointsStats._sum.totalPoints || 0,
        totalRevenue: pointsStats._sum.amountPaid || 0,
        totalPurchases: pointsStats._count || 0,
        averagePurchase: pointsStats._avg.amountPaid || 0,
        averagePointsPerPurchase: pointsStats._avg.totalPoints || 0,
        revenuePerPoint: pointsStats._sum.totalPoints > 0 
          ? (pointsStats._sum.amountPaid / pointsStats._sum.totalPoints).toFixed(4)
          : 0
      },
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error getting payment stats:', error);
    throw error;
  }
};

// ============================================================================
// EXPORTAR MÓDULO
// ============================================================================

module.exports = {
  processStripePayment,
  handlePaymentFailure,
  processRefund,
  getPaymentStats,
  processBoostPayment,
  processPointsPayment,
  processPremiumPayment,
  processVerificationPayment,
  processAdditionalPostPayment,
  getTierBenefits,
  
  // ✅ NUEVAS FUNCIONES PARA PUNTOS
  createPointsPaymentIntent,
  validatePointsPurchase,
  handlePointsWebhook,
  handlePointsPaymentFailure,
  handlePointsPaymentCancellation
};