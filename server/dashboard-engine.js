import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// =========================================================
// UTILITÁRIOS
// =========================================================

function texto(valor, limite = 500) {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor)
    .trim()
    .slice(0, limite);
}

function numero(valor, padrao = 0) {
  const n = Number(valor);

  return Number.isFinite(n)
    ? n
    : padrao;
}

function percentual(parte, total) {
  if (!total) {
    return 0;
  }

  return Number(
    (
      (
        numero(parte, 0) /
        numero(total, 1)
      ) * 100
    ).toFixed(1)
  );
}

function normalizarArray(valor) {
  return Array.isArray(valor)
    ? valor.filter(
        (item) =>
          item !== null &&
          item !== undefined
      )
    : [];
}

function normalizarTexto(valor) {
  return String(
    valor ||
    ""
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .trim()
    .toLowerCase();
}

function chaveArea(valor) {
  return normalizarTexto(valor)
    .replace(
      /[^a-z0-9]+/g,
      "_"
    )
    .replace(
      /^_+|_+$/g,
      ""
    );
}

function autorizado(req) {
  const adminToken =
    process.env.ADMIN_TOKEN ||
    process.env.ADMIN_PASSWORD ||
    "";

  if (!adminToken) {
    return true;
  }

  const authorization =
    req.headers?.authorization ||
    "";

  const bearer =
    authorization.startsWith(
      "Bearer "
    )
      ? authorization.slice(7)
      : "";

  const tokenQuery =
    req.query?.token ||
    "";

  return (
    bearer === adminToken ||
    tokenQuery === adminToken
  );
}

function exigirAdmin(req, res) {
  if (autorizado(req)) {
    return true;
  }

  res.status(401).json({
    sucesso: false,
    error: "Não autorizado.",
  });

  return false;
}

// =========================================================
// CLASSIFICAÇÕES
// =========================================================

function faixaScore(score) {
  const n =
    numero(score, null);

  if (n === null) {
    return {
      id: "sem_score",
      label: "Sem score",
    };
  }

  if (n < 40) {
    return {
      id: "critico",
      label: "Crítico",
    };
  }

  if (n < 60) {
    return {
      id: "atencao",
      label: "Atenção",
    };
  }

  if (n < 80) {
    return {
      id: "solido",
      label: "Sólido",
    };
  }

  return {
    id: "muito_bom",
    label: "Muito bom",
  };
}

function rotuloEstrutura(valor) {
  const chave =
    normalizarTexto(valor);

  const mapa = {
    operacional:
      "Empresa operacional",

    empresa_operacional:
      "Empresa operacional",

    empresa:
      "Empresa operacional",

    holding:
      "Holding",

    grupo:
      "Grupo empresarial",

    grupo_empresarial:
      "Grupo empresarial",

    spe:
      "SPE",

    avaliar_holding:
      "Avaliar Holding",

    pessoa_fisica:
      "Pessoa Física",

    pf:
      "Pessoa Física",
  };

  return (
    mapa[chave] ||
    valor ||
    "Não informado"
  );
}

function statusDiagnosticoLabel(
  status
) {
  const mapa = {
    ACESSOU:
      "Acessou",

    EM_PREENCHIMENTO:
      "Em preenchimento",

    NAO_CONCLUIDO:
      "Não concluído",

    CONCLUIDO:
      "Concluído",
  };

  return (
    mapa[status] ||
    status ||
    "Não informado"
  );
}

function statusAtendimentoLabel(
  status
) {
  const mapa = {
    NAO_INICIADO:
      "Novo",

    EM_ANALISE:
      "Avaliando",

    REUNIAO_AGENDADA:
      "Reunião agendada",

    EM_ATENDIMENTO:
      "Em tratativa",

    PLANO_APRESENTADO:
      "Proposta / plano",

    CONCLUIDO:
      "Concluído",
  };

  return (
    mapa[status] ||
    status ||
    "Não informado"
  );
}

function statusOportunidadeLabel(
  status
) {
  const mapa = {
    NAO_ANALISADA:
      "Não analisada",

    EM_ANALISE:
      "Em análise",

    OPORTUNIDADE_IDENTIFICADA:
      "Oportunidade identificada",

    PROPOSTA:
      "Proposta",

    CONTRATADO:
      "Contratado",

    SEM_OPORTUNIDADE:
      "Sem oportunidade",
  };

  return (
    mapa[status] ||
    status ||
    "Não informado"
  );
}

// =========================================================
// PERÍODO
// =========================================================

function inicioDoDia(data) {
  const d =
    new Date(data);

  d.setHours(
    0,
    0,
    0,
    0
  );

  return d;
}

function fimDoDia(data) {
  const d =
    new Date(data);

  d.setHours(
    23,
    59,
    59,
    999
  );

  return d;
}

function calcularPeriodo(req) {
  const periodo =
    texto(
      req.query?.periodo,
      30
    ).toLowerCase() ||
    "30_dias";

  const agora =
    new Date();

  let inicio =
    null;

  let fim =
    fimDoDia(
      agora
    );

  if (
    req.query?.inicio ||
    req.query?.fim
  ) {
    const inicioRecebido =
      req.query?.inicio
        ? new Date(
            req.query.inicio
          )
        : null;

    const fimRecebido =
      req.query?.fim
        ? new Date(
            req.query.fim
          )
        : null;

    inicio =
      inicioRecebido &&
      Number.isFinite(
        inicioRecebido.getTime()
      )
        ? inicioDoDia(
            inicioRecebido
          )
        : null;

    fim =
      fimRecebido &&
      Number.isFinite(
        fimRecebido.getTime()
      )
        ? fimDoDia(
            fimRecebido
          )
        : fim;

    return {
      periodo:
        "personalizado",

      inicio,

      fim,
    };
  }

  if (periodo === "hoje") {
    inicio =
      inicioDoDia(
        agora
      );
  } else if (
    periodo === "7_dias"
  ) {
    inicio =
      inicioDoDia(
        new Date(
          agora.getTime() -
          6 *
            24 *
            60 *
            60 *
            1000
        )
      );
  } else if (
    periodo === "este_mes"
  ) {
    inicio =
      new Date(
        agora.getFullYear(),
        agora.getMonth(),
        1,
        0,
        0,
        0,
        0
      );
  } else if (
    periodo === "todos"
  ) {
    inicio =
      null;
  } else {
    inicio =
      inicioDoDia(
        new Date(
          agora.getTime() -
          29 *
            24 *
            60 *
            60 *
            1000
        )
      );
  }

  return {
    periodo,
    inicio,
    fim,
  };
}

// =========================================================
// DADOS DOS DIAGNÓSTICOS
// =========================================================

function extrairEstruturaDiagnostico(
  item
) {
  const dados =
    item?.dados_completos &&
    typeof item.dados_completos ===
      "object"
      ? item.dados_completos
      : {};

  const perfil =
    dados?.perfil &&
    typeof dados.perfil ===
      "object"
      ? dados.perfil
      : {};

  return (
    item?.estrutura_negocio ||
    perfil?.estruturaNegocio ||
    perfil?.estrutura_negocio ||
    item?.tipo ||
    "operacional"
  );
}

function extrairOrigemDiagnostico(
  item
) {
  const dados =
    item?.dados_completos &&
    typeof item.dados_completos ===
      "object"
      ? item.dados_completos
      : {};

  const perfil =
    dados?.perfil &&
    typeof dados.perfil ===
      "object"
      ? dados.perfil
      : {};

  return (
    item?.origem ||
    perfil?.origem ||
    dados?.origem ||
    "diagnostico"
  );
}

function extrairAreasDiagnostico(
  item
) {
  const resultado =
    item?.diagnostico &&
    typeof item.diagnostico ===
      "object"
      ? item.diagnostico
      : {};

  const areasBanco =
    normalizarArray(
      item?.areas_selecionadas
    );

  const areasResultado =
    normalizarArray(
      resultado?.areas
    );

  const eixosResultado =
    normalizarArray(
      resultado
        ?.resultadoCompleto
        ?.eixos
    );

  const mapa =
    new Map();

  [
    ...areasBanco,
    ...areasResultado,
    ...eixosResultado,
  ].forEach(
    (area) => {
      if (!area) {
        return;
      }

      const label =
        texto(
          area?.label ||
          area?.area ||
          area?.nome ||
          area?.titulo,
          160
        );

      if (!label) {
        return;
      }

      const chave =
        chaveArea(
          area?.id ||
          label
        );

      const atual =
        mapa.get(chave) ||
        {};

      const scoreRecebido =
        area?.score ??
        area?.pontuacao ??
        area?.nota;

      mapa.set(
        chave,
        {
          ...atual,
          ...area,

          id:
            area?.id ||
            atual?.id ||
            chave,

          label,

          score:
            scoreRecebido !==
              undefined &&
            scoreRecebido !==
              null
              ? numero(
                  scoreRecebido,
                  null
                )
              : atual?.score ??
                null,
        }
      );
    }
  );

  return [
    ...mapa.values(),
  ];
}

// =========================================================
// FILTROS
// =========================================================

function filtrosRequisicao(req) {
  return {
    estrutura:
      texto(
        req.query?.estrutura,
        80
      ),

    origem:
      texto(
        req.query?.origem,
        100
      ),

    statusDiagnostico:
      texto(
        req.query
          ?.statusDiagnostico,
        60
      ).toUpperCase(),

    area:
      texto(
        req.query?.area,
        160
      ),

    responsavelId:
      texto(
        req.query
          ?.responsavelId,
        140
      ),

    statusAtendimento:
      texto(
        req.query
          ?.statusAtendimento,
        60
      ).toUpperCase(),

    statusOportunidade:
      texto(
        req.query
          ?.statusOportunidade,
        80
      ).toUpperCase(),

    prioridade:
      texto(
        req.query?.prioridade,
        10
      ).toUpperCase(),
  };
}

function dentroPeriodo(
  valor,
  periodo
) {
  if (!valor) {
    return false;
  }

  const data =
    new Date(
      valor
    );

  if (
    !Number.isFinite(
      data.getTime()
    )
  ) {
    return false;
  }

  if (
    periodo.inicio &&
    data < periodo.inicio
  ) {
    return false;
  }

  if (
    periodo.fim &&
    data > periodo.fim
  ) {
    return false;
  }

  return true;
}

// =========================================================
// AGREGAÇÕES
// =========================================================

function agruparContagem(
  itens,
  obterChave,
  obterLabel
) {
  const mapa =
    new Map();

  itens.forEach(
    (item) => {
      const chave =
        obterChave(item);

      if (!chave) {
        return;
      }

      const label =
        obterLabel
          ? obterLabel(
              item,
              chave
            )
          : chave;

      const atual =
        mapa.get(chave) ||
        {
          id:
            chave,
          label,
          quantidade:
            0,
        };

      atual.quantidade +=
        1;

      mapa.set(
        chave,
        atual
      );
    }
  );

  const total =
    itens.length;

  return [
    ...mapa.values(),
  ]
    .map(
      (item) => ({
        ...item,

        percentual:
          percentual(
            item.quantidade,
            total
          ),
      })
    )
    .sort(
      (a, b) =>
        b.quantidade -
        a.quantidade
    );
}

function montarInsights({
  leads,
  diagnosticos,
  atendimentos,
  estruturas,
  origens,
  rankingAreas,
  retornosAtrasados,
}) {
  const insights =
    [];

  if (
    rankingAreas?.[0]
  ) {
    insights.push({
      tipo:
        "area_prioritaria",

      titulo:
        `${rankingAreas[0].label} é a área de maior incidência no período.`,

      descricao:
        `${rankingAreas[0].quantidadeDiagnosticos} diagnóstico(s), score médio ${rankingAreas[0].scoreMedio}.`,
    });
  }

  if (
    estruturas?.[0] &&
    diagnosticos.length
  ) {
    insights.push({
      tipo:
        "estrutura",

      titulo:
        `${estruturas[0].label} representa ${estruturas[0].percentual}% dos diagnósticos filtrados.`,

      descricao:
        `${estruturas[0].quantidade} diagnóstico(s) nesta estrutura.`,
    });
  }

  if (
    origens?.[0] &&
    leads.length
  ) {
    insights.push({
      tipo:
        "origem",

      titulo:
        `${origens[0].label} é a principal origem de leads.`,

      descricao:
        `${origens[0].quantidade} lead(s), equivalente a ${origens[0].percentual}% do período.`,
    });
  }

  if (
    retornosAtrasados >
    0
  ) {
    insights.push({
      tipo:
        "alerta",

      titulo:
        `${retornosAtrasados} atendimento(s) possuem retorno atrasado.`,

      descricao:
        "Priorize esses casos na fila de atendimento.",
    });
  }

  if (
    !insights.length
  ) {
    insights.push({
      tipo:
        "sem_dados",

      titulo:
        "Ainda não há volume suficiente para gerar insights relevantes.",

      descricao:
        "Amplie o período ou remova alguns filtros.",
    });
  }

  return insights;
}

// =========================================================
// HANDLER
// =========================================================

export async function dashboardHandler(
  req,
  res
) {
  try {
    if (
      req.method !== "GET"
    ) {
      res.setHeader(
        "Allow",
        "GET"
      );

      return res.status(405).json({
        sucesso: false,
        error:
          "Método não permitido.",
      });
    }

    if (
      !process.env
        .DATABASE_URL
    ) {
      return res.status(500).json({
        sucesso: false,
        error:
          "DATABASE_URL não configurada.",
      });
    }

    if (
      !exigirAdmin(
        req,
        res
      )
    ) {
      return;
    }

    const periodo =
      calcularPeriodo(
        req
      );

    const filtros =
      filtrosRequisicao(
        req
      );

    // -----------------------------------------------------
    // CARREGAMENTO
    // -----------------------------------------------------

    const [
      leadsBanco,
      diagnosticosBanco,
      atendimentosBanco,
      responsaveisBanco,
    ] =
      await Promise.all([
        sql`
          SELECT
            id,
            diagnostico_id,
            origem,
            status_diagnostico,
            status_comercial,
            nome,
            email,
            telefone,
            cnpj,
            razao_social,
            estrutura_negocio,
            prioridade_comercial,
            responsavel_finder,
            primeiro_acesso,
            ultima_atividade,
            created_at,
            updated_at
          FROM diagnostico_leads
          ORDER BY
            primeiro_acesso DESC
          LIMIT 5000
        `,

        sql`
          SELECT
            id,
            nome,
            email,
            telefone,
            cnpj,
            razao_social,
            score,
            areas_selecionadas,
            diagnostico,
            dados_completos,
            criado_em
          FROM diagnosticos
          ORDER BY
            criado_em DESC
          LIMIT 5000
        `,

        sql`
          SELECT
            a.id,
            a.diagnostico_id,
            a.lead_id,
            a.area,
            a.score_area,
            a.nivel_area,
            a.responsavel_id,
            a.status_atendimento,
            a.status_oportunidade,
            a.proxima_acao,
            a.proximo_contato,
            a.ultimo_acionamento,
            a.created_at,
            a.updated_at,

            r.nome
              AS responsavel_nome
          FROM crm_atendimentos_departamento a

          LEFT JOIN crm_responsaveis r
            ON r.id =
              a.responsavel_id

          ORDER BY
            a.created_at DESC
          LIMIT 10000
        `,

        sql`
          SELECT
            id,
            nome,
            email,
            areas,
            capacidade_diaria,
            ativo
          FROM crm_responsaveis
          WHERE ativo = TRUE
          ORDER BY
            nome ASC
        `,
      ]);

    const leadsTodos =
      normalizarArray(
        leadsBanco
      );

    const diagnosticosTodos =
      normalizarArray(
        diagnosticosBanco
      );

    const atendimentosTodos =
      normalizarArray(
        atendimentosBanco
      );

    const responsaveis =
      normalizarArray(
        responsaveisBanco
      );

    // -----------------------------------------------------
    // MAPAS
    // -----------------------------------------------------

    const leadPorId =
      new Map();

    const leadPorDiagnostico =
      new Map();

    leadsTodos.forEach(
      (lead) => {
        if (lead?.id) {
          leadPorId.set(
            String(
              lead.id
            ),
            lead
          );
        }

        if (
          lead?.diagnostico_id
        ) {
          leadPorDiagnostico.set(
            String(
              lead.diagnostico_id
            ),
            lead
          );
        }
      }
    );

    const diagnosticoPorId =
      new Map();

    diagnosticosTodos.forEach(
      (item) => {
        diagnosticoPorId.set(
          String(
            item.id
          ),
          item
        );
      }
    );

    // -----------------------------------------------------
    // PERÍODO
    // -----------------------------------------------------

    const leadsPeriodo =
      leadsTodos.filter(
        (lead) =>
          dentroPeriodo(
            lead.primeiro_acesso ||
            lead.created_at,
            periodo
          )
      );

    const diagnosticosPeriodo =
      diagnosticosTodos.filter(
        (item) =>
          dentroPeriodo(
            item.criado_em,
            periodo
          )
      );

    const atendimentosPeriodo =
      atendimentosTodos.filter(
        (item) =>
          dentroPeriodo(
            item.created_at,
            periodo
          )
      );

    // -----------------------------------------------------
    // FILTRO GLOBAL
    // -----------------------------------------------------

    const diagnosticosFiltrados =
      diagnosticosPeriodo.filter(
        (item) => {
          const estrutura =
            extrairEstruturaDiagnostico(
              item
            );

          const origem =
            extrairOrigemDiagnostico(
              item
            );

          const areas =
            extrairAreasDiagnostico(
              item
            );

          const lead =
            leadPorDiagnostico.get(
              String(
                item.id
              )
            );

          const bateEstrutura =
            !filtros.estrutura ||
            normalizarTexto(
              estrutura
            ) ===
              normalizarTexto(
                filtros.estrutura
              );

          const bateOrigem =
            !filtros.origem ||
            normalizarTexto(
              lead?.origem ||
              origem
            ) ===
              normalizarTexto(
                filtros.origem
              );

          const bateStatus =
            !filtros.statusDiagnostico ||
            String(
              lead
                ?.status_diagnostico ||
              "CONCLUIDO"
            ).toUpperCase() ===
              filtros.statusDiagnostico;

          const bateArea =
            !filtros.area ||
            areas.some(
              (area) =>
                normalizarTexto(
                  area.label
                ) ===
                  normalizarTexto(
                    filtros.area
                  ) ||
                normalizarTexto(
                  area.id
                ) ===
                  normalizarTexto(
                    filtros.area
                  )
            );

          const batePrioridade =
            !filtros.prioridade ||
            String(
              lead
                ?.prioridade_comercial ||
              ""
            ).toUpperCase() ===
              filtros.prioridade;

          return (
            bateEstrutura &&
            bateOrigem &&
            bateStatus &&
            bateArea &&
            batePrioridade
          );
        }
      );

    const idsDiagnosticosFiltrados =
      new Set(
        diagnosticosFiltrados.map(
          (item) =>
            String(
              item.id
            )
        )
      );

    const leadsFiltrados =
      leadsPeriodo.filter(
        (lead) => {
          const diagnosticoId =
            String(
              lead
                ?.diagnostico_id ||
              ""
            );

          const bateDiagnostico =
            !diagnosticoId ||
            !diagnosticosFiltrados
              .length ||
            idsDiagnosticosFiltrados.has(
              diagnosticoId
            );

          const bateEstrutura =
            !filtros.estrutura ||
            normalizarTexto(
              lead
                ?.estrutura_negocio
            ) ===
              normalizarTexto(
                filtros.estrutura
              );

          const bateOrigem =
            !filtros.origem ||
            normalizarTexto(
              lead?.origem
            ) ===
              normalizarTexto(
                filtros.origem
              );

          const bateStatus =
            !filtros.statusDiagnostico ||
            String(
              lead
                ?.status_diagnostico ||
              ""
            ).toUpperCase() ===
              filtros.statusDiagnostico;

          const batePrioridade =
            !filtros.prioridade ||
            String(
              lead
                ?.prioridade_comercial ||
              ""
            ).toUpperCase() ===
              filtros.prioridade;

          return (
            bateDiagnostico &&
            bateEstrutura &&
            bateOrigem &&
            bateStatus &&
            batePrioridade
          );
        }
      );

    const atendimentosFiltrados =
      atendimentosPeriodo.filter(
        (atendimento) => {
          const diagnosticoId =
            String(
              atendimento
                ?.diagnostico_id ||
              ""
            );

          const lead =
            leadPorId.get(
              String(
                atendimento
                  ?.lead_id ||
                ""
              )
            ) ||
            leadPorDiagnostico.get(
              diagnosticoId
            ) ||
            null;

          const diagnostico =
            diagnosticoPorId.get(
              diagnosticoId
            ) ||
            null;

          const estrutura =
            lead
              ?.estrutura_negocio ||
            (
              diagnostico
                ? extrairEstruturaDiagnostico(
                    diagnostico
                  )
                : ""
            );

          const origem =
            lead?.origem ||
            (
              diagnostico
                ? extrairOrigemDiagnostico(
                    diagnostico
                  )
                : ""
            );

          const bateDiagnostico =
            !diagnosticosFiltrados
              .length ||
            !diagnosticoId ||
            idsDiagnosticosFiltrados.has(
              diagnosticoId
            );

          const bateEstrutura =
            !filtros.estrutura ||
            normalizarTexto(
              estrutura
            ) ===
              normalizarTexto(
                filtros.estrutura
              );

          const bateOrigem =
            !filtros.origem ||
            normalizarTexto(
              origem
            ) ===
              normalizarTexto(
                filtros.origem
              );

          const bateArea =
            !filtros.area ||
            normalizarTexto(
              atendimento.area
            ) ===
              normalizarTexto(
                filtros.area
              );

          const bateResponsavel =
            !filtros.responsavelId ||
            String(
              atendimento
                .responsavel_id ||
              ""
            ) ===
              filtros.responsavelId;

          const bateStatusAtendimento =
            !filtros.statusAtendimento ||
            String(
              atendimento
                .status_atendimento ||
              ""
            ).toUpperCase() ===
              filtros.statusAtendimento;

          const bateStatusOportunidade =
            !filtros.statusOportunidade ||
            String(
              atendimento
                .status_oportunidade ||
              ""
            ).toUpperCase() ===
              filtros.statusOportunidade;

          return (
            bateDiagnostico &&
            bateEstrutura &&
            bateOrigem &&
            bateArea &&
            bateResponsavel &&
            bateStatusAtendimento &&
            bateStatusOportunidade
          );
        }
      );

    // -----------------------------------------------------
    // KPIs
    // -----------------------------------------------------

    const leadsTotal =
      leadsFiltrados.length;

    const diagnosticosIniciados =
      leadsFiltrados.filter(
        (lead) =>
          [
            "EM_PREENCHIMENTO",
            "NAO_CONCLUIDO",
            "CONCLUIDO",
          ].includes(
            lead
              .status_diagnostico
          )
      ).length;

    // A aba "Diagnósticos" é alimentada pela tabela `diagnosticos`.
    // Para o Dashboard reconciliar com ela, usamos a quantidade de
    // diagnósticos realmente salvos, não apenas o status do lead.
    const diagnosticosConcluidos =
      diagnosticosFiltrados.length;

    const leadsMarcadosConcluidos =
      leadsFiltrados.filter(
        (lead) =>
          lead
            .status_diagnostico ===
          "CONCLUIDO"
      ).length;

    const atendimentosTotal =
      atendimentosFiltrados.length;

    const oportunidadesTotal =
      atendimentosFiltrados.filter(
        (item) =>
          [
            "OPORTUNIDADE_IDENTIFICADA",
            "PROPOSTA",
            "CONTRATADO",
          ].includes(
            item
              .status_oportunidade
          )
      ).length;

    const propostasTotal =
      atendimentosFiltrados.filter(
        (item) =>
          item
            .status_oportunidade ===
          "PROPOSTA"
      ).length;

    const contratadosTotal =
      atendimentosFiltrados.filter(
        (item) =>
          item
            .status_oportunidade ===
          "CONTRATADO"
      ).length;

    const agora =
      new Date();

    const retornosAtrasados =
      atendimentosFiltrados.filter(
        (item) => {
          if (
            !item.proximo_contato ||
            item
              .status_atendimento ===
              "CONCLUIDO"
          ) {
            return false;
          }

          const data =
            new Date(
              item.proximo_contato
            );

          return (
            Number.isFinite(
              data.getTime()
            ) &&
            data <
              agora
          );
        }
      ).length;

    // -----------------------------------------------------
    // FUNIL
    // -----------------------------------------------------

    const acessaram =
      leadsFiltrados.length;

    const iniciaram =
      leadsFiltrados.filter(
        (lead) =>
          [
            "EM_PREENCHIMENTO",
            "NAO_CONCLUIDO",
            "CONCLUIDO",
          ].includes(
            lead
              .status_diagnostico
          )
      ).length;

    const concluiram =
      diagnosticosFiltrados.length;

    const funil = [
      {
        id:
          "acessaram",
        label:
          "Acessaram",
        quantidade:
          acessaram,
        conversaoAnterior:
          100,
      },
      {
        id:
          "iniciaram",
        label:
          "Iniciaram diagnóstico",
        quantidade:
          iniciaram,
        conversaoAnterior:
          percentual(
            iniciaram,
            acessaram
          ),
      },
      {
        id:
          "concluiram",
        label:
          "Concluíram diagnóstico",
        quantidade:
          concluiram,
        conversaoAnterior:
          percentual(
            concluiram,
            iniciaram
          ),
      },
      {
        id:
          "oportunidades",
        label:
          "Oportunidades",
        quantidade:
          oportunidadesTotal,
        conversaoAnterior:
          percentual(
            oportunidadesTotal,
            concluiram
          ),
      },
      {
        id:
          "atendimentos",
        label:
          "Em atendimento",
        quantidade:
          atendimentosFiltrados.filter(
            (item) =>
              item
                .status_atendimento !==
              "CONCLUIDO"
          ).length,
        conversaoAnterior:
          percentual(
            atendimentosFiltrados.filter(
              (item) =>
                item
                  .status_atendimento !==
                "CONCLUIDO"
            ).length,
            oportunidadesTotal
          ),
      },
      {
        id:
          "propostas",
        label:
          "Propostas",
        quantidade:
          propostasTotal,
        conversaoAnterior:
          percentual(
            propostasTotal,
            oportunidadesTotal
          ),
      },
      {
        id:
          "contratados",
        label:
          "Contratados",
        quantidade:
          contratadosTotal,
        conversaoAnterior:
          percentual(
            contratadosTotal,
            propostasTotal
          ),
      },
    ];

    // -----------------------------------------------------
    // ORIGENS
    // -----------------------------------------------------

    const origens =
      agruparContagem(
        leadsFiltrados,
        (lead) =>
          normalizarTexto(
            lead.origem ||
            "direto"
          ),
        (lead) =>
          lead.origem ||
          "direto"
      );

    // -----------------------------------------------------
    // ESTRUTURAS
    // -----------------------------------------------------

    const estruturas =
      agruparContagem(
        diagnosticosFiltrados,
        (item) =>
          normalizarTexto(
            extrairEstruturaDiagnostico(
              item
            )
          ),
        (item) =>
          rotuloEstrutura(
            extrairEstruturaDiagnostico(
              item
            )
          )
      );

    // -----------------------------------------------------
    // SCORES
    // -----------------------------------------------------

    const distribuicaoScoreMapa =
      new Map();

    diagnosticosFiltrados.forEach(
      (item) => {
        const faixa =
          faixaScore(
            item.score
          );

        const atual =
          distribuicaoScoreMapa.get(
            faixa.id
          ) ||
          {
            id:
              faixa.id,
            label:
              faixa.label,
            quantidade:
              0,
          };

        atual.quantidade +=
          1;

        distribuicaoScoreMapa.set(
          faixa.id,
          atual
        );
      }
    );

    const distribuicaoScores =
      [
        ...distribuicaoScoreMapa.values(),
      ].map(
        (item) => ({
          ...item,

          percentual:
            percentual(
              item.quantidade,
              diagnosticosFiltrados.length
            ),
        })
      );

    // -----------------------------------------------------
    // RANKING DE ÁREAS
    // -----------------------------------------------------

    const mapaAreas =
      new Map();

    diagnosticosFiltrados.forEach(
      (diagnostico) => {
        const areas =
          extrairAreasDiagnostico(
            diagnostico
          );

        areas.forEach(
          (area) => {
            const chave =
              chaveArea(
                area.id ||
                area.label
              );

            const atual =
              mapaAreas.get(
                chave
              ) ||
              {
                id:
                  chave,

                label:
                  area.label,

                quantidadeDiagnosticos:
                  0,

                somaScores:
                  0,

                totalScores:
                  0,

                criticos:
                  0,

                atencao:
                  0,

                solidos:
                  0,

                muitoBons:
                  0,
              };

            atual.quantidadeDiagnosticos +=
              1;

            if (
              area.score !==
                null &&
              area.score !==
                undefined
            ) {
              const scoreArea =
                numero(
                  area.score,
                  null
                );

              if (
                scoreArea !==
                null
              ) {
                atual.somaScores +=
                  scoreArea;

                atual.totalScores +=
                  1;

                const faixa =
                  faixaScore(
                    scoreArea
                  );

                if (
                  faixa.id ===
                  "critico"
                ) {
                  atual.criticos +=
                    1;
                } else if (
                  faixa.id ===
                  "atencao"
                ) {
                  atual.atencao +=
                    1;
                } else if (
                  faixa.id ===
                  "solido"
                ) {
                  atual.solidos +=
                    1;
                } else if (
                  faixa.id ===
                  "muito_bom"
                ) {
                  atual.muitoBons +=
                    1;
                }
              }
            }

            mapaAreas.set(
              chave,
              atual
            );
          }
        );
      }
    );

    const atendimentosPorArea =
      new Map();

    atendimentosFiltrados.forEach(
      (item) => {
        const chave =
          chaveArea(
            item.area
          );

        const atual =
          atendimentosPorArea.get(
            chave
          ) ||
          {
            atendimentos:
              0,

            oportunidades:
              0,

            concluidos:
              0,
          };

        atual.atendimentos +=
          1;

        if (
          [
            "OPORTUNIDADE_IDENTIFICADA",
            "PROPOSTA",
            "CONTRATADO",
          ].includes(
            item
              .status_oportunidade
          )
        ) {
          atual.oportunidades +=
            1;
        }

        if (
          item
            .status_atendimento ===
          "CONCLUIDO"
        ) {
          atual.concluidos +=
            1;
        }

        atendimentosPorArea.set(
          chave,
          atual
        );
      }
    );

    const rankingAreas =
      [
        ...mapaAreas.values(),
      ]
        .map(
          (item) => {
            const atendimento =
              atendimentosPorArea.get(
                item.id
              ) ||
              {
                atendimentos:
                  0,

                oportunidades:
                  0,

                concluidos:
                  0,
              };

            return {
              id:
                item.id,

              label:
                item.label,

              quantidadeDiagnosticos:
                item
                  .quantidadeDiagnosticos,

              scoreMedio:
                item
                  .totalScores >
                0
                  ? Number(
                      (
                        item
                          .somaScores /
                        item
                          .totalScores
                      ).toFixed(
                        1
                      )
                    )
                  : null,

              criticos:
                item.criticos,

              atencao:
                item.atencao,

              solidos:
                item.solidos,

              muitoBons:
                item.muitoBons,

              oportunidades:
                atendimento
                  .oportunidades,

              atendimentos:
                atendimento
                  .atendimentos,

              concluidos:
                atendimento
                  .concluidos,
            };
          }
        )
        .sort(
          (a, b) =>
            b
              .quantidadeDiagnosticos -
            a
              .quantidadeDiagnosticos
        );

    // -----------------------------------------------------
    // STATUS DOS ATENDIMENTOS
    // -----------------------------------------------------

    const statusAtendimentos =
      agruparContagem(
        atendimentosFiltrados,
        (item) =>
          item
            .status_atendimento ||
          "SEM_STATUS",
        (item) =>
          statusAtendimentoLabel(
            item
              .status_atendimento
          )
      );

    const statusOportunidades =
      agruparContagem(
        atendimentosFiltrados,
        (item) =>
          item
            .status_oportunidade ||
          "NAO_ANALISADA",
        (item) =>
          statusOportunidadeLabel(
            item
              .status_oportunidade
          )
      );

    // -----------------------------------------------------
    // EQUIPE / CAPACIDADE
    // -----------------------------------------------------

    const equipe =
      responsaveis.map(
        (responsavel) => {
          const ativos =
            atendimentosFiltrados.filter(
              (item) =>
                String(
                  item
                    .responsavel_id ||
                  ""
                ) ===
                  String(
                    responsavel.id
                  ) &&
                item
                  .status_atendimento !==
                  "CONCLUIDO"
            ).length;

          const concluidos =
            atendimentosFiltrados.filter(
              (item) =>
                String(
                  item
                    .responsavel_id ||
                  ""
                ) ===
                  String(
                    responsavel.id
                  ) &&
                item
                  .status_atendimento ===
                  "CONCLUIDO"
            ).length;

          const capacidade =
            numero(
              responsavel
                .capacidade_diaria,
              0
            );

          return {
            id:
              responsavel.id,

            nome:
              responsavel.nome,

            areas:
              normalizarArray(
                responsavel.areas
              ),

            capacidadeDiaria:
              capacidade,

            atendimentosAtivos:
              ativos,

            concluidos,

            utilizacaoPercentual:
              capacidade >
              0
                ? Math.min(
                    999,
                    percentual(
                      ativos,
                      capacidade
                    )
                  )
                : 0,
          };
        }
      )
      .sort(
        (a, b) =>
          b
            .atendimentosAtivos -
          a
            .atendimentosAtivos
      );

    // -----------------------------------------------------
    // MAPA DE CALOR
    // -----------------------------------------------------

    const estruturaArea =
      new Map();

    diagnosticosFiltrados.forEach(
      (diagnostico) => {
        const estrutura =
          rotuloEstrutura(
            extrairEstruturaDiagnostico(
              diagnostico
            )
          );

        extrairAreasDiagnostico(
          diagnostico
        ).forEach(
          (area) => {
            const chave =
              `${normalizarTexto(
                estrutura
              )}::${chaveArea(
                area.label
              )}`;

            const atual =
              estruturaArea.get(
                chave
              ) ||
              {
                estrutura,
                area:
                  area.label,

                quantidade:
                  0,

                somaScore:
                  0,

                totalScore:
                  0,
              };

            atual.quantidade +=
              1;

            if (
              area.score !==
                null &&
              area.score !==
                undefined
            ) {
              atual.somaScore +=
                numero(
                  area.score,
                  0
                );

              atual.totalScore +=
                1;
            }

            estruturaArea.set(
              chave,
              atual
            );
          }
        );
      }
    );

    const mapaCalor =
      [
        ...estruturaArea.values(),
      ].map(
        (item) => ({
          estrutura:
            item.estrutura,

          area:
            item.area,

          quantidade:
            item.quantidade,

          scoreMedio:
            item.totalScore >
            0
              ? Number(
                  (
                    item
                      .somaScore /
                    item
                      .totalScore
                  ).toFixed(
                    1
                  )
                )
              : null,
        })
      );

    // -----------------------------------------------------
    // DRILL DOWN
    // -----------------------------------------------------

    const registros =
      diagnosticosFiltrados
        .slice(
          0,
          300
        )
        .map(
          (diagnostico) => {
            const lead =
              leadPorDiagnostico.get(
                String(
                  diagnostico.id
                )
              ) ||
              null;

            const atendimentos =
              atendimentosFiltrados.filter(
                (item) =>
                  String(
                    item
                      .diagnostico_id
                  ) ===
                  String(
                    diagnostico.id
                  )
              );

            return {
              diagnosticoId:
                diagnostico.id,

              leadId:
                lead?.id ||
                "",

              nome:
                lead?.nome ||
                diagnostico.nome ||
                "",

              empresa:
                lead
                  ?.razao_social ||
                diagnostico
                  .razao_social ||
                "",

              cnpj:
                lead?.cnpj ||
                diagnostico.cnpj ||
                "",

              telefone:
                lead
                  ?.telefone ||
                diagnostico
                  .telefone ||
                "",

              email:
                lead?.email ||
                diagnostico.email ||
                "",

              estrutura:
                rotuloEstrutura(
                  lead
                    ?.estrutura_negocio ||
                  extrairEstruturaDiagnostico(
                    diagnostico
                  )
                ),

              origem:
                lead?.origem ||
                extrairOrigemDiagnostico(
                  diagnostico
                ),

              statusDiagnostico:
                lead
                  ?.status_diagnostico ||
                "CONCLUIDO",

              statusDiagnosticoLabel:
                statusDiagnosticoLabel(
                  lead
                    ?.status_diagnostico ||
                  "CONCLUIDO"
                ),

              prioridade:
                lead
                  ?.prioridade_comercial ||
                "",

              score:
                diagnostico.score,

              faixaScore:
                faixaScore(
                  diagnostico.score
                ).label,

              areas:
                extrairAreasDiagnostico(
                  diagnostico
                ).map(
                  (area) => ({
                    id:
                      area.id,

                    label:
                      area.label,

                    score:
                      area.score,
                  })
                ),

              atendimentos:
                atendimentos.map(
                  (item) => ({
                    id:
                      item.id,

                    area:
                      item.area,

                    status:
                      item
                        .status_atendimento,

                    statusLabel:
                      statusAtendimentoLabel(
                        item
                          .status_atendimento
                      ),

                    oportunidade:
                      item
                        .status_oportunidade,

                    oportunidadeLabel:
                      statusOportunidadeLabel(
                        item
                          .status_oportunidade
                      ),

                    responsavelId:
                      item
                        .responsavel_id,

                    responsavelNome:
                      item
                        .responsavel_nome ||
                      "",
                  })
                ),
            };
          }
        );

    // -----------------------------------------------------
    // VALIDAÇÃO / RECONCILIAÇÃO DOS INDICADORES
    // -----------------------------------------------------

    const leadsSemDiagnostico =
      leadsFiltrados.filter(
        (lead) =>
          !lead?.diagnostico_id
      ).length;

    const diagnosticosSemLead =
      diagnosticosFiltrados.filter(
        (item) =>
          !leadPorDiagnostico.has(
            String(item.id)
          )
      ).length;

    const diferencaConcluidos =
      diagnosticosConcluidos -
      leadsMarcadosConcluidos;

    const validacao = {
      periodo: {
        leadsNaTelaCRM:
          leadsFiltrados.length,

        diagnosticosNaTabela:
          diagnosticosFiltrados.length,

        leadsMarcadosComoConcluidos:
          leadsMarcadosConcluidos,

        atendimentosNaTabela:
          atendimentosFiltrados.length,
      },

      integridade: {
        leadsSemDiagnostico,
        diagnosticosSemLead,
        diferencaConcluidos,

        conciliado:
          diferencaConcluidos === 0 &&
          diagnosticosSemLead === 0,
      },

      fontes: [
        {
          indicador:
            "Leads",
          fonte:
            "diagnostico_leads",
        },
        {
          indicador:
            "Diagnósticos concluídos",
          fonte:
            "diagnosticos",
        },
        {
          indicador:
            "Atendimentos",
          fonte:
            "crm_atendimentos_departamento",
        },
        {
          indicador:
            "Equipe",
          fonte:
            "crm_responsaveis",
        },
      ],

      alertas: [
        ...(diferencaConcluidos !== 0
          ? [
              `${Math.abs(
                diferencaConcluidos
              )} diagnóstico(s) apresentam diferença entre a tabela de relatórios e o status CONCLUIDO dos leads.`,
            ]
          : []),

        ...(diagnosticosSemLead > 0
          ? [
              `${diagnosticosSemLead} diagnóstico(s) salvo(s) não possuem lead vinculado.`,
            ]
          : []),

        ...(leadsSemDiagnostico > 0
          ? [
              `${leadsSemDiagnostico} lead(s) do período ainda não possuem diagnóstico vinculado.`,
            ]
          : []),
      ],
    };

    // -----------------------------------------------------
    // INSIGHTS
    // -----------------------------------------------------

    const insights =
      montarInsights({
        leads:
          leadsFiltrados,

        diagnosticos:
          diagnosticosFiltrados,

        atendimentos:
          atendimentosFiltrados,

        estruturas,

        origens,

        rankingAreas,

        retornosAtrasados,
      });

    // -----------------------------------------------------
    // RESPOSTA
    // -----------------------------------------------------

    return res.status(200).json({
      sucesso: true,

      geradoEm:
        new Date().toISOString(),

      periodo: {
        id:
          periodo.periodo,

        inicio:
          periodo.inicio
            ? periodo.inicio.toISOString()
            : null,

        fim:
          periodo.fim
            ? periodo.fim.toISOString()
            : null,
      },

      filtrosAtivos:
        filtros,

      kpis: {
        leads:
          leadsTotal,

        diagnosticosIniciados,

        diagnosticosConcluidos,

        taxaConclusao:
          percentual(
            diagnosticosConcluidos,
            diagnosticosIniciados ||
            leadsTotal
          ),

        atendimentos:
          atendimentosTotal,

        oportunidades:
          oportunidadesTotal,

        propostas:
          propostasTotal,

        contratados:
          contratadosTotal,

        retornosAtrasados,
      },

      funil,

      origens,

      estruturas,

      distribuicaoScores,

      rankingAreas,

      matrizOportunidades:
        rankingAreas,

      statusAtendimentos,

      statusOportunidades,

      equipe,

      mapaCalor,

      insights,

      validacao,

      registros,

      filtrosDisponiveis: {
        estruturas:
          [
            ...new Set(
              diagnosticosPeriodo.map(
                (item) =>
                  extrairEstruturaDiagnostico(
                    item
                  )
              )
            ),
          ]
            .filter(Boolean)
            .map(
              (valor) => ({
                id:
                  valor,

                label:
                  rotuloEstrutura(
                    valor
                  ),
              })
            ),

        origens:
          [
            ...new Set(
              leadsPeriodo.map(
                (item) =>
                  item.origem ||
                  "direto"
              )
            ),
          ]
            .filter(Boolean)
            .map(
              (valor) => ({
                id:
                  valor,

                label:
                  valor,
              })
            ),

        statusDiagnostico: [
          {
            id:
              "ACESSOU",
            label:
              "Acessou",
          },
          {
            id:
              "EM_PREENCHIMENTO",
            label:
              "Em preenchimento",
          },
          {
            id:
              "NAO_CONCLUIDO",
            label:
              "Não concluído",
          },
          {
            id:
              "CONCLUIDO",
            label:
              "Concluído",
          },
        ],

        areas:
          [
            ...new Map(
              diagnosticosPeriodo
                .flatMap(
                  (item) =>
                    extrairAreasDiagnostico(
                      item
                    )
                )
                .map(
                  (area) => [
                    chaveArea(
                      area.id ||
                      area.label
                    ),
                    {
                      id:
                        area.id ||
                        chaveArea(
                          area.label
                        ),

                      label:
                        area.label,
                    },
                  ]
                )
            ).values(),
          ],

        responsaveis:
          responsaveis.map(
            (item) => ({
              id:
                item.id,

              label:
                item.nome,
            })
          ),

        statusAtendimento: [
          "NAO_INICIADO",
          "EM_ANALISE",
          "REUNIAO_AGENDADA",
          "EM_ATENDIMENTO",
          "PLANO_APRESENTADO",
          "CONCLUIDO",
        ].map(
          (id) => ({
            id,
            label:
              statusAtendimentoLabel(
                id
              ),
          })
        ),

        statusOportunidade: [
          "NAO_ANALISADA",
          "EM_ANALISE",
          "OPORTUNIDADE_IDENTIFICADA",
          "PROPOSTA",
          "CONTRATADO",
          "SEM_OPORTUNIDADE",
        ].map(
          (id) => ({
            id,
            label:
              statusOportunidadeLabel(
                id
              ),
          })
        ),

        prioridades: [
          "A",
          "B",
          "C",
          "D",
        ],
      },

      metodologia: {
        leads:
          "Quantidade de registros em diagnostico_leads no período e filtros selecionados.",

        diagnosticosConcluidos:
          "Quantidade de relatórios efetivamente salvos na tabela diagnosticos.",

        diagnosticosIniciados:
          "Leads com status EM_PREENCHIMENTO, NAO_CONCLUIDO ou CONCLUIDO.",

        atendimentos:
          "Registros em crm_atendimentos_departamento.",

        oportunidades:
          "Atendimentos com status OPORTUNIDADE_IDENTIFICADA, PROPOSTA ou CONTRATADO.",
      },

      disponibilidadeDados: {
        financeiro:
          false,

        mensagemFinanceiro:
          "Valores de oportunidade, proposta, mensalidade e receita recorrente ainda não possuem campos estruturados no CRM.",

        comparativoPeriodoAnterior:
          false,

        mensagemComparativo:
          "Comparação automática com o período anterior ainda não foi implementada neste endpoint.",
      },
    });
  } catch (error) {
    console.error(
      "[dashboard]",
      error
    );

    return res.status(500).json({
      sucesso: false,

      error:
        "Não foi possível carregar os dados do Dashboard.",

      detalhe:
        process.env
          .NODE_ENV ===
        "development"
          ? String(
              error?.message ||
              error
            )
          : undefined,
    });
  }
}


export default dashboardHandler;
