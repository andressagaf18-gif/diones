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

  const eixosSelecionados =
    areasSelecionadas
      .map(
        (item) =>
          texto(
            item?.id ||
            item
          )
      )
      .filter(Boolean);

  // Para estruturas especializadas, se os IDs selecionados vierem
  // do frontend antigo e não coincidirem com o motor, usamos os
  // eixos obrigatórios da própria estrutura.
  const eixosDoMotor =
    motor.eixos || [];

  const eixosParaPerguntas =
    estrutura === "pessoa_fisica" ||
    estrutura === "avaliar_holding"
      ? eixosDoMotor
      : (
          eixosSelecionados.length
            ? eixosSelecionados
            : eixosDoMotor
        );

  const fallback =
    perguntasBaseDaEstrutura(
      estrutura,
      eixosParaPerguntas
    );

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

EIXOS A INVESTIGAR:
${eixosParaPerguntas.join(", ")}

DORES DECLARADAS:
${JSON.stringify(dores)}

IMPACTOS DECLARADOS:
${JSON.stringify(impactos)}

PRIORIDADE / OBJETIVO:
${objetivo90Dias || "Não informado"}

CONTEXTO COMPLETO:
${JSON.stringify(body)}

REGRAS:
- Gere de 2 a 5 perguntas por eixo relevante.
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

    const minimo =
      Math.max(
        8,
        eixosParaPerguntas.length * 2
      );

    const perguntas =
      perguntasIA.length >= minimo
        ? perguntasIA
        : [
            ...perguntasIA,
            ...complementares,
          ].slice(
            0,
            Math.max(
              minimo,
              30
            )
          );

    return res.status(200).json({
      sucesso: true,
      estrutura,
      fallback:
        perguntasIA.length < minimo,

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
