import { useState, useEffect } from "react";
import { FaUser, FaLock, FaArrowLeft, FaEnvelope, FaPhone, FaBuilding, FaGlobe, FaVenusMars, FaCity, FaComment, FaMapMarkerAlt, FaBirthdayCake } from 'react-icons/fa';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import Select from 'react-select';
import countryList from 'react-select-country-list';
import "../estilos/registr.css";
import loginImage from '../assets/logo png.png';
import axios from 'axios';

const Registro = ({ setMenu, onRegisterSuccess }) => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(""); // Campo corregido
  const [nombre, setNombre] = useState("");
  const [nombreAgencia, setNombreAgencia] = useState("");
  const [pais, setPais] = useState(null);
  const [ciudad, setCiudad] = useState("");
  const [phone, setPhone] = useState("");
  const [genero, setGenero] = useState(null);
  const [password, setPassword] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [direccion, setDireccion] = useState("");
  const [edad, setEdad] = useState("");
  const [userType, setUserType] = useState("cliente");
  const [formVisible, setFormVisible] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const [countries, setCountries] = useState([]);

  const genderOptions = [
    { value: 'masculino', label: 'Masculino' },
    { value: 'femenino', label: 'Femenino' },
    { value: 'otro', label: 'Otro' }
  ];

  useEffect(() => {
    const options = countryList().getData();
    setCountries(options);
  }, []);

  const handleRadioChange = (e) => {
    setFormVisible(false);
    setTimeout(() => {
      setUserType(e.target.value);
      if (e.target.value === "cliente" || e.target.value === "agencia") {
        setNombre("");
        setNombreAgencia("");
        setPais(null);
        setCiudad("");
        setPhone("");
        setGenero(null);
        setUsername("");
        setPassword("");
        setConfirmPassword(""); // Reiniciar confirmPassword
        setDescripcion("");
        setDireccion("");
        setEdad("");
      }
      setTimeout(() => {
        setFormVisible(true);
      }, 50);
    }, 300);
  };

  const handleEdadChange = (e) => {
    const value = e.target.value;
    if (value === "") {
      setEdad("");
      return;
    }
    if (/^\d{0,2}$/.test(value)) {
      const num = parseInt(value, 10);
      if (value.length === 1) {
        if (num >= 1 && num <= 9) {
          setEdad(value);
        }
      } else if (value.length === 2) {
        if (value[0] === "1" && (value[1] === "8" || value[1] === "9")) {
          setEdad(value);
        } else if (value[0] >= "2" && num >= 20 && num <= 98) {
          setEdad(value);
        }
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Validar que las contraseñas coincidan
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    const payload = {
      email,
      password,
      userType,
      ...(userType === "cliente" && { username }),
      ...(userType === "acompanante" && {
        nombre,
        phone,
        genero: genero?.value,
        edad: parseInt(edad),
        pais: pais?.label,
        ciudad
      }),
      ...(userType === "agencia" && {
        nombreAgencia,
        pais: pais?.label,
        ciudad,
        direccion,
        descripcion
      })
    };

    try {
      const response = await axios.post('https://api.loveconnect.com/auth/register', payload);
      setSuccess('Registro exitoso. Por favor, inicia sesión.');
      onRegisterSuccess();
      setTimeout(() => setMenu("login"), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-right">
      <form className={`registro-form ${userType}-form`} onSubmit={handleSubmit}>
        <button
          className="registro-back-button"
          onClick={() => setMenu("mainpage")}
          type="button"
        >
          <FaArrowLeft size={20} />
        </button>

        <div className="registro-logo-container">
          <img src={loginImage} alt="Logo" className="registro-logo-image" />
        </div>

        <p className="registro-subtitle">¿Qué esperas? Ingresa tus datos ahora y regístrate</p>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="registro-account-container">
          <label className="registro-account-label">Tipo de cuenta:</label>
          <div className="registro-toggle">
            <input
              type="radio"
              name="userType"
              value="cliente"
              id="sizeCliente"
              checked={userType === "cliente"}
              onChange={handleRadioChange}
              disabled={loading}
            />
            <label htmlFor="sizeCliente">Cliente</label>

            <input
              type="radio"
              name="userType"
              value="acompanante"
              id="sizeAcompanante"
              checked={userType === "acompanante"}
              onChange={handleRadioChange}
              disabled={loading}
            />
            <label htmlFor="sizeAcompanante">Acompañante</label>

            <input
              type="radio"
              name="userType"
              value="agencia"
              id="sizeAgencia"
              checked={userType === "agencia"}
              onChange={handleRadioChange}
              disabled={loading}
            />
            <label htmlFor="sizeAgencia">Agencia</label>
          </div>
        </div>

        <div className={`registro-fields-container ${formVisible ? 'visible' : 'hidden'}`}>
          {userType === "cliente" && (
            <>
              <div className="registro-input-box registro-input-email">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`form-control ${email ? 'filled' : ''}`}
                  disabled={loading}
                />
                <label>Correo Electrónico:</label>
                <FaEnvelope className="input-icon" />
              </div>

              <div className="registro-cliente-inputs">
                <div className="registro-input-box">
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={`form-control ${username ? 'filled' : ''}`}
                    disabled={loading}
                  />
                  <label>Usuario:</label>
                  <FaUser className="input-icon" />
                </div>

                <div className="registro-input-box">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`form-control ${password ? 'filled' : ''}`}
                    disabled={loading}
                  />
                  <label>Contraseña:</label>
                  <FaLock className="input-icon" />
                </div>

                <div className="registro-input-box">
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`form-control ${confirmPassword ? 'filled' : ''}`}
                    disabled={loading}
                  />
                  <label>Confirmar Contraseña:</label>
                  <FaLock className="input-icon" />
                </div>
              </div>
            </>
          )}

          {userType === "agencia" && (
            <>
              <div className="registro-input-row">
                <div className="registro-input-box">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`form-control ${email ? 'filled' : ''}`}
                    disabled={loading}
                  />
                  <label>Correo Electrónico:</label>
                  <FaEnvelope className="input-icon" />
                </div>

                <div className="registro-input-box">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`form-control ${password ? 'filled' : ''}`}
                    disabled={loading}
                  />
                  <label>Contraseña:</label>
                  <FaLock className="input-icon" />
                </div>
              </div>

              <div className="registro-input-row">
                <div className="registro-input-box">
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`form-control ${confirmPassword ? 'filled' : ''}`}
                    disabled={loading}
                  />
                  <label>Confirmar Contraseña:</label>
                  <FaLock className="input-icon" />
                </div>

                <div className="registro-input-box">
                  <input
                    type="text"
                    required
                    value={nombreAgencia}
                    onChange={(e) => setNombreAgencia(e.target.value)}
                    className={`form-control ${nombreAgencia ? 'filled' : ''}`}
                    disabled={loading}
                  />
                  <label>Nombre de la Agencia:</label>
                  <FaBuilding className="input-icon" />
                </div>
              </div>

              <div className="registro-input-row">
                <div className="registro-select-box">
                  <label className="registro-select-label">País:</label>
                  <FaGlobe className="registro-select-icon" />
                  <Select
                    value={pais}
                    onChange={setPais}
                    options={countries}
                    getOptionLabel={(option) => option.label}
                    placeholder="Seleccione su país"
                    className="registro-custom-select"
                    classNamePrefix="select"
                    menuPortalTarget={document.body}
                    styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                    isDisabled={loading}
                  />
                </div>

                <div className="registro-input-box">
                  <input
                    type="text"
                    required
                    value={ciudad}
                    onChange={(e) => setCiudad(e.target.value)}
                    className={`form-control ${ciudad ? 'filled' : ''}`}
                    disabled={loading}
                  />
                  <label>Ciudad:</label>
                  <FaCity className="input-icon" />
                </div>
              </div>

              <div className="registro-input-row">
                <div className="registro-input-box">
                  <input
                    type="text"
                    required
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    className={`form-control ${direccion ? 'filled' : ''}`}
                    disabled={loading}
                  />
                  <label>Dirección:</label>
                  <FaMapMarkerAlt className="input-icon" />
                </div>

                <div className="registro-input-box">
                  <input
                    type="text"
                    required
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    className={`form-control ${descripcion ? 'filled' : ''}`}
                    disabled={loading}
                  />
                  <label>Descripción:</label>
                  <FaComment className="input-icon" />
                </div>
              </div>
            </>
          )}

          {userType === "acompanante" && (
            <>
              <div className="registro-input-row">
                <div className="registro-input-box">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`form-control ${email ? 'filled' : ''}`}
                    disabled={loading}
                  />
                  <label>Correo Electrónico:</label>
                  <FaEnvelope className="input-icon" />
                </div>

                <div className="registro-input-box">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`form-control ${password ? 'filled' : ''}`}
                    disabled={loading}
                  />
                  <label>Contraseña:</label>
                  <FaLock className="input-icon" />
                </div>
              </div>

              <div className="registro-input-row">
                <div className="registro-input-box">
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`form-control ${confirmPassword ? 'filled' : ''}`}
                    disabled={loading}
                  />
                  <label>Confirmar Contraseña:</label>
                  <FaLock className="input-icon" />
                </div>

                <div className="registro-input-box">
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className={`form-control ${nombre ? 'filled' : ''}`}
                    disabled={loading}
                  />
                  <label>Nombre Completo:</label>
                  <FaUser className="input-icon" />
                </div>
              </div>

              <div className="registro-input-row">
                <div className="registro-input-box registro-phone-container">
                  <label className="registro-phone-label">Número de teléfono:</label>
                  <FaPhone className="registro-phone-icon" />
                  <PhoneInput
                    country={'es'}
                    value={phone}
                    onChange={setPhone}
                    inputClass="registro-phone-input"
                    containerClass="registro-phone-wrapper"
                    buttonClass="registro-phone-dropdown"
                    dropdownClass="registro-phone-dropdown-list"
                    disabled={loading}
                  />
                </div>

                <div className="registro-select-box">
                  <label className="registro-select-label">País:</label>
                  <FaGlobe className="registro-select-icon" />
                  <Select
                    value={pais}
                    onChange={setPais}
                    options={countries}
                    getOptionLabel={(option) => option.label}
                    placeholder="Seleccione su país"
                    className="registro-custom-select"
                    classNamePrefix="select"
                    menuPortalTarget={document.body}
                    styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                    isDisabled={loading}
                  />
                </div>
              </div>

              <div className="registro-input-row">
                <div className="registro-input-box">
                  <input
                    type="text"
                    required
                    value={ciudad}
                    onChange={(e) => setCiudad(e.target.value)}
                    className={`form-control ${ciudad ? 'filled' : ''}`}
                    disabled={loading}
                  />
                  <label>Ciudad:</label>
                  <FaCity className="input-icon" />
                </div>

                <div className="registro-select-box">
                  <label className="registro-select-label">Género:</label>
                  <FaVenusMars className="registro-select-icon" />
                  <Select
                    value={genero}
                    onChange={setGenero}
                    options={genderOptions}
                    getOptionLabel={(option) => option.label}
                    placeholder="Seleccione su género"
                    className="registro-custom-select"
                    classNamePrefix="select"
                    menuPortalTarget={document.body}
                    styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                    getOptionValue={(option) => option.value}
                    formatOptionLabel={(option) => (
                      <div data-value={option.value}>{option.label}</div>
                    )}
                    isDisabled={loading}
                  />
                </div>
              </div>

              <div className="registro-input-row">
                <div className="registro-input-box">
                  <input
                    type="text"
                    required
                    maxLength="2"
                    value={edad}
                    onChange={handleEdadChange}
                    className={`form-control ${edad ? 'filled' : ''}`}
                    disabled={loading}
                  />
                  <label>Edad (18-98):</label>
                  <FaBirthdayCake className="input-icon" />
                </div>
              </div>
            </>
          )}

          <div className="registro-button-container">
            <button type="submit" className="registro-button" disabled={loading}>
              {loading ? 'Cargando...' : 'Regístrate'}
            </button>
          </div>

          <div className="registro-footer">
            ¿Ya tienes cuenta?
            <button type="button" onClick={() => setMenu("login")} disabled={loading}>
              Inicia Sesión
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Registro;