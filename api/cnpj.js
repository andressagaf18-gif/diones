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
      error: "CNPJ inválido. Informe 14 dígitos.",
    });
  }

  try {
    const response = await fetch(
      `https://brasilapi.com.br/api/cnpj/v1/${digits}`
    );

   if (!response.ok) {
  const detalhe = await response.text();

  console.error("Erro BrasilAPI:", {
    status: response.status,
    statusText: response.statusText,
    detalhe
  });

  return res.status(502).json({
    sucesso: false,
    error: "Erro retornado pela BrasilAPI.",
    statusBrasilAPI: response.status,
    detalhe: detalhe || response.statusText
  });
}

    const data = await response.json();

    const codigoCnae = String(data.cnae_fiscal || "").replace(/\D/g, "");
    const descricaoCnae = String(
      data.cnae_fiscal_descricao || ""
    ).toLowerCase();

    const classificacao = classificarEmpresa(
      codigoCnae,
      descricaoCnae
    );

    return res.status(200).json({
      sucesso: true,

      empresa: {
        cnpj: digits,
        razaoSocial: data.razao_social || "",
        nomeFantasia: data.nome_fantasia || "",
        porte: data.porte || "Não informado",
        naturezaJuridica: data.natureza_juridica || "",
        situacao: data.descricao_situacao_cadastral || "",
        abertura: data.data_inicio_atividade || "",

        telefone:
          data.ddd_telefone_1 ||
          data.ddd_telefone_2 ||
          "",

        email: data.email || "",
      },

      cnae: {
        codigo: data.cnae_fiscal || "",
        descricao: data.cnae_fiscal_descricao || "",
      },

      classificacao,

      endereco: {
        logradouro: data.logradouro || "",
        numero: data.numero || "",
        complemento: data.complemento || "",
        bairro: data.bairro || "",
        municipio: data.municipio || "",
        uf: data.uf || "",
        cep: data.cep || "",
      },
    });
  } catch (error) {
    console.error("Erro CNPJ:", error);

    return res.status(500).json({
      sucesso: false,
      error: "Erro interno ao consultar o CNPJ.",
    });
  }
}

/**
 * Classifica a empresa com base no CNAE principal.
 */
