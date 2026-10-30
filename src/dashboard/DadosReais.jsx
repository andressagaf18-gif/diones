// src/dashboard/DadosReais.jsx
// Aba "Dados reais" do dashboard: funil e receita só com dados reais, limpeza
// (arquivar testes e incompletos — nunca exclui) e e-mail de recuperação de abandono.
// Dados: /api/crm?action=higiene (GET resumo; POST simula/executa).

import { useCallback, useEffect, useState } from "react";

const NAVY = "#17233D";
const CORAL = "#FF6B4A";
const MUTED = "#5B667A";
const BORDER = "#E3E7EF";
const VERDE = "#0F6E56";
const AMBAR = "#8A5A00";

const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (a, b) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
const dataHora = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

async function chamar(metodo, corpo) {
  const token = sessionStorage.getItem("finder_admin_token") || "";
  const r = await fetch("/api/crm?action=higiene", {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, ...(corpo ? { "Content-Type": "application/json" } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d || d.sucesso === false) throw new Error(d?.error || `HTTP ${r.status}`);
  return d;
}

function Cartao({ titulo, subtitulo, children, destaque }) {
  return (
    <section style={{ background: "#fff", border: `1px solid ${BORDER}`, borderLeft: destaque ? `4px solid ${CORAL}` : `1px solid ${BORDER}`, borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
      <h3 style={{ margin: "0 0 2px", fontSize: 14, color: NAVY }}>{titulo}</h3>
      {subtitulo ? <p style={{ margin: "0 0 10px", fontSize: 11, color: MUTED, lineHeight: 1.5 }}>{subtitulo}</p> : null}
      {children}
    </section>
  );
}

function Botao({ children, onClick, desabilitado, primario }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      style={{
        border: primario ? "1px solid transparent" : "1px solid #D8DEEA",
        background: primario ? CORAL : "#fff",
        color: primario ? "#fff" : NAVY,
        borderRadius: 10,
        padding: "8px 13px",
        fontSize: 12,
        fontWeight: 800,
        fontFamily: "inherit",
        cursor: desabilitado ? "not-allowed" : "pointer",
        opacity: desabilitado ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

export default function DadosReais() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [antesDe, setAntesDe] = useState("");
  const [incompletos, setIncompletos] = useState(true);
  const [previa, setPrevia] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      setDados(await chamar("GET"));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function limpeza(executar) {
    setOcupado(true);
    setAviso("");
    try {
      const r = await chamar("POST", { tarefa: "limpeza", executar, antesDe: antesDe || undefined, incluirIncompletos: incompletos });
      if (executar) {
        setPrevia(null);
        setAviso(`Pronto: ${r.limpeza.arquivados} registro(s) arquivado(s), ${r.limpeza.pagamentosMarcados || 0} cobrança(s) marcada(s) como teste. Nada foi excluído.`);
        await carregar();
      } else {
        setPrevia(r.limpeza);
      }
    } catch (e) {
      setAviso(`Não foi possível concluir: ${e.message}`);
    } finally {
      setOcupado(false);
    }
  }

  async function abandono(executar) {
    if (executar && !window.confirm("Enviar agora o e-mail de retomada para os leads elegíveis? Cada lead recebe uma única vez.")) return;
    setOcupado(true);
    setAviso("");
    try {
      const r = await chamar("POST", { tarefa: "abandono", executar });
      const a = r.abandono;
      setAviso(
        a.erro
          ? a.erro
          : executar
          ? `E-mails enviados: ${a.enviados}${a.falhas ? ` · falhas: ${a.falhas}` : ""}.`
          : `${a.elegiveis} lead(s) receberiam o e-mail agora.`
      );
      if (executar) await carregar();
    } catch (e) {
      setAviso(`Não foi possível concluir: ${e.message}`);
    } finally {
      setOcupado(false);
    }
  }

  if (carregando && !dados) return <p style={{ fontSize: 12, color: MUTED }}>Carregando dados reais…</p>;
  if (erro && !dados) return <p role="alert" style={{ fontSize: 12, color: "#B3261E" }}>{erro}</p>;
  if (!dados) return null;

  const f = dados.funil || {};
  const fin = dados.financeiro || { real: {}, teste: {} };
  const sug = dados.limpezaSugerida || {};
  const ab = dados.abandono || {};
  const etapas = [
    ["Acessaram", f.acessaram],
    ["Informaram contato", f.informaramContato],
    ["Concluíram o diagnóstico", f.concluiram],
    ["Pagaram", f.pagaram],
  ];

  return (
    <div>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: MUTED, lineHeight: 1.55 }}>
        Visão só com <b>dados reais</b>: leads arquivados e cobranças de teste ficam fora dos números do dashboard e do financeiro. Nada é excluído — dá para desarquivar o lead no CRM.
      </p>

      {aviso ? <div role="status" style={{ background: "#EEF3FF", border: "1px solid #D5E0FA", borderRadius: 10, padding: "9px 12px", fontSize: 12, color: NAVY, marginBottom: 12 }}>{aviso}</div> : null}

      <Cartao titulo="Funil real" subtitulo={`${dados.leads?.ativos ?? 0} leads ativos · ${dados.leads?.arquivados ?? 0} arquivados (fora desta conta)`}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          {etapas.map(([rot, v], i) => (
            <div key={rot} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: MUTED, textTransform: "uppercase" }}>{rot}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: NAVY }}>{v ?? 0}</div>
              <div style={{ fontSize: 10.5, color: MUTED }}>{i === 0 ? "base do funil" : `${pct(v, etapas[i - 1][1])} da etapa anterior`}</div>
            </div>
          ))}
        </div>
      </Cartao>

      <Cartao titulo="Receita real × teste" subtitulo="O financeiro do dashboard soma apenas a coluna 'Real'.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          <div style={{ border: `1px solid ${BORDER}`, borderLeft: `4px solid ${VERDE}`, borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: VERDE }}>REAL</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: NAVY }}>{moeda(fin.real?.bruto)}</div>
            <div style={{ fontSize: 11, color: MUTED }}>{fin.real?.recebidos || 0} pagamento(s) · líquido {moeda(fin.real?.liquido)}</div>
          </div>
          <div style={{ border: `1px solid ${BORDER}`, borderLeft: `4px solid ${AMBAR}`, borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: AMBAR }}>TESTE (fora dos totais)</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: NAVY }}>{moeda(fin.teste?.bruto)}</div>
            <div style={{ fontSize: 11, color: MUTED }}>{fin.teste?.cobrancas || 0} cobrança(s) marcada(s)</div>
          </div>
        </div>
      </Cartao>

      <Cartao
        destaque
        titulo="Limpeza dos dados"
        subtitulo="Arquiva leads de teste (nome/e-mail com 'teste', 'fake', 'exemplo'…) e leads incompletos parados há mais de 7 dias. Roda sozinha todo dia; aqui você pode simular e executar na hora. Leads com pagamento real ou atendimento comercial avançado nunca são arquivados pela rotina automática."
      >
        <p style={{ margin: "0 0 10px", fontSize: 12, color: NAVY }}>
          Pela regra automática, hoje seriam arquivados: <b>{sug.candidatos ?? 0}</b> ({sug.testes ?? 0} de teste · {sug.incompletos ?? 0} incompletos).
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: NAVY }}>
            Considerar teste tudo criado antes de{" "}
            <input type="date" value={antesDe} onChange={(e) => { setAntesDe(e.target.value); setPrevia(null); }} style={{ border: "1px solid #D8DEEA", borderRadius: 8, padding: "6px 8px", fontFamily: "inherit", fontSize: 12 }} />
          </label>
          <label style={{ fontSize: 12, color: NAVY, display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={incompletos} onChange={(e) => { setIncompletos(e.target.checked); setPrevia(null); }} />
            Incluir incompletos há mais de 7 dias
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Botao onClick={() => limpeza(false)} desabilitado={ocupado}>Simular</Botao>
          <Botao
            primario
            desabilitado={ocupado || !previa || !previa.candidatos}
            onClick={() => {
              if (window.confirm(`Arquivar ${previa.candidatos} registro(s)? Nada é excluído e dá para desarquivar depois.${previa.comPagamentoReal ? `\n\nAtenção: ${previa.comPagamentoReal} deles têm pagamento confirmado e passarão a contar como teste.` : ""}`)) limpeza(true);
            }}
          >
            Arquivar agora{previa ? ` (${previa.candidatos})` : ""}
          </Botao>
        </div>
        {previa ? (
          <div style={{ marginTop: 12, fontSize: 12, color: NAVY }}>
            <b>Prévia:</b> {previa.candidatos} registro(s) — {previa.testes} teste · {previa.incompletos} incompletos
            {previa.comPagamentoReal ? <span style={{ color: AMBAR }}> · {previa.comPagamentoReal} com pagamento confirmado</span> : null}
            {previa.amostra?.length ? (
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: MUTED }}>
                {previa.amostra.map((a) => (
                  <li key={a.id}>{a.nome} · {a.origem} · {a.motivo}{a.pagoReal ? " · com pagamento" : ""} · {dataHora(a.criadoEm)}</li>
                ))}
                {previa.candidatos > previa.amostra.length ? <li>… e mais {previa.candidatos - previa.amostra.length}</li> : null}
              </ul>
            ) : null}
          </div>
        ) : null}
        {!dados.cronConfigurado ? (
          <p style={{ margin: "12px 0 0", fontSize: 11, color: AMBAR }}>A rotina diária ainda não está ativa: falta configurar a variável CRON_SECRET na Vercel.</p>
        ) : null}
      </Cartao>

      <Cartao
        titulo="Recuperação de abandono"
        subtitulo={`E-mail único para quem informou o contato e parou no meio do diagnóstico, de ${ab.janelaHoras?.min ?? 2}h a ${ab.janelaHoras?.max ?? 48}h depois da última atividade. Só com aceite dos termos e e-mail válido.`}
      >
        <p style={{ margin: "0 0 10px", fontSize: 12, color: NAVY }}>
          Rotina automática: <b style={{ color: ab.ativoNaRotina ? VERDE : AMBAR }}>{ab.ativoNaRotina ? "ligada" : "desligada"}</b> · elegíveis agora: <b>{ab.elegiveisAgora ?? 0}</b> · enviados nos últimos 7 dias: <b>{ab.enviadosUltimos7Dias ?? 0}</b>
        </p>
        {!ab.ativoNaRotina ? (
          <p style={{ margin: "0 0 10px", fontSize: 11, color: AMBAR }}>Para ligar o envio automático, configure RECUPERACAO_ABANDONO_ATIVA=true (e CRON_SECRET) na Vercel.</p>
        ) : null}
        {ab.amostra?.length ? (
          <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 11.5, color: MUTED }}>
            {ab.amostra.map((a) => (
              <li key={a.id}>{a.nome || "Sem nome"} · parou em "{a.etapa || "diagnóstico"}" · {a.progresso || 0}%</li>
            ))}
          </ul>
        ) : null}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Botao onClick={() => abandono(false)} desabilitado={ocupado}>Simular envio</Botao>
          <Botao primario onClick={() => abandono(true)} desabilitado={ocupado || !ab.elegiveisAgora}>Enviar agora</Botao>
        </div>
      </Cartao>

      {dados.ultimasExecucoes?.length ? (
        <Cartao titulo="Últimas execuções">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, color: MUTED }}>
            {dados.ultimasExecucoes.map((e, i) => (
              <li key={i}>
                {dataHora(e.criado_em)} · {e.tipo === "abandono" ? "abandono" : "limpeza"} ({e.origem})
                {e.tipo === "abandono" ? ` · enviados ${e.resumo?.enviados ?? 0}` : ` · arquivados ${e.resumo?.arquivados ?? 0}`}
              </li>
            ))}
          </ul>
        </Cartao>
      ) : null}
    </div>
  );
}
