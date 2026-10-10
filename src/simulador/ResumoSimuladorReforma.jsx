import React from "react";

// Resumo legível do Simulador da Reforma Tributária para o painel do administrador.
// Lê o "snapshot" salvo no lead (contextoCliente.simuladorReforma) ou no diagnóstico.

const NAVY = "#17233D";
const MUTED = "#6B7280";

export function snapshotDoContexto(contexto) {
  const c = contexto && typeof contexto === "object" ? contexto : {};
  const s = c.simuladorReforma || c.perfil?.simuladorReforma || null;
  return s && typeof s === "object" && (s.resultado || s.configuracao || s.empresa) ? s : null;
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const moeda = (v) =>
  num(v) == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v, casas = 1) =>
  num(v) == null
    ? "—"
    : `${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas })}%`;

function Item({ titulo, valor }) {
  if (valor === null || valor === undefined || valor === "" || valor === "—") return null;
  return (
    <div style={{ background: "#F7F8FB", borderRadius: 9, padding: "8px 10px", minWidth: 0 }}>
      <div style={{ fontSize: 8.5, color: MUTED, fontWeight: 800, marginBottom: 2, textTransform: "uppercase" }}>
        {titulo}
      </div>
      <div style={{ fontSize: 11.5, color: NAVY, overflowWrap: "anywhere" }}>{valor}</div>
    </div>
  );
}

function Destaque({ titulo, valor, cor }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: "9px 11px" }}>
      <div style={{ fontSize: 8.5, color: MUTED, fontWeight: 800, textTransform: "uppercase" }}>{titulo}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: cor || NAVY, marginTop: 2 }}>{valor}</div>
    </div>
  );
}

