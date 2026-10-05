// src/lgpd/aceiteTermos.js
// Evidência do aceite dos Termos de Uso, montada no navegador do cliente.
//
// O navegador informa: versão dos termos, impressão digital (SHA-256) do texto
// EXATO exibido, momento do clique, fuso, idioma, tela e aparelho. O servidor
// acrescenta horário próprio, IP e localização aproximada.

export const CHAVE_EVIDENCIA = "finder_termos_uso_evidencia_v1";
export const CHAVE_SINCRONIZADO = "finder_termos_uso_sync_v1";

function armazenamento(storage) {
  if (storage) return storage;
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

// SHA-256 em hexadecimal. Exige contexto seguro (https/localhost), que é o caso
// em produção; em outro contexto devolve "" e o servidor recusa a evidência.
export async function sha256Hex(texto) {
  const dados = new TextEncoder().encode(String(texto ?? ""));
  const resumo = await globalThis.crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(resumo))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function montarEvidenciaAceite({ texto, versao, aceitoEm = new Date().toISOString(), ambiente = globalThis }) {
  let hash = "";
  try {
    hash = await sha256Hex(texto);
  } catch {
    hash = "";
  }

  const nav = ambiente.navigator || {};
  const tela = ambiente.screen;
  let fuso = "";
  try {
    fuso = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    fuso = "";
  }

  return {
    versaoTermos: String(versao || ""),
    hashTermos: hash,
    aceitoEm,
    fusoHorario: fuso,
    idioma: String(nav.language || ""),
    tela: tela && tela.width && tela.height ? `${tela.width}x${tela.height}` : "",
    userAgent: String(nav.userAgent || "").slice(0, 400),
  };
}

export function lerEvidenciaSalva(storage) {
  const s = armazenamento(storage);
  if (!s) return null;
  try {
    const v = JSON.parse(s.getItem(CHAVE_EVIDENCIA) || "null");
    return v && typeof v === "object" && v.aceitoEm && typeof v.hashTermos === "string" ? v : null;
  } catch {
    return null;
  }
}

export function salvarEvidencia(evidencia, storage) {
  const s = armazenamento(storage);
  if (!s) return false;
  try {
    s.setItem(CHAVE_EVIDENCIA, JSON.stringify(evidencia));
    return true;
  } catch {
    return false;
  }
}

export function aceiteJaEnviado(sessionId, hash, storage) {
  const s = armazenamento(storage);
  if (!s) return false;
  try {
    return s.getItem(CHAVE_SINCRONIZADO) === `${sessionId}|${hash}`;
  } catch {
    return false;
  }
}

export function marcarAceiteEnviado(sessionId, hash, storage) {
  const s = armazenamento(storage);
  if (!s) return false;
  try {
    s.setItem(CHAVE_SINCRONIZADO, `${sessionId}|${hash}`);
    return true;
  } catch {
    return false;
  }
}

// Envia o aceite ao lead da sessão. Devolve true só se o servidor confirmou.
export async function registrarAceiteNoLead({ sessionId, evidencia, texto, fetchFn }) {
  const chamar = fetchFn || globalThis.fetch;
  try {
    const resposta = await chamar("/api/crm?action=registrar-aceite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, ...evidencia, textoTermos: texto }),
    });
    const dados = await resposta.json().catch(() => null);
    return Boolean(resposta.ok && dados?.sucesso);
  } catch {
    return false;
  }
}

// O que acompanha o diagnóstico quando ele é salvo (sem o texto dos termos).
export function evidenciaParaPayload(evidencia) {
  if (!evidencia) return null;
  const { versaoTermos, hashTermos, aceitoEm, fusoHorario, idioma, tela, userAgent } = evidencia;
  return { versaoTermos, hashTermos, aceitoEm, fusoHorario, idioma, tela, userAgent };
}

// ---------------------------------------------------------
// TRAVA DE ACEITE (quem entra pelo link precisa aceitar para continuar)
// ---------------------------------------------------------

// O aceite só vale se for da versão ATUAL dos termos e se existir comprovante.
// Quando dá para conferir, o texto exato também precisa ser o mesmo: assim, se o texto
// for alterado sem trocar o número da versão, todos aceitam de novo mesmo assim.
export function aceiteVigente({ aceito, evidencia, versaoAtual, hashAtual }) {
  if (!aceito) return false;
  if (!evidencia || typeof evidencia !== "object" || !evidencia.aceitoEm) return false;
  if (String(evidencia.versaoTermos || "") !== String(versaoAtual || "")) return false;
  const guardado = String(evidencia.hashTermos || "");
  const atual = String(hashAtual || "");
  if (guardado && atual && guardado !== atual) return false;
  return true;
}

// Por que a pessoa está vendo a tela de aceite:
//   primeiro     -> nunca aceitou
//   nova_versao  -> aceitou uma versão (ou um texto) que não é mais o atual
//   sem_registro -> aceitou antes de existir comprovante; precisa registrar de novo
export function motivoAceite({ aceito, evidencia }) {
  if (evidencia && typeof evidencia === "object" && evidencia.aceitoEm) return "nova_versao";
  if (aceito) return "sem_registro";
  return "primeiro";
}

// Evidência mínima para quando não foi possível montar a completa: a pessoa nunca fica presa na tela de aceite.
export function evidenciaMinima({ versao, aceitoEm }) {
  return { versaoTermos: String(versao || ""), hashTermos: "", aceitoEm, fusoHorario: "", idioma: "", tela: "", userAgent: "" };
}
