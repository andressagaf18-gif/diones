import { useEffect, useMemo, useState } from "react";
import { brlN } from "../../server/apuracao-engine.js";

const NAVY = "#17233D", CORAL = "#FF6B4A", MUTED = "#5B667A", BORDER = "#E3E7EF", WHITE = "#FFFFFF";
const COR = { critico: "#C62828", atencao: "#E08A00", info: "#4A6FA5" };
const ROTULO = { critico: "Crítico", atencao: "Atenção", info: "Informativo" };
const pct = (v) => (v === null || v === undefined ? "—" : `${(v * 100).toFixed(2).replace(".", ",")}%`);
const mesBr = (k) => `${k.slice(5, 7)}/${k.slice(2, 4)}`;
const Chips = ({ meses, cor, fundo }) => (meses?.length ? <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>{meses.map((k) => <span key={k} style={{ background: fundo, color: cor, borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 800 }}>{mesBr(k)}</span>)}</span> : <span style={{ color: MUTED }}>nenhum</span>);
const dataBr = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

const Cartao = ({ children, style }) => <div style={{ background: WHITE, borderWidth: 1, borderStyle: "solid", borderColor: BORDER, borderRadius: 14, padding: 16, ...style }}>{children}</div>;
const Botao = ({ children, onClick, disabled, claro }) => (
  <button onClick={onClick} disabled={disabled} style={{ border: claro ? `1px solid ${BORDER}` : "none", background: claro ? WHITE : CORAL, color: claro ? NAVY : WHITE, borderRadius: 10, padding: "8px 14px", fontWeight: 800, fontSize: 12, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1 }}>{children}</button>
);


const SIT = { sem_movimento: ["Sem movimento", "#0D47A1"], com_movimento: ["Com movimento", "#2E7D32"], entregue: ["Entregue (movimento não lido)", "#555"], ok: ["Conferido", "#2E7D32"], divergente: ["Divergente", COR.critico], entregue_mit: ["Entregue", "#555"], so_documentos: ["Só documentos", COR.info] };
const dtBr = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");
const ESTADOS = [
  ["comMovimento", "Com movimento", "#1B5E20", "#E3F4E6"],
  ["semMovimento", "Sem movimento", "#0D47A1", "#DCEBFB"],
  ["indefinido", "Entregue (movimento não lido)", "#4A5568", "#E9ECF2"],
  ["naoEncontrados", "Não encontrada", "#B71C1C", "#FDE3E3"],
  ["aVencer", "Dentro do prazo", "#8A5A00", "#FFF1CF"],
];
// Linha do tempo: um quadrado por mês, colorido pela situação da entrega.
const BlocoEntregas = ({ titulo, e }) => {
  if (!e || !(e.entregues.length > 0 || e.naoEncontrados.length > 0)) return null;
  const mapa = {};
  for (const [k] of ESTADOS) for (const m of e[k] || []) mapa[m] = k;
  const meses = Object.keys(mapa).sort();
  const anos = [...new Set(meses.map((m) => m.slice(0, 4)))];
  const total = meses.length;
  const entregues = e.entregues.length;
  return (
    <Cartao style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "baseline" }}>
        <div style={{ fontWeight: 900 }}>{titulo}</div>
        <div style={{ fontSize: 11.5, color: MUTED }}>{entregues} de {total} mês(es) com declaração · {e.semMovimento.length} sem movimento{e.naoEncontrados.length ? ` · ${e.naoEncontrados.length} não encontrado(s)` : ""}</div>
      </div>
      {anos.map((ano) => (
        <div key={ano} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <div style={{ width: 38, fontSize: 11, fontWeight: 900, color: MUTED }}>{ano}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(34px, 1fr))", gap: 4, flex: 1, minWidth: 330 }}>
            {Array.from({ length: 12 }, (_, i) => {
              const k = `${ano}-${String(i + 1).padStart(2, "0")}`;
              const st = ESTADOS.find(([x]) => x === mapa[k]);
              return (
                <div key={k} title={st ? `${String(i + 1).padStart(2, "0")}/${ano}: ${st[1]}` : `${String(i + 1).padStart(2, "0")}/${ano}: fora do período`}
                  style={{ borderRadius: 8, textAlign: "center", padding: "6px 0", fontSize: 10.5, fontWeight: 900, background: st ? st[3] : "#F6F7FA", color: st ? st[2] : "#B8BFCC", border: `1px solid ${st ? st[2] + "33" : "#EEF0F5"}` }}>
                  {String(i + 1).padStart(2, "0")}
                </div>);
            })}
          </div>
        </div>))}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12, fontSize: 11, color: MUTED }}>
        {ESTADOS.filter(([k]) => (e[k] || []).length > 0).map(([k, r, c, f]) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: f, border: `1px solid ${c}66` }} />{r} ({e[k].length})</span>))}
      </div>
    </Cartao>);
};

