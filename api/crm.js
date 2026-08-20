import { neon } from "@neondatabase/serverless";
import crypto from "crypto";
import dashboardHandler from "./dashboard.js";

const sql = neon(process.env.DATABASE_URL);

let schemaPromise = null;

// =========================================================
// UTILITÁRIOS
// =========================================================

function texto(valor, limite = 500) {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor)
    .trim()
    .slice(0, limite);
}

function numero(valor, padrao = 0) {
  const n = Number(valor);

  return Number.isFinite(n)
    ? n
    : padrao;
}

function percentual(valor) {
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        numero(valor, 0)
      )
    )
  );
}

function autorizado(req) {
  const adminToken =
    process.env.ADMIN_TOKEN ||
    process.env.ADMIN_PASSWORD ||
    "";

  if (!adminToken) {
    return true;
  }

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

function exigirAdmin(req, res) {
  if (autorizado(req)) {
    return true;
  }

  res.status(401).json({
    sucesso: false,
    error: "Não autorizado.",
  });

  return false;
}

function normalizarOrigem(valor) {
  const origem =
    texto(valor, 80)
      .toLowerCase();

  return origem || "direto";
}

function statusDiagnosticoValido(valor) {
  const permitidos = [
    "ACESSOU",
    "EM_PREENCHIMENTO",
    "NAO_CONCLUIDO",
    "CONCLUIDO",
  ];

  const status =
    texto(valor, 50)
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

  const status =
    texto(valor, 50)
      .toUpperCase();

  return permitidos.includes(status)
    ? status
    : null;
}

function gerarId(prefixo) {
  return `${prefixo}_${crypto.randomUUID()}`;
}

// =========================================================
// ESTRUTURA DO BANCO
// =========================================================

async function prepararSchema() {
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

      estrutura_negocio TEXT NOT NULL DEFAULT 'operacional',
      contexto_cliente JSONB NOT NULL DEFAULT '{}'::jsonb,

      score_comercial INTEGER NOT NULL DEFAULT 0,
      prioridade_comercial TEXT NOT NULL DEFAULT '',
      temperatura_comercial TEXT NOT NULL DEFAULT '',
      proxima_acao TEXT NOT NULL DEFAULT '',
      prazo_atendimento TEXT NOT NULL DEFAULT '',
      motivos_prioridade JSONB NOT NULL DEFAULT '[]'::jsonb,

      primeiro_acesso TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ultima_atividade TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE diagnostico_leads
    ADD COLUMN IF NOT EXISTS estrutura_negocio
    TEXT NOT NULL DEFAULT 'operacional'
  `;

  await sql`
    ALTER TABLE diagnostico_leads
    ADD COLUMN IF NOT EXISTS contexto_cliente
    JSONB NOT NULL DEFAULT '{}'::jsonb
  `;

  await sql`
    ALTER TABLE diagnostico_leads
    ADD COLUMN IF NOT EXISTS score_comercial INTEGER NOT NULL DEFAULT 0
  `;

  await sql`
    ALTER TABLE diagnostico_leads
    ADD COLUMN IF NOT EXISTS prioridade_comercial TEXT NOT NULL DEFAULT ''
  `;

  await sql`
    ALTER TABLE diagnostico_leads
    ADD COLUMN IF NOT EXISTS temperatura_comercial TEXT NOT NULL DEFAULT ''
  `;

  await sql`
    ALTER TABLE diagnostico_leads
    ADD COLUMN IF NOT EXISTS proxima_acao TEXT NOT NULL DEFAULT ''
  `;

  await sql`
    ALTER TABLE diagnostico_leads
    ADD COLUMN IF NOT EXISTS prazo_atendimento TEXT NOT NULL DEFAULT ''
  `;

  await sql`
    ALTER TABLE diagnostico_leads
    ADD COLUMN IF NOT EXISTS motivos_prioridade JSONB NOT NULL DEFAULT '[]'::jsonb
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS crm_responsaveis (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      telefone TEXT NOT NULL DEFAULT '',
      areas JSONB NOT NULL DEFAULT '[]'::jsonb,
      capacidade_diaria INTEGER NOT NULL DEFAULT 3,

      perfil TEXT NOT NULL DEFAULT 'ESPECIALISTA',

      permissoes JSONB NOT NULL DEFAULT '{
        "verRelatorioPropriaArea": true,
        "verRespostasPropriaArea": true,
        "inserirObservacoes": true,
        "alterarStatusAtendimento": true,
        "verDiagnosticoCompleto": false,
        "verEstrategiaComercial": false,
        "verValoresPropostas": false,
        "verOutrosDepartamentos": false
      }'::jsonb,

      ativo BOOLEAN NOT NULL DEFAULT TRUE,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE crm_responsaveis
    ADD COLUMN IF NOT EXISTS perfil
    TEXT NOT NULL DEFAULT 'ESPECIALISTA'
  `;

  await sql`
    ALTER TABLE crm_responsaveis
    ADD COLUMN IF NOT EXISTS permissoes
    JSONB NOT NULL DEFAULT '{
      "verRelatorioPropriaArea": true,
      "verRespostasPropriaArea": true,
      "inserirObservacoes": true,
      "alterarStatusAtendimento": true,
      "verDiagnosticoCompleto": false,
      "verEstrategiaComercial": false,
      "verValoresPropostas": false,
      "verOutrosDepartamentos": false
    }'::jsonb
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

  await sql`
    CREATE TABLE IF NOT EXISTS crm_atendimentos_departamento (
      id TEXT PRIMARY KEY,

      diagnostico_id TEXT NOT NULL,
      lead_id TEXT NOT NULL DEFAULT '',

      area TEXT NOT NULL,
      score_area INTEGER,
      nivel_area TEXT NOT NULL DEFAULT '',

      responsavel_id TEXT NOT NULL DEFAULT '',

      status_atendimento TEXT NOT NULL DEFAULT 'NAO_INICIADO',

      oportunidades JSONB NOT NULL DEFAULT '[]'::jsonb,
      riscos JSONB NOT NULL DEFAULT '[]'::jsonb,
      recomendacoes JSONB NOT NULL DEFAULT '[]'::jsonb,
      plano_acao JSONB NOT NULL DEFAULT '[]'::jsonb,

      orientacao_tecnica TEXT NOT NULL DEFAULT '',
      observacoes_especialista TEXT NOT NULL DEFAULT '',

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE crm_atendimentos_departamento
    ADD COLUMN IF NOT EXISTS status_oportunidade
    TEXT NOT NULL DEFAULT 'NAO_ANALISADA'
  `;

  await sql`
    ALTER TABLE crm_atendimentos_departamento
    ADD COLUMN IF NOT EXISTS proxima_acao
    TEXT NOT NULL DEFAULT ''
  `;

  await sql`
    ALTER TABLE crm_atendimentos_departamento
    ADD COLUMN IF NOT EXISTS proximo_contato
    TIMESTAMPTZ
  `;

  await sql`
    ALTER TABLE crm_atendimentos_departamento
    ADD COLUMN IF NOT EXISTS ultimo_acionamento
    TIMESTAMPTZ
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS crm_atendimento_historico (
      id TEXT PRIMARY KEY,
      atendimento_id TEXT NOT NULL,
      diagnostico_id TEXT NOT NULL DEFAULT '',
      lead_id TEXT NOT NULL DEFAULT '',
      tipo_evento TEXT NOT NULL DEFAULT 'ACIONAMENTO',
      tipo_acionamento TEXT NOT NULL DEFAULT '',
      resultado TEXT NOT NULL DEFAULT '',
      descricao TEXT NOT NULL DEFAULT '',
      status_anterior TEXT NOT NULL DEFAULT '',
      status_novo TEXT NOT NULL DEFAULT '',
      oportunidade_anterior TEXT NOT NULL DEFAULT '',
      oportunidade_nova TEXT NOT NULL DEFAULT '',
      proxima_acao TEXT NOT NULL DEFAULT '',
      proximo_contato TIMESTAMPTZ,
      responsavel_id TEXT NOT NULL DEFAULT '',
      responsavel_nome TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_crm_atendimento_historico_atendimento
    ON crm_atendimento_historico (atendimento_id, created_at DESC)
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_atendimentos_diag_area
    ON crm_atendimentos_departamento (diagnostico_id, area)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_crm_atendimentos_responsavel
    ON crm_atendimentos_departamento (responsavel_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_crm_atendimentos_status
    ON crm_atendimentos_departamento (status_atendimento)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_diagnostico_leads_status_diag
    ON diagnostico_leads (status_diagnostico)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_diagnostico_leads_status_comercial
    ON diagnostico_leads (status_comercial)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_diagnostico_leads_origem
    ON diagnostico_leads (origem)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_diagnostico_leads_prioridade
    ON diagnostico_leads (prioridade_comercial)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_diagnostico_leads_updated_at
    ON diagnostico_leads (updated_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_crm_responsaveis_ativo
    ON crm_responsaveis (ativo)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_crm_atribuicoes_responsavel_data
    ON crm_atribuicoes (responsavel_id, atribuido_em DESC)
  `;
}

async function garantirSchema() {
  if (!schemaPromise) {
    schemaPromise =
      prepararSchema()
        .catch((error) => {
          schemaPromise = null;
          throw error;
        });
  }

  return schemaPromise;
}

// =========================================================
// AÇÃO: INICIAR
// =========================================================

