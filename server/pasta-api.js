// server/pasta-api.js — ações da Auditoria de pastas (roteadas por api/tributario.js).
import { neon } from "@neondatabase/serverless";
import * as motor from "./pasta-engine.js";
import { situacaoCliente, normalizarRegime, mesAnteriorDe, OBRIGACOES } from "./carteira-engine.js";
const { resumoParaIa } = motor;
const resumoPainel = motor.resumoPainel || ((a) => ({ codigo: a?.cliente?.codigo || "", nome: a?.cliente?.nome || "", resumo: a?.resumo || {}, saude: a?.saude || 0, achados: [], vencimentos: [], pastasPendentes: [] }));

const sql = neon(process.env.DATABASE_URL);
const OPENAI_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const MODELO = process.env.OPENAI_PASTA_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini";

const enviar = (res, status, corpo) => res.status(status).json(corpo);
const texto = (v, n = 300) => String(v ?? "").trim().slice(0, n);

let tabelaPronta = null;
function garantirTabela() {
  if (!tabelaPronta) {
    tabelaPronta = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS pasta_auditorias (
        id BIGSERIAL PRIMARY KEY,
        cliente_codigo TEXT NOT NULL,
        cliente_nome TEXT NOT NULL,
        regime TEXT,
        saude INTEGER,
        criticos INTEGER DEFAULT 0,
        atencoes INTEGER DEFAULT 0,
        infos INTEGER DEFAULT 0,
        resultado JSONB NOT NULL,
        narrativa JSONB,
        origem TEXT DEFAULT 'upload',
        usuario TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;
      await sql`ALTER TABLE pasta_auditorias ADD COLUMN IF NOT EXISTS painel JSONB`;
      await sql`CREATE INDEX IF NOT EXISTS pasta_auditorias_cliente_idx ON pasta_auditorias (cliente_codigo, created_at DESC)`;
    })().catch((e) => { tabelaPronta = null; throw e; });
  }
  return tabelaPronta;
}

function limparAuditoria(a) {
  // Garante tamanho razoável e só o que a tela usa.
  const s = JSON.stringify(a || {});
  if (s.length > 900000) throw new Error("Resultado grande demais para salvar.");
  return a;
}

export async function pastaSalvar(req, res) {
  if (req.method !== "POST") return enviar(res, 405, { sucesso: false, error: "Use POST." });
  await garantirTabela();
  const lista = Array.isArray(req.body?.auditorias) ? req.body.auditorias.slice(0, 300) : [];
  if (!lista.length) return enviar(res, 400, { sucesso: false, error: "Nenhuma auditoria para salvar." });
  const usuario = texto(req.body?.usuario, 120);
  let salvos = 0;
  const ids = [];
  for (const item of lista) {
    const a = limparAuditoria(item.auditoria || item);
    const codigo = texto(a?.cliente?.codigo, 30);
    if (!codigo) continue;
    const [linha] = await sql`INSERT INTO pasta_auditorias
      (cliente_codigo, cliente_nome, regime, saude, criticos, atencoes, infos, resultado, narrativa, origem, usuario, painel)
      VALUES (${codigo}, ${texto(a.cliente.nome, 200)}, ${texto(a.regime, 40)}, ${Number(a.saude) || 0},
        ${a.resumo?.critico || 0}, ${a.resumo?.atencao || 0}, ${a.resumo?.info || 0},
        ${JSON.stringify(a)}::jsonb, ${item.narrativa ? JSON.stringify(item.narrativa) : null}::jsonb,
        ${texto(req.body?.origem || "upload", 20)}, ${usuario}, ${JSON.stringify(resumoPainel(a))}::jsonb) RETURNING id, created_at`;
    ids.push({ codigo, id: linha?.id, criadoEm: linha?.created_at });
    salvos += 1;
  }
  return enviar(res, 200, { sucesso: true, salvos, ids });
}

export async function pastaListar(req, res) {
  await garantirTabela();
  const linhas = await sql`
    SELECT DISTINCT ON (cliente_codigo) id, cliente_codigo, cliente_nome, regime, saude, criticos, atencoes, infos, origem, created_at
    FROM pasta_auditorias ORDER BY cliente_codigo, created_at DESC LIMIT 500`;
  return enviar(res, 200, { sucesso: true, clientes: linhas });
}

