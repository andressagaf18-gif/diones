// server/consentimento-lgpd.js
// Prova do aceite dos Termos de Uso (LGPD) — lead e diagnóstico.
//
// No clique em "Aceitar" o navegador envia a evidência (versão, impressão
// digital do texto, fuso, idioma, tela, aparelho). O SERVIDOR acrescenta o que
// o navegador não pode falsificar com facilidade: o horário do servidor, o IP,
// a localização aproximada (cabeçalhos da Vercel) e o user-agent da requisição.
//
// Regras:
// - a primeira prova de uma versão dos termos nunca é sobrescrita;
// - uma versão nova entra como atual e a anterior vai para o histórico;
// - o diagnóstico herda a prova registrada no lead (momento real do aceite)
//   e acrescenta o contexto do envio;
// - nada é inventado: quem não tem registro aparece como "sem registro".
//
// Fica em server/ (e é roteado por api/crm.js) para NÃO consumir uma função
// serverless — o plano da Vercel limita a 12.

import { neon } from "@neondatabase/serverless";
import crypto from "node:crypto";
import { usuarioAutenticado } from "./auth.js";

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

export const FORMA_ACEITE = "Clique em “Aceitar” no modal de Termos de Uso";
const MAX_TEXTO_TERMOS = 60_000;
const MAX_HISTORICO = 5;
const DATA_MINIMA = new Date("2024-01-01T00:00:00Z").getTime();

// ---------------------------------------------------------
// UTILITÁRIOS PUROS
// ---------------------------------------------------------
function txt(valor, limite = 200) {
  if (valor === null || valor === undefined) return "";
  return String(valor).trim().slice(0, limite);
}

