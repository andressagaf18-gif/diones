// server/diagnostic-consultivo.js
// Finder — análise consultiva INTERNA (somente administração).
//
// Complementa o diagnóstico do cliente sem alterá-lo: para cada caso
// (empresa operacional, holding, SPE, abertura de empresa etc.) define o que
// o consultor precisa enxergar — leitura, hipóteses, perguntas, caminhos com
// prós e contras, recomendação com o porquê, plano detalhado e roteiro de
// reunião. Nada deste conteúdo vai para o cliente.

import { obterMotor, LABELS_EIXOS } from "./diagnostic-engine.js";

export const PILARES_FINDER = [
  "Contabilidade",
  "Business",
  "Finance",
  "Valuation",
  "Fintech",
  "Auditoria",
  "Consulta Societária",
  "Marketing",
  "Technology",
];

// ---------------------------------------------------------
// LIMPEZA DE TEXTO GERADO POR IA
// Remove códigos internos e comentários de bastidor que nunca devem chegar
// ao leitor (ex.: "sugestão vinda do detalhe '...'").
// ---------------------------------------------------------
export function limparCodigoInternoRelatorio(valor) {
  return String(valor || "")
    .replace(/\s*\(\s*resposta\s*:\s*['"][^'"]*['"]\s+para\s+[a-z0-9_:-]+\s*\)/gi, "")
    .replace(/\s*[—-]\s*Id\s*:\s*[a-z0-9_:-]+/gi, "")
    .replace(/\s*[—-]\s*Tipo\s*:\s*[a-z0-9_:-]+/gi, "")
    .replace(/\s*[—-]\s*Ligado\s*A\s*:\s*[a-z0-9_:-]+/gi, "")
    .replace(/\s*[—-]\s*Risco\s*Mitigado\s*:\s*[a-z0-9_:-]+/gi, "")
    .replace(/\s*\([a-z0-9_]+\s*=\s*['"][^'"]*['"]\s*\)/gi, "")
    .replace(/\s*[—-]\s*(?:ref|c[oó]digo|codigo)\s*:\s*[a-z0-9_:-]+/gi, "")
    // comentários de bastidor sobre a origem da informação
    .replace(/\s*\(\s*sugest[ãa]o\s+(?:vinda|oriunda|derivada|extra[ií]da|baseada)\s+(?:d[oa]s?|em)\s+(?:detalhe|resposta|campo|observa[çc][ãa]o)[^)]*\)/gi, "")
    .replace(/\s*\(\s*(?:conforme|segundo|de acordo com|com base n[oa]s?|a partir d[oa]s?)\s+(?:o\s+|a\s+)?(?:detalhe|campo|resposta|pergunta|checklist)\b[^)]*\)/gi, "")
    .replace(/\s*\(\s*(?:detalhe|campo|pergunta)\s*:[^)]*\)/gi, "")
    .replace(/[,;]?\s*sugest[ãa]o\s+(?:vinda|oriunda|derivada|extra[ií]da)\s+d[oa]s?\s+detalhe\s+['"“][^'"”]*['"”](?:\s+sobre\s+[^.;,)]+)?/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

function txt(valor, limite = 600) {
  if (valor === null || valor === undefined) return "";
  const bruto =
    typeof valor === "object"
      ? valor.texto || valor.descricao || valor.titulo || ""
      : String(valor);
  return limparCodigoInternoRelatorio(bruto).slice(0, limite);
}

function lista(v) {
  return Array.isArray(v) ? v : [];
}

function listaTxt(v, max = 8, limite = 400) {
  return lista(v).map((x) => txt(x, limite)).filter(Boolean).slice(0, max);
}

const NIVEIS = ["BAIXO", "MEDIO", "ALTO"];

