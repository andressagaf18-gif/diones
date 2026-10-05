// src/lgpd/ConsentimentoLGPD.jsx
// Prova do aceite dos Termos de Uso (LGPD), para o painel administrativo.
//   <SeloConsentimento consentimento={lead.consentimento} />   linha compacta
//   <ConsentimentoLGPD dados={lead.consentimento} />            bloco completo (já carregado)
//   <ConsentimentoLGPD token diagnosticoId />                   bloco completo (carrega sozinho)

import { useEffect, useMemo, useState } from "react";

const NAVY = "#17233D";
const MUTED = "#5B667A";
const BORDER = "#E3E7EF";
const SOFT = "#F7F9FC";

// ---------------------------------------------------------
// FUNÇÕES PURAS (testáveis)
// ---------------------------------------------------------
export function formatarMomento(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    .replace(", ", " às ");
}

export function resumirNavegador(ua) {
  const u = String(ua || "");
  if (!u) return "";
  const sistema = /iPhone|iPad|iPod/.test(u)
    ? "iOS"
    : /Android/.test(u)
    ? "Android"
    : /Windows/.test(u)
    ? "Windows"
    : /Mac OS X|Macintosh/.test(u)
    ? "macOS"
    : /Linux|X11/.test(u)
    ? "Linux"
    : "";
  const navegador = /Edg\//.test(u)
    ? "Edge"
    : /OPR\/|Opera/.test(u)
    ? "Opera"
    : /SamsungBrowser/.test(u)
    ? "Samsung Internet"
    : /FxiOS|Firefox\//.test(u)
    ? "Firefox"
    : /CriOS|Chrome\//.test(u)
    ? "Chrome"
    : /Safari\//.test(u)
    ? "Safari"
    : "";
  const aparelho = /iPad|Tablet/.test(u) ? "tablet" : /Mobile|iPhone|Android/.test(u) ? "celular" : "computador";
  return [navegador, sistema, aparelho].filter(Boolean).join(" · ");
}

export function classificarRegistro(c) {
  if (!c || typeof c !== "object") return "nenhum";
  if (c.legado || (!c.registradoEm && !c.hashTermos)) return c.aceitoEmCliente ? "legado" : "nenhum";
  return "completo";
}

// Texto para quando o aceite foi feito antes de ser registrado (visita anterior
// ou conexão lenta) ou quando o relógio do aparelho está errado.
export function observacaoRelogio(segundos) {
  if (segundos === null || segundos === undefined || !Number.isFinite(segundos)) return "";
  if (segundos > 600) {
    const horas = segundos / 3600;
    const tempo = horas >= 48 ? `${Math.round(horas / 24)} dias` : horas >= 2 ? `${Math.round(horas)} horas` : `${Math.round(segundos / 60)} minutos`;
    return `O aceite foi feito cerca de ${tempo} antes do registro (visita anterior ou conexão lenta).`;
  }
  if (segundos < -600) return "O relógio do aparelho estava adiantado em relação ao servidor: vale o horário do registro.";
  return "";
}

export function localizacao(c) {
  return [c?.cidade, c?.regiao, c?.pais].filter(Boolean).join(" · ");
}

export function comprovanteTexto(c, contexto = {}) {
  const tipo = classificarRegistro(c);
  if (tipo === "nenhum") return "Sem registro de aceite dos Termos de Uso.";
  const linhas = [
    "COMPROVANTE DE ACEITE — TERMOS DE USO (LGPD)",
    contexto.identificacao ? `Titular: ${contexto.identificacao}` : "",
    c.registradoEm ? `Registrado em (Brasília): ${formatarMomento(c.registradoEm)}` : "",
    c.aceitoEmCliente ? `Aceite informado pelo navegador (Brasília): ${formatarMomento(c.aceitoEmCliente)}` : "",
    c.versaoTermos ? `Versão dos termos: ${c.versaoTermos}` : "",
    c.hashTermos ? `Impressão digital do texto (SHA-256): ${c.hashTermos}` : "",
    c.ip ? `IP: ${c.ip}` : "",
    localizacao(c) ? `Localização aproximada: ${localizacao(c)}` : "",
    c.userAgent ? `Dispositivo: ${resumirNavegador(c.userAgent)} (${c.userAgent})` : "",
    c.idioma ? `Idioma: ${c.idioma}` : "",
    c.fusoHorario ? `Fuso horário: ${c.fusoHorario}` : "",
    c.tela ? `Tela: ${c.tela}` : "",
    c.forma ? `Forma do aceite: ${c.forma}` : "",
    c.origemDoRegistro === "diagnostico" ? "Observação: registrado no envio do diagnóstico, não no momento do aceite." : "",
    tipo === "legado" ? "Observação: registro antigo, apenas com a data informada pelo navegador." : "",
  ];
  return linhas.filter(Boolean).join("\n");
}

