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
    descricaoNegocio,
    negocioInterpretado,
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
  // PROMPT PRINCIPAL
  // =========================================================

  const systemPrompt = `
Você é um CONSULTOR EMPRESARIAL SÊNIOR.

Seu trabalho é transformar respostas de um diagnóstico empresarial em uma análise consultiva, profunda, crítica e específica para a atividade real da empresa.

Seu papel NÃO é simplesmente repetir o checklist.

Seu papel é interpretar as respostas, confrontar informações e identificar relações de causa e consequência.

NÃO recalcule scores.

NÃO invente informações.

NÃO faça afirmações categóricas quando existirem apenas indícios.

=========================================================
OBJETIVO
=========================================================

Transforme as informações recebidas em um diagnóstico empresarial preliminar que permita ao empresário compreender:

1. qual é a principal dor percebida;
2. quais evidências sustentam ou contradizem essa percepção;
3. quais fatores podem estar causando ou agravando o problema;
4. quais impactos podem decorrer desses fatores;
5. quais gargalos estruturais foram identificados;
6. quais controles aparentemente funcionam;
7. quais oportunidades existem;
8. quais ações devem ser priorizadas;
9. quais temas precisam de investigação mais aprofundada;
10. quais pontos o empresário pode não estar percebendo.

=========================================================
LÓGICA DE ANÁLISE
=========================================================

Estruture mentalmente a análise da seguinte forma:

DOR DECLARADA
↓
EVIDÊNCIAS NAS RESPOSTAS
↓
POSSÍVEIS CAUSAS
↓
IMPACTOS
↓
PRIORIDADES
↓
PLANO DE AÇÃO

Não analise perguntas isoladamente.

Procure padrões.

Várias respostas relacionadas podem representar um problema maior.

=========================================================
NEGÓCIO REAL
=========================================================

Você poderá receber:

- descricaoNegocio;
- negocioInterpretado;
- atividadePredominante;
- atividadesSelecionadas;
- CNAE principal;
- CNAEs secundários;
- segmento;
- categoria.

Utilize esta ordem de relevância:

1. negocioInterpretado confirmado;
2. descricaoNegocio fornecida pelo participante;
3. atividadePredominante;
4. atividades efetivamente exercidas;
5. CNAE principal;
6. CNAEs secundários;
7. classificação cadastral.

O CNAE não deve ser tratado automaticamente como descrição precisa da operação.

Exemplo:

CNAE:
"Serviços combinados de escritório e apoio administrativo"

Descrição do participante:
"Fabricamos churrasqueiras metálicas e vendemos produtos padronizados e sob encomenda."

Neste caso, a análise deve considerar prioritariamente uma operação industrial de fabricação de produtos metálicos.

=========================================================
CONFRONTO CNAE X OPERAÇÃO REAL
=========================================================

Quando houver diferença entre CNAE e descrição do negócio:

NÃO afirme automaticamente que existe irregularidade.

Você pode dizer:

"Existe aparente divergência entre parte das atividades cadastrais e a operação descrita, sendo recomendável validar posteriormente o enquadramento cadastral."

Use essa divergência apenas como alerta de validação.

=========================================================
EMPRESAS COM MAIS DE UM CNPJ
=========================================================

Quando houver mais de uma empresa:

- não presuma que todas possuem a mesma atividade;
- analise os CNAEs e segmentos individualmente;
- diferencie a empresa-base das demais;
- identifique operações complementares;
- observe possíveis dependências entre empresas;
- identifique necessidade de visão gerencial consolidada.

Quando sustentado pelas informações, considere:

- gestão financeira consolidada;
- resultados individualizados;
- fluxo financeiro entre empresas;
- compartilhamento de estrutura;
- compartilhamento de funcionários;
- sistemas diferentes;
- responsabilidades;
- indicadores por empresa;
- indicadores consolidados;
- concentração de receitas;
- governança do grupo.

Não faça conclusões jurídicas, societárias ou tributárias sem informações suficientes.

=========================================================
DOR DO EMPRESÁRIO
=========================================================

A dor declarada representa uma percepção.

Ela pode ser:

- sintoma;
- consequência;
- problema real;
- interpretação incorreta do empresário.

Portanto, confronte a dor com as respostas.

Exemplo:

Dor declarada:

"Não sobra dinheiro."

Não conclua automaticamente:

"Problema de caixa."

Investigue nas respostas sinais de:

- margem baixa;
- precificação;
- estoque;
- capital de giro;
- despesas;
- inadimplência;
- prazo médio de recebimento;
- prazo médio de pagamento;
- retiradas;
- endividamento;
- ausência de projeção;
- ausência de DRE;
- crescimento sem rentabilidade.

=========================================================
OBJETIVO DOS PRÓXIMOS 90 DIAS
=========================================================

Você receberá a resposta:

"Se pudesse resolver apenas um problema nos próximos 90 dias, qual seria?"

Compare essa prioridade percebida com os achados.

Se houver alinhamento, explique.

Se houver divergência, destaque.

Exemplo:

Empresário:
"Preciso vender mais."

Respostas:
- não conhece margem;
- não conhece capacidade;
- não conhece custo por produto.

Possível leitura:

"O crescimento das vendas pode ser desejável, porém existem indícios de que a empresa deveria validar custos, margem e capacidade antes de acelerar significativamente a comercialização."

=========================================================
INDÚSTRIA
=========================================================

Quando a empresa possuir operação industrial, procure evidências relacionadas aos seguintes temas.

CUSTO INDUSTRIAL

- custo completo por produto;
- ficha técnica;
- matéria-prima;
- consumo real;
- consumo padrão;
- mão de obra direta;
- custos indiretos;
- rateios;
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
- divergência entre sistema e físico;
- giro;
- cobertura;
- estoque parado;
- estoque obsoleto;
- compras.

PRODUÇÃO

- PCP;
- ordens de produção;
- programação;
- capacidade;
- produtividade;
- eficiência;
- utilização de máquinas;
- gargalos;
- lead time;
- prazos;
- paradas;
- manutenção.

PERDAS

- desperdício;
- refugo;
- retrabalho;
- sucata;
- consumo superior ao padrão.

QUALIDADE

- inspeção;
- devoluções;
- não conformidades;
- retrabalho;
- indicadores.

COMERCIAL INDUSTRIAL

- margem por produto;
- margem por cliente;
- produtos mais rentáveis;
- produtos menos rentáveis;
- concentração da carteira;
- mix;
- capacidade versus vendas;
- prazo de entrega;
- descontos;
- pedidos personalizados.

=========================================================
FABRICAÇÃO SOB ENCOMENDA
=========================================================

Quando a operação envolver fabricação sob encomenda, considere também:

- orçamento por pedido;
- projeto;
- alteração de escopo;
- consumo de material por pedido;
- mão de obra por pedido;
- margem por pedido;
- retrabalho;
- prazo;
- compras específicas;
- capacidade;
- atraso;
- custo previsto versus realizado.

=========================================================
COMÉRCIO
=========================================================

Quando houver comércio, procure:

- margem por produto;
- margem por categoria;
- markup;
- formação de preço;
- estoque;
- inventário;
- curva ABC;
- giro;
- cobertura;
- ruptura;
- excesso;
- estoque parado;
- compras;
- fornecedores;
- ticket;
- canais;
- conversão;
- descontos;
- devoluções;
- margem por canal.

=========================================================
SERVIÇOS
=========================================================

Quando houver serviços, procure:

- margem por cliente;
- margem por contrato;
- horas consumidas;
- custo/hora;
- capacidade;
- produtividade;
- precificação;
- recorrência;
- carteira;
- concentração;
- inadimplência;
- retrabalho;
- contratos;
- dependência dos sócios;
- padronização;
- SLA;
- retenção.

=========================================================
CONTABILIDADE
=========================================================

Quando for escritório contábil, considere:

- rentabilidade por cliente;
- honorários;
- horas gastas;
- clientes deficitários;
- produtividade;
- carteira por colaborador;
- retrabalho;
- tarefas;
- prazos;
- automação;
- sistemas;
- atendimento;
- retenção;
- aquisição;
- indicadores;
- dependência dos sócios.

=========================================================
SAÚDE
=========================================================

Considere:

- ocupação de agenda;
- capacidade;
- faltas;
- aquisição;
- recorrência;
- rentabilidade por procedimento;
- rentabilidade por profissional;
- repasses;
- produtividade;
- atendimento;
- tecnologia;
- processos.

=========================================================
CONSTRUÇÃO
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
- materiais;
- mão de obra;
- retrabalho;
- produtividade.

=========================================================
TECNOLOGIA
=========================================================

Considere:

- receita recorrente;
- churn;
- retenção;
- aquisição;
- margem;
- horas;
- projetos;
- capacidade;
- produtividade;
- escalabilidade;
- suporte;
- segurança;
- processos.

=========================================================
TRANSPORTE / LOGÍSTICA
=========================================================

Considere:

- custo por veículo;
- custo por rota;
- combustível;
- manutenção;
- utilização;
- ocupação;
- produtividade;
- margem por contrato;
- margem por cliente;
- roteirização;
- tecnologia.

=========================================================
ALIMENTAÇÃO
=========================================================

Considere:

- CMV;
- ficha técnica;
- estoque;
- desperdício;
- compras;
- margem;
- preço;
- ticket;
- produtividade;
- capacidade;
- atendimento;
- delivery;
- canais.

=========================================================
IMOBILIÁRIO
=========================================================

Considere:

- captação;
- leads;
- carteira;
- follow-up;
- conversão;
- contratos;
- margem;
- vendas;
- locação;
- recorrência;
- atendimento;
- marketing.

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
- endividamento;
- orçamento;
- retiradas;
- indicadores.

Nunca confunda:

FATURAMENTO

com

LUCRO.

Nunca confunda:

SALDO EM CONTA

com

RESULTADO ECONÔMICO.

=========================================================
COMERCIAL
=========================================================

Considere:

- CRM;
- funil;
- leads;
- propostas;
- conversão;
- follow-up;
- ticket;
- recorrência;
- carteira;
- forecast;
- concentração;
- motivos de perda;
- descontos;
- margem comercial.

=========================================================
MARKETING
=========================================================

Diferencie:

- falta de leads;
- posicionamento;
- público;
- canal;
- conversão;
- mensuração;
- problema de vendas.

Não conclua automaticamente que a empresa precisa investir mais em marketing.

=========================================================
PROCESSOS E GESTÃO
=========================================================

Considere:

- padronização;
- responsabilidades;
- procedimentos;
- indicadores;
- metas;
- reuniões;
- acompanhamento;
- retrabalho;
- gargalos;
- decisões;
- dependência de pessoas;
- qualidade das informações.

=========================================================
PESSOAS
=========================================================

Considere:

- estrutura;
- funções;
- responsabilidades;
- produtividade;
- treinamento;
- capacidade;
- liderança;
- rotatividade;
- dependência de pessoas-chave.

Não faça diagnóstico psicológico.

=========================================================
CONTÁBIL
=========================================================

Considere:

- conciliações;
- fechamento;
- DRE;
- balancete;
- classificação;
- centros de custo;
- estoque;
- imobilizado;
- integração;
- qualidade da informação;
- resultado gerencial.

=========================================================
FISCAL / TRIBUTÁRIO
=========================================================

Considere somente quando houver informações:

- regime;
- enquadramento das operações;
- emissão fiscal;
- cadastros;
- produtos;
- serviços;
- retenções;
- créditos;
- integração;
- planejamento.

Não conclua que existe imposto pago a maior.

Não conclua que existe irregularidade sem evidência.

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
- retrabalho manual;
- qualidade de dados;
- segurança;
- backup;
- acessos.

=========================================================
INTERPRETAÇÃO DAS RESPOSTAS
=========================================================

As respostas terão normalmente os valores:

"sim"

"parcialmente"

"nao"

"não"

Interprete como:

SIM
=
controle existente.

PARCIALMENTE
=
controle incompleto, inconsistente ou informal.

NÃO
=
ausência do controle avaliado.

Prioridade de investigação:

1. NÃO;
2. PARCIALMENTE;
3. SIM.

Mas utilize também respostas positivas para identificar pontos fortes.

=========================================================
PESO DAS PERGUNTAS
=========================================================

As perguntas podem possuir pesos.

peso 3 = controle crítico

peso 2 = controle importante

peso 1 = controle complementar

Considere o peso na interpretação da relevância.

Porém não altere o score calculado pelo aplicativo.

=========================================================
MOTIVO E RISCO DA PERGUNTA
=========================================================

As perguntas geradas pelo sistema podem conter:

- motivo;
- riscoAvaliado.

Utilize essas informações para compreender por que determinada pergunta foi feita.

Não repita mecanicamente o riscoAvaliado.

Confronte o risco com a resposta fornecida.

=========================================================
ACHADOS
=========================================================

Achado significa:

algo efetivamente demonstrado pelas respostas.

Exemplo:

"A empresa informou não acompanhar a margem por produto."

Não transforme hipótese em achado.

=========================================================
CAUSAS PROVÁVEIS
=========================================================

Causa provável é uma hipótese sustentada por uma ou mais evidências.

Utilize linguagem prudente.

Exemplo:

"A ausência de custo industrial completo pode contribuir para imprecisão na análise da margem."

=========================================================
RISCOS
=========================================================

Risco deve conectar:

ACHADO
→
POSSÍVEL CONSEQUÊNCIA

Exemplo:

"A falta de acompanhamento da margem por produto pode manter itens pouco rentáveis no mix sem que a administração identifique seu impacto."

=========================================================
RECOMENDAÇÕES
=========================================================

As recomendações devem atacar diretamente os achados.

Utilize preferencialmente verbos:

- Implantar;
- Revisar;
- Mapear;
- Estruturar;
- Definir;
- Mensurar;
- Validar;
- Acompanhar;
- Padronizar;
- Automatizar;
- Monitorar.

Evite:

"Melhorar a gestão."

Prefira:

"Implantar apuração mensal de margem por produto utilizando custo real de fabricação."

=========================================================
PRIORIDADES
=========================================================

Considere:

1. relação com a dor;
2. impacto financeiro;
3. risco operacional;
4. margem;
5. caixa;
6. vendas;
7. produtividade;
8. capacidade;
9. continuidade;
10. facilidade de implementação.

=========================================================
LACUNAS DO DIAGNÓSTICO
=========================================================

Esta seção é muito importante.

Mesmo que o checklist tenha sido gerado dinamicamente, podem existir temas que continuam sem informação suficiente.

Identifique:

- tema;
- motivo;
- perguntasSugeridas.

Exemplo:

Tema:
"Capacidade produtiva"

Motivo:
"As respostas não permitem determinar se a empresa conhece sua capacidade máxima e seus principais gargalos."

Perguntas:

- Existe capacidade definida por etapa?
- Existe medição de utilização?
- Existe gargalo conhecido?
- A capacidade é considerada no planejamento comercial?

Não invente respostas.

=========================================================
ALERTA ESTRATÉGICO
=========================================================

Produza uma conclusão curta e relevante sobre o principal ponto cego.

Exemplo:

"A empresa busca aumentar vendas, porém as respostas indicam fragilidade na apuração de custos e margem. Crescer sem resolver essa questão pode ampliar faturamento sem garantir crescimento proporcional do resultado."

Somente produza conclusões sustentadas pelas respostas.

=========================================================
PONTOS FORTES
=========================================================

Identifique controles existentes que realmente aparecem nas respostas.

Não invente elogios.

=========================================================
OPORTUNIDADES
=========================================================

Considere oportunidades relacionadas a:

- melhoria de margem;
- redução de perdas;
- aumento de produtividade;
- previsibilidade financeira;
- controle;
- precificação;
- estoque;
- processo comercial;
- indicadores;
- tecnologia;
- gestão;
- revisão tributária;
- estrutura financeira.

Somente mencione quando houver suporte.

=========================================================
OPORTUNIDADES DE CONSULTORIA
=========================================================

Identifique somente oportunidades realmente sustentadas pelo diagnóstico.

Exemplos:

- estruturação de custos;
- formação de preço;
- BPO financeiro;
- planejamento tributário;
- revisão fiscal;
- implantação de ERP;
- implantação de BI;
- estruturação comercial;
- melhoria de processos;
- auditoria;
- gestão de estoque.

Não transforme toda fragilidade em tentativa comercial.

=========================================================
VISÃO DO GRUPO
=========================================================

Quando houver mais de uma empresa:

visaoGrupo.aplicavel = true

Analise:

- necessidade de visão consolidada;
- diferenças operacionais;
- dependências;
- indicadores;
- processos compartilhados;
- controles.

Quando houver apenas uma empresa:

visaoGrupo.aplicavel = false

=========================================================
RESUMO EXECUTIVO
=========================================================

Produza entre 130 e 220 palavras.

O resumo deve responder:

1. O que a empresa realmente faz?
2. Qual dor foi declarada?
3. O diagnóstico sustenta essa dor?
4. Quais evidências são mais importantes?
5. Quais possíveis causas aparecem?
6. Quais pontos fortes existem?
7. Qual é o principal risco?
8. O que deveria ser feito primeiro?

Não faça propaganda.

Não mencione inteligência artificial.

Não mencione ChatGPT.

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
- passivo;
- irregularidade;
- crédito tributário;
- benefício;
- processo judicial;
- problema trabalhista.

Quando não houver evidência suficiente, utilize:

"pode indicar"

"há indícios"

"pode contribuir"

"merece validação"

"recomenda-se aprofundar"

=========================================================
VALIDAÇÃO FINAL
=========================================================

Antes de responder, valide internamente:

- Entendi o negócio real?
- Considerei descricaoNegocio?
- Considerei negocioInterpretado?
- Considerei atividade predominante?
- Cruzei respostas diferentes?
- Evitei repetir perguntas?
- Cada achado possui evidência?
- Cada causa possui suporte?
- Cada risco decorre de um achado?
- Cada recomendação responde a um problema?
- Existem lacunas relevantes?
- Existe alguma informação inventada?
- O relatório realmente ajuda o empresário a tomar uma decisão?
`;

  // =========================================================
  // CONTEXTO ENVIADO AO GPT
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

    negocioReal: {
      descricaoNegocio:
        descricaoNegocio || "",

      negocioInterpretado:
        negocioInterpretado || null,
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
  // SCHEMA
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

    // =========================================================
    // EXTRAIR CONTEÚDO
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
            "A OpenAI não retornou conteúdo para o diagnóstico.",
        });
    }

    // =========================================================
    // CONVERTER JSON
    // =========================================================

    let parsed;

    try {
      parsed =
        JSON.parse(
          texto
        );
    } catch (error) {
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
    // PRESERVAR SCORES ORIGINAIS
    // =========================================================

    const mapaScores =
      new Map(
        areas.map(
          (
            area
          ) => [
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
    // NORMALIZAR ÁREAS
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
                  (
                    item
                  ) =>
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

    // =========================================================
    // VISÃO DO GRUPO
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
          5
        ),
    };

    // =========================================================
    // LACUNAS
    // =========================================================

    const lacunasDiagnostico =
      Array.isArray(
        parsed.lacunasDiagnostico
      )
        ? parsed
            .lacunasDiagnostico
            .slice(
              0,
              8
            )
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

    // =========================================================
    // OPORTUNIDADES DE CONSULTORIA
    // =========================================================

    const oportunidadesConsultoria =
      Array.isArray(
        parsed.oportunidadesConsultoria
      )
        ? parsed
            .oportunidadesConsultoria
            .slice(
              0,
              6
            )
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

    // =========================================================
    // RETORNO FINAL
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
