import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Admin from "./Admin.jsx";

const caminho = window.location.pathname;

const Componente =
  caminho === "/admin" || caminho.startsWith("/admin/")
    ? Admin
    : App;

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <Componente />
  </React.StrictMode>
);
