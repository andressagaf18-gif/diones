import { neon } from "@neondatabase/serverless";
import crypto from "crypto";
import { usuarioAutenticado } from "../api/lib/auth.js";

const sql = neon(process.env.DATABASE_URL);

let schemaPromise = null;

// =========================================================
// HELPERS
// =========================================================

function texto(valor, limite = 1000) {
  return String(valor ?? "")
    .trim()
    .slice(0, limite);
}

function numero(valor, padrao = 0) {
  const n = Number(valor);

  return Number.isFinite(n)
    ? n
    : padrao;
}

function somenteDigitos(valor = "") {
  return String(valor || "")
    .replace(/\D/g, "");
}

function gerarId(prefixo) {
  return `${prefixo}_${crypto.randomUUID()}`;
}

function autorizado(req) {
  return Boolean(
    usuarioAutenticado(req)
  );
}

async function consultaSegura(
  fn,
  fallback = []
) {
  try {
    return await fn();
  } catch (error) {
    console.warn(
      "[cliente360]",
      error?.message ||
      error
    );

    return fallback;
  }
}

// =========================================================
// SCHEMA
// =========================================================

async function prepararSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS
      crm_clientes (
        id TEXT PRIMARY KEY,
        cnpj TEXT NOT NULL UNIQUE,
        razao_social TEXT NOT NULL DEFAULT '',
        nome_fantasia TEXT NOT NULL DEFAULT '',
        regime_tributario TEXT NOT NULL DEFAULT '',
        segmento TEXT NOT NULL DEFAULT '',
        estrutura_negocio TEXT NOT NULL DEFAULT '',
        faturamento_faixa TEXT NOT NULL DEFAULT '',
        colaboradores_faixa TEXT NOT NULL DEFAULT '',
        origem_primeira TEXT NOT NULL DEFAULT '',
        origem_ultima TEXT NOT NULL DEFAULT '',
        contato_principal_nome TEXT NOT NULL DEFAULT '',
        contato_principal_email TEXT NOT NULL DEFAULT '',
        contato_principal_telefone TEXT NOT NULL DEFAULT '',
        responsavel_finder TEXT NOT NULL DEFAULT '',
        status_cliente TEXT NOT NULL DEFAULT 'PROSPECT',
        score_atual INTEGER NOT NULL DEFAULT 0,
        prioridade_atual TEXT NOT NULL DEFAULT '',
        temperatura_atual TEXT NOT NULL DEFAULT '',
        observacoes TEXT NOT NULL DEFAULT '',
        dados_extras JSONB NOT NULL DEFAULT '{}'::jsonb,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS
      idx_crm_clientes_razao
    ON crm_clientes (
      razao_social
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS
      idx_crm_clientes_atualizado
    ON crm_clientes (
      atualizado_em DESC
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS
      crm_cliente_contatos (
        id TEXT PRIMARY KEY,
        cliente_id TEXT NOT NULL,
        nome TEXT NOT NULL DEFAULT '',
        cargo TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        telefone TEXT NOT NULL DEFAULT '',
        principal BOOLEAN NOT NULL DEFAULT FALSE,
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        origem TEXT NOT NULL DEFAULT '',
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS
      idx_crm_cliente_contatos_cliente
    ON crm_cliente_contatos (
      cliente_id,
      principal DESC
    )
  `;
}

async function garantirSchema() {
  if (!schemaPromise) {
    schemaPromise =
      prepararSchema();
  }

  return schemaPromise;
}

// =========================================================
// SINCRONIZA CLIENTES A PARTIR DOS LEADS EXISTENTES
// =========================================================

async function sincronizarClientes() {
  const leads =
    await consultaSegura(
      () =>
        sql`
          SELECT
            id,
            cnpj,
            razao_social,
            nome,
            email,
            telefone,
            origem,
            campanha,
            estrutura_negocio,
            score_comercial,
            prioridade_comercial,
            temperatura_comercial,
            responsavel_finder,
            contexto_cliente,
            created_at,
            updated_at

          FROM
            diagnostico_leads

          WHERE
            COALESCE(
              cnpj,
              ''
            ) <> ''

          ORDER BY
            created_at ASC
        `,
      []
    );

  const porCnpj =
    new Map();

  for (
    const lead of
      leads || []
  ) {
    const cnpj =
      somenteDigitos(
        lead.cnpj
      );

    if (
      cnpj.length !== 14
    ) {
      continue;
    }

    const atual =
      porCnpj.get(cnpj);

    if (!atual) {
      porCnpj.set(
        cnpj,
        {
          primeiro:
            lead,

          ultimo:
            lead,
        }
      );

      continue;
    }

    atual.ultimo =
      lead;
  }

  for (
    const [
      cnpj,
      grupo,
    ] of
      porCnpj.entries()
  ) {
    const primeiro =
      grupo.primeiro ||
      {};

    const ultimo =
      grupo.ultimo ||
      {};

    const contexto =
      ultimo.contexto_cliente &&
      typeof ultimo.contexto_cliente ===
        "object"
        ? ultimo.contexto_cliente
        : {};

    const regime =
      texto(
        contexto?.regime ||
        contexto?.regimeTributario ||
        contexto?.empresa?.regime ||
        "",
        120
      );

    const segmento =
      texto(
        contexto?.segmento ||
        contexto?.empresa?.segmento ||
        "",
        160
      );

    const faturamento =
      texto(
        contexto?.faturamento ||
        contexto?.faixaFaturamento ||
        "",
        160
      );

    const colaboradores =
      texto(
        contexto?.colaboradores ||
        contexto?.faixaColaboradores ||
        "",
        160
      );

    const existentes =
      await sql`
        SELECT
          id
        FROM
          crm_clientes
        WHERE
          cnpj =
            ${cnpj}
        LIMIT 1
      `;

    if (
      existentes?.[0]?.id
    ) {
      await sql`
        UPDATE
          crm_clientes

        SET
          razao_social =
            COALESCE(
              NULLIF(
                ${texto(
                  ultimo.razao_social,
                  240
                )},
                ''
              ),
              razao_social
            ),

          estrutura_negocio =
            COALESCE(
              NULLIF(
                ${texto(
                  ultimo.estrutura_negocio,
                  100
                )},
                ''
              ),
              estrutura_negocio
            ),

          regime_tributario =
            COALESCE(
              NULLIF(
                ${regime},
                ''
              ),
              regime_tributario
            ),

          segmento =
            COALESCE(
              NULLIF(
                ${segmento},
                ''
              ),
              segmento
            ),

          faturamento_faixa =
            COALESCE(
              NULLIF(
                ${faturamento},
                ''
              ),
              faturamento_faixa
            ),

          colaboradores_faixa =
            COALESCE(
              NULLIF(
                ${colaboradores},
                ''
              ),
              colaboradores_faixa
            ),

          origem_ultima =
            COALESCE(
              NULLIF(
                ${texto(
                  ultimo.origem,
                  100
                )},
                ''
              ),
              origem_ultima
            ),

          contato_principal_nome =
            COALESCE(
              NULLIF(
                ${texto(
                  ultimo.nome,
                  180
                )},
                ''
              ),
              contato_principal_nome
            ),

          contato_principal_email =
            COALESCE(
              NULLIF(
                ${texto(
                  ultimo.email,
                  220
                )},
                ''
              ),
              contato_principal_email
            ),

          contato_principal_telefone =
            COALESCE(
              NULLIF(
                ${texto(
                  ultimo.telefone,
                  80
                )},
                ''
              ),
              contato_principal_telefone
            ),

          responsavel_finder =
            COALESCE(
              NULLIF(
                ${texto(
                  ultimo.responsavel_finder,
                  160
                )},
                ''
              ),
              responsavel_finder
            ),

          score_atual =
            GREATEST(
              0,
              ${Math.round(
                numero(
                  ultimo.score_comercial,
                  0
                )
              )}
            ),

          prioridade_atual =
            ${texto(
              ultimo.prioridade_comercial,
              30
            )},

          temperatura_atual =
            ${texto(
              ultimo.temperatura_comercial,
              30
            )},

          dados_extras =
            ${JSON.stringify({
              campanha:
                ultimo.campanha ||
                "",

              leadMaisRecente:
                ultimo.id ||
                "",
            })}::jsonb,

          atualizado_em =
            NOW()

        WHERE
          cnpj =
            ${cnpj}
      `;

      continue;
    }

    await sql`
      INSERT INTO
        crm_clientes (
          id,
          cnpj,
          razao_social,
          regime_tributario,
          segmento,
          estrutura_negocio,
          faturamento_faixa,
          colaboradores_faixa,
          origem_primeira,
          origem_ultima,
          contato_principal_nome,
          contato_principal_email,
          contato_principal_telefone,
          responsavel_finder,
          score_atual,
          prioridade_atual,
          temperatura_atual,
          dados_extras
        )

      VALUES (
        ${gerarId("cli")},
        ${cnpj},
        ${texto(
          ultimo.razao_social,
          240
        )},
        ${regime},
        ${segmento},
        ${texto(
          ultimo.estrutura_negocio,
          100
        )},
        ${faturamento},
        ${colaboradores},
        ${texto(
          primeiro.origem,
          100
        )},
        ${texto(
          ultimo.origem,
          100
        )},
        ${texto(
          ultimo.nome,
          180
        )},
        ${texto(
          ultimo.email,
          220
        )},
        ${texto(
          ultimo.telefone,
          80
        )},
        ${texto(
          ultimo.responsavel_finder,
          160
        )},
        ${Math.round(
          numero(
            ultimo.score_comercial,
            0
          )
        )},
        ${texto(
          ultimo.prioridade_comercial,
          30
        )},
        ${texto(
          ultimo.temperatura_comercial,
          30
        )},
        ${JSON.stringify({
          campanha:
            ultimo.campanha ||
            "",

          leadMaisRecente:
            ultimo.id ||
            "",
        })}::jsonb
      )
    `;
  }

  return {
    total:
      porCnpj.size,
  };
}

// =========================================================
// LISTAR CLIENTES
// =========================================================

async function listarClientes(
  req,
  res
) {
  if (!autorizado(req)) {
    return res
      .status(401)
      .json({
        sucesso: false,
        error:
          "Não autorizado.",
      });
  }

  await sincronizarClientes();

  const busca =
    texto(
      req.query?.busca,
      200
    );

  const limite =
    Math.min(
      500,
      Math.max(
        1,
        numero(
          req.query?.limite,
          200
        )
      )
    );

  const clientes =
    busca
      ? await sql`
          SELECT *
          FROM
            crm_clientes

          WHERE
            LOWER(
              razao_social
            ) LIKE
              ${`%${busca.toLowerCase()}%`}

            OR cnpj LIKE
              ${`%${somenteDigitos(
                busca
              )}%`}

            OR LOWER(
              contato_principal_nome
            ) LIKE
              ${`%${busca.toLowerCase()}%`}

            OR LOWER(
              origem_ultima
            ) LIKE
              ${`%${busca.toLowerCase()}%`}

          ORDER BY
            atualizado_em DESC

          LIMIT
            ${limite}
        `
      : await sql`
          SELECT *
          FROM
            crm_clientes

          ORDER BY
            atualizado_em DESC

          LIMIT
            ${limite}
        `;

  const contagens =
    await consultaSegura(
      () =>
        sql`
          SELECT
            c.cnpj,

            COUNT(
              DISTINCT l.id
            )::INTEGER
              AS leads,

            COUNT(
              DISTINCT a.id
            )::INTEGER
              AS atendimentos

          FROM
            crm_clientes c

          LEFT JOIN
            diagnostico_leads l
          ON
            REGEXP_REPLACE(
              COALESCE(
                l.cnpj,
                ''
              ),
              '[^0-9]',
              '',
              'g'
            ) =
            c.cnpj

          LEFT JOIN
            crm_atendimentos_departamento a
          ON
            a.lead_id =
              l.id

          GROUP BY
            c.cnpj
        `,
      []
    );

  const mapa =
    Object.fromEntries(
      (contagens || [])
        .map(
          (item) => [
            item.cnpj,
            item,
          ]
        )
    );

  return res
    .status(200)
    .json({
      sucesso: true,

      clientes:
        (clientes || [])
          .map(
            (c) => ({
              id:
                c.id,

              cnpj:
                c.cnpj,

              razaoSocial:
                c.razao_social,

              nomeFantasia:
                c.nome_fantasia,

              regimeTributario:
                c.regime_tributario,

              segmento:
                c.segmento,

              estruturaNegocio:
                c.estrutura_negocio,

              faturamentoFaixa:
                c.faturamento_faixa,

              colaboradoresFaixa:
                c.colaboradores_faixa,

              origemPrimeira:
                c.origem_primeira,

              origemUltima:
                c.origem_ultima,

              contatoNome:
                c.contato_principal_nome,

              contatoEmail:
                c.contato_principal_email,

              contatoTelefone:
                c.contato_principal_telefone,

              responsavelFinder:
                c.responsavel_finder,

              statusCliente:
                c.status_cliente,

              scoreAtual:
                numero(
                  c.score_atual
                ),

              prioridadeAtual:
                c.prioridade_atual,

              temperaturaAtual:
                c.temperatura_atual,

              totalLeads:
                numero(
                  mapa?.[
                    c.cnpj
                  ]?.leads
                ),

              totalAtendimentos:
                numero(
                  mapa?.[
                    c.cnpj
                  ]?.atendimentos
                ),

              atualizadoEm:
                c.atualizado_em,
            })
          ),
    });
}

// =========================================================
// CLIENTE 360
// =========================================================

async function verCliente(
  req,
  res
) {
  if (!autorizado(req)) {
    return res
      .status(401)
      .json({
        sucesso: false,
        error:
          "Não autorizado.",
      });
  }

  await sincronizarClientes();

  const clienteId =
    texto(
      req.query?.clienteId,
      160
    );

  const cnpjQuery =
    somenteDigitos(
      req.query?.cnpj
    );

  let clientes = [];

  if (clienteId) {
    clientes =
      await sql`
        SELECT *
        FROM
          crm_clientes
        WHERE
          id =
            ${clienteId}
        LIMIT 1
      `;
  } else if (
    cnpjQuery
  ) {
    clientes =
      await sql`
        SELECT *
        FROM
          crm_clientes
        WHERE
          cnpj =
            ${cnpjQuery}
        LIMIT 1
      `;
  }

  const cliente =
    clientes?.[0];

  if (!cliente) {
    return res
      .status(404)
      .json({
        sucesso: false,
        error:
          "Cliente não encontrado.",
      });
  }

  const cnpj =
    cliente.cnpj;

  const leads =
    await consultaSegura(
      () =>
        sql`
          SELECT *
          FROM
            diagnostico_leads

          WHERE
            REGEXP_REPLACE(
              COALESCE(
                cnpj,
                ''
              ),
              '[^0-9]',
              '',
              'g'
            ) =
            ${cnpj}

          ORDER BY
            created_at DESC
        `,
      []
    );

  const leadIds =
    (leads || [])
      .map(
        (lead) =>
          lead.id
      )
      .filter(Boolean);

  const diagnosticoIds =
    (leads || [])
      .map(
        (lead) =>
          lead.diagnostico_id
      )
      .filter(Boolean);

  const atendimentos =
    leadIds.length
      ? await consultaSegura(
          () =>
            sql`
              SELECT
                a.*,
                r.nome AS responsavel_nome

              FROM
                crm_atendimentos_departamento a

              LEFT JOIN
                crm_responsaveis r
              ON
                r.id =
                  a.responsavel_id

              WHERE
                a.lead_id =
                ANY(
                  ${leadIds}::text[]
                )

              ORDER BY
                a.updated_at DESC
            `,
          []
        )
      : [];

  const atendimentoIds =
    (atendimentos || [])
      .map(
        (a) =>
          a.id
      )
      .filter(Boolean);

  const propostas =
    atendimentoIds.length
      ? await consultaSegura(
          () =>
            sql`
              SELECT *
              FROM
                crm_propostas

              WHERE
                atendimento_id =
                ANY(
                  ${atendimentoIds}::text[]
                )

              ORDER BY
                criado_em DESC
            `,
          []
        )
      : [];

  const documentos =
    atendimentoIds.length
      ? await consultaSegura(
          () =>
            sql`
              SELECT
                id,
                lead_id,
                diagnostico_id,
                atendimento_id,
                nome_arquivo,
                tipo_documento,
                tamanho_bytes,
                status_analise,
                texto_extraido_chars,
                anexado_por_nome,
                criado_em

              FROM
                crm_documentos_cliente

              WHERE
                atendimento_id =
                ANY(
                  ${atendimentoIds}::text[]
                )

              ORDER BY
                criado_em DESC
            `,
          []
        )
      : [];

  const analises =
    atendimentoIds.length
      ? await consultaSegura(
          () =>
            sql`
              SELECT
                id,
                atendimento_id,
                resumo,
                achados,
                divergencias,
                riscos,
                pontos_validacao,
                oportunidades,
                dados_faltantes,
                confianca,
                criado_em

              FROM
                crm_analises_documentais

              WHERE
                atendimento_id =
                ANY(
                  ${atendimentoIds}::text[]
                )

              ORDER BY
                criado_em DESC

              LIMIT 20
            `,
          []
        )
      : [];

  const historico =
    atendimentoIds.length
      ? await consultaSegura(
          () =>
            sql`
              SELECT *
              FROM
                crm_atendimento_historico

              WHERE
                atendimento_id =
                ANY(
                  ${atendimentoIds}::text[]
                )

              ORDER BY
                criado_em DESC

              LIMIT 200
            `,
          []
        )
      : [];

  const diagnosticos =
    diagnosticoIds.length
      ? await consultaSegura(
          () =>
            sql`
              SELECT *
              FROM
                diagnosticos

              WHERE
                id =
                ANY(
                  ${diagnosticoIds}::text[]
                )

              ORDER BY
                criado_em DESC
            `,
          []
        )
      : [];

  const contatos =
    await consultaSegura(
      () =>
        sql`
          SELECT *
          FROM
            crm_cliente_contatos

          WHERE
            cliente_id =
              ${cliente.id}
            AND ativo =
              TRUE

          ORDER BY
            principal DESC,
            criado_em ASC
        `,
      []
    );

  const leadsAtivos =
    (leads || [])
      .filter(
        (lead) =>
          !lead.arquivado
      );

  const atendimentosAbertos =
    (atendimentos || [])
      .filter(
        (a) =>
          !a.arquivado &&
          String(
            a.status_atendimento ||
            ""
          ) !==
            "CONCLUIDO"
      );

  const propostasAbertas =
    (propostas || [])
      .filter(
        (p) =>
          [
            "RASCUNHO",
            "ENVIADA",
            "NEGOCIACAO",
          ].includes(
            String(
              p.status ||
              ""
            )
          )
      );

  const receitaGanha =
    (propostas || [])
      .filter(
        (p) =>
          String(
            p.status ||
            ""
          ) ===
            "GANHA"
      )
      .reduce(
        (
          soma,
          p
        ) =>
          soma +
          numero(
            p.valor_total,
            0
          ),
        0
      );

  const latestLead =
    leads?.[0] ||
    null;

  const latestAnalise =
    analises?.[0] ||
    null;

  const riscosConsolidados =
    [
      ...(
        Array.isArray(
          latestAnalise?.riscos
        )
          ? latestAnalise.riscos
          : []
      ),
    ].slice(
      0,
      10
    );

  const oportunidadesConsolidadas =
    [
      ...(
        Array.isArray(
          latestAnalise?.oportunidades
        )
          ? latestAnalise.oportunidades
          : []
      ),
    ].slice(
      0,
      10
    );

  return res
    .status(200)
    .json({
      sucesso: true,

      cliente: {
        id:
          cliente.id,

        cnpj:
          cliente.cnpj,

        razaoSocial:
          cliente.razao_social,

        nomeFantasia:
          cliente.nome_fantasia,

        regimeTributario:
          cliente.regime_tributario,

        segmento:
          cliente.segmento,

        estruturaNegocio:
          cliente.estrutura_negocio,

        faturamentoFaixa:
          cliente.faturamento_faixa,

        colaboradoresFaixa:
          cliente.colaboradores_faixa,

        origemPrimeira:
          cliente.origem_primeira,

        origemUltima:
          cliente.origem_ultima,

        contatoPrincipal: {
          nome:
            cliente.contato_principal_nome,

          email:
            cliente.contato_principal_email,

          telefone:
            cliente.contato_principal_telefone,
        },

        responsavelFinder:
          cliente.responsavel_finder,

        statusCliente:
          cliente.status_cliente,

        scoreAtual:
          numero(
            cliente.score_atual
          ),

        prioridadeAtual:
          cliente.prioridade_atual,

        temperaturaAtual:
          cliente.temperatura_atual,

        criadoEm:
          cliente.criado_em,

        atualizadoEm:
          cliente.atualizado_em,
      },

      resumo: {
        totalLeads:
          leadsAtivos.length,

        totalDiagnosticos:
          diagnosticos.length,

        atendimentosAbertos:
          atendimentosAbertos.length,

        totalDocumentos:
          documentos.length,

        totalAnalises:
          analises.length,

        propostasAbertas:
          propostasAbertas.length,

        receitaGanha,

        ultimoStatusComercial:
          latestLead
            ?.status_comercial ||
          "",

        ultimaIntencao:
          latestLead
            ?.intencao ||
          "",

        ultimaProximaAcao:
          latestLead
            ?.proxima_acao ||
          "",
      },

      inteligencia: {
        ultimaAnalise:
          latestAnalise
            ? {
                id:
                  latestAnalise.id,

                resumo:
                  latestAnalise.resumo,

                confianca:
                  latestAnalise.confianca,

                achados:
                  latestAnalise.achados ||
                  [],

                divergencias:
                  latestAnalise.divergencias ||
                  [],

                riscos:
                  latestAnalise.riscos ||
                  [],

                pontosValidacao:
                  latestAnalise.pontos_validacao ||
                  [],

                oportunidades:
                  latestAnalise.oportunidades ||
                  [],

                dadosFaltantes:
                  latestAnalise.dados_faltantes ||
                  [],

                criadoEm:
                  latestAnalise.criado_em,
              }
            : null,

        riscosConsolidados,

        oportunidadesConsolidadas,
      },

      contatos:
        (contatos || [])
          .map(
            (c) => ({
              id:
                c.id,

              nome:
                c.nome,

              cargo:
                c.cargo,

              email:
                c.email,

              telefone:
                c.telefone,

              principal:
                c.principal,
            })
          ),

      leads:
        (leads || [])
          .map(
            (l) => ({
              id:
                l.id,

              diagnosticoId:
                l.diagnostico_id,

              origem:
                l.origem,

              campanha:
                l.campanha,

              nome:
                l.nome,

              email:
                l.email,

              telefone:
                l.telefone,

              statusDiagnostico:
                l.status_diagnostico,

              statusComercial:
                l.status_comercial,

              scoreComercial:
                numero(
                  l.score_comercial
                ),

              prioridade:
                l.prioridade_comercial,

              temperatura:
                l.temperatura_comercial,

              intencao:
                l.intencao,

              proximaAcao:
                l.proxima_acao,

              criadoEm:
                l.created_at,

              atualizadoEm:
                l.updated_at,
            })
          ),

      diagnosticos:
        (diagnosticos || [])
          .map(
            (d) => ({
              id:
                d.id,

              razaoSocial:
                d.razao_social ||
                d.razaoSocial ||
                "",

              score:
                d.score_geral ??
                d.score ??
                null,

              nivel:
                d.nivel ||
                d.classificacao ||
                "",

              criadoEm:
                d.criado_em ||
                d.created_at ||
                null,
            })
          ),

      atendimentos:
        (atendimentos || [])
          .map(
            (a) => ({
              id:
                a.id,

              leadId:
                a.lead_id,

              diagnosticoId:
                a.diagnostico_id,

              area:
                a.area,

              scoreArea:
                a.score_area,

              nivelArea:
                a.nivel_area,

              statusAtendimento:
                a.status_atendimento,

              statusOportunidade:
                a.status_oportunidade,

              proximaAcao:
                a.proxima_acao,

              proximoContato:
                a.proximo_contato,

              responsavelId:
                a.responsavel_id,

              responsavelNome:
                a.responsavel_nome,

              atualizadoEm:
                a.updated_at,
            })
          ),

      documentos:
        (documentos || [])
          .map(
            (d) => ({
              id:
                d.id,

              atendimentoId:
                d.atendimento_id,

              nomeArquivo:
                d.nome_arquivo,

              tipoDocumento:
                d.tipo_documento,

              tamanhoBytes:
                d.tamanho_bytes,

              statusAnalise:
                d.status_analise,

              textoExtraidoChars:
                d.texto_extraido_chars,

              anexadoPor:
                d.anexado_por_nome,

              criadoEm:
                d.criado_em,
            })
          ),

      analises:
        (analises || [])
          .map(
            (a) => ({
              id:
                a.id,

              atendimentoId:
                a.atendimento_id,

              resumo:
                a.resumo,

              confianca:
                a.confianca,

              riscos:
                a.riscos ||
                [],

              oportunidades:
                a.oportunidades ||
                [],

              criadoEm:
                a.criado_em,
            })
          ),

      propostas:
        (propostas || [])
          .map(
            (p) => ({
              id:
                p.id,

              atendimentoId:
                p.atendimento_id,

              servico:
                p.servico,

              descricao:
                p.descricao,

              valorTotal:
                numero(
                  p.valor_total
                ),

              mensalidade:
                numero(
                  p.mensalidade
                ),

              taxaImplantacao:
                numero(
                  p.taxa_implantacao
                ),

              status:
                p.status,

              criadoEm:
                p.criado_em,
            })
          ),

      historico:
        (historico || [])
          .map(
            (h) => ({
              id:
                h.id,

              atendimentoId:
                h.atendimento_id,

              tipoEvento:
                h.tipo_evento,

              tipoAcionamento:
                h.tipo_acionamento,

              resultado:
                h.resultado,

              descricao:
                h.descricao,

              responsavelNome:
                h.responsavel_nome,

              criadoEm:
                h.criado_em,
            })
          ),
    });
}

// =========================================================
// CONTATOS
// =========================================================

async function salvarContato(
  req,
  res
) {
  const u =
    usuarioAutenticado(req);

  if (!u) {
    return res
      .status(401)
      .json({
        sucesso: false,
        error:
          "Não autorizado.",
      });
  }

  if (
    req.method !==
    "POST"
  ) {
    return res
      .status(405)
      .json({
        sucesso: false,
        error:
          "Método inválido.",
      });
  }

  const body =
    req.body ||
    {};

  const clienteId =
    texto(
      body.clienteId,
      160
    );

  const contatoId =
    texto(
      body.contatoId,
      160
    );

  const nome =
    texto(
      body.nome,
      180
    );

  const cargo =
    texto(
      body.cargo,
      160
    );

  const email =
    texto(
      body.email,
      220
    );

  const telefone =
    texto(
      body.telefone,
      80
    );

  const principal =
    body.principal ===
    true;

  if (
    !clienteId ||
    !nome
  ) {
    return res
      .status(400)
      .json({
        sucesso: false,
        error:
          "clienteId e nome são obrigatórios.",
      });
  }

  if (principal) {
    await sql`
      UPDATE
        crm_cliente_contatos
      SET
        principal =
          FALSE,
        atualizado_em =
          NOW()
      WHERE
        cliente_id =
          ${clienteId}
    `;
  }

  if (contatoId) {
    await sql`
      UPDATE
        crm_cliente_contatos
      SET
        nome =
          ${nome},
        cargo =
          ${cargo},
        email =
          ${email},
        telefone =
          ${telefone},
        principal =
          ${principal},
        atualizado_em =
          NOW()
      WHERE
        id =
          ${contatoId}
        AND cliente_id =
          ${clienteId}
    `;
  } else {
    await sql`
      INSERT INTO
        crm_cliente_contatos (
          id,
          cliente_id,
          nome,
          cargo,
          email,
          telefone,
          principal,
          origem
        )
      VALUES (
        ${gerarId("cont")},
        ${clienteId},
        ${nome},
        ${cargo},
        ${email},
        ${telefone},
        ${principal},
        'MANUAL'
      )
    `;
  }

  if (principal) {
    await sql`
      UPDATE
        crm_clientes
      SET
        contato_principal_nome =
          ${nome},
        contato_principal_email =
          ${email},
        contato_principal_telefone =
          ${telefone},
        atualizado_em =
          NOW()
      WHERE
        id =
          ${clienteId}
    `;
  }

  return res
    .status(200)
    .json({
      sucesso: true,
    });
}

// =========================================================
// HANDLER
// =========================================================

export default async function cliente360Handler(
  req,
  res
) {
  try {
    if (
      !process.env
        .DATABASE_URL
    ) {
      return res
        .status(500)
        .json({
          sucesso: false,
          error:
            "DATABASE_URL não configurada.",
        });
    }

    await garantirSchema();

    const action =
      texto(
        req.query?.action,
        80
      ).toLowerCase();

    switch (action) {
      case "sincronizar-clientes":
        if (
          !autorizado(req)
        ) {
          return res
            .status(401)
            .json({
              sucesso: false,
              error:
                "Não autorizado.",
            });
        }

        return res
          .status(200)
          .json({
            sucesso: true,
            ...(
              await sincronizarClientes()
            ),
          });

      case "listar-clientes":
        return listarClientes(
          req,
          res
        );

      case "ver-cliente":
        return verCliente(
          req,
          res
        );

      case "salvar-contato":
        return salvarContato(
          req,
          res
        );

      default:
        return res
          .status(400)
          .json({
            sucesso: false,
            error:
              "Ação Cliente 360 inválida.",
          });
    }
  } catch (error) {
    console.error(
      "[cliente360]",
      error
    );

    return res
      .status(500)
      .json({
        sucesso: false,
        error:
          error?.message ||
          "Não foi possível processar o Cliente 360.",
      });
  }
}
