// server/apuracao-engine.js — auditoria das apurações (Simples Nacional: recálculo do PGDAS-D).
// Motor puro: recebe texto das declarações/guias já extraído e devolve achados e a conferência mês a mês.

export const ANEXOS = {
  I:   { nome: "Comércio",                 faixas: [[180000, 0.04, 0], [360000, 0.073, 5940], [720000, 0.095, 13860], [1800000, 0.107, 22500], [3600000, 0.143, 87300], [4800000, 0.19, 378000]] },
  II:  { nome: "Indústria",                faixas: [[180000, 0.045, 0], [360000, 0.078, 5940], [720000, 0.10, 13860], [1800000, 0.112, 22500], [3600000, 0.147, 85500], [4800000, 0.30, 720000]] },
  III: { nome: "Serviços (locação, TI, etc.)", faixas: [[180000, 0.06, 0], [360000, 0.112, 9360], [720000, 0.135, 17640], [1800000, 0.16, 35640], [3600000, 0.21, 125640], [4800000, 0.33, 648000]] },
  IV:  { nome: "Serviços (construção, vigilância…)", faixas: [[180000, 0.045, 0], [360000, 0.09, 8100], [720000, 0.102, 12420], [1800000, 0.14, 39780], [3600000, 0.22, 183780], [4800000, 0.33, 828000]] },
  V:   { nome: "Serviços (fator r < 28%)", faixas: [[180000, 0.155, 0], [360000, 0.18, 4500], [720000, 0.195, 9900], [1800000, 0.205, 17100], [3600000, 0.23, 62100], [4800000, 0.305, 540000]] },
};
// Repartição do Anexo III (IRPJ, CSLL, COFINS, PIS, CPP, ISS), por faixa.
const REPART_III = [
  [0.04, 0.035, 0.1282, 0.0278, 0.434, 0.335],
  [0.04, 0.035, 0.1405, 0.0305, 0.434, 0.32],
  [0.04, 0.035, 0.1364, 0.0296, 0.434, 0.325],
  [0.04, 0.035, 0.1364, 0.0296, 0.434, 0.325],
  null, // faixa 5: ISS limitado a 5% redistribui os percentuais — não conferido por tributo
  null,
];

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const num = (s) => { const v = Number(String(s ?? "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(v) ? v : 0; };
const N = "([\\d.]+,\\d{2})";
const chave = (ano, mes) => `${ano}-${String(mes).padStart(2, "0")}`;
const mesAnterior = (k, n) => { let [a, m] = k.split("-").map(Number); m -= n; while (m <= 0) { m += 12; a -= 1; } return chave(a, m); };
const rot = (k) => `${k.slice(5, 7)}/${k.slice(0, 4)}`;

export function aliquotaEfetiva(anexo, rbt12) {
  const t = ANEXOS[anexo];
  if (!t) return null;
  const base = rbt12 > 0 ? rbt12 : 0;
  let i = t.faixas.findIndex((f) => base <= f[0]);
  if (i < 0) i = t.faixas.length - 1;
  const [, nominal, deduzir] = t.faixas[i];
  const efetiva = base > 0 ? (base * nominal - deduzir) / base : nominal;
  return { faixa: i + 1, nominal, deduzir, efetiva };
}

function dadosEntrega(t) {
  const e = {};
  const tr = t.match(/Data e Hor[aá]rio da Transmiss[aã]o[\s\S]{0,160}?(\d{2})\/(\d{2})\/(\d{4})/i);
  if (tr) e.entregaEm = `${tr[3]}-${tr[2]}-${tr[1]}`;
  const rc = t.match(/N[úu]mero do Recibo:?\s*([\d]{2}\.[\d.]+-?\d)/i) || t.match(/N[úu]mero do Recibo[\s\S]{0,40}?(\d{2}\.\d{2}\.\d{5}\.\d{7}-\d)/i);
  if (rc) e.reciboNumero = rc[1];
  e.original = !/Retificadora/i.test(t);
  return e;
}

// ---------- leitura do PGDAS-D (declaração) ----------
function paresMeses(trecho) {
  const m = new Map();
  for (const x of String(trecho || "").matchAll(/(0[1-9]|1[0-2])\/(\d{4})\s+([\d.]+,\d{2})/g)) m.set(chave(+x[2], +x[1]), (m.get(chave(+x[2], +x[1])) || 0) + num(x[3]));
  return m;
}

export function lerDeclaracao(texto, nomeArq = "") {
  const t = String(texto || "").replace(/\r/g, "");
  if (!/Declarat[óo]rio|PGDAS/i.test(t) || !/Apura[cç][aã]o do Simples Nacional/i.test(t)) return null;
  const d = { arquivo: nomeArq, ...dadosEntrega(t) };
  const per = t.match(/Per[ií]odo de Apura[cç][aã]o:?\s*\d{2}\/(0[1-9]|1[0-2])\/(\d{4})/i);
  if (!per) return null;
  d.pa = chave(+per[2], +per[1]);
  d.cnpj = (t.match(/CNPJ Matriz:\s*([\d./-]{18})/) || [])[1]?.replace(/\D/g, "") || "";
  d.retificadora = /Declara[cç][aã]o Retificadora/i.test(t);
  d.regimeApuracao = /Regime de Apura[cç][aã]o:\s*(Compet[eê]ncia|Caixa)/i.test(t) ? RegExp.$1 : "";
  d.numero = (t.match(/N[º°]? da Declara[cç][aã]o:\s*(\d{17})/i) || [])[1] || "";

  const rpa = t.match(new RegExp(`Receita Bruta do PA[^\\n]*?${N}\\s+${N}\\s+${N}`, "i"));
  if (rpa) { d.rpaInterno = num(rpa[1]); d.rpaExterno = num(rpa[2]); d.rpa = num(rpa[3]); }
  // Os três valores (interno, externo, total) podem vir antes ou depois do rótulo, conforme o leitor de PDF.
  const triplo = (rotulo) => {
    const T = `${N}\\s+${N}\\s+${N}`;
    const depois = t.match(new RegExp(`\\(${rotulo}\\)[ \\t]*\\n?[ \\t]*${T}`));
    const antes = t.match(new RegExp(`${T}[ \\t]*\\n?[^\\n\\d]{0,80}\\(${rotulo}\\)`));
    const m = depois || antes;
    return m ? num(m[3]) : undefined;
  };
  d.rbt12 = triplo("RBT12");
  d.rbt12p = triplo("RBT12p");
  d.rba = triplo("RBA");
  if (d.rbt12 === undefined) delete d.rbt12;
  if (d.rbt12p === undefined) delete d.rbt12p;
  if (d.rba === undefined) delete d.rba;

  // histórico de receitas dos meses anteriores
  const sec = (ini, fim) => { const a = t.search(ini); if (a < 0) return ""; const resto = t.slice(a); const b = resto.search(fim); return b > 0 ? resto.slice(0, b) : resto; };
  const interno = paresMeses(sec(/2\.2\.1\)\s*Mercado Interno/i, /2\.2\.2\)/));
  const externo = paresMeses(sec(/2\.2\.2\)\s*Mercado Externo/i, /2\.3\)/));
  d.historico = {};
  for (const k of new Set([...interno.keys(), ...externo.keys()])) d.historico[k] = r2((interno.get(k) || 0) + (externo.get(k) || 0));
  const folha = paresMeses(sec(/2\.3\)\s*Folha de Sal/i, /2\.4\)/));
  d.folha = Object.fromEntries(folha);
  const fr = t.match(/Fator r\s*=\s*([\d.,]+)/i);
  d.fatorR = fr ? num(fr[1].includes(",") ? fr[1] : fr[1].replace(".", ",")) : null;
  d.fatorRAplicavel = fr ? true : false;

  // atividades (blocos "Receita Bruta Informada")
  const ini = t.search(/2\.7\)\s*Informa/i);
  const corpo = ini >= 0 ? t.slice(ini) : t;
  const fimEstab = corpo.search(/Totais do Estabelecimento/i);
  const area = fimEstab > 0 ? corpo.slice(0, fimEstab) : corpo;
  const partes = area.split(/Receita Bruta Informada:\s*R\$\s*/i);
  d.atividades = [];
  let desc = (partes[0].split(/Valor do D[eé]bito por Tributo para a Atividade[^\n]*\n/i).pop() || "");
  for (let i = 1; i < partes.length; i++) {
    const p = partes[i];
    const rec = p.match(new RegExp(`^${N}`));
    const linha = p.match(new RegExp(`IRPJ[^\\n]*\\n\\s*${N}\\s+${N}\\s+${N}\\s+${N}\\s+${N}\\s+${N}\\s+${N}\\s+${N}\\s+${N}`));
    const texto = desc.replace(/Valor do D[eé]bito por Tributo para a Atividade\s*\(R\$\):?/gi, "").replace(/\s+/g, " ").trim();
    const limpo = texto.replace(/sem\s+reten[cç][aã]o\/?(?:\s*substitui[cç][aã]o tribut[aá]ria)?(?:\s+de\s+\w+)?/gi, "").replace(/exceto para o exterior/gi, "");
    const anexo = (texto.match(/Anexo\s+(IV|V|III|II|I)\b/) || [])[1] || "";
    if (rec) d.atividades.push({
      descricao: texto.slice(0, 260), anexo, receita: num(rec[1]),
      exterior: /para o exterior|exporta/i.test(limpo),
      fatorR: /sujeit\w+ ao fator|fator\s*[“"']?r/i.test(texto) && !/n[aã]o sujeit/i.test(texto),
      segregacao: /reten|substitui[cç][aã]o tribut|monof[aá]sic|isen[cç]|redu[cç][aã]o|imune|suspens|lei complementar|sem incid/i.test(limpo),
      tributos: linha ? { IRPJ: num(linha[1]), CSLL: num(linha[2]), COFINS: num(linha[3]), PIS: num(linha[4]), CPP: num(linha[5]), ICMS: num(linha[6]), IPI: num(linha[7]), ISS: num(linha[8]), total: num(linha[9]) } : null,
    });
    // a descrição da próxima atividade vem depois do último "Parcela n:" deste bloco
    const resto = p.split(/Parcela\s+\d+:\s*R\$\s*[\d.,]+\s*/i);
    desc = resto.length > 1 ? resto[resto.length - 1] : "";
  }
  const tot = t.match(new RegExp(`Valor Total do D[eé]bito Declarado[^\\n]*\\n\\s*${N}\\s+${N}`, "i"));
  if (tot) d.debitoDeclarado = num(tot[2]);
  else {
    const g = t.match(new RegExp(`2\\.8\\)\\s*Total Geral[\\s\\S]*?IRPJ[^\\n]*\\n\\s*${N}\\s+${N}\\s+${N}\\s+${N}\\s+${N}\\s+${N}\\s+${N}\\s+${N}\\s+${N}`));
    if (g) d.debitoDeclarado = num(g[9]);
  }
  d.semMovimento = /sem\s+movimento/i.test(t) || ((d.rpa === 0 || d.rpa === undefined) && !d.atividades.some((a) => a.receita > 0) && !(d.debitoDeclarado > 0));
  if (d.semMovimento && d.rpa === undefined) d.rpa = 0;
  if (d.semMovimento && d.debitoDeclarado === undefined) d.debitoDeclarado = 0;
  if (d.debitoDeclarado === undefined && d.atividades.length) d.debitoDeclarado = r2(d.atividades.reduce((s, a) => s + (a.tributos?.total || 0), 0));
  return d;
}

