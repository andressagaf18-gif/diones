import React from "react";
// (autossuficiente: não depende de outros arquivos do simulador)
const montarLeituraSimulador = (() => {
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


function montarLeitura(snapshot) {
  const s = snapshot || {};
  const cfg = s.configuracao || {};
  const res = s.resultado || {};
  const mem = s.memoria || {};
  const dif = num(res.diferenca);
  const comparavel = res.comparacaoPermitida !== false && dif != null && num(res.atual) != null && num(res.reforma) != null;
  // Alíquota efetiva real da simulação: débitos de IBS/CBS sobre a base usada.
  // Só cai nas alíquotas de referência quando a memória de cálculo não existe.
  const debitos = (num(mem.debitoCbs) || 0) + (num(mem.debitoIbs) || 0);
  const aliqDerivada = num(mem.baseIbsCbs) > 0 && debitos > 0 ? (debitos / mem.baseIbsCbs) * 100 : null;
  const aliq = aliqDerivada ?? num(cfg.ivaEfetivoPct) ?? ((num(cfg.cbsEfetivaPct) ?? 0) + (num(cfg.ibsEfetivaPct) ?? 0));
  const regular = cfg.regime && cfg.regime !== "Simples Nacional";

  let manchete = "Resultado preliminar: ainda faltam dados para comparar com segurança.";
  let sentido = "neutro";
  if (comparavel) {
    if (Math.abs(dif) < 1) {
      manchete = `A carga tributária estimada fica praticamente igual: ${moeda(res.atual)} por mês.`;
    } else if (dif > 0) {
      sentido = "aumento";
      manchete = `Pelas premissas informadas, a carga tributária mensal passa de ${moeda(res.atual)} para ${moeda(res.reforma)}: um aumento de ${moeda(dif)} por mês (${pct(res.variacaoPct, 1)}), cerca de ${moeda(dif * 12)} por ano.`;
    } else {
      sentido = "reducao";
      manchete = `Pelas premissas informadas, a carga tributária mensal passa de ${moeda(res.atual)} para ${moeda(res.reforma)}: uma redução de ${moeda(Math.abs(dif))} por mês (${pct(Math.abs(num(res.variacaoPct) ?? 0), 1)}), cerca de ${moeda(Math.abs(dif) * 12)} por ano.`;
    }
  }

  const pontos = [];
  const creditoNovo = num(mem.creditoNovo) ?? num(s.creditos?.creditoNovo);
  if (regular && comparavel && dif > 0 && aliq > 0) {
    const neutraliza = dif / (aliq / 100);
    if (!creditoNovo) {
      pontos.push(
        `Nenhum crédito de IBS/CBS foi considerado. Se a empresa tiver cerca de ${moeda(neutraliza)} por mês em despesas que geram crédito (insumos, aluguel, tecnologia, serviços contratados), o aumento estimado seria neutralizado. A cada R$ 10.000 de despesas com crédito, o IBS/CBS a pagar cai cerca de ${moeda(10000 * aliq / 100)} por mês.`
      );
    } else {
      pontos.push(`Créditos de IBS/CBS considerados na simulação: ${moeda(creditoNovo)} por mês. Despesas adicionais com direito a crédito reduzem ainda mais o impacto (cerca de ${moeda(10000 * aliq / 100)} por mês a cada R$ 10.000).`);
    }
  }
  if (num(cfg.reducaoCbsPct) === 0 && num(cfg.reducaoIbsPct) === 0 && cfg.regime) {
    pontos.push("Foi aplicada a alíquota padrão, sem redução. Se a atividade tiver tratamento favorecido, o resultado muda; por isso o enquadramento deve ser confirmado.");
  } else if (num(cfg.reducaoCbsPct) > 0) {
    pontos.push(`Foi considerada redução de ${pct(cfg.reducaoCbsPct)} nas alíquotas de CBS e IBS${cfg.tratamentoConfirmado ? ", com enquadramento legal confirmado" : ", ainda sem confirmação do enquadramento legal"}.`);
  }
  if (cfg.naoSeiImpostoAtual) {
    pontos.push("A carga atual foi estimada, pois o valor real dos tributos não foi informado. Confirmar com as apurações e os documentos fiscais deixa o comparativo mais preciso.");
  }
  const trans = Array.isArray(s.transicao) ? s.transicao.filter((t) => num(t?.total) != null) : [];
  if (trans.length > 1 && num(res.atual) != null) {
    const maior = trans.reduce((a, b) => (b.total > a.total ? b : a));
    pontos.push(`A mudança é gradual entre 2026 e 2033. Na simulação, o maior valor mensal aparece em ${maior.ano} (${moeda(maior.total)}), em comparação com ${moeda(res.atual)} hoje.`);
  }
  const pendencias = (Array.isArray(s.decisao?.pendencias) ? s.decisao.pendencias : []).filter(Boolean).slice(0, 4);

  const passos = [];
  if (regular && comparavel && dif > 0) passos.push("Levantar as despesas que geram crédito de IBS/CBS: é a principal forma de reduzir o impacto.");
  passos.push("Confirmar a carga atual e os dados da simulação com as apurações e os documentos fiscais.");
  passos.push("Conversar com a Finder para comparar alternativas (regime, formação de preços e créditos) e montar o plano de preparação.");

  return { manchete, sentido, pontos, pendencias, passos, comparavel, dif };
}


// Dossiê da ADMINISTRAÇÃO para o Simulador da Reforma.
// Reúne tudo o que um consultor (ou a IA, no parecer consultivo) precisa:
// premissas, memória de cálculo, créditos, transição, conferências
// automáticas e pontos para a reunião. Uso interno.
  return montarLeitura;
})();

