// src/components/GoogleAuthCallback.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import googleAuthService from "./googleAuthService";
import "../estilos/googleAuthCallback.css";

/**
 * Componente para manejar la redirección después de autenticación con Google
 */
const GoogleAuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const processGoogleRedirect = async () => {
      try {
        // Procesar los parámetros de la URL después de la redirección
        const result = await googleAuthService.handleRedirect();
        
        if (!result || !result.tokenId) {
          throw new Error("No se recibieron datos válidos de Google");
        }

        // Recuperar el tipo de usuario del almacenamiento
        const userType = localStorage.getItem("googleAuthUserType") || "cliente";
        localStorage.removeItem("googleAuthUserType");

        // Autenticar con nuestro backend
        const authResult = await googleAuthService.authenticateWithBackend(
          result.tokenId,
          userType
        );

        if (!authResult.success) {
          throw new Error("Error al autenticar con el servidor");
        }

        // Guardar la información necesaria en localStorage
        localStorage.setItem("accessToken", authResult.accessToken);
        localStorage.setItem("refreshToken", authResult.refreshToken);
        
        const userData = {
          id: authResult.userId,
          email: result.user.email,
          name: result.user.name,
          profileImage: result.user.picture,
          tipoUsuario: authResult.tipoUsuario,
          googleAuth: true,
          profileInfo: authResult.profileInfo
        };
        
        localStorage.setItem("user", JSON.stringify(userData));

        // Redirigir después de procesar
        setTimeout(() => {
          navigate(result.redirectPath || "/");
          window.location.reload(); // Recargar para aplicar los cambios de sesión
        }, 1000);
      } catch (err) {
        console.error("Error al procesar la redirección de Google:", err);
        setError(err.message || "Error al procesar la autenticación");
      } finally {
        setLoading(false);
      }
    };

    processGoogleRedirect();
  }, [navigate]);

  return (
    <div className="google-auth-callback">
      <div className="callback-container">
        {loading ? (
          <>
            <div className="spinner"></div>
            <h2>Procesando tu inicio de sesión...</h2>
            <p>Por favor, espera un momento mientras completamos el proceso.</p>
          </>
        ) : error ? (
          <>
            <div className="error-icon">❌</div>
            <h2>Error de autenticación</h2>
            <p>{error}</p>
            <button 
              className="redirect-button"
              onClick={() => navigate("/")}
            >
              Volver al inicio
            </button>
          </>
        ) : (
          <>
            <div className="success-icon">✓</div>
            <h2>¡Autenticación exitosa!</h2>
            <p>Serás redirigido automáticamente...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default GoogleAuthCallback;