// Lucro Presumido / Real: conferência mês a mês por tributo
const BlocoPresumido = ({ P }) => (
  <>
    <BlocoEntregas titulo="Entregas da MIT (tributos federais — Lucro Presumido/Real)" e={P.entregas} />
    {P.meses?.length > 0 && (
      <Cartao style={{ marginBottom: 12, overflowX: "auto" }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Conferência mês a mês — Lucro Presumido</div>
        <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 8 }}>O sistema refaz IRPJ, CSLL, PIS, COFINS e ISS a partir dos demonstrativos e compara com a MIT, os DARFs e o DAM. A MIT marcada “sem movimento” é a declaração que diz que não houve tributo federal no mês.</div>
        {P.meses.map((m) => (
          <div key={m.mes} style={{ borderTop: `1px solid ${BORDER}`, padding: "8px 0" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <b style={{ fontSize: 13 }}>{m.rotulo}</b>
              <span style={{ fontWeight: 800, fontSize: 11.5, color: m.situacao === "sem_movimento" ? "#0D47A1" : m.situacao === "divergente" ? COR.critico : m.situacao === "ok" ? "#2E7D32" : "#555" }}>
                {m.situacao === "sem_movimento" ? "MIT entregue sem movimento" : m.situacao === "divergente" ? "Divergente" : m.situacao === "ok" ? "Conferido" : m.situacao === "entregue" ? "MIT entregue" : "Só documentos (sem MIT)"}
              </span>
              {m.mit && !m.mit.semMovimento && <span style={{ fontSize: 11, color: MUTED }}>MIT com débitos de {brlN(m.mit.total)}</span>}
            </div>
            {m.tributos.length > 0 && (
              <table style={{ borderCollapse: "collapse", fontSize: 11.5, width: "100%", marginTop: 4 }}>
                <thead><tr style={{ textAlign: "left", color: MUTED }}>{["Tributo", "Base", "Alíq.", "Declarado", "Recalculado", "Retenções", "A pagar", "MIT", "Guia", "Situação"].map((h) => <th key={h} style={{ padding: "3px 6px", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
                <tbody>{m.tributos.map((t) => (
                  <tr key={t.tributo} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td style={{ padding: "4px 6px", fontWeight: 800 }}>{t.tributo}</td>
                    <td style={{ padding: "4px 6px" }}>{brlN(t.base)}</td><td style={{ padding: "4px 6px" }}>{pct(t.aliquota)}</td>
                    <td style={{ padding: "4px 6px" }}>{brlN(t.declarado)}</td><td style={{ padding: "4px 6px" }}>{brlN(t.recalculado)}</td>
                    <td style={{ padding: "4px 6px" }}>{brlN(t.retencoes)}</td><td style={{ padding: "4px 6px" }}>{brlN(t.saldoDevedor)}</td>
                    <td style={{ padding: "4px 6px" }}>{t.tributo === "ISS" ? "—" : brlN(t.mit)}</td><td style={{ padding: "4px 6px" }}>{brlN(t.darf)}</td>
                    <td style={{ padding: "4px 6px", fontWeight: 800, color: t.status === "ok" ? "#2E7D32" : COR.critico }}>{t.status === "ok" ? "Confere" : "Divergente"}</td>
                  </tr>))}</tbody>
              </table>)}
          </div>))}
      </Cartao>)}
  </>
);

// DCTFWeb (folha), DIME e DEFIS — valem para qualquer regime
const BlocoOutras = ({ a }) => (
  <>
    {a.folha?.meses?.length > 0 && (
      <Cartao style={{ marginBottom: 12, overflowX: "auto" }}>
        <div style={{ fontWeight: 900, marginBottom: 4 }}>DCTFWeb (folha de pagamento e MIT) — informativo</div>
        <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 8 }}>A DCTFWeb reúne a folha (eSocial) e os débitos da MIT. Uma empresa pode ter MIT sem movimento e, ainda assim, ter DCTFWeb com folha.</div>
        <table style={{ borderCollapse: "collapse", fontSize: 11.5, width: "100%" }}>
          <thead><tr style={{ textAlign: "left", color: MUTED }}>{["Mês", "Situação", "Débitos apurados", "Saldo a pagar", "Origem", "Entrega"].map((h) => <th key={h} style={{ padding: "3px 6px" }}>{h}</th>)}</tr></thead>
          <tbody>{a.folha.meses.map((m) => (
            <tr key={m.mes} style={{ borderTop: `1px solid ${BORDER}` }}>
              <td style={{ padding: "4px 6px", fontWeight: 800 }}>{m.rotulo}{m.retificadora ? " (retif.)" : ""}</td>
              <td style={{ padding: "4px 6px", fontWeight: 800, color: (SIT[m.situacao] || SIT.entregue)[1] }}>{(SIT[m.situacao] || SIT.entregue)[0]}</td>
              <td style={{ padding: "4px 6px" }}>{m.debito !== undefined ? brlN(m.debito) : "—"}</td><td style={{ padding: "4px 6px" }}>{m.saldoPagar !== undefined ? brlN(m.saldoPagar) : "—"}</td>
              <td style={{ padding: "4px 6px" }}>{(m.origens || []).join(" + ") || "—"}</td><td style={{ padding: "4px 6px" }}>{dtBr(m.entregaEm)}</td>
            </tr>))}</tbody>
        </table>
      </Cartao>)}
    {a.dime?.meses?.length > 0 && (
      <Cartao style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 4 }}>DIME (ICMS — Santa Catarina)</div>
        <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 8 }}>{a.dime.aviso || "Sem movimento é identificado quando o arquivo da DIME só tem cabeçalho (nenhum registro de apuração, entradas ou saídas)."}</div>
        <div style={{ display: "grid", gridTemplateColumns: "190px 1fr", gap: "8px 10px", fontSize: 12, alignItems: "center" }}>
          <b>Com movimento ({a.dime.entregas.comMovimento.length})</b><Chips meses={a.dime.entregas.comMovimento} cor="#1B5E20" fundo="#E3F4E6" />
          <b>Sem movimento ({a.dime.entregas.semMovimento.length})</b><Chips meses={a.dime.entregas.semMovimento} cor="#0D47A1" fundo="#E3EEFB" />
          {a.dime.entregas.indefinido?.length > 0 && (<><b>Entregues (só recibo)</b><Chips meses={a.dime.entregas.indefinido} cor="#555" fundo="#ECEFF4" /></>)}
          <b>Não encontradas ({a.dime.entregas.naoEncontrados.length})</b><Chips meses={a.dime.entregas.naoEncontrados} cor={COR.critico} fundo="#FDECEC" />
        </div>
      </Cartao>)}
    {a.defis?.length > 0 && (
      <Cartao style={{ marginBottom: 12, overflowX: "auto" }}>
        <div style={{ fontWeight: 900, marginBottom: 4 }}>DEFIS (declaração anual do Simples)</div>
        <table style={{ borderCollapse: "collapse", fontSize: 11.5, width: "100%" }}>
          <thead><tr style={{ textAlign: "left", color: MUTED }}>{["Ano", "Situação", "Empregados (início/fim)", "Lucros pagos ao sócio", "Saídas interestaduais", "Entrega", "Recibo"].map((h) => <th key={h} style={{ padding: "3px 6px" }}>{h}</th>)}</tr></thead>
          <tbody>{a.defis.map((d) => (
            <tr key={d.ano} style={{ borderTop: `1px solid ${BORDER}` }}>
              <td style={{ padding: "4px 6px", fontWeight: 800 }}>{d.ano}</td>
              <td style={{ padding: "4px 6px", fontWeight: 800, color: (SIT[d.situacao] || SIT.entregue)[1] }}>{(SIT[d.situacao] || SIT.entregue)[0]}</td>
              <td style={{ padding: "4px 6px" }}>{d.declaracao ? `${d.empregadosInicio ?? "—"} / ${d.empregadosFim ?? "—"}` : "—"}</td>
              <td style={{ padding: "4px 6px" }}>{d.declaracao ? brlN(d.rendimentosSocios) : "—"}</td><td style={{ padding: "4px 6px" }}>{d.declaracao ? brlN(d.saidasInterestaduais) : "—"}</td>
              <td style={{ padding: "4px 6px" }}>{dtBr(d.entregaEm)}</td><td style={{ padding: "4px 6px" }}>{d.reciboNumero || "—"}</td>
            </tr>))}</tbody>
        </table>
      </Cartao>)}
  </>
);

