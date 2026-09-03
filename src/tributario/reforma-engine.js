// DESTINO REAL: /src/tributario/reforma-engine.js
// Reforma Tributária V2 — motor determinístico de carga completa.
// Arquivo isolado: não altera o motor do Planejamento Tributário.

export const numero = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;

  const s = String(v ?? "").trim();
  if (!s) return 0;

  const n = Number(
    (s.includes(",")
      ? s.replace(/\./g, "").replace(",", ".")
      : s
    ).replace(/[^\d.-]/g, "")
  );

  return Number.isFinite(n) ? n : 0;
};

export const pct = (v) => numero(v) / 100;

export const moeda = (v) =>
  numero(v).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export const ANOS_TRANSICAO = [
  2026,
  2027,
  2028,
  2029,
  2030,
  2031,
  2032,
  2033,
];

export const TRANSICAO = {
  2026: {
    cbsTeste: 0.9,
    ibsTeste: 0.1,
    cbsRegular: 0,
    ibsRegular: 0,
    pisCofins: 1,
    icmsIss: 1,
    ipi: 1,
    fase: "Teste operacional",
  },

  2027: {
    cbsTeste: 0,
    ibsTeste: 0,
    cbsRegular: 1,
    ibsRegular: 1,
    ibsAliquotaFixa: 0.1,
    pisCofins: 0,
    icmsIss: 1,
    ipi: 0,
    fase: "CBS integral e IBS inicial",
  },

  2028: {
    cbsTeste: 0,
    ibsTeste: 0,
    cbsRegular: 1,
    ibsRegular: 1,
    ibsAliquotaFixa: 0.1,
    pisCofins: 0,
    icmsIss: 1,
    ipi: 0,
    fase: "CBS integral e IBS inicial",
  },

  2029: {
    cbsTeste: 0,
    ibsTeste: 0,
    cbsRegular: 1,
    ibsRegular: 0.1,
    pisCofins: 0,
    icmsIss: 0.9,
    ipi: 0,
    fase: "Transição ICMS/ISS 10%",
  },

  2030: {
    cbsTeste: 0,
    ibsTeste: 0,
    cbsRegular: 1,
    ibsRegular: 0.2,
    pisCofins: 0,
    icmsIss: 0.8,
    ipi: 0,
    fase: "Transição ICMS/ISS 20%",
  },

  2031: {
    cbsTeste: 0,
    ibsTeste: 0,
    cbsRegular: 1,
    ibsRegular: 0.3,
    pisCofins: 0,
    icmsIss: 0.7,
    ipi: 0,
    fase: "Transição ICMS/ISS 30%",
  },

  2032: {
    cbsTeste: 0,
    ibsTeste: 0,
    cbsRegular: 1,
    ibsRegular: 0.4,
    pisCofins: 0,
    icmsIss: 0.6,
    ipi: 0,
    fase: "Transição ICMS/ISS 40%",
  },

  2033: {
    cbsTeste: 0,
    ibsTeste: 0,
    cbsRegular: 1,
    ibsRegular: 1,
    pisCofins: 0,
    icmsIss: 0,
    ipi: 0,
    fase: "Modelo pleno",
  },
};

const positivo = (v) => Math.max(0, numero(v));

const soma = (obj, chaves) =>
  chaves.reduce((total, chave) => {
    return total + positivo(obj?.[chave]);
  }, 0);

export function regraTransicao(ano) {
  const anoTratado = Math.min(
    2033,
    Math.max(2026, Math.trunc(numero(ano) || 2026))
  );

  return {
    ano: anoTratado,
    ...TRANSICAO[anoTratado],
  };
}

