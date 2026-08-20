import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Filter,
  Flame,
  LayoutDashboard,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";

const NAVY = "#17233d";
const CORAL = "#ff684f";
const BG = "#f4f6fa";
const BORDER = "#dfe5ef";
const MUTED = "#657089";

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pct(v) {
  return `${num(v).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })}%`;
}

function fmt(v) {
  return num(v).toLocaleString("pt-BR");
}

function authHeaders() {
  const token =
    localStorage.getItem("adminToken") ||
    sessionStorage.getItem("adminToken") ||
    localStorage.getItem("ADMIN_TOKEN") ||
    sessionStorage.getItem("ADMIN_TOKEN") ||
    "";

  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
}

function Card({ children, style, onClick, active }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff",
        border: `1px solid ${active ? CORAL : BORDER}`,
        borderRadius: 16,
        boxShadow: active
          ? "0 8px 24px rgba(255,104,79,.12)"
          : "0 5px 18px rgba(23,35,61,.045)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  detail,
  alert,
  onClick,
}) {
  return (
    <Card
      onClick={onClick}
      style={{
        padding: 18,
        cursor: onClick ? "pointer" : "default",
        minHeight: 126,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: MUTED,
              textTransform: "uppercase",
              letterSpacing: ".05em",
            }}
          >
            {label}
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 30,
              lineHeight: 1,
              fontWeight: 900,
              color: alert ? "#a83228" : NAVY,
            }}
          >
            {value}
          </div>
        </div>

        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            background: alert ? "#fff0ed" : "#f2f5fa",
            color: alert ? CORAL : NAVY,
          }}
        >
          <Icon size={19} />
        </div>
      </div>

      {detail ? (
        <div
          style={{
            marginTop: 12,
            fontSize: 12,
            color: MUTED,
          }}
        >
          {detail}
        </div>
      ) : null}
    </Card>
  );
}

