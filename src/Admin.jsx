// src/Admin.jsx
import { useState, lazy, Suspense } from "react";
import { 
  LayoutDashboard, Users, UserCog, Activity, LogOut 
} from "lucide-react";

// Importando os subcomponentes da pasta Admin
const LoginAdmin = lazy(() => import("./Admin/LoginAdmin"));
const ListaDiagnosticos = lazy(() => import("./Admin/ListaDiagnosticos"));
const LeadsCRM = lazy(() => import("./Admin/LeadsCRM"));
const EquipeCapacidade = lazy(() => import("./Admin/EquipeCapacidade"));
const AtendimentosDepartamento = lazy(() => import("./Admin/AtendimentosDepartamento"));

function Carregando() {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "#5B667A", fontSize: 13 }}>
      Carregando módulo administrativo...
    </div>
  );
}

export default function AdminMain() {
  const [token, setToken] = useState(() => sessionStorage.getItem("finder_admin_token") || "");
  const [abaAtiva, setAbaAtiva] = useState("diagnosticos");
  const [diagnosticoAbertoId, setDiagnosticoAbertoId] = useState("");
  const [atendimentoAbertoId, setAtendimentoAbertoId] = useState("");

  function handleLogout() {
    sessionStorage.removeItem("finder_admin_token");
    sessionStorage.removeItem("finder_admin_user");
    setToken("");
  }

  if (!token) {
    return (
      <Suspense fallback={<Carregando />}>
        <LoginAdmin onLogin={(novoToken) => setToken(novoToken)} />
      </Suspense>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F3F5F8", fontFamily: "sans-serif" }}>
      {/* Menu Superior de Navegação entre Módulos */}
      <header style={{ background: "#17233D", color: "#FFF", padding: "12px 24px" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <img src="/finder-logo.png" alt="Finder" style={{ maxHeight: 36, background: "#FFF", padding: 4, borderRadius: 6 }} />
            <nav style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setAbaAtiva("diagnosticos")} style={navBtnStyle(abaAtiva === "diagnosticos")}>
                <LayoutDashboard size={15} /> Diagnósticos
              </button>
              <button onClick={() => setAbaAtiva("crm")} style={navBtnStyle(abaAtiva === "crm")}>
                <Users size={15} /> Leads / CRM
              </button>
              <button onClick={() => setAbaAtiva("atendimentos")} style={navBtnStyle(abaAtiva === "atendimentos")}>
                <Activity size={15} /> Atendimentos
              </button>
              <button onClick={() => setAbaAtiva("equipe")} style={navBtnStyle(abaAtiva === "equipe")}>
                <UserCog size={15} /> Equipe
              </button>
            </nav>
          </div>
          <button onClick={handleLogout} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.3)", color: "#FFF", borderRadius: 8, padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <LogOut size={14} /> Sair
          </button>
        </div>
      </header>

      {/* Renderização das Telas por Demanda */}
      <main style={{ maxWidth: 1320, margin: "0 auto", padding: 24 }}>
        <Suspense fallback={<Carregando />}>
          {abaAtiva === "diagnosticos" && (
            <ListaDiagnosticos 
              token={token} 
              onAbrir={(id) => { setDiagnosticoAbertoId(id); setAbaAtiva("atendimentos"); }}
              onLogout={handleLogout}
            />
          )}
          {abaAtiva === "crm" && (
            <LeadsCRM 
              token={token} 
              onAbrirDiagnostico={(id) => { setDiagnosticoAbertoId(id); setAbaAtiva("atendimentos"); }} 
            />
          )}
          {abaAtiva === "atendimentos" && (
            <AtendimentosDepartamento 
              token={token} 
              atendimentoInicialId={atendimentoAbertoId}
              onAbrirDiagnostico={(id) => setDiagnosticoAbertoId(id)}
            />
          )}
          {abaAtiva === "equipe" && <EquipeCapacidade token={token} />}
        </Suspense>
      </main>
    </div>
  );
}

function navBtnStyle(ativo) {
  return {
    background: ativo ? "#FF6B4A" : "transparent",
    color: "#FFF",
    border: "none",
    borderRadius: 8,
    padding: "8px 14px",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };
}
