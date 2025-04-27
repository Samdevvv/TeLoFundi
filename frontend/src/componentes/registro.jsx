import { useState, useEffect, useMemo } from "react";
import {
  FaUser,
  FaLock,
  FaArrowLeft,
  FaEnvelope,
  FaBuilding,
  FaGlobe,
  FaVenusMars,
  FaCity,
  FaInfoCircle,
  FaMapMarkerAlt,
  FaPhoneAlt,
} from "react-icons/fa";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import Select from "react-select";
import countryList from "react-select-country-list";
import "../estilos/registr.css";
import loginImage from "../assets/logo png.png";

const Registro = ({ setMenu }) => {
  // Definimos el formulario como un único objeto para reducir re-renders
  const [formData, setFormData] = useState({
    email: "",
    nickname: "",
    nombre: "",
    nombreAgencia: "",
    descripcion: "",
    direccion: "",
    pais: null,
    ciudad: "",
    phone: "",
    genero: null,
    edad: "",
    password: "",
    userType: "acompanante",
  });

  // Manejo de UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Memoizar las opciones de país para no recrearlas en cada render
  const countries = useMemo(() => countryList().getData(), []);
  
  // Opciones de género - no dependen del estado, las definimos fuera del componente
  const genderOptions = [
    { value: "masculino", label: "Masculino" },
    { value: "femenino", label: "Femenino" },
    { value: "otro", label: "Otro" },
    { value: "prefiero_no_decir", label: "Prefiero no decir" },
  ];

  // Efecto para crear partículas de fuego - solo se ejecuta una vez
  useEffect(() => {
    const fireContainer = document.getElementById("registro-fire-particles");
    if (fireContainer) {
      createParticles(fireContainer, 25, 15); // Reducido el número de partículas
    }
  }, []);

  const createParticles = (container, num, leftSpacing) => {
    container.innerHTML = ""; // Limpia el contenedor
    for (let i = 0; i < num; i += 1) {
      const particle = document.createElement("div");
      particle.style.left = `calc((100%) * ${i / leftSpacing})`;
      particle.setAttribute("class", "registro-particle");
      // Optimizamos la duración y retraso de animación para mejor rendimiento
      particle.style.animationDelay = (2 * Math.random() + 0.5) + "s";
      particle.style.animationDuration = (2 * Math.random() + 2) + "s";
      container.appendChild(particle);
    }
  };

  // Manejador unificado para cambios en inputs simples
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Manejador específico para cambio de tipo de usuario
  const handleUserTypeChange = (e) => {
    const newUserType = e.target.value;
    
    // Reseteamos los campos específicos según el tipo de usuario
    let updatedFormData = { ...formData, userType: newUserType };
    
    if (newUserType === "cliente") {
      updatedFormData = {
        ...updatedFormData,
        nombre: "",
        nombreAgencia: "",
        pais: null,
        ciudad: "",
        phone: "",
        genero: null,
        edad: "",
        descripcion: "",
        direccion: "",
      };
    } else if (newUserType === "acompanante") {
      updatedFormData = {
        ...updatedFormData,
        nickname: "",
        nombreAgencia: "",
        descripcion: "",
        direccion: "",
      };
    } else if (newUserType === "agencia") {
      updatedFormData = {
        ...updatedFormData,
        nickname: "",
        nombre: "",
        phone: "",
        genero: null,
        edad: "",
      };
    }
    
    setFormData(updatedFormData);
  };

  // Valida el formulario y retorna error si existe
  const validateForm = () => {
    const { 
      email, password, userType, nombre, genero, edad,
      nombreAgencia, descripcion, ciudad, pais, direccion 
    } = formData;
    
    // Validación de email
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email.trim())) {
      return "Por favor, ingrese un correo electrónico válido (ejemplo: user@domain.com).";
    }
    
    // Validación de contraseña
    if (!password || password.trim().length < 6) {
      return "La contraseña debe tener al menos 6 caracteres.";
    }

    // Validaciones específicas por tipo de usuario
    if (userType === "acompanante") {
      if (!nombre || !nombre.trim())
        return "El nombre de perfil es obligatorio.";
      if (!genero) return "Por favor, seleccione un género.";
      if (!edad || isNaN(edad) || edad < 18 || edad > 99) {
        return "La edad debe ser un número entre 18 y 99.";
      }
    } else if (userType === "agencia") {
      if (!nombreAgencia || !nombreAgencia.trim())
        return "El nombre de la agencia es obligatorio.";
      if (!descripcion || !descripcion.trim())
        return "La descripción es obligatoria.";
      if (!ciudad || !ciudad.trim()) return "La ciudad es obligatoria.";
      if (!pais) return "Por favor, seleccione un país.";
      if (!direccion || !direccion.trim())
        return "La dirección es obligatoria.";
    }

    return null;
  };

  // Maneja el envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validaciones
    const validationError = validateForm();
    if (validationError) {
      setError({
        title: "Error de Validación",
        message: validationError,
      });
      setLoading(false);
      return;
    }

    try {
      // Preparamos el payload para la API según el tipo de usuario
      const preparePayload = () => {
        const { 
          email, password, userType, nombre, genero, edad,
          ciudad, pais, phone, nickname, nombreAgencia, descripcion, direccion 
        } = formData;
        
        if (userType === "cliente") {
          return {
            Email: email.trim(),
            Password: password.trim(),
            Nickname: nickname ? nickname.trim() : undefined,
          };
        } else if (userType === "acompanante") {
          return {
            Email: email.trim(),
            Password: password.trim(),
            NombrePerfil: nombre.trim(),
            Genero: genero?.value,
            Edad: parseInt(edad),
            Ciudad: ciudad ? ciudad.trim() : undefined,
            Pais: pais?.label,
            WhatsApp: phone ? phone.trim() : undefined,
          };
        } else if (userType === "agencia") {
          return {
            Nombre: nombreAgencia.trim(),
            Email: email.trim(),
            Password: password.trim(),
            Descripcion: descripcion.trim(),
            Ciudad: ciudad.trim(),
            Pais: pais?.label,
            Direccion: direccion.trim(),
          };
        }
      };
      
      const payload = preparePayload();
      console.log("Enviando payload:", payload);
      
      // Definimos la URL según el tipo de usuario
      const getUrl = () => {
        switch (formData.userType) {
          case "cliente": return "https://localhost:7134/api/clientes/registro";
          case "acompanante": return "https://localhost:7134/api/Acompanantes/registro";
          case "agencia": return "https://localhost:7134/api/Agencia/solicitar-registro";
          default: return "";
        }
      };
      
      const url = getUrl();
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Manejo de respuestas de error
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log("Respuesta de error:", errorData);
        
        // Mensajes de error personalizados según status y tipo de usuario
        if (response.status === 400) {
          throw new Error(
            errorData.Detail || errorData.Message || errorData.mensaje ||
            "Datos de registro inválidos. Verifique los campos obligatorios."
          );
        } else if (response.status === 409) {
          throw new Error("El correo electrónico ya está registrado.");
        } else if (response.status === 500) {
          throw new Error(
            "Error interno del servidor. Por favor, intenta de nuevo más tarde."
          );
        }
        throw new Error(
          `Error al registrar (Código: ${response.status})`
        );
      }

      // Manejo de éxito
      const data = await response.json();
      
      // Mensajes de éxito según tipo de usuario
      if (formData.userType === "cliente") {
        setError({
          title: "Registro Exitoso",
          message: `Cliente registrado con éxito. ID: ${data.Id}. Por favor, inicia sesión.`,
        });
      } else if (formData.userType === "acompanante") {
        setError({
          title: "Registro Exitoso",
          message: `Acompañante registrado con éxito. ID: ${data.AcompananteId}. Por favor, inicia sesión.`,
        });
      } else if (formData.userType === "agencia") {
        setError({
          title: "Solicitud Enviada",
          message: `Tu solicitud ha sido enviada con ID: ${data.solicitudId}. Está en proceso de revisión. Te notificaremos por email cuando haya sido procesada.`,
        });
      }
    } catch (err) {
      let errorMessage = err.message;
      if (err.message.includes("Failed to fetch")) {
        errorMessage =
          "No se pudo conectar con el servidor. Verifica que el backend esté corriendo.";
      }
      setError({
        title: "Error de Registro",
        message: errorMessage,
        retry: !errorMessage.includes("ya está registrado"),
      });
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    if (!error?.title.includes("Error")) {
      setMenu(formData.userType === "agencia" ? "mainpage" : "login");
    }
    setError(null);
  };

  const retrySubmit = () => {
    handleSubmit({ preventDefault: () => {} });
  };

  // Renderizado optimizado con secciones condicionales
  return (
    <div className="registro-container">
      <form
        className={`registro-form ${formData.userType}-form`}
        onSubmit={handleSubmit}
      >
        <button
          className="registro-back-button"
          onClick={() => setMenu("mainpage")}
          type="button"
          aria-label="Volver"
        >
          <FaArrowLeft size={20} />
        </button>

        <div className="registro-header">
          <div className="registro-logo-container">
            <img src={loginImage} alt="Logo" className="registro-logo-image" />
          </div>
          <p className="registro-subtitle">Ingresa tus datos para registrarte</p>
        </div>

        <div className="registro-account-container">
          <label className="registro-account-label">Tipo de cuenta:</label>
          <div className="registro-toggle">
            <input
              type="radio"
              name="userType"
              value="cliente"
              id="sizeCliente"
              checked={formData.userType === "cliente"}
              onChange={handleUserTypeChange}
            />
            <label htmlFor="sizeCliente">Cliente</label>

            <input
              type="radio"
              name="userType"
              value="acompanante"
              id="sizeAcompanante"
              checked={formData.userType === "acompanante"}
              onChange={handleUserTypeChange}
            />
            <label htmlFor="sizeAcompanante">Acompañante</label>

            <input
              type="radio"
              name="userType"
              value="agencia"
              id="sizeAgencia"
              checked={formData.userType === "agencia"}
              onChange={handleUserTypeChange}
            />
            <label htmlFor="sizeAgencia">Agencia</label>
          </div>
        </div>

        <div className="registro-fields-container">
          {/* Email - Común para todos */}
          <div className="registro-input-box">
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleInputChange}
              className={`form-control ${formData.email ? "filled" : ""}`}
            />
            <label>Correo Electrónico:</label>
            <FaEnvelope className="input-icon" aria-hidden="true" />
          </div>

          {/* Campos específicos para CLIENTE */}
          {formData.userType === "cliente" && (
            <div className="registro-input-box">
              <input
                type="text"
                name="nickname"
                value={formData.nickname}
                onChange={handleInputChange}
                className={`form-control ${formData.nickname ? "filled" : ""}`}
              />
              <label>Apodo:</label>
              <FaUser className="input-icon" aria-hidden="true" />
            </div>
          )}

          {/* Campos específicos para ACOMPAÑANTE y AGENCIA */}
          {formData.userType !== "cliente" && (
            <>
              {/* Nombre o Nombre Agencia */}
              <div className="registro-input-box">
                <input
                  type="text"
                  name={formData.userType === "acompanante" ? "nombre" : "nombreAgencia"}
                  required
                  value={formData.userType === "acompanante" ? formData.nombre : formData.nombreAgencia}
                  onChange={handleInputChange}
                  className={`form-control ${
                    (formData.userType === "acompanante" ? formData.nombre : formData.nombreAgencia)
                      ? "filled"
                      : ""
                  }`}
                />
                <label>
                  {formData.userType === "acompanante"
                    ? "Nombre de Perfil:"
                    : "Nombre de la Agencia:"}
                </label>
                {formData.userType === "acompanante" ? (
                  <FaUser className="input-icon" aria-hidden="true" />
                ) : (
                  <FaBuilding className="input-icon" aria-hidden="true" />
                )}
              </div>

              {/* País */}
              <div className="registro-select-box">
                <label className="registro-select-label">País:</label>
                <FaGlobe className="registro-select-icon" aria-hidden="true" />
                <Select
                  value={formData.pais}
                  onChange={(selected) => 
                    setFormData(prev => ({ ...prev, pais: selected }))
                  }
                  options={countries}
                  placeholder="Seleccione su país"
                  className="registro-custom-select"
                  classNamePrefix="select"
                  menuPortalTarget={document.body}
                  styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                />
              </div>

              {/* Ciudad */}
              <div className="registro-input-box">
                <input
                  type="text"
                  name="ciudad"
                  required={formData.userType === "agencia"}
                  value={formData.ciudad}
                  onChange={handleInputChange}
                  className={`form-control ${formData.ciudad ? "filled" : ""}`}
                />
                <label>Ciudad:</label>
                <FaCity className="input-icon" aria-hidden="true" />
              </div>

              {/* Campos específicos para ACOMPAÑANTE */}
              {formData.userType === "acompanante" && (
                <>
                  {/* Teléfono */}
                  <div className="registro-phone-container">
                    <label className="registro-phone-label">Número de teléfono:</label>
                    <FaPhoneAlt
                      className="registro-phone-icon"
                      aria-hidden="true"
                    />
                    <PhoneInput
                      country={"es"}
                      value={formData.phone}
                      onChange={(value) => 
                        setFormData(prev => ({ ...prev, phone: value }))
                      }
                      inputClass="registro-phone-input"
                      containerClass="registro-phone-wrapper"
                      buttonClass="registro-phone-dropdown"
                      dropdownClass="registro-phone-dropdown-list"
                    />
                  </div>

                  {/* Género */}
                  <div className="registro-select-box">
                    <label className="registro-select-label">Género:</label>
                    <FaVenusMars
                      className="registro-select-icon"
                      aria-hidden="true"
                    />
                    <Select
                      value={formData.genero}
                      onChange={(selected) => 
                        setFormData(prev => ({ ...prev, genero: selected }))
                      }
                      options={genderOptions}
                      placeholder="Seleccione su género"
                      className="registro-custom-select"
                      classNamePrefix="select"
                      menuPortalTarget={document.body}
                      styles={{
                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                      }}
                    />
                  </div>

                  {/* Edad */}
                  <div className="registro-input-box">
                    <input
                      type="number"
                      name="edad"
                      required
                      value={formData.edad}
                      onChange={handleInputChange}
                      className={`form-control ${formData.edad ? "filled" : ""}`}
                      min="18"
                      max="99"
                    />
                    <label>Edad:</label>
                    <FaUser className="input-icon" aria-hidden="true" />
                  </div>
                </>
              )}

              {/* Campos específicos para AGENCIA */}
              {formData.userType === "agencia" && (
                <>
                  {/* Descripción */}
                  <div className="registro-input-box">
                    <input
                      type="text"
                      name="descripcion"
                      required
                      value={formData.descripcion}
                      onChange={handleInputChange}
                      className={`form-control ${formData.descripcion ? "filled" : ""}`}
                    />
                    <label>Descripción:</label>
                    <FaInfoCircle className="input-icon" aria-hidden="true" />
                  </div>

                  {/* Dirección */}
                  <div className="registro-input-box">
                    <input
                      type="text"
                      name="direccion"
                      required
                      value={formData.direccion}
                      onChange={handleInputChange}
                      className={`form-control ${formData.direccion ? "filled" : ""}`}
                    />
                    <label>Dirección:</label>
                    <FaMapMarkerAlt className="input-icon" aria-hidden="true" />
                  </div>
                </>
              )}
            </>
          )}

          {/* Password - Común para todos */}
          <div className="registro-input-box">
            <input
              type="password"
              name="password"
              required
              value={formData.password}
              onChange={handleInputChange}
              className={`form-control ${formData.password ? "filled" : ""}`}
            />
            <label>Contraseña:</label>
            <FaLock className="input-icon" aria-hidden="true" />
          </div>

          {/* Botón de Registro */}
          <div className="registro-fire-container">
            <div id="registro-fire-particles"></div>
            <button
              type="submit"
              className="registro-fire-button"
              disabled={loading}
            >
              {loading ? "Registrando..." : "Regístrate"}
            </button>
          </div>

          <div className="registro-footer">
            ¿Ya tienes cuenta?
            <button type="button" onClick={() => setMenu("login")}>
              Inicia Sesión
            </button>
          </div>
        </div>
      </form>

      {/* Modal de Error o Mensaje */}
      {error && (
        <div className="registro-modal">
          <div className="registro-modal-content">
            <h3>{error.title}</h3>
            <p>{error.message}</p>
            <div className="registro-modal-buttons">
              {error.retry && (
                <button onClick={retrySubmit} className="registro-modal-button">
                  Reintentar
                </button>
              )}
              <button onClick={closeModal} className="registro-modal-button">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Registro;