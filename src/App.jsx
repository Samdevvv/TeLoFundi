import React, { useState } from "react";
import Login from "./componentes/login";
import Registro from "./componentes/registro";
import HomePage from "./componentes/homepage";
import "./estilos/login.css";
import "./estilos/homepage.css";

function App() {
  const [menu, setMenu] = useState("login");

  return (
    <div>

      {menu == "login" ?
        <Login
          setMenu={setMenu}
        />
        :
        <Registro
          setMenu={setMenu}
        />}
    </div>
  );
}

export default App;