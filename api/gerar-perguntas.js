// api/gerar-perguntas.js

export default async function handler(req, res) {
  // =========================================================
  // 1. VALIDAR MÉTODO
  // =========================================================

  if (req.method !== "POST") {
    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  // =========================================================
  // 2. VALIDAR OPENAI
  // =========================================================

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      sucesso: false,
      error: "OPENAI_API_KEY não configurada.",
    });
  }

  // =========================================================
  // 3. RECEBER EXATAMENTE O PAYLOAD DO APP.JSX
  // =========================================================

  const payload = req.body || {};

  const {
    segmentoAtual,
    categoriaAtual,

    cnaePrincipal,
    cnaesSecundarios,
    atividadesSelecionadas,
    atividadePredominante,

    descricaoNegocio,

    empresas,

    perfil = {},

    dor = {},

    areasSelecionadas,
  } = payload;

  // =========================================================
  // 4. VALIDAR DESCRIÇÃO DO NEGÓCIO
  // =========================================================

  const descricao =
    String(
      descricaoNegocio || ""
    ).trim();

  if (descricao.length < 20) {
    return res.status(400).json({
      sucesso: false,
      error:
        "Descreva brevemente o que a empresa realmente faz.",
    });
  }

  // =========================================================
  // 5. VALIDAR ÁREAS
  // =========================================================

  if (
    !Array.isArray(
      areasSelecionadas
    ) ||
    areasSelecionadas.length === 0
  ) {
    return res.status(400).json({
      sucesso: false,
      error:
        "Selecione pelo menos uma área para o diagnóstico.",
    });
  }

  // =========================================================
  // 6. NORMALIZAR ÁREAS RECEBIDAS DO APP
  // =========================================================
  //
  // O App envia:
  //
  // [
  //   {
  //     id: "financeiro",
  //     label: "Financeiro PF/PJ"
  //   },
  //   {
  //     id: "operacional",
  //     label: "Operacional"
  //   }
  // ]
  //
  // O retorno PRECISA preservar esse id.
  // =========================================================

  const AREAS_VALIDAS = {
    marketing: "Marketing",

    juridico: "Jurídico",

    contabilidade:
      "Contábil / Fiscal",

    financeiro:
      "Financeiro PF/PJ",

    administrativo:
      "Administrativo",

    gestao:
      "Gestão",

    operacional:
      "Operacional",

    rh:
      "Pessoas / RH",

    comercial:
      "Comercial / Vendas",

    tecnologia:
      "Tecnologia",
  };

  const areasNormalizadas =
    areasSelecionadas
      .map((area) => {
        if (!area) {
          return null;
        }

        // Caso venha objeto
        if (
          typeof area ===
          "object"
        ) {
          const id =
            String(
              area.id || ""
            ).trim();

          if (
            id &&
            AREAS_VALIDAS[id]
          ) {
            return {
              id,

              label:
                area.label ||
                AREAS_VALIDAS[id],
            };
          }

          return null;
        }

        // Compatibilidade caso venha string
        const texto =
          String(area).trim();

        if (
          AREAS_VALIDAS[
            texto
          ]
        ) {
          return {
            id: texto,

            label:
              AREAS_VALIDAS[
                texto
              ],
          };
        }

        return null;
      })
      .filter(Boolean);

  if (
    areasNormalizadas.length === 0
  ) {
    return res.status(400).json({
      sucesso: false,
      error:
        "As áreas selecionadas não puderam ser reconhecidas.",
    });
  }

  // =========================================================
  // 7. PROMPT PRINCIPAL
  // =========================================================

  const systemPrompt = `
Você é um CONSULTOR EMPRESARIAL SÊNIOR.

Sua tarefa é construir um QUESTIONÁRIO EMPRESARIAL PERSONALIZADO.

Você NÃO está fazendo o diagnóstico final ainda.

Você deve:

1. entender o que a empresa realmente faz;
2. confrontar essa descrição com CNAEs e atividades cadastradas;
3. interpretar o modelo real do negócio;
4. identificar riscos naturais daquela atividade;
5. considerar somente os departamentos selecionados;
6. gerar perguntas específicas;
7. produzir perguntas capazes de revelar problemas reais;
8. evitar perguntas genéricas.

=========================================================
REGRA PRINCIPAL
=========================================================

NÃO assuma que o CNAE principal representa corretamente
a operação real da empresa.

Utilize esta ordem de relevância:

1. descrição livre fornecida pelo participante;
2. atividade predominante indicada pelo participante;
3. atividades que o participante informou exercer;
4. CNAE principal;
5. CNAEs secundários;
6. segmento/classificação automática.

A DESCRIÇÃO REAL DO NEGÓCIO deve possuir peso elevado.

=========================================================
EXEMPLO IMPORTANTE
=========================================================

CNAE:

"Serviços combinados de escritório e apoio administrativo"

Descrição informada:

"Indústria de churrasqueiras para consumidor final e construtoras."

A empresa NÃO deve ser diagnosticada como
empresa de apoio administrativo.

O contexto operacional predominante é:

INDÚSTRIA / FABRICAÇÃO DE CHURRASQUEIRAS.

As perguntas precisam investigar coisas como:

- custo por produto;
- matéria-prima;
- ficha técnica;
- perdas;
- estoque;
- capacidade produtiva;
- formação de preço;
- margem;
- PCP;
- produtividade;
- retrabalho;
- prazo de produção.

=========================================================
CONFRONTO CADASTRAL
=========================================================

Compare:

- CNAE principal;
- CNAEs secundários;
- atividades selecionadas;
- atividade predominante;
- descrição real.

Se houver divergência:

NÃO diga automaticamente que existe irregularidade.

Utilize uma leitura como:

"Há aparente diferença entre parte das atividades cadastrais
e a operação descrita pelo participante, recomendando validação cadastral posterior."

=========================================================
INTERPRETAR O NEGÓCIO
=========================================================

Antes de gerar perguntas, determine:

- segmento real;
- subsegmento;
- modelo operacional;
- modelo de receita;
- características da operação;
- riscos naturais;
- divergências cadastrais;
- confiança da interpretação.

=========================================================
EMPRESAS COM MAIS DE UM CNPJ
=========================================================

Se houver várias empresas:

- considere a primeira como empresa-base;
- use as demais como contexto;
- não presuma que todas têm a mesma atividade;
- identifique complementaridades;
- não misture perguntas sem necessidade.

O questionário deve continuar orientado
à EMPRESA-BASE e às áreas selecionadas.

=========================================================
ÁREAS SELECIONADAS
=========================================================

Você receberá as áreas no formato:

{
  "id": "financeiro",
  "label": "Financeiro PF/PJ"
}

IMPORTANTE:

O campo areaId de CADA pergunta deve ser
EXATAMENTE um dos IDs enviados.

NUNCA invente areaId.

Exemplos válidos:

marketing
juridico
contabilidade
financeiro
administrativo
gestao
operacional
rh
comercial
tecnologia

=========================================================
OPERACIONAL
=========================================================

Se "operacional" estiver selecionado,
investigue os principais riscos operacionais
do negócio real.

Para indústria:

- ficha técnica;
- matéria-prima;
- consumo previsto x real;
- produto em processo;
- produto acabado;
- PCP;
- ordem de produção;
- capacidade;
- gargalo;
- produtividade;
- perdas;
- refugo;
- retrabalho;
- sucata;
- manutenção;
- qualidade;
- prazo.

Exemplos:

"A empresa possui ficha técnica atualizada por modelo,
com quantidade prevista dos principais materiais?"

"A empresa compara o consumo real de matéria-prima
com o consumo previsto para cada produto?"

"Refugo, desperdício e retrabalho são medidos
e acompanhados periodicamente?"

"A empresa conhece a capacidade produtiva
das principais etapas de fabricação?"

"Existe programação da produção considerando
pedidos, capacidade e prazo prometido ao cliente?"

=========================================================
FINANCEIRO
=========================================================

Se "financeiro" estiver selecionado,
investigue:

- fluxo de caixa;
- projeção;
- contas a pagar;
- contas a receber;
- conciliação;
- inadimplência;
- margem;
- ponto de equilíbrio;
- capital de giro;
- custo;
- rentabilidade;
- necessidade de caixa;
- prazo médio.

Para indústria, adapte:

"A empresa conhece o custo completo
de fabricação de cada produto?"

"O custo utilizado para formar o preço inclui
matéria-prima, mão de obra e custos indiretos?"

"A empresa acompanha margem por modelo
ou família de produto?"

"A projeção financeira considera
compras de matéria-prima, prazo de produção
e recebimento das vendas?"

"A empresa conhece seu ponto de equilíbrio?"

=========================================================
COMERCIAL
=========================================================

Se "comercial" estiver selecionado,
investigue:

- CRM;
- propostas;
- follow-up;
- conversão;
- ticket;
- carteira;
- recorrência;
- descontos;
- margem;
- concentração;
- forecast;
- motivos de perda.

Para indústria:

"A equipe comercial conhece a margem mínima
aceitável antes de conceder descontos?"

"A empresa conhece quais produtos apresentam
maior margem e utiliza essa informação
na estratégia comercial?"

"Pedidos personalizados possuem orçamento
considerando custo e complexidade específicos?"

"O prazo prometido pelo comercial considera
a capacidade real da produção?"

=========================================================
MARKETING
=========================================================

Se "marketing" estiver selecionado:

- origem dos leads;
- canais;
- posicionamento;
- público;
- conversão;
- CAC;
- mensuração;
- integração marketing/comercial.

Não conclua que mais investimento resolve o problema.

=========================================================
ADMINISTRATIVO
=========================================================

Se "administrativo" estiver selecionado:

- processos;
- procedimentos;
- documentação;
- retrabalho;
- aprovações;
- responsabilidades;
- rotina;
- dependência de pessoas.

=========================================================
GESTÃO
=========================================================

Se "gestao" estiver selecionado:

- indicadores;
- metas;
- reuniões;
- acompanhamento;
- planejamento;
- decisões;
- responsabilidades;
- visão de resultado.

=========================================================
PESSOAS / RH
=========================================================

Se "rh" estiver selecionado:

- funções;
- produtividade;
- treinamento;
- capacidade;
- rotatividade;
- liderança;
- dependência de pessoas-chave.

Não faça diagnóstico psicológico.

=========================================================
CONTÁBIL / FISCAL
=========================================================

Se "contabilidade" estiver selecionado:

- DRE;
- balancete;
- conciliações;
- estoque;
- custo;
- centros de custo;
- fechamento;
- cadastros;
- emissão fiscal;
- qualidade de informação;
- integração;
- regime tributário.

Não conclua automaticamente
que existe imposto pago a maior.

=========================================================
JURÍDICO
=========================================================

Se "juridico" estiver selecionado:

- contratos;
- formalização;
- responsabilidade;
- documentação;
- riscos contratuais;
- proteção empresarial;
- obrigações.

Não conclua que existe passivo sem evidência.

=========================================================
TECNOLOGIA
=========================================================

Se "tecnologia" estiver selecionado:

- ERP;
- CRM;
- BI;
- automação;
- integrações;
- planilhas;
- dados;
- backups;
- acessos;
- segurança.

=========================================================
INDÚSTRIA
=========================================================

Quando identificar indústria,
considere de forma transversal:

CUSTO:
- ficha técnica;
- custo unitário;
- matéria-prima;
- mão de obra;
- custos indiretos;
- custo padrão;
- custo realizado.

ESTOQUE:
- matéria-prima;
- produto em processo;
- produto acabado;
- inventário;
- divergência sistema x físico;
- giro;
- estoque parado.

PRODUÇÃO:
- PCP;
- capacidade;
- gargalo;
- produtividade;
- utilização;
- prazo;
- manutenção.

PERDAS:
- refugo;
- sucata;
- desperdício;
- retrabalho.

MARGEM:
- produto;
- família;
- cliente;
- pedido.

=========================================================
FABRICAÇÃO SOB ENCOMENDA
=========================================================

Se houver produtos personalizados,
considere:

- orçamento por pedido;
- projeto;
- alteração de escopo;
- custo previsto;
- custo realizado;
- material por pedido;
- mão de obra por pedido;
- margem por pedido;
- prazo;
- retrabalho.

=========================================================
COMÉRCIO
=========================================================

Quando houver comércio:

- margem por produto;
- markup;
- estoque;
- curva ABC;
- giro;
- ruptura;
- estoque parado;
- compras;
- descontos;
- ticket;
- canal;
- rentabilidade.

=========================================================
SERVIÇOS
=========================================================

Quando houver serviços:

- margem por cliente;
- custo/hora;
- horas utilizadas;
- capacidade;
- produtividade;
- preço;
- contratos;
- recorrência;
- concentração;
- retrabalho.

=========================================================
DOR DECLARADA
=========================================================

Considere a dor informada pelo participante.

Mas NÃO trate automaticamente
a dor como causa.

Exemplo:

Dor:
"Preciso vender mais."

Se a empresa não conhece custo,
margem ou capacidade,
faça perguntas para testar
se aumentar venda é realmente
o principal problema.

=========================================================
OBJETIVO DE 90 DIAS
=========================================================

Utilize também o objetivo dos próximos 90 dias
para escolher perguntas de maior poder diagnóstico.

=========================================================
FORMATO DAS PERGUNTAS
=========================================================

As perguntas precisam permitir resposta:

SIM
PARCIALMENTE
NÃO

Não faça perguntas abertas.

ERRADO:

"Qual o custo do seu produto?"

CERTO:

"A empresa conhece o custo completo
de fabricação de cada produto?"

=========================================================
QUANTIDADE
=========================================================

Gere normalmente:

5 a 7 perguntas por área.

Se houver 3 áreas,
o questionário deve ter aproximadamente
15 a 21 perguntas.

Evite excesso.

Priorize poder diagnóstico.

=========================================================
IMPORTÂNCIA
=========================================================

Cada pergunta deve possuir:

importancia:

1 = complementar
2 = importante
3 = crítica

Use 3 somente para pontos realmente críticos.

Também devolva:

peso

com o MESMO valor de importancia.

=========================================================
RISCO AVALIADO
=========================================================

Cada pergunta deve conter
o risco que ela pretende investigar.

Exemplo:

Pergunta:

"A empresa conhece o custo completo
de fabricação por produto?"

Risco:

"Formação de preço com base de custo incompleta,
comprometendo a análise da margem."

=========================================================
MOTIVO
=========================================================

Explique por que a pergunta é importante.

Essa informação será usada
no diagnóstico final.

=========================================================
EVITAR DUPLICIDADE
=========================================================

Não faça várias perguntas
avaliando exatamente a mesma coisa.

=========================================================
QUALIDADE DAS PERGUNTAS
=========================================================

Pergunta genérica:

"Controla estoque?"

Pergunta adequada:

"O estoque físico de matéria-prima
e produtos acabados é comparado periodicamente
com as quantidades registradas no sistema?"

Pergunta genérica:

"Controla custos?"

Pergunta adequada:

"A empresa conhece o custo completo
de fabricação de cada modelo,
incluindo materiais, mão de obra
e custos indiretos?"

=========================================================
NÃO INVENTAR
=========================================================

Não afirme que a empresa:

- tem prejuízo;
- tem margem baixa;
- tem estoque errado;
- tem dívida;
- possui irregularidade;
- paga imposto errado.

Você está construindo perguntas
para descobrir essas informações.

=========================================================
RETORNO
=========================================================

Produza:

negocioInterpretado

com:

segmentoReal
segmento
subsegmento
modeloNegocio
modeloOperacional
resumoNegocio
justificativa
comoGeraReceita
caracteristicasOperacionais
riscosNaturais
divergenciasCadastrais
nivelConfianca

E produza:

perguntas

Cada pergunta deve possuir:

id
areaId
area
tema
pergunta
motivo
riscoAvaliado
peso
importancia

=========================================================
REGRA CRÍTICA DE areaId
=========================================================

O areaId DEVE ser exatamente o mesmo id
de uma das áreas recebidas.

Exemplo:

Entrada:

[
  {
    "id": "operacional",
    "label": "Operacional"
  },
  {
    "id": "financeiro",
    "label": "Financeiro PF/PJ"
  },
  {
    "id": "comercial",
    "label": "Comercial / Vendas"
  }
]

Saída permitida:

"areaId": "operacional"

ou

"areaId": "financeiro"

ou

"areaId": "comercial"

NÃO produza:

"areaId": "producao"

NÃO produza:

"areaId": "custos"

NÃO produza:

"areaId": "estoque"

Esses assuntos devem aparecer em "tema",
não em areaId.

=========================================================
VALIDAÇÃO FINAL
=========================================================

Antes de responder:

1. Entendi o negócio real?
2. Dei mais peso à descrição do participante?
3. Cruzei CNAEs e operação?
4. Usei apenas áreas recebidas?
5. Todo areaId existe na entrada?
6. As perguntas são específicas?
7. Evitei perguntas genéricas?
8. Evitei duplicidades?
9. Todas podem ser respondidas Sim/Parcialmente/Não?
10. Estou perguntando em vez de presumir?
`;

  // =========================================================
  // 8. CONTEXTO PARA OPENAI
  // =========================================================

  const contexto = {
    empresaBase: {
      segmentoAtual:
        segmentoAtual || "",

      categoriaAtual:
        categoriaAtual || "",

      cnaePrincipal:
        cnaePrincipal || null,

      cnaesSecundarios:
        Array.isArray(
          cnaesSecundarios
        )
          ? cnaesSecundarios
          : [],

      atividadesSelecionadas:
        Array.isArray(
          atividadesSelecionadas
        )
          ? atividadesSelecionadas
          : [],

      atividadePredominante:
        atividadePredominante ||
        null,

      descricaoNegocio:
        descricao,
    },

    grupoEmpresarial:
      Array.isArray(empresas)
        ? empresas
        : [],

    perfil: {
      faturamento:
        perfil?.faturamento ||
        "",

      colaboradores:
        perfil?.colaboradores ||
        "",

      regime:
        perfil?.regime ||
        "",
    },

    dor: {
      principal:
        dor?.principal ||
        "",

      objetivo90Dias:
        dor?.objetivo90Dias ||
        "",

      impactos:
        Array.isArray(
          dor?.impactos
        )
          ? dor.impactos
          : [],
    },

    areasSelecionadas:
      areasNormalizadas,
  };

  // =========================================================
  // 9. SCHEMA
  // =========================================================

  const schema = {
    type: "object",

    additionalProperties: false,

    properties: {
      negocioInterpretado: {
        type: "object",

        additionalProperties: false,

        properties: {
          segmentoReal: {
            type: "string",
          },

          segmento: {
            type: "string",
          },

          subsegmento: {
            type: "string",
          },

          modeloNegocio: {
            type: "string",
          },

          modeloOperacional: {
            type: "string",
          },

          resumoNegocio: {
            type: "string",
          },

          justificativa: {
            type: "string",
          },

          comoGeraReceita: {
            type: "string",
          },

          caracteristicasOperacionais: {
            type: "array",

            items: {
              type: "string",
            },
          },

          riscosNaturais: {
            type: "array",

            items: {
              type: "string",
            },
          },

          divergenciasCadastrais: {
            type: "array",

            items: {
              type: "string",
            },
          },

          nivelConfianca: {
            type: "string",

            enum: [
              "alto",
              "medio",
              "baixo",
            ],
          },
        },

        required: [
          "segmentoReal",
          "segmento",
          "subsegmento",
          "modeloNegocio",
          "modeloOperacional",
          "resumoNegocio",
          "justificativa",
          "comoGeraReceita",
          "caracteristicasOperacionais",
          "riscosNaturais",
          "divergenciasCadastrais",
          "nivelConfianca",
        ],
      },

      perguntas: {
        type: "array",

        items: {
          type: "object",

          additionalProperties: false,

          properties: {
            id: {
              type: "string",
            },

            areaId: {
              type: "string",

              enum:
                areasNormalizadas.map(
                  (area) =>
                    area.id
                ),
            },

            area: {
              type: "string",
            },

            tema: {
              type: "string",
            },

            pergunta: {
              type: "string",
            },

            motivo: {
              type: "string",
            },

            riscoAvaliado: {
              type: "string",
            },

            peso: {
              type: "integer",

              minimum: 1,
              maximum: 3,
            },

            importancia: {
              type: "integer",

              minimum: 1,
              maximum: 3,
            },
          },

          required: [
            "id",
            "areaId",
            "area",
            "tema",
            "pergunta",
            "motivo",
            "riscoAvaliado",
            "peso",
            "importancia",
          ],
        },
      },

      alertasInterpretacao: {
        type: "array",

        items: {
          type: "string",
        },
      },
    },

    required: [
      "negocioInterpretado",
      "perguntas",
      "alertasInterpretacao",
    ],
  };

  // =========================================================
  // 10. CHAMAR OPENAI
  // =========================================================

  try {
    const modelo =
      process.env.OPENAI_MODEL ||
      "gpt-5.6";

    const response =
      await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${process.env.OPENAI_API_KEY}`,
          },

          body:
            JSON.stringify({
              model:
                modelo,

              reasoning: {
                effort:
                  "medium",
              },

              max_output_tokens:
                6000,

              input: [
                {
                  role:
                    "system",

                  content:
                    systemPrompt,
                },

                {
                  role:
                    "user",

                  content:
                    JSON.stringify(
                      contexto
                    ),
                },
              ],

              text: {
                format: {
                  type:
                    "json_schema",

                  name:
                    "questionario_empresarial_personalizado",

                  strict:
                    true,

                  schema,
                },
              },
            }),
        }
      );

    // =========================================================
    // 11. RESPOSTA OPENAI
    // =========================================================

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "Erro OpenAI gerar perguntas:",
        JSON.stringify(
          data,
          null,
          2
        )
      );

      return res
        .status(
          response.status
        )
        .json({
          sucesso: false,

          error:
            data?.error?.message ||
            "Erro ao gerar perguntas personalizadas.",
        });
    }

    // =========================================================
    // 12. EXTRAIR TEXTO
    // =========================================================

    let texto =
      data.output_text || "";

    if (
      !texto &&
      Array.isArray(
        data.output
      )
    ) {
      for (
        const item
        of data.output
      ) {
        if (
          item?.type !==
          "message"
        ) {
          continue;
        }

        if (
          !Array.isArray(
            item.content
          )
        ) {
          continue;
        }

        for (
          const content
          of item.content
        ) {
          if (
            content?.type ===
            "output_text"
          ) {
            texto =
              content.text ||
              "";

            break;
          }
        }

        if (texto) {
          break;
        }
      }
    }

    if (!texto) {
      return res
        .status(502)
        .json({
          sucesso: false,

          error:
            "A OpenAI não retornou perguntas.",
        });
    }

    // =========================================================
    // 13. CONVERTER JSON
    // =========================================================

    let parsed;

    try {
      parsed =
        JSON.parse(
          texto
        );
    } catch (error) {
      console.error(
        "Resposta inválida gerar-perguntas:",
        texto
      );

      return res
        .status(502)
        .json({
          sucesso: false,

          error:
            "A OpenAI retornou um formato inválido.",
        });
    }

    // =========================================================
    // 14. MAPA DE ÁREAS
    // =========================================================

    const mapaAreas =
      new Map(
        areasNormalizadas.map(
          (area) => [
            area.id,
            area,
          ]
        )
      );

    // =========================================================
    // 15. NORMALIZAR PERGUNTAS
    // =========================================================

    const perguntas =
      Array.isArray(
        parsed.perguntas
      )
        ? parsed.perguntas
            .map(
              (
                pergunta,
                index
              ) => {
                if (
                  !pergunta
                ) {
                  return null;
                }

                const areaId =
                  String(
                    pergunta.areaId ||
                    ""
                  ).trim();

                // CRÍTICO:
                // Só aceita área que veio do App.
                const areaOriginal =
                  mapaAreas.get(
                    areaId
                  );

                if (
                  !areaOriginal
                ) {
                  console.warn(
                    "Pergunta descartada por areaId inválido:",
                    pergunta
                  );

                  return null;
                }

                const importancia =
                  [1, 2, 3].includes(
                    Number(
                      pergunta.importancia
                    )
                  )
                    ? Number(
                        pergunta.importancia
                      )
                    : [1, 2, 3].includes(
                        Number(
                          pergunta.peso
                        )
                      )
                      ? Number(
                          pergunta.peso
                        )
                      : 2;

                return {
                  id:
                    String(
                      pergunta.id ||
                      `ia_${index + 1}`
                    ),

                  // Este é o campo que o App.jsx usa
                  areaId:
                    areaOriginal.id,

                  area:
                    areaOriginal.label,

                  tema:
                    String(
                      pergunta.tema ||
                      "Diagnóstico específico"
                    ),

                  pergunta:
                    String(
                      pergunta.pergunta ||
                      ""
                    ),

                  motivo:
                    String(
                      pergunta.motivo ||
                      ""
                    ),

                  riscoAvaliado:
                    String(
                      pergunta.riscoAvaliado ||
                      ""
                    ),

                  peso:
                    importancia,

                  // Este é o campo que o App.jsx atual lê
                  importancia:
                    importancia,
                };
              }
            )
            .filter(
              (pergunta) =>
                pergunta &&
                pergunta.areaId &&
                pergunta.pergunta
            )
        : [];

    // =========================================================
    // 16. GARANTIR PERGUNTAS POR TODAS AS ÁREAS
    // =========================================================

    const areasSemPerguntas =
      areasNormalizadas.filter(
        (area) =>
          !perguntas.some(
            (pergunta) =>
              pergunta.areaId ===
              area.id
          )
      );

    if (
      areasSemPerguntas.length >
      0
    ) {
      console.error(
        "Áreas sem perguntas:",
        areasSemPerguntas
      );

      return res
        .status(502)
        .json({
          sucesso: false,

          error:
            `Não foram geradas perguntas para: ${areasSemPerguntas
              .map(
                (area) =>
                  area.label
              )
              .join(", ")}. Tente gerar novamente.`,
        });
    }

    if (
      perguntas.length === 0
    ) {
      return res
        .status(502)
        .json({
          sucesso: false,

          error:
            "Nenhuma pergunta válida foi gerada.",
        });
    }

    // =========================================================
    // 17. NORMALIZAR INTERPRETAÇÃO
    // =========================================================

    const negocioBruto =
      parsed.negocioInterpretado ||
      {};

    const segmentoReal =
      String(
        negocioBruto.segmentoReal ||
        negocioBruto.segmento ||
        segmentoAtual ||
        ""
      );

    const modeloNegocio =
      String(
        negocioBruto.modeloNegocio ||
        negocioBruto.modeloOperacional ||
        ""
      );

    const resumoNegocio =
      String(
        negocioBruto.resumoNegocio ||
        negocioBruto.justificativa ||
        ""
      );

    const negocioInterpretadoFinal = {
      // CAMPOS NOVOS
      segmentoReal,

      subsegmento:
        String(
          negocioBruto.subsegmento ||
          ""
        ),

      modeloNegocio,

      resumoNegocio,

      comoGeraReceita:
        String(
          negocioBruto.comoGeraReceita ||
          ""
        ),

      caracteristicasOperacionais:
        Array.isArray(
          negocioBruto
            .caracteristicasOperacionais
        )
          ? negocioBruto
              .caracteristicasOperacionais
              .slice(0, 8)
          : [],

      riscosNaturais:
        Array.isArray(
          negocioBruto.riscosNaturais
        )
          ? negocioBruto
              .riscosNaturais
              .slice(0, 8)
          : [],

      divergenciasCadastrais:
        Array.isArray(
          negocioBruto
            .divergenciasCadastrais
        )
          ? negocioBruto
              .divergenciasCadastrais
              .slice(0, 5)
          : [],

      nivelConfianca:
        String(
          negocioBruto.nivelConfianca ||
          "medio"
        ),

      // =====================================================
      // CAMPOS DE COMPATIBILIDADE COM APP.JSX ATUAL
      // =====================================================

      segmento:
        segmentoReal,

      modeloOperacional:
        modeloNegocio,

      justificativa:
        resumoNegocio,
    };

    // =========================================================
    // 18. LOG DE TESTE
    // =========================================================

    console.log(
      "Questionário personalizado gerado:",
      {
        modelo,

        negocio:
          negocioInterpretadoFinal
            .subsegmento,

        areas:
          areasNormalizadas,

        totalPerguntas:
          perguntas.length,

        perguntasPorArea:
          areasNormalizadas.map(
            (area) => ({
              area:
                area.label,

              quantidade:
                perguntas.filter(
                  (pergunta) =>
                    pergunta.areaId ===
                    area.id
                ).length,
            })
          ),
      }
    );

    // =========================================================
    // 19. RETORNO FINAL PARA APP.JSX
    // =========================================================

    return res
      .status(200)
      .json({
        sucesso: true,

        modelo,

        negocioInterpretado:
          negocioInterpretadoFinal,

        perguntas,

        alertasInterpretacao:
          Array.isArray(
            parsed.alertasInterpretacao
          )
            ? parsed
                .alertasInterpretacao
                .slice(0, 5)
            : [],

        resumoGeracao: {
          totalPerguntas:
            perguntas.length,

          areas:
            areasNormalizadas.map(
              (area) => ({
                id:
                  area.id,

                label:
                  area.label,

                quantidadePerguntas:
                  perguntas.filter(
                    (pergunta) =>
                      pergunta.areaId ===
                      area.id
                  ).length,
              })
            ),
        },
      });

  } catch (error) {
    // =========================================================
    // 20. ERRO GERAL
    // =========================================================

    console.error(
      "Erro geral em gerar-perguntas:",
      error
    );

    return res
      .status(500)
      .json({
        sucesso: false,

        error:
          "Erro interno ao gerar o questionário personalizado.",
      });
  }
}
