import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Activity,
  Bot,
  Building2,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleUserRound,
  Gauge,
  History,
  LayoutDashboard,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  CalendarDays,
  X,
} from "lucide-react";

import {
  finderTheme,
} from "./Theme";

const C =
  finderTheme.colors;

// Itens agrupados por área do negócio — antes era uma lista única sob
// "OPERAÇÃO", sem hierarquia entre o que se usa todo dia (Dashboard, Leads)
// e o que se usa raramente (Auditoria).
const GRUPOS = [
  {
    label: "Visão geral",
    itens: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Comercial",
    itens: [
      { id: "clientes", label: "Clientes 360º", icon: Building2 },
      { id: "leads", label: "Leads / CRM", icon: Users },
      { id: "atendimentos", label: "Atendimentos", icon: Target },
      { id: "agenda", label: "Agenda", icon: CalendarDays },
    ],
  },
  {
    label: "Diagnóstico & produtos",
    itens: [
      { id: "diagnosticos", label: "Diagnósticos", icon: Gauge },
      { id: "tributario", label: "Inteligência Tributária", icon: Gauge },
    ],
  },
  {
    label: "Financeiro",
    itens: [
      { id: "asaas", label: "Asaas Financeiro", icon: Activity },
    ],
  },
  {
    label: "Administração",
    itens: [
      { id: "equipe", label: "Equipe / Capacidade", icon: Activity },
      { id: "usuarios", label: "Usuários e Acessos", icon: ShieldCheck },
      { id: "auditoria", label: "Auditoria", icon: History },
    ],
  },
];

const TODOS_ITENS = GRUPOS.flatMap((g) => g.itens);

