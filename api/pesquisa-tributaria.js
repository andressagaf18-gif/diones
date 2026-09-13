// api/pesquisa-tributaria.js
// Finder - pesquisa normativa com IA e validacao automatica protegida.
// No projeto Vercel, mantenha este arquivo com extensao .js.

import crypto from "crypto";
import { neon } from "@neondatabase/serverless";
import { exigirAutenticacao } from "../server/auth.js";

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
const PROMPT_VERSAO = "PESQUISA_TRIBUTARIA_V6_CNAE_CLASSIFICACAO_AUTOMATICA";
const PREMISSA_REFERENCIA = Object.freeze({
  cbsPct: 9.21,
  ibsPct: 18.7,
  totalPct: 27.91,
  situacao: "ESTIMATIVA_TECNICA_CGIBS_RESOLUCAO_14_2026_NAO_DEFINITIVA",
  fonte: "Resolução CGIBS nº 14/2026 — premissa para projeção, não alíquota definitiva",
});
const FONTES_OFICIAIS = [
  "planalto.gov.br",
  "gov.br",
  "senado.leg.br",
  "camara.leg.br",
  "confaz.fazenda.gov.br",
  "receita.economia.gov.br",
  "ibge.gov.br",
  "concla.ibge.gov.br",
  "cgibs.gov.br",
];