async function iniciarDiagnostico(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  const body =
    req.body || {};

  const origem =
    normalizarOrigem(
      body.origem ||
      body.utm_source
    );

  const campanha =
    texto(
      body.campanha ||
      body.utm_campaign,
      160
    );

  const promoter =
    texto(
      body.promoter,
      80
    );

  const utmSource =
    texto(
      body.utm_source,
      120
    );

  const utmMedium =
    texto(
      body.utm_medium,
      120
    );

  const utmCampaign =
    texto(
      body.utm_campaign,
      160
    );

  const utmContent =
    texto(
      body.utm_content,
      160
    );

  const utmTerm =
    texto(
      body.utm_term,
      160
    );

  const referrer =
    texto(
      body.referrer,
      500
    );

  const sessionIdRecebido =
    texto(
      body.sessionId,
      140
    );

  if (sessionIdRecebido) {
    const existente =
      await sql`
        SELECT
          id,
          session_id,
          origem,
          campanha,
          promoter,
          status_diagnostico,
          status_comercial,
          primeiro_acesso,
          ultima_atividade
        FROM diagnostico_leads
        WHERE session_id =
          ${sessionIdRecebido}
        LIMIT 1
      `;

    if (existente?.[0]) {
      await sql`
        UPDATE diagnostico_leads
        SET
          ultima_atividade = NOW(),
          updated_at = NOW()
        WHERE session_id =
          ${sessionIdRecebido}
      `;

      return res.status(200).json({
        sucesso: true,
        existente: true,
        leadId:
          existente[0].id,
        sessionId:
          existente[0].session_id,
        origem:
          existente[0].origem,
        campanha:
          existente[0].campanha,
        promoter:
          existente[0].promoter,
        statusDiagnostico:
          existente[0].status_diagnostico,
        statusComercial:
          existente[0].status_comercial,
        primeiroAcesso:
          existente[0].primeiro_acesso,
      });
    }
  }

  const leadId =
    gerarId("lead");

  const sessionId =
    sessionIdRecebido ||
    gerarId("sessao");

  const linhas =
    await sql`
      INSERT INTO diagnostico_leads (
        id,
        session_id,

        origem,
        campanha,
        promoter,

        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,

        referrer,

        status_diagnostico,
        status_comercial,

        etapa_atual,
        progresso_percentual,

        primeiro_acesso,
        ultima_atividade,
        created_at,
        updated_at
      )
      VALUES (
        ${leadId},
        ${sessionId},

        ${origem},
        ${campanha},
        ${promoter},

        ${utmSource},
        ${utmMedium},
        ${utmCampaign},
        ${utmContent},
        ${utmTerm},

        ${referrer},

        'ACESSOU',
        'NOVO_LEAD',

        'INTRO',
        0,

        NOW(),
        NOW(),
        NOW(),
        NOW()
      )
      RETURNING
        id,
        session_id,
        origem,
        campanha,
        promoter,
        status_diagnostico,
        status_comercial,
        primeiro_acesso
    `;

  const lead =
    linhas?.[0];

  return res.status(200).json({
    sucesso: true,
    existente: false,

    leadId:
      lead?.id || leadId,

    sessionId:
      lead?.session_id || sessionId,

    origem:
      lead?.origem || origem,

    campanha:
      lead?.campanha || campanha,

    promoter:
      lead?.promoter || promoter,

    statusDiagnostico:
      lead?.status_diagnostico ||
      "ACESSOU",

    statusComercial:
      lead?.status_comercial ||
      "NOVO_LEAD",

    primeiroAcesso:
      lead?.primeiro_acesso ||
      null,
  });
}

// =========================================================
// AÇÃO: ATUALIZAR
// =========================================================

