import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

import {
  Search,
  Building2,
  User,
  ArrowLeft,
  LogOut,
  RefreshCcw,
  AlertTriangle,
  ChevronRight,
  Target,
  Download,
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
// HELPERS
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

function normalizarLista(valor) {
  return Array.isArray(valor) ? valor : [];
}

function juntarLista(valor) {
  return Array.isArray(valor)
    ? valor.filter(Boolean).join(" | ")
    : "";
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

function tituloChave(chave = "") {
  const mapa = {
    fase0a30: "0–30 dias",
    fase31a60: "31–60 dias",
    fase61a90: "61–90 dias",

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

    diagnosticoCentral: "Diagnóstico central",
    evidenciaMaisForte: "Evidência mais forte",
    hipotesePrincipal: "Hipótese principal",
    validarPrimeiro: "O que validar primeiro",
    naoFazerAgora: "O que não fazer agora",
    pontosCegos: "Pontos cegos",
    dadosDocumentosSolicitar: "Dados e documentos a solicitar",

    potencialLead: "Potencial do lead",
    justificativa: "Justificativa",
    servicosAderentes: "Serviços aderentes",
    argumentoAbordagem: "Argumento de abordagem",
    objecoesProvaveis: "Objeções prováveis",
    proximaAcaoComercial: "Próxima ação comercial",

    resultadoEsperado: "Resultado esperado",
    indicadores: "Indicadores",
    acoes: "Ações",

    impactoEsperado: "Impacto esperado",
    esforco: "Esforço",
    dependencias: "Dependências",

    oQueMede: "O que mede",
    formaCalculo: "Forma de cálculo",
    frequencia: "Frequência",
    metaSugerida: "Meta sugerida",

    problemaQuePodeAjudar: "Problema que pode ajudar",
    evidencia: "Evidência",

    motivo: "Motivo",
    validar: "O que validar",
  };

  if (mapa[chave]) {
    return mapa[chave];
  }

  return String(chave)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

function textoSeguro(valor) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return "";
  }

  if (
    typeof valor === "string" ||
    typeof valor === "number"
  ) {
    return String(valor);
  }

  if (Array.isArray(valor)) {
    return valor
      .map(textoSeguro)
      .filter(Boolean)
      .join(" • ");
  }

  if (typeof valor === "object") {
    return (
      valor.titulo ||
      valor.nome ||
      valor.indicador ||
      valor.pergunta ||
      valor.acao ||
      valor.objetivo ||
      valor.servico ||
      valor.descricao ||
      valor.resumo ||
      JSON.stringify(valor)
    );
  }

  return String(valor);
}

function temConteudo(valor) {
  if (!valor) {
    return false;
  }

  if (Array.isArray(valor)) {
    return valor.length > 0;
  }

  if (typeof valor === "object") {
    return Object.values(valor).some(
      (item) => temConteudo(item)
    );
  }

  return String(valor).trim() !== "";
}

// =========================================================
// COMPONENTES BÁSICOS
// =========================================================

function Card({
  children,
  style = {},
}) {
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

function ListaInterna({
  titulo,
  itens,
}) {
  const lista =
    normalizarLista(itens);

  return (
    <div
      style={{
        background: "#F7F8FB",
        borderRadius: 9,
        padding: 11,
      }}
    >
      <strong
        style={{
          display: "block",
          fontSize: 11,
          marginBottom: 6,
        }}
      >
        {titulo}
      </strong>

      {lista.length ? (
        <ul
          style={{
            margin: 0,
            paddingLeft: 17,
            fontSize: 11.5,
            lineHeight: 1.5,
          }}
        >
          {lista.map(
            (item, index) => (
              <li key={index}>
                {textoSeguro(item)}
              </li>
            )
          )}
        </ul>
      ) : (
        <span
          style={{
            fontSize: 11,
            color: MUTED,
          }}
        >
          Sem informação.
        </span>
      )}
    </div>
  );
}

// =========================================================
// COMPONENTES DO DOSSIÊ
// =========================================================

function BlocoDossie({
  titulo,
  children,
  destaque = false,
}) {
  return (
    <>
      <h2 style={tituloSecao}>
        {titulo}
      </h2>

      <Card
        style={
          destaque
            ? {
                background: "#FFF9F7",
                border: "1px solid #F0C8BD",
              }
            : {}
        }
      >
        {children}
      </Card>
    </>
  );
}

function RenderValor({
  valor,
}) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return (
      <span
        style={{
          color: MUTED,
          fontSize: 11.5,
        }}
      >
        Sem informação.
      </span>
    );
  }

  if (Array.isArray(valor)) {
    if (!valor.length) {
      return (
        <span
          style={{
            color: MUTED,
            fontSize: 11.5,
          }}
        >
          Sem informação.
        </span>
      );
    }

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {valor.map(
          (item, index) => (
            <RenderItem
              key={index}
              item={item}
              index={index}
            />
          )
        )}
      </div>
    );
  }

  if (
    typeof valor === "object"
  ) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 9,
        }}
      >
        {Object.entries(valor)
          .filter(
            ([, item]) =>
              temConteudo(item)
          )
          .map(
            ([chave, item]) => (
              <div
                key={chave}
                style={{
                  background: "#F7F8FB",
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <strong
                  style={{
                    display: "block",
                    fontSize: 11.5,
                    marginBottom: 5,
                    color: NAVY,
                  }}
                >
                  {tituloChave(chave)}
                </strong>

                <RenderValor
                  valor={item}
                />
              </div>
            )
          )}
      </div>
    );
  }

  return (
    <div
      style={{
        fontSize: 11.8,
        lineHeight: 1.55,
      }}
    >
      {String(valor)}
    </div>
  );
}

