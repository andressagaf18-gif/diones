// server/diagnostico-consultivo-api.js
// Finder — análise consultiva INTERNA de um diagnóstico já salvo.
//
// Fica em server/ (e não em api/) para NÃO consumir uma função serverless: o
// plano da Vercel limita a 12 funções. É servida por api/diagnosticos.js, nas
// ações "consultivo-obter" (GET) e "consultivo-gerar" (POST).
//
// Fica separada do diagnóstico do cliente de propósito: o cliente recebe o
// resultado sem esperar por esta análise (que é mais longa), e a
// administração gera quando quiser, com orientação adicional, mantendo as
// versões anteriores. Exige sessão autenticada.

import { neon } from "@neondatabase/serverless";
import { exigirAutenticacao } from "./auth.js";
import { registrarSaudeModulo, MODULOS_SAUDE } from "./system-health.js";
import { registrarEventoSistema } from "./auditoria.js";
import { obterMotor, normalizarEstrutura } from "./diagnostic-engine.js";
import {
  contratoConsultivo,
  instrucoesConsultivas,
  normalizarVisaoConsultiva,
  visaoConsultivaUtil,
  limparCodigoInternoRelatorio,
} from "./diagnostic-consultivo.js";

const sql = neon(process.env.DATABASE_URL);

const OPENAI_URL = "https://api.openai.com/v1/responses";
const TEMPO_LIMITE_MS = 110_000;
const INTERVALO_MIN_MS = 15_000;
const MAX_VERSOES_ANTERIORES = 4;
const MAX_RESPOSTAS = 140;

let colunaPronta = null;

function texto(valor, limite = 500) {
  return String(valor ?? "").trim().slice(0, limite);
}

