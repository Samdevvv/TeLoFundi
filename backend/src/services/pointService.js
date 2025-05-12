// src/services/pointService.js
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const crypto = require('crypto');

const prisma = new PrismaClient();

class PointService {
  /**
   * Otorga puntos a un usuario
   * @param {string} userId - ID del usuario
   * @param {string} action - Tipo de acción
   * @param {number} points - Cantidad de puntos
   * @param {Object} metadata - Metadatos adicionales
   * @returns {Promise<Object>} - Transacción creada
   */
  async awardPoints(userId, action, points, metadata = {}) {
    try {
      // Verificar que el usuario exista
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { 
          id: true, 
          role: true,
          isVip: true,
          vipLevel: true
        }
      });
      
      if (!user) {
        throw new Error('Usuario no encontrado');
      }
      
      // Solo clientes pueden recibir puntos
      if (user.role !== 'cliente') {
        throw new Error('Solo los clientes pueden recibir puntos');
      }
      
      // Verificar si el usuario puede recibir puntos por esta acción
      const canReceivePoints = await this.canUserReceivePoints(
        userId,
        action,
        metadata.referenceId
      );
      
      if (!canReceivePoints) {
        throw new Error('El usuario ya ha recibido puntos por esta acción hoy');
      }
      
      // Ajustar puntos si es usuario VIP
      let adjustedPoints = points;
      if (user.isVip) {
        // Obtener multiplicador de puntos según nivel VIP
        const systemSettings = await prisma.systemSetting.findFirst();
        const multiplier = this.getVipMultiplier(
          user.vipLevel,
          systemSettings
        );
        
        adjustedPoints = Math.floor(points * multiplier);
      }
      
