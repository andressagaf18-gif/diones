// api/exportar-diagnosticos.js

import { neon } from "@neondatabase/serverless";

function erro(res, status, etapa, mensagem) {
  return res.status(status).json({
    sucesso: false,
    etapa,
    error: mensagem,
  });
}

function arraySeguro(valor) {
  return Array.isArray(valor) ? valor : [];
}

function objetoSeguro(valor) {
  return valor &&
    typeof valor === "object" &&
    !Array.isArray(valor)
    ? valor
    : {};
}

export default async function handler(req, res) {
  console.log("[exportar-diagnosticos] INICIO");

  // =====================================================
  // MÉTODO
  // =====================================================

  if (req.method !== "GET") {
    return erro(
      res,
      405,
      "metodo",
      "Método não permitido."
    );
  }

  // =====================================================
  // CONFIGURAÇÃO
  // =====================================================

  if (!process.env.DATABASE_URL) {
    return erro(
      res,
      500,
      "configuracao_banco",
      "DATABASE_URL não configurada."
    );
  }

  if (!process.env.ADMIN_TOKEN) {
    return erro(
      res,
      500,
      "configuracao_admin",
      "ADMIN_TOKEN não configurado."
    );
  }

  // =====================================================
  // AUTENTICAÇÃO
  // =====================================================

  const authorization = String(
    req.headers.authorization || ""
  );

  const tokenRecebido =
    authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

  if (
    !tokenRecebido ||
    tokenRecebido !== process.env.ADMIN_TOKEN
  ) {
    return erro(
      res,
      401,
      "autenticacao",
      "Acesso não autorizado."
    );
  }

  // =====================================================
  // BANCO
  // =====================================================

  let sql;

  try {
    sql = neon(process.env.DATABASE_URL);
  } catch (error) {
    console.error(
      "[exportar-diagnosticos] ERRO_CONEXAO:",
      error?.message || error
    );

    return erro(
      res,
      500,
      "conexao_banco",
      "Erro ao conectar ao banco."
    );
  }

  // =====================================================
  // CONSULTA
  // =====================================================

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
      ORDER BY criado_em DESC
    `;

    // ===================================================
    // NORMALIZAÇÃO
    // ===================================================

    const diagnosticos = rows.map((row) => {
      const diagnostico = objetoSeguro(
        row.diagnostico
      );

      const dadosCompletos = objetoSeguro(
        row.dados_completos
      );

      const doresEstruturadas = objetoSeguro(
        dadosCompletos.dores
      );

      return {
        id: row.id,

        criadoEm: row.criado_em,

        participante: {
          nome: row.nome || "",
          cargo: row.cargo || "",
          telefone: row.telefone || "",
          email: row.email || "",
        },

        empresa: {
          cnpj: row.cnpj || "",
          razaoSocial: row.razao_social || "",
          descricaoNegocio:
            row.descricao_negocio || "",
          segmento: row.segmento || "",
          subsegmento: row.subsegmento || "",
        },

        score:
          row.score === null ||
          row.score === undefined
            ? null
            : Number(row.score),

        dores: arraySeguro(row.dores),

        doresEstruturadas: {
          selecionadas: arraySeguro(
            doresEstruturadas.selecionadas
          ),

          principal:
            doresEstruturadas.principal || "",

          objetivo90Dias:
            doresEstruturadas.objetivo90Dias || "",

          impactos: arraySeguro(
            doresEstruturadas.impactos
          ),
        },

        areas: arraySeguro(
          row.areas_selecionadas
        ),

        empresas: arraySeguro(row.empresas),

        negocioInterpretado: objetoSeguro(
          row.negocio_interpretado
        ),

        perguntasRespostas: arraySeguro(
          row.perguntas_respostas
        ),

        resultado: diagnostico,

        dadosCompletos,
      };
    });

    console.log(
      "[exportar-diagnosticos] Registros:",
      diagnosticos.length
    );

    return res.status(200).json({
      sucesso: true,
      total: diagnosticos.length,
      diagnosticos,
    });
  } catch (error) {
    console.error(
      "[exportar-diagnosticos] ERRO_CONSULTA:",
      error?.message || error
    );

    return erro(
      res,
      500,
      "consulta_banco",
      "Não foi possível consultar os diagnósticos."
    );
  }
}
