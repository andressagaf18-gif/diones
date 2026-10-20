// server/pasta-drive.js — leitura da pasta compartilhada no Google Drive (conta de serviço).
// Variáveis de ambiente: GOOGLE_SERVICE_ACCOUNT_JSON (JSON completo da chave) e PASTA_DRIVE_ROOT_ID (ID da pasta raiz dos clientes).
import { createSign } from "node:crypto";
import pdf from "pdf-parse/lib/pdf-parse.js";
import { auditarCliente, extrairFatosDeTexto, extrairFatosNota, PADRAO_PASTAS } from "./pasta-engine.js";

const enviar = (res, status, corpo) => res.status(status).json(corpo);
const b64 = (v) => Buffer.from(v).toString("base64url");

let cacheToken = { valor: "", expira: 0 };

function lerJsonDaChave(bruto) {
  let t = String(bruto || "").trim().replace(/^\uFEFF/, "");
  // Aspas externas coladas por engano.
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) t = t.slice(1, -1).trim();
  const tentativas = [
    () => JSON.parse(t),
    // Quebras de linha reais dentro da chave privada (colagem que perdeu o \n).
    () => JSON.parse(t.replace(/"(?:[^"\\]|\\.)*"/gs, (m) => m.replace(/\r?\n/g, "\\n"))),
    // Barras escapadas duas vezes.
    () => JSON.parse(t.replace(/\\"/g, '"')),
    // Chave enviada em base64.
    () => JSON.parse(Buffer.from(t, "base64").toString("utf8")),
  ];
  for (const f of tentativas) {
    try { const j = f(); if (j && typeof j === "object") return j; } catch { /* tenta a próxima */ }
  }
  return null;
}

function credenciais() {
  const bruto = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "";
  if (!bruto) throw new Error("Google Drive não configurado: falta a variável GOOGLE_SERVICE_ACCOUNT_JSON.");
  const j = lerJsonDaChave(bruto);
  if (!j) {
    const t = bruto.trim();
    throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON não é um JSON válido (tamanho ${t.length}, começa com “${t.slice(0, 1)}”, termina com “${t.slice(-1)}”). Cole o arquivo .json inteiro, do primeiro “{” ao último “}”.`);
  }
  if (!j.client_email || !j.private_key) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON incompleto: faltam client_email/private_key. Use a chave da conta de serviço (tipo JSON).");
  return { email: j.client_email, chave: String(j.private_key).replace(/\\n/g, "\n") };
}

async function token() {
  if (cacheToken.valor && Date.now() < cacheToken.expira - 60000) return cacheToken.valor;
  const { email, chave } = credenciais();
  const agora = Math.floor(Date.now() / 1000);
  const cab = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = b64(JSON.stringify({ iss: email, scope: "https://www.googleapis.com/auth/drive.readonly", aud: "https://oauth2.googleapis.com/token", iat: agora, exp: agora + 3600 }));
  const assinatura = createSign("RSA-SHA256").update(`${cab}.${corpo}`).sign(chave, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${cab}.${corpo}.${assinatura}` }),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d?.access_token) throw new Error("O Google recusou a chave da conta de serviço: " + (d?.error_description || d?.error || r.status));
  cacheToken = { valor: d.access_token, expira: Date.now() + (d.expires_in || 3600) * 1000 };
  return cacheToken.valor;
}