function texto(valor = "") { return String(valor ?? "").trim(); }
function lista(valor) { return Array.isArray(valor) ? valor : []; }
function numero(valor, padrao = null) {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : padrao;
}
function normalizar(valor = "") {
  return texto(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function hash(valor) { return crypto.createHash("sha256").update(valor).digest("hex"); }
function extrairOutputText(data) {
  if (texto(data?.output_text)) return texto(data.output_text);
  for (const item of lista(data?.output)) {
    for (const content of lista(item?.content)) {
      if (content?.type === "output_text" && content?.text) return texto(content.text);
    }
  }
  return "";
}
function limparJson(valor) {
  const limpo = texto(valor)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");

  return inicio >= 0 && fim > inicio
    ? limpo.slice(inicio, fim + 1)
    : limpo;
}
function urlOficial(url = "") {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return FONTES_OFICIAIS.some(d => host === d || host.endsWith(`.${d}`));
  } catch { return false; }
}
function ipReq(req) {
  return texto(req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress).split(",")[0].trim();
}

async function garantirBanco() {
  await sql`
    CREATE TABLE IF NOT EXISTS pesquisas_tributarias (
      id TEXT PRIMARY KEY,
      token_publico_hash TEXT NOT NULL,
      cache_key TEXT NOT NULL,
      projeto_id TEXT,
      cnpj TEXT,
      cnae TEXT NOT NULL,
      atividade_real TEXT NOT NULL,
      nbs_ncm TEXT,
      regime TEXT,
      municipio TEXT,
      uf TEXT,
      ano INTEGER,
      status TEXT NOT NULL DEFAULT 'AGUARDANDO_VALIDACAO_CONSULTOR',
      resultado_ia JSONB NOT NULL DEFAULT '{}'::jsonb,
      premissas_confirmadas JSONB,
      fontes JSONB NOT NULL DEFAULT '[]'::jsonb,
      modelo TEXT,
      prompt_versao TEXT,
      prompt_hash TEXT,
      openai_request_id TEXT,
      uso_tokens JSONB,
      pesquisa_origem_id TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      validado_por TEXT,
      validado_em TIMESTAMPTZ,
      motivo_rejeicao TEXT
    )
  `;
  await sql`ALTER TABLE pesquisas_tributarias ADD COLUMN IF NOT EXISTS projeto_id TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS pesquisas_tributarias_cache_idx ON pesquisas_tributarias(cache_key, criado_em DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS pesquisas_tributarias_status_idx ON pesquisas_tributarias(status, criado_em DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS pesquisas_tributarias_projeto_idx ON pesquisas_tributarias(projeto_id, criado_em DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS pesquisas_tributarias_limites (
      chave TEXT PRIMARY KEY,
      quantidade INTEGER NOT NULL DEFAULT 0,
      janela_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function limitarPesquisa(req) {
  const chave = hash(`${ipReq(req)}:${new Date().toISOString().slice(0, 13)}`);
  const linhas = await sql`
    INSERT INTO pesquisas_tributarias_limites (chave, quantidade)
    VALUES (${chave}, 1)
    ON CONFLICT (chave) DO UPDATE SET quantidade = pesquisas_tributarias_limites.quantidade + 1
    RETURNING quantidade
  `;
  if (Number(linhas?.[0]?.quantidade || 0) > 12) {
    const erro = new Error("Limite temporário de pesquisas atingido. Tente novamente mais tarde.");
    erro.status = 429;
    throw erro;
  }
}

function construirCacheKey(body) {
  const partes = [
    texto(body.cnae).replace(/\D/g, ""), normalizar(body.atividadeReal),
    normalizar(body.nbsNcm), normalizar(body.regime), normalizar(body.municipio),
    texto(body.uf).toUpperCase(), texto(body.ano),
    texto(body.cbsReferenciaPct), texto(body.ibsReferenciaPct),
    "LC214_LOCAL_V6_CLASSIFICACAO_AUTOMATICA",
  ];
  return `tributario_${hash(partes.join("|"))}`;
}

/*
 * A IA localiza e resume a norma; este catálogo impede que um benefício já
 * positivado desapareça porque o modelo respondeu com redação ou estrutura
 * diferente. A aplicação continua condicionada aos requisitos do caso real.
 */
function aplicarCatalogoLegal(resultado, body) {
  const cnae = texto(body?.cnae).replace(/\D/g, "");
  const atividade = normalizar(body?.atividadeReal);
  const contabilista =
    cnae === "6920601" &&
    /(contab|escrituracao contabil|auditoria contabil|pericia contabil)/.test(atividade);

  if (!contabilista) return resultado;

  const fonte = {
    titulo: "Lei Complementar nº 214, de 16 de janeiro de 2025",
    url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm",
    orgao: "Presidência da República",
    artigo: "Art. 127, VII",
    consultadoEm: new Date().toISOString(),
  };

  resultado.beneficio_legal = {
    ...(resultado.beneficio_legal || {}),
    existe: true,
    tipo: "REDUCAO_ALIQUOTAS_IBS_CBS_PROFISSAO_INTELECTUAL",
    percentual_reducao_pct: 30,
    situacao_normativa: "VIGENTE_APLICACAO_CONDICIONADA_AOS_REQUISITOS_LEGAIS",
    base_legal: "LC 214/2025, art. 127, VII — serviços prestados por contabilistas",
    catalogo_legal: true,
    enquadramento_catalogo: "CNAE_6920601_CONTABILISTAS",
  };
  resultado.classificacao_operacao = {
    setor: "SERVICO",
    tipo_codigo: "ITEM_LISTA_SERVICOS_LC_116",
    codigo: "17.19",
    descricao: "Contabilidade, inclusive serviços técnicos e auxiliares",
    origem: "CATALOGO_LEGAL",
    automatico: true,
    confianca: "ALTA",
    base_legal: "LC 116/2003, lista de serviços, item 17.19; LC 214/2025, art. 127, VII",
    informacoes_faltantes: [],
  };
  resultado.tratamento_sugerido =
    "Simular redução de 30% nas alíquotas de IBS e CBS, condicionada ao atendimento dos requisitos do art. 127 da LC 214/2025.";
  resultado.requisitos = [...new Set([
    ...lista(resultado.requisitos).map(texto).filter(Boolean),
    "Comprovar que a atividade efetivamente prestada corresponde aos serviços de contabilista abrangidos pelo art. 127.",
    "Manter documentação cadastral, profissional e operacional que sustente o enquadramento.",
  ])];
  resultado.alertas = [...new Set([
    ...lista(resultado.alertas).map(texto).filter(Boolean),
    "A redução legal é aplicada à simulação; a fruição concreta permanece condicionada aos requisitos legais da operação e do prestador.",
  ])];
  resultado.fontes = [...new Map([
    ...lista(resultado.fontes),
    fonte,
  ].filter(item => item?.url).map(item => [item.url, item])).values()];
  resultado.grau_confianca = "ALTO";
  resultado.catalogo_legal_aplicado = true;
  return resultado;
}

function normalizarResultado(dados, body, fontesFerramenta = []) {
  const fontesIa = lista(dados?.fontes).map(f => ({
    titulo: texto(f?.titulo), url: texto(f?.url), orgao: texto(f?.orgao),
    artigo: texto(f?.artigo), consultadoEm: new Date().toISOString(),
  })).filter(f => f.url && urlOficial(f.url));
  const fontesTool = lista(fontesFerramenta).map(f => ({
    titulo: texto(f?.title), url: texto(f?.url), orgao: "Fonte oficial pesquisada",
    artigo: "", consultadoEm: new Date().toISOString(),
  })).filter(f => f.url && urlOficial(f.url));
  const mapa = new Map([...fontesIa, ...fontesTool].map(f => [f.url, f]));
  const reducao = Math.max(0, Math.min(100, numero(dados?.reducao_pct, 0)));
  const cbs = numero(
    body?.cbsReferenciaPct,
    numero(dados?.cbs_referencia_pct, PREMISSA_REFERENCIA.cbsPct)
  );
  const ibs = numero(
    body?.ibsReferenciaPct,
    numero(dados?.ibs_referencia_pct, PREMISSA_REFERENCIA.ibsPct)
  );
  const local = dados?.tributacao_local || {};
  const classificacao = dados?.classificacao_operacao || {};
  const aliquotaLocal = numero(
    local?.aliquota_efetiva_pct ?? local?.aliquota_nominal_pct,
    null
  );
  return {
    consulta: {
      cnae: texto(body.cnae).replace(/\D/g, ""), atividade_real: texto(body.atividadeReal),
      nbs_ncm: texto(body.nbsNcm) || null, regime: texto(body.regime),
      municipio: texto(body.municipio), uf: texto(body.uf).toUpperCase(), ano: numero(body.ano),
    },
    tratamento_sugerido: texto(dados?.tratamento_sugerido) || "Validação necessária",
    classificacao_operacao: {
      setor: texto(classificacao?.setor).toUpperCase() || "NAO_DETERMINADO",
      tipo_codigo: texto(classificacao?.tipo_codigo).toUpperCase() || "NAO_DETERMINADO",
      codigo: texto(classificacao?.codigo) || null,
      descricao: texto(classificacao?.descricao),
      origem: texto(classificacao?.origem).toUpperCase() || "PESQUISA_IA",
      automatico: classificacao?.automatico !== false,
      confianca: texto(classificacao?.confianca).toUpperCase() || "BAIXA",
      base_legal: texto(classificacao?.base_legal),
      informacoes_faltantes: lista(classificacao?.informacoes_faltantes).map(texto).filter(Boolean),
    },
    beneficio_legal: {
      existe: dados?.beneficio_legal?.existe === true,
      tipo: texto(dados?.beneficio_legal?.tipo),
      percentual_reducao_pct: reducao,
      situacao_normativa: texto(dados?.beneficio_legal?.situacao_normativa) || "NAO_CONFIRMADA",
      base_legal: texto(dados?.beneficio_legal?.base_legal),
    },
    aliquotas_referencia: {
      cbs_pct: cbs, ibs_pct: ibs,
      total_pct: cbs != null && ibs != null ? cbs + ibs : numero(dados?.aliquota_referencia_total_pct, null),
      situacao_normativa: texto(body?.situacaoPremissaReferencia) ||
        texto(dados?.situacao_normativa_aliquotas) || PREMISSA_REFERENCIA.situacao,
      fonte_premissa: texto(body?.fontePremissaReferencia) || PREMISSA_REFERENCIA.fonte,
    },
    aliquotas_efetivas_simuladas: {
      cbs_pct: cbs == null ? null : cbs * (1 - reducao / 100),
      ibs_pct: ibs == null ? null : ibs * (1 - reducao / 100),
    },
    tributacao_local: {
      tipo: texto(local?.tipo).toUpperCase() || "NAO_DETERMINADO",
      incide: local?.incide === true,
      aplicavel_regime_atual: local?.aplicavel_regime_atual !== false,
      aliquota_nominal_pct: numero(local?.aliquota_nominal_pct, null),
      aliquota_efetiva_pct: aliquotaLocal,
      codigo_enquadramento: texto(local?.codigo_enquadramento),
      local_competente: texto(local?.local_competente),
      situacao_normativa: texto(local?.situacao_normativa) || "NAO_CONFIRMADA",
      base_legal: texto(local?.base_legal),
      memoria_calculo: texto(local?.memoria_calculo),
      requisitos: lista(local?.requisitos).map(texto).filter(Boolean),
      informacoes_faltantes: lista(local?.informacoes_faltantes).map(texto).filter(Boolean),
    },
    requisitos: lista(dados?.requisitos).map(texto).filter(Boolean),
    informacoes_faltantes: lista(dados?.informacoes_faltantes).map(texto).filter(Boolean),
    alertas: lista(dados?.alertas).map(texto).filter(Boolean),
    grau_confianca: ["ALTO", "MEDIO", "BAIXO"].includes(texto(dados?.grau_confianca).toUpperCase())
      ? texto(dados.grau_confianca).toUpperCase() : "BAIXO",
    conclusao: texto(dados?.conclusao),
    fontes: [...mapa.values()],
    pesquisado_em: new Date().toISOString(),
  };
}

function validarAutomaticamente(resultado) {
  const beneficio = resultado?.beneficio_legal || {};
  const aliquotas = resultado?.aliquotas_referencia || {};
  const local = resultado?.tributacao_local || {};
  const reducao = numero(beneficio.percentual_reducao_pct, 0);
  const situacaoBeneficio = normalizar(beneficio.situacao_normativa);
  const situacaoAliquotas = normalizar(aliquotas.situacao_normativa);
  const faltantes = lista(resultado?.informacoes_faltantes).filter(Boolean);
  const temFonteOficial = lista(resultado?.fontes).some(f => urlOficial(f?.url));
  const beneficioVigente = !beneficio.existe || (
    reducao > 0 &&
    Boolean(texto(beneficio.base_legal)) &&
    /(vigente|em vigor|publicad|lei complementar)/.test(situacaoBeneficio) &&
    !/(pendente|estimad|nao confirm|revogad|proposta)/.test(situacaoBeneficio)
  );
  const aliquotasInformadas =
    numero(aliquotas.cbs_pct, null) != null &&
    numero(aliquotas.ibs_pct, null) != null;
  const aliquotasEstimadas =
    /(pendente|estimad|nao confirm|a definir)/.test(situacaoAliquotas);
  const resultadoCoerente = beneficio.existe ? reducao > 0 : reducao === 0;
  const catalogoLegal = beneficio.catalogo_legal === true;
  const beneficioOficialCondicional = Boolean(
    beneficio.existe &&
    beneficioVigente &&
    resultadoCoerente &&
    temFonteOficial &&
    aliquotasInformadas
  );

  const motivos = [];
  if (resultado?.grau_confianca !== "ALTO") motivos.push("A pesquisa não atingiu confiança alta.");
  if (!temFonteOficial) motivos.push("Nenhuma fonte oficial foi confirmada.");
  if (faltantes.length) motivos.push(...faltantes);
  if (!beneficioVigente) motivos.push("O benefício não está demonstrado como vigente e aplicável.");
  if (!resultadoCoerente) motivos.push("A existência do benefício e o percentual de redução são incompatíveis.");
  if (!aliquotasInformadas) motivos.push("As alíquotas de referência da simulação estão incompletas.");

  // Para item positivado no catálogo jurídico, dados documentais pendentes não
  // apagam o benefício da simulação. Eles passam a ser ressalvas explícitas.
  const aplicacaoCondicional = Boolean(catalogoLegal || beneficioOficialCondicional);
  const semBeneficioConfirmado = Boolean(
    !beneficio.existe &&
    temFonteOficial &&
    aliquotasInformadas &&
    resultadoCoerente
  );
  const apto = motivos.length === 0 || aplicacaoCondicional || semBeneficioConfirmado;
  const ressalvas = aplicacaoCondicional
    ? [...new Set([
        ...faltantes,
        ...lista(resultado?.requisitos),
        "Confirmar documentalmente os requisitos do art. 127 antes de tratar a simulação como apuração definitiva.",
      ].map(texto).filter(Boolean))]
    : [];
  const localSeguro =
    local.incide === true &&
    numero(local.aliquota_efetiva_pct ?? local.aliquota_nominal_pct, null) != null &&
    lista(local.informacoes_faltantes).length === 0 &&
    Boolean(texto(local.base_legal)) &&
    !/(pendente|estimad|nao confirm|a definir)/.test(normalizar(local.situacao_normativa));

  const premissas = apto ? {
    cbsPct: numero(aliquotas.cbs_pct),
    ibsPct: numero(aliquotas.ibs_pct),
    reducaoPct: reducao,
    tipoTributoLocal: texto(local.tipo).toUpperCase(),
    aliquotaLocalPct: localSeguro
      ? numero(local.aliquota_efetiva_pct ?? local.aliquota_nominal_pct, null)
      : null,
    baseLegalLocal: localSeguro ? texto(local.base_legal) : "",
    baseLegal: texto(beneficio.base_legal),
    observacao: "Premissas liberadas automaticamente pelo motor de segurança.",
    confirmadoPor: "MOTOR_AUTOMATICO",
    confirmadoEm: new Date().toISOString(),
    confirmacaoTipo: "AUTOMATICA",
    situacaoNormativaAliquotas: texto(aliquotas.situacao_normativa),
    aliquotasEstimadas,
    aplicacaoCondicional,
    requisitosPendentes: ressalvas,
    setorOperacao: texto(resultado?.classificacao_operacao?.setor).toUpperCase(),
    tipoCodigoOperacao: texto(resultado?.classificacao_operacao?.tipo_codigo).toUpperCase(),
    codigoOperacao: texto(resultado?.classificacao_operacao?.codigo),
    descricaoOperacao: texto(resultado?.classificacao_operacao?.descricao),
  } : null;

  resultado.validacao_automatica = {
    apto,
    status: apto
      ? aplicacaoCondicional
        ? "APLICADO_COM_RESSALVA"
        : "APLICADO_AUTOMATICAMENTE"
      : "DADOS_INSUFICIENTES",
    motivos: apto ? [] : motivos,
    ressalvas,
    aplicacao_condicional: aplicacaoCondicional,
    regra: "Fonte oficial + benefício vigente + alíquotas informadas; benefícios legais podem alimentar automaticamente a simulação com ressalvas explícitas",
  };

  return { apto, motivos, premissas };
}

async function pesquisar(req, res) {
  const body = req.body || {};
  const cnae = texto(body.cnae).replace(/\D/g, "");
  const atividadeReal = texto(body.atividadeReal);
  if (cnae.length !== 7 || atividadeReal.length < 10) {
    return res.status(400).json({ sucesso:false, error:"Informe CNAE completo com 7 dígitos e descreva a atividade efetivamente exercida." });
  }
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ sucesso:false, error:"OPENAI_API_KEY não configurada." });
  await limitarPesquisa(req);
  const cacheKey = construirCacheKey(body);
  const cache = await sql`
    SELECT * FROM pesquisas_tributarias
    WHERE cache_key=${cacheKey} AND status IN ('VALIDADO','DADOS_INSUFICIENTES','AGUARDANDO_VALIDACAO_CONSULTOR')
      AND criado_em > NOW() - INTERVAL '30 days'
    ORDER BY CASE WHEN status='VALIDADO' THEN 0 ELSE 1 END, criado_em DESC LIMIT 1
  `;
  const tokenPublico = crypto.randomBytes(32).toString("hex");
  const id = crypto.randomUUID();
  if (cache.length) {
    const origem = cache[0];
    const resultadoCache = aplicarCatalogoLegal(origem.resultado_ia, body);
    const automatico = validarAutomaticamente(resultadoCache);
    const statusAutomatico = automatico.apto ? "VALIDADO" : "DADOS_INSUFICIENTES";
    const validadoEm = automatico.apto ? new Date().toISOString() : null;
    await sql`
      INSERT INTO pesquisas_tributarias
      (id,token_publico_hash,cache_key,projeto_id,cnpj,cnae,atividade_real,nbs_ncm,regime,municipio,uf,ano,status,resultado_ia,premissas_confirmadas,fontes,modelo,prompt_versao,prompt_hash,pesquisa_origem_id,validado_por,validado_em)
      VALUES (${id},${hash(tokenPublico)},${cacheKey},${texto(body.projetoId)},${texto(body.cnpj)},${cnae},${atividadeReal},${texto(body.nbsNcm)},${texto(body.regime)},${texto(body.municipio)},${texto(body.uf).toUpperCase()},${numero(body.ano)},${statusAutomatico},${JSON.stringify(resultadoCache)},${automatico.premissas?JSON.stringify(automatico.premissas):null},${JSON.stringify(origem.fontes)},${origem.modelo},${PROMPT_VERSAO},${origem.prompt_hash},${origem.id},${automatico.apto?"MOTOR_AUTOMATICO":null},${validadoEm})
    `;
    return res.status(200).json({ sucesso:true, pesquisaId:id, tokenPublico, cache:true, status:statusAutomatico, resultado:resultadoCache, premissasConfirmadas:automatico.premissas });
  }

  const cbsPremissa = numero(body.cbsReferenciaPct, PREMISSA_REFERENCIA.cbsPct);
  const ibsPremissa = numero(body.ibsReferenciaPct, PREMISSA_REFERENCIA.ibsPct);
  const prompt = `Você é um pesquisador tributário brasileiro. Pesquise a legislação vigente usando somente fontes oficiais.
Analise CNAE ${cnae}; atividade efetiva: ${atividadeReal}; NBS/NCM: ${texto(body.nbsNcm)||"não informado"}; regime: ${texto(body.regime)}; município/UF: ${texto(body.municipio)}/${texto(body.uf)}; ano: ${texto(body.ano)}. Premissas nominais da simulação: CBS ${cbsPremissa}% e IBS ${ibsPremissa}% — ${PREMISSA_REFERENCIA.situacao}. Não substitua essas premissas por uma alíquota apresentada como definitiva.
Separe benefício legal vigente de alíquotas de referência estimadas ou ainda pendentes. Não trate CNAE isolado como prova do benefício. Verifique expressamente se a atividade possui redução de IBS/CBS na LC 214/2025, inclusive o art. 127 quando se tratar de profissão intelectual regulamentada. Todo requisito que não puder ser comprovado pelos dados pesquisados deve obrigatoriamente constar em informacoes_faltantes. Use grau_confianca ALTO somente quando as fontes oficiais sustentarem diretamente a conclusão e não houver requisito de elegibilidade pendente.
Classifique automaticamente a operação como SERVICO, COMERCIO, INDUSTRIA ou MISTA. Para serviço, pesquise o item exato ou mais aderente da lista da LC 116/2003 e devolva o código no formato 17.19. Para comércio ou indústria, só devolva NCM quando o produto estiver suficientemente identificado; CNAE isolado não prova NCM. Se faltar produto, devolva codigo null e explique o dado necessário. Informe NBS ou cClassTrib somente quando houver correspondência oficial sustentada pela fonte.
Pesquise também o tributo do regime atual. Para serviços, identifique o item da lista, o município competente, o ISS nominal/efetivo e a legislação municipal. Para comércio ou indústria, identifique o ICMS conforme NCM, UF de origem e destino, operação interna/interestadual, consumidor, benefício, ST, monofasia ou redução de base. Se os dados não permitirem uma alíquota exata, devolva null e liste precisamente o que falta; nunca devolva zero apenas por falta de informação.
Responda exclusivamente com um objeto JSON válido, sem Markdown, comentários ou texto antes/depois, contendo: tratamento_sugerido; classificacao_operacao {setor,tipo_codigo,codigo,descricao,origem,automatico,confianca,base_legal,informacoes_faltantes[]}; beneficio_legal {existe,tipo,situacao_normativa,base_legal}; reducao_pct; cbs_referencia_pct; ibs_referencia_pct; aliquota_referencia_total_pct; situacao_normativa_aliquotas; tributacao_local {tipo,incide,aplicavel_regime_atual,aliquota_nominal_pct,aliquota_efetiva_pct,codigo_enquadramento,local_competente,situacao_normativa,base_legal,memoria_calculo,requisitos[],informacoes_faltantes[]}; requisitos[]; informacoes_faltantes[]; alertas[]; grau_confianca; conclusao; fontes[{titulo,url,orgao,artigo}]. Percentuais devem ser números na escala 0 a 100 (27.91 significa 27,91%).`;
  const modelo = process.env.OPENAI_RESEARCH_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini";
  const resposta = await fetch("https://api.openai.com/v1/responses", {
    method:"POST",
    headers:{ Authorization:`Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type":"application/json" },
    body:JSON.stringify({
      model:modelo, input:prompt,
      tools:[{ type:"web_search", filters:{ allowed_domains:FONTES_OFICIAIS } }],
      tool_choice:"auto", include:["web_search_call.action.sources"],
    }),
  });
  const data = await resposta.json();
  if (!resposta.ok) return res.status(502).json({ sucesso:false, error:data?.error?.message||"Falha na pesquisa tributária." });
  let bruto;
  try { bruto = JSON.parse(limparJson(extrairOutputText(data))); }
  catch { return res.status(502).json({ sucesso:false, error:"A pesquisa não retornou JSON válido." }); }
  const fontesTool = lista(data?.output).filter(x=>x?.type==="web_search_call").flatMap(x=>lista(x?.action?.sources));
  const resultado = aplicarCatalogoLegal(
    normalizarResultado(bruto, body, fontesTool),
    body
  );
  if (!resultado.fontes.length) resultado.alertas.push("Nenhuma fonte oficial válida foi capturada; não validar antes de nova pesquisa.");
  const automatico = validarAutomaticamente(resultado);
  const statusAutomatico = automatico.apto ? "VALIDADO" : "DADOS_INSUFICIENTES";
  const validadoEm = automatico.apto ? new Date().toISOString() : null;
  await sql`
    INSERT INTO pesquisas_tributarias
    (id,token_publico_hash,cache_key,projeto_id,cnpj,cnae,atividade_real,nbs_ncm,regime,municipio,uf,ano,status,resultado_ia,premissas_confirmadas,fontes,modelo,prompt_versao,prompt_hash,openai_request_id,uso_tokens,validado_por,validado_em)
    VALUES (${id},${hash(tokenPublico)},${cacheKey},${texto(body.projetoId)},${texto(body.cnpj)},${cnae},${atividadeReal},${texto(body.nbsNcm)},${texto(body.regime)},${texto(body.municipio)},${texto(body.uf).toUpperCase()},${numero(body.ano)},${statusAutomatico},${JSON.stringify(resultado)},${automatico.premissas?JSON.stringify(automatico.premissas):null},${JSON.stringify(resultado.fontes)},${modelo},${PROMPT_VERSAO},${hash(prompt)},${texto(data?.id)},${JSON.stringify(data?.usage||{})},${automatico.apto?"MOTOR_AUTOMATICO":null},${validadoEm})
  `;
  return res.status(200).json({ sucesso:true, pesquisaId:id, tokenPublico, cache:false, status:statusAutomatico, resultado, premissasConfirmadas:automatico.premissas });
}

