import React, { useState, useEffect } from "react";
import Login from "./componentes/login";
import Registro from "./componentes/registro";
import MainPage from "./componentes/MainPage";
import HomePage from "./componentes/homepage";
import PerfilAcompañante from "./componentes/PerfilAcompañante";
import PerfilCliente from "./componentes/PerfilCliente";
import PerfilAgencia from "./componentes/PerfilAgencia";
import PerfilAcompañantePropio from "./componentes/PerfilAcompañantePropio";
import PerfilClientePropio from "./componentes/PerfilClientePropio";
import PerfilAgenciaPropio from "./componentes/PerfilAgenciaPropio";
import ListadoAgencias from "./componentes/ListadoAgencias";
import SobreNosotros from "./componentes/SobreNosotros";
import Pago from "./componentes/Pago";
import PerfilAdmin from "./componentes/PerfilAdmin";
import ForgetPsw from "./componentes/Forgetpswd";
import Terminos from "./componentes/Terminos";
import "./estilos/login.css";
import "./estilos/registr.css";
import "./estilos/forgetpsw.css";
import "./estilos/PerfilAcompañante.css";
import "./estilos/homepage.css";
import "./estilos/Terminos.css";

function App() {
  const [menu, setMenu] = useState("mainpage");
  const [prevMenu, setPrevMenu] = useState(null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")) || null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Efecto para manejar la transición entre componentes
  useEffect(() => {
    if (prevMenu !== menu) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 600); // Tiempo suficiente para que termine la animación
      return () => clearTimeout(timer);
    }
  }, [menu, prevMenu]);

  // Función modificada para controlar las transiciones
  const handleMenuChange = (newMenu) => {
    // Si es el login o registro, mostramos el modal en lugar de cambiar de página
    if (newMenu === "login") {
      setShowLoginModal(true);
      return;
    } else if (newMenu === "registro") {
      setPrevMenu(menu);
      setMenu(newMenu);
      return;
    }
    
    // Para otras páginas, funcionamiento normal
    setPrevMenu(menu);
    setMenu(newMenu);
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setShowLoginModal(false); // Cerrar el modal de login
    handleMenuChange("homepage"); // Navegar a homepage
  };

  const handleCloseLogin = () => {
    setShowLoginModal(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setUser(null);
    handleMenuChange("mainpage");
  };

  // Clase CSS para la animación de transición basada en los componentes
  const getTransitionClass = () => {
    if (!isAnimating) return "";
    
    // Si cambiamos entre login, registro y recuperar contraseña
    if (
      (prevMenu === "login" && menu === "registro") || 
      (prevMenu === "login" && menu === "recuperar") ||
      (prevMenu === "registro" && menu === "login") ||
      (prevMenu === "recuperar" && menu === "login")
    ) {
      return "page-transition";
    }
    
    return "";
  };

  return (
    <div className={`app-container ${getTransitionClass()}`}>
      {menu === "mainpage" && (
        <MainPage 
          setMenu={handleMenuChange} 
          userLoggedIn={!!user} 
          handleLogout={handleLogout} 
        />
      )}
      {menu === "homepage" && (
        <HomePage setMenu={handleMenuChange} userLoggedIn={!!user} handleLogout={handleLogout} />
      )}
      
      {/* Login modal (renderizado condicional) */}
      {showLoginModal && (
        <Login 
          setMenu={handleMenuChange} 
          onLoginSuccess={handleLoginSuccess} 
          onClose={handleCloseLogin}
        />
      )}
      
      {menu === "registro" && (
        <div className="modal-overlay">
          <Registro setMenu={handleMenuChange} />
        </div>
      )}
      {menu === "recuperar" && (
        <div className="modal-overlay">
          <ForgetPsw setMenu={handleMenuChange} />
        </div>
      )}
      {menu === "perfilCliente" && <PerfilClientePropio setMenu={handleMenuChange} />}
      {menu === "perfilAgencia" && <PerfilAgenciaPropio setMenu={handleMenuChange} />}
      {menu === "perfilAcompanante" && <PerfilAcompañantePropio setMenu={handleMenuChange} />}
      {menu === "listadoAgencias" && (
        <ListadoAgencias setMenu={handleMenuChange} userLoggedIn={!!user} handleLogout={handleLogout} />
      )}
      {menu === "terminos" && (
        <Terminos setMenu={handleMenuChange} userLoggedIn={!!user} handleLogout={handleLogout} />
      )}
      {menu === "about" && (
        <SobreNosotros setMenu={handleMenuChange} userLoggedIn={!!user} handleLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;