import { neon } from "@neondatabase/serverless";
import {
  exigirAutenticacao,
} from "./lib/auth.js";

const sql = neon(
  process.env.DATABASE_URL
);

// =========================================================
// HELPERS
// =========================================================

function objeto(valor) {
  return (
    valor &&
    typeof valor === "object" &&
    !Array.isArray(valor)
  )
    ? valor
    : {};
}

function lista(valor) {
  return Array.isArray(valor)
    ? valor
    : [];
}

function texto(valor) {
  return String(
    valor ?? ""
  ).trim();
}

function numero(valor, padrao = 0) {
  const n = Number(valor);

  return Number.isFinite(n)
    ? n
    : padrao;
}

function estruturaDe(row) {
  const completo =
    objeto(
      row?.dados_completos
    );

  const perfil =
    objeto(
      completo?.perfil
    );

  const resultado =
    objeto(
      completo?.resultado
    );

  if (
    perfil?.estruturaNegocio
  ) {
    return perfil
      .estruturaNegocio;
  }

  if (
    resultado
      ?.contextoEstrutura
      ?.estruturaNegocio
  ) {
    return resultado
      .contextoEstrutura
      .estruturaNegocio;
  }

  const segmento =
    texto(
      row?.segmento
    ).toLowerCase();

  const razao =
    texto(
      row?.razao_social
    ).toLowerCase();

  if (
    segmento.includes(
      "pessoa física"
    ) ||
    segmento.includes(
      "pessoa fisica"
    )
  ) {
    return "pessoa_fisica";
  }

  if (
    razao.includes(
      "avaliação de holding"
    ) ||
    razao.includes(
      "avaliacao de holding"
    )
  ) {
    return "avaliar_holding";
  }

  if (
    segmento.includes(
      "holding"
    ) ||
    razao.includes(
      "holding"
    )
  ) {
    return "holding";
  }

  if (
    segmento.includes(
      "grupo empresarial"
    )
  ) {
    return "grupo";
  }

  if (
    segmento.includes(
      "spe"
    )
  ) {
    return "spe";
  }

  return "operacional";
}

// =========================================================
// GARANTE CAMPOS DE ARQUIVAMENTO
// =========================================================

async function garantirArquivamento() {
  try {
    await sql`
      ALTER TABLE diagnosticos
      ADD COLUMN IF NOT EXISTS
        arquivado BOOLEAN
        NOT NULL
        DEFAULT FALSE
    `;

    await sql`
      ALTER TABLE diagnosticos
      ADD COLUMN IF NOT EXISTS
        arquivado_em TIMESTAMPTZ
    `;
  } catch (error) {
    console.warn(
      "[diagnosticos] Não foi possível validar campos de arquivamento:",
      error?.message || error
    );
  }
}

// =========================================================
// LISTAR
// GET /api/diagnosticos?action=listar
// =========================================================

