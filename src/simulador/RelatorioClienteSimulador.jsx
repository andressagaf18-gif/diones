import React from "react";
import { montarLeituraSimulador } from "./leituraSimulador.js";

// Relatório do CLIENTE para o Simulador da Reforma Tributária.
// Só usa dados que podem ser apresentados ao cliente: sem score, sem dados
// de LGPD/IP, sem observações comerciais internas. Cabe em 1–2 páginas A4.

const NAVY = "#17233D";
const MUTED = "#5B667A";
const CORAL = "#FF6B4A";
const VERDE = "#176B47";
const VERMELHO = "#B42318";
const LINHA = "#E3E7EF";

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const moeda = (v) =>
  num(v) == null
    ? "—"
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const moeda2 = (v) =>
  num(v) == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v, c = 1) =>
  num(v) == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: c })}%`;
const cnpjFmt = (v = "") => {
  const d = String(v).replace(/\D/g, "");
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : String(v || "");
};

const ROTULOS_ATUAL = [
  ["pis", "PIS"],
  ["cofins", "Cofins"],
  ["icms", "ICMS"],
  ["iss", "ISS"],
  ["ipi", "IPI"],
  ["cpp", "CPP / folha"],
  ["irpj", "IRPJ"],
  ["adicionalIrpj", "Adicional de IRPJ"],
  ["csll", "CSLL"],
  ["outros", "Outros tributos"],
];

function Secao({ titulo, children, style }) {
  return (
    <section style={{ marginTop: 14, breakInside: "avoid", pageBreakInside: "avoid", ...style }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 12.5, color: NAVY, borderBottom: `2px solid ${CORAL}`, paddingBottom: 3, display: "inline-block" }}>
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function Tabela({ colunas, linhas, destaqueUltima = false, alinharDireita = [] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
      <thead>
        <tr>
          {colunas.map((c, i) => (
            <th key={i} style={{ textAlign: alinharDireita.includes(i) ? "right" : "left", padding: "4px 6px", background: "#F7F8FB", color: MUTED, fontSize: 9, textTransform: "uppercase", borderBottom: `1px solid ${LINHA}` }}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map((l, r) => (
          <tr key={r} style={destaqueUltima && r === linhas.length - 1 ? { fontWeight: 800, background: "#FFF9F7" } : undefined}>
            {l.map((c, i) => (
              <td key={i} style={{ padding: "4px 6px", borderBottom: `1px solid ${LINHA}`, textAlign: alinharDireita.includes(i) ? "right" : "left", color: NAVY }}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export { montarLeituraSimulador };

export default function RelatorioClienteSimulador({ snapshot, geradoEm }) {
  const s = snapshot || {};
  const emp = s.empresa || {};
  const cfg = s.configuracao || {};
  const res = s.resultado || {};
  const mem = s.memoria || {};
  const adicionais = Array.isArray(cfg.atividadesAdicionais) ? cfg.atividadesAdicionais : [];
  const leitura = montarLeituraSimulador(s);
  const corManchete = leitura.sentido === "aumento" ? VERMELHO : leitura.sentido === "reducao" ? VERDE : NAVY;
  const fundoManchete = leitura.sentido === "aumento" ? "#FDECEA" : leitura.sentido === "reducao" ? "#EAF8F1" : "#F7F8FB";

  const compAtual = ROTULOS_ATUAL.map(([k, rot]) => [rot, num(cfg.composicaoCargaAtual?.[k])]).filter(([, v]) => v);
  const linhasAtual = compAtual.map(([r, v]) => [r, moeda(v)]);
  linhasAtual.push(["Total por mês", moeda(res.atual)]);

  const linhasReforma = [];
  const add = (rot, v, sinal = "") => { if (num(v)) linhasReforma.push([rot, `${sinal}${moeda(v)}`]); };
  add("Débito de CBS", mem.debitoCbs);
  add("Crédito de CBS", mem.creditoCbs, "− ");
  add("Débito de IBS", mem.debitoIbs);
  add("Crédito de IBS", mem.creditoIbs, "− ");
  add("IBS/CBS a pagar", mem.ibsCbsLiquido);
  add("PIS/Cofins que permanecem na transição", mem.pisCofinsRemanescentes);
  add("ICMS/ISS que permanecem na transição", mem.icmsIssRemanescentes);
  add("IR, CSLL, folha e outros tributos mantidos", mem.tributosMantidos);
  linhasReforma.push(["Total por mês", moeda(res.reforma)]);

  const transicao = (Array.isArray(s.transicao) ? s.transicao : []).filter((t) => t && t.ano);
  const linhasTransicao = transicao.map((t) => [
    String(t.ano),
    num(t.total) != null ? moeda(t.total) : "—",
    num(t.iva) != null ? moeda(t.iva) : "—",
    String(t.status || "").replace(/\s+/g, " ").slice(0, 70),
  ]);

  const dataTexto = geradoEm ? new Date(geradoEm).toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR");

  return (
    <div style={{ background: "#fff", color: NAVY, fontSize: 11, lineHeight: 1.5, padding: "4px 2px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 900, color: CORAL, letterSpacing: 0.7 }}>FINDER OF SOLUTIONS · SIMULAÇÃO DA REFORMA TRIBUTÁRIA</div>
          <h2 style={{ margin: "3px 0 2px", fontSize: 20, fontFamily: "Georgia, serif" }}>{emp.razaoSocial || emp.nomeFantasia || "Empresa"}</h2>
          <div style={{ color: MUTED, fontSize: 10.5 }}>
            {[emp.cnpj ? `CNPJ ${cnpjFmt(emp.cnpj)}` : "", emp.porte, [emp.municipio, emp.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div style={{ color: MUTED, fontSize: 10, textAlign: "right" }}>
          Emitido em {dataTexto}
          {cfg.cenarioAliquota ? <><br />Cenário de referência: {cfg.cenarioAliquota}</> : null}
        </div>
      </header>

      <div style={{ marginTop: 12, background: fundoManchete, borderLeft: `5px solid ${corManchete}`, borderRadius: 8, padding: "10px 12px" }}>
        <div style={{ fontSize: 9, fontWeight: 900, color: corManchete, textTransform: "uppercase", marginBottom: 3 }}>Resultado da simulação</div>
        <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>{leitura.manchete}</div>
        {!leitura.comparavel && res.motivoPendencia && (
          <div style={{ marginTop: 5, fontSize: 10.5, color: MUTED }}>{String(res.motivoPendencia)}</div>
        )}
      </div>

      {leitura.comparavel && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 8 }}>
          {[
            ["Hoje / mês", moeda(res.atual), NAVY],
            ["Com a reforma / mês", moeda(res.reforma), NAVY],
            ["Diferença / mês", `${leitura.dif > 0 ? "+" : leitura.dif < 0 ? "−" : ""}${moeda(Math.abs(leitura.dif))}`, corManchete],
            ["Diferença / ano", `${leitura.dif > 0 ? "+" : leitura.dif < 0 ? "−" : ""}${moeda(Math.abs(leitura.dif) * 12)}`, corManchete],
          ].map(([t, v, c]) => (
            <div key={t} style={{ border: `1px solid ${LINHA}`, borderRadius: 8, padding: "7px 9px" }}>
              <div style={{ fontSize: 8.5, color: MUTED, fontWeight: 800, textTransform: "uppercase" }}>{t}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: c }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      <Secao titulo="O que foi considerado">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "4px 14px", fontSize: 10.5 }}>
          {[
            ["Regime atual", cfg.regime],
            ["Natureza da operação", cfg.natureza],
            ["Faturamento mensal", num(cfg.faturamentoMensal) ? moeda(cfg.faturamentoMensal) : ""],
            ["Alíquotas de referência", num(cfg.cbsPct) != null ? `CBS ${pct(cfg.cbsPct, 2)} · IBS ${pct(cfg.ibsPct, 2)}` : ""],
            ["Redução aplicada", num(cfg.reducaoCbsPct) != null ? pct(cfg.reducaoCbsPct) : ""],
            ["Enquadramento legal", cfg.tratamentoConfirmado === true ? "Confirmado" : cfg.tratamentoConfirmado === false ? "Não confirmado" : ""],
          ].filter(([, v]) => v).map(([t, v]) => (
            <div key={t}><span style={{ color: MUTED }}>{t}: </span><b>{v}</b></div>
          ))}
        </div>
        <div style={{ marginTop: 6, fontSize: 10.5 }}>
          <span style={{ color: MUTED }}>Atividade principal: </span><b>{emp.atividadeSelecionada || "—"}</b>
          {adicionais.length > 0 && num(cfg.participacaoAtividadePrincipalPct) != null && ` (${pct(cfg.participacaoAtividadePrincipalPct)} do faturamento)`}
          {adicionais.map((a, i) => (
            <div key={i}>
              <span style={{ color: MUTED }}>Atividade adicional: </span>
              <b>{a.cnae ? `${a.cnae} — ` : ""}{a.descricao}</b> ({pct(a.participacaoPct)} do faturamento, redução {pct(a.reducaoPct)})
            </div>
          ))}
        </div>
      </Secao>

      {leitura.comparavel && (
        <Secao titulo="Como chegamos ao resultado">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Tabela colunas={["Hoje", "Valor / mês"]} linhas={linhasAtual} destaqueUltima alinharDireita={[1]} />
            <Tabela colunas={["Com a reforma", "Valor / mês"]} linhas={linhasReforma} destaqueUltima alinharDireita={[1]} />
          </div>
        </Secao>
      )}

      {leitura.pontos.length > 0 && (
        <Secao titulo="O que isso significa">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11 }}>
            {leitura.pontos.map((p, i) => <li key={i} style={{ marginBottom: 3 }}>{p}</li>)}
          </ul>
        </Secao>
      )}

      {linhasTransicao.length > 0 && (
        <Secao titulo="Transição de 2026 a 2033">
          <Tabela colunas={["Ano", "Carga total / mês", "IBS/CBS / mês", "Situação"]} linhas={linhasTransicao} alinharDireita={[1, 2]} />
        </Secao>
      )}

      {leitura.pendencias.length > 0 && (
        <Secao titulo="Pontos a confirmar">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 10.5 }}>
            {leitura.pendencias.map((p, i) => <li key={i}>{String(p)}</li>)}
          </ul>
        </Secao>
      )}

      <Secao titulo="Próximos passos">
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 11 }}>
          {leitura.passos.map((p, i) => <li key={i} style={{ marginBottom: 3 }}>{p}</li>)}
        </ol>
      </Secao>

      <p style={{ marginTop: 14, fontSize: 9, color: MUTED, lineHeight: 1.4 }}>
        Estimativa gerencial feita com as informações prestadas e premissas de referência que ainda podem mudar. Não substitui análise contábil e jurídica. Valores arredondados.
      </p>
    </div>
  );
}