async function drive(caminho, params = {}) {
  const t = await token();
  const q = new URLSearchParams({ supportsAllDrives: "true", includeItemsFromAllDrives: "true", ...params });
  const r = await fetch(`https://www.googleapis.com/drive/v3/${caminho}?${q}`, { headers: { Authorization: `Bearer ${t}` }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) {
    const d = await r.json().catch(() => null);
    throw new Error(`Drive (${r.status}): ${d?.error?.message || "falha ao consultar"}`);
  }
  return r;
}

async function listarFilhos(pastaId) {
  const itens = [];
  let pagina = "";
  do {
    const r = await drive("files", { q: `'${pastaId}' in parents and trashed = false`, fields: "nextPageToken, files(id,name,mimeType,size,modifiedTime)", pageSize: "1000", ...(pagina ? { pageToken: pagina } : {}) });
    const d = await r.json();
    itens.push(...(d.files || []));
    pagina = d.nextPageToken || "";
  } while (pagina);
  return itens;
}

const PASTA = "application/vnd.google-apps.folder";

// Mesma montagem de linhas usada no navegador (itens na mesma linha separados por espaço).
async function paginaComoTexto(pagina) {
  const c = await pagina.getTextContent();
  let y = null;
  let saida = "";
  for (const it of c.items) {
    const yy = Math.round(it.transform?.[5] ?? 0);
    if (y !== null && Math.abs(yy - y) > 2) saida += "\n";
    else if (y !== null) saida += " ";
    saida += it.str;
    y = yy;
  }
  return saida + "\n";
}

export async function listarClientesDrive() {
  const bruto = String(process.env.PASTA_DRIVE_ROOT_ID || "").trim();
  // Aceita o ID puro ou a URL inteira da pasta.
  const raiz = (bruto.match(/folders\/([A-Za-z0-9_-]+)/) || [])[1] || bruto.replace(/[?&#].*$/, "").replace(/^["']|["']$/g, "").trim();
  if (!raiz) { const e = new Error("Falta a variável PASTA_DRIVE_ROOT_ID (ID da pasta raiz dos clientes)."); e.status = 503; throw e; }
  if (!/^[A-Za-z0-9_-]{10,}$/.test(raiz)) { const e = new Error(`PASTA_DRIVE_ROOT_ID inválido (tamanho ${raiz.length}). O ID da pasta tem letras e números, cerca de 33 caracteres, e fica depois de “folders/” na URL.`); e.status = 503; throw e; }
  let filhos;
  try { filhos = await listarFilhos(raiz); }
  catch (e) {
    if (/\(404\)/.test(e.message)) {
      let quem = "";
      try { quem = credenciais().email; } catch { /* já tratado */ }
      throw new Error(`O Drive não encontrou a pasta ${raiz.slice(0, 6)}…${raiz.slice(-4)} (${raiz.length} caracteres). Confira o ID e se a pasta foi compartilhada, como Leitor, com ${quem}.`);
    }
    throw e;
  }
  const clientes = filhos
    .filter((f) => f.mimeType === PASTA)
    .map((f) => ({ id: f.id, raiz: f.name, m: f.name.match(PADRAO_PASTAS.raizCliente) }))
    .filter((f) => f.m)
    .map((f) => ({ id: f.id, raiz: f.raiz, codigo: f.m[1], nome: f.m[2].trim() }))
    .sort((a, b) => Number(a.codigo) - Number(b.codigo));
  const ignoradas = filhos.filter((f) => f.mimeType === PASTA && !PADRAO_PASTAS.raizCliente.test(f.name)).map((f) => f.name);
  return { clientes, ignoradas };
}

export async function driveClientes(req, res) {
  try {
    const r = await listarClientesDrive();
    return enviar(res, 200, { sucesso: true, ...r });
  } catch (e) {
    if (e.status) return enviar(res, e.status, { sucesso: false, error: e.message });
    throw e;
  }
}

async function varrer(pastaId, prefixo, saida, limite) {
  const fila = [{ id: pastaId, caminho: prefixo }];
  while (fila.length && saida.length < limite) {
    const { id, caminho } = fila.shift();
    const filhos = await listarFilhos(id);
    for (const f of filhos) {
      const c = caminho ? `${caminho}/${f.name}` : f.name;
      if (f.mimeType === PASTA) { saida.push({ caminho: c, tipo: "pasta" }); fila.push({ id: f.id, caminho: c }); }
      else saida.push({ caminho: c, tipo: "arquivo", tamanho: Number(f.size || 0), modificadoEm: f.modifiedTime, _id: f.id, _mime: f.mimeType });
    }
  }
}

async function baixar(id) {
  let ultimo;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await drive(`files/${id}`, { alt: "media" });
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      ultimo = e;
      // Limite de requisições / instabilidade do Drive: espera e tenta de novo.
      if (!/\((403|408|429|500|502|503|504)\)|timeout|aborted|fetch failed/i.test(String(e.message))) break;
      await new Promise((ok) => setTimeout(ok, 500 * 2 ** i));
    }
  }
  throw ultimo;
}

async function emLotes(lista, tamanho, fn) {
  for (let i = 0; i < lista.length; i += tamanho) await Promise.all(lista.slice(i, i + tamanho).map(fn));
}

export async function auditarPastaDrive({ pastaId, codigo, nome, raiz, regime = "AUTO", inicio = "", outros = [], limiteMs = 42000 }) {
  const outrosClientes = (Array.isArray(outros) ? outros : []).slice(0, 700).map((o) => ({ codigo: String(o.codigo || ""), nome: String(o.nome || "").slice(0, 120), cnpj: String(o.cnpj || "").replace(/\D/g, "").slice(0, 14) }));
  const inicioT = Date.now();
  const entradas = [];
  await varrer(String(pastaId), "", entradas, 6000);

  // Prioriza o que mais importa para as regras; o resto é avaliado só pelo nome/pasta.
  const prioridade = (e) => (/simples|cnds|parcel|pcto|nota|dctf/i.test(e.caminho) ? 0 : 1);
  const candidatos = entradas
    .filter((e) => e.tipo === "arquivo" && ((/\.pdf$/i.test(e.caminho) && e.tamanho < 8 * 1024 * 1024) || (/\.xml$/i.test(e.caminho) && e.tamanho < 600000)))
    .sort((a, b) => prioridade(a) - prioridade(b))
    .slice(0, 90);

  const fatos = {};
  let lidos = 0;
  await emLotes(candidatos, 4, async (e) => {
    if (Date.now() - inicioT > limiteMs) return; // folga para o limite da função
    const nomeArq = e.caminho.split("/").pop();
    try {
      const buf = await baixar(e._id);
      if (/\.pdf$/i.test(nomeArq)) {
        const d = await pdf(buf, { max: 4, pagerender: paginaComoTexto });
        fatos[e.caminho] = extrairFatosDeTexto(nomeArq, d.text || "");
      } else {
        const f = extrairFatosNota(nomeArq, buf.toString("utf8"));
        if (f) fatos[e.caminho] = f;
      }
      lidos += 1;
    } catch (erro) { fatos[e.caminho] = { nome: nomeArq, legivel: false, erro: String(erro?.message || erro).slice(0, 140) }; }
  });

  const limpas = entradas.map(({ _id, _mime, ...r }) => r);
  const auditoria = auditarCliente({ cliente: { codigo, nome: nome || "", raiz: raiz || "", entradas: limpas }, regime, fatos, inicioObrigacoes: inicio, hoje: new Date(), outrosClientes });
  auditoria.cliente.driveId = String(pastaId);
  return { auditoria, parcial: candidatos.length > lidos, documentosLidos: lidos, documentosCandidatos: candidatos.length };
}

export async function driveAuditar(req, res) {
  if (req.method !== "POST") return enviar(res, 405, { sucesso: false, error: "Use POST." });
  const { pastaId, codigo, nome, raiz, regime = "AUTO", inicio = "", outros = [] } = req.body || {};
  if (!pastaId || !codigo) return enviar(res, 400, { sucesso: false, error: "Informe a pasta do cliente." });
  const r = await auditarPastaDrive({ pastaId, codigo, nome, raiz, regime, inicio, outros });
  return enviar(res, 200, { sucesso: true, ...r });
}

export { varrer, baixar, paginaComoTexto, emLotes };
