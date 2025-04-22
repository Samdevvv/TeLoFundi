import React, { useState, useEffect } from 'react';
import { FaMapMarkerAlt, FaCalendarAlt, FaBuilding, FaEnvelope, FaPhone, FaInstagram, FaTwitter, FaFacebook, FaWhatsapp, FaEdit } from 'react-icons/fa';
import '../estilos/PerfilAgencia.css';
import '../estilos/Header.css';
import Header from './Header';
import defaultProfilePic from '../assets/perfil agencia.png';

const PerfilAgenciaPropio = ({ userData = {}, onUpdateProfile }) => {
  const [activeTab, setActiveTab] = useState('informacion');
  const [isEditing, setIsEditing] = useState(false);
  const [isOwnProfile] = useState(true);

  const defaultData = {
    agencia: {
      nombre: "Élite Acompañantes",
      ubicacion: "Barcelona, España",
      fotoPerfil: defaultProfilePic,
      descripcion: "Agencia premium especializada en servicios de acompañamiento para eventos de alto nivel. Contamos con los mejores profesionales del sector.",
      telefono: "+34 913 456 789",
      email: "contacto@eliteacompanantes.com",
      fechaRegistro: "Marzo 2022",
      servicios: ["Eventos corporativos", "Galas benéficas", "Congresos internacionales"],
      horarioAtencion: "Lunes a Viernes: 9:00 - 18:00",
      redes: {
        instagram: "elite_acompanantes",
        twitter: "eliteacomp",
        facebook: "eliteacompanantes"
      },
      acompanantes: [
        { nombre: "Sara López", foto: defaultProfilePic },
        { nombre: "Carlos Ruiz", foto: defaultProfilePic },
        { nombre: "Ana Belén", foto: defaultProfilePic }
      ]
    }
  };

  // Ensure userData has a valid structure or use default
  const profileData = userData && userData.nombre ? userData : defaultData.agencia;
  
  // Ensure all array properties are initialized as arrays
  const safeProfileData = {
    ...profileData,
    servicios: Array.isArray(profileData.servicios) ? profileData.servicios : [],
    acompanantes: Array.isArray(profileData.acompanantes) ? profileData.acompanantes : [],
    redes: profileData.redes || { instagram: '', twitter: '', facebook: '' }
  };

  const [formData, setFormData] = useState(safeProfileData);

  useEffect(() => {
    // Update formData when userData changes, ensuring safe values
    const updatedProfileData = userData && userData.nombre ? userData : defaultData.agencia;
    const updatedSafeProfileData = {
      ...updatedProfileData,
      servicios: Array.isArray(updatedProfileData.servicios) ? updatedProfileData.servicios : [],
      acompanantes: Array.isArray(updatedProfileData.acompanantes) ? updatedProfileData.acompanantes : [],
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
              alt={formData.nombre || "Perfil Agencia"}
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
              <span><FaBuilding /> Agencia</span>
              <span><FaCalendarAlt /> Desde {formData.fechaRegistro || "No especificado"}</span>
            </div>
          </div>
        </div>

        <div className="perfil-tabs">
          <button
            className={`perfil-tab ${activeTab === 'informacion' ? 'active' : ''}`}
            onClick={() => setActiveTab('informacion')}
          >
            Información
          </button>
          <button
            className={`perfil-tab ${activeTab === 'acompanantes' ? 'active' : ''}`}
            onClick={() => setActiveTab('acompanantes')}
          >
            Acompañantes
          </button>
        </div>

        <div className="perfil-tab-content">
          {activeTab === 'informacion' && (
            <div className="perfil-informacion">
              <div className="perfil-seccion perfil-sobre-mi">
                <h3>Sobre Nosotros</h3>
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
                    <span className="detalle-label">Horario de Atención:</span>
                    {isEditing ? (
                      <input
                        type="text"
                        name="horarioAtencion"
                        value={formData.horarioAtencion || ""}
                        onChange={handleInputChange}
                        className="perfil-edit-input"
                      />
                    ) : (
                      <span>{formData.horarioAtencion || "No especificado"}</span>
                    )}
                  </div>
                  <div className="perfil-detalle-item">
                    <span className="detalle-label">Servicios:</span>
                    {isEditing ? (
                      <input
                        type="text"
                        name="servicios"
                        value={formData.servicios?.join(', ') || ""}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          servicios: e.target.value.split(', ').filter(serv => serv.trim())
                        })}
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

          {activeTab === 'acompanantes' && (
            <div className="perfil-acompanantes">
              {formData.acompanantes?.map((acompanante, index) => (
                <div className="perfil-acompanante-card" key={index}>
                  <img src={acompanante.foto || defaultProfilePic} alt={acompanante.nombre || "Acompañante"} />
                  <h4>{acompanante.nombre || ""}</h4>
                  <button className="btn-ver-perfil">Ver Perfil</button>
                </div>
              ))}
              {(!formData.acompanantes || formData.acompanantes.length === 0) && (
                <div>No hay acompañantes disponibles</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerfilAgenciaPropio;