import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

function autorizado(req) {
  const adminToken =
    process.env.ADMIN_TOKEN ||
    process.env.ADMIN_PASSWORD ||
    "";

  if (!adminToken) {
    return true;
  }

  const authorization =
    req.headers?.authorization || "";

  const bearer =
    authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

  const tokenQuery =
    req.query?.token || "";

  return (
    bearer === adminToken ||
    tokenQuery === adminToken
  );
}

function normalizarTexto(valor, limite = 180) {
  if (valor === null || valor === undefined) return "";
  return String(valor).trim().slice(0, limite);
}

function numeroSeguro(valor, padrao = 50, maximo = 200) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return padrao;
  }

  return Math.max(
    1,
    Math.min(
      maximo,
      Math.round(numero)
    )
  );
}

async function garantirTabela() {
  await sql`
    CREATE TABLE IF NOT EXISTS diagnostico_leads (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE,

      origem TEXT NOT NULL DEFAULT 'direto',
      campanha TEXT NOT NULL DEFAULT '',
      promoter TEXT NOT NULL DEFAULT '',

      utm_source TEXT NOT NULL DEFAULT '',
      utm_medium TEXT NOT NULL DEFAULT '',
      utm_campaign TEXT NOT NULL DEFAULT '',
      utm_content TEXT NOT NULL DEFAULT '',
      utm_term TEXT NOT NULL DEFAULT '',

      referrer TEXT NOT NULL DEFAULT '',

      status_diagnostico TEXT NOT NULL DEFAULT 'ACESSOU',
      status_comercial TEXT NOT NULL DEFAULT 'NOVO_LEAD',

      nome TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      telefone TEXT NOT NULL DEFAULT '',
      cnpj TEXT NOT NULL DEFAULT '',
      razao_social TEXT NOT NULL DEFAULT '',

      etapa_atual TEXT NOT NULL DEFAULT 'INTRO',
      progresso_percentual INTEGER NOT NULL DEFAULT 0,

      diagnostico_id TEXT NOT NULL DEFAULT '',
      nota_satisfacao INTEGER,
      intencao TEXT NOT NULL DEFAULT '',

      responsavel_finder TEXT NOT NULL DEFAULT '',

      score_comercial INTEGER NOT NULL DEFAULT 0,
      prioridade_comercial TEXT NOT NULL DEFAULT '',
      temperatura_comercial TEXT NOT NULL DEFAULT '',
      proxima_acao TEXT NOT NULL DEFAULT '',
      prazo_atendimento TEXT NOT NULL DEFAULT '',
      motivos_prioridade JSONB NOT NULL DEFAULT '[]'::jsonb,

      primeiro_acesso TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ultima_atividade TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_diagnostico_leads_status_diag
    ON diagnostico_leads (status_diagnostico)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_diagnostico_leads_status_comercial
    ON diagnostico_leads (status_comercial)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_diagnostico_leads_origem
    ON diagnostico_leads (origem)
  `;

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

  await sql`
    CREATE INDEX IF NOT EXISTS idx_diagnostico_leads_updated_at
    ON diagnostico_leads (updated_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_diagnostico_leads_prioridade
    ON diagnostico_leads (prioridade_comercial)
  `;
}

function temperaturaLead(lead) {
  const nota =
    Number(
      lead.nota_satisfacao
    ) || 0;

  const intencao =
    String(
      lead.intencao || ""
    );

  if (
    intencao ===
    "Quero saber quanto custaria implementar as melhorias"
  ) {
    return "MUITO_ALTA";
  }

  if (
    intencao ===
    "Quero saber como resolver"
  ) {
    return "ALTA";
  }

  if (
    lead.status_diagnostico ===
    "CONCLUIDO" &&
    nota >= 4
  ) {
    return "ALTA";
  }

  if (
    lead.status_diagnostico ===
    "CONCLUIDO"
  ) {
    return "MEDIA";
  }

  if (
    lead.status_diagnostico ===
    "EM_PREENCHIMENTO"
  ) {
    return "MEDIA";
  }

  return "BAIXA";
}

