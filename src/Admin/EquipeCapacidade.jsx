import React, { useState, useEffect } from "react";
import { UserPlus, Save, RefreshCcw, Gauge } from "lucide-react";

const NAVY = "#17233D";
const CORAL = "#FF6B4A";
const MUTED = "#5B667A";
const WHITE = "#FFFFFF";
const BODY_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const DISPLAY_FONT = "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif";

function Card({ children, style = {} }) {
  return (
    <div style={{ background: WHITE, border: "1px solid #E3E7EF", borderRadius: 14, padding: 18, ...style }}>
      {children}
    </div>
  );
}

function Botao({ children, onClick, disabled = false, secundario = false, style = {} }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: secundario ? "1px solid #D8DEEA" : "none",
        background: secundario ? WHITE : CORAL,
        color: secundario ? NAVY : WHITE,
        borderRadius: 10,
        padding: "10px 14px",
        fontFamily: BODY_FONT,
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function normalizarLista(valor) {
  return Array.isArray(valor) ? valor : [];
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
  const [permissoes, setPermissoes] = useState({
    verRelatorioPropriaArea: true,
    verRespostasPropriaArea: true,
    inserirObservacoes: true,
    alterarStatusAtendimento: true,
    verDiagnosticoCompleto: false,
    verEstrategiaComercial: false,
    verValoresPropostas: false,
    verOutrosDepartamentos: false,
  });

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const areasDisponiveis = [
    "Marketing", "Jurídico", "Contábil/Fiscal", "Tributário", "Financeiro", "Administrativo", "Gestão", "Operacional", "RH", "Comercial", "Tecnologia",
    "Patrimônio", "Participações societárias", "Imóveis", "Receitas patrimoniais", "Governança", "Sucessão", "Proteção patrimonial", "Custos da estrutura",
    "Estrutura do grupo", "Financeiro consolidado", "Operações intercompany", "Pessoas compartilhadas", "Operações do grupo",
    "Projeto / empreendimento", "Sócios e investidores", "Aportes e capital", "Contratos", "Riscos do projeto", "Saída / encerramento",
    "Organização financeira", "Fluxo financeiro pessoal", "Endividamento", "Reserva e segurança", "Investimentos", "Aposentadoria", "Proteção familiar", "Tributário PF", "Objetivos",
  ];

  const permissoesDisponiveis = [
    { id: "verRelatorioPropriaArea", label: "Ver relatório da própria área" },
    { id: "verRespostasPropriaArea", label: "Ver respostas da própria área" },
    { id: "inserirObservacoes", label: "Inserir observações" },
    { id: "alterarStatusAtendimento", label: "Alterar status do atendimento" },
    { id: "verDiagnosticoCompleto", label: "Ver diagnóstico completo" },
    { id: "verEstrategiaComercial", label: "Ver estratégia comercial" },
    { id: "verValoresPropostas", label: "Ver valores e propostas" },
    { id: "verOutrosDepartamentos", label: "Ver outros departamentos" },
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
        body: JSON.stringify({ id: editandoId || undefined, nome: nome.trim(), email: email.trim(), telefone: telefone.trim(), areas, capacidadeDiaria: Number(capacidadeDiaria) || 0, perfil, permissoes, ativo: true }),
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

  function editarResponsavel(responsavel) {
    setEditandoId(responsavel.id); setNome(responsavel.nome || ""); setEmail(responsavel.email || ""); setTelefone(responsavel.telefone || "");
    setCapacidadeDiaria(String(responsavel.capacidadeDiaria ?? 3)); setAreas(Array.isArray(responsavel.areas) ? responsavel.areas : []);
    setPerfil(responsavel.perfil || "ESPECIALISTA"); setPermissoes(responsavel.permissoes || permissoes); setSucesso("Editando membro da equipe.");
  }

  async function excluirResponsavelAdmin(responsavel) {
    if (!window.confirm(`Excluir ${responsavel.nome} da equipe?`)) return;
    try {
      let resposta = await fetch("/api/crm?action=excluir-responsavel", {
        method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ responsavelId: responsavel.id }),
      });
      let data = await resposta.json().catch(() => null);
      if (resposta.status === 409 && data?.possuiAtendimentosAbertos) {
        if (!window.confirm(`${responsavel.nome} possui ${data.totalAbertos} atendimento(s) aberto(s). Excluir mesmo assim?`)) return;
        resposta = await fetch("/api/crm?action=excluir-responsavel", {
          method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ responsavelId: responsavel.id, forcar: true }),
        });
        data = await resposta.json().catch(() => null);
      }
      if (!resposta.ok || !data?.sucesso) throw new Error(data?.error || "Não foi possível excluir o membro.");
      await carregar();
    } catch (error) { setErro(error?.message || "Erro ao excluir membro."); }
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
          <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, marginBottom: 5 }}>Telefone</label>
          <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="41999999999" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #D8DEEA", borderRadius: 9, padding: "10px 11px", marginBottom: 10 }} />
          <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, marginBottom: 5 }}>Capacidade diária</label>
          <input type="number" min="0" max="50" value={capacidadeDiaria} onChange={(e) => setCapacidadeDiaria(e.target.value)} style={{ width: "100%", boxSizing: "border-box", border: "1px solid #D8DEEA", borderRadius: 9, padding: "10px 11px", marginBottom: 12 }} />
          <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, marginBottom: 5 }}>Perfil</label>
          <select value={perfil} onChange={(e) => { setPerfil(e.target.value); }} style={{ width: "100%", boxSizing: "border-box", border: "1px solid #D8DEEA", borderRadius: 9, padding: "10px 11px", marginBottom: 12, background: WHITE }}>
            <option value="ESPECIALISTA">Especialista</option>
            <option value="ADMIN">Administrador</option>
          </select>
          <div style={{ fontSize: 10.5, fontWeight: 800, marginBottom: 7 }}>Áreas de atuação</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {areasDisponiveis.map((area) => (
              <button key={area} type="button" onClick={() => alternarArea(area)} style={{ border: areas.includes(area) ? `1px solid ${CORAL}` : "1px solid #D8DEEA", background: areas.includes(area) ? "#FFF3EF" : WHITE, color: areas.includes(area) ? "#993C1D" : NAVY, borderRadius: 20, padding: "6px 9px", fontSize: 9.5, fontWeight: 700, cursor: "pointer" }}>{area}</button>
            ))}
          </div>
          {erro && <div style={{ background: "#FAECE7", color: "#993C1D", borderRadius: 9, padding: 9, fontSize: 10.5, marginBottom: 10 }}>{erro}</div>}
          {sucesso && <div style={{ background: "#E1F5EE", color: "#0F6E56", borderRadius: 9, padding: 9, fontSize: 10.5, marginBottom: 10 }}>{sucesso}</div>}
          <Botao onClick={salvar} disabled={salvando} style={{ width: "100%" }}><Save size={14} />{salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Salvar responsável"}</Botao>
        </Card>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: DISPLAY_FONT, fontSize: 20 }}>Equipe disponível</h2>
              <p style={{ margin: "3px 0 0", fontSize: 10.5, color: MUTED }}>Capacidade configurada e carga atual por responsável.</p>
            </div>
            <Botao secundario onClick={carregar}><RefreshCcw size={14} />Atualizar</Botao>
          </div>
          {carregando ? (
            <Card>Carregando equipe...</Card>
          ) : responsaveis.length === 0 ? (
            <Card>Nenhum responsável cadastrado.</Card>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 10 }}>
              {responsaveis.map((responsavel) => (
                <Card key={responsavel.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                    <div>
                      <strong style={{ fontSize: 13.5 }}>{responsavel.nome}</strong>
                      <div style={{ display: "inline-block", marginTop: 5, background: responsavel.perfil === "ADMIN" ? "#EEF3FF" : "#FFF3EF", color: responsavel.perfil === "ADMIN" ? "#31589C" : "#993C1D", borderRadius: 20, padding: "3px 7px", fontSize: 8.5, fontWeight: 800 }}>{responsavel.perfil || "ESPECIALISTA"}</div>
                      <div style={{ color: MUTED, fontSize: 10, marginTop: 3 }}>{responsavel.email || "-"}</div>
                    </div>
                    <Gauge size={19} color={CORAL} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                    <div style={{ background: "#F7F8FB", borderRadius: 9, padding: 9 }}><div style={{ fontSize: 9, color: MUTED }}>CAPACIDADE/DIA</div><strong style={{ fontSize: 17 }}>{responsavel.capacidadeDiaria}</strong></div>
                    <div style={{ background: "#F7F8FB", borderRadius: 9, padding: 9 }}><div style={{ fontSize: 9, color: MUTED }}>LEADS ABERTOS</div><strong style={{ fontSize: 17 }}>{responsavel.leadsAbertos}</strong></div>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {normalizarLista(responsavel.areas).map((a) => (<span key={a} style={{ background: "#FFF3EF", color: "#993C1D", borderRadius: 20, padding: "3px 7px", fontSize: 9 }}>{a}</span>))}
                  </div>
                  <div style={{ display: "flex", gap: 7, marginTop: 12 }}>
                    <button type="button" onClick={() => editarResponsavel(responsavel)} style={{ flex: 1, border: "1px solid #D8DEEA", background: WHITE, color: NAVY, borderRadius: 8, padding: "7px 9px", fontSize: 9.5, fontWeight: 800, cursor: "pointer" }}>Editar</button>
                    <button type="button" onClick={() => excluirResponsavelAdmin(responsavel)} style={{ flex: 1, border: "1px solid #E2B8B8", background: "#FFF7F7", color: "#A12B2B", borderRadius: 8, padding: "7px 9px", fontSize: 9.5, fontWeight: 800, cursor: "pointer" }}>Excluir</button>
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
