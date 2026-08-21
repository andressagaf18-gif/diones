// api/lib/diagnostic-engine.js
// Finder — roteador central das operações do diagnóstico.
// Cada estrutura possui contexto, eixos, linguagem, regras e saída própria.

export const ESTRUTURAS = {
  operacional: {
    id: "operacional",
    label: "Empresa operacional",
    tipo: "EMPRESARIAL",
    exigeCnpj: true,
    eixos: [
      "financeiro", "tributario", "contabil_fiscal", "comercial",
      "marketing", "gestao", "rh", "operacional", "tecnologia"
    ],
    proibicoes: [],
    foco: [
      "modelo de negócio", "atividade real", "faturamento", "margem",
      "fluxo de caixa", "tributação", "processos", "vendas",
      "pessoas", "operação", "tecnologia"
    ],
  },

  grupo: {
    id: "grupo",
    label: "Grupo empresarial",
    tipo: "EMPRESARIAL_GRUPO",
    exigeCnpj: true,
    eixos: [
      "estrutura_grupo", "governanca", "financeiro_consolidado",
      "intercompany", "tributario", "contabil_fiscal",
      "pessoas_compartilhadas", "operacoes", "tecnologia"
    ],
    foco: [
      "empresas do grupo", "função de cada CNPJ", "sócios em comum",
      "faturamento individual e consolidado", "mútuos",
      "operações entre partes relacionadas", "CSC", "governança",
      "riscos de grupo econômico", "distribuição de resultados"
    ],
  },

  spe: {
    id: "spe",
    label: "SPE",
    tipo: "SPE",
    exigeCnpj: false,
    eixos: [
      "projeto", "socios_investidores", "aportes", "financeiro",
      "contratos", "tributario", "governanca", "riscos", "encerramento"
    ],
    foco: [
      "finalidade da SPE", "projeto ou empreendimento", "prazo",
      "sócios e investidores", "aportes", "financiamentos",
      "receitas e custos", "contratos", "tributação",
      "governança", "distribuição", "encerramento"
    ],
  },

  holding: {
    id: "holding",
    label: "Holding existente",
    tipo: "PATRIMONIAL",
    exigeCnpj: false,
    eixos: [
      "patrimonio", "participacoes", "imoveis", "receitas_patrimoniais",
      "tributario_patrimonial", "governanca", "sucessao",
      "protecao_patrimonial", "custos_estrutura"
    ],
    foco: [
      "tipo de holding", "patrimônio", "imóveis", "participações",
      "receitas patrimoniais", "sócios", "herdeiros", "sucessão",
      "governança", "tributação", "custos e manutenção da estrutura"
    ],
    proibicoes: [
      "tratar holding como empresa operacional comum",
      "presumir que holding sempre reduz tributos"
    ],
  },

  avaliar_holding: {
    id: "avaliar_holding",
    label: "Avaliação de Holding",
    tipo: "VIABILIDADE_HOLDING",
    exigeCnpj: false,
    eixos: [
      "objetivos", "patrimonio", "imoveis", "participacoes",
      "receitas", "familia_sucessao", "tributario",
      "financiamentos", "custos_viabilidade"
    ],
    foco: [
      "objetivo real da estrutura", "patrimônio atual", "imóveis",
      "participações societárias", "receitas", "herdeiros",
      "sucessão", "financiamentos", "custos", "benefícios e limitações"
    ],
    saidaEspecial: "viabilidadeHolding",
    proibicoes: [
      "afirmar que a holding é recomendada sem dados suficientes",
      "prometer economia tributária",
      "exigir CNPJ da holding que ainda não existe"
    ],
  },

  pessoa_fisica: {
    id: "pessoa_fisica",
    label: "Pessoa Física",
    tipo: "PESSOA_FISICA",
    exigeCnpj: false,
    eixos: [
      "organizacao_financeira", "fluxo_pessoal", "endividamento",
      "reserva_seguranca", "patrimonio", "investimentos",
      "aposentadoria", "protecao_familiar", "tributario_pf",
      "sucessao", "objetivos"
    ],
    foco: [
      "renda", "gastos", "dívidas", "reserva de emergência",
      "patrimônio", "investimentos", "aposentadoria",
      "dependentes", "proteção familiar", "IRPF",
      "sucessão", "objetivos financeiros"
    ],
    proibicoes: [
      "CNAE", "faturamento empresarial", "margem empresarial",
      "estrutura societária", "processo comercial", "marketing empresarial"
    ],
  },
};

