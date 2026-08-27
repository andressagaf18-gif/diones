// =========================================================
// SIMULADOR FISCAL — MOTOR DE CÁLCULO
// Reforma Tributária (IBS/CBS) + Planejamento Tributário
// Módulo novo e independente — não reutiliza o módulo
// "Inteligência Tributária" já existente no sistema.
//
// Todos os valores são ESTIMATIVAS para apoiar a conversa
// comercial/consultiva. A composição de cada tributo dentro
// do DAS é aproximada por Anexo (não por faixa), e pode — e
// deve — ser ajustada nas "Premissas avançadas" antes de
// apresentar ao cliente.
// =========================================================

// ---------------------------------------------------------
// 1. TABELAS DO SIMPLES NACIONAL (LC 123/2006, redação atual)
// ---------------------------------------------------------

export const ANEXOS = {
  I: {
    label: "Anexo I — Comércio",
    faixas: [
      { ate: 180000, aliquota: 0.04, pd: 0 },
      { ate: 360000, aliquota: 0.073, pd: 5940 },
      { ate: 720000, aliquota: 0.095, pd: 13860 },
      { ate: 1800000, aliquota: 0.107, pd: 22500 },
      { ate: 3600000, aliquota: 0.143, pd: 87300 },
      { ate: 4800000, aliquota: 0.19, pd: 378000 },
    ],
    // composição aproximada do DAS, ajustável
    composicao: { federal: 0.45, cpp: 0.21, icms: 0.34, iss: 0, ipi: 0 },
  },
  II: {
    label: "Anexo II — Indústria",
    faixas: [
      { ate: 180000, aliquota: 0.045, pd: 0 },
      { ate: 360000, aliquota: 0.078, pd: 5940 },
      { ate: 720000, aliquota: 0.10, pd: 13860 },
      { ate: 1800000, aliquota: 0.112, pd: 22500 },
      { ate: 3600000, aliquota: 0.147, pd: 85500 },
      { ate: 4800000, aliquota: 0.30, pd: 720000 },
    ],
    composicao: { federal: 0.40, cpp: 0.20, icms: 0.27, iss: 0, ipi: 0.13 },
  },
  III: {
    label: "Anexo III — Serviços (geral)",
    faixas: [
      { ate: 180000, aliquota: 0.06, pd: 0 },
      { ate: 360000, aliquota: 0.112, pd: 9360 },
      { ate: 720000, aliquota: 0.135, pd: 17640 },
      { ate: 1800000, aliquota: 0.16, pd: 35640 },
      { ate: 3600000, aliquota: 0.21, pd: 125640 },
      { ate: 4800000, aliquota: 0.33, pd: 648000 },
    ],
    composicao: { federal: 0.46, cpp: 0.39, icms: 0, iss: 0.15, ipi: 0 },
  },
  IV: {
    label: "Anexo IV — Serviços (CPP por fora)",
    faixas: [
      { ate: 180000, aliquota: 0.045, pd: 0 },
      { ate: 360000, aliquota: 0.09, pd: 8100 },
      { ate: 720000, aliquota: 0.102, pd: 12420 },
      { ate: 1800000, aliquota: 0.14, pd: 39780 },
      { ate: 3600000, aliquota: 0.22, pd: 183780 },
      { ate: 4800000, aliquota: 0.33, pd: 828000 },
    ],
    // CPP não entra no DAS neste anexo — é recolhido à parte (GPS), sobre a folha
    composicao: { federal: 0.80, cpp: 0, icms: 0, iss: 0.20, ipi: 0 },
    cppPorFora: true,
  },
  V: {
    label: "Anexo V — Serviços intelectuais",
    faixas: [
      { ate: 180000, aliquota: 0.155, pd: 0 },
      { ate: 360000, aliquota: 0.18, pd: 4500 },
      { ate: 720000, aliquota: 0.195, pd: 9900 },
      { ate: 1800000, aliquota: 0.205, pd: 17100 },
      { ate: 3600000, aliquota: 0.23, pd: 62100 },
      { ate: 4800000, aliquota: 0.305, pd: 540000 },
    ],
    composicao: { federal: 0.85, cpp: 0, icms: 0, iss: 0.15, ipi: 0 },
    cppPorFora: true,
  },
};

const LIMITE_SIMPLES = 4800000;

// ---------------------------------------------------------
// 2. FATOR R — define se cai no Anexo III ou no Anexo V
// ---------------------------------------------------------

export function calcularFatorR(folha12, rbt12) {
  if (!rbt12) return { percentual: 0, atingeAnexoIII: false };
  const percentual = folha12 / rbt12;
  return {
    percentual,
    atingeAnexoIII: percentual >= 0.28,
  };
}

// ---------------------------------------------------------
// 3. ALÍQUOTA EFETIVA DO SIMPLES NACIONAL
// ---------------------------------------------------------

