import { useState, useEffect } from "react";
import { FaUser, FaLock, FaArrowLeft, FaEnvelope, FaPhone, FaBuilding, FaGlobe, FaVenusMars, FaCity } from 'react-icons/fa';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import Select from 'react-select';
import countryList from 'react-select-country-list';
import "../estilos/registr.css";
import loginImage from '../assets/logo png.png';

const Registro = (props) => {
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [nombreAgencia, setNombreAgencia] = useState("");
  const [pais, setPais] = useState(null);
  const [ciudad, setCiudad] = useState("");
  const [phone, setPhone] = useState("");
  const [genero, setGenero] = useState(null);
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState("cliente");
  const [formVisible, setFormVisible] = useState(true);

  const [countries, setCountries] = useState([]);

  const genderOptions = [
    { value: 'masculino', label: 'Masculino' },
    { value: 'femenino', label: 'Femenino' },
    { value: 'otro', label: 'Otro' },
    { value: 'prefiero_no_decir', label: 'Prefiero no decir' }
  ];

  useEffect(() => {
    const options = countryList().getData();
    setCountries(options);
  }, []);

  const handleRadioChange = (e) => {
    setFormVisible(false);
    setTimeout(() => {
      setUserType(e.target.value);
      if (e.target.value === "cliente") {
        setNombre("");
        setNombreAgencia("");
        setPais(null);
        setCiudad("");
        setPhone("");
        setGenero(null);
      }
      setTimeout(() => {
        setFormVisible(true);
      }, 50);
    }, 300);
  };

  return (
    <div className="login-right">
      <form className={`registro-form ${userType}-form`}>
        <button 
          className="registro-back-button" 
          onClick={() => props.setMenu("mainpage")}
          type="button"
        >
          <FaArrowLeft size={20} />
        </button>
        
        <div className="registro-logo-container">
          <img src={loginImage} alt="Logo" className="registro-logo-image" />
        </div>
        
        <p className="registro-subtitle">¿Qué esperas? Ingresa tus datos ahora y registrate</p>

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
            />
            <label htmlFor="sizeCliente">Cliente</label>

            <input
              type="radio"
              name="userType"
              value="acompanante"
              id="sizeAcompanante"
              checked={userType === "acompanante"}
              onChange={handleRadioChange}
            />
            <label htmlFor="sizeAcompanante">Acompañante</label>
            
            <input
              type="radio"
              name="userType"
              value="agencia"
              id="sizeAgencia"
              checked={userType === "agencia"}
              onChange={handleRadioChange}
            />
            <label htmlFor="sizeAgencia">Agencia</label>
          </div>
        </div>

        <div className={`registro-fields-container ${formVisible ? 'visible' : 'hidden'}`}>
          <div className="registro-input-box">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`form-control ${email ? 'filled' : ''}`}
            />
            <label>Correo Electrónico:</label>
            <FaEnvelope className="input-icon" />
          </div>

          {userType !== "cliente" && (
            <>
              <div className="registro-input-box">
                <input
                  type="text"
                  required
                  value={userType === "acompanante" ? nombre : nombreAgencia}
                  onChange={(e) => userType === "acompanante" ? setNombre(e.target.value) : setNombreAgencia(e.target.value)}
                  className={`form-control ${(userType === "acompanante" ? nombre : nombreAgencia) ? 'filled' : ''}`}
                />
                <label>{userType === "acompanante" ? "Nombre Completo:" : "Nombre de la Agencia:"}</label>
                {userType === "acompanante" ? <FaUser className="input-icon" /> : <FaBuilding className="input-icon" />}
              </div>

              <div className="registro-select-box">
                <label className="registro-select-label">País:</label>
                <FaGlobe className="registro-select-icon" />
                <Select
                  value={pais}
                  onChange={setPais}
                  options={countries}
                  placeholder="Seleccione su país"
                  className="registro-custom-select"
                  classNamePrefix="select"
                  menuPortalTarget={document.body}
                  styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                />
              </div>

              <div className="registro-input-box">
                <input
                  type="text"
                  required
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  className={`form-control ${ciudad ? 'filled' : ''}`}
                />
                <label>Ciudad:</label>
                <FaCity className="input-icon" />
              </div>

              <div className="registro-phone-container">
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
                />
              </div>

              {userType === "acompanante" && (
                <div className="registro-select-box">
                  <label className="registro-select-label">Género:</label>
                  <FaVenusMars className="registro-select-icon" />
                  <Select
                    value={genero}
                    onChange={setGenero}
                    options={genderOptions}
                    placeholder="Seleccione su género"
                    className="registro-custom-select"
                    classNamePrefix="select"
                    menuPortalTarget={document.body}
                    styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                  />
                </div>
              )}
            </>
          )}

          <div className="registro-input-box">
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

          <div className="registro-button-container">
            <button
              type="button"
              className="registro-button"
            >
              Regístrate
            </button>
          </div>

          <div className="registro-footer">
            ¿Ya tienes cuenta?
            <button type="button" onClick={() => props.setMenu("login")}>
              Inicia Sesión
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Registro;