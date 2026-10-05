// server/dashboard-visao.js
// Dashboard — VISÃO COMPLETA DO SISTEMA (complemento do dashboard-engine.js).
//
// Reúne o que o dashboard comercial não mede: aceite LGPD, análise consultiva,
// planos 30/60/90 por área, atendimento por área, clientes, agenda, checkout e
// auditoria. Cada bloco roda isolado: se uma consulta falhar, só aquele bloco
// fica vazio e entra em "avisos" — o painel nunca cai por causa de um bloco.
//
// Fica em server/ (e é roteado por api/crm.js) para NÃO consumir uma função
// serverless — o plano da Vercel limita a 12.

import { neon } from "@neondatabase/serverless";
import { usuarioAutenticado } from "./auth.js";
import { normalizarEstrutura, ESTRUTURAS } from "./diagnostic-engine.js";

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

const FUSO = "America/Sao_Paulo";

// ---------------------------------------------------------
// UTILITÁRIOS PUROS
// ---------------------------------------------------------
export function num(v, padrao = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : padrao;
}

export function canon(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const arred = (v) => Math.round(num(v) * 100) / 100;
const pct = (parte, todo) => (num(todo) > 0 ? Math.round((num(parte) / num(todo)) * 100) : null);

export function diasEntre(deIso, ateMs = Date.now()) {
  const t = new Date(deIso).getTime();
  if (!deIso || Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((ateMs - t) / 86400000));
}

export function plural(n, singular, pluralTxt) {
  return `${n} ${n === 1 ? singular : pluralTxt}`;
}

// Por que um lead novo está sem aceite registrado.
export function motivoSemAceite({ diagTemAceite, nome, razaoSocial, etapa }) {
  if (diagTemAceite) return "aceite_so_no_envio";
  const semIdentificacao = !String(nome || "").trim() && !String(razaoSocial || "").trim();
  if (semIdentificacao && ["intro", ""].includes(String(etapa || "").toLowerCase())) return "saiu_antes_de_aceitar";
  return "sem_registro";
}

export function resumirPlanos(linhas) {
  const t = { total: 0, concluidas: 0, andamento: 0, bloqueadas: 0 };
  for (const r of Array.isArray(linhas) ? linhas : []) {
    t.total += num(r.plano_total);
    t.concluidas += num(r.plano_concluidas);
    t.andamento += num(r.plano_andamento);
    t.bloqueadas += num(r.plano_bloqueadas);
  }
  return { ...t, percentual: pct(t.concluidas, t.total) };
}

export function atrasosDe(linhas, agora = Date.now()) {
  const itens = [];
  for (const r of Array.isArray(linhas) ? linhas : []) {
    if (!r.proximo_contato || r.status_atendimento === "CONCLUIDO") continue;
    const t = new Date(r.proximo_contato).getTime();
    if (Number.isNaN(t) || t >= agora) continue;
    itens.push({
      id: r.id,
      empresa: r.razao_social || r.nome || "Lead sem identificação",
      area: r.area || "",
      responsavelId: r.responsavel_id || "",
      dias: Math.max(0, Math.floor((agora - t) / 86400000)),
    });
  }
  itens.sort((a, b) => b.dias - a.dias);
  return itens;
}

export function agruparAreas(linhas, propostasPorArea = [], agora = Date.now()) {
  const grupos = new Map();
  for (const r of Array.isArray(linhas) ? linhas : []) {
    const chave = canon(r.area);
    if (!chave) continue;
    if (!grupos.has(chave)) grupos.set(chave, { area: r.area, linhas: [] });
    grupos.get(chave).linhas.push(r);
  }
  const props = new Map((Array.isArray(propostasPorArea) ? propostasPorArea : []).map((p) => [canon(p.area), p]));

  return [...grupos.entries()]
    .map(([chave, g]) => {
      const abertas = g.linhas.filter((r) => r.status_atendimento !== "CONCLUIDO");
      const base = abertas.length ? abertas : g.linhas;
      const notas = base.map((r) => r.score_area).filter((v) => v !== null && v !== undefined && Number.isFinite(Number(v))).map(Number);
      const plano = resumirPlanos(g.linhas);
      const p = props.get(chave) || {};
      return {
        area: g.area,
        abertos: abertas.length,
        notaMedia: notas.length ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : null,
        planoTotal: plano.total,
        planoConcluidas: plano.concluidas,
        planoPercentual: plano.percentual,
        bloqueadas: plano.bloqueadas,
        atrasados: atrasosDe(g.linhas, agora).length,
        propostas: num(p.abertas),
        ganhas: num(p.ganhas),
        receitaGanha: arred(p.receita),
      };
    })
    .sort((a, b) => b.abertos - a.abertos || String(a.area).localeCompare(String(b.area), "pt-BR"));
}

export function consolidarCasos(linhas) {
  const mapa = new Map();
  for (const r of Array.isArray(linhas) ? linhas : []) {
    const id = normalizarEstrutura(r.estrutura);
    if (!mapa.has(id)) mapa.set(id, { estrutura: id, rotulo: ESTRUTURAS[id]?.label || id, total: 0, somaNotas: 0, comNota: 0, oportunidades: 0, comAnalise: 0 });
    const m = mapa.get(id);
    const total = num(r.total);
    m.total += total;
    if (r.nota !== null && r.nota !== undefined && Number.isFinite(Number(r.nota))) {
      m.somaNotas += Number(r.nota) * total;
      m.comNota += total;
    }
    m.oportunidades += num(r.oportunidades);
    m.comAnalise += num(r.com_analise);
  }
  return [...mapa.values()]
    .map((m) => ({
      estrutura: m.estrutura,
      rotulo: m.rotulo,
      total: m.total,
      notaMedia: m.comNota ? Math.round(m.somaNotas / m.comNota) : null,
      oportunidades: m.oportunidades,
      comAnalise: m.comAnalise,
    }))
    .sort((a, b) => b.total - a.total);
}

const ORDEM_NIVEL = { critico: 0, atencao: 1, info: 2 };

export function montarAtencao({ atrasos = { total: 0, lista: [] }, bloqueadas = 0, motivosBloqueio = [], semAnalise = { total: 0, lista: [] }, semAceite24h = 0, haRegistroLgpd = false }) {
  const itens = [];
  const totalAtrasos = num(atrasos.total);

  if (totalAtrasos > 0) {
    const lista = atrasos.lista || [];
    const exemplos = lista.slice(0, 2).map((a) => `${a.empresa}${a.area ? ` (${a.area})` : ""}`).join(", ");
    const mais = totalAtrasos > 2 ? ` e mais ${totalAtrasos - 2}` : "";
    itens.push({
      id: "contatos_atrasados",
      nivel: "critico",
      titulo: plural(totalAtrasos, "contato em atraso", "contatos em atraso"),
      detalhe: `${exemplos}${mais} · o mais antigo há ${plural(num(lista[0]?.dias), "dia", "dias")}`,
      destino: { aba: "atendimento", filtro: "atraso" },
      rotuloAcao: "Abrir fila",
    });
  }

  if (num(bloqueadas) > 0) {
    const top = motivosBloqueio[0];
    itens.push({
      id: "acoes_bloqueadas",
      nivel: "critico",
      titulo: `${plural(num(bloqueadas), "ação bloqueada nos planos", "ações bloqueadas nos planos")}`,
      detalhe: top ? `Motivo mais citado: “${top.motivo}” (${top.total})` : "Nenhum motivo foi registrado nas ações bloqueadas",
      destino: { aba: "atendimento", filtro: "bloqueada" },
      rotuloAcao: "Ver ações",
    });
  }

  if (num(semAnalise.total) > 0) {
    const nomes = (semAnalise.lista || []).slice(0, 2).map((l) => l.empresa).join(", ");
    const mais = semAnalise.total > 2 ? ` e mais ${semAnalise.total - 2}` : "";
    itens.push({
      id: "sem_analise",
      nivel: "atencao",
      titulo: `${plural(num(semAnalise.total), "diagnóstico de prioridade A/B sem análise consultiva", "diagnósticos de prioridade A/B sem análise consultiva")}`,
      detalhe: nomes ? `${nomes}${mais}` : "Gere a análise para o consultor chegar preparado à reunião",
      destino: { aba: "diagnosticos", filtro: "sem_analise" },
      rotuloAcao: "Ver diagnósticos",
    });
  }

  if (haRegistroLgpd && num(semAceite24h) > 0) {
    itens.push({
      id: "sem_aceite_24h",
      nivel: "atencao",
      titulo: `${plural(num(semAceite24h), "lead novo sem aceite dos termos registrado", "leads novos sem aceite dos termos registrado")}`,
      detalhe: "Nas últimas 24h · vale investigar se há falha no registro",
      destino: { aba: "lgpd" },
      rotuloAcao: "Ver leads",
    });
  }

  return itens.sort((a, b) => ORDEM_NIVEL[a.nivel] - ORDEM_NIVEL[b.nivel]);
}

// Série de N dias (do mais antigo ao mais recente) preenchendo os dias sem lead.
export function serieDiaria(linhas, dias = 14, hojeIso = null, inicioRegistroDia = null) {
  const mapa = new Map((Array.isArray(linhas) ? linhas : []).map((r) => [r.dia, r]));
  const fim = hojeIso ? new Date(`${hojeIso}T12:00:00Z`) : new Date();
  const saida = [];
  for (let i = dias - 1; i >= 0; i -= 1) {
    const d = new Date(fim.getTime() - i * 86400000).toISOString().slice(0, 10);
    const r = mapa.get(d) || {};
    saida.push({ dia: d, com: num(r.com), sem: num(r.sem), antesDoRegistro: Boolean(inicioRegistroDia && d < inicioRegistroDia) });
  }
  return saida;
}

// ---------------------------------------------------------
// CONSULTAS (cada uma isolada)
// ---------------------------------------------------------
async function segura(avisos, nome, fn, fallback) {
  try {
    return await fn();
  } catch (erro) {
    avisos.push(nome);
    console.warn(`[dashboard-visao] bloco "${nome}" indisponível:`, erro?.message || erro);
    return fallback;
  }
}

async function garantirColunas(db) {
  const passos = [
    () => db`ALTER TABLE diagnostico_leads ADD COLUMN IF NOT EXISTS consentimento JSONB`,
    () => db`ALTER TABLE diagnosticos ADD COLUMN IF NOT EXISTS consentimento JSONB`,
    () => db`ALTER TABLE diagnosticos ADD COLUMN IF NOT EXISTS visao_consultiva JSONB`,
    () => db`ALTER TABLE crm_atendimentos_departamento ADD COLUMN IF NOT EXISTS plano_execucao JSONB NOT NULL DEFAULT '[]'::jsonb`,
    () => db`ALTER TABLE crm_atendimentos_departamento ADD COLUMN IF NOT EXISTS ficha_area JSONB NOT NULL DEFAULT '{}'::jsonb`,
  ];
  for (const p of passos) {
    try {
      await p();
    } catch {
      /* tabela ainda inexistente: o bloco correspondente cai para o vazio */
    }
  }
}

async function blocoPropostas(db) {
  const [r] = await db`
    SELECT
      COALESCE(SUM(valor_total) FILTER (WHERE status IN ('ENVIADA','NEGOCIACAO')),0)::numeric AS pipeline,
      COUNT(*) FILTER (WHERE status IN ('ENVIADA','NEGOCIACAO'))::int AS abertas,
      COUNT(*) FILTER (WHERE status = 'RASCUNHO')::int AS rascunhos,
      COALESCE(AVG(valor_total) FILTER (WHERE status = 'GANHA'),0)::numeric AS ticket,
      COUNT(*) FILTER (WHERE status = 'GANHA')::int AS ganhas,
      COALESCE(SUM(valor_total) FILTER (WHERE status = 'GANHA' AND ganho_em >= (date_trunc('month', NOW() AT TIME ZONE ${FUSO}) AT TIME ZONE ${FUSO})),0)::numeric AS ganho_mes
    FROM crm_propostas
  `;
  return {
    pipelineAberto: arred(r?.pipeline),
    propostasAbertas: num(r?.abertas),
    rascunhos: num(r?.rascunhos),
    ticketMedio: arred(r?.ticket),
    ganhas: num(r?.ganhas),
    ganhoNoMes: arred(r?.ganho_mes),
  };
}

async function blocoLgpd(db, agora) {
  const [ini] = await db`
    SELECT LEAST(
      (SELECT MIN(created_at) FROM diagnostico_leads WHERE consentimento IS NOT NULL),
      (SELECT MIN(criado_em) FROM diagnosticos WHERE consentimento IS NOT NULL)
    ) AS inicio
  `;
  const inicio = ini?.inicio || null;
  if (!inicio) {
    return { inicioRegistro: null, semDados: true, elegiveis: 0, noClique: 0, soNoEnvio: 0, semRegistro: 0, cobertura: null, semRegistro24h: 0, versoes: [], versaoEmUso: "", porDia: [], recentesSemAceite: [] };
  }

  const [agg] = await db`
    SELECT
      COUNT(*)::int AS elegiveis,
      COUNT(*) FILTER (WHERE l.consentimento IS NOT NULL)::int AS no_clique,
      COUNT(*) FILTER (WHERE l.consentimento IS NULL AND d.consentimento IS NOT NULL)::int AS so_envio,
      COUNT(*) FILTER (WHERE l.consentimento IS NULL AND d.consentimento IS NULL)::int AS sem_registro,
      COUNT(*) FILTER (WHERE l.consentimento IS NULL AND d.consentimento IS NULL AND l.created_at > NOW() - INTERVAL '24 hours')::int AS sem_24h
    FROM diagnostico_leads l
    LEFT JOIN diagnosticos d ON l.diagnostico_id <> '' AND d.id::text = l.diagnostico_id
    WHERE COALESCE(l.arquivado, FALSE) = FALSE AND l.created_at >= ${inicio}
  `;

  const versoes = await db`
    SELECT consentimento->>'versaoTermos' AS versao, COUNT(*)::int AS total,
           MIN((consentimento->>'registradoEm')::timestamptz) AS desde
    FROM diagnostico_leads WHERE consentimento IS NOT NULL
    GROUP BY 1 ORDER BY desde DESC
  `;

  const dias = await db`
    SELECT to_char((l.created_at AT TIME ZONE ${FUSO})::date, 'YYYY-MM-DD') AS dia,
           COUNT(*) FILTER (WHERE l.consentimento IS NOT NULL OR d.consentimento IS NOT NULL)::int AS com,
           COUNT(*) FILTER (WHERE l.consentimento IS NULL AND d.consentimento IS NULL)::int AS sem
    FROM diagnostico_leads l
    LEFT JOIN diagnosticos d ON l.diagnostico_id <> '' AND d.id::text = l.diagnostico_id
    WHERE COALESCE(l.arquivado, FALSE) = FALSE AND l.created_at > NOW() - INTERVAL '16 days'
    GROUP BY 1
  `;

  const recentes = await db`
    SELECT l.id, l.nome, l.razao_social, l.created_at, l.etapa_atual, l.origem,
           (d.consentimento IS NOT NULL) AS diag_tem
    FROM diagnostico_leads l
    LEFT JOIN diagnosticos d ON l.diagnostico_id <> '' AND d.id::text = l.diagnostico_id
    WHERE COALESCE(l.arquivado, FALSE) = FALSE AND l.created_at >= ${inicio} AND l.consentimento IS NULL
    ORDER BY l.created_at DESC LIMIT 8
  `;

  const [diaInicio] = await db`SELECT to_char((${inicio}::timestamptz AT TIME ZONE ${FUSO})::date, 'YYYY-MM-DD') AS d`;
  const elegiveis = num(agg?.elegiveis);

  return {
    inicioRegistro: new Date(inicio).toISOString(),
    semDados: false,
    elegiveis,
    noClique: num(agg?.no_clique),
    soNoEnvio: num(agg?.so_envio),
    semRegistro: num(agg?.sem_registro),
    cobertura: pct(num(agg?.no_clique) + num(agg?.so_envio), elegiveis),
    semRegistro24h: num(agg?.sem_24h),
    versoes: (versoes || []).map((v) => ({ versao: v.versao || "—", total: num(v.total), desde: v.desde ? new Date(v.desde).toISOString() : null })),
    versaoEmUso: versoes?.[0]?.versao || "",
    porDia: serieDiaria(dias || [], 14, new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date(agora)), diaInicio?.d || null),
    recentesSemAceite: (recentes || []).map((r) => ({
      leadId: r.id,
      nome: r.razao_social || r.nome || "Lead sem identificação",
      criadoEm: r.created_at ? new Date(r.created_at).toISOString() : null,
      etapa: r.etapa_atual || "",
      origem: r.origem || "direto",
      motivo: motivoSemAceite({ diagTemAceite: r.diag_tem, nome: r.nome, razaoSocial: r.razao_social, etapa: r.etapa_atual }),
    })),
  };
}

