// api/sugerir-cnae.js
// Finder — sugestão de CNAE por IA para quem ainda vai abrir uma empresa.
// Pesquisa em fontes oficiais (CONCLA/IBGE) em vez de responder só da
// memória, para reduzir o risco de "inventar" um código que não existe.

const FONTES_OFICIAIS_CNAE = [
  "concla.ibge.gov.br",
  "ibge.gov.br",
  "gov.br",
  "receita.fazenda.gov.br",
];

function texto(v, n = 2000) {
  return String(v ?? "").trim().slice(0, n);
}

function limparJson(bruto) {
  return String(bruto || "")
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/,"")
    .replace(/```$/,"")
    .trim();
}

function extrairOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }
  if (!Array.isArray(data?.output)) return "";
  for (const item of data.output) {
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;
    for (const c of item.content) {
      if (typeof c?.text === "string" && c.text.trim()) return c.text.trim();
    }
  }
  return "";
}

function normalizarCodigo(v) {
  const digitos = String(v || "").replace(/\D/g, "");
  return digitos.length === 7 ? digitos : "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ sucesso: false, error: "Método não permitido." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ sucesso: false, error: "OPENAI_API_KEY não configurada." });
  }

  const body = req.body || {};
  const descricaoNegocio = texto(body.descricaoNegocio, 1000);
  const categoriaSugerida = texto(body.categoriaSugerida, 30).toUpperCase(); // INDUSTRIA | COMERCIO | SERVICO | opcional

  if (descricaoNegocio.length < 15) {
    return res.status(400).json({
      sucesso: false,
      error: "Descreva com um pouco mais de detalhe o que pretende abrir (mínimo 15 caracteres).",
    });
  }

  const prompt = `Você é um especialista em classificação CNAE (Classificação Nacional de Atividades Econômicas) do Brasil. Alguém pretende abrir uma empresa e descreveu o negócio da seguinte forma:

"${descricaoNegocio}"

${categoriaSugerida ? `A pessoa indicou que a atividade é do tipo: ${categoriaSugerida}.` : ""}

Pesquise a tabela oficial de CNAE (CONCLA/IBGE) e identifique entre 2 e 5 códigos de CNAE (subclasse, 7 dígitos) genuinamente pertinentes a essa descrição. NUNCA invente um código — se não conseguir confirmar um código real e oficial que corresponda bem à descrição, devolva menos sugestões (inclusive nenhuma) em vez de arriscar um código incorreto.

Para cada sugestão, informe:
- codigo: os 7 dígitos do CNAE subclasse, sem pontuação
- descricaoOficial: a descrição oficial exata da subclasse na tabela CONCLA
- categoria: "INDUSTRIA", "COMERCIO" ou "SERVICO" (a natureza predominante dessa subclasse)
- justificativa: uma frase curta explicando por que essa subclasse se encaixa na descrição dada
- ehPrincipalSugerido: true para no máximo 1 sugestão (a que melhor representa a descrição), false para as demais

Também identifique, com base no seu conhecimento geral sobre atividades regulamentadas no Brasil (sem necessidade de citar fonte para isso), se a atividade tipicamente exige alguma licença, alvará ou registro específico (ex.: vigilância sanitária, registro em conselho de classe, licença ambiental, corpo de bombeiros, alvará da prefeitura, ANVISA, ANATEL etc.) e liste em "possiveisLicencas" (array de strings curtas). Se não souber ao certo, deixe o array vazio em vez de arriscar.

Responda SOMENTE com um objeto JSON válido, sem Markdown, comentários ou texto antes/depois, no formato:
{
  "sugestoes": [{ "codigo": "...", "descricaoOficial": "...", "categoria": "...", "justificativa": "...", "ehPrincipalSugerido": true }],
  "possiveisLicencas": ["..."],
  "alertas": ["..."]
}`;

  try {
    const modelo = process.env.OPENAI_RESEARCH_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini";
    const resposta = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelo,
        input: prompt,
        tools: [{ type: "web_search", filters: { allowed_domains: FONTES_OFICIAIS_CNAE } }],
        tool_choice: "auto",
      }),
    });

    const data = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      return res.status(502).json({ sucesso: false, error: data?.error?.message || "Falha ao consultar a IA." });
    }

    let bruto;
    try {
      bruto = JSON.parse(limparJson(extrairOutputText(data)));
    } catch {
      return res.status(502).json({ sucesso: false, error: "A IA não retornou uma resposta em formato válido. Tente descrever de outra forma." });
    }

    const sugestoes = (Array.isArray(bruto?.sugestoes) ? bruto.sugestoes : [])
      .map((s) => ({
        codigo: normalizarCodigo(s?.codigo),
        descricaoOficial: texto(s?.descricaoOficial, 300),
        categoria: ["INDUSTRIA", "COMERCIO", "SERVICO"].includes(String(s?.categoria || "").toUpperCase())
          ? String(s.categoria).toUpperCase()
          : "",
        justificativa: texto(s?.justificativa, 300),
        ehPrincipalSugerido: Boolean(s?.ehPrincipalSugerido),
      }))
      // Descarta qualquer sugestão sem um código de 7 dígitos válido — nunca
      // repassa ao front algo que não seja um CNAE genuinamente identificável.
      .filter((s) => s.codigo && s.descricaoOficial);

    if (!sugestoes.length) {
      return res.status(200).json({
        sucesso: true,
        sugestoes: [],
        possiveisLicencas: [],
        alertas: ["Não foi possível identificar um CNAE oficial com confiança para essa descrição. Tente detalhar melhor a atividade (produto, serviço prestado ou tipo de comércio)."],
      });
    }

    return res.status(200).json({
      sucesso: true,
      sugestoes,
      possiveisLicencas: (Array.isArray(bruto?.possiveisLicencas) ? bruto.possiveisLicencas : [])
        .map((l) => texto(l, 150))
        .filter(Boolean)
        .slice(0, 10),
      alertas: (Array.isArray(bruto?.alertas) ? bruto.alertas : [])
        .map((a) => texto(a, 300))
        .filter(Boolean),
    });
  } catch (error) {
    console.error("[sugerir-cnae]", error);
    return res.status(500).json({ sucesso: false, error: "Não foi possível processar a sugestão de CNAE agora." });
  }
}
