import { useState, useEffect } from "react";
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

const Registro = (props) => {
  // Estados para los campos del formulario
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [nombre, setNombre] = useState("");
  const [nombreAgencia, setNombreAgencia] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [direccion, setDireccion] = useState("");
  const [pais, setPais] = useState(null);
  const [ciudad, setCiudad] = useState("");
  const [phone, setPhone] = useState("");
  const [genero, setGenero] = useState(null);
  const [edad, setEdad] = useState("");
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState("acompanante");
  const [formVisible, setFormVisible] = useState(true);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Opciones para el select de países
  const [countries, setCountries] = useState([]);

  // Opciones para el select de género
  const genderOptions = [
    { value: "masculino", label: "Masculino" },
    { value: "femenino", label: "Femenino" },
    { value: "otro", label: "Otro" },
    { value: "prefiero_no_decir", label: "Prefiero no decir" },
  ];

  // Efecto inicial
  useEffect(() => {
    const options = countryList().getData();
    setCountries(options);

    const fireContainer = document.getElementById("registro-fire-particles");
    if (fireContainer) {
      fireContainer.innerHTML = "";
      createParticles(fireContainer, 40, 25);
    }
  }, []);

  const createParticles = (container, num, leftSpacing) => {
    for (let i = 0; i < num; i += 1) {
      let particle = document.createElement("div");
      particle.style.left = `calc((100%) * ${i / leftSpacing})`;
      particle.setAttribute("class", "registro-particle");
      particle.style.animationDelay = 3 * Math.random() + 0.5 + "s";
      particle.style.animationDuration = 3 * Math.random() + 2 + "s";
      container.appendChild(particle);
    }
  };

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
        setEdad("");
        setDescripcion("");
        setDireccion("");
      } else if (e.target.value === "acompanante") {
        setNickname("");
        setNombreAgencia("");
        setDescripcion("");
        setDireccion("");
      } else if (e.target.value === "agencia") {
        setNickname("");
        setNombre("");
        setPhone("");
        setGenero(null);
        setEdad("");
      }
      setTimeout(() => setFormVisible(true), 50);
    }, 300);
  };

  const validateForm = () => {
    // Validación más estricta para email
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email.trim())) {
      return "Por favor, ingrese un correo electrónico válido (ejemplo: user@domain.com).";
    }
    if (!password || password.trim().length < 6) {
      return "La contraseña debe tener al menos 6 caracteres.";
    }

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validaciones en el frontend
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
      if (userType === "cliente") {
        const payload = {
          Email: email.trim(),
          Password: password.trim(),
          Nickname: nickname ? nickname.trim() : undefined,
        };
        console.log("Enviando payload:", payload);
        const response = await fetch(
          "https://localhost:7134/api/clientes/registro",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.log("Respuesta de error:", errorData);
          if (response.status === 400) {
            throw new Error(
              errorData.Detail ||
                "Datos de registro inválidos. Verifica que el correo sea válido y la contraseña tenga al menos 6 caracteres."
            );
          } else if (response.status === 409) {
            throw new Error(
              errorData.Detail || "El correo electrónico ya está registrado."
            );
          } else if (response.status === 500) {
            throw new Error(
              errorData.Detail ||
                "Error interno del servidor. Por favor, intenta de nuevo más tarde."
            );
          }
          throw new Error(
            `Error al registrar cliente (Código: ${response.status})`
          );
        }

        const data = await response.json();
        setError({
          title: "Registro Exitoso",
          message: `Cliente registrado con éxito. ID: ${data.Id}. Por favor, inicia sesión.`,
        });
      } else if (userType === "acompanante") {
        const payload = {
          Email: email.trim(),
          Password: password.trim(),
          NombrePerfil: nombre.trim(),
          Genero: genero?.value,
          Edad: parseInt(edad),
          Ciudad: ciudad ? ciudad.trim() : undefined,
          Pais: pais?.label,
          WhatsApp: phone ? phone.trim() : undefined,
        };
        console.log("Enviando payload:", payload);
        const response = await fetch(
          "https://localhost:7134/api/Acompanantes/registro",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.log("Respuesta de error:", errorData);
          if (response.status === 400) {
            throw new Error(
              errorData.Message ||
                "Datos de registro inválidos. Verifica los campos obligatorios (correo, contraseña, nombre de perfil, género, edad)."
            );
          } else if (response.status === 500) {
            throw new Error(
              errorData.Message ||
                "Error interno del servidor. Por favor, intenta de nuevo más tarde."
            );
          }
          throw new Error(
            `Error al registrar acompañante (Código: ${response.status})`
          );
        }

        const data = await response.json();
        setError({
          title: "Registro Exitoso",
          message: `Acompañante registrado con éxito. ID: ${data.AcompananteId}. Por favor, inicia sesión.`,
        });
      } else if (userType === "agencia") {
        const payload = {
          Nombre: nombreAgencia.trim(),
          Email: email.trim(),
          Password: password.trim(),
          Descripcion: descripcion.trim(),
          Ciudad: ciudad.trim(),
          Pais: pais?.label,
          Direccion: direccion.trim(),
        };
        console.log("Enviando payload:", payload);
        const response = await fetch(
          "https://localhost:7134/api/Agencia/solicitar-registro",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.log("Respuesta de error:", errorData);
          if (response.status === 400) {
            throw new Error(
              errorData.mensaje ||
                "Datos de solicitud inválidos. Verifica los campos obligatorios (nombre, correo, contraseña, descripción, ciudad, país, dirección)."
            );
          } else if (response.status === 500) {
            throw new Error(
              errorData.mensaje ||
                "Error interno del servidor. Por favor, intenta de nuevo más tarde."
            );
          }
          throw new Error(
            `Error al enviar solicitud de agencia (Código: ${response.status})`
          );
        }

        const data = await response.json();
        setError({
          title: "Solicitud Enviada",
          message: `Tu solicitud ha sido enviada con ID: ${data.solicitudId}. Está en proceso de revisión. Te notificaremos por email cuando haya sido procesada.`,
        });
      }
    } catch (err) {
      let errorMessage = err.message;
      if (err.message.includes("Failed to fetch")) {
        errorMessage =
          "No se pudo conectar con el servidor. Verifica que el backend esté corriendo en https://localhost:7134 y que CORS esté configurado para permitir solicitudes desde tu frontend (por ejemplo, http://localhost:3000).";
      }
      setError({
        title: "Error de Registro",
        message: errorMessage,
        retry: !errorMessage.includes("ya está registrado"), // No reintentar si es un error de duplicado
      });
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    if (!error?.title.includes("Error")) {
      props.setMenu(userType === "agencia" ? "mainpage" : "login");
    }
    setError(null);
  };

  const retrySubmit = () => {
    handleSubmit({ preventDefault: () => {} });
  };

  return (
    <div className="login-right">
      <form
        className={`registro-form ${userType}-form`}
        onSubmit={handleSubmit}
      >
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

        <h2 className="registro-title">Crea tu cuenta</h2>
        <p className="registro-subtitle">Ingresa tus datos para registrarte</p>

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

        <div
          className={`registro-fields-container ${
            formVisible ? "visible" : "hidden"
          }`}
        >
          {/* Email */}
          <div className="registro-input-box">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`form-control ${email ? "filled" : ""}`}
            />
            <label>Correo Electrónico:</label>
            <FaEnvelope className="input-icon" aria-hidden="true" />
          </div>

          {userType === "cliente" && (
            <>
              {/* Nickname */}
              <div className="registro-input-box">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className={`form-control ${nickname ? "filled" : ""}`}
                />
                <label>Apodo:</label>
                <FaUser className="input-icon" aria-hidden="true" />
              </div>
            </>
          )}

          {userType !== "cliente" && (
            <>
              {/* Nombre o NombreAgencia */}
              <div className="registro-input-box">
                <input
                  type="text"
                  required
                  value={userType === "acompanante" ? nombre : nombreAgencia}
                  onChange={(e) =>
                    userType === "acompanante"
                      ? setNombre(e.target.value)
                      : setNombreAgencia(e.target.value)
                  }
                  className={`form-control ${
                    (userType === "acompanante" ? nombre : nombreAgencia)
                      ? "filled"
                      : ""
                  }`}
                />
                <label>
                  {userType === "acompanante"
                    ? "Nombre de Perfil:"
                    : "Nombre de la Agencia:"}
                </label>
                {userType === "acompanante" ? (
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
                  value={pais}
                  onChange={setPais}
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
                  required={userType === "agencia"}
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  className={`form-control ${ciudad ? "filled" : ""}`}
                />
                <label>Ciudad:</label>
                <FaCity className="input-icon" aria-hidden="true" />
              </div>

              {userType === "acompanante" && (
                <>
                  {/* Teléfono */}
                  <div className="registro-phone-container">
                    <label className="registro-phone-label">
                      Número de teléfono:
                    </label>
                    <FaPhoneAlt
                      className="registro-phone-icon"
                      aria-hidden="true"
                    />
                    <PhoneInput
                      country={"es"}
                      value={phone}
                      onChange={setPhone}
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
                      value={genero}
                      onChange={setGenero}
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
                      required
                      value={edad}
                      onChange={(e) => setEdad(e.target.value)}
                      className={`form-control ${edad ? "filled" : ""}`}
                      min="18"
                      max="99"
                    />
                    <label>Edad:</label>
                    <FaUser className="input-icon" aria-hidden="true" />
                  </div>
                </>
              )}

              {userType === "agencia" && (
                <>
                  {/* Descripción */}
                  <div className="registro-input-box">
                    <input
                      type="text"
                      required
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      className={`form-control ${descripcion ? "filled" : ""}`}
                    />
                    <label>Descripción:</label>
                    <FaInfoCircle className="input-icon" aria-hidden="true" />
                  </div>

                  {/* Dirección */}
                  <div className="registro-input-box">
                    <input
                      type="text"
                      required
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                      className={`form-control ${direccion ? "filled" : ""}`}
                    />
                    <label>Dirección:</label>
                    <FaMapMarkerAlt className="input-icon" aria-hidden="true" />
                  </div>
                </>
              )}
            </>
          )}

          {/* Password */}
          <div className="registro-input-box">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`form-control ${password ? "filled" : ""}`}
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
            <button type="button" onClick={() => props.setMenu("login")}>
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