async function blocoConsentimentosDosLeads(db, inicioRegistro) {
  const linhas = await db`
    SELECT l.id, l.created_at, l.consentimento, (d.consentimento IS NOT NULL) AS diag_tem
    FROM diagnostico_leads l
    LEFT JOIN diagnosticos d ON l.diagnostico_id <> '' AND d.id::text = l.diagnostico_id
    WHERE COALESCE(l.arquivado, FALSE) = FALSE
    ORDER BY CASE l.prioridade_comercial WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 ELSE 4 END,
             l.score_comercial DESC, l.ultima_atividade DESC
    LIMIT 80
  `;
  const inicio = inicioRegistro ? new Date(inicioRegistro).getTime() : null;
  const mapa = {};
  for (const l of linhas || []) {
    const c = l.consentimento;
    if (c && (c.registradoEm || c.hashTermos)) {
      mapa[l.id] = { estado: "completo", registradoEm: c.registradoEm || null, versao: c.versaoTermos || "", ip: c.ip || "" };
    } else if (l.diag_tem) {
      mapa[l.id] = { estado: "so_envio" };
    } else if (inicio === null || new Date(l.created_at).getTime() < inicio) {
      mapa[l.id] = { estado: "anterior" };
    } else {
      mapa[l.id] = { estado: "sem" };
    }
  }
  return mapa;
}