export function calcularIbsCbs(parametros = {}) {
  const faturamento = positivo(parametros.faturamento);

  const baseTributavel =
    parametros.baseTributavel == null
      ? faturamento
      : positivo(parametros.baseTributavel);

  const aliquotaCBS = Math.max(
    0,
    pct(parametros.aliquotaCBS) *
      (1 - pct(parametros.reducaoCBS))
  );

  const aliquotaIBS = Math.max(
    0,
    pct(parametros.aliquotaIBS) *
      (1 - pct(parametros.reducaoIBS))
  );

  const fatorCBS =
    parametros.fatorCbs == null
      ? 1
      : Math.max(0, numero(parametros.fatorCbs));

  const fatorIBS =
    parametros.fatorIbs == null
      ? 1
      : Math.max(0, numero(parametros.fatorIbs));

  const debitoCBS = baseTributavel * aliquotaCBS * fatorCBS;
  const debitoIBS = baseTributavel * aliquotaIBS * fatorIBS;

  const creditoCBS = Math.min(
    debitoCBS,
    positivo(parametros.creditoCBS) * fatorCBS
  );

  const creditoIBS = Math.min(
    debitoIBS,
    positivo(parametros.creditoIBS) * fatorIBS
  );

  const liquidoCBS = Math.max(0, debitoCBS - creditoCBS);
  const liquidoIBS = Math.max(0, debitoIBS - creditoIBS);

  const total = liquidoCBS + liquidoIBS;

  return {
    faturamento,
    baseTributavel,

    debitoCBS,
    debitoIBS,

    creditoCBS,
    creditoIBS,

    liquidoCBS,
    liquidoIBS,

    total,

    cargaEfetiva:
      faturamento > 0
        ? (total / faturamento) * 100
        : 0,

    aliquotaCBSEfetiva: aliquotaCBS * 100,
    aliquotaIBSEfetiva: aliquotaIBS * 100,

    fatorCbs: fatorCBS,
    fatorIbs: fatorIBS,
  };
}

export function calcularIrpjCsllPresumido(parametros = {}) {
  const receita = positivo(parametros.receita);

  const mesesPeriodo = Math.max(
    1,
    Math.trunc(numero(parametros.mesesPeriodo) || 1)
  );

  const baseIrpj =
    receita * pct(parametros.presuncaoIrpj);

  const baseCsll =
    receita * pct(parametros.presuncaoCsll);

  const irpj = baseIrpj * 0.15;

  const adicionalIrpj =
    Math.max(
      0,
      baseIrpj - 20000 * mesesPeriodo
    ) * 0.1;

  const csll = baseCsll * 0.09;

  return {
    baseIrpj,
    baseCsll,

    irpj,
    adicionalIrpj,
    csll,

    total:
      irpj +
      adicionalIrpj +
      csll,
  };
}

export function calcularIrpjCsllReal(parametros = {}) {
  const mesesPeriodo = Math.max(
    1,
    Math.trunc(numero(parametros.mesesPeriodo) || 1)
  );

  const lucroContabil = numero(
    parametros.lucroAntesIrpjCsll
  );

  const lucroFiscalAntesCompensacao =
    lucroContabil +
    numero(parametros.adicoes) -
    positivo(parametros.exclusoes);

  const prejuizoDisponivel = positivo(
    parametros.prejuizoFiscalCompensavel
  );

  const limiteCompensacao =
    Math.max(0, lucroFiscalAntesCompensacao) * 0.3;

  const compensacao = Math.min(
    prejuizoDisponivel,
    limiteCompensacao
  );

  const baseTributavel = Math.max(
    0,
    lucroFiscalAntesCompensacao - compensacao
  );

  const irpj = baseTributavel * 0.15;

  const adicionalIrpj =
    Math.max(
      0,
      baseTributavel - 20000 * mesesPeriodo
    ) * 0.1;

  const csll = baseTributavel * 0.09;

  return {
    lucroContabil,
    lucroFiscalAntesCompensacao,
    compensacao,
    baseTributavel,

    irpj,
    adicionalIrpj,
    csll,

    total:
      irpj +
      adicionalIrpj +
      csll,

    houvePrejuizo:
      lucroFiscalAntesCompensacao <= 0,
  };
}

export function estimarDasResidualPorFora(parametros = {}) {
  const dasAtual = positivo(parametros.dasAtual);
  const origem = parametros.componentes || {};

  const componentes = {
    pis: positivo(origem.pis),
    cofins: positivo(origem.cofins),
    icms: positivo(origem.icms),
    iss: positivo(origem.iss),
    ipi: positivo(origem.ipi),
    cpp: positivo(origem.cpp),
    irpj: positivo(origem.irpj),
    csll: positivo(origem.csll),
    outros: positivo(origem.outros),
  };

  const parcelasConsumo = soma(componentes, [
    "pis",
    "cofins",
    "icms",
    "iss",
  ]);

  const somaComponentes = Object.values(
    componentes
  ).reduce((total, valor) => total + valor, 0);

  let residual = null;
  let metodo = "PENDENTE";
  let confianca = "BAIXA";

  if (dasAtual > 0 && parcelasConsumo > 0) {
    residual = Math.max(
      0,
      dasAtual - parcelasConsumo
    );

    metodo =
      "DAS_ATUAL_MENOS_PIS_COFINS_ICMS_ISS";

    confianca = "MEDIA";
  } else {
    const parcelasMantidas = soma(componentes, [
      "cpp",
      "irpj",
      "csll",
      "outros",
      "ipi",
    ]);

    if (parcelasMantidas > 0) {
      residual = parcelasMantidas;

      metodo =
        "SOMA_COMPONENTES_RESIDUAIS_DOCUMENTAIS";

      confianca = "MEDIA";
    }
  }

  const diferencaComposicao =
    dasAtual > 0 && somaComponentes > 0
      ? dasAtual - somaComponentes
      : null;

  const composicaoConfere =
    diferencaComposicao == null
      ? false
      : Math.abs(diferencaComposicao) <=
        Math.max(1, dasAtual * 0.01);

  return {
    dasAtual,
    residual,
    parcelasConsumo,

    componentes,
    somaComponentes,

    diferencaComposicao,
    composicaoConfere,

    metodo,
    confianca,

    observacao:
      residual == null
        ? "Não foi possível estimar o DAS residual com os documentos disponíveis."
        : "Proxy gerencial baseado na composição atual do DAS. A partilha oficial do período deve ser validada antes da recomendação.",
  };
}

