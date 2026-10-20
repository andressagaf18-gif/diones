// server/presumido-engine.js — auditoria da apuração de Lucro Presumido (e leitura da MIT/DCTFWeb para Lucro Real).
// Lê: MIT (JSON), demonstrativos do IRPJ/CSLL, PIS/COFINS, ISS, DARFs e DAM do ISS; recalcula e confronta tudo.
import { num, brlN } from "./apuracao-engine.js";

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const chave = (a, m) => `${a}-${String(m).padStart(2, "0")}`;
const rot = (k) => `${k.slice(5, 7)}/${k.slice(0, 4)}`;
const N = "([\\d.]+,\\d{2})";
const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const norm = (t) => String(t || "").replace(/\r/g, "").replace(/[ \t]+/g, " ");
const pega = (t, re) => { const m = t.match(re); return m ? num(m[1]) : null; };
const mesCompetencia = (t) => { const m = t.match(/Compet[eê]ncia:?\s*(0[1-9]|1[0-2])\/(\d{4})/i); return m ? chave(+m[2], +m[1]) : ""; };

// ---------- MIT (JSON) ----------
const GRUPOS_MIT = { Irpj: "IRPJ", Csll: "CSLL", Pis: "PIS", PisPasep: "PIS", Cofins: "COFINS", Ipi: "IPI", Iof: "IOF", Irrf: "IRRF", ContribuicoesDiversas: "CONTRIB. DIVERSAS", Cpss: "CPSS", RetPagamentoUnificado: "RET/PAGAMENTO UNIFICADO" };
export function lerMit(texto, nomeArq = "") {
  let j;
  try { j = JSON.parse(String(texto).replace(/^﻿/, "")); } catch { return null; }
  const p = j?.PeriodoApuracao;
  if (!p || !j?.DadosIniciais) return null;
  const debitos = {};
  const itens = [];
  for (const [grupo, v] of Object.entries(j.Debitos || {})) {
    const lista = v?.ListaDebitos || v?.Debitos || [];
    const nome = GRUPOS_MIT[grupo] || grupo.toUpperCase();
    for (const it of Array.isArray(lista) ? lista : []) {
      const valor = Number(it.ValorDebito ?? it.Valor ?? 0) || 0;
      debitos[nome] = r2((debitos[nome] || 0) + valor);
      itens.push({ tributo: nome, codigo: String(it.CodigoDebito || ""), valor });
    }
  }
  return {
    arquivo: nomeArq, tipo: "MIT", pa: chave(+p.AnoApuracao, +p.MesApuracao),
    semMovimento: j.DadosIniciais.SemMovimento === true, tributacaoLucro: j.DadosIniciais.TributacaoLucro ?? null,
    debitos, itens, totalDebitos: r2(Object.values(debitos).reduce((s, v) => s + v, 0)),
  };
}

// ---------- Demonstrativos (PDF do sistema contábil) ----------
function secao(t, titulo) {
  const re = new RegExp(titulo, "i");
  const a = t.search(re);
  if (a < 0) return "";
  const resto = t.slice(a + 10);
  const b = resto.search(/DEMONSTRATIVO D[OA]\s|RESUMO DAS CONTRIBUI|CONTROLE DE VALORES RETIDOS/i);
  return t.slice(a, b > 0 ? a + 10 + b : undefined);
}

