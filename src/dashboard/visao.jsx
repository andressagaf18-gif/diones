// src/dashboard/visao.jsx
// Dashboard — VISÃO COMPLETA DO SISTEMA.
// Componentes das melhorias e das abas novas (Áreas, Clientes e agenda, LGPD, Sistema).
// Os dados vêm de /api/crm?action=dashboard-visao e de ações que já existem
// (jornada-funil, fluxo-operacao, saude-modulos, saude-armazenamento, deploys).
// Cada fonte é carregada de forma isolada: se uma falhar, só o seu bloco avisa.

import { useCallback, useEffect, useRef, useState } from "react";
import { formatarMomento } from "../lgpd/ConsentimentoLGPD";

const NAVY = "#17233D";
const CORAL = "#FF6B4A";
const MUTED = "#5B667A";
const WHITE = "#FFFFFF";
const BORDER = "#E3E7EF";
const VERDE = "#0F6E56";
const AMBAR = "#8A5A00";
const VERMELHO = "#B3261E";
const AZUL = "#1D4ED8";

// ---------------------------------------------------------
// FUNÇÕES PURAS (testáveis)
// ---------------------------------------------------------
export function moedaBR(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function moedaCurta(v) {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return moedaBR(n);
}

export function pctTxt(v) {
  return v === null || v === undefined || !Number.isFinite(Number(v)) ? "—" : `${Math.round(Number(v))}%`;
}

export function bytesTxt(b) {
  const n = Number(b || 0);
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

const ROTULOS_ETAPA = {
  intro: "Abriu o link",
  cadastro: "Cadastro",
  estrutura: "Estrutura",
  simuladorReforma: "Simulador",
  cnpj: "CNPJ",
  porte: "Porte",
  reforma_detalhes: "Detalhes da reforma",
  dor: "Dores",
  gerandoPerguntas: "Gerando perguntas",
  confirmarNegocio: "Confirmação",
  checklist: "Checklist",
  analisando: "Analisando",
  resultado: "Resultado",
};

export function rotuloEtapa(etapa) {
  return ROTULOS_ETAPA[etapa] || String(etapa || "—");
}

// Maior queda entre duas etapas seguidas do funil.
export function maiorQueda(etapas) {
  const lista = Array.isArray(etapas) ? etapas : [];
  let melhor = null;
  for (let i = 1; i < lista.length; i += 1) {
    const antes = Number(lista[i - 1].total || 0);
    const depois = Number(lista[i].total || 0);
    if (antes <= 0) continue;
    const queda = Math.round(((antes - depois) / antes) * 100);
    if (queda > 0 && (!melhor || queda > melhor.queda)) {
      melhor = { de: lista[i - 1].etapa ?? lista[i - 1].label, para: lista[i].etapa ?? lista[i].label, queda };
    }
  }
  return melhor;
}

export function filtrarAtendimentos(lista, extras, filtro) {
  const itens = Array.isArray(lista) ? lista : [];
  const ex = extras || {};
  const dados = (a) => ex[a.id || a.atendimento_id] || null;
  if (filtro === "atraso") return itens.filter((a) => (dados(a)?.atrasoDias ?? 0) > 0 || dados(a)?.atrasado === true);
  if (filtro === "bloqueada") return itens.filter((a) => (dados(a)?.planoBloqueadas ?? 0) > 0);
  if (filtro === "sem_analise") return itens.filter((a) => dados(a) && !dados(a).analiseVersao);
  return itens;
}

// Junta o que o servidor calculou com o que as outras fontes já sabem.
export function montarAtencaoTela(visao, extra = {}) {
  const itens = Array.isArray(visao?.atencao) ? [...visao.atencao] : [];

  const modulos = Array.isArray(extra?.saude?.modulos) ? extra.saude.modulos : [];
  const comErro = modulos.filter((m) => m.status === "ERRO");
  if (comErro.length) {
    itens.push({
      id: "modulos_erro",
      nivel: "critico",
      titulo: comErro.length === 1 ? "1 módulo falhou na última execução" : `${comErro.length} módulos falharam na última execução`,
      detalhe: comErro.map((m) => m.modulo).join(", "),
      destino: { aba: "sistema" },
      rotuloAcao: "Ver sistema",
    });
  }

  const deploy = Array.isArray(extra?.deploys?.deploys) ? extra.deploys.deploys.find((d) => d.producao) || extra.deploys.deploys[0] : null;
  if (deploy && deploy.estado === "ERROR") {
    itens.push({
      id: "publicacao_falhou",
      nivel: "critico",
      titulo: "A última publicação falhou",
      detalhe: deploy.mensagemCommit || "Veja o log da publicação na Vercel",
      destino: { aba: "sistema" },
      rotuloAcao: "Ver sistema",
    });
  }

  const parados = (Array.isArray(extra?.fluxo?.etapas) ? extra.fluxo.etapas : []).reduce((a, e) => a + Number(e.parados || 0), 0);
  if (parados > 0) {
    itens.push({
      id: "projetos_parados",
      nivel: "atencao",
      titulo: parados === 1 ? "1 projeto tributário parado há 48h ou mais" : `${parados} projetos tributários parados há 48h ou mais`,
      detalhe: "Estão esperando o próximo passo no fluxo da Inteligência Tributária",
      destino: { aba: "reforma" },
      rotuloAcao: "Ver projetos",
    });
  }

  const ordem = { critico: 0, atencao: 1, info: 2 };
  return itens.sort((a, b) => (ordem[a.nivel] ?? 3) - (ordem[b.nivel] ?? 3));
}

export const ROTULOS_BLOCOS = {
  propostas: "propostas",
  asaas: "financeiro (Asaas)",
  lgpd: "LGPD",
  atendimentos: "atendimentos e áreas",
  analise: "análise consultiva",
  origens: "origens",
  diagnosticos: "diagnósticos",
  clientes: "clientes",
  agenda: "agenda",
  sistema: "sistema",
  consentimentos: "aceite por lead",
};

// ---------------------------------------------------------
// FONTE DE DADOS
// ---------------------------------------------------------
export function useVisaoDashboard() {
  const [estado, setEstado] = useState({ carregando: true, erro: "", visao: null, avisos: [], jornada: null, fluxo: null, saude: null, armazenamento: null, deploys: null });
  const vivo = useRef(true);

  const carregar = useCallback(async () => {
    const token = sessionStorage.getItem("finder_admin_token") || "";
    if (!token) {
      setEstado((e) => ({ ...e, carregando: false, erro: "Sessão indisponível." }));
      return;
    }
    setEstado((e) => ({ ...e, carregando: true }));
    const cab = { headers: { Authorization: `Bearer ${token}` } };
    const ler = async (url) => {
      const r = await fetch(url, cab);
      const d = await r.json().catch(() => null);
      if (!r.ok || !d || d.sucesso === false) throw new Error(d?.error || `HTTP ${r.status}`);
      return d;
    };
    const [v, j, f, s, a, d] = await Promise.allSettled([
      ler("/api/crm?action=dashboard-visao"),
      ler("/api/crm?action=jornada-funil&dias=30"),
      ler("/api/tributario?action=fluxo-operacao"),
      ler("/api/crm?action=saude-modulos"),
      ler("/api/crm?action=saude-armazenamento"),
      ler("/api/deploys"),
    ]);
    if (!vivo.current) return;
    const ok = (p) => (p.status === "fulfilled" ? p.value : null);
    setEstado({
      carregando: false,
      erro: v.status === "rejected" ? String(v.reason?.message || "Não foi possível carregar a visão completa.") : "",
      visao: ok(v)?.visao || null,
      avisos: ok(v)?.avisos || [],
      jornada: ok(j),
      fluxo: ok(f),
      saude: ok(s),
      armazenamento: ok(a),
      deploys: ok(d),
    });
  }, []);

  useEffect(() => {
    vivo.current = true;
    carregar();
    return () => {
      vivo.current = false;
    };
  }, [carregar]);

  return { ...estado, recarregar: carregar };
}

// ---------------------------------------------------------
// ÁTOMOS VISUAIS
// ---------------------------------------------------------
function Cartao({ children, style = {}, titulo, subtitulo, destaque }) {
  return (
    <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, boxShadow: "0 8px 24px rgba(23,35,61,.05)", ...(destaque ? { borderTop: `4px solid ${CORAL}` } : {}), ...style }}>
      {titulo ? (
        <div style={{ marginBottom: 10 }}>
          <strong style={{ fontSize: 13 }}>{titulo}</strong>
          {subtitulo ? <div style={{ fontSize: 10, color: MUTED, marginTop: 3, lineHeight: 1.45 }}>{subtitulo}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function Indicador({ titulo, valor, subtitulo, cor = NAVY, destaque = false, onClick }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      style={{ background: WHITE, border: `1px solid ${BORDER}`, borderTop: `4px solid ${destaque ? CORAL : "#D8DEEA"}`, borderRadius: 14, padding: "12px 14px", cursor: onClick ? "pointer" : "default", boxShadow: "0 8px 24px rgba(23,35,61,.05)" }}
    >
      <div style={{ fontSize: 9, fontWeight: 900, color: MUTED, letterSpacing: 0.3 }}>{titulo}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: cor, marginTop: 4 }}>{valor}</div>
      {subtitulo ? <div style={{ fontSize: 10, color: MUTED, marginTop: 3, lineHeight: 1.4 }}>{subtitulo}</div> : null}
    </div>
  );
}

function Barra({ pct, cor = "#2FB37C", altura = 8 }) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div style={{ height: altura, borderRadius: altura, background: "#EEF1F5", overflow: "hidden" }}>
      <div style={{ width: `${p}%`, height: "100%", background: cor, borderRadius: altura }} />
    </div>
  );
}

