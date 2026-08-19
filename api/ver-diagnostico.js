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

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({
      sucesso: false,
      error: "DATABASE_URL não configurada.",
    });
  }

  const id =
    String(req.query?.id || "").trim();

  if (!id) {
    return res.status(400).json({
      sucesso: false,
      error: "ID do diagnóstico é obrigatório.",
    });
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
      WHERE id::text = ${id}
      LIMIT 1
    `;

    const row = rows?.[0];

    if (!row) {
      return res.status(404).json({
        sucesso: false,
        error: "Diagnóstico não encontrado.",
      });
    }

    const completo =
      objeto(row.dados_completos);

    const responsavel =
      objeto(completo.responsavel);

    const empresaCompleta =
      objeto(completo.empresa);

    const perfil =
      objeto(completo.perfil);

    const resultadoCompleto =
      objeto(completo.resultado);

    const resultado =
      Object.keys(resultadoCompleto).length
        ? resultadoCompleto
        : objeto(row.diagnostico);

    const segmentoBase =
      String(
        empresaCompleta.segmento ||
        row.segmento ||
        ""
      ).toLowerCase();

    const razaoBase =
      String(
        empresaCompleta.razao ||
        empresaCompleta.razaoSocial ||
        row.razao_social ||
        ""
      ).toLowerCase();

    const estruturaNegocio =
      perfil.estruturaNegocio ||
      resultado?.contextoEstrutura?.estruturaNegocio ||
      (
        segmentoBase.includes("pessoa física") ||
        segmentoBase.includes("pessoa fisica")
          ? "pessoa_fisica"
          : razaoBase.includes("avaliação de holding") ||
            razaoBase.includes("avaliacao de holding")
          ? "avaliar_holding"
          : segmentoBase.includes("holding") ||
            razaoBase.includes("holding")
          ? "holding"
          : segmentoBase.includes("grupo empresarial")
          ? "grupo"
          : segmentoBase.includes("spe")
          ? "spe"
          : "operacional"
      );

    return res.status(200).json({
      sucesso: true,

      diagnostico: {
        id: row.id,
        criadoEm: row.criado_em,
        score: row.score,

        estruturaNegocio,
        perfil,

        holding:
          perfil.holding ||
          resultado?.contextoEstrutura?.holding ||
          {},

        pessoaFisica:
          perfil.pessoaFisica ||
          resultado?.contextoEstrutura?.pessoaFisica ||
          {},

        participante: {
          nome:
            responsavel.nome ||
            row.nome ||
            "",

          cargo:
            responsavel.cargo ||
            row.cargo ||
            "",

          telefone:
            responsavel.telefone ||
            row.telefone ||
            "",

          email:
            responsavel.email ||
            row.email ||
            "",

          consentimentoEmail:
            responsavel.consentimentoEmail ??
            null,
        },

        empresa: {
          ...empresaCompleta,

          razaoSocial:
            empresaCompleta.razaoSocial ||
            empresaCompleta.razao ||
            row.razao_social ||
            "",

          razao:
            empresaCompleta.razao ||
            empresaCompleta.razaoSocial ||
            row.razao_social ||
            "",

          cnpj:
            empresaCompleta.cnpj ||
            empresaCompleta.cnpjDigits ||
            row.cnpj ||
            "",

          descricaoNegocio:
            perfil.descricaoNegocio ||
            completo.descricaoNegocio ||
            row.descricao_negocio ||
            "",

          segmento:
            empresaCompleta.segmento ||
            row.segmento ||
            "",

          subsegmento:
            empresaCompleta.subsegmento ||
            row.subsegmento ||
            "",
        },

        empresas:
          lista(completo.empresas).length
            ? lista(completo.empresas)
            : lista(row.empresas),

        dores:
          lista(perfil.doresSelecionadas).length
            ? lista(perfil.doresSelecionadas)
            : lista(row.dores),

        doresEstruturadas: {
          principal:
            perfil.dorPrincipal || "",

          objetivo90Dias:
            perfil.dor90Dias || "",

          impactos:
            lista(perfil.impactosDor),
        },

        areas:
          lista(row.areas_selecionadas),

        negocioInterpretado:
          Object.keys(
            objeto(perfil.negocioInterpretado)
          ).length
            ? objeto(perfil.negocioInterpretado)
            : objeto(row.negocio_interpretado),

        perguntasRespostas:
          lista(completo.respostas).length
            ? lista(completo.respostas)
            : lista(row.perguntas_respostas),

        resultado,

        dadosCompletos:
          completo,
      },
    });
  } catch (error) {
    console.error(
      "[ver-diagnostico]",
      error
    );

    return res.status(500).json({
      sucesso: false,
      error:
        "Não foi possível carregar o diagnóstico.",
    });
  }
}
