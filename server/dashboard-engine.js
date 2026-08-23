import { neon } from "@neondatabase/serverless";
import { usuarioAutenticado } from "../api/lib/auth.js";

const sql = neon(process.env.DATABASE_URL);

// =========================================================
// HELPERS
// =========================================================

function numero(valor, padrao = 0) {
  const n = Number(valor);

  return Number.isFinite(n)
    ? n
    : padrao;
}

function autorizado(req) {
  return Boolean(
    usuarioAutenticado(req)
  );
}

async function consultaSegura(fn, fallback) {
  try {
    return await fn();
  } catch (error) {
    console.warn(
      "[dashboard-engine]",
      error?.message || error
    );

    return fallback;
  }
}

// =========================================================
// DASHBOARD
// =========================================================

export default async function dashboardHandler(
  req,
  res
) {
  if (req.method !== "GET") {
    res.setHeader(
      "Allow",
      "GET"
    );

    return res
      .status(405)
      .json({
        sucesso: false,
        error:
          "Método não permitido.",
      });
  }

  if (!autorizado(req)) {
    return res
      .status(401)
      .json({
        sucesso: false,
        error:
          "Não autorizado.",
      });
  }

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

  try {
    // =====================================================
    // 1. RESUMO GERAL
    // =====================================================

    const resumoRows =
      await consultaSegura(
        () =>
          sql`
            SELECT
              COUNT(*) FILTER (
                WHERE COALESCE(
                  arquivado,
                  FALSE
                ) = FALSE
              )::INTEGER
                AS total_leads,

              COUNT(*) FILTER (
                WHERE
                  COALESCE(
                    arquivado,
                    FALSE
                  ) = FALSE
                  AND (
                    status_diagnostico =
                      'CONCLUIDO'
                    OR diagnostico_id
                      <> ''
                  )
              )::INTEGER
                AS diagnosticos,

              COUNT(*) FILTER (
                WHERE
                  COALESCE(
                    arquivado,
                    FALSE
                  ) = FALSE
                  AND (
                    prioridade_comercial
                      IN ('A','B')
                    OR score_comercial
                      >= 60
                    OR status_comercial
                      IN (
                        'REUNIAO_AGENDADA',
                        'PROPOSTA_ENVIADA',
                        'CONVERTIDO'
                      )
                  )
              )::INTEGER
                AS oportunidades,

              COUNT(*) FILTER (
                WHERE
                  COALESCE(
                    arquivado,
                    FALSE
                  ) = FALSE
                  AND (
                    prioridade_comercial =
                      'A'
                    OR score_comercial
                      >= 80
                  )
              )::INTEGER
                AS criticos,

              COUNT(*) FILTER (
                WHERE
                  COALESCE(
                    arquivado,
                    FALSE
                  ) = FALSE
                  AND (
                    estrutura_negocio =
                      'reforma_tributaria'
                    OR LOWER(
                      COALESCE(
                        contexto_cliente::text,
                        ''
                      )
                    ) LIKE
                      '%reforma%'
                    OR LOWER(
                      COALESCE(
                        intencao,
                        ''
                      )
                    ) LIKE
                      '%reforma tribut%'
                    OR LOWER(
                      COALESCE(
                        intencao,
                        ''
                      )
                    ) LIKE
                      '%ibs%'
                    OR LOWER(
                      COALESCE(
                        intencao,
                        ''
                      )
                    ) LIKE
                      '%cbs%'
                  )
              )::INTEGER
                AS reforma_tributaria

            FROM
              diagnostico_leads
          `,
        []
      );

    const resumoLead =
      resumoRows?.[0] ||
      {};

    // =====================================================
    // 2. ATENDIMENTOS ABERTOS
    // =====================================================

    const atendimentoRows =
      await consultaSegura(
        () =>
          sql`
            SELECT
              COUNT(*)::INTEGER
                AS total
            FROM
              crm_atendimentos_departamento
            WHERE
              COALESCE(
                arquivado,
                FALSE
              ) = FALSE
              AND COALESCE(
                status_atendimento,
                'NAO_INICIADO'
              ) <> 'CONCLUIDO'
          `,
        []
      );

    // =====================================================
    // 3. PROPOSTAS E CONVERSÕES
    // =====================================================

    const propostaRows =
      await consultaSegura(
        () =>
          sql`
            SELECT
              COUNT(
                DISTINCT lead_id
              ) FILTER (
                WHERE status IN (
                  'RASCUNHO',
                  'ENVIADA',
                  'NEGOCIACAO',
                  'GANHA'
                )
              )::INTEGER
                AS propostas,

              COUNT(
                DISTINCT lead_id
              ) FILTER (
                WHERE status =
                  'GANHA'
              )::INTEGER
                AS ganhos,

              COALESCE(
                SUM(
                  valor_total
                ) FILTER (
                  WHERE status =
                    'GANHA'
                ),
                0
              )::NUMERIC
                AS valor_ganho,

              COALESCE(
                SUM(
                  mensalidade
                ) FILTER (
                  WHERE status =
                    'GANHA'
                ),
                0
              )::NUMERIC
                AS mrr_ganho,

              COALESCE(
                SUM(
                  taxa_implantacao
                ) FILTER (
                  WHERE status =
                    'GANHA'
                ),
                0
              )::NUMERIC
                AS implantacao_ganha

            FROM
              crm_propostas
          `,
        []
      );

    const resumoProposta =
      propostaRows?.[0] ||
      {};

    const convertidoLeadRows =
      await consultaSegura(
        () =>
          sql`
            SELECT
              COUNT(*)::INTEGER
                AS total
            FROM
              diagnostico_leads
            WHERE
              COALESCE(
                arquivado,
                FALSE
              ) = FALSE
              AND status_comercial =
                'CONVERTIDO'
          `,
        []
      );

    const convertidos =
      Math.max(
        numero(
          resumoProposta
            ?.ganhos
        ),
        numero(
          convertidoLeadRows
            ?.[0]
            ?.total
        )
      );

    // =====================================================
    // 4. ORIGENS
    // =====================================================

    const origens =
      await consultaSegura(
        () =>
          sql`
            SELECT
              COALESCE(
                NULLIF(
                  LOWER(
                    TRIM(
                      l.origem
                    )
                  ),
                  ''
                ),
                'direto'
              )
                AS origem,

              COUNT(
                DISTINCT l.id
              )::INTEGER
                AS total,

              COUNT(
                DISTINCT l.id
              ) FILTER (
                WHERE
                  l.prioridade_comercial
                    IN ('A','B')
                  OR l.score_comercial
                    >= 60
                  OR l.status_comercial
                    IN (
                      'REUNIAO_AGENDADA',
                      'PROPOSTA_ENVIADA',
                      'CONVERTIDO'
                    )
              )::INTEGER
                AS qualificados,

              COUNT(
                DISTINCT p.lead_id
              ) FILTER (
                WHERE
                  p.status IN (
                    'RASCUNHO',
                    'ENVIADA',
                    'NEGOCIACAO',
                    'GANHA'
                  )
              )::INTEGER
                AS propostas,

              COUNT(
                DISTINCT p.lead_id
              ) FILTER (
                WHERE
                  p.status =
                    'GANHA'
              )::INTEGER
                AS convertidos

            FROM
              diagnostico_leads l

            LEFT JOIN
              crm_propostas p
            ON
              p.lead_id = l.id

            WHERE
              COALESCE(
                l.arquivado,
                FALSE
              ) = FALSE

            GROUP BY
              1

            ORDER BY
              total DESC,
              origem ASC
          `,
        []
      );

    // =====================================================
    // 5. LEADS RECENTES / PRIORITÁRIOS
    // =====================================================

    const leads =
      await consultaSegura(
        () =>
          sql`
            SELECT
              id,
              diagnostico_id,
              origem,
              campanha,
              promoter,
              nome,
              email,
              telefone,
              cnpj,
              razao_social,
              status_diagnostico,
              status_comercial,
              estrutura_negocio,
              score_comercial,
              prioridade_comercial,
              temperatura_comercial,
              proxima_acao,
              prazo_atendimento,
              responsavel_finder,
              primeiro_acesso,
              ultima_atividade,
              created_at,
              updated_at

            FROM
              diagnostico_leads

            WHERE
              COALESCE(
                arquivado,
                FALSE
              ) = FALSE

            ORDER BY
              CASE
                WHEN prioridade_comercial =
                  'A'
                  THEN 1
                WHEN prioridade_comercial =
                  'B'
                  THEN 2
                WHEN prioridade_comercial =
                  'C'
                  THEN 3
                ELSE 4
              END,
              score_comercial DESC,
              ultima_atividade DESC

            LIMIT 40
          `,
        []
      );

    // =====================================================
    // 6. ATENDIMENTOS EM MOVIMENTO
    // =====================================================

    const atendimentos =
      await consultaSegura(
        () =>
          sql`
            SELECT
              a.id,
              a.diagnostico_id,
              a.lead_id,
              a.area,
              a.score_area,
              a.nivel_area,
              a.status_atendimento,
              a.status_oportunidade,
              a.proxima_acao,
              a.proximo_contato,
              a.ultimo_acionamento,
              a.responsavel_id,
              a.updated_at,

              l.razao_social,
              l.nome,
              l.origem,
              l.prioridade_comercial,

              r.nome
                AS responsavel_nome

            FROM
              crm_atendimentos_departamento a

            LEFT JOIN
              diagnostico_leads l
            ON
              l.id =
                a.lead_id

            LEFT JOIN
              crm_responsaveis r
            ON
              r.id =
                a.responsavel_id

            WHERE
              COALESCE(
                a.arquivado,
                FALSE
              ) = FALSE
              AND COALESCE(
                a.status_atendimento,
                'NAO_INICIADO'
              ) <> 'CONCLUIDO'

            ORDER BY
              CASE
                WHEN
                  a.proximo_contato
                    IS NOT NULL
                  AND a.proximo_contato
                    < NOW()
                  THEN 1
                WHEN
                  l.prioridade_comercial =
                    'A'
                  THEN 2
                WHEN
                  a.status_oportunidade =
                    'PROPOSTA'
                  THEN 3
                WHEN
                  a.status_oportunidade =
                    'OPORTUNIDADE_IDENTIFICADA'
                  THEN 4
                ELSE 5
              END,
              COALESCE(
                a.proximo_contato,
                a.updated_at
              ) ASC

            LIMIT 30
          `,
        []
      );

    // =====================================================
    // 7. FUNIL COMERCIAL
    // =====================================================

    const funilRows =
      await consultaSegura(
        () =>
          sql`
            SELECT
              status_comercial
                AS status,

              COUNT(*)::INTEGER
                AS total

            FROM
              diagnostico_leads

            WHERE
              COALESCE(
                arquivado,
                FALSE
              ) = FALSE

            GROUP BY
              status_comercial
          `,
        []
      );

    const funil =
      {};

    for (
      const item of
        funilRows || []
    ) {
      funil[
        item.status ||
        "SEM_STATUS"
      ] =
        numero(
          item.total
        );
    }

    // =====================================================
    // 8. REFORMA TRIBUTÁRIA — PERFIL DOS LEADS
    // =====================================================

    const reformaRows =
      await consultaSegura(
        () =>
          sql`
            SELECT
              COUNT(*)::INTEGER
                AS total,

              COUNT(*) FILTER (
                WHERE
                  prioridade_comercial
                    IN ('A','B')
                  OR score_comercial
                    >= 60
              )::INTEGER
                AS oportunidades,

              COUNT(*) FILTER (
                WHERE
                  status_comercial =
                    'CONVERTIDO'
              )::INTEGER
                AS convertidos

            FROM
              diagnostico_leads

            WHERE
              COALESCE(
                arquivado,
                FALSE
              ) = FALSE
              AND (
                estrutura_negocio =
                  'reforma_tributaria'
                OR LOWER(
                  COALESCE(
                    contexto_cliente::text,
                    ''
                  )
                ) LIKE
                  '%reforma%'
                OR LOWER(
                  COALESCE(
                    intencao,
                    ''
                  )
                ) LIKE
                  '%reforma tribut%'
                OR LOWER(
                  COALESCE(
                    intencao,
                    ''
                  )
                ) LIKE
                  '%ibs%'
                OR LOWER(
                  COALESCE(
                    intencao,
                    ''
                  )
                ) LIKE
                  '%cbs%'
              )
          `,
        []
      );

    const reforma =
      reformaRows?.[0] ||
      {};

    // =====================================================
    // 9. RESPOSTA
    // =====================================================

    const dashboard = {
      totalLeads:
        numero(
          resumoLead
            ?.total_leads
        ),

      totalDiagnosticos:
        numero(
          resumoLead
            ?.diagnosticos
        ),

      oportunidades:
        numero(
          resumoLead
            ?.oportunidades
        ),

      atendimentosAbertos:
        numero(
          atendimentoRows
            ?.[0]
            ?.total
        ),

      propostas:
        numero(
          resumoProposta
            ?.propostas
        ),

      convertidos,

      criticos:
        numero(
          resumoLead
            ?.criticos
        ),

      reformaTributaria:
        numero(
          resumoLead
            ?.reforma_tributaria
        ),

      valorGanho:
        numero(
          resumoProposta
            ?.valor_ganho
        ),

      mrrGanho:
        numero(
          resumoProposta
            ?.mrr_ganho
        ),

      implantacaoGanha:
        numero(
          resumoProposta
            ?.implantacao_ganha
        ),

      origens:
        (origens || []).map(
          (item) => ({
            origem:
              item.origem ||
              "direto",

            total:
              numero(
                item.total
              ),

            qualificados:
              numero(
                item.qualificados
              ),

            propostas:
              numero(
                item.propostas
              ),

            convertidos:
              numero(
                item.convertidos
              ),
          })
        ),

      funil,

      reforma: {
        total:
          numero(
            reforma.total
          ),

        oportunidades:
          numero(
            reforma.oportunidades
          ),

        convertidos:
          numero(
            reforma.convertidos
          ),
      },

      leads:
        (leads || []).map(
          (lead) => ({
            id:
              lead.id,

            lead_id:
              lead.id,

            diagnostico_id:
              lead.diagnostico_id,

            diagnosticoId:
              lead.diagnostico_id,

            origem:
              lead.origem ||
              "direto",

            campanha:
              lead.campanha ||
              "",

            promoter:
              lead.promoter ||
              "",

            nome:
              lead.nome ||
              "",

            email:
              lead.email ||
              "",

            telefone:
              lead.telefone ||
              "",

            cnpj:
              lead.cnpj ||
              "",

            razao_social:
              lead.razao_social ||
              "",

            razaoSocial:
              lead.razao_social ||
              "",

            status:
              lead.status_comercial ||
              "",

            status_lead:
              lead.status_comercial ||
              "",

            statusDiagnostico:
              lead.status_diagnostico ||
              "",

            score:
              numero(
                lead.score_comercial
              ),

            score_geral:
              numero(
                lead.score_comercial
              ),

            prioridade:
              lead.prioridade_comercial ||
              "",

            temperatura:
              lead.temperatura_comercial ||
              "",

            proximaAcao:
              lead.proxima_acao ||
              "",

            prazoAtendimento:
              lead.prazo_atendimento ||
              "",

            responsavelFinder:
              lead.responsavel_finder ||
              "",

            estruturaNegocio:
              lead.estrutura_negocio ||
              "operacional",

            criado_em:
              lead.created_at,

            atualizado_em:
              lead.updated_at,

            ultima_atividade:
              lead.ultima_atividade,
          })
        ),

      atendimentos:
        (atendimentos || []).map(
          (item) => ({
            id:
              item.id,

            atendimento_id:
              item.id,

            diagnosticoId:
              item.diagnostico_id,

            leadId:
              item.lead_id,

            area:
              item.area ||
              "",

            departamento:
              item.area ||
              "",

            scoreArea:
              item.score_area,

            nivelArea:
              item.nivel_area ||
              "",

            status:
              item.status_atendimento ||
              "",

            etapa:
              item.status_atendimento ||
              "",

            statusOportunidade:
              item.status_oportunidade ||
              "NAO_ANALISADA",

            proximaAcao:
              item.proxima_acao ||
              "",

            proximoContato:
              item.proximo_contato ||
              null,

            ultimoAcionamento:
              item.ultimo_acionamento ||
              null,

            responsavelId:
              item.responsavel_id ||
              "",

            responsavel_nome:
              item.responsavel_nome ||
              "",

            responsavel:
              item.responsavel_nome ||
              "",

            razao_social:
              item.razao_social ||
              "",

            empresa:
              item.razao_social ||
              item.nome ||
              "",

            nome:
              item.nome ||
              "",

            origem:
              item.origem ||
              "direto",

            prioridade:
              item.prioridade_comercial ||
              "",

            atualizadoEm:
              item.updated_at,
          })
        ),

      atualizadoEm:
        new Date()
          .toISOString(),
    };

    return res
      .status(200)
      .json({
        sucesso: true,
        dashboard,
      });

  } catch (error) {
    console.error(
      "[dashboard-engine]",
      error
    );

    return res
      .status(500)
      .json({
        sucesso: false,
        error:
          "Não foi possível calcular os indicadores do dashboard.",
      });
  }
}
