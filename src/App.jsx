import React, { useState, useEffect, useRef } from "react";
import {
  QrCode, Loader2, ArrowRight, ArrowLeft, CheckCircle2, Download,
  CalendarCheck, RotateCcw, Megaphone, Scale, Calculator, Wallet,
  ClipboardList, Target, Settings2, Building2, Sparkles, Users, TrendingUp,
  AlertTriangle, Percent, Cpu, Flame, X, Plus,
} from "lucide-react";

const NAVY = "#17233D";
const ICE = "#E9EDF5";
const CORAL = "#FF6B4A";
const MUTED = "#5B667A";
const WHITE = "#FFFFFF";
const DISPLAY_FONT = "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif";
const BODY_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const MAX_DORES = 3;
const MAX_EMPRESAS = 4;

const AREAS = [
  { id: "marketing", label: "Marketing", Icon: Megaphone },
  { id: "juridico", label: "Jurídico", Icon: Scale },
  { id: "contabilidade", label: "Contábil / Fiscal", Icon: Calculator },
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
    <div style={{ display: "flex", gap: 6, justifyContent: "center", padding: "14px 0 4px" }}>
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
        width: "100%", padding: "13px 16px", borderRadius: 12, border: "none",
        background: disabled ? "#D8DEEA" : CORAL, color: WHITE, fontFamily: BODY_FONT,
        fontSize: 14.5, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export default function DiagnosticoPrototipo() {
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

  const empresaPrincipal = empresas[0] || null;

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

  const areasDoDiagnostico = dores.length > 0
    ? dores
    : areasSugeridas.slice(0, MAX_DORES);

  const gruposEstaticos = areasDoDiagnostico
    .filter((id) => CHECKLISTS[id])
    .map((id) => ({
      id,
      label: areaLabel(id),
      subtemas: checklistEnxuto(CHECKLISTS[id]),
    }));

  const gruposDinamicos = areasDoDiagnostico
    .map((id) => {
      const perguntasArea = perguntasDinamicas.filter((q) => q.areaId === id);
      if (!perguntasArea.length) return null;

      const temas = [...new Set(perguntasArea.map((q) => q.tema || "Diagnóstico específico"))];

      return {
        id,
        label: areaLabel(id),
        subtemas: temas.map((tema) => ({
          tema,
          dica: `Aprofundar ${tema.toLowerCase()} considerando o modelo real do negócio.`,
          perguntas: perguntasArea.filter((q) => (q.tema || "Diagnóstico específico") === tema),
        })),
      };
    })
    .filter(Boolean);

  const gruposSelecionados = perguntasDinamicas.length > 0
    ? gruposDinamicos
    : gruposEstaticos;

  const todasPerguntas = gruposSelecionados.flatMap((g) => g.subtemas.flatMap((s) => s.perguntas));
  const todasRespondidas = todasPerguntas.length > 0 && todasPerguntas.every((q) => respostas[q.id]);

  useEffect(() => {
    if (step !== "analisando" || !empresaPrincipal || gruposSelecionados.length === 0) return;

    let cancelado = false;
    const labels = gruposSelecionados.map((g) => g.label);
    const msgs = [
      `Atividade-base: ${atividadePredominante?.descricao || categoriaPrincipal}`,
      `Analisando as áreas: ${labels.join(", ")}`,
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
      segmento: segmentoPredominante,
      categoria: categoriaPrincipal,
      codigoQuestionario,
      cnaePrincipal: empresaPrincipal?.cnaePrincipal || null,
      cnaesSecundarios: empresaPrincipal?.cnaesSecundarios || [],
      atividadesSelecionadas: atividadesSelecionadasObjetos,
      atividadePredominante,
      empresas: empresas.map((e) => ({
        razao: e.razao,
        categoria: e.categoria,
        segmento: e.segmento,
        cnae: e.cnae,
      })),
      faturamento: faturamento?.label,
      colaboradores,
      regime,
      observacao,
      descricaoNegocio,
      negocioInterpretado,
      doresSelecionadas,
      dorPrincipal: doresSelecionadas[0] || "",
      dor90Dias,
      impactosDor,
      areas: gruposSelecionados.map((g) => ({
        area: g.label,
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

    const minDelay = new Promise((resolve) => setTimeout(resolve, 1800));
    const chamadaIA = fetch("/api/diagnostico", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (r) => {
        if (!r.ok) {
          const erro = await r.json().catch(() => null);
          console.error("Erro diagnóstico:", erro);
          return null;
        }
        return r.json();
      })
      .catch((erro) => {
        console.error("Erro ao chamar diagnóstico:", erro);
        return null;
      });

    Promise.all([chamadaIA, minDelay]).then(([data]) => {
      if (cancelado) return;

      if (data?.areas) {
        const mapa = {};
        data.areas.forEach((a) => {
          mapa[a.area] = a;
        });

        setIaResultado({
          areas: mapa,
          diagnosticoGeral: data.diagnosticoGeral || null,
          visaoGrupo: data.visaoGrupo || null,
          lacunasDiagnostico: data.lacunasDiagnostico || [],
          oportunidadesConsultoria: data.oportunidadesConsultoria || [],
          modelo: data.modelo || "",
        });
      }

      setStep("resultado");
    });

    return () => {
      cancelado = true;
      clearInterval(interval);
    };
  }, [step]);
  function toggleDorSelecionada(valor) {
    setDoresSelecionadas((prev) =>
      prev.includes(valor)
        ? prev.filter((item) => item !== valor)
        : [...prev, valor]
    );
  }

  async function gerarPerguntasPersonalizadas() {
    if (!empresaPrincipal) {
      showToast("Adicione pelo menos um CNPJ.");
      return;
    }

    if (descricaoNegocio.trim().length < 20) {
      showToast("Descreva brevemente o que o negócio realmente faz.");
      return;
    }

    if (!atividadePredominante) {
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
      segmentoAtual: segmentoPredominante,
      categoriaAtual: categoriaPrincipal,
      cnaePrincipal: empresaPrincipal?.cnaePrincipal || null,
      cnaesSecundarios: empresaPrincipal?.cnaesSecundarios || [],
      atividadesSelecionadas: atividadesSelecionadasObjetos,
      atividadePredominante,
      descricaoNegocio: descricaoNegocio.trim(),
      empresas: empresas.map((e) => ({
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
      areasSelecionadas: dores.map((id) => ({ id, label: areaLabel(id) })),
    };

    try {
      const r = await fetch("/api/gerar-perguntas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await r.json().catch(() => null);

      if (!r.ok || !data?.sucesso || !Array.isArray(data?.perguntas)) {
        throw new Error(data?.error || "Não foi possível gerar as perguntas personalizadas.");
      }

      const perguntas = data.perguntas.map((q, idx) => ({
        id: q.id || `ia_${idx + 1}`,
        areaId: q.areaId,
        area: q.area,
        tema: q.tema || "Diagnóstico específico",
        text: q.pergunta,
        risco: q.riscoAvaliado || "Ponto relevante para aprofundamento",
        motivo: q.motivo || "",
        importancia: Number(q.importancia) || 1,
        invert: false,
      }));

      setPerguntasDinamicas(perguntas);
      setNegocioInterpretado(data.negocioInterpretado || null);
      setRespostas({});
      setStep("confirmarNegocio");
    } catch (error) {
      console.error("Erro ao gerar perguntas:", error);
      setErroPerguntas(error?.message || "Não foi possível gerar perguntas personalizadas.");
      setPerguntasDinamicas([]);
      setNegocioInterpretado(null);
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


  async function enviarRelatorioPorEmail() {
    if (!empresaPrincipal || relatorioEnviadoRef.current) return;

    const respostasDetalhadas = gruposSelecionados.map((g) => ({
      area: g.label,
      score: scoreDe(g.subtemas.flatMap((s) => s.perguntas)),
      subtemas: g.subtemas.map((s) => ({
        tema: s.tema,
        perguntas: s.perguntas.map((q) => ({
          pergunta: textoDe(q, segmentoPredominante, categoriaPrincipal),
          resposta: respostas[q.id] || "",
        })),
      })),
    }));

    const payloadEmail = {
      responsavel: {
        nome,
        cargo,
        telefone,
        email,
        consentimentoEmail,
      },
      empresa: {
        razao: empresaPrincipal.razao,
        nomeFantasia: empresaPrincipal.nomeFantasia || "",
        cnpj: empresaPrincipal.cnpjDigits || "",
        cnae: empresaPrincipal.cnae || "",
        cnaePrincipal: empresaPrincipal?.cnaePrincipal || null,
        cnaesSecundarios: empresaPrincipal?.cnaesSecundarios || [],
        atividadesSelecionadas: atividadesSelecionadasObjetos,
        atividadePredominante,
        categoria: categoriaPrincipal,
        segmento: segmentoPredominante,
        porte: empresaPrincipal.porte || "",
        endereco: empresaPrincipal.endereco || {},
      },
      perfil: {
        faturamento: faturamento?.label || "",
        colaboradores: colaboradores || "",
        regime: regime || "",
        observacao: observacao || "",
        descricaoNegocio: descricaoNegocio || "",
        negocioInterpretado: negocioInterpretado || null,
        doresSelecionadas,
        dorPrincipal: doresSelecionadas[0] || "",
        dor90Dias,
        impactosDor,
        areasSelecionadas: gruposSelecionados.map((g) => g.label),
      },
      resultado: {
        scoreGeral: score,
        nivelGeral: tierGeral.label,
        areas: areasComScore.map((a) => ({
          area: a.label,
          score: a.score,
          nivel: tierDe(a.score).label,
          ...(iaResultado?.areas?.[a.label] || {}),
        })),
        diagnosticoGeral: iaResultado?.diagnosticoGeral || null,
        visaoGrupo: iaResultado?.visaoGrupo || null,
        lacunasDiagnostico: iaResultado?.lacunasDiagnostico || [],
        oportunidadesConsultoria: iaResultado?.oportunidadesConsultoria || [],
        respostas: respostasDetalhadas,
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
        return;
      }

      relatorioEnviadoRef.current = true;
      setEnvioRelatorio("sent");
    } catch (error) {
      console.error("Erro no envio do relatório:", error);
      setEnvioRelatorio("error");
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
  const pontosAtencaoFinal = iaResultado
    ? gruposSelecionados.flatMap((g) => iaResultado?.areas?.[g.label]?.riscos || []).slice(0, 8)
    : pontosAtencao;
  const recomendacoesFinal = iaResultado
    ? gruposSelecionados.flatMap((g) => (iaResultado?.areas?.[g.label]?.recomendacoes || []).map((r) => ({ area: g.label, dica: r }))).slice(0, 6)
    : subOrdenados.slice(0, 3);

  const aliquota = empresaPrincipal && regime ? estimarAliquota(regime, segmentoPredominante, faturamento?.anual || 0) : null;
  const valorAnualImposto = aliquota != null && faturamento ? faturamento.anual * (aliquota / 100) : null;

  const diagnosticoGeral = iaResultado?.diagnosticoGeral || null;
  const resumoExecutivo = diagnosticoGeral?.resumoExecutivo || "";
  const principaisDoresIa = diagnosticoGeral?.principaisDores || [];
  const pontosFortesIa = diagnosticoGeral?.pontosFortes || [];
  const prioridadesIa = diagnosticoGeral?.prioridadesImediatas || [];
  const oportunidadesIa = diagnosticoGeral?.oportunidades || [];
  const causasProvaveisIa = diagnosticoGeral?.causasProvaveis || [];
  const impactosIa = diagnosticoGeral?.impactos || [];
  const proximosPassosIa = diagnosticoGeral?.proximosPassos || [];
  const leituraDaDorIa = diagnosticoGeral?.leituraDaDor || "";
  const alertaEstrategicoIa = diagnosticoGeral?.alertaEstrategico || "";
  const visaoGrupoIa = iaResultado?.visaoGrupo || null;
  const lacunasDiagnosticoIa = iaResultado?.lacunasDiagnostico || [];
  const oportunidadesConsultoriaIa = iaResultado?.oportunidadesConsultoria || [];


  useEffect(() => {
    if (
      step === "resultado" &&
      empresaPrincipal &&
      gruposSelecionados.length > 0 &&
      !relatorioEnviadoRef.current
    ) {
      enviarRelatorioPorEmail();
    }
  }, [step]);

  function gerarPdf() {
    if (!empresaPrincipal) {
      showToast("Nenhuma empresa disponível para gerar o relatório.");
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
      itens?.length
        ? itens.map((item) => `<li>${escaparHtml(item)}</li>`).join("")
        : `<li>${escaparHtml(vazio)}</li>`;

    const areasDetalhadasHtml = areasComScore
      .map((a) => {
        const iaArea = iaResultado?.areas?.[a.label] || {};
        const achados = iaArea.achados || [];
        const causas = iaArea.causasProvaveis || [];
        const riscos = iaArea.riscos || [];
        const recomendacoes = iaArea.recomendacoes || [];
        const resumo = iaArea.resumo || "";
        const prioridade = iaArea.prioridade ?? "-";

        return `
          <section class="area-card">
            <div class="area-head">
              <div>
                <h3>${escaparHtml(a.label)}</h3>
                <span class="nivel">${escaparHtml(tierDe(a.score).label)}</span>
              </div>
              <div class="area-score">${a.score}<small>/100</small></div>
            </div>

            ${resumo ? `<p class="area-resumo">${escaparHtml(resumo)}</p>` : ""}

            <div class="area-grid">
              <div>
                <h4>Achados</h4>
                <ul>${listaHtml(achados, "Nenhum achado adicional registrado.")}</ul>
              </div>
              <div>
                <h4>Causas prováveis</h4>
                <ul>${listaHtml(causas, "Não foi possível determinar causas com segurança.")}</ul>
              </div>
              <div>
                <h4>Principais riscos</h4>
                <ul>${listaHtml(riscos, "Nenhum risco relevante identificado nesta área.")}</ul>
              </div>
              <div>
                <h4>Plano de ação</h4>
                <ol>${listaHtml(recomendacoes, "Manter os controles atuais e revisar os indicadores periodicamente.")}</ol>
              </div>
            </div>

            <div class="prioridade">Prioridade de atuação: <strong>${escaparHtml(prioridade)}</strong></div>
          </section>
        `;
      })
      .join("");

    const areasResumoHtml = areasComScore
      .map(
        (a) => `
          <tr>
            <td>${escaparHtml(a.label)}</td>
            <td><strong>${a.score}/100</strong></td>
            <td>${escaparHtml(tierDe(a.score).label)}</td>
          </tr>
        `
      )
      .join("");

    const subtemasHtml = subScoresAll
      .map(
        (s) => `
          <tr>
            <td>${escaparHtml(s.area)}</td>
            <td>${escaparHtml(s.tema)}</td>
            <td>${s.score}/100</td>
          </tr>
        `
      )
      .join("");

    const endereco = empresaPrincipal.endereco || {};
    const enderecoTexto = [
      endereco.logradouro,
      endereco.numero,
      endereco.bairro,
      endereco.municipio,
      endereco.uf,
    ].filter(Boolean).join(", ");

    const whatsappEspecialista = "https://wa.me/5541989049616";
    const logoUrl = `${window.location.origin}/finder-logo.png`;
    const dataGeracao = new Date().toLocaleString("pt-BR");

    const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Diagnóstico Finder - ${escaparHtml(empresaPrincipal.razao)}</title>
<style>
  @page { size: A4; margin: 13mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #17233D;
    margin: 0;
    font-size: 11.5px;
    line-height: 1.5;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .capa-logo { width: 230px; max-width: 70%; background: #fff; border-radius: 8px; padding: 8px; margin-bottom: 16px; }
  .capa {
    background: #17233D;
    color: #fff;
    padding: 30px 28px;
    border-radius: 14px;
    margin-bottom: 20px;
    page-break-inside: avoid;
  }
  .marca { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; opacity: .8; }
  .capa h1 { font-size: 27px; margin: 12px 0 7px; }
  .capa .empresa { font-size: 16px; font-weight: 700; margin: 0 0 4px; }
  .capa .meta { color: #D7DDEA; margin: 0; }
  h2 {
    font-size: 16px;
    margin: 22px 0 10px;
    padding-bottom: 6px;
    border-bottom: 2px solid #FF6B4A;
  }
  h3 { font-size: 14px; margin: 0; }
  h4 { font-size: 11px; text-transform: uppercase; letter-spacing: .4px; margin: 0 0 6px; }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 9px 20px;
  }
  .box {
    border: 1px solid #D8DEEA;
    background: #F7F8FB;
    border-radius: 10px;
    padding: 13px;
    page-break-inside: avoid;
  }
  .score-box {
    display: grid;
    grid-template-columns: 125px 1fr;
    gap: 20px;
    align-items: center;
    background: #17233D;
    color: #fff;
    padding: 18px;
    border-radius: 12px;
    page-break-inside: avoid;
  }
  .score-num { font-size: 42px; font-weight: 800; color: #FF6B4A; }
  .score-num small { font-size: 14px; color: #D7DDEA; }
  .score-box p { margin: 3px 0; color: #D7DDEA; }
  .resumo {
    border-left: 4px solid #FF6B4A;
    background: #FFF3EF;
    border-radius: 8px;
    padding: 13px 15px;
    page-break-inside: avoid;
  }
  .three-cols {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
  }
  .mini {
    border: 1px solid #E0E4EC;
    border-radius: 9px;
    padding: 11px;
    page-break-inside: avoid;
  }
  .mini strong { display: block; margin-bottom: 5px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border-bottom: 1px solid #D8DEEA; padding: 7px 6px; text-align: left; vertical-align: top; }
  th { background: #E9EDF5; font-size: 10.5px; }
  ul, ol { margin: 0; padding-left: 18px; }
  li { margin-bottom: 5px; }
  .area-card {
    border: 1px solid #D8DEEA;
    border-radius: 11px;
    padding: 14px;
    margin: 0 0 13px;
    page-break-inside: avoid;
  }
  .area-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 9px; }
  .area-score { font-size: 25px; font-weight: 800; color: #FF6B4A; }
  .area-score small { font-size: 10px; color: #5B667A; }
  .nivel {
    display: inline-block;
    margin-top: 4px;
    padding: 2px 8px;
    border-radius: 20px;
    background: #E9EDF5;
    font-size: 9.5px;
    font-weight: 700;
  }
  .area-resumo { background: #F7F8FB; border-radius: 7px; padding: 9px; margin: 0 0 10px; }
  .area-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .prioridade { margin-top: 9px; font-size: 10px; color: #5B667A; }
  .cta {
    margin-top: 24px;
    background: #17233D;
    color: white;
    border-radius: 12px;
    padding: 18px;
    page-break-inside: avoid;
  }
  .cta h3 { font-size: 15px; margin-bottom: 5px; }
  .cta a { color: #fff; font-weight: 700; }
  .aviso { margin-top: 20px; font-size: 9.5px; color: #5B667A; font-style: italic; }
  .footer { margin-top: 16px; padding-top: 9px; border-top: 1px solid #D8DEEA; font-size: 9px; color: #7A8495; text-align: center; }
  @media print {
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>

  <section class="capa">
    <img src="${logoUrl}" alt="Finder of Solutions" class="capa-logo" />
    <div class="marca">Finder of Solutions</div>
    <h1>Diagnóstico Empresarial Preliminar</h1>
    <p class="empresa">${escaparHtml(empresaPrincipal.razao)}</p>
    <p class="meta">${escaparHtml(categoriaPrincipal)} · ${escaparHtml(
      atividadePredominante?.descricao || empresaPrincipal.cnae || ""
    )}</p>
  </section>

  <h2>1. Identificação</h2>
  <div class="box grid">
    <div><strong>Responsável:</strong><br>${escaparHtml(nome)}</div>
    <div><strong>Cargo:</strong><br>${escaparHtml(cargo)}</div>
    <div><strong>WhatsApp:</strong><br>${escaparHtml(telefone || "-")}</div>
    <div><strong>E-mail:</strong><br>${escaparHtml(email || "-")}</div>
    <div><strong>CNPJ:</strong><br>${escaparHtml(empresaPrincipal.cnpjDigits || "-")}</div>
    <div><strong>Porte:</strong><br>${escaparHtml(empresaPrincipal.porte || "-")}</div>
    <div><strong>Regime informado:</strong><br>${escaparHtml(regime || "-")}</div>
    <div><strong>Faturamento informado:</strong><br>${escaparHtml(faturamento?.label || "-")}</div>
    <div style="grid-column:1/-1"><strong>Atividade predominante informada:</strong><br>${escaparHtml(
      atividadePredominante
        ? `${atividadePredominante.codigo || ""} — ${atividadePredominante.descricao || ""}`
        : "-"
    )}</div>
    <div style="grid-column:1/-1"><strong>Atividades efetivamente exercidas informadas:</strong><br>${escaparHtml(
      atividadesSelecionadasObjetos.length
        ? atividadesSelecionadasObjetos
            .map((atividade) => `${atividade.codigo || ""} — ${atividade.descricao || ""}`)
            .join(" | ")
        : "-"
    )}</div>
    <div style="grid-column:1/-1"><strong>Descrição real do negócio:</strong><br>${escaparHtml(descricaoNegocio || "-")}</div>
    <div style="grid-column:1/-1"><strong>Negócio interpretado:</strong><br>${escaparHtml(negocioInterpretado?.subsegmento || negocioInterpretado?.segmento || "-")}</div>
    <div style="grid-column:1/-1"><strong>Endereço:</strong><br>${escaparHtml(enderecoTexto || "-")}</div>
  </div>

  <h2>2. Resultado geral</h2>
  <div class="score-box">
    <div>
      <div class="score-num">${score}<small>/100</small></div>
      <strong>${escaparHtml(tierGeral.label)}</strong>
    </div>
    <div>
      <p><strong>Categoria:</strong> ${escaparHtml(categoriaPrincipal)}</p>
      <p><strong>Colaboradores:</strong> ${escaparHtml(colaboradores || "-")}</p>
      <p><strong>Áreas avaliadas:</strong> ${escaparHtml(gruposSelecionados.map((g) => g.label).join(", "))}</p>
    </div>
  </div>

  ${resumoExecutivo ? `
    <h2>3. Resumo executivo</h2>
    <div class="resumo">${escaparHtml(resumoExecutivo)}</div>
  ` : ""}

  ${leituraDaDorIa ? `
    <h2>4. Leitura da dor declarada</h2>
    <div class="resumo">${escaparHtml(leituraDaDorIa)}</div>
  ` : ""}

  ${alertaEstrategicoIa ? `
    <h2>5. Alerta estratégico</h2>
    <div class="box"><strong>${escaparHtml(alertaEstrategicoIa)}</strong></div>
  ` : ""}

  ${(causasProvaveisIa.length || impactosIa.length) ? `
    <h2>6. Causas prováveis e impactos</h2>
    <div class="area-grid">
      <div class="box">
        <h4>Causas prováveis</h4>
        <ul>${listaHtml(causasProvaveisIa, "Não foi possível determinar causas com segurança.")}</ul>
      </div>
      <div class="box">
        <h4>Impactos possíveis</h4>
        <ul>${listaHtml(impactosIa, "Nenhum impacto adicional identificado.")}</ul>
      </div>
    </div>
  ` : ""}

  <h2>7. Visão executiva</h2>
  <div class="three-cols">
    <div class="mini">
      <strong>Principais dores</strong>
      <ul>${listaHtml(principaisDoresIa.length ? principaisDoresIa : pontosAtencaoFinal.slice(0,3))}</ul>
    </div>
    <div class="mini">
      <strong>Pontos fortes</strong>
      <ul>${listaHtml(pontosFortesIa, "Pontos fortes serão validados em análise aprofundada.")}</ul>
    </div>
    <div class="mini">
      <strong>Prioridades</strong>
      <ol>${listaHtml(prioridadesIa.length ? prioridadesIa : recomendacoesFinal.slice(0,3).map((r) => r.dica))}</ol>
    </div>
  </div>

  <h2>8. Índice de maturidade por área</h2>
  <table>
    <thead><tr><th>Área</th><th>Score</th><th>Nível</th></tr></thead>
    <tbody>${areasResumoHtml}</tbody>
  </table>

  <h2>9. Detalhamento por subtema</h2>
  <table>
    <thead><tr><th>Área</th><th>Subtema</th><th>Score</th></tr></thead>
    <tbody>${subtemasHtml}</tbody>
  </table>

  <h2>10. Diagnóstico detalhado</h2>
  ${areasDetalhadasHtml}

  <h2>11. Oportunidades identificadas</h2>
  <div class="box">
    <ul>${listaHtml(oportunidadesIa.length ? oportunidadesIa : recomendacoesFinal.map((r) => r.dica))}</ul>
  </div>

  ${regime !== "Não sei" && aliquota != null ? `
    <h2>12. Referência tributária</h2>
    <div class="box">
      <strong>Carga tributária estimada de referência:</strong> ${escaparHtml(String(aliquota))}%<br>
      <strong>Estimativa anual:</strong> ${escaparHtml(formatBRL(valorAnualImposto))}<br>
      <span style="color:#5B667A">Estimativa simplificada com base nas informações fornecidas; não representa cálculo fiscal definitivo.</span>
    </div>
  ` : ""}

  ${observacao.trim() ? `
    <h2>13. Observação do participante</h2>
    <div class="box">${escaparHtml(observacao.trim())}</div>
  ` : ""}

  ${proximosPassosIa.length ? `
    <h2>14. Próximos passos recomendados</h2>
    <div class="box">
      <ol>${listaHtml(proximosPassosIa)}</ol>
    </div>
  ` : ""}

  ${visaoGrupoIa?.aplicavel ? `
    <h2>15. Visão do grupo empresarial</h2>
    <div class="box">
      <p>${escaparHtml(visaoGrupoIa.resumo || "")}</p>
      <ul>${listaHtml(visaoGrupoIa.pontosAtencao || [])}</ul>
    </div>
  ` : ""}

  ${lacunasDiagnosticoIa.length ? `
    <h2>16. Pontos que merecem aprofundamento</h2>
    ${lacunasDiagnosticoIa.map((lacuna) => `
      <div class="box" style="margin-bottom:8px;">
        <strong>${escaparHtml(lacuna.tema || "Tema")}</strong>
        <p>${escaparHtml(lacuna.motivo || "")}</p>
        <ul>${listaHtml(lacuna.perguntasSugeridas || [])}</ul>
      </div>
    `).join("")}
  ` : ""}

  ${oportunidadesConsultoriaIa.length ? `
    <h2>17. Oportunidades de aprofundamento profissional</h2>
    ${oportunidadesConsultoriaIa.map((item) => `
      <div class="box" style="margin-bottom:8px;">
        <strong>${escaparHtml(item.oportunidade || item.area || "")}</strong><br>
        <span>${escaparHtml(item.motivo || "")}</span><br>
        <small>Prioridade: ${escaparHtml(item.prioridade || "")}</small>
      </div>
    `).join("")}
  ` : ""}

  <section class="cta">
    <h3>Quer aprofundar este diagnóstico?</h3>
    <div>Fale com um especialista Finder pelo WhatsApp:</div>
    <a href="${whatsappEspecialista}">(41) 98904-9616</a>
  </section>

  <p class="aviso">
    As informações apresentadas possuem caráter preliminar e foram elaboradas a partir das respostas fornecidas pelo participante.
    Recomenda-se análise individualizada para validação das oportunidades identificadas.
  </p>

  <div class="footer">
    Finder of Solutions · Diagnóstico Empresarial · Gerado em ${escaparHtml(dataGeracao)}
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
      console.error("Erro ao gerar relatório:", erro);
      showToast("Não foi possível gerar o relatório.");
    }
  }

  return (
    <div style={{ background: "#EEF0F5", minHeight: 760, display: "flex", justifyContent: "center", padding: "32px 16px", fontFamily: BODY_FONT }}>
      <div style={{ width: 380, borderRadius: 40, background: NAVY, padding: 12, boxShadow: "0 30px 60px rgba(23,35,61,0.25)" }}>
        <div style={{ width: 120, height: 22, background: NAVY, borderRadius: 12, margin: "0 auto 4px", position: "relative" }}>
          <div style={{ width: 46, height: 6, background: "#0B1526", borderRadius: 4, position: "absolute", left: "50%", top: 8, transform: "translateX(-50%)" }} />
        </div>
        <div style={{ background: WHITE, borderRadius: 28, minHeight: 686, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
          <StepDots step={step} />

          <div style={{ flex: 1, padding: "18px 22px 22px", display: "flex", flexDirection: "column" }}>

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
                
                <PrimaryButton disabled={!nome || !cargo || telefone.replace(/\D/g, "").length < 10 || !email.includes("@")} onClick={() => setStep("cnpj")}>
                  Continuar <ArrowRight size={16} />
                </PrimaryButton>
              </div>
            )}

            {step === "cnpj" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <p style={{ fontFamily: DISPLAY_FONT, fontSize: 20, fontWeight: 700, color: NAVY, margin: "6px 0 4px" }}>CNPJ da empresa</p>
                <p style={{ fontSize: 12.5, color: MUTED, margin: "0 0 14px" }}>
                  Adicione o CNPJ da empresa que será a base do diagnóstico. Se houver outras empresas no grupo, você pode adicionar até {MAX_EMPRESAS} CNPJs.
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
                        empresas.length > 1
                          ? "Ex.: A empresa A fabrica churrasqueiras metálicas e a empresa B realiza a comercialização e instalação dos produtos."
                          : "Ex.: Fabricamos churrasqueiras metálicas, com modelos de linha e projetos sob medida, vendendo para consumidor final, lojistas e construtoras."
                      }
                      rows={4}
                      style={{ ...inputStyle, resize: "vertical", fontFamily: BODY_FONT, marginBottom: 6 }}
                    />
                    <p style={{ fontSize: 10.5, color: MUTED, margin: "0 0 8px", lineHeight: 1.4 }}>
                      Não se limite ao CNAE. Explique o que vocês produzem, vendem ou entregam, para quem e como a operação funciona.
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
                    Vamos entender sua principal dor
                  </p>
                  <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5, margin: 0 }}>
                    Essas respostas serão cruzadas com o CNAE e com o checklist para tornar o relatório mais específico.
                  </p>
                </div>

                <div>
                  <p style={{ ...labelStyle, fontSize: 12, marginBottom: 5 }}>
                    Quais problemas mais incomodam sua empresa hoje?
                  </p>

                  <p style={{ fontSize: 10.8, color: MUTED, lineHeight: 1.4, margin: "0 0 9px" }}>
                    Você pode selecionar mais de uma opção. A análise vai cruzar essas dores com as respostas do diagnóstico.
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {DORES_EVENTO.map((item) => {
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
                    Se pudesse resolver apenas um problema nos próximos 90 dias, qual seria?
                  </label>

                  <textarea
                    value={dor90Dias}
                    onChange={(e) => setDor90Dias(e.target.value)}
                    placeholder="Ex.: aumentar vendas; descobrir por que o caixa não sobra; reduzir retrabalho..."
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
                    Qual impacto esse problema está causando?
                  </p>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {IMPACTOS_DOR.map((impacto) => {
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
                    Quais áreas merecem mais atenção?
                  </p>

                  <p style={{ fontSize: 11, color: dores.length === MAX_DORES ? CORAL : "#9AA3B5", margin: "0 0 8px", fontWeight: 600 }}>
                    Escolha até {MAX_DORES} áreas · {dores.length} selecionada(s)
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {AREAS.map(({ id, label, Icon }) => {
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
                    Entendendo o seu negócio
                  </p>
                  <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, maxWidth: 360, margin: 0 }}>
                    Cruzando CNAEs, atividade informada, descrição do negócio, dores e departamentos selecionados para montar perguntas específicas.
                  </p>
                </div>
              </div>
            )}

            {step === "confirmarNegocio" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <p style={{ fontFamily: DISPLAY_FONT, fontSize: 21, fontWeight: 700, color: NAVY, margin: "6px 0 5px" }}>
                    Foi assim que entendemos seu negócio
                  </p>
                  <p style={{ fontSize: 12, color: MUTED, margin: 0, lineHeight: 1.5 }}>
                    Confirme antes de responder. Se a interpretação estiver errada, ajuste a descrição e gere novamente.
                  </p>
                </div>

                {negocioInterpretado ? (
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

                <div>
                  <label style={labelStyle}>Ajuste a descrição, se necessário</label>
                  <textarea
                    value={descricaoNegocio}
                    onChange={(e) => setDescricaoNegocio(e.target.value)}
                    rows={4}
                    style={{ ...inputStyle, resize: "vertical", fontFamily: BODY_FONT }}
                  />
                </div>

                {perguntasDinamicas.length > 0 && (
                  <div style={{ background: ICE, borderRadius: 10, padding: 10 }}>
                    <p style={{ fontSize: 11.3, color: NAVY, margin: 0, lineHeight: 1.45 }}>
                      <strong>{perguntasDinamicas.length} perguntas personalizadas</strong> foram montadas para {dores.map(areaLabel).join(", ")}.
                    </p>
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                  <button
                    type="button"
                    onClick={gerarPerguntasPersonalizadas}
                    disabled={gerandoPerguntas || descricaoNegocio.trim().length < 20}
                    style={{ ...chipStyle(false), flex: 1 }}
                  >
                    Reanalisar
                  </button>
                  <PrimaryButton
                    disabled={perguntasDinamicas.length === 0}
                    onClick={() => setStep("checklist")}
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
                  Checklist — {gruposSelecionados.map((g) => g.label).join(", ")}
                </p>
                <p style={{ fontSize: 11.5, color: MUTED, margin: "0 0 12px" }}>
                  {todasPerguntas.length} perguntas · personalizadas para {negocioInterpretado?.subsegmento || categoriaPrincipal}
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

            {step === "analisando" && empresaPrincipal && gruposSelecionados.length > 0 && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 18 }}>
                <Loader2 size={34} color={CORAL} className="spin" />
                <p style={{ fontFamily: DISPLAY_FONT, fontSize: 18, fontWeight: 700, color: NAVY, margin: 0 }}>A IA está analisando</p>
                <p style={{ fontSize: 12.5, color: MUTED, minHeight: 18, margin: 0, padding: "0 10px" }}>
                  {[
                    `Atividade-base: ${atividadePredominante?.descricao || categoriaPrincipal}`,
                    `Analisando as áreas: ${gruposSelecionados.map((g) => g.label).join(", ")}`,
                    "Cruzando respostas com o contexto do segmento",
                    "Estimando carga tributária de referência",
                    "Calculando índice de maturidade por departamento",
                  ][msgIdx]}
                </p>
              </div>
            )}

            {step === "resultado" && empresaPrincipal && gruposSelecionados.length > 0 && areaMaisFraca && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

                <div style={{ background: tierDe(areaMaisFraca.score).bg, borderRadius: 14, padding: 14, marginBottom: 16, display: "flex", gap: 10 }}>
                  <Flame size={18} color={tierDe(areaMaisFraca.score).color} style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 12, color: tierDe(areaMaisFraca.score).color, margin: 0, lineHeight: 1.45 }}>
                    Sua empresa possui nível <strong>{tierDe(areaMaisFraca.score).label.toUpperCase()}</strong> em <strong>{areaMaisFraca.label}</strong>.
                    Encontramos {riscosNaAreaMaisFraca} {riscosNaAreaMaisFraca === 1 ? "ponto" : "pontos"} que podem estar gerando perda de resultado. Agende um diagnóstico completo.
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 0 14px" }}>
                  <ScoreRing score={score} color={tierGeral.color} />
                  <span style={{ ...badgeStyle, background: tierGeral.bg, color: tierGeral.color, marginTop: 10, fontWeight: 700 }}>{tierGeral.label}</span>
                </div>

                <p style={{ fontSize: 12, color: MUTED, textAlign: "center", margin: "0 0 4px" }}>
                  {empresaPrincipal.razao}{empresas.length > 1 ? ` + ${empresas.length - 1} empresa${empresas.length > 2 ? "s" : ""} do grupo` : ""}
                </p>
                <p style={{ fontSize: 11, color: "#9AA3B5", textAlign: "center", margin: "0 0 16px" }}>
                  {categoriaPrincipal} · {colaboradores} colaboradores · {gruposSelecionados.map((g) => g.label).join(", ")}
                </p>

                {resumoExecutivo && (
                  <div style={{ background: "#FFF3EF", borderLeft: `4px solid ${CORAL}`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
                    <p style={{ fontSize: 10.5, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 5px" }}>
                      Resumo executivo
                    </p>
                    <p style={{ fontSize: 12, color: NAVY, margin: 0, lineHeight: 1.5 }}>{resumoExecutivo}</p>
                  </div>
                )}

                {leituraDaDorIa && (
                  <div style={{ background: "#F7F8FB", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                    <p style={{ fontSize: 10.5, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 5px" }}>
                      Leitura da principal dor
                    </p>
                    <p style={{ fontSize: 11.8, color: NAVY, margin: 0, lineHeight: 1.5 }}>{leituraDaDorIa}</p>
                  </div>
                )}

                {alertaEstrategicoIa && (
                  <div style={{ background: "#FAEEDA", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                    <p style={{ fontSize: 10.5, fontWeight: 700, color: "#854F0B", textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 5px" }}>
                      Alerta estratégico
                    </p>
                    <p style={{ fontSize: 11.8, color: "#854F0B", margin: 0, lineHeight: 1.5, fontWeight: 600 }}>{alertaEstrategicoIa}</p>
                  </div>
                )}

                {causasProvaveisIa.length > 0 && (
                  <div style={{ background: "#F7F8FB", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                    <p style={{ fontSize: 10.5, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 6px" }}>
                      Possíveis causas
                    </p>
                    {causasProvaveisIa.slice(0, 4).map((item, i) => (
                      <p key={i} style={{ fontSize: 11.5, color: NAVY, margin: i ? "5px 0 0" : 0, lineHeight: 1.4 }}>
                        • {item}
                      </p>
                    ))}
                  </div>
                )}

                {pontosFortesIa.length > 0 && (
                  <div style={{ background: "#E1F5EE", borderRadius: 10, padding: 12, marginBottom: 14 }}>
                    <p style={{ fontSize: 10.5, fontWeight: 700, color: "#0F6E56", textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 6px" }}>
                      Pontos fortes
                    </p>
                    {pontosFortesIa.slice(0, 3).map((p, i) => (
                      <p key={i} style={{ fontSize: 11.5, color: "#0F6E56", margin: i ? "5px 0 0" : 0, lineHeight: 1.4 }}>
                        • {p}
                      </p>
                    ))}
                  </div>
                )}

                {envioRelatorio === "sent" && (
                  <div style={{ background: "#E1F5EE", borderRadius: 10, padding: 10, marginBottom: 14 }}>
                    <p style={{ fontSize: 11.5, color: "#0F6E56", margin: 0, lineHeight: 1.4 }}>
                      Diagnóstico registrado e enviado para a Finder
                      {consentimentoEmail && email ? ` e para ${email}` : ""}.
                    </p>
                  </div>
                )}

                {envioRelatorio === "error" && (
                  <div style={{ background: "#FAECE7", borderRadius: 10, padding: 10, marginBottom: 14 }}>
                    <p style={{ fontSize: 11.5, color: "#993C1D", margin: 0, lineHeight: 1.4 }}>
                      O diagnóstico foi concluído, mas houve falha no envio por e-mail. Você ainda pode gerar o PDF normalmente.
                    </p>
                  </div>
                )}

                {observacao.trim() && (
                  <div style={{ background: ICE, borderRadius: 12, padding: 12, marginBottom: 16 }}>
                    <p style={{ fontSize: 10.5, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 4px" }}>Observação do participante</p>
                    <p style={{ fontSize: 12, color: NAVY, margin: 0, lineHeight: 1.4, fontStyle: "italic" }}>"{observacao.trim()}"</p>
                  </div>
                )}

                <div style={{
                  background: regime === "Não sei" ? "#FAECE7" : NAVY, borderRadius: 14, padding: 16, marginBottom: 18,
                }}>
                  {regime === "Não sei" ? (
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <AlertTriangle size={18} color="#993C1D" style={{ flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <p style={{ fontSize: 12.5, fontWeight: 700, color: "#993C1D", margin: "0 0 4px" }}>Regime tributário não identificado</p>
                        <p style={{ fontSize: 11.5, color: "#993C1D", margin: 0, lineHeight: 1.4 }}>
                          Não saber o próprio regime tributário já é, em si, um ponto de atenção — pode significar pagar mais imposto do que o necessário.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <Percent size={14} color="#C6CEDD" />
                        <p style={{ fontSize: 11, color: "#C6CEDD", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Carga tributária estimada</p>
                      </div>
                      <p style={{ fontFamily: DISPLAY_FONT, fontSize: 32, fontWeight: 700, color: WHITE, margin: "0 0 4px" }}>{aliquota}%</p>
                      <p style={{ fontSize: 12, color: "#C6CEDD", margin: 0 }}>
                        ≈ {formatBRL(valorAnualImposto)}/ano em {regime}, com base no faturamento informado
                      </p>
                      <p style={{ fontSize: 10, color: "#8592AC", margin: "8px 0 0", fontStyle: "italic" }}>
                        Estimativa de referência para {segmentoPredominante?.toLowerCase()}. O valor real depende de detalhes específicos da operação.
                      </p>
                    </>
                  )}
                </div>

                <p style={sectionTitleStyle}>Índice de maturidade por departamento</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                  {areasComScore.map((a) => {
                    const t = tierDe(a.score);
                    return (
                      <div key={a.id}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 12, color: NAVY, fontWeight: 700 }}>{a.label}</span>
                          <span style={{ fontSize: 10.5, padding: "1px 8px", borderRadius: 10, background: t.bg, color: t.color, fontWeight: 700 }}>{t.label} · {a.score}</span>
                        </div>
                        <div style={{ height: 6, background: "#EEF0F5", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${a.score}%`, height: "100%", background: t.color, borderRadius: 4, transition: "width 0.6s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p style={sectionTitleStyle}>Detalhamento por subtema</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 16 }}>
                  {subScoresAll.map((s, i) => (
                    <div key={i}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 11.5, color: NAVY, fontWeight: 600 }}>
                          {gruposSelecionados.length > 1 ? `${s.area} · ${s.tema}` : s.tema}
                        </span>
                        <span style={{ fontSize: 11.5, color: MUTED }}>{s.score}</span>
                      </div>
                      <div style={{ height: 6, background: "#EEF0F5", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${s.score}%`, height: "100%", background: tierDe(s.score).color, borderRadius: 4, transition: "width 0.6s ease" }} />
                      </div>
                    </div>
                  ))}
                </div>

                {pontosAtencaoFinal.length > 0 && (
                  <>
                    <p style={sectionTitleStyle}>Principais riscos identificados</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                      {pontosAtencaoFinal.map((p, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: CORAL, marginTop: 6, flexShrink: 0 }} />
                          <p style={{ fontSize: 12, color: NAVY, margin: 0, lineHeight: 1.4 }}>{p}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <p style={sectionTitleStyle}>Oportunidades de ganho rápido</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {recomendacoesFinal.map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <CheckCircle2 size={14} color="#0F6E56" style={{ marginTop: 2, flexShrink: 0 }} />
                      <div>
                        {gruposSelecionados.length > 1 && (
                          <p style={{ fontSize: 10, color: MUTED, margin: "0 0 2px", fontWeight: 600 }}>{s.area}</p>
                        )}
                        <p style={{ fontSize: 12, color: NAVY, margin: 0, lineHeight: 1.4 }}>{s.dica}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {proximosPassosIa.length > 0 && (
                  <>
                    <p style={sectionTitleStyle}>Próximos passos recomendados</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
                      {proximosPassosIa.slice(0, 5).map((item, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <CheckCircle2 size={14} color="#185FA5" style={{ marginTop: 2, flexShrink: 0 }} />
                          <p style={{ fontSize: 11.8, color: NAVY, margin: 0, lineHeight: 1.4 }}>{item}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {visaoGrupoIa?.aplicavel && (
                  <>
                    <p style={sectionTitleStyle}>Visão do grupo empresarial</p>
                    <div style={{ background: ICE, borderRadius: 10, padding: 12, marginBottom: 16 }}>
                      <p style={{ fontSize: 11.8, color: NAVY, margin: "0 0 6px", lineHeight: 1.45 }}>{visaoGrupoIa.resumo}</p>
                      {(visaoGrupoIa.pontosAtencao || []).slice(0, 4).map((item, i) => (
                        <p key={i} style={{ fontSize: 11.3, color: NAVY, margin: i ? "4px 0 0" : 0 }}>• {item}</p>
                      ))}
                    </div>
                  </>
                )}

                {lacunasDiagnosticoIa.length > 0 && (
                  <>
                    <p style={sectionTitleStyle}>O que ainda precisa ser aprofundado</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                      {lacunasDiagnosticoIa.slice(0, 4).map((lacuna, i) => (
                        <div key={i} style={{ background: "#FFF3EF", borderRadius: 10, padding: 10 }}>
                          <p style={{ fontSize: 11.3, color: NAVY, fontWeight: 700, margin: "0 0 3px" }}>{lacuna.tema}</p>
                          <p style={{ fontSize: 10.8, color: MUTED, margin: 0, lineHeight: 1.4 }}>{lacuna.motivo}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <p style={{ fontSize: 10.5, color: "#9AA3B5", fontStyle: "italic", margin: "0 0 16px", lineHeight: 1.4 }}>
                  Diagnóstico empresarial preliminar elaborado a partir das respostas fornecidas. Recomenda-se análise profissional individualizada para validação.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <PrimaryButton onClick={gerarPdf}>
                    <Download size={15} /> Baixar relatório em PDF
                  </PrimaryButton>
                  <PrimaryButton
                    style={{ background: NAVY }}
                    onClick={() => {
                      const numero = "5541989049616";
                      const mensagem = encodeURIComponent(
                        `Olá! Acabei de realizar o Diagnóstico Empresarial Finder.

Empresa: ${empresaPrincipal?.razao || ""}
Responsável: ${nome || ""}
Score: ${score}/100
Principal ponto de atenção: ${areaMaisFraca?.label || ""}

Gostaria de falar com um especialista sobre o resultado.`
                      );

                      window.open(`https://wa.me/${numero}?text=${mensagem}`, "_blank");
                    }}
                  >
                    <CalendarCheck size={15} /> Falar com especialista
                  </PrimaryButton>
                  <button onClick={reiniciar} style={{
                    background: "none", border: "none", color: MUTED, fontSize: 11.5,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 6, cursor: "pointer",
                  }}>
                    <RotateCcw size={12} /> Reiniciar simulação
                  </button>
                </div>
              </div>
            )}

          </div>

          {step !== "intro" && step !== "resultado" && step !== "analisando" && (
            <button onClick={() => {
              const back = { cnpj: "cadastro", porte: "cnpj", dor: "porte", checklist: "dor" };
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

const labelStyle = { fontSize: 11.5, color: MUTED, marginBottom: 6, display: "block", fontWeight: 600 };
const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #D8DEEA",
  fontSize: 13.5, marginBottom: 14, fontFamily: BODY_FONT, color: NAVY, boxSizing: "border-box",
};
const sectionTitleStyle = { fontSize: 11.5, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" };
const badgeStyle = {
  fontSize: 10.5, padding: "3px 9px", borderRadius: 20, background: WHITE, color: NAVY,
  fontWeight: 600, display: "inline-block",
};
function chipStyle(active) {
  return {
    padding: "9px 10px", borderRadius: 10, border: active ? `1px solid ${CORAL}` : "1px solid #D8DEEA",
    background: active ? CORAL : WHITE, color: active ? WHITE : NAVY, fontSize: 12.5,
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
