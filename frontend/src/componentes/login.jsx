import { useState, useEffect } from "react";
import "../estilos/login.css";
import { FaUser, FaLock, FaEye, FaEyeSlash, FaArrowLeft } from "react-icons/fa";
import loginImage from "../assets/logo png.png";
import { createPortal } from "react-dom";
import googleAuthService from "./googleAuthService";

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

const Login = ({ setMenu, onLoginSuccess, onClose, transitionDirection }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(!transitionDirection);

  // Inicializar Google Auth cuando se monta el componente
  useEffect(() => {
    const initGoogleAuth = async () => {
      try {
        await googleAuthService.initialize();
        console.log("Google Auth inicializado correctamente");
      } catch (err) {
        console.error("Error al inicializar Google Auth:", err);
      }
    };

    initGoogleAuth();
  }, []);

  useEffect(() => {
    if (!document.getElementById("modal-root")) {
      const modalRoot = document.createElement("div");
      modalRoot.id = "modal-root";
      document.body.appendChild(modalRoot);
    }
    if (!transitionDirection) {
      setTimeout(() => setShouldAnimate(true), 100);
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

  const forbiddenChars = /['";#=/*\\%&_|^<>()[\]-]/;

  const handleBackdropClick = (e) => {
    if (e.target.className === 'login-right') {
      handleClose();
    }
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    if (forbiddenChars.test(value)) {
      setError({
        title: "Caracteres no permitidos",
        message: "El correo contiene caracteres no admitidos.",
      });
      const filteredValue = value.replace(forbiddenChars, "");
      setEmail(filteredValue);
    } else {
      setEmail(value);
    }
  };

  const handleClose = () => {
    const formElement = document.querySelector('.login-form');
    if (formElement) {
      formElement.classList.add('exit');
      setTimeout(() => {
        if (onClose) {
          onClose();
        } else if (setMenu) {
          setMenu("mainpage");
        }
      }, 300);
    } else {
      if (onClose) {
        onClose();
      } else if (setMenu) {
        setMenu("mainpage");
      }
    }
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    if (forbiddenChars.test(value)) {
      setError({
        title: "Caracteres no permitidos",
        message: "La contraseña contiene caracteres no admitidos.",
      });
      const filteredValue = value.replace(forbiddenChars, "");
      setPassword(filteredValue);
    } else {
      setPassword(value);
    }
  };

  useEffect(() => {
    if (error && error.title === "Caracteres no permitidos") {
      const timer = setTimeout(() => setError(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handlePasswordKeyUp = (e) =>
    setIsCapsLockOn(e.getModifierState("CapsLock"));
  const handlePasswordBlur = () => setIsCapsLockOn(false);
  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);
  const handleRememberMeChange = (e) => setRememberMe(e.target.checked);

  const validateForm = () => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email.trim())) {
      return "Por favor, ingrese un correo electrónico válido.";
    }
    if (!password || password.trim().length < 6) {
      return "La contraseña debe tener al menos 6 caracteres.";
    }
    return null;
  };

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
      const payload = {
        email: email.trim(),
        password: password.trim(),
        rememberMe: rememberMe
      };

      // Usar la nueva API
      const response = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Error de respuesta:", errorData);
        
        if (response.status === 400) {
          throw new Error(
            errorData.message || "Datos de inicio de sesión inválidos."
          );
        } else if (response.status === 401) {
          throw new Error(
            errorData.message || "Credenciales inválidas."
          );
        } else {
          throw new Error(
            `Error al iniciar sesión (Código: ${response.status}) - ${errorData.message || "Error desconocido"}`
          );
        }
      }

      const data = await response.json();
      localStorage.setItem("accessToken", data.AccessToken || data.accessToken);
      localStorage.setItem("refreshToken", data.RefreshToken || data.refreshToken);

      const userData = {
        id: data.UserId || data.userId,
        email: email,
        tipoUsuario: data.TipoUsuario || data.role,
        profileInfo: data.ProfileInfo || data.profileInfo
      };
      
      localStorage.setItem("user", JSON.stringify(userData));
      
      if (onLoginSuccess) {
        onLoginSuccess(userData);
      }

      setError({
        title: "Bienvenido",
        message: "Inicio de sesión exitoso. ¡Bienvenido de vuelta!",
      });
    } catch (err) {
      let errorMessage = err.message;
      console.error("Error completo:", err);
      
      if (err.message.includes("Failed to fetch")) {
        errorMessage =
          "No se pudo conectar con el servidor. Verifica que el backend esté corriendo en http://localhost:5000";
      }
      
      setError({
        title: "Error de Inicio de Sesión",
        message: errorMessage,
        retry: true,
        details: err.toString()
      });
    } finally {
      setLoading(false);
    }
  };

  // Función simplificada para iniciar sesión con Google usando siempre redirección
  const handleGoogleLogin = () => {
    if (googleLoading) return;
    
    try {
      setGoogleLoading(true);
      setError(null);
      
      console.log("Iniciando sesión con Google (modo redirección)...");
      
      // Guardar el tipo de usuario para recuperarlo después de la redirección
      localStorage.setItem("googleAuthUserType", "cliente");
      
      // Usar directamente la redirección sin intentar popup
      googleAuthService.signInWithRedirect();
      
      // No necesitamos más código aquí ya que la redirección nos sacará de la página
    } catch (err) {
      console.error("Error en redirección de Google:", err);
      
      setError({
        title: "Error de Inicio de Sesión",
        message: "No se pudo iniciar el proceso de autenticación con Google.",
        details: err.toString()
      });
      
      setGoogleLoading(false);
    }
  };

  const closeModal = () => {
    if (error?.title === "Bienvenido") {
      if (setMenu) {
        setMenu("homepage");
      } else if (onClose) {
        onClose();
      }
    }
    setError(null);
  };

  const retrySubmit = () => {
    handleSubmit({ preventDefault: () => {} });
  };

  const containerClass = `login-container ${transitionDirection || ''}`;
  const formClass = `login-form ${transitionDirection || !shouldAnimate ? 'no-enter-exit' : ''}`;

  return createPortal(
    <div className={containerClass}>
      <div className="login-right" onClick={handleBackdropClick}>
        <form className={formClass} onSubmit={handleSubmit}>
          <div className={`login-left ${transitionDirection || ''}`}>
            <button
              className="back-button"
              onClick={handleClose}
              type="button"
              aria-label="Volver"
            >
              <FaArrowLeft size={16} />
            </button>
            <img src={loginImage} alt="Telo Fundi" className="login-title-image" />
            <div className="login-welcome">
              <h2>¡Bienvenido de nuevo!</h2>
              <p>Inicia sesión para acceder a tu cuenta y descubrir los mejores servicios personalizados para ti.</p>
            </div>
            <div className="shape shape-1"></div>
            <div className="shape shape-2"></div>
            <div className="shape shape-3"></div>
          </div>
          <div className={`login-right-form ${transitionDirection || ''}`}>
            <div className="form-title">
              <h2>Iniciar Sesión</h2>
              <p>Completa los datos para acceder a tu cuenta</p>
            </div>
            
            <div className="google-button-container">
              <button
                type="button"
                className="google-button"
                onClick={handleGoogleLogin}
                disabled={loading || googleLoading}
              >
                <GoogleIcon />
                {googleLoading ? "Procesando..." : "Continuar con Google"}
              </button>
            </div>
            
            <div className="or-divider">o</div>
            <div className="input-box">
              <input
                type="email"
                required
                value={email}
                onChange={handleEmailChange}
                className={`form-control ${email ? "filled" : ""}`}
                disabled={loading}
                style={{ color: "#ffffff" }}
              />
              <label>Correo Electrónico</label>
              <FaUser className="input-icon" />
            </div>
            <div className="password-wrapper">
              <div className="input-box password-box">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={handlePasswordChange}
                  onKeyUp={handlePasswordKeyUp}
                  onBlur={handlePasswordBlur}
                  className={`form-control ${password ? "filled" : ""}`}
                  disabled={loading}
                  style={{ color: "#ffffff" }}
                />
                <label>Contraseña</label>
                <FaLock className="input-icon" />
                {isCapsLockOn && (
                  <div className="caps-tooltip">Bloq Mayús activado</div>
                )}
                <span 
                  className="toggle-password" 
                  onClick={togglePasswordVisibility}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>
            </div>
            <div className="remember-me">
              <input 
                type="checkbox" 
                id="rememberMe" 
                checked={rememberMe} 
                onChange={handleRememberMeChange} 
              />
              <label htmlFor="rememberMe">Recordarme</label>
            </div>
            <div className="forgot-password">
              <button type="button" onClick={() => setMenu && setMenu("recuperar")}>
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <div className="registro-button-container">
              <button
                type="submit"
                id="confirm"
                className="registro-button"
                disabled={loading}
              >
                {loading ? "Cargando..." : "Iniciar Sesión"}
              </button>
            </div>
            <div className="login-footer">
              ¿Aún no tienes cuenta?
              <button type="button" onClick={() => setMenu && setMenu("registro")}>
                ¡Regístrate!
              </button>
            </div>
          </div>
        </form>
        {error && (
          <div className="registro-modal">
            <div className="registro-modal-content">
              <h3>{error.title}</h3>
              <p>{error.message}</p>
              {error.details && (
                <div className="error-details">
                  <p className="error-details-title">Detalles técnicos:</p>
                  <pre className="error-details-content">{error.details}</pre>
                </div>
              )}
              <div className="registro-modal-buttons">
                {error.retry && (
                  <button onClick={retrySubmit} className="registro-modal-button">
                    Reintentar
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

export default Login;