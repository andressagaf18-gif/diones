// api/enviar-relatorio.js

function escaparHtml(valor = "") {
  return String(valor ?? "")
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

  const texto = [codigo, descricao]
    .filter(Boolean)
    .join(" — ");

  return escaparHtml(texto || "-");
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

  if (texto === "sim") return "Sim";

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
      error:
        "RESEND_API_KEY não configurada na Vercel.",
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
    descricaoNegocio = "",
    negocioInterpretado = {},
    resultado = {},
    respostas = [],
    perguntas = [],
  } = body;

  // Compatibilidade caso respostas/perguntas estejam
  // dentro de resultado.

  const respostasFinais =
    Array.isArray(respostas) && respostas.length
      ? respostas
      : Array.isArray(resultado.respostas)
        ? resultado.respostas
        : [];

  const perguntasFinais =
    Array.isArray(perguntas) && perguntas.length
      ? perguntas
      : Array.isArray(resultado.perguntas)
        ? resultado.perguntas
        : [];

  const diagnostico =
    resultado.diagnosticoGeral || {};

  const visaoGrupo =
    resultado.visaoGrupo || {};

  const lacunasDiagnostico =
    Array.isArray(resultado.lacunasDiagnostico)
      ? resultado.lacunasDiagnostico
      : [];

  const oportunidadesConsultoria =
    Array.isArray(resultado.oportunidadesConsultoria)
      ? resultado.oportunidadesConsultoria
      : [];

  const areas =
    Array.isArray(resultado.areas)
      ? resultado.areas
      : [];

  // =========================================================
  // 4. DADOS PRINCIPAIS
  // =========================================================

  const razaoSocial =
    empresa.razao ||
    empresa.razaoSocial ||
    empresa.nome ||
    "Empresa";

  const cnpj =
    empresa.cnpjDigits ||
    empresa.cnpj ||
    "-";

  const nomeResponsavel =
    responsavel.nome ||
    "Não informado";

  const emailLead =
    String(
      responsavel.email || ""
    ).trim();

  const telefoneLead =
    responsavel.telefone ||
    responsavel.whatsapp ||
    "-";

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
                    item.nome ||
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
      : "";

  // =========================================================
  // 6. INTERPRETAÇÃO DO NEGÓCIO
  // =========================================================

  const interpretacaoHtml = `
    <div class="grid">

      <div class="box">
        <strong>Segmento interpretado</strong>
        <p>
          ${escaparHtml(
            negocioInterpretado.segmentoReal ||
            empresa.segmento ||
            "-"
          )}
        </p>
      </div>

      <div class="box">
        <strong>Subsegmento</strong>
        <p>
          ${escaparHtml(
            negocioInterpretado.subsegmento ||
            "-"
          )}
        </p>
      </div>

      <div class="box">
        <strong>Modelo de negócio</strong>
        <p>
          ${escaparHtml(
            negocioInterpretado.modeloNegocio ||
            "-"
          )}
        </p>
      </div>

      <div class="box">
        <strong>Confiança da interpretação</strong>
        <p>
          ${escaparHtml(
            negocioInterpretado.nivelConfianca ||
            "-"
          )}
        </p>
      </div>

    </div>

    ${
      negocioInterpretado.resumoNegocio
        ? `
          <div class="box">
            <strong>Como entendemos o negócio</strong>

            <p>
              ${escaparHtml(
                negocioInterpretado.resumoNegocio
              )}
            </p>
          </div>
        `
        : ""
    }

    ${
      negocioInterpretado.comoGeraReceita
        ? `
          <div class="box">
            <strong>Como gera receita</strong>

            <p>
              ${escaparHtml(
                negocioInterpretado.comoGeraReceita
              )}
            </p>
          </div>
        `
        : ""
    }

    ${
      Array.isArray(
        negocioInterpretado.caracteristicasOperacionais
      ) &&
      negocioInterpretado.caracteristicasOperacionais.length
        ? `
          <div class="box">
            <strong>
              Características operacionais consideradas
            </strong>

            <ul>
              ${listaHtml(
                negocioInterpretado.caracteristicasOperacionais
              )}
            </ul>
          </div>
        `
        : ""
    }

    ${
      Array.isArray(
        negocioInterpretado.riscosNaturais
      ) &&
      negocioInterpretado.riscosNaturais.length
        ? `
          <div class="box">
            <strong>
              Riscos naturais considerados na elaboração das perguntas
            </strong>

            <ul>
              ${listaHtml(
                negocioInterpretado.riscosNaturais
              )}
            </ul>
          </div>
        `
        : ""
    }

    ${
      Array.isArray(
        negocioInterpretado.divergenciasCadastrais
      ) &&
      negocioInterpretado.divergenciasCadastrais.length
        ? `
          <div class="box alerta-suave">
            <strong>
              Pontos cadastrais para validação
            </strong>

            <ul>
              ${listaHtml(
                negocioInterpretado.divergenciasCadastrais
              )}
            </ul>
          </div>
        `
        : ""
    }
  `;

  // =========================================================
  // 7. ÁREAS DO DIAGNÓSTICO
  // =========================================================

  const areasHtml =
    areas.length > 0
      ? areas
          .map((area) => {
            return `
              <div class="area">

                <div class="area-header">

                  <div>
                    <h3>
                      ${escaparHtml(
                        area.area || "Área"
                      )}
                    </h3>

                    <span class="nivel">
                      ${escaparHtml(
                        nivelTexto(area.nivel)
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
                      <p class="area-resumo">
                        ${escaparHtml(
                          area.resumo
                        )}
                      </p>
                    `
                    : ""
                }

                <div class="grid">

                  <div class="box">
                    <strong>Achados</strong>

                    <ul>
                      ${listaHtml(
                        area.achados,
                        "Nenhum achado relevante registrado."
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
                        "Não foi possível determinar causas com segurança."
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
                        area.recomendacoes,
                        "Nenhuma recomendação adicional registrada."
                      )}
                    </ol>
                  </div>

                </div>

              </div>
            `;
          })
          .join("")
      : `
        <div class="box">
          Não foram recebidas análises detalhadas por área.
        </div>
      `;

  // =========================================================
  // 8. PERGUNTAS E RESPOSTAS COMPLETAS
  // =========================================================

  const mapaPerguntas =
    new Map();

  perguntasFinais.forEach((pergunta) => {
    if (pergunta?.id) {
      mapaPerguntas.set(
        String(pergunta.id),
        pergunta
      );
    }
  });

  let respostasNormalizadas = [];

  if (respostasFinais.length > 0) {
    respostasNormalizadas =
      respostasFinais.map((item, index) => {
        const perguntaOriginal =
          item?.id
            ? mapaPerguntas.get(String(item.id))
            : null;

        return {
          id:
            item?.id ||
            perguntaOriginal?.id ||
            index + 1,

          area:
            item?.area ||
            perguntaOriginal?.area ||
            "-",

          tema:
            item?.tema ||
            perguntaOriginal?.tema ||
            "-",

          pergunta:
            item?.pergunta ||
            item?.texto ||
            perguntaOriginal?.pergunta ||
            "-",

          resposta:
            item?.resposta ??
            item?.valor ??
            "-",

          peso:
            item?.peso ||
            perguntaOriginal?.peso ||
            "-",

          motivo:
            item?.motivo ||
            perguntaOriginal?.motivo ||
            "",

          riscoAvaliado:
            item?.riscoAvaliado ||
            perguntaOriginal?.riscoAvaliado ||
            "",
        };
      });
  } else if (perguntasFinais.length > 0) {
    respostasNormalizadas =
      perguntasFinais.map((item, index) => ({
        id:
          item?.id ||
          index + 1,

        area:
          item?.area ||
          "-",

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
          "-",

        motivo:
          item?.motivo ||
          "",

        riscoAvaliado:
          item?.riscoAvaliado ||
          "",
      }));
  }

  const respostasHtml =
    respostasNormalizadas.length > 0
      ? respostasNormalizadas
          .map(
            (item, index) => `
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

                  ${
                    item.riscoAvaliado
                      ? `
                        <div class="detalhe">
                          <strong>Risco avaliado:</strong>
                          ${escaparHtml(
                            item.riscoAvaliado
                          )}
                        </div>
                      `
                      : ""
                  }
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
              As respostas detalhadas não foram recebidas
              nesta solicitação.
            </td>
          </tr>
        `;

  // =========================================================
  // 9. LACUNAS
  // =========================================================

  const lacunasHtml =
    lacunasDiagnostico.length > 0
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
                  lacuna.perguntasSugeridas.length
                    ? `
                      <strong>
                        Perguntas para aprofundamento
                      </strong>

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
          <div class="box">
            Nenhuma lacuna adicional relevante foi apontada.
          </div>
        `;

  // =========================================================
  // 10. OPORTUNIDADES DE CONSULTORIA
  // =========================================================

  const oportunidadesConsultoriaHtml =
    oportunidadesConsultoria.length > 0
      ? oportunidadesConsultoria
          .map(
            (item) => `
              <div class="box">

                <div class="linha-titulo">
                  <strong>
                    ${escaparHtml(
                      item.oportunidade ||
                      item.area ||
                      "Oportunidade"
                    )}
                  </strong>

                  <span class="badge">
                    ${escaparHtml(
                      prioridadeTexto(
                        item.prioridade
                      )
                    )}
                  </span>
                </div>

                ${
                  item.area
                    ? `
                      <p>
                        <strong>Área:</strong>
                        ${escaparHtml(
                          item.area
                        )}
                      </p>
                    `
                    : ""
                }

                <p>
                  ${escaparHtml(
                    item.motivo ||
                    ""
                  )}
                </p>

              </div>
            `
          )
          .join("")
      : `
          <div class="box">
            Nenhuma oportunidade específica de consultoria
            foi indicada.
          </div>
        `;

  // =========================================================
  // 11. HTML COMPLETO PARA FINDER
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

.header h1 {
  margin: 0 0 6px;
  font-size: 26px;
}

.header p {
  margin: 0;
  opacity: .82;
}

.content {
  padding: 30px;
}

h2 {
  color: #17233D;
  margin-top: 34px;
  margin-bottom: 14px;
  padding-bottom: 7px;
  border-bottom: 2px solid #FF6B4A;
  font-size: 18px;
}

h3 {
  margin: 0;
  color: #17233D;
}

p {
  line-height: 1.6;
}

ul,
ol {
  line-height: 1.55;
  padding-left: 22px;
}

li {
  margin-bottom: 6px;
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

.destaque {
  background: #FFF7F4;
  border-left: 4px solid #FF6B4A;
}

.alerta {
  background: #FAEEDA;
  color: #70410A;
  padding: 18px;
  border-radius: 10px;
  line-height: 1.55;
}

.alerta-suave {
  background: #FFF8E8;
}

.score {
  color: #FF6B4A;
  font-size: 34px;
  font-weight: 700;
}

.area {
  margin-bottom: 30px;
}

.area-header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
  margin-bottom: 10px;
}

.area-resumo {
  color: #5B667A;
  line-height: 1.55;
}

.score-area {
  color: #FF6B4A;
  font-size: 22px;
  font-weight: 700;
  white-space: nowrap;
}

.nivel {
  display: inline-block;
  margin-top: 5px;
  color: #5B667A;
  font-size: 12px;
}

.badge {
  display: inline-block;
  background: #17233D;
  color: #FFFFFF;
  border-radius: 5px;
  padding: 5px 8px;
  font-size: 11px;
}

.linha-titulo {
  display: flex;
  justify-content: space-between;
  gap: 15px;
}

.detalhe {
  margin-top: 6px;
  color: #6A7485;
  font-size: 11px;
  line-height: 1.4;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
}

th {
  background: #E9EDF5;
  color: #17233D;
  text-align: left;
  padding: 9px 7px;
  font-size: 12px;
}

td {
  border-bottom: 1px solid #E1E5EC;
  padding: 9px 7px;
  vertical-align: top;
  font-size: 12px;
  line-height: 1.45;
}

.footer {
  background: #17233D;
  color: #FFFFFF;
  padding: 22px 30px;
  font-size: 11px;
  line-height: 1.5;
}

@media (max-width: 650px) {
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
        <p>
          ${escaparHtml(
            responsavel.cargo || "-"
          )}
        </p>
      </div>

      <div class="box">
        <strong>WhatsApp</strong>
        <p>${escaparHtml(telefoneLead)}</p>
      </div>

      <div class="box">
        <strong>E-mail</strong>
        <p>${escaparHtml(emailLead || "-")}</p>
      </div>

    </div>

    <h2>
      Empresa
    </h2>

    <div class="grid">

      <div class="box">
        <strong>Razão social</strong>
        <p>${escaparHtml(razaoSocial)}</p>
      </div>

      <div class="box">
        <strong>CNPJ</strong>
        <p>${escaparHtml(cnpj)}</p>
      </div>

      <div class="box">
        <strong>Segmento cadastrado</strong>
        <p>
          ${escaparHtml(
            empresa.segmento || "-"
          )}
        </p>
      </div>

      <div class="box">
        <strong>Categoria</strong>
        <p>
          ${escaparHtml(
            empresa.categoria || "-"
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
      O que a empresa realmente faz
    </h2>

    <div class="box">

      <p>
        ${escaparHtml(
          descricaoNegocio ||
          empresa.descricaoNegocio ||
          "Não informado."
        )}
      </p>

    </div>

    <h2>
      Interpretação do negócio
    </h2>

    ${interpretacaoHtml}

    <h2>
      Perfil empresarial
    </h2>

    <div class="grid">

      <div class="box">
        <strong>Faturamento</strong>
        <p>
          ${escaparHtml(
            perfil.faturamento || "-"
          )}
        </p>
      </div>

      <div class="box">
        <strong>Colaboradores</strong>
        <p>
          ${escaparHtml(
            perfil.colaboradores || "-"
          )}
        </p>
      </div>

      <div class="box">
        <strong>Regime tributário</strong>
        <p>
          ${escaparHtml(
            perfil.regime || "-"
          )}
        </p>
      </div>

      <div class="box">
        <strong>Score geral</strong>

        <p>
          <span class="score">
            ${
              diagnostico.scoreGeral ??
              "-"
            }
          </span>/100
        </p>
      </div>

    </div>

    <h2>
      Dor declarada pelo empresário
    </h2>

    <div class="box">
      <strong>Principal dor</strong>

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
        Problema que gostaria de resolver
        nos próximos 90 dias
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
            Leitura consultiva da dor
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
            Principal alerta estratégico
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
      Oportunidades identificadas
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
            Empresas informadas
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
      visaoGrupo.aplicavel
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
                visaoGrupo.pontosAtencao
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
      Formulário personalizado completo
    </h2>

    <p>
      Abaixo estão as perguntas utilizadas
      no diagnóstico e as respostas fornecidas
      pelo participante.
    </p>

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

  </div>

  <div class="footer">

    <strong>
      Finder of Solutions
    </strong>

    <br><br>

    Diagnóstico empresarial preliminar.

    As informações apresentadas foram elaboradas
    com base nas respostas fornecidas pelo participante
    e devem ser validadas antes da tomada de decisões
    contábeis, tributárias, financeiras,
    trabalhistas ou jurídicas.

  </div>

</div>

</body>
</html>
`;

  // =========================================================
  // 12. E-MAIL PARA O LEAD
  // =========================================================

  const htmlLead = `
<!doctype html>

<html lang="pt-BR">

<head>
<meta charset="utf-8">
<meta name="viewport"
      content="width=device-width, initial-scale=1">
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
      color:#FFFFFF;
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

    <h1
      style="
        margin:0 0 7px;
        font-size:24px;
      "
    >
      Diagnóstico Empresarial
    </h1>

    <p
      style="
        margin:0;
        opacity:.82;
      "
    >
      Finder of Solutions
    </p>

  </div>

  <div
    style="
      padding:30px;
    "
  >

    <p>
      Olá,
      <strong>
        ${escaparHtml(nomeResponsavel)}
      </strong>.
    </p>

    <p>
      Obrigado por participar do
      Diagnóstico Empresarial Finder.
    </p>

    <p>
      Analisamos as informações fornecidas
      sobre
      <strong>
        ${escaparHtml(razaoSocial)}
      </strong>
      considerando não apenas as atividades
      cadastrais, mas também a descrição da
      operação e as respostas fornecidas.
    </p>

    <div
      style="
        background:#F7F8FB;
        border:1px solid #E9EDF4;
        padding:18px;
        border-radius:10px;
        margin:22px 0;
      "
    >

      <div
        style="
          font-size:13px;
          color:#6A7485;
        "
      >
        Resultado geral
      </div>

      <div
        style="
          color:#FF6B4A;
          font-size:34px;
          font-weight:700;
          margin-top:5px;
        "
      >
        ${
          diagnostico.scoreGeral ??
          "-"
        }/100
      </div>

      <div
        style="
          margin-top:4px;
          font-weight:bold;
        "
      >
        ${escaparHtml(
          nivelTexto(
            diagnostico.nivelGeral
          )
        )}
      </div>

    </div>

    ${
      descricaoNegocio ||
      negocioInterpretado.resumoNegocio
        ? `
          <h2
            style="
              font-size:18px;
              color:#17233D;
            "
          >
            Como entendemos seu negócio
          </h2>

          <div
            style="
              background:#F7F8FB;
              padding:16px;
              border-radius:9px;
              line-height:1.6;
            "
          >

            ${escaparHtml(
              negocioInterpretado.resumoNegocio ||
              descricaoNegocio
            )}

          </div>
        `
        : ""
    }

    <h2
      style="
        font-size:18px;
        color:#17233D;
        margin-top:26px;
      "
    >
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
              line-height:1.55;
            "
          >

            <strong>
              Alerta estratégico
            </strong>

            <p
              style="
                margin:8px 0 0;
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
        diagnostico.pontosFortes
      ) &&
      diagnostico.pontosFortes.length
        ? `
          <h3>
            Pontos fortes
          </h3>

          <ul
            style="
              line-height:1.6;
            "
          >
            ${listaHtml(
              diagnostico.pontosFortes
            )}
          </ul>
        `
        : ""
    }

    ${
      Array.isArray(
        diagnostico.prioridadesImediatas
      ) &&
      diagnostico.prioridadesImediatas.length
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
      diagnostico.proximosPassos.length
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
        color:#FFFFFF;
        padding:22px;
        border-radius:10px;
        margin-top:28px;
        text-align:center;
      "
    >

      <strong
        style="
          font-size:17px;
        "
      >
        Quer entender melhor esses números?
      </strong>

      <p
        style="
          margin:9px 0 17px;
          line-height:1.5;
        "
      >
        Converse com um especialista da
        Finder of Solutions para aprofundar
        os pontos identificados.
      </p>

      <a
        href="https://wa.me/5541989049616?text=Ol%C3%A1%2C%20fiz%20o%20Diagn%C3%B3stico%20Empresarial%20Finder%20e%20gostaria%20de%20conversar%20com%20um%20especialista."
        style="
          display:inline-block;
          background:#FF6B4A;
          color:#FFFFFF;
          text-decoration:none;
          padding:13px 20px;
          border-radius:7px;
          font-weight:bold;
        "
      >
        Falar com um especialista
      </a>

    </div>

    <p
      style="
        color:#7B8495;
        font-size:11px;
        margin-top:26px;
        line-height:1.5;
      "
    >
      Este diagnóstico é preliminar e foi
      elaborado a partir das informações
      fornecidas no formulário.

      As recomendações não substituem análise
      profissional individualizada.
    </p>

  </div>

</div>

</body>
</html>
`;

  // =========================================================
  // 13. FUNÇÃO PARA ENVIAR
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
        data?.error?.message ||
        data?.error ||
        "Erro ao enviar e-mail."
      );
    }

    return data;
  }

  // =========================================================
  // 14. ENVIAR
  // =========================================================

  try {
    // Finder recebe sempre o relatório completo.

    const envioFinder =
      await enviarEmail({
        para:
          emailFinder,

        assunto:
          `Novo diagnóstico empresarial — ${razaoSocial}`,

        html:
          htmlFinder,
      });

    // Lead recebe automaticamente se informou e-mail.

    let envioLead = null;
    let erroLead = null;

    const emailLeadValido =
      emailLead &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        emailLead
      );

    if (emailLeadValido) {
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
          "Erro ao enviar relatório ao participante.";

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

          emailValido:
            Boolean(emailLeadValido),

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