async function atualizarLead(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  const body =
    req.body || {};

  const leadId =
    texto(
      body.leadId,
      140
    );

  const sessionId =
    texto(
      body.sessionId,
      140
    );

  if (!leadId && !sessionId) {
    return res.status(400).json({
      sucesso: false,
      error:
        "leadId ou sessionId é obrigatório.",
    });
  }

  const existente =
    leadId
      ? await sql`
          SELECT *
          FROM diagnostico_leads
          WHERE id = ${leadId}
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
      error: "Lead não encontrado.",
    });
  }

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

  const nome =
    body.nome !== undefined
      ? texto(body.nome, 180)
      : atual.nome;

  const email =
    body.email !== undefined
      ? texto(body.email, 220)
      : atual.email;

  const telefone =
    body.telefone !== undefined
      ? texto(body.telefone, 60)
      : atual.telefone;

  const cnpj =
    body.cnpj !== undefined
      ? texto(body.cnpj, 30)
      : atual.cnpj;

  const razaoSocial =
    body.razaoSocial !== undefined
      ? texto(
          body.razaoSocial,
          250
        )
      : atual.razao_social;

  const etapaAtual =
    body.etapaAtual !== undefined
      ? texto(
          body.etapaAtual,
          80
        )
      : atual.etapa_atual;

  const progressoPercentual =
    body.progressoPercentual !== undefined
      ? percentual(
          body.progressoPercentual
        )
      : atual.progresso_percentual;

  const diagnosticoId =
    body.diagnosticoId !== undefined
      ? texto(
          body.diagnosticoId,
          180
        )
      : atual.diagnostico_id;

  const intencao =
    body.intencao !== undefined
      ? texto(
          body.intencao,
          500
        )
      : atual.intencao;

  const responsavelFinder =
    body.responsavelFinder !== undefined
      ? texto(
          body.responsavelFinder,
          180
        )
      : atual.responsavel_finder;

  const estruturaNegocio =
    body.estruturaNegocio !== undefined
      ? texto(
          body.estruturaNegocio,
          80
        ) || "operacional"
      : atual.estrutura_negocio || "operacional";

  const contextoCliente =
    body.contextoCliente !== undefined &&
    body.contextoCliente &&
    typeof body.contextoCliente === "object" &&
    !Array.isArray(body.contextoCliente)
      ? body.contextoCliente
      : atual.contexto_cliente || {};

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

  const linhas =
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

        estrutura_negocio =
          ${estruturaNegocio},

        contexto_cliente =
          ${JSON.stringify(
            contextoCliente
          )}::jsonb,

        ultima_atividade =
          NOW(),

        updated_at =
          NOW()

      WHERE id =
        ${atual.id}

      RETURNING *
    `;

  const lead =
    linhas?.[0];

  return res.status(200).json({
    sucesso: true,

    lead:
      lead
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

            estruturaNegocio:
              lead.estrutura_negocio ||
              "operacional",

            contextoCliente:
              lead.contexto_cliente ||
              {},

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
}

// =========================================================
// CLASSIFICAÇÃO COMERCIAL
// =========================================================

function calcularClassificacao({
  scoreDiagnostico = 0,
  nivelDiagnostico = "",
  faturamentoAnual = 0,
  dores = [],
  notaSatisfacao = 0,
  intencao = "",
}) {
  let score = 0;

  const motivos = [];

  const nivel =
    texto(
      nivelDiagnostico,
      80
    ).toUpperCase();

  const intencaoNormalizada =
    texto(
      intencao,
      500
    ).toLowerCase();

  const doresTexto =
    Array.isArray(dores)
      ? dores
          .join(" ")
          .toLowerCase()
      : texto(
          dores,
          1000
        ).toLowerCase();

  if (
    intencaoNormalizada.includes(
      "quanto custaria"
    )
  ) {
    score += 30;

    motivos.push(
      "Cliente demonstrou interesse direto em saber o custo da implementação."
    );
  } else if (
    intencaoNormalizada.includes(
      "como resolver"
    )
  ) {
    score += 20;

    motivos.push(
      "Cliente demonstrou interesse em entender como resolver os problemas identificados."
    );
  } else if (
    intencaoNormalizada.includes(
      "entender melhor"
    )
  ) {
    score += 10;

    motivos.push(
      "Cliente demonstrou interesse em aprofundar o diagnóstico."
    );
  }

  if (
    nivel === "EMERGENCIAL"
  ) {
    score += 15;

    motivos.push(
      "Diagnóstico empresarial classificado como emergencial."
    );
  } else if (
    nivel === "CRÍTICO" ||
    nivel === "CRITICO"
  ) {
    score += 10;

    motivos.push(
      "Diagnóstico empresarial classificado como crítico."
    );
  } else if (
    numero(scoreDiagnostico) < 40
  ) {
    score += 15;

    motivos.push(
      "Score empresarial inferior a 40 pontos."
    );
  } else if (
    numero(scoreDiagnostico) < 60
  ) {
    score += 10;

    motivos.push(
      "Score empresarial indica fragilidades relevantes."
    );
  }

  const faturamento =
    numero(
      faturamentoAnual,
      0
    );

  if (
    faturamento >= 4800000
  ) {
    score += 20;

    motivos.push(
      "Empresa possui faturamento anual elevado."
    );
  } else if (
    faturamento >= 1500000
  ) {
    score += 15;

    motivos.push(
      "Empresa possui faturamento relevante para atendimento consultivo."
    );
  } else if (
    faturamento >= 600000
  ) {
    score += 10;

    motivos.push(
      "Empresa possui porte compatível com potencial consultivo."
    );
  } else if (
    faturamento >= 360000
  ) {
    score += 5;
  }

  const termosPrioritarios = [
    "falta de dinheiro",
    "caixa",
    "inadimpl",
    "tribut",
    "imposto",
    "margem",
    "preço",
    "preco",
    "vendas",
    "financeiro",
    "lucro",
    "rentabilidade",
    "retrabalho",
  ];

  const possuiDorPrioritaria =
    termosPrioritarios.some(
      (termo) =>
        doresTexto.includes(
          termo
        )
    );

  if (possuiDorPrioritaria) {
    score += 10;

    motivos.push(
      "Foram identificadas dores com potencial impacto financeiro, tributário ou comercial."
    );
  }

  const nota =
    numero(
      notaSatisfacao,
      0
    );

  if (nota === 5) {
    score += 5;

    motivos.push(
      "Cliente avaliou o diagnóstico com nota máxima."
    );
  } else if (
    nota === 4
  ) {
    score += 3;
  }

  score =
    Math.max(
      0,
      Math.min(
        100,
        score
      )
    );

  let prioridade;
  let temperatura;
  let prazoAtendimento;
  let proximaAcao;

  if (score >= 80) {
    prioridade = "A";
    temperatura = "MUITO_ALTA";
    prazoAtendimento = "2_HORAS";
    proximaAcao = "CONTATO_COMERCIAL";
  } else if (
    score >= 60
  ) {
    prioridade = "B";
    temperatura = "ALTA";
    prazoAtendimento = "24_HORAS";
    proximaAcao = "AGENDAR_REUNIAO";
  } else if (
    score >= 40
  ) {
    prioridade = "C";
    temperatura = "MEDIA";
    prazoAtendimento = "3_DIAS";
    proximaAcao = "FOLLOW_UP_CONSULTIVO";
  } else {
    prioridade = "D";
    temperatura = "BAIXA";
    prazoAtendimento = "NUTRICAO";
    proximaAcao = "NUTRICAO";
  }

  return {
    scoreComercial:
      score,

    prioridade,

    temperatura,

    prazoAtendimento,

    proximaAcao,

    motivos,
  };
}

async function classificarLead(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  const body =
    req.body || {};

  const leadId =
    texto(
      body.leadId,
      140
    );

  const sessionId =
    texto(
      body.sessionId,
      140
    );

  if (!leadId && !sessionId) {
    return res.status(400).json({
      sucesso: false,
      error:
        "leadId ou sessionId é obrigatório.",
    });
  }

  const linhas =
    leadId
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

  const lead =
    linhas?.[0];

  if (!lead) {
    return res.status(404).json({
      sucesso: false,
      error:
        "Lead não encontrado.",
    });
  }

  const classificacao =
    calcularClassificacao({
      scoreDiagnostico:
        body.scoreDiagnostico,

      nivelDiagnostico:
        body.nivelDiagnostico,

      faturamentoAnual:
        body.faturamentoAnual,

      dores:
        body.dores,

      notaSatisfacao:
        body.notaSatisfacao ??
        lead.nota_satisfacao,

      intencao:
        body.intencao ??
        lead.intencao,
    });

  await sql`
    UPDATE diagnostico_leads

    SET
      score_comercial =
        ${classificacao.scoreComercial},

      prioridade_comercial =
        ${classificacao.prioridade},

      temperatura_comercial =
        ${classificacao.temperatura},

      proxima_acao =
        ${classificacao.proximaAcao},

      prazo_atendimento =
        ${classificacao.prazoAtendimento},

      motivos_prioridade =
        ${JSON.stringify(
          classificacao.motivos
        )}::jsonb,

      updated_at =
        NOW()

    WHERE id =
      ${lead.id}
  `;

  return res.status(200).json({
    sucesso: true,

    leadId:
      lead.id,

    scoreComercial:
      classificacao.scoreComercial,

    prioridade:
      classificacao.prioridade,

    temperatura:
      classificacao.temperatura,

    prazoAtendimento:
      classificacao.prazoAtendimento,

    proximaAcao:
      classificacao.proximaAcao,

    motivos:
      classificacao.motivos,
  });
}

// =========================================================
// LISTAGEM DE LEADS
// =========================================================

function temperaturaFallback(lead) {
  const nota =
    numero(
      lead.nota_satisfacao,
      0
    );

  const intencao =
    texto(
      lead.intencao,
      500
    );

  if (
    intencao ===
    "Quero saber quanto custaria implementar as melhorias"
  ) {
    return "MUITO_ALTA";
  }

  if (
    intencao ===
    "Quero saber como resolver"
  ) {
    return "ALTA";
  }

  if (
    lead.status_diagnostico ===
      "CONCLUIDO" &&
    nota >= 4
  ) {
    return "ALTA";
  }

  if (
    lead.status_diagnostico ===
    "CONCLUIDO"
  ) {
    return "MEDIA";
  }

  if (
    lead.status_diagnostico ===
    "EM_PREENCHIMENTO"
  ) {
    return "MEDIA";
  }

  return "BAIXA";
}

function mapearLead(lead) {
  return {
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

    estruturaNegocio:
      lead.estrutura_negocio ||
      "operacional",

    contextoCliente:
      lead.contexto_cliente ||
      {},

    scoreComercial:
      numero(
        lead.score_comercial,
        0
      ),

    prioridadeComercial:
      lead.prioridade_comercial ||
      "",

    temperaturaComercial:
      lead.temperatura_comercial ||
      "",

    proximaAcao:
      lead.proxima_acao ||
      "",

    prazoAtendimento:
      lead.prazo_atendimento ||
      "",

    motivosPrioridade:
      Array.isArray(
        lead.motivos_prioridade
      )
        ? lead.motivos_prioridade
        : [],

    primeiroAcesso:
      lead.primeiro_acesso,

    ultimaAtividade:
      lead.ultima_atividade,

    createdAt:
      lead.created_at,

    updatedAt:
      lead.updated_at,

    temperatura:
      lead.temperatura_comercial ||
      temperaturaFallback(
        lead
      ),
  };
}

async function listarLeads(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  if (!exigirAdmin(req, res)) {
    return;
  }

  const busca =
    texto(
      req.query?.busca,
      180
    );

  const origem =
    texto(
      req.query?.origem,
      80
    );

  const statusDiagnostico =
    texto(
      req.query?.statusDiagnostico,
      50
    ).toUpperCase();

  const statusComercial =
    texto(
      req.query?.statusComercial,
      50
    ).toUpperCase();

  const responsavelFinder =
    texto(
      req.query?.responsavelFinder,
      180
    );

  const prioridadeComercial =
    texto(
      req.query?.prioridadeComercial,
      10
    ).toUpperCase();

  const limite =
    Math.max(
      1,
      Math.min(
        300,
        Math.round(
          numero(
            req.query?.limite,
            100
          )
        )
      )
    );

  const linhas =
    await sql`
      SELECT
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

        estrutura_negocio,
        contexto_cliente,

        score_comercial,
        prioridade_comercial,
        temperatura_comercial,
        proxima_acao,
        prazo_atendimento,
        motivos_prioridade,

        primeiro_acesso,
        ultima_atividade,

        created_at,
        updated_at

      FROM diagnostico_leads

      WHERE
        (
          ${busca} = ''
          OR nome ILIKE
            ${`%${busca}%`}
          OR email ILIKE
            ${`%${busca}%`}
          OR telefone ILIKE
            ${`%${busca}%`}
          OR cnpj ILIKE
            ${`%${busca}%`}
          OR razao_social ILIKE
            ${`%${busca}%`}
          OR campanha ILIKE
            ${`%${busca}%`}
        )

        AND (
          ${origem} = ''
          OR origem =
            ${origem}
        )

        AND (
          ${statusDiagnostico} = ''
          OR status_diagnostico =
            ${statusDiagnostico}
        )

        AND (
          ${statusComercial} = ''
          OR status_comercial =
            ${statusComercial}
        )

        AND (
          ${responsavelFinder} = ''
          OR responsavel_finder =
            ${responsavelFinder}
        )

        AND (
          ${prioridadeComercial} = ''
          OR prioridade_comercial =
            ${prioridadeComercial}
        )

      ORDER BY
        CASE prioridade_comercial
          WHEN 'A' THEN 1
          WHEN 'B' THEN 2
          WHEN 'C' THEN 3
          WHEN 'D' THEN 4
          ELSE 5
        END,

        score_comercial DESC,

        ultima_atividade DESC

      LIMIT ${limite}
    `;

  const leads =
    Array.isArray(linhas)
      ? linhas.map(
          mapearLead
        )
      : [];

  const total =
    leads.length;

  const acessaram =
    leads.filter(
      (lead) =>
        lead.statusDiagnostico ===
        "ACESSOU"
    ).length;

  const emPreenchimento =
    leads.filter(
      (lead) =>
        lead.statusDiagnostico ===
        "EM_PREENCHIMENTO"
    ).length;

  const naoConcluidos =
    leads.filter(
      (lead) =>
        lead.statusDiagnostico ===
        "NAO_CONCLUIDO"
    ).length;

  const concluidos =
    leads.filter(
      (lead) =>
        lead.statusDiagnostico ===
        "CONCLUIDO"
    ).length;

  const origens =
    leads.reduce(
      (acc, lead) => {
        const chave =
          lead.origem ||
          "direto";

        acc[chave] =
          (acc[chave] || 0) + 1;

        return acc;
      },
      {}
    );

  const campanhas =
    leads.reduce(
      (acc, lead) => {
        const chave =
          lead.campanha ||
          "sem_campanha";

        acc[chave] =
          (acc[chave] || 0) + 1;

        return acc;
      },
      {}
    );

  return res.status(200).json({
    sucesso: true,

    resumo: {
      total,
      acessaram,
      emPreenchimento,
      naoConcluidos,
      concluidos,

      prioridadeA:
        leads.filter(
          (lead) =>
            lead.prioridadeComercial ===
            "A"
        ).length,

      prioridadeB:
        leads.filter(
          (lead) =>
            lead.prioridadeComercial ===
            "B"
        ).length,

      prioridadeC:
        leads.filter(
          (lead) =>
            lead.prioridadeComercial ===
            "C"
        ).length,

      prioridadeD:
        leads.filter(
          (lead) =>
            lead.prioridadeComercial ===
            "D"
        ).length,

      taxaConclusao:
        total > 0
          ? Number(
              (
                (
                  concluidos /
                  total
                ) * 100
              ).toFixed(1)
            )
          : 0,
    },

    origens,

    campanhas,

    leads,
  });
}

// =========================================================
// ATENDIMENTOS POR DEPARTAMENTO
// =========================================================

function statusAtendimentoValido(valor) {
  const permitidos = [
    "NAO_INICIADO",
    "EM_ANALISE",
    "REUNIAO_AGENDADA",
    "EM_ATENDIMENTO",
    "PLANO_APRESENTADO",
    "CONCLUIDO",
  ];

  const status =
    texto(
      valor,
      50
    ).toUpperCase();

  return permitidos.includes(status)
    ? status
    : null;
}

function statusOportunidadeValido(valor) {
  const permitidos = [
    "NAO_ANALISADA",
    "EM_ANALISE",
    "OPORTUNIDADE_IDENTIFICADA",
    "PROPOSTA",
    "CONTRATADO",
    "SEM_OPORTUNIDADE",
  ];

  const status =
    texto(valor, 60)
      .toUpperCase();

  return permitidos.includes(status)
    ? status
    : null;
}

function tipoAcionamentoValido(valor) {
  const permitidos = [
    "WHATSAPP",
    "LIGACAO",
    "EMAIL",
    "REUNIAO",
    "VIDEOCONFERENCIA",
    "PROPOSTA",
    "ANALISE_INTERNA",
    "DOCUMENTOS",
    "OUTRO",
  ];

  const tipo =
    texto(valor, 60)
      .toUpperCase();

  return permitidos.includes(tipo)
    ? tipo
    : "OUTRO";
}

function areaCanonicaCRM(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizarArray(valor) {
  if (!Array.isArray(valor)) {
    return [];
  }

  return valor
    .filter(
      (item) =>
        item !== null &&
        item !== undefined &&
        item !== ""
    );
}

function permissoesPadrao(perfil = "ESPECIALISTA") {
  const perfilNormalizado =
    texto(
      perfil,
      40
    ).toUpperCase();

  if (perfilNormalizado === "ADMIN") {
    return {
      verRelatorioPropriaArea: true,
      verRespostasPropriaArea: true,
      inserirObservacoes: true,
      alterarStatusAtendimento: true,
      verDiagnosticoCompleto: true,
      verEstrategiaComercial: true,
      verValoresPropostas: true,
      verOutrosDepartamentos: true,
    };
  }

  return {
    verRelatorioPropriaArea: true,
    verRespostasPropriaArea: true,
    inserirObservacoes: true,
    alterarStatusAtendimento: true,
    verDiagnosticoCompleto: false,
    verEstrategiaComercial: false,
    verValoresPropostas: false,
    verOutrosDepartamentos: false,
  };
}

function normalizarPermissoes(
  perfil,
  permissoesRecebidas
) {
  const base =
    permissoesPadrao(
      perfil
    );

  if (
    !permissoesRecebidas ||
    typeof permissoesRecebidas !== "object" ||
    Array.isArray(permissoesRecebidas)
  ) {
    return base;
  }

  return {
    verRelatorioPropriaArea:
      permissoesRecebidas.verRelatorioPropriaArea ??
      base.verRelatorioPropriaArea,

    verRespostasPropriaArea:
      permissoesRecebidas.verRespostasPropriaArea ??
      base.verRespostasPropriaArea,

    inserirObservacoes:
      permissoesRecebidas.inserirObservacoes ??
      base.inserirObservacoes,

    alterarStatusAtendimento:
      permissoesRecebidas.alterarStatusAtendimento ??
      base.alterarStatusAtendimento,

    verDiagnosticoCompleto:
      permissoesRecebidas.verDiagnosticoCompleto ??
      base.verDiagnosticoCompleto,

    verEstrategiaComercial:
      permissoesRecebidas.verEstrategiaComercial ??
      base.verEstrategiaComercial,

    verValoresPropostas:
      permissoesRecebidas.verValoresPropostas ??
      base.verValoresPropostas,

    verOutrosDepartamentos:
      permissoesRecebidas.verOutrosDepartamentos ??
      base.verOutrosDepartamentos,
  };
}

async function criarAtendimentosDepartamento(
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

  const body =
    req.body || {};

  const diagnosticoId =
    texto(
      body.diagnosticoId,
      180
    );

  const leadId =
    texto(
      body.leadId,
      140
    );

  const areas =
    Array.isArray(
      body.areas
    )
      ? body.areas
      : [];

  if (!diagnosticoId) {
    return res.status(400).json({
      sucesso: false,
      error:
        "diagnosticoId é obrigatório.",
    });
  }

  if (!areas.length) {
    return res.status(400).json({
      sucesso: false,
      error:
        "Nenhuma área foi informada para criação dos atendimentos.",
    });
  }

  const criados = [];

  // Equipe disponível para atribuição automática.
  // A escolha prioriza especialista compatível com menor carga aberta.
  const equipeDisponivel =
    await sql`
      SELECT
        r.id,
        r.nome,
        r.areas,
        r.capacidade_diaria,
        COUNT(a.id) FILTER (
          WHERE a.status_atendimento <> 'CONCLUIDO'
        )::int AS atendimentos_abertos
      FROM crm_responsaveis r
      LEFT JOIN crm_atendimentos_departamento a
        ON a.responsavel_id = r.id
      WHERE r.ativo = TRUE
      GROUP BY
        r.id,
        r.nome,
        r.areas,
        r.capacidade_diaria
      ORDER BY
        atendimentos_abertos ASC,
        r.nome ASC
    `;

  for (const areaItem of areas) {
    const area =
      texto(
        areaItem?.area ||
        areaItem?.nome,
        120
      );

    if (!area) {
      continue;
    }

    const areaCanonica =
      areaCanonicaCRM(
        areaItem?.areaId ||
        area
      );

    const candidatos =
      (equipeDisponivel || [])
        .filter(
          (responsavel) =>
            normalizarArray(
              responsavel.areas
            ).some(
              (areaResponsavel) => {
                const canonicaResponsavel =
                  areaCanonicaCRM(
                    areaResponsavel
                  );

                // aceita tanto o ID do eixo quanto o label exibido
                return (
                  canonicaResponsavel ===
                    areaCanonica ||
                  canonicaResponsavel ===
                    areaCanonicaCRM(area)
                );
              }
            )
        )
        .sort(
          (a, b) => {
            const cargaA =
              Number(
                a.atendimentos_abertos
              ) || 0;

            const cargaB =
              Number(
                b.atendimentos_abertos
              ) || 0;

            if (cargaA !== cargaB) {
              return cargaA - cargaB;
            }

            const capacidadeA =
              Number(
                a.capacidade_diaria
              ) || 0;

            const capacidadeB =
              Number(
                b.capacidade_diaria
              ) || 0;

            return (
              capacidadeB -
              capacidadeA
            );
          }
        );

    const responsavelAutomatico =
      candidatos[0] ||
      null;

    const existente =
      await sql`
        SELECT
          id,
          responsavel_id
        FROM crm_atendimentos_departamento
        WHERE
          diagnostico_id =
            ${diagnosticoId}
          AND area =
            ${area}
        LIMIT 1
      `;

    const jaExistia =
      Boolean(
        existente?.[0]
      );

    const scoreArea =
      areaItem?.score !== undefined &&
      areaItem?.score !== null
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                numero(
                  areaItem.score,
                  0
                )
              )
            )
          )
        : null;

    const nivelArea =
      texto(
        areaItem?.nivel,
        80
      );

    const oportunidades =
      normalizarArray(
        areaItem?.oportunidades ||
        areaItem?.oportunidadesConsultoria
      );

    const riscos =
      normalizarArray(
        areaItem?.riscos
      );

    const recomendacoes =
      normalizarArray(
        areaItem?.recomendacoes
      );

    const planoAcao =
      normalizarArray(
        areaItem?.planoAcao ||
        areaItem?.plano_acao
      );

    const orientacaoTecnica =
      texto(
        areaItem?.orientacaoTecnica ||
        areaItem?.orientacao_tecnica,
        5000
      );

    const id =
      gerarId(
        "atd"
      );

    const linhas =
      await sql`
        INSERT INTO crm_atendimentos_departamento (
          id,
          diagnostico_id,
          lead_id,

          area,
          score_area,
          nivel_area,
          responsavel_id,

          oportunidades,
          riscos,
          recomendacoes,
          plano_acao,

          orientacao_tecnica,

          created_at,
          updated_at
        )

        VALUES (
          ${id},
          ${diagnosticoId},
          ${leadId},

          ${area},
          ${scoreArea},
          ${nivelArea},
          ${
            responsavelAutomatico?.id ||
            ""
          },

          ${JSON.stringify(
            oportunidades
          )}::jsonb,

          ${JSON.stringify(
            riscos
          )}::jsonb,

          ${JSON.stringify(
            recomendacoes
          )}::jsonb,

          ${JSON.stringify(
            planoAcao
          )}::jsonb,

          ${orientacaoTecnica},

          NOW(),
          NOW()
        )

        ON CONFLICT (
          diagnostico_id,
          area
        )

        DO UPDATE SET
          lead_id =
            EXCLUDED.lead_id,

          score_area =
            EXCLUDED.score_area,

          nivel_area =
            EXCLUDED.nivel_area,

          responsavel_id =
            CASE
              WHEN crm_atendimentos_departamento.responsavel_id = ''
                THEN EXCLUDED.responsavel_id
              ELSE crm_atendimentos_departamento.responsavel_id
            END,

          oportunidades =
            EXCLUDED.oportunidades,

          riscos =
            EXCLUDED.riscos,

          recomendacoes =
            EXCLUDED.recomendacoes,

          plano_acao =
            EXCLUDED.plano_acao,

          orientacao_tecnica =
            EXCLUDED.orientacao_tecnica,

          updated_at =
            NOW()

        RETURNING
          id,
          diagnostico_id,
          lead_id,
          area,
          score_area,
          nivel_area,
          responsavel_id,
          status_atendimento,
          status_oportunidade,
          proxima_acao,
          proximo_contato,
          ultimo_acionamento,
          oportunidades,
          riscos,
          recomendacoes,
          plano_acao,
          orientacao_tecnica,
          observacoes_especialista,
          created_at,
          updated_at
      `;

    if (linhas?.[0]) {
      const atendimentoCriado =
        linhas[0];

      criados.push(
        atendimentoCriado
      );

      if (!jaExistia) {
        const responsavelNome =
          responsavelAutomatico?.nome ||
          "";

        await sql`
          INSERT INTO crm_atendimento_historico (
            id,
            atendimento_id,
            diagnostico_id,
            lead_id,
            tipo_evento,
            descricao,
            status_anterior,
            status_novo,
            oportunidade_anterior,
            oportunidade_nova,
            responsavel_id,
            responsavel_nome,
            created_at
          )
          VALUES (
            ${gerarId("hist")},
            ${atendimentoCriado.id},
            ${diagnosticoId},
            ${leadId},
            'CRIACAO',
            ${
              responsavelAutomatico
                ? "Atendimento criado automaticamente e atribuído conforme área/capacidade."
                : "Atendimento criado automaticamente; aguardando responsável compatível."
            },
            '',
            'NAO_INICIADO',
            '',
            'NAO_ANALISADA',
            ${
              responsavelAutomatico?.id ||
              ""
            },
            ${responsavelNome},
            NOW()
          )
        `;

        // Atualiza a carga local para distribuir os próximos
        // atendimentos do mesmo diagnóstico de forma mais equilibrada.
        if (responsavelAutomatico) {
          responsavelAutomatico.atendimentos_abertos =
            (
              Number(
                responsavelAutomatico.atendimentos_abertos
              ) || 0
            ) + 1;
        }
      }
    }
  }

  return res.status(200).json({
    sucesso: true,

    total:
      criados.length,

    atendimentos:
      criados.map(
        (item) => ({
          id:
            item.id,

          diagnosticoId:
            item.diagnostico_id,

          leadId:
            item.lead_id,

          area:
            item.area,

          scoreArea:
            item.score_area,

          nivelArea:
            item.nivel_area,

          responsavelId:
            item.responsavel_id,

          statusAtendimento:
            item.status_atendimento,

          statusOportunidade:
            item.status_oportunidade ||
            "NAO_ANALISADA",

          proximaAcao:
            item.proxima_acao ||
            "",

          proximoContato:
            item.proximo_contato ||
            null,

          ultimoAcionamento:
            item.ultimo_acionamento ||
            null,

          oportunidades:
            Array.isArray(
              item.oportunidades
            )
              ? item.oportunidades
              : [],

          riscos:
            Array.isArray(
              item.riscos
            )
              ? item.riscos
              : [],

          recomendacoes:
            Array.isArray(
              item.recomendacoes
            )
              ? item.recomendacoes
              : [],

          planoAcao:
            Array.isArray(
              item.plano_acao
            )
              ? item.plano_acao
              : [],

          orientacaoTecnica:
            item.orientacao_tecnica,

          observacoesEspecialista:
            item.observacoes_especialista,

          createdAt:
            item.created_at,

          updatedAt:
            item.updated_at,
        })
      ),
  });
}