function lerLucro(sec) {
  if (!sec) return null;
  const apur = sec.slice(Math.max(0, sec.search(/APURA[ÇC][ÃA]O\s/)));
  const percentuais = [...sec.matchAll(new RegExp(`Receita bruta sujeita ao percentual de base de c[aá]lculo de (\\d+,\\d{2})%\\s+${N}\\s+${N}`, "gi"))]
    .map((m) => ({ pct: num(m[1]) / 100, receita: num(m[2]), base: num(m[3]) }));
  const aliq = sec.match(/(\d{1,2},\d{2})%\s+[\d.]+,\d{2}\s+(\d{1,2},\d{2})%/);
  const total = sec.match(new RegExp(`Total Geral:?\\s+${N}\\s+${N}`, "i"));
  return {
    percentuais, aliquota: aliq ? num(aliq[2]) / 100 : null,
    receita: total ? num(total[1]) : r2(percentuais.reduce((s, p) => s + p.receita, 0)),
    base: total ? num(total[2]) : r2(percentuais.reduce((s, p) => s + p.base, 0)),
    debitos: pega(apur, new RegExp(`D[ée]bitos\\s+${N}`)),
    retencoes: pega(apur, new RegExp(`Reten[cç][õo]es\\s+${N}`)),
    adicional: pega(apur, new RegExp(`Adicional de IRPJ\\s+${N}`, "i")),
    saldoAnterior: pega(apur, new RegExp(`Saldo credor do per[ií]odo anterior\\s+${N}`, "i")),
    outrasDeducoes: pega(apur, new RegExp(`Outras dedu[cç][õo]es\\s+${N}`, "i")),
    saldoDevedor: pega(apur, new RegExp(`Saldo devedor de (?:IRPJ|Contribui[cç][aã]o Social)\\s+${N}`, "i")),
  };
}

function lerPisCofins(sec, nome, tudo) {
  if (!sec) return null;
  const base = pega(tudo, new RegExp(`Total das Receitas tributadas [–-] ${nome} cumulativo\\s+${N}`, "i"));
  return {
    devida: pega(sec, new RegExp(`Valor Total da Contribui[cç][aã]o Cumulativa Devida\\s+${N}`, "i")),
    retida: pega(sec, new RegExp(`Retida na Fonte, Deduzido no Per[ií]odo\\s+${N}`, "i")),
    aRecolher: pega(sec, new RegExp(`Valor da Contribui[cç][aã]o Cumulativa a Recolher\\s+${N}`, "i")),
    saldoDevedor: pega(sec, new RegExp(`Saldo devedor da Contribui[cç][aã]o ${nome}\\s+${N}`, "i")),
    naoCumulativo: pega(tudo, new RegExp(`Total das Receitas tributadas [–-] ${nome} N[aã]o-cumulativo\\s+${N}`, "i")),
    baseCumulativa: base,
  };
}

export function lerDemonstrativo(texto, nomeArq = "") {
  const t = norm(texto);
  const pa = mesCompetencia(t);
  const out = [];
  if (/DEMONSTRATIVO DO IRPJ/i.test(t) || /DEMONSTRATIVO DA CSLL/i.test(t)) {
    const irpj = lerLucro(secao(t, "DEMONSTRATIVO DO IRPJ"));
    const csll = lerLucro(secao(t, "DEMONSTRATIVO DA CSLL"));
    if (irpj || csll) out.push({ tipo: "LUCRO", arquivo: nomeArq, pa, irpj, csll });
  }
  if (/DEMONSTRATIVO DA APURA[ÇC][ÃA]O DO (?:PIS|COFINS)/i.test(t)) {
    const pis = lerPisCofins(secao(t, "DEMONSTRATIVO DA APURA[ÇC][ÃA]O DO PIS"), "PIS", t);
    const cofins = lerPisCofins(secao(t, "DEMONSTRATIVO DA APURA[ÇC][ÃA]O DO COFINS"), "COFINS", t);
    // alíquotas lidas do resumo
    const aPis = t.match(/PIS[^\n]{0,40}\(Al[ií]quota de (\d+,\d+)%\)/i);
    const aCof = t.match(/COFINS[^\n]{0,40}\(Al[ií]quota de (\d+,\d+)%\)/i);
    if (pis && aPis) pis.aliquota = num(aPis[1]) / 100;
    if (cofins && aCof) cofins.aliquota = num(aCof[1]) / 100;
    out.push({ tipo: "PISCOFINS", arquivo: nomeArq, pa, pis, cofins });
  }
  if (/DEMONSTRATIVO DO ISS/i.test(t)) {
    const s = secao(t, "DEMONSTRATIVO DO ISS");
    const linha = s.match(new RegExp(`Servi[cç]os\\s+(?:\\d\\s+)?${N}\\s+${N}\\s+(\\d+,\\d{2})\\s+${N}`, "i"));
    out.push({
      tipo: "ISS", arquivo: nomeArq, pa,
      base: linha ? num(linha[2]) : null, aliquota: linha ? num(linha[3]) / 100 : null, imposto: linha ? num(linha[4]) : null,
      totalDebitos: pega(s, new RegExp(`Total de d[eé]bitos\\s+${N}`, "i")),
      retido: pega(s, new RegExp(`ISS Retido\\s+${N}`, "i")),
      aRecolher: pega(s, new RegExp(`ISS a recolher\\s+${N}`, "i")) ?? pega(s, new RegExp(`a recolher\\s+ISS\\s+${N}`, "i")) ?? pega(s, new RegExp(`ISS\\s+a recolher\\s+${N}`, "i")),
    });
  }
  return out;
}

