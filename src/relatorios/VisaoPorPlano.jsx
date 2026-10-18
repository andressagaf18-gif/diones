// src/relatorios/VisaoPorPlano.jsx
// Prévia, no painel da administração, do que o CLIENTE vê em cada plano do
// diagnóstico (R$ 29,90 / R$ 299,90 / R$ 799,90), mesmo que ele não tenha
// pago. Segue as mesmas regras de liberação da tela do cliente (App.jsx):
//   INICIAL      → entendimento, resumo, prioridades, próximo passo, leitura executiva
//   COMPLETO     → tudo do Inicial + plano 30/60/90, leitura da dor, conexões, impactos,
//                  pontos fortes e alerta estratégico (e PDF executivo)
//   ESPECIALISTA → tudo do Completo + análise individual com especialista Finder
// É só leitura e de uso interno: não altera nada do diagnóstico nem do pagamento.

import { periodosDoPlano, AVISO_PLANO } from "./planoCliente.js";

const NAVY = "#17233D";
const CORAL = "#FF6B4A";
const MUTED = "#5B667A";
const BORDER = "#E3E7EF";

export const PLANOS_VISAO = {
  INICIAL: { codigo: "INICIAL", nome: "Diagnóstico Inicial", valor: "R$ 29,90", nivel: 1 },
  COMPLETO: { codigo: "COMPLETO", nome: "Diagnóstico Completo", valor: "R$ 299,90", nivel: 2 },
  ESPECIALISTA: { codigo: "ESPECIALISTA", nome: "Diagnóstico + Especialista", valor: "R$ 799,90", nivel: 3 },
};

const PAGO = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];

export function planoMaisAltoPago(pagamentos) {
  let melhor = "";
  for (const p of Array.isArray(pagamentos) ? pagamentos : []) {
    const cod = String(p?.plano || "").toUpperCase();
    if (!PAGO.includes(String(p?.status || "").toUpperCase()) || !PLANOS_VISAO[cod]) continue;
    if (!melhor || PLANOS_VISAO[cod].nivel > PLANOS_VISAO[melhor].nivel) melhor = cod;
  }
  return melhor;
}

function textoDe(x) {
  if (x === null || x === undefined) return "";
  if (typeof x === "string") return x.trim();
  if (typeof x === "number") return String(x);
  if (typeof x === "object") {
    const t = x.titulo || x.texto || x.descricao || x.item || x.acao || x.label || "";
    const d = x.descricao && x.titulo ? x.descricao : x.porque || x.motivo || "";
    return [t, d].filter(Boolean).join(" — ").trim();
  }
  return "";
}

function listaDe(v) {
  return (Array.isArray(v) ? v : v ? [v] : []).map(textoDe).filter(Boolean);
}

function Titulo({ children }) {
  return <p style={{ fontSize: 13, fontWeight: 800, color: NAVY, margin: "16px 0 8px" }}>{children}</p>;
}

function Lista({ itens }) {
  if (!itens.length) return null;
  return (
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      {itens.map((t, i) => (
        <li key={i} style={{ fontSize: 12, lineHeight: 1.55, color: NAVY, marginBottom: 4 }}>{t}</li>
      ))}
    </ul>
  );
}

