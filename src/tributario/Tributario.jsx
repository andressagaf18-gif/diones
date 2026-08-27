import {
  useMemo,
  useState,
} from "react";

const NAVY = "#17233D";
const CORAL = "#FF6B4A";
const MUTED = "#5B667A";
const WHITE = "#FFFFFF";
const BG = "#F6F8FC";
const BORDER = "#E3E7EF";

const BODY_FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const DISPLAY_FONT =
  "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif";

function Card({
  children,
  style = {},
}) {
  return (
    <div
      style={{
        background: WHITE,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: 18,
        boxShadow:
          "0 8px 24px rgba(15,31,56,.05)",
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
  secundario = false,
  disabled = false,
  style = {},
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border:
          secundario
            ? "1px solid #D8DEEA"
            : 0,
        background:
          secundario
            ? WHITE
            : CORAL,
        color:
          secundario
            ? NAVY
            : WHITE,
        borderRadius: 11,
        padding: "10px 14px",
        fontWeight: 900,
        fontSize: 12,
        cursor:
          disabled
            ? "not-allowed"
            : "pointer",
        opacity:
          disabled
            ? .55
            : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function inputStyle() {
  return {
    width: "100%",
    boxSizing: "border-box",
    border:
      "1px solid #D8DEEA",
    borderRadius: 10,
    padding: "10px 11px",
    fontSize: 12,
    color: NAVY,
    background: WHITE,
    outline: "none",
  };
}

function somenteDigitos(valor = "") {
  return String(valor).replace(
    /\D/g,
    ""
  );
}

function formatarCnpj(valor = "") {
  const digits =
    somenteDigitos(valor);

  if (
    digits.length !== 14
  ) {
    return valor;
  }

  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

function novaEmpresa() {
  return {
    id:
      crypto?.randomUUID?.() ||
      `${Date.now()}_${Math.random()}`,
    cnpj: "",
    carregando: false,
    erro: "",
    dados: null,
  };
}

function ModalidadeCard({
  ativa,
  titulo,
  descricao,
  onClick,
  destaque = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        width: "100%",
        minHeight: 138,
        borderRadius: 16,
        padding: 16,
        cursor: "pointer",
        border:
          ativa
            ? `2px solid ${CORAL}`
            : "1px solid #D8DEEA",
        background:
          ativa
            ? "#FFF7F3"
            : WHITE,
        color: NAVY,
        boxShadow:
          destaque
            ? "0 10px 28px rgba(255,107,74,.08)"
            : "none",
      }}
    >
      {destaque && (
        <span
          style={{
            display: "inline-block",
            background: CORAL,
            color: WHITE,
            borderRadius: 999,
            padding: "4px 7px",
            fontSize: 8,
            fontWeight: 900,
            marginBottom: 8,
          }}
        >
          RECOMENDADO
        </span>
      )}

      <strong
        style={{
          display: "block",
          fontSize: 15,
        }}
      >
        {titulo}
      </strong>

      <span
        style={{
          display: "block",
          marginTop: 6,
          color: MUTED,
          fontSize: 10.5,
          lineHeight: 1.5,
        }}
      >
        {descricao}
      </span>
    </button>
  );
}

function EmpresaCard({
  empresa,
  index,
  onChangeCnpj,
  onBuscar,
  onRemover,
  podeRemover,
}) {
  return (
    <Card
      style={{
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <strong>
          Empresa {index + 1}
        </strong>

        {podeRemover && (
          <button
            type="button"
            onClick={onRemover}
            style={{
              border: 0,
              background:
                "transparent",
              color: "#A12B2B",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 900,
            }}
          >
            Remover
          </button>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(220px,1fr) auto",
          gap: 8,
        }}
      >
        <input
          value={empresa.cnpj}
          onChange={(e) =>
            onChangeCnpj(
              e.target.value
            )
          }
          onKeyDown={(e) => {
            if (
              e.key === "Enter"
            ) {
              onBuscar();
            }
          }}
          placeholder="00.000.000/0000-00"
          style={inputStyle()}
        />

        <Botao
          onClick={onBuscar}
          disabled={
            empresa.carregando
          }
        >
          {empresa.carregando
            ? "Buscando..."
            : "Buscar CNPJ"}
        </Botao>
      </div>

      {empresa.erro && (
        <div
          style={{
            marginTop: 8,
            color: "#993C1D",
            background:
              "#FAECE7",
            padding: 8,
            borderRadius: 8,
            fontSize: 10,
          }}
        >
          {empresa.erro}
        </div>
      )}

      {empresa.dados && (
        <div
          style={{
            marginTop: 10,
            background:
              "#F7F8FB",
            borderRadius: 10,
            padding: 11,
            display: "grid",
            gap: 5,
          }}
        >
          <strong
            style={{
              fontSize: 12,
            }}
          >
            {empresa.dados.razaoSocial ||
              empresa.dados.razao_social ||
              empresa.dados.nome ||
              "Empresa localizada"}
          </strong>

          <div
            style={{
              color: MUTED,
              fontSize: 10,
            }}
          >
            CNPJ:{" "}
            {formatarCnpj(
              empresa.dados.cnpj ||
              empresa.cnpj
            )}
          </div>

          <div
            style={{
              color: MUTED,
              fontSize: 10,
            }}
          >
            CNAE principal:{" "}
            {empresa.dados.cnaePrincipal?.descricao ||
              empresa.dados.cnae_principal?.descricao ||
              empresa.dados.cnaeFiscalDescricao ||
              empresa.dados.atividadePrincipal ||
              "-"}
          </div>

          <div
            style={{
              color: MUTED,
              fontSize: 10,
            }}
          >
            Município/UF:{" "}
            {[
              empresa.dados.municipio,
              empresa.dados.uf,
            ]
              .filter(Boolean)
              .join(" / ") ||
              "-"}
          </div>
        </div>
      )}
    </Card>
  );
}

function UploadDocumentos({
  arquivos,
  setArquivos,
}) {
  function adicionarArquivos(
    lista
  ) {
    const novos =
      Array.from(
        lista || []
      );

    if (!novos.length) {
      return;
    }

    setArquivos(
      (atuais) => [
        ...atuais,
        ...novos,
      ]
    );
  }

  return (
    <Card>
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          gap: 12,
          alignItems:
            "flex-start",
          marginBottom: 12,
        }}
      >
        <div>
          <strong
            style={{
              fontSize: 14,
            }}
          >
            Documentos
          </strong>

          <div
            style={{
              color: MUTED,
              fontSize: 10,
              marginTop: 4,
              lineHeight: 1.5,
            }}
          >
            DRE, balancetes, PGDAS-D, ECF, ECD, SPED, XML, notas fiscais, folha, planilhas e demais arquivos tributários.
          </div>
        </div>

        <span
          style={{
            background:
              "#EEF3FF",
            color: "#31589C",
            borderRadius: 999,
            padding: "5px 8px",
            fontSize: 9,
            fontWeight: 900,
          }}
        >
          {arquivos.length} arquivo(s)
        </span>
      </div>

      <label
        style={{
          minHeight: 110,
          border:
            "2px dashed #C9D1DF",
          borderRadius: 14,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          padding: 18,
          cursor: "pointer",
          background:
            "#FBFCFE",
        }}
      >
        <div>
          <strong
            style={{
              display: "block",
              fontSize: 12,
            }}
          >
            Clique para selecionar arquivos
          </strong>

          <span
            style={{
              display: "block",
              color: MUTED,
              fontSize: 9.5,
              marginTop: 4,
            }}
          >
            Nesta V1 os arquivos ficam preparados na interface. Persistência e análise IA entram na V2.
          </span>
        </div>

        <input
          type="file"
          multiple
          accept=".pdf,.xml,.xlsx,.xls,.csv,.txt,.json,.docx,.zip"
          onChange={(e) =>
            adicionarArquivos(
              e.target.files
            )
          }
          style={{
            display: "none",
          }}
        />
      </label>

      {!!arquivos.length && (
        <div
          style={{
            marginTop: 10,
            display: "grid",
            gap: 6,
          }}
        >
          {arquivos.map(
            (arquivo, index) => (
              <div
                key={`${arquivo.name}-${index}`}
                style={{
                  border:
                    "1px solid #E3E7EF",
                  borderRadius: 9,
                  padding: 9,
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div>
                  <strong
                    style={{
                      fontSize: 10,
                    }}
                  >
                    {arquivo.name}
                  </strong>

                  <div
                    style={{
                      color: MUTED,
                      fontSize: 8.5,
                      marginTop: 2,
                    }}
                  >
                    {(
                      arquivo.size /
                      1024 /
                      1024
                    ).toFixed(2)}{" "}
                    MB
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setArquivos(
                      (atuais) =>
                        atuais.filter(
                          (_, i) =>
                            i !== index
                        )
                    )
                  }
                  style={{
                    border: 0,
                    background:
                      "transparent",
                    color:
                      "#A12B2B",
                    cursor: "pointer",
                    fontWeight: 900,
                    fontSize: 10,
                  }}
                >
                  Remover
                </button>
              </div>
            )
          )}
        </div>
      )}
    </Card>
  );
}

function DadosManuais({
  dados,
  setDados,
  tipoProjeto,
}) {
  function alterar(
    campo,
    valor
  ) {
    setDados(
      (atual) => ({
        ...atual,
        [campo]: valor,
      })
    );
  }

  const campos = [
    [
      "regimeAtual",
      "Regime tributário atual",
      "text",
      "Ex.: Simples Nacional",
    ],
    [
      "faturamento12m",
      "Faturamento últimos 12 meses",
      "number",
      "0,00",
    ],
    [
      "folha12m",
      "Folha + pró-labore 12 meses",
      "number",
      "0,00",
    ],
    [
      "compras12m",
      "Compras / insumos 12 meses",
      "number",
      "0,00",
    ],
    [
      "despesasDedutiveis",
      "Despesas dedutíveis estimadas",
      "number",
      "0,00",
    ],
    [
      "percentualB2B",
      "% vendas B2B",
      "number",
      "0",
    ],
    [
      "percentualB2C",
      "% vendas B2C",
      "number",
      "0",
    ],
    [
      "margemOperacional",
      "Margem operacional estimada (%)",
      "number",
      "0",
    ],
  ];

  if (
    tipoProjeto ===
    "reforma"
  ) {
    campos.push(
      [
        "creditosPotenciais",
        "Compras/despesas potencialmente geradoras de créditos",
        "number",
        "0,00",
      ],
      [
        "receitasReducao",
        "Receitas com redução/benefício estimadas",
        "number",
        "0,00",
      ]
    );
  }

  return (
    <Card>
      <strong
        style={{
          fontSize: 14,
        }}
      >
        Preenchimento manual
      </strong>

      <div
        style={{
          color: MUTED,
          fontSize: 10,
          marginTop: 4,
          marginBottom: 12,
        }}
      >
        Complete ou confirme os números utilizados na análise.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",
          gap: 10,
        }}
      >
        {campos.map(
          ([
            campo,
            label,
            type,
            placeholder,
          ]) => (
            <label
              key={campo}
            >
              <span
                style={{
                  display: "block",
                  fontSize: 9.5,
                  fontWeight: 900,
                  marginBottom: 5,
                }}
              >
                {label}
              </span>

              <input
                type={type}
                value={
                  dados[campo] ||
                  ""
                }
                onChange={(e) =>
                  alterar(
                    campo,
                    e.target.value
                  )
                }
                placeholder={
                  placeholder
                }
                style={inputStyle()}
              />
            </label>
          )
        )}
      </div>

      <label
        style={{
          display: "block",
          marginTop: 10,
        }}
      >
        <span
          style={{
            display: "block",
            fontSize: 9.5,
            fontWeight: 900,
            marginBottom: 5,
          }}
        >
          Observações / premissas
        </span>

        <textarea
          rows={4}
          value={
            dados.observacoes ||
            ""
          }
          onChange={(e) =>
            alterar(
              "observacoes",
              e.target.value
            )
          }
          placeholder="Explique particularidades da operação, receitas, benefícios, retenções, créditos, sazonalidade ou premissas."
          style={{
            ...inputStyle(),
            resize: "vertical",
            fontFamily: BODY_FONT,
          }}
        />
      </label>
    </Card>
  );
}

export default function Tributario({
  token,
}) {
  const [
    tela,
    setTela,
  ] = useState("inicio");

  const [
    tipoProjeto,
    setTipoProjeto,
  ] = useState("");

  const [
    estrutura,
    setEstrutura,
  ] = useState("empresa");

  const [
    modalidade,
    setModalidade,
  ] = useState("hibrido");

  const [
    empresas,
    setEmpresas,
  ] = useState([
    novaEmpresa(),
  ]);

  const [
    arquivos,
    setArquivos,
  ] = useState([]);

  const [
    dadosManuais,
    setDadosManuais,
  ] = useState({});

  const [
    dadosProjeto,
    setDadosProjeto,
  ] = useState({
    responsavelFinder: "",
    origemCliente: "",
    contatoNome: "",
    contatoEmail: "",
    contatoTelefone: "",
    observacaoOrigem: "",
  });

  const [
    historicoProjeto,
    setHistoricoProjeto,
  ] = useState([]);

  const [
    projetoId,
    setProjetoId,
  ] = useState(() => {
    try {
      return (
        crypto?.randomUUID?.() ||
        `tax_${Date.now()}_${Math.random()}`
      );
    } catch {
      return `tax_${Date.now()}_${Math.random()}`;
    }
  });

  const [
    abaAnalise,
    setAbaAnalise,
  ] = useState("resumo");

  const [
    erro,
    setErro,
  ] = useState("");

  const empresasConsultadas =
    useMemo(
      () =>
        empresas.filter(
          (e) =>
            e.dados
        ).length,
      [empresas]
    );

  function formatarDataHora(
    valor
  ) {
    try {
      return new Date(
        valor
      ).toLocaleString(
        "pt-BR",
        {
          dateStyle: "short",
          timeStyle: "short",
        }
      );
    } catch {
      return String(
        valor || "-"
      );
    }
  }

  function registrarHistorico(
    tipo,
    descricao,
    detalhes = {}
  ) {
    const evento = {
      id:
        crypto?.randomUUID?.() ||
        `${Date.now()}_${Math.random()}`,
      tipo,
      descricao,
      detalhes,
      criadoEm:
        new Date().toISOString(),
    };

    setHistoricoProjeto(
      (atuais) => {
        const novos = [
          evento,
          ...atuais,
        ];

        try {
          localStorage.setItem(
            `finder_tax_history_${projetoId}`,
            JSON.stringify(
              novos
            )
          );
        } catch {}

        return novos;
      }
    );
  }

  function alterarDadosProjeto(
    campo,
    valor
  ) {
    setDadosProjeto(
      (atual) => ({
        ...atual,
        [campo]: valor,
      })
    );
  }

  function escolherProjeto(
    tipo
  ) {
    setTipoProjeto(tipo);

    registrarHistorico(
      "PROJETO_CRIADO",
      tipo === "reforma"
        ? "Nova análise de Reforma Tributária iniciada."
        : "Novo Planejamento Tributário iniciado.",
      {
        tipoProjeto: tipo,
      }
    );

    setTela(
      "configuracao"
    );
  }

  function alterarEmpresa(
    id,
    patch
  ) {
    setEmpresas(
      (atuais) =>
        atuais.map(
          (empresa) =>
            empresa.id === id
              ? {
                  ...empresa,
                  ...patch,
                }
              : empresa
        )
    );
  }

  async function buscarCnpj(
    empresa
  ) {
    const digits =
      somenteDigitos(
        empresa.cnpj
      );

    if (
      digits.length !== 14
    ) {
      alterarEmpresa(
        empresa.id,
        {
          erro:
            "Informe um CNPJ com 14 dígitos.",
        }
      );

      return;
    }

    alterarEmpresa(
      empresa.id,
      {
        carregando: true,
        erro: "",
      }
    );

    try {
      const resposta =
        await fetch(
          `/api/cnpj?cnpj=${encodeURIComponent(
            digits
          )}`,
          {
            headers:
              token
                ? {
                    Authorization:
                      `Bearer ${token}`,
                  }
                : {},
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
        !data
      ) {
        throw new Error(
          data?.error ||
          "Não foi possível consultar o CNPJ."
        );
      }

      const dados =
        data.empresa ||
        data.dados ||
        data;

      alterarEmpresa(
        empresa.id,
        {
          cnpj:
            formatarCnpj(
              digits
            ),
          dados,
          erro: "",
        }
      );

      registrarHistorico(
        "CNPJ_CONSULTADO",
        `CNPJ ${formatarCnpj(digits)} consultado com sucesso.`,
        {
          cnpj:
            formatarCnpj(
              digits
            ),
          razaoSocial:
            dados.razaoSocial ||
            dados.razao_social ||
            dados.nome ||
            "",
        }
      );
    } catch (error) {
      alterarEmpresa(
        empresa.id,
        {
          erro:
            error?.message ||
            "Erro ao consultar CNPJ.",
        }
      );
    } finally {
      alterarEmpresa(
        empresa.id,
        {
          carregando: false,
        }
      );
    }
  }

  function continuarParaDados() {
    if (
      !dadosProjeto.responsavelFinder.trim()
    ) {
      setErro(
        "Informe o responsável Finder pelo cliente."
      );
      return;
    }

    if (
      !dadosProjeto.origemCliente
    ) {
      setErro(
        "Informe de onde veio o cliente."
      );
      return;
    }

    if (
      !empresasConsultadas
    ) {
      setErro(
        "Consulte pelo menos um CNPJ antes de continuar."
      );
      return;
    }

    registrarHistorico(
      "IDENTIFICACAO_CONFIRMADA",
      "Responsável, origem e empresas confirmados.",
      {
        responsavelFinder:
          dadosProjeto.responsavelFinder,
        origemCliente:
          dadosProjeto.origemCliente,
        observacaoOrigem:
          dadosProjeto.observacaoOrigem,
        empresas:
          empresasConsultadas,
      }
    );

    setErro("");
    setTela(
      "dados"
    );
  }

  function continuarParaAnalise() {
    const precisaDocumento =
      modalidade === "documentos" ||
      modalidade === "hibrido";

    const precisaManual =
      modalidade === "manual" ||
      modalidade === "hibrido";

    if (
      precisaDocumento &&
      arquivos.length === 0
    ) {
      setErro(
        "Selecione pelo menos um documento para continuar."
      );
      return;
    }

    if (
      precisaManual
    ) {
      const temDadoManual =
        Object.values(
          dadosManuais || {}
        ).some(
          (valor) =>
            String(
              valor ?? ""
            ).trim() !== ""
        );

      if (!temDadoManual) {
        setErro(
          "Preencha pelo menos um dado manual para continuar."
        );
        return;
      }
    }

    registrarHistorico(
      "BASE_REVISADA",
      "Base documental/manual enviada para revisão.",
      {
        modalidade,
        documentos:
          arquivos.length,
        empresas:
          empresasConsultadas,
      }
    );

    setErro("");
    setTela(
      "revisao"
    );
  }

  if (
    tela ===
    "inicio"
  ) {
    return (
      <div
        style={{
          fontFamily:
            BODY_FONT,
          color: NAVY,
        }}
      >
        <div
          style={{
            background:
              "linear-gradient(135deg,#0E1A33,#17233D)",
            color: WHITE,
            borderRadius: 22,
            padding: 24,
            marginBottom: 18,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              color:
                "#FFB7A7",
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: 1.3,
            }}
          >
            FINDER TAX INTELLIGENCE
          </div>

          <h2
            style={{
              margin:
                "7px 0 6px",
              fontFamily:
                DISPLAY_FONT,
              fontSize: 28,
            }}
          >
            Inteligência Tributária
          </h2>

          <p
            style={{
              margin: 0,
              maxWidth: 760,
              color:
                "#D8DEEA",
              fontSize: 11,
              lineHeight: 1.55,
            }}
          >
            Um módulo independente para analisar Reforma Tributária e Planejamento Tributário a partir de documentos, dados manuais ou das duas fontes juntas.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(300px,1fr))",
            gap: 14,
          }}
        >
          <Card
            style={{
              borderTop:
                `4px solid ${CORAL}`,
            }}
          >
            <div
              style={{
                color: CORAL,
                fontSize: 9,
                fontWeight: 900,
                marginBottom: 8,
              }}
            >
              REFORMA TRIBUTÁRIA
            </div>

            <h3
              style={{
                margin: 0,
                fontFamily:
                  DISPLAY_FONT,
                fontSize: 22,
              }}
            >
              IBS, CBS e transição
            </h3>

            <p
              style={{
                color: MUTED,
                fontSize: 10.5,
                lineHeight: 1.55,
                minHeight: 66,
              }}
            >
              Impactos por empresa ou grupo, créditos, perfil B2B/B2C, precificação, transição e pontos de atenção.
            </p>

            <Botao
              onClick={() =>
                escolherProjeto(
                  "reforma"
                )
              }
            >
              Nova análise de Reforma
            </Botao>
          </Card>

          <Card
            style={{
              borderTop:
                "4px solid #31589C",
            }}
          >
            <div
              style={{
                color:
                  "#31589C",
                fontSize: 9,
                fontWeight: 900,
                marginBottom: 8,
              }}
            >
              PLANEJAMENTO TRIBUTÁRIO
            </div>

            <h3
              style={{
                margin: 0,
                fontFamily:
                  DISPLAY_FONT,
                fontSize: 22,
              }}
            >
              Regime e eficiência tributária
            </h3>

            <p
              style={{
                color: MUTED,
                fontSize: 10.5,
                lineHeight: 1.55,
                minHeight: 66,
              }}
            >
              Base para comparar Simples Nacional, Lucro Presumido e Lucro Real usando dados reais da operação.
            </p>

            <Botao
              onClick={() =>
                escolherProjeto(
                  "planejamento"
                )
              }
              style={{
                background:
                  "#31589C",
              }}
            >
              Novo planejamento
            </Botao>
          </Card>
        </div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(180px,1fr))",
            gap: 10,
          }}
        >
          {[
            [
              "1",
              "Consultar CNPJ",
              "Empresa única ou várias empresas.",
            ],
            [
              "2",
              "Escolher a fonte",
              "Documentos, manual ou híbrido.",
            ],
            [
              "3",
              "Conferir os dados",
              "IA extrairá e o consultor validará.",
            ],
            [
              "4",
              "Calcular e interpretar",
              "Motor matemático + diagnóstico IA.",
            ],
          ].map(
            ([
              numero,
              titulo,
              texto,
            ]) => (
              <Card
                key={numero}
                style={{
                  padding: 13,
                }}
              >
                <div
                  style={{
                    color: CORAL,
                    fontWeight: 900,
                    fontSize: 18,
                  }}
                >
                  {numero}
                </div>

                <strong
                  style={{
                    display: "block",
                    marginTop: 4,
                    fontSize: 11,
                  }}
                >
                  {titulo}
                </strong>

                <div
                  style={{
                    color: MUTED,
                    fontSize: 9,
                    marginTop: 3,
                    lineHeight: 1.45,
                  }}
                >
                  {texto}
                </div>
              </Card>
            )
          )}
        </div>
      </div>
    );
  }

  if (
    tela ===
    "configuracao"
  ) {
    return (
      <div
        style={{
          fontFamily:
            BODY_FONT,
          color: NAVY,
        }}
      >
        <button
          type="button"
          onClick={() =>
            setTela(
              "inicio"
            )
          }
          style={{
            border: 0,
            background:
              "transparent",
            color: MUTED,
            cursor: "pointer",
            fontWeight: 800,
            marginBottom: 12,
          }}
        >
          ← Voltar
        </button>

        <div
          style={{
            marginBottom: 18,
          }}
        >
          <div
            style={{
              color:
                tipoProjeto ===
                "reforma"
                  ? CORAL
                  : "#31589C",
              fontSize: 9,
              fontWeight: 900,
            }}
          >
            {tipoProjeto ===
            "reforma"
              ? "REFORMA TRIBUTÁRIA"
              : "PLANEJAMENTO TRIBUTÁRIO"}
          </div>

          <h2
            style={{
              margin:
                "4px 0 4px",
              fontFamily:
                DISPLAY_FONT,
            }}
          >
            Novo projeto tributário
          </h2>

          <div
            style={{
              color: MUTED,
              fontSize: 10.5,
            }}
          >
            Primeiro identifique a empresa ou o grupo que será analisado.
          </div>
        </div>

        <Card
          style={{
            marginBottom: 14,
          }}
        >
          <strong
            style={{
              display: "block",
              marginBottom: 10,
            }}
          >
            Estrutura da análise
          </strong>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2,minmax(0,1fr))",
              gap: 10,
            }}
          >
            <ModalidadeCard
              ativa={
                estrutura ===
                "empresa"
              }
              titulo="Empresa única"
              descricao="Planejamento ou Reforma para um único CNPJ."
              onClick={() => {
                setEstrutura(
                  "empresa"
                );

                setEmpresas(
                  (atuais) => [
                    atuais[0] ||
                    novaEmpresa(),
                  ]
                );
              }}
            />

            <ModalidadeCard
              ativa={
                estrutura ===
                "grupo"
              }
              titulo="Grupo de empresas"
              descricao="Analise vários CNPJs individualmente e prepare visão consolidada."
              onClick={() =>
                setEstrutura(
                  "grupo"
                )
              }
            />
          </div>
        </Card>

        <Card
          style={{
            marginBottom: 14,
            borderTop:
              "4px solid #31589C",
          }}
        >
          <strong
            style={{
              display: "block",
              marginBottom: 4,
            }}
          >
            Identificação do cliente
          </strong>

          <div
            style={{
              color: MUTED,
              fontSize: 10,
              marginBottom: 12,
            }}
          >
            Registre quem é o responsável pelo relacionamento e de onde este cliente veio.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(220px,1fr))",
              gap: 10,
            }}
          >
            <label>
              <span
                style={{
                  display: "block",
                  fontSize: 9.5,
                  fontWeight: 900,
                  marginBottom: 5,
                }}
              >
                RESPONSÁVEL FINDER
              </span>

              <input
                value={
                  dadosProjeto.responsavelFinder
                }
                onChange={(e) =>
                  alterarDadosProjeto(
                    "responsavelFinder",
                    e.target.value
                  )
                }
                placeholder="Ex.: Diones"
                style={inputStyle()}
              />
            </label>

            <label>
              <span
                style={{
                  display: "block",
                  fontSize: 9.5,
                  fontWeight: 900,
                  marginBottom: 5,
                }}
              >
                ORIGEM DO CLIENTE
              </span>

              <select
                value={
                  dadosProjeto.origemCliente
                }
                onChange={(e) =>
                  alterarDadosProjeto(
                    "origemCliente",
                    e.target.value
                  )
                }
                style={inputStyle()}
              >
                <option value="">
                  Selecione
                </option>
                <option value="INDICACAO">
                  Indicação
                </option>
                <option value="EVENTO">
                  Evento
                </option>
                <option value="INSTAGRAM">
                  Instagram
                </option>
                <option value="SITE">
                  Site
                </option>
                <option value="WHATSAPP">
                  WhatsApp
                </option>
                <option value="CLIENTE_BASE">
                  Cliente da base
                </option>
                <option value="PARCEIRO">
                  Parceiro
                </option>
                <option value="PROSPECCAO_ATIVA">
                  Prospecção ativa
                </option>
                <option value="OUTRO">
                  Outro
                </option>
              </select>
            </label>

            <label>
              <span
                style={{
                  display: "block",
                  fontSize: 9.5,
                  fontWeight: 900,
                  marginBottom: 5,
                }}
              >
                CONTATO DO CLIENTE
              </span>

              <input
                value={
                  dadosProjeto.contatoNome
                }
                onChange={(e) =>
                  alterarDadosProjeto(
                    "contatoNome",
                    e.target.value
                  )
                }
                placeholder="Nome do contato"
                style={inputStyle()}
              />
            </label>

            <label>
              <span
                style={{
                  display: "block",
                  fontSize: 9.5,
                  fontWeight: 900,
                  marginBottom: 5,
                }}
              >
                E-MAIL
              </span>

              <input
                type="email"
                value={
                  dadosProjeto.contatoEmail
                }
                onChange={(e) =>
                  alterarDadosProjeto(
                    "contatoEmail",
                    e.target.value
                  )
                }
                placeholder="cliente@empresa.com"
                style={inputStyle()}
              />
            </label>

            <label>
              <span
                style={{
                  display: "block",
                  fontSize: 9.5,
                  fontWeight: 900,
                  marginBottom: 5,
                }}
              >
                TELEFONE
              </span>

              <input
                value={
                  dadosProjeto.contatoTelefone
                }
                onChange={(e) =>
                  alterarDadosProjeto(
                    "contatoTelefone",
                    e.target.value
                  )
                }
                placeholder="(41) 99999-9999"
                style={inputStyle()}
              />
            </label>

            <label>
              <span
                style={{
                  display: "block",
                  fontSize: 9.5,
                  fontWeight: 900,
                  marginBottom: 5,
                }}
              >
                DETALHE DA ORIGEM
              </span>

              <input
                value={
                  dadosProjeto.observacaoOrigem
                }
                onChange={(e) =>
                  alterarDadosProjeto(
                    "observacaoOrigem",
                    e.target.value
                  )
                }
                placeholder="Ex.: Feira do Empreendedor 2026"
                style={inputStyle()}
              />
            </label>
          </div>
        </Card>

        <div
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          {empresas.map(
            (empresa, index) => (
              <EmpresaCard
                key={empresa.id}
                empresa={empresa}
                index={index}
                onChangeCnpj={(valor) =>
                  alterarEmpresa(
                    empresa.id,
                    {
                      cnpj: valor,
                      dados: null,
                      erro: "",
                    }
                  )
                }
                onBuscar={() =>
                  buscarCnpj(
                    empresa
                  )
                }
                podeRemover={
                  estrutura ===
                    "grupo" &&
                  empresas.length >
                    1
                }
                onRemover={() =>
                  setEmpresas(
                    (atuais) =>
                      atuais.filter(
                        (item) =>
                          item.id !==
                          empresa.id
                      )
                  )
                }
              />
            )
          )}
        </div>

        {estrutura ===
          "grupo" && (
          <Botao
            secundario
            onClick={() =>
              setEmpresas(
                (atuais) => [
                  ...atuais,
                  novaEmpresa(),
                ]
              )
            }
            style={{
              marginTop: 10,
            }}
          >
            + Adicionar empresa
          </Botao>
        )}

        {erro && (
          <div
            style={{
              marginTop: 12,
              background:
                "#FAECE7",
              color: "#993C1D",
              borderRadius: 10,
              padding: 10,
              fontSize: 10.5,
            }}
          >
            {erro}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent:
              "flex-end",
            marginTop: 16,
          }}
        >
          <Botao
            onClick={
              continuarParaDados
            }
          >
            Continuar →
          </Botao>
        </div>
      </div>
    );
  }

  if (
    tela ===
    "revisao"
  ) {
    return (
      <div
        style={{
          fontFamily:
            BODY_FONT,
          color: NAVY,
        }}
      >
        <button
          type="button"
          onClick={() =>
            setTela(
              "dados"
            )
          }
          style={{
            border: 0,
            background:
              "transparent",
            color: MUTED,
            cursor: "pointer",
            fontWeight: 800,
            marginBottom: 12,
          }}
        >
          ← Voltar aos dados
        </button>

        <div
          style={{
            marginBottom: 16,
          }}
        >
          <div
            style={{
              color:
                tipoProjeto ===
                "reforma"
                  ? CORAL
                  : "#31589C",
              fontSize: 9,
              fontWeight: 900,
            }}
          >
            {tipoProjeto ===
            "reforma"
              ? "REFORMA TRIBUTÁRIA"
              : "PLANEJAMENTO TRIBUTÁRIO"}
          </div>

          <h2
            style={{
              margin:
                "4px 0 5px",
              fontFamily:
                DISPLAY_FONT,
            }}
          >
            Revisão da base
          </h2>

          <div
            style={{
              color: MUTED,
              fontSize: 10.5,
            }}
          >
            Confira o que foi selecionado antes de iniciar a análise tributária.
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(220px,1fr))",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <Card>
            <div
              style={{
                color: MUTED,
                fontSize: 9,
                fontWeight: 900,
              }}
            >
              EMPRESAS
            </div>

            <div
              style={{
                fontSize: 26,
                fontWeight: 900,
                marginTop: 4,
              }}
            >
              {empresasConsultadas}
            </div>
          </Card>

          <Card>
            <div
              style={{
                color: MUTED,
                fontSize: 9,
                fontWeight: 900,
              }}
            >
              DOCUMENTOS
            </div>

            <div
              style={{
                fontSize: 26,
                fontWeight: 900,
                marginTop: 4,
              }}
            >
              {arquivos.length}
            </div>
          </Card>

          <Card>
            <div
              style={{
                color: MUTED,
                fontSize: 9,
                fontWeight: 900,
              }}
            >
              MODALIDADE
            </div>

            <div
              style={{
                fontSize: 15,
                fontWeight: 900,
                marginTop: 8,
              }}
            >
              {modalidade === "hibrido"
                ? "Híbrido"
                : modalidade === "manual"
                ? "Manual"
                : "Documentos"}
            </div>
          </Card>
        </div>

        <Card
          style={{
            marginBottom: 14,
          }}
        >
          <strong
            style={{
              display: "block",
              marginBottom: 10,
            }}
          >
            Empresas da análise
          </strong>

          <div
            style={{
              display: "grid",
              gap: 8,
            }}
          >
            {empresas
              .filter(
                (empresa) =>
                  empresa.dados
              )
              .map(
                (
                  empresa,
                  index
                ) => (
                  <div
                    key={
                      empresa.id
                    }
                    style={{
                      border:
                        "1px solid #E3E7EF",
                      borderRadius: 10,
                      padding: 10,
                    }}
                  >
                    <strong
                      style={{
                        fontSize: 11,
                      }}
                    >
                      {index + 1}.{" "}
                      {empresa.dados.razaoSocial ||
                        empresa.dados.razao_social ||
                        empresa.dados.nome ||
                        "Empresa"}
                    </strong>

                    <div
                      style={{
                        color: MUTED,
                        fontSize: 9.5,
                        marginTop: 4,
                      }}
                    >
                      {formatarCnpj(
                        empresa.dados.cnpj ||
                        empresa.cnpj
                      )}
                    </div>
                  </div>
                )
              )}
          </div>
        </Card>

        {!!arquivos.length && (
          <Card
            style={{
              marginBottom: 14,
            }}
          >
            <strong
              style={{
                display: "block",
                marginBottom: 10,
              }}
            >
              Documentos selecionados
            </strong>

            <div
              style={{
                display: "grid",
                gap: 6,
              }}
            >
              {arquivos.map(
                (
                  arquivo,
                  index
                ) => (
                  <div
                    key={`${arquivo.name}-${index}`}
                    style={{
                      background:
                        "#F7F8FB",
                      borderRadius: 8,
                      padding: 9,
                      fontSize: 10,
                    }}
                  >
                    {arquivo.name}
                  </div>
                )
              )}
            </div>
          </Card>
        )}

        <Card
          style={{
            border:
              "1px solid #F2C5B8",
            background:
              "#FFF9F7",
          }}
        >
          <div
            style={{
              fontSize: 9,
              color: CORAL,
              fontWeight: 900,
            }}
          >
            BASE PRONTA
          </div>

          <h3
            style={{
              margin:
                "6px 0 5px",
              fontFamily:
                DISPLAY_FONT,
            }}
          >
            Próximo passo: análise por IA
          </h3>

          <div
            style={{
              color: MUTED,
              fontSize: 10.5,
              lineHeight: 1.55,
            }}
          >
            A seleção agora pode avançar normalmente. Na próxima versão, este botão enviará os documentos ao banco próprio do módulo e iniciará a extração e conferência pela IA.
          </div>

          <Botao
            onClick={() => {
              registrarHistorico(
                "ANALISE_INICIADA",
                "Projeto encaminhado para a etapa de análise tributária.",
                {
                  tipoProjeto,
                  modalidade,
                  documentos:
                    arquivos.length,
                }
              );

              setTela(
                "analise"
              );
            }}
            style={{
              marginTop: 12,
            }}
          >
            Iniciar análise tributária →
          </Botao>
        </Card>
      </div>
    );
  }

  if (
    tela ===
    "analise"
  ) {
    const empresaPrincipal =
      empresas.find(
        (empresa) =>
          empresa.dados
      );

    const nomeEmpresa =
      empresaPrincipal?.dados?.razaoSocial ||
      empresaPrincipal?.dados?.razao_social ||
      empresaPrincipal?.dados?.nome ||
      "Cliente";

    return (
      <div
        style={{
          fontFamily: BODY_FONT,
          color: NAVY,
        }}
      >
        <button
          type="button"
          onClick={() =>
            setTela(
              "revisao"
            )
          }
          style={{
            border: 0,
            background: "transparent",
            color: MUTED,
            cursor: "pointer",
            fontWeight: 800,
            marginBottom: 12,
          }}
        >
          ← Voltar à revisão
        </button>

        <div
          style={{
            background:
              "linear-gradient(135deg,#0E1A33,#17233D)",
            color: WHITE,
            borderRadius: 18,
            padding: 20,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              color: "#FFB7A7",
              fontSize: 9,
              fontWeight: 900,
            }}
          >
            {tipoProjeto === "reforma"
              ? "REFORMA TRIBUTÁRIA"
              : "PLANEJAMENTO TRIBUTÁRIO"}
          </div>

          <h2
            style={{
              margin: "5px 0 4px",
              fontFamily: DISPLAY_FONT,
            }}
          >
            {nomeEmpresa}
          </h2>

          <div
            style={{
              color: "#D8DEEA",
              fontSize: 10.5,
            }}
          >
            Responsável Finder:{" "}
            <strong>
              {dadosProjeto.responsavelFinder ||
                "-"}
            </strong>
            {" · "}
            Origem:{" "}
            <strong>
              {dadosProjeto.origemCliente ||
                "-"}
            </strong>
            {dadosProjeto.observacaoOrigem
              ? ` · ${dadosProjeto.observacaoOrigem}`
              : ""}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 7,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          {[
            ["resumo", "Visão geral"],
            ["cliente", "Cliente / Origem"],
            [
              "historico",
              `Histórico (${historicoProjeto.length})`,
            ],
          ].map(
            ([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() =>
                  setAbaAnalise(
                    id
                  )
                }
                style={{
                  border:
                    abaAnalise === id
                      ? `1px solid ${CORAL}`
                      : "1px solid #D8DEEA",
                  background:
                    abaAnalise === id
                      ? "#FFF3EF"
                      : WHITE,
                  color:
                    abaAnalise === id
                      ? "#993C1D"
                      : NAVY,
                  borderRadius: 999,
                  padding: "8px 11px",
                  cursor: "pointer",
                  fontSize: 9.5,
                  fontWeight: 900,
                }}
              >
                {label}
              </button>
            )
          )}
        </div>

        {abaAnalise ===
          "resumo" && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(220px,1fr))",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <Card>
                <div
                  style={{
                    color: MUTED,
                    fontSize: 9,
                    fontWeight: 900,
                  }}
                >
                  EMPRESAS
                </div>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 900,
                    marginTop: 4,
                  }}
                >
                  {empresasConsultadas}
                </div>
              </Card>

              <Card>
                <div
                  style={{
                    color: MUTED,
                    fontSize: 9,
                    fontWeight: 900,
                  }}
                >
                  DOCUMENTOS
                </div>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 900,
                    marginTop: 4,
                  }}
                >
                  {arquivos.length}
                </div>
              </Card>

              <Card>
                <div
                  style={{
                    color: MUTED,
                    fontSize: 9,
                    fontWeight: 900,
                  }}
                >
                  RESPONSÁVEL
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 14,
                    fontWeight: 900,
                  }}
                >
                  {dadosProjeto.responsavelFinder ||
                    "-"}
                </div>
              </Card>

              <Card>
                <div
                  style={{
                    color: MUTED,
                    fontSize: 9,
                    fontWeight: 900,
                  }}
                >
                  ORIGEM
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 14,
                    fontWeight: 900,
                  }}
                >
                  {dadosProjeto.origemCliente ||
                    "-"}
                </div>
              </Card>
            </div>

            <Card
              style={{
                marginBottom: 14,
                borderLeft:
                  "4px solid #31589C",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: "#31589C",
                  fontWeight: 900,
                }}
              >
                BASE PRONTA
              </div>

              <h3
                style={{
                  margin: "6px 0 6px",
                  fontFamily: DISPLAY_FONT,
                }}
              >
                Projeto pronto para processamento
              </h3>

              <div
                style={{
                  color: MUTED,
                  fontSize: 10.5,
                  lineHeight: 1.55,
                }}
              >
                A empresa, os documentos, o responsável e a origem do cliente já ficam identificados nesta etapa.
              </div>
            </Card>

            <Card
              style={{
                background: "#FFF9F7",
                border:
                  "1px solid #F2C5B8",
              }}
            >
              <div
                style={{
                  color: CORAL,
                  fontSize: 9,
                  fontWeight: 900,
                }}
              >
                PRÓXIMA IMPLEMENTAÇÃO
              </div>

              <h3
                style={{
                  margin: "6px 0 6px",
                  fontFamily: DISPLAY_FONT,
                }}
              >
                Leitura real dos documentos pela IA
              </h3>

              <div
                style={{
                  color: MUTED,
                  fontSize: 10.5,
                  lineHeight: 1.55,
                }}
              >
                O próximo backend salvará o projeto, documentos, responsável, origem e histórico em banco próprio do módulo Tributário.
              </div>
            </Card>
          </>
        )}

        {abaAnalise ===
          "cliente" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(280px,1fr))",
              gap: 12,
            }}
          >
            <Card>
              <strong
                style={{
                  display: "block",
                  marginBottom: 10,
                }}
              >
                Responsabilidade interna
              </strong>

              <div
                style={{
                  display: "grid",
                  gap: 8,
                  fontSize: 10.5,
                }}
              >
                <div>
                  <span
                    style={{
                      color: MUTED,
                    }}
                  >
                    Responsável Finder
                  </span>
                  <br />
                  <strong>
                    {dadosProjeto.responsavelFinder ||
                      "-"}
                  </strong>
                </div>

                <div>
                  <span
                    style={{
                      color: MUTED,
                    }}
                  >
                    Origem
                  </span>
                  <br />
                  <strong>
                    {dadosProjeto.origemCliente ||
                      "-"}
                  </strong>
                </div>

                <div>
                  <span
                    style={{
                      color: MUTED,
                    }}
                  >
                    Detalhe da origem
                  </span>
                  <br />
                  <strong>
                    {dadosProjeto.observacaoOrigem ||
                      "-"}
                  </strong>
                </div>
              </div>
            </Card>

            <Card>
              <strong
                style={{
                  display: "block",
                  marginBottom: 10,
                }}
              >
                Contato do cliente
              </strong>

              <div
                style={{
                  display: "grid",
                  gap: 8,
                  fontSize: 10.5,
                }}
              >
                <div>
                  <span
                    style={{
                      color: MUTED,
                    }}
                  >
                    Nome
                  </span>
                  <br />
                  <strong>
                    {dadosProjeto.contatoNome ||
                      "-"}
                  </strong>
                </div>

                <div>
                  <span
                    style={{
                      color: MUTED,
                    }}
                  >
                    E-mail
                  </span>
                  <br />
                  <strong>
                    {dadosProjeto.contatoEmail ||
                      "-"}
                  </strong>
                </div>

                <div>
                  <span
                    style={{
                      color: MUTED,
                    }}
                  >
                    Telefone
                  </span>
                  <br />
                  <strong>
                    {dadosProjeto.contatoTelefone ||
                      "-"}
                  </strong>
                </div>
              </div>
            </Card>
          </div>
        )}

        {abaAnalise ===
          "historico" && (
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                gap: 10,
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div>
                <strong
                  style={{
                    fontSize: 14,
                  }}
                >
                  Histórico do projeto
                </strong>

                <div
                  style={{
                    color: MUTED,
                    fontSize: 9.5,
                    marginTop: 3,
                  }}
                >
                  Linha do tempo das principais ações realizadas neste planejamento.
                </div>
              </div>

              <span
                style={{
                  background:
                    "#EEF3FF",
                  color: "#31589C",
                  borderRadius: 999,
                  padding: "5px 8px",
                  fontSize: 9,
                  fontWeight: 900,
                }}
              >
                {historicoProjeto.length} evento(s)
              </span>
            </div>

            {!historicoProjeto.length ? (
              <div
                style={{
                  color: MUTED,
                  fontSize: 10,
                }}
              >
                Nenhum evento registrado ainda.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 8,
                }}
              >
                {historicoProjeto.map(
                  (evento) => (
                    <div
                      key={
                        evento.id
                      }
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "135px minmax(0,1fr)",
                        gap: 10,
                        border:
                          "1px solid #E3E7EF",
                        borderRadius: 10,
                        padding: 10,
                      }}
                    >
                      <div
                        style={{
                          color: MUTED,
                          fontSize: 9,
                        }}
                      >
                        {formatarDataHora(
                          evento.criadoEm
                        )}
                      </div>

                      <div>
                        <strong
                          style={{
                            display: "block",
                            fontSize: 10.5,
                          }}
                        >
                          {evento.descricao}
                        </strong>

                        <div
                          style={{
                            color: "#31589C",
                            fontSize: 8.5,
                            fontWeight: 900,
                            marginTop: 3,
                          }}
                        >
                          {evento.tipo}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily:
          BODY_FONT,
        color: NAVY,
      }}
    >
      <button
        type="button"
        onClick={() =>
          setTela(
            "configuracao"
          )
        }
        style={{
          border: 0,
          background:
            "transparent",
          color: MUTED,
          cursor: "pointer",
          fontWeight: 800,
          marginBottom: 12,
        }}
      >
        ← Voltar às empresas
      </button>

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "flex-start",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              color:
                tipoProjeto ===
                "reforma"
                  ? CORAL
                  : "#31589C",
              fontSize: 9,
              fontWeight: 900,
            }}
          >
            {tipoProjeto ===
            "reforma"
              ? "REFORMA TRIBUTÁRIA"
              : "PLANEJAMENTO TRIBUTÁRIO"}
          </div>

          <h2
            style={{
              margin:
                "4px 0",
              fontFamily:
                DISPLAY_FONT,
            }}
          >
            Base da análise
          </h2>

          <div
            style={{
              color: MUTED,
              fontSize: 10.5,
            }}
          >
            {empresasConsultadas} empresa(s) identificada(s).
          </div>
        </div>
      </div>

      <Card
        style={{
          marginBottom: 14,
        }}
      >
        <strong
          style={{
            display: "block",
            marginBottom: 10,
          }}
        >
          Como deseja fornecer os dados?
        </strong>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(220px,1fr))",
            gap: 10,
          }}
        >
          <ModalidadeCard
            ativa={
              modalidade ===
              "documentos"
            }
            titulo="Documentos"
            descricao="A base será formada principalmente pelos arquivos enviados."
            onClick={() =>
              setModalidade(
                "documentos"
              )
            }
          />

          <ModalidadeCard
            ativa={
              modalidade ===
              "manual"
            }
            titulo="Preenchimento manual"
            descricao="O consultor informa os dados diretamente no sistema."
            onClick={() =>
              setModalidade(
                "manual"
              )
            }
          />

          <ModalidadeCard
            ativa={
              modalidade ===
              "hibrido"
            }
            titulo="Híbrido"
            descricao="Documentos + preenchimento manual + conferência do consultor."
            destaque
            onClick={() =>
              setModalidade(
                "hibrido"
              )
            }
          />
        </div>
      </Card>

      <div
        style={{
          display: "grid",
          gap: 14,
        }}
      >
        {(modalidade ===
          "documentos" ||
          modalidade ===
            "hibrido") && (
          <UploadDocumentos
            arquivos={
              arquivos
            }
            setArquivos={
              setArquivos
            }
          />
        )}

        {(modalidade ===
          "manual" ||
          modalidade ===
            "hibrido") && (
          <DadosManuais
            dados={
              dadosManuais
            }
            setDados={
              setDadosManuais
            }
            tipoProjeto={
              tipoProjeto
            }
          />
        )}

        {erro && (
          <div
            style={{
              background: "#FAECE7",
              color: "#993C1D",
              borderRadius: 10,
              padding: 10,
              fontSize: 10.5,
            }}
          >
            {erro}
          </div>
        )}

        <Card
          style={{
            border:
              "1px solid #C9D5F5",
            background:
              "#F8FAFF",
          }}
        >
          <div
            style={{
              fontSize: 9,
              color:
                "#31589C",
              fontWeight: 900,
            }}
          >
            PRÓXIMA ETAPA
          </div>

          <h3
            style={{
              margin:
                "6px 0 5px",
              fontFamily:
                DISPLAY_FONT,
            }}
          >
            Revisar base antes da análise
          </h3>

          <div
            style={{
              color: MUTED,
              fontSize: 10.5,
              lineHeight: 1.55,
            }}
          >
            Continue para conferir empresas, documentos e dados manuais que formarão a base do diagnóstico tributário.
          </div>

          <Botao
            onClick={
              continuarParaAnalise
            }
            style={{
              marginTop: 12,
              background:
                "#31589C",
            }}
          >
            Continuar para análise →
          </Botao>
        </Card>
      </div>
    </div>
  );
}
