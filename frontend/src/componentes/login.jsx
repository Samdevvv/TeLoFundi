import { useState, useEffect } from "react";
import "../estilos/login.css";
import { FaUser, FaLock, FaEye, FaEyeSlash, FaArrowLeft } from "react-icons/fa";
import loginImage from "../assets/logo png.png";
import { createPortal } from "react-dom"; // Importamos createPortal

// Icono de Google para el botón de inicio de sesión
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

const Login = ({ setMenu, onLoginSuccess, onClose }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [animated, setAnimated] = useState(false);

  // Creamos un elemento div para el portal si no existe
  useEffect(() => {
    // Verificar si ya existe el elemento modal-root
    if (!document.getElementById("modal-root")) {
      const modalRoot = document.createElement("div");
      modalRoot.id = "modal-root";
      document.body.appendChild(modalRoot);
    }
    
    return () => {
      // Opcional: limpiar el elemento si ya no se necesita
      // En una aplicación real, es posible que quieras mantenerlo para reutilizarlo
    };
  }, []);

  useEffect(() => {
    // Activar animación después de un breve retraso
    const timer = setTimeout(() => {
      setAnimated(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Salvamos la posición actual del scroll para restaurarla después
    const scrollY = window.scrollY;
    
    // Añadimos clase modal-open al body
    document.body.classList.add('modal-open');
    
    // En lugar de bloquear completamente el scroll, mantenemos la posición visual
    // pero evitamos el desplazamiento mientras el modal está abierto
    document.body.style.overflow = 'hidden';
    document.body.style.top = `-${scrollY}px`;
    
    // Cuando el componente se desmonta, eliminar la clase y restaurar el scroll
    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
      document.body.style.top = '';
      // Restauramos la posición del scroll
      window.scrollTo(0, scrollY);
    };
  }, []);

  // Añadimos un manejador para la tecla Escape
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    
    document.addEventListener('keydown', handleEscKey);
    
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, []);

  const forbiddenChars = /['";#=/*\\%&_|^<>()[\]-]/;

  const handleBackdropClick = (e) => {
    // Solo cerrar si se hace clic exactamente en el contenedor login-right
    // y no en sus hijos
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
          onClose(); // Usar onClose si está disponible
        } else if (setMenu) {
          setMenu("mainpage"); // Compatibilidad con código existente
        }
      }, 300); // Duración de la animación
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
        Email: email.trim(),
        Password: password.trim(),
        RememberMe: rememberMe
      };

      const response = await fetch("https://localhost:7134/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 400) {
          throw new Error(
            errorData.Message || "Email o contraseña incorrectos."
          );
        } else if (response.status === 401) {
          throw new Error("Credenciales inválidas.");
        } else {
          throw new Error(
            `Error al iniciar sesión (Código: ${response.status})`
          );
        }
      }

      const data = await response.json();
      localStorage.setItem("accessToken", data.AccessToken);
      localStorage.setItem("refreshToken", data.RefreshToken);

      const userData = {
        id: data.UserId || 1,
        email: email,
        tipoUsuario: data.TipoUsuario || "cliente",
      };
      localStorage.setItem("user", JSON.stringify(userData));
      onLoginSuccess(userData);

      setError({
        title: "Bienvenido",
        message: "Inicio de sesión exitoso. ¡Bienvenido de vuelta!",
      });
    } catch (err) {
      let errorMessage = err.message;
      if (err.message.includes("Failed to fetch")) {
        errorMessage =
          "No se pudo conectar con el servidor. Verifica tu conexión.";
      }
      setError({
        title: "Error de Inicio de Sesión",
        message: errorMessage,
        retry: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Aquí implementarías la lógica de inicio de sesión con Google
    // Por ahora, mostraremos un mensaje de que está en desarrollo
    setError({
      title: "Función en Desarrollo",
      message: "El inicio de sesión con Google estará disponible próximamente.",
    });
  };

  const closeModal = () => {
    if (error?.title === "Bienvenido") {
      if (setMenu) {
        setMenu("homepage");
      } else if (onClose) {
        onClose();
        // Aquí podrías navegar programáticamente a homepage si es necesario
      }
    }
    setError(null);
  };

  const retrySubmit = () => {
    handleSubmit({ preventDefault: () => {} });
  };

  // Clase base para el contenedor
  const containerClass = "login-container";
  
  // Utilizamos createPortal para renderizar el modal en el nodo específico
  return createPortal(
    <div className={containerClass}>
      <div className="login-right" onClick={handleBackdropClick}>
        <form className="login-form" onSubmit={handleSubmit}>
          {/* Lado izquierdo con logo y mensaje de bienvenida */}
          <div className="login-left">
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
            
            {/* Formas decorativas */}
            <div className="shape shape-1"></div>
            <div className="shape shape-2"></div>
            <div className="shape shape-3"></div>
          </div>
          
          {/* Lado derecho con formulario */}
          <div className="login-right-form">
            <div className="form-title">
              <h2>Iniciar Sesión</h2>
              <p>Completa los datos para acceder a tu cuenta</p>
            </div>

            {/* Botón de Google */}
            <div className="google-button-container">
              <button
                type="button"
                className="google-button"
                onClick={handleGoogleLogin}
              >
                <GoogleIcon />
                Continuar con Google
              </button>
            </div>

            {/* Separador */}
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
    document.getElementById("modal-root") || document.body // Fallback a document.body si no existe modal-root
  );
};

export default Login;