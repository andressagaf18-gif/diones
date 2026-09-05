// api/gerar-perguntas.js
// Finder — geração de perguntas v2 por estrutura.

import {
  obterMotor,
  normalizarEstrutura,
  instrucoesDoMotor,
} from "./lib/diagnostic-engine.js";

import {
  perguntasBaseDaEstrutura,
} from "./lib/question-engine.js";

function lista(v) {
  return Array.isArray(v) ? v : [];
}

function texto(v) {
  return String(v || "").trim();
}

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

function limparJson(valor) {
  return String(valor || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}


function primeiraEmpresa(body) {
  return lista(body?.empresas)[0] || {};
}

function descricaoAtividadeBase(body) {
  const empresa =
    primeiraEmpresa(body);

  return texto(
    empresa?.cnaePrincipal?.descricao ||
    empresa?.segmento ||
    empresa?.categoria
  );
}

function interpretacaoFallback(
  body,
  motor
) {
  const empresa =
    primeiraEmpresa(body);

  const descricao =
    texto(
      body?.descricaoNegocio
    );

  const atividadeBase =
    descricaoAtividadeBase(body);

  const segmento =
    texto(
      empresa?.segmento ||
      empresa?.categoria ||
      motor?.label ||
      "Empresa operacional"
    );

  const subsegmento =
    descricao ||
    atividadeBase ||
    segmento;

  const justificativaPartes =
    [
      atividadeBase
        ? `Atividade-base: ${atividadeBase}.`
        : "",
      descricao
        ? `Descrição informada: ${descricao}.`
        : "",
    ].filter(Boolean);

  return {
    segmento,
    subsegmento,

    modeloOperacional:
      descricao
        ? `Operação interpretada a partir da descrição "${descricao}".`
        : atividadeBase
        ? `Operação compatível com a atividade-base "${atividadeBase}".`
        : "Operação a confirmar durante o diagnóstico.",

    justificativa:
      justificativaPartes.join(
        " "
      ) ||
      "Interpretação preliminar baseada nos dados informados.",

    riscosNaturais: [],
  };
}

function normalizarInterpretacao(
  resultado,
  body,
  motor
) {
  const recebido =
    resultado?.negocioInterpretado ||
    resultado?.interpretacaoNegocio ||
    null;

  const fallback =
    interpretacaoFallback(
      body,
      motor
    );

  if (
    !recebido ||
    typeof recebido !==
      "object"
  ) {
    return fallback;
  }

  return {
    segmento:
      texto(
        recebido.segmento
      ) ||
      fallback.segmento,

    subsegmento:
      texto(
        recebido.subsegmento
      ) ||
      texto(
        recebido.resumo
      ) ||
      fallback.subsegmento,

    modeloOperacional:
      texto(
        recebido.modeloOperacional
      ) ||
      texto(
        recebido.modelo
      ) ||
      fallback.modeloOperacional,

    justificativa:
      texto(
        recebido.justificativa
      ) ||
      texto(
        recebido.resumo
      ) ||
      fallback.justificativa,

    riscosNaturais:
      lista(
        recebido.riscosNaturais ||
        recebido.pontosParaInvestigar
      )
        .map(texto)
        .filter(Boolean),
  };
}

function perguntaCompativelComEscala(
  pergunta
) {
  const valor =
    texto(pergunta)
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      );

  if (!valor) {
    return false;
  }

  // A escala de cinco respostas funciona melhor para uma única
  // prática, controle ou condição verificável.
  const marcadoresAbertos = [
    "quais ",
    "qual ",
    "como ",
    "por que ",
    "porque ",
    "descreva",
    "explique",
    "informe",
    "forneca",
    "detalhe",
    "liste",
    "cite ",
    "envie",
    "se sim",
    "se nao",
    "quanto ",
    "quando ",
  ];

  if (
    marcadoresAbertos.some(
      (marcador) =>
        valor.includes(
          marcador
        )
    )
  ) {
    return false;
  }

  // Rejeita alternativas embutidas que obrigariam o usuário a responder
  // algo diferente da escala da interface.
  if (/\bou\s+(?:tudo|apenas|somente|qual|quais|é|são|fica|ficam)\b/.test(valor)) {
    return false;
  }

  const interrogacoes =
    (
      texto(pergunta).match(
        /\?/g
      ) ||
      []
    ).length;

  if (
    interrogacoes >
    1
  ) {
    return false;
  }

  // Evita perguntas "duplas" muito longas que misturam vários
  // critérios e ficam impossíveis de responder com uma escala única.
  if (
    valor.length >
      240
  ) {
    return false;
  }

  return true;
}