export function normalizarEstrutura(valor) {
  const v = String(valor || "").trim().toLowerCase();

  const aliases = {
    empresa: "operacional",
    empresa_operacional: "operacional",
    operacional: "operacional",
    grupo_empresarial: "grupo",
    grupo: "grupo",
    spe: "spe",
    holding: "holding",
    holding_existente: "holding",
    avaliar_holding: "avaliar_holding",
    avaliacao_holding: "avaliar_holding",
    pessoa_fisica: "pessoa_fisica",
    pf: "pessoa_fisica",
  };

  return aliases[v] || "operacional";
}

export function obterMotor(estrutura) {
  return ESTRUTURAS[normalizarEstrutura(estrutura)];
}

export function contratoSaida(
  estrutura,
  eixosPermitidos = null
) {
  const motor =
    obterMotor(estrutura);

  const eixosDoRelatorio =
    Array.isArray(
      eixosPermitidos
    ) &&
    eixosPermitidos.length >
      0
      ? motor.eixos.filter(
          (id) =>
            eixosPermitidos.includes(
              id
            )
        )
      : motor.eixos;

  return {
    estrutura: motor.id,
    estruturaLabel: motor.label,
    scoreGeral: 0,
    nivelGeral: "",
    leituraExecutiva: "",
    objetivosDeclarados: [],
    doresPrincipais: [],
    impactos: [],
    eixos: eixosDoRelatorio.map((id) => ({
      id,
      label: id,
      score: 0,
      nivel: "",
      achados: [],
      riscos: [],
      pontosFortes: [],
      recomendacoes: [],
    })),
    causasProvaveis: [],
    riscosPrioritarios: [],
    pontosFortes: [],
    prioridades: [],
    recomendacoes: [],
    quickWins: [],
    plano90Dias: {
      dias30: [],
      dias60: [],
      dias90: [],
    },
    indicadores: [],
    informacoesFaltantes: [],
    proximosPassos: [],
    viabilidadeHolding:
      motor.id === "avaliar_holding"
        ? {
            nivel: "DADOS_INSUFICIENTES",
            fatoresFavoraveis: [],
            fatoresContrarios: [],
            dadosNecessarios: [],
            estruturasPossiveis: [],
          }
        : null,
    visaoAdministracao: {
      oportunidades: [],
      aprofundamentos: [],
      riscosComerciais: [],
      departamentosSugeridos: [],
    },
  };
}

export function instrucoesDoMotor(
  estrutura,
  eixosPermitidos = null
) {
  const motor =
    obterMotor(estrutura);

  const eixosDoRelatorio =
    Array.isArray(
      eixosPermitidos
    ) &&
    eixosPermitidos.length >
      0
      ? motor.eixos.filter(
          (id) =>
            eixosPermitidos.includes(
              id
            )
        )
      : motor.eixos;

  return `
ESTRUTURA SELECIONADA: ${motor.label}
TIPO DE OPERAÇÃO: ${motor.tipo}

Você DEVE analisar este caso exclusivamente dentro desta estrutura.

EIXOS OBRIGATÓRIOS:
${eixosDoRelatorio.map((x) => `- ${x}`).join("\n")}

FOCO:
${motor.foco.map((x) => `- ${x}`).join("\n")}

${motor.proibicoes?.length ? `NÃO FAÇA:\n${motor.proibicoes.map((x) => `- ${x}`).join("\n")}` : ""}

REGRAS:
- Não invente fatos.
- Diferencie fato informado, inferência e informação faltante.
- Não penalize o participante por campos que não pertencem a esta estrutura.
- O relatório precisa ser completo DENTRO DO ESCOPO selecionado, mesmo quando houver lacunas.
- Não crie eixos/departamentos que não estejam na lista de EIXOS OBRIGATÓRIOS acima.
- Quando faltar informação, registre em "informacoesFaltantes".
- Recomendações devem decorrer das respostas.
- Preserve rastreabilidade entre resposta, achado, risco e recomendação.
- Retorne SOMENTE JSON válido.
`;
}