export default function VisaoPorPlano({ plano, diagnosticoGeral = {}, plano90Dias = null, negocio = {}, descricaoNegocio = "", score = null, nivel = "", planoPago = "", onIrParaAdministracao }) {
  const def = PLANOS_VISAO[plano] || PLANOS_VISAO.INICIAL;
  const completo = def.nivel >= 2;
  const especialista = def.nivel >= 3;
  const g = diagnosticoGeral && typeof diagnosticoGeral === "object" ? diagnosticoGeral : {};

  const manchete = textoDe(g.manchete);
  const prioridades = (Array.isArray(g.prioridadesComPrazo) ? g.prioridadesComPrazo : []).filter((p) => p && p.titulo);
  const proximoPasso = textoDe(g.proximoPasso);
  const resumo = textoDe(g.resumoExecutivo);
  const leituraDor = textoDe(g.leituraDaDor);
  const causas = listaDe(g.causasProvaveis);
  const impactos = listaDe(g.impactos);
  const fortes = listaDe(g.pontosFortes);
  const alerta = textoDe(g.alertaEstrategico);
  const periodos = completo ? periodosDoPlano(plano90Dias, (l) => listaDe(l)) : [];
  const neg = negocio && typeof negocio === "object" ? negocio : {};
  const entendimento = neg.subsegmento || neg.segmento || "";

  const bloqueados = [];
  if (!completo) {
    if (periodosDoPlano(plano90Dias, (l) => listaDe(l)).length) bloqueados.push("Plano inicial 30/60/90 dias");
    if (leituraDor) bloqueados.push("Leitura do que as respostas mostram");
    if (causas.length) bloqueados.push("Conexões que merecem atenção");
    if (impactos.length) bloqueados.push("Onde isso pode estar impactando");
    if (fortes.length) bloqueados.push("O que já está funcionando a favor");
    if (alerta) bloqueados.push("Alerta estratégico");
    bloqueados.push("PDF executivo do diagnóstico completo");
  }

  return (
    <div>
      <div style={{ background: "#EEF3FF", border: "1px solid #D5E0FA", borderRadius: 12, padding: "11px 14px", marginBottom: 14, fontSize: 12, lineHeight: 1.55, color: NAVY }}>
        <b>Prévia do plano {def.nome} ({def.valor}).</b> Mostra o que o cliente vê neste plano, com base no diagnóstico já gerado
        {" "}— não importa se ele pagou.{" "}
        {planoPago ? (
          <span>Este cliente pagou: <b>{PLANOS_VISAO[planoPago].nome} ({PLANOS_VISAO[planoPago].valor})</b>.</span>
        ) : (
          <span>Este cliente <b>ainda não tem pagamento confirmado</b>.</span>
        )}
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: CORAL, letterSpacing: 0.7 }}>{def.nome.toUpperCase()}</div>
          {score !== null && score !== undefined && score !== "" ? (
            <div style={{ fontSize: 12, color: MUTED }}>Score <b style={{ color: NAVY, fontSize: 16 }}>{score}</b>{nivel ? ` · ${nivel}` : ""}</div>
          ) : null}
        </div>

        <Titulo>O que entendemos sobre o seu negócio</Titulo>
        <div style={{ background: "#F7F8FB", border: "1px solid #E6E9EF", borderRadius: 12, padding: 13 }}>
          <p style={{ fontSize: 12, color: NAVY, margin: 0, lineHeight: 1.55 }}>
            <b>{entendimento || "Negócio informado pelo cliente"}</b>
            {neg.modeloOperacional ? ` — ${neg.modeloOperacional}` : ""}.
          </p>
          {descricaoNegocio ? <p style={{ fontSize: 11.5, color: MUTED, margin: "7px 0 0", lineHeight: 1.5 }}>Com base no que você informou, entendemos sua operação como: {descricaoNegocio}.</p> : null}
        </div>

        {manchete ? (
          <div style={{ background: NAVY, color: "#fff", borderRadius: 12, padding: "13px 14px", marginTop: 14 }}>
            <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.7, color: "#FFB9A6", margin: "0 0 5px" }}>EM RESUMO</p>
            <p style={{ fontSize: 15.5, lineHeight: 1.35, margin: 0, fontFamily: "Georgia, serif" }}>{manchete}</p>
          </div>
        ) : null}

        {prioridades.length ? (
          <>
            <Titulo>Suas 3 prioridades</Titulo>
            <div style={{ display: "grid", gap: 8 }}>
              {prioridades.slice(0, 3).map((p, i) => (
                <div key={i} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <b style={{ fontSize: 12.5, color: NAVY }}>{i + 1}. {textoDe(p.titulo)}</b>
                    {p.prazo ? <span style={{ fontSize: 10, background: "#FFF3EF", color: CORAL, padding: "2px 8px", borderRadius: 999, fontWeight: 700, whiteSpace: "nowrap" }}>{textoDe(p.prazo)}</span> : null}
                  </div>
                  {p.porque ? <p style={{ fontSize: 11.5, color: MUTED, margin: "5px 0 0", lineHeight: 1.45 }}>{textoDe(p.porque)}</p> : null}
                </div>
              ))}
            </div>
          </>
        ) : null}

        {proximoPasso ? (
          <div style={{ background: "#EEF3FF", borderLeft: "4px solid #31589C", borderRadius: 10, padding: 12, marginTop: 14 }}>
            <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.7, color: "#31589C", margin: "0 0 4px" }}>PRÓXIMO PASSO</p>
            <p style={{ fontSize: 12.5, color: NAVY, margin: 0, lineHeight: 1.5 }}>{proximoPasso}</p>
          </div>
        ) : null}

        {resumo ? (
          <>
            <Titulo>Leitura executiva</Titulo>
            <div style={{ background: "#FFF3EF", borderLeft: `4px solid ${CORAL}`, borderRadius: 10, padding: 13 }}>
              <p style={{ fontSize: 12.5, color: NAVY, margin: 0, lineHeight: 1.6 }}>{resumo}</p>
            </div>
          </>
        ) : null}

        {periodos.length ? (
          <>
            <Titulo>Plano inicial 30/60/90 dias</Titulo>
            <div style={{ display: "grid", gap: 8 }}>
              {periodos.map((p) => (
                <div key={p.chave} style={{ border: `1px solid ${BORDER}`, borderLeft: `4px solid ${p.cor}`, borderRadius: 10, padding: 10 }}>
                  <b style={{ fontSize: 10, color: CORAL }}>{p.curto}</b>
                  <Lista itens={p.itens} />
                </div>
              ))}
            </div>
            <p style={{ fontSize: 10.5, color: MUTED, fontStyle: "italic", margin: "6px 0 0" }}>{AVISO_PLANO}</p>
          </>
        ) : null}

        {completo && leituraDor ? (<><Titulo>O que suas respostas estão mostrando</Titulo><p style={{ fontSize: 12.5, lineHeight: 1.6, color: NAVY, margin: 0 }}>{leituraDor}</p></>) : null}
        {completo && causas.length ? (<><Titulo>Conexões que merecem atenção</Titulo><Lista itens={causas} /></>) : null}
        {completo && impactos.length ? (<><Titulo>Onde isso pode estar impactando</Titulo><Lista itens={impactos} /></>) : null}
        {completo && fortes.length ? (<><Titulo>O que já está funcionando a seu favor</Titulo><Lista itens={fortes} /></>) : null}
        {completo && alerta ? (
          <>
            <Titulo>Alerta estratégico</Titulo>
            <div style={{ background: "#FFF8E8", border: "1px solid #F2D79A", borderRadius: 10, padding: 12, fontSize: 12.5, lineHeight: 1.55, color: "#7A5200" }}>{alerta}</div>
          </>
        ) : null}

        {!completo ? (
          <div style={{ marginTop: 18, border: `1px dashed ${CORAL}`, borderRadius: 12, padding: 12, background: "#FFFBF9" }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: NAVY, margin: "0 0 5px" }}>Bloqueado neste plano (o cliente vê o convite para fazer upgrade)</p>
            <Lista itens={bloqueados} />
          </div>
        ) : null}

        {especialista ? (
          <div style={{ marginTop: 18, background: NAVY, color: "#fff", borderRadius: 14, padding: 16 }}>
            <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.7, color: "#FFB9A6", margin: "0 0 5px" }}>ACOMPANHAMENTO DO CONSULTOR</p>
            <p style={{ fontSize: 15, fontFamily: "Georgia, serif", margin: "0 0 6px" }}>Análise individual com especialista Finder</p>
            <p style={{ fontSize: 11.5, color: "#D7DDEA", margin: 0, lineHeight: 1.5 }}>
              Além do diagnóstico completo, o cliente deste plano tem uma análise individual com um especialista da Finder, que valida os riscos e transforma as prioridades em plano de ação.
            </p>
          </div>
        ) : null}
      </div>

      {especialista ? (
        <div style={{ maxWidth: 680, margin: "12px auto 0", background: "#fff", border: `1px solid ${BORDER}`, borderLeft: "4px solid #31589C", borderRadius: 12, padding: "12px 16px", fontSize: 12, lineHeight: 1.55, color: NAVY }}>
          <b>Para o consultor (interno):</b> a leitura aberta da IA, com hipóteses, perguntas, caminhos, plano detalhado, roteiro da reunião e referências do setor, fica na aba <b>Relatório Administração</b>.
          {onIrParaAdministracao ? (
            <button type="button" onClick={onIrParaAdministracao} style={{ marginLeft: 8, border: "1px solid #D8DEEA", background: "#fff", color: NAVY, borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              Abrir
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