function RenderItem({
  item,
  index,
}) {
  if (
    item &&
    typeof item === "object"
  ) {
    const titulo =
      item.titulo ||
      item.nome ||
      item.indicador ||
      item.pergunta ||
      item.acao ||
      item.objetivo ||
      item.servico ||
      `Item ${index + 1}`;

    const chavesIgnoradas = [
      "titulo",
      "nome",
      "indicador",
      "pergunta",
      "acao",
      "objetivo",
      "servico",
    ];

    return (
      <div
        style={{
          background: "#F7F8FB",
          borderRadius: 10,
          padding: 12,
        }}
      >
        <strong
          style={{
            display: "block",
            fontSize: 12.3,
            marginBottom: 6,
          }}
        >
          {textoSeguro(titulo)}
        </strong>

        {Object.entries(item)
          .filter(
            ([chave, valor]) =>
              !chavesIgnoradas.includes(
                chave
              ) &&
              temConteudo(valor)
          )
          .map(
            ([chave, valor]) => (
              <div
                key={chave}
                style={{
                  marginTop: 5,
                  fontSize: 11.5,
                  lineHeight: 1.55,
                }}
              >
                <strong>
                  {tituloChave(chave)}:
                </strong>{" "}

                {Array.isArray(valor)
                  ? valor
                      .map(
                        textoSeguro
                      )
                      .filter(Boolean)
                      .join(" • ")
                  : typeof valor ===
                      "object"
                    ? textoSeguro(valor)
                    : String(valor)}
              </div>
            )
          )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        fontSize: 11.8,
        lineHeight: 1.55,
      }}
    >
      <span
        style={{
          color: CORAL,
          fontWeight: 900,
        }}
      >
        •
      </span>

      <span>
        {textoSeguro(item)}
      </span>
    </div>
  );
}

