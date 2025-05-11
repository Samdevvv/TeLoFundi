import React, { useState, useEffect } from 'react';
import "../estilos/Mainpage.css";
import "../estilos/Terminos.css";
import "../estilos/AgeVerificationModal.css";
import heroImage from "../assets/heroimage2.avif";
import logoImage from "../assets/logo png.png";
import '../estilos/Header.css';
import Header from './Header';
import { 
  FaSearch, 
  FaTimes, 
  FaShieldAlt, 
  FaUserLock, 
  FaCreditCard, 
  FaHandshake, 
  FaBalanceScale, 
  FaExclamationTriangle,
  FaFileContract,
  FaCookieBite,
  FaGavel
} from 'react-icons/fa';

const Terminos = ({ setMenu, userLoggedIn, handleLogout }) => {
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  // Detectar cambios en el tamaño de la ventana
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Comprobar si el usuario ya verificó su edad
  useEffect(() => {
    const ageVerified = localStorage.getItem('ageVerified');
    if (!ageVerified) {
      setShowAgeModal(true);
    }
  }, []);

  // Desactivar scroll cuando la modal de edad está abierta
  useEffect(() => {
    if (showAgeModal) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.height = '100vh';
      const pageContainer = document.querySelector('.page-container');
      if (pageContainer) {
        pageContainer.style.pointerEvents = 'none';
      }
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.height = '';
      const pageContainer = document.querySelector('.page-container');
      if (pageContainer) {
        pageContainer.style.pointerEvents = 'auto';
      }
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.height = '';
      const pageContainer = document.querySelector('.page-container');
      if (pageContainer) {
        pageContainer.style.pointerEvents = 'auto';
      }
    };
  }, [showAgeModal]);

  const handleAgeAccept = () => {
    localStorage.setItem('ageVerified', 'true');
    setShowAgeModal(false);
  };

  const handleAgeCancel = () => {
    window.location.href = 'https://Google.com';
  };

  const fireParticles = Array.from({ length: isMobile ? 15 : 30 }).map((_, index) => (
    <div
      key={index}
      className="fire-particle"
      style={{
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 3}s`
      }}
    />
  ));

  const openFiltersModal = () => {
    setShowFiltersModal(true);
  };

  const closeFiltersModal = () => {
    setShowFiltersModal(false);
  };

  return (
    <div className="page-container">
      {/* Modal de verificación de edad */}
      {showAgeModal && (
        <div className="age-modal-overlay">
          <div className="age-modal">
            {fireParticles}
            <img src={logoImage} alt="Telo Fundi Logo" className="age-modal-logo" />
            <p className="age-modal-text">
              Este sitio contiene contenido exclusivo para mayores de 18 años. 
              Al continuar, confirmas que tienes la edad legal para acceder. 
              Telo Fundi no se responsabiliza por accesos no autorizados. 
              Por favor, selecciona una opción para proceder.
            </p>
            <div className="age-modal-buttons">
              <button className="age-accept" onClick={handleAgeAccept}></button>
              <button className="age-cancel" onClick={handleAgeCancel}></button>
            </div>
            <p className="age-modal-footer">Telo Fundi - ©2025</p>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section 
        className="hero-section" 
        style={{ 
          backgroundImage: `url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="hero-overlay" style={{
          background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.5) 70%, rgba(0, 0, 0, 0.7) 100%)'
        }}></div>
        
        {/* Header con logo flotante */}
        <Header onNavigate={setMenu} userLoggedIn={userLoggedIn} handleLogout={handleLogout} />
        
        <div className="hero-content">
          <h1 className='Titulo' style={{ textShadow: '0 2px 10px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 0, 0, 0.5)' }}>
            Términos y Condiciones
          </h1>
          <p style={{ textShadow: '0 2px 8px rgba(0, 0, 0, 0.7), 0 0 16px rgba(0, 0, 0, 0.4)' }}>
            Conoce las normas y políticas que rigen nuestra plataforma
          </p>
        </div>
      </section>

      {/* Sección de Términos y Condiciones */}
      <section className="terms-section">
        <div className="container">
          <div className="terms-header">
            <img src={logoImage} alt="Telo Fundi Logo" className="terms-logo" />
            <h1>Términos y Condiciones de Uso</h1>
            <p className="terms-intro">
              Bienvenido a Telo Fundi. Antes de utilizar nuestra plataforma, te pedimos que leas detenidamente los siguientes términos y condiciones que rigen el uso de nuestros servicios. Al acceder y utilizar nuestra plataforma, aceptas quedar vinculado por estos términos.
            </p>
          </div>

          <div className="terms-content">
            <div className="terms-section-item">
              <div className="terms-icon">
                <FaUserLock size={40} />
              </div>
              <h2>1. Acceso y Elegibilidad</h2>
              <p>
                Al utilizar nuestra plataforma, confirmas que tienes al menos 18 años de edad y posees la capacidad legal para aceptar estos términos. El acceso a Telo Fundi está prohibido para menores de edad. Nos reservamos el derecho de solicitar verificación de edad en cualquier momento y suspender cuentas que no cumplan con este requisito.
              </p>
              <p>
                El usuario se compromete a proporcionar información veraz, precisa y actualizada durante el proceso de registro y durante toda su interacción con la plataforma. La creación de cuentas falsas o la suplantación de identidad constituyen una violación grave de nuestros términos.
              </p>
            </div>

            <div className="terms-section-item">
              <div className="terms-icon">
                <FaHandshake size={40} />
              </div>
              <h2>2. Servicios y Responsabilidades</h2>
              <p>
                Telo Fundi actúa exclusivamente como intermediario entre usuarios y proveedores de servicios de acompañamiento. No somos proveedores directos de servicios de escorts ni asumimos responsabilidad por las acciones, comportamientos o servicios proporcionados por terceros anunciados en nuestra plataforma.
              </p>
              <p>
                Los usuarios reconocen que cualquier acuerdo, transacción o interacción con los anunciantes se realiza bajo su propio riesgo y responsabilidad. Telo Fundi no garantiza la calidad, seguridad o legalidad de los servicios ofrecidos por los anunciantes.
              </p>
            </div>

            <div className="terms-section-item">
              <div className="terms-icon">
                <FaShieldAlt size={40} />
              </div>
              <h2>3. Privacidad y Protección de Datos</h2>
              <p>
                Valoramos tu privacidad y nos comprometemos a proteger tus datos personales de acuerdo con nuestra Política de Privacidad. Al utilizar nuestros servicios, aceptas nuestras prácticas de recopilación, uso y procesamiento de datos tal como se describe en dicha política.
              </p>
              <p>
                Implementamos medidas de seguridad técnicas y organizativas para proteger tus datos, pero ningún sistema es completamente seguro. Te recomendamos mantener la confidencialidad de tus credenciales de acceso y notificarnos inmediatamente ante cualquier uso no autorizado de tu cuenta.
              </p>
            </div>

            <div className="terms-section-item">
              <div className="terms-icon">
                <FaCreditCard size={40} />
              </div>
              <h2>4. Pagos y Tarifas</h2>
              <p>
                Telo Fundi puede cobrar tarifas por ciertos servicios proporcionados a través de nuestra plataforma. Todos los pagos realizados son finales y no reembolsables, a menos que se especifique lo contrario. Nos reservamos el derecho de modificar nuestras tarifas con previo aviso.
              </p>
              <p>
                Los pagos a los anunciantes por sus servicios son transacciones independientes entre usuarios y anunciantes. Telo Fundi no procesa, recibe ni gestiona estos pagos y no es responsable de disputas relacionadas con transacciones entre usuarios y anunciantes.
              </p>
            </div>

            <div className="terms-section-item">
              <div className="terms-icon">
                <FaBalanceScale size={40} />
              </div>
              <h2>5. Conducta y Restricciones</h2>
              <p>
                Los usuarios se comprometen a utilizar nuestra plataforma de manera legal y ética. Está prohibido utilizar Telo Fundi para actividades ilegales, incluyendo pero no limitado a: tráfico de personas, explotación infantil, fraude, acoso, difamación, o cualquier actividad que viole las leyes locales e internacionales.
              </p>
              <p>
                Nos reservamos el derecho de eliminar contenido y suspender o terminar cuentas que violen estas políticas sin previo aviso. La decisión de Telo Fundi sobre estas cuestiones será definitiva y vinculante.
              </p>
            </div>

            <div className="terms-section-item">
              <div className="terms-icon">
                <FaFileContract size={40} />
              </div>
              <h2>6. Propiedad Intelectual</h2>
              <p>
                Todo el contenido presente en Telo Fundi, incluyendo pero no limitado a logos, diseños, textos, gráficos, imágenes, videos y software, es propiedad de Telo Fundi o de nuestros licenciantes y está protegido por leyes de propiedad intelectual.
              </p>
              <p>
                Se prohíbe la reproducción, distribución, modificación, exhibición pública, o cualquier otro uso del contenido de la plataforma sin nuestra autorización previa por escrito. Los usuarios mantienen los derechos sobre el contenido que suben a la plataforma, pero nos otorgan una licencia no exclusiva para usar, modificar y distribuir dicho contenido.
              </p>
            </div>

            <div className="terms-section-item">
              <div className="terms-icon">
                <FaExclamationTriangle size={40} />
              </div>
              <h2>7. Limitación de Responsabilidad</h2>
              <p>
                Telo Fundi proporciona su plataforma "tal cual" y "según disponibilidad", sin garantías de ningún tipo, expresas o implícitas. No garantizamos que nuestros servicios sean ininterrumpidos o libres de errores, ni que los defectos serán corregidos.
              </p>
              <p>
                En ningún caso Telo Fundi, sus directores, empleados o agentes serán responsables por daños indirectos, incidentales, especiales, consecuentes o punitivos, incluyendo pérdida de beneficios, datos o uso, resultantes del uso o la imposibilidad de usar nuestra plataforma.
              </p>
            </div>

            <div className="terms-section-item">
              <div className="terms-icon">
                <FaCookieBite size={40} />
              </div>
              <h2>8. Cookies y Tecnologías de Seguimiento</h2>
              <p>
                Utilizamos cookies y tecnologías similares para mejorar tu experiencia en nuestra plataforma. Estas tecnologías nos permiten reconocerte, personalizar tu experiencia, analizar el uso de nuestros servicios y mostrar anuncios relevantes.
              </p>
              <p>
                Al usar nuestra plataforma, consientes el uso de cookies conforme a nuestra Política de Cookies. Puedes gestionar tus preferencias de cookies a través de la configuración de tu navegador, aunque esto puede afectar a la funcionalidad de ciertos aspectos de nuestros servicios.
              </p>
            </div>

            <div className="terms-section-item">
              <div className="terms-icon">
                <FaGavel size={40} />
              </div>
              <h2>9. Ley Aplicable y Resolución de Disputas</h2>
              <p>
                Estos términos se regirán e interpretarán de acuerdo con las leyes de la República Dominicana, sin tener en cuenta sus disposiciones sobre conflictos de leyes. Cualquier disputa relacionada con estos términos se someterá a la jurisdicción exclusiva de los tribunales de Santo Domingo.
              </p>
              <p>
                Antes de iniciar cualquier acción legal, las partes acuerdan intentar resolver cualquier disputa de manera amistosa mediante comunicación directa. Si no se llega a una resolución satisfactoria en un plazo de 30 días, cualquiera de las partes podrá recurrir a los tribunales competentes.
              </p>
            </div>

            <div className="terms-section-item">
              <div className="terms-icon">
                <FaFileContract size={40} />
              </div>
              <h2>10. Modificaciones de los Términos</h2>
              <p>
                Nos reservamos el derecho de modificar estos términos en cualquier momento a nuestra discreción. Las modificaciones entrarán en vigor inmediatamente después de su publicación en nuestra plataforma. Es tu responsabilidad revisar periódicamente estos términos.
              </p>
              <p>
                El uso continuado de nuestra plataforma después de la publicación de modificaciones constituye tu aceptación de dichas modificaciones. Si no estás de acuerdo con los términos modificados, debes dejar de utilizar nuestros servicios.
              </p>
            </div>
          </div>

          <p className="terms-footer">
            Última actualización: 10 de Mayo, 2025<br />
            Si tienes preguntas sobre estos términos, contáctanos en: legal@telofundi.com
          </p>
        </div>
      </section>

      {/* Footer - Se mantiene sin cambios */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-main">
            <div className="footer-logo">
              <img src={logoImage} alt="Telo Fundi" className="footer-logo-image" />
              <p>La mejor plataforma para encontrar compañía de calidad en toda República Dominicana</p>
            </div>
            
            <div className="footer-links">
              <div className="footer-links-column">
                <h4>Categorías</h4>
                <ul>
                  <li><a href="#">Escorts Femeninas</a></li>
                  <li><a href="#">Trans y Travestis</a></li>
                  <li><a href="#">Escorts Masculinos</a></li>
                  <li><a href="#">Servicios VIP</a></li>
                  <li><a href="#">Masajes</a></li>
                </ul>
              </div>
            
              <div className="footer-links-column">
                <h4>Para Anunciantes</h4>
                <ul>
                  <li><a href="#">Publicar Anuncio</a></li>
                  <li><a href="#">Planes Premium</a></li>
                  <li><a href="#">Verificación</a></li>
                </ul>
              </div>
            
              <div className="footer-links-column">
                <h4>Información</h4>
                <ul>
                  <li><a href="#">Términos y Condiciones</a></li>
                  <li><a href="#">Cookies</a></li>
                  <li><a href="#">Contacto</a></li>
                </ul>
              </div>
            </div>
          </div>
            
          <div className="footer-bottom">
            <p>© 2025 Telo Fundi - Todos los derechos reservados</p>
            <p className="disclaimer">Acceso solo para mayores de 18 años. Este sitio contiene material para adultos.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Terminos;