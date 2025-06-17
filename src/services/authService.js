const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');

// Configurar transportador de email
const createEmailTransporter = () => {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn('Email configuration missing - email features disabled');
    return null;
  }

  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true para 465, false para otros puertos
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Enviar email de verificación
const sendVerificationEmail = async (user, verificationToken) => {
  const transporter = createEmailTransporter();
  if (!transporter) {
    logger.warn('Cannot send verification email - transporter not configured');
    return false;
  }

  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

  const mailOptions = {
    from: `"TeLoFundi" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: 'Verifica tu cuenta en TeLoFundi',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Verificación de Email - TeLoFundi</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>¡Bienvenido a TeLoFundi!</h1>
          </div>
          <div class="content">
            <h2>Hola ${user.firstName},</h2>
            <p>Gracias por registrarte en TeLoFundi. Para completar tu registro, por favor verifica tu dirección de email haciendo clic en el botón de abajo:</p>
            
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verificar Email</a>
            </div>
            
            <p>Si el botón no funciona, puedes copiar y pegar este enlace en tu navegador:</p>
            <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
            
            <p><strong>Este enlace expirará en 24 horas.</strong></p>
            
            <p>Si no creaste esta cuenta, puedes ignorar este email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 TeLoFundi. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info('Verification email sent', { userId: user.id, email: user.email });
    return true;
  } catch (error) {
    logger.error('Error sending verification email:', error);
    return false;
  }
};

// Enviar email de restablecimiento de contraseña
const sendPasswordResetEmail = async (user, resetToken) => {
  const transporter = createEmailTransporter();
  if (!transporter) {
    logger.warn('Cannot send password reset email - transporter not configured');
    return false;
  }

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: `"TeLoFundi" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: 'Restablece tu contraseña - TeLoFundi',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Restablecer Contraseña - TeLoFundi</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #e74c3c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Restablece tu contraseña</h1>
          </div>
          <div class="content">
            <h2>Hola ${user.firstName},</h2>
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en TeLoFundi.</p>
            
            <div class="warning">
              <strong>⚠️ Importante:</strong> Si no solicitaste este cambio, ignora este email. Tu contraseña no será cambiada.
            </div>
            
            <p>Para crear una nueva contraseña, haz clic en el botón de abajo:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
            </div>
            
            <p>Si el botón no funciona, puedes copiar y pegar este enlace en tu navegador:</p>
            <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
            
            <p><strong>Este enlace expirará en 15 minutos por seguridad.</strong></p>
          </div>
          <div class="footer">
            <p>&copy; 2024 TeLoFundi. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info('Password reset email sent', { userId: user.id, email: user.email });
    return true;
  } catch (error) {
    logger.error('Error sending password reset email:', error);
    return false;
  }
};

