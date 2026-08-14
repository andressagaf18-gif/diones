// api/diagnostico.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      sucesso: false,
      error: "ANTHROPIC_API_KEY não configurada no projeto.",
    });
  }

  const payload = req.body || {};

  const {
    segmento,
    categoria,
    cnae,
    cnaePrincipal,
    cnaesSecundarios,
    atividadesSelecionadas,
    atividadePredominante,
    faturamento,
    colaboradores,
    regime,
    observacao,
    dorPrincipal,
    dor90Dias,
    impactosDor,
    areas,
    scoreGeral,
  } = payload;

  if (!Array.isArray(areas) || areas.length === 0) {
    return res.status(400).json({
      sucesso: false,
      error: "Nenhuma área enviada para análise.",
    });
  }

  const systemPrompt = `
<papel>
Você é um consultor empresarial sênior, multidisciplinar e orientado a diagnóstico.

Sua função é interpretar dados de uma empresa e respostas de um checklist realizado durante um evento empresarial.
</papel>

<objetivo>
Seu trabalho NÃO é simplesmente resumir respostas.

Você deve identificar:

1. dor principal;
2. possíveis causas;
3. impactos;
4. gargalos;
5. pontos fortes;
6. prioridades;
7. oportunidades;
8. próximos passos.

Estruture mentalmente a análise como:

DOR
→ EVIDÊNCIAS
→ CAUSAS PROVÁVEIS
→ IMPACTOS
→ PRIORIDADES
→ AÇÕES
</objetivo>

<atividade_empresa>
O CNAE principal cadastrado não representa necessariamente a atividade predominante atual.

Utilize esta ordem de relevância:

1. atividadePredominante informada pelo empresário;
2. atividadesSelecionadas que ele declarou exercer;
3. CNAE principal;
4. CNAEs secundários apenas cadastrados.

Não trate um CNAE secundário como atividade relevante se ele não foi selecionado pelo empresário.

Empresas podem possuir operações híbridas.

Exemplo:
indústria + comércio

Nesse caso, considere conjuntamente produção, custos, estoque, margem, canais comerciais e formação de preço.
</atividade_empresa>

<dor_empresario>
A dor declarada deve ser tratada inicialmente como percepção ou sintoma.

Não aceite automaticamente a dor como causa.

Procure nas respostas possíveis fatores que sustentem ou expliquem a percepção.

Exemplo:

Dor:
"Não sobra dinheiro."

Respostas:
- não projeta caixa;
- não conhece margem;
- não acompanha inadimplência;
- não conhece ponto de equilíbrio.

Leitura adequada:

A dificuldade de caixa pode estar relacionada a uma combinação de baixa previsibilidade, margem desconhecida e ausência de acompanhamento dos recebimentos.

Não invente uma causa quando não houver evidência.
</dor_empresario>

<regras_respostas>
"sim" = controle existente ou boa maturidade.

"parcialmente" = controle incompleto, informal ou inconsistente.

"nao" ou "não" = ausência do controle avaliado ou baixa maturidade.

Priorize:

1. respostas "não";
2. respostas "parcialmente";
3. respostas "sim".

Utilize respostas positivas para identificar pontos fortes.

Não analise perguntas isoladamente.

Procure padrões entre perguntas e áreas diferentes.
</regras_respostas>

<segmentos>
Adapte a análise ao contexto real da empresa.

INDÚSTRIA:
custos, produção, margem por produto, capacidade, estoque, desperdício, produtividade, compras, qualidade.

COMÉRCIO:
margem, giro, estoque, compras, formação de preço, ticket, canais, conversão, recorrência.

SERVIÇOS PROFISSIONAIS:
margem por cliente, horas, produtividade, capacidade da equipe, precificação, recorrência, dependência dos sócios.

CONTABILIDADE:
rentabilidade por cliente, honorários, produtividade, retrabalho, prazos, automação, atendimento, carteira, indicadores.

SAÚDE:
agenda, ocupação, capacidade, aquisição, recorrência, rentabilidade dos procedimentos, atendimento, tecnologia.

CONSTRUÇÃO:
orçamento, custo por obra, margem, cronograma, contratos, compras, fluxo de caixa, produtividade.

TECNOLOGIA:
receita recorrente, aquisição, churn, retenção, escalabilidade, processos, produtividade, segurança.

LOGÍSTICA:
custo operacional, utilização, produtividade, rotas, manutenção, fluxo de caixa, tecnologia.

ALIMENTAÇÃO:
CMV, ficha técnica, desperdício, estoque, compras, margem, precificação, atendimento.

IMOBILIÁRIO:
leads, conversão, carteira, follow-up, contratos, fluxo financeiro, marketing, atendimento.
</segmentos>

<seguranca>
Analise SOMENTE os dados recebidos.

NÃO INVENTE:

- faturamento;
- lucro;
- margem;
- economia;
- prejuízo;
- dívida;
- multa;
- passivo;
- irregularidade;
- benefício fiscal;
- crédito tributário;
- problema jurídico;
- problema trabalhista.

Ausência de controle não significa existência automática de prejuízo ou irregularidade.

Quando houver apenas indício, utilize linguagem como:

"pode indicar"
"pode contribuir"
"pode dificultar"
"merece revisão"
"há indícios de"
"recomenda-se validar"
</seguranca>

<score>
O score já foi calculado pelo aplicativo.

NÃO recalcule.
NÃO altere.
NÃO arredonde.
NÃO substitua.

Classificação:

80 a 100 = bom
60 a 79 = atencao
40 a 59 = alto
0 a 39 = critico
</score>

<analise_por_area>
Para cada área, produza:

- resumo;
- achados;
- causasProvaveis;
- riscos;
- recomendacoes.

Achado = aquilo que as respostas demonstram.

Causa provável = fator que pode explicar a dor ou gargalo.

Risco = possível consequência do achado.

Recomendação = ação prática para atacar o problema.
</analise_por_area>

<diagnostico_geral>
Produza:

- dorPrincipal;
- leituraDaDor;
- causasProvaveis;
- impactos;
- principaisDores;
- pontosFortes;
- prioridadesImediatas;
- oportunidades;
- proximosPassos;
- resumoExecutivo.

O resumo executivo deve ter entre 120 e 180 palavras e explicar:

1. dor declarada;
2. se o checklist confirma ou contextualiza a percepção;
3. possíveis causas;
4. pontos fortes;
5. gargalos;
6. impactos;
7. prioridades;
8. próximo passo.
</diagnostico_geral>

<qualidade>
Antes de responder, verifique:

- cada conclusão possui evidência?
- cada risco decorre de um achado?
- as recomendações atacam os problemas identificados?
- a análise considera a atividade real?
- a dor foi confrontada com o checklist?
- existem frases genéricas?
- estou repetindo conclusões?
- estou inventando dados?

Se uma frase puder servir para quase qualquer empresa, torne-a mais específica usando o contexto recebido.
</qualidade>
`;

  const inputContext = `
<contexto_empresa>
${JSON.stringify({
  segmento,
  categoria,
  cnae,
  cnaePrincipal: cnaePrincipal || null,
  cnaesSecundarios: Array.isArray(cnaesSecundarios)
    ? cnaesSecundarios
    : [],
  atividadesSelecionadas: Array.isArray(atividadesSelecionadas)
    ? atividadesSelecionadas
    : [],
  atividadePredominante: atividadePredominante || null,
  faturamento,
  colaboradores,
  regime,
})}
</contexto_empresa>

<dor>
${JSON.stringify({
  dorPrincipal: dorPrincipal || "",
  dor90Dias: dor90Dias || "",
  impactosDor: Array.isArray(impactosDor)
    ? impactosDor
    : [],
  observacao: observacao || "",
})}
</dor>

<checklist>
${JSON.stringify({
  scoreGeral,
  areas,
})}
</checklist>
`;

  const outputSchema = {
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
              type: ["number", "null"],
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
            type: ["number", "null"],
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

          dorPrincipal: {
            type: "string",
          },

          leituraDaDor: {
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
          "dorPrincipal",
          "leituraDaDor",
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
      "oportunidadesConsultoria",
    ],
  };

  try {
    const response = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",

        headers: {
          "x-api-key":
            process.env.ANTHROPIC_API_KEY,

          "anthropic-version":
            "2023-06-01",

          "content-type":
            "application/json",
        },

        body: JSON.stringify({
          model:
            "claude-sonnet-4-6",

          max_tokens:
            5000,

          temperature:
            0.2,

          system:
            systemPrompt,

          messages: [
            {
              role: "user",
              content: inputContext,
            },
          ],

          output_config: {
            format: {
              type: "json_schema",

              schema: outputSchema,
            },
          },
        }),
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "Erro Anthropic:",
        data
      );

      return res
        .status(response.status)
        .json({
          sucesso: false,

          error:
            data?.error?.message ||
            "Erro ao consultar a IA.",
        });
    }

    const text =
      data?.content?.find(
        (bloco) =>
          bloco.type === "text"
      )?.text || "";

    if (!text) {
      return res
        .status(502)
        .json({
          sucesso: false,
          error:
            "A IA não retornou conteúdo.",
        });
    }

    let parsed;

    try {
      parsed =
        JSON.parse(text);
    } catch (error) {
      console.error(
        "JSON inválido retornado:",
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

    // =====================================================
    // PRESERVAR SCORE ORIGINAL POR ÁREA
    // =====================================================

    const scoresRecebidos =
      new Map(
        areas.map(
          (area) => [
            area.area,

            Number.isFinite(
              Number(area.score)
            )
              ? Number(area.score)
              : null,
          ]
        )
      );

    const areasProcessadas =
      areas.map(
        (areaOriginal) => {
          const areaIA =
            parsed.areas.find(
              (item) =>
                item.area ===
                areaOriginal.area
            ) || {};

          const scoreOriginal =
            scoresRecebidos.get(
              areaOriginal.area
            );

          let nivel =
            "critico";

          if (
            scoreOriginal >= 80
          ) {
            nivel = "bom";
          } else if (
            scoreOriginal >= 60
          ) {
            nivel = "atencao";
          } else if (
            scoreOriginal >= 40
          ) {
            nivel = "alto";
          }

          return {
            area:
              areaOriginal.area,

            score:
              scoreOriginal,

            nivel,

            prioridade:
              Number(
                areaIA.prioridade
              ) || 3,

            resumo:
              String(
                areaIA.resumo ||
                ""
              ),

            achados:
              Array.isArray(
                areaIA.achados
              )
                ? areaIA.achados.slice(
                    0,
                    5
                  )
                : [],

            causasProvaveis:
              Array.isArray(
                areaIA.causasProvaveis
              )
                ? areaIA.causasProvaveis.slice(
                    0,
                    5
                  )
                : [],

            riscos:
              Array.isArray(
                areaIA.riscos
              )
                ? areaIA.riscos.slice(
                    0,
                    5
                  )
                : [],

            recomendacoes:
              Array.isArray(
                areaIA.recomendacoes
              )
                ? areaIA.recomendacoes.slice(
                    0,
                    5
                  )
                : [],
          };
        }
      );

    // =====================================================
    // SCORE GERAL
    // =====================================================

    const scoreGeralOriginal =
      Number.isFinite(
        Number(scoreGeral)
      )
        ? Number(scoreGeral)
        : null;

    let nivelGeral =
      "critico";

    if (
      scoreGeralOriginal >=
      80
    ) {
      nivelGeral =
        "bom";
    } else if (
      scoreGeralOriginal >=
      60
    ) {
      nivelGeral =
        "atencao";
    } else if (
      scoreGeralOriginal >=
      40
    ) {
      nivelGeral =
        "alto";
    }

    const geral =
      parsed.diagnosticoGeral ||
      {};

    const diagnosticoGeral = {
      scoreGeral:
        scoreGeralOriginal,

      nivelGeral,

      dorPrincipal:
        String(
          geral.dorPrincipal ||
          dorPrincipal ||
          ""
        ),

      leituraDaDor:
        String(
          geral.leituraDaDor ||
          ""
        ),

      causasProvaveis:
        Array.isArray(
          geral.causasProvaveis
        )
          ? geral.causasProvaveis.slice(
              0,
              5
            )
          : [],

      impactos:
        Array.isArray(
          geral.impactos
        )
          ? geral.impactos.slice(
              0,
              5
            )
          : [],

      principaisDores:
        Array.isArray(
          geral.principaisDores
        )
          ? geral.principaisDores.slice(
              0,
              5
            )
          : [],

      pontosFortes:
        Array.isArray(
          geral.pontosFortes
        )
          ? geral.pontosFortes.slice(
              0,
              5
            )
          : [],

      prioridadesImediatas:
        Array.isArray(
          geral.prioridadesImediatas
        )
          ? geral.prioridadesImediatas.slice(
              0,
              5
            )
          : [],

      oportunidades:
        Array.isArray(
          geral.oportunidades
        )
          ? geral.oportunidades.slice(
              0,
              5
            )
          : [],

      proximosPassos:
        Array.isArray(
          geral.proximosPassos
        )
          ? geral.proximosPassos.slice(
              0,
              5
            )
          : [],

      resumoExecutivo:
        String(
          geral.resumoExecutivo ||
          ""
        ),
    };

    const oportunidadesConsultoria =
      Array.isArray(
        parsed.oportunidadesConsultoria
      )
        ? parsed.oportunidadesConsultoria.slice(
            0,
            5
          )
        : [];

    return res
      .status(200)
      .json({
        sucesso: true,

        areas:
          areasProcessadas,

        diagnosticoGeral,

        oportunidadesConsultoria,
      });

  } catch (error) {
    console.error(
      "Erro no diagnóstico:",
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
