import { useState } from "react";
import { FaUser, FaLock, FaArrowLeft } from 'react-icons/fa';
import PasswordStrengthBar from 'react-password-strength-bar';
import "../estilos/registr.css";

const Registro = (props) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState("weight"); // Estado para el tipo de cuenta

  const handleRadioChange = (e) => {
    setUserType(e.target.value); // Actualiza el estado con el valor seleccionado
  };

  return (

      <div className="login-right">
        <form className="login-form">
          {/* Botón de flecha */}
          <button 
            className="back-button" 
            onClick={() => props.setMenu("mainpage")} // Redirige a la página principal
            type="button"
          >
            <FaArrowLeft size={24} />
          </button>
          
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
              scoreWords={["Muy débil", "Débil", "Pasable", "Segura", "Muy Segura!"]}
              shortScoreWord="Muy débil"
            />
          </div>

          {/* SOLO UN LABEL CON EFECTO HOVER */}
          <div className="custom-label">
            <label>Seleccione su tipo de cuenta:</label>
          </div>

          {/* TOGGLE BUTTONS */}
          <fieldset>
            <div className="toggle">
              <input
                type="radio"
                name="userType"
                value="weight"
                id="sizeWeight"
                checked={userType === "weight"}
                onChange={handleRadioChange}
              />
              <label htmlFor="sizeWeight">Agencia</label>

              <input
                type="radio"
                name="userType"
                value="dimensions"
                id="sizeDimensions"
                checked={userType === "dimensions"}
                onChange={handleRadioChange}
              />
              <label htmlFor="sizeDimensions">Usuario</label>
            </div>
          </fieldset>

          <button className="login-button">Regístrate</button>

          <div className="login-footer">
            ¿Ya tienes cuenta?
            <button onClick={() => props.setMenu("login")}>
              Inicia Sesión!
            </button>
          </div>
        </form>
      </div>
  );
};

export default Registro;
