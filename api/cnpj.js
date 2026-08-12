export default async function handler(req, res) {
  // Permite apenas GET
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Método não permitido."
    });
  }

  const { cnpj } = req.query;

  const digits = String(cnpj || "").replace(/\D/g, "");

  if (digits.length !== 14) {
    return res.status(400).json({
      error: "CNPJ inválido."
    });
  }

  try {
    const response = await fetch(
      `https://brasilapi.com.br/api/cnpj/v1/${digits}`
    );

    if (!response.ok) {
      return res.status(404).json({
        error: "CNPJ não encontrado."
      });
    }

    const data = await response.json();

    // Descobre o segmento pelo CNAE
    const cnae = String(data.cnae_fiscal || "");
    const divisao = parseInt(cnae.substring(0, 2), 10);

    let segmento = "Serviço";

    if (!isNaN(divisao)) {
      if (divisao >= 10 && divisao <= 33) {
        segmento = "Indústria";
      } else if (divisao >= 45 && divisao <= 47) {
        segmento = "Comércio";
      }
    }

    return res.status(200).json({
      sucesso: true,

      cnpj: digits,

      razaoSocial: data.razao_social,

      nomeFantasia: data.nome_fantasia || "",

      porte: data.porte || "Não informado",

      naturezaJuridica: data.natureza_juridica || "",

      situacao: data.descricao_situacao_cadastral || "",

      abertura: data.data_inicio_atividade || "",

      telefone: data.ddd_telefone_1 || "",

      email: data.email || "",

      segmento,

      cnae: {
        codigo: data.cnae_fiscal,
        descricao: data.cnae_fiscal_descricao
      },

      endereco: {
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        municipio: data.municipio,
        uf: data.uf,
        cep: data.cep
      }
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Erro ao consultar BrasilAPI."
    });
  }
}