async function repararPerguntasAbertas({
  perguntas,
  estrutura,
  eixosParaPerguntas,
}) {
  if (
    !perguntas.length ||
    !process.env
      .OPENAI_API_KEY
  ) {
    return perguntas;
  }

  const invalidas =
    perguntas.filter(
      (q) =>
        !perguntaCompativelComEscala(
          q.pergunta
        )
    );

  if (!invalidas.length) {
    return perguntas;
  }

  const promptReparo = `
Você revisa perguntas de diagnóstico empresarial.

A interface permite SOMENTE estas respostas:
- Sim
- Parcial
- Não
- Não sei
- N/A

REESCREVA as perguntas abaixo para que cada uma avalie UMA ÚNICA prática, controle ou condição objetiva.

REGRAS OBRIGATÓRIAS:
- As cinco respostas devem fazer sentido: Sim = implantado; Parcial = incompleto ou irregular; Não = inexistente; Não sei = ausência de conhecimento; N/A = legitimamente não aplicável.
- NÃO use: "quais", "qual", "como", "descreva", "explique", "informe", "forneça", "detalhe", "liste", "cite", "envie".
- NÃO peça números, nomes de sistemas, documentos ou exemplos.
- NÃO coloque duas perguntas no mesmo item.
- NÃO use "se sim..." ou "se não...".
- Preserve o mesmo id e areaId.
- Preserve o assunto e a intenção diagnóstica.
- Retorne SOMENTE JSON válido.

ESTRUTURA:
${estrutura}

EIXOS PERMITIDOS:
${eixosParaPerguntas.join(", ")}

PERGUNTAS A REESCREVER:
${JSON.stringify(invalidas)}

FORMATO:
{
  "perguntas": [
    {
      "id": "mesmo id",
      "areaId": "mesmo areaId",
      "area": "nome da área",
      "tema": "tema",
      "pergunta": "pergunta fechada",
      "riscoAvaliado": "risco",
      "motivo": "motivo",
      "importancia": 1
    }
  ]
}
`;

  try {
    const resposta =
      await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            model:
              process.env.OPENAI_MODEL ||
              "gpt-5-mini",

            input:
              promptReparo,

            text: {
              format: {
                type:
                  "json_object",
              },
            },
          }),
        }
      );

    const data =
      await resposta.json();

    if (!resposta.ok) {
      return perguntas;
    }

    const bruto =
      extrairOutputText(
        data
      );

    if (!bruto) {
      return perguntas;
    }

    const resultado =
      JSON.parse(
        limparJson(bruto)
      );

    const reparadas =
      lista(
        resultado?.perguntas
      )
        .map(
          normalizarPergunta
        )
        .filter(
          (q) =>
            q.pergunta &&
            q.areaId &&
            perguntaCompativelComEscala(
              q.pergunta
            )
        );

    const porId =
      new Map(
        reparadas.map(
          (q) => [
            q.id,
            q,
          ]
        )
      );

    return perguntas.map(
      (q) =>
        porId.get(q.id) ||
        q
    );
  } catch (error) {
    console.error(
      "[gerar-perguntas] reparo:",
      error
    );

    return perguntas;
  }
}

