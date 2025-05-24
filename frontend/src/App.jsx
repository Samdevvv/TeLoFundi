import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import ForgetPsw from ".//componentes/Forgetpswd";
import Terminos from "./componentes/Terminos";
import GoogleAuthCallback from "./componentes/GoogleAuthCallback";
import ExploreProfiles from "./componentes/ExploreProfiles";
import FavoriteProfiles from "./componentes/FavoriteProfiles";
import "./estilos/login.css";
import "./estilos/registr.css";
import "./estilos/forgetpsw.css";
import "./estilos/PerfilAcompañante.css";
import "./estilos/homepage.css";
import "./estilos/Terminos.css";
import "./estilos/googleAuthCallback.css";
import "./estilos/ProfileGrid.css";
import "./estilos/ProfileModal.css";
import "./estilos/ExploreProfiles.css";
import "./estilos/FavoriteProfiles.css";

function AppContent() {
  const [menu, setMenu] = useState("mainpage");
  const [prevMenu, setPrevMenu] = useState(null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")) || null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegistroModal, setShowRegistroModal] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [tempAgencyData, setTempAgencyData] = useState(JSON.parse(localStorage.getItem("tempAgencyData")) || null);

  const appConfig = {
    API_BASE_URL: 'http://localhost:5000',
    FRONTEND_URL: 'http://localhost:5173'
  };

  useEffect(() => {
    console.log("Menú actual:", menu);
    console.log("Usuario actual:", user);
    console.log("Temp agency data:", tempAgencyData);
  }, [menu, user, tempAgencyData]);

  useEffect(() => {
    if (prevMenu !== menu) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [menu, prevMenu]);

  const handleMenuChange = (newMenu) => {
    console.log("Cambiando a menú:", newMenu);
    if (isTransitioning) return;
    setIsTransitioning(true);

    if (newMenu === "login" && showRegistroModal) {
      setTransitionDirection("registro-to-login");
      setTimeout(() => {
        setShowRegistroModal(false);
        setShowLoginModal(true);
        setTransitionDirection(null);
        setIsTransitioning(false);
      }, 600);
    } else if (newMenu === "registro" && showLoginModal) {
      setTransitionDirection("login-to-registro");
      setTimeout(() => {
        setShowLoginModal(false);
        setShowRegistroModal(true);
        setTransitionDirection(null);
        setIsTransitioning(false);
      }, 600);
    } else if (newMenu === "login") {
      setShowRegistroModal(false);
      setShowLoginModal(true);
      setTransitionDirection(null);
      setIsTransitioning(false);
    } else if (newMenu === "registro") {
      setShowLoginModal(false);
      setShowRegistroModal(true);
      setTransitionDirection(null);
      setIsTransitioning(false);
    } else {
      setPrevMenu(menu);
      setMenu(newMenu);
      setShowLoginModal(false);
      setShowRegistroModal(false);
      setTransitionDirection(null);
      setIsTransitioning(false);
    }
  };

  const handleLoginSuccess = (userData) => {
    console.log("Login exitoso con datos:", userData);
    setUser(userData);
    setTempAgencyData(null);
    setShowLoginModal(false);
    setTransitionDirection(null);
    setIsTransitioning(false);
    handleMenuChange("homepage");
  };

  const handleCloseLogin = () => {
    setShowLoginModal(false);
    setTransitionDirection(null);
    setIsTransitioning(false);
  };

  const handleCloseRegistro = () => {
    setShowRegistroModal(false);
    setTransitionDirection(null);
    setIsTransitioning(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    localStorage.removeItem("tempAgencyData");
    setUser(null);
    setTempAgencyData(null);
    handleMenuChange("mainpage");
  };

  const getTransitionClass = () => {
    if (!isAnimating) return "";
    if (
      (prevMenu === "recuperar" && menu === "login") ||
      (prevMenu === "login" && menu === "recuperar")
    ) {
      return "page-transition";
    }
    return "";
  };

  const isSpecialRoute = window.location.pathname.startsWith('/auth/google/callback');
  if (isSpecialRoute) {
    return null;
  }

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
      {menu === "exploreProfiles" && (
        <ExploreProfiles 
          setMenu={handleMenuChange} 
          userLoggedIn={!!user} 
          handleLogout={handleLogout}
          appConfig={appConfig} 
        />
      )}
      {menu === "favorites" && (
        <FavoriteProfiles 
          setMenu={handleMenuChange} 
          userLoggedIn={!!user} 
          handleLogout={handleLogout}
          appConfig={appConfig}
        />
      )}
      {showLoginModal && (
        <Login 
          setMenu={handleMenuChange} 
          onLoginSuccess={handleLoginSuccess} 
          onClose={handleCloseLogin}
          transitionDirection={transitionDirection}
        />
      )}
      {showRegistroModal && (
        <Registro 
          setMenu={handleMenuChange} 
          onClose={handleCloseRegistro}
          transitionDirection={transitionDirection}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
      {menu === "recuperar" && (
        <ForgetPsw setMenu={handleMenuChange} />
      )}
      {menu === "perfilCliente" && <PerfilClientePropio setMenu={handleMenuChange} />}
      {menu === "perfilAgencia" && <PerfilAgenciaPropio setMenu={handleMenuChange} />}
      {menu === "perfilAcompanante" && (
        <PerfilAcompañantePropio 
          setMenu={handleMenuChange} 
          key="perfilAcompanantePropio"
        />
      )}
      {menu === "listadoAgencias" && (
        <ListadoAgencias setMenu={handleMenuChange} userLoggedIn={!!user} handleLogout={handleLogout} />
      )}
      {menu === "terminos" && (
        <Terminos setMenu={handleMenuChange} userLoggedIn={!!user} handleLogout={handleLogout} />
      )}
      {menu === "about" && (
        <SobreNosotros setMenu={handleMenuChange} userLoggedIn={!!user} handleLogout={handleLogout} />
      )}
      {menu === "pago" && (
        <Pago 
          setMenu={handleMenuChange} 
          onLoginSuccess={handleLoginSuccess}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
        <Route path="/*" element={<AppContent />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;