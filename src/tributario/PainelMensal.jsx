import { Fragment, useMemo, useState } from "react";
import { montarPainel, STATUS_PAINEL, prazoDoMes } from "./painelMensal.js";

const NAVY = "#17233D", MUTED = "#5B667A", BORDER = "#E3E7EF", WHITE = "#FFFFFF", CORAL = "#FF6B4A";
const dBr = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");
const mesLongo = (k) => { const n = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]; return `${n[+k.slice(5, 7) - 1]} de ${k.slice(0, 4)}`; };
const SIMBOLO = { no_prazo: "✓", atrasado: "!", faltando: "✗", a_vencer: "…", postado: "✓", nao_se_aplica: "" };

function lerPrazo() { try { const v = Number(window.localStorage.getItem("painelPrazoDia")); return v >= 1 && v <= 31 ? v : 15; } catch { return 15; } }
function gravarPrazo(v) { try { window.localStorage.setItem("painelPrazoDia", String(v)); } catch { /* sem armazenamento */ } }

const Chip = ({ s }) => { const [r, cor, fundo] = STATUS_PAINEL[s]; return <span style={{ background: fundo, color: cor, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" }}>{r}</span>; };

export default function PainelMensal({ a }) {
  const [prazoDia, setPrazoDia] = useState(lerPrazo);
  const [vista, setVista] = useState("mes");
  const base = useMemo(() => montarPainel(a, { prazoDia }), [a, prazoDia]);
  const [mes, setMes] = useState(base.ultimaCompetencia);
  const [filtro, setFiltro] = useState("todos");
  const mesesOpcao = base.meses.filter((m) => m <= base.ultimaCompetencia).slice(-24).reverse();
  const mesAtual = mesesOpcao.includes(mes) ? mes : (mesesOpcao[0] || base.ultimaCompetencia);
  const t = base.totais(mesAtual);
  const esperados = t.no_prazo + t.atrasado + t.faltando + t.postado + t.a_vencer;
  const postados = t.no_prazo + t.atrasado + t.postado;
  const pct = esperados ? Math.round((postados / esperados) * 100) : 0;
  const prazo = prazoDoMes(mesAtual, prazoDia);

  const linhasMes = base.itens.map((i) => ({ ...i, c: i.celulas[mesAtual] })).filter((i) => i.c && i.c.status !== "nao_se_aplica" && (filtro === "todos" || i.c.status === filtro || (filtro === "postado" && ["no_prazo", "atrasado", "postado"].includes(i.c.status))));
  const porPasta = [];
  for (const i of linhasMes) { let g = porPasta.find((x) => x.pasta === i.pasta); if (!g) { g = { pasta: i.pasta, itens: [] }; porPasta.push(g); } g.itens.push(i); }

  const mesesMatriz = base.meses.filter((m) => m <= base.ultimaCompetencia).slice(-12);
  return (
    <div>
      <div className="nao-imprimir" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12, fontSize: 12 }}>
        <div style={{ display: "inline-flex", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
          {[["mes", "Por mês"], ["matriz", "Todos os meses"]].map(([k, r]) => <button key={k} type="button" onClick={() => setVista(k)} style={{ border: "none", padding: "7px 14px", fontWeight: 800, fontSize: 12, cursor: "pointer", background: vista === k ? NAVY : WHITE, color: vista === k ? WHITE : NAVY }}>{r}</button>)}
        </div>
        {vista === "mes" && (
          <label>Competência <select value={mesAtual} onChange={(e) => setMes(e.target.value)} style={{ padding: 6, borderRadius: 8, border: `1px solid ${BORDER}` }}>{mesesOpcao.map((m) => <option key={m} value={m}>{m.slice(5, 7)}/{m.slice(0, 4)}</option>)}</select></label>
        )}
        <label>Prazo dos colaboradores: dia <input type="number" min="1" max="31" value={prazoDia} onChange={(e) => { const v = Math.max(1, Math.min(31, Number(e.target.value) || 15)); setPrazoDia(v); gravarPrazo(v); }} style={{ width: 52, padding: 6, borderRadius: 8, border: `1px solid ${BORDER}` }} /> do mês seguinte</label>
      </div>

      {vista === "mes" ? (
        <>
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "baseline" }}>
              <div style={{ fontWeight: 900, fontSize: 15 }}>Competência {mesLongo(mesAtual)}</div>
              <div style={{ fontSize: 12, color: MUTED }}>Prazo para colocar na pasta: <b>{dBr(prazo)}</b></div>
            </div>
            <div style={{ height: 10, background: "#EEF1F6", borderRadius: 999, marginTop: 10, overflow: "hidden", display: "flex" }}>
              {[["no_prazo", "#2E7D32"], ["postado", "#2E7D32"], ["atrasado", "#E08A00"], ["faltando", "#C62828"], ["a_vencer", "#C9CFDB"]].map(([k, c]) => (t[k] ? <div key={k} title={`${STATUS_PAINEL[k][0]}: ${t[k]}`} style={{ width: `${(t[k] / Math.max(1, esperados)) * 100}%`, background: c }} /> : null))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginTop: 12 }}>
              {[["Postados no prazo", t.no_prazo + t.postado, "#2E7D32", "no_prazo"], ["Postados com atraso", t.atrasado, "#E08A00", "atrasado"], ["Não postados", t.faltando, "#C62828", "faltando"], ["Ainda no prazo", t.a_vencer, MUTED, "a_vencer"]].map(([r, v, c, k]) => (
                <button key={k} type="button" onClick={() => setFiltro(filtro === k ? "todos" : k)} style={{ textAlign: "left", cursor: "pointer", border: `1px solid ${filtro === k ? c : BORDER}`, background: filtro === k ? "#FAFBFD" : WHITE, borderRadius: 12, padding: "8px 12px" }}>
                  <div style={{ fontSize: 10.5, color: MUTED }}>{r}</div><div style={{ fontSize: 24, fontWeight: 900, color: c }}>{v}</div>
                </button>))}
            </div>
            <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>{postados} de {esperados} documento(s) esperado(s) já estão na pasta ({pct}%). A data considerada é a de entrada do arquivo no Drive.{filtro !== "todos" && " Filtro ativo: clique no quadro de novo para limpar."}</div>
          </div>

          {porPasta.length === 0 && <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, color: MUTED, fontSize: 12.5 }}>Nenhum documento recorrente esperado nesta competência{filtro !== "todos" ? " com esse filtro" : ""}.</div>}
          {porPasta.map((g) => (
            <div key={g.pasta} style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, marginBottom: 10, overflow: "hidden", breakInside: "avoid" }}>
              <div style={{ padding: "9px 14px", background: "#F6F8FB", fontWeight: 900, fontSize: 12.5, color: NAVY, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                <span>{g.pasta}</span>
                <span style={{ fontSize: 11, color: MUTED }}>{g.itens.filter((i) => i.c.status === "faltando").length ? `${g.itens.filter((i) => i.c.status === "faltando").length} faltando` : "completa"}</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                  <tbody>{g.itens.map((i, k) => (
                    <tr key={k} style={{ borderTop: `1px solid ${BORDER}` }}>
                      <td style={{ padding: "7px 14px", fontWeight: 800, minWidth: 190 }}>{i.tipo}</td>
                      <td style={{ padding: "7px 8px" }}><Chip s={i.c.status} /></td>
                      <td style={{ padding: "7px 8px", color: MUTED, whiteSpace: "nowrap" }}>{i.c.postadoEm ? `Entrou em ${dBr(i.c.postadoEm)}${i.c.diasAtraso ? ` · ${i.c.diasAtraso} dia(s) de atraso` : ""}` : i.c.status === "faltando" ? `Venceu em ${dBr(i.c.prazo)}` : i.c.status === "a_vencer" ? `Vence em ${dBr(i.c.prazo)}` : ""}</td>
                      <td style={{ padding: "7px 14px 7px 8px", color: MUTED, fontSize: 11, wordBreak: "break-all" }}>{i.c.arquivo}{i.c.qtd > 1 ? ` (+${i.c.qtd - 1})` : ""}</td>
                    </tr>))}</tbody>
                </table>
              </div>
            </div>))}
        </>
      ) : (
        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, overflowX: "auto" }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Documentos por mês, com o prazo dos colaboradores (dia {prazoDia})</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: MUTED, marginBottom: 10 }}>
            {["no_prazo", "atrasado", "faltando", "a_vencer"].map((k) => <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 14, height: 14, borderRadius: 4, background: STATUS_PAINEL[k][2], border: `1px solid ${STATUS_PAINEL[k][1]}66`, color: STATUS_PAINEL[k][1], fontSize: 10, fontWeight: 900, textAlign: "center", lineHeight: "14px" }}>{SIMBOLO[k]}</span>{STATUS_PAINEL[k][0]}</span>)}
          </div>
          <table style={{ borderCollapse: "separate", borderSpacing: 3, fontSize: 11 }}>
            <thead><tr><th style={{ textAlign: "left", padding: "3px 6px", color: MUTED }}>Documento</th>{mesesMatriz.map((m) => <th key={m} style={{ padding: "3px 4px", color: MUTED, whiteSpace: "nowrap" }}>{m.slice(5)}/{m.slice(2, 4)}</th>)}</tr></thead>
            <tbody>{base.itens.map((i, k) => (
              <Fragment key={k}>
                {(k === 0 || base.itens[k - 1].pasta !== i.pasta) && <tr key={`g${k}`}><td colSpan={mesesMatriz.length + 1} style={{ padding: "8px 6px 2px", fontWeight: 900, fontSize: 11.5, color: NAVY }}>{i.pasta}</td></tr>}
                <tr key={k}>
                  <td style={{ padding: "2px 6px", fontWeight: 700, minWidth: 190 }}>{i.tipo}</td>
                  {mesesMatriz.map((m) => {
                    const c = i.celulas[m]; const [r, cor, fundo] = STATUS_PAINEL[c.status];
                    const dica = c.status === "nao_se_aplica" ? "" : `${m.slice(5)}/${m.slice(0, 4)}: ${r}${c.postadoEm ? ` · entrou em ${dBr(c.postadoEm)}` : ""}${c.diasAtraso ? ` (${c.diasAtraso} dia(s) de atraso)` : ""} · prazo ${dBr(c.prazo)}${c.arquivo ? ` · ${c.arquivo}` : ""}`;
                    return <td key={m} title={dica} style={{ textAlign: "center", minWidth: 34, height: 26, borderRadius: 6, fontWeight: 900, background: fundo, color: cor, border: c.status === "nao_se_aplica" ? "none" : `1px solid ${cor}33` }}>{SIMBOLO[c.status]}</td>;
                  })}
                </tr>
              </Fragment>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