// Recibo do PGDAS-D: "09/2026  17176998202609001  R$ 23.000,00  R$ 702,42 ..." (ou declaração sem movimento, sem valores).
export function lerRecibo(texto, nomeArq = "") {
  const t = String(texto || "").replace(/\r/g, "");
  if (!/PGDAS|Simples Nacional/i.test(t)) return null;
  const rec = t.match(/(0[1-9]|1[0-2])\/(\d{4})\s+(\d{17})\s+R\$\s*([\d.]+,\d{2})\s+R\$\s*([\d.]+,\d{2})/);
  const sem = /sem\s+movimento/i.test(t);
  let pa = rec ? chave(+rec[2], +rec[1]) : "";
  if (!pa) { const per = t.match(/Per[ií]odo de Apura[cç][aã]o:?\s*(?:\d{2}\/)?(0[1-9]|1[0-2])\/(\d{4})/i); if (per) pa = chave(+per[2], +per[1]); }
  if (!pa || (!rec && !sem)) return null;
  const d = { arquivo: nomeArq, ...dadosEntrega(t), pa, numero: rec ? rec[3] : (t.match(/\b(\d{17})\b/) || [])[1] || "", recibo: true, atividades: [], historico: {}, folha: {}, fatorR: null };
  d.rpa = rec ? num(rec[4]) : 0;
  d.debitoDeclarado = rec ? num(rec[5]) : 0;
  d.semMovimento = sem || (d.rpa === 0 && d.debitoDeclarado === 0);
  d.soRecibo = true;
  return d;
}

