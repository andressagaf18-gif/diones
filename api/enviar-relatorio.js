// api/enviar-relatorio.js

import { neon } from "@neondatabase/serverless";

// =========================================================
// FUNÇÕES AUXILIARES
// =========================================================

function escaparHtml(valor = "") {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function listaHtml(
  lista = [],
  vazio = "Nenhuma informação registrada."
) {
  if (!Array.isArray(lista) || lista.length === 0) {
    return `<li>${escaparHtml(vazio)}</li>`;
  }

  return lista
    .filter(Boolean)
    .map((item) => `<li>${escaparHtml(item)}</li>`)
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
  if (!Array.isArray(lista) || lista.length === 0) {
    return "-";
  }

  return lista
    .map((atividade) => {
      if (typeof atividade === "string") {
        return escaparHtml(atividade);
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
  const texto = String(valor ?? "")
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

  if (texto === "parcialmente") {
    return "Parcialmente";
  }

  return String(valor ?? "-");
}

function nivelTexto(nivel) {
  const mapa = {
    bom: "Bom",
    atencao: "Atenção",
    alto: "Risco alto",
    critico: "Crítico",
  };

  return mapa[nivel] || nivel || "-";
}

function prioridadeTexto(prioridade) {
  const mapa = {
    imediata: "Imediata",
    alta: "Alta",
    media: "Média",
    baixa: "Baixa",
  };

  return mapa[prioridade] || prioridade || "-";
}

function arraySeguro(valor) {
  return Array.isArray(valor)
    ? valor
    : [];
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

// =========================================================
// HANDLER PRINCIPAL
// =========================================================

export default async function handler(req, res) {
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
      error: "Método não permitido.",
    });
  }

  // =======================================================
  // 2. DATABASE_URL É OBRIGATÓRIA
  // =======================================================

  if (!process.env.DATABASE_URL) {
    console.error(
      "[enviar-relatorio] DATABASE_URL ausente"
    );

    return res.status(500).json({
      sucesso: false,
      etapa: "configuracao_banco",
      error:
        "DATABASE_URL não configurada na Vercel.",
    });
  }

  // =======================================================
  // 3. RESEND É OPCIONAL
  // =======================================================

  const resendConfigurado =
    Boolean(
      process.env.RESEND_API_KEY
    );

  if (!resendConfigurado) {
    console.warn(
      "[enviar-relatorio] RESEND_API_KEY ausente. O diagnóstico será salvo no banco, mas os e-mails não serão enviados."
    );
  }

  // =======================================================
  // 4. CONEXÃO NEON
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
      error?.message || error
    );

    return res.status(500).json({
      sucesso: false,
      etapa: "conexao_neon",
      error:
        error?.message ||
        "Erro ao iniciar conexão com Neon.",
    });
  }

  // =======================================================
  // 5. CONFIGURAÇÕES
  // =======================================================

  const emailFinder =
    process.env.RELATORIO_EMAIL_DESTINO ||
    "contato@finderofsolutions.com.br";

  const emailRemetente =
    process.env.RELATORIO_EMAIL_REMETENTE ||
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

  const empresas =
    arraySeguro(
      body.empresas
    );

  const perfil =
    objetoSeguro(
      body.perfil
    );

  const dores =
    objetoSeguro(
      body.dores
    );

  const negocioInterpretado =
    objetoSeguro(
      body.negocioInterpretado
    );

  const resultado =
    objetoSeguro(
      body.resultado
    );

  const descricaoNegocio =
    String(
      body.descricaoNegocio ||
      empresa.descricaoNegocio ||
      ""
    );

  const respostas =
    arraySeguro(
      body.respostas
    );

  const perguntas =
    arraySeguro(
      body.perguntas
    );

  // =======================================================
  // 7. DADOS DO DIAGNÓSTICO
  // =======================================================

  const diagnostico =
    objetoSeguro(
      resultado.diagnosticoGeral
    );

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

  const areas =
    arraySeguro(
      resultado.areas
    );

  // =======================================================
  // 8. DADOS PRINCIPAIS
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
    "";

  const scoreNumero =
    Number(
      diagnostico.scoreGeral
    );

  const score =
    Number.isFinite(
      scoreNumero
    )
      ? scoreNumero
      : null;

  // =======================================================
  // 9. DORES
  // =======================================================

  let doresSelecionadas = [];

  if (
    Array.isArray(
      diagnostico.doresSelecionadas
    ) &&
    diagnostico.doresSelecionadas.length
  ) {
    doresSelecionadas =
      diagnostico.doresSelecionadas;
  } else if (
    Array.isArray(
      dores.selecionadas
    )
  ) {
    doresSelecionadas =
      dores.selecionadas;
  } else if (
    dores.principal
  ) {
    doresSelecionadas = [
      dores.principal,
    ];
  }

  // =======================================================
  // 10. PERGUNTAS E RESPOSTAS
  // =======================================================

  const perguntasFinais =
    perguntas.length
      ? perguntas
      : arraySeguro(
          resultado.perguntas
        );

  const respostasFinais =
    respostas.length
      ? respostas
      : arraySeguro(
          resultado.respostas
        );

  const mapaPerguntas =
    new Map();

  perguntasFinais.forEach(
    (pergunta) => {
      if (pergunta?.id) {
        mapaPerguntas.set(
          String(pergunta.id),
          pergunta
        );
      }
    }
  );

  let respostasNormalizadas =
    [];

  if (
    respostasFinais.length
  ) {
    respostasNormalizadas =
      respostasFinais.map(
        (
          item,
          index
        ) => {
          const original =
            item?.id
              ? mapaPerguntas.get(
                  String(item.id)
                )
              : null;

          return {
            id:
              item?.id ||
              original?.id ||
              index + 1,

            area:
              item?.area ||
              original?.area ||
              "-",

            areaId:
              item?.areaId ||
              original?.areaId ||
              "",

            tema:
              item?.tema ||
              original?.tema ||
              "-",

            pergunta:
              item?.pergunta ||
              item?.texto ||
              original?.pergunta ||
              "-",

            resposta:
              item?.resposta ??
              item?.valor ??
              "-",

            peso:
              item?.peso ||
              item?.importancia ||
              original?.peso ||
              original?.importancia ||
              "-",

            motivo:
              item?.motivo ||
              original?.motivo ||
              "",

            riscoAvaliado:
              item?.riscoAvaliado ||
              original?.riscoAvaliado ||
              "",
          };
        }
      );
  } else {
    respostasNormalizadas =
      perguntasFinais.map(
        (
          item,
          index
        ) => ({
          id:
            item?.id ||
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
            "-",

          resposta:
            item?.resposta ||
            "-",

          peso:
            item?.peso ||
            item?.importancia ||
            "-",

          motivo:
            item?.motivo ||
            "",

          riscoAvaliado:
            item?.riscoAvaliado ||
            "",
        })
      );
  }

  // =======================================================
  // 11. SALVAR NO NEON
  // =======================================================

  let registroSalvo = null;
  let erroBanco = null;

  try {
    console.log(
      "[enviar-relatorio] Iniciando INSERT Neon"
    );

    const areasBanco =
      areas.map(
        (area) => ({
          area:
            area?.area ||
            "",

          score:
            area?.score ??
            null,

          nivel:
            area?.nivel ||
            "",

          prioridade:
            area?.prioridade ??
            null,
        })
      );

    const dadosCompletos = {
      recebidoEm:
        new Date().toISOString(),

      responsavel,

      empresa,

      empresas,

      perfil,

      dores,

      descricaoNegocio,

      negocioInterpretado,

      perguntas:
        perguntasFinais,

      respostas:
        respostasNormalizadas,

      resultado,
    };

    const doresJson =
      JSON.stringify(
        doresSelecionadas ||
        []
      );

    const areasJson =
      JSON.stringify(
        areasBanco ||
        []
      );

    const empresasJson =
      JSON.stringify(
        empresas ||
        []
      );

    const negocioJson =
      JSON.stringify(
        negocioInterpretado ||
        {}
      );

    const respostasJson =
      JSON.stringify(
        respostasNormalizadas ||
        []
      );

    const diagnosticoJson =
      JSON.stringify(
        resultado ||
        {}
      );

    const completoJson =
      JSON.stringify(
        dadosCompletos ||
        {}
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
  // 12. HTML RESPOSTAS
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
                  ${escaparHtml(
                    item.peso
                  )}
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
  // 13. HTML ÁREAS
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
                        area?.area ||
                        "Área"
                      )}
                    </h3>

                    <span class="nivel">
                      ${escaparHtml(
                        nivelTexto(
                          area?.nivel
                        )
                      )}
                    </span>

                  </div>

                  <div class="score-area">

                    ${
                      area?.score ??
                      "-"
                    }/100

                  </div>

                </div>

                ${
                  area?.resumo
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
                        area?.achados,
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
                        area?.causasProvaveis,
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
                        area?.riscos,
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
                        area?.recomendacoes,
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
  // 14. HTML LACUNAS
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
                    item?.perguntasSugeridas
                  ) &&
                  item.perguntasSugeridas.length
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
  // 15. HTML CONSULTORIA
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
                  <strong>Prioridade:</strong>
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
  // 16. HTML FINDER
  // =======================================================

  const htmlFinder = `
<!doctype html>

<html lang="pt-BR">

<head>

<meta charset="utf-8">

<meta name="viewport"
content="width=device-width, initial-scale=1">

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

        <p>
          ${escaparHtml(
            nomeResponsavel
          )}
        </p>

      </div>

      <div class="box">

        <strong>Cargo</strong>

        <p>
          ${escaparHtml(
            cargoResponsavel ||
            "-"
          )}
        </p>

      </div>

      <div class="box">

        <strong>WhatsApp</strong>

        <p>
          ${escaparHtml(
            telefoneLead ||
            "-"
          )}
        </p>

      </div>

      <div class="box">

        <strong>E-mail</strong>

        <p>
          ${escaparHtml(
            emailLead ||
            "-"
          )}
        </p>

      </div>

    </div>

    <h2>
      Empresa
    </h2>

    <div class="grid">

      <div class="box">

        <strong>Razão social</strong>

        <p>
          ${escaparHtml(
            razaoSocial
          )}
        </p>

      </div>

      <div class="box">

        <strong>CNPJ</strong>

        <p>
          ${escaparHtml(
            cnpj ||
            "-"
          )}
        </p>

      </div>

      <div class="box">

        <strong>Segmento</strong>

        <p>
          ${escaparHtml(
            segmentoInterpretado ||
            "-"
          )}
        </p>

      </div>

      <div class="box">

        <strong>Subsegmento</strong>

        <p>
          ${escaparHtml(
            subsegmentoInterpretado ||
            "-"
          )}
        </p>

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

      <strong>
        Atividade predominante
      </strong>

      <p>
        ${formatarCnae(
          empresa.atividadePredominante
        )}
      </p>

    </div>

    <div class="box">

      <strong>
        Atividades exercidas
      </strong>

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
          dores.objetivo90Dias ||
          resultado?.contextoInterpretado?.objetivo90Dias ||
          "-"
        )}
      </p>

    </div>

    <h2>
      Score geral
    </h2>

    <div class="box">

      <span class="score">

        ${
          diagnostico.scoreGeral ??
          "-"
        }/100

      </span>

      <p>
        ${escaparHtml(
          nivelTexto(
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
  // 17. HTML PARTICIPANTE
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

${
  diagnostico.scoreGeral ??
  "-"
}/100

</div>

<p>

${escaparHtml(
  nivelTexto(
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
  // 18. FUNÇÃO EMAIL
  // =======================================================

  async function enviarEmail({
    para,
    assunto,
    html,
  }) {
    if (!resendConfigurado) {
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
                Array.isArray(para)
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
        data?.error?.message ||
        data?.error ||
        `Erro ao enviar e-mail. HTTP ${resposta.status}`
      );
    }

    return data;
  }

  // =======================================================
  // 19. ENVIOS
  // =======================================================

  let envioFinder = null;
  let envioLead = null;

  let erroFinder = null;
  let erroLead = null;

  // =======================================================
  // FINDER
  // =======================================================

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

  // =======================================================
  // PARTICIPANTE
  // =======================================================

  const emailLeadValido =
    Boolean(
      emailLead &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        emailLead
      )
    );

  if (
    resendConfigurado &&
    emailLeadValido
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
    emailLead &&
    !emailLeadValido
  ) {
    erroLead =
      "E-mail do participante inválido.";
  }

  // =======================================================
  // 20. RESULTADO FINAL
  // =======================================================

  /*
   * Para o aplicativo, o principal é preservar o diagnóstico.
   *
   * Se o banco salvou:
   * retorna 200 mesmo se o Resend estiver sem configuração.
   *
   * Se o banco não salvou:
   * retornamos 500 para não fingir que o registro foi armazenado.
   */

  if (!registroSalvo) {
    console.error(
      "[enviar-relatorio] FINALIZADO COM ERRO DE BANCO"
    );

    return res.status(500).json({
      sucesso: false,

      etapa:
        "salvar_banco",

      error:
        "O diagnóstico foi gerado, mas não foi possível salvá-lo no banco.",

      banco: {
        salvo:
          false,

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

    mensagem:
      resendConfigurado
        ? "Diagnóstico salvo e processo de envio concluído."
        : "Diagnóstico salvo com sucesso. E-mails não enviados porque o Resend ainda não está configurado.",

    banco: {
      salvo:
        true,

      id:
        registroSalvo?.id ||
        null,

      criadoEm:
        registroSalvo?.criado_em ||
        null,

      erro:
        null,
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
