// server/higiene-dados.js
// Finder — higiene dos dados e recuperação de abandono.
//
// Fica em server/ (não em api/) para NÃO consumir uma função serverless: é servido
// por api/crm.js nas ações "higiene" (painel do administrador) e "higiene-cron"
// (rotinas automáticas da Vercel).
//
// O que faz:
//  1. LIMPEZA: arquiva (nunca exclui) leads de teste e leads incompletos parados há
//     mais de 7 dias, e marca como "teste" as cobranças ligadas a leads de teste, para
//     que dashboard e financeiro mostrem só dados reais. Tudo é reversível
//     (desarquivar o lead no CRM). Leads com cobrança paga real ou com atendimento
//     comercial avançado nunca são arquivados pela rotina automática.
//  2. ABANDONO: e-mail único de retomada para quem informou o contato e parou no meio
//     do diagnóstico. Só envia com aceite dos termos registrado, e-mail válido, uma vez
//     por lead e dentro de uma janela de tempo. A rotina automática só envia se a
//     variável RECUPERACAO_ABANDONO_ATIVA=true estiver configurada.

import { neon } from "@neondatabase/serverless";
import { exigirAutenticacao } from "./auth.js";

const sql = neon(process.env.DATABASE_URL);

const PAGO = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];
const DIAS_INCOMPLETO = 7;
const MAX_ENVIOS_POR_RODADA = 30;

const ROTULOS_ETAPA = {
  intro: "início",
  cadastro: "seus dados",
  estrutura: "estrutura do negócio",
  simuladorreforma: "simulador da reforma",
  cnpj: "dados da empresa",
  porte: "porte da empresa",
  reforma_detalhes: "detalhes da reforma",
  dor: "principais dores",
  gerandoperguntas: "perguntas",
  confirmarnegocio: "confirmação do negócio",
  checklist: "perguntas por área",
  analisando: "análise",
};

function texto(v, limite = 200) {
  return v === null || v === undefined ? "" : String(v).trim().slice(0, limite);
}

function enviar(res, status, corpo) {
  return res.status(status).json(corpo);
}

function emailValido(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim());
}

