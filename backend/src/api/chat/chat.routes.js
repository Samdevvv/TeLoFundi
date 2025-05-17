// src/api/chat/chat.routes.js (corregido)
const express = require('express');
const chatController = require('./chat.controller');
const { authMiddleware } = require('../../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: API para sistema de chat
 */

/**
 * @swagger
 * /api/chat/start:
 *   post:
 *     summary: Inicia o recupera una conversación entre cliente y perfil
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - profileId
 *             properties:
 *               profileId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Conversación iniciada o recuperada con éxito
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 *       404:
 *         description: Perfil no encontrado
 *       500:
 *         description: Error del servidor
 */
router.post('/start', authMiddleware, chatController.startConversation);

/**
 * @swagger
 * /api/chat/{id}:
 *   get:
 *     summary: Obtiene una conversación por su ID
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la conversación
 *     responses:
 *       200:
 *         description: Conversación obtenida con éxito
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 *       404:
 *         description: Conversación no encontrada
 *       500:
 *         description: Error del servidor
 */
router.get('/:id', authMiddleware, chatController.getConversation);

/**
 * @swagger
 * /api/chat:
 *   get:
 *     summary: Obtiene todas las conversaciones del usuario
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conversaciones obtenidas con éxito
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.get('/', authMiddleware, chatController.getConversations); // CORREGIDO: getUserConversations -> getConversations

/**
 * @swagger
 * /api/chat/message:
 *   post:
 *     summary: Envía un mensaje en una conversación
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - conversationId
 *               - content
 *             properties:
 *               conversationId:
 *                 type: string
 *               content:
 *                 type: string
 *               contentType:
 *                 type: string
 *                 default: text
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Mensaje enviado con éxito
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 *       404:
 *         description: Conversación no encontrada
 *       500:
 *         description: Error del servidor
 */
router.post('/message', authMiddleware, chatController.sendMessage);

/**
 * @swagger
 * /api/chat/{conversationId}/read:
 *   post:
 *     summary: Marca los mensajes de una conversación como leídos
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la conversación
 *     responses:
 *       200:
 *         description: Mensajes marcados como leídos con éxito
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 *       404:
 *         description: Conversación no encontrada
 *       500:
 *         description: Error del servidor
 */
router.post('/:conversationId/read', authMiddleware, chatController.markConversationAsRead); // CORREGIDO: markAsRead -> markConversationAsRead

/**
 * @swagger
 * /api/chat/{conversationId}/block:
 *   post:
 *     summary: Bloquea o desbloquea una conversación
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la conversación
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - block
 *             properties:
 *               block:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Conversación bloqueada/desbloqueada con éxito
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 *       404:
 *         description: Conversación no encontrada
 *       500:
 *         description: Error del servidor
 */
// NOTA: Esta función parece no estar en el controlador. Comentamos temporalmente
// router.post('/:conversationId/block', authMiddleware, chatController.toggleBlockConversation);

// Usamos la función que está disponible en el controlador
router.post('/:conversationId/block', authMiddleware, chatController.blockConversation);

/**
 * @swagger
 * /api/chat/{conversationId}/archive:
 *   post:
 *     summary: Archiva o desarchiva una conversación
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la conversación
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - archive
 *             properties:
 *               archive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Conversación archivada/desarchivada con éxito
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 *       404:
 *         description: Conversación no encontrada
 *       500:
 *         description: Error del servidor
 */
// NOTA: Esta función parece no estar en el controlador. Comentamos temporalmente
// router.post('/:conversationId/archive', authMiddleware, chatController.toggleArchiveConversation);

// Usamos la función que está disponible en el controlador
router.post('/:conversationId/archive', authMiddleware, chatController.archiveConversation);

/**
 * @swagger
 * /api/chat/unread:
 *   get:
 *     summary: Obtiene el contador de mensajes no leídos
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contador obtenido con éxito
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
// NOTA: Esta función parece no estar en el controlador. Comentamos temporalmente
// router.get('/unread', authMiddleware, chatController.getUnreadCount);

// Para no perder esta funcionalidad, agregar un controlador temporal
router.get('/unread', authMiddleware, (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      count: 0
    },
    message: 'Función en desarrollo'
  });
});

/**
 * @swagger
 * /api/chat/message/{messageId}:
 *   delete:
 *     summary: Elimina un mensaje para el usuario
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del mensaje
 *     responses:
 *       200:
 *         description: Mensaje eliminado con éxito
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido
 *       404:
 *         description: Mensaje no encontrado
 *       500:
 *         description: Error del servidor
 */
// NOTA: Esta función parece no estar en el controlador. Comentamos temporalmente
// router.delete('/message/:messageId', authMiddleware, chatController.deleteMessage);

// Para no perder esta funcionalidad, agregar un controlador temporal
router.delete('/message/:messageId', authMiddleware, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Función en desarrollo para eliminar mensajes'
  });
});

module.exports = router;