import { useState } from "react";
import { FaUser, FaLock, FaChevronDown } from 'react-icons/fa';
import PasswordStrengthBar from 'react-password-strength-bar';
import "../estilos/registr.css";

const Registro = (props) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");

  const handleTipoCuentaClick = () => {
    // Puedes mostrar un dropdown o cambiar un estado aquí
    console.log("Seleccionar tipo de cuenta");
  };

  return (
    <div className="login-container">
      <div className="login-right">
        <form className="login-form">
          <h2 className="login-title">Crea tu cuenta</h2>
          <p className="login-subtitle">Ingresa tus datos para registrarte</p>

          {/* EMAIL */}
          <div className="input-box">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`form-control ${email ? 'filled' : ''}`}
            />
            <label>Correo Electrónico:</label>
            <FaUser className="input-icon" />
          </div>

          {/* PASSWORD */}
          <div className="input-box">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`form-control ${password ? 'filled' : ''}`}
            />
            <label>Contraseña:</label>
            <FaLock className="input-icon" />
          </div>

          {/* PASSWORD STRENGTH */}
          <div style={{ marginTop: "-10px", marginBottom: "20px" }}>
            <PasswordStrengthBar
              password={password}
              scoreWords={["Un tollo de clave", "mmg", "ta jevi", "sipi", "Muy duro"]}
              shortScoreWord="Muy débil"
            />
          </div>

          {/* NUEVO LABEL CON EFECTO Y ÍCONO */}
          <div className="custom-label" onClick={handleTipoCuentaClick}>
            <label htmlFor="tipoCuenta">Seleccione su tipo de cuenta:</label>
            <FaChevronDown className="label-icon" />
          </div>

          <button className="login-button">Regístrate</button>

          <div className="login-footer">
            ¿Ya tienes cuenta?
            <button onClick={() => props.setMenu("login")}>
              Inicia Sesión!
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Registro;