      // Calcular fecha de expiración si corresponde
      let expirationDate = null;
      if (metadata.expirationDays) {
        expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + metadata.expirationDays);
      } else {
        // Obtener días de expiración por defecto
        const systemSettings = await prisma.systemSetting.findFirst();
        if (systemSettings && systemSettings.pointsExpirationDays > 0) {
          expirationDate = new Date();
          expirationDate.setDate(
            expirationDate.getDate() + systemSettings.pointsExpirationDays
          );
        }
      }
      
      // Crear transacción de puntos
      const transaction = await prisma.pointTransaction.create({
        data: {
          userId,
          action,
          points: adjustedPoints,
          referenceId: metadata.referenceId,
          referenceType: metadata.referenceType,
          description: metadata.description,
          createdBy: metadata.createdBy,
          expirationDate,
          transactionBatch: metadata.transactionBatch || crypto.randomBytes(8).toString('hex')
        }
      });
      
      // La actualización del saldo se hace en un trigger (update_points_balance_history)
      
      return {
        transactionId: transaction.id,
        points: adjustedPoints,
        action
      };
    } catch (error) {
      logger.error(`Error al otorgar puntos: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Verifica si un usuario puede recibir puntos por una acción
   * @param {string} userId - ID del usuario
   * @param {string} action - Tipo de acción
   * @param {string} referenceId - ID de referencia (opcional)
   * @returns {Promise<boolean>} - true si puede recibir puntos
   */
  async canUserReceivePoints(userId, action, referenceId) {
    try {
      // Algunas acciones solo se pueden realizar una vez al día
      if (action === 'login_diario') {
        // Verificar si ya recibió puntos por login hoy
        const existingTransaction = await prisma.pointTransaction.findFirst({
          where: {
            userId,
            action,
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        });
        
        return !existingTransaction;
      } else if (action === 'contacto_perfil' && referenceId) {
        // Verificar si ya recibió puntos por contactar este perfil hoy
        const existingTransaction = await prisma.pointTransaction.findFirst({
          where: {
            userId,
            action,
            referenceId,
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        });
        
        return !existingTransaction;
      }
      
      // Por defecto, puede recibir puntos
      return true;
    } catch (error) {
      logger.error(`Error al verificar elegibilidad: ${error.message}`, { error });
      // Por seguridad, si hay error, no permite recibir puntos
      return false;
    }
  }
  
  /**
   * Obtiene el multiplicador de puntos según nivel VIP
   * @param {string} vipLevel - Nivel VIP
   * @param {Object} settings - Configuración del sistema
   * @returns {number} - Multiplicador de puntos
   */
  getVipMultiplier(vipLevel, settings) {
    if (!settings) {
      return 1.0; // Valor por defecto
    }
    
    const baseMultiplier = settings.vipPointsMultiplier || 1.0;
    
    // Ajustar según nivel
    switch (vipLevel) {
      case 'platinum':
        return baseMultiplier * 1.5;
      case 'gold':
        return baseMultiplier * 1.25;
      case 'silver':
        return baseMultiplier * 1.1;
      case 'basico':
      default:
        return baseMultiplier;
    }
  }
  
  /**
   * Obtiene el historial de transacciones de puntos de un usuario
   * @param {string} userId - ID del usuario
   * @param {Object} options - Opciones de paginación y filtrado
   * @returns {Promise<Object>} - Transacciones encontradas
   */
  async getPointTransactions(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        action,
        startDate,
        endDate,
        includeExpired = false
      } = options;
      
      const skip = (page - 1) * limit;
      
      // Construir condiciones de filtrado
      const where = { userId };
      
      if (action) {
        where.action = action;
      }
      
      if (startDate) {
        where.createdAt = {
          ...where.createdAt,
          gte: new Date(startDate)
        };
      }
      
      if (endDate) {
        where.createdAt = {
          ...where.createdAt,
          lte: new Date(endDate)
        };
      }
      
      if (!includeExpired) {
        where.OR = [
          { expirationDate: null },
          { expirationDate: { gt: new Date() } },
          { isExpired: false }
        ];
      }
      
      // Consultar transacciones
      const transactions = await prisma.pointTransaction.findMany({
        where,
        select: {
          id: true,
          action: true,
          points: true,
          referenceId: true,
          referenceType: true,
          description: true,
          createdAt: true,
          expirationDate: true,
          isExpired: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      });
      
      // Contar total
      const total = await prisma.pointTransaction.count({ where });
      
      // Obtener saldo actual
      const client = await prisma.client.findUnique({
        where: { id: userId },
        select: { totalPoints: true }
      });
      
      return {
        transactions,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        currentBalance: client?.totalPoints || 0
      };
    } catch (error) {
      logger.error(`Error al obtener transacciones: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Obtiene el historial de saldo de puntos de un usuario
   * @param {string} userId - ID del usuario
   * @param {Object} options - Opciones de paginación
   * @returns {Promise<Object>} - Historial de saldo
   */
  async getPointBalanceHistory(userId, options = {}) {
    try {
      const { page = 1, limit = 20 } = options;
      const skip = (page - 1) * limit;
      
      // Consultar historial
      const history = await prisma.pointBalanceHistory.findMany({
        where: { userId },
        select: {
          id: true,
          previousBalance: true,
          newBalance: true,
          createdAt: true,
          transaction: {
            select: {
              action: true,
              points: true,
              description: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      });
      
      // Contar total
      const total = await prisma.pointBalanceHistory.count({
        where: { userId }
      });
      
      return {
        history,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error(`Error al obtener historial: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Obtiene los cupones disponibles de un usuario
   * @param {string} userId - ID del usuario
   * @param {Object} options - Opciones de filtrado
   * @returns {Promise<Array>} - Cupones disponibles
   */
  async getUserCoupons(userId, options = {}) {
    try {
      const { active = true, expired = false } = options;
      
      // Construir condiciones
      const where = { userId };
      
      if (active) {
        where.isUsed = false;
        
        if (!expired) {
          where.expiresAt = {
            gt: new Date()
          };
        }
      } else {
        where.isUsed = true;
      }
      
      // Consultar cupones
      const coupons = await prisma.userCoupon.findMany({
        where,
        select: {
          id: true,
          code: true,
          discountPercentage: true,
          createdAt: true,
          expiresAt: true,
          isUsed: true,
          usedAt: true,
          usedFor: true,
          isTransferable: true,
          packageItem: {
            select: {
              id: true,
              discountPercentage: true,
              validDays: true,
              minPurchaseAmount: true,
              maxDiscountAmount: true,
              package: {
                select: {
                  name: true,
                  description: true
                }
              }
            }
          }
        },
        orderBy: [
          { isUsed: 'asc' },
          { expiresAt: 'asc' }
        ]
      });
      
      return coupons;
    } catch (error) {
      logger.error(`Error al obtener cupones: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Transfiere un cupón a otro usuario
   * @param {string} couponId - ID del cupón
   * @param {string} fromUserId - ID del usuario origen
   * @param {string} toUserId - ID del usuario destino
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async transferCoupon(couponId, fromUserId, toUserId) {
    try {
      // Verificar que el cupón exista y pertenezca al usuario
      const coupon = await prisma.userCoupon.findFirst({
        where: {
          id: couponId,
          userId: fromUserId,
          isUsed: false,
          expiresAt: { gt: new Date() }
        }
      });
      
      if (!coupon) {
        throw new Error('Cupón no encontrado o no disponible');
      }
      
      if (!coupon.isTransferable) {
        throw new Error('Este cupón no es transferible');
      }
      
      // Verificar que el destinatario exista y sea un cliente
      const toUser = await prisma.user.findFirst({
        where: {
          id: toUserId,
          role: 'cliente',
          isActive: true
        }
      });
      
      if (!toUser) {
        throw new Error('Usuario destinatario no encontrado o no válido');
      }
      
      // Transferir cupón
      const updatedCoupon = await prisma.userCoupon.update({
        where: { id: couponId },
        data: {
          userId: toUserId,
          originalOwner: fromUserId,
          transferredTo: toUserId,
          transferredAt: new Date()
        }
      });
      
      return {
        success: true,
        couponId: updatedCoupon.id,
        transferredTo: toUserId
      };
    } catch (error) {
      logger.error(`Error al transferir cupón: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Usa un cupón
   * @param {string} couponId - ID del cupón
   * @param {string} userId - ID del usuario
   * @param {string} usedFor - ID del servicio/referencia
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async useCoupon(couponId, userId, usedFor = null) {
    try {
      // Verificar que el cupón exista y pertenezca al usuario
      const coupon = await prisma.userCoupon.findFirst({
        where: {
          id: couponId,
          userId,
          isUsed: false,
          expiresAt: { gt: new Date() }
        }
      });
      
      if (!coupon) {
        throw new Error('Cupón no encontrado o no disponible');
      }
      
      // Marcar cupón como usado
      const updatedCoupon = await prisma.userCoupon.update({
        where: { id: couponId },
        data: {
          isUsed: true,
          usedAt: new Date(),
          usedFor
        }
      });
      
      return {
        success: true,
        couponId: updatedCoupon.id,
        discountPercentage: updatedCoupon.discountPercentage
      };
    } catch (error) {
      logger.error(`Error al usar cupón: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Verifica si un código de cupón es válido
   * @param {string} code - Código del cupón
   * @returns {Promise<Object>} - Información del cupón
   */
  async validateCouponCode(code) {
    try {
      // Buscar cupón por código
      const coupon = await prisma.userCoupon.findFirst({
        where: {
          code,
          isUsed: false,
          expiresAt: { gt: new Date() }
        },
        select: {
          id: true,
          userId: true,
          code: true,
          discountPercentage: true,
          expiresAt: true,
          packageItem: {
            select: {
              minPurchaseAmount: true,
              maxDiscountAmount: true,
              applicableServices: true
            }
          }
        }
      });
      
      if (!coupon) {
        throw new Error('Cupón no encontrado o expirado');
      }
      
      return {
        valid: true,
        coupon
      };
    } catch (error) {
      logger.error(`Error al validar cupón: ${error.message}`, { error });
      return {
        valid: false,
        error: error.message
      };
    }
  }
  
  /**
   * Obtiene los paquetes de cupones disponibles
   * @returns {Promise<Array>} - Paquetes disponibles
   */
  async getCouponPackages() {
    try {
      const packages = await prisma.couponPackage.findMany({
        where: {
          isActive: true,
          OR: [
            { endDate: null },
            { endDate: { gt: new Date() } }
          ],
          AND: [
            { startDate: null },
            { startDate: { lte: new Date() } }
          ]
        },
        select: {
          id: true,
          name: true,
          description: true,
          shortDescription: true,
          price: true,
          discountPrice: true,
          currency: true,
          pointsGranted: true,
          sorteoEntries: true,
          isFeatured: true,
          minPurchaseLevel: true,
          maxPurchasesPerUser: true,
          totalAvailable: true,
          imageUrl: true,
          items: {
            select: {
              discountPercentage: true,
              quantity: true,
              validDays: true,
              minPurchaseAmount: true,
              maxDiscountAmount: true
            }
          }
        },
        orderBy: [
          { isFeatured: 'desc' },
          { price: 'asc' }
        ]
      });
      
      return packages;
    } catch (error) {
      logger.error(`Error al obtener paquetes: ${error.message}`, { error });
      throw error;
    }
  }
}

module.exports = new PointService();