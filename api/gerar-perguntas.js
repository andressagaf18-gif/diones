// api/gerar-perguntas.js

const AREAS_VALIDAS = [
  "marketing",
  "juridico",
  "contabilidade",
  "financeiro",
  "administrativo",
  "gestao",
  "operacional",
  "rh",
  "comercial",
  "tecnologia",
];

function extrairOutputText(data) {
  if (
    typeof data?.output_text === "string" &&
    data.output_text.trim()
  ) {
    return data.output_text.trim();
  }

  if (!Array.isArray(data?.output)) {
    return "";
  }

  for (const item of data.output) {
    if (
      item?.type !== "message" ||
      !Array.isArray(item.content)
    ) {
      continue;
    }

    for (const content of item.content) {
      if (
        content?.type === "output_text" &&
        content.text
      ) {
        return String(content.text).trim();
      }
    }
  }

  return "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      sucesso: false,
      error: "OPENAI_API_KEY não configurada.",
    });
  }

  const body = req.body || {};

  const descricaoNegocio =
    String(
      body.descricaoNegocio || ""
    ).trim();

  const areasSelecionadas =
    Array.isArray(
      body.areasSelecionadas
    )
      ? body.areasSelecionadas.filter(
          (area) =>
            area &&
            AREAS_VALIDAS.includes(
              area.id
            )
        )
      : [];

  if (descricaoNegocio.length < 20) {
    return res.status(400).json({
      sucesso: false,
      error:
        "Descrição do negócio insuficiente.",
    });
  }

  if (!areasSelecionadas.length) {
    return res.status(400).json({
      sucesso: false,
      error:
        "Nenhuma área selecionada.",
    });
  }

  // =========================================================
  // VALIDAR / NORMALIZAR DORES
  // =========================================================

  const doresSelecionadas =
    Array.isArray(
      body?.dor?.selecionadas
    )
      ? body.dor.selecionadas
      : Array.isArray(
          body.doresSelecionadas
        )
        ? body.doresSelecionadas
        : [];

  const dorPrincipal =
    body?.dor?.principal ||
    body.dorPrincipal ||
    doresSelecionadas[0] ||
    "";

  const objetivo90Dias =
    body?.dor?.objetivo90Dias ||
    body.dor90Dias ||
    "";

  const impactosDor =
    Array.isArray(
      body?.dor?.impactos
    )
      ? body.dor.impactos
      : Array.isArray(
          body.impactosDor
        )
        ? body.impactosDor
        : [];

  // =========================================================
  // PROMPT
  // =========================================================

  const prompt = `
Você é um CONSULTOR EMPRESARIAL SÊNIOR responsável por construir um CHECKLIST PERSONALIZADO antes de um diagnóstico empresarial.

Sua missão possui duas etapas:

1. INTERPRETAR O NEGÓCIO REAL.
2. GERAR PERGUNTAS ESPECÍFICAS para os departamentos escolhidos.

=========================================================
REGRA MAIS IMPORTANTE
=========================================================

O CNAE é apenas uma evidência cadastral.

NÃO presuma que o CNAE principal descreve sozinho o negócio real.

Use esta ordem de relevância:

1. descrição livre fornecida pelo participante;
2. atividade predominante escolhida pelo participante;
3. atividades que o participante declarou realmente exercer;
4. CNAE principal;
5. CNAEs secundários;
6. classificação automática previamente existente.

Se houver divergência entre CNAE e descrição do participante, priorize a realidade operacional descrita.

Porém NÃO afirme automaticamente que existe irregularidade.

Você pode indicar que existe divergência cadastral/operacional que merece validação posterior.

=========================================================
EXEMPLO IMPORTANTE
=========================================================

CNAE:

"Serviços combinados de escritório e apoio administrativo"

Descrição:

"Fabricamos churrasqueiras metálicas e vendemos para consumidores finais, lojistas e construtoras."

A interpretação NÃO deve ser:

"empresa de apoio administrativo".

A interpretação deve considerar:

INDÚSTRIA / FABRICAÇÃO / COMERCIALIZAÇÃO DE CHURRASQUEIRAS.

Portanto, as perguntas devem investigar, quando pertinente:

- custo por produto;
- matéria-prima;
- ficha técnica;
- estoque;
- perdas;
- retrabalho;
- capacidade produtiva;
- PCP;
- formação de preço;
- margem;
- prazo;
- comercialização.

=========================================================
INTERPRETAÇÃO DO NEGÓCIO
=========================================================

Antes de gerar as perguntas, determine:

- segmento real;
- subsegmento;
- modelo operacional;
- como a empresa provavelmente gera receita;
- principais características operacionais;
- riscos naturais;
- pontos cadastrais que merecem validação;
- nível de confiança da interpretação.

=========================================================
ÁREAS SELECIONADAS
=========================================================

Você receberá áreas no formato:

{
  "id": "financeiro",
  "label": "Financeiro PF/PJ"
}

O campo areaId de cada pergunta DEVE ser exatamente um dos IDs recebidos.

NUNCA invente novos IDs.

Exemplos possíveis:

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

Temas como:

custos
estoque
produção
PCP
margem
qualidade

devem aparecer em "tema", e NÃO em areaId.

=========================================================
MÚLTIPLAS DORES
=========================================================

O participante pode selecionar MAIS DE UMA dor.

Considere TODAS.

Não trate as dores como causas confirmadas.

Considere cada dor como:

- percepção;
- possível sintoma;
- possível consequência;
- possível problema real.

As perguntas devem ajudar a descobrir como essas dores podem estar relacionadas.

Exemplo:

Dores:

- falta de caixa;
- margem baixa;
- vendas abaixo do esperado;
- estoque alto.

Não gere simplesmente perguntas separadas sobre cada dor.

Procure relações entre:

VENDAS
→
PREÇO
→
CUSTO
→
MARGEM
→
ESTOQUE
→
CAPITAL DE GIRO
→
CAIXA

O questionário deve ajudar a descobrir:

1. quais dores parecem sintomas;
2. quais podem estar relacionadas;
3. quais controles podem explicar mais de uma dor;
4. qual problema estrutural merece maior investigação.

Não concentre o questionário somente na primeira dor selecionada.

=========================================================
OBJETIVO DOS PRÓXIMOS 90 DIAS
=========================================================

Considere também o problema que o empresário gostaria de resolver nos próximos 90 dias.

Use essa informação para escolher perguntas mais relevantes.

Porém não aceite automaticamente essa prioridade como correta.

Exemplo:

O empresário diz:

"preciso vender mais".

Mas existem indícios de que ele não conhece:

- margem;
- custo;
- capacidade;
- estoque.

Gere perguntas para testar se crescer vendas realmente deve ser a prioridade.

=========================================================
QUANTIDADE
=========================================================

Gere normalmente entre 5 e 7 perguntas por área selecionada.

Se houver 3 áreas:

aproximadamente 15 a 21 perguntas.

Priorize qualidade e poder diagnóstico.

Evite excesso.

=========================================================
FORMATO
=========================================================

TODAS as perguntas devem ser respondíveis com:

SIM
PARCIALMENTE
NÃO

Formule as perguntas de modo que:

SIM = controle existente / boa prática

PARCIALMENTE = controle incompleto ou inconsistente

NÃO = ausência ou fragilidade

=========================================================
PERGUNTAS RUINS X BOAS
=========================================================

Pergunta ruim:

"Controla custos?"

Pergunta adequada:

"A empresa conhece o custo completo de fabricação de cada produto, considerando matéria-prima, mão de obra e custos indiretos?"

Pergunta ruim:

"Controla estoque?"

Pergunta adequada:

"O estoque físico de matéria-prima e produtos acabados é comparado periodicamente com as quantidades registradas no sistema?"

=========================================================
INDÚSTRIA
=========================================================

Quando identificar atividade industrial, considere:

CUSTO INDUSTRIAL

- ficha técnica;
- custo real por produto;
- matéria-prima;
- mão de obra direta;
- custos indiretos;
- custo padrão;
- custo realizado;
- margem por produto;
- margem por família;
- formação de preço.

ESTOQUE

- matéria-prima;
- produto em processo;
- produto acabado;
- inventário;
- estoque físico x sistema;
- giro;
- cobertura;
- estoque parado;
- obsolescência.

PRODUÇÃO

- PCP;
- ordens de produção;
- capacidade;
- máquinas;
- produtividade;
- gargalos;
- lead time;
- prazo;
- paradas;
- manutenção.

PERDAS

- desperdício;
- sucata;
- refugo;
- retrabalho;
- consumo real x padrão.

QUALIDADE

- inspeção;
- devolução;
- não conformidade;
- retrabalho;
- indicador.

MARGEM

- margem por produto;
- margem por família;
- margem por pedido;
- margem por cliente.

=========================================================
FABRICAÇÃO SOB ENCOMENDA
=========================================================

Se existir fabricação personalizada ou sob encomenda, considere:

- orçamento por pedido;
- consumo de material;
- mão de obra;
- custo previsto;
- custo realizado;
- alteração de escopo;
- prazo;
- retrabalho;
- compras específicas;
- margem por pedido.

=========================================================
COMÉRCIO
=========================================================

Quando houver comércio, considere:

- margem por SKU;
- margem por categoria;
- markup;
- preço;
- estoque;
- curva ABC;
- giro;
- cobertura;
- ruptura;
- estoque parado;
- compras;
- fornecedores;
- descontos;
- ticket;
- canais;
- conversão;
- rentabilidade por canal.

=========================================================
SERVIÇOS
=========================================================

Quando houver serviços, considere:

- margem por cliente;
- margem por contrato;
- horas consumidas;
- custo/hora;
- capacidade;
- produtividade;
- precificação;
- contratos;
- recorrência;
- concentração;
- inadimplência;
- retrabalho;
- dependência dos sócios.

=========================================================
FINANCEIRO
=========================================================

Quando areaId for "financeiro", considere:

- caixa;
- projeção;
- contas a pagar;
- contas a receber;
- conciliação;
- inadimplência;
- margem;
- rentabilidade;
- custos;
- ponto de equilíbrio;
- capital de giro;
- necessidade de caixa;
- prazo de pagamento;
- prazo de recebimento;
- orçamento.

Sempre adapte ao negócio real.

Exemplo indústria:

"A empresa projeta a necessidade de caixa considerando compra de matéria-prima, prazo de fabricação e prazo de recebimento dos clientes?"

=========================================================
OPERACIONAL
=========================================================

Quando areaId for "operacional", considere:

- produção;
- entrega;
- capacidade;
- gargalos;
- qualidade;
- estoque;
- perdas;
- produtividade;
- prazo;
- retrabalho;
- planejamento.

Sempre adapte ao negócio.

=========================================================
COMERCIAL
=========================================================

Quando areaId for "comercial", considere:

- CRM;
- funil;
- propostas;
- follow-up;
- conversão;
- ticket;
- recorrência;
- margem;
- descontos;
- mix;
- concentração;
- forecast;
- capacidade de entrega.

=========================================================
MARKETING
=========================================================

Quando areaId for "marketing", considere:

- origem dos leads;
- posicionamento;
- canais;
- público;
- mensuração;
- conversão;
- aquisição;
- integração com comercial.

Não presuma que aumentar investimento é a solução.

=========================================================
CONTÁBIL / FISCAL
=========================================================

Quando areaId for "contabilidade", considere:

- DRE;
- balancete;
- conciliação;
- estoque;
- centros de custo;
- fechamento;
- cadastros;
- emissão fiscal;
- integração;
- regime tributário;
- qualidade das informações.

Não conclua que existe imposto pago a maior.

=========================================================
GESTÃO
=========================================================

Quando areaId for "gestao", considere:

- indicadores;
- metas;
- reuniões;
- decisões;
- planejamento;
- acompanhamento;
- responsabilidades;
- visão de resultado.

=========================================================
ADMINISTRATIVO
=========================================================

Quando areaId for "administrativo", considere:

- processos;
- procedimentos;
- documentação;
- retrabalho;
- aprovações;
- responsabilidades;
- compras;
- organização.

=========================================================
RH
=========================================================

Quando areaId for "rh", considere:

- responsabilidades;
- capacidade;
- produtividade;
- treinamento;
- rotatividade;
- dependência de pessoas-chave;
- liderança.

Não faça diagnóstico psicológico.

=========================================================
TECNOLOGIA
=========================================================

Quando areaId for "tecnologia", considere:

- ERP;
- CRM;
- BI;
- integração;
- automação;
- planilhas;
- dados;
- backup;
- acesso;
- segurança;
- retrabalho manual.

=========================================================
JURÍDICO
=========================================================

Quando areaId for "juridico", considere:

- contratos;
- responsabilidades;
- formalização;
- documentação;
- riscos contratuais;
- proteção de dados.

Não dê parecer jurídico conclusivo.

=========================================================
MOTIVO
=========================================================

Cada pergunta deve trazer um motivo.

Explique por que aquela pergunta é relevante para o negócio.

=========================================================
RISCO AVALIADO
=========================================================

Cada pergunta deve informar qual risco empresarial está sendo investigado.

Exemplo:

Pergunta:

"A empresa conhece o custo completo de fabricação por produto?"

Risco avaliado:

"Formação de preço baseada em custo incompleto e baixa visibilidade da margem."

=========================================================
IMPORTÂNCIA
=========================================================

Use:

1 = complementar
2 = importante
3 = crítico

Use 3 somente quando aquele controle for realmente crítico ao modelo de negócio.

=========================================================
NÃO INVENTE
=========================================================

Não afirme que a empresa:

- tem prejuízo;
- tem estoque errado;
- possui dívida;
- tem margem baixa;
- possui irregularidade;
- paga imposto errado.

Você está construindo perguntas para DESCOBRIR.

=========================================================
RETORNO
=========================================================

Produza:

negocioInterpretado:
- segmento;
- subsegmento;
- modeloOperacional;
- justificativa;
- riscosNaturais.

E perguntas.

Cada pergunta deve possuir:

- id;
- areaId;
- area;
- tema;
- pergunta;
- motivo;
- riscoAvaliado;
- importancia.

=========================================================
REGRA CRÍTICA DO areaId
=========================================================

O areaId deve ser EXATAMENTE um dos IDs enviados em areasSelecionadas.

Exemplo entrada:

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

Saídas permitidas:

areaId = "operacional"

areaId = "financeiro"

areaId = "comercial"

NÃO use:

areaId = "producao"

areaId = "estoque"

areaId = "custos"

Esses termos pertencem ao campo tema.

=========================================================
VALIDAÇÃO FINAL
=========================================================

Antes de responder, confirme:

- entendi o negócio real?
- considerei a descrição do participante?
- considerei todos os CNAEs sem deixar que eles dominem a análise?
- considerei TODAS as dores?
- considerei o objetivo de 90 dias?
- usei apenas as áreas selecionadas?
- todo areaId existe na entrada?
- as perguntas são específicas?
- cada pergunta pode ser respondida Sim / Parcialmente / Não?
- evitei duplicidade?
- estou perguntando em vez de presumir?
`;

  // =========================================================
  // CONTEXTO
  // =========================================================

  const contexto = {
    ...body,

    descricaoNegocio,

    areasSelecionadas,

    dor: {
      selecionadas:
        doresSelecionadas,

      principal:
        dorPrincipal,

      objetivo90Dias,

      impactos:
        impactosDor,
    },
  };

  // =========================================================
  // SCHEMA
  // =========================================================

  const schema = {
    type: "object",

    additionalProperties: false,

    properties: {
      negocioInterpretado: {
        type: "object",

        additionalProperties: false,

        properties: {
          segmento: {
            type: "string",
          },

          subsegmento: {
            type: "string",
          },

          modeloOperacional: {
            type: "string",
          },

          justificativa: {
            type: "string",
          },

          riscosNaturais: {
            type: "array",

            items: {
              type: "string",
            },
          },
        },

        required: [
          "segmento",
          "subsegmento",
          "modeloOperacional",
          "justificativa",
          "riscosNaturais",
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
                areasSelecionadas.map(
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
            "importancia",
          ],
        },
      },
    },

    required: [
      "negocioInterpretado",
      "perguntas",
    ],
  };

  // =========================================================
  // OPENAI
  // =========================================================

  try {
    const modelo =
      process.env.OPENAI_QUESTION_MODEL ||
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
                    prompt,
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
                    "checklist_personalizado",

                  strict:
                    true,

                  schema,
                },
              },
            }),
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "Erro OpenAI gerar-perguntas:",
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

    const text =
      extrairOutputText(
        data
      );

    if (!text) {
      return res
        .status(502)
        .json({
          sucesso: false,

          error:
            "A IA não retornou perguntas.",
        });
    }

    let parsed;

    try {
      parsed =
        JSON.parse(
          text
        );
    } catch (error) {
      console.error(
        "JSON inválido em gerar-perguntas:",
        text
      );

      return res
        .status(502)
        .json({
          sucesso: false,

          error:
            "A IA retornou um formato inválido.",
        });
    }

    // =========================================================
    // GARANTIR QUE areaId CONTINUE COMPATÍVEL COM O APP
    // =========================================================

    const idsPermitidos =
      new Set(
        areasSelecionadas.map(
          (area) =>
            area.id
        )
      );

    const labels =
      new Map(
        areasSelecionadas.map(
          (area) => [
            area.id,
            area.label,
          ]
        )
      );

    const perguntas =
      (
        Array.isArray(
          parsed.perguntas
        )
          ? parsed.perguntas
          : []
      )
        .filter(
          (pergunta) =>
            idsPermitidos.has(
              pergunta.areaId
            )
        )
        .map(
          (
            pergunta,
            index
          ) => ({
            id:
              String(
                pergunta.id ||
                `ia_${index + 1}`
              )
                .replace(
                  /[^a-zA-Z0-9_-]/g,
                  "_"
                )
                .slice(
                  0,
                  80
                ),

            areaId:
              pergunta.areaId,

            area:
              labels.get(
                pergunta.areaId
              ) ||
              pergunta.area ||
              pergunta.areaId,

            tema:
              String(
                pergunta.tema ||
                "Diagnóstico"
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

            importancia:
              Math.max(
                1,
                Math.min(
                  3,
                  Number(
                    pergunta.importancia
                  ) ||
                  1
                )
              ),
          })
        )
        .filter(
          (pergunta) =>
            pergunta.pergunta
        );

    // =========================================================
    // GARANTIR QUE CADA ÁREA TENHA PERGUNTAS
    // =========================================================

    const areasSemPerguntas =
      areasSelecionadas.filter(
        (area) =>
          perguntas.filter(
            (pergunta) =>
              pergunta.areaId ===
              area.id
          ).length < 4
      );

    if (
      areasSemPerguntas.length
    ) {
      console.warn(
        "Áreas com poucas perguntas geradas:",
        areasSemPerguntas.map(
          (area) =>
            area.id
        )
      );
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

    return res
      .status(200)
      .json({
        sucesso: true,

        modelo,

        negocioInterpretado:
          parsed.negocioInterpretado,

        perguntas,

        resumoGeracao: {
          totalPerguntas:
            perguntas.length,

          doresConsideradas:
            doresSelecionadas,

          areas:
            areasSelecionadas.map(
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
    console.error(
      "Erro gerar-perguntas:",
      error
    );

    return res
      .status(500)
      .json({
        sucesso: false,

        error:
          "Erro interno ao gerar perguntas personalizadas.",
      });
  }
}