function Select({
  value,
  onChange,
  children,
  title,
}) {
  return (
    <label style={{ display: "grid", gap: 5 }}>
      {title ? (
        <span
          style={{
            fontSize: 10,
            color: MUTED,
            fontWeight: 800,
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>
      ) : null}

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 40,
          minWidth: 145,
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
          background: "#fff",
          padding: "0 10px",
          color: NAVY,
          fontWeight: 650,
          outline: "none",
        }}
      >
        {children}
      </select>
    </label>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 15,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: "#fff0ed",
          color: CORAL,
          display: "grid",
          placeItems: "center",
        }}
      >
        <Icon size={18} />
      </div>
      <div>
        <div
          style={{
            fontSize: 17,
            fontWeight: 900,
            color: NAVY,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 12, color: MUTED }}>
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function HorizontalBars({
  data,
  labelKey = "label",
  valueKey = "quantidade",
  onClick,
  selected,
  suffix = "",
}) {
  const itens = arr(data);
  const max = Math.max(
    1,
    ...itens.map((x) => num(x[valueKey]))
  );

  if (!itens.length) {
    return <Empty />;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {itens.slice(0, 10).map((item) => {
        const value = num(item[valueKey]);
        const key = item.id || item[labelKey];
        const active =
          selected &&
          String(selected) === String(key);

        return (
          <button
            key={key}
            type="button"
            onClick={() => onClick?.(item)}
            style={{
              border: 0,
              padding: 0,
              background: "transparent",
              textAlign: "left",
              cursor: onClick ? "pointer" : "default",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                fontSize: 12,
                color: NAVY,
                fontWeight: active ? 900 : 700,
              }}
            >
              <span>{item[labelKey]}</span>
              <span>
                {fmt(value)}
                {suffix}
              </span>
            </div>
            <div
              style={{
                marginTop: 6,
                height: 9,
                borderRadius: 999,
                background: "#edf1f6",
                overflow: "hidden",
                outline: active
                  ? `2px solid ${CORAL}`
                  : "none",
              }}
            >
              <div
                style={{
                  width: `${Math.max(
                    value ? 4 : 0,
                    (value / max) * 100
                  )}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: active ? CORAL : NAVY,
                  transition: "width .25s ease",
                }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Empty() {
  return (
    <div
      style={{
        minHeight: 110,
        display: "grid",
        placeItems: "center",
        color: MUTED,
        fontSize: 13,
        textAlign: "center",
      }}
    >
      Sem dados para os filtros selecionados.
    </div>
  );
}

function Chip({ children, onRemove }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 9px",
        borderRadius: 999,
        background: "#fff0ed",
        color: "#9c3325",
        fontSize: 11,
        fontWeight: 800,
      }}
    >
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          style={{
            border: 0,
            background: "transparent",
            padding: 0,
            cursor: "pointer",
            color: "inherit",
            display: "grid",
          }}
        >
          <X size={12} />
        </button>
      ) : null}
    </span>
  );
}

export default function Dashboard({
  onAbrirLead,
  onAbrirDiagnostico,
  onAbrirAtendimento,
}) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [drill, setDrill] = useState(false);

  const [filtros, setFiltros] = useState({
    periodo: "30_dias",
    estrutura: "",
    origem: "",
    statusDiagnostico: "",
    area: "",
    responsavelId: "",
    statusAtendimento: "",
    statusOportunidade: "",
    prioridade: "",
  });

  function setFiltro(nome, valor) {
    setFiltros((atual) => ({
      ...atual,
      [nome]: valor,
    }));
  }

  function limparFiltros() {
    setFiltros({
      periodo: "30_dias",
      estrutura: "",
      origem: "",
      statusDiagnostico: "",
      area: "",
      responsavelId: "",
      statusAtendimento: "",
      statusOportunidade: "",
      prioridade: "",
    });
    setBusca("");
  }

  const query = useMemo(() => {
    const q = new URLSearchParams();

    Object.entries(filtros).forEach(([k, v]) => {
      if (v) q.set(k, v);
    });

    return q.toString();
  }, [filtros]);

  async function carregar() {
    setCarregando(true);
    setErro("");

    try {
      const resposta = await fetch(
        `/api/crm?action=dashboard${query ? `&${query}` : ""}`,
        {
          headers: {
            ...authHeaders(),
          },
        }
      );

      const json = await resposta.json();

      if (!resposta.ok || !json?.sucesso) {
        throw new Error(
          json?.error ||
            "Não foi possível carregar o Dashboard."
        );
      }

      setDados(json);
    } catch (e) {
      console.error("[Dashboard]", e);
      setErro(
        e?.message ||
          "Não foi possível carregar o Dashboard."
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const kpis = dados?.kpis || {};
  const disponiveis = dados?.filtrosDisponiveis || {};

  const registros = useMemo(() => {
    const lista = arr(dados?.registros);
    const termo = busca.trim().toLowerCase();

    if (!termo) return lista;

    return lista.filter((r) =>
      [
        r.nome,
        r.empresa,
        r.cnpj,
        r.telefone,
        r.email,
        r.estrutura,
        r.origem,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(termo)
    );
  }, [dados, busca]);

  const filtrosAtivos = useMemo(
    () =>
      Object.entries(filtros).filter(
        ([chave, valor]) =>
          chave !== "periodo" && Boolean(valor)
      ),
    [filtros]
  );

  const areaMaisCritica = arr(dados?.rankingAreas)
    .filter((x) => x.scoreMedio !== null)
    .sort(
      (a, b) => num(a.scoreMedio) - num(b.scoreMedio)
    )[0];

  if (carregando && !dados) {
    return (
      <div
        style={{
          minHeight: 500,
          display: "grid",
          placeItems: "center",
          background: BG,
          color: NAVY,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <RefreshCw
            size={30}
            style={{ marginBottom: 12 }}
          />
          <div style={{ fontWeight: 900 }}>
            Montando inteligência gerencial...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        color: NAVY,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          margin: "0 auto",
          padding: "22px 22px 50px",
        }}
      >
        {/* CABEÇALHO */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 18,
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                color: CORAL,
                fontSize: 11,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: ".08em",
              }}
            >
              <LayoutDashboard size={15} />
              Finder Intelligence
            </div>

            <h1
              style={{
                margin: "5px 0 3px",
                fontSize: 30,
                lineHeight: 1.1,
                fontFamily: "Georgia, serif",
              }}
            >
              Dashboard Executivo
            </h1>

            <div style={{ color: MUTED, fontSize: 13 }}>
              Diagnóstico, operação e oportunidades em uma
              única visão.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={limparFiltros}
              style={{
                height: 40,
                border: `1px solid ${BORDER}`,
                background: "#fff",
                borderRadius: 10,
                padding: "0 13px",
                fontWeight: 800,
                color: NAVY,
                cursor: "pointer",
              }}
            >
              Limpar filtros
            </button>

            <button
              type="button"
              onClick={carregar}
              style={{
                height: 40,
                border: 0,
                background: CORAL,
                color: "#fff",
                borderRadius: 10,
                padding: "0 14px",
                fontWeight: 900,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <RefreshCw size={15} />
              Atualizar
            </button>
          </div>
        </div>

        {/* FILTROS */}
        <Card style={{ padding: 14, marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "end",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                width: 36,
                height: 40,
                display: "grid",
                placeItems: "center",
                color: CORAL,
              }}
            >
              <Filter size={18} />
            </div>

            <Select
              title="Período"
              value={filtros.periodo}
              onChange={(v) => setFiltro("periodo", v)}
            >
              <option value="hoje">Hoje</option>
              <option value="7_dias">7 dias</option>
              <option value="30_dias">30 dias</option>
              <option value="este_mes">Este mês</option>
              <option value="todos">Todo período</option>
            </Select>

            <Select
              title="Estrutura"
              value={filtros.estrutura}
              onChange={(v) => setFiltro("estrutura", v)}
            >
              <option value="">Todas</option>
              {arr(disponiveis.estruturas).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </Select>

            <Select
              title="Origem"
              value={filtros.origem}
              onChange={(v) => setFiltro("origem", v)}
            >
              <option value="">Todas</option>
              {arr(disponiveis.origens).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </Select>

            <Select
              title="Área"
              value={filtros.area}
              onChange={(v) => setFiltro("area", v)}
            >
              <option value="">Todas</option>
              {arr(disponiveis.areas).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </Select>

            <Select
              title="Responsável"
              value={filtros.responsavelId}
              onChange={(v) =>
                setFiltro("responsavelId", v)
              }
            >
              <option value="">Todos</option>
              {arr(disponiveis.responsaveis).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </Select>

            <Select
              title="Atendimento"
              value={filtros.statusAtendimento}
              onChange={(v) =>
                setFiltro("statusAtendimento", v)
              }
            >
              <option value="">Todos</option>
              {arr(disponiveis.statusAtendimento).map(
                (x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                )
              )}
            </Select>

            <Select
              title="Oportunidade"
              value={filtros.statusOportunidade}
              onChange={(v) =>
                setFiltro("statusOportunidade", v)
              }
            >
              <option value="">Todas</option>
              {arr(disponiveis.statusOportunidade).map(
                (x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                )
              )}
            </Select>
          </div>

          {filtrosAtivos.length ? (
            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 7,
                flexWrap: "wrap",
              }}
            >
              {filtrosAtivos.map(([k, v]) => (
                <Chip
                  key={k}
                  onRemove={() => setFiltro(k, "")}
                >
                  {k}: {v}
                </Chip>
              ))}
            </div>
          ) : null}
        </Card>

        {erro ? (
          <div
            style={{
              marginBottom: 16,
              padding: 14,
              borderRadius: 12,
              background: "#fff0ed",
              color: "#9d3427",
              border: "1px solid #ffd3ca",
              fontWeight: 750,
            }}
          >
            {erro}
          </div>
        ) : null}

        {/* KPIs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <Kpi
            icon={Users}
            label="Leads"
            value={fmt(kpis.leads)}
            detail="Entradas no período"
            onClick={() => setDrill(true)}
          />
          <Kpi
            icon={BarChart3}
            label="Diagnósticos concluídos"
            value={fmt(kpis.diagnosticosConcluidos)}
            detail={`${pct(kpis.taxaConclusao)} de conclusão`}
            onClick={() => {
              setFiltro("statusDiagnostico", "CONCLUIDO");
              setDrill(true);
            }}
          />
          <Kpi
            icon={Activity}
            label="Atendimentos"
            value={fmt(kpis.atendimentos)}
            detail="Casos gerados por departamento"
          />
          <Kpi
            icon={Target}
            label="Oportunidades"
            value={fmt(kpis.oportunidades)}
            detail={`${fmt(kpis.propostas)} em proposta`}
          />
          <Kpi
            icon={CheckCircle2}
            label="Contratados"
            value={fmt(kpis.contratados)}
            detail="Conversões registradas"
          />
          <Kpi
            icon={AlertTriangle}
            label="Retornos atrasados"
            value={fmt(kpis.retornosAtrasados)}
            detail="Demandam atenção"
            alert={num(kpis.retornosAtrasados) > 0}
          />
        </div>

        {/* INSIGHT EXECUTIVO */}
        <Card
          style={{
            padding: 18,
            marginBottom: 18,
            background:
              "linear-gradient(135deg, #17233d 0%, #223252 100%)",
            color: "#fff",
            border: 0,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(220px,.8fr) minmax(300px,2fr)",
              gap: 20,
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  color: "#ff9b88",
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                }}
              >
                Leitura executiva
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontFamily: "Georgia, serif",
                  fontWeight: 800,
                  marginTop: 5,
                }}
              >
                O que merece atenção agora?
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(220px,1fr))",
                gap: 10,
              }}
            >
              {arr(dados?.insights)
                .slice(0, 3)
                .map((x, i) => (
                  <div
                    key={i}
                    style={{
                      border: "1px solid rgba(255,255,255,.13)",
                      borderRadius: 12,
                      padding: 12,
                      background: "rgba(255,255,255,.055)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 850,
                      }}
                    >
                      {x.titulo}
                    </div>
                    <div
                      style={{
                        marginTop: 5,
                        color: "#cfd6e4",
                        fontSize: 11,
                      }}
                    >
                      {x.descricao}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </Card>

        {/* FUNIL + ORIGEM */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0,1.45fr) minmax(300px,.75fr)",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <Card style={{ padding: 18 }}>
            <SectionTitle
              icon={TrendingUp}
              title="Funil de conversão"
              subtitle="Da entrada do lead ao fechamento"
            />

            <div style={{ display: "grid", gap: 8 }}>
              {arr(dados?.funil).map((item, i) => {
                const largura = Math.max(
                  22,
                  100 - i * 9
                );

                return (
                  <div
                    key={item.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 70px",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setDrill(true)}
                      style={{
                        width: `${largura}%`,
                        justifySelf: "center",
                        minHeight: 43,
                        border: 0,
                        borderRadius: 9,
                        background:
                          i === arr(dados?.funil).length - 1
                            ? CORAL
                            : NAVY,
                        color: "#fff",
                        padding: "8px 13px",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {item.label}
                      </span>
                      <strong>{fmt(item.quantidade)}</strong>
                    </button>

                    <div
                      style={{
                        fontSize: 11,
                        color: MUTED,
                        textAlign: "right",
                      }}
                    >
                      {i === 0
                        ? "Base"
                        : `${pct(
                            item.conversaoAnterior
                          )} conv.`}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card style={{ padding: 18 }}>
            <SectionTitle
              icon={Zap}
              title="Origem dos leads"
              subtitle="Clique para cruzar os dados"
            />
            <HorizontalBars
              data={dados?.origens}
              selected={filtros.origem}
              onClick={(item) =>
                setFiltro(
                  "origem",
                  filtros.origem === item.id ? "" : item.id
                )
              }
            />
          </Card>
        </div>

        {/* ÁREAS + ESTRUTURAS + SCORE */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(340px,1.35fr) minmax(270px,.8fr) minmax(270px,.8fr)",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <Card style={{ padding: 18 }}>
            <SectionTitle
              icon={Flame}
              title="Radar de oportunidades"
              subtitle={
                areaMaisCritica
                  ? `Menor score atual: ${areaMaisCritica.label} (${areaMaisCritica.scoreMedio})`
                  : "Áreas com maior incidência"
              }
            />

            <HorizontalBars
              data={arr(dados?.rankingAreas).map((x) => ({
                ...x,
                quantidade: x.quantidadeDiagnosticos,
              }))}
              selected={filtros.area}
              onClick={(item) =>
                setFiltro(
                  "area",
                  filtros.area === item.id ? "" : item.id
                )
              }
            />
          </Card>

          <Card style={{ padding: 18 }}>
            <SectionTitle
              icon={Building2}
              title="Estruturas"
              subtitle="Perfil dos diagnósticos"
            />
            <HorizontalBars
              data={dados?.estruturas}
              selected={filtros.estrutura}
              onClick={(item) =>
                setFiltro(
                  "estrutura",
                  filtros.estrutura === item.id
                    ? ""
                    : item.id
                )
              }
            />
          </Card>

          <Card style={{ padding: 18 }}>
            <SectionTitle
              icon={Activity}
              title="Saúde dos diagnósticos"
              subtitle="Distribuição dos scores"
            />

            <div style={{ display: "grid", gap: 9 }}>
              {arr(dados?.distribuicaoScores).length ? (
                arr(dados.distribuicaoScores).map((x) => (
                  <div
                    key={x.id}
                    style={{
                      border: `1px solid ${BORDER}`,
                      borderRadius: 11,
                      padding: 11,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 850,
                          fontSize: 12,
                        }}
                      >
                        {x.label}
                      </div>
                      <div
                        style={{
                          color: MUTED,
                          fontSize: 10,
                          marginTop: 2,
                        }}
                      >
                        {pct(x.percentual)} do total
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 21,
                        fontWeight: 900,
                      }}
                    >
                      {fmt(x.quantidade)}
                    </div>
                  </div>
                ))
              ) : (
                <Empty />
              )}
            </div>
          </Card>
        </div>

        {/* MATRIZ */}
        <Card style={{ padding: 18, marginBottom: 14 }}>
          <SectionTitle
            icon={BriefcaseBusiness}
            title="Matriz de oportunidades"
            subtitle="Onde existe demanda, criticidade e trabalho comercial"
          />

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 820,
              }}
            >
              <thead>
                <tr>
                  {[
                    "Área",
                    "Diagnósticos",
                    "Score médio",
                    "Críticos",
                    "Oportunidades",
                    "Atendimentos",
                    "Concluídos",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 11px",
                        textAlign:
                          h === "Área" ? "left" : "right",
                        borderBottom: `1px solid ${BORDER}`,
                        color: MUTED,
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: ".04em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {arr(dados?.matrizOportunidades).map(
                  (x) => (
                    <tr
                      key={x.id}
                      onClick={() =>
                        setFiltro(
                          "area",
                          filtros.area === x.id ? "" : x.id
                        )
                      }
                      style={{ cursor: "pointer" }}
                    >
                      <td
                        style={{
                          padding: 11,
                          borderBottom: `1px solid ${BORDER}`,
                          fontWeight: 850,
                        }}
                      >
                        {x.label}
                      </td>
                      {[
                        x.quantidadeDiagnosticos,
                        x.scoreMedio ?? "—",
                        x.criticos,
                        x.oportunidades,
                        x.atendimentos,
                        x.concluidos,
                      ].map((v, i) => (
                        <td
                          key={i}
                          style={{
                            padding: 11,
                            borderBottom: `1px solid ${BORDER}`,
                            textAlign: "right",
                            fontWeight:
                              i === 1 || i === 3 ? 850 : 650,
                          }}
                        >
                          {v}
                        </td>
                      ))}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ATENDIMENTOS + EQUIPE */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(320px,1fr) minmax(320px,1fr)",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <Card style={{ padding: 18 }}>
            <SectionTitle
              icon={Clock3}
              title="Operação de atendimento"
              subtitle="Distribuição atual da fila"
            />
            <HorizontalBars
              data={dados?.statusAtendimentos}
              selected={filtros.statusAtendimento}
              onClick={(item) =>
                setFiltro(
                  "statusAtendimento",
                  filtros.statusAtendimento === item.id
                    ? ""
                    : item.id
                )
              }
            />
          </Card>

          <Card style={{ padding: 18 }}>
            <SectionTitle
              icon={Users}
              title="Equipe e capacidade"
              subtitle="Carga ativa por especialista"
            />

            <div style={{ display: "grid", gap: 12 }}>
              {arr(dados?.equipe).length ? (
                arr(dados.equipe).map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() =>
                      setFiltro(
                        "responsavelId",
                        filtros.responsavelId === String(x.id)
                          ? ""
                          : String(x.id)
                      )
                    }
                    style={{
                      border: 0,
                      background: "transparent",
                      padding: 0,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        fontSize: 12,
                      }}
                    >
                      <strong>{x.nome}</strong>
                      <span style={{ color: MUTED }}>
                        {fmt(x.atendimentosAtivos)} ativos /{" "}
                        {fmt(x.capacidadeDiaria)} capacidade
                      </span>
                    </div>

                    <div
                      style={{
                        height: 9,
                        marginTop: 6,
                        background: "#edf1f6",
                        borderRadius: 999,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(
                            100,
                            num(x.utilizacaoPercentual)
                          )}%`,
                          height: "100%",
                          background:
                            num(x.utilizacaoPercentual) >= 100
                              ? CORAL
                              : NAVY,
                          borderRadius: 999,
                        }}
                      />
                    </div>
                  </button>
                ))
              ) : (
                <Empty />
              )}
            </div>
          </Card>
        </div>

        {/* DRILL DOWN */}
        <Card style={{ padding: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 15,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <SectionTitle
              icon={Search}
              title="Explorar registros"
              subtitle={`${fmt(
                registros.length
              )} registros encontrados`}
            />

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar cliente, empresa, CNPJ..."
                style={{
                  height: 40,
                  width: 290,
                  maxWidth: "100%",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 10,
                  padding: "0 12px",
                  outline: "none",
                }}
              />

              <button
                type="button"
                onClick={() => setDrill((v) => !v)}
                style={{
                  height: 40,
                  border: 0,
                  borderRadius: 10,
                  background: NAVY,
                  color: "#fff",
                  padding: "0 14px",
                  fontWeight: 850,
                  cursor: "pointer",
                }}
              >
                {drill ? "Recolher" : "Ver registros"}
              </button>
            </div>
          </div>

          {drill ? (
            registros.length ? (
              <div
                style={{
                  display: "grid",
                  gap: 9,
                  maxHeight: 600,
                  overflowY: "auto",
                }}
              >
                {registros.map((r) => (
                  <div
                    key={r.diagnosticoId}
                    style={{
                      border: `1px solid ${BORDER}`,
                      borderRadius: 12,
                      padding: 13,
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(220px,1.5fr) repeat(3,minmax(110px,.6fr)) auto",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: 13,
                        }}
                      >
                        {r.empresa || r.nome || "Sem identificação"}
                      </div>
                      <div
                        style={{
                          color: MUTED,
                          fontSize: 11,
                          marginTop: 3,
                        }}
                      >
                        {[r.nome, r.cnpj, r.origem]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>

                    <div>
                      <small style={{ color: MUTED }}>
                        Estrutura
                      </small>
                      <div style={{ fontWeight: 800 }}>
                        {r.estrutura || "—"}
                      </div>
                    </div>

                    <div>
                      <small style={{ color: MUTED }}>
                        Score
                      </small>
                      <div style={{ fontWeight: 900 }}>
                        {r.score ?? "—"}{" "}
                        <span
                          style={{
                            fontSize: 10,
                            color: MUTED,
                          }}
                        >
                          {r.faixaScore}
                        </span>
                      </div>
                    </div>

                    <div>
                      <small style={{ color: MUTED }}>
                        Status
                      </small>
                      <div style={{ fontWeight: 800 }}>
                        {r.statusDiagnosticoLabel}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        justifyContent: "flex-end",
                        flexWrap: "wrap",
                      }}
                    >
                      {onAbrirLead && r.leadId ? (
                        <button
                          type="button"
                          onClick={() => onAbrirLead(r.leadId)}
                          style={miniButton()}
                        >
                          Lead
                        </button>
                      ) : null}

                      {onAbrirDiagnostico ? (
                        <button
                          type="button"
                          onClick={() =>
                            onAbrirDiagnostico(
                              r.diagnosticoId
                            )
                          }
                          style={miniButton(true)}
                        >
                          Diagnóstico
                          <ChevronRight size={13} />
                        </button>
                      ) : null}

                      {onAbrirAtendimento &&
                      arr(r.atendimentos)[0]?.id ? (
                        <button
                          type="button"
                          onClick={() =>
                            onAbrirAtendimento(
                              r.atendimentos[0].id
                            )
                          }
                          style={miniButton()}
                        >
                          Atendimento
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty />
            )
          ) : (
            <div
              style={{
                padding: 18,
                borderRadius: 12,
                background: "#f7f9fc",
                color: MUTED,
                fontSize: 12,
              }}
            >
              Use os gráficos e filtros acima e clique em{" "}
              <strong>Ver registros</strong> para investigar os
              clientes correspondentes.
            </div>
          )}
        </Card>

        {/* CAMADA FINANCEIRA FUTURA */}
        {!dados?.disponibilidadeDados?.financeiro ? (
          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              gap: 9,
              color: MUTED,
              fontSize: 11,
            }}
          >
            <CircleDollarSign size={15} />
            {dados?.disponibilidadeDados
              ?.mensagemFinanceiro ||
              "A camada financeira será habilitada quando os valores comerciais estiverem estruturados."}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function miniButton(primary = false) {
  return {
    height: 31,
    border: primary ? 0 : `1px solid ${BORDER}`,
    borderRadius: 8,
    padding: "0 9px",
    background: primary ? CORAL : "#fff",
    color: primary ? "#fff" : NAVY,
    fontWeight: 800,
    fontSize: 10,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  };
}
