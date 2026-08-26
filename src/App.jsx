import React, { useState, useEffect, useRef } from "react";
import {
  QrCode, Loader2, ArrowRight, ArrowLeft, CheckCircle2, Download,
  CalendarCheck, RotateCcw, Megaphone, Scale, Calculator, Wallet,
  ClipboardList, Target, Settings2, Building2, Sparkles, Users, TrendingUp,
  AlertTriangle, Percent, Cpu, Flame, X, Plus, User,
} from "lucide-react";

const NAVY = "#17233D";
const ICE = "#E9EDF5";
const CORAL = "#FF6B4A";
const MUTED = "#5B667A";
const WHITE = "#FFFFFF";
const DISPLAY_FONT = "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif";
const BODY_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const MAX_DORES = 3;

const finderIaInflight =
  new Map();

function finderCacheKey(
  prefixo,
  payload
) {
  const bruto =
    JSON.stringify(
      payload
    );

  let hash =
    2166136261;

  for (
    let i = 0;
    i < bruto.length;
    i += 1
  ) {
    hash ^=
      bruto.charCodeAt(i);

    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }

  return `${prefixo}_${(
    hash >>> 0
  ).toString(16)}`;
}

function lerCacheIa(
  chave,
  ttlMs
) {
  try {
    const bruto =
      sessionStorage.getItem(
        chave
      );

    if (!bruto) {
      return null;
    }

    const item =
      JSON.parse(
        bruto
      );

    if (
      !item?.ts ||
      Date.now() -
        item.ts >
        ttlMs
    ) {
      sessionStorage.removeItem(
        chave
      );
      return null;
    }

    return item.data ||
      null;
  } catch {
    return null;
  }
}

function salvarCacheIa(
  chave,
  data
) {
  try {
    sessionStorage.setItem(
      chave,
      JSON.stringify({
        ts:
          Date.now(),
        data,
      })
    );
  } catch {
    // cache não pode bloquear o fluxo
  }
}

async function fetchJsonDedupe({
  chave,
  url,
  payload,
  ttlMs,
}) {
  const cache =
    lerCacheIa(
      chave,
      ttlMs
    );

  if (cache) {
    return cache;
  }

  if (
    finderIaInflight.has(
      chave
    )
  ) {
    return finderIaInflight.get(
      chave
    );
  }

  const requisicao =
    fetch(url, {
      method:
        "POST",
      headers: {
        "content-type":
          "application/json",
      },
      body:
        JSON.stringify(
          payload
        ),
    })
      .then(
        async (
          resposta
        ) => {
          const data =
            await resposta
              .json()
              .catch(
                () => null
              );

          if (
            !resposta.ok
          ) {
            throw new Error(
              data?.error ||
              "Falha na inteligência artificial."
            );
          }

          salvarCacheIa(
            chave,
            data
          );

          return data;
        }
      )
      .finally(
        () => {
          finderIaInflight.delete(
            chave
          );
        }
      );

  finderIaInflight.set(
    chave,
    requisicao
  );

  return requisicao;
}

const MAX_EMPRESAS = 4;

const AREAS = [
  { id: "marketing", label: "Marketing", Icon: Megaphone },
  { id: "juridico", label: "Jurídico", Icon: Scale },
  { id: "contabil_fiscal", label: "Contábil / Fiscal", Icon: Calculator },
  { id: "tributario", label: "Tributário", Icon: Calculator },
  { id: "financeiro", label: "Financeiro PF/PJ", Icon: Wallet },
  { id: "administrativo", label: "Administrativo", Icon: ClipboardList },
  { id: "gestao", label: "Gestão", Icon: Target },
  { id: "operacional", label: "Operacional", Icon: Settings2 },
  { id: "rh", label: "Recursos Humanos", Icon: Users },
  { id: "comercial", label: "Comercial / Vendas", Icon: TrendingUp },
  { id: "tecnologia", label: "Tecnologia", Icon: Cpu },
];

const COMPANIES = [
  { segmento: "Serviço", razao: "Alfa Consultoria e Serviços Ltda", cnae: "70.20-4-00 — Consultoria em gestão empresarial", porte: "Microempresa" },
  { segmento: "Comércio", razao: "Boa Vista Comércio Varejista Ltda", cnae: "47.81-4-00 — Comércio varejista de vestuário", porte: "Empresa de pequeno porte" },
  { segmento: "Indústria", razao: "Metaltech Indústria e Fundição Ltda", cnae: "24.51-2-00 — Fundição de ferro e aço", porte: "Médio porte" },
  { segmento: "Serviço", razao: "Nexo Tecnologia e Sistemas Ltda", cnae: "62.01-5-01 — Desenvolvimento de software", porte: "Microempresa" },
  { segmento: "Comércio", razao: "Sabor e Cia Distribuidora de Alimentos", cnae: "46.37-1-01 — Comércio atacadista de alimentos", porte: "Empresa de pequeno porte" },
  { segmento: "Indústria", razao: "Fort Metalúrgica e Estruturas Ltda", cnae: "25.11-0-00 — Fabricação de estruturas metálicas", porte: "Médio porte" },
];

const FATURAMENTOS = [
  { id: "f1", label: "Até R$ 30 mil/mês", anual: 216000 },
  { id: "f2", label: "R$ 30 mil a R$ 100 mil/mês", anual: 780000 },
  { id: "f3", label: "R$ 100 mil a R$ 400 mil/mês", anual: 3000000 },
  { id: "f4", label: "R$ 400 mil a R$ 1,5 mi/mês", anual: 11400000 },
  { id: "f5", label: "Acima de R$ 1,5 mi/mês", anual: 24000000 },
];
const COLABORADORES = ["Até 5", "6 a 20", "21 a 50", "51 a 200", "Mais de 200"];
const REGIMES = ["Simples Nacional", "Lucro Presumido", "Lucro Real", "Não sei"];

// =========================================================
// TRILHA ESPECIALIZADA — HOLDING
// =========================================================
const ESTRUTURAS_NEGOCIO = [
  { id: "operacional", label: "Empresa operacional" },
  { id: "holding", label: "Holding" },
  { id: "grupo", label: "Grupo empresarial" },
  { id: "spe", label: "SPE" },
  { id: "avaliar_holding", label: "Quero avaliar se uma holding faz sentido" },
  { id: "pessoa_fisica", label: "Pessoa Física / Consultoria pessoal" },
];

const TIPOS_HOLDING = [
  {
    id: "patrimonial",
    label: "Patrimonial / Imobiliária",
    descricao: "Organização e administração de imóveis, participações e outros ativos patrimoniais.",
  },
  {
    id: "familiar",
    label: "Familiar / Sucessória",
    descricao: "Estrutura voltada à organização familiar, sucessão, governança e continuidade patrimonial.",
  },
  {
    id: "participacoes",
    label: "Participações societárias",
    descricao: "Concentração de quotas ou ações de outras empresas e organização das participações.",
  },
  {
    id: "controle",
    label: "Controle empresarial",
    descricao: "Estrutura para centralizar controle, governança e decisões sobre empresas do grupo.",
  },
  {
    id: "pura",
    label: "Holding pura",
    descricao: "Sociedade cuja atividade predominante é participar de outras sociedades.",
  },
  {
    id: "mista",
    label: "Holding mista",
    descricao: "Além de participações societárias, também exerce outras atividades econômicas.",
  },
  {
    id: "nao_sei",
    label: "Não sei / quero avaliação",
    descricao: "A Finder avalia finalidade, patrimônio, receitas, sucessão e estrutura antes de recomendar um modelo.",
  },
];

const OBJETIVOS_HOLDING = [
  "Organizar patrimônio",
  "Planejar sucessão familiar",
  "Centralizar participações societárias",
  "Administrar imóveis e receitas de locação",
  "Melhorar governança do grupo",
  "Avaliar eficiência tributária",
  "Preparar compra, venda ou integralização de bens",
  "Ainda não sei — quero uma avaliação",
];

const OBJETIVOS_PF = [
  { id: "financeiro", label: "Organização financeira" },
  { id: "aposentadoria", label: "Planejamento de aposentadoria" },
  { id: "investimentos", label: "Investimentos" },
  { id: "dividas", label: "Dívidas e reorganização financeira" },
  { id: "patrimonio", label: "Organização patrimonial" },
  { id: "renda", label: "Aumentar capacidade de poupança" },
  { id: "protecao", label: "Proteção financeira" },
  { id: "nao_sei", label: "Não sei por onde começar" },
];

const DORES_PF = [
  "Não consigo organizar minhas finanças",
  "Gasto mais do que gostaria",
  "Não consigo formar reserva de emergência",
  "Tenho dívidas ou parcelas pesando no orçamento",
  "Não sei quanto preciso guardar para aposentadoria",
  "Não sei se meus investimentos estão adequados",
  "Tenho dinheiro parado ou mal distribuído",
  "Tenho medo de investir errado",
  "Não sei quanto posso investir por mês",
  "Quero organizar meu patrimônio",
  "Tenho dependentes e quero melhorar minha proteção financeira",
  "Minha renda varia muito ao longo do mês",
  "Não sei qual deve ser minha prioridade agora",
  "Outro",
];

const AREAS_PF = [
  { id: "organizacao_financeira", label: "Organização financeira", Icon: Wallet },
  { id: "fluxo_pessoal", label: "Fluxo financeiro pessoal", Icon: TrendingUp },
  { id: "endividamento", label: "Endividamento", Icon: AlertTriangle },
  { id: "reserva_seguranca", label: "Reserva e segurança", Icon: Target },
  { id: "patrimonio", label: "Patrimônio", Icon: Building2 },
  { id: "investimentos", label: "Investimentos", Icon: TrendingUp },
  { id: "aposentadoria", label: "Aposentadoria", Icon: CalendarCheck },
  { id: "protecao_familiar", label: "Proteção familiar", Icon: Scale },
  { id: "tributario_pf", label: "Tributário PF", Icon: Calculator },
  { id: "sucessao", label: "Sucessão", Icon: Users },
  { id: "objetivos", label: "Objetivos financeiros", Icon: ClipboardList },
];

const AREAS_AVALIAR_HOLDING = [
  { id: "objetivos", label: "Objetivos da estrutura", Icon: Target },
  { id: "patrimonio", label: "Patrimônio", Icon: Building2 },
  { id: "imoveis", label: "Imóveis", Icon: Building2 },
  { id: "participacoes", label: "Participações societárias", Icon: Users },
  { id: "receitas", label: "Receitas patrimoniais", Icon: Wallet },
  { id: "familia_sucessao", label: "Família e sucessão", Icon: Users },
  { id: "tributario", label: "Tributário patrimonial", Icon: Calculator },
  { id: "financiamentos", label: "Financiamentos e obrigações", Icon: Wallet },
  { id: "custos_viabilidade", label: "Custos e viabilidade", Icon: Percent },
];

const AREAS_GRUPO = [
  { id: "estrutura_grupo", label: "Estrutura do grupo", Icon: Building2 },
  { id: "governanca", label: "Governança", Icon: Target },
  { id: "financeiro_consolidado", label: "Financeiro consolidado", Icon: Wallet },
  { id: "intercompany", label: "Operações intercompany", Icon: Settings2 },
  { id: "tributario", label: "Tributário", Icon: Calculator },
  { id: "contabil_fiscal", label: "Contábil / Fiscal", Icon: ClipboardList },
  { id: "pessoas_compartilhadas", label: "Pessoas compartilhadas", Icon: Users },
  { id: "operacoes", label: "Operações do grupo", Icon: Settings2 },
  { id: "tecnologia", label: "Tecnologia e dados", Icon: Cpu },
];

const AREAS_SPE = [
  { id: "projeto", label: "Projeto / empreendimento", Icon: Target },
  { id: "socios_investidores", label: "Sócios e investidores", Icon: Users },
  { id: "aportes", label: "Aportes e capital", Icon: Wallet },
  { id: "financeiro", label: "Financeiro", Icon: Wallet },
  { id: "contratos", label: "Contratos", Icon: Scale },
  { id: "tributario", label: "Tributário", Icon: Calculator },
  { id: "governanca", label: "Governança", Icon: ClipboardList },
  { id: "riscos", label: "Riscos do projeto", Icon: AlertTriangle },
  { id: "encerramento", label: "Saída / encerramento", Icon: CalendarCheck },
];

// Estimativa simplificada de carga tributária — referência, não é cálculo fiscal real.
const SIMPLES_FAIXAS = [180000, 360000, 720000, 1800000, 3600000, 4800000];
const SIMPLES_ALIQUOTAS = {
  "Comércio": [4.0, 7.3, 9.5, 10.7, 14.3, 19.0],
  "Indústria": [4.5, 7.8, 10.0, 11.2, 14.7, 19.5],
  "Serviço": [6.0, 11.2, 13.5, 16.0, 21.0, 33.0],
};
const PRESUMIDO_ALIQUOTAS = { "Comércio": 11, "Indústria": 11, "Serviço": 16 };
const REAL_ALIQUOTAS = { "Comércio": 20, "Indústria": 20, "Serviço": 24 };

function estimarAliquota(regime, segmento, anual) {
  const segmentoNormalizado = normalizarSegmentoTributario(segmento);

  if (regime === "Simples Nacional") {
    const aliquotas = SIMPLES_ALIQUOTAS[segmentoNormalizado];
    if (!aliquotas) return null;

    const faixaIdx = SIMPLES_FAIXAS.findIndex((teto) => anual <= teto);
    const idx = faixaIdx === -1 ? aliquotas.length - 1 : faixaIdx;
    return aliquotas[idx];
  }

  if (regime === "Lucro Presumido") {
    return PRESUMIDO_ALIQUOTAS[segmentoNormalizado] ?? null;
  }

  if (regime === "Lucro Real") {
    return REAL_ALIQUOTAS[segmentoNormalizado] ?? null;
  }

  return null;
}


// =========================================================
// INTELIGÊNCIA TRIBUTÁRIA
// =========================================================
//
// IMPORTANTE:
// - a carga abaixo é uma ESTIMATIVA GERENCIAL;
// - não substitui apuração fiscal;
// - o faturamento usado é o valor de referência da faixa
//   escolhida no formulário;
// - o impacto da Reforma Tributária é preliminar e deve ser
//   validado com os dados reais da empresa.
// =========================================================

