// src/services/emailService.js
const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * Servicio para gestionar el envío de correos electrónicos
 */
class EmailService {
  constructor() {
    // Configurar transporte de nodemailer
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.example.com',
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER || 'user@example.com',
        pass: process.env.EMAIL_PASSWORD || 'password'
      }
    });

    // Verificar conexión
    this.verifyConnection();
  }

  /**
   * Verifica la conexión con el servidor SMTP
   */
  async verifyConnection() {
    try {
      if (process.env.NODE_ENV !== 'production') {
        logger.info('Modo de desarrollo: verificación de conexión SMTP omitida');
        return;
      }

      await this.transporter.verify();
      logger.info('Conexión SMTP establecida correctamente');
    } catch (error) {
      logger.error(`Error al verificar conexión SMTP: ${error.message}`, { error });
    }
  }

  /**
   * Envía un correo electrónico
   * @param {Object} mailOptions - Opciones de correo
   * @returns {Promise<Object>} - Resultado del envío
   */
  async sendEmail(mailOptions) {
    try {
      const {
        to,
        subject,
        html,
        text,
        from = process.env.EMAIL_FROM || 'no-reply@telofundi.com',
        cc,
        bcc,
        attachments,
        templateId
      } = mailOptions;

      // Verificar datos requeridos
      if (!to || (!html && !text)) {
        throw new Error('Destinatario y contenido (html o texto) son requeridos');
      }

      // Opciones completas del correo
      const options = {
        from,
        to,
        subject,
        html,
        text,
        ...(cc && { cc }),
        ...(bcc && { bcc }),
        ...(attachments && { attachments })
      };

      // Si estamos en desarrollo, simular el envío
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`[SIMULADO] Correo enviado a: ${to}`, { subject, html });
        return { messageId: `dev-${Date.now()}` };
      }

      // Enviar correo
      const result = await this.transporter.sendMail(options);

      // Registrar el envío
      await this._logEmailSent({
        to,
        subject,
        templateId,
        status: 'enviado',
        providerMessageId: result.messageId
      });

      return result;
    } catch (error) {
      logger.error(`Error al enviar correo: ${error.message}`, { error });
      
      // Registrar el error
      await this._logEmailSent({
        to: mailOptions.to,
        subject: mailOptions.subject,
        templateId: mailOptions.templateId,
        status: 'fallido',
        errorMessage: error.message
      });
      
      throw new Error(`Error al enviar correo: ${error.message}`);
    }
  }

  /**
   * Registra el envío de un correo
   * @param {Object} logData - Datos del registro
   * @returns {Promise<void>}
   * @private
   */
  async _logEmailSent(logData) {
    try {
      const {
        to,
        subject,
        templateId,
        status,
        providerMessageId,
        errorMessage
      } = logData;

      // Buscar usuario por correo
      const user = await prisma.user.findFirst({
        where: { email: to }
      });

      // Crear registro
      await prisma.emailLog.create({
        data: {
          userId: user?.id,
          emailAddress: to,
          subject,
          templateId,
          status,
          providerMessageId,
          errorMessage,
          emailProvider: 'nodemailer'
        }
      });
    } catch (logError) {
      logger.error(`Error al registrar envío de correo: ${logError.message}`, { logError });
      // No propagamos este error para no interrumpir el flujo principal
    }
  }

  /**
   * Envía un correo de verificación de cuenta
   * @param {Object} user - Usuario destinatario
   * @param {string} token - Token de verificación
   * @returns {Promise<void>}
   */
  async sendVerificationEmail(user, token) {
    try {
      // Buscar plantilla
      const template = await prisma.notificationTemplate.findFirst({
        where: {
          type: 'email',
          name: 'verificacion_email',
          isActive: true
        }
      });

      // URL de verificación
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email/${token}`;

      // Usar plantilla o contenido predeterminado
      let emailContent;
      let emailSubject;

      if (template) {
        // Reemplazar variables en la plantilla
        emailContent = template.content
          .replace(/{{name}}/g, user.username || 'Usuario')
          .replace(/{{verification_url}}/g, verificationUrl);
        
        emailSubject = template.subject;
      } else {
        // Contenido predeterminado
        emailContent = `
          <h1>Bienvenido a TeLoFundi</h1>
          <p>Hola ${user.username || 'Usuario'},</p>
          <p>Gracias por registrarte. Por favor verifica tu correo electrónico haciendo clic en el siguiente enlace:</p>
          <p><a href="${verificationUrl}">Verificar mi correo electrónico</a></p>
          <p>Si no solicitaste esta verificación, puedes ignorar este correo.</p>
          <p>Saludos,<br>El equipo de TeLoFundi</p>
        `;
        
        emailSubject = 'Verifica tu correo electrónico - TeLoFundi';
      }

      // Enviar correo
      await this.sendEmail({
        to: user.email,
        subject: emailSubject,
        html: emailContent,
        templateId: template?.id
      });
    } catch (error) {
      logger.error(`Error al enviar correo de verificación: ${error.message}`, { error });
      throw new Error(`Error al enviar correo de verificación: ${error.message}`);
    }
  }

  /**
   * Envía un correo de restablecimiento de contraseña
   * @param {Object} user - Usuario destinatario
   * @param {string} token - Token de restablecimiento
   * @returns {Promise<void>}
   */
  async sendPasswordResetEmail(user, token) {
    try {
      // Buscar plantilla
      const template = await prisma.notificationTemplate.findFirst({
        where: {
          type: 'email',
          name: 'restablecer_password',
          isActive: true
        }
      });

      // URL de restablecimiento
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${token}`;

      // Usar plantilla o contenido predeterminado
      let emailContent;
      let emailSubject;

      if (template) {
        // Reemplazar variables en la plantilla
        emailContent = template.content
          .replace(/{{name}}/g, user.username || 'Usuario')
          .replace(/{{reset_url}}/g, resetUrl);
        
        emailSubject = template.subject;
      } else {
        // Contenido predeterminado
        emailContent = `
          <h1>Restablecimiento de Contraseña</h1>
          <p>Hola ${user.username || 'Usuario'},</p>
          <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
          <p><a href="${resetUrl}">Restablecer mi contraseña</a></p>
          <p>Este enlace expirará en 1 hora.</p>
          <p>Si no solicitaste este restablecimiento, puedes ignorar este correo.</p>
          <p>Saludos,<br>El equipo de TeLoFundi</p>
        `;
        
        emailSubject = 'Restablecimiento de Contraseña - TeLoFundi';
      }

      // Enviar correo
      await this.sendEmail({
        to: user.email,
        subject: emailSubject,
        html: emailContent,
        templateId: template?.id
      });
    } catch (error) {
      logger.error(`Error al enviar correo de restablecimiento: ${error.message}`, { error });
      throw new Error(`Error al enviar correo de restablecimiento: ${error.message}`);
    }
  }

  /**
   * Envía un correo de bienvenida
   * @param {Object} user - Usuario destinatario
   * @returns {Promise<void>}
   */
  async sendWelcomeEmail(user) {
    try {
      // Buscar plantilla
      const template = await prisma.notificationTemplate.findFirst({
        where: {
          type: 'email',
          name: 'bienvenida',
          isActive: true
        }
      });

      // Usar plantilla o contenido predeterminado
      let emailContent;
      let emailSubject;

      if (template) {
        // Reemplazar variables en la plantilla
        emailContent = template.content
          .replace(/{{name}}/g, user.username || 'Usuario');
        
        emailSubject = template.subject;
      } else {
        // Contenido predeterminado
        emailContent = `
          <h1>¡Bienvenido a TeLoFundi!</h1>
          <p>Hola ${user.username || 'Usuario'},</p>
          <p>Gracias por unirte a nuestra plataforma. Estamos encantados de tenerte con nosotros.</p>
          <p>Esperamos que disfrutes de la experiencia y encuentres exactamente lo que buscas.</p>
          <p>No dudes en contactarnos si tienes alguna pregunta.</p>
          <p>Saludos,<br>El equipo de TeLoFundi</p>
        `;
        
        emailSubject = '¡Bienvenido a TeLoFundi!';
      }

      // Enviar correo
      await this.sendEmail({
        to: user.email,
        subject: emailSubject,
        html: emailContent,
        templateId: template?.id
      });
    } catch (error) {
      logger.error(`Error al enviar correo de bienvenida: ${error.message}`, { error });
      // No lanzar error ya que esto no debe interrumpir el flujo de registro
    }
  }
}

module.exports = new EmailService();