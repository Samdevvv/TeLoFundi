// src/services/userService.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class UserService {
  /**
   * Obtiene un usuario por su ID
   * @param {string} userId - ID del usuario
   * @returns {Promise<Object>} - Usuario encontrado
   */
  async getUserById(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          isVip: true,
          vipLevel: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          profileImageUrl: true,
          preferredLanguage: true,
          // Excluimos datos sensibles como contraseña, tokens, etc.
        }
      });
      
      if (!user) {
        throw new Error('Usuario no encontrado');
      }
      
      return user;
    } catch (error) {
      logger.error(`Error al obtener usuario: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Actualiza un usuario
   * @param {string} userId - ID del usuario
   * @param {Object} userData - Datos a actualizar
   * @returns {Promise<Object>} - Usuario actualizado
   */
  async updateUser(userId, userData) {
    try {
      // Eliminamos campos que no queremos permitir actualizar directamente
      const { 
        passwordHash, email, role, isActive, emailVerified, 
        emailVerificationToken, failedLoginAttempts, ...updateData 
      } = userData;
      
      // Si hay una nueva contraseña, la hasheamos
      if (userData.newPassword) {
        updateData.passwordHash = await bcrypt.hash(userData.newPassword, 10);
      }
      
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          isVip: true,
          vipLevel: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          profileImageUrl: true,
          preferredLanguage: true,
        }
      });
      
      return updatedUser;
    } catch (error) {
      logger.error(`Error al actualizar usuario: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Cambia la contraseña de un usuario
   * @param {string} userId - ID del usuario
   * @param {string} currentPassword - Contraseña actual
   * @param {string} newPassword - Nueva contraseña
   * @returns {Promise<boolean>} - Resultado de la operación
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      // Obtener usuario con contraseña
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, passwordHash: true }
      });
      
      if (!user) {
        throw new Error('Usuario no encontrado');
      }
      
      // Verificar contraseña actual
      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        throw new Error('Contraseña actual incorrecta');
      }
      
      // Actualizar contraseña
      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash }
      });
      
      return true;
    } catch (error) {
      logger.error(`Error al cambiar contraseña: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Desactiva un usuario (no lo elimina)
   * @param {string} userId - ID del usuario
   * @returns {Promise<boolean>} - Resultado de la operación
   */
  async deactivateUser(userId) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          isActive: false,
          deletedAt: new Date()
        }
      });
      
      return true;
    } catch (error) {
      logger.error(`Error al desactivar usuario: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Actualiza preferencias del usuario
   * @param {string} userId - ID del usuario
   * @param {Object} preferences - Preferencias a actualizar
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async updatePreferences(userId, preferences) {
    try {
      // Dependiendo del rol, actualizamos la tabla correspondiente
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });
      
      if (!user) {
        throw new Error('Usuario no encontrado');
      }
      
      if (user.role === 'cliente') {
        await prisma.client.update({
          where: { id: userId },
          data: { preferences }
        });
      } else if (user.role === 'perfil') {
        // Para perfiles, manejamos ciertas preferencias específicas
        const { 
          availability_status, 
          availability_schedule,
          contact_methods,
          preferred_contact_hours,
          hidden,
          ...otherPrefs
        } = preferences;
        
        await prisma.profile.update({
          where: { id: userId },
          data: {
            availabilityStatus: availability_status,
            availabilitySchedule: availability_schedule,
            contactMethods: contact_methods,
            preferredContactHours: preferred_contact_hours,
            hidden: hidden,
            // Otros campos específicos
          }
        });
      }
      
      return { success: true };
    } catch (error) {
      logger.error(`Error al actualizar preferencias: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Actualiza la imagen de perfil
   * @param {string} userId - ID del usuario
   * @param {string} imageUrl - URL de la imagen
   * @returns {Promise<Object>} - Usuario actualizado
   */
  async updateProfileImage(userId, imageUrl) {
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { profileImageUrl: imageUrl },
        select: { 
          id: true, 
          profileImageUrl: true 
        }
      });
      
      return updatedUser;
    } catch (error) {
      logger.error(`Error al actualizar imagen: ${error.message}`, { error });
      throw error;
    }
  }
}

module.exports = new UserService();