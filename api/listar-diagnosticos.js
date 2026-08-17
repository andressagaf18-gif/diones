// api/listar-diagnosticos.js

import { neon } from "@neondatabase/serverless";

function responderErro(
  res,
  status,
  etapa,
  mensagem
) {
  return res.status(status).json({
    sucesso: false,
    etapa,
    error: mensagem,
  });
}

export default async function handler(req, res) {
  console.log(
    "[listar-diagnosticos] INICIO"
  );

  // =========================================================
  // 1. MÉTODO
  // =========================================================

  if (req.method !== "GET") {
    return responderErro(
      res,
      405,
      "metodo",
      "Método não permitido."
    );
  }

  // =========================================================
  // 2. CONFIGURAÇÃO DO BANCO
  // =========================================================

  if (!process.env.DATABASE_URL) {
    console.error(
      "[listar-diagnosticos] DATABASE_URL ausente"
    );

    return responderErro(
      res,
      500,
      "configuracao_banco",
      "DATABASE_URL não configurada."
    );
  }

  // =========================================================
  // 3. SEGURANÇA DO ADMIN
  // =========================================================

  if (!process.env.ADMIN_TOKEN) {
    console.error(
      "[listar-diagnosticos] ADMIN_TOKEN ausente"
    );

    return responderErro(
      res,
      500,
      "configuracao_admin",
      "ADMIN_TOKEN não configurado."
    );
  }

  const authorization =
    String(
      req.headers.authorization ||
      ""
    );

  const tokenRecebido =
    authorization.startsWith(
      "Bearer "
    )
      ? authorization
          .slice(7)
          .trim()
      : "";

  if (
    !tokenRecebido ||
    tokenRecebido !==
      process.env.ADMIN_TOKEN
  ) {
    console.warn(
      "[listar-diagnosticos] Acesso não autorizado"
    );

    return responderErro(
      res,
      401,
      "autenticacao",
      "Acesso não autorizado."
    );
  }

  // =========================================================
  // 4. CONECTAR AO NEON
  // =========================================================

  let sql;

  try {
    sql = neon(
      process.env.DATABASE_URL
    );
  } catch (error) {
    console.error(
      "[listar-diagnosticos] ERRO_CONEXAO:",
      error?.message || error
    );

    return responderErro(
      res,
      500,
      "conexao_banco",
      "Erro ao conectar ao banco."
    );
  }

  // =========================================================
  // 5. PARÂMETROS
  // =========================================================

  const busca =
    String(
      req.query?.busca ||
      ""
    )
      .trim()
      .slice(0, 120);

  let limite =
    Number(
      req.query?.limite
    );

  let offset =
    Number(
      req.query?.offset
    );

  if (
    !Number.isFinite(limite) ||
    limite < 1
  ) {
    limite = 50;
  }

  if (limite > 100) {
    limite = 100;
  }

  if (
    !Number.isFinite(offset) ||
    offset < 0
  ) {
    offset = 0;
  }

  // =========================================================
  // 6. CONSULTAR
  // =========================================================

  try {
    let registros;
    let totalResult;

    if (busca) {
      const termo =
        `%${busca}%`;

      registros =
        await sql`
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
            areas_selecionadas
          FROM diagnosticos
          WHERE
            nome ILIKE ${termo}
            OR razao_social ILIKE ${termo}
            OR cnpj ILIKE ${termo}
            OR email ILIKE ${termo}
            OR telefone ILIKE ${termo}
            OR segmento ILIKE ${termo}
            OR subsegmento ILIKE ${termo}
          ORDER BY criado_em DESC
          LIMIT ${limite}
          OFFSET ${offset}
        `;

      totalResult =
        await sql`
          SELECT
            COUNT(*)::int AS total
          FROM diagnosticos
          WHERE
            nome ILIKE ${termo}
            OR razao_social ILIKE ${termo}
            OR cnpj ILIKE ${termo}
            OR email ILIKE ${termo}
            OR telefone ILIKE ${termo}
            OR segmento ILIKE ${termo}
            OR subsegmento ILIKE ${termo}
        `;
    } else {
      registros =
        await sql`
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
            areas_selecionadas
          FROM diagnosticos
          ORDER BY criado_em DESC
          LIMIT ${limite}
          OFFSET ${offset}
        `;

      totalResult =
        await sql`
          SELECT
            COUNT(*)::int AS total
          FROM diagnosticos
        `;
    }

    const total =
      Number(
        totalResult?.[0]?.total ||
        0
      );

    console.log(
      "[listar-diagnosticos] Registros:",
      registros.length,
      "Total:",
      total
    );

    return res.status(200).json({
      sucesso: true,

      total,

      limite,

      offset,

      busca,

      diagnosticos:
        registros.map(
          (item) => ({
            id:
              item.id,

            criadoEm:
              item.criado_em,

            nome:
              item.nome ||
              "",

            cargo:
              item.cargo ||
              "",

            telefone:
              item.telefone ||
              "",

            email:
              item.email ||
              "",

            cnpj:
              item.cnpj ||
              "",

            razaoSocial:
              item.razao_social ||
              "",

            descricaoNegocio:
              item.descricao_negocio ||
              "",

            segmento:
              item.segmento ||
              "",

            subsegmento:
              item.subsegmento ||
              "",

            score:
              item.score === null
                ? null
                : Number(
                    item.score
                  ),

            dores:
              Array.isArray(
                item.dores
              )
                ? item.dores
                : [],

            areas:
              Array.isArray(
                item.areas_selecionadas
              )
                ? item.areas_selecionadas
                : [],
          })
        ),
    });

  } catch (error) {
    console.error(
      "[listar-diagnosticos] ERRO_CONSULTA:",
      error?.message ||
      error
    );

    return responderErro(
      res,
      500,
      "consulta_banco",
      "Não foi possível consultar os diagnósticos."
    );
  }
}
