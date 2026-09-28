import React, { useState, useEffect } from "react";
import { UserPlus, Save, RefreshCcw, Gauge } from "lucide-react";

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
    <button type="button" onClick={onClick} disabled={disabled} style={{ border: secundario ? "1px solid #D8DEEA" : "none", background: secundario ? WHITE : CORAL, color: secundario ? NAVY : WHITE, borderRadius: 10, padding: "10px 14px", fontFamily: BODY_FONT, fontSize: 13, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, ...style }}>
      {children}
    </button>
  );
}

export default function EquipeCapacidade({ token }) {
  const [responsaveis, setResponsaveis] = useState([]);
  const [editandoId, setEditandoId] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [capacidadeDiaria, setCapacidadeDiaria] = useState("3");
  const [areas, setAreas] = useState([]);
  const [perfil, setPerfil] = useState("ESPECIALISTA");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const areasDisponiveis = [
    "Marketing", "Jurídico", "Contábil/Fiscal", "Tributário", "Financeiro", "Administrativo", "Gestão", "Operacional", "RH", "Comercial", "Tecnologia",
  ];

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      const resposta = await fetch("/api/crm?action=listar-responsaveis", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resposta.json().catch(() => null);
      if (!resposta.ok || !data?.sucesso) throw new Error(data?.error || "Não foi possível carregar a equipe.");
      setResponsaveis(Array.isArray(data.responsaveis) ? data.responsaveis : []);
    } catch (error) {
      setErro(error?.message || "Erro ao carregar equipe.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  function alternarArea(area) {
    setAreas((atuais) => atuais.includes(area) ? atuais.filter((item) => item !== area) : [...atuais, area]);
  }

  async function salvar() {
    if (!nome.trim()) { setErro("Informe o nome do responsável."); return; }
    setSalvando(true); setErro(""); setSucesso("");
    try {
      const resposta = await fetch("/api/crm?action=salvar-responsavel", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: editandoId || undefined, nome: nome.trim(), email: email.trim(), telefone: telefone.trim(), areas, capacidadeDiaria: Number(capacidadeDiaria) || 0, perfil, ativo: true }),
      });
      const data = await resposta.json().catch(() => null);
      if (!resposta.ok || !data?.sucesso) throw new Error(data?.error || "Não foi possível salvar o responsável.");
      setEditandoId(""); setNome(""); setEmail(""); setTelefone(""); setCapacidadeDiaria("3"); setAreas([]); setPerfil("ESPECIALISTA");
      setSucesso("Responsável salvo com sucesso.");
      await carregar();
    } catch (error) {
      setErro(error?.message || "Erro ao salvar responsável.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px,.9fr) minmax(0,1.5fr)", gap: 16, alignItems: "start" }}>
        <Card>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
            <UserPlus size={18} color={CORAL} />
            <div>
              <h2 style={{ margin: 0, fontFamily: DISPLAY_FONT, fontSize: 19 }}>Novo responsável</h2>
              <div style={{ fontSize: 10.5, color: MUTED, marginTop: 2 }}>Cadastre quem poderá receber leads.</div>
            </div>
          </div>
          <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, marginBottom: 5 }}>Nome</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Diones" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #D8DEEA", borderRadius: 9, padding: "10px 11px", marginBottom: 10 }} />
          <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, marginBottom: 5 }}>E-mail</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@finder.com.br" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #D8DEEA", borderRadius: 9, padding: "10px 11px", marginBottom: 10 }} />
          <div style={{ fontSize: 10.5, fontWeight: 800, marginBottom: 7 }}>Áreas de atuação</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {areasDisponiveis.map((area) => (
              <button key={area} type="button" onClick={() => alternarArea(area)} style={{ border: areas.includes(area) ? `1px solid ${CORAL}` : "1px solid #D8DEEA", background: areas.includes(area) ? "#FFF3EF" : WHITE, color: areas.includes(area) ? "#993C1D" : NAVY, borderRadius: 20, padding: "6px 9px", fontSize: 9.5, fontWeight: 700, cursor: "pointer" }}>{area}</button>
            ))}
          </div>
          {erro && <div style={{ background: "#FAECE7", color: "#993C1D", borderRadius: 9, padding: 9, fontSize: 10.5, marginBottom: 10 }}>{erro}</div>}
          {sucesso && <div style={{ background: "#E1F5EE", color: "#0F6E56", borderRadius: 9, padding: 9, fontSize: 10.5, marginBottom: 10 }}>{sucesso}</div>}
          <Botao onClick={salvar} disabled={salvando} style={{ width: "100%" }}><Save size={14} />{salvando ? "Salvando..." : "Salvar responsável"}</Botao>
        </Card>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontFamily: DISPLAY_FONT, fontSize: 20 }}>Equipe disponível</h2>
            <Botao secundario onClick={carregar}><RefreshCcw size={14} />Atualizar</Botao>
          </div>
          {carregando ? (
            <Card>Carregando equipe...</Card>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 10 }}>
              {responsaveis.map((responsavel) => (
                <Card key={responsavel.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <strong style={{ fontSize: 13.5 }}>{responsavel.nome}</strong>
                      <div style={{ color: MUTED, fontSize: 10, marginTop: 3 }}>{responsavel.email || "-"}</div>
                    </div>
                    <Gauge size={19} color={CORAL} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
