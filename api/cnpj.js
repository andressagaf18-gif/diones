// api/cnpj.js

export default async function handler(req, res) {
  // =========================================================
  // 1. PERMITIR APENAS GET
  // =========================================================

  if (req.method !== "GET") {
    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  // =========================================================
  // 2. LIMPAR E VALIDAR CNPJ
  // =========================================================

  const { cnpj } = req.query;

  const digits = String(cnpj || "").replace(/\D/g, "");

  if (digits.length !== 14) {
    return res.status(400).json({
      sucesso: false,
      error: "CNPJ inválido. Informe os 14 dígitos.",
    });
  }

  // =========================================================
  // 3. CLASSIFICAÇÃO DA EMPRESA PELO CNAE
  // =========================================================

  function classificarEmpresa(cnae, descricao = "") {
    const codigo = String(cnae || "").replace(/\D/g, "");
    const desc = String(descricao || "").toLowerCase();

    const divisao = parseInt(codigo.slice(0, 2), 10);

    /*
     * A ordem importa.
     *
     * Primeiro classificamos atividades específicas.
     * Depois usamos classificações mais genéricas.
     */

    // =======================================================
    // CONTABILIDADE
    // CNAE 6920-6/01
    // =======================================================

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

    // =======================================================
    // ADVOCACIA / SERVIÇOS JURÍDICOS
    // =======================================================

    if (
      codigo.startsWith("69117") ||
      desc.includes("advocacia") ||
      desc.includes("serviços advocatícios") ||
      desc.includes("servicos advocaticios")
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

    // =======================================================
    // SAÚDE / CLÍNICAS
    // Divisão CNAE 86
    // =======================================================

    if (
      divisao === 86 ||
      desc.includes("médic") ||
      desc.includes("medic") ||
      desc.includes("odontolog") ||
      desc.includes("clínica") ||
      desc.includes("clinica") ||
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

    // =======================================================
    // TECNOLOGIA
    // Divisões CNAE 62 e 63
    // =======================================================

    if (
      divisao === 62 ||
      divisao === 63 ||
      desc.includes("software") ||
      desc.includes("tecnologia da informação") ||
      desc.includes("tecnologia da informacao") ||
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

    // =======================================================
    // CONSTRUÇÃO CIVIL
    // Divisões CNAE 41, 42 e 43
    // =======================================================

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

    // =======================================================
    // E-COMMERCE
    // Identificação principalmente pela descrição.
    // =======================================================

    if (
      desc.includes("internet") ||
      desc.includes("comércio eletrônico") ||
      desc.includes("comercio eletronico") ||
      desc.includes("e-commerce")
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

    // =======================================================
    // COMÉRCIO
    // Divisões CNAE 45, 46 e 47
    // =======================================================

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

    // =======================================================
    // INDÚSTRIA
    // Divisões CNAE 10 a 33
    // =======================================================

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

    // =======================================================
    // TRANSPORTE / LOGÍSTICA
    // Divisões CNAE 49 a 53
    // =======================================================

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

    // =======================================================
    // ALIMENTAÇÃO
    // Divisão CNAE 56
    // =======================================================

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

    // =======================================================
    // IMOBILIÁRIO
    // Divisão CNAE 68
    // =======================================================

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

    // =======================================================
    // SERVIÇOS PROFISSIONAIS
    // Divisões 69 a 75
    // =======================================================

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

    // =======================================================
    // FALLBACK
    // Nenhuma empresa deve ficar sem classificação.
    // =======================================================

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

  // =========================================================
  // 4. CONSULTAR CNPJ
  // =========================================================

  try {
    const response = await fetch(
      `https://brasilapi.com.br/api/cnpj/v1/${digits}`,
      {
        method: "GET",

        headers: {
          /*
           * Importante:
           * algumas chamadas serverless podem receber 403
           * sem User-Agent explícito.
           */
          "User-Agent": "finder-diagnostico-empresarial/1.0",

          Accept: "application/json",
        },
      }
    );

    // =======================================================
    // 5. TRATAMENTO DOS ERROS DA BRASILAPI
    // =======================================================

    if (!response.ok) {
      const detalhe = await response.text();

      console.error("Erro BrasilAPI:", {
        status: response.status,
        statusText: response.statusText,
        detalhe,
      });

      if (response.status === 404) {
        return res.status(404).json({
          sucesso: false,
          error: "CNPJ não encontrado.",
        });
      }

      if (response.status === 403) {
        return res.status(503).json({
          sucesso: false,
          error:
            "O serviço de consulta de CNPJ está temporariamente indisponível.",
          statusBrasilAPI: 403,
        });
      }

      return res.status(502).json({
        sucesso: false,
        error: "Não foi possível consultar o CNPJ.",
        statusBrasilAPI: response.status,
      });
    }

    // =======================================================
    // 6. DADOS RETORNADOS
    // =======================================================

    const data = await response.json();

    const cnaeCodigo =
      data.cnae_fiscal ||
      data.cnaeFiscal ||
      "";

    const cnaeDescricao =
      data.cnae_fiscal_descricao ||
      data.cnaeFiscalDescricao ||
      "";

    // =======================================================
    // 7. CLASSIFICAR EMPRESA
    // =======================================================

    const classificacao = classificarEmpresa(
      cnaeCodigo,
      cnaeDescricao
    );

    // =======================================================
    // 8. RETORNO PARA O APP
    // =======================================================

    return res.status(200).json({
      sucesso: true,

      empresa: {
        cnpj: digits,

        razaoSocial:
          data.razao_social ||
          "",

        nomeFantasia:
          data.nome_fantasia ||
          "",

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
          data.email ||
          "",
      },

      cnae: {
        codigo: cnaeCodigo,
        descricao: cnaeDescricao,
      },

      classificacao,

      endereco: {
        logradouro:
          data.logradouro ||
          "",

        numero:
          data.numero ||
          "",

        complemento:
          data.complemento ||
          "",

        bairro:
          data.bairro ||
          "",

        municipio:
          data.municipio ||
          "",

        uf:
          data.uf ||
          "",

        cep:
          data.cep ||
          "",
      },
    });

  } catch (error) {
    // =======================================================
    // 9. ERRO INTERNO
    // =======================================================

    console.error(
      "Erro ao consultar CNPJ:",
      error
    );

    return res.status(500).json({
      sucesso: false,
      error:
        "Erro interno ao consultar o CNPJ.",
    });
  }
}