async function blocoOrigens(db) {
  const linhas = await db`
    SELECT COALESCE(NULLIF(LOWER(TRIM(l.origem)),''),'direto') AS origem,
      COUNT(DISTINCT l.id)::int AS leads,
      COUNT(DISTINCT l.id) FILTER (WHERE l.diagnostico_id <> '' OR l.status_diagnostico = 'CONCLUIDO')::int AS diagnosticos,
      COUNT(DISTINCT p.lead_id) FILTER (WHERE p.status IN ('RASCUNHO','ENVIADA','NEGOCIACAO','GANHA'))::int AS propostas,
      COUNT(DISTINCT p.lead_id) FILTER (WHERE p.status = 'GANHA')::int AS ganhos,
      COALESCE(SUM(p.valor_total) FILTER (WHERE p.status = 'GANHA'),0)::numeric AS receita
    FROM diagnostico_leads l LEFT JOIN crm_propostas p ON p.lead_id = l.id
    WHERE COALESCE(l.arquivado, FALSE) = FALSE
    GROUP BY 1 ORDER BY leads DESC, origem ASC
  `;
  let cupons = [];
  try {
    cupons = await db`
      SELECT LOWER(TRIM(origem)) AS origem, MAX(cupom_codigo) AS cupom
      FROM finder_eventos_origens WHERE COALESCE(cupom_codigo,'') <> '' GROUP BY 1
    `;
  } catch {
    cupons = [];
  }
  const porOrigem = new Map((cupons || []).map((c) => [c.origem, c.cupom]));
  return (linhas || []).map((r) => ({
    origem: r.origem,
    leads: num(r.leads),
    diagnosticos: num(r.diagnosticos),
    propostas: num(r.propostas),
    ganhos: num(r.ganhos),
    receita: arred(r.receita),
    cupom: porOrigem.get(r.origem) || "",
  }));
}