async function sincronizarAtendimentosSalvos() {
  const diagnosticosSemAtendimento =
    await sql`
      SELECT
        d.id,
        d.score,
        d.areas_selecionadas,
        d.diagnostico,
        l.id AS lead_id
      FROM diagnosticos d
      LEFT JOIN diagnostico_leads l
        ON l.diagnostico_id =
          d.id::text
      WHERE NOT EXISTS (
        SELECT 1
        FROM crm_atendimentos_departamento a
        WHERE a.diagnostico_id =
          d.id::text
      )
      ORDER BY
        d.criado_em DESC
      LIMIT 100
    `;

  if (
    !diagnosticosSemAtendimento?.length
  ) {
    return {
      sincronizados: 0,
      atendimentosCriados: 0,
    };
  }

  const equipeDisponivel =
    await sql`
      SELECT
        r.id,
        r.nome,
        r.areas,
        r.capacidade_diaria,
        COUNT(a.id) FILTER (
          WHERE a.status_atendimento <> 'CONCLUIDO'
        )::int AS atendimentos_abertos
      FROM crm_responsaveis r
      LEFT JOIN crm_atendimentos_departamento a
        ON a.responsavel_id = r.id
      WHERE r.ativo = TRUE
      GROUP BY
        r.id,
        r.nome,
        r.areas,
        r.capacidade_diaria
      ORDER BY
        atendimentos_abertos ASC,
        r.nome ASC
    `;

  let diagnosticosSincronizados = 0;
  let atendimentosCriados = 0;

  for (
    const diagnostico of
    diagnosticosSemAtendimento
  ) {
    const resultado =
      diagnostico.diagnostico &&
      typeof diagnostico.diagnostico ===
        "object"
        ? diagnostico.diagnostico
        : {};

    const areasResultado =
      Array.isArray(
        resultado.areas
      )
        ? resultado.areas
        : [];

    const areasBanco =
      Array.isArray(
        diagnostico.areas_selecionadas
      )
        ? diagnostico.areas_selecionadas
        : [];

    const mapa = new Map();

    [
      ...areasBanco,
      ...areasResultado,
    ].forEach(
      (item) => {
        if (!item) return;

        const area =
          texto(
            item.area ||
            item.label ||
            item.nome,
            120
          );

        if (!area) return;

        const anterior =
          mapa.get(area) ||
          {};

        mapa.set(
          area,
          {
            ...anterior,
            ...item,
            area,
          }
        );
      }
    );

    const areasElegiveis =
      [...mapa.values()]
        .filter(
          (item) => {
            const score =
              item.score === null ||
              item.score === undefined
                ? null
                : numero(
                    item.score,
                    0
                  );

            const riscos =
              normalizarArray(
                item.riscos
              );

            const recomendacoes =
              normalizarArray(
                item.recomendacoes
              );

            const oportunidades =
              normalizarArray(
                item.oportunidades ||
                item.oportunidadesConsultoria
              );

            const planoAcao =
              normalizarArray(
                item.planoAcao ||
                item.plano_acao
              );

            const prioridade =
              item.prioridade === true;

            return (
              (
                score !== null &&
                score < 60
              ) ||
              prioridade ||
              riscos.length > 0 ||
              recomendacoes.length > 0 ||
              oportunidades.length > 0 ||
              planoAcao.length > 0
            );
          }
        );

    if (
      !areasElegiveis.length
    ) {
      continue;
    }

    let criouNesteDiagnostico =
      false;

    for (
      const areaItem of
      areasElegiveis
    ) {
      const area =
        texto(
          areaItem.area,
          120
        );

      if (!area) continue;

      const areaCanonica =
        areaCanonicaCRM(
          areaItem.areaId ||
          area
        );

      const candidatos =
        (equipeDisponivel || [])
          .filter(
            (responsavel) =>
              normalizarArray(
                responsavel.areas
              ).some(
                (
                  areaResponsavel
                ) => {
                  const canonica =
                    areaCanonicaCRM(
                      areaResponsavel
                    );

                  return (
                    canonica ===
                      areaCanonica ||
                    canonica ===
                      areaCanonicaCRM(
                        area
                      )
                  );
                }
              )
          )
          .sort(
            (a, b) =>
              (
                Number(
                  a.atendimentos_abertos
                ) || 0
              ) -
              (
                Number(
                  b.atendimentos_abertos
                ) || 0
              )
          );

      const responsavel =
        candidatos[0] ||
        null;

      const id =
        gerarId("atd");

      const scoreArea =
        areaItem.score === null ||
        areaItem.score === undefined
          ? null
          : Math.max(
              0,
              Math.min(
                100,
                Math.round(
                  numero(
                    areaItem.score,
                    0
                  )
                )
              )
            );

      const nivelArea =
        texto(
          areaItem.nivel,
          80
        );

      const oportunidades =
        normalizarArray(
          areaItem.oportunidades ||
          areaItem.oportunidadesConsultoria
        );

      const riscos =
        normalizarArray(
          areaItem.riscos
        );

      const recomendacoes =
        normalizarArray(
          areaItem.recomendacoes
        );

      const planoAcao =
        normalizarArray(
          areaItem.planoAcao ||
          areaItem.plano_acao
        );

      const orientacaoTecnica =
        texto(
          areaItem.orientacaoTecnica ||
          areaItem.resumo,
          5000
        );

      const inseridos =
        await sql`
          INSERT INTO crm_atendimentos_departamento (
            id,
            diagnostico_id,
            lead_id,
            area,
            score_area,
            nivel_area,
            responsavel_id,
            oportunidades,
            riscos,
            recomendacoes,
            plano_acao,
            orientacao_tecnica,
            created_at,
            updated_at
          )
          VALUES (
            ${id},
            ${String(diagnostico.id)},
            ${diagnostico.lead_id || ""},
            ${area},
            ${scoreArea},
            ${nivelArea},
            ${responsavel?.id || ""},
            ${JSON.stringify(oportunidades)}::jsonb,
            ${JSON.stringify(riscos)}::jsonb,
            ${JSON.stringify(recomendacoes)}::jsonb,
            ${JSON.stringify(planoAcao)}::jsonb,
            ${orientacaoTecnica},
            NOW(),
            NOW()
          )
          ON CONFLICT (
            diagnostico_id,
            area
          )
          DO NOTHING
          RETURNING id
        `;

      if (
        inseridos?.[0]?.id
      ) {
        criouNesteDiagnostico =
          true;

        atendimentosCriados +=
          1;

        await sql`
          INSERT INTO crm_atendimento_historico (
            id,
            atendimento_id,
            diagnostico_id,
            lead_id,
            tipo_evento,
            descricao,
            status_anterior,
            status_novo,
            oportunidade_anterior,
            oportunidade_nova,
            responsavel_id,
            responsavel_nome,
            created_at
          )
          VALUES (
            ${gerarId("hist")},
            ${inseridos[0].id},
            ${String(diagnostico.id)},
            ${diagnostico.lead_id || ""},
            'CRIACAO',
            'Atendimento criado automaticamente a partir de diagnóstico já salvo.',
            '',
            'NAO_INICIADO',
            '',
            'NAO_ANALISADA',
            ${responsavel?.id || ""},
            ${responsavel?.nome || ""},
            NOW()
          )
        `;

        if (responsavel) {
          responsavel.atendimentos_abertos =
            (
              Number(
                responsavel.atendimentos_abertos
              ) || 0
            ) + 1;
        }
      }
    }

    if (
      criouNesteDiagnostico
    ) {
      diagnosticosSincronizados +=
        1;
    }
  }

  return {
    sincronizados:
      diagnosticosSincronizados,

    atendimentosCriados,
  };
}

