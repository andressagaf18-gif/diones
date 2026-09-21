import { usuarioAutenticado } from "../server/auth.js";

function autorizado(req) {
  return Boolean(usuarioAutenticado(req));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ sucesso: false, error: "Método não permitido." });
  }

  if (!autorizado(req)) {
    return res.status(401).json({ sucesso: false, error: "Não autorizado." });
  }

  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_NAME;

  if (!token || !projectId) {
    return res.status(200).json({
      sucesso: true,
      configurado: false,
      deploys: [],
      aviso: "Deploys não configurados. Defina VERCEL_API_TOKEN e VERCEL_PROJECT_ID (ou VERCEL_PROJECT_NAME) nas variáveis de ambiente do projeto na Vercel.",
    });
  }

  try {
    const params = new URLSearchParams({
      projectId,
      limit: "20",
    });
    if (process.env.VERCEL_TEAM_ID) {
      params.set("teamId", process.env.VERCEL_TEAM_ID);
    }

    const r = await fetch(`https://api.vercel.com/v6/deployments?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await r.json().catch(() => null);

    if (!r.ok) {
      return res.status(502).json({
        sucesso: false,
        error: data?.error?.message || "Não foi possível consultar a Vercel.",
      });
    }

    const deploys = (data?.deployments || []).map((d) => ({
      id: d.uid,
      url: d.url,
      estado: d.state,
      criadoEm: d.createdAt ? new Date(d.createdAt).toISOString() : null,
      autor: d.creator?.username || d.creator?.email || "-",
      mensagemCommit: d.meta?.githubCommitMessage || d.meta?.gitCommitMessage || "",
      branch: d.meta?.githubCommitRef || d.meta?.gitCommitRef || "",
      producao: d.target === "production",
    }));

    return res.status(200).json({ sucesso: true, configurado: true, deploys });
  } catch (error) {
    console.error("[deploys]", error);
    return res.status(500).json({ sucesso: false, error: "Erro ao consultar deploys." });
  }
}
