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

async function garantirTabela() {
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
}

export default async function handler(
  req,
  res
) {
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

    const linhas =
      await sql`
        SELECT
          r.id,

          r.nome,

          r.email,

          r.telefone,

          r.areas,

          r.capacidade_diaria,

          r.ativo,

          r.created_at,

          r.updated_at,

          COUNT(l.id) FILTER (
            WHERE
              l.responsavel_finder =
                r.id

              AND l.status_comercial
                NOT IN (
                  'CONVERTIDO',
                  'PERDIDO'
                )
          )::INTEGER
          AS leads_abertos

        FROM crm_responsaveis r

        LEFT JOIN diagnostico_leads l
          ON
            l.responsavel_finder =
              r.id

        WHERE
          r.ativo =
            TRUE

        GROUP BY
          r.id,

          r.nome,

          r.email,

          r.telefone,

          r.areas,

          r.capacidade_diaria,

          r.ativo,

          r.created_at,

          r.updated_at

        ORDER BY
          r.nome ASC
      `;

    const responsaveis =
      (linhas || []).map(
        (r) => ({
          id:
            r.id,

          nome:
            r.nome,

          email:
            r.email,

          telefone:
            r.telefone,

          areas:
            Array.isArray(
              r.areas
            )
              ? r.areas
              : [],

          capacidadeDiaria:
            Number(
              r.capacidade_diaria
            ) || 0,

          ativo:
            Boolean(
              r.ativo
            ),

          leadsAbertos:
            Number(
              r.leads_abertos
            ) || 0,

          createdAt:
            r.created_at,

          updatedAt:
            r.updated_at,
        })
      );

    return res.status(200).json({
      sucesso: true,

      responsaveis,
    });

  } catch (error) {
    console.error(
      "[listar-responsaveis]",
      error
    );

    return res.status(500).json({
      sucesso: false,

      error:
        "Não foi possível listar os responsáveis.",
    });
  }
}
