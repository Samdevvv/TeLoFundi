import React, { useState, useEffect } from 'react';
import { FaMapMarkerAlt, FaCalendarAlt, FaUser, FaEnvelope, FaPhone, FaInstagram, FaTwitter, FaFacebook, FaWhatsapp } from 'react-icons/fa';
import '../estilos/PerfilCliente.css';
import '../estilos/Header.css';
import Header from './Header';
import defaultProfilePic from '../assets/imagen perfil hombre.jpg';

const PerfilCliente = ({ userData = {} }) => {
  const [isOwnProfile, setIsOwnProfile] = useState(false);

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
              <span><FaUser /> Cliente</span>
              <span><FaCalendarAlt /> Miembro desde {profileData.fechaRegistro}</span>
              <span>{profileData.eventosRecientes} eventos recientes</span>
            </div>
          </div>
        </div>
        
        <div className="perfil-tabs">
          <button className="perfil-tab active">
            Información
          </button>
        </div>
        
        <div className="perfil-tab-content">
          <div className="perfil-informacion">
            <div className="perfil-seccion perfil-sobre-mi">
              <h3>Sobre Mí</h3>
              <p>{profileData.descripcion}</p>
            </div>
            
            {profileData.preferencias && (
              <div className="perfil-seccion">
                <h3>Preferencias</h3>
                <ul className="perfil-preferencias-list">
                  {profileData.preferencias.map((preferencia, index) => (
                    <li key={index}>{preferencia}</li>
                  ))}
                </ul>
              </div>
            )}
            
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
        </div>
      </div>
    </div>
  );
};

export default PerfilCliente;