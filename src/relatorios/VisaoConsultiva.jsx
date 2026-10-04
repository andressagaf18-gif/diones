// src/relatorios/VisaoConsultiva.jsx
// Relatório da administração — camada ABERTA e CONSULTIVA.
//
// Não entrega conclusão fechada: abre o raciocínio (leitura, hipóteses,
// perguntas, caminhos com prós e contras, recomendação com o porquê) e traz o
// plano 30/60/90 detalhado e o roteiro da reunião. Uso interno — nunca vai ao
// cliente. É gerada em chamada separada (api/diagnosticos, ações
// consultivo-obter e consultivo-gerar) para não atrasar o resultado do cliente.

import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

const NAVY = "#17233D";
const CORAL = "#FF6B4A";
const MUTED = "#5B667A";
const BORDER = "#E3E7EF";
const SOFT = "#F7F9FC";

const NIVEL_ROTULO = { BAIXO: "baixo", MEDIO: "médio", ALTO: "alto" };
const PRAZO_COR = { 30: "#2FB37C", 60: "#4F7CFF", 90: "#8B6BFF" };

// ---------------------------------------------------------
// FUNÇÕES PURAS (testáveis)
// ---------------------------------------------------------
const norm = (v) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Zona de decisão de cada combinação impacto × esforço.
export const ZONAS = {
  "ALTO|BAIXO": { rotulo: "Começar já", fundo: "#E9F7EF", cor: "#0F6E56" },
  "ALTO|MEDIO": { rotulo: "Priorizar", fundo: "#EAF4EE", cor: "#0F6E56" },
  "ALTO|ALTO": { rotulo: "Planejar", fundo: "#EEF3FF", cor: "#1D4ED8" },
  "MEDIO|BAIXO": { rotulo: "Encaixar", fundo: "#EEF3FF", cor: "#1D4ED8" },
  "MEDIO|MEDIO": { rotulo: "Avaliar", fundo: "#FFF4D6", cor: "#8A5A00" },
  "MEDIO|ALTO": { rotulo: "Reavaliar", fundo: "#FFF4D6", cor: "#8A5A00" },
  "BAIXO|BAIXO": { rotulo: "Se sobrar tempo", fundo: "#F1F3F7", cor: MUTED },
  "BAIXO|MEDIO": { rotulo: "Adiar", fundo: "#F1F3F7", cor: MUTED },
  "BAIXO|ALTO": { rotulo: "Adiar", fundo: "#F1F3F7", cor: MUTED },
};

export function classificarMatriz(plano) {
  const celulas = {};
  for (const imp of ["ALTO", "MEDIO", "BAIXO"]) {
    for (const esf of ["BAIXO", "MEDIO", "ALTO"]) celulas[`${imp}|${esf}`] = [];
  }
  const semClassificacao = [];

  for (const p of Array.isArray(plano) ? plano : []) {
    const item = { prazo: p?.prazo, texto: p?.acao || p?.objetivo || "" };
    if (!item.texto) continue;
    const chave = `${p?.impacto}|${p?.esforco}`;
    if (celulas[chave]) celulas[chave].push(item);
    else semClassificacao.push(item);
  }
  return { celulas, semClassificacao };
}

export function agruparPlanoPorPrazo(plano) {
  const grupos = { 30: [], 60: [], 90: [] };
  for (const p of Array.isArray(plano) ? plano : []) {
    if (grupos[p?.prazo]) grupos[p.prazo].push(p);
  }
  return grupos;
}

export function encontrarArea(areasDoRelatorio, eixo) {
  const lista = Array.isArray(areasDoRelatorio) ? areasDoRelatorio : [];
  return (
    lista.find((a) => norm(a?.id || a?.areaId) === norm(eixo.eixoId)) ||
    lista.find((a) => norm(a?.area || a?.label) === norm(eixo.label)) ||
    null
  );
}