const REGIME_ROTULO = { SIMPLES: "Simples Nacional", PRESUMIDO: "Lucro Presumido / Real", NAO_SIMPLES: "Fora do Simples (DCTF)", INDEFINIDO: "Regime não identificado" };
const Anel = ({ valor, cor }) => {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <svg width="92" height="92" viewBox="0 0 92 92" role="img" aria-label={`Saúde ${valor} de 100`}>
      <circle cx="46" cy="46" r={r} fill="none" stroke="#E8ECF3" strokeWidth="9" />
      <circle cx="46" cy="46" r={r} fill="none" stroke={cor} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(valor / 100) * c} ${c}`} transform="rotate(-90 46 46)" />
      <text x="46" y="52" textAnchor="middle" fontSize="22" fontWeight="900" fill={cor}>{valor}</text>
    </svg>);
};

function CorpoApuracao({ a, criadoEm, historico, atualId, abrirVersao }) {
  const cor = a.saude >= 80 ? "#2E7D32" : a.saude >= 50 ? COR.atencao : COR.critico;
  const prioridades = [...a.achados.filter((x) => x.severidade === "critico"), ...a.achados.filter((x) => x.severidade === "atencao")].slice(0, 4);
  const veredito = a.resumo.critico > 0 ? `${a.resumo.critico} ponto(s) crítico(s) para corrigir` : a.resumo.atencao > 0 ? `${a.resumo.atencao} ponto(s) de atenção` : "Nenhuma divergência nas declarações lidas";
  const entregasTodas = [a.entregas, a.presumido?.entregas].filter(Boolean);
  const semMov = entregasTodas.reduce((t, e) => t + (e.semMovimento?.length || 0), 0);
  const faltando = entregasTodas.reduce((t, e) => t + (e.naoEncontrados?.length || 0), 0);
  const imprimir = () => setTimeout(() => window.print(), 100);
  return (
    <div id="relatorio-apuracao">
      <style>{`@media print { body * { visibility: hidden !important; } #relatorio-apuracao, #relatorio-apuracao * { visibility: visible !important; } #relatorio-apuracao { position: absolute; left: 0; top: 0; width: 100%; } .nao-imprimir { display: none !important; } }`}</style>
        <Cartao style={{ marginBottom: 12, borderTop: `4px solid ${cor}` }}>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
            <Anel valor={a.saude} cor={cor} />
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ color: CORAL, fontSize: 9, fontWeight: 900, letterSpacing: 1 }}>AUDITORIA DA APURAÇÃO · {(REGIME_ROTULO[a.regime] || a.regime).toUpperCase()}{a.presumido ? " + LUCRO PRESUMIDO/REAL" : ""}</div>
              <h2 style={{ margin: "4px 0 2px", fontSize: 21 }}>{a.cliente.codigo} - {a.cliente.nome}</h2>
              <div style={{ fontSize: 15, fontWeight: 900, color: cor }}>{veredito}</div>
              <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3 }}>{a.arquivosLidos ?? 0} arquivo(s) lido(s){a.arquivosDaMemoria ? `, ${a.arquivosDaMemoria} da memória` : ""} · gerado em {dataBr(criadoEm)}</div>
            </div>
            <button className="nao-imprimir" onClick={imprimir} style={{ border: `1px solid ${BORDER}`, background: WHITE, color: NAVY, borderRadius: 10, padding: "8px 14px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Imprimir / salvar PDF</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginTop: 14 }}>
            {[["Críticos", a.resumo.critico, COR.critico], ["Atenção", a.resumo.atencao, COR.atencao], ["Informativos", a.resumo.info, COR.info], ["Meses sem movimento", semMov, "#0D47A1"], ["Entregas não encontradas", faltando, faltando ? COR.critico : "#2E7D32"]].map(([r, v, c]) => (
              <div key={r} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: "8px 12px" }}><div style={{ fontSize: 10, color: MUTED }}>{r}</div><div style={{ fontSize: 22, fontWeight: 900, color: c }}>{v}</div></div>
            ))}
          </div>
          {prioridades.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: MUTED, letterSpacing: 0.5, marginBottom: 6 }}>O QUE FAZER PRIMEIRO</div>
              {prioridades.map((x, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "6px 0", borderTop: i ? `1px solid ${BORDER}` : "none" }}>
                  <span style={{ flex: "0 0 auto", width: 22, height: 22, borderRadius: 999, background: COR[x.severidade], color: WHITE, fontSize: 11, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                  <div style={{ fontSize: 12.5 }}><b>{x.titulo}</b>{x.sugestao && <div style={{ color: MUTED }}>→ {x.sugestao}</div>}</div>
                </div>))}
            </div>)}
          {historico?.length > 1 && (
            <div className="nao-imprimir" style={{ marginTop: 12, fontSize: 12 }}>Versões: {historico.map((h) => <button key={h.id} onClick={() => abrirVersao(h.id)} style={{ marginRight: 6, marginBottom: 4, border: `1px solid ${BORDER}`, background: h.id === atualId ? NAVY : WHITE, color: h.id === atualId ? WHITE : NAVY, borderRadius: 8, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>{dataBr(h.created_at)}</button>)}</div>
          )}
        </Cartao>
        {a.regime !== "PRESUMIDO" && <BlocoEntregas titulo={a.regime === "NAO_SIMPLES" ? "Entregas da DCTF (tributos federais)" : "Entregas do Simples Nacional (PGDAS-D)"} e={a.entregas} />}
        {a.aviso && <Cartao style={{ marginBottom: 12, borderColor: COR.atencao }}>{a.aviso}</Cartao>}
        {a.regime === "PRESUMIDO" && <BlocoPresumido P={a} />}
        {a.regime === "NAO_SIMPLES" && a.meses?.length > 0 && (
          <Cartao style={{ marginBottom: 12, overflowX: "auto" }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>DCTF mês a mês (tributos federais)</div>
            <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 8 }}>Empresa fora do Simples: não há PGDAS nem DAS. A DCTF entregue sem movimento significa que não há tributo federal a declarar naquele mês.</div>
            <table style={{ borderCollapse: "collapse", fontSize: 11.5, width: "100%" }}>
              <thead><tr style={{ textAlign: "left", color: MUTED }}>{["Mês", "Situação", "Entrega", "Recibo", "Comprovantes"].map((h) => <th key={h} style={{ padding: "4px 6px" }}>{h}</th>)}</tr></thead>
              <tbody>{a.meses.map((m) => (
                <tr key={m.mes} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <td style={{ padding: "5px 6px", fontWeight: 800 }}>{m.rotulo}</td>
                  <td style={{ padding: "5px 6px", fontWeight: 800, color: m.situacao === "sem_movimento" ? "#0D47A1" : "#2E7D32" }}>{m.situacao === "sem_movimento" ? "Sem movimento (entregue)" : m.situacao === "entregue" ? "Entregue" : "Entregue com movimento"}</td>
                  <td style={{ padding: "5px 6px" }}>{m.entregaEm ? m.entregaEm.split("-").reverse().join("/") : "—"}</td>
                  <td style={{ padding: "5px 6px" }}>{m.reciboNumero || "—"}</td>
                  <td style={{ padding: "5px 6px", color: MUTED, fontSize: 10.5 }}>{(m.comprovantes || []).join(" · ")}</td>
                </tr>))}</tbody>
            </table>
          </Cartao>
        )}
        {a.regime === "NAO_SIMPLES" && a.mesesFolha?.length > 0 && (
          <Cartao style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 4 }}>DCTFWeb (folha de pagamento) — informativo</div>
            <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 8 }}>A DCTFWeb trata das contribuições previdenciárias da folha. Não é a declaração fiscal e não substitui a DCTF. "Sem movimento" aqui significa que não houve folha/retenção no mês.</div>
            <div style={{ display: "grid", gridTemplateColumns: "190px 1fr", gap: "8px 10px", fontSize: 12, alignItems: "center" }}>
              <b>Com movimento ({a.entregasFolha?.comMovimento?.length || 0})</b><Chips meses={a.entregasFolha?.comMovimento} cor="#1B5E20" fundo="#E3F4E6" />
              <b>Sem movimento ({a.entregasFolha?.semMovimento?.length || 0})</b><Chips meses={a.entregasFolha?.semMovimento} cor="#0D47A1" fundo="#E3EEFB" />
            </div>
          </Cartao>
        )}
        {a.regime !== "NAO_SIMPLES" && a.regime !== "PRESUMIDO" && a.meses?.length > 0 && (
          <Cartao style={{ marginBottom: 12, overflowX: "auto" }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Conferência mês a mês</div>
            <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 8 }}>O sistema refaz o cálculo do PGDAS-D (anexo, faixa pela RBT12, alíquota efetiva e repartição) e compara com o que foi declarado e com a guia.</div>
            <table style={{ borderCollapse: "collapse", fontSize: 11.5, width: "100%" }}>
              <thead><tr style={{ textAlign: "left", color: MUTED }}>{["Mês", "Receita", "RBT12", "Anexo", "Faixa", "Alíq. efetiva", "Declarado", "Recalculado", "Diferença", "Guia", "Situação"].map((h) => <th key={h} style={{ padding: "4px 6px", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
              <tbody>{a.meses.map((m) => {
                const sit = m.situacao === "ok" ? ["Conferido", "#2E7D32"] : m.situacao === "sem_movimento" ? ["Sem movimento (entregue)", "#2E7D32"] : m.situacao === "so_recibo" ? ["Só recibo", COR.info] : m.situacao === "divergente" ? ["Divergente", COR.critico] : ["Conferir manual", COR.atencao];
                return (
                  <tr key={m.mes} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td style={{ padding: "5px 6px", fontWeight: 800 }}>{m.rotulo}{m.retificadora ? " (retif.)" : ""}</td>
                    <td style={{ padding: "5px 6px" }}>{brlN(m.rpa)}</td><td style={{ padding: "5px 6px" }}>{brlN(m.rbt12)}</td>
                    <td style={{ padding: "5px 6px" }}>{m.anexos || "—"}</td><td style={{ padding: "5px 6px" }}>{m.faixa ?? "—"}</td><td style={{ padding: "5px 6px" }}>{pct(m.aliquotaEfetiva)}</td>
                    <td style={{ padding: "5px 6px" }}>{brlN(m.debitoDeclarado)}</td><td style={{ padding: "5px 6px" }}>{brlN(m.debitoRecalculado)}</td>
                    <td style={{ padding: "5px 6px", fontWeight: 800, color: m.diferenca && Math.abs(m.diferenca) > 0.05 ? COR.critico : MUTED }}>{m.diferenca === null ? "—" : brlN(m.diferenca)}</td>
                    <td style={{ padding: "5px 6px" }}>{brlN(m.valorGuia)}</td>
                    <td style={{ padding: "5px 6px", fontWeight: 800, color: sit[1] }}>{sit[0]}{(m.entregaEm || m.reciboNumero) && <div style={{ fontWeight: 400, fontSize: 10, color: MUTED, whiteSpace: "nowrap" }}>{m.entregaEm ? `Entregue em ${m.entregaEm.split("-").reverse().join("/")}` : "Entregue"}{m.reciboNumero ? ` · recibo ${m.reciboNumero}` : ""}</div>}</td>
                  </tr>);
              })}</tbody>
            </table>
          </Cartao>
        )}
        {a.presumido && <BlocoPresumido P={a.presumido} />}
        <BlocoOutras a={a} />
        <Cartao>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Alertas ({a.achados.length})</div>
          {a.achados.length === 0 && <div style={{ color: "#2E7D32", fontWeight: 800 }}>Nenhuma divergência encontrada nas declarações lidas.</div>}
          {["critico", "atencao", "info"].map((s) => a.achados.filter((x) => x.severidade === s).map((x, i) => (
            <div key={s + i} style={{ borderLeft: `4px solid ${COR[s]}`, padding: "6px 10px", margin: "6px 0", background: "#FAFBFD" }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: COR[s] }}>{ROTULO[s].toUpperCase()} · {x.categoria}</div>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{x.titulo}</div>
              {x.detalhe && <div style={{ fontSize: 12, color: MUTED }}>{x.detalhe}</div>}
              {x.sugestao && <div style={{ fontSize: 12 }}>→ {x.sugestao}</div>}
            </div>)))}
          {a.falhas?.length > 0 && <div style={{ marginTop: 8, fontSize: 11.5, color: MUTED }}>Arquivos não lidos: {a.falhas.join(" · ")}</div>}
        </Cartao>
    </div>
  );
}