async function buscar(token, url) {
  const resposta = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok || !dados?.sucesso) throw new Error(dados?.error || `Não foi possível carregar (${resposta.status}).`);
  return dados;
}

// ---------------------------------------------------------
// LINHA COMPACTA (lista de leads)
// ---------------------------------------------------------
export function SeloConsentimento({ consentimento }) {
  const tipo = classificarRegistro(consentimento);
  const base = { fontSize: 10, marginTop: 3, lineHeight: 1.4 };

  if (tipo === "nenhum") {
    return <div style={{ ...base, color: "#8A5A00" }}>Sem registro de aceite dos termos</div>;
  }
  const quando = formatarMomento(consentimento.registradoEm || consentimento.aceitoEmCliente);
  return (
    <div style={{ ...base, color: tipo === "completo" ? "#0F6E56" : MUTED }} title={tipo === "legado" ? "Registro antigo: só a data informada pelo navegador." : "Aceite dos Termos de Uso registrado"}>
      {tipo === "completo" ? "✔ " : "• "}Aceitou os termos em {quando}
      {consentimento.versaoTermos ? ` · v${consentimento.versaoTermos}` : ""}
      {consentimento.ip ? ` · IP ${consentimento.ip}` : ""}
    </div>
  );
}

// ---------------------------------------------------------
// BLOCO COMPLETO
// ---------------------------------------------------------
function Campo({ rotulo, children, title }) {
  if (children === "" || children === null || children === undefined) return null;
  return (
    <div title={title}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.4, color: MUTED, textTransform: "uppercase", marginBottom: 2 }}>{rotulo}</div>
      <div style={{ fontSize: 11.5, overflowWrap: "anywhere", color: NAVY }}>{children}</div>
    </div>
  );
}

