// src/services/paymentService.js
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const notificationService = require('./notificationService');
const pointService = require('./pointService');

const prisma = new PrismaClient();

/**
 * Servicio para gestionar pagos y transacciones
 */
class PaymentService {
  /**
   * Crea un nuevo pago
   * @param {Object} paymentData - Datos del pago
   * @returns {Promise<Object>} - Pago creado
   */
  async createPayment(paymentData) {
    try {
      const {
        userId,
        amount,
        currency = 'USD',
        paymentType,
        referenceId,
        referenceType,
        paymentMethodType,
        paymentMethodId,
        provider,
        couponId,
        billingAddress,
        metadata
      } = paymentData;

      // Validar datos requeridos
      if (!userId || !amount || !paymentType || !provider || !paymentMethodType) {
        throw new Error('Faltan datos requeridos para el pago');
      }

      // Verificar que el usuario existe
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      // Si se proporciona un cupón, verificar que sea válido
      let discountAmount = 0;
      let coupon = null;

      if (couponId) {
        coupon = await prisma.userCoupon.findUnique({
          where: {
            id: couponId,
            userId,
            isUsed: false,
            expiresAt: {
              gt: new Date()
            }
          }
        });

        if (!coupon) {
          throw new Error('Cupón no válido o ya utilizado');
        }

        // Calcular descuento
        discountAmount = (amount * coupon.discountPercentage) / 100;
      }

      // Calcular tasas y comisiones
      const platformFee = await this._calculatePlatformFee(userId, amount, paymentType);
      const providerFee = this._calculateProviderFee(amount, provider, paymentMethodType);
      const totalFees = platformFee + providerFee;
      
      // Aplicar descuento del cupón al monto
      const finalAmount = amount - discountAmount;

      // Crear el pago
      const payment = await prisma.payment.create({
        data: {
          userId,
          amount: finalAmount,
          currency,
          paymentType,
          referenceId,
          referenceType,
          paymentMethodType,
          paymentMethodId,
          provider,
          platformFee,
          providerFee,
          totalFees,
          netAmount: finalAmount - totalFees,
          couponId,
          discountAmount,
          billingAddress: billingAddress || {},
          metadata: metadata || {},
          ipAddress: paymentData.ipAddress,
          deviceInfo: paymentData.deviceInfo
        }
      });

      // Si hay cupón, reservarlo (todavía no marcarlo como usado hasta que se complete el pago)
      if (coupon) {
        await prisma.userCoupon.update({
          where: { id: couponId },
          data: {
            usedInPayment: payment.id
          }
        });
      }

      // Registrar el primer estado del pago
      await prisma.paymentStatusHistory.create({
        data: {
          paymentId: payment.id,
          newStatus: 'pendiente',
          reason: 'Pago iniciado'
        }
      });

      return payment;
    } catch (error) {
      logger.error(`Error al crear pago: ${error.message}`, { error });
      throw new Error(`Error al crear pago: ${error.message}`);
    }
  }

