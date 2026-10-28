// server/reforma-referencia.js — alíquotas de referência da Reforma Tributária usadas como premissa no sistema.
// Fonte única: simulador, pesquisa tributária e textos dos relatórios importam daqui.
//
// CBS 2027: o TCU aprovou em 28/10/2026 (TC 006.529/2026-7) o cálculo da alíquota de referência: 11,3468%,
// arredondada para 11,3%. O resultado segue ao Senado, que fixa a alíquota por resolução (prazo noticiado: 15/12/2026).
// IBS: continua premissa estimada (Resolução CGIBS nº 14/2026) — a decisão do TCU não trata do IBS.

export const CBS_TCU_2027 = Object.freeze({
  pct: 11.3,
  pctExato: 11.3468,
  aprovadoEm: "2026-10-28",
  processo: "TC 006.529/2026-7",
  prazoSenado: "2026-12-15",
  redutorComprasPublicasPct: 44.16,
});

export const IBS_PREMISSA = Object.freeze({ pct: 18.7, fonte: "Resolução CGIBS nº 14/2026 (estimativa técnica)" });

export const PREMISSA_REFERENCIA = Object.freeze({
  cbsPct: CBS_TCU_2027.pct,
  ibsPct: IBS_PREMISSA.pct,
  totalPct: Math.round((CBS_TCU_2027.pct + IBS_PREMISSA.pct) * 100) / 100,
  situacao: "CBS_CALCULO_TCU_APROVADO_28_10_2026_AGUARDA_RESOLUCAO_SENADO_IBS_ESTIMATIVA_CGIBS",
  fonte: "CBS: cálculo do TCU aprovado em 28/10/2026 (11,3468%, arredondada para 11,3%), pendente de resolução do Senado. IBS: estimativa técnica da Resolução CGIBS nº 14/2026. Premissas para projeção, não alíquotas definitivas.",
});

export const TEXTO_CBS_TCU =
  "TCU aprovou, em 28/10/2026, o cálculo da alíquota de referência da CBS para 2027: 11,3468%, arredondada para 11,3%. O resultado vai ao Senado, que fixa a alíquota por resolução. A alíquota de referência não é a de todos: setores com tratamento diferenciado têm reduções e o Simples Nacional segue regras próprias.";

export const TEXTO_CBS_CURTO = "CBS 11,3% (cálculo do TCU, 28/10/2026), pendente de resolução do Senado";
