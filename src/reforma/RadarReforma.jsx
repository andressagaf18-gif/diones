import { useEffect, useMemo, useState } from "react";

const NAVY = "#17233D", MUTED = "#5B667A", BORDER = "#E3E7EF", WHITE = "#FFFFFF", CORAL = "#FF6B4A";
const STATUS = {
  vigente: ["Aprovado e em vigor", "#1B6E2E", "#E3F4E6"],
  aprovado: ["Aprovado — efeitos futuros", "#1D4F91", "#E1ECFA"],
  tramitacao: ["Em tramitação", "#9A5B00", "#FFF1D6"],
  solicitado: ["Solicitado / aguardando envio", "#7A3E9D", "#F3E6FA"],
  prazo: ["Prazo em curso", "#B3261E", "#FDE4E1"],
};
const dBr = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(String(iso || "")) ? String(iso).slice(0, 10).split("-").reverse().join("/") : "—");
const VAZIO = { slug: "", titulo: "", status: "tramitacao", orgao: "", baseLegal: "", resumo: "", dataEvento: "", proximaData: "", proximoPasso: "", impactoSistema: "", revisar: false, fontes: [{ titulo: "", url: "" }] };

export default function RadarReforma({ token }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [vista, setVista] = useState("painel");
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState(VAZIO);
  const [ocupado, setOcupado] = useState("");
  const [arquivados, setArquivados] = useState(false);

  async function chamar(action, body, method = "POST", query = {}) {
    const p = new URLSearchParams({ action, ...query });
    const r = await fetch(`/api/tributario?${p}`, { method, headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: method === "GET" ? undefined : JSON.stringify(body) });
    const txt = await r.text(); let d = null; try { d = JSON.parse(txt); } catch { d = null; }
    if (!r.ok || !d?.sucesso) throw new Error(d?.error || `Erro (${r.status}).`);
    return d;
  }
  async function carregar() {
    setErro("");
    try { setDados(await chamar("reforma-radar", null, "GET", arquivados ? { arquivados: "1" } : {})); } catch (e) { setErro(e.message); }
  }
  useEffect(() => { carregar(); }, [arquivados]); // eslint-disable-line react-hooks/exhaustive-deps

  const itens = dados?.itens || [];
  const confirmados = itens.filter((i) => i.revisao === "confirmado");
  const sugestoes = itens.filter((i) => i.revisao === "sugestao" && i.ativo);
  const visiveis = useMemo(() => confirmados.filter((i) => (filtro === "todos" || i.status === filtro || (filtro === "revisar" && i.revisar)) && (!busca || `${i.titulo} ${i.baseLegal} ${i.resumo}`.toLowerCase().includes(busca.toLowerCase()))), [confirmados, filtro, busca]);
  const podeEditar = !!dados?.podeEditar;

  async function agir(rotulo, fn) {
    setOcupado(rotulo); setErro(""); setMsg("");
    try { await fn(); await carregar(); } catch (e) { setErro(e.message); } finally { setOcupado(""); }
  }
  const editar = (i) => { setForm({ ...VAZIO, ...i, fontes: (i.fontes?.length ? i.fontes : VAZIO.fontes).map((f) => ({ titulo: f.titulo, url: f.url, lida: f.lida })) }); setVista("atualizar"); window.scrollTo?.(0, 0); };
  const salvar = () => agir("salvar", async () => { const r = await chamar("reforma-radar-salvar", form); setMsg("Item salvo e marcado como verificado hoje."); setForm(VAZIO); setVista("painel"); return r; });
  const verificar = (i) => agir(`v${i.slug}`, async () => { await chamar("reforma-radar-verificar", { slug: i.slug }); setMsg("Marcado como verificado hoje."); });
  const arquivar = (i, ativo = false) => agir(`a${i.slug}`, async () => { await chamar("reforma-radar-arquivar", { slug: i.slug, ativo }); });
  const pesquisar = () => agir("pesquisar", async () => { const r = await chamar("reforma-radar-pesquisar", {}); setMsg(r.novas ? `${r.novas} sugestão(ões) encontrada(s) — revise na aba "Atualizar" antes de valer.` : "Nenhuma novidade com fonte oficial encontrada."); setVista(r.novas ? "atualizar" : vista); });

  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const campo = { width: "100%", padding: 8, borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 12.5, boxSizing: "border-box", background: WHITE, fontFamily: "inherit" };
  const rot = (t) => <div style={{ fontSize: 11, fontWeight: 800, color: MUTED, margin: "10px 0 4px" }}>{t}</div>;
  const btn = (extra = {}) => ({ border: `1px solid ${BORDER}`, background: WHITE, borderRadius: 8, padding: "6px 11px", fontSize: 11.5, fontWeight: 800, cursor: "pointer", color: NAVY, ...extra });

  const FonteChip = ({ f }) => (
    <a href={f.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", gap: 6, alignItems: "center", textDecoration: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "4px 8px", fontSize: 11, color: NAVY, background: "#FAFBFD", maxWidth: "100%" }}>
      <span style={{ background: f.tipo === "oficial" ? "#E3F4E6" : "#EEF1F6", color: f.tipo === "oficial" ? "#1B6E2E" : MUTED, borderRadius: 5, padding: "1px 6px", fontWeight: 900, fontSize: 9.5, whiteSpace: "nowrap" }}>{f.tipo === "oficial" ? "OFICIAL" : "APOIO"}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.titulo || f.url}</span>
      {f.lida === false && <span title="Link legal registrado, mas não aberto na pesquisa — confira o texto" style={{ color: "#9A5B00", fontWeight: 800, fontSize: 9.5 }}>conferir</span>}
    </a>
  );

  function Cartao({ i, sugestao = false }) {
    const [r, cor, fundo] = STATUS[i.status] || [i.status, MUTED, "#EEF1F6"];
    return (
      <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${cor}`, borderRadius: 12, padding: 14, marginBottom: 10, opacity: i.ativo ? 1 : 0.55 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
          <span style={{ background: fundo, color: cor, borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 900 }}>{r}</span>
          {i.revisar && <span style={{ background: "#FFF1D6", color: "#9A5B00", borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 900 }}>revisar andamento</span>}
          {sugestao && <span style={{ background: "#F3E6FA", color: "#7A3E9D", borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 900 }}>sugestão da pesquisa — não confirmada</span>}
          {!i.ativo && <span style={{ fontSize: 11, color: MUTED }}>arquivado</span>}
        </div>
        <div style={{ fontWeight: 900, fontSize: 14.5, color: NAVY }}>{i.titulo}</div>
        <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{[i.orgao, i.baseLegal].filter(Boolean).join(" · ")}</div>
        {i.resumo && <div style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 8 }}>{i.resumo}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 10 }}>
          {(i.dataEvento || i.proximaData) && <div style={{ fontSize: 12 }}><b>Datas:</b> {i.dataEvento ? `evento ${dBr(i.dataEvento)}` : ""}{i.proximaData ? ` · próxima ${dBr(i.proximaData)}` : ""}</div>}
          {i.proximoPasso && <div style={{ fontSize: 12 }}><b>Próximo passo:</b> {i.proximoPasso}</div>}
          {i.impactoSistema && <div style={{ fontSize: 12 }}><b>No sistema:</b> {i.impactoSistema}</div>}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>{(i.fontes || []).map((f, k) => <FonteChip key={k} f={f} />)}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10, fontSize: 11, color: MUTED }}>
          <span>Verificado em {dBr(i.verificadoEm)}{i.verificadoPor ? ` por ${i.verificadoPor}` : ""}</span>
          {podeEditar && (
            <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button" style={btn()} onClick={() => editar(i)}>{sugestao ? "Revisar e aprovar" : "Editar"}</button>
              {!sugestao && <button type="button" style={btn()} disabled={!!ocupado} onClick={() => verificar(i)}>Marcar verificado hoje</button>}
              {i.ativo ? <button type="button" style={btn({ color: "#B3261E" })} disabled={!!ocupado} onClick={() => arquivar(i, false)}>{sugestao ? "Descartar" : "Arquivar"}</button> : <button type="button" style={btn()} onClick={() => arquivar(i, true)}>Reativar</button>}
            </span>
          )}
        </div>
      </div>
    );
  }

  const contagem = dados?.contagem || {};
  return (
    <div>
      <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 17, color: NAVY }}>Radar da Reforma Tributária</div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 4, maxWidth: 760 }}>O que está aprovado, em tramitação ou solicitado, com base legal e fonte de cada item. Nada entra sem link de fonte. Itens "APOIO" (imprensa especializada) não substituem a norma: confirme no texto oficial antes de decidir.</div>
          </div>
          <div style={{ fontSize: 11.5, color: MUTED, textAlign: "right" }}>Última verificação<br /><b style={{ color: NAVY }}>{dBr(dados?.ultimaVerificacao)}</b></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {[["painel", "Painel"], ["atualizar", `Atualizar${dados?.sugestoes ? ` (${dados.sugestoes} sugestão)` : ""}`]].map(([k, r]) => <button key={k} type="button" onClick={() => setVista(k)} style={btn({ background: vista === k ? NAVY : WHITE, color: vista === k ? WHITE : NAVY })}>{r}</button>)}
          <button type="button" style={btn()} onClick={carregar}>Recarregar</button>
          {podeEditar && <button type="button" style={btn({ background: CORAL, color: WHITE, border: "none" })} disabled={!!ocupado} onClick={pesquisar}>{ocupado === "pesquisar" ? "Pesquisando fontes oficiais…" : "Pesquisar novidades"}</button>}
        </div>
        {erro && <div style={{ marginTop: 10, color: "#B3261E", fontWeight: 700, fontSize: 12.5 }}>{erro}</div>}
        {msg && <div style={{ marginTop: 10, color: "#1B6E2E", fontWeight: 700, fontSize: 12.5 }}>{msg}</div>}
      </div>

      {vista === "painel" && (
        <>
          {(dados?.alertas || []).length > 0 && (
            <div style={{ background: "#FDE4E1", border: "1px solid #F5B9B1", borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <div style={{ fontWeight: 900, color: "#B3261E", fontSize: 13 }}>Prazos e datas próximas</div>
              {dados.alertas.map((a) => <div key={a.slug} style={{ fontSize: 12.5, marginTop: 4 }}><b>{dBr(a.data)}</b> — {a.titulo} <span style={{ color: MUTED }}>({a.dias < 0 ? `${-a.dias} dia(s) atrás` : a.dias === 0 ? "hoje" : `em ${a.dias} dia(s)`})</span></div>)}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 12 }}>
            {Object.entries(STATUS).map(([k, [r, cor]]) => (
              <button key={k} type="button" onClick={() => setFiltro(filtro === k ? "todos" : k)} style={{ textAlign: "left", cursor: "pointer", border: `1px solid ${filtro === k ? cor : BORDER}`, background: WHITE, borderRadius: 12, padding: "9px 12px" }}>
                <div style={{ fontSize: 10.5, color: MUTED }}>{r}</div><div style={{ fontSize: 26, fontWeight: 900, color: cor }}>{contagem[k] || 0}</div>
              </button>))}
            <button type="button" onClick={() => setFiltro(filtro === "revisar" ? "todos" : "revisar")} style={{ textAlign: "left", cursor: "pointer", border: `1px solid ${filtro === "revisar" ? "#9A5B00" : BORDER}`, background: WHITE, borderRadius: 12, padding: "9px 12px" }}>
              <div style={{ fontSize: 10.5, color: MUTED }}>Revisar andamento</div><div style={{ fontSize: 26, fontWeight: 900, color: "#9A5B00" }}>{confirmados.filter((i) => i.revisar).length}</div>
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar (CBS, Simples, Imposto Seletivo, LC 214…)" style={{ ...campo, maxWidth: 360 }} />
            <label style={{ fontSize: 12, color: MUTED }}><input type="checkbox" checked={arquivados} onChange={(e) => setArquivados(e.target.checked)} /> mostrar arquivados</label>
            <span style={{ fontSize: 12, color: MUTED }}>{visiveis.length} item(ns)</span>
          </div>
          {!dados && !erro && <div style={{ color: MUTED, padding: 16 }}>Carregando…</div>}
          {visiveis.map((i) => <Cartao key={i.slug} i={i} />)}
        </>
      )}

      {vista === "atualizar" && (
        <div>
          {sugestoes.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 900, color: NAVY, marginBottom: 6 }}>Sugestões da pesquisa em fontes oficiais ({sugestoes.length})</div>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>Nada vale até você revisar, conferir a fonte e salvar.</div>
              {sugestoes.map((i) => <Cartao key={i.slug} i={i} sugestao />)}
            </div>
          )}
          {!podeEditar ? <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, color: MUTED }}>Somente administradores podem atualizar o radar.</div> : (
            <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16 }}>
              <div style={{ fontWeight: 900, color: NAVY, fontSize: 15 }}>{form.slug ? "Editar item" : "Novo item"}</div>
              {rot("Título *")}<input style={campo} value={form.titulo} onChange={(e) => setF("titulo", e.target.value)} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
                <div>{rot("Situação *")}<select style={campo} value={form.status} onChange={(e) => setF("status", e.target.value)}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></div>
                <div>{rot("Órgão")}<input style={campo} value={form.orgao} onChange={(e) => setF("orgao", e.target.value)} placeholder="Senado, Receita, CGIBS, TCU…" /></div>
                <div>{rot("Data do evento")}<input type="date" style={campo} value={form.dataEvento} onChange={(e) => setF("dataEvento", e.target.value)} /></div>
                <div>{rot("Próxima data / prazo")}<input type="date" style={campo} value={form.proximaData} onChange={(e) => setF("proximaData", e.target.value)} /></div>
              </div>
              {rot("Base legal (norma, número, data, projeto) *")}<input style={campo} value={form.baseLegal} onChange={(e) => setF("baseLegal", e.target.value)} placeholder="Ex.: LC 214/2025, art. 346; Resolução do Senado nº …" />
              {rot("Resumo")}<textarea style={{ ...campo, minHeight: 80 }} value={form.resumo} onChange={(e) => setF("resumo", e.target.value)} />
              {rot("Próximo passo")}<input style={campo} value={form.proximoPasso} onChange={(e) => setF("proximoPasso", e.target.value)} />
              {rot("Impacto no sistema / nas decisões")}<input style={campo} value={form.impactoSistema} onChange={(e) => setF("impactoSistema", e.target.value)} />
              {rot("Fontes (link https obrigatório; prefira planalto.gov.br, senado.leg.br, camara.leg.br, gov.br, tcu.gov.br, cgibs.gov.br) *")}
              {form.fontes.map((f, k) => (
                <div key={k} style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr auto", gap: 6, marginBottom: 6 }}>
                  <input style={campo} placeholder="Título da fonte" value={f.titulo} onChange={(e) => setF("fontes", form.fontes.map((x, j) => (j === k ? { ...x, titulo: e.target.value } : x)))} />
                  <input style={campo} placeholder="https://…" value={f.url} onChange={(e) => setF("fontes", form.fontes.map((x, j) => (j === k ? { ...x, url: e.target.value } : x)))} />
                  <button type="button" style={btn()} onClick={() => setF("fontes", form.fontes.filter((_, j) => j !== k))}>Remover</button>
                </div>))}
              <button type="button" style={btn()} onClick={() => setF("fontes", [...form.fontes, { titulo: "", url: "" }])}>+ Fonte</button>
              <label style={{ display: "block", marginTop: 12, fontSize: 12.5 }}><input type="checkbox" checked={!!form.revisar} onChange={(e) => setF("revisar", e.target.checked)} /> Marcar como “revisar andamento” (não consegui confirmar a situação atual)</label>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button type="button" style={btn({ background: NAVY, color: WHITE, border: "none" })} disabled={!!ocupado} onClick={salvar}>{ocupado === "salvar" ? "Salvando…" : "Salvar e marcar como verificado"}</button>
                <button type="button" style={btn()} onClick={() => setForm(VAZIO)}>Limpar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
