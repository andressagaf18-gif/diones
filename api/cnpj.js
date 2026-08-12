export default async function handler(req, res) {
  const { cnpj } = req.query;
  const digits = (cnpj || "").replace(/\D/g, "");
  if (!digits) return res.status(400).json({ error: "CNPJ inválido" });

  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    if (!r.ok) return res.status(404).json({ error: "CNPJ não encontrado" });
    const data = await r.json();

    // Segmento inferido pela divisão do CNAE (dois primeiros dígitos).
    // 10-33 = Indústria · 45-47 = Comércio · demais = Serviço (simplificação).
    const divisao = parseInt(String(data.cnae_fiscal).slice(0, 2), 10);
    let segmento = "Serviço";
    if (divisao >= 10 && divisao <= 33) segmento = "Indústria";
    else if (divisao >= 45 && divisao <= 47) segmento = "Comércio";

    res.status(200).json({
      razao: data.razao_social,
      cnae: `${data.cnae_fiscal} — ${data.cnae_fiscal_descricao}`,
      porte: data.porte || "Não informado",
      segmento,
      cnpjDigits: digits,
    });
  } catch (e) {
    res.status(500).json({ error: "Erro ao consultar CNPJ" });
  }
}
