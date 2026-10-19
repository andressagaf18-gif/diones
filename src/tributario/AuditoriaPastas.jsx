import { useMemo, useRef, useState } from "react";
import { separarClientes, auditarCliente, extrairFatosDeTexto, extrairFatosNota, brl } from "../../server/pasta-engine.js";

const NAVY = "#17233D", CORAL = "#FF6B4A", MUTED = "#5B667A", BORDER = "#E3E7EF", WHITE = "#FFFFFF";
const COR = { critico: "#C62828", atencao: "#E08A00", info: "#4A6FA5" };
const ROTULO = { critico: "Crítico", atencao: "Atenção", info: "Informativo" };
const LIMITE_PDFS = 600;
const LIMITE_BYTES_PDF = 12 * 1024 * 1024;

function carregarScript(src) {
  return new Promise((ok, erro) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const s = document.createElement("script");
    s.src = src; s.onload = ok; s.onerror = () => erro(new Error(`Não foi possível carregar ${src}`));
    document.head.appendChild(s);
  });
}
async function jszip() {
  if (!window.JSZip) await carregarScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
  return window.JSZip;
}
async function pdfjs() {
  if (!window.pdfjsLib) await carregarScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  return window.pdfjsLib;
}
async function textoDoPdf(buffer) {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: buffer }).promise;
  let saida = "";
  for (let i = 1; i <= Math.min(doc.numPages, 4); i++) {
    const pag = await doc.getPage(i);
    const c = await pag.getTextContent();
    let y = null;
    for (const it of c.items) {
      const yy = Math.round(it.transform?.[5] ?? 0);
      if (y !== null && Math.abs(yy - y) > 2) saida += "\n";
      else if (y !== null) saida += " ";
      saida += it.str; y = yy;
    }
    saida += "\n";
  }
  return saida;
}

// Lê arquivos de pasta arrastada (FileSystemEntry) recursivamente.
async function lerEntrada(entry, prefixo, saida) {
  if (entry.isFile) {
    const file = await new Promise((ok, erro) => entry.file(ok, erro));
    saida.push({ caminho: `${prefixo}${entry.name}`, tipo: "arquivo", tamanho: file.size, modificadoEm: file.lastModified, _file: file });
  } else if (entry.isDirectory) {
    saida.push({ caminho: `${prefixo}${entry.name}`, tipo: "pasta" });
    const leitor = entry.createReader();
    let lote;
    do {
      lote = await new Promise((ok, erro) => leitor.readEntries(ok, erro));
      for (const f of lote) await lerEntrada(f, `${prefixo}${entry.name}/`, saida);
    } while (lote.length);
  }
}

async function entradasDeZip(file) {
  const Z = await jszip();
  const zip = await Z.loadAsync(file);
  const saida = [];
  zip.forEach((caminho, obj) => {
    const limpo = caminho.replace(/\/$/, "");
    if (obj.dir) saida.push({ caminho: limpo, tipo: "pasta" });
    else saida.push({ caminho: limpo, tipo: "arquivo", tamanho: obj._data?.uncompressedSize || 0, modificadoEm: obj.date?.getTime?.() || 0, _zip: obj });
  });
  return saida;
}