function dataHora(valor) {
  const d = new Date(valor);
  if (!valor || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function chamarApi(token, metodo, action, { query = {}, body } = {}) {
  const qs = new URLSearchParams({ action: `consultivo-${action}`, ...query }).toString();
  const resposta = await fetch(`/api/diagnosticos?${qs}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok || !dados?.sucesso) {
    const semCorpo = !dados && (resposta.status === 502 || resposta.status === 504);
    throw new Error(
      dados?.error ||
        (semCorpo
          ? "O servidor demorou mais que o limite de tempo. Tente novamente."
          : `Não foi possível concluir (${resposta.status}).`)
    );
  }
  return dados;
}

// ---------------------------------------------------------
// PEÇAS VISUAIS
// ---------------------------------------------------------
const cartao = { background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: "14px 16px" };

function Selo({ texto, fundo, cor }) {
  return (
    <span style={{ display: "inline-block", background: fundo, color: cor, fontSize: 9.5, fontWeight: 800, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>
      {texto}
    </span>
  );
}

function Rotulo({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, color: MUTED, textTransform: "uppercase", marginBottom: 6 }}>{children}</div>;
}

function Lista({ itens, marcador = "•" }) {
  if (!itens?.length) return null;
  return (
    <div style={{ display: "grid", gap: 4 }}>
      {itens.map((t, i) => (
        <div key={i} style={{ fontSize: 12, lineHeight: 1.55, display: "flex", gap: 7 }}>
          <span style={{ color: MUTED }}>{marcador}</span>
          <span>{t}</span>
        </div>
      ))}
    </div>
  );
}

function Citacao({ children }) {
  return (
    <div style={{ borderLeft: `3px solid ${CORAL}`, background: "#FFF8F5", borderRadius: "0 12px 12px 0", padding: "11px 14px", fontSize: 12.5, lineHeight: 1.65, color: "#3B2A25" }}>
      {children}
    </div>
  );
}

function Nivel({ rotulo, valor }) {
  if (!valor) return null;
  const cor = valor === "ALTO" ? "#0F6E56" : valor === "BAIXO" ? MUTED : "#8A5A00";
  return <span style={{ fontSize: 10.5, color: cor, fontWeight: 700 }}>{rotulo} {NIVEL_ROTULO[valor]}</span>;
}

function CartaoCaminho({ caminho }) {
  return (
    <div style={{ border: `1px solid ${caminho.recomendado ? CORAL : BORDER}`, background: caminho.recomendado ? "#FFF8F5" : "#fff", borderRadius: 12, padding: "11px 13px", fontSize: 12, lineHeight: 1.55 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <b>{caminho.id}. {caminho.titulo}</b>
        {caminho.recomendado ? <Selo texto="recomendado" fundo="#E9F7EF" cor="#0F6E56" /> : null}
      </div>
      <div>{caminho.descricao}</div>
      <div style={{ marginTop: 6, display: "flex", gap: 12 }}>
        <Nivel rotulo="Esforço" valor={caminho.esforco} />
        <Nivel rotulo="Impacto" valor={caminho.impacto} />
      </div>
    </div>
  );
}

function AreaConsultiva({ area, resumoArea }) {
  const completa = area.profundidade === "COMPLETA";
  const escolhido = area.caminhos.find((c) => c.recomendado);

  return (
    <details open={completa} style={{ ...cartao, padding: 0, overflow: "hidden", marginBottom: 10 }}>
      <summary style={{ cursor: "pointer", listStyle: "none", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: SOFT, fontWeight: 800, fontSize: 13 }}>
        <span>
          {area.label}{" "}
          {resumoArea?.score != null ? (
            <span style={{ marginLeft: 10, fontSize: 10.5, fontWeight: 700, color: MUTED }}>
              nota {resumoArea.score}{resumoArea.nivel ? ` · ${String(resumoArea.nivel).toLowerCase()}` : ""}
            </span>
          ) : null}
        </span>
        <Selo texto={completa ? "análise completa" : "resumo"} fundo={completa ? "#EEF3FF" : "#F1F3F7"} cor={completa ? "#1D4ED8" : MUTED} />
      </summary>

      <div style={{ padding: "14px 16px", display: "grid", gap: 14 }}>
        {area.semConteudo ? <div style={{ fontSize: 12, color: MUTED }}>Sem análise para esta área.</div> : null}

        {area.leituraConsultor ? (
          <div>
            <Rotulo>Leitura do consultor</Rotulo>
            <Citacao>{area.leituraConsultor}</Citacao>
          </div>
        ) : null}

        {area.hipoteses.length || area.perguntasReuniao.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
            {area.hipoteses.length ? (
              <div>
                <Rotulo>Hipóteses a validar</Rotulo>
                <div style={{ display: "grid", gap: 8 }}>
                  {area.hipoteses.map((h, i) => (
                    <div key={i} style={{ ...cartao, padding: "9px 12px", fontSize: 12, lineHeight: 1.5 }}>
                      <div>{i + 1}. {h.hipotese}</div>
                      {h.comoValidar ? <div style={{ color: MUTED, marginTop: 3 }}>Como validar: {h.comoValidar}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {area.perguntasReuniao.length ? (
              <div>
                <Rotulo>Perguntas para a reunião</Rotulo>
                <div style={{ ...cartao, padding: "9px 12px" }}><Lista itens={area.perguntasReuniao} /></div>
              </div>
            ) : null}
          </div>
        ) : null}

        {area.caminhos.length ? (
          <div>
            <Rotulo>Caminhos possíveis</Rotulo>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 10 }}>
              {area.caminhos.map((c) => <CartaoCaminho key={c.id} caminho={c} />)}
            </div>
          </div>
        ) : null}

        {area.recomendacaoPrincipal.porque || area.naoAssumir.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
            {area.recomendacaoPrincipal.porque ? (
              <div>
                <Rotulo>Por que recomendamos{escolhido ? ` o caminho ${escolhido.id}` : ""}</Rotulo>
                <div style={{ ...cartao, padding: "10px 12px", fontSize: 12, lineHeight: 1.55 }}>
                  {area.recomendacaoPrincipal.porque}
                  {area.recomendacaoPrincipal.dependencias.length ? (
                    <div style={{ marginTop: 6, color: MUTED }}>Depende de: {area.recomendacaoPrincipal.dependencias.join("; ")}</div>
                  ) : null}
                  {area.recomendacaoPrincipal.servicoFinder ? (
                    <div style={{ marginTop: 6 }}><b>Serviço Finder relacionado:</b> {area.recomendacaoPrincipal.servicoFinder}</div>
                  ) : null}
                </div>
              </div>
            ) : null}
            {area.naoAssumir.length ? (
              <div>
                <Rotulo>O que não assumir</Rotulo>
                <div style={{ ...cartao, padding: "10px 12px", background: "#FFFBF0" }}><Lista itens={area.naoAssumir} /></div>
              </div>
            ) : null}
          </div>
        ) : null}

        {area.evidencias.length ? (
          <div>
            <Rotulo>Evidências nas respostas</Rotulo>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {area.evidencias.map((e, i) => (
                <span key={i} style={{ fontSize: 10.5, background: "#F1F3F7", color: MUTED, borderRadius: 7, padding: "3px 8px" }}>{e}</span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function MatrizImpactoEsforco({ plano }) {
  const { celulas, semClassificacao } = classificarMatriz(plano);
  const linhas = ["ALTO", "MEDIO", "BAIXO"];
  const colunas = ["BAIXO", "MEDIO", "ALTO"];

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 6, width: "100%", minWidth: 560, tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ width: 90 }} />
              {colunas.map((c) => (
                <th key={c} style={{ fontSize: 10, color: MUTED, textAlign: "center", fontWeight: 800 }}>ESFORÇO {NIVEL_ROTULO[c].toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((imp) => (
              <tr key={imp}>
                <th style={{ fontSize: 10, color: MUTED, textAlign: "right", paddingRight: 6, fontWeight: 800 }}>IMPACTO {NIVEL_ROTULO[imp].toUpperCase()}</th>
                {colunas.map((esf) => {
                  const zona = ZONAS[`${imp}|${esf}`];
                  const itens = celulas[`${imp}|${esf}`];
                  return (
                    <td key={esf} style={{ background: zona.fundo, borderRadius: 10, padding: "8px 10px", verticalAlign: "top", fontSize: 11, lineHeight: 1.45, minHeight: 70 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 800, color: zona.cor, textTransform: "uppercase", marginBottom: 3 }}>{zona.rotulo}</div>
                      {itens.length ? itens.map((it, i) => <div key={i}>• {it.texto} <span style={{ color: MUTED }}>({it.prazo}d)</span></div>) : <span style={{ color: "#B8C0CF" }}>—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {semClassificacao.length ? (
        <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>
          Sem classificação de esforço/impacto: {semClassificacao.map((s) => s.texto).join(" · ")}
        </div>
      ) : null}
    </div>
  );
}

function PlanoDetalhado({ plano }) {
  const grupos = agruparPlanoPorPrazo(plano);
  const prazos = [30, 60, 90].filter((p) => grupos[p].length);
  if (!prazos.length) return <div style={{ fontSize: 12, color: MUTED }}>A IA não detalhou um plano nesta versão.</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11.5, minWidth: 820 }}>
        <thead>
          <tr>
            {["Prazo", "Objetivo e ação", "Evidência esperada", "Dependência", "Responsável", "Indicador de sucesso", "Esforço / impacto", "Serviço Finder"].map((h) => (
              <th key={h} style={{ textAlign: "left", background: SOFT, color: MUTED, fontSize: 10, padding: "7px 9px" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {prazos.flatMap((prazo) =>
            grupos[prazo].map((p, i) => (
              <tr key={`${prazo}-${i}`} style={{ borderTop: `1px solid ${BORDER}`, verticalAlign: "top" }}>
                <td style={{ padding: "8px 9px" }}>
                  {i === 0 ? <span style={{ background: PRAZO_COR[prazo], color: "#fff", fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 999 }}>{prazo} dias</span> : null}
                </td>
                <td style={{ padding: "8px 9px" }}>{p.objetivo ? <div style={{ color: MUTED }}>{p.objetivo}</div> : null}<b>{p.acao}</b></td>
                <td style={{ padding: "8px 9px" }}>{p.evidenciaEsperada || "—"}</td>
                <td style={{ padding: "8px 9px" }}>{p.dependencia || "—"}</td>
                <td style={{ padding: "8px 9px" }}>{p.responsavelSugerido || "—"}</td>
                <td style={{ padding: "8px 9px" }}>{p.indicadorSucesso || "—"}</td>
                <td style={{ padding: "8px 9px", whiteSpace: "nowrap" }}>
                  <Nivel rotulo="E:" valor={p.esforco} /> <Nivel rotulo="I:" valor={p.impacto} />
                </td>
                <td style={{ padding: "8px 9px" }}>{p.servicoFinder || "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Secao({ titulo, subtitulo, children }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <h3 style={{ margin: "0 0 3px", fontSize: 14 }}>{titulo}</h3>
      {subtitulo ? <p style={{ margin: "0 0 10px", fontSize: 11, color: MUTED }}>{subtitulo}</p> : <div style={{ height: 8 }} />}
      {children}
    </section>
  );
}

function Corpo({ conteudo, areasDoRelatorio }) {
  const roteiro = conteudo.roteiroReuniao;
  const temRoteiro = roteiro.abertura || roteiro.documentosPedir.length || roteiro.objecoesProvaveis.length;

  return (
    <div>
      {conteudo.teseCentral || conteudo.fatosInformados.length || conteudo.hipotesesGerais.length ? (
        <Secao titulo="Leitura executiva consultiva" subtitulo="O fio da história, separando o que o cliente informou do que é hipótese.">
          {conteudo.teseCentral ? <Citacao><b>Tese:</b> {conteudo.teseCentral}</Citacao> : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12, marginTop: 10 }}>
            {conteudo.fatosInformados.length ? (
              <div style={{ ...cartao, borderLeft: "4px solid #2FB37C" }}><Rotulo>Fato (informado pelo cliente)</Rotulo><Lista itens={conteudo.fatosInformados} /></div>
            ) : null}
            {conteudo.hipotesesGerais.length ? (
              <div style={{ ...cartao, borderLeft: "4px solid #F4B740" }}><Rotulo>Hipótese (a validar)</Rotulo><Lista itens={conteudo.hipotesesGerais} /></div>
            ) : null}
          </div>
        </Secao>
      ) : null}

      <Secao titulo="Análise consultiva por área" subtitulo="As áreas prioritárias vêm abertas. Todas seguem o mesmo roteiro, escrito para conduzir a conversa.">
        {conteudo.areas.map((a) => (
          <AreaConsultiva key={a.eixoId} area={a} resumoArea={encontrarArea(areasDoRelatorio, a)} />
        ))}
      </Secao>

      {conteudo.planoDetalhado.length ? (
        <Secao titulo="Impacto × esforço" subtitulo="As ações do plano posicionadas para decidir por onde começar.">
          <MatrizImpactoEsforco plano={conteudo.planoDetalhado} />
        </Secao>
      ) : null}

      <Secao titulo="Plano de ação 30/60/90 dias — detalhado" subtitulo="Mesma linha do plano do cliente, com o que o consultor precisa: evidência, dependência, responsável e indicador.">
        <PlanoDetalhado plano={conteudo.planoDetalhado} />
      </Secao>

      {temRoteiro ? (
        <Secao titulo="Roteiro da reunião" subtitulo="Como abrir, o que pedir e como responder às objeções prováveis.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
            {roteiro.abertura ? <div style={cartao}><Rotulo>Abrir</Rotulo><div style={{ fontSize: 12, lineHeight: 1.55 }}>{roteiro.abertura}</div></div> : null}
            {roteiro.documentosPedir.length ? <div style={cartao}><Rotulo>Pedir</Rotulo><Lista itens={roteiro.documentosPedir} /></div> : null}
            {roteiro.objecoesProvaveis.length ? (
              <div style={cartao}>
                <Rotulo>Objeções prováveis</Rotulo>
                <div style={{ display: "grid", gap: 8 }}>
                  {roteiro.objecoesProvaveis.map((o, i) => (
                    <div key={i} style={{ fontSize: 12, lineHeight: 1.5 }}><b>“{o.objecao}”</b><div style={{ color: MUTED }}>→ {o.resposta}</div></div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Secao>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------
export default function VisaoConsultiva({ token, diagnosticoId, estruturaLabel = "", areas = [] }) {
  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState(null); // { versaoAtual, exibindo, versoes } | { existe:false }
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [orientacao, setOrientacao] = useState("");
  const [abrirForm, setAbrirForm] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      setDados(await chamarApi(token, "GET", "obter", { query: { id: diagnosticoId } }));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [token, diagnosticoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function gerar() {
    setErro("");
    setGerando(true);
    try {
      const r = await chamarApi(token, "POST", "gerar", { body: { id: diagnosticoId, instrucaoExtra: orientacao } });
      setDados(r);
      setAbrirForm(false);
      setOrientacao("");
    } catch (e) {
      setErro(e.message);
    } finally {
      setGerando(false);
    }
  }

  async function verVersao(numero) {
    setErro("");
    try {
      const r = await chamarApi(token, "GET", "obter", { query: { id: diagnosticoId, versao: numero } });
      setDados((atual) => ({ ...atual, exibindo: r.exibindo, versoes: r.versoes, versaoAtual: r.versaoAtual }));
    } catch (e) {
      setErro(e.message);
    }
  }

  const formulario = (
    <div style={{ ...cartao, background: SOFT, marginTop: 10 }}>
      <Rotulo>Orientação adicional para a IA (opcional)</Rotulo>
      <textarea
        aria-label="Orientação adicional"
        rows={2}
        value={orientacao}
        onChange={(e) => setOrientacao(e.target.value)}
        placeholder="Ex.: dar mais ênfase a caixa e a preço; o cliente decide em 15 dias."
        style={{ width: "100%", boxSizing: "border-box", border: "1px solid #D8DEEA", borderRadius: 9, padding: "9px 11px", fontFamily: "inherit", fontSize: 12.5, color: NAVY, resize: "vertical" }}
      />
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" onClick={gerar} disabled={gerando} style={botao(true, gerando)}>
          {gerando ? <Loader2 size={13} className="vc-giro" /> : <Sparkles size={13} />}
          {dados?.existe ? "Gerar nova versão" : "Gerar análise consultiva"}
        </button>
        {gerando ? <span style={{ fontSize: 11.5, color: MUTED }}>A IA está analisando as respostas. Pode levar até 2 minutos.</span> : null}
      </div>
    </div>
  );

  return (
    <section aria-label="Análise consultiva" style={{ ...cartao, marginBottom: 18, borderLeft: "4px solid #31589C", padding: "16px 18px" }}>
      <style>{`@keyframes vc-giro{to{transform:rotate(360deg)}}.vc-giro{animation:vc-giro 1s linear infinite}`}</style>
      <div style={{ fontSize: 9, color: "#31589C", fontWeight: 900, marginBottom: 4 }}>ANÁLISE CONSULTIVA · USO INTERNO{estruturaLabel ? ` · ${estruturaLabel.toUpperCase()}` : ""}</div>
      <h2 style={{ margin: "0 0 4px", fontSize: 18, fontFamily: "Georgia, serif" }}>Leitura aberta do consultor</h2>
      <p style={{ margin: "0 0 12px", fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>
        Abre o raciocínio em vez de entregar conclusão fechada: hipóteses, perguntas, caminhos com prós e contras, plano detalhado e roteiro da reunião. Não é enviada ao cliente.
      </p>

      {erro ? <div role="alert" style={{ background: "#FDECEC", color: "#B3261E", border: "1px solid #F1B8B4", borderRadius: 10, padding: "9px 12px", fontSize: 12, marginBottom: 10 }}>{erro}</div> : null}
      {carregando ? <div style={{ display: "flex", alignItems: "center", gap: 8, color: MUTED, fontSize: 12 }}><Loader2 size={15} className="vc-giro" /> Carregando análise...</div> : null}

      {!carregando && dados && !dados.existe ? (
        <div>
          <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>Este diagnóstico ainda não tem análise consultiva. Ela é gerada sob demanda, a partir das respostas e do resultado já calculado.</div>
          {formulario}
        </div>
      ) : null}

      {!carregando && dados?.existe && dados.exibindo ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12, fontSize: 11.5, color: MUTED }}>
            <div>
              <b style={{ color: NAVY }}>Versão {dados.exibindo.versao}</b>
              {dados.exibindo.versao === dados.versaoAtual ? " (atual)" : ""} · gerada em {dataHora(dados.exibindo.geradoEm)} por {dados.exibindo.geradoPor || "—"}
              {dados.exibindo.instrucaoExtra ? <div style={{ marginTop: 2 }}>Orientação usada: “{dados.exibindo.instrucaoExtra}”</div> : null}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {dados.versoes.length > 1 ? (
                <select aria-label="Versão da análise" value={dados.exibindo.versao} onChange={(e) => verVersao(Number(e.target.value))} style={{ border: "1px solid #D8DEEA", borderRadius: 9, padding: "7px 9px", fontSize: 11.5, fontFamily: "inherit" }}>
                  {dados.versoes.map((v) => (
                    <option key={v.versao} value={v.versao}>v{v.versao} · {dataHora(v.geradoEm)}{v.versao === dados.versaoAtual ? " (atual)" : ""}</option>
                  ))}
                </select>
              ) : null}
              <button type="button" onClick={() => setAbrirForm((v) => !v)} style={botao(false, false)}>
                <Sparkles size={13} /> {abrirForm ? "Fechar" : "Gerar nova versão"}
              </button>
            </div>
          </div>

          {dados.exibindo.versao !== dados.versaoAtual ? (
            <div role="status" style={{ background: "#FFF4D6", color: "#7A5200", border: "1px solid #F0D9A0", borderRadius: 10, padding: "9px 12px", fontSize: 12, marginBottom: 10 }}>
              Você está vendo uma versão anterior (somente leitura).{" "}
              <button type="button" onClick={() => verVersao(dados.versaoAtual)} style={{ background: "none", border: "none", color: "#1D4ED8", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                Voltar para a atual
              </button>
            </div>
          ) : null}

          {abrirForm ? formulario : null}
          <div style={{ marginTop: 14 }}>
            <Corpo conteudo={dados.exibindo.conteudo} areasDoRelatorio={areas} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function botao(primario, desabilitado) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    padding: "8px 13px",
    fontSize: 11.5,
    fontWeight: 800,
    fontFamily: "inherit",
    cursor: desabilitado ? "not-allowed" : "pointer",
    opacity: desabilitado ? 0.6 : 1,
    background: primario ? CORAL : "#fff",
    color: primario ? "#fff" : NAVY,
    border: primario ? "1px solid transparent" : "1px solid #D8DEEA",
  };
}
