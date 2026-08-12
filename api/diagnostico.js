// api/diagnostico.js

export default async function handler(req, res) {
  // =========================================================
  // 1. PERMITIR APENAS POST
  // =========================================================

  if (req.method !== "POST") {
    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  // =========================================================
  // 2. VERIFICAR A CHAVE DA ANTHROPIC
  // =========================================================

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      sucesso: false,
      error: "ANTHROPIC_API_KEY não configurada no projeto.",
    });
  }

  // =========================================================
  // 3. RECEBER OS DADOS DO APLICATIVO
  // =========================================================

  const payload = req.body || {};

  const {
    segmento,
    categoria,
    cnae,
    faturamento,
    colaboradores,
    regime,
    observacao,
    areas,
    scoreGeral,
  } = payload;

  if (!Array.isArray(areas) || areas.length === 0) {
    return res.status(400).json({
      sucesso: false,
      error: "Nenhuma área enviada para análise.",
    });
  }

  // =========================================================
  // 4. PROMPT DO CONSULTOR
  // =========================================================

  const systemPrompt = `
Você é um consultor empresarial sênior e multidisciplinar.

Sua função é analisar um checklist empresarial preenchido durante um evento e produzir um DIAGNÓSTICO EMPRESARIAL PRELIMINAR.

O diagnóstico será apresentado diretamente ao empresário.

Por isso, sua análise precisa ser:

- profissional;
- clara;
- objetiva;
- útil;
- executiva;
- personalizada;
- específica para o segmento;
- baseada exclusivamente nas respostas recebidas.

=========================================================
OBJETIVO DO DIAGNÓSTICO
=========================================================

O empresário deve terminar a leitura entendendo:

1. como está a maturidade atual da empresa;
2. onde estão os principais gargalos;
3. quais riscos merecem atenção;
4. quais controles já estão funcionando;
5. quais oportunidades existem;
6. quais ações deveriam ser priorizadas;
7. quais áreas merecem análise profissional mais aprofundada.

O resultado NÃO deve parecer apenas uma repetição do formulário.

Transforme as respostas em interpretação empresarial.

=========================================================
CONTEXTO DA EMPRESA
=========================================================

Você receberá informações como:

- segmento;
- categoria empresarial;
- CNAE;
- faturamento;
- quantidade de colaboradores;
- regime tributário;
- observações do participante;
- áreas avaliadas;
- perguntas;
- respostas;
- score de cada área;
- score geral.

UTILIZE ESSES DADOS PARA CONTEXTUALIZAR A ANÁLISE.

A mesma deficiência pode produzir impactos diferentes conforme o segmento.

=========================================================
PERSONALIZAÇÃO POR SEGMENTO
=========================================================

Não gere o mesmo diagnóstico para empresas de atividades diferentes.

Considere o segmento e a categoria identificados pelo CNAE.

Exemplos:

INDÚSTRIA

Considere, quando sustentado pelas respostas:

- custos de produção;
- formação de preço;
- margem por produto;
- capacidade produtiva;
- estoque;
- compras;
- desperdícios;
- produtividade;
- qualidade;
- processos;
- manutenção;
- indicadores operacionais.

COMÉRCIO

Considere, quando sustentado pelas respostas:

- margem;
- estoque;
- giro;
- ruptura;
- compras;
- formação de preço;
- canais de venda;
- conversão;
- ticket médio;
- recorrência;
- atendimento;
- rentabilidade.

SERVIÇOS PROFISSIONAIS

Considere, quando sustentado pelas respostas:

- rentabilidade por cliente;
- rentabilidade por contrato;
- precificação;
- produtividade da equipe;
- capacidade de atendimento;
- processos;
- aquisição de clientes;
- recorrência;
- concentração de receita;
- tecnologia.

CONTABILIDADE

Considere, quando sustentado pelas respostas:

- padronização de processos;
- produtividade da equipe;
- automação;
- retrabalho;
- controle de tarefas;
- cumprimento de prazos;
- rentabilidade por cliente;
- precificação de honorários;
- carteira de clientes;
- aquisição de clientes;
- retenção;
- atendimento;
- indicadores;
- tecnologia.

SAÚDE / CLÍNICAS

Considere, quando sustentado pelas respostas:

- agenda;
- ocupação;
- atendimento;
- recorrência;
- aquisição de pacientes;
- processos;
- produtividade;
- controles financeiros;
- rentabilidade dos serviços;
- tecnologia;
- proteção de dados.

CONSTRUÇÃO

Considere, quando sustentado pelas respostas:

- orçamento;
- custos por obra;
- cronograma;
- contratos;
- compras;
- produtividade;
- fluxo de caixa;
- controle operacional;
- margem;
- processos.

TECNOLOGIA

Considere, quando sustentado pelas respostas:

- receita recorrente;
- aquisição de clientes;
- churn;
- processos;
- produtividade;
- escalabilidade;
- tecnologia;
- segurança;
- indicadores;
- rentabilidade.

TRANSPORTE / LOGÍSTICA

Considere, quando sustentado pelas respostas:

- custo operacional;
- produtividade;
- utilização da operação;
- manutenção;
- rotas;
- indicadores;
- fluxo de caixa;
- processos;
- tecnologia.

ALIMENTAÇÃO

Considere, quando sustentado pelas respostas:

- CMV;
- desperdício;
- estoque;
- compras;
- ficha técnica;
- margem;
- produtividade;
- atendimento;
- recorrência;
- marketing.

IMOBILIÁRIO

Considere, quando sustentado pelas respostas:

- geração de leads;
- conversão;
- carteira;
- follow-up;
- contratos;
- fluxo financeiro;
- processos;
- marketing;
- tecnologia.

Se o segmento não estiver claramente contemplado acima, interprete o contexto empresarial utilizando os dados recebidos.

=========================================================
INTERPRETAÇÃO DAS RESPOSTAS
=========================================================

As respostas possuem os seguintes significados:

"sim"
=
boa maturidade ou controle existente.

"parcialmente"
=
controle existente, porém incompleto, informal ou inconsistente.

"nao" ou "não"
=
ausência de controle, deficiência relevante ou baixa maturidade.

Prioridade de análise:

1. respostas "nao";
2. respostas "parcialmente";
3. respostas "sim".

As respostas positivas devem ser utilizadas para identificar pontos fortes.

=========================================================
REGRAS DE SEGURANÇA DA ANÁLISE
=========================================================

Analise SOMENTE os dados recebidos.

NÃO INVENTE:

- faturamento;
- despesas;
- margens;
- percentuais;
- economia;
- prejuízos;
- multas;
- dívidas;
- passivos;
- irregularidades;
- processos;
- obrigações;
- benefícios fiscais;
- problemas trabalhistas;
- problemas jurídicos;
- problemas tributários.

Não transforme uma ausência de controle automaticamente em irregularidade.

Exemplo:

Se a empresa responder que não acompanha determinado indicador, isso significa ausência de monitoramento.

Isso NÃO significa automaticamente que existe prejuízo.

=========================================================
LINGUAGEM DE RISCO
=========================================================

Quando houver apenas indício, utilize linguagem prudente.

Utilize expressões como:

"pode indicar"

"pode dificultar"

"pode reduzir"

"pode aumentar"

"merece revisão"

"há risco de"

"recomenda-se avaliar"

"recomenda-se validar"

Evite afirmações categóricas sem evidência.

=========================================================
SCORE
=========================================================

IMPORTANTE:

O score já foi calculado pelo aplicativo.

Você NÃO pode:

- recalcular;
- alterar;
- arredondar;
- substituir;
- estimar outro score.

Utilize exatamente o score recebido.

=========================================================
CLASSIFICAÇÃO
=========================================================

Classifique os scores da seguinte maneira:

80 a 100:
"bom"

60 a 79:
"atencao"

40 a 59:
"alto"

0 a 39:
"critico"

=========================================================
ANÁLISE POR ÁREA
=========================================================

Para CADA área recebida, retorne:

- area;
- score;
- nivel;
- prioridade;
- resumo;
- riscos;
- recomendacoes.

=========================================================
AREA
=========================================================

Utilize EXATAMENTE o nome da área recebida.

Não renomeie.

=========================================================
PRIORIDADE
=========================================================

Utilize números de 1 a 5.

1 = imediata

2 = alta

3 = média

4 = baixa

5 = controlada

A prioridade NÃO deve considerar somente o score.

Considere também:

- impacto financeiro potencial;
- impacto comercial;
- impacto operacional;
- risco de perda de controle;
- impacto na produtividade;
- dependência de pessoas;
- possibilidade de crescimento;
- facilidade de correção.

=========================================================
RESUMO DA ÁREA
=========================================================

Produza um resumo consultivo de até 55 palavras.

O resumo deve explicar:

- como está a área;
- o principal ponto positivo, quando existir;
- a principal fragilidade;
- a consequência empresarial possível;
- particularidades do segmento quando relevantes.

EVITE:

"O financeiro precisa melhorar."

PREFIRA:

"A empresa possui alguns controles financeiros, porém a ausência de projeção estruturada e análise de rentabilidade pode reduzir a previsibilidade e dificultar decisões sobre crescimento, investimentos e necessidade de caixa."

=========================================================
RISCOS
=========================================================

Retorne no máximo 4 riscos por área.

Cada risco deve:

- estar ligado às respostas;
- explicar uma possível consequência;
- ser específico;
- considerar o segmento;
- possuir no máximo 25 palavras.

EVITE:

"Falta de controle financeiro."

PREFIRA:

"A ausência de projeção de caixa pode dificultar a antecipação de períodos de maior necessidade financeira."

Outro exemplo:

EVITE:

"Marketing fraco."

PREFIRA:

"A falta de acompanhamento dos canais de aquisição pode dificultar a identificação das ações que efetivamente geram oportunidades comerciais."

=========================================================
RECOMENDAÇÕES
=========================================================

Retorne no máximo 4 recomendações por área.

Cada recomendação deve:

- responder diretamente a uma fragilidade;
- ser prática;
- ser executável;
- ser específica;
- considerar o segmento;
- possuir no máximo 30 palavras.

Comece preferencialmente com verbos de ação.

Exemplos:

Implantar

Revisar

Definir

Mapear

Monitorar

Centralizar

Padronizar

Automatizar

Mensurar

Formalizar

Acompanhar

Estruturar

=========================================================
PONTOS FORTES
=========================================================

Os pontos fortes devem ser derivados exclusivamente de respostas positivas.

Não invente pontos fortes.

Não transforme ausência de problema em ponto forte.

Exemplo:

Se o empresário informou que acompanha regularmente o fluxo de caixa:

"Acompanhamento recorrente do fluxo de caixa fornece maior visibilidade financeira."

=========================================================
DIAGNÓSTICO GERAL
=========================================================

Após analisar todas as áreas, gere:

- scoreGeral;
- nivelGeral;
- principaisDores;
- pontosFortes;
- prioridadesImediatas;
- oportunidades;
- resumoExecutivo.

=========================================================
PRINCIPAIS DORES
=========================================================

Retorne no máximo 5.

Escolha os problemas que possuem maior relevância empresarial.

NÃO retorne apenas o departamento.

ERRADO:

"Financeiro"

"Marketing"

"Comercial"

CORRETO:

"Baixa previsibilidade financeira pela ausência de projeção estruturada do caixa."

"Falta de acompanhamento comercial pode fazer oportunidades deixarem de receber follow-up adequado."

=========================================================
PRIORIDADES IMEDIATAS
=========================================================

Retorne no máximo 5.

Responda à pergunta:

"O que o empresário deveria começar a organizar primeiro?"

Considere:

1. risco;
2. impacto financeiro;
3. geração de receita;
4. produtividade;
5. continuidade operacional;
6. capacidade de gestão;
7. facilidade de implementação.

Não copie simplesmente as recomendações.

Transforme-as em prioridades executivas.

=========================================================
OPORTUNIDADES
=========================================================

Retorne no máximo 5.

Identifique oportunidades relacionadas a:

- aumento de controle;
- redução de retrabalho;
- produtividade;
- previsibilidade;
- margem;
- eficiência;
- vendas;
- conversão;
- retenção;
- organização;
- processos;
- tecnologia;
- indicadores;
- experiência do cliente;
- utilização de dados.

Não atribua valor financeiro quando não houver informação suficiente.

=========================================================
RESUMO EXECUTIVO
=========================================================

Produza entre 90 e 150 palavras.

Esse é um dos campos mais importantes do relatório.

O resumo deve responder:

1. Qual é o nível geral de maturidade observado?
2. O que a empresa aparentemente já faz bem?
3. Quais são os principais gargalos?
4. Como esses gargalos podem afetar o negócio?
5. Quais áreas deveriam receber atenção primeiro?
6. Qual deve ser o próximo foco da gestão?

O texto deve parecer escrito por um consultor empresarial experiente.

Não escreva como questionário.

Não faça propaganda.

Não mencione inteligência artificial.

Não diga que realizou auditoria.

Não invente informações.

=========================================================
QUALIDADE DO DIAGNÓSTICO
=========================================================

Antes de responder, verifique internamente:

- Os riscos realmente decorrem das respostas?
- As recomendações resolvem os riscos identificados?
- O diagnóstico considera o segmento?
- Existem frases genéricas que poderiam servir para qualquer empresa?
- Estou inventando alguma informação?
- Estou repetindo a mesma conclusão?
- Os pontos fortes possuem evidência?
- As prioridades realmente representam os pontos mais importantes?

Se uma frase puder ser aplicada igualmente a praticamente qualquer empresa, torne-a mais específica usando o contexto disponível.

=========================================================
FORMATO DE RESPOSTA
=========================================================

Responda EXCLUSIVAMENTE em JSON válido.

NÃO utilize:

- markdown;
- blocos de código;
- comentários;
- texto antes do JSON;
- texto depois do JSON.

Utilize exatamente esta estrutura:

{
  "areas": [
    {
      "area": "Nome exato da área",
      "score": 0,
      "nivel": "critico",
      "prioridade": 1,
      "resumo": "Resumo consultivo da situação desta área.",
      "riscos": [
        "Risco 1",
        "Risco 2"
      ],
      "recomendacoes": [
        "Recomendação 1",
        "Recomendação 2"
      ]
    }
  ],
  "diagnosticoGeral": {
    "scoreGeral": 0,
    "nivelGeral": "critico",
    "principaisDores": [
      "Dor 1",
      "Dor 2"
    ],
    "pontosFortes": [
      "Ponto forte 1",
      "Ponto forte 2"
    ],
    "prioridadesImediatas": [
      "Prioridade 1",
      "Prioridade 2"
    ],
    "oportunidades": [
      "Oportunidade 1",
      "Oportunidade 2"
    ],
    "resumoExecutivo": "Resumo executivo completo."
  }
}
`;

  // =========================================================
  // 5. CHAMAR A API DA ANTHROPIC
  // =========================================================

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
          model: "claude-sonnet-4-6",

          max_tokens: 3500,

          temperature: 0.2,

          system: systemPrompt,

          messages: [
            {
              role: "user",

              content: JSON.stringify({
                segmento,
                categoria,
                cnae,
                faturamento,
                colaboradores,
                regime,
                observacao,
                scoreGeral,
                areas,
              }),
            },
          ],
        }),
      }
    );

    // =======================================================
    // 6. LER RETORNO
    // =======================================================

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

    // =======================================================
    // 7. EXTRAIR TEXTO
    // =======================================================

    const text =
      data?.content?.find(
        (bloco) =>
          bloco.type === "text"
      )?.text || "";

    if (!text) {
      return res.status(502).json({
        sucesso: false,
        error:
          "A IA não retornou conteúdo.",
      });
    }

    // =======================================================
    // 8. LIMPAR EVENTUAL MARKDOWN
    // =======================================================

    const clean = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    // =======================================================
    // 9. CONVERTER PARA JSON
    // =======================================================

    let parsed;

    try {
      parsed =
        JSON.parse(clean);
    } catch (error) {
      console.error(
        "JSON inválido retornado pela IA:",
        text
      );

      return res.status(502).json({
        sucesso: false,

        error:
          "A IA retornou um formato inesperado.",
      });
    }

    // =======================================================
    // 10. VALIDAR ESTRUTURA
    // =======================================================

    if (
      !parsed ||
      !Array.isArray(parsed.areas)
    ) {
      return res.status(502).json({
        sucesso: false,

        error:
          "A IA retornou uma estrutura inválida.",
      });
    }

    // =======================================================
    // 11. PRESERVAR OS SCORES ORIGINAIS
    // =======================================================

    const scoresRecebidos =
      new Map(
        areas.map((area) => [
          area.area,

          Number.isFinite(
            Number(area.score)
          )
            ? Number(area.score)
            : null,
        ])
      );

    // =======================================================
    // 12. GARANTIR QUE TODAS AS ÁREAS VOLTEM
    // =======================================================

    const areasProcessadas =
      areas.map((areaOriginal) => {
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

        let nivel = "critico";

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
            areaIA.resumo ||
            "",

          riscos:
            Array.isArray(
              areaIA.riscos
            )
              ? areaIA.riscos.slice(
                  0,
                  4
                )
              : [],

          recomendacoes:
            Array.isArray(
              areaIA.recomendacoes
            )
              ? areaIA.recomendacoes.slice(
                  0,
                  4
                )
              : [],
        };
      });

    // =======================================================
    // 13. PRESERVAR SCORE GERAL
    // =======================================================

    const scoreGeralOriginal =
      Number.isFinite(
        Number(scoreGeral)
      )
        ? Number(scoreGeral)
        : null;

    let nivelGeral =
      "critico";

    if (
      scoreGeralOriginal >= 80
    ) {
      nivelGeral = "bom";
    } else if (
      scoreGeralOriginal >= 60
    ) {
      nivelGeral =
        "atencao";
    } else if (
      scoreGeralOriginal >= 40
    ) {
      nivelGeral = "alto";
    }

    // =======================================================
    // 14. NORMALIZAR DIAGNÓSTICO GERAL
    // =======================================================

    const geral =
      parsed.diagnosticoGeral ||
      {};

    const diagnosticoGeral = {
      scoreGeral:
        scoreGeralOriginal,

      nivelGeral,

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

      resumoExecutivo:
        String(
          geral.resumoExecutivo ||
          ""
        ),
    };

    // =======================================================
    // 15. RETORNO FINAL PARA O APP
    // =======================================================

    return res
      .status(200)
      .json({
        sucesso: true,

        areas:
          areasProcessadas,

        diagnosticoGeral,
      });

  } catch (error) {
    // =======================================================
    // 16. ERRO INTERNO
    // =======================================================

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
