import React, { useState, useEffect, useMemo } from "react";
import { Users, Activity, Clock3, CheckCircle2, Flame, Search, RefreshCcw } from "lucide-react";

const NAVY = "#17233D";
const CORAL = "#FF6B4A";
const MUTED = "#5B667A";
const WHITE = "#FFFFFF";
const BODY_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

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

export default function LeadsCRM({ token, onAbrirDiagnostico }) {
  const [leads, setLeads] = useState([]);
  const [resumo, setResumo] = useState({});
  const [busca, setBusca] = useState("");
  const [origem, setOrigem] = useState("");
  const [statusDiagnostico, setStatusDiagnostico] = useState("");
  const [responsaveis, setResponsaveis] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  function linkWhatsapp(telefone) {
    const digitsOnly = String(telefone || "").replace(/\D/g, "");
    if (!digitsOnly) return null;
    return `https://wa.me/${digitsOnly.startsWith("55") ? digitsOnly : `55${digitsOnly}`}`;
  }

  async function carregarLeads() {
    setCarregando(true);
    setErro("");
    try {
      const params = new URLSearchParams();
      params.set("limite", "200");
      if (busca.trim()) params.set("busca", busca.trim());
      if (origem) params.set("origem", origem);
      if (statusDiagnostico) params.set("statusDiagnostico", statusDiagnostico);

      const resposta = await fetch(`/api/crm?action=listar-leads&${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resposta.json().catch(() => null);
      if (!resposta.ok || !data?.sucesso) throw new Error(data?.error || "Erro ao carregar leads.");
      setLeads(Array.isArray(data.leads) ? data.leads : []);
      setResumo(data.resumo || {});
    } catch (e) {
      setErro(e?.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregarLeads(); }, []);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 18 }}>
        <Card><Users size={18} color={CORAL} /><div style={{ color: MUTED, fontSize: 10, marginTop: 8 }}>LEADS</div><div style={{ fontSize: 29, fontWeight: 900 }}>{resumo.total ?? 0}</div></Card>
        <Card><Activity size={18} color="#854F0B" /><div style={{ color: MUTED, fontSize: 10, marginTop: 8 }}>EM PREENCHIMENTO</div><div style={{ fontSize: 29, fontWeight: 900 }}>{resumo.emPreenchimento ?? 0}</div></Card>
        <Card><CheckCircle2 size={18} color="#0F6E56" /><div style={{ color: MUTED, fontSize: 10, marginTop: 8 }}>CONCLUÍDOS</div><div style={{ fontSize: 29, fontWeight: 900 }}>{resumo.concluidos ?? 0}</div></Card>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, empresa, CNPJ..." style={{ flex: "1 1 280px", border: "1px solid #D8DEEA", borderRadius: 9, padding: "10px 12px" }} />
          <Botao onClick={carregarLeads}><Search size={14} /> Filtrar</Botao>
        </div>
      </Card>

      {carregando ? (
        <Card>Carregando leads...</Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {leads.map((lead) => (
            <Card key={lead.leadId} style={{ padding: 15 }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,1.5fr) 120px 150px 150px", gap: 14, alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: 13.5 }}>{lead.razaoSocial || lead.nome || "Lead sem identificação"}</strong>
                  <div style={{ fontSize: 10.5, color: MUTED, marginTop: 4 }}>{lead.nome} · {lead.telefone || "Sem telefone"}</div>
                </div>
                <div><span style={{ background: "#EEF0F5", borderRadius: 20, padding: "5px 8px", fontSize: 9.5 }}>{lead.statusDiagnostico}</span></div>
                <div>
                  {linkWhatsapp(lead.telefone) && (
                    <a href={linkWhatsapp(lead.telefone)} target="_blank" rel="noreferrer" style={{ background: "#22C55E", color: WHITE, borderRadius: 8, padding: "6px 10px", textDecoration: "none", fontSize: 11, fontWeight: 800 }}>WhatsApp</a>
                  )}
                </div>
                <div>
                  {lead.diagnosticoId && (
                    <button type="button" onClick={() => onAbrirDiagnostico(lead.diagnosticoId)} style={{ border: 0, background: "transparent", color: CORAL, cursor: "pointer", fontWeight: 800 }}>Abrir diagnóstico →</button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