async function statusPublico(req,res) {
  const id=texto(req.query?.id), token=texto(req.query?.token);
  const rows=await sql`SELECT id,status,resultado_ia,premissas_confirmadas,validado_em,motivo_rejeicao FROM pesquisas_tributarias WHERE id=${id} AND token_publico_hash=${hash(token)} LIMIT 1`;
  if(!rows.length)return res.status(404).json({sucesso:false,error:"Pesquisa não encontrada."});
  const row=rows[0];
  return res.status(200).json({sucesso:true,pesquisa:{id:row.id,status:row.status,resultado:row.resultado_ia,premissasConfirmadas:row.status==='VALIDADO'?row.premissas_confirmadas:null,validadoEm:row.validado_em,motivoRejeicao:row.motivo_rejeicao}});
}

async function listarAdmin(req,res) {
  const usuario=exigirAutenticacao(req,res,{admin:true}); if(!usuario)return;
  const status=texto(req.query?.status), busca=`%${texto(req.query?.busca)}%`;
  const rows=status
    ?await sql`SELECT * FROM pesquisas_tributarias WHERE status=${status} AND (cnae ILIKE ${busca} OR atividade_real ILIKE ${busca} OR cnpj ILIKE ${busca}) ORDER BY criado_em DESC LIMIT 200`
    :await sql`SELECT * FROM pesquisas_tributarias WHERE (cnae ILIKE ${busca} OR atividade_real ILIKE ${busca} OR cnpj ILIKE ${busca}) ORDER BY criado_em DESC LIMIT 200`;
  return res.status(200).json({sucesso:true,pesquisas:rows});
}