async function listarDiagnosticos(
  req,
  res
) {
  const usuario =
    exigirAutenticacao(
      req,
      res
    );

  if (!usuario) {
    return;
  }

  await garantirArquivamento();

  const busca =
    texto(
      req.query?.busca
    );

  const arquivamento =
    texto(
      req.query
        ?.arquivamento ||
      "ATIVOS"
    ).toUpperCase();

  const limite =
    Math.max(
      1,
      Math.min(
        300,
        numero(
          req.query?.limite,
          100
        )
      )
    );

  const offset =
    Math.max(
      0,
      numero(
        req.query?.offset,
        0
      )
    );

  const termo =
    `%${busca}%`;

  try {
    const rows =
      await sql`
        SELECT
          id,
          criado_em,
          nome,
          cargo,
          telefone,
          email,
          cnpj,
          razao_social,
          descricao_negocio,
          segmento,
          subsegmento,
          score,
          dores,
          areas_selecionadas,
          dados_completos,
          arquivado,
          arquivado_em
        FROM diagnosticos
        WHERE
          (
            ${busca} = ''
            OR nome ILIKE ${termo}
            OR email ILIKE ${termo}
            OR telefone ILIKE ${termo}
            OR cnpj ILIKE ${termo}
            OR razao_social ILIKE ${termo}
            OR segmento ILIKE ${termo}
            OR subsegmento ILIKE ${termo}
          )
          AND
          (
            ${arquivamento} = 'TODOS'

            OR
            (
              ${arquivamento} = 'ARQUIVADOS'
              AND COALESCE(
                arquivado,
                FALSE
              ) = TRUE
            )

            OR
            (
              ${arquivamento}
                NOT IN (
                  'TODOS',
                  'ARQUIVADOS'
                )

              AND COALESCE(
                arquivado,
                FALSE
              ) = FALSE
            )
          )
        ORDER BY
          criado_em DESC
        LIMIT ${limite}
        OFFSET ${offset}
      `;

    const contagem =
      await sql`
        SELECT
          COUNT(*)::INTEGER
            AS total
        FROM diagnosticos
        WHERE
          (
            ${busca} = ''
            OR nome ILIKE ${termo}
            OR email ILIKE ${termo}
            OR telefone ILIKE ${termo}
            OR cnpj ILIKE ${termo}
            OR razao_social ILIKE ${termo}
            OR segmento ILIKE ${termo}
            OR subsegmento ILIKE ${termo}
          )
          AND
          (
            ${arquivamento} = 'TODOS'

            OR
            (
              ${arquivamento} = 'ARQUIVADOS'
              AND COALESCE(
                arquivado,
                FALSE
              ) = TRUE
            )

            OR
            (
              ${arquivamento}
                NOT IN (
                  'TODOS',
                  'ARQUIVADOS'
                )

              AND COALESCE(
                arquivado,
                FALSE
              ) = FALSE
            )
          )
      `;

    const diagnosticos =
      (rows || []).map(
        (row) => {
          const completo =
            objeto(
              row
                .dados_completos
            );

          return {
            id:
              row.id,

            criadoEm:
              row.criado_em,

            nome:
              row.nome ||
              "",

            cargo:
              row.cargo ||
              "",

            telefone:
              row.telefone ||
              "",

            email:
              row.email ||
              "",

            cnpj:
              row.cnpj ||
              "",

            razaoSocial:
              row.razao_social ||
              "",

            descricaoNegocio:
              row
                .descricao_negocio ||
              "",

            segmento:
              row.segmento ||
              "",

            subsegmento:
              row.subsegmento ||
              "",

            score:
              row.score ===
                null
                ? null
                : numero(
                    row.score
                  ),

            dores:
              lista(
                row.dores
              ),

            areas:
              lista(
                row
                  .areas_selecionadas
              ),

            estruturaNegocio:
              estruturaDe(
                row
              ),

            perfil:
              objeto(
                completo
                  .perfil
              ),

            arquivado:
              Boolean(
                row.arquivado
              ),

            arquivadoEm:
              row
                .arquivado_em ||
              null,
          };
        }
      );

    return res
      .status(200)
      .json({
        sucesso: true,

        total:
          numero(
            contagem?.[0]
              ?.total
          ),

        diagnosticos,
      });

  } catch (error) {
    console.error(
      "[diagnosticos:listar]",
      error
    );

    return res
      .status(500)
      .json({
        sucesso: false,
        error:
          "Não foi possível carregar os diagnósticos.",
      });
  }
}

// =========================================================
// VER DIAGNÓSTICO
// GET /api/diagnosticos?action=ver&id=XXX
// =========================================================

