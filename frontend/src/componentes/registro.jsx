import { useState, useEffect, useRef } from "react";
import {
  FaArrowLeft,
  FaEnvelope,
  FaLock,
  FaUser
} from "react-icons/fa";
import { createPortal } from "react-dom";
import "../estilos/registr.css";
import loginImage from "../assets/logo png.png";
import googleAuthService from "./googleAuthService";

// Configuración de la API - Ajusta según tu estructura de proyecto
const API_CONFIG = {
  BASE_URL: "http://localhost:5000"
};

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const Registro = ({ setMenu, onClose, transitionDirection, onLoginSuccess }) => {
  // Cambiado el valor inicial de userType a "cliente"
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    userType: "cliente",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shouldAnimate, setShouldAnimate] = useState(!transitionDirection);
  const googleButtonRef = useRef(null);
  const [googleButtonMode, setGoogleButtonMode] = useState('custom'); // 'custom', 'rendered', o 'redirect'
  const googleButtonContainerRef = useRef(null);

  useEffect(() => {
    // Inicializar el servicio de Google Auth
    const initGoogleAuth = async () => {
      try {
        await googleAuthService.initialize();
        console.log("Google Auth inicializado correctamente");
        
        // Si el modo es 'rendered', intentar usar el botón renderizado por Google
        if (googleButtonMode === 'rendered' && googleButtonContainerRef.current) {
          try {
            await googleAuthService.signInWithOneTap();
          } catch (err) {
            console.warn("No se pudo inicializar One Tap, usando botón personalizado", err);
            setGoogleButtonMode('custom');
          }
        }
      } catch (err) {
        console.error("Error al inicializar Google Auth:", err);
        // Si falla la inicialización, cambiar al modo de redirección
        setGoogleButtonMode('redirect');
      }
    };

    initGoogleAuth();
  }, [googleButtonMode]);

  useEffect(() => {
    if (!document.getElementById("modal-root")) {
      const modalRoot = document.createElement("div");
      modalRoot.id = "modal-root";
      document.body.appendChild(modalRoot);
    }
    if (!transitionDirection) {
      setTimeout(() => setShouldAnimate(true), 50);
    }
    return () => setShouldAnimate(false);
  }, [transitionDirection]);

  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    document.body.style.top = `-${scrollY}px`;
    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
      document.body.style.top = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, []);

  useEffect(() => {
    createFireParticles();
    // Recrear partículas cada 5 segundos para mantener el efecto
    const interval = setInterval(createFireParticles, 5000);
    return () => clearInterval(interval);
  }, []);

  const createFireParticles = () => {
    const fireContainer = document.getElementById("registro-fire-particles");
    if (fireContainer) {
      fireContainer.innerHTML = "";
      for (let i = 0; i < 30; i++) {
        const particle = document.createElement("div");
        particle.className = "registro-particle";
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.animationDelay = `${Math.random() * 2}s`;
        particle.style.animationDuration = `${1.5 + Math.random()}s`;
        particle.style.opacity = `${0.5 + Math.random() * 0.5}`;
        fireContainer.appendChild(particle);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Mejorada para incluir logging
  const handleUserTypeChange = (e) => {
    const newUserType = e.target.value;
    console.log(`Tipo de usuario cambiado a: ${newUserType}`);
    setFormData(prev => ({ ...prev, userType: newUserType }));
  };

  const handleClose = () => {
    const formElement = document.querySelector('.registro-form');
    if (formElement) {
      formElement.classList.add('exit');
      setTimeout(() => {
        if (onClose) {
          onClose();
        } else if (setMenu) {
          setMenu("mainpage");
        }
      }, 280);
    } else {
      if (onClose) {
        onClose();
      } else if (setMenu) {
        setMenu("mainpage");
      }
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target.className === 'registro-right') {
      handleClose();
    }
  };

  const validateForm = () => {
    const { username, email, password } = formData;
    
    if (!username || username.trim().length < 3) {
      return "El nombre de usuario debe tener al menos 3 caracteres.";
    }
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email.trim())) {
      return "Por favor, ingrese un correo electrónico válido (ejemplo: user@domain.com).";
    }
    
    if (!password || password.trim().length < 6) {
      return "La contraseña debe tener al menos 6 caracteres.";
    }
    
    return null;
  };

  const handleGoogleLogin = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log("Iniciando registro con Google...");
      
      let googleResponse;
      
      // Usar el método apropiado según el modo
      if (googleButtonMode === 'redirect') {
        // Usar el método de redirección (no devuelve respuesta)
        googleAuthService.signInWithRedirect();
        return; // Terminar aquí ya que redireccionará
      } else {
        // Usar el método principal con popup
        googleResponse = await googleAuthService.signIn();
      }
      
      console.log("Respuesta de Google:", googleResponse);
      
      // Autenticar con el backend (simulado) especificando el tipo de usuario seleccionado
      const authResponse = await googleAuthService.authenticateWithBackend(
        googleResponse.tokenId, 
        formData.userType // Pasar el tipo de usuario seleccionado
      );
      
      if (authResponse.success) {
        if (authResponse.status === "new_user") {
          // Se creó un nuevo usuario con Google
          setError({
            title: "Registro Exitoso",
            message: `Te has registrado con éxito como ${formData.userType} usando Google. ¡Bienvenido!`,
          });
          
          // Guardar tokens y datos del usuario para iniciar sesión inmediatamente
          localStorage.setItem("accessToken", authResponse.accessToken);
          localStorage.setItem("refreshToken", authResponse.refreshToken);
          
          const userData = {
            id: authResponse.userId,
            email: googleResponse.user.email,
            name: googleResponse.user.name,
            profileImage: googleResponse.user.picture,
            tipoUsuario: authResponse.tipoUsuario,
            googleAuth: true
          };
          
          localStorage.setItem("user", JSON.stringify(userData));
          
          // Si hay una función de inicio de sesión exitoso, la llamamos
          if (onLoginSuccess) {
            onLoginSuccess(userData);
          }
        } else {
          // El usuario ya existía, solo se inició sesión
          localStorage.setItem("accessToken", authResponse.accessToken);
          localStorage.setItem("refreshToken", authResponse.refreshToken);
          
          const userData = {
            id: authResponse.userId,
            email: googleResponse.user.email,
            name: googleResponse.user.name,
            profileImage: googleResponse.user.picture,
            tipoUsuario: authResponse.tipoUsuario,
            googleAuth: true
          };
          
          localStorage.setItem("user", JSON.stringify(userData));
          
          // Si hay una función de inicio de sesión exitoso, la llamamos
          if (onLoginSuccess) {
            onLoginSuccess(userData);
          }
          
          setError({
            title: "Inicio de Sesión",
            message: "Ya tenías una cuenta con este correo electrónico. Has iniciado sesión correctamente.",
          });
        }
      } else {
        throw new Error("Error en la autenticación con el servidor.");
      }
    } catch (err) {
      console.error("Google registro error:", err);
      let errorMessage = "Error al registrarse con Google";
      
      if (err.message && err.message.includes("popup")) {
        errorMessage = "La ventana emergente fue bloqueada. Por favor, permite las ventanas emergentes para este sitio.";
        // Cambiar al modo de redirección después de un error de popup
        setGoogleButtonMode('redirect');
      } else if (err.message && err.message.includes("OAuth")) {
        errorMessage = "Error en la autenticación de Google. Intenta con el método alternativo.";
        setGoogleButtonMode('redirect');
      } else if (err.message && err.message.includes("disponible")) {
        errorMessage = "El servicio de Google no está disponible. Intenta con el método alternativo.";
        setGoogleButtonMode('redirect');
      }
      
      setError({
        title: "Error de Registro",
        message: errorMessage,
        retry: false,
        useAlternative: googleButtonMode !== 'redirect'
      });
    } finally {
      setLoading(false);
    }
  };

  // Función handleSubmit mejorada
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError({
        title: "Error de Validación",
        message: validationError,
      });
      setLoading(false);
      return;
    }

    try {
      // Creamos el payload base
      const payload = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password.trim(),
      };

      // Añadir información específica según el tipo de usuario
      if (formData.userType === "acompanante") {
        payload.gender = "otro"; // Campo requerido para acompañantes
      } else if (formData.userType === "agencia") {
        payload.name = formData.username.trim(); // Para agencias, name = username
      }

      // Usar las rutas correctas del nuevo backend según el tipo seleccionado
      let endpoint = '';
      switch (formData.userType) {
        case "cliente":
          endpoint = '/api/auth/register';
          break;
        case "acompanante":
          endpoint = '/api/auth/profile/register';
          break;
        case "agencia":
          endpoint = '/api/auth/agency/register';
          break;
        default:
          endpoint = '/api/auth/register';
      }

      // Agregar logs para debugging
      console.log(`Tipo de usuario seleccionado: ${formData.userType}`);
      console.log(`Endpoint seleccionado: ${endpoint}`);
      console.log(`Payload a enviar:`, payload);

      const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log("Respuesta de error:", errorData);
        if (response.status === 400) {
          throw new Error(
            errorData.Detail || errorData.Message || errorData.mensaje || errorData.message ||
            "Datos de registro inválidos. Verifique los campos obligatorios."
          );
        } else if (response.status === 409) {
          throw new Error("El correo electrónico o nombre de usuario ya está registrado.");
        } else if (response.status === 500) {
          throw new Error(
            "Error interno del servidor. Por favor, intenta de nuevo más tarde."
          );
        }
        throw new Error(
          `Error al registrar (Código: ${response.status})`
        );
      }

      const data = await response.json();
      console.log("Respuesta exitosa:", data);
      
      if (formData.userType === "cliente") {
        setError({
          title: "Registro Exitoso",
          message: `Cliente registrado con éxito. ID: ${data.userId || data.Id}. Por favor, inicia sesión.`,
        });
      } else if (formData.userType === "acompanante") {
        setError({
          title: "Registro Exitoso",
          message: `Acompañante registrado con éxito. ID: ${data.userId || data.profileId || data.AcompananteId}. Por favor, inicia sesión.`,
        });
      } else if (formData.userType === "agencia") {
        setError({
          title: "Solicitud Enviada",
          message: `Tu solicitud ha sido enviada con ID: ${data.userId || data.agencyId || data.solicitudId}. Está en proceso de revisión. Te notificaremos por email cuando haya sido procesada.`,
        });
      }
    } catch (err) {
      let errorMessage = err.message;
      if (err.message.includes("Failed to fetch")) {
        errorMessage =
          "No se pudo conectar con el servidor. Verifica que el backend esté corriendo en http://localhost:5000";
      }
      setError({
        title: "Error de Registro",
        message: errorMessage,
        retry: !errorMessage.includes("ya está registrado"),
      });
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    if (!error?.title.includes("Error")) {
      if (error?.title === "Inicio de Sesión" || error?.title === "Registro Exitoso") {
        // Si se registró e inició sesión con Google o solo inició sesión, ir a homepage
        if (setMenu) setMenu("homepage");
        else if (onClose) onClose();
      } else if (formData.userType === "agencia") {
        if (setMenu) setMenu("mainpage");
        else if (onClose) onClose();
      } else {
        if (setMenu) setMenu("login");
        else if (onClose) onClose();
      }
    }
    setError(null);
  };

  const retrySubmit = () => {
    if (error?.title === "Error de Registro" && error?.message?.includes("Google")) {
      handleGoogleLogin();
    } else {
      handleSubmit({ preventDefault: () => {} });
    }
  };

  const useAlternativeMethod = () => {
    try {
      setGoogleButtonMode('redirect');
      googleAuthService.signInWithRedirect();
    } catch (err) {
      console.error("Error en redirección de Google:", err);
      setError({
        title: "Error de Redirección",
        message: "No se pudo iniciar el proceso de autenticación con Google.",
      });
    }
  };

  const containerClass = `registro-container ${transitionDirection || ''}`;
  const formClass = `registro-form ${transitionDirection || !shouldAnimate ? 'no-enter-exit' : ''}`;

  return createPortal(
    <div className={containerClass}>
      <div className="registro-right" onClick={handleBackdropClick}>
        <form className={formClass} onSubmit={handleSubmit}>
          <div className={`registro-fields-side ${transitionDirection || ''}`}>
            <div className="registro-account-container">
              <label className="registro-account-label">Tipo de cuenta:</label>
              <div className="registro-toggle">
                <input
                  type="radio"
                  name="userType"
                  value="cliente"
                  id="sizeCliente"
                  checked={formData.userType === "cliente"}
                  onChange={handleUserTypeChange}
                />
                <label htmlFor="sizeCliente">Cliente</label>
                <input
                  type="radio"
                  name="userType"
                  value="acompanante"
                  id="sizeAcompanante"
                  checked={formData.userType === "acompanante"}
                  onChange={handleUserTypeChange}
                />
                <label htmlFor="sizeAcompanante">Acompañante</label>
                <input
                  type="radio"
                  name="userType"
                  value="agencia"
                  id="sizeAgencia"
                  checked={formData.userType === "agencia"}
                  onChange={handleUserTypeChange}
                />
                <label htmlFor="sizeAgencia">Agencia</label>
              </div>
            </div>
            <div className="registro-fields-container">
              {googleButtonMode === 'rendered' ? (
                <div id="google-button-container" ref={googleButtonContainerRef} className="google-button-container"></div>
              ) : (
                <div className="google-button-container">
                  <button
                    type="button"
                    className="google-button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    ref={googleButtonRef}
                  >
                    <GoogleIcon />
                    {googleButtonMode === 'redirect' ? "Continuar con Google (Redirección)" : "Continuar con Google"}
                  </button>
                </div>
              )}
              
              <div className="or-divider">o</div>
              
              <div className="registro-input-box">
                <input
                  type="text"
                  name="username"
                  required
                  value={formData.username}
                  onChange={handleInputChange}
                  className={`form-control ${formData.username ? "filled" : ""}`}
                  disabled={loading}
                />
                <label>Nombre de Usuario</label>
                <FaUser className="input-icon" aria-hidden="true" />
              </div>
              
              <div className="registro-input-box">
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`form-control ${formData.email ? "filled" : ""}`}
                  disabled={loading}
                />
                <label>Correo Electrónico</label>
                <FaEnvelope className="input-icon" aria-hidden="true" />
              </div>
              <div className="registro-input-box">
                <input
                  type="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`form-control ${formData.password ? "filled" : ""}`}
                  disabled={loading}
                />
                <label>Contraseña</label>
                <FaLock className="input-icon" aria-hidden="true" />
              </div>
              <div className="registro-fire-container">
                <div id="registro-fire-particles"></div>
                <button
                  type="submit"
                  className="registro-fire-button"
                  disabled={loading}
                >
                  {loading ? "Registrando..." : "Regístrate"}
                </button>
              </div>
              <div className="registro-footer">
                ¿Ya tienes cuenta?
                <button type="button" onClick={() => setMenu("login")}>
                  Inicia Sesión
                </button>
              </div>
            </div>
          </div>
          <div className={`registro-logo-side ${transitionDirection || ''}`}>
            <button
              className="registro-back-button"
              onClick={handleClose}
              type="button"
              aria-label="Volver"
            >
              <FaArrowLeft size={16} />
            </button>
            <div className="registro-logo-container">
              <img src={loginImage} alt="Logo" className="registro-logo-image" />
            </div>
            <p className="registro-subtitle">Ingresa tus datos para crear tu cuenta en Telo Fundi</p>
            <div className="registro-shape registro-shape-1"></div>
            <div className="registro-shape registro-shape-2"></div>
            <div className="registro-shape registro-shape-3"></div>
          </div>
        </form>
        {error && (
          <div className="registro-modal">
            <div className="registro-modal-content">
              <h3>{error.title}</h3>
              <p>{error.message}</p>
              <div className="registro-modal-buttons">
                {error.retry && (
                  <button onClick={retrySubmit} className="registro-modal-button">
                    Reintentar
                  </button>
                )}
                {error.useAlternative && (
                  <button onClick={useAlternativeMethod} className="registro-modal-button">
                    Método alternativo
                  </button>
                )}
                <button onClick={closeModal} className="registro-modal-button">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.getElementById("modal-root") || document.body
  );
};

export default Registro;