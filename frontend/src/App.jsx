import React, { useState } from "react";
import Login from "./componentes/login";
import Registro from "./componentes/registro";
import Mainpage from "./componentes/MainPage";
import HomePage from "./componentes/homepage";
import PerfilAcompañante from "./componentes/PerfilAcompañante";
import PerfilCliente from "./componentes/PerfilCliente";
import PerfilAgencia from "./componentes/PerfilAgencia";
import "./estilos/login.css";
import "./estilos/PerfilAcompañante.css";
import "./estilos/homepage.css";
import ForgetPsw from "./componentes/Forgetpswd";

function App() {
  const [menu, setMenu] = useState("mainpage");

  return (
    <div>
      <Mainpage  setMenu={setMenu} /> 
      
      {menu === "login" && (
  <div className="modal-overlay">
    <Login setMenu={setMenu} />
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

    </div>
  );
}

export default App;




