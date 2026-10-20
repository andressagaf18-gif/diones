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

const hojeIso = () => new Date().toISOString().slice(0, 10);
const diasAte = (iso) => Math.floor((new Date(`${String(iso).slice(0, 10)}T00:00:00Z`) - new Date(`${hojeIso()}T00:00:00Z`)) / 86400000);
const FALTA_CAT = (x) => x.falta || /localizad|ausente|vazia|incompleta|sem /i.test(x.titulo || "");

function Kpi({ rotulo, valor, cor, sub, onClick, ativo }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} style={{ textAlign: "left", background: WHITE, border: `1px solid ${ativo ? CORAL : BORDER}`, borderTop: `4px solid ${cor || BORDER}`, borderRadius: 12, padding: "10px 12px", cursor: onClick ? "pointer" : "default", minWidth: 140, flex: "1 1 140px" }}>
      <div style={{ fontSize: 24, fontWeight: 900, color: cor || NAVY, lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: NAVY, marginTop: 2 }}>{rotulo}</div>
      {sub && <div style={{ fontSize: 10.5, color: MUTED, marginTop: 1 }}>{sub}</div>}
    </button>
  );
}

function Abas({ itens, valor, onChange, sticky }) {
  return (
    <div className="nao-imprimir" style={{ display: "flex", gap: 4, flexWrap: "wrap", borderBottom: `1px solid ${BORDER}`, marginBottom: 14, ...(sticky ? { position: "sticky", top: 0, background: "#F7F8FB", zIndex: 5, paddingTop: 6 } : {}) }}>
      {itens.map(([k, rotulo, n]) => (
        <button key={k} type="button" onClick={() => onChange(k)} style={{ background: valor === k ? WHITE : "transparent", border: `1px solid ${valor === k ? BORDER : "transparent"}`, borderBottom: valor === k ? `3px solid ${CORAL}` : "3px solid transparent", borderRadius: "10px 10px 0 0", padding: "9px 16px", fontWeight: 900, fontSize: 13, color: valor === k ? NAVY : MUTED, cursor: "pointer" }}>
          {rotulo}{n !== undefined && n !== null ? <span style={{ marginLeft: 6, background: valor === k ? CORAL : "#DDE2EC", color: valor === k ? WHITE : NAVY, borderRadius: 999, padding: "1px 7px", fontSize: 10.5 }}>{n}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Relatorio({ a, narrativa, anterior, anteriorEm, criadoEm, onIa, iaBusy, botoes }) {
  const [filtro, setFiltro] = useState("todos");
  const [secao, setSecao] = useState("resumo");
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
  const mostra = (k) => imprimindo || secao === k;
  const prioridades = a.achados.filter((x) => x.severidade !== "info").slice(0, 6);
  const docsTotais = (a.arvore || []).reduce((t, n) => ({ v: t.v + (n.resumoDocs?.vencidos || 0), b: t.b + (n.resumoDocs?.vencendo || 0), n: t.n + (n.resumoDocs?.naoLidos || 0) }), { v: 0, b: 0, n: 0 });
  const corSaude = a.saude >= 70 ? "#2E7D32" : a.saude >= 40 ? COR.atencao : COR.critico;
  return (
    <div id="relatorio-pasta">
      <style>{`@media print { body * { visibility: hidden !important; } #relatorio-pasta, #relatorio-pasta * { visibility: visible !important; } #relatorio-pasta { position: absolute; left: 0; top: 0; width: 100%; } .nao-imprimir { display: none !important; } }`}</style>
      <Cartao style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 19 }}>{a.cliente.codigo} - {a.cliente.nome}</div>
            <div style={{ color: MUTED, fontSize: 12, marginTop: 3 }}>{regimeTxt} · {a.totalArquivos} arquivo(s) · auditoria de {quando(criadoEm || a.geradoEm)}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 120 }}><div style={{ height: 8, background: "#E8ECF3", borderRadius: 999 }}><div style={{ height: 8, width: `${a.saude}%`, background: corSaude, borderRadius: 999 }} /></div><div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>saúde da pasta</div></div>
            <div style={{ fontSize: 32, fontWeight: 900, color: corSaude }}>{a.saude}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <Kpi rotulo="Críticos" valor={a.resumo.critico} cor={COR.critico} />
          <Kpi rotulo="Atenção" valor={a.resumo.atencao} cor={COR.atencao} />
          <Kpi rotulo="Informativos" valor={a.resumo.info} cor={COR.info} />
          <Kpi rotulo="Documentos vencidos" valor={docsTotais.v} cor={docsTotais.v ? COR.critico : "#2E7D32"} sub={docsTotais.b ? `${docsTotais.b} vencendo` : ""} />
          <Kpi rotulo="Não conferidos" valor={docsTotais.n} cor="#7A8499" sub="PDF sem texto/leitura" />
        </div>
        <div className="nao-imprimir" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <Btn sec onClick={imprimir}>Imprimir / salvar PDF</Btn>
          {botoes}
        </div>
      </Cartao>

      <Abas valor={secao} onChange={setSecao} itens={[["resumo", "Resumo"], ["docs", "Documentos por pasta"], ...(a.meses?.length ? [["simples", "Simples mês a mês"]] : []), ...(a.cobertura?.linhas?.length ? [["cobertura", "Cobertura mensal", a.cobertura.linhas.filter((l) => l.faltando.length).length || null]] : []), ["alertas", "Todos os alertas", a.achados.length]]} />

      {mostra("resumo") && (
        <div>
          <Cartao style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Prioridades</div>
            {prioridades.length === 0 && <div style={{ color: "#2E7D32", fontWeight: 800 }}>Nenhuma pendência crítica ou de atenção.</div>}
            {prioridades.map((x) => (
              <div key={x.id} style={{ borderLeft: `4px solid ${COR[x.severidade]}`, background: "#FAFBFD", borderRadius: 8, padding: "7px 10px", marginBottom: 6, breakInside: "avoid" }}>
                <div style={{ fontWeight: 800, fontSize: 12.5 }}>{x.titulo}</div>
                {x.sugestao && <div style={{ fontSize: 11.5, color: MUTED }}>→ {x.sugestao}</div>}
              </div>))}
            {a.achados.filter((x) => x.severidade !== "info").length > prioridades.length && <div className="nao-imprimir" style={{ fontSize: 11.5 }}><button type="button" onClick={() => setSecao("alertas")} style={{ background: "none", border: "none", color: CORAL, fontWeight: 800, cursor: "pointer", padding: 0 }}>Ver todos os alertas →</button></div>}
          </Cartao>
          {anterior !== undefined && (
            <Cartao style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Mudanças desde a auditoria anterior</div>
              <Comparacao a={a} anterior={anterior} anteriorEm={anteriorEm} />
            </Cartao>
          )}
          <Cartao style={{ marginBottom: 12, borderLeft: `4px solid ${CORAL}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 900 }}>Leitura da IA</div>
              {!narrativa && onIa && <span className="nao-imprimir"><Btn onClick={onIa} disabled={iaBusy}>{iaBusy ? "Analisando…" : "Pedir comentário da IA"}</Btn></span>}
            </div>
            {narrativa ? (
              <div style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 8 }}>
                <p style={{ marginTop: 0 }}>{narrativa.resumo}</p>
                {[["Prioridades", narrativa.prioridades], ["Melhorias de organização", narrativa.melhorias], ["Pontos a verificar", narrativa.oportunidades]].map(([t, l]) => l?.length ? <div key={t}><b>{t}</b><ul style={{ margin: "4px 0 8px", paddingLeft: 18 }}>{l.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null)}
              </div>
            ) : <div style={{ color: MUTED, fontSize: 11, marginTop: 6 }}>A IA recebe só os achados e os totais (sem o conteúdo dos documentos). O comentário fica salvo neste relatório.</div>}
          </Cartao>
        </div>
      )}

      {mostra("docs") && a.arvore?.length > 0 && (
        <Cartao style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            <div style={{ fontWeight: 900 }}>O que há em cada pasta e se está válido</div>
            <div className="nao-imprimir" style={{ display: "flex", gap: 6 }}>
              <Btn sec onClick={() => setAbertas(Object.fromEntries(a.arvore.map((n) => [chave(n), true])))}>Abrir todas</Btn>
              <Btn sec onClick={() => setAbertas({})}>Fechar todas</Btn>
            </div>
          </div>
          {a.arvore.map((n) => <NoPasta key={chave(n)} no={n} achados={a.achados} aberto={imprimindo || !!abertas[chave(n)]} alternar={() => setAbertas((x) => ({ ...x, [chave(n)]: !x[chave(n)] }))} />)}
        </Cartao>
      )}

      {mostra("simples") && a.meses?.length > 0 && (
        <Cartao style={{ marginBottom: 12, overflowX: "auto" }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Simples Nacional — mês a mês</div>
          {(() => {
            const ok = a.meses.filter((m) => m.declaracao || m.recibo);
            const sem = ok.filter((m) => m.semMovimento).map((m) => m.rotulo);
            const com = ok.filter((m) => !m.semMovimento).map((m) => m.rotulo);
            const falta = a.meses.filter((m) => !(m.declaracao || m.recibo) && m.situacao !== "no_prazo").map((m) => m.rotulo);
            return (<div style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 8 }}>
              <div><b>Entregues sem movimento ({sem.length}):</b> {sem.join(", ") || "nenhum"}</div>
              <div><b>Entregues com movimento ({com.length}):</b> {com.join(", ") || "nenhum"}</div>
              {falta.length > 0 && <div style={{ color: COR.critico }}><b>Sem declaração/recibo ({falta.length}):</b> {falta.join(", ")}</div>}
            </div>);
          })()}
          <table style={{ borderCollapse: "collapse", fontSize: 11.5, width: "100%" }}>
            <thead><tr style={{ textAlign: "left", color: MUTED }}>{["Mês", "Declaração", "Recibo", "Extrato", "Guia DAS", "Receita", "Situação"].map((h) => <th key={h} style={{ padding: "4px 8px" }}>{h}</th>)}</tr></thead>
            <tbody>{a.meses.map((m) => (
              <tr key={m.mes} style={{ borderTop: `1px solid ${BORDER}` }}>
                <td style={{ padding: "5px 8px", fontWeight: 800 }}>{m.rotulo}</td>
                {[m.declaracao, m.recibo, m.extrato, m.das].map((v, i) => <td key={i} style={{ padding: "5px 8px", color: v ? "#2E7D32" : (m.semMovimento && i > 1) ? MUTED : COR.critico, fontWeight: 800 }}>{v ? "✓" : (m.semMovimento && i > 1) ? "n/a" : "✗"}</td>)}
                <td style={{ padding: "5px 8px" }}>{m.receita !== null ? brl(m.receita) : "—"}</td>
                <td style={{ padding: "5px 8px", fontWeight: 800, color: m.situacao === "ok" ? "#2E7D32" : m.situacao === "no_prazo" ? COR.atencao : COR.critico }}>{m.semMovimento && m.situacao === "ok" ? "Sem movimento — entregue" : ({ ok: "Completo", incompleto: `Falta ${m.faltam?.join(", ")}`, faltando: "Sem documentos", no_prazo: "Dentro do prazo, sem documentos" })[m.situacao]}{(m.entregaEm || m.reciboNumero) && <div style={{ fontWeight: 400, fontSize: 10, color: MUTED, whiteSpace: "nowrap" }}>{m.entregaEm ? `Transmitida em ${m.entregaEm.split("-").reverse().join("/")}` : "Transmitida"}{m.reciboNumero ? ` · recibo ${m.reciboNumero}` : ""}</div>}</td>
              </tr>))}</tbody>
          </table>
        </Cartao>
      )}

      {mostra("cobertura") && a.cobertura?.linhas?.length > 0 && (
        <Cartao style={{ marginBottom: 12, overflowX: "auto" }}>
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Cobertura mensal dos documentos</div>
          <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 8 }}>Regra: se um tipo de documento apareceu em algum mês, ele deve existir nos meses seguintes. ✓ = existe · ✗ = falta · vazio = antes do primeiro registro.</div>
          <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
            <thead><tr style={{ textAlign: "left", color: MUTED }}><th style={{ padding: "3px 6px" }}>Pasta · documento</th>{a.cobertura.meses.map((m) => <th key={m} style={{ padding: "3px 4px", textAlign: "center", whiteSpace: "nowrap" }}>{m.slice(5)}/{m.slice(2, 4)}</th>)}</tr></thead>
            <tbody>{a.cobertura.linhas.map((l, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${BORDER}` }}>
                <td style={{ padding: "4px 6px", minWidth: 220 }}><b>{l.tipo}</b><div style={{ fontSize: 10, color: MUTED }}>{l.grupo.split(" / ").slice(-1)[0]}</div></td>
                {a.cobertura.meses.map((m) => {
                  const tem = l.presentes[m]; const dentro = m >= l.ini && m <= l.fim;
                  return <td key={m} style={{ textAlign: "center", padding: "3px 4px", fontWeight: 900, color: tem ? "#2E7D32" : dentro ? COR.critico : "#C8CEDA", background: !tem && dentro ? "#FDECEC" : "transparent" }}>{tem ? "✓" : dentro ? "✗" : ""}</td>;
                })}
              </tr>))}</tbody>
          </table>
        </Cartao>
      )}

      {mostra("alertas") && (
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
      )}
    </div>
  );
}