function classificarEmpresa(cnae, descricao) {
  const divisao = Number(cnae.substring(0, 2));
  const grupo = cnae.substring(0, 4);

  let segmento = "Serviços";
  let categoria = "Prestação de Serviços";

  /*
   * CATEGORIAS ESPECÍFICAS
   * Essas regras vêm antes das regras gerais.
   */

  // Advocacia
  if (
    cnae.startsWith("6911") ||
    descricao.includes("advocacia") ||
    descricao.includes("serviços advocatícios")
  ) {
    categoria = "Advocacia";
    segmento = "Serviços Profissionais";
  }

  // Contabilidade
  else if (
    cnae.startsWith("6920") ||
    descricao.includes("contabilidade") ||
    descricao.includes("contábil")
  ) {
    categoria = "Contabilidade";
    segmento = "Serviços Profissionais";
  }

  // Oficina / manutenção automotiva
  else if (
    cnae.startsWith("4520") ||
    descricao.includes("manutenção e reparação de veículos") ||
    descricao.includes("oficina mecânica")
  ) {
    categoria = "Oficina Mecânica";
    segmento = "Serviços Automotivos";
  }

  // E-commerce
  else if (
    cnae.startsWith("4791") ||
    descricao.includes("internet") ||
    descricao.includes("comércio eletrônico") ||
    descricao.includes("correspondência")
  ) {
    categoria = "E-commerce";
    segmento = "Comércio";
  }

  // Clínica / Saúde
  else if (
    divisao === 86 ||
    descricao.includes("clínica") ||
    descricao.includes("médica") ||
    descricao.includes("odontológica") ||
    descricao.includes("fisioterapia") ||
    descricao.includes("psicologia")
  ) {
    categoria = "Saúde / Clínica";
    segmento = "Saúde";
  }

  // Construção civil
  else if (divisao >= 41 && divisao <= 43) {
    categoria = "Construção Civil";
    segmento = "Construção";
  }

  // Tecnologia
  else if (
    divisao === 62 ||
    divisao === 63 ||
    descricao.includes("software") ||
    descricao.includes("tecnologia da informação") ||
    descricao.includes("desenvolvimento de programas")
  ) {
    categoria = "Tecnologia";
    segmento = "Tecnologia";
  }

  // Imobiliário
  else if (divisao === 68) {
    categoria = "Imobiliária / Atividades Imobiliárias";
    segmento = "Imobiliário";
  }

  // Hotelaria
  else if (divisao === 55) {
    categoria = "Hotelaria / Hospedagem";
    segmento = "Hotelaria";
  }

  // Alimentação
  else if (divisao === 56) {
    categoria = "Alimentação";
    segmento = "Alimentação";
  }

  // Educação
  else if (divisao === 85) {
    categoria = "Educação";
    segmento = "Educação";
  }

  // Transporte
  else if (divisao >= 49 && divisao <= 53) {
    categoria = "Transporte / Logística";
    segmento = "Transportes";
  }

  // Agronegócio
  else if (divisao >= 1 && divisao <= 3) {
    categoria = "Agronegócio";
    segmento = "Agronegócio";
  }

  // Indústria
  else if (divisao >= 10 && divisao <= 33) {
    categoria = "Indústria";
    segmento = "Indústria";
  }

  // Comércio
  else if (divisao >= 45 && divisao <= 47) {
    categoria = "Comércio";
    segmento = "Comércio";
  }

  /*
   * Define quais módulos do diagnóstico
   * devem aparecer primeiro.
   */

  const areas = gerarAreasDiagnostico(categoria);

  return {
    segmento,
    categoria,
    codigoQuestionario: gerarCodigoQuestionario(categoria),

    diagnostico: {
      areasPrioritarias: areas.prioritarias,
      areasComplementares: areas.complementares,
    },
  };
}

function gerarCodigoQuestionario(categoria) {
  const codigos = {
    "Advocacia": "advocacia",
    "Contabilidade": "contabilidade",
    "Oficina Mecânica": "oficina",
    "E-commerce": "ecommerce",
    "Saúde / Clínica": "saude",
    "Construção Civil": "construcao",
    "Tecnologia": "tecnologia",
    "Imobiliária / Atividades Imobiliárias": "imobiliario",
    "Hotelaria / Hospedagem": "hotelaria",
    "Alimentação": "alimentacao",
    "Educação": "educacao",
    "Transporte / Logística": "transporte",
    "Agronegócio": "agronegocio",
    "Indústria": "industria",
    "Comércio": "comercio",
    "Prestação de Serviços": "servicos",
  };

  return codigos[categoria] || "servicos";
}

