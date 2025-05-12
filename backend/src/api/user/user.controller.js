// src/api/user/user.controller.js
const userService = require('../../services/userService');
const logger = require('../../utils/logger');

class UserController {
  /**
   * Obtiene el perfil del usuario autenticado
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async getMyProfile(req, res) {
    try {
      const userId = req.user.id;
      const user = await userService.getUserById(userId);
      
      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error(`Error al obtener perfil: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al obtener perfil de usuario',
        error: error.message
      });
    }
  }
  
  /**
   * Actualiza el perfil del usuario autenticado
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async updateMyProfile(req, res) {
    try {
      const userId = req.user.id;
      const userData = req.body;
      
      const updatedUser = await userService.updateUser(userId, userData);
      
      res.status(200).json({
        success: true,
        message: 'Perfil actualizado con éxito',
        data: updatedUser
      });
    } catch (error) {
      logger.error(`Error al actualizar perfil: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al actualizar perfil de usuario',
        error: error.message
      });
    }
  }
  
  /**
   * Cambia la contraseña del usuario autenticado
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async changePassword(req, res) {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Se requieren contraseña actual y nueva'
        });
      }
      
      await userService.changePassword(userId, currentPassword, newPassword);
      
      res.status(200).json({
        success: true,
        message: 'Contraseña actualizada con éxito'
      });
    } catch (error) {
      logger.error(`Error al cambiar contraseña: ${error.message}`, { error });
      
      if (error.message.includes('incorrecta')) {
        return res.status(400).json({
          success: false,
          message: 'Contraseña actual incorrecta'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error al cambiar contraseña',
        error: error.message
      });
    }
  }
  
  /**
   * Actualiza la imagen de perfil
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async updateProfileImage(req, res) {
    try {
      const userId = req.user.id;
      const { imageUrl } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({
          success: false,
          message: 'URL de imagen requerida'
        });
      }
      
      const result = await userService.updateProfileImage(userId, imageUrl);
      
      res.status(200).json({
        success: true,
        message: 'Imagen de perfil actualizada',
        data: result
      });
    } catch (error) {
      logger.error(`Error al actualizar imagen: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al actualizar imagen de perfil',
        error: error.message
      });
    }
  }
  
  /**
   * Actualiza las preferencias del usuario
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async updatePreferences(req, res) {
    try {
      const userId = req.user.id;
      const preferences = req.body;
      
      await userService.updatePreferences(userId, preferences);
      
      res.status(200).json({
        success: true,
        message: 'Preferencias actualizadas con éxito'
      });
    } catch (error) {
      logger.error(`Error al actualizar preferencias: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al actualizar preferencias',
        error: error.message
      });
    }
  }
  
  /**
   * Desactiva la cuenta del usuario autenticado
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async deactivateAccount(req, res) {
    try {
      const userId = req.user.id;
      
      await userService.deactivateUser(userId);
      
      res.status(200).json({
        success: true,
        message: 'Cuenta desactivada con éxito'
      });
    } catch (error) {
      logger.error(`Error al desactivar cuenta: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al desactivar cuenta',
        error: error.message
      });
    }
  }
}

module.exports = new UserController();