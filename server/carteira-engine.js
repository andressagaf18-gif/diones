// server/carteira-engine.js — modelo de obrigações por regime (baseado na planilha "Controle da carteira fiscal e contábil")
// e cálculo da situação de cada obrigação de cada cliente numa competência.
const pad = (n) => String(n).padStart(2, "0");
const sem = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// prazo: { dia: N } = dia N do mês seguinte à competência · { util: N } = N-ésimo dia útil do mês seguinte
export const OBRIGACOES = [
  { key: "pgdas", rotulo: "PGDAS", tipo: "declaracao", regimes: ["SIMPLES"], nucleo: true, prazo: { dia: 20 } },
  { key: "das", rotulo: "DAS", tipo: "guia", regimes: ["SIMPLES"], prazo: { dia: 20 } },
  { key: "efd_contrib", rotulo: "EFD Contrib.", tipo: "declaracao", regimes: ["PRESUMIDO", "REAL"], prazo: { util: 10 } },
  { key: "efd_fiscal", rotulo: "EFD Fiscal", tipo: "declaracao", regimes: ["PRESUMIDO", "REAL"], prazo: { dia: 12 } },
  { key: "dime", rotulo: "DIME SC", tipo: "declaracao", regimes: ["PRESUMIDO", "REAL", "SIMPLES"], prazo: { dia: 10 } },
  { key: "gia", rotulo: "GIA RS", tipo: "declaracao", regimes: ["PRESUMIDO", "REAL", "SIMPLES"], prazo: { dia: 15 } },
  { key: "mit", rotulo: "MIT", tipo: "declaracao", regimes: ["PRESUMIDO", "REAL"], nucleo: true, prazo: { util: 25 } },
  { key: "dctfweb", rotulo: "DCTFWeb", tipo: "declaracao", regimes: ["PRESUMIDO", "REAL", "SIMPLES"], prazo: { util: 30 } },
  { key: "reinf", rotulo: "EFD Reinf", tipo: "declaracao", regimes: ["PRESUMIDO", "REAL", "SIMPLES"], prazo: { dia: 15 } },
  { key: "icms", rotulo: "ICMS", tipo: "guia", regimes: ["PRESUMIDO", "REAL"], prazo: { dia: 10 } },
  { key: "iss", rotulo: "ISS", tipo: "guia", regimes: ["PRESUMIDO", "REAL"], prazo: { dia: 11 } },
  { key: "pis_cofins", rotulo: "PIS/COFINS", tipo: "guia", regimes: ["PRESUMIDO", "REAL"], prazo: { dia: 23 } },
  { key: "irpj_csll", rotulo: "IRPJ/CSLL", tipo: "guia", regimes: ["PRESUMIDO", "REAL"], prazo: { dia: 23 } },
];
export const textoPrazo = (o) => (o.prazo.dia ? `até o dia ${o.prazo.dia}` : `${o.prazo.util}º dia útil`);

// Reconhece a obrigação pelo caminho da pasta + nome do arquivo (texto livre, sem acento).
export function classificarObrigacao(caminhoPastas, nomeArquivo = "", tipoDoc = "") {
  const pasta = sem(caminhoPastas), nome = sem(nomeArquivo), t = sem(tipoDoc), tudo = `${pasta} ${nome} ${t}`;
  if (/reinf/.test(tudo)) return "reinf";
  if (/\bmit\b|mit[-_ ]?\d{6}/.test(nome) || (/\bmit\b/.test(pasta) && !/dctfweb/.test(nome))) return "mit";
  if (/dctf ?web|recibo dctf/.test(tudo)) return "dctfweb";
  if (/sped contribui|efd.{0,3}contribui|efd contrib/.test(tudo)) return "efd_contrib";
  if (/sped fiscal|efd icms|sped icms|icms.{0,3}ipi|efd fiscal/.test(tudo)) return "efd_fiscal";
  if (/\bdime\b/.test(tudo)) return "dime";
  if (/\bgia\b/.test(tudo)) return "gia";
  const guia = /guia|darf|\bdas\b|\bdam\b|gnre|\bdua\b|boleto|comprovante de pag|recibo de pag/.test(`${nome} ${t}`) || /guias/.test(pasta);
  const nomeGuiaDas = /guia|\bdas\b/.test(nome);
  if (/pgdas|extrato do simples|declaracao.*simples|recibo.*(pgdas|simples)/.test(`${nome} ${t}`) && !nomeGuiaDas) return "pgdas";
  if (/pgdas|simples/.test(pasta) && !guia && !nomeGuiaDas) return "pgdas";
  if (guia) {
    if (/\bdas\b|simples/.test(`${nome} ${t}`)) return "das";
    if (/irpj|csll|2089|2372/.test(nome)) return "irpj_csll";
    if (/pis|cofins|8109|2172/.test(nome)) return "pis_cofins";
    if (/icms|gnre|\bdua\b|sefaz/.test(`${nome} ${pasta}`)) return "icms";
    if (/\biss\b|\bdam\b|prefeitura|iss ?retido|issqn/.test(`${nome} ${pasta}`)) return "iss";
  }
  return "";
}