const NAVY = "#17233D";
const MUTED = "#5B667A";
const LINHA = "#E3E7EF";

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const moeda = (v) =>
  num(v) == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v, c = 2) =>
  num(v) == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: c })}%`;

function Bloco({ titulo, children }) {
  return (
    <section style={{ marginTop: 14, breakInside: "avoid", pageBreakInside: "avoid" }}>
      <h4 style={{ margin: "0 0 6px", fontSize: 12, color: NAVY }}>{titulo}</h4>
      {children}
    </section>
  );
}

function Tabela({ colunas, linhas, direita = [] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
      <thead>
        <tr>
          {colunas.map((c, i) => (
            <th key={i} style={{ textAlign: direita.includes(i) ? "right" : "left", padding: "4px 6px", background: "#F7F8FB", color: MUTED, fontSize: 9, textTransform: "uppercase", borderBottom: `1px solid ${LINHA}` }}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map((l, r) => (
          <tr key={r}>
            {l.map((c, i) => (
              <td key={i} style={{ padding: "4px 6px", borderBottom: `1px solid ${LINHA}`, textAlign: direita.includes(i) ? "right" : "left", color: NAVY }}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Conferências simples de coerência dos números salvos na simulação.
export function conferirSimulacao(snapshot) {
  const s = snapshot || {};
  const cfg = s.configuracao || {};
  const res = s.resultado || {};
  const mem = s.memoria || {};
  const alertas = [];

  const comp = cfg.composicaoCargaAtual || {};
  const somaComp = Object.values(comp).reduce((t, v) => t + (num(v) || 0), 0);
  if (num(res.atual) != null && somaComp > 0 && Math.abs(somaComp - res.atual) > Math.max(1, res.atual * 0.02)) {
    alertas.push(`A soma dos tributos informados (${moeda(somaComp)}) difere da carga atual usada na comparação (${moeda(res.atual)}).`);
  }
  if (cfg.regime !== "Simples Nacional" && num(res.reforma) != null && num(mem.ibsCbsLiquido) != null) {
    const partes =
      (num(mem.ibsCbsLiquido) || 0) +
      (num(mem.pisCofinsRemanescentes) || 0) +
      (num(mem.icmsIssRemanescentes) || 0) +
      (num(mem.tributosMantidos) || 0);
    if (Math.abs(partes - res.reforma) > Math.max(1, res.reforma * 0.02)) {
      alertas.push(`Os componentes do cenário da reforma (${moeda(partes)}) não fecham com o total apresentado (${moeda(res.reforma)}).`);
    }
  }
  if (num(res.diferenca) != null && num(res.atual) != null && num(res.reforma) != null) {
    if (Math.abs(res.reforma - res.atual - res.diferenca) > 1) {
      alertas.push("A diferença apresentada não corresponde a reforma menos atual.");
    }
  }
  if (num(cfg.faturamentoMensal) && num(res.atual) != null && res.atual / cfg.faturamentoMensal > 0.6) {
    alertas.push("A carga atual passa de 60% do faturamento; vale conferir se os valores informados estão corretos.");
  }
  if (num(cfg.faturamentoMensal) === 0 || num(cfg.faturamentoMensal) == null) {
    alertas.push("Faturamento mensal não informado.");
  }
  if (cfg.naoSeiImpostoAtual) alertas.push("A carga atual é estimativa: o cliente não soube informar o valor real.");
  if (cfg.tratamentoConfirmado === false && (num(cfg.reducaoCbsPct) || 0) > 0) {
    alertas.push("Há redução de alíquota aplicada sem enquadramento legal confirmado.");
  }
  const adic = Array.isArray(cfg.atividadesAdicionais) ? cfg.atividadesAdicionais : [];
  if (adic.length) {
    const soma = adic.reduce((t, a) => t + (num(a.participacaoPct) || 0), 0);
    if (soma <= 0 || soma >= 100) alertas.push("A participação das atividades adicionais está inconsistente (soma fora de 0–100%).");
    const naoConf = adic.filter((a) => !a.confirmada).length;
    if (naoConf) alertas.push(`${naoConf} atividade(s) adicional(is) sem enquadramento confirmado (entraram sem redução).`);
  }
  return alertas;
}

export default function DossieAdminSimulador({ snapshot }) {
  const s = snapshot || {};
  const cfg = s.configuracao || {};
  const res = s.resultado || {};
  const mem = s.memoria || {};
  const cred = s.creditos || {};
  const dec = s.decisao || {};
  const leitura = montarLeituraSimulador(s);
  const alertas = conferirSimulacao(s);

  const premissas = [
    ["Regime atual", cfg.regime],
    ["Natureza", cfg.natureza],
    ["Perfil dos clientes", cfg.perfilClientes],
    ["Faturamento mensal", num(cfg.faturamentoMensal) ? moeda(cfg.faturamentoMensal) : ""],
    ["Carga atual informada", cfg.naoSeiImpostoAtual ? "Não (estimada)" : num(cfg.impostoAtualMensal) ? moeda(cfg.impostoAtualMensal) : ""],
    ["RBT12", num(cfg.rbt12) ? moeda(cfg.rbt12) : ""],
    ["Anexo do Simples", cfg.anexoSimples],
    ["Folha 12 meses", num(cfg.fs12) ? moeda(cfg.fs12) : ""],
    ["Alíquota local (ISS/ICMS)", num(cfg.aliquotaLocalAtualPct) ? `${pct(cfg.aliquotaLocalAtualPct)}${cfg.aliquotaLocalConfirmada ? " (confirmada)" : " (não confirmada)"}` : ""],
    ["Cenário", cfg.cenarioAliquota],
    ["CBS / IBS de referência", num(cfg.cbsPct) != null ? `${pct(cfg.cbsPct)} / ${pct(cfg.ibsPct)}` : ""],
    ["CBS / IBS efetivos no ano", num(cfg.cbsEfetivaPct) != null ? `${pct(cfg.cbsEfetivaPct)} / ${pct(cfg.ibsEfetivaPct)}` : ""],
    ["Redução (CBS / IBS)", num(cfg.reducaoCbsPct) != null ? `${pct(cfg.reducaoCbsPct, 1)} / ${pct(cfg.reducaoIbsPct, 1)}` : ""],
    ["Tratamento", cfg.tratamentoIbsCbs],
    ["Enquadramento", cfg.tratamentoConfirmado === true ? "Confirmado" : cfg.tratamentoConfirmado === false ? "Não confirmado" : ""],
    ["Base legal / classificação", cfg.classificacaoFiscal],
    ["IBS/CBS no Simples", cfg.opcaoSimplesIbsCbs],
    ["Crescimento projetado", num(cfg.crescimentoPct) != null ? pct(cfg.crescimentoPct, 1) : ""],
  ].filter(([, v]) => v !== "" && v != null && v !== undefined);

  const linhasMem = [
    ["Faturamento", mem.faturamento],
    ["Base de IBS/CBS", mem.baseIbsCbs],
    ["Débito de CBS", mem.debitoCbs],
    ["Crédito de CBS", mem.creditoCbs],
    ["CBS líquida", mem.cbsLiquida],
    ["Débito de IBS", mem.debitoIbs],
    ["Crédito de IBS", mem.creditoIbs],
    ["IBS líquido", mem.ibsLiquido],
    ["IBS/CBS líquido", mem.ibsCbsLiquido],
    ["PIS/Cofins remanescentes", mem.pisCofinsRemanescentes],
    ["ICMS/ISS remanescentes", mem.icmsIssRemanescentes],
    ["IPI remanescente", mem.ipiRemanescente],
    ["IR, CSLL, folha, outros e IS mantidos", mem.tributosMantidos],
    ["DAS residual", mem.dasResidual],
    ["Preço final com IBS/CBS", mem.precoFinalComIbsCbs],
    ["Total no cenário da reforma", mem.totalReforma],
  ].filter(([, v]) => num(v) != null && v !== 0).map(([r, v]) => [r, moeda(v)]);

  const trans = (Array.isArray(s.transicao) ? s.transicao : []).filter((t) => t && t.ano);

  return (
    <div style={{ background: "#fff", border: `1px solid ${LINHA}`, borderLeft: "4px solid #31589C", borderRadius: 12, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 9, color: "#31589C", fontWeight: 900, marginBottom: 4 }}>DOSSIÊ DA SIMULAÇÃO · USO INTERNO</div>
      <h3 style={{ margin: "0 0 6px", fontSize: 15, color: NAVY }}>Relatório da Administração — Simulador da Reforma</h3>
      <p style={{ margin: "0 0 4px", fontSize: 11.5, color: NAVY, lineHeight: 1.5 }}>{leitura.manchete}</p>
      {dec.titulo && (
        <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
          Conclusão do motor: <b style={{ color: NAVY }}>{dec.titulo}</b>
          {dec.confianca ? ` · confiança ${String(dec.confianca).toLowerCase()}` : ""}
        </p>
      )}

      {alertas.length > 0 && (
        <Bloco titulo="Conferências automáticas">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 10.5, color: "#7A4B00" }}>
            {alertas.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </Bloco>
      )}

      {premissas.length > 0 && (
        <Bloco titulo="Premissas usadas">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "3px 14px", fontSize: 10.5 }}>
            {premissas.map(([t, v]) => (
              <div key={t}><span style={{ color: MUTED }}>{t}: </span><b>{String(v)}</b></div>
            ))}
          </div>
        </Bloco>
      )}

      {linhasMem.length > 0 && (
        <Bloco titulo="Memória de cálculo (mensal)">
          <Tabela colunas={["Item", "Valor"]} linhas={linhasMem} direita={[1]} />
        </Bloco>
      )}

      {(num(cred.despesasMensais) != null || num(cred.creditoNovo) != null) && (
        <Bloco titulo="Créditos">
          <div style={{ fontSize: 10.5 }}>
            Despesas informadas: <b>{moeda(cred.despesasMensais)}</b> · Crédito considerado: <b>{moeda(cred.creditoNovo)}</b> · Base confirmada: <b>{moeda(cred.baseCreditosConfirmados)}</b>
            {!num(cred.creditoNovo) && " — nenhum crédito foi considerado; é a principal alavanca de revisão do resultado."}
          </div>
        </Bloco>
      )}

      {trans.length > 0 && (
        <Bloco titulo="Transição 2026–2033">
          <Tabela
            colunas={["Ano", "Carga total / mês", "IBS/CBS / mês", "Situação"]}
            linhas={trans.map((t) => [String(t.ano), moeda(t.total), moeda(t.iva), String(t.status || "").replace(/\s+/g, " ").slice(0, 90)])}
            direita={[1, 2]}
          />
        </Bloco>
      )}

      {(Array.isArray(dec.justificativas) && dec.justificativas.length > 0) && (
        <Bloco titulo="Justificativas do motor">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 10.5 }}>
            {dec.justificativas.filter(Boolean).slice(0, 5).map((j, i) => <li key={i}>{String(j)}</li>)}
          </ul>
        </Bloco>
      )}

      {(leitura.pontos.length > 0 || leitura.pendencias.length > 0) && (
        <Bloco titulo="Pontos para a reunião com o cliente">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 10.5 }}>
            {leitura.pontos.map((p, i) => <li key={`p${i}`}>{p}</li>)}
            {leitura.pendencias.map((p, i) => <li key={`d${i}`}>Confirmar: {String(p)}</li>)}
          </ul>
        </Bloco>
      )}

      <p style={{ margin: "12px 0 0", fontSize: 9.5, color: MUTED }}>
        A leitura consultiva abaixo ("Leitura aberta do consultor") usa estes mesmos dados para gerar hipóteses, caminhos, plano 30/60/90 e roteiro da reunião.
      </p>
    </div>
  );
}