export function SeloSimuladorLead({ contexto }) {
  const s = snapshotDoContexto(contexto);
  if (!s) return null;
  const dif = num(s.resultado?.diferenca);
  const comparavel = s.resultado?.comparacaoPermitida !== false && dif != null;
  return (
    <div style={{ marginTop: 5, display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
      <span style={{ background: "#E8F1FF", color: "#1D4ED8", borderRadius: 20, padding: "3px 8px", fontSize: 9, fontWeight: 800 }}>
        Simulador da Reforma
      </span>
      {comparavel && (
        <span style={{ fontSize: 9.5, fontWeight: 800, color: dif > 0 ? "#B42318" : "#176B47" }}>
          {dif > 0 ? "+" : ""}{moeda(dif)}/mês
        </span>
      )}
    </div>
  );
}

export default function ResumoSimuladorReforma({ contexto, snapshot }) {
  const s = snapshot || snapshotDoContexto(contexto);
  if (!s) return null;

  const emp = s.empresa || {};
  const cfg = s.configuracao || {};
  const res = s.resultado || {};
  const mem = s.memoria || {};
  const dec = s.decisao || {};
  const adicionais = Array.isArray(cfg.atividadesAdicionais) ? cfg.atividadesAdicionais : [];
  const dif = num(res.diferenca);
  const comparavel = res.comparacaoPermitida !== false && dif != null;
  const corDif = !comparavel ? NAVY : dif > 0 ? "#B42318" : "#176B47";
  const pendencias = Array.isArray(dec.pendencias) ? dec.pendencias.filter(Boolean) : [];

  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderLeft: "4px solid #176B47", borderRadius: 12, padding: 14, margin: "14px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
        <h3 style={{ margin: 0, fontSize: 14, color: NAVY }}>Simulador da Reforma Tributária</h3>
        <span style={{ fontSize: 9.5, color: MUTED }}>
          {cfg.cenarioAliquota ? `Cenário ${cfg.cenarioAliquota}` : ""}{dec.confianca ? ` · ${String(dec.confianca).toLowerCase()}` : ""}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8, margin: "10px 0" }}>
        <Destaque titulo="Carga atual / mês" valor={moeda(res.atual)} />
        <Destaque titulo="Cenário reforma / mês" valor={moeda(res.reforma)} />
        <Destaque titulo="Diferença / mês" valor={comparavel ? `${dif > 0 ? "+" : ""}${moeda(dif)}` : "A validar"} cor={corDif} />
        <Destaque titulo="Variação" valor={comparavel ? pct(res.variacaoPct, 2) : "—"} cor={corDif} />
      </div>

      {!comparavel && res.motivoPendencia && (
        <div style={{ background: "#FFF8E8", color: "#7A4B00", borderRadius: 9, padding: "7px 10px", fontSize: 10.5, marginBottom: 8 }}>
          {String(res.motivoPendencia)}
        </div>
      )}

      {dec.titulo && (
        <div style={{ background: "#EAF8F1", borderRadius: 9, padding: "8px 10px", fontSize: 11, color: NAVY, marginBottom: 8 }}>
          <b>{dec.titulo}.</b> {dec.destaque || ""}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 8 }}>
        <Item titulo="CNPJ" valor={emp.cnpj} />
        <Item titulo="Empresa" valor={emp.razaoSocial || emp.nomeFantasia} />
        <Item titulo="Porte" valor={emp.porte} />
        <Item titulo="Município / UF" valor={[emp.municipio, emp.uf].filter(Boolean).join(" / ")} />
        <Item titulo="Regime atual" valor={cfg.regime} />
        <Item titulo="Natureza" valor={cfg.natureza} />
        <Item titulo="Faturamento mensal" valor={num(cfg.faturamentoMensal) ? moeda(cfg.faturamentoMensal) : ""} />
        <Item titulo="CBS / IBS (premissa)" valor={num(cfg.cbsPct) != null ? `${pct(cfg.cbsPct, 2)} / ${pct(cfg.ibsPct, 2)}` : ""} />
        <Item titulo="Redução aplicada (CBS / IBS)" valor={num(cfg.reducaoCbsPct) != null ? `${pct(cfg.reducaoCbsPct)} / ${pct(cfg.reducaoIbsPct)}` : ""} />
        <Item titulo="Enquadramento legal" valor={cfg.tratamentoConfirmado === true ? "Confirmado" : cfg.tratamentoConfirmado === false ? "Não confirmado" : ""} />
        <Item titulo="IBS/CBS líquido" valor={num(mem.ibsCbsLiquido) != null ? moeda(mem.ibsCbsLiquido) : ""} />
        <Item titulo="Créditos estimados" valor={num(mem.creditoNovo) != null ? moeda(mem.creditoNovo) : ""} />
        <Item titulo="Carga atual informada?" valor={cfg.naoSeiImpostoAtual === true ? "Não — estimada" : cfg.naoSeiImpostoAtual === false ? "Sim" : ""} />
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 8.5, color: MUTED, fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>
          Atividades consideradas
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ background: "#F7F8FB", borderRadius: 9, padding: "8px 10px", fontSize: 11, color: NAVY }}>
            <b>Principal da simulação:</b> {emp.atividadeSelecionada || "—"}
            {adicionais.length > 0 && num(cfg.participacaoAtividadePrincipalPct) != null && ` · ${pct(cfg.participacaoAtividadePrincipalPct)} do faturamento`}
            {emp.descricaoAtividadeReal && emp.descricaoAtividadeReal !== emp.atividadeSelecionada && (
              <div style={{ color: MUTED, fontSize: 10.5, marginTop: 3 }}>O que faz de fato: {emp.descricaoAtividadeReal}</div>
            )}
          </div>
          {adicionais.map((a, i) => (
            <div key={`${a.cnae}-${i}`} style={{ background: "#F7F8FB", borderRadius: 9, padding: "8px 10px", fontSize: 11, color: NAVY }}>
              <b>Adicional:</b> {a.cnae ? `${a.cnae} — ` : ""}{a.descricao || ""}
              <div style={{ color: MUTED, fontSize: 10.5, marginTop: 3 }}>
                {pct(a.participacaoPct)} do faturamento · redução {pct(a.reducaoPct)} ·{" "}
                {a.confirmada ? "enquadramento confirmado" : "enquadramento não confirmado (sem redução)"}
                {a.baseLegal ? ` · ${a.baseLegal}` : ""}
              </div>
            </div>
          ))}
        </div>
      </div>

      {pendencias.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 8.5, color: MUTED, fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>
            Pendências para validar com o cliente
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 10.5, color: NAVY }}>
            {pendencias.slice(0, 6).map((p, i) => <li key={i}>{String(p)}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
