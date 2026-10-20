// server/apuracao-drive.js — lê as declarações PGDAS-D e guias DAS da pasta do cliente no Drive e audita a apuração.
import pdf from "pdf-parse/lib/pdf-parse.js";
import { varrer, baixar, paginaComoTexto, emLotes } from "./pasta-drive.js";
import { extrairFatosDeTexto } from "./pasta-engine.js";
import { lerDeclaracao, auditarApuracoes } from "./apuracao-engine.js";

const mesDoCaminho = (c) => { const m = c.match(/(?:^|\/)(0[1-9]|1[0-2])[.\-_ ]?(20\d{2})(?:\/|$)/); return m ? `${m[2]}-${m[1]}` : ""; };

export async function auditarApuracaoDrive({ pastaId, codigo, nome, raiz, limiteMs = 45000 }) {
  const t0 = Date.now();
  const entradas = [];
  await varrer(String(pastaId), "", entradas, 6000);
  const pdfs = entradas.filter((e) => e.tipo === "arquivo" && /\.pdf$/i.test(e.caminho) && e.tamanho < 8 * 1024 * 1024);
  const ehDecl = (e) => /DECLARACAO/i.test(e.caminho.split("/").pop());
  const ehGuia = (e) => /simples/i.test(e.caminho) && !/DECLARACAO|RECIBO|EXTRATO/i.test(e.caminho.split("/").pop());
  const decls = pdfs.filter(ehDecl).sort((a, b) => b.caminho.localeCompare(a.caminho)).slice(0, 36);
  const guiasArq = pdfs.filter(ehGuia).slice(0, 40);

  const declaracoes = [], guias = {}, falhas = [];
  await emLotes(decls, 4, async (e) => {
    if (Date.now() - t0 > limiteMs) { falhas.push(`${e.caminho.split("/").pop()}: tempo esgotado`); return; }
    const nomeArq = e.caminho.split("/").pop();
    try {
      const buf = await baixar(e._id);
      const d = await pdf(buf, { max: 6, pagerender: paginaComoTexto });
      const l = lerDeclaracao(d.text || "", nomeArq);
      if (l) { l.caminho = e.caminho; declaracoes.push(l); } else falhas.push(`${nomeArq}: não foi possível ler os campos`);
    } catch (er) { falhas.push(`${nomeArq}: ${String(er?.message || er).slice(0, 80)}`); }
  });
  await emLotes(guiasArq, 4, async (e) => {
    if (Date.now() - t0 > limiteMs) return;
    try {
      const buf = await baixar(e._id);
      const d = await pdf(buf, { max: 2, pagerender: paginaComoTexto });
      const f = extrairFatosDeTexto(e.caminho.split("/").pop(), d.text || "");
      if (f.ehGuiaSimples && !f.ehParcelamento && f.valorGuia !== undefined) {
        const pa = f.pa || mesDoCaminho(e.caminho);
        if (pa) guias[pa] = { valorGuia: f.valorGuia, vencimento: f.vencimento || "" };
      }
    } catch { /* guia ilegível não bloqueia a auditoria */ }
  });

  const auditoria = auditarApuracoes({ cliente: { codigo, nome: nome || "", raiz: raiz || "", driveId: String(pastaId) }, declaracoes, guias });
  if (!declaracoes.length) auditoria.aviso = "Nenhuma declaração do PGDAS-D foi encontrada nesta pasta. Se o cliente é Lucro Presumido ou Lucro Real, essa conferência ainda não está disponível.";
  if (falhas.length) auditoria.falhas = falhas.slice(0, 12);
  auditoria.arquivosLidos = declaracoes.length;
  return auditoria;
}
