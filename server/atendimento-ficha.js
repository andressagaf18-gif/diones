// server/atendimento-ficha.js
// Atendimento por área — FICHA DA ÁREA e PLANO 30/60/90 DA ÁREA.
//
// Liga cada atendimento (crm_atendimentos_departamento) ao diagnóstico de
// origem, por área, trazendo: a nota da área, as respostas do cliente nela, a
// leitura consultiva daquela área (api/diagnosticos → consultivo-*), as
// hipóteses a validar, as perguntas da reunião e o plano 30/60/90 com status
// por ação.
//
// Fica em server/ (e é roteado por api/crm.js) para NÃO consumir uma função
// serverless — o plano da Vercel limita a 12.
//
// O que o especialista marca aqui (hipóteses, perguntas feitas, documentos,
// status das ações) é interno: o cliente nunca vê.

import { neon } from "@neondatabase/serverless";
import crypto from "node:crypto";
import { usuarioAutenticado } from "./auth.js";
import { registrarEventoSistema } from "./auditoria.js";

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

export const STATUS_ACAO = ["A_FAZER", "EM_ANDAMENTO", "CONCLUIDA", "BLOQUEADA"];
export const ROTULO_STATUS_ACAO = {
  A_FAZER: "A fazer",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  BLOQUEADA: "Bloqueada",
};
const RESULTADOS_HIPOTESE = ["CONFIRMADA", "REFUTADA"]; // "em aberto" = sem registro
const MAX_ACOES = 60;
const MAX_DOCUMENTOS = 30;
const MAX_DESCARTADAS = 150;

