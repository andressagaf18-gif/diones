// src/atendimento/FichaArea.jsx
// Atendimento por área — FICHA DA ÁREA e PLANO 30/60/90 DA ÁREA.
//
// Mostra, dentro do atendimento, o diagnóstico DAQUELA área (nota, respostas,
// leitura consultiva, hipóteses, perguntas, caminhos) e o plano com status por
// ação. Tudo o que o especialista marca aqui é interno: o cliente nunca vê.
// Dados: /api/crm?action=ficha-area  e  ficha-area-salvar.

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

const NAVY = "#17233D";
const CORAL = "#FF6B4A";
const MUTED = "#5B667A";
const BORDER = "#E3E7EF";
const SOFT = "#F7F9FC";

const STATUS = [
  ["A_FAZER", "A fazer"],
  ["EM_ANDAMENTO", "Em andamento"],
  ["CONCLUIDA", "Concluída"],
  ["BLOQUEADA", "Bloqueada"],
];
const STATUS_COR = {
  A_FAZER: { fundo: "#EEF0F5", cor: MUTED },
  EM_ANDAMENTO: { fundo: "#E8F0FE", cor: "#1D4ED8" },
  CONCLUIDA: { fundo: "#E9F7EF", cor: "#0F6E56" },
  BLOQUEADA: { fundo: "#FDECEC", cor: "#B3261E" },
};
const PRAZO_COR = { 30: "#2FB37C", 60: "#4F7CFF", 90: "#8B6BFF" };
const CLASSE_RESPOSTA = {
  positiva: { fundo: "#E9F7EF", cor: "#0F6E56" },
  parcial: { fundo: "#FFF4D6", cor: "#8A5A00" },
  negativa: { fundo: "#FDECEC", cor: "#B3261E" },
  lacuna: { fundo: "#EEF0F5", cor: MUTED },
  neutra: { fundo: "#F1F3F7", cor: MUTED },
};
const NIVEL_ROTULO = { BAIXO: "baixo", MEDIO: "médio", ALTO: "alto" };

// ---------------------------------------------------------
// FUNÇÕES PURAS (testáveis)
// ---------------------------------------------------------
const canon = (v) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export function classeResposta(resposta) {
  const r = canon(resposta);
  if (!r) return "neutra";
  if (r.startsWith("naosei")) return "lacuna";
  if (r === "na" || r.startsWith("naoseaplica") || r.startsWith("naoaplic")) return "neutra";
  if (r.startsWith("nao")) return "negativa";
  if (r.startsWith("parc")) return "parcial";
  if (r.startsWith("sim")) return "positiva";
  return "neutra";
}

export function diasDesde(data, agora = Date.now()) {
  if (!data) return null;
  const t = new Date(data).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((agora - t) / 86400000));
}

export function resumoRespostas(respostas) {
  const lista = Array.isArray(respostas) ? respostas : [];
  const conta = (c) => lista.filter((r) => classeResposta(r.resposta) === c).length;
  return { total: lista.length, negativas: conta("negativa"), lacunas: conta("lacuna"), parciais: conta("parcial") };
}