const situacaoCliente = (c) => (c.resumo.critico > 0 ? "critico" : c.resumo.atencao > 0 ? "atencao" : "ok");
const ROTULO_SIT = { critico: ["Crítico", COR.critico], atencao: ["Com pendência", COR.atencao], ok: ["Em dia", "#2E7D32"] };
const diasDesde = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

export default function AuditoriaPastas({ token, onVoltar }) {
  const [aba, setAba] = useState("auditar");
  const [lendo, setLendo] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState([]);
  const [regime, setRegime] = useState("AUTO");
  const [inicio, setInicio] = useState("");
  const [salvo, setSalvo] = useState("");
  const [driveLista, setDriveLista] = useState(null);
  const [driveUm, setDriveUm] = useState("todos");
  const [painel, setPainel] = useState(null);
  const [cli, setCli] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [ia, setIa] = useState(false);
  // filtros
  const [fSit, setFSit] = useState("todos");
  const [fCat, setFCat] = useState("");
  const [busca, setBusca] = useState("");
  const [fVencCat, setFVencCat] = useState("todas");
  const [fVencFaixa, setFVencFaixa] = useState("90");
  const [fVencBusca, setFVencBusca] = useState("");
  const inputPasta = useRef(null);
  const inputZip = useRef(null);

  async function api(action, body, method = "POST", query = {}) {
    const p = new URLSearchParams({ action, ...query });
    const r = await fetch(`/api/tributario?${p}`, { method, headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: method === "GET" ? undefined : JSON.stringify(body) });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d?.sucesso) throw new Error(d?.error || "Erro na auditoria.");
    return d;
  }

  async function carregarPainel() {
    try { const d = await api("pasta-painel", null, "GET"); setPainel(d.clientes || []); }
    catch (e) { setPainel([]); setErro(e.message); }
  }
  useEffect(() => { carregarPainel(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvarVersoes(lista, origem) {
    try {
      const d = await api("pasta-salvar", { origem, auditorias: lista.map((a) => ({ auditoria: a })) });
      const mapa = {};
      (d.ids || []).forEach((x) => { mapa[x.codigo] = x.id; });
      setSalvo(`${d.salvos} auditoria(s) salva(s) no histórico.`);
      return mapa;
    } catch (e) { setSalvo(""); setErro("A auditoria foi feita, mas não consegui salvar no histórico: " + e.message); return {}; }
  }
  async function aposAuditoria(resultado, origem, avisos) {
    setAviso(avisos);
    await salvarVersoes(resultado, origem);
    await carregarPainel();
    setLendo(false);
    setAba("geral");
  }

  async function processar(entradas) {
    setErro(""); setSalvo(""); setLendo(true);
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
        resultado.push(auditarCliente({ cliente: c, regime, fatos, inicioObrigacoes: inicio, hoje: new Date(), outrosClientes: listaOutros(clientes) }));
      }
      if (pdfsLidos >= LIMITE_PDFS) avisos.push(`Para manter a análise rápida, li o texto de até ${LIMITE_PDFS} PDFs; os demais foram avaliados só pelo nome e pela pasta.`);
      await aposAuditoria(resultado, "upload", avisos);
    } catch (e) { setErro(e.message || "Não consegui ler os arquivos."); setLendo(false); }
  }

  async function carregarDrive() {
    setErro("");
    try { const d = await api("pasta-drive-clientes", null, "GET"); setDriveLista(d); }
    catch (e) { setErro(e.message); }
  }
  const listaOutros = (extra = []) => {
    const m = new Map();
    (driveLista?.clientes || []).forEach((c) => m.set(String(c.codigo), { codigo: c.codigo, nome: c.nome, cnpj: "" }));
    extra.forEach((c) => m.set(String(c.codigo), { ...m.get(String(c.codigo)), codigo: c.codigo, nome: c.nome, cnpj: m.get(String(c.codigo))?.cnpj || "" }));
    (painel || []).forEach((c) => m.set(String(c.codigo), { codigo: c.codigo, nome: c.nome, cnpj: c.cnpj || m.get(String(c.codigo))?.cnpj || "" }));
    return [...m.values()];
  };
  const auditarUmDrive = (c) => api("pasta-drive-auditar", { pastaId: c.id, codigo: c.codigo, nome: c.nome, raiz: c.raiz, regime, inicio, outros: listaOutros() });
  async function auditarDrive() {
    setErro(""); setSalvo(""); setLendo(true);
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
      await aposAuditoria(resultado, "drive", avisos);
    } catch (e) { setErro(e.message); setLendo(false); }
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

  // ---- Cliente / histórico ----
  async function abrirCliente(codigo, idEspecifico) {
    setErro(""); setOcupado(true); setAba("cliente");
    try {
      const h = await api("pasta-obter", null, "GET", { codigo });
      if (!h.historico?.length) throw new Error("Este cliente ainda não tem auditorias salvas.");
      const id = idEspecifico || h.historico[0].id;
      const r = await api("pasta-relatorio", null, "GET", { id });
      setCli({ codigo, historico: h.historico, id: r.relatorio.id, atual: r.relatorio.resultado, narrativa: r.relatorio.narrativa, criadoEm: r.relatorio.created_at, anterior: r.anterior?.resultado || null, anteriorEm: r.anterior?.created_at || null });
    } catch (e) { setErro(e.message); }
    setOcupado(false);
  }
  async function atualizarCliente() {
    const a = cli.atual;
    if (!a.cliente.driveId) { setErro("Esta auditoria veio de um envio manual. Para atualizar direto do Drive, rode o cliente na aba Auditar, pela opção “Direto do Google Drive”."); return; }
    setErro(""); setOcupado(true);
    try {
      const d = await auditarUmDrive({ id: a.cliente.driveId, codigo: a.cliente.codigo, nome: a.cliente.nome, raiz: a.cliente.raiz });
      const m = await salvarVersoes([d.auditoria], "drive");
      if (d.parcial) setErro(`Li ${d.documentosLidos} de ${d.documentosCandidatos} documentos (limite de tempo). Atualize de novo para completar.`);
      await abrirCliente(a.cliente.codigo, m[a.cliente.codigo]);
      carregarPainel();
    } catch (e) { setErro(e.message); }
    setOcupado(false);
  }
  async function pedirIaCliente() {
    setIa(true);
    try { const d = await api("pasta-narrativa", { auditoria: cli.atual, id: cli.id }); setCli((c) => ({ ...c, narrativa: d.narrativa })); }
    catch (e) { setErro(e.message); }
    setIa(false);
  }

  const cabecalho = (
    <div className="nao-imprimir" style={{ background: "linear-gradient(135deg,#0E1A33,#17233D)", color: WHITE, borderRadius: 22, padding: "18px 22px", marginBottom: 14, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      <div>
        <div style={{ color: "#FFB7A7", fontSize: 9, fontWeight: 900, letterSpacing: 1.3 }}>FINDER TAX INTELLIGENCE</div>
        <h2 style={{ margin: "4px 0 2px", fontSize: 24 }}>Auditoria de pastas de clientes</h2>
        <div style={{ color: "#D8DEEA", fontSize: 12 }}>Cada pasta padrão conferida: documentos, validade, pendências e histórico.</div>
      </div>
      <Btn sec onClick={onVoltar}>← Voltar</Btn>
    </div>
  );

  const lista = painel || [];
  const comSit = lista.map((c) => ({ ...c, sit: situacaoCliente(c), dias: diasDesde(c.auditadoEm) }));
  const kp = {
    total: comSit.length,
    ok: comSit.filter((c) => c.sit === "ok").length,
    pend: comSit.filter((c) => c.sit !== "ok").length,
    crit: comSit.filter((c) => c.sit === "critico").length,
    velhos: comSit.filter((c) => c.dias > 30).length,
    alertas: comSit.reduce((t, c) => t + c.resumo.critico + c.resumo.atencao, 0),
  };

  const abas = [["auditar", "1 · Auditar"], ["geral", "2 · Visão geral", kp.total || null], ["cliente", "3 · Cliente"], ["vencimentos", "4 · Vencimentos"]];

  // ------------------------- ABA 1: AUDITAR -------------------------
  const abaAuditar = (
    <div>
      <Cartao>
        <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 6 }}>Direto do Google Drive</div>
        {!driveLista ? (
          <div><div style={{ color: MUTED, fontSize: 12, marginBottom: 8 }}>Lê a pasta compartilhada com o sistema, sem você anexar nada.</div><Btn onClick={carregarDrive}>Conectar ao Drive</Btn></div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={driveUm} onChange={(e) => setDriveUm(e.target.value)} style={{ padding: 8, borderRadius: 8, border: `1px solid ${BORDER}`, maxWidth: 360 }}>
              <option value="todos">Todos os clientes ({driveLista.clientes.length})</option>
              {driveLista.clientes.map((c) => <option key={c.id} value={c.id}>{c.codigo} - {c.nome}</option>)}
            </select>
            <Btn onClick={auditarDrive} disabled={lendo || !driveLista.clientes.length}>Auditar pelo Drive</Btn>
            {driveLista.ignoradas?.length > 0 && <span style={{ fontSize: 11, color: MUTED }}>{driveLista.ignoradas.length} pasta(s) fora do padrão ignorada(s)</span>}
          </div>
        )}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 14, fontSize: 12 }}>
          <label>Regime do cliente<br />
            <select value={regime} onChange={(e) => setRegime(e.target.value)} style={{ padding: 7, borderRadius: 8, border: `1px solid ${BORDER}` }}>
              <option value="AUTO">Detectar pelos documentos</option><option value="SIMPLES">Simples Nacional</option><option value="MEI">MEI</option><option value="PRESUMIDO">Lucro Presumido</option><option value="REAL">Lucro Real</option>
            </select></label>
          <label>Início das obrigações (opcional)<br />
            <input type="month" value={inicio} onChange={(e) => setInicio(e.target.value)} style={{ padding: 6, borderRadius: 8, border: `1px solid ${BORDER}` }} /></label>
        </div>
      </Cartao>
      {lendo && (
        <Cartao style={{ marginTop: 12, textAlign: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 15 }}>Lendo e conferindo os documentos…</div>
          <div style={{ color: MUTED, fontSize: 12, marginTop: 6 }}>{progresso}</div>
          <div style={{ color: MUTED, fontSize: 11, marginTop: 6 }}>Mantenha esta aba aberta até terminar. Ao final, o resultado aparece na Visão geral.</div>
        </Cartao>
      )}
      <Cartao style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 8 }}>Ou envie manualmente</div>
        <div onDragOver={(e) => e.preventDefault()} onDrop={aoSoltar} style={{ border: `2px dashed ${BORDER}`, borderRadius: 14, padding: 24, textAlign: "center", background: "#FAFBFD" }}>
          <div style={{ fontWeight: 900, fontSize: 15 }}>Arraste aqui a pasta do cliente (ou a pasta com todos os clientes)</div>
          <div style={{ color: MUTED, fontSize: 12, margin: "6px 0 12px" }}>Também aceita .zip. Padrão: “232 - NOME DO CLIENTE”. A leitura é feita no seu navegador.</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <Btn onClick={() => inputPasta.current?.click()} disabled={lendo}>Escolher pasta</Btn>
            <Btn sec onClick={() => inputZip.current?.click()} disabled={lendo}>Escolher .zip</Btn>
          </div>
          <input ref={inputPasta} type="file" webkitdirectory="" directory="" multiple onChange={aoEscolherPasta} style={{ display: "none" }} />
          <input ref={inputZip} type="file" accept=".zip" onChange={aoEscolherZip} style={{ display: "none" }} />
        </div>
      </Cartao>
    </div>
  );

  // ------------------------- ABA 2: VISÃO GERAL -------------------------
  const faltamPorCat = (() => {
    const m = new Map();
    for (const c of comSit) {
      const cats = new Set(c.achados.filter((x) => x.severidade !== "info").map((x) => x.categoria));
      cats.forEach((k) => m.set(k, (m.get(k) || 0) + 1));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  })();
  const filtrada = comSit
    .filter((c) => (fSit === "todos" ? true : fSit === "velhos" ? c.dias > 30 : c.sit === fSit))
    .filter((c) => !fCat || c.achados.some((x) => x.severidade !== "info" && x.categoria === fCat))
    .filter((c) => !busca || `${c.codigo} ${c.nome}`.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => (b.resumo.critico - a.resumo.critico) || (b.resumo.atencao - a.resumo.atencao) || a.saude - b.saude);
  const abaGeral = (
    <div>
      {salvo && <div style={{ color: "#2E7D32", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{salvo}</div>}
      {aviso.map((t, i) => <div key={i} style={{ background: "#FFF6E5", border: "1px solid #F3D9A4", borderRadius: 10, padding: 9, fontSize: 11, marginBottom: 8 }}>{t}</div>)}
      {painel === null && <Cartao>Carregando…</Cartao>}
      {painel && !painel.length && <Cartao><div style={{ color: MUTED }}>Nenhuma auditoria salva ainda. Vá na aba <b>1 · Auditar</b> e rode o Drive ou envie uma pasta.</div></Cartao>}
      {painel && painel.length > 0 && (
        <div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <Kpi rotulo="Clientes auditados" valor={kp.total} cor={NAVY} onClick={() => { setFSit("todos"); setFCat(""); }} ativo={fSit === "todos" && !fCat} />
            <Kpi rotulo="Em dia" valor={kp.ok} cor="#2E7D32" sub="sem críticos nem atenção" onClick={() => setFSit("ok")} ativo={fSit === "ok"} />
            <Kpi rotulo="Com pendência" valor={kp.pend} cor={COR.atencao} sub={`${kp.alertas} pendência(s) no total`} onClick={() => setFSit("atencao")} ativo={fSit === "atencao"} />
            <Kpi rotulo="Críticos" valor={kp.crit} cor={COR.critico} sub="precisam de ação já" onClick={() => setFSit("critico")} ativo={fSit === "critico"} />
            <Kpi rotulo="Auditoria antiga" valor={kp.velhos} cor="#7A8499" sub="há mais de 30 dias" onClick={() => setFSit("velhos")} ativo={fSit === "velhos"} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(240px,320px) 1fr", gap: 12, alignItems: "start" }}>
            <Cartao style={{ padding: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 4 }}>O que mais falta</div>
              <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>Clientes com pendência por categoria. Clique para filtrar.</div>
              {faltamPorCat.length === 0 && <div style={{ color: "#2E7D32", fontSize: 12, fontWeight: 800 }}>Nenhuma pendência.</div>}
              {faltamPorCat.map(([cat, n]) => (
                <button key={cat} type="button" onClick={() => setFCat(fCat === cat ? "" : cat)} style={{ width: "100%", textAlign: "left", background: fCat === cat ? "#FFF1ED" : "none", border: "none", padding: "5px 4px", cursor: "pointer", borderRadius: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}><span>{cat}</span><span>{n}</span></div>
                  <div style={{ height: 5, background: "#E8ECF3", borderRadius: 999, marginTop: 3 }}><div style={{ height: 5, width: `${Math.round((n / kp.total) * 100)}%`, background: CORAL, borderRadius: 999 }} /></div>
                </button>
              ))}
            </Cartao>
            <Cartao style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
                <div style={{ fontWeight: 900 }}>Clientes ({filtrada.length}){fCat ? ` · ${fCat}` : ""}</div>
                <input placeholder="Buscar cliente ou código" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ padding: 7, borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 12, minWidth: 200 }} />
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                  <thead><tr style={{ textAlign: "left", color: MUTED, fontSize: 11 }}>{["Cliente", "Situação", "Pendências", "O que falta / principal alerta", "Auditado", ""].map((h) => <th key={h} style={{ padding: "4px 8px", borderBottom: `1px solid ${BORDER}` }}>{h}</th>)}</tr></thead>
                  <tbody>{filtrada.map((c) => {
                    const [rot, cor] = ROTULO_SIT[c.sit];
                    const faltas = c.achados.filter((x) => x.severidade !== "info" && (FALTA_CAT(x) || c.sit === "critico")).slice(0, 2);
                    const principais = faltas.length ? faltas : c.achados.filter((x) => x.severidade !== "info").slice(0, 2);
                    return (
                      <tr key={c.codigo} style={{ borderBottom: `1px solid ${BORDER}`, verticalAlign: "top", cursor: "pointer" }} onClick={() => abrirCliente(c.codigo)}>
                        <td style={{ padding: "7px 8px", fontWeight: 800 }}>{c.codigo} - {c.nome}<div style={{ fontSize: 10.5, color: MUTED, fontWeight: 600 }}>saúde {c.saude}</div></td>
                        <td style={{ padding: "7px 8px", fontWeight: 900, color: cor, whiteSpace: "nowrap" }}>{rot}</td>
                        <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>{c.resumo.critico > 0 && <Selo sev="critico" n={c.resumo.critico} />}{c.resumo.atencao > 0 && <Selo sev="atencao" n={c.resumo.atencao} />}{c.sit === "ok" && "—"}</td>
                        <td style={{ padding: "7px 8px", color: MUTED }}>{principais.map((x, i) => <div key={i}>• {x.titulo}</div>)}{!principais.length && "—"}</td>
                        <td style={{ padding: "7px 8px", whiteSpace: "nowrap", color: c.dias > 30 ? COR.atencao : MUTED }}>{c.dias <= 0 ? "hoje" : `há ${c.dias} dia(s)`}</td>
                        <td style={{ padding: "7px 8px", color: CORAL, fontWeight: 900 }}>Abrir →</td>
                      </tr>);
                  })}</tbody>
                </table>
              </div>
              {!filtrada.length && <div style={{ color: MUTED, fontSize: 12, padding: 8 }}>Nenhum cliente neste filtro.</div>}
            </Cartao>
          </div>
        </div>
      )}
    </div>
  );

  // ------------------------- ABA 3: CLIENTE -------------------------
  const abaCliente = (
    <div>
      <Cartao style={{ marginBottom: 12, padding: 14 }} >
        <div className="nao-imprimir" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ fontSize: 12, color: MUTED }}>Cliente:{" "}
            <select value={cli?.codigo || ""} onChange={(e) => e.target.value && abrirCliente(e.target.value)} disabled={ocupado} style={{ padding: 8, borderRadius: 8, border: `1px solid ${BORDER}`, minWidth: 280 }}>
              <option value="">Selecione um cliente…</option>
              {[...lista].sort((a, b) => Number(a.codigo) - Number(b.codigo)).map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} - {c.nome}</option>)}
            </select>
          </label>
          {cli && <Btn onClick={atualizarCliente} disabled={ocupado}>{ocupado ? "Atualizando…" : "Atualizar agora pelo Drive"}</Btn>}
          {cli && (
            <label style={{ fontSize: 12, color: MUTED }}>Versão:{" "}
              <select value={cli.id} onChange={(e) => abrirCliente(cli.codigo, Number(e.target.value))} disabled={ocupado} style={{ padding: 8, borderRadius: 8, border: `1px solid ${BORDER}` }}>
                {cli.historico.map((h, i) => <option key={h.id} value={h.id}>{quando(h.created_at)} — saúde {h.saude}{i === 0 ? " (mais recente)" : ""}</option>)}
              </select>
            </label>
          )}
        </div>
        {cli && <div className="nao-imprimir" style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>{cli.historico.length} versão(ões) no histórico. Atualizar cria uma nova versão e mantém as anteriores.</div>}
      </Cartao>
      {!cli && !ocupado && <Cartao><div style={{ color: MUTED, fontSize: 13 }}>Selecione um cliente acima, ou clique em um cliente na Visão geral, para ver tudo o que há nas pastas dele.</div></Cartao>}
      {ocupado && !cli && <Cartao>Carregando…</Cartao>}
      {cli && <Relatorio key={cli.id} a={cli.atual} narrativa={cli.narrativa} anterior={cli.anterior} anteriorEm={cli.anteriorEm} criadoEm={cli.criadoEm} onIa={pedirIaCliente} iaBusy={ia} />}
    </div>
  );

  // ------------------------- ABA 4: VENCIMENTOS -------------------------
  const venc = comSit.flatMap((c) => (c.vencimentos || []).map((v) => ({ ...v, cliente: c, dias: v.data ? diasAte(v.data) : null })));
  const FAIXAS = { vencidos: "Já vencidos", 30: "Até 30 dias", 60: "Até 60 dias", 90: "Até 90 dias", todos: "Todos" };
  const vencFiltrado = venc
    .filter((v) => fVencCat === "todas" || v.categoria === fVencCat)
    .filter((v) => !fVencBusca || `${v.cliente.codigo} ${v.cliente.nome}`.toLowerCase().includes(fVencBusca.toLowerCase()))
    .filter((v) => {
      if (fVencFaixa === "todos") return true;
      if (v.dias === null) return true;
      if (fVencFaixa === "vencidos") return v.dias < 0;
      return v.dias <= Number(fVencFaixa);
    })
    .sort((a, b) => (a.dias === null ? -1 : b.dias === null ? 1 : a.dias - b.dias));
  const nVenc = venc.filter((v) => v.dias !== null && v.dias < 0 && v.categoria !== "Guia a vencer").length;
  const n30 = venc.filter((v) => v.dias !== null && v.dias >= 0 && v.dias <= 30).length;
  const nSemData = venc.filter((v) => v.dias === null).length;
  const faltas = comSit.map((c) => ({ c, itens: [...c.achados.filter((x) => x.severidade !== "info" && FALTA_CAT(x))], pastas: c.pastasPendentes || [] })).filter((x) => x.itens.length || x.pastas.length);
  const desatualizados = comSit.filter((c) => c.dias > 30).sort((a, b) => b.dias - a.dias);
  const abaVenc = (
    <div>
      {painel && !painel.length && <Cartao><div style={{ color: MUTED }}>Rode uma auditoria para ver os vencimentos.</div></Cartao>}
      {painel && painel.length > 0 && (
        <div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <Kpi rotulo="Documentos vencidos" valor={nVenc} cor={nVenc ? COR.critico : "#2E7D32"} sub="certidões e certificados" onClick={() => setFVencFaixa("vencidos")} ativo={fVencFaixa === "vencidos"} />
            <Kpi rotulo="Vencem em até 30 dias" valor={n30} cor={n30 ? COR.atencao : "#2E7D32"} sub="inclui guias a vencer" onClick={() => setFVencFaixa("30")} ativo={fVencFaixa === "30"} />
            <Kpi rotulo="Validade não identificada" valor={nSemData} cor="#7A8499" sub="sem data no nome/PDF" onClick={() => setFVencFaixa("todos")} />
            <Kpi rotulo="Clientes com documento faltando" valor={faltas.length} cor={faltas.length ? COR.atencao : "#2E7D32"} />
            <Kpi rotulo="Auditoria antiga (>30 dias)" valor={desatualizados.length} cor="#7A8499" />
          </div>
          <Cartao style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>Vencimentos de certidões, certificados e guias ({vencFiltrado.length})</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <select value={fVencCat} onChange={(e) => setFVencCat(e.target.value)} style={{ padding: 6, borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 12 }}>
                  <option value="todas">Todos os tipos</option><option>Certidão</option><option>Certificado digital</option><option>Guia a vencer</option>
                </select>
                <select value={fVencFaixa} onChange={(e) => setFVencFaixa(e.target.value)} style={{ padding: 6, borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 12 }}>
                  {Object.entries(FAIXAS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
                </select>
                <input placeholder="Buscar cliente" value={fVencBusca} onChange={(e) => setFVencBusca(e.target.value)} style={{ padding: 6, borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 12 }} />
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                <thead><tr style={{ textAlign: "left", color: MUTED, fontSize: 11 }}>{["Cliente", "Documento", "Tipo", "Data", "Prazo", ""].map((h) => <th key={h} style={{ padding: "4px 8px", borderBottom: `1px solid ${BORDER}` }}>{h}</th>)}</tr></thead>
                <tbody>{vencFiltrado.map((v, i) => {
                  const cor = v.dias === null ? "#7A8499" : v.dias < 0 ? (v.categoria === "Guia a vencer" ? COR.atencao : COR.critico) : v.dias <= 30 ? COR.atencao : "#2E7D32";
                  const prazo = v.dias === null ? "Validade não identificada" : v.dias < 0 ? `Vencido há ${-v.dias} dia(s)` : v.dias === 0 ? "Vence hoje" : `Em ${v.dias} dia(s)`;
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${BORDER}`, verticalAlign: "top" }}>
                      <td style={{ padding: "6px 8px", fontWeight: 800 }}>{v.cliente.codigo} - {v.cliente.nome}</td>
                      <td style={{ padding: "6px 8px", wordBreak: "break-all" }}>{v.nome}<div style={{ fontSize: 10.5, color: MUTED }}>{v.pasta}{v.detalhe && v.categoria === "Guia a vencer" ? ` · ${v.detalhe}` : ""}</div></td>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{v.categoria === "Certidão" ? v.tipo.replace("Certidão negativa", "CND") : v.categoria}</td>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{v.data ? dataBr(v.data) : "—"}</td>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap", fontWeight: 900, color: cor }}>{prazo}</td>
                      <td style={{ padding: "6px 8px", color: CORAL, fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" }} onClick={() => abrirCliente(v.cliente.codigo)}>Abrir →</td>
                    </tr>);
                })}</tbody>
              </table>
            </div>
            {!vencFiltrado.length && <div style={{ color: MUTED, fontSize: 12, padding: 8 }}>Nada neste filtro.</div>}
          </Cartao>

          <Cartao style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Documentos faltando por cliente ({faltas.length})</div>
            {!faltas.length && <div style={{ color: "#2E7D32", fontWeight: 800, fontSize: 12 }}>Nenhum cliente com documento faltando.</div>}
            {faltas.map(({ c, itens, pastas }) => (
              <div key={c.codigo} style={{ borderLeft: `4px solid ${c.sit === "critico" ? COR.critico : COR.atencao}`, background: "#FAFBFD", borderRadius: 8, padding: "8px 10px", marginBottom: 7 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontWeight: 900, fontSize: 12.5 }}>{c.codigo} - {c.nome}</div>
                  <span onClick={() => abrirCliente(c.codigo)} style={{ color: CORAL, fontWeight: 900, fontSize: 12, cursor: "pointer" }}>Abrir →</span>
                </div>
                {itens.map((x, i) => <div key={i} style={{ fontSize: 12, color: COR[x.severidade], fontWeight: 700 }}>• {x.titulo}</div>)}
                {pastas.length > 0 && <div style={{ fontSize: 11.5, color: MUTED }}>Pastas vazias mas esperadas: {pastas.map((p) => p.nome).join(", ")}</div>}
              </div>
            ))}
          </Cartao>

          {desatualizados.length > 0 && (
            <Cartao>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Auditorias desatualizadas ({desatualizados.length})</div>
              <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 6 }}>Clientes cuja pasta não é auditada há mais de 30 dias. Atualize para saber o que mudou.</div>
              {desatualizados.map((c) => <div key={c.codigo} style={{ fontSize: 12, padding: "3px 0", cursor: "pointer" }} onClick={() => abrirCliente(c.codigo)}><b>{c.codigo} - {c.nome}</b> · há {c.dias} dia(s)</div>)}
            </Cartao>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {cabecalho}
      <Abas valor={aba} onChange={(k) => { setAba(k); if (k === "geral" || k === "vencimentos") carregarPainel(); }} itens={abas} sticky />
      {erro && <div className="nao-imprimir" style={{ marginBottom: 10, color: COR.critico, fontSize: 12, fontWeight: 700, background: "#FDECEC", borderRadius: 8, padding: "8px 10px" }}>{erro} <button type="button" onClick={() => setErro("")} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", fontWeight: 900 }}>×</button></div>}
      {aba === "auditar" && abaAuditar}
      {aba === "geral" && abaGeral}
      {aba === "cliente" && abaCliente}
      {aba === "vencimentos" && abaVenc}
    </div>
  );
}
