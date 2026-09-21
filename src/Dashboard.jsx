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
  Calculator,
  Scale,
  FileCheck2,
  FileText,
  ShieldAlert,
  LogIn,
  BarChart3,
} from "lucide-react";

const NAVY = "#17233D";
const CORAL = "#FF6B4A";
const MUTED = "#5B667A";
const WHITE = "#FFFFFF";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function txt(v) {
  return String(v ?? "").trim();
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

function Kpi({ titulo, valor, subtitulo, Icon, destaque = false, onClick }) {
  return (
    <Card style={{ borderTop: `4px solid ${destaque ? CORAL : "#D8DEEA"}` }}>
      <div onClick={onClick} style={{ display: "flex", justifyContent: "space-between", gap: 10, cursor:onClick?"pointer":"default" }}>
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
  onAbrirTributario,
}) {
  const [dados, setDados] = useState({});
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [origem, setOrigem] = useState("TODAS");
  const [financeiro, setFinanceiro] = useState({ resumo:{}, pagamentos:[] });
  const [agenda, setAgenda] = useState([]);

  // Complemento isolado: não altera os dados comerciais já existentes.
  const [tributario, setTributario] = useState({ projetos: [] });
  const [avisoTributario, setAvisoTributario] = useState("");
  const [sessaoExpirada, setSessaoExpirada] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro("");
    setAvisoTributario("");
    setSessaoExpirada(false);

    try {
      const token =
        sessionStorage.getItem("finder_admin_token") || "";

      if (!token) {
        setSessaoExpirada(true);
        setErro("Sua sessão não está disponível. Entre novamente.");
        return;
      }

      // DASHBOARD COMERCIAL — fluxo atual preservado.
      const r = await fetch(
        "/api/crm?action=dashboard",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const d = await r.json().catch(() => null);

      if (r.status === 401 || r.status === 403) {
        sessionStorage.removeItem("finder_admin_token");
        sessionStorage.removeItem("finder_admin_user");
        setSessaoExpirada(true);
        throw new Error(
          "Sua sessão expirou ou deixou de ser válida. Entre novamente."
        );
      }

      if (!r.ok || !d?.sucesso) {
        throw new Error(
          d?.error ||
          `A função /api/crm não retornou JSON válido (HTTP ${r.status}).`
        );
      }

      setDados(d?.dashboard || d?.dados || d || {});

      const [rf, ra] = await Promise.allSettled([
        fetch("/api/asaas?acao=admin-painel", { headers:{Authorization:`Bearer ${token}`} }).then(x=>x.json()),
        fetch("/api/crm?action=listar-agendamentos", { headers:{Authorization:`Bearer ${token}`} }).then(x=>x.json()),
      ]);
      if(rf.status==="fulfilled"&&rf.value?.ok)setFinanceiro(rf.value);
      if(ra.status==="fulfilled"&&ra.value?.sucesso)setAgenda(ra.value.agendamentos||[]);

      // INTELIGÊNCIA TRIBUTÁRIA — consulta separada.
      // Se falhar, NÃO derruba o Dashboard comercial.
      try {
        const rt = await fetch(
          "/api/tributario?action=listar-projetos&arquivamento=ATIVOS",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const dt = await rt.json().catch(() => null);

        if (rt.status === 401 || rt.status === 403) {
          sessionStorage.removeItem("finder_admin_token");
          sessionStorage.removeItem("finder_admin_user");
          setSessaoExpirada(true);
          throw new Error("Sessão tributária inválida.");
        }

        if (!rt.ok || !dt?.sucesso) {
          throw new Error(
            dt?.error ||
              "Não foi possível carregar a Inteligência Tributária."
          );
        }

        setTributario({
          projetos: Array.isArray(dt.projetos)
            ? dt.projetos
            : [],
        });
      } catch (e) {
        setAvisoTributario(
          e?.message ||
            "Inteligência Tributária indisponível."
        );
        setTributario({ projetos: [] });
      }
    } catch (e) {
      const mensagem=e?.message||"Erro desconhecido.";
      setErro(
        mensagem==="Failed to fetch"
          ?"Não foi possível conectar à função /api/crm. Verifique o deploy e os logs da função no Vercel."
          :mensagem
      );
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
  const moeda=(v)=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  const hoje=new Date().toISOString().slice(0,10);
  const alertas=useMemo(()=>{
    const pagamentos=financeiro.pagamentos||[];
    return [
      {label:"Cobranças pendentes",valor:pagamentos.filter(p=>p.status==="PENDING").length,cor:"#8A5800"},
      {label:"Pagamentos com falha/atraso",valor:pagamentos.filter(p=>["OVERDUE","CANCELLED","DELETED"].includes(p.status)).length,cor:"#A12B2B"},
      {label:"Reuniões futuras",valor:agenda.filter(a=>a.status==="AGENDADO"&&String(a.data_agenda).slice(0,10)>=hoje).length,cor:"#2453A6"},
      {label:"Atendimentos em aberto",valor:n.atendimentos,cor:CORAL},
    ];
  },[financeiro,agenda,n.atendimentos,hoje]);

  const leads = origem === "TODAS"
    ? n.leads
    : n.leads.filter(
        (l) =>
          String(l.origem || l.utm_source || "direto").toLowerCase() ===
          origem.toLowerCase()
      );


  const tax = useMemo(() => {
    const projetos = tributario.projetos || [];

    const tipo = (x) =>
      txt(x.tipoProjeto).toLowerCase();

    const status = (x) =>
      txt(x.status).toUpperCase();

    const reforma = projetos.filter(
      (x) => tipo(x) === "reforma"
    );

    const planejamento = projetos.filter(
      (x) => tipo(x) === "planejamento"
    );

    const comDiagnostico = projetos.filter(
      (x) =>
        num(x.versaoAtual) > 0 ||
        ["DIAGNOSTICO_GERADO", "VALIDADO"].includes(
          status(x)
        )
    );

    const validados = projetos.filter(
      (x) =>
        status(x) === "VALIDADO" ||
        Boolean(txt(x.validadoPorNome))
    );

    const pendentes = projetos.filter(
      (x) =>
        !["VALIDADO", "CONCLUIDO"].includes(
          status(x)
        )
    );

    const documentosPendentes = projetos.filter(
      (x) => num(x.documentosPendentes) > 0
    );

    return {
      total: projetos.length,
      reforma: reforma.length,
      planejamento: planejamento.length,
      comDiagnostico: comDiagnostico.length,
      validados: validados.length,
      pendentes: pendentes.length,
      documentosPendentes: documentosPendentes.length,
      recentes: [...projetos]
        .sort(
          (a, b) =>
            new Date(b.atualizadoEm || 0) -
            new Date(a.atualizadoEm || 0)
        )
        .slice(0, 6),
      todos: [...projetos].sort(
        (a, b) =>
          new Date(b.atualizadoEm || 0) -
          new Date(a.atualizadoEm || 0)
      ),
    };
  }, [tributario]);

  // ==================== LEADS — funil por etapa, sem retorno ====================
  const leadsPorEtapa = useMemo(() => {
    const grupos = { ACESSOU: 0, EM_PREENCHIMENTO: 0, NAO_CONCLUIDO: 0, CONCLUIDO: 0, SEM_STATUS: 0 };
    for (const l of n.leads) {
      const s = txt(l.statusDiagnostico).toUpperCase();
      if (grupos[s] !== undefined) grupos[s] += 1;
      else grupos.SEM_STATUS += 1;
    }
    return grupos;
  }, [n.leads]);

  const LIMITE_SEM_RETORNO_MS = 3 * 24 * 60 * 60 * 1000; // 3 dias

  const leadsSemRetorno = useMemo(() => {
    const limite = Date.now() - LIMITE_SEM_RETORNO_MS;
    return n.leads.filter((l) => {
      const status = txt(l.status).toUpperCase();
      if (["CONVERTIDO", "PERDIDO", "DESCARTADO"].includes(status)) return false;
      const ultima = l.ultima_atividade || l.atualizado_em || l.criado_em;
      if (!ultima) return true;
      return new Date(ultima).getTime() < limite;
    });
  }, [n.leads]);

  function rotuloEtapaLead(l) {
    const sd = txt(l.statusDiagnostico).toUpperCase();
    if (sd === "CONCLUIDO") return "Diagnóstico concluído";
    if (sd === "NAO_CONCLUIDO") return "Não concluiu o formulário";
    if (sd === "EM_PREENCHIMENTO") return "Preenchendo o formulário";
    if (sd === "ACESSOU") return "Acessou, não iniciou";
    return "Sem diagnóstico iniciado";
  }

  function diasDesde(data) {
    if (!data) return null;
    const dias = Math.floor((Date.now() - new Date(data).getTime()) / 86400000);
    return Number.isFinite(dias) ? Math.max(0, dias) : null;
  }

  function formatarDataCurta(data) {
    if (!data) return "-";
    try {
      return new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
    } catch {
      return "-";
    }
  }

  // ==================== ATENDIMENTO — por área ====================
  const atendimentosPorArea = useMemo(() => {
    const mapa = {};
    for (const a of n.atendimentosLista) {
      const area = a.area || a.departamento || "Sem área";
      mapa[area] = (mapa[area] || 0) + 1;
    }
    return Object.entries(mapa)
      .map(([area, total]) => ({ area, total }))
      .sort((a, b) => b.total - a.total);
  }, [n.atendimentosLista]);

  const [abaAtiva, setAbaAtiva] = useState("geral");

  const ABAS_DASHBOARD = [
    { id: "geral", label: "Geral" },
    { id: "leads", label: "Leads" },
    { id: "diagnosticos", label: "Diagnósticos" },
    { id: "reforma", label: "Reforma + Planejamento" },
    { id: "atendimento", label: "Atendimento" },
    { id: "asaas", label: "Asaas" },
  ];

  function TabButton({ id, label }) {
    const ativa = abaAtiva === id;
    return (
      <button
        type="button"
        onClick={() => setAbaAtiva(id)}
        style={{
          border: ativa ? "1px solid " + CORAL : "1px solid #D8DEEA",
          background: ativa ? CORAL : WHITE,
          color: ativa ? WHITE : NAVY,
          borderRadius: 9,
          padding: "8px 13px",
          fontSize: 10.5,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        {label}
      </button>
    );
  }

  function TabelaClicavel({ colunas, linhas, vazio }) {
    return (
      <div style={{ overflow: "auto", marginTop: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr>
              {colunas.map((h) => (
                <th key={h} style={{ textAlign: "left", color: MUTED, fontSize: 9, padding: 7, borderBottom: "1px solid #E3E7EF" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas}
            {!linhas.length && (
              <tr>
                <td colSpan={colunas.length} style={{ padding: 18, textAlign: "center", color: MUTED }}>
                  {vazio || "Nenhum registro disponível."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

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
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <span>{erro}</span>

          {sessaoExpirada && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: 0,
                background: NAVY,
                color: WHITE,
                borderRadius: 8,
                padding: "7px 10px",
                fontSize: 9,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <LogIn size={13} />
              Entrar novamente
            </button>
          )}
        </div>
      )}

      {avisoTributario && !sessaoExpirada && (
        <div
          style={{
            background: "#FFF8E7",
            color: "#805B10",
            padding: 9,
            borderRadius: 9,
            marginBottom: 12,
            fontSize: 10,
          }}
        >
          {avisoTributario}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
          flexWrap: "wrap",
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

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {ABAS_DASHBOARD.map((a) => (
          <TabButton key={a.id} id={a.id} label={a.label} />
        ))}
      </div>

      {abaAtiva === "geral" && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(185px,1fr))",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <Kpi titulo="LEADS" valor={n.totalLeads} subtitulo="Base captada" Icon={Users} onClick={() => setAbaAtiva("leads")} />
            <Kpi titulo="DIAGNÓSTICOS" valor={n.diagnosticos} subtitulo="Análises geradas" Icon={Building2} onClick={() => setAbaAtiva("diagnosticos")} />
            <Kpi titulo="OPORTUNIDADES" valor={n.oportunidades} subtitulo="Leads qualificados" Icon={Flame} destaque onClick={() => setAbaAtiva("leads")} />
            <Kpi titulo="EM ATENDIMENTO" valor={n.atendimentos} subtitulo="Execução consultiva" Icon={Clock3} onClick={() => setAbaAtiva("atendimento")} />
            <Kpi titulo="PROPOSTAS" valor={n.propostas} subtitulo="Em negociação" Icon={Target} />
            <Kpi titulo="CONVERTIDOS" valor={n.convertidos} subtitulo={`${conversao}% da base`} Icon={CheckCircle2} destaque />
            <Kpi titulo="CRÍTICOS" valor={n.criticos} subtitulo="Prioridade comercial" Icon={AlertTriangle} onClick={() => setAbaAtiva("leads")} />
            <Kpi titulo="REFORMA TRIBUTÁRIA" valor={n.reforma} subtitulo="Interesse consultivo" Icon={Zap} destaque onClick={() => setAbaAtiva("reforma")} />
          </div>

          <Card style={{ marginBottom: 14, borderTop: `4px solid ${CORAL}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div>
                <strong>Funil comercial consolidado</strong>
                <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>Clique nas etapas para abrir os registros correspondentes.</div>
              </div>
              <TrendingUp size={19} color={CORAL} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6,minmax(130px,1fr))", gap: 7, overflowX: "auto" }}>
              {[
                ["Leads", n.totalLeads, "leads"],
                ["Diagnósticos", n.diagnosticos, "diagnosticos"],
                ["Oportunidades", n.oportunidades, "leads"],
                ["Atendimentos", n.atendimentos, "atendimento"],
                ["Propostas", n.propostas, "atendimento"],
                ["Convertidos", n.convertidos, "atendimento"],
              ].map(([label, valor, alvo], i, arr) => {
                const anterior = i ? num(arr[i - 1][1]) : valor;
                const taxa = i && anterior ? Math.round((num(valor) / anterior) * 100) : 100;
                return (
                  <div
                    key={label}
                    onClick={() => setAbaAtiva(alvo)}
                    style={{ background: i === arr.length - 1 ? "#E1F5EE" : "#F7F8FB", borderRadius: 11, padding: 11, minWidth: 120, cursor: "pointer" }}
                  >
                    <div style={{ fontSize: 9, color: MUTED, fontWeight: 900 }}>{label.toUpperCase()}</div>
                    <strong style={{ fontSize: 24 }}>{valor}</strong>
                    <div style={{ fontSize: 9, color: i === 0 ? MUTED : taxa >= 50 ? "#0F6E56" : "#993C1D", marginTop: 3 }}>
                      {i === 0 ? "Base captada" : `${taxa}% da etapa anterior`}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>Central de atenção</strong>
              <AlertTriangle size={18} color={CORAL} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8, marginTop: 10 }}>
              {alertas.map((a) => (
                <div key={a.label} style={{ border: "1px solid #E3E7EF", borderLeft: `4px solid ${a.cor}`, borderRadius: 9, padding: 10 }}>
                  <strong style={{ fontSize: 20, color: a.cor }}>{a.valor}</strong>
                  <div style={{ fontSize: 9.5, color: MUTED, marginTop: 3 }}>{a.label}</div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {abaAtiva === "leads" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 14 }}>
            <Kpi titulo="TOTAL DE LEADS" valor={n.totalLeads} subtitulo="Entraram na base" Icon={Users} />
            <Kpi titulo="PREENCHENDO" valor={leadsPorEtapa.EM_PREENCHIMENTO} subtitulo="Ainda no formulário" Icon={Clock3} />
            <Kpi titulo="NÃO CONCLUÍRAM" valor={leadsPorEtapa.NAO_CONCLUIDO} subtitulo="Abandonaram o formulário" Icon={AlertTriangle} destaque />
            <Kpi titulo="CONCLUÍDOS" valor={leadsPorEtapa.CONCLUIDO} subtitulo="Diagnóstico completo" Icon={CheckCircle2} />
            <Kpi titulo="SEM RETORNO 3+ DIAS" valor={leadsSemRetorno.length} subtitulo="Sem atividade recente" Icon={AlertTriangle} destaque />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(230px,.7fr) minmax(480px,1.6fr)", gap: 12, marginBottom: 14 }}>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>Origem dos leads</strong>
                <TrendingUp size={17} color={CORAL} />
              </div>
              <div style={{ color: MUTED, fontSize: 10, margin: "3px 0 10px" }}>De onde vieram.</div>
              {n.origens.map((o) => {
                const pct = n.totalLeads ? Math.round((o.total / n.totalLeads) * 100) : 0;
                return (
                  <button
                    key={o.origem}
                    type="button"
                    onClick={() => setOrigem(o.origem)}
                    style={{ width: "100%", border: 0, background: origem === o.origem ? "#FFF3EF" : "transparent", padding: "8px 0", cursor: "pointer", textAlign: "left" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5 }}>
                      <strong>{o.origem}</strong>
                      <span>{o.total} · {pct}%</span>
                    </div>
                    <div style={{ height: 5, background: "#EEF0F5", borderRadius: 999, marginTop: 5, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: CORAL }} />
                    </div>
                  </button>
                );
              })}
              {origem !== "TODAS" && (
                <button type="button" onClick={() => setOrigem("TODAS")} style={{ border: 0, background: "transparent", color: CORAL, fontWeight: 800, fontSize: 10, cursor: "pointer", marginTop: 8 }}>
                  Limpar filtro
                </button>
              )}
            </Card>

            <Card>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>Leads que merecem atenção</strong>
                <Activity size={17} color="#31589C" />
              </div>
              <div style={{ color: MUTED, fontSize: 10, margin: "3px 0 4px" }}>
                Quando entrou, onde parou e de onde veio — clique em "Abrir" pra ver o lead completo.
              </div>
              <TabelaClicavel
                colunas={["Lead", "Origem", "Entrou", "Onde parou", "Score", ""]}
                vazio="Nenhum lead disponível."
                linhas={leads.slice(0, 30).map((l, i) => (
                  <tr key={l.id || l.lead_id || i}>
                    <td style={{ padding: 7, fontSize: 10.5 }}>
                      <strong>{l.razao_social || l.razaoSocial || l.nome || "-"}</strong>
                    </td>
                    <td style={{ padding: 7, fontSize: 10 }}>{l.origem || l.utm_source || "direto"}</td>
                    <td style={{ padding: 7, fontSize: 10 }}>
                      {formatarDataCurta(l.primeiroAcesso || l.criado_em)}
                      <div style={{ color: MUTED, fontSize: 9 }}>{diasDesde(l.primeiroAcesso || l.criado_em)}d atrás</div>
                    </td>
                    <td style={{ padding: 7, fontSize: 10 }}>{rotuloEtapaLead(l)}</td>
                    <td style={{ padding: 7, fontSize: 10 }}>{l.score ?? l.score_geral ?? "-"}</td>
                    <td style={{ padding: 7 }}>
                      <button
                        type="button"
                        onClick={() => onAbrirLead?.(l.id || l.lead_id)}
                        style={{ border: 0, background: "#EEF3FF", color: "#31589C", borderRadius: 7, padding: "6px 8px", fontSize: 9, fontWeight: 800, cursor: "pointer" }}
                      >
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))}
              />
            </Card>
          </div>
        </>
      )}

      {abaAtiva === "diagnosticos" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 14 }}>
            <Kpi titulo="DIAGNÓSTICOS GERADOS" valor={n.diagnosticos} subtitulo="Análises concluídas" Icon={Building2} destaque />
            <Kpi titulo="EM PREENCHIMENTO" valor={leadsPorEtapa.EM_PREENCHIMENTO} subtitulo="Ainda no formulário" Icon={Clock3} />
            <Kpi titulo="NÃO CONCLUÍDOS" valor={leadsPorEtapa.NAO_CONCLUIDO} subtitulo="Abandonaram" Icon={AlertTriangle} />
            <Kpi titulo="ACESSOU E NÃO INICIOU" valor={leadsPorEtapa.ACESSOU} subtitulo="Abriu o link só" Icon={Users} />
          </div>

          <Card>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>Diagnósticos por status</strong>
              <BarChart3 size={17} color={CORAL} />
            </div>
            <TabelaClicavel
              colunas={["Lead", "Origem", "Status", "Entrou", ""]}
              vazio="Nenhum diagnóstico disponível."
              linhas={n.leads.slice(0, 40).map((l, i) => (
                <tr key={l.id || l.lead_id || i}>
                  <td style={{ padding: 7, fontSize: 10.5 }}>
                    <strong>{l.razao_social || l.razaoSocial || l.nome || "-"}</strong>
                  </td>
                  <td style={{ padding: 7, fontSize: 10 }}>{l.origem || "direto"}</td>
                  <td style={{ padding: 7, fontSize: 10 }}>{rotuloEtapaLead(l)}</td>
                  <td style={{ padding: 7, fontSize: 10 }}>{formatarDataCurta(l.primeiroAcesso || l.criado_em)}</td>
                  <td style={{ padding: 7 }}>
                    {l.diagnosticoId ? (
                      <button
                        type="button"
                        onClick={() => onAbrirDiagnostico?.(l.diagnosticoId)}
                        style={{ border: 0, background: "#EEF3FF", color: "#31589C", borderRadius: 7, padding: "6px 8px", fontSize: 9, fontWeight: 800, cursor: "pointer" }}
                      >
                        Abrir
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAbrirLead?.(l.id || l.lead_id)}
                        style={{ border: "1px solid #D8DEEA", background: WHITE, color: NAVY, borderRadius: 7, padding: "6px 8px", fontSize: 9, fontWeight: 800, cursor: "pointer" }}
                      >
                        Ver lead
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            />
          </Card>
        </>
      )}

      {abaAtiva === "reforma" && (
        <Card style={{ borderTop: `4px solid ${CORAL}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 900, color: CORAL }}>INTELIGÊNCIA TRIBUTÁRIA</div>
              <h3 style={{ margin: "3px 0" }}>Reforma Tributária + Planejamento</h3>
              <div style={{ fontSize: 10, color: MUTED }}>Projetos efetivamente salvos no módulo tributário.</div>
            </div>
            <BarChart3 size={21} color={CORAL} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}>
            <Kpi titulo="PROJETOS ATIVOS" valor={tax.total} subtitulo="Base tributária ativa" Icon={Calculator} />
            <Kpi titulo="REFORMA IBS/CBS" valor={tax.reforma} subtitulo="Projetos de Reforma" Icon={Zap} destaque />
            <Kpi titulo="PLANEJAMENTO" valor={tax.planejamento} subtitulo="Regime e eficiência" Icon={Scale} />
            <Kpi titulo="COM DIAGNÓSTICO" valor={tax.comDiagnostico} subtitulo="Versão gerada" Icon={FileCheck2} />
            <Kpi titulo="VALIDADOS" valor={tax.validados} subtitulo="Validação técnica" Icon={CheckCircle2} />
            <Kpi titulo="PENDENTES" valor={tax.pendentes} subtitulo="Exigem continuidade" Icon={ShieldAlert} />
            <Kpi titulo="DOCUMENTOS PENDENTES" valor={tax.documentosPendentes} subtitulo="Checklist documental" Icon={FileText} />
          </div>

          {!!tax.todos.length && (
            <div style={{ marginTop: 14 }}>
              <strong style={{ fontSize: 11 }}>Projetos tributários</strong>
              <TabelaClicavel
                colunas={["Cliente", "Tipo", "Status", ""]}
                vazio="Nenhum projeto tributário."
                linhas={tax.todos.slice(0, 40).map((p, i) => (
                  <tr key={p.id || i}>
                    <td style={{ padding: 7, fontSize: 10.5 }}>
                      <strong>{p.clienteNome || p.cnpj || "Cliente não identificado"}</strong>
                      <div style={{ color: MUTED, fontSize: 9 }}>{p.responsavelFinder || "Sem responsável"}</div>
                    </td>
                    <td style={{ padding: 7, fontSize: 10 }}>{txt(p.tipoProjeto).toLowerCase() === "reforma" ? "Reforma" : "Planejamento"}</td>
                    <td style={{ padding: 7, fontSize: 10 }}>{p.status || "EM_ANALISE"}</td>
                    <td style={{ padding: 7 }}>
                      <button
                        type="button"
                        onClick={() => onAbrirTributario?.(p.id)}
                        style={{ border: 0, background: "#EEF3FF", color: "#31589C", borderRadius: 7, padding: "6px 8px", fontSize: 9, fontWeight: 800, cursor: "pointer" }}
                      >
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))}
              />
            </div>
          )}
        </Card>
      )}

      {abaAtiva === "atendimento" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 14 }}>
            <Kpi titulo="EM ATENDIMENTO" valor={n.atendimentos} subtitulo="Execução consultiva" Icon={Clock3} destaque />
            {atendimentosPorArea.slice(0, 4).map((a) => (
              <Kpi key={a.area} titulo={a.area.toUpperCase()} valor={a.total} subtitulo="Casos abertos" Icon={Target} />
            ))}
          </div>

          <Card>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>Atendimentos em movimento</strong>
              <Clock3 size={17} color={CORAL} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 8, marginTop: 10 }}>
              {n.atendimentosLista.slice(0, 30).map((a, i) => (
                <button
                  key={a.id || a.atendimento_id || i}
                  type="button"
                  onClick={() => onAbrirAtendimento?.(a.id || a.atendimento_id)}
                  style={{ border: "1px solid #E3E7EF", background: "#FAFBFD", borderRadius: 10, padding: 10, cursor: "pointer", textAlign: "left" }}
                >
                  <strong style={{ fontSize: 11 }}>{a.razao_social || a.empresa || a.nome || "Atendimento"}</strong>
                  <div style={{ color: MUTED, fontSize: 9.5, marginTop: 5 }}>
                    {a.departamento || a.area || "-"} · {a.status || a.etapa || "-"}
                  </div>
                </button>
              ))}
              {!n.atendimentosLista.length && (
                <div style={{ color: MUTED, fontSize: 11, padding: 20, textAlign: "center" }}>Nenhum atendimento em aberto.</div>
              )}
            </div>
          </Card>
        </>
      )}

      {abaAtiva === "asaas" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 14 }}>
            <Kpi titulo="RECEITA BRUTA" valor={moeda(financeiro.resumo?.bruto)} subtitulo={`${financeiro.resumo?.recebidos || 0} pagamentos recebidos`} Icon={TrendingUp} destaque />
            <Kpi titulo="RECEITA LÍQUIDA" valor={moeda(financeiro.resumo?.liquido)} subtitulo={`Taxas: ${moeda(financeiro.resumo?.taxas)}`} Icon={CheckCircle2} />
            <Kpi titulo="DESCONTOS" valor={moeda(financeiro.resumo?.descontos)} subtitulo="Cupons concedidos" Icon={Calculator} />
            <Kpi titulo="PENDENTES" valor={financeiro.resumo?.pendentes || 0} subtitulo="Cobranças não concluídas" Icon={Clock3} destaque />
          </div>

          <Card>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>Pagamentos recentes</strong>
              <TrendingUp size={17} color={CORAL} />
            </div>
            <TabelaClicavel
              colunas={["Cliente", "Valor", "Status", "Data"]}
              vazio="Nenhum pagamento carregado. Veja o detalhamento completo em Asaas Financeiro."
              linhas={(financeiro.pagamentos || []).slice(0, 30).map((p, i) => (
                <tr key={p.id || i}>
                  <td style={{ padding: 7, fontSize: 10.5 }}>{p.nomeCliente || p.cliente || p.descricao || "-"}</td>
                  <td style={{ padding: 7, fontSize: 10 }}>{moeda(p.valor)}</td>
                  <td style={{ padding: 7, fontSize: 10 }}>{p.status || "-"}</td>
                  <td style={{ padding: 7, fontSize: 10 }}>{formatarDataCurta(p.dataVencimento || p.data)}</td>
                </tr>
              ))}
            />
          </Card>
        </>
      )}
    </main>
  );
}