async function blocoDiagnosticos(db) {
  const casos = await db`
    SELECT LOWER(COALESCE(NULLIF(l.estrutura_negocio,''),'operacional')) AS estrutura,
      COUNT(*)::int AS total, AVG(d.score)::numeric AS nota,
      COUNT(*) FILTER (WHERE l.prioridade_comercial IN ('A','B') OR l.score_comercial >= 60)::int AS oportunidades,
      COUNT(*) FILTER (WHERE d.visao_consultiva IS NOT NULL)::int AS com_analise
    FROM diagnostico_leads l JOIN diagnosticos d ON d.id::text = l.diagnostico_id
    WHERE COALESCE(l.arquivado, FALSE) = FALSE AND l.diagnostico_id <> ''
    GROUP BY 1
  `;
  const porCaso = consolidarCasos(casos || []);
  const totalDiag = porCaso.reduce((a, c) => a + c.total, 0);
  const comAnalise = porCaso.reduce((a, c) => a + c.comAnalise, 0);

  const [q] = await db`
    SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE lower(e->>'resposta') ~ '^n(ã|a)o sei')::int AS nao_sei,
      COUNT(*) FILTER (WHERE lower(e->>'resposta') ~ '^(n/a|na$|n(ã|a)o se aplica)')::int AS nao_aplica,
      COUNT(DISTINCT d.id)::int AS diagnosticos
    FROM (
      SELECT id, perguntas_respostas FROM diagnosticos
      WHERE jsonb_typeof(perguntas_respostas) = 'array'
      ORDER BY id DESC LIMIT 200
    ) d, LATERAL jsonb_array_elements(d.perguntas_respostas) e
  `;
  const totalResp = num(q?.total);

  return {
    porCaso,
    totalDiagnosticos: totalDiag,
    comAnalise,
    comAnalisePct: pct(comAnalise, totalDiag),
    qualidade: {
      diagnosticosAvaliados: num(q?.diagnosticos),
      respostas: totalResp,
      naoSeiPct: pct(q?.nao_sei, totalResp),
      naoSeAplicaPct: pct(q?.nao_aplica, totalResp),
      avaliaveisPct: totalResp ? 100 - (pct(num(q?.nao_sei) + num(q?.nao_aplica), totalResp) || 0) : null,
    },
  };
}

