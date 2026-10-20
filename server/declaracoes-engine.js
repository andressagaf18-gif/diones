// server/declaracoes-engine.js — leitura de declarações acessórias da pasta do cliente: DIME (SC), DEFIS.
// Cada leitor responde: qual período, foi entregue, e o que a própria declaração diz sobre movimento.
import { num } from "./apuracao-engine.js";

const chave = (a, m) => `${a}-${String(m).padStart(2, "0")}`;
const dataBr = (s) => { const m = String(s || "").match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };

// ---------- DIME (Santa Catarina) — arquivo .txt de largura fixa ----------
// Registros: 20 = contador/cabeçalho, 21 = contribuinte + período (MMAAAA), 98/99 = totalizadores.
// Qualquer outro registro (apuração, entradas, saídas, créditos…) significa que há dados de movimento.
export function lerDimeTxt(texto, nomeArq = "") {
  const linhas = String(texto || "").replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (linhas.length < 2 || !/^20\s/.test(linhas[0]) || !/^21/.test(linhas[1])) return null;
  const l21 = linhas[1];
  const per = l21.match(/(\d{2})(\d{4})\d{8,}\s*$/) || l21.match(/\s(0[1-9]|1[0-2])(20\d{2})\d/);
  if (!per) return null;
  const pa = chave(+per[2], +per[1]);
  const nome = l21.slice(13, 63).trim();
  const tipos = linhas.map((l) => l.slice(0, 2));
  const registrosMovimento = tipos.filter((t) => !["20", "21", "98", "99"].includes(t)).length;
  const gerado = linhas[0].match(/(\d{14})\s*$/);
  const entregaEm = gerado ? `${gerado[1].slice(0, 4)}-${gerado[1].slice(4, 6)}-${gerado[1].slice(6, 8)}` : "";
  return { tipo: "DIME", fonte: "txt", arquivo: nomeArq, pa, empresa: nome, registrosMovimento, semMovimento: registrosMovimento === 0, geradoEm: entregaEm, inferido: true };
}

// ---------- DIME — recibo (PDF "Recepção de Declarações do ICMS") ----------
export function lerDimeRecibo(texto, nomeArq = "") {
  const t = String(texto || "");
  const doc = /Recep[cç][aã]o de Declara[cç][õo]es do ICMS/i.test(t);
  const porNome = nomeArq.match(/(0[1-9]|1[0-2])[.\-_](20\d{2}).*DIME|DIME.*?(0[1-9]|1[0-2])[.\-_](20\d{2})/i);
  if (!doc && !porNome) return null;
  let pa = "";
  const p = t.match(/\b(0[1-9]|1[0-2])\/(20\d{2})\s+(Aceita|Rejeitada|Recusada)/i);
  if (p) pa = chave(+p[2], +p[1]);
  else if (porNome) pa = porNome[1] ? chave(+porNome[2], +porNome[1]) : chave(+porNome[4], +porNome[3]);
  if (!pa) return null;
  const sit = (t.match(/\b(?:0[1-9]|1[0-2])\/20\d{2}\s+(Aceita|Rejeitada|Recusada)/i) || [])[1] || "";
  const dt = t.match(/Data Transm\.?\s*:?\s*(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}:\d{2}:\d{2}))?/i);
  const prot = (t.match(/Protocolo\s*:?\s*(\d{6,})/i) || [])[1] || "";
  const omissos = [];
  // quadro "omissos de entrega": ano e meses com X
  const quadro = t.match(/Inscri[cç]ao\s+Ano[\s\S]{0,200}?Dezembro\s*\n([^\n]*)/i);
  return { tipo: "DIME", fonte: "recibo", arquivo: nomeArq, pa, aceita: /aceita/i.test(sit) || (!sit && !doc ? null : false), situacao: sit, entregaEm: dt ? dataBr(dt[1]) : "", reciboNumero: prot, legivel: !!doc, omissos, quadroOmissos: quadro ? quadro[1].trim() : "" };
}

// ---------- DEFIS (Simples Nacional, anual) ----------
export function lerDefis(texto, nomeArq = "") {
  const t = String(texto || "").replace(/\r/g, "");
  if (!/DEFIS/i.test(t) && !/DEFIS/i.test(nomeArq)) return null;
  const ano = t.match(/Ano[-\s]*Calend[aá]rio:?\s*(20\d{2})/i) || t.match(/Ano Calend[aá]rio:?\s*(20\d{2})/i) || nomeArq.match(/DEFIS-\d{9}(20\d{2})/i);
  if (!ano) return null;
  const grab = (re) => { const m = t.match(re); return m ? num(m[1]) : null; };
  const emp = (re) => { const m = t.match(re); return m ? +m[1] : null; };
  const rec = t.match(/N[úu]mero do Recibo:?\s*([\d.\-]+)/i);
  const dt = t.match(/(?:Data e Hor[aá]rio da Transmiss[aã]o da Declara[cç][aã]o:?|Data e Hor[aá]rio da transmiss[aã]o da Declara[cç][aã]o:?)\s*(\d{2}\/\d{2}\/\d{4})/i) || t.match(/Transmiss[aã]o da Declara[cç][aã]o\s*\n\s*(\d{2}\/\d{2}\/\d{4})/i);
  const ehRecibo = /RECIBO DE ENTREGA/i.test(t);
  const d = {
    tipo: "DEFIS", arquivo: nomeArq, ano: +ano[1], recibo: ehRecibo, retificadora: /Retificadora/i.test(t) && !/Original/i.test(t),
    entregaEm: dt ? dataBr(dt[1]) : "", reciboNumero: rec ? rec[1] : "",
  };
  if (!ehRecibo) {
    d.empregadosInicio = emp(/Quantidade de empregados no in[ií]cio[\s\S]{0,80}?\n?\s*(\d+)\s*$/im) ?? emp(/in[ií]cio do per[ií]odo[\s\S]{0,60}?(\d+)\s*\n/i);
    d.empregadosFim = emp(/Quantidade de empregados no final[\s\S]{0,80}?(\d+)\s*\n/i);
    d.rendimentosSocios = [...t.matchAll(/Rendimentos (?:isentos|tribut[aá]veis) pagos ao s[óo]cio pela empresa\s+R\$\s*([\d.]+,\d{2})/gi)].reduce((s, m) => s + num(m[1]), 0);
    const saidas = t.match(/Total de sa[ií]das interestaduais por UF[\s\S]*?(?=Valor do ISS retido)/i);
    d.saidasInterestaduais = saidas ? [...saidas[0].matchAll(/\b[A-Z]{2}\s+R\$\s*([\d.]+,\d{2})/g)].reduce((s, m) => s + num(m[1]), 0) : 0;
    d.despesas = grab(/Total de despesas no per[ií]odo[^\n]*?R\$\s*([\d.]+,\d{2})/i);
    d.entradas = grab(/Total de entradas no per[ií]odo[^\n]*?R\$\s*([\d.]+,\d{2})/i);
    d.saldoCaixaFinal = grab(/Saldo em caixa\/banco no final[^\n]*?R\$\s*([\d.]+,\d{2})/i);
    const sinais = [d.rendimentosSocios, d.saidasInterestaduais, d.despesas, d.entradas, d.empregadosFim, d.empregadosInicio].some((v) => (v || 0) > 0);
    d.semMovimento = !sinais && !(d.saldoCaixaFinal > 0);
  }
  return d;
}
