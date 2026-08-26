import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock3,
  Download,
  Filter,
  Flame,
  RefreshCcw,
  Search,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

const NAVY = "#17233D";
const CORAL = "#FF6B4A";
const MUTED = "#5B667A";
const WHITE = "#FFFFFF";
const BORDER = "#D8DEEA";

const ESTRUTURAS = [
  ["operacional", "Empresa operacional"],
  ["grupo", "Grupo empresarial"],
  ["holding", "Holding"],
  ["avaliar_holding", "Avaliação de Holding"],
  ["spe", "SPE"],
  ["pessoa_fisica", "Pessoa Física"],
];

const TIPOS = [
  ["diagnostico_empresarial", "Diagnóstico empresarial"],
  ["reforma_tributaria", "Reforma Tributária / IBS e CBS"],
];

function normalizarEstrutura(valor = "") {
  const v = String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

  const aliases = {
    empresa: "operacional",
    empresa_operacional: "operacional",
    operacional: "operacional",
    grupo: "grupo",
    grupo_empresarial: "grupo",
    holding: "holding",
    avaliar_holding: "avaliar_holding",
    avaliacao_holding: "avaliar_holding",
    avaliacao_de_holding: "avaliar_holding",
    spe: "spe",
    pessoa_fisica: "pessoa_fisica",
    pf: "pessoa_fisica",
    reforma: "operacional",
    reforma_tributaria: "operacional",
  };

  return aliases[v] || v || "operacional";
}

function tipoDiagnostico(item = {}) {
  const direto = String(
    item.tipoDiagnostico ||
    item.tipo_diagnostico ||
    item?.lead?.tipoDiagnostico ||
    ""
  ).toLowerCase();

  if (
    direto.includes("reforma") ||
    direto.includes("ibs") ||
    direto.includes("cbs")
  ) {
    return "reforma_tributaria";
  }

  const estrutura = String(
    item.estruturaNegocio ||
    item.estrutura_negocio ||
    item?.lead?.estruturaNegocio ||
    ""
  ).toLowerCase();

  if (estrutura.includes("reforma")) {
    return "reforma_tributaria";
  }

  const contexto = JSON.stringify(
    item.contextoCliente ||
    item.contexto_cliente ||
    item.perfil ||
    item.resultado ||
    {}
  ).toLowerCase();

  if (
    contexto.includes("reformatributaria") ||
    contexto.includes("reforma tribut")
  ) {
    return "reforma_tributaria";
  }

  return "diagnostico_empresarial";
}

function labelEstrutura(valor) {
  const id = normalizarEstrutura(valor);
  return ESTRUTURAS.find(([k]) => k === id)?.[1] || "Empresa operacional";
}

function labelTipo(valor) {
  return TIPOS.find(([k]) => k === valor)?.[1] || "Diagnóstico empresarial";
}