function objeto(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function lista(v) {
  return Array.isArray(v) ? v : [];
}

function garantirColuna() {
  if (!colunaPronta) {
    colunaPronta = sql`
      ALTER TABLE diagnosticos
      ADD COLUMN IF NOT EXISTS visao_consultiva JSONB
    `.catch((erro) => {
      colunaPronta = null; // permite nova tentativa na próxima chamada
      throw erro;
    });
  }
  return colunaPronta;
}

function enviar(res, status, corpo) {
  return res.status(status).json(corpo);
}

// ---------------------------------------------------------
// CONTEXTO PARA A IA
// Só o necessário para a análise: sem e-mail, telefone ou CNPJ.
// ---------------------------------------------------------
function estruturaDoRegistro(completo, resultado) {
  const perfil = objeto(completo.perfil);
  return normalizarEstrutura(
    perfil.estruturaNegocio ||
      resultado?.contextoEstrutura?.estruturaNegocio ||
      resultado?.estrutura ||
      completo.estruturaNegocio ||
      "operacional"
  );
}

function eixosDoResultado(resultado, motor) {
  const ids = lista(resultado?.eixos)
    .map((e) => texto(e?.id, 80))
    .filter((id) => motor.eixos.includes(id));
  return ids.length ? [...new Set(ids)] : motor.eixos;
}

function enxugarEixo(e) {
  return {
    id: texto(e?.id, 80),
    label: texto(e?.label, 120),
    score: e?.score ?? null,
    nivel: texto(e?.nivel, 40),
    confianca: texto(e?.confianca, 20),
    achados: lista(e?.achados).slice(0, 6).map((x) => texto(typeof x === "string" ? x : x?.texto, 300)),
    riscos: lista(e?.riscos).slice(0, 6).map((x) => texto(typeof x === "string" ? x : x?.texto, 300)),
    pontosFortes: lista(e?.pontosFortes).slice(0, 4).map((x) => texto(typeof x === "string" ? x : x?.texto, 300)),
    recomendacoes: lista(e?.recomendacoes).slice(0, 5).map((x) => texto(typeof x === "string" ? x : x?.texto, 300)),
  };
}

function enxugarRespostas(perguntasRespostas) {
  return lista(perguntasRespostas)
    .slice(0, MAX_RESPOSTAS)
    .map((r) => ({
      area: texto(r?.area || r?.areaLabel || r?.areaId, 80),
      pergunta: texto(r?.pergunta || r?.texto, 260),
      resposta: texto(r?.resposta ?? r?.valor, 60),
      detalhe: texto(r?.detalheResposta || r?.detalhe || r?.observacao, 300),
      importancia: Number.isFinite(Number(r?.importancia)) && Number(r?.importancia) > 0 ? Number(r.importancia) : undefined,
      risco: texto(r?.riscoAvaliado || r?.risco, 40) || undefined,
    }))
    .filter((r) => r.pergunta && r.resposta);
}

function cortarJson(valor, limite = 5000) {
  try {
    const s = JSON.stringify(valor);
    return s.length > limite ? s.slice(0, limite) + "…" : s;
  } catch {
    return "";
  }
}

// Resumo enxuto do Simulador da Reforma para a IA: só números e premissas,
// sem nome, e-mail, telefone ou CNPJ.
function numeroOuNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function resumirSimulacaoReforma(snap) {
  const s = objeto(snap);
  if (!Object.keys(objeto(s.resultado)).length && !Object.keys(objeto(s.configuracao)).length) return null;
  const emp = objeto(s.empresa);
  const cfg = objeto(s.configuracao);
  const res = objeto(s.resultado);
  const mem = objeto(s.memoria);
  const cred = objeto(s.creditos);
  const dec = objeto(s.decisao);
  const campos = (o, chaves) =>
    Object.fromEntries(chaves.map((k) => [k, numeroOuNull(o[k])]).filter(([, v]) => v !== null));
  return {
    origem: "Simulador público da Reforma Tributária (sem questionário de respostas)",
    empresa: {
      porte: texto(emp.porte, 60),
      municipio: texto(emp.municipio, 80),
      uf: texto(emp.uf, 4),
      atividadePrincipal: texto(emp.atividadeSelecionada, 200),
      atividadeDeFato: texto(emp.descricaoAtividadeReal, 500),
    },
    premissas: {
      regime: texto(cfg.regime, 60),
      natureza: texto(cfg.natureza, 40),
      perfilClientes: texto(cfg.perfilClientes, 40),
      cenarioAno: texto(cfg.cenarioAliquota, 10),
      tratamento: texto(cfg.tratamentoIbsCbs, 40),
      enquadramentoConfirmado: cfg.tratamentoConfirmado === true,
      baseLegal: texto(cfg.classificacaoFiscal, 400),
      cargaAtualInformada: cfg.naoSeiImpostoAtual === true ? false : true,
      ...campos(cfg, ["faturamentoMensal", "cbsPct", "ibsPct", "reducaoCbsPct", "reducaoIbsPct", "cbsEfetivaPct", "ibsEfetivaPct", "ivaEfetivoPct", "rbt12", "fs12", "aliquotaLocalAtualPct", "crescimentoPct", "participacaoAtividadePrincipalPct"]),
      atividadesAdicionais: lista(cfg.atividadesAdicionais).slice(0, 6).map((a) => ({
        cnae: texto(a?.cnae, 12),
        descricao: texto(a?.descricao, 200),
        participacaoPct: numeroOuNull(a?.participacaoPct),
        reducaoPct: numeroOuNull(a?.reducaoPct),
        confirmada: a?.confirmada === true,
      })),
      composicaoCargaAtual: campos(objeto(cfg.composicaoCargaAtual), ["pis", "cofins", "icms", "iss", "ipi", "cpp", "irpj", "adicionalIrpj", "csll", "outros"]),
    },
    resultadoMensal: {
      ...campos(res, ["atual", "reforma", "diferenca", "variacaoPct", "cargaAtualPct", "cargaReformaPct"]),
      comparacaoPermitida: res.comparacaoPermitida !== false,
      motivoPendencia: texto(res.motivoPendencia, 300),
    },
    memoriaCalculoMensal: campos(mem, ["faturamento", "baseIbsCbs", "debitoCbs", "creditoCbs", "cbsLiquida", "debitoIbs", "creditoIbs", "ibsLiquido", "ibsCbsLiquido", "pisCofinsRemanescentes", "icmsIssRemanescentes", "ipiRemanescente", "tributosMantidos", "dasResidual", "totalReforma"]),
    creditos: campos(cred, ["despesasMensais", "creditoAtual", "creditoNovo", "baseCreditosConfirmados"]),
    transicao: lista(s.transicao).slice(0, 10).map((t) => ({
      ano: numeroOuNull(t?.ano),
      totalMensal: numeroOuNull(t?.total),
      ibsCbsMensal: numeroOuNull(t?.iva),
      situacao: texto(t?.status, 120),
    })),
    conclusaoDoMotor: {
      titulo: texto(dec.titulo, 200),
      destaque: texto(dec.destaque, 300),
      confianca: texto(dec.confianca, 20),
      justificativas: lista(dec.justificativas).slice(0, 5).map((x) => texto(x, 250)),
      pendencias: lista(dec.pendencias).slice(0, 6).map((x) => texto(x, 250)),
    },
  };
}

export function montarContexto(row, estrutura, eixosEscopo) {
  const completo = objeto(row.dados_completos);
  const resultado = Object.keys(objeto(completo.resultado)).length ? objeto(completo.resultado) : objeto(row.diagnostico);
  const perfil = objeto(completo.perfil);
  const empresa = objeto(completo.empresa);

  const especificos = {};
  for (const chave of ["holding", "spe", "grupo", "pessoaFisica", "abertura", "reformaTributaria", "terceiroSetor"]) {
    const v = perfil[chave];
    if (v && typeof v === "object" && Object.keys(v).length) especificos[chave] = cortarJson(v);
  }

  return {
    empresa: {
      razaoSocial: texto(empresa.razao || empresa.razaoSocial || row.razao_social, 200),
      segmento: texto(empresa.segmento || row.segmento, 120),
      categoria: texto(empresa.categoria, 120),
    },
    perfil: {
      descricaoNegocio: texto(perfil.descricaoNegocio || row.descricao_negocio, 1200),
      dorPrincipal: texto(perfil.dorPrincipal, 400),
      dor90Dias: texto(perfil.dor90Dias, 400),
      doresSelecionadas: lista(perfil.doresSelecionadas).slice(0, 10).map((d) => texto(d, 160)),
      impactosSelecionados: lista(perfil.impactosSelecionados).slice(0, 8).map((d) => texto(d, 160)),
      regime: texto(perfil.regime, 80),
      colaboradores: texto(perfil.colaboradores, 40),
      ...especificos,
    },
    diagnosticoDoCliente: {
      scoreGeral: resultado.scoreGeral ?? row.score ?? null,
      nivelGeral: texto(resultado.nivelGeral, 60),
      confiancaDiagnostico: texto(resultado.confiancaDiagnostico, 20),
      leituraExecutiva: texto(resultado.leituraExecutiva, 1500),
      eixos: lista(resultado.eixos)
        .filter((e) => eixosEscopo.includes(texto(e?.id, 80)))
        .map(enxugarEixo),
      informacoesFaltantes: lista(resultado.informacoesFaltantes).slice(0, 10).map((x) => texto(x, 250)),
      pontosParaValidacao: lista(resultado.pontosParaValidacao).slice(0, 8).map((x) => texto(x, 250)),
      qualidadeRespostas: objeto(resultado.qualidadeRespostas),
    },
    respostas: enxugarRespostas(row.perguntas_respostas),
    simulacaoReforma: resumirSimulacaoReforma(
      perfil.simuladorReforma || resultado?.contextoEstrutura?.simuladorReforma || resultado?.simuladorReforma
    ),
  };
}

function montarPrompt({ estrutura, eixosEscopo, contexto, instrucaoExtra }) {
  const motor = obterMotor(estrutura);
  return `Você é o consultor sênior da Finder of Solutions preparando a leitura interna de um diagnóstico para a equipe.

${instrucoesConsultivas(estrutura, eixosEscopo)}

FOCO DO CASO: ${motor.foco.join("; ")}

CONTRATO DE SAÍDA OBRIGATÓRIO (preencha com conteúdo real; os valores de exemplo mostram apenas o formato):
${JSON.stringify(contratoConsultivo(estrutura, eixosEscopo), null, 2)}

DADOS DO DIAGNÓSTICO (fonte única de fatos):
${JSON.stringify(contexto, null, 2)}
${contexto.simulacaoReforma ? `\nATENÇÃO — ESTE CASO VEM DO SIMULADOR DA REFORMA, NÃO DE UM QUESTIONÁRIO: "simulacaoReforma" traz premissas, memória de cálculo mensal, créditos e transição. Os números desse bloco são fatos estruturados e podem ser citados; não invente nenhum outro valor. Em "fatosInformados" use as premissas e resultados da simulação. As áreas devem refletir o resultado (impacto da carga, créditos, regime, preços, transição). Diga com franqueza o que sustenta o resultado e o que ainda é premissa (por exemplo: crédito zero porque nenhuma despesa foi informada; carga atual estimada; enquadramento não confirmado). Proponha caminhos comparáveis (créditos, regime, preços) sem prometer economia.\n` : ""}${instrucaoExtra ? `\nORIENTAÇÃO ADICIONAL DO CONSULTOR (siga sem violar as regras acima):\n${instrucaoExtra}\n` : ""}
Lembrete final: aprofunde no máximo 4 áreas, mantenha cada campo conciso e retorne SOMENTE o JSON.`;
}

function extrairTexto(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  for (const item of lista(data?.output)) {
    if (item?.type !== "message") continue;
    for (const c of lista(item.content)) {
      if (c?.type === "output_text" && c.text) return String(c.text).trim();
    }
  }
  return "";
}

function limparJson(t) {
  return String(t || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

async function chamarIA(prompt) {
  const resposta = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_CONSULTIVO_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini",
      input: prompt,
      text: { format: { type: "json_object" } },
    }),
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });

  const data = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    console.error("[diagnostico-consultivo] OpenAI:", data?.error || data);
    throw Object.assign(new Error("A IA não conseguiu gerar a análise agora."), { status: 502 });
  }

  const bruto = extrairTexto(data);
  if (!bruto) throw Object.assign(new Error("A IA não retornou conteúdo."), { status: 502 });

  try {
    return { ia: JSON.parse(limparJson(bruto)), uso: data?.usage || null, modelo: data?.model || "" };
  } catch {
    console.error("[diagnostico-consultivo] JSON inválido:", bruto.slice(0, 600));
    throw Object.assign(new Error("A IA devolveu uma resposta fora do formato. Tente novamente."), { status: 502 });
  }
}