function mapearLead(lead) {
  return {
    leadId:
      lead.id,

    sessionId:
      lead.session_id,

    origem:
      lead.origem,

    campanha:
      lead.campanha,

    promoter:
      lead.promoter,

    statusDiagnostico:
      lead.status_diagnostico,

    statusComercial:
      lead.status_comercial,

    nome:
      lead.nome,

    email:
      lead.email,

    telefone:
      lead.telefone,

    cnpj:
      lead.cnpj,

    razaoSocial:
      lead.razao_social,

    etapaAtual:
      lead.etapa_atual,

    progressoPercentual:
      lead.progresso_percentual,

    diagnosticoId:
      lead.diagnostico_id,

    notaSatisfacao:
      lead.nota_satisfacao,

    intencao:
      lead.intencao,

    responsavelFinder:
      lead.responsavel_finder,

    scoreComercial:
      Number(lead.score_comercial) || 0,

    prioridadeComercial:
      lead.prioridade_comercial || "",

    temperaturaComercial:
      lead.temperatura_comercial || "",

    proximaAcao:
      lead.proxima_acao || "",

    prazoAtendimento:
      lead.prazo_atendimento || "",

    motivosPrioridade:
      Array.isArray(lead.motivos_prioridade)
        ? lead.motivos_prioridade
        : [],

    primeiroAcesso:
      lead.primeiro_acesso,

    ultimaAtividade:
      lead.ultima_atividade,

    createdAt:
      lead.created_at,

    updatedAt:
      lead.updated_at,

    temperatura:
      lead.temperatura_comercial ||
      temperaturaLead(
        lead
      ),
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader(
      "Allow",
      "GET"
    );

    return res.status(405).json({
      sucesso: false,
      error:
        "Método não permitido.",
    });
  }

  try {
    if (!autorizado(req)) {
      return res.status(401).json({
        sucesso: false,
        error:
          "Não autorizado.",
      });
    }

    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        sucesso: false,
        error:
          "DATABASE_URL não configurada.",
      });
    }

    await garantirTabela();

    const busca =
      normalizarTexto(
        req.query?.busca,
        180
      );

    const origem =
      normalizarTexto(
        req.query?.origem,
        80
      );

    const statusDiagnostico =
      normalizarTexto(
        req.query?.statusDiagnostico,
        50
      ).toUpperCase();

    const statusComercial =
      normalizarTexto(
        req.query?.statusComercial,
        50
      ).toUpperCase();

    const responsavelFinder =
      normalizarTexto(
        req.query?.responsavelFinder,
        180
      );

    const prioridadeComercial =
      normalizarTexto(
        req.query?.prioridadeComercial,
        10
      ).toUpperCase();

    const limite =
      numeroSeguro(
        req.query?.limite,
        100,
        300
      );

    const linhas = await sql`
      SELECT
        id,
        session_id,

        origem,
        campanha,
        promoter,

        status_diagnostico,
        status_comercial,

        nome,
        email,
        telefone,
        cnpj,
        razao_social,

        etapa_atual,
        progresso_percentual,

        diagnostico_id,
        nota_satisfacao,
        intencao,

        responsavel_finder,

        score_comercial,
        prioridade_comercial,
        temperatura_comercial,
        proxima_acao,
        prazo_atendimento,
        motivos_prioridade,

        primeiro_acesso,
        ultima_atividade,

        created_at,
        updated_at

      FROM diagnostico_leads

      WHERE
        (
          ${busca} = ''
          OR nome ILIKE ${`%${busca}%`}
          OR email ILIKE ${`%${busca}%`}
          OR telefone ILIKE ${`%${busca}%`}
          OR cnpj ILIKE ${`%${busca}%`}
          OR razao_social ILIKE ${`%${busca}%`}
          OR campanha ILIKE ${`%${busca}%`}
        )

        AND (
          ${origem} = ''
          OR origem = ${origem}
        )

        AND (
          ${statusDiagnostico} = ''
          OR status_diagnostico =
            ${statusDiagnostico}
        )

        AND (
          ${statusComercial} = ''
          OR status_comercial =
            ${statusComercial}
        )

        AND (
          ${responsavelFinder} = ''
          OR responsavel_finder =
            ${responsavelFinder}
        )

        AND (
          ${prioridadeComercial} = ''
          OR prioridade_comercial =
            ${prioridadeComercial}
        )

      ORDER BY
        CASE prioridade_comercial
          WHEN 'A' THEN 1
          WHEN 'B' THEN 2
          WHEN 'C' THEN 3
          WHEN 'D' THEN 4
          ELSE 5
        END,
        score_comercial DESC,
        ultima_atividade DESC

      LIMIT ${limite}
    `;

    const leads =
      Array.isArray(linhas)
        ? linhas.map(mapearLead)
        : [];

    const total =
      leads.length;

    const acessaram =
      leads.filter(
        (lead) =>
          lead.statusDiagnostico ===
          "ACESSOU"
      ).length;

    const emPreenchimento =
      leads.filter(
        (lead) =>
          lead.statusDiagnostico ===
          "EM_PREENCHIMENTO"
      ).length;

    const naoConcluidos =
      leads.filter(
        (lead) =>
          lead.statusDiagnostico ===
          "NAO_CONCLUIDO"
      ).length;

    const concluidos =
      leads.filter(
        (lead) =>
          lead.statusDiagnostico ===
          "CONCLUIDO"
      ).length;

    const origens =
      leads.reduce(
        (acc, lead) => {
          const chave =
            lead.origem ||
            "direto";

          acc[chave] =
            (acc[chave] || 0) + 1;

          return acc;
        },
        {}
      );

    const campanhas =
      leads.reduce(
        (acc, lead) => {
          const chave =
            lead.campanha ||
            "sem_campanha";

          acc[chave] =
            (acc[chave] || 0) + 1;

          return acc;
        },
        {}
      );

    return res.status(200).json({
      sucesso: true,

      resumo: {
        total,
        acessaram,
        emPreenchimento,
        naoConcluidos,
        concluidos,

        prioridadeA:
          leads.filter(
            (lead) =>
              lead.prioridadeComercial === "A"
          ).length,

        prioridadeB:
          leads.filter(
            (lead) =>
              lead.prioridadeComercial === "B"
          ).length,

        prioridadeC:
          leads.filter(
            (lead) =>
              lead.prioridadeComercial === "C"
          ).length,

        prioridadeD:
          leads.filter(
            (lead) =>
              lead.prioridadeComercial === "D"
          ).length,

        taxaConclusao:
          total > 0
            ? Number(
                (
                  (
                    concluidos /
                    total
                  ) * 100
                ).toFixed(1)
              )
            : 0,
      },

      origens,

      campanhas,

      leads,
    });

  } catch (error) {
    console.error(
      "[listar-leads]",
      error
    );

    return res.status(500).json({
      sucesso: false,
      error:
        "Não foi possível listar os leads.",
    });
  }
}
