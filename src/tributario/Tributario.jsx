import PlanejamentoTributario from "./PlanejamentoTributario";
import {
  useEffect,
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
    atividadesSelecionadas,
    setAtividadesSelecionadas,
  ] = useState([]);

  const [
    atividadePrincipalSelecionada,
    setAtividadePrincipalSelecionada,
  ] = useState("");

  const [
    descricaoAtividadeCliente,
    setDescricaoAtividadeCliente,
  ] = useState("");

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
    diagnosticoGerado,
    setDiagnosticoGerado,
  ] = useState(null);

  const [
    gerandoDiagnostico,
    setGerandoDiagnostico,
  ] = useState(false);

  const [
    diagnosticoOrigem,
    setDiagnosticoOrigem,
  ] = useState("");

  const [
    arquivosProcessadosIa,
    setArquivosProcessadosIa,
  ] = useState([]);

  const [
    progressoIa,
    setProgressoIa,
  ] = useState({
    etapa: "",
    atual: 0,
    total: 0,
    mensagem: "",
  });

  const [
    projetosSalvos,
    setProjetosSalvos,
  ] = useState([]);

  const [
    carregandoProjetos,
    setCarregandoProjetos,
  ] = useState(false);

  const [
    projetoAberto,
    setProjetoAberto,
  ] = useState(null);

  const [
    filtroHistorico,
    setFiltroHistorico,
  ] = useState({
    busca: "",
    tipo: "",
    responsavel: "",
    status: "",
    arquivamento: "ATIVOS",
  });

  const [
    versaoDiagnostico,
    setVersaoDiagnostico,
  ] = useState(null);

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

  async function apiTributarioJson(
    action,
    {
      method = "GET",
      body = null,
      query = {},
    } = {}
  ) {
    const params =
      new URLSearchParams({
        action,
      });

    Object.entries(
      query || {}
    ).forEach(
      ([chave, valor]) => {
        if (
          valor !== "" &&
          valor !== null &&
          valor !== undefined
        ) {
          params.set(
            chave,
            String(valor)
          );
        }
      }
    );

    const resposta =
      await fetch(
        `/api/tributario?${params.toString()}`,
        {
          method,
          headers: {
            ...(body
              ? {
                  "content-type":
                    "application/json",
                }
              : {}),
            ...(token
              ? {
                  Authorization:
                    `Bearer ${token}`,
                }
              : {}),
          },
          ...(body
            ? {
                body:
                  JSON.stringify(
                    body
                  ),
              }
            : {}),
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
        "Erro no módulo tributário."
      );
    }

    return data;
  }

  function normalizarRespostaCnpj(
    data
  ) {
    if (
      !data ||
      data.sucesso !== true
    ) {
      throw new Error(
        data?.error ||
        "A consulta do CNPJ não retornou dados válidos."
      );
    }

    const cnaePrincipal =
      data.cnaePrincipal ||
      data.cnae?.principal || {
        codigo:
          String(
            data.cnae?.codigo ||
            ""
          ),
        descricao:
          data.cnae?.descricao ||
          "",
        principal: true,
      };

    const cnaesSecundarios =
      Array.isArray(
        data.cnaesSecundarios
      )
        ? data.cnaesSecundarios
        : Array.isArray(
            data.cnae?.secundarios
          )
        ? data.cnae.secundarios
        : [];

    const todosCnaes =
      Array.isArray(
        data.todosCnaes
      ) &&
      data.todosCnaes.length
        ? data.todosCnaes
        : Array.isArray(
            data.cnae?.todos
          ) &&
          data.cnae.todos.length
        ? data.cnae.todos
        : [
            cnaePrincipal,
            ...cnaesSecundarios,
          ];

    return {
      cnpj:
        data.cnpj ||
        "",
      razaoSocial:
        data.razaoSocial ||
        data.razao ||
        data.nomeEmpresarial ||
        data.nome ||
        "",
      nomeFantasia:
        data.nomeFantasia ||
        "",
      situacao:
        data.situacao ||
        data.situacaoCadastral ||
        "",
      porte:
        data.porte ||
        "",
      municipio:
        data.municipio ||
        data.endereco?.municipio ||
        "",
      uf:
        data.uf ||
        data.endereco?.uf ||
        "",
      endereco:
        data.endereco ||
        {},
      cnaePrincipal,
      cnaesSecundarios,
      todosCnaes,
      dadosBrutos:
        data,
    };
  }

  async function arquivoParaDataUrl(
    arquivo
  ) {
    return await new Promise(
      (
        resolve,
        reject
      ) => {
        const reader =
          new FileReader();

        reader.onload =
          () =>
            resolve(
              reader.result
            );

        reader.onerror =
          () =>
            reject(
              new Error(
                `Não foi possível ler ${arquivo.name}.`
              )
            );

        reader.readAsDataURL(
          arquivo
        );
      }
    );
  }

  function atividadePrincipalRealAtual() {
    return (
      atividadesSelecionadas.find(
        (item) =>
          chaveAtividade(
            item
          ) ===
          atividadePrincipalSelecionada
      ) ||
      null
    );
  }

  function payloadProjetoAtual() {
    return {
      id:
        projetoId,

      tipoProjeto,

      estrutura,

      modalidade,

      responsavelFinder:
        dadosProjeto.responsavelFinder ||
        "",

      origemCliente:
        dadosProjeto.origemCliente ||
        "",

      contatoNome:
        dadosProjeto.contatoNome ||
        "",

      contatoEmail:
        dadosProjeto.contatoEmail ||
        "",

      contatoTelefone:
        dadosProjeto.contatoTelefone ||
        "",

      observacaoOrigem:
        dadosProjeto.observacaoOrigem ||
        "",

      empresas:
        empresas
          .filter(
            (empresa) =>
              empresa.dados
          )
          .map(
            (empresa) => ({
              cnpj:
                empresa.dados.cnpj ||
                empresa.cnpj ||
                "",
              razaoSocial:
                empresa.dados.razaoSocial ||
                "",
              nomeFantasia:
                empresa.dados.nomeFantasia ||
                "",
              situacao:
                empresa.dados.situacao ||
                "",
              porte:
                empresa.dados.porte ||
                "",
              municipio:
                empresa.dados.municipio ||
                "",
              uf:
                empresa.dados.uf ||
                "",
              cnaePrincipal:
                empresa.dados.cnaePrincipal ||
                null,
              cnaesSecundarios:
                empresa.dados.cnaesSecundarios ||
                [],
            })
          ),

      atividades: {
        selecionadas:
          atividadesSelecionadas,
        principalReal:
          atividadePrincipalRealAtual(),
        descricaoReal:
          descricaoAtividadeCliente.trim(),
      },

      dadosManuais,
    };
  }

  async function salvarProjetoAtual(
    status = "EM_ANALISE"
  ) {
    return await apiTributarioJson(
      "salvar-projeto",
      {
        method: "POST",
        body: {
          ...payloadProjetoAtual(),
          status,
        },
      }
    );
  }

  async function carregarProjetosSalvos() {
    setCarregandoProjetos(
      true
    );

    try {
      const data =
        await apiTributarioJson(
          "listar-projetos",
          {
            query: {
              busca:
                filtroHistorico.busca,
              tipo:
                filtroHistorico.tipo,
              responsavel:
                filtroHistorico.responsavel,
              status:
                filtroHistorico.status,
              arquivamento:
                filtroHistorico.arquivamento,
            },
          }
        );

      setProjetosSalvos(
        Array.isArray(
          data.projetos
        )
          ? data.projetos
          : []
      );
    } catch (
      error
    ) {
      console.error(
        "[tributario][historico]",
        error
      );
    } finally {
      setCarregandoProjetos(
        false
      );
    }
  }

  async function abrirProjetoSalvo(
    id
  ) {
    setCarregandoProjetos(
      true
    );

    try {
      const data =
        await apiTributarioJson(
          "obter-projeto",
          {
            query: {
              id,
            },
          }
        );

      setProjetoAberto(
        data.projeto
      );

      setTela(
        "projeto-salvo"
      );
    } catch (
      error
    ) {
      setErro(
        error?.message ||
        "Não foi possível abrir o diagnóstico."
      );
    } finally {
      setCarregandoProjetos(
        false
      );
    }
  }

  async function validarProjetoSalvo(
    id
  ) {
    try {
      await apiTributarioJson(
        "validar-projeto",
        {
          method: "POST",
          body: {
            id,
          },
        }
      );

      await abrirProjetoSalvo(
        id
      );

      await carregarProjetosSalvos();
    } catch (
      error
    ) {
      setErro(
        error?.message ||
        "Não foi possível validar o diagnóstico."
      );
    }
  }

  async function editarProjetoSalvo(id) {
    setErro("");
    setCarregandoProjetos(true);

    try {
      const data = await apiTributarioJson("obter-projeto", {
        query: { id },
      });

      const p = data.projeto;
      if (!p) throw new Error("Projeto não encontrado.");

      setProjetoId(p.id);
      setTipoProjeto(p.tipoProjeto || "planejamento");
      setModalidade(p.modalidade || "manual");
      setDadosProjeto((atual) => ({
        ...atual,
        responsavelFinder: p.responsavelFinder || "",
        origemCliente: p.origemCliente || "",
        contatoNome: p.contatoNome || "",
        contatoEmail: p.contatoEmail || "",
        contatoTelefone: p.contatoTelefone || "",
        observacaoOrigem: p.observacaoOrigem || "",
      }));

      if (Array.isArray(p.empresas) && p.empresas.length) {
        setEmpresas(
          p.empresas.map((empresa, index) => ({
            id: empresa.id || `empresa_${index}_${Date.now()}`,
            cnpj: empresa.cnpj || "",
            dados: empresa.dados || empresa,
            carregando: false,
            erro: "",
          }))
        );
      }

      const at = p.atividades || {};
      setAtividadesSelecionadas(
        Array.isArray(at.selecionadas) ? at.selecionadas : []
      );
      setAtividadePrincipalSelecionada(at.principalReal || "");
      setDescricaoAtividadeCliente(at.descricaoReal || "");

      const manuais = p.dadosManuais || {};
      if (manuais.planejamentoV2 && p.tipoProjeto === "planejamento") {
        // O Planejamento V2 salva sua própria base e será reaberto mantendo o mesmo projetoId.
        setTela("planejamento-v2");
      } else {
        setDadosManuais((atual) => ({
          ...atual,
          ...manuais,
        }));
        setTela("configuracao");
      }

      setProjetoAberto(null);
    } catch (error) {
      setErro(error?.message || "Não foi possível editar a inteligência tributária.");
    } finally {
      setCarregandoProjetos(false);
    }
  }

  async function arquivarProjetoSalvo(id, arquivado = true) {
    setErro("");
    try {
      await apiTributarioJson("arquivar-projeto", {
        method: "POST",
        body: { id, arquivado },
      });

      if (projetoAberto?.id === id) {
        setProjetoAberto((atual) =>
          atual ? { ...atual, arquivado } : atual
        );
      }

      await carregarProjetosSalvos();
    } catch (error) {
      setErro(error?.message || "Não foi possível alterar o arquivamento.");
    }
  }

  async function excluirProjetoSalvo(id, nome = "esta inteligência tributária") {
    const confirmou = window.confirm(
      `Excluir definitivamente ${nome}?\\n\\nEsta ação excluirá o projeto, diagnósticos, versões e histórico. Não poderá ser desfeita.`
    );

    if (!confirmou) return;

    const segundaConfirmacao = window.prompt(
      'Para confirmar a exclusão definitiva, digite EXCLUIR'
    );

    if (segundaConfirmacao !== "EXCLUIR") return;

    setErro("");
    try {
      await apiTributarioJson("excluir-projeto", {
        method: "POST",
        body: { id, confirmacao: "EXCLUIR" },
      });

      if (projetoAberto?.id === id) {
        setProjetoAberto(null);
        setTela("inicio");
      }

      await carregarProjetosSalvos();
    } catch (error) {
      setErro(error?.message || "Não foi possível excluir a inteligência tributária.");
    }
  }

  async function gerarDiagnosticoIaReal() {
    setErro("");

    if (
      modalidade !==
        "manual" &&
      !arquivos.length
    ) {
      setErro(
        "Selecione pelo menos um documento para a análise com IA."
      );
      return;
    }

    if (
      atividadesDisponiveis.length &&
      !atividadesSelecionadas.length
    ) {
      setErro(
        "Selecione as atividades/CNAEs realmente exercidas."
      );
      return;
    }

    if (
      atividadesSelecionadas.length &&
      !atividadePrincipalSelecionada
    ) {
      setErro(
        "Defina a atividade principal real."
      );
      return;
    }

    if (
      !descricaoAtividadeCliente
        .trim()
    ) {
      setErro(
        "Descreva brevemente o que a empresa realmente faz."
      );
      return;
    }

    setGerandoDiagnostico(
      true
    );

    setDiagnosticoOrigem(
      ""
    );

    try {
      await salvarProjetoAtual(
        "PROCESSANDO_IA"
      );

      const arquivosIa =
        [];

      for (
        let i = 0;
        i <
        arquivos.length;
        i += 1
      ) {
        const arquivo =
          arquivos[i];

        setProgressoIa({
          etapa:
            "UPLOAD",
          atual:
            i + 1,
          total:
            arquivos.length,
          mensagem:
            `Enviando ${arquivo.name} para leitura da IA...`,
        });

        const fileData =
          await arquivoParaDataUrl(
            arquivo
          );

        const upload =
          await apiTributarioJson(
            "upload-file",
            {
              method: "POST",
              body: {
                filename:
                  arquivo.name,
                mimeType:
                  arquivo.type ||
                  "application/octet-stream",
                fileData,
              },
            }
          );

        arquivosIa.push({
          fileId:
            upload.fileId,
          filename:
            arquivo.name,
          bytes:
            arquivo.size,
        });
      }

      setArquivosProcessadosIa(
        arquivosIa
      );

      setProgressoIa({
        etapa:
          "ANALISE",
        atual:
          arquivos.length,
        total:
          arquivos.length ||
          1,
        mensagem:
          tipoProjeto ===
          "reforma"
            ? "Analisando Reforma Tributária: IBS, CBS, transição, créditos e impacto operacional..."
            : "Analisando Planejamento Tributário: regime atual, eficiência e redução legal de carga...",
      });

      const payload =
        payloadProjetoAtual();

      const respostaIa =
        await apiTributarioJson(
          "diagnostico",
          {
            method: "POST",
            body: {
              tipoProjeto:
                payload.tipoProjeto,
              estrutura:
                payload.estrutura,
              modalidade:
                payload.modalidade,

              cliente: {
                responsavelFinder:
                  payload.responsavelFinder,
                origemCliente:
                  payload.origemCliente,
                contatoNome:
                  payload.contatoNome,
                contatoEmail:
                  payload.contatoEmail,
                contatoTelefone:
                  payload.contatoTelefone,
                observacaoOrigem:
                  payload.observacaoOrigem,
              },

              empresas:
                payload.empresas,

              atividades:
                payload.atividades,

              dadosManuais:
                payload.dadosManuais,

              arquivos:
                arquivosIa,
            },
          }
        );

      const salvo =
        await apiTributarioJson(
          "salvar-diagnostico",
          {
            method: "POST",
            body: {
              projetoId,
              tipoProjeto,
              diagnostico:
                respostaIa.diagnostico,
              modelo:
                respostaIa.modelo ||
                "gpt-5.6",
              usage:
                respostaIa.usage ||
                null,
              documentos:
                arquivosIa,
            },
          }
        );

      setVersaoDiagnostico(
        salvo.versao ||
        null
      );

      setDiagnosticoGerado(
        respostaIa.diagnostico
      );

      setDiagnosticoOrigem(
        "IA_REAL"
      );

      registrarHistorico(
        "DIAGNOSTICO_IA_REAL",
        `Diagnóstico V${
          salvo.versao ||
          ""
        } gerado e salvo.`,
        {
          tipoProjeto,
          documentos:
            arquivosIa.length,
        }
      );

      setProgressoIa({
        etapa:
          "CONCLUIDO",
        atual:
          arquivos.length,
        total:
          arquivos.length ||
          1,
        mensagem:
          "Diagnóstico concluído e salvo no histórico.",
      });

      setAbaAnalise(
        "diagnostico"
      );

      await carregarProjetosSalvos();
    } catch (
      error
    ) {
      console.error(
        "[tributario][IA]",
        error
      );

      setErro(
        error?.message ||
        "Não foi possível concluir a análise com IA."
      );

      setProgressoIa({
        etapa:
          "ERRO",
        atual:
          0,
        total:
          0,
        mensagem:
          error?.message ||
          "Erro no diagnóstico.",
      });
    } finally {
      setGerandoDiagnostico(
        false
      );
    }
  }

  const responsaveisHistorico =
    useMemo(
      () =>
        Array.from(
          new Set(
            projetosSalvos
              .map(
                (item) =>
                  item.responsavelFinder
              )
              .filter(Boolean)
          )
        ).sort(
          (a, b) =>
            a.localeCompare(
              b,
              "pt-BR"
            )
        ),
      [projetosSalvos]
    );

  useEffect(
    () => {
      if (
        tela ===
        "inicio"
      ) {
        carregarProjetosSalvos();
      }
    },
    [tela]
  );

  function numeroSeguro(
    valor
  ) {
    const texto =
      String(
        valor ?? ""
      )
        .replace(/\./g, "")
        .replace(",", ".");

    const numero =
      Number(texto);

    return Number.isFinite(numero)
      ? numero
      : 0;
  }

  function gerarDiagnosticoPreliminarLocal() {
    setGerandoDiagnostico(
      true
    );

    try {
      const faturamento =
        numeroSeguro(
          dadosManuais.faturamento12m
        );

      const folha =
        numeroSeguro(
          dadosManuais.folha12m
        );

      const compras =
        numeroSeguro(
          dadosManuais.compras12m
        );

      const despesas =
        numeroSeguro(
          dadosManuais.despesasDedutiveis
        );

      const b2b =
        numeroSeguro(
          dadosManuais.percentualB2B
        );

      const margem =
        numeroSeguro(
          dadosManuais.margemOperacional
        );

      const fatorFolha =
        faturamento > 0
          ? folha / faturamento
          : null;

      const indiceCompras =
        faturamento > 0
          ? compras / faturamento
          : null;

      const indiceDespesas =
        faturamento > 0
          ? despesas / faturamento
          : null;

      const pontos = [];
      const riscos = [];
      const oportunidades = [];
      const dadosFaltantes = [];

      if (!faturamento) {
        dadosFaltantes.push(
          "Faturamento dos últimos 12 meses"
        );
      }

      if (!folha) {
        dadosFaltantes.push(
          "Folha e pró-labore dos últimos 12 meses"
        );
      }

      if (!dadosManuais.regimeAtual) {
        dadosFaltantes.push(
          "Regime tributário atual"
        );
      }

      const atividadePrincipalReal =
        atividadesSelecionadas.find(
          (item) =>
            chaveAtividade(
              item
            ) ===
            atividadePrincipalSelecionada
        ) ||
        null;

      if (
        atividadePrincipalReal
      ) {
        pontos.push(
          `Atividade principal considerada na análise: ${
            atividadePrincipalReal.codigo ||
            ""
          } · ${
            atividadePrincipalReal.descricao ||
            ""
          }.`
        );
      }

      if (
        atividadesSelecionadas.length >
        1
      ) {
        pontos.push(
          `Foram selecionadas ${atividadesSelecionadas.length} atividades/CNAEs para cruzamento tributário.`
        );
      }

      if (
        descricaoAtividadeCliente
          .trim()
      ) {
        pontos.push(
          `Operação informada pelo consultor/cliente: ${descricaoAtividadeCliente.trim()}`
        );
      }

      if (tipoProjeto === "planejamento") {
        if (
          fatorFolha !== null &&
          fatorFolha >= 0.28
        ) {
          oportunidades.push(
            "A relação folha/faturamento está em faixa relevante para análise de Fator R, quando aplicável à atividade."
          );
        }

        if (
          indiceDespesas !== null &&
          indiceDespesas >= 0.20
        ) {
          oportunidades.push(
            "O volume de despesas informado merece comparação detalhada com Lucro Real, pois pode alterar a eficiência tributária."
          );
        }

        if (
          margem > 0 &&
          margem <= 15
        ) {
          oportunidades.push(
            "A margem operacional informada é relativamente baixa; isso reforça a necessidade de comparar Lucro Presumido e Lucro Real."
          );
        }

        if (
          b2b >= 50
        ) {
          riscos.push(
            "A participação relevante de vendas B2B exige avaliar o efeito comercial dos créditos tributários concedidos aos clientes."
          );
        }

        pontos.push(
          "Comparar Simples Nacional, Lucro Presumido e Lucro Real com memória de cálculo."
        );

        pontos.push(
          "Separar receitas por atividade/CNAE e verificar anexos, Fator R e incidências específicas."
        );

        pontos.push(
          "Conferir folha, pró-labore, retenções, compras e despesas dedutíveis."
        );
      } else {
        if (
          b2b >= 50
        ) {
          riscos.push(
            "A empresa possui perfil B2B relevante; a competitividade poderá depender do crédito transferido ao cliente na sistemática IBS/CBS."
          );
        }

        if (
          indiceCompras !== null &&
          indiceCompras < 0.20
        ) {
          riscos.push(
            "O nível de compras informado é baixo em relação ao faturamento, o que pode limitar o volume de créditos no novo modelo."
          );
        }

        if (
          indiceCompras !== null &&
          indiceCompras >= 0.30
        ) {
          oportunidades.push(
            "O volume de compras/insumos sugere potencial relevante de apropriação de créditos, sujeito à validação documental."
          );
        }

        pontos.push(
          "Mapear receitas, compras, serviços tomados e itens potencialmente geradores de créditos."
        );

        pontos.push(
          "Avaliar impacto da transição IBS/CBS sobre preço, margem e contratos."
        );

        pontos.push(
          "Separar operações B2B e B2C para medir efeito comercial e creditício."
        );
      }

      if (
        arquivos.length > 0
      ) {
        oportunidades.push(
          `${arquivos.length} documento(s) já foram selecionados para apoiar a validação da análise.`
        );
      }

      const conclusao =
        dadosFaltantes.length === 0
          ? "A base mínima está preenchida e o projeto pode avançar para os cálculos tributários detalhados."
          : "Foi possível montar um diagnóstico preliminar, mas ainda há dados essenciais que precisam ser confirmados antes da recomendação final.";

      const resultado = {
        criadoEm:
          new Date().toISOString(),
        tipoProjeto,
        conclusao,
        pontos,
        riscos,
        oportunidades,
        dadosFaltantes,
        indicadores: {
          faturamento,
          folha,
          compras,
          despesas,
          b2b,
          margem,
          fatorFolha,
          indiceCompras,
          indiceDespesas,
        },
      };

      setDiagnosticoGerado(
        resultado
      );

      registrarHistorico(
        "DIAGNOSTICO_GERADO",
        "Diagnóstico tributário preliminar gerado.",
        {
          riscos:
            riscos.length,
          oportunidades:
            oportunidades.length,
          dadosFaltantes:
            dadosFaltantes.length,
        }
      );

      setAbaAnalise(
        "diagnostico"
      );
    } finally {
      setGerandoDiagnostico(
        false
      );
    }
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

    // Reforma Tributária permanece exatamente no fluxo V1.7.
    // Somente Planejamento entra no motor V2.
    if (tipo === "planejamento") {
      setTela("planejamento-v2");
      return;
    }

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
      digits.length !==
      14
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
        carregando:
          true,
        erro:
          "",
      }
    );

    try {
      const resposta =
        await fetch(
          `/api/cnpj?cnpj=${encodeURIComponent(
            digits
          )}`
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
          "Erro ao consultar CNPJ."
        );
      }

      const dados =
        normalizarRespostaCnpj(
          data
        );

      alterarEmpresa(
        empresa.id,
        {
          cnpj:
            formatarCnpj(
              digits
            ),
          dados,
          erro:
            "",
        }
      );

      const lista =
        normalizarListaCnaes({
          dados,
        });

      setAtividadesSelecionadas(
        lista
      );

      const principal =
        lista.find(
          (item) =>
            item.principal ||
            item.tipo ===
              "principal"
        ) ||
        lista[0] ||
        null;

      setAtividadePrincipalSelecionada(
        principal
          ? chaveAtividade(
              principal
            )
          : ""
      );

      registrarHistorico(
        "CNPJ_CONSULTADO",
        `CNPJ ${formatarCnpj(
          digits
        )} consultado com ${
          lista.length
        } CNAE(s).`,
        {
          razaoSocial:
            dados.razaoSocial,
          quantidadeCnaes:
            lista.length,
        }
      );
    } catch (
      error
    ) {
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
          carregando:
            false,
        }
      );
    }
  }

  function normalizarListaCnaes(
    empresa
  ) {
    const dados =
      empresa?.dados ||
      {};

    const origem =
      Array.isArray(
        dados.todosCnaes
      ) &&
      dados.todosCnaes.length
        ? dados.todosCnaes
        : [
            dados.cnaePrincipal,
            ...(Array.isArray(
              dados.cnaesSecundarios
            )
              ? dados.cnaesSecundarios
              : []),
          ];

    const mapa =
      new Map();

    origem.forEach(
      (item) => {
        if (!item) {
          return;
        }

        const codigo =
          String(
            item.codigo ||
            item.code ||
            item.cnae ||
            ""
          );

        const descricao =
          String(
            item.descricao ||
            item.description ||
            item.nome ||
            ""
          );

        const chave =
          codigo.replace(
            /\D/g,
            ""
          ) ||
          descricao
            .toLowerCase()
            .trim();

        if (!chave) {
          return;
        }

        mapa.set(
          chave,
          {
            ...item,
            codigo,
            descricao,
            tipo:
              item.principal
                ? "principal"
                : "secundaria",
            principal:
              Boolean(
                item.principal
              ),
          }
        );
      }
    );

    return Array.from(
      mapa.values()
    );
  }

  const atividadesDisponiveis =
    empresas
      .flatMap(
        (empresa) =>
          normalizarListaCnaes(
            empresa
          )
      );

  function chaveAtividade(
    item
  ) {
    return `${item.codigo}|${item.descricao}`;
  }

  function alternarAtividade(
    item
  ) {
    const chave =
      chaveAtividade(
        item
      );

    setAtividadesSelecionadas(
      (atuais) => {
        const existe =
          atuais.some(
            (a) =>
              chaveAtividade(a) ===
              chave
          );

        if (existe) {
          return atuais.filter(
            (a) =>
              chaveAtividade(a) !==
              chave
          );
        }

        return [
          ...atuais,
          item,
        ];
      }
    );
  }

  function preencherAtividadesPadrao() {
    if (
      !atividadesDisponiveis.length
    ) {
      return;
    }

    const principais =
      atividadesDisponiveis.filter(
        (item) =>
          item.tipo ===
          "principal"
      );

    if (
      principais.length &&
      !atividadePrincipalSelecionada
    ) {
      setAtividadePrincipalSelecionada(
        chaveAtividade(
          principais[0]
        )
      );
    }

    if (
      !atividadesSelecionadas.length
    ) {
      setAtividadesSelecionadas(
        atividadesDisponiveis
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
    "planejamento-v2"
  ) {
    return (
      <PlanejamentoTributario
        token={token}
        onVoltar={() => {
          setTipoProjeto("");
          setTela("inicio");
        }}
      />
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
        <Card
          style={{
            marginTop:
              16,
          }}
        >
          <div
            style={{
              display:
                "flex",
              justifyContent:
                "space-between",
              gap:
                12,
              alignItems:
                "flex-start",
              flexWrap:
                "wrap",
              marginBottom:
                12,
            }}
          >
            <div>
              <div
                style={{
                  color:
                    "#31589C",
                  fontSize:
                    9,
                  fontWeight:
                    900,
                }}
              >
                HISTÓRICO DOS DIAGNÓSTICOS
              </div>

              <h3
                style={{
                  margin:
                    "4px 0 3px",
                  fontFamily:
                    DISPLAY_FONT,
                  fontSize:
                    20,
                }}
              >
                Diagnósticos realizados
              </h3>

              <div
                style={{
                  color:
                    MUTED,
                  fontSize:
                    10,
                }}
              >
                Salvos por cliente, responsável, tipo, status e versão.
              </div>
            </div>

            <Botao
              secundario
              onClick={
                carregarProjetosSalvos
              }
              disabled={
                carregandoProjetos
              }
            >
              {carregandoProjetos
                ? "Atualizando..."
                : "Atualizar"}
            </Botao>
          </div>

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "minmax(220px,1.4fr) repeat(4,minmax(140px,1fr)) auto",
              gap:
                8,
              marginBottom:
                12,
            }}
          >
            <input
              value={
                filtroHistorico.busca
              }
              onChange={(e) =>
                setFiltroHistorico(
                  (
                    atual
                  ) => ({
                    ...atual,
                    busca:
                      e.target.value,
                  })
                )
              }
              placeholder="Buscar cliente ou CNPJ..."
              style={
                inputStyle()
              }
            />

            <select
              value={
                filtroHistorico.tipo
              }
              onChange={(e) =>
                setFiltroHistorico(
                  (
                    atual
                  ) => ({
                    ...atual,
                    tipo:
                      e.target.value,
                  })
                )
              }
              style={
                inputStyle()
              }
            >
              <option value="">
                Todos os tipos
              </option>

              <option value="reforma">
                Reforma Tributária
              </option>

              <option value="planejamento">
                Planejamento Tributário
              </option>
            </select>

            <select
              value={
                filtroHistorico.responsavel
              }
              onChange={(e) =>
                setFiltroHistorico(
                  (
                    atual
                  ) => ({
                    ...atual,
                    responsavel:
                      e.target.value,
                  })
                )
              }
              style={
                inputStyle()
              }
            >
              <option value="">
                Todos os responsáveis
              </option>

              {responsaveisHistorico.map(
                (
                  nome
                ) => (
                  <option
                    key={
                      nome
                    }
                    value={
                      nome
                    }
                  >
                    {nome}
                  </option>
                )
              )}
            </select>

            <select
              value={
                filtroHistorico.status
              }
              onChange={(e) =>
                setFiltroHistorico(
                  (
                    atual
                  ) => ({
                    ...atual,
                    status:
                      e.target.value,
                  })
                )
              }
              style={
                inputStyle()
              }
            >
              <option value="">
                Todos os status
              </option>

              <option value="EM_ANALISE">
                Em análise
              </option>

              <option value="PROCESSANDO_IA">
                Processando IA
              </option>

              <option value="DIAGNOSTICO_GERADO">
                Diagnóstico gerado
              </option>

              <option value="VALIDADO">
                Validado
              </option>
            </select>

            <select
              value={filtroHistorico.arquivamento}
              onChange={(e) =>
                setFiltroHistorico((atual) => ({
                  ...atual,
                  arquivamento: e.target.value,
                }))
              }
              style={inputStyle()}
            >
              <option value="ATIVOS">Ativos</option>
              <option value="ARQUIVADOS">Arquivados</option>
              <option value="TODOS">Ativos + arquivados</option>
            </select>

            <Botao
              onClick={
                carregarProjetosSalvos
              }
            >
              Filtrar
            </Botao>
          </div>

          {!projetosSalvos.length ? (
            <div
              style={{
                border:
                  "1px dashed #C9D1DF",
                borderRadius:
                  12,
                padding:
                  20,
                color:
                  MUTED,
                fontSize:
                  10,
                textAlign:
                  "center",
              }}
            >
              Nenhum diagnóstico salvo com os filtros atuais.
            </div>
          ) : (
            <div
              style={{
                display:
                  "grid",
                gap:
                  8,
              }}
            >
              {projetosSalvos.map(
                (
                  projeto
                ) => (
                  <div
                    key={projeto.id}
                    style={{
                      width:"100%",
                      border:"1px solid #E3E7EF",
                      borderRadius:12,
                      background:projeto.arquivado ? "#F7F8FA" : WHITE,
                      padding:12,
                      display:"grid",
                      gridTemplateColumns:"minmax(220px,2fr) minmax(150px,1fr) minmax(130px,1fr) 60px 105px 245px",
                      gap:10,
                      alignItems:"center",
                      color:NAVY,
                      opacity:projeto.arquivado ? .72 : 1,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => abrirProjetoSalvo(projeto.id)}
                      style={{
                        border:0,background:"transparent",padding:0,cursor:"pointer",
                        textAlign:"left",color:NAVY
                      }}
                    >
                      <strong style={{display:"block",fontSize:11.5}}>
                        {projeto.clienteNome || "Cliente"}
                      </strong>
                      <div style={{color:MUTED,fontSize:9,marginTop:3}}>
                        {projeto.cnpj || "CNPJ não informado"}
                        {projeto.arquivado ? " · ARQUIVADO" : ""}
                      </div>
                    </button>

                    <strong style={{fontSize:9.5}}>
                      {projeto.tipoProjeto === "reforma" ? "Reforma Tributária" : "Planejamento Tributário"}
                    </strong>

                    <strong style={{fontSize:9.5}}>
                      {projeto.responsavelFinder || "-"}
                    </strong>

                    <strong>V{projeto.versaoAtual || 0}</strong>

                    <span style={{
                      borderRadius:999,padding:"5px 7px",
                      background:projeto.status==="VALIDADO"?"#E9F7EF":"#EEF3FF",
                      color:projeto.status==="VALIDADO"?"#176B47":"#31589C",
                      fontSize:8,fontWeight:900,textAlign:"center"
                    }}>
                      {projeto.status || "EM_ANALISE"}
                    </span>

                    <div style={{display:"flex",gap:5,justifyContent:"flex-end",flexWrap:"wrap"}}>
                      <button type="button" onClick={()=>editarProjetoSalvo(projeto.id)}
                        style={{border:"1px solid #CAD3E2",background:WHITE,borderRadius:7,padding:"6px 8px",cursor:"pointer",fontSize:8.5,fontWeight:800}}>
                        Editar
                      </button>
                      <button type="button" onClick={()=>arquivarProjetoSalvo(projeto.id,!projeto.arquivado)}
                        style={{border:"1px solid #CAD3E2",background:WHITE,borderRadius:7,padding:"6px 8px",cursor:"pointer",fontSize:8.5,fontWeight:800}}>
                        {projeto.arquivado ? "Reativar" : "Arquivar"}
                      </button>
                      <button type="button" onClick={()=>excluirProjetoSalvo(projeto.id,projeto.clienteNome||"esta inteligência tributária")}
                        style={{border:"1px solid #E7B9B9",background:"#FFF7F7",color:"#A22",borderRadius:7,padding:"6px 8px",cursor:"pointer",fontSize:8.5,fontWeight:800}}>
                        Excluir
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </Card>

      </div>
    );
  }

  if (
    tela ===
    "projeto-salvo" &&
    projetoAberto
  ) {
    const ultimo =
      projetoAberto
        .diagnosticos?.[0] ||
      null;

    return (
      <div
        style={{
          fontFamily:
            BODY_FONT,
          color:
            NAVY,
        }}
      >
        <button
          type="button"
          onClick={() => {
            setProjetoAberto(
              null
            );
            setTela(
              "inicio"
            );
          }}
          style={{
            border:
              0,
            background:
              "transparent",
            color:
              MUTED,
            cursor:
              "pointer",
            fontWeight:
              800,
            marginBottom:
              12,
          }}
        >
          ← Voltar aos diagnósticos
        </button>

        <div
          style={{
            background:
              "linear-gradient(135deg,#0E1A33,#17233D)",
            color:
              WHITE,
            borderRadius:
              18,
            padding:
              20,
            marginBottom:
              14,
          }}
        >
          <div
            style={{
              color:
                "#FFB7A7",
              fontSize:
                9,
              fontWeight:
                900,
            }}
          >
            {projetoAberto.tipoProjeto ===
            "reforma"
              ? "REFORMA TRIBUTÁRIA"
              : "PLANEJAMENTO TRIBUTÁRIO"}
          </div>

          <h2
            style={{
              margin:
                "5px 0 4px",
              fontFamily:
                DISPLAY_FONT,
            }}
          >
            {projetoAberto.clienteNome ||
              "Cliente"}
          </h2>

          <div
            style={{
              color:
                "#D8DEEA",
              fontSize:
                10,
            }}
          >
            {projetoAberto.cnpj ||
              "Sem CNPJ"}{" "}
            · Responsável:{" "}
            <strong>
              {projetoAberto.responsavelFinder ||
                "-"}
            </strong>{" "}
            · Origem:{" "}
            <strong>
              {projetoAberto.origemCliente ||
                "-"}
            </strong>
          </div>
        </div>

        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(180px,1fr))",
            gap:
              10,
            marginBottom:
              14,
          }}
        >
          <Card>
            <div
              style={{
                color:
                  MUTED,
                fontSize:
                  9,
                fontWeight:
                  900,
              }}
            >
              STATUS
            </div>

            <strong
              style={{
                display:
                  "block",
                marginTop:
                  7,
              }}
            >
              {projetoAberto.status}
            </strong>
          </Card>

          <Card>
            <div
              style={{
                color:
                  MUTED,
                fontSize:
                  9,
                fontWeight:
                  900,
              }}
            >
              VERSÕES
            </div>

            <strong
              style={{
                display:
                  "block",
                marginTop:
                  7,
                fontSize:
                  24,
              }}
            >
              {projetoAberto
                .diagnosticos
                ?.length ||
                0}
            </strong>
          </Card>

          <Card>
            <div
              style={{
                color:
                  MUTED,
                fontSize:
                  9,
                fontWeight:
                  900,
              }}
            >
              CRIADO POR
            </div>

            <strong
              style={{
                display:
                  "block",
                marginTop:
                  7,
              }}
            >
              {projetoAberto.criadoPorNome ||
                "-"}
            </strong>
          </Card>

          <Card>
            <div
              style={{
                color:
                  MUTED,
                fontSize:
                  9,
                fontWeight:
                  900,
              }}
            >
              VALIDADO POR
            </div>

            <strong
              style={{
                display:
                  "block",
                marginTop:
                  7,
              }}
            >
              {projetoAberto.validadoPorNome ||
                "Pendente"}
            </strong>
          </Card>
        </div>

        {ultimo ? (
          <div
            style={{
              display:
                "grid",
              gap:
                12,
            }}
          >
            <Card
              style={{
                borderLeft:
                  "4px solid #31589C",
              }}
            >
              <div
                style={{
                  color:
                    "#31589C",
                  fontSize:
                    9,
                  fontWeight:
                    900,
                }}
              >
                ÚLTIMA VERSÃO · V{ultimo.versao}
              </div>

              <h3
                style={{
                  margin:
                    "6px 0 6px",
                  fontFamily:
                    DISPLAY_FONT,
                }}
              >
                Resumo executivo
              </h3>

              <div
                style={{
                  color:
                    MUTED,
                  fontSize:
                    10.5,
                  lineHeight:
                    1.65,
                }}
              >
                {ultimo.diagnostico?.resumoExecutivo ||
                  ultimo.diagnostico?.conclusao ||
                  "Sem resumo disponível."}
              </div>
            </Card>

            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(250px,1fr))",
                gap:
                  12,
              }}
            >
              <Card>
                <strong>
                  Riscos
                </strong>

                <div
                  style={{
                    display:
                      "grid",
                    gap:
                      6,
                    marginTop:
                      9,
                  }}
                >
                  {(ultimo.diagnostico?.riscos ||
                    []).map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        key={
                          index
                        }
                        style={{
                          background:
                            "#FFF4F0",
                          borderRadius:
                            8,
                          padding:
                            9,
                          fontSize:
                            9.5,
                        }}
                      >
                        {item}
                      </div>
                    )
                  )}
                </div>
              </Card>

              <Card>
                <strong>
                  Oportunidades
                </strong>

                <div
                  style={{
                    display:
                      "grid",
                    gap:
                      6,
                    marginTop:
                      9,
                  }}
                >
                  {(ultimo.diagnostico?.oportunidades ||
                    []).map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        key={
                          index
                        }
                        style={{
                          background:
                            "#EEF9F3",
                          borderRadius:
                            8,
                          padding:
                            9,
                          fontSize:
                            9.5,
                        }}
                      >
                        {item}
                      </div>
                    )
                  )}
                </div>
              </Card>
            </div>

            <Card>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <div>
                  <strong>Gerenciar inteligência tributária</strong>
                  <div style={{color:MUTED,fontSize:9.5,marginTop:3}}>
                    Edite mantendo o mesmo projeto e histórico, arquive sem apagar ou exclua definitivamente.
                  </div>
                </div>
                <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                  <Botao secundario onClick={()=>editarProjetoSalvo(projetoAberto.id)}>Editar</Botao>
                  <Botao secundario onClick={()=>arquivarProjetoSalvo(projetoAberto.id,!projetoAberto.arquivado)}>
                    {projetoAberto.arquivado ? "Reativar" : "Arquivar"}
                  </Botao>
                  <button type="button"
                    onClick={()=>excluirProjetoSalvo(projetoAberto.id,projetoAberto.clienteNome||"esta inteligência tributária")}
                    style={{border:"1px solid #E7B9B9",background:"#FFF7F7",color:"#A22",borderRadius:8,padding:"8px 11px",cursor:"pointer",fontWeight:900,fontSize:9}}>
                    Excluir definitivamente
                  </button>
                </div>
              </div>
            </Card>

            <Card>
              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  gap:
                    10,
                  flexWrap:
                    "wrap",
                }}
              >
                <div>
                  <strong>
                    Validação
                  </strong>

                  <div
                    style={{
                      color:
                        MUTED,
                      fontSize:
                        9.5,
                      marginTop:
                        3,
                    }}
                  >
                    Mantém todas as versões e registra quem validou.
                  </div>
                </div>

                {projetoAberto.status !==
                  "VALIDADO" && (
                  <Botao
                    onClick={() =>
                      validarProjetoSalvo(
                        projetoAberto.id
                      )
                    }
                  >
                    Validar diagnóstico
                  </Botao>
                )}
              </div>
            </Card>

            <Card>
              <strong>
                Histórico de versões
              </strong>

              <div
                style={{
                  display:
                    "grid",
                  gap:
                    7,
                  marginTop:
                    10,
                }}
              >
                {projetoAberto.diagnosticos.map(
                  (
                    diag
                  ) => (
                    <div
                      key={
                        diag.id
                      }
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "70px minmax(0,1fr) 170px",
                        gap:
                          10,
                        border:
                          "1px solid #E3E7EF",
                        borderRadius:
                          9,
                        padding:
                          9,
                      }}
                    >
                      <strong>
                        V{diag.versao}
                      </strong>

                      <div>
                        {diag.modelo ||
                          "IA"}
                      </div>

                      <div
                        style={{
                          color:
                            MUTED,
                          fontSize:
                            9,
                        }}
                      >
                        {diag.criadoEm
                          ? new Date(
                              diag.criadoEm
                            ).toLocaleString(
                              "pt-BR"
                            )
                          : "-"}
                      </div>
                    </div>
                  )
                )}
              </div>
            </Card>

            <Card>
              <strong>
                Linha do tempo
              </strong>

              <div
                style={{
                  display:
                    "grid",
                  gap:
                    6,
                  marginTop:
                    10,
                }}
              >
                {(projetoAberto.historico ||
                  []).map(
                  (
                    evento
                  ) => (
                    <div
                      key={
                        evento.id
                      }
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "150px minmax(0,1fr)",
                        gap:
                          10,
                        padding:
                          9,
                        borderBottom:
                          "1px solid #EEF0F4",
                      }}
                    >
                      <div
                        style={{
                          color:
                            MUTED,
                          fontSize:
                            9,
                        }}
                      >
                        {evento.criadoEm
                          ? new Date(
                              evento.criadoEm
                            ).toLocaleString(
                              "pt-BR"
                            )
                          : "-"}
                      </div>

                      <div>
                        <strong
                          style={{
                            fontSize:
                              9.5,
                          }}
                        >
                          {evento.descricao}
                        </strong>

                        <div
                          style={{
                            color:
                              MUTED,
                            fontSize:
                              8.5,
                            marginTop:
                              2,
                          }}
                        >
                          {evento.usuarioNome ||
                            "-"}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </Card>
          </div>
        ) : (
          <Card>
            Ainda não existe diagnóstico salvo neste projeto.
          </Card>
        )}
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
            Atividades consideradas
          </strong>

          <div
            style={{
              display: "grid",
              gap: 7,
            }}
          >
            {atividadesSelecionadas.length ? (
              atividadesSelecionadas.map(
                (
                  item,
                  index
                ) => {
                  const principal =
                    chaveAtividade(
                      item
                    ) ===
                    atividadePrincipalSelecionada;

                  return (
                    <div
                      key={index}
                      style={{
                        border:
                          principal
                            ? "1px solid #31589C"
                            : "1px solid #E3E7EF",
                        background:
                          principal
                            ? "#F8FAFF"
                            : WHITE,
                        borderRadius: 9,
                        padding: 9,
                        fontSize: 10,
                      }}
                    >
                      <strong>
                        {item.codigo ||
                          "CNAE"}{" "}
                        ·{" "}
                        {item.descricao ||
                          "Atividade"}
                      </strong>

                      {principal && (
                        <span
                          style={{
                            marginLeft: 7,
                            color: "#31589C",
                            fontSize: 8,
                            fontWeight: 900,
                          }}
                        >
                          PRINCIPAL REAL
                        </span>
                      )}
                    </div>
                  );
                }
              )
            ) : (
              <div
                style={{
                  color: MUTED,
                  fontSize: 10,
                }}
              >
                Nenhuma atividade selecionada.
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: 10,
              color: MUTED,
              fontSize: 9.5,
              lineHeight: 1.5,
            }}
          >
            <strong>
              Operação descrita:
            </strong>{" "}
            {descricaoAtividadeCliente ||
              "-"}
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
              "diagnostico",
              diagnosticoGerado
                ? "Diagnóstico"
                : "Montar diagnóstico",
            ],
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

        {(gerandoDiagnostico ||
          diagnosticoOrigem ===
            "IA_REAL" ||
          progressoIa.etapa ===
            "ERRO") && (
          <Card
            style={{
              marginBottom:
                14,
              background:
                diagnosticoOrigem ===
                "IA_REAL"
                  ? "#EEF9F3"
                  : progressoIa.etapa ===
                    "ERRO"
                  ? "#FFF4F0"
                  : "#F8FAFF",
              border:
                diagnosticoOrigem ===
                "IA_REAL"
                  ? "1px solid #BFE5D1"
                  : progressoIa.etapa ===
                    "ERRO"
                  ? "1px solid #F0C6B9"
                  : "1px solid #C9D5F5",
            }}
          >
            <div
              style={{
                fontSize:
                  9,
                fontWeight:
                  900,
                color:
                  diagnosticoOrigem ===
                  "IA_REAL"
                    ? "#176B47"
                    : progressoIa.etapa ===
                      "ERRO"
                    ? "#993C1D"
                    : "#31589C",
              }}
            >
              {diagnosticoOrigem ===
              "IA_REAL"
                ? `✓ DIAGNÓSTICO SALVO · V${versaoDiagnostico || "-"}`
                : progressoIa.etapa ===
                  "ERRO"
                ? "ERRO NA ANÁLISE"
                : "FINDER TAX AI · PROCESSANDO"}
            </div>

            <strong
              style={{
                display:
                  "block",
                marginTop:
                  5,
                fontSize:
                  11.5,
              }}
            >
              {diagnosticoOrigem ===
              "IA_REAL"
                ? `${arquivosProcessadosIa.length} documento(s) analisado(s). O diagnóstico está disponível no histórico por responsável.`
                : progressoIa.mensagem ||
                  "Preparando análise..."}
            </strong>
          </Card>
        )}

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
              }}
            >
              <div
                style={{
                  color: MUTED,
                  fontSize: 9,
                  fontWeight: 900,
                  marginBottom: 8,
                }}
              >
                ATIVIDADE CONSIDERADA PELA ANÁLISE
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 6,
                }}
              >
                {atividadesSelecionadas.map(
                  (
                    item,
                    index
                  ) => (
                    <div
                      key={index}
                      style={{
                        fontSize: 10,
                        lineHeight: 1.5,
                      }}
                    >
                      <strong>
                        {item.codigo ||
                          "CNAE"}{" "}
                        ·{" "}
                        {item.descricao ||
                          "Atividade"}
                      </strong>
                      {chaveAtividade(
                        item
                      ) ===
                      atividadePrincipalSelecionada && (
                        <span
                          style={{
                            color: "#31589C",
                            fontSize: 8,
                            fontWeight: 900,
                            marginLeft: 6,
                          }}
                        >
                          PRINCIPAL
                        </span>
                      )}
                    </div>
                  )
                )}
              </div>

              <div
                style={{
                  color: MUTED,
                  fontSize: 9.5,
                  marginTop: 8,
                  lineHeight: 1.5,
                }}
              >
                {descricaoAtividadeCliente ||
                  "-"}
              </div>
            </Card>

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
                DIAGNÓSTICO TRIBUTÁRIO
              </div>

              <h3
                style={{
                  margin: "6px 0 6px",
                  fontFamily: DISPLAY_FONT,
                }}
              >
                Montar diagnóstico preliminar
              </h3>

              <div
                style={{
                  color: MUTED,
                  fontSize: 10.5,
                  lineHeight: 1.55,
                }}
              >
                Use os dados já informados para montar agora um diagnóstico preliminar com pontos de atenção, oportunidades, dados faltantes e próximos passos.
              </div>

              <Botao
                onClick={
                  gerarDiagnosticoIaReal
                }
                disabled={
                  gerandoDiagnostico
                }
                style={{
                  marginTop: 12,
                }}
              >
                {gerandoDiagnostico
                  ? "Analisando com IA..."
                  : "Analisar com IA →"}
              </Botao>
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
          "diagnostico" && (
          <div
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            {!diagnosticoGerado ? (
              <Card
                style={{
                  background:
                    "#FFF9F7",
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
                  DIAGNÓSTICO TRIBUTÁRIO
                </div>

                <h3
                  style={{
                    margin:
                      "6px 0 6px",
                    fontFamily:
                      DISPLAY_FONT,
                  }}
                >
                  Gerar diagnóstico preliminar
                </h3>

                <div
                  style={{
                    color: MUTED,
                    fontSize: 10.5,
                    lineHeight: 1.55,
                  }}
                >
                  O sistema utilizará os dados informados e a estrutura do projeto para produzir uma primeira leitura consultiva.
                </div>

                <Botao
                  onClick={
                    gerarDiagnosticoIaReal
                  }
                  disabled={
                    gerandoDiagnostico
                  }
                  style={{
                    marginTop: 12,
                  }}
                >
                  {gerandoDiagnostico
                    ? "Analisando com IA..."
                    : "Analisar documentos e gerar diagnóstico"}
                </Botao>
              </Card>
            ) : (
              <>
                <Card
                  style={{
                    borderLeft:
                      "4px solid #31589C",
                  }}
                >
                  <div
                    style={{
                      color: "#31589C",
                      fontSize: 9,
                      fontWeight: 900,
                    }}
                  >
                    RESUMO EXECUTIVO
                  </div>

                  <h3
                    style={{
                      margin:
                        "6px 0 6px",
                      fontFamily:
                        DISPLAY_FONT,
                    }}
                  >
                    Diagnóstico preliminar
                  </h3>

                  <div
                    style={{
                      color: MUTED,
                      fontSize: 10.5,
                      lineHeight: 1.6,
                    }}
                  >
                    {diagnosticoGerado.conclusao}
                  </div>
                </Card>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(260px,1fr))",
                    gap: 12,
                  }}
                >
                  <Card>
                    <strong>
                      Pontos de análise
                    </strong>

                    <div
                      style={{
                        display: "grid",
                        gap: 7,
                        marginTop: 10,
                      }}
                    >
                      {(diagnosticoGerado.pontos || diagnosticoGerado.pontosAnalise || []).map(
                        (
                          item,
                          index
                        ) => (
                          <div
                            key={index}
                            style={{
                              background:
                                "#F7F8FB",
                              borderRadius: 8,
                              padding: 9,
                              fontSize: 10,
                              lineHeight: 1.5,
                            }}
                          >
                            {item}
                          </div>
                        )
                      )}
                    </div>
                  </Card>

                  <Card>
                    <strong>
                      Riscos / atenção
                    </strong>

                    <div
                      style={{
                        display: "grid",
                        gap: 7,
                        marginTop: 10,
                      }}
                    >
                      {(diagnosticoGerado.riscos || []).length ? (
                        (diagnosticoGerado.riscos || []).map(
                          (
                            item,
                            index
                          ) => (
                            <div
                              key={index}
                              style={{
                                background:
                                  "#FFF4F0",
                                color:
                                  "#8E321C",
                                borderRadius: 8,
                                padding: 9,
                                fontSize: 10,
                                lineHeight: 1.5,
                              }}
                            >
                              {item}
                            </div>
                          )
                        )
                      ) : (
                        <div
                          style={{
                            color: MUTED,
                            fontSize: 10,
                          }}
                        >
                          Nenhum alerta relevante identificado com os dados atuais.
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card>
                    <strong>
                      Oportunidades
                    </strong>

                    <div
                      style={{
                        display: "grid",
                        gap: 7,
                        marginTop: 10,
                      }}
                    >
                      {(diagnosticoGerado.oportunidades || []).length ? (
                        (diagnosticoGerado.oportunidades || []).map(
                          (
                            item,
                            index
                          ) => (
                            <div
                              key={index}
                              style={{
                                background:
                                  "#EEF9F3",
                                color:
                                  "#176B47",
                                borderRadius: 8,
                                padding: 9,
                                fontSize: 10,
                                lineHeight: 1.5,
                              }}
                            >
                              {item}
                            </div>
                          )
                        )
                      ) : (
                        <div
                          style={{
                            color: MUTED,
                            fontSize: 10,
                          }}
                        >
                          Ainda não há dados suficientes para apontar oportunidades.
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card>
                    <strong>
                      Dados faltantes
                    </strong>

                    <div
                      style={{
                        display: "grid",
                        gap: 7,
                        marginTop: 10,
                      }}
                    >
                      {(diagnosticoGerado.dadosFaltantes || []).length ? (
                        (diagnosticoGerado.dadosFaltantes || []).map(
                          (
                            item,
                            index
                          ) => (
                            <div
                              key={index}
                              style={{
                                background:
                                  "#FFF8E8",
                                color:
                                  "#855A09",
                                borderRadius: 8,
                                padding: 9,
                                fontSize: 10,
                                lineHeight: 1.5,
                              }}
                            >
                              {item}
                            </div>
                          )
                        )
                      ) : (
                        <div
                          style={{
                            color:
                              "#176B47",
                            background:
                              "#EEF9F3",
                            borderRadius: 8,
                            padding: 9,
                            fontSize: 10,
                          }}
                        >
                          Base mínima preenchida.
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                <Card>
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: 10,
                      alignItems:
                        "center",
                      flexWrap:
                        "wrap",
                    }}
                  >
                    <div>
                      <strong>
                        Atualizar diagnóstico
                      </strong>

                      <div
                        style={{
                          color: MUTED,
                          fontSize: 9.5,
                          marginTop: 3,
                        }}
                      >
                        Se você alterar dados ou documentos, gere novamente para atualizar a leitura.
                      </div>
                    </div>

                    <Botao
                      secundario
                      onClick={
                        gerarDiagnosticoIaReal
                      }
                    >
                      Gerar novamente
                    </Botao>
                  </div>
                </Card>
              </>
            )}
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
          borderTop:
            "4px solid #31589C",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            gap: 10,
            alignItems:
              "flex-start",
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          <div>
            <strong
              style={{
                display: "block",
                fontSize: 14,
              }}
            >
              Atividades da empresa
            </strong>

            <div
              style={{
                color: MUTED,
                fontSize: 10,
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              Os CNAEs vieram da consulta do CNPJ. Confirme quais atividades realmente fazem parte da operação e indique qual é a atividade principal de fato.
            </div>
          </div>

          <Botao
            secundario
            onClick={
              preencherAtividadesPadrao
            }
          >
            Selecionar CNAEs encontrados
          </Botao>
        </div>

        {!atividadesDisponiveis.length ? (
          <div
            style={{
              background:
                "#FFF8E8",
              color: "#855A09",
              borderRadius: 10,
              padding: 10,
              fontSize: 10,
            }}
          >
            Nenhum CNAE foi identificado na resposta atual da consulta. Você pode continuar e descrever a atividade manualmente abaixo.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 8,
            }}
          >
            {atividadesDisponiveis.map(
              (
                item,
                index
              ) => {
                const chave =
                  chaveAtividade(
                    item
                  );

                const selecionada =
                  atividadesSelecionadas.some(
                    (atividade) =>
                      chaveAtividade(
                        atividade
                      ) === chave
                  );

                const principal =
                  atividadePrincipalSelecionada ===
                  chave;

                return (
                  <div
                    key={`${chave}-${index}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "auto minmax(0,1fr) auto",
                      gap: 10,
                      alignItems: "center",
                      border:
                        selecionada
                          ? "1px solid #BFCBF0"
                          : "1px solid #E3E7EF",
                      background:
                        selecionada
                          ? "#F8FAFF"
                          : WHITE,
                      borderRadius: 10,
                      padding: 10,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        selecionada
                      }
                      onChange={() =>
                        alternarAtividade(
                          item
                        )
                      }
                    />

                    <div>
                      <strong
                        style={{
                          display: "block",
                          fontSize: 10.5,
                        }}
                      >
                        {item.codigo ||
                          "CNAE"}{" "}
                        ·{" "}
                        {item.descricao ||
                          "Atividade"}
                      </strong>

                      <div
                        style={{
                          color: MUTED,
                          fontSize: 8.5,
                          marginTop: 3,
                        }}
                      >
                        Origem Receita:{" "}
                        {item.tipo ===
                        "principal"
                          ? "CNAE principal cadastrado"
                          : "CNAE secundário cadastrado"}
                      </div>
                    </div>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 9,
                        fontWeight: 900,
                        cursor:
                          selecionada
                            ? "pointer"
                            : "not-allowed",
                        opacity:
                          selecionada
                            ? 1
                            : .4,
                      }}
                    >
                      <input
                        type="radio"
                        name="atividade-principal-real"
                        disabled={
                          !selecionada
                        }
                        checked={
                          principal
                        }
                        onChange={() =>
                          setAtividadePrincipalSelecionada(
                            chave
                          )
                        }
                      />
                      Principal real
                    </label>
                  </div>
                );
              }
            )}
          </div>
        )}

        <label
          style={{
            display: "block",
            marginTop: 12,
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
            DESCREVA O QUE A EMPRESA REALMENTE FAZ
          </span>

          <textarea
            rows={4}
            value={
              descricaoAtividadeCliente
            }
            onChange={(e) =>
              setDescricaoAtividadeCliente(
                e.target.value
              )
            }
            placeholder="Ex.: Representação comercial de equipamentos industriais, venda por comissão e intermediação B2B para empresas do Paraná e Santa Catarina."
            style={{
              ...inputStyle(),
              resize: "vertical",
              fontFamily:
                BODY_FONT,
            }}
          />
        </label>

        <div
          style={{
            marginTop: 10,
            background:
              "#EEF3FF",
            color: "#31589C",
            borderRadius: 10,
            padding: 10,
            fontSize: 9.5,
            lineHeight: 1.5,
          }}
        >
          A IA usará em conjunto: CNAE principal cadastrado, CNAEs selecionados, atividade principal real, descrição da operação, documentos e dados manuais.
        </div>
      </Card>

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
