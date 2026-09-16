import { neon } from "@neondatabase/serverless";
import { usuarioAutenticado } from "./auth.js";

const sql = process.env.DATABASE_URL
  ? neon(process.env.DATABASE_URL)
  : null;

let schemaPromise = null;

// =========================================================
// MÓDULOS MONITORADOS
// Qualquer arquivo do backend pode importar registrarSaudeModulo()
// e chamar depois de uma operação-chave (IA, sincronização externa,
// envio de e-mail, consulta a serviço externo...) para alimentar o
// painel "Saúde do sistema" da Auditoria.
// =========================================================

export const MODULOS_SAUDE = {
  DIAGNOSTICO_IA: "Diagnóstico (IA)",
  TRIBUTARIO_IA: "Inteligência Tributária (IA)",
  ASAAS_SYNC: "Sincronização Asaas",
  ENVIO_RELATORIO: "Envio de relatório/e-mail",
  CONSULTA_CNPJ: "Consulta CNPJ",
};

function texto(valor, limite = 2000) {
  return String(valor ?? "").trim().slice(0, limite);
}

function autorizado(req) {
  return Boolean(usuarioAutenticado(req));
}

async function garantirSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS
          system_health_eventos (
            id BIGSERIAL PRIMARY KEY,
            modulo TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'OK',
            duracao_ms INTEGER NOT NULL DEFAULT 0,
            mensagem_erro TEXT NOT NULL DEFAULT '',
            criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS
          idx_system_health_modulo_data
        ON system_health_eventos (
          modulo,
          criado_em DESC
        )
      `;

      // Mantém a tabela enxuta — só interessa histórico recente para
      // calcular médias e status; auditoria completa de negócio já
      // existe em outra tabela (acessos_auditoria).
      await sql`
        DELETE FROM system_health_eventos
        WHERE criado_em < NOW() - INTERVAL '30 days'
      `.catch(() => null);
    })();
  }
  return schemaPromise;
}

// =========================================================
// REGISTRO DE EVENTOS (chamado pelos outros módulos do backend)
// Nunca lança erro — se a gravação falhar, só loga no console e
// segue, para nunca quebrar o fluxo principal por causa disso.
// =========================================================

export async function registrarSaudeModulo({
  modulo,
  status = "OK",
  duracaoMs = 0,
  mensagemErro = "",
}) {
  if (!sql || !modulo) return;
  try {
    await garantirSchema();
    await sql`
      INSERT INTO system_health_eventos
        (modulo, status, duracao_ms, mensagem_erro)
      VALUES
        (${texto(modulo, 120)}, ${status === "ERRO" ? "ERRO" : "OK"}, ${Math.max(0, Math.round(duracaoMs || 0))}, ${texto(mensagemErro, 500)})
    `;
  } catch (error) {
    console.warn("[system-health] falha ao registrar evento:", error?.message || error);
  }
}

// =========================================================
// ARMAZENAMENTO
// =========================================================

async function consultarArmazenamento(req, res) {
  if (!autorizado(req)) {
    return res.status(401).json({ sucesso: false, error: "Não autorizado." });
  }
  if (!sql) {
    return res.status(500).json({ sucesso: false, error: "DATABASE_URL não configurada." });
  }

  try {
    const [{ bytes: tamanhoBanco }] = await sql`
      SELECT pg_database_size(current_database()) AS bytes
    `;

    const maioresTabelas = await sql`
      SELECT
        relname AS tabela,
        pg_total_relation_size(relid) AS bytes,
        n_live_tup AS linhas
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 8
    `;

    const [blobCliente360] = await sql`
      SELECT COUNT(*) AS total, COALESCE(SUM(tamanho_bytes),0) AS bytes
      FROM crm_documentos_cliente
    `.catch(() => [{ total: 0, bytes: 0 }]);

    const [documentosTributario] = await sql`
      SELECT COUNT(*) AS total, COALESCE(SUM(bytes),0) AS bytes
      FROM tax_documents
      WHERE ativo
    `.catch(() => [{ total: 0, bytes: 0 }]);

    return res.status(200).json({
      sucesso: true,
      bancoBytes: Number(tamanhoBanco || 0),
      maioresTabelas: maioresTabelas.map((t) => ({
        tabela: t.tabela,
        bytes: Number(t.bytes || 0),
        linhas: Number(t.linhas || 0),
      })),
      blobClientes: {
        totalArquivos: Number(blobCliente360?.total || 0),
        bytes: Number(blobCliente360?.bytes || 0),
      },
      documentosTributarioNoBanco: {
        totalArquivos: Number(documentosTributario?.total || 0),
        bytes: Number(documentosTributario?.bytes || 0),
      },
    });
  } catch (error) {
    console.error("[system-health] armazenamento:", error);
    return res.status(500).json({ sucesso: false, error: error?.message || "Erro ao consultar armazenamento." });
  }
}

// =========================================================
// SAÚDE POR MÓDULO + ALERTAS
// =========================================================

async function consultarSaudeModulos(req, res) {
  if (!autorizado(req)) {
    return res.status(401).json({ sucesso: false, error: "Não autorizado." });
  }
  if (!sql) {
    return res.status(500).json({ sucesso: false, error: "DATABASE_URL não configurada." });
  }

  try {
    await garantirSchema();

    const eventos = await sql`
      SELECT modulo, status, duracao_ms, mensagem_erro, criado_em
      FROM system_health_eventos
      WHERE criado_em > NOW() - INTERVAL '30 days'
      ORDER BY criado_em DESC
      LIMIT 600
    `;

    const porModulo = {};
    for (const nome of Object.values(MODULOS_SAUDE)) {
      porModulo[nome] = [];
    }
    for (const ev of eventos) {
      if (!porModulo[ev.modulo]) porModulo[ev.modulo] = [];
      porModulo[ev.modulo].push(ev);
    }

    const modulos = [];
    const alertas = [];

    for (const nome of Object.values(MODULOS_SAUDE)) {
      const lista = porModulo[nome] || [];
      const ultimo = lista[0] || null;
      const amostra = lista.slice(0, 20);
      const duracoes = amostra.filter((e) => e.status === "OK").map((e) => Number(e.duracao_ms || 0));
      const mediaMs = duracoes.length ? Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length) : null;
      const errosRecentes = amostra.filter((e) => e.status === "ERRO").length;

      let statusGeral = "SEM_DADOS";
      if (lista.length) {
        statusGeral = ultimo.status === "ERRO" ? "ERRO" : "OK";
        if (statusGeral === "OK" && mediaMs && Number(ultimo.duracao_ms || 0) > mediaMs * 2.5 && duracoes.length >= 5) {
          statusGeral = "LENTO";
        }
      }

      modulos.push({
        modulo: nome,
        status: statusGeral,
        ultimaExecucao: ultimo?.criado_em || null,
        ultimaDuracaoMs: ultimo ? Number(ultimo.duracao_ms || 0) : null,
        mediaDuracaoMs: mediaMs,
        errosUltimasVinte: errosRecentes,
        totalEventos30d: lista.length,
      });

      if (statusGeral === "ERRO") {
        alertas.push({
          nivel: "erro",
          modulo: nome,
          mensagem: `${nome} falhou na última execução${ultimo?.mensagem_erro ? ": " + ultimo.mensagem_erro : "."}`,
          quando: ultimo?.criado_em || null,
        });
      } else if (statusGeral === "LENTO") {
        alertas.push({
          nivel: "atencao",
          modulo: nome,
          mensagem: `${nome} está demorando mais que o normal (${Number(ultimo.duracao_ms || 0).toLocaleString("pt-BR")}ms, média é ${mediaMs.toLocaleString("pt-BR")}ms).`,
          quando: ultimo?.criado_em || null,
        });
      } else if (errosRecentes >= 3) {
        alertas.push({
          nivel: "atencao",
          modulo: nome,
          mensagem: `${nome} teve ${errosRecentes} falhas nas últimas 20 execuções.`,
          quando: ultimo?.criado_em || null,
        });
      }
    }

    return res.status(200).json({ sucesso: true, modulos, alertas });
  } catch (error) {
    console.error("[system-health] saude-modulos:", error);
    return res.status(500).json({ sucesso: false, error: error?.message || "Erro ao consultar saúde dos módulos." });
  }
}

export default async function systemHealthHandler(req, res) {
  try {
    const action = texto(req.query?.action, 60).toLowerCase();

    switch (action) {
      case "saude-armazenamento":
        return consultarArmazenamento(req, res);
      case "saude-modulos":
        return consultarSaudeModulos(req, res);
      default:
        return res.status(400).json({ sucesso: false, error: "Ação de saúde do sistema inválida." });
    }
  } catch (error) {
    console.error("[system-health]", error);
    return res.status(500).json({ sucesso: false, error: error?.message || "Não foi possível processar." });
  }
}
