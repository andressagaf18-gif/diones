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

  // As áreas escolhidas pelo participante passam a ser PRIORIDADES.
  // Elas não limitam o escopo do diagnóstico.
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

  // O relatório completo sempre cobre todos os eixos do motor.
  const eixosDoMotor =
    motor.eixos || [];

  const eixosParaPerguntas =
    eixosDoMotor;

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

  // Se não houver chave de IA, as trilhas que possuem catálogo local
  // continuam funcionando em vez de travar o diagnóstico.
  if (!process.env.OPENAI_API_KEY) {
    return res.status(200).json({
      sucesso: true,
      estrutura,
      fallback: true,
      interpretacaoNegocio: null,
      perguntas: fallback,
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
Gerar perguntas aprofundadas e altamente específicas para a estrutura escolhida.

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
- TODOS os eixos obrigatórios precisam ter cobertura.
- Para eixo NÃO prioritário: gere 1 a 2 perguntas essenciais.
- Para eixo PRIORITÁRIO: gere 3 a 5 perguntas de aprofundamento.
- As prioridades aumentam a profundidade; não excluem os demais eixos.
- Não faça perguntas que já estejam respondidas claramente no contexto.
- As perguntas precisam descobrir causa, impacto, risco e capacidade de ação.
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
  "interpretacaoNegocio": {
    "estrutura": "${estrutura}",
    "resumo": "resumo curto e específico da estrutura",
    "pontosParaInvestigar": []
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
        interpretacaoNegocio: null,
        perguntas: fallback,
      });
    }

    const bruto =
      extrairOutputText(data);

    if (!bruto) {
      return res.status(200).json({
        sucesso: true,
        estrutura,
        fallback: true,
        interpretacaoNegocio: null,
        perguntas: fallback,
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
        interpretacaoNegocio: null,
        perguntas: fallback,
      });
    }

    const perguntasIA =
      lista(resultado?.perguntas)
        .map(normalizarPergunta)
        .filter(
          (q) =>
            q.pergunta &&
            q.areaId
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
      fallback.filter(
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

    return res.status(200).json({
      sucesso: true,
      estrutura,
      fallback:
        !coberturaCompleta ||
        perguntasIA.length < minimo,

      prioridadesSelecionadas,
      eixosCobertos:
        eixosParaPerguntas,

      interpretacaoNegocio:
        resultado?.interpretacaoNegocio ||
        null,

      perguntas,

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
      interpretacaoNegocio: null,
      perguntas: fallback,
    });
  }
}
