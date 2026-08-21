// api/enviar-relatorio.js

import { neon } from "@neondatabase/serverless";

// =========================================================
// FUNÇÕES AUXILIARES
// =========================================================


function limparCodigoInternoRelatorio(
  valor
) {
  return String(
    valor ||
    ""
  )
    .replace(
      /\s*\(\s*resposta\s*:\s*['"][^'"]*['"]\s+para\s+[a-z0-9_:-]+\s*\)/gi,
      ""
    )
    .replace(
      /\s*[—-]\s*Id\s*:\s*[a-z0-9_:-]+/gi,
      ""
    )
    .replace(
      /\s*[—-]\s*Tipo\s*:\s*[a-z0-9_:-]+/gi,
      ""
    )
    .replace(
      /\s*[—-]\s*Ligado\s*A\s*:\s*[a-z0-9_:-]+/gi,
      ""
    )
    .replace(
      /\s*[—-]\s*Risco\s*Mitigado\s*:\s*[a-z0-9_:-]+/gi,
      ""
    )
    .replace(
      /\s*\([a-z0-9_]+\s*=\s*['"][^'"]*['"]\s*\)/gi,
      ""
    )
    .replace(
      /\s{2,}/g,
      " "
    )
    .replace(
      /\s+([.,;:])/g,
      "$1"
    )
    .trim();
}