  /**
   * Calcula la comisión de la plataforma
   * @param {string} userId - ID del usuario
   * @param {number} amount - Monto del pago
   * @param {string} paymentType - Tipo de pago
   * @returns {Promise<number>} - Comisión calculada
   * @private
   */
  async _calculatePlatformFee(userId, amount, paymentType) {
    try {
      // Obtener configuración del sistema
      const settings = await prisma.systemSetting.findFirst();
      
      if (!settings) {
        return 0;
      }

      // Comisión base
      let feePercentage = settings.platformCommissionPercentage || 10;

      // Si el usuario es VIP, aplicar descuento en la comisión
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          isVip: true,
          vipLevel: true
        }
      });

      if (user?.isVip) {
        feePercentage -= settings.vipCommissionDiscount || 2;
      }

      // Verificar tipo de pago
      if (paymentType === 'verificacion' || paymentType === 'membresia_vip') {
        // Menos comisión para verificaciones y membresías
        feePercentage /= 2;
      }

      return (amount * feePercentage) / 100;
    } catch (error) {
      logger.error(`Error al calcular comisión de plataforma: ${error.message}`, { error });
      // Valor predeterminado en caso de error
      return (amount * 10) / 100;
    }
  }

  /**
   * Calcula la comisión del proveedor de pagos
   * @param {number} amount - Monto del pago
   * @param {string} provider - Proveedor de pagos
   * @param {string} paymentMethodType - Tipo de método de pago
   * @returns {number} - Comisión calculada
   * @private
   */
  _calculateProviderFee(amount, provider, paymentMethodType) {
    // Comisiones simuladas según proveedor y método
    const feeRates = {
      'stripe': {
        'tarjeta_credito': 2.9,
        'tarjeta_debito': 2.9,
        'default': 2.9
      },
      'paypal': {
        'default': 3.5
      },
      'mercado_pago': {
        'tarjeta_credito': 3.99,
        'tarjeta_debito': 3.49,
        'default': 3.99
      },
      'default': 3.0
    };

    // Obtener tasa según proveedor y método
    const providerRates = feeRates[provider] || feeRates['default'];
    const rate = providerRates[paymentMethodType] || providerRates['default'] || feeRates['default'];

    return (amount * rate) / 100;
  }

  /**
   * Procesa un pago según el proveedor
   * @param {string} paymentId - ID del pago
   * @param {Object} providerData - Datos del proveedor
   * @returns {Promise<Object>} - Pago procesado
   */
  async processPayment(paymentId, providerData) {
    try {
      // Obtener el pago existente
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId }
      });

      if (!payment) {
        throw new Error('Pago no encontrado');
      }

      if (payment.status !== 'pendiente' && payment.status !== 'procesando') {
        throw new Error(`El pago ya está en estado ${payment.status}`);
      }

      // Actualizar a estado procesando
      await this.updatePaymentStatus(paymentId, 'procesando', 'Procesando pago con proveedor');

      // Procesar según el proveedor
      let result;
      switch (payment.provider.toLowerCase()) {
        case 'stripe':
          result = await this._processStripePayment(payment, providerData);
          break;
        case 'paypal':
          result = await this._processPaypalPayment(payment, providerData);
          break;
        case 'mercado_pago':
          result = await this._processMercadoPagoPayment(payment, providerData);
          break;
        default:
          // Para pruebas/desarrollo, simular un procesamiento exitoso
          result = await this._simulatePaymentProcessing(payment, providerData);
      }

      return result;
    } catch (error) {
      logger.error(`Error al procesar pago: ${error.message}`, { error });
      
      // Actualizar estado en caso de error
      await this.updatePaymentStatus(
        paymentId, 
        'fallido', 
        `Error al procesar: ${error.message}`
      );
      
      throw new Error(`Error al procesar pago: ${error.message}`);
    }
  }

  /**
   * Simula el procesamiento de un pago (para desarrollo)
   * @param {Object} payment - Pago a procesar
   * @param {Object} providerData - Datos del proveedor
   * @returns {Promise<Object>} - Pago procesado
   * @private
   */
  async _simulatePaymentProcessing(payment, providerData) {
    try {
      logger.info(`[SIMULADO] Procesando pago ${payment.id}`);

      // Simulación: 90% de probabilidad de éxito
      const isSuccessful = Math.random() > 0.1;

      if (!isSuccessful) {
        throw new Error('Pago simulado fallido');
      }

      // Actualizar pago con información del proveedor
      const providerTransactionId = `sim-${Date.now()}-${Math.round(Math.random() * 10000)}`;
      
      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerTransactionId,
          completedAt: new Date(),
          status: 'completado',
          statusDetail: 'Pago simulado completado con éxito',
          statusUpdatedAt: new Date()
        }
      });

      // Registrar estado de pago
      await prisma.paymentStatusHistory.create({
        data: {
          paymentId: payment.id,
          previousStatus: payment.status,
          newStatus: 'completado',
          reason: 'Pago simulado completado con éxito'
        }
      });

      // Ejecutar acciones post-pago
      await this._executePostPaymentActions(updatedPayment);

      return updatedPayment;
    } catch (error) {
      logger.error(`Error al simular pago: ${error.message}`, { error });
      await this.updatePaymentStatus(payment.id, 'fallido', `Simulación fallida: ${error.message}`);
      throw error;
    }
  }

  /**
   * Procesa un pago con Stripe
   * @param {Object} payment - Pago a procesar
   * @param {Object} providerData - Datos del proveedor
   * @returns {Promise<Object>} - Pago procesado
   * @private
   */
  async _processStripePayment(payment, providerData) {
    // En una implementación real, aquí iría el código para procesar con Stripe
    // Por ahora, simularemos el proceso
    return this._simulatePaymentProcessing(payment, providerData);
  }

  /**
   * Procesa un pago con PayPal
   * @param {Object} payment - Pago a procesar
   * @param {Object} providerData - Datos del proveedor
   * @returns {Promise<Object>} - Pago procesado
   * @private
   */
  async _processPaypalPayment(payment, providerData) {
    // En una implementación real, aquí iría el código para procesar con PayPal
    // Por ahora, simularemos el proceso
    return this._simulatePaymentProcessing(payment, providerData);
  }

  /**
   * Procesa un pago con Mercado Pago
   * @param {Object} payment - Pago a procesar
   * @param {Object} providerData - Datos del proveedor
   * @returns {Promise<Object>} - Pago procesado
   * @private
   */
  async _processMercadoPagoPayment(payment, providerData) {
    // En una implementación real, aquí iría el código para procesar con Mercado Pago
    // Por ahora, simularemos el proceso
    return this._simulatePaymentProcessing(payment, providerData);
  }

  /**
   * Actualiza el estado de un pago
   * @param {string} paymentId - ID del pago
   * @param {string} status - Nuevo estado
   * @param {string} reason - Razón del cambio
   * @param {string} [changedBy] - ID del usuario que realiza el cambio
   * @returns {Promise<Object>} - Pago actualizado
   */
  async updatePaymentStatus(paymentId, status, reason, changedBy = null) {
    try {
      // Obtener el pago actual
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId }
      });

      if (!payment) {
        throw new Error('Pago no encontrado');
      }

      // No permitir cambios a pagos ya completados, reembolsados o cancelados
      if (['completado', 'reembolsado', 'cancelado'].includes(payment.status)) {
        throw new Error(`No se puede cambiar el estado de un pago ${payment.status}`);
      }

      // Actualizar estado
      const updatedPayment = await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status,
          statusDetail: reason,
          statusUpdatedAt: new Date(),
          ...(status === 'completado' && { completedAt: new Date() }),
          ...(status === 'cancelado' && { 
            canceledAt: new Date(),
            canceledReason: reason
          })
        }
      });

      // Registrar cambio de estado
      await prisma.paymentStatusHistory.create({
        data: {
          paymentId,
          previousStatus: payment.status,
          newStatus: status,
          changedAt: new Date(),
          changedBy,
          reason
        }
      });

      // Ejecutar acciones post-pago si el estado es completado
      if (status === 'completado') {
        await this._executePostPaymentActions(updatedPayment);
      }

      return updatedPayment;
    } catch (error) {
      logger.error(`Error al actualizar estado de pago: ${error.message}`, { error });
      throw new Error(`Error al actualizar estado de pago: ${error.message}`);
    }
  }

  /**
   * Ejecuta acciones después de completar un pago
   * @param {Object} payment - Pago completado
   * @returns {Promise<void>}
   * @private
   */
  async _executePostPaymentActions(payment) {
    try {
      // Marcar cupón como usado si aplica
      if (payment.couponId) {
        await prisma.userCoupon.update({
          where: { id: payment.couponId },
          data: {
            isUsed: true,
            usedAt: new Date(),
            usedFor: payment.referenceId
          }
        });
      }

      // Otorgar puntos por compra
      await this._awardPointsForPurchase(payment);

      // Enviar notificación de pago completado
      await notificationService.sendNotification(payment.userId, {
        type: 'pago_completado',
        title: 'Pago completado con éxito',
        content: `Tu pago de ${payment.amount} ${payment.currency} ha sido procesado correctamente.`,
        referenceId: payment.id,
        referenceType: 'payment',
        sendEmail: true
      });

      // Ejecutar acciones específicas según el tipo de pago
      switch (payment.paymentType) {
        case 'paquete_cupones':
          await this._processCouponPackagePayment(payment);
          break;
        case 'membresia_vip':
          await this._processVipMembershipPayment(payment);
          break;
        case 'servicio_destacado':
          await this._processPremiumServicePayment(payment);
          break;
        case 'verificacion':
          await this._processVerificationPayment(payment);
          break;
        case 'suscripcion_agencia':
          await this._processAgencySubscriptionPayment(payment);
          break;
        default:
          logger.info(`No hay acciones específicas para el tipo de pago: ${payment.paymentType}`);
      }

      // Generar factura
      await this._generateInvoice(payment);
    } catch (error) {
      logger.error(`Error en acciones post-pago: ${error.message}`, { error });
      // No propagar el error para no interrumpir el flujo principal
    }
  }

  /**
   * Otorga puntos por compra
   * @param {Object} payment - Pago completado
   * @returns {Promise<void>}
   * @private
   */
  async _awardPointsForPurchase(payment) {
    try {
      // Verificar si el usuario es cliente (solo ellos acumulan puntos)
      const user = await prisma.user.findUnique({
        where: { id: payment.userId },
        select: { role: true }
      });

      if (user?.role !== 'cliente') {
        return;
      }

      // Calcular puntos a otorgar (1 punto por cada dólar gastado)
      const points = Math.floor(payment.amount);
      
      if (points <= 0) {
        return;
      }

      // Otorgar puntos
      await pointService.awardPoints(
        payment.userId,
        'compra',
        points,
        {
          referenceId: payment.id,
          referenceType: 'payment',
          description: `Puntos por compra de ${payment.paymentType}`
        }
      );
    } catch (error) {
      logger.error(`Error al otorgar puntos por compra: ${error.message}`, { error });
    }
  }

  /**
   * Procesa el pago de un paquete de cupones
   * @param {Object} payment - Pago completado
   * @returns {Promise<void>}
   * @private
   */
  async _processCouponPackagePayment(payment) {
    try {
      // Obtener detalles del paquete
      const couponPackage = await prisma.couponPackage.findUnique({
        where: { id: payment.referenceId },
        include: {
          packageItems: true
        }
      });

      if (!couponPackage) {
        throw new Error('Paquete de cupones no encontrado');
      }

      // Crear cupones para el usuario
      for (const item of couponPackage.packageItems) {
        for (let i = 0; i < item.quantity; i++) {
          await prisma.userCoupon.create({
            data: {
              userId: payment.userId,
              packageItemId: item.id,
              code: this._generateCouponCode(),
              discountPercentage: item.discountPercentage,
              expiresAt: new Date(Date.now() + (item.validDays * 24 * 60 * 60 * 1000)),
              isTransferable: true
            }
          });
        }
      }

      // Otorgar puntos adicionales del paquete
      if (couponPackage.pointsGranted > 0) {
        await pointService.awardPoints(
          payment.userId,
          'compra',
          couponPackage.pointsGranted,
          {
            referenceId: payment.id,
            referenceType: 'coupon_package',
            description: `Puntos incluidos en paquete ${couponPackage.name}`
          }
        );
      }

      // Procesar entradas para sorteos si aplica
      if (couponPackage.sorteoEntries > 0) {
        // Buscar sorteos activos
        const activeRaffle = await prisma.raffle.findFirst({
          where: {
            isActive: true,
            startsAt: { lte: new Date() },
            endsAt: { gte: new Date() }
          }
        });

        if (activeRaffle) {
          // Registrar entradas al sorteo
          await prisma.raffleEntry.create({
            data: {
              raffleId: activeRaffle.id,
              userId: payment.userId,
              entriesCount: couponPackage.sorteoEntries,
              pointsSpent: 0 // No gasta puntos porque vienen con el paquete
            }
          });

          // Actualizar contador de entradas
          await prisma.raffle.update({
            where: { id: activeRaffle.id },
            data: {
              totalEntries: activeRaffle.totalEntries + couponPackage.sorteoEntries
            }
          });
        }
      }
    } catch (error) {
      logger.error(`Error al procesar pago de paquete de cupones: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Procesa el pago de una membresía VIP
   * @param {Object} payment - Pago completado
   * @returns {Promise<void>}
   * @private
   */
  async _processVipMembershipPayment(payment) {
    try {
      // Obtener detalles de la membresía
      const membership = await prisma.vipMembership.findUnique({
        where: { id: payment.referenceId }
      });

      if (!membership) {
        throw new Error('Membresía VIP no encontrada');
      }

      // Calcular fechas
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + membership.durationDays);

      // Crear o actualizar membresía VIP del usuario
      const userVip = await prisma.userVipMembership.create({
        data: {
          userId: payment.userId,
          membershipId: membership.id,
          paymentId: payment.id,
          startsAt: startDate,
          expiresAt: endDate,
          isActive: true
        }
      });

      // Actualizar el usuario
      await prisma.user.update({
        where: { id: payment.userId },
        data: {
          isVip: true,
          vipLevel: membership.level
        }
      });

      // Si es cliente, actualizar la fecha de VIP
      await prisma.client.updateMany({
        where: { id: payment.userId },
        data: {
          vipUntil: endDate
        }
      });

      // Otorgar puntos de registro si aplica
      if (membership.signupPoints > 0) {
        await pointService.awardPoints(
          payment.userId,
          'compra',
          membership.signupPoints,
          {
            referenceId: payment.id,
            referenceType: 'vip_membership',
            description: `Puntos de registro por membresía ${membership.name}`
          }
        );

        // Marcar puntos como otorgados
        await prisma.userVipMembership.update({
          where: { id: userVip.id },
          data: {
            pointsAwarded: true
          }
        });
      }
    } catch (error) {
      logger.error(`Error al procesar pago de membresía VIP: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Procesa el pago de un servicio premium
   * @param {Object} payment - Pago completado
   * @returns {Promise<void>}
   * @private
   */
  async _processPremiumServicePayment(payment) {
    try {
      // Obtener detalles del servicio
      const service = await prisma.premiumService.findUnique({
        where: { id: payment.referenceId }
      });

      if (!service) {
        throw new Error('Servicio premium no encontrado');
      }

      // Obtener entidad destino del metadata
      const { profileId, agencyId } = payment.metadata || {};

      // Verificar que se especificó un destino válido
      if (!profileId && !agencyId) {
        throw new Error('No se especificó perfil o agencia para el servicio');
      }

      // Calcular fechas
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + service.durationDays);

      // Registrar servicio premium
      await prisma.userPremiumService.create({
        data: {
          userId: payment.userId,
          serviceId: service.id,
          profileId,
          agencyId,
          paymentId: payment.id,
          startsAt: startDate,
          expiresAt: endDate,
          isActive: true
        }
      });

      // Si es un servicio para perfil, actualizar el perfil
      if (profileId) {
        if (service.serviceType === 'featured') {
          await prisma.profile.update({
            where: { id: profileId },
            data: {
              isFeatured: true,
              featuredUntil: endDate
            }
          });
        } else if (service.serviceType === 'top_position') {
          await prisma.profile.update({
            where: { id: profileId },
            data: {
              boostUntil: endDate,
              searchBoostFactor: 5 // Valor arbitrario para impulsar posición
            }
          });
        }
      }

      // Si es un servicio para agencia, actualizar la agencia
      if (agencyId && service.serviceType === 'featured') {
        await prisma.agency.update({
          where: { id: agencyId },
          data: {
            featuredUntil: endDate
          }
        });
      }
    } catch (error) {
      logger.error(`Error al procesar pago de servicio premium: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Procesa el pago de verificación
   * @param {Object} payment - Pago completado
   * @returns {Promise<void>}
   * @private
   */
  async _processVerificationPayment(payment) {
    try {
      // Obtener detalles del pago
      const { profileId, agencyId, verificationData } = payment.metadata || {};

      // Verificar que se especificó un perfil y una agencia
      if (!profileId || !agencyId) {
        throw new Error('No se especificó perfil o agencia para la verificación');
      }

      // Crear registro de verificación
      await prisma.profileVerification.create({
        data: {
          profileId,
          agencyId,
          status: 'pendiente',
          paymentId: payment.id,
          verificationMethod: verificationData?.method || 'standard',
          notes: verificationData?.notes || 'Pago de verificación recibido'
        }
      });

      // Notificar a la agencia
      await notificationService.sendNotification(agencyId, {
        type: 'verificacion_solicitada',
        title: 'Nueva solicitud de verificación',
        content: 'Has recibido una nueva solicitud de verificación de perfil.',
        referenceId: profileId,
        referenceType: 'profile',
        deepLink: `/agency/verify-profile/${profileId}`,
        sendEmail: true
      });
    } catch (error) {
      logger.error(`Error al procesar pago de verificación: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Procesa el pago de suscripción de agencia
   * @param {Object} payment - Pago completado
   * @returns {Promise<void>}
   * @private
   */
  async _processAgencySubscriptionPayment(payment) {
    try {
      // Obtener detalles del plan
      const plan = await prisma.agencySubscriptionPlan.findUnique({
        where: { id: payment.referenceId }
      });

      if (!plan) {
        throw new Error('Plan de suscripción no encontrado');
      }

      // Calcular fechas
      const startDate = new Date();
      const endDate = new Date();
      
      // Determinar duración según el intervalo de facturación
      switch (plan.billingInterval) {
        case 'monthly':
          endDate.setMonth(endDate.getMonth() + 1);
          break;
        case 'quarterly':
          endDate.setMonth(endDate.getMonth() + 3);
          break;
        case 'yearly':
          endDate.setFullYear(endDate.getFullYear() + 1);
          break;
        default:
          endDate.setMonth(endDate.getMonth() + 1);
      }

      // Crear o actualizar suscripción
      await prisma.agencySubscription.create({
        data: {
          agencyId: payment.userId,
          planId: plan.id,
          paymentId: payment.id,
          startsAt: startDate,
          expiresAt: endDate,
          isActive: true,
          autoRenew: true
        }
      });

      // Actualizar datos de la agencia
      await prisma.agency.update({
        where: { id: payment.userId },
        data: {
          subscriptionTier: plan.name,
          subscriptionExpires: endDate
        }
      });
    } catch (error) {
      logger.error(`Error al procesar pago de suscripción de agencia: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Genera una factura para un pago
   * @param {Object} payment - Pago completado
   * @returns {Promise<Object>} - Factura generada
   * @private
   */
  async _generateInvoice(payment) {
    try {
      // Generar número de factura
      const invoiceNumber = `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

      // Construir items de factura
      let items;
      
      switch (payment.paymentType) {
        case 'paquete_cupones':
          const couponPackage = await prisma.couponPackage.findUnique({
            where: { id: payment.referenceId }
          });
          
          items = [{
            description: `Paquete de cupones: ${couponPackage?.name || 'Paquete de cupones'}`,
            quantity: 1,
            unitPrice: payment.amount,
            totalPrice: payment.amount,
            discountAmount: payment.discountAmount
          }];
          break;
        
        case 'membresia_vip':
          const membership = await prisma.vipMembership.findUnique({
            where: { id: payment.referenceId }
          });
          
          items = [{
            description: `Membresía VIP: ${membership?.name || 'Membresía VIP'}`,
            quantity: 1,
            unitPrice: payment.amount,
            totalPrice: payment.amount,
            discountAmount: payment.discountAmount
          }];
          break;
        
        case 'servicio_destacado':
          const service = await prisma.premiumService.findUnique({
            where: { id: payment.referenceId }
          });
          
          items = [{
            description: `Servicio premium: ${service?.name || 'Servicio destacado'}`,
            quantity: 1,
            unitPrice: payment.amount,
            totalPrice: payment.amount,
            discountAmount: payment.discountAmount
          }];
          break;
        
        case 'verificacion':
          items = [{
            description: 'Servicio de verificación de perfil',
            quantity: 1,
            unitPrice: payment.amount,
            totalPrice: payment.amount,
            discountAmount: payment.discountAmount
          }];
          break;
        
        case 'suscripcion_agencia':
          const plan = await prisma.agencySubscriptionPlan.findUnique({
            where: { id: payment.referenceId }
          });
          
          items = [{
            description: `Suscripción de agencia: ${plan?.name || 'Suscripción de agencia'}`,
            quantity: 1,
            unitPrice: payment.amount,
            totalPrice: payment.amount,
            discountAmount: payment.discountAmount
          }];
          break;
        
        default:
          items = [{
            description: `Pago por ${payment.paymentType}`,
            quantity: 1,
            unitPrice: payment.amount,
            totalPrice: payment.amount,
            discountAmount: payment.discountAmount
          }];
      }

      // Crear factura
      const invoice = await prisma.invoice.create({
        data: {
          paymentId: payment.id,
          userId: payment.userId,
          invoiceNumber,
          invoiceDate: new Date(),
          dueDate: new Date(), // Mismo día porque ya está pagada
          totalAmount: payment.amount,
          currency: payment.currency,
          status: 'pagada',
          paidAt: new Date(),
          items,
          billingDetails: payment.billingAddress,
          taxDetails: {
            taxRate: payment.taxRate || 0,
            taxAmount: payment.taxAmount || 0
          },
          notes: 'Gracias por tu compra'
        }
      });

      // Actualizar el pago con el número de factura
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          invoiceNumber
        }
      });

      return invoice;
    } catch (error) {
      logger.error(`Error al generar factura: ${error.message}`, { error });
      // No propagar error para no interrumpir flujo principal
      return null;
    }
  }

  /**
   * Genera un código de cupón único
   * @returns {string} - Código generado
   * @private
   */
  _generateCouponCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin caracteres ambiguos
    let result = '';
    
    // Generar un código de 8 caracteres
    for (let i = 0; i < 8; i++) {
      const pos = Math.floor(Math.random() * chars.length);
      result += chars.charAt(pos);
    }
    
    // Agregar prefijo y formato
    return `CPN-${result}`;
  }

  /**
   * Obtiene los pagos de un usuario
   * @param {string} userId - ID del usuario
   * @param {Object} options - Opciones de paginación y filtrado
   * @returns {Promise<Object>} - Pagos paginados
   */
  async getUserPayments(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        paymentType,
        startDate,
        endDate
      } = options;

      const skip = (page - 1) * limit;

      // Construir filtros
      const where = {
        userId,
        ...(status && { status }),
        ...(paymentType && { paymentType }),
        ...(startDate && {
          createdAt: {
            gte: new Date(startDate)
          }
        }),
        ...(endDate && {
          createdAt: {
            lte: new Date(endDate)
          }
        })
      };

      // Obtener pagos
      const payments = await prisma.payment.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      });

      // Contar total
      const total = await prisma.payment.count({ where });

      return {
        payments,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`Error al obtener pagos: ${error.message}`, { error });
      throw new Error(`Error al obtener pagos: ${error.message}`);
    }
  }

  /**
   * Obtiene el detalle de un pago
   * @param {string} paymentId - ID del pago
   * @param {string} userId - ID del usuario (para verificar acceso)
   * @returns {Promise<Object>} - Detalle del pago
   */
  async getPaymentDetails(paymentId, userId) {
    try {
      // Verificar si el pago existe y pertenece al usuario
      const payment = await prisma.payment.findFirst({
        where: {
          id: paymentId,
          userId
        },
        include: {
          statusHistory: {
            orderBy: { changedAt: 'asc' }
          },
          invoice: true,
          coupon: true
        }
      });

      if (!payment) {
        throw new Error('Pago no encontrado o sin acceso');
      }

      return payment;
    } catch (error) {
      logger.error(`Error al obtener detalle de pago: ${error.message}`, { error });
      throw new Error(`Error al obtener detalle de pago: ${error.message}`);
    }
  }

  /**
   * Solicita un reembolso
   * @param {string} paymentId - ID del pago
   * @param {string} userId - ID del usuario
   * @param {string} reason - Razón del reembolso
   * @returns {Promise<Object>} - Solicitud de reembolso
   */
  async requestRefund(paymentId, userId, reason) {
    try {
      // Verificar si el pago existe y pertenece al usuario
      const payment = await prisma.payment.findFirst({
        where: {
          id: paymentId,
          userId
        }
      });

      if (!payment) {
        throw new Error('Pago no encontrado o sin acceso');
      }

      if (payment.status !== 'completado') {
        throw new Error('Solo se pueden reembolsar pagos completados');
      }

      // Verificar tiempo (solo permitir reembolsos en las primeras 24 horas)
      const paymentTime = payment.completedAt || payment.createdAt;
      const timeDiff = Date.now() - paymentTime.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        throw new Error('El tiempo para solicitar reembolso ha expirado (24 horas)');
      }

      // Crear solicitud de reembolso
      const refund = await prisma.refund.create({
        data: {
          paymentId,
          amount: payment.amount,
          reason,
          requestedBy: userId,
          status: 'pendiente'
        }
      });

      // Notificar a los administradores
      const admins = await prisma.user.findMany({
        where: { role: 'admin' }
      });

      for (const admin of admins) {
        await notificationService.sendNotification(admin.id, {
          type: 'sistema',
          title: 'Nueva solicitud de reembolso',
          content: `El usuario ${userId} ha solicitado un reembolso por el pago ${paymentId}. Motivo: ${reason}`,
          referenceId: refund.id,
          referenceType: 'refund',
          importance: 'high',
          sendEmail: true
        });
      }

      return refund;
    } catch (error) {
      logger.error(`Error al solicitar reembolso: ${error.message}`, { error });
      throw new Error(`Error al solicitar reembolso: ${error.message}`);
    }
  }

  /**
   * Procesa un reembolso (solo administradores)
   * @param {string} refundId - ID de la solicitud de reembolso
   * @param {boolean} approved - ¿Aprobado o rechazado?
   * @param {string} adminId - ID del administrador
   * @param {string} notes - Notas adicionales
   * @returns {Promise<Object>} - Reembolso procesado
   */
  async processRefund(refundId, approved, adminId, notes = '') {
    try {
      // Verificar si la solicitud existe
      const refund = await prisma.refund.findUnique({
        where: { id: refundId },
        include: {
          payment: true
        }
      });

      if (!refund) {
        throw new Error('Solicitud de reembolso no encontrada');
      }

      if (refund.status !== 'pendiente') {
        throw new Error('La solicitud ya ha sido procesada');
      }

      // Actualizar solicitud
      const updatedRefund = await prisma.refund.update({
        where: { id: refundId },
        data: {
          status: approved ? 'aprobado' : 'rechazado',
          approvedBy: adminId,
          completedAt: approved ? new Date() : null,
          notes
        }
      });

      // Si se aprueba, procesar el reembolso
      if (approved) {
        // Actualizar el pago
        await prisma.payment.update({
          where: { id: refund.paymentId },
          data: {
            status: 'reembolsado',
            refundId: refundId,
            refundReason: refund.reason,
            statusDetail: 'Pago reembolsado',
            statusUpdatedAt: new Date()
          }
        });

        // Registrar estado de pago
        await prisma.paymentStatusHistory.create({
          data: {
            paymentId: refund.paymentId,
            previousStatus: refund.payment.status,
            newStatus: 'reembolsado',
            changedBy: adminId,
            reason: `Reembolso aprobado: ${refund.reason}`
          }
        });

        // Revertir acciones del pago según tipo
        await this._revertPaymentActions(refund.payment);
      }

      // Notificar al usuario
      await notificationService.sendNotification(refund.payment.userId, {
        type: approved ? 'pago_fallido' : 'sistema',
        title: approved ? 'Reembolso aprobado' : 'Reembolso rechazado',
        content: approved 
          ? `Tu solicitud de reembolso por ${refund.amount} ${refund.payment.currency} ha sido aprobada.` 
          : `Tu solicitud de reembolso ha sido rechazada. Motivo: ${notes || 'No se proporcionó motivo.'}`,
        referenceId: refundId,
        referenceType: 'refund',
        importance: 'high',
        sendEmail: true
      });

      return updatedRefund;
    } catch (error) {
      logger.error(`Error al procesar reembolso: ${error.message}`, { error });
      throw new Error(`Error al procesar reembolso: ${error.message}`);
    }
  }

  /**
   * Revierte las acciones de un pago reembolsado
   * @param {Object} payment - Pago a revertir
   * @returns {Promise<void>}
   * @private
   */
  async _revertPaymentActions(payment) {
    try {
      // Revertir acciones según tipo de pago
      switch (payment.paymentType) {
        case 'paquete_cupones':
          await this._revertCouponPackagePayment(payment);
          break;
        case 'membresia_vip':
          await this._revertVipMembershipPayment(payment);
          break;
        case 'servicio_destacado':
          await this._revertPremiumServicePayment(payment);
          break;
        case 'verificacion':
          await this._revertVerificationPayment(payment);
          break;
        case 'suscripcion_agencia':
          await this._revertAgencySubscriptionPayment(payment);
          break;
        default:
          logger.info(`No hay acciones de reversión para el tipo de pago: ${payment.paymentType}`);
      }

      // Revertir cupón si se usó
      if (payment.couponId) {
        await prisma.userCoupon.update({
          where: { id: payment.couponId },
          data: {
            isUsed: false,
            usedAt: null,
            usedFor: null,
            usedInPayment: null
          }
        });
      }

      // Revertir puntos otorgados
      const pointTransactions = await prisma.pointTransaction.findMany({
        where: {
          referenceId: payment.id,
          referenceType: 'payment'
        }
      });

      for (const transaction of pointTransactions) {
        // Otorgar puntos negativos para compensar
        await pointService.awardPoints(
          payment.userId,
          'devolucion',
          -transaction.points,
          {
            referenceId: payment.id,
            referenceType: 'refund',
            description: `Reverso de puntos por reembolso de ${payment.paymentType}`
          }
        );
      }
    } catch (error) {
      logger.error(`Error al revertir acciones de pago: ${error.message}`, { error });
      // No propagar error para no interrumpir flujo principal
    }
  }

  /**
   * Revierte un pago de paquete de cupones
   * @param {Object} payment - Pago a revertir
   * @returns {Promise<void>}
   * @private
   */
  async _revertCouponPackagePayment(payment) {
    try {
      // Obtener cupones generados por este pago
      const packageItemIds = await prisma.couponPackageItem.findMany({
        where: {
          packageId: payment.referenceId
        },
        select: { id: true }
      });

      const itemIds = packageItemIds.map(item => item.id);

      // Eliminar cupones no utilizados
      await prisma.userCoupon.deleteMany({
        where: {
          userId: payment.userId,
          packageItemId: {
            in: itemIds
          },
          isUsed: false
        }
      });

      // Los cupones ya utilizados se mantienen
    } catch (error) {
      logger.error(`Error al revertir pago de paquete de cupones: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Revierte un pago de membresía VIP
   * @param {Object} payment - Pago a revertir
   * @returns {Promise<void>}
   * @private
   */
  async _revertVipMembershipPayment(payment) {
    try {
      // Desactivar membresía
      await prisma.userVipMembership.updateMany({
        where: {
          paymentId: payment.id
        },
        data: {
          isActive: false,
          canceledAt: new Date(),
          cancellationReason: 'Reembolso'
        }
      });

      // Verificar si tiene otras membresías activas
      const hasActiveVip = await prisma.userVipMembership.findFirst({
        where: {
          userId: payment.userId,
          isActive: true,
          expiresAt: {
            gt: new Date()
          }
        }
      });

      // Si no tiene otras membresías activas, quitar estado VIP
      if (!hasActiveVip) {
        await prisma.user.update({
          where: { id: payment.userId },
          data: {
            isVip: false,
            vipLevel: null
          }
        });

        // Si es cliente, actualizar la fecha de VIP
        await prisma.client.updateMany({
          where: { id: payment.userId },
          data: {
            vipUntil: null
          }
        });
      }
    } catch (error) {
      logger.error(`Error al revertir pago de membresía VIP: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Revierte un pago de servicio premium
   * @param {Object} payment - Pago a revertir
   * @returns {Promise<void>}
   * @private
   */
  async _revertPremiumServicePayment(payment) {
    try {
      // Obtener servicios asociados a este pago
      const services = await prisma.userPremiumService.findMany({
        where: { paymentId: payment.id }
      });

      // Desactivar servicios
      await prisma.userPremiumService.updateMany({
        where: { paymentId: payment.id },
        data: {
          isActive: false,
          canceledAt: new Date(),
          cancelReason: 'Reembolso'
        }
      });

      // Revertir efectos en perfiles y agencias
      for (const service of services) {
        if (service.profileId) {
          // Verificar tipo de servicio
          const premiumService = await prisma.premiumService.findUnique({
            where: { id: service.serviceId }
          });

          if (premiumService?.serviceType === 'featured') {
            await prisma.profile.update({
              where: { id: service.profileId },
              data: {
                isFeatured: false,
                featuredUntil: null
              }
            });
          } else if (premiumService?.serviceType === 'top_position') {
            await prisma.profile.update({
              where: { id: service.profileId },
              data: {
                boostUntil: null,
                searchBoostFactor: 1
              }
            });
          }
        }

        if (service.agencyId) {
          await prisma.agency.update({
            where: { id: service.agencyId },
            data: {
              featuredUntil: null
            }
          });
        }
      }
    } catch (error) {
      logger.error(`Error al revertir pago de servicio premium: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Revierte un pago de verificación
   * @param {Object} payment - Pago a revertir
   * @returns {Promise<void>}
   * @private
   */
  async _revertVerificationPayment(payment) {
    try {
      // Obtener verificaciones asociadas
      const verifications = await prisma.profileVerification.findMany({
        where: { paymentId: payment.id }
      });

      // Marcar verificaciones como rechazadas
      await prisma.profileVerification.updateMany({
        where: { paymentId: payment.id },
        data: {
          status: 'rechazado',
          notes: `Verificación cancelada por reembolso del pago ${payment.id}`
        }
      });

      // Revertir estado de verificación en perfiles
      for (const verification of verifications) {
        // Solo revertir si el perfil todavía está en estado pendiente
        await prisma.profile.updateMany({
          where: {
            id: verification.profileId,
            verificationStatus: 'pendiente'
          },
          data: {
            verificationStatus: 'no_verificado',
            verifiedAt: null,
            verifiedBy: null,
            verificationExpires: null
          }
        });
      }
    } catch (error) {
      logger.error(`Error al revertir pago de verificación: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Revierte un pago de suscripción de agencia
   * @param {Object} payment - Pago a revertir
   * @returns {Promise<void>}
   * @private
   */
  async _revertAgencySubscriptionPayment(payment) {
    try {
      // Desactivar suscripción
      await prisma.agencySubscription.updateMany({
        where: { paymentId: payment.id },
        data: {
          isActive: false,
          autoRenew: false,
          canceledAt: new Date(),
          cancellationReason: 'Reembolso'
        }
      });

      // Verificar si tiene otras suscripciones activas
      const hasActiveSub = await prisma.agencySubscription.findFirst({
        where: {
          agencyId: payment.userId,
          isActive: true,
          expiresAt: {
            gt: new Date()
          }
        }
      });

      // Si no tiene otras suscripciones activas, actualizar datos de la agencia
      if (!hasActiveSub) {
        await prisma.agency.update({
          where: { id: payment.userId },
          data: {
            subscriptionTier: null,
            subscriptionExpires: null
          }
        });
      }
    } catch (error) {
      logger.error(`Error al revertir pago de suscripción de agencia: ${error.message}`, { error });
      throw error;
    }
  }
}

module.exports = new PaymentService();