async function listarAtendimentosDepartamento(
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

  if (!exigirAdmin(req, res)) {
    return;
  }

  // Recupera automaticamente diagnósticos antigos que ainda
  // não possuem casos na fila de Atendimentos.
  try {
    await sincronizarAtendimentosSalvos();
  } catch (erroSincronizacao) {
    console.warn(
      "[CRM] Não foi possível sincronizar atendimentos antigos:",
      erroSincronizacao
    );
  }

  const diagnosticoId =
    texto(
      req.query?.diagnosticoId,
      180
    );

  const leadId =
    texto(
      req.query?.leadId,
      140
    );

  const responsavelId =
    texto(
      req.query?.responsavelId,
      140
    );

  const area =
    texto(
      req.query?.area,
      120
    );

  const statusAtendimento =
    texto(
      req.query?.statusAtendimento,
      50
    ).toUpperCase();

  const statusOportunidade =
    texto(
      req.query?.statusOportunidade,
      60
    ).toUpperCase();

  const linhas =
    await sql`
      SELECT
        a.id,
        a.diagnostico_id,
        a.lead_id,

        a.area,
        a.score_area,
        a.nivel_area,

        a.responsavel_id,
        a.status_atendimento,
        a.status_oportunidade,
        a.proxima_acao,
        a.proximo_contato,
        a.ultimo_acionamento,

        a.oportunidades,
        a.riscos,
        a.recomendacoes,
        a.plano_acao,

        a.orientacao_tecnica,
        a.observacoes_especialista,

        a.created_at,
        a.updated_at,

        r.nome
          AS responsavel_nome,

        r.email
          AS responsavel_email,

        r.areas
          AS responsavel_areas,

        r.perfil
          AS responsavel_perfil,

        r.permissoes
          AS responsavel_permissoes,

        l.id
          AS lead_id_real,

        COALESCE(
          NULLIF(l.nome, ''),
          NULLIF(d.nome, '')
        )
          AS lead_nome,

        COALESCE(
          NULLIF(l.email, ''),
          NULLIF(d.email, '')
        )
          AS lead_email,

        COALESCE(
          NULLIF(l.telefone, ''),
          NULLIF(d.telefone, '')
        )
          AS lead_telefone,

        COALESCE(
          NULLIF(l.cnpj, ''),
          NULLIF(d.cnpj, '')
        )
          AS lead_cnpj,

        COALESCE(
          NULLIF(l.razao_social, ''),
          NULLIF(d.razao_social, '')
        )
          AS lead_razao_social,

        COALESCE(
          NULLIF(l.estrutura_negocio, ''),
          NULLIF(
            d.dados_completos
              -> 'perfil'
              ->> 'estruturaNegocio',
            ''
          ),
          'operacional'
        )
          AS lead_estrutura_negocio,

        COALESCE(
          NULLIF(l.status_diagnostico, ''),
          'CONCLUIDO'
        )
          AS lead_status_diagnostico,

        COALESCE(
          NULLIF(l.origem, ''),
          'diagnostico_salvo'
        )
          AS lead_origem,

        COALESCE(
          NULLIF(l.diagnostico_id, ''),
          d.id::text
        )
          AS lead_diagnostico_id,

        d.nome
          AS diagnostico_nome,

        d.email
          AS diagnostico_email,

        d.telefone
          AS diagnostico_telefone,

        d.cnpj
          AS diagnostico_cnpj,

        d.razao_social
          AS diagnostico_razao_social

      FROM crm_atendimentos_departamento a

      LEFT JOIN crm_responsaveis r
        ON
          r.id =
            a.responsavel_id

      LEFT JOIN diagnostico_leads l
        ON (
          l.id =
            a.lead_id
          OR (
            a.diagnostico_id <> ''
            AND l.diagnostico_id =
              a.diagnostico_id
          )
        )

      LEFT JOIN diagnosticos d
        ON
          d.id::text =
            a.diagnostico_id

      WHERE
        (
          ${diagnosticoId} = ''
          OR a.diagnostico_id =
            ${diagnosticoId}
        )

        AND (
          ${leadId} = ''
          OR a.lead_id =
            ${leadId}
        )

        AND (
          ${responsavelId} = ''
          OR a.responsavel_id =
            ${responsavelId}
        )

        AND (
          ${area} = ''
          OR a.area =
            ${area}
        )

        AND (
          ${statusAtendimento} = ''
          OR a.status_atendimento =
            ${statusAtendimento}
        )

        AND (
          ${statusOportunidade} = ''
          OR a.status_oportunidade =
            ${statusOportunidade}
        )

      ORDER BY
        CASE
          WHEN a.score_area IS NULL
            THEN 999
          ELSE a.score_area
        END ASC,

        a.area ASC
    `;

  return res.status(200).json({
    sucesso: true,

    atendimentos:
      (linhas || []).map(
        (item) => ({
          id:
            item.id,

          diagnosticoId:
            item.diagnostico_id,

          leadId:
            item.lead_id,

          area:
            item.area,

          scoreArea:
            item.score_area,

          nivelArea:
            item.nivel_area,

          responsavelId:
            item.responsavel_id,

          responsavelNome:
            item.responsavel_nome ||
            "",

          statusAtendimento:
            item.status_atendimento,

          statusOportunidade:
            item.status_oportunidade ||
            "NAO_ANALISADA",

          proximaAcao:
            item.proxima_acao ||
            "",

          proximoContato:
            item.proximo_contato ||
            null,

          ultimoAcionamento:
            item.ultimo_acionamento ||
            null,

          oportunidades:
            Array.isArray(
              item.oportunidades
            )
              ? item.oportunidades
              : [],

          riscos:
            Array.isArray(
              item.riscos
            )
              ? item.riscos
              : [],

          recomendacoes:
            Array.isArray(
              item.recomendacoes
            )
              ? item.recomendacoes
              : [],

          planoAcao:
            Array.isArray(
              item.plano_acao
            )
              ? item.plano_acao
              : [],

          orientacaoTecnica:
            item.orientacao_tecnica,

          observacoesEspecialista:
            item.observacoes_especialista,

          lead:
            (
              item.lead_id_real ||
              item.lead_nome ||
              item.lead_razao_social ||
              item.diagnostico_nome ||
              item.diagnostico_razao_social
            )
              ? {
                  leadId:
                    item.lead_id_real ||
                    item.lead_id ||
                    "",

                  nome:
                    item.lead_nome ||
                    item.diagnostico_nome ||
                    "",

                  fonteDados:
                    item.lead_id_real
                      ? "lead"
                      : "diagnostico",


                  email:
                    item.lead_email ||
                    item.diagnostico_email ||
                    "",

                  telefone:
                    item.lead_telefone ||
                    item.diagnostico_telefone ||
                    "",

                  cnpj:
                    item.lead_cnpj ||
                    item.diagnostico_cnpj ||
                    "",

                  razaoSocial:
                    item.lead_razao_social ||
                    item.diagnostico_razao_social ||
                    "",

                  estruturaNegocio:
                    item.lead_estrutura_negocio ||
                    "operacional",

                  statusDiagnostico:
                    item.lead_status_diagnostico ||
                    "",

                  origem:
                    item.lead_origem ||
                    "direto",

                  diagnosticoId:
                    item.lead_diagnostico_id ||
                    item.diagnostico_id ||
                    "",
                }
              : null,

          responsavel: item.responsavel_id
            ? {
                id:
                  item.responsavel_id,

                nome:
                  item.responsavel_nome ||
                  "",

                email:
                  item.responsavel_email ||
                  "",

                areas:
                  Array.isArray(
                    item.responsavel_areas
                  )
                    ? item.responsavel_areas
                    : [],

                perfil:
                  item.responsavel_perfil ||
                  "ESPECIALISTA",

                permissoes:
                  item.responsavel_permissoes ||
                  permissoesPadrao(
                    "ESPECIALISTA"
                  ),
              }
            : null,

          createdAt:
            item.created_at,

          updatedAt:
            item.updated_at,
        })
      ),
  });
}

