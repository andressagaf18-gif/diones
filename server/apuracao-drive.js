// server/apuracao-drive.js — lê as declarações PGDAS-D e guias DAS da pasta do cliente no Drive e audita a apuração.
import { varrer, baixar, textoDoPdf, emLotes } from "./pasta-drive.js";
import { extrairFatosDeTexto } from "./pasta-engine.js";
import { lerDeclaracao, lerRecibo, auditarApuracoes } from "./apuracao-engine.js";

const mesDoCaminho = (c) => { const m = c.match(/(?:^|\/)(0[1-9]|1[0-2])[.\-_ ]?(20\d{2})(?:\/|$)/); return m ? `${m[2]}-${m[1]}` : ""; };

export async function auditarApuracaoDrive({ pastaId, codigo, nome, raiz, limiteMs = 45000 }) {
  const t0 = Date.now();
  const entradas = [];
  await varrer(String(pastaId), "", entradas, 6000);
  const pdfs = entradas.filter((e) => e.tipo === "arquivo" && /\.pdf$/i.test(e.caminho) && e.tamanho < 8 * 1024 * 1024);
  // Tudo que parece do Simples/PGDAS-D (declaração, recibo, declaração sem movimento, guia). Extrato fiscal fica de fora.
  const cand = pdfs.filter((e) => /simples|pgdas|declara|recibo|das\b/i.test(e.caminho) && !/EXTRATO/i.test(e.caminho.split("/").pop()))
    .sort((a, b) => b.caminho.localeCompare(a.caminho)).slice(0, 80);

  const declaracoes = [], guias = {}, falhas = [];
  let lidos = 0;
  await emLotes(cand, 4, async (e) => {
    if (Date.now() - t0 > limiteMs) { falhas.push(`${e.caminho.split("/").pop()}: tempo esgotado`); return; }
    const nomeArq = e.caminho.split("/").pop();
    try {
      const buf = await baixar(e._id);
      const texto = await textoDoPdf(buf, { max: 6 });
      lidos += 1;
      const decl = lerDeclaracao(texto, nomeArq) || lerRecibo(texto, nomeArq);
      if (decl) { decl.caminho = e.caminho; declaracoes.push(decl); return; }
      const f = extrairFatosDeTexto(nomeArq, texto);
      if (f.ehGuiaSimples && !f.ehParcelamento && f.valorGuia !== undefined) {
        const pa = f.pa || mesDoCaminho(e.caminho);
        if (pa) guias[pa] = { valorGuia: f.valorGuia, vencimento: f.vencimento || "" };
      }
    } catch (er) { falhas.push(`${nomeArq}: ${String(er?.message || er).slice(0, 80)}`); }
  });

  const auditoria = auditarApuracoes({ cliente: { codigo, nome: nome || "", raiz: raiz || "", driveId: String(pastaId) }, declaracoes, guias });
  if (!declaracoes.length) auditoria.aviso = "Nenhuma declaração ou recibo do PGDAS-D foi encontrado nesta pasta. Se o cliente é Lucro Presumido ou Lucro Real, essa conferência ainda não está disponível.";
  if (falhas.length) auditoria.falhas = falhas.slice(0, 12);
  auditoria.arquivosLidos = lidos;
  return auditoria;
}