async function blocoAtendimentos(db, agora) {
  const linhas = await db`
    SELECT a.id, a.diagnostico_id, a.lead_id, a.area, a.score_area, a.status_atendimento, a.responsavel_id,
           a.proximo_contato, a.ultimo_acionamento,
           COALESCE(l.razao_social,'') AS razao_social, COALESCE(l.nome,'') AS nome,
           p.total AS plano_total, p.concluidas AS plano_concluidas, p.andamento AS plano_andamento, p.bloqueadas AS plano_bloqueadas,
           (d.visao_consultiva->'atual'->>'versao') AS analise_versao
    FROM crm_atendimentos_departamento a
    LEFT JOIN diagnostico_leads l ON l.id = a.lead_id
    LEFT JOIN diagnosticos d ON d.id::text = a.diagnostico_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE e->>'status' = 'CONCLUIDA')::int AS concluidas,
             COUNT(*) FILTER (WHERE e->>'status' = 'EM_ANDAMENTO')::int AS andamento,
             COUNT(*) FILTER (WHERE e->>'status' = 'BLOQUEADA')::int AS bloqueadas
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a.plano_execucao) = 'array' THEN a.plano_execucao ELSE '[]'::jsonb END) e
    ) p ON TRUE
    WHERE COALESCE(a.arquivado, FALSE) = FALSE
    ORDER BY COALESCE(a.proximo_contato, a.updated_at) ASC
    LIMIT 2000
  `;
  const motivos = await db`
    SELECT lower(trim(e->>'motivoBloqueio')) AS motivo, COUNT(*)::int AS total
    FROM crm_atendimentos_departamento a,
         LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(a.plano_execucao) = 'array' THEN a.plano_execucao ELSE '[]'::jsonb END) e
    WHERE COALESCE(a.arquivado, FALSE) = FALSE AND e->>'status' = 'BLOQUEADA' AND COALESCE(trim(e->>'motivoBloqueio'),'') <> ''
    GROUP BY 1 ORDER BY 2 DESC LIMIT 3
  `;
  const hip = await db`
    SELECT COUNT(*) FILTER (WHERE h.v = 'CONFIRMADA')::int AS confirmadas, COUNT(*) FILTER (WHERE h.v = 'REFUTADA')::int AS refutadas
    FROM crm_atendimentos_departamento a, LATERAL jsonb_each_text(COALESCE(a.ficha_area->'hipoteses','{}'::jsonb)) h(k, v)
    WHERE COALESCE(a.arquivado, FALSE) = FALSE AND jsonb_typeof(a.ficha_area->'hipoteses') = 'object'
  `;
  const propostas = await db`
    SELECT COALESCE(NULLIF(TRIM(area),''),'—') AS area,
      COUNT(*) FILTER (WHERE status IN ('RASCUNHO','ENVIADA','NEGOCIACAO'))::int AS abertas,
      COUNT(*) FILTER (WHERE status = 'GANHA')::int AS ganhas,
      COALESCE(SUM(valor_total) FILTER (WHERE status = 'GANHA'),0)::numeric AS receita
    FROM crm_propostas GROUP BY 1
  `;
  const responsaveis = await db`
    SELECT r.id, r.nome, r.capacidade_diaria
    FROM crm_responsaveis r WHERE COALESCE(r.ativo, TRUE) = TRUE ORDER BY r.nome ASC
  `;

  const atrasos = atrasosDe(linhas, agora);
  const abertas = (linhas || []).filter((r) => r.status_atendimento !== "CONCLUIDO");
  const extras = {};
  for (const r of abertas.slice(0, 800)) {
    const atraso = atrasos.find((a) => a.id === r.id);
    extras[r.id] = {
      planoTotal: num(r.plano_total),
      planoConcluidas: num(r.plano_concluidas),
      planoAndamento: num(r.plano_andamento),
      planoBloqueadas: num(r.plano_bloqueadas),
      analiseVersao: r.analise_versao ? num(r.analise_versao) : null,
      atrasoDias: atraso ? atraso.dias : 0,
    };
  }

  const nomeResp = new Map((responsaveis || []).map((x) => [x.id, x]));
  const cargas = (responsaveis || []).map((x) => ({
    id: x.id,
    nome: x.nome,
    capacidadeDiaria: num(x.capacidade_diaria),
    abertos: abertas.filter((r) => r.responsavel_id === x.id).length,
    atrasados: atrasos.filter((a) => a.responsavelId === x.id).length,
  }));
  const semResp = abertas.filter((r) => !r.responsavel_id || !nomeResp.has(r.responsavel_id)).length;
  if (semResp) cargas.push({ id: "", nome: "Sem responsável", capacidadeDiaria: 0, abertos: semResp, atrasados: atrasos.filter((a) => !nomeResp.has(a.responsavelId)).length });

  const planos = resumirPlanos(linhas);
  return {
    planos,
    atrasos: { total: atrasos.length, maisAntigoDias: atrasos[0]?.dias ?? 0, lista: atrasos.slice(0, 5) },
    motivosBloqueio: (motivos || []).map((m) => ({ motivo: m.motivo, total: num(m.total) })),
    extras,
    contadores: {
      abertos: abertas.length,
      atraso: atrasos.length,
      bloqueadas: planos.bloqueadas,
      semAnalise: abertas.filter((r) => !r.analise_versao).length,
    },
    areas: { itens: agruparAreas(linhas, propostas, agora), responsaveis: cargas.sort((a, b) => b.abertos - a.abertos), hipoteses: { confirmadas: num(hip?.[0]?.confirmadas), refutadas: num(hip?.[0]?.refutadas) } },
  };
}

