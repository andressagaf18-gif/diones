// Exportação dos relatórios para Excel (.xlsx). As abas são montadas por funções puras e o arquivo é gerado no navegador.
const REGIME = { SIMPLES: "Simples Nacional", MEI: "MEI", PRESUMIDO: "Lucro Presumido / Real", REAL: "Lucro Real", NAO_SIMPLES: "Fora do Simples (DCTF)", INDEFINIDO: "Não identificado", NAO_IDENTIFICADO: "Não identificado" };
const SEV = { critico: "Crítico", atencao: "Atenção", info: "Informativo" };
const SIT = { sem_movimento: "Sem movimento", com_movimento: "Com movimento", entregue: "Entregue (movimento não lido)", ok: "Conferido", divergente: "Divergente", so_recibo: "Só recibo", so_documentos: "Só documentos" };
const rot = (k) => (k ? `${String(k).slice(5, 7)}/${String(k).slice(0, 4)}` : "");
const dt = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");
const n = (v) => (v === null || v === undefined || v === "" ? "" : v);
const sit = (s) => SIT[s] || s || "";

function cabecalho(a, extra = []) {
  return [
    ["Cliente", `${a.cliente?.codigo || ""} - ${a.cliente?.nome || ""}`],
    ["Regime", REGIME[a.regime] || a.regime || ""],
    ["Saúde (0 a 100)", a.saude],
    ["Críticos", a.resumo?.critico ?? 0], ["Atenção", a.resumo?.atencao ?? 0], ["Informativos", a.resumo?.info ?? 0],
    ...extra, [],
  ];
}
const abaAlertas = (achados = []) => ({
  nome: "Alertas",
  linhas: [["Gravidade", "Categoria", "Mês", "Título", "Detalhe", "O que fazer"], ...achados.map((x) => [SEV[x.severidade] || x.severidade, x.categoria || "", rot(x.mes), x.titulo || "", x.detalhe || "", x.sugestao || ""])],
  larguras: [12, 18, 10, 70, 60, 50],
});
function abaEntregas(titulo, e) {
  if (!e) return null;
  const linhas = [[titulo], ["Mês", "Situação"]];
  const mapa = [["comMovimento", "Com movimento"], ["semMovimento", "Sem movimento"], ["indefinido", "Entregue (movimento não lido)"], ["naoEncontrados", "Não encontrada"], ["aVencer", "Dentro do prazo"]];
  const por = {};
  for (const [k, r] of mapa) for (const m of e[k] || []) por[m] = r;
  for (const m of Object.keys(por).sort()) linhas.push([rot(m), por[m]]);
  return linhas.length > 2 ? linhas : null;
}

// ----- Relatório de apurações -----
export function abasApuracao(a) {
  const abas = [];
  abas.push({ nome: "Resumo", linhas: cabecalho(a, [["Arquivos lidos", a.arquivosLidos ?? ""]]), larguras: [24, 50] });
  const ent = [];
  for (const [t, e] of [[a.regime === "PRESUMIDO" ? "Entregas da MIT" : a.regime === "NAO_SIMPLES" ? "Entregas da DCTF" : "Entregas do PGDAS-D", a.entregas], ["Entregas da MIT (Lucro Presumido/Real)", a.presumido?.entregas]]) {
    const l = abaEntregas(t, e); if (l) { ent.push(...l, []); }
  }
  if (ent.length) abas.push({ nome: "Entregas", linhas: ent, larguras: [14, 32] });
  if (a.regime !== "PRESUMIDO" && a.regime !== "NAO_SIMPLES" && a.meses?.length) {
    abas.push({
      nome: "Simples mês a mês",
      linhas: [["Mês", "Receita", "RBT12", "Anexo", "Faixa", "Alíq. efetiva", "Declarado", "Recalculado", "Diferença", "Guia", "Situação", "Entregue em", "Recibo"],
        ...a.meses.map((m) => [m.rotulo, n(m.rpa), n(m.rbt12), m.anexos || "", n(m.faixa), n(m.aliquotaEfetiva), n(m.debitoDeclarado), n(m.debitoRecalculado), n(m.diferenca), n(m.valorGuia), sit(m.situacao), dt(m.entregaEm), m.reciboNumero || ""])],
      larguras: [10, 14, 14, 10, 8, 12, 14, 14, 12, 12, 22, 12, 24],
    });
  }
  const P = a.regime === "PRESUMIDO" ? a : a.presumido;
  if (P?.meses?.length) {
    const linhas = [["Mês", "Situação do mês", "Tributo", "Base", "Alíquota", "Declarado", "Recalculado", "Retenções", "A pagar", "MIT", "Guia", "Confere?"]];
    for (const m of P.meses) {
      if (!m.tributos.length) linhas.push([m.rotulo, sit(m.situacao), "", "", "", "", "", "", "", "", "", ""]);
      for (const t of m.tributos) linhas.push([m.rotulo, sit(m.situacao), t.tributo, n(t.base), n(t.aliquota), n(t.declarado), n(t.recalculado), n(t.retencoes), n(t.saldoDevedor), t.tributo === "ISS" ? "" : n(t.mit), n(t.darf), t.status === "ok" ? "Sim" : "Divergente"]);
    }
    abas.push({ nome: "Lucro Presumido", linhas, larguras: [10, 22, 10, 14, 10, 14, 14, 12, 12, 12, 12, 12] });
  }
  if (a.regime === "NAO_SIMPLES" && a.meses?.length) abas.push({ nome: "DCTF", linhas: [["Mês", "Situação", "Entrega", "Recibo"], ...a.meses.map((m) => [m.rotulo, sit(m.situacao), dt(m.entregaEm), m.reciboNumero || ""])], larguras: [10, 28, 12, 26] });
  if (a.folha?.meses?.length) abas.push({ nome: "DCTFWeb (folha)", linhas: [["Mês", "Situação", "Débitos apurados", "Saldo a pagar", "Origem", "Entrega"], ...a.folha.meses.map((m) => [m.rotulo, sit(m.situacao), n(m.debito), n(m.saldoPagar), (m.origens || []).join(" + "), dt(m.entregaEm)])], larguras: [10, 28, 16, 14, 18, 12] });
  if (a.dime?.meses?.length) abas.push({ nome: "DIME", linhas: [["Mês", "Situação", "Registros de movimento", "Entrega"], ...a.dime.meses.map((m) => [m.rotulo, sit(m.situacao), n(m.registrosMovimento), dt(m.entregaEm)])], larguras: [10, 28, 22, 12] });
  if (a.defis?.length) abas.push({ nome: "DEFIS", linhas: [["Ano", "Situação", "Empregados início", "Empregados fim", "Lucros pagos ao sócio", "Saídas interestaduais", "Entrega", "Recibo"], ...a.defis.map((d) => [d.ano, sit(d.situacao), n(d.empregadosInicio), n(d.empregadosFim), n(d.rendimentosSocios), n(d.saidasInterestaduais), dt(d.entregaEm), d.reciboNumero || ""])], larguras: [8, 22, 16, 14, 20, 20, 12, 26] });
  abas.push(abaAlertas(a.achados));
  return abas;
}