// ---------- DARF federal e DAM do ISS ----------
export function lerDarf(texto, nomeArq = "") {
  const t = norm(texto);
  if (!/Documento de Arrecada[cç][aã]o\s+de Receitas Federais/i.test(t)) return null;
  const per = t.slice(0, 900).match(new RegExp(`(${MESES.join("|")})\\s*\\/\\s*(\\d{4})`, "i")) || t.match(new RegExp(`(${MESES.join("|")})\\s*\\/\\s*(\\d{4})`, "i"));
  let pa = per ? chave(+per[2], MESES.indexOf(sem(per[1])) + 1) : "";
  if (!pa) { const tri = t.match(/PA:\s*(\d)[º°o]?\s*Trimestre\s*\/\s*(\d{4})/i); if (tri) pa = chave(+tri[2], +tri[1] * 3); }
  const total = pega(t, new RegExp(`Valor Total do Documento[\\s\\S]{0,120}?${N}`, "i"));
  const venc = t.match(/Pagar este documento at[eé][\s\S]{0,80}?(\d{2})\/(\d{2})\/(\d{4})/i) || t.match(/Data de Vencimento[\s\S]{0,80}?(\d{2})\/(\d{2})\/(\d{4})/i);
  const codigos = [];
  for (const m of t.matchAll(new RegExp(`(?:^|\\s)(\\d{4})\\s+([A-ZÀ-Ú][A-ZÀ-Ú0-9 \\-\\/\\.]{3,60}?)\\s+${N}`, "g"))) codigos.push({ codigo: m[1], nome: m[2].trim(), principal: num(m[3]) });
  // só linhas de composição (código de receita conhecido: começa com dígito, 4 posições) e valores plausíveis
  const lista = codigos.filter((c, i, a) => a.findIndex((x) => x.codigo === c.codigo) === i);
  const numero = (t.match(/(\d{2}\.\d{2}\.\d{5}\.\d{7}-\d)/) || [])[1] || "";
  return { tipo: "DARF", arquivo: nomeArq, pa, total, vencimento: venc ? `${venc[3]}-${venc[2]}-${venc[1]}` : "", codigos: lista, numero, trimestral: /Trimestre/i.test(t) };
}

export function lerDamIss(texto, nomeArq = "") {
  const t = norm(texto);
  if (!/DOCUMENTO DE ARRECADA[ÇC][ÃA]O MUNICIPAL/i.test(t) && !/IMPOSTO SOBRE SERVI[ÇC]OS/i.test(t)) return null;
  const ref = t.match(/REFER[ÊE]NCIA[\s\S]{0,60}?(\d{1,2})\/(\d{4})/i);
  const pa = ref ? chave(+ref[2], +ref[1]) : "";
  let total = pega(t, new RegExp(`TOTAL A RECOLHER[\\s\\S]{0,60}?(?:\\d{2}\\/\\d{2}\\/\\d{4}\\s+){0,2}${N}`, "i"));
  const originario = pega(t, new RegExp(`VALOR ORIGIN[ÁA]RIO DO IMPOSTO[\\s\\S]{0,80}?${N}`, "i"));
  const venc = t.match(/VENCIMENTO[\s\S]{0,60}?(\d{2})\/(\d{2})\/(\d{4})/i);
  const receita = pega(t, new RegExp(`RECEITA TRIBUT[ÁA]VEL DECLARADA\\s+(?:VALOR[^\\d]*)?${N}`, "i"));
  return { tipo: "DAM_ISS", arquivo: nomeArq, pa, total, originario, receita, vencimento: venc ? `${venc[3]}-${venc[2]}-${venc[1]}` : "" };
}

