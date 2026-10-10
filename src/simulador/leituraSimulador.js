// Leitura do Simulador da Reforma (usada pelo relatório do cliente e pelo dossiê da administração).
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


export function montarLeituraSimulador(snapshot) {
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
