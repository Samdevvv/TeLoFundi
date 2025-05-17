// src/services/uploadService.js - Versión completa con mejoras
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const logger = require('../utils/logger');

// Importar sharp para procesamiento de imágenes si está disponible
let sharp;
try {
  sharp = require('sharp');
} catch (err) {
  logger.warn('Sharp no está disponible. Se usará fallback para imágenes.');
}

// Crear directorios si no existen
const ensureDirectoriesExist = () => {
  const dirs = [
    path.join(__dirname, '../../uploads'),
    path.join(__dirname, '../../uploads/thumbnails'),
    path.join(__dirname, '../../uploads/medium'),
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Configurar almacenamiento de multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    ensureDirectoriesExist();
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uniqueSuffix}${ext}`);
  }
});

// Filtro de archivos para solo permitir imágenes
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen'), false);
  }
};

// Configurar multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  },
  fileFilter: fileFilter
});

class UploadService {
  /**
   * Procesa una imagen subida para crear versiones en diferentes tamaños
   * @param {Object} file - Archivo subido
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object>} - URLs de las imágenes procesadas
   */
  async processImage(file, options = {}) {
    try {
      ensureDirectoriesExist();
      
      const { quality = 80, width, height } = options;
      
      // Obtener información de la imagen original
      const originalPath = file.path;
      const filename = path.basename(file.path);
      const thumbnailFilename = `thumbnail-${filename}`;
      const mediumFilename = `medium-${filename}`;
      
      const thumbnailPath = path.join(__dirname, '../../uploads/thumbnails', thumbnailFilename);
      const mediumPath = path.join(__dirname, '../../uploads/medium', mediumFilename);
      
      // Usar sharp para redimensionar si está disponible
      if (sharp) {
        try {
          // Crear miniatura (thumbnail)
          await sharp(originalPath)
            .resize(150, 200, { fit: 'cover' })
            .jpeg({ quality: Math.min(quality, 80) })
            .toFile(thumbnailPath);
          
          // Crear imagen mediana
          await sharp(originalPath)
            .resize(400, 600, { fit: 'cover' })
            .jpeg({ quality })
            .toFile(mediumPath);
          
          logger.info('Imágenes procesadas con éxito usando sharp');
        } catch (sharpError) {
          logger.error(`Error al procesar imágenes con sharp: ${sharpError.message}`, { error: sharpError });
          
          // Fallback: simplemente copiar el archivo para las versiones
          try {
            fs.copyFileSync(originalPath, thumbnailPath);
            fs.copyFileSync(originalPath, mediumPath);
            
            logger.info('Imágenes copiadas como fallback');
          } catch (copyError) {
            logger.error(`Error al copiar archivos: ${copyError.message}`, { error: copyError });
            // Si falla la copia, usamos la misma URL para todas las versiones
          }
        }
      } else {
        // Fallback si sharp no está disponible
        try {
          fs.copyFileSync(originalPath, thumbnailPath);
          fs.copyFileSync(originalPath, mediumPath);
          
          logger.info('Imágenes copiadas (sharp no disponible)');
        } catch (copyError) {
          logger.error(`Error al copiar archivos: ${copyError.message}`, { error: copyError });
          // Si falla la copia, usamos la misma URL para todas las versiones
        }
      }
      
      // URLs relativas para usar en la API
      const imageUrl = `/uploads/${filename}`;
      const thumbnailUrl = fs.existsSync(thumbnailPath) ? `/uploads/thumbnails/${thumbnailFilename}` : imageUrl;
      const mediumUrl = fs.existsSync(mediumPath) ? `/uploads/medium/${mediumFilename}` : imageUrl;
      
      return {
        imageUrl,
        thumbnailUrl,
        mediumUrl,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      };
    } catch (error) {
      logger.error(`Error al procesar imagen: ${error.message}`, { error });
      
      // En caso de error, al menos devolver la URL original
      return {
        imageUrl: `/uploads/${path.basename(file.path)}`,
        thumbnailUrl: `/uploads/${path.basename(file.path)}`,
        mediumUrl: `/uploads/${path.basename(file.path)}`,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      };
    }
  }
  
  /**
   * Guarda una imagen de datos (data URL) como archivo
   * @param {string} dataUrl - URL de datos de la imagen
   * @returns {Promise<Object>} - URLs de las imágenes guardadas
   */
  async saveDataUrlAsImage(dataUrl) {
    try {
      ensureDirectoriesExist();
      
      // Verificar que es una URL de datos válida
      if (!dataUrl.startsWith('data:image/')) {
        throw new Error('URL de datos no válida');
      }
      
      // Extraer el tipo de imagen y los datos
      const matches = dataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      
      if (!matches || matches.length !== 3) {
        throw new Error('Formato de URL de datos inválido');
      }
      
      const imageType = matches[1];
      const imageData = matches[2];
      const buffer = Buffer.from(imageData, 'base64');
      
      // Generar nombre de archivo único
      const extension = imageType.split('/')[1] || 'jpg';
      const filename = `${Date.now()}-${uuidv4()}.${extension}`;
      const thumbnailFilename = `thumbnail-${filename}`;
      const mediumFilename = `medium-${filename}`;
      
      // Rutas donde se guardarán las imágenes
      const uploadDir = path.join(__dirname, '../../uploads');
      const thumbnailDir = path.join(__dirname, '../../uploads/thumbnails');
      const mediumDir = path.join(__dirname, '../../uploads/medium');
      
      const filePath = path.join(uploadDir, filename);
      const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
      const mediumPath = path.join(mediumDir, mediumFilename);
      
      // Guardar la imagen original
      fs.writeFileSync(filePath, buffer);
      
      // Usar sharp para crear versiones redimensionadas
      if (sharp) {
        try {
          // Crear miniatura (thumbnail)
          await sharp(buffer)
            .resize(150, 200, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toFile(thumbnailPath);
          
          // Crear imagen mediana
          await sharp(buffer)
            .resize(400, 600, { fit: 'cover' })
            .jpeg({ quality: 90 })
            .toFile(mediumPath);
          
          logger.info('Imágenes procesadas con éxito usando sharp (desde dataURL)');
        } catch (sharpError) {
          logger.error(`Error al procesar imágenes con sharp (desde dataURL): ${sharpError.message}`, { error: sharpError });
          
          // Fallback: simplemente guardar el buffer para las versiones
          try {
            fs.writeFileSync(thumbnailPath, buffer);
            fs.writeFileSync(mediumPath, buffer);
            
            logger.info('Imágenes guardadas como fallback (desde dataURL)');
          } catch (saveError) {
            logger.error(`Error al guardar archivos: ${saveError.message}`, { error: saveError });
            // Si falla el guardado, usamos la misma URL para todas las versiones
          }
        }
      } else {
        // Fallback si sharp no está disponible
        try {
          fs.writeFileSync(thumbnailPath, buffer);
          fs.writeFileSync(mediumPath, buffer);
          
          logger.info('Imágenes guardadas (sharp no disponible, desde dataURL)');
        } catch (saveError) {
          logger.error(`Error al guardar archivos: ${saveError.message}`, { error: saveError });
          // Si falla el guardado, usamos la misma URL para todas las versiones
        }
      }
      
      // URLs relativas para usar en la API
      const imageUrl = `/uploads/${filename}`;
      const thumbnailUrl = fs.existsSync(thumbnailPath) ? `/uploads/thumbnails/${thumbnailFilename}` : imageUrl;
      const mediumUrl = fs.existsSync(mediumPath) ? `/uploads/medium/${mediumFilename}` : imageUrl;
      
      return {
        imageUrl,
        thumbnailUrl,
        mediumUrl,
        originalName: filename,
        size: buffer.length,
        mimetype: imageType
      };
    } catch (error) {
      logger.error(`Error al guardar imagen desde dataURL: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Elimina un archivo y sus versiones asociadas
   * @param {string} filePath - Ruta relativa del archivo
   * @returns {Promise<boolean>} - Resultado de la operación
   */
  async deleteFile(filePath) {
    try {
      const baseDir = path.join(__dirname, '../../');
      const absolutePath = path.join(baseDir, filePath.replace(/^\//, ''));
      
      // Extraer nombre del archivo
      const filename = path.basename(absolutePath);
      
      // Construir rutas para las versiones del archivo
      const thumbnailPath = path.join(baseDir, 'uploads/thumbnails', `thumbnail-${filename}`);
      const mediumPath = path.join(baseDir, 'uploads/medium', `medium-${filename}`);
      
      // Verificar si el archivo original existe y eliminarlo
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        logger.info(`Archivo original eliminado: ${absolutePath}`);
      }
      
      // Eliminar versiones si existen
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
        logger.info(`Versión thumbnail eliminada: ${thumbnailPath}`);
      }
      
      if (fs.existsSync(mediumPath)) {
        fs.unlinkSync(mediumPath);
        logger.info(`Versión medium eliminada: ${mediumPath}`);
      }
      
      return true;
    } catch (error) {
      logger.error(`Error al eliminar archivo: ${error.message}`, { error });
      // No lanzar error, simplemente devolver false
      return false;
    }
  }
}

module.exports = {
  uploadService: new UploadService(),
  upload: upload
};