import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

function texto(valor = "") {
  return String(valor || "")
    .trim();
}

function numero(valor) {
  const n = Number(valor);

  return Number.isFinite(n)
    ? n
    : 0;
}

async function garantirColunas() {
  await sql`
    ALTER TABLE diagnostico_leads
    ADD COLUMN IF NOT EXISTS score_comercial INTEGER NOT NULL DEFAULT 0
  `;

  await sql`
    ALTER TABLE diagnostico_leads
    ADD COLUMN IF NOT EXISTS prioridade_comercial TEXT NOT NULL DEFAULT ''
  `;

  await sql`
    ALTER TABLE diagnostico_leads
    ADD COLUMN IF NOT EXISTS temperatura_comercial TEXT NOT NULL DEFAULT ''
  `;

  await sql`
    ALTER TABLE diagnostico_leads
    ADD COLUMN IF NOT EXISTS proxima_acao TEXT NOT NULL DEFAULT ''
  `;

  await sql`
    ALTER TABLE diagnostico_leads
    ADD COLUMN IF NOT EXISTS prazo_atendimento TEXT NOT NULL DEFAULT ''
  `;

  await sql`
    ALTER TABLE diagnostico_leads
    ADD COLUMN IF NOT EXISTS motivos_prioridade JSONB NOT NULL DEFAULT '[]'::jsonb
  `;
}

function calcularClassificacao({
  scoreDiagnostico = 0,
  nivelDiagnostico = "",
  faturamentoAnual = 0,
  dores = [],
  notaSatisfacao = 0,
  intencao = "",
}) {
  let score = 0;

  const motivos = [];

  const nivel =
    texto(nivelDiagnostico)
      .toUpperCase();

  const intencaoNormalizada =
    texto(intencao)
      .toLowerCase();

  const doresTexto =
    Array.isArray(dores)
      ? dores
          .join(" ")
          .toLowerCase()
      : texto(dores)
          .toLowerCase();

  // =====================================================
  // INTENÇÃO COMERCIAL
  // =====================================================

  if (
    intencaoNormalizada.includes(
      "quanto custaria"
    )
  ) {
    score += 30;

    motivos.push(
      "Cliente demonstrou interesse direto em saber o custo da implementação."
    );
  } else if (
    intencaoNormalizada.includes(
      "como resolver"
    )
  ) {
    score += 20;

    motivos.push(
      "Cliente demonstrou interesse em entender como resolver os problemas identificados."
    );
  } else if (
    intencaoNormalizada.includes(
      "entender melhor"
    )
  ) {
    score += 10;

    motivos.push(
      "Cliente demonstrou interesse em aprofundar o diagnóstico."
    );
  }

  // =====================================================
  // GRAVIDADE DO DIAGNÓSTICO
  // =====================================================

  if (
    nivel === "EMERGENCIAL"
  ) {
    score += 15;

    motivos.push(
      "Diagnóstico empresarial classificado como emergencial."
    );
  } else if (
    nivel === "CRÍTICO" ||
    nivel === "CRITICO"
  ) {
    score += 10;

    motivos.push(
      "Diagnóstico empresarial classificado como crítico."
    );
  } else if (
    numero(scoreDiagnostico) < 40
  ) {
    score += 15;

    motivos.push(
      "Score empresarial inferior a 40 pontos."
    );
  } else if (
    numero(scoreDiagnostico) < 60
  ) {
    score += 10;

    motivos.push(
      "Score empresarial indica fragilidades relevantes."
    );
  }

  // =====================================================
  // FATURAMENTO
  // =====================================================

  const faturamento =
    numero(
      faturamentoAnual
    );

  if (
    faturamento >=
    4800000
  ) {
    score += 20;

    motivos.push(
      "Empresa possui faturamento anual elevado."
    );
  } else if (
    faturamento >=
    1500000
  ) {
    score += 15;

    motivos.push(
      "Empresa possui faturamento relevante para atendimento consultivo."
    );
  } else if (
    faturamento >=
    600000
  ) {
    score += 10;

    motivos.push(
      "Empresa possui porte compatível com potencial consultivo."
    );
  } else if (
    faturamento >=
    360000
  ) {
    score += 5;
  }

  // =====================================================
  // DORES COM IMPACTO FINANCEIRO / COMERCIAL
  // =====================================================

  const termosPrioritarios = [
    "falta de dinheiro",
    "caixa",
    "inadimpl",
    "tribut",
    "imposto",
    "margem",
    "preço",
    "preco",
    "vendas",
    "financeiro",
    "lucro",
    "rentabilidade",
    "retrabalho",
  ];

  const possuiDorPrioritaria =
    termosPrioritarios.some(
      (termo) =>
        doresTexto.includes(
          termo
        )
    );

  if (
    possuiDorPrioritaria
  ) {
    score += 10;

    motivos.push(
      "Foram identificadas dores com potencial impacto financeiro, tributário ou comercial."
    );
  }

  // =====================================================
  // SATISFAÇÃO
  // =====================================================

  const nota =
    numero(
      notaSatisfacao
    );

  if (
    nota === 5
  ) {
    score += 5;

    motivos.push(
      "Cliente avaliou o diagnóstico com nota máxima."
    );
  } else if (
    nota === 4
  ) {
    score += 3;
  }

  // =====================================================
  // LIMITA SCORE
  // =====================================================

  score =
    Math.max(
      0,
      Math.min(
        100,
        score
      )
    );

  // =====================================================
  // PRIORIDADE
  // =====================================================

  let prioridade;
  let temperatura;
  let prazoAtendimento;
  let proximaAcao;

  if (
    score >= 80
  ) {
    prioridade = "A";

    temperatura =
      "MUITO_ALTA";

    prazoAtendimento =
      "2_HORAS";

    proximaAcao =
      "CONTATO_COMERCIAL";
  } else if (
    score >= 60
  ) {
    prioridade = "B";

    temperatura =
      "ALTA";

    prazoAtendimento =
      "24_HORAS";

    proximaAcao =
      "AGENDAR_REUNIAO";
  } else if (
    score >= 40
  ) {
    prioridade = "C";

    temperatura =
      "MEDIA";

    prazoAtendimento =
      "3_DIAS";

    proximaAcao =
      "FOLLOW_UP_CONSULTIVO";
  } else {
    prioridade = "D";

    temperatura =
      "BAIXA";

    prazoAtendimento =
      "NUTRICAO";

    proximaAcao =
      "NUTRICAO";
  }

  return {
    scoreComercial:
      score,

    prioridade,

    temperatura,

    prazoAtendimento,

    proximaAcao,

    motivos,
  };
}

