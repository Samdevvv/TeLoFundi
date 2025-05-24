// src/services/emailService.js
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

/**
 * Servicio para el envío de correos electrónicos
 */
class EmailService {
  constructor() {
    // Configurar el transporte de correo
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_SECURE === 'true', // true para 465, false para otros puertos
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production', // Permitir certificados autofirmados en desarrollo
      },
    });

    // Verificar la configuración al iniciar
    this.verifyConfiguration();
  }

  /**
   * Verifica la configuración de correo al iniciar el servicio
   */
  async verifyConfiguration() {
    try {
      if (process.env.NODE_ENV === 'development' && process.env.EMAIL_VERIFICATION === 'true') {
        await this.transporter.verify();
        logger.info('Servicio de email configurado correctamente');
      }
    } catch (error) {
      logger.error(`Error en configuración de email: ${error.message}`, { error });
    }
  }

  /**
   * Envía un correo electrónico
   * @param {Object} options - Opciones del correo
   * @returns {Promise<Object>} - Información del envío
   */
  async sendEmail(options) {
    try {
      const { to, cc, subject, text, html } = options;

      if (!to) {
        throw new Error('El destinatario (to) es requerido para enviar el correo');
      }

      if (!subject) {
        throw new Error('El asunto (subject) es requerido para enviar el correo');
      }

      if (!html && !text) {
        throw new Error('El contenido (html o text) es requerido para enviar el correo');
      }

      // Configurar datos del mensaje
      const mailOptions = {
        from: process.env.EMAIL_FROM || '"TeLoFundi" <notificaciones@telofundi.com>',
        to,
        cc,
        subject,
        text,
        html,
      };

      // Si estamos en modo de prueba, solo logueamos el mensaje
      if (process.env.EMAIL_TEST_MODE === 'true' || process.env.NODE_ENV === 'test') {
        logger.info('Correo en modo prueba (no enviado):', {
          to,
          subject,
          preview: html ? 'HTML content...' : text,
        });
        return { messageId: 'test-mode', success: true };
      }

      // Enviar el correo
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Correo enviado: ${info.messageId}`);
      
      return {
        messageId: info.messageId,
        success: true,
      };
    } catch (error) {
      logger.error(`Error al enviar correo: ${error.message}`, { error });
      throw error;
    }
  }
}

module.exports = new EmailService();