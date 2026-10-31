// server/reforma-radar.js — Radar da Reforma Tributária (painel do Admin).
// Cada item tem status, base legal, próximo passo, impacto no sistema e, obrigatoriamente, FONTES com link.
// Rotas (via api/tributario.js): reforma-radar, reforma-radar-salvar, reforma-radar-verificar,
// reforma-radar-arquivar, reforma-radar-pesquisar. Leitura: qualquer usuário logado; escrita: perfil ADMIN.
import { neon } from "@neondatabase/serverless";
import crypto from "node:crypto";
import { usuarioAutenticado } from "./auth.js";

const sql = neon(process.env.DATABASE_URL);
const enviar = (res, status, corpo) => res.status(status).json(corpo);
const texto = (v, n = 600) => String(v ?? "").trim().slice(0, n);
// Data de hoje no fuso de Brasília (o servidor roda em UTC: após 21h o "hoje" UTC já seria amanhã).
const hojeBrasilia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export const STATUS_RADAR = {
  vigente: "Aprovado e em vigor",
  aprovado: "Aprovado — efeitos futuros",
  tramitacao: "Em tramitação",
  solicitado: "Solicitado / aguardando envio",
  prazo: "Prazo em curso",
};
const PESO = { prazo: 0, tramitacao: 1, solicitado: 2, aprovado: 3, vigente: 4 };

