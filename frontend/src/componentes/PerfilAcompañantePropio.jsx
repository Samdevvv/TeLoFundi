import React, { useState, useEffect } from 'react';
import { FaMapMarkerAlt, FaCalendarAlt, FaUser, FaEnvelope, FaPhone, FaGlobe, FaInstagram, FaTwitter, FaFacebook, FaCheckCircle, FaPhoneAlt, FaWhatsapp, FaEdit } from 'react-icons/fa';
import '../estilos/PerfilAcompañante.css';
import '../estilos/Header.css';
import Header from './Header';
import defaultProfilePic from '../assets/publicacion.jpg';

const PerfilAcompanantePropio = ({ userData = {}, onUpdateProfile }) => {
  const [activeTab, setActiveTab] = useState('informacion');
  const [isEditing, setIsEditing] = useState(false);
  const [isOwnProfile] = useState(true);

  const defaultData = {
    acompanante: {
      nombre: "Rosse Tejada",
      ubicacion: "Republica Dominicana, Santo Domingo",
      fotoPerfil: defaultProfilePic,
      edad: 28,
      genero: "Femenino",
      descripcion: "Hola, soy Rosse. Me encanta viajar y conocer nuevas culturas. Soy una acompañante profesional con experiencia en eventos sociales y corporativos.",
      telefono: "+34 612 345 678",
      email: "rosse@example.com",
      fechaRegistro: "Enero 2023",
      servicios: ["Eventos sociales", "Cenas de negocios", "Turismo"],
      disponibilidad: "Lunes a Sábado",
      idiomas: ["Español", "Inglés", "Francés"],
      redes: {
        instagram: "rosse_tejada",
        twitter: "rosset",
        facebook: "rossetejada"
      },
      publicaciones: [
        { imagen: defaultProfilePic, descripcion: "Disfrutando de un evento social en Santo Domingo. ¡Contáctame para más detalles!" },
        { imagen: defaultProfilePic, descripcion: "Cena de negocios en un restaurante exclusivo. ¿Te gustaría acompañarme?" }
      ],
      verificado: true,
      agenciaVerificadora: "Élite Acompañantes"
    }
  };

  // Ensure userData has a valid structure or use default
  const profileData = userData && userData.nombre ? userData : defaultData.acompanante;
  
  // Ensure all array properties are initialized as arrays
  const safeProfileData = {
    ...profileData,
    idiomas: Array.isArray(profileData.idiomas) ? profileData.idiomas : [],
    servicios: Array.isArray(profileData.servicios) ? profileData.servicios : [],
    publicaciones: Array.isArray(profileData.publicaciones) ? profileData.publicaciones : [],
    redes: profileData.redes || { instagram: '', twitter: '', facebook: '' }
  };

  const [formData, setFormData] = useState(safeProfileData);

  useEffect(() => {
    // Update formData when userData changes, ensuring safe values
    const updatedProfileData = userData && userData.nombre ? userData : defaultData.acompanante;
    const updatedSafeProfileData = {
      ...updatedProfileData,
      idiomas: Array.isArray(updatedProfileData.idiomas) ? updatedProfileData.idiomas : [],
      servicios: Array.isArray(updatedProfileData.servicios) ? updatedProfileData.servicios : [],
      publicaciones: Array.isArray(updatedProfileData.publicaciones) ? updatedProfileData.publicaciones : [],
      redes: updatedProfileData.redes || { instagram: '', twitter: '', facebook: '' }
    };
    setFormData(updatedSafeProfileData);
  }, [userData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleRedesChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, redes: { ...formData.redes, [name]: value } });
  };

  const handleSubmit = () => {
    onUpdateProfile && onUpdateProfile(formData);
    setIsEditing(false);
  };

  const whatsappNumber = formData.telefono ? formData.telefono.replace(/\D/g, '') : '';
  const whatsappLink = `https://wa.me/${whatsappNumber}`;

  return (
    <div className="perfil-container">
      <Header />
      <div className="perfil-content">
        <div className="perfil-header">
          <div className="perfil-foto-container">
            <img
              src={formData.fotoPerfil || defaultProfilePic}
              alt={formData.nombre || "Perfil"}
              className="perfil-foto"
            />
            {isEditing && (
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFormData({ ...formData, fotoPerfil: URL.createObjectURL(e.target.files[0]) })}
                className="perfil-foto-upload"
              />
            )}
          </div>
          <div className="perfil-info-header">
            <div className="perfil-name-buttons">
              {isEditing ? (
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre || ""}
                  onChange={handleInputChange}
                  className="perfil-edit-input"
                />
              ) : (
                <h1>{formData.nombre || ""}</h1>
              )}
              {isOwnProfile && (
                <button
                  className="btn-editar-perfil"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <FaEdit /> {isEditing ? 'Cancelar' : 'Editar Perfil'}
                </button>
              )}
            </div>
            <div className="perfil-verification">
              <FaCheckCircle className={formData.verificado ? "verified-icon" : "unverified-icon"} />
              <span>{formData.verificado ? "Perfil Verificado" : "Perfil No Verificado"}</span>
              {formData.verificado && formData.agenciaVerificadora && (
                <span className="agencia-verificadora"> por {formData.agenciaVerificadora}</span>
              )}
            </div>
            <p className="perfil-ubicacion">
              <FaMapMarkerAlt />
              {isEditing ? (
                <input
                  type="text"
                  name="ubicacion"
                  value={formData.ubicacion || ""}
                  onChange={handleInputChange}
                  className="perfil-edit-input"
                />
              ) : (
                formData.ubicacion || ""
              )}
            </p>
            <div className="perfil-contact-icons">
              {formData.redes?.instagram && (
                <a href={`https://instagram.com/${formData.redes.instagram}`} target="_blank" rel="noopener noreferrer">
                  <FaInstagram className="contact-icon instagram" />
                </a>
              )}
              {formData.telefono && (
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  <FaWhatsapp className="contact-icon whatsapp" />
                </a>
              )}
            </div>
            <div className="perfil-datos-rapidos">
              <span><FaUser /> {isEditing ? (
                <input
                  type="number"
                  name="edad"
                  value={formData.edad || ""}
                  onChange={handleInputChange}
                  className="perfil-edit-input"
                />
              ) : formData.edad || ""} años</span>
              <span>{isEditing ? (
                <input
                  type="text"
                  name="genero"
                  value={formData.genero || ""}
                  onChange={handleInputChange}
                  className="perfil-edit-input"
                />
              ) : formData.genero || ""}</span>
              <span><FaGlobe /> {isEditing ? (
                <input
                  type="text"
                  name="idiomas"
                  value={formData.idiomas?.join(', ') || ""}
                  onChange={(e) => setFormData({ ...formData, idiomas: e.target.value.split(', ').filter(lang => lang.trim()) })}
                  className="perfil-edit-input"
                />
              ) : (formData.idiomas?.length > 0 ? formData.idiomas.join(', ') : 'No especificado')}</span>
            </div>
          </div>
        </div>

        <div className="perfil-tabs">
          <button
            className={`perfil-tab ${activeTab === 'publicaciones' ? 'active' : ''}`}
            onClick={() => setActiveTab('publicaciones')}
          >
            Publicaciones
          </button>
          <button
            className={`perfil-tab ${activeTab === 'informacion' ? 'active' : ''}`}
            onClick={() => setActiveTab('informacion')}
          >
            Información
          </button>
        </div>

        <div className="perfil-tab-content">
          {activeTab === 'publicaciones' && (
            <div className="perfil-publicaciones">
              {formData.publicaciones?.map((publicacion, index) => (
                <div className="perfil-publicacion-item" key={index}>
                  <img src={publicacion.imagen || defaultProfilePic} alt={`Publicación ${index + 1}`} />
                  <div className="publicacion-descripcion">
                    <p>{publicacion.descripcion || ""}</p>
                    <button className="btn-contacto-publicacion">
                      <FaPhoneAlt /> Contactar
                    </button>
                  </div>
                </div>
              ))}
              {(!formData.publicaciones || formData.publicaciones.length === 0) && (
                <div>No hay publicaciones disponibles</div>
              )}
            </div>
          )}

          {activeTab === 'informacion' && (
            <div className="perfil-informacion">
              <div className="perfil-seccion perfil-sobre-mi">
                <h3>Sobre Mí</h3>
                {isEditing ? (
                  <textarea
                    name="descripcion"
                    value={formData.descripcion || ""}
                    onChange={handleInputChange}
                    className="perfil-edit-textarea"
                  />
                ) : (
                  <p>{formData.descripcion || ""}</p>
                )}
              </div>

              <div className="perfil-seccion perfil-detalles">
                <h3>Detalles</h3>
                <div className="perfil-detalles-content">
                  <div className="perfil-detalle-item">
                    <span className="detalle-label">Disponibilidad:</span>
                    {isEditing ? (
                      <input
                        type="text"
                        name="disponibilidad"
                        value={formData.disponibilidad || ""}
                        onChange={handleInputChange}
                        className="perfil-edit-input"
                      />
                    ) : (
                      <span>{formData.disponibilidad || "No especificado"}</span>
                    )}
                  </div>
                  <div className="perfil-detalle-item">
                    <span className="detalle-label">Idiomas:</span>
                    {isEditing ? (
                      <input
                        type="text"
                        name="idiomas"
                        value={formData.idiomas?.join(', ') || ""}
                        onChange={(e) => setFormData({ ...formData, idiomas: e.target.value.split(', ').filter(lang => lang.trim()) })}
                        className="perfil-edit-input"
                      />
                    ) : (
                      <span>{formData.idiomas?.length > 0 ? formData.idiomas.join(', ') : 'No especificado'}</span>
                    )}
                  </div>
                  <div className="perfil-detalle-item">
                    <span className="detalle-label">Servicios:</span>
                    {isEditing ? (
                      <input
                        type="text"
                        name="servicios"
                        value={formData.servicios?.join(', ') || ""}
                        onChange={(e) => setFormData({ ...formData, servicios: e.target.value.split(', ').filter(serv => serv.trim()) })}
                        className="perfil-edit-input"
                      />
                    ) : (
                      <ul className="perfil-servicios-list">
                        {formData.servicios?.map((servicio, index) => (
                          <li key={index}>{servicio}</li>
                        ))}
                        {(!formData.servicios || formData.servicios.length === 0) && (
                          <li>No hay servicios especificados</li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <div className="perfil-seccion perfil-contacto">
                <h3>Información de Contacto</h3>
                <div className="perfil-contacto-info">
                  {isEditing ? (
                    <>
                      <div className="perfil-contacto-item">
                        <FaEnvelope className="perfil-contacto-icon" />
                        <input
                          type="email"
                          name="email"
                          value={formData.email || ""}
                          onChange={handleInputChange}
                          className="perfil-edit-input"
                        />
                      </div>
                      <div className="perfil-contacto-item">
                        <FaPhone className="perfil-contacto-icon" />
                        <input
                          type="text"
                          name="telefono"
                          value={formData.telefono || ""}
                          onChange={handleInputChange}
                          className="perfil-edit-input"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {formData.email && (
                        <div className="perfil-contacto-item">
                          <FaEnvelope className="perfil-contacto-icon" />
                          <span>{formData.email}</span>
                        </div>
                      )}
                      {formData.telefono && (
                        <div className="perfil-contacto-item">
                          <FaPhone className="perfil-contacto-icon" />
                          <span>{formData.telefono}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {formData.redes && (
                <div className="perfil-seccion perfil-redes">
                  <h3>Redes Sociales</h3>
                  {isEditing ? (
                    <div className="perfil-redes-sociales">
                      <input
                        type="text"
                        name="instagram"
                        value={formData.redes?.instagram || ""}
                        onChange={handleRedesChange}
                        placeholder="Instagram"
                        className="perfil-edit-input"
                      />
                      <input
                        type="text"
                        name="twitter"
                        value={formData.redes?.twitter || ""}
                        onChange={handleRedesChange}
                        placeholder="Twitter"
                        className="perfil-edit-input"
                      />
                      <input
                        type="text"
                        name="facebook"
                        value={formData.redes?.facebook || ""}
                        onChange={handleRedesChange}
                        placeholder="Facebook"
                        className="perfil-edit-input"
                      />
                    </div>
                  ) : (
                    <div className="perfil-redes-sociales">
                      {formData.redes?.instagram && (
                        <a href={`https://instagram.com/${formData.redes.instagram}`} target="_blank" rel="noopener noreferrer">
                          <FaInstagram className="red-social-icon instagram" />
                        </a>
                      )}
                      {formData.redes?.twitter && (
                        <a href={`https://twitter.com/${formData.redes.twitter}`} target="_blank" rel="noopener noreferrer">
                          <FaTwitter className="red-social-icon twitter" />
                        </a>
                      )}
                      {formData.redes?.facebook && (
                        <a href={`https://facebook.com/${formData.redes.facebook}`} target="_blank" rel="noopener noreferrer">
                          <FaFacebook className="red-social-icon facebook" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

              {isEditing && (
                <div className="perfil-seccion">
                  <button onClick={handleSubmit} className="btn-unirse-agencia">
                    Guardar Cambios
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerfilAcompanantePropio;