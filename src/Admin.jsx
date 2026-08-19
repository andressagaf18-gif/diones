import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

import {
  Search,
  Building2,
  ArrowLeft,
  LogOut,
  RefreshCcw,
  AlertTriangle,
  ChevronRight,
  Target,
  Download,
  Users,
  Activity,
  CheckCircle2,
  Clock3,
  Flame,
  UserPlus,
  Gauge,
  Save,
} from "lucide-react";

const NAVY = "#17233D";
const CORAL = "#FF6B4A";
const MUTED = "#5B667A";
const ICE = "#E9EDF5";
const WHITE = "#FFFFFF";
const BG = "#F3F5F8";

const BODY_FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const DISPLAY_FONT =
  "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif";

// =========================================================
// FUNÇÕES AUXILIARES
// =========================================================

function formatarData(valor) {
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

function formatarCnpj(valor = "") {
  const digits = String(valor).replace(/\D/g, "");

  if (digits.length !== 14) {
    return valor || "-";
  }

  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

function scoreInfo(score) {
  const numero = Number(score);

  if (!Number.isFinite(numero)) {
    return {
      label: "Sem score",
      color: MUTED,
      bg: "#EEF0F5",
    };
  }

  if (numero >= 80) {
    return {
      label: "Bom",
      color: "#0F6E56",
      bg: "#E1F5EE",
    };
  }

  if (numero >= 60) {
    return {
      label: "Atenção",
      color: "#854F0B",
      bg: "#FAEEDA",
    };
  }

  if (numero >= 40) {
    return {
      label: "Crítico",
      color: "#993C1D",
      bg: "#FAECE7",
    };
  }

  return {
    label: "Emergencial",
    color: "#791F1F",
    bg: "#FCEBEB",
  };
}

function normalizarLista(valor) {
  return Array.isArray(valor) ? valor : [];
}

function estruturaDiagnostico(item = {}) {
  const direto =
    item.estruturaNegocio ||
    item.estrutura_negocio ||
    item?.perfil?.estruturaNegocio ||
    item?.perfil?.estrutura_negocio ||
    item?.resultado?.estruturaNegocio ||
    item?.resultado?.estrutura_negocio ||
    "";

  if (direto) {
    return String(direto);
  }

  const segmento =
    String(
      item.segmento ||
      item?.empresa?.segmento ||
      ""
    ).toLowerCase();

  const razao =
    String(
      item.razaoSocial ||
      item?.empresa?.razaoSocial ||
      ""
    ).toLowerCase();

  const cnpj =
    String(
      item.cnpj ||
      item?.empresa?.cnpj ||
      ""
    ).replace(/\D/g, "");

  if (
    segmento.includes("pessoa física") ||
    segmento.includes("pessoa fisica")
  ) {
    return "pessoa_fisica";
  }

  if (
    razao.includes("avaliação de holding") ||
    razao.includes("avaliacao de holding")
  ) {
    return "avaliar_holding";
  }

  if (
    segmento.includes("holding") ||
    razao.includes("holding")
  ) {
    return "holding";
  }

  if (
    segmento.includes("grupo empresarial")
  ) {
    return "grupo";
  }

  if (
    segmento.includes("spe")
  ) {
    return "spe";
  }

  if (!cnpj && segmento.includes("financeira")) {
    return "pessoa_fisica";
  }

  return "operacional";
}

function labelEstruturaDiagnostico(valor) {
  const mapa = {
    operacional: "Empresa operacional",
    holding: "Holding",
    avaliar_holding: "Avaliação de Holding",
    grupo: "Grupo empresarial",
    spe: "SPE",
    pessoa_fisica: "Pessoa Física",
  };

  return mapa[valor] || valor || "Empresa operacional";
}

function corEstruturaDiagnostico(valor) {
  const mapa = {
    operacional: {
      bg: "#EEF3FF",
      color: "#31589C",
    },
    holding: {
      bg: "#FFF3EF",
      color: "#993C1D",
    },
    avaliar_holding: {
      bg: "#FAEEDA",
      color: "#854F0B",
    },
    grupo: {
      bg: "#E1F5EE",
      color: "#0F6E56",
    },
    spe: {
      bg: "#F3EEFF",
      color: "#6843A3",
    },
    pessoa_fisica: {
      bg: "#F1F3F7",
      color: NAVY,
    },
  };

  return (
    mapa[valor] ||
    mapa.operacional
  );
}

function areaCanonica(valor = "") {
  const texto = String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  const mapa = {
    financeiro: "financeiro",
    financeiropfpj: "financeiro",

    contabilfiscal: "contabilidade",
    contabilidade: "contabilidade",

    tributario: "tributario",

    operacional: "operacional",

    gestao: "gestao",

    comercial: "comercial",
    comercialvendas: "comercial",

    rh: "rh",
    recursoshumanos: "rh",
    pessoas: "rh",

    tecnologia: "tecnologia",

    administrativo: "administrativo",

    marketing: "marketing",

    juridico: "juridico",
  };

  return mapa[texto] || texto;
}

function responsavelCompativelComArea(responsavel, area) {
  const areaAlvo = areaCanonica(area);

  const areasResponsavel =
    normalizarLista(
      responsavel?.areas
    );

  if (!areasResponsavel.length) {
    return false;
  }

  return areasResponsavel.some(
    (item) =>
      areaCanonica(item) ===
      areaAlvo
  );
}

function juntarLista(valor) {
  return Array.isArray(valor)
    ? valor.filter(Boolean).join(" | ")
    : "";
}

function textoSeguro(valor) {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "string" || typeof valor === "number") return String(valor);
  if (Array.isArray(valor)) return valor.map(textoSeguro).filter(Boolean).join(" | ");
  if (typeof valor === "object") {
    return (
      valor.titulo ||
      valor.nome ||
      valor.indicador ||
      valor.pergunta ||
      valor.acao ||
      valor.objetivo ||
      valor.descricao ||
      valor.resumo ||
      JSON.stringify(valor)
    );
  }
  return String(valor);
}

function listaFlexivel(valor) {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor.filter(Boolean);
  if (typeof valor === "string") return valor.trim() ? [valor] : [];
  if (typeof valor === "object") {
    return Object.entries(valor)
      .filter(([, v]) => v !== null && v !== undefined && v !== "" && (!Array.isArray(v) || v.length))
      .map(([chave, v]) => ({
        chave,
        valor: v,
      }));
  }
  return [valor];
}

function tituloChave(chave = "") {
  const mapa = {
    primeiros30Dias: "0–30 dias",
    dias0a30: "0–30 dias",
    zeroA30: "0–30 dias",
    de0a30: "0–30 dias",
    dias31a60: "31–60 dias",
    trintaEUmA60: "31–60 dias",
    de31a60: "31–60 dias",
    dias61a90: "61–90 dias",
    sessentaEUmA90: "61–90 dias",
    de61a90: "61–90 dias",
  };

  if (mapa[chave]) return mapa[chave];

  return String(chave)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

function BlocoDossie({ titulo, children, destaque = false }) {
  return (
    <>
      <h2 style={tituloSecao}>{titulo}</h2>
      <Card
        style={
          destaque
            ? {
                border: "1px solid #F0C8BD",
                background: "#FFF9F7",
              }
            : {}
        }
      >
        {children}
      </Card>
    </>
  );
}

function ListaDossie({ itens, vazio = "Sem informação gerada." }) {
  const lista = listaFlexivel(itens);

  if (!lista.length) {
    return <span style={{ fontSize: 12, color: MUTED }}>{vazio}</span>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {lista.map((item, index) => {
        if (item && typeof item === "object" && "chave" in item) {
          return (
            <div
              key={index}
              style={{
                background: "#F7F8FB",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <strong style={{ display: "block", fontSize: 12, marginBottom: 5 }}>
                {tituloChave(item.chave)}
              </strong>
              {Array.isArray(item.valor) ? (
                <ListaDossie itens={item.valor} />
              ) : typeof item.valor === "object" && item.valor !== null ? (
                <ListaDossie itens={item.valor} />
              ) : (
                <div style={{ fontSize: 12, lineHeight: 1.55 }}>
                  {textoSeguro(item.valor)}
                </div>
              )}
            </div>
          );
        }

        if (item && typeof item === "object") {
          const titulo =
            item.titulo ||
            item.nome ||
            item.indicador ||
            item.pergunta ||
            item.acao ||
            item.objetivo ||
            `Item ${index + 1}`;

          const detalhes = Object.entries(item).filter(
            ([chave, valor]) =>
              !["titulo", "nome", "indicador", "pergunta", "acao", "objetivo"].includes(chave) &&
              valor !== null &&
              valor !== undefined &&
              valor !== "" &&
              (!Array.isArray(valor) || valor.length)
          );

          return (
            <div
              key={index}
              style={{
                background: "#F7F8FB",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <strong style={{ display: "block", fontSize: 12.5, marginBottom: 6 }}>
                {textoSeguro(titulo)}
              </strong>

              {detalhes.map(([chave, valor]) => (
                <div key={chave} style={{ fontSize: 11.5, lineHeight: 1.55, marginTop: 4 }}>
                  <strong>{tituloChave(chave)}:</strong>{" "}
                  {Array.isArray(valor)
                    ? valor.map(textoSeguro).filter(Boolean).join(" • ")
                    : typeof valor === "object"
                    ? textoSeguro(valor)
                    : String(valor)}
                </div>
              ))}
            </div>
          );
        }

        return (
          <div
            key={index}
            style={{
              display: "flex",
              gap: 9,
              alignItems: "flex-start",
              fontSize: 12,
              lineHeight: 1.55,
            }}
          >
            <span style={{ color: CORAL, fontWeight: 900 }}>•</span>
            <span>{textoSeguro(item)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Plano90Dias({ plano }) {
  const lista = listaFlexivel(plano);

  if (!lista.length) {
    return <span style={{ fontSize: 12, color: MUTED }}>Sem plano de 90 dias gerado.</span>;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
        gap: 12,
      }}
    >
      {lista.map((fase, index) => {
        if (fase && typeof fase === "object" && "chave" in fase) {
          return (
            <div
              key={index}
              style={{
                border: "1px solid #E3E7EF",
                borderRadius: 12,
                padding: 14,
                background: "#F7F8FB",
              }}
            >
              <strong style={{ display: "block", color: CORAL, marginBottom: 8 }}>
                {tituloChave(fase.chave)}
              </strong>
              <ListaDossie itens={fase.valor} />
            </div>
          );
        }

        return (
          <div
            key={index}
            style={{
              border: "1px solid #E3E7EF",
              borderRadius: 12,
              padding: 14,
              background: "#F7F8FB",
            }}
          >
            <ListaDossie itens={[fase]} />
          </div>
        );
      })}
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div
      style={{
        background: WHITE,
        border: "1px solid #E3E7EF",
        borderRadius: 14,
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Botao({
  children,
  onClick,
  disabled = false,
  secundario = false,
  style = {},
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: secundario
          ? "1px solid #D8DEEA"
          : "none",

        background: secundario
          ? WHITE
          : CORAL,

        color: secundario
          ? NAVY
          : WHITE,

        borderRadius: 10,
        padding: "10px 14px",
        fontFamily: BODY_FONT,
        fontSize: 13,
        fontWeight: 700,

        cursor: disabled
          ? "not-allowed"
          : "pointer",

        opacity: disabled
          ? 0.55
          : 1,

        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,

        ...style,
      }}
    >
      {children}
    </button>
  );
}

// =========================================================
// LOGIN
// =========================================================

function LoginAdmin({ onLogin }) {
  const [token, setToken] =
    useState("");

  const [erro, setErro] =
    useState("");

  const [carregando, setCarregando] =
    useState(false);

  async function entrar() {
    const valor =
      token.trim();

    if (!valor) {
      setErro(
        "Digite a senha administrativa."
      );

      return;
    }

    setCarregando(true);
    setErro("");

    try {
      const resposta =
        await fetch(
          "/api/listar-diagnosticos?limite=1",
          {
            headers: {
              Authorization:
                `Bearer ${valor}`,
            },
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => null);

      if (
        !resposta.ok ||
        !data?.sucesso
      ) {
        throw new Error(
          data?.error ||
          "Senha administrativa inválida."
        );
      }

      sessionStorage.setItem(
        "finder_admin_token",
        valor
      );

      onLogin(valor);

    } catch (error) {
      setErro(
        error?.message ||
        "Não foi possível acessar o painel."
      );

    } finally {
      setCarregando(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        fontFamily: BODY_FONT,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          background: WHITE,
          borderRadius: 20,
          padding: 30,
          boxShadow:
            "0 24px 60px rgba(23,35,61,0.14)",
        }}
      >
        <img
          src="/finder-logo.png"
          alt="Finder of Solutions"
          style={{
            width: 180,
            maxWidth: "70%",
            objectFit: "contain",
            marginBottom: 22,
          }}
        />

        <h1
          style={{
            fontFamily: DISPLAY_FONT,
            color: NAVY,
            fontSize: 28,
            margin: "0 0 7px",
          }}
        >
          Painel de Diagnósticos
        </h1>

        <p
          style={{
            fontSize: 13,
            color: MUTED,
            lineHeight: 1.5,
            margin: "0 0 22px",
          }}
        >
          Área restrita da Finder para consulta
          dos diagnósticos empresariais realizados.
        </p>

        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 700,
            color: NAVY,
            marginBottom: 7,
          }}
        >
          Senha administrativa
        </label>

        <input
          type="password"
          value={token}
          onChange={(e) => {
            setToken(
              e.target.value
            );

            setErro("");
          }}
          onKeyDown={(e) => {
            if (
              e.key === "Enter"
            ) {
              entrar();
            }
          }}
          autoComplete="current-password"
          placeholder="Digite o ADMIN_TOKEN"
          style={{
            width: "100%",
            boxSizing: "border-box",
            border:
              "1px solid #D8DEEA",
            borderRadius: 10,
            padding: "12px 13px",
            fontFamily: BODY_FONT,
            fontSize: 14,
            color: NAVY,
            marginBottom: 12,
          }}
        />

        {erro && (
          <div
            style={{
              background: "#FAECE7",
              color: "#993C1D",
              borderRadius: 9,
              padding: 10,
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            {erro}
          </div>
        )}

        <Botao
          onClick={entrar}
          disabled={carregando}
          style={{
            width: "100%",
          }}
        >
          {carregando
            ? "Validando..."
            : "Entrar no painel"}
        </Botao>
      </div>
    </div>
  );
}

// =========================================================
// LISTA DE DIAGNÓSTICOS
// =========================================================

function ListaDiagnosticos({
  token,
  onAbrir,
  onLogout,
}) {
  const [
    diagnosticos,
    setDiagnosticos,
  ] = useState([]);

  const [
    busca,
    setBusca,
  ] = useState("");

  const [
    buscaAplicada,
    setBuscaAplicada,
  ] = useState("");

  const [
    estruturaFiltro,
    setEstruturaFiltro,
  ] = useState("");

  const [
    total,
    setTotal,
  ] = useState(0);

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    exportando,
    setExportando,
  ] = useState(false);

  const [
    erro,
    setErro,
  ] = useState("");

  // =======================================================
  // CARREGAR LISTA
  // =======================================================

  async function carregar(
    termo = ""
  ) {
    setCarregando(true);
    setErro("");

    try {
      const params =
        new URLSearchParams();

      params.set(
        "limite",
        "100"
      );

      params.set(
        "offset",
        "0"
      );

      if (
        termo.trim()
      ) {
        params.set(
          "busca",
          termo.trim()
        );
      }

      const resposta =
        await fetch(
          `/api/listar-diagnosticos?${params.toString()}`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => null);

      if (
        !resposta.ok ||
        !data?.sucesso
      ) {
        if (
          resposta.status ===
          401
        ) {
          throw new Error(
            "Sua sessão administrativa expirou."
          );
        }

        throw new Error(
          data?.error ||
          "Não foi possível carregar os diagnósticos."
        );
      }

      setDiagnosticos(
        Array.isArray(
          data.diagnosticos
        )
          ? data.diagnosticos
          : []
      );

      setTotal(
        Number(
          data.total
        ) || 0
      );

    } catch (error) {
      setErro(
        error?.message ||
        "Erro ao carregar diagnósticos."
      );

    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar("");
  }, []);

  function pesquisar() {
    const termo =
      busca.trim();

    setBuscaAplicada(
      termo
    );

    carregar(
      termo
    );
  }

  function limparBusca() {
    setBusca("");
    setBuscaAplicada("");
    setEstruturaFiltro("");
    carregar("");
  }

  const diagnosticosFiltrados =
    useMemo(() => {
      if (!estruturaFiltro) {
        return diagnosticos;
      }

      return diagnosticos.filter(
        (item) =>
          estruturaDiagnostico(item) ===
          estruturaFiltro
      );
    }, [
      diagnosticos,
      estruturaFiltro,
    ]);

  const estruturasResumo =
    useMemo(() => {
      return diagnosticos.reduce(
        (acc, item) => {
          const estrutura =
            estruturaDiagnostico(
              item
            );

          acc[estrutura] =
            (acc[estrutura] || 0) + 1;

          return acc;
        },
        {}
      );
    }, [diagnosticos]);

  // =======================================================
  // SCORE MÉDIO
  // =======================================================

  const mediaScore =
    useMemo(() => {
      const scores =
        diagnosticosFiltrados
          .map(
            (d) =>
              Number(
                d.score
              )
          )
          .filter(
            Number.isFinite
          );

      if (!scores.length) {
        return null;
      }

      return Math.round(
        scores.reduce(
          (
            acc,
            valor
          ) =>
            acc + valor,
          0
        ) /
        scores.length
      );
    }, [diagnosticos]);

  // =======================================================
  // EXPORTAR EXCEL
  // =======================================================

  async function exportarExcel() {
    if (exportando) {
      return;
    }

    setExportando(true);
    setErro("");

    try {
      const resposta =
        await fetch(
          "/api/exportar-diagnosticos",
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => null);

      if (
        !resposta.ok ||
        !data?.sucesso ||
        !Array.isArray(
          data.diagnosticos
        )
      ) {
        throw new Error(
          data?.error ||
          "Não foi possível carregar os dados para exportação."
        );
      }

      const registros =
        data.diagnosticos;

      if (
        registros.length === 0
      ) {
        throw new Error(
          "Não existem diagnósticos para exportar."
        );
      }

      // ===================================================
      // ABA 1 - DIAGNÓSTICOS
      // ===================================================

      const abaDiagnosticos =
        registros.map(
          (item) => {
            const participante =
              item.participante ||
              {};

            const empresa =
              item.empresa ||
              {};

            const dores =
              Array.isArray(
                item.dores
              )
                ? item.dores
                : [];

            const doresEstruturadas =
              item.doresEstruturadas ||
              {};

            const negocio =
              item.negocioInterpretado ||
              {};

            const resultado =
              item.resultado ||
              {};

            const diagnosticoGeral =
              resultado.diagnosticoGeral ||
              {};

            return {
              "ID":
                item.id ||
                "",

              "Data":
                item.criadoEm
                  ? new Date(
                      item.criadoEm
                    ).toLocaleString(
                      "pt-BR"
                    )
                  : "",

              "Estrutura":
                labelEstruturaDiagnostico(
                  estruturaDiagnostico(
                    item
                  )
                ),

              "Empresa":
                empresa.razaoSocial ||
                "",

              "CNPJ":
                formatarCnpj(
                  empresa.cnpj ||
                  ""
                ),

              "Responsável":
                participante.nome ||
                "",

              "Cargo":
                participante.cargo ||
                "",

              "Telefone":
                participante.telefone ||
                "",

              "E-mail":
                participante.email ||
                "",

              "Descrição do negócio":
                empresa.descricaoNegocio ||
                "",

              "Segmento":
                empresa.segmento ||
                "",

              "Subsegmento":
                empresa.subsegmento ||
                "",

              "Score":
                item.score ??
                "",

              "Dores declaradas":
                dores.join(
                  " | "
                ),

              "Dor principal":
                doresEstruturadas
                  .principal ||
                dores[0] ||
                "",

              "Objetivo 90 dias":
                doresEstruturadas
                  .objetivo90Dias ||
                "",

              "Impactos da dor":
                juntarLista(
                  doresEstruturadas
                    .impactos
                ),

              "Modelo de negócio":
                negocio.modeloNegocio ||
                negocio.modeloOperacional ||
                "",

              "Como gera receita":
                negocio.comoGeraReceita ||
                "",

              "Resumo executivo":
                diagnosticoGeral
                  .resumoExecutivo ||
                "",

              "Alerta estratégico":
                diagnosticoGeral
                  .alertaEstrategico ||
                "",

              "Leitura das dores":
                diagnosticoGeral
                  .leituraDasDores ||
                diagnosticoGeral
                  .leituraDaDor ||
                "",

              "Principais dores IA":
                juntarLista(
                  diagnosticoGeral
                    .principaisDores
                ),

              "Causas prováveis":
                juntarLista(
                  diagnosticoGeral
                    .causasProvaveis
                ),

              "Impactos":
                juntarLista(
                  diagnosticoGeral
                    .impactos
                ),

              "Pontos fortes":
                juntarLista(
                  diagnosticoGeral
                    .pontosFortes
                ),

              "Prioridades imediatas":
                juntarLista(
                  diagnosticoGeral
                    .prioridadesImediatas
                ),

              "Oportunidades":
                juntarLista(
                  diagnosticoGeral
                    .oportunidades
                ),

              "Próximos passos":
                juntarLista(
                  diagnosticoGeral
                    .proximosPassos
                ),
            };
          }
        );

      // ===================================================
      // ABA 2 - PERGUNTAS E RESPOSTAS
      // ===================================================

      const abaPerguntas = [];

      registros.forEach(
        (item) => {
          const participante =
            item.participante ||
            {};

          const empresa =
            item.empresa ||
            {};

          const perguntas =
            Array.isArray(
              item.perguntasRespostas
            )
              ? item.perguntasRespostas
              : [];

          perguntas.forEach(
            (
              pergunta,
              index
            ) => {
              abaPerguntas.push({
                "ID Diagnóstico":
                  item.id ||
                  "",

                "Data":
                  item.criadoEm
                    ? new Date(
                        item.criadoEm
                      ).toLocaleString(
                        "pt-BR"
                      )
                    : "",

                "Empresa":
                  empresa.razaoSocial ||
                  "",

                "CNPJ":
                  formatarCnpj(
                    empresa.cnpj ||
                    ""
                  ),

                "Responsável":
                  participante.nome ||
                  "",

                "Nº":
                  index + 1,

                "Área":
                  pergunta.area ||
                  "",

                "Área ID":
                  pergunta.areaId ||
                  "",

                "Tema":
                  pergunta.tema ||
                  "",

                "Pergunta":
                  pergunta.pergunta ||
                  "",

                "Resposta":
                  pergunta.resposta ||
                  "",

                "Peso":
                  pergunta.peso ??
                  "",

                "Importância":
                  pergunta.importancia ??
                  "",

                "Motivo":
                  pergunta.motivo ||
                  "",

                "Risco avaliado":
                  pergunta.riscoAvaliado ||
                  "",
              });
            }
          );
        }
      );

      // ===================================================
      // ABA 3 - ANÁLISE POR ÁREA
      // ===================================================

      const abaAreas = [];

      registros.forEach(
        (item) => {
          const empresa =
            item.empresa ||
            {};

          const areas =
            Array.isArray(
              item.areas
            )
              ? item.areas
              : [];

          areas.forEach(
            (area) => {
              abaAreas.push({
                "ID Diagnóstico":
                  item.id ||
                  "",

                "Data":
                  item.criadoEm
                    ? new Date(
                        item.criadoEm
                      ).toLocaleString(
                        "pt-BR"
                      )
                    : "",

                "Empresa":
                  empresa.razaoSocial ||
                  "",

                "CNPJ":
                  formatarCnpj(
                    empresa.cnpj ||
                    ""
                  ),

                "Área":
                  area.area ||
                  "",

                "Score":
                  area.score ??
                  "",

                "Nível":
                  area.nivel ||
                  "",

                "Prioridade":
                  area.prioridade ??
                  "",

                "Resumo":
                  area.resumo ||
                  "",

                "Achados":
                  juntarLista(
                    area.achados
                  ),

                "Causas prováveis":
                  juntarLista(
                    area.causasProvaveis
                  ),

                "Riscos":
                  juntarLista(
                    area.riscos
                  ),

                "Recomendações":
                  juntarLista(
                    area.recomendacoes
                  ),
              });
            }
          );
        }
      );

      // ===================================================
      // ABA 4 - DORES E OBJETIVOS
      // ===================================================

      const abaDores = [];

      registros.forEach(
        (item) => {
          const empresa =
            item.empresa ||
            {};

          const participante =
            item.participante ||
            {};

          const estruturadas =
            item.doresEstruturadas ||
            {};

          const dores =
            Array.isArray(
              estruturadas.selecionadas
            )
              ? estruturadas.selecionadas

              : Array.isArray(
                  item.dores
                )
                ? item.dores

                : [];

          // Mesmo se não houver dor,
          // mantém uma linha com o diagnóstico.
          if (
            dores.length === 0
          ) {
            abaDores.push({
              "ID Diagnóstico":
                item.id ||
                "",

              "Data":
                item.criadoEm
                  ? new Date(
                      item.criadoEm
                    ).toLocaleString(
                      "pt-BR"
                    )
                  : "",

              "Empresa":
                empresa.razaoSocial ||
                "",

              "CNPJ":
                formatarCnpj(
                  empresa.cnpj ||
                  ""
                ),

              "Responsável":
                participante.nome ||
                "",

              "Dor Nº":
                "",

              "Dor":
                "",

              "Dor principal":
                estruturadas.principal ||
                "",

              "Objetivo 90 dias":
                estruturadas
                  .objetivo90Dias ||
                "",

              "Impactos":
                juntarLista(
                  estruturadas
                    .impactos
                ),
            });

            return;
          }

          dores.forEach(
            (
              dor,
              index
            ) => {
              abaDores.push({
                "ID Diagnóstico":
                  item.id ||
                  "",

                "Data":
                  item.criadoEm
                    ? new Date(
                        item.criadoEm
                      ).toLocaleString(
                        "pt-BR"
                      )
                    : "",

                "Empresa":
                  empresa.razaoSocial ||
                  "",

                "CNPJ":
                  formatarCnpj(
                    empresa.cnpj ||
                    ""
                  ),

                "Responsável":
                  participante.nome ||
                  "",

                "Dor Nº":
                  index + 1,

                "Dor":
                  dor,

                "Dor principal":
                  estruturadas.principal ||
                  dores[0] ||
                  "",

                "Objetivo 90 dias":
                  estruturadas
                    .objetivo90Dias ||
                  "",

                "Impactos":
                  juntarLista(
                    estruturadas
                      .impactos
                  ),
              });
            }
          );
        }
      );

      // ===================================================
      // CRIAR ARQUIVO EXCEL
      // ===================================================

      const workbook =
        XLSX.utils.book_new();

      const wsDiagnosticos =
        XLSX.utils.json_to_sheet(
          abaDiagnosticos
        );

      const wsPerguntas =
        XLSX.utils.json_to_sheet(
          abaPerguntas
        );

      const wsAreas =
        XLSX.utils.json_to_sheet(
          abaAreas
        );

      const wsDores =
        XLSX.utils.json_to_sheet(
          abaDores
        );

      // ===================================================
      // LARGURA DAS COLUNAS
      // ===================================================

      wsDiagnosticos["!cols"] = [
        { wch: 38 },
        { wch: 20 },
        { wch: 38 },
        { wch: 20 },
        { wch: 25 },
        { wch: 18 },
        { wch: 18 },
        { wch: 30 },
        { wch: 60 },
        { wch: 35 },
        { wch: 50 },
        { wch: 10 },
        { wch: 50 },
        { wch: 40 },
        { wch: 60 },
        { wch: 60 },
        { wch: 40 },
        { wch: 60 },
        { wch: 80 },
        { wch: 80 },
        { wch: 80 },
        { wch: 80 },
        { wch: 80 },
        { wch: 80 },
        { wch: 80 },
        { wch: 80 },
        { wch: 80 },
      ];

      wsPerguntas["!cols"] = [
        { wch: 38 },
        { wch: 20 },
        { wch: 38 },
        { wch: 20 },
        { wch: 25 },
        { wch: 8 },
        { wch: 28 },
        { wch: 16 },
        { wch: 35 },
        { wch: 90 },
        { wch: 18 },
        { wch: 10 },
        { wch: 12 },
        { wch: 70 },
        { wch: 70 },
      ];

      wsAreas["!cols"] = [
        { wch: 38 },
        { wch: 20 },
        { wch: 38 },
        { wch: 20 },
        { wch: 28 },
        { wch: 10 },
        { wch: 15 },
        { wch: 15 },
        { wch: 80 },
        { wch: 90 },
        { wch: 90 },
        { wch: 90 },
        { wch: 90 },
      ];

      wsDores["!cols"] = [
        { wch: 38 },
        { wch: 20 },
        { wch: 38 },
        { wch: 20 },
        { wch: 25 },
        { wch: 10 },
        { wch: 45 },
        { wch: 45 },
        { wch: 70 },
        { wch: 70 },
      ];

      // ===================================================
      // ADICIONAR ABAS
      // ===================================================

      XLSX.utils.book_append_sheet(
        workbook,
        wsDiagnosticos,
        "Diagnósticos"
      );

      XLSX.utils.book_append_sheet(
        workbook,
        wsPerguntas,
        "Perguntas Respostas"
      );

      XLSX.utils.book_append_sheet(
        workbook,
        wsAreas,
        "Análise por Área"
      );

      XLSX.utils.book_append_sheet(
        workbook,
        wsDores,
        "Dores e Objetivos"
      );

      // ===================================================
      // DOWNLOAD
      // ===================================================

      const agora =
        new Date();

      const dataArquivo =
        agora
          .toISOString()
          .slice(
            0,
            10
          );

      const nomeArquivo =
        `diagnosticos-finder-${dataArquivo}.xlsx`;

      XLSX.writeFile(
        workbook,
        nomeArquivo
      );

    } catch (error) {
      console.error(
        "Erro exportação Excel:",
        error
      );

      setErro(
        error?.message ||
        "Não foi possível gerar o Excel."
      );

    } finally {
      setExportando(false);
    }
  }

  // =======================================================
  // RENDER LISTA
  // =======================================================

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        fontFamily: BODY_FONT,
        color: NAVY,
      }}
    >
      <header
        style={{
          background: NAVY,
          color: WHITE,
          padding: "18px 28px",
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: "0 auto",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems:
                "center",
              gap: 18,
            }}
          >
            <img
              src="/finder-logo.png"
              alt="Finder of Solutions"
              style={{
                maxWidth: 150,
                maxHeight: 45,
                objectFit:
                  "contain",
                background:
                  WHITE,
                padding: 5,
                borderRadius: 7,
              }}
            />

            <div>
              <h1
                style={{
                  margin: 0,
                  fontFamily:
                    DISPLAY_FONT,
                  fontSize: 24,
                }}
              >
                Diagnósticos
              </h1>

              <p
                style={{
                  margin:
                    "3px 0 0",
                  fontSize: 11,
                  opacity: 0.7,
                }}
              >
                Painel administrativo
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            style={{
              background:
                "transparent",

              border:
                "1px solid rgba(255,255,255,.30)",

              color:
                WHITE,

              borderRadius:
                9,

              padding:
                "8px 11px",

              cursor:
                "pointer",

              display:
                "flex",

              alignItems:
                "center",

              gap: 6,
            }}
          >
            <LogOut
              size={15}
            />

            Sair
          </button>
        </div>
      </header>

      <main
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding:
            "26px 22px 50px",
        }}
      >
        {/* ================================================= */}
        {/* CARDS RESUMO */}
        {/* ================================================= */}

        <div
          style={{
            display: "grid",

            gridTemplateColumns:
              "repeat(auto-fit,minmax(190px,1fr))",

            gap: 12,

            marginBottom:
              20,
          }}
        >
          <Card>
            <div
              style={{
                color: MUTED,
                fontSize: 11,
                marginBottom: 7,
              }}
            >
              DIAGNÓSTICOS
            </div>

            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
              }}
            >
              {total}
            </div>
          </Card>

          <Card>
            <div
              style={{
                color: MUTED,
                fontSize: 11,
                marginBottom: 7,
              }}
            >
              EXIBIDOS
            </div>

            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
              }}
            >
              {diagnosticosFiltrados.length}
            </div>
          </Card>

          <Card>
            <div
              style={{
                color: MUTED,
                fontSize: 11,
                marginBottom: 7,
              }}
            >
              SCORE MÉDIO
            </div>

            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
              }}
            >
              {mediaScore ??
                "-"}
            </div>
          </Card>
        </div>

        {/* ================================================= */}
        {/* BUSCA + EXPORTAÇÃO */}
        {/* ================================================= */}

        <Card
          style={{
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 9,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                flex:
                  "1 1 360px",

                position:
                  "relative",
              }}
            >
              <Search
                size={16}
                color={MUTED}
                style={{
                  position:
                    "absolute",
                  top: 12,
                  left: 12,
                }}
              />

              <input
                value={busca}
                onChange={(
                  e
                ) =>
                  setBusca(
                    e.target
                      .value
                  )
                }
                onKeyDown={(
                  e
                ) => {
                  if (
                    e.key ===
                    "Enter"
                  ) {
                    pesquisar();
                  }
                }}
                placeholder="Buscar empresa, CNPJ, nome, e-mail, segmento..."
                style={{
                  width:
                    "100%",

                  boxSizing:
                    "border-box",

                  border:
                    "1px solid #D8DEEA",

                  borderRadius:
                    9,

                  padding:
                    "10px 12px 10px 36px",

                  fontFamily:
                    BODY_FONT,

                  fontSize:
                    13,
                }}
              />
            </div>

            <select
              value={
                estruturaFiltro
              }
              onChange={(e) =>
                setEstruturaFiltro(
                  e.target.value
                )
              }
              style={{
                minWidth: 210,
                border:
                  "1px solid #D8DEEA",
                borderRadius: 9,
                padding:
                  "10px 12px",
                background: WHITE,
                fontFamily: BODY_FONT,
                fontSize: 12,
                color: NAVY,
              }}
            >
              <option value="">
                Todas as estruturas
              </option>

              <option value="operacional">
                Empresa operacional ({estruturasResumo.operacional || 0})
              </option>

              <option value="holding">
                Holding ({estruturasResumo.holding || 0})
              </option>

              <option value="avaliar_holding">
                Avaliação de Holding ({estruturasResumo.avaliar_holding || 0})
              </option>

              <option value="grupo">
                Grupo empresarial ({estruturasResumo.grupo || 0})
              </option>

              <option value="spe">
                SPE ({estruturasResumo.spe || 0})
              </option>

              <option value="pessoa_fisica">
                Pessoa Física ({estruturasResumo.pessoa_fisica || 0})
              </option>
            </select>

            <Botao
              onClick={
                pesquisar
              }
            >
              <Search
                size={14}
              />

              Buscar
            </Botao>

            {(buscaAplicada || estruturaFiltro) && (
              <Botao
                secundario
                onClick={
                  limparBusca
                }
              >
                Limpar
              </Botao>
            )}

            <Botao
              secundario
              onClick={() =>
                carregar(
                  buscaAplicada
                )
              }
            >
              <RefreshCcw
                size={14}
              />

              Atualizar
            </Botao>

            <Botao
              secundario
              onClick={
                exportarExcel
              }
              disabled={
                exportando
              }
              style={{
                borderColor:
                  "#0F6E56",

                color:
                  "#0F6E56",
              }}
            >
              <Download
                size={14}
              />

              {exportando
                ? "Gerando Excel..."
                : "Exportar Excel"}
            </Botao>
          </div>
        </Card>

        {/* ================================================= */}
        {/* ERRO */}
        {/* ================================================= */}

        {erro && (
          <div
            style={{
              background:
                "#FAECE7",

              color:
                "#993C1D",

              padding:
                13,

              borderRadius:
                10,

              marginBottom:
                14,

              display:
                "flex",

              gap:
                8,

              alignItems:
                "flex-start",
            }}
          >
            <AlertTriangle
              size={17}
              style={{
                flexShrink: 0,
              }}
            />

            <div>
              {erro}
            </div>
          </div>
        )}

        {/* ================================================= */}
        {/* LISTA */}
        {/* ================================================= */}

        {carregando ? (
          <Card>
            Carregando diagnósticos...
          </Card>

        ) : diagnosticosFiltrados.length ===
          0 ? (
          <Card>
            Nenhum diagnóstico encontrado.
          </Card>

        ) : (
          <div
            style={{
              display: "flex",
              flexDirection:
                "column",
              gap: 10,
            }}
          >
            {diagnosticosFiltrados.map(
              (item) => {
                const score =
                  scoreInfo(
                    item.score
                  );

                const dores =
                  normalizarLista(
                    item.dores
                  );

                return (
                  <button
                    key={
                      item.id
                    }
                    onClick={() =>
                      onAbrir(
                        item.id
                      )
                    }
                    style={{
                      width:
                        "100%",

                      background:
                        WHITE,

                      border:
                        "1px solid #E2E6EE",

                      borderRadius:
                        14,

                      padding:
                        16,

                      textAlign:
                        "left",

                      cursor:
                        "pointer",

                      display:
                        "grid",

                      gridTemplateColumns:
                        "minmax(250px,2fr) minmax(180px,1.2fr) 90px 34px",

                      gap:
                        15,

                      alignItems:
                        "center",

                      fontFamily:
                        BODY_FONT,

                      color:
                        NAVY,
                    }}
                  >
                    <div>
                      {(() => {
                        const estrutura =
                          estruturaDiagnostico(
                            item
                          );

                        const cor =
                          corEstruturaDiagnostico(
                            estrutura
                          );

                        return (
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              background:
                                cor.bg,
                              color:
                                cor.color,
                              borderRadius: 20,
                              padding:
                                "4px 8px",
                              fontSize: 9,
                              fontWeight: 900,
                              marginBottom: 7,
                            }}
                          >
                            ESTRUTURA ·{" "}
                            {labelEstruturaDiagnostico(
                              estrutura
                            )}
                          </div>
                        );
                      })()}

                      <div
                        style={{
                          fontSize:
                            9.5,
                          color:
                            MUTED,
                          fontWeight:
                            800,
                          marginBottom:
                            3,
                        }}
                      >
                        {estruturaDiagnostico(item) ===
                        "pessoa_fisica"
                          ? "PESSOA"
                          : "EMPRESA"}
                      </div>

                      <div
                        style={{
                          fontSize:
                            14,

                          fontWeight:
                            800,

                          marginBottom:
                            4,
                        }}
                      >
                        {item.razaoSocial ||
                          item.nome ||
                          (
                            estruturaDiagnostico(
                              item
                            ) ===
                            "pessoa_fisica"
                              ? "Pessoa física"
                              : estruturaDiagnostico(
                                  item
                                ) ===
                                "avaliar_holding"
                              ? "Avaliação de Holding"
                              : "Empresa não informada"
                          )}
                      </div>

                      <div
                        style={{
                          fontSize:
                            11.5,

                          color:
                            MUTED,

                          display:
                            "flex",

                          gap:
                            9,

                          flexWrap:
                            "wrap",
                        }}
                      >
                        {item.cnpj && (
                          <span>
                            {formatarCnpj(
                              item.cnpj
                            )}
                          </span>
                        )}

                        {item.segmento && (
                          <span>
                            {
                              item.segmento
                            }
                          </span>
                        )}
                      </div>

                      {dores.length >
                        0 && (
                        <div
                          style={{
                            display:
                              "flex",

                            gap:
                              5,

                            flexWrap:
                              "wrap",

                            marginTop:
                              8,
                          }}
                        >
                          {dores
                            .slice(
                              0,
                              3
                            )
                            .map(
                              (
                                dor,
                                index
                              ) => (
                                <span
                                  key={`${dor}-${index}`}
                                  style={{
                                    fontSize:
                                      9.5,

                                    background:
                                      "#FFF3EF",

                                    color:
                                      "#993C1D",

                                    borderRadius:
                                      20,

                                    padding:
                                      "3px 7px",
                                  }}
                                >
                                  {
                                    dor
                                  }
                                </span>
                              )
                            )}
                        </div>
                      )}
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize:
                            12,

                          fontWeight:
                            700,
                        }}
                      >
                        {item.nome ||
                          "Participante não informado"}
                      </div>

                      <div
                        style={{
                          fontSize:
                            10.5,

                          color:
                            MUTED,

                          marginTop:
                            3,
                        }}
                      >
                        {item.email ||
                          "-"}
                      </div>

                      <div
                        style={{
                          fontSize:
                            10.5,

                          color:
                            MUTED,

                          marginTop:
                            5,
                        }}
                      >
                        {formatarData(
                          item.criadoEm
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        textAlign:
                          "center",
                      }}
                    >
                      <div
                        style={{
                          background:
                            score.bg,

                          color:
                            score.color,

                          borderRadius:
                            12,

                          padding:
                            "8px 6px",
                        }}
                      >
                        <strong
                          style={{
                            fontSize:
                              19,
                          }}
                        >
                          {item.score ??
                            "-"}
                        </strong>

                        <div
                          style={{
                            fontSize:
                              8.5,

                            marginTop:
                              1,
                          }}
                        >
                          {
                            score.label
                          }
                        </div>
                      </div>
                    </div>

                    <ChevronRight
                      size={20}
                      color={MUTED}
                    />
                  </button>
                );
              }
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// =========================================================
// LEADS / CRM
// =========================================================

function LeadsCRM({ token, onAbrirDiagnostico }) {
  const [leads, setLeads] = useState([]);
  const [resumo, setResumo] = useState({});
  const [busca, setBusca] = useState("");
  const [origem, setOrigem] = useState("");
  const [statusDiagnostico, setStatusDiagnostico] = useState("");
  const [prioridadeComercial, setPrioridadeComercial] = useState("");
  const [responsaveis, setResponsaveis] = useState([]);
  const [atribuindoLeadId, setAtribuindoLeadId] = useState("");
  const [selecoesResponsavel, setSelecoesResponsavel] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  async function carregarLeads() {
    setCarregando(true);
    setErro("");

    try {
      const params = new URLSearchParams();
      params.set("limite", "200");

      if (busca.trim()) params.set("busca", busca.trim());
      if (origem) params.set("origem", origem);
      if (statusDiagnostico) {
        params.set("statusDiagnostico", statusDiagnostico);
      }

      if (prioridadeComercial) {
        params.set("prioridadeComercial", prioridadeComercial);
      }

      const resposta = await fetch(
        `/api/crm?action=listar-leads&${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await resposta.json().catch(() => null);

      if (!resposta.ok || !data?.sucesso) {
        throw new Error(
          data?.error || "Não foi possível carregar os leads."
        );
      }

      setLeads(Array.isArray(data.leads) ? data.leads : []);
      setResumo(data.resumo || {});
    } catch (error) {
      setErro(error?.message || "Erro ao carregar leads.");
    } finally {
      setCarregando(false);
    }
  }

  async function carregarResponsaveis() {
    try {
      const resposta = await fetch(
        "/api/crm?action=listar-responsaveis",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data =
        await resposta
          .json()
          .catch(() => null);

      if (
        !resposta.ok ||
        !data?.sucesso
      ) {
        throw new Error(
          data?.error ||
          "Não foi possível carregar os responsáveis."
        );
      }

      setResponsaveis(
        Array.isArray(
          data.responsaveis
        )
          ? data.responsaveis
          : []
      );
    } catch (error) {
      console.warn(
        "[CRM] Erro ao carregar responsáveis:",
        error
      );
    }
  }

  async function atribuirLead(
    leadId,
    responsavelId
  ) {
    if (
      !leadId ||
      !responsavelId
    ) {
      return;
    }

    setAtribuindoLeadId(
      leadId
    );

    setErro("");

    try {
      const resposta =
        await fetch(
          "/api/crm?action=atribuir-lead",
          {
            method: "POST",

            headers: {
              "content-type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body: JSON.stringify({
              leadId,
              responsavelId,
            }),
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => null);

      if (
        !resposta.ok ||
        !data?.sucesso
      ) {
        throw new Error(
          data?.error ||
          "Não foi possível atribuir o lead."
        );
      }

      await Promise.all([
        carregarLeads(),
        carregarResponsaveis(),
      ]);
    } catch (error) {
      setErro(
        error?.message ||
        "Erro ao atribuir lead."
      );
    } finally {
      setAtribuindoLeadId(
        ""
      );
    }
  }

  useEffect(() => {
    carregarLeads();
    carregarResponsaveis();
  }, []);

  const origensDisponiveis = useMemo(() => {
    return [...new Set(leads.map((lead) => lead.origem).filter(Boolean))].sort();
  }, [leads]);

  function corStatus(status) {
    if (status === "CONCLUIDO") return { bg: "#E1F5EE", color: "#0F6E56" };
    if (status === "EM_PREENCHIMENTO") return { bg: "#FAEEDA", color: "#854F0B" };
    if (status === "NAO_CONCLUIDO") return { bg: "#FCEBEB", color: "#791F1F" };
    return { bg: "#EEF0F5", color: MUTED };
  }

  function labelStatus(status) {
    const mapa = {
      ACESSOU: "Acessou",
      EM_PREENCHIMENTO: "Em preenchimento",
      NAO_CONCLUIDO: "Não concluído",
      CONCLUIDO: "Concluído",
    };
    return mapa[status] || status || "-";
  }

  function temperatura(lead) {
    const mapa = {
      MUITO_ALTA: "Muito alta",
      ALTA: "Alta",
      MEDIA: "Média",
      BAIXA: "Baixa",
    };

    const valor =
      lead.temperaturaComercial ||
      lead.temperatura;

    return mapa[valor] || valor || "-";
  }

  function prioridadeInfo(prioridade) {
    const mapa = {
      A: {
        label: "Prioridade A",
        descricao: "Atendimento imediato",
        bg: "#FCEBEB",
        color: "#791F1F",
      },
      B: {
        label: "Prioridade B",
        descricao: "Alta",
        bg: "#FAEEDA",
        color: "#854F0B",
      },
      C: {
        label: "Prioridade C",
        descricao: "Acompanhar",
        bg: "#FFF3EF",
        color: "#993C1D",
      },
      D: {
        label: "Prioridade D",
        descricao: "Nutrição",
        bg: "#EEF0F5",
        color: MUTED,
      },
    };

    return (
      mapa[prioridade] || {
        label: "Não classificado",
        descricao: "",
        bg: "#EEF0F5",
        color: MUTED,
      }
    );
  }

  function textoProximaAcao(valor) {
    const mapa = {
      CONTATO_COMERCIAL: "Contato comercial",
      AGENDAR_REUNIAO: "Agendar reunião",
      FOLLOW_UP_CONSULTIVO: "Follow-up consultivo",
      NUTRICAO: "Nutrição",
    };

    return mapa[valor] || valor || "-";
  }

  function textoPrazo(valor) {
    const mapa = {
      "2_HORAS": "Até 2 horas",
      "24_HORAS": "Até 24 horas",
      "3_DIAS": "Até 3 dias",
      NUTRICAO: "Sem urgência",
    };

    return mapa[valor] || valor || "-";
  }

  function nomeResponsavel(id) {
    if (!id) {
      return "Não atribuído";
    }

    const encontrado =
      responsaveis.find(
        (item) =>
          item.id === id
      );

    return (
      encontrado?.nome ||
      "Responsável não encontrado"
    );
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <Card>
          <Users size={18} color={CORAL} />
          <div style={{ color: MUTED, fontSize: 10, marginTop: 8 }}>LEADS</div>
          <div style={{ fontSize: 29, fontWeight: 900 }}>{resumo.total ?? 0}</div>
        </Card>

        <Card>
          <Activity size={18} color="#854F0B" />
          <div style={{ color: MUTED, fontSize: 10, marginTop: 8 }}>
            EM PREENCHIMENTO
          </div>
          <div style={{ fontSize: 29, fontWeight: 900 }}>
            {resumo.emPreenchimento ?? 0}
          </div>
        </Card>

        <Card>
          <Clock3 size={18} color="#791F1F" />
          <div style={{ color: MUTED, fontSize: 10, marginTop: 8 }}>
            NÃO CONCLUÍDOS
          </div>
          <div style={{ fontSize: 29, fontWeight: 900 }}>
            {resumo.naoConcluidos ?? 0}
          </div>
        </Card>

        <Card>
          <CheckCircle2 size={18} color="#0F6E56" />
          <div style={{ color: MUTED, fontSize: 10, marginTop: 8 }}>CONCLUÍDOS</div>
          <div style={{ fontSize: 29, fontWeight: 900 }}>
            {resumo.concluidos ?? 0}
          </div>
        </Card>

        <Card>
          <div style={{ color: MUTED, fontSize: 10 }}>TAXA DE CONCLUSÃO</div>
          <div style={{ fontSize: 29, fontWeight: 900 }}>
            {resumo.taxaConclusao ?? 0}%
          </div>
        </Card>

        <Card
          style={{
            background: "#FCEBEB",
            borderColor: "#F0C5C5",
          }}
        >
          <Flame size={18} color="#791F1F" />
          <div style={{ color: "#791F1F", fontSize: 10, marginTop: 8 }}>
            PRIORIDADE A
          </div>
          <div style={{ fontSize: 29, fontWeight: 900, color: "#791F1F" }}>
            {resumo.prioridadeA ?? 0}
          </div>
        </Card>

        <Card
          style={{
            background: "#FAEEDA",
            borderColor: "#E9D3A5",
          }}
        >
          <div style={{ color: "#854F0B", fontSize: 10 }}>
            PRIORIDADE B
          </div>
          <div style={{ fontSize: 29, fontWeight: 900, color: "#854F0B" }}>
            {resumo.prioridadeB ?? 0}
          </div>
        </Card>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && carregarLeads()}
            placeholder="Buscar nome, empresa, CNPJ, telefone..."
            style={{
              flex: "1 1 280px",
              border: "1px solid #D8DEEA",
              borderRadius: 9,
              padding: "10px 12px",
              fontFamily: BODY_FONT,
            }}
          />

          <select
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
            style={{
              border: "1px solid #D8DEEA",
              borderRadius: 9,
              padding: "10px 12px",
              background: WHITE,
            }}
          >
            <option value="">Todas as origens</option>
            {origensDisponiveis.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <select
            value={statusDiagnostico}
            onChange={(e) => setStatusDiagnostico(e.target.value)}
            style={{
              border: "1px solid #D8DEEA",
              borderRadius: 9,
              padding: "10px 12px",
              background: WHITE,
            }}
          >
            <option value="">Todos os status</option>
            <option value="ACESSOU">Acessou</option>
            <option value="EM_PREENCHIMENTO">Em preenchimento</option>
            <option value="NAO_CONCLUIDO">Não concluído</option>
            <option value="CONCLUIDO">Concluído</option>
          </select>

          <select
            value={prioridadeComercial}
            onChange={(e) => setPrioridadeComercial(e.target.value)}
            style={{
              border: "1px solid #D8DEEA",
              borderRadius: 9,
              padding: "10px 12px",
              background: WHITE,
            }}
          >
            <option value="">Todas as prioridades</option>
            <option value="A">Prioridade A</option>
            <option value="B">Prioridade B</option>
            <option value="C">Prioridade C</option>
            <option value="D">Prioridade D</option>
          </select>

          <Botao onClick={carregarLeads}>
            <Search size={14} /> Filtrar
          </Botao>

          <Botao
            secundario
            onClick={() => {
              setBusca("");
              setOrigem("");
              setStatusDiagnostico("");
              setPrioridadeComercial("");
              setTimeout(carregarLeads, 0);
            }}
          >
            Limpar
          </Botao>

          <Botao secundario onClick={carregarLeads}>
            <RefreshCcw size={14} /> Atualizar
          </Botao>
        </div>
      </Card>

      {erro && (
        <div
          style={{
            background: "#FAECE7",
            color: "#993C1D",
            borderRadius: 10,
            padding: 12,
            marginBottom: 14,
          }}
        >
          {erro}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          margin: "18px 0 10px",
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 20,
              margin: 0,
            }}
          >
            Fila de atendimento
          </h2>

          <p
            style={{
              margin: "4px 0 0",
              color: MUTED,
              fontSize: 10.5,
            }}
          >
            Ordenada automaticamente por prioridade comercial e score.
          </p>
        </div>
      </div>

      {carregando ? (
        <Card>Carregando leads...</Card>
      ) : leads.length === 0 ? (
        <Card>Nenhum lead encontrado.</Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {leads.map((lead) => {
            const status = corStatus(lead.statusDiagnostico);
            const progresso = Math.max(
              0,
              Math.min(100, Number(lead.progressoPercentual) || 0)
            );

            return (
              <Card key={lead.leadId} style={{ padding: 15 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(220px,1.5fr) minmax(130px,.75fr) minmax(170px,1fr) minmax(190px,1.1fr) minmax(190px,1.05fr) minmax(150px,.8fr)",
                    gap: 14,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 13.5 }}>
                      {lead.razaoSocial || lead.nome || "Lead sem identificação"}
                    </strong>

                    <div style={{ fontSize: 10.5, color: MUTED, marginTop: 4 }}>
                      {lead.nome || "-"}
                      {lead.telefone ? ` · ${lead.telefone}` : ""}
                    </div>

                    <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>
                      {lead.origem || "direto"}
                      {lead.campanha ? ` · ${lead.campanha}` : ""}
                    </div>
                  </div>

                  <div>
                    <span
                      style={{
                        display: "inline-block",
                        background: status.bg,
                        color: status.color,
                        borderRadius: 20,
                        padding: "5px 8px",
                        fontSize: 9.5,
                        fontWeight: 800,
                      }}
                    >
                      {labelStatus(lead.statusDiagnostico)}
                    </span>

                    <div style={{ fontSize: 9.5, color: MUTED, marginTop: 6 }}>
                      {lead.etapaAtual || "-"}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        height: 8,
                        background: "#E9EDF5",
                        borderRadius: 20,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${progresso}%`,
                          height: "100%",
                          background: CORAL,
                        }}
                      />
                    </div>

                    <div style={{ fontSize: 10, color: MUTED, marginTop: 5 }}>
                      {progresso}% · última atividade {formatarData(lead.ultimaAtividade)}
                    </div>
                  </div>

                  <div>
                    {(() => {
                      const info =
                        prioridadeInfo(
                          lead.prioridadeComercial
                        );

                      return (
                        <>
                          <div
                            style={{
                              display: "inline-flex",
                              flexDirection: "column",
                              background: info.bg,
                              color: info.color,
                              borderRadius: 9,
                              padding: "6px 8px",
                              minWidth: 95,
                            }}
                          >
                            <strong style={{ fontSize: 10.5 }}>
                              {info.label}
                            </strong>

                            <span style={{ fontSize: 9, marginTop: 2 }}>
                              {info.descricao}
                            </span>
                          </div>

                          <div
                            style={{
                              fontSize: 10,
                              color: MUTED,
                              marginTop: 7,
                              lineHeight: 1.4,
                            }}
                          >
                            Score comercial:{" "}
                            <strong style={{ color: NAVY }}>
                              {lead.scoreComercial ?? 0}/100
                            </strong>
                          </div>

                          <div
                            style={{
                              fontSize: 10,
                              color: MUTED,
                              marginTop: 4,
                              lineHeight: 1.4,
                            }}
                          >
                            {textoProximaAcao(
                              lead.proximaAcao
                            )}
                            {" · "}
                            {textoPrazo(
                              lead.prazoAtendimento
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 9.5,
                        color: MUTED,
                        fontWeight: 800,
                        marginBottom: 5,
                      }}
                    >
                      RESPONSÁVEL FINDER
                    </div>

                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        color: NAVY,
                        marginBottom: 6,
                      }}
                    >
                      {nomeResponsavel(
                        lead.responsavelFinder
                      )}
                    </div>

                    <select
                      value={
                        selecoesResponsavel[
                          lead.leadId
                        ] ||
                        lead.responsavelFinder ||
                        ""
                      }
                      onChange={(e) =>
                        setSelecoesResponsavel(
                          (atual) => ({
                            ...atual,

                            [lead.leadId]:
                              e.target.value,
                          })
                        )
                      }
                      style={{
                        width: "100%",
                        border:
                          "1px solid #D8DEEA",
                        borderRadius: 8,
                        padding: "7px 8px",
                        background: WHITE,
                        fontSize: 10,
                        marginBottom: 6,
                      }}
                    >
                      <option value="">
                        Não atribuído
                      </option>

                      {responsaveis.map(
                        (responsavel) => (
                          <option
                            key={
                              responsavel.id
                            }
                            value={
                              responsavel.id
                            }
                          >
                            {responsavel.nome}
                            {" · "}
                            {
                              responsavel.leadsAbertos
                            }
                            {" abertos"}
                          </option>
                        )
                      )}
                    </select>

                    <button
                      type="button"
                      disabled={
                        atribuindoLeadId ===
                        lead.leadId
                      }
                      onClick={() =>
                        atribuirLead(
                          lead.leadId,
                          selecoesResponsavel[
                            lead.leadId
                          ] ||
                            lead.responsavelFinder
                        )
                      }
                      style={{
                        width: "100%",
                        border: 0,
                        borderRadius: 8,
                        padding: "7px 8px",
                        background: NAVY,
                        color: WHITE,
                        fontSize: 9.8,
                        fontWeight: 800,
                        cursor:
                          atribuindoLeadId ===
                          lead.leadId
                            ? "not-allowed"
                            : "pointer",
                        opacity:
                          atribuindoLeadId ===
                          lead.leadId
                            ? 0.6
                            : 1,
                      }}
                    >
                      {atribuindoLeadId ===
                      lead.leadId
                        ? "Atribuindo..."
                        : lead.responsavelFinder
                        ? "Reatribuir"
                        : "Atribuir"}
                    </button>
                  </div>

                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 10.5,
                        fontWeight: 800,
                      }}
                    >
                      <Flame size={14} color={CORAL} />
                      {temperatura(lead)}
                    </div>

                    {lead.diagnosticoId ? (
                      <button
                        type="button"
                        onClick={() => onAbrirDiagnostico(lead.diagnosticoId)}
                        style={{
                          marginTop: 7,
                          border: 0,
                          padding: 0,
                          background: "transparent",
                          color: CORAL,
                          fontSize: 10.5,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        Abrir diagnóstico →
                      </button>
                    ) : (
                      <div style={{ fontSize: 9.5, color: MUTED, marginTop: 7 }}>
                        Diagnóstico ainda não vinculado
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =========================================================
// EQUIPE / CAPACIDADE
// =========================================================

function EquipeCapacidade({
  token,
}) {
  const [
    responsaveis,
    setResponsaveis,
  ] = useState([]);

  const [
    nome,
    setNome,
  ] = useState("");

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    telefone,
    setTelefone,
  ] = useState("");

  const [
    capacidadeDiaria,
    setCapacidadeDiaria,
  ] = useState("3");

  const [
    areas,
    setAreas,
  ] = useState([]);

  const [
    perfil,
    setPerfil,
  ] = useState("ESPECIALISTA");

  const [
    permissoes,
    setPermissoes,
  ] = useState({
    verRelatorioPropriaArea: true,
    verRespostasPropriaArea: true,
    inserirObservacoes: true,
    alterarStatusAtendimento: true,
    verDiagnosticoCompleto: false,
    verEstrategiaComercial: false,
    verValoresPropostas: false,
    verOutrosDepartamentos: false,
  });

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    salvando,
    setSalvando,
  ] = useState(false);

  const [
    erro,
    setErro,
  ] = useState("");

  const [
    sucesso,
    setSucesso,
  ] = useState("");

  const areasDisponiveis = [
    "Marketing",
    "Jurídico",
    "Contábil/Fiscal",
    "Tributário",
    "Financeiro",
    "Administrativo",
    "Gestão",
    "Operacional",
    "RH",
    "Comercial",
    "Tecnologia",
  ];

  const permissoesDisponiveis = [
    {
      id: "verRelatorioPropriaArea",
      label: "Ver relatório da própria área",
    },
    {
      id: "verRespostasPropriaArea",
      label: "Ver respostas da própria área",
    },
    {
      id: "inserirObservacoes",
      label: "Inserir observações",
    },
    {
      id: "alterarStatusAtendimento",
      label: "Alterar status do atendimento",
    },
    {
      id: "verDiagnosticoCompleto",
      label: "Ver diagnóstico completo",
    },
    {
      id: "verEstrategiaComercial",
      label: "Ver estratégia comercial",
    },
    {
      id: "verValoresPropostas",
      label: "Ver valores e propostas",
    },
    {
      id: "verOutrosDepartamentos",
      label: "Ver outros departamentos",
    },
  ];

  async function carregar() {
    setCarregando(true);
    setErro("");

    try {
      const resposta =
        await fetch(
          "/api/crm?action=listar-responsaveis",
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => null);

      if (
        !resposta.ok ||
        !data?.sucesso
      ) {
        throw new Error(
          data?.error ||
          "Não foi possível carregar a equipe."
        );
      }

      setResponsaveis(
        Array.isArray(
          data.responsaveis
        )
          ? data.responsaveis
          : []
      );
    } catch (error) {
      setErro(
        error?.message ||
        "Erro ao carregar equipe."
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function alternarArea(
    area
  ) {
    setAreas(
      (atuais) =>
        atuais.includes(area)
          ? atuais.filter(
              (item) =>
                item !== area
            )
          : [
              ...atuais,
              area,
            ]
    );
  }

  async function salvar() {
    if (!nome.trim()) {
      setErro(
        "Informe o nome do responsável."
      );

      return;
    }

    setSalvando(true);
    setErro("");
    setSucesso("");

    try {
      const resposta =
        await fetch(
          "/api/crm?action=salvar-responsavel",
          {
            method: "POST",

            headers: {
              "content-type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body: JSON.stringify({
              nome:
                nome.trim(),

              email:
                email.trim(),

              telefone:
                telefone.trim(),

              areas,

              capacidadeDiaria:
                Number(
                  capacidadeDiaria
                ) || 0,

              perfil,

              permissoes,

              ativo:
                true,
            }),
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => null);

      if (
        !resposta.ok ||
        !data?.sucesso
      ) {
        throw new Error(
          data?.error ||
          "Não foi possível salvar o responsável."
        );
      }

      setNome("");
      setEmail("");
      setTelefone("");
      setCapacidadeDiaria("3");
      setAreas([]);
      setPerfil("ESPECIALISTA");
      setPermissoes({
        verRelatorioPropriaArea: true,
        verRespostasPropriaArea: true,
        inserirObservacoes: true,
        alterarStatusAtendimento: true,
        verDiagnosticoCompleto: false,
        verEstrategiaComercial: false,
        verValoresPropostas: false,
        verOutrosDepartamentos: false,
      });

      setSucesso(
        "Responsável salvo com sucesso."
      );

      await carregar();
    } catch (error) {
      setErro(
        error?.message ||
        "Erro ao salvar responsável."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(320px,.9fr) minmax(0,1.5fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        <Card>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <UserPlus
              size={18}
              color={CORAL}
            />

            <div>
              <h2
                style={{
                  margin: 0,
                  fontFamily:
                    DISPLAY_FONT,
                  fontSize: 19,
                }}
              >
                Novo responsável
              </h2>

              <div
                style={{
                  fontSize: 10.5,
                  color: MUTED,
                  marginTop: 2,
                }}
              >
                Cadastre quem poderá receber leads.
              </div>
            </div>
          </div>

          <label
            style={{
              display: "block",
              fontSize: 10.5,
              fontWeight: 800,
              marginBottom: 5,
            }}
          >
            Nome
          </label>

          <input
            value={nome}
            onChange={(e) =>
              setNome(
                e.target.value
              )
            }
            placeholder="Ex.: Diones"
            style={{
              width: "100%",
              boxSizing: "border-box",
              border:
                "1px solid #D8DEEA",
              borderRadius: 9,
              padding: "10px 11px",
              marginBottom: 10,
            }}
          />

          <label
            style={{
              display: "block",
              fontSize: 10.5,
              fontWeight: 800,
              marginBottom: 5,
            }}
          >
            E-mail
          </label>

          <input
            value={email}
            onChange={(e) =>
              setEmail(
                e.target.value
              )
            }
            placeholder="email@finder.com.br"
            style={{
              width: "100%",
              boxSizing: "border-box",
              border:
                "1px solid #D8DEEA",
              borderRadius: 9,
              padding: "10px 11px",
              marginBottom: 10,
            }}
          />

          <label
            style={{
              display: "block",
              fontSize: 10.5,
              fontWeight: 800,
              marginBottom: 5,
            }}
          >
            Telefone
          </label>

          <input
            value={telefone}
            onChange={(e) =>
              setTelefone(
                e.target.value
              )
            }
            placeholder="41999999999"
            style={{
              width: "100%",
              boxSizing: "border-box",
              border:
                "1px solid #D8DEEA",
              borderRadius: 9,
              padding: "10px 11px",
              marginBottom: 10,
            }}
          />

          <label
            style={{
              display: "block",
              fontSize: 10.5,
              fontWeight: 800,
              marginBottom: 5,
            }}
          >
            Capacidade diária
          </label>

          <input
            type="number"
            min="0"
            max="50"
            value={capacidadeDiaria}
            onChange={(e) =>
              setCapacidadeDiaria(
                e.target.value
              )
            }
            style={{
              width: "100%",
              boxSizing: "border-box",
              border:
                "1px solid #D8DEEA",
              borderRadius: 9,
              padding: "10px 11px",
              marginBottom: 12,
            }}
          />

          <label
            style={{
              display: "block",
              fontSize: 10.5,
              fontWeight: 800,
              marginBottom: 5,
            }}
          >
            Perfil
          </label>

          <select
            value={perfil}
            onChange={(e) => {
              const novoPerfil =
                e.target.value;

              setPerfil(
                novoPerfil
              );

              if (novoPerfil === "ADMIN") {
                setPermissoes({
                  verRelatorioPropriaArea: true,
                  verRespostasPropriaArea: true,
                  inserirObservacoes: true,
                  alterarStatusAtendimento: true,
                  verDiagnosticoCompleto: true,
                  verEstrategiaComercial: true,
                  verValoresPropostas: true,
                  verOutrosDepartamentos: true,
                });
              }
            }}
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid #D8DEEA",
              borderRadius: 9,
              padding: "10px 11px",
              marginBottom: 12,
              background: WHITE,
            }}
          >
            <option value="ESPECIALISTA">
              Especialista
            </option>

            <option value="ADMIN">
              Administrador
            </option>
          </select>

          <div
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              marginBottom: 7,
            }}
          >
            Áreas de atuação
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 14,
            }}
          >
            {areasDisponiveis.map(
              (area) => {
                const ativa =
                  areas.includes(
                    area
                  );

                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() =>
                      alternarArea(
                        area
                      )
                    }
                    style={{
                      border:
                        ativa
                          ? `1px solid ${CORAL}`
                          : "1px solid #D8DEEA",
                      background:
                        ativa
                          ? "#FFF3EF"
                          : WHITE,
                      color:
                        ativa
                          ? "#993C1D"
                          : NAVY,
                      borderRadius: 20,
                      padding: "6px 9px",
                      fontSize: 9.5,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {area}
                  </button>
                );
              }
            )}
          </div>

          <div
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              marginBottom: 7,
            }}
          >
            Permissões
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 6,
              marginBottom: 14,
            }}
          >
            {permissoesDisponiveis.map(
              (item) => (
                <label
                  key={item.id}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    fontSize: 10.5,
                    color: NAVY,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(
                      permissoes[item.id]
                    )}
                    onChange={(e) =>
                      setPermissoes(
                        (atuais) => ({
                          ...atuais,
                          [item.id]:
                            e.target.checked,
                        })
                      )
                    }
                  />

                  <span>
                    {item.label}
                  </span>
                </label>
              )
            )}
          </div>

          {erro && (
            <div
              style={{
                background: "#FAECE7",
                color: "#993C1D",
                borderRadius: 9,
                padding: 9,
                fontSize: 10.5,
                marginBottom: 10,
              }}
            >
              {erro}
            </div>
          )}

          {sucesso && (
            <div
              style={{
                background: "#E1F5EE",
                color: "#0F6E56",
                borderRadius: 9,
                padding: 9,
                fontSize: 10.5,
                marginBottom: 10,
              }}
            >
              {sucesso}
            </div>
          )}

          <Botao
            onClick={salvar}
            disabled={salvando}
            style={{
              width: "100%",
            }}
          >
            <Save size={14} />

            {salvando
              ? "Salvando..."
              : "Salvar responsável"}
          </Botao>
        </Card>

        <div>
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              marginBottom: 10,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontFamily:
                    DISPLAY_FONT,
                  fontSize: 20,
                }}
              >
                Equipe disponível
              </h2>

              <p
                style={{
                  margin:
                    "3px 0 0",
                  fontSize: 10.5,
                  color: MUTED,
                }}
              >
                Capacidade configurada e carga atual por responsável.
              </p>
            </div>

            <Botao
              secundario
              onClick={carregar}
            >
              <RefreshCcw
                size={14}
              />

              Atualizar
            </Botao>
          </div>

          {carregando ? (
            <Card>
              Carregando equipe...
            </Card>
          ) : responsaveis.length ===
            0 ? (
            <Card>
              Nenhum responsável cadastrado.
            </Card>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(230px,1fr))",
                gap: 10,
              }}
            >
              {responsaveis.map(
                (
                  responsavel
                ) => (
                  <Card
                    key={
                      responsavel.id
                    }
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        gap: 10,
                        marginBottom: 10,
                      }}
                    >
                      <div>
                        <strong
                          style={{
                            fontSize: 13.5,
                          }}
                        >
                          {responsavel.nome}
                        </strong>

                        <div
                          style={{
                            display: "inline-block",
                            marginTop: 5,
                            background:
                              responsavel.perfil === "ADMIN"
                                ? "#EEF3FF"
                                : "#FFF3EF",
                            color:
                              responsavel.perfil === "ADMIN"
                                ? "#31589C"
                                : "#993C1D",
                            borderRadius: 20,
                            padding: "3px 7px",
                            fontSize: 8.5,
                            fontWeight: 800,
                          }}
                        >
                          {responsavel.perfil === "ADMIN"
                            ? "ADMIN"
                            : "ESPECIALISTA"}
                        </div>

                        <div
                          style={{
                            color: MUTED,
                            fontSize: 10,
                            marginTop: 3,
                          }}
                        >
                          {responsavel.email ||
                            "-"}
                        </div>
                      </div>

                      <Gauge
                        size={19}
                        color={CORAL}
                      />
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "1fr 1fr",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          background:
                            "#F7F8FB",
                          borderRadius: 9,
                          padding: 9,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 9,
                            color: MUTED,
                          }}
                        >
                          CAPACIDADE/DIA
                        </div>

                        <strong
                          style={{
                            fontSize: 17,
                          }}
                        >
                          {
                            responsavel.capacidadeDiaria
                          }
                        </strong>
                      </div>

                      <div
                        style={{
                          background:
                            "#F7F8FB",
                          borderRadius: 9,
                          padding: 9,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 9,
                            color: MUTED,
                          }}
                        >
                          LEADS ABERTOS
                        </div>

                        <strong
                          style={{
                            fontSize: 17,
                          }}
                        >
                          {
                            responsavel.leadsAbertos
                          }
                        </strong>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 5,
                        flexWrap: "wrap",
                      }}
                    >
                      {normalizarLista(
                        responsavel.areas
                      ).map(
                        (
                          area
                        ) => (
                          <span
                            key={area}
                            style={{
                              background:
                                "#FFF3EF",
                              color:
                                "#993C1D",
                              borderRadius:
                                20,
                              padding:
                                "3px 7px",
                              fontSize:
                                9,
                            }}
                          >
                            {area}
                          </span>
                        )
                      )}
                    </div>
                  </Card>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================
// ATENDIMENTOS POR DEPARTAMENTO
// =========================================================

function AtendimentosDepartamento({
  token,
  onAbrirDiagnostico,
}) {
  const [
    atendimentos,
    setAtendimentos,
  ] = useState([]);

  const [
    responsaveis,
    setResponsaveis,
  ] = useState([]);

  const [
    leads,
    setLeads,
  ] = useState([]);

  const [
    busca,
    setBusca,
  ] = useState("");

  const [
    areaFiltro,
    setAreaFiltro,
  ] = useState("");

  const [
    statusFiltro,
    setStatusFiltro,
  ] = useState("");

  const [
    responsavelFiltro,
    setResponsavelFiltro,
  ] = useState("");

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    salvandoId,
    setSalvandoId,
  ] = useState("");

  const [
    erro,
    setErro,
  ] = useState("");

  const [
    edicoes,
    setEdicoes,
  ] = useState({});

  async function carregarTudo() {
    setCarregando(true);
    setErro("");

    try {
      const [
        respAtendimentos,
        respResponsaveis,
        respLeads,
      ] =
        await Promise.all([
          fetch(
            "/api/crm?action=listar-atendimentos",
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          ),

          fetch(
            "/api/crm?action=listar-responsaveis",
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          ),

          fetch(
            "/api/crm?action=listar-leads&limite=300",
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          ),
        ]);

      const [
        dataAtendimentos,
        dataResponsaveis,
        dataLeads,
      ] =
        await Promise.all([
          respAtendimentos
            .json()
            .catch(() => null),

          respResponsaveis
            .json()
            .catch(() => null),

          respLeads
            .json()
            .catch(() => null),
        ]);

      if (
        !respAtendimentos.ok ||
        !dataAtendimentos?.sucesso
      ) {
        throw new Error(
          dataAtendimentos?.error ||
          "Não foi possível carregar os atendimentos."
        );
      }

      if (
        !respResponsaveis.ok ||
        !dataResponsaveis?.sucesso
      ) {
        throw new Error(
          dataResponsaveis?.error ||
          "Não foi possível carregar os responsáveis."
        );
      }

      setAtendimentos(
        Array.isArray(
          dataAtendimentos.atendimentos
        )
          ? dataAtendimentos.atendimentos
          : []
      );

      setResponsaveis(
        Array.isArray(
          dataResponsaveis.responsaveis
        )
          ? dataResponsaveis.responsaveis
          : []
      );

      setLeads(
        Array.isArray(
          dataLeads?.leads
        )
          ? dataLeads.leads
          : []
      );
    } catch (error) {
      setErro(
        error?.message ||
        "Erro ao carregar atendimentos."
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarTudo();
  }, []);

  const mapaLeads = useMemo(() => {
    const mapa = {};

    leads.forEach(
      (lead) => {
        if (
          lead.diagnosticoId
        ) {
          mapa[
            String(
              lead.diagnosticoId
            )
          ] = lead;
        }

        if (lead.leadId) {
          mapa[
            String(
              lead.leadId
            )
          ] = lead;
        }
      }
    );

    return mapa;
  }, [leads]);

  const areasDisponiveis =
    useMemo(
      () =>
        [
          ...new Set(
            atendimentos
              .map(
                (item) =>
                  item.area
              )
              .filter(Boolean)
          ),
        ].sort(),
      [atendimentos]
    );

  function statusAtendimentoLabel(
    status
  ) {
    const mapa = {
      NAO_INICIADO:
        "Não iniciado",

      EM_ANALISE:
        "Em análise",

      REUNIAO_AGENDADA:
        "Reunião agendada",

      EM_ATENDIMENTO:
        "Em atendimento",

      PLANO_APRESENTADO:
        "Plano apresentado",

      CONCLUIDO:
        "Concluído",
    };

    return (
      mapa[status] ||
      status ||
      "-"
    );
  }

  function statusAtendimentoCor(
    status
  ) {
    if (
      status === "CONCLUIDO"
    ) {
      return {
        bg: "#E1F5EE",
        color: "#0F6E56",
      };
    }

    if (
      status === "EM_ATENDIMENTO" ||
      status === "EM_ANALISE"
    ) {
      return {
        bg: "#FAEEDA",
        color: "#854F0B",
      };
    }

    if (
      status === "REUNIAO_AGENDADA" ||
      status === "PLANO_APRESENTADO"
    ) {
      return {
        bg: "#EEF3FF",
        color: "#31589C",
      };
    }

    return {
      bg: "#EEF0F5",
      color: MUTED,
    };
  }

  function editar(
    id,
    campo,
    valor
  ) {
    setEdicoes(
      (atuais) => ({
        ...atuais,

        [id]: {
          ...(atuais[id] || {}),
          [campo]: valor,
        },
      })
    );
  }

  async function salvarAtendimento(
    atendimento
  ) {
    setSalvandoId(
      atendimento.id
    );

    setErro("");

    try {
      const alteracoes =
        edicoes[
          atendimento.id
        ] ||
        {};

      const resposta =
        await fetch(
          "/api/crm?action=atualizar-atendimento",
          {
            method: "POST",

            headers: {
              "content-type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body: JSON.stringify({
              atendimentoId:
                atendimento.id,

              responsavelId:
                alteracoes.responsavelId ??
                atendimento.responsavelId ??
                "",

              statusAtendimento:
                alteracoes.statusAtendimento ??
                atendimento.statusAtendimento,

              observacoesEspecialista:
                alteracoes.observacoesEspecialista ??
                atendimento.observacoesEspecialista ??
                "",
            }),
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => null);

      if (
        !resposta.ok ||
        !data?.sucesso
      ) {
        throw new Error(
          data?.error ||
          "Não foi possível atualizar o atendimento."
        );
      }

      setEdicoes(
        (atuais) => {
          const copia = {
            ...atuais,
          };

          delete copia[
            atendimento.id
          ];

          return copia;
        }
      );

      await carregarTudo();
    } catch (error) {
      setErro(
        error?.message ||
        "Erro ao atualizar atendimento."
      );
    } finally {
      setSalvandoId("");
    }
  }

  const filtrados =
    atendimentos.filter(
      (atendimento) => {
        const lead =
          mapaLeads[
            String(
              atendimento.diagnosticoId ||
              atendimento.leadId ||
              ""
            )
          ] ||
          mapaLeads[
            String(
              atendimento.leadId ||
              ""
            )
          ] ||
          {};

        const termo =
          busca
            .trim()
            .toLowerCase();

        const bateBusca =
          !termo ||
          [
            atendimento.area,
            atendimento.nivelArea,
            atendimento.responsavelNome,
            atendimento.diagnosticoId,
            atendimento.leadId,
            lead.razaoSocial,
            lead.nome,
            lead.cnpj,
            lead.telefone,
          ]
            .filter(Boolean)
            .some(
              (valor) =>
                String(valor)
                  .toLowerCase()
                  .includes(termo)
            );

        const bateArea =
          !areaFiltro ||
          atendimento.area ===
            areaFiltro;

        const bateStatus =
          !statusFiltro ||
          atendimento.statusAtendimento ===
            statusFiltro;

        const bateResponsavel =
          !responsavelFiltro ||
          atendimento.responsavelId ===
            responsavelFiltro;

        return (
          bateBusca &&
          bateArea &&
          bateStatus &&
          bateResponsavel
        );
      }
    );

  const resumo = {
    total:
      atendimentos.length,

    naoIniciado:
      atendimentos.filter(
        (item) =>
          item.statusAtendimento ===
          "NAO_INICIADO"
      ).length,

    emAndamento:
      atendimentos.filter(
        (item) =>
          [
            "EM_ANALISE",
            "REUNIAO_AGENDADA",
            "EM_ATENDIMENTO",
            "PLANO_APRESENTADO",
          ].includes(
            item.statusAtendimento
          )
      ).length,

    concluidos:
      atendimentos.filter(
        (item) =>
          item.statusAtendimento ===
          "CONCLUIDO"
      ).length,
  };

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(180px,1fr))",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <Card>
          <Target
            size={18}
            color={CORAL}
          />

          <div
            style={{
              color: MUTED,
              fontSize: 10,
              marginTop: 8,
            }}
          >
            ATENDIMENTOS
          </div>

          <div
            style={{
              fontSize: 29,
              fontWeight: 900,
            }}
          >
            {resumo.total}
          </div>
        </Card>

        <Card>
          <Clock3
            size={18}
            color={MUTED}
          />

          <div
            style={{
              color: MUTED,
              fontSize: 10,
              marginTop: 8,
            }}
          >
            NÃO INICIADOS
          </div>

          <div
            style={{
              fontSize: 29,
              fontWeight: 900,
            }}
          >
            {resumo.naoIniciado}
          </div>
        </Card>

        <Card>
          <Activity
            size={18}
            color="#854F0B"
          />

          <div
            style={{
              color: MUTED,
              fontSize: 10,
              marginTop: 8,
            }}
          >
            EM ANDAMENTO
          </div>

          <div
            style={{
              fontSize: 29,
              fontWeight: 900,
            }}
          >
            {resumo.emAndamento}
          </div>
        </Card>

        <Card>
          <CheckCircle2
            size={18}
            color="#0F6E56"
          />

          <div
            style={{
              color: MUTED,
              fontSize: 10,
              marginTop: 8,
            }}
          >
            CONCLUÍDOS
          </div>

          <div
            style={{
              fontSize: 29,
              fontWeight: 900,
            }}
          >
            {resumo.concluidos}
          </div>
        </Card>
      </div>

      <Card
        style={{
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <input
            value={busca}
            onChange={(e) =>
              setBusca(
                e.target.value
              )
            }
            placeholder="Buscar empresa, especialista, área, diagnóstico..."
            style={{
              flex: "1 1 300px",
              border:
                "1px solid #D8DEEA",
              borderRadius: 9,
              padding:
                "10px 12px",
              fontFamily:
                BODY_FONT,
            }}
          />

          <select
            value={areaFiltro}
            onChange={(e) =>
              setAreaFiltro(
                e.target.value
              )
            }
            style={{
              border:
                "1px solid #D8DEEA",
              borderRadius: 9,
              padding:
                "10px 12px",
              background: WHITE,
            }}
          >
            <option value="">
              Todas as áreas
            </option>

            {areasDisponiveis.map(
              (area) => (
                <option
                  key={area}
                  value={area}
                >
                  {area}
                </option>
              )
            )}
          </select>

          <select
            value={statusFiltro}
            onChange={(e) =>
              setStatusFiltro(
                e.target.value
              )
            }
            style={{
              border:
                "1px solid #D8DEEA",
              borderRadius: 9,
              padding:
                "10px 12px",
              background: WHITE,
            }}
          >
            <option value="">
              Todos os status
            </option>

            <option value="NAO_INICIADO">
              Não iniciado
            </option>

            <option value="EM_ANALISE">
              Em análise
            </option>

            <option value="REUNIAO_AGENDADA">
              Reunião agendada
            </option>

            <option value="EM_ATENDIMENTO">
              Em atendimento
            </option>

            <option value="PLANO_APRESENTADO">
              Plano apresentado
            </option>

            <option value="CONCLUIDO">
              Concluído
            </option>
          </select>

          <select
            value={responsavelFiltro}
            onChange={(e) =>
              setResponsavelFiltro(
                e.target.value
              )
            }
            style={{
              border:
                "1px solid #D8DEEA",
              borderRadius: 9,
              padding:
                "10px 12px",
              background: WHITE,
            }}
          >
            <option value="">
              Todos os especialistas
            </option>

            {responsaveis.map(
              (responsavel) => (
                <option
                  key={
                    responsavel.id
                  }
                  value={
                    responsavel.id
                  }
                >
                  {responsavel.nome}
                </option>
              )
            )}
          </select>

          <Botao
            secundario
            onClick={
              carregarTudo
            }
          >
            <RefreshCcw
              size={14}
            />

            Atualizar
          </Botao>
        </div>
      </Card>

      {erro && (
        <div
          style={{
            background:
              "#FAECE7",
            color:
              "#993C1D",
            borderRadius: 10,
            padding: 12,
            marginBottom: 14,
          }}
        >
          {erro}
        </div>
      )}

      {carregando ? (
        <Card>
          Carregando atendimentos...
        </Card>
      ) : filtrados.length === 0 ? (
        <Card>
          Nenhum atendimento encontrado.
        </Card>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {filtrados.map(
            (atendimento) => {
              const lead =
                mapaLeads[
                  String(
                    atendimento.diagnosticoId ||
                    atendimento.leadId ||
                    ""
                  )
                ] ||
                mapaLeads[
                  String(
                    atendimento.leadId ||
                    ""
                  )
                ] ||
                {};

              const infoScore =
                scoreInfo(
                  atendimento.scoreArea
                );

              const infoStatus =
                statusAtendimentoCor(
                  atendimento.statusAtendimento
                );

              const edicao =
                edicoes[
                  atendimento.id
                ] ||
                {};

              const responsaveisCompativeis =
                responsaveis.filter(
                  (responsavel) =>
                    responsavelCompativelComArea(
                      responsavel,
                      atendimento.area
                    )
                );

              return (
                <Card
                  key={
                    atendimento.id
                  }
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(220px,1.3fr) 120px minmax(180px,.9fr) minmax(220px,1fr)",
                      gap: 14,
                      alignItems: "start",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: CORAL,
                          fontSize: 9.5,
                          fontWeight: 900,
                          letterSpacing: 0.5,
                          marginBottom: 4,
                        }}
                      >
                        {
                          atendimento.area
                        }
                      </div>

                      <strong
                        style={{
                          fontSize: 14,
                        }}
                      >
                        {lead.razaoSocial ||
                          lead.nome ||
                          `Diagnóstico ${atendimento.diagnosticoId}`}
                      </strong>

                      <div
                        style={{
                          color: MUTED,
                          fontSize: 10.5,
                          marginTop: 4,
                          lineHeight: 1.5,
                        }}
                      >
                        {lead.cnpj
                          ? formatarCnpj(
                              lead.cnpj
                            )
                          : ""}

                        {lead.nome
                          ? ` · ${lead.nome}`
                          : ""}

                        {lead.telefone
                          ? ` · ${lead.telefone}`
                          : ""}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          flexWrap: "wrap",
                          marginTop: 8,
                        }}
                      >
                        <span
                          style={{
                            background:
                              infoStatus.bg,
                            color:
                              infoStatus.color,
                            borderRadius: 20,
                            padding:
                              "4px 8px",
                            fontSize: 9,
                            fontWeight: 800,
                          }}
                        >
                          {statusAtendimentoLabel(
                            atendimento.statusAtendimento
                          )}
                        </span>

                        {atendimento.nivelArea && (
                          <span
                            style={{
                              background:
                                infoScore.bg,
                              color:
                                infoScore.color,
                              borderRadius:
                                20,
                              padding:
                                "4px 8px",
                              fontSize: 9,
                              fontWeight: 800,
                            }}
                          >
                            {
                              atendimento.nivelArea
                            }
                          </span>
                        )}
                      </div>

                      {atendimento.diagnosticoId && (
                        <button
                          type="button"
                          onClick={() =>
                            onAbrirDiagnostico(
                              atendimento.diagnosticoId
                            )
                          }
                          style={{
                            marginTop: 10,
                            background:
                              "transparent",
                            border: 0,
                            color: CORAL,
                            fontSize: 10.5,
                            fontWeight: 800,
                            padding: 0,
                            cursor: "pointer",
                          }}
                        >
                          Abrir diagnóstico completo →
                        </button>
                      )}
                    </div>

                    <div
                      style={{
                        textAlign: "center",
                        background:
                          infoScore.bg,
                        color:
                          infoScore.color,
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 900,
                        }}
                      >
                        {atendimento.scoreArea ??
                          "-"}
                      </div>

                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          marginTop: 2,
                        }}
                      >
                        SCORE DA ÁREA
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 9.5,
                          color: MUTED,
                          fontWeight: 800,
                          marginBottom: 5,
                        }}
                      >
                        ESPECIALISTA
                      </div>

                      <select
                        value={
                          edicao.responsavelId ??
                          atendimento.responsavelId ??
                          ""
                        }
                        onChange={(e) =>
                          editar(
                            atendimento.id,
                            "responsavelId",
                            e.target.value
                          )
                        }
                        style={{
                          width: "100%",
                          border:
                            "1px solid #D8DEEA",
                          borderRadius: 8,
                          padding:
                            "8px 9px",
                          background: WHITE,
                          fontSize: 10.5,
                          marginBottom: 8,
                        }}
                      >
                        <option value="">
                          Não atribuído
                        </option>

                        {responsaveisCompativeis.map(
                          (responsavel) => (
                            <option
                              key={
                                responsavel.id
                              }
                              value={
                                responsavel.id
                              }
                            >
                              {
                                responsavel.nome
                              }
                              {" · "}
                              {
                                responsavel.leadsAbertos
                              }
                              {" abertos"}
                            </option>
                          )
                        )}
                      </select>

                      {responsaveisCompativeis.length === 0 && (
                        <div
                          style={{
                            fontSize: 9.5,
                            color: "#993C1D",
                            lineHeight: 1.4,
                          }}
                        >
                          Nenhum integrante da equipe está cadastrado para esta área.
                        </div>
                      )}

                      <div
                        style={{
                          fontSize: 9.5,
                          color: MUTED,
                          fontWeight: 800,
                          margin:
                            "10px 0 5px",
                        }}
                      >
                        STATUS DO ATENDIMENTO
                      </div>

                      <select
                        value={
                          edicao.statusAtendimento ??
                          atendimento.statusAtendimento ??
                          "NAO_INICIADO"
                        }
                        onChange={(e) =>
                          editar(
                            atendimento.id,
                            "statusAtendimento",
                            e.target.value
                          )
                        }
                        style={{
                          width: "100%",
                          border:
                            "1px solid #D8DEEA",
                          borderRadius: 8,
                          padding:
                            "8px 9px",
                          background: WHITE,
                          fontSize: 10.5,
                        }}
                      >
                        <option value="NAO_INICIADO">
                          Não iniciado
                        </option>

                        <option value="EM_ANALISE">
                          Em análise
                        </option>

                        <option value="REUNIAO_AGENDADA">
                          Reunião agendada
                        </option>

                        <option value="EM_ATENDIMENTO">
                          Em atendimento
                        </option>

                        <option value="PLANO_APRESENTADO">
                          Plano apresentado
                        </option>

                        <option value="CONCLUIDO">
                          Concluído
                        </option>
                      </select>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 9.5,
                          color: MUTED,
                          fontWeight: 800,
                          marginBottom: 5,
                        }}
                      >
                        OBSERVAÇÕES DO ESPECIALISTA
                      </div>

                      <textarea
                        value={
                          edicao.observacoesEspecialista ??
                          atendimento.observacoesEspecialista ??
                          ""
                        }
                        onChange={(e) =>
                          editar(
                            atendimento.id,
                            "observacoesEspecialista",
                            e.target.value
                          )
                        }
                        rows={4}
                        placeholder="Registre validações, observações da reunião e próximos passos..."
                        style={{
                          width: "100%",
                          boxSizing:
                            "border-box",
                          border:
                            "1px solid #D8DEEA",
                          borderRadius: 8,
                          padding:
                            "9px 10px",
                          fontFamily:
                            BODY_FONT,
                          fontSize: 10.5,
                          resize: "vertical",
                        }}
                      />

                      <Botao
                        onClick={() =>
                          salvarAtendimento(
                            atendimento
                          )
                        }
                        disabled={
                          salvandoId ===
                          atendimento.id
                        }
                        style={{
                          width: "100%",
                          marginTop: 8,
                        }}
                      >
                        <Save
                          size={13}
                        />

                        {salvandoId ===
                        atendimento.id
                          ? "Salvando..."
                          : "Salvar atendimento"}
                      </Botao>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit,minmax(220px,1fr))",
                      gap: 10,
                      marginTop: 14,
                    }}
                  >
                    <ListaInterna
                      titulo="Oportunidades"
                      itens={
                        atendimento.oportunidades
                      }
                    />

                    <ListaInterna
                      titulo="Riscos"
                      itens={
                        atendimento.riscos
                      }
                    />

                    <ListaInterna
                      titulo="Recomendações"
                      itens={
                        atendimento.recomendacoes
                      }
                    />

                    <ListaInterna
                      titulo="Plano de ação"
                      itens={
                        atendimento.planoAcao
                      }
                    />
                  </div>

                  {atendimento.orientacaoTecnica && (
                    <div
                      style={{
                        marginTop: 10,
                        background:
                          "#EEF3FF",
                        borderLeft:
                          "4px solid #31589C",
                        borderRadius: 10,
                        padding: 12,
                      }}
                    >
                      <strong
                        style={{
                          display: "block",
                          fontSize: 10.5,
                          marginBottom: 5,
                          color: "#31589C",
                        }}
                      >
                        ORIENTAÇÃO TÉCNICA PARA O ESPECIALISTA
                      </strong>

                      <div
                        style={{
                          fontSize: 11.5,
                          lineHeight: 1.55,
                        }}
                      >
                        {
                          atendimento.orientacaoTecnica
                        }
                      </div>
                    </div>
                  )}
                </Card>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}

