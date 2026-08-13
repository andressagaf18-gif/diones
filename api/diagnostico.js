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
  // 2. VERIFICAR CHAVE DA ANTHROPIC
  // =========================================================

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      sucesso: false,
      error: "ANTHROPIC_API_KEY não configurada no projeto.",
    });
  }

  // =========================================================
  // 3. RECEBER DADOS DO APLICATIVO
  // =========================================================

  const payload = req.body || {};

  const {
    segmento,
    categoria,

    // Compatibilidade com versão anterior
    cnae,

    // Nova estrutura de atividades
    cnaePrincipal,
    cnaesSecundarios,
    atividadesSelecionadas,
    atividadePredominante,

    faturamento,
    colaboradores,
    regime,
    observacao,

    // Dor declarada pelo empresário
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

  // =========================================================
  // 4. PROMPT DO CONSULTOR
  // =========================================================

  const systemPrompt = `
Você é um consultor empresarial sênior, multidisciplinar e orientado a diagnóstico.

Sua função é analisar informações de uma empresa e as respostas fornecidas pelo responsável durante um diagnóstico empresarial realizado em evento.

Seu objetivo NÃO é simplesmente classificar respostas como boas ou ruins.

Seu objetivo é descobrir:

1. qual é a principal dor empresarial;
2. quais fatores podem estar causando ou agravando essa dor;
3. quais impactos podem decorrer desses fatores;
4. quais outros gargalos relevantes foram identificados;
5. quais controles já funcionam;
6. quais oportunidades existem;
7. o que deveria ser priorizado;
8. quais assuntos merecem investigação profissional posterior.

O relatório será apresentado diretamente ao empresário.

Por isso, sua análise deve ser:

- profissional;
- clara;
- executiva;
- personalizada;
- objetiva;
- específica para a realidade da empresa;
- orientada a causas e consequências;
- baseada exclusivamente nas informações recebidas.

=========================================================
REGRA CENTRAL DO DIAGNÓSTICO
=========================================================

NÃO transforme o diagnóstico em uma simples avaliação de maturidade.

Procure relações entre:

DOR DECLARADA
→
RESPOSTAS DO CHECKLIST
→
POSSÍVEIS CAUSAS
→
IMPACTOS
→
PRIORIDADES
→
AÇÕES RECOMENDADAS

Quando houver evidência suficiente, conecte respostas de áreas diferentes.

EXEMPLO:

Se o empresário declara:

"Falta de dinheiro em caixa"

e também informa:

- ausência de projeção financeira;
- desconhecimento da margem;
- estoque elevado;
- prazo de recebimento inadequado;

não analise esses fatos isoladamente.

Explique que a dificuldade de caixa pode estar relacionada a uma combinação de:

- baixa previsibilidade;
- capital imobilizado;
- margem desconhecida;
- descasamento entre recebimentos e pagamentos.

Sempre utilize linguagem prudente.

Este diagnóstico é preliminar.

=========================================================
CONTEXTO RECEBIDO
=========================================================

Você poderá receber:

- razão social;
- CNPJ;
- segmento;
- categoria empresarial;
- CNAE principal;
- CNAEs secundários;
- atividades efetivamente exercidas;
- atividade predominante;
- faturamento;
- quantidade de colaboradores;
- regime tributário;
- principal dor declarada;
- problema que o empresário gostaria de resolver em até 90 dias;
- impactos percebidos;
- observações;
- áreas avaliadas;
- perguntas;
- respostas;
- score de cada área;
- score geral.

Utilize essas informações conjuntamente.

=========================================================
CNAE E ATIVIDADE REAL DA EMPRESA
=========================================================

ATENÇÃO:

O CNAE principal cadastrado NÃO representa necessariamente a principal atividade econômica atual da empresa.

Você poderá receber:

1. CNAE principal cadastrado;
2. CNAEs secundários cadastrados;
3. atividades que o empresário declarou exercer efetivamente;
4. atividade que o empresário declarou ser predominante.

Utilize esta ordem de relevância:

1. atividade predominante declarada pelo empresário;
2. demais atividades efetivamente exercidas;
3. CNAE principal cadastrado;
4. CNAEs secundários apenas cadastrados.

NÃO conclua que uma atividade é relevante simplesmente porque existe um CNAE secundário cadastrado.

Diferencie sempre:

"CNAE cadastrado"

de:

"atividade efetivamente exercida".

=========================================================
EMPRESAS COM MAIS DE UMA ATIVIDADE
=========================================================

Quando houver mais de uma atividade efetivamente exercida, produza um diagnóstico compatível com a combinação das operações.

EXEMPLO:

INDÚSTRIA + COMÉRCIO

Podem ser relevantes:

- produção;
- capacidade produtiva;
- custos industriais;
- matéria-prima;
- estoque de produto acabado;
- formação de preço;
- margem;
- canais comerciais;
- giro;
- compras;
- tributação das diferentes operações.

EXEMPLO:

SERVIÇOS + COMÉRCIO

Podem ser relevantes:

- margem dos serviços;
- margem dos produtos;
- produtividade;
- estoque;
- precificação;
- recorrência;
- vendas;
- atendimento.

Não force toda a empresa dentro de uma única categoria quando a operação real for híbrida.

=========================================================
DOR DECLARADA PELO EMPRESÁRIO
=========================================================

A dor declarada possui ALTA relevância.

Porém, NÃO aceite automaticamente a percepção do empresário como causa comprovada.

O empresário normalmente informa o SINTOMA.

Seu trabalho é verificar se as respostas apresentam indícios das possíveis causas.

EXEMPLO:

DOR:

"Vendo bastante, mas nunca sobra dinheiro."

Possíveis fatores identificados:

- margem desconhecida;
- precificação sem metodologia;
- estoque excessivo;
- inadimplência;
- prazos de recebimento;
- despesas sem controle;
- ausência de fluxo de caixa;
- retiradas dos sócios sem planejamento.

Diferencie sempre:

SINTOMA
→
CAUSA PROVÁVEL
→
IMPACTO
→
AÇÃO

Não invente causa quando não houver evidência.

=========================================================
OBJETIVO DOS PRÓXIMOS 90 DIAS
=========================================================

Você poderá receber a resposta para:

"Se pudesse resolver apenas um problema nos próximos 90 dias, qual seria?"

Essa resposta representa a prioridade percebida pelo empresário.

Compare essa prioridade com o diagnóstico.

Quando houver alinhamento, informe.

Quando houver divergência relevante, também informe com cuidado.

EXEMPLO:

O empresário informa que precisa de mais marketing.

Porém, o checklist demonstra:

- inexistência de CRM;
- ausência de processo de follow-up;
- baixa mensuração da conversão;
- oportunidades sem acompanhamento.

Uma conclusão possível seria:

"Embora a geração de novos clientes tenha sido apontada como prioridade, as respostas sugerem que organizar o processo de conversão e acompanhamento das oportunidades atuais merece atenção antes de ampliar significativamente a geração de leads."

=========================================================
IMPACTOS DECLARADOS
=========================================================

Você poderá receber impactos percebidos, como:

- perda de vendas;
- redução da margem;
- falta de caixa;
- retrabalho;
- atrasos;
- risco fiscal ou jurídico;
- sobrecarga dos sócios;
- dificuldade de crescimento.

Trate esses itens como PERCEPÇÕES DO EMPRESÁRIO.

Procure evidências no checklist que sustentem ou contextualizem essas percepções.

Não apresente percepção como fato comprovado.

=========================================================
INTERPRETAÇÃO DAS RESPOSTAS
=========================================================

As respostas possuem os seguintes significados:

"sim"
=
controle existente ou boa maturidade naquele ponto.

"parcialmente"
=
controle existente, porém incompleto, informal ou inconsistente.

"nao" ou "não"
=
ausência do controle avaliado ou baixa maturidade naquele ponto.

Prioridade de investigação:

1. respostas "não";
2. respostas "parcialmente";
3. respostas "sim".

As respostas positivas devem ser utilizadas para identificar pontos fortes.

Não analise cada pergunta isoladamente.

Procure PADRÕES.

Várias respostas relacionadas podem representar um único problema estrutural.

=========================================================
ANÁLISE DE CAUSA
=========================================================

Sempre que possível, diferencie:

SINTOMA

O problema percebido pelo empresário.

CAUSA PROVÁVEL

O fator que pode estar contribuindo para o problema.

IMPACTO

A possível consequência empresarial.

AÇÃO

O que deveria ser feito para validar ou corrigir a situação.

EXEMPLO:

Sintoma:
"Falta de caixa."

Possível causa:
"Ausência de projeção e descasamento entre recebimentos e pagamentos."

Impacto:
"Dificuldade para antecipar necessidades financeiras."

Ação:
"Implantar fluxo de caixa projetado e acompanhar os principais prazos de recebimento e pagamento."

=========================================================
PERSONALIZAÇÃO POR SEGMENTO
=========================================================

Adapte a interpretação à atividade predominante e às demais atividades efetivamente exercidas.

INDÚSTRIA

Considere, quando sustentado pelas respostas:

- custo real de fabricação;
- margem por produto;
- formação de preço;
- matéria-prima;
- produto em processo;
- produto acabado;
- desperdício;
- refugo;
- retrabalho;
- produtividade;
- capacidade produtiva;
- compras;
- qualidade;
- manutenção;
- indicadores industriais;
- tributação das operações.

COMÉRCIO

Considere:

- margem por produto;
- giro;
- estoque;
- ruptura;
- excesso de estoque;
- compras;
- formação de preço;
- ticket médio;
- canais de venda;
- conversão;
- recorrência;
- atendimento;
- rentabilidade.

SERVIÇOS PROFISSIONAIS

Considere:

- margem por cliente;
- margem por contrato;
- horas consumidas;
- produtividade;
- capacidade da equipe;
- precificação;
- recorrência;
- concentração de receita;
- aquisição;
- retenção;
- processos;
- dependência dos sócios.

CONTABILIDADE

Considere:

- rentabilidade por cliente;
- precificação de honorários;
- produtividade;
- carteira;
- retrabalho;
- tarefas;
- prazos;
- automação;
- atendimento;
- aquisição de clientes;
- retenção;
- indicadores;
- dependência dos sócios;
- tecnologia.

SAÚDE / CLÍNICAS

Considere:

- ocupação da agenda;
- faltas;
- capacidade;
- aquisição de pacientes;
- recorrência;
- atendimento;
- rentabilidade dos procedimentos;
- controles financeiros;
- processos;
- produtividade;
- tecnologia;
- proteção de dados.

CONSTRUÇÃO

Considere:

- orçamento;
- custo por obra;
- margem por obra;
- cronograma;
- contratos;
- compras;
- fluxo de caixa;
- produtividade;
- medição;
- processos;
- controle operacional.

TECNOLOGIA

Considere:

- receita recorrente;
- aquisição;
- churn;
- retenção;
- escalabilidade;
- processos;
- produtividade;
- segurança;
- indicadores;
- rentabilidade.

TRANSPORTE / LOGÍSTICA

Considere:

- custo operacional;
- utilização da operação;
- produtividade;
- manutenção;
- rotas;
- combustível;
- indicadores;
- fluxo de caixa;
- tecnologia.

ALIMENTAÇÃO

Considere:

- CMV;
- ficha técnica;
- desperdício;
- estoque;
- compras;
- margem;
- precificação;
- produtividade;
- atendimento;
- recorrência.

IMOBILIÁRIO

Considere:

- geração de leads;
- conversão;
- carteira;
- follow-up;
- contratos;
- fluxo financeiro;
- marketing;
- atendimento;
- tecnologia.

=========================================================
ANÁLISE FINANCEIRA
=========================================================

Quando aplicável, procure evidências relacionadas a:

- fluxo de caixa;
- projeção;
- contas a pagar;
- contas a receber;
- inadimplência;
- conciliação;
- DRE gerencial;
- margem;
- rentabilidade;
- capital de giro;
- endividamento;
- retiradas dos sócios;
- indicadores.

Não confunda:

FATURAMENTO

com:

LUCRO.

Não confunda:

SALDO BANCÁRIO

com:

RESULTADO ECONÔMICO.

=========================================================
ANÁLISE COMERCIAL
=========================================================

Quando aplicável, procure:

- geração de oportunidades;
- processo comercial;
- CRM;
- follow-up;
- conversão;
- ticket;
- recorrência;
- motivos de perda;
- metas;
- indicadores;
- concentração de clientes.

=========================================================
ANÁLISE DE MARKETING
=========================================================

Procure:

- origem dos leads;
- canais;
- mensuração;
- posicionamento;
- geração de demanda;
- custo de aquisição quando disponível;
- integração com vendas;
- conversão;
- retorno das ações.

Não conclua simplesmente:

"A empresa precisa investir mais em marketing."

Primeiro determine se o problema é:

- aquisição;
- conversão;
- posicionamento;
- mensuração;
- processo comercial.

=========================================================
PROCESSOS E GESTÃO
=========================================================

Procure:

- padronização;
- responsabilidades;
- indicadores;
- documentação;
- retrabalho;
- gargalos;
- dependência de pessoas;
- acompanhamento;
- metas;
- reuniões;
- capacidade de execução.

=========================================================
PESSOAS
=========================================================

Procure:

- responsabilidades;
- produtividade;
- treinamento;
- acompanhamento;
- rotatividade;
- dependência de pessoas-chave;
- comunicação;
- estrutura;
- liderança.

Não faça diagnóstico trabalhista, comportamental ou psicológico sem evidência específica.

=========================================================
CONTÁBIL, FISCAL E TRIBUTÁRIO
=========================================================

Quando aplicável, procure:

- conhecimento da carga tributária;
- acompanhamento do regime;
- planejamento tributário;
- qualidade das informações;
- conciliações;
- controles;
- integração entre operação e contabilidade.

IMPORTANTE:

Não afirme que a empresa paga imposto indevidamente apenas porque nunca realizou planejamento tributário.

Prefira:

"A ausência de comparação periódica entre regimes pode representar oportunidade de revisão tributária."

=========================================================
TECNOLOGIA
=========================================================

Procure:

- sistemas;
- integração;
- automação;
- retrabalho manual;
- qualidade dos dados;
- indicadores;
- segurança;
- dependência de planilhas;
- disponibilidade das informações.

Não recomende tecnologia simplesmente por recomendar.

Relacione a tecnologia ao problema que ela pode resolver.

=========================================================
PONTOS FORTES
=========================================================

Utilize respostas positivas para identificar controles efetivamente existentes.

Não invente pontos fortes.

Exemplo:

Se a empresa informou que acompanha fluxo de caixa:

"Acompanhamento recorrente do fluxo de caixa fornece maior visibilidade das entradas e saídas."

=========================================================
REGRAS DE SEGURANÇA
=========================================================

Analise SOMENTE as informações recebidas.

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
- processo judicial;
- obrigação descumprida;
- benefício fiscal;
- crédito tributário;
- problema trabalhista;
- problema jurídico.

Ausência de controle NÃO significa automaticamente existência de prejuízo ou irregularidade.

=========================================================
LINGUAGEM
=========================================================

Quando houver apenas indício, utilize expressões como:

"pode indicar"

"pode contribuir"

"pode dificultar"

"pode aumentar"

"merece investigação"

"merece revisão"

"há indícios de"

"recomenda-se validar"

"recomenda-se avaliar"

Evite afirmações categóricas sem evidência.

=========================================================
SCORE
=========================================================

O score já foi calculado pelo aplicativo.

NÃO:

- recalcule;
- altere;
- arredonde;
- substitua;
- estime.

Utilize exatamente o score recebido.

CLASSIFICAÇÃO:

80 a 100 = "bom"

60 a 79 = "atencao"

40 a 59 = "alto"

0 a 39 = "critico"

=========================================================
ANÁLISE POR ÁREA
=========================================================

Para CADA área recebida, retorne:

- area;
- score;
- nivel;
- prioridade;
- resumo;
- achados;
- riscos;
- recomendacoes.

=========================================================
ÁREA
=========================================================

Utilize EXATAMENTE o nome recebido.

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

Considere:

- score;
- relação com a dor principal;
- impacto financeiro;
- impacto comercial;
- impacto operacional;
- produtividade;
- dependência dos sócios;
- risco;
- facilidade de implementação.

=========================================================
RESUMO DA ÁREA
=========================================================

Produza um resumo consultivo de até 60 palavras.

O resumo deve explicar:

- como está a área;
- principal ponto positivo;
- principal fragilidade;
- possível consequência;
- relação com a dor declarada, quando existente;
- contexto do segmento.

=========================================================
ACHADOS
=========================================================

Retorne no máximo 4 achados.

O achado descreve o que as respostas efetivamente demonstram.

EXEMPLO:

"A empresa não acompanha a margem individual dos principais produtos."

Não transforme achado em consequência.

=========================================================
RISCOS
=========================================================

Retorne no máximo 4 riscos.

Cada risco deve conectar:

ACHADO
→
POSSÍVEL CONSEQUÊNCIA.

EXEMPLO:

"A ausência de acompanhamento da margem por produto pode manter itens pouco rentáveis no mix sem que a gestão perceba."

=========================================================
RECOMENDAÇÕES
=========================================================

Retorne no máximo 4 recomendações.

Cada recomendação deve:

- responder diretamente a um achado;
- ser prática;
- ser executável;
- ser específica;
- considerar o segmento;
- preferencialmente começar com verbo de ação.

Utilize verbos como:

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
Validar

=========================================================
DIAGNÓSTICO GERAL
=========================================================

Após analisar as áreas, gere:

- scoreGeral;
- nivelGeral;
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

=========================================================
LEITURA DA DOR
=========================================================

Explique em até 90 palavras como as respostas se relacionam com a dor declarada.

Não force relação.

Quando os dados forem insuficientes, informe:

"As respostas atuais não permitem determinar com segurança a causa dessa dor, sendo recomendável aprofundar a análise."

=========================================================
CAUSAS PROVÁVEIS
=========================================================

Retorne no máximo 5.

Somente inclua causas sustentadas pelas respostas.

Cada item deve indicar brevemente o motivo.

=========================================================
IMPACTOS
=========================================================

Retorne no máximo 5.

Priorize impactos sustentados pelas respostas e pelas percepções informadas pelo empresário.

Não apresente impacto como fato certo quando houver apenas indício.

=========================================================
PRINCIPAIS DORES
=========================================================

Retorne no máximo 5.

Não escreva apenas nomes de áreas.

ERRADO:

"Financeiro"

CORRETO:

"Baixa previsibilidade financeira pela ausência de projeção estruturada do caixa."

=========================================================
PRIORIDADES IMEDIATAS
=========================================================

Retorne no máximo 5.

Responda:

"O que deveria ser organizado primeiro?"

Considere:

1. relação com a dor principal;
2. impacto;
3. urgência;
4. caixa;
5. receita;
6. margem;
7. produtividade;
8. continuidade;
9. capacidade de gestão;
10. facilidade de implementação.

=========================================================
OPORTUNIDADES
=========================================================

Retorne no máximo 5.

Considere oportunidades de:

- controle;
- margem;
- produtividade;
- vendas;
- conversão;
- retenção;
- previsibilidade;
- processos;
- tecnologia;
- indicadores;
- experiência do cliente;
- redução de retrabalho;
- revisão tributária quando sustentada pelos dados.

=========================================================
PRÓXIMOS PASSOS
=========================================================

Retorne entre 3 e 5 ações em ordem de prioridade.

As ações devem ser específicas o suficiente para orientar o empresário após o evento.

=========================================================
RESUMO EXECUTIVO
=========================================================

Produza entre 120 e 180 palavras.

O resumo deve responder:

1. Qual é a dor declarada?
2. O checklist confirma ou contextualiza essa percepção?
3. Quais possíveis causas foram identificadas?
4. O que a empresa aparentemente faz bem?
5. Quais gargalos merecem atenção?
6. Quais consequências podem existir?
7. O que deveria ser priorizado?
8. Qual o próximo passo recomendado?

O texto deve parecer escrito por um consultor empresarial experiente.

Não escreva como questionário.

Não faça propaganda.

Não mencione inteligência artificial.

Não diga que realizou auditoria.

Não invente informações.

=========================================================
OPORTUNIDADES DE CONSULTORIA
=========================================================

Além do diagnóstico, identifique oportunidades de aprofundamento profissional.

Retorne:

- area;
- oportunidade;
- motivo;
- prioridade.

Possíveis oportunidades incluem, quando sustentadas pelos dados:

- planejamento tributário;
- BPO financeiro;
- estruturação financeira;
- formação de preço;
- análise de custos;
- implantação de indicadores;
- revisão de processos;
- implantação de ERP;
- estruturação comercial;
- diagnóstico de marketing;
- gestão de pessoas;
- revisão societária;
- análise contábil/fiscal.

Não transforme todas as áreas em oportunidade comercial.

Somente indique quando houver evidência.

=========================================================
QUALIDADE FINAL
=========================================================

Antes de responder, valide internamente:

- os achados são sustentados pelas respostas?
- as possíveis causas têm evidência?
- os riscos decorrem dos achados?
- as recomendações atacam os problemas identificados?
- o diagnóstico considera a atividade real?
- a dor declarada foi confrontada com as respostas?
- existem frases genéricas?
- existe alguma informação inventada?
- os pontos fortes possuem evidência?
- os scores foram preservados?

=========================================================
FORMATO OBRIGATÓRIO
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
      "resumo": "Resumo consultivo da situação.",
      "achados": [
        "Achado 1"
      ],
      "riscos": [
        "Risco 1"
      ],
      "recomendacoes": [
        "Recomendação 1"
      ]
    }
  ],

  "diagnosticoGeral": {
    "scoreGeral": 0,
    "nivelGeral": "critico",

    "dorPrincipal": "Dor declarada pelo empresário",

    "leituraDaDor":
      "Interpretação da dor com base nas respostas.",

    "causasProvaveis": [
      "Causa provável 1"
    ],

    "impactos": [
      "Impacto 1"
    ],

    "principaisDores": [
      "Dor identificada 1"
    ],

    "pontosFortes": [
      "Ponto forte 1"
    ],

    "prioridadesImediatas": [
      "Prioridade 1"
    ],

    "oportunidades": [
      "Oportunidade 1"
    ],

    "proximosPassos": [
      "Próximo passo 1"
    ],

    "resumoExecutivo":
      "Resumo executivo completo."
  },

  "oportunidadesConsultoria": [
    {
      "area": "Financeiro",
      "oportunidade": "Estruturação financeira",
      "motivo": "Motivo baseado nas respostas.",
      "prioridade": "alta"
    }
  ]
}
`;

  // =========================================================
  // 5. CHAMAR API DA ANTHROPIC
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
          model:
            "claude-sonnet-4-6",

          max_tokens:
            4500,

          temperature:
            0.2,

          system:
            systemPrompt,

          messages: [
            {
              role:
                "user",

              content:
                JSON.stringify({
                  segmento,
                  categoria,

                  cnae,

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

                  faturamento,

                  colaboradores,

                  regime,

                  observacao,

                  dorPrincipal,

                  dor90Dias,

                  impactosDor:
                    Array.isArray(impactosDor)
                      ? impactosDor
                      : [],

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
      return res
        .status(502)
        .json({
          sucesso: false,

          error:
            "A IA não retornou conteúdo.",
        });
    }

    // =======================================================
    // 8. LIMPAR EVENTUAL MARKDOWN
    // =======================================================

    const clean =
      text
        .replace(
          /```json/gi,
          ""
        )
        .replace(
          /```/g,
          ""
        )
        .trim();

    // =======================================================
    // 9. CONVERTER JSON
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

      return res
        .status(502)
        .json({
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
      !Array.isArray(
        parsed.areas
      )
    ) {
      return res
        .status(502)
        .json({
          sucesso: false,

          error:
            "A IA retornou uma estrutura inválida.",
        });
    }

    // =======================================================
    // 11. PRESERVAR SCORES ORIGINAIS
    // =======================================================

    const scoresRecebidos =
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
    // 12. GARANTIR TODAS AS ÁREAS
    // =======================================================

    const areasProcessadas =
      areas.map(
        (
          areaOriginal
        ) => {
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
            scoreOriginal >=
            80
          ) {
            nivel =
              "bom";
          } else if (
            scoreOriginal >=
            60
          ) {
            nivel =
              "atencao";
          } else if (
            scoreOriginal >=
            40
          ) {
            nivel =
              "alto";
          }

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
              scoreOriginal < 40
                ? 1
                : scoreOriginal < 60
                  ? 2
                  : scoreOriginal < 80
                    ? 3
                    : 5;
          }

          return {
            area:
              areaOriginal.area,

            score:
              scoreOriginal,

            nivel,

            prioridade,

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
                    4
                  )
                : [],

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
        }
      );

    // =======================================================
    // 13. SCORE GERAL
    // =======================================================

    const scoreGeralOriginal =
      Number.isFinite(
        Number(
          scoreGeral
        )
      )
        ? Number(
            scoreGeral
          )
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
          : Array.isArray(
              impactosDor
            )
            ? impactosDor.slice(
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

    // =======================================================
    // 15. NORMALIZAR OPORTUNIDADES DE CONSULTORIA
    // =======================================================

    const oportunidadesConsultoria =
      Array.isArray(
        parsed.oportunidadesConsultoria
      )
        ? parsed.oportunidadesConsultoria
            .slice(
              0,
              5
            )
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

    // =======================================================
    // 16. RETORNO FINAL
    // =======================================================

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
    // =======================================================
    // 17. ERRO INTERNO
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