async function verDiagnostico(
  req,
  res
) {
  const usuario =
    exigirAutenticacao(
      req,
      res
    );

  if (!usuario) {
    return;
  }

  const id =
    texto(
      req.query?.id
    );

  if (!id) {
    return res
      .status(400)
      .json({
        sucesso: false,
        error:
          "Informe o ID do diagnóstico.",
      });
  }

  try {
    const rows =
      await sql`
        SELECT
          id,
          criado_em,
          nome,
          cargo,
          telefone,
          email,
          cnpj,
          razao_social,
          descricao_negocio,
          segmento,
          subsegmento,
          score,
          dores,
          areas_selecionadas,
          empresas,
          negocio_interpretado,
          perguntas_respostas,
          diagnostico,
          dados_completos
        FROM diagnosticos
        WHERE
          id::text = ${id}
        LIMIT 1
      `;

    const row =
      rows?.[0];

    if (!row) {
      return res
        .status(404)
        .json({
          sucesso: false,
          error:
            "Diagnóstico não encontrado.",
        });
    }

    const completo =
      objeto(
        row
          .dados_completos
      );

    const responsavel =
      objeto(
        completo
          .responsavel
      );

    const empresa =
      objeto(
        completo
          .empresa
      );

    const perfil =
      objeto(
        completo
          .perfil
      );

    const resultadoCompleto =
      objeto(
        completo
          .resultado
      );

    const resultado =
      Object.keys(
        resultadoCompleto
      ).length
        ? resultadoCompleto
        : objeto(
            row
              .diagnostico
          );

    return res
      .status(200)
      .json({
        sucesso: true,

        diagnostico: {
          id:
            row.id,

          criadoEm:
            row.criado_em,

          score:
            row.score,

          estruturaNegocio:
            estruturaDe(
              row
            ),

          participante: {
            nome:
              responsavel
                .nome ||
              row.nome ||
              "",

            cargo:
              responsavel
                .cargo ||
              row.cargo ||
              "",

            telefone:
              responsavel
                .telefone ||
              row.telefone ||
              "",

            email:
              responsavel
                .email ||
              row.email ||
              "",

            consentimentoEmail:
              responsavel
                .consentimentoEmail ??
              null,
          },

          empresa: {
            ...empresa,

            razao:
              empresa.razao ||
              empresa
                .razaoSocial ||
              row
                .razao_social ||
              "",

            razaoSocial:
              empresa
                .razaoSocial ||
              empresa.razao ||
              row
                .razao_social ||
              "",

            cnpj:
              empresa.cnpj ||
              empresa
                .cnpjDigits ||
              row.cnpj ||
              "",

            descricaoNegocio:
              perfil
                .descricaoNegocio ||
              row
                .descricao_negocio ||
              "",

            segmento:
              empresa
                .segmento ||
              row.segmento ||
              "",

            subsegmento:
              empresa
                .subsegmento ||
              row
                .subsegmento ||
              "",
          },

          perfil,

          holding:
            perfil.holding ||
            resultado
              ?.contextoEstrutura
              ?.holding ||
            {},

          pessoaFisica:
            perfil
              .pessoaFisica ||
            resultado
              ?.contextoEstrutura
              ?.pessoaFisica ||
            {},

          grupo:
            perfil.grupo ||
            resultado
              ?.contextoEstrutura
              ?.grupo ||
            {},

          spe:
            perfil.spe ||
            resultado
              ?.contextoEstrutura
              ?.spe ||
            {},

          empresas:
            lista(
              completo
                .empresas
            ).length
              ? lista(
                  completo
                    .empresas
                )
              : lista(
                  row.empresas
                ),

          dores:
            lista(
              perfil
                .doresSelecionadas
            ).length
              ? lista(
                  perfil
                    .doresSelecionadas
                )
              : lista(
                  row.dores
                ),

          doresEstruturadas: {
            principal:
              perfil
                .dorPrincipal ||
              "",

            objetivo90Dias:
              perfil
                .dor90Dias ||
              "",

            impactos:
              lista(
                perfil
                  .impactosDor
              ),
          },

          areas:
            lista(
              row
                .areas_selecionadas
            ),

          negocioInterpretado:
            Object.keys(
              objeto(
                perfil
                  .negocioInterpretado
              )
            ).length
              ? objeto(
                  perfil
                    .negocioInterpretado
                )
              : objeto(
                  row
                    .negocio_interpretado
                ),

          perguntasRespostas:
            lista(
              completo
                .respostas
            ).length
              ? lista(
                  completo
                    .respostas
                )
              : lista(
                  row
                    .perguntas_respostas
                ),

          resultado,

          dadosCompletos:
            completo,
        },
      });

  } catch (error) {
    console.error(
      "[diagnosticos:ver]",
      error
    );

    return res
      .status(500)
      .json({
        sucesso: false,
        error:
          "Não foi possível abrir o diagnóstico.",
      });
  }
}

