// server/apuracao-drive.js — lê as declarações e guias da pasta do cliente no Drive e audita a apuração
// (Simples: PGDAS-D/DAS · Lucro Presumido/Real: MIT, demonstrativos, DARFs, DAM) e confere as demais declarações (DCTFWeb, DIME, DEFIS).
import { varrer, baixar, textoDoPdf, emLotes } from "./pasta-drive.js";
import { extrairFatosDeTexto } from "./pasta-engine.js";
import { lerDeclaracao, lerRecibo, lerDctf, auditarApuracoes, auditarDctf, resumirEntregas, brlN } from "./apuracao-engine.js";
import { lerMit, lerDemonstrativo, lerDarf, lerDamIss, auditarPresumido } from "./presumido-engine.js";
import { lerDimeTxt, lerDimeRecibo, lerDefis } from "./declaracoes-engine.js";

const mesDoCaminho = (c) => { const m = c.match(/(?:^|\/)(0[1-9]|1[0-2])[.\-_ ]?(20\d{2})(?:\/|$)/); return m ? `${m[2]}-${m[1]}` : ""; };
const rot = (k) => `${k.slice(5, 7)}/${k.slice(0, 4)}`;
const sev = (severidade, categoria, titulo, detalhe = "", sugestao = "", mes = "") => ({ severidade, categoria, titulo, detalhe, sugestao, mes });
const recontar = (a) => {
  a.resumo = { critico: a.achados.filter((x) => x.severidade === "critico").length, atencao: a.achados.filter((x) => x.severidade === "atencao").length, info: a.achados.filter((x) => x.severidade === "info").length };
  a.saude = Math.round(100 * Math.exp(-(a.resumo.critico * 0.35 + a.resumo.atencao * 0.1 + a.resumo.info * 0.01)));
};

function linhasPorMes(itens) {
  const por = new Map();
  for (const d of itens) {
    if (!d?.pa) continue;
    const a = por.get(d.pa) || { mes: d.pa, comprovantes: [] };
    a.comprovantes.push(d.arquivo);
    if (d.semMovimento) a.semMovimento = true;
    if (d.debito !== undefined) a.debito = Math.max(a.debito || 0, d.debito);
    if (d.entregaEm && (!a.entregaEm || d.entregaEm < a.entregaEm)) a.entregaEm = d.entregaEm;
    if (d.reciboNumero && !a.reciboNumero) a.reciboNumero = d.reciboNumero;
    if (d.legivel === false) a.reciboIlegivel = true;
    if (d.registrosMovimento !== undefined) a.registrosMovimento = d.registrosMovimento;
    const indef = !d.semMovimento && d.debito === undefined && d.registrosMovimento === undefined;
    a.movimentoIndefinido = a.movimentoIndefinido === undefined ? indef : a.movimentoIndefinido && indef;
    por.set(d.pa, a);
  }
  return [...por.values()].sort((x, y) => x.mes.localeCompare(y.mes)).map((l) => ({ ...l, rotulo: rot(l.mes), situacao: l.semMovimento ? "sem_movimento" : l.movimentoIndefinido ? "entregue" : "com_movimento" }));
}

