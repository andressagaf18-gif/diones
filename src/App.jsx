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

function normalizarSegmentoTributario(segmento) {
  if (!segmento) return "Serviço";

  const valor = String(segmento).toLowerCase();

  if (valor.includes("indústria") || valor.includes("industria")) {
    return "Indústria";
  }

  if (valor.includes("comércio") || valor.includes("comercio")) {
    return "Comércio";
  }

  return "Serviço";
}

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
// Perguntas com variação de texto por segmento usam porSegmento; as demais valem para todos.
function textoDe(q, segmento, categoria) {
  return (
    q.porCategoria?.[categoria]?.text ||
    q.porSegmento?.[segmento]?.text ||
    q.text
  );
}
function riscoDe(q, segmento, categoria) {
  return (
    q.porCategoria?.[categoria]?.risco ||
    q.porSegmento?.[segmento]?.risco ||
    q.risco
  );
}

// Cada área tem 3 subtemas, cada um com 3 perguntas.
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
function formatBRL(v) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }); }

function pickCompany(cnpjDigits) {
  const sum = cnpjDigits.split("").reduce((acc, d) => acc + Number(d), 0);
  const idx = cnpjDigits.length ? sum % COMPANIES.length : 0;
  return COMPANIES[idx];
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
  const [cnpjInput, setCnpjInput] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [empresas, setEmpresas] = useState([]);
  const [faturamento, setFaturamento] = useState(null);
  const [colaboradores, setColaboradores] = useState(null);
  const [regime, setRegime] = useState(null);
  const [observacao, setObservacao] = useState("");
  const [dores, setDores] = useState([]);
  const [respostas, setRespostas] = useState({});
  const [msgIdx, setMsgIdx] = useState(0);
  const [toast, setToast] = useState("");
  const [iaResultado, setIaResultado] = useState(null);
  const toastTimer = useRef(null);

  const segmentoPredominante = segmentoPredominanteDe(empresas);
  const empresaPrincipal = empresas[0] || null;
  const codigoQuestionario = empresaPrincipal?.codigoQuestionario || null;
  const areasPrioritarias = empresaPrincipal?.areasPrioritarias || [];

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
  };

  const areasSugeridas = areasPrioritarias
    .map((nome) => mapaAreaApiParaId[nome])
    .filter(Boolean);

  const areasDoDiagnostico = dores.length > 0
    ? dores
    : areasSugeridas.slice(0, MAX_DORES);

  const gruposSelecionados = areasDoDiagnostico
    .filter((id) => CHECKLISTS[id])
    .map((id) => ({
      id,
      label: areaLabel(id),
      subtemas: CHECKLISTS[id],
    }));

  const todasPerguntas = gruposSelecionados.flatMap((g) =>
    g.subtemas.flatMap((s) => s.perguntas)
  );

  const todasRespondidas =
    todasPerguntas.length > 0 &&
    todasPerguntas.every((q) => respostas[q.id]);

  useEffect(() => {
    if (step !== "analisando" || !empresaPrincipal || areasDoDiagnostico.length === 0) return;

    let cancelado = false;
    const labels = areasDoDiagnostico.map(areaLabel);
    const msgs = [
      `Identificando segmento predominante: ${segmentoPredominante}`,
      `Carregando base de conhecimento: ${labels.join(", ")}`,
      "Cruzando respostas de todos os subtemas do checklist",
      "Estimando carga tributária de referência",
      "Calculando índice de maturidade por departamento",
    ];

    setMsgIdx(0);

    const interval = setInterval(
      () => setMsgIdx((i) => Math.min(i + 1, msgs.length - 1)),
      500
    );

    const payload = {
      segmento: segmentoPredominante,
      categoria: empresaPrincipal?.categoria || null,
      codigoQuestionario,
      empresas: empresas.map((e) => e.razao),
      faturamento: faturamento?.label,
      colaboradores,
      regime,
      observacao,
      areas: gruposSelecionados.map((g) => ({
        area: g.label,
        score: scoreDe(g.subtemas.flatMap((s) => s.perguntas)),
        subtemas: g.subtemas.map((s) => ({
          tema: s.tema,
          perguntas: s.perguntas.map((q) => ({
            texto: textoDe(
              q,
              segmentoPredominante,
              empresaPrincipal?.categoria
            ),
            resposta: respostas[q.id],
          })),
        })),
      })),
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
          console.error("Erro na API de diagnóstico:", erro);
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
        setIaResultado(mapa);
      } else {
        setIaResultado(null);
      }

      setStep("resultado");
    });

    return () => {
      cancelado = true;
      clearInterval(interval);
    };
  }, [step]);
  async function adicionarCnpj() {
    const digits = cnpjInput.replace(/\D/g, "");

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
      const r = await fetch(`/api/cnpj?cnpj=${digits}`);
      const data = await r.json();

      if (!r.ok || !data?.sucesso) {
        throw new Error(data?.error || "Erro ao consultar CNPJ");
      }

      const empresa = {
        cnpjDigits: data.empresa?.cnpj || digits,
        razao: data.empresa?.razaoSocial || "Razão social não informada",
        nomeFantasia: data.empresa?.nomeFantasia || "",
        porte: data.empresa?.porte || "Não informado",
        segmento: data.classificacao?.segmento || "Serviço",
        categoria: data.classificacao?.categoria || "",
        codigoQuestionario: data.classificacao?.codigoQuestionario || "",
        cnae: `${data.cnae?.codigo || ""} — ${data.cnae?.descricao || ""}`,
        areasPrioritarias:
          data.classificacao?.diagnostico?.areasPrioritarias || [],
        areasComplementares:
          data.classificacao?.diagnostico?.areasComplementares || [],
        endereco: data.endereco || {},
      };

      setEmpresas((prev) => [...prev, empresa]);

      if (empresas.length === 0 && dores.length === 0) {
        const sugeridas = empresa.areasPrioritarias
          .map((nome) => mapaAreaApiParaId[nome])
          .filter(Boolean)
          .slice(0, MAX_DORES);

        if (sugeridas.length > 0) {
          setDores(sugeridas);
        }
      }

      setCnpjInput("");
      showToast("Empresa encontrada com sucesso.");
    } catch (err) {
      console.error("Erro ao consultar CNPJ:", err);
      showToast(err.message || "Erro ao consultar CNPJ");
    } finally {
      setBuscando(false);
    }
  }

  function removerEmpresa(idx) {
    setEmpresas((prev) => prev.filter((_, i) => i !== idx));
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

  function reiniciar() {
    setStep("intro"); setNome(""); setCargo(""); setCnpjInput("");
    setEmpresas([]); setFaturamento(null); setColaboradores(null); setRegime(null);
    setObservacao(""); setDores([]); setRespostas({}); setIaResultado(null);
  }

  function scoreDe(perguntas) {
    if (!perguntas.length) return 0;
    const total = perguntas.reduce((acc, q) => acc + pesoResposta(q, respostas[q.id]), 0);
    return Math.round((total / (perguntas.length * 5)) * 100);
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
  empresaPrincipal?.categoria
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
    ? areasDoDiagnostico.flatMap((id) => iaResultado[areaLabel(id)]?.riscos || []).slice(0, 6)
    : pontosAtencao;
  const recomendacoesFinal = iaResultado
    ? areasDoDiagnostico.flatMap((id) => (iaResultado[areaLabel(id)]?.recomendacoes || []).map((r) => ({ area: areaLabel(id), dica: r }))).slice(0, 3)
    : subOrdenados.slice(0, 3);

  const aliquota = empresaPrincipal && regime ? estimarAliquota(regime, segmentoPredominante, faturamento?.anual || 0) : null;
  const valorAnualImposto = aliquota != null && faturamento ? faturamento.anual * (aliquota / 100) : null;

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
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 18 }}>
                <div style={{ width: 84, height: 84, borderRadius: "50%", background: ICE, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <QrCode size={38} color={NAVY} />
                </div>
                <div>
                  <p style={{ fontFamily: DISPLAY_FONT, fontSize: 22, fontWeight: 700, color: NAVY, margin: "0 0 8px" }}>Escaneie para começar</p>
                  <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.5, margin: 0 }}>
                    Simulação da tela que o participante vê ao ler o QR code no evento.
                  </p>
                </div>
                <PrimaryButton onClick={() => setStep("cadastro")}>
                  Simular leitura do QR code <ArrowRight size={16} />
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

                <div style={{ flex: 1 }} />
                <PrimaryButton disabled={!nome || !cargo} onClick={() => setStep("cnpj")}>
                  Continuar <ArrowRight size={16} />
                </PrimaryButton>
              </div>
            )}

            {step === "cnpj" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <p style={{ fontFamily: DISPLAY_FONT, fontSize: 20, fontWeight: 700, color: NAVY, margin: "6px 0 4px" }}>CNPJ da empresa</p>
                <p style={{ fontSize: 12.5, color: MUTED, margin: "0 0 14px" }}>
                  Tem mais de uma empresa? Adicione até {MAX_EMPRESAS} CNPJs — vamos considerar o segmento predominante do grupo.
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
                        <span style={badgeStyle}>{e.segmento}</span>
                        <span style={badgeStyle}>{e.porte}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {empresas.length > 1 && (
                  <p style={{ fontSize: 11, color: CORAL, fontWeight: 600, margin: "10px 0 0" }}>
                    Segmento predominante do grupo: {segmentoPredominante}
                  </p>
                )}

                <div style={{ flex: 1, minHeight: 10 }} />
                <PrimaryButton disabled={empresas.length === 0} onClick={() => setStep("porte")}>
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
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <p style={{ fontFamily: DISPLAY_FONT, fontSize: 20, fontWeight: 700, color: NAVY, margin: "6px 0 4px" }}>Quais suas maiores dores hoje?</p>
                <p style={{ fontSize: 12.5, color: MUTED, margin: "0 0 4px" }}>Escolha até {MAX_DORES} áreas que mais preocupam agora.</p>
                <p style={{ fontSize: 11, color: dores.length === MAX_DORES ? CORAL : "#9AA3B5", margin: "0 0 14px", fontWeight: 600 }}>
                  {dores.length} de {MAX_DORES} selecionadas
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, overflowY: "auto", maxHeight: 420, paddingRight: 2 }}>
                  {AREAS.map(({ id, label, Icon }) => {
                    const selecionada = dores.includes(id);
                    const bloqueada = !selecionada && dores.length >= MAX_DORES;
                    return (
                      <button key={id} onClick={() => toggleDor(id)} disabled={bloqueada} style={{
                        ...chipStyle(selecionada), display: "flex", flexDirection: "column",
                        alignItems: "flex-start", gap: 6, padding: "12px 10px", height: 66,
                        opacity: bloqueada ? 0.4 : 1, position: "relative",
                      }}>
                        <Icon size={17} color={selecionada ? WHITE : NAVY} />
                        <span style={{ fontSize: 11.5 }}>{label}</span>
                        {selecionada && (
                          <CheckCircle2 size={14} color={WHITE} style={{ position: "absolute", top: 8, right: 8 }} />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div style={{ flex: 1, minHeight: 10 }} />
                <PrimaryButton disabled={dores.length === 0} onClick={() => setStep("checklist")}>
                  Continuar <ArrowRight size={16} />
                </PrimaryButton>
              </div>
            )}

            {step === "checklist" && gruposSelecionados.length > 0 && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <p style={{ fontFamily: DISPLAY_FONT, fontSize: 19, fontWeight: 700, color: NAVY, margin: "6px 0 2px" }}>
                  Checklist — {gruposSelecionados.map((g) => g.label).join(", ")}
                </p>
                <p style={{ fontSize: 11.5, color: MUTED, margin: "0 0 12px" }}>
                  {todasPerguntas.length} perguntas · ajustado para {(empresaPrincipal?.categoria || segmentoPredominante)?.toLowerCase()}
                  {empresas.length > 1 ? " (segmento predominante do grupo)" : ""}
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
                                  <p style={{ fontSize: 12.5, color: NAVY, margin: "0 0 6px", lineHeight: 1.4 }}>{textoDe(q, segmentoPredominante, empresaPrincipal?.categoria)}</p>
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

            {step === "analisando" && empresaPrincipal && areasDoDiagnostico.length > 0 && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 18 }}>
                <Loader2 size={34} color={CORAL} className="spin" />
                <p style={{ fontFamily: DISPLAY_FONT, fontSize: 18, fontWeight: 700, color: NAVY, margin: 0 }}>A IA está analisando</p>
                <p style={{ fontSize: 12.5, color: MUTED, minHeight: 18, margin: 0, padding: "0 10px" }}>
                  {[
                    `Identificando segmento predominante: ${segmentoPredominante}`,
                    `Carregando base de conhecimento: ${areasDoDiagnostico.map(areaLabel).join(", ")}`,
                    "Cruzando respostas de todos os subtemas do checklist",
                    "Estimando carga tributária de referência",
                    "Calculando índice de maturidade por departamento",
                  ][msgIdx]}
                </p>
              </div>
            )}

            {step === "resultado" && empresaPrincipal && areasDoDiagnostico.length > 0 && areaMaisFraca && (
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
                  {empresaPrincipal?.categoria || segmentoPredominante} · {colaboradores} colaboradores · {areasDoDiagnostico.map(areaLabel).join(", ")}
                </p>

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
                      <p style={{ fontFamily: DISPLAY_FONT, fontSize: 32, fontWeight: 700, color: WHITE, margin: "0 0 4px" }}>
                        {aliquota != null ? `${aliquota}%` : "A validar"}
                      </p>
                      <p style={{ fontSize: 12, color: "#C6CEDD", margin: 0 }}>
                        {valorAnualImposto != null
                          ? `≈ ${formatBRL(valorAnualImposto)}/ano em ${regime}, com base no faturamento informado`
                          : "Estimativa indisponível para os dados informados."}
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

                <p style={{ fontSize: 10.5, color: "#9AA3B5", fontStyle: "italic", margin: "0 0 16px", lineHeight: 1.4 }}>
                  Diagnóstico preliminar e educativo, gerado por IA, incluindo a estimativa tributária. Não substitui análise profissional individualizada.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <PrimaryButton onClick={() => showToast("PDF gerado (simulação)")}>
                    <Download size={15} /> Baixar relatório em PDF
                  </PrimaryButton>
                  <PrimaryButton style={{ background: NAVY }} onClick={() => showToast("Solicitação enviada (simulação)")}>
                    <CalendarCheck size={15} /> Agendar com especialista
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