function Selo({ texto, fundo = "#EEF0F5", cor = MUTED, titulo }) {
  return (
    <span title={titulo} style={{ display: "inline-block", background: fundo, color: cor, fontSize: 9.5, fontWeight: 800, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>
      {texto}
    </span>
  );
}

const SELO = {
  verde: { fundo: "#E9F7EF", cor: VERDE },
  ambar: { fundo: "#FFF4D6", cor: AMBAR },
  vermelho: { fundo: "#FDECEC", cor: VERMELHO },
  azul: { fundo: "#E8F0FE", cor: AZUL },
  cinza: { fundo: "#EEF0F5", cor: MUTED },
};

function Tabela({ colunas, linhas, vazio = "Nenhum registro disponível.", largura = 560 }) {
  return (
    <div style={{ overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: largura }}>
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c} style={{ textAlign: "left", color: MUTED, fontSize: 9, padding: 7, borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas}
          {!linhas.length ? (
            <tr>
              <td colSpan={colunas.length} style={{ padding: 18, textAlign: "center", color: MUTED, fontSize: 11 }}>
                {vazio}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

const td = { padding: 7, fontSize: 10.5, borderTop: `1px solid ${BORDER}`, verticalAlign: "middle" };

function Grade({ min = 175, children, gap = 10, margem = 14 }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit,minmax(${min}px,1fr))`, gap, marginBottom: margem }}>{children}</div>;
}

function Duas({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14, marginBottom: 14 }}>{children}</div>;
}

function Titulo({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 800, margin: "4px 0 8px" }}>{children}</div>;
}

function SemDados({ children }) {
  return <div style={{ color: MUTED, fontSize: 11, padding: "12px 4px", lineHeight: 1.5 }}>{children}</div>;
}

export function AvisosBlocos({ avisos, erro }) {
  const lista = (Array.isArray(avisos) ? avisos : []).map((a) => ROTULOS_BLOCOS[a] || a);
  if (!lista.length && !erro) return null;
  return (
    <div role="status" style={{ background: "#FFF8E8", border: "1px solid #F2D79A", color: "#7A5200", borderRadius: 12, padding: "9px 13px", fontSize: 11, marginBottom: 12, lineHeight: 1.5 }}>
      {erro ? `A visão completa não pôde ser carregada (${erro}). Os indicadores originais continuam disponíveis.` : `Alguns blocos não puderam ser calculados agora: ${lista.join(", ")}. Os demais estão corretos.`}
    </div>
  );
}

// ---------------------------------------------------------
// GERAL
// ---------------------------------------------------------
const COR_NIVEL = { critico: "#E5484D", atencao: "#F4B740", info: "#4F7CFF" };

export function GeralExtra({ visao, extra = {}, irPara, carregando }) {
  if (!visao) {
    return carregando ? <SemDados>Carregando a visão completa...</SemDados> : null;
  }
  const rec = visao.receita;
  const mes = visao.asaas?.mes;
  const op = visao.operacao || {};
  const atencao = montarAtencaoTela(visao, extra);

  return (
    <>
      <Titulo>Receita e pipeline</Titulo>
      <Grade>
        <Indicador titulo="RECEITA LÍQUIDA (MÊS)" valor={mes ? moedaCurta(mes.liquido) : "—"} subtitulo={mes ? (mes.variacaoPct === null ? `${mes.recebidos} pagamento(s) recebidos` : `${mes.variacaoPct >= 0 ? "+" : ""}${mes.variacaoPct}% sobre o mês anterior`) : "Indisponível"} destaque />
        <Indicador titulo="PIPELINE ABERTO" valor={rec ? moedaCurta(rec.pipelineAberto) : "—"} subtitulo={rec ? `${rec.propostasAbertas} em aberto · ${rec.rascunhos} em rascunho` : "Indisponível"} />
        <Indicador titulo="GANHO NO MÊS" valor={rec ? moedaCurta(rec.ganhoNoMes) : "—"} subtitulo={rec ? `${rec.ganhas} proposta(s) ganha(s) no total` : "Indisponível"} />
        <Indicador titulo="TICKET MÉDIO" valor={rec ? moedaCurta(rec.ticketMedio) : "—"} subtitulo="Propostas ganhas" />
        <Indicador titulo="REUNIÕES HOJE" valor={visao.agenda ? visao.agenda.hoje : "—"} subtitulo={visao.agenda?.proximos?.[0] ? `Próxima: ${visao.agenda.proximos[0].data.slice(8, 10)}/${visao.agenda.proximos[0].data.slice(5, 7)} ${visao.agenda.proximos[0].hora}` : "Nenhuma marcada"} onClick={() => irPara?.("clientes")} />
      </Grade>

      <Titulo>Saúde da operação</Titulo>
      <Grade min={220}>
        <Indicador
          titulo="ACEITE DOS TERMOS (LGPD)"
          valor={op.aceite?.semDados ? "—" : pctTxt(op.aceite?.cobertura)}
          cor={op.aceite?.cobertura >= 90 ? VERDE : op.aceite?.cobertura >= 60 ? AMBAR : op.aceite?.semDados ? NAVY : VERMELHO}
          subtitulo={op.aceite ? (op.aceite.semDados ? "O registro ainda não começou" : `${op.aceite.semRegistro24h} sem registro nas últimas 24h`) : "Indisponível"}
          onClick={() => irPara?.("lgpd")}
        />
        <Indicador
          titulo="ANÁLISE CONSULTIVA"
          valor={op.analise ? `${op.analise.comAnalise} de ${op.analise.total}` : "—"}
          cor={op.analise?.pendentes ? AMBAR : VERDE}
          subtitulo={op.analise ? `Prioridade A/B com análise · ${op.analise.pendentes} pendente(s)` : "Indisponível"}
          onClick={() => irPara?.("diagnosticos")}
        />
        <Indicador
          titulo="PLANOS 30/60/90"
          valor={op.planos ? pctTxt(op.planos.percentual) : "—"}
          subtitulo={op.planos ? (op.planos.total ? `${op.planos.concluidas} de ${op.planos.total} ações · ${op.planos.bloqueadas} bloqueada(s)` : "Nenhuma ação registrada ainda") : "Indisponível"}
          onClick={() => irPara?.("areas")}
        />
        <Indicador
          titulo="CONTATOS EM ATRASO"
          valor={op.atrasos ? op.atrasos.total : "—"}
          cor={op.atrasos?.total ? VERMELHO : VERDE}
          subtitulo={op.atrasos ? (op.atrasos.total ? `O mais antigo há ${op.atrasos.maisAntigoDias} dia(s)` : "Tudo em dia") : "Indisponível"}
          onClick={() => irPara?.("atendimento")}
        />
      </Grade>

      <Cartao titulo="O que fazer hoje" subtitulo="Em ordem de gravidade. Cada linha leva ao lugar certo para resolver." style={{ marginBottom: 14 }} destaque>
        {atencao.length ? (
          atencao.map((a) => (
            <div key={a.id} style={{ display: "grid", gridTemplateColumns: "6px 1fr auto", gap: 12, alignItems: "center", border: `1px solid ${BORDER}`, borderRadius: 11, padding: "9px 12px", marginBottom: 8 }}>
              <div style={{ alignSelf: "stretch", minHeight: 32, borderRadius: 4, background: COR_NIVEL[a.nivel] || "#C9D2E3" }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 800 }}>{a.titulo}</div>
                <div style={{ fontSize: 10.5, color: MUTED, marginTop: 2, lineHeight: 1.45 }}>{a.detalhe}</div>
              </div>
              <button type="button" onClick={() => irPara?.(a.destino?.aba, a.destino?.filtro)} style={{ border: "1px solid #D8DEEA", background: WHITE, color: NAVY, borderRadius: 8, padding: "6px 11px", fontSize: 10, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
                {a.rotuloAcao || "Abrir"}
              </button>
            </div>
          ))
        ) : (
          <SemDados>Nada pendente por aqui. Contatos em dia, sem ações bloqueadas e sem análises atrasadas.</SemDados>
        )}
      </Cartao>
    </>
  );
}

// ---------------------------------------------------------
// LEADS
// ---------------------------------------------------------
export function AceiteLead({ info }) {
  if (!info) return <span style={{ color: MUTED, fontSize: 10 }}>—</span>;
  if (info.estado === "completo") {
    return (
      <span style={{ color: VERDE, fontSize: 10 }} title={info.ip ? `IP ${info.ip}` : ""}>
        ✔ {formatarMomento(info.registradoEm).slice(0, 16).replace(" às", "")}
        {info.versao ? ` · v${info.versao}` : ""}
      </span>
    );
  }
  if (info.estado === "so_envio") return <span style={{ color: AMBAR, fontSize: 10 }}>Só no envio do diagnóstico</span>;
  if (info.estado === "anterior") return <span style={{ color: MUTED, fontSize: 10 }}>Anterior ao registro</span>;
  return <span style={{ color: VERMELHO, fontSize: 10, fontWeight: 700 }}>Sem registro</span>;
}

export function LeadsExtra({ visao, extra = {} }) {
  const etapas = Array.isArray(extra.jornada?.etapas) ? extra.jornada.etapas : [];
  const base = etapas.length ? Math.max(...etapas.map((e) => Number(e.total || 0)), 1) : 1;
  const queda = maiorQueda(etapas);
  const origens = visao?.leads?.origens || [];

  return (
    <Duas>
      <Cartao titulo="Onde abandonam o formulário" subtitulo="Quantas pessoas chegaram a cada etapa nos últimos 30 dias. A maior queda mostra onde melhorar.">
        {etapas.length ? (
          <>
            {etapas.map((e) => (
              <div key={e.etapa} style={{ display: "grid", gridTemplateColumns: "130px 1fr 74px", gap: 10, alignItems: "center", fontSize: 11, marginBottom: 7 }}>
                <span>{rotuloEtapa(e.etapa)}</span>
                <Barra pct={(Number(e.total || 0) / base) * 100} cor={e.etapa === "resultado" ? "#2FB37C" : "#4F7CFF"} />
                <span style={{ textAlign: "right" }}>
                  <b>{e.total}</b>
                  {e.parados ? <span style={{ color: AMBAR, fontSize: 9.5 }}> · {e.parados} parado(s)</span> : null}
                </span>
              </div>
            ))}
            {queda ? (
              <div style={{ fontSize: 10.5, color: AMBAR, marginTop: 8 }}>
                <b>Maior queda:</b> de “{rotuloEtapa(queda.de)}” para “{rotuloEtapa(queda.para)}” (−{queda.queda}%).
              </div>
            ) : null}
          </>
        ) : (
          <SemDados>Ainda não há movimento registrado do formulário neste período.</SemDados>
        )}
      </Cartao>

      <Cartao titulo="Conversão por origem" subtitulo="Do lead até o contrato, por origem. “Cupom” indica que a origem tem desconto vinculado.">
        <Tabela
          colunas={["Origem", "Leads", "Diag.", "Prop.", "Ganhos", "Receita"]}
          largura={420}
          vazio="Nenhuma origem registrada."
          linhas={origens.map((o) => (
            <tr key={o.origem}>
              <td style={td}>
                <b>{o.origem}</b> {o.cupom ? <Selo texto={`cupom ${o.cupom}`} {...SELO.azul} /> : null}
              </td>
              <td style={td}>{o.leads}</td>
              <td style={td}>{o.diagnosticos}</td>
              <td style={td}>{o.propostas}</td>
              <td style={td}>{o.ganhos}</td>
              <td style={td}>{o.receita ? moedaBR(o.receita) : "—"}</td>
            </tr>
          ))}
        />
      </Cartao>
    </Duas>
  );
}

// ---------------------------------------------------------
// DIAGNÓSTICOS
// ---------------------------------------------------------
export function DiagnosticosExtra({ visao, onAbrirDiagnostico }) {
  const d = visao?.diagnosticos;
  const pend = visao?.analiseConsultiva;
  if (!d) return <SemDados>Indicadores de diagnóstico indisponíveis no momento.</SemDados>;
  const q = d.qualidade || {};

  return (
    <>
      <Duas>
        <Cartao titulo="Qualidade das respostas e IA" subtitulo={`Calculado sobre as respostas dos ${q.diagnosticosAvaliados || 0} diagnósticos mais recentes.`}>
          {[
            ["Respostas avaliáveis", q.avaliaveisPct, "Sem “não sei” nem “N/A”", "#2FB37C"],
            ["Respostas “não sei”", q.naoSeiPct, "Lacuna de conhecimento do cliente", "#F4B740"],
            ["Com análise consultiva", d.comAnalisePct, `${d.comAnalise} de ${d.totalDiagnosticos} diagnósticos`, "#8B6BFF"],
          ].map(([rotulo, valor, dica, cor]) => (
            <div key={rotulo} style={{ marginBottom: 10 }} title={dica}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                <span>{rotulo}</span>
                <b>{pctTxt(valor)}</b>
              </div>
              <Barra pct={valor || 0} cor={cor} />
            </div>
          ))}
        </Cartao>

        <Cartao titulo="Prioridade A/B sem análise consultiva" subtitulo="Quem tem reunião mais próxima deve ter a análise pronta.">
          {pend?.lista?.length ? (
            pend.lista.map((l) => (
              <div key={l.leadId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 11px", marginBottom: 7 }}>
                <div>
                  <b style={{ fontSize: 11.5 }}>{l.empresa}</b> <Selo texto={`Prioridade ${l.prioridade}`} {...(l.prioridade === "A" ? SELO.vermelho : SELO.ambar)} />
                </div>
                <button type="button" onClick={() => onAbrirDiagnostico?.(l.diagnosticoId)} style={{ border: 0, background: "#EEF3FF", color: "#31589C", borderRadius: 7, padding: "6px 9px", fontSize: 9.5, fontWeight: 800, cursor: "pointer" }}>
                  Abrir
                </button>
              </div>
            ))
          ) : (
            <SemDados>{pend && pend.total > 0 ? "Todos os diagnósticos de prioridade A/B já têm análise." : "Nenhum diagnóstico de prioridade A/B por enquanto."}</SemDados>
          )}
          {pend?.pendentes > (pend?.lista?.length || 0) ? <div style={{ fontSize: 10, color: MUTED }}>e mais {pend.pendentes - pend.lista.length} pendente(s)</div> : null}
        </Cartao>
      </Duas>

      <Cartao titulo="Por caso" subtitulo="Os casos do sistema: quantos diagnósticos, nota média, quantos viraram oportunidade e quantos têm análise." style={{ marginBottom: 14 }}>
        <Tabela
          colunas={["Caso", "Diagnósticos", "Nota média", "Oportunidades", "Com análise"]}
          largura={520}
          vazio="Nenhum diagnóstico concluído ainda."
          linhas={d.porCaso.map((c) => (
            <tr key={c.estrutura}>
              <td style={td}><b>{c.rotulo}</b></td>
              <td style={td}>{c.total}</td>
              <td style={td}>{c.notaMedia === null ? "—" : <Selo texto={c.notaMedia} {...(c.notaMedia >= 65 ? SELO.verde : c.notaMedia >= 50 ? SELO.ambar : SELO.vermelho)} />}</td>
              <td style={td}>{c.oportunidades}</td>
              <td style={td}>{c.comAnalise}</td>
            </tr>
          ))}
        />
      </Cartao>
    </>
  );
}

// ---------------------------------------------------------
// REFORMA + PLANEJAMENTO
// ---------------------------------------------------------
export function ReformaExtra({ extra = {} }) {
  const etapas = Array.isArray(extra.fluxo?.etapas) ? extra.fluxo.etapas : [];
  const base = Math.max(...etapas.map((e) => Number(e.total || 0)), 1);
  const parados = etapas.reduce((a, e) => a + Number(e.parados || 0), 0);
  return (
    <Cartao titulo="Funil dos projetos" subtitulo="Projeto criado → documentos → diagnóstico → validado → relatório publicado. “Parados” = 48h ou mais na mesma etapa." style={{ marginBottom: 14 }}>
      {etapas.length ? (
        <>
          {etapas.map((e) => (
            <div key={e.label} style={{ display: "grid", gridTemplateColumns: "130px 1fr 96px", gap: 10, alignItems: "center", fontSize: 11, marginBottom: 7 }}>
              <span>{e.label}</span>
              <Barra pct={(Number(e.total || 0) / base) * 100} cor={e.label === "Publicado" ? "#2FB37C" : "#8B6BFF"} />
              <span style={{ textAlign: "right" }}>
                <b>{e.total}</b>
                {e.parados ? <span style={{ color: AMBAR, fontSize: 9.5 }}> · {e.parados} parado(s)</span> : null}
              </span>
            </div>
          ))}
          <div style={{ fontSize: 10.5, color: parados ? AMBAR : MUTED, marginTop: 6 }}>{parados ? `${parados} projeto(s) parado(s) esperando o próximo passo.` : "Nenhum projeto parado."}</div>
        </>
      ) : (
        <SemDados>O fluxo dos projetos não está disponível no momento.</SemDados>
      )}
    </Cartao>
  );
}

// ---------------------------------------------------------
// ATENDIMENTO
// ---------------------------------------------------------
const FILTROS_ATEND = [
  ["todos", "Todos", null],
  ["atraso", "Contato em atraso", "atraso"],
  ["bloqueada", "Com ação bloqueada", "bloqueadas"],
  ["sem_analise", "Sem análise consultiva", "semAnalise"],
];

export function AtendimentoFiltros({ valor, onChange, contadores }) {
  return (
    <div role="group" aria-label="Filtros de atendimento" style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "10px 0 2px" }}>
      {FILTROS_ATEND.map(([id, rotulo, chave]) => {
        const ativo = valor === id;
        const n = chave && contadores ? contadores[chave] : null;
        return (
          <button key={id} type="button" aria-pressed={ativo} onClick={() => onChange?.(id)} style={{ border: `1px solid ${ativo ? CORAL : "#D8DEEA"}`, background: ativo ? "#FFF3EF" : WHITE, color: ativo ? "#993C1D" : MUTED, borderRadius: 999, padding: "5px 11px", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>
            {rotulo}
            {n !== null && n !== undefined ? ` (${n})` : ""}
          </button>
        );
      })}
    </div>
  );
}

export function AtendimentoSelo({ dados }) {
  if (!dados) return null;
  const pct = dados.planoTotal ? Math.round((dados.planoConcluidas / dados.planoTotal) * 100) : null;
  return (
    <div style={{ marginTop: 7, display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
      {dados.planoTotal ? (
        <span style={{ fontSize: 9.5, color: MUTED }} title="Ações do plano 30/60/90 concluídas">
          Plano {dados.planoConcluidas}/{dados.planoTotal} ({pct}%)
        </span>
      ) : (
        <span style={{ fontSize: 9.5, color: MUTED }}>Plano sem ações salvas</span>
      )}
      {dados.planoBloqueadas ? <Selo texto={`${dados.planoBloqueadas} bloqueada(s)`} {...SELO.vermelho} /> : null}
      {dados.analiseVersao ? <Selo texto={`Análise v${dados.analiseVersao}`} {...SELO.verde} /> : <Selo texto="Sem análise" {...SELO.ambar} />}
      {dados.atrasoDias > 0 ? <Selo texto={`Atrasado ${dados.atrasoDias} dia(s)`} {...SELO.vermelho} /> : null}
    </div>
  );
}

// ---------------------------------------------------------
// ASAAS
// ---------------------------------------------------------
const ROTULO_PLANO = { INICIAL: "Diagnóstico Inicial", COMPLETO: "Diagnóstico Completo", ESPECIALISTA: "Especialista", SEM_PLANO: "Sem plano" };

export function AsaasExtra({ visao }) {
  const a = visao?.asaas;
  if (!a) return <SemDados>Indicadores financeiros adicionais indisponíveis no momento.</SemDados>;
  const ck = a.checkout;
  return (
    <>
      <Duas>
        <Cartao titulo="Conversão do checkout" subtitulo={`Cobranças criadas × pagas nos últimos ${ck.janelaDias} dias.`}>
          <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 44px", gap: 10, alignItems: "center", fontSize: 11, marginBottom: 7 }}>
            <span>Criadas</span>
            <Barra pct={ck.criadas ? 100 : 0} cor="#4F7CFF" />
            <b style={{ textAlign: "right" }}>{ck.criadas}</b>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 44px", gap: 10, alignItems: "center", fontSize: 11, marginBottom: 7 }}>
            <span>Pagas</span>
            <Barra pct={ck.conversaoPct || 0} cor="#2FB37C" />
            <b style={{ textAlign: "right" }}>{ck.pagas}</b>
          </div>
          <div style={{ fontSize: 10.5, color: MUTED, marginTop: 8, lineHeight: 1.5 }}>
            Conversão: <b style={{ color: NAVY }}>{pctTxt(ck.conversaoPct)}</b> · {ck.pendentes} pendente(s) ainda podem ser recuperadas · {ck.falhas} com falha, atraso ou cancelamento.
          </div>
        </Cartao>

        <Cartao titulo="Receita por plano" subtitulo="Pagamentos recebidos, desde o início.">
          <Tabela
            colunas={["Plano", "Vendas", "Bruto", "Líquido"]}
            largura={360}
            vazio="Nenhum pagamento recebido ainda."
            linhas={a.porPlano.map((p) => (
              <tr key={p.plano}>
                <td style={td}>{ROTULO_PLANO[p.plano] || p.plano}</td>
                <td style={td}>{p.vendas}</td>
                <td style={td}>{moedaBR(p.bruto)}</td>
                <td style={td}><b>{moedaBR(p.liquido)}</b></td>
              </tr>
            ))}
          />
        </Cartao>
      </Duas>

      <Duas>
        <Cartao titulo="Receita por origem" subtitulo="De onde vieram os pagamentos recebidos.">
          <Tabela
            colunas={["Origem", "Vendas", "Líquido", "Descontos"]}
            largura={360}
            vazio="Nenhum pagamento ligado a uma origem."
            linhas={a.porOrigem.map((o) => (
              <tr key={o.origem}>
                <td style={td}><b>{o.origem}</b></td>
                <td style={td}>{o.vendas}</td>
                <td style={td}>{moedaBR(o.liquido)}</td>
                <td style={td}>{o.descontos ? moedaBR(o.descontos) : "—"}</td>
              </tr>
            ))}
          />
        </Cartao>
        <Cartao titulo="Cupons mais usados" subtitulo="Quantas vezes cada cupom foi usado em pagamentos recebidos.">
          <Tabela
            colunas={["Cupom", "Usos", "Desconto total", "Líquido"]}
            largura={360}
            vazio="Nenhum cupom usado em pagamentos recebidos."
            linhas={a.porCupom.map((c) => (
              <tr key={c.cupom}>
                <td style={td}><b>{c.cupom}</b></td>
                <td style={td}>{c.usos}</td>
                <td style={td}>{moedaBR(c.descontos)}</td>
                <td style={td}>{moedaBR(c.liquido)}</td>
              </tr>
            ))}
          />
        </Cartao>
      </Duas>
    </>
  );
}

// ---------------------------------------------------------
// ABA ÁREAS
// ---------------------------------------------------------
export function AbaAreas({ visao, carregando }) {
  const a = visao?.areas;
  if (!a) return carregando ? <SemDados>Carregando...</SemDados> : <SemDados>A visão por área não está disponível agora.</SemDados>;
  const maxCarga = Math.max(...a.responsaveis.map((r) => r.abertos), 1);
  const hip = a.hipoteses;
  const totalHip = hip.confirmadas + hip.refutadas;

  return (
    <>
      <Cartao titulo="Desempenho por área" subtitulo="Atendimentos abertos, nota média no diagnóstico, avanço dos planos 30/60/90 e propostas." style={{ marginBottom: 14 }} destaque>
        <Tabela
          colunas={["Área", "Abertos", "Nota média", "Plano concluído", "Bloqueadas", "Contatos em atraso", "Propostas", "Ganhas"]}
          largura={760}
          vazio="Nenhum atendimento por área registrado."
          linhas={a.itens.map((i) => (
            <tr key={i.area}>
              <td style={td}><b>{i.area}</b></td>
              <td style={td}>{i.abertos}</td>
              <td style={td}>{i.notaMedia === null ? "—" : <Selo texto={i.notaMedia} {...(i.notaMedia >= 65 ? SELO.verde : i.notaMedia >= 50 ? SELO.ambar : SELO.vermelho)} />}</td>
              <td style={{ ...td, minWidth: 130 }}>
                {i.planoTotal ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 7, alignItems: "center" }}>
                    <Barra pct={i.planoPercentual} altura={7} />
                    <span style={{ fontSize: 10 }}>{i.planoPercentual}%</span>
                  </div>
                ) : (
                  <span style={{ color: MUTED, fontSize: 10 }}>sem ações salvas</span>
                )}
              </td>
              <td style={td}>{i.bloqueadas ? <Selo texto={i.bloqueadas} {...SELO.vermelho} /> : 0}</td>
              <td style={td}>{i.atrasados ? <Selo texto={i.atrasados} {...SELO.vermelho} /> : 0}</td>
              <td style={td}>{i.propostas}</td>
              <td style={td}>{i.ganhas}</td>
            </tr>
          ))}
        />
        <p style={{ fontSize: 10, color: MUTED, margin: "10px 0 0", lineHeight: 1.5 }}>“Plano concluído” = ações concluídas ÷ ações já salvas nos atendimentos da área. Ações sugeridas que ninguém abriu ainda não entram na conta.</p>
      </Cartao>

      <Duas>
        <Cartao titulo="Carga por responsável" subtitulo="Atendimentos abertos. A capacidade por dia é a cadastrada em Equipe / Capacidade.">
          {a.responsaveis.length ? (
            a.responsaveis.map((r) => (
              <div key={r.id || r.nome} style={{ display: "grid", gridTemplateColumns: "120px 1fr 120px", gap: 10, alignItems: "center", fontSize: 11, marginBottom: 8 }}>
                <span>{r.nome}</span>
                <Barra pct={(r.abertos / maxCarga) * 100} cor={r.atrasados ? "#E5484D" : "#4F7CFF"} />
                <span style={{ textAlign: "right" }}>
                  <b>{r.abertos}</b> aberto(s)
                  {r.atrasados ? <span style={{ color: VERMELHO, fontSize: 9.5 }}> · {r.atrasados} atrasado(s)</span> : null}
                  {r.capacidadeDiaria ? <div style={{ color: MUTED, fontSize: 9 }}>capacidade/dia: {r.capacidadeDiaria}</div> : null}
                </span>
              </div>
            ))
          ) : (
            <SemDados>Nenhum responsável cadastrado.</SemDados>
          )}
        </Cartao>

        <Cartao titulo="Hipóteses validadas" subtitulo="O que as conversas confirmaram ou refutaram na leitura da IA.">
          {totalHip ? (
            <>
              <div style={{ display: "flex", height: 16, borderRadius: 8, overflow: "hidden", margin: "6px 0" }}>
                <div style={{ width: `${(hip.confirmadas / totalHip) * 100}%`, background: "#2FB37C" }} />
                <div style={{ width: `${(hip.refutadas / totalHip) * 100}%`, background: "#E5484D" }} />
              </div>
              <div style={{ fontSize: 10.5, color: MUTED }}>
                <b style={{ color: VERDE }}>{hip.confirmadas}</b> confirmada(s) · <b style={{ color: VERMELHO }}>{hip.refutadas}</b> refutada(s) · a leitura bateu em {pctTxt((hip.confirmadas / totalHip) * 100)} dos casos já avaliados.
              </div>
            </>
          ) : (
            <SemDados>Nenhuma hipótese foi marcada como confirmada ou refutada ainda.</SemDados>
          )}
        </Cartao>
      </Duas>
    </>
  );
}

// ---------------------------------------------------------
// ABA CLIENTES E AGENDA
// ---------------------------------------------------------
function dataCurta(iso) {
  return `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}`;
}

export function AbaClientes({ visao, carregando }) {
  const c = visao?.clientes;
  const ag = visao?.agenda;
  if (!c && !ag) return carregando ? <SemDados>Carregando...</SemDados> : <SemDados>Clientes e agenda não estão disponíveis agora.</SemDados>;

  return (
    <>
      {c ? (
        <Grade>
          <Indicador titulo="CLIENTES NA BASE" valor={c.clientes} subtitulo="Clientes 360º cadastrados" />
          <Indicador titulo="PENDÊNCIAS ABERTAS" valor={c.pendenciasAbertas} subtitulo={`${c.pendenciasVencidas} vencida(s)`} cor={c.pendenciasVencidas ? VERMELHO : NAVY} destaque />
          <Indicador titulo="TAREFAS ABERTAS" valor={c.tarefasAbertas} subtitulo={`${c.tarefasSemana} com prazo nos próximos 7 dias`} />
          <Indicador titulo="DOCUMENTOS" valor={c.documentos.total} subtitulo={`${c.documentos.aguardandoAnalise} aguardando análise`} cor={c.documentos.aguardandoAnalise ? AMBAR : NAVY} />
        </Grade>
      ) : null}

      <Duas>
        <Cartao titulo="Agenda — próximos 7 dias" subtitulo="Reuniões marcadas, em ordem.">
          {ag ? (
            <>
              <Tabela
                colunas={["Quando", "Empresa", "Origem"]}
                largura={340}
                vazio="Nenhuma reunião marcada para os próximos 7 dias."
                linhas={ag.proximos.map((r) => (
                  <tr key={r.id}>
                    <td style={td}><b>{dataCurta(r.data)}</b> {r.hora}</td>
                    <td style={td}>{r.empresa || r.nome || "—"}</td>
                    <td style={td}>{r.origem || "—"}</td>
                  </tr>
                ))}
              />
              <div style={{ fontSize: 10.5, color: MUTED, marginTop: 10, lineHeight: 1.5 }}>
                No mês: {ag.realizadosMes} realizada(s) · {ag.canceladosMes} cancelada(s) · {ag.naoCompareceuMes} falta(s) · comparecimento <b style={{ color: NAVY }}>{pctTxt(ag.comparecimentoPct)}</b>
              </div>
            </>
          ) : (
            <SemDados>A agenda não está disponível agora.</SemDados>
          )}
        </Cartao>

        <Cartao titulo="Pendências vencidas" subtitulo="As mais antigas primeiro.">
          {c?.vencidas?.length ? (
            c.vencidas.map((v, i) => (
              <div key={`${v.titulo}-${i}`} style={{ display: "grid", gridTemplateColumns: "6px 1fr", gap: 11, border: `1px solid ${BORDER}`, borderRadius: 11, padding: "8px 11px", marginBottom: 7 }}>
                <div style={{ borderRadius: 4, background: "#E5484D" }} />
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 800 }}>{v.cliente || "Cliente"}</div>
                  <div style={{ fontSize: 10.5, color: MUTED }}>{v.titulo} · vencida há {v.diasVencida} dia(s)</div>
                </div>
              </div>
            ))
          ) : (
            <SemDados>{c ? "Nenhuma pendência vencida." : "As pendências não estão disponíveis agora."}</SemDados>
          )}
        </Cartao>
      </Duas>
    </>
  );
}

// ---------------------------------------------------------
// ABA LGPD
// ---------------------------------------------------------
const MOTIVO = {
  aceite_so_no_envio: ["Aceite só no envio", SELO.ambar],
  saiu_antes_de_aceitar: ["Saiu antes de aceitar", SELO.cinza],
  sem_registro: ["Sem registro", SELO.vermelho],
};

export function AbaLgpd({ visao, carregando, onAbrirLead }) {
  const l = visao?.lgpd;
  if (!l) return carregando ? <SemDados>Carregando...</SemDados> : <SemDados>O painel de conformidade não está disponível agora.</SemDados>;

  if (l.semDados) {
    return (
      <Cartao titulo="Conformidade LGPD" subtitulo="Aceite dos Termos de Uso">
        <SemDados>O registro do aceite ainda não começou: nenhum lead aceitou os termos depois da ativação. Assim que o primeiro aceite chegar, esta aba mostra a cobertura, as versões dos termos e os leads sem registro.</SemDados>
      </Cartao>
    );
  }

  const p = l.cobertura ?? 0;
  const total = Math.max(l.elegiveis, 1);
  const maxDia = Math.max(...l.porDia.map((d) => d.com + d.sem), 1);

  return (
    <>
      <Duas>
        <Cartao titulo="Cobertura do aceite" subtitulo={`Leads criados desde ${formatarMomento(l.inicioRegistro).slice(0, 10)} (início do registro). Os anteriores não entram na conta.`} destaque>
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <div role="img" aria-label={`Cobertura de ${p}%`} style={{ width: 120, height: 120, borderRadius: "50%", background: `conic-gradient(#2FB37C 0 ${p}%, #EEF1F5 ${p}% 100%)`, display: "grid", placeItems: "center", flex: "none" }}>
              <div style={{ width: 92, height: 92, borderRadius: "50%", background: WHITE, display: "grid", placeItems: "center", textAlign: "center" }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{p}%</div>
                  <div style={{ fontSize: 9, color: MUTED }}>com aceite<br />registrado</div>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: "flex", height: 16, borderRadius: 8, overflow: "hidden", margin: "4px 0 8px" }}>
                <div style={{ width: `${(l.noClique / total) * 100}%`, background: "#2FB37C" }} />
                <div style={{ width: `${(l.soNoEnvio / total) * 100}%`, background: "#4F7CFF" }} />
                <div style={{ width: `${(l.semRegistro / total) * 100}%`, background: "#F4B740" }} />
              </div>
              <div style={{ fontSize: 10.5, color: MUTED, lineHeight: 1.7 }}>
                <span style={{ color: VERDE }}>■</span> Registrado no clique: <b style={{ color: NAVY }}>{l.noClique}</b><br />
                <span style={{ color: AZUL }}>■</span> Só no envio do diagnóstico: <b style={{ color: NAVY }}>{l.soNoEnvio}</b><br />
                <span style={{ color: "#C98A00" }}>■</span> Sem registro: <b style={{ color: NAVY }}>{l.semRegistro}</b>
              </div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 8, lineHeight: 1.5 }}>“Só no envio” quer dizer que o registro no clique não chegou ao lead. A prova existe, mas com o IP e o horário do envio.</div>
            </div>
          </div>
        </Cartao>

        <Cartao titulo="Versão dos termos" subtitulo="Quantos aceites existem de cada versão do texto.">
          <Tabela
            colunas={["Versão", "Aceites", "Desde"]}
            largura={300}
            vazio="Nenhuma versão registrada."
            linhas={l.versoes.map((v) => (
              <tr key={v.versao}>
                <td style={td}>
                  <b>{v.versao}</b> {v.versao === l.versaoEmUso ? <Selo texto="em uso" {...SELO.verde} /> : null}
                </td>
                <td style={td}>{v.total}</td>
                <td style={td}>{v.desde ? formatarMomento(v.desde).slice(0, 10) : "—"}</td>
              </tr>
            ))}
          />
          <div style={{ fontSize: 10, color: MUTED, marginTop: 10, lineHeight: 1.5 }}>Quando o texto dos termos mudar e a versão for atualizada no sistema, esta tabela mostra quantos já aceitaram a nova.</div>
        </Cartao>
      </Duas>

      <Cartao titulo="Leads por dia — com e sem aceite" subtitulo="Últimos 14 dias. Se a barra amarela crescer de repente, algo deixou de registrar. Dias em cinza são anteriores ao registro." style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 110 }}>
          {l.porDia.map((d) => (
            <div key={d.dia} title={`${dataCurta(d.dia)}: ${d.com} com aceite, ${d.sem} sem`} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 2, opacity: d.antesDoRegistro ? 0.4 : 1 }}>
              {d.sem ? <div style={{ height: `${(d.sem / maxDia) * 100}%`, background: d.antesDoRegistro ? "#C9D2E3" : "#F4B740", borderRadius: "3px 3px 0 0" }} /> : null}
              {d.com ? <div style={{ height: `${(d.com / maxDia) * 100}%`, background: d.antesDoRegistro ? "#C9D2E3" : "#2FB37C", borderRadius: d.sem ? 0 : "3px 3px 0 0" }} /> : null}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          {l.porDia.map((d, i) => (
            <span key={d.dia} style={{ flex: 1, textAlign: "center", fontSize: 8.5, color: MUTED }}>
              {i === 0 || i === l.porDia.length - 1 ? dataCurta(d.dia) : ""}
            </span>
          ))}
        </div>
      </Cartao>

      <Cartao titulo="Leads recentes sem aceite registrado" subtitulo="Para investigar um a um.">
        <Tabela
          colunas={["Lead", "Entrou em", "Etapa", "Origem", "Provável motivo", ""]}
          largura={620}
          vazio="Nenhum lead sem aceite desde o início do registro."
          linhas={l.recentesSemAceite.map((r) => {
            const [rotulo, estilo] = MOTIVO[r.motivo] || MOTIVO.sem_registro;
            return (
              <tr key={r.leadId}>
                <td style={td}><b>{r.nome}</b></td>
                <td style={td}>{r.criadoEm ? formatarMomento(r.criadoEm).slice(0, 16) : "—"}</td>
                <td style={td}>{rotuloEtapa(String(r.etapa || "").toLowerCase() === "checklist" ? "checklist" : r.etapa) || "—"}</td>
                <td style={td}>{r.origem}</td>
                <td style={td}><Selo texto={rotulo} {...estilo} /></td>
                <td style={td}>
                  <button type="button" onClick={() => onAbrirLead?.(r.leadId)} style={{ border: 0, background: "#EEF3FF", color: "#31589C", borderRadius: 7, padding: "6px 9px", fontSize: 9.5, fontWeight: 800, cursor: "pointer" }}>
                    Abrir lead
                  </button>
                </td>
              </tr>
            );
          })}
        />
      </Cartao>
    </>
  );
}

