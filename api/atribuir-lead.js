import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

function autorizado(req) {
  const adminToken =
    process.env.ADMIN_TOKEN ||
    process.env.ADMIN_PASSWORD ||
    "";

  if (!adminToken) return true;

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

function texto(
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
    .slice(
      0,
      limite
    );
}

async function garantirTabelas() {
  await sql`
    CREATE TABLE IF NOT EXISTS crm_responsaveis (
      id TEXT PRIMARY KEY,

      nome TEXT NOT NULL,

      email TEXT NOT NULL DEFAULT '',

      telefone TEXT NOT NULL DEFAULT '',

      areas JSONB NOT NULL DEFAULT '[]'::jsonb,

      capacidade_diaria INTEGER NOT NULL DEFAULT 3,

      ativo BOOLEAN NOT NULL DEFAULT TRUE,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS crm_atribuicoes (
      id BIGSERIAL PRIMARY KEY,

      lead_id TEXT NOT NULL,

      responsavel_id TEXT NOT NULL,

      responsavel_nome TEXT NOT NULL DEFAULT '',

      atribuido_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

    await garantirTabelas();

    const body =
      req.body || {};

    const leadId =
      texto(
        body.leadId,
        120
      );

    const responsavelId =
      texto(
        body.responsavelId,
        120
      );

    if (
      !leadId ||
      !responsavelId
    ) {
      return res.status(400).json({
        sucesso: false,

        error:
          "leadId e responsavelId são obrigatórios.",
      });
    }

    // =====================================================
    // LOCALIZA LEAD
    // =====================================================

    const leads =
      await sql`
        SELECT
          id,

          responsavel_finder,

          status_comercial

        FROM diagnostico_leads

        WHERE
          id =
            ${leadId}

        LIMIT 1
      `;

    const lead =
      leads?.[0];

    if (!lead) {
      return res.status(404).json({
        sucesso: false,

        error:
          "Lead não encontrado.",
      });
    }

    // =====================================================
    // LOCALIZA RESPONSÁVEL
    // =====================================================

    const responsaveis =
      await sql`
        SELECT
          id,

          nome,

          capacidade_diaria,

          ativo

        FROM crm_responsaveis

        WHERE
          id =
            ${responsavelId}

        LIMIT 1
      `;

    const responsavel =
      responsaveis?.[0];

    if (
      !responsavel ||
      !responsavel.ativo
    ) {
      return res.status(404).json({
        sucesso: false,

        error:
          "Responsável não encontrado ou inativo.",
      });
    }

    // =====================================================
    // STATUS COMERCIAL
    // =====================================================

    const novoStatusComercial =
      lead.status_comercial ===
      "NOVO_LEAD"
        ? "A_CONTATAR"
        : lead.status_comercial;

    // =====================================================
    // ATRIBUI RESPONSÁVEL AO LEAD
    // =====================================================

    await sql`
      UPDATE diagnostico_leads

      SET
        responsavel_finder =
          ${responsavelId},

        status_comercial =
          ${novoStatusComercial},

        updated_at =
          NOW()

      WHERE
        id =
          ${leadId}
    `;

    // =====================================================
    // HISTÓRICO DE ATRIBUIÇÃO
    // =====================================================

    await sql`
      INSERT INTO crm_atribuicoes (
        lead_id,

        responsavel_id,

        responsavel_nome
      )

      VALUES (
        ${leadId},

        ${responsavelId},

        ${responsavel.nome}
      )
    `;

    // =====================================================
    // RETORNO
    // =====================================================

    return res.status(200).json({
      sucesso: true,

      leadId,

      responsavel: {
        id:
          responsavel.id,

        nome:
          responsavel.nome,
      },

      statusComercial:
        novoStatusComercial,
    });

  } catch (error) {
    console.error(
      "[atribuir-lead]",
      error
    );

    return res.status(500).json({
      sucesso: false,

      error:
        "Não foi possível atribuir o lead.",
    });
  }
}