function Plano90Dias({
  plano,
}) {
  if (
    !plano ||
    typeof plano !== "object"
  ) {
    return (
      <span
        style={{
          color: MUTED,
          fontSize: 12,
        }}
      >
        Plano de 90 dias não gerado.
      </span>
    );
  }

  const fases = [
    {
      chave: "fase0a30",
      titulo: "0–30 dias",
    },
    {
      chave: "fase31a60",
      titulo: "31–60 dias",
    },
    {
      chave: "fase61a90",
      titulo: "61–90 dias",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit,minmax(250px,1fr))",
        gap: 12,
      }}
    >
      {fases.map(
        (fase) => {
          const dados =
            plano[fase.chave] ||
            {};

          return (
            <div
              key={fase.chave}
              style={{
                background: WHITE,
                border: "1px solid #E3E7EF",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div
                style={{
                  color: CORAL,
                  fontSize: 13,
                  fontWeight: 900,
                  marginBottom: 10,
                }}
              >
                {fase.titulo}
              </div>

              <RenderValor
                valor={dados}
              />
            </div>
          );
        }
      )}
    </div>
  );
}

// =========================================================
// LOGIN
// =========================================================

function LoginAdmin({
  onLogin,
}) {
  const [
    token,
    setToken,
  ] = useState("");

  const [
    erro,
    setErro,
  ] = useState("");

  const [
    carregando,
    setCarregando,
  ] = useState(false);

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
          .catch(
            () => null
          );

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
          Área restrita da Finder para consulta dos diagnósticos empresariais realizados.
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
          .catch(
            () => null
          );

      if (
        !resposta.ok ||
        !data?.sucesso
      ) {
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
    carregar("");
  }

  const mediaScore =
    useMemo(() => {
      const scores =
        diagnosticos
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
            soma,
            valor
          ) =>
            soma + valor,
          0
        ) /
        scores.length
      );
    }, [diagnosticos]);

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
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await resposta
          .json()
          .catch(
            () => null
          );

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

      const abaDiagnosticos =
        registros.map(
          (item) => {
            const participante =
              item.participante ||
              {};

            const empresa =
              item.empresa ||
              {};

            const resultado =
              item.resultado ||
              {};

            const geral =
              resultado
                .diagnosticoGeral ||
              {};

            const comercial =
              resultado
                .visaoComercial ||
              {};

            return {
              ID:
                item.id || "",

              Data:
                item.criadoEm
                  ? new Date(
                      item.criadoEm
                    ).toLocaleString(
                      "pt-BR"
                    )
                  : "",

              Empresa:
                empresa.razaoSocial ||
                "",

              CNPJ:
                formatarCnpj(
                  empresa.cnpj ||
                  ""
                ),

              Responsável:
                participante.nome ||
                "",

              Cargo:
                participante.cargo ||
                "",

              Telefone:
                participante.telefone ||
                "",

              Email:
                participante.email ||
                "",

              Segmento:
                empresa.segmento ||
                "",

              Subsegmento:
                empresa.subsegmento ||
                "",

              Score:
                item.score ??
                "",

              "Dores declaradas":
                normalizarLista(
                  item.dores
                ).join(
                  " | "
                ),

              "Resumo executivo":
                geral.resumoExecutivo ||
                "",

              "Alerta estratégico":
                geral.alertaEstrategico ||
                "",

              "Prioridades imediatas":
                juntarLista(
                  geral
                    .prioridadesImediatas
                ),

              "Potencial do lead":
                comercial.potencialLead ||
                "",

              "Justificativa comercial":
                comercial.justificativa ||
                "",

              "Argumento comercial":
                comercial.argumentoAbordagem ||
                "",

              "Próxima ação comercial":
                comercial.proximaAcaoComercial ||
                "",
            };
          }
        );

      const abaAreas = [];

      const abaPerguntas = [];

      const abaPlano90 = [];

      const abaQuickWins = [];

      const abaKpis = [];

      const abaAprofundamento =
        [];

      const abaComercial = [];

      registros.forEach(
        (item) => {
          const empresa =
            item.empresa ||
            {};

          const resultado =
            item.resultado ||
            {};

          normalizarLista(
            resultado.areas ||
            item.areas
          ).forEach(
            (area) => {
              abaAreas.push({
                "ID Diagnóstico":
                  item.id || "",

                Empresa:
                  empresa.razaoSocial ||
                  "",

                Área:
                  area.area || "",

                Score:
                  area.score ?? "",

                Nível:
                  scoreInfo(
                    area.score
                  ).label,

                Prioridade:
                  area.prioridade ??
                  "",

                Resumo:
                  area.resumo || "",

                Achados:
                  juntarLista(
                    area.achados
                  ),

                "Causas prováveis":
                  juntarLista(
                    area.causasProvaveis
                  ),

                Riscos:
                  juntarLista(
                    area.riscos
                  ),

                Recomendações:
                  juntarLista(
                    area.recomendacoes
                  ),
              });
            }
          );

          normalizarLista(
            item.perguntasRespostas
          ).forEach(
            (pergunta) => {
              abaPerguntas.push({
                "ID Diagnóstico":
                  item.id || "",

                Empresa:
                  empresa.razaoSocial ||
                  "",

                Área:
                  pergunta.area ||
                  "",

                Tema:
                  pergunta.tema ||
                  "",

                Pergunta:
                  pergunta.pergunta ||
                  "",

                Resposta:
                  pergunta.resposta ||
                  "",

                Peso:
                  pergunta.peso ??
                  "",

                Importância:
                  pergunta.importancia ??
                  "",

                Motivo:
                  pergunta.motivo ||
                  "",

                "Risco avaliado":
                  pergunta.riscoAvaliado ||
                  "",
              });
            }
          );

          const plano =
            resultado.plano90Dias ||
            {};

          [
            [
              "0–30 dias",
              plano.fase0a30,
            ],
            [
              "31–60 dias",
              plano.fase31a60,
            ],
            [
              "61–90 dias",
              plano.fase61a90,
            ],
          ].forEach(
            ([fase, dados]) => {
              if (!dados) return;

              abaPlano90.push({
                "ID Diagnóstico":
                  item.id || "",

                Empresa:
                  empresa.razaoSocial ||
                  "",

                Fase:
                  fase,

                Objetivo:
                  dados.objetivo ||
                  "",

                Ações:
                  juntarLista(
                    dados.acoes
                  ),

                "Resultado esperado":
                  dados.resultadoEsperado ||
                  "",

                Indicadores:
                  juntarLista(
                    dados.indicadores
                  ),
              });
            }
          );

          normalizarLista(
            resultado.quickWins
          ).forEach(
            (quick) => {
              abaQuickWins.push({
                "ID Diagnóstico":
                  item.id || "",

                Empresa:
                  empresa.razaoSocial ||
                  "",

                Ação:
                  quick.acao || "",

                Motivo:
                  quick.motivo ||
                  "",

                "Impacto esperado":
                  quick.impactoEsperado ||
                  "",

                Esforço:
                  quick.esforco ||
                  "",

                Dependências:
                  juntarLista(
                    quick.dependencias
                  ),
              });
            }
          );

          normalizarLista(
            resultado.kpisRecomendados
          ).forEach(
            (kpi) => {
              abaKpis.push({
                "ID Diagnóstico":
                  item.id || "",

                Empresa:
                  empresa.razaoSocial ||
                  "",

                Indicador:
                  kpi.indicador ||
                  "",

                "O que mede":
                  kpi.oQueMede ||
                  "",

                "Forma de cálculo":
                  kpi.formaCalculo ||
                  "",

                Frequência:
                  kpi.frequencia ||
                  "",

                "Meta sugerida":
                  kpi.metaSugerida ||
                  "",
              });
            }
          );

          normalizarLista(
            resultado
              .perguntasAprofundamento
          ).forEach(
            (pergunta) => {
              abaAprofundamento.push({
                "ID Diagnóstico":
                  item.id || "",

                Empresa:
                  empresa.razaoSocial ||
                  "",

                Pergunta:
                  pergunta.pergunta ||
                  "",

                Motivo:
                  pergunta.motivo ||
                  "",

                "O que validar":
                  pergunta.validar ||
                  "",
              });
            }
          );

          const comercial =
            resultado
              .visaoComercial ||
            {};

          normalizarLista(
            comercial
              .servicosAderentes
          ).forEach(
            (servico) => {
              abaComercial.push({
                "ID Diagnóstico":
                  item.id || "",

                Empresa:
                  empresa.razaoSocial ||
                  "",

                "Potencial lead":
                  comercial.potencialLead ||
                  "",

                Serviço:
                  servico.servico ||
                  "",

                "Problema que pode ajudar":
                  servico
                    .problemaQuePodeAjudar ||
                  "",

                Evidência:
                  servico.evidencia ||
                  "",

                "Argumento de abordagem":
                  comercial
                    .argumentoAbordagem ||
                  "",

                "Próxima ação":
                  comercial
                    .proximaAcaoComercial ||
                  "",
              });
            }
          );
        }
      );

      const workbook =
        XLSX.utils.book_new();

      const adicionarAba = (
        dados,
        nome
      ) => {
        const worksheet =
          XLSX.utils.json_to_sheet(
            dados
          );

        XLSX.utils.book_append_sheet(
          workbook,
          worksheet,
          nome
        );
      };

      adicionarAba(
        abaDiagnosticos,
        "Diagnósticos"
      );

      adicionarAba(
        abaAreas,
        "Análise por Área"
      );

      adicionarAba(
        abaPerguntas,
        "Perguntas Respostas"
      );

      adicionarAba(
        abaPlano90,
        "Plano 90 Dias"
      );

      adicionarAba(
        abaQuickWins,
        "Quick Wins"
      );

      adicionarAba(
        abaKpis,
        "KPIs"
      );

      adicionarAba(
        abaAprofundamento,
        "Aprofundamento"
      );

      adicionarAba(
        abaComercial,
        "Visão Comercial"
      );

      const dataArquivo =
        new Date()
          .toISOString()
          .slice(
            0,
            10
          );

      XLSX.writeFile(
        workbook,
        `diagnosticos-finder-${dataArquivo}.xlsx`
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
            alignItems: "center",
            gap: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
            }}
          >
            <img
              src="/finder-logo.png"
              alt="Finder of Solutions"
              style={{
                maxWidth: 150,
                maxHeight: 45,
                objectFit: "contain",
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
                Diagnósticos
              </h1>

              <p
                style={{
                  margin: "3px 0 0",
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

              color: WHITE,
              borderRadius: 9,
              padding: "8px 11px",

              cursor: "pointer",

              display: "flex",
              alignItems: "center",
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
        <div
          style={{
            display: "grid",

            gridTemplateColumns:
              "repeat(auto-fit,minmax(190px,1fr))",

            gap: 12,
            marginBottom: 20,
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
              {diagnosticos.length}
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
              {mediaScore ?? "-"}
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
              gap: 9,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                flex:
                  "1 1 360px",

                position: "relative",
              }}
            >
              <Search
                size={16}
                color={MUTED}
                style={{
                  position: "absolute",
                  top: 12,
                  left: 12,
                }}
              />

              <input
                value={busca}
                onChange={(e) =>
                  setBusca(
                    e.target.value
                  )
                }
                onKeyDown={(e) => {
                  if (
                    e.key ===
                    "Enter"
                  ) {
                    pesquisar();
                  }
                }}
                placeholder="Buscar empresa, CNPJ, nome, e-mail, segmento..."
                style={{
                  width: "100%",
                  boxSizing:
                    "border-box",

                  border:
                    "1px solid #D8DEEA",

                  borderRadius: 9,

                  padding:
                    "10px 12px 10px 36px",

                  fontFamily:
                    BODY_FONT,

                  fontSize: 13,
                }}
              />
            </div>

            <Botao
              onClick={pesquisar}
            >
              <Search size={14} />
              Buscar
            </Botao>

            {buscaAplicada && (
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

        {erro && (
          <div
            style={{
              background:
                "#FAECE7",

              color:
                "#993C1D",

              padding: 13,
              borderRadius: 10,
              marginBottom: 14,

              display: "flex",
              gap: 8,
              alignItems:
                "flex-start",
            }}
          >
            <AlertTriangle
              size={17}
            />

            <div>
              {erro}
            </div>
          </div>
        )}

        {carregando ? (
          <Card>
            Carregando diagnósticos...
          </Card>

        ) : diagnosticos.length ===
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
            {diagnosticos.map(
              (item) => {
                const info =
                  scoreInfo(
                    item.score
                  );

                const dores =
                  normalizarLista(
                    item.dores
                  );

                return (
                  <button
                    key={item.id}
                    onClick={() =>
                      onAbrir(
                        item.id
                      )
                    }
                    style={{
                      width: "100%",
                      background: WHITE,

                      border:
                        "1px solid #E2E6EE",

                      borderRadius: 14,
                      padding: 16,

                      textAlign: "left",
                      cursor: "pointer",

                      display: "grid",

                      gridTemplateColumns:
                        "minmax(250px,2fr) minmax(180px,1.2fr) 90px 34px",

                      gap: 15,
                      alignItems: "center",

                      fontFamily:
                        BODY_FONT,

                      color: NAVY,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          marginBottom: 4,
                        }}
                      >
                        {item.razaoSocial ||
                          "Empresa não informada"}
                      </div>

                      <div
                        style={{
                          fontSize: 11.5,
                          color: MUTED,

                          display: "flex",
                          gap: 9,
                          flexWrap: "wrap",
                        }}
                      >
                        <span>
                          {formatarCnpj(
                            item.cnpj
                          )}
                        </span>

                        {item.segmento && (
                          <span>
                            {item.segmento}
                          </span>
                        )}
                      </div>

                      {dores.length >
                        0 && (
                        <div
                          style={{
                            display: "flex",
                            gap: 5,
                            flexWrap: "wrap",
                            marginTop: 8,
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
                                  {dor}
                                </span>
                              )
                            )}
                        </div>
                      )}
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {item.nome ||
                          "Participante não informado"}
                      </div>

                      <div
                        style={{
                          fontSize: 10.5,
                          color: MUTED,
                          marginTop: 3,
                        }}
                      >
                        {item.email ||
                          "-"}
                      </div>

                      <div
                        style={{
                          fontSize: 10.5,
                          color: MUTED,
                          marginTop: 5,
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
                            info.bg,

                          color:
                            info.color,

                          borderRadius:
                            12,

                          padding:
                            "8px 6px",
                        }}
                      >
                        <strong
                          style={{
                            fontSize: 19,
                          }}
                        >
                          {item.score ??
                            "-"}
                        </strong>

                        <div
                          style={{
                            fontSize: 8.5,
                            marginTop: 1,
                          }}
                        >
                          {info.label}
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
            .catch(
              () => null
            );

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
          minHeight: "100vh",
          background: BG,
          padding: 24,
          fontFamily:
            BODY_FONT,
        }}
      >
        <Botao
          secundario
          onClick={onVoltar}
        >
          <ArrowLeft
            size={15}
          />

          Voltar
        </Botao>

        <div
          style={{
            marginTop: 16,
            background:
              "#FAECE7",
            color: "#993C1D",
            padding: 15,
            borderRadius: 10,
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

  const plano90Dias =
    resultado.plano90Dias ||
    null;

  const quickWins =
    normalizarLista(
      resultado.quickWins
    );

  const kpisRecomendados =
    normalizarLista(
      resultado
        .kpisRecomendados
    );

  const perguntasAprofundamento =
    normalizarLista(
      resultado
        .perguntasAprofundamento
    );

  const visaoConsultor =
    resultado.visaoConsultor ||
    null;

  const visaoComercial =
    resultado.visaoComercial ||
    null;

  const lacunasDiagnostico =
    normalizarLista(
      resultado
        .lacunasDiagnostico
    );

  const oportunidadesConsultoria =
    normalizarLista(
      resultado
        .oportunidadesConsultoria
    );

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
          padding:
            "17px 24px",
          color: WHITE,
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",

            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: 15,
          }}
        >
          <Botao
            secundario
            onClick={onVoltar}
          >
            <ArrowLeft
              size={15}
            />

            Diagnósticos
          </Botao>

          <span
            style={{
              fontSize: 11,
              opacity: 0.75,
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
          maxWidth: 1180,
          margin: "0 auto",
          padding:
            "24px 20px 60px",
        }}
      >
        <div
          style={{
            display: "grid",

            gridTemplateColumns:
              "minmax(0,1fr) 170px",

            gap: 14,
            marginBottom: 16,
          }}
        >
          <Card>
            <div
              style={{
                fontSize: 11,
                color: CORAL,
                fontWeight: 800,
                marginBottom: 6,
              }}
            >
              DIAGNÓSTICO EMPRESARIAL
            </div>

            <h1
              style={{
                fontFamily:
                  DISPLAY_FONT,
                fontSize: 28,
                margin:
                  "0 0 7px",
              }}
            >
              {empresa.razaoSocial ||
                "Empresa"}
            </h1>

            <div
              style={{
                color: MUTED,
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              {formatarCnpj(
                empresa.cnpj
              )}

              {empresa.segmento
                ? ` · ${empresa.segmento}`
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
                fontSize: 38,
                fontWeight: 900,
                color: score.color,
              }}
            >
              {item.score ??
                "-"}
            </div>

            <div
              style={{
                fontSize: 11,
                color: score.color,
                fontWeight: 700,
              }}
            >
              {score.label}
            </div>
          </Card>
        </div>

        <div
          style={{
            display: "grid",

            gridTemplateColumns:
              "repeat(auto-fit,minmax(230px,1fr))",

            gap: 12,
            marginBottom: 18,
          }}
        >
          <Card>
            <User
              size={18}
              color={CORAL}
            />

            <h3>
              Participante
            </h3>

            <p
              style={{
                lineHeight: 1.6,
              }}
            >
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
            <Building2
              size={18}
              color={CORAL}
            />

            <h3>
              Negócio
            </h3>

            <p
              style={{
                lineHeight: 1.6,
              }}
            >
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
                  paddingLeft: 18,
                  marginBottom: 0,
                  lineHeight: 1.55,
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
                  margin: 0,
                  lineHeight: 1.65,
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

        <h2 style={tituloSecao}>
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
                  <Card key={index}>
                    <div
                      style={{
                        display: "flex",

                        justifyContent:
                          "space-between",

                        gap: 15,
                        marginBottom: 10,
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
                            fontSize: 10,
                            color: info.color,
                            fontWeight: 700,
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

                          borderRadius: 10,

                          fontWeight: 800,
                        }}
                      >
                        {area.score ??
                          "-"}
                      </div>
                    </div>

                    {area.resumo && (
                      <p
                        style={{
                          lineHeight: 1.55,
                        }}
                      >
                        {area.resumo}
                      </p>
                    )}

                    <div
                      style={{
                        display: "grid",

                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(210px,1fr))",

                        gap: 10,
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
        {/* DOSSIÊ CONSULTIVO FINDER */}
        {/* ================================================= */}

        <div
          style={{
            marginTop: 36,
            paddingTop: 20,
            borderTop:
              `4px solid ${NAVY}`,
          }}
        >
          <div
            style={{
              color: CORAL,
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 1,
            }}
          >
            USO INTERNO · FINDER OF SOLUTIONS
          </div>

          <h2
            style={{
              fontFamily:
                DISPLAY_FONT,

              fontSize: 28,
              margin:
                "6px 0 5px",
            }}
          >
            Dossiê Consultivo
          </h2>

          <p
            style={{
              color: MUTED,
              fontSize: 12,
              lineHeight: 1.55,
              margin:
                "0 0 18px",
            }}
          >
            Camada interna para condução da reunião, validação das hipóteses, definição das prioridades, acompanhamento da execução e abordagem comercial.
          </p>
        </div>

        <BlocoDossie
          titulo="Plano de ação — 90 dias"
          destaque
        >
          <Plano90Dias
            plano={plano90Dias}
          />
        </BlocoDossie>

        <BlocoDossie
          titulo="Quick wins"
        >
          <RenderValor
            valor={
              quickWins.length
                ? quickWins
                : null
            }
          />
        </BlocoDossie>

        <BlocoDossie
          titulo="KPIs recomendados"
        >
          <RenderValor
            valor={
              kpisRecomendados.length
                ? kpisRecomendados
                : null
            }
          />
        </BlocoDossie>

        <BlocoDossie
          titulo="Visão do consultor"
          destaque
        >
          <RenderValor
            valor={
              visaoConsultor
            }
          />
        </BlocoDossie>

        <BlocoDossie
          titulo="Perguntas para aprofundamento"
        >
          <RenderValor
            valor={
              perguntasAprofundamento.length
                ? perguntasAprofundamento
                : null
            }
          />
        </BlocoDossie>

        <BlocoDossie
          titulo="Visão comercial Finder"
        >
          <RenderValor
            valor={
              visaoComercial
            }
          />
        </BlocoDossie>

        {lacunasDiagnostico.length >
          0 && (
          <BlocoDossie
            titulo="Lacunas do diagnóstico"
          >
            <RenderValor
              valor={
                lacunasDiagnostico
              }
            />
          </BlocoDossie>
        )}

        {oportunidadesConsultoria.length >
          0 && (
          <BlocoDossie
            titulo="Oportunidades de consultoria"
          >
            <RenderValor
              valor={
                oportunidadesConsultoria
              }
            />
          </BlocoDossie>
        )}

        <h2 style={tituloSecao}>
          Perguntas e respostas
        </h2>

        <Card
          style={{
            padding: 0,
            overflowX: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse:
                "collapse",
              minWidth: 900,
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>
                  Área
                </th>

                <th style={thStyle}>
                  Tema
                </th>

                <th style={thStyle}>
                  Pergunta
                </th>

                <th style={thStyle}>
                  Resposta
                </th>

                <th style={thStyle}>
                  Peso
                </th>

                <th style={thStyle}>
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
                      key={index}
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
                          fontWeight: 800,
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
      </main>
    </div>
  );
}

// =========================================================
// COMPONENTE PRINCIPAL
// =========================================================

export default function Admin() {
  const [
    token,
    setToken,
  ] = useState(
    () =>
      sessionStorage.getItem(
        "finder_admin_token"
      ) || ""
  );

  const [
    diagnosticoId,
    setDiagnosticoId,
  ] = useState(null);

  function sair() {
    sessionStorage.removeItem(
      "finder_admin_token"
    );

    setToken("");

    setDiagnosticoId(
      null
    );
  }

  if (!token) {
    return (
      <LoginAdmin
        onLogin={setToken}
      />
    );
  }

  if (
    diagnosticoId
  ) {
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

  return (
    <ListaDiagnosticos
      token={token}
      onAbrir={
        setDiagnosticoId
      }
      onLogout={sair}
    />
  );
}

// =========================================================
// ESTILOS
// =========================================================

const tituloSecao = {
  fontFamily:
    DISPLAY_FONT,

  fontSize: 20,

  margin:
    "25px 0 10px",
};

const thStyle = {
  background: ICE,

  padding:
    "10px 9px",

  textAlign:
    "left",

  color: NAVY,

  fontSize: 11,

  whiteSpace:
    "nowrap",
};

const tdStyle = {
  borderBottom:
    "1px solid #E5E8EE",

  padding:
    "10px 9px",

  fontSize: 11.5,

  lineHeight: 1.45,

  verticalAlign:
    "top",
};
