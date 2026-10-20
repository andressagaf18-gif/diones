import { useEffect, useMemo, useState } from "react";
import { brlN } from "../../server/apuracao-engine.js";

const NAVY = "#17233D", CORAL = "#FF6B4A", MUTED = "#5B667A", BORDER = "#E3E7EF", WHITE = "#FFFFFF";
const COR = { critico: "#C62828", atencao: "#E08A00", info: "#4A6FA5" };
const ROTULO = { critico: "Crítico", atencao: "Atenção", info: "Informativo" };
const pct = (v) => (v === null || v === undefined ? "—" : `${(v * 100).toFixed(2).replace(".", ",")}%`);
const dataBr = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

const Cartao = ({ children, style }) => <div style={{ background: WHITE, borderWidth: 1, borderStyle: "solid", borderColor: BORDER, borderRadius: 14, padding: 16, ...style }}>{children}</div>;
const Botao = ({ children, onClick, disabled, claro }) => (
  <button onClick={onClick} disabled={disabled} style={{ border: claro ? `1px solid ${BORDER}` : "none", background: claro ? WHITE : CORAL, color: claro ? NAVY : WHITE, borderRadius: 10, padding: "8px 14px", fontWeight: 800, fontSize: 12, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1 }}>{children}</button>
);

export default function AuditoriaApuracoes({ token, onVoltar }) {
  const [clientes, setClientes] = useState([]);
  const [painel, setPainel] = useState({});
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [fazendo, setFazendo] = useState({}); // codigo -> true
  const [lote, setLote] = useState(null);     // { feitos, total, atual }
  const [detalhe, setDetalhe] = useState(null); // { atual, historico }

  async function api(action, body, method = "POST", query = {}) {
    const p = new URLSearchParams({ action, ...query });
    const r = await fetch(`/api/tributario?${p}`, { method, headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: method === "GET" ? undefined : JSON.stringify(body) });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d?.sucesso) throw new Error(d?.error || "Erro na auditoria de apurações.");
    return d;
  }
  async function carregar() {
    setCarregando(true); setErro("");
    try {
      const [c, p] = await Promise.all([api("pasta-drive-clientes", null, "GET"), api("apuracao-painel", null, "GET")]);
      setClientes(c.clientes || []);
      setPainel(Object.fromEntries((p.clientes || []).map((x) => [String(x.cliente_codigo), x])));
    } catch (e) { setErro(e.message); }
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function auditar(c) {
    setFazendo((f) => ({ ...f, [c.codigo]: true }));
    try {
      const d = await api("apuracao-auditar", { pastaId: c.id, codigo: c.codigo, nome: c.nome, raiz: c.raiz });
      setPainel((p) => ({ ...p, [c.codigo]: { cliente_codigo: c.codigo, cliente_nome: c.nome, saude: d.auditoria.saude, criticos: d.auditoria.resumo.critico, atencoes: d.auditoria.resumo.atencao, infos: d.auditoria.resumo.info, declaracoes: String(d.auditoria.declaracoes), aviso: d.auditoria.aviso || null, created_at: d.criadoEm, id: d.id } }));
      return d;
    } catch (e) { setErro(`${c.codigo} - ${c.nome}: ${e.message}`); }
    finally { setFazendo((f) => ({ ...f, [c.codigo]: false })); }
  }
  async function abrir(c) {
    try { const d = await api("apuracao-obter", null, "GET", { codigo: c.codigo }); setDetalhe({ ...d, cliente: c }); window.scrollTo?.(0, 0); }
    catch (e) { setErro(e.message); }
  }
  async function abrirVersao(id) {
    const d = await api("apuracao-obter", null, "GET", { id });
    setDetalhe((x) => ({ ...x, atual: d.atual }));
  }
  async function auditarEAbrir(c) { const d = await auditar(c); if (d) await abrir(c); }
  async function auditarLote(somentePendentes) {
    const alvo = clientes.filter((c) => !somentePendentes || !painel[c.codigo]);
    setLote({ feitos: 0, total: alvo.length, atual: "" });
    for (let i = 0; i < alvo.length; i++) {
      setLote({ feitos: i, total: alvo.length, atual: `${alvo[i].codigo} - ${alvo[i].nome}` });
      await auditar(alvo[i]);
    }
    setLote(null);
  }

  const lista = useMemo(() => clientes.filter((c) => {
    const p = painel[c.codigo];
    if (busca && !`${c.codigo} ${c.nome}`.toLowerCase().includes(busca.toLowerCase())) return false;
    if (filtro === "pendente") return !p;
    if (filtro === "critico") return p && p.criticos > 0;
    if (filtro === "ok") return p && p.criticos === 0 && !p.aviso;
    if (filtro === "semDecl") return p && p.aviso;
    return true;
  }), [clientes, painel, busca, filtro]);

  const tot = useMemo(() => {
    const ps = Object.values(painel);
    return { total: clientes.length, auditados: ps.length, criticos: ps.filter((p) => p.criticos > 0).length, ok: ps.filter((p) => p.criticos === 0 && !p.aviso).length, semDecl: ps.filter((p) => p.aviso).length };
  }, [clientes, painel]);

  if (detalhe) {
    const a = detalhe.atual.resultado;
    return (
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Botao claro onClick={() => setDetalhe(null)}>← Voltar à lista</Botao>
          <Botao onClick={() => auditarEAbrir(detalhe.cliente)} disabled={fazendo[detalhe.cliente.codigo]}>{fazendo[detalhe.cliente.codigo] ? "Atualizando…" : "Atualizar agora pelo Drive"}</Botao>
        </div>
        <Cartao style={{ marginBottom: 12 }}>
          <div style={{ color: CORAL, fontSize: 9, fontWeight: 900, letterSpacing: 1 }}>AUDITORIA DA APURAÇÃO · SIMPLES NACIONAL</div>
          <h2 style={{ margin: "6px 0 2px" }}>{a.cliente.codigo} - {a.cliente.nome}</h2>
          <div style={{ fontSize: 12, color: MUTED }}>{a.declaracoes} declaração(ões) conferida(s) · gerado em {dataBr(detalhe.atual.created_at)}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            {[["Saúde", a.saude, a.saude >= 80 ? "#2E7D32" : a.saude >= 50 ? COR.atencao : COR.critico], ["Críticos", a.resumo.critico, COR.critico], ["Atenção", a.resumo.atencao, COR.atencao], ["Informativos", a.resumo.info, COR.info]].map(([r, v, c]) => (
              <div key={r} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: "8px 14px", minWidth: 100 }}><div style={{ fontSize: 10, color: MUTED }}>{r}</div><div style={{ fontSize: 22, fontWeight: 900, color: c }}>{v}</div></div>
            ))}
          </div>
          {detalhe.historico?.length > 1 && (
            <div style={{ marginTop: 10, fontSize: 12 }}>Versões: {detalhe.historico.map((h) => <button key={h.id} onClick={() => abrirVersao(h.id)} style={{ marginRight: 6, border: `1px solid ${BORDER}`, background: h.id === detalhe.atual.id ? NAVY : WHITE, color: h.id === detalhe.atual.id ? WHITE : NAVY, borderRadius: 8, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>{dataBr(h.created_at)}</button>)}</div>
          )}
        </Cartao>
        {a.aviso && <Cartao style={{ marginBottom: 12, borderColor: COR.atencao }}>{a.aviso}</Cartao>}
        {a.meses?.length > 0 && (
          <Cartao style={{ marginBottom: 12, overflowX: "auto" }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Conferência mês a mês</div>
            <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 8 }}>O sistema refaz o cálculo do PGDAS-D (anexo, faixa pela RBT12, alíquota efetiva e repartição) e compara com o que foi declarado e com a guia.</div>
            <table style={{ borderCollapse: "collapse", fontSize: 11.5, width: "100%" }}>
              <thead><tr style={{ textAlign: "left", color: MUTED }}>{["Mês", "Receita", "RBT12", "Anexo", "Faixa", "Alíq. efetiva", "Declarado", "Recalculado", "Diferença", "Guia", "Situação"].map((h) => <th key={h} style={{ padding: "4px 6px", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
              <tbody>{a.meses.map((m) => {
                const sit = m.situacao === "ok" ? ["Conferido", "#2E7D32"] : m.situacao === "sem_movimento" ? ["Sem movimento (entregue)", "#2E7D32"] : m.situacao === "so_recibo" ? ["Só recibo", COR.info] : m.situacao === "divergente" ? ["Divergente", COR.critico] : ["Conferir manual", COR.atencao];
                return (
                  <tr key={m.mes} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td style={{ padding: "5px 6px", fontWeight: 800 }}>{m.rotulo}{m.retificadora ? " (retif.)" : ""}</td>
                    <td style={{ padding: "5px 6px" }}>{brlN(m.rpa)}</td><td style={{ padding: "5px 6px" }}>{brlN(m.rbt12)}</td>
                    <td style={{ padding: "5px 6px" }}>{m.anexos || "—"}</td><td style={{ padding: "5px 6px" }}>{m.faixa ?? "—"}</td><td style={{ padding: "5px 6px" }}>{pct(m.aliquotaEfetiva)}</td>
                    <td style={{ padding: "5px 6px" }}>{brlN(m.debitoDeclarado)}</td><td style={{ padding: "5px 6px" }}>{brlN(m.debitoRecalculado)}</td>
                    <td style={{ padding: "5px 6px", fontWeight: 800, color: m.diferenca && Math.abs(m.diferenca) > 0.05 ? COR.critico : MUTED }}>{m.diferenca === null ? "—" : brlN(m.diferenca)}</td>
                    <td style={{ padding: "5px 6px" }}>{brlN(m.valorGuia)}</td>
                    <td style={{ padding: "5px 6px", fontWeight: 800, color: sit[1] }}>{sit[0]}{(m.entregaEm || m.reciboNumero) && <div style={{ fontWeight: 400, fontSize: 10, color: MUTED, whiteSpace: "nowrap" }}>{m.entregaEm ? `Entregue em ${m.entregaEm.split("-").reverse().join("/")}` : "Entregue"}{m.reciboNumero ? ` · recibo ${m.reciboNumero}` : ""}</div>}</td>
                  </tr>);
              })}</tbody>
            </table>
          </Cartao>
        )}
        <Cartao>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Alertas ({a.achados.length})</div>
          {a.achados.length === 0 && <div style={{ color: "#2E7D32", fontWeight: 800 }}>Nenhuma divergência encontrada nas declarações lidas.</div>}
          {["critico", "atencao", "info"].map((s) => a.achados.filter((x) => x.severidade === s).map((x, i) => (
            <div key={s + i} style={{ borderLeft: `4px solid ${COR[s]}`, padding: "6px 10px", margin: "6px 0", background: "#FAFBFD" }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: COR[s] }}>{ROTULO[s].toUpperCase()} · {x.categoria}</div>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{x.titulo}</div>
              {x.detalhe && <div style={{ fontSize: 12, color: MUTED }}>{x.detalhe}</div>}
              {x.sugestao && <div style={{ fontSize: 12 }}>→ {x.sugestao}</div>}
            </div>)))}
          {a.falhas?.length > 0 && <div style={{ marginTop: 8, fontSize: 11.5, color: MUTED }}>Arquivos não lidos: {a.falhas.join(" · ")}</div>}
        </Cartao>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <div style={{ marginBottom: 12 }}><Botao claro onClick={onVoltar}>← Inteligência Tributária</Botao></div>
      <Cartao style={{ marginBottom: 12, borderTopWidth: 4, borderTopColor: NAVY }}>
        <div style={{ color: CORAL, fontSize: 9, fontWeight: 900, letterSpacing: 1 }}>AUDITORIA DE APURAÇÕES</div>
        <h2 style={{ margin: "6px 0" }}>Conferir se o imposto apurado está certo</h2>
        <p style={{ color: MUTED, fontSize: 12, lineHeight: 1.55, margin: 0, maxWidth: 800 }}>Lê direto do Drive as declarações do PGDAS-D e as guias do DAS, refaz o cálculo e aponta diferenças em reais, RBT12 que não fecha, fator r e anexo errados, guia menor que o declarado e limites do Simples. Lucro Presumido e Lucro Real entram na próxima etapa.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <Botao onClick={() => auditarLote(true)} disabled={!!lote || carregando}>Auditar clientes ainda não auditados</Botao>
          <Botao claro onClick={() => auditarLote(false)} disabled={!!lote || carregando}>Reauditar todos</Botao>
          <Botao claro onClick={carregar} disabled={!!lote || carregando}>Recarregar lista</Botao>
        </div>
        {lote && <div style={{ marginTop: 10, fontSize: 12 }}><b>{lote.feitos}/{lote.total}</b> · auditando {lote.atual}…<div style={{ height: 6, background: BORDER, borderRadius: 4, marginTop: 4 }}><div style={{ height: 6, width: `${(lote.feitos / Math.max(1, lote.total)) * 100}%`, background: CORAL, borderRadius: 4 }} /></div></div>}
      </Cartao>
      {erro && <Cartao style={{ marginBottom: 12, borderColor: COR.critico, color: COR.critico, fontSize: 12 }}>{erro}</Cartao>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {[["todos", `Todos (${tot.total})`], ["pendente", `Não auditados (${tot.total - tot.auditados})`], ["critico", `Com divergência (${tot.criticos})`], ["ok", `Conferidos (${tot.ok})`], ["semDecl", `Sem PGDAS na pasta (${tot.semDecl})`]].map(([k, r]) => (
          <button key={k} onClick={() => setFiltro(k)} style={{ border: `1px solid ${BORDER}`, background: filtro === k ? NAVY : WHITE, color: filtro === k ? WHITE : NAVY, borderRadius: 999, padding: "6px 12px", fontWeight: 800, fontSize: 11.5, cursor: "pointer" }}>{r}</button>))}
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente" style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "6px 10px", fontSize: 12, marginLeft: "auto" }} />
      </div>
      {carregando ? <Cartao>Carregando clientes do Drive…</Cartao> : (
        <Cartao style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead><tr style={{ textAlign: "left", color: MUTED, background: "#F6F8FB" }}>{["Cliente", "Declarações", "Críticos", "Atenção", "Saúde", "Última auditoria", ""].map((h) => <th key={h} style={{ padding: "8px 10px" }}>{h}</th>)}</tr></thead>
            <tbody>{lista.map((c) => {
              const p = painel[c.codigo];
              return (
                <tr key={c.codigo} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <td style={{ padding: "7px 10px", fontWeight: 800 }}>{c.codigo} - {c.nome}</td>
                  <td style={{ padding: "7px 10px" }}>{p ? (p.aviso ? <span style={{ color: COR.atencao }}>sem PGDAS</span> : p.declaracoes) : "—"}</td>
                  <td style={{ padding: "7px 10px", fontWeight: 900, color: p?.criticos > 0 ? COR.critico : MUTED }}>{p ? p.criticos : "—"}</td>
                  <td style={{ padding: "7px 10px", color: p?.atencoes > 0 ? COR.atencao : MUTED }}>{p ? p.atencoes : "—"}</td>
                  <td style={{ padding: "7px 10px" }}>{p ? p.saude : "—"}</td>
                  <td style={{ padding: "7px 10px", color: MUTED }}>{p ? dataBr(p.created_at) : "nunca"}</td>
                  <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                    {p && <Botao claro onClick={() => abrir(c)}>Ver</Botao>}{" "}
                    <Botao onClick={() => auditarEAbrir(c)} disabled={fazendo[c.codigo] || !!lote}>{fazendo[c.codigo] ? "Lendo…" : p ? "Atualizar" : "Auditar"}</Botao>
                  </td>
                </tr>);
            })}</tbody>
          </table>
        </Cartao>
      )}
    </div>
  );
}