export async function pastaPainel(req, res) {
  await garantirTabela();
  const linhas = await sql`
    SELECT DISTINCT ON (cliente_codigo) id, cliente_codigo, origem, created_at, painel, CASE WHEN painel IS NULL THEN resultado END AS resultado
    FROM pasta_auditorias ORDER BY cliente_codigo, created_at DESC, id DESC LIMIT 600`;
  const clientes = [];
  for (const l of linhas) {
    let painel = l.painel;
    if (!painel && l.resultado) {
      painel = resumoPainel(l.resultado);
      try { await sql`UPDATE pasta_auditorias SET painel = ${JSON.stringify(painel)}::jsonb WHERE id = ${l.id}`; } catch { /* segue sem cache */ }
    }
    if (painel) clientes.push({ ...painel, id: l.id, origem: l.origem, auditadoEm: l.created_at });
  }
  return enviar(res, 200, { sucesso: true, clientes });
}

export async function pastaRelatorio(req, res) {
  await garantirTabela();
  const id = Number(req.query?.id);
  if (!Number.isFinite(id)) return enviar(res, 400, { sucesso: false, error: "Informe o relatório." });
  const [atual] = await sql`SELECT id, cliente_codigo, resultado, narrativa, origem, created_at FROM pasta_auditorias WHERE id = ${id}`;
  if (!atual) return enviar(res, 404, { sucesso: false, error: "Relatório não encontrado." });
  const [anterior] = await sql`SELECT id, resultado, created_at FROM pasta_auditorias WHERE cliente_codigo = ${atual.cliente_codigo} AND (created_at < ${atual.created_at} OR (created_at = ${atual.created_at} AND id < ${atual.id})) ORDER BY created_at DESC, id DESC LIMIT 1`;
  return enviar(res, 200, { sucesso: true, relatorio: atual, anterior: anterior || null });
}

export async function pastaObter(req, res) {
  await garantirTabela();
  const codigo = texto(req.query?.codigo, 30);
  if (!codigo) return enviar(res, 400, { sucesso: false, error: "Informe o cliente." });
  const [ultima] = await sql`SELECT id, resultado, narrativa, created_at FROM pasta_auditorias WHERE cliente_codigo = ${codigo} ORDER BY created_at DESC LIMIT 1`;
  const historico = await sql`SELECT id, saude, criticos, atencoes, infos, created_at FROM pasta_auditorias WHERE cliente_codigo = ${codigo} ORDER BY created_at DESC LIMIT 24`;
  return enviar(res, 200, { sucesso: true, ultima: ultima || null, historico });
}

const CONTRATO = {
  type: "object",
  additionalProperties: false,
  required: ["resumo", "prioridades", "melhorias", "oportunidades"],
  properties: {
    resumo: { type: "string" },
    prioridades: { type: "array", items: { type: "string" } },
    melhorias: { type: "array", items: { type: "string" } },
    oportunidades: { type: "array", items: { type: "string" } },
  },
};

export async function pastaNarrativa(req, res) {
  if (req.method !== "POST") return enviar(res, 405, { sucesso: false, error: "Use POST." });
  if (!process.env.OPENAI_API_KEY) return enviar(res, 503, { sucesso: false, error: "IA não configurada." });
  const entrada = resumoParaIa(req.body?.auditoria);
  if (!entrada.cliente) return enviar(res, 400, { sucesso: false, error: "Auditoria inválida." });
  const instrucoes = [
    "Você é um contador sênior revisando a pasta de documentos de um cliente de escritório contábil brasileiro.",
    "Receberá achados OBJETIVOS já calculados por um motor de regras (não os refaça nem invente documentos).",
    "Responda em português, direto ao contador. Não invente fatos, valores, datas ou normas que não estejam nos dados.",
    "resumo: 3 a 5 frases sobre a situação documental e de conformidade do cliente.",
    "prioridades: até 5 ações em ordem de urgência, citando o mês/documento.",
    "melhorias: até 5 sugestões de organização/processo do escritório baseadas nos achados.",
    "oportunidades: até 3 pontos tributários a verificar (ex.: regime, parcelamento, receita x notas), sempre como 'verificar', nunca como conclusão.",
    "Dados de entrada contêm apenas nomes de documentos e métricas; não há CPF.",
  ].join("\n");
  try {
    const r = await fetch(`${OPENAI_URL}/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        model: MODELO,
        instructions: instrucoes,
        input: JSON.stringify(entrada),
        text: { format: { type: "json_schema", name: "auditoria_pasta", strict: true, schema: CONTRATO } },
      }),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error(d?.error?.message || "Falha na IA.");
    const bruto = d?.output_text || (d?.output || []).flatMap((o) => o.content || []).map((c) => c.text || "").join("");
    const n = JSON.parse(bruto);
    const lim = (l, max) => (Array.isArray(l) ? l.map((x) => texto(x, 400)).filter(Boolean).slice(0, max) : []);
    const narrativaFinal = { resumo: texto(n.resumo, 1200), prioridades: lim(n.prioridades, 5), melhorias: lim(n.melhorias, 5), oportunidades: lim(n.oportunidades, 3), modelo: MODELO };
    const idRel = Number(req.body?.id);
    if (Number.isFinite(idRel)) {
      try { await garantirTabela(); await sql`UPDATE pasta_auditorias SET narrativa = ${JSON.stringify(narrativaFinal)}::jsonb WHERE id = ${idRel}`; } catch (e) { console.error("[pasta][narrativa-salvar]", e); }
    }
    return enviar(res, 200, { sucesso: true, narrativa: narrativaFinal });
  } catch (e) {
    console.error("[pasta][narrativa]", e);
    return enviar(res, 502, { sucesso: false, error: "A IA não conseguiu comentar esta pasta agora. O resultado das regras continua válido." });
  }
}


// ---------- Carteira (aba 5 · Visão geral por cliente) ----------
let carteiraPronta = null;
function garantirCarteira() {
  if (!carteiraPronta) {
    carteiraPronta = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS carteira_cadastro (
        cliente_codigo TEXT PRIMARY KEY,
        cliente_nome TEXT,
        regime TEXT,
        carteira TEXT,
        responsavel TEXT,
        movimento TEXT,
        extra JSONB,
        atualizado_em TIMESTAMPTZ DEFAULT NOW()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS apuracao_auditorias (id BIGSERIAL PRIMARY KEY, cliente_codigo TEXT NOT NULL, cliente_nome TEXT NOT NULL, regime TEXT, saude INTEGER, criticos INTEGER DEFAULT 0, atencoes INTEGER DEFAULT 0, infos INTEGER DEFAULT 0, resultado JSONB NOT NULL, usuario TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`;
    })().catch((e) => { carteiraPronta = null; throw e; });
  }
  return carteiraPronta;
}

// GET ?competencia=AAAA-MM (padrão: mês anterior)
export async function pastaCarteira(req, res) {
  await garantirTabela(); await garantirCarteira();
  const hoje = new Date();
  const comp = /^\d{4}-\d{2}$/.test(String(req.query?.competencia || "")) ? req.query.competencia : mesAnteriorDe(hoje);
  const [painelRows, apuRows, cadRows] = await Promise.all([
    sql`SELECT DISTINCT ON (cliente_codigo) id, cliente_codigo, cliente_nome, created_at, painel, CASE WHEN painel IS NULL THEN resultado END AS resultado
        FROM pasta_auditorias ORDER BY cliente_codigo, created_at DESC, id DESC LIMIT 700`,
    sql`SELECT DISTINCT ON (cliente_codigo) cliente_codigo, regime, resultado->'entregas'->'semMovimento' AS sem, created_at
        FROM apuracao_auditorias ORDER BY cliente_codigo, created_at DESC, id DESC LIMIT 700`,
    sql`SELECT cliente_codigo, cliente_nome, regime, carteira, responsavel, movimento FROM carteira_cadastro LIMIT 2000`,
  ]);
  const cad = new Map(cadRows.map((c) => [String(c.cliente_codigo), c]));
  const apu = new Map(apuRows.map((a) => [String(a.cliente_codigo), a]));
  const linhas = new Map();
  const pegar = (codigo, nome) => { const k = String(codigo); if (!linhas.has(k)) linhas.set(k, { codigo: k, nome: nome || "" }); return linhas.get(k); };
  for (const l of painelRows) {
    let painel = l.painel;
    if (!painel && l.resultado) painel = resumoPainel(l.resultado);
    const r = pegar(l.cliente_codigo, l.cliente_nome);
    r.painel = painel || null; r.auditadoEm = l.created_at; r.saude = painel?.saude ?? null;
    r.achadosCriticos = (painel?.achados || []).filter((x) => x.severidade === "critico").length;
  }
  for (const c of cadRows) pegar(c.cliente_codigo, c.cliente_nome);
  const saida = [];
  for (const r of linhas.values()) {
    const c = cad.get(r.codigo) || null;
    const a = apu.get(r.codigo);
    let sem = [];
    try { sem = Array.isArray(a?.sem) ? a.sem : JSON.parse(a?.sem || "[]"); } catch { sem = []; }
    const sit = situacaoCliente({ painel: r.painel, cadastro: c ? { regime: c.regime } : (a ? { regime: a.regime === "SIMPLES" ? "SIMPLES" : "" } : null), competencia: comp, hoje, extras: { semMovimento: sem } });
    saida.push({
      codigo: r.codigo, nome: c?.cliente_nome || r.nome, carteira: c?.carteira || "", responsavel: c?.responsavel || "", movimento: c?.movimento || "",
      regime: sit.regime, regimeFonte: sit.regimeFonte, auditadoEm: r.auditadoEm || null, semLeitura: sit.semLeitura, saude: r.saude, achadosCriticos: r.achadosCriticos || 0,
      faltando: sit.faltando, atraso: sit.atraso, noPrazo: sit.noPrazo, semMovimento: sit.semMovimento, aVencer: sit.aVencer,
      itens: sit.itens.map((i) => ({ key: i.key, status: i.status, prazo: i.prazo, postadoEm: i.postadoEm, arquivo: i.arquivo, diasAtraso: i.diasAtraso })),
    });
  }
  saida.sort((x, y) => (Number(x.codigo) - Number(y.codigo)) || x.codigo.localeCompare(y.codigo));
  return enviar(res, 200, { sucesso: true, competencia: comp, obrigacoes: OBRIGACOES.map((o) => ({ key: o.key, rotulo: o.rotulo, tipo: o.tipo, regimes: o.regimes, prazo: o.prazo })), clientes: saida });
}

// POST { clientes: [{ codigo, nome, regime, carteira, responsavel, movimento }] }
// Atenção: só campos cadastrais. Qualquer coluna de usuário/senha da planilha é descartada aqui também.
export async function pastaCarteiraImportar(req, res) {
  if (req.method !== "POST") return enviar(res, 405, { sucesso: false, error: "Use POST." });
  await garantirCarteira();
  const lista = Array.isArray(req.body?.clientes) ? req.body.clientes.slice(0, 2000) : [];
  let salvos = 0;
  for (const c of lista) {
    const codigo = texto(c?.codigo, 30);
    if (!codigo) continue;
    const regime = normalizarRegime(c?.regime) || "";
    await sql`INSERT INTO carteira_cadastro (cliente_codigo, cliente_nome, regime, carteira, responsavel, movimento, atualizado_em)
      VALUES (${codigo}, ${texto(c?.nome, 200)}, ${regime}, ${texto(c?.carteira, 80)}, ${texto(c?.responsavel, 120)}, ${texto(c?.movimento, 40)}, NOW())
      ON CONFLICT (cliente_codigo) DO UPDATE SET cliente_nome = EXCLUDED.cliente_nome, regime = EXCLUDED.regime, carteira = EXCLUDED.carteira, responsavel = EXCLUDED.responsavel, movimento = EXCLUDED.movimento, atualizado_em = NOW()`;
    salvos += 1;
  }
  return enviar(res, 200, { sucesso: true, salvos });
}