export function calcularCargaCompleta(parametros = {}) {
  const regime = String(
    parametros.regime || "SIMPLES_NACIONAL"
  ).toUpperCase();

  const faturamento = positivo(
    parametros.faturamento
  );

  const regra = regraTransicao(parametros.ano);

  const atuais = {
    pis: positivo(parametros.tributosAtuais?.pis),
    cofins: positivo(
      parametros.tributosAtuais?.cofins
    ),

    icms: positivo(
      parametros.tributosAtuais?.icms
    ),

    iss: positivo(
      parametros.tributosAtuais?.iss
    ),

    ipi: positivo(
      parametros.tributosAtuais?.ipi
    ),

    cpp: positivo(
      parametros.tributosAtuais?.cpp
    ),

    irpj: positivo(
      parametros.tributosAtuais?.irpj
    ),

    adicionalIrpj: positivo(
      parametros.tributosAtuais?.adicionalIrpj
    ),

    csll: positivo(
      parametros.tributosAtuais?.csll
    ),

    outros: positivo(
      parametros.tributosAtuais?.outros
    ),

    das: positivo(
      parametros.tributosAtuais?.das
    ),
  };

  const tributosForaDas = positivo(
    parametros.tributosForaDas
  );

  const baseIbsCbs =
    parametros.baseTributavel == null
      ? faturamento
      : positivo(parametros.baseTributavel);

  const possuiAliquotasNovas =
    positivo(parametros.aliquotaCBS) +
      positivo(parametros.aliquotaIBS) >
    0;

  const parametrosNovos = {
    faturamento,
    baseTributavel: baseIbsCbs,

    aliquotaCBS: parametros.aliquotaCBS,

    aliquotaIBS:
      regra.ibsAliquotaFixa ??
      parametros.aliquotaIBS,

    reducaoCBS: parametros.reducaoCBS,
    reducaoIBS: parametros.reducaoIBS,

    creditoCBS: parametros.creditoCBS,
    creditoIBS: parametros.creditoIBS,

    fatorCbs: regra.cbsRegular,
    fatorIbs: regra.ibsRegular,
  };

  const ibsCbsRegular =
    calcularIbsCbs(parametrosNovos);

  const teste2026 = calcularIbsCbs({
    faturamento,
    baseTributavel: baseIbsCbs,

    aliquotaCBS: regra.cbsTeste,
    aliquotaIBS: regra.ibsTeste,

    reducaoCBS: parametros.reducaoCBS,
    reducaoIBS: parametros.reducaoIBS,

    creditoCBS: 0,
    creditoIBS: 0,
  });

  const testeExigivel =
    regra.ano === 2026 &&
    !parametros.dispensaTeste2026
      ? teste2026.total
      : 0;

  const pisCofinsLegado =
    (atuais.pis + atuais.cofins) *
    regra.pisCofins;

  const icmsIssLegado =
    (atuais.icms + atuais.iss) *
    regra.icmsIss;

  const fatorIpi =
    parametros.manterIpiApos2027
      ? 1
      : regra.ipi;

  const ipiLegado =
    atuais.ipi * fatorIpi;

  const impostoSeletivo =
    regra.ano >= 2027
      ? positivo(parametros.impostoSeletivo)
      : 0;

  let irpjCsll = {
    irpj: atuais.irpj,
    adicionalIrpj: atuais.adicionalIrpj,
    csll: atuais.csll,

    total:
      atuais.irpj +
      atuais.adicionalIrpj +
      atuais.csll,
  };

  if (regime === "LUCRO_PRESUMIDO") {
    irpjCsll = calcularIrpjCsllPresumido({
      receita: faturamento,
      presuncaoIrpj: parametros.presuncaoIrpj,
      presuncaoCsll: parametros.presuncaoCsll,
      mesesPeriodo: parametros.mesesPeriodo,
    });
  }

  if (regime === "LUCRO_REAL") {
    irpjCsll = calcularIrpjCsllReal({
      lucroAntesIrpjCsll:
        parametros.lucroAntesIrpjCsll,

      adicoes: parametros.adicoes,
      exclusoes: parametros.exclusoes,

      prejuizoFiscalCompensavel:
        parametros.prejuizoFiscalCompensavel,

      mesesPeriodo: parametros.mesesPeriodo,
    });
  }

  const irpjCsllAtualInformado =
    atuais.irpj +
    atuais.adicionalIrpj +
    atuais.csll;

  const irpjCsllAtual =
    irpjCsllAtualInformado > 0
      ? irpjCsllAtualInformado
      : irpjCsll.total;

  const mantidosNaoConsumo =
    irpjCsll.total +
    atuais.cpp +
    atuais.outros +
    tributosForaDas;

  const cargaAtual =
    regime === "SIMPLES_NACIONAL"
      ? atuais.das + tributosForaDas
      : soma(atuais, [
          "pis",
          "cofins",
          "icms",
          "iss",
          "ipi",
          "cpp",
          "outros",
        ]) +
        irpjCsllAtual +
        tributosForaDas;

  let totalProjetado = 0;
  let simples = null;

  if (regime === "SIMPLES_NACIONAL") {
    const residual =
      estimarDasResidualPorFora({
        dasAtual: atuais.das,

        componentes:
          parametros.componentesDas ||
          atuais,
      });

    const dentro =
      atuais.das +
      tributosForaDas +
      impostoSeletivo;

    const foraCalculado =
      residual.residual == null
        ? null
        : residual.residual +
          ibsCbsRegular.total +
          tributosForaDas +
          testeExigivel +
          impostoSeletivo;

    const fora =
      regra.ano === 2026 ||
      !possuiAliquotasNovas
        ? null
        : foraCalculado;

    totalProjetado =
      parametros.ibsCbsForaDoSimples
        ? fora ?? 0
        : dentro;

    simples = {
      dentro,
      fora,

      regular: ibsCbsRegular,

      dasResidualEstimado: residual,

      cargaDentro:
        faturamento > 0
          ? (dentro / faturamento) * 100
          : 0,

      cargaFora:
        faturamento > 0 && fora != null
          ? (fora / faturamento) * 100
          : null,

      diferenca:
        fora == null
          ? null
          : fora - dentro,

      menorCargaMatematica:
        fora == null
          ? "NAO_CALCULAVEL"
          : fora < dentro
            ? "FORA"
            : fora > dentro
              ? "DENTRO"
              : "EMPATE",
    };
  } else {
    totalProjetado =
      pisCofinsLegado +
      icmsIssLegado +
      ipiLegado +
      ibsCbsRegular.total +
      testeExigivel +
      mantidosNaoConsumo +
      impostoSeletivo;
  }

  const comparavel =
    regra.ano !== 2026 &&
    possuiAliquotasNovas &&
    !(
      regime === "SIMPLES_NACIONAL" &&
      parametros.ibsCbsForaDoSimples &&
      simples?.fora == null
    );

  const avisos = [
    ...(regra.ano === 2026
      ? [
          "2026 é fase de teste. IBS/CBS de teste não representam a carga definitiva da Reforma.",
        ]
      : []),

    ...(regra.ano > 2026 &&
    !possuiAliquotasNovas
      ? [
          "Informe as alíquotas cheias validadas de CBS e IBS para tornar o cenário comparável.",
        ]
      : []),

    ...(regime === "SIMPLES_NACIONAL" &&
    regra.ano > 2026
      ? [
          "O DAS no cenário dentro é um proxy baseado no DAS informado; a partilha futura oficial deve ser validada.",
        ]
      : []),

    ...(regime === "SIMPLES_NACIONAL" &&
    simples?.fora == null
      ? [
          "A comparação por fora depende da composição válida do DAS residual.",
        ]
      : []),

    ...(regime === "LUCRO_REAL" &&
    irpjCsll.houvePrejuizo
      ? [
          "Há prejuízo fiscal antes de IRPJ/CSLL: IRPJ, adicional e CSLL foram zerados.",
        ]
      : []),
  ];

  return {
    regime,
    faturamento,

    ano: regra.ano,
    regra,

    cargaAtual,
    totalProjetado,

    diferenca:
      comparavel
        ? totalProjetado - cargaAtual
        : null,

    variacaoPct:
      comparavel && cargaAtual > 0
        ? (totalProjetado / cargaAtual - 1) *
          100
        : null,

    cargaEfetivaAtual:
      faturamento > 0
        ? (cargaAtual / faturamento) * 100
        : 0,

    cargaEfetivaProjetada:
      faturamento > 0
        ? (totalProjetado / faturamento) *
          100
        : 0,

    comparavel,

    ibsCbs: ibsCbsRegular,

    teste2026,
    testeExigivel,

    pisCofinsLegado,
    icmsIssLegado,
    ipiLegado,

    irpjCsll,
    irpjCsllAtual,

    cpp: atuais.cpp,
    outros: atuais.outros,

    tributosForaDas,
    impostoSeletivo,

    fatorIpi,
    mantidosNaoConsumo,

    simples,
    avisos,
  };
}