function cnpjFormatado(valor = "") {
  const d = String(valor || "").replace(/\D/g, "");
  if (d.length !== 14) return valor || "-";
  return d.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

function dataCurta(valor) {
  if (!valor) return "-";
  try {
    return new Date(valor).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return String(valor);
  }
}

function Card({ children, style = {}, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: WHITE,
        border: "1px solid #E3E7EF",
        borderRadius: 14,
        padding: 15,
        boxSizing: "border-box",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Select({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        padding: "10px 11px",
        background: WHITE,
        color: NAVY,
        fontSize: 11,
        minWidth: 155,
      }}
    >
      {children}
    </select>
  );
}

function Botao({ children, onClick, secundario = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: secundario ? `1px solid ${BORDER}` : 0,
        background: secundario ? WHITE : CORAL,
        color: secundario ? NAVY : WHITE,
        borderRadius: 10,
        padding: "10px 12px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        fontWeight: 800,
        fontSize: 11,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

function Kpi({
  titulo,
  valor,
  subtitulo,
  Icon,
  ativo,
  onClick,
  tom = "normal",
}) {
  const mapa = {
    normal: { border: "#E3E7EF", bg: WHITE, icon: "#31589C" },
    coral: { border: "#F7C6B8", bg: "#FFF4F0", icon: CORAL },
    vermelho: { border: "#F2B8B5", bg: "#FFF0EF", icon: "#A12B2B" },
    verde: { border: "#B7E3D4", bg: "#F0FAF6", icon: "#0F6E56" },
    amarelo: { border: "#F1D59A", bg: "#FFF7E7", icon: "#8A5600" },
  };

  const c = mapa[tom] || mapa.normal;

  return (
    <Card
      onClick={onClick}
      style={{
        cursor: onClick ? "pointer" : "default",
        border: `2px solid ${ativo ? CORAL : c.border}`,
        background: c.bg,
        minHeight: 118,
      }}
    >
      <Icon size={18} color={c.icon} />

      <div
        style={{
          color: MUTED,
          fontSize: 9,
          fontWeight: 900,
          marginTop: 12,
        }}
      >
        {titulo}
      </div>

      <div
        style={{
          fontSize: 29,
          lineHeight: 1,
          fontWeight: 900,
          color: NAVY,
          marginTop: 6,
        }}
      >
        {valor}
      </div>

      {subtitulo && (
        <div style={{ color: MUTED, fontSize: 8.5, marginTop: 6 }}>
          {subtitulo}
        </div>
      )}
    </Card>
  );
}

function Barra({ label, valor, total, onClick, ativo }) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: ativo ? `1px solid ${CORAL}` : "1px solid transparent",
        width: "100%",
        padding: "8px 7px",
        borderRadius: 9,
        background: ativo ? "#FFF3EF" : "transparent",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          fontSize: 9.5,
        }}
      >
        <strong>{label}</strong>
        <span>{valor} · {pct}%</span>
      </div>

      <div
        style={{
          height: 6,
          background: "#EEF0F5",
          borderRadius: 999,
          overflow: "hidden",
          marginTop: 5,
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
}

function contarPor(lista, fn) {
  return lista.reduce((acc, item) => {
    const chave = fn(item) || "Não informado";
    acc[chave] = (acc[chave] || 0) + 1;
    return acc;
  }, {});
}

function entriesOrdenadas(objeto) {
  return Object.entries(objeto || {}).sort((a, b) => b[1] - a[1]);
}

function statusAtendimento(valor) {
  return String(valor || "NAO_INICIADO").toUpperCase();
}

function statusDiagnostico(valor) {
  return String(valor || "CONCLUIDO").toUpperCase();
}

function atrasado(valor) {
  if (!valor) return false;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

export default function OperacionalBI({
  token,
  modo = "diagnosticos",
  onAbrirDiagnostico,
  onAbrirAtendimento,
}) {
  const ehDiagnostico = modo === "diagnosticos";

  const [registros, setRegistros] = useState([]);
  const [responsaveis, setResponsaveis] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [busca, setBusca] = useState("");
  const [origem, setOrigem] = useState("");
  const [status, setStatus] = useState("");
  const [prioridade, setPrioridade] = useState("");
  const [estrutura, setEstrutura] = useState("");
  const [tipo, setTipo] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [area, setArea] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [filtroRapido, setFiltroRapido] = useState("");
  const [selecionados, setSelecionados] = useState([]);

  async function carregar() {
    setCarregando(true);
    setErro("");

    try {
      if (ehDiagnostico) {
        const resposta = await fetch(
          "/api/diagnosticos?action=listar&limite=500&offset=0&arquivamento=ATIVOS",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await resposta.json().catch(() => null);

        if (!resposta.ok || !data?.sucesso) {
          throw new Error(
            data?.error || "Não foi possível carregar os diagnósticos."
          );
        }

        const lista = Array.isArray(data.diagnosticos)
          ? data.diagnosticos
          : [];

        setRegistros(
          lista.map((item) => ({
            ...item,
            _estrutura: normalizarEstrutura(
              item.estruturaNegocio || item.estrutura_negocio
            ),
            _tipo: tipoDiagnostico(item),
          }))
        );
      } else {
        const [ra, rr] = await Promise.all([
          fetch(
            "/api/crm?action=listar-atendimentos&arquivamento=ATIVOS",
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          ),
          fetch(
            "/api/crm?action=listar-responsaveis",
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          ),
        ]);

        const [da, dr] = await Promise.all([
          ra.json().catch(() => null),
          rr.json().catch(() => null),
        ]);

        if (!ra.ok || !da?.sucesso) {
          throw new Error(
            da?.error || "Não foi possível carregar os atendimentos."
          );
        }

        setResponsaveis(
          Array.isArray(dr?.responsaveis) ? dr.responsaveis : []
        );

        setRegistros(
          (Array.isArray(da.atendimentos) ? da.atendimentos : []).map(
            (item) => ({
              ...item,
              _estrutura: normalizarEstrutura(
                item?.lead?.estruturaNegocio
              ),
              _tipo: tipoDiagnostico({
                estruturaNegocio: item?.lead?.estruturaNegocio,
              }),
            })
          )
        );
      }
    } catch (error) {
      setErro(error?.message || "Não foi possível carregar o BI.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [modo, token]);

  function limpar() {
    setBusca("");
    setOrigem("");
    setStatus("");
    setPrioridade("");
    setEstrutura("");
    setTipo("");
    setResponsavel("");
    setArea("");
    setDataInicio("");
    setDataFim("");
    setFiltroRapido("");
    setSelecionados([]);
  }

  const origens = useMemo(
    () =>
      [
        ...new Set(
          registros
            .map((item) =>
              ehDiagnostico
                ? item.origem || item.campanha
                : item?.lead?.origem
            )
            .filter(Boolean)
        ),
      ].sort(),
    [registros, ehDiagnostico]
  );

  const areas = useMemo(
    () => [...new Set(registros.map((item) => item.area).filter(Boolean))].sort(),
    [registros]
  );

  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return registros.filter((item) => {
      const lead = item.lead || {};

      const nome = ehDiagnostico
        ? item.razaoSocial || item.nome || ""
        : lead.razaoSocial || lead.nome || "";

      const cnpj = ehDiagnostico ? item.cnpj || "" : lead.cnpj || "";
      const email = ehDiagnostico ? item.email || "" : lead.email || "";
      const telefone = ehDiagnostico ? item.telefone || "" : lead.telefone || "";

      if (
        termo &&
        ![nome, cnpj, email, telefone]
          .join(" ")
          .toLowerCase()
          .includes(termo)
      ) {
        return false;
      }

      const origemItem = ehDiagnostico
        ? item.origem || item.campanha || "direto"
        : lead.origem || "direto";

      if (origem && origemItem !== origem) return false;

      const statusItem = ehDiagnostico
        ? statusDiagnostico(
            item.statusDiagnostico || item.status || "CONCLUIDO"
          )
        : statusAtendimento(item.statusAtendimento);

      if (status && statusItem !== status) return false;

      const prioridadeItem = ehDiagnostico
        ? item.prioridadeComercial || item.prioridade || ""
        : item.prioridadeComercial ||
          lead.prioridadeComercial ||
          "";

      if (prioridade && prioridadeItem !== prioridade) return false;
      if (estrutura && item._estrutura !== estrutura) return false;
      if (tipo && item._tipo !== tipo) return false;

      if (!ehDiagnostico && responsavel && item.responsavelId !== responsavel) {
        return false;
      }

      if (!ehDiagnostico && area && item.area !== area) {
        return false;
      }

      const dataItem = ehDiagnostico
        ? item.criadoEm || item.createdAt
        : item.updatedAt || item.createdAt;

      if (
        dataInicio &&
        dataItem &&
        new Date(dataItem).getTime() <
          new Date(`${dataInicio}T00:00:00`).getTime()
      ) {
        return false;
      }

      if (
        dataFim &&
        dataItem &&
        new Date(dataItem).getTime() >
          new Date(`${dataFim}T23:59:59`).getTime()
      ) {
        return false;
      }

      if (filtroRapido === "criticos") {
        const score = Number(ehDiagnostico ? item.score : item.scoreArea);
        if (!Number.isFinite(score) || score > 50) return false;
      }

      if (filtroRapido === "prioridade_a") {
        if (prioridadeItem !== "A") return false;
      }

      if (filtroRapido === "atrasados" && !ehDiagnostico) {
        if (
          !atrasado(item.proximoContato) ||
          ["CONCLUIDO", "CONCLUIDA"].includes(statusItem)
        ) {
          return false;
        }
      }

      if (filtroRapido === "concluidos") {
        if (
          ehDiagnostico
            ? statusItem !== "CONCLUIDO"
            : !["CONCLUIDO", "CONCLUIDA"].includes(statusItem)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    registros,
    busca,
    origem,
    status,
    prioridade,
    estrutura,
    tipo,
    responsavel,
    area,
    dataInicio,
    dataFim,
    filtroRapido,
    ehDiagnostico,
  ]);

  const total = listaFiltrada.length;

  const resumo = useMemo(() => {
    if (ehDiagnostico) {
      const concluidos = listaFiltrada.filter(
        (item) =>
          statusDiagnostico(
            item.statusDiagnostico || item.status || "CONCLUIDO"
          ) === "CONCLUIDO"
      ).length;

      const preenchimento = listaFiltrada.filter(
        (item) =>
          statusDiagnostico(
            item.statusDiagnostico || item.status
          ) === "EM_PREENCHIMENTO"
      ).length;

      const naoConcluidos = listaFiltrada.filter(
        (item) =>
          statusDiagnostico(
            item.statusDiagnostico || item.status
          ) === "NAO_CONCLUIDO"
      ).length;

      const criticos = listaFiltrada.filter(
        (item) => Number(item.score) <= 50
      ).length;

      const reforma = listaFiltrada.filter(
        (item) => item._tipo === "reforma_tributaria"
      ).length;

      return {
        total,
        concluidos,
        preenchimento,
        naoConcluidos,
        criticos,
        reforma,
        taxa: total ? Math.round((concluidos / total) * 100) : 0,
      };
    }

    const novos = listaFiltrada.filter((item) =>
      ["", "NAO_INICIADO"].includes(
        statusAtendimento(item.statusAtendimento)
      )
    ).length;

    const andamento = listaFiltrada.filter(
      (item) =>
        statusAtendimento(item.statusAtendimento) === "EM_ANDAMENTO"
    ).length;

    const aguardando = listaFiltrada.filter((item) =>
      [
        "AGUARDANDO_CLIENTE",
        "AGUARDANDO_INTERNO",
        "AGUARDANDO",
      ].includes(statusAtendimento(item.statusAtendimento))
    ).length;

    const concluidos = listaFiltrada.filter((item) =>
      ["CONCLUIDO", "CONCLUIDA"].includes(
        statusAtendimento(item.statusAtendimento)
      )
    ).length;

    const atrasados = listaFiltrada.filter(
      (item) =>
        atrasado(item.proximoContato) &&
        !["CONCLUIDO", "CONCLUIDA"].includes(
          statusAtendimento(item.statusAtendimento)
        )
    ).length;

    const prioridadeAlta = listaFiltrada.filter((item) =>
      ["A", "ALTA", "URGENTE"].includes(
        item.prioridadeComercial ||
          item?.lead?.prioridadeComercial ||
          ""
      )
    ).length;

    return {
      total,
      novos,
      andamento,
      aguardando,
      concluidos,
      atrasados,
      prioridadeAlta,
      taxa: total ? Math.round((concluidos / total) * 100) : 0,
    };
  }, [listaFiltrada, ehDiagnostico, total]);

  const porOrigem = useMemo(
    () =>
      contarPor(listaFiltrada, (item) =>
        ehDiagnostico
          ? item.origem || item.campanha || "direto"
          : item?.lead?.origem || "direto"
      ),
    [listaFiltrada, ehDiagnostico]
  );

  const porEstrutura = useMemo(
    () =>
      contarPor(listaFiltrada, (item) =>
        labelEstrutura(item._estrutura)
      ),
    [listaFiltrada]
  );

  const porTipo = useMemo(
    () =>
      contarPor(listaFiltrada, (item) =>
        labelTipo(item._tipo)
      ),
    [listaFiltrada]
  );

  const porArea = useMemo(
    () => contarPor(listaFiltrada, (item) => item.area || "Sem área"),
    [listaFiltrada]
  );

  const todosSelecionados =
    listaFiltrada.length > 0 &&
    listaFiltrada.every((item) => selecionados.includes(item.id));

  function alternarTodos() {
    if (todosSelecionados) {
      setSelecionados([]);
      return;
    }

    setSelecionados(listaFiltrada.map((item) => item.id));
  }

  function alternarItem(id) {
    setSelecionados((atual) =>
      atual.includes(id)
        ? atual.filter((x) => x !== id)
        : [...atual, id]
    );
  }

  function exportarCsv() {
    const cabecalho = ehDiagnostico
      ? [
          "Empresa",
          "CNPJ",
          "Origem",
          "Estrutura",
          "Tipo",
          "Score",
          "Status",
          "Data",
        ]
      : [
          "Empresa",
          "CNPJ",
          "Origem",
          "Estrutura",
          "Tipo",
          "Área",
          "Status",
          "Responsável",
          "Próximo contato",
        ];

    const linhas = listaFiltrada.map((item) => {
      if (ehDiagnostico) {
        return [
          item.razaoSocial || item.nome || "",
          item.cnpj || "",
          item.origem || item.campanha || "direto",
          labelEstrutura(item._estrutura),
          labelTipo(item._tipo),
          item.score ?? "",
          item.statusDiagnostico || item.status || "CONCLUIDO",
          item.criadoEm || "",
        ];
      }

      return [
        item?.lead?.razaoSocial || item?.lead?.nome || "",
        item?.lead?.cnpj || "",
        item?.lead?.origem || "direto",
        labelEstrutura(item._estrutura),
        labelTipo(item._tipo),
        item.area || "",
        item.statusAtendimento || "",
        item.responsavelNome || "",
        item.proximoContato || "",
      ];
    });

    const csv = [cabecalho, ...linhas]
      .map((linha) =>
        linha
          .map(
            (valor) =>
              `"${String(valor ?? "").replace(/"/g, '""')}"`
          )
          .join(";")
      )
      .join("\n");

    const blob = new Blob(["\ufeff", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ehDiagnostico
      ? "bi-diagnosticos.csv"
      : "bi-atendimentos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main
      style={{
        maxWidth: 1420,
        margin: "0 auto",
        padding: "22px 18px 50px",
        color: NAVY,
        fontFamily:
          "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
      }}
    >
      {erro && (
        <div
          style={{
            background: "#FAECE7",
            color: "#993C1D",
            borderRadius: 10,
            padding: 10,
            marginBottom: 12,
            fontSize: 11,
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
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 24,
              fontFamily:
                "Georgia,'Times New Roman',serif",
            }}
          >
            {ehDiagnostico
              ? "BI de Diagnósticos"
              : "BI de Atendimentos"}
          </h2>

          <div
            style={{
              color: MUTED,
              fontSize: 10.5,
              marginTop: 3,
            }}
          >
            Qualquer seleção recalcula KPIs, gráficos, contagens e fila.
          </div>
        </div>

        <div style={{ display: "flex", gap: 7 }}>
          <Botao secundario onClick={carregar} disabled={carregando}>
            <RefreshCcw size={14} />
            Atualizar
          </Botao>

          <Botao secundario onClick={exportarCsv}>
            <Download size={14} />
            Exportar visão
          </Botao>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(150px,1fr))",
          gap: 8,
          marginBottom: 12,
        }}
      >
        {ehDiagnostico ? (
          <>
            <Kpi
              titulo="DIAGNÓSTICOS"
              valor={resumo.total}
              subtitulo="visão atual"
              Icon={Building2}
              ativo={!filtroRapido}
              onClick={() => {
                setFiltroRapido("");
                setStatus("");
              }}
            />

            <Kpi
              titulo="EM PREENCHIMENTO"
              valor={resumo.preenchimento}
              Icon={Activity}
              onClick={() => {
                setStatus("EM_PREENCHIMENTO");
                setFiltroRapido("");
              }}
            />

            <Kpi
              titulo="NÃO CONCLUÍDOS"
              valor={resumo.naoConcluidos}
              Icon={Clock3}
              tom="amarelo"
              onClick={() => {
                setStatus("NAO_CONCLUIDO");
                setFiltroRapido("");
              }}
            />

            <Kpi
              titulo="CONCLUÍDOS"
              valor={resumo.concluidos}
              Icon={CheckCircle2}
              tom="verde"
              ativo={filtroRapido === "concluidos"}
              onClick={() => {
                setStatus("");
                setFiltroRapido(
                  filtroRapido === "concluidos"
                    ? ""
                    : "concluidos"
                );
              }}
            />

            <Kpi
              titulo="TAXA DE CONCLUSÃO"
              valor={`${resumo.taxa}%`}
              Icon={TrendingUp}
            />

            <Kpi
              titulo="CRÍTICOS"
              valor={resumo.criticos}
              Icon={AlertTriangle}
              tom="vermelho"
              ativo={filtroRapido === "criticos"}
              onClick={() =>
                setFiltroRapido(
                  filtroRapido === "criticos"
                    ? ""
                    : "criticos"
                )
              }
            />

            <Kpi
              titulo="REFORMA TRIBUTÁRIA"
              valor={resumo.reforma}
              Icon={Flame}
              tom="coral"
              ativo={tipo === "reforma_tributaria"}
              onClick={() =>
                setTipo(
                  tipo === "reforma_tributaria"
                    ? ""
                    : "reforma_tributaria"
                )
              }
            />
          </>
        ) : (
          <>
            <Kpi
              titulo="ATENDIMENTOS"
              valor={resumo.total}
              Icon={Target}
              ativo={!filtroRapido}
              onClick={() => {
                setFiltroRapido("");
                setStatus("");
              }}
            />

            <Kpi
              titulo="NOVOS"
              valor={resumo.novos}
              Icon={Users}
              onClick={() => {
                setStatus("NAO_INICIADO");
                setFiltroRapido("");
              }}
            />

            <Kpi
              titulo="EM ANDAMENTO"
              valor={resumo.andamento}
              Icon={Activity}
              onClick={() => {
                setStatus("EM_ANDAMENTO");
                setFiltroRapido("");
              }}
            />

            <Kpi
              titulo="AGUARDANDO"
              valor={resumo.aguardando}
              Icon={Clock3}
              tom="amarelo"
            />

            <Kpi
              titulo="ATRASADOS"
              valor={resumo.atrasados}
              Icon={AlertTriangle}
              tom="vermelho"
              ativo={filtroRapido === "atrasados"}
              onClick={() =>
                setFiltroRapido(
                  filtroRapido === "atrasados"
                    ? ""
                    : "atrasados"
                )
              }
            />

            <Kpi
              titulo="ALTA PRIORIDADE"
              valor={resumo.prioridadeAlta}
              Icon={Flame}
              tom="coral"
              ativo={filtroRapido === "prioridade_a"}
              onClick={() =>
                setFiltroRapido(
                  filtroRapido === "prioridade_a"
                    ? ""
                    : "prioridade_a"
                )
              }
            />

            <Kpi
              titulo="CONCLUÍDOS"
              valor={resumo.concluidos}
              Icon={CheckCircle2}
              tom="verde"
              ativo={filtroRapido === "concluidos"}
              onClick={() =>
                setFiltroRapido(
                  filtroRapido === "concluidos"
                    ? ""
                    : "concluidos"
                )
              }
            />
          </>
        )}
      </div>

      <Card style={{ marginBottom: 12 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(220px,1.6fr) repeat(4,minmax(130px,.8fr))",
            gap: 7,
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative" }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 10,
                top: 11,
                color: MUTED,
              }}
            />

            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar empresa, CNPJ, nome, telefone..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                padding: "10px 11px 10px 32px",
                fontSize: 11,
              }}
            />
          </div>

          <Select value={origem} onChange={(e) => setOrigem(e.target.value)}>
            <option value="">Todas as origens</option>
            {origens.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>

          <Select
            value={estrutura}
            onChange={(e) => setEstrutura(e.target.value)}
          >
            <option value="">Todas as estruturas</option>
            {ESTRUTURAS.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>

          <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            {TIPOS.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>

          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos os status</option>

            {ehDiagnostico ? (
              <>
                <option value="ACESSOU">Acessou</option>
                <option value="EM_PREENCHIMENTO">Em preenchimento</option>
                <option value="NAO_CONCLUIDO">Não concluído</option>
                <option value="CONCLUIDO">Concluído</option>
              </>
            ) : (
              <>
                <option value="NAO_INICIADO">Não iniciado</option>
                <option value="EM_ANDAMENTO">Em andamento</option>
                <option value="AGUARDANDO_CLIENTE">Aguardando cliente</option>
                <option value="AGUARDANDO_INTERNO">Aguardando interno</option>
                <option value="CONCLUIDO">Concluído</option>
              </>
            )}
          </Select>
        </div>

        <div
          style={{
            display: "flex",
            gap: 7,
            flexWrap: "wrap",
            marginTop: 8,
            alignItems: "center",
          }}
        >
          {!ehDiagnostico && (
            <>
              <Select value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="">Todas as áreas</option>
                {areas.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>

              <Select
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
              >
                <option value="">Todos os responsáveis</option>
                {responsaveis.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </Select>
            </>
          )}

          <Select
            value={prioridade}
            onChange={(e) => setPrioridade(e.target.value)}
          >
            <option value="">Todas as prioridades</option>
            <option value="A">Prioridade A</option>
            <option value="B">Prioridade B</option>
            <option value="C">Prioridade C</option>
            <option value="D">Prioridade D</option>
          </Select>

          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            title="Data inicial"
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              padding: "9px 10px",
              fontSize: 10,
            }}
          />

          <span style={{ color: MUTED, fontSize: 9 }}>até</span>

          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            title="Data final"
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              padding: "9px 10px",
              fontSize: 10,
            }}
          />

          <Botao secundario onClick={limpar}>
            <X size={14} />
            Limpar
          </Botao>

          <span
            style={{
              marginLeft: "auto",
              color: MUTED,
              fontSize: 10,
              fontWeight: 800,
            }}
          >
            {listaFiltrada.length} registro(s)
          </span>
        </div>
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: ehDiagnostico
            ? "repeat(3,minmax(0,1fr))"
            : "repeat(4,minmax(0,1fr))",
          gap: 9,
          marginBottom: 12,
        }}
      >
        <Card>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 7,
            }}
          >
            <strong style={{ fontSize: 11 }}>Origem</strong>
            <BarChart3 size={16} color={CORAL} />
          </div>

          {entriesOrdenadas(porOrigem)
            .slice(0, 8)
            .map(([label, valor]) => (
              <Barra
                key={label}
                label={label}
                valor={valor}
                total={total}
                ativo={origem === label}
                onClick={() =>
                  setOrigem(origem === label ? "" : label)
                }
              />
            ))}
        </Card>

        <Card>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 7,
            }}
          >
            <strong style={{ fontSize: 11 }}>Estrutura</strong>
            <Building2 size={16} color="#31589C" />
          </div>

          {entriesOrdenadas(porEstrutura)
            .slice(0, 8)
            .map(([label, valor]) => {
              const id =
                ESTRUTURAS.find(([, nome]) => nome === label)?.[0] || "";

              return (
                <Barra
                  key={label}
                  label={label}
                  valor={valor}
                  total={total}
                  ativo={estrutura === id}
                  onClick={() =>
                    setEstrutura(estrutura === id ? "" : id)
                  }
                />
              );
            })}
        </Card>

        <Card>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 7,
            }}
          >
            <strong style={{ fontSize: 11 }}>Tipo de diagnóstico</strong>
            <Filter size={16} color="#0F6E56" />
          </div>

          {entriesOrdenadas(porTipo).map(([label, valor]) => {
            const id = TIPOS.find(([, nome]) => nome === label)?.[0] || "";

            return (
              <Barra
                key={label}
                label={label}
                valor={valor}
                total={total}
                ativo={tipo === id}
                onClick={() => setTipo(tipo === id ? "" : id)}
              />
            );
          })}
        </Card>

        {!ehDiagnostico && (
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 7,
              }}
            >
              <strong style={{ fontSize: 11 }}>Áreas</strong>
              <Target size={16} color="#854F0B" />
            </div>

            {entriesOrdenadas(porArea)
              .slice(0, 8)
              .map(([label, valor]) => (
                <Barra
                  key={label}
                  label={label}
                  valor={valor}
                  total={total}
                  ativo={area === label}
                  onClick={() => setArea(area === label ? "" : label)}
                />
              ))}
          </Card>
        )}
      </div>

      <Card style={{ padding: 10, marginBottom: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <input
            type="checkbox"
            checked={todosSelecionados}
            onChange={alternarTodos}
          />

          <strong style={{ fontSize: 10 }}>
            Selecionar todos os exibidos
          </strong>

          <span
            style={{
              background: "#EEF0F5",
              color: MUTED,
              borderRadius: 999,
              padding: "4px 7px",
              fontSize: 9,
              fontWeight: 800,
            }}
          >
            {selecionados.length} selecionado(s)
          </span>

          <span
            style={{
              marginLeft: "auto",
              color: MUTED,
              fontSize: 9,
            }}
          >
            KPIs, gráficos, fila e exportação usam a mesma seleção.
          </span>
        </div>
      </Card>

      <div style={{ marginBottom: 8 }}>
        <h3
          style={{
            margin: "0 0 2px",
            fontFamily: "Georgia,'Times New Roman',serif",
            fontSize: 20,
          }}
        >
          {ehDiagnostico
            ? "Fila de diagnósticos"
            : "Fila de atendimento"}
        </h3>

        <div style={{ color: MUTED, fontSize: 9.5 }}>
          Ordenação da visão filtrada.
        </div>
      </div>

      {carregando ? (
        <Card>Carregando BI...</Card>
      ) : !listaFiltrada.length ? (
        <Card>Nenhum registro encontrado para os filtros selecionados.</Card>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {listaFiltrada.map((item) => {
            const lead = item.lead || {};

            const empresa = ehDiagnostico
              ? item.razaoSocial ||
                item.nome ||
                "Empresa não informada"
              : lead.razaoSocial ||
                lead.nome ||
                "Cliente não informado";

            const cnpj = ehDiagnostico ? item.cnpj : lead.cnpj;

            const origemItem = ehDiagnostico
              ? item.origem ||
                item.campanha ||
                "direto"
              : lead.origem || "direto";

            const statusItem = ehDiagnostico
              ? statusDiagnostico(
                  item.statusDiagnostico ||
                  item.status ||
                  "CONCLUIDO"
                )
              : statusAtendimento(item.statusAtendimento);

            const score = Number(
              ehDiagnostico ? item.score : item.scoreArea
            );

            return (
              <div
                key={item.id}
                style={{
                  background: WHITE,
                  border: "1px solid #E0E5ED",
                  borderRadius: 14,
                  padding: 13,
                  display: "grid",
                  gridTemplateColumns: ehDiagnostico
                    ? "30px minmax(260px,2fr) minmax(120px,.7fr) minmax(130px,.7fr) minmax(160px,.9fr)"
                    : "30px minmax(250px,1.8fr) minmax(110px,.6fr) minmax(130px,.7fr) minmax(150px,.8fr) minmax(160px,.8fr)",
                  gap: 11,
                  alignItems: "center",
                }}
              >
                <input
                  type="checkbox"
                  checked={selecionados.includes(item.id)}
                  onChange={() => alternarItem(item.id)}
                />

                <div>
                  <strong style={{ display: "block", fontSize: 12.5 }}>
                    {empresa}
                  </strong>

                  <div
                    style={{
                      color: MUTED,
                      fontSize: 9,
                      marginTop: 3,
                    }}
                  >
                    {cnpjFormatado(cnpj)} · {origemItem} ·{" "}
                    {labelEstrutura(item._estrutura)}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 5,
                      flexWrap: "wrap",
                      marginTop: 6,
                    }}
                  >
                    <span
                      style={{
                        background:
                          item._tipo === "reforma_tributaria"
                            ? "#FFF0EB"
                            : "#EEF3FF",
                        color:
                          item._tipo === "reforma_tributaria"
                            ? "#B54708"
                            : "#31589C",
                        borderRadius: 999,
                        padding: "3px 6px",
                        fontSize: 8,
                        fontWeight: 900,
                      }}
                    >
                      {labelTipo(item._tipo)}
                    </span>

                    <span
                      style={{
                        background: "#F1F3F7",
                        borderRadius: 999,
                        padding: "3px 6px",
                        fontSize: 8,
                        fontWeight: 800,
                      }}
                    >
                      {statusItem}
                    </span>
                  </div>
                </div>

                {ehDiagnostico ? (
                  <>
                    <div>
                      <div
                        style={{
                          color: MUTED,
                          fontSize: 8,
                          fontWeight: 900,
                        }}
                      >
                        SCORE
                      </div>

                      <strong style={{ fontSize: 17 }}>
                        {Number.isFinite(score)
                          ? `${score}/100`
                          : "-"}
                      </strong>
                    </div>

                    <div>
                      <div
                        style={{
                          color: MUTED,
                          fontSize: 8,
                          fontWeight: 900,
                        }}
                      >
                        PARTICIPANTE
                      </div>

                      <div style={{ fontSize: 9.5, marginTop: 4 }}>
                        {item.nome || "-"}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          color: MUTED,
                          fontSize: 8,
                          fontWeight: 900,
                        }}
                      >
                        DATA
                      </div>

                      <div style={{ fontSize: 9.5, marginTop: 4 }}>
                        {dataCurta(
                          item.criadoEm ||
                          item.createdAt
                        )}
                      </div>

                      <div style={{ marginTop: 7 }}>
                        <Botao
                          onClick={() =>
                            onAbrirDiagnostico?.(item.id)
                          }
                        >
                          Abrir diagnóstico
                        </Botao>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div
                        style={{
                          color: MUTED,
                          fontSize: 8,
                          fontWeight: 900,
                        }}
                      >
                        ÁREA
                      </div>
                      <strong style={{ fontSize: 10 }}>
                        {item.area || "-"}
                      </strong>
                    </div>

                    <div>
                      <div
                        style={{
                          color: MUTED,
                          fontSize: 8,
                          fontWeight: 900,
                        }}
                      >
                        RESPONSÁVEL
                      </div>
                      <div style={{ fontSize: 9.5, marginTop: 4 }}>
                        {item.responsavelNome || "Sem responsável"}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          color: MUTED,
                          fontSize: 8,
                          fontWeight: 900,
                        }}
                      >
                        PRÓXIMO CONTATO
                      </div>

                      <div
                        style={{
                          fontSize: 9.5,
                          marginTop: 4,
                          color: atrasado(item.proximoContato)
                            ? "#A12B2B"
                            : NAVY,
                          fontWeight: atrasado(item.proximoContato)
                            ? 900
                            : 600,
                        }}
                      >
                        {dataCurta(item.proximoContato)}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          color: MUTED,
                          fontSize: 8,
                          fontWeight: 900,
                          marginBottom: 5,
                        }}
                      >
                        SCORE ÁREA
                      </div>

                      <strong>
                        {Number.isFinite(score)
                          ? `${score}/100`
                          : "-"}
                      </strong>

                      <div style={{ marginTop: 7 }}>
                        <Botao
                          onClick={() =>
                            onAbrirAtendimento?.(item.id)
                          }
                        >
                          Abrir atendimento
                        </Botao>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