// =========================================================
// SALVAR DIAGNÓSTICO
// POST /api/diagnosticos?action=salvar
//
// Essa ação permanece pública porque é utilizada pelo App
// para registrar o diagnóstico do participante.
// =========================================================

async function salvarDiagnostico(
  req,
  res
) {
  try {
    const dados =
      req.body || {};

    const responsavel =
      objeto(
        dados
          .responsavel
      );

    const empresa =
      objeto(
        dados.empresa
      );

    const perfil =
      objeto(
        dados.perfil
      );

    const resultadoDados =
      objeto(
        dados
          .resultado
      );

    const nome =
      texto(
        responsavel.nome ||
        dados.nome ||
        dados
          .nomeParticipante
      );

    const cargo =
      texto(
        responsavel.cargo ||
        dados.cargo ||
        dados.funcao
      );

    const telefone =
      texto(
        responsavel
          .telefone ||
        dados.telefone ||
        dados.whatsapp
      );

    const email =
      texto(
        responsavel.email ||
        dados.email
      );

    const cnpj =
      texto(
        empresa.cnpj ||
        empresa
          .cnpjDigits ||
        dados.cnpj
      );

    const razaoSocial =
      texto(
        empresa.razao ||
        empresa
          .razaoSocial ||
        dados.razaoSocial ||
        dados
          .razao_social
      );

    const descricaoNegocio =
      texto(
        perfil
          .descricaoNegocio ||
        empresa
          .descricaoNegocio ||
        dados
          .descricaoNegocio ||
        dados
          .descricao_negocio
      );

    const segmento =
      texto(
        empresa.segmento ||
        dados.segmento
      );

    const subsegmento =
      texto(
        empresa
          .subsegmento ||
        dados
          .subsegmento ||
        perfil
          ?.negocioInterpretado
          ?.subsegmento
      );

    const score =
      numero(
        resultadoDados
          .scoreGeral ??
        dados.score ??
        dados
          .pontuacao,
        0
      );

    const dores =
      lista(
        perfil
          .doresSelecionadas
      ).length
        ? lista(
            perfil
              .doresSelecionadas
          )
        : lista(
            dados.dores
          );

    const areasSelecionadas =
      lista(
        perfil
          .areasSelecionadas
      ).length
        ? lista(
            perfil
              .areasSelecionadas
          )
        : lista(
            dados
              .areasSelecionadas
          );

    const empresas =
      lista(
        dados.empresas
      );

    const negocioInterpretado =
      objeto(
        perfil
          .negocioInterpretado ||
        dados
          .negocioInterpretado
      );

    const perguntasRespostas =
      lista(
        resultadoDados
          .respostas
      ).length
        ? lista(
            resultadoDados
              .respostas
          )
        : lista(
            dados.respostas
          );

    const diagnostico =
      Object.keys(
        resultadoDados
      ).length
        ? resultadoDados
        : objeto(
            dados
              .diagnostico
          );

    const rows =
      await sql`
        INSERT INTO diagnosticos (
          nome,
          cargo,
          telefone,
          email,
          cnpj,
          razao_social,
          descricao_negocio,
          segmento,
          subsegmento,
          score,
          dores,
          areas_selecionadas,
          empresas,
          negocio_interpretado,
          perguntas_respostas,
          diagnostico,
          dados_completos
        )
        VALUES (
          ${nome},
          ${cargo},
          ${telefone},
          ${email},
          ${cnpj},
          ${razaoSocial},
          ${descricaoNegocio},
          ${segmento},
          ${subsegmento},
          ${score},

          ${JSON.stringify(
            dores
          )}::jsonb,

          ${JSON.stringify(
            areasSelecionadas
          )}::jsonb,

          ${JSON.stringify(
            empresas
          )}::jsonb,

          ${JSON.stringify(
            negocioInterpretado
          )}::jsonb,

          ${JSON.stringify(
            perguntasRespostas
          )}::jsonb,

          ${JSON.stringify(
            diagnostico
          )}::jsonb,

          ${JSON.stringify(
            dados
          )}::jsonb
        )
        RETURNING
          id,
          criado_em,
          nome,
          razao_social,
          cnpj,
          email,
          score
      `;

    const salvo =
      rows?.[0];

    return res
      .status(201)
      .json({
        sucesso: true,
        ok: true,

        mensagem:
          "Diagnóstico salvo com sucesso.",

        id:
          salvo?.id ||
          "",

        diagnosticoId:
          salvo?.id ||
          "",

        diagnostico:
          salvo ||
          null,
      });

  } catch (error) {
    console.error(
      "[diagnosticos:salvar]",
      error
    );

    return res
      .status(500)
      .json({
        sucesso: false,
        ok: false,

        error:
          "Não foi possível salvar o diagnóstico.",
      });
  }
}