// ---------------------------------------------------------
// ABA SISTEMA
// ---------------------------------------------------------
const STATUS_MODULO = {
  OK: ["OK", SELO.verde],
  ERRO: ["Erro", SELO.vermelho],
  LENTO: ["Lento", SELO.ambar],
  SEM_DADOS: ["Sem uso recente", SELO.cinza],
};

export function AbaSistema({ visao, extra = {}, carregando }) {
  const s = visao?.sistema;
  const modulos = Array.isArray(extra.saude?.modulos) ? extra.saude.modulos : [];
  const erros = modulos.filter((m) => m.status === "ERRO").length;
  const lentos = modulos.filter((m) => m.status === "LENTO").length;
  const comDados = modulos.filter((m) => m.status !== "SEM_DADOS").length;
  const arm = extra.armazenamento;
  const deploys = extra.deploys;
  const ultimo = Array.isArray(deploys?.deploys) ? deploys.deploys.find((d) => d.producao) || deploys.deploys[0] : null;

  if (!s && !modulos.length && !arm && !deploys && carregando) return <SemDados>Carregando...</SemDados>;

  return (
    <>
      <Grade min={220}>
        <Indicador
          titulo="MÓDULOS DE IA E INTEGRAÇÕES"
          valor={modulos.length ? `${comDados - erros - lentos} de ${comDados} ok` : "—"}
          cor={erros ? VERMELHO : lentos ? AMBAR : VERDE}
          subtitulo={modulos.length ? (erros ? `${erros} com erro na última execução` : lentos ? `${lentos} mais lento(s) que o normal` : "Nenhum erro na última execução") : "Sem dados de saúde disponíveis"}
        />
        <Indicador titulo="BANCO DE DADOS" valor={arm ? bytesTxt(arm.bancoBytes) : "—"} subtitulo={arm ? `Documentos de clientes: ${bytesTxt(arm.blobClientes?.bytes)} em ${arm.blobClientes?.totalArquivos || 0} arquivo(s)` : "Indisponível"} />
        <Indicador
          titulo="ÚLTIMA PUBLICAÇÃO"
          valor={deploys && deploys.configurado === false ? "—" : ultimo ? (ultimo.estado === "READY" ? "Pronta" : ultimo.estado === "ERROR" ? "Falhou" : ultimo.estado === "BUILDING" ? "Em andamento" : ultimo.estado) : "—"}
          cor={ultimo?.estado === "ERROR" ? VERMELHO : ultimo?.estado === "READY" ? VERDE : NAVY}
          subtitulo={deploys && deploys.configurado === false ? "Publicações não configuradas (VERCEL_API_TOKEN)" : ultimo ? `${ultimo.mensagemCommit || "Sem mensagem"}${ultimo.criadoEm ? ` · ${formatarMomento(ultimo.criadoEm).slice(0, 16)}` : ""}` : "Indisponível"}
        />
        <Indicador titulo="USUÁRIOS ATIVOS" valor={s ? s.usuarios.ativos : "—"} subtitulo={s ? (s.usuarios.ultimoAcesso ? `${s.usuarios.acessaramHoje} acessaram hoje · último: ${s.usuarios.ultimoAcesso.nome}` : `${s.usuarios.acessaramHoje} acessaram hoje`) : "Indisponível"} />
      </Grade>

      <Duas>
        <Cartao titulo="Saúde por módulo" subtitulo="Última execução e tempo médio das últimas 20 chamadas.">
          <Tabela
            colunas={["Módulo", "Situação", "Última duração", "Média", "Chamadas (30 dias)"]}
            largura={520}
            vazio="Sem dados de saúde disponíveis."
            linhas={modulos.map((m) => {
              const [rotulo, estilo] = STATUS_MODULO[m.status] || STATUS_MODULO.SEM_DADOS;
              return (
                <tr key={m.modulo}>
                  <td style={td}><b>{m.modulo}</b></td>
                  <td style={td}><Selo texto={rotulo} {...estilo} /></td>
                  <td style={td}>{m.ultimaDuracaoMs === null || m.ultimaDuracaoMs === undefined ? "—" : `${(m.ultimaDuracaoMs / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`}</td>
                  <td style={td}>{m.mediaDuracaoMs ? `${(m.mediaDuracaoMs / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s` : "—"}</td>
                  <td style={td}>{m.totalEventos30d}</td>
                </tr>
              );
            })}
          />
        </Cartao>

        <Cartao titulo="Atividade recente (auditoria)" subtitulo="O que mudou nos dados e por quem.">
          {s?.auditoria?.length ? (
            s.auditoria.map((a, i) => (
              <div key={`${a.quando}-${i}`} style={{ display: "grid", gridTemplateColumns: "92px 1fr", gap: 10, fontSize: 11, padding: "6px 0", borderTop: i ? `1px solid ${BORDER}` : "none" }}>
                <span style={{ color: MUTED, fontSize: 10 }}>{a.quando ? formatarMomento(a.quando).slice(0, 16) : "—"}</span>
                <span>
                  <b>{a.usuario}</b> · {a.descricao}
                  {a.destaque ? <> <Selo texto="exclusão" {...SELO.vermelho} /></> : null}
                </span>
              </div>
            ))
          ) : (
            <SemDados>{s ? "Nenhuma atividade registrada." : "A auditoria não está disponível agora."}</SemDados>
          )}
        </Cartao>
      </Duas>
    </>
  );
}
