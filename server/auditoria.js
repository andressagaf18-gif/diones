import { neon } from "@neondatabase/serverless";
import crypto from "crypto";

// Mesma tabela finder_auditoria já criada por api/acessos.js. Este módulo
// não recria o schema todo (evita duplicar lógica), só garante que a
// tabela existe — CREATE TABLE IF NOT EXISTS é idempotente e seguro mesmo
// que api/acessos.js já tenha rodado antes.

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

let schemaPromise = null;

async function garantirTabela() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS
          finder_auditoria (
            id UUID PRIMARY KEY,
            usuario_id UUID,
            usuario_nome TEXT,
            usuario_login TEXT,
            tipo_acesso TEXT,
            acao TEXT NOT NULL,
            modulo TEXT,
            recurso TEXT,
            recurso_id TEXT,
            descricao TEXT,
            antes JSONB,
            depois JSONB,
            detalhes JSONB,
            ip TEXT,
            user_agent TEXT,
            criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
      `;
    })();
  }
  return schemaPromise;
}

function txt(v, n = 1000) {
  return String(v ?? "").trim().slice(0, n);
}

function jsonSeguro(v) {
  if (v == null) return null;
  try {
    JSON.stringify(v);
    return v;
  } catch {
    return null;
  }
}

// =========================================================
// Estágios do funil de "Inteligência Tributária". A ordem aqui é a ordem
// mostrada no funil — cada projeto conta como tendo alcançado o estágio
// mais avançado dentre os eventos que ele já teve.
// =========================================================
export const ACOES_FUNIL_TRIBUTARIO = [
  { acao: "projeto_salvo", rotulo: "Projeto criado/salvo" },
  { acao: "documento_enviado", rotulo: "Documento enviado" },
  { acao: "analise_gerada", rotulo: "Diagnóstico/análise gerado" },
  { acao: "projeto_validado", rotulo: "Validado pelo consultor" },
];

// Nunca lança erro: se a gravação da auditoria falhar, só loga no console
// e segue — auditoria é acessória, não pode derrubar a operação principal
// (upload, geração de diagnóstico etc.).
export async function registrarEventoTributario(req, u, dados = {}) {
  if (!sql) return;
  try {
    await garantirTabela();
    await sql`
      INSERT INTO finder_auditoria
        (id, usuario_id, usuario_nome, usuario_login, tipo_acesso, acao,
         modulo, recurso, recurso_id, descricao, antes, depois, detalhes,
         ip, user_agent)
      VALUES
        (${crypto.randomUUID()}, ${u?.sub || null}, ${u?.nome || ""}, ${u?.login || ""}, ${u?.tipo || ""},
         ${txt(dados.acao, 120) || "ACAO"}, ${"tributario"}, ${txt(dados.recurso, 160) || "projeto_tributario"},
         ${txt(dados.recursoId, 160)}, ${txt(dados.descricao, 2000)},
         ${JSON.stringify(jsonSeguro(dados.antes))}::jsonb,
         ${JSON.stringify(jsonSeguro(dados.depois))}::jsonb,
         ${JSON.stringify(jsonSeguro(dados.detalhes))}::jsonb,
         ${txt(req?.headers?.["x-forwarded-for"] || req?.socket?.remoteAddress, 200)},
         ${txt(req?.headers?.["user-agent"], 500)})
    `;
  } catch (error) {
    console.warn("[auditoria-tributario] falha ao registrar evento:", error?.message || error);
  }
}
