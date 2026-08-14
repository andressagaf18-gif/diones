// api/cnpj.js

export default async function handler(req, res) {
  // =========================================================
  // 1. VALIDAR MÉTODO
  // =========================================================

  if (req.method !== "GET") {
    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  // =========================================================
  // 2. VALIDAR CNPJ
  // =========================================================

  const cnpjRecebido = req.query?.cnpj;

  const digits = String(cnpjRecebido || "").replace(/\D/g, "");

  if (digits.length !== 14) {
    return res.status(400).json({
      sucesso: false,
      error: "CNPJ inválido. Informe os 14 dígitos.",
    });
  }

  // =========================================================
  // 3. CLASSIFICAR CNAE PARA O DIAGNÓSTICO
  // =========================================================

  function classificarEmpresa(cnae, descricao = "") {
    const codigo = String(cnae || "").replace(/\D/g, "");

    const desc = String(descricao || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    const divisao = Number.parseInt(codigo.slice(0, 2), 10);

    // ---------------------------------------------------------
    // CONTABILIDADE
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // ADVOCACIA
    // ---------------------------------------------------------

    if (
      codigo.startsWith("69117") ||
      desc.includes("advocacia") ||
      desc.includes("advocatic")
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

    // ---------------------------------------------------------
    // SAÚDE
    // ---------------------------------------------------------

    if (
      divisao === 86 ||
      desc.includes("medic") ||
      desc.includes("odontolog") ||
      desc.includes("clinic") ||
      desc.includes("psicolog") ||
      desc.includes("fisioterap") ||
      desc.includes("fonoaudiolog") ||
      desc.includes("nutricao")
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

    // ---------------------------------------------------------
    // TECNOLOGIA
    // ---------------------------------------------------------

    if (
      divisao === 62 ||
      divisao === 63 ||
      desc.includes("software") ||
      desc.includes("programacao") ||
      desc.includes("tecnologia da informacao") ||
      desc.includes("desenvolvimento de sistemas")
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

    // ---------------------------------------------------------
    // CONSTRUÇÃO
    // ---------------------------------------------------------

    if (
      Number.isFinite(divisao) &&
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

    // ---------------------------------------------------------
    // E-COMMERCE
    // ---------------------------------------------------------

    if (
      desc.includes("internet") ||
      desc.includes("e-commerce") ||
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

    // ---------------------------------------------------------
    // COMÉRCIO
    // ---------------------------------------------------------

    if (
      Number.isFinite(divisao) &&
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

    // ---------------------------------------------------------
    // INDÚSTRIA
    // ---------------------------------------------------------

    if (
      Number.isFinite(divisao) &&
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

    // ---------------------------------------------------------
    // TRANSPORTE / LOGÍSTICA
    // ---------------------------------------------------------

    if (
      Number.isFinite(divisao) &&
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

    // ---------------------------------------------------------
    // ALIMENTAÇÃO
    // ---------------------------------------------------------

    if (
      divisao === 56 ||
      desc.includes("restaurante") ||
      desc.includes("lanchonete") ||
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

    // ---------------------------------------------------------
    // IMOBILIÁRIO
    // ---------------------------------------------------------

    if (
      divisao === 68 ||
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

    // ---------------------------------------------------------
    // SERVIÇOS PROFISSIONAIS
    // ---------------------------------------------------------

    if (
      Number.isFinite(divisao) &&
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

    // ---------------------------------------------------------
    // PADRÃO
    // ---------------------------------------------------------

    return {
      segmento: "Serviços",
      categoria: "Serviços",
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
  // 4. FUNÇÃO PARA NORMALIZAR CNAES SECUNDÁRIOS
  // =========================================================

  function normalizarCnae(item, principal = false) {
    if (!item) {
      return null;
    }

    const codigo =
      item.codigo ??
      item.code ??
      item.cnae ??
      item.cnae_fiscal ??
      item.id ??
      "";

    const descricao =
      item.descricao ??
      item.description ??
      item.texto ??
      item.cnae_fiscal_descricao ??
      item.nome ??
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
  // 5. CONSULTAR BRASIL API
  // =========================================================

  try {
    console.log(
      "[CNPJ] Consultando:",
      digits
    );

    const url =
      `https://brasilapi.com.br/api/cnpj/v1/${digits}`;

    const response = await fetch(url, {
      method: "GET",

      headers: {
        Accept: "application/json",

        "User-Agent":
          "Finder-of-Solutions-Diagnostico/1.0",
      },
    });

    // =======================================================
    // 6. LER RESPOSTA COMO TEXTO PRIMEIRO
    // Evita erro de JSON inválido
    // =======================================================

    const textoResposta =
      await response.text();

    if (!response.ok) {
      console.error(
        "[CNPJ] Erro BrasilAPI:",
        response.status,
        textoResposta
      );

      if (response.status === 404) {
        return res.status(404).json({
          sucesso: false,
          error: "CNPJ não encontrado.",
          statusBrasilAPI: 404,
        });
      }

      if (response.status === 403) {
        return res.status(503).json({
          sucesso: false,

          error:
            "O serviço de consulta de CNPJ recusou temporariamente a consulta.",

          statusBrasilAPI: 403,
        });
      }

      return res.status(502).json({
        sucesso: false,

        error:
          "Não foi possível consultar os dados do CNPJ.",

        statusBrasilAPI:
          response.status,
      });
    }

    // =======================================================
    // 7. CONVERTER PARA JSON COM SEGURANÇA
    // =======================================================

    let data;

    try {
      data =
        JSON.parse(textoResposta);
    } catch (parseError) {
      console.error(
        "[CNPJ] BrasilAPI retornou conteúdo que não é JSON:",
        textoResposta
      );

      return res.status(502).json({
        sucesso: false,

        error:
          "O serviço de consulta retornou uma resposta inválida.",
      });
    }

    // =========================================================
    // 8. CNAE PRINCIPAL
    // =========================================================

    const cnaeCodigo =
      data.cnae_fiscal ??
      data.cnaeFiscal ??
      "";

    const cnaeDescricao =
      data.cnae_fiscal_descricao ??
      data.cnaeFiscalDescricao ??
      "";

    const cnaePrincipal = {
      codigo:
        String(cnaeCodigo || ""),

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
    // 9. PEGAR TODOS OS CNAES SECUNDÁRIOS
    // =========================================================

    let secundariosBrutos = [];

    if (
      Array.isArray(
        data.cnaes_secundarios
      )
    ) {
      secundariosBrutos =
        data.cnaes_secundarios;
    } else if (
      Array.isArray(
        data.cnaesSecundarios
      )
    ) {
      secundariosBrutos =
        data.cnaesSecundarios;
    } else if (
      Array.isArray(
        data.atividades_secundarias
      )
    ) {
      secundariosBrutos =
        data.atividades_secundarias;
    } else if (
      Array.isArray(
        data.atividadesSecundarias
      )
    ) {
      secundariosBrutos =
        data.atividadesSecundarias;
    } else if (
      Array.isArray(
        data.secondary_activities
      )
    ) {
      secundariosBrutos =
        data.secondary_activities;
    }

    console.log(
      "[CNPJ] CNAE principal:",
      cnaePrincipal
    );

    console.log(
      "[CNPJ] CNAEs secundários recebidos:",
      secundariosBrutos
    );

    // =========================================================
    // 10. NORMALIZAR CNAES SECUNDÁRIOS
    // =========================================================

    const cnaesSecundarios =
      secundariosBrutos
        .map((item) =>
          normalizarCnae(
            item,
            false
          )
        )
        .filter(Boolean);

    // =========================================================
    // 11. JUNTAR PRINCIPAL + SECUNDÁRIOS
    // =========================================================

    const todosAntesDuplicidade = [
      cnaePrincipal,
      ...cnaesSecundarios,
    ];

    // =========================================================
    // 12. REMOVER DUPLICIDADES
    // =========================================================

    const mapaCnaes =
      new Map();

    todosAntesDuplicidade.forEach(
      (item) => {
        if (!item) return;

        const codigoLimpo =
          String(
            item.codigo || ""
          ).replace(/\D/g, "");

        const descricaoLimpa =
          String(
            item.descricao || ""
          )
            .trim()
            .toLowerCase();

        const chave =
          codigoLimpo ||
          descricaoLimpa;

        if (!chave) {
          return;
        }

        if (
          !mapaCnaes.has(chave)
        ) {
          mapaCnaes.set(
            chave,
            item
          );
        }
      }
    );

    const todosCnaes =
      Array.from(
        mapaCnaes.values()
      );

    console.log(
      "[CNPJ] Todos CNAEs normalizados:",
      todosCnaes
    );

    // =========================================================
    // 13. EMPRESA
    // =========================================================

    const empresa = {
      cnpj: digits,

      razaoSocial:
        data.razao_social ??
        data.razaoSocial ??
        "",

      nomeFantasia:
        data.nome_fantasia ??
        data.nomeFantasia ??
        "",

      porte:
        data.porte ??
        "Não informado",

      naturezaJuridica:
        data.natureza_juridica ??
        data.naturezaJuridica ??
        "",

      situacao:
        data.descricao_situacao_cadastral ??
        data.situacao_cadastral ??
        data.situacao ??
        "",

      abertura:
        data.data_inicio_atividade ??
        data.data_abertura ??
        "",

      telefone:
        data.ddd_telefone_1 ??
        data.ddd_telefone_2 ??
        data.telefone ??
        "",

      email:
        data.email ??
        "",
    };

    // =========================================================
    // 14. ENDEREÇO
    // =========================================================

    const endereco = {
      logradouro:
        data.logradouro ??
        "",

      numero:
        data.numero ??
        "",

      complemento:
        data.complemento ??
        "",

      bairro:
        data.bairro ??
        "",

      municipio:
        data.municipio ??
        "",

      uf:
        data.uf ??
        "",

      cep:
        data.cep ??
        "",
    };

    // =========================================================
    // 15. RETORNO FINAL
    // =========================================================

    return res.status(200).json({
      sucesso: true,

      empresa,

      // -------------------------------------------------------
      // FORMATO ANTIGO
      // Mantido para não quebrar o App.jsx existente
      // -------------------------------------------------------

      cnae: {
        codigo:
          cnaePrincipal.codigo,

        descricao:
          cnaePrincipal.descricao,

        principal:
          cnaePrincipal,

        secundarios:
          cnaesSecundarios,

        todos:
          todosCnaes,
      },

      // -------------------------------------------------------
      // NOVO FORMATO
      // -------------------------------------------------------

      cnaePrincipal,

      cnaesSecundarios,

      todosCnaes,

      totalCnaes:
        todosCnaes.length,

      totalCnaesSecundarios:
        cnaesSecundarios.length,

      classificacao:
        cnaePrincipal.classificacao,

      endereco,
    });

  } catch (error) {
    // =========================================================
    // 16. QUALQUER ERRO DA FUNCTION CONTINUA RETORNANDO JSON
    // =========================================================

    console.error(
      "[CNPJ] Erro interno:",
      error
    );

    return res.status(500).json({
      sucesso: false,

      error:
        "Erro interno ao consultar o CNPJ.",

      detalhe:
        process.env.NODE_ENV ===
        "development"
          ? String(
              error?.message ||
              error
            )
          : undefined,
    });
  }
}
