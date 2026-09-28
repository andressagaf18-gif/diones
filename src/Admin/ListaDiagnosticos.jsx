import React, { useState, useEffect, useMemo } from "react";
import { Search, RefreshCcw, AlertTriangle, ChevronRight, Download, Archive, ArchiveRestore, Trash2 } from "lucide-react";

const NAVY = "#17233D";
const CORAL = "#FF6B4A";
const MUTED = "#5B667A";
const WHITE = "#FFFFFF";
const BG = "#F3F5F8";
const BODY_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const DISPLAY_FONT = "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif";

function Card({ children, style = {} }) {
  return <div style={{ background: WHITE, border: "1px solid #E3E7EF", borderRadius: 14, padding: 18, ...style }}>{children}</div>;
}

function Botao({ children, onClick, disabled = false, secundario = false, style = {} }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ border: secundario ? "1px solid #D8DEEA" : "none", background: secundario ? WHITE : CORAL, color: secundario ? NAVY : WHITE, borderRadius: 10, padding: "10px 14px", fontFamily: BODY_FONT, fontSize: 13, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, ...style }}>
      {children}
    </button>
  );
}

function formatarData(valor) {
  if (!valor) return "-";
  try { return new Date(valor).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); } catch { return String(valor); }
}

function formatarCnpj(valor = "") {
  const digits = String(valor).replace(/\D/g, "");
  if (digits.length !== 14) return valor || "-";
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function scoreInfo(score) {
  const numero = Number(score);
  if (!Number.isFinite(numero)) return { label: "Sem score", color: MUTED, bg: "#EEF0F5" };
  if (numero >= 80) return { label: "Bom", color: "#0F6E56", bg: "#E1F5EE" };
  if (numero >= 60) return { label: "Atenção", color: "#854F0B", bg: "#FAEEDA" };
  if (numero >= 40) return { label: "Crítico", color: "#993C1D", bg: "#FAECE7" };
  return { label: "Emergencial", color: "#791F1F", bg: "#FCEBEB" };
}

function normalizarLista(valor) { return Array.isArray(valor) ? valor : []; }

const ESTRUTURAS_DIAGNOSTICO = [
  { id: "operacional", label: "Empresa operacional" },
  { id: "reforma_tributaria", label: "Diagnóstico da Reforma Tributária" },
  { id: "simulador_reforma", label: "Simulador Reforma" },
  { id: "holding", label: "Holding" },
  { id: "avaliar_holding", label: "Avaliação de Holding" },
  { id: "grupo", label: "Grupo empresarial" },
  { id: "spe", label: "SPE" },
  { id: "pessoa_fisica", label: "Pessoa Física" },
];

function normalizarEstruturaDiagnostico(valor = "") {
  const bruto = String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  const aliases = { empresa: "operacional", empresa_operacional: "operacional", operacional: "operacional", reforma: "reforma_tributaria", reforma_tributaria: "reforma_tributaria", ibs_cbs: "reforma_tributaria", simulador_reforma: "simulador_reforma", holding: "holding", avaliar_holding: "avaliar_holding", grupo: "grupo", spe: "spe", pessoa_fisica: "pessoa_fisica", pf: "pessoa_fisica" };
  return aliases[bruto] || bruto || "operacional";
}

function estruturaDiagnostico(item = {}) {
  const direto = item.estruturaNegocio || item.estrutura_negocio || item?.perfil?.estruturaNegocio || item?.perfil?.estrutura_negocio || item?.resultado?.estruturaNegocio || "";
  if (direto) return normalizarEstruturaDiagnostico(direto);
  return "operacional";
}

function labelEstruturaDiagnostico(valor) {
  const id = normalizarEstruturaDiagnostico(valor);
  return ESTRUTURAS_DIAGNOSTICO.find((item) => item.id === id)?.label || valor || "Empresa operacional";
}

function corEstruturaDiagnostico(valor) {
  const id = normalizarEstruturaDiagnostico(valor);
  const mapa = {
    operacional: { bg: "#EEF3FF", color: "#31589C" }, reforma_tributaria: { bg: "#FFF0EB", color: "#B54708" },
    simulador_reforma: { bg: "#EEF8F3", color: "#176B47" }, holding: { bg: "#FFF3EF", color: "#993C1D" },
    avaliar_holding: { bg: "#FAEEDA", color: "#854F0B" }, grupo: { bg: "#E1F5EE", color: "#0F6E56" },
    spe: { bg: "#F3EEFF", color: "#6843A3" }, pessoa_fisica: { bg: "#F1F3F7", color: NAVY },
  };
  return mapa[id] || mapa.operacional;
}

export default function ListaDiagnosticos({ token, onAbrir, onLogout }) {
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [estruturaFiltro, setEstruturaFiltro] = useState("");
  const [arquivamentoDiagnosticos, setArquivamentoDiagnosticos] = useState("ATIVOS");
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState("");
  const [processandoId, setProcessandoId] = useState("");

  async function carregar(termo = "") {
    setCarregando(true);
    setErro("");
    try {
      const params = new URLSearchParams();
      params.set("limite", "100");
      params.set("offset", "0");
      params.set("arquivamento", arquivamentoDiagnosticos);
      if (termo.trim()) params.set("busca", termo.trim());

      const resposta = await fetch(`/api/diagnosticos?action=listar&${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resposta.json().catch(() => null);
      if (!resposta.ok || !data?.sucesso) throw new Error(data?.error || "Não foi possível carregar os diagnósticos.");
      setDiagnosticos(Array.isArray(data.diagnosticos) ? data.diagnosticos : []);
      setTotal(Number(data.total) || 0);
    } catch (error) {
      setErro(error?.message || "Erro ao carregar diagnósticos.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(""); }, [arquivamentoDiagnosticos]);

  async function acaoDiagnostico(item, action) {
    const excluir = action === "excluir";
    const msg = excluir ? `Excluir definitivamente o diagnóstico de "${item.razaoSocial || item.nome || "cliente"}"?` : item.arquivado ? "Desarquivar este diagnóstico?" : "Arquivar este diagnóstico?";
    if (!window.confirm(msg)) return;
    setProcessandoId(item.id);
    try {
      const res = await fetch(`/api/diagnosticos?action=${excluir ? "excluir" : item.arquivado ? "desarquivar" : "arquivar"}`, {
        method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ diagnosticoId: item.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.sucesso) throw new Error(data?.error || "Falha na operação.");
      await carregar(buscaAplicada);
    } catch (e) { setErro(e?.message); } finally { setProcessandoId(""); }
  }

  const diagnosticosFiltrados = useMemo(() => {
    if (!estruturaFiltro) return diagnosticos;
    return diagnosticos.filter((i) => estruturaDiagnostico(i) === estruturaFiltro);
  }, [diagnosticos, estruturaFiltro]);

  const mediaScore = useMemo(() => {
    const scores = diagnosticosFiltrados.map((d) => Number(d.score)).filter(Number.isFinite);
    if (!scores.length) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [diagnosticosFiltrados]);

  async function exportarExcel() {
    if (exportando) return;
    setExportando(true); setErro("");
    try {
      const XLSX = await import("xlsx");
      const res = await fetch("/api/diagnosticos?action=exportar", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.sucesso) throw new Error(data?.error || "Erro na exportação.");
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data.diagnosticos || []);
      XLSX.utils.book_append_sheet(wb, ws, "Diagnosticos");
      XLSX.writeFile(wb, `diagnosticos-finder-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) { setErro(e?.message); } finally { setExportando(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: BODY_FONT, color: NAVY }}>
      <header style={{ background: NAVY, color: WHITE, padding: "18px 28px" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0, fontFamily: DISPLAY_FONT, fontSize: 24 }}>Diagnósticos</h1>
          <button onClick={onLogout} style={{ background: "transparent", border: "1px solid rgba(255,255,255,.3)", color: WHITE, borderRadius: 9, padding: "8px 11px", cursor: "pointer" }}>Sair</button>
        </div>
      </header>

      <main style={{ maxWidth: 1320, margin: "0 auto", padding: "26px 22px 50px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 20 }}>
          <Card><div style={{ color: MUTED, fontSize: 11 }}>DIAGNÓSTICOS</div><div style={{ fontSize: 30, fontWeight: 800 }}>{total}</div></Card>
          <Card><div style={{ color: MUTED, fontSize: 11 }}>EXIBIDOS</div><div style={{ fontSize: 30, fontWeight: 800 }}>{diagnosticosFiltrados.length}</div></Card>
          <Card><div style={{ color: MUTED, fontSize: 11 }}>SCORE MÉDIO</div><div style={{ fontSize: 30, fontWeight: 800 }}>{mediaScore ?? "-"}</div></Card>
        </div>

        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => e.key === "Enter" && carregar(busca)} placeholder="Buscar empresa, CNPJ, e-mail..." style={{ flex: "1 1 360px", border: "1px solid #D8DEEA", borderRadius: 9, padding: "10px 12px" }} />
            <Botao onClick={() => carregar(busca)}><Search size={14} /> Buscar</Botao>
            <Botao secundario onClick={exportarExcel} disabled={exportando}><Download size={14} /> {exportando ? "Exportando..." : "Exportar Excel"}</Botao>
          </div>
        </Card>

        {erro && <div style={{ background: "#FAECE7", color: "#993C1D", padding: 13, borderRadius: 10, marginBottom: 14 }}>{erro}</div>}

        {carregando ? (
          <Card>Carregando diagnósticos...</Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {diagnosticosFiltrados.map((item) => {
              const score = scoreInfo(item.score);
              const cor = corEstruturaDiagnostico(estruturaDiagnostico(item));
              return (
                <div key={item.id} onClick={() => onAbrir(item.id)} style={{ background: WHITE, border: "1px solid #E2E6EE", borderRadius: 14, padding: 16, cursor: "pointer", display: "grid", gridTemplateColumns: "minmax(250px,2fr) minmax(180px,1.2fr) 90px 34px", gap: 15, alignItems: "center" }}>
                  <div>
                    <span style={{ background: cor.bg, color: cor.color, borderRadius: 20, padding: "4px 8px", fontSize: 9, fontWeight: 900 }}>{labelEstruturaDiagnostico(estruturaDiagnostico(item))}</span>
                    <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4 }}>{item.razaoSocial || item.nome || "Empresa não informada"}</div>
                    <div style={{ fontSize: 11.5, color: MUTED }}>{formatarCnpj(item.cnpj)}</div>
                  </div>
                  <div><div style={{ fontSize: 12, fontWeight: 700 }}>{item.nome || "-"}</div><div style={{ fontSize: 10.5, color: MUTED }}>{item.email || "-"}</div></div>
                  <div style={{ textAlign: "center", background: score.bg, color: score.color, borderRadius: 12, padding: "8px 6px" }}><strong>{item.score ?? "-"}</strong><div style={{ fontSize: 8.5 }}>{score.label}</div></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => acaoDiagnostico(item, "arquivar")} style={{ border: 0, background: "transparent", cursor: "pointer" }}>{item.arquivado ? <ArchiveRestore size={15} /> : <Archive size={15} />}</button>
                    <button type="button" onClick={() => acaoDiagnostico(item, "excluir")} style={{ border: 0, background: "transparent", color: "#A12B2B", cursor: "pointer" }}><Trash2 size={15} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