export function FinderSidebar({
  aba,
  setAba,
  onLogout,
}) {
  const [colapsado, setColapsado] = useState(false);
  const [recentes, setRecentes] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("finder_admin_recentes") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!aba) return;
    setRecentes((atual) => {
      const proximo = [aba, ...atual.filter((id) => id !== aba)].slice(0, 4);
      try {
        sessionStorage.setItem("finder_admin_recentes", JSON.stringify(proximo));
      } catch {}
      return proximo;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba]);

  const recentesParaMostrar = recentes.filter((id) => id !== aba).slice(0, 3);

  return (
    <aside
      className="finder-sidebar"
      style={{
        position: "sticky",
        top: 0,
        width: colapsado ? 76 : 250,
        height: "100vh",
        padding: colapsado ? "20px 10px" : "20px 14px",
        background:
          "linear-gradient(180deg,#08111F 0%,#0A1424 100%)",
        color: C.text,
        boxSizing: "border-box",
        overflowY: "auto",
        overflowX: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "width .18s ease, padding .18s ease",
        flex: "none",
      }}
    >
      <div
        style={{
          padding: "8px 6px 18px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: colapsado ? "center" : "flex-start",
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            flex: "none",
            background:
              "linear-gradient(135deg,#4F7CFF,#16C7D9)",
            boxShadow:
              "0 8px 22px rgba(79,124,255,.32)",
          }}
        >
          <Sparkles size={18} />
        </div>

        {!colapsado && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: .4 }}>
              FINDER
            </div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 1, letterSpacing: 1.1 }}>
              INTELLIGENCE
            </div>
          </div>
        )}
      </div>

      {!colapsado && recentesParaMostrar.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 8, color: C.muted, fontWeight: 900, letterSpacing: 1.2, padding: "0 10px 7px" }}>
            RECENTES
          </div>
          {recentesParaMostrar.map((id) => {
            const item = TODOS_ITENS.find((i) => i.id === id);
            if (!item) return null;
            const Icon = item.icon;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setAba(id)}
                title={item.label}
                style={{
                  width: "100%",
                  border: 0,
                  borderRadius: 10,
                  padding: "7px 10px",
                  marginBottom: 3,
                  background: "rgba(255,255,255,.04)",
                  color: C.muted,
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                <Icon size={13} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <div style={{ flex: 1 }}>
        {GRUPOS.map((grupo) => (
          <div key={grupo.label} style={{ marginBottom: 4 }}>
            {!colapsado && (
              <div style={{ fontSize: 8, color: C.muted, fontWeight: 900, letterSpacing: 1.2, padding: "10px 10px 7px" }}>
                {grupo.label.toUpperCase()}
              </div>
            )}
            <div style={{ display: "grid", gap: 4 }}>
              {grupo.itens.map((item) => {
                const Icon = item.icon;
                const ativo = aba === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    title={colapsado ? item.label : undefined}
                    onClick={() => setAba(item.id)}
                    style={{
                      width: "100%",
                      border: 0,
                      borderRadius: 12,
                      padding: colapsado ? "10px 0" : "10px 11px",
                      background: ativo
                        ? "linear-gradient(90deg,rgba(79,124,255,.22),rgba(22,199,217,.10))"
                        : "transparent",
                      color: ativo ? C.white : C.muted,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: colapsado ? "center" : "flex-start",
                      gap: 10,
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: 10.5,
                      fontWeight: ativo ? 900 : 700,
                      borderLeft: ativo ? "3px solid #4F7CFF" : "3px solid transparent",
                    }}
                  >
                    <Icon size={15} color={ativo ? C.cyan : C.muted} />
                    {!colapsado && <span style={{ flex: 1 }}>{item.label}</span>}
                    {!colapsado && ativo && <ChevronRight size={13} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setColapsado((v) => !v)}
        style={{
          marginTop: 10,
          width: "100%",
          border: "1px solid rgba(255,255,255,.08)",
          background: "rgba(255,255,255,.03)",
          color: C.muted,
          borderRadius: 12,
          padding: "9px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        {colapsado ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
      </button>

      {!colapsado && (
        <div
          style={{
            marginTop: 10,
            padding: "12px 10px",
            borderRadius: 14,
            background:
              "linear-gradient(135deg,rgba(79,124,255,.16),rgba(22,199,217,.08))",
            border:
              "1px solid rgba(255,255,255,.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Bot size={16} color={C.cyan} />
            <div style={{ fontSize: 9.5, fontWeight: 800 }}>Finder AI</div>
          </div>
          <div style={{ fontSize: 8.3, color: C.muted, marginTop: 5, lineHeight: 1.4 }}>
            Diagnósticos, documentos, propostas e próximos passos assistidos por IA.
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onLogout}
        style={{
          marginTop: 10,
          width: "100%",
          border: "1px solid rgba(255,255,255,.08)",
          background: "transparent",
          color: C.muted,
          borderRadius: 12,
          padding: "9px 0",
          fontSize: 10.5,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        {colapsado ? "⏻" : "Sair do sistema"}
      </button>
    </aside>
  );
}

export function FinderTopbar({
  titulo,
  subtitulo,
  usuarioNome = "Finder",
  token = "",
  onAbrirResultado,
}) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState({ clientes: [], leads: [], diagnosticos: [] });
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberto(true);
        setTimeout(() => inputRef.current?.focus(), 20);
      }
      if (e.key === "Escape") setAberto(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!termo.trim() || termo.trim().length < 2) {
      setResultado({ clientes: [], leads: [], diagnosticos: [] });
      return;
    }
    timerRef.current = setTimeout(async () => {
      setCarregando(true);
      try {
        const r = await fetch(`/api/crm?action=busca-rapida&q=${encodeURIComponent(termo.trim())}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json().catch(() => null);
        if (d?.sucesso) {
          setResultado({ clientes: d.clientes || [], leads: d.leads || [], diagnosticos: d.diagnosticos || [] });
        }
      } catch {
        // busca é um atalho, não uma ação crítica — falha silenciosa é aceitável aqui
      } finally {
        setCarregando(false);
      }
    }, 280);
    return () => clearTimeout(timerRef.current);
  }, [termo, token]);

  function selecionar(tipo, item) {
    setAberto(false);
    setTermo("");
    onAbrirResultado?.(tipo, item);
  }

  const semResultado =
    !carregando &&
    termo.trim().length >= 2 &&
    !resultado.clientes.length &&
    !resultado.leads.length &&
    !resultado.diagnosticos.length;

  return (
    <header
      className="finder-topbar"
      style={{
        minHeight: 74,
        padding: "14px 20px",
        boxSizing: "border-box",
        background: "rgba(255,255,255,.92)",
        borderBottom: "1px solid #E8ECF3",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(14px)",
      }}
    >
      <div>
        <div style={{ color: C.textDark, fontSize: 18, fontWeight: 900 }}>
          {titulo}
        </div>
        {subtitulo && (
          <div style={{ color: C.mutedDark, fontSize: 9.5, marginTop: 2 }}>
            {subtitulo}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div className="finder-search-global" style={{ position: "relative" }}>
          <div
            onClick={() => { setAberto(true); setTimeout(() => inputRef.current?.focus(), 20); }}
            style={{
              minWidth: 260,
              border: "1px solid #E3E7EF",
              background: "#F8FAFD",
              borderRadius: 12,
              padding: "9px 11px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: C.mutedDark,
              cursor: "text",
            }}
          >
            <Search size={14} />
            <span style={{ fontSize: 9.5, flex: 1 }}>Buscar cliente, lead, diagnóstico...</span>
            <span style={{ fontSize: 8.5, border: "1px solid #E3E7EF", borderRadius: 5, padding: "1px 5px" }}>⌘K</span>
          </div>

          {aberto && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                left: 0,
                width: 360,
                background: "#fff",
                borderRadius: 16,
                border: "1px solid #E3E7EF",
                boxShadow: "0 24px 50px rgba(15,25,45,.2)",
                zIndex: 200,
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid #EEF0F4" }}>
                <Search size={14} color={C.mutedDark} />
                <input
                  ref={inputRef}
                  autoFocus
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  placeholder="Digite um nome ou CNPJ..."
                  style={{ border: 0, outline: 0, flex: 1, fontSize: 12.5, fontFamily: "inherit" }}
                />
                <button type="button" onClick={() => setAberto(false)} style={{ border: 0, background: "none", cursor: "pointer", color: C.mutedDark }}>
                  <X size={14} />
                </button>
              </div>

              <div style={{ maxHeight: 340, overflowY: "auto", padding: 6 }}>
                {carregando && <div style={{ padding: 14, fontSize: 11, color: C.mutedDark }}>Buscando...</div>}
                {semResultado && <div style={{ padding: 14, fontSize: 11, color: C.mutedDark }}>Nada encontrado para "{termo}".</div>}
                {!carregando && termo.trim().length < 2 && (
                  <div style={{ padding: 14, fontSize: 10.5, color: C.mutedDark }}>Digite ao menos 2 letras para buscar em Clientes, Leads e Diagnósticos.</div>
                )}

                {resultado.clientes.length > 0 && (
                  <GrupoResultado label="Clientes" cor={C.primary} itens={resultado.clientes} onSelecionar={(item) => selecionar("cliente", item)} />
                )}
                {resultado.leads.length > 0 && (
                  <GrupoResultado label="Leads" cor={C.cyan} itens={resultado.leads} onSelecionar={(item) => selecionar("lead", item)} />
                )}
                {resultado.diagnosticos.length > 0 && (
                  <GrupoResultado label="Diagnósticos" cor={C.coral} itens={resultado.diagnosticos} onSelecionar={(item) => selecionar("diagnostico", item)} />
                )}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 9px",
            borderRadius: 12,
            background: "#F8FAFD",
            border: "1px solid #E3E7EF",
          }}
        >
          <CircleUserRound size={20} color={C.primary} />
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 900, color: C.textDark }}>{usuarioNome}</div>
            <div style={{ fontSize: 7.8, color: C.mutedDark }}>Operação Finder</div>
          </div>
        </div>
      </div>

      {aberto && (
        <div
          onClick={() => setAberto(false)}
          style={{ position: "fixed", inset: 0, zIndex: 150 }}
        />
      )}
    </header>
  );
}

function GrupoResultado({ label, cor, itens, onSelecionar }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 900, color: C.mutedDark, letterSpacing: .5, padding: "8px 8px 4px" }}>
        {label.toUpperCase()}
      </div>
      {itens.map((item) => (
        <div
          key={item.id}
          onClick={() => onSelecionar(item)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 8px",
            borderRadius: 10,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F7FB")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: cor,
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 11,
              fontWeight: 800,
              flex: "none",
            }}
          >
            {label[0]}
          </span>
          <span>
            <div style={{ fontSize: 11.5, color: C.textDark, fontWeight: 600 }}>{item.nome || "—"}</div>
            {item.meta && <div style={{ fontSize: 9.5, color: C.mutedDark }}>{item.meta}</div>}
          </span>
        </div>
      ))}
    </div>
  );
}
