import { useState, useEffect } from "react";
import "../estilos/login.css";
import { FaUser, FaLock, FaEye, FaEyeSlash, FaArrowLeft } from 'react-icons/fa';
import loginImage from '../assets/logo png.png';

const Login = (props) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailTooltip, setEmailTooltip] = useState('');
  const [passwordTooltip, setPasswordTooltip] = useState('');

  const forbiddenChars = /['";#=/*\\%&_|^<>()\[\]\-]/;

  const handleEmailChange = (e) => {
    const value = e.target.value;
    console.log('Email input:', value); // Depuración
    if (forbiddenChars.test(value)) {
      setEmailTooltip('Esos caracteres no son admitidos');
      const filteredValue = value.replace(forbiddenChars, '');
      setEmail(filteredValue);
    } else {
      setEmailTooltip('');
      setEmail(value);
    }
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    console.log('Password input:', value); // Depuración
    if (forbiddenChars.test(value)) {
      setPasswordTooltip('Esos caracteres no son admitidos');
      const filteredValue = value.replace(forbiddenChars, '');
      setPassword(filteredValue);
    } else {
      setPasswordTooltip('');
      setPassword(value);
    }
  };

  useEffect(() => {
    if (emailTooltip || passwordTooltip) {
      const timer = setTimeout(() => {
        setEmailTooltip('');
        setPasswordTooltip('');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [emailTooltip, passwordTooltip]);

  const handlePasswordKeyUp = (e) => setIsCapsLockOn(e.getModifierState('CapsLock'));
  const handlePasswordBlur = () => setIsCapsLockOn(false);
  const togglePasswordVisibility = () => setShowPassword(prev => !prev);

  return (
    <div className="login-right">
      <form className="login-form">
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
          {emailTooltip && (
            <div className="input-tooltip">{emailTooltip}</div>
          )}
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
            {passwordTooltip && (
              <div className="input-tooltip">{passwordTooltip}</div>
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

        <div className="registro-button-container">
          <button
            type="button"
            id="confirm"
            className="registro-button"
          >
            Iniciar Sesión
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