function nivel(valor) {
  const v = String(valor || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  return NIVEIS.includes(v) ? v : "";
}

// ---------------------------------------------------------
// DIRETRIZES POR CASO
// São pontos de partida para a IA — ela deve adaptar ou descartar o que não
// combinar com as respostas. Nunca são afirmações sobre o cliente.
// ---------------------------------------------------------
const PADRAO = {
  tese: "o ponto central que explica a situação do cliente e o que destrava as demais frentes",
  perguntasChave: [
    "O que mudaria no seu resultado se este ponto estivesse resolvido?",
    "Quem decide e acompanha este assunto hoje?",
  ],
  alternativas: [
    "Organizar internamente com rotina e ferramentas simples",
    "Acompanhamento pontual de um especialista",
    "Terceirizar a rotina da área",
  ],
  documentos: ["Demonstrativos e controles recentes da área", "Contratos relevantes"],
  objecoes: [
    { objecao: "Já tenho contador", direcao: "separar obrigação fiscal de gestão e análise" },
    { objecao: "Está caro", direcao: "comparar com o custo do problema, sem prometer economia" },
    { objecao: "Vou pensar", direcao: "propor um primeiro passo pequeno e datado" },
  ],
  servicos: PILARES_FINDER,
  planoEnfase: "primeiro visibilidade e controle, depois correção e só então expansão",
  cuidados: ["Não transformar ausência de dado em conclusão"],
};

export const DIRETRIZES_CONSULTIVAS = {
  operacional: {
    tese: "onde a operação perde dinheiro, tempo ou controle e qual área, uma vez resolvida, destrava as demais",
    perguntasChave: [
      "Quanto sobra no fim do mês e como isso é medido?",
      "Quem decide preço e com base em quê?",
      "Qual rotina depende de uma única pessoa?",
    ],
    alternativas: [
      "Organizar internamente com rotina semanal e ferramentas simples",
      "Acompanhamento pontual da área prioritária",
      "Terceirizar a rotina da área (ex.: financeiro, fiscal, folha)",
    ],
    documentos: ["DRE ou balancete recente", "Extratos bancários dos últimos 3 meses", "Apuração de impostos dos últimos 12 meses", "Organograma e folha", "Contratos relevantes"],
    objecoes: PADRAO.objecoes,
    servicos: ["Contabilidade", "Finance", "Business", "Marketing", "Technology", "Auditoria"],
    planoEnfase: "visibilidade e controle das áreas prioritárias, depois correções, depois rotina de acompanhamento",
    cuidados: ["Analisar somente os departamentos do escopo", "Não inferir faturamento ou margem sem dado estruturado"],
  },

  abertura_empresa: {
    tese: "se o negócio está pronto para abrir e o que precisa estar resolvido antes (atividade e CNAE, tipo societário, regime, licenças e capital)",
    perguntasChave: [
      "Qual atividade será exercida no primeiro dia de operação?",
      "Há sócios, e quem responde pelo quê?",
      "Qual é o faturamento mensal projetado para os primeiros 12 meses?",
      "O local escolhido permite a atividade pretendida?",
    ],
    alternativas: [
      "Abrir como MEI, empresário individual ou sociedade limitada — avaliar conforme atividade, sócios e faturamento projetado",
      "Abrir já com as licenças mínimas ou aguardar licenças específicas da atividade",
      "Definir primeiro a atividade e o local, depois o regime tributário",
    ],
    documentos: ["Documentos pessoais dos sócios", "Endereço pretendido e comprovação de uso permitido", "Descrição detalhada da atividade", "Estimativa de faturamento e custos"],
    objecoes: [
      { objecao: "Quero abrir logo e depois vejo o resto", direcao: "mostrar o custo de abrir no enquadramento errado" },
      { objecao: "Posso fazer sozinho pelo portal", direcao: "separar o registro do planejamento de regime, licenças e obrigações" },
    ],
    servicos: ["Contabilidade", "Consulta Societária", "Business", "Finance"],
    planoEnfase: "decidir atividade, CNAE e estrutura; depois licenças e documentos; depois registro e primeiras obrigações",
    cuidados: ["Não afirmar CNAE, regime ou tipo societário como definitivos", "Licenças são itens a verificar no órgão competente", "Não presumir faturamento nem histórico"],
  },

  holding: {
    tese: "se a estrutura atual cumpre o objetivo (proteção, sucessão, organização, tributação) e quanto custa mantê-la",
    perguntasChave: [
      "Qual era o objetivo original ao criar a holding e ele foi atingido?",
      "Quais bens estão dentro e fora da estrutura?",
      "Existe acordo entre sócios ou herdeiros por escrito?",
    ],
    alternativas: [
      "Manter a estrutura e ajustar governança e documentos (contrato/estatuto, acordo entre sócios)",
      "Reorganizar participações ou imóveis na estrutura, após análise tributária e jurídica",
      "Revisar a política de distribuição e retirada",
      "Adotar instrumento sucessório complementar (a validar com assessoria jurídica)",
    ],
    documentos: ["Contrato ou estatuto social e alterações", "Matrículas atualizadas dos imóveis", "Declaração de IRPF dos sócios", "Balanço ou escrituração da holding", "Acordos entre sócios e documentos sucessórios, se houver"],
    objecoes: [
      { objecao: "Já fizemos a holding com outro escritório", direcao: "propor revisão do que foi feito, sem criticar o anterior" },
      { objecao: "Isso é assunto para advogado", direcao: "mostrar a parte contábil e tributária e a coordenação com o jurídico" },
    ],
    servicos: ["Consulta Societária", "Contabilidade", "Valuation", "Business"],
    planoEnfase: "diagnóstico documental, depois ajustes de governança, depois decisões patrimoniais com assessoria jurídica",
    cuidados: ["Não presumir que holding reduz tributos", "Sucessão, ITCMD e integralização dependem de legislação e documentos: tratar como ponto a validar", "Não tratar como empresa operacional"],
  },

  avaliar_holding: {
    tese: "se uma holding faz sentido para o objetivo declarado — sem decidir pelo cliente",
    perguntasChave: [
      "O que o cliente quer proteger ou resolver, em ordem de importância?",
      "Quais imóveis e participações entrariam na estrutura?",
      "Há herdeiros ou sócios que precisam ser consultados?",
    ],
    alternativas: [
      "Não criar a holding agora e ajustar o que já existe",
      "Holding patrimonial, se os dados sustentarem",
      "Holding mista, se houver atividade operacional associada",
      "Outras formas de planejamento sucessório (a avaliar com assessoria jurídica)",
    ],
    documentos: ["Matrículas dos imóveis", "Declaração de IRPF", "Participações societárias atuais", "Composição familiar e objetivos de sucessão"],
    objecoes: [
      { objecao: "Me disseram que holding sempre compensa", direcao: "mostrar fatores a favor e contra, com custos recorrentes" },
      { objecao: "Quero decidir só depois", direcao: "listar quais dados faltam para decidir bem" },
    ],
    servicos: ["Consulta Societária", "Contabilidade", "Valuation"],
    planoEnfase: "levantar dados faltantes, comparar alternativas com custos reais e só então decidir",
    cuidados: ["Não recomendar sem dados suficientes", "Não prometer economia tributária", "Apresentar fatores favoráveis e contrários", "Incluir custos de manutenção e riscos de integralização"],
  },

  grupo: {
    tese: "se o grupo funciona como um sistema organizado ou como CNPJs soltos, e onde há risco de confusão patrimonial e carga desnecessária",
    perguntasChave: [
      "Qual é a função de cada CNPJ no grupo?",
      "Quais operações acontecem entre as empresas e como são documentadas?",
      "Quem decide a distribuição de resultados?",
    ],
    alternativas: [
      "Documentar e formalizar as operações entre as empresas do grupo",
      "Centralizar rotinas (centro de serviços) sem mexer na estrutura societária",
      "Reorganizar funções entre CNPJs, após análise tributária e jurídica",
    ],
    documentos: ["Organograma societário", "Balancetes por empresa", "Contratos de mútuo, rateio e locação entre empresas", "Regime tributário de cada CNPJ"],
    objecoes: [
      { objecao: "Sempre funcionou assim", direcao: "mostrar o risco de operar sem formalização, sem alarmismo" },
      { objecao: "Cada empresa tem seu contador", direcao: "propor visão consolidada" },
    ],
    servicos: ["Contabilidade", "Consulta Societária", "Auditoria", "Finance"],
    planoEnfase: "mapear o grupo, formalizar as operações e só depois otimizar",
    cuidados: ["Operações entre partes relacionadas exigem contrato e preço de mercado: tratar como ponto a validar", "Não afirmar grupo econômico, fraude ou confusão patrimonial como fato"],
  },

  spe: {
    tese: "se o projeto está estruturado (capital, governança e contratos) para chegar ao fim e distribuir resultado",
    perguntasChave: [
      "Qual é o prazo e o marco final do projeto?",
      "Como e quando entram os aportes de cada sócio?",
      "Quais contratos sustentam as receitas e os custos?",
    ],
    alternativas: [
      "Ajustar governança e contratos antes dos próximos aportes",
      "Revisar a estrutura de capital e o cronograma de aportes",
      "Planejar desde já o tratamento tributário e o encerramento",
    ],
    documentos: ["Contrato social ou acordo de sócios", "Cronograma físico-financeiro", "Contratos principais (obra, financiamento, venda)", "Orçamento e fluxo do projeto"],
    objecoes: [
      { objecao: "O projeto ainda está no começo", direcao: "mostrar o que é mais barato resolver agora" },
      { objecao: "Os sócios não querem burocracia", direcao: "propor regras mínimas e claras" },
    ],
    servicos: ["Consulta Societária", "Contabilidade", "Finance", "Auditoria"],
    planoEnfase: "governança e contratos, depois controle financeiro do projeto, depois regras de distribuição e encerramento",
    cuidados: ["Tratamento tributário depende de regime e atividade: validar", "Não prometer retorno aos investidores"],
  },

  terceiro_setor: {
    tese: "se a entidade cumpre os requisitos que sustentam seus benefícios e se governança e prestação de contas estão em dia",
    perguntasChave: [
      "Quais são as fontes de receita e como cada uma é registrada?",
      "As atas e a prestação de contas estão atualizadas?",
      "Quais certificações ou benefícios a entidade mantém?",
    ],
    alternativas: [
      "Regularizar governança, atas e estatuto",
      "Estruturar prestação de contas e controle por projeto ou fonte de recurso",
      "Revisar enquadramento e certificações aplicáveis (a validar)",
    ],
    documentos: ["Estatuto e atas", "Balanço e demonstrações", "Convênios e termos de fomento", "Certidões e certificações vigentes"],
    objecoes: [
      { objecao: "Somos sem fins lucrativos, não pagamos nada", direcao: "explicar obrigações e requisitos sem assustar" },
      { objecao: "Não temos orçamento", direcao: "priorizar o que protege os benefícios" },
    ],
    servicos: ["Contabilidade", "Consulta Societária", "Auditoria", "Finance"],
    planoEnfase: "regularizar governança e documentos, depois prestação de contas, depois revisão de benefícios",
    cuidados: ["Não presumir imunidade ou isenção", "Diferenciar mensalidades, doações, convênios, subvenções, patrocínios e receitas próprias", "Não avaliar como empresa comercial"],
  },

  pessoa_fisica: {
    tese: "qual é a situação financeira real da pessoa e qual o primeiro movimento que traz tranquilidade",
    perguntasChave: [
      "Para onde vai o dinheiro no mês?",
      "Existe alguma dívida que pese mais que as outras?",
      "O que seria uma conquista nos próximos 90 dias?",
    ],
    alternativas: [
      "Organizar orçamento e fluxo mensal",
      "Priorizar ou renegociar dívidas",
      "Construir reserva antes de investir",
      "Revisar o IRPF e o planejamento de longo prazo",
    ],
    documentos: ["Extratos e faturas dos últimos 3 meses", "Lista de dívidas", "Última declaração de IRPF"],
    objecoes: [
      { objecao: "Não tenho dinheiro para isso", direcao: "mostrar o menor primeiro passo possível" },
      { objecao: "Já tenho meu jeito de me organizar", direcao: "respeitar e oferecer apoio, sem pressão" },
    ],
    servicos: ["Finance", "Contabilidade"],
    planoEnfase: "clareza do orçamento, depois reserva e dívidas, depois objetivos de longo prazo",
    cuidados: ["Tom acolhedor e sem pressão comercial", "Não recomendar produtos financeiros específicos", "Não julgar hábitos", "Nunca cobrar CNAE, faturamento ou estrutura societária"],
  },

  reforma_tributaria: {
    tese: "como a transição de CBS e IBS afeta preço, margem e créditos deste negócio e o que preparar primeiro",
    perguntasChave: [
      "Quem são os clientes: empresas (B2B) ou consumidor final (B2C)?",
      "Quanto do custo vem de fornecedores que gerarão crédito?",
      "Como o preço de venda é formado hoje?",
    ],
    alternativas: [
      "Preparar cadastros, notas e a cadeia de créditos",
      "Revisar a precificação para a transição",
      "Avaliar a opção dentro do regime atual (inclusive Simples por dentro ou por fora, quando aplicável) — a validar",
    ],
    documentos: ["Apurações ou PGDAS/DEFIS", "Notas de compra e de venda", "Perfil de clientes B2B e B2C", "Contratos de longo prazo"],
    objecoes: [
      { objecao: "A reforma ainda vai mudar", direcao: "mostrar o que já pode ser preparado e o que depende de regulamentação" },
      { objecao: "Meu contador cuida disso", direcao: "propor análise conjunta de preço e margem" },
    ],
    servicos: ["Contabilidade", "Business", "Technology"],
    planoEnfase: "dados e cadastros, depois créditos e preços, depois decisão de regime e transição",
    cuidados: ["Alíquotas futuras são estimativas, nunca definitivas", "Não afirmar economia: comparações são matemáticas e preliminares", "Considerar DAS residual no Simples"],
  },
};

export function diretrizDoCaso(estrutura) {
  const motor = obterMotor(estrutura);
  return { ...PADRAO, ...(DIRETRIZES_CONSULTIVAS[motor.id] || {}) };
}

function eixosDoEscopo(estrutura, eixosPermitidos) {
  const motor = obterMotor(estrutura);
  return Array.isArray(eixosPermitidos) && eixosPermitidos.length
    ? motor.eixos.filter((id) => eixosPermitidos.includes(id))
    : motor.eixos;
}

// ---------------------------------------------------------
// CONTRATO DE SAÍDA
// ---------------------------------------------------------
export function contratoConsultivo(estrutura, eixosPermitidos = null) {
  const motor = obterMotor(estrutura);
  const eixos = eixosDoEscopo(estrutura, eixosPermitidos);

  return {
    estrutura: motor.id,
    estruturaLabel: motor.label,
    teseCentral: "",
    fatosInformados: [""],
    hipotesesGerais: [""],
    areas: eixos.map((id) => ({
      eixoId: id,
      label: LABELS_EIXOS[id] || id,
      profundidade: "COMPLETA | RESUMIDA",
      leituraConsultor: "",
      hipoteses: [{ hipotese: "", comoValidar: "" }],
      perguntasReuniao: [""],
      caminhos: [{ id: "A", titulo: "", descricao: "", esforco: "BAIXO | MEDIO | ALTO", impacto: "BAIXO | MEDIO | ALTO", recomendado: false }],
      recomendacaoPrincipal: { caminhoId: "A", porque: "", dependencias: [""], servicoFinder: "" },
      naoAssumir: [""],
      evidencias: [""],
    })),
    planoDetalhado: [
      {
        prazo: "30 | 60 | 90",
        areaId: "",
        objetivo: "",
        acao: "",
        evidenciaEsperada: "",
        dependencia: "",
        responsavelSugerido: "",
        indicadorSucesso: "",
        esforco: "BAIXO | MEDIO | ALTO",
        impacto: "BAIXO | MEDIO | ALTO",
        servicoFinder: "",
      },
    ],
    roteiroReuniao: {
      abertura: "",
      documentosPedir: [""],
      objecoesProvaveis: [{ objecao: "", resposta: "" }],
    },
  };
}

// ---------------------------------------------------------
// INSTRUÇÕES PARA A IA
// ---------------------------------------------------------
export function instrucoesConsultivas(estrutura, eixosPermitidos = null) {
  const motor = obterMotor(estrutura);
  const d = diretrizDoCaso(estrutura);
  const eixos = eixosDoEscopo(estrutura, eixosPermitidos);
  const bullets = (arr) => arr.map((x) => `- ${x}`).join("\n");

  return `ANÁLISE CONSULTIVA INTERNA — somente para a administração da Finder; NUNCA vai ao cliente.
CASO: ${motor.label}
ÁREAS EM ESCOPO: ${eixos.join(", ")}

TESE-GUIA (o que a "teseCentral" deve esclarecer): ${d.tese}

ALTERNATIVAS TÍPICAS DESTE CASO (ponto de partida; adapte, combine ou descarte conforme as respostas):
${bullets(d.alternativas)}

PERGUNTAS-GUIA (exemplos de direção; formule as suas a partir das respostas):
${bullets(d.perguntasChave)}

DOCUMENTOS TÍPICOS A PEDIR:
${bullets(d.documentos)}

OBJEÇÕES TÍPICAS E DIREÇÃO DA RESPOSTA:
${bullets(d.objecoes.map((o) => `${o.objecao} → ${o.direcao}`))}

PILARES DE SERVIÇO DA FINDER (use apenas estes nomes em "servicoFinder"): ${(d.servicos || PILARES_FINDER).join(", ")}

ÊNFASE DO PLANO 30/60/90 NESTE CASO: ${d.planoEnfase}

CUIDADOS ESPECÍFICOS DESTE CASO (valem como "o que não assumir"):
${bullets(d.cuidados)}

REGRAS DA ANÁLISE CONSULTIVA:
1. Escreva em português do Brasil, para um consultor experiente, de forma direta e útil. Aqui NÃO é o relatório do cliente: pode e deve ser mais franco, mas nunca afirme fatos que as respostas não sustentam.
2. Separe rigorosamente FATO (o que o cliente informou), HIPÓTESE (o que você infere e precisa validar) e LACUNA. Em "fatosInformados" só entra o que consta nas respostas; em "hipotesesGerais" só inferências.
3. Aprofunde no máximo 4 áreas — as de maior prioridade (menor score, maior risco ou maior dor declarada) — marcando "profundidade": "COMPLETA". As demais ficam "RESUMIDA", com apenas "leituraConsultor" de 1 a 2 frases e as outras listas vazias.
4. Nas áreas COMPLETAS: "leituraConsultor" com 3 a 5 frases explicando o que acontece e por que importa; até 3 hipóteses com "comoValidar" concreto; até 4 perguntas para a reunião, todas terminando em "?"; de 2 a 3 caminhos possíveis com esforço e impacto (BAIXO, MEDIO ou ALTO) e prós e contras na descrição; EXATAMENTE um caminho com "recomendado": true, e "recomendacaoPrincipal.porque" explicando a escolha e as dependências.
5. "naoAssumir" lista o que NÃO deve ser concluído ainda e por quê. "evidencias" cita as respostas que sustentam a leitura, em linguagem natural — sem códigos, IDs ou nomes de variáveis.
6. "planoDetalhado": de 6 a 15 ações distribuídas em prazo 30, 60 e 90. Cada ação traz objetivo, ação, evidência esperada, dependência, responsável sugerido ("Cliente", "Finder" ou "Cliente + Finder"), indicador de sucesso, esforço, impacto e, quando fizer sentido, o pilar de serviço Finder. Não prometa resultado nem prazo definitivo.
7. "roteiroReuniao": como abrir a conversa, quais documentos pedir e até 4 objeções prováveis com a direção da resposta, adaptadas a este cliente.
8. NUNCA invente números. Valores só podem vir de campos estruturados informados pelo cliente. Sem base, escreva que não é possível calcular.
9. NUNCA cite códigos internos, IDs de perguntas ou frases do tipo "sugestão vinda do detalhe". Escreva como consultor: "o cliente informou que...", "a resposta sobre X indica que...".
10. Não dê certeza jurídica ou tributária quando depender de documentos; apresente como ponto a validar. Não prescreva produtos financeiros específicos.
11. Não repita o mesmo texto entre campos. Cada campo tem uma função distinta.
12. Respeite os cuidados específicos acima e as proibições do caso (${(motor.proibicoes || []).join("; ") || "nenhuma adicional"}).
13. Retorne SOMENTE JSON válido, exatamente no formato do CONTRATO, sem comentários. Remova os valores de exemplo (como "COMPLETA | RESUMIDA") e use os valores reais.`;
}

// ---------------------------------------------------------
// NORMALIZAÇÃO DEFENSIVA
// A IA pode devolver estrutura incompleta, tipos errados ou exageros.
// Nada daqui pode quebrar a tela.
// ---------------------------------------------------------
const LETRAS = ["A", "B", "C"];

function normalizarCaminhos(valor) {
  return lista(valor)
    .map((c, i) => ({
      id: LETRAS.includes(String(c?.id || "").toUpperCase()) ? String(c.id).toUpperCase() : LETRAS[i] || "C",
      titulo: txt(c?.titulo, 160),
      descricao: txt(c?.descricao, 700),
      esforco: nivel(c?.esforco),
      impacto: nivel(c?.impacto),
      recomendado: c?.recomendado === true,
    }))
    .filter((c) => c.titulo || c.descricao)
    .slice(0, 3);
}

function normalizarArea(base, achada) {
  const a = achada && typeof achada === "object" ? achada : {};
  const caminhos = normalizarCaminhos(a.caminhos);

  const rec = a.recomendacaoPrincipal && typeof a.recomendacaoPrincipal === "object" ? a.recomendacaoPrincipal : {};
  let caminhoRecomendado = String(rec.caminhoId || "").toUpperCase();
  if (!caminhos.some((c) => c.id === caminhoRecomendado)) {
    caminhoRecomendado = caminhos.find((c) => c.recomendado)?.id || "";
  }
  // no máximo um caminho recomendado
  const marcados = caminhos.map((c) => ({ ...c, recomendado: Boolean(caminhoRecomendado) && c.id === caminhoRecomendado }));

  const hipoteses = lista(a.hipoteses)
    .map((h) => (typeof h === "string" ? { hipotese: txt(h, 400), comoValidar: "" } : { hipotese: txt(h?.hipotese, 400), comoValidar: txt(h?.comoValidar, 400) }))
    .filter((h) => h.hipotese)
    .slice(0, 3);

  const leitura = txt(a.leituraConsultor, 1400);
  const temAprofundamento = hipoteses.length || marcados.length || listaTxt(a.perguntasReuniao).length;
  const declarada = String(a.profundidade || "").toUpperCase();
  const profundidade = declarada.startsWith("COMPLETA") && temAprofundamento ? "COMPLETA" : temAprofundamento && !declarada ? "COMPLETA" : "RESUMIDA";

  const area = {
    eixoId: base.eixoId,
    label: base.label,
    profundidade,
    leituraConsultor: leitura,
    hipoteses,
    perguntasReuniao: listaTxt(a.perguntasReuniao, 4, 300),
    caminhos: marcados,
    recomendacaoPrincipal: {
      caminhoId: caminhoRecomendado,
      porque: txt(rec.porque, 800),
      dependencias: listaTxt(rec.dependencias, 4, 250),
      servicoFinder: txt(rec.servicoFinder, 120),
    },
    naoAssumir: listaTxt(a.naoAssumir, 4, 300),
    evidencias: listaTxt(a.evidencias, 6, 250),
  };

  area.semConteudo = !area.leituraConsultor && !hipoteses.length && !marcados.length && !area.naoAssumir.length;
  return area;
}

export function prazoNormalizado(valor) {
  const m = String(valor ?? "").match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n <= 45 ? 30 : n <= 75 ? 60 : 90;
}

function normalizarPlano(valor, idsValidos) {
  const itens = lista(valor)
    .map((p) => {
      const prazo = prazoNormalizado(p?.prazo);
      const areaId = String(p?.areaId || "").trim();
      return {
        prazo,
        areaId: idsValidos.includes(areaId) ? areaId : "",
        objetivo: txt(p?.objetivo, 300),
        acao: txt(p?.acao, 500),
        evidenciaEsperada: txt(p?.evidenciaEsperada, 300),
        dependencia: txt(p?.dependencia, 300),
        responsavelSugerido: txt(p?.responsavelSugerido, 80),
        indicadorSucesso: txt(p?.indicadorSucesso, 250),
        esforco: nivel(p?.esforco),
        impacto: nivel(p?.impacto),
        servicoFinder: txt(p?.servicoFinder, 120),
      };
    })
    .filter((p) => p.prazo && (p.acao || p.objetivo));

  const porPrazo = { 30: [], 60: [], 90: [] };
  for (const p of itens) if (porPrazo[p.prazo].length < 6) porPrazo[p.prazo].push(p);
  return [...porPrazo[30], ...porPrazo[60], ...porPrazo[90]];
}

export function normalizarVisaoConsultiva(ia, estrutura, eixosPermitidos = null) {
  const bruto = ia && typeof ia === "object" && !Array.isArray(ia) ? ia : {};
  const base = contratoConsultivo(estrutura, eixosPermitidos);
  const ids = base.areas.map((a) => a.eixoId);
  const achadas = lista(bruto.areas);

  const areas = base.areas.map((b) => {
    const achada = achadas.find((x) => String(x?.eixoId || x?.id || "").trim().toLowerCase() === b.eixoId.toLowerCase());
    return normalizarArea(b, achada);
  });

  const roteiro = bruto.roteiroReuniao && typeof bruto.roteiroReuniao === "object" ? bruto.roteiroReuniao : {};

  return {
    estrutura: base.estrutura,
    estruturaLabel: base.estruturaLabel,
    teseCentral: txt(bruto.teseCentral, 1000),
    fatosInformados: listaTxt(bruto.fatosInformados, 8, 320),
    hipotesesGerais: listaTxt(bruto.hipotesesGerais, 6, 320),
    areas,
    planoDetalhado: normalizarPlano(bruto.planoDetalhado, ids),
    roteiroReuniao: {
      abertura: txt(roteiro.abertura, 700),
      documentosPedir: listaTxt(roteiro.documentosPedir, 8, 200),
      objecoesProvaveis: lista(roteiro.objecoesProvaveis)
        .map((o) => ({ objecao: txt(o?.objecao, 200), resposta: txt(o?.resposta, 400) }))
        .filter((o) => o.objecao)
        .slice(0, 4),
    },
  };
}

// Mínimo para considerar a resposta da IA utilizável.
export function visaoConsultivaUtil(visao) {
  if (!visao) return false;
  return Boolean(
    visao.teseCentral ||
      visao.planoDetalhado?.length ||
      visao.areas?.some((a) => !a.semConteudo)
  );
}