// ---------- recálculo ----------
export function recalcularMes(d) {
  const base = d.rbt12p ?? d.rbt12 ?? 0;
  const out = { atividades: [], total: 0, confiavel: true, motivos: [] };
  for (const a of d.atividades || []) {
    let anexo = a.anexo;
    if (a.fatorR && d.fatorR !== null && d.fatorR !== undefined) anexo = d.fatorR >= 0.28 ? "III" : "V";
    const ef = aliquotaEfetiva(anexo, base);
    const item = { anexo, receita: a.receita, declarado: a.tributos?.total ?? null, recalculado: null, faixa: ef?.faixa, nominal: ef?.nominal, efetiva: ef?.efetiva, conferido: true, nota: "" };
    if (!ef) { item.conferido = false; item.nota = "Anexo não identificado na declaração."; out.confiavel = false; }
    else if (a.segregacao) { item.conferido = false; item.nota = "Atividade com retenção/ST/isenção/redução: conferência manual."; out.confiavel = false; out.motivos.push("segregação"); }
    else if (a.exterior) {
      const rep = anexo === "III" ? REPART_III[ef.faixa - 1] : null;
      if (!rep) { item.conferido = false; item.nota = "Exportação nesta faixa/anexo: repartição por tributo não conferida."; out.confiavel = false; out.motivos.push("exportação"); }
      else {
        const f = ef.efetiva * a.receita;
        item.componentes = { IRPJ: r2(f * rep[0]), CSLL: r2(f * rep[1]), CPP: r2(f * rep[4]) };
        item.recalculado = r2(item.componentes.IRPJ + item.componentes.CSLL + item.componentes.CPP);
        item.nota = "Exportação de serviços: sem PIS, COFINS e ISS.";
      }
    } else item.recalculado = r2(a.receita * ef.efetiva);
    out.atividades.push(item);
  }
  out.total = r2(out.atividades.reduce((s, a) => s + (a.recalculado || 0), 0));
  out.confiavel = out.confiavel && out.atividades.every((a) => a.conferido);
  return out;
}