// Domínios aceitos como fonte. "oficial" = poder público; "especializada" = imprensa/entidade técnica (apoio, nunca única para norma).
const DOMINIOS_OFICIAIS = ["planalto.gov.br", "senado.leg.br", "camara.leg.br", "gov.br", "tcu.gov.br", "cgibs.gov.br", "confaz.fazenda.gov.br", "ebc.com.br", "stf.jus.br", "jus.br", "leg.br", "fazenda.gov.br"];
export function classificarFonte(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\d*\./, "");
    return DOMINIOS_OFICIAIS.some((d) => h === d || h.endsWith(`.${d}`)) ? "oficial" : "especializada";
  } catch { return ""; }
}
function limparFontes(fontes) {
  const out = [];
  for (const f of Array.isArray(fontes) ? fontes : []) {
    const url = texto(f?.url, 500);
    if (!/^https:\/\//i.test(url)) continue;
    out.push({ titulo: texto(f?.titulo, 200) || url, url, tipo: classificarFonte(url), acessadoEm: texto(f?.acessadoEm, 10) || "", lida: f?.lida !== false });
  }
  return out.slice(0, 8);
}

const F = {
  senadoCbs: { titulo: "Senado Notícias — Alíquota da CBS avança nesta semana (26/10/2026)", url: "https://www12.senado.leg.br/noticias/materias/2026/10/26/reforma-tributaria-aliquota-da-cbs-avanca-nesta-semana", acessadoEm: "2026-10-28" },
  senado2026: { titulo: "Senado Notícias — Ano de 2026 marca implementação da reforma tributária (02/01/2026)", url: "https://www12.senado.leg.br/noticias/materias/2026/01/02/ano-de-2026-marca-implementacao-da-reforma-tributaria", acessadoEm: "2026-10-28" },
  agBrasil: { titulo: "Agência Brasil — TCU aprova cálculo da alíquota de referência da CBS em 11,3%", url: "https://agenciabrasil.ebc.com.br/economia/noticia/2026-10/tcu-aprova-calculo-da-aliquota-de-referencia-da-cbs-em-113", acessadoEm: "2026-10-28" },
  conjur: { titulo: "ConJur — TCU propõe alíquota de referência da CBS em 11,3% para 2027 (28/10/2026)", url: "https://conjur.com.br/2026-out-28/tcu-propoe-aliquota-de-referencia-da-cbs-em-113-para-2027/", acessadoEm: "2026-10-28" },
  ec132: { titulo: "Planalto — Emenda Constitucional nº 132/2023", url: "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc132.htm", lida: false },
  lc214: { titulo: "Planalto — Lei Complementar nº 214/2025", url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm", lida: false },
  lc227: { titulo: "Planalto — Lei Complementar nº 227/2026", url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp227.htm", lida: false },
  dec12955: { titulo: "Planalto — Decreto nº 12.955/2026 (regulamento da CBS)", url: "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/D12955.htm", lida: false },
  cescon: { titulo: "Cescon Barrieu — Sancionada a Lei Complementar 227/2026", url: "https://cesconbarrieu.com.br/reforma-tributaria-sancionada-a-lei-complementar-227-2026/", acessadoEm: "2026-10-28" },
  regulamento: { titulo: "Contábeis — IBS e CBS: nova versão do regulamento pode sair até outubro", url: "https://www.contabeis.com.br/noticias/78722/ibs-e-cbs-nova-versao-do-regulamento-pode-sair-ate-outubro/", acessadoEm: "2026-10-28" },
  fiemg: { titulo: "FIEMG — Informe: Regulamentos do IBS e da CBS (05/2026)", url: "https://www.fiemg.com.br/wp-content/uploads/2026/05/IE-32-Regulamentos-IBS-e-CBS.pdf", acessadoEm: "2026-10-28" },
  cgsn: { titulo: "Legisweb — CGSN altera prazos de opção (Resolução CGSN nº 194/2026)", url: "https://www.legisweb.com.br/noticia/?id=34449", acessadoEm: "2026-10-28" },
  is: { titulo: "TAGD Law — Governo adia envio das alíquotas do Imposto Seletivo (13/10/2026)", url: "https://tagdlaw.com.br/?p=16333", acessadoEm: "2026-10-28" },
  plp124: { titulo: "Reforma Tributária (portal) — Câmara aprova teto a multas (PLP 124/2022)", url: "https://www.reformatributaria.com/congresso/camara-altera-normas-sobre-impasses-tributarios-administrativos-e-estabelece-teto-a-multas/", acessadoEm: "2026-10-28" },
};

export const SEED = [
  { slug: "ec-132-2023", titulo: "Emenda Constitucional 132/2023 — reforma tributária do consumo", status: "vigente", orgao: "Congresso Nacional", baseLegal: "EC 132/2023 (ADCT — regras de transição)",
    resumo: "Cria o IBS (estados e municípios), a CBS (União) e o Imposto Seletivo, e extingue PIS, Cofins, IPI, ICMS e ISS ao longo da transição.",
    dataEvento: "2023-12-20", proximoPasso: "Nada pendente: norma em vigor. As regras de detalhe estão na LC 214/2025 e na LC 227/2026.", impactoSistema: "Base legal do cronograma 2026–2033 exibido no simulador e nos relatórios.", fontes: [F.ec132, F.senado2026] },
  { slug: "lc-214-2025", titulo: "Lei Complementar 214/2025 — regulamenta IBS, CBS e Imposto Seletivo", status: "vigente", orgao: "Congresso Nacional / Presidência", baseLegal: "LC 214, de 16/01/2025",
    resumo: "Regras gerais do IBS, da CBS e do IS: fato gerador, base de cálculo, créditos, regimes específicos e reduções. A CBS passa a ser cobrada em 2027 e o IBS plenamente em 2029.",
    dataEvento: "2025-01-16", proximoPasso: "Em vigor; vem sendo alterada pela LC 227/2026 e detalhada por regulamentos.", impactoSistema: "Reduções setoriais (ex.: art. 127 — profissões regulamentadas) e transição usadas no simulador e na pesquisa tributária.", fontes: [F.lc214, F.senado2026] },
  { slug: "lc-227-2026", titulo: "Lei Complementar 227/2026 — Comitê Gestor do IBS e ajustes na LC 214", status: "vigente", orgao: "Congresso Nacional / Presidência", baseLegal: "LC 227/2026 (origem: PLP 108/2024), publicada em 14/01/2026",
    resumo: "Regulamenta o Comitê Gestor do IBS e o contencioso (Câmara Nacional de Integração), disciplina saldos credores de ICMS, cria normas gerais do ITCMD, prevê split payment simplificado para qualquer contribuinte e altera a LC 123/2006 (Simples) com efeitos a partir de 01/01/2027. Inclui o Imposto Seletivo na base do ICMS a partir de 01/01/2027.",
    dataEvento: "2026-01-14", proximaData: "", proximoPasso: "Atos infralegais do CGIBS e da União pendentes (fiscalização, cobrança, repartição, lista de medicamentos com alíquota zero). Vetos presidenciais aguardam apreciação do Congresso — conferir andamento.", impactoSistema: "Regras do Simples e split payment citados nas análises; revisar quando os atos infralegais saírem.", revisar: true, fontes: [F.lc227, F.cescon] },
  { slug: "fase-teste-2026", titulo: "2026 — fase de teste (CBS 0,9% e IBS 0,1%)", status: "vigente", orgao: "Receita Federal / CGIBS", baseLegal: "LC 214/2025 (transição 2026); Ato Conjunto RFB/CGIBS nº 1/2025 (obrigações acessórias)",
    resumo: "Empresas do regime regular destacam CBS e IBS nas notas, sem recolhimento. Para optantes do Simples o destaque é opcional em 2026. Em 09/10/2026 quase nove em cada dez documentos fiscais já registravam a CBS.",
    dataEvento: "2026-01-01", proximoPasso: "Encerra em 31/12/2026; em 2027 a CBS passa a ser cobrada.", impactoSistema: "Cenário 2026 do simulador (0,9% + 0,1%) e textos para MEI/Simples.", fontes: [F.senado2026, F.senadoCbs] },
  { slug: "regulamentos-2026", titulo: "Regulamentos publicados em 30/04/2026 (CBS, IBS e disposições comuns)", status: "vigente", orgao: "Receita Federal / Comitê Gestor do IBS", baseLegal: "Decreto 12.955/2026 (CBS); Resolução CGIBS 6/2026 (IBS); Portaria Conjunta MF/CGIBS 7/2026; Ato Conjunto RFB/CGIBS 4/2026 (30/07/2026 — cronograma dos documentos fiscais)",
    resumo: "Regulamentos iniciais da CBS e do IBS, com conceitos, identificação de fornecedores e adquirentes e regras de crédito. O Ato Conjunto 4/2026 fixa o cronograma de implementação dos documentos fiscais eletrônicos.",
    dataEvento: "2026-04-30", proximoPasso: "Nova versão dos regulamentos prevista (ver item próprio). Até lá, os textos atuais continuam valendo.", impactoSistema: "Orientações de ERP, NF-e e NFS-e nos relatórios.", fontes: [F.dec12955, F.regulamento, F.fiemg] },
  { slug: "penalidades-acessorias", titulo: "Penalidades das obrigações acessórias do IBS/CBS", status: "vigente", orgao: "Receita Federal / CGIBS", baseLegal: "Ato Conjunto RFB/CGIBS nº 1/2025; regulamentos de 30/04/2026",
    resumo: "Não há penalidade até o início do 4º mês após a publicação dos regulamentos; as multas por descumprimento das obrigações acessórias passam a valer a partir de agosto de 2026. Optantes do Simples têm dispensa legal do destaque em 2026.",
    dataEvento: "2026-08-01", proximoPasso: "Conferir se a empresa já emite documentos com IBS/CBS corretos (regime regular).", impactoSistema: "Alerta de preparação do ERP e das notas nos relatórios.", fontes: [F.fiemg, F.senado2026] },
  { slug: "cbs-cobranca-2027", titulo: "CBS passa a ser cobrada em janeiro de 2027 (PIS/Cofins extintos)", status: "aprovado", orgao: "Congresso Nacional", baseLegal: "LC 214/2025; EC 132/2023",
    resumo: "A cobrança efetiva da CBS começa em janeiro de 2027 e substitui PIS e Cofins.",
    dataEvento: "2027-01-01", proximaData: "2027-01-01", proximoPasso: "Alíquota de referência aguarda resolução do Senado (item próprio).", impactoSistema: "Motor de transição do simulador (CBS integral a partir de 2027). O ajuste de −0,1 p.p. em 2027–2028 aplicado pelo motor deve ser conferido na LC 214/2025.", fontes: [F.senadoCbs, F.senado2026] },
  { slug: "cbs-aliquota-2027", titulo: "Alíquota de referência da CBS para 2027 — 11,3468% (11,3%)", status: "tramitacao", orgao: "TCU → Senado Federal", baseLegal: "LC 214/2025 (cálculo pelo TCU e fixação por resolução do Senado); TC 006.529/2026-7",
    resumo: "O TCU aprovou em 28/10/2026 o cálculo: 11,3468%, arredondada para 11,3%, com redutor de 44,16% nas compras públicas. O resultado vai ao Senado, que fixa a alíquota por resolução; o prazo noticiado é 15/12/2026. Estimativas anteriores (9,21%) eram extraoficiais.",
    dataEvento: "2026-10-28", proximaData: "2026-12-15", proximoPasso: "Resolução do Senado fixando a alíquota. Confirmar na norma o que vale se o Senado não deliberar até o prazo (as fontes consultadas não esclarecem).", impactoSistema: "Premissa padrão da CBS no simulador, pesquisa tributária e relatórios = 11,3%.", fontes: [F.agBrasil, F.conjur, F.senadoCbs] },
  { slug: "ibs-aliquota-referencia", titulo: "Alíquota de referência do IBS — a definir (estimativa 18,7%)", status: "tramitacao", orgao: "Comitê Gestor do IBS / Senado", baseLegal: "LC 214/2025; LC 227/2026",
    resumo: "A partir de 2028 o Comitê Gestor do IBS calcula a alíquota de referência. A estimativa de 18,7% (soma 27,91% com a CBS anterior de 9,21%) é extraoficial e deve ser revista após a CBS de 11,3%. O teto de referência para 2033 é de 26,5%, com gatilhos de revisão em 2029, 2030 e 2035.",
    dataEvento: "2026-10-26", proximoPasso: "Aguardar o cálculo do CGIBS (a partir de 2028) e eventual resolução do Senado.", impactoSistema: "IBS segue como premissa estimada (18,7%) e sinalizada como não definitiva.", revisar: true, fontes: [F.senadoCbs] },
  { slug: "regulamentos-nova-versao", titulo: "Nova versão dos regulamentos do IBS e da CBS (contribuições recebidas)", status: "solicitado", orgao: "Receita Federal / Comitê Gestor do IBS", baseLegal: "Decreto 12.955/2026; Resolução CGIBS 6/2026",
    resumo: "Foram recebidas 847 propostas para o regulamento do IBS e mais de 4 mil sugestões para o da CBS. A Receita previu a nova versão 'até outubro de 2026'. Novos atos devem tratar de split payment, documentos fiscais, regimes específicos, ressarcimento e crédito.",
    dataEvento: "2026-08-12", proximaData: "2026-10-31", proximoPasso: "Acompanhar publicação da nova versão e comparar com a atual.", impactoSistema: "Pode alterar regras de crédito e documentos citadas nos relatórios.", revisar: true, fontes: [F.regulamento] },
  { slug: "imposto-seletivo", titulo: "Imposto Seletivo — alíquotas ainda não enviadas ao Congresso", status: "solicitado", orgao: "Ministério da Fazenda / Congresso Nacional", baseLegal: "EC 132/2023; LC 214/2025 (alíquotas por lei ordinária); LC 227/2026 (base do ICMS a partir de 01/01/2027)",
    resumo: "O governo anunciou em 08/10/2026 que enviará a proposta das alíquotas após o 2º turno das eleições. Como o IS está sujeito à noventena, a cobrança em 01/01/2027 fica incerta. A estimativa de arrecadação para 2027 é de cerca de R$ 42 bilhões.",
    dataEvento: "2026-10-08", proximoPasso: "Envio da proposta (PL ou MP, ainda indefinido) e contagem de 90 dias até a cobrança.", impactoSistema: "O sistema não calcula IS automaticamente; os relatórios tratam como risco/pendência.", fontes: [F.is, F.senadoCbs] },
  { slug: "simples-opcao-2027", titulo: "Simples Nacional 2027 — prazos de opção (Resolução CGSN 194/2026)", status: "prazo", orgao: "Comitê Gestor do Simples Nacional", baseLegal: "Resolução CGSN 194, de 25/09/2026 (DOU 28/09/2026), que altera a Resolução CGSN 186/2026",
    resumo: "Opção pelo Simples: 01/09 a 15/10/2026 (regularização de pendências até 30/10). Opção pelo regime regular de IBS/CBS (jan–jun/2027): 01/09 a 30/10/2026. Cancelamento irretratável: 03/11 a 20/12/2026. Empresas em início de atividade seguem regras próprias.",
    dataEvento: "2026-09-25", proximaData: "2026-10-30", proximoPasso: "Avisar clientes do Simples que decidam pelo regime regular de IBS/CBS até 30/10/2026; cancelamento a partir de 03/11.", impactoSistema: "Comparativo 'Simples dentro x por fora' e alertas ao cliente optante.", fontes: [F.cgsn, F.fiemg] },
  { slug: "plp-124-2022-multas", titulo: "PLP 124/2022 — processo administrativo tributário e teto de multas", status: "tramitacao", orgao: "Senado Federal (retorno da Câmara)", baseLegal: "PLP 124/2022 (altera o CTN; novo art. 113-A)",
    resumo: "Teto de multas: 75% do tributo nos casos gerais, 100% em fraude/sonegação/conluio e 150% na reincidência. A Câmara aprovou em 11/11/2025 (411 a 3) e o texto retornou ao Senado.",
    dataEvento: "2025-11-11", proximoPasso: "Votação final no Senado e sanção. Andamento posterior a 11/2025 não foi confirmado nesta pesquisa.", impactoSistema: "Só informativo (penalidades).", revisar: true, fontes: [F.plp124, F.senado2026] },
];

let pronta = null;
function garantirTabela() {
  if (!pronta) {
    pronta = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS reforma_radar (
        slug TEXT PRIMARY KEY, titulo TEXT NOT NULL, status TEXT NOT NULL, orgao TEXT, base_legal TEXT, resumo TEXT,
        data_evento TEXT, proxima_data TEXT, proximo_passo TEXT, impacto_sistema TEXT, fontes JSONB NOT NULL DEFAULT '[]'::jsonb,
        origem TEXT DEFAULT 'seed', revisao TEXT DEFAULT 'confirmado', revisar BOOLEAN DEFAULT FALSE, ativo BOOLEAN DEFAULT TRUE,
        verificado_em TIMESTAMPTZ, verificado_por TEXT, atualizado_por TEXT, criado_em TIMESTAMPTZ DEFAULT NOW(), atualizado_em TIMESTAMPTZ DEFAULT NOW())`;
      for (const i of SEED) {
        await sql`INSERT INTO reforma_radar (slug, titulo, status, orgao, base_legal, resumo, data_evento, proxima_data, proximo_passo, impacto_sistema, fontes, origem, revisar, verificado_em, verificado_por)
          VALUES (${i.slug}, ${i.titulo}, ${i.status}, ${i.orgao || ""}, ${i.baseLegal || ""}, ${i.resumo || ""}, ${i.dataEvento || ""}, ${i.proximaData || ""}, ${i.proximoPasso || ""}, ${i.impactoSistema || ""},
            ${JSON.stringify(limparFontes(i.fontes))}::jsonb, 'seed', ${!!i.revisar}, '2026-10-28T12:00:00Z', 'pesquisa inicial (Claude)')
          ON CONFLICT (slug) DO NOTHING`;
      }
    })().catch((e) => { pronta = null; throw e; });
  }
  return pronta;
}

const dto = (l) => ({
  slug: l.slug, titulo: l.titulo, status: l.status, statusRotulo: STATUS_RADAR[l.status] || l.status, orgao: l.orgao, baseLegal: l.base_legal, resumo: l.resumo,
  dataEvento: l.data_evento, proximaData: l.proxima_data, proximoPasso: l.proximo_passo, impactoSistema: l.impacto_sistema, fontes: l.fontes || [],
  origem: l.origem, revisao: l.revisao, revisar: !!l.revisar, ativo: l.ativo, verificadoEm: l.verificado_em, verificadoPor: l.verificado_por, atualizadoEm: l.atualizado_em,
});
const ehAdmin = (u) => u?.perfil === "ADMIN" || u?.legacy === true;

export async function radarListar(req, res) {
  await garantirTabela();
  const incluirArquivados = req.query?.arquivados === "1";
  const linhas = await sql`SELECT * FROM reforma_radar ORDER BY atualizado_em DESC`;
  const itens = linhas.map(dto).filter((i) => incluirArquivados || i.ativo);
  itens.sort((a, b) => (PESO[a.status] ?? 9) - (PESO[b.status] ?? 9) || String(a.proximaData || "9999").localeCompare(String(b.proximaData || "9999")));
  const hoje = hojeBrasilia();
  const em = (d) => Math.round((Date.parse(d) - Date.parse(hoje)) / 86400000);
  const alertas = itens.filter((i) => i.ativo && i.revisao === "confirmado" && i.proximaData && /^\d{4}-\d{2}-\d{2}$/.test(i.proximaData) && em(i.proximaData) >= -7 && em(i.proximaData) <= 30)
    .map((i) => ({ slug: i.slug, titulo: i.titulo, data: i.proximaData, dias: em(i.proximaData) }));
  const contagem = {};
  for (const i of itens) if (i.ativo && i.revisao === "confirmado") contagem[i.status] = (contagem[i.status] || 0) + 1;
  const ultima = itens.map((i) => i.verificadoEm).filter(Boolean).sort().pop() || null;
  return enviar(res, 200, { sucesso: true, itens, alertas, contagem, ultimaVerificacao: ultima, consultadoEm: new Date().toISOString(), sugestoes: itens.filter((i) => i.revisao === "sugestao").length, podeEditar: ehAdmin(usuarioAutenticado(req)) });
}

export async function radarSalvar(req, res) {
  if (req.method !== "POST") return enviar(res, 405, { sucesso: false, error: "Use POST." });
  const user = usuarioAutenticado(req);
  if (!ehAdmin(user)) return enviar(res, 403, { sucesso: false, error: "Somente administradores editam o radar." });
  await garantirTabela();
  const b = req.body || {};
  const titulo = texto(b.titulo, 200);
  const status = texto(b.status, 20);
  if (!titulo) return enviar(res, 400, { sucesso: false, error: "Informe o título." });
  if (!STATUS_RADAR[status]) return enviar(res, 400, { sucesso: false, error: "Status inválido." });
  const fontes = limparFontes(b.fontes);
  if (!fontes.length) return enviar(res, 400, { sucesso: false, error: "Informe ao menos uma fonte com link (https). Nenhuma informação entra no radar sem fonte." });
  if (!texto(b.baseLegal) && !fontes.some((f) => f.tipo === "oficial")) return enviar(res, 400, { sucesso: false, error: "Informe a base legal ou uma fonte oficial (senado.leg.br, planalto.gov.br, gov.br etc.)." });
  const slug = texto(b.slug, 80) || `${titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}-${crypto.randomBytes(2).toString("hex")}`;
  const quem = texto(user?.nome || user?.login, 120);
  await sql`INSERT INTO reforma_radar (slug, titulo, status, orgao, base_legal, resumo, data_evento, proxima_data, proximo_passo, impacto_sistema, fontes, origem, revisao, revisar, ativo, verificado_em, verificado_por, atualizado_por, atualizado_em)
    VALUES (${slug}, ${titulo}, ${status}, ${texto(b.orgao, 200)}, ${texto(b.baseLegal, 500)}, ${texto(b.resumo, 2000)}, ${texto(b.dataEvento, 10)}, ${texto(b.proximaData, 10)}, ${texto(b.proximoPasso, 800)}, ${texto(b.impactoSistema, 600)},
      ${JSON.stringify(fontes)}::jsonb, 'manual', 'confirmado', ${!!b.revisar}, TRUE, NOW(), ${quem}, ${quem}, NOW())
    ON CONFLICT (slug) DO UPDATE SET titulo=EXCLUDED.titulo, status=EXCLUDED.status, orgao=EXCLUDED.orgao, base_legal=EXCLUDED.base_legal, resumo=EXCLUDED.resumo, data_evento=EXCLUDED.data_evento,
      proxima_data=EXCLUDED.proxima_data, proximo_passo=EXCLUDED.proximo_passo, impacto_sistema=EXCLUDED.impacto_sistema, fontes=EXCLUDED.fontes, revisao='confirmado', revisar=EXCLUDED.revisar, ativo=TRUE,
      verificado_em=NOW(), verificado_por=EXCLUDED.verificado_por, atualizado_por=EXCLUDED.atualizado_por, atualizado_em=NOW()`;
  return enviar(res, 200, { sucesso: true, slug });
}

export async function radarVerificar(req, res) {
  if (req.method !== "POST") return enviar(res, 405, { sucesso: false, error: "Use POST." });
  const user = usuarioAutenticado(req);
  if (!ehAdmin(user)) return enviar(res, 403, { sucesso: false, error: "Somente administradores." });
  await garantirTabela();
  const slug = texto(req.body?.slug, 80);
  await sql`UPDATE reforma_radar SET verificado_em = NOW(), verificado_por = ${texto(user?.nome || user?.login, 120)}, revisar = FALSE, atualizado_em = NOW() WHERE slug = ${slug}`;
  return enviar(res, 200, { sucesso: true });
}

export async function radarArquivar(req, res) {
  if (req.method !== "POST") return enviar(res, 405, { sucesso: false, error: "Use POST." });
  const user = usuarioAutenticado(req);
  if (!ehAdmin(user)) return enviar(res, 403, { sucesso: false, error: "Somente administradores." });
  await garantirTabela();
  await sql`UPDATE reforma_radar SET ativo = ${req.body?.ativo === true}, atualizado_por = ${texto(user?.nome || user?.login, 120)}, atualizado_em = NOW() WHERE slug = ${texto(req.body?.slug, 80)}`;
  return enviar(res, 200, { sucesso: true });
}

// Pesquisa novidades em fontes oficiais e grava como SUGESTÃO (revisao='sugestao'); nada vale até um administrador confirmar.
const SITES_PESQUISA = ["planalto.gov.br", "senado.leg.br", "camara.leg.br", "gov.br", "tcu.gov.br", "cgibs.gov.br", "agenciabrasil.ebc.com.br"];
export async function radarPesquisar(req, res) {
  if (req.method !== "POST") return enviar(res, 405, { sucesso: false, error: "Use POST." });
  const user = usuarioAutenticado(req);
  if (!ehAdmin(user)) return enviar(res, 403, { sucesso: false, error: "Somente administradores." });
  if (!process.env.OPENAI_API_KEY) return enviar(res, 503, { sucesso: false, error: "Pesquisa automática indisponível: OPENAI_API_KEY não configurada." });
  await garantirTabela();
  const atuais = await sql`SELECT slug, titulo, status, proxima_data FROM reforma_radar WHERE ativo = TRUE AND revisao = 'confirmado'`;
  const hoje = hojeBrasilia();
  const prompt = `Hoje é ${hoje}. Pesquise SOMENTE em fontes oficiais as novidades da Reforma Tributária do consumo brasileira (IBS, CBS, Imposto Seletivo, Simples Nacional, Comitê Gestor, regulamentos, resoluções do Senado, atos da Receita/CGIBS, decisões do TCU).
Itens que o radar já tem (não repita sem fato novo): ${atuais.map((a) => `${a.slug} [${a.status}]`).join("; ")}.
Devolva SOMENTE JSON: {"itens":[{"slug":"","titulo":"","status":"vigente|aprovado|tramitacao|solicitado|prazo","orgao":"","baseLegal":"número/data da norma ou projeto","resumo":"","dataEvento":"AAAA-MM-DD","proximaData":"AAAA-MM-DD ou vazio","proximoPasso":"","fontes":[{"titulo":"","url":"https://..."}]}]}.
Regras: cada item precisa de ao menos uma fonte com URL https oficial; não invente números de lei, datas ou alíquotas; se não houver novidade, devolva {"itens":[]}; para fato já existente no radar use o mesmo slug apenas se houver mudança de status/data.`;
  const modelo = process.env.OPENAI_RESEARCH_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini";
  let data;
  try {
    const r = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/responses`, {
      method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelo, input: prompt, tools: [{ type: "web_search", filters: { allowed_domains: SITES_PESQUISA } }], tool_choice: "auto" }),
    });
    data = await r.json();
    if (!r.ok) return enviar(res, 502, { sucesso: false, error: data?.error?.message || "Falha na pesquisa." });
  } catch (e) { return enviar(res, 502, { sucesso: false, error: `Falha na pesquisa: ${String(e?.message || e).slice(0, 150)}` }); }
  let bruto = String(data?.output_text || "");
  if (!bruto) for (const it of data?.output || []) for (const c of it?.content || []) if (c?.type === "output_text") bruto = c.text;
  let json;
  try { json = JSON.parse(bruto.replace(/^```json\s*|```$/g, "").trim()); } catch { return enviar(res, 502, { sucesso: false, error: "A pesquisa não retornou JSON válido." }); }
  let novas = 0;
  for (const i of Array.isArray(json?.itens) ? json.itens : []) {
    const fontes = limparFontes(i.fontes).filter((f) => f.tipo === "oficial");
    if (!i.titulo || !STATUS_RADAR[i.status] || !fontes.length) continue;
    const slug = `sug-${crypto.createHash("sha1").update(`${i.slug || i.titulo}|${i.dataEvento || ""}`).digest("hex").slice(0, 10)}`;
    await sql`INSERT INTO reforma_radar (slug, titulo, status, orgao, base_legal, resumo, data_evento, proxima_data, proximo_passo, fontes, origem, revisao)
      VALUES (${slug}, ${texto(i.titulo, 200)}, ${i.status}, ${texto(i.orgao, 200)}, ${texto(i.baseLegal, 500)}, ${texto(i.resumo, 2000)}, ${texto(i.dataEvento, 10)}, ${texto(i.proximaData, 10)}, ${texto(i.proximoPasso, 800)}, ${JSON.stringify(fontes)}::jsonb, 'ia', 'sugestao')
      ON CONFLICT (slug) DO NOTHING`;
    novas += 1;
  }
  return enviar(res, 200, { sucesso: true, novas });
}

// Resumo textual dos itens vigentes/em tramitação para embasar prompts de IA (com fontes).
export async function resumoRadarParaPrompt(limite = 14) {
  try {
    await garantirTabela();
    const l = await sql`SELECT titulo, status, base_legal, resumo, fontes FROM reforma_radar WHERE ativo = TRUE AND revisao = 'confirmado'`;
    return l.slice(0, limite).map((i) => `- [${STATUS_RADAR[i.status] || i.status}] ${i.titulo} — ${i.base_legal || ""}. ${String(i.resumo || "").slice(0, 280)} Fonte: ${(i.fontes || [])[0]?.url || "—"}`).join("\n");
  } catch { return ""; }
}