// Enviar email de bienvenida
const sendWelcomeEmail = async (user) => {
  const transporter = createEmailTransporter();
  if (!transporter) {
    return false;
  }

  const dashboardUrl = `${process.env.FRONTEND_URL}/dashboard`;
  
  let userTypeMessage = '';
  switch (user.userType) {
    case 'ESCORT':
      userTypeMessage = 'Como escort, puedes crear hasta 5 anuncios y conectar con clientes y agencias.';
      break;
    case 'AGENCY':
      userTypeMessage = 'Como agencia, puedes crear anuncios ilimitados y gestionar un equipo de escorts.';
      break;
    case 'CLIENT':
      userTypeMessage = 'Como cliente, puedes explorar perfiles, dar likes y chatear con escorts.';
      break;
  }

  const mailOptions = {
    from: `"TeLoFundi" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: '¡Bienvenido a TeLoFundi! Tu cuenta está lista',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Bienvenido a TeLoFundi</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .feature { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #667eea; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>¡Bienvenido a TeLoFundi!</h1>
            <p>Tu cuenta está lista para usar</p>
          </div>
          <div class="content">
            <h2>¡Hola ${user.firstName}! 🎉</h2>
            <p>Tu cuenta en TeLoFundi ha sido creada exitosamente. ${userTypeMessage}</p>
            
            <div style="text-align: center;">
              <a href="${dashboardUrl}" class="button">Ir a mi Dashboard</a>
            </div>
            
            <h3>¿Qué puedes hacer ahora?</h3>
            
            <div class="feature">
              <strong>📝 Completa tu perfil</strong><br>
              Agrega una foto, descripción y toda la información que quieras compartir.
            </div>
            
            ${user.userType !== 'CLIENT' ? `
            <div class="feature">
              <strong>📢 Crea tu primer anuncio</strong><br>
              Publica tu primer anuncio para empezar a conectar con ${user.userType === 'ESCORT' ? 'clientes' : 'escorts'}.
            </div>
            ` : ''}
            
            <div class="feature">
              <strong>🔍 Explora la plataforma</strong><br>
              Descubre perfiles, usa el feed y encuentra exactamente lo que buscas.
            </div>
            
            <div class="feature">
              <strong>💬 Inicia conversaciones</strong><br>
              Conecta y chatea con otros usuarios de la plataforma.
            </div>
            
            ${user.userType === 'CLIENT' ? `
            <p><strong>🎁 ¡Regalo de bienvenida!</strong> Tu cuenta incluye 10 puntos gratis para empezar.</p>
            ` : ''}
            
            <p>Si tienes preguntas, no dudes en contactarnos. ¡Estamos aquí para ayudarte!</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 TeLoFundi. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info('Welcome email sent', { userId: user.id, email: user.email });
    return true;
  } catch (error) {
    logger.error('Error sending welcome email:', error);
    return false;
  }
};

// Generar token de verificación único
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Generar token de reset único
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Verificar fortaleza de contraseña
const validatePasswordStrength = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[@$!%*?&]/.test(password);

  const errors = [];

  if (password.length < minLength) {
    errors.push(`La contraseña debe tener al menos ${minLength} caracteres`);
  }
  if (!hasUpperCase) {
    errors.push('La contraseña debe contener al menos una letra mayúscula');
  }
  if (!hasLowerCase) {
    errors.push('La contraseña debe contener al menos una letra minúscula');
  }
  if (!hasNumbers) {
    errors.push('La contraseña debe contener al menos un número');
  }
  if (!hasSpecialChar) {
    errors.push('La contraseña debe contener al menos un carácter especial (@$!%*?&)');
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength: calculatePasswordStrength(password)
  };
};

// Calcular fuerza de contraseña
const calculatePasswordStrength = (password) => {
  let score = 0;
  
  // Longitud
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  
  // Caracteres
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[@$!%*?&]/.test(password)) score += 1;
  
  // Variedad
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  
  if (score < 3) return 'débil';
  if (score < 6) return 'media';
  if (score < 8) return 'fuerte';
  return 'muy fuerte';
};

// Limpiar tokens expirados
const cleanupExpiredTokens = async () => {
  try {
    const now = new Date();
    
    // Limpiar tokens de password reset expirados
    await prisma.user.updateMany({
      where: {
        passwordResetExpiry: {
          lt: now
        }
      },
      data: {
        passwordResetToken: null,
        passwordResetExpiry: null
      }
    });

    // Limpiar tokens de verificación muy antiguos (más de 7 días)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await prisma.user.updateMany({
      where: {
        emailVerificationToken: {
          not: null
        },
        createdAt: {
          lt: weekAgo
        }
      },
      data: {
        emailVerificationToken: null
      }
    });

    logger.info('Expired tokens cleaned up');
  } catch (error) {
    logger.error('Error cleaning up expired tokens:', error);
  }
};

// Verificar si un usuario necesita verificar email
const needsEmailVerification = (user) => {
  return !user.emailVerified && user.emailVerificationToken;
};

// Obtener estadísticas de autenticación
const getAuthStats = async () => {
  try {
    const [
      totalUsers,
      verifiedUsers,
      activeUsers,
      bannedUsers,
      recentRegistrations
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isBanned: true } }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Última semana
          }
        }
      })
    ]);

    return {
      totalUsers,
      verifiedUsers,
      verificationRate: totalUsers > 0 ? (verifiedUsers / totalUsers * 100).toFixed(2) : 0,
      activeUsers,
      bannedUsers,
      recentRegistrations
    };
  } catch (error) {
    logger.error('Error getting auth stats:', error);
    throw error;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  generateVerificationToken,
  generateResetToken,
  validatePasswordStrength,
  calculatePasswordStrength,
  cleanupExpiredTokens,
  needsEmailVerification,
  getAuthStats
};