const sev = (severidade, categoria, titulo, detalhe = "", sugestao = "", mes = "") => ({ severidade, categoria, titulo, detalhe, sugestao, mes });

export function auditarApuracoes({ cliente, declaracoes = [], guias = {}, hoje = new Date() }) {
  const achados = [];
  // uma declaração por mês: a mais recente (maior número) vale
  const porMes = new Map();
  for (const d of declaracoes) {
    if (!d?.pa) continue;
    const a = porMes.get(d.pa);
    if (!a || (a.soRecibo && !d.soRecibo) || (!!a.soRecibo === !!d.soRecibo && (String(d.numero) > String(a.numero) || (d.retificadora && !a.retificadora)))) porMes.set(d.pa, d);
  }
  const meses = [...porMes.keys()].sort();
  const entregas = {};
  for (const d of declaracoes) {
    if (!d?.pa) continue;
    const e = (entregas[d.pa] ||= { comprovantes: [] });
    if (d.arquivo) e.comprovantes.push(d.arquivo);
    if (d.entregaEm && d.original && (!e.entregaEm || d.entregaEm < e.entregaEm)) e.entregaEm = d.entregaEm;
    if (d.reciboNumero && !e.reciboNumero) e.reciboNumero = d.reciboNumero;
  }
  const linhas = [];
  for (const k of meses) {
    const d = porMes.get(k);
    const rc = d.semMovimento || d.soRecibo ? { atividades: [], total: d.debitoDeclarado ?? 0, confiavel: !!d.semMovimento } : recalcularMes(d);
    const linha = {
      mes: k, rotulo: rot(k), numero: d.numero, retificadora: !!d.retificadora, rpa: d.rpa ?? null, rbt12: d.rbt12p ?? d.rbt12 ?? null,
      anexos: [...new Set(rc.atividades.map((a) => a.anexo).filter(Boolean))].join(" / "), faixa: rc.atividades[0]?.faixa ?? null,
      aliquotaEfetiva: rc.atividades[0]?.efetiva ?? null, debitoDeclarado: d.debitoDeclarado ?? null,
      debitoRecalculado: rc.confiavel ? rc.total : null, diferenca: null, conferido: rc.confiavel, atividades: rc.atividades, situacao: "ok", fatorR: d.fatorR, semMovimento: !!d.semMovimento, soRecibo: !!d.soRecibo,
      entregaEm: entregas[k]?.entregaEm || null, reciboNumero: entregas[k]?.reciboNumero || null, comprovantes: entregas[k]?.comprovantes || [],
    };
    // prazo de entrega: dia 20 do mês seguinte
    if (linha.entregaEm) {
      const [ay, am] = k.split("-").map(Number);
      const prazo = new Date(Date.UTC(am === 12 ? ay + 1 : ay, am === 12 ? 0 : am, 20)).toISOString().slice(0, 10);
      linha.prazoEntrega = prazo;
      if (linha.entregaEm > prazo) achados.push(sev("atencao", "Prazo de entrega", `${rot(k)}: declaração original entregue em ${linha.entregaEm.split("-").reverse().join("/")}, depois do prazo (${prazo.split("-").reverse().join("/")})`, "", "Verificar se foi cobrada multa por atraso na entrega (MAED).", k));
    }
    if (d.semMovimento) {
      linha.situacao = "sem_movimento";
      linha.diferenca = 0;
      const guiaMes = guias[k];
      if (guiaMes?.valorGuia > 0) achados.push(sev("atencao", "Sem movimento", `${rot(k)}: declarado sem movimento, mas existe guia de ${brlN(guiaMes.valorGuia)} na pasta`, "", "Confirmar se houve receita no mês ou se a guia é de outro período.", k));
    } else if (d.soRecibo) {
      linha.situacao = "so_recibo";
      achados.push(sev("info", "Cálculo do Simples", `${rot(k)}: só o recibo está na pasta (declaração completa ausente)`, `Recibo informa receita ${brlN(d.rpa)} e débito ${brlN(d.debitoDeclarado)}; o recálculo exige o PDF da declaração.`, "Anexar a declaração do PGDAS-D desse mês.", k));
    }
    if (d.semMovimento || d.soRecibo) { /* tratado acima */ }
    else if (rc.confiavel && d.debitoDeclarado !== undefined) {
      linha.diferenca = r2(d.debitoDeclarado - rc.total);
      if (Math.abs(linha.diferenca) > 0.05) {
        linha.situacao = "divergente";
        const mais = linha.diferenca > 0;
        achados.push(sev("critico", "Cálculo do Simples", `${rot(k)}: débito declarado diverge do recálculo em ${brlN(Math.abs(linha.diferenca))}`,
          `Declarado ${brlN(d.debitoDeclarado)} · recalculado ${brlN(rc.total)} (RBT12 ${brlN(linha.rbt12)}, faixa ${linha.faixa}, alíquota efetiva ${(linha.aliquotaEfetiva * 100).toFixed(4)}%).`,
          mais ? "Possível pagamento a maior: avaliar retificação para recuperar valor." : "Possível pagamento a menor: avaliar retificação antes de a Receita notificar.", k));
      }
    } else if (!rc.confiavel) {
      linha.situacao = "manual";
      achados.push(sev("info", "Cálculo do Simples", `${rot(k)}: recálculo não conclusivo`, rc.atividades.filter((a) => a.nota).map((a) => a.nota).join(" "), "Conferir manualmente a segregação das receitas.", k));
    }
    if (d.semMovimento || d.soRecibo) { linha.valorGuia = guias[k]?.valorGuia ?? null; linha.vencimentoGuia = guias[k]?.vencimento ?? null; linhas.push(linha); continue; }
    // soma das atividades
    const somaAtiv = r2((d.atividades || []).reduce((s, a) => s + a.receita, 0));
    if (d.rpa !== undefined && d.atividades?.length && Math.abs(somaAtiv - d.rpa) > 0.05)
      achados.push(sev("critico", "Receita", `${rot(k)}: soma das atividades (${brlN(somaAtiv)}) difere da receita do período (${brlN(d.rpa)})`, "", "Revisar a segregação de receitas na declaração.", k));
    // RBT12 x histórico
    if (d.rbt12 !== undefined && d.historico && Object.keys(d.historico).length) {
      const ant = Array.from({ length: 12 }, (_, i) => mesAnterior(k, i + 1));
      const soma = r2(ant.reduce((s, m) => s + (d.historico[m] || 0), 0));
      if (Math.abs(soma - d.rbt12) > 0.05) achados.push(sev("critico", "RBT12", `${rot(k)}: RBT12 declarado (${brlN(d.rbt12)}) difere da soma dos 12 meses anteriores (${brlN(soma)})`, "", "Pode haver mês anterior com receita não declarada ou declarada com erro.", k));
    }
    // Fator r
    const ativFr = (d.atividades || []).some((a) => a.fatorR);
    if (ativFr && d.fatorR !== null && d.fatorR !== undefined) {
      const folha = r2(Object.entries(d.folha || {}).reduce((s, [m, v]) => (Array.from({ length: 12 }, (_, i) => mesAnterior(k, i + 1)).includes(m) ? s + v : s), 0));
      const base = d.rbt12p ?? d.rbt12;
      if (base > 0 && folha > 0) {
        const calc = folha / base;
        if (Math.abs(calc - d.fatorR) > 0.005) achados.push(sev("atencao", "Fator r", `${rot(k)}: fator r declarado (${(d.fatorR * 100).toFixed(2)}%) difere do calculado pela folha (${(calc * 100).toFixed(2)}%)`, `Folha 12 meses ${brlN(folha)} ÷ RBT12 ${brlN(base)}.`, "Conferir a folha informada.", k));
      }
      const declaradoV = (d.atividades || []).some((a) => a.fatorR && a.anexo === "V");
      const declaradoIII = (d.atividades || []).some((a) => a.fatorR && a.anexo === "III");
      if ((d.fatorR >= 0.28 && declaradoV) || (d.fatorR < 0.28 && declaradoIII))
        achados.push(sev("critico", "Fator r", `${rot(k)}: anexo declarado não corresponde ao fator r de ${(d.fatorR * 100).toFixed(2)}%`, "", "Com fator r ≥ 28% aplica-se o Anexo III; abaixo, o Anexo V.", k));
      else if (d.fatorR >= 0.25 && d.fatorR < 0.28) achados.push(sev("info", "Fator r", `${rot(k)}: fator r de ${(d.fatorR * 100).toFixed(2)}% está perto de 28%`, "", "Aumentar a folha/pró-labore pode migrar do Anexo V para o III e reduzir a alíquota. Vale simular.", k));
    }
    // limites
    const limiteBase = d.rbt12p ?? d.rbt12 ?? 0;
    if (limiteBase > 4800000) achados.push(sev("critico", "Limites", `${rot(k)}: RBT12 acima de R$ 4,8 milhões`, "", "Risco de exclusão do Simples Nacional.", k));
    else if (limiteBase > 3600000) achados.push(sev("atencao", "Limites", `${rot(k)}: RBT12 acima do sublimite de R$ 3,6 milhões`, "", "ICMS/ISS devem ser recolhidos fora do DAS.", k));
    else if (limiteBase > 2880000) achados.push(sev("info", "Limites", `${rot(k)}: RBT12 já passou de 80% do sublimite (R$ 3,6 mi)`, "", "Acompanhar o crescimento e planejar o regime.", k));
    // guia
    const g = guias[k];
    if (g?.valorGuia !== undefined && d.debitoDeclarado !== undefined && g.valorGuia + 0.05 < d.debitoDeclarado)
      achados.push(sev("critico", "Guia DAS", `${rot(k)}: guia (${brlN(g.valorGuia)}) menor que o débito declarado (${brlN(d.debitoDeclarado)})`, "", "Emitir nova guia pelo valor correto.", k));
    linha.valorGuia = g?.valorGuia ?? null; linha.vencimentoGuia = g?.vencimento ?? null;
    linhas.push(linha);
  }
  // consistência entre declarações: receita do mês aparece nas seguintes
  for (const k of meses) {
    const d = porMes.get(k);
    if (d.rpa === undefined) continue;
    for (const k2 of meses) {
      if (k2 <= k) continue;
      const h = porMes.get(k2)?.historico?.[k];
      if (h !== undefined && Math.abs(h - d.rpa) > 0.05) {
        achados.push(sev("atencao", "Receita", `${rot(k)}: receita de ${brlN(d.rpa)} na declaração, mas ${brlN(h)} no histórico da declaração de ${rot(k2)}`, "", "Houve retificação? Confirmar qual valor está correto.", k)); break;
      }
    }
  }
  const resumo = { critico: achados.filter((a) => a.severidade === "critico").length, atencao: achados.filter((a) => a.severidade === "atencao").length, info: achados.filter((a) => a.severidade === "info").length };
  const saude = Math.round(100 * Math.exp(-(resumo.critico * 0.35 + resumo.atencao * 0.1 + resumo.info * 0.01)));
  return { cliente, regime: "SIMPLES", geradoEm: hoje.toISOString(), declaracoes: linhas.length, meses: linhas, achados, resumo, saude };
}

export const brlN = (v) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
