// src/relatorios/planoCliente.js
// Plano inicial 30/60/90 dias exibido ao CLIENTE (tela e PDF).
//
// Funções puras: recebem o plano (dias30/dias60/dias90) e as funções de
// limpeza/escape do chamador, para reaproveitar exatamente o mesmo
// tratamento de texto que o restante do relatório já usa.

export const PERIODOS_PLANO = [
  { chave: "dias30", titulo: "Primeiros 30 dias", curto: "30 DIAS", cor: "#2FB37C" },
  { chave: "dias60", titulo: "Até 60 dias", curto: "60 DIAS", cor: "#4F7CFF" },
  { chave: "dias90", titulo: "Até 90 dias", curto: "90 DIAS", cor: "#8B6BFF" },
];

export const AVISO_PLANO =
  "Plano orientativo; documentos, responsáveis e prioridades ainda precisam ser validados.";

const normalizarPadrao = (lista) =>
  (Array.isArray(lista) ? lista : [lista])
    .map((x) => (x === null || x === undefined ? "" : String(x).trim()))
    .filter(Boolean);

// Devolve só os períodos que têm ação, com no máximo `max` itens cada.
export function periodosDoPlano(plano, normalizar = normalizarPadrao, max = 3) {
  const p = plano && typeof plano === "object" && !Array.isArray(plano) ? plano : {};
  return PERIODOS_PLANO.map((periodo) => ({
    ...periodo,
    itens: (normalizar(p[periodo.chave]) || []).slice(0, max),
  })).filter((periodo) => periodo.itens.length > 0);
}

export function temPlanoCliente(plano, normalizar = normalizarPadrao) {
  return periodosDoPlano(plano, normalizar).length > 0;
}

// HTML do PDF. `escapar` é a função de escape do chamador.
export function planoClienteHtml(plano, { normalizar = normalizarPadrao, escapar }) {
  const periodos = periodosDoPlano(plano, normalizar);
  if (!periodos.length) return "";

  const esc = typeof escapar === "function" ? escapar : (v) => String(v ?? "");

  const colunas = periodos
    .map(
      (p) => `
      <div style="flex:1;min-width:0;border:1px solid #E3E7EF;border-top:4px solid ${p.cor};border-radius:10px;padding:10px 12px;background:#F7F8FB;page-break-inside:avoid;">
        <strong style="font-size:10px;letter-spacing:.4px;color:#17233D;">${esc(p.titulo).toUpperCase()}</strong>
        <ul style="padding-left:16px;margin:7px 0 0;">
          ${p.itens.map((item) => `<li style="margin-bottom:5px;">${esc(item)}</li>`).join("")}
        </ul>
      </div>`
    )
    .join("");

  return `
  <h2>Plano inicial de 30, 60 e 90 dias</h2>
  <div style="display:flex;gap:10px;margin:6px 0 6px;align-items:stretch;">${colunas}
  </div>
  <p style="font-size:10px;color:#5B667A;font-style:italic;margin:4px 0 14px;">${esc(AVISO_PLANO)}</p>`;
}
