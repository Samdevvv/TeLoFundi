import React, { useState, useEffect } from 'react';
import { FaMapMarkerAlt, FaCalendarAlt, FaUser, FaEnvelope, FaPhone, FaGlobe, FaInstagram, FaTwitter, FaFacebook, FaBuilding, FaCheckCircle, FaPhoneAlt, FaWhatsapp } from 'react-icons/fa';
import '../estilos/PerfilAcompañante.css';
import '../estilos/Header.css';
import Header from './Header';
import defaultProfilePic from '../assets/publicacion.jpg';

const Perfil = ({ userType = "acompanante", userData = {} }) => {
  const [activeTab, setActiveTab] = useState('publicaciones');
  const [isOwnProfile, setIsOwnProfile] = useState(false);

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
        { imagen: defaultProfilePic, descripcion: "Cena de negocios en un restaurante exclusivo. ¿Te gustaría acompañarme?" },
        { imagen: defaultProfilePic, descripcion: "Explorando la ciudad con un cliente. ¡Una experiencia inolvidable!" },
        { imagen: defaultProfilePic, descripcion: "Asistiendo a una conferencia internacional. Profesional y elegante." },
        { imagen: defaultProfilePic, descripcion: "Turismo cultural por la ciudad. ¿Te unes?" },
        { imagen: defaultProfilePic, descripcion: "Evento de gala benéfica. Una noche para recordar." }
      ],
      verificado: true,
      agenciaVerificadora: "Élite Acompañantes"
    },
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
      ],
      publicaciones: [
        { imagen: defaultProfilePic, descripcion: "Nuestros acompañantes en un evento corporativo de alto nivel." },
        { imagen: defaultProfilePic, descripcion: "Gala benéfica organizada con nuestros mejores profesionales." },
        { imagen: defaultProfilePic, descripcion: "Congreso internacional con presencia de Élite Acompañantes." },
        { imagen: defaultProfilePic, descripcion: "Evento privado con clientes exclusivos." }
      ],
      verificado: true,
      agenciaVerificadora: "Asociación de Agencias Premium"
    }
  };

  const profileData = userData.nombre ? userData : defaultData[userType];

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
            <div className="perfil-verification">
              <FaCheckCircle className={profileData.verificado ? "verified-icon" : "unverified-icon"} />
              <span>{profileData.verificado ? "Perfil Verificado" : "Perfil No Verificado"}</span>
              {profileData.verificado && profileData.agenciaVerificadora && (
                <span className="agencia-verificadora"> por {profileData.agenciaVerificadora}</span>
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
            {userType === "acompanante" && (
              <div className="perfil-datos-rapidos">
                <span><FaUser /> {profileData.edad} años</span>
                <span>{profileData.genero}</span>
                <span><FaGlobe /> {profileData.idiomas && profileData.idiomas.join(', ')}</span>
              </div>
            )}
            {userType === "agencia" && (
              <div className="perfil-datos-rapidos">
                <span><FaBuilding /> Agencia</span>
                <span><FaCalendarAlt /> Desde {profileData.fechaRegistro}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="perfil-tabs">
          {(userType === "acompanante" || userType === "agencia") && (
            <button 
              className={`perfil-tab ${activeTab === 'publicaciones' ? 'active' : ''}`}
              onClick={() => setActiveTab('publicaciones')}
            >
              Publicaciones
            </button>
          )}
          <button 
            className={`perfil-tab ${activeTab === 'informacion' ? 'active' : ''}`}
            onClick={() => setActiveTab('informacion')}
          >
            Información
          </button>
          {userType === "agencia" && (
            <button 
              className={`perfil-tab ${activeTab === 'acompanantes' ? 'active' : ''}`}
              onClick={() => setActiveTab('acompanantes')}
            >
              Acompañantes
            </button>
          )}
        </div>
        
        <div className="perfil-tab-content">
          {(userType === "acompanante" || userType === "agencia") && activeTab === 'publicaciones' && (
            <div className="perfil-publicaciones">
              {profileData.publicaciones && profileData.publicaciones.map((publicacion, index) => (
                <div className="perfil-publicacion-item" key={index}>
                  <img src={publicacion.imagen} alt={`Publicación ${index + 1}`} />
                  <div className="publicacion-descripcion">
                    <p>{publicacion.descripcion}</p>
                    <button className="btn-contacto-publicacion">
                      <FaPhoneAlt /> Contactar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {activeTab === 'informacion' && (
            <div className="perfil-informacion">
              <div className="perfil-seccion perfil-sobre-mi">
                <h3>Sobre {userType === "agencia" ? "Nosotros" : "Mí"}</h3>
                <p>{profileData.descripcion}</p>
              </div>
              
              {(userType === "acompanante" || userType === "agencia") && (
                <div className="perfil-seccion perfil-detalles">
                  <h3>Detalles</h3>
                  <div className="perfil-detalles-content">
                    {(userType === "acompanante") && (
                      <>
                        <div className="perfil-detalle-item">
                          <span className="detalle-label">Disponibilidad:</span>
                          <span>{profileData.disponibilidad}</span>
                        </div>
                        <div className="perfil-detalle-item">
                          <span className="detalle-label">Idiomas:</span>
                          <span>{profileData.idiomas && profileData.idiomas.join(', ')}</span>
                        </div>
                      </>
                    )}
                    {userType === "agencia" && (
                      <div className="perfil-detalle-item">
                        <span className="detalle-label">Horario de Atención:</span>
                        <span>{profileData.horarioAtencion}</span>
                      </div>
                    )}
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
              
              {(userType === "acompanante" || userType === "agencia") && profileData.redes && (
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
          
          {activeTab === 'acompanantes' && userType === "agencia" && (
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

export default Perfil;