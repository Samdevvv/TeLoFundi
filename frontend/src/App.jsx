import React, { useState } from "react";
import Login from "./componentes/login";
import Registro from "./componentes/registro";
import Mainpage from "./componentes/MainPage";
import HomePage from "./componentes/homepage";
import "./estilos/login.css";
import "./estilos/homepage.css";
import ForgetPsw from "./componentes/Forgetpswd";

function App() {
  const [menu, setMenu] = useState("mainpage");

  return (
    <div>
    {menu === "login" && <Login setMenu={setMenu} />}
    {menu === "registro" && <Registro setMenu={setMenu} />}
    {menu === "recuperar" && <ForgetPsw setMenu={setMenu} />}
    {menu === "mainpage" && <Mainpage setMenu={setMenu} />} 
  </div>
  );
}


export default App;