async function chamar(token, action, body, method = "POST", query = {}) {
  const p = new URLSearchParams({ action, ...query });
  const r = await fetch(`/api/tributario?${p}`, { method, headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: method === "GET" ? undefined : JSON.stringify(body) });
  const bruto = await r.text();
  let d = null; try { d = JSON.parse(bruto); } catch { d = null; }
  if (!r.ok || !d?.sucesso) throw new Error(d?.error || `Erro na conferência (servidor respondeu ${r.status}${r.status === 504 ? ": a leitura passou do tempo limite" : ""}).`);
  return d;
}

// Aba "Apurações" dentro do relatório do cliente (Auditoria de pastas).
export function ApuracaoCliente({ token, cliente }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [fazendo, setFazendo] = useState(false);
  async function carregar() {
    try { setD(await chamar(token, "apuracao-obter", null, "GET", { codigo: cliente.codigo })); setErro(""); }
    catch (e) { if (/Nenhuma auditoria/i.test(e.message)) setD(null); else setErro(e.message); }
    setCarregando(false);
  }
  useEffect(() => { setCarregando(true); carregar(); }, [cliente.codigo]); // eslint-disable-line react-hooks/exhaustive-deps
  async function conferir() {
    if (!cliente.id) { setErro("Esta auditoria veio de um envio manual. A conferência da apuração lê direto do Google Drive: rode o cliente pela opção “Direto do Google Drive”."); return; }
    setFazendo(true); setErro("");
    try { await chamar(token, "apuracao-auditar", { pastaId: cliente.id, codigo: cliente.codigo, nome: cliente.nome, raiz: cliente.raiz }); await carregar(); }
    catch (e) { setErro(e.message); }
    setFazendo(false);
  }
  async function versao(id) { try { const r = await chamar(token, "apuracao-obter", null, "GET", { id }); setD((x) => ({ ...x, atual: r.atual })); } catch (e) { setErro(e.message); } }
  return (
    <div>
      <Cartao style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: MUTED, maxWidth: 640, lineHeight: 1.5 }}>Confere se o imposto apurado está certo: refaz o cálculo do Simples (PGDAS-D) ou do Lucro Presumido (IRPJ, CSLL, PIS, COFINS, ISS) e mostra as entregas sem movimento (PGDAS-D, MIT), a DCTFWeb, a DIME e a DEFIS. Lê a pasta do Drive em uma chamada própria.</div>
          <Botao onClick={conferir} disabled={fazendo}>{fazendo ? "Lendo a pasta…" : d ? "Conferir de novo pelo Drive" : "Conferir apuração pelo Drive"}</Botao>
        </div>
        {erro && <div style={{ marginTop: 8, color: COR.critico, fontSize: 12, fontWeight: 700 }}>{erro}</div>}
      </Cartao>
      {carregando ? <Cartao>Carregando…</Cartao> : !d ? <Cartao style={{ color: MUTED, fontSize: 12.5 }}>A apuração deste cliente ainda não foi conferida. Clique em “Conferir apuração pelo Drive”.</Cartao>
        : <CorpoApuracao a={d.atual.resultado} criadoEm={d.atual.created_at} historico={d.historico} atualId={d.atual.id} abrirVersao={versao} />}
    </div>
  );
}