// =========================================================
// EXPORTAR
// GET /api/diagnosticos?action=exportar
// =========================================================

async function exportarDiagnosticos(
  req,
  res
) {
  const usuario =
    exigirAutenticacao(
      req,
      res
    );

  if (!usuario) {
    return;
  }

  try {
    const rows =
      await sql`
        SELECT
          id,
          criado_em,
          nome,
          cargo,
          telefone,
          email,
          cnpj,
          razao_social,
          descricao_negocio,
          segmento,
          subsegmento,
          score,
          dores,
          areas_selecionadas,
          empresas,
          negocio_interpretado,
          perguntas_respostas,
          diagnostico,
          dados_completos
        FROM diagnosticos
        ORDER BY
          criado_em DESC
      `;

    const diagnosticos =
      (rows || []).map(
        (row) => {
          const completo =
            objeto(
              row
                .dados_completos
            );

          const perfil =
            objeto(
              completo.perfil
            );

          const resultadoCompleto =
            objeto(
              completo
                .resultado
            );

          return {
            id:
              row.id,

            criadoEm:
              row.criado_em,

            estruturaNegocio:
              estruturaDe(
                row
              ),

            participante: {
              nome:
                row.nome ||
                "",

              cargo:
                row.cargo ||
                "",

              telefone:
                row.telefone ||
                "",

              email:
                row.email ||
                "",
            },

            empresa: {
              cnpj:
                row.cnpj ||
                "",

              razaoSocial:
                row
                  .razao_social ||
                "",

              descricaoNegocio:
                row
                  .descricao_negocio ||
                "",

              segmento:
                row.segmento ||
                "",

              subsegmento:
                row
                  .subsegmento ||
                "",
            },

            score:
              row.score ===
                null
                ? null
                : numero(
                    row.score
                  ),

            dores:
              lista(
                row.dores
              ),

            doresEstruturadas: {
              selecionadas:
                lista(
                  perfil
                    .doresSelecionadas
                ),

              principal:
                perfil
                  .dorPrincipal ||
                "",

              objetivo90Dias:
                perfil
                  .dor90Dias ||
                "",

              impactos:
                lista(
                  perfil
                    .impactosDor
                ),
            },

            areas:
              lista(
                row
                  .areas_selecionadas
              ),

            empresas:
              lista(
                row.empresas
              ),

            negocioInterpretado:
              objeto(
                row
                  .negocio_interpretado
              ),

            perguntasRespostas:
              lista(
                row
                  .perguntas_respostas
              ),

            resultado:
              Object.keys(
                resultadoCompleto
              ).length
                ? resultadoCompleto
                : objeto(
                    row
                      .diagnostico
                  ),

            dadosCompletos:
              completo,
          };
        }
      );

    return res
      .status(200)
      .json({
        sucesso: true,

        total:
          diagnosticos.length,

        diagnosticos,
      });

  } catch (error) {
    console.error(
      "[diagnosticos:exportar]",
      error
    );

    return res
      .status(500)
      .json({
        sucesso: false,
        error:
          "Não foi possível exportar os diagnósticos.",
      });
  }
}