// ----- Relatório da pasta do cliente -----
export function abasPasta(a) {
  const abas = [];
  abas.push({ nome: "Resumo", linhas: cabecalho(a, [["Arquivos", a.totalArquivos ?? ""], ["Gerado em", dt(a.geradoEm)]]), larguras: [24, 50] });
  abas.push(abaAlertas(a.achados));
  const docs = [["Pasta", "Documento", "Tipo", "Mês", "Situação", "Detalhe"]];
  for (const no of a.arvore || []) for (const d of no.documentos || []) docs.push([no.nome, d.nome, d.tipo || "", d.competencia ? rot(d.competencia) : "", d.situacao || "", [d.detalhe, ...(d.alertas || []).map((x) => x.titulo)].filter(Boolean).join(" | ")]);
  if (docs.length > 1) abas.push({ nome: "Documentos", linhas: docs, larguras: [34, 60, 24, 10, 16, 70] });
  const pastas = [["Pasta", "Situação", "Arquivos", "Vencidos", "Vencendo", "Não lidos", "O que deve ter"], ...(a.arvore || []).map((no) => [`${"  ".repeat(no.nivel || 0)}${no.nome}`, no.status || "", n(no.arquivos), no.resumoDocs?.vencidos || 0, no.resumoDocs?.vencendo || 0, no.resumoDocs?.naoLidos || 0, no.conteudoEsperado || ""])];
  if (pastas.length > 1) abas.push({ nome: "Pastas", linhas: pastas, larguras: [40, 18, 10, 10, 10, 10, 70] });
  if (a.meses?.length) abas.push({ nome: "Simples mês a mês", linhas: [["Mês", "Declaração", "Recibo", "Extrato", "Guia DAS", "Receita", "Situação"], ...a.meses.map((m) => [m.rotulo, m.declaracao ? "Sim" : "Não", m.recibo ? "Sim" : "Não", m.extrato ? "Sim" : "Não", m.das ? "Sim" : "Não", n(m.receita), m.semMovimento && m.situacao === "ok" ? "Sem movimento (entregue)" : m.situacao || ""])], larguras: [10, 12, 10, 10, 10, 14, 28] });
  if (a.cobertura?.linhas?.length) abas.push({ nome: "Cobertura mensal", linhas: [["Documento", "Pasta", ...a.cobertura.meses.map(rot)], ...a.cobertura.linhas.map((l) => [l.tipo, String(l.grupo || "").split(" / ").slice(-1)[0], ...a.cobertura.meses.map((m) => (l.presentes?.[m] ? "OK" : m >= l.ini && m <= l.fim ? "FALTA" : ""))])], larguras: [34, 28] });
  return abas;
}

export async function baixarExcel(nomeArquivo, abas) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const usados = new Set();
  for (const aba of abas) {
    const ws = XLSX.utils.aoa_to_sheet(aba.linhas);
    if (aba.larguras) ws["!cols"] = aba.larguras.map((w) => ({ wch: w }));
    let nome = aba.nome.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
    while (usados.has(nome)) nome = `${nome.slice(0, 28)}_${usados.size}`;
    usados.add(nome);
    XLSX.utils.book_append_sheet(wb, ws, nome);
  }
  XLSX.writeFile(wb, nomeArquivo);
}

export const nomeArquivoRelatorio = (tipo, a) => `${tipo}_${String(a.cliente?.codigo || "")}_${String(a.cliente?.nome || "cliente").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 30)}_${new Date().toISOString().slice(0, 10)}.xlsx`;
