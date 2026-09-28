import React, { useState, useEffect } from "react";
import { Target, Activity, CheckCircle2, AlertTriangle, Plus, RefreshCcw, Save, Trash2, Sparkles } from "lucide-react";

const NAVY = "#17233D";
const CORAL = "#FF6B4A";
const MUTED = "#5B667A";
const WHITE = "#FFFFFF";
const BODY_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const DISPLAY_FONT = "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif";

function Card({ children, style = {} }) {
  return <div style={{ background: WHITE, border: "1px solid #E3E7EF", borderRadius: 14, padding: 18, ...style }}>{children}</div>;
}

function Botao({ children, onClick, disabled = false, secundario = false, style = {} }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ border: secundario ? "1px solid #D8DEEA" : "none", background: secundario ? WHITE : CORAL, color: secundario ? NAVY : WHITE, borderRadius: 10, padding: "10px 14px", fontFamily: BODY_FONT, fontSize: 13, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 7, ...style }}>
      {children}
    </button>
  );
}

export default function AtendimentosDepartamento({ token, onAbrirDiagnostico, atendimentoInicialId = "" }) {
  const [atendimentos, setAtendimentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  async function carregarTudo() {
    setCarregando(true);
    setErro("");
    try {
      const resp = await fetch("/api/crm?action=listar-atendimentos", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.sucesso) throw new Error(data?.error || "Erro ao carregar atendimentos.");
      setAtendimentos(Array.isArray(data.atendimentos) ? data.atendimentos : []);
    } catch (e) {
      setErro(e?.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregarTudo(); }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 style={{ fontFamily: DISPLAY_FONT, fontSize: 22, margin: 0 }}>Atendimentos por Área / Departamento</h2>
        <Botao secundario onClick={carregarTudo}><RefreshCcw size={14} /> Atualizar</Botao>
      </div>

      {erro && <div style={{ background: "#FAECE7", color: "#993C1D", padding: 12, borderRadius: 10, marginBottom: 14 }}>{erro}</div>}

      {carregando ? (
        <Card>Carregando tratativas consultivas...</Card>
      ) : atendimentos.length === 0 ? (
        <Card>Nenhum atendimento na fila do especialista.</Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {atendimentos.map((item) => (
            <Card key={item.id}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 150px 120px", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ color: CORAL, fontSize: 10, fontWeight: 900 }}>{item.area}</div>
                  <strong style={{ fontSize: 15 }}>{item.lead?.razaoSocial || item.lead?.nome || "Cliente"}</strong>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Especialista: {item.responsavelNome || "Pendente"}</div>
                </div>
                <div><span style={{ background: "#EEF3FF", color: "#31589C", padding: "4px 8px", borderRadius: 12, fontSize: 10, fontWeight: 800 }}>{item.statusAtendimento}</span></div>
                {item.diagnosticoId && (
                  <button type="button" onClick={() => onAbrirDiagnostico(item.diagnosticoId)} style={{ border: 0, background: "transparent", color: CORAL, cursor: "pointer", fontWeight: 800, fontSize: 11 }}>Ver Diagnóstico</button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