const Cartao = ({ children, style }) => <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 18, ...style }}>{children}</div>;
const Btn = ({ children, onClick, sec, disabled }) => (
  <button type="button" onClick={onClick} disabled={disabled} style={{ border: sec ? `1px solid ${BORDER}` : "none", background: sec ? WHITE : CORAL, color: sec ? NAVY : WHITE, borderRadius: 10, padding: "9px 14px", fontWeight: 800, fontSize: 12, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}>{children}</button>
);
const Selo = ({ sev, n }) => <span style={{ background: `${COR[sev]}18`, color: COR[sev], fontWeight: 900, fontSize: 10, borderRadius: 999, padding: "3px 8px", marginRight: 4 }}>{n} {ROTULO[sev].toLowerCase()}</span>;

export default function AuditoriaPastas({ token, onVoltar }) {
  const [fase, setFase] = useState("envio");
  const [progresso, setProgresso] = useState("");
  const [erro, setErro] = useState("");
  const [auditorias, setAuditorias] = useState([]);
  const [aviso, setAviso] = useState([]);
  const [sel, setSel] = useState(null);
  const [regime, setRegime] = useState("AUTO");
  const [inicio, setInicio] = useState("");
  const [narrativas, setNarrativas] = useState({});
  const [ia, setIa] = useState("");
  const [salvo, setSalvo] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [driveLista, setDriveLista] = useState(null);
  const [driveUm, setDriveUm] = useState("todos");
  const inputPasta = useRef(null);
  const inputZip = useRef(null);

  async function api(action, body, method = "POST", query = {}) {
    const p = new URLSearchParams({ action, ...query });
    const r = await fetch(`/api/tributario?${p}`, { method, headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: method === "GET" ? undefined : JSON.stringify(body) });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d?.sucesso) throw new Error(d?.error || "Erro na auditoria.");
    return d;
  }

  async function processar(entradas) {
    setErro(""); setFase("lendo"); setSalvo(""); setNarrativas({}); setSel(null);
    try {
      const { clientes, foraDoPadrao, prefixo } = separarClientes(entradas);
      if (!clientes.length) throw new Error("Não encontrei pastas de cliente no padrão “CÓDIGO - NOME”. Envie a pasta de um cliente dentro de uma pasta com esse nome, ou a pasta com todos os clientes.");
      const avisos = [];
      if (foraDoPadrao.length) avisos.push(`Ignoradas por não seguirem o padrão “CÓDIGO - NOME”: ${foraDoPadrao.slice(0, 6).join(", ")}${foraDoPadrao.length > 6 ? "…" : ""}`);
      let pdfsLidos = 0;
      const mapa = new Map(entradas.map((x) => [x.caminho, x]));
      const resultado = [];
      for (let ci = 0; ci < clientes.length; ci++) {
        const c = clientes[ci];
        setProgresso(`Cliente ${ci + 1} de ${clientes.length}: ${c.codigo} - ${c.nome}`);
        const fatos = {};
        for (const e of c.entradas) {
          if (e.tipo === "pasta") continue;
          const original = mapa.get([...prefixo, c.raiz, e.caminho].join("/")) || null;
          const nome = e.caminho.split("/").pop();
          try {
            if (/\.pdf$/i.test(nome) && pdfsLidos < LIMITE_PDFS && (e.tamanho || 0) < LIMITE_BYTES_PDF && original) {
              const buf = original._file ? await original._file.arrayBuffer() : await original._zip.async("arraybuffer");
              fatos[e.caminho] = extrairFatosDeTexto(nome, await textoDoPdf(buf));
              pdfsLidos += 1;
            } else if (/\.xml$/i.test(nome) && (e.tamanho || 0) < 600000 && original) {
              const xml = original._file ? await original._file.text() : await original._zip.async("string");
              const f = extrairFatosNota(nome, xml);
              if (f) fatos[e.caminho] = f;
            }
          } catch { fatos[e.caminho] = { nome, legivel: false }; }
        }
        resultado.push(auditarCliente({ cliente: c, regime, fatos, inicioObrigacoes: inicio, hoje: new Date() }));
      }
      if (pdfsLidos >= LIMITE_PDFS) avisos.push(`Para manter a análise rápida, li o texto de até ${LIMITE_PDFS} PDFs; os demais foram avaliados só pelo nome e pela pasta.`);
      resultado.sort((a, b) => a.saude - b.saude);
      setAviso(avisos); setAuditorias(resultado); setFase("resultado");
      if (resultado.length === 1) setSel(resultado[0].cliente.codigo);
    } catch (e) { setErro(e.message || "Não consegui ler os arquivos."); setFase("envio"); }
  }

  async function carregarDrive() {
    setErro("");
    try { const d = await api("pasta-drive-clientes", null, "GET"); setDriveLista(d); }
    catch (e) { setErro(e.message); }
  }
  async function auditarDrive() {
    setErro(""); setFase("lendo"); setSalvo(""); setNarrativas({}); setSel(null);
    const alvos = driveUm === "todos" ? driveLista.clientes : driveLista.clientes.filter((c) => c.id === driveUm);
    const resultado = []; const avisos = [];
    try {
      for (let i = 0; i < alvos.length; i++) {
        const c = alvos[i];
        setProgresso(`Lendo o Drive — cliente ${i + 1} de ${alvos.length}: ${c.codigo} - ${c.nome}`);
        try {
          const d = await api("pasta-drive-auditar", { pastaId: c.id, codigo: c.codigo, nome: c.nome, raiz: c.raiz, regime, inicio });
          resultado.push(d.auditoria);
          if (d.parcial) avisos.push(`${c.codigo} - ${c.nome}: li ${d.documentosLidos} de ${d.documentosCandidatos} documentos (limite de tempo). Rode de novo só para este cliente para completar.`);
        } catch (e) { avisos.push(`${c.codigo} - ${c.nome}: não consegui ler (${e.message}).`); }
      }
      if (!resultado.length) throw new Error("Nenhum cliente pôde ser auditado. " + (avisos[0] || ""));
      resultado.sort((a, b) => a.saude - b.saude);
      setAviso(avisos); setAuditorias(resultado); setFase("resultado");
      if (resultado.length === 1) setSel(resultado[0].cliente.codigo);
    } catch (e) { setErro(e.message); setFase("envio"); }
  }

  async function aoSoltar(ev) {
    ev.preventDefault();
    const itens = [...(ev.dataTransfer?.items || [])];
    try {
      const zip = [...(ev.dataTransfer?.files || [])].find((f) => /\.zip$/i.test(f.name));
      if (zip) return processar(await entradasDeZip(zip));
      const saida = [];
      for (const it of itens) { const en = it.webkitGetAsEntry?.(); if (en) await lerEntrada(en, "", saida); }
      processar(saida);
    } catch (e) { setErro(e.message); }
  }
  async function aoEscolherPasta(ev) {
    const arquivos = [...ev.target.files];
    if (!arquivos.length) return;
    const saida = arquivos.map((f) => ({ caminho: f.webkitRelativePath || f.name, tipo: "arquivo", tamanho: f.size, modificadoEm: f.lastModified, _file: f }));
    processar(saida);
  }
  async function aoEscolherZip(ev) {
    const f = ev.target.files?.[0];
    if (!f) return;
    try { processar(await entradasDeZip(f)); } catch (e) { setErro("Não consegui abrir o ZIP: " + e.message); }
  }

  const atual = useMemo(() => auditorias.find((a) => a.cliente.codigo === sel) || null, [auditorias, sel]);

  async function pedirIa(a) {
    setIa(a.cliente.codigo);
    try {
      const d = await api("pasta-narrativa", { auditoria: a });
      setNarrativas((n) => ({ ...n, [a.cliente.codigo]: d.narrativa }));
    } catch (e) { setErro(e.message); }
    setIa("");
  }
  async function salvar() {
    try {
      const d = await api("pasta-salvar", { origem: "upload", auditorias: auditorias.map((a) => ({ auditoria: a, narrativa: narrativas[a.cliente.codigo] || null })) });
      setSalvo(`${d.salvos} auditoria(s) salva(s) no histórico.`);
    } catch (e) { setErro(e.message); }
  }
  function baixarCsv() {
    const linhas = [["Cliente", "Código", "Regime", "Gravidade", "Categoria", "Achado", "Detalhe", "Sugestão"]];
    for (const a of auditorias) for (const x of a.achados) linhas.push([a.cliente.nome, a.cliente.codigo, a.regime, ROTULO[x.severidade], x.categoria, x.titulo, x.detalhe, x.sugestao || ""]);
    const csv = linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "auditoria-de-pastas.csv"; a.click(); URL.revokeObjectURL(url);
  }

  const cabecalho = (
    <div style={{ background: "linear-gradient(135deg,#0E1A33,#17233D)", color: WHITE, borderRadius: 22, padding: 22, marginBottom: 14 }}>
      <div style={{ color: "#FFB7A7", fontSize: 9, fontWeight: 900, letterSpacing: 1.3 }}>FINDER TAX INTELLIGENCE</div>
      <h2 style={{ margin: "6px 0", fontSize: 26 }}>Auditoria de pastas de clientes</h2>
      <p style={{ margin: 0, color: "#D8DEEA", fontSize: 12, maxWidth: 760, lineHeight: 1.55 }}>Envie a pasta de um cliente, ou a pasta com todos eles. O sistema confere a estrutura, o que está faltando, o que venceu, o que está no lugar errado e se as declarações batem com as notas.</p>
    </div>
  );

  if (fase === "envio" || fase === "lendo") {
    return (
      <div>
        {cabecalho}
        <Btn sec onClick={onVoltar}>← Voltar</Btn>
        <Cartao style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 6 }}>Direto do Google Drive</div>
          {!driveLista ? (
            <div><div style={{ color: MUTED, fontSize: 12, marginBottom: 8 }}>Lê a pasta compartilhada com o sistema, sem você anexar nada.</div><Btn onClick={carregarDrive}>Conectar ao Drive</Btn></div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select value={driveUm} onChange={(e) => setDriveUm(e.target.value)} style={{ padding: 8, borderRadius: 8, border: `1px solid ${BORDER}`, maxWidth: 360 }}>
                <option value="todos">Todos os clientes ({driveLista.clientes.length})</option>
                {driveLista.clientes.map((c) => <option key={c.id} value={c.id}>{c.codigo} - {c.nome}</option>)}
              </select>
              <Btn onClick={auditarDrive} disabled={fase === "lendo" || !driveLista.clientes.length}>Auditar pelo Drive</Btn>
              {driveLista.ignoradas?.length > 0 && <span style={{ fontSize: 11, color: MUTED }}>{driveLista.ignoradas.length} pasta(s) fora do padrão ignorada(s)</span>}
            </div>
          )}
          {erro && fase === "envio" && <div style={{ marginTop: 10, color: COR.critico, fontSize: 12, fontWeight: 700 }}>{erro}</div>}
        </Cartao>
        <Cartao style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 8 }}>Ou envie manualmente</div>
          <div onDragOver={(e) => e.preventDefault()} onDrop={aoSoltar} style={{ border: `2px dashed ${BORDER}`, borderRadius: 14, padding: 34, textAlign: "center", background: "#FAFBFD" }}>
            {fase === "lendo" ? (
              <div><div style={{ fontWeight: 900, fontSize: 15 }}>Lendo e conferindo os documentos…</div><div style={{ color: MUTED, fontSize: 12, marginTop: 6 }}>{progresso}</div><div style={{ color: MUTED, fontSize: 11, marginTop: 6 }}>Tudo é lido no seu navegador. Os arquivos não são enviados ao servidor.</div></div>
            ) : (
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Arraste aqui a pasta do cliente (ou a pasta com todos os clientes)</div>
                <div style={{ color: MUTED, fontSize: 12, margin: "6px 0 14px" }}>Também aceita um arquivo .zip. Padrão esperado: “232 - NOME DO CLIENTE”.</div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                  <Btn onClick={() => inputPasta.current?.click()}>Escolher pasta</Btn>
                  <Btn sec onClick={() => inputZip.current?.click()}>Escolher .zip</Btn>
                </div>
                <input ref={inputPasta} type="file" webkitdirectory="" directory="" multiple onChange={aoEscolherPasta} style={{ display: "none" }} />
                <input ref={inputZip} type="file" accept=".zip" onChange={aoEscolherZip} style={{ display: "none" }} />
              </div>
            )}
          </div>
          {fase === "envio" && (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 14, fontSize: 12 }}>
              <label>Regime do cliente<br />
                <select value={regime} onChange={(e) => setRegime(e.target.value)} style={{ padding: 7, borderRadius: 8, border: `1px solid ${BORDER}` }}>
                  <option value="AUTO">Detectar pelos documentos</option><option value="SIMPLES">Simples Nacional</option><option value="MEI">MEI</option><option value="PRESUMIDO">Lucro Presumido</option><option value="REAL">Lucro Real</option>
                </select></label>
              <label>Início das obrigações (opcional)<br />
                <input type="month" value={inicio} onChange={(e) => setInicio(e.target.value)} style={{ padding: 6, borderRadius: 8, border: `1px solid ${BORDER}` }} /></label>
              <div style={{ color: MUTED, maxWidth: 420, alignSelf: "end" }}>Se informar o mês em que a empresa passou a ter obrigações, o sistema cobra todos os meses desde então. Sem isso, cobra a partir do primeiro mês encontrado na pasta.</div>
            </div>
          )}
        </Cartao>
      </div>
    );
  }

  const totais = auditorias.reduce((t, a) => ({ c: t.c + a.resumo.critico, a: t.a + a.resumo.atencao, i: t.i + a.resumo.info }), { c: 0, a: 0, i: 0 });

  return (
    <div>
      {cabecalho}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <Btn sec onClick={() => { setFase("envio"); setAuditorias([]); setSel(null); }}>← Nova auditoria</Btn>
        <Btn sec onClick={baixarCsv}>Baixar CSV dos alertas</Btn>
        <Btn onClick={salvar}>Salvar no histórico</Btn>
        {salvo && <span style={{ alignSelf: "center", color: "#2E7D32", fontSize: 12, fontWeight: 700 }}>{salvo}</span>}
      </div>
      {erro && <div style={{ marginBottom: 10, color: COR.critico, fontSize: 12, fontWeight: 700 }}>{erro}</div>}
      {aviso.map((t, i) => <div key={i} style={{ background: "#FFF6E5", border: "1px solid #F3D9A4", borderRadius: 10, padding: 9, fontSize: 11, marginBottom: 8 }}>{t}</div>)}

      <div style={{ display: "grid", gridTemplateColumns: auditorias.length > 1 ? "minmax(260px,340px) 1fr" : "1fr", gap: 12, alignItems: "start" }}>
        {auditorias.length > 1 && (
          <Cartao style={{ padding: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>{auditorias.length} clientes</div>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>{totais.c} críticos · {totais.a} atenção · {totais.i} informativos. Pior situação primeiro.</div>
            {auditorias.map((a) => (
              <button key={a.cliente.codigo} type="button" onClick={() => setSel(a.cliente.codigo)} style={{ width: "100%", textAlign: "left", background: sel === a.cliente.codigo ? "#FFF1ED" : WHITE, border: `1px solid ${sel === a.cliente.codigo ? CORAL : BORDER}`, borderRadius: 10, padding: 9, marginBottom: 6, cursor: "pointer" }}>
                <div style={{ fontWeight: 800, fontSize: 12 }}>{a.cliente.codigo} - {a.cliente.nome}</div>
                <div style={{ marginTop: 4 }}>{a.resumo.critico > 0 && <Selo sev="critico" n={a.resumo.critico} />}{a.resumo.atencao > 0 && <Selo sev="atencao" n={a.resumo.atencao} />}<span style={{ fontSize: 10, color: MUTED }}>saúde {a.saude}</span></div>
              </button>
            ))}
          </Cartao>
        )}

        <div>
          {!atual && <Cartao><div style={{ color: MUTED, fontSize: 13 }}>Escolha um cliente na lista para ver os detalhes.</div></Cartao>}
          {atual && (
            <div>
              <Cartao style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 17 }}>{atual.cliente.codigo} - {atual.cliente.nome}</div>
                    <div style={{ color: MUTED, fontSize: 12, marginTop: 3 }}>Regime: {({ SIMPLES: "Simples Nacional", MEI: "MEI", PRESUMIDO: "Lucro Presumido", REAL: "Lucro Real", NAO_IDENTIFICADO: "não identificado" })[atual.regime] || atual.regime} · {atual.totalArquivos} arquivo(s)</div>
                    <div style={{ marginTop: 8 }}><Selo sev="critico" n={atual.resumo.critico} /><Selo sev="atencao" n={atual.resumo.atencao} /><Selo sev="info" n={atual.resumo.info} /></div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 30, fontWeight: 900, color: atual.saude >= 70 ? "#2E7D32" : atual.saude >= 40 ? COR.atencao : COR.critico }}>{atual.saude}</div>
                    <div style={{ fontSize: 10, color: MUTED }}>saúde da pasta</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                  {atual.inventario.map((i) => <span key={i.pasta} style={{ fontSize: 10, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "3px 7px", color: !i.existe ? COR.critico : i.arquivos ? NAVY : COR.atencao }}>{i.pasta}: {i.existe ? `${i.arquivos} arq.` : "ausente"}</span>)}
                </div>
              </Cartao>

              <Cartao style={{ marginBottom: 10, borderLeft: `4px solid ${CORAL}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 900 }}>Leitura da IA</div>
                  {!narrativas[atual.cliente.codigo] && <Btn onClick={() => pedirIa(atual)} disabled={ia === atual.cliente.codigo}>{ia === atual.cliente.codigo ? "Analisando…" : "Pedir comentário da IA"}</Btn>}
                </div>
                {narrativas[atual.cliente.codigo] ? (() => { const n = narrativas[atual.cliente.codigo]; return (
                  <div style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 8 }}>
                    <p style={{ marginTop: 0 }}>{n.resumo}</p>
                    {[["Prioridades", n.prioridades], ["Melhorias de organização", n.melhorias], ["Pontos a verificar", n.oportunidades]].map(([t, l]) => l?.length ? <div key={t}><b>{t}</b><ul style={{ margin: "4px 0 8px", paddingLeft: 18 }}>{l.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null)}
                  </div>); })() : <div style={{ color: MUTED, fontSize: 11, marginTop: 6 }}>A IA recebe só os achados e os totais (sem o conteúdo dos documentos) e sugere prioridades e melhorias.</div>}
              </Cartao>

              {atual.meses.length > 0 && (
                <Cartao style={{ marginBottom: 10, overflowX: "auto" }}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Simples Nacional — mês a mês</div>
                  <table style={{ borderCollapse: "collapse", fontSize: 11.5, width: "100%" }}>
                    <thead><tr style={{ textAlign: "left", color: MUTED }}>{["Mês", "Declaração", "Recibo", "Extrato", "Guia DAS", "Receita", "Situação"].map((h) => <th key={h} style={{ padding: "4px 8px" }}>{h}</th>)}</tr></thead>
                    <tbody>{atual.meses.map((m) => (
                      <tr key={m.mes} style={{ borderTop: `1px solid ${BORDER}` }}>
                        <td style={{ padding: "5px 8px", fontWeight: 800 }}>{m.rotulo}</td>
                        {[m.declaracao, m.recibo, m.extrato, m.das].map((v, i) => <td key={i} style={{ padding: "5px 8px", color: v ? "#2E7D32" : (m.semMovimento && i > 1) ? MUTED : COR.critico, fontWeight: 800 }}>{v ? "✓" : (m.semMovimento && i > 1) ? "n/a" : "✗"}</td>)}
                        <td style={{ padding: "5px 8px" }}>{m.receita !== null ? brl(m.receita) : "—"}</td>
                        <td style={{ padding: "5px 8px", fontWeight: 800, color: m.situacao === "ok" ? "#2E7D32" : m.situacao === "no_prazo" ? COR.atencao : COR.critico }}>{({ ok: "Completo", incompleto: `Falta ${m.faltam?.join(", ")}`, faltando: "Sem documentos", no_prazo: "Dentro do prazo, sem documentos" })[m.situacao]}</td>
                      </tr>))}</tbody>
                  </table>
                </Cartao>
              )}

              <Cartao>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontWeight: 900 }}>Alertas e pendências ({atual.achados.length})</div>
                  <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ padding: 5, borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 11 }}>
                    <option value="todos">Todos</option><option value="critico">Só críticos</option><option value="atencao">Só atenção</option><option value="info">Só informativos</option>
                  </select>
                </div>
                {atual.achados.filter((x) => filtro === "todos" || x.severidade === filtro).map((x) => (
                  <div key={x.id} style={{ borderLeft: `4px solid ${COR[x.severidade]}`, background: "#FAFBFD", borderRadius: 8, padding: "8px 10px", marginBottom: 7 }}>
                    <div style={{ fontSize: 10, fontWeight: 900, color: COR[x.severidade], letterSpacing: 0.6 }}>{ROTULO[x.severidade].toUpperCase()} · {x.categoria.toUpperCase()}</div>
                    <div style={{ fontWeight: 800, fontSize: 12.5, margin: "2px 0" }}>{x.titulo}</div>
                    <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>{x.detalhe}</div>
                    {x.sugestao && <div style={{ fontSize: 11.5, marginTop: 3 }}><b>O que fazer:</b> {x.sugestao}</div>}
                  </div>))}
                {!atual.achados.length && <div style={{ color: "#2E7D32", fontWeight: 800 }}>Nenhuma pendência encontrada.</div>}
              </Cartao>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