export function aliquotaSimples(anexoKey, rbt12) {
  const anexo = ANEXOS[anexoKey];
  if (!anexo) return null;

  const rbt = Math.min(Math.max(rbt12, 0), LIMITE_SIMPLES);
  const faixa =
    anexo.faixas.find((f) => rbt <= f.ate) ||
    anexo.faixas[anexo.faixas.length - 1];

  const efetiva = rbt > 0 ? (rbt * faixa.aliquota - faixa.pd) / rbt : faixa.aliquota;

  return {
    anexo: anexoKey,
    label: anexo.label,
    aliquotaNominal: faixa.aliquota,
    parcelaDeduzir: faixa.pd,
    aliquotaEfetiva: Math.max(efetiva, 0),
    composicao: anexo.composicao,
    cppPorFora: !!anexo.cppPorFora,
    excedeuLimite: rbt12 > LIMITE_SIMPLES,
  };
}

// ---------------------------------------------------------
// 4. CRONOGRAMA SIMPLIFICADO DA TRANSIÇÃO (EC 132/2023)
//    Percentuais aproximados — ajustáveis nas premissas.
// ---------------------------------------------------------

export const CRONOGRAMA_REFORMA = {
  2026: { cbs: 0.009, ibs: 0.001, pctAntigos: 1.00, fase: "Ano-teste — CBS e IBS simbólicos" },
  2027: { cbs: 0.088, ibs: 0.001, pctAntigos: 1.00, fase: "CBS cheia · IBS ainda em teste · PIS/COFINS extintos" },
  2028: { cbs: 0.088, ibs: 0.001, pctAntigos: 1.00, fase: "Transição · IBS segue em teste" },
  2029: { cbs: 0.088, ibs: 0.10, pctAntigos: 0.90, fase: "Início da redução de ICMS/ISS" },
  2030: { cbs: 0.088, ibs: 0.20, pctAntigos: 0.80, fase: "Redução gradual de ICMS/ISS" },
  2031: { cbs: 0.088, ibs: 0.40, pctAntigos: 0.60, fase: "Redução gradual de ICMS/ISS" },
  2032: { cbs: 0.088, ibs: 0.60, pctAntigos: 0.40, fase: "Redução gradual de ICMS/ISS" },
  2033: { cbs: 0.088, ibs: 0.877, pctAntigos: 0.00, fase: "IBS pleno · ICMS/ISS extintos" },
};

export function faseReforma(ano) {
  return (
    CRONOGRAMA_REFORMA[ano] ||
    CRONOGRAMA_REFORMA[2027]
  );
}

// ---------------------------------------------------------
// 5. REGIME 1 — GUIA ÚNICA (Simples tradicional)
// ---------------------------------------------------------

export function calcularGuiaUnica({ receitaMes, aliquota }) {
  const total = receitaMes * aliquota.aliquotaEfetiva;
  const c = aliquota.composicao;

  return {
    regime: "guia-unica",
    total,
    ibsCbs: total * c.federal,
    irpj: 0,
    csll: 0,
    cpp: aliquota.cppPorFora ? 0 : total * c.cpp,
    icms: total * c.icms,
    iss: total * c.iss,
    ipi: total * c.ipi,
    custoExtra: 0,
    creditoClientePJ: 0, // guia única não destaca crédito ao cliente
  };
}

// ---------------------------------------------------------
// 6. REGIME 2 — PAGAR POR FORA (híbrido: Simples + IBS/CBS
//    apurados à parte, para dar crédito integral ao cliente)
// ---------------------------------------------------------

export function calcularPagarPorFora({
  receitaMes,
  aliquota,
  ano,
  pctVendasComCredito,
  vendasAliqZero,
  vendasReducao60,
  vendasIcmsSt,
  servicosIssRetido,
  custoExtraMes,
}) {
  const fase = faseReforma(ano);
  const c = aliquota.composicao;

  // base tributável por fora: exclui o que já não gera IBS/CBS
  const baseIsenta = vendasAliqZero + vendasIcmsSt + servicosIssRetido;
  const baseReduzida = vendasReducao60;
  const baseCheia = Math.max(
    receitaMes - baseIsenta - baseReduzida,
    0
  );

  const aliqCbsIbs = fase.cbs + fase.ibs;

  const ibsCbs =
    baseCheia * aliqCbsIbs +
    baseReduzida * aliqCbsIbs * 0.4; // redução de 60% => paga 40%

  // DAS "por fora" perde a parcela federal (CBS) e a parcela
  // de ICMS/ISS na proporção já substituída pelo IBS (pctAntigos
  // é o que ainda resta como ICMS/ISS "tradicional")
  const dasBase = receitaMes * aliquota.aliquotaEfetiva;
  const dasSemFederal = dasBase * (1 - c.federal);
  const dasAntigosRemanescentes =
    dasSemFederal -
    (dasBase * (c.icms + c.iss)) * (1 - fase.pctAntigos);
  const cpp = aliquota.cppPorFora ? 0 : dasBase * c.cpp;

  const dasFinal = Math.max(dasAntigosRemanescentes, cpp) === cpp && aliquota.cppPorFora
    ? 0
    : dasAntigosRemanescentes;

  const total = ibsCbs + dasFinal + cpp + custoExtraMes;

  const creditoClientePJ = baseCheia * (pctVendasComCredito / 100) * aliqCbsIbs;

  return {
    regime: "pagar-por-fora",
    total,
    ibsCbs,
    irpj: 0,
    csll: 0,
    cpp,
    icms: 0,
    iss: 0,
    ipi: 0,
    custoExtra: custoExtraMes,
    creditoClientePJ,
    fase: fase.fase,
  };
}