function escapar(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function primeiroNome(nome) {
  const p = texto(nome, 80).split(/\s+/)[0] || "";
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : "";
}

export function rotuloEtapa(etapa) {
  return ROTULOS_ETAPA[String(etapa || "").toLowerCase().replace(/[^a-z_]/g, "")] || "";
}

export function montarEmailAbandono({ nome, etapa, progresso, link }) {
  const n = primeiroNome(nome);
  const rotulo = rotuloEtapa(etapa);
  const avanco = Number(progresso) > 0 ? `Você já completou cerca de ${Math.min(95, Math.round(Number(progresso)))}%` : "Você já começou";
  const onde = rotulo ? ` e parou na etapa "${rotulo}"` : "";
  const assunto = `${n ? `${n}, f` : "F"}alta pouco para ver o resultado da sua empresa`;
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F2F5FA;font-family:Arial,Helvetica,sans-serif;color:#17233D">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
<div style="background:#fff;border-radius:14px;padding:26px 24px;border:1px solid #E3E7EF">
<p style="font-size:11px;letter-spacing:.08em;font-weight:700;color:#FF6B4A;margin:0 0 10px">FINDER OF SOLUTIONS</p>
<h1 style="font-size:20px;line-height:1.25;margin:0 0 12px">${n ? `${escapar(n)}, ` : ""}falta pouco para ver o resultado da sua empresa</h1>
<p style="font-size:14px;line-height:1.55;margin:0 0 12px">${escapar(avanco)} do seu diagnóstico${escapar(onde)}. Não deixe para a última hora: retome agora e veja onde sua empresa pode estar pagando imposto demais. São apenas alguns minutinhos.</p>
<p style="margin:18px 0"><a href="${escapar(link)}" style="background:#FF6B4A;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:10px;display:inline-block">Continuar meu diagnóstico</a></p>
<p style="font-size:11.5px;color:#5B667A;line-height:1.5;margin:18px 0 0">Você recebeu este e-mail porque iniciou um diagnóstico em nosso site. Este é um lembrete único. Se não quiser ser contatado, é só responder a este e-mail.</p>
</div></div></body></html>`;
  const textoPuro = `${n ? `${n}, f` : "F"}alta pouco para ver o resultado da sua empresa.\n\n${avanco} do seu diagnóstico${onde}. Retome agora, são apenas alguns minutinhos: ${link}\n\nLembrete único. Se não quiser ser contatado, responda este e-mail.`;
  return { assunto, html, texto: textoPuro };
}

// Padrão de dados de teste (nome, razão social ou e-mail).
const SQL_TESTE = `(
  LOWER(COALESCE(l.nome,'') || ' ' || COALESCE(l.razao_social,'') || ' ' || COALESCE(l.email,'')) ~ '(^|[^a-z])(teste|testes|testando|test|fake|exemplo|asdf)([^a-z]|$)'
  OR LOWER(COALESCE(l.email,'')) LIKE '%@example.%'
)`;

async function garantirColunas() {
  await sql`ALTER TABLE diagnostico_leads ADD COLUMN IF NOT EXISTS teste BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE diagnostico_leads ADD COLUMN IF NOT EXISTS recuperacao_enviada_em TIMESTAMPTZ`;
  await sql`ALTER TABLE diagnostico_leads ADD COLUMN IF NOT EXISTS arquivado_motivo TEXT`;
  await sql`ALTER TABLE diagnostico_leads ADD COLUMN IF NOT EXISTS consentimento JSONB`;
  try {
    await sql`ALTER TABLE asaas_pagamentos ADD COLUMN IF NOT EXISTS teste BOOLEAN NOT NULL DEFAULT FALSE`;
  } catch {
    /* tabela do Asaas ainda não existe: nada a marcar */
  }
  await sql`
    CREATE TABLE IF NOT EXISTS higiene_execucoes (
      id BIGSERIAL PRIMARY KEY,
      tipo TEXT NOT NULL,
      simulado BOOLEAN NOT NULL DEFAULT FALSE,
      origem TEXT NOT NULL DEFAULT '',
      resumo JSONB NOT NULL DEFAULT '{}'::jsonb,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function registrar(tipo, simulado, origem, resumo) {
  try {
    await sql`INSERT INTO higiene_execucoes (tipo, simulado, origem, resumo) VALUES (${tipo}, ${simulado}, ${origem}, ${JSON.stringify(resumo)}::jsonb)`;
  } catch {
    /* histórico é opcional */
  }
}

// ---------------------------------------------------------
// LIMPEZA
// ---------------------------------------------------------
async function candidatos({ antesDe, incluirIncompletos, dias, manual }) {
  const corte = antesDe ? new Date(antesDe).toISOString() : null;
  // Rotina automática: nunca arquiva lead com pagamento real confirmado nem com atendimento comercial avançado.
  const linhas = await sql.query(
    `SELECT l.id, l.diagnostico_id, l.nome, l.razao_social, l.email, l.origem, l.created_at,
        l.status_diagnostico, l.status_comercial,
        (${SQL_TESTE}) AS padrao_teste,
        ($1::timestamptz IS NOT NULL AND l.created_at < $1::timestamptz) AS antes_do_corte,
        EXISTS (
          SELECT 1 FROM asaas_pagamentos p
          WHERE ((l.diagnostico_id <> '' AND p.diagnostico_id = l.diagnostico_id) OR p.diagnostico_id = 'simulador:' || l.id)
            AND p.status = ANY($4::text[]) AND COALESCE(p.teste, FALSE) = FALSE
        ) AS pago_real,
        (COALESCE(l.status_comercial,'') NOT IN ('', 'NOVO_LEAD')) AS comercial_avancado
     FROM diagnostico_leads l
     WHERE COALESCE(l.arquivado, FALSE) = FALSE
       AND (
         ${SQL_TESTE}
         OR ($1::timestamptz IS NOT NULL AND l.created_at < $1::timestamptz)
         OR ($2::boolean AND l.status_diagnostico <> 'CONCLUIDO' AND COALESCE(l.diagnostico_id,'') = ''
             AND GREATEST(l.ultima_atividade, l.updated_at) < NOW() - ($3::int || ' days')::interval)
       )
     ORDER BY l.created_at DESC
     LIMIT 2000`,
    [corte, Boolean(incluirIncompletos), Number(dias) || DIAS_INCOMPLETO, PAGO]
  );
  return (linhas || [])
    .filter((l) => manual || (!l.pago_real && !l.comercial_avancado))
    .map((l) => ({
      id: l.id,
      diagnosticoId: l.diagnostico_id || "",
      nome: l.razao_social || l.nome || "Sem identificação",
      origem: l.origem || "direto",
      criadoEm: l.created_at,
      motivo: l.padrao_teste || l.antes_do_corte ? "teste" : "incompleto",
      pagoReal: Boolean(l.pago_real),
      comercialAvancado: Boolean(l.comercial_avancado),
    }));
}

async function arquivarLeads(lista, origem) {
  if (!lista.length) return { arquivados: 0, testes: 0, pagamentosMarcados: 0 };
  const ids = lista.map((l) => l.id);
  const idsTeste = lista.filter((l) => l.motivo === "teste").map((l) => l.id);

  const rows = await sql`
    UPDATE diagnostico_leads
    SET arquivado = TRUE, arquivado_em = NOW(),
        arquivado_motivo = ${`higiene:${origem}`},
        teste = (teste OR id = ANY(${idsTeste})),
        updated_at = NOW()
    WHERE id = ANY(${ids}) AND COALESCE(arquivado, FALSE) = FALSE
    RETURNING id, diagnostico_id
  `;
  const diagIds = (rows || []).map((r) => r.diagnostico_id).filter(Boolean);
  const leadIds = (rows || []).map((r) => r.id);

  try {
    await sql`
      UPDATE crm_atendimentos_departamento
      SET arquivado = TRUE, arquivado_em = NOW(), updated_at = NOW()
      WHERE lead_id = ANY(${leadIds}) OR (diagnostico_id <> '' AND diagnostico_id = ANY(${diagIds}))
    `;
  } catch {
    /* tabela de atendimentos pode não existir ainda */
  }
  if (diagIds.length) {
    try {
      await sql`UPDATE diagnosticos SET arquivado = TRUE, arquivado_em = NOW() WHERE id::text = ANY(${diagIds})`;
    } catch {
      /* ignora */
    }
  }

  let pagamentosMarcados = 0;
  if (idsTeste.length) {
    try {
      const diagTeste = (rows || []).filter((r) => idsTeste.includes(r.id)).map((r) => r.diagnostico_id).filter(Boolean);
      const refsSim = idsTeste.map((id) => `simulador:${id}`);
      const marc = await sql`
        UPDATE asaas_pagamentos SET teste = TRUE
        WHERE COALESCE(teste, FALSE) = FALSE AND (diagnostico_id = ANY(${diagTeste}) OR diagnostico_id = ANY(${refsSim}))
        RETURNING payment_id
      `;
      pagamentosMarcados = (marc || []).length;
    } catch {
      /* sem tabela do Asaas */
    }
  }
  return { arquivados: leadIds.length, testes: idsTeste.length, pagamentosMarcados };
}

export async function executarLimpeza({ simular = true, antesDe = null, incluirIncompletos = true, dias = DIAS_INCOMPLETO, manual = false, origem = "manual" } = {}) {
  await garantirColunas();
  const lista = await candidatos({ antesDe, incluirIncompletos, dias, manual });
  const base = {
    simulado: Boolean(simular),
    candidatos: lista.length,
    testes: lista.filter((l) => l.motivo === "teste").length,
    incompletos: lista.filter((l) => l.motivo === "incompleto").length,
    comPagamentoReal: lista.filter((l) => l.pagoReal).length,
    amostra: lista.slice(0, 15),
  };
  if (simular) return base;
  const r = await arquivarLeads(lista, origem);
  const saida = { ...base, ...r };
  await registrar("limpeza", false, origem, { antesDe, incluirIncompletos, dias, ...r });
  return saida;
}

// ---------------------------------------------------------
// ABANDONO
// ---------------------------------------------------------
function janelaAbandono() {
  const min = Math.max(1, Number(process.env.RECUPERACAO_MIN_HORAS) || 2);
  const max = Math.max(min + 1, Number(process.env.RECUPERACAO_MAX_HORAS) || 48);
  return { min, max };
}

async function elegiveisAbandono() {
  const { min, max } = janelaAbandono();
  const linhas = await sql.query(
    `SELECT l.id, l.nome, l.email, l.etapa_atual, l.progresso_percentual, l.origem
     FROM diagnostico_leads l
     WHERE COALESCE(l.arquivado, FALSE) = FALSE AND COALESCE(l.teste, FALSE) = FALSE
       AND l.status_diagnostico <> 'CONCLUIDO' AND COALESCE(l.diagnostico_id,'') = ''
       AND l.recuperacao_enviada_em IS NULL
       AND COALESCE(l.email,'') <> '' AND l.consentimento IS NOT NULL
       AND GREATEST(l.ultima_atividade, l.updated_at) BETWEEN NOW() - ($2::int || ' hours')::interval AND NOW() - ($1::int || ' hours')::interval
       AND NOT ${SQL_TESTE}
       AND NOT EXISTS (
         SELECT 1 FROM diagnostico_leads o
         WHERE LOWER(o.email) = LOWER(l.email) AND o.id <> l.id
           AND (o.status_diagnostico = 'CONCLUIDO' OR COALESCE(o.diagnostico_id,'') <> '')
       )
     ORDER BY l.ultima_atividade DESC
     LIMIT $3`,
    [min, max, MAX_ENVIOS_POR_RODADA]
  );
  return (linhas || []).filter((l) => emailValido(l.email));
}

async function enviarEmail({ para, assunto, html, texto: corpoTexto }) {
  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RELATORIO_EMAIL_REMETENTE || "Finder of Solutions <onboarding@resend.dev>",
      to: [para],
      reply_to: process.env.RELATORIO_EMAIL_DESTINO || "contato@finderofsolutions.com.br",
      subject: assunto,
      html,
      text: corpoTexto,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!resposta.ok) {
    const d = await resposta.json().catch(() => null);
    throw new Error(d?.message || d?.error?.message || `Resend HTTP ${resposta.status}`);
  }
}

export async function executarAbandono({ simular = true, origem = "manual" } = {}) {
  await garantirColunas();
  const lista = await elegiveisAbandono();
  const site = String(process.env.SITE_URL || "https://diagnosticofinderofsolutions.vercel.app").replace(/\/+$/, "");
  const saida = {
    simulado: Boolean(simular),
    janelaHoras: janelaAbandono(),
    elegiveis: lista.length,
    enviados: 0,
    falhas: 0,
    amostra: lista.slice(0, 10).map((l) => ({ id: l.id, nome: primeiroNome(l.nome), etapa: rotuloEtapa(l.etapa_atual), progresso: l.progresso_percentual })),
  };
  if (simular) return saida;
  if (!process.env.RESEND_API_KEY) {
    return { ...saida, erro: "RESEND_API_KEY não configurada: nenhum e-mail foi enviado." };
  }
  for (const l of lista) {
    try {
      const msg = montarEmailAbandono({ nome: l.nome, etapa: l.etapa_atual, progresso: l.progresso_percentual, link: `${site}/diagnostico` });
      await enviarEmail({ para: l.email, ...msg });
      await sql`UPDATE diagnostico_leads SET recuperacao_enviada_em = NOW() WHERE id = ${l.id}`;
      saida.enviados += 1;
    } catch (erro) {
      saida.falhas += 1;
      console.error("[higiene] abandono:", l.id, erro?.message || erro);
    }
  }
  await registrar("abandono", false, origem, { enviados: saida.enviados, falhas: saida.falhas });
  return saida;
}

// ---------------------------------------------------------
// RESUMO (painel)
// ---------------------------------------------------------
async function resumo() {
  await garantirColunas();
  const [l] = await sql`
    SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE COALESCE(arquivado,FALSE) = FALSE)::int AS ativos,
      COUNT(*) FILTER (WHERE COALESCE(arquivado,FALSE) = TRUE)::int AS arquivados,
      COUNT(*) FILTER (WHERE COALESCE(arquivado,FALSE) = FALSE AND (COALESCE(email,'') <> '' OR COALESCE(telefone,'') <> ''))::int AS com_contato,
      COUNT(*) FILTER (WHERE COALESCE(arquivado,FALSE) = FALSE AND (status_diagnostico = 'CONCLUIDO' OR COALESCE(diagnostico_id,'') <> ''))::int AS concluidos,
      COUNT(*) FILTER (WHERE recuperacao_enviada_em > NOW() - INTERVAL '7 days')::int AS recuperacao_7d
    FROM diagnostico_leads
  `;
  let pagos = 0;
  let fin = { real: { recebidos: 0, bruto: 0, liquido: 0 }, teste: { recebidos: 0, bruto: 0, liquido: 0, cobrancas: 0 } };
  try {
    const [pl] = await sql`
      SELECT COUNT(DISTINCT p.diagnostico_id) FILTER (WHERE p.status = ANY(${PAGO}) AND COALESCE(p.teste,FALSE) = FALSE)::int AS pagantes FROM asaas_pagamentos p
    `;
    pagos = pl?.pagantes || 0;
    const [f] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = ANY(${PAGO}) AND COALESCE(teste,FALSE) = FALSE)::int AS r_rec,
        COALESCE(SUM(valor) FILTER (WHERE status = ANY(${PAGO}) AND COALESCE(teste,FALSE) = FALSE),0) AS r_bruto,
        COALESCE(SUM(COALESCE(valor_liquido,valor)) FILTER (WHERE status = ANY(${PAGO}) AND COALESCE(teste,FALSE) = FALSE),0) AS r_liq,
        COUNT(*) FILTER (WHERE status = ANY(${PAGO}) AND COALESCE(teste,FALSE) = TRUE)::int AS t_rec,
        COALESCE(SUM(valor) FILTER (WHERE status = ANY(${PAGO}) AND COALESCE(teste,FALSE) = TRUE),0) AS t_bruto,
        COALESCE(SUM(COALESCE(valor_liquido,valor)) FILTER (WHERE status = ANY(${PAGO}) AND COALESCE(teste,FALSE) = TRUE),0) AS t_liq,
        COUNT(*) FILTER (WHERE COALESCE(teste,FALSE) = TRUE)::int AS t_total
      FROM asaas_pagamentos
    `;
    fin = {
      real: { recebidos: f.r_rec, bruto: Number(f.r_bruto), liquido: Number(f.r_liq) },
      teste: { recebidos: f.t_rec, bruto: Number(f.t_bruto), liquido: Number(f.t_liq), cobrancas: f.t_total },
    };
  } catch {
    /* sem tabela do Asaas */
  }
  const sugestao = await executarLimpeza({ simular: true });
  const aband = await executarAbandono({ simular: true });
  let ultimas = [];
  try {
    ultimas = await sql`SELECT tipo, simulado, origem, resumo, criado_em FROM higiene_execucoes ORDER BY criado_em DESC LIMIT 6`;
  } catch {
    /* ignora */
  }
  return {
    funil: {
      acessaram: l.ativos,
      informaramContato: l.com_contato,
      concluiram: l.concluidos,
      pagaram: pagos,
    },
    leads: { total: l.total, ativos: l.ativos, arquivados: l.arquivados },
    financeiro: fin,
    limpezaSugerida: sugestao,
    abandono: {
      ativoNaRotina: String(process.env.RECUPERACAO_ABANDONO_ATIVA || "").toLowerCase() === "true",
      enviadosUltimos7Dias: l.recuperacao_7d,
      elegiveisAgora: aband.elegiveis,
      janelaHoras: aband.janelaHoras,
      amostra: aband.amostra,
    },
    cronConfigurado: Boolean(process.env.CRON_SECRET),
    ultimasExecucoes: ultimas,
  };
}

// ---------------------------------------------------------
// HANDLER
// ---------------------------------------------------------
function dataValida(v) {
  const t = texto(v, 40);
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default async function handler(req, res) {
  try {
    const action = texto(req.query?.action, 40).toLowerCase();

    if (action === "higiene-cron") {
      const segredo = process.env.CRON_SECRET || "";
      const enviado = String(req.headers?.authorization || "");
      if (!segredo || enviado !== `Bearer ${segredo}`) {
        return enviar(res, 401, { sucesso: false, error: "Não autorizado." });
      }
      const tarefa = texto(req.query?.tarefa, 20).toLowerCase();
      if (tarefa === "abandono") {
        const ativa = String(process.env.RECUPERACAO_ABANDONO_ATIVA || "").toLowerCase() === "true";
        if (!ativa) return enviar(res, 200, { sucesso: true, ignorado: "RECUPERACAO_ABANDONO_ATIVA não está ligada." });
        return enviar(res, 200, { sucesso: true, abandono: await executarAbandono({ simular: false, origem: "cron" }) });
      }
      return enviar(res, 200, { sucesso: true, limpeza: await executarLimpeza({ simular: false, origem: "cron" }) });
    }

    const usuario = exigirAutenticacao(req, res, { admin: true });
    if (!usuario) return;

    if (req.method === "GET") {
      return enviar(res, 200, { sucesso: true, ...(await resumo()) });
    }

    if (req.method === "POST") {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const tarefa = texto(body.tarefa, 20).toLowerCase() || "limpeza";
      const simular = body.executar !== true;
      if (tarefa === "abandono") {
        return enviar(res, 200, { sucesso: true, abandono: await executarAbandono({ simular, origem: "manual" }) });
      }
      const antesDe = dataValida(body.antesDe);
      return enviar(res, 200, {
        sucesso: true,
        limpeza: await executarLimpeza({
          simular,
          antesDe,
          incluirIncompletos: body.incluirIncompletos !== false,
          manual: Boolean(antesDe),
          origem: "manual",
        }),
      });
    }

    return enviar(res, 405, { sucesso: false, error: "Método não permitido." });
  } catch (erro) {
    console.error("[higiene-dados]", erro?.message || erro);
    return enviar(res, 500, { sucesso: false, error: "Não foi possível concluir a operação de higiene de dados." });
  }
}
