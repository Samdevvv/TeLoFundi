// src/api/uploads/upload.controller.js
const { uploadService } = require('../../services/uploadService');
const logger = require('../../utils/logger');

class UploadController {
  /**
   * Maneja la subida de una imagen
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async uploadImage(req, res) {
    try {
      // El archivo ya está subido por multer middleware
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'No se ha subido ningún archivo'
        });
      }
      
      // Procesar imagen para crear versiones
      const options = {
        quality: parseInt(req.body.quality) || 80,
        width: parseInt(req.body.width) || null,
        height: parseInt(req.body.height) || null
      };
      
      const result = await uploadService.processImage(file, options);
      
      // Obtener URL completa
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      res.status(200).json({
        success: true,
        message: 'Imagen subida correctamente',
        data: {
          imageUrl: result.imageUrl,
          thumbnailUrl: result.thumbnailUrl,
          mediumUrl: result.mediumUrl,
          originalName: result.originalName,
          size: result.size,
          mimetype: result.mimetype,
          fullUrls: {
            imageUrl: `${baseUrl}${result.imageUrl}`,
            thumbnailUrl: `${baseUrl}${result.thumbnailUrl}`,
            mediumUrl: `${baseUrl}${result.mediumUrl}`
          }
        }
      });
    } catch (error) {
      logger.error(`Error al subir imagen: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al subir imagen',
        error: error.message
      });
    }
  }
  
  /**
   * Maneja la subida de una imagen en formato data URL
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async uploadImageDataUrl(req, res) {
    try {
      const { dataUrl } = req.body;
      
      if (!dataUrl) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere una URL de datos de imagen'
        });
      }
      
      const result = await uploadService.saveDataUrlAsImage(dataUrl);
      
      // Obtener URL completa
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      res.status(200).json({
        success: true,
        message: 'Imagen subida correctamente',
        data: {
          imageUrl: result.imageUrl,
          thumbnailUrl: result.thumbnailUrl,
          mediumUrl: result.mediumUrl,
          originalName: result.originalName,
          size: result.size,
          mimetype: result.mimetype,
          fullUrls: {
            imageUrl: `${baseUrl}${result.imageUrl}`,
            thumbnailUrl: `${baseUrl}${result.thumbnailUrl}`,
            mediumUrl: `${baseUrl}${result.mediumUrl}`
          }
        }
      });
    } catch (error) {
      logger.error(`Error al subir imagen: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al subir imagen',
        error: error.message
      });
    }
  }
  
  /**
   * Elimina una imagen subida
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async deleteImage(req, res) {
    try {
      const { path } = req.body;
      
      if (!path) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere la ruta del archivo a eliminar'
        });
      }
      
      const result = await uploadService.deleteFile(path);
      
      if (result) {
        res.status(200).json({
          success: true,
          message: 'Archivo eliminado correctamente'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'No se pudo eliminar el archivo'
        });
      }
    } catch (error) {
      logger.error(`Error al eliminar imagen: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Error al eliminar imagen',
        error: error.message
      });
    }
  }
}

module.exports = new UploadController();