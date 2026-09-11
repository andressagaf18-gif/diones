// api/pesquisa-tributaria.js
// Finder - pesquisa normativa com IA e validacao humana.
// No projeto Vercel, mantenha este arquivo com extensao .js.

import crypto from "crypto";
import { neon } from "@neondatabase/serverless";
import { exigirAutenticacao } from "./lib/auth.js";

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
const PROMPT_VERSAO = "PESQUISA_TRIBUTARIA_V1";
const FONTES_OFICIAIS = [
  "planalto.gov.br",
  "gov.br",
  "senado.leg.br",
  "camara.leg.br",
  "confaz.fazenda.gov.br",
  "receita.economia.gov.br",
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
  return texto(valor).replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
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
  await sql`CREATE INDEX IF NOT EXISTS pesquisas_tributarias_cache_idx ON pesquisas_tributarias(cache_key, criado_em DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS pesquisas_tributarias_status_idx ON pesquisas_tributarias(status, criado_em DESC)`;
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
    texto(body.uf).toUpperCase(), texto(body.ano), "LC214_BASE_V1",
  ];
  return `tributario_${hash(partes.join("|"))}`;
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
  const cbs = numero(dados?.cbs_referencia_pct, null);
  const ibs = numero(dados?.ibs_referencia_pct, null);
  return {
    consulta: {
      cnae: texto(body.cnae).replace(/\D/g, ""), atividade_real: texto(body.atividadeReal),
      nbs_ncm: texto(body.nbsNcm) || null, regime: texto(body.regime),
      municipio: texto(body.municipio), uf: texto(body.uf).toUpperCase(), ano: numero(body.ano),
    },
    tratamento_sugerido: texto(dados?.tratamento_sugerido) || "Validação necessária",
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
      situacao_normativa: texto(dados?.situacao_normativa_aliquotas) || "ESTIMADA_OU_PENDENTE",
    },
    aliquotas_efetivas_simuladas: {
      cbs_pct: cbs == null ? null : cbs * (1 - reducao / 100),
      ibs_pct: ibs == null ? null : ibs * (1 - reducao / 100),
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
    WHERE cache_key=${cacheKey} AND status IN ('VALIDADO','AGUARDANDO_VALIDACAO_CONSULTOR')
      AND criado_em > NOW() - INTERVAL '30 days'
    ORDER BY CASE WHEN status='VALIDADO' THEN 0 ELSE 1 END, criado_em DESC LIMIT 1
  `;
  const tokenPublico = crypto.randomBytes(32).toString("hex");
  const id = crypto.randomUUID();
  if (cache.length) {
    const origem = cache[0];
    await sql`
      INSERT INTO pesquisas_tributarias
      (id,token_publico_hash,cache_key,cnpj,cnae,atividade_real,nbs_ncm,regime,municipio,uf,ano,status,resultado_ia,fontes,modelo,prompt_versao,prompt_hash,pesquisa_origem_id)
      VALUES (${id},${hash(tokenPublico)},${cacheKey},${texto(body.cnpj)},${cnae},${atividadeReal},${texto(body.nbsNcm)},${texto(body.regime)},${texto(body.municipio)},${texto(body.uf).toUpperCase()},${numero(body.ano)},'AGUARDANDO_VALIDACAO_CONSULTOR',${JSON.stringify(origem.resultado_ia)},${JSON.stringify(origem.fontes)},${origem.modelo},${PROMPT_VERSAO},${origem.prompt_hash},${origem.id})
    `;
    return res.status(200).json({ sucesso:true, pesquisaId:id, tokenPublico, cache:true, status:"AGUARDANDO_VALIDACAO_CONSULTOR", resultado:origem.resultado_ia });
  }

  const prompt = `Você é um pesquisador tributário brasileiro. Pesquise a legislação vigente usando somente fontes oficiais.
Analise CNAE ${cnae}; atividade efetiva: ${atividadeReal}; NBS/NCM: ${texto(body.nbsNcm)||"não informado"}; regime: ${texto(body.regime)}; município/UF: ${texto(body.municipio)}/${texto(body.uf)}; ano: ${texto(body.ano)}.
Separe benefício legal vigente de alíquotas de referência estimadas ou ainda pendentes. Não trate CNAE isolado como prova do benefício. Liste requisitos cumulativos, lacunas e artigos. Para IBS/CBS, nunca apresente alíquota futura estimada como definitiva.
Responda exclusivamente em JSON com: tratamento_sugerido; beneficio_legal {existe,tipo,situacao_normativa,base_legal}; reducao_pct; cbs_referencia_pct; ibs_referencia_pct; aliquota_referencia_total_pct; situacao_normativa_aliquotas; requisitos[]; informacoes_faltantes[]; alertas[]; grau_confianca; conclusao; fontes[{titulo,url,orgao,artigo}]. Percentuais devem ser números na escala 0 a 100 (26.5 significa 26,5%).`;
  const modelo = process.env.OPENAI_RESEARCH_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini";
  const resposta = await fetch("https://api.openai.com/v1/responses", {
    method:"POST",
    headers:{ Authorization:`Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type":"application/json" },
    body:JSON.stringify({
      model:modelo, input:prompt,
      tools:[{ type:"web_search", filters:{ allowed_domains:FONTES_OFICIAIS } }],
      tool_choice:"auto", include:["web_search_call.action.sources"],
      text:{ format:{ type:"json_object" } },
    }),
  });
  const data = await resposta.json();
  if (!resposta.ok) return res.status(502).json({ sucesso:false, error:data?.error?.message||"Falha na pesquisa tributária." });
  let bruto;
  try { bruto = JSON.parse(limparJson(extrairOutputText(data))); }
  catch { return res.status(502).json({ sucesso:false, error:"A pesquisa não retornou JSON válido." }); }
  const fontesTool = lista(data?.output).filter(x=>x?.type==="web_search_call").flatMap(x=>lista(x?.action?.sources));
  const resultado = normalizarResultado(bruto, body, fontesTool);
  if (!resultado.fontes.length) resultado.alertas.push("Nenhuma fonte oficial válida foi capturada; não validar antes de nova pesquisa.");
  await sql`
    INSERT INTO pesquisas_tributarias
    (id,token_publico_hash,cache_key,cnpj,cnae,atividade_real,nbs_ncm,regime,municipio,uf,ano,status,resultado_ia,fontes,modelo,prompt_versao,prompt_hash,openai_request_id,uso_tokens)
    VALUES (${id},${hash(tokenPublico)},${cacheKey},${texto(body.cnpj)},${cnae},${atividadeReal},${texto(body.nbsNcm)},${texto(body.regime)},${texto(body.municipio)},${texto(body.uf).toUpperCase()},${numero(body.ano)},'AGUARDANDO_VALIDACAO_CONSULTOR',${JSON.stringify(resultado)},${JSON.stringify(resultado.fontes)},${modelo},${PROMPT_VERSAO},${hash(prompt)},${texto(data?.id)},${JSON.stringify(data?.usage||{})})
  `;
  return res.status(200).json({ sucesso:true, pesquisaId:id, tokenPublico, cache:false, status:"AGUARDANDO_VALIDACAO_CONSULTOR", resultado });
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
  const premissas={cbsPct:cbs,ibsPct:ibs,reducaoPct:reducao,baseLegal:texto(p.baseLegal),observacao:texto(p.observacao),confirmadoPor:texto(usuario.nome||usuario.login),confirmadoEm:new Date().toISOString()};
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