// Anexa ao resultado as obrigações que não dependem do regime: DCTFWeb (folha), DIME e DEFIS.
function complementar(aud, { dctfweb = [], dimes = [], defis = [], mits = [], darfs = [], declaracoes = [], hoje = new Date() }) {
  const folha = linhasPorMes(dctfweb);
  if (folha.length) {
    aud.folha = { meses: folha, entregas: resumirEntregas({ linhas: folha, hoje, achados: [], nomeDoc: "DCTFWeb", prazoDia: 20, ondeVerificar: "no e-CAC (DCTFWeb)" }) };
    for (const d of dctfweb) if (d.tipo === "DCTFWEB") {
      const l = folha.find((x) => x.mes === d.pa);
      if (l) { l.origens = d.origens || []; l.saldoPagar = d.saldoPagar; l.retificadora = !!d.retificadora; }
    }
  }
  if (dimes.length) {
    const linhas = linhasPorMes(dimes);
    const meses = linhas.map((l) => ({ ...l, situacao: l.semMovimento ? "sem_movimento" : l.registrosMovimento > 0 ? "com_movimento" : "entregue" }));
    aud.dime = { meses, entregas: resumirEntregas({ linhas: meses, hoje, achados: aud.achados, nomeDoc: "DIME", prazoDia: 15, ondeVerificar: "na SEF/SC (DIME)" }) };
    if (meses.some((m) => m.reciboIlegivel)) aud.dime.aviso = "Há recibos da DIME salvos como imagem: o sistema confirma que existem, mas não lê o conteúdo (omissos e situação). O arquivo .txt da DIME é lido por completo.";
  }
  if (defis.length) {
    const porAno = new Map();
    for (const d of defis) { const a = porAno.get(d.ano) || { ano: d.ano, comprovantes: [] }; a.comprovantes.push(d.arquivo); if (d.entregaEm) a.entregaEm = d.entregaEm; if (d.reciboNumero) a.reciboNumero = d.reciboNumero; if (d.recibo) a.recibo = true; if (!d.recibo) { a.declaracao = true; Object.assign(a, { empregadosInicio: d.empregadosInicio, empregadosFim: d.empregadosFim, rendimentosSocios: d.rendimentosSocios, saidasInterestaduais: d.saidasInterestaduais, saldoCaixaFinal: d.saldoCaixaFinal, semMovimento: d.semMovimento }); } porAno.set(d.ano, a); }
    aud.defis = [...porAno.values()].sort((a, b) => a.ano - b.ano).map((a) => ({ ...a, situacao: a.declaracao ? (a.semMovimento ? "sem_movimento" : "com_movimento") : "entregue" }));
    // DEFIS sem movimento, mas PGDAS do mesmo ano com receita
    for (const a of aud.defis) if (a.semMovimento) {
      const comReceita = declaracoes.filter((d) => d.pa?.startsWith(String(a.ano)) && (d.rpa || 0) > 0);
      if (comReceita.length) aud.achados.push(sev("critico", "DEFIS", `DEFIS ${a.ano} entregue sem movimento, mas há receita nos PGDAS-D do ano`, `${comReceita.length} mês(es) com receita declarada.`, "Retificar a DEFIS.", `${a.ano}-12`));
    }
  }
  // MIT sem movimento x DARF federal do mesmo mês
  for (const m of mits) if (m.semMovimento) {
    const g = darfs.filter((d) => d.pa === m.pa && (d.total || 0) > 0);
    if (g.length) aud.achados.push(sev("critico", "MIT", `${rot(m.pa)}: MIT sem movimento, mas há DARF de tributo federal do mesmo mês (${brlN(g[0].total)})`, "", "Conferir se a MIT deveria ter débitos.", m.pa));
  }
  recontar(aud);
}

