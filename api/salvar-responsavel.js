import { neon } from "@neondatabase/serverless";
import crypto from "crypto";

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

    await garantirTabela();

    const body =
      req.body || {};

    const nome =
      texto(
        body.nome,
        180
      );

    if (!nome) {
      return res.status(400).json({
        sucesso: false,

        error:
          "Nome do responsável é obrigatório.",
      });
    }

    const idRecebido =
      texto(
        body.id,
        120
      );

    const id =
      idRecebido ||
      `resp_${crypto.randomUUID()}`;

    const email =
      texto(
        body.email,
        220
      );

    const telefone =
      texto(
        body.telefone,
        60
      );

    const areas =
      Array.isArray(
        body.areas
      )
        ? body.areas
            .map(
              (item) =>
                texto(
                  item,
                  120
                )
            )
            .filter(
              Boolean
            )
        : [];

    const capacidadeNumero =
      Number(
        body.capacidadeDiaria
      );

    const capacidadeDiaria =
      Number.isFinite(
        capacidadeNumero
      )
        ? Math.max(
            0,
            Math.min(
              50,
              Math.round(
                capacidadeNumero
              )
            )
          )
        : 3;

    const ativo =
      body.ativo === undefined
        ? true
        : Boolean(
            body.ativo
          );

    const linhas =
      await sql`
        INSERT INTO crm_responsaveis (
          id,

          nome,

          email,

          telefone,

          areas,

          capacidade_diaria,

          ativo,

          updated_at
        )

        VALUES (
          ${id},

          ${nome},

          ${email},

          ${telefone},

          ${JSON.stringify(
            areas
          )}::jsonb,

          ${capacidadeDiaria},

          ${ativo},

          NOW()
        )

        ON CONFLICT (id)

        DO UPDATE SET
          nome =
            EXCLUDED.nome,

          email =
            EXCLUDED.email,

          telefone =
            EXCLUDED.telefone,

          areas =
            EXCLUDED.areas,

          capacidade_diaria =
            EXCLUDED.capacidade_diaria,

          ativo =
            EXCLUDED.ativo,

          updated_at =
            NOW()

        RETURNING
          id,

          nome,

          email,

          telefone,

          areas,

          capacidade_diaria,

          ativo,

          created_at,

          updated_at
      `;

    const responsavel =
      linhas?.[0] ||
      null;

    return res.status(200).json({
      sucesso: true,

      responsavel,
    });

  } catch (error) {
    console.error(
      "[salvar-responsavel]",
      error
    );

    return res.status(500).json({
      sucesso: false,

      error:
        "Não foi possível salvar o responsável.",
    });
  }
}
