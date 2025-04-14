import { useState, useEffect } from "react";
import { FaUser, FaLock, FaArrowLeft, FaEnvelope, FaPhone, FaBuilding, FaGlobe, FaVenusMars, FaCity } from 'react-icons/fa';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import Select from 'react-select';
import countryList from 'react-select-country-list';
import "../estilos/registr.css";
import loginImage from '../assets/logo png.png';

const Registro = (props) => {
  // Estados para los campos del formulario
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [nombreAgencia, setNombreAgencia] = useState("");
  const [pais, setPais] = useState(null);
  const [ciudad, setCiudad] = useState(""); // Nuevo estado para la ciudad
  const [phone, setPhone] = useState("");
  const [genero, setGenero] = useState(null);
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState("acompanante"); // Por defecto: acompañante
  const [formVisible, setFormVisible] = useState(true); // Estado para controlar la animación

  // Opciones para el select de países
  const [countries, setCountries] = useState([]);

  // Opciones para el select de género
  const genderOptions = [
    { value: 'masculino', label: 'Masculino' },
    { value: 'femenino', label: 'Femenino' },
    { value: 'otro', label: 'Otro' },
    { value: 'prefiero_no_decir', label: 'Prefiero no decir' }
  ];

  // Cargamos la lista de países e inicializamos el efecto de fuego
  useEffect(() => {
    const options = countryList().getData();
    setCountries(options);
    
    // Inicializar el efecto de fuego
    const fireContainer = document.getElementById("registro-fire-particles");
    if (fireContainer) {
      fireContainer.innerHTML = '';
      createParticles(fireContainer, 40, 25);
    }
  }, []);
  
  // Función para crear las partículas de fuego
  const createParticles = (container, num, leftSpacing) => {
    for (let i = 0; i < num; i += 1) {
      let particle = document.createElement("div");
      particle.style.left = `calc((100%) * ${i / leftSpacing})`;
      particle.setAttribute("class", "registro-particle");
      particle.style.animationDelay = (3 * Math.random() + 0.5) + "s";
      particle.style.animationDuration = (3 * Math.random() + 2) + "s";
      container.appendChild(particle);
    }
  };

  const handleRadioChange = (e) => {
    // Primero hacemos que el formulario se desvanezca
    setFormVisible(false);
    
    // Esperamos a que termine la animación antes de cambiar el tipo
    setTimeout(() => {
      setUserType(e.target.value);
      
      // Limpiar campos que no sean comunes entre los tipos
      if (e.target.value === "cliente") {
        setNombre("");
        setNombreAgencia("");
        setPais(null);
        setCiudad(""); // Limpiamos la ciudad también
        setPhone("");
        setGenero(null);
      }
      
      // Volvemos a mostrar el formulario con animación
      setTimeout(() => {
        setFormVisible(true);
      }, 50);
    }, 300); // Este tiempo debe coincidir con la duración de la animación CSS
  };

  return (
    <div className="login-right">
      <form className={`registro-form ${userType}-form`}>
        {/* Botón de flecha */}
        <button 
          className="registro-back-button" 
          onClick={() => props.setMenu("mainpage")}
          type="button"
        >
          <FaArrowLeft size={20} />
        </button>
        
        {/* Logo */}
        <div className="registro-logo-container">
          <img src={loginImage} alt="Logo" className="registro-logo-image" />
        </div>
        
        <h2 className="registro-title">Crea tu cuenta</h2>
        <p className="registro-subtitle">Ingresa tus datos para registrarte</p>

        {/* TIPO DE CUENTA */}
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

        {/* Campos de formulario con animación */}
        <div className={`registro-fields-container ${formVisible ? 'visible' : 'hidden'}`}>
          {/* EMAIL - común a todos los tipos */}
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

          {/* Campos específicos para Acompañante y Agencia */}
          {userType !== "cliente" && (
            <>
              {/* NOMBRE COMPLETO o NOMBRE DE AGENCIA según selección */}
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

              {/* PAÍS */}
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

              {/* CIUDAD - Nuevo campo */}
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

              {/* TELÉFONO */}
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

              {/* GÉNERO (solo para acompañantes) */}
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

          {/* PASSWORD - común a todos los tipos */}
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

          {/* BOTÓN DE REGISTRO */}
          <div className="registro-fire-container">
            <div id="registro-fire-particles"></div>
            <button
              type="button"
              className="registro-fire-button"
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