function moedaTributaria(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return "-";
  }

  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function percentualTributario(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return "-";
  }

  return `${numero.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function obterImpactoReformaTributaria({
  regime,
  segmento,
  categoria,
}) {
  const segmentoTributario =
    normalizarSegmentoTributario(segmento);

  const resultado = {
    status: "A avaliar",
    tratamentoSetorial:
      "Aplicação preliminar da regra geral do IBS/CBS. O enquadramento definitivo depende da atividade efetivamente exercida e da classificação tributária das operações.",

    fase2026:
      regime === "Simples Nacional"
        ? "Para optantes do Simples Nacional, 2026 permanece como período sem alteração material do recolhimento de IBS/CBS; os efeitos operacionais e de opção ganham relevância a partir de 2027."
        : "Em 2026, a fase de teste utiliza 0,9% de CBS e 0,1% de IBS para contribuintes do regime regular, observadas as regras de compensação, dispensa e obrigações acessórias.",

    fatoresFavoraveis: [],
    fatoresAtencao: [],
    pontosValidar: [
      "Confirmar a atividade efetivamente exercida e o enquadramento legal de cada receita.",
      "Validar o regime tributário atual e o perfil B2B/B2C da carteira.",
      "Mapear compras, despesas e investimentos potencialmente geradores de créditos.",
      "Simular preço, margem e fluxo de caixa antes de concluir aumento ou redução de carga.",
    ],

    oportunidadeFinder:
      "Realizar simulação tributária individualizada comparando a carga atual com cenários da Reforma Tributária.",
  };

  if (categoria === "Contabilidade") {
    resultado.status =
      "Moderado · requer simulação";

    resultado.tratamentoSetorial =
      "Serviços de contabilistas podem se enquadrar na redução de 30% das alíquotas de IBS e CBS prevista para determinadas profissões regulamentadas, desde que atendidos os requisitos legais. A redução incide sobre IBS/CBS, e não sobre a carga tributária total da empresa.";

    resultado.fatoresFavoraveis.push(
      "Possibilidade de tratamento diferenciado com redução das alíquotas de IBS/CBS, sujeito ao enquadramento legal."
    );

    resultado.fatoresAtencao.push(
      "Escritórios contábeis tendem a possuir estrutura relevante de folha, que não gera crédito como uma aquisição comum de bens e serviços."
    );

    resultado.fatoresAtencao.push(
      "A composição B2B da carteira pode alterar a percepção comercial do novo imposto, pois clientes contribuintes podem valorizar a geração de créditos."
    );
  } else if (categoria === "Advocacia") {
    resultado.status =
      "Moderado · requer simulação";

    resultado.tratamentoSetorial =
      "Serviços de advocacia podem se enquadrar na redução de 30% das alíquotas de IBS e CBS prevista para determinadas profissões regulamentadas, observados os requisitos legais.";

    resultado.fatoresFavoraveis.push(
      "Possibilidade de redução setorial das alíquotas de IBS/CBS, quando atendidas as condições legais."
    );

    resultado.fatoresAtencao.push(
      "A estrutura intensiva em mão de obra pode limitar o volume de créditos aproveitáveis."
    );
  } else if (categoria === "Saúde / Clínica") {
    resultado.status =
      "Relevante · validar enquadramento";

    resultado.tratamentoSetorial =
      "Diversos serviços de saúde possuem tratamento diferenciado com redução de 60% das alíquotas de IBS e CBS, mas é necessário confirmar se os serviços efetivamente prestados estão na lista legal aplicável.";

    resultado.fatoresFavoraveis.push(
      "Possibilidade de redução setorial relevante das alíquotas de IBS/CBS para serviços de saúde enquadrados."
    );

    resultado.fatoresAtencao.push(
      "A classificação do serviço e a composição das receitas devem ser validadas antes de aplicar qualquer redução."
    );
  } else if (
    categoria === "Imobiliária / Atividades Imobiliárias"
  ) {
    resultado.status =
      "Alto · exige análise específica";

    resultado.tratamentoSetorial =
      "Operações imobiliárias possuem regras específicas na Reforma Tributária. Locação, venda, intermediação e administração não devem ser tratadas como uma única operação para fins de projeção.";

    resultado.fatoresAtencao.push(
      "Separar receitas de locação, venda, administração, intermediação e demais serviços antes da simulação."
    );
  } else if (segmentoTributario === "Indústria") {
    resultado.status =
      "Moderado · depende dos créditos";

    resultado.tratamentoSetorial =
      "Na indústria, o efeito líquido tende a depender fortemente do volume de insumos, serviços, energia, ativos e demais aquisições que gerem créditos de IBS/CBS.";

    resultado.fatoresFavoraveis.push(
      "Maior potencial de créditos sobre aquisições vinculadas à atividade empresarial, conforme as regras aplicáveis."
    );

    resultado.fatoresAtencao.push(
      "Preço, estoque, compras, benefícios atuais e cadeia de fornecedores precisam ser simulados em conjunto."
    );
  } else if (segmentoTributario === "Comércio") {
    resultado.status =
      "Moderado · depende da cadeia";

    resultado.tratamentoSetorial =
      "No comércio, a análise deve considerar créditos sobre aquisições, composição de estoque, perfil dos fornecedores, margem e destino das vendas.";

    resultado.fatoresFavoraveis.push(
      "Aquisições de mercadorias podem gerar créditos relevantes quando atendidos os requisitos do novo sistema."
    );

    resultado.fatoresAtencao.push(
      "Empresas com venda predominante ao consumidor final podem ter maior sensibilidade de preço do que operações B2B."
    );
  } else {
    resultado.status =
      "Moderado · requer simulação";

    resultado.tratamentoSetorial =
      "Empresas de serviços precisam avaliar especialmente a relação entre receita, folha, despesas creditáveis, perfil B2B/B2C e eventual tratamento diferenciado previsto para a atividade.";

    resultado.fatoresAtencao.push(
      "Negócios intensivos em mão de obra podem apresentar menor proporção de despesas geradoras de créditos."
    );

    resultado.fatoresFavoraveis.push(
      "Em operações B2B, a geração de créditos ao cliente pode alterar a análise de preço e competitividade."
    );
  }

  if (regime === "Simples Nacional") {
    resultado.pontosValidar.unshift(
      "Simular a permanência do IBS/CBS dentro do Simples versus eventual recolhimento pelas regras do regime regular quando a legislação permitir a opção."
    );
  }

  return resultado;
}

function montarInteligenciaTributaria({
  regime,
  segmento,
  categoria,
  faturamento,
}) {
  const anualReferencia =
    Number(faturamento?.anual);

  const aliquotaEstimada =
    regime &&
    regime !== "Não sei" &&
    Number.isFinite(anualReferencia)
      ? estimarAliquota(
          regime,
          segmento,
          anualReferencia
        )
      : null;

  const mensalReferencia =
    Number.isFinite(anualReferencia)
      ? anualReferencia / 12
      : null;

  const tributosAnuaisEstimados =
    aliquotaEstimada !== null &&
    Number.isFinite(anualReferencia)
      ? anualReferencia *
        (aliquotaEstimada / 100)
      : null;

  const tributosMensaisEstimados =
    tributosAnuaisEstimados !== null
      ? tributosAnuaisEstimados / 12
      : null;

  return {
    disponivel:
      aliquotaEstimada !== null &&
      Number.isFinite(mensalReferencia),

    faturamentoFaixa:
      faturamento?.label || "",

    faturamentoMensalReferencia:
      mensalReferencia,

    faturamentoAnualReferencia:
      Number.isFinite(anualReferencia)
        ? anualReferencia
        : null,

    tributosMensaisEstimados,
    tributosAnuaisEstimados,

    cargaTributariaEstimada:
      aliquotaEstimada,

    regime:
      regime || "",

    segmento:
      segmento || "",

    categoria:
      categoria || "",

    criterio:
      "Estimativa gerencial baseada na faixa de faturamento informada, no regime tributário e no segmento. Não representa apuração fiscal efetiva.",

    confiabilidade:
      "Referencial",

    reforma:
      obterImpactoReformaTributaria({
        regime,
        segmento,
        categoria,
      }),
  };
}

// Modelo de maturidade: Sim = 5, Parcialmente = 3, Não = 0 (invertido para perguntas de risco).
function pesoResposta(q, r) {
  if (!r) return 0;
  if (q.invert) { if (r === "sim") return 0; if (r === "nao") return 5; return 3; }
  if (r === "sim") return 5; if (r === "nao") return 0; return 3;
}
function tierDe(score) {
  if (score >= 95) return { label: "Excelente", color: "#0F6E56", bg: "#E1F5EE" };
  if (score >= 80) return { label: "Muito bom", color: "#185FA5", bg: "#E6F1FB" };
  if (score >= 60) return { label: "Atenção", color: "#854F0B", bg: "#FAEEDA" };
  if (score >= 40) return { label: "Crítico", color: "#993C1D", bg: "#FAECE7" };
  return { label: "Emergencial", color: "#791F1F", bg: "#FCEBEB" };
}
// Contexto por categoria: adapta o checklist ao CNAE identificado.
const CATEGORY_CONTEXT = {
  "Contabilidade": {
    cliente: "cliente da carteira contábil",
    oferta: "abertura, troca de contabilidade, BPO e consultoria",
    operacao: "entregas contábeis, fiscais e trabalhistas",
    unidadeRentabilidade: "cliente, carteira ou responsável",
    capacidade: "capacidade da equipe por carteira e período",
    documentoFiscal: "NFS-e e documentos fiscais dos clientes",
  },
  "Advocacia": {
    cliente: "cliente ou processo",
    oferta: "consultas, contratos e serviços jurídicos",
    operacao: "prazos, processos e entregas jurídicas",
    unidadeRentabilidade: "cliente, processo ou área jurídica",
    capacidade: "capacidade da equipe por processo e prazo",
    documentoFiscal: "notas de serviço e retenções aplicáveis",
  },
  "Saúde / Clínica": {
    cliente: "paciente",
    oferta: "consultas, procedimentos e tratamentos",
    operacao: "agenda, atendimento e execução dos procedimentos",
    unidadeRentabilidade: "procedimento, profissional ou unidade",
    capacidade: "ocupação da agenda e capacidade dos profissionais",
    documentoFiscal: "notas de serviço e retenções aplicáveis à clínica",
  },
  "Tecnologia": {
    cliente: "cliente ou conta",
    oferta: "projetos, licenças, SaaS e serviços de tecnologia",
    operacao: "desenvolvimento, suporte e entrega de projetos",
    unidadeRentabilidade: "projeto, contrato ou cliente",
    capacidade: "capacidade do time por sprint, projeto ou contrato",
    documentoFiscal: "notas de serviço e tributação das receitas de tecnologia",
  },
  "Construção Civil": {
    cliente: "cliente, obra ou contrato",
    oferta: "obras, reformas e serviços de construção",
    operacao: "obras, medições, compras e execução em campo",
    unidadeRentabilidade: "obra, contrato ou centro de custo",
    capacidade: "capacidade de execução por equipe e obra",
    documentoFiscal: "notas, retenções e documentos vinculados às obras",
  },
  "Comércio": {
    cliente: "cliente",
    oferta: "produtos e linhas comercializadas",
    operacao: "compra, estoque, venda e entrega",
    unidadeRentabilidade: "produto, categoria, loja ou canal",
    capacidade: "giro e capacidade de reposição de estoque",
    documentoFiscal: "NF-e/NFC-e, NCM, CST e tributação das mercadorias",
  },
  "E-commerce": {
    cliente: "cliente do e-commerce",
    oferta: "produtos, kits e campanhas online",
    operacao: "pedido, pagamento, separação, expedição e pós-venda",
    unidadeRentabilidade: "SKU, campanha, canal ou pedido",
    capacidade: "capacidade de separação, expedição e reposição",
    documentoFiscal: "NF-e, NCM, CST e tributação das vendas online",
  },
  "Indústria": {
    cliente: "cliente industrial",
    oferta: "produtos, projetos e linhas fabricadas",
    operacao: "PCP, produção, qualidade, estoque e expedição",
    unidadeRentabilidade: "produto, ordem de produção ou centro de custo",
    capacidade: "capacidade produtiva por máquina, linha ou turno",
    documentoFiscal: "NF-e, NCM, CST, créditos e tributação industrial",
  },
  "Transporte / Logística": {
    cliente: "embarcador ou cliente",
    oferta: "fretes, rotas e serviços logísticos",
    operacao: "roteirização, coleta, transporte e entrega",
    unidadeRentabilidade: "rota, veículo, contrato ou cliente",
    capacidade: "capacidade da frota e ocupação por rota",
    documentoFiscal: "CT-e, MDF-e e tributação dos serviços de transporte",
  },
  "Alimentação": {
    cliente: "cliente",
    oferta: "pratos, produtos e canais de venda",
    operacao: "compras, estoque, produção, atendimento e entrega",
    unidadeRentabilidade: "produto, prato, canal ou unidade",
    capacidade: "capacidade de produção e atendimento",
    documentoFiscal: "documentos fiscais e tributação das vendas de alimentação",
  },
  "Imobiliária / Atividades Imobiliárias": {
    cliente: "proprietário, comprador ou locatário",
    oferta: "locação, venda e administração de imóveis",
    operacao: "captação, atendimento, contratos e gestão dos imóveis",
    unidadeRentabilidade: "imóvel, contrato ou carteira",
    capacidade: "capacidade de atendimento e gestão da carteira",
    documentoFiscal: "notas de serviço e tributação das receitas imobiliárias",
  },
  "Serviços Profissionais": {
    cliente: "cliente",
    oferta: "serviços e projetos profissionais",
    operacao: "prospecção, execução e entrega dos serviços",
    unidadeRentabilidade: "cliente, projeto ou profissional",
    capacidade: "capacidade da equipe por cliente e projeto",
    documentoFiscal: "notas de serviço e tributação das receitas",
  },
};

const CATEGORY_AREA_FALLBACK = {
  "Contabilidade": ["administrativo", "comercial", "financeiro", "tecnologia", "rh"],
  "Advocacia": ["comercial", "administrativo", "financeiro", "juridico", "tecnologia"],
  "Saúde / Clínica": ["financeiro", "comercial", "administrativo", "marketing", "tecnologia"],
  "Tecnologia": ["comercial", "financeiro", "marketing", "tecnologia", "gestao"],
  "Construção Civil": ["financeiro", "operacional", "administrativo", "juridico", "gestao"],
  "Comércio": ["financeiro", "operacional", "comercial", "marketing", "contabilidade"],
  "E-commerce": ["marketing", "comercial", "financeiro", "operacional", "tecnologia"],
  "Indústria": ["operacional", "financeiro", "administrativo", "gestao", "contabilidade"],
  "Transporte / Logística": ["operacional", "financeiro", "administrativo", "gestao", "tecnologia"],
  "Alimentação": ["operacional", "financeiro", "marketing", "rh", "administrativo"],
  "Imobiliária / Atividades Imobiliárias": ["comercial", "financeiro", "marketing", "juridico", "administrativo"],
  "Serviços Profissionais": ["comercial", "financeiro", "marketing", "administrativo", "gestao"],
};

function categoriaContexto(categoria) {
  return CATEGORY_CONTEXT[categoria] || CATEGORY_CONTEXT["Serviços Profissionais"];
}

function textoCategoria(q, categoria) {
  const c = categoriaContexto(categoria);
  const templates = {
    m1: `Você conhece o custo de aquisição de cada ${c.cliente}?`,
    m2: `Existe um funil mapeado para ${c.oferta}, do primeiro contato ao fechamento?`,
    m3: `Você mede o retorno das campanhas usadas para vender ${c.oferta}?`,
    m7: `Sua base de ${c.cliente} está segmentada para relacionamento, recompra ou novas ofertas?`,
    m8: `Existe um pós-venda estruturado após a entrega de ${c.oferta}?`,
    c4: `A emissão e o tratamento de ${c.documentoFiscal} passam por revisão periódica?`,
    c5: `A empresa revisa créditos, benefícios e oportunidades tributárias relacionados a ${c.documentoFiscal}?`,
    f3a: `Você sabe quanto precisa faturar com ${c.oferta} para cobrir os custos mensais?`,
    f7a: `A margem e o resultado são acompanhados por ${c.unidadeRentabilidade}?`,
    f9a: `A empresa conhece o custo e a rentabilidade por ${c.unidadeRentabilidade}?`,
    a1: `Existem procedimentos escritos para as rotinas críticas de ${c.operacao}?`,
    a5: `As responsabilidades sobre ${c.operacao} estão claramente definidas entre os responsáveis?`,
    a7: `A empresa usa sistema estruturado para controlar ${c.operacao}?`,
    g3: `Os principais indicadores de ${c.operacao} são acompanhados com regularidade?`,
    g5: `As decisões sobre ${c.operacao} são tomadas com base em dados confiáveis?`,
    o1: `Os principais gargalos de ${c.operacao} estão mapeados?`,
    o2: `Os prazos de ${c.operacao} são medidos e acompanhados?`,
    o3: `${c.capacidade.charAt(0).toUpperCase() + c.capacidade.slice(1)} é conhecida com precisão?`,
    o7: `Existe controle de qualidade formal para ${c.operacao}?`,
    v1: `Os leads e oportunidades de ${c.oferta} são registrados e acompanhados em CRM?`,
    v2: `Existe processo comercial definido para vender ${c.oferta}?`,
    v3: `A conversão das oportunidades de ${c.oferta} é acompanhada por etapa?`,
    v4: `Existe padrão de follow-up para oportunidades de ${c.oferta}?`,
    v7: `Existe previsão de vendas confiável para ${c.oferta}?`,
    v8: `O ticket médio de ${c.oferta} é acompanhado?`,
    t1: `Os sistemas usados em ${c.operacao} estão integrados ou centralizados?`,
    t2: `Existe dashboard para acompanhar indicadores de ${c.operacao}?`,
    t3: `Os dados de ${c.operacao} estão centralizados e acessíveis aos responsáveis?`,
  };
  return templates[q.id];
}

function riscoCategoria(q, categoria) {
  const c = categoriaContexto(categoria);
  const templates = {
    m1: `O custo de aquisição de ${c.cliente} não é conhecido`,
    m2: `Não há funil estruturado para ${c.oferta}`,
    m3: `O retorno das campanhas de ${c.oferta} não é medido`,
    m7: `A base de ${c.cliente} não está segmentada`,
    m8: `Falta pós-venda estruturado após ${c.oferta}`,
    c4: `Pode haver falhas na emissão ou tratamento de ${c.documentoFiscal}`,
    c5: `Créditos ou oportunidades tributárias podem não estar sendo revisados`,
    f3a: `O faturamento mínimo necessário para cobrir custos não é conhecido`,
    f7a: `Resultado e margem por ${c.unidadeRentabilidade} não são acompanhados`,
    f9a: `Custo e rentabilidade por ${c.unidadeRentabilidade} não são conhecidos`,
    a1: `As rotinas críticas de ${c.operacao} não estão documentadas`,
    a5: `Responsabilidades sobre ${c.operacao} podem estar pouco claras`,
    a7: `O controle de ${c.operacao} depende de ferramentas pouco estruturadas`,
    g3: `Indicadores de ${c.operacao} não são acompanhados regularmente`,
    g5: `Decisões sobre ${c.operacao} podem depender mais de percepção do que dados`,
    o1: `Os gargalos de ${c.operacao} não estão mapeados`,
    o2: `Os prazos de ${c.operacao} não são monitorados`,
    o3: `${c.capacidade.charAt(0).toUpperCase() + c.capacidade.slice(1)} não é conhecida`,
    o7: `Não há controle formal de qualidade em ${c.operacao}`,
    v1: `Oportunidades de ${c.oferta} podem se perder sem CRM`,
    v2: `Não há processo comercial estruturado para ${c.oferta}`,
    v3: `A conversão de ${c.oferta} não é conhecida por etapa`,
    v4: `Não há padrão de follow-up para ${c.oferta}`,
    v7: `Não há previsão de vendas confiável para ${c.oferta}`,
    v8: `O ticket médio de ${c.oferta} não é acompanhado`,
    t1: `Os sistemas de ${c.operacao} podem estar fragmentados`,
    t2: `Não há dashboard de indicadores de ${c.operacao}`,
    t3: `Os dados de ${c.operacao} podem estar dispersos`,
  };
  return templates[q.id];
}

function textoDe(q, segmento, categoria) {
  return (
    q.porCategoria?.[categoria]?.text ||
    textoCategoria(q, categoria) ||
    q.porSegmento?.[segmento]?.text ||
    q.text
  );
}

function riscoDe(q, segmento, categoria) {
  return (
    q.porCategoria?.[categoria]?.risco ||
    riscoCategoria(q, categoria) ||
    q.porSegmento?.[segmento]?.risco ||
    q.risco
  );
}

// No evento usamos 5 perguntas por área: 2 do primeiro subtema, 2 do segundo e 1 do terceiro.
function checklistEnxuto(subtemas) {
  const quantidade = [2, 2, 1];
  return subtemas.map((sub, idx) => ({
    ...sub,
    perguntas: sub.perguntas.slice(0, quantidade[idx] || 1),
  }));
}

// Cada área tem 3 subtemas, cada um com 3 perguntas.

const DORES_EVENTO = [
  "Vendas abaixo do esperado",
  "Margem ou lucro baixo",
  "Falta de dinheiro em caixa",
  "Impostos elevados",
  "Processos desorganizados",
  "Dependência excessiva do proprietário",
  "Dificuldade com equipe",
  "Falta de informações para decidir",
  "Sistemas ou tecnologia insuficientes",
  "Outro",
];

const DORES_HOLDING = [
  "Patrimônio desorganizado entre pessoa física e jurídica",
  "Sucessão familiar ainda não planejada",
  "Imóveis ou participações sem estrutura definida",
  "Dúvida se a holding atual ainda faz sentido",
  "Carga tributária sobre aluguéis, imóveis ou participações",
  "Risco de conflito entre sócios ou herdeiros",
  "Falta de regras de governança e administração",
  "Dificuldade para centralizar empresas e participações",
  "Pretendo transferir ou integralizar bens para a holding",
  "Pretendo comprar ou vender imóveis ou participações",
  "Não sei qual tipo de holding é adequado",
  "Outro",
];

const AREAS_HOLDING = [
  { id: "patrimonio", label: "Patrimônio", Icon: Building2 },
  { id: "participacoes", label: "Participações societárias", Icon: Users },
  { id: "imoveis", label: "Imóveis", Icon: Building2 },
  { id: "receitas_patrimoniais", label: "Receitas patrimoniais", Icon: Wallet },
  { id: "tributario_patrimonial", label: "Tributário patrimonial", Icon: Calculator },
  { id: "governanca", label: "Governança", Icon: Target },
  { id: "sucessao", label: "Sucessão", Icon: Users },
  { id: "protecao_patrimonial", label: "Proteção patrimonial", Icon: Scale },
  { id: "custos_estrutura", label: "Custos da estrutura", Icon: Percent },
];

const DORES_GRUPO = [
  "Não temos uma visão consolidada das empresas do grupo",
  "Há movimentações entre empresas sem processo claro",
  "Existem custos e estruturas duplicadas",
  "A governança entre os sócios e empresas é fraca",
  "O caixa do grupo não é gerido de forma integrada",
  "Há dúvidas sobre tributação das operações entre empresas",
  "Funcionários ou estruturas são compartilhados sem regra clara",
  "Existe risco de grupo econômico ou confusão patrimonial",
  "Os dados estão fragmentados entre sistemas e empresas",
  "Outro",
];

const DORES_SPE = [
  "Não está clara a viabilidade financeira do projeto",
  "Há dificuldade para controlar aportes e necessidades de caixa",
  "As responsabilidades entre sócios/investidores não estão claras",
  "Existem contratos ou obrigações críticas ainda não estruturadas",
  "A tributação do projeto não foi simulada adequadamente",
  "Falta governança para decisões e prestação de contas",
  "Os custos estão acima do previsto",
  "O cronograma do projeto apresenta riscos",
  "Não existe plano claro para saída ou encerramento da SPE",
  "Outro",
];

const IMPACTOS_GRUPO = [
  "Perda de eficiência entre empresas",
  "Custos duplicados",
  "Risco tributário",
  "Risco de grupo econômico",
  "Conflitos entre sócios",
  "Decisões sem visão consolidada",
  "Baixa previsibilidade de caixa",
  "Dificuldade de crescimento do grupo",
];

const IMPACTOS_SPE = [
  "Aumento do custo do projeto",
  "Necessidade inesperada de aportes",
  "Atraso do empreendimento",
  "Conflito entre sócios/investidores",
  "Risco contratual",
  "Risco tributário",
  "Perda de rentabilidade",
  "Dificuldade de encerramento ou saída",
];

const IMPACTOS_DOR = [
  "Perda de vendas",
  "Redução da margem",
  "Falta de caixa",
  "Retrabalho",
  "Atrasos",
  "Risco fiscal ou jurídico",
  "Sobrecarga dos sócios",
  "Dificuldade de crescimento",
];

const IMPACTOS_HOLDING = [
  "Risco sucessório",
  "Conflito entre herdeiros ou sócios",
  "Patrimônio desorganizado",
  "Carga tributária patrimonial elevada",
  "Risco fiscal ou jurídico",
  "Dificuldade para administrar imóveis",
  "Dificuldade para transferir ou vender bens",
  "Falta de governança",
  "Exposição patrimonial",
  "Decisões sem planejamento",
];

const IMPACTOS_PF = [
  "Falta de dinheiro no fim do mês",
  "Dificuldade para poupar",
  "Endividamento",
  "Ausência de reserva de emergência",
  "Aposentadoria insuficiente",
  "Investimentos sem estratégia",
  "Patrimônio desorganizado",
  "Insegurança financeira",
  "Dependência da renda atual",
  "Dificuldade para atingir objetivos",
];

const CHECKLISTS_PF = {
  financeiro: [
    {
      tema: "Organização financeira",
      dica: "Entender renda, gastos, previsibilidade e capacidade real de poupança.",
      perguntas: [
        { id: "pf_fin_1", text: "Você acompanha mensalmente quanto recebe, quanto gasta e quanto consegue poupar?", risco: "Baixa visibilidade financeira pessoal.", importancia: 3 },
        { id: "pf_fin_2", text: "Seus gastos fixos e variáveis estão organizados por categoria e prioridade?", risco: "Dificuldade para identificar excessos e ajustar o orçamento.", importancia: 2 },
        { id: "pf_fin_3", text: "Você consegue prever seus compromissos financeiros dos próximos 3 meses?", risco: "Risco de falta de liquidez e decisões reativas.", importancia: 2 },
      ],
    },
  ],
  aposentadoria: [
    {
      tema: "Planejamento de aposentadoria",
      dica: "Transformar o objetivo de renda futura em prazo, patrimônio-alvo e capacidade de aporte.",
      perguntas: [
        { id: "pf_apo_1", text: "Você já definiu com que idade gostaria de reduzir ou encerrar sua atividade profissional?", risco: "Aposentadoria sem horizonte definido.", importancia: 2 },
        { id: "pf_apo_2", text: "Você sabe qual renda mensal gostaria de ter na aposentadoria, em valores atuais?", risco: "Meta de aposentadoria sem valor de referência.", importancia: 3 },
        { id: "pf_apo_3", text: "Você conhece aproximadamente quanto já possui acumulado para esse objetivo e quanto consegue aportar por mês?", risco: "Distância entre patrimônio atual e objetivo futuro desconhecida.", importancia: 3 },
      ],
    },
  ],
  investimentos: [
    {
      tema: "Investimentos",
      dica: "Avaliar objetivos, prazo, liquidez e organização da carteira antes de discutir produtos.",
      perguntas: [
        { id: "pf_inv_1", text: "Seus investimentos estão separados de acordo com objetivos de curto, médio e longo prazo?", risco: "Carteira sem relação clara com os objetivos pessoais.", importancia: 3 },
        { id: "pf_inv_2", text: "Você mantém sua reserva de emergência separada dos investimentos de longo prazo?", risco: "Liquidez inadequada para emergências.", importancia: 3 },
        { id: "pf_inv_3", text: "Você entende o nível de risco e liquidez dos principais investimentos que possui?", risco: "Exposição a produtos incompatíveis com necessidades e prazo.", importancia: 2 },
      ],
    },
  ],
  patrimonio: [
    {
      tema: "Organização patrimonial",
      dica: "Consolidar bens, investimentos e obrigações em uma visão patrimonial única.",
      perguntas: [
        { id: "pf_pat_1", text: "Você possui uma relação atualizada dos seus principais bens, investimentos e dívidas?", risco: "Patrimônio fragmentado e sem visão consolidada.", importancia: 2 },
        { id: "pf_pat_2", text: "Você sabe quanto do seu patrimônio está concentrado em imóveis, investimentos financeiros e outros ativos?", risco: "Concentração patrimonial não monitorada.", importancia: 2 },
        { id: "pf_pat_3", text: "Há decisões patrimoniais relevantes previstas para os próximos anos, como compra, venda, herança ou doação?", risco: "Decisões patrimoniais relevantes sem planejamento prévio.", importancia: 3 },
      ],
    },
  ],
  protecao: [
    {
      tema: "Proteção financeira",
      dica: "Avaliar reserva, dependentes e vulnerabilidades que podem comprometer renda e patrimônio.",
      perguntas: [
        { id: "pf_pro_1", text: "Sua reserva de emergência seria suficiente para manter seus principais gastos por alguns meses?", risco: "Baixa capacidade de absorver imprevistos.", importancia: 3 },
        { id: "pf_pro_2", text: "Existem pessoas que dependem financeiramente da sua renda?", risco: "Dependentes expostos à interrupção de renda.", importancia: 3 },
        { id: "pf_pro_3", text: "Você já avaliou quais eventos poderiam comprometer significativamente sua renda ou patrimônio?", risco: "Riscos pessoais e familiares não mapeados.", importancia: 2 },
      ],
    },
  ],
  organizacao: [
    {
      tema: "Planejamento financeiro",
      dica: "Transformar objetivos em prioridades, prazo e ações mensuráveis.",
      perguntas: [
        { id: "pf_org_1", text: "Você possui metas financeiras definidas com valor e prazo?", risco: "Objetivos financeiros sem plano de execução.", importancia: 2 },
        { id: "pf_org_2", text: "Você revisa periodicamente se suas decisões financeiras estão aproximando você dos seus objetivos?", risco: "Ausência de acompanhamento e correção de rota.", importancia: 2 },
        { id: "pf_org_3", text: "Você sabe qual é hoje a prioridade financeira mais importante para você?", risco: "Recursos dispersos entre objetivos concorrentes.", importancia: 3 },
      ],
    },
  ],
};

const CHECKLISTS = {
  marketing: [
    { tema: "Aquisição e conversão", dica: "Mapear o funil completo e acompanhar CAC e ROI mês a mês", perguntas: [
      { id: "m1", text: "Você sabe hoje qual é o seu custo de aquisição de cliente (CAC)?", risco: "O CAC não é acompanhado hoje" },
      { id: "m2", text: "Existe um funil de vendas mapeado, do primeiro contato até o fechamento?", risco: "Não há funil de vendas mapeado" },
      { id: "m3", text: "Você mede o retorno (ROI) das campanhas que faz?", risco: "O retorno das campanhas não é medido" },
    ]},
    { tema: "Marca e presença digital", dica: "Padronizar a identidade de marca e manter presença digital ativa em todos os canais", perguntas: [
      { id: "m4", text: "Existe consistência de marca (visual e discurso) em todos os canais?", risco: "A marca não é consistente entre os canais" },
      { id: "m5", text: "As redes sociais e o site são atualizados com regularidade?", risco: "Presença digital desatualizada" },
      { id: "m6", text: "A empresa aparece bem posicionada quando o cliente pesquisa no Google?", risco: "Baixo posicionamento em buscas" },
    ]},
    { tema: "Relacionamento e retenção", dica: "Estruturar pós-venda e coletar feedback para reter clientes atuais", perguntas: [
      { id: "m7", text: "Você tem uma base de clientes segmentada para ações futuras?", risco: "Não há base de clientes segmentada" },
      { id: "m8", text: "Existe um processo de pós-venda estruturado?", risco: "Falta processo de pós-venda" },
      { id: "m9", text: "A satisfação dos clientes é medida de alguma forma (NPS, pesquisas)?", risco: "Satisfação do cliente não é medida" },
    ]},
  ],
  juridico: [
    { tema: "Contratos e propriedade", dica: "Formalizar contratos-padrão e registrar a marca no INPI", perguntas: [
      { id: "j1", text: "Todos os contratos com clientes e fornecedores estão formalizados?", risco: "Contratos não estão formalizados" },
      { id: "j2", text: "Sua marca está registrada no INPI?", risco: "A marca ainda não está registrada" },
      { id: "j3", text: "Contratos de prestação de serviço têm cláusulas de confidencialidade e SLA?", risco: "Faltam cláusulas de proteção nos contratos" },
    ]},
    { tema: "Trabalhista e compliance", dica: "Revisar rotina trabalhista e formalizar políticas internas de compliance", perguntas: [
      { id: "j4", text: "A empresa está em dia com obrigações trabalhistas?", risco: "Há pendências trabalhistas" },
      { id: "j5", text: "Existem políticas internas formalizadas (conduta, segurança, LGPD)?", risco: "Faltam políticas internas formalizadas" },
      { id: "j6", text: "A equipe recebe algum treinamento de compliance ou conduta?", risco: "Não há treinamento de compliance" },
    ]},
    { tema: "Estrutura societária e riscos", dica: "Atualizar o contrato social e mapear riscos jurídicos em aberto", perguntas: [
      { id: "j7", text: "O contrato social está atualizado e alinhado com a operação real?", risco: "O contrato social está desatualizado" },
      { id: "j8", text: "Existe algum processo judicial ou risco jurídico conhecido em aberto?", risco: "Há processo ou risco jurídico em aberto", invert: true },
      { id: "j9", text: "Há um plano de sucessão societária definido?", risco: "Não há plano de sucessão societária" },
    ]},
  ],
  contabilidade: [
    { tema: "Contábil e DRE", dica: "Passar a analisar balancete e DRE mensalmente com o time contábil", perguntas: [
      { id: "c1", text: "Você recebe e analisa o balancete mensalmente?", risco: "O balancete mensal não é analisado" },
      { id: "c2", text: "A DRE (Demonstração de Resultado) é analisada com regularidade?", risco: "A DRE não é analisada com regularidade" },
      { id: "c3", text: "O pró-labore e a distribuição de lucros são feitos de forma correta?", risco: "Pró-labore ou distribuição de lucros pode estar incorreta" },
    ]},
    { tema: "Fiscal e obrigações", dica: "Revisar classificação fiscal e aproveitamento de créditos", perguntas: [
      { id: "c4", text: "Todas as notas fiscais são emitidas corretamente, com CST e NCM atualizados?", risco: "Pode haver erro de classificação fiscal (NCM/CST)",
        porSegmento: { "Serviço": {
          text: "As notas de serviço são emitidas com o código correto e o ISS tratado devidamente?",
          risco: "Pode haver erro na emissão de notas de serviço ou no tratamento do ISS",
        }}},
      { id: "c5", text: "A empresa aproveita todos os créditos e benefícios fiscais a que tem direito?", risco: "Créditos e benefícios fiscais podem estar sendo perdidos" },
      { id: "c6", text: "As apurações fiscais passam por alguma conferência periódica?", risco: "Não há conferência periódica das apurações fiscais" },
    ]},
    { tema: "Tributário e planejamento", dica: "Simular o regime tributário ideal e preparar a empresa para a reforma (IBS/CBS)", perguntas: [
      { id: "c7", text: "Você tem certeza de que o regime tributário atual é o mais vantajoso?", risco: "O regime tributário ideal nunca foi validado" },
      { id: "c8", text: "Existe algum planejamento tributário ou recuperação de créditos em andamento?", risco: "Não há planejamento tributário ativo" },
      { id: "c9", text: "A empresa já simulou o impacto da Reforma Tributária (IBS/CBS)?", risco: "Não há simulação do impacto do IBS/CBS" },
    ]},
  ],
  financeiro: [
    { tema: "Fluxo de caixa", dica: "Implantar fluxo de caixa diário com projeção de 90 dias", perguntas: [
      { id: "f1a", text: "A empresa possui fluxo de caixa diário?", risco: "Não há fluxo de caixa diário" },
      { id: "f2a", text: "O caixa é projetado para os próximos 90 dias?", risco: "Não há projeção de caixa para 90 dias" },
      { id: "f3a", text: "Você sabe exatamente quanto precisa vender por mês para cobrir os custos?", risco: "O valor mínimo de vendas mensal não é conhecido" },
    ]},
    { tema: "Contas e conciliação", dica: "Automatizar conciliação bancária e a cobrança de inadimplentes", perguntas: [
      { id: "f4a", text: "A conciliação bancária e de cartão é feita diariamente?", risco: "Conciliação bancária/cartão não é diária" },
      { id: "f5a", text: "A inadimplência é controlada com algum processo de cobrança?", risco: "Não há controle estruturado de inadimplência" },
      { id: "f6a", text: "A empresa tem reserva financeira para imprevistos?", risco: "Não há reserva financeira para imprevistos" },
    ]},
    { tema: "Indicadores financeiros", dica: "Calcular margem, ponto de equilíbrio, CAC e LTV com regularidade", perguntas: [
      { id: "f7a", text: "A margem líquida e o EBITDA são acompanhados regularmente?", risco: "Margem líquida e EBITDA não são acompanhados" },
      { id: "f8a", text: "O ponto de equilíbrio e o ticket médio são conhecidos?", risco: "Ponto de equilíbrio e ticket médio não são conhecidos" },
      { id: "f9a", text: "A empresa conhece o custo por produto, cliente ou centro de custo?", risco: "Custos por produto/cliente não são conhecidos" },
    ]},
  ],
  administrativo: [
    { tema: "Processos e documentação", dica: "Documentar os processos mais críticos (POPs) e criar rotina de arquivamento", perguntas: [
      { id: "a1", text: "Existem procedimentos operacionais escritos (POPs) para as principais rotinas?", risco: "Não há procedimentos operacionais escritos (POPs)" },
      { id: "a2", text: "Contratos, procurações e certificados digitais estão organizados e controlados?", risco: "Documentos legais não estão organizados/controlados" },
      { id: "a3", text: "As licenças da empresa estão sempre em dia?", risco: "Pode haver licença vencida ou pendente" },
    ]},
    { tema: "Estrutura organizacional", dica: "Definir organograma, descrição de cargos e reduzir dependência de uma pessoa", perguntas: [
      { id: "a4", text: "A empresa possui organograma e descrição de cargos formalizados?", risco: "Faltam organograma e descrição de cargos" },
      { id: "a5", text: "Cada funcionário sabe claramente suas responsabilidades?", risco: "Responsabilidades não são claras para a equipe" },
      { id: "a6", text: "As decisões dependem de uma única pessoa para acontecer?", risco: "Há forte dependência de uma única pessoa", invert: true },
    ]},
    { tema: "Sistemas e indicadores", dica: "Centralizar dados em um sistema de gestão e acompanhar indicadores de desempenho", perguntas: [
      { id: "a7", text: "A empresa usa algum sistema de gestão estruturado (ERP/planilhas)?", risco: "A gestão ainda depende de controles informais" },
      { id: "a8", text: "Existem indicadores de desempenho acompanhados nas reuniões?", risco: "Não há indicadores de desempenho acompanhados" },
      { id: "a9", text: "Existe rotina de backup e segurança da informação?", risco: "Falta rotina de backup e segurança da informação" },
    ]},
  ],
  gestao: [
    { tema: "Indicadores e metas", dica: "Definir de 3 a 5 KPIs prioritários e instituir reuniões semanais", perguntas: [
      { id: "g1", text: "A empresa faz reunião semanal de acompanhamento?", risco: "Não há reunião semanal de acompanhamento" },
      { id: "g2", text: "Existe planejamento anual com metas definidas?", risco: "Não há planejamento anual com metas" },
      { id: "g3", text: "Os indicadores de desempenho são acompanhados com regularidade?", risco: "Indicadores não são acompanhados com regularidade" },
    ]},
    { tema: "Planejamento estratégico", dica: "Estruturar um plano estratégico de 12 meses baseado em dados", perguntas: [
      { id: "g4", text: "A empresa tem um planejamento estratégico para os próximos 12 meses?", risco: "Não há planejamento estratégico formal" },
      { id: "g5", text: "As decisões são baseadas em dados, e não apenas em percepção?", risco: "Decisões ainda dependem só de percepção" },
      { id: "g6", text: "A concorrência é acompanhada de forma estruturada?", risco: "Concorrência não é acompanhada de forma estruturada" },
    ]},
    { tema: "Liderança e sucessão", dica: "Reduzir a dependência de uma pessoa e estruturar um plano de sucessão", perguntas: [
      { id: "g7", text: "Existe dependência crítica de uma única pessoa para a gestão?", risco: "Há dependência crítica de uma pessoa na gestão", invert: true },
      { id: "g8", text: "Há um plano de sucessão para posições-chave?", risco: "Não há plano de sucessão para posições-chave" },
      { id: "g9", text: "A liderança da empresa recebe algum tipo de desenvolvimento?", risco: "Não há desenvolvimento formal de liderança" },
    ]},
  ],
  operacional: [
    { tema: "Produção e entrega", dica: "Mapear gargalos e monitorar prazos médios de entrega ou execução", perguntas: [
      { id: "o1", text: "Os principais gargalos de produção ou entrega são conhecidos?", risco: "Os gargalos operacionais não estão mapeados",
        porSegmento: {
          "Comércio": { text: "Os principais gargalos de reposição ou entrega são conhecidos?", risco: "Os gargalos de reposição/entrega não estão mapeados" },
          "Serviço": { text: "Os principais gargalos na execução ou entrega do serviço são conhecidos?", risco: "Os gargalos na execução do serviço não estão mapeados" },
        }},
      { id: "o2", text: "O prazo médio de entrega é medido e monitorado?", risco: "O prazo de entrega não é monitorado",
        porSegmento: { "Serviço": { text: "O prazo médio de execução do serviço é medido e monitorado?", risco: "O prazo de execução do serviço não é monitorado" } }},
      { id: "o3", text: "A capacidade produtiva da empresa é conhecida com precisão?", risco: "Capacidade produtiva não é conhecida com precisão",
        porSegmento: {
          "Comércio": { text: "A capacidade de reposição de estoque é conhecida com precisão?", risco: "Capacidade de reposição de estoque não é conhecida" },
          "Serviço": { text: "A capacidade de atendimento da equipe é conhecida com precisão?", risco: "Capacidade de atendimento da equipe não é conhecida" },
        }},
    ]},
    { tema: "Fornecedores e cadeia", dica: "Diversificar fornecedores-chave e formalizar contratos de fornecimento", perguntas: [
      { id: "o4", text: "A empresa depende de poucos fornecedores-chave?", risco: "Há forte dependência de poucos fornecedores", invert: true,
        porSegmento: { "Serviço": { text: "A empresa depende de poucos parceiros ou subcontratados-chave?", risco: "Há forte dependência de poucos parceiros/subcontratados" } }},
      { id: "o5", text: "Os contratos com fornecedores estão formalizados?", risco: "Contratos com fornecedores não estão formalizados",
        porSegmento: { "Serviço": { text: "Os contratos com parceiros ou subcontratados estão formalizados?", risco: "Contratos com parceiros/subcontratados não estão formalizados" } }},
      { id: "o6", text: "A gestão de estoque é feita de forma estruturada?", risco: "Gestão de estoque não é estruturada",
        porSegmento: { "Serviço": { text: "A agenda ou capacidade da equipe é planejada com antecedência?", risco: "A capacidade da equipe não é planejada com antecedência" } }},
    ]},
    { tema: "Qualidade e contingência", dica: "Formalizar controle de qualidade e um plano de contingência operacional", perguntas: [
      { id: "o7", text: "Existe controle de qualidade formalizado?", risco: "Não há controle de qualidade formalizado" },
      { id: "o8", text: "Há um plano de contingência para falhas operacionais?", risco: "Falta plano de contingência operacional" },
      { id: "o9", text: "Indicadores de qualidade são acompanhados com regularidade?", risco: "Indicadores de qualidade não são acompanhados" },
    ]},
  ],
  rh: [
    { tema: "Recrutamento e retenção", dica: "Estruturar um processo de recrutamento e acompanhar turnover e absenteísmo", perguntas: [
      { id: "r1", text: "Existe um processo de contratação estruturado?", risco: "Não há processo de contratação estruturado" },
      { id: "r2", text: "O turnover e o absenteísmo são acompanhados?", risco: "Turnover e absenteísmo não são monitorados" },
      { id: "r3", text: "Existe um plano de cargos e carreira definido?", risco: "Não há plano de cargos e carreira definido" },
    ]},
    { tema: "Clima e cultura", dica: "Aplicar pesquisa de clima organizacional e formalizar controle de ponto e banco de horas", perguntas: [
      { id: "r4", text: "Já foi aplicada alguma pesquisa de clima organizacional?", risco: "Nunca foi aplicada pesquisa de clima" },
      { id: "r5", text: "Existe controle de ponto e banco de horas formalizado?", risco: "Controle de ponto/banco de horas não é formalizado" },
      { id: "r6", text: "A equipe recebe treinamentos com alguma regularidade?", risco: "Não há treinamentos regulares para a equipe" },
    ]},
    { tema: "Departamento pessoal", dica: "Revisar a rotina de departamento pessoal e as obrigações do eSocial", perguntas: [
      { id: "r7", text: "A folha de pagamento roda sem erros recorrentes?", risco: "A folha de pagamento tem erros recorrentes" },
      { id: "r8", text: "As obrigações do eSocial estão sempre em dia?", risco: "Há pendências com o eSocial" },
      { id: "r9", text: "Existe uma política de benefícios formalizada?", risco: "Não há política de benefícios formalizada" },
    ]},
  ],
  comercial: [
    { tema: "Processo comercial", dica: "Estruturar um processo comercial com CRM e funil de vendas claro", perguntas: [
      { id: "v1", text: "A empresa possui CRM?", risco: "Não há CRM em uso" },
      { id: "v2", text: "Existe um processo comercial e funil de vendas definido?", risco: "Não há processo comercial/funil definido" },
      { id: "v3", text: "A taxa de conversão em cada etapa do funil é conhecida?", risco: "A conversão por etapa não é conhecida" },
    ]},
    { tema: "Time comercial", dica: "Padronizar follow-up e acompanhar tempo médio de fechamento", perguntas: [
      { id: "v4", text: "Existe um padrão de follow-up com os leads?", risco: "Não há padrão de follow-up definido" },
      { id: "v5", text: "O tempo médio de fechamento é acompanhado?", risco: "O tempo médio de fechamento não é acompanhado" },
      { id: "v6", text: "A equipe comercial recebe treinamento contínuo?", risco: "Não há treinamento comercial contínuo" },
    ]},
    { tema: "Pipeline e previsibilidade", dica: "Construir um forecast de vendas confiável baseado em dados históricos", perguntas: [
      { id: "v7", text: "A empresa tem uma previsão de vendas (forecast) confiável?", risco: "Não há forecast de vendas confiável" },
      { id: "v8", text: "O ticket médio de venda é acompanhado?", risco: "O ticket médio não é acompanhado" },
      { id: "v9", text: "A taxa de clientes recorrentes/recompra é conhecida?", risco: "A taxa de recompra não é conhecida" },
    ]},
  ],
  tecnologia: [
    { tema: "Sistemas e dados", dica: "Centralizar dados em um ERP/CRM e implantar dashboards de BI", perguntas: [
      { id: "t1", text: "A empresa utiliza ERP e/ou CRM?", risco: "Não há ERP/CRM em uso" },
      { id: "t2", text: "Existe algum BI ou dashboard para acompanhar dados do negócio?", risco: "Não há BI/dashboard de dados" },
      { id: "t3", text: "Os dados da empresa estão centralizados em um só lugar?", risco: "Dados espalhados em vários lugares diferentes" },
    ]},
    { tema: "Segurança da informação", dica: "Implementar backup testado e autenticação em duas etapas (MFA)", perguntas: [
      { id: "t4", text: "Existe rotina de backup testada com regularidade?", risco: "Backup não é testado com regularidade" },
      { id: "t5", text: "A empresa usa autenticação em duas etapas (MFA) nos sistemas?", risco: "Não há autenticação em duas etapas (MFA)" },
      { id: "t6", text: "Há antivírus corporativo ou proteção de endpoints instalado?", risco: "Falta antivírus corporativo/proteção de endpoints" },
    ]},
    { tema: "Privacidade e conformidade", dica: "Formalizar política de LGPD e um plano de resposta a incidentes", perguntas: [
      { id: "t7", text: "A empresa tem uma política formal de LGPD implementada?", risco: "Não há política de LGPD implementada" },
      { id: "t8", text: "O consentimento de dados de clientes é coletado formalmente?", risco: "Consentimento de dados não é formalizado" },
      { id: "t9", text: "Existe um plano definido para resposta a incidentes de segurança?", risco: "Não há plano de resposta a incidentes" },
    ]},
  ],
};

function areaLabel(id) { return AREAS.find((a) => a.id === id)?.label || id; }
function formatBRL(v) { return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }); }

function pickCompany(cnpjDigits) {
  const sum = cnpjDigits.split("").reduce((acc, d) => acc + Number(d), 0);
  const idx = cnpjDigits.length ? sum % COMPANIES.length : 0;
  return COMPANIES[idx];
}

function normalizarSegmentoTributario(segmento) {
  if (!segmento) return "Serviço";

  const valor = String(segmento).toLowerCase();

  if (
    valor.includes("indústria") ||
    valor.includes("industria")
  ) {
    return "Indústria";
  }

  if (
    valor.includes("comércio") ||
    valor.includes("comercio")
  ) {
    return "Comércio";
  }

  return "Serviço";
}

function segmentoPredominanteDe(empresas) {
  if (!empresas.length) return null;

  const contagem = {};

  empresas.forEach((e) => {
    const segmento = normalizarSegmentoTributario(e.segmento);

    contagem[segmento] =
      (contagem[segmento] || 0) + 1;
  });

  return Object.entries(contagem)
    .sort((a, b) => b[1] - a[1])[0][0];
}

function StepDots({ step }) {
  const order = ["cadastro", "cnpj", "porte", "dor", "checklist", "analisando", "resultado"];
  const idx = order.indexOf(step);
  if (idx === -1) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        justifyContent: "center",
        padding: "14px 18px 4px",
      }}
    >
      {order.map((s, i) => (
        <div key={s} style={{
          width: i === idx ? 16 : 6, height: 6, borderRadius: 3,
          background: i <= idx ? CORAL : "#D8DEEA", transition: "all 0.25s",
        }} />
      ))}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        minHeight: 48,
        padding: "13px 16px",
        borderRadius: 12,
        border: "none",
        background: disabled ? "#D8DEEA" : CORAL,
        color: WHITE,
        fontFamily: BODY_FONT,
        fontSize: 15,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function DiagnosticoPrototipo() {
  const SENHA_ACESSO_APP = "181022";
  const [acessoLiberado, setAcessoLiberado] = useState(() => {
    try { return sessionStorage.getItem("finder_app_acesso") === "liberado"; }
    catch { return false; }
  });
  const [senhaAcesso, setSenhaAcesso] = useState("");
  const [erroSenhaAcesso, setErroSenhaAcesso] = useState("");

  function validarAcessoApp(event) {
    event?.preventDefault?.();
    if (senhaAcesso === SENHA_ACESSO_APP) {
      try { sessionStorage.setItem("finder_app_acesso", "liberado"); } catch {}
      setAcessoLiberado(true);
      setErroSenhaAcesso("");
      setSenhaAcesso("");
      return;
    }
    setErroSenhaAcesso("Senha incorreta. Tente novamente.");
  }

  const [step, setStep] = useState("intro");
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [consentimentoEmail, setConsentimentoEmail] = useState(true);
  const [envioRelatorio, setEnvioRelatorio] = useState("idle");
  const relatorioEnviadoRef = useRef(false);
  const [cnpjInput, setCnpjInput] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [empresas, setEmpresas] = useState([]);
  const [cnaesEmpresa, setCnaesEmpresa] = useState([]);
  const [atividadesSelecionadas, setAtividadesSelecionadas] = useState([]);
  const [atividadePredominante, setAtividadePredominante] = useState(null);
  const [descricaoNegocio, setDescricaoNegocio] = useState("");
  const [estruturaNegocio, setEstruturaNegocio] = useState("operacional");
  const [tiposHolding, setTiposHolding] = useState([]);
  const [objetivosHolding, setObjetivosHolding] = useState([]);
  const [patrimonioHolding, setPatrimonioHolding] = useState("");
  const [receitasHolding, setReceitasHolding] = useState("");
  const [sucessaoHolding, setSucessaoHolding] = useState("");

  const [objetivosPF, setObjetivosPF] = useState([]);
  const [rendaMensalPF, setRendaMensalPF] = useState("");
  const [gastosMensaisPF, setGastosMensaisPF] = useState("");
  const [dividasPF, setDividasPF] = useState("");
  const [reservaPF, setReservaPF] = useState("");
  const [patrimonioPF, setPatrimonioPF] = useState("");
  const [investimentosPF, setInvestimentosPF] = useState("");
  const [aposentadoriaPF, setAposentadoriaPF] = useState("");
  const [dependentesPF, setDependentesPF] = useState("");

  const [nomeGrupo, setNomeGrupo] = useState("");
  const [funcaoEmpresasGrupo, setFuncaoEmpresasGrupo] = useState("");
  const [sociosComunsGrupo, setSociosComunsGrupo] = useState("");
  const [financeiroCentralizadoGrupo, setFinanceiroCentralizadoGrupo] = useState("");
  const [pessoasCompartilhadasGrupo, setPessoasCompartilhadasGrupo] = useState("");
  const [operacoesIntercompanyGrupo, setOperacoesIntercompanyGrupo] = useState("");
  const [governancaGrupo, setGovernancaGrupo] = useState("");

  const [speConstituida, setSpeConstituida] = useState("");
  const [nomeProjetoSPE, setNomeProjetoSPE] = useState("");
  const [finalidadeSPE, setFinalidadeSPE] = useState("");
  const [sociosSPE, setSociosSPE] = useState("");
  const [valorProjetoSPE, setValorProjetoSPE] = useState("");
  const [aportesSPE, setAportesSPE] = useState("");
  const [financiamentoSPE, setFinanciamentoSPE] = useState("");
  const [prazoSPE, setPrazoSPE] = useState("");
  const [receitaPrevistaSPE, setReceitaPrevistaSPE] = useState("");
  const [custosPrevistosSPE, setCustosPrevistosSPE] = useState("");
  const [faseProjetoSPE, setFaseProjetoSPE] = useState("");

  const [perguntasDinamicas, setPerguntasDinamicas] = useState([]);
  const [negocioInterpretado, setNegocioInterpretado] = useState(null);
  const [gerandoPerguntas, setGerandoPerguntas] = useState(false);
  const [erroPerguntas, setErroPerguntas] = useState("");
  const [faturamento, setFaturamento] = useState(null);
  const [colaboradores, setColaboradores] = useState(null);
  const [regime, setRegime] = useState(null);
  const [observacao, setObservacao] = useState("");
  const [dores, setDores] = useState([]);
  const [doresSelecionadas, setDoresSelecionadas] = useState([]);
  const [dor90Dias, setDor90Dias] = useState("");
  const [impactosDor, setImpactosDor] = useState([]);
  const [respostas, setRespostas] = useState({});
  const [msgIdx, setMsgIdx] = useState(0);
  const [toast, setToast] = useState("");
  const [iaResultado, setIaResultado] = useState(null);
  const toastTimer = useRef(null);

  // =========================================================
  // CONTINUAR DE ONDE PAROU
  // Salva o progresso localmente neste aparelho/navegador.
  // =========================================================
  const CHAVE_RASCUNHO =
    "finder_diagnostico_rascunho_v1";

  const PRAZO_RASCUNHO_MS =
    7 * 24 * 60 * 60 * 1000;

  const [rascunhoPendente, setRascunhoPendente] =
    useState(null);

  const [retomadaDecidida, setRetomadaDecidida] =
    useState(false);

  // =========================================================
  // CRM / RASTREAMENTO DO LEAD
  // Complemento: não altera o fluxo existente do diagnóstico.
  // =========================================================
  const [leadId, setLeadId] = useState("");
  const [sessionIdLead, setSessionIdLead] = useState("");
  const [diagnosticoIdSalvo, setDiagnosticoIdSalvo] = useState("");
  const leadInicializadoRef = useRef(false);
  const ultimaAtualizacaoLeadRef = useRef("");

  const empresaPrincipal = empresas[0] || null;

  const avaliarHoldingAtiva =
    estruturaNegocio === "avaliar_holding";

  const trilhaHoldingAtiva =
    estruturaNegocio === "holding" ||
    avaliarHoldingAtiva;

  const trilhaPFAtiva =
    estruturaNegocio === "pessoa_fisica";

  const trilhaGrupoAtiva =
    estruturaNegocio === "grupo";

  const trilhaSPEAtiva =
    estruturaNegocio === "spe";

  // Regras de CNPJ por estrutura:
  // PF e avaliação de Holding não exigem CNPJ.
  // Holding existente e Grupo exigem CNPJ.
  // SPE exige CNPJ apenas quando já estiver constituída.
  const fluxoSemCnpj =
    trilhaPFAtiva ||
    avaliarHoldingAtiva ||
    (
      trilhaSPEAtiva &&
      speConstituida !== "sim"
    );

  const areasDaEstrutura =
    trilhaPFAtiva
      ? AREAS_PF
      : avaliarHoldingAtiva
      ? AREAS_AVALIAR_HOLDING
      : estruturaNegocio === "holding"
      ? AREAS_HOLDING
      : trilhaGrupoAtiva
      ? AREAS_GRUPO
      : trilhaSPEAtiva
      ? AREAS_SPE
      : AREAS;

  const doresDisponiveis =
    trilhaPFAtiva
      ? DORES_PF
      : trilhaHoldingAtiva
      ? DORES_HOLDING
      : trilhaGrupoAtiva
      ? DORES_GRUPO
      : trilhaSPEAtiva
      ? DORES_SPE
      : DORES_EVENTO;

  const impactosDisponiveis =
    trilhaPFAtiva
      ? IMPACTOS_PF
      : trilhaHoldingAtiva
      ? IMPACTOS_HOLDING
      : trilhaGrupoAtiva
      ? IMPACTOS_GRUPO
      : trilhaSPEAtiva
      ? IMPACTOS_SPE
      : IMPACTOS_DOR;

  const tituloContextoDiagnostico =
    trilhaPFAtiva
      ? "sua vida financeira"
      : trilhaHoldingAtiva
      ? (
          avaliarHoldingAtiva
            ? "sua necessidade de estrutura patrimonial"
            : "sua holding e estrutura patrimonial"
        )
      : "seu negócio";

  const perfilPF = {
    ativo: trilhaPFAtiva,
    objetivos: objetivosPF,
    rendaMensal: rendaMensalPF,
    gastosMensais: gastosMensaisPF,
    dividas: dividasPF,
    reservaEmergencia: reservaPF,
    patrimonio: patrimonioPF,
    investimentosAtuais: investimentosPF,
    aposentadoria: aposentadoriaPF,
    dependentes: dependentesPF,
  };

  const perfilHolding = {
    ativo: trilhaHoldingAtiva,
    estruturaNegocio,
    tipos: tiposHolding,
    objetivos: objetivosHolding,
    patrimonioAproximado: patrimonioHolding,
    receitasPatrimoniais: receitasHolding,
    situacaoSucessoria: sucessaoHolding,
  };

  const perfilGrupo = {
    ativo: trilhaGrupoAtiva,
    nomeGrupo,
    funcaoEmpresas: funcaoEmpresasGrupo,
    sociosComuns: sociosComunsGrupo,
    financeiroCentralizado: financeiroCentralizadoGrupo,
    pessoasCompartilhadas: pessoasCompartilhadasGrupo,
    operacoesIntercompany: operacoesIntercompanyGrupo,
    governanca: governancaGrupo,
  };

  const perfilSPE = {
    ativo: trilhaSPEAtiva,
    constituida: speConstituida,
    nomeProjeto: nomeProjetoSPE,
    finalidade: finalidadeSPE,
    sociosInvestidores: sociosSPE,
    valorProjeto: valorProjetoSPE,
    aportes: aportesSPE,
    financiamento: financiamentoSPE,
    prazo: prazoSPE,
    receitaPrevista: receitaPrevistaSPE,
    custosPrevistos: custosPrevistosSPE,
    faseProjeto: faseProjetoSPE,
  };

  const atividadesSelecionadasObjetos = cnaesEmpresa.filter((atividade) =>
    atividadesSelecionadas.includes(String(atividade.codigo))
  );

  const segmentoPredominante =
    atividadePredominante?.classificacao?.segmento ||
    segmentoPredominanteDe(empresas);

  const categoriaPrincipal =
    atividadePredominante?.classificacao?.categoria ||
    empresaPrincipal?.categoria ||
    "Serviços Profissionais";

  const codigoQuestionario =
    atividadePredominante?.classificacao?.codigoQuestionario ||
    empresaPrincipal?.codigoQuestionario ||
    null;

  const mapaAreaApiParaId = {
    "Marketing": "marketing",
    "Jurídico": "juridico",
    "Contábil / Fiscal": "contabilidade",
    "Contabilidade": "contabilidade",
    "Financeiro": "financeiro",
    "Financeiro PF/PJ": "financeiro",
    "Finanças pessoais": "financeiro",
    "Patrimônio / Financeiro": "financeiro",
    "Aposentadoria": "aposentadoria",
    "Investimentos": "investimentos",
    "Patrimônio": "patrimonio",
    "Proteção financeira": "protecao",
    "Organização / Planejamento": "organizacao",
    "Administrativo": "administrativo",
    "Gestão": "gestao",
    "Operacional": "operacional",
    "Pessoas": "rh",
    "Recursos Humanos": "rh",
    "Comercial": "comercial",
    "Comercial / Vendas": "comercial",
    "Tecnologia": "tecnologia",
    "Processos": "administrativo",
    "Atendimento": "comercial",
    "Custos": "financeiro",
    "Produção": "operacional",
    "Estoque": "operacional",
    "Compras": "operacional",
    "Logística": "operacional",
    "Qualidade": "operacional",
    "Contratos": "juridico",
    "LGPD": "tecnologia",
    "Segurança da Informação": "tecnologia",
  };

  const areasPrioritariasApi =
    atividadePredominante?.classificacao?.diagnostico?.areasPrioritarias ||
    empresaPrincipal?.areasPrioritarias ||
    [];
  const areasSugeridasApi = areasPrioritariasApi
    .map((nome) => mapaAreaApiParaId[nome])
    .filter(Boolean);

  const areasFallbackCategoria = CATEGORY_AREA_FALLBACK[categoriaPrincipal] || [];
  const areasSugeridas = [...new Set([...areasSugeridasApi, ...areasFallbackCategoria])];

  // EMPRESA OPERACIONAL:
  // se o usuário escolheu um ou mais departamentos, o checklist
  // deve conter SOMENTE esses departamentos.
  //
  // Demais estruturas especializadas continuam usando todos os
  // eixos estruturais do respectivo motor, pois nesses fluxos os
  // eixos fazem parte da avaliação da própria estrutura.
  const prioridadesDiagnostico =
    dores;

  const areasOperacionaisSelecionadas =
    prioridadesDiagnostico
      .map(
        normalizarAreaOperacionalId
      )
      .filter(
        (id) =>
          areasDaEstrutura.some(
            (area) =>
              area.id === id
          )
      );

  const areasDoDiagnostico =
    estruturaNegocio ===
      "operacional" &&
    areasOperacionaisSelecionadas.length >
      0
      ? areasOperacionaisSelecionadas
      : areasDaEstrutura.map(
          (item) => item.id
        );


  function normalizarAreaOperacionalId(
    id
  ) {
    const mapa = {
      contabilidade:
        "contabil_fiscal",
      contabil:
        "contabil_fiscal",
      fiscal:
        "contabil_fiscal",
      contabilidade_fiscal:
        "contabil_fiscal",
      recursos_humanos:
        "rh",
      vendas:
        "comercial",
      comercial_vendas:
        "comercial",
    };

    return (
      mapa[id] ||
      id
    );
  }

  function labelAreaAtual(id) {
    return (
      areasDaEstrutura.find(
        (item) => item.id === id
      )?.label ||
      areaLabel(id)
    );
  }

  function checklistBaseAtual(id) {
    if (
      trilhaPFAtiva &&
      CHECKLISTS_PF[id]
    ) {
      return CHECKLISTS_PF[id];
    }

    return CHECKLISTS[id] || null;
  }

  const gruposEstaticos = areasDoDiagnostico
    .filter(
      (id) =>
        checklistBaseAtual(id)
    )
    .map((id) => ({
      id,
      label:
        labelAreaAtual(id),
      subtemas:
        checklistEnxuto(
          checklistBaseAtual(id)
        ),
    }));

  const gruposDinamicos = [...new Set(
    perguntasDinamicas
      .map((q) => q.areaId)
      .filter(Boolean)
  )]
    .map((id) => {
      const perguntasArea =
        perguntasDinamicas.filter(
          (q) => q.areaId === id
        );

      if (!perguntasArea.length) {
        return null;
      }

      const temas = [
        ...new Set(
          perguntasArea.map(
            (q) =>
              q.tema ||
              "Diagnóstico específico"
          )
        ),
      ];

      return {
        id,
        label:
          perguntasArea[0]?.area ||
          labelAreaAtual(id),

        subtemas: temas.map(
          (tema) => ({
            tema,
            dica:
              `Aprofundar ${tema.toLowerCase()} dentro da estrutura ${estruturaNegocio}.`,

            perguntas:
              perguntasArea.filter(
                (q) =>
                  (
                    q.tema ||
                    "Diagnóstico específico"
                  ) === tema
              ),
          })
        ),
      };
    })
    .filter(Boolean);

  const gruposSelecionados = perguntasDinamicas.length > 0
    ? gruposDinamicos
    : gruposEstaticos;

  const todasPerguntas = gruposSelecionados.flatMap((g) => g.subtemas.flatMap((s) => s.perguntas));
  const todasRespondidas = todasPerguntas.length > 0 && todasPerguntas.every((q) => respostas[q.id]);

  // =========================================================
  // RASCUNHO AUTOMÁTICO — RESTAURAÇÃO E AUTOSAVE
  // =========================================================
  function limparRascunhoLocal() {
    try {
      localStorage.removeItem(
        CHAVE_RASCUNHO
      );
    } catch {}
  }

  function aplicarRascunho(
    rascunho
  ) {
    if (!rascunho) {
      return;
    }

    setStep(
      rascunho.step ||
      "intro"
    );

    setNome(
      rascunho.nome ||
      ""
    );

    setCargo(
      rascunho.cargo ||
      ""
    );

    setTelefone(
      rascunho.telefone ||
      ""
    );

    setEmail(
      rascunho.email ||
      ""
    );

    setConsentimentoEmail(
      rascunho.consentimentoEmail !==
        false
    );

    setCnpjInput(
      rascunho.cnpjInput ||
      ""
    );

    setEmpresas(
      Array.isArray(
        rascunho.empresas
      )
        ? rascunho.empresas
        : []
    );

    setCnaesEmpresa(
      Array.isArray(
        rascunho.cnaesEmpresa
      )
        ? rascunho.cnaesEmpresa
        : []
    );

    setAtividadesSelecionadas(
      Array.isArray(
        rascunho.atividadesSelecionadas
      )
        ? rascunho.atividadesSelecionadas
        : []
    );

    setAtividadePredominante(
      rascunho.atividadePredominante ||
      null
    );

    setDescricaoNegocio(
      rascunho.descricaoNegocio ||
      ""
    );

    setEstruturaNegocio(
      rascunho.estruturaNegocio ||
      "operacional"
    );

    setTiposHolding(
      Array.isArray(
        rascunho.tiposHolding
      )
        ? rascunho.tiposHolding
        : []
    );

    setObjetivosHolding(
      Array.isArray(
        rascunho.objetivosHolding
      )
        ? rascunho.objetivosHolding
        : []
    );

    setPatrimonioHolding(
      rascunho.patrimonioHolding ||
      ""
    );

    setReceitasHolding(
      rascunho.receitasHolding ||
      ""
    );

    setSucessaoHolding(
      rascunho.sucessaoHolding ||
      ""
    );

    setObjetivosPF(
      Array.isArray(
        rascunho.objetivosPF
      )
        ? rascunho.objetivosPF
        : []
    );

    setRendaMensalPF(
      rascunho.rendaMensalPF ||
      ""
    );

    setGastosMensaisPF(
      rascunho.gastosMensaisPF ||
      ""
    );

    setDividasPF(
      rascunho.dividasPF ||
      ""
    );

    setReservaPF(
      rascunho.reservaPF ||
      ""
    );

    setPatrimonioPF(
      rascunho.patrimonioPF ||
      ""
    );

    setInvestimentosPF(
      rascunho.investimentosPF ||
      ""
    );

    setAposentadoriaPF(
      rascunho.aposentadoriaPF ||
      ""
    );

    setDependentesPF(
      rascunho.dependentesPF ||
      ""
    );

    setNomeGrupo(
      rascunho.nomeGrupo ||
      ""
    );

    setFuncaoEmpresasGrupo(
      rascunho.funcaoEmpresasGrupo ||
      ""
    );

    setSociosComunsGrupo(
      rascunho.sociosComunsGrupo ||
      ""
    );

    setFinanceiroCentralizadoGrupo(
      rascunho.financeiroCentralizadoGrupo ||
      ""
    );

    setPessoasCompartilhadasGrupo(
      rascunho.pessoasCompartilhadasGrupo ||
      ""
    );

    setOperacoesIntercompanyGrupo(
      rascunho.operacoesIntercompanyGrupo ||
      ""
    );

    setGovernancaGrupo(
      rascunho.governancaGrupo ||
      ""
    );

    setSpeConstituida(
      rascunho.speConstituida ||
      ""
    );

    setNomeProjetoSPE(
      rascunho.nomeProjetoSPE ||
      ""
    );

    setFinalidadeSPE(
      rascunho.finalidadeSPE ||
      ""
    );

    setSociosSPE(
      rascunho.sociosSPE ||
      ""
    );

    setValorProjetoSPE(
      rascunho.valorProjetoSPE ||
      ""
    );

    setAportesSPE(
      rascunho.aportesSPE ||
      ""
    );

    setFinanciamentoSPE(
      rascunho.financiamentoSPE ||
      ""
    );

    setPrazoSPE(
      rascunho.prazoSPE ||
      ""
    );

    setReceitaPrevistaSPE(
      rascunho.receitaPrevistaSPE ||
      ""
    );

    setCustosPrevistosSPE(
      rascunho.custosPrevistosSPE ||
      ""
    );

    setFaseProjetoSPE(
      rascunho.faseProjetoSPE ||
      ""
    );

    setPerguntasDinamicas(
      Array.isArray(
        rascunho.perguntasDinamicas
      )
        ? rascunho.perguntasDinamicas
        : []
    );

    setNegocioInterpretado(
      rascunho.negocioInterpretado ||
      null
    );

    setFaturamento(
      rascunho.faturamento ??
      null
    );

    setColaboradores(
      rascunho.colaboradores ??
      null
    );

    setRegime(
      rascunho.regime ??
      null
    );

    setObservacao(
      rascunho.observacao ||
      ""
    );

    setDores(
      Array.isArray(
        rascunho.dores
      )
        ? rascunho.dores
        : []
    );

    setDoresSelecionadas(
      Array.isArray(
        rascunho.doresSelecionadas
      )
        ? rascunho.doresSelecionadas
        : []
    );

    setDor90Dias(
      rascunho.dor90Dias ||
      ""
    );

    setImpactosDor(
      Array.isArray(
        rascunho.impactosDor
      )
        ? rascunho.impactosDor
        : []
    );

    setRespostas(
      rascunho.respostas &&
      typeof rascunho.respostas ===
        "object"
        ? rascunho.respostas
        : {}
    );

    if (
      rascunho.leadId
    ) {
      setLeadId(
        rascunho.leadId
      );
    }

    if (
      rascunho.sessionIdLead
    ) {
      setSessionIdLead(
        rascunho.sessionIdLead
      );

      try {
        sessionStorage.setItem(
          "finder_diagnostico_session_id",
          rascunho.sessionIdLead
        );

        localStorage.setItem(
          "finder_diagnostico_session_id",
          rascunho.sessionIdLead
        );
      } catch {}
    }
  }

  useEffect(() => {
    try {
      const bruto =
        localStorage.getItem(
          CHAVE_RASCUNHO
        );

      if (!bruto) {
        setRetomadaDecidida(
          true
        );
        return;
      }

      const salvo =
        JSON.parse(
          bruto
        );

      const atualizadoEm =
        Number(
          salvo?.atualizadoEm ||
          0
        );

      const expirado =
        !atualizadoEm ||
        Date.now() -
          atualizadoEm >
          PRAZO_RASCUNHO_MS;

      const concluido =
        salvo?.concluido ===
          true ||
        salvo?.step ===
          "resultado";

      if (
        expirado ||
        concluido
      ) {
        limparRascunhoLocal();
        setRetomadaDecidida(
          true
        );
        return;
      }

      setRascunhoPendente(
        salvo
      );
    } catch {
      limparRascunhoLocal();
      setRetomadaDecidida(
        true
      );
    }
  }, []);

  useEffect(() => {
    if (
      !retomadaDecidida
    ) {
      return;
    }

    if (
      step ===
      "resultado"
    ) {
      limparRascunhoLocal();
      return;
    }

    const rascunho = {
      versao: 1,
      atualizadoEm:
        Date.now(),
      concluido: false,

      step,
      nome,
      cargo,
      telefone,
      email,
      consentimentoEmail,
      cnpjInput,
      empresas,
      cnaesEmpresa,
      atividadesSelecionadas,
      atividadePredominante,
      descricaoNegocio,
      estruturaNegocio,
      tiposHolding,
      objetivosHolding,
      patrimonioHolding,
      receitasHolding,
      sucessaoHolding,

      objetivosPF,
      rendaMensalPF,
      gastosMensaisPF,
      dividasPF,
      reservaPF,
      patrimonioPF,
      investimentosPF,
      aposentadoriaPF,
      dependentesPF,

      nomeGrupo,
      funcaoEmpresasGrupo,
      sociosComunsGrupo,
      financeiroCentralizadoGrupo,
      pessoasCompartilhadasGrupo,
      operacoesIntercompanyGrupo,
      governancaGrupo,

      speConstituida,
      nomeProjetoSPE,
      finalidadeSPE,
      sociosSPE,
      valorProjetoSPE,
      aportesSPE,
      financiamentoSPE,
      prazoSPE,
      receitaPrevistaSPE,
      custosPrevistosSPE,
      faseProjetoSPE,

      perguntasDinamicas,
      negocioInterpretado,
      faturamento,
      colaboradores,
      regime,
      observacao,
      dores,
      doresSelecionadas,
      dor90Dias,
      impactosDor,
      respostas,

      leadId,
      sessionIdLead,
    };

    const timer =
      setTimeout(
        () => {
          try {
            localStorage.setItem(
              CHAVE_RASCUNHO,
              JSON.stringify(
                rascunho
              )
            );
          } catch {}
        },
        350
      );

    return () =>
      clearTimeout(
        timer
      );
  }, [
    retomadaDecidida,
    step,
    nome,
    cargo,
    telefone,
    email,
    consentimentoEmail,
    cnpjInput,
    empresas,
    cnaesEmpresa,
    atividadesSelecionadas,
    atividadePredominante,
    descricaoNegocio,
    estruturaNegocio,
    tiposHolding,
    objetivosHolding,
    patrimonioHolding,
    receitasHolding,
    sucessaoHolding,
    objetivosPF,
    rendaMensalPF,
    gastosMensaisPF,
    dividasPF,
    reservaPF,
    patrimonioPF,
    investimentosPF,
    aposentadoriaPF,
    dependentesPF,
    nomeGrupo,
    funcaoEmpresasGrupo,
    sociosComunsGrupo,
    financeiroCentralizadoGrupo,
    pessoasCompartilhadasGrupo,
    operacoesIntercompanyGrupo,
    governancaGrupo,
    speConstituida,
    nomeProjetoSPE,
    finalidadeSPE,
    sociosSPE,
    valorProjetoSPE,
    aportesSPE,
    financiamentoSPE,
    prazoSPE,
    receitaPrevistaSPE,
    custosPrevistosSPE,
    faseProjetoSPE,
    perguntasDinamicas,
    negocioInterpretado,
    faturamento,
    colaboradores,
    regime,
    observacao,
    dores,
    doresSelecionadas,
    dor90Dias,
    impactosDor,
    respostas,
    leadId,
    sessionIdLead,
  ]);

  function continuarRascunho() {
    aplicarRascunho(
      rascunhoPendente
    );

    setRascunhoPendente(
      null
    );

    setRetomadaDecidida(
      true
    );
  }

  function comecarNovamente() {
    limparRascunhoLocal();

    setRascunhoPendente(
      null
    );

    setRetomadaDecidida(
      true
    );

    setStep(
      "intro"
    );
  }

  // =========================================================
  // CRM — REGISTRA O ACESSO ASSIM QUE O CLIENTE ABRE O LINK
  // =========================================================
  useEffect(() => {
    if (leadInicializadoRef.current) {
      return;
    }

    leadInicializadoRef.current = true;

    let cancelado = false;

    async function iniciarSessaoLead() {
      try {
        const params = new URLSearchParams(
          window.location.search
        );

        const origem =
          params.get("origem") ||
          params.get("utm_source") ||
          "direto";

        const campanha =
          params.get("campanha") ||
          params.get("utm_campaign") ||
          "";

        const promoter =
          params.get("promoter") ||
          "";

        const utmSource =
          params.get("utm_source") ||
          "";

        const utmMedium =
          params.get("utm_medium") ||
          "";

        const utmCampaign =
          params.get("utm_campaign") ||
          "";

        const utmContent =
          params.get("utm_content") ||
          "";

        const utmTerm =
          params.get("utm_term") ||
          "";

        const chaveSessao =
          "finder_diagnostico_session_id";

        let sessionId =
          sessionStorage.getItem(
            chaveSessao
          ) ||
          localStorage.getItem(
            chaveSessao
          ) ||
          "";

        if (!sessionId) {
          const uuid =
            typeof crypto !== "undefined" &&
            typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `${Date.now()}_${Math.random()
                  .toString(36)
                  .slice(2)}`;

          sessionId =
            `sessao_${uuid}`;

          sessionStorage.setItem(
            chaveSessao,
            sessionId
          );

          localStorage.setItem(
            chaveSessao,
            sessionId
          );
        }

        setSessionIdLead(
          sessionId
        );

        const resposta =
          await fetch(
            "/api/crm?action=iniciar",
            {
              method: "POST",

              headers: {
                "content-type":
                  "application/json",
              },

              body: JSON.stringify({
                sessionId,

                origem,
                campanha,
                promoter,

                utm_source:
                  utmSource,

                utm_medium:
                  utmMedium,

                utm_campaign:
                  utmCampaign,

                utm_content:
                  utmContent,

                utm_term:
                  utmTerm,

                referrer:
                  document.referrer ||
                  "",
              }),
            }
          );

        const data =
          await resposta
            .json()
            .catch(() => null);

        if (
          !resposta.ok ||
          !data?.sucesso
        ) {
          console.warn(
            "[CRM] Não foi possível registrar o acesso:",
            data
          );

          return;
        }

        if (cancelado) {
          return;
        }

        setLeadId(
          data.leadId ||
          ""
        );

        if (
          data.sessionId &&
          data.sessionId !==
            sessionId
        ) {
          sessionStorage.setItem(
            chaveSessao,
            data.sessionId
          );

          localStorage.setItem(
            chaveSessao,
            data.sessionId
          );

          setSessionIdLead(
            data.sessionId
          );
        }

        console.info(
          "[CRM] Lead registrado:",
          {
            leadId:
              data.leadId,

            sessionId:
              data.sessionId,

            origem:
              data.origem ||
              origem,

            campanha:
              data.campanha ||
              campanha,

            statusDiagnostico:
              data.statusDiagnostico,

            statusComercial:
              data.statusComercial,
          }
        );
      } catch (erro) {
        console.warn(
          "[CRM] Falha ao iniciar sessão do lead:",
          erro
        );
      }
    }

    iniciarSessaoLead();

    return () => {
      cancelado = true;
    };
  }, []);

  async function atualizarLeadCRM(dados = {}) {
    const identificadorLead =
      leadId ||
      "";

    const identificadorSessao =
      sessionIdLead ||
      sessionStorage.getItem(
        "finder_diagnostico_session_id"
      ) ||
      "";

    if (
      !identificadorLead &&
      !identificadorSessao
    ) {
      return;
    }

    try {
      const resposta =
        await fetch(
          "/api/crm?action=atualizar",
          {
            method: "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body: JSON.stringify({
              leadId:
                identificadorLead,

              sessionId:
                identificadorSessao,

              ...dados,
            }),
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => null);

      if (
        !resposta.ok ||
        !data?.sucesso
      ) {
        console.warn(
          "[CRM] Falha ao atualizar lead:",
          data
        );

        return;
      }

      if (
        data?.lead?.leadId &&
        !leadId
      ) {
        setLeadId(
          data.lead.leadId
        );
      }
    } catch (erro) {
      console.warn(
        "[CRM] Erro ao atualizar lead:",
        erro
      );
    }
  }

  async function classificarLeadCRM({
    scoreDiagnostico,
    nivelDiagnostico,
    faturamentoAnual,
    dores,
    notaSatisfacao,
    intencao,
  } = {}) {
    const identificadorLead =
      leadId ||
      "";

    const identificadorSessao =
      sessionIdLead ||
      sessionStorage.getItem(
        "finder_diagnostico_session_id"
      ) ||
      "";

    if (
      !identificadorLead &&
      !identificadorSessao
    ) {
      console.warn(
        "[CRM] Classificação comercial ignorada: lead não identificado."
      );

      return null;
    }

    try {
      const resposta =
        await fetch(
          "/api/crm?action=classificar",
          {
            method: "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body: JSON.stringify({
              leadId:
                identificadorLead,

              sessionId:
                identificadorSessao,

              scoreDiagnostico:
                Number(
                  scoreDiagnostico
                ) || 0,

              nivelDiagnostico:
                nivelDiagnostico ||
                "",

              faturamentoAnual:
                Number(
                  faturamentoAnual
                ) || 0,

              dores:
                Array.isArray(
                  dores
                )
                  ? dores
                  : [],

              notaSatisfacao:
                notaSatisfacao ??
                undefined,

              intencao:
                intencao ??
                undefined,
            }),
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => null);

      if (
        !resposta.ok ||
        !data?.sucesso
      ) {
        console.warn(
          "[CRM] Não foi possível classificar o lead:",
          data
        );

        return null;
      }

      console.info(
        "[CRM] Lead classificado:",
        {
          scoreComercial:
            data.scoreComercial,

          prioridade:
            data.prioridade,

          temperatura:
            data.temperatura,

          prazoAtendimento:
            data.prazoAtendimento,

          proximaAcao:
            data.proximaAcao,

          motivos:
            data.motivos,
        }
      );

      return data;
    } catch (erro) {
      console.warn(
        "[CRM] Erro na classificação comercial:",
        erro
      );

      return null;
    }
  }

  async function criarAtendimentosDepartamentoCRM({
    diagnosticoId,
    areas,
  } = {}) {
    const idDiagnostico =
      String(
        diagnosticoId ||
        ""
      ).trim();

    const identificadorLead =
      leadId ||
      "";

    if (!idDiagnostico) {
      console.warn(
        "[CRM] Atendimentos por departamento não criados: diagnóstico sem ID."
      );

      return null;
    }

    const areasValidas =
      Array.isArray(areas)
        ? areas.filter(
            (item) =>
              item &&
              item.area
          )
        : [];

    if (
      areasValidas.length === 0
    ) {
      console.warn(
        "[CRM] Atendimentos por departamento não criados: nenhuma área elegível."
      );

      return null;
    }

    try {
      const resposta =
        await fetch(
          "/api/crm?action=criar-atendimentos",
          {
            method: "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body: JSON.stringify({
              diagnosticoId:
                idDiagnostico,

              leadId:
                identificadorLead,

              areas:
                areasValidas,
            }),
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => null);

      if (
        !resposta.ok ||
        !data?.sucesso
      ) {
        const mensagem =
          data?.error ||
          "Não foi possível criar atendimentos por departamento.";

        console.error(
          "[CRM] Falha ao criar atendimentos:",
          {
            status: resposta.status,
            diagnosticoId: idDiagnostico,
            totalAreas: areasValidas.length,
            resposta: data,
          }
        );

        throw new Error(
          mensagem
        );
      }

      console.info(
        "[CRM] Atendimentos por departamento criados:",
        {
          diagnosticoId:
            idDiagnostico,

          total:
            data.total || 0,

          areas:
            areasValidas.map(
              (item) =>
                item.area
            ),
        }
      );

      return data;
    } catch (erro) {
      console.warn(
        "[CRM] Erro ao criar atendimentos por departamento:",
        erro
      );

      return null;
    }
  }

  function progressoDoDiagnostico() {
    const progressoBase = {
      intro: 0,
      cadastro: 10,
      estrutura: 18,
      cnpj: 28,
      porte: 40,
      dor: 52,
      gerandoPerguntas: 60,
      confirmarNegocio: 65,
      checklist: 70,
      analisando: 95,
      resultado: 100,
    };

    if (
      step === "checklist" &&
      todasPerguntas.length > 0
    ) {
      const respondidas =
        todasPerguntas.filter(
          (q) =>
            Boolean(
              respostas[q.id]
            )
        ).length;

      const proporcao =
        respondidas /
        todasPerguntas.length;

      return Math.round(
        70 +
        proporcao * 20
      );
    }

    return progressoBase[step] ?? 0;
  }

  // =========================================================
  // CRM — ATUALIZA STATUS, PROGRESSO E DADOS CONHECIDOS
  // =========================================================
  useEffect(() => {
    if (
      !leadId &&
      !sessionIdLead
    ) {
      return;
    }

    const progresso =
      progressoDoDiagnostico();

    const statusDiagnostico =
      step === "intro"
        ? "ACESSOU"
        : step === "resultado"
        ? "CONCLUIDO"
        : "EM_PREENCHIMENTO";

    const payload = {
      statusDiagnostico,

      etapaAtual:
        String(step || "")
          .toUpperCase(),

      progressoPercentual:
        progresso,

      nome:
        nome || "",

      email:
        email || "",

      telefone:
        telefone || "",

      cnpj:
        empresaPrincipal?.cnpjDigits ||
        "",

      razaoSocial:
        empresaPrincipal?.razao ||
        "",

      diagnosticoId:
        diagnosticoIdSalvo ||
        "",

      estruturaNegocio,

      contextoCliente: {
        estruturaNegocio,
        holding: perfilHolding,
        pessoaFisica: perfilPF,
      },
    };

    const assinatura =
      JSON.stringify(
        payload
      );

    if (
      ultimaAtualizacaoLeadRef.current ===
      assinatura
    ) {
      return;
    }

    ultimaAtualizacaoLeadRef.current =
      assinatura;

    const timer =
      setTimeout(
        () => {
          atualizarLeadCRM(
            payload
          );
        },
        250
      );

    return () =>
      clearTimeout(timer);
  }, [
    step,
    leadId,
    sessionIdLead,
    nome,
    email,
    telefone,
    empresaPrincipal?.cnpjDigits,
    empresaPrincipal?.razao,
    diagnosticoIdSalvo,
    estruturaNegocio,
    tiposHolding,
    objetivosHolding,
    patrimonioHolding,
    receitasHolding,
    sucessaoHolding,
    objetivosPF,
    rendaMensalPF,
    gastosMensaisPF,
    dividasPF,
    reservaPF,
    patrimonioPF,
    investimentosPF,
    aposentadoriaPF,
    dependentesPF,
    todasPerguntas.length,
    respostas,
  ]);

  useEffect(() => {
    if (
      step !== "analisando" ||
      (
        !fluxoSemCnpj &&
        !empresaPrincipal
      ) ||
      gruposSelecionados.length === 0
    ) {
      return;
    }

    let cancelado = false;
    const labels = gruposSelecionados.map((g) => g.label);
    const msgs =
      trilhaPFAtiva
        ? [
            `Objetivos: ${
              objetivosPF
                .map(
                  (id) =>
                    OBJETIVOS_PF.find(
                      (item) =>
                        item.id === id
                    )?.label
                )
                .filter(Boolean)
                .join(", ")
            }`,
            `Analisando: ${labels.join(", ")}`,
            "Cruzando respostas com renda, gastos, reserva e prioridades",
            "Organizando riscos e oportunidades financeiras",
            "Montando próximos passos personalizados",
          ]
        : [
            `Atividade-base: ${atividadePredominante?.descricao || categoriaPrincipal}`,
            `Aprofundando prioridades: ${prioridadesDiagnostico.map(labelAreaAtual).join(", ") || "visão geral"}`,
            "Cruzando respostas com o contexto do segmento",
            "Estimando carga tributária de referência",
            "Calculando índice de maturidade por departamento",
          ];

    setMsgIdx(0);
    const interval = setInterval(
      () => setMsgIdx((i) => Math.min(i + 1, msgs.length - 1)),
      500
    );

    const payload = {
      responsavel: { nome, cargo, telefone, email },
      segmento:
        trilhaPFAtiva
          ? "Pessoa Física / Consultoria Financeira"
          : segmentoPredominante,

      categoria:
        trilhaPFAtiva
          ? (
              objetivosPF
                .map(
                  (id) =>
                    OBJETIVOS_PF.find(
                      (item) =>
                        item.id === id
                    )?.label
                )
                .filter(Boolean)
                .join(" + ") ||
              "Pessoa Física"
            )
          : categoriaPrincipal,

      codigoQuestionario:
        trilhaPFAtiva
          ? "PF_CONSULTORIA"
          : codigoQuestionario,
      cnaePrincipal: empresaPrincipal?.cnaePrincipal || null,
      cnaesSecundarios: empresaPrincipal?.cnaesSecundarios || [],
      atividadesSelecionadas: atividadesSelecionadasObjetos,
      atividadePredominante,
      empresas:
        fluxoSemCnpj
          ? []
          : empresas.map((e) => ({
              razao: e.razao,
              categoria: e.categoria,
              segmento: e.segmento,
              cnae: e.cnae,
            })),

      faturamento:
        trilhaPFAtiva
          ? ""
          : faturamento?.label,

      colaboradores:
        trilhaPFAtiva
          ? ""
          : colaboradores,

      regime:
        trilhaPFAtiva
          ? ""
          : regime,
      observacao,
      descricaoNegocio,
      negocioInterpretado,

      estruturaNegocio,

      contextoEstrutura: {
        estruturaNegocio,
        holding: perfilHolding,
        pessoaFisica: perfilPF,
        grupo: perfilGrupo,
        spe: perfilSPE,
      },

      holding: perfilHolding,
      pessoaFisica: perfilPF,
      grupo: perfilGrupo,
      spe: perfilSPE,

      doresSelecionadas,

      prioridadesSelecionadas:
        prioridadesDiagnostico.map(
          (id) => ({
            id,
            label:
              labelAreaAtual(id),
          })
        ),

      // No relatório da EMPRESA OPERACIONAL, o escopo deve ser
      // exatamente o conjunto de departamentos selecionados.
      // Isso mantém checklist, IA e relatório no mesmo escopo.
      eixosObrigatorios:
        (
          estruturaNegocio ===
            "operacional" &&
          areasOperacionaisSelecionadas.length >
            0
            ? areasDaEstrutura.filter(
                (item) =>
                  areasOperacionaisSelecionadas.includes(
                    normalizarAreaOperacionalId(
                      item.id
                    )
                  )
              )
            : areasDaEstrutura
        ).map(
          (item) => ({
            id:
              item.id,
            label:
              item.label,
          })
        ),

      dorPrincipal: doresSelecionadas[0] || "",
      dor90Dias,
      impactosDor,
      areas: gruposSelecionados.map((g) => ({
        id: g.id,
        area: g.label,

        prioridade:
          prioridadesDiagnostico.includes(
            g.id
          ),

        score: scoreDe(g.subtemas.flatMap((s) => s.perguntas)),
        subtemas: g.subtemas.map((s) => ({
          tema: s.tema,
          perguntas: s.perguntas.map((q) => ({
            id: q.id,
            texto: textoDe(q, segmentoPredominante, categoriaPrincipal),
            tema: q.tema || "",
            motivo: q.motivo || "",
            riscoAvaliado: q.risco || "",
            importancia: q.importancia || 1,
            resposta: respostas[q.id],
          })),
        })),
      })),
      scoreGeral: scoreDe(todasPerguntas),
    };

    relatorioEnviadoRef.current =
      false;

    setEnvioRelatorio(
      "idle"
    );

    const chamadaIA =
      fetch(
        "/api/diagnostico",
        {
          method:
            "POST",
          headers: {
            "content-type":
              "application/json",
          },
          body:
            JSON.stringify(
              payload
            ),
        }
      )
        .then(
          async (
            r
          ) => {
            if (!r.ok) {
              const erro =
                await r
                  .json()
                  .catch(
                    () =>
                      null
                  );

              console.error(
                "Erro diagnóstico:",
                erro
              );

              return {
                sucesso:
                  false,
                error:
                  erro?.error ||
                  "Não foi possível gerar o diagnóstico.",
              };
            }

            return r.json();
          }
        )
        .catch(
          (
            erro
          ) => {
            console.error(
              "Erro ao chamar diagnóstico:",
              erro
            );

            return {
              sucesso:
                false,
              error:
                erro?.message ||
                "Não foi possível gerar o diagnóstico.",
            };
          }
        );

    chamadaIA.then((data) => {
      if (cancelado) return;

      const diagnostico =
        data?.diagnostico ||
        data?.resultado ||
        null;

      // Nunca abre a tela de resultado sem um diagnóstico válido.
      // Isso evita relatório operacional em branco/incompleto quando
      // a API ou a IA falhar.
      if (!diagnostico) {
        console.error(
          "[diagnostico] resposta inválida:",
          data
        );

        showToast(
          data?.error ||
          "Não foi possível gerar o diagnóstico. Tente novamente."
        );

        setStep("checklist");
        return;
      }

      if (diagnostico) {
        const mapa = {};

        const eixos =
          Array.isArray(
            diagnostico.eixos
          )
            ? diagnostico.eixos
            : [];

        eixos.forEach(
          (eixo) => {
            const label =
              textoIaSeguro(
                eixo.label
              ) ||
              labelAreaAtual(
                eixo.id
              );

            const achadosSeguros =
              listaIaSegura(
                eixo.achados
              );

            mapa[label] = {
              area:
                label,

              areaId:
                textoIaSeguro(
                  eixo.id
                ),

              score:
                Number(
                  eixo.score
                ) || 0,

              nivel:
                textoIaSeguro(
                  eixo.nivel
                ),

              resumo:
                achadosSeguros.join(
                  " "
                ),

              achados:
                achadosSeguros,

              riscos:
                listaIaSegura(
                  eixo.riscos
                ),

              pontosFortes:
                listaIaSegura(
                  eixo.pontosFortes
                ),

              recomendacoes:
                listaIaSegura(
                  eixo.recomendacoes
                ),
            };
          }
        );

        const novoIaResultado = {
          areas:
            mapa,

          diagnosticoGeral: {
            resumoExecutivo:
              textoIaSeguro(
                diagnostico.leituraExecutiva
              ),

            principaisDores:
              listaIaSegura(
                diagnostico.doresPrincipais
              ),

            pontosFortes:
              listaIaSegura(
                diagnostico.pontosFortes
              ),

            prioridadesImediatas:
              listaIaSegura(
                diagnostico.prioridades
              ),

            oportunidades:
              listaIaSegura(
                diagnostico.recomendacoes
              ),

            causasProvaveis:
              listaIaSegura(
                diagnostico.causasProvaveis
              ),

            impactos:
              listaIaSegura(
                diagnostico.impactos
              ),

            proximosPassos:
              listaIaSegura(
                diagnostico.proximosPassos
              ),

            leituraDaDor:
              textoIaSeguro(
                diagnostico.leituraExecutiva
              ),

            alertaEstrategico:
              listaIaSegura(
                diagnostico.riscosPrioritarios
              )[0] ||
              "",
          },

          visaoGrupo:
            estruturaNegocio ===
            "grupo"
              ? diagnostico
              : null,

          lacunasDiagnostico:
            listaIaSegura(
              diagnostico.informacoesFaltantes
            ),

          oportunidadesConsultoria:
            listaIaSegura(
              diagnostico
                ?.visaoAdministracao
                ?.oportunidades
            ),

          plano90Dias:
            diagnostico.plano90Dias ||
            null,

          quickWins:
            listaIaSegura(
              diagnostico.quickWins
            ),

          kpisRecomendados:
            listaIaSegura(
              diagnostico.indicadores
            ),

          perguntasAprofundamento:
            listaIaSegura(
              diagnostico.informacoesFaltantes
            ),

          visaoConsultor:
            diagnostico.visaoAdministracao ||
            null,

          visaoComercial:
            diagnostico.visaoAdministracao ||
            null,

          contextoInterpretado: {
            estruturaNegocio,
            estruturaLabel:
              diagnostico.estruturaLabel ||
              "",
          },

          resultadoCompleto:
            diagnostico,

          modelo:
            data.motor ||
            "",
        };

        setIaResultado(
          novoIaResultado
        );

        setStep(
          "resultado"
        );

        enviarRelatorioPorEmail(
          novoIaResultado
        ).then(
          (salvou) => {
            if (!salvou) {
              console.error(
                "[relatorio-final] Diagnóstico exibido, mas relatório não salvo."
              );

              showToast(
                "Diagnóstico gerado, mas houve falha ao salvar o relatório."
              );
            }
          }
        );
      }
    });

    return () => {
      cancelado = true;
      clearInterval(interval);
    };
  }, [step]);
  function toggleTipoHolding(id) {
    setTiposHolding((atuais) =>
      atuais.includes(id)
        ? atuais.filter((item) => item !== id)
        : [...atuais, id]
    );
  }

  function toggleObjetivoHolding(valor) {
    setObjetivosHolding((atuais) =>
      atuais.includes(valor)
        ? atuais.filter((item) => item !== valor)
        : [...atuais, valor]
    );
  }

  function toggleObjetivoPF(id) {
    setObjetivosPF((atuais) =>
      atuais.includes(id)
        ? atuais.filter((item) => item !== id)
        : [...atuais, id]
    );
  }

  function toggleDorSelecionada(valor) {
    setDoresSelecionadas((prev) =>
      prev.includes(valor)
        ? prev.filter((item) => item !== valor)
        : [...prev, valor]
    );
  }


  function interpretacaoNegocioSegura(valor) {
    const recebido =
      valor &&
      typeof valor === "object"
        ? valor
        : {};

    const descricao =
      String(
        descricaoNegocio ||
        ""
      ).trim();

    const atividade =
      String(
        empresaPrincipal?.cnaePrincipal?.descricao ||
        categoriaPrincipal ||
        ""
      ).trim();

    const descricaoLower =
      descricao.toLowerCase();

    let subsegmentoFallback =
      descricao ||
      atividade ||
      "Empresa operacional";

    let modeloFallback =
      descricao
        ? `Operação de ${descricao}, com processos recorrentes de atendimento, execução, controle e entrega ao cliente.`
        : atividade
        ? `Operação relacionada a ${atividade}.`
        : "Operação empresarial a ser detalhada no diagnóstico.";

    if (
      descricaoLower.includes("contabil") ||
      atividade.toLowerCase().includes("contabil")
    ) {
      subsegmentoFallback =
        "Escritório de contabilidade";

      modeloFallback =
        "Prestação recorrente de serviços contábeis, fiscais, trabalhistas e de atendimento a empresas, com rotinas de fechamento, apuração, obrigações e relacionamento com clientes.";
    }

    return {
      segmento:
        String(
          recebido.segmento ||
          categoriaPrincipal ||
          "Serviços"
        ).trim(),

      subsegmento:
        String(
          recebido.subsegmento ||
          recebido.resumo ||
          subsegmentoFallback
        ).trim(),

      modeloOperacional:
        String(
          recebido.modeloOperacional ||
          recebido.modelo ||
          modeloFallback
        ).trim(),

      justificativa:
        String(
          recebido.justificativa ||
          (
            descricao
              ? `Interpretação baseada na descrição informada: "${descricao}".`
              : atividade
              ? `Interpretação baseada na atividade principal: ${atividade}.`
              : ""
          )
        ).trim(),

      riscosNaturais:
        Array.isArray(
          recebido.riscosNaturais
        )
          ? recebido.riscosNaturais
          : [],
    };
  }

  function perguntaServeParaSimParcialNao(textoPergunta) {
    const original =
      String(
        textoPergunta ||
        ""
      ).trim();

    const valor =
      original
        .toLowerCase()
        .normalize("NFD")
        .replace(
          /[\u0300-\u036f]/g,
          ""
        );

    if (!valor) return false;

    const proibidos = [
      "quais ",
      "qual ",
      "como ",
      "por que ",
      "porque ",
      "descreva",
      "explique",
      "informe",
      "forneca",
      "detalhe",
      "liste",
      "cite ",
      "envie",
      "se sim",
      "se nao",
      "quanto ",
      "quando ",
      "exemplo",
      "e para cada",
      "principais causas",
      "e quais",
    ];

    if (
      proibidos.some(
        (item) =>
          valor.includes(item)
      )
    ) {
      return false;
    }

    if (
      (
        original.match(/\?/g) ||
        []
      ).length > 1
    ) {
      return false;
    }

    if (original.length > 220) {
      return false;
    }

    return true;
  }

  async function gerarPerguntasPersonalizadas() {
    if (
      !fluxoSemCnpj &&
      !empresaPrincipal
    ) {
      showToast("Adicione pelo menos um CNPJ.");
      return;
    }

    if (
      !fluxoSemCnpj &&
      descricaoNegocio.trim().length < 20
    ) {
      showToast("Descreva brevemente o que o negócio realmente faz.");
      return;
    }

    if (
      !fluxoSemCnpj &&
      !atividadePredominante
    ) {
      showToast("Selecione a atividade predominante.");
      return;
    }

    if (dores.length === 0) {
      showToast("Selecione pelo menos uma área para analisar.");
      return;
    }

    setGerandoPerguntas(true);
    setErroPerguntas("");
    setStep("gerandoPerguntas");

    const payload = {
      segmentoAtual:
        trilhaHoldingAtiva
          ? "Holding / Estrutura Patrimonial"
          : trilhaPFAtiva
          ? "Pessoa Física / Consultoria Financeira"
          : segmentoPredominante,

      categoriaAtual:
        trilhaHoldingAtiva
          ? (
              tiposHolding
                .map(
                  (id) =>
                    TIPOS_HOLDING.find(
                      (tipo) =>
                        tipo.id === id
                    )?.label
                )
                .filter(Boolean)
                .join(" + ") ||
              "Holding"
            )
          : trilhaPFAtiva
          ? (
              objetivosPF
                .map(
                  (id) =>
                    OBJETIVOS_PF.find(
                      (objetivo) =>
                        objetivo.id === id
                    )?.label
                )
                .filter(Boolean)
                .join(" + ") ||
              "Pessoa Física"
            )
          : categoriaPrincipal,
      cnaePrincipal: empresaPrincipal?.cnaePrincipal || null,
      cnaesSecundarios: empresaPrincipal?.cnaesSecundarios || [],
      atividadesSelecionadas: atividadesSelecionadasObjetos,
      atividadePredominante,
      descricaoNegocio: descricaoNegocio.trim(),
      estruturaNegocio,

      contextoEstrutura: {
        estruturaNegocio,
        holding: perfilHolding,
        pessoaFisica: perfilPF,
        grupo: perfilGrupo,
        spe: perfilSPE,
      },

      holding: perfilHolding,
      pessoaFisica: perfilPF,
      grupo: perfilGrupo,
      spe: perfilSPE,

      instrucoesEspeciais: trilhaHoldingAtiva
        ? [
            "Tratar a holding como estrutura especializada, e não como simples empresa de serviços.",
            "Investigar patrimônio, imóveis, participações societárias, receitas patrimoniais, governança, sucessão e tributação.",
            "Diferenciar holding patrimonial, familiar/sucessória, participações/controle, pura e mista conforme as respostas.",
            "Não presumir que constituir holding é vantajoso; admitir conclusão de que a estrutura não é recomendada sem estudo adicional.",
            "Na Reforma Tributária, separar locação, venda, administração, intermediação e demais operações imobiliárias antes de qualquer projeção.",
            "As perguntas devem partir das dores específicas selecionadas pelo usuário e não de um checklist empresarial genérico.",
            "Se o usuário escolheu 'Quero avaliar se uma holding faz sentido', não presumir que já existe CNPJ nem que uma holding será recomendada. O objetivo é avaliar viabilidade e necessidade.",
            "Nesse caso, perguntar sobre quantidade e tipo de bens, titularidade PF/PJ, imóveis financiados, receitas de aluguel, participações societárias, herdeiros, intenção sucessória, compras e vendas futuras, endividamento e objetivos patrimoniais.",
            "Ao final, admitir três conclusões possíveis: holding aparenta fazer sentido e merece estudo; ainda faltam dados para concluir; ou não há evidência suficiente de benefício neste momento.",
            "Se a dor envolver sucessão, investigar herdeiros, doação de quotas, usufruto, administração, continuidade e conflitos potenciais.",
            "Se a dor envolver patrimônio ou imóveis, investigar titularidade, valor aproximado, financiamento, locação, venda, integralização e objetivo dos ativos.",
            "Se a dor envolver participações societárias ou grupo empresarial, investigar empresas controladas, percentuais, governança, distribuição de resultados e dependência entre empresas.",
            "Se a dor envolver tributação, investigar regime, origem das receitas, locações, alienações, dividendos, custos, créditos e necessidade de simulação individualizada.",
          ]
        : trilhaPFAtiva
        ? [
            "Tratar este diagnóstico como consultoria financeira para Pessoa Física, não como empresa.",
            "As perguntas devem seguir os objetivos escolhidos e as dores declaradas.",
            "Se houver organização financeira, investigar orçamento, gastos, capacidade de poupança, dívidas, reserva e estabilidade da renda.",
            "Se houver aposentadoria, investigar idade, prazo, renda desejada, patrimônio acumulado e capacidade de aporte.",
            "Se houver investimentos, investigar objetivos, horizonte, liquidez necessária, tolerância a risco e diversificação, sem recomendar produto específico.",
            "Se houver dívidas, investigar saldo, custo, prazo, parcelas e impacto no orçamento antes de sugerir estratégia.",
            "Se houver patrimônio ou proteção, investigar bens, dependentes, reserva e vulnerabilidades financeiras.",
            "Os próximos passos devem mostrar somente ações relacionadas aos objetivos selecionados e às prioridades identificadas.",
          ]
        : [],
      empresas: fluxoSemCnpj ? [] : empresas.map((e) => ({
        razao: e.razao,
        cnpj: e.cnpjDigits,
        segmento: e.segmento,
        categoria: e.categoria,
        cnaePrincipal: e.cnaePrincipal || null,
        cnaesSecundarios: e.cnaesSecundarios || [],
      })),
      perfil: {
        faturamento: faturamento?.label || "",
        colaboradores: colaboradores || "",
        regime: regime || "",
      },
      dor: {
        selecionadas: doresSelecionadas,
        principal: doresSelecionadas[0] || "",
        objetivo90Dias: dor90Dias,
        impactos: impactosDor,
      },
      // Áreas selecionadas = prioridades de aprofundamento.
      areasSelecionadas:
        prioridadesDiagnostico.map(
          (id) => {
            const area =
              areasDaEstrutura.find(
                (item) =>
                  item.id === id
              );

            return {
              id,
              label:
                area?.label ||
                areaLabel(id),
              prioridade:
                true,
            };
          }
        ),

      // Na empresa operacional, o escopo obrigatório é exatamente
      // o conjunto de departamentos selecionados pelo usuário.
      // Nas demais estruturas, preservamos os eixos estruturais.
      eixosObrigatorios:
        (
          estruturaNegocio ===
            "operacional" &&
          areasOperacionaisSelecionadas.length >
            0
            ? areasDaEstrutura.filter(
                (item) =>
                  areasOperacionaisSelecionadas.includes(
                    normalizarAreaOperacionalId(
                      item.id
                    )
                  )
              )
            : areasDaEstrutura
        ).map(
          (item) => ({
            id:
              item.id,
            label:
              item.label,
          })
        ),
    };

    try {
      const chaveCache =
        finderCacheKey(
          "finder_perguntas",
          payload
        );

      const data =
        await fetchJsonDedupe({
          chave:
            chaveCache,
          url:
            "/api/gerar-perguntas",
          payload,
          ttlMs:
            15 *
            60 *
            1000,
        });

      if (
        !data?.sucesso ||
        !Array.isArray(
          data?.perguntas
        )
      ) {
        throw new Error(
          data?.error ||
          "Não foi possível gerar as perguntas personalizadas."
        );
      }

      const perguntas = data.perguntas
        .filter(
          (q) =>
            perguntaServeParaSimParcialNao(
              q?.pergunta
            )
        )
        .map((q, idx) => ({
          id:
            q.id ||
            `ia_${idx + 1}`,
          areaId:
            estruturaNegocio ===
              "operacional"
              ? normalizarAreaOperacionalId(
                  q.areaId
                )
              : q.areaId,
          area:
            q.area,
          tema:
            q.tema ||
            "Diagnóstico específico",
          text:
            q.pergunta,
          risco:
            q.riscoAvaliado ||
            "Ponto relevante para aprofundamento",
          motivo:
            q.motivo ||
            "",
          importancia:
            Number(
              q.importancia
            ) || 1,
          invert:
            false,
        }));

      // Se a IA não devolver perguntas, mantemos o fluxo com
      // o checklist local da estrutura selecionada.
      setPerguntasDinamicas(
        perguntas.length > 0
          ? perguntas
          : []
      );
      setNegocioInterpretado(
        interpretacaoNegocioSegura(
          data.negocioInterpretado ||
          data.interpretacaoNegocio ||
          {}
        )
      );
      setRespostas({});
      setStep("confirmarNegocio");
    } catch (error) {
      console.error("Erro ao gerar perguntas:", error);

      setErroPerguntas(
        fluxoSemCnpj
          ? "Usaremos as perguntas específicas da estrutura escolhida para continuar o diagnóstico."
          : error?.message ||
            "Não foi possível gerar perguntas personalizadas."
      );

      setPerguntasDinamicas([]);

      // PF e avaliação/holding sem CNPJ não dependem de uma
      // interpretação empresarial para continuar.
      if (!fluxoSemCnpj) {
        setNegocioInterpretado(null);
      }

      setStep("confirmarNegocio");
    } finally {
      setGerandoPerguntas(false);
    }
  }

  async function adicionarCnpj() {
    const digits = String(cnpjInput || "").replace(/\D/g, "");

    if (digits.length !== 14) {
      showToast("Digite um CNPJ válido com 14 dígitos.");
      return;
    }

    if (empresas.length >= MAX_EMPRESAS) {
      showToast(`Limite de ${MAX_EMPRESAS} CNPJs atingido.`);
      return;
    }

    setBuscando(true);

    try {
      const r = await fetch(`/api/cnpj?cnpj=${encodeURIComponent(digits)}`);

      const contentType = r.headers.get("content-type") || "";
      let data;

      if (contentType.includes("application/json")) {
        data = await r.json();
      } else {
        const texto = await r.text();

        console.error("Resposta não JSON de /api/cnpj:", {
          status: r.status,
          texto,
        });

        throw new Error(
          `Erro no servidor ao consultar CNPJ. Status: ${r.status}`
        );
      }

      if (!r.ok || !data?.sucesso) {
        throw new Error(
          data?.error || "Erro ao consultar CNPJ"
        );
      }

      const cnaePrincipal =
        data.cnaePrincipal ||
        data.cnae?.principal || {
          codigo: String(data.cnae?.codigo || ""),
          descricao: data.cnae?.descricao || "",
          principal: true,
          classificacao: data.classificacao || null,
        };

      const cnaesSecundarios =
        Array.isArray(data.cnaesSecundarios)
          ? data.cnaesSecundarios
          : Array.isArray(data.cnae?.secundarios)
            ? data.cnae.secundarios
            : [];

      const todosBrutos =
        Array.isArray(data.todosCnaes) && data.todosCnaes.length
          ? data.todosCnaes
          : Array.isArray(data.cnae?.todos) && data.cnae.todos.length
            ? data.cnae.todos
            : [cnaePrincipal, ...cnaesSecundarios];

      const mapaCnaes = new Map();

      todosBrutos.forEach((atividade) => {
        if (!atividade) return;

        const codigo = String(atividade.codigo || "");
        const descricao = String(atividade.descricao || "");

        const chave =
          codigo.replace(/\D/g, "") ||
          descricao.toLowerCase().trim();

        if (!chave) return;

        if (!mapaCnaes.has(chave)) {
          mapaCnaes.set(chave, {
            ...atividade,
            codigo,
            descricao,
            principal: Boolean(atividade.principal),
            classificacao:
              atividade.classificacao ||
              (atividade.principal
                ? data.classificacao || null
                : null),
          });
        }
      });

      let todosCnaes = Array.from(mapaCnaes.values());

      const codigoPrincipalLimpo =
        String(cnaePrincipal?.codigo || "").replace(/\D/g, "");

      const principalJaExiste =
        todosCnaes.some(
          (atividade) =>
            String(atividade.codigo || "").replace(/\D/g, "") ===
            codigoPrincipalLimpo
        );

      if (codigoPrincipalLimpo && !principalJaExiste) {
        todosCnaes = [
          {
            ...cnaePrincipal,
            principal: true,
            classificacao:
              cnaePrincipal?.classificacao ||
              data.classificacao ||
              null,
          },
          ...todosCnaes,
        ];
      } else {
        todosCnaes =
          todosCnaes.map((atividade) => {
            const ehPrincipal =
              String(atividade.codigo || "").replace(/\D/g, "") ===
              codigoPrincipalLimpo;

            return {
              ...atividade,
              principal:
                ehPrincipal
                  ? true
                  : Boolean(atividade.principal),

              classificacao:
                atividade.classificacao ||
                (ehPrincipal
                  ? data.classificacao || null
                  : null),
            };
          });
      }

      const empresa = {
        cnpjDigits:
          data.empresa?.cnpj || digits,

        razao:
          data.empresa?.razaoSocial ||
          "Razão social não informada",

        nomeFantasia:
          data.empresa?.nomeFantasia || "",

        porte:
          data.empresa?.porte ||
          "Não informado",

        segmento:
          data.classificacao?.segmento ||
          "Serviços Profissionais",

        categoria:
          data.classificacao?.categoria ||
          "Serviços Profissionais",

        codigoQuestionario:
          data.classificacao?.codigoQuestionario ||
          "servicos",

        cnae:
          `${cnaePrincipal?.codigo || ""} — ${cnaePrincipal?.descricao || ""}`,

        cnaePrincipal,
        cnaesSecundarios,
        todosCnaes,

        areasPrioritarias:
          data.classificacao
            ?.diagnostico
            ?.areasPrioritarias ||
          [],

        areasComplementares:
          data.classificacao
            ?.diagnostico
            ?.areasComplementares ||
          [],

        endereco:
          data.endereco || {},
      };

      const primeiraEmpresa =
        empresas.length === 0;

      setEmpresas((prev) => [
        ...prev,
        empresa,
      ]);

      // A primeira empresa adicionada será a empresa-base do diagnóstico.
      if (primeiraEmpresa) {
        setCnaesEmpresa(
          todosCnaes
        );

        const codigoPrincipal =
          String(cnaePrincipal?.codigo || "");

        setAtividadesSelecionadas(
          codigoPrincipal
            ? [codigoPrincipal]
            : []
        );

        setAtividadePredominante(
          cnaePrincipal?.codigo ||
          cnaePrincipal?.descricao
            ? {
                ...cnaePrincipal,

                principal: true,

                classificacao:
                  cnaePrincipal?.classificacao ||
                  data.classificacao ||
                  null,
              }
            : null
        );
      }

      setCnpjInput("");

      showToast(
        primeiraEmpresa &&
        todosCnaes.length > 1
          ? `${todosCnaes.length} atividades encontradas. Confirme quais a empresa realmente exerce.`
          : "Empresa encontrada com sucesso."
      );

    } catch (err) {
      console.error(
        "Erro CNPJ:",
        err
      );

      showToast(
        err?.message ||
        "Erro ao consultar CNPJ"
      );

    } finally {
      setBuscando(false);
    }
  }

  function removerEmpresa(idx) {
    setEmpresas((prev) => {
      const novas =
        prev.filter(
          (_, i) => i !== idx
        );

      if (idx === 0) {
        const novaPrincipal =
          novas[0] || null;

        const novosCnaes =
          novaPrincipal?.todosCnaes || [];

        setCnaesEmpresa(
          novosCnaes
        );

        const cnaePrincipal =
          novaPrincipal?.cnaePrincipal ||
          null;

        const codigoPrincipal =
          String(
            cnaePrincipal?.codigo || ""
          );

        setAtividadesSelecionadas(
          codigoPrincipal
            ? [codigoPrincipal]
            : []
        );

        setAtividadePredominante(
          cnaePrincipal
            ? {
                ...cnaePrincipal,

                principal: true,

                classificacao:
                  cnaePrincipal?.classificacao ||
                  (
                    novaPrincipal
                      ? {
                          segmento:
                            novaPrincipal.segmento,

                          categoria:
                            novaPrincipal.categoria,

                          codigoQuestionario:
                            novaPrincipal.codigoQuestionario,

                          diagnostico: {
                            areasPrioritarias:
                              novaPrincipal.areasPrioritarias ||
                              [],

                            areasComplementares:
                              novaPrincipal.areasComplementares ||
                              [],
                          },
                        }
                      : null
                  ),
              }
            : null
        );
      }

      return novas;
    });
  }

  function toggleDor(id) {
    setDores((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_DORES) return prev;
      return [...prev, id];
    });
  }

  function responder(qid, valor) {
    setRespostas((r) => ({ ...r, [qid]: valor }));
  }

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }




  function limparCodigoInternoRelatorio(
    valor
  ) {
    return String(
      valor ||
      ""
    )
      // Ex.: (resposta: 'parcialmente' para fin_q1)
      .replace(
        /\s*\(\s*resposta\s*:\s*['"][^'"]*['"]\s+para\s+[a-z0-9_:-]+\s*\)/gi,
        ""
      )
      // Ex.: — Id: c1 — Tipo: fato
      .replace(
        /\s*[—-]\s*Id\s*:\s*[a-z0-9_:-]+/gi,
        ""
      )
      .replace(
        /\s*[—-]\s*Tipo\s*:\s*[a-z0-9_:-]+/gi,
        ""
      )
      // Ex.: — Ligado A: c3
      .replace(
        /\s*[—-]\s*Ligado\s*A\s*:\s*[a-z0-9_:-]+/gi,
        ""
      )
      // Ex.: — Risco Mitigado: rc1
      .replace(
        /\s*[—-]\s*Risco\s*Mitigado\s*:\s*[a-z0-9_:-]+/gi,
        ""
      )
      // Ex.: (contabil_fiscal_1 = 'nao')
      .replace(
        /\s*\([a-z0-9_]+\s*=\s*['"][^'"]*['"]\s*\)/gi,
        ""
      )
      // Ex.: códigos soltos do padrão fin_q1, rc_2, c3 no fim da frase
      .replace(
        /\s*[—-]\s*(?:ref|c[oó]digo|codigo)\s*:\s*[a-z0-9_:-]+/gi,
        ""
      )
      .replace(
        /\s{2,}/g,
        " "
      )
      .replace(
        /\s+([.,;:])/g,
        "$1"
      )
      .trim();
  }

  function textoIaSeguro(
    valor,
    fallback = ""
  ) {
    if (
      valor === null ||
      valor === undefined
    ) {
      return fallback;
    }

    if (
      typeof valor ===
      "string"
    ) {
      return limparCodigoInternoRelatorio(
        valor
      );
    }

    if (
      typeof valor ===
        "number" ||
      typeof valor ===
        "boolean"
    ) {
      return String(
        valor
      );
    }

    if (
      typeof valor ===
      "object"
    ) {
      const candidatos = [
        valor.texto,
        valor.descricao,
        valor.titulo,
        valor.label,
        valor.nome,
        valor.item,
        valor.risco,
        valor.recomendacao,
        valor.acao,
        valor.tema,
        valor.motivo,
        valor.resumo,
        valor.achado,
        valor.impacto,
        valor.causa,
      ];

      const encontrado =
        candidatos.find(
          (item) =>
            typeof item ===
              "string" &&
            item.trim()
        );

      if (encontrado) {
        return limparCodigoInternoRelatorio(
          encontrado
        );
      }

      try {
        return JSON.stringify(
          valor
        );
      } catch {
        return fallback;
      }
    }

    return String(
      valor
    );
  }

  function listaIaSegura(
    valor
  ) {
    if (!Array.isArray(valor)) {
      return [];
    }

    return valor
      .map(
        (item) =>
          textoIaSeguro(
            item
          )
      )
      .filter(Boolean);
  }

  async function enviarRelatorioPorEmail(
    resultadoIaDireto = null
  ) {
    const resultadoFonte =
      resultadoIaDireto ||
      iaResultado;

    if (
      (
        !fluxoSemCnpj &&
        !empresaPrincipal
      ) ||
      !resultadoFonte ||
      !resultadoFonte?.diagnosticoGeral ||
      relatorioEnviadoRef.current
    ) {
      return false;
    }

    const respostasDetalhadas = gruposSelecionados.map((g) => ({
  area: g.label,

  score: scoreDe(
    g.subtemas.flatMap((s) => s.perguntas)
  ),

  subtemas: g.subtemas.map((s) => ({
    tema: s.tema,

    perguntas: s.perguntas.map((q) => {
      const importancia =
        Math.max(
          1,
          Math.min(
            3,
            Number(q.importancia) || 1
          )
        );

      const resposta =
        respostas[q.id] || "";

      const pesoCalculado =
        pesoResposta(
          q,
          resposta
        );

      return {
        id:
          q.id,

        area:
          g.label,

        areaId:
          g.id,

        tema:
          s.tema,

        pergunta:
          textoDe(
            q,
            segmentoPredominante,
            categoriaPrincipal
          ),

        resposta,

        importancia,

        peso:
          pesoCalculado,

        motivo:
          q.motivo ||
          "",

        riscoAvaliado:
          riscoDe(
            q,
            segmentoPredominante,
            categoriaPrincipal
          ),
      };
    }),
  })),
}));

    const payloadEmail = {
      // CRM — metadados da sessão de origem do diagnóstico.
      crm: {
        leadId,
        sessionId:
          sessionIdLead,
      },

      responsavel: {
        nome,
        cargo,
        telefone,
        email,
        consentimentoEmail,
      },
      empresa: fluxoSemCnpj
        ? {
            razao:
              trilhaPFAtiva
                ? nome || "Pessoa Física"
                : avaliarHoldingAtiva
                ? `Avaliação de Holding — ${nome || "Participante"}`
                : trilhaSPEAtiva
                ? nomeProjetoSPE || "SPE em estruturação"
                : nome || "Participante",

            nomeFantasia: "",
            cnpj: "",
            cnae: "",
            cnaePrincipal: null,
            cnaesSecundarios: [],
            atividadesSelecionadas: [],
            atividadePredominante: null,

            categoria:
              trilhaPFAtiva
                ? "Pessoa Física"
                : avaliarHoldingAtiva
                ? "Avaliação de Holding"
                : trilhaSPEAtiva
                ? "SPE"
                : "Diagnóstico",

            segmento:
              trilhaPFAtiva
                ? "Pessoa Física / Consultoria Financeira"
                : avaliarHoldingAtiva
                ? "Holding / Estrutura Patrimonial"
                : trilhaSPEAtiva
                ? "SPE / Projeto específico"
                : "",

            porte: "",
            endereco: {},
          }
        : {
            razao: empresaPrincipal?.razao || "",
            nomeFantasia: empresaPrincipal?.nomeFantasia || "",
            cnpj: empresaPrincipal?.cnpjDigits || "",
            cnae: empresaPrincipal?.cnae || "",
            cnaePrincipal: empresaPrincipal?.cnaePrincipal || null,
            cnaesSecundarios: empresaPrincipal?.cnaesSecundarios || [],
            atividadesSelecionadas: atividadesSelecionadasObjetos,
            atividadePredominante,
            categoria: categoriaPrincipal,
            segmento: segmentoPredominante,
            porte: empresaPrincipal?.porte || "",
            endereco: empresaPrincipal?.endereco || {},
          },
      perfil: {
        estruturaNegocio,
        faturamento: faturamento?.label || "",
        colaboradores: colaboradores || "",
        regime: regime || "",
        observacao: observacao || "",
        descricaoNegocio: descricaoNegocio || "",
        negocioInterpretado: negocioInterpretado || null,
        estruturaNegocio,
        holding: perfilHolding,
        pessoaFisica: perfilPF,
        grupo: perfilGrupo,
        spe: perfilSPE,
        doresSelecionadas,
        dorPrincipal: doresSelecionadas[0] || "",
        dor90Dias,
        impactosDor,
        areasSelecionadas: gruposSelecionados.map((g) => g.label),
      },
      resultado: {
        contextoEstrutura: {
          estruturaNegocio,
          holding: perfilHolding,
          pessoaFisica: perfilPF,
          grupo: perfilGrupo,
          spe: perfilSPE,
        },

        // Resultado principal
        scoreGeral: score,

        nivelGeral:
          tierGeral.label,

        areas:
          areasComScore.map((a) => ({
            area: a.label,

            score: a.score,

            nivel:
              tierDe(a.score).label,

            // Preserva resumo, achados, causas, riscos,
            // recomendações e prioridade gerados pela IA.
            ...(resultadoFonte?.areas?.[a.label] || {}),
          })),

        diagnosticoGeral:
          resultadoFonte?.diagnosticoGeral || null,

        // Diagnóstico completo já existente
        visaoGrupo:
          resultadoFonte?.visaoGrupo || null,

        lacunasDiagnostico:
          Array.isArray(
            resultadoFonte?.lacunasDiagnostico
          )
            ? resultadoFonte.lacunasDiagnostico
            : [],

        oportunidadesConsultoria:
          Array.isArray(
            resultadoFonte?.oportunidadesConsultoria
          )
            ? resultadoFonte.oportunidadesConsultoria
            : [],

        // Novo dossiê consultivo do administrador
        plano90Dias:
          resultadoFonte?.plano90Dias || null,

        quickWins:
          Array.isArray(
            resultadoFonte?.quickWins
          )
            ? resultadoFonte.quickWins
            : [],

        kpisRecomendados:
          Array.isArray(
            resultadoFonte?.kpisRecomendados
          )
            ? resultadoFonte.kpisRecomendados
            : [],

        perguntasAprofundamento:
          Array.isArray(
            resultadoFonte?.perguntasAprofundamento
          )
            ? resultadoFonte.perguntasAprofundamento
            : [],

        visaoConsultor:
          resultadoFonte?.visaoConsultor || null,

        visaoComercial:
          resultadoFonte?.visaoComercial || null,

        contextoInterpretado:
          resultadoFonte?.contextoInterpretado || null,

        // Inteligência tributária — cliente + administração
        inteligenciaTributaria,

        // Rastreabilidade
        respostas:
          respostasDetalhadas,

        resultadoCompleto:
          resultadoFonte?.resultadoCompleto || null,
      },
    };

    try {
      setEnvioRelatorio("sending");

      const r = await fetch("/api/enviar-relatorio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payloadEmail),
      });

      const data = await r.json().catch(() => null);

      if (!r.ok) {
        console.error("Erro ao enviar relatório:", data);
        setEnvioRelatorio("error");
        return false;
      }

      const idSalvo =
        data?.id ||
        data?.diagnosticoId ||
        data?.banco?.id ||
        data?.diagnostico?.id ||
        data?.registro?.id ||
        data?.registroSalvo?.id ||
        data?.salvo?.id ||
        data?.resultado?.id ||
        "";

      if (!idSalvo) {
        console.warn(
          "[DIAGNÓSTICO] Relatório salvo/enviado, mas a resposta não trouxe o ID do diagnóstico.",
          data
        );
      }

      // Só marcamos o relatório como processado depois que
      // tentamos também alimentar o CRM/Atendimentos.

      if (idSalvo) {
        setDiagnosticoIdSalvo(
          String(idSalvo)
        );
      }

      await atualizarLeadCRM({
        statusDiagnostico:
          "CONCLUIDO",

        etapaAtual:
          "RESULTADO",

        progressoPercentual:
          100,

        nome:
          nome || "",

        email:
          email || "",

        telefone:
          telefone || "",

        cnpj:
          fluxoSemCnpj
            ? ""
            : empresaPrincipal?.cnpjDigits || "",

        razaoSocial:
          trilhaPFAtiva
            ? nome || "Pessoa Física"
            : avaliarHoldingAtiva
            ? `Avaliação de Holding — ${nome || "Participante"}`
            : trilhaSPEAtiva && speConstituida !== "sim"
            ? nomeProjetoSPE || "SPE em estruturação"
            : trilhaGrupoAtiva
            ? nomeGrupo || empresaPrincipal?.razao || "Grupo empresarial"
            : empresaPrincipal?.razao || "",

        diagnosticoId:
          idSalvo
            ? String(idSalvo)
            : "",

        estruturaNegocio,

        contextoCliente: {
          estruturaNegocio,
          holding: perfilHolding,
          pessoaFisica: perfilPF,
          grupo: perfilGrupo,
          spe: perfilSPE,
        },
      });

      // ===================================================
      // CRM — CLASSIFICAÇÃO COMERCIAL AUTOMÁTICA
      // ===================================================
      //
      // A classificação acontece somente depois que:
      // 1. o diagnóstico foi gerado;
      // 2. o relatório foi salvo;
      // 3. o lead foi marcado como CONCLUÍDO.
      //
      // Assim o atendimento pode ser ordenado por prioridade
      // sem alterar o relatório já existente.
      // ===================================================

      // ===================================================
      // ATENDIMENTOS — REGRA DE ENTRADA NA FILA
      // ===================================================
      //
      // Nem todo eixo deve virar atendimento.
      // Criamos um caso quando houver pelo menos um sinal real:
      //
      // - score abaixo de 60;
      // - eixo escolhido como prioridade;
      // - risco relevante;
      // - oportunidade consultiva;
      // - recomendação que exige atuação;
      // - plano de ação específico.
      //
      // O conteúdo é buscado primeiro no novo resultadoCompleto.eixos
      // e, por compatibilidade, também no formato antigo resultadoFonte.areas.
      // ===================================================

      const eixosResultadoCompleto =
        Array.isArray(
          resultadoFonte?.resultadoCompleto
            ?.eixos
        )
          ? resultadoFonte.resultadoCompleto
              .eixos
          : [];

      const encontrarEixoCompleto =
        (area) => {
          const idAlvo =
            String(
              area?.id ||
              ""
            ).trim();

          const labelAlvo =
            String(
              area?.label ||
              ""
            ).trim();

          return (
            eixosResultadoCompleto.find(
              (eixo) =>
                String(
                  eixo?.id ||
                  ""
                ).trim() === idAlvo
            ) ||
            eixosResultadoCompleto.find(
              (eixo) =>
                String(
                  eixo?.label ||
                  ""
                )
                  .trim()
                  .toLowerCase() ===
                labelAlvo
                  .toLowerCase()
            ) ||
            null
          );
        };

      const areasParaAtendimento =
        areasComScore
          .map((area) => {
            const eixoCompleto =
              encontrarEixoCompleto(
                area
              );

            const diagnosticoAreaAntigo =
              resultadoFonte?.areas?.[
                area.label
              ] ||
              {};

            const oportunidades =
              Array.isArray(
                eixoCompleto
                  ?.oportunidades
              )
                ? eixoCompleto
                    .oportunidades
                : Array.isArray(
                    diagnosticoAreaAntigo
                      ?.oportunidades
                  )
                ? diagnosticoAreaAntigo
                    .oportunidades
                : Array.isArray(
                    diagnosticoAreaAntigo
                      ?.oportunidadesConsultoria
                  )
                ? diagnosticoAreaAntigo
                    .oportunidadesConsultoria
                : [];

            const riscos =
              Array.isArray(
                eixoCompleto
                  ?.riscos
              )
                ? eixoCompleto
                    .riscos
                : Array.isArray(
                    diagnosticoAreaAntigo
                      ?.riscos
                  )
                ? diagnosticoAreaAntigo
                    .riscos
                : [];

            const recomendacoes =
              Array.isArray(
                eixoCompleto
                  ?.recomendacoes
              )
                ? eixoCompleto
                    .recomendacoes
                : Array.isArray(
                    diagnosticoAreaAntigo
                      ?.recomendacoes
                  )
                ? diagnosticoAreaAntigo
                    .recomendacoes
                : [];

            const planoAcao =
              Array.isArray(
                eixoCompleto
                  ?.planoAcao
              )
                ? eixoCompleto
                    .planoAcao
                : Array.isArray(
                    diagnosticoAreaAntigo
                      ?.planoAcao
                  )
                ? diagnosticoAreaAntigo
                    .planoAcao
                : [];

            const achados =
              Array.isArray(
                eixoCompleto
                  ?.achados
              )
                ? eixoCompleto
                    .achados
                : [];

            const orientacaoTecnica =
              eixoCompleto
                ?.orientacaoTecnica ||
              eixoCompleto
                ?.resumo ||
              diagnosticoAreaAntigo
                ?.orientacaoTecnica ||
              diagnosticoAreaAntigo
                ?.resumo ||
              "";

            const prioridade =
              prioridadesDiagnostico.includes(
                area.id
              );

            const riscoRelevante =
              riscos.length > 0;

            const possuiSinalDeAtuacao =
              Number(area.score) < 60 ||
              prioridade ||
              riscoRelevante ||
              oportunidades.length > 0 ||
              recomendacoes.length > 0 ||
              planoAcao.length > 0;

            if (
              !possuiSinalDeAtuacao
            ) {
              return null;
            }

            return {
              area:
                area.label,

              areaId:
                area.id,

              prioridade,

              score:
                area.score,

              nivel:
                eixoCompleto?.nivel ||
                tierDe(
                  area.score
                ).label,

              achados,

              oportunidades,

              riscos,

              recomendacoes,

              planoAcao,

              orientacaoTecnica,
            };
          })
          .filter(Boolean);

      // ===================================================
      // CRM — PROCESSOS PÓS-DIAGNÓSTICO
      // ===================================================
      //
      // Rodam em paralelo para não aumentar desnecessariamente
      // o tempo de conclusão do cliente:
      //
      // 1. classificação comercial do lead;
      // 2. criação dos atendimentos por departamento.
      //
      // O relatório atual do cliente permanece inalterado.
      // ===================================================

      const tarefasPosDiagnostico = [
        classificarLeadCRM({
          scoreDiagnostico:
            score,

          nivelDiagnostico:
            tierGeral?.label ||
            "",

          faturamentoAnual:
            faturamento?.anual ||
            0,

          dores:
            [
              ...(
                Array.isArray(
                  doresSelecionadas
                )
                  ? doresSelecionadas
                  : []
              ),

              ...(
                Array.isArray(
                  impactosDor
                )
                  ? impactosDor
                  : []
              ),
            ],
        }),
      ];

      if (
        idSalvo &&
        areasParaAtendimento.length > 0
      ) {
        tarefasPosDiagnostico.push(
          criarAtendimentosDepartamentoCRM({
            diagnosticoId:
              String(idSalvo),

            areas:
              areasParaAtendimento,
          })
        );
      } else {
        console.warn(
          "[CRM] Atendimento não enviado no pós-diagnóstico:",
          {
            idSalvo,
            totalAreas:
              areasParaAtendimento.length,
          }
        );
      }

      const resultadosPosDiagnostico =
        await Promise.allSettled(
          tarefasPosDiagnostico
        );

      const falhasPosDiagnostico =
        resultadosPosDiagnostico.filter(
          (item) =>
            item.status ===
            "rejected"
        );

      if (
        falhasPosDiagnostico.length
      ) {
        console.error(
          "[CRM] Uma ou mais rotinas pós-diagnóstico falharam:",
          falhasPosDiagnostico
        );
      }

      relatorioEnviadoRef.current = true;
      setEnvioRelatorio("sent");
      return true;
    } catch (error) {
      console.error("Erro no envio do relatório:", error);
      setEnvioRelatorio("error");
      return false;
    }
  }

  function reiniciar() {
    setStep("intro");
    setNome("");
    setCargo("");
    setTelefone("");
    setEmail("");
    setConsentimentoEmail(true);
    setEnvioRelatorio("idle");
    relatorioEnviadoRef.current = false;
    setCnpjInput("");
    setEmpresas([]);
    setCnaesEmpresa([]);
    setAtividadesSelecionadas([]);
    setAtividadePredominante(null);
    setDescricaoNegocio("");
    setEstruturaNegocio("operacional");
    setTiposHolding([]);
    setObjetivosHolding([]);
    setPatrimonioHolding("");
    setReceitasHolding("");
    setSucessaoHolding("");

    setObjetivosPF([]);
    setRendaMensalPF("");
    setGastosMensaisPF("");
    setDividasPF("");
    setReservaPF("");
    setPatrimonioPF("");
    setInvestimentosPF("");
    setAposentadoriaPF("");
    setDependentesPF("");

    setNomeGrupo("");
    setFuncaoEmpresasGrupo("");
    setSociosComunsGrupo("");
    setFinanceiroCentralizadoGrupo("");
    setPessoasCompartilhadasGrupo("");
    setOperacoesIntercompanyGrupo("");
    setGovernancaGrupo("");

    setSpeConstituida("");
    setNomeProjetoSPE("");
    setFinalidadeSPE("");
    setSociosSPE("");
    setValorProjetoSPE("");
    setAportesSPE("");
    setFinanciamentoSPE("");
    setPrazoSPE("");
    setReceitaPrevistaSPE("");
    setCustosPrevistosSPE("");
    setFaseProjetoSPE("");

    setPerguntasDinamicas([]);
    setNegocioInterpretado(null);
    setGerandoPerguntas(false);
    setErroPerguntas("");
    setFaturamento(null);
    setColaboradores(null);
    setRegime(null);
    setObservacao("");
    setDores([]);
    setDoresSelecionadas([]);
    setDor90Dias("");
    setImpactosDor([]);
    setRespostas({});
    setIaResultado(null);
    setDiagnosticoIdSalvo("");
    ultimaAtualizacaoLeadRef.current = "";
  }

  function scoreDe(perguntas) {
    if (!perguntas.length) return 0;

    const total = perguntas.reduce((acc, q) => {
      const importancia = Math.max(1, Math.min(3, Number(q.importancia) || 1));
      return acc + (pesoResposta(q, respostas[q.id]) * importancia);
    }, 0);

    const maximo = perguntas.reduce((acc, q) => {
      const importancia = Math.max(1, Math.min(3, Number(q.importancia) || 1));
      return acc + (5 * importancia);
    }, 0);

    return maximo ? Math.round((total / maximo) * 100) : 0;
  }

  const score = scoreDe(todasPerguntas);
  const tierGeral = tierDe(score);

  const areasComScore = gruposSelecionados.map((g) => ({
    ...g, score: scoreDe(g.subtemas.flatMap((s) => s.perguntas)),
  }));
  const areaMaisFraca = areasComScore.length
    ? [...areasComScore].sort((a, b) => a.score - b.score)[0]
    : null;

  const subScoresAll = gruposSelecionados.flatMap((g) =>
    g.subtemas.map((s) => ({ area: g.label, tema: s.tema, dica: s.dica, score: scoreDe(s.perguntas) }))
  );
  const subOrdenados = [...subScoresAll].sort((a, b) => a.score - b.score);

  const perguntasComPeso = todasPerguntas.map((q) => ({
    ...q, peso: pesoResposta(q, respostas[q.id]), riscoTexto: riscoDe(
      q,
      segmentoPredominante,
      categoriaPrincipal
    ),
  }));
  const pontosAtencao = [...perguntasComPeso]
    .filter((q) => q.peso < 5)
    .sort((a, b) => a.peso - b.peso)
    .slice(0, 6)
    .map((q) => q.riscoTexto);

  const riscosNaAreaMaisFraca = areaMaisFraca
    ? perguntasComPeso.filter((q) => q.peso < 5 && gruposSelecionados
        .find((g) => g.id === areaMaisFraca.id).subtemas
        .some((s) => s.perguntas.some((p) => p.id === q.id))).length
    : 0;

  // Quando a IA responde, seus riscos/recomendações substituem os calculados localmente.
  const pontosAtencaoFinal =
    iaResultado
      ? gruposSelecionados
          .flatMap(
            (g) =>
              listaIaSegura(
                iaResultado?.areas?.[
                  g.label
                ]?.riscos
              )
          )
          .slice(
            0,
            8
          )
      : pontosAtencao;

  const recomendacoesFinal =
    iaResultado
      ? gruposSelecionados
          .flatMap(
            (g) =>
              listaIaSegura(
                iaResultado?.areas?.[
                  g.label
                ]?.recomendacoes
              ).map(
                (r) => ({
                  area:
                    g.label,
                  dica:
                    r,
                })
              )
          )
          .slice(
            0,
            6
          )
      : subOrdenados.slice(
          0,
          3
        );

  const aliquota = empresaPrincipal && regime ? estimarAliquota(regime, segmentoPredominante, faturamento?.anual || 0) : null;
  const valorAnualImposto = aliquota != null && faturamento ? faturamento.anual * (aliquota / 100) : null;


  const inteligenciaTributaria =
    (
      estruturaNegocio ===
        "operacional" ||
      estruturaNegocio ===
        "grupo"
    )
      ? montarInteligenciaTributaria({
          regime,
          segmento:
            segmentoPredominante,
          categoria:
            categoriaPrincipal,
          faturamento,
        })
      : {
          disponivel: false,
          reforma: null,
        };

  const diagnosticoGeral =
    iaResultado?.diagnosticoGeral ||
    null;

  const resumoExecutivo =
    textoIaSeguro(
      diagnosticoGeral?.resumoExecutivo
    );

  const principaisDoresIa =
    listaIaSegura(
      diagnosticoGeral?.principaisDores
    );

  const pontosFortesIa =
    listaIaSegura(
      diagnosticoGeral?.pontosFortes
    );

  const prioridadesIa =
    listaIaSegura(
      diagnosticoGeral?.prioridadesImediatas
    );

  const oportunidadesIa =
    listaIaSegura(
      diagnosticoGeral?.oportunidades
    );

  const causasProvaveisIa =
    listaIaSegura(
      diagnosticoGeral?.causasProvaveis
    );

  const impactosIa =
    listaIaSegura(
      diagnosticoGeral?.impactos
    );

  const proximosPassosIa =
    listaIaSegura(
      diagnosticoGeral?.proximosPassos
    );

  const leituraDaDorIa =
    textoIaSeguro(
      diagnosticoGeral?.leituraDaDor
    );

  const alertaEstrategicoIa =
    textoIaSeguro(
      diagnosticoGeral?.alertaEstrategico
    );
  const visaoGrupoIa = iaResultado?.visaoGrupo || null;
  const lacunasDiagnosticoIa = iaResultado?.lacunasDiagnostico || [];
  const oportunidadesConsultoriaIa = iaResultado?.oportunidadesConsultoria || [];


  // O relatório final é salvo diretamente após o retorno válido da IA.
  // Isso evita condição de corrida entre setIaResultado e setStep.

  function proximosPassosAdaptaveisPF() {
    if (!trilhaPFAtiva) return [];

    const passos = [];

    if (objetivosPF.includes("financeiro") || objetivosPF.includes("renda")) {
      passos.push(
        "Organizar receitas, gastos fixos, gastos variáveis e capacidade real de poupança."
      );
      passos.push(
        "Definir uma meta de reserva de emergência compatível com a estabilidade da renda e os compromissos mensais."
      );
    }

    if (objetivosPF.includes("dividas")) {
      passos.push(
        "Mapear todas as dívidas por saldo, taxa, parcela e prazo antes de definir a ordem de quitação."
      );
    }

    if (objetivosPF.includes("aposentadoria")) {
      passos.push(
        "Definir idade-alvo, renda desejada e patrimônio necessário para aposentadoria, estimando o aporte mensal necessário."
      );
    }

    if (objetivosPF.includes("investimentos")) {
      passos.push(
        "Separar objetivos por prazo e liquidez antes de revisar a distribuição dos investimentos."
      );
      passos.push(
        "Distinguir reserva de emergência, objetivos de curto prazo e investimentos de longo prazo."
      );
    }

    if (objetivosPF.includes("patrimonio")) {
      passos.push(
        "Consolidar bens, investimentos e obrigações em uma visão patrimonial única."
      );
    }

    if (objetivosPF.includes("protecao")) {
      passos.push(
        "Avaliar dependentes, reserva e principais riscos capazes de comprometer a renda ou o patrimônio familiar."
      );
    }

    if (objetivosPF.includes("nao_sei") && passos.length === 0) {
      passos.push(
        "Começar pela organização financeira básica: renda, gastos, dívidas, reserva e objetivos."
      );
    }

    return passos;
  }

  function gerarPdf() {
    if (
      !fluxoSemCnpj &&
      !empresaPrincipal
    ) {
      showToast("Não há dados suficientes para gerar o relatório.");
      return;
    }

    const escaparHtml = (valor) =>
      String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const listaHtml = (itens, vazio = "Nenhuma informação relevante identificada.") =>
      Array.isArray(itens) && itens.length
        ? itens.map((item) => `<li>${escaparHtml(item)}</li>`).join("")
        : `<li>${escaparHtml(vazio)}</li>`;

    const prioridadesExecutivas = subOrdenados
      .slice(0, 3)
      .map((item) => `${item.area}: fortalecer ${String(item.tema || "esta frente").toLowerCase()}`);

    const conexoesExecutivas = causasProvaveisIa.slice(0, 3);
    const impactosExecutivos = impactosIa.slice(0, 3);
    const pontosFortesExecutivos = pontosFortesIa.slice(0, 3);

    const mensagemWhatsApp = encodeURIComponent(
      trilhaPFAtiva
        ? `Olá! Fiz o Diagnóstico Financeiro Pessoal Finder.\n\nScore: ${score}/100 — ${tierGeral.label}\nPrincipal área de atenção: ${areaMaisFraca?.label || ""}\n\nGostaria de conversar com um especialista para entender minhas prioridades e os próximos passos.`
        : `Olá! Fiz o Diagnóstico Empresarial Finder.\n\nEmpresa: ${empresaPrincipal?.razao || ""}\nScore: ${score}/100 — ${tierGeral.label}\nPrincipal área de atenção: ${areaMaisFraca?.label || ""}\n\nO resultado fez sentido para mim e gostaria de conversar com um especialista para entender as prioridades e os próximos passos.`
    );

    const whatsappEspecialista = `https://wa.me/5541989049616?text=${mensagemWhatsApp}`;
    const logoUrl = `${window.location.origin}/finder-logo.png`;
    const dataGeracao = new Date().toLocaleString("pt-BR");

    const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Diagnóstico Finder - ${escaparHtml(
  trilhaPFAtiva
    ? nome || "Pessoa Física"
    : empresaPrincipal?.razao || "Empresa"
)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #17233D;
    margin: 0;
    font-size: 11.5px;
    line-height: 1.55;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .capa {
    background: #17233D;
    color: #fff;
    padding: 30px 28px;
    border-radius: 14px;
    margin-bottom: 20px;
  }
  .logo { width: 220px; max-width: 70%; background: #fff; border-radius: 8px; padding: 8px; margin-bottom: 16px; }
  .marca { font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; opacity: .8; }
  .capa h1 { font-size: 25px; margin: 10px 0 7px; }
  .capa .empresa { font-size: 16px; font-weight: 700; margin: 0 0 4px; }
  .capa .meta { color: #D7DDEA; margin: 0; }
  h2 { font-size: 16px; margin: 22px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #FF6B4A; }
  h3 { font-size: 13px; margin: 0 0 5px; }
  .score-box {
    display: grid;
    grid-template-columns: 130px 1fr;
    gap: 20px;
    align-items: center;
    background: #F7F8FB;
    border: 1px solid #D8DEEA;
    padding: 17px;
    border-radius: 12px;
    page-break-inside: avoid;
  }
  .score { font-size: 40px; font-weight: 800; color: #FF6B4A; }
  .score small { font-size: 13px; color: #5B667A; }
  .box { border: 1px solid #D8DEEA; background: #F7F8FB; border-radius: 10px; padding: 13px; page-break-inside: avoid; }
  .insight { border-left: 4px solid #FF6B4A; background: #FFF3EF; border-radius: 8px; padding: 13px 15px; page-break-inside: avoid; }
  .positivo { background: #E1F5EE; border: 1px solid #C9E8D8; border-radius: 10px; padding: 13px; }
  .alerta { background: #FAEEDA; color: #70410A; border-radius: 10px; padding: 13px; }
  .prioridades { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 9px; }
  .prioridade { border: 1px solid #D8DEEA; border-radius: 10px; padding: 11px; page-break-inside: avoid; }
  .num { width: 23px; height: 23px; border-radius: 7px; background: #17233D; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; margin-bottom: 7px; }
  ul { margin: 0; padding-left: 18px; }
  li { margin-bottom: 5px; }
  .cta { margin-top: 24px; background: #17233D; color: white; border-radius: 12px; padding: 18px; page-break-inside: avoid; }
  .cta h3 { font-size: 16px; margin: 0 0 7px; }
  .cta p { color: #D7DDEA; margin: 0 0 10px; }
  .cta a { display: inline-block; background: #FF6B4A; color: #fff; font-weight: 700; text-decoration: none; padding: 10px 14px; border-radius: 8px; }
  .aviso { margin-top: 19px; font-size: 9.5px; color: #5B667A; font-style: italic; }
  .footer { margin-top: 16px; padding-top: 9px; border-top: 1px solid #D8DEEA; font-size: 9px; color: #7A8495; text-align: center; }
  @media print { a { color: inherit; } }
</style>
</head>
<body>

  <section class="capa">
    <img src="${logoUrl}" alt="Finder of Solutions" class="logo" />
    <div class="marca">Finder of Solutions</div>
    <h1>${
      trilhaPFAtiva
        ? "Diagnóstico Financeiro Pessoal"
        : avaliarHoldingAtiva
        ? "Avaliação de Viabilidade de Holding"
        : estruturaNegocio === "holding"
        ? "Diagnóstico Patrimonial da Holding"
        : estruturaNegocio === "grupo"
        ? "Diagnóstico do Grupo Empresarial"
        : estruturaNegocio === "spe"
        ? "Diagnóstico da SPE"
        : "Diagnóstico Executivo Empresarial"
    }</h1>
    <p class="empresa">${escaparHtml(
      trilhaPFAtiva
        ? nome || "Pessoa Física"
        : empresaPrincipal?.razao || "Empresa"
    )}</p>
    <p class="meta">${
      trilhaPFAtiva
        ? escaparHtml(
            objetivosPF
              .map(
                (id) =>
                  OBJETIVOS_PF.find(
                    (item) =>
                      item.id === id
                  )?.label
              )
              .filter(Boolean)
              .join(" · ")
          )
        : `${escaparHtml(categoriaPrincipal)} · ${escaparHtml(
            atividadePredominante?.descricao ||
            empresaPrincipal?.cnae ||
            ""
          )}`
    }</p>
  </section>

  <h2>Seu resultado</h2>
  <div class="score-box">
    <div>
      <div class="score">${score}<small>/100</small></div>
      <strong>${escaparHtml(tierGeral.label)}</strong>
    </div>
    <div>
      <strong>Principal área de atenção</strong><br />
      ${escaparHtml(areaMaisFraca?.label || "-")}<br /><br />
      <span style="color:#5B667A">Este índice representa a maturidade das respostas fornecidas no diagnóstico e serve como sinalizador para aprofundamento.</span>
    </div>
  </div>

  <h2>${trilhaPFAtiva ? "O que entendemos sobre sua vida financeira" : "O que entendemos sobre o seu negócio"}</h2>
  <div class="box">
    <strong>${escaparHtml(
      trilhaPFAtiva
        ? objetivosPF
            .map(
              (id) =>
                OBJETIVOS_PF.find(
                  (item) =>
                    item.id === id
                )?.label
            )
            .filter(Boolean)
            .join(" · ") ||
          "Consultoria financeira pessoal"
        : negocioInterpretado?.subsegmento ||
          negocioInterpretado?.segmento ||
          categoriaPrincipal
    )}</strong>
    <p>${escaparHtml(
      trilhaPFAtiva
        ? `Renda informada: ${rendaMensalPF || "não informada"} · Gastos informados: ${gastosMensaisPF || "não informados"} · Reserva: ${reservaPF || "não informada"}`
        : descricaoNegocio || "Descrição do negócio não informada."
    )}</p>
    ${negocioInterpretado?.modeloOperacional ? `<p><strong>Modelo operacional:</strong> ${escaparHtml(negocioInterpretado.modeloOperacional)}</p>` : ""}
    ${trilhaHoldingAtiva ? `<p><strong>Estrutura especial:</strong> Holding / avaliação de holding</p>` : ""}
    ${trilhaHoldingAtiva && tiposHolding.length ? `<p><strong>Perfil informado:</strong> ${escaparHtml(tiposHolding.map((id) => TIPOS_HOLDING.find((t) => t.id === id)?.label || id).join(" · "))}</p>` : ""}
    ${trilhaHoldingAtiva && objetivosHolding.length ? `<p><strong>Objetivos:</strong> ${escaparHtml(objetivosHolding.join(" · "))}</p>` : ""}
  </div>

  ${resumoExecutivo ? `
    <h2>Leitura executiva</h2>
    <div class="insight">${escaparHtml(resumoExecutivo)}</div>
  ` : ""}

  ${inteligenciaTributaria?.disponivel ? `
    <h2>Inteligência tributária</h2>
    <div class="box">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
        <div>
          <strong>Faturamento de referência</strong><br>
          ${escaparHtml(moedaTributaria(inteligenciaTributaria.faturamentoMensalReferencia))}/mês
        </div>
        <div>
          <strong>Tributos estimados</strong><br>
          ${escaparHtml(moedaTributaria(inteligenciaTributaria.tributosMensaisEstimados))}/mês
        </div>
        <div>
          <strong>Carga tributária estimada</strong><br>
          <span style="font-size:18px;color:#993C1D;font-weight:800;">
            ${escaparHtml(percentualTributario(inteligenciaTributaria.cargaTributariaEstimada))}
          </span>
        </div>
      </div>

      <p style="margin:0 0 8px;">
        A cada R$ 100 faturados, aproximadamente
        <strong>R$ ${Number(inteligenciaTributaria.cargaTributariaEstimada).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}</strong>
        correspondem à carga tributária estimada nesta referência.
      </p>

      <div class="alerta">
        <strong>Reforma Tributária:</strong>
        impacto preliminar do segmento:
        <strong>${escaparHtml(inteligenciaTributaria.reforma?.status || "A avaliar")}</strong>.
        O efeito efetivo depende do regime, atividade, créditos, perfil dos clientes e das operações.
      </div>

      <p style="font-size:9.5px;color:#7A8495;margin:9px 0 0;font-style:italic;">
        Estimativa gerencial baseada na faixa de faturamento informada, regime e segmento.
        Não representa apuração fiscal definitiva.
      </p>
    </div>
  ` : ""}

  ${leituraDaDorIa ? `
    <h2>O que suas respostas estão mostrando</h2>
    <div class="box">${escaparHtml(leituraDaDorIa)}</div>
  ` : ""}

  ${conexoesExecutivas.length ? `
    <h2>Conexões que merecem atenção</h2>
    <div class="box"><ul>${listaHtml(conexoesExecutivas)}</ul></div>
  ` : ""}

  ${impactosExecutivos.length ? `
    <h2>Onde isso pode estar impactando</h2>
    <div class="box"><ul>${listaHtml(impactosExecutivos)}</ul></div>
  ` : ""}

  ${pontosFortesExecutivos.length ? `
    <h2>O que já está funcionando a seu favor</h2>
    <div class="positivo"><ul>${listaHtml(pontosFortesExecutivos)}</ul></div>
  ` : ""}

  ${alertaEstrategicoIa ? `
    <h2>Alerta estratégico</h2>
    <div class="alerta"><strong>${escaparHtml(alertaEstrategicoIa)}</strong></div>
  ` : ""}

  <h2>Prioridades identificadas</h2>
  <div class="prioridades">
    ${prioridadesExecutivas.map((item, i) => `
      <div class="prioridade">
        <div class="num">${i + 1}</div>
        <h3>${escaparHtml(item)}</h3>
        <span style="color:#5B667A">A prioridade indica onde aprofundar a análise. O plano de implementação deve ser definido após validação profissional.</span>
      </div>
    `).join("")}
  </div>

  <section class="cta">
    <h3>Seu diagnóstico mostrou onde olhar. Agora precisamos definir como agir.</h3>
    <p>A análise consultiva da Finder aprofunda as causas, valida os riscos e transforma as prioridades em um plano de ação adequado à realidade da empresa.</p>
    <a href="${whatsappEspecialista}">Quero falar com um especialista</a>
  </section>

  <p class="aviso">
    Este é um diagnóstico executivo preliminar elaborado a partir das informações fornecidas pelo participante. A análise técnica completa, validação dos achados e definição das ações exigem avaliação profissional individualizada.
  </p>

  <div class="footer">
    Finder of Solutions · Diagnóstico Executivo Empresarial · Gerado em ${escaparHtml(dataGeracao)}
  </div>

</body>
</html>`;

    try {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const janela = window.open(url, "_blank");

      if (!janela) {
        URL.revokeObjectURL(url);
        showToast("Permita pop-ups no navegador para gerar o PDF.");
        return;
      }

      janela.addEventListener(
        "load",
        () => {
          setTimeout(() => {
            try {
              janela.focus();
              janela.print();
            } finally {
              setTimeout(() => URL.revokeObjectURL(url), 10000);
            }
          }, 700);
        },
        { once: true }
      );
    } catch (erro) {
      console.error("Erro ao gerar relatório executivo:", erro);
      showToast("Não foi possível gerar o relatório executivo.");
    }
  }


  if (!acessoLiberado) {
    return (
      <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0E1A33 0%,#17233D 55%,#253451 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:20, boxSizing:"border-box", fontFamily:BODY_FONT }}>
        <form onSubmit={validarAcessoApp} style={{ width:"100%", maxWidth:390, background:WHITE, borderRadius:18, padding:28, boxShadow:"0 24px 70px rgba(0,0,0,.28)" }}>
          <div style={{ fontSize:11, fontWeight:900, letterSpacing:1.2, color:CORAL, marginBottom:7 }}>FINDER OF SOLUTIONS</div>
          <h1 style={{ margin:"0 0 7px", color:NAVY, fontSize:26, lineHeight:1.1, fontFamily:DISPLAY_FONT }}>Acesso ao diagnóstico</h1>
          <p style={{ margin:"0 0 20px", color:MUTED, fontSize:13, lineHeight:1.55 }}>Digite a senha para acessar o aplicativo.</p>
          <label htmlFor="senha-acesso-app" style={{ display:"block", color:NAVY, fontSize:11, fontWeight:800, marginBottom:6 }}>SENHA</label>
          <input id="senha-acesso-app" type="password" inputMode="numeric" autoFocus value={senhaAcesso}
            onChange={(event)=>{ setSenhaAcesso(event.target.value); setErroSenhaAcesso(""); }}
            placeholder="Digite a senha"
            style={{ width:"100%", boxSizing:"border-box", border:erroSenhaAcesso ? "1px solid #D92D20" : "1px solid #D0D5DD", borderRadius:10, padding:"12px 13px", fontSize:15, outline:"none", marginBottom:erroSenhaAcesso ? 7 : 14 }}
          />
          {erroSenhaAcesso && <div style={{ color:"#D92D20", fontSize:11.5, marginBottom:12 }}>{erroSenhaAcesso}</div>}
          <button type="submit" style={{ width:"100%", border:0, borderRadius:10, padding:"12px 14px", background:CORAL, color:WHITE, fontSize:13, fontWeight:900, cursor:"pointer" }}>Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <div
      className="finder-public-stage"
      style={{
        background: "#EEF0F5",
        minHeight: 760,
        display: "flex",
        justifyContent: "center",
        padding: "32px 16px",
        fontFamily: BODY_FONT,
        boxSizing: "border-box",
      }}
    >
      <style>{`
        .finder-public-stage {
          width: 100%;
          overflow-x: hidden;
        }

        .finder-phone-shell {
          width: 380px;
          max-width: 100%;
        }

        .finder-form-content {
          min-width: 0;
        }

        .finder-form-content input,
        .finder-form-content select,
        .finder-form-content textarea,
        .finder-form-content button {
          max-width: 100%;
        }

        .finder-form-content textarea {
          font-size: 16px !important;
        }

        @media (max-width: 600px) {
          html,
          body,
          #root {
            width: 100%;
            max-width: 100%;
            margin: 0;
            overflow-x: hidden;
          }

          .finder-public-stage {
            display: block !important;
            min-height: 100vh !important;
            padding: 0 !important;
            background: #FFFFFF !important;
          }

          .finder-phone-shell {
            width: 100% !important;
            max-width: none !important;
            min-height: 100vh !important;
            padding: 0 !important;
            border-radius: 0 !important;
            background: #FFFFFF !important;
            box-shadow: none !important;
          }

          .finder-phone-notch {
            display: none !important;
          }

          .finder-phone-screen {
            min-height: 100vh !important;
            border-radius: 0 !important;
            overflow: visible !important;
          }

          .finder-form-content {
            padding: 14px 18px 24px !important;
          }

          .finder-form-content h1 {
            line-height: 1.15 !important;
          }

          .finder-form-content button {
            touch-action: manipulation;
          }
        }

        @media (max-width: 360px) {
          .finder-form-content {
            padding-left: 14px !important;
            padding-right: 14px !important;
          }
        }
      `}</style>

      <div
        className="finder-phone-shell"
        style={{
          width: 380,
          borderRadius: 40,
          background: NAVY,
          padding: 12,
          boxShadow: "0 30px 60px rgba(23,35,61,0.25)",
          boxSizing: "border-box",
        }}
      >
        <div
          className="finder-phone-notch"
          style={{
            width: 120,
            height: 22,
            background: NAVY,
            borderRadius: 12,
            margin: "0 auto 4px",
            position: "relative",
          }}
        >
          <div
            style={{
              width: 46,
              height: 6,
              background: "#0B1526",
              borderRadius: 4,
              position: "absolute",
              left: "50%",
              top: 8,
              transform: "translateX(-50%)",
            }}
          />
        </div>

        <div
          className="finder-phone-screen"
          style={{
            background: WHITE,
            borderRadius: 28,
            minHeight: 686,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <StepDots step={step} />

          {rascunhoPendente && (
            <div
              style={{
                margin:
                  "10px 18px 4px",
                padding: 14,
                borderRadius: 14,
                background:
                  "#FFF7F3",
                border:
                  "1px solid #FFD8CC",
              }}
            >
              <div
                style={{
                  color: NAVY,
                  fontSize: 14,
                  fontWeight: 900,
                }}
              >
                Continuar de onde você parou?
              </div>

              <div
                style={{
                  color: MUTED,
                  fontSize: 12,
                  lineHeight: 1.45,
                  marginTop: 5,
                }}
              >
                Encontramos um diagnóstico em andamento neste aparelho. Seu preenchimento foi salvo automaticamente.
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                <button
                  type="button"
                  onClick={
                    continuarRascunho
                  }
                  style={{
                    width: "100%",
                    minHeight: 46,
                    border: 0,
                    borderRadius: 11,
                    background:
                      CORAL,
                    color: WHITE,
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Continuar de onde parei
                </button>

                <button
                  type="button"
                  onClick={
                    comecarNovamente
                  }
                  style={{
                    width: "100%",
                    minHeight: 44,
                    border:
                      "1px solid #D8DEEA",
                    borderRadius: 11,
                    background:
                      WHITE,
                    color: NAVY,
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Começar novamente
                </button>
              </div>
            </div>
          )}

          <div
            className="finder-form-content"
            style={{
              flex: 1,
              padding: "18px 22px 22px",
              display: "flex",
              flexDirection: "column",
              boxSizing: "border-box",
              opacity:
                rascunhoPendente
                  ? 0.32
                  : 1,
              pointerEvents:
                rascunhoPendente
                  ? "none"
                  : "auto",
              transition:
                "opacity .2s ease",
            }}
          >

            {step === "intro" && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  gap: 14,
                  padding: "20px 14px",
                }}
              >
                <img
                  src="/finder-logo.png"
                  alt="Finder of Solutions"
                  style={{
                    width: 210,
                    maxWidth: "88%",
                    height: "auto",
                    objectFit: "contain",
                    marginBottom: 2,
                  }}
                />

                <div>
                  <h1
                    style={{
                      fontFamily: DISPLAY_FONT,
                      fontSize: 28,
                      fontWeight: 800,
                      color: NAVY,
                      margin: "2px 0 7px",
                    }}
                  >
                    Diagnóstico Empresarial
                  </h1>

                  <p
                    style={{
                      fontSize: 13.5,
                      color: MUTED,
                      lineHeight: 1.5,
                      maxWidth: 360,
                      margin: "0 auto",
                    }}
                  >
                    Descubra em poucos minutos os principais gargalos e oportunidades da sua empresa.
                  </p>
                </div>

                <div
                  style={{
                    background: "#FFFFFF",
                    padding: 10,
                    borderRadius: 18,
                    border: "1px solid #E5E7EB",
                    boxShadow: "0 8px 26px rgba(23,35,61,0.10)",
                  }}
                >
                  <img
                    src="/qrcode-diagnostico.png"
                    alt="QR Code do Diagnóstico Empresarial"
                    style={{
                      width: 190,
                      height: 190,
                      display: "block",
                      objectFit: "contain",
                    }}
                  />
                </div>

                <div>
                  <p
                    style={{
                      fontFamily: DISPLAY_FONT,
                      fontSize: 18,
                      fontWeight: 700,
                      color: NAVY,
                      margin: "0 0 5px",
                    }}
                  >
                    Escaneie para começar
                  </p>

                  <p
                    style={{
                      fontSize: 12,
                      color: MUTED,
                      lineHeight: 1.45,
                      maxWidth: 340,
                      margin: 0,
                    }}
                  >
                    Faça seu diagnóstico gratuito e descubra onde sua empresa pode melhorar.
                  </p>
                </div>

                <div
                  style={{
                    width: "100%",
                    maxWidth: 330,
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    margin: "1px 0",
                  }}
                >
                  <div style={{ height: 1, background: "#E5E7EB", flex: 1 }} />
                  <span style={{ fontSize: 11.5, color: MUTED }}>ou</span>
                  <div style={{ height: 1, background: "#E5E7EB", flex: 1 }} />
                </div>

                <PrimaryButton onClick={() => setStep("cadastro")}>
                  Iniciar diagnóstico <ArrowRight size={16} />
                </PrimaryButton>
              </div>
            )}

            

            {step === "cadastro" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <p style={{ fontFamily: DISPLAY_FONT, fontSize: 20, fontWeight: 700, color: NAVY, margin: "6px 0 4px" }}>Vamos te conhecer</p>
                <p style={{ fontSize: 12.5, color: MUTED, margin: "0 0 18px" }}>Leva menos de 20 segundos.</p>

                <label style={labelStyle}>Nome</label>
                <input style={inputStyle} placeholder="Seu nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />

                <label style={labelStyle}>Seu papel na empresa</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                  {["Sócio/Dono", "Diretor", "Gerente", "Colaborador"].map((c) => (
                    <button key={c} onClick={() => setCargo(c)} style={chipStyle(cargo === c)}>{c}</button>
                  ))}
                </div>

                <label style={labelStyle}>WhatsApp</label>
                <input style={inputStyle} placeholder="(41) 99999-9999" value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" />

                <label style={labelStyle}>E-mail</label>
                <input style={inputStyle} placeholder="voce@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />

                <label style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  fontSize: 10.8,
                  lineHeight: 1.4,
                  color: MUTED,
                  margin: "-4px 0 14px",
                  cursor: "pointer",
                }}>
                  <input
                    type="checkbox"
                    checked={consentimentoEmail}
                    onChange={(e) => setConsentimentoEmail(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    Quero receber meu diagnóstico por e-mail e comunicações relacionadas à consultoria da Finder.
                  </span>
                </label>

                <div style={{ flex: 1 }} />
                
                <PrimaryButton
                  disabled={
                    !nome ||
                    !cargo ||
                    telefone.replace(/\D/g, "").length < 10 ||
                    !email.includes("@")
                  }
                  onClick={() => setStep("estrutura")}
                >
                  Continuar <ArrowRight size={16} />
                </PrimaryButton>
              </div>
            )}

            {step === "estrutura" && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <p
                  style={{
                    fontFamily: DISPLAY_FONT,
                    fontSize: 21,
                    fontWeight: 700,
                    color: NAVY,
                    margin: "6px 0 4px",
                  }}
                >
                  Estrutura do negócio
                </p>

                <p
                  style={{
                    fontSize: 12.5,
                    color: MUTED,
                    margin: "0 0 16px",
                    lineHeight: 1.5,
                  }}
                >
                  Antes de analisar a operação, precisamos entender qual estrutura
                  representa melhor o negócio. Isso define o fluxo, as dores e as
                  perguntas do diagnóstico.
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    marginBottom: 14,
                  }}
                >
                  {ESTRUTURAS_NEGOCIO.map((item) => {
                    const selecionada =
                      estruturaNegocio === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setEstruturaNegocio(item.id);

                          // Ao trocar a estrutura, limpamos seleções específicas
                          // para evitar que dores de Holding contaminem outro fluxo.
                          setDoresSelecionadas([]);
                          setDores([]);
                          setDor90Dias("");
                          setImpactosDor([]);

                          if (
                            ![
                              "holding",
                              "avaliar_holding",
                            ].includes(item.id)
                          ) {
                            setTiposHolding([]);
                            setObjetivosHolding([]);
                            setPatrimonioHolding("");
                            setReceitasHolding("");
                            setSucessaoHolding("");
                          }

                          if (item.id !== "pessoa_fisica") {
                            setObjetivosPF([]);
                            setRendaMensalPF("");
                            setGastosMensaisPF("");
                            setDividasPF("");
                            setReservaPF("");
                            setPatrimonioPF("");
                            setInvestimentosPF("");
                            setAposentadoriaPF("");
                            setDependentesPF("");
                          }

                          if (item.id !== "grupo") {
                            setNomeGrupo("");
                            setFuncaoEmpresasGrupo("");
                            setSociosComunsGrupo("");
                            setFinanceiroCentralizadoGrupo("");
                            setPessoasCompartilhadasGrupo("");
                            setOperacoesIntercompanyGrupo("");
                            setGovernancaGrupo("");
                          }

                          if (item.id !== "spe") {
                            setSpeConstituida("");
                            setNomeProjetoSPE("");
                            setFinalidadeSPE("");
                            setSociosSPE("");
                            setValorProjetoSPE("");
                            setAportesSPE("");
                            setFinanciamentoSPE("");
                            setPrazoSPE("");
                            setReceitaPrevistaSPE("");
                            setCustosPrevistosSPE("");
                            setFaseProjetoSPE("");
                          }
                        }}
                        style={{
                          ...chipStyle(
                            selecionada
                          ),
                          width: "100%",
                          minHeight: 48,
                          textAlign: "left",
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                {trilhaGrupoAtiva && (
                  <div style={{ background: "#F7F8FB", border: "1px solid #E3E7EF", borderRadius: 12, padding: 14, marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                      <Building2 size={16} color={CORAL} />
                      <strong style={{ fontSize: 13, color: NAVY }}>Contexto do grupo empresarial</strong>
                    </div>
                    <p style={{ fontSize: 10.7, color: MUTED, margin: "0 0 13px", lineHeight: 1.5 }}>
                      Registre como o grupo funciona antes de informar os CNPJs. Isso melhora a análise de governança, caixa consolidado e operações entre empresas.
                    </p>

                    <label style={labelStyle}>Nome do grupo</label>
                    <input value={nomeGrupo} onChange={(e) => setNomeGrupo(e.target.value)} placeholder="Ex.: Grupo Finder" style={{ ...inputStyle, marginBottom: 10 }} />

                    <label style={labelStyle}>Qual é a função de cada empresa?</label>
                    <textarea value={funcaoEmpresasGrupo} onChange={(e) => setFuncaoEmpresasGrupo(e.target.value)}
                      placeholder="Ex.: indústria fabrica; comercial vende; holding concentra participações."
                      rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: BODY_FONT, marginBottom: 10 }} />

                    <label style={labelStyle}>Os sócios são os mesmos nas empresas?</label>
                    <textarea value={sociosComunsGrupo} onChange={(e) => setSociosComunsGrupo(e.target.value)}
                      placeholder="Ex.: mesmos sócios e percentuais; ou composições diferentes."
                      rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: BODY_FONT, marginBottom: 10 }} />

                    <label style={labelStyle}>Financeiro / caixa é centralizado?</label>
                    <textarea value={financeiroCentralizadoGrupo} onChange={(e) => setFinanceiroCentralizadoGrupo(e.target.value)}
                      placeholder="Ex.: tesouraria central; cada empresa possui caixa próprio."
                      rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: BODY_FONT, marginBottom: 10 }} />

                    <label style={labelStyle}>Há funcionários, despesas ou estruturas compartilhadas?</label>
                    <textarea value={pessoasCompartilhadasGrupo} onChange={(e) => setPessoasCompartilhadasGrupo(e.target.value)}
                      placeholder="Ex.: administrativo, comercial, aluguel, veículos, TI."
                      rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: BODY_FONT, marginBottom: 10 }} />

                    <label style={labelStyle}>Existem operações entre as próprias empresas?</label>
                    <textarea value={operacoesIntercompanyGrupo} onChange={(e) => setOperacoesIntercompanyGrupo(e.target.value)}
                      placeholder="Ex.: mútuos, repasses, serviços, vendas, rateios ou adiantamentos."
                      rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: BODY_FONT, marginBottom: 10 }} />

                    <label style={labelStyle}>Como as decisões do grupo são tomadas?</label>
                    <textarea value={governancaGrupo} onChange={(e) => setGovernancaGrupo(e.target.value)}
                      placeholder="Ex.: fundador centraliza; reunião de sócios; conselho; sem rotina formal."
                      rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: BODY_FONT }} />
                  </div>
                )}

                {trilhaPFAtiva && (
                  <div
                    style={{
                      background: "#F7F8FB",
                      border: "1px solid #E3E7EF",
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                      <User size={16} color={CORAL} />
                      <strong style={{ fontSize: 13, color: NAVY }}>
                        Consultoria para Pessoa Física
                      </strong>
                    </div>

                    <p style={{ fontSize: 10.7, color: MUTED, margin: "0 0 13px", lineHeight: 1.5 }}>
                      Escolha o que você quer organizar ou melhorar. As perguntas e os próximos passos serão adaptados às suas escolhas.
                    </p>

                    <label style={labelStyle}>Quais objetivos você quer trabalhar?</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 14 }}>
                      {OBJETIVOS_PF.map((objetivo) => (
                        <button
                          key={objetivo.id}
                          type="button"
                          onClick={() => toggleObjetivoPF(objetivo.id)}
                          style={{
                            ...chipStyle(objetivosPF.includes(objetivo.id)),
                            width: "100%",
                            minHeight: 46,
                            textAlign: "left",
                          }}
                        >
                          {objetivo.label}
                        </button>
                      ))}
                    </div>

                    <label style={labelStyle}>Renda mensal aproximada</label>
                    <input
                      value={rendaMensalPF}
                      onChange={(e) => setRendaMensalPF(e.target.value)}
                      placeholder="Ex.: R$ 8.000"
                      style={{ ...inputStyle, marginBottom: 10 }}
                    />

                    <label style={labelStyle}>Gastos mensais aproximados</label>
                    <input
                      value={gastosMensaisPF}
                      onChange={(e) => setGastosMensaisPF(e.target.value)}
                      placeholder="Ex.: R$ 6.000"
                      style={{ ...inputStyle, marginBottom: 10 }}
                    />

                    <label style={labelStyle}>Dívidas ou parcelas relevantes</label>
                    <textarea
                      value={dividasPF}
                      onChange={(e) => setDividasPF(e.target.value)}
                      placeholder="Ex.: financiamento, cartão, consignado, empréstimos ou nenhuma dívida relevante."
                      rows={2}
                      style={{ ...inputStyle, resize: "vertical", fontFamily: BODY_FONT, marginBottom: 10 }}
                    />

                    <label style={labelStyle}>Reserva de emergência</label>
                    <textarea
                      value={reservaPF}
                      onChange={(e) => setReservaPF(e.target.value)}
                      placeholder="Ex.: não tenho reserva; tenho 3 meses de gastos; tenho R$ 30 mil reservados."
                      rows={2}
                      style={{ ...inputStyle, resize: "vertical", fontFamily: BODY_FONT, marginBottom: 10 }}
                    />

                    {objetivosPF.includes("investimentos") && (
                      <>
                        <label style={labelStyle}>Investimentos atuais</label>
                        <textarea
                          value={investimentosPF}
                          onChange={(e) => setInvestimentosPF(e.target.value)}
                          placeholder="Ex.: poupança, CDB, Tesouro, fundos, ações, previdência privada ou ainda não invisto."
                          rows={2}
                          style={{ ...inputStyle, resize: "vertical", fontFamily: BODY_FONT, marginBottom: 10 }}
                        />
                      </>
                    )}

                    {objetivosPF.includes("aposentadoria") && (
                      <>
                        <label style={labelStyle}>Objetivo de aposentadoria</label>
                        <textarea
                          value={aposentadoriaPF}
                          onChange={(e) => setAposentadoriaPF(e.target.value)}
                          placeholder="Ex.: quero me aposentar aos 60 anos com renda mensal de R$ 10 mil."
                          rows={2}
                          style={{ ...inputStyle, resize: "vertical", fontFamily: BODY_FONT, marginBottom: 10 }}
                        />
                      </>
                    )}

                    {(objetivosPF.includes("patrimonio") || objetivosPF.includes("protecao")) && (
                      <>
                        <label style={labelStyle}>Patrimônio e dependentes</label>
                        <textarea
                          value={patrimonioPF}
                          onChange={(e) => setPatrimonioPF(e.target.value)}
                          placeholder="Ex.: imóvel próprio, veículo, investimentos e outros bens."
                          rows={2}
                          style={{ ...inputStyle, resize: "vertical", fontFamily: BODY_FONT, marginBottom: 10 }}
                        />
                        <textarea
                          value={dependentesPF}
                          onChange={(e) => setDependentesPF(e.target.value)}
                          placeholder="Ex.: cônjuge, filhos, pais ou outras pessoas dependentes."
                          rows={2}
                          style={{ ...inputStyle, resize: "vertical", fontFamily: BODY_FONT }}
                        />
                      </>
                    )}
                  </div>
                )}

                {trilhaSPEAtiva && (
                  <div style={{ background: "#F7F8FB", border: "1px solid #E3E7EF", borderRadius: 12, padding: 14, marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                      <Target size={16} color={CORAL} />
                      <strong style={{ fontSize: 13, color: NAVY }}>Contexto da SPE / empreendimento</strong>
                    </div>

                    <label style={labelStyle}>A SPE já está constituída?</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 12 }}>
                      {[["sim", "Sim, já possui CNPJ"], ["nao", "Ainda não / em estruturação"]].map(([id, label]) => (
                        <button key={id} type="button" onClick={() => setSpeConstituida(id)} style={chipStyle(speConstituida === id)}>
                          {label}
                        </button>
                      ))}
                    </div>

                    <label style={labelStyle}>Nome do projeto / empreendimento</label>
                    <input value={nomeProjetoSPE} onChange={(e) => setNomeProjetoSPE(e.target.value)}
                      placeholder="Ex.: Residencial Alameda" style={{ ...inputStyle, marginBottom: 10 }} />

                    <label style={labelStyle}>Qual é a finalidade da SPE?</label>
                    <textarea value={finalidadeSPE} onChange={(e) => setFinalidadeSPE(e.target.value)}
                      placeholder="Ex.: desenvolver e comercializar empreendimento imobiliário específico."
                      rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: BODY_FONT, marginBottom: 10 }} />

                    <label style={labelStyle}>Sócios / investidores</label>
                    <textarea value={sociosSPE} onChange={(e) => setSociosSPE(e.target.value)}
                      placeholder="Ex.: 3 sócios, percentuais e papel de cada um."
                      rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: BODY_FONT, marginBottom: 10 }} />

                    <label style={labelStyle}>Valor aproximado do projeto</label>
                    <input value={valorProjetoSPE} onChange={(e) => setValorProjetoSPE(e.target.value)}
                      placeholder="Ex.: R$ 8 milhões" style={{ ...inputStyle, marginBottom: 10 }} />

                    <label style={labelStyle}>Aportes realizados / previstos</label>
                    <textarea value={aportesSPE} onChange={(e) => setAportesSPE(e.target.value)}
                      placeholder="Ex.: R$ 1,5 milhão aportado; novas chamadas conforme cronograma."
                      rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: BODY_FONT, marginBottom: 10 }} />

                    <label style={labelStyle}>Financiamento / capital de terceiros</label>
                    <textarea value={financiamentoSPE} onChange={(e) => setFinanciamentoSPE(e.target.value)}
                      placeholder="Ex.: financiamento bancário previsto; investidores; sem financiamento."
                      rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: BODY_FONT, marginBottom: 10 }} />

                    <label style={labelStyle}>Prazo do projeto</label>
                    <input value={prazoSPE} onChange={(e) => setPrazoSPE(e.target.value)}
                      placeholder="Ex.: 30 meses" style={{ ...inputStyle, marginBottom: 10 }} />

                    <label style={labelStyle}>Receita prevista</label>
                    <input value={receitaPrevistaSPE} onChange={(e) => setReceitaPrevistaSPE(e.target.value)}
                      placeholder="Ex.: VGV / receita estimada de R$ 12 milhões" style={{ ...inputStyle, marginBottom: 10 }} />

                    <label style={labelStyle}>Custos previstos</label>
                    <input value={custosPrevistosSPE} onChange={(e) => setCustosPrevistosSPE(e.target.value)}
                      placeholder="Ex.: custo estimado de R$ 7,2 milhões" style={{ ...inputStyle, marginBottom: 10 }} />

                    <label style={labelStyle}>Fase atual</label>
                    <textarea value={faseProjetoSPE} onChange={(e) => setFaseProjetoSPE(e.target.value)}
                      placeholder="Ex.: estruturação, aprovação, obras, vendas, conclusão ou encerramento."
                      rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: BODY_FONT }} />
                  </div>
                )}

                {trilhaHoldingAtiva && (
                  <div
                    style={{
                      background: "#F7F8FB",
                      border: "1px solid #E3E7EF",
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        marginBottom: 5,
                      }}
                    >
                      <Building2
                        size={16}
                        color={CORAL}
                      />

                      <strong
                        style={{
                          fontSize: 13,
                          color: NAVY,
                        }}
                      >
                        {avaliarHoldingAtiva
                          ? "Avaliação de viabilidade de Holding"
                          : "Trilha especializada de Holding"}
                      </strong>
                    </div>

                    <p
                      style={{
                        fontSize: 10.7,
                        color: MUTED,
                        margin: "0 0 13px",
                        lineHeight: 1.5,
                      }}
                    >
                      {avaliarHoldingAtiva
                        ? "Você ainda não precisa saber qual tipo de holding seria adequado. Informe seus objetivos e, se souber, algumas características do patrimônio. O diagnóstico fará perguntas para avaliar se a estrutura faz sentido e qual caminho merece estudo."
                        : "Selecione as características que mais se aproximam da estrutura atual. Essas respostas serão usadas para gerar perguntas específicas de patrimônio, sucessão, tributação, governança e participações."}
                    </p>

                    <label style={labelStyle}>
                      {avaliarHoldingAtiva
                        ? "Tipo de holding, se você já tiver alguma hipótese (opcional)"
                        : "Tipo ou finalidade da holding"}
                    </label>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 7,
                        marginBottom: 14,
                      }}
                    >
                      {TIPOS_HOLDING.map(
                        (tipo) => {
                          const selecionado =
                            tiposHolding.includes(
                              tipo.id
                            );

                          return (
                            <button
                              key={tipo.id}
                              type="button"
                              title={
                                tipo.descricao
                              }
                              onClick={() =>
                                toggleTipoHolding(
                                  tipo.id
                                )
                              }
                              style={{
                                ...chipStyle(
                                  selecionado
                                ),
                                width: "100%",
                                minHeight: 48,
                                textAlign: "left",
                              }}
                            >
                              {tipo.label}
                            </button>
                          );
                        }
                      )}
                    </div>

                    <label style={labelStyle}>
                      O que você pretende resolver com essa estrutura?
                    </label>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 7,
                        marginBottom: 14,
                      }}
                    >
                      {OBJETIVOS_HOLDING.map(
                        (objetivo) => (
                          <button
                            key={objetivo}
                            type="button"
                            onClick={() =>
                              toggleObjetivoHolding(
                                objetivo
                              )
                            }
                            style={{
                              ...chipStyle(
                                objetivosHolding.includes(
                                  objetivo
                                )
                              ),
                              width: "100%",
                              minHeight: 44,
                              textAlign: "left",
                            }}
                          >
                            {objetivo}
                          </button>
                        )
                      )}
                    </div>

                    <label style={labelStyle}>
                      Patrimônio aproximado / principais ativos
                    </label>

                    <textarea
                      value={
                        patrimonioHolding
                      }
                      onChange={(e) =>
                        setPatrimonioHolding(
                          e.target.value
                        )
                      }
                      placeholder="Ex.: 6 imóveis, participação em 2 empresas, veículos e aplicações."
                      rows={2}
                      style={{
                        ...inputStyle,
                        resize: "vertical",
                        fontFamily: BODY_FONT,
                        marginBottom: 10,
                      }}
                    />

                    <label style={labelStyle}>
                      Receitas patrimoniais ou imobiliárias
                    </label>

                    <textarea
                      value={
                        receitasHolding
                      }
                      onChange={(e) =>
                        setReceitasHolding(
                          e.target.value
                        )
                      }
                      placeholder="Ex.: aluguéis, dividendos, venda eventual de imóveis ou outras receitas."
                      rows={2}
                      style={{
                        ...inputStyle,
                        resize: "vertical",
                        fontFamily: BODY_FONT,
                        marginBottom: 10,
                      }}
                    />

                    <label style={labelStyle}>
                      Situação sucessória / familiar
                    </label>

                    <textarea
                      value={
                        sucessaoHolding
                      }
                      onChange={(e) =>
                        setSucessaoHolding(
                          e.target.value
                        )
                      }
                      placeholder="Ex.: herdeiros, doação de quotas, usufruto, regras de administração ou sucessão ainda não planejada."
                      rows={2}
                      style={{
                        ...inputStyle,
                        resize: "vertical",
                        fontFamily: BODY_FONT,
                      }}
                    />
                  </div>
                )}

                <div style={{ flex: 1 }} />

                <PrimaryButton
                  disabled={
                    !estruturaNegocio ||
                    (
                      estruturaNegocio === "holding" &&
                      (
                        tiposHolding.length === 0 ||
                        objetivosHolding.length === 0
                      )
                    ) ||
                    (
                      avaliarHoldingAtiva &&
                      objetivosHolding.length === 0
                    ) ||
                    (
                      trilhaPFAtiva &&
                      objetivosPF.length === 0
                    ) ||
                    (
                      trilhaGrupoAtiva &&
                      (
                        !nomeGrupo.trim() ||
                        !funcaoEmpresasGrupo.trim()
                      )
                    ) ||
                    (
                      trilhaSPEAtiva &&
                      (
                        !speConstituida ||
                        !nomeProjetoSPE.trim() ||
                        !finalidadeSPE.trim()
                      )
                    )
                  }
                  onClick={() => {
                    if (trilhaPFAtiva || avaliarHoldingAtiva) {
                      setStep("dor");
                      return;
                    }

                    if (trilhaSPEAtiva && speConstituida !== "sim") {
                      setStep("dor");
                      return;
                    }

                    setStep("cnpj");
                  }}
                >
                  Continuar
                  <ArrowRight size={16} />
                </PrimaryButton>
              </div>
            )}

            {step === "cnpj" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <p
                  style={{
                    fontFamily: DISPLAY_FONT,
                    fontSize: 20,
                    fontWeight: 700,
                    color: NAVY,
                    margin: "6px 0 4px",
                  }}
                >
                  {estruturaNegocio === "holding"
                    ? "CNPJ da holding"
                    : estruturaNegocio === "grupo"
                    ? "CNPJs do grupo empresarial"
                    : estruturaNegocio === "spe"
                    ? "CNPJ da SPE"
                    : "CNPJ da empresa"}
                </p>

                <p
                  style={{
                    fontSize: 12.5,
                    color: MUTED,
                    margin: "0 0 14px",
                    lineHeight: 1.5,
                  }}
                >
                  {estruturaNegocio === "holding"
                    ? "Informe o CNPJ da holding existente. Os dados cadastrais serão cruzados com patrimônio, participações, receitas, governança e sucessão."
                    : estruturaNegocio === "grupo"
                    ? `Adicione a empresa-base e, se necessário, outras empresas do grupo. Você pode adicionar até ${MAX_EMPRESAS} CNPJs.`
                    : "Adicione o CNPJ que será a base do diagnóstico."}
                </p>

                <label style={labelStyle}>CNPJ</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                  <input style={{ ...inputStyle, marginBottom: 0, flex: 1 }} placeholder="00.000.000/0001-00" value={cnpjInput}
                    onChange={(e) => setCnpjInput(e.target.value)} />
                </div>
                <button onClick={adicionarCnpj} disabled={!cnpjInput || buscando || empresas.length >= MAX_EMPRESAS} style={{
                  ...chipStyle(false), width: "100%", marginTop: 8, marginBottom: 14, display: "flex",
                  alignItems: "center", justifyContent: "center", gap: 8,
                  opacity: (!cnpjInput || empresas.length >= MAX_EMPRESAS) ? 0.5 : 1,
                }}>
                  {buscando ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
                  {buscando ? "Buscando dados..." : empresas.length >= MAX_EMPRESAS ? `Limite de ${MAX_EMPRESAS} CNPJs` : "Adicionar CNPJ"}
                </button>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", maxHeight: 300 }}>
                  {empresas.map((e, i) => (
                    <div key={i} style={{ background: ICE, borderRadius: 12, padding: 12, position: "relative" }}>
                      <button onClick={() => removerEmpresa(i)} style={{
                        position: "absolute", top: 10, right: 10, background: "none", border: "none", cursor: "pointer", color: MUTED,
                      }}><X size={14} /></button>
                      <p style={{ fontSize: 12.5, fontWeight: 700, color: NAVY, margin: "0 22px 4px 0" }}>{e.razao}</p>
                      <p style={{ fontSize: 11, color: MUTED, margin: "0 0 2px" }}>{e.cnae}</p>
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <span style={badgeStyle}>{e.categoria || e.segmento}</span>
                        <span style={badgeStyle}>{e.porte}</span>
                      </div>
                    </div>
                  ))}
                </div>


                {empresaPrincipal && cnaesEmpresa.length > 0 && (
                  <div
                    style={{
                      background: "#F7F8FB",
                      border: "1px solid #E1E5EC",
                      borderRadius: 12,
                      padding: 12,
                      marginTop: 12,
                      marginBottom: 12,
                    }}
                  >
                    <p
                      style={{
                        fontFamily: DISPLAY_FONT,
                        fontSize: 16,
                        fontWeight: 700,
                        color: NAVY,
                        margin: "0 0 5px",
                      }}
                    >
                      Atividades da empresa-base
                    </p>

                    <p
                      style={{
                        fontSize: 11.5,
                        color: MUTED,
                        lineHeight: 1.45,
                        margin: "0 0 10px",
                      }}
                    >
                      Marque as atividades que a empresa realmente exerce. Depois escolha qual delas representa hoje a maior parte da operação, faturamento ou esforço da empresa.
                    </p>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 7,
                      }}
                    >
                      {cnaesEmpresa.map((atividade) => {
                        const codigo =
                          String(atividade.codigo || "");

                        const selecionada =
                          atividadesSelecionadas.includes(
                            codigo
                          );

                        return (
                          <label
                            key={`${codigo}-${atividade.descricao}`}
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "flex-start",

                              background:
                                selecionada
                                  ? "#FFF3EF"
                                  : "#FFFFFF",

                              border:
                                selecionada
                                  ? `1px solid ${CORAL}`
                                  : "1px solid #E1E5EC",

                              borderRadius: 9,
                              padding: 9,
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"

                              checked={
                                selecionada
                              }

                              onChange={() => {
                                setAtividadesSelecionadas(
                                  (prev) => {
                                    if (selecionada) {
                                      const novas =
                                        prev.filter(
                                          (item) =>
                                            item !== codigo
                                        );

                                      if (
                                        String(
                                          atividadePredominante
                                            ?.codigo ||
                                          ""
                                        ) ===
                                        codigo
                                      ) {
                                        const proxima =
                                          cnaesEmpresa.find(
                                            (item) =>
                                              novas.includes(
                                                String(
                                                  item.codigo
                                                )
                                              )
                                          );

                                        setAtividadePredominante(
                                          proxima ||
                                          null
                                        );
                                      }

                                      return novas;
                                    }

                                    const novas = [
                                      ...prev,
                                      codigo,
                                    ];

                                    if (!atividadePredominante) {
                                      setAtividadePredominante(
                                        atividade
                                      );
                                    }

                                    return novas;
                                  }
                                );
                              }}

                              style={{
                                marginTop: 2,
                              }}
                            />

                            <span
                              style={{
                                fontSize: 11.3,
                                color: NAVY,
                                lineHeight: 1.4,
                              }}
                            >
                              <strong>
                                {codigo || "Sem código"}
                              </strong>

                              {" — "}

                              {
                                atividade.descricao ||
                                "Descrição não informada"
                              }

                              {atividade.principal && (
                                <span
                                  style={{
                                    display: "inline-block",
                                    marginLeft: 6,
                                    padding: "2px 5px",
                                    borderRadius: 5,
                                    background: "#FFE8DF",
                                    color: CORAL,
                                    fontSize: 9,
                                    fontWeight: 700,
                                  }}
                                >
                                  CNAE principal cadastrado
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    {atividadesSelecionadasObjetos.length > 0 && (
                      <div
                        style={{
                          marginTop: 14,
                          paddingTop: 12,
                          borderTop: "1px solid #D8DEEA",
                        }}
                      >
                        <p
                          style={{
                            fontFamily: DISPLAY_FONT,
                            fontSize: 14.5,
                            fontWeight: 700,
                            color: NAVY,
                            margin: "0 0 4px",
                          }}
                        >
                          Qual atividade é predominante na prática?
                        </p>

                        <p
                          style={{
                            fontSize: 10.8,
                            color: MUTED,
                            lineHeight: 1.4,
                            margin: "0 0 8px",
                          }}
                        >
                          Essa escolha definirá o segmento, a categoria e a base das perguntas do diagnóstico.
                        </p>

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          {atividadesSelecionadasObjetos.map(
                            (atividade) => {
                              const codigo =
                                String(
                                  atividade.codigo ||
                                  ""
                                );

                              const predominante =
                                String(
                                  atividadePredominante
                                    ?.codigo ||
                                  ""
                                ) ===
                                codigo;

                              return (
                                <label
                                  key={`pred-${codigo}-${atividade.descricao}`}
                                  style={{
                                    display: "flex",
                                    gap: 8,
                                    alignItems: "flex-start",
                                    cursor: "pointer",
                                    fontSize: 11.3,
                                    color: NAVY,
                                    padding: 8,
                                    borderRadius: 8,

                                    background:
                                      predominante
                                        ? "#EEF3FF"
                                        : "#FFFFFF",

                                    border:
                                      predominante
                                        ? "1px solid #6783C4"
                                        : "1px solid #E1E5EC",
                                  }}
                                >
                                  <input
                                    type="radio"
                                    name="atividadePredominante"

                                    checked={
                                      predominante
                                    }

                                    onChange={() =>
                                      setAtividadePredominante(
                                        atividade
                                      )
                                    }

                                    style={{
                                      marginTop: 2,
                                    }}
                                  />

                                  <span>
                                    <strong>
                                      {codigo}
                                    </strong>

                                    {" — "}

                                    {
                                      atividade.descricao
                                    }
                                  </span>
                                </label>
                              );
                            }
                          )}
                        </div>

                        {atividadePredominante && (
                          <div
                            style={{
                              marginTop: 10,
                              padding: 9,
                              borderRadius: 8,
                              background: "#EEF8F3",
                              border: "1px solid #C9E8D8",
                            }}
                          >
                            <p
                              style={{
                                margin: 0,
                                fontSize: 10.8,
                                lineHeight: 1.5,
                                color: NAVY,
                              }}
                            >
                              <strong>
                                Base do diagnóstico:
                              </strong>{" "}
                              {
                                atividadePredominante
                                  .descricao
                              }

                              <br />

                              <strong>
                                Segmento:
                              </strong>{" "}
                              {
                                segmentoPredominante ||
                                "-"
                              }

                              <br />

                              <strong>
                                Categoria:
                              </strong>{" "}
                              {
                                categoriaPrincipal ||
                                "-"
                              }
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {empresaPrincipal && (
                  <div style={{ marginTop: 12 }}>
                    <label style={labelStyle}>
                      Descreva brevemente o que seu negócio realmente faz
                    </label>
                    <textarea
                      value={descricaoNegocio}
                      onChange={(e) => setDescricaoNegocio(e.target.value)}
                      placeholder={
                        trilhaHoldingAtiva
                          ? "Ex.: A holding concentra imóveis de locação e participações em duas empresas da família. Hoje a principal preocupação é organizar sucessão, tributação e regras entre os herdeiros."
                          : empresas.length > 1
                          ? "Ex.: A empresa A fabrica churrasqueiras metálicas e a empresa B realiza a comercialização e instalação dos produtos."
                          : "Ex.: Fabricamos churrasqueiras metálicas, com modelos de linha e projetos sob medida, vendendo para consumidor final, lojistas e construtoras."
                      }
                      rows={4}
                      style={{ ...inputStyle, resize: "vertical", fontFamily: BODY_FONT, marginBottom: 6 }}
                    />
                    <p style={{ fontSize: 10.5, color: MUTED, margin: "0 0 8px", lineHeight: 1.4 }}>
                      {trilhaHoldingAtiva
                        ? "Não se limite ao CNAE. Explique quais bens, imóveis ou participações a estrutura possui ou pretende possuir, de onde vêm as receitas e qual é o objetivo da holding."
                        : "Não se limite ao CNAE. Explique o que vocês produzem, vendem ou entregam, para quem e como a operação funciona."}
                    </p>
                  </div>
                )}

                {empresas.length > 1 && (
                  <p style={{ fontSize: 11, color: CORAL, fontWeight: 600, margin: "10px 0 0" }}>
                    Segmento predominante do grupo: {segmentoPredominante}
                  </p>
                )}

                <div style={{ flex: 1, minHeight: 10 }} />
                <PrimaryButton
                  disabled={
                    empresas.length === 0 ||
                    atividadesSelecionadas.length === 0 ||
                    !atividadePredominante ||
                    descricaoNegocio.trim().length < 20
                  }
                  onClick={() => setStep("porte")}
                >
                  Continuar <ArrowRight size={16} />
                </PrimaryButton>
              </div>
            )}

            {step === "porte" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <p style={{ fontFamily: DISPLAY_FONT, fontSize: 20, fontWeight: 700, color: NAVY, margin: "6px 0 4px" }}>Alguns números da empresa</p>
                <p style={{ fontSize: 12.5, color: MUTED, margin: "0 0 16px" }}>Isso deixa o diagnóstico mais preciso, inclusive na parte tributária.</p>

                <label style={labelStyle}>Faturamento médio (do grupo)</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                  {FATURAMENTOS.map((f) => (
                    <button key={f.id} onClick={() => setFaturamento(f)} style={{ ...chipStyle(faturamento?.id === f.id), width: "100%" }}>{f.label}</button>
                  ))}
                </div>

                <label style={labelStyle}>Número de colaboradores</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
                  {COLABORADORES.map((c) => (
                    <button key={c} onClick={() => setColaboradores(c)} style={chipStyle(colaboradores === c)}>{c}</button>
                  ))}
                </div>

                <label style={labelStyle}>Regime tributário</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
                  {REGIMES.map((r) => (
                    <button key={r} onClick={() => setRegime(r)} style={chipStyle(regime === r)}>{r}</button>
                  ))}
                </div>

                <label style={labelStyle}>Observação (opcional)</label>
                <textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Algum ponto que queira destacar sobre o seu negócio?"
                  rows={3}
                  style={{ ...inputStyle, resize: "none", fontFamily: BODY_FONT }}
                />

                <div style={{ flex: 1, minHeight: 4 }} />
                <PrimaryButton disabled={!faturamento || !colaboradores || !regime} onClick={() => setStep("dor")}>
                  Continuar <ArrowRight size={16} />
                </PrimaryButton>
              </div>
            )}

            {step === "dor" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <p style={{ fontFamily: DISPLAY_FONT, fontSize: 22, fontWeight: 700, color: NAVY, margin: "6px 0 5px" }}>
                    {trilhaHoldingAtiva
                      ? "Vamos entender os pontos críticos da holding"
                      : trilhaPFAtiva
                      ? "Vamos entender sua vida financeira"
                      : "Vamos entender sua principal dor"}
                  </p>
                  <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5, margin: 0 }}>
                    {trilhaHoldingAtiva
                      ? "Essas respostas serão cruzadas com patrimônio, finalidade da holding, CNAEs, sucessão e estrutura societária para gerar perguntas específicas."
                      : trilhaPFAtiva
                      ? "As respostas serão cruzadas com os objetivos escolhidos para que o diagnóstico e os próximos passos sejam personalizados."
                      : "Essas respostas serão cruzadas com o CNAE e com o checklist para tornar o relatório mais específico."}
                  </p>
                </div>

                <div>
                  <p style={{ ...labelStyle, fontSize: 12, marginBottom: 5 }}>
                    {trilhaHoldingAtiva
                      ? "Quais situações mais preocupam na holding ou no patrimônio hoje?"
                      : trilhaPFAtiva
                      ? "Quais situações mais incomodam sua vida financeira hoje?"
                      : "Quais problemas mais incomodam sua empresa hoje?"}
                  </p>

                  <p style={{ fontSize: 10.8, color: MUTED, lineHeight: 1.4, margin: "0 0 9px" }}>
                    Você pode selecionar mais de uma opção. A análise vai cruzar essas dores com as respostas do diagnóstico.
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {doresDisponiveis.map((item) => {
                      const selecionada = doresSelecionadas.includes(item);

                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => toggleDorSelecionada(item)}
                          style={{
                            border: selecionada ? `2px solid ${CORAL}` : "1px solid #D8DEEA",
                            background: selecionada ? "#FFF3EF" : "#FFFFFF",
                            color: NAVY,
                            borderRadius: 10,
                            padding: "10px 9px",
                            textAlign: "left",
                            cursor: "pointer",
                            fontSize: 11.3,
                            fontWeight: selecionada ? 700 : 500,
                          }}
                        >
                          {selecionada ? "✓ " : ""}{item}
                        </button>
                      );
                    })}
                  </div>

                  {doresSelecionadas.length > 0 && (
                    <p style={{ fontSize: 10.5, color: CORAL, fontWeight: 700, margin: "8px 0 0" }}>
                      {doresSelecionadas.length} problema(s) selecionado(s)
                    </p>
                  )}
                </div>

                <div>
                  <label style={labelStyle}>
                    {trilhaHoldingAtiva
                      ? "Qual decisão ou problema patrimonial você gostaria de resolver primeiro?"
                      : trilhaPFAtiva
                      ? "Qual objetivo financeiro você gostaria de priorizar agora?"
                      : "Se pudesse resolver apenas um problema nos próximos 90 dias, qual seria?"}
                  </label>

                  <textarea
                    value={dor90Dias}
                    onChange={(e) => setDor90Dias(e.target.value)}
                    placeholder={
                      trilhaHoldingAtiva
                        ? "Ex.: definir se vale a pena integralizar os imóveis; organizar sucessão; revisar tributação dos aluguéis; estruturar regras entre os herdeiros..."
                        : trilhaPFAtiva
                        ? "Ex.: organizar meu orçamento; quitar dívidas; formar reserva; começar a investir; planejar aposentadoria..."
                        : "Ex.: aumentar vendas; descobrir por que o caixa não sobra; reduzir retrabalho..."
                    }
                    rows={3}
                    style={{
                      width: "100%",
                      border: "1px solid #D8DEEA",
                      borderRadius: 10,
                      padding: "11px 12px",
                      resize: "vertical",
                      fontFamily: "inherit",
                      fontSize: 12,
                      color: NAVY,
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <p style={{ ...labelStyle, marginBottom: 8 }}>
                    {trilhaPFAtiva
                      ? "Como esse problema está afetando sua vida financeira?"
                      : trilhaHoldingAtiva
                      ? "Qual impacto essa situação está causando no patrimônio ou na estrutura?"
                      : "Qual impacto esse problema está causando?"}
                  </p>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {impactosDisponiveis.map((impacto) => {
                      const ativo = impactosDor.includes(impacto);

                      return (
                        <button
                          key={impacto}
                          type="button"
                          onClick={() =>
                            setImpactosDor((prev) =>
                              ativo ? prev.filter((x) => x !== impacto) : [...prev, impacto]
                            )
                          }
                          style={{
                            border: ativo ? `1px solid ${CORAL}` : "1px solid #D8DEEA",
                            background: ativo ? "#FFF3EF" : "#FFFFFF",
                            color: NAVY,
                            borderRadius: 999,
                            padding: "7px 10px",
                            fontSize: 10.7,
                            fontWeight: ativo ? 700 : 500,
                            cursor: "pointer",
                          }}
                        >
                          {impacto}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ borderTop: "1px solid #E6E9EF", paddingTop: 14 }}>
                  <p style={{ fontFamily: DISPLAY_FONT, fontSize: 18, fontWeight: 700, color: NAVY, margin: "0 0 4px" }}>
                    {trilhaHoldingAtiva
                      ? "Quais frentes patrimoniais merecem mais atenção?"
                      : trilhaPFAtiva
                      ? "Quais áreas da sua vida financeira merecem mais atenção?"
                      : trilhaGrupoAtiva
                      ? "Quais frentes do grupo empresarial merecem mais atenção?"
                      : trilhaSPEAtiva
                      ? "Quais frentes da SPE merecem mais atenção?"
                      : "Quais áreas merecem mais atenção?"}
                  </p>

                  <p
                    style={{
                      fontSize: 11,
                      color:
                        dores.length ===
                        MAX_DORES
                          ? CORAL
                          : "#9AA3B5",
                      margin:
                        "0 0 4px",
                      fontWeight: 600,
                    }}
                  >
                    Escolha até {MAX_DORES} prioridades · {dores.length} selecionada(s)
                  </p>

                  <p
                    style={{
                      fontSize: 10.3,
                      color: MUTED,
                      margin:
                        "0 0 10px",
                      lineHeight: 1.45,
                    }}
                  >
                    O diagnóstico avaliará somente as frentes selecionadas. Cada pergunta deve poder ser respondida com Sim, Parcial ou Não.
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {areasDaEstrutura.map(({ id, label, Icon }) => {
                      const selecionada = dores.includes(id);
                      const bloqueada = !selecionada && dores.length >= MAX_DORES;

                      return (
                        <button
                          key={id}
                          type="button"
                          disabled={bloqueada}
                          onClick={() =>
                            setDores((prev) =>
                              selecionada
                                ? prev.filter((x) => x !== id)
                                : [...prev, id]
                            )
                          }
                          style={{
                            border: selecionada ? `2px solid ${CORAL}` : "1px solid #D8DEEA",
                            background: selecionada ? "#FFF3EF" : "#FFFFFF",
                            color: bloqueada ? "#B5BCC8" : NAVY,
                            borderRadius: 10,
                            padding: "10px 9px",
                            display: "flex",
                            gap: 7,
                            alignItems: "center",
                            cursor: bloqueada ? "not-allowed" : "pointer",
                            fontSize: 11.2,
                            fontWeight: selecionada ? 700 : 500,
                          }}
                        >
                          <Icon size={15} />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <PrimaryButton
                  disabled={doresSelecionadas.length === 0 || !dor90Dias.trim() || dores.length === 0 || gerandoPerguntas}
                  onClick={gerarPerguntasPersonalizadas}
                >
                  <Sparkles size={16} /> Gerar perguntas personalizadas
                </PrimaryButton>
              </div>
            )}

            

            {step === "gerandoPerguntas" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 14 }}>
                <Loader2 size={34} color={CORAL} className="spin" />
                <div>
                  <p style={{ fontFamily: DISPLAY_FONT, fontSize: 21, fontWeight: 700, color: NAVY, margin: "0 0 6px" }}>
                    {trilhaPFAtiva
                      ? "Entendendo sua vida financeira"
                      : trilhaHoldingAtiva
                      ? "Entendendo sua estrutura patrimonial"
                      : "Entendendo o seu negócio"}
                  </p>
                  <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, maxWidth: 360, margin: 0 }}>
                    {trilhaPFAtiva
                      ? "Cruzando seus objetivos, renda, gastos, reserva, dores e áreas selecionadas para montar perguntas específicas."
                      : trilhaHoldingAtiva
                      ? "Cruzando objetivos patrimoniais, bens, receitas, sucessão, dores e áreas selecionadas para montar perguntas específicas."
                      : "Cruzando CNAEs, atividade informada, descrição do negócio, dores e departamentos selecionados para montar perguntas específicas."}
                  </p>
                </div>
              </div>
            )}

            {step === "confirmarNegocio" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <p style={{ fontFamily: DISPLAY_FONT, fontSize: 21, fontWeight: 700, color: NAVY, margin: "6px 0 5px" }}>
                    {trilhaPFAtiva
                      ? "Foi assim que entendemos sua situação financeira"
                      : trilhaHoldingAtiva
                      ? (
                          avaliarHoldingAtiva
                            ? "Foi assim que entendemos sua necessidade de avaliar uma holding"
                            : "Foi assim que entendemos sua estrutura patrimonial"
                        )
                      : "Foi assim que entendemos seu negócio"}
                  </p>
                  <p style={{ fontSize: 12, color: MUTED, margin: 0, lineHeight: 1.5 }}>
                    {trilhaPFAtiva
                      ? "Confirme antes de responder. Se algo não representar sua realidade financeira, volte e ajuste suas escolhas."
                      : trilhaHoldingAtiva
                      ? "Confirme antes de responder. Se algo não representar seu patrimônio ou objetivo, volte e ajuste as informações."
                      : "Confirme antes de responder. Se a interpretação estiver errada, ajuste a descrição e gere novamente."}
                  </p>
                </div>

                {trilhaPFAtiva ? (
                  <div style={{ background: "#EEF8F3", border: "1px solid #C9E8D8", borderRadius: 12, padding: 13 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: NAVY, margin: "0 0 7px" }}>
                      Consultoria financeira pessoal
                    </p>
                    <p style={{ fontSize: 11.2, color: MUTED, margin: "0 0 6px", lineHeight: 1.5 }}>
                      <strong>Objetivos:</strong> {objetivosPF
                        .map((id) => OBJETIVOS_PF.find((item) => item.id === id)?.label)
                        .filter(Boolean)
                        .join(" · ") || "Diagnóstico financeiro geral"}
                    </p>
                    <p style={{ fontSize: 11.2, color: MUTED, margin: 0, lineHeight: 1.5 }}>
                      <strong>Prioridade declarada:</strong> {dor90Dias || "Não informada"}
                    </p>
                  </div>
                ) : trilhaHoldingAtiva ? (
                  <div style={{ background: "#EEF8F3", border: "1px solid #C9E8D8", borderRadius: 12, padding: 13 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: NAVY, margin: "0 0 7px" }}>
                      {avaliarHoldingAtiva ? "Avaliação de viabilidade de Holding" : "Holding / Estrutura patrimonial"}
                    </p>
                    <p style={{ fontSize: 11.2, color: MUTED, margin: "0 0 6px", lineHeight: 1.5 }}>
                      <strong>Objetivos:</strong> {objetivosHolding.join(" · ") || "Avaliação patrimonial geral"}
                    </p>
                    {tiposHolding.length > 0 && (
                      <p style={{ fontSize: 11.2, color: MUTED, margin: "0 0 6px", lineHeight: 1.5 }}>
                        <strong>Hipótese de estrutura:</strong> {tiposHolding
                          .map((id) => TIPOS_HOLDING.find((item) => item.id === id)?.label)
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    <p style={{ fontSize: 11.2, color: MUTED, margin: 0, lineHeight: 1.5 }}>
                      <strong>Prioridade declarada:</strong> {dor90Dias || "Não informada"}
                    </p>
                  </div>
                ) : negocioInterpretado ? (
                  <div style={{ background: "#EEF8F3", border: "1px solid #C9E8D8", borderRadius: 12, padding: 13 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: NAVY, margin: "0 0 5px" }}>
                      {negocioInterpretado.subsegmento || negocioInterpretado.segmento || "Negócio interpretado"}
                    </p>
                    <p style={{ fontSize: 11.5, color: NAVY, margin: "0 0 5px", lineHeight: 1.45 }}>
                      <strong>Modelo:</strong> {negocioInterpretado.modeloOperacional || "-"}
                    </p>
                    <p style={{ fontSize: 11, color: MUTED, margin: 0, lineHeight: 1.45 }}>
                      {negocioInterpretado.justificativa || ""}
                    </p>
                    {Array.isArray(negocioInterpretado.riscosNaturais) && negocioInterpretado.riscosNaturais.length > 0 && (
                      <div style={{ marginTop: 9 }}>
                        <p style={{ fontSize: 10.5, fontWeight: 700, color: NAVY, margin: "0 0 4px" }}>Pontos naturais para investigar:</p>
                        <p style={{ fontSize: 10.8, color: MUTED, margin: 0, lineHeight: 1.45 }}>
                          {negocioInterpretado.riscosNaturais.slice(0, 6).join(" · ")}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ background: "#FFF3EF", borderRadius: 10, padding: 12 }}>
                    <p style={{ fontSize: 11.5, color: NAVY, margin: 0 }}>{erroPerguntas || "Não foi possível interpretar automaticamente o negócio."}</p>
                  </div>
                )}

                {!fluxoSemCnpj && (
                  <div>
                    <label style={labelStyle}>Ajuste a descrição, se necessário</label>
                    <textarea
                      value={descricaoNegocio}
                      onChange={(e) => setDescricaoNegocio(e.target.value)}
                      rows={4}
                      style={{ ...inputStyle, resize: "vertical", fontFamily: BODY_FONT }}
                    />
                  </div>
                )}

                {todasPerguntas.length > 0 && (
                  <div style={{ background: ICE, borderRadius: 10, padding: 10 }}>
                    <p style={{ fontSize: 11.3, color: NAVY, margin: 0, lineHeight: 1.45 }}>
                      <strong>
                        {todasPerguntas.length} perguntas
                        {perguntasDinamicas.length > 0
                          ? " personalizadas"
                          : " específicas"}
                      </strong>
                      {" "}foram preparadas para{" "}
                      {(
                        estruturaNegocio ===
                          "operacional" &&
                        areasOperacionaisSelecionadas.length >
                          0
                          ? areasOperacionaisSelecionadas
                          : areasDoDiagnostico
                      )
                        .map(
                          labelAreaAtual
                        )
                        .filter(Boolean)
                        .join(", ") ||
                        "o escopo selecionado"}.
                    </p>
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                  <button
                    type="button"
                    onClick={gerarPerguntasPersonalizadas}
                    disabled={
                      gerandoPerguntas ||
                      (!fluxoSemCnpj && descricaoNegocio.trim().length < 20)
                    }
                    style={{ ...chipStyle(false), flex: 1 }}
                  >
                    Reanalisar
                  </button>
                  <PrimaryButton
                    disabled={
                      todasPerguntas.length ===
                      0
                    }
                    onClick={() =>
                      setStep("checklist")
                    }
                    style={{ flex: 1 }}
                  >
                    Está correto <ArrowRight size={16} />
                  </PrimaryButton>
                </div>
              </div>
            )}

            {step === "checklist" && gruposSelecionados.length > 0 && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <p style={{ fontFamily: DISPLAY_FONT, fontSize: 19, fontWeight: 700, color: NAVY, margin: "6px 0 2px" }}>
                  Diagnóstico completo — {areasDaEstrutura.length} frentes
                </p>
                <p style={{ fontSize: 11.5, color: MUTED, margin: "0 0 12px" }}>
                  {todasPerguntas.length} perguntas · personalizadas para {
                    trilhaPFAtiva
                      ? "seus objetivos financeiros"
                      : negocioInterpretado?.subsegmento || categoriaPrincipal
                  }
                  {atividadePredominante?.descricao
                    ? ` · atividade-base: ${atividadePredominante.descricao}`
                    : empresaPrincipal?.cnae
                      ? ` · CNAE ${empresaPrincipal.cnae.split("—")[0].trim()}`
                      : ""}
                  {empresas.length > 1 ? " (empresa-base do grupo)" : ""}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 22, overflowY: "auto", maxHeight: 440, paddingRight: 2 }}>
                  {gruposSelecionados.map((g) => (
                    <div key={g.id}>
                      {prioridadesDiagnostico.includes(g.id) && (
                        <div
                          style={{
                            display: "inline-flex",
                            marginBottom: 7,
                            background: "#FFF3EF",
                            color: CORAL,
                            borderRadius: 20,
                            padding: "3px 7px",
                            fontSize: 9,
                            fontWeight: 800,
                          }}
                        >
                          PRIORIDADE · APROFUNDAMENTO
                        </div>
                      )}

                      {gruposSelecionados.length > 1 && (
                        <p style={{
                          fontSize: 12.5, fontWeight: 700, color: NAVY, background: ICE,
                          display: "inline-block", padding: "4px 10px", borderRadius: 8, margin: "0 0 12px",
                        }}>{g.label}</p>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {g.subtemas.map((sub) => (
                          <div key={sub.tema}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: CORAL, textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 10px" }}>{sub.tema}</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                              {sub.perguntas.map((q) => (
                                <div key={q.id}>
                                  <p style={{ fontSize: 12.5, color: NAVY, margin: "0 0 6px", lineHeight: 1.4 }}>{textoDe(q, segmentoPredominante, categoriaPrincipal)}</p>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    {[["sim", "Sim"], ["parcialmente", "Parcial"], ["nao", "Não"]].map(([val, lbl]) => (
                                      <button key={val} onClick={() => responder(q.id, val)} style={{
                                        ...miniChipStyle(respostas[q.id] === val), flex: 1,
                                      }}>{lbl}</button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ minHeight: 12 }} />
                <PrimaryButton disabled={!todasRespondidas} onClick={() => setStep("analisando")} style={{ marginTop: 14 }}>
                  <Sparkles size={16} /> Gerar diagnóstico
                </PrimaryButton>
              </div>
            )}

            {step === "analisando" &&
              (fluxoSemCnpj || empresaPrincipal) &&
              gruposSelecionados.length > 0 && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 18 }}>
                <Loader2 size={34} color={CORAL} className="spin" />
                <p style={{ fontFamily: DISPLAY_FONT, fontSize: 18, fontWeight: 700, color: NAVY, margin: 0 }}>A IA está analisando</p>
                <p style={{ fontSize: 12.5, color: MUTED, minHeight: 18, margin: 0, padding: "0 10px" }}>
                  {[
                    trilhaPFAtiva
                      ? `Objetivos: ${objetivosPF
                          .map(
                            (id) =>
                              OBJETIVOS_PF.find(
                                (item) =>
                                  item.id === id
                              )?.label
                          )
                          .filter(Boolean)
                          .join(", ")}`
                      : `Atividade-base: ${atividadePredominante?.descricao || categoriaPrincipal}`,
                    `Analisando as áreas: ${gruposSelecionados.map((g) => g.label).join(", ")}`,
                    "Cruzando respostas com o contexto do segmento",
                    "Estimando carga tributária de referência",
                    "Calculando índice de maturidade por departamento",
                  ][msgIdx]}
                </p>
              </div>
            )}

            {step === "resultado" &&
              (
                !gruposSelecionados.length ||
                !areaMaisFraca
              ) && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 12,
                  textAlign: "center",
                  padding: "32px 10px",
                }}
              >
                <AlertTriangle
                  size={30}
                  color={CORAL}
                  style={{
                    margin: "0 auto",
                  }}
                />

                <p
                  style={{
                    fontFamily:
                      DISPLAY_FONT,
                    fontSize: 18,
                    fontWeight: 700,
                    color: NAVY,
                    margin: 0,
                  }}
                >
                  Não foi possível montar o diagnóstico
                </p>

                <p
                  style={{
                    fontSize: 12,
                    color: MUTED,
                    lineHeight: 1.55,
                    margin: 0,
                  }}
                >
                  O sistema não encontrou uma área válida para compor o relatório.
                  Volte ao checklist e gere novamente. Nenhum relatório vazio será exibido.
                </p>

                <PrimaryButton
                  onClick={() =>
                    setStep(
                      "checklist"
                    )
                  }
                >
                  Voltar ao checklist
                </PrimaryButton>
              </div>
            )}

            {step === "resultado" &&
              (fluxoSemCnpj || empresaPrincipal) &&
              gruposSelecionados.length > 0 &&
              areaMaisFraca && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

                <div style={{ background: tierDe(areaMaisFraca.score).bg, borderRadius: 14, padding: 14, marginBottom: 16, display: "flex", gap: 10 }}>
                  <Flame size={18} color={tierDe(areaMaisFraca.score).color} style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 12, color: tierDe(areaMaisFraca.score).color, margin: 0, lineHeight: 1.5 }}>
                    Identificamos sinais que merecem atenção em <strong>{areaMaisFraca.label}</strong>. Seu resultado indica nível <strong>{tierDe(areaMaisFraca.score).label.toUpperCase()}</strong> nessa área. Veja abaixo o que suas respostas estão mostrando.
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 0 14px" }}>
                  <ScoreRing score={score} color={tierGeral.color} />
                  <span style={{ ...badgeStyle, background: tierGeral.bg, color: tierGeral.color, marginTop: 10, fontWeight: 700 }}>{tierGeral.label}</span>
                </div>

                <p style={{ fontSize: 12, color: MUTED, textAlign: "center", margin: "0 0 4px", fontWeight: 700 }}>
                  {trilhaPFAtiva
                    ? nome
                    : avaliarHoldingAtiva
                    ? "Avaliação de Holding"
                    : empresaPrincipal?.razao}
                </p>
                <p style={{ fontSize: 11, color: "#9AA3B5", textAlign: "center", margin: "0 0 17px", lineHeight: 1.4 }}>
                  {trilhaPFAtiva
                    ? `Pessoa Física · ${gruposSelecionados.map((g) => g.label).join(", ")}`
                    : avaliarHoldingAtiva
                    ? `Avaliação de viabilidade · ${gruposSelecionados.map((g) => g.label).join(", ")}`
                    : `${categoriaPrincipal} · ${colaboradores} colaboradores · ${gruposSelecionados.map((g) => g.label).join(", ")}`}
                </p>

                <p style={sectionTitleStyle}>
                  {trilhaPFAtiva
                    ? "O que entendemos sobre sua vida financeira"
                    : trilhaHoldingAtiva
                    ? "O que entendemos sobre sua estrutura patrimonial"
                    : trilhaGrupoAtiva
                    ? "O que entendemos sobre o grupo empresarial"
                    : trilhaSPEAtiva
                    ? "O que entendemos sobre a SPE"
                    : "O que entendemos sobre o seu negócio"}
                </p>
                <div style={{ background: "#F7F8FB", borderRadius: 12, padding: 13, marginBottom: 14, border: "1px solid #E6E9EF" }}>
                  <p style={{ fontSize: 11.8, color: NAVY, margin: 0, lineHeight: 1.55 }}>
                    <strong>
                      {trilhaPFAtiva
                        ? (
                            objetivosPF
                              .map(
                                (id) =>
                                  OBJETIVOS_PF.find(
                                    (item) =>
                                      item.id === id
                                  )?.label
                              )
                              .filter(Boolean)
                              .join(" · ") ||
                            "Consultoria financeira pessoal"
                          )
                        : negocioInterpretado?.subsegmento ||
                          negocioInterpretado?.segmento ||
                          categoriaPrincipal}
                    </strong>
                    {!trilhaPFAtiva &&
                      negocioInterpretado?.modeloOperacional
                        ? ` — ${negocioInterpretado.modeloOperacional}`
                        : ""}.
                  </p>
                  {!trilhaPFAtiva && descricaoNegocio && (
                    <p style={{ fontSize: 11.2, color: MUTED, margin: "7px 0 0", lineHeight: 1.5 }}>
                      Com base no que você informou, entendemos sua operação como: {descricaoNegocio}.
                    </p>
                  )}
                </div>

                {resumoExecutivo && (
                  <>
                    <p style={sectionTitleStyle}>Leitura executiva</p>
                    <div style={{ background: "#FFF3EF", borderLeft: `4px solid ${CORAL}`, borderRadius: 10, padding: 13, marginBottom: 14 }}>
                      <p style={{ fontSize: 12, color: NAVY, margin: 0, lineHeight: 1.6 }}>{resumoExecutivo}</p>
                    </div>
                  </>
                )}

                {inteligenciaTributaria?.disponivel && (
                  <>
                    <p style={sectionTitleStyle}>Inteligência tributária</p>

                    <div
                      style={{
                        background: "#F7F8FB",
                        border: "1px solid #DDE2EA",
                        borderRadius: 12,
                        padding: 13,
                        marginBottom: 14,
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 9,
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{
                            background: WHITE,
                            borderRadius: 9,
                            padding: 10,
                            border: "1px solid #E3E7EF",
                          }}
                        >
                          <p
                            style={{
                              fontSize: 9.5,
                              color: MUTED,
                              margin: "0 0 3px",
                            }}
                          >
                            FATURAMENTO DE REFERÊNCIA
                          </p>
                          <strong
                            style={{
                              fontSize: 14,
                              color: NAVY,
                            }}
                          >
                            {moedaTributaria(
                              inteligenciaTributaria
                                .faturamentoMensalReferencia
                            )}/mês
                          </strong>
                        </div>

                        <div
                          style={{
                            background: WHITE,
                            borderRadius: 9,
                            padding: 10,
                            border: "1px solid #E3E7EF",
                          }}
                        >
                          <p
                            style={{
                              fontSize: 9.5,
                              color: MUTED,
                              margin: "0 0 3px",
                            }}
                          >
                            TRIBUTOS ESTIMADOS
                          </p>
                          <strong
                            style={{
                              fontSize: 14,
                              color: NAVY,
                            }}
                          >
                            {moedaTributaria(
                              inteligenciaTributaria
                                .tributosMensaisEstimados
                            )}/mês
                          </strong>
                        </div>
                      </div>

                      <div
                        style={{
                          background: "#FFF3EF",
                          borderLeft: `4px solid ${CORAL}`,
                          borderRadius: 9,
                          padding: 11,
                          marginBottom: 10,
                        }}
                      >
                        <p
                          style={{
                            fontSize: 9.5,
                            color: "#993C1D",
                            margin: "0 0 3px",
                            fontWeight: 700,
                          }}
                        >
                          CARGA TRIBUTÁRIA ESTIMADA
                        </p>

                        <strong
                          style={{
                            fontSize: 23,
                            color: "#993C1D",
                          }}
                        >
                          {percentualTributario(
                            inteligenciaTributaria
                              .cargaTributariaEstimada
                          )}
                        </strong>

                        <p
                          style={{
                            fontSize: 11,
                            color: NAVY,
                            margin: "6px 0 0",
                            lineHeight: 1.45,
                          }}
                        >
                          A cada R$ 100 faturados, aproximadamente{" "}
                          <strong>
                            R${" "}
                            {Number(
                              inteligenciaTributaria
                                .cargaTributariaEstimada
                            ).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </strong>{" "}
                          correspondem à carga tributária estimada nesta referência.
                        </p>
                      </div>

                      <div
                        style={{
                          background: "#FAEEDA",
                          borderRadius: 9,
                          padding: 10,
                        }}
                      >
                        <p
                          style={{
                            fontSize: 9.5,
                            color: "#70410A",
                            margin: "0 0 3px",
                            fontWeight: 800,
                          }}
                        >
                          REFORMA TRIBUTÁRIA
                        </p>

                        <p
                          style={{
                            fontSize: 11,
                            color: "#70410A",
                            margin: 0,
                            lineHeight: 1.45,
                          }}
                        >
                          Impacto preliminar do segmento:{" "}
                          <strong>
                            {
                              inteligenciaTributaria
                                .reforma?.status
                            }
                          </strong>
                          . O efeito efetivo depende do regime tributário,
                          atividade, créditos, perfil dos clientes e das
                          operações realizadas.
                        </p>
                      </div>

                      <p
                        style={{
                          fontSize: 9.2,
                          color: "#8A93A3",
                          margin: "9px 0 0",
                          lineHeight: 1.4,
                          fontStyle: "italic",
                        }}
                      >
                        Estimativa gerencial. Não substitui apuração fiscal
                        nem planejamento tributário individualizado.
                      </p>
                    </div>
                  </>
                )}

                {leituraDaDorIa && (
                  <>
                    <p style={sectionTitleStyle}>O que suas respostas estão mostrando</p>
                    <div style={{ background: WHITE, border: "1px solid #DDE2EA", borderRadius: 12, padding: 13, marginBottom: 14 }}>
                      <p style={{ fontSize: 12, color: NAVY, margin: 0, lineHeight: 1.6 }}>{leituraDaDorIa}</p>
                    </div>
                  </>
                )}

                {causasProvaveisIa.length > 0 && (
                  <>
                    <p style={sectionTitleStyle}>Conexões que merecem atenção</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 15 }}>
                      {causasProvaveisIa.slice(0, 3).map((item, i) => (
                        <div key={i} style={{ background: "#F7F8FB", borderRadius: 10, padding: 11, border: "1px solid #E6E9EF", display: "flex", gap: 9, alignItems: "flex-start" }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#FFF3EF", color: CORAL, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                          <p style={{ fontSize: 11.7, color: NAVY, margin: 0, lineHeight: 1.5 }}>{item}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {impactosIa.length > 0 && (
                  <>
                    <p style={sectionTitleStyle}>Onde isso pode estar impactando</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 15 }}>
                      {impactosIa.slice(0, 3).map((item, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <AlertTriangle size={14} color="#993C1D" style={{ marginTop: 2, flexShrink: 0 }} />
                          <p style={{ fontSize: 11.7, color: NAVY, margin: 0, lineHeight: 1.45 }}>{item}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {pontosFortesIa.length > 0 && (
                  <>
                    <p style={sectionTitleStyle}>O que já está funcionando a seu favor</p>
                    <div style={{ background: "#E1F5EE", borderRadius: 11, padding: 12, marginBottom: 15 }}>
                      {pontosFortesIa.slice(0, 3).map((item, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: i ? 7 : 0 }}>
                          <CheckCircle2 size={14} color="#0F6E56" style={{ marginTop: 2, flexShrink: 0 }} />
                          <p style={{ fontSize: 11.7, color: "#0F6E56", margin: 0, lineHeight: 1.45 }}>{item}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {alertaEstrategicoIa && (
                  <>
                    <p style={sectionTitleStyle}>Alerta estratégico</p>
                    <div style={{ background: "#FAEEDA", borderRadius: 11, padding: 13, marginBottom: 15 }}>
                      <p style={{ fontSize: 11.8, color: "#70410A", margin: 0, lineHeight: 1.55, fontWeight: 600 }}>{alertaEstrategicoIa}</p>
                    </div>
                  </>
                )}

                <p style={sectionTitleStyle}>Prioridades identificadas</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 17 }}>
                  {subOrdenados.slice(0, 3).map((item, i) => (
                    <div key={`${item.area}-${item.tema}-${i}`} style={{ background: WHITE, border: "1px solid #E1E5EC", borderRadius: 10, padding: 11, display: "flex", gap: 9, alignItems: "flex-start" }}>
                      <div style={{ minWidth: 24, height: 24, borderRadius: 7, background: NAVY, color: WHITE, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
                      <div>
                        <p style={{ fontSize: 11.8, fontWeight: 700, color: NAVY, margin: "1px 0 3px", lineHeight: 1.4 }}>{item.area} · {item.tema}</p>
                        <p style={{ fontSize: 10.6, color: MUTED, margin: 0, lineHeight: 1.4 }}>Esta frente merece aprofundamento antes da definição do plano de implementação.</p>
                      </div>
                    </div>
                  ))}
                </div>

                {observacao.trim() && (
                  <>
                    <p style={sectionTitleStyle}>Sua observação</p>
                    <div style={{ background: ICE, borderRadius: 10, padding: 11, marginBottom: 15 }}>
                      <p style={{ fontSize: 11.5, color: NAVY, margin: 0, lineHeight: 1.45, fontStyle: "italic" }}>“{observacao.trim()}”</p>
                    </div>
                  </>
                )}

                <div style={{ background: NAVY, color: WHITE, borderRadius: 14, padding: 16, marginBottom: 15 }}>
                  <p style={{ fontFamily: DISPLAY_FONT, fontSize: 17, fontWeight: 700, margin: "0 0 6px" }}>
                    Seu diagnóstico mostrou onde olhar. Agora precisamos definir como agir.
                  </p>
                  <p style={{ fontSize: 11.5, color: "#D7DDEA", margin: "0 0 10px", lineHeight: 1.5 }}>
                    A análise consultiva da Finder aprofunda as causas, valida os riscos e transforma as prioridades em um plano de ação adequado à realidade da sua empresa.
                  </p>
                  <p style={{ fontSize: 10.5, color: "#AEB8CA", margin: 0, lineHeight: 1.45 }}>
                    O diagnóstico técnico completo permanece reservado para a análise com o especialista.
                  </p>
                </div>

                {envioRelatorio === "sent" && (
                  <div style={{ background: "#E1F5EE", borderRadius: 10, padding: 10, marginBottom: 14 }}>
                    <p style={{ fontSize: 11, color: "#0F6E56", margin: 0, lineHeight: 1.4 }}>Seu diagnóstico foi registrado com sucesso.</p>
                  </div>
                )}

                {envioRelatorio === "error" && (
                  <div style={{ background: "#FAECE7", borderRadius: 10, padding: 10, marginBottom: 14 }}>
                    <p style={{ fontSize: 11, color: "#993C1D", margin: 0, lineHeight: 1.4 }}>Seu diagnóstico foi concluído. Houve uma falha em uma etapa de envio, mas o resultado permanece disponível nesta tela.</p>
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <PrimaryButton
                    style={{ background: NAVY, padding: "14px 16px" }}
                    onClick={() => {
                      const numero = "5541989049616";
                      const mensagem = encodeURIComponent(
                        `Olá! Fiz o Diagnóstico Empresarial Finder.\n\nEmpresa: ${empresaPrincipal?.razao || ""}\nResponsável: ${nome || ""}\nScore: ${score}/100 — ${tierGeral.label}\nPrincipal área de atenção: ${areaMaisFraca?.label || ""}\n\nO resultado fez sentido para mim e gostaria de conversar com um especialista para entender as prioridades e os próximos passos.`
                      );
                      window.open(`https://wa.me/${numero}?text=${mensagem}`, "_blank");
                    }}
                  >
                    <CalendarCheck size={15} /> Quero falar com um especialista
                  </PrimaryButton>

                  <PrimaryButton onClick={gerarPdf}>
                    <Download size={15} /> Baixar meu diagnóstico executivo
                  </PrimaryButton>

                  <button onClick={reiniciar} style={{ background: "none", border: "none", color: MUTED, fontSize: 11.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 7, cursor: "pointer" }}>
                    <RotateCcw size={12} /> Fazer um novo diagnóstico
                  </button>
                </div>

                <p style={{ fontSize: 9.8, color: "#9AA3B5", fontStyle: "italic", margin: "14px 0 0", lineHeight: 1.45, textAlign: "center" }}>
                  Diagnóstico empresarial executivo e preliminar elaborado a partir das informações fornecidas pelo participante. A validação dos achados e a definição das ações exigem análise profissional individualizada.
                </p>

              </div>
            )}

          </div>

          {step !== "intro" && step !== "resultado" && step !== "analisando" && (
            <button onClick={() => {
              const back = {
                estrutura: "cadastro",
                cnpj: "estrutura",
                porte: "cnpj",
                dor:
                  trilhaPFAtiva ||
                  avaliarHoldingAtiva ||
                  (
                    trilhaSPEAtiva &&
                    speConstituida !== "sim"
                  )
                    ? "estrutura"
                    : "porte",
                gerandoPerguntas: "dor",
                confirmarNegocio: "dor",
                checklist: "dor",
              };

              setStep(back[step] || "intro");
            }} style={{
              position: "absolute", top: 26, left: 26, background: "none", border: "none",
              color: MUTED, cursor: "pointer", display: "flex", alignItems: "center",
            }}>
              <ArrowLeft size={16} />
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: NAVY, color: WHITE, padding: "10px 18px", borderRadius: 10,
          fontSize: 12.5, boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
        }}>{toast}</div>
      )}

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input:focus, textarea:focus { outline: none; border-color: ${CORAL} !important; }
      `}</style>
    </div>
  );
}

function ScoreRing({ score, color }) {
  const r = 46, c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#EEF0F5" strokeWidth="10" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 60 60)" style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      <text x="60" y="56" textAnchor="middle" fontSize="26" fontWeight="700" fill={NAVY} fontFamily={DISPLAY_FONT}>{score}</text>
      <text x="60" y="76" textAnchor="middle" fontSize="10" fill={MUTED} fontFamily={BODY_FONT}>de 100</text>
    </svg>
  );
}

const labelStyle = {
  fontSize: 12,
  color: MUTED,
  marginBottom: 6,
  display: "block",
  fontWeight: 700,
};

const inputStyle = {
  width: "100%",
  minHeight: 46,
  padding: "11px 12px",
  borderRadius: 11,
  border: "1px solid #D8DEEA",
  fontSize: 16,
  marginBottom: 14,
  fontFamily: BODY_FONT,
  color: NAVY,
  background: WHITE,
  boxSizing: "border-box",
  outline: "none",
};
const sectionTitleStyle = { fontSize: 11.5, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" };
const badgeStyle = {
  fontSize: 10.5, padding: "3px 9px", borderRadius: 20, background: WHITE, color: NAVY,
  fontWeight: 600, display: "inline-block",
};
function chipStyle(active) {
  return {
    minHeight: 44,
    padding: "10px 11px",
    borderRadius: 11,
    border: active ? `1px solid ${CORAL}` : "1px solid #D8DEEA",
    background: active ? CORAL : WHITE,
    color: active ? WHITE : NAVY,
    fontSize: 13,
    fontFamily: BODY_FONT, cursor: "pointer", textAlign: "left", fontWeight: 600,
  };
}
function miniChipStyle(active) {
  return {
    padding: "7px 4px", borderRadius: 8, border: active ? `1px solid ${NAVY}` : "1px solid #D8DEEA",
    background: active ? NAVY : WHITE, color: active ? WHITE : MUTED, fontSize: 11.5,
    fontFamily: BODY_FONT, cursor: "pointer", fontWeight: 600,
  };
}


// =========================================================
// LOGIN DO APP
// =========================================================
export default function AppComAcesso() {
  const [token, setToken] = useState(() => sessionStorage.getItem("finder_app_token") || "");
  const [usuario, setUsuario] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("finder_app_user") || "{}"); } catch { return {}; }
  });
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    if (!login.trim() || !senha) { setErro("Digite seu login e senha."); return; }
    setCarregando(true); setErro("");
    try {
      const r = await fetch("/api/acessos?action=login", {
        method:"POST", headers:{"content-type":"application/json"},
        body:JSON.stringify({login:login.trim(), senha, tipo:"APP"})
      });
      const d = await r.json().catch(()=>null);
      if (!r.ok || !d?.sucesso || !d?.token) throw new Error(d?.error || "Login ou senha inválidos.");
      sessionStorage.setItem("finder_app_token", d.token);
      sessionStorage.setItem("finder_app_user", JSON.stringify(d.usuario || {}));
      setUsuario(d.usuario || {}); setToken(d.token);
    } catch(e) { setErro(e?.message || "Não foi possível entrar no App."); }
    finally { setCarregando(false); }
  }

  useEffect(() => {
    if (!token) return;
    const handler = (ev) => {
      const el = ev.target?.closest?.("button,a,[role='button']");
      if (!el) return;
      const descricao = String(el.innerText || el.getAttribute("aria-label") || "").trim().slice(0,160);
      if (!descricao) return;
      fetch("/api/acessos?action=auditar", {method:"POST",headers:{"content-type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({acao:"CLICK",modulo:"APP",recurso:"interface",descricao})}).catch(()=>null);
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [token]);

  if (!token) {
    return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#F3F5F8",padding:20,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <div style={{width:"100%",maxWidth:420,background:"white",borderRadius:20,padding:30,boxShadow:"0 24px 60px rgba(23,35,61,.14)"}}>
        <img src="/finder-logo.png" alt="Finder of Solutions" style={{width:180,maxWidth:"70%",objectFit:"contain",marginBottom:22}}/>
        <h1 style={{margin:"0 0 7px",color:"#17233D",fontSize:28}}>Acesso ao Diagnóstico</h1>
        <p style={{margin:"0 0 22px",fontSize:13,color:"#5B667A"}}>Entre com o usuário criado pelo administrador.</p>
        <input value={login} onChange={e=>{setLogin(e.target.value);setErro("")}} placeholder="Login ou e-mail" autoComplete="username" style={{width:"100%",boxSizing:"border-box",padding:"12px 13px",border:"1px solid #D8DEEA",borderRadius:10,marginBottom:10}}/>
        <input type="password" value={senha} onChange={e=>{setSenha(e.target.value);setErro("")}} onKeyDown={e=>e.key==="Enter"&&entrar()} placeholder="Senha" autoComplete="current-password" style={{width:"100%",boxSizing:"border-box",padding:"12px 13px",border:"1px solid #D8DEEA",borderRadius:10,marginBottom:10}}/>
        {erro&&<div style={{background:"#FAECE7",color:"#993C1D",padding:10,borderRadius:9,fontSize:12,marginBottom:10}}>{erro}</div>}
        <button onClick={entrar} disabled={carregando} style={{width:"100%",border:0,borderRadius:10,padding:"12px 14px",background:"#17233D",color:"white",fontWeight:700,cursor:"pointer"}}>{carregando?"Validando...":"Entrar"}</button>
      </div>
    </div>;
  }
  return <DiagnosticoPrototipo usuarioAcesso={usuario} tokenAcesso={token} />;
}
