export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY não configurada no projeto" });
  }

  const { segmento, empresas, faturamento, colaboradores, regime, observacao, areas } = req.body || {};
  if (!areas || !areas.length) return res.status(400).json({ error: "Nenhuma área enviada" });

  const systemPrompt = `Você é um consultor multidisciplinar sênior, especialista simultaneamente nos segmentos de Serviço, Comércio e Indústria, e nas áreas de marketing, jurídico, contábil/fiscal, financeiro, administrativo, gestão, operacional, recursos humanos, comercial e tecnologia.

Você recebe o perfil de uma empresa e as respostas de um checklist de diagnóstico. Cada pergunta foi respondida com "sim" (boa maturidade), "parcialmente" (maturidade média) ou "nao" (baixa maturidade).

Para cada área recebida, gere:
- até 4 riscos objetivos, cada um em uma frase curta (máximo 14 palavras), baseados nas respostas mais fracas dessa área
- até 3 recomendações práticas e priorizadas para essa área, cada uma em uma frase curta e acionável

Responda ESTRITAMENTE com um JSON válido, sem nenhum texto fora dele, neste formato exato:
{"areas":[{"area":"nome exato da área recebida","riscos":["..."],"recomendacoes":["..."]}]}`;

  const userPayload = { segmento, empresas, faturamento, colaboradores, regime, observacao, areas };

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: JSON.stringify(userPayload) }],
      }),
    });

    const data = await r.json();
    const text = data?.content?.find((b) => b.type === "text")?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      return res.status(502).json({ error: "IA retornou um formato inesperado" });
    }

    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: "Erro ao chamar a IA" });
  }
}
