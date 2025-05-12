import { useState } from "react";
import { FaEnvelope, FaArrowLeft } from "react-icons/fa";
import "../estilos/forgetpsw.css";
import loginImage from "../assets/logo png.png";

const ForgetPsw = ({ setMenu }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validación básica de email
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email.trim())) {
      setError({
        title: "Error de Validación",
        message: "Por favor, ingrese un correo electrónico válido."
      });
      setLoading(false);
      return;
    }

    try {
      // Realizar petición al endpoint de recuperación de contraseña
      const response = await fetch("http://localhost:5000/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Ocurrió un error al procesar la solicitud");
      }
      
      setSuccess(true);
      setError({
        title: "Solicitud Enviada",
        message: "Si la dirección existe, recibirás un correo con instrucciones para restablecer tu contraseña.",
      });
    } catch (error) {
      console.error("Error al enviar la solicitud:", error);
      
      let errorMessage = "No se pudo enviar el enlace de recuperación.";
      if (error.message.includes("Failed to fetch")) {
        errorMessage = "No se pudo conectar con el servidor. Verifica que el backend esté corriendo en http://localhost:5000";
      }
      
      setError({
        title: "Error",
        message: errorMessage,
        details: error.toString()
      });
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    if (success) {
      setMenu("login");
    }
    setError(null);
  };

  return (
    <div className="forget-password-container">
      <div className="forget-password-right">
        <div className="forget-password-form">
          {/* Lado izquierdo con logo y mensaje */}
          <div className="forget-password-left">
            <button
              className="forget-password-back-button"
              onClick={() => setMenu("login")} // Cambio aquí para volver a login en lugar de mainpage
              type="button"
              aria-label="Volver"
            >
              <FaArrowLeft size={16} />
            </button>
            
            <img src={loginImage} alt="Telo Fundi" className="forget-password-title-image" />
            
            <div className="forget-password-welcome">
              <h2>¿Olvidaste tu contraseña?</h2>
              <p>No te preocupes. Te enviaremos un enlace para restablecer tu contraseña.</p>
            </div>
            
            {/* Formas decorativas */}
            <div className="forget-password-shape forget-password-shape-1"></div>
            <div className="forget-password-shape forget-password-shape-2"></div>
            <div className="forget-password-shape forget-password-shape-3"></div>
          </div>
          
          {/* Lado derecho con formulario */}
          <div className="forget-password-right-form">
            <div className="forget-password-form-title">
              <h2>Recuperar Contraseña</h2>
              <p>Ingresa tu correo electrónico para recibir instrucciones</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="forget-password-input-box">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={handleEmailChange}
                  className={`form-control ${email ? "filled" : ""}`}
                  disabled={loading}
                />
                <label>Correo Electrónico</label>
                <FaEnvelope className="input-icon" />
              </div>

              <div className="forget-password-button-container">
                <button
                  type="submit"
                  className="forget-password-button"
                  disabled={loading}
                >
                  {loading ? "Enviando..." : "Enviar Enlace"}
                </button>
              </div>

              <div className="forget-password-footer">
                ¿Ya recordaste tu contraseña?
                <button type="button" onClick={() => setMenu("login")}>
                  Inicia Sesión
                </button>
              </div>
            </form>
          </div>
        </div>
        
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
                <button onClick={closeModal} className="registro-modal-button">
                  {success ? "Ir a Login" : "Cerrar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgetPsw;