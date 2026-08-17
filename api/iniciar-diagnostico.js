import { neon } from "@neondatabase/serverless";
import crypto from "crypto";

const sql = neon(process.env.DATABASE_URL);

function gerarId(prefixo) {
  return `${prefixo}_${crypto.randomUUID()}`;
}

function normalizarTexto(valor, limite = 250) {
  if (valor === null || valor === undefined) return "";

  return String(valor)
    .trim()
    .slice(0, limite);
}

function normalizarOrigem(valor) {
  const texto = normalizarTexto(
    valor,
    80
  ).toLowerCase();

  const permitidos = [
    "instagram",
    "google",
    "site",
    "site_finder",
    "whatsapp",
    "indicacao",
    "cliente_atual",
    "evento",
    "feira",
    "networking",
    "parceiro",
    "prospeccao_ativa",
    "outro",
    "direto",
  ];

  if (permitidos.includes(texto)) {
    return texto;
  }

  return texto || "direto";
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
    CREATE INDEX IF NOT EXISTS idx_diagnostico_leads_created_at
    ON diagnostico_leads (
      created_at DESC
    )
  `;
}

export default async function handler(
  req,
  res
) {
  if (req.method !== "POST") {
    res.setHeader(
      "Allow",
      "POST"
    );

    return res.status(405).json({
      sucesso: false,
      error:
        "Método não permitido.",
    });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        sucesso: false,
        error:
          "DATABASE_URL não configurada.",
      });
    }

    await garantirTabela();

    const body =
      req.body || {};

    const origem =
      normalizarOrigem(
        body.origem
      );

    const campanha =
      normalizarTexto(
        body.campanha,
        120
      );

    const promoter =
      normalizarTexto(
        body.promoter,
        80
      );

    const utmSource =
      normalizarTexto(
        body.utm_source,
        120
      );

    const utmMedium =
      normalizarTexto(
        body.utm_medium,
        120
      );

    const utmCampaign =
      normalizarTexto(
        body.utm_campaign,
        160
      );

    const utmContent =
      normalizarTexto(
        body.utm_content,
        160
      );

    const utmTerm =
      normalizarTexto(
        body.utm_term,
        160
      );

    const referrer =
      normalizarTexto(
        body.referrer,
        500
      );

    const sessionIdRecebido =
      normalizarTexto(
        body.sessionId,
        120
      );

    // =====================================================
    // EVITA CRIAR O MESMO LEAD DUAS VEZES
    // =====================================================

    if (sessionIdRecebido) {
      const existente =
        await sql`
          SELECT
            id,
            session_id,
            status_diagnostico,
            status_comercial,
            origem,
            campanha,
            primeiro_acesso,
            ultima_atividade

          FROM diagnostico_leads

          WHERE session_id =
            ${sessionIdRecebido}

          LIMIT 1
        `;

      if (existente?.[0]) {
        await sql`
          UPDATE diagnostico_leads

          SET
            ultima_atividade = NOW(),
            updated_at = NOW()

          WHERE session_id =
            ${sessionIdRecebido}
        `;

        return res
          .status(200)
          .json({
            sucesso: true,

            existente: true,

            leadId:
              existente[0].id,

            sessionId:
              existente[0]
                .session_id,

            statusDiagnostico:
              existente[0]
                .status_diagnostico,

            statusComercial:
              existente[0]
                .status_comercial,
          });
      }
    }

    // =====================================================
    // NOVO LEAD
    // =====================================================

    const leadId =
      gerarId("lead");

    const sessionId =
      sessionIdRecebido ||
      gerarId("sessao");

    const inserido =
      await sql`
        INSERT INTO diagnostico_leads (
          id,
          session_id,

          origem,
          campanha,
          promoter,

          utm_source,
          utm_medium,
          utm_campaign,
          utm_content,
          utm_term,

          referrer,

          status_diagnostico,
          status_comercial,

          etapa_atual,
          progresso_percentual,

          primeiro_acesso,
          ultima_atividade,

          created_at,
          updated_at
        )

        VALUES (
          ${leadId},
          ${sessionId},

          ${origem},
          ${campanha},
          ${promoter},

          ${utmSource},
          ${utmMedium},
          ${utmCampaign},
          ${utmContent},
          ${utmTerm},

          ${referrer},

          'ACESSOU',
          'NOVO_LEAD',

          'INTRO',
          0,

          NOW(),
          NOW(),

          NOW(),
          NOW()
        )

        RETURNING
          id,
          session_id,
          origem,
          campanha,
          promoter,
          status_diagnostico,
          status_comercial,
          primeiro_acesso
      `;

    const lead =
      inserido?.[0];

    // =====================================================
    // RETORNO
    // =====================================================

    return res
      .status(200)
      .json({
        sucesso: true,

        existente: false,

        leadId:
          lead?.id ||
          leadId,

        sessionId:
          lead?.session_id ||
          sessionId,

        origem:
          lead?.origem ||
          origem,

        campanha:
          lead?.campanha ||
          campanha,

        promoter:
          lead?.promoter ||
          promoter,

        statusDiagnostico:
          lead?.status_diagnostico ||
          "ACESSOU",

        statusComercial:
          lead?.status_comercial ||
          "NOVO_LEAD",

        primeiroAcesso:
          lead?.primeiro_acesso ||
          null,
      });

  } catch (error) {
    console.error(
      "[iniciar-diagnostico]",
      error
    );

    return res
      .status(500)
      .json({
        sucesso: false,

        error:
          "Não foi possível iniciar a sessão do diagnóstico.",
      });
  }
}