export async function auditarApuracaoDrive({ pastaId, codigo, nome, raiz, limiteMs = 45000 }) {
  const t0 = Date.now();
  const entradas = [];
  await varrer(String(pastaId), "", entradas, 6000);
  const tamOk = (e) => e.tamanho < 8 * 1024 * 1024;
  const arquivos = entradas.filter((e) => e.tipo === "arquivo" && tamOk(e) && !/EXTRATO/i.test(e.caminho.split("/").pop()));
  const ehPdf = (e) => /\.pdf$/i.test(e.caminho);
  const interesse = /simples|pgdas|declara|recibo|das\b|dctf|mit\b|dime|defis|demonst|darf|dam\b|iss|irpj|csll|pis|cofins|apura/i;
  const cand = arquivos.filter((e) => (ehPdf(e) && interesse.test(e.caminho)) || (/\.json$/i.test(e.caminho) && /MIT|DCTFWEB/i.test(e.caminho)) || (/\.txt$/i.test(e.caminho) && /dime/i.test(e.caminho)))
    .sort((a, b) => b.caminho.localeCompare(a.caminho)).slice(0, 140);

  const declaracoes = [], dctfs = [], guias = {}, falhas = [];
  const mits = [], dem = [], darfs = [], dams = [], dimes = [], defis = [];
  let lidos = 0;
  await emLotes(cand, 4, async (e) => {
    if (Date.now() - t0 > limiteMs) { falhas.push(`${e.caminho.split("/").pop()}: tempo esgotado`); return; }
    const nomeArq = e.caminho.split("/").pop();
    try {
      const buf = await baixar(e._id);
      if (/\.json$/i.test(nomeArq)) { const m = lerMit(buf.toString("utf8"), nomeArq); if (m) { lidos += 1; mits.push(m); } return; }
      if (/\.txt$/i.test(nomeArq)) { const d = lerDimeTxt(buf.toString("latin1"), nomeArq); if (d) { lidos += 1; dimes.push(d); } return; }
      const texto = await textoDoPdf(buf, { max: 14 });
      lidos += 1;
      const df = lerDefis(texto, nomeArq); if (df) { defis.push(df); return; }
      const dr = lerDimeRecibo(texto, nomeArq); if (dr) { dimes.push(dr); return; }
      const decl = lerDeclaracao(texto, nomeArq) || lerRecibo(texto, nomeArq);
      if (decl) { decl.caminho = e.caminho; declaracoes.push(decl); return; }
      const dar = lerDarf(texto, nomeArq); if (dar) { darfs.push(dar); return; }
      const dam = lerDamIss(texto, nomeArq); if (dam) { dams.push(dam); return; }
      const dm = lerDemonstrativo(texto, nomeArq); if (dm.length) { dem.push(...dm); return; }
      if (/DCTF/i.test(e.caminho) || /DCTF/i.test(texto)) {
        const dc = lerDctf(texto, nomeArq, mesDoCaminho(e.caminho));
        if (dc) { dc.caminho = e.caminho; dctfs.push(dc); return; }
      }
      const f = extrairFatosDeTexto(nomeArq, texto);
      if (f.ehGuiaSimples && !f.ehParcelamento && f.valorGuia !== undefined) {
        const pa = f.pa || mesDoCaminho(e.caminho);
        if (pa) guias[pa] = { valorGuia: f.valorGuia, vencimento: f.vencimento || "" };
      }
    } catch (er) { falhas.push(`${nomeArq}: ${String(er?.message || er).slice(0, 80)}`); }
  });

  const cli = { codigo, nome: nome || "", raiz: raiz || "", driveId: String(pastaId) };
  const dctfweb = dctfs.filter((d) => d.tipo === "DCTFWEB");
  const dctfFiscal = dctfs.filter((d) => d.tipo !== "DCTFWEB");
  const temPresumido = mits.length || dem.length || darfs.length || dams.length;
  let aud;
  if (declaracoes.length) {
    aud = auditarApuracoes({ cliente: cli, declaracoes, guias });
    if (temPresumido) {
      // Empresa que mudou de regime: mantém o Simples e anexa a parte do Presumido/Real.
      const P = auditarPresumido({ cliente: cli, mits, demonstrativos: dem, darfs, dams });
      P.entregas = resumirEntregas({ linhas: mits.map((m) => ({ mes: m.pa, semMovimento: m.semMovimento, movimentoIndefinido: false })), hoje: new Date(), achados: P.achados, nomeDoc: "MIT", prazoDia: 31, ondeVerificar: "no e-CAC (MIT)" });
      aud.presumido = P; aud.aviso = "Há PGDAS-D e também MIT/apuração de Lucro Presumido ou Real nesta pasta: a empresa parece ter mudado de regime. As duas partes estão abaixo.";
    }
  } else if (temPresumido) {
    aud = auditarPresumido({ cliente: cli, mits, demonstrativos: dem, darfs, dams });
    aud.entregas = resumirEntregas({ linhas: mits.map((m) => ({ mes: m.pa, semMovimento: m.semMovimento, movimentoIndefinido: false })), hoje: new Date(), achados: aud.achados, nomeDoc: "MIT", prazoDia: 31, ondeVerificar: "no e-CAC (MIT)" });
    if (!mits.length) aud.achados.push(sev("atencao", "MIT", "Nenhuma MIT encontrada na pasta", "A MIT (JSON) é a declaração dos tributos federais de quem está fora do Simples.", "Anexar o arquivo MIT-AAAAMM.JSON ou o recibo."));
    aud.aviso = "Empresa fora do Simples Nacional (Lucro Presumido/Real): sem PGDAS-D nem DAS. A entrega vem da MIT (campo “sem movimento”); a apuração é recalculada a partir dos demonstrativos, DARFs e DAM. Lucro Real não é recalculado (precisa de balancete/LALUR).";
  } else if (dctfFiscal.length) {
    aud = auditarDctf({ cliente: cli, declaracoes: dctfs });
    aud.aviso = "Empresa fora do Simples Nacional: não há DAS nem PGDAS a conferir. Abaixo estão as entregas da DCTF (tributos federais) e, separadas, as da DCTFWeb (folha).";
  } else {
    aud = auditarApuracoes({ cliente: cli, declaracoes: [], guias });
    aud.aviso = "Nenhuma declaração (PGDAS-D, MIT, DCTF) nem apuração foi encontrada nesta pasta. Confira se os arquivos estão nas pastas de declarações do cliente.";
  }
  complementar(aud, { dctfweb: aud.regime === "NAO_SIMPLES" ? [] : dctfweb, dimes, defis, mits, darfs, declaracoes });
  if (aud.presumido) { aud.achados.push(...aud.presumido.achados); recontar(aud); }
  if (falhas.length) aud.falhas = falhas.slice(0, 12);
  aud.arquivosLidos = lidos;
  return aud;
}
