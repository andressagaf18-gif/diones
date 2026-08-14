// api/cnpj.js

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  const { cnpj } = req.query;
  const digits = String(cnpj || "").replace(/\D/g, "");

  if (digits.length !== 14) {
    return res.status(400).json({
      sucesso: false,
      error: "CNPJ inválido. Informe os 14 dígitos.",
    });
  }

  function classificarEmpresa(cnae, descricao = "") {
    const codigo = String(cnae || "").replace(/\D/g, "");
    const desc = String(descricao || "").toLowerCase();
    const divisao = parseInt(codigo.slice(0, 2), 10);

    // CONTABILIDADE
    if (
      codigo.startsWith("6920601") ||
      desc.includes("contabilidade")
    ) {
      return {
        segmento: "Serviços Profissionais",
        categoria: "Contabilidade",
        codigoQuestionario: "contabilidade",

        diagnostico: {
          areasPrioritarias: [
            "Processos",
            "Comercial",
            "Financeiro",
            "Tecnologia",
            "Pessoas",
          ],

          areasComplementares: [
            "Marketing",
            "Gestão",
            "Atendimento",
          ],
        },
      };
    }

    // ADVOCACIA
    if (
      codigo.startsWith("69117") ||
      desc.includes("advocacia")
    ) {
      return {
        segmento: "Serviços Profissionais",
        categoria: "Advocacia",
        codigoQuestionario: "advocacia",

        diagnostico: {
          areasPrioritarias: [
            "Comercial",
            "Processos",
            "Financeiro",
            "Jurídico",
            "Tecnologia",
          ],

          areasComplementares: [
            "Marketing",
            "Gestão",
            "Pessoas",
          ],
        },
      };
    }

    // SAÚDE
    if (
      divisao === 86 ||
      desc.includes("clínica") ||
      desc.includes("clinica") ||
      desc.includes("odontolog") ||
      desc.includes("psicolog") ||
      desc.includes("fisioterapia")
    ) {
      return {
        segmento: "Serviços",
        categoria: "Saúde / Clínica",
        codigoQuestionario: "saude",

        diagnostico: {
          areasPrioritarias: [
            "Financeiro",
            "Atendimento",
            "Processos",
            "Marketing",
            "Tecnologia",
          ],

          areasComplementares: [
            "Pessoas",
            "Gestão",
            "LGPD",
          ],
        },
      };
    }

    // TECNOLOGIA
    if (
      divisao === 62 ||
      divisao === 63 ||
      desc.includes("software") ||
      desc.includes("programação") ||
      desc.includes("programacao")
    ) {
      return {
        segmento: "Serviços",
        categoria: "Tecnologia",
        codigoQuestionario: "tecnologia",

        diagnostico: {
          areasPrioritarias: [
            "Comercial",
            "Financeiro",
            "Tecnologia",
            "Processos",
            "Gestão",
          ],

          areasComplementares: [
            "Marketing",
            "Pessoas",
            "Segurança da Informação",
          ],
        },
      };
    }

    // CONSTRUÇÃO CIVIL
    if (
      divisao >= 41 &&
      divisao <= 43
    ) {
      return {
        segmento: "Construção",
        categoria: "Construção Civil",
        codigoQuestionario: "construcao",

        diagnostico: {
          areasPrioritarias: [
            "Financeiro",
            "Operacional",
            "Processos",
            "Jurídico",
            "Gestão",
          ],

          areasComplementares: [
            "Pessoas",
            "Comercial",
            "Tecnologia",
          ],
        },
      };
    }

    // E-COMMERCE
    if (
      desc.includes("internet") ||
      desc.includes("e-commerce") ||
      desc.includes("comércio eletrônico") ||
      desc.includes("comercio eletronico")
    ) {
      return {
        segmento: "Comércio",
        categoria: "E-commerce",
        codigoQuestionario: "ecommerce",

        diagnostico: {
          areasPrioritarias: [
            "Marketing",
            "Comercial",
            "Financeiro",
            "Operacional",
            "Tecnologia",
          ],

          areasComplementares: [
            "Logística",
            "Atendimento",
            "Contábil / Fiscal",
          ],
        },
      };
    }

    // COMÉRCIO
    if (
      divisao >= 45 &&
      divisao <= 47
    ) {
      return {
        segmento: "Comércio",
        categoria: "Comércio",
        codigoQuestionario: "comercio",

        diagnostico: {
          areasPrioritarias: [
            "Financeiro",
            "Comercial",
            "Estoque",
            "Marketing",
            "Contábil / Fiscal",
          ],

          areasComplementares: [
            "Operacional",
            "Atendimento",
            "Tecnologia",
          ],
        },
      };
    }

    // INDÚSTRIA
    if (
      divisao >= 10 &&
      divisao <= 33
    ) {
      return {
        segmento: "Indústria",
        categoria: "Indústria",
        codigoQuestionario: "industria",

        diagnostico: {
          areasPrioritarias: [
            "Produção",
            "Custos",
            "Financeiro",
            "Estoque",
            "Processos",
          ],

          areasComplementares: [
            "Qualidade",
            "Comercial",
            "Contábil / Fiscal",
          ],
        },
      };
    }

    // TRANSPORTE / LOGÍSTICA
    if (
      divisao >= 49 &&
      divisao <= 53
    ) {
      return {
        segmento: "Serviços",
        categoria: "Transporte / Logística",
        codigoQuestionario: "logistica",

        diagnostico: {
          areasPrioritarias: [
            "Operacional",
            "Financeiro",
            "Processos",
            "Gestão",
            "Tecnologia",
          ],

          areasComplementares: [
            "Pessoas",
            "Comercial",
            "Contábil / Fiscal",
          ],
        },
      };
    }

    // ALIMENTAÇÃO
    if (
      divisao === 56 ||
      desc.includes("restaurante") ||
      desc.includes("lanchonete") ||
      desc.includes("alimentação") ||
      desc.includes("alimentacao")
    ) {
      return {
        segmento: "Comércio / Serviços",
        categoria: "Alimentação",
        codigoQuestionario: "alimentacao",

        diagnostico: {
          areasPrioritarias: [
            "Operacional",
            "Financeiro",
            "Estoque",
            "Marketing",
            "Pessoas",
          ],

          areasComplementares: [
            "Atendimento",
            "Compras",
            "Gestão",
          ],
        },
      };
    }

    // IMOBILIÁRIO
    if (
      divisao === 68 ||
      desc.includes("imobiliár") ||
      desc.includes("imobiliar")
    ) {
      return {
        segmento: "Serviços",
        categoria: "Imobiliária / Atividades Imobiliárias",
        codigoQuestionario: "imobiliario",

        diagnostico: {
          areasPrioritarias: [
            "Comercial",
            "Financeiro",
            "Marketing",
            "Jurídico",
            "Processos",
          ],

          areasComplementares: [
            "Atendimento",
            "Tecnologia",
            "Gestão",
          ],
        },
      };
    }

    // SERVIÇOS PROFISSIONAIS
    if (
      divisao >= 69 &&
      divisao <= 75
    ) {
      return {
        segmento: "Serviços Profissionais",
        categoria: "Serviços Profissionais",
        codigoQuestionario: "servicos_profissionais",

        diagnostico: {
          areasPrioritarias: [
            "Comercial",
            "Financeiro",
            "Processos",
            "Marketing",
            "Gestão",
          ],

          areasComplementares: [
            "Tecnologia",
            "Pessoas",
            "Atendimento",
          ],
        },
      };
    }

    // PADRÃO
    return {
      segmento: "Serviços",
      categoria: "Serviços Profissionais",
      codigoQuestionario: "servicos",

      diagnostico: {
        areasPrioritarias: [
          "Financeiro",
          "Comercial",
          "Processos",
          "Gestão",
          "Marketing",
        ],

        areasComplementares: [
          "Tecnologia",
          "Pessoas",
          "Atendimento",
        ],
      },
    };
  }

  try {
    const response = await fetch(
      `https://brasilapi.com.br/api/cnpj/v1/${digits}`,
      {
        method: "GET",

        headers: {
          "User-Agent":
            "finder-diagnostico-empresarial/1.0",

          Accept:
            "application/json",
        },
      }
    );

    if (!response.ok) {
      const detalhe =
        await response.text();

      console.error(
        "Erro BrasilAPI:",
        response.status,
        detalhe
      );

      return res
        .status(
          response.status === 404
            ? 404
            : 502
        )
        .json({
          sucesso: false,

          error:
            response.status === 404
              ? "CNPJ não encontrado."
              : "Não foi possível consultar o CNPJ.",

          statusBrasilAPI:
            response.status,
        });
    }

    const data =
      await response.json();

    // CNAE PRINCIPAL
   // =========================================================
// CNAE PRINCIPAL
// =========================================================

const cnaeCodigo =
  data.cnae_fiscal ||
  data.cnaeFiscal ||
  data.cnae_principal ||
  data.cnaePrincipal ||
  "";

const cnaeDescricao =
  data.cnae_fiscal_descricao ||
  data.cnaeFiscalDescricao ||
  data.cnae_principal_descricao ||
  data.cnaePrincipalDescricao ||
  "";

// =========================================================
// NORMALIZAR CNAE
// =========================================================

function normalizarCnae(item, principal = false) {
  if (!item) return null;

  const codigo =
    item.codigo ||
    item.code ||
    item.cnae ||
    item.cnae_fiscal ||
    item.id ||
    "";

  const descricao =
    item.descricao ||
    item.description ||
    item.texto ||
    item.cnae_fiscal_descricao ||
    item.nome ||
    "";

  if (!codigo && !descricao) {
    return null;
  }

  return {
    codigo: String(codigo || ""),
    descricao: String(descricao || ""),
    principal,

    classificacao: classificarEmpresa(
      codigo,
      descricao
    ),
  };
}

// =========================================================
// MONTAR CNAE PRINCIPAL
// =========================================================

const cnaePrincipal = {
  codigo: String(cnaeCodigo || ""),

  descricao:
    String(cnaeDescricao || ""),

  principal: true,

  classificacao:
    classificarEmpresa(
      cnaeCodigo,
      cnaeDescricao
    ),
};

// =========================================================
// PROCURAR CNAES SECUNDÁRIOS EM DIFERENTES CAMPOS
// =========================================================

const secundariosBrutos =
  data.cnaes_secundarios ||
  data.cnaesSecundarios ||
  data.atividades_secundarias ||
  data.atividadesSecundarias ||
  data.secondary_activities ||
  [];

// =========================================================
// NORMALIZAR SECUNDÁRIOS
// =========================================================

const cnaesSecundarios =
  Array.isArray(secundariosBrutos)
    ? secundariosBrutos
        .map((item) =>
          normalizarCnae(
            item,
            false
          )
        )
        .filter(Boolean)
    : [];

// =========================================================
// REMOVER DUPLICIDADES
// =========================================================

const mapaCnaes =
  new Map();

[
  cnaePrincipal,
  ...cnaesSecundarios,
].forEach((item) => {
  if (!item) return;

  const chave =
    String(item.codigo || "")
      .replace(/\D/g, "") ||
    String(item.descricao || "")
      .toLowerCase();

  if (!chave) return;

  if (!mapaCnaes.has(chave)) {
    mapaCnaes.set(
      chave,
      item
    );
  }
});

const todosCnaes =
  Array.from(
    mapaCnaes.values()
  );

    const cnaePrincipal = {
      codigo:
        String(cnaeCodigo || ""),

      descricao:
        cnaeDescricao || "",

      principal:
        true,

      classificacao:
        classificarEmpresa(
          cnaeCodigo,
          cnaeDescricao
        ),
    };

    // CNAES SECUNDÁRIOS
    const cnaesSecundarios =
      Array.isArray(
        data.cnaes_secundarios
      )
        ? data.cnaes_secundarios
            .map((item) => ({
              codigo:
                String(
                  item?.codigo || ""
                ),

              descricao:
                item?.descricao || "",

              principal:
                false,

              classificacao:
                classificarEmpresa(
                  item?.codigo,
                  item?.descricao
                ),
            }))
            .filter(
              (item) =>
                item.codigo ||
                item.descricao
            )
        : [];

    // TODOS OS CNAES
    const todosCnaes = [
      cnaePrincipal,
      ...cnaesSecundarios,
    ];

    return res
      .status(200)
      .json({
        sucesso: true,

        empresa: {
          cnpj:
            digits,

          razaoSocial:
            data.razao_social || "",

          nomeFantasia:
            data.nome_fantasia || "",

          porte:
            data.porte ||
            "Não informado",

          naturezaJuridica:
            data.natureza_juridica ||
            "",

          situacao:
            data.descricao_situacao_cadastral ||
            data.situacao_cadastral ||
            "",

          abertura:
            data.data_inicio_atividade ||
            "",

          telefone:
            data.ddd_telefone_1 ||
            data.ddd_telefone_2 ||
            "",

          email:
            data.email || "",
        },

        // COMPATIBILIDADE COM VERSÃO ANTIGA
        cnae: {
          codigo:
            cnaeCodigo,

          descricao:
            cnaeDescricao,

          principal:
            cnaePrincipal,

          secundarios:
            cnaesSecundarios,

          todos:
            todosCnaes,
        },

        // NOVA ESTRUTURA
        cnaePrincipal,

        cnaesSecundarios,

        todosCnaes,

        classificacao:
          cnaePrincipal.classificacao,

        endereco: {
          logradouro:
            data.logradouro || "",

          numero:
            data.numero || "",

          complemento:
            data.complemento || "",

          bairro:
            data.bairro || "",

          municipio:
            data.municipio || "",

          uf:
            data.uf || "",

          cep:
            data.cep || "",
        },
      });

  } catch (error) {
    console.error(
      "Erro ao consultar CNPJ:",
      error
    );

    return res
      .status(500)
      .json({
        sucesso: false,

        error:
          "Erro interno ao consultar o CNPJ.",
      });
  }
}