function dataCurta(valor) {
  const d = new Date(valor);
  if (!valor || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function dataHora(valor) {
  const d = new Date(valor);
  if (!valor || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function chamarApi(token, url, { method = "GET", body } = {}) {
  const resposta = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok || !dados?.sucesso) {
    const semCorpo = !dados && (resposta.status === 502 || resposta.status === 504);
    throw new Error(dados?.error || (semCorpo ? "O servidor demorou mais que o limite de tempo. Tente novamente." : `Não foi possível concluir (${resposta.status}).`));
  }
  return dados;
}

// ---------------------------------------------------------
// PEÇAS VISUAIS
// ---------------------------------------------------------
const cartao = { background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 13, padding: "11px 13px" };

function Selo({ texto, fundo, cor }) {
  return <span style={{ display: "inline-block", background: fundo, color: cor, fontSize: 9.5, fontWeight: 800, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{texto}</span>;
}

function Rotulo({ children }) {
  return <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, color: MUTED, textTransform: "uppercase", marginBottom: 6 }}>{children}</div>;
}

function Secao({ titulo, subtitulo, children }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <h3 style={{ margin: "0 0 2px", fontSize: 13 }}>{titulo}</h3>
      {subtitulo ? <p style={{ margin: "0 0 8px", fontSize: 10.5, color: MUTED }}>{subtitulo}</p> : <div style={{ height: 8 }} />}
      {children}
    </section>
  );
}

function Aviso({ tipo = "info", children }) {
  const m = { erro: ["#FDECEC", "#B3261E", "#F1B8B4"], info: ["#E8F0FE", "#1D4ED8", "#C9D9F5"], alerta: ["#FFF4D6", "#7A5200", "#F0D9A0"], ok: ["#E9F7EF", "#0F6E56", "#BFE3CF"] }[tipo];
  return (
    <div role={tipo === "erro" ? "alert" : "status"} style={{ background: m[0], color: m[1], border: `1px solid ${m[2]}`, borderRadius: 10, padding: "9px 12px", fontSize: 11.5, lineHeight: 1.5, marginBottom: 10 }}>
      {children}
    </div>
  );
}

function Botao({ children, onClick, disabled, primario = false, pequeno = false, titulo }) {
  return (
    <button
      type="button"
      title={titulo}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 9,
        padding: pequeno ? "5px 9px" : "8px 12px",
        fontSize: pequeno ? 10 : 11,
        fontWeight: 800,
        fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        background: primario ? CORAL : "#fff",
        color: primario ? "#fff" : NAVY,
        border: primario ? "1px solid transparent" : "1px solid #D8DEEA",
      }}
    >
      {children}
    </button>
  );
}

function Girando({ texto }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: MUTED, fontSize: 11.5, padding: "10px 0" }}>
      <Loader2 size={15} className="fa-giro" />
      {texto}
      <style>{`@keyframes fa-giro{to{transform:rotate(360deg)}}.fa-giro{animation:fa-giro 1s linear infinite}`}</style>
    </div>
  );
}

const campoEstilo = { border: "1px solid #D8DEEA", borderRadius: 8, padding: "6px 8px", fontSize: 11, fontFamily: "inherit", color: NAVY, background: "#fff", boxSizing: "border-box" };

// ---------------------------------------------------------
// VISTA: FICHA DA ÁREA
// ---------------------------------------------------------
function SituacaoDaArea({ dados }) {
  const { atendimento, respostas, consultivo } = dados;
  const r = resumoRespostas(respostas);
  const score = atendimento.scoreArea;
  const cor = score === null ? CLASSE_RESPOSTA.neutra : score >= 75 ? CLASSE_RESPOSTA.positiva : score >= 55 ? CLASSE_RESPOSTA.parcial : CLASSE_RESPOSTA.negativa;

  return (
    <Secao titulo="Situação da área" subtitulo="Vem direto do diagnóstico.">
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <div style={{ minWidth: 62, textAlign: "center", borderRadius: 14, padding: "9px 11px", fontSize: 24, fontWeight: 800, background: cor.fundo, color: cor.cor }}>{score ?? "—"}</div>
        <div style={{ fontSize: 11.5, lineHeight: 1.6, color: MUTED }}>
          <b style={{ color: NAVY }}>{dados.empresa || "Cliente"} · {atendimento.area}</b>
          {atendimento.nivelArea ? <> · {String(atendimento.nivelArea).toLowerCase()}</> : null}
          <br />
          {r.total
            ? <>{r.negativas + r.lacunas} de {r.total} respostas desta área foram “não” ou “não sei”.</>
            : "Sem respostas desta área registradas no diagnóstico."}
          {consultivo.disponivel ? <><br />Análise consultiva v{consultivo.versao} · {dataCurta(consultivo.geradoEm)}</> : null}
        </div>
      </div>
    </Secao>
  );
}

