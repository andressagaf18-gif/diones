// Painel mensal: para cada documento recorrente da pasta, diz se o colaborador colocou no prazo, com atraso ou não colocou.
// Prazo: dia `prazoDia` do mês seguinte à competência. A data de entrada é a de modificação do arquivo no Drive.
const pad = (n) => String(n).padStart(2, "0");
const proxMes = (k) => { const [y, m] = k.split("-").map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`; };
export const mesAnterior = (hoje) => { const y = hoje.getUTCFullYear(), m = hoje.getUTCMonth() + 1; return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`; };
export const prazoDoMes = (competencia, prazoDia) => { const k = proxMes(competencia); const [y, m] = k.split("-").map(Number); const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate(); return `${k}-${pad(Math.min(prazoDia, ultimo))}`; };
const dias = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);

export const STATUS_PAINEL = {
  no_prazo: ["Postado no prazo", "#1B5E20", "#E3F4E6"],
  atrasado: ["Postado com atraso", "#8A5A00", "#FFE9B8"],
  faltando: ["Não postado (prazo vencido)", "#B71C1C", "#FDE3E3"],
  a_vencer: ["Ainda no prazo", "#5B667A", "#EEF1F6"],
  postado: ["Postado (sem data)", "#1B5E20", "#E3F4E6"],
  nao_se_aplica: ["", "#B8BFCC", "#F6F7FA"],
};

export function montarPainel(a, { prazoDia = 15, hoje = new Date() } = {}) {
  const linhas = a?.cobertura?.linhas || [];
  const hojeIso = hoje.toISOString().slice(0, 10);
  const ultimaCompetencia = mesAnterior(hoje);
  const meses = [...new Set([...(a?.cobertura?.meses || []), ...linhas.flatMap((l) => Object.keys(l.presentes || {}))])].sort();
  const itens = [];
  for (const l of linhas) {
    const pasta = String(l.grupo || "").split(" / ").filter(Boolean).slice(-2).join(" / ") || "Raiz";
    const celulas = {};
    for (const m of meses) {
      const prazo = prazoDoMes(m, prazoDia);
      const post = l.postados?.[m];
      const tem = !!post || !!l.presentes?.[m];
      let status;
      if (tem) {
        if (post?.primeiro) status = post.primeiro > prazo ? "atrasado" : "no_prazo";
        else status = "postado";
      } else if (m < l.ini || m > ultimaCompetencia) status = "nao_se_aplica";
      else status = hojeIso > prazo ? "faltando" : "a_vencer";
      celulas[m] = { status, prazo, postadoEm: post?.primeiro || "", ultimoEm: post?.ultimo || "", arquivo: post?.nome || "", qtd: post?.n || l.presentes?.[m] || 0, diasAtraso: status === "atrasado" ? dias(post.primeiro, prazo) : 0 };
    }
    itens.push({ pasta, grupo: l.grupo, tipo: l.tipo, celulas });
  }
  itens.sort((x, y) => x.pasta.localeCompare(y.pasta) || x.tipo.localeCompare(y.tipo));
  const totais = (m) => { const t = { no_prazo: 0, atrasado: 0, faltando: 0, a_vencer: 0, postado: 0 }; for (const i of itens) { const s = i.celulas[m]?.status; if (s in t) t[s] += 1; } return t; };
  return { meses, itens, ultimaCompetencia, prazoDia, totais };
}
