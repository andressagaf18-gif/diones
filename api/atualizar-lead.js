import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

function normalizarTexto(valor, limite = 500) {
  if (valor === null || valor === undefined) return "";

  return String(valor)
    .trim()
    .slice(0, limite);
}

function normalizarPercentual(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(numero)
    )
  );
}

function statusDiagnosticoValido(valor) {
  const permitidos = [
    "ACESSOU",
    "EM_PREENCHIMENTO",
    "NAO_CONCLUIDO",
    "CONCLUIDO",
  ];

  const status = String(valor || "")
    .trim()
    .toUpperCase();

  return permitidos.includes(status)
    ? status
    : null;
}

function statusComercialValido(valor) {
  const permitidos = [
    "NOVO_LEAD",
    "A_CONTATAR",
    "EM_CONTATO",
    "REUNIAO_AGENDADA",
    "PROPOSTA_ENVIADA",
    "CONVERTIDO",
    "PERDIDO",
  ];

  const status = String(valor || "")
    .trim()
    .toUpperCase();

  return permitidos.includes(status)
    ? status
    : null;
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

    const leadId =
      normalizarTexto(
        body.leadId,
        120
      );

    const sessionId =
      normalizarTexto(
        body.sessionId,
        120
      );

    if (!leadId && !sessionId) {
      return res.status(400).json({
        sucesso: false,
        error:
          "leadId ou sessionId é obrigatório.",
      });
    }

    // =====================================================
    // LOCALIZA O LEAD
    // =====================================================

    const existente = leadId
      ? await sql`
          SELECT *

          FROM diagnostico_leads

          WHERE id =
            ${leadId}

          LIMIT 1
        `
      : await sql`
          SELECT *

          FROM diagnostico_leads

          WHERE session_id =
            ${sessionId}

          LIMIT 1
        `;

    const atual =
      existente?.[0];

    if (!atual) {
      return res.status(404).json({
        sucesso: false,
        error:
          "Lead não encontrado.",
      });
    }

    // =====================================================
    // DADOS DO PARTICIPANTE
    // =====================================================

    const nome =
      body.nome !== undefined
        ? normalizarTexto(
            body.nome,
            180
          )
        : atual.nome;

    const email =
      body.email !== undefined
        ? normalizarTexto(
            body.email,
            220
          )
        : atual.email;

    const telefone =
      body.telefone !== undefined
        ? normalizarTexto(
            body.telefone,
            60
          )
        : atual.telefone;

    // =====================================================
    // DADOS DA EMPRESA
    // =====================================================

    const cnpj =
      body.cnpj !== undefined
        ? normalizarTexto(
            body.cnpj,
            30
          )
        : atual.cnpj;

    const razaoSocial =
      body.razaoSocial !== undefined
        ? normalizarTexto(
            body.razaoSocial,
            250
          )
        : atual.razao_social;

    // =====================================================
    // PROGRESSO DO DIAGNÓSTICO
    // =====================================================

    const etapaAtual =
      body.etapaAtual !== undefined
        ? normalizarTexto(
            body.etapaAtual,
            80
          )
        : atual.etapa_atual;

    const progressoPercentual =
      body.progressoPercentual !== undefined
        ? normalizarPercentual(
            body.progressoPercentual
          )
        : atual.progresso_percentual;

    // =====================================================
    // VÍNCULO COM DIAGNÓSTICO CONCLUÍDO
    // =====================================================

    const diagnosticoId =
      body.diagnosticoId !== undefined
        ? normalizarTexto(
            body.diagnosticoId,
            160
          )
        : atual.diagnostico_id;

    // =====================================================
    // SATISFAÇÃO / INTENÇÃO
    // =====================================================

    const intencao =
      body.intencao !== undefined
        ? normalizarTexto(
            body.intencao,
            500
          )
        : atual.intencao;

    const notaSatisfacao =
      body.notaSatisfacao !== undefined
        ? (
            Number.isInteger(
              Number(
                body.notaSatisfacao
              )
            ) &&
            Number(
              body.notaSatisfacao
            ) >= 1 &&
            Number(
              body.notaSatisfacao
            ) <= 5
              ? Number(
                  body.notaSatisfacao
                )
              : null
          )
        : atual.nota_satisfacao;

    // =====================================================
    // RESPONSÁVEL FINDER
    // =====================================================

    const responsavelFinder =
      body.responsavelFinder !== undefined
        ? normalizarTexto(
            body.responsavelFinder,
            180
          )
        : atual.responsavel_finder;

    // =====================================================
    // STATUS DO DIAGNÓSTICO
    // =====================================================

    const statusDiagnostico =
      body.statusDiagnostico !== undefined
        ? statusDiagnosticoValido(
            body.statusDiagnostico
          )
        : atual.status_diagnostico;

    if (
      body.statusDiagnostico !== undefined &&
      !statusDiagnostico
    ) {
      return res.status(400).json({
        sucesso: false,
        error:
          "statusDiagnostico inválido.",
      });
    }

    // =====================================================
    // STATUS COMERCIAL
    // =====================================================

    const statusComercial =
      body.statusComercial !== undefined
        ? statusComercialValido(
            body.statusComercial
          )
        : atual.status_comercial;

    if (
      body.statusComercial !== undefined &&
      !statusComercial
    ) {
      return res.status(400).json({
        sucesso: false,
        error:
          "statusComercial inválido.",
      });
    }

    // =====================================================
    // ATUALIZA O REGISTRO
    // =====================================================

    const atualizado =
      await sql`
        UPDATE diagnostico_leads

        SET
          nome =
            ${nome},

          email =
            ${email},

          telefone =
            ${telefone},

          cnpj =
            ${cnpj},

          razao_social =
            ${razaoSocial},

          etapa_atual =
            ${etapaAtual},

          progresso_percentual =
            ${progressoPercentual},

          status_diagnostico =
            ${statusDiagnostico},

          status_comercial =
            ${statusComercial},

          diagnostico_id =
            ${diagnosticoId},

          nota_satisfacao =
            ${notaSatisfacao},

          intencao =
            ${intencao},

          responsavel_finder =
            ${responsavelFinder},

          ultima_atividade =
            NOW(),

          updated_at =
            NOW()

        WHERE id =
          ${atual.id}

        RETURNING
          id,

          session_id,

          origem,
          campanha,
          promoter,

          status_diagnostico,
          status_comercial,

          nome,
          email,
          telefone,

          cnpj,
          razao_social,

          etapa_atual,
          progresso_percentual,

          diagnostico_id,

          nota_satisfacao,
          intencao,

          responsavel_finder,

          primeiro_acesso,
          ultima_atividade,

          created_at,
          updated_at
      `;

    const lead =
      atualizado?.[0];

    // =====================================================
    // RETORNO
    // =====================================================

    return res.status(200).json({
      sucesso: true,

      lead: lead
        ? {
            leadId:
              lead.id,

            sessionId:
              lead.session_id,

            origem:
              lead.origem,

            campanha:
              lead.campanha,

            promoter:
              lead.promoter,

            statusDiagnostico:
              lead.status_diagnostico,

            statusComercial:
              lead.status_comercial,

            nome:
              lead.nome,

            email:
              lead.email,

            telefone:
              lead.telefone,

            cnpj:
              lead.cnpj,

            razaoSocial:
              lead.razao_social,

            etapaAtual:
              lead.etapa_atual,

            progressoPercentual:
              lead.progresso_percentual,

            diagnosticoId:
              lead.diagnostico_id,

            notaSatisfacao:
              lead.nota_satisfacao,

            intencao:
              lead.intencao,

            responsavelFinder:
              lead.responsavel_finder,

            primeiroAcesso:
              lead.primeiro_acesso,

            ultimaAtividade:
              lead.ultima_atividade,

            createdAt:
              lead.created_at,

            updatedAt:
              lead.updated_at,
          }
        : null,
    });

  } catch (error) {
    console.error(
      "[atualizar-lead]",
      error
    );

    return res.status(500).json({
      sucesso: false,

      error:
        "Não foi possível atualizar o lead.",
    });
  }
}
