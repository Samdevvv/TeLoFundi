const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { prisma } = require('../config/database');
const logger = require('../utils/logger');

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
      case 'POINTS':
        processingResult = await processPointsPayment(payment, paymentIntent);
        break;
      case 'PREMIUM':
        processingResult = await processPremiumPayment(payment, paymentIntent);
        break;
      case 'VERIFICATION':
        processingResult = await processVerificationPayment(payment, paymentIntent);
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

// Procesar pago de boost
const processBoostPayment = async (payment, paymentIntent) => {
  try {
    const { postId, pricingId } = payment.metadata;

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

    // Capturar métricas antes del boost
    const metricsBefore = {
      views: post.views,
      clicks: post.clicks,
      engagement: post.engagementRate
    };

    // Crear boost
    const boost = await prisma.boost.create({
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
    await prisma.post.update({
      where: { id: postId },
      data: {
        lastBoosted: new Date(),
        score: { increment: pricing.multiplier * 10 },
        trendingScore: { increment: pricing.multiplier * 5 },
        isFeatured: ['FEATURED', 'SUPER', 'MEGA'].includes(pricing.type)
      }
    });

    return {
      type: 'boost',
      boostId: boost.id,
      postId,
      boostType: pricing.type,
      duration: pricing.duration,
      expiresAt: boost.expiresAt,
      multiplier: pricing.multiplier
    };
  } catch (error) {
    logger.error('Error processing boost payment:', error);
    throw error;
  }
};

// Procesar pago de puntos
const processPointsPayment = async (payment, paymentIntent) => {
  try {
    const { totalPoints, pointsPackage } = payment.metadata;
    const pointsToAdd = parseInt(totalPoints);

    // Obtener saldo actual del cliente
    const currentClient = await prisma.client.findUnique({
      where: { id: payment.clientId },
      select: { points: true }
    });

    if (!currentClient) {
      throw new Error('Client not found');
    }

    // Actualizar puntos del cliente
    const updatedClient = await prisma.client.update({
      where: { id: payment.clientId },
      data: {
        points: { increment: pointsToAdd },
        totalPointsPurchased: { increment: pointsToAdd }
      }
    });

    // Crear transacción de puntos
    await prisma.pointTransaction.create({
      data: {
        clientId: payment.clientId,
        amount: pointsToAdd,
        type: 'PURCHASE',
        description: `Compra de puntos - ${pointsPackage}`,
        cost: payment.amount,
        paymentId: payment.id,
        balanceBefore: currentClient.points,
        balanceAfter: currentClient.points + pointsToAdd
      }
    });

    return {
      type: 'points',
      pointsAdded: pointsToAdd,
      newBalance: updatedClient.points,
      package: pointsPackage
    };
  } catch (error) {
    logger.error('Error processing points payment:', error);
    throw error;
  }
};

// Procesar pago premium
const processPremiumPayment = async (payment, paymentIntent) => {
  try {
    const { tier, duration } = payment.metadata;
    const durationMonths = parseInt(duration);

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
    const { verificationId } = payment.metadata;

    // Buscar verificación pendiente
    const verification = await prisma.escortVerification.findUnique({
      where: { id: verificationId },
      include: {
        escort: {
          include: {
            user: { select: { id: true } }
          }
        },
        agency: {
          include: {
            user: { select: { id: true } }
          }
        }
      }
    });

    if (!verification) {
      throw new Error('Verification not found');
    }

    // Completar verificación
    await prisma.escortVerification.update({
      where: { id: verificationId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    // Marcar escort como verificado
    await prisma.escort.update({
      where: { id: verification.escortId },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: verification.agencyId
      }
    });

    // Actualizar contadores de la agencia
    await prisma.agency.update({
      where: { id: verification.agencyId },
      data: {
        verifiedEscorts: { increment: 1 },
        totalVerifications: { increment: 1 }
      }
    });

    return {
      type: 'verification',
      verificationId,
      escortId: verification.escortId,
      agencyId: verification.agencyId,
      completedAt: new Date()
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
    let title, message, data;

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
      
      case 'POINTS':
        title = 'Puntos agregados';
        message = `Se han agregado ${processingResult.pointsAdded} puntos a tu cuenta`;
        data = {
          pointsAdded: processingResult.pointsAdded,
          newBalance: processingResult.newBalance
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
        message = 'Tu perfil ha sido verificado exitosamente';
        data = {
          verificationId: processingResult.verificationId
        };
        break;
      
      default:
        title = 'Pago completado';
        message = 'Tu pago ha sido procesado exitosamente';
        data = {};
    }

    await prisma.notification.create({
      data: {
        userId: payment.client.user.id,
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

    // Crear notificación de fallo
    await prisma.notification.create({
      data: {
        userId: payment.client.user.id,
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
      where: { id: paymentId },
      include: {
        client: {
          include: {
            user: { select: { id: true } }
          }
        }
      }
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

    // Crear notificación
    await prisma.notification.create({
      data: {
        userId: payment.client.user.id,
        type: 'PAYMENT_SUCCESS', // Usar SUCCESS porque el reembolso es exitoso
        title: 'Reembolso procesado',
        message: `Tu reembolso de $${(refund.amount / 100).toFixed(2)} ha sido procesado`,
        data: {
          originalPaymentId: payment.id,
          refundAmount: refund.amount / 100,
          refundId: refund.id
        }
      }
    });

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
      case 'POINTS':
        // Descontar puntos si aún los tiene
        const pointsToDeduct = payment.metadata.totalPoints;
        await prisma.client.update({
          where: { id: payment.clientId },
          data: {
            points: { decrement: pointsToDeduct }
          }
        });
        
        // Crear transacción negativa
        await prisma.pointTransaction.create({
          data: {
            clientId: payment.clientId,
            amount: -pointsToDeduct,
            type: 'REFUND',
            description: `Reembolso de compra de puntos`,
            paymentId: payment.id,
            balanceBefore: 0, // Se calculará después
            balanceAfter: 0
          }
        });
        break;

      case 'PREMIUM':
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
        break;

      case 'BOOST':
        // Desactivar boost si aún está activo
        const { postId } = payment.metadata;
        await prisma.boost.updateMany({
          where: {
            postId,
            isActive: true
          },
          data: { isActive: false }
        });
        break;

      // VERIFICATION no se revierte automáticamente
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
      topClients
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

      // Top clientes por volumen
      prisma.payment.groupBy({
        by: ['clientId'],
        where: {
          status: 'COMPLETED',
          createdAt: dateFilter
        },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
        take: 5
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
      topClients: topClients.map(client => ({
        clientId: client.clientId,
        revenue: client._sum.amount,
        transactions: client._count
      })),
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error getting payment stats:', error);
    throw error;
  }
};

module.exports = {
  processStripePayment,
  handlePaymentFailure,
  processRefund,
  getPaymentStats,
  processBoostPayment,
  processPointsPayment,
  processPremiumPayment,
  processVerificationPayment,
  getTierBenefits
};