function TabelaRespostas({ respostas }) {
  if (!respostas.length) return <div style={{ fontSize: 11.5, color: MUTED }}>Nenhuma resposta desta área foi guardada no diagnóstico.</div>;
  const temDetalhe = respostas.some((r) => r.detalhe);
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11.5 }}>
        <thead>
          <tr>
            {["Pergunta", "Resposta", "Importância", "Risco", ...(temDetalhe ? ["Detalhe do cliente"] : [])].map((h) => (
              <th key={h} style={{ textAlign: "left", background: SOFT, color: MUTED, fontSize: 10, padding: "6px 8px" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {respostas.map((r, i) => {
            const c = CLASSE_RESPOSTA[classeResposta(r.resposta)];
            return (
              <tr key={i} style={{ borderTop: `1px solid ${BORDER}`, verticalAlign: "top" }}>
                <td style={{ padding: "7px 8px" }}>{r.pergunta}</td>
                <td style={{ padding: "7px 8px" }}><Selo texto={r.resposta || "—"} fundo={c.fundo} cor={c.cor} /></td>
                <td style={{ padding: "7px 8px", color: MUTED }}>{r.importancia ? `${r.importancia}/3` : "—"}</td>
                <td style={{ padding: "7px 8px", color: MUTED }}>{r.risco ? String(r.risco).toLowerCase() : "—"}</td>
                {temDetalhe ? <td style={{ padding: "7px 8px" }}>{r.detalhe ? `“${r.detalhe}”` : "—"}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Hipotese({ h, onMarcar }) {
  const opcoes = [["CONFIRMADA", "Confirmada"], ["REFUTADA", "Refutada"], ["ABERTA", "Em aberto"]];
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", padding: "9px 0", borderTop: `1px solid ${BORDER}`, fontSize: 11.8, lineHeight: 1.5 }}>
      <span>
        {h.hipotese}
        {h.comoValidar ? <><br /><span style={{ color: MUTED }}>Como validar: {h.comoValidar}</span></> : null}
      </span>
      <span role="group" aria-label={`Resultado da hipótese: ${h.hipotese}`} style={{ display: "inline-flex", border: "1px solid #D8DEEA", borderRadius: 8, overflow: "hidden", flex: "none" }}>
        {opcoes.map(([valor, rotulo], i) => {
          const ativo = h.resultado === valor;
          const cor = valor === "CONFIRMADA" ? ["#E9F7EF", "#0F6E56"] : valor === "REFUTADA" ? ["#FDECEC", "#B3261E"] : ["#EEF0F5", NAVY];
          return (
            <button
              key={valor}
              type="button"
              aria-pressed={ativo}
              onClick={() => onMarcar(h.chave, valor)}
              style={{ border: "none", borderLeft: i ? "1px solid #D8DEEA" : "none", padding: "4px 9px", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: ativo ? cor[0] : "#fff", color: ativo ? cor[1] : MUTED }}
            >
              {rotulo}
            </button>
          );
        })}
      </span>
    </div>
  );
}

function Caminho({ c }) {
  return (
    <div style={{ border: `1px solid ${c.recomendado ? CORAL : BORDER}`, background: c.recomendado ? "#FFF8F5" : "#fff", borderRadius: 12, padding: "10px 12px", fontSize: 11.5, lineHeight: 1.5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginBottom: 3 }}>
        <b>{c.id}. {c.titulo}</b>
        {c.recomendado ? <Selo texto="recomendado" fundo="#E9F7EF" cor="#0F6E56" /> : null}
      </div>
      {c.descricao}
      <div style={{ marginTop: 5, color: MUTED }}>
        {c.esforco ? `Esforço ${NIVEL_ROTULO[c.esforco]}` : ""}{c.esforco && c.impacto ? " · " : ""}{c.impacto ? `impacto ${NIVEL_ROTULO[c.impacto]}` : ""}
      </div>
    </div>
  );
}

function DocumentosAPedir({ documentos, onSalvar }) {
  const [novo, setNovo] = useState("");
  const alternar = (i) => onSalvar(documentos.map((d, j) => (j === i ? { ...d, status: d.status === "RECEBIDO" ? "PENDENTE" : "RECEBIDO" } : d)));
  const remover = (i) => onSalvar(documentos.filter((_, j) => j !== i));
  const adicionar = () => {
    const nome = novo.trim();
    if (!nome) return;
    onSalvar([...documentos, { nome, status: "PENDENTE" }]);
    setNovo("");
  };

  return (
    <div style={{ ...cartao, marginBottom: 11 }}>
      <Rotulo>Documentos a pedir</Rotulo>
      {documentos.length === 0 ? <div style={{ fontSize: 11, color: MUTED }}>Nenhum documento na lista.</div> : null}
      {documentos.map((d, i) => (
        <div key={`${d.nome}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, padding: "4px 0" }}>
          <input type="checkbox" aria-label={`Documento recebido: ${d.nome}`} checked={d.status === "RECEBIDO"} onChange={() => alternar(i)} />
          <span style={{ flex: 1, textDecoration: d.status === "RECEBIDO" ? "line-through" : "none", color: d.status === "RECEBIDO" ? MUTED : NAVY }}>{d.nome}</span>
          <Selo texto={d.status === "RECEBIDO" ? "recebido" : "pendente"} fundo={d.status === "RECEBIDO" ? "#E9F7EF" : "#FFF4D6"} cor={d.status === "RECEBIDO" ? "#0F6E56" : "#8A5A00"} />
          <button type="button" aria-label={`Remover documento ${d.nome}`} onClick={() => remover(i)} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 13 }}>×</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input aria-label="Novo documento" value={novo} onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && adicionar()} placeholder="Acrescentar documento..." style={{ ...campoEstilo, flex: 1 }} />
        <Botao pequeno onClick={adicionar}>Adicionar</Botao>
      </div>
    </div>
  );
}

function ProximaAcao({ atendimento }) {
  const dias = diasDesde(atendimento.ultimoAcionamento);
  return (
    <div style={{ ...cartao, marginBottom: 11 }}>
      <Rotulo>Próxima ação</Rotulo>
      <b style={{ fontSize: 12 }}>{atendimento.proximaAcao || "Nenhuma ação definida"}</b>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
        {atendimento.proximoContato ? <>Próximo contato: <b style={{ color: NAVY }}>{dataHora(atendimento.proximoContato)}</b></> : "Sem próximo contato marcado."}
      </div>
      <div style={{ marginTop: 7 }}>
        {dias === null
          ? <Selo texto="nenhum contato registrado" fundo="#EEF0F5" cor={MUTED} />
          : <Selo texto={dias === 0 ? "contato hoje" : `sem contato há ${dias} dia${dias === 1 ? "" : "s"}`} fundo={dias >= 3 ? "#FFF4D6" : "#E9F7EF"} cor={dias >= 3 ? "#8A5A00" : "#0F6E56"} />}
      </div>
    </div>
  );
}

function VistaFicha({ dados, gravar, gerarAnalise, gerando }) {
  const { consultivo } = dados;
  const area = consultivo.area;
  const marcarHipotese = (chave, valor) =>
    gravar({ hipoteses: { [chave]: valor } }, (d) => ({
      ...d,
      consultivo: { ...d.consultivo, area: { ...d.consultivo.area, hipoteses: d.consultivo.area.hipoteses.map((h) => (h.chave === chave ? { ...h, resultado: valor } : h)) } },
    }));
  const marcarPergunta = (chave, feita) =>
    gravar({ perguntas: { [chave]: feita } }, (d) => ({
      ...d,
      consultivo: { ...d.consultivo, area: { ...d.consultivo.area, perguntasReuniao: d.consultivo.area.perguntasReuniao.map((p) => (p.chave === chave ? { ...p, feita } : p)) } },
    }));
  const salvarDocumentos = (documentos) => gravar({ documentos }, (d) => ({ ...d, ficha: { ...d.ficha, documentos } }));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.7fr) minmax(240px,1fr)", gap: 18, alignItems: "start" }}>
      <div>
        <SituacaoDaArea dados={dados} />

        {!consultivo.disponivel ? (
          <Aviso tipo="info">
            Este diagnóstico ainda não tem <b>análise consultiva</b>, que traz a leitura do consultor, as hipóteses, as perguntas da reunião e o plano 30/60/90 desta área.
            <div style={{ marginTop: 8 }}>
              <Botao primario onClick={gerarAnalise} disabled={gerando}>
                {gerando ? <Loader2 size={13} className="fa-giro" /> : <Sparkles size={13} />} Gerar análise consultiva
              </Botao>
              {gerando ? <span style={{ marginLeft: 10, fontSize: 11 }}>A IA está analisando. Pode levar até 2 minutos.</span> : null}
            </div>
          </Aviso>
        ) : null}

        {consultivo.disponivel && !consultivo.areaEncontrada ? (
          <Aviso tipo="alerta">A área “{dados.atendimento.area}” não foi encontrada na análise consultiva deste diagnóstico, então a leitura e o plano dela não aparecem aqui. As respostas abaixo continuam valendo.</Aviso>
        ) : null}

        {area?.leituraConsultor ? (
          <Secao titulo="Leitura do consultor" subtitulo="Da análise consultiva, só desta área.">
            <div style={{ borderLeft: `3px solid ${CORAL}`, background: "#FFF8F5", borderRadius: "0 12px 12px 0", padding: "10px 13px", fontSize: 12.2, lineHeight: 1.65, color: "#3B2A25" }}>{area.leituraConsultor}</div>
          </Secao>
        ) : null}

        <Secao titulo="O que o cliente respondeu nesta área" subtitulo="As evidências, para usar na conversa.">
          <TabelaRespostas respostas={dados.respostas} />
        </Secao>

        {area?.hipoteses?.length ? (
          <Secao titulo="Hipóteses a validar" subtitulo="Depois da conversa, marque o resultado. Fica registrado no atendimento.">
            {area.hipoteses.map((h) => <Hipotese key={h.chave} h={h} onMarcar={marcarHipotese} />)}
          </Secao>
        ) : null}

        {area?.perguntasReuniao?.length ? (
          <Secao titulo="Para a reunião" subtitulo="Perguntas da análise consultiva. Marque as já feitas.">
            {area.perguntasReuniao.map((p) => (
              <label key={p.chave} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "4px 0", fontSize: 11.8, cursor: "pointer" }}>
                <input type="checkbox" checked={p.feita} onChange={(e) => marcarPergunta(p.chave, e.target.checked)} aria-label={`Pergunta feita: ${p.texto}`} />
                <span style={{ textDecoration: p.feita ? "line-through" : "none", color: p.feita ? MUTED : NAVY }}>{p.texto}</span>
              </label>
            ))}
          </Secao>
        ) : null}

        {area?.caminhos?.length ? (
          <Secao titulo="Caminhos e recomendação">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
              {area.caminhos.map((c) => <Caminho key={c.id} c={c} />)}
            </div>
            {area.recomendacaoPrincipal?.porque ? (
              <div style={{ ...cartao, marginTop: 10, fontSize: 11.8, lineHeight: 1.55 }}>
                <Rotulo>Por que recomendamos</Rotulo>
                {area.recomendacaoPrincipal.porque}
                {area.recomendacaoPrincipal.dependencias?.length ? <div style={{ color: MUTED, marginTop: 4 }}>Depende de: {area.recomendacaoPrincipal.dependencias.join("; ")}</div> : null}
              </div>
            ) : null}
            {area.naoAssumir?.length ? (
              <div style={{ ...cartao, marginTop: 10, background: "#FFFBF0", fontSize: 11.8, lineHeight: 1.55 }}>
                <Rotulo>O que não assumir</Rotulo>
                {area.naoAssumir.map((t, i) => <div key={i}>• {t}</div>)}
              </div>
            ) : null}
          </Secao>
        ) : null}
      </div>

      <div>
        <ProximaAcao atendimento={dados.atendimento} />
        {consultivo.disponivel ? <DocumentosAPedir documentos={dados.ficha.documentos} onSalvar={salvarDocumentos} /> : null}
        {consultivo.roteiro?.objecoes?.length ? (
          <div style={{ ...cartao, marginBottom: 11 }}>
            <Rotulo>Objeções prováveis</Rotulo>
            {consultivo.roteiro.objecoes.map((o, i) => (
              <div key={i} style={{ fontSize: 11.5, lineHeight: 1.5, marginBottom: 6 }}>
                <b>“{o.objecao}”</b>
                <div style={{ color: MUTED }}>{o.resposta}</div>
              </div>
            ))}
          </div>
        ) : null}
        {area?.recomendacaoPrincipal?.servicoFinder ? (
          <div style={{ ...cartao, marginBottom: 11 }}>
            <Rotulo>Serviço Finder relacionado</Rotulo>
            <Selo texto={area.recomendacaoPrincipal.servicoFinder} fundo="#E8F0FE" cor="#1D4ED8" />
          </div>
        ) : null}
        <div style={{ fontSize: 10, color: MUTED, lineHeight: 1.5 }}>As marcações desta ficha são internas: o cliente não vê.</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// VISTA: PLANO 30/60/90 DA ÁREA
// ---------------------------------------------------------
function LinhaAcao({ a, onMudar, onRemover }) {
  const cor = STATUS_COR[a.status];
  const salvarTexto = (campo) => (e) => {
    const valor = e.target.value.trim();
    if (valor !== String(a[campo] || "")) onMudar(a.id, { [campo]: valor });
  };

  return (
    <tr style={{ borderTop: `1px solid ${BORDER}`, verticalAlign: "top", opacity: a.obsoleta ? 0.65 : 1 }}>
      <td style={{ padding: "8px" }}>
        <span style={{ background: PRAZO_COR[a.prazo], color: "#fff", fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{a.prazo} dias</span>
      </td>
      <td style={{ padding: "8px", minWidth: 220 }}>
        <b>{a.acao}</b>
        {a.obsoleta ? <div style={{ marginTop: 3 }}><Selo texto="não consta na análise atual" fundo="#FFF4D6" cor="#8A5A00" /></div> : null}
        {a.objetivo ? <div style={{ color: MUTED }}>Objetivo: {a.objetivo}</div> : null}
        {a.evidenciaEsperada ? <div style={{ color: MUTED }}>Evidência: {a.evidenciaEsperada}</div> : null}
        {a.dependencia ? <div style={{ color: MUTED }}>Depende de: {a.dependencia}</div> : null}
        {a.indicadorSucesso ? <div style={{ color: MUTED }}>Indicador: {a.indicadorSucesso}</div> : null}
      </td>
      <td style={{ padding: "8px" }}>
        <input key={`resp-${a.id}-${a.responsavel}`} aria-label={`Responsável: ${a.acao}`} defaultValue={a.responsavel} onBlur={salvarTexto("responsavel")} placeholder="Quem faz" style={{ ...campoEstilo, width: 120 }} />
      </td>
      <td style={{ padding: "8px" }}>
        <input type="date" aria-label={`Data: ${a.acao}`} value={a.data || ""} onChange={(e) => onMudar(a.id, { data: e.target.value })} style={{ ...campoEstilo, width: 132 }} />
      </td>
      <td style={{ padding: "8px", minWidth: 150 }}>
        <select aria-label={`Status: ${a.acao}`} value={a.status} onChange={(e) => onMudar(a.id, { status: e.target.value })} style={{ ...campoEstilo, background: cor.fundo, color: cor.cor, fontWeight: 800 }}>
          {STATUS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
        {a.status === "BLOQUEADA" ? (
          <input key={`mot-${a.id}-${a.motivoBloqueio}`} aria-label={`Motivo do bloqueio: ${a.acao}`} defaultValue={a.motivoBloqueio} onBlur={salvarTexto("motivoBloqueio")} placeholder="Motivo do bloqueio" style={{ ...campoEstilo, width: "100%", marginTop: 5 }} />
        ) : null}
        {a.status === "CONCLUIDA" && a.concluidaEm ? <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>em {dataCurta(a.concluidaEm)}</div> : null}
      </td>
      <td style={{ padding: "8px" }}>
        <button type="button" aria-label={`Remover ação: ${a.acao}`} onClick={() => onRemover(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 15 }}>×</button>
      </td>
    </tr>
  );
}

function VistaPlano({ dados, gravar, gerarAnalise, gerando }) {
  const { acoes, progresso, consultivo } = dados;
  const [texto, setTexto] = useState("");
  const [prazo, setPrazo] = useState("30");

  const enviar = (nova, mensagem) => gravar({ acoes: nova }, null, mensagem);
  const mudar = (id, parcial) => enviar(acoes.map((a) => (a.id === id ? { ...a, ...parcial } : a)));
  const remover = (id) => enviar(acoes.filter((a) => a.id !== id));
  const adicionar = () => {
    const acao = texto.trim();
    if (!acao) return;
    enviar([...acoes, { acao, prazo: Number(prazo), status: "A_FAZER" }]);
    setTexto("");
  };

  return (
    <div>
      {!consultivo.disponivel ? (
        <Aviso tipo="info">
          O plano sugerido vem da <b>análise consultiva</b>, que este diagnóstico ainda não tem. Você pode gerá-la ou montar o plano à mão abaixo.
          <div style={{ marginTop: 8 }}>
            <Botao primario onClick={gerarAnalise} disabled={gerando}>
              {gerando ? <Loader2 size={13} className="fa-giro" /> : <Sparkles size={13} />} Gerar análise consultiva
            </Botao>
          </div>
        </Aviso>
      ) : null}
      {consultivo.disponivel && !consultivo.areaEncontrada ? (
        <Aviso tipo="alerta">A área “{dados.atendimento.area}” não foi encontrada na análise consultiva, então não há ações sugeridas para ela. Você pode acrescentar ações à mão.</Aviso>
      ) : null}

      <Secao titulo="Plano 30/60/90 da área" subtitulo="Cada ação tem status, responsável e data. O que mudar aqui entra no histórico do atendimento.">
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: MUTED }}>
          <span><b style={{ color: NAVY }}>{progresso.concluidas} de {progresso.total}</b> ações concluídas{progresso.emAndamento ? ` · ${progresso.emAndamento} em andamento` : ""}{progresso.bloqueadas ? ` · ${progresso.bloqueadas} bloqueada${progresso.bloqueadas === 1 ? "" : "s"}` : ""}</span>
          <span>{progresso.percentual}%</span>
        </div>
        <div role="progressbar" aria-valuenow={progresso.percentual} aria-valuemin={0} aria-valuemax={100} style={{ height: 8, borderRadius: 5, background: "#EEF1F5", overflow: "hidden", margin: "6px 0 10px" }}>
          <div style={{ width: `${progresso.percentual}%`, height: "100%", background: "#2FB37C" }} />
        </div>

        {acoes.length === 0 ? (
          <div style={{ ...cartao, fontSize: 11.5, color: MUTED }}>Nenhuma ação no plano desta área ainda.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11.5, minWidth: 760 }}>
              <thead>
                <tr>{["Prazo", "Ação", "Responsável", "Data", "Status", ""].map((h) => <th key={h} style={{ textAlign: "left", background: SOFT, color: MUTED, fontSize: 10, padding: "6px 8px" }}>{h}</th>)}</tr>
              </thead>
              <tbody>{acoes.map((a) => <LinhaAcao key={a.id} a={a} onMudar={mudar} onRemover={remover} />)}</tbody>
            </table>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input aria-label="Nova ação" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => e.key === "Enter" && adicionar()} placeholder="Acrescentar uma ação ao plano..." style={{ ...campoEstilo, flex: 1, minWidth: 220 }} />
          <select aria-label="Prazo da nova ação" value={prazo} onChange={(e) => setPrazo(e.target.value)} style={campoEstilo}>
            <option value="30">30 dias</option>
            <option value="60">60 dias</option>
            <option value="90">90 dias</option>
          </select>
          <Botao onClick={adicionar}>Adicionar ação</Botao>
        </div>
      </Secao>
    </div>
  );
}

// ---------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------
export default function FichaArea({ token, atendimentoId, vista = "ficha" }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [gerando, setGerando] = useState(false);
  const sequencia = useRef(0);
  const fila = useRef(Promise.resolve()); // um envio por vez, na ordem dos cliques

  const carregar = useCallback(async () => {
    try {
      const d = await chamarApi(token, `/api/crm?action=ficha-area&atendimentoId=${encodeURIComponent(atendimentoId)}`);
      setDados(d);
      setErro("");
    } catch (e) {
      setErro(e.message);
    }
  }, [token, atendimentoId]);

  useEffect(() => {
    setDados(null);
    setErro("");
    setAviso("");
    carregar();
  }, [carregar]);

  // Atualiza a tela na hora (otimista) e confirma no servidor. Respostas
  // antigas que chegam atrasadas são ignoradas.
  const gravar = useCallback(
    async (parcial, otimista, mensagem) => {
      const minha = ++sequencia.current;
      setErro("");
      if (otimista) setDados((d) => (d ? otimista(d) : d));
      // Uma gravação por vez: sem isso, dois cliques rápidos viram duas requisições em voo
      // que podem chegar fora de ordem ou se sobrepor no servidor.
      const envio = fila.current.then(async () => {
        try {
          const d = await chamarApi(token, "/api/crm?action=ficha-area-salvar", { method: "POST", body: { atendimentoId, ...parcial } });
          if (minha === sequencia.current) setDados(d);
          if (mensagem) setAviso(mensagem);
        } catch (e) {
          setErro(e.message);
          carregar(); // volta ao que está de fato salvo
        }
      });
      fila.current = envio;
      return envio;
    },
    [token, atendimentoId, carregar]
  );

  async function gerarAnalise() {
    if (!dados?.atendimento?.diagnosticoId) return;
    setGerando(true);
    setErro("");
    try {
      await chamarApi(token, "/api/diagnosticos?action=consultivo-gerar", { method: "POST", body: { id: dados.atendimento.diagnosticoId } });
      await carregar();
      setAviso("Análise consultiva gerada.");
    } catch (e) {
      setErro(e.message);
    } finally {
      setGerando(false);
    }
  }

  if (!dados) {
    return erro ? <Aviso tipo="erro">{erro}</Aviso> : <Girando texto="Carregando ficha da área..." />;
  }

  return (
    <div style={{ fontFamily: "inherit", color: NAVY }}>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {aviso ? <Aviso tipo="ok">{aviso}</Aviso> : null}
      {vista === "plano"
        ? <VistaPlano dados={dados} gravar={gravar} gerarAnalise={gerarAnalise} gerando={gerando} />
        : <VistaFicha dados={dados} gravar={gravar} gerarAnalise={gerarAnalise} gerando={gerando} />}
    </div>
  );
}
