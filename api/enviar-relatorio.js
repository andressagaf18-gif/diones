// api/enviar-relatorio.js

function escaparHtml(valor = "") {
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function listaHtml(lista = [], vazio = "Nenhuma informação registrada.") {
  if (!Array.isArray(lista) || lista.length === 0) {
    return `<li>${escaparHtml(vazio)}</li>`;
  }

  return lista
    .map((item) => `<li>${escaparHtml(item)}</li>`)
    .join("");
}

function formatarCnae(cnae) {
  if (!cnae) return "-";

  if (typeof cnae === "string") {
    return escaparHtml(cnae);
  }

  const codigo = cnae.codigo || "";
  const descricao = cnae.descricao || "";

  return escaparHtml(
    [codigo, descricao].filter(Boolean).join(" — ") || "-"
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

      return escaparHtml(
        [
          atividade?.codigo || "",
          atividade?.descricao || "",
        ]
          .filter(Boolean)
          .join(" — ")
      );
    })
    .join("<br>");
}

export default async function handler(req, res) {
  // =========================================================
  // 1. MÉTODO
  // =========================================================

  if (req.method !== "POST") {
    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  // =========================================================
  // 2. CONFIGURAÇÕES
  // =========================================================

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({
      sucesso: false,
      error: "RESEND_API_KEY não configurada.",
    });
  }

  const emailFinder =
    process.env.RELATORIO_EMAIL_DESTINO ||
    "contato@finderofsolutions.com.br";

  const emailRemetente =
    process.env.RELATORIO_EMAIL_REMETENTE ||
    "Finder of Solutions <onboarding@resend.dev>";

  // =========================================================
  // 3. DADOS RECEBIDOS
  // =========================================================

  const body = req.body || {};

  const {
    responsavel = {},
    empresa = {},
    empresas = [],
    perfil = {},
    dores = {},
    resultado = {},
  } = body;

  const diagnostico =
    resultado.diagnosticoGeral || {};

  const visaoGrupo =
    resultado.visaoGrupo || {};

  const lacunasDiagnostico =
    resultado.lacunasDiagnostico || [];

  const oportunidadesConsultoria =
    resultado.oportunidadesConsultoria || [];

  const areas =
    resultado.areas || [];

  const respostas =
    resultado.respostas || [];

  // =========================================================
  // 4. VALIDAÇÃO
  // =========================================================

  if (!empresa?.razao && !empresa?.razaoSocial) {
    return res.status(400).json({
      sucesso: false,
      error: "Empresa não informada.",
    });
  }

  const razaoSocial =
    empresa.razao ||
    empresa.razaoSocial ||
    "Empresa";

  const nomeResponsavel =
    responsavel.nome ||
    "Não informado";

  const emailLead =
    String(
      responsavel.email || ""
    ).trim();

  // =========================================================
  // 5. EMPRESAS DO GRUPO
  // =========================================================

  const empresasHtml =
    Array.isArray(empresas) &&
    empresas.length > 0
      ? empresas
          .map(
            (item, index) => `
              <tr>
                <td>${index + 1}</td>

                <td>
                  ${escaparHtml(
                    item.razao ||
                    item.razaoSocial ||
                    "-"
                  )}
                </td>

                <td>
                  ${escaparHtml(
                    item.cnpjDigits ||
                    item.cnpj ||
                    "-"
                  )}
                </td>

                <td>
                  ${escaparHtml(
                    item.segmento ||
                    "-"
                  )}
                </td>

                <td>
                  ${formatarCnae(
                    item.cnaePrincipal ||
                    item.cnae
                  )}
                </td>
              </tr>
            `
          )
          .join("")
      : `
          <tr>
            <td>1</td>

            <td>
              ${escaparHtml(razaoSocial)}
            </td>

            <td>
              ${escaparHtml(
                empresa.cnpjDigits ||
                empresa.cnpj ||
                "-"
              )}
            </td>

            <td>
              ${escaparHtml(
                empresa.segmento ||
                "-"
              )}
            </td>

            <td>
              ${formatarCnae(
                empresa.cnaePrincipal ||
                empresa.cnae
              )}
            </td>
          </tr>
        `;

  // =========================================================
  // 6. ÁREAS ANALISADAS
  // =========================================================

  const areasHtml =
    Array.isArray(areas) &&
    areas.length > 0
      ? areas
          .map((area) => {
            const achados =
              area.achados || [];

            const causas =
              area.causasProvaveis || [];

            const riscos =
              area.riscos || [];

            const recomendacoes =
              area.recomendacoes || [];

            return `
              <div class="area">

                <div class="area-header">

                  <div>
                    <h3>
                      ${escaparHtml(
                        area.area || "Área"
                      )}
                    </h3>

                    ${
                      area.resumo
                        ? `
                          <p class="area-resumo">
                            ${escaparHtml(
                              area.resumo
                            )}
                          </p>
                        `
                        : ""
                    }
                  </div>

                  <div class="score-area">
                    ${
                      area.score ??
                      "-"
                    }/100
                  </div>

                </div>

                <div class="grid">

                  <div class="box">
                    <strong>Achados</strong>

                    <ul>
                      ${listaHtml(
                        achados,
                        "Nenhum achado adicional registrado."
                      )}
                    </ul>
                  </div>

                  <div class="box">
                    <strong>
                      Causas prováveis
                    </strong>

                    <ul>
                      ${listaHtml(
                        causas,
                        "Não foi possível determinar causas com segurança."
                      )}
                    </ul>
                  </div>

                  <div class="box">
                    <strong>
                      Principais riscos
                    </strong>

                    <ul>
                      ${listaHtml(
                        riscos,
                        "Nenhum risco relevante identificado."
                      )}
                    </ul>
                  </div>

                  <div class="box">
                    <strong>
                      Recomendações
                    </strong>

                    <ol>
                      ${listaHtml(
                        recomendacoes,
                        "Manter os controles atuais e revisar periodicamente."
                      )}
                    </ol>
                  </div>

                </div>

              </div>
            `;
          })
          .join("")
      : `
          <p>
            Não foram recebidas análises detalhadas
            por área.
          </p>
        `;

  // =========================================================
  // 7. LACUNAS DO DIAGNÓSTICO
  // =========================================================

  const lacunasHtml =
    Array.isArray(
      lacunasDiagnostico
    ) &&
    lacunasDiagnostico.length
      ? lacunasDiagnostico
          .map(
            (lacuna) => `
              <div class="box destaque">

                <strong>
                  ${escaparHtml(
                    lacuna.tema ||
                    "Tema para aprofundamento"
                  )}
                </strong>

                <p>
                  ${escaparHtml(
                    lacuna.motivo ||
                    ""
                  )}
                </p>

                ${
                  Array.isArray(
                    lacuna.perguntasSugeridas
                  ) &&
                  lacuna
                    .perguntasSugeridas
                    .length
                    ? `
                      <p>
                        <strong>
                          Perguntas recomendadas:
                        </strong>
                      </p>

                      <ul>
                        ${listaHtml(
                          lacuna.perguntasSugeridas
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
            Nenhuma lacuna relevante foi
            apontada.
          </p>
        `;

  // =========================================================
  // 8. OPORTUNIDADES DE CONSULTORIA
  // =========================================================

  const oportunidadesConsultoriaHtml =
    Array.isArray(
      oportunidadesConsultoria
    ) &&
    oportunidadesConsultoria.length
      ? oportunidadesConsultoria
          .map(
            (item) => `
              <div class="box">

                <strong>
                  ${escaparHtml(
                    item.oportunidade ||
                    item.area ||
                    "Oportunidade"
                  )}
                </strong>

                <p>
                  ${escaparHtml(
                    item.motivo ||
                    ""
                  )}
                </p>

                <span class="badge">
                  Prioridade:
                  ${escaparHtml(
                    item.prioridade ||
                    "média"
                  )}
                </span>

              </div>
            `
          )
          .join("")
      : `
          <p>
            Nenhuma oportunidade adicional
            registrada.
          </p>
        `;

  // =========================================================
  // 9. RESPOSTAS COMPLETAS
  // =========================================================

  const respostasHtml =
    Array.isArray(respostas) &&
    respostas.length > 0
      ? respostas
          .map(
            (item, index) => `
              <tr>

                <td>
                  ${index + 1}
                </td>

                <td>
                  ${escaparHtml(
                    item.area ||
                    "-"
                  )}
                </td>

                <td>
                  ${escaparHtml(
                    item.pergunta ||
                    item.texto ||
                    "-"
                  )}
                </td>

                <td>
                  ${escaparHtml(
                    item.resposta ||
                    "-"
                  )}
                </td>

              </tr>
            `
          )
          .join("")
      : `
          <tr>
            <td colspan="4">
              Respostas detalhadas não recebidas.
            </td>
          </tr>
        `;

  // =========================================================
  // 10. HTML INTERNO FINDER
  // =========================================================

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
  max-width: 820px;
  margin: 0 auto;
  background: #FFFFFF;
}

.header {
  background: #17233D;
  color: #FFFFFF;
  padding: 30px;
}

.header h1 {
  margin: 0 0 6px;
  font-size: 25px;
}

.header p {
  margin: 0;
  opacity: .8;
}

.content {
  padding: 28px;
}

h2 {
  color: #17233D;
  margin-top: 30px;
  padding-bottom: 7px;
  border-bottom: 2px solid #FF6B4A;
  font-size: 18px;
}

h3 {
  color: #17233D;
  margin-top: 0;
}

p {
  line-height: 1.55;
}

ul,
ol {
  line-height: 1.55;
  padding-left: 22px;
}

li {
  margin-bottom: 5px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.box {
  background: #F7F8FB;
  padding: 14px;
  border-radius: 9px;
  margin-bottom: 10px;
}

.destaque {
  background: #FFF3EF;
}

.alerta {
  background: #FAEEDA;
  color: #854F0B;
  padding: 16px;
  border-radius: 10px;
  font-weight: 600;
}

.score {
  font-size: 34px;
  font-weight: 700;
  color: #FF6B4A;
}

.area {
  margin-bottom: 24px;
}

.area-header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
}

.area-resumo {
  color: #5B667A;
  font-size: 14px;
}

.score-area {
  font-size: 20px;
  font-weight: 700;
  color: #FF6B4A;
  white-space: nowrap;
}

.badge {
  display: inline-block;
  background: #17233D;
  color: #FFFFFF;
  padding: 4px 8px;
  border-radius: 5px;
  font-size: 11px;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}

th {
  background: #E9EDF5;
  text-align: left;
  padding: 8px;
}

td {
  border-bottom: 1px solid #E1E5EC;
  padding: 8px;
  vertical-align: top;
  font-size: 13px;
}

.footer {
  background: #17233D;
  color: #FFFFFF;
  padding: 20px 28px;
  font-size: 12px;
}

@media (max-width: 600px) {

  .grid {
    grid-template-columns: 1fr;
  }

  .area-header {
    display: block;
  }

}

</style>

</head>

<body>

<div class="container">

  <div class="header">

    <h1>
      Diagnóstico Empresarial Finder
    </h1>

    <p>
      Relatório completo do lead
    </p>

  </div>

  <div class="content">

    <h2>
      Responsável
    </h2>

    <div class="grid">

      <div class="box">
        <strong>Nome</strong><br>
        ${escaparHtml(
          nomeResponsavel
        )}
      </div>

      <div class="box">
        <strong>Cargo</strong><br>
        ${escaparHtml(
          responsavel.cargo ||
          "-"
        )}
      </div>

      <div class="box">
        <strong>WhatsApp</strong><br>
        ${escaparHtml(
          responsavel.telefone ||
          "-"
        )}
      </div>

      <div class="box">
        <strong>E-mail</strong><br>
        ${escaparHtml(
          emailLead ||
          "-"
        )}
      </div>

    </div>


    <h2>
      Empresa-base
    </h2>

    <div class="grid">

      <div class="box">

        <strong>
          Razão social
        </strong>

        <br>

        ${escaparHtml(
          razaoSocial
        )}

      </div>

      <div class="box">

        <strong>
          CNPJ
        </strong>

        <br>

        ${escaparHtml(
          empresa.cnpjDigits ||
          empresa.cnpj ||
          "-"
        )}

      </div>

      <div class="box">

        <strong>
          Segmento
        </strong>

        <br>

        ${escaparHtml(
          empresa.segmento ||
          "-"
        )}

      </div>

      <div class="box">

        <strong>
          Categoria
        </strong>

        <br>

        ${escaparHtml(
          empresa.categoria ||
          "-"
        )}

      </div>

    </div>


    <div class="box">

      <strong>
        CNAE principal cadastrado
      </strong>

      <p>
        ${formatarCnae(
          empresa.cnaePrincipal ||
          empresa.cnae
        )}
      </p>

    </div>


    <div class="box">

      <strong>
        Atividade predominante informada
      </strong>

      <p>
        ${formatarCnae(
          empresa.atividadePredominante
        )}
      </p>

    </div>


    <div class="box">

      <strong>
        Atividades efetivamente exercidas
      </strong>

      <p>
        ${formatarAtividades(
          empresa.atividadesSelecionadas
        )}
      </p>

    </div>


    <h2>
      Perfil informado
    </h2>

    <div class="grid">

      <div class="box">

        <strong>
          Faturamento
        </strong>

        <br>

        ${escaparHtml(
          perfil.faturamento ||
          "-"
        )}

      </div>

      <div class="box">

        <strong>
          Colaboradores
        </strong>

        <br>

        ${escaparHtml(
          perfil.colaboradores ||
          "-"
        )}

      </div>

      <div class="box">

        <strong>
          Regime tributário
        </strong>

        <br>

        ${escaparHtml(
          perfil.regime ||
          "-"
        )}

      </div>

      <div class="box">

        <strong>
          Score geral
        </strong>

        <br>

        <span class="score">
          ${
            diagnostico.scoreGeral ??
            "-"
          }
        </span>

        /100

      </div>

    </div>


    <h2>
      Dor declarada
    </h2>

    <div class="box">

      <strong>
        Principal dor
      </strong>

      <p>
        ${escaparHtml(
          dores.principal ||
          diagnostico.dorPrincipal ||
          "-"
        )}
      </p>

    </div>


    <div class="box">

      <strong>
        Prioridade dos próximos 90 dias
      </strong>

      <p>
        ${escaparHtml(
          dores.objetivo90Dias ||
          "-"
        )}
      </p>

    </div>


    ${
      diagnostico.leituraDaDor
        ? `
          <h2>
            Leitura da dor
          </h2>

          <div class="box">

            <p>
              ${escaparHtml(
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
        diagnostico.causasProvaveis,
        "Não foi possível determinar causas com segurança."
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
      Oportunidades
    </h2>

    <ul>
      ${listaHtml(
        diagnostico.oportunidades
      )}
    </ul>


    <h2>
      Próximos passos
    </h2>

    <ol>
      ${listaHtml(
        diagnostico.proximosPassos
      )}
    </ol>


    ${
      Array.isArray(empresas) &&
      empresas.length > 1
        ? `
          <h2>
            Empresas cadastradas
          </h2>

          <table>

            <thead>

              <tr>
                <th>#</th>
                <th>Empresa</th>
                <th>CNPJ</th>
                <th>Segmento</th>
                <th>CNAE</th>
              </tr>

            </thead>

            <tbody>
              ${empresasHtml}
            </tbody>

          </table>
        `
        : ""
    }


    ${
      visaoGrupo?.aplicavel
        ? `
          <h2>
            Visão do grupo empresarial
          </h2>

          <div class="box">

            <p>
              ${escaparHtml(
                visaoGrupo.resumo ||
                ""
              )}
            </p>

            <ul>
              ${listaHtml(
                visaoGrupo.pontosAtencao ||
                []
              )}
            </ul>

          </div>
        `
        : ""
    }


    <h2>
      Diagnóstico por área
    </h2>

    ${areasHtml}


    <h2>
      Pontos que precisam ser aprofundados
    </h2>

    ${lacunasHtml}


    <h2>
      Oportunidades de aprofundamento profissional
    </h2>

    ${oportunidadesConsultoriaHtml}


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


    <h2>
      Formulário completo
    </h2>

    <table>

      <thead>

        <tr>
          <th>#</th>
          <th>Área</th>
          <th>Pergunta</th>
          <th>Resposta</th>
        </tr>

      </thead>

      <tbody>
        ${respostasHtml}
      </tbody>

    </table>

  </div>


  <div class="footer">

    Finder of Solutions<br>

    Diagnóstico empresarial preliminar.

    As informações devem ser validadas
    antes da tomada de decisões
    contábeis, tributárias, financeiras,
    trabalhistas ou jurídicas.

  </div>

</div>

</body>

</html>
`;

  // =========================================================
  // 11. HTML PARA O LEAD
  // =========================================================

  const htmlLead = `
<!doctype html>

<html lang="pt-BR">

<head>

<meta charset="utf-8">

<meta name="viewport"
      content="width=device-width, initial-scale=1">

<title>
Seu Diagnóstico Empresarial
</title>

</head>

<body
  style="
    margin:0;
    padding:0;
    background:#F3F5F8;
    font-family:Arial,Helvetica,sans-serif;
    color:#17233D;
  "
>

<div
  style="
    max-width:700px;
    margin:0 auto;
    background:#FFFFFF;
  "
>

  <div
    style="
      background:#17233D;
      color:white;
      padding:28px;
    "
  >

    <h1
      style="
        margin:0 0 6px;
        font-size:24px;
      "
    >
      Diagnóstico Empresarial Finder
    </h1>

    <p
      style="
        margin:0;
        opacity:.8;
      "
    >
      Resultado preliminar da sua empresa
    </p>

  </div>


  <div
    style="
      padding:28px;
    "
  >

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
        padding:16px;
        border-radius:10px;
        margin:20px 0;
      "
    >

      <strong>
        ${escaparHtml(
          razaoSocial
        )}
      </strong>

      <br>

      Score geral:

      <span
        style="
          color:#FF6B4A;
          font-size:24px;
          font-weight:700;
        "
      >

        ${
          diagnostico.scoreGeral ??
          "-"
        }/100

      </span>

    </div>


    <h2>
      Resumo executivo
    </h2>

    <p
      style="
        line-height:1.6;
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
              color:#854F0B;
              padding:14px;
              border-radius:9px;
              margin:18px 0;
            "
          >

            <strong>
              Alerta estratégico
            </strong>

            <p
              style="
                margin:7px 0 0;
                line-height:1.5;
              "
            >

              ${escaparHtml(
                diagnostico.alertaEstrategico
              )}

            </p>

          </div>
        `
        : ""
    }


    ${
      Array.isArray(
        diagnostico.prioridadesImediatas
      ) &&
      diagnostico
        .prioridadesImediatas
        .length
        ? `
          <h3>
            Prioridades identificadas
          </h3>

          <ol
            style="
              line-height:1.6;
            "
          >

            ${listaHtml(
              diagnostico.prioridadesImediatas
            )}

          </ol>
        `
        : ""
    }


    ${
      Array.isArray(
        diagnostico.proximosPassos
      ) &&
      diagnostico
        .proximosPassos
        .length
        ? `
          <h3>
            Próximos passos recomendados
          </h3>

          <ol
            style="
              line-height:1.6;
            "
          >

            ${listaHtml(
              diagnostico.proximosPassos
            )}

          </ol>
        `
        : ""
    }


    <div
      style="
        background:#17233D;
        color:white;
        padding:18px;
        border-radius:10px;
        margin-top:24px;
        text-align:center;
      "
    >

      <strong>
        Quer aprofundar o diagnóstico?
      </strong>

      <p
        style="
          margin:8px 0 15px;
        "
      >

        Converse com um especialista
        da Finder of Solutions.

      </p>

      <a
        href="https://wa.me/5541989049616"
        style="
          display:inline-block;
          background:#FF6B4A;
          color:#FFFFFF;
          text-decoration:none;
          padding:11px 18px;
          border-radius:7px;
          font-weight:bold;
        "
      >

        Falar com especialista

      </a>

    </div>


    <p
      style="
        color:#7B8495;
        font-size:11px;
        margin-top:25px;
        line-height:1.5;
      "
    >

      Este diagnóstico é preliminar
      e educativo.

      As informações apresentadas não
      substituem análise profissional
      individualizada.

    </p>

  </div>

</div>

</body>

</html>
`;

  // =========================================================
  // 12. FUNÇÃO DE ENVIO
  // =========================================================

  async function enviarEmail({
    para,
    assunto,
    html,
  }) {
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

          body: JSON.stringify({
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

    const data =
      await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        data?.message ||
        data?.error ||
        "Erro ao enviar e-mail."
      );
    }

    return data;
  }

  // =========================================================
  // 13. ENVIO PARA FINDER
  // =========================================================

  try {
    const assuntoFinder =
      `Novo diagnóstico — ${razaoSocial}`;

    const envioFinder =
      await enviarEmail({
        para:
          emailFinder,

        assunto:
          assuntoFinder,

        html:
          htmlFinder,
      });

    // =======================================================
    // 14. ENVIO PARA O LEAD
    // =======================================================

    let envioLead = null;
    let erroLead = null;

    if (
      emailLead &&
      emailLead.includes("@")
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
      } catch (error) {
        erroLead =
          error?.message ||
          "Erro ao enviar relatório ao lead.";

        console.error(
          "Erro envio lead:",
          error
        );
      }
    }

    // =======================================================
    // 15. RETORNO
    // =======================================================

    return res
      .status(200)
      .json({
        sucesso: true,

        finder: {
          enviado: true,

          email:
            emailFinder,

          id:
            envioFinder?.id ||
            null,
        },

        lead: {
          solicitado:
            Boolean(emailLead),

          enviado:
            Boolean(envioLead),

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

  } catch (error) {
    console.error(
      "Erro ao enviar relatório:",
      error
    );

    return res
      .status(500)
      .json({
        sucesso: false,

        error:
          error?.message ||
          "Não foi possível enviar o relatório.",
      });
  }
}