// =========================================================
// ARQUIVAR / DESARQUIVAR
//
// POST /api/diagnosticos?action=arquivar
// POST /api/diagnosticos?action=desarquivar
// =========================================================

async function alterarArquivamento(
  req,
  res,
  arquivado
) {
  const usuario =
    exigirAutenticacao(
      req,
      res
    );

  if (!usuario) {
    return;
  }

  await garantirArquivamento();

  const diagnosticoId =
    texto(
      req.body
        ?.diagnosticoId
    );

  if (!diagnosticoId) {
    return res
      .status(400)
      .json({
        sucesso: false,
        error:
          "diagnosticoId é obrigatório.",
      });
  }

  try {
    const rows =
      await sql`
        UPDATE diagnosticos
        SET
          arquivado =
            ${arquivado},

          arquivado_em =
            CASE
              WHEN ${arquivado}
                THEN NOW()
              ELSE NULL
            END

        WHERE
          id::text =
            ${diagnosticoId}

        RETURNING
          id,
          arquivado,
          arquivado_em
      `;

    if (!rows?.[0]) {
      return res
        .status(404)
        .json({
          sucesso: false,
          error:
            "Diagnóstico não encontrado.",
        });
    }

    // Tenta refletir o arquivamento
    // no CRM, mas não quebra a operação
    // caso alguma tabela ainda não exista.
    try {
      await sql`
        UPDATE diagnostico_leads
        SET
          arquivado =
            ${arquivado},

          arquivado_em =
            CASE
              WHEN ${arquivado}
                THEN NOW()
              ELSE NULL
            END,

          updated_at =
            NOW()

        WHERE
          diagnostico_id =
            ${diagnosticoId}
      `;
    } catch (error) {
      console.warn(
        "[diagnosticos] Lead CRM não atualizado:",
        error?.message || error
      );
    }

    try {
      await sql`
        UPDATE crm_atendimentos_departamento
        SET
          arquivado =
            ${arquivado},

          arquivado_em =
            CASE
              WHEN ${arquivado}
                THEN NOW()
              ELSE NULL
            END,

          updated_at =
            NOW()

        WHERE
          diagnostico_id =
            ${diagnosticoId}
      `;
    } catch (error) {
      console.warn(
        "[diagnosticos] Atendimento CRM não atualizado:",
        error?.message || error
      );
    }

    return res
      .status(200)
      .json({
        sucesso: true,

        diagnosticoId,

        arquivado:
          Boolean(
            rows[0]
              .arquivado
          ),

        arquivadoEm:
          rows[0]
            .arquivado_em ||
          null,
      });

  } catch (error) {
    console.error(
      "[diagnosticos:arquivar]",
      error
    );

    return res
      .status(500)
      .json({
        sucesso: false,
        error:
          "Não foi possível alterar o arquivamento.",
      });
  }
}

// =========================================================
// EXCLUIR
// POST /api/diagnosticos?action=excluir
// =========================================================

