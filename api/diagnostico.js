// api/diagnostico.js

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

function limitarArray(valor, limite = 5) {
  return Array.isArray(valor)
    ? valor.slice(0, limite)
    : [];
}

function nivelScore(score) {
  const valor = Number(score);

  if (!Number.isFinite(valor)) {
    return "critico";
  }

  if (valor >= 80) {
    return "bom";
  }

  if (valor >= 60) {
    return "atencao";
  }

  if (valor >= 40) {
    return "alto";
  }

  return "critico";
}

export default async function handler(req, res) {
  // =========================================================
  // 1. MÉTODO
  // =========================================================

  if (req.method !== "POST") {
    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  // =========================================================
  // 2. OPENAI
  // =========================================================

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      sucesso: false,
      error: "OPENAI_API_KEY não configurada.",
    });
  }

  // =========================================================
  // 3. RECEBER PAYLOAD
  // =========================================================

  const body = req.body || {};

  const {
    responsavel,

    segmento,
    categoria,
    codigoQuestionario,

    cnaePrincipal,
    cnaesSecundarios,
    atividadesSelecionadas,
    atividadePredominante,

    descricaoNegocio,
    negocioInterpretado,

    empresas,

    faturamento,
    colaboradores,
    regime,
    observacao,

    doresSelecionadas,
    dorPrincipal,
    dor90Dias,
    impactosDor,

    areas,
    scoreGeral,
  } = body;

  // =========================================================
  // 4. NORMALIZAR DORES
  // =========================================================

  const dores =
    Array.isArray(doresSelecionadas)
      ? doresSelecionadas.filter(Boolean)
      : Array.isArray(body?.dor?.selecionadas)
        ? body.dor.selecionadas.filter(Boolean)
        : [];

  const dorPrincipalFinal =
    dorPrincipal ||
    body?.dor?.principal ||
    dores[0] ||
    "";

  const dor90DiasFinal =
    dor90Dias ||
    body?.dor?.objetivo90Dias ||
    "";

  const impactosDorFinal =
    Array.isArray(impactosDor)
      ? impactosDor
      : Array.isArray(body?.dor?.impactos)
        ? body.dor.impactos
        : [];

  // =========================================================
  // 5. VALIDAR ÁREAS
  // =========================================================

  if (
    !Array.isArray(areas) ||
    areas.length === 0
  ) {
    return res.status(400).json({
      sucesso: false,
      error:
        "Nenhuma área foi enviada para análise.",
    });
  }

  // =========================================================
  // 6. PROMPT PRINCIPAL
  // =========================================================

  const systemPrompt = `
Você é um CONSULTOR EMPRESARIAL SÊNIOR.

Seu trabalho é interpretar um diagnóstico empresarial já respondido e transformar os dados em um relatório consultivo, profundo, específico e útil para tomada de decisão.

Você NÃO deve simplesmente repetir perguntas e respostas.

Você deve cruzar:

- descrição real do negócio;
- negócio interpretado previamente;
- atividade predominante;
- atividades efetivamente exercidas;
- CNAEs;
- segmento;
- múltiplas dores;
- objetivo de 90 dias;
- perguntas;
- respostas;
- motivos das perguntas;
- riscos avaliados;
- pesos;
- scores.

=========================================================
REGRA PRINCIPAL
=========================================================

Estruture mentalmente a análise desta forma:

DORES DECLARADAS
↓
EVIDÊNCIAS NAS RESPOSTAS
↓
POSSÍVEIS CAUSAS
↓
IMPACTOS
↓
PRIORIDADES
↓
AÇÕES

Não analise cada pergunta isoladamente.

Procure relações entre respostas de áreas diferentes.

=========================================================
NEGÓCIO REAL
=========================================================

Considere nesta ordem:

1. negocioInterpretado;
2. descricaoNegocio;
3. atividadePredominante;
4. atividadesSelecionadas;
5. CNAE principal;
6. CNAEs secundários;
7. segmento e categoria.

O CNAE é apenas uma evidência cadastral.

Não permita que um CNAE genérico prevaleça sobre a realidade operacional descrita pelo participante.

Exemplo:

CNAE:
"Apoio administrativo"

Descrição:
"Fabricamos churrasqueiras metálicas."

A análise deve considerar prioritariamente a operação industrial.

=========================================================
MÚLTIPLAS DORES
=========================================================

O empresário pode ter selecionado várias dores.

Exemplo:

- falta de caixa;
- margem baixa;
- vendas abaixo do esperado;
- estoque alto;
- custos elevados.

NÃO trate cada dor isoladamente.

NÃO considere automaticamente a primeira dor como a principal.

Considere cada dor como uma percepção que pode ser:

- sintoma;
- consequência;
- possível causa;
- problema independente;
- percepção ainda não confirmada.

Cruze as dores com as respostas.

Exemplo:

Dores:
- dinheiro não sobra;
- margem baixa;
- estoque alto.

Respostas:
- não conhece margem por produto;
- não conhece giro;
- não projeta caixa;
- não conhece capital de giro.

Leitura possível:

"A pressão de caixa pode estar relacionada à combinação entre baixa visibilidade da margem, capital imobilizado em estoque e ausência de projeção financeira."

Somente produza essa conclusão se houver suporte nas respostas.

=========================================================
OBJETIVO DOS PRÓXIMOS 90 DIAS
=========================================================

Compare o objetivo informado pelo empresário com os achados.

Se houver alinhamento, explique.

Se houver divergência, explique.

Exemplo:

Empresário:
"Preciso vender mais."

Mas as respostas indicam:

- não conhece custo;
- não conhece margem;
- não conhece capacidade;
- não conhece estoque.

Possível alerta:

"Antes de acelerar vendas, pode ser necessário validar custo, margem e capacidade para evitar crescimento sem rentabilidade."

=========================================================
INDÚSTRIA
=========================================================

Quando o negócio real for industrial, procure evidências relacionadas a:

CUSTOS

- ficha técnica;
- custo por produto;
- matéria-prima;
- mão de obra;
- custos indiretos;
- custo padrão;
- custo realizado;
- margem por produto;
- formação de preço.

ESTOQUE

- matéria-prima;
- produto em processo;
- produto acabado;
- inventário;
- divergência físico x sistema;
- giro;
- cobertura;
- estoque parado;
- obsolescência.

PRODUÇÃO

- PCP;
- ordem de produção;
- capacidade;
- máquinas;
- gargalos;
- produtividade;
- lead time;
- prazo;
- manutenção.

PERDAS

- desperdício;
- sucata;
- refugo;
- retrabalho;
- consumo real x padrão.

QUALIDADE

- devoluções;
- não conformidades;
- inspeção;
- retrabalho;
- indicadores.

MARGEM

- margem por produto;
- margem por família;
- margem por cliente;
- margem por pedido.

=========================================================
FABRICAÇÃO SOB ENCOMENDA
=========================================================

Quando houver fabricação personalizada, considere:

- orçamento por pedido;
- escopo;
- projeto;
- consumo de material;
- mão de obra;
- custo previsto;
- custo realizado;
- prazo;
- retrabalho;
- alteração de escopo;
- compras específicas;
- margem por pedido.

=========================================================
COMÉRCIO
=========================================================

Considere:

- margem por produto;
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
- ticket;
- descontos;
- canais;
- conversão;
- rentabilidade por canal.

=========================================================
SERVIÇOS
=========================================================

Considere:

- margem por cliente;
- margem por contrato;
- horas consumidas;
- custo/hora;
- capacidade;
- produtividade;
- precificação;
- recorrência;
- concentração;
- inadimplência;
- retrabalho;
- dependência de sócios;
- padronização.

=========================================================
FINANCEIRO
=========================================================

Procure evidências relacionadas a:

- fluxo de caixa;
- projeção;
- contas a pagar;
- contas a receber;
- inadimplência;
- conciliação;
- DRE;
- margem;
- rentabilidade;
- ponto de equilíbrio;
- capital de giro;
- necessidade de caixa;
- prazo de pagamento;
- prazo de recebimento;
- endividamento;
- retiradas;
- orçamento.

Nunca confunda faturamento com lucro.

Nunca confunda saldo bancário com resultado econômico.

=========================================================
COMERCIAL
=========================================================

Considere:

- CRM;
- funil;
- propostas;
- follow-up;
- conversão;
- ticket;
- recorrência;
- carteira;
- concentração;
- forecast;
- motivos de perda;
- descontos;
- margem comercial.

=========================================================
MARKETING
=========================================================

Considere:

- origem dos leads;
- posicionamento;
- canais;
- público;
- mensuração;
- conversão;
- aquisição;
- integração com comercial.

Não conclua automaticamente que mais investimento em marketing é necessário.

=========================================================
CONTÁBIL / FISCAL
=========================================================

Considere:

- DRE;
- balancete;
- conciliações;
- estoque;
- centros de custo;
- fechamento;
- cadastros;
- emissão fiscal;
- integração;
- regime tributário;
- qualidade dos dados.

Nunca conclua automaticamente que existe imposto pago a maior.

=========================================================
GESTÃO
=========================================================

Considere:

- indicadores;
- metas;
- reuniões;
- planejamento;
- responsabilidades;
- decisões;
- acompanhamento;
- visão consolidada;
- dados.

=========================================================
OPERACIONAL
=========================================================

Considere:

- capacidade;
- produtividade;
- gargalos;
- qualidade;
- estoque;
- perdas;
- retrabalho;
- prazo;
- planejamento;
- entrega.

Sempre interprete de acordo com o negócio real.

=========================================================
PESSOAS
=========================================================

Considere:

- responsabilidades;
- capacidade;
- produtividade;
- treinamento;
- rotatividade;
- liderança;
- dependência de pessoas-chave.

Não faça diagnóstico psicológico.

=========================================================
TECNOLOGIA
=========================================================

Considere:

- ERP;
- CRM;
- BI;
- integrações;
- automação;
- planilhas;
- qualidade de dados;
- segurança;
- backup;
- acesso;
- retrabalho manual.

=========================================================
JURÍDICO
=========================================================

Considere:

- contratos;
- responsabilidades;
- formalização;
- documentação;
- riscos contratuais;
- proteção de dados.

Não dê parecer jurídico conclusivo.

=========================================================
PERGUNTAS DINÂMICAS
=========================================================

As perguntas podem possuir:

- tema;
- motivo;
- riscoAvaliado;
- importancia;
- peso.

Use essas informações como contexto.

Não copie mecanicamente o "riscoAvaliado" para o relatório.

Primeiro confronte o risco com a resposta.

Exemplo:

Pergunta:
"A empresa conhece o custo completo por produto?"

Resposta:
"Não"

Risco avaliado:
"Formação de preço baseada em custo incompleto."

Esse conjunto pode sustentar um achado relacionado a baixa visibilidade de custos.

=========================================================
INTERPRETAÇÃO DAS RESPOSTAS
=========================================================

SIM
=
controle existente.

PARCIALMENTE
=
controle incompleto, inconsistente ou informal.

NÃO
=
ausência ou fragilidade.

Priorize:

1. respostas NÃO em perguntas críticas;
2. respostas PARCIALMENTE em perguntas críticas;
3. respostas NÃO em perguntas importantes;
4. respostas positivas para identificar pontos fortes.

=========================================================
SCORE
=========================================================

O score já foi calculado pelo aplicativo.

NÃO RECALCULE.

NÃO ALTERE.

NÃO CRIE NOVO SCORE.

O score é contexto.

A interpretação pode ser mais importante que a nota isolada.

=========================================================
ACHADO
=========================================================

Achado é algo sustentado pelas respostas.

Exemplo:

"A empresa informou não conhecer o custo completo por produto."

=========================================================
CAUSA PROVÁVEL
=========================================================

Causa provável é uma hipótese sustentada por mais de uma evidência ou por uma evidência relevante.

Utilize linguagem prudente:

"pode estar relacionado"

"pode contribuir"

"há indícios"

=========================================================
RISCO
=========================================================

Explique a possível consequência empresarial.

Não diga apenas:

"Risco financeiro."

Explique.

Exemplo:

"A ausência de apuração confiável de custo por produto pode dificultar a formação de preço e a identificação de itens com baixa rentabilidade."

=========================================================
RECOMENDAÇÃO
=========================================================

As recomendações devem ser práticas e ligadas aos achados.

Use verbos como:

- Implantar
- Revisar
- Mapear
- Estruturar
- Validar
- Mensurar
- Acompanhar
- Padronizar
- Automatizar
- Monitorar

Evite recomendações vagas.

=========================================================
PONTOS FORTES
=========================================================

Somente reconheça pontos fortes sustentados por respostas positivas.

Não invente elogios.

=========================================================
ALERTA ESTRATÉGICO
=========================================================

Crie um alerta curto mostrando o principal ponto cego identificado.

Exemplo:

"A empresa busca aumentar vendas, mas ainda existem indícios de baixa visibilidade de custo e margem. Crescer nessas condições pode ampliar faturamento sem garantir crescimento proporcional do resultado."

Somente faça esse tipo de conclusão se houver evidência.

=========================================================
LACUNAS
=========================================================

Mesmo com perguntas dinâmicas, pode haver temas sem dados suficientes.

Identifique essas lacunas.

Cada lacuna deve informar:

- tema;
- motivo;
- perguntasSugeridas.

Não invente respostas.

=========================================================
MÚLTIPLAS EMPRESAS
=========================================================

Se houver mais de um CNPJ:

- diferencie empresa-base e grupo;
- não misture atividades sem evidência;
- observe complementaridades;
- observe necessidade de visão consolidada;
- identifique possíveis problemas de gestão fragmentada;
- não faça conclusão tributária ou jurídica sem dados.

=========================================================
OPORTUNIDADES DE CONSULTORIA
=========================================================

Identifique apenas oportunidades sustentadas pelas respostas.

Exemplos:

- estruturação financeira;
- gestão de custos;
- precificação;
- BPO financeiro;
- implantação de ERP;
- BI;
- revisão tributária;
- processos;
- estoque;
- planejamento;
- comercial.

Não transforme toda fragilidade em venda.

=========================================================
RESUMO EXECUTIVO
=========================================================

Produza um resumo entre 140 e 240 palavras.

Ele deve explicar:

1. o que a empresa realmente faz;
2. quais dores foram declaradas;
3. quais dessas dores encontram suporte;
4. quais causas prováveis aparecem;
5. quais pontos fortes existem;
6. qual é o principal risco;
7. qual é a prioridade;
8. qual deveria ser o próximo passo.

Não mencione ChatGPT.

Não mencione inteligência artificial.

Não diga que realizou auditoria.

=========================================================
SEGURANÇA
=========================================================

NÃO INVENTE:

- lucro;
- margem percentual;
- dívida;
- prejuízo;
- multa;
- passivo;
- irregularidade;
- crédito tributário;
- processo judicial;
- problema trabalhista.

Se não houver evidência suficiente, diga isso.

=========================================================
VALIDAÇÃO FINAL
=========================================================

Antes de responder, verifique:

- considerei o negócio real?
- considerei todas as dores?
- cruzei as dores com respostas?
- diferenciei causa de sintoma?
- considerei peso/importância das perguntas?
- evitei repetir o checklist?
- cada risco possui evidência?
- cada recomendação responde a um achado?
- existem lacunas?
- estou inventando algo?
`;

  // =========================================================
  // 7. CONTEXTO PARA IA
  // =========================================================

  const contexto = {
    responsavel:
      responsavel || {},

    empresaBase: {
      segmento:
        segmento || "",

      categoria:
        categoria || "",

      codigoQuestionario:
        codigoQuestionario || "",

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
        descricaoNegocio ||
        "",

      negocioInterpretado:
        negocioInterpretado ||
        null,
    },

    grupoEmpresarial:
      Array.isArray(empresas)
        ? empresas
        : [],

    perfil: {
      faturamento:
        faturamento || "",

      colaboradores:
        colaboradores || "",

      regime:
        regime || "",

      observacao:
        observacao || "",
    },

    dores: {
      selecionadas:
        dores,

      principalCompatibilidade:
        dorPrincipalFinal,

      objetivo90Dias:
        dor90DiasFinal,

      impactosPercebidos:
        impactosDorFinal,
    },

    scoreGeral,

    areas,
  };

  // =========================================================
  // 8. SCHEMA
  // =========================================================

  const schema = {
    type: "object",

    additionalProperties: false,

    properties: {
      areas: {
        type: "array",

        items: {
          type: "object",

          additionalProperties: false,

          properties: {
            area: {
              type: "string",
            },

            score: {
              type: [
                "number",
                "null",
              ],
            },

            nivel: {
              type: "string",

              enum: [
                "bom",
                "atencao",
                "alto",
                "critico",
              ],
            },

            prioridade: {
              type: "integer",

              minimum: 1,
              maximum: 5,
            },

            resumo: {
              type: "string",
            },

            achados: {
              type: "array",

              items: {
                type: "string",
              },
            },

            causasProvaveis: {
              type: "array",

              items: {
                type: "string",
              },
            },

            riscos: {
              type: "array",

              items: {
                type: "string",
              },
            },

            recomendacoes: {
              type: "array",

              items: {
                type: "string",
              },
            },
          },

          required: [
            "area",
            "score",
            "nivel",
            "prioridade",
            "resumo",
            "achados",
            "causasProvaveis",
            "riscos",
            "recomendacoes",
          ],
        },
      },

      diagnosticoGeral: {
        type: "object",

        additionalProperties: false,

        properties: {
          scoreGeral: {
            type: [
              "number",
              "null",
            ],
          },

          nivelGeral: {
            type: "string",

            enum: [
              "bom",
              "atencao",
              "alto",
              "critico",
            ],
          },

          doresSelecionadas: {
            type: "array",

            items: {
              type: "string",
            },
          },

          leituraDasDores: {
            type: "string",
          },

          dorPrincipal: {
            type: "string",
          },

          leituraDaDor: {
            type: "string",
          },

          alertaEstrategico: {
            type: "string",
          },

          causasProvaveis: {
            type: "array",

            items: {
              type: "string",
            },
          },

          impactos: {
            type: "array",

            items: {
              type: "string",
            },
          },

          principaisDores: {
            type: "array",

            items: {
              type: "string",
            },
          },

          pontosFortes: {
            type: "array",

            items: {
              type: "string",
            },
          },

          prioridadesImediatas: {
            type: "array",

            items: {
              type: "string",
            },
          },

          oportunidades: {
            type: "array",

            items: {
              type: "string",
            },
          },

          proximosPassos: {
            type: "array",

            items: {
              type: "string",
            },
          },

          resumoExecutivo: {
            type: "string",
          },
        },

        required: [
          "scoreGeral",
          "nivelGeral",
          "doresSelecionadas",
          "leituraDasDores",
          "dorPrincipal",
          "leituraDaDor",
          "alertaEstrategico",
          "causasProvaveis",
          "impactos",
          "principaisDores",
          "pontosFortes",
          "prioridadesImediatas",
          "oportunidades",
          "proximosPassos",
          "resumoExecutivo",
        ],
      },

      visaoGrupo: {
        type: "object",

        additionalProperties: false,

        properties: {
          aplicavel: {
            type: "boolean",
          },

          resumo: {
            type: "string",
          },

          pontosAtencao: {
            type: "array",

            items: {
              type: "string",
            },
          },
        },

        required: [
          "aplicavel",
          "resumo",
          "pontosAtencao",
        ],
      },

      lacunasDiagnostico: {
        type: "array",

        items: {
          type: "object",

          additionalProperties: false,

          properties: {
            tema: {
              type: "string",
            },

            motivo: {
              type: "string",
            },

            perguntasSugeridas: {
              type: "array",

              items: {
                type: "string",
              },
            },
          },

          required: [
            "tema",
            "motivo",
            "perguntasSugeridas",
          ],
        },
      },

      oportunidadesConsultoria: {
        type: "array",

        items: {
          type: "object",

          additionalProperties: false,

          properties: {
            area: {
              type: "string",
            },

            oportunidade: {
              type: "string",
            },

            motivo: {
              type: "string",
            },

            prioridade: {
              type: "string",

              enum: [
                "baixa",
                "media",
                "alta",
                "imediata",
              ],
            },
          },

          required: [
            "area",
            "oportunidade",
            "motivo",
            "prioridade",
          ],
        },
      },
    },

    required: [
      "areas",
      "diagnosticoGeral",
      "visaoGrupo",
      "lacunasDiagnostico",
      "oportunidadesConsultoria",
    ],
  };

  // =========================================================
  // 9. CHAMAR OPENAI
  // =========================================================

  try {
    const modelo =
      process.env.OPENAI_DIAGNOSTIC_MODEL ||
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
                8000,

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
                    "diagnostico_empresarial",

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
        "Erro OpenAI diagnóstico:",
        JSON.stringify(
          data,
          null,
          2
        )
      );

      return res
        .status(response.status)
        .json({
          sucesso: false,

          error:
            data?.error?.message ||
            "Erro ao gerar diagnóstico.",
        });
    }

    // =========================================================
    // 10. EXTRAIR CONTEÚDO
    // =========================================================

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
            "A IA não retornou conteúdo para o diagnóstico.",
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
        "JSON inválido no diagnóstico:",
        text
      );

      return res
        .status(502)
        .json({
          sucesso: false,

          error:
            "A IA retornou diagnóstico em formato inválido.",
        });
    }

    // =========================================================
    // 11. PRESERVAR SCORES DO APP
    // =========================================================

    const mapaScores =
      new Map(
        areas.map(
          (area) => [
            area.area,

            Number.isFinite(
              Number(
                area.score
              )
            )
              ? Number(
                  area.score
                )
              : null,
          ]
        )
      );

    // =========================================================
    // 12. NORMALIZAR ÁREAS
    // =========================================================

    const areasProcessadas =
      areas.map(
        (
          areaOriginal
        ) => {
          const areaIA =
            Array.isArray(
              parsed.areas
            )
              ? parsed.areas.find(
                  (item) =>
                    item.area ===
                    areaOriginal.area
                ) || {}
              : {};

          const score =
            mapaScores.get(
              areaOriginal.area
            );

          let prioridade =
            Number(
              areaIA.prioridade
            );

          if (
            !Number.isFinite(
              prioridade
            ) ||
            prioridade < 1 ||
            prioridade > 5
          ) {
            prioridade =
              score < 40
                ? 1
                : score < 60
                  ? 2
                  : score < 80
                    ? 3
                    : 5;
          }

          return {
            area:
              areaOriginal.area,

            score,

            nivel:
              nivelScore(
                score
              ),

            prioridade,

            resumo:
              String(
                areaIA.resumo ||
                ""
              ),

            achados:
              limitarArray(
                areaIA.achados,
                6
              ),

            causasProvaveis:
              limitarArray(
                areaIA.causasProvaveis,
                6
              ),

            riscos:
              limitarArray(
                areaIA.riscos,
                6
              ),

            recomendacoes:
              limitarArray(
                areaIA.recomendacoes,
                6
              ),
          };
        }
      );

    // =========================================================
    // 13. DIAGNÓSTICO GERAL
    // =========================================================

    const scoreOriginal =
      Number.isFinite(
        Number(scoreGeral)
      )
        ? Number(scoreGeral)
        : null;

    const geral =
      parsed.diagnosticoGeral ||
      {};

    const diagnosticoGeral = {
      scoreGeral:
        scoreOriginal,

      nivelGeral:
        nivelScore(
          scoreOriginal
        ),

      doresSelecionadas:
        dores,

      leituraDasDores:
        String(
          geral.leituraDasDores ||
          ""
        ),

      // Mantido por compatibilidade com seu App atual
      dorPrincipal:
        String(
          geral.dorPrincipal ||
          dorPrincipalFinal ||
          ""
        ),

      leituraDaDor:
        String(
          geral.leituraDaDor ||
          geral.leituraDasDores ||
          ""
        ),

      alertaEstrategico:
        String(
          geral.alertaEstrategico ||
          ""
        ),

      causasProvaveis:
        limitarArray(
          geral.causasProvaveis,
          6
        ),

      impactos:
        limitarArray(
          geral.impactos,
          6
        ),

      principaisDores:
        limitarArray(
          geral.principaisDores,
          6
        ),

      pontosFortes:
        limitarArray(
          geral.pontosFortes,
          6
        ),

      prioridadesImediatas:
        limitarArray(
          geral.prioridadesImediatas,
          6
        ),

      oportunidades:
        limitarArray(
          geral.oportunidades,
          6
        ),

      proximosPassos:
        limitarArray(
          geral.proximosPassos,
          6
        ),

      resumoExecutivo:
        String(
          geral.resumoExecutivo ||
          ""
        ),
    };

    // =========================================================
    // 14. VISÃO DO GRUPO
    // =========================================================

    const visaoGrupo = {
      aplicavel:
        Boolean(
          parsed?.visaoGrupo
            ?.aplicavel
        ),

      resumo:
        String(
          parsed?.visaoGrupo
            ?.resumo ||
          ""
        ),

      pontosAtencao:
        limitarArray(
          parsed?.visaoGrupo
            ?.pontosAtencao,
          6
        ),
    };

    // =========================================================
    // 15. LACUNAS
    // =========================================================

    const lacunasDiagnostico =
      Array.isArray(
        parsed.lacunasDiagnostico
      )
        ? parsed.lacunasDiagnostico
            .slice(0, 8)
            .map(
              (item) => ({
                tema:
                  String(
                    item?.tema ||
                    ""
                  ),

                motivo:
                  String(
                    item?.motivo ||
                    ""
                  ),

                perguntasSugeridas:
                  limitarArray(
                    item
                      ?.perguntasSugeridas,
                    6
                  ),
              })
            )
        : [];

    // =========================================================
    // 16. OPORTUNIDADES DE CONSULTORIA
    // =========================================================

    const oportunidadesConsultoria =
      Array.isArray(
        parsed.oportunidadesConsultoria
      )
        ? parsed.oportunidadesConsultoria
            .slice(0, 6)
            .map(
              (item) => ({
                area:
                  String(
                    item?.area ||
                    ""
                  ),

                oportunidade:
                  String(
                    item?.oportunidade ||
                    ""
                  ),

                motivo:
                  String(
                    item?.motivo ||
                    ""
                  ),

                prioridade:
                  String(
                    item?.prioridade ||
                    "media"
                  ),
              })
            )
        : [];

    // =========================================================
    // 17. RETORNO
    // =========================================================

    return res
      .status(200)
      .json({
        sucesso: true,

        modelo,

        areas:
          areasProcessadas,

        diagnosticoGeral,

        visaoGrupo,

        lacunasDiagnostico,

        oportunidadesConsultoria,

        contextoInterpretado: {
          descricaoNegocio:
            descricaoNegocio || "",

          negocioInterpretado:
            negocioInterpretado || null,

          doresSelecionadas:
            dores,

          objetivo90Dias:
            dor90DiasFinal,
        },
      });

  } catch (error) {
    console.error(
      "Erro geral diagnóstico:",
      error
    );

    return res
      .status(500)
      .json({
        sucesso: false,

        error:
          "Erro interno ao gerar o diagnóstico.",
      });
  }
}
