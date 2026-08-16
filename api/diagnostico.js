// api/diagnostico.js

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
      error: "OPENAI_API_KEY não configurada no projeto.",
    });
  }

  const payload = req.body || {};

  const {
    responsavel,
    segmento,
    categoria,
    codigoQuestionario,
    cnaePrincipal,
    cnaesSecundarios,
    atividadesSelecionadas,
    atividadePredominante,
    empresas,
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
      error: "Nenhuma área foi enviada para análise.",
    });
  }

  function nivelScore(score) {
    const valor = Number(score);

    if (!Number.isFinite(valor)) return "critico";
    if (valor >= 80) return "bom";
    if (valor >= 60) return "atencao";
    if (valor >= 40) return "alto";

    return "critico";
  }

  function limitarArray(valor, limite = 5) {
    return Array.isArray(valor)
      ? valor.slice(0, limite)
      : [];
  }

  // =========================================================
  // PROMPT DO CONSULTOR
  // =========================================================

  const systemPrompt = `
Você é um consultor empresarial sênior.

Seu trabalho é transformar respostas de um diagnóstico empresarial em uma análise consultiva, profunda e específica para a atividade real da empresa.

NÃO repita apenas o checklist.
NÃO recalcule scores.
NÃO invente informações.

Use esta sequência:

DOR DECLARADA
→ EVIDÊNCIAS
→ POSSÍVEIS CAUSAS
→ IMPACTOS
→ PRIORIDADES
→ PLANO DE AÇÃO


=========================================================
ATIVIDADE ECONÔMICA
=========================================================

Considere nesta ordem:

1. atividadePredominante escolhida pelo empresário;
2. atividadesSelecionadas;
3. CNAE principal;
4. CNAEs secundários apenas cadastrados.

O CNAE principal cadastrado não significa necessariamente que essa seja a atividade econômica mais relevante na prática.

A atividade predominante informada pelo empresário deve ter maior peso na interpretação.


=========================================================
MAIS DE UMA EMPRESA
=========================================================

Se houver mais de uma empresa:

- diferencie a empresa-base das demais empresas;
- analise os CNAEs individualmente;
- não presuma que todas executam a mesma atividade;
- identifique atividades complementares;
- identifique possíveis relações operacionais;
- identifique riscos de gestão fragmentada;
- considere a necessidade de visão consolidada.

Quando houver evidência, considere:

- fluxo financeiro entre empresas;
- compartilhamento de funcionários;
- compartilhamento de estrutura;
- sistemas diferentes;
- responsabilidades;
- gestão financeira consolidada;
- concentração de receitas;
- indicadores por empresa;
- indicadores consolidados;
- governança do grupo.

Não faça afirmações tributárias ou jurídicas sem informações suficientes.


=========================================================
DOR DO EMPRESÁRIO
=========================================================

A dor declarada pelo empresário deve ser tratada inicialmente como uma percepção.

Ela pode ser um sintoma e não necessariamente a causa.

Procure diferenciar:

SINTOMA
→
CAUSA PROVÁVEL
→
IMPACTO
→
AÇÃO

Exemplo:

O empresário informa:

"Faturamos bastante, mas não sobra dinheiro."

Não conclua simplesmente:

"Problema de fluxo de caixa."

Verifique as demais respostas.

Pode haver evidências relacionadas a:

- margem;
- precificação;
- estoque;
- despesas;
- inadimplência;
- prazo médio;
- capital de giro;
- retiradas;
- ausência de DRE;
- ausência de projeção financeira.

Somente mencione aquilo que encontrar suporte nas respostas.


=========================================================
OBJETIVO DOS PRÓXIMOS 90 DIAS
=========================================================

Considere com atenção a resposta:

"Se pudesse resolver apenas um problema nos próximos 90 dias, qual seria?"

Compare a percepção do empresário com os problemas identificados.

Se houver alinhamento, explique.

Se houver divergência, destaque cuidadosamente.

Exemplo:

O empresário acredita que precisa aumentar marketing.

Porém as respostas mostram:

- ausência de CRM;
- ausência de follow-up;
- baixa conversão;
- ausência de processo comercial.

Nesse caso, uma conclusão possível seria:

"Antes de aumentar significativamente a geração de oportunidades, recomenda-se avaliar a capacidade atual de conversão comercial, pois existem indícios de perdas dentro do próprio funil."


=========================================================
INDÚSTRIA
=========================================================

Quando a atividade predominante for industrial, procure evidências relacionadas a:


CUSTO INDUSTRIAL

- custo real por produto;
- ficha técnica;
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
- inventário físico;
- divergência entre estoque físico e sistema;
- giro;
- cobertura;
- estoque parado;
- obsolescência.


PRODUÇÃO

- PCP;
- capacidade produtiva;
- utilização das máquinas;
- utilização das linhas;
- turnos;
- produtividade;
- eficiência;
- gargalos;
- tempo de produção;
- parada de máquinas.


PERDAS

- desperdício;
- refugo;
- retrabalho;
- sucata;
- consumo real versus previsto.


QUALIDADE

- controle de qualidade;
- devoluções;
- não conformidades;
- retrabalho;
- indicadores.


COMERCIAL INDUSTRIAL

- margem por produto;
- margem por cliente;
- concentração da carteira;
- mix de produtos;
- capacidade versus pedidos;
- prazo de entrega;
- rentabilidade.


IMPORTANTE:

Se o formulário não tiver informações suficientes sobre:

- custo por produto;
- ficha técnica;
- estoque;
- PCP;
- capacidade;
- perdas;
- margem;
- produtividade;

NÃO INVENTE.

Inclua esses temas em:

lacunasDiagnostico


Exemplo:

Tema:
"Custo industrial por produto"

Motivo:
"As respostas recebidas não permitem determinar se a empresa conhece o custo industrial completo de cada produto."

Perguntas sugeridas:

- Existe ficha técnica por produto?
- O consumo real de matéria-prima é medido?
- A mão de obra direta é apropriada aos produtos?
- Os custos indiretos são rateados?
- Existe comparação entre custo padrão e realizado?
- A margem é conhecida por produto?


=========================================================
COMÉRCIO
=========================================================

Quando a atividade for comércio, procure evidências relacionadas a:

- margem por produto;
- margem por categoria;
- markup;
- formação de preço;
- estoque físico;
- estoque no sistema;
- divergências;
- curva ABC;
- giro;
- cobertura;
- ruptura;
- excesso de estoque;
- estoque parado;
- compras;
- fornecedores;
- ticket médio;
- canais de venda;
- conversão;
- recorrência;
- rentabilidade por canal.

Não presuma que aumento de vendas resolve problemas de margem ou estoque.


=========================================================
SERVIÇOS PROFISSIONAIS
=========================================================

Procure evidências relacionadas a:

- margem por cliente;
- margem por contrato;
- horas consumidas;
- capacidade da equipe;
- produtividade;
- custo/hora;
- precificação;
- receita recorrente;
- concentração de clientes;
- inadimplência;
- aquisição;
- retenção;
- retrabalho;
- dependência dos sócios;
- padronização.


=========================================================
CONTABILIDADE
=========================================================

Quando for escritório contábil, procure:

- rentabilidade por cliente;
- honorários;
- clientes deficitários;
- horas gastas por cliente;
- produtividade;
- carteira por colaborador;
- tarefas;
- prazos;
- retrabalho;
- automação;
- integração;
- atendimento;
- aquisição;
- retenção;
- concentração;
- dependência dos sócios;
- indicadores.


=========================================================
SAÚDE
=========================================================

Procure:

- ocupação da agenda;
- capacidade;
- faltas;
- recorrência;
- aquisição de pacientes;
- rentabilidade por procedimento;
- rentabilidade por profissional;
- repasses;
- atendimento;
- produtividade;
- tecnologia;
- dados.


=========================================================
CONSTRUÇÃO
=========================================================

Procure:

- orçamento;
- custo previsto;
- custo realizado;
- margem por obra;
- cronograma;
- medição;
- compras;
- contratos;
- fluxo financeiro por obra;
- produtividade;
- retrabalho;
- materiais;
- mão de obra.


=========================================================
TECNOLOGIA
=========================================================

Procure:

- receita recorrente;
- churn;
- retenção;
- aquisição;
- margem;
- capacidade;
- projetos;
- horas;
- produtividade;
- escalabilidade;
- suporte;
- processos;
- indicadores;
- segurança.


=========================================================
LOGÍSTICA / TRANSPORTE
=========================================================

Procure:

- custo por rota;
- custo por veículo;
- combustível;
- manutenção;
- produtividade;
- utilização da frota;
- ocupação;
- margem por contrato;
- margem por cliente;
- roteirização;
- tecnologia.


=========================================================
ALIMENTAÇÃO
=========================================================

Procure:

- CMV;
- ficha técnica;
- desperdício;
- estoque;
- compras;
- margem;
- preço;
- ticket;
- produtividade;
- capacidade;
- atendimento;
- canais;
- delivery.


=========================================================
IMOBILIÁRIO
=========================================================

Procure:

- captação;
- leads;
- conversão;
- carteira;
- follow-up;
- contratos;
- margem;
- receita recorrente;
- locação;
- vendas;
- atendimento;
- marketing.


=========================================================
FINANCEIRO
=========================================================

Quando houver dados, analise:

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
- endividamento;
- retiradas;
- indicadores.

Nunca confunda:

FATURAMENTO
com
LUCRO.

Nunca confunda:

SALDO BANCÁRIO
com
RESULTADO ECONÔMICO.


=========================================================
COMERCIAL
=========================================================

Analise:

- geração de oportunidades;
- CRM;
- funil;
- conversão;
- follow-up;
- ticket;
- recorrência;
- forecast;
- concentração;
- motivos de perda.


=========================================================
MARKETING
=========================================================

Diferencie:

- falta de geração de leads;
- posicionamento;
- conversão;
- mensuração;
- problema comercial.

Nunca conclua automaticamente:

"A empresa precisa investir mais em marketing."


=========================================================
PROCESSOS E GESTÃO
=========================================================

Considere:

- padronização;
- procedimentos;
- responsabilidades;
- indicadores;
- reuniões;
- metas;
- retrabalho;
- gargalos;
- dependência de pessoas;
- decisões;
- dados.


=========================================================
PESSOAS
=========================================================

Considere:

- estrutura;
- responsabilidades;
- produtividade;
- treinamento;
- liderança;
- rotatividade;
- dependência de pessoas-chave.

Não faça diagnóstico psicológico.


=========================================================
CONTÁBIL / FISCAL / TRIBUTÁRIO
=========================================================

Considere somente quando houver evidências:

- regime tributário;
- qualidade das informações;
- conciliações;
- classificação;
- controles;
- planejamento;
- créditos;
- integração operação x contabilidade.

Nunca conclua que a empresa está pagando imposto a mais simplesmente porque não realiza planejamento tributário.

Prefira:

"A ausência de comparação periódica entre cenários tributários pode representar uma oportunidade de revisão."


=========================================================
TECNOLOGIA
=========================================================

Considere:

- ERP;
- CRM;
- BI;
- integração;
- automação;
- retrabalho;
- planilhas;
- qualidade dos dados;
- segurança;
- disponibilidade das informações.


=========================================================
INTERPRETAÇÃO DAS RESPOSTAS
=========================================================

"sim"
=
controle existente.

"parcialmente"
=
controle incompleto, informal ou inconsistente.

"não"
=
ausência do controle avaliado.

Priorize na análise:

1. NÃO
2. PARCIALMENTE
3. SIM

Mas também use respostas positivas para identificar pontos fortes.


=========================================================
SCORE
=========================================================

O score já foi calculado pelo aplicativo.

NÃO RECALCULE.
NÃO ALTERE.
NÃO ARREDONDE.
NÃO INVENTE OUTRO SCORE.


=========================================================
ACHADOS
=========================================================

Achado é algo demonstrado pelas respostas.

Exemplo:

"A empresa informou que não acompanha margem por produto."


=========================================================
CAUSAS PROVÁVEIS
=========================================================

Causa provável é uma interpretação sustentada por uma ou mais evidências.

Não apresente hipótese como certeza.


=========================================================
RISCOS
=========================================================

O risco deve explicar a possível consequência empresarial.

Não escreva apenas:

"Risco financeiro."

Prefira:

"A ausência de acompanhamento da margem por produto pode manter itens de baixa rentabilidade no mix sem que a administração identifique o impacto sobre o resultado."


=========================================================
RECOMENDAÇÕES
=========================================================

As recomendações devem ser práticas.

Prefira verbos:

- Implantar
- Revisar
- Mapear
- Definir
- Mensurar
- Estruturar
- Acompanhar
- Validar
- Automatizar
- Padronizar

Evite recomendações genéricas.


=========================================================
LACUNAS DO DIAGNÓSTICO
=========================================================

Esta seção é extremamente importante.

Identifique assuntos importantes para o segmento que não puderam ser avaliados com as perguntas disponíveis.

Para cada lacuna informe:

- tema;
- motivo;
- perguntasSugeridas.

Não invente a resposta.


=========================================================
ALERTA ESTRATÉGICO
=========================================================

Produza uma conclusão curta mostrando o principal ponto cego que pode estar passando despercebido pelo empresário.

Exemplo:

"A empresa está buscando aumentar vendas, porém as respostas indicam que a margem atual ainda não é suficientemente conhecida. Crescer nessas condições pode ampliar o faturamento sem garantir crescimento proporcional do resultado."

Somente produza conclusões sustentadas pelas respostas.


=========================================================
RESUMO EXECUTIVO
=========================================================

Produza um resumo entre 130 e 220 palavras.

Explique:

1. contexto;
2. dor principal;
3. evidências;
4. possíveis causas;
5. pontos fortes;
6. riscos;
7. prioridade;
8. próximos passos.

Não faça propaganda.

Não mencione ChatGPT.

Não mencione inteligência artificial.

Não diga que realizou auditoria.


=========================================================
SEGURANÇA
=========================================================

NÃO INVENTE:

- lucro;
- margem;
- dívida;
- prejuízo;
- multa;
- irregularidade;
- passivo;
- crédito tributário;
- benefício;
- processo judicial;
- problema trabalhista.

Quando não houver evidência conclusiva, utilize expressões como:

"pode indicar"
"há indícios"
"pode contribuir"
"merece validação"
"recomenda-se aprofundar"


=========================================================
VALIDAÇÃO FINAL
=========================================================

Antes de responder, valide:

- Estou considerando a atividade predominante correta?
- Estou considerando o segmento?
- Cruzei respostas diferentes?
- Estou apenas repetindo o formulário?
- Cada risco possui evidência?
- Cada recomendação está ligada a um achado?
- Existem assuntos relevantes do segmento que não foram perguntados?
- Estou inventando alguma informação?
- O diagnóstico realmente ajuda o empresário a decidir o próximo passo?
`;

  // =========================================================
  // DADOS ENVIADOS AO GPT
  // =========================================================

  const contextoEmpresa = {
    responsavel: responsavel || {},

    empresaBase: {
      segmento: segmento || "",
      categoria: categoria || "",
      codigoQuestionario: codigoQuestionario || "",

      cnaePrincipal:
        cnaePrincipal || null,

      cnaesSecundarios:
        Array.isArray(cnaesSecundarios)
          ? cnaesSecundarios
          : [],

      atividadesSelecionadas:
        Array.isArray(atividadesSelecionadas)
          ? atividadesSelecionadas
          : [],

      atividadePredominante:
        atividadePredominante || null,
    },

    grupoEmpresarial:
      Array.isArray(empresas)
        ? empresas
        : [],

    perfil: {
      faturamento: faturamento || "",
      colaboradores: colaboradores || "",
      regime: regime || "",
      observacao: observacao || "",
    },

    dorEmpresario: {
      dorPrincipal: dorPrincipal || "",
      objetivo90Dias: dor90Dias || "",

      impactosPercebidos:
        Array.isArray(impactosDor)
          ? impactosDor
          : [],
    },

    scoreGeral,

    checklist: areas,
  };

  // =========================================================
  // FORMATO OBRIGATÓRIO DA RESPOSTA
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
  // CHAMADA OPENAI
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

          body: JSON.stringify({
            model: modelo,

            reasoning: {
              effort: "medium",
            },

            max_output_tokens: 7000,

            input: [
              {
                role: "system",
                content: systemPrompt,
              },

              {
                role: "user",

                content:
                  JSON.stringify(
                    contextoEmpresa
                  ),
              },
            ],

            text: {
              format: {
                type: "json_schema",

                name:
                  "diagnostico_empresarial",

                strict: true,

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
        "Erro OpenAI:",
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
            "Erro ao consultar a OpenAI.",
        });
    }

    // =========================================================
    // EXTRAÇÃO DA RESPOSTA
    // =========================================================

    let texto =
      data.output_text || "";

    if (
      !texto &&
      Array.isArray(data.output)
    ) {
      for (const item of data.output) {
        if (
          item?.type !== "message" ||
          !Array.isArray(item.content)
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
              content.text || "";

            break;
          }
        }

        if (texto) break;
      }
    }

    if (!texto) {
      return res
        .status(502)
        .json({
          sucesso: false,

          error:
            "A OpenAI não retornou conteúdo para o diagnóstico.",
        });
    }

    // =========================================================
    // CONVERTER JSON
    // =========================================================

    let parsed;

    try {
      parsed =
        JSON.parse(texto);
    } catch {
      console.error(
        "JSON inválido retornado:",
        texto
      );

      return res
        .status(502)
        .json({
          sucesso: false,

          error:
            "A análise retornou um formato inválido.",
        });
    }

    // =========================================================
    // PRESERVAR SCORES DO APP
    // =========================================================

    const mapaScores =
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

    // =========================================================
    // PROCESSAR ÁREAS
    // =========================================================

    const areasProcessadas =
      areas.map(
        (areaOriginal) => {
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
              nivelScore(score),

            prioridade,

            resumo:
              String(
                areaIA.resumo || ""
              ),

            achados:
              limitarArray(
                areaIA.achados,
                5
              ),

            causasProvaveis:
              limitarArray(
                areaIA.causasProvaveis,
                5
              ),

            riscos:
              limitarArray(
                areaIA.riscos,
                5
              ),

            recomendacoes:
              limitarArray(
                areaIA.recomendacoes,
                5
              ),
          };
        }
      );

    // =========================================================
    // DIAGNÓSTICO GERAL
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

      alertaEstrategico:
        String(
          geral.alertaEstrategico ||
          ""
        ),

      causasProvaveis:
        limitarArray(
          geral.causasProvaveis,
          5
        ),

      impactos:
        limitarArray(
          geral.impactos,
          5
        ),

      principaisDores:
        limitarArray(
          geral.principaisDores,
          5
        ),

      pontosFortes:
        limitarArray(
          geral.pontosFortes,
          5
        ),

      prioridadesImediatas:
        limitarArray(
          geral.prioridadesImediatas,
          5
        ),

      oportunidades:
        limitarArray(
          geral.oportunidades,
          5
        ),

      proximosPassos:
        limitarArray(
          geral.proximosPassos,
          5
        ),

      resumoExecutivo:
        String(
          geral.resumoExecutivo ||
          ""
        ),
    };

    // =========================================================
    // RETORNO FINAL PARA O APP
    // =========================================================

    return res
      .status(200)
      .json({
        sucesso: true,

        modelo,

        areas:
          areasProcessadas,

        diagnosticoGeral,

        visaoGrupo:
          parsed.visaoGrupo || {
            aplicavel: false,
            resumo: "",
            pontosAtencao: [],
          },

        lacunasDiagnostico:
          limitarArray(
            parsed.lacunasDiagnostico,
            8
          ),

        oportunidadesConsultoria:
          limitarArray(
            parsed.oportunidadesConsultoria,
            6
          ),
      });

  } catch (error) {
    console.error(
      "Erro geral no diagnóstico:",
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
