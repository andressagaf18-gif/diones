api/ver-diagnostico.js

import { neon } from "@neondatabase/serverless";

function responderErro(res, status, etapa, mensagem) {
  return res.status(status).json({
    sucesso: false,
    etapa,
    error: mensagem,
  });
}

export default async function handler(req, res) {
  console.log("[ver-diagnostico] INICIO");

  if (req.method !== "GET") {
    return responderErro(
      res,
      405,
      "metodo",
      "Método não permitido."
    );
  }

  if (!process.env.DATABASE_URL) {
    return responderErro(
      res,
      500,
      "configuracao_banco",
      "DATABASE_URL não configurada."
    );
  }

  if (!process.env.ADMIN_TOKEN) {
    return responderErro(
      res,
      500,
      "configuracao_admin",
      "ADMIN_TOKEN não configurado."
    );
  }

  const authorization =
    String(req.headers.authorization || "");

  const tokenRecebido =
    authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

  if (
    !tokenRecebido ||
    tokenRecebido !== process.env.ADMIN_TOKEN
  ) {
    return responderErro(
      res,
      401,
      "autenticacao",
      "Acesso não autorizado."
    );
  }

  const id =
    String(req.query?.id || "").trim();

  if (!id) {
    return responderErro(
      res,
      400,
      "parametro",
      "ID do diagnóstico não informado."
    );
  }

  let sql;

  try {
    sql = neon(process.env.DATABASE_URL);
  } catch (error) {
    console.error(
      "[ver-diagnostico] ERRO_CONEXAO:",
      error?.message || error
    );

    return responderErro(
      res,
      500,
      "conexao_banco",
      "Erro ao conectar ao banco."
    );
  }

  try {
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
        empresas,
        negocio_interpretado,
        perguntas_respostas,
        diagnostico,
        dados_completos
      FROM diagnosticos
      WHERE id = ${id}::uuid
      LIMIT 1
    `;

    const item = rows?.[0];

    if (!item) {
      return responderErro(
        res,
        404,
        "nao_encontrado",
        "Diagnóstico não encontrado."
      );
    }

    return res.status(200).json({
      sucesso: true,

      diagnostico: {
        id: item.id,
        criadoEm: item.criado_em,

        participante: {
          nome: item.nome || "",
          cargo: item.cargo || "",
          telefone: item.telefone || "",
          email: item.email || "",
        },

        empresa: {
          cnpj: item.cnpj || "",
          razaoSocial: item.razao_social || "",
          descricaoNegocio:
            item.descricao_negocio || "",
          segmento: item.segmento || "",
          subsegmento: item.subsegmento || "",
        },

        score:
          item.score === null
            ? null
            : Number(item.score),

        dores:
          Array.isArray(item.dores)
            ? item.dores
            : [],

        areas:
          Array.isArray(item.areas_selecionadas)
            ? item.areas_selecionadas
            : [],

        empresas:
          Array.isArray(item.empresas)
            ? item.empresas
            : [],

        negocioInterpretado:
          item.negocio_interpretado || {},

        perguntasRespostas:
          Array.isArray(item.perguntas_respostas)
            ? item.perguntas_respostas
            : [],

        resultado:
          item.diagnostico || {},

        dadosCompletos:
          item.dados_completos || {},
      },
    });

  } catch (error) {
    console.error(
      "[ver-diagnostico] ERRO_CONSULTA:",
      error?.message || error
    );

    return responderErro(
      res,
      500,
      "consulta_banco",
      "Não foi possível abrir o diagnóstico."
    );
  }
}
