import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// =========================================================
// AUTORIZAÇÃO DO ADMIN
// =========================================================

function autorizado(req) {
  const adminToken =
    process.env.ADMIN_TOKEN ||
    process.env.ADMIN_PASSWORD ||
    "";

  // Mantém compatibilidade com o sistema atual.
  // Depois vamos endurecer a autenticação do Admin.
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

// =========================================================
// FUNÇÕES AUXILIARES
// =========================================================

function normalizarTexto(
  valor,
  limite = 180
) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return "";
  }

  return String(valor)
    .trim()
    .slice(0, limite);
}

function numeroSeguro(
  valor,
  padrao = 50,
  maximo = 200
) {
  const numero =
    Number(valor);

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

// =========================================================
// GARANTE QUE A TABELA EXISTE
// =========================================================

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

      primeiro_acesso TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      ultima_atividade TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_diagnostico_leads_status_diag
    ON diagnostico_leads (
      status_diagnostico
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_diagnostico_leads_status_comercial
    ON diagnostico_leads (
      status_comercial
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_diagnostico_leads_origem
    ON diagnostico_leads (
      origem
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_diagnostico_leads_updated_at
    ON diagnostico_leads (
      updated_at DESC
    )
  `;
}

// =========================================================
// TEMPERATURA COMERCIAL
// =========================================================

function temperaturaLead(lead) {
  const nota =
    Number(
      lead.nota_satisfacao
    ) || 0;

  const intencao =
    String(
      lead.intencao || ""
    );

  // Interesse direto em contratação
  if (
    intencao ===
    "Quero saber quanto custaria implementar as melhorias"
  ) {
    return "MUITO_ALTA";
  }

  // Interesse em solução
  if (
    intencao ===
    "Quero saber como resolver"
  ) {
    return "ALTA";
  }

  // Diagnóstico concluído + boa avaliação
  if (
    lead.status_diagnostico ===
      "CONCLUIDO" &&
    nota >= 4
  ) {
    return "ALTA";
  }

  // Diagnóstico concluído
  if (
    lead.status_diagnostico ===
    "CONCLUIDO"
  ) {
    return "MEDIA";
  }

  // Pessoa ainda preenchendo
  if (
    lead.status_diagnostico ===
    "EM_PREENCHIMENTO"
  ) {
    return "MEDIA";
  }

  return "BAIXA";
}

// =========================================================
// PADRONIZA RETORNO DO LEAD
// =========================================================

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

    primeiroAcesso:
      lead.primeiro_acesso,

    ultimaAtividade:
      lead.ultima_atividade,

    createdAt:
      lead.created_at,

    updatedAt:
      lead.updated_at,

    temperatura:
      temperaturaLead(
        lead
      ),
  };
}

// =========================================================
// HANDLER
// =========================================================

export default async function handler(
  req,
  res
) {
  // =====================================================
  // SOMENTE GET
  // =====================================================

  if (req.method !== "GET") {
    res.setHeader(
      "Allow",
      "GET"
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
    // =====================================================
    // AUTORIZAÇÃO
    // =====================================================

    if (!autorizado(req)) {
      return res
        .status(401)
        .json({
          sucesso: false,

          error:
            "Não autorizado.",
        });
    }

    // =====================================================
    // BANCO
    // =====================================================

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

    await garantirTabela();

    // =====================================================
    // FILTROS
    // =====================================================

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

    const limite =
      numeroSeguro(
        req.query?.limite,
        100,
        300
      );

    // =====================================================
    // CONSULTA
    // =====================================================

    const linhas =
      await sql`
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

          primeiro_acesso,
          ultima_atividade,

          created_at,
          updated_at

        FROM diagnostico_leads

        WHERE
          (
            ${busca} = ''

            OR nome
              ILIKE
              ${`%${busca}%`}

            OR email
              ILIKE
              ${`%${busca}%`}

            OR telefone
              ILIKE
              ${`%${busca}%`}

            OR cnpj
              ILIKE
              ${`%${busca}%`}

            OR razao_social
              ILIKE
              ${`%${busca}%`}

            OR campanha
              ILIKE
              ${`%${busca}%`}
          )

          AND (
            ${origem} = ''

            OR origem =
              ${origem}
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

        ORDER BY
          ultima_atividade DESC

        LIMIT ${limite}
      `;

    // =====================================================
    // PADRONIZA LEADS
    // =====================================================

    const leads =
      Array.isArray(linhas)
        ? linhas.map(
            mapearLead
          )
        : [];

    // =====================================================
    // INDICADORES
    // =====================================================

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

    // =====================================================
    // ORIGENS
    // =====================================================

    const origens =
      leads.reduce(
        (acc, lead) => {
          const chave =
            lead.origem ||
            "direto";

          acc[chave] =
            (
              acc[chave] ||
              0
            ) + 1;

          return acc;
        },
        {}
      );

    // =====================================================
    // CAMPANHAS
    // =====================================================

    const campanhas =
      leads.reduce(
        (acc, lead) => {
          const chave =
            lead.campanha ||
            "sem_campanha";

          acc[chave] =
            (
              acc[chave] ||
              0
            ) + 1;

          return acc;
        },
        {}
      );

    // =====================================================
    // RESPOSTA
    // =====================================================

    return res
      .status(200)
      .json({
        sucesso: true,

        resumo: {
          total,

          acessaram,

          emPreenchimento,

          naoConcluidos,

          concluidos,

          taxaConclusao:
            total > 0
              ? Number(
                  (
                    (
                      concluidos /
                      total
                    ) *
                    100
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

    return res
      .status(500)
      .json({
        sucesso: false,

        error:
          "Não foi possível listar os leads.",
      });
  }
}