function normalizarPergunta(q, idx) {
  return {
    id:
      texto(q?.id) ||
      `ia_${idx + 1}`,

    areaId:
      texto(q?.areaId),

    area:
      texto(q?.area),

    tema:
      texto(q?.tema) ||
      "Diagnóstico específico",

    pergunta:
      texto(
        q?.pergunta ||
        q?.text
      ),

    riscoAvaliado:
      texto(
        q?.riscoAvaliado ||
        q?.risco
      ) ||
      "Ponto relevante para aprofundamento",

    motivo:
      texto(q?.motivo),

    importancia:
      Math.max(
        1,
        Math.min(
          3,
          Number(q?.importancia || 1)
        )
      ),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  const body =
    req.body || {};

  const estrutura =
    normalizarEstrutura(
      body.estruturaNegocio ||
      body?.contextoEstrutura?.estruturaNegocio
    );

  const motor =
    obterMotor(estrutura);

  const areasSelecionadas =
    lista(body.areasSelecionadas);

  const prioridadesSelecionadas =
    areasSelecionadas
      .map(
        (item) =>
          texto(
            item?.id ||
            item
          )
      )
      .filter(Boolean);

  const eixosDoMotor =
    motor.eixos || [];

  // REGRA DE ESCOPO:
  // Empresa operacional deve perguntar SOMENTE os departamentos
  // que o participante selecionou.
  //
  // Para estruturas especializadas (grupo, SPE, holding,
  // avaliação de holding e PF), preservamos a cobertura estrutural
  // integral do motor.
  const eixosSelecionadosValidos =
    prioridadesSelecionadas.filter(
      (id) =>
        eixosDoMotor.includes(
          id
        )
    );

  const eixosParaPerguntas =
    estrutura ===
      "operacional" &&
    eixosSelecionadosValidos.length >
      0
      ? eixosSelecionadosValidos
      : eixosDoMotor;

  const fallbackCompleto =
    perguntasBaseDaEstrutura(
      estrutura,
      eixosParaPerguntas
    );

  // Eixos comuns: até 2 perguntas essenciais.
  // Eixos prioritários: até 5 perguntas de aprofundamento.
  const fallback = [];

  for (const eixoId of eixosParaPerguntas) {
    const perguntasEixo =
      fallbackCompleto.filter(
        (q) =>
          q.areaId === eixoId
      );

    const limite =
      prioridadesSelecionadas.includes(
        eixoId
      )
        ? 5
        : 2;

    fallback.push(
      ...perguntasEixo.slice(
        0,
        limite
      )
    );
  }

  // Esta rota nunca deve devolver perguntas abertas para uma
  // interface cuja resposta é somente a escala fechada de cinco opções.
  const fallbackFechado =
    fallback.filter(
      (q) =>
        perguntaCompativelComEscala(
          q.pergunta
        )
    );

  // Se não houver chave de IA, as trilhas que possuem catálogo local
  // continuam funcionando em vez de travar o diagnóstico.
  if (!process.env.OPENAI_API_KEY) {
    return res.status(200).json({
      sucesso: true,
      estrutura,
      fallback: true,
      negocioInterpretado:
        interpretacaoFallback(
          body,
          motor
        ),
      interpretacaoNegocio:
        interpretacaoFallback(
          body,
          motor
        ),
      perguntas: fallbackFechado,
    });
  }

  const dores =
    lista(body.doresSelecionadas);

  const impactos =
    lista(body.impactosDor);

  const objetivo90Dias =
    texto(
      body.dor90Dias ||
      body.objetivoPrioritario
    );

  const prompt = `
Você é o motor de perguntas diagnósticas da Finder of Solutions.

${instrucoesDoMotor(estrutura)}

OBJETIVO:
Gerar perguntas específicas para a estrutura escolhida, mas TODAS precisam ser respondíveis exclusivamente pela escala "Sim / Parcial / Não / Não sei / N/A".

ESTRUTURA:
${motor.label}

EIXOS OBRIGATÓRIOS A INVESTIGAR:
${eixosParaPerguntas.join(", ")}

PRIORIDADES DE APROFUNDAMENTO:
${prioridadesSelecionadas.length ? prioridadesSelecionadas.join(", ") : "Nenhuma prioridade específica informada"}

DORES DECLARADAS:
${JSON.stringify(dores)}

IMPACTOS DECLARADOS:
${JSON.stringify(impactos)}

PRIORIDADE / OBJETIVO:
${objetivo90Dias || "Não informado"}

CONTEXTO COMPLETO:
${JSON.stringify(body)}

REGRAS:
- Gere perguntas SOMENTE para os eixos listados em "EIXOS OBRIGATÓRIOS A INVESTIGAR".
- Na EMPRESA OPERACIONAL, esses eixos correspondem exatamente aos departamentos escolhidos pelo usuário; NÃO inclua departamentos não selecionados.
- Para eixo NÃO prioritário: gere 1 a 2 perguntas essenciais.
- Para eixo PRIORITÁRIO: gere 3 a 5 perguntas de aprofundamento.
- Nas estruturas especializadas, os eixos obrigatórios podem representar a cobertura estrutural completa definida pelo motor.
- Não faça perguntas que já estejam respondidas claramente no contexto.
- CADA ITEM deve avaliar UMA ÚNICA prática, controle ou condição verificável.
- As cinco respostas precisam ser coerentes: Sim = implantado e utilizado; Parcial = incompleto, informal ou irregular; Não = inexistente; Não sei = falta de conhecimento ou evidência; N/A = legitimamente não aplicável.
- Não crie alternativas dentro da pergunta, como "usa sistema ou controle manual?".
- Não reúna existência, frequência, qualidade e utilização na mesma pergunta.
- Separe conciliação bancária financeira de conciliação entre financeiro e contabilidade.
- Para Terceiro Setor, nunca trate despesa como receita e nunca presuma imunidade ou isenção.
- NÃO use perguntas abertas como "quais", "qual", "como", "por quê", "descreva", "explique", "informe", "forneça", "detalhe", "liste", "cite" ou "envie".
- NÃO peça nomes de sistemas, valores, documentos, exemplos ou justificativas no checklist.
- NÃO use "Se sim..." nem faça uma segunda pergunta dentro do mesmo item.
- Transforme aprofundamentos em afirmações verificáveis. Exemplo: em vez de "Quais sistemas são usados e quais integrações existem?", use "Os sistemas utilizados na operação estão integrados de forma suficiente para evitar retrabalho?".
- As perguntas devem detectar maturidade, risco, causa provável e capacidade de ação por meio da escala.
- Pessoa Física: não mencionar CNAE, faturamento empresarial, margem,
  sócios ou estrutura societária, salvo se o participante declarar empresa própria.
- Avaliação de Holding: não presumir que a holding existe ou é vantajosa.
- Holding existente: priorizar patrimônio, participações, imóveis,
  receitas, sucessão, governança e tributação patrimonial.
- Grupo empresarial: priorizar relações entre empresas, governança,
  intercompany, consolidação e riscos.
- SPE: priorizar projeto, sócios, aportes, contratos, tributação,
  governança e encerramento.
- Empresa operacional: usar segmento, CNAE, atividade real e dores.
- Não invente fatos.
- Retorne SOMENTE JSON válido.

FORMATO:
{
  "negocioInterpretado": {
    "segmento": "segmento identificado",
    "subsegmento": "atividade real interpretada em linguagem simples",
    "modeloOperacional": "como esse negócio normalmente opera, em uma frase",
    "justificativa": "por que esta interpretação faz sentido com CNAE e descrição informada",
    "riscosNaturais": ["ponto natural para investigar"]
  },
  "perguntas": [
    {
      "id": "string",
      "areaId": "id_do_eixo",
      "area": "nome do eixo",
      "tema": "tema",
      "pergunta": "texto da pergunta",
      "riscoAvaliado": "risco que esta pergunta investiga",
      "motivo": "por que esta pergunta importa",
      "importancia": 1
    }
  ]
}
`;

  try {
    const resposta =
      await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            model:
              process.env.OPENAI_MODEL ||
              "gpt-5-mini",

            input:
              prompt,

            text: {
              format: {
                type: "json_object",
              },
            },
          }),
        }
      );

    const data =
      await resposta.json();

    if (!resposta.ok) {
      console.error(
        "[gerar-perguntas-v2] OpenAI:",
        data
      );

      return res.status(200).json({
        sucesso: true,
        estrutura,
        fallback: true,
        negocioInterpretado:
          interpretacaoFallback(
            body,
            motor
          ),
        interpretacaoNegocio:
          interpretacaoFallback(
            body,
            motor
          ),
        perguntas: fallbackFechado,
      });
    }

    const bruto =
      extrairOutputText(data);

    if (!bruto) {
      return res.status(200).json({
        sucesso: true,
        estrutura,
        fallback: true,
        negocioInterpretado:
          interpretacaoFallback(
            body,
            motor
          ),
        interpretacaoNegocio:
          interpretacaoFallback(
            body,
            motor
          ),
        perguntas: fallbackFechado,
      });
    }

    let resultado;

    try {
      resultado =
        JSON.parse(
          limparJson(bruto)
        );
    } catch (error) {
      console.error(
        "[gerar-perguntas-v2] JSON inválido:",
        bruto
      );

      return res.status(200).json({
        sucesso: true,
        estrutura,
        fallback: true,
        negocioInterpretado:
          interpretacaoFallback(
            body,
            motor
          ),
        interpretacaoNegocio:
          interpretacaoFallback(
            body,
            motor
          ),
        perguntas: fallbackFechado,
      });
    }

    let perguntasIA =
      lista(resultado?.perguntas)
        .map(normalizarPergunta)
        .filter(
          (q) =>
            q.pergunta &&
            q.areaId &&
            eixosParaPerguntas.includes(
              q.areaId
            )
        );

    perguntasIA =
      await repararPerguntasAbertas({
        perguntas:
          perguntasIA,
        estrutura,
        eixosParaPerguntas,
      });

    // Qualquer pergunta que continue incompatível com
    // "Sim / Parcial / Não" é descartada e será substituída
    // pelo catálogo local fechado.
    perguntasIA =
      perguntasIA.filter(
        (q) =>
          perguntaCompativelComEscala(
            q.pergunta
          )
      );

    // Se a IA devolver poucas perguntas, complementa com o catálogo
    // local em vez de aceitar um diagnóstico raso.
    const idsIA =
      new Set(
        perguntasIA.map(
          (q) => q.id
        )
      );

    const complementares =
      fallbackFechado.filter(
        (q) =>
          !idsIA.has(q.id)
      );

    const eixosCobertosIA =
      new Set(
        perguntasIA
          .map(
            (q) => q.areaId
          )
          .filter(Boolean)
      );

    const coberturaCompleta =
      eixosParaPerguntas.every(
        (id) =>
          eixosCobertosIA.has(id)
      );

    const minimo =
      eixosParaPerguntas.length +
      prioridadesSelecionadas.length * 2;

    let perguntas =
      coberturaCompleta &&
      perguntasIA.length >= minimo
        ? perguntasIA
        : [
            ...perguntasIA,
            ...complementares,
          ];

    // Remove duplicidades.
    const vistos =
      new Set();

    perguntas =
      perguntas.filter(
        (q) => {
          const chave =
            q.id ||
            `${q.areaId}:${q.pergunta}`;

          if (
            vistos.has(chave)
          ) {
            return false;
          }

          vistos.add(chave);
          return true;
        }
      );

    // Controla o tamanho do questionário por eixo.
    const porEixo =
      {};

    perguntas =
      perguntas.filter(
        (q) => {
          const id =
            q.areaId;

          porEixo[id] =
            (porEixo[id] || 0) + 1;

          const limite =
            prioridadesSelecionadas.includes(
              id
            )
              ? 5
              : 2;

          return (
            porEixo[id] <=
            limite
          );
        }
      );

    const perguntasFinais =
      perguntas.filter(
        (q) =>
          perguntaCompativelComEscala(
            q.pergunta
          )
      );

    return res.status(200).json({
      sucesso: true,
      estrutura,
      fallback:
        !coberturaCompleta ||
        perguntasIA.length < minimo,

      prioridadesSelecionadas,
      eixosCobertos:
        eixosParaPerguntas,

      negocioInterpretado:
        normalizarInterpretacao(
          resultado,
          body,
          motor
        ),

      interpretacaoNegocio:
        normalizarInterpretacao(
          resultado,
          body,
          motor
        ),

      perguntas:
        perguntasFinais,

      uso:
        data?.usage ||
        null,
    });
  } catch (error) {
    console.error(
      "[gerar-perguntas-v2]",
      error
    );

    return res.status(200).json({
      sucesso: true,
      estrutura,
      fallback: true,
      negocioInterpretado:
        interpretacaoFallback(
          body,
          motor
        ),
      interpretacaoNegocio:
        interpretacaoFallback(
          body,
          motor
        ),
      perguntas: fallbackFechado,
    });
  }
}
