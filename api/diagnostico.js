// api/diagnostico.js

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
  // 2. CHAVE OPENAI
  // =========================================================

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      sucesso: false,
      error: "OPENAI_API_KEY não configurada no projeto.",
    });
  }

  // =========================================================
  // 3. RECEBER PAYLOAD
  // =========================================================

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

  // =========================================================
  // 4. VALIDAÇÃO
  // =========================================================

  if (!Array.isArray(areas) || areas.length === 0) {
    return res.status(400).json({
      sucesso: false,
      error: "Nenhuma área foi enviada para análise.",
    });
  }

  // =========================================================
  // 5. FUNÇÕES AUXILIARES
  // =========================================================

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

  function limitarArray(valor, limite = 5) {
    return Array.isArray(valor)
      ? valor.slice(0, limite)
      : [];
  }

  // =========================================================
  // 6. PROMPT PRINCIPAL
  // =========================================================

  const systemPrompt = `
Você é um CONSULTOR EMPRESARIAL SÊNIOR.

Você receberá dados de uma empresa e respostas de um diagnóstico empresarial.

Sua função NÃO é repetir o checklist.

Sua função é interpretar a empresa de maneira consultiva, estratégica e específica para o seu segmento.

=========================================================
OBJETIVO
=========================================================

Transforme os dados recebidos em um diagnóstico empresarial preliminar que permita ao empresário entender:

1. qual é sua principal dor;
2. quais fatores podem estar provocando essa dor;
3. quais gargalos foram identificados;
4. quais riscos podem decorrer desses gargalos;
5. quais controles já funcionam;
6. quais oportunidades existem;
7. quais ações devem ser priorizadas;
8. quais assuntos precisam ser aprofundados;
9. quais perguntas adicionais seriam necessárias para aumentar a precisão do diagnóstico.

O relatório será lido diretamente pelo empresário.

Por isso, seja:

- consultivo;
- executivo;
- específico;
- objetivo;
- didático;
- profissional;
- prudente;
- orientado a causa e consequência.

=========================================================
REGRA PRINCIPAL
=========================================================

NÃO ANALISE CADA PERGUNTA ISOLADAMENTE.

Procure padrões entre respostas de diferentes áreas.

Estruture mentalmente:

DOR DECLARADA
→
EVIDÊNCIAS
→
POSSÍVEIS CAUSAS
→
IMPACTOS
→
PRIORIDADES
→
PLANO DE AÇÃO

Exemplo:

Dor declarada:
"Faturamos, mas não sobra dinheiro."

Respostas:
- não conhece margem;
- não projeta caixa;
- não conhece ponto de equilíbrio;
- não acompanha inadimplência.

Não gere quatro conclusões desconectadas.

Produza uma leitura consolidada, por exemplo:

"A dificuldade percebida no caixa pode estar relacionada à combinação de baixa previsibilidade financeira, ausência de acompanhamento da rentabilidade e falta de controle dos recebimentos."

=========================================================
ATIVIDADE ECONÔMICA
=========================================================

Você poderá receber:

- CNAE principal;
- CNAEs secundários;
- atividades efetivamente exercidas;
- atividade predominante escolhida pelo empresário.

IMPORTANTE:

O CNAE principal cadastrado NÃO deve ser tratado automaticamente como a principal atividade real da empresa.

Utilize esta ordem de relevância:

1. atividadePredominante;
2. atividadesSelecionadas;
3. CNAE principal;
4. CNAEs secundários apenas cadastrados.

A atividade predominante deve orientar a análise do segmento.

=========================================================
EMPRESAS COM MAIS DE UM CNPJ
=========================================================

Você também poderá receber várias empresas.

Quando houver mais de uma empresa:

- não presuma que todas executam a mesma atividade;
- observe os segmentos e CNAEs individualmente;
- identifique se existem operações complementares;
- diferencie diagnóstico da empresa-base e visão do grupo;
- não consolide problemas sem evidência.

Quando aplicável, analise possíveis temas de grupo:

- gestão consolidada;
- fluxo financeiro entre empresas;
- compartilhamento de equipe;
- compartilhamento de estrutura;
- concentração de receitas;
- sistemas;
- controles gerenciais;
- responsabilidades;
- governança;
- visão consolidada de resultados.

Não faça afirmações tributárias ou jurídicas sem dados suficientes.

=========================================================
DOR DECLARADA
=========================================================

A dor declarada representa inicialmente uma PERCEPÇÃO do empresário.

Não assuma que ela é a causa real.

Diferencie:

SINTOMA
CAUSA PROVÁVEL
IMPACTO
AÇÃO

Exemplo:

Sintoma:
"Não sobra dinheiro."

Possíveis causas:
- baixa margem;
- estoque elevado;
- precificação;
- inadimplência;
- prazo financeiro;
- ausência de projeção.

Somente cite causas sustentadas pelas respostas.

=========================================================
OBJETIVO DOS PRÓXIMOS 90 DIAS
=========================================================

Considere a resposta para:

"Se pudesse resolver apenas um problema nos próximos 90 dias, qual seria?"

Compare essa prioridade percebida com os achados.

Se houver alinhamento, explique.

Se houver divergência, explique cuidadosamente.

Exemplo:

O empresário diz precisar de mais marketing.

Porém:

- não possui CRM;
- não faz follow-up;
- não conhece conversão.

Uma conclusão possível:

"Antes de ampliar significativamente a geração de leads, pode ser necessário estruturar o processo comercial para reduzir perdas das oportunidades já existentes."

=========================================================
SEGMENTO: INDÚSTRIA
=========================================================

Quando a atividade predominante for industrial, procure sinais relacionados a:

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
- divergência sistema x físico;
- giro;
- cobertura;
- estoque parado;
- obsolescência.

PRODUÇÃO

- PCP;
- capacidade produtiva;
- máquinas;
- linhas;
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
- carteira;
- concentração;
- mix;
- prazo;
- capacidade versus pedidos.

Se o formulário NÃO possuir informações suficientes sobre algum desses temas, NÃO invente.

Coloque o tema em "lacunasDiagnostico" e sugira perguntas adicionais.

Exemplo:

"Não há informações suficientes para avaliar se a empresa conhece o custo industrial real por produto."

Perguntas sugeridas:

- Existe ficha técnica por produto?
- A matéria-prima consumida é apropriada por ordem de produção?
- A mão de obra direta é apropriada por produto?
- Os custos indiretos de fabricação são rateados?
- A margem é conhecida por produto?

=========================================================
SEGMENTO: COMÉRCIO
=========================================================

Procure sinais relacionados a:

- margem por produto;
- margem por categoria;
- markup;
- formação de preço;
- estoque físico;
- estoque sistêmico;
- curva ABC;
- giro;
- cobertura;
- ruptura;
- excesso de estoque;
- estoque parado;
- compras;
- fornecedores;
- ticket médio;
- canais;
- conversão;
- recorrência;
- rentabilidade por canal.

Se faltarem informações relevantes, use lacunasDiagnostico.

=========================================================
SEGMENTO: SERVIÇOS PROFISSIONAIS
=========================================================

Procure sinais relacionados a:

- margem por cliente;
- margem por contrato;
- horas consumidas;
- capacidade da equipe;
- produtividade;
- custo hora;
- precificação;
- recorrência;
- carteira;
- concentração;
- inadimplência;
- aquisição;
- retenção;
- retrabalho;
- dependência dos sócios;
- padronização.

=========================================================
SEGMENTO: CONTABILIDADE
=========================================================

Quando for escritório contábil, considere:

- rentabilidade por cliente;
- honorários;
- clientes deficitários;
- horas gastas por cliente;
- produtividade da equipe;
- carteiras;
- tarefas;
- prazos;
- retrabalho;
- automação;
- integração de sistemas;
- atendimento;
- aquisição;
- retenção;
- concentração;
- dependência dos sócios;
- indicadores.

=========================================================
SEGMENTO: SAÚDE
=========================================================

Considere:

- ocupação da agenda;
- capacidade;
- faltas;
- recorrência;
- aquisição de pacientes;
- rentabilidade por procedimento;
- rentabilidade por profissional;
- repasses;
- atendimento;
- processos;
- produtividade;
- tecnologia;
- dados.

=========================================================
SEGMENTO: CONSTRUÇÃO
=========================================================

Considere:

- orçamento;
- custo previsto;
- custo realizado;
- margem por obra;
- cronograma;
- medição;
- compras;
- contratos;
- fluxo de caixa por obra;
- produtividade;
- retrabalho;
- materiais;
- mão de obra.

=========================================================
SEGMENTO: TECNOLOGIA
=========================================================

Considere:

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
SEGMENTO: TRANSPORTE / LOGÍSTICA
=========================================================

Considere:

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
- prazo;
- tecnologia.

=========================================================
SEGMENTO: ALIMENTAÇÃO
=========================================================

Considere:

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
SEGMENTO: IMOBILIÁRIO
=========================================================

Considere:

- captação;
- leads;
- conversão;
- carteira;
- imóveis;
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

Não confunda faturamento com lucro.

Não confunda saldo bancário com resultado.

=========================================================
COMERCIAL
=========================================================

Analise quando houver evidência:

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

- problema de geração de leads;
- problema de posicionamento;
- problema de conversão;
- problema de mensuração;
- problema comercial.

Nunca conclua automaticamente:

"precisa investir mais em marketing".

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

Considere somente quando houver evidência:

- regime tributário;
- qualidade das informações;
- conciliações;
- classificação;
- controles;
- planejamento;
- créditos;
- integração operação x contabilidade.

Nunca diga que a empresa está pagando imposto a mais apenas porque não realizou planejamento tributário.

Prefira:

"A ausência de comparação periódica entre regimes pode representar oportunidade de revisão."

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
- dados;
- segurança;
- disponibilidade da informação.

=========================================================
INTERPRETAÇÃO DAS RESPOSTAS
=========================================================

"sim"
=
controle existente.

"parcialmente"
=
controle incompleto, informal ou inconsistente.

"nao" ou "não"
=
ausência do controle avaliado.

Priorize:

1. NÃO;
2. PARCIALMENTE;
3. SIM.

Mas use também respostas positivas para identificar pontos fortes.

=========================================================
SCORE
=========================================================

O score foi calculado pelo aplicativo.

NÃO RECALCULE.

NÃO ALTERE.

NÃO ARREDONDE.

NÃO INVENTE OUTRO SCORE.

=========================================================
ACHADOS
=========================================================

Achado é algo demonstrado pelas respostas.

Exemplo:

"A empresa não acompanha a margem por produto."

=========================================================
CAUSAS PROVÁVEIS
=========================================================

Causa provável é uma interpretação sustentada por evidências.

Nunca apresente uma hipótese como certeza.

=========================================================
RISCOS
=========================================================

O risco deve explicar a possível consequência.

Exemplo:

"A ausência de margem por produto pode manter itens pouco rentáveis no mix sem que a gestão perceba."

=========================================================
RECOMENDAÇÕES
=========================================================

Recomendações precisam ser práticas.

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

=========================================================
LACUNAS DO DIAGNÓSTICO
=========================================================

Esta seção é MUITO IMPORTANTE.

Identifique temas relevantes ao segmento que NÃO puderam ser avaliados pelas perguntas recebidas.

Para cada lacuna informe:

- tema;
- motivo;
- perguntasSugeridas.

Não invente a resposta.

Exemplo:

Tema:
"Custo industrial por produto"

Motivo:
"O formulário atual não permite determinar se a empresa apropria matéria-prima, mão de obra e custos indiretos por produto."

Perguntas sugeridas:
- Existe ficha técnica?
- Existe custo por ordem?
- A mão de obra é apropriada?
- Os custos indiretos são rateados?
- A margem por produto é conhecida?

=========================================================
ALERTA ESTRATÉGICO
=========================================================

Produza uma conclusão curta com o ponto mais importante que o empresário pode estar deixando de perceber.

Exemplo:

"A empresa está buscando aumentar vendas, porém as respostas indicam que a margem atual ainda não é suficientemente conhecida. Crescer nessas condições pode ampliar faturamento sem garantir crescimento proporcional de resultado."

Somente faça esse tipo de conclusão quando sustentada pelas respostas.

=========================================================
RESUMO EXECUTIVO
=========================================================

Produza um resumo entre 130 e 220 palavras.

Explique:

1. contexto da empresa;
2. dor principal;
3. principais evidências;
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

Quando não houver evidência, diga que precisa ser aprofundado.

Use:

"pode indicar"
"há indícios"
"pode contribuir"
"merece validação"
"recomenda-se aprofundar"

=========================================================
QUALIDADE FINAL
=========================================================

Antes da resposta, valide internamente:

- Estou considerando o segmento correto?
- Estou considerando a atividade predominante?
- Estou cruzando respostas?
- Estou apenas repetindo perguntas?
- Cada risco tem evidência?
- Cada recomendação está ligada a um achado?
- Existem assuntos importantes do segmento que não foram perguntados?
- Estou inventando alguma informação?
- O relatório realmente ajuda um empresário a decidir o próximo passo?
`;

  // =========================================================
  // 7. DADOS ENVIADOS PARA GPT
  // =========================================================

  const contextoEmpresa = {
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
      faturamento:
        faturamento || "",

      colaboradores:
        colaboradores || "",

      regime:
        regime || "",

      observacao:
        observacao || "",
    },

    dorEmpresario: {
      dorPrincipal:
        dorPrincipal || "",

      objetivo90Dias:
        dor90Dias || "",

      impactosPercebidos:
        Array.isArray(impactosDor)
          ? impactosDor
          : [],
    },

    scoreGeral,

    checklist:
      areas,
  };

  // =========================================================
  // 8. SCHEMA DE RESPOSTA
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
  // 9. CHAMAR OPENAI
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
                7000,

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
                      contextoEmpresa
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

    // =======================================================
    // 10. LER RETORNO
    // =======================================================

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
        .status(
          response.status
        )
        .json({
          sucesso: false,

          error:
            data?.error?.message ||
            "Erro ao consultar a OpenAI.",
        });
    }

    // =======================================================
    // 11. VERIFICAR RESPOSTA INCOMPLETA
    // =======================================================

    if (
      data.status ===
      "incomplete"
    ) {
      console.error(
        "Resposta OpenAI incompleta:",
        data.incomplete_details
      );

      return res
        .status(502)
        .json({
          sucesso: false,

          error:
            "A análise foi interrompida antes de ser concluída.",
        });
    }

    // =======================================================
    // 12. EXTRAIR TEXTO
    // =======================================================

    let texto = "";

    if (
      typeof data.output_text ===
        "string" &&
      data.output_text.trim()
    ) {
      texto =
        data.output_text;
    }

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

          if (
            content?.type ===
            "refusal"
          ) {
            console.error(
              "OpenAI recusou:",
              content.refusal
            );

            return res
              .status(502)
              .json({
                sucesso: false,

                error:
                  "A análise não pôde ser produzida.",
              });
          }
        }

        if (texto) {
          break;
        }
      }
    }

    if (!texto) {
      console.error(
        "Nenhum output_text encontrado:",
        JSON.stringify(
          data,
          null,
          2
        )
      );

      return res
        .status(502)
        .json({
          sucesso: false,

          error:
            "A OpenAI não retornou conteúdo para o diagnóstico.",
        });
    }

    // =======================================================
    // 13. PARSE JSON
    // =======================================================

    let parsed;

    try {
      parsed =
        JSON.parse(
          texto
        );
    } catch (error) {
      console.error(
        "Erro ao converter JSON:",
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

    // =======================================================
    // 14. PRESERVAR SCORE ORIGINAL
    // =======================================================

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

    // =======================================================
    // 15. NORMALIZAR ÁREAS
    // =======================================================

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
                ) ||
                {}
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

    // =======================================================
    // 16. DIAGNÓSTICO GERAL
    // =======================================================

    const scoreOriginal =
      Number.isFinite(
        Number(
          scoreGeral
        )
      )
        ? Number(
            scoreGeral
          )
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

    // =======================================================
    // 17. VISÃO GRUPO
    // =======================================================

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
          5
        ),
    };

    // =======================================================
    // 18. LACUNAS
    // =======================================================

    const lacunasDiagnostico =
      Array.isArray(
        parsed.lacunasDiagnostico
      )
        ? parsed.lacunasDiagnostico
            .slice(0, 8)
            .map(
              (
                item
              ) => ({
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

    // =======================================================
    // 19. OPORTUNIDADES CONSULTORIA
    // =======================================================

    const oportunidadesConsultoria =
      Array.isArray(
        parsed.oportunidadesConsultoria
      )
        ? parsed
            .oportunidadesConsultoria
            .slice(0, 6)
            .map(
              (
                item
              ) => ({
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

    // =======================================================
    // 20. RETORNO PARA APP
    // =======================================================

    return res
      .status(200)
      .json({
        sucesso:
          true,

        modelo:
          modelo,

        areas:
          areasProcessadas,

        diagnosticoGeral,

        visaoGrupo,

        lacunasDiagnostico,

        oportunidadesConsultoria,
      });

  } catch (error) {
    // =======================================================
    // 21. ERRO
    // =======================================================

    console.error(
      "Erro geral no diagnóstico:",
      error
    );

    return res
      .status(500)
      .json({
        sucesso:
          false,

        error:
          "Erro interno ao gerar o diagnóstico.",
      });
  }
}