// ---------------------------------------------------------
// 7. REGIME 3 — LUCRO PRESUMIDO
// ---------------------------------------------------------

const PRESUNCAO_PADRAO = {
  comercio: { irpj: 0.08, csll: 0.12 },
  industria: { irpj: 0.08, csll: 0.12 },
  servicos: { irpj: 0.32, csll: 0.32 },
};

export function calcularLucroPresumido({
  receitaMes,
  ano,
  perfil = "servicos", // comercio | industria | servicos
  aliqIcmsIss = 0.05,
  pctVendasComCredito,
  folhaMes,
  aliqIrpjAdicional = true,
}) {
  const fase = faseReforma(ano);
  const presuncao = PRESUNCAO_PADRAO[perfil] || PRESUNCAO_PADRAO.servicos;

  const baseIrpj = receitaMes * presuncao.irpj;
  const baseCsll = receitaMes * presuncao.csll;

  let irpj = baseIrpj * 0.15;
  if (aliqIrpjAdicional && baseIrpj > 20000) {
    irpj += (baseIrpj - 20000) * 0.10;
  }
  const csll = baseCsll * 0.09;

  const aliqCbsIbs = fase.cbs + fase.ibs;
  const ibsCbs = receitaMes * aliqCbsIbs;

  const icmsIss = receitaMes * aliqIcmsIss * fase.pctAntigos;

  const inss = folhaMes * 0.20; // CPP patronal padrão (aprox.)

  const total = irpj + csll + ibsCbs + icmsIss + inss;

  const creditoClientePJ = receitaMes * (pctVendasComCredito / 100) * aliqCbsIbs;

  return {
    regime: "lucro-presumido",
    total,
    ibsCbs,
    irpj,
    csll,
    cpp: inss,
    icms: icmsIss,
    iss: 0,
    ipi: 0,
    custoExtra: 0,
    creditoClientePJ,
  };
}

// ---------------------------------------------------------
// 8. COMPARATIVO + RECOMENDAÇÃO ORIENTATIVA
// ---------------------------------------------------------

export function montarComparativo(params) {
  const {
    anexoKey,
    rbt12,
    folha12,
    receitaMes,
    ano,
    pctVendasComCredito,
    vendasAliqZero,
    vendasReducao60,
    vendasIcmsSt,
    servicosIssRetido,
    comprasFornecedoresMes,
    custoExtraMes,
    perfilPresumido,
    aliqIcmsIssPresumido,
  } = params;

  const fatorR = calcularFatorR(folha12, rbt12);
  const anexoEfetivo =
    anexoKey === "V" && fatorR.atingeAnexoIII ? "III" : anexoKey;

  const aliquota = aliquotaSimples(anexoEfetivo, rbt12);

  const guiaUnica = calcularGuiaUnica({ receitaMes, aliquota });

  const porFora = calcularPagarPorFora({
    receitaMes,
    aliquota,
    ano,
    pctVendasComCredito,
    vendasAliqZero,
    vendasReducao60,
    vendasIcmsSt,
    servicosIssRetido,
    custoExtraMes,
  });

  const presumido = calcularLucroPresumido({
    receitaMes,
    ano,
    perfil: perfilPresumido,
    aliqIcmsIss: aliqIcmsIssPresumido,
    pctVendasComCredito,
    folhaMes: folha12 / 12,
  });

  const diferencaPorForaXGuiaUnica = porFora.total - guiaUnica.total;

  const maisBarato = [guiaUnica, porFora, presumido].reduce((a, b) =>
    b.total < a.total ? b : a
  );

  let recomendacao = "";
  if (maisBarato.regime === "guia-unica") {
    recomendacao =
      `Neste cenário, a Guia Única segue mais barata em ${ano}. O custo extra de apurar por fora (R$ ${custoExtraMes.toFixed(0)}) ` +
      `ainda pesa mais do que o ganho de crédito repassado aos clientes PJ.`;
  } else if (maisBarato.regime === "pagar-por-fora") {
    recomendacao =
      `Vale avaliar migrar para o regime híbrido (pagar por fora): o crédito gerado aos clientes PJ (R$ ${porFora.creditoClientePJ.toFixed(0)}/mês) ` +
      `supera o custo extra de apuração, e o total mensal fica menor que a Guia Única.`;
  } else {
    recomendacao =
      `Neste ano, o Lucro Presumido aparece mais caro/competitivo que o Simples — reavalie a cada ano da transição, ` +
      `já que o crédito da Guia Única cresce ao longo da transição e o peso do ICMS/ISS tradicional cai.`;
  }

  return {
    anexoEfetivo,
    fatorR,
    aliquota,
    guiaUnica,
    porFora,
    presumido,
    diferencaPorForaXGuiaUnica,
    maisBarato: maisBarato.regime,
    recomendacao,
    fase: faseReforma(ano),
  };
}