export default function AuditoriaApuracoes({ token, onVoltar }) {
  const [clientes, setClientes] = useState([]);
  const [painel, setPainel] = useState({});
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [fazendo, setFazendo] = useState({}); // codigo -> true
  const [lote, setLote] = useState(null);     // { feitos, total, atual }
  const [falhasLote, setFalhasLote] = useState([]);
  const [detalhe, setDetalhe] = useState(null); // { atual, historico }

  async function api(action, body, method = "POST", query = {}) {
    const p = new URLSearchParams({ action, ...query });
    const r = await fetch(`/api/tributario?${p}`, { method, headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: method === "GET" ? undefined : JSON.stringify(body) });
    const bruto = await r.text();
    let d = null; try { d = JSON.parse(bruto); } catch { d = null; }
    if (!r.ok || !d?.sucesso) throw new Error(d?.error || `Erro na auditoria de apurações (servidor respondeu ${r.status}${r.status === 504 || /timeout/i.test(bruto) ? ": a leitura passou do tempo limite" : r.status >= 500 ? ": falha no servidor, confira se todos os arquivos foram importados" : ""}).`);
    return d;
  }
  async function carregar() {
    setCarregando(true); setErro("");
    try {
      const [c, p] = await Promise.all([api("pasta-drive-clientes", null, "GET"), api("apuracao-painel", null, "GET")]);
      setClientes(c.clientes || []);
      setPainel(Object.fromEntries((p.clientes || []).map((x) => [String(x.cliente_codigo), x])));
    } catch (e) { setErro(e.message); }
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function auditar(c, tentativas = 1) {
    setFazendo((f) => ({ ...f, [c.codigo]: true }));
    try {
      const d = await api("apuracao-auditar", { pastaId: c.id, codigo: c.codigo, nome: c.nome, raiz: c.raiz });
      setPainel((p) => ({ ...p, [c.codigo]: { cliente_codigo: c.codigo, cliente_nome: c.nome, saude: d.auditoria.saude, criticos: d.auditoria.resumo.critico, atencoes: d.auditoria.resumo.atencao, infos: d.auditoria.resumo.info, declaracoes: String(d.auditoria.declaracoes), aviso: d.auditoria.aviso || null, regime: d.auditoria.regime, entregas: d.auditoria.entregas, incompleto: d.auditoria.incompleto ? "true" : null, created_at: d.criadoEm, id: d.id } }));
      return d;
    } catch (e) {
      if (tentativas > 0) { setFazendo((f) => ({ ...f, [c.codigo]: false })); return auditar(c, tentativas - 1); }
      setErro(`${c.codigo} - ${c.nome}: ${e.message}`); return null;
    }
    finally { setFazendo((f) => ({ ...f, [c.codigo]: false })); }
  }
  async function abrir(c) {
    try { const d = await api("apuracao-obter", null, "GET", { codigo: c.codigo }); setDetalhe({ ...d, cliente: c }); window.scrollTo?.(0, 0); }
    catch (e) { setErro(e.message); }
  }
  async function abrirVersao(id) {
    const d = await api("apuracao-obter", null, "GET", { id });
    setDetalhe((x) => ({ ...x, atual: d.atual }));
  }
  async function auditarEAbrir(c) { const d = await auditar(c); if (d) await abrir(c); }
  async function auditarLote(somentePendentes) {
    const alvo = clientes.filter((c) => !somentePendentes || !painel[c.codigo] || painel[c.codigo].incompleto === "true");
    setLote({ feitos: 0, total: alvo.length, atual: "" });
    setFalhasLote([]); setErro("");
    const falhou = [];
    try {
      for (let i = 0; i < alvo.length; i++) {
        setLote({ feitos: i, total: alvo.length, atual: `${alvo[i].codigo} - ${alvo[i].nome}` });
        try { const d = await auditar(alvo[i]); if (!d) falhou.push(`${alvo[i].codigo} - ${alvo[i].nome}`); }
        catch { falhou.push(`${alvo[i].codigo} - ${alvo[i].nome}`); }
      }
    } finally { setLote(null); setFalhasLote(falhou); }
  }

  const lista = useMemo(() => clientes.filter((c) => {
    const p = painel[c.codigo];
    if (busca && !`${c.codigo} ${c.nome}`.toLowerCase().includes(busca.toLowerCase())) return false;
    if (filtro === "pendente") return !p;
    if (filtro === "critico") return p && p.criticos > 0;
    if (filtro === "ok") return p && p.criticos === 0 && (p.regime === "SIMPLES" || p.regime === "PRESUMIDO");
    if (filtro === "foraSimples") return p && (p.regime === "NAO_SIMPLES" || p.regime === "PRESUMIDO");
    if (filtro === "semDecl") return p && p.regime === "INDEFINIDO";
    return true;
  }), [clientes, painel, busca, filtro]);

  const tot = useMemo(() => {
    const ps = Object.values(painel);
    return { total: clientes.length, auditados: ps.length, criticos: ps.filter((p) => p.criticos > 0).length, ok: ps.filter((p) => p.criticos === 0 && (p.regime === "SIMPLES" || p.regime === "PRESUMIDO")).length, foraSimples: ps.filter((p) => p.regime === "NAO_SIMPLES" || p.regime === "PRESUMIDO").length, semDecl: ps.filter((p) => p.regime === "INDEFINIDO").length };
  }, [clientes, painel]);

  if (detalhe) {
    const a = detalhe.atual.resultado;
    return (
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Botao claro onClick={() => setDetalhe(null)}>← Voltar à lista</Botao>
          <Botao onClick={() => auditarEAbrir(detalhe.cliente)} disabled={fazendo[detalhe.cliente.codigo]}>{fazendo[detalhe.cliente.codigo] ? "Atualizando…" : "Atualizar agora pelo Drive"}</Botao>
        </div>
        <CorpoApuracao a={a} criadoEm={detalhe.atual.created_at} historico={detalhe.historico} atualId={detalhe.atual.id} abrirVersao={abrirVersao} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <div style={{ marginBottom: 12 }}><Botao claro onClick={onVoltar}>← Inteligência Tributária</Botao></div>
      <Cartao style={{ marginBottom: 12, borderTopWidth: 4, borderTopColor: NAVY }}>
        <div style={{ color: CORAL, fontSize: 9, fontWeight: 900, letterSpacing: 1 }}>AUDITORIA DE APURAÇÕES</div>
        <h2 style={{ margin: "6px 0" }}>Conferir se o imposto apurado está certo</h2>
        <p style={{ color: MUTED, fontSize: 12, lineHeight: 1.55, margin: 0, maxWidth: 800 }}>Lê direto do Drive as declarações e guias. Simples: refaz o PGDAS-D e compara com o DAS. Lucro Presumido: refaz IRPJ, CSLL, PIS, COFINS e ISS e compara com a MIT, DARFs e DAM. Mostra também as entregas sem movimento (MIT, PGDAS-D), a DCTFWeb da folha, a DIME e a DEFIS. Lucro Real ainda não é recalculado.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <Botao onClick={() => auditarLote(true)} disabled={!!lote || carregando}>Auditar clientes ainda não auditados</Botao>
          <Botao claro onClick={() => auditarLote(false)} disabled={!!lote || carregando}>Reauditar todos</Botao>
          <Botao claro onClick={carregar} disabled={!!lote || carregando}>Recarregar lista</Botao>
        </div>
        {lote && <div style={{ marginTop: 10, fontSize: 12 }}><b>{lote.feitos}/{lote.total}</b> · auditando {lote.atual}…<div style={{ height: 6, background: BORDER, borderRadius: 4, marginTop: 4 }}><div style={{ height: 6, width: `${(lote.feitos / Math.max(1, lote.total)) * 100}%`, background: CORAL, borderRadius: 4 }} /></div></div>}
      </Cartao>
      {falhasLote.length > 0 && <Cartao style={{ marginBottom: 12, borderColor: COR.atencao, fontSize: 12 }}>Concluído, mas {falhasLote.length} cliente(s) deram erro e ficaram pendentes: {falhasLote.join(" · ")}. Os demais já estão salvos. Clique em “Auditar clientes ainda não auditados” para tentar só estes.</Cartao>}
      {erro && <Cartao style={{ marginBottom: 12, borderColor: COR.critico, color: COR.critico, fontSize: 12 }}>{erro}</Cartao>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {[["todos", `Todos (${tot.total})`], ["pendente", `Não auditados (${tot.total - tot.auditados})`], ["critico", `Com divergência (${tot.criticos})`], ["ok", `Conferidos (${tot.ok})`], ["foraSimples", `Fora do Simples · MIT/DCTF (${tot.foraSimples})`], ["semDecl", `Sem nenhuma declaração (${tot.semDecl})`]].map(([k, r]) => (
          <button key={k} onClick={() => setFiltro(k)} style={{ border: `1px solid ${BORDER}`, background: filtro === k ? NAVY : WHITE, color: filtro === k ? WHITE : NAVY, borderRadius: 999, padding: "6px 12px", fontWeight: 800, fontSize: 11.5, cursor: "pointer" }}>{r}</button>))}
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente" style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "6px 10px", fontSize: 12, marginLeft: "auto" }} />
      </div>
      {carregando ? <Cartao>Carregando clientes do Drive…</Cartao> : (
        <Cartao style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead><tr style={{ textAlign: "left", color: MUTED, background: "#F6F8FB" }}>{["Cliente", "Declarações", "Sem movimento", "Críticos", "Atenção", "Saúde", "Última auditoria", ""].map((h) => <th key={h} style={{ padding: "8px 10px" }}>{h}</th>)}</tr></thead>
            <tbody>{lista.map((c) => {
              const p = painel[c.codigo];
              return (
                <tr key={c.codigo} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <td style={{ padding: "7px 10px", fontWeight: 800 }}>{c.codigo} - {c.nome}</td>
                  <td style={{ padding: "7px 10px" }}>{p ? (p.regime === "PRESUMIDO" ? <span style={{ color: COR.info }}>{p.declaracoes} MIT · Presumido/Real</span> : p.regime === "NAO_SIMPLES" ? <span style={{ color: COR.info }}>{p.declaracoes} DCTF · fora do Simples</span> : p.regime === "INDEFINIDO" ? <span style={{ color: COR.atencao }}>nenhuma encontrada</span> : p.declaracoes) : "—"}</td>
                  <td style={{ padding: "7px 10px" }}>{p?.entregas ? (p.entregas.semMovimento.length ? <Chips meses={p.entregas.semMovimento.slice(-6)} cor="#0D47A1" fundo="#E3EEFB" /> : "—") : "—"}{p?.entregas?.semMovimento?.length > 6 ? ` +${p.entregas.semMovimento.length - 6}` : ""}</td>
                  <td style={{ padding: "7px 10px", fontWeight: 900, color: p?.criticos > 0 ? COR.critico : MUTED }}>{p ? p.criticos : "—"}</td>
                  <td style={{ padding: "7px 10px", color: p?.atencoes > 0 ? COR.atencao : MUTED }}>{p ? p.atencoes : "—"}</td>
                  <td style={{ padding: "7px 10px" }}>{p ? p.saude : "—"}</td>
                  <td style={{ padding: "7px 10px", color: MUTED }}>{p ? dataBr(p.created_at) : "nunca"}</td>
                  <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                    {p && <Botao claro onClick={() => abrir(c)}>Ver</Botao>}{" "}
                    <Botao onClick={() => auditarEAbrir(c)} disabled={fazendo[c.codigo] || !!lote}>{fazendo[c.codigo] ? "Lendo…" : p ? "Atualizar" : "Auditar"}</Botao>
                  </td>
                </tr>);
            })}</tbody>
          </table>
        </Cartao>
      )}
    </div>
  );
}
