import { useState, useEffect } from "react";
import "../estilos/login.css";
import { FaUser, FaLock, FaEye, FaEyeSlash, FaArrowLeft } from 'react-icons/fa';
import loginImage from '../assets/logo png.png';
import axios from 'axios';

const Login = ({ setMenu, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailTooltip, setEmailTooltip] = useState('');
  const [passwordTooltip, setPasswordTooltip] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const forbiddenChars = /['";#=/*\\%&_|^<>()\[\]\-]/;

  const handleEmailChange = (e) => {
    const value = e.target.value;
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post('https://api.loveconnect.com/auth/login', {
        email,
        password
      });

      const { token, user } = response.data;
      localStorage.setItem('token', token);
      setSuccess('Inicio de sesión exitoso');
      onLoginSuccess(user);
      setTimeout(() => setMenu('homepage'), 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
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

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="input-box">
          <input
            type="email"
            required
            value={email}
            onChange={handleEmailChange}
            className={`form-control ${email ? 'filled' : ''}`}
            disabled={loading}
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
              disabled={loading}
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
            {loading ? 'Cargando...' : 'Iniciar Sesión'}
          </button>
        </div>

        <div className="login-footer">
          ¿Aún no tienes cuenta?
          <button type="button" onClick={() => setMenu("registro")}>
            ¡Regístrate!
          </button>
        </div>
      </form>
    </div>
  );
};

export default Login;