function escaparHtml(valor = "") {
  return limparCodigoInternoRelatorio(
    valor
  )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function arraySeguro(valor) {
  return Array.isArray(valor) ? valor : [];
}

function objetoSeguro(valor) {
  return (
    valor &&
    typeof valor === "object" &&
    !Array.isArray(valor)
  )
    ? valor
    : {};
}

function textoSeguro(valor, fallback = "") {
  if (
    valor === null ||
    valor === undefined
  ) {
    return fallback;
  }

  return String(valor);
}

function listaHtml(
  lista = [],
  vazio = "Nenhuma informação registrada."
) {
  const itens =
    arraySeguro(lista).filter(Boolean);

  if (!itens.length) {
    return `<li>${escaparHtml(vazio)}</li>`;
  }

  return itens
    .map(
      (item) =>
        `<li>${escaparHtml(item)}</li>`
    )
    .join("");
}

function formatarCnae(cnae) {
  if (!cnae) return "-";

  if (typeof cnae === "string") {
    return escaparHtml(cnae);
  }

  const codigo =
    cnae.codigo ||
    cnae.code ||
    "";

  const descricao =
    cnae.descricao ||
    cnae.text ||
    cnae.nome ||
    "";

  return escaparHtml(
    [codigo, descricao]
      .filter(Boolean)
      .join(" — ") || "-"
  );
}

function formatarAtividades(lista = []) {
  const atividades =
    arraySeguro(lista);

  if (!atividades.length) {
    return "-";
  }

  return atividades
    .map((atividade) => {
      if (
        typeof atividade ===
        "string"
      ) {
        return escaparHtml(
          atividade
        );
      }

      const codigo =
        atividade?.codigo ||
        atividade?.code ||
        "";

      const descricao =
        atividade?.descricao ||
        atividade?.text ||
        atividade?.nome ||
        "";

      return escaparHtml(
        [codigo, descricao]
          .filter(Boolean)
          .join(" — ")
      );
    })
    .join("<br>");
}

function valorResposta(valor) {
  const texto =
    String(valor ?? "")
      .trim()
      .toLowerCase();

  if (texto === "sim") {
    return "Sim";
  }

  if (
    texto === "nao" ||
    texto === "não"
  ) {
    return "Não";
  }

  if (
    texto === "parcialmente" ||
    texto === "parcial"
  ) {
    return "Parcialmente";
  }

  return String(
    valor ?? "-"
  );
}

function nivelTexto(nivel) {
  const mapa = {
    bom: "Bom",
    atencao: "Atenção",
    atenção: "Atenção",
    alto: "Risco alto",
    critico: "Crítico",
    crítico: "Crítico",
    emergencial: "Emergencial",
  };

  const chave =
    String(nivel || "")
      .trim()
      .toLowerCase();

  return (
    mapa[chave] ||
    nivel ||
    "-"
  );
}

function prioridadeTexto(
  prioridade
) {
  const mapa = {
    imediata: "Imediata",
    alta: "Alta",
    media: "Média",
    média: "Média",
    baixa: "Baixa",
  };

  const chave =
    String(
      prioridade || ""
    )
      .trim()
      .toLowerCase();

  return (
    mapa[chave] ||
    prioridade ||
    "-"
  );
}

// =========================================================
// NORMALIZAÇÃO DAS ÁREAS
// =========================================================

function normalizarAreas(
  areas = []
) {
  return arraySeguro(areas).map(
    (area) => {
      const item =
        objetoSeguro(area);

      return {
        // mantém tudo que a IA enviou
        ...item,

        area:
          item.area ||
          item.nome ||
          "",

        score:
          item.score ??
          null,

        nivel:
          item.nivel ||
          "",

        prioridade:
          item.prioridade ??
          null,

        resumo:
          item.resumo ||
          "",

        achados:
          arraySeguro(
            item.achados
          ),

        causasProvaveis:
          arraySeguro(
            item.causasProvaveis
          ),

        riscos:
          arraySeguro(
            item.riscos
          ),

        recomendacoes:
          arraySeguro(
            item.recomendacoes
          ),
      };
    }
  );
}

// =========================================================
// PERGUNTAS / RESPOSTAS
//
// O App.jsx envia hoje algo semelhante a:
//
// resultado.respostas = [
//   {
//     area: "Administrativo",
//     score: 41,
//     subtemas: [
//       {
//         tema: "...",
//         perguntas: [
//           {
//             pergunta: "...",
//             resposta: "sim"
//           }
//         ]
//       }
//     ]
//   }
// ]
//
// Esta função transforma isso em uma lista simples.
// =========================================================

function achatarRespostasResultado(
  respostasResultado = []
) {
  const saida = [];

  arraySeguro(
    respostasResultado
  ).forEach(
    (
      blocoArea,
      areaIndex
    ) => {
      const area =
        objetoSeguro(
          blocoArea
        );

      const nomeArea =
        area.area ||
        area.nome ||
        "-";

      // Formato aninhado:
      // area > subtemas > perguntas
      if (
        Array.isArray(
          area.subtemas
        )
      ) {
        area.subtemas.forEach(
          (
            blocoTema,
            temaIndex
          ) => {
            const subtema =
              objetoSeguro(
                blocoTema
              );

            const tema =
              subtema.tema ||
              "-";

            arraySeguro(
              subtema.perguntas
            ).forEach(
              (
                perguntaItem,
                perguntaIndex
              ) => {
                const p =
                  objetoSeguro(
                    perguntaItem
                  );

                saida.push({
                  id:
                    p.id ||
                    `area_${areaIndex + 1}_tema_${temaIndex + 1}_pergunta_${perguntaIndex + 1}`,

                  area:
                    p.area ||
                    nomeArea,

                  areaId:
                    p.areaId ||
                    "",

                  tema:
                    p.tema ||
                    tema,

                  pergunta:
                    p.pergunta ||
                    p.texto ||
                    p.text ||
                    "-",

                  resposta:
                    p.resposta ??
                    p.valor ??
                    "-",

                  peso:
                    p.peso ??
                    p.importancia ??
                    null,

                  importancia:
                    p.importancia ??
                    p.peso ??
                    null,

                  motivo:
                    p.motivo ||
                    "",

                  riscoAvaliado:
                    p.riscoAvaliado ||
                    p.risco ||
                    "",

                  scoreArea:
                    area.score ??
                    null,
                });
              }
            );
          }
        );

        return;
      }

      // Formato já achatado
      if (
        area.pergunta ||
        area.texto
      ) {
        saida.push({
          id:
            area.id ||
            areaIndex + 1,

          area:
            nomeArea,

          areaId:
            area.areaId ||
            "",

          tema:
            area.tema ||
            "-",

          pergunta:
            area.pergunta ||
            area.texto ||
            "-",

          resposta:
            area.resposta ??
            area.valor ??
            "-",

          peso:
            area.peso ??
            area.importancia ??
            null,

          importancia:
            area.importancia ??
            area.peso ??
            null,

          motivo:
            area.motivo ||
            "",

          riscoAvaliado:
            area.riscoAvaliado ||
            area.risco ||
            "",
        });
      }
    }
  );

  return saida;
}

// =========================================================
// NORMALIZAR PERGUNTAS E RESPOSTAS
// =========================================================

function normalizarPerguntasRespostas({
  perguntas,
  respostas,
  resultado,
}) {
  const perguntasOriginais =
    arraySeguro(perguntas);

  const respostasOriginais =
    arraySeguro(respostas);

  const mapaPerguntas =
    new Map();

  perguntasOriginais.forEach(
    (pergunta) => {
      if (
        pergunta?.id !==
        undefined
      ) {
        mapaPerguntas.set(
          String(pergunta.id),
          pergunta
        );
      }
    }
  );

  // 1. Se body.respostas veio preenchido
  if (
    respostasOriginais.length
  ) {
    return respostasOriginais.map(
      (item, index) => {
        const resposta =
          objetoSeguro(item);

        const original =
          resposta.id !==
          undefined
            ? mapaPerguntas.get(
                String(
                  resposta.id
                )
              )
            : null;

        return {
          id:
            resposta.id ??
            original?.id ??
            index + 1,

          area:
            resposta.area ||
            original?.area ||
            "-",

          areaId:
            resposta.areaId ||
            original?.areaId ||
            "",

          tema:
            resposta.tema ||
            original?.tema ||
            "-",

          pergunta:
            resposta.pergunta ||
            resposta.texto ||
            original?.pergunta ||
            original?.texto ||
            "-",

          resposta:
            resposta.resposta ??
            resposta.valor ??
            "-",

          peso:
            resposta.peso ??
            resposta.importancia ??
            original?.peso ??
            original?.importancia ??
            null,

          importancia:
            resposta.importancia ??
            original?.importancia ??
            null,

          motivo:
            resposta.motivo ||
            original?.motivo ||
            "",

          riscoAvaliado:
            resposta.riscoAvaliado ||
            resposta.risco ||
            original?.riscoAvaliado ||
            original?.risco ||
            "",
        };
      }
    );
  }

  // 2. O formato realmente usado pelo App.jsx atual
  const respostasResultado =
    achatarRespostasResultado(
      resultado?.respostas
    );

  if (
    respostasResultado.length
  ) {
    return respostasResultado;
  }

  // 3. Se só perguntas vieram
  if (
    perguntasOriginais.length
  ) {
    return perguntasOriginais.map(
      (item, index) => ({
        id:
          item?.id ??
          index + 1,

        area:
          item?.area ||
          "-",

        areaId:
          item?.areaId ||
          "",

        tema:
          item?.tema ||
          "-",

        pergunta:
          item?.pergunta ||
          item?.texto ||
          "-",

        resposta:
          item?.resposta ??
          "-",

        peso:
          item?.peso ??
          item?.importancia ??
          null,

        importancia:
          item?.importancia ??
          null,

        motivo:
          item?.motivo ||
          "",

        riscoAvaliado:
          item?.riscoAvaliado ||
          item?.risco ||
          "",
      })
    );
  }

  return [];
}

// =========================================================
// HANDLER
// =========================================================

export default async function handler(
  req,
  res
) {
  console.log(
    "[enviar-relatorio] INICIO"
  );

  // =======================================================
  // 1. MÉTODO
  // =======================================================

  if (req.method !== "POST") {
    return res.status(405).json({
      sucesso: false,
      etapa: "metodo",
      error:
        "Método não permitido.",
    });
  }

  // =======================================================
  // 2. DATABASE_URL
  // =======================================================

  if (
    !process.env.DATABASE_URL
  ) {
    console.error(
      "[enviar-relatorio] DATABASE_URL ausente"
    );

    return res.status(500).json({
      sucesso: false,
      etapa:
        "configuracao_banco",
      error:
        "DATABASE_URL não configurada na Vercel.",
    });
  }

  // =======================================================
  // 3. RESEND OPCIONAL
  // =======================================================

  const resendConfigurado =
    Boolean(
      process.env
        .RESEND_API_KEY
    );

  if (!resendConfigurado) {
    console.warn(
      "[enviar-relatorio] RESEND_API_KEY ausente. O diagnóstico será salvo no banco, mas os e-mails não serão enviados."
    );
  }

  // =======================================================
  // 4. NEON
  // =======================================================

  let sql;

  try {
    sql = neon(
      process.env.DATABASE_URL
    );

    console.log(
      "[enviar-relatorio] Neon inicializado"
    );
  } catch (error) {
    console.error(
      "[enviar-relatorio] ERRO_CONEXAO_NEON:",
      error?.message ||
        error
    );

    return res
      .status(500)
      .json({
        sucesso: false,
        etapa:
          "conexao_neon",
        error:
          error?.message ||
          "Erro ao iniciar conexão com Neon.",
      });
  }

  // =======================================================
  // 5. CONFIGURAÇÃO DE E-MAIL
  // =======================================================

  const emailFinder =
    process.env
      .RELATORIO_EMAIL_DESTINO ||
    "contato@finderofsolutions.com.br";

  const emailRemetente =
    process.env
      .RELATORIO_EMAIL_REMETENTE ||
    "Finder of Solutions <onboarding@resend.dev>";

  // =======================================================
  // 6. BODY
  // =======================================================

  const body =
    objetoSeguro(
      req.body
    );

  const responsavel =
    objetoSeguro(
      body.responsavel
    );

  const empresa =
    objetoSeguro(
      body.empresa
    );

  const perfil =
    objetoSeguro(
      body.perfil
    );

  const resultado =
    objetoSeguro(
      body.resultado
    );

  // =======================================================
  // 7. DADOS QUE PODEM VIR EM LOCAIS DIFERENTES
  // =======================================================

  const empresas =
    arraySeguro(
      body.empresas
    ).length
      ? arraySeguro(
          body.empresas
        )
      : empresa &&
          Object.keys(
            empresa
          ).length
        ? [empresa]
        : [];

  const descricaoNegocio =
    textoSeguro(
      body.descricaoNegocio ||
        perfil.descricaoNegocio ||
        empresa.descricaoNegocio ||
        ""
    ).trim();

  const negocioInterpretado =
    objetoSeguro(
      body.negocioInterpretado ||
        perfil.negocioInterpretado
    );

  const perguntas =
    arraySeguro(
      body.perguntas
    );

  const respostas =
    arraySeguro(
      body.respostas
    );

  // =======================================================
  // 8. DIAGNÓSTICO
  // =======================================================

  // Compatibilidade entre o contrato antigo do relatório
  // e o novo contrato retornado por /api/diagnostico.
  const diagnosticoBruto =
    objetoSeguro(
      resultado.diagnosticoGeral ||
      resultado.resultadoCompleto ||
      body.diagnostico ||
      body.resultadoCompleto
    );

  const diagnostico = {
    ...diagnosticoBruto,

    resumoExecutivo:
      diagnosticoBruto.resumoExecutivo ||
      diagnosticoBruto.leituraExecutiva ||
      "",

    principaisDores:
      arraySeguro(
        diagnosticoBruto.principaisDores ||
        diagnosticoBruto.doresPrincipais
      ),

    prioridadesImediatas:
      arraySeguro(
        diagnosticoBruto.prioridadesImediatas ||
        diagnosticoBruto.prioridades
      ),

    pontosFortes:
      arraySeguro(
        diagnosticoBruto.pontosFortes
      ),

    causasProvaveis:
      arraySeguro(
        diagnosticoBruto.causasProvaveis
      ),

    impactos:
      arraySeguro(
        diagnosticoBruto.impactos
      ),

    proximosPassos:
      arraySeguro(
        diagnosticoBruto.proximosPassos
      ),

    leituraDaDor:
      diagnosticoBruto.leituraDaDor ||
      diagnosticoBruto.leituraExecutiva ||
      "",

    alertaEstrategico:
      diagnosticoBruto.alertaEstrategico ||
      arraySeguro(
        diagnosticoBruto.riscosPrioritarios
      )[0] ||
      "",
  };

  const visaoGrupo =
    objetoSeguro(
      resultado.visaoGrupo
    );

  const lacunasDiagnostico =
    arraySeguro(
      resultado.lacunasDiagnostico
    );

  const oportunidadesConsultoria =
    arraySeguro(
      resultado.oportunidadesConsultoria
    );

  const areasOrigem =
    arraySeguro(
      resultado.areas
    ).length
      ? resultado.areas
      : arraySeguro(
          diagnosticoBruto.eixos
        ).map(
          (eixo) => ({
            ...eixo,
            area:
              eixo?.area ||
              eixo?.label ||
              eixo?.id ||
              "Área",
          })
        );

  const areas =
    normalizarAreas(
      areasOrigem
    );

  // =======================================================
  // 9. PRINCIPAIS DADOS
  // =======================================================

  const razaoSocial =
    empresa.razao ||
    empresa.razaoSocial ||
    empresa.nome ||
    "Empresa";

  const cnpj =
    empresa.cnpjDigits ||
    empresa.cnpj ||
    "";

  const nomeResponsavel =
    responsavel.nome ||
    "Não informado";

  const cargoResponsavel =
    responsavel.cargo ||
    "";

  const telefoneLead =
    responsavel.telefone ||
    responsavel.whatsapp ||
    "";

  const emailLead =
    String(
      responsavel.email ||
        ""
    ).trim();

  const segmentoInterpretado =
    negocioInterpretado.segmentoReal ||
    negocioInterpretado.segmento ||
    empresa.segmento ||
    "";

  const subsegmentoInterpretado =
    negocioInterpretado.subsegmento ||
    empresa.subsegmento ||
    "";

  // IMPORTANTE:
  // App.jsx envia scoreGeral diretamente em resultado.
  const scoreBruto =
    resultado.scoreGeral ??
    diagnostico.scoreGeral ??
    null;

  const scoreNumero =
    Number(scoreBruto);

  const score =
    Number.isFinite(
      scoreNumero
    )
      ? scoreNumero
      : null;

  // =======================================================
  // 10. DORES
  // =======================================================

  const doresSelecionadas =
    Array.isArray(
      body?.dores?.selecionadas
    )
      ? body.dores.selecionadas

      : Array.isArray(
          perfil.doresSelecionadas
        )
        ? perfil.doresSelecionadas

        : Array.isArray(
            diagnostico.doresSelecionadas
          )
          ? diagnostico.doresSelecionadas

          : perfil.dorPrincipal
            ? [
                perfil.dorPrincipal,
              ]

            : [];

  const dorPrincipal =
    body?.dores?.principal ||
    perfil.dorPrincipal ||
    doresSelecionadas[0] ||
    "";

  const objetivo90Dias =
    body?.dores
      ?.objetivo90Dias ||
    perfil.dor90Dias ||
    "";

  const impactosDor =
    Array.isArray(
      body?.dores?.impactos
    )
      ? body.dores.impactos

      : Array.isArray(
          perfil.impactosDor
        )
        ? perfil.impactosDor

        : [];

  const doresEstruturadas = {
    selecionadas:
      doresSelecionadas,

    principal:
      dorPrincipal,

    objetivo90Dias,

    impactos:
      impactosDor,
  };

  // =======================================================
  // 11. PERGUNTAS E RESPOSTAS
  // =======================================================

  const respostasNormalizadas =
    normalizarPerguntasRespostas({
      perguntas,
      respostas,
      resultado,
    });

  console.log(
    "[enviar-relatorio] Dados recebidos:",
    {
      areas:
        areas.length,

      perguntasBody:
        perguntas.length,

      respostasBody:
        respostas.length,

      respostasResultado:
        Array.isArray(
          resultado.respostas
        )
          ? resultado
              .respostas
              .length
          : 0,

      respostasNormalizadas:
        respostasNormalizadas.length,

      descricaoNegocio:
        Boolean(
          descricaoNegocio
        ),

      negocioInterpretado:
        Boolean(
          Object.keys(
            negocioInterpretado
          ).length
        ),
    }
  );

  // =======================================================
  // 12. SALVAR NO NEON
  // =======================================================

  let registroSalvo =
    null;

  let erroBanco =
    null;

  try {
    console.log(
      "[enviar-relatorio] Iniciando INSERT Neon"
    );

    /*
     * Não reduzimos mais as áreas.
     *
     * Antes o código salvava só:
     * area / score / nivel / prioridade.
     *
     * Agora salvamos também:
     * resumo
     * achados
     * causasProvaveis
     * riscos
     * recomendacoes
     * e quaisquer campos adicionais enviados pela IA.
     */
    const areasBanco =
      areas;

    const dadosCompletos = {
      schemaVersion: 2,

      recebidoEm:
        new Date()
          .toISOString(),

      responsavel,

      empresa,

      empresas,

      perfil,

      dores:
        doresEstruturadas,

      descricaoNegocio,

      negocioInterpretado,

      perguntas,

      respostas:
        respostasNormalizadas,

      resultado: {
        ...resultado,

        diagnosticoGeral:
          diagnostico,

        resultadoCompleto:
          resultado.resultadoCompleto ||
          diagnosticoBruto,

        areas:
          areasBanco,
      },
    };

    const doresJson =
      JSON.stringify(
        doresSelecionadas
      );

    const areasJson =
      JSON.stringify(
        areasBanco
      );

    const empresasJson =
      JSON.stringify(
        empresas
      );

    const negocioJson =
      JSON.stringify(
        negocioInterpretado
      );

    const respostasJson =
      JSON.stringify(
        respostasNormalizadas
      );

    const diagnosticoJson =
      JSON.stringify({
        ...resultado,

        diagnosticoGeral:
          diagnostico,

        resultadoCompleto:
          resultado.resultadoCompleto ||
          diagnosticoBruto,

        areas:
          areasBanco,

        respostas:
          respostasNormalizadas,

        contextoSalvo: {
          descricaoNegocio,
          dores:
            doresEstruturadas,
        },
      });

    const completoJson =
      JSON.stringify(
        dadosCompletos
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
          ${nomeResponsavel},
          ${cargoResponsavel},
          ${telefoneLead},
          ${emailLead},
          ${cnpj},
          ${razaoSocial},
          ${descricaoNegocio},
          ${segmentoInterpretado},
          ${subsegmentoInterpretado},
          ${score},
          ${doresJson}::jsonb,
          ${areasJson}::jsonb,
          ${empresasJson}::jsonb,
          ${negocioJson}::jsonb,
          ${respostasJson}::jsonb,
          ${diagnosticoJson}::jsonb,
          ${completoJson}::jsonb
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

    registroSalvo =
      rows?.[0] ||
      null;

    console.log(
      "[enviar-relatorio] Diagnóstico salvo no Neon:",
      registroSalvo?.id
    );
  } catch (error) {
    erroBanco =
      error?.message ||
      String(error);

    console.error(
      "[enviar-relatorio] ERRO_BANCO:",
      erroBanco
    );
  }

  // =======================================================
  // 13. HTML RESPOSTAS
  // =======================================================

  const respostasHtml =
    respostasNormalizadas.length
      ? respostasNormalizadas
          .map(
            (
              item,
              index
            ) => `
              <tr>

                <td>
                  ${index + 1}
                </td>

                <td>
                  ${escaparHtml(
                    item.area
                  )}
                </td>

                <td>
                  ${escaparHtml(
                    item.tema
                  )}
                </td>

                <td>
                  ${escaparHtml(
                    item.pergunta
                  )}
                </td>

                <td>
                  <strong>
                    ${escaparHtml(
                      valorResposta(
                        item.resposta
                      )
                    )}
                  </strong>
                </td>

                <td>
                  ${
                    item.peso !==
                      null &&
                    item.peso !==
                      undefined
                      ? escaparHtml(
                          item.peso
                        )
                      : "-"
                  }
                </td>

              </tr>
            `
          )
          .join("")
      : `
        <tr>
          <td colspan="6">
            Nenhuma resposta detalhada recebida.
          </td>
        </tr>
      `;

  // =======================================================
  // 14. HTML ÁREAS
  // =======================================================

  const areasHtml =
    areas.length
      ? areas
          .map(
            (area) => `
              <div class="area">

                <div class="area-header">

                  <div>

                    <h3>
                      ${escaparHtml(
                        area.area ||
                        "Área"
                      )}
                    </h3>

                    <span class="nivel">
                      ${escaparHtml(
                        nivelTexto(
                          area.nivel
                        )
                      )}
                    </span>

                  </div>

                  <div class="score-area">
                    ${
                      area.score ??
                      "-"
                    }/100
                  </div>

                </div>

                ${
                  area.resumo
                    ? `
                      <p>
                        ${escaparHtml(
                          area.resumo
                        )}
                      </p>
                    `
                    : ""
                }

                <div class="grid">

                  <div class="box">

                    <strong>
                      Achados
                    </strong>

                    <ul>
                      ${listaHtml(
                        area.achados,
                        "Nenhum achado relevante."
                      )}
                    </ul>

                  </div>

                  <div class="box">

                    <strong>
                      Possíveis causas
                    </strong>

                    <ul>
                      ${listaHtml(
                        area.causasProvaveis,
                        "Não determinadas."
                      )}
                    </ul>

                  </div>

                  <div class="box">

                    <strong>
                      Riscos
                    </strong>

                    <ul>
                      ${listaHtml(
                        area.riscos,
                        "Nenhum risco relevante informado."
                      )}
                    </ul>

                  </div>

                  <div class="box">

                    <strong>
                      Recomendações
                    </strong>

                    <ol>
                      ${listaHtml(
                        area.recomendacoes,
                        "Nenhuma recomendação adicional."
                      )}
                    </ol>

                  </div>

                </div>

              </div>
            `
          )
          .join("")
      : "";

  // =======================================================
  // 15. LACUNAS
  // =======================================================

  const lacunasHtml =
    lacunasDiagnostico.length
      ? lacunasDiagnostico
          .map(
            (item) => `
              <div class="box">

                <strong>
                  ${escaparHtml(
                    item?.tema ||
                    "Tema"
                  )}
                </strong>

                <p>
                  ${escaparHtml(
                    item?.motivo ||
                    ""
                  )}
                </p>

                ${
                  Array.isArray(
                    item
                      ?.perguntasSugeridas
                  ) &&
                  item
                    .perguntasSugeridas
                    .length
                    ? `
                      <ul>
                        ${listaHtml(
                          item.perguntasSugeridas
                        )}
                      </ul>
                    `
                    : ""
                }

              </div>
            `
          )
          .join("")
      : `
        <p>
          Nenhuma lacuna adicional relevante foi apontada.
        </p>
      `;

  // =======================================================
  // 16. OPORTUNIDADES
  // =======================================================

  const consultoriaHtml =
    oportunidadesConsultoria.length
      ? oportunidadesConsultoria
          .map(
            (item) => `
              <div class="box">

                <strong>
                  ${escaparHtml(
                    item?.oportunidade ||
                    item?.area ||
                    "Oportunidade"
                  )}
                </strong>

                <p>
                  <strong>
                    Prioridade:
                  </strong>

                  ${escaparHtml(
                    prioridadeTexto(
                      item?.prioridade
                    )
                  )}
                </p>

                <p>
                  ${escaparHtml(
                    item?.motivo ||
                    ""
                  )}
                </p>

              </div>
            `
          )
          .join("")
      : "";

  // =======================================================
  // 17. HTML FINDER
  // =======================================================

  const htmlFinder = `
<!doctype html>

<html lang="pt-BR">

<head>

<meta charset="utf-8">

<meta name="viewport"
content="width=device-width,initial-scale=1">

<title>
Diagnóstico Empresarial Finder
</title>

<style>

body {
  margin: 0;
  padding: 0;
  background: #F3F5F8;
  font-family: Arial, Helvetica, sans-serif;
  color: #17233D;
}

.container {
  max-width: 900px;
  margin: 0 auto;
  background: #FFFFFF;
}

.header {
  background: #17233D;
  color: #FFFFFF;
  padding: 32px;
}

.logo {
  max-width: 180px;
  max-height: 70px;
  margin-bottom: 18px;
}

.content {
  padding: 30px;
}

h1 {
  margin: 0 0 8px;
}

h2 {
  margin-top: 32px;
  padding-bottom: 7px;
  border-bottom: 2px solid #FF6B4A;
}

h3 {
  margin-top: 0;
}

p,
li {
  line-height: 1.55;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.box {
  background: #F7F8FB;
  border: 1px solid #E9EDF4;
  padding: 15px;
  border-radius: 10px;
  margin-bottom: 12px;
}

.alerta {
  background: #FAEEDA;
  color: #70410A;
  padding: 18px;
  border-radius: 10px;
}

.score {
  color: #FF6B4A;
  font-size: 34px;
  font-weight: bold;
}

.area {
  margin-bottom: 28px;
}

.area-header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
}

.score-area {
  color: #FF6B4A;
  font-size: 22px;
  font-weight: bold;
}

.nivel {
  color: #5B667A;
  font-size: 12px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  background: #E9EDF5;
  text-align: left;
  padding: 8px;
  font-size: 12px;
}

td {
  padding: 8px;
  border-bottom: 1px solid #E1E5EC;
  vertical-align: top;
  font-size: 12px;
}

.footer {
  background: #17233D;
  color: white;
  padding: 22px 30px;
  font-size: 11px;
}

@media (max-width:650px) {

  .grid {
    grid-template-columns: 1fr;
  }

}

</style>

</head>

<body>

<div class="container">

  <div class="header">

    <img
      src="https://${req.headers.host}/finder-logo.png"
      alt="Finder of Solutions"
      class="logo"
    >

    <h1>
      Diagnóstico Empresarial Finder
    </h1>

    <p>
      Relatório completo do diagnóstico
    </p>

  </div>

  <div class="content">

    <h2>
      Participante
    </h2>

    <div class="grid">

      <div class="box">
        <strong>Nome</strong>
        <p>${escaparHtml(nomeResponsavel)}</p>
      </div>

      <div class="box">
        <strong>Cargo</strong>
        <p>${escaparHtml(cargoResponsavel || "-")}</p>
      </div>

      <div class="box">
        <strong>WhatsApp</strong>
        <p>${escaparHtml(telefoneLead || "-")}</p>
      </div>

      <div class="box">
        <strong>E-mail</strong>
        <p>${escaparHtml(emailLead || "-")}</p>
      </div>

    </div>

    <h2>Empresa</h2>

    <div class="grid">

      <div class="box">
        <strong>Razão social</strong>
        <p>${escaparHtml(razaoSocial)}</p>
      </div>

      <div class="box">
        <strong>CNPJ</strong>
        <p>${escaparHtml(cnpj || "-")}</p>
      </div>

      <div class="box">
        <strong>Segmento</strong>
        <p>${escaparHtml(segmentoInterpretado || "-")}</p>
      </div>

      <div class="box">
        <strong>Subsegmento</strong>
        <p>${escaparHtml(subsegmentoInterpretado || "-")}</p>
      </div>

    </div>

    <div class="box">
      <strong>CNAE principal</strong>
      <p>
        ${formatarCnae(
          empresa.cnaePrincipal ||
          empresa.cnae
        )}
      </p>
    </div>

    <div class="box">
      <strong>CNAEs secundários</strong>
      <p>
        ${formatarAtividades(
          empresa.cnaesSecundarios
        )}
      </p>
    </div>

    <div class="box">
      <strong>Atividade predominante</strong>
      <p>
        ${formatarCnae(
          empresa.atividadePredominante
        )}
      </p>
    </div>

    <div class="box">
      <strong>Atividades exercidas</strong>
      <p>
        ${formatarAtividades(
          empresa.atividadesSelecionadas
        )}
      </p>
    </div>

    <h2>
      O que a empresa realmente faz
    </h2>

    <div class="box">
      <p>
        ${escaparHtml(
          descricaoNegocio ||
          "Não informado."
        )}
      </p>
    </div>

    <h2>
      Dores declaradas
    </h2>

    <div class="box">
      <ul>
        ${listaHtml(
          doresSelecionadas
        )}
      </ul>
    </div>

    <div class="box">
      <strong>
        Objetivo dos próximos 90 dias
      </strong>

      <p>
        ${escaparHtml(
          objetivo90Dias ||
          "-"
        )}
      </p>
    </div>

    <h2>
      Score geral
    </h2>

    <div class="box">

      <span class="score">
        ${score ?? "-"}/100
      </span>

      <p>
        ${escaparHtml(
          nivelTexto(
            resultado.nivelGeral ||
            diagnostico.nivelGeral
          )
        )}
      </p>

    </div>

    ${
      diagnostico.leituraDasDores ||
      diagnostico.leituraDaDor
        ? `
          <h2>
            Leitura das dores
          </h2>

          <div class="box">
            <p>
              ${escaparHtml(
                diagnostico.leituraDasDores ||
                diagnostico.leituraDaDor
              )}
            </p>
          </div>
        `
        : ""
    }

    ${
      diagnostico.alertaEstrategico
        ? `
          <h2>
            Alerta estratégico
          </h2>

          <div class="alerta">
            ${escaparHtml(
              diagnostico.alertaEstrategico
            )}
          </div>
        `
        : ""
    }

    <h2>
      Resumo executivo
    </h2>

    <div class="box">
      <p>
        ${escaparHtml(
          diagnostico.resumoExecutivo ||
          "Resumo executivo não disponível."
        )}
      </p>
    </div>

    <h2>
      Principais dores identificadas
    </h2>

    <ul>
      ${listaHtml(
        diagnostico.principaisDores
      )}
    </ul>

    <h2>
      Possíveis causas
    </h2>

    <ul>
      ${listaHtml(
        diagnostico.causasProvaveis
      )}
    </ul>

    <h2>
      Impactos possíveis
    </h2>

    <ul>
      ${listaHtml(
        diagnostico.impactos
      )}
    </ul>

    <h2>
      Pontos fortes
    </h2>

    <ul>
      ${listaHtml(
        diagnostico.pontosFortes
      )}
    </ul>

    <h2>
      Prioridades imediatas
    </h2>

    <ol>
      ${listaHtml(
        diagnostico.prioridadesImediatas
      )}
    </ol>

    <h2>
      Próximos passos
    </h2>

    <ol>
      ${listaHtml(
        diagnostico.proximosPassos
      )}
    </ol>

    <h2>
      Diagnóstico por área
    </h2>

    ${areasHtml}

    <h2>
      Formulário completo
    </h2>

    <table>

      <thead>

        <tr>
          <th>#</th>
          <th>Área</th>
          <th>Tema</th>
          <th>Pergunta</th>
          <th>Resposta</th>
          <th>Peso</th>
        </tr>

      </thead>

      <tbody>
        ${respostasHtml}
      </tbody>

    </table>

    <h2>
      Pontos para aprofundamento
    </h2>

    ${lacunasHtml}

    ${
      consultoriaHtml
        ? `
          <h2>
            Oportunidades de aprofundamento profissional
          </h2>

          ${consultoriaHtml}
        `
        : ""
    }

    <h2>
      Observação do participante
    </h2>

    <div class="box">
      <p>
        ${escaparHtml(
          perfil.observacao ||
          "Nenhuma observação registrada."
        )}
      </p>
    </div>

  </div>

  <div class="footer">

    <strong>
      Finder of Solutions
    </strong>

    <br><br>

    Diagnóstico empresarial preliminar.

    As informações devem ser validadas antes
    de decisões contábeis, tributárias,
    financeiras, trabalhistas ou jurídicas.

  </div>

</div>

</body>

</html>
`;

  // =======================================================
  // 18. HTML PARTICIPANTE
  // =======================================================

  const htmlLead = `
<!doctype html>

<html lang="pt-BR">

<body
style="
margin:0;
background:#F3F5F8;
font-family:Arial,Helvetica,sans-serif;
color:#17233D;
"
>

<div
style="
max-width:700px;
margin:0 auto;
background:white;
"
>

<div
style="
background:#17233D;
color:white;
padding:30px;
text-align:center;
"
>

<img
src="https://${req.headers.host}/finder-logo.png"
alt="Finder of Solutions"
style="
max-width:170px;
max-height:65px;
margin-bottom:18px;
"
>

<h1>
Diagnóstico Empresarial
</h1>

<p>
Finder of Solutions
</p>

</div>

<div style="padding:30px;">

<p>
Olá,
<strong>
${escaparHtml(
  nomeResponsavel
)}
</strong>.
</p>

<p>
Obrigado por participar do
Diagnóstico Empresarial Finder.
</p>

<div
style="
background:#F7F8FB;
padding:18px;
border-radius:10px;
margin:22px 0;
"
>

<div>
Resultado geral
</div>

<div
style="
color:#FF6B4A;
font-size:34px;
font-weight:bold;
margin-top:5px;
"
>

${score ?? "-"}/100

</div>

<p>
${escaparHtml(
  nivelTexto(
    resultado.nivelGeral ||
    diagnostico.nivelGeral
  )
)}
</p>

</div>

<h2>
Resumo executivo
</h2>

<p
style="
line-height:1.65;
"
>

${escaparHtml(
  diagnostico.resumoExecutivo ||
  "Resumo executivo não disponível."
)}

</p>

${
  diagnostico.alertaEstrategico
    ? `
      <div
      style="
      background:#FAEEDA;
      color:#70410A;
      padding:16px;
      border-radius:9px;
      margin:22px 0;
      "
      >

      <strong>
        Alerta estratégico
      </strong>

      <p>
        ${escaparHtml(
          diagnostico.alertaEstrategico
        )}
      </p>

      </div>
    `
    : ""
}

<h3>
Prioridades identificadas
</h3>

<ol>
${listaHtml(
  diagnostico.prioridadesImediatas
)}
</ol>

<h3>
Próximos passos
</h3>

<ol>
${listaHtml(
  diagnostico.proximosPassos
)}
</ol>

<div
style="
background:#17233D;
color:white;
padding:22px;
border-radius:10px;
margin-top:28px;
text-align:center;
"
>

<strong>
Quer entender melhor esses números?
</strong>

<p>
Converse com um especialista da
Finder of Solutions.
</p>

<a
href="https://wa.me/5541989049616?text=Ol%C3%A1%2C%20fiz%20o%20Diagn%C3%B3stico%20Empresarial%20Finder%20e%20gostaria%20de%20conversar%20com%20um%20especialista."
style="
display:inline-block;
background:#FF6B4A;
color:white;
text-decoration:none;
padding:13px 20px;
border-radius:7px;
font-weight:bold;
"
>

Falar com um especialista

</a>

</div>

</div>

</div>

</body>

</html>
`;

  // =======================================================
  // 19. FUNÇÃO DE E-MAIL
  // =======================================================

  async function enviarEmail({
    para,
    assunto,
    html,
  }) {
    if (
      !resendConfigurado
    ) {
      throw new Error(
        "RESEND_API_KEY não configurada."
      );
    }

    console.log(
      "[enviar-relatorio] Enviando e-mail:",
      assunto
    );

    const resposta =
      await fetch(
        "https://api.resend.com/emails",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${process.env.RESEND_API_KEY}`,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              from:
                emailRemetente,

              to:
                Array.isArray(
                  para
                )
                  ? para
                  : [para],

              subject:
                assunto,

              html,
            }),
        }
      );

    let data = {};

    try {
      data =
        await resposta.json();
    } catch {
      data = {};
    }

    if (!resposta.ok) {
      throw new Error(
        data?.message ||
        data?.error
          ?.message ||
        data?.error ||
        `Erro ao enviar e-mail. HTTP ${resposta.status}`
      );
    }

    return data;
  }

  // =======================================================
  // 20. ENVIOS
  // =======================================================

  let envioFinder =
    null;

  let envioLead =
    null;

  let erroFinder =
    null;

  let erroLead =
    null;

  if (
    resendConfigurado
  ) {
    try {
      envioFinder =
        await enviarEmail({
          para:
            emailFinder,

          assunto:
            `Novo diagnóstico empresarial — ${razaoSocial}`,

          html:
            htmlFinder,
        });

      console.log(
        "[enviar-relatorio] Email Finder enviado"
      );
    } catch (error) {
      erroFinder =
        error?.message ||
        String(error);

      console.error(
        "[enviar-relatorio] ERRO_EMAIL_FINDER:",
        erroFinder
      );
    }
  } else {
    erroFinder =
      "RESEND_API_KEY não configurada.";
  }

  const emailLeadValido =
    Boolean(
      emailLead &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        emailLead
      )
    );

  const consentimentoEmail =
    responsavel.consentimentoEmail !==
    false;

  if (
    resendConfigurado &&
    emailLeadValido &&
    consentimentoEmail
  ) {
    try {
      envioLead =
        await enviarEmail({
          para:
            emailLead,

          assunto:
            `Seu Diagnóstico Empresarial — ${razaoSocial}`,

          html:
            htmlLead,
        });

      console.log(
        "[enviar-relatorio] Email lead enviado"
      );
    } catch (error) {
      erroLead =
        error?.message ||
        String(error);

      console.error(
        "[enviar-relatorio] ERRO_EMAIL_LEAD:",
        erroLead
      );
    }
  } else if (
    !resendConfigurado
  ) {
    erroLead =
      "RESEND_API_KEY não configurada.";
  } else if (
    !consentimentoEmail
  ) {
    erroLead =
      "Participante não autorizou o envio.";
  } else if (
    emailLead &&
    !emailLeadValido
  ) {
    erroLead =
      "E-mail do participante inválido.";
  }

  // =======================================================
  // 21. RESULTADO FINAL
  // =======================================================

  if (!registroSalvo) {
    console.error(
      "[enviar-relatorio] FINALIZADO COM ERRO DE BANCO"
    );

    return res
      .status(500)
      .json({
        sucesso: false,

        etapa:
          "salvar_banco",

        error:
          "O diagnóstico foi gerado, mas não foi possível salvá-lo no banco.",

        banco: {
          salvo: false,
          erro:
            erroBanco,
        },

        finder: {
          configurado:
            resendConfigurado,

          enviado:
            Boolean(
              envioFinder
            ),

          email:
            emailFinder,

          erro:
            erroFinder,
        },

        lead: {
          solicitado:
            Boolean(
              emailLead
            ),

          consentimento:
            consentimentoEmail,

          emailValido:
            emailLeadValido,

          enviado:
            Boolean(
              envioLead
            ),

          email:
            emailLead ||
            null,

          erro:
            erroLead,
        },
      });
  }

  console.log(
    "[enviar-relatorio] FINALIZADO COM SUCESSO"
  );

  return res.status(200).json({
    sucesso: true,

    // ID também no topo para compatibilidade com App/CRM.
    id:
      registroSalvo?.id ||
      null,

    diagnosticoId:
      registroSalvo?.id ||
      null,

    mensagem:
      resendConfigurado
        ? "Diagnóstico salvo e processo de envio concluído."
        : "Diagnóstico salvo com sucesso. E-mails não enviados porque o Resend ainda não está configurado.",

    banco: {
      salvo: true,

      id:
        registroSalvo?.id ||
        null,

      criadoEm:
        registroSalvo
          ?.criado_em ||
        null,

      areasSalvas:
        areas.length,

      respostasSalvas:
        respostasNormalizadas.length,

      erro: null,
    },

    finder: {
      configurado:
        resendConfigurado,

      enviado:
        Boolean(
          envioFinder
        ),

      email:
        emailFinder,

      id:
        envioFinder?.id ||
        null,

      erro:
        erroFinder,
    },

    lead: {
      solicitado:
        Boolean(
          emailLead
        ),

      consentimento:
        consentimentoEmail,

      emailValido:
        emailLeadValido,

      enviado:
        Boolean(
          envioLead
        ),

      email:
        emailLead ||
        null,

      id:
        envioLead?.id ||
        null,

      erro:
        erroLead,
    },
  });
}
