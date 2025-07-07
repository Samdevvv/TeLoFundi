const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');

// ✅ CONFIGURAR TRANSPORTADOR DE EMAIL CORREGIDO COMPLETAMENTE
const createEmailTransporter = () => {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn('❌ Configuración de email faltante:', {
      EMAIL_HOST: !!process.env.EMAIL_HOST,
      EMAIL_USER: !!process.env.EMAIL_USER,
      EMAIL_PASS: !!process.env.EMAIL_PASS,
      EMAIL_FROM: !!process.env.EMAIL_FROM,
      EMAIL_FROM_NAME: !!process.env.EMAIL_FROM_NAME
    });
    return null;
  }

  // ✅ CONFIGURACIÓN CORREGIDA PARA GMAIL CON CONTRASEÑA DE APLICACIÓN
  const transporter = nodemailer.createTransporter({
    host: process.env.EMAIL_HOST, // smtp.gmail.com
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true' || false, // false para puerto 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS // Contraseña de aplicación de 16 dígitos
    },
    // ✅ Configuraciones adicionales para mejorar confiabilidad
    tls: {
      rejectUnauthorized: false // Permite certificados auto-firmados
    },
    connectionTimeout: 60000, // 60 segundos
    greetingTimeout: 30000, // 30 segundos
    socketTimeout: 60000, // 60 segundos
    debug: process.env.NODE_ENV === 'development', // Debug en desarrollo
    logger: process.env.NODE_ENV === 'development' // Logger en desarrollo
  });

  // ✅ VERIFICAR CONFIGURACIÓN AL CREAR EL TRANSPORTER
  transporter.verify((error, success) => {
    if (error) {
      logger.error('❌ Error configurando nodemailer:', {
        error: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        stack: error.stack
      });
      
      // ✅ Mensajes de ayuda específicos para errores comunes
      if (error.code === 'EAUTH') {
        logger.error('🔑 ERROR DE AUTENTICACIÓN - Revisa:');
        logger.error('   1. ¿Tienes verificación en 2 pasos activada?');
        logger.error('   2. ¿Estás usando contraseña de aplicación (16 dígitos)?');
        logger.error('   3. ¿La contraseña de aplicación es correcta?');
        logger.error('   📝 Crear contraseña: https://myaccount.google.com/apppasswords');
      }
      
      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNECTION') {
        logger.error('🌐 ERROR DE CONEXIÓN - Revisa tu conexión a internet');
      }

      if (error.code === 'ENOTFOUND') {
        logger.error('🌐 ERROR DNS - No se puede resolver smtp.gmail.com');
      }
    } else {
      logger.info('✅ Nodemailer configurado correctamente para Gmail');
      logger.info('📧 Listo para enviar emails desde:', process.env.EMAIL_USER);
      logger.info('🔧 Configuración:', {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_SECURE,
        user: process.env.EMAIL_USER
      });
    }
  });

  return transporter;
};

