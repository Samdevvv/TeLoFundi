// src/api/client/client.routes.js
const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');
const authController = require('../auth/auth.controller');

/**
 * @swagger
 * tags:
 *   name: Clientes
 *   description: API para gestión de clientes
 */

/**
 * @swagger
 * /api/clientes/registro:
 *   post:
 *     summary: Registra un nuevo cliente (alias para Auth)
 *     tags: [Clientes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - username
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               username:
 *                 type: string
 *     responses:
 *       201:
 *         description: Cliente registrado con éxito
 *       400:
 *         description: Datos de entrada inválidos
 *       409:
 *         description: El correo ya está registrado
 *       500:
 *         description: Error del servidor
 */
router.post('/registro', authController.register);

/**
 * @swagger
 * /api/clientes/login:
 *   post:
 *     summary: Inicia sesión de un cliente (alias para Auth)
 *     tags: [Clientes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               rememberMe:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Inicio de sesión exitoso
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: Credenciales incorrectas
 *       500:
 *         description: Error del servidor
 */
router.post('/login', (req, res) => {
  // Redireccionar a la ruta de auth/login
  req.url = '/auth/login';
  req.app.handle(req, res);
});

/**
 * @swagger
 * /api/clientes/perfil:
 *   get:
 *     summary: Obtiene el perfil del cliente autenticado
 *     tags: [Clientes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil obtenido con éxito
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
router.get('/perfil', authMiddleware, roleMiddleware(['cliente']), async (req, res) => {
  try {
    const { id } = req.user;
    
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Obtener datos completos del cliente
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            email: true,
            isVip: true,
            lastLogin: true,
            profileImageUrl: true,
            createdAt: true,
          }
        }
      }
    });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }
    
    res.status(200).json({
      success: true,
      data: client
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener el perfil',
      error: error.message
    });
  }
});

module.exports = router;