function Selo({ texto, fundo, cor }) {
  return <span style={{ background: fundo, color: cor, fontSize: 9.5, fontWeight: 800, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{texto}</span>;
}

export default function ConsentimentoLGPD({ token, leadId, diagnosticoId, dados, identificacao = "" }) {
  const externo = dados !== undefined;
  const [carregado, setCarregado] = useState({ carregando: !externo, fonte: "", consentimento: null, erro: "" });
  const [texto, setTexto] = useState({ aberto: false, carregando: false, conteudo: "", erro: "" });
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (externo) return undefined;
    let vivo = true;
    setCarregado({ carregando: true, fonte: "", consentimento: null, erro: "" });
    const consulta = diagnosticoId
      ? `diagnosticoId=${encodeURIComponent(diagnosticoId)}`
      : `leadId=${encodeURIComponent(leadId || "")}`;
    buscar(token, `/api/crm?action=consentimento&${consulta}`)
      .then((d) => vivo && setCarregado({ carregando: false, fonte: d.fonte, consentimento: d.consentimento, erro: "" }))
      .catch((e) => vivo && setCarregado({ carregando: false, fonte: "", consentimento: null, erro: e.message }));
    return () => {
      vivo = false;
    };
  }, [externo, token, leadId, diagnosticoId]);

  const visao = useMemo(
    () => (externo ? { carregando: false, fonte: dados ? "lead" : "nenhuma", consentimento: dados || null, erro: "" } : carregado),
    [externo, dados, carregado]
  );
  const c = visao.consentimento;
  const tipo = classificarRegistro(c);

  async function verTexto() {
    if (texto.aberto) {
      setTexto((t) => ({ ...t, aberto: false }));
      return;
    }
    setTexto({ aberto: true, carregando: true, conteudo: "", erro: "" });
    try {
      const d = await buscar(token, `/api/crm?action=termos-uso-texto&hash=${encodeURIComponent(c.hashTermos)}`);
      setTexto({ aberto: true, carregando: false, conteudo: d.texto, erro: "" });
    } catch (e) {
      setTexto({ aberto: true, carregando: false, conteudo: "", erro: e.message });
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(comprovanteTexto(c, { identificacao }));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  const chip =
    tipo === "completo"
      ? { texto: "Aceite registrado", fundo: "#E9F7EF", cor: "#0F6E56" }
      : tipo === "legado"
      ? { texto: "Aceite sem detalhes", fundo: "#FFF4D6", cor: "#8A5A00" }
      : { texto: "Sem registro de aceite", fundo: "#EEF0F5", cor: MUTED };

  return (
    <section aria-label="Consentimento LGPD" style={{ background: "#fff", border: `1px solid ${BORDER}`, borderLeft: `4px solid ${chip.cor}`, borderRadius: 14, padding: "13px 15px", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 900, color: MUTED, letterSpacing: 0.5 }}>LGPD · TERMOS DE USO</div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Consentimento</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Selo {...chip} />
          {tipo === "completo" ? (
            <button type="button" onClick={copiar} style={{ border: "1px solid #D8DEEA", background: "#fff", color: NAVY, borderRadius: 8, padding: "5px 10px", fontSize: 10, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              {copiado ? "Copiado ✓" : "Copiar comprovante"}
            </button>
          ) : null}
        </div>
      </div>

      {visao.carregando ? <div style={{ fontSize: 11.5, color: MUTED }}>Carregando consentimento...</div> : null}
      {visao.erro ? <div role="alert" style={{ fontSize: 11.5, color: "#B3261E" }}>{visao.erro}</div> : null}

      {!visao.carregando && !visao.erro && tipo === "nenhum" ? (
        <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.55 }}>
          Não há registro do aceite dos Termos de Uso para este contato. Isso ocorre com contatos anteriores ao registro do aceite ou que não chegaram a aceitar os termos.
        </div>
      ) : null}

      {tipo === "legado" ? (
        <div style={{ fontSize: 11.5, lineHeight: 1.55 }}>
          Registro antigo: só consta a data informada pelo navegador, <b>{formatarMomento(c.aceitoEmCliente)}</b> (Brasília). Não há IP, versão dos termos nem horário do servidor.
        </div>
      ) : null}

      {tipo === "completo" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
            <Campo rotulo="Data e hora do registro (Brasília)" title={c.registradoEm}>{formatarMomento(c.registradoEm)}</Campo>
            <Campo rotulo="Aceite informado pelo navegador" title={c.aceitoEmCliente}>{c.aceitoEmCliente ? formatarMomento(c.aceitoEmCliente) : ""}</Campo>
            <Campo rotulo="Versão dos termos">{c.versaoTermos}</Campo>
            <Campo rotulo="Identificação do texto (SHA-256)" title={c.hashTermos}>{c.hashTermos ? `${c.hashTermos.slice(0, 16)}…` : ""}</Campo>
            <Campo rotulo="IP">{c.ip}</Campo>
            <Campo rotulo="Localização aproximada">{localizacao(c)}</Campo>
            <Campo rotulo="Dispositivo" title={c.userAgent}>{resumirNavegador(c.userAgent)}</Campo>
            <Campo rotulo="Idioma · fuso · tela">{[c.idioma, c.fusoHorario, c.tela].filter(Boolean).join(" · ")}</Campo>
            <Campo rotulo="Forma do aceite">{c.forma}</Campo>
            <Campo rotulo="Onde foi registrado">
              {c.origemDoRegistro === "diagnostico" ? "No envio do diagnóstico (não houve registro no momento do aceite)" : "No momento do aceite, no lead"}
            </Campo>
          </div>

          {observacaoRelogio(c.diferencaRelogioSeg) ? <div style={{ fontSize: 10.5, color: MUTED, marginTop: 9 }}>{observacaoRelogio(c.diferencaRelogioSeg)}</div> : null}

          {c.envio ? (
            <div style={{ fontSize: 10.5, color: MUTED, marginTop: 9 }}>
              Envio do diagnóstico: {formatarMomento(c.envio.registradoEm)}
              {c.envio.ip ? ` · IP ${c.envio.ip}` : ""}
              {c.envio.ip && c.ip && c.envio.ip !== c.ip ? " (diferente do IP do aceite)" : ""}
            </div>
          ) : null}

          {Array.isArray(c.historico) && c.historico.length ? (
            <div style={{ marginTop: 10, fontSize: 10.5, color: MUTED }}>
              <b style={{ color: NAVY }}>Aceites anteriores (outras versões dos termos):</b>
              {c.historico.map((h, i) => (
                <div key={i}>• v{h.versaoTermos || "?"} · {formatarMomento(h.registradoEm || h.aceitoEmCliente)}{h.ip ? ` · IP ${h.ip}` : ""}</div>
              ))}
            </div>
          ) : null}

          {c.hashTermos ? (
            <div style={{ marginTop: 10 }}>
              <button type="button" onClick={verTexto} style={{ background: "none", border: "none", padding: 0, color: "#1D4ED8", fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                {texto.aberto ? "Ocultar texto aceito" : "Ver o texto aceito"}
              </button>
              {texto.aberto ? (
                <div style={{ marginTop: 6, background: SOFT, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "9px 11px", maxHeight: 240, overflowY: "auto", fontSize: 11, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                  {texto.carregando ? "Carregando..." : texto.erro ? <span style={{ color: "#B3261E" }}>{texto.erro}</span> : texto.conteudo}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
