import { useEffect, useMemo, useRef, useState } from "react";
import { baixarExcel } from "./exportarExcel.js";

const NAVY = "#17233D", MUTED = "#5B667A", BORDER = "#E3E7EF", WHITE = "#FFFFFF", CORAL = "#FF6B4A";
const REGIMES = { SIMPLES: "Simples", MEI: "MEI", PRESUMIDO: "Presumido", REAL: "Real", "": "Não identificado" };
const ST = {
  no_prazo: ["Entregue no prazo", "✓", "#1B6E2E", "#E3F4E6"],
  atraso: ["Entregue com atraso", "!", "#9A5B00", "#FFF1D6"],
  faltando: ["Não encontrada na pasta", "✗", "#B3261E", "#FDE4E1"],
  a_vencer: ["Ainda dentro do prazo", "…", "#5B667A", "#EEF1F6"],
  sem_movimento: ["Sem movimento", "SM", "#1D4F91", "#E1ECFA"],
  na: ["Não se aplica", "", "#B8BFCC", "transparent"],
};
const dBr = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "—");
const rotMes = (k) => `${k.slice(5, 7)}/${k.slice(0, 4)}`;
const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function mesesOpcoes() {
  const h = new Date(), out = [];
  for (let i = 1; i <= 12; i++) { const d = new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth() - i, 1)); out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`); }
  return out;
}

// Lê a planilha de controle da carteira SÓ com as colunas cadastrais. Colunas de usuário/senha nunca são lidas.
async function lerPlanilha(arquivo) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await arquivo.arrayBuffer(), { type: "array" });
  const out = new Map();
  for (const nome of wb.SheetNames) {
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, defval: "", raw: false });
    const h = linhas.findIndex((l) => l.some((c) => /^c[oó]d/i.test(norm(c))) && l.some((c) => norm(c) === "regime") && l.some((c) => norm(c) === "nome"));
    if (h < 0) continue;
    const idx = (re) => linhas[h].findIndex((c) => re.test(norm(c)));
    const ic = idx(/^cod/), ik = idx(/^carteira$/), inome = idx(/^nome$/), im = idx(/^movimento$/), ir = idx(/^regime$/), is = idx(/^situacao$/);
    for (const l of linhas.slice(h + 1)) {
      const codigo = String(l[ic] || "").trim();
      if (!/^\d+$/.test(codigo)) continue;
      if (is >= 0 && /baix|rescind|encerr|inativ/.test(norm(l[is]))) continue;
      out.set(codigo, { codigo, carteira: String(l[ik] || "").trim(), nome: String(l[inome] || "").trim(), movimento: String(l[im] || "").trim(), regime: String(l[ir] || "").trim() });
    }
  }
  return [...out.values()];
}

export default function CarteiraGeral({ api, driveLista, carregarDrive, onLerDrive, lendo = "", avisos = [], versao = 0 }) {
  const [comp, setComp] = useState(() => mesesOpcoes()[0]);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [regime, setRegime] = useState("todos");
  const [carteira, setCarteira] = useState("todas");
  const [situacao, setSituacao] = useState("todos");
  const [busca, setBusca] = useState("");
  const arq = useRef(null);

  async function carregar(c = comp) {
    setCarregando(true); setErro("");
    try { setDados(await api("pasta-carteira", null, "GET", { competencia: c })); }
    catch (e) { setErro(e.message); } finally { setCarregando(false); }
  }
  useEffect(() => { carregar(comp); }, [comp, versao]);
  useEffect(() => { if (!driveLista && carregarDrive) carregarDrive(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function importar(e) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setErro(""); setMsg("Lendo a planilha…");
    try {
      const lista = await lerPlanilha(f);
      if (!lista.length) throw new Error("Não achei, na planilha, abas com as colunas CÓD., NOME e REGIME.");
      const r = await api("pasta-carteira-importar", { clientes: lista });
      setMsg(`${r.salvos} clientes importados (código, carteira, nome, movimento e regime). Usuários e senhas da planilha não são lidos nem guardados.`);
      await carregar();
    } catch (er) { setMsg(""); setErro(er.message); }
  }

  const clientes = useMemo(() => {
    const base = dados?.clientes || [];
    const mapa = new Map(base.map((c) => [String(c.codigo), c]));
    for (const d of driveLista?.clientes || []) {
      const k = String(d.codigo);
      if (mapa.has(k)) mapa.set(k, { ...mapa.get(k), driveId: mapa.get(k).driveId || d.id, raiz: d.raiz, nome: mapa.get(k).nome || d.nome });
      else mapa.set(k, { codigo: k, nome: d.nome, carteira: "", movimento: "", regime: "", regimeFonte: "", regimeAuto: "", regimePlanilha: "", regimeManual: "", semLeitura: true, faltando: 0, atraso: 0, noPrazo: 0, semMovimento: 0, aVencer: 0, itens: [], driveId: d.id, raiz: d.raiz });
    }
    return [...mapa.values()].sort((a, b) => (Number(a.codigo) - Number(b.codigo)) || String(a.codigo).localeCompare(String(b.codigo)));
  }, [dados, driveLista]);
  const doDrive = (driveLista?.clientes || []);
  const alvoDrive = (c) => { const d = doDrive.find((x) => String(x.codigo) === String(c.codigo)); return d || null; };
  async function trocarRegime(c, valor) {
    setErro("");
    try { await api("pasta-carteira-regime", { codigo: c.codigo, nome: c.nome, regime: valor }); await carregar(); }
    catch (e) { setErro(e.message); }
  }
  const obrig = dados?.obrigacoes || [];
  const carteiras = useMemo(() => [...new Set(clientes.map((c) => c.carteira).filter(Boolean))].sort(), [clientes]);
  const filtrados = useMemo(() => clientes.filter((c) => {
    if (regime !== "todos" && c.regime !== (regime === "ND" ? "" : regime)) return false;
    if (carteira !== "todas" && c.carteira !== carteira) return false;
    if (situacao === "pendente" && !(c.faltando + c.atraso)) return false;
    if (situacao === "ok" && (c.faltando + c.atraso || c.semLeitura)) return false;
    if (situacao === "semleitura" && !c.semLeitura) return false;
    if (busca && !norm(`${c.codigo} ${c.nome}`).includes(norm(busca))) return false;
    return true;
  }), [clientes, regime, carteira, situacao, busca]);

  const colunas = obrig.filter((o) => regime === "todos" ? clientes.some((c) => c.itens.find((i) => i.key === o.key && i.status !== "na")) : o.regimes.includes(regime === "MEI" ? "SIMPLES" : regime));
  const cont = (r) => clientes.filter((c) => c.regime === r).length;
  const pendTotal = clientes.filter((c) => c.faltando + c.atraso > 0).length;

  function exportar() {
    const linhas = [["Cód.", "Carteira", "Cliente", "Regime", "Movimento", ...colunas.map((o) => o.rotulo), "Não entregues", "Com atraso", "Última auditoria da pasta"]];
    for (const c of filtrados) linhas.push([c.codigo, c.carteira, c.nome, REGIMES[c.regime], c.movimento, ...colunas.map((o) => { const i = c.itens.find((x) => x.key === o.key); return i ? `${ST[i.status][0]}${i.postadoEm ? ` (${dBr(i.postadoEm)})` : ""}` : ""; }), c.faltando, c.atraso, c.auditadoEm ? dBr(c.auditadoEm) : "não auditada"]);
    baixarExcel(`visao_geral_carteira_${comp}.xlsx`, [{ nome: "Visão geral", linhas, larguras: [7, 9, 38, 14, 11, ...colunas.map(() => 22), 12, 12, 18] }]);
  }

  const sel = { padding: 7, borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 12.5, background: WHITE };
  return (
    <div>
      <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>Visão geral por cliente</div>
        <div style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>Cada cliente com o regime e as obrigações do mês (modelo da planilha de controle da carteira), conferidas pelo que está na pasta do Drive. Tudo vem da leitura das pastas no Drive (botão “Ler pastas”); a planilha é opcional.</div>
        <div className="nao-imprimir" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
          <label style={{ fontSize: 12.5 }}>Competência <select value={comp} onChange={(e) => setComp(e.target.value)} style={sel}>{mesesOpcoes().map((m) => <option key={m} value={m}>{rotMes(m)}</option>)}</select></label>
          <button type="button" onClick={() => carregar()} style={{ ...sel, cursor: "pointer", fontWeight: 800 }}>{carregando ? "Atualizando…" : "Atualizar"}</button>
          <button type="button" disabled={!!lendo || !doDrive.length} onClick={() => onLerDrive(doDrive.filter((d) => { const c = clientes.find((x) => String(x.codigo) === String(d.codigo)); return !c || c.semLeitura; }))} style={{ ...sel, cursor: "pointer", fontWeight: 800, background: CORAL, color: WHITE, border: "none" }}>Ler pastas ainda não lidas ({clientes.filter((c) => c.semLeitura && alvoDrive(c)).length})</button>
          <button type="button" disabled={!!lendo || !doDrive.length} onClick={() => { if (window.confirm(`Reler as ${doDrive.length} pastas do Drive? Pode levar vários minutos.`)) onLerDrive(doDrive); }} style={{ ...sel, cursor: "pointer", fontWeight: 800 }}>Reler todas pelo Drive</button>
          <button type="button" onClick={() => arq.current?.click()} style={{ ...sel, cursor: "pointer", fontWeight: 800, color: NAVY }}>Importar planilha (opcional)</button>
          <input ref={arq} type="file" accept=".xlsx,.xls" onChange={importar} style={{ display: "none" }} />
          <button type="button" onClick={exportar} disabled={!filtrados.length} style={{ ...sel, cursor: "pointer", fontWeight: 800, background: NAVY, color: WHITE, border: "none" }}>Exportar Excel</button>
        </div>
        {lendo && <div style={{ marginTop: 10, fontSize: 12.5, color: NAVY, fontWeight: 800 }}>{lendo}</div>}
        {avisos.length > 0 && <details style={{ marginTop: 8, fontSize: 12, color: "#9A5B00" }}><summary>{avisos.length} aviso(s) da leitura</summary>{avisos.map((a, i) => <div key={i}>{a}</div>)}</details>}
        {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: "#1B6E2E", fontWeight: 700 }}>{msg}</div>}
        {erro && <div style={{ marginTop: 10, fontSize: 12.5, color: "#B3261E", fontWeight: 700 }}>{erro}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 12 }}>
        {[["Clientes", clientes.length, NAVY, () => setRegime("todos")], ["Simples / MEI", cont("SIMPLES") + cont("MEI"), NAVY, () => setRegime("SIMPLES")], ["Presumido", cont("PRESUMIDO"), NAVY, () => setRegime("PRESUMIDO")], ["Real", cont("REAL"), NAVY, () => setRegime("REAL")], ["Regime não identificado", cont(""), "#9A5B00", () => setRegime("ND")], ["Com pendência no mês", pendTotal, "#B3261E", () => setSituacao("pendente")]].map(([r, v, c, f]) => (
          <button key={r} type="button" onClick={f} style={{ textAlign: "left", cursor: "pointer", border: `1px solid ${BORDER}`, background: WHITE, borderRadius: 12, padding: "8px 12px" }}>
            <div style={{ fontSize: 10.5, color: MUTED }}>{r}</div><div style={{ fontSize: 24, fontWeight: 900, color: c }}>{v}</div>
          </button>))}
      </div>

      <div className="nao-imprimir" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <select value={regime} onChange={(e) => setRegime(e.target.value)} style={sel}><option value="todos">Todos os regimes</option><option value="SIMPLES">Simples</option><option value="MEI">MEI</option><option value="PRESUMIDO">Presumido</option><option value="REAL">Real</option><option value="ND">Não identificado</option></select>
        <select value={carteira} onChange={(e) => setCarteira(e.target.value)} style={sel}><option value="todas">Todas as carteiras</option>{carteiras.map((c) => <option key={c} value={c}>Carteira {c}</option>)}</select>
        <select value={situacao} onChange={(e) => setSituacao(e.target.value)} style={sel}><option value="todos">Todas as situações</option><option value="pendente">Com pendência</option><option value="ok">Em dia</option><option value="semleitura">Pasta ainda não auditada</option></select>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente ou código" style={{ ...sel, minWidth: 190 }} />
        <span style={{ fontSize: 12, color: MUTED, alignSelf: "center" }}>{filtrados.length} de {clientes.length}</span>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11.5, color: MUTED, marginBottom: 8 }}>
        {["no_prazo", "atraso", "faltando", "a_vencer", "sem_movimento"].map((k) => <span key={k}><span style={{ background: ST[k][3], color: ST[k][2], borderRadius: 6, padding: "1px 7px", fontWeight: 900 }}>{ST[k][1]}</span> {ST[k][0]}</span>)}
      </div>

      <div style={{ overflowX: "auto", background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F6F8FB", textAlign: "left" }}>
              {["Cód.", "Cliente", "Regime", "Mov."].map((t) => <th key={t} style={{ padding: "9px 10px", whiteSpace: "nowrap", position: "sticky", top: 0 }}>{t}</th>)}
              {colunas.map((o) => <th key={o.key} style={{ padding: "9px 6px", textAlign: "center", whiteSpace: "nowrap" }} title={o.tipo === "guia" ? "Guia" : "Declaração"}>{o.rotulo}</th>)}
              <th style={{ padding: "9px 10px", textAlign: "center" }}>Pend.</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <tr key={c.codigo} style={{ borderTop: `1px solid ${BORDER}` }}>
                <td style={{ padding: "7px 10px", fontWeight: 800 }}>{c.codigo}</td>
                <td style={{ padding: "7px 10px", minWidth: 220 }}>{c.nome || "—"}{c.carteira ? <span style={{ color: MUTED, fontSize: 11 }}> · {c.carteira}</span> : null}{c.semLeitura ? <div style={{ fontSize: 10.5, color: "#9A5B00" }}>pasta ainda não auditada nesta versão</div> : null}</td>
                <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                  <select value={c.regimeManual || ""} onChange={(e) => trocarRegime(c, e.target.value)} title="Automático = pela movimentação da pasta no Drive. Escolha um regime para fixar manualmente." style={{ ...sel, padding: "3px 4px", fontWeight: 800, color: c.regime ? NAVY : "#9A5B00", maxWidth: 150 }}>
                    <option value="">{c.regimeAuto || c.regimePlanilha ? `Auto: ${REGIMES[c.regimeAuto || c.regimePlanilha]}` : "Auto: não identificado"}</option>
                    <option value="SIMPLES">Simples</option><option value="MEI">MEI</option><option value="PRESUMIDO">Presumido</option><option value="REAL">Real</option>
                  </select>
                  <span style={{ fontSize: 10, color: MUTED }}> {c.regimeFonte === "manual" ? "manual" : c.regimeFonte === "pasta" ? "pela pasta" : c.regimeFonte === "planilha" ? "planilha" : ""}</span>
                </td>
                <td style={{ padding: "7px 10px", color: MUTED }}>{c.movimento || "—"}</td>
                {colunas.map((o) => {
                  const i = c.itens.find((x) => x.key === o.key); const s = ST[i?.status || "na"];
                  const dica = i ? `${o.rotulo} · ${s[0]} · prazo ${dBr(i.prazo)}${i.postadoEm ? ` · entrou na pasta em ${dBr(i.postadoEm)}` : ""}${i.diasAtraso ? ` (${i.diasAtraso} dia(s) de atraso)` : ""}${i.arquivo ? ` · ${i.arquivo}` : ""}` : "";
                  return <td key={o.key} title={dica} style={{ padding: "5px 4px", textAlign: "center" }}>{s[1] ? <span style={{ display: "inline-block", minWidth: 26, background: s[3], color: s[2], borderRadius: 6, padding: "2px 6px", fontWeight: 900, fontSize: 12 }}>{s[1]}</span> : <span style={{ color: s[2] }}>·</span>}</td>;
                })}
                <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 900, color: c.faltando + c.atraso ? "#B3261E" : "#1B6E2E" }}>{c.semLeitura ? "—" : c.faltando + c.atraso}</td>
              </tr>))}
            {!filtrados.length && <tr><td colSpan={5 + colunas.length} style={{ padding: 22, textAlign: "center", color: MUTED }}>{carregando ? "Carregando…" : clientes.length ? "Nenhum cliente neste filtro." : "Nenhum cliente carregado ainda. Use “Ler pastas ainda não lidas” para trazer os clientes e as obrigações direto do Drive."}</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>Uma obrigação só aparece como “não encontrada” quando a empresa já tem esse tipo de documento em outros meses (ou é uma declaração principal do regime). O regime é preenchido sozinho pela movimentação da pasta (PGDAS/DAS = Simples; MIT, EFD, DARF de IRPJ/PIS/COFINS = Presumido); use a caixa do regime para fixar outro. A planilha só entra se a pasta não mostrar nada.</div>
    </div>
  );
}
