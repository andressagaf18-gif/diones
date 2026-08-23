import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock3,
  Flame,
  RefreshCcw,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

const NAVY = "#17233D";
const CORAL = "#FF6B4A";
const MUTED = "#5B667A";
const WHITE = "#FFFFFF";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function Card({ children, style = {} }) {
  return (
    <div
      style={{
        background: WHITE,
        border: "1px solid #E3E7EF",
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 8px 24px rgba(23,35,61,.05)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Kpi({ titulo, valor, subtitulo, Icon, destaque = false }) {
  return (
    <Card style={{ borderTop: `4px solid ${destaque ? CORAL : "#D8DEEA"}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 900, color: MUTED }}>
            {titulo}
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: NAVY, marginTop: 5 }}>
            {valor}
          </div>
          <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>
            {subtitulo}
          </div>
        </div>

        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            background: destaque ? "#FFF3EF" : "#EEF3FF",
            color: destaque ? CORAL : "#31589C",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={18} />
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard({
  onAbrirLead,
  onAbrirDiagnostico,
  onAbrirAtendimento,
}) {
  const [dados, setDados] = useState({});
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [origem, setOrigem] = useState("TODAS");

  async function carregar() {
    setCarregando(true);
    setErro("");

    try {
      const token =
        sessionStorage.getItem("finder_admin_token") || "";

      const r = await fetch(
        "/api/crm?action=dashboard",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const d = await r.json().catch(() => null);

      if (!r.ok) {
        throw new Error(d?.error || "Erro ao carregar dashboard.");
      }

      setDados(d?.dashboard || d?.dados || d || {});
    } catch (e) {
      setErro(e?.message || "Erro ao carregar dashboard.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const n = useMemo(() => {
    const d = dados || {};

    const leads =
      Array.isArray(d.leads)
        ? d.leads
        : Array.isArray(d.ultimosLeads)
        ? d.ultimosLeads
        : [];

    const atendimentos =
      Array.isArray(d.atendimentos)
        ? d.atendimentos
        : Array.isArray(d.ultimosAtendimentos)
        ? d.ultimosAtendimentos
        : [];

    const raw = d.origens || d.porOrigem || {};
    let origens = [];

    if (Array.isArray(raw)) {
      origens = raw.map((x) => ({
        origem: x.origem || x.nome || "direto",
        total: num(x.total || x.leads || x.quantidade),
      }));
    } else if (raw && typeof raw === "object") {
      origens = Object.entries(raw).map(([nome, v]) => ({
        origem: nome,
        total: typeof v === "number" ? v : num(v?.total || v?.leads),
      }));
    }

    return {
      totalLeads: num(d.totalLeads || d.leadsTotal || d.resumo?.totalLeads || leads.length),
      diagnosticos: num(d.totalDiagnosticos || d.diagnosticos || d.resumo?.diagnosticos),
      oportunidades: num(d.oportunidades || d.qualificados || d.resumo?.oportunidades),
      atendimentos: num(d.atendimentosAbertos || d.emAtendimento || d.resumo?.atendimentosAbertos),
      propostas: num(d.propostas || d.resumo?.propostas),
      convertidos: num(d.convertidos || d.ganhos || d.resumo?.convertidos),
      criticos: num(d.criticos || d.leadsCriticos || d.resumo?.criticos),
      reforma: num(d.reformaTributaria || d.interesseReforma || d.resumo?.reformaTributaria),
      leads,
      atendimentosLista: atendimentos,
      origens: origens.sort((a, b) => b.total - a.total),
    };
  }, [dados]);

  const conversao =
    n.totalLeads > 0
      ? Math.round((n.convertidos / n.totalLeads) * 100)
      : 0;

  const leads = origem === "TODAS"
    ? n.leads
    : n.leads.filter(
        (l) =>
          String(l.origem || l.utm_source || "direto").toLowerCase() ===
          origem.toLowerCase()
      );

  if (carregando) {
    return (
      <main style={{ maxWidth: 1320, margin: "0 auto", padding: 24 }}>
        <Card>Carregando dashboard...</Card>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 1320,
        margin: "0 auto",
        padding: "26px 22px 50px",
        color: NAVY,
      }}
    >
      {erro && (
        <div
          style={{
            background: "#FAECE7",
            color: "#993C1D",
            padding: 10,
            borderRadius: 9,
            marginBottom: 12,
          }}
        >
          {erro}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Visão executiva</h2>
          <div style={{ color: MUTED, fontSize: 11, marginTop: 3 }}>
            Captação → diagnóstico → oportunidade → atendimento → proposta → conversão
          </div>
        </div>

        <button
          type="button"
          onClick={carregar}
          style={{
            border: "1px solid #D8DEEA",
            background: WHITE,
            borderRadius: 9,
            padding: "9px 11px",
            cursor: "pointer",
          }}
        >
          <RefreshCcw size={14} />
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(185px,1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <Kpi titulo="LEADS" valor={n.totalLeads} subtitulo="Base captada" Icon={Users} />
        <Kpi titulo="DIAGNÓSTICOS" valor={n.diagnosticos} subtitulo="Análises geradas" Icon={Building2} />
        <Kpi titulo="OPORTUNIDADES" valor={n.oportunidades} subtitulo="Leads qualificados" Icon={Flame} destaque />
        <Kpi titulo="EM ATENDIMENTO" valor={n.atendimentos} subtitulo="Execução consultiva" Icon={Clock3} />
        <Kpi titulo="PROPOSTAS" valor={n.propostas} subtitulo="Em negociação" Icon={Target} />
        <Kpi titulo="CONVERTIDOS" valor={n.convertidos} subtitulo={`${conversao}% da base`} Icon={CheckCircle2} destaque />
        <Kpi titulo="CRÍTICOS" valor={n.criticos} subtitulo="Prioridade comercial" Icon={AlertTriangle} />
        <Kpi titulo="REFORMA TRIBUTÁRIA" valor={n.reforma} subtitulo="Interesse consultivo" Icon={Zap} destaque />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px,.8fr) minmax(480px,1.7fr)",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>Origem dos leads</strong>
            <TrendingUp size={17} color={CORAL} />
          </div>

          <div style={{ color: MUTED, fontSize: 10, margin: "3px 0 10px" }}>
            Descubra quais ações realmente geram oportunidades.
          </div>

          {n.origens.map((o) => {
            const pct = n.totalLeads
              ? Math.round((o.total / n.totalLeads) * 100)
              : 0;

            return (
              <button
                key={o.origem}
                type="button"
                onClick={() => setOrigem(o.origem)}
                style={{
                  width: "100%",
                  border: 0,
                  background: origem === o.origem ? "#FFF3EF" : "transparent",
                  padding: "8px 0",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5 }}>
                  <strong>{o.origem}</strong>
                  <span>{o.total} · {pct}%</span>
                </div>

                <div
                  style={{
                    height: 5,
                    background: "#EEF0F5",
                    borderRadius: 999,
                    marginTop: 5,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(pct, 100)}%`,
                      height: "100%",
                      background: CORAL,
                    }}
                  />
                </div>
              </button>
            );
          })}

          {origem !== "TODAS" && (
            <button
              type="button"
              onClick={() => setOrigem("TODAS")}
              style={{
                border: 0,
                background: "transparent",
                color: CORAL,
                fontWeight: 800,
                fontSize: 10,
                cursor: "pointer",
                marginTop: 8,
              }}
            >
              Limpar filtro
            </button>
          )}
        </Card>

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>Leads que merecem atenção</strong>
            <Activity size={17} color="#31589C" />
          </div>

          <div style={{ overflow: "auto", marginTop: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 650 }}>
              <thead>
                <tr>
                  {["Lead", "Origem", "Score", "Status", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        color: MUTED,
                        fontSize: 9,
                        padding: 7,
                        borderBottom: "1px solid #E3E7EF",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {leads.slice(0, 12).map((l, i) => (
                  <tr key={l.id || l.lead_id || i}>
                    <td style={{ padding: 7, fontSize: 10.5 }}>
                      <strong>{l.razao_social || l.razaoSocial || l.nome || "-"}</strong>
                    </td>

                    <td style={{ padding: 7, fontSize: 10 }}>
                      {l.origem || l.utm_source || "direto"}
                    </td>

                    <td style={{ padding: 7, fontSize: 10 }}>
                      {l.score ?? l.score_geral ?? "-"}
                    </td>

                    <td style={{ padding: 7, fontSize: 10 }}>
                      {l.status || l.status_lead || "-"}
                    </td>

                    <td style={{ padding: 7 }}>
                      <button
                        type="button"
                        onClick={() => onAbrirLead?.(l.id || l.lead_id)}
                        style={{
                          border: 0,
                          background: "#EEF3FF",
                          color: "#31589C",
                          borderRadius: 7,
                          padding: "6px 8px",
                          fontSize: 9,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))}

                {!leads.length && (
                  <tr>
                    <td colSpan={5} style={{ padding: 18, textAlign: "center", color: MUTED }}>
                      Nenhum lead disponível.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <strong>Atendimentos em movimento</strong>
          <Clock3 size={17} color={CORAL} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
            gap: 8,
            marginTop: 10,
          }}
        >
          {n.atendimentosLista.slice(0, 12).map((a, i) => (
            <button
              key={a.id || a.atendimento_id || i}
              type="button"
              onClick={() =>
                onAbrirAtendimento?.(a.id || a.atendimento_id)
              }
              style={{
                border: "1px solid #E3E7EF",
                background: "#FAFBFD",
                borderRadius: 10,
                padding: 10,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <strong style={{ fontSize: 11 }}>
                {a.razao_social || a.empresa || a.nome || "Atendimento"}
              </strong>

              <div style={{ color: MUTED, fontSize: 9.5, marginTop: 5 }}>
                {a.departamento || a.area || "-"} · {a.status || a.etapa || "-"}
              </div>
            </button>
          ))}
        </div>
      </Card>
    </main>
  );
}