async function validarAdmin(req,res) {
  const usuario=exigirAutenticacao(req,res,{admin:true}); if(!usuario)return;
  const body=req.body||{}, id=texto(body.id), p=body.premissasConfirmadas||{};
  const cbs=numero(p.cbsPct), ibs=numero(p.ibsPct), reducao=numero(p.reducaoPct);
  if(cbs==null||ibs==null||reducao==null||cbs<0||ibs<0||reducao<0||reducao>100){
    return res.status(400).json({sucesso:false,error:"Confirme CBS, IBS e redução em percentuais de 0 a 100."});
  }
  const aliquotaLocal=numero(p.aliquotaLocalPct,null);
  if(aliquotaLocal!=null&&(aliquotaLocal<0||aliquotaLocal>100)){
    return res.status(400).json({sucesso:false,error:"A alíquota local deve ficar entre 0 e 100%."});
  }
  const premissas={
    cbsPct:cbs,ibsPct:ibs,reducaoPct:reducao,
    tipoTributoLocal:texto(p.tipoTributoLocal).toUpperCase(),
    aliquotaLocalPct:aliquotaLocal,
    baseLegalLocal:texto(p.baseLegalLocal),
    baseLegal:texto(p.baseLegal),observacao:texto(p.observacao),
    confirmadoPor:texto(usuario.nome||usuario.login),confirmadoEm:new Date().toISOString()
  };
  const rows=await sql`UPDATE pesquisas_tributarias SET status='VALIDADO',premissas_confirmadas=${JSON.stringify(premissas)},validado_por=${texto(usuario.nome||usuario.login)},validado_em=NOW(),atualizado_em=NOW(),motivo_rejeicao=NULL WHERE id=${id} RETURNING *`;
  if(!rows.length)return res.status(404).json({sucesso:false,error:"Pesquisa não encontrada."});
  return res.status(200).json({sucesso:true,pesquisa:rows[0]});
}

