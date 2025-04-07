import { useState } from "react";
import { motion } from "framer-motion";
import "../estilos/login.css";
import { FaUser, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';

const Login = (props) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleEmailChange = (e) => setEmail(e.target.value);
  const handlePasswordChange = (e) => setPassword(e.target.value);
  const handlePasswordKeyUp = (e) => setIsCapsLockOn(e.getModifierState('CapsLock'));
  const handlePasswordBlur = () => setIsCapsLockOn(false);
  const togglePasswordVisibility = () => setShowPassword(prev => !prev);

  return (
    <div className="login-container">
      <div className="login-right">
        <form className="login-form">
          <h2 className="login-title">Bienvenido de nuevo</h2>
          <p className="login-subtitle">Ingresa tus datos para continuar</p>

          <div className="input-box">
            <input
              type="email"
              required
              value={email}
              onChange={handleEmailChange}
              className={`form-control ${email ? 'filled' : ''}`}
            />
            <label>Correo Electrónico:</label>
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
                className={`form-control ${password ? 'filled' : ''}`}
              />
              <label>Contraseña:</label>
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
            <button type="button" onClick={() => props.setMenu("recuperar")}>
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <button className="login-button">Iniciar Sesión</button>

          <div className="login-footer">
            ¿Aún no tienes cuenta?
            <button type="button" onClick={() => props.setMenu("registro")}>
              ¡Regístrate!
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;