async function blocoAnaliseConsultiva(db) {
  const [r] = await db`
    SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE d.visao_consultiva IS NOT NULL)::int AS com
    FROM diagnostico_leads l JOIN diagnosticos d ON d.id::text = l.diagnostico_id
    WHERE COALESCE(l.arquivado, FALSE) = FALSE AND l.diagnostico_id <> '' AND l.prioridade_comercial IN ('A','B')
  `;
  const lista = await db`
    SELECT l.id, l.diagnostico_id, l.nome, l.razao_social, l.prioridade_comercial
    FROM diagnostico_leads l JOIN diagnosticos d ON d.id::text = l.diagnostico_id
    WHERE COALESCE(l.arquivado, FALSE) = FALSE AND l.diagnostico_id <> '' AND l.prioridade_comercial IN ('A','B') AND d.visao_consultiva IS NULL
    ORDER BY CASE l.prioridade_comercial WHEN 'A' THEN 1 ELSE 2 END, l.score_comercial DESC LIMIT 5
  `;
  return {
    total: num(r?.total),
    comAnalise: num(r?.com),
    pendentes: num(r?.total) - num(r?.com),
    lista: (lista || []).map((x) => ({ leadId: x.id, diagnosticoId: x.diagnostico_id, empresa: x.razao_social || x.nome || "Lead sem identificação", prioridade: x.prioridade_comercial })),
  };
}

async function blocoAsaas(db) {
  const [ck] = await db`
    SELECT COUNT(*)::int AS criadas,
      COUNT(*) FILTER (WHERE status IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH'))::int AS pagas,
      COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pendentes,
      COUNT(*) FILTER (WHERE status IN ('OVERDUE','CANCELLED','DELETED','REFUNDED'))::int AS falhas
    FROM asaas_pagamentos WHERE criado_em > NOW() - INTERVAL '90 days'
  `;
  const [mes] = await db`
    WITH m AS (SELECT (date_trunc('month', NOW() AT TIME ZONE ${FUSO}) AT TIME ZONE ${FUSO}) AS ini)
    SELECT
      COALESCE(SUM(COALESCE(p.valor_liquido,p.valor)) FILTER (WHERE p.pago_em >= m.ini),0)::numeric AS liquido_mes,
      COALESCE(SUM(p.valor) FILTER (WHERE p.pago_em >= m.ini),0)::numeric AS bruto_mes,
      COUNT(*) FILTER (WHERE p.pago_em >= m.ini)::int AS recebidos_mes,
      COALESCE(SUM(COALESCE(p.valor_liquido,p.valor)) FILTER (WHERE p.pago_em >= m.ini - INTERVAL '1 month' AND p.pago_em < m.ini),0)::numeric AS liquido_anterior
    FROM asaas_pagamentos p CROSS JOIN m
    WHERE p.status IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH')
  `;
  const porPlano = await db`
    SELECT COALESCE(NULLIF(UPPER(plano),''),'SEM_PLANO') AS plano, COUNT(*)::int AS vendas,
      COALESCE(SUM(valor),0)::numeric AS bruto, COALESCE(SUM(COALESCE(valor_liquido,valor)),0)::numeric AS liquido
    FROM asaas_pagamentos WHERE status IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH')
    GROUP BY 1 ORDER BY liquido DESC
  `;
  const porOrigem = await db`
    SELECT COALESCE(NULLIF(LOWER(TRIM(l.origem)),''),'direto') AS origem, COUNT(*)::int AS vendas,
      COALESCE(SUM(COALESCE(p.valor_liquido,p.valor)),0)::numeric AS liquido, COALESCE(SUM(COALESCE(p.desconto,0)),0)::numeric AS descontos
    FROM asaas_pagamentos p LEFT JOIN diagnostico_leads l ON p.diagnostico_id <> '' AND l.diagnostico_id = p.diagnostico_id
    WHERE p.status IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH')
    GROUP BY 1 ORDER BY liquido DESC LIMIT 8
  `;
  const porCupom = await db`
    SELECT UPPER(cupom_codigo) AS cupom, COUNT(*)::int AS usos, COALESCE(SUM(desconto),0)::numeric AS descontos,
      COALESCE(SUM(COALESCE(valor_liquido,valor)),0)::numeric AS liquido
    FROM asaas_pagamentos WHERE status IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH') AND COALESCE(cupom_codigo,'') <> ''
    GROUP BY 1 ORDER BY usos DESC LIMIT 8
  `;
  return {
    mes: {
      liquido: arred(mes?.liquido_mes),
      bruto: arred(mes?.bruto_mes),
      recebidos: num(mes?.recebidos_mes),
      liquidoMesAnterior: arred(mes?.liquido_anterior),
      variacaoPct: num(mes?.liquido_anterior) > 0 ? Math.round(((num(mes?.liquido_mes) - num(mes?.liquido_anterior)) / num(mes?.liquido_anterior)) * 100) : null,
    },
    checkout: { janelaDias: 90, criadas: num(ck?.criadas), pagas: num(ck?.pagas), pendentes: num(ck?.pendentes), falhas: num(ck?.falhas), conversaoPct: pct(ck?.pagas, ck?.criadas) },
    porPlano: (porPlano || []).map((r) => ({ plano: r.plano, vendas: num(r.vendas), bruto: arred(r.bruto), liquido: arred(r.liquido) })),
    porOrigem: (porOrigem || []).map((r) => ({ origem: r.origem, vendas: num(r.vendas), liquido: arred(r.liquido), descontos: arred(r.descontos) })),
    porCupom: (porCupom || []).map((r) => ({ cupom: r.cupom, usos: num(r.usos), descontos: arred(r.descontos), liquido: arred(r.liquido) })),
  };
}

