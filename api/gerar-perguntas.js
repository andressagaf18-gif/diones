// api/gerar-perguntas.js

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
      error: "OPENAI_API_KEY não configurada.",
    });
  }

  // =========================================================
  // 3. RECEBER DADOS DO APP
  // =========================================================

  const payload = req.body || {};

  const {
    cnaePrincipal,
    cnaesSecundarios,
    atividadesSelecionadas,
    atividadePredominante,
    descricaoNegocio,
    segmento,
    categoria,
    faturamento,
    colaboradores,
    regime,
    dorPrincipal,
    dor90Dias,
    impactosDor,
    areasSelecionadas,
    empresas,
  } = payload;

  // =========================================================
  // 4. VALIDAÇÕES
  // =========================================================

  if (
    !descricaoNegocio ||
    String(descricaoNegocio).trim().length < 10
  ) {
    return res.status(400).json({
      sucesso: false,
      error:
        "Descreva brevemente o que a empresa realmente faz.",
    });
  }

  if (
    !Array.isArray(areasSelecionadas) ||
    areasSelecionadas.length === 0
  ) {
    return res.status(400).json({
      sucesso: false,
      error:
        "Selecione pelo menos uma área para o diagnóstico.",
    });
  }

  // =========================================================
  // 5. PROMPT
  // =========================================================

  const systemPrompt = `
Você é um CONSULTOR EMPRESARIAL SÊNIOR responsável por construir um diagnóstico empresarial personalizado.

Sua tarefa neste momento NÃO é diagnosticar a empresa.

Sua tarefa é:

1. interpretar corretamente o negócio;
2. identificar o modelo operacional real;
3. identificar os riscos naturais dessa atividade;
4. considerar as áreas/departamentos selecionados;
5. construir perguntas inteligentes e específicas;
6. preparar informações que posteriormente serão utilizadas por outro diagnóstico.

=========================================================
REGRA MAIS IMPORTANTE
=========================================================

NÃO assuma que o CNAE principal representa corretamente o negócio real.

Empresas frequentemente possuem:

- CNAEs genéricos;
- CNAEs antigos;
- CNAEs secundários relevantes;
- atividades diferentes da atividade principal cadastrada;
- várias linhas de negócio;
- atividade operacional mais específica do que a descrição oficial do CNAE.

Por isso, utilize esta ordem de relevância:

1. descrição livre fornecida pelo participante;
2. atividade predominante escolhida pelo participante;
3. atividades efetivamente exercidas selecionadas;
4. CNAE principal;
5. CNAEs secundários;
6. classificação preliminar de segmento.

=========================================================
DESCRIÇÃO DO NEGÓCIO
=========================================================

A descrição do participante deve ter peso elevado.

Exemplo:

CNAE:

"Serviços combinados de escritório e apoio administrativo"

Descrição:

"Fabricamos churrasqueiras metálicas, vendemos modelos prontos e também fabricamos projetos sob medida."

NÃO trate essa empresa como simples empresa de apoio administrativo.

A operação descrita indica características de:

INDÚSTRIA / FABRICAÇÃO.

Portanto, as perguntas devem investigar os riscos e controles de uma operação industrial.

=========================================================
CONFRONTO DAS INFORMAÇÕES
=========================================================

Compare:

- descrição do negócio;
- CNAE principal;
- CNAEs secundários;
- atividade predominante;
- atividades selecionadas.

Identifique:

- convergências;
- divergências;
- ambiguidades;
- atividades complementares;
- atividades potencialmente relevantes.

Se houver divergência entre CNAE e operação descrita:

NÃO conclua automaticamente que existe irregularidade.

Informe apenas que:

"Existe divergência aparente entre a atividade operacional descrita e algumas atividades cadastrais, recomendando validação posterior."

=========================================================
INTERPRETAÇÃO DO NEGÓCIO
=========================================================

Determine:

- segmento real provável;
- subsegmento;
- modelo de negócio;
- como a empresa gera receita;
- características operacionais;
- principais processos;
- principais riscos gerenciais;
- informações que ainda precisam ser descobertas.

Exemplos de modelo:

- indústria;
- comércio;
- serviços;
- indústria + comércio;
- fabricação sob encomenda;
- fabricação seriada;
- prestação recorrente;
- prestação por projeto;
- varejo;
- atacado;
- distribuição;
- e-commerce;
- locação;
- construção;
- clínica;
- escritório profissional;
- SaaS;
- logística;
- alimentação.

=========================================================
ÁREAS SELECIONADAS
=========================================================

Você receberá as áreas que o participante deseja analisar.

Gere perguntas SOMENTE para as áreas selecionadas.

As perguntas devem relacionar:

ATIVIDADE REAL
+
RISCO DO NEGÓCIO
+
DEPARTAMENTO
+
CONTROLE NECESSÁRIO

=========================================================
EXEMPLO
=========================================================

Empresa:

"Fabricamos churrasqueiras metálicas."

Área selecionada:

Financeiro

Pergunta RUIM:

"Você controla seus custos?"

Pergunta BOA:

"A empresa conhece o custo completo de fabricação de cada modelo de churrasqueira, considerando matéria-prima, mão de obra direta e custos indiretos?"

---------------------------------------------------------

Pergunta RUIM:

"Você controla o estoque?"

Pergunta BOA:

"O estoque físico de aço, componentes e produtos acabados é conciliado periodicamente com as quantidades registradas no sistema?"

---------------------------------------------------------

Pergunta RUIM:

"Você sabe sua margem?"

Pergunta BOA:

"A empresa acompanha a margem por modelo de churrasqueira e consegue identificar produtos que vendem bem, mas apresentam baixa rentabilidade?"

=========================================================
FINANCEIRO
=========================================================

Quando Financeiro estiver selecionado, avalie quando pertinente:

- fluxo de caixa;
- projeção financeira;
- contas a pagar;
- contas a receber;
- inadimplência;
- conciliação bancária;
- DRE;
- margem;
- rentabilidade;
- ponto de equilíbrio;
- capital de giro;
- necessidade de caixa;
- prazo médio de recebimento;
- prazo médio de pagamento;
- endividamento;
- retiradas dos sócios;
- orçamento;
- indicadores.

Adapte as perguntas ao negócio.

Exemplo indústria:

"A empresa consegue projetar a necessidade de caixa considerando compra de matéria-prima, prazo de produção e prazo de recebimento dos clientes?"

Exemplo serviço:

"A empresa conhece a margem gerada por cliente ou contrato depois de considerar as horas da equipe utilizadas na prestação?"

=========================================================
INDÚSTRIA / PRODUÇÃO
=========================================================

Se identificar atividade industrial, investigue quando pertinente:

CUSTO INDUSTRIAL

- ficha técnica;
- custo por produto;
- matéria-prima;
- mão de obra direta;
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
- estoque físico x sistema;
- giro;
- cobertura;
- estoque parado;
- obsolescência.

PRODUÇÃO

- PCP;
- ordens de produção;
- capacidade produtiva;
- utilização de máquinas;
- produtividade;
- gargalos;
- lead time;
- prazo de produção;
- paradas.

PERDAS

- desperdício;
- sucata;
- refugo;
- retrabalho;
- consumo previsto x realizado.

QUALIDADE

- devoluções;
- não conformidades;
- retrabalho;
- inspeção;
- indicadores.

=========================================================
COMÉRCIO
=========================================================

Se identificar comércio, investigue:

- margem por produto;
- margem por categoria;
- markup;
- preço;
- estoque;
- curva ABC;
- giro;
- cobertura;
- ruptura;
- excesso;
- estoque parado;
- compras;
- fornecedores;
- ticket médio;
- canais;
- conversão;
- rentabilidade por canal;
- devoluções;
- descontos.

=========================================================
SERVIÇOS
=========================================================

Se identificar prestação de serviços, investigue:

- margem por cliente;
- margem por contrato;
- custo/hora;
- horas utilizadas;
- capacidade;
- produtividade;
- precificação;
- contratos;
- recorrência;
- concentração de clientes;
- inadimplência;
- retrabalho;
- dependência dos sócios;
- padronização;
- SLA;
- retenção.

=========================================================
COMERCIAL
=========================================================

Quando Comercial estiver selecionado, considere:

- geração de leads;
- CRM;
- funil;
- taxa de conversão;
- follow-up;
- propostas;
- motivos de perda;
- ticket médio;
- recorrência;
- concentração;
- margem nas negociações;
- desconto;
- forecast;
- carteira.

Adapte ao modelo real.

=========================================================
MARKETING
=========================================================

Quando Marketing estiver selecionado, considere:

- origem dos leads;
- custo de aquisição;
- canais;
- posicionamento;
- público;
- mensuração;
- conversão;
- campanhas;
- retorno;
- integração marketing/comercial;
- recorrência.

Não presuma que o problema é falta de investimento.

=========================================================
OPERACIONAL
=========================================================

Quando Operacional estiver selecionado, investigue:

- capacidade;
- produtividade;
- gargalos;
- padronização;
- retrabalho;
- prazo;
- qualidade;
- perdas;
- indicadores;
- responsabilidades;
- planejamento;
- dependência de pessoas.

Adapte completamente ao negócio.

=========================================================
PROCESSOS E GESTÃO
=========================================================

Considere:

- processos documentados;
- responsabilidades;
- indicadores;
- metas;
- reuniões;
- acompanhamento;
- retrabalho;
- gargalos;
- aprovação;
- dependência de pessoas;
- tomada de decisão;
- qualidade das informações.

=========================================================
PESSOAS / RH
=========================================================

Considere:

- funções;
- responsabilidades;
- capacidade;
- produtividade;
- treinamento;
- rotatividade;
- liderança;
- dependência de pessoas-chave;
- dimensionamento da equipe;
- acompanhamento de desempenho.

Não faça diagnóstico psicológico.

=========================================================
CONTÁBIL
=========================================================

Considere:

- fechamento;
- conciliação;
- DRE;
- balancete;
- qualidade dos dados;
- classificação;
- integração;
- estoque;
- imobilizado;
- centros de custo;
- resultado gerencial;
- informação para decisão.

=========================================================
FISCAL / TRIBUTÁRIO
=========================================================

Considere:

- regime tributário;
- enquadramento das operações;
- emissão fiscal;
- classificação;
- cadastros;
- produtos;
- serviços;
- créditos;
- retenções;
- integração sistema/fiscal;
- planejamento tributário.

IMPORTANTE:

Não conclua que existe imposto pago a maior.

Não conclua que existe irregularidade.

As perguntas devem descobrir se existem oportunidades ou riscos.

=========================================================
TECNOLOGIA
=========================================================

Considere:

- ERP;
- CRM;
- BI;
- integrações;
- automações;
- planilhas;
- retrabalho;
- qualidade de dados;
- backups;
- acessos;
- segurança;
- dependência de sistemas.

=========================================================
RISCO ESPECÍFICO DA ATIVIDADE
=========================================================

Não fique limitado às listas anteriores.

Analise a descrição do negócio.

Pergunte:

"Quais riscos gerenciais são naturalmente relevantes para esse tipo específico de operação?"

Exemplo:

Fabricante sob encomenda:

- orçamento incorreto;
- alteração de projeto;
- consumo superior ao previsto;
- retrabalho;
- atraso;
- margem por pedido;
- capacidade;
- prazo;
- compras específicas.

E-commerce:

- margem por canal;
- mídia;
- frete;
- devolução;
- marketplace;
- comissão;
- estoque;
- ruptura;
- CAC.

Clínica:

- ocupação;
- agenda;
- faltas;
- repasse;
- procedimento;
- capacidade;
- recorrência.

=========================================================
DOR DECLARADA
=========================================================

Você receberá a principal dor informada pelo empresário.

Use essa informação para aprofundar as perguntas.

Porém:

NÃO aceite automaticamente a dor como causa.

Exemplo:

Dor:

"Preciso vender mais."

Se a empresa não conhece:

- margem;
- conversão;
- capacidade;
- rentabilidade;

gere perguntas para descobrir se aumentar vendas realmente é a prioridade correta.

=========================================================
OBJETIVO DE 90 DIAS
=========================================================

Considere também:

"Se pudesse resolver apenas um problema nos próximos 90 dias, qual seria?"

Gere algumas perguntas capazes de verificar se essa prioridade percebida está alinhada aos dados operacionais.

=========================================================
QUANTIDADE DE PERGUNTAS
=========================================================

Gere normalmente:

5 a 7 perguntas por área.

Pode gerar até 8 quando a complexidade justificar.

Evite questionários excessivamente longos.

Priorize perguntas de alto poder diagnóstico.

=========================================================
FORMATO DAS PERGUNTAS
=========================================================

As perguntas devem permitir resposta:

SIM
PARCIALMENTE
NÃO

Portanto, não faça perguntas abertas no checklist.

Exemplo correto:

"A empresa conhece a margem por produto?"

Exemplo inadequado:

"Qual é a margem por produto?"

=========================================================
PESO
=========================================================

Cada pergunta deve receber peso:

1 = complementar

2 = importante

3 = crítico

Use peso 3 somente para controles realmente relevantes ao modelo de negócio.

=========================================================
MOTIVO
=========================================================

Para cada pergunta explique internamente o motivo.

O motivo será utilizado posteriormente pelo diagnóstico.

Exemplo:

Pergunta:

"A empresa conhece o custo completo por produto?"

Motivo:

"Verificar se a formação de preço e a análise de margem utilizam custo industrial confiável."

=========================================================
RISCO AVALIADO
=========================================================

Informe também o risco que a pergunta procura avaliar.

Exemplo:

"Venda de produtos com margem insuficiente por desconhecimento do custo completo."

=========================================================
EVITAR DUPLICIDADE
=========================================================

Não faça várias perguntas medindo exatamente o mesmo controle.

Cada pergunta deve adicionar informação nova.

=========================================================
LINGUAGEM
=========================================================

Use linguagem empresarial simples.

O empresário deve entender a pergunta sem precisar de conhecimento contábil ou técnico avançado.

Quando utilizar um termo técnico, deixe o significado evidente na própria pergunta.

=========================================================
NÃO INVENTAR
=========================================================

Não afirme:

- que a empresa tem problema;
- que possui dívida;
- que tem prejuízo;
- que possui estoque errado;
- que possui passivo;
- que está pagando imposto errado;
- que possui irregularidade.

Neste momento você está fazendo PERGUNTAS para descobrir essas informações.

=========================================================
RESULTADO DA INTERPRETAÇÃO
=========================================================

Antes das perguntas, produza uma interpretação do negócio contendo:

segmentoReal

subsegmento

modeloNegocio

resumoNegocio

comoGeraReceita

caracteristicasOperacionais

riscosNaturais

divergenciasCadastrais

nivelConfianca

=========================================================
NÍVEL DE CONFIANÇA
=========================================================

nivelConfianca deve ser:

alto
medio
baixo

Use "baixo" quando as informações fornecidas forem insuficientes ou contraditórias.

=========================================================
VALIDAÇÃO FINAL
=========================================================

Antes de responder, valide:

1. Entendi o que a empresa realmente faz?

2. Dei mais peso à descrição real do que ao CNAE?

3. Cruzei CNAE, atividade predominante e descrição?

4. Considerei somente as áreas selecionadas?

5. As perguntas são específicas para esse negócio?

6. As perguntas descobrem riscos reais?

7. Evitei perguntas genéricas?

8. Evitei duplicidades?

9. Cada pergunta pode ser respondida com Sim, Parcialmente ou Não?

10. Estou perguntando em vez de presumir?

O objetivo final é criar um questionário que pareça ter sido elaborado por um consultor que estudou aquela empresa antes da reunião.
`;

  // =========================================================
  // 6. CONTEXTO ENVIADO PARA IA
  // =========================================================

  const contexto = {
    cadastro: {
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

      segmentoPreClassificado:
        segmento || "",

      categoria:
        categoria || "",
    },

    negocioReal: {
      descricao:
        String(
          descricaoNegocio || ""
        ).trim(),
    },

    perfil: {
      faturamento:
        faturamento || "",

      colaboradores:
        colaboradores || "",

      regime:
        regime || "",
    },

    dores: {
      principal:
        dorPrincipal || "",

      objetivo90Dias:
        dor90Dias || "",

      impactos:
        Array.isArray(impactosDor)
          ? impactosDor
          : [],
    },

    areasSelecionadas,

    grupoEmpresarial:
      Array.isArray(empresas)
        ? empresas
        : [],
  };

  // =========================================================
  // 7. SCHEMA
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

          subsegmento: {
            type: "string",
          },

          modeloNegocio: {
            type: "string",
          },

          resumoNegocio: {
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
          "subsegmento",
          "modeloNegocio",
          "resumoNegocio",
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
          },

          required: [
            "id",
            "area",
            "tema",
            "pergunta",
            "motivo",
            "riscoAvaliado",
            "peso",
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
  // 8. CHAMADA OPENAI
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
                    "questionario_empresarial",

                  strict:
                    true,

                  schema,
                },
              },
            }),
        }
      );

    // =========================================================
    // 9. LER RESPOSTA
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
        .status(response.status)
        .json({
          sucesso: false,

          error:
            data?.error?.message ||
            "Erro ao gerar perguntas.",
        });
    }

    // =========================================================
    // 10. EXTRAIR TEXTO
    // =========================================================

    let texto =
      data.output_text || "";

    if (
      !texto &&
      Array.isArray(data.output)
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
            "A IA não retornou perguntas.",
        });
    }

    // =========================================================
    // 11. CONVERTER JSON
    // =========================================================

    let parsed;

    try {
      parsed =
        JSON.parse(texto);
    } catch (error) {
      console.error(
        "Erro JSON gerar perguntas:",
        texto
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
    // 12. VALIDAR / LIMPAR PERGUNTAS
    // =========================================================

    const perguntas =
      Array.isArray(
        parsed.perguntas
      )
        ? parsed.perguntas
            .filter(
              (item) =>
                item &&
                item.pergunta &&
                item.area
            )
            .map(
              (
                item,
                index
              ) => ({
                id:
                  String(
                    item.id ||
                    `ia_${index + 1}`
                  ),

                area:
                  String(
                    item.area
                  ),

                tema:
                  String(
                    item.tema ||
                    "Diagnóstico"
                  ),

                pergunta:
                  String(
                    item.pergunta
                  ),

                motivo:
                  String(
                    item.motivo ||
                    ""
                  ),

                riscoAvaliado:
                  String(
                    item.riscoAvaliado ||
                    ""
                  ),

                peso:
                  [1, 2, 3].includes(
                    Number(
                      item.peso
                    )
                  )
                    ? Number(
                        item.peso
                      )
                    : 2,
              })
            )
        : [];

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
    // 13. RETORNO PARA APP
    // =========================================================

    return res
      .status(200)
      .json({
        sucesso: true,

        modelo,

        negocioInterpretado:
          parsed.negocioInterpretado,

        perguntas,

        alertasInterpretacao:
          Array.isArray(
            parsed.alertasInterpretacao
          )
            ? parsed
                .alertasInterpretacao
                .slice(0, 5)
            : [],
      });

  } catch (error) {
    // =========================================================
    // 14. ERRO GERAL
    // =========================================================

    console.error(
      "Erro geral gerar perguntas:",
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