// =========================================================
// DETALHE DO DIAGNÓSTICO
// =========================================================

function DetalheDiagnostico({
  token,
  id,
  onVoltar,
}) {
  const [
    item,
    setItem,
  ] = useState(null);

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    erro,
    setErro,
  ] = useState("");

  const [
    abaRelatorio,
    setAbaRelatorio,
  ] = useState("administracao");

  const [
    atendimentosEquipe,
    setAtendimentosEquipe,
  ] = useState([]);

  const [
    areaEquipe,
    setAreaEquipe,
  ] = useState("");

  const [
    carregandoEquipe,
    setCarregandoEquipe,
  ] = useState(false);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      setErro("");

      try {
        const resposta =
          await fetch(
            `/api/ver-diagnostico?id=${encodeURIComponent(
              id
            )}`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await resposta
            .json()
            .catch(() => null);

        if (
          !resposta.ok ||
          !data?.sucesso
        ) {
          throw new Error(
            data?.error ||
            "Não foi possível abrir o diagnóstico."
          );
        }

        setItem(
          data.diagnostico
        );

      } catch (error) {
        setErro(
          error?.message ||
          "Erro ao abrir diagnóstico."
        );

      } finally {
        setCarregando(false);
      }
    }

    carregar();
  }, [id, token]);

  useEffect(() => {
    async function carregarAtendimentosEquipe() {
      if (
        abaRelatorio !== "equipe" ||
        !id
      ) {
        return;
      }

      setCarregandoEquipe(true);

      try {
        const resposta =
          await fetch(
            `/api/crm?action=listar-atendimentos&diagnosticoId=${encodeURIComponent(
              id
            )}`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await resposta
            .json()
            .catch(() => null);

        if (
          !resposta.ok ||
          !data?.sucesso
        ) {
          throw new Error(
            data?.error ||
            "Não foi possível carregar os atendimentos da equipe."
          );
        }

        const lista =
          Array.isArray(
            data.atendimentos
          )
            ? data.atendimentos
            : [];

        setAtendimentosEquipe(
          lista
        );

        if (
          !areaEquipe &&
          lista.length
        ) {
          setAreaEquipe(
            lista[0].area ||
            ""
          );
        }
      } catch (error) {
        console.warn(
          "[Admin] Erro ao carregar relatório da equipe:",
          error
        );
      } finally {
        setCarregandoEquipe(false);
      }
    }

    carregarAtendimentosEquipe();
  }, [
    abaRelatorio,
    id,
    token,
  ]);

  if (carregando) {
    return (
      <div
        style={{
          padding: 30,
          fontFamily:
            BODY_FONT,
        }}
      >
        Carregando diagnóstico...
      </div>
    );
  }

  if (
    erro ||
    !item
  ) {
    return (
      <div
        style={{
          minHeight:
            "100vh",

          background:
            BG,

          padding:
            24,

          fontFamily:
            BODY_FONT,
        }}
      >
        <Botao
          secundario
          onClick={
            onVoltar
          }
        >
          <ArrowLeft
            size={15}
          />

          Voltar
        </Botao>

        <div
          style={{
            marginTop:
              16,

            background:
              "#FAECE7",

            color:
              "#993C1D",

            padding:
              15,

            borderRadius:
              10,
          }}
        >
          {erro ||
            "Diagnóstico não encontrado."}
        </div>
      </div>
    );
  }

  const participante =
    item.participante ||
    {};

  const empresa =
    item.empresa ||
    {};

  const resultado =
    item.resultado ||
    {};

  const diagnosticoGeral =
    resultado.diagnosticoGeral ||
    {};

  // =====================================================
  // DOSSIÊ CONSULTIVO FINDER
  // =====================================================

  const plano90Dias =
    resultado.plano90Dias ||
    null;

  const quickWins =
    resultado.quickWins ||
    [];

  const kpisRecomendados =
    resultado.kpisRecomendados ||
    [];

  const perguntasAprofundamento =
    resultado.perguntasAprofundamento ||
    [];

  const visaoConsultor =
    resultado.visaoConsultor ||
    null;

  const visaoComercial =
    resultado.visaoComercial ||
    null;

  const lacunasDiagnostico =
    resultado.lacunasDiagnostico ||
    [];

  const oportunidadesConsultoria =
    resultado.oportunidadesConsultoria ||
    [];

  // COMPLEMENTO — inteligência tributária
  const inteligenciaTributaria =
    resultado.inteligenciaTributaria ||
    null;

  const perguntas =
    normalizarLista(
      item.perguntasRespostas
    );

  const areas =
    normalizarLista(
      resultado.areas
    ).length
      ? normalizarLista(
          resultado.areas
        )
      : normalizarLista(
          item.areas
        );

  const dores =
    normalizarLista(
      item.dores
    );

  const score =
    scoreInfo(
      item.score
    );

  const estruturaAtual =
    estruturaDiagnostico(
      item
    );

  const estruturaAtualLabel =
    labelEstruturaDiagnostico(
      estruturaAtual
    );

  const estruturaAtualCor =
    corEstruturaDiagnostico(
      estruturaAtual
    );

  const areasEquipeDisponiveis =
    [
      ...new Set(
        atendimentosEquipe
          .map(
            (atendimento) =>
              atendimento.area
          )
          .filter(Boolean)
      ),
    ];

  const atendimentoEquipeSelecionado =
    atendimentosEquipe.find(
      (atendimento) =>
        atendimento.area ===
        areaEquipe
    ) ||
    atendimentosEquipe[0] ||
    null;

  const perguntasEquipe =
    perguntas.filter(
      (pergunta) =>
        areaCanonica(
          pergunta.area
        ) ===
        areaCanonica(
          atendimentoEquipeSelecionado?.area
        )
    );

  const areaClientePorNome =
    areas.reduce(
      (acc, area) => {
        if (area?.area) {
          acc[
            area.area
          ] = area;
        }

        return acc;
      },
      {}
    );

  return (
    <div
      style={{
        minHeight:
          "100vh",

        background:
          BG,

        fontFamily:
          BODY_FONT,

        color:
          NAVY,
      }}
    >
      <header
        style={{
          background:
            NAVY,

          padding:
            "17px 24px",

          color:
            WHITE,
        }}
      >
        <div
          style={{
            maxWidth:
              1180,

            margin:
              "0 auto",

            display:
              "flex",

            justifyContent:
              "space-between",

            alignItems:
              "center",

            gap:
              15,
          }}
        >
          <Botao
            secundario
            onClick={
              onVoltar
            }
          >
            <ArrowLeft
              size={15}
            />

            Diagnósticos
          </Botao>

          <span
            style={{
              fontSize:
                11,

              opacity:
                0.75,
            }}
          >
            {formatarData(
              item.criadoEm
            )}
          </span>
        </div>
      </header>

      <main
        style={{
          maxWidth:
            1180,

          margin:
            "0 auto",

          padding:
            "24px 20px 60px",
        }}
      >
        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "minmax(0,1fr) 170px",

            gap:
              14,

            marginBottom:
              16,
          }}
        >
          <Card>
            <div
              style={{
                fontSize:
                  11,

                color:
                  CORAL,

                fontWeight:
                  800,

                marginBottom:
                  6,
              }}
            >
              {estruturaAtual === "pessoa_fisica"
                ? "DIAGNÓSTICO FINANCEIRO PESSOAL"
                : estruturaAtual === "holding" ||
                  estruturaAtual === "avaliar_holding"
                ? "DIAGNÓSTICO PATRIMONIAL / HOLDING"
                : "DIAGNÓSTICO EMPRESARIAL"}
            </div>

            <h1
              style={{
                fontFamily:
                  DISPLAY_FONT,

                fontSize:
                  28,

                margin:
                  "0 0 7px",
              }}
            >
              {estruturaAtual === "pessoa_fisica"
                ? participante.nome ||
                  "Pessoa Física"
                : estruturaAtual === "avaliar_holding"
                ? "Avaliação de Holding"
                : empresa.razaoSocial ||
                  "Empresa"}
            </h1>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                background:
                  estruturaAtualCor.bg,
                color:
                  estruturaAtualCor.color,
                borderRadius: 20,
                padding:
                  "4px 8px",
                fontSize: 9.5,
                fontWeight: 900,
                marginBottom: 8,
              }}
            >
              ESTRUTURA ·{" "}
              {estruturaAtualLabel}
            </div>

            <div
              style={{
                color:
                  MUTED,

                fontSize:
                  12,

                lineHeight:
                  1.6,
              }}
            >
              {empresa.cnpj
                ? formatarCnpj(
                    empresa.cnpj
                  )
                : ""}

              {empresa.segmento
                ? `${empresa.cnpj ? " · " : ""}${empresa.segmento}`
                : ""}

              {empresa.subsegmento
                ? ` · ${empresa.subsegmento}`
                : ""}
            </div>
          </Card>

          <Card
            style={{
              background:
                score.bg,

              textAlign:
                "center",
            }}
          >
            <div
              style={{
                fontSize:
                  38,

                fontWeight:
                  900,

                color:
                  score.color,
              }}
            >
              {item.score ??
                "-"}
            </div>

            <div
              style={{
                fontSize:
                  11,

                color:
                  score.color,

                fontWeight:
                  700,
              }}
            >
              {score.label}
            </div>
          </Card>
        </div>

        <Card
          style={{
            padding: 10,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <Botao
              secundario={
                abaRelatorio !==
                "administracao"
              }
              onClick={() =>
                setAbaRelatorio(
                  "administracao"
                )
              }
            >
              <Building2 size={14} />
              Relatório Administração
            </Botao>

            <Botao
              secundario={
                abaRelatorio !==
                "cliente"
              }
              onClick={() =>
                setAbaRelatorio(
                  "cliente"
                )
              }
            >
              <Users size={14} />
              Relatório Cliente
            </Botao>

            <Botao
              secundario={
                abaRelatorio !==
                "equipe"
              }
              onClick={() =>
                setAbaRelatorio(
                  "equipe"
                )
              }
            >
              <Users size={14} />
              Relatório Equipe
            </Botao>
          </div>
        </Card>

        {abaRelatorio === "administracao" && (
          <>
        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(auto-fit,minmax(230px,1fr))",

            gap:
              12,

            marginBottom:
              18,
          }}
        >
          <Card>
            <Users
              size={18}
              color={CORAL}
            />

            <h3>
              Participante
            </h3>

            <p>
              <strong>
                {participante.nome ||
                  "-"}
              </strong>

              <br />

              {participante.cargo ||
                "-"}

              <br />

              {participante.email ||
                "-"}

              <br />

              {participante.telefone ||
                "-"}
            </p>
          </Card>

          <Card>
            <Target
              size={18}
              color={CORAL}
            />

            <h3>
              Estrutura
            </h3>

            <p>
              <strong>
                {estruturaAtualLabel}
              </strong>
            </p>
          </Card>

          <Card>
            <Building2
              size={18}
              color={CORAL}
            />

            <h3>
              {estruturaAtual ===
              "pessoa_fisica"
                ? "Contexto"
                : estruturaAtual ===
                    "holding" ||
                  estruturaAtual ===
                    "avaliar_holding"
                ? "Estrutura patrimonial"
                : "Negócio"}
            </h3>

            <p>
              {empresa.descricaoNegocio ||
                "Descrição não registrada."}
            </p>
          </Card>

          <Card>
            <Target
              size={18}
              color={CORAL}
            />

            <h3>
              Dores declaradas
            </h3>

            {dores.length ? (
              <ul
                style={{
                  paddingLeft:
                    18,

                  marginBottom:
                    0,
                }}
              >
                {dores.map(
                  (
                    dor,
                    index
                  ) => (
                    <li
                      key={`${dor}-${index}`}
                    >
                      {dor}
                    </li>
                  )
                )}
              </ul>
            ) : (
              <p>
                Nenhuma dor registrada.
              </p>
            )}
          </Card>
        </div>

        {diagnosticoGeral
          .resumoExecutivo && (
          <>
            <h2
              style={
                tituloSecao
              }
            >
              Resumo executivo
            </h2>

            <Card>
              <p
                style={{
                  margin:
                    0,

                  lineHeight:
                    1.65,
                }}
              >
                {
                  diagnosticoGeral
                    .resumoExecutivo
                }
              </p>
            </Card>
          </>
        )}

        {diagnosticoGeral
          .alertaEstrategico && (
          <>
            <h2
              style={
                tituloSecao
              }
            >
              Alerta estratégico
            </h2>

            <Card
              style={{
                background:
                  "#FAEEDA",

                color:
                  "#70410A",
              }}
            >
              {
                diagnosticoGeral
                  .alertaEstrategico
              }
            </Card>
          </>
        )}

        {inteligenciaTributaria?.disponivel && (
          <>
            <h2 style={tituloSecao}>
              Inteligência tributária
            </h2>

            <Card
              style={{
                border: "1px solid #D8DEEA",
                background: "#FBFCFE",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(180px,1fr))",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    background: WHITE,
                    border: "1px solid #E3E7EF",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: MUTED,
                      marginBottom: 4,
                    }}
                  >
                    FATURAMENTO DE REFERÊNCIA
                  </div>

                  <strong
                    style={{
                      fontSize: 18,
                    }}
                  >
                    {Number(
                      inteligenciaTributaria
                        .faturamentoMensalReferencia
                    ).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                      maximumFractionDigits: 0,
                    })}
                  </strong>

                  <div
                    style={{
                      fontSize: 10,
                      color: MUTED,
                      marginTop: 3,
                    }}
                  >
                    por mês
                  </div>
                </div>

                <div
                  style={{
                    background: WHITE,
                    border: "1px solid #E3E7EF",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: MUTED,
                      marginBottom: 4,
                    }}
                  >
                    TRIBUTOS ESTIMADOS
                  </div>

                  <strong
                    style={{
                      fontSize: 18,
                    }}
                  >
                    {Number(
                      inteligenciaTributaria
                        .tributosMensaisEstimados
                    ).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                      maximumFractionDigits: 0,
                    })}
                  </strong>

                  <div
                    style={{
                      fontSize: 10,
                      color: MUTED,
                      marginTop: 3,
                    }}
                  >
                    por mês
                  </div>
                </div>

                <div
                  style={{
                    background: "#FFF3EF",
                    border: "1px solid #F0C8BD",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#993C1D",
                      marginBottom: 4,
                    }}
                  >
                    CARGA TRIBUTÁRIA ESTIMADA
                  </div>

                  <strong
                    style={{
                      fontSize: 25,
                      color: "#993C1D",
                    }}
                  >
                    {Number(
                      inteligenciaTributaria
                        .cargaTributariaEstimada
                    ).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    %
                  </strong>
                </div>

                <div
                  style={{
                    background: WHITE,
                    border: "1px solid #E3E7EF",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: MUTED,
                      marginBottom: 4,
                    }}
                  >
                    PROJEÇÃO ANUAL DE TRIBUTOS
                  </div>

                  <strong
                    style={{
                      fontSize: 18,
                    }}
                  >
                    {Number(
                      inteligenciaTributaria
                        .tributosAnuaisEstimados
                    ).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                      maximumFractionDigits: 0,
                    })}
                  </strong>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(230px,1fr))",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <ListaInterna
                  titulo="Base da estimativa"
                  itens={[
                    `Regime informado: ${
                      inteligenciaTributaria.regime || "-"
                    }`,
                    `Segmento: ${
                      inteligenciaTributaria.segmento || "-"
                    }`,
                    `Categoria: ${
                      inteligenciaTributaria.categoria || "-"
                    }`,
                    `Faixa de faturamento: ${
                      inteligenciaTributaria.faturamentoFaixa || "-"
                    }`,
                    `Confiabilidade: ${
                      inteligenciaTributaria.confiabilidade ||
                      "Referencial"
                    }`,
                  ]}
                />

                <ListaInterna
                  titulo="Critério"
                  itens={[
                    inteligenciaTributaria.criterio ||
                      "Estimativa gerencial.",
                  ]}
                />
              </div>

              <div
                style={{
                  background: "#17233D",
                  color: WHITE,
                  borderRadius: 12,
                  padding: 15,
                  marginTop: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "#FFB7A7",
                    fontWeight: 900,
                    letterSpacing: 0.7,
                    marginBottom: 4,
                  }}
                >
                  REFORMA TRIBUTÁRIA · IMPACTO SETORIAL
                </div>

                <div
                  style={{
                    fontSize: 19,
                    fontWeight: 800,
                    marginBottom: 8,
                  }}
                >
                  {inteligenciaTributaria.reforma?.status ||
                    "A avaliar"}
                </div>

                <p
                  style={{
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: "#E4E9F2",
                    margin: "0 0 10px",
                  }}
                >
                  {inteligenciaTributaria.reforma
                    ?.tratamentoSetorial ||
                    "Tratamento setorial não classificado."}
                </p>

                <p
                  style={{
                    fontSize: 11.5,
                    lineHeight: 1.55,
                    color: "#CDD4E0",
                    margin: 0,
                  }}
                >
                  <strong>Fase 2026:</strong>{" "}
                  {inteligenciaTributaria.reforma
                    ?.fase2026 || "-"}
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(220px,1fr))",
                  gap: 10,
                  marginTop: 12,
                }}
              >
                <ListaInterna
                  titulo="Fatores favoráveis"
                  itens={
                    inteligenciaTributaria.reforma
                      ?.fatoresFavoraveis
                  }
                />

                <ListaInterna
                  titulo="Fatores de atenção"
                  itens={
                    inteligenciaTributaria.reforma
                      ?.fatoresAtencao
                  }
                />

                <ListaInterna
                  titulo="O que validar antes da conclusão"
                  itens={
                    inteligenciaTributaria.reforma
                      ?.pontosValidar
                  }
                />
              </div>

              <div
                style={{
                  marginTop: 12,
                  background: "#FFF3EF",
                  borderLeft: `4px solid ${CORAL}`,
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <strong
                  style={{
                    display: "block",
                    fontSize: 11,
                    color: "#993C1D",
                    marginBottom: 5,
                  }}
                >
                  OPORTUNIDADE CONSULTIVA FINDER
                </strong>

                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.55,
                  }}
                >
                  {inteligenciaTributaria.reforma
                    ?.oportunidadeFinder ||
                    "Avaliar necessidade de planejamento tributário individualizado."}
                </div>
              </div>

              <p
                style={{
                  fontSize: 10,
                  color: MUTED,
                  lineHeight: 1.45,
                  margin: "12px 0 0",
                  fontStyle: "italic",
                }}
              >
                A carga apresentada é estimativa gerencial e não corresponde
                à apuração fiscal definitiva. O impacto da Reforma Tributária
                deve ser validado com faturamento real, composição das
                receitas, créditos, custos, perfil de clientes e enquadramento
                legal das operações.
              </p>
            </Card>
          </>
        )}

        <h2
          style={
            tituloSecao
          }
        >
          Diagnóstico por área
        </h2>

        {areas.length ===
        0 ? (
          <Card>
            Nenhuma análise por área registrada.
          </Card>
        ) : (
          <div
            style={{
              display:
                "flex",

              flexDirection:
                "column",

              gap:
                12,
            }}
          >
            {areas.map(
              (
                area,
                index
              ) => {
                const info =
                  scoreInfo(
                    area.score
                  );

                return (
                  <Card
                    key={
                      index
                    }
                  >
                    <div
                      style={{
                        display:
                          "flex",

                        justifyContent:
                          "space-between",

                        gap:
                          15,

                        marginBottom:
                          10,
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            margin:
                              "0 0 4px",
                          }}
                        >
                          {area.area ||
                            "Área"}
                        </h3>

                        <div
                          style={{
                            fontSize:
                              10,

                            color:
                              MUTED,
                          }}
                        >
                          {info.label}
                        </div>
                      </div>

                      <div
                        style={{
                          background:
                            info.bg,

                          color:
                            info.color,

                          padding:
                            "7px 10px",

                          borderRadius:
                            10,

                          fontWeight:
                            800,
                        }}
                      >
                        {area.score ??
                          "-"}
                      </div>
                    </div>

                    {area.resumo && (
                      <p
                        style={{
                          lineHeight:
                            1.55,
                        }}
                      >
                        {area.resumo}
                      </p>
                    )}

                    <div
                      style={{
                        display:
                          "grid",

                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(210px,1fr))",

                        gap:
                          10,
                      }}
                    >
                      <ListaInterna
                        titulo="Achados"
                        itens={
                          area.achados
                        }
                      />

                      <ListaInterna
                        titulo="Causas prováveis"
                        itens={
                          area.causasProvaveis
                        }
                      />

                      <ListaInterna
                        titulo="Riscos"
                        itens={
                          area.riscos
                        }
                      />

                      <ListaInterna
                        titulo="Recomendações"
                        itens={
                          area.recomendacoes
                        }
                      />
                    </div>
                  </Card>
                );
              }
            )}
          </div>
        )}

        {/* ================================================= */}
        {/* DOSSIÊ CONSULTIVO FINDER - SOMENTE ADMIN */}
        {/* ================================================= */}

        <div
          style={{
            marginTop: 34,
            paddingTop: 8,
            borderTop: "3px solid #17233D",
          }}
        >
          <div
            style={{
              color: CORAL,
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 0.8,
              marginTop: 18,
            }}
          >
            USO INTERNO · FINDER OF SOLUTIONS
          </div>

          <h2
            style={{
              ...tituloSecao,
              fontSize: 25,
              marginTop: 6,
              marginBottom: 5,
            }}
          >
            Dossiê consultivo
          </h2>

          <p
            style={{
              margin: "0 0 18px",
              color: MUTED,
              fontSize: 12,
              lineHeight: 1.55,
            }}
          >
            Camada interna para condução da reunião, validação das hipóteses,
            priorização da execução e definição da oportunidade comercial.
          </p>
        </div>

        <BlocoDossie titulo="Plano de ação — 90 dias" destaque>
          <Plano90Dias plano={plano90Dias} />
        </BlocoDossie>

        <BlocoDossie titulo="Quick wins">
          <ListaDossie itens={quickWins} vazio="Nenhum quick win gerado." />
        </BlocoDossie>

        <BlocoDossie titulo="KPIs recomendados">
          <ListaDossie itens={kpisRecomendados} vazio="Nenhum KPI recomendado." />
        </BlocoDossie>

        <BlocoDossie titulo="Visão do consultor" destaque>
          <ListaDossie itens={visaoConsultor} vazio="Visão do consultor não gerada." />
        </BlocoDossie>

        <BlocoDossie titulo="Perguntas para aprofundamento">
          <ListaDossie
            itens={perguntasAprofundamento}
            vazio="Nenhuma pergunta de aprofundamento gerada."
          />
        </BlocoDossie>

        <BlocoDossie titulo="Visão comercial Finder">
          <ListaDossie itens={visaoComercial} vazio="Visão comercial não gerada." />
        </BlocoDossie>

        {listaFlexivel(lacunasDiagnostico).length > 0 && (
          <BlocoDossie titulo="Lacunas do diagnóstico">
            <ListaDossie itens={lacunasDiagnostico} />
          </BlocoDossie>
        )}

        {listaFlexivel(oportunidadesConsultoria).length > 0 && (
          <BlocoDossie titulo="Oportunidades de consultoria">
            <ListaDossie itens={oportunidadesConsultoria} />
          </BlocoDossie>
        )}

        <h2
          style={
            tituloSecao
          }
        >
          Perguntas e respostas
        </h2>

        <Card
          style={{
            padding:
              0,

            overflowX:
              "auto",
          }}
        >
          <table
            style={{
              width:
                "100%",

              borderCollapse:
                "collapse",

              minWidth:
                820,
            }}
          >
            <thead>
              <tr>
                <th
                  style={
                    thStyle
                  }
                >
                  Área
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Tema
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Pergunta
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Resposta
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Peso
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Importância
                </th>
              </tr>
            </thead>

            <tbody>
              {perguntas.length ? (
                perguntas.map(
                  (
                    pergunta,
                    index
                  ) => (
                    <tr
                      key={
                        index
                      }
                    >
                      <td
                        style={
                          tdStyle
                        }
                      >
                        {pergunta.area ||
                          "-"}
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {pergunta.tema ||
                          "-"}
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {pergunta.pergunta ||
                          "-"}
                      </td>

                      <td
                        style={{
                          ...tdStyle,

                          fontWeight:
                            800,
                        }}
                      >
                        {pergunta.resposta ||
                          "-"}
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {pergunta.peso ??
                          "-"}
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {pergunta.importancia ??
                          "-"}
                      </td>
                    </tr>
                  )
                )
              ) : (
                <tr>
                  <td
                    colSpan="6"
                    style={{
                      ...tdStyle,

                      textAlign:
                        "center",
                    }}
                  >
                    Nenhuma pergunta armazenada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
          </>
        )}

        {abaRelatorio === "cliente" && (
          <div>
            <div
              style={{
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: CORAL,
                  fontWeight: 900,
                  letterSpacing: 0.7,
                  marginBottom: 5,
                }}
              >
                RELATÓRIO CONSULTIVO
              </div>

              <h2
                style={{
                  ...tituloSecao,
                  marginTop: 0,
                  fontSize: 24,
                }}
              >
                Visão completa para apresentação ao cliente
              </h2>

              <p
                style={{
                  margin: "0 0 12px",
                  color: MUTED,
                  fontSize: 12,
                  lineHeight: 1.55,
                }}
              >
                Esta visão apresenta o diagnóstico técnico e consultivo,
                sem informações comerciais ou estratégicas internas da Finder.
              </p>
            </div>

            {diagnosticoGeral
              .resumoExecutivo && (
              <BlocoDossie titulo="Visão executiva" destaque>
                <p
                  style={{
                    margin: 0,
                    lineHeight: 1.65,
                    fontSize: 12.5,
                  }}
                >
                  {
                    diagnosticoGeral
                      .resumoExecutivo
                  }
                </p>
              </BlocoDossie>
            )}

            {diagnosticoGeral
              .alertaEstrategico && (
              <BlocoDossie titulo="Ponto de atenção estratégico">
                <p
                  style={{
                    margin: 0,
                    lineHeight: 1.6,
                    fontSize: 12.5,
                  }}
                >
                  {
                    diagnosticoGeral
                      .alertaEstrategico
                  }
                </p>
              </BlocoDossie>
            )}

            <h2
              style={
                tituloSecao
              }
            >
              Análise por departamento
            </h2>

            {areas.length === 0 ? (
              <Card>
                Nenhuma análise por área registrada.
              </Card>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection:
                    "column",
                  gap: 12,
                }}
              >
                {areas.map(
                  (
                    area,
                    index
                  ) => {
                    const info =
                      scoreInfo(
                        area.score
                      );

                    return (
                      <Card
                        key={
                          `${area.area}-${index}`
                        }
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            gap: 12,
                            alignItems:
                              "flex-start",
                            marginBottom: 10,
                          }}
                        >
                          <div>
                            <h3
                              style={{
                                margin:
                                  "0 0 3px",
                              }}
                            >
                              {area.area ||
                                "Área"}
                            </h3>

                            <div
                              style={{
                                fontSize:
                                  10,
                                color:
                                  MUTED,
                              }}
                            >
                              {area.nivel ||
                                info.label}
                            </div>
                          </div>

                          <div
                            style={{
                              background:
                                info.bg,
                              color:
                                info.color,
                              borderRadius:
                                10,
                              padding:
                                "7px 10px",
                              fontWeight:
                                900,
                            }}
                          >
                            {area.score ??
                              "-"}
                          </div>
                        </div>

                        {area.resumo && (
                          <p
                            style={{
                              lineHeight:
                                1.55,
                              margin:
                                "0 0 10px",
                              fontSize:
                                12,
                            }}
                          >
                            {area.resumo}
                          </p>
                        )}

                        <div
                          style={{
                            display:
                              "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit,minmax(220px,1fr))",
                            gap: 10,
                          }}
                        >
                          <ListaInterna
                            titulo="Pontos identificados"
                            itens={
                              area.achados
                            }
                          />

                          <ListaInterna
                            titulo="Riscos"
                            itens={
                              area.riscos
                            }
                          />

                          <ListaInterna
                            titulo="Recomendações"
                            itens={
                              area.recomendacoes
                            }
                          />
                        </div>
                      </Card>
                    );
                  }
                )}
              </div>
            )}

            <BlocoDossie titulo="Plano de melhoria — 90 dias" destaque>
              <Plano90Dias
                plano={
                  plano90Dias
                }
              />
            </BlocoDossie>

            {listaFlexivel(
              quickWins
            ).length > 0 && (
              <BlocoDossie titulo="Ações de curto prazo">
                <ListaDossie
                  itens={
                    quickWins
                  }
                />
              </BlocoDossie>
            )}

            {listaFlexivel(
              kpisRecomendados
            ).length > 0 && (
              <BlocoDossie titulo="Indicadores recomendados">
                <ListaDossie
                  itens={
                    kpisRecomendados
                  }
                />
              </BlocoDossie>
            )}

            {inteligenciaTributaria?.disponivel && (
              <>
                <h2 style={tituloSecao}>
                  Inteligência tributária
                </h2>

                <Card>
                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit,minmax(190px,1fr))",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        background:
                          "#F7F8FB",
                        borderRadius:
                          10,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9.5,
                          color: MUTED,
                          marginBottom: 4,
                        }}
                      >
                        FATURAMENTO DE REFERÊNCIA
                      </div>

                      <strong
                        style={{
                          fontSize: 18,
                        }}
                      >
                        {Number(
                          inteligenciaTributaria
                            .faturamentoMensalReferencia
                        ).toLocaleString(
                          "pt-BR",
                          {
                            style:
                              "currency",
                            currency:
                              "BRL",
                            maximumFractionDigits:
                              0,
                          }
                        )}
                      </strong>
                    </div>

                    <div
                      style={{
                        background:
                          "#FFF3EF",
                        borderRadius:
                          10,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9.5,
                          color:
                            "#993C1D",
                          marginBottom: 4,
                        }}
                      >
                        CARGA TRIBUTÁRIA ESTIMADA
                      </div>

                      <strong
                        style={{
                          fontSize: 22,
                          color:
                            "#993C1D",
                        }}
                      >
                        {Number(
                          inteligenciaTributaria
                            .cargaTributariaEstimada
                        ).toLocaleString(
                          "pt-BR",
                          {
                            minimumFractionDigits:
                              2,
                            maximumFractionDigits:
                              2,
                          }
                        )}
                        %
                      </strong>
                    </div>

                    <div
                      style={{
                        background:
                          "#F7F8FB",
                        borderRadius:
                          10,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9.5,
                          color: MUTED,
                          marginBottom: 4,
                        }}
                      >
                        TRIBUTOS MENSAIS ESTIMADOS
                      </div>

                      <strong
                        style={{
                          fontSize: 18,
                        }}
                      >
                        {Number(
                          inteligenciaTributaria
                            .tributosMensaisEstimados
                        ).toLocaleString(
                          "pt-BR",
                          {
                            style:
                              "currency",
                            currency:
                              "BRL",
                            maximumFractionDigits:
                              0,
                          }
                        )}
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      background:
                        NAVY,
                      color: WHITE,
                      borderRadius: 10,
                      padding: 14,
                    }}
                  >
                    <strong
                      style={{
                        display:
                          "block",
                        marginBottom: 6,
                      }}
                    >
                      Reforma Tributária
                    </strong>

                    <div
                      style={{
                        fontSize: 12,
                        lineHeight: 1.6,
                        color:
                          "#E5EAF3",
                      }}
                    >
                      {inteligenciaTributaria
                        .reforma
                        ?.tratamentoSetorial ||
                        inteligenciaTributaria
                          .reforma
                          ?.status ||
                        "Impacto setorial em avaliação."}
                    </div>
                  </div>

                  <p
                    style={{
                      margin:
                        "12px 0 0",
                      color: MUTED,
                      fontSize: 10,
                      lineHeight: 1.45,
                      fontStyle:
                        "italic",
                    }}
                  >
                    Os valores tributários apresentados são estimativas gerenciais e
                    devem ser validados com dados fiscais e contábeis completos antes
                    de qualquer decisão definitiva.
                  </p>
                </Card>
              </>
            )}
          </div>
        )}

        {abaRelatorio === "equipe" && (
          <div>
            <div
              style={{
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  color: CORAL,
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 0.7,
                  marginBottom: 5,
                }}
              >
                RELATÓRIO TÉCNICO
              </div>

              <h2
                style={{
                  ...tituloSecao,
                  marginTop: 0,
                  fontSize: 24,
                }}
              >
                Visão por departamento
              </h2>

              <p
                style={{
                  margin:
                    "0 0 12px",
                  color: MUTED,
                  fontSize: 12,
                  lineHeight: 1.55,
                }}
              >
                Selecione o departamento para visualizar apenas as informações
                técnicas necessárias ao especialista responsável.
              </p>
            </div>

            {carregandoEquipe ? (
              <Card>
                Carregando relatório da equipe...
              </Card>
            ) : atendimentosEquipe.length === 0 ? (
              <Card>
                Este diagnóstico ainda não possui atendimentos departamentais vinculados.
              </Card>
            ) : (
              <>
                <Card
                  style={{
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(220px,1fr) minmax(220px,1fr)",
                      gap: 12,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 10,
                          fontWeight: 800,
                          marginBottom: 5,
                        }}
                      >
                        DEPARTAMENTO
                      </label>

                      <select
                        value={
                          atendimentoEquipeSelecionado?.area ||
                          areaEquipe
                        }
                        onChange={(e) =>
                          setAreaEquipe(
                            e.target.value
                          )
                        }
                        style={{
                          width: "100%",
                          border:
                            "1px solid #D8DEEA",
                          borderRadius: 9,
                          padding:
                            "10px 11px",
                          background:
                            WHITE,
                        }}
                      >
                        {areasEquipeDisponiveis.map(
                          (area) => (
                            <option
                              key={area}
                              value={area}
                            >
                              {area}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          marginBottom: 5,
                        }}
                      >
                        RESPONSÁVEL
                      </div>

                      <div
                        style={{
                          minHeight: 40,
                          display: "flex",
                          alignItems: "center",
                          padding:
                            "0 11px",
                          border:
                            "1px solid #E3E7EF",
                          borderRadius: 9,
                          background:
                            "#F7F8FB",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {atendimentoEquipeSelecionado
                          ?.responsavelNome ||
                          "Não atribuído"}
                      </div>
                    </div>
                  </div>
                </Card>

                {atendimentoEquipeSelecionado && (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "minmax(0,1fr) 150px",
                        gap: 12,
                        marginBottom: 14,
                      }}
                    >
                      <Card>
                        <div
                          style={{
                            fontSize: 10,
                            color: CORAL,
                            fontWeight: 900,
                            marginBottom: 5,
                          }}
                        >
                          {
                            atendimentoEquipeSelecionado.area
                          }
                        </div>

                        <h3
                          style={{
                            margin:
                              "0 0 6px",
                            fontSize: 18,
                          }}
                        >
                          {empresa.razaoSocial ||
                            "Empresa"}
                        </h3>

                        <div
                          style={{
                            color: MUTED,
                            fontSize: 11,
                          }}
                        >
                          {atendimentoEquipeSelecionado
                            .nivelArea ||
                            "-"}
                          {" · "}
                          {atendimentoEquipeSelecionado
                            .statusAtendimento ||
                            "NAO_INICIADO"}
                        </div>
                      </Card>

                      <Card
                        style={{
                          textAlign:
                            "center",
                          background:
                            scoreInfo(
                              atendimentoEquipeSelecionado
                                .scoreArea
                            ).bg,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 30,
                            fontWeight: 900,
                            color:
                              scoreInfo(
                                atendimentoEquipeSelecionado
                                  .scoreArea
                              ).color,
                          }}
                        >
                          {atendimentoEquipeSelecionado
                            .scoreArea ??
                            "-"}
                        </div>

                        <div
                          style={{
                            fontSize: 9,
                            color:
                              scoreInfo(
                                atendimentoEquipeSelecionado
                                  .scoreArea
                              ).color,
                            fontWeight: 800,
                          }}
                        >
                          SCORE DA ÁREA
                        </div>
                      </Card>
                    </div>

                    {areaClientePorNome[
                      atendimentoEquipeSelecionado.area
                    ]?.resumo && (
                      <BlocoDossie titulo="Situação identificada" destaque>
                        <p
                          style={{
                            margin: 0,
                            lineHeight: 1.6,
                            fontSize: 12.5,
                          }}
                        >
                          {
                            areaClientePorNome[
                              atendimentoEquipeSelecionado.area
                            ].resumo
                          }
                        </p>
                      </BlocoDossie>
                    )}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(220px,1fr))",
                        gap: 10,
                        marginBottom: 16,
                      }}
                    >
                      <ListaInterna
                        titulo="Oportunidades da área"
                        itens={
                          atendimentoEquipeSelecionado
                            .oportunidades
                        }
                      />

                      <ListaInterna
                        titulo="Riscos"
                        itens={
                          atendimentoEquipeSelecionado
                            .riscos
                        }
                      />

                      <ListaInterna
                        titulo="Recomendações"
                        itens={
                          atendimentoEquipeSelecionado
                            .recomendacoes
                        }
                      />

                      <ListaInterna
                        titulo="Plano de ação"
                        itens={
                          atendimentoEquipeSelecionado
                            .planoAcao
                        }
                      />
                    </div>

                    {atendimentoEquipeSelecionado
                      .orientacaoTecnica && (
                      <BlocoDossie titulo="Orientação técnica para o especialista">
                        <p
                          style={{
                            margin: 0,
                            lineHeight: 1.6,
                            fontSize: 12,
                          }}
                        >
                          {
                            atendimentoEquipeSelecionado
                              .orientacaoTecnica
                          }
                        </p>
                      </BlocoDossie>
                    )}

                    <h2
                      style={
                        tituloSecao
                      }
                    >
                      Perguntas e respostas da área
                    </h2>

                    <Card
                      style={{
                        padding: 0,
                        overflowX:
                          "auto",
                      }}
                    >
                      <table
                        style={{
                          width:
                            "100%",
                          borderCollapse:
                            "collapse",
                          minWidth: 720,
                        }}
                      >
                        <thead>
                          <tr>
                            <th
                              style={
                                thStyle
                              }
                            >
                              Tema
                            </th>

                            <th
                              style={
                                thStyle
                              }
                            >
                              Pergunta
                            </th>

                            <th
                              style={
                                thStyle
                              }
                            >
                              Resposta
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {perguntasEquipe.length ? (
                            perguntasEquipe.map(
                              (
                                pergunta,
                                index
                              ) => (
                                <tr
                                  key={
                                    index
                                  }
                                >
                                  <td
                                    style={
                                      tdStyle
                                    }
                                  >
                                    {pergunta.tema ||
                                      "-"}
                                  </td>

                                  <td
                                    style={
                                      tdStyle
                                    }
                                  >
                                    {pergunta.pergunta ||
                                      "-"}
                                  </td>

                                  <td
                                    style={{
                                      ...tdStyle,
                                      fontWeight:
                                        800,
                                    }}
                                  >
                                    {pergunta.resposta ||
                                      "-"}
                                  </td>
                                </tr>
                              )
                            )
                          ) : (
                            <tr>
                              <td
                                colSpan="3"
                                style={{
                                  ...tdStyle,
                                  textAlign:
                                    "center",
                                }}
                              >
                                Nenhuma pergunta específica armazenada para esta área.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </Card>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// =========================================================
// LISTA INTERNA
// =========================================================

function ListaInterna({
  titulo,
  itens,
}) {
  const lista =
    normalizarLista(
      itens
    );

  return (
    <div
      style={{
        background:
          "#F7F8FB",

        borderRadius:
          9,

        padding:
          11,
      }}
    >
      <strong
        style={{
          display:
            "block",

          fontSize:
            11,

          marginBottom:
            6,
        }}
      >
        {titulo}
      </strong>

      {lista.length ? (
        <ul
          style={{
            margin:
              0,

            paddingLeft:
              17,

            fontSize:
              11.5,

            lineHeight:
              1.5,
          }}
        >
          {lista.map(
            (
              item,
              index
            ) => (
              <li
                key={
                  index
                }
              >
                {item}
              </li>
            )
          )}
        </ul>
      ) : (
        <span
          style={{
            fontSize:
              11,

            color:
              MUTED,
          }}
        >
          Sem informação.
        </span>
      )}
    </div>
  );
}

// =========================================================
// COMPONENTE PRINCIPAL
// =========================================================

export default function Admin() {
  const [token, setToken] = useState(
    () =>
      sessionStorage.getItem(
        "finder_admin_token"
      ) || ""
  );

  const [
    diagnosticoId,
    setDiagnosticoId,
  ] = useState(null);

  const [
    aba,
    setAba,
  ] = useState("leads");

  function sair() {
    sessionStorage.removeItem(
      "finder_admin_token"
    );

    setToken("");
    setDiagnosticoId(null);
    setAba("leads");
  }

  function BarraAbas() {
    return (
      <div
        style={{
          background: "#101A2F",
          padding: "9px 22px",
          display: "flex",
          justifyContent: "center",
          gap: 8,
          fontFamily: BODY_FONT,
          flexWrap: "wrap",
        }}
      >
        <Botao
          secundario={aba !== "leads"}
          onClick={() =>
            setAba("leads")
          }
        >
          <Users size={14} />
          Leads / CRM
        </Botao>

        <Botao
          secundario={
            aba !==
            "diagnosticos"
          }
          onClick={() =>
            setAba(
              "diagnosticos"
            )
          }
        >
          <Building2
            size={14}
          />
          Diagnósticos
        </Botao>

        <Botao
          secundario={
            aba !==
            "atendimentos"
          }
          onClick={() =>
            setAba(
              "atendimentos"
            )
          }
        >
          <Target size={14} />
          Atendimentos
        </Botao>

        <Botao
          secundario={
            aba !==
            "equipe"
          }
          onClick={() =>
            setAba("equipe")
          }
        >
          <UserPlus size={14} />
          Equipe / Capacidade
        </Botao>
      </div>
    );
  }

  function Cabecalho({
    titulo,
    subtitulo,
  }) {
    return (
      <header
        style={{
          background: NAVY,
          color: WHITE,
          padding: "18px 28px",
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: "0 auto",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems:
                "center",
              gap: 18,
            }}
          >
            <img
              src="/finder-logo.png"
              alt="Finder of Solutions"
              style={{
                maxWidth: 150,
                maxHeight: 45,
                objectFit:
                  "contain",
                background: WHITE,
                padding: 5,
                borderRadius: 7,
              }}
            />

            <div>
              <h1
                style={{
                  margin: 0,
                  fontFamily:
                    DISPLAY_FONT,
                  fontSize: 24,
                }}
              >
                {titulo}
              </h1>

              <p
                style={{
                  margin:
                    "3px 0 0",
                  fontSize: 11,
                  opacity: 0.7,
                }}
              >
                {subtitulo}
              </p>
            </div>
          </div>

          <button
            onClick={sair}
            style={{
              background:
                "transparent",
              border:
                "1px solid rgba(255,255,255,.30)",
              color: WHITE,
              borderRadius: 9,
              padding:
                "8px 11px",
              cursor: "pointer",
              display: "flex",
              alignItems:
                "center",
              gap: 6,
            }}
          >
            <LogOut size={15} />
            Sair
          </button>
        </div>
      </header>
    );
  }

  if (!token) {
    return (
      <LoginAdmin
        onLogin={setToken}
      />
    );
  }

  if (diagnosticoId) {
    return (
      <DetalheDiagnostico
        token={token}
        id={diagnosticoId}
        onVoltar={() =>
          setDiagnosticoId(
            null
          )
        }
      />
    );
  }

  if (
    aba ===
    "diagnosticos"
  ) {
    return (
      <div>
        <BarraAbas />

        <ListaDiagnosticos
          token={token}
          onAbrir={
            setDiagnosticoId
          }
          onLogout={sair}
        />
      </div>
    );
  }

  if (
    aba ===
    "atendimentos"
  ) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: BG,
          fontFamily: BODY_FONT,
          color: NAVY,
        }}
      >
        <Cabecalho
          titulo="Atendimentos"
          subtitulo="Execução consultiva por departamento"
        />

        <BarraAbas />

        <main
          style={{
            maxWidth: 1320,
            margin: "0 auto",
            padding:
              "26px 22px 50px",
          }}
        >
          <AtendimentosDepartamento
            token={token}
            onAbrirDiagnostico={
              setDiagnosticoId
            }
          />
        </main>
      </div>
    );
  }

  if (
    aba ===
    "equipe"
  ) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: BG,
          fontFamily: BODY_FONT,
          color: NAVY,
        }}
      >
        <Cabecalho
          titulo="Equipe / Capacidade"
          subtitulo="Especialidades, permissões e capacidade de atendimento"
        />

        <BarraAbas />

        <main
          style={{
            maxWidth: 1320,
            margin: "0 auto",
            padding:
              "26px 22px 50px",
          }}
        >
          <EquipeCapacidade
            token={token}
          />
        </main>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        fontFamily: BODY_FONT,
        color: NAVY,
      }}
    >
      <Cabecalho
        titulo="Leads / CRM"
        subtitulo="Funil do diagnóstico empresarial"
      />

      <BarraAbas />

      <main
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding:
            "26px 22px 50px",
        }}
      >
        <LeadsCRM
          token={token}
          onAbrirDiagnostico={
            setDiagnosticoId
          }
        />
      </main>
    </div>
  );
}

// =========================================================
// ESTILOS
// =========================================================

const tituloSecao = {
  fontFamily:
    DISPLAY_FONT,

  fontSize:
    20,

  margin:
    "25px 0 10px",
};

const thStyle = {
  background:
    ICE,

  padding:
    "10px 9px",

  textAlign:
    "left",

  color:
    NAVY,

  fontSize:
    11,

  whiteSpace:
    "nowrap",
};

const tdStyle = {
  borderBottom:
    "1px solid #E5E8EE",

  padding:
    "10px 9px",

  fontSize:
    11.5,

  lineHeight:
    1.45,

  verticalAlign:
    "top",
};