async function excluirDiagnostico(
  req,
  res
) {
  const usuario =
    exigirAutenticacao(
      req,
      res
    );

  if (!usuario) {
    return;
  }

  const diagnosticoId =
    texto(
      req.body
        ?.diagnosticoId
    );

  if (!diagnosticoId) {
    return res
      .status(400)
      .json({
        sucesso: false,
        error:
          "diagnosticoId é obrigatório.",
      });
  }

  try {
    // Remove dados relacionados primeiro.
    // Cada bloco é isolado para preservar
    // compatibilidade com bancos antigos.

    try {
      await sql`
        DELETE FROM
          crm_atendimento_historico
        WHERE
          diagnostico_id =
            ${diagnosticoId}
      `;
    } catch (error) {
      console.warn(
        "[diagnosticos] histórico CRM:",
        error?.message || error
      );
    }

    try {
      await sql`
        DELETE FROM
          crm_propostas
        WHERE
          diagnostico_id =
            ${diagnosticoId}
      `;
    } catch (error) {
      console.warn(
        "[diagnosticos] propostas CRM:",
        error?.message || error
      );
    }

    try {
      await sql`
        DELETE FROM
          crm_atendimentos_departamento
        WHERE
          diagnostico_id =
            ${diagnosticoId}
      `;
    } catch (error) {
      console.warn(
        "[diagnosticos] atendimentos CRM:",
        error?.message || error
      );
    }

    try {
      await sql`
        DELETE FROM
          diagnostico_leads
        WHERE
          diagnostico_id =
            ${diagnosticoId}
      `;
    } catch (error) {
      console.warn(
        "[diagnosticos] leads CRM:",
        error?.message || error
      );
    }

    const rows =
      await sql`
        DELETE FROM
          diagnosticos
        WHERE
          id::text =
            ${diagnosticoId}
        RETURNING id
      `;

    if (!rows?.[0]) {
      return res
        .status(404)
        .json({
          sucesso: false,
          error:
            "Diagnóstico não encontrado.",
        });
    }

    return res
      .status(200)
      .json({
        sucesso: true,

        diagnosticoId,

        excluido: true,
      });

  } catch (error) {
    console.error(
      "[diagnosticos:excluir]",
      error
    );

    return res
      .status(500)
      .json({
        sucesso: false,
        error:
          "Não foi possível excluir o diagnóstico.",
      });
  }
}

// =========================================================
// HANDLER ÚNICO
// =========================================================

export default async function handler(
  req,
  res
) {
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

  const action =
    texto(
      req.query?.action ||
      req.body?.action ||
      (
        req.method === "GET"
          ? "listar"
          : ""
      )
    ).toLowerCase();

  // =====================================================
  // GET
  // =====================================================

  if (
    req.method === "GET" &&
    action === "listar"
  ) {
    return listarDiagnosticos(
      req,
      res
    );
  }

  if (
    req.method === "GET" &&
    action === "ver"
  ) {
    return verDiagnostico(
      req,
      res
    );
  }

  if (
    req.method === "GET" &&
    action === "exportar"
  ) {
    return exportarDiagnosticos(
      req,
      res
    );
  }

  // =====================================================
  // POST
  // =====================================================

  if (
    req.method === "POST" &&
    action === "salvar"
  ) {
    return salvarDiagnostico(
      req,
      res
    );
  }

  if (
    req.method === "POST" &&
    action === "arquivar"
  ) {
    return alterarArquivamento(
      req,
      res,
      true
    );
  }

  if (
    req.method === "POST" &&
    action === "desarquivar"
  ) {
    return alterarArquivamento(
      req,
      res,
      false
    );
  }

  if (
    req.method === "POST" &&
    action === "excluir"
  ) {
    return excluirDiagnostico(
      req,
      res
    );
  }

  res.setHeader(
    "Allow",
    "GET, POST"
  );

  return res
    .status(404)
    .json({
      sucesso: false,

      error:
        `Ação "${action || "não informada"}" não encontrada em /api/diagnosticos.`,
    });
}
