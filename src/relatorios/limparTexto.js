// Cópia da limpeza usada no servidor (server/diagnostic-consultivo.js), para
// também limpar relatórios antigos já gravados que contêm comentários de bastidor
// como "sugestão vinda do detalhe ..." ou códigos internos.
export function limparCodigoInternoRelatorio(valor) {
  return String(valor || "")
    .replace(/\s*\(\s*resposta\s*:\s*['"][^'"]*['"]\s+para\s+[a-z0-9_:-]+\s*\)/gi, "")
    .replace(/\s*[—-]\s*Id\s*:\s*[a-z0-9_:-]+/gi, "")
    .replace(/\s*[—-]\s*Tipo\s*:\s*[a-z0-9_:-]+/gi, "")
    .replace(/\s*[—-]\s*Ligado\s*A\s*:\s*[a-z0-9_:-]+/gi, "")
    .replace(/\s*[—-]\s*Risco\s*Mitigado\s*:\s*[a-z0-9_:-]+/gi, "")
    .replace(/\s*\([a-z0-9_]+\s*=\s*['"][^'"]*['"]\s*\)/gi, "")
    .replace(/\s*[—-]\s*(?:ref|c[oó]digo|codigo)\s*:\s*[a-z0-9_:-]+/gi, "")
    // comentários de bastidor sobre a origem da informação
    .replace(/\s*\(\s*sugest[ãa]o\s+(?:vinda|oriunda|derivada|extra[ií]da|baseada)\s+(?:d[oa]s?|em)\s+(?:detalhe|resposta|campo|observa[çc][ãa]o)[^)]*\)/gi, "")
    .replace(/\s*\(\s*(?:conforme|segundo|de acordo com|com base n[oa]s?|a partir d[oa]s?)\s+(?:o\s+|a\s+)?(?:detalhe|campo|resposta|pergunta|checklist)\b[^)]*\)/gi, "")
    .replace(/\s*\(\s*(?:detalhe|campo|pergunta)\s*:[^)]*\)/gi, "")
    .replace(/[,;]?\s*sugest[ãa]o\s+(?:vinda|oriunda|derivada|extra[ií]da)\s+d[oa]s?\s+detalhe\s+['"“][^'"”]*['"”](?:\s+sobre\s+[^.;,)]+)?/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}
