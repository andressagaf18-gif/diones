import { neon } from "@neondatabase/serverless";
import crypto from "crypto";

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
      Math.round(numero(valor, 0))
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
  const origem = texto(valor, 80).toLowerCase();

  return origem || "direto";
}

function statusDiagnosticoValido(valor) {
  const permitidos = [
    "ACESSOU",
    "EM_PREENCHIMENTO",
    "NAO_CONCLUIDO",
    "CONCLUIDO",
  ];

  const status = texto(valor, 50).toUpperCase();

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

  const status = texto(valor, 50).toUpperCase();

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
    ADD COLUMN IF NOT EXISTS score_comercial
    INTEGER NOT NULL DEFAULT 0
  `;

  await sql`
    ALTER TABLE diagnostico_leads
    ADD COLUMN IF NOT EXISTS prioridade_comercial
    TEXT NOT NULL DEFAULT ''
  `;

  await sql`
    ALTER TABLE diagnostico_leads
    ADD COLUMN IF NOT EXISTS temperatura_comercial
    TEXT NOT NULL DEFAULT ''
  `;

  await sql`
    ALTER TABLE diagnostico_leads
    ADD COLUMN IF NOT EXISTS proxima_acao
    TEXT NOT NULL DEFAULT ''
  `;

  await sql`
    ALTER TABLE diagnostico_leads
    ADD COLUMN IF NOT EXISTS prazo_atendimento
    TEXT NOT NULL DEFAULT ''
  `;

  await sql`
    ALTER TABLE diagnostico_leads
    ADD COLUMN IF NOT EXISTS motivos_prioridade
    JSONB NOT NULL DEFAULT '[]'::jsonb
  `;

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
    schemaPromise = prepararSchema().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  return schemaPromise;
}

// =========================================================
// AÇÃO: INICIAR DIAGNÓSTICO
// =========================================================

async function iniciarDiagnostico(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  const body = req.body || {};

  const origem = normalizarOrigem(
    body.origem ||
    body.utm_source
  );

  const campanha = texto(
    body.campanha ||
    body.utm_campaign,
    160
  );

  const promoter = texto(body.promoter, 80);
  const utmSource = texto(body.utm_source, 120);
  const utmMedium = texto(body.utm_medium, 120);
  const utmCampaign = texto(body.utm_campaign, 160);
  const utmContent = texto(body.utm_content, 160);
  const utmTerm = texto(body.utm_term, 160);
  const referrer = texto(body.referrer, 500);

  const sessionIdRecebido = texto(
    body.sessionId,
    140
  );

  if (sessionIdRecebido) {
    const existente = await sql`
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
      WHERE session_id = ${sessionIdRecebido}
      LIMIT 1
    `;

    if (existente?.[0]) {
      await sql`
        UPDATE diagnostico_leads
        SET
          ultima_atividade = NOW(),
          updated_at = NOW()
        WHERE session_id = ${sessionIdRecebido}
      `;

      return res.status(200).json({
        sucesso: true,
        existente: true,
        leadId: existente[0].id,
        sessionId: existente[0].session_id,
        origem: existente[0].origem,
        campanha: existente[0].campanha,
        promoter: existente[0].promoter,
        statusDiagnostico:
          existente[0].status_diagnostico,
        statusComercial:
          existente[0].status_comercial,
        primeiroAcesso:
          existente[0].primeiro_acesso,
      });
    }
  }

  const leadId = gerarId("lead");

  const sessionId =
    sessionIdRecebido ||
    gerarId("sessao");

  const linhas = await sql`
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

  const lead = linhas?.[0];

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
// AÇÃO: ATUALIZAR LEAD
// =========================================================

async function atualizarLead(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  const body = req.body || {};

  const leadId = texto(body.leadId, 140);
  const sessionId = texto(body.sessionId, 140);

  if (!leadId && !sessionId) {
    return res.status(400).json({
      sucesso: false,
      error:
        "leadId ou sessionId é obrigatório.",
    });
  }

  const existente = leadId
    ? await sql`
        SELECT *
        FROM diagnostico_leads
        WHERE id = ${leadId}
        LIMIT 1
      `
    : await sql`
        SELECT *
        FROM diagnostico_leads
        WHERE session_id = ${sessionId}
        LIMIT 1
      `;

  const atual = existente?.[0];

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
      error: "statusDiagnostico inválido.",
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
      error: "statusComercial inválido.",
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
      ? texto(body.razaoSocial, 250)
      : atual.razao_social;

  const etapaAtual =
    body.etapaAtual !== undefined
      ? texto(body.etapaAtual, 80)
      : atual.etapa_atual;

  const progressoPercentual =
    body.progressoPercentual !== undefined
      ? percentual(body.progressoPercentual)
      : atual.progresso_percentual;

  const diagnosticoId =
    body.diagnosticoId !== undefined
      ? texto(body.diagnosticoId, 180)
      : atual.diagnostico_id;

  const intencao =
    body.intencao !== undefined
      ? texto(body.intencao, 500)
      : atual.intencao;

  const responsavelFinder =
    body.responsavelFinder !== undefined
      ? texto(body.responsavelFinder, 180)
      : atual.responsavel_finder;

  const notaSatisfacao =
    body.notaSatisfacao !== undefined
      ? (
          Number.isInteger(
            Number(body.notaSatisfacao)
          ) &&
          Number(body.notaSatisfacao) >= 1 &&
          Number(body.notaSatisfacao) <= 5
            ? Number(body.notaSatisfacao)
            : null
        )
      : atual.nota_satisfacao;

  const linhas = await sql`
    UPDATE diagnostico_leads

    SET
      nome = ${nome},
      email = ${email},
      telefone = ${telefone},
      cnpj = ${cnpj},
      razao_social = ${razaoSocial},
      etapa_atual = ${etapaAtual},
      progresso_percentual = ${progressoPercentual},
      status_diagnostico = ${statusDiagnostico},
      status_comercial = ${statusComercial},
      diagnostico_id = ${diagnosticoId},
      nota_satisfacao = ${notaSatisfacao},
      intencao = ${intencao},
      responsavel_finder = ${responsavelFinder},
      ultima_atividade = NOW(),
      updated_at = NOW()

    WHERE id = ${atual.id}

    RETURNING *
  `;

  const lead = linhas?.[0];

  return res.status(200).json({
    sucesso: true,

    lead: lead
      ? {
          leadId: lead.id,
          sessionId: lead.session_id,
          origem: lead.origem,
          campanha: lead.campanha,
          promoter: lead.promoter,

          statusDiagnostico:
            lead.status_diagnostico,

          statusComercial:
            lead.status_comercial,

          nome: lead.nome,
          email: lead.email,
          telefone: lead.telefone,
          cnpj: lead.cnpj,
          razaoSocial: lead.razao_social,
          etapaAtual: lead.etapa_atual,

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

  const nivel = texto(
    nivelDiagnostico,
    80
  ).toUpperCase();

  const intencaoNormalizada = texto(
    intencao,
    500
  ).toLowerCase();

  const doresTexto =
    Array.isArray(dores)
      ? dores.join(" ").toLowerCase()
      : texto(dores, 1000).toLowerCase();

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

  if (nivel === "EMERGENCIAL") {
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

  const faturamento = numero(
    faturamentoAnual,
    0
  );

  if (faturamento >= 4800000) {
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
        doresTexto.includes(termo)
    );

  if (possuiDorPrioritaria) {
    score += 10;

    motivos.push(
      "Foram identificadas dores com potencial impacto financeiro, tributário ou comercial."
    );
  }

  const nota = numero(
    notaSatisfacao,
    0
  );

  if (nota === 5) {
    score += 5;

    motivos.push(
      "Cliente avaliou o diagnóstico com nota máxima."
    );
  } else if (nota === 4) {
    score += 3;
  }

  score = Math.max(
    0,
    Math.min(100, score)
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
  } else if (score >= 60) {
    prioridade = "B";
    temperatura = "ALTA";
    prazoAtendimento = "24_HORAS";
    proximaAcao = "AGENDAR_REUNIAO";
  } else if (score >= 40) {
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
    scoreComercial: score,
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

  const body = req.body || {};

  const leadId = texto(body.leadId, 140);
  const sessionId = texto(body.sessionId, 140);

  if (!leadId && !sessionId) {
    return res.status(400).json({
      sucesso: false,
      error:
        "leadId ou sessionId é obrigatório.",
    });
  }

  const linhas = leadId
    ? await sql`
        SELECT *
        FROM diagnostico_leads
        WHERE id = ${leadId}
        LIMIT 1
      `
    : await sql`
        SELECT *
        FROM diagnostico_leads
        WHERE session_id = ${sessionId}
        LIMIT 1
      `;

  const lead = linhas?.[0];

  if (!lead) {
    return res.status(404).json({
      sucesso: false,
      error: "Lead não encontrado.",
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

      updated_at = NOW()

    WHERE id = ${lead.id}
  `;

  return res.status(200).json({
    sucesso: true,

    leadId: lead.id,

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
  const nota = numero(
    lead.nota_satisfacao,
    0
  );

  const intencao = texto(
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
    leadId: lead.id,
    sessionId: lead.session_id,

    origem: lead.origem,
    campanha: lead.campanha,
    promoter: lead.promoter,

    statusDiagnostico:
      lead.status_diagnostico,

    statusComercial:
      lead.status_comercial,

    nome: lead.nome,
    email: lead.email,
    telefone: lead.telefone,
    cnpj: lead.cnpj,
    razaoSocial: lead.razao_social,

    etapaAtual:
      lead.etapa_atual,

    progressoPercentual:
      lead.progresso_percentual,

    diagnosticoId:
      lead.diagnostico_id,

    notaSatisfacao:
      lead.nota_satisfacao,

    intencao: lead.intencao,

    responsavelFinder:
      lead.responsavel_finder,

    scoreComercial:
      numero(
        lead.score_comercial,
        0
      ),

    prioridadeComercial:
      lead.prioridade_comercial || "",

    temperaturaComercial:
      lead.temperatura_comercial || "",

    proximaAcao:
      lead.proxima_acao || "",

    prazoAtendimento:
      lead.prazo_atendimento || "",

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
      temperaturaFallback(lead),
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

  const busca = texto(
    req.query?.busca,
    180
  );

  const origem = texto(
    req.query?.origem,
    80
  );

  const statusDiagnostico = texto(
    req.query?.statusDiagnostico,
    50
  ).toUpperCase();

  const statusComercial = texto(
    req.query?.statusComercial,
    50
  ).toUpperCase();

  const responsavelFinder = texto(
    req.query?.responsavelFinder,
    180
  );

  const prioridadeComercial = texto(
    req.query?.prioridadeComercial,
    10
  ).toUpperCase();

  const limite = Math.max(
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

  const linhas = await sql`
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
        OR nome ILIKE ${`%${busca}%`}
        OR email ILIKE ${`%${busca}%`}
        OR telefone ILIKE ${`%${busca}%`}
        OR cnpj ILIKE ${`%${busca}%`}
        OR razao_social ILIKE ${`%${busca}%`}
        OR campanha ILIKE ${`%${busca}%`}
      )

      AND (
        ${origem} = ''
        OR origem = ${origem}
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
      ? linhas.map(mapearLead)
      : [];

  const total = leads.length;

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
          lead.origem || "direto";

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
                (concluidos / total) *
                100
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
// LISTAR RESPONSÁVEIS
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

  const linhas = await sql`
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

      (
        SELECT COUNT(*)::INTEGER
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
        SELECT COUNT(*)::INTEGER
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

    WHERE r.ativo = TRUE

    ORDER BY r.nome ASC
  `;

  const responsaveis =
    (linhas || []).map((r) => {
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
        id: r.id,
        nome: r.nome,
        email: r.email,
        telefone: r.telefone,

        areas:
          Array.isArray(r.areas)
            ? r.areas
            : [],

        capacidadeDiaria:
          capacidade,

        ativo:
          Boolean(r.ativo),

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
          atribuicoesHoje >= capacidade,

        createdAt:
          r.created_at,

        updatedAt:
          r.updated_at,
      };
    });

  return res.status(200).json({
    sucesso: true,
    responsaveis,
  });
}

// =========================================================
// SALVAR RESPONSÁVEL
// =========================================================

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

  const body = req.body || {};

  const nome = texto(
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
    texto(body.id, 140) ||
    gerarId("resp");

  const email =
    texto(body.email, 220);

  const telefone =
    texto(body.telefone, 60);

  const areas =
    Array.isArray(body.areas)
      ? body.areas
          .map((item) =>
            texto(item, 120)
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

  const ativo =
    body.ativo === undefined
      ? true
      : Boolean(body.ativo);

  const linhas = await sql`
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
      ${JSON.stringify(areas)}::jsonb,
      ${capacidadeDiaria},
      ${ativo},
      NOW()
    )

    ON CONFLICT (id)

    DO UPDATE SET
      nome = EXCLUDED.nome,
      email = EXCLUDED.email,
      telefone = EXCLUDED.telefone,
      areas = EXCLUDED.areas,

      capacidade_diaria =
        EXCLUDED.capacidade_diaria,

      ativo = EXCLUDED.ativo,
      updated_at = NOW()

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
    linhas?.[0];

  return res.status(200).json({
    sucesso: true,

    responsavel:
      responsavel
        ? {
            id: responsavel.id,
            nome: responsavel.nome,
            email: responsavel.email,
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

// =========================================================
// ATRIBUIR LEAD
// =========================================================

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

  const body = req.body || {};

  const leadId =
    texto(body.leadId, 140);

  const responsavelId =
    texto(
      body.responsavelId,
      140
    );

  if (!leadId || !responsavelId) {
    return res.status(400).json({
      sucesso: false,

      error:
        "leadId e responsavelId são obrigatórios.",
    });
  }

  const leads = await sql`
    SELECT
      id,
      responsavel_finder,
      status_comercial

    FROM diagnostico_leads

    WHERE id = ${leadId}

    LIMIT 1
  `;

  const lead = leads?.[0];

  if (!lead) {
    return res.status(404).json({
      sucesso: false,
      error: "Lead não encontrado.",
    });
  }

  const responsaveis = await sql`
    SELECT
      id,
      nome,
      capacidade_diaria,
      ativo

    FROM crm_responsaveis

    WHERE id = ${responsavelId}

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
        id: responsavel.id,
        nome: responsavel.nome,
      },

      statusComercial:
        lead.status_comercial,
    });
  }

  const hoje = await sql`
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
    atribuicoesHoje >= capacidade &&
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

      updated_at = NOW()

    WHERE id = ${leadId}
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
      id: responsavel.id,
      nome: responsavel.nome,
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
        (atribuicoesHoje + 1)
      ),
  });
}

// =========================================================
// HANDLER ÚNICO DO CRM
// =========================================================

export default async function handler(req, res) {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        sucesso: false,

        error:
          "DATABASE_URL não configurada.",
      });
    }

    await garantirSchema();

    const action = texto(
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