async function rejeitarAdmin(req,res) {
  const usuario=exigirAutenticacao(req,res,{admin:true}); if(!usuario)return;
  const id=texto(req.body?.id), motivo=texto(req.body?.motivo);
  if(!motivo)return res.status(400).json({sucesso:false,error:"Informe o motivo da rejeição."});
  const rows=await sql`UPDATE pesquisas_tributarias SET status='REJEITADO',motivo_rejeicao=${motivo},validado_por=${texto(usuario.nome||usuario.login)},validado_em=NOW(),atualizado_em=NOW() WHERE id=${id} RETURNING id,status`;
  if(!rows.length)return res.status(404).json({sucesso:false,error:"Pesquisa não encontrada."});
  return res.status(200).json({sucesso:true,pesquisa:rows[0]});
}

export default async function handler(req,res){
  try{
    if(!sql)return res.status(500).json({sucesso:false,error:"DATABASE_URL não configurada."});
    await garantirBanco();
    const acao=texto(req.query?.acao||req.body?.acao||(req.method==="POST"?"pesquisar":"")).toLowerCase();
    if(req.method==="POST"&&acao==="pesquisar")return pesquisar(req,res);
    if(req.method==="GET"&&acao==="status")return statusPublico(req,res);
    if(req.method==="GET"&&acao==="listar")return listarAdmin(req,res);
    if(req.method==="POST"&&acao==="validar")return validarAdmin(req,res);
    if(req.method==="POST"&&acao==="rejeitar")return rejeitarAdmin(req,res);
    return res.status(404).json({sucesso:false,error:"Operação não encontrada."});
  }catch(error){
    console.error("[pesquisa-tributaria]",error);
    return res.status(error?.status||500).json({sucesso:false,error:error?.message||"Falha na pesquisa tributária."});
  }
}