// ---- datas ----
const FERIADOS_FIXOS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "12-25"];
const ehUtil = (d) => { const w = d.getUTCDay(); return w !== 0 && w !== 6 && !FERIADOS_FIXOS.includes(`${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`); };
function nUtil(ano, mes, n) { // mes 1..12
  let c = 0;
  for (let dia = 1; dia <= 31; dia++) { const d = new Date(Date.UTC(ano, mes - 1, dia)); if (d.getUTCMonth() !== mes - 1) break; if (ehUtil(d)) { c += 1; if (c === n) return `${ano}-${pad(mes)}-${pad(dia)}`; } }
  return `${ano}-${pad(mes)}-28`;
}
export function prazoDe(competencia, obrigacao) {
  const [y, m] = competencia.split("-").map(Number);
  const ano = m === 12 ? y + 1 : y, mes = m === 12 ? 1 : m + 1;
  if (obrigacao.prazo.util) return nUtil(ano, mes, obrigacao.prazo.util);
  const ult = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${pad(mes)}-${pad(Math.min(obrigacao.prazo.dia, ult))}`;
}
export const mesAnteriorDe = (hoje) => { const y = hoje.getUTCFullYear(), m = hoje.getUTCMonth() + 1; return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`; };

// ---- regime ----
export function normalizarRegime(txt) {
  const t = sem(txt);
  if (!t) return "";
  if (/mei/.test(t)) return "MEI";
  if (/presum/.test(t)) return "PRESUMIDO";
  if (/real/.test(t)) return "REAL";
  if (/simples/.test(t)) return "SIMPLES";
  return "";
}
export const ROTULO_REGIME = { SIMPLES: "Simples Nacional", MEI: "MEI", PRESUMIDO: "Lucro Presumido", REAL: "Lucro Real", "": "Não identificado" };

// Regime pela movimentação da pasta: o que foi entregue/guiado nos últimos meses mostra o regime em que a empresa opera.
const SIMPLES_KEYS = ["pgdas", "das"], LUCRO_KEYS = ["mit", "efd_contrib", "efd_fiscal", "irpj_csll", "pis_cofins"];
export function inferirRegime(ob, regimePasta = "") {
  if (!ob) return "";
  const ultimo = (keys) => { let u = ""; for (const [m, v] of Object.entries(ob)) if (keys.some((k) => v?.[k]) && m > u) u = m; return u; };
  const s = ultimo(SIMPLES_KEYS), l = ultimo(LUCRO_KEYS);
  if (!s && !l) return "";
  if (s && (!l || s >= l)) return "SIMPLES";
  const r = normalizarRegime(regimePasta);
  return r === "REAL" ? "REAL" : "PRESUMIDO";
}

// ---- situação de cada obrigação ----
// painel.obrigacoes = { "AAAA-MM": { chave: { n, primeiro, ultimo, nome, semMovimento? } } }
// extras.semMovimento = [ "AAAA-MM", ... ] (da auditoria de apurações)
export function situacaoCliente({ painel, cadastro, competencia, hoje = new Date(), extras = {} }) {
  // Prioridade: escolha manual > movimentação da pasta (Drive) > regime detectado na pasta > planilha.
  const manual = normalizarRegime(cadastro?.regimeManual);
  const auto = inferirRegime(painel?.obrigacoes, painel?.regime) || normalizarRegime(painel?.regime);
  const planilha = normalizarRegime(cadastro?.regime);
  const regime = manual || auto || planilha || "";
  const regimeFonte = manual ? "manual" : auto ? "pasta" : planilha ? "planilha" : "";
  const grupoRegime = regime === "MEI" ? "SIMPLES" : regime;
  const ob = painel?.obrigacoes || null;
  const hojeIso = hoje.toISOString().slice(0, 10);
  const meses = ob ? Object.keys(ob) : [];
  const semMitMes = new Set(extras.semMovimento || []);
  const itens = [];
  for (const o of OBRIGACOES) {
    const aplica = grupoRegime ? o.regimes.includes(grupoRegime) : false;
    const prazo = prazoDe(competencia, o);
    const evidencia = meses.some((m) => ob[m]?.[o.key]);
    const reg = ob?.[competencia]?.[o.key];
    let status = "na", semMov = false;
    if (!ob) status = "na"; // pasta ainda não lida: não dá para afirmar que falta algo
    else if (!aplica && !reg) status = "na";
    else if (reg) {
      semMov = !!reg.semMovimento || ((o.key === "mit" || o.key === "pgdas") && semMitMes.has(competencia));
      status = semMov ? "sem_movimento" : (reg.primeiro && reg.primeiro > prazo ? "atraso" : "no_prazo");
    } else if ((o.key === "mit" || o.key === "pgdas") && semMitMes.has(competencia)) { semMov = true; status = "sem_movimento"; }
    else if (aplica && (o.nucleo || evidencia)) status = hojeIso > prazo ? "faltando" : "a_vencer";
    else status = "na";
    // sem movimento no PGDAS/MIT: não há guia a pagar naquele mês
    itens.push({ key: o.key, rotulo: o.rotulo, tipo: o.tipo, status, prazo, postadoEm: reg?.primeiro || "", arquivo: reg?.nome || "", diasAtraso: status === "atraso" ? Math.round((Date.parse(reg.primeiro) - Date.parse(prazo)) / 86400000) : 0, semMovimento: semMov });
  }
  const semMovDecl = itens.some((i) => (i.key === "pgdas" || i.key === "mit") && i.status === "sem_movimento");
  if (semMovDecl) for (const i of itens) if (i.tipo === "guia" && i.status === "faltando") i.status = "na";
  const conta = (s) => itens.filter((i) => i.status === s).length;
  return { regime, regimeFonte, regimeAuto: auto, regimePlanilha: planilha, regimeManual: manual, semLeitura: !ob, itens, faltando: conta("faltando"), atraso: conta("atraso"), noPrazo: conta("no_prazo"), semMovimento: conta("sem_movimento"), aVencer: conta("a_vencer") };
}