// ---------- recálculo e conferência ----------
const sev = (severidade, categoria, titulo, detalhe = "", sugestao = "", mes = "") => ({ severidade, categoria, titulo, detalhe, sugestao, mes });
const quaseIgual = (a, b, tol = 0.05) => a === null || b === null || a === undefined || b === undefined || Math.abs(a - b) <= tol;

function codigoDarf(darfs, codigos) {
  for (const d of darfs) for (const c of d.codigos || []) if (codigos.includes(c.codigo)) return { valor: c.principal, doc: d };
  return null;
}

export function auditarPresumido({ cliente, mits = [], demonstrativos = [], darfs = [], dams = [], hoje = new Date() }) {
  const achados = [];
  const meses = new Set([...mits.map((m) => m.pa), ...demonstrativos.map((d) => d.pa), ...darfs.map((d) => d.pa), ...dams.map((d) => d.pa)].filter(Boolean));
  const ordem = [...meses].sort();
  const linhas = [];
  for (const k of ordem) {
    const mit = mits.find((m) => m.pa === k) || null;
    const dem = demonstrativos.filter((d) => d.pa === k);
    const lucro = dem.find((d) => d.tipo === "LUCRO");
    const pc = dem.find((d) => d.tipo === "PISCOFINS");
    const iss = dem.find((d) => d.tipo === "ISS");
    const dd = darfs.filter((d) => d.pa === k);
    const dam = dams.find((d) => d.pa === k) || null;
    const trib = [];
    const add = (t) => trib.push(t);
    const mitVal = (nome) => (mit ? (mit.debitos[nome] ?? 0) : null);

    // IRPJ e CSLL (apuração trimestral: só no mês de fechamento do trimestre)
    for (const [nome, chaveL, codigos, aliqPad] of [["IRPJ", "irpj", ["2089"], 0.15], ["CSLL", "csll", ["2372"], 0.09]]) {
      const L = lucro?.[chaveL];
      if (!L) continue;
      const aliq = L.aliquota ?? aliqPad;
      const baseRec = r2(L.percentuais.reduce((s, p) => s + p.receita * p.pct, 0)) || L.base;
      const debitoCalc = r2(baseRec * aliq);
      const adicionalCalc = nome === "IRPJ" ? r2(Math.max(0, baseRec - 60000) * 0.10) : 0;
      const recalculado = r2(debitoCalc + adicionalCalc);
      const saldoCalc = r2(Math.max(0, (L.debitos ?? 0) + (nome === "IRPJ" ? (L.adicional ?? 0) : 0) - (L.retencoes ?? 0) - (L.saldoAnterior ?? 0) - (L.outrasDeducoes ?? 0)));
      const darf = codigoDarf(dd, codigos);
      const t = { tributo: nome, base: baseRec, aliquota: aliq, declarado: L.debitos, recalculado: debitoCalc, adicional: L.adicional ?? 0, adicionalCalculado: adicionalCalc, retencoes: L.retencoes ?? 0, saldoDevedor: L.saldoDevedor, mit: mitVal(nome), darf: darf?.valor ?? null, status: "ok", notas: [] };
      if (!quaseIgual(L.debitos, debitoCalc)) { t.status = "divergente"; achados.push(sev("critico", "Cálculo", `${rot(k)} ${nome}: débito apurado ${brlN(L.debitos)} difere do recálculo ${brlN(debitoCalc)}`, `Base ${brlN(baseRec)} × ${(aliq * 100).toFixed(2)}%.`, "Conferir percentual de presunção e receitas do trimestre.", k)); }
      if (nome === "IRPJ" && !quaseIgual(L.adicional ?? 0, adicionalCalc)) { t.status = "divergente"; achados.push(sev("critico", "Cálculo", `${rot(k)} IRPJ: adicional de ${brlN(L.adicional ?? 0)} difere do esperado ${brlN(adicionalCalc)}`, `Base do trimestre ${brlN(baseRec)}; adicional = 10% do que passa de R$ 60.000,00.`, "Conferir adicional de IRPJ.", k)); }
      if (L.saldoDevedor !== null && !quaseIgual(L.saldoDevedor, saldoCalc)) { t.status = "divergente"; achados.push(sev("critico", "Cálculo", `${rot(k)} ${nome}: saldo devedor ${brlN(L.saldoDevedor)} não fecha com débitos − retenções (${brlN(saldoCalc)})`, "", "Conferir retenções e deduções do período.", k)); }
      const aPagar = L.saldoDevedor ?? saldoCalc;
      if (mit && !quaseIgual(mit.debitos[nome] ?? 0, aPagar)) { t.status = "divergente"; achados.push(sev("critico", "MIT x apuração", `${rot(k)} ${nome}: MIT informa ${brlN(mit.debitos[nome] ?? 0)} e a apuração ${brlN(aPagar)}`, "", "Retificar a MIT/DCTFWeb ou a apuração.", k)); }
      if (!mit && lucro) achados.push(sev("atencao", "MIT", `${rot(k)}: há apuração de ${nome}, mas a MIT (declaração) do mês não está na pasta`, "", "Anexar o arquivo da MIT (JSON) ou o recibo.", k));
      if (aPagar > 0) {
        if (!darf) achados.push(sev("atencao", "DARF", `${rot(k)} ${nome}: saldo de ${brlN(aPagar)} sem DARF (código ${codigos[0]}) na pasta`, "", "Anexar a guia e o comprovante de pagamento.", k));
        else if (!quaseIgual(darf.valor, aPagar)) { t.status = "divergente"; achados.push(sev("critico", "DARF", `${rot(k)} ${nome}: DARF de ${brlN(darf.valor)} difere do saldo apurado ${brlN(aPagar)}`, "", "Emitir nova guia pelo valor correto.", k)); }
      }
      add(t);
    }

    // PIS e COFINS
    for (const [nome, P] of [["PIS", pc?.pis], ["COFINS", pc?.cofins]]) {
      if (!P) continue;
      const aliq = P.aliquota ?? (nome === "PIS" ? 0.0065 : 0.03);
      const base = P.baseCumulativa;
      const t = { tributo: nome, base, aliquota: aliq, declarado: P.devida, recalculado: base !== null ? r2(base * aliq) : null, retencoes: P.retida ?? 0, saldoDevedor: P.aRecolher ?? P.saldoDevedor, mit: mitVal(nome), darf: null, status: "ok", notas: [] };
      if (P.naoCumulativo && P.naoCumulativo > 0) t.notas.push("Há receita no regime não cumulativo: conferência de créditos não disponível.");
      else if (base !== null && !quaseIgual(P.devida, t.recalculado)) { t.status = "divergente"; achados.push(sev("critico", "Cálculo", `${rot(k)} ${nome}: contribuição devida ${brlN(P.devida)} difere do recálculo ${brlN(t.recalculado)}`, `Base ${brlN(base)} × ${(aliq * 100).toFixed(2)}%.`, "Conferir base de cálculo e alíquota.", k)); }
      const esperado = P.devida !== null ? r2(Math.max(0, P.devida - (P.retida ?? 0))) : null;
      if (esperado !== null && P.aRecolher !== null && !quaseIgual(P.aRecolher, esperado)) { t.status = "divergente"; achados.push(sev("critico", "Cálculo", `${rot(k)} ${nome}: valor a recolher ${brlN(P.aRecolher)} não fecha com devida − retida (${brlN(esperado)})`, "", "Conferir retenções deduzidas.", k)); }
      const aPagar = P.aRecolher ?? P.saldoDevedor ?? 0;
      if (mit && !quaseIgual(mit.debitos[nome] ?? 0, aPagar)) { t.status = "divergente"; achados.push(sev("critico", "MIT x apuração", `${rot(k)} ${nome}: MIT informa ${brlN(mit.debitos[nome] ?? 0)} e a apuração ${brlN(aPagar)}`, "", "Retificar a MIT/DCTFWeb ou a apuração.", k)); }
      const darf = codigoDarf(dd, nome === "PIS" ? ["8109", "6912"] : ["2172", "5856"]);
      t.darf = darf?.valor ?? null;
      if (aPagar > 0 && !darf) achados.push(sev("atencao", "DARF", `${rot(k)} ${nome}: saldo de ${brlN(aPagar)} sem DARF na pasta`, "", "Anexar a guia e o comprovante.", k));
      else if (aPagar > 0 && darf && !quaseIgual(darf.valor, aPagar)) { t.status = "divergente"; achados.push(sev("critico", "DARF", `${rot(k)} ${nome}: DARF de ${brlN(darf.valor)} difere do saldo ${brlN(aPagar)}`, "", "Emitir nova guia.", k)); }
      add(t);
    }

    // ISS (municipal)
    if (iss) {
      const calc = iss.base !== null && iss.aliquota !== null ? r2(iss.base * iss.aliquota) : null;
      const t = { tributo: "ISS", base: iss.base, aliquota: iss.aliquota, declarado: iss.totalDebitos, recalculado: calc, retencoes: iss.retido ?? 0, saldoDevedor: iss.aRecolher, mit: null, darf: dam?.total ?? null, status: "ok", notas: ["Guia municipal (DAM)"] };
      if (calc !== null && !quaseIgual(iss.imposto ?? iss.totalDebitos, calc)) { t.status = "divergente"; achados.push(sev("critico", "Cálculo", `${rot(k)} ISS: imposto ${brlN(iss.imposto ?? iss.totalDebitos)} difere do recálculo ${brlN(calc)}`, `Base ${brlN(iss.base)} × ${(iss.aliquota * 100).toFixed(2)}%.`, "Conferir alíquota e base do ISS.", k)); }
      if ((iss.aRecolher ?? 0) > 0) {
        if (!dam) achados.push(sev("atencao", "DAM ISS", `${rot(k)}: ISS a recolher de ${brlN(iss.aRecolher)} sem DAM na pasta`, "", "Anexar a guia municipal e o comprovante.", k));
        else if (dam.total !== null && !quaseIgual(dam.total, iss.aRecolher)) { t.status = "divergente"; achados.push(sev("critico", "DAM ISS", `${rot(k)}: DAM de ${brlN(dam.total)} difere do ISS apurado ${brlN(iss.aRecolher)}`, "", "Emitir nova guia pelo valor correto.", k)); }
      }
      add(t);
    }

    // MIT sem movimento x apuração com receita
    if (mit?.semMovimento && (lucro?.irpj?.receita > 0 || pc?.pis?.baseCumulativa > 0 || iss?.base > 0))
      achados.push(sev("critico", "MIT", `${rot(k)}: MIT entregue sem movimento, mas há receita na apuração`, "", "Retificar a MIT com os débitos do mês.", k));
    if (mit && !mit.semMovimento && mit.totalDebitos === 0 && !lucro && !pc)
      achados.push(sev("info", "MIT", `${rot(k)}: MIT com movimento e sem débitos informados`, "", "Conferir se há apuração sem tributo a pagar.", k));
    // Guia de tributo federal sem apuração/MIT correspondente
    for (const d of dd) if (!lucro && !pc && !mit) achados.push(sev("info", "DARF", `${rot(k)}: DARF ${d.codigos.map((c) => c.codigo).join(", ")} sem apuração nem MIT do mês na pasta`, "", "Anexar a apuração e a declaração do mês.", k));

    const diverg = trib.some((x) => x.status === "divergente");
    linhas.push({
      mes: k, rotulo: rot(k), semMovimento: !!mit?.semMovimento, mit: mit ? { semMovimento: mit.semMovimento, total: mit.totalDebitos, debitos: mit.debitos, arquivo: mit.arquivo } : null,
      tributos: trib, situacao: mit?.semMovimento ? "sem_movimento" : diverg ? "divergente" : trib.length ? "ok" : mit ? "entregue" : "so_documentos",
      comprovantes: [mit?.arquivo, lucro?.arquivo, pc?.arquivo, iss?.arquivo, ...dd.map((d) => d.arquivo), dam?.arquivo].filter(Boolean),
    });
  }
  const resumo = { critico: achados.filter((a) => a.severidade === "critico").length, atencao: achados.filter((a) => a.severidade === "atencao").length, info: achados.filter((a) => a.severidade === "info").length };
  const saude = Math.round(100 * Math.exp(-(resumo.critico * 0.35 + resumo.atencao * 0.1 + resumo.info * 0.01)));
  return { cliente, regime: "PRESUMIDO", geradoEm: hoje.toISOString(), declaracoes: mits.length, meses: linhas, achados, resumo, saude };
}
