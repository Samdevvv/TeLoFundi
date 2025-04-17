import React, { useState, useEffect } from 'react';
import { FaMapMarkerAlt, FaCalendarAlt, FaBuilding, FaEnvelope, FaPhone, FaInstagram, FaTwitter, FaFacebook, FaWhatsapp } from 'react-icons/fa';
import '../estilos/PerfilAgencia.css';
import '../estilos/Header.css';
import Header from './Header';
import defaultProfilePic from '../assets/perfil agencia.png';

const PerfilAgencia = ({ userData = {} }) => {
  const [activeTab, setActiveTab] = useState('informacion');
  const [isOwnProfile, setIsOwnProfile] = useState(false);

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

  const profileData = userData.nombre ? userData : defaultData.agencia;

  useEffect(() => {
    setIsOwnProfile(false);
  }, []);

  // Formatear el número de teléfono para el enlace de WhatsApp
  const whatsappNumber = profileData.telefono ? profileData.telefono.replace(/\D/g, '') : '';
  const whatsappLink = `https://wa.me/${whatsappNumber}`;

  return (
    <div className="perfil-container">
      <Header />
      
      <div className="perfil-content">
        <div className="perfil-header">
          <div className="perfil-foto-container">
            <img 
              src={profileData.fotoPerfil} 
              alt={profileData.nombre} 
              className="perfil-foto"
            />
          </div>
          <div className="perfil-info-header">
            <div className="perfil-name-buttons">
              <h1>{profileData.nombre}</h1>
              {!isOwnProfile && (
                <div className="perfil-action-buttons">
                  <button className="btn-unirse-agencia">Unirse a esta Agencia</button>
                </div>
              )}
              {isOwnProfile && (
                <button className="btn-editar-perfil">Editar Perfil</button>
              )}
            </div>
            <p className="perfil-ubicacion">
              <FaMapMarkerAlt /> {profileData.ubicacion}
            </p>
            <div className="perfil-contact-icons">
              {profileData.redes?.instagram && (
                <a href={`https://instagram.com/${profileData.redes.instagram}`} target="_blank" rel="noopener noreferrer">
                  <FaInstagram className="contact-icon instagram" />
                </a>
              )}
              {profileData.telefono && (
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  <FaWhatsapp className="contact-icon whatsapp" />
                </a>
              )}
            </div>
            <div className="perfil-datos-rapidos">
              <span><FaBuilding /> Agencia</span>
              <span><FaCalendarAlt /> Desde {profileData.fechaRegistro}</span>
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
                <p>{profileData.descripcion}</p>
              </div>
              
              <div className="perfil-seccion perfil-detalles">
                <h3>Detalles</h3>
                <div className="perfil-detalles-content">
                  <div className="perfil-detalle-item">
                    <span className="detalle-label">Horario de Atención:</span>
                    <span>{profileData.horarioAtencion}</span>
                  </div>
                  <div className="perfil-detalle-item">
                    <span className="detalle-label">Servicios:</span>
                    <ul className="perfil-servicios-list">
                      {profileData.servicios && profileData.servicios.map((servicio, index) => (
                        <li key={index}>{servicio}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="perfil-seccion perfil-contacto">
                <h3>Información de Contacto</h3>
                <div className="perfil-contacto-info">
                  {profileData.email && (
                    <div className="perfil-contacto-item">
                      <FaEnvelope className="perfil-contacto-icon" />
                      <span>{profileData.email}</span>
                    </div>
                  )}
                  {profileData.telefono && (
                    <div className="perfil-contacto-item">
                      <FaPhone className="perfil-contacto-icon" />
                      <span>{profileData.telefono}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {profileData.redes && (
                <div className="perfil-seccion perfil-redes">
                  <h3>Redes Sociales</h3>
                  <div className="perfil-redes-sociales">
                    {profileData.redes.instagram && (
                      <a href={`https://instagram.com/${profileData.redes.instagram}`} target="_blank" rel="noopener noreferrer">
                        <FaInstagram className="red-social-icon instagram" />
                      </a>
                    )}
                    {profileData.redes.twitter && (
                      <a href={`https://twitter.com/${profileData.redes.twitter}`} target="_blank" rel="noopener noreferrer">
                        <FaTwitter className="red-social-icon twitter" />
                      </a>
                    )}
                    {profileData.redes.facebook && (
                      <a href={`https://facebook.com/${profileData.redes.facebook}`} target="_blank" rel="noopener noreferrer">
                        <FaFacebook className="red-social-icon facebook" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'acompanantes' && (
            <div className="perfil-acompanantes">
              {profileData.acompanantes && profileData.acompanantes.map((acompanante, index) => (
                <div className="perfil-acompanante-card" key={index}>
                  <img src={acompanante.foto} alt={acompanante.nombre} />
                  <h4>{acompanante.nombre}</h4>
                  <button className="btn-ver-perfil">Ver Perfil</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerfilAgencia;