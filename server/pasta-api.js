// server/pasta-api.js — ações da Auditoria de pastas (roteadas por api/tributario.js).
import { neon } from "@neondatabase/serverless";
import { resumoParaIa } from "./pasta-engine.js";

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
      (cliente_codigo, cliente_nome, regime, saude, criticos, atencoes, infos, resultado, narrativa, origem, usuario)
      VALUES (${codigo}, ${texto(a.cliente.nome, 200)}, ${texto(a.regime, 40)}, ${Number(a.saude) || 0},
        ${a.resumo?.critico || 0}, ${a.resumo?.atencao || 0}, ${a.resumo?.info || 0},
        ${JSON.stringify(a)}::jsonb, ${item.narrativa ? JSON.stringify(item.narrativa) : null}::jsonb,
        ${texto(req.body?.origem || "upload", 20)}, ${usuario}) RETURNING id, created_at`;
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
