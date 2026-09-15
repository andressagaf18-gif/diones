import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";

// App (formulário público) e Admin (painel interno) são carregados sob
// demanda: quem acessa o site nunca baixa o painel administrativo, e quem
// acessa /admin nunca baixa o formulário público de diagnóstico.
const App = lazy(() => import("./App.jsx"));
const Admin = lazy(() => import("./Admin.jsx"));

const caminho = window.location.pathname;

const Componente =
  caminho === "/admin" || caminho.startsWith("/admin/")
    ? Admin
    : App;

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <Suspense fallback={null}>
      <Componente />
    </Suspense>
  </React.StrictMode>
);