// ---------------------------------------------------------
// OBTER
// ---------------------------------------------------------
function resumoVersao(v) {
  return {
    versao: Number(v?.versao || 0),
    geradoEm: v?.geradoEm || null,
    geradoPor: v?.geradoPor?.nome || "",
    instrucaoExtra: texto(v?.instrucaoExtra, 600),
  };
}

async function obterInterno(req, res) {
  const usuario = exigirAutenticacao(req, res);
  if (!usuario) return;

  const id = texto(req.query?.id, 100);
  if (!id) return enviar(res, 400, { sucesso: false, error: "Informe o ID do diagnóstico." });

  await garantirColuna();
  const rows = await sql`SELECT id, visao_consultiva FROM diagnosticos WHERE id::text = ${id} LIMIT 1`;
  const row = rows?.[0];
  if (!row) return enviar(res, 404, { sucesso: false, error: "Diagnóstico não encontrado." });

  const guardado = objeto(row.visao_consultiva);
  const atual = objeto(guardado.atual);
  const anteriores = lista(guardado.anteriores);

  if (!atual.conteudo) {
    return enviar(res, 200, { sucesso: true, existe: false, atual: null, versoes: [] });
  }

  const pedida = Number(req.query?.versao || 0);
  let escolhida = atual;
  if (pedida && pedida !== Number(atual.versao)) {
    escolhida = anteriores.find((v) => Number(v?.versao) === pedida) || null;
    if (!escolhida) return enviar(res, 404, { sucesso: false, error: "Versão não encontrada." });
  }

  return enviar(res, 200, {
    sucesso: true,
    existe: true,
    versaoAtual: Number(atual.versao),
    exibindo: { ...resumoVersao(escolhida), conteudo: escolhida.conteudo },
    versoes: [atual, ...anteriores].map(resumoVersao),
  });
}