async function atualizarAtendimentoDepartamento(
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

  if (!exigirAdmin(req, res)) {
    return;
  }

  const body =
    req.body || {};

  const atendimentoId =
    texto(
      body.atendimentoId,
      140
    );

  if (!atendimentoId) {
    return res.status(400).json({
      sucesso: false,
      error:
        "atendimentoId é obrigatório.",
    });
  }

  const existentes =
    await sql`
      SELECT *
      FROM crm_atendimentos_departamento
      WHERE id =
        ${atendimentoId}
      LIMIT 1
    `;

  const atual =
    existentes?.[0];

  if (!atual) {
    return res.status(404).json({
      sucesso: false,
      error:
        "Atendimento não encontrado.",
    });
  }

  const statusAtendimento =
    body.statusAtendimento !== undefined
      ? statusAtendimentoValido(
          body.statusAtendimento
        )
      : atual.status_atendimento;

  if (
    body.statusAtendimento !== undefined &&
    !statusAtendimento
  ) {
    return res.status(400).json({
      sucesso: false,
      error:
        "statusAtendimento inválido.",
    });
  }

  const statusOportunidade =
    body.statusOportunidade !== undefined
      ? statusOportunidadeValido(
          body.statusOportunidade
        )
      : (
          atual.status_oportunidade ||
          "NAO_ANALISADA"
        );

  if (
    body.statusOportunidade !== undefined &&
    !statusOportunidade
  ) {
    return res.status(400).json({
      sucesso: false,
      error:
        "statusOportunidade inválido.",
    });
  }

  const proximaAcao =
    body.proximaAcao !== undefined
      ? texto(
          body.proximaAcao,
          1200
        )
      : (
          atual.proxima_acao ||
          ""
        );

  const proximoContato =
    body.proximoContato !== undefined
      ? (
          body.proximoContato
            ? new Date(
                body.proximoContato
              )
            : null
        )
      : atual.proximo_contato;

  const responsavelId =
    body.responsavelId !== undefined
      ? texto(
          body.responsavelId,
          140
        )
      : atual.responsavel_id;

  const observacoesEspecialista =
    body.observacoesEspecialista !== undefined
      ? texto(
          body.observacoesEspecialista,
          12000
        )
      : atual.observacoes_especialista;

  const linhas =
    await sql`
      UPDATE crm_atendimentos_departamento

      SET
        responsavel_id =
          ${responsavelId},

        status_atendimento =
          ${statusAtendimento},

        status_oportunidade =
          ${statusOportunidade},

        proxima_acao =
          ${proximaAcao},

        proximo_contato =
          ${proximoContato},

        observacoes_especialista =
          ${observacoesEspecialista},

        updated_at =
          NOW()

      WHERE id =
        ${atendimentoId}

      RETURNING *
    `;

  const atendimento =
    linhas?.[0];

  const mudouStatus =
    String(
      atual.status_atendimento ||
      ""
    ) !==
    String(
      statusAtendimento ||
      ""
    );

  const mudouOportunidade =
    String(
      atual.status_oportunidade ||
      "NAO_ANALISADA"
    ) !==
    String(
      statusOportunidade ||
      "NAO_ANALISADA"
    );

  const mudouResponsavel =
    String(
      atual.responsavel_id ||
      ""
    ) !==
    String(
      responsavelId ||
      ""
    );

  if (
    mudouStatus ||
    mudouOportunidade ||
    mudouResponsavel
  ) {
    let responsavelNome = "";

    if (responsavelId) {
      const respNome =
        await sql`
          SELECT nome
          FROM crm_responsaveis
          WHERE id = ${responsavelId}
          LIMIT 1
        `;

      responsavelNome =
        respNome?.[0]?.nome ||
        "";
    }

    await sql`
      INSERT INTO crm_atendimento_historico (
        id,
        atendimento_id,
        diagnostico_id,
        lead_id,
        tipo_evento,
        descricao,
        status_anterior,
        status_novo,
        oportunidade_anterior,
        oportunidade_nova,
        proxima_acao,
        proximo_contato,
        responsavel_id,
        responsavel_nome,
        created_at
      )
      VALUES (
        ${gerarId("hist")},
        ${atendimentoId},
        ${atual.diagnostico_id || ""},
        ${atual.lead_id || ""},
        'ALTERACAO',
        'Atendimento atualizado.',
        ${atual.status_atendimento || ""},
        ${statusAtendimento || ""},
        ${atual.status_oportunidade || "NAO_ANALISADA"},
        ${statusOportunidade || "NAO_ANALISADA"},
        ${proximaAcao},
        ${proximoContato},
        ${responsavelId},
        ${responsavelNome},
        NOW()
      )
    `;
  }

  return res.status(200).json({
    sucesso: true,

    atendimento:
      atendimento
        ? {
            id:
              atendimento.id,

            diagnosticoId:
              atendimento.diagnostico_id,

            leadId:
              atendimento.lead_id,

            area:
              atendimento.area,

            scoreArea:
              atendimento.score_area,

            nivelArea:
              atendimento.nivel_area,

            responsavelId:
              atendimento.responsavel_id,

            statusAtendimento:
              atendimento.status_atendimento,

            statusOportunidade:
              atendimento.status_oportunidade ||
              "NAO_ANALISADA",

            proximaAcao:
              atendimento.proxima_acao ||
              "",

            proximoContato:
              atendimento.proximo_contato ||
              null,

            ultimoAcionamento:
              atendimento.ultimo_acionamento ||
              null,

            observacoesEspecialista:
              atendimento.observacoes_especialista,

            updatedAt:
              atendimento.updated_at,
          }
        : null,
  });
}

