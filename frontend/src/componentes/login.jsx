import { useState, useEffect } from "react";
import "../estilos/login.css";
import "../estilos/fireButton.css";
import { FaUser, FaLock, FaEye, FaEyeSlash, FaArrowLeft } from 'react-icons/fa';
import loginImage from '../assets/logo png.png';

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

  useEffect(() => {
    const fireContainer = document.getElementById("fire-container");
    if (fireContainer) {
      fireContainer.innerHTML = '';
      createParticles(fireContainer, 40, 25);
    }
  }, []);

  const createParticles = (container, num, leftSpacing) => {
    for (let i = 0; i < num; i += 1) {
      let particle = document.createElement("div");
      particle.style.left = `calc((100%) * ${i / leftSpacing})`;
      particle.setAttribute("class", "particle");
      particle.style.animationDelay = (3 * Math.random() + 0.5) + "s";
      particle.style.animationDuration = (3 * Math.random() + 2) + "s";
      container.appendChild(particle);
    }
  };

  return (
    <div className="login-right">
      <form className="login-form">
        {/* Botón de flecha ahora está dentro del form con position: absolute */}
        <button
          className="back-button"
          onClick={() => props.setMenu("mainpage")}
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
            className={`form-control ${email ? 'filled' : ''}`}
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
              className={`form-control ${password ? 'filled' : ''}`}
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
          <button type="button" onClick={() => props.setMenu("recuperar")}>
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        <div className="fire-button-container">
          <div id="fire-container"></div>
          <button
            type="button"
            id="confirm"
            className="fire-button"
          >
            <span className="texto-inicar">Iniciar Sesión</span>
          </button>
        </div>

        <div className="login-footer">
          ¿Aún no tienes cuenta?
          <button type="button" onClick={() => props.setMenu("registro")}>
            ¡Regístrate!
          </button>
        </div>
      </form>
    </div>
  );
};

export default Login;