// ---------------------------------------------------------
// GERAR
// ---------------------------------------------------------
async function gerarInterno(req, res) {
  const usuario = exigirAutenticacao(req, res);
  if (!usuario) return;

  if (!process.env.OPENAI_API_KEY) {
    return enviar(res, 500, { sucesso: false, error: "OPENAI_API_KEY não configurada." });
  }

  const body = objeto(req.body);
  const id = texto(body.id, 100);
  const instrucaoExtra = limparCodigoInternoRelatorio(texto(body.instrucaoExtra, 1200));
  if (!id) return enviar(res, 400, { sucesso: false, error: "Informe o ID do diagnóstico." });

  await garantirColuna();
  const rows = await sql`
    SELECT id, razao_social, segmento, descricao_negocio, score, perguntas_respostas,
           diagnostico, dados_completos, visao_consultiva
    FROM diagnosticos WHERE id::text = ${id} LIMIT 1
  `;
  const row = rows?.[0];
  if (!row) return enviar(res, 404, { sucesso: false, error: "Diagnóstico não encontrado." });

  const guardado = objeto(row.visao_consultiva);
  const anterior = objeto(guardado.atual);

  if (anterior.geradoEm && Date.now() - new Date(anterior.geradoEm).getTime() < INTERVALO_MIN_MS) {
    return enviar(res, 429, { sucesso: false, error: "Uma análise acabou de ser gerada. Aguarde alguns segundos antes de gerar outra." });
  }

  const completo = objeto(row.dados_completos);
  const resultado = Object.keys(objeto(completo.resultado)).length ? objeto(completo.resultado) : objeto(row.diagnostico);
  const estrutura = estruturaDoRegistro(completo, resultado);
  const motor = obterMotor(estrutura);
  const eixosEscopo = eixosDoResultado(resultado, motor);
  const contexto = montarContexto(row, estrutura, eixosEscopo);

  if (!contexto.respostas.length && !contexto.diagnosticoDoCliente.eixos.length && !contexto.simulacaoReforma) {
    return enviar(res, 422, {
      sucesso: false,
      error: "Este diagnóstico não tem respostas nem resultado suficientes para uma análise consultiva.",
    });
  }

  const inicio = Date.now();
  let saida;
  try {
    saida = await chamarIA(montarPrompt({ estrutura, eixosEscopo, contexto, instrucaoExtra }));
  } catch (erro) {
    const tempoEsgotado = erro?.name === "TimeoutError" || erro?.name === "AbortError";
    if (MODULOS_SAUDE.CONSULTIVO_IA) {
      registrarSaudeModulo({
        modulo: MODULOS_SAUDE.CONSULTIVO_IA,
        status: "ERRO",
        duracaoMs: Date.now() - inicio,
        mensagemErro: String(erro?.message || erro),
      }).catch(() => {});
    }
    if (tempoEsgotado) {
      return enviar(res, 504, { sucesso: false, error: "A IA demorou mais que o limite. Tente novamente ou use uma orientação mais curta." });
    }
    return enviar(res, erro?.status || 500, { sucesso: false, error: erro?.message || "Não foi possível gerar a análise." });
  }

  const conteudo = normalizarVisaoConsultiva(saida.ia, estrutura, eixosEscopo);
  if (!visaoConsultivaUtil(conteudo)) {
    return enviar(res, 502, { sucesso: false, error: "A IA não devolveu uma análise utilizável. Tente novamente." });
  }

  const nova = {
    versao: Number(anterior.versao || 0) + 1,
    geradoEm: new Date().toISOString(),
    geradoPor: { id: texto(usuario?.sub, 100), nome: texto(usuario?.nome || usuario?.login || "Usuário", 160) },
    modelo: texto(saida.modelo, 80),
    instrucaoExtra,
    conteudo,
  };
  const anteriores = [anterior.conteudo ? anterior : null, ...lista(guardado.anteriores)]
    .filter(Boolean)
    .slice(0, MAX_VERSOES_ANTERIORES);

  await sql`
    UPDATE diagnosticos
    SET visao_consultiva = ${JSON.stringify({ atual: nova, anteriores })}::jsonb
    WHERE id::text = ${id}
  `;

  if (MODULOS_SAUDE.CONSULTIVO_IA) {
    registrarSaudeModulo({
      modulo: MODULOS_SAUDE.CONSULTIVO_IA,
      status: "OK",
      duracaoMs: Date.now() - inicio,
    }).catch(() => {});
  }

  await registrarEventoSistema(req, usuario, {
    acao: "consultivo_gerado",
    modulo: "diagnostico",
    recurso: "diagnostico",
    recursoId: id,
    descricao: `${contexto.empresa.razaoSocial || "Diagnóstico"} — análise consultiva v${nova.versao} gerada.`,
    depois: { versao: nova.versao, estrutura },
  });

  return enviar(res, 200, {
    sucesso: true,
    existe: true,
    versaoAtual: nova.versao,
    exibindo: { ...resumoVersao(nova), conteudo },
    versoes: [nova, ...anteriores].map(resumoVersao),
    uso: saida.uso,
  });
}

async function protegido(fn, req, res) {
  try {
    return await fn(req, res);
  } catch (erro) {
    console.error("[diagnostico-consultivo]", erro);
    return enviar(res, 500, { sucesso: false, error: "Erro interno ao processar a análise consultiva." });
  }
}

export const consultivoObter = (req, res) => protegido(obterInterno, req, res);
export const consultivoGerar = (req, res) => protegido(gerarInterno, req, res);