// =========================================================
// AÇÃO: REGISTRAR ACIONAMENTO
// =========================================================

async function registrarAcionamento(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  if (!exigirAdmin(req, res)) {
    return;
  }

  const body = req.body || {};
  const atendimentoId =
    texto(body.atendimentoId, 140);

  if (!atendimentoId) {
    return res.status(400).json({
      sucesso: false,
      error: "atendimentoId é obrigatório.",
    });
  }

  const encontrados =
    await sql`
      SELECT *
      FROM crm_atendimentos_departamento
      WHERE id = ${atendimentoId}
      LIMIT 1
    `;

  const atendimento = encontrados?.[0];

  if (!atendimento) {
    return res.status(404).json({
      sucesso: false,
      error: "Atendimento não encontrado.",
    });
  }

  const tipoAcionamento =
    tipoAcionamentoValido(
      body.tipoAcionamento
    );

  const resultado =
    texto(body.resultado, 800);

  const descricao =
    texto(
      body.descricao ||
      body.observacao,
      8000
    );

  const proximaAcao =
    texto(body.proximaAcao, 1200);

  const proximoContato =
    body.proximoContato
      ? new Date(body.proximoContato)
      : null;

  const responsavelId =
    texto(
      body.responsavelId ||
      atendimento.responsavel_id,
      140
    );

  let responsavelNome =
    texto(body.responsavelNome, 180);

  if (!responsavelNome && responsavelId) {
    const r =
      await sql`
        SELECT nome
        FROM crm_responsaveis
        WHERE id = ${responsavelId}
        LIMIT 1
      `;
    responsavelNome =
      r?.[0]?.nome || "";
  }

  const statusNovo =
    body.statusAtendimento
      ? statusAtendimentoValido(
          body.statusAtendimento
        )
      : atendimento.status_atendimento;

  const oportunidadeNova =
    body.statusOportunidade
      ? statusOportunidadeValido(
          body.statusOportunidade
        )
      : (
          atendimento.status_oportunidade ||
          "NAO_ANALISADA"
        );

  if (!statusNovo) {
    return res.status(400).json({
      sucesso: false,
      error: "statusAtendimento inválido.",
    });
  }

  if (!oportunidadeNova) {
    return res.status(400).json({
      sucesso: false,
      error: "statusOportunidade inválido.",
    });
  }

  const historicoId =
    gerarId("hist");

  await sql`
    INSERT INTO crm_atendimento_historico (
      id,
      atendimento_id,
      diagnostico_id,
      lead_id,
      tipo_evento,
      tipo_acionamento,
      resultado,
      descricao,
      status_anterior,
      status_novo,
      oportunidade_anterior,
      oportunidade_nova,
      proxima_acao,
      proximo_contato,
      responsavel_id,
      responsavel_nome,
      created_at
    )
    VALUES (
      ${historicoId},
      ${atendimentoId},
      ${atendimento.diagnostico_id || ""},
      ${atendimento.lead_id || ""},
      'ACIONAMENTO',
      ${tipoAcionamento},
      ${resultado},
      ${descricao},
      ${atendimento.status_atendimento || ""},
      ${statusNovo},
      ${atendimento.status_oportunidade || "NAO_ANALISADA"},
      ${oportunidadeNova},
      ${proximaAcao},
      ${proximoContato},
      ${responsavelId},
      ${responsavelNome},
      NOW()
    )
  `;

  await sql`
    UPDATE crm_atendimentos_departamento
    SET
      status_atendimento =
        ${statusNovo},
      status_oportunidade =
        ${oportunidadeNova},
      proxima_acao =
        ${proximaAcao},
      proximo_contato =
        ${proximoContato},
      ultimo_acionamento =
        NOW(),
      updated_at =
        NOW()
    WHERE id =
      ${atendimentoId}
  `;

  return res.status(200).json({
    sucesso: true,
    historicoId,
  });
}

// =========================================================
// AÇÃO: LISTAR HISTÓRICO
// =========================================================

async function listarHistoricoAtendimento(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  if (!exigirAdmin(req, res)) {
    return;
  }

  const atendimentoId =
    texto(
      req.query?.atendimentoId,
      140
    );

  if (!atendimentoId) {
    return res.status(400).json({
      sucesso: false,
      error: "atendimentoId é obrigatório.",
    });
  }

  const linhas =
    await sql`
      SELECT *
      FROM crm_atendimento_historico
      WHERE atendimento_id =
        ${atendimentoId}
      ORDER BY created_at DESC
      LIMIT 300
    `;

  return res.status(200).json({
    sucesso: true,
    historico:
      (linhas || []).map(
        (item) => ({
          id: item.id,
          atendimentoId: item.atendimento_id,
          diagnosticoId: item.diagnostico_id,
          leadId: item.lead_id,
          tipoEvento: item.tipo_evento,
          tipoAcionamento: item.tipo_acionamento,
          resultado: item.resultado,
          descricao: item.descricao,
          statusAnterior: item.status_anterior,
          statusNovo: item.status_novo,
          oportunidadeAnterior: item.oportunidade_anterior,
          oportunidadeNova: item.oportunidade_nova,
          proximaAcao: item.proxima_acao,
          proximoContato: item.proximo_contato,
          responsavelId: item.responsavel_id,
          responsavelNome: item.responsavel_nome,
          criadoEm: item.created_at,
        })
      ),
  });
}

// =========================================================
// EQUIPE
// =========================================================

async function listarResponsaveis(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  if (!exigirAdmin(req, res)) {
    return;
  }

  const linhas =
    await sql`
      SELECT
        r.id,
        r.nome,
        r.email,
        r.telefone,
        r.areas,
        r.capacidade_diaria,
        r.perfil,
        r.permissoes,
        r.ativo,
        r.created_at,
        r.updated_at,

        (
          SELECT
            COUNT(*)::INTEGER
          FROM diagnostico_leads l
          WHERE
            l.responsavel_finder =
              r.id

            AND l.status_comercial
              NOT IN (
                'CONVERTIDO',
                'PERDIDO'
              )
        ) AS leads_abertos,

        (
          SELECT
            COUNT(*)::INTEGER
          FROM crm_atribuicoes a
          WHERE
            a.responsavel_id =
              r.id

            AND DATE(
              a.atribuido_em
              AT TIME ZONE
              'America/Sao_Paulo'
            ) =
            DATE(
              NOW()
              AT TIME ZONE
              'America/Sao_Paulo'
            )
        ) AS atribuicoes_hoje

      FROM crm_responsaveis r

      WHERE
        r.ativo =
          TRUE

      ORDER BY
        r.nome ASC
    `;

  const responsaveis =
    (linhas || []).map(
      (r) => {
        const capacidade =
          numero(
            r.capacidade_diaria,
            0
          );

        const atribuicoesHoje =
          numero(
            r.atribuicoes_hoje,
            0
          );

        return {
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
            capacidade,

          perfil:
            r.perfil ||
            "ESPECIALISTA",

          permissoes:
            r.permissoes ||
            permissoesPadrao(
              r.perfil ||
              "ESPECIALISTA"
            ),

          ativo:
            Boolean(
              r.ativo
            ),

          leadsAbertos:
            numero(
              r.leads_abertos,
              0
            ),

          atribuicoesHoje,

          capacidadeDisponivelHoje:
            Math.max(
              0,
              capacidade -
              atribuicoesHoje
            ),

          lotadoHoje:
            capacidade > 0 &&
            atribuicoesHoje >=
              capacidade,

          createdAt:
            r.created_at,

          updatedAt:
            r.updated_at,
        };
      }
    );

  return res.status(200).json({
    sucesso: true,
    responsaveis,
  });
}