// Mantido para compatibilidade com o Tributario.jsx atual.
export function compararSimplesDentroFora(parametros = {}) {
  const faturamento = positivo(
    parametros.faturamento
  );

  const dentro = positivo(
    parametros.dasDentro
  );

  const regular = calcularIbsCbs({
    faturamento,
    ...parametros.cenarioRegular,
  });

  const dasSemIbsCbs =
    parametros.dasSemIbsCbs == null ||
    String(parametros.dasSemIbsCbs) === ""
      ? null
      : positivo(parametros.dasSemIbsCbs);

  const fora =
    dasSemIbsCbs == null
      ? null
      : dasSemIbsCbs + regular.total;

  return {
    dentro,
    fora,
    regular,

    cargaDentro:
      faturamento > 0
        ? (dentro / faturamento) * 100
        : 0,

    cargaFora:
      faturamento > 0 && fora != null
        ? (fora / faturamento) * 100
        : null,

    diferenca:
      fora == null
        ? null
        : fora - dentro,

    menorCargaMatematica:
      fora == null
        ? "NAO_CALCULAVEL"
        : fora < dentro
          ? "FORA"
          : fora > dentro
            ? "DENTRO"
            : "EMPATE",
  };
}

export function projetarCrescimento(parametros = {}) {
  const fatorReceita =
    1 + pct(parametros.crescimentoReceita);

  const fatorCreditos =
    1 + pct(parametros.crescimentoCreditos);

  const atual = calcularIbsCbs({
    faturamento:
      parametros.faturamentoAtual,

    creditoCBS:
      parametros.creditoCBSAtual,

    creditoIBS:
      parametros.creditoIBSAtual,

    ...parametros.parametros,
  });

  const projetado = calcularIbsCbs({
    faturamento:
      numero(parametros.faturamentoAtual) *
      fatorReceita,

    creditoCBS:
      numero(parametros.creditoCBSAtual) *
      fatorCreditos,

    creditoIBS:
      numero(parametros.creditoIBSAtual) *
      fatorCreditos,

    ...parametros.parametros,
  });

  return {
    atual,
    projetado,

    faturamentoProjetado:
      numero(parametros.faturamentoAtual) *
      fatorReceita,

    aumentoImposto:
      projetado.total - atual.total,

    aumentoImpostoPct:
      atual.total > 0
        ? (projetado.total / atual.total - 1) *
          100
        : null,
  };
}

export function simularPreco(parametros = {}) {
  const precoAtual = positivo(
    parametros.precoAtual
  );

  const custoSemTributo = positivo(
    parametros.custoSemTributo
  );

  const tributoAtual = positivo(
    parametros.tributoAtual
  );

  const tributoNovo = positivo(
    parametros.tributoNovo
  );

  const margemAtual =
    precoAtual > 0
      ? (
          (
            precoAtual -
            custoSemTributo -
            tributoAtual
          ) /
          precoAtual
        ) * 100
      : 0;

  const margemMantendoPreco =
    precoAtual > 0
      ? (
          (
            precoAtual -
            custoSemTributo -
            tributoNovo
          ) /
          precoAtual
        ) * 100
      : 0;

  const margemAlvoPct =
    parametros.margemAlvoPct == null
      ? margemAtual
      : numero(parametros.margemAlvoPct);

  const denominador =
    1 - pct(margemAlvoPct);

  return {
    margemAtual,
    margemMantendoPreco,
    margemAlvoPct,

    precoParaMargem:
      denominador > 0
        ? (
            custoSemTributo +
            tributoNovo
          ) / denominador
        : null,
  };
}
