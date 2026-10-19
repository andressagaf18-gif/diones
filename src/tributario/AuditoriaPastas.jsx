import { useEffect, useMemo, useRef, useState } from "react";
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

const STATUS_PASTA = {
  ok: ["Com documentos", "#2E7D32"],
  vazia_esperada: ["Vazia — esperada neste regime", "#C62828"],
  vazia_verificar: ["Vazia — confirmar se se aplica", "#E08A00"],
  vazia_ok: ["Vazia — não se aplica ao regime", "#7A8499"],
  ausente: ["Pasta ausente", "#C62828"],
  ausente_ok: ["Pasta ausente — não se aplica", "#7A8499"],
};
const OBRIGACAO = { esp: "Esperada neste regime", pos: "Depende do caso", nao: "Em regra não se aplica" };
const SIT_DOC = {
  valido: ["Válido", "#2E7D32"],
  vencido: ["Vencido", "#C62828"],
  vence_em_breve: ["Vence em breve", "#E08A00"],
  aviso: ["Atenção", "#E08A00"],
  nao_lido: ["Não conferido", "#7A8499"],
  sem_validade: ["Validade não identificada", "#E08A00"],
  sem_prazo: ["Sem prazo de validade", "#4A6FA5"],
};
const dataBr = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");

function NoPasta({ no, achados, aberto, alternar }) {
  const [rotulo, cor] = STATUS_PASTA[no.status] || ["", MUTED];
  const rel = achados.filter((a) => no.achadoIds.includes(a.id));
  const borda = no.gravidade === "critico" ? COR.critico : no.gravidade === "atencao" ? COR.atencao : no.gravidade === "info" ? COR.info : BORDER;
  const r = no.resumoDocs || {};
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderLeft: `4px solid ${borda}`, borderRadius: 10, marginBottom: 6, marginLeft: no.nivel * 22, background: WHITE, breakInside: "avoid" }}>
      <button type="button" onClick={alternar} style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "9px 12px", cursor: "pointer", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontWeight: no.nivel === 0 ? 900 : 800, fontSize: no.nivel === 0 ? 13.5 : 12.5, color: NAVY }}>{aberto ? "▾" : "▸"} {no.nome}</span>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: cor }}>{rotulo}</span>
        <span style={{ fontSize: 10.5, color: MUTED }}>{no.existe ? `${no.arquivos} arquivo(s)` : ""}</span>
        {r.vencidos > 0 && <span style={{ fontSize: 10.5, fontWeight: 900, color: COR.critico }}>{r.vencidos} vencido(s)</span>}
        {r.vencendo > 0 && <span style={{ fontSize: 10.5, fontWeight: 900, color: COR.atencao }}>{r.vencendo} vencendo</span>}
        {rel.length > 0 && <span style={{ fontSize: 10.5, fontWeight: 900, color: borda }}>{rel.length} alerta(s)</span>}
      </button>
      {aberto && (
        <div style={{ padding: "0 12px 10px", fontSize: 11.5, lineHeight: 1.55 }}>
          <div style={{ color: MUTED }}><b>O que deve ter:</b> {no.conteudoEsperado || "—"}</div>
          <div style={{ color: MUTED }}><b>Neste regime:</b> {OBRIGACAO[no.obrigacao]}{no.ultimaAlteracao ? ` · última alteração em ${dataBr(no.ultimaAlteracao)}` : ""}</div>
          {no.subpastas.length > 0 && <div style={{ marginTop: 4 }}><b>Subpastas:</b> {no.subpastas.map((x) => `${x.nome} (${x.arquivos})`).join(" · ")}</div>}
          {no.documentos?.length > 0 && (
            <div style={{ marginTop: 6, overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
                <thead><tr style={{ textAlign: "left", color: MUTED }}>{["Documento", "Tipo", "Mês", "Situação", "Detalhe"].map((h) => <th key={h} style={{ padding: "3px 6px", borderBottom: `1px solid ${BORDER}` }}>{h}</th>)}</tr></thead>
                <tbody>{no.documentos.map((d, i) => {
                  const [sr, sc] = SIT_DOC[d.situacao] || ["", MUTED];
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${BORDER}`, verticalAlign: "top" }}>
                      <td style={{ padding: "4px 6px", wordBreak: "break-all", fontWeight: 700 }}>{d.nome}</td>
                      <td style={{ padding: "4px 6px" }}>{d.tipo}</td>
                      <td style={{ padding: "4px 6px", whiteSpace: "nowrap" }}>{d.competencia ? `${d.competencia.slice(5, 7)}/${d.competencia.slice(0, 4)}` : ""}</td>
                      <td style={{ padding: "4px 6px", fontWeight: 900, color: sc, whiteSpace: "nowrap" }}>{sr}</td>
                      <td style={{ padding: "4px 6px", color: MUTED }}>{d.detalhe}{d.alertas?.map((al, j) => <div key={j} style={{ color: COR[al.severidade], fontWeight: 700 }}>⚠ {al.titulo}</div>)}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
          {no.existe && !no.documentos?.length && <div style={{ marginTop: 6, color: MUTED }}>Nenhum arquivo diretamente nesta pasta{no.subpastas.length ? " (veja as subpastas)" : ""}.</div>}
          {rel.length > 0 && <div style={{ marginTop: 6 }}><b>Alertas desta pasta:</b>{rel.map((a) => <div key={a.id} style={{ color: COR[a.severidade], fontWeight: 700 }}>• {a.titulo}</div>)}</div>}
        </div>
      )}
    </div>
  );
}

const quando = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};
const chaveAchado = (x) => `${x.categoria}|${String(x.titulo).replace(/\d+/g, "#")}`;

function Comparacao({ a, anterior, anteriorEm }) {
  if (!anterior) return <div style={{ color: MUTED, fontSize: 12 }}>Primeira auditoria deste cliente: ainda não há versão anterior para comparar.</div>;
  const antes = new Map(anterior.achados.map((x) => [chaveAchado(x), x]));
  const agora = new Map(a.achados.map((x) => [chaveAchado(x), x]));
  const novos = a.achados.filter((x) => !antes.has(chaveAchado(x)));
  const resolvidos = anterior.achados.filter((x) => !agora.has(chaveAchado(x)));
  const delta = a.saude - anterior.saude;
  return (
    <div style={{ fontSize: 12, lineHeight: 1.55 }}>
      <div style={{ color: MUTED, marginBottom: 4 }}>Comparado com a auditoria de {quando(anteriorEm)}: saúde {anterior.saude} → <b style={{ color: delta >= 0 ? "#2E7D32" : COR.critico }}>{a.saude} ({delta >= 0 ? "+" : ""}{delta})</b></div>
      {resolvidos.length > 0 && <div><b style={{ color: "#2E7D32" }}>Resolvidos ({resolvidos.length}):</b><ul style={{ margin: "2px 0 6px", paddingLeft: 18 }}>{resolvidos.slice(0, 12).map((x, i) => <li key={i}>{x.titulo}</li>)}</ul></div>}
      {novos.length > 0 && <div><b style={{ color: COR.critico }}>Novos ({novos.length}):</b><ul style={{ margin: "2px 0 6px", paddingLeft: 18 }}>{novos.slice(0, 12).map((x, i) => <li key={i}>{x.titulo}</li>)}</ul></div>}
      {!novos.length && !resolvidos.length && <div>Nenhuma mudança nos alertas desde a auditoria anterior.</div>}
    </div>
  );
}

export function Relatorio({ a, narrativa, anterior, anteriorEm, criadoEm, onIa, iaBusy, botoes }) {
  const [filtro, setFiltro] = useState("todos");
  const [abertas, setAbertas] = useState({});
  const [imprimindo, setImprimindo] = useState(false);
  const chave = (n) => a.cliente.codigo + n.nome;
  const imprimir = () => {
    setImprimindo(true);
    const fim = () => { setImprimindo(false); window.removeEventListener("afterprint", fim); };
    window.addEventListener("afterprint", fim);
    setTimeout(() => window.print(), 300);
  };
  const regimeTxt = ({ SIMPLES: "Simples Nacional", MEI: "MEI", PRESUMIDO: "Lucro Presumido", REAL: "Lucro Real", NAO_IDENTIFICADO: "não identificado" })[a.regime] || a.regime;
  return (
    <div id="relatorio-pasta">
      <style>{`@media print { body * { visibility: hidden !important; } #relatorio-pasta, #relatorio-pasta * { visibility: visible !important; } #relatorio-pasta { position: absolute; left: 0; top: 0; width: 100%; } .nao-imprimir { display: none !important; } }`}</style>
      <Cartao style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 17 }}>{a.cliente.codigo} - {a.cliente.nome}</div>
            <div style={{ color: MUTED, fontSize: 12, marginTop: 3 }}>Regime: {regimeTxt} · {a.totalArquivos} arquivo(s) · auditoria de {quando(criadoEm || a.geradoEm)}</div>
            <div style={{ marginTop: 8 }}><Selo sev="critico" n={a.resumo.critico} /><Selo sev="atencao" n={a.resumo.atencao} /><Selo sev="info" n={a.resumo.info} /></div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: a.saude >= 70 ? "#2E7D32" : a.saude >= 40 ? COR.atencao : COR.critico }}>{a.saude}</div>
            <div style={{ fontSize: 10, color: MUTED }}>saúde da pasta</div>
          </div>
        </div>
        <div className="nao-imprimir" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <Btn sec onClick={imprimir}>Imprimir / salvar PDF</Btn>
          {botoes}
        </div>
      </Cartao>

      {anterior !== undefined && (
        <Cartao style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Mudanças desde a auditoria anterior</div>
          <Comparacao a={a} anterior={anterior} anteriorEm={anteriorEm} />
        </Cartao>
      )}

      <Cartao style={{ marginBottom: 10, borderLeft: `4px solid ${CORAL}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 900 }}>Leitura da IA</div>
          {!narrativa && onIa && <span className="nao-imprimir"><Btn onClick={onIa} disabled={iaBusy}>{iaBusy ? "Analisando…" : "Pedir comentário da IA"}</Btn></span>}
        </div>
        {narrativa ? (
          <div style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 8 }}>
            <p style={{ marginTop: 0 }}>{narrativa.resumo}</p>
            {[["Prioridades", narrativa.prioridades], ["Melhorias de organização", narrativa.melhorias], ["Pontos a verificar", narrativa.oportunidades]].map(([t, l]) => l?.length ? <div key={t}><b>{t}</b><ul style={{ margin: "4px 0 8px", paddingLeft: 18 }}>{l.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null)}
          </div>
        ) : <div style={{ color: MUTED, fontSize: 11, marginTop: 6 }}>A IA recebe só os achados e os totais (sem o conteúdo dos documentos) e sugere prioridades e melhorias. O comentário fica salvo neste relatório.</div>}
      </Cartao>

      {a.meses?.length > 0 && (
        <Cartao style={{ marginBottom: 10, overflowX: "auto" }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Simples Nacional — mês a mês</div>
          <table style={{ borderCollapse: "collapse", fontSize: 11.5, width: "100%" }}>
            <thead><tr style={{ textAlign: "left", color: MUTED }}>{["Mês", "Declaração", "Recibo", "Extrato", "Guia DAS", "Receita", "Situação"].map((h) => <th key={h} style={{ padding: "4px 8px" }}>{h}</th>)}</tr></thead>
            <tbody>{a.meses.map((m) => (
              <tr key={m.mes} style={{ borderTop: `1px solid ${BORDER}` }}>
                <td style={{ padding: "5px 8px", fontWeight: 800 }}>{m.rotulo}</td>
                {[m.declaracao, m.recibo, m.extrato, m.das].map((v, i) => <td key={i} style={{ padding: "5px 8px", color: v ? "#2E7D32" : (m.semMovimento && i > 1) ? MUTED : COR.critico, fontWeight: 800 }}>{v ? "✓" : (m.semMovimento && i > 1) ? "n/a" : "✗"}</td>)}
                <td style={{ padding: "5px 8px" }}>{m.receita !== null ? brl(m.receita) : "—"}</td>
                <td style={{ padding: "5px 8px", fontWeight: 800, color: m.situacao === "ok" ? "#2E7D32" : m.situacao === "no_prazo" ? COR.atencao : COR.critico }}>{({ ok: "Completo", incompleto: `Falta ${m.faltam?.join(", ")}`, faltando: "Sem documentos", no_prazo: "Dentro do prazo, sem documentos" })[m.situacao]}</td>
              </tr>))}</tbody>
          </table>
        </Cartao>
      )}

      {a.arvore?.length > 0 && (
        <Cartao style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            <div style={{ fontWeight: 900 }}>Documentos por pasta e validade</div>
            <div className="nao-imprimir" style={{ display: "flex", gap: 6 }}>
              <Btn sec onClick={() => setAbertas(Object.fromEntries(a.arvore.map((n) => [chave(n), true])))}>Abrir todas</Btn>
              <Btn sec onClick={() => setAbertas({})}>Fechar todas</Btn>
            </div>
          </div>
          {a.arvore.map((n) => <NoPasta key={chave(n)} no={n} achados={a.achados} aberto={imprimindo || !!abertas[chave(n)]} alternar={() => setAbertas((x) => ({ ...x, [chave(n)]: !x[chave(n)] }))} />)}
        </Cartao>
      )}

      <Cartao>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 900 }}>Alertas e pendências ({a.achados.length})</div>
          <select className="nao-imprimir" value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ padding: 5, borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 11 }}>
            <option value="todos">Todos</option><option value="critico">Só críticos</option><option value="atencao">Só atenção</option><option value="info">Só informativos</option>
          </select>
        </div>
        {a.achados.filter((x) => imprimindo || filtro === "todos" || x.severidade === filtro).map((x) => (
          <div key={x.id} style={{ borderLeft: `4px solid ${COR[x.severidade]}`, background: "#FAFBFD", borderRadius: 8, padding: "8px 10px", marginBottom: 7, breakInside: "avoid" }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: COR[x.severidade], letterSpacing: 0.6 }}>{ROTULO[x.severidade].toUpperCase()} · {x.categoria.toUpperCase()}</div>
            <div style={{ fontWeight: 800, fontSize: 12.5, margin: "2px 0" }}>{x.titulo}</div>
            <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>{x.detalhe}</div>
            {x.sugestao && <div style={{ fontSize: 11.5, marginTop: 3 }}><b>O que fazer:</b> {x.sugestao}</div>}
          </div>))}
        {!a.achados.length && <div style={{ color: "#2E7D32", fontWeight: 800 }}>Nenhuma pendência encontrada.</div>}
      </Cartao>
    </div>
  );
}

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
  const [idsSalvos, setIdsSalvos] = useState({});
  const [ia, setIa] = useState(false);
  const [salvo, setSalvo] = useState("");
  const [driveLista, setDriveLista] = useState(null);
  const [driveUm, setDriveUm] = useState("todos");
  const [historico, setHistorico] = useState(null);
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState("pior");
  const [cli, setCli] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const inputPasta = useRef(null);
  const inputZip = useRef(null);

  async function api(action, body, method = "POST", query = {}) {
    const p = new URLSearchParams({ action, ...query });
    const r = await fetch(`/api/tributario?${p}`, { method, headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: method === "GET" ? undefined : JSON.stringify(body) });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d?.sucesso) throw new Error(d?.error || "Erro na auditoria.");
    return d;
  }

  async function carregarHistorico() {
    try { const d = await api("pasta-listar", null, "GET"); setHistorico(d.clientes || []); }
    catch (e) { setHistorico([]); setErro(e.message); }
  }
  useEffect(() => { carregarHistorico(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Salva cada auditoria como uma nova versão; nada do que já existe é apagado.
  async function salvarVersoes(lista, origem) {
    try {
      const d = await api("pasta-salvar", { origem, auditorias: lista.map((a) => ({ auditoria: a })) });
      const mapa = {};
      (d.ids || []).forEach((x) => { mapa[x.codigo] = x.id; });
      setIdsSalvos((m) => ({ ...m, ...mapa }));
      setSalvo(`${d.salvos} auditoria(s) salva(s) no histórico.`);
      return mapa;
    } catch (e) { setSalvo(""); setErro("A auditoria foi feita, mas não consegui salvar no histórico: " + e.message); return {}; }
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
          } catch (er) { fatos[e.caminho] = { nome, legivel: false, erro: String(er?.message || er).slice(0, 120) }; }
        }
        resultado.push(auditarCliente({ cliente: c, regime, fatos, inicioObrigacoes: inicio, hoje: new Date() }));
      }
      if (pdfsLidos >= LIMITE_PDFS) avisos.push(`Para manter a análise rápida, li o texto de até ${LIMITE_PDFS} PDFs; os demais foram avaliados só pelo nome e pela pasta.`);
      resultado.sort((a, b) => a.saude - b.saude);
      setAviso(avisos); setAuditorias(resultado); setFase("resultado");
      if (resultado.length === 1) setSel(resultado[0].cliente.codigo);
      await salvarVersoes(resultado, "upload");
      carregarHistorico();
    } catch (e) { setErro(e.message || "Não consegui ler os arquivos."); setFase("envio"); }
  }

  async function carregarDrive() {
    setErro("");
    try { const d = await api("pasta-drive-clientes", null, "GET"); setDriveLista(d); }
    catch (e) { setErro(e.message); }
  }
  async function auditarUmDrive(c) {
    const d = await api("pasta-drive-auditar", { pastaId: c.id, codigo: c.codigo, nome: c.nome, raiz: c.raiz, regime, inicio });
    return d;
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
          const d = await auditarUmDrive(c);
          resultado.push(d.auditoria);
          if (d.parcial) avisos.push(`${c.codigo} - ${c.nome}: li ${d.documentosLidos} de ${d.documentosCandidatos} documentos (limite de tempo). Rode de novo só para este cliente para completar.`);
        } catch (e) { avisos.push(`${c.codigo} - ${c.nome}: não consegui ler (${e.message}).`); }
      }
      if (!resultado.length) throw new Error("Nenhum cliente pôde ser auditado. " + (avisos[0] || ""));
      resultado.sort((a, b) => a.saude - b.saude);
      setAviso(avisos); setAuditorias(resultado); setFase("resultado");
      if (resultado.length === 1) setSel(resultado[0].cliente.codigo);
      await salvarVersoes(resultado, "drive");
      carregarHistorico();
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
    processar(arquivos.map((f) => ({ caminho: f.webkitRelativePath || f.name, tipo: "arquivo", tamanho: f.size, modificadoEm: f.lastModified, _file: f })));
  }
  async function aoEscolherZip(ev) {
    const f = ev.target.files?.[0];
    if (!f) return;
    try { processar(await entradasDeZip(f)); } catch (e) { setErro("Não consegui abrir o ZIP: " + e.message); }
  }

  // ---- Histórico de um cliente -----------------------------------------
  async function abrirCliente(codigo, idEspecifico) {
    setErro(""); setOcupado(true);
    try {
      const h = await api("pasta-obter", null, "GET", { codigo });
      if (!h.historico?.length) throw new Error("Este cliente ainda não tem auditorias salvas.");
      const id = idEspecifico || h.historico[0].id;
      const r = await api("pasta-relatorio", null, "GET", { id });
      setCli({ codigo, historico: h.historico, id: r.relatorio.id, atual: r.relatorio.resultado, narrativa: r.relatorio.narrativa, criadoEm: r.relatorio.created_at, anterior: r.anterior?.resultado || null, anteriorEm: r.anterior?.created_at || null });
      setFase("cliente");
    } catch (e) { setErro(e.message); }
    setOcupado(false);
  }
  async function atualizarCliente() {
    const a = cli.atual;
    if (!a.cliente.driveId) { setErro("Esta auditoria veio de um envio manual. Para atualizar direto do Drive, rode o cliente pela opção “Direto do Google Drive”."); return; }
    setErro(""); setOcupado(true);
    try {
      const d = await auditarUmDrive({ id: a.cliente.driveId, codigo: a.cliente.codigo, nome: a.cliente.nome, raiz: a.cliente.raiz });
      const m = await salvarVersoes([d.auditoria], "drive");
      if (d.parcial) setErro(`Li ${d.documentosLidos} de ${d.documentosCandidatos} documentos (limite de tempo). Atualize de novo para completar.`);
      await abrirCliente(a.cliente.codigo, m[a.cliente.codigo]);
      carregarHistorico();
    } catch (e) { setErro(e.message); }
    setOcupado(false);
  }
  async function pedirIaCliente() {
    setIa(true);
    try {
      const d = await api("pasta-narrativa", { auditoria: cli.atual, id: cli.id });
      setCli((c) => ({ ...c, narrativa: d.narrativa }));
    } catch (e) { setErro(e.message); }
    setIa(false);
  }
  async function pedirIaResultado(a) {
    setIa(true);
    try {
      const d = await api("pasta-narrativa", { auditoria: a, id: idsSalvos[a.cliente.codigo] });
      setNarrativas((n) => ({ ...n, [a.cliente.codigo]: d.narrativa }));
    } catch (e) { setErro(e.message); }
    setIa(false);
  }

  function baixarCsv() {
    const linhas = [["Cliente", "Código", "Regime", "Gravidade", "Categoria", "Achado", "Detalhe", "Sugestão"]];
    for (const a of auditorias) for (const x of a.achados) linhas.push([a.cliente.nome, a.cliente.codigo, a.regime, ROTULO[x.severidade], x.categoria, x.titulo, x.detalhe, x.sugestao || ""]);
    const csv = linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const el = document.createElement("a"); el.href = url; el.download = "auditoria-de-pastas.csv"; el.click(); URL.revokeObjectURL(url);
  }

  const atual = useMemo(() => auditorias.find((a) => a.cliente.codigo === sel) || null, [auditorias, sel]);

  const cabecalho = (
    <div style={{ background: "linear-gradient(135deg,#0E1A33,#17233D)", color: WHITE, borderRadius: 22, padding: 22, marginBottom: 14 }} className="nao-imprimir">
      <div style={{ color: "#FFB7A7", fontSize: 9, fontWeight: 900, letterSpacing: 1.3 }}>FINDER TAX INTELLIGENCE</div>
      <h2 style={{ margin: "6px 0", fontSize: 26 }}>Auditoria de pastas de clientes</h2>
      <p style={{ margin: 0, color: "#D8DEEA", fontSize: 12, maxWidth: 760, lineHeight: 1.55 }}>Confere cada pasta padrão e subpasta: o que há em cada uma, se os documentos estão válidos, o que falta e o que está no lugar errado. Cada auditoria fica salva no histórico.</p>
    </div>
  );

  // ---------------- Tela: relatório salvo de um cliente ----------------
  if (fase === "cliente" && cli) {
    return (
      <div>
        {cabecalho}
        <div className="nao-imprimir" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
          <Btn sec onClick={() => { setFase("envio"); setCli(null); carregarHistorico(); }}>← Histórico</Btn>
          <Btn onClick={atualizarCliente} disabled={ocupado}>{ocupado ? "Atualizando…" : "Atualizar agora pelo Drive"}</Btn>
          <label style={{ fontSize: 12, color: MUTED }}>Versão:{" "}
            <select value={cli.id} onChange={(e) => abrirCliente(cli.codigo, Number(e.target.value))} disabled={ocupado} style={{ padding: 6, borderRadius: 8, border: `1px solid ${BORDER}` }}>
              {cli.historico.map((h, i) => <option key={h.id} value={h.id}>{quando(h.created_at)} — saúde {h.saude}{i === 0 ? " (mais recente)" : ""}</option>)}
            </select>
          </label>
        </div>
        {erro && <div style={{ marginBottom: 10, color: COR.critico, fontSize: 12, fontWeight: 700 }}>{erro}</div>}
        <Relatorio a={cli.atual} narrativa={cli.narrativa} anterior={cli.anterior} anteriorEm={cli.anteriorEm} criadoEm={cli.criadoEm} onIa={pedirIaCliente} iaBusy={ia} />
      </div>
    );
  }

  // ---------------- Tela: envio + histórico ----------------
  if (fase === "envio" || fase === "lendo") {
    const lista = (historico || [])
      .filter((h) => !busca || `${h.cliente_codigo} ${h.cliente_nome}`.toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => ordem === "codigo" ? Number(a.cliente_codigo) - Number(b.cliente_codigo) : ordem === "recente" ? new Date(b.created_at) - new Date(a.created_at) : (b.criticos - a.criticos) || (a.saude - b.saude));
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
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 14, fontSize: 12 }}>
            <label>Regime do cliente<br />
              <select value={regime} onChange={(e) => setRegime(e.target.value)} style={{ padding: 7, borderRadius: 8, border: `1px solid ${BORDER}` }}>
                <option value="AUTO">Detectar pelos documentos</option><option value="SIMPLES">Simples Nacional</option><option value="MEI">MEI</option><option value="PRESUMIDO">Lucro Presumido</option><option value="REAL">Lucro Real</option>
              </select></label>
            <label>Início das obrigações (opcional)<br />
              <input type="month" value={inicio} onChange={(e) => setInicio(e.target.value)} style={{ padding: 6, borderRadius: 8, border: `1px solid ${BORDER}` }} /></label>
          </div>
        </Cartao>

        {fase === "lendo" && (
          <Cartao style={{ marginTop: 12, textAlign: "center" }}>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Lendo e conferindo os documentos…</div>
            <div style={{ color: MUTED, fontSize: 12, marginTop: 6 }}>{progresso}</div>
            <div style={{ color: MUTED, fontSize: 11, marginTop: 6 }}>Mantenha esta aba aberta até terminar.</div>
          </Cartao>
        )}

        <Cartao style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 6 }}>Ou envie manualmente</div>
          <div onDragOver={(e) => e.preventDefault()} onDrop={aoSoltar} style={{ border: `2px dashed ${BORDER}`, borderRadius: 14, padding: 24, textAlign: "center", background: "#FAFBFD" }}>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Arraste aqui a pasta do cliente (ou a pasta com todos os clientes)</div>
            <div style={{ color: MUTED, fontSize: 12, margin: "6px 0 12px" }}>Também aceita um arquivo .zip. Padrão esperado: “232 - NOME DO CLIENTE”. A leitura é feita no seu navegador.</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <Btn onClick={() => inputPasta.current?.click()} disabled={fase === "lendo"}>Escolher pasta</Btn>
              <Btn sec onClick={() => inputZip.current?.click()} disabled={fase === "lendo"}>Escolher .zip</Btn>
            </div>
            <input ref={inputPasta} type="file" webkitdirectory="" directory="" multiple onChange={aoEscolherPasta} style={{ display: "none" }} />
            <input ref={inputZip} type="file" accept=".zip" onChange={aoEscolherZip} style={{ display: "none" }} />
          </div>
        </Cartao>

        <Cartao style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>Histórico de auditorias {historico ? `(${historico.length} cliente(s))` : ""}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <input placeholder="Buscar cliente ou código" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ padding: 7, borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 12 }} />
              <select value={ordem} onChange={(e) => setOrdem(e.target.value)} style={{ padding: 7, borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 12 }}>
                <option value="pior">Pior situação primeiro</option><option value="codigo">Por código</option><option value="recente">Mais recentes</option>
              </select>
            </div>
          </div>
          {historico === null && <div style={{ color: MUTED, fontSize: 12 }}>Carregando…</div>}
          {historico && !historico.length && <div style={{ color: MUTED, fontSize: 12 }}>Nenhuma auditoria salva ainda. Rode uma auditoria acima e ela aparece aqui.</div>}
          {lista.map((h) => (
            <button key={h.cliente_codigo} type="button" onClick={() => abrirCliente(h.cliente_codigo)} disabled={ocupado} style={{ width: "100%", textAlign: "left", background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 10px", marginBottom: 6, cursor: "pointer", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, fontSize: 12.5, minWidth: 220 }}>{h.cliente_codigo} - {h.cliente_nome}</span>
              <span>{h.criticos > 0 && <Selo sev="critico" n={h.criticos} />}{h.atencoes > 0 && <Selo sev="atencao" n={h.atencoes} />}</span>
              <span style={{ fontSize: 11, color: MUTED }}>saúde {h.saude} · {quando(h.created_at)} · {h.origem === "drive" ? "Drive" : "envio manual"}</span>
            </button>
          ))}
        </Cartao>
      </div>
    );
  }

  // ---------------- Tela: resultado da execução ----------------
  const totais = auditorias.reduce((t, a) => ({ c: t.c + a.resumo.critico, a: t.a + a.resumo.atencao, i: t.i + a.resumo.info }), { c: 0, a: 0, i: 0 });
  return (
    <div>
      {cabecalho}
      <div className="nao-imprimir" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        <Btn sec onClick={() => { setFase("envio"); setAuditorias([]); setSel(null); carregarHistorico(); }}>← Histórico e nova auditoria</Btn>
        <Btn sec onClick={baixarCsv}>Baixar CSV dos alertas</Btn>
        {salvo && <span style={{ color: "#2E7D32", fontSize: 12, fontWeight: 700 }}>{salvo}</span>}
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
          {atual && <Relatorio key={atual.cliente.codigo} a={atual} narrativa={narrativas[atual.cliente.codigo]} criadoEm={atual.geradoEm} onIa={() => pedirIaResultado(atual)} iaBusy={ia} botoes={<Btn sec onClick={() => abrirCliente(atual.cliente.codigo)}>Ver histórico e comparar com a versão anterior</Btn>} />}
        </div>
      </div>
    </div>
  );
}