async function blocoClientes(db) {
  const [c] = await db`SELECT COUNT(*)::int AS total FROM crm_clientes`;
  const [p] = await db`
    SELECT COUNT(*)::int AS abertas, COUNT(*) FILTER (WHERE prazo IS NOT NULL AND prazo < NOW())::int AS vencidas
    FROM crm_cliente_pendencias WHERE resolvido_em IS NULL AND status NOT IN ('CONCLUIDA','CANCELADA')
  `;
  const [t] = await db`
    SELECT COUNT(*)::int AS abertas,
           COUNT(*) FILTER (WHERE prazo IS NOT NULL AND prazo >= NOW() AND prazo < NOW() + INTERVAL '7 days')::int AS semana
    FROM crm_cliente_tarefas WHERE concluido_em IS NULL AND status NOT IN ('CONCLUIDA','CANCELADA')
  `;
  const [d] = await db`
    SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status_analise = 'AGUARDANDO_ANALISE')::int AS aguardando
    FROM crm_documentos_cliente
  `;
  const vencidas = await db`
    SELECT p.titulo, p.prazo, p.criticidade, COALESCE(c.razao_social, c.nome_fantasia, '') AS cliente
    FROM crm_cliente_pendencias p LEFT JOIN crm_clientes c ON c.id = p.cliente_id
    WHERE p.resolvido_em IS NULL AND p.status NOT IN ('CONCLUIDA','CANCELADA') AND p.prazo IS NOT NULL AND p.prazo < NOW()
    ORDER BY p.prazo ASC LIMIT 5
  `;
  return {
    clientes: num(c?.total),
    pendenciasAbertas: num(p?.abertas),
    pendenciasVencidas: num(p?.vencidas),
    tarefasAbertas: num(t?.abertas),
    tarefasSemana: num(t?.semana),
    documentos: { total: num(d?.total), aguardandoAnalise: num(d?.aguardando) },
    vencidas: (vencidas || []).map((v) => ({ titulo: v.titulo, cliente: v.cliente, diasVencida: diasEntre(v.prazo) ?? 0, criticidade: v.criticidade || "" })),
  };
}

async function blocoAgenda(db) {
  const proximos = await db`
    SELECT id, to_char(data_agenda, 'YYYY-MM-DD') AS data, hora_agenda, empresa, nome, origem
    FROM crm_agendamentos
    WHERE status = 'AGENDADO' AND data_agenda >= (NOW() AT TIME ZONE ${FUSO})::date AND data_agenda < (NOW() AT TIME ZONE ${FUSO})::date + 8
    ORDER BY data_agenda ASC, hora_agenda ASC LIMIT 12
  `;
  const [mes] = await db`
    SELECT COUNT(*) FILTER (WHERE status = 'REALIZADO')::int AS realizados,
           COUNT(*) FILTER (WHERE status = 'CANCELADO')::int AS cancelados,
           COUNT(*) FILTER (WHERE status = 'NAO_COMPARECEU')::int AS nao_compareceu,
           COUNT(*) FILTER (WHERE status = 'AGENDADO' AND data_agenda = (NOW() AT TIME ZONE ${FUSO})::date)::int AS hoje
    FROM crm_agendamentos
    WHERE date_trunc('month', data_agenda) = date_trunc('month', (NOW() AT TIME ZONE ${FUSO})::date)
  `;
  const realizados = num(mes?.realizados);
  const faltas = num(mes?.nao_compareceu);
  return {
    hoje: num(mes?.hoje),
    proximos: (proximos || []).map((a) => ({ id: a.id, data: a.data, hora: a.hora_agenda || "", empresa: a.empresa || a.nome || "", nome: a.nome || "", origem: a.origem || "" })),
    realizadosMes: realizados,
    canceladosMes: num(mes?.cancelados),
    naoCompareceuMes: faltas,
    comparecimentoPct: pct(realizados, realizados + faltas),
  };
}

