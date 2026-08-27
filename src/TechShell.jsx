import {
  Activity,
  Bot,
  Building2,
  ChevronRight,
  CircleUserRound,
  Gauge,
  History,
  LayoutDashboard,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

import {
  finderTheme,
} from "./Theme";

const C =
  finderTheme.colors;

const itensPadrao = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "clientes",
    label: "Clientes 360º",
    icon: Building2,
  },
  {
    id: "leads",
    label: "Leads / CRM",
    icon: Users,
  },
  {
    id: "diagnosticos",
    label: "Diagnósticos",
    icon: Gauge,
  },
  {
    id: "atendimentos",
    label: "Atendimentos",
    icon: Target,
  },
  {
    id: "equipe",
    label: "Equipe / Capacidade",
    icon: Activity,
  },
  {
    id: "usuarios",
    label: "Usuários e Acessos",
    icon: ShieldCheck,
  },
  {
    id: "auditoria",
    label: "Auditoria",
    icon: History,
  },
  {
    id: "tributario",
    label: "Inteligência Tributária",
    icon: Gauge,
  },
];

export function FinderSidebar({
  aba,
  setAba,
  onLogout,
}) {
  return (
    <aside
      style={{
        position: "sticky",
        top: 0,
        height: "100vh",
        padding: "20px 14px",
        background:
          "linear-gradient(180deg,#08111F 0%,#0A1424 100%)",
        color: C.text,
        boxSizing: "border-box",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          padding: "8px 10px 18px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            background:
              "linear-gradient(135deg,#4F7CFF,#16C7D9)",
            boxShadow:
              "0 8px 22px rgba(79,124,255,.32)",
          }}
        >
          <Sparkles
            size={18}
          />
        </div>

        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: .4,
            }}
          >
            FINDER
          </div>

          <div
            style={{
              fontSize: 9,
              color: C.muted,
              marginTop: 1,
              letterSpacing: 1.1,
            }}
          >
            INTELLIGENCE
          </div>
        </div>
      </div>

      <div
        style={{
          fontSize: 8,
          color: C.muted,
          fontWeight: 900,
          letterSpacing: 1.2,
          padding: "0 10px 7px",
        }}
      >
        OPERAÇÃO
      </div>

      <div
        style={{
          display: "grid",
          gap: 4,
        }}
      >
        {itensPadrao.map(
          (item) => {
            const Icon =
              item.icon;

            const ativo =
              aba === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  setAba(
                    item.id
                  )
                }
                style={{
                  width: "100%",
                  border: 0,
                  borderRadius: 12,
                  padding:
                    "10px 11px",
                  background:
                    ativo
                      ? "linear-gradient(90deg,rgba(79,124,255,.22),rgba(22,199,217,.10))"
                      : "transparent",
                  color:
                    ativo
                      ? C.white
                      : C.muted,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 10.5,
                  fontWeight:
                    ativo
                      ? 900
                      : 700,
                  borderLeft:
                    ativo
                      ? "3px solid #4F7CFF"
                      : "3px solid transparent",
                }}
              >
                <Icon
                  size={15}
                  color={
                    ativo
                      ? C.cyan
                      : C.muted
                  }
                />

                <span
                  style={{
                    flex: 1,
                  }}
                >
                  {item.label}
                </span>

                {ativo && (
                  <ChevronRight
                    size={13}
                  />
                )}
              </button>
            );
          }
        )}
      </div>

      <div
        style={{
          marginTop: 20,
          padding: "12px 10px",
          borderRadius: 14,
          background:
            "linear-gradient(135deg,rgba(79,124,255,.16),rgba(22,199,217,.08))",
          border:
            "1px solid rgba(255,255,255,.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: C.cyan,
            fontWeight: 900,
            fontSize: 9.5,
          }}
        >
          <Bot size={14} />
          Finder AI
        </div>

        <div
          style={{
            color: C.muted,
            fontSize: 8.7,
            lineHeight: 1.45,
            marginTop: 6,
          }}
        >
          Diagnósticos, documentos, propostas e próximos passos assistidos por IA.
        </div>
      </div>

      <button
        type="button"
        onClick={onLogout}
        style={{
          marginTop: 20,
          width: "100%",
          border:
            "1px solid rgba(255,255,255,.08)",
          background:
            "transparent",
          color: C.muted,
          borderRadius: 11,
          padding: "9px 10px",
          cursor: "pointer",
          fontSize: 9.5,
          fontWeight: 800,
        }}
      >
        Sair do sistema
      </button>
    </aside>
  );
}

export function FinderTopbar({
  titulo,
  subtitulo,
  usuarioNome = "Finder",
}) {
  return (
    <header
      style={{
        minHeight: 74,
        padding:
          "14px 20px",
        boxSizing:
          "border-box",
        background:
          "rgba(255,255,255,.92)",
        borderBottom:
          "1px solid #E8ECF3",
        display: "flex",
        alignItems: "center",
        justifyContent:
          "space-between",
        gap: 14,
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter:
          "blur(14px)",
      }}
    >
      <div>
        <div
          style={{
            color: C.textDark,
            fontSize: 18,
            fontWeight: 900,
          }}
        >
          {titulo}
        </div>

        {subtitulo && (
          <div
            style={{
              color:
                C.mutedDark,
              fontSize: 9.5,
              marginTop: 2,
            }}
          >
            {subtitulo}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
        }}
      >
        <div
          style={{
            minWidth: 260,
            border:
              "1px solid #E3E7EF",
            background:
              "#F8FAFD",
            borderRadius: 12,
            padding:
              "9px 11px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            color:
              C.mutedDark,
          }}
        >
          <Search
            size={14}
          />

          <span
            style={{
              fontSize: 9.5,
            }}
          >
            Busca global
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 9px",
            borderRadius: 12,
            background:
              "#F8FAFD",
            border:
              "1px solid #E3E7EF",
          }}
        >
          <CircleUserRound
            size={20}
            color={C.primary}
          />

          <div>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 900,
                color:
                  C.textDark,
              }}
            >
              {usuarioNome}
            </div>

            <div
              style={{
                fontSize: 7.8,
                color:
                  C.mutedDark,
              }}
            >
              Operação Finder
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
