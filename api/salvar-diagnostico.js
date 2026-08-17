import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

function jsonSeguro(valor, padrao) {
  if (valor === undefined || valor === null) return padrao;
  return valor;
}

export default async function handler(req, res) {
  // Permite somente POST
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Método não permitido. Use POST.",
    });
  }

  try {
    if (!process.env.DATABASE_URL) {
      console.error("DATABASE_URL não configurada.");

      return res.status(500).json({
        ok: false,
        error: "Banco de dados não configurado.",
      });
    }

    const dados = req.body || {};

    /*
     * Aceitamos nomes alternativos porque o App.jsx
     * pode usar nomes diferentes para alguns campos.
     */
    const nome =
      dados.nome ||
      dados.nomeParticipante ||
      dados.responsavel ||
      "";

    const cargo =
      dados.cargo ||
      dados.funcao ||
      "";

    const telefone =
      dados.telefone ||
      dados.whatsapp ||
      dados.celular ||
      "";

    const email =
      dados.email ||
      dados.emailParticipante ||
      "";

    const cnpj =
      dados.cnpj ||
      dados.cnpjPrincipal ||
      dados.empresa?.cnpj ||
      "";

    const razaoSocial =
      dados.razao_social ||
      dados.razaoSocial ||
      dados.empresa?.razao_social ||
      dados.empresa?.razaoSocial ||
      dados.empresa?.nome ||
      "";

    const descricaoNegocio =
      dados.descricao_negocio ||
      dados.descricaoNegocio ||
      dados.atividadeInformada ||
      dados.descricao ||
      "";

    const segmento =
      dados.segmento ||
      dados.negocioInterpretado?.segmento ||
      dados.negocio_interpretado?.segmento ||
      "";

    const subsegmento =
      dados.subsegmento ||
      dados.negocioInterpretado?.subsegmento ||
      dados.negocio_interpretado?.subsegmento ||
      "";

    const scoreNumero = Number(
      dados.score ??
      dados.pontuacao ??
      dados.diagnostico?.score ??
      0
    );

    const score = Number.isFinite(scoreNumero)
      ? scoreNumero
      : 0;

    const dores = jsonSeguro(
      dados.dores ||
      dados.doresSelecionadas,
      []
    );

    const areasSelecionadas = jsonSeguro(
      dados.areas_selecionadas ||
      dados.areasSelecionadas ||
      dados.departamentos,
      []
    );

    const empresas = jsonSeguro(
      dados.empresas,
      []
    );

    const negocioInterpretado = jsonSeguro(
      dados.negocio_interpretado ||
      dados.negocioInterpretado,
      {}
    );

    const perguntasRespostas = jsonSeguro(
      dados.perguntas_respostas ||
      dados.perguntasRespostas ||
      dados.respostas,
      []
    );

    const diagnostico = jsonSeguro(
      dados.diagnostico ||
      dados.relatorio,
      {}
    );

    /*
     * dados_completos guarda exatamente o objeto recebido
     * do App.jsx.
     *
     * Assim não perdemos campos novos que adicionarmos
     * posteriormente ao formulário.
     */

    const resultado = await sql`
      INSERT INTO diagnosticos (
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
      )
      VALUES (
        ${nome},
        ${cargo},
        ${telefone},
        ${email},
        ${cnpj},
        ${razaoSocial},
        ${descricaoNegocio},
        ${segmento},
        ${subsegmento},
        ${score},
        ${JSON.stringify(dores)}::jsonb,
        ${JSON.stringify(areasSelecionadas)}::jsonb,
        ${JSON.stringify(empresas)}::jsonb,
        ${JSON.stringify(negocioInterpretado)}::jsonb,
        ${JSON.stringify(perguntasRespostas)}::jsonb,
        ${JSON.stringify(diagnostico)}::jsonb,
        ${JSON.stringify(dados)}::jsonb
      )
      RETURNING
        id,
        criado_em,
        nome,
        razao_social,
        cnpj,
        email,
        score;
    `;

    console.log(
      "Diagnóstico salvo:",
      resultado[0]?.id
    );

    return res.status(201).json({
      ok: true,
      mensagem: "Diagnóstico salvo com sucesso.",
      diagnostico: resultado[0],
    });

  } catch (error) {
    console.error(
      "ERRO SALVAR DIAGNOSTICO:",
      error
    );

    return res.status(500).json({
      ok: false,
      error: "Não foi possível salvar o diagnóstico.",
      detalhe:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
}