// ✅ ENVIAR EMAIL DE RESTABLECIMIENTO DE CONTRASEÑA - COMPLETAMENTE CORREGIDO
const sendPasswordResetEmail = async (user, resetToken) => {
  const transporter = createEmailTransporter();
  if (!transporter) {
    logger.warn('❌ No se puede enviar email - transporter no configurado');
    return false;
  }

  // ✅ URL CORREGIDA PARA EL FRONTEND
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: {
      name: process.env.EMAIL_FROM_NAME || 'TeloFundi',
      address: process.env.EMAIL_USER
    },
    to: user.email,
    subject: '🔐 Restablecer contraseña - TeloFundi',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Restablecer Contraseña - TeloFundi</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background-color: #f5f5f5; 
            color: #333;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 12px; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            padding: 30px; 
            text-align: center; 
            color: white;
          }
          .header h1 { 
            margin: 0; 
            font-size: 24px; 
            font-weight: 600;
          }
          .content { 
            padding: 40px 30px; 
          }
          .content h2 { 
            color: #333; 
            margin-bottom: 20px; 
            font-size: 20px;
          }
          .content p { 
            line-height: 1.6; 
            margin-bottom: 20px; 
            color: #666;
          }
          .button { 
            display: inline-block; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: 600;
            margin: 20px 0;
            transition: transform 0.2s;
          }
          .button:hover { 
            transform: translateY(-2px); 
          }
          .warning { 
            background: #fff3cd; 
            border: 1px solid #ffeaa7; 
            padding: 15px; 
            border-radius: 8px; 
            margin: 20px 0;
          }
          .footer { 
            background: #f8f9fa; 
            padding: 20px 30px; 
            text-align: center; 
            font-size: 14px; 
            color: #666;
          }
          .token-code {
            background: #f8f9fa;
            border: 2px dashed #dee2e6;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            margin: 20px 0;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            font-weight: bold;
            color: #495057;
            word-break: break-all;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 TeloFundi</h1>
          </div>
          <div class="content">
            <h2>Hola ${user.firstName},</h2>
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta de TeloFundi.</p>
            
            <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
            </div>
            
            <p>O copia y pega este enlace en tu navegador:</p>
            <div class="token-code">${resetUrl}</div>
            
            <div class="warning">
              <p><strong>⚠️ Importante:</strong></p>
              <ul>
                <li>Este enlace expira en <strong>15 minutos</strong></li>
                <li>Si no solicitaste este cambio, ignora este email</li>
                <li>Tu contraseña actual seguirá siendo válida hasta que la cambies</li>
              </ul>
            </div>
            
            <p>Si tienes problemas con el enlace, contacta nuestro soporte.</p>
          </div>
          <div class="footer">
            <p>Este es un email automático, no respondas a este mensaje.</p>
            <p>&copy; 2025 TeloFundi - Plataforma Premium de República Dominicana</p>
          </div>
        </div>
      </body>
      </html>
    `,
    // ✅ Agregar versión de texto plano como fallback
    text: `
      Hola ${user.firstName},
      
      Recibimos una solicitud para restablecer la contraseña de tu cuenta de TeloFundi.
      
      Copia y pega este enlace en tu navegador para restablecer tu contraseña:
      ${resetUrl}
      
      IMPORTANTE:
      - Este enlace expira en 15 minutos
      - Si no solicitaste este cambio, ignora este email
      - Tu contraseña actual seguirá siendo válida hasta que la cambies
      
      TeloFundi - Plataforma Premium de República Dominicana
    `,
    // ✅ Configuraciones adicionales para mejorar entrega
    priority: 'high',
    headers: {
      'X-Priority': '1',
      'X-MSMail-Priority': 'High',
      'Importance': 'high'
    }
  };

  try {
    // ✅ LOG ANTES DE ENVIAR CON MÁS DETALLES
    logger.info('📧 Intentando enviar email de reset...', {
      to: user.email,
      from: mailOptions.from,
      subject: mailOptions.subject,
      resetUrl,
      userAgent: 'TeloFundi-Backend',
      timestamp: new Date().toISOString(),
      config: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        user: process.env.EMAIL_USER
      }
    });

    // ✅ USAR ASYNC/AWAIT EN LUGAR DE CALLBACK
    const info = await transporter.sendMail(mailOptions);
    
    // ✅ LOG DETALLADO DEL ÉXITO
    logger.info('✅ Email de reset enviado exitosamente:', { 
      messageId: info.messageId,
      response: info.response,
      envelope: info.envelope,
      accepted: info.accepted,
      rejected: info.rejected,
      userId: user.id, 
      email: user.email,
      resetUrl,
      timestamp: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    // ✅ LOG DETALLADO DEL ERROR CON AYUDA ESPECÍFICA
    logger.error('❌ Error enviando email de reset:', {
      error: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      userId: user.id,
      email: user.email,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // ✅ Ayuda específica según el tipo de error
    if (error.code === 'EAUTH') {
      logger.error('🔑 PROBLEMA DE AUTENTICACIÓN:');
      logger.error('   1. Verifica que tienes 2FA activado en Gmail');
      logger.error('   2. Crea una contraseña de aplicación: https://myaccount.google.com/apppasswords');
      logger.error('   3. Usa la contraseña de aplicación (16 dígitos) en EMAIL_PASS');
      logger.error('   4. NO uses tu contraseña regular de Gmail');
    } else if (error.code === 'ETIMEDOUT') {
      logger.error('⏰ TIMEOUT - El servidor tardó mucho en responder');
    } else if (error.code === 'ECONNECTION') {
      logger.error('🌐 ERROR DE CONEXIÓN - Problema de red o firewall');
    } else if (error.code === 'ENOTFOUND') {
      logger.error('🔍 DNS ERROR - No se puede resolver smtp.gmail.com');
    } else if (error.responseCode === 535) {
      logger.error('🔒 CREDENCIALES INCORRECTAS - Usuario o contraseña inválidos');
    } else if (error.responseCode === 550) {
      logger.error('📧 EMAIL RECHAZADO - Dirección de destino inválida');
    }
    
    return false;
  }
};

// ✅ ENVIAR EMAIL DE VERIFICACIÓN - COMPLETO
const sendVerificationEmail = async (user, verificationToken) => {
  const transporter = createEmailTransporter();
  if (!transporter) {
    logger.warn('Cannot send verification email - transporter not configured');
    return false;
  }

  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

  const mailOptions = {
    from: {
      name: process.env.EMAIL_FROM_NAME || 'TeloFundi',
      address: process.env.EMAIL_USER
    },
    to: user.email,
    subject: 'Verifica tu cuenta en TeloFundi',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Verificación de Email - TeloFundi</title>
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
            <h1>¡Bienvenido a TeloFundi!</h1>
          </div>
          <div class="content">
            <h2>Hola ${user.firstName},</h2>
            <p>Gracias por registrarte en TeloFundi. Para completar tu registro, por favor verifica tu dirección de email haciendo clic en el botón de abajo:</p>
            
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verificar Email</a>
            </div>
            
            <p>Si el botón no funciona, puedes copiar y pegar este enlace en tu navegador:</p>
            <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
            
            <p><strong>Este enlace expirará en 24 horas.</strong></p>
            
            <p>Si no creaste esta cuenta, puedes ignorar este email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 TeloFundi. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hola ${user.firstName},
      
      Gracias por registrarte en TeloFundi. Para completar tu registro, visita este enlace:
      ${verificationUrl}
      
      Este enlace expirará en 24 horas.
      
      Si no creaste esta cuenta, puedes ignorar este email.
      
      TeloFundi
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info('Verification email sent', { 
      messageId: info.messageId,
      userId: user.id, 
      email: user.email 
    });
    return true;
  } catch (error) {
    logger.error('Error sending verification email:', {
      error: error.message,
      code: error.code,
      userId: user.id,
      email: user.email
    });
    return false;
  }
};

// ✅ ENVIAR EMAIL DE BIENVENIDA - COMPLETO
const sendWelcomeEmail = async (user) => {
  const transporter = createEmailTransporter();
  if (!transporter) {
    return false;
  }

  const dashboardUrl = `${process.env.FRONTEND_URL}/dashboard`;
  
  let userTypeMessage = '';
  switch (user.userType) {
    case 'ESCORT':
      userTypeMessage = 'Como escort, puedes crear hasta 3 anuncios gratuitos y conectar con clientes y agencias.';
      break;
    case 'AGENCY':
      userTypeMessage = 'Como agencia, puedes crear anuncios ilimitados y gestionar un equipo de escorts.';
      break;
    case 'CLIENT':
      userTypeMessage = 'Como cliente, puedes explorar perfiles, dar likes y chatear con escorts.';
      break;
  }

  const mailOptions = {
    from: {
      name: process.env.EMAIL_FROM_NAME || 'TeloFundi',
      address: process.env.EMAIL_USER
    },
    to: user.email,
    subject: '¡Bienvenido a TeloFundi! Tu cuenta está lista',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Bienvenido a TeloFundi</title>
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
            <h1>¡Bienvenido a TeloFundi!</h1>
            <p>Tu cuenta está lista para usar</p>
          </div>
          <div class="content">
            <h2>¡Hola ${user.firstName}! 🎉</h2>
            <p>Tu cuenta en TeloFundi ha sido creada exitosamente. ${userTypeMessage}</p>
            
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
            <p>&copy; 2025 TeloFundi. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      ¡Hola ${user.firstName}!
      
      Tu cuenta en TeloFundi ha sido creada exitosamente. ${userTypeMessage}
      
      Visita tu dashboard: ${dashboardUrl}
      
      ¿Qué puedes hacer ahora?
      - Completa tu perfil
      - ${user.userType !== 'CLIENT' ? 'Crea tu primer anuncio' : 'Explora perfiles'}
      - Inicia conversaciones
      
      ${user.userType === 'CLIENT' ? '¡Regalo de bienvenida! Tu cuenta incluye 10 puntos gratis para empezar.' : ''}
      
      TeloFundi
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info('Welcome email sent', { 
      messageId: info.messageId,
      userId: user.id, 
      email: user.email 
    });
    return true;
  } catch (error) {
    logger.error('Error sending welcome email:', {
      error: error.message,
      code: error.code,
      userId: user.id,
      email: user.email
    });
    return false;
  }
};

// ✅ NUEVA FUNCIÓN: ENVIAR EMAIL ESPECÍFICO PARA AGENCIAS PENDIENTES
const sendAgencyPendingEmail = async (user, agencyData) => {
  const transporter = createEmailTransporter();
  if (!transporter) {
    logger.warn('Cannot send agency pending email - transporter not configured');
    return false;
  }

  const { companyName, businessLicense, contactPerson, address } = agencyData;

  const mailOptions = {
    from: {
      name: process.env.EMAIL_FROM_NAME || 'TeloFundi',
      address: process.env.EMAIL_USER
    },
    to: user.email,
    subject: '📋 Solicitud de agencia recibida - TeloFundi',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Solicitud de Agencia - TeloFundi</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background-color: #f5f5f5; 
            color: #333;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 12px; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            padding: 30px; 
            text-align: center; 
            color: white;
          }
          .header h1 { 
            margin: 0; 
            font-size: 24px; 
            font-weight: 600;
          }
          .content { 
            padding: 40px 30px; 
          }
          .content h2 { 
            color: #333; 
            margin-bottom: 20px; 
            font-size: 20px;
          }
          .content p { 
            line-height: 1.6; 
            margin-bottom: 20px; 
            color: #666;
          }
          .info-box { 
            background: #f8f9fa; 
            border: 1px solid #dee2e6; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0;
          }
          .info-item {
            margin-bottom: 10px;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
          }
          .info-item:last-child {
            border-bottom: none;
            margin-bottom: 0;
          }
          .info-label {
            font-weight: 600;
            color: #495057;
            display: inline-block;
            width: 140px;
          }
          .info-value {
            color: #6c757d;
          }
          .next-steps { 
            background: #e7f3ff; 
            border: 1px solid #b8daff; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0;
          }
          .next-steps h3 {
            color: #004085;
            margin-top: 0;
            margin-bottom: 15px;
          }
          .next-steps ol {
            color: #004085;
            margin: 0;
            padding-left: 20px;
          }
          .next-steps li {
            margin-bottom: 8px;
          }
          .warning { 
            background: #fff3cd; 
            border: 1px solid #ffeaa7; 
            padding: 15px; 
            border-radius: 8px; 
            margin: 20px 0;
          }
          .footer { 
            background: #f8f9fa; 
            padding: 20px 30px; 
            text-align: center; 
            font-size: 14px; 
            color: #666;
          }
          .status-badge {
            display: inline-block;
            background: #ffc107;
            color: #212529;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 TeloFundi</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Solicitud de Agencia</p>
          </div>
          <div class="content">
            <h2>Hola ${user.firstName},</h2>
            <p>Hemos recibido tu solicitud para convertirte en una agencia verificada en TeloFundi.</p>
            
            <div style="text-align: center; margin: 25px 0;">
              <span class="status-badge">⏳ Pendiente de Revisión</span>
            </div>
            
            <div class="info-box">
              <h3 style="margin-top: 0; color: #495057;">📋 Datos de tu solicitud:</h3>
              <div class="info-item">
                <span class="info-label">Empresa:</span>
                <span class="info-value">${companyName}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Licencia:</span>
                <span class="info-value">${businessLicense}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Contacto:</span>
                <span class="info-value">${contactPerson}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Dirección:</span>
                <span class="info-value">${address}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Email:</span>
                <span class="info-value">${user.email}</span>
              </div>
            </div>
            
            <div class="next-steps">
              <h3>🔍 Próximos pasos:</h3>
              <ol>
                <li>Nuestro equipo revisará tu documentación y datos proporcionados</li>
                <li>Verificaremos la autenticidad de la información de tu empresa</li>
                <li>Validaremos los documentos de identificación subidos</li>
                <li>Te notificaremos por email sobre nuestra decisión</li>
                <li>Una vez aprobado, tendrás acceso completo a las funcionalidades de agencia</li>
              </ol>
            </div>
            
            <div class="warning">
              <p><strong>⏰ Tiempo estimado de revisión:</strong></p>
              <ul style="margin: 10px 0;">
                <li><strong>24-48 horas</strong> para revisión inicial</li>
                <li>Posible solicitud de documentación adicional</li>
                <li>Notificación inmediata por email una vez completada</li>
              </ul>
            </div>
            
            <p><strong>Importante:</strong> Durante este período no podrás acceder a tu cuenta. Una vez aprobada tu solicitud, recibirás un email de confirmación y podrás iniciar sesión normalmente.</p>
            
            <p>Si tienes alguna pregunta sobre el proceso, no dudes en contactar nuestro equipo de soporte.</p>
            
            <p style="margin-top: 30px;">
              <strong>Gracias por elegir TeloFundi</strong><br>
              <em>El equipo de verificación</em>
            </p>
          </div>
          <div class="footer">
            <p>Este es un email automático, no respondas a este mensaje.</p>
            <p>&copy; 2025 TeloFundi - Plataforma Premium de República Dominicana</p>
            <p style="margin-top: 10px; font-size: 12px;">
              Solicitud recibida el ${new Date().toLocaleDateString('es-ES', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hola ${user.firstName},
      
      Hemos recibido tu solicitud para convertirte en una agencia verificada en TeloFundi.
      
      ESTADO: PENDIENTE DE REVISIÓN
      
      Datos de tu solicitud:
      - Empresa: ${companyName}
      - Licencia: ${businessLicense}
      - Contacto: ${contactPerson}
      - Dirección: ${address}
      - Email: ${user.email}
      
      PRÓXIMOS PASOS:
      1. Nuestro equipo revisará tu documentación y datos proporcionados
      2. Verificaremos la autenticidad de la información de tu empresa
      3. Validaremos los documentos de identificación subidos
      4. Te notificaremos por email sobre nuestra decisión
      5. Una vez aprobado, tendrás acceso completo a las funcionalidades de agencia
      
      TIEMPO ESTIMADO: 24-48 horas
      
      IMPORTANTE: Durante este período no podrás acceder a tu cuenta. Una vez aprobada tu solicitud, recibirás un email de confirmación y podrás iniciar sesión normalmente.
      
      Gracias por elegir TeloFundi.
      El equipo de verificación
    `,
    priority: 'normal',
    headers: {
      'X-Priority': '3',
      'X-MSMail-Priority': 'Normal'
    }
  };

  try {
    logger.info('📧 Enviando email de solicitud pendiente para agencia...', {
      to: user.email,
      companyName,
      userId: user.id
    });

    const info = await transporter.sendMail(mailOptions);
    
    logger.info('✅ Email de solicitud pendiente enviado exitosamente:', { 
      messageId: info.messageId,
      response: info.response,
      envelope: info.envelope,
      accepted: info.accepted,
      rejected: info.rejected,
      userId: user.id, 
      email: user.email,
      companyName,
      timestamp: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    logger.error('❌ Error enviando email de solicitud pendiente:', {
      error: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      userId: user.id,
      email: user.email,
      companyName,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return false;
  }
};

// ✅ NUEVA FUNCIÓN: ENVIAR EMAIL DE APROBACIÓN DE AGENCIA
const sendAgencyApprovedEmail = async (user, agencyData, approvalData = {}) => {
  const transporter = createEmailTransporter();
  if (!transporter) {
    return false;
  }

  const { companyName } = agencyData;
  const { approvedBy, notes } = approvalData;
  const dashboardUrl = `${process.env.FRONTEND_URL}/dashboard`;

  const mailOptions = {
    from: {
      name: process.env.EMAIL_FROM_NAME || 'TeloFundi',
      address: process.env.EMAIL_USER
    },
    to: user.email,
    subject: '🎉 ¡Agencia aprobada! - TeloFundi',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Agencia Aprobada - TeloFundi</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background-color: #f5f5f5; 
            color: #333;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 12px; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header { 
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%); 
            padding: 30px; 
            text-align: center; 
            color: white;
          }
          .header h1 { 
            margin: 0; 
            font-size: 24px; 
            font-weight: 600;
          }
          .content { 
            padding: 40px 30px; 
          }
          .success-badge {
            display: inline-block;
            background: #28a745;
            color: white;
            padding: 8px 16px;
            border-radius: 25px;
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 20px 0;
          }
          .button { 
            display: inline-block; 
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%); 
            color: white; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: 600;
            margin: 20px 0;
            transition: transform 0.2s;
          }
          .feature { 
            background: #f8f9fa; 
            padding: 20px; 
            margin: 15px 0; 
            border-radius: 8px; 
            border-left: 4px solid #28a745; 
          }
          .footer { 
            background: #f8f9fa; 
            padding: 20px 30px; 
            text-align: center; 
            font-size: 14px; 
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 ¡Felicidades!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 18px;">Tu agencia ha sido aprobada</p>
          </div>
          <div class="content">
            <div style="text-align: center;">
              <span class="success-badge">✅ AGENCIA VERIFICADA</span>
            </div>
            
            <h2>Hola ${user.firstName},</h2>
            <p><strong>¡Excelentes noticias!</strong> Tu solicitud para <strong>${companyName}</strong> ha sido aprobada y verificada exitosamente.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${dashboardUrl}" class="button">Acceder a mi Dashboard</a>
            </div>
            
            <h3>🚀 ¿Qué puedes hacer ahora como agencia verificada?</h3>
            
            <div class="feature">
              <strong>👥 Reclutar Escorts</strong><br>
              Invita escorts a unirse a tu agencia y gestiona tu equipo completo.
            </div>
            
            <div class="feature">
              <strong>✅ Verificar Escorts</strong><br>
              Ofrece servicios de verificación a tus escorts para aumentar su credibilidad.
            </div>
            
            <div class="feature">
              <strong>📢 Publicaciones Ilimitadas</strong><br>
              Crea anuncios sin límites y con prioridad en el feed principal.
            </div>
            
            <div class="feature">
              <strong>📊 Analytics Avanzados</strong><br>
              Accede a métricas detalladas de rendimiento de tu agencia y escorts.
            </div>
            
            <div class="feature">
              <strong>💬 Chat Directo</strong><br>
              Comunícate directamente con clientes y gestiona todas las conversaciones.
            </div>
            
            ${notes ? `
            <div style="background: #e7f3ff; border: 1px solid #b8daff; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>📝 Notas del equipo de verificación:</strong></p>
              <p style="font-style: italic; color: #004085;">"${notes}"</p>
            </div>
            ` : ''}
            
            <p><strong>Importante:</strong> Ya puedes iniciar sesión en tu cuenta y acceder a todas las funcionalidades de agencia. Tu badge de verificación aparecerá en todos tus anuncios y perfil.</p>
            
            <p>Si tienes alguna pregunta sobre las nuevas funcionalidades, no dudes en contactar nuestro equipo de soporte.</p>
            
            <p style="margin-top: 30px;">
              <strong>¡Bienvenido oficialmente a TeloFundi!</strong><br>
              <em>El equipo de TeloFundi</em>
            </p>
          </div>
          <div class="footer">
            <p>&copy; 2025 TeloFundi - Plataforma Premium de República Dominicana</p>
            <p style="margin-top: 10px; font-size: 12px;">
              Agencia aprobada el ${new Date().toLocaleDateString('es-ES', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      ¡Felicidades ${user.firstName}!
      
      Tu solicitud para ${companyName} ha sido aprobada y verificada exitosamente.
      
      ESTADO: AGENCIA VERIFICADA ✅
      
      ¿Qué puedes hacer ahora como agencia verificada?
      - Reclutar escorts e invitarlos a unirse a tu agencia
      - Verificar escorts para aumentar su credibilidad
      - Crear publicaciones ilimitadas con prioridad en el feed
      - Acceder a analytics avanzados de rendimiento
      - Comunicarte directamente con clientes
      
      ${notes ? `Notas del equipo: "${notes}"` : ''}
      
      Accede a tu dashboard: ${dashboardUrl}
      
      ¡Bienvenido oficialmente a TeloFundi!
      El equipo de TeloFundi
    `,
    priority: 'high'
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info('✅ Email de aprobación de agencia enviado:', { 
      messageId: info.messageId,
      userId: user.id, 
      email: user.email,
      companyName
    });
    return true;
  } catch (error) {
    logger.error('❌ Error enviando email de aprobación:', {
      error: error.message,
      userId: user.id,
      email: user.email,
      companyName
    });
    return false;
  }
};

// ✅ NUEVA FUNCIÓN: ENVIAR EMAIL DE RECHAZO DE AGENCIA
const sendAgencyRejectedEmail = async (user, agencyData, rejectionData = {}) => {
  const transporter = createEmailTransporter();
  if (!transporter) {
    return false;
  }

  const { companyName } = agencyData;
  const { reason, notes } = rejectionData;

  const mailOptions = {
    from: {
      name: process.env.EMAIL_FROM_NAME || 'TeloFundi',
      address: process.env.EMAIL_USER
    },
    to: user.email,
    subject: '❌ Solicitud de agencia - TeloFundi',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Solicitud de Agencia - TeloFundi</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background-color: #f5f5f5; 
            color: #333;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 12px; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header { 
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); 
            padding: 30px; 
            text-align: center; 
            color: white;
          }
          .content { 
            padding: 40px 30px; 
          }
          .rejection-badge {
            display: inline-block;
            background: #dc3545;
            color: white;
            padding: 8px 16px;
            border-radius: 25px;
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 20px 0;
          }
          .reason-box { 
            background: #f8d7da; 
            border: 1px solid #f5c6cb; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0;
          }
          .next-steps { 
            background: #e2e3e5; 
            border: 1px solid #d6d8db; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0;
          }
          .footer { 
            background: #f8f9fa; 
            padding: 20px 30px; 
            text-align: center; 
            font-size: 14px; 
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 TeloFundi</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Actualización de tu solicitud</p>
          </div>
          <div class="content">
            <div style="text-align: center;">
              <span class="rejection-badge">❌ Solicitud no aprobada</span>
            </div>
            
            <h2>Hola ${user.firstName},</h2>
            <p>Lamentamos informarte que tu solicitud para <strong>${companyName}</strong> no ha sido aprobada en esta ocasión.</p>
            
            <div class="reason-box">
              <h3 style="margin-top: 0; color: #721c24;">📋 Motivo principal:</h3>
              <p style="color: #721c24; font-weight: 500;">${reason}</p>
              
              ${notes ? `
              <h4 style="color: #721c24;">📝 Detalles adicionales:</h4>
              <p style="color: #721c24; font-style: italic;">${notes}</p>
              ` : ''}
            </div>
            
            <div class="next-steps">
              <h3 style="margin-top: 0; color: #383d41;">🔄 ¿Qué puedes hacer?</h3>
              <ul style="color: #383d41;">
                <li>Revisar y corregir la documentación mencionada</li>
                <li>Asegurar que toda la información sea correcta y actualizada</li>
                <li>Contactar nuestro equipo de soporte para aclaraciones</li>
                <li>Volver a aplicar una vez que hayas solucionado los problemas</li>
              </ul>
            </div>
            
            <p><strong>Importante:</strong> Esta decisión no es definitiva. Puedes corregir los problemas mencionados y volver a enviar tu solicitud cuando esté lista.</p>
            
            <p>Nuestro equipo de soporte está disponible para ayudarte con cualquier pregunta sobre el proceso de verificación.</p>
            
            <p style="margin-top: 30px;">
              <strong>Gracias por tu comprensión</strong><br>
              <em>El equipo de verificación de TeloFundi</em>
            </p>
          </div>
          <div class="footer">
            <p>Para soporte: soporte@telofundi.com</p>
            <p>&copy; 2025 TeloFundi - Plataforma Premium de República Dominicana</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hola ${user.firstName},
      
      Lamentamos informarte que tu solicitud para ${companyName} no ha sido aprobada en esta ocasión.
      
      MOTIVO: ${reason}
      ${notes ? `DETALLES: ${notes}` : ''}
      
      ¿Qué puedes hacer?
      - Revisar y corregir la documentación mencionada
      - Asegurar que toda la información sea correcta y actualizada
      - Contactar nuestro equipo de soporte para aclaraciones
      - Volver a aplicar una vez que hayas solucionado los problemas
      
      Esta decisión no es definitiva. Puedes corregir los problemas y volver a aplicar.
      
      Para soporte: soporte@telofundi.com
      
      El equipo de verificación de TeloFundi
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info('✅ Email de rechazo de agencia enviado:', { 
      messageId: info.messageId,
      userId: user.id, 
      email: user.email,
      companyName,
      reason
    });
    return true;
  } catch (error) {
    logger.error('❌ Error enviando email de rechazo:', {
      error: error.message,
      userId: user.id,
      email: user.email,
      companyName
    });
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
      recentRegistrations,
      pendingAgencies
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
      }),
      prisma.user.count({ 
        where: { 
          userType: 'AGENCY', 
          accountStatus: 'PENDING_APPROVAL' 
        } 
      })
    ]);

    return {
      totalUsers,
      verifiedUsers,
      verificationRate: totalUsers > 0 ? (verifiedUsers / totalUsers * 100).toFixed(2) : 0,
      activeUsers,
      bannedUsers,
      recentRegistrations,
      pendingAgencies
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
  sendAgencyPendingEmail, // ✅ NUEVA FUNCIÓN EXPORTADA
  sendAgencyApprovedEmail, // ✅ NUEVA FUNCIÓN EXPORTADA
  sendAgencyRejectedEmail, // ✅ NUEVA FUNCIÓN EXPORTADA
  generateVerificationToken,
  generateResetToken,
  validatePasswordStrength,
  calculatePasswordStrength,
  cleanupExpiredTokens,
  needsEmailVerification,
  getAuthStats
};