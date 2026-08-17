// api/diagnostico.js

function extrairOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (!Array.isArray(data?.output)) return "";

  for (const item of data.output) {
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;

    for (const content of item.content) {
      if (content?.type === "output_text" && content.text) {
        return String(content.text).trim();
      }
    }
  }

  return "";
}

function limitarArray(valor, limite = 5) {
  return Array.isArray(valor) ? valor.slice(0, limite) : [];
}

function nivelScore(score) {
  const valor = Number(score);

  if (!Number.isFinite(valor)) return "critico";
  if (valor >= 80) return "bom";
  if (valor >= 60) return "atencao";
  if (valor >= 40) return "alto";
  return "critico";
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

  const dores = Array.isArray(doresSelecionadas)
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

  const impactosDorFinal = Array.isArray(impactosDor)
    ? impactosDor
    : Array.isArray(body?.dor?.impactos)
      ? body.dor.impactos
      : [];

  if (!Array.isArray(areas) || areas.length === 0) {
    return res.status(400).json({
      sucesso: false,
      error: "Nenhuma área foi enviada para análise.",
    });
  }

  const systemPrompt = `
Você é um CONSULTOR EMPRESARIAL SÊNIOR da Finder.

Seu trabalho é interpretar um diagnóstico empresarial já respondido e transformá-lo em um DOSSIÊ CONSULTIVO INTERNO profundo, específico, prudente e útil para tomada de decisão.

Este relatório completo será utilizado internamente por consultores.

NÃO simplesmente repita perguntas e respostas.

Cruze:

- descrição real do negócio;
- negócio interpretado;
- atividade predominante;
- atividades exercidas;
- CNAEs;
- segmento;
- dores;
- objetivo de 90 dias;
- perguntas;
- respostas;
- motivos;
- riscos avaliados;
- importância;
- pesos;
- scores.

=========================================================
LÓGICA PRINCIPAL
=========================================================

Estruture mentalmente:

DORES DECLARADAS
↓
EVIDÊNCIAS
↓
ACHADOS
↓
POSSÍVEIS CAUSAS
↓
IMPACTOS E RISCOS
↓
PRIORIDADES
↓
AÇÕES
↓
INDICADORES
↓
PLANO DE 90 DIAS

Não analise perguntas isoladamente.

Procure relações entre respostas diferentes.

=========================================================
EVIDÊNCIA X HIPÓTESE
=========================================================

Nunca apresente hipótese como fato.

EVIDÊNCIA:
informação diretamente sustentada pelas respostas.

HIPÓTESE:
interpretação que ainda precisa ser validada.

Use expressões como:

- pode estar relacionado;
- há indícios;
- merece validação;
- pode contribuir;
- as respostas sugerem.

Nunca invente números.

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

CNAE é evidência cadastral, não descrição definitiva da operação.

=========================================================
DORES
=========================================================

Uma dor declarada pode representar:

- sintoma;
- consequência;
- causa;
- problema independente;
- percepção ainda não confirmada.

Cruze a dor com as respostas.

Se a percepção do empresário não estiver totalmente sustentada, destaque isso de maneira prudente.

Exemplo:

Empresário:
"Falta mão de obra."

Respostas:
- retrabalho não mensurado;
- capacidade não medida;
- demandas mal distribuídas.

Conclusão possível:

"A percepção de falta de mão de obra pode estar sendo ampliada por perdas de capacidade decorrentes de retrabalho e alocação."

Não conclua que contratação é desnecessária sem medir capacidade.

=========================================================
OBJETIVO DE 90 DIAS
=========================================================

Compare o objetivo declarado com os achados.

Se estiver alinhado, explique.

Se estiver desalinhado, explique o ponto cego.

Não aceite objetivos vagos como metas válidas.

Exemplo:

"organizar financeiro"

não é meta mensurável.

Recomende estabelecimento de linha de base e indicador.

=========================================================
ANÁLISE POR TIPO DE NEGÓCIO
=========================================================

INDÚSTRIA:
custos, ficha técnica, matéria-prima, mão de obra, custos indiretos,
estoque, PCP, capacidade, máquinas, gargalos, produtividade,
lead time, perdas, sucata, retrabalho, qualidade, margem,
custo previsto x realizado e margem por pedido.

FABRICAÇÃO SOB ENCOMENDA:
orçamento, escopo, projeto, consumo de material, mão de obra,
custo previsto, custo realizado, prazo, alteração de escopo,
compras específicas e margem por pedido.

COMÉRCIO:
margem, markup, preço, estoque, curva ABC, giro, cobertura,
ruptura, estoque parado, compras, fornecedores, ticket,
descontos, canais e rentabilidade.

SERVIÇOS:
margem por cliente, horas, custo/hora, capacidade,
produtividade, precificação, recorrência, concentração,
retrabalho, dependência de pessoas e padronização.

FINANCEIRO:
fluxo de caixa, projeção, pagar, receber, inadimplência,
conciliação, DRE, margem, rentabilidade, ponto de equilíbrio,
capital de giro, prazos, endividamento, retiradas e orçamento.

Nunca confunda faturamento com lucro.
Nunca confunda saldo bancário com resultado econômico.

COMERCIAL:
CRM, funil, propostas, follow-up, conversão, ticket,
carteira, concentração, forecast, perdas, descontos e margem.

MARKETING:
origem de leads, posicionamento, canais, público,
mensuração, conversão e integração comercial.

Não recomende automaticamente aumentar investimento.

CONTÁBIL/FISCAL:
DRE, balancete, conciliações, estoque, centros de custo,
fechamento, cadastros, emissão fiscal, integração,
regime tributário e qualidade dos dados.

Não conclua automaticamente que há imposto pago a maior.

GESTÃO:
indicadores, metas, reuniões, planejamento,
responsabilidades e acompanhamento.

OPERACIONAL:
capacidade, produtividade, gargalos, qualidade,
perdas, retrabalho, prazo, planejamento e entrega.

PESSOAS:
responsabilidades, capacidade, produtividade,
treinamento, rotatividade, liderança e dependência de pessoas-chave.

Não faça diagnóstico psicológico.

TECNOLOGIA:
ERP, CRM, BI, integrações, automação,
planilhas, qualidade de dados, segurança e retrabalho manual.

JURÍDICO:
contratos, responsabilidades, formalização,
documentação, riscos contratuais e proteção de dados.

Não dê parecer jurídico conclusivo.

=========================================================
SCORE
=========================================================

O score já foi calculado pelo aplicativo.

NÃO recalcule.
NÃO altere.
NÃO crie outro score.

=========================================================
ACHADOS
=========================================================

Achados devem ser diretamente sustentados pelas respostas.

=========================================================
CAUSAS PROVÁVEIS
=========================================================

Devem ser hipóteses razoáveis sustentadas por evidências.

=========================================================
RISCOS
=========================================================

Explique consequências empresariais concretas.

Não use apenas rótulos como "risco financeiro".

=========================================================
RECOMENDAÇÕES
=========================================================

Devem responder aos achados.

Prefira:

Implantar
Revisar
Mapear
Estruturar
Validar
Mensurar
Padronizar
Automatizar
Monitorar

=========================================================
PLANO DE 90 DIAS
=========================================================

Crie três fases:

FASE 1:
0 a 30 dias

FASE 2:
31 a 60 dias

FASE 3:
61 a 90 dias

Para cada fase informe:

- objetivo;
- ações;
- resultado esperado;
- indicadores.

O plano deve respeitar dependências.

Primeiro medir quando não existir linha de base.
Depois corrigir.
Depois consolidar e acompanhar.

NÃO invente metas percentuais.

Se não houver linha de base, use:

"Definir após levantamento da linha de base."

=========================================================
QUICK WINS
=========================================================

Identifique ações de implementação relativamente rápida.

Para cada uma informe:

- ação;
- motivo;
- impacto esperado;
- esforço: baixo, medio ou alto;
- dependências.

Quick win NÃO significa promessa de resultado.

=========================================================
KPIs
=========================================================

Sugira indicadores realmente relacionados aos achados.

Para cada indicador informe:

- nome;
- o que mede;
- forma de cálculo;
- frequência;
- meta sugerida.

Se não houver base para meta:

"Definir após levantamento da linha de base."

Não invente benchmark.

=========================================================
PERGUNTAS PARA APROFUNDAMENTO
=========================================================

Gere perguntas que o consultor deve fazer na reunião.

Não repita perguntas já respondidas, salvo quando houver necessidade explícita de validação.

Para cada pergunta informe:

- pergunta;
- motivo;
- informação que pretende validar.

=========================================================
VISÃO DO CONSULTOR
=========================================================

Produza:

- diagnosticoCentral;
- evidenciaMaisForte;
- hipotesePrincipal;
- validarPrimeiro;
- naoFazerAgora;
- pontosCegos;
- dadosDocumentosSolicitar.

"naoFazerAgora" deve evitar decisões prematuras.

=========================================================
VISÃO COMERCIAL
=========================================================

Esta seção é INTERNA.

Avalie:

- potencialLead: baixo, medio, alto ou imediato;
- justificativa;
- servicosAderentes;
- argumentoAbordagem;
- objecoesProvaveis;
- proximaAcaoComercial.

Não transforme toda fragilidade em venda.

Para cada serviço aderente informe:

- servico;
- problemaQuePodeAjudar;
- evidencia.

Não afirme que o serviço resolverá o problema sem validação.

=========================================================
LACUNAS
=========================================================

Identifique temas importantes sem dados suficientes.

Informe:

- tema;
- motivo;
- perguntasSugeridas.

Não invente respostas.

=========================================================
RESUMO EXECUTIVO
=========================================================

Produza entre 140 e 240 palavras.

Explique:

1. negócio real;
2. dores;
3. evidências;
4. causas prováveis;
5. pontos fortes;
6. principal risco;
7. prioridade;
8. próximo passo.

=========================================================
SEGURANÇA
=========================================================

NÃO INVENTE:

- lucro;
- margem;
- dívida;
- prejuízo;
- multa;
- passivo;
- irregularidade;
- crédito tributário;
- processo judicial;
- problema trabalhista.

Não faça promessa de economia ou resultado.

=========================================================
VALIDAÇÃO FINAL
=========================================================

Antes de responder verifique:

- cada achado possui evidência?
- hipótese está identificada como hipótese?
- riscos possuem suporte?
- recomendações respondem aos achados?
- plano de 90 dias respeita dependências?
- KPIs são mensuráveis?
- metas não foram inventadas?
- perguntas aprofundam realmente o diagnóstico?
- oportunidades comerciais possuem aderência?
- existem lacunas?
`;

  const contexto = {
    responsavel: responsavel || {},

    empresaBase: {
      segmento: segmento || "",
      categoria: categoria || "",
      codigoQuestionario: codigoQuestionario || "",
      cnaePrincipal: cnaePrincipal || null,
      cnaesSecundarios: Array.isArray(cnaesSecundarios)
        ? cnaesSecundarios
        : [],
      atividadesSelecionadas: Array.isArray(atividadesSelecionadas)
        ? atividadesSelecionadas
        : [],
      atividadePredominante: atividadePredominante || null,
      descricaoNegocio: descricaoNegocio || "",
      negocioInterpretado: negocioInterpretado || null,
    },

    grupoEmpresarial: Array.isArray(empresas) ? empresas : [],

    perfil: {
      faturamento: faturamento || "",
      colaboradores: colaboradores || "",
      regime: regime || "",
      observacao: observacao || "",
    },

    dores: {
      selecionadas: dores,
      principalCompatibilidade: dorPrincipalFinal,
      objetivo90Dias: dor90DiasFinal,
      impactosPercebidos: impactosDorFinal,
    },

    scoreGeral,
    areas,
  };

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
            area: { type: "string" },

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

      // =====================================================
      // PLANO DE AÇÃO DE 90 DIAS
      // =====================================================

      plano90Dias: {
        type: "object",
        additionalProperties: false,

        properties: {
          fase0a30: {
            type: "object",
            additionalProperties: false,

            properties: {
              objetivo: {
                type: "string",
              },

              acoes: {
                type: "array",
                items: {
                  type: "string",
                },
              },

              resultadoEsperado: {
                type: "string",
              },

              indicadores: {
                type: "array",
                items: {
                  type: "string",
                },
              },
            },

            required: [
              "objetivo",
              "acoes",
              "resultadoEsperado",
              "indicadores",
            ],
          },

          fase31a60: {
            type: "object",
            additionalProperties: false,

            properties: {
              objetivo: {
                type: "string",
              },

              acoes: {
                type: "array",
                items: {
                  type: "string",
                },
              },

              resultadoEsperado: {
                type: "string",
              },

              indicadores: {
                type: "array",
                items: {
                  type: "string",
                },
              },
            },

            required: [
              "objetivo",
              "acoes",
              "resultadoEsperado",
              "indicadores",
            ],
          },

          fase61a90: {
            type: "object",
            additionalProperties: false,

            properties: {
              objetivo: {
                type: "string",
              },

              acoes: {
                type: "array",
                items: {
                  type: "string",
                },
              },

              resultadoEsperado: {
                type: "string",
              },

              indicadores: {
                type: "array",
                items: {
                  type: "string",
                },
              },
            },

            required: [
              "objetivo",
              "acoes",
              "resultadoEsperado",
              "indicadores",
            ],
          },
        },

        required: [
          "fase0a30",
          "fase31a60",
          "fase61a90",
        ],
      },

      // =====================================================
      // QUICK WINS
      // =====================================================

      quickWins: {
        type: "array",

        items: {
          type: "object",
          additionalProperties: false,

          properties: {
            acao: {
              type: "string",
            },

            motivo: {
              type: "string",
            },

            impactoEsperado: {
              type: "string",
            },

            esforco: {
              type: "string",
              enum: [
                "baixo",
                "medio",
                "alto",
              ],
            },

            dependencias: {
              type: "array",
              items: {
                type: "string",
              },
            },
          },

          required: [
            "acao",
            "motivo",
            "impactoEsperado",
            "esforco",
            "dependencias",
          ],
        },
      },

      // =====================================================
      // INDICADORES RECOMENDADOS
      // =====================================================

      kpisRecomendados: {
        type: "array",

        items: {
          type: "object",
          additionalProperties: false,

          properties: {
            indicador: {
              type: "string",
            },

            oQueMede: {
              type: "string",
            },

            formaCalculo: {
              type: "string",
            },

            frequencia: {
              type: "string",
            },

            metaSugerida: {
              type: "string",
            },
          },

          required: [
            "indicador",
            "oQueMede",
            "formaCalculo",
            "frequencia",
            "metaSugerida",
          ],
        },
      },

      // =====================================================
      // PERGUNTAS PARA REUNIÃO DE APROFUNDAMENTO
      // =====================================================

      perguntasAprofundamento: {
        type: "array",

        items: {
          type: "object",
          additionalProperties: false,

          properties: {
            pergunta: {
              type: "string",
            },

            motivo: {
              type: "string",
            },

            validar: {
              type: "string",
            },
          },

          required: [
            "pergunta",
            "motivo",
            "validar",
          ],
        },
      },

      // =====================================================
      // VISÃO INTERNA DO CONSULTOR
      // =====================================================

      visaoConsultor: {
        type: "object",
        additionalProperties: false,

        properties: {
          diagnosticoCentral: {
            type: "string",
          },

          evidenciaMaisForte: {
            type: "string",
          },

          hipotesePrincipal: {
            type: "string",
          },

          validarPrimeiro: {
            type: "string",
          },

          naoFazerAgora: {
            type: "string",
          },

          pontosCegos: {
            type: "array",
            items: {
              type: "string",
            },
          },

          dadosDocumentosSolicitar: {
            type: "array",
            items: {
              type: "string",
            },
          },
        },

        required: [
          "diagnosticoCentral",
          "evidenciaMaisForte",
          "hipotesePrincipal",
          "validarPrimeiro",
          "naoFazerAgora",
          "pontosCegos",
          "dadosDocumentosSolicitar",
        ],
      },

      // =====================================================
      // VISÃO COMERCIAL INTERNA
      // =====================================================

      visaoComercial: {
        type: "object",
        additionalProperties: false,

        properties: {
          potencialLead: {
            type: "string",
            enum: [
              "baixo",
              "medio",
              "alto",
              "imediato",
            ],
          },

          justificativa: {
            type: "string",
          },

          servicosAderentes: {
            type: "array",

            items: {
              type: "object",
              additionalProperties: false,

              properties: {
                servico: {
                  type: "string",
                },

                problemaQuePodeAjudar: {
                  type: "string",
                },

                evidencia: {
                  type: "string",
                },
              },

              required: [
                "servico",
                "problemaQuePodeAjudar",
                "evidencia",
              ],
            },
          },

          argumentoAbordagem: {
            type: "string",
          },

          objecoesProvaveis: {
            type: "array",
            items: {
              type: "string",
            },
          },

          proximaAcaoComercial: {
            type: "string",
          },
        },

        required: [
          "potencialLead",
          "justificativa",
          "servicosAderentes",
          "argumentoAbordagem",
          "objecoesProvaveis",
          "proximaAcaoComercial",
        ],
      },