async function blocoSistema(db) {
  const auditoria = await db`
    SELECT usuario_nome, acao, modulo, descricao, criado_em
    FROM finder_auditoria ORDER BY criado_em DESC LIMIT 8
  `;
  const [u] = await db`
    SELECT COUNT(*) FILTER (WHERE COALESCE(ativo, TRUE))::int AS ativos,
           COUNT(*) FILTER (WHERE ultimo_acesso_em >= (date_trunc('day', NOW() AT TIME ZONE ${FUSO}) AT TIME ZONE ${FUSO}))::int AS hoje
    FROM finder_usuarios
  `;
  const [ultimo] = await db`
    SELECT nome, ultimo_acesso_em FROM finder_usuarios WHERE ultimo_acesso_em IS NOT NULL ORDER BY ultimo_acesso_em DESC LIMIT 1
  `;
  return {
    auditoria: (auditoria || []).map((a) => ({
      quando: a.criado_em ? new Date(a.criado_em).toISOString() : null,
      usuario: a.usuario_nome || "—",
      modulo: a.modulo || "",
      acao: a.acao || "",
      descricao: a.descricao || a.acao || "",
      destaque: /exclu|delet|remov/i.test(`${a.acao} ${a.descricao}`),
    })),
    usuarios: { ativos: num(u?.ativos), acessaramHoje: num(u?.hoje), ultimoAcesso: ultimo ? { nome: ultimo.nome, quando: new Date(ultimo.ultimo_acesso_em).toISOString() } : null },
  };
}

// ---------------------------------------------------------
// HANDLER
// ---------------------------------------------------------
export default async function dashboardVisaoHandler(req, res) {
  if (req.method !== "GET") {
    res.setHeader?.("Allow", "GET");
    return res.status(405).json({ sucesso: false, error: "Método não permitido." });
  }
  if (!usuarioAutenticado(req)) return res.status(401).json({ sucesso: false, error: "Não autorizado." });
  if (!sql) return res.status(500).json({ sucesso: false, error: "DATABASE_URL não configurada." });

  const agora = Date.now();
  const avisos = [];
  try {
    await garantirColunas(sql);

    const [propostas, asaas, lgpd, atend, analise, origens, diag, clientes, agenda, sistema] = await Promise.all([
      segura(avisos, "propostas", () => blocoPropostas(sql), null),
      segura(avisos, "asaas", () => blocoAsaas(sql), null),
      segura(avisos, "lgpd", () => blocoLgpd(sql, agora), null),
      segura(avisos, "atendimentos", () => blocoAtendimentos(sql, agora), null),
      segura(avisos, "analise", () => blocoAnaliseConsultiva(sql), null),
      segura(avisos, "origens", () => blocoOrigens(sql), []),
      segura(avisos, "diagnosticos", () => blocoDiagnosticos(sql), null),
      segura(avisos, "clientes", () => blocoClientes(sql), null),
      segura(avisos, "agenda", () => blocoAgenda(sql), null),
      segura(avisos, "sistema", () => blocoSistema(sql), null),
    ]);

    const consentimentos = await segura(avisos, "consentimentos", () => blocoConsentimentosDosLeads(sql, lgpd?.inicioRegistro || null), {});

    const atencao = montarAtencao({
      atrasos: atend?.atrasos || { total: 0, lista: [] },
      bloqueadas: atend?.planos?.bloqueadas || 0,
      motivosBloqueio: atend?.motivosBloqueio || [],
      semAnalise: { total: analise?.pendentes || 0, lista: analise?.lista || [] },
      semAceite24h: lgpd?.semRegistro24h || 0,
      haRegistroLgpd: Boolean(lgpd && !lgpd.semDados),
    });

    return res.status(200).json({
      sucesso: true,
      versao: "VISAO_V1",
      avisos,
      visao: {
        geradoEm: new Date(agora).toISOString(),
        receita: propostas ? { ...propostas } : null,
        operacao: {
          aceite: lgpd ? { cobertura: lgpd.cobertura, semRegistro24h: lgpd.semRegistro24h, elegiveis: lgpd.elegiveis, semDados: lgpd.semDados } : null,
          analise: analise ? { total: analise.total, comAnalise: analise.comAnalise, pendentes: analise.pendentes } : null,
          planos: atend?.planos || null,
          atrasos: atend ? { total: atend.atrasos.total, maisAntigoDias: atend.atrasos.maisAntigoDias } : null,
        },
        atencao,
        leads: { origens, consentimentos },
        diagnosticos: diag,
        atendimento: atend ? { extras: atend.extras, contadores: atend.contadores } : null,
        analiseConsultiva: analise,
        asaas,
        areas: atend?.areas || null,
        clientes,
        agenda,
        lgpd,
        sistema,
      },
    });
  } catch (erro) {
    console.error("[dashboard-visao]", erro);
    return res.status(500).json({ sucesso: false, error: "Não foi possível calcular a visão completa do dashboard." });
  }
}