// ---------------------------------------------------------
// UTILITÁRIOS PUROS
// ---------------------------------------------------------
export function canon(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function txt(valor, limite = 500) {
  if (valor === null || valor === undefined) return "";
  return String(valor).trim().slice(0, limite);
}

function lista(v) {
  return Array.isArray(v) ? v : [];
}

function objeto(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

export function chaveTexto(valor) {
  return crypto.createHash("sha1").update(canon(valor)).digest("hex").slice(0, 12);
}

export function idAcao(prazo, acao) {
  return chaveTexto(`${prazo}|${acao}`);
}

function prazoValido(valor) {
  const n = Number(String(valor ?? "").match(/\d+/)?.[0]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n <= 45 ? 30 : n <= 75 ? 60 : 90;
}

function dataValida(valor) {
  const t = txt(valor, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return "";
  const d = new Date(`${t}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t ? "" : t;
}

// Acha, na análise consultiva, a área que corresponde à área do atendimento.
// Compara por id e por nome sem acento/caixa; só aceita parecido (um contém o
// outro) quando há UMA única candidata — na dúvida, não casa.
export function casarAreaConsultiva(areaAtendimento, areas) {
  const alvo = canon(areaAtendimento);
  if (!alvo) return null;
  const itens = lista(areas);

  const exato =
    itens.find((a) => canon(a?.eixoId) === alvo) ||
    itens.find((a) => canon(a?.label) === alvo);
  if (exato) return exato;

  const parecidas = itens.filter((a) =>
    [canon(a?.eixoId), canon(a?.label)].some(
      (c) => c.length >= 4 && alvo.length >= 4 && (c.includes(alvo) || alvo.includes(c))
    )
  );
  return parecidas.length === 1 ? parecidas[0] : null;
}

export function respostasDaArea(linhas, areaAtendimento, eixoId) {
  const alvo = canon(areaAtendimento);
  const eixo = canon(eixoId);
  return lista(linhas)
    .filter((r) => {
      const id = canon(r?.areaId);
      const nome = canon(r?.area);
      return (eixo && id === eixo) || (alvo && (nome === alvo || id === alvo));
    })
    .map((r) => ({
      pergunta: txt(r?.pergunta || r?.texto, 320),
      resposta: txt(r?.resposta ?? r?.valor, 80),
      detalhe: txt(r?.detalheResposta || r?.detalhe, 700),
      importancia: Number.isFinite(Number(r?.importancia)) && Number(r?.importancia) > 0 ? Number(r.importancia) : null,
      risco: txt(r?.riscoAvaliado || r?.risco, 40),
    }))
    .filter((r) => r.pergunta && r.pergunta !== "-")
    .slice(0, 80);
}

export function classeResposta(resposta) {
  const r = canon(resposta);
  if (!r) return "neutra";
  if (r.startsWith("naosei")) return "lacuna";
  if (r === "na" || r.startsWith("naoseaplica") || r.startsWith("naoaplic")) return "neutra";
  if (r.startsWith("nao")) return "negativa";
  if (r.startsWith("parc")) return "parcial";
  if (r.startsWith("sim")) return "positiva";
  return "neutra";
}

// ---------------------------------------------------------
// PLANO DA ÁREA
// ---------------------------------------------------------
export function acoesDoConsultivo(plano, eixoId) {
  const alvo = canon(eixoId);
  if (!alvo) return [];
  return lista(plano)
    .map((p) => ({ p, prazo: prazoValido(p?.prazo) }))
    .filter(({ p, prazo }) => prazo && txt(p?.acao, 500) && canon(p?.areaId) === alvo)
    .map(({ p, prazo }) => ({
      id: idAcao(prazo, txt(p.acao, 500)),
      origem: "CONSULTIVO",
      prazo,
      acao: txt(p.acao, 500),
      objetivo: txt(p.objetivo, 300),
      evidenciaEsperada: txt(p.evidenciaEsperada, 300),
      dependencia: txt(p.dependencia, 300),
      indicadorSucesso: txt(p.indicadorSucesso, 300),
      responsavel: txt(p.responsavelSugerido, 80),
      data: "",
      status: "A_FAZER",
      motivoBloqueio: "",
      concluidaEm: "",
      atualizadoEm: "",
      obsoleta: false,
    }));
}

// Vista do plano: o que já foi salvo (autoridade) + ações novas da análise
// atual que ainda não estão salvas e não foram descartadas. Uma ação salva
// nunca some sozinha: se a análise mudou, ela fica marcada como "obsoleta".
export function mesclarAcoes(salvas, doConsultivo, { temAnalise = false, descartadas = [] } = {}) {
  const idsAtuais = new Set(doConsultivo.map((a) => a.id));
  const idsSalvos = new Set(lista(salvas).map((a) => a?.id));
  const fora = new Set(lista(descartadas));

  const baseSalvas = lista(salvas).map((a) => ({
    ...a,
    obsoleta: Boolean(temAnalise && a.origem === "CONSULTIVO" && !idsAtuais.has(a.id)),
  }));
  const novas = doConsultivo.filter((a) => !idsSalvos.has(a.id) && !fora.has(a.id));

  return [...baseSalvas, ...novas]
    .map((a, i) => ({ a, i }))
    .sort((x, y) => x.a.prazo - y.a.prazo || x.i - y.i)
    .map(({ a }) => a);
}

export function progressoAcoes(acoes) {
  const vivas = lista(acoes).filter((a) => !a.obsoleta);
  const conta = (s) => vivas.filter((a) => a.status === s).length;
  const total = vivas.length;
  const concluidas = conta("CONCLUIDA");
  return {
    total,
    concluidas,
    emAndamento: conta("EM_ANDAMENTO"),
    bloqueadas: conta("BLOQUEADA"),
    aFazer: conta("A_FAZER"),
    percentual: total ? Math.round((concluidas / total) * 100) : 0,
  };
}

// Aceita a lista enviada pela tela, mas só deixa o cliente da API mudar o que
// é do especialista (status, data, responsável, motivo de bloqueio). O texto
// das ações vindas da análise consultiva é sempre o do servidor.
export function normalizarAcoesEntrada(entrada, vistaAnterior, agora = new Date().toISOString()) {
  const anteriores = new Map(lista(vistaAnterior).map((a) => [a.id, a]));
  const usados = new Set();
  const saida = [];

  for (const bruto of lista(entrada).slice(0, MAX_ACOES)) {
    const b = objeto(bruto);
    const idInformado = txt(b.id, 40);
    const anterior = idInformado ? anteriores.get(idInformado) : null;
    const status = STATUS_ACAO.includes(txt(b.status, 20).toUpperCase()) ? txt(b.status, 20).toUpperCase() : anterior?.status || "A_FAZER";

    let base;
    if (anterior) {
      base = { ...anterior };
      if (anterior.origem === "MANUAL") {
        base.acao = txt(b.acao, 500) || anterior.acao;
        base.prazo = prazoValido(b.prazo) || anterior.prazo;
        base.objetivo = txt(b.objetivo, 300);
        base.evidenciaEsperada = txt(b.evidenciaEsperada, 300);
        base.dependencia = txt(b.dependencia, 300);
        base.indicadorSucesso = txt(b.indicadorSucesso, 300);
      }
    } else {
      const acao = txt(b.acao, 500);
      const prazo = prazoValido(b.prazo);
      if (!acao || !prazo) continue; // ação nova sem texto ou prazo não entra
      base = {
        id: `m_${crypto.randomBytes(5).toString("hex")}`,
        origem: "MANUAL",
        prazo,
        acao,
        objetivo: txt(b.objetivo, 300),
        evidenciaEsperada: txt(b.evidenciaEsperada, 300),
        dependencia: txt(b.dependencia, 300),
        indicadorSucesso: txt(b.indicadorSucesso, 300),
        concluidaEm: "",
        atualizadoEm: "",
      };
    }
    if (usados.has(base.id)) continue;
    usados.add(base.id);

    const mudouStatus = !anterior || anterior.status !== status;
    saida.push({
      ...base,
      responsavel: txt(b.responsavel ?? anterior?.responsavel, 80),
      data: b.data !== undefined ? dataValida(b.data) : anterior?.data || "",
      status,
      motivoBloqueio: status === "BLOQUEADA" ? txt(b.motivoBloqueio ?? anterior?.motivoBloqueio, 300) : "",
      concluidaEm: status === "CONCLUIDA" ? (anterior?.status === "CONCLUIDA" && anterior.concluidaEm ? anterior.concluidaEm : agora) : "",
      atualizadoEm: mudouStatus || !anterior ? agora : anterior.atualizadoEm || "",
      obsoleta: false,
    });
  }
  return saida;
}

export function eventosDoPlano(vistaAnterior, novas) {
  const antes = new Map(lista(vistaAnterior).map((a) => [a.id, a]));
  const depois = new Map(lista(novas).map((a) => [a.id, a]));
  const eventos = [];

  for (const a of novas) {
    const ant = antes.get(a.id);
    if (!ant) {
      eventos.push({ resultado: "Ação adicionada", descricao: `Ação adicionada ao plano de ${a.prazo} dias: “${a.acao}”.`, de: "", para: a.status });
    } else if (ant.status !== a.status) {
      eventos.push({
        resultado: `Ação ${ROTULO_STATUS_ACAO[a.status].toLowerCase()}`,
        descricao: `Plano de ${a.prazo} dias: “${a.acao}” passou de ${ROTULO_STATUS_ACAO[ant.status]} para ${ROTULO_STATUS_ACAO[a.status]}${a.status === "BLOQUEADA" && a.motivoBloqueio ? ` (${a.motivoBloqueio})` : ""}.`,
        de: ant.status,
        para: a.status,
      });
    } else if (a.status === "BLOQUEADA" && a.motivoBloqueio && a.motivoBloqueio !== ant.motivoBloqueio) {
      // O motivo costuma ser digitado depois de marcar "Bloqueada": registra também.
      eventos.push({
        resultado: "Motivo do bloqueio",
        descricao: `Plano de ${a.prazo} dias: “${a.acao}” está bloqueada — ${a.motivoBloqueio}.`,
        de: ant.status,
        para: a.status,
      });
    }
  }
  for (const ant of lista(vistaAnterior)) {
    if (!depois.has(ant.id)) {
      eventos.push({ resultado: "Ação removida", descricao: `Ação removida do plano de ${ant.prazo} dias: “${ant.acao}”.`, de: ant.status, para: "" });
    }
  }
  return eventos.slice(0, 20);
}

// ---------------------------------------------------------
// FICHA (hipóteses, perguntas, documentos)
// ---------------------------------------------------------
export function documentosDaVista(fichaSalva, roteiro) {
  if (Array.isArray(fichaSalva?.documentos)) {
    return fichaSalva.documentos
      .map((d) => ({ nome: txt(d?.nome, 200), status: txt(d?.status, 12).toUpperCase() === "RECEBIDO" ? "RECEBIDO" : "PENDENTE" }))
      .filter((d) => d.nome)
      .slice(0, MAX_DOCUMENTOS);
  }
  return lista(roteiro?.documentosPedir)
    .map((n) => ({ nome: txt(n, 200), status: "PENDENTE" }))
    .filter((d) => d.nome)
    .slice(0, MAX_DOCUMENTOS);
}

export function aplicarFicha(fichaAtual, entrada) {
  const atual = objeto(fichaAtual);
  const e = objeto(entrada);
  const novo = {
    hipoteses: { ...objeto(atual.hipoteses) },
    perguntas: { ...objeto(atual.perguntas) },
    descartadas: lista(atual.descartadas),
  };
  if (Array.isArray(atual.documentos)) novo.documentos = atual.documentos;

  if (e.hipoteses && typeof e.hipoteses === "object") {
    for (const [chave, valor] of Object.entries(e.hipoteses).slice(0, 40)) {
      if (!/^[a-f0-9]{12}$/.test(chave)) continue;
      const v = txt(valor, 12).toUpperCase();
      if (RESULTADOS_HIPOTESE.includes(v)) novo.hipoteses[chave] = v;
      else delete novo.hipoteses[chave]; // "em aberto"
    }
  }
  if (e.perguntas && typeof e.perguntas === "object") {
    for (const [chave, valor] of Object.entries(e.perguntas).slice(0, 60)) {
      if (!/^[a-f0-9]{12}$/.test(chave)) continue;
      if (valor === true) novo.perguntas[chave] = true;
      else delete novo.perguntas[chave];
    }
  }
  if (Array.isArray(e.documentos)) {
    novo.documentos = e.documentos
      .map((d) => ({ nome: txt(d?.nome, 200), status: txt(d?.status, 12).toUpperCase() === "RECEBIDO" ? "RECEBIDO" : "PENDENTE" }))
      .filter((d) => d.nome)
      .slice(0, MAX_DOCUMENTOS);
  }
  return novo;
}

// ---------------------------------------------------------
// MONTAGEM DA RESPOSTA
// ---------------------------------------------------------
export function montarFicha({ atendimento, diagnostico, ficha, plano }) {
  const fichaSalva = objeto(ficha);
  const analise = objeto(objeto(diagnostico?.visao_consultiva).atual);
  const conteudo = objeto(analise.conteudo);
  const temAnalise = Boolean(analise.conteudo);

  const areaCons = temAnalise ? casarAreaConsultiva(atendimento.area, conteudo.areas) : null;
  const eixoId = areaCons?.eixoId || "";

  const hipSalvas = objeto(fichaSalva.hipoteses);
  const perSalvas = objeto(fichaSalva.perguntas);

  const area = areaCons
    ? {
        eixoId,
        label: areaCons.label,
        profundidade: areaCons.profundidade,
        leituraConsultor: areaCons.leituraConsultor || "",
        hipoteses: lista(areaCons.hipoteses).map((h) => {
          const chave = chaveTexto(h.hipotese);
          return { chave, hipotese: h.hipotese, comoValidar: h.comoValidar || "", resultado: hipSalvas[chave] || "ABERTA" };
        }),
        perguntasReuniao: lista(areaCons.perguntasReuniao).map((p) => {
          const chave = chaveTexto(p);
          return { chave, texto: p, feita: perSalvas[chave] === true };
        }),
        caminhos: lista(areaCons.caminhos),
        recomendacaoPrincipal: objeto(areaCons.recomendacaoPrincipal),
        naoAssumir: lista(areaCons.naoAssumir),
        evidencias: lista(areaCons.evidencias),
      }
    : null;

  const acoesConsultivo = eixoId ? acoesDoConsultivo(conteudo.planoDetalhado, eixoId) : [];
  const acoes = mesclarAcoes(lista(plano), acoesConsultivo, { temAnalise: Boolean(areaCons), descartadas: fichaSalva.descartadas });

  const roteiro = objeto(conteudo.roteiroReuniao);

  return {
    atendimento: {
      id: atendimento.id,
      diagnosticoId: atendimento.diagnostico_id,
      area: atendimento.area,
      scoreArea: atendimento.score_area ?? null,
      nivelArea: atendimento.nivel_area || "",
      statusAtendimento: atendimento.status_atendimento || "",
      proximaAcao: atendimento.proxima_acao || "",
      proximoContato: atendimento.proximo_contato || null,
      ultimoAcionamento: atendimento.ultimo_acionamento || null,
    },
    empresa: txt(diagnostico?.razao_social, 200),
    consultivo: {
      disponivel: temAnalise,
      areaEncontrada: Boolean(areaCons),
      versao: temAnalise ? Number(analise.versao || 0) : null,
      geradoEm: temAnalise ? analise.geradoEm || null : null,
      area,
      roteiro: temAnalise
        ? { abertura: txt(roteiro.abertura, 700), objecoes: lista(roteiro.objecoesProvaveis) }
        : null,
    },
    respostas: respostasDaArea(diagnostico?.perguntas_respostas, atendimento.area, eixoId),
    ficha: {
      documentos: documentosDaVista(fichaSalva, roteiro),
    },
    acoes,
    progresso: progressoAcoes(acoes),
  };
}

// ---------------------------------------------------------
// BANCO
// ---------------------------------------------------------
let colunasPromise = null;

function garantirColunas() {
  if (!colunasPromise) {
    colunasPromise = (async () => {
      await sql`
        ALTER TABLE crm_atendimentos_departamento
        ADD COLUMN IF NOT EXISTS ficha_area JSONB NOT NULL DEFAULT '{}'::jsonb
      `;
      await sql`
        ALTER TABLE crm_atendimentos_departamento
        ADD COLUMN IF NOT EXISTS plano_execucao JSONB NOT NULL DEFAULT '[]'::jsonb
      `;
      await sql`
        ALTER TABLE diagnosticos
        ADD COLUMN IF NOT EXISTS visao_consultiva JSONB
      `;
    })().catch((erro) => {
      colunasPromise = null; // tenta de novo na próxima chamada
      throw erro;
    });
  }
  return colunasPromise;
}

async function carregar(atendimentoId) {
  await garantirColunas();
  const linhas = await sql`
    SELECT id, diagnostico_id, lead_id, area, score_area, nivel_area, status_atendimento,
           proxima_acao, proximo_contato, ultimo_acionamento, ficha_area, plano_execucao
    FROM crm_atendimentos_departamento
    WHERE id = ${atendimentoId}
    LIMIT 1
  `;
  const atendimento = linhas?.[0];
  if (!atendimento) return null;

  const diag = await sql`
    SELECT razao_social, perguntas_respostas, visao_consultiva
    FROM diagnosticos
    WHERE id::text = ${atendimento.diagnostico_id}
    LIMIT 1
  `;
  return { atendimento, diagnostico: diag?.[0] || null };
}

function enviar(res, status, corpo) {
  return res.status(status).json(corpo);
}

// ---------------------------------------------------------
// ROTAS
// ---------------------------------------------------------
async function obterInterno(req, res) {
  if (!usuarioAutenticado(req)) return enviar(res, 401, { sucesso: false, error: "Não autorizado." });
  if (!sql) return enviar(res, 500, { sucesso: false, error: "DATABASE_URL não configurada." });

  const id = txt(req.query?.atendimentoId, 180);
  if (!id) return enviar(res, 400, { sucesso: false, error: "atendimentoId é obrigatório." });

  const dados = await carregar(id);
  if (!dados) return enviar(res, 404, { sucesso: false, error: "Atendimento não encontrado." });

  return enviar(res, 200, {
    sucesso: true,
    ...montarFicha({
      atendimento: dados.atendimento,
      diagnostico: dados.diagnostico,
      ficha: dados.atendimento.ficha_area,
      plano: dados.atendimento.plano_execucao,
    }),
  });
}

// Quantas vezes relê e refaz a gravação quando outra pessoa altera o mesmo atendimento ao mesmo tempo.
const MAX_TENTATIVAS_GRAVACAO = 8;

const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function salvarInterno(req, res) {
  const usuario = usuarioAutenticado(req);
  if (!usuario) return enviar(res, 401, { sucesso: false, error: "Não autorizado." });
  if (!sql) return enviar(res, 500, { sucesso: false, error: "DATABASE_URL não configurada." });

  const body = objeto(req.body);
  const id = txt(body.atendimentoId, 180);
  if (!id) return enviar(res, 400, { sucesso: false, error: "atendimentoId é obrigatório." });
  if (body.acoes !== undefined && !Array.isArray(body.acoes)) {
    return enviar(res, 400, { sucesso: false, error: "O plano deve ser uma lista de ações." });
  }

  // Ler -> calcular -> gravar só vale se a linha NÃO mudou desde a leitura. Sem isso, duas
  // gravações próximas (dois cliques rápidos, duas pessoas) se atropelam e uma marcação some.
  // Se mudou, relê e refaz sobre o estado novo. As marcações da ficha são pontuais e se
  // somam; já o plano chega como lista inteira, então se outra pessoa o alterou no meio
  // avisamos (409) em vez de apagar a alteração dela.
  let planoDaPrimeiraLeitura = null;

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_GRAVACAO; tentativa += 1) {
    const dados = await carregar(id);
    if (!dados) return enviar(res, 404, { sucesso: false, error: "Atendimento não encontrado." });

    const { atendimento, diagnostico } = dados;
    const fichaLida = atendimento.ficha_area ?? {};
    const planoLido = atendimento.plano_execucao ?? [];

    const planoSerializado = JSON.stringify(planoLido);
    if (planoDaPrimeiraLeitura === null) {
      planoDaPrimeiraLeitura = planoSerializado;
    } else if (body.acoes !== undefined && planoSerializado !== planoDaPrimeiraLeitura) {
      return enviar(res, 409, {
        sucesso: false,
        error: "O plano foi alterado por outra pessoa enquanto você salvava. Os dados foram recarregados; refaça a alteração.",
      });
    }

    const antes = montarFicha({ atendimento, diagnostico, ficha: atendimento.ficha_area, plano: atendimento.plano_execucao });

    let ficha = aplicarFicha(atendimento.ficha_area, body);
    let planoGravado = lista(atendimento.plano_execucao);
    let eventos = [];

    if (body.acoes !== undefined) {
      const novas = normalizarAcoesEntrada(body.acoes, antes.acoes);
      eventos = eventosDoPlano(antes.acoes, novas);

      // Ação da análise que o especialista removeu não deve reaparecer.
      const idsNovos = new Set(novas.map((a) => a.id));
      const removidasDaAnalise = antes.acoes.filter((a) => a.origem === "CONSULTIVO" && !idsNovos.has(a.id)).map((a) => a.id);
      ficha.descartadas = [...new Set([...lista(ficha.descartadas), ...removidasDaAnalise])].slice(-MAX_DESCARTADAS);
      planoGravado = novas;
    }

    const gravado = await sql`
      UPDATE crm_atendimentos_departamento
      SET ficha_area = ${JSON.stringify(ficha)}::jsonb,
          plano_execucao = ${JSON.stringify(planoGravado)}::jsonb,
          updated_at = NOW()
      WHERE id = ${id}
        AND COALESCE(ficha_area, '{}'::jsonb) = ${JSON.stringify(fichaLida)}::jsonb
        AND COALESCE(plano_execucao, '[]'::jsonb) = ${planoSerializado}::jsonb
      RETURNING id
    `;

    if (!gravado.length) {
      // alguém gravou no meio: espera um instante (aleatório, para não colidir de novo em sincronia), relê e refaz
      await espera(10 + Math.floor(Math.random() * 50));
      continue;
    }

    const nomeUsuario = txt(usuario?.nome || usuario?.login || "Usuário", 160);
    for (const ev of eventos) {
      await sql`
        INSERT INTO crm_atendimento_historico (
          id, atendimento_id, diagnostico_id, lead_id, tipo_evento, tipo_acionamento,
          resultado, descricao, status_anterior, status_novo, responsavel_id, responsavel_nome
        )
        VALUES (
          ${crypto.randomUUID()}, ${id}, ${atendimento.diagnostico_id || ""}, ${atendimento.lead_id || ""},
          'PLANO_AREA', 'Plano da área', ${ev.resultado}, ${ev.descricao}, ${ev.de}, ${ev.para},
          ${txt(usuario?.sub, 140)}, ${nomeUsuario}
        )
      `;
    }

    if (eventos.length) {
      try {
        await registrarEventoSistema(req, usuario, {
          acao: "plano_area_atualizado",
          modulo: "crm",
          recurso: "atendimento",
          recursoId: id,
          descricao: `${atendimento.area} — ${eventos.length} alteração(ões) no plano 30/60/90.`,
        });
      } catch (erro) {
        console.warn("[atendimento-ficha] auditoria indisponível:", erro?.message || erro);
      }
    }

    const atualizado = await carregar(id);
    return enviar(res, 200, {
      sucesso: true,
      ...montarFicha({
        atendimento: atualizado.atendimento,
        diagnostico: atualizado.diagnostico,
        ficha: atualizado.atendimento.ficha_area,
        plano: atualizado.atendimento.plano_execucao,
      }),
    });
  }

  return enviar(res, 409, {
    sucesso: false,
    error: "Este atendimento está sendo alterado por outras pessoas neste momento. Tente novamente em instantes.",
  });
}

async function protegido(fn, req, res) {
  try {
    return await fn(req, res);
  } catch (erro) {
    console.error("[atendimento-ficha]", erro);
    return enviar(res, 500, { sucesso: false, error: "Erro interno ao processar a ficha da área." });
  }
}

export const fichaAreaObter = (req, res) => protegido(obterInterno, req, res);
export const fichaAreaSalvar = (req, res) => protegido(salvarInterno, req, res);
