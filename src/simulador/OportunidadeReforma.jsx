import React from "react";

const NAVY = "#17233D";
const MUTED = "#6B7488";

// Pontua o potencial de atendimento de um lead da Reforma Tributária a partir
// da triagem que o cliente respondeu. É uma leitura interna (não vai ao cliente).
export function calcularOportunidadeReforma(contexto) {
  const r = contexto?.reformaTributaria;
  if (!r || typeof r !== "object" || !r.perfilClientes) return null;

  let pontos = 0;
  const sinais = [];
  const add = (p, texto, alerta = true) => {
    pontos += p;
    if (texto) sinais.push({ texto, alerta });
  };

  if (r.perfilClientes === "B2B") add(20, "Vende para empresas (B2B): crédito e repasse pesam mais");
  else if (r.perfilClientes === "MISTO") add(14, "Vende para empresas e consumidor final");
  else if (r.perfilClientes === "GOVERNO") add(6, "Vende para o governo: regras específicas");

  if (r.comprasCredito === "ALTO") add(15, "Alto volume de compras ligadas à operação (potencial de crédito)");
  else if (r.comprasCredito === "MEDIO") add(8, "Volume médio de compras com potencial de crédito");

  if (r.repassePreco === "BAIXA") add(15, "Baixa capacidade de repassar custo ao preço (risco de margem)");
  else if (r.repassePreco === "NAO_SEI") add(8, "Não sabe se consegue repassar preço");

  if (r.erp === "NAO_INICIADO") add(15, "ERP/sistema fiscal ainda sem preparação para IBS/CBS");
  else if (r.erp === "ANDAMENTO") add(8, "ERP em adequação");

  if (r.contratos === "NAO") add(10, "Contratos e política comercial não revisados");
  else if (r.contratos === "PARCIAL") add(5, "Revisão de contratos parcial");

  if (r.beneficios === "SIM" || r.beneficios === "ANALISAR")
    add(12, "Possui (ou pode ter) benefício fiscal / regime especial");

  const ops = (Array.isArray(r.operacoes) ? r.operacoes : []).filter((x) => x && !/^nenhuma/i.test(x));
  if (ops.length) add(Math.min(10, 4 + ops.length * 2), `Operações especiais: ${ops.slice(0, 3).join(", ")}`);

  if (r.folha === "ALTO") add(5, "Folha de pagamento pesada na operação");

  if (r.preparacao === "NAO_INICIOU") add(8, "Ainda não começou a se preparar");
  else if (r.preparacao === "ENTENDENDO") add(4, "Ainda entendendo os impactos");

  if (contexto?.simuladorReforma) add(10, "Já usou o simulador (interesse concreto)", false);

  const score = Math.max(0, Math.min(100, Math.round(pontos)));
  const nivel = score >= 60 ? "ALTA" : score >= 35 ? "MÉDIA" : "BAIXA";
  return { score, nivel, sinais };
}

const CORES = {
  ALTA: { bg: "#FDECEA", cor: "#B42318" },
  "MÉDIA": { bg: "#FFF4E0", cor: "#B25E09" },
  BAIXA: { bg: "#EAF7F0", cor: "#176B47" },
};

export function SeloOportunidadeReforma({ contexto }) {
  const o = calcularOportunidadeReforma(contexto);
  if (!o) return null;
  const c = CORES[o.nivel];
  const principais = o.sinais.filter((s) => s.alerta).slice(0, 2);
  return (
    <div style={{ marginTop: 5, display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
      <span style={{ background: c.bg, color: c.cor, borderRadius: 20, padding: "3px 8px", fontSize: 9, fontWeight: 800 }}>
        Oportunidade {o.nivel} · {o.score}
      </span>
      {principais.map((s) => (
        <span key={s.texto} style={{ background: "#F3F4F8", color: NAVY, borderRadius: 20, padding: "3px 7px", fontSize: 8.5, fontWeight: 700 }}>
          {s.texto.split(":")[0].split("(")[0].trim()}
        </span>
      ))}
    </div>
  );
}

export default function PainelOportunidadeReforma({ contexto }) {
  const o = calcularOportunidadeReforma(contexto);
  if (!o) return null;
  const c = CORES[o.nivel];
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 14, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 9, color: MUTED, fontWeight: 800, letterSpacing: .6 }}>OPORTUNIDADE · REFORMA TRIBUTÁRIA (INTERNO)</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginTop: 3 }}>Potencial de atendimento</div>
        </div>
        <span style={{ background: c.bg, color: c.cor, borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 900 }}>
          {o.nivel} · {o.score}/100
        </span>
      </div>
      <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 11, color: NAVY, lineHeight: 1.6 }}>
        {o.sinais.map((s) => <li key={s.texto}>{s.texto}</li>)}
      </ul>
      <p style={{ margin: "8px 0 0", fontSize: 9.5, color: MUTED }}>
        Pontuação automática a partir da triagem respondida pelo cliente. Serve para priorizar o contato, não substitui a análise.
      </p>
    </div>
  );
}
