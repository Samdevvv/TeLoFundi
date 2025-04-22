import React, { useState, useEffect } from 'react';
import { FaMapMarkerAlt, FaCalendarAlt, FaUser, FaEnvelope, FaPhone, FaInstagram, FaTwitter, FaFacebook, FaWhatsapp, FaEdit } from 'react-icons/fa';
import '../estilos/PerfilCliente.css';
import '../estilos/Header.css';
import Header from './Header';
import defaultProfilePic from '../assets/imagen perfil hombre.jpg';

const PerfilClientePropio = ({ userData = {}, onUpdateProfile }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(userData);
  const [isOwnProfile] = useState(true);

  const defaultData = {
    cliente: {
      nombre: "Miguel Ángel Fernández",
      ubicacion: "Valencia, España",
      fotoPerfil: defaultProfilePic,
      email: "miguel@example.com",
      telefono: "+34 623 456 789",
      fechaRegistro: "Junio 2023",
      descripcion: "Empresario del sector tecnológico. Busco acompañantes para eventos corporativos y conferencias internacionales.",
      preferencias: ["Eventos corporativos", "Conversación inteligente", "Conocimiento de tecnología"],
      eventosRecientes: 5,
      redes: {
        instagram: "miguel_fernandez",
        twitter: "miguelf",
        facebook: "miguelf Fernandez"
      }
    }
  };

  const profileData = userData.nombre ? userData : defaultData.cliente;

  useEffect(() => {
    setFormData(profileData);
  }, [profileData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleRedesChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, redes: { ...formData.redes, [name]: value } });
  };

  const handleSubmit = () => {
    onUpdateProfile(formData);
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
              src={formData.fotoPerfil}
              alt={formData.nombre}
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
                  value={formData.nombre}
                  onChange={handleInputChange}
                  className="perfil-edit-input"
                />
              ) : (
                <h1>{formData.nombre}</h1>
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
                  value={formData.ubicacion}
                  onChange={handleInputChange}
                  className="perfil-edit-input"
                />
              ) : (
                formData.ubicacion
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
              <span><FaUser /> Cliente</span>
              <span><FaCalendarAlt /> Miembro desde {formData.fechaRegistro}</span>
              <span>{formData.eventosRecientes} eventos recientes</span>
            </div>
          </div>
        </div>

        <div className="perfil-tabs">
          <button className="perfil-tab active">Información</button>
        </div>

        <div className="perfil-tab-content">
          <div className="perfil-informacion">
            <div className="perfil-seccion perfil-sobre-mi">
              <h3>Sobre Mí</h3>
              {isEditing ? (
                <textarea
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleInputChange}
                  className="perfil-edit-textarea"
                />
              ) : (
                <p>{formData.descripcion}</p>
              )}
            </div>

            {formData.preferencias && (
              <div className="perfil-seccion">
                <h3>Preferencias</h3>
                {isEditing ? (
                  <input
                    type="text"
                    name="preferencias"
                    value={formData.preferencias.join(', ')}
                    onChange={(e) => setFormData({ ...formData, preferencias: e.target.value.split(', ') })}
                    className="perfil-edit-input"
                  />
                ) : (
                  <ul className="perfil-preferencias-list">
                    {formData.preferencias.map((preferencia, index) => (
                      <li key={index}>{preferencia}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

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
                        value={formData.email}
                        onChange={handleInputChange}
                        className="perfil-edit-input"
                      />
                    </div>
                    <div className="perfil-contacto-item">
                      <FaPhone className="perfil-contacto-icon" />
                      <input
                        type="text"
                        name="telefono"
                        value={formData.telefono}
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
                      value={formData.redes.instagram}
                      onChange={handleRedesChange}
                      placeholder="Instagram"
                      className="perfil-edit-input"
                    />
                    <input
                      type="text"
                      name="twitter"
                      value={formData.redes.twitter}
                      onChange={handleRedesChange}
                      placeholder="Twitter"
                      className="perfil-edit-input"
                    />
                    <input
                      type="text"
                      name="facebook"
                      value={formData.redes.facebook}
                      onChange={handleRedesChange}
                      placeholder="Facebook"
                      className="perfil-edit-input"
                    />
                  </div>
                ) : (
                  <div className="perfil-redes-sociales">
                    {formData.redes.instagram && (
                      <a href={`https://instagram.com/${formData.redes.instagram}`} target="_blank" rel="noopener noreferrer">
                        <FaInstagram className="red-social-icon instagram" />
                      </a>
                    )}
                    {formData.redes.twitter && (
                      <a href={`https://twitter.com/${formData.redes.twitter}`} target="_blank" rel="noopener noreferrer">
                        <FaTwitter className="red-social-icon twitter" />
                      </a>
                    )}
                    {formData.redes.facebook && (
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
        </div>
      </div>
    </div>
  );
};

export default PerfilClientePropio;