export default async function handler(
  req,
  res
) {
  if (
    req.method !== "POST"
  ) {
    res.setHeader(
      "Allow",
      "POST"
    );

    return res
      .status(405)
      .json({
        sucesso: false,

        error:
          "Método não permitido.",
      });
  }

  try {
    if (
      !process.env.DATABASE_URL
    ) {
      return res
        .status(500)
        .json({
          sucesso: false,

          error:
            "DATABASE_URL não configurada.",
        });
    }

    await garantirColunas();

    const body =
      req.body ||
      {};

    const leadId =
      texto(
        body.leadId
      );

    const sessionId =
      texto(
        body.sessionId
      );

    if (
      !leadId &&
      !sessionId
    ) {
      return res
        .status(400)
        .json({
          sucesso: false,

          error:
            "leadId ou sessionId é obrigatório.",
        });
    }

    // =====================================================
    // LOCALIZA LEAD
    // =====================================================

    const linhas =
      leadId
        ? await sql`
            SELECT *
            FROM diagnostico_leads
            WHERE id =
              ${leadId}
            LIMIT 1
          `
        : await sql`
            SELECT *
            FROM diagnostico_leads
            WHERE session_id =
              ${sessionId}
            LIMIT 1
          `;

    const lead =
      linhas?.[0];

    if (
      !lead
    ) {
      return res
        .status(404)
        .json({
          sucesso: false,

          error:
            "Lead não encontrado.",
        });
    }

    // =====================================================
    // DADOS RECEBIDOS DO DIAGNÓSTICO
    // =====================================================

    const classificacao =
      calcularClassificacao({
        scoreDiagnostico:
          body.scoreDiagnostico,

        nivelDiagnostico:
          body.nivelDiagnostico,

        faturamentoAnual:
          body.faturamentoAnual,

        dores:
          body.dores,

        notaSatisfacao:
          body.notaSatisfacao ??
          lead.nota_satisfacao,

        intencao:
          body.intencao ??
          lead.intencao,
      });

    // =====================================================
    // ATUALIZA LEAD
    // =====================================================

    await sql`
      UPDATE diagnostico_leads

      SET
        score_comercial =
          ${classificacao.scoreComercial},

        prioridade_comercial =
          ${classificacao.prioridade},

        temperatura_comercial =
          ${classificacao.temperatura},

        proxima_acao =
          ${classificacao.proximaAcao},

        prazo_atendimento =
          ${classificacao.prazoAtendimento},

        motivos_prioridade =
          ${JSON.stringify(
            classificacao.motivos
          )}::jsonb,

        updated_at =
          NOW()

      WHERE id =
        ${lead.id}
    `;

    // =====================================================
    // RETORNO
    // =====================================================

    return res
      .status(200)
      .json({
        sucesso: true,

        leadId:
          lead.id,

        scoreComercial:
          classificacao.scoreComercial,

        prioridade:
          classificacao.prioridade,

        temperatura:
          classificacao.temperatura,

        prazoAtendimento:
          classificacao.prazoAtendimento,

        proximaAcao:
          classificacao.proximaAcao,

        motivos:
          classificacao.motivos,
      });

  } catch (error) {
    console.error(
      "[classificar-lead]",
      error
    );

    return res
      .status(500)
      .json({
        sucesso: false,

        error:
          "Não foi possível classificar o lead.",
      });
  }
}
