// src/api/uploads/upload.routes.js
const express = require('express');
const uploadController = require('./upload.controller');
const { upload } = require('../../services/uploadService');
const { authMiddleware } = require('../../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Uploads
 *   description: API para gestión de archivos subidos
 */

/**
 * @swagger
 * /api/uploads/image:
 *   post:
 *     summary: Sube una imagen
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: image
 *         type: file
 *         required: true
 *         description: Imagen a subir
 *       - in: formData
 *         name: quality
 *         type: integer
 *         description: Calidad de la imagen (1-100)
 *       - in: formData
 *         name: width
 *         type: integer
 *         description: Ancho máximo de la imagen
 *       - in: formData
 *         name: height
 *         type: integer
 *         description: Alto máximo de la imagen
 *     responses:
 *       200:
 *         description: Imagen subida correctamente
 *       400:
 *         description: Error en la solicitud
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.post('/image', authMiddleware, upload.single('image'), uploadController.uploadImage);

/**
 * @swagger
 * /api/uploads/data-image:
 *   post:
 *     summary: Sube una imagen en formato data URL
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dataUrl
 *             properties:
 *               dataUrl:
 *                 type: string
 *                 description: URL de datos de la imagen (data:image/...)
 *     responses:
 *       200:
 *         description: Imagen subida correctamente
 *       400:
 *         description: Error en la solicitud
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.post('/data-image', authMiddleware, uploadController.uploadImageDataUrl);

/**
 * @swagger
 * /api/uploads/delete:
 *   post:
 *     summary: Elimina una imagen
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - path
 *             properties:
 *               path:
 *                 type: string
 *                 description: Ruta relativa del archivo a eliminar
 *     responses:
 *       200:
 *         description: Archivo eliminado correctamente
 *       400:
 *         description: Error en la solicitud
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.post('/delete', authMiddleware, uploadController.deleteImage);

module.exports = router;