async function salvarResponsavel(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  if (!exigirAdmin(req, res)) {
    return;
  }

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

  const id =
    texto(
      body.id,
      140
    ) ||
    gerarId("resp");

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
          .filter(Boolean)
      : [];

  const capacidadeDiaria =
    Math.max(
      0,
      Math.min(
        50,
        Math.round(
          numero(
            body.capacidadeDiaria,
            3
          )
        )
      )
    );

  const perfil =
    texto(
      body.perfil,
      40
    ).toUpperCase() ||
    "ESPECIALISTA";

  const permissoes =
    normalizarPermissoes(
      perfil,
      body.permissoes
    );

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
        perfil,
        permissoes,
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
        ${perfil},
        ${JSON.stringify(
          permissoes
        )}::jsonb,
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

        perfil =
          EXCLUDED.perfil,

        permissoes =
          EXCLUDED.permissoes,

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
        perfil,
        permissoes,
        ativo,
        created_at,
        updated_at
    `;

  const responsavel =
    linhas?.[0];

  return res.status(200).json({
    sucesso: true,

    responsavel:
      responsavel
        ? {
            id:
              responsavel.id,

            nome:
              responsavel.nome,

            email:
              responsavel.email,

            telefone:
              responsavel.telefone,

            areas:
              Array.isArray(
                responsavel.areas
              )
                ? responsavel.areas
                : [],

            capacidadeDiaria:
              numero(
                responsavel.capacidade_diaria,
                0
              ),

            perfil:
              responsavel.perfil ||
              "ESPECIALISTA",

            permissoes:
              responsavel.permissoes ||
              permissoesPadrao(
                responsavel.perfil ||
                "ESPECIALISTA"
              ),

            ativo:
              Boolean(
                responsavel.ativo
              ),

            createdAt:
              responsavel.created_at,

            updatedAt:
              responsavel.updated_at,
          }
        : null,
  });
}


async function excluirLead(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  if (!exigirAdmin(req, res)) return;

  const body = req.body || {};

  const atendimentoId =
    texto(body.atendimentoId, 140);

  let leadId =
    texto(body.leadId, 140);

  let diagnosticoId =
    texto(body.diagnosticoId, 180);

  if (!atendimentoId && !leadId && !diagnosticoId) {
    return res.status(400).json({
      sucesso: false,
      error: "atendimentoId, leadId ou diagnosticoId é obrigatório.",
    });
  }

  if (atendimentoId) {
    const encontrados = await sql`
      SELECT id, lead_id, diagnostico_id
      FROM crm_atendimentos_departamento
      WHERE id = ${atendimentoId}
      LIMIT 1
    `;

    const atual = encontrados?.[0];

    if (atual) {
      leadId = leadId || atual.lead_id || "";
      diagnosticoId =
        diagnosticoId ||
        atual.diagnostico_id ||
        "";
    }
  }

  if (leadId && !diagnosticoId) {
    const leads = await sql`
      SELECT diagnostico_id
      FROM diagnostico_leads
      WHERE id = ${leadId}
      LIMIT 1
    `;

    diagnosticoId =
      leads?.[0]?.diagnostico_id ||
      "";
  }

  if (atendimentoId) {
    await sql`
      DELETE FROM crm_atendimento_historico
      WHERE atendimento_id = ${atendimentoId}
    `;
  }

  if (leadId || diagnosticoId) {
    await sql`
      DELETE FROM crm_atendimento_historico
      WHERE
        (${leadId} <> '' AND lead_id = ${leadId})
        OR
        (${diagnosticoId} <> '' AND diagnostico_id = ${diagnosticoId})
    `;
  }

  if (atendimentoId) {
    await sql`
      DELETE FROM crm_atendimentos_departamento
      WHERE id = ${atendimentoId}
    `;
  }

  if (leadId || diagnosticoId) {
    await sql`
      DELETE FROM crm_atendimentos_departamento
      WHERE
        (${leadId} <> '' AND lead_id = ${leadId})
        OR
        (${diagnosticoId} <> '' AND diagnostico_id = ${diagnosticoId})
    `;
  }

  if (leadId) {
    await sql`
      DELETE FROM crm_atribuicoes
      WHERE lead_id = ${leadId}
    `;

    await sql`
      DELETE FROM diagnostico_leads
      WHERE id = ${leadId}
    `;
  }

  if (diagnosticoId) {
    await sql`
      DELETE FROM diagnostico_leads
      WHERE diagnostico_id = ${diagnosticoId}
    `;
  }

  return res.status(200).json({
    sucesso: true,
    atendimentoId,
    leadId,
    diagnosticoId,
  });
}

async function excluirResponsavel(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ sucesso: false, error: "Método não permitido." });
  }
  if (!exigirAdmin(req, res)) return;

  const responsavelId = texto(req.body?.responsavelId, 140);
  if (!responsavelId) {
    return res.status(400).json({ sucesso: false, error: "responsavelId é obrigatório." });
  }

  const abertos = await sql`
    SELECT COUNT(*)::INTEGER AS total
    FROM crm_atendimentos_departamento
    WHERE responsavel_id = ${responsavelId}
      AND status_atendimento <> 'CONCLUIDO'
  `;
  const totalAbertos = numero(abertos?.[0]?.total, 0);

  if (totalAbertos > 0 && req.body?.forcar !== true) {
    return res.status(409).json({
      sucesso: false,
      possuiAtendimentosAbertos: true,
      totalAbertos,
      error: "Este membro possui atendimentos abertos.",
    });
  }

  if (req.body?.forcar === true) {
    await sql`
      UPDATE crm_atendimentos_departamento
      SET responsavel_id = '', updated_at = NOW()
      WHERE responsavel_id = ${responsavelId}
        AND status_atendimento <> 'CONCLUIDO'
    `;
  }

  await sql`
    UPDATE diagnostico_leads
    SET responsavel_finder = '', updated_at = NOW()
    WHERE responsavel_finder = ${responsavelId}
  `;
  await sql`DELETE FROM crm_atribuicoes WHERE responsavel_id = ${responsavelId}`;
  await sql`DELETE FROM crm_responsaveis WHERE id = ${responsavelId}`;

  return res.status(200).json({ sucesso: true, responsavelId });
}

async function atribuirLead(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  if (!exigirAdmin(req, res)) {
    return;
  }

  const body =
    req.body || {};

  const leadId =
    texto(
      body.leadId,
      140
    );

  const responsavelId =
    texto(
      body.responsavelId,
      140
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

  if (
    lead.responsavel_finder ===
    responsavelId
  ) {
    return res.status(200).json({
      sucesso: true,
      jaAtribuido: true,
      leadId,
      responsavel: {
        id:
          responsavel.id,
        nome:
          responsavel.nome,
      },
      statusComercial:
        lead.status_comercial,
    });
  }

  const hoje =
    await sql`
      SELECT
        COUNT(*)::INTEGER AS total

      FROM crm_atribuicoes

      WHERE
        responsavel_id =
          ${responsavelId}

        AND DATE(
          atribuido_em
          AT TIME ZONE
          'America/Sao_Paulo'
        ) =
        DATE(
          NOW()
          AT TIME ZONE
          'America/Sao_Paulo'
        )
    `;

  const atribuicoesHoje =
    numero(
      hoje?.[0]?.total,
      0
    );

  const capacidade =
    numero(
      responsavel.capacidade_diaria,
      0
    );

  if (
    capacidade > 0 &&
    atribuicoesHoje >=
      capacidade &&
    body.forcar !== true
  ) {
    return res.status(409).json({
      sucesso: false,
      lotado: true,

      error:
        "O responsável atingiu a capacidade diária configurada.",

      capacidadeDiaria:
        capacidade,

      atribuicoesHoje,
    });
  }

  const novoStatusComercial =
    lead.status_comercial ===
    "NOVO_LEAD"
      ? "A_CONTATAR"
      : lead.status_comercial;

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

    capacidadeDiaria:
      capacidade,

    atribuicoesHoje:
      atribuicoesHoje + 1,

    capacidadeDisponivelHoje:
      Math.max(
        0,
        capacidade -
        (
          atribuicoesHoje +
          1
        )
      ),
  });
}

// =========================================================
// HANDLER ÚNICO
// =========================================================

export default async function handler(req, res) {
  try {
    if (
      !process.env.DATABASE_URL
    ) {
      return res.status(500).json({
        sucesso: false,
        error:
          "DATABASE_URL não configurada.",
      });
    }

    await garantirSchema();

    const action =
      texto(
        req.query?.action,
        60
      ).toLowerCase();

    switch (action) {
      case "iniciar":
        return iniciarDiagnostico(
          req,
          res
        );

      case "atualizar":
        return atualizarLead(
          req,
          res
        );

      case "classificar":
        return classificarLead(
          req,
          res
        );

      case "listar-leads":
        return listarLeads(
          req,
          res
        );

      case "listar-responsaveis":
        return listarResponsaveis(
          req,
          res
        );

      case "salvar-responsavel":
        return salvarResponsavel(
          req,
          res
        );

      case "atribuir-lead":
        return atribuirLead(
          req,
          res
        );

      case "excluir-lead":
        return excluirLead(req, res);

      case "excluir-responsavel":
        return excluirResponsavel(req, res);

      case "criar-atendimentos":
        return criarAtendimentosDepartamento(
          req,
          res
        );

      case "dashboard":
        return dashboardHandler(
          req,
          res
        );

      case "listar-atendimentos":
        return listarAtendimentosDepartamento(
          req,
          res
        );

      case "atualizar-atendimento":
        return atualizarAtendimentoDepartamento(
          req,
          res
        );

      case "registrar-acionamento":
        return registrarAcionamento(
          req,
          res
        );

      case "listar-historico":
        return listarHistoricoAtendimento(
          req,
          res
        );

      default:
        return res.status(400).json({
          sucesso: false,

          error:
            "Ação CRM inválida.",

          acoesDisponiveis: [
            "iniciar",
            "atualizar",
            "classificar",
            "listar-leads",
            "listar-responsaveis",
            "salvar-responsavel",
            "atribuir-lead",
            "excluir-lead",
            "excluir-responsavel",
            "criar-atendimentos",
            "dashboard",
            "listar-atendimentos",
            "atualizar-atendimento",
            "registrar-acionamento",
            "listar-historico",
          ],
        });
    }
  } catch (error) {
    console.error(
      "[crm]",
      error
    );

    return res.status(500).json({
      sucesso: false,
      error:
        "Não foi possível processar a operação do CRM.",
    });
  }
}
