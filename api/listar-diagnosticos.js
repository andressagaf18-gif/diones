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

  return (
    bearer === adminToken ||
    req.query?.token === adminToken
  );
}

function objeto(valor) {
  return (
    valor &&
    typeof valor === "object" &&
    !Array.isArray(valor)
  )
    ? valor
    : {};
}

function lista(valor) {
  return Array.isArray(valor)
    ? valor
    : [];
}

function estruturaDe(row) {
  const completo =
    objeto(row.dados_completos);

  const perfil =
    objeto(completo.perfil);

  if (perfil.estruturaNegocio) {
    return perfil.estruturaNegocio;
  }

  const segmento =
    String(row.segmento || "")
      .toLowerCase();

  const razao =
    String(row.razao_social || "")
      .toLowerCase();

  if (
    segmento.includes("pessoa física") ||
    segmento.includes("pessoa fisica")
  ) {
    return "pessoa_fisica";
  }

  if (
    razao.includes("avaliação de holding") ||
    razao.includes("avaliacao de holding")
  ) {
    return "avaliar_holding";
  }

  if (
    segmento.includes("holding") ||
    razao.includes("holding")
  ) {
    return "holding";
  }

  if (
    segmento.includes("grupo empresarial")
  ) {
    return "grupo";
  }

  if (segmento.includes("spe")) {
    return "spe";
  }

  return "operacional";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  if (!autorizado(req)) {
    return res.status(401).json({
      sucesso: false,
      error: "Não autorizado.",
    });
  }

  const busca =
    String(req.query?.busca || "")
      .trim();

  const limite =
    Math.max(
      1,
      Math.min(
        300,
        Number(req.query?.limite || 100)
      )
    );

  const offset =
    Math.max(
      0,
      Number(req.query?.offset || 0)
    );

  try {
    const termo =
      `%${busca}%`;

    const rows = await sql`
      SELECT
        id,
        criado_em,
        nome,
        cargo,
        telefone,
        email,
        cnpj,
        razao_social,
        descricao_negocio,
        segmento,
        subsegmento,
        score,
        dores,
        areas_selecionadas,
        dados_completos
      FROM diagnosticos
      WHERE
        (
          ${busca} = ''
          OR nome ILIKE ${termo}
          OR email ILIKE ${termo}
          OR telefone ILIKE ${termo}
          OR cnpj ILIKE ${termo}
          OR razao_social ILIKE ${termo}
          OR segmento ILIKE ${termo}
          OR subsegmento ILIKE ${termo}
        )
      ORDER BY criado_em DESC
      LIMIT ${limite}
      OFFSET ${offset}
    `;

    const contagem = await sql`
      SELECT COUNT(*)::INTEGER AS total
      FROM diagnosticos
      WHERE
        (
          ${busca} = ''
          OR nome ILIKE ${termo}
          OR email ILIKE ${termo}
          OR telefone ILIKE ${termo}
          OR cnpj ILIKE ${termo}
          OR razao_social ILIKE ${termo}
          OR segmento ILIKE ${termo}
          OR subsegmento ILIKE ${termo}
        )
    `;

    const diagnosticos =
      (rows || []).map(
        (row) => {
          const completo =
            objeto(row.dados_completos);

          const perfil =
            objeto(completo.perfil);

          return {
            id: row.id,
            criadoEm: row.criado_em,
            nome: row.nome,
            cargo: row.cargo,
            telefone: row.telefone,
            email: row.email,
            cnpj: row.cnpj,
            razaoSocial: row.razao_social,
            descricaoNegocio:
              row.descricao_negocio,
            segmento: row.segmento,
            subsegmento: row.subsegmento,
            score: row.score,
            dores: lista(row.dores),
            areas:
              lista(row.areas_selecionadas),
            estruturaNegocio:
              estruturaDe(row),
            perfil,
          };
        }
      );

    return res.status(200).json({
      sucesso: true,
      total:
        Number(
          contagem?.[0]?.total
        ) || 0,
      diagnosticos,
    });
  } catch (error) {
    console.error(
      "[listar-diagnosticos]",
      error
    );

    return res.status(500).json({
      sucesso: false,
      error:
        "Não foi possível listar os diagnósticos.",
    });
  }
}
