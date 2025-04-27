import React, { useState } from "react";
import Login from "./componentes/login";
import Registro from "./componentes/registro";
import MainPage from "./componentes/MainPage";
import Agevic from "./componentes/AgeRestriction";
import HomePage from "./componentes/homepage";
import PerfilAcompañante from "./componentes/PerfilAcompañante";
import PerfilCliente from "./componentes/PerfilCliente";
import PerfilAgencia from "./componentes/PerfilAgencia";
import PerfilAcompañantePropio from "./componentes/PerfilAcompañantePropio";
import PerfilClientePropio from "./componentes/PerfilClientePropio";
import PerfilAgenciaPropio from "./componentes/PerfilAgenciaPropio";
import PerfilAdmin from "./componentes/PerfilAdmin";
import "./estilos/login.css";
import "./estilos/PerfilAcompañante.css";
import "./estilos/homepage.css";
import ForgetPsw from "./componentes/Forgetpswd";

function App() {
  const [menu, setMenu] = useState("mainpage");
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")) || null);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setUser(null);
    setMenu("mainpage");
  };

  return (
    <div>
      {menu === "mainpage" && (
        <MainPage setMenu={setMenu} userLoggedIn={!!user} handleLogout={handleLogout} />
      )}
      {menu === "homepage" && (
        <HomePage setMenu={setMenu} userLoggedIn={!!user} handleLogout={handleLogout} />
      )}
      {menu === "login" && (
        <div className="modal-overlay">
          <Login setMenu={setMenu} onLoginSuccess={handleLoginSuccess} />
        </div>
      )}
      {menu === "registro" && (
        <div className="modal-overlay">
          <Registro setMenu={setMenu} />
        </div>
      )}
      {menu === "recuperar" && (
        <div className="modal-overlay">
          <ForgetPsw setMenu={setMenu} />
        </div>
      )}
      {menu === "perfilCliente" && <PerfilClientePropio setMenu={setMenu} />}
      {menu === "perfilAgencia" && <PerfilAgenciaPropio setMenu={setMenu} />}
      {menu === "perfilAcompanante" && <PerfilAcompañantePropio setMenu={setMenu} />}
    </div>
  );
}

export default App;