function objeto(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function lista(v) {
  return Array.isArray(v) ? v : [];
}

function cabecalho(req, nome) {
  const h = req?.headers || {};
  const alvo = nome.toLowerCase();
  for (const chave of Object.keys(h)) {
    if (chave.toLowerCase() === alvo) {
      const v = h[chave];
      return String(Array.isArray(v) ? v[0] : v ?? "");
    }
  }
  return "";
}

export function sha256Texto(texto) {
  return crypto.createHash("sha256").update(String(texto ?? ""), "utf8").digest("hex");
}

export function ipDaRequisicao(req) {
  const candidatos = [
    cabecalho(req, "x-forwarded-for").split(",")[0],
    cabecalho(req, "x-real-ip"),
    req?.socket?.remoteAddress || "",
  ];
  for (const bruto of candidatos) {
    const ip = String(bruto || "").trim().replace(/^::ffff:/i, "");
    if (/^[0-9a-fA-F:.]{3,45}$/.test(ip) && (ip.includes(".") || ip.includes(":"))) return ip;
  }
  return "";
}

function decodificar(v) {
  try {
    return decodeURIComponent(String(v || ""));
  } catch {
    return String(v || "");
  }
}

export function geoDaRequisicao(req) {
  const pais = txt(cabecalho(req, "x-vercel-ip-country"), 16).toUpperCase();
  return {
    pais: /^[A-Z]{2}$/.test(pais) ? pais : "",
    regiao: txt(decodificar(cabecalho(req, "x-vercel-ip-country-region")), 40),
    cidade: txt(decodificar(cabecalho(req, "x-vercel-ip-city")), 80),
  };
}

// Valida e limita o que o navegador informa. Nada daqui é tratado como prova
// forte: serve de complemento ao que o servidor registra.
export function evidenciaDoCliente(entrada, agora = Date.now()) {
  const e = objeto(entrada);
  const versao = txt(e.versaoTermos, 40);
  const hash = txt(e.hashTermos, 64).toLowerCase();

  const quando = new Date(e.aceitoEm || e.aceitoEmCliente || "");
  const t = quando.getTime();
  const dataValida = Number.isFinite(t) && t >= DATA_MINIMA && t <= agora + 2 * 86400000;

  const tela = txt(e.tela, 12);
  return {
    versaoTermos: /^[A-Za-z0-9._-]{1,40}$/.test(versao) ? versao : "",
    hashTermos: /^[a-f0-9]{64}$/.test(hash) ? hash : "",
    aceitoEmCliente: dataValida ? quando.toISOString() : "",
    fusoHorario: /^[A-Za-z0-9_+\-/]{1,64}$/.test(txt(e.fusoHorario, 64)) ? txt(e.fusoHorario, 64) : "",
    idioma: /^[A-Za-z0-9_-]{2,20}$/.test(txt(e.idioma, 20)) ? txt(e.idioma, 20) : "",
    tela: /^\d{2,5}x\d{2,5}$/.test(tela) ? tela : "",
    userAgentCliente: txt(e.userAgent || e.userAgentCliente, 400),
  };
}

export function montarRegistro({ req, cliente, agora = new Date(), textoConferido = false }) {
  const servidor = new Date(agora).toISOString();
  const c = cliente || evidenciaDoCliente({});
  const diferenca = c.aceitoEmCliente
    ? Math.round((new Date(servidor).getTime() - new Date(c.aceitoEmCliente).getTime()) / 1000)
    : null;
  const uaServidor = txt(cabecalho(req, "user-agent"), 400);

  return {
    versaoTermos: c.versaoTermos,
    hashTermos: c.hashTermos,
    textoConferido: Boolean(textoConferido),
    registradoEm: servidor,
    aceitoEmCliente: c.aceitoEmCliente,
    diferencaRelogioSeg: diferenca,
    fusoHorario: c.fusoHorario,
    idioma: c.idioma,
    tela: c.tela,
    ip: ipDaRequisicao(req),
    ...geoDaRequisicao(req),
    userAgent: uaServidor || c.userAgentCliente,
    userAgentCliente: c.userAgentCliente && c.userAgentCliente !== uaServidor ? c.userAgentCliente : "",
    forma: FORMA_ACEITE,
  };
}

// A primeira prova de uma versão nunca é sobrescrita. Versão nova => passa a
// ser a atual e a anterior vai para o histórico.
export function mesclarConsentimento(atual, novo) {
  const a = objeto(atual);
  if (!a.hashTermos && !a.registradoEm) return { ...novo, historico: [] };
  if (a.hashTermos && a.hashTermos === novo.hashTermos) return a;
  const { historico, ...anterior } = a;
  return { ...novo, historico: [anterior, ...lista(historico)].slice(0, MAX_HISTORICO) };
}

// ---------------------------------------------------------
// BANCO
// ---------------------------------------------------------
let preparado = null;

function garantir(db) {
  if (!preparado) {
    preparado = (async () => {
      const passos = [
        () => db`ALTER TABLE diagnostico_leads ADD COLUMN IF NOT EXISTS consentimento JSONB`,
        () => db`ALTER TABLE diagnosticos ADD COLUMN IF NOT EXISTS consentimento JSONB`,
        () => db`ALTER TABLE diagnosticos ADD COLUMN IF NOT EXISTS termos_aceitos BOOLEAN NOT NULL DEFAULT FALSE`,
        () => db`ALTER TABLE diagnosticos ADD COLUMN IF NOT EXISTS termos_aceitos_em TIMESTAMPTZ`,
        () => db`
          CREATE TABLE IF NOT EXISTS termos_uso_versoes (
            hash TEXT PRIMARY KEY,
            versao TEXT NOT NULL DEFAULT '',
            texto TEXT NOT NULL,
            criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `,
      ];
      for (const passo of passos) {
        try {
          await passo();
        } catch (erro) {
          // Uma tabela ausente neste contexto não pode derrubar o resto.
          console.warn("[consentimento-lgpd] preparação:", erro?.message || erro);
        }
      }
    })().catch((erro) => {
      preparado = null;
      throw erro;
    });
  }
  return preparado;
}

function enviar(res, status, corpo) {
  return res.status(status).json(corpo);
}

// ---------------------------------------------------------
// ROTA PÚBLICA: registrar o aceite no lead (chamada pelo navegador do cliente)
// ---------------------------------------------------------
async function registrarAceiteInterno(req, res) {
  if (req.method !== "POST") {
    res.setHeader?.("Allow", "POST");
    return enviar(res, 405, { sucesso: false, error: "Método não permitido." });
  }
  if (!sql) return enviar(res, 500, { sucesso: false, error: "DATABASE_URL não configurada." });

  const body = objeto(req.body);
  const sessionId = txt(body.sessionId, 140);
  if (!/^sessao_[A-Za-z0-9_-]{6,120}$/.test(sessionId)) {
    return enviar(res, 400, { sucesso: false, error: "Sessão inválida." });
  }

  const cliente = evidenciaDoCliente(body);
  if (!cliente.hashTermos) {
    return enviar(res, 400, { sucesso: false, error: "Identificação do texto dos termos inválida." });
  }

  const texto = typeof body.textoTermos === "string" ? body.textoTermos : "";
  const textoConferido = Boolean(texto) && texto.length <= MAX_TEXTO_TERMOS && sha256Texto(texto) === cliente.hashTermos;

  await garantir(sql);

  const achados = await sql`
    SELECT id, consentimento FROM diagnostico_leads WHERE session_id = ${sessionId} LIMIT 1
  `;
  const lead = achados?.[0];
  if (!lead) return enviar(res, 404, { sucesso: false, error: "Lead não encontrado para esta sessão." });

  if (textoConferido) {
    await sql`
      INSERT INTO termos_uso_versoes (hash, versao, texto)
      VALUES (${cliente.hashTermos}, ${cliente.versaoTermos}, ${texto})
      ON CONFLICT (hash) DO NOTHING
    `;
  }

  const registro = montarRegistro({ req, cliente, textoConferido });
  const novo = mesclarConsentimento(lead.consentimento, registro);

  if (novo === lead.consentimento) {
    return enviar(res, 200, { sucesso: true, jaRegistrado: true, registradoEm: novo.registradoEm });
  }

  await sql`
    UPDATE diagnostico_leads
    SET consentimento = ${JSON.stringify(novo)}::jsonb, updated_at = NOW()
    WHERE id = ${lead.id}
  `;
  return enviar(res, 200, { sucesso: true, jaRegistrado: false, registradoEm: novo.registradoEm, textoConferido });
}

// ---------------------------------------------------------
// ROTAS DO ADMIN
// ---------------------------------------------------------
function consentimentoValido(c) {
  const o = objeto(c);
  return Boolean(o.registradoEm || o.hashTermos || o.aceitoEmCliente);
}

async function consentimentoObterInterno(req, res) {
  if (!usuarioAutenticado(req)) return enviar(res, 401, { sucesso: false, error: "Não autorizado." });
  if (!sql) return enviar(res, 500, { sucesso: false, error: "DATABASE_URL não configurada." });

  const leadId = txt(req.query?.leadId, 180);
  const diagnosticoId = txt(req.query?.diagnosticoId, 180);
  if (!leadId && !diagnosticoId) {
    return enviar(res, 400, { sucesso: false, error: "Informe leadId ou diagnosticoId." });
  }
  await garantir(sql);

  if (leadId) {
    const l = await sql`SELECT consentimento FROM diagnostico_leads WHERE id = ${leadId} LIMIT 1`;
    if (!l?.[0]) return enviar(res, 404, { sucesso: false, error: "Lead não encontrado." });
    const c = l[0].consentimento;
    return enviar(res, 200, { sucesso: true, fonte: consentimentoValido(c) ? "lead" : "nenhuma", consentimento: consentimentoValido(c) ? c : null });
  }

  const d = await sql`
    SELECT consentimento, termos_aceitos, termos_aceitos_em,
           dados_completos->'crm'->>'leadId' AS lead_id,
           dados_completos->'crm'->>'sessionId' AS session_id
    FROM diagnosticos
    WHERE id::text = ${diagnosticoId}
    LIMIT 1
  `;
  const diag = d?.[0];
  if (!diag) return enviar(res, 404, { sucesso: false, error: "Diagnóstico não encontrado." });

  if (consentimentoValido(diag.consentimento)) {
    return enviar(res, 200, { sucesso: true, fonte: "diagnostico", consentimento: diag.consentimento });
  }

  const doLead = await sql`
    SELECT consentimento FROM diagnostico_leads
    WHERE consentimento IS NOT NULL
      AND (diagnostico_id = ${diagnosticoId}
        OR id = ${txt(diag.lead_id, 180) || "-"}
        OR session_id = ${txt(diag.session_id, 180) || "-"})
    LIMIT 1
  `;
  if (consentimentoValido(doLead?.[0]?.consentimento)) {
    return enviar(res, 200, { sucesso: true, fonte: "lead", consentimento: doLead[0].consentimento });
  }

  if (diag.termos_aceitos_em) {
    return enviar(res, 200, {
      sucesso: true,
      fonte: "legado",
      consentimento: { legado: true, aceitoEmCliente: new Date(diag.termos_aceitos_em).toISOString() },
    });
  }
  return enviar(res, 200, { sucesso: true, fonte: "nenhuma", consentimento: null });
}

async function termosTextoInterno(req, res) {
  if (!usuarioAutenticado(req)) return enviar(res, 401, { sucesso: false, error: "Não autorizado." });
  if (!sql) return enviar(res, 500, { sucesso: false, error: "DATABASE_URL não configurada." });
  const hash = txt(req.query?.hash, 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) return enviar(res, 400, { sucesso: false, error: "Identificação inválida." });
  await garantir(sql);
  const r = await sql`SELECT versao, texto, criado_em FROM termos_uso_versoes WHERE hash = ${hash} LIMIT 1`;
  if (!r?.[0]) return enviar(res, 404, { sucesso: false, error: "Texto desta versão não está guardado." });
  return enviar(res, 200, { sucesso: true, versao: r[0].versao, texto: r[0].texto, guardadoEm: r[0].criado_em });
}

async function protegido(fn, req, res) {
  try {
    return await fn(req, res);
  } catch (erro) {
    console.error("[consentimento-lgpd]", erro);
    return enviar(res, 500, { sucesso: false, error: "Erro interno ao processar o consentimento." });
  }
}

export const registrarAceite = (req, res) => protegido(registrarAceiteInterno, req, res);
export const consentimentoObter = (req, res) => protegido(consentimentoObterInterno, req, res);
export const termosTexto = (req, res) => protegido(termosTextoInterno, req, res);

// ---------------------------------------------------------
// USADOS POR OUTRAS ROTAS
// ---------------------------------------------------------

// Lista de leads: anexa o aceite de cada um em UMA consulta. Nunca derruba a lista.
export async function anexarConsentimentos(db, leads) {
  const itens = Array.isArray(leads) ? leads : [];
  if (!db || !itens.length) return itens;
  try {
    await garantir(db);
    const ids = itens.map((l) => l.leadId).filter(Boolean);
    const linhas = await db`
      SELECT id, consentimento FROM diagnostico_leads
      WHERE id = ANY(${ids}) AND consentimento IS NOT NULL
    `;
    const mapa = new Map((linhas || []).map((r) => [r.id, r.consentimento]));
    for (const l of itens) l.consentimento = mapa.get(l.leadId) || null;
  } catch (erro) {
    console.warn("[consentimento-lgpd] não foi possível anexar o aceite aos leads:", erro?.message || erro);
    for (const l of itens) if (l.consentimento === undefined) l.consentimento = null;
  }
  return itens;
}

// Ao salvar o diagnóstico: herda a prova do lead (momento real do aceite) e
// acrescenta o contexto do envio. Sem prova no lead, registra o que o
// navegador informou e deixa claro que foi registrado no envio.
export async function consentimentoDoDiagnostico({ db, req, body, agora = new Date() }) {
  const b = objeto(body);
  const bruto = objeto(b.consentimento);
  const cliente = evidenciaDoCliente({ ...bruto, aceitoEm: bruto.aceitoEm || b.termosAceitosEm });
  const aceitou = b.termosAceitos === true;

  let doLead = null;
  try {
    if (db) {
      await garantir(db);
      const crm = objeto(b.crm);
      const leadId = txt(crm.leadId, 180) || "-";
      const sessionId = txt(crm.sessionId, 180) || "-";
      const r = await db`
        SELECT consentimento FROM diagnostico_leads
        WHERE consentimento IS NOT NULL AND (id = ${leadId} OR session_id = ${sessionId})
        LIMIT 1
      `;
      if (consentimentoValido(r?.[0]?.consentimento)) doLead = r[0].consentimento;
    }
  } catch (erro) {
    console.warn("[consentimento-lgpd] prova do lead indisponível:", erro?.message || erro);
  }

  if (!aceitou && !doLead && !cliente.hashTermos) return null;

  const envio = montarRegistro({ req, cliente, agora });
  if (doLead) {
    return {
      ...doLead,
      origemDoRegistro: "lead",
      envio: { registradoEm: envio.registradoEm, ip: envio.ip, pais: envio.pais, regiao: envio.regiao, cidade: envio.cidade, userAgent: envio.userAgent },
    };
  }
  return { ...envio, historico: [], origemDoRegistro: "diagnostico" };
}