function gerarAreasDiagnostico(categoria) {
  const base = {
    "Advocacia": {
      prioritarias: [
        "Financeiro",
        "Comercial",
        "Marketing",
        "Gestão",
        "Processos",
      ],
      complementares: [
        "Tributário",
        "Tecnologia",
        "Pessoas",
        "LGPD",
      ],
    },

    "Contabilidade": {
      prioritarias: [
        "Processos",
        "Comercial",
        "Financeiro",
        "Tecnologia",
        "Pessoas",
      ],
      complementares: [
        "Marketing",
        "Gestão",
        "Atendimento",
      ],
    },

    "Oficina Mecânica": {
      prioritarias: [
        "Financeiro",
        "Estoque",
        "Compras",
        "Precificação",
        "Atendimento",
      ],
      complementares: [
        "Marketing",
        "Tributário",
        "Pessoas",
        "Processos",
      ],
    },

    "E-commerce": {
      prioritarias: [
        "Marketing",
        "Comercial",
        "Financeiro",
        "Estoque",
        "Logística",
      ],
      complementares: [
        "Fiscal",
        "Tributário",
        "Tecnologia",
        "Atendimento",
      ],
    },

    "Saúde / Clínica": {
      prioritarias: [
        "Financeiro",
        "Agenda",
        "Atendimento",
        "Marketing",
        "Processos",
      ],
      complementares: [
        "Tributário",
        "Pessoas",
        "LGPD",
        "Tecnologia",
      ],
    },

    "Construção Civil": {
      prioritarias: [
        "Financeiro",
        "Custos",
        "Obras",
        "Compras",
        "Processos",
      ],
      complementares: [
        "Tributário",
        "Pessoas",
        "Contratos",
        "Comercial",
      ],
    },

    "Tecnologia": {
      prioritarias: [
        "Comercial",
        "Financeiro",
        "Produto",
        "Marketing",
        "Tecnologia",
      ],
      complementares: [
        "Pessoas",
        "Processos",
        "Segurança da Informação",
        "Tributário",
      ],
    },

    "Imobiliária / Atividades Imobiliárias": {
      prioritarias: [
        "Comercial",
        "Financeiro",
        "Marketing",
        "Atendimento",
        "Contratos",
      ],
      complementares: [
        "Tributário",
        "Processos",
        "Tecnologia",
      ],
    },

    "Hotelaria / Hospedagem": {
      prioritarias: [
        "Financeiro",
        "Atendimento",
        "Marketing",
        "Operacional",
        "Pessoas",
      ],
      complementares: [
        "Compras",
        "Tributário",
        "Tecnologia",
        "Comercial",
      ],
    },

    "Alimentação": {
      prioritarias: [
        "Financeiro",
        "Custos",
        "Estoque",
        "Compras",
        "Atendimento",
      ],
      complementares: [
        "Marketing",
        "Pessoas",
        "Tributário",
        "Processos",
      ],
    },

    "Educação": {
      prioritarias: [
        "Financeiro",
        "Comercial",
        "Marketing",
        "Atendimento",
        "Pessoas",
      ],
      complementares: [
        "Tecnologia",
        "Processos",
        "Tributário",
      ],
    },

    "Transporte / Logística": {
      prioritarias: [
        "Financeiro",
        "Custos",
        "Operacional",
        "Frota",
        "Pessoas",
      ],
      complementares: [
        "Tributário",
        "Comercial",
        "Tecnologia",
        "Processos",
      ],
    },

    "Agronegócio": {
      prioritarias: [
        "Financeiro",
        "Custos",
        "Produção",
        "Compras",
        "Gestão",
      ],
      complementares: [
        "Tributário",
        "Pessoas",
        "Comercial",
        "Tecnologia",
      ],
    },

    "Indústria": {
      prioritarias: [
        "Financeiro",
        "Custos",
        "Produção",
        "Estoque",
        "Compras",
      ],
      complementares: [
        "Tributário",
        "Qualidade",
        "Pessoas",
        "Comercial",
        "Tecnologia",
      ],
    },

    "Comércio": {
      prioritarias: [
        "Financeiro",
        "Estoque",
        "Compras",
        "Comercial",
        "Marketing",
      ],
      complementares: [
        "Tributário",
        "Atendimento",
        "Pessoas",
        "Tecnologia",
      ],
    },

    "Prestação de Serviços": {
      prioritarias: [
        "Financeiro",
        "Comercial",
        "Marketing",
        "Processos",
        "Atendimento",
      ],
      complementares: [
        "Tributário",
        "Pessoas",
        "Tecnologia",
        "Gestão",
      ],
    },
  };

  return (
    base[categoria] || {
      prioritarias: [
        "Financeiro",
        "Comercial",
        "Marketing",
        "Gestão",
        "Processos",
      ],
      complementares: [
        "Tributário",
        "Pessoas",
        "Tecnologia",
      ],
    }
  );
}
