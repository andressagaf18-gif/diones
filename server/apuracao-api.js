// server/apuracao-api.js — ações da Auditoria de apurações (roteadas por api/tributario.js).
import { neon } from "@neondatabase/serverless";
import { auditarApuracaoDrive } from "./apuracao-drive.js";

const sql = neon(process.env.DATABASE_URL);
const enviar = (res, status, corpo) => res.status(status).json(corpo);
const texto = (v, n = 300) => String(v ?? "").trim().slice(0, n);

let pronta = null;
function garantirTabela() {
  if (!pronta) {
    pronta = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS apuracao_auditorias (
        id BIGSERIAL PRIMARY KEY,
        cliente_codigo TEXT NOT NULL,
        cliente_nome TEXT NOT NULL,
        regime TEXT,
        saude INTEGER,
        criticos INTEGER DEFAULT 0,
        atencoes INTEGER DEFAULT 0,
        infos INTEGER DEFAULT 0,
        resultado JSONB NOT NULL,
        usuario TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS apuracao_auditorias_cliente_idx ON apuracao_auditorias (cliente_codigo, created_at DESC)`;
    })().catch((e) => { pronta = null; throw e; });
  }
  return pronta;
}

export async function apuracaoAuditar(req, res) {
  if (req.method !== "POST") return enviar(res, 405, { sucesso: false, error: "Use POST." });
  await garantirTabela();
  const { pastaId, codigo, nome, raiz } = req.body || {};
  if (!pastaId || !codigo) return enviar(res, 400, { sucesso: false, error: "Informe a pasta do cliente." });
  const a = await auditarApuracaoDrive({ pastaId, codigo: texto(codigo, 30), nome: texto(nome, 200), raiz: texto(raiz, 200) });
  const [l] = await sql`INSERT INTO apuracao_auditorias (cliente_codigo, cliente_nome, regime, saude, criticos, atencoes, infos, resultado, usuario)
    VALUES (${texto(codigo, 30)}, ${texto(nome, 200)}, ${a.regime}, ${a.saude}, ${a.resumo.critico}, ${a.resumo.atencao}, ${a.resumo.info}, ${JSON.stringify(a)}::jsonb, ${texto(req.body?.usuario, 120)}) RETURNING id, created_at`;
  return enviar(res, 200, { sucesso: true, id: l?.id, criadoEm: l?.created_at, auditoria: a });
}

export async function apuracaoPainel(req, res) {
  await garantirTabela();
  const linhas = await sql`
    SELECT DISTINCT ON (cliente_codigo) id, cliente_codigo, cliente_nome, regime, saude, criticos, atencoes, infos, created_at,
      resultado->>'declaracoes' AS declaracoes, resultado->>'aviso' AS aviso, resultado->'entregas' AS entregas
    FROM apuracao_auditorias ORDER BY cliente_codigo, created_at DESC, id DESC LIMIT 700`;
  return enviar(res, 200, { sucesso: true, clientes: linhas });
}

export async function apuracaoObter(req, res) {
  await garantirTabela();
  const id = Number(req.query?.id);
  const codigo = texto(req.query?.codigo, 30);
  let atual;
  if (Number.isFinite(id)) [atual] = await sql`SELECT id, cliente_codigo, resultado, created_at FROM apuracao_auditorias WHERE id = ${id}`;
  else if (codigo) [atual] = await sql`SELECT id, cliente_codigo, resultado, created_at FROM apuracao_auditorias WHERE cliente_codigo = ${codigo} ORDER BY created_at DESC, id DESC LIMIT 1`;
  if (!atual) return enviar(res, 404, { sucesso: false, error: "Nenhuma auditoria de apuração para este cliente." });
  const historico = await sql`SELECT id, saude, criticos, atencoes, infos, created_at FROM apuracao_auditorias WHERE cliente_codigo = ${atual.cliente_codigo} ORDER BY created_at DESC, id DESC LIMIT 24`;
  return enviar(res, 200, { sucesso: true, atual, historico });
}
