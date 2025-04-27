import { useState, useEffect } from "react";
import "../estilos/login.css";
import { FaUser, FaLock, FaEye, FaEyeSlash, FaArrowLeft } from "react-icons/fa";
import loginImage from "../assets/logo png.png";

const Login = ({ setMenu, onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const forbiddenChars = /['";#=/*\\%&_|^<>()[\]-]/;

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

      // Assuming the backend returns user data with tipoUsuario
      const userData = {
        id: data.UserId || 1, // Adjust based on actual response
        email: email,
        tipoUsuario: data.TipoUsuario || "cliente", // Adjust based on actual response
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

  const closeModal = () => {
    if (error?.title === "Bienvenido") {
      setMenu("homepage");
    }
    setError(null);
  };

  const retrySubmit = () => {
    handleSubmit({ preventDefault: () => {} });
  };

  return (
    <div className="login-right">
      <form className="login-form" onSubmit={handleSubmit}>
        <button
          className="back-button"
          onClick={() => setMenu("mainpage")}
          type="button"
        >
          <FaArrowLeft size={20} />
        </button>

        <div className="login-title">
          <img src={loginImage} alt="Login" className="login-title-image" />
        </div>

        <div className="input-box">
          <input
            type="email"
            required
            value={email}
            onChange={handleEmailChange}
            className={`form-control ${email ? "filled" : ""}`}
            disabled={loading}
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
          />
            <label>Contraseña</label>
            <FaLock className="input-icon" />
            {isCapsLockOn && (
              <div className="caps-tooltip">Bloq Mayús activado</div>
            )}
          </div>
          <span className="toggle-password" onClick={togglePasswordVisibility}>
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </span>
        </div>

        <div className="forgot-password">
          <button type="button" onClick={() => setMenu("recuperar")}>
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
          <button type="button" onClick={() => setMenu("registro")}>
            ¡Regístrate!
          </button>
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
  );
};

export default Login;