// api/enviar-relatorio.js

const EMAIL_FINDER = "contato@finderofsolutions.com.br";
const FROM_EMAIL =
  process.env.RELATORIO_FROM_EMAIL ||
  "Diagnóstico Finder <diagnostico@finderofsolutions.com.br>";

function escaparHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function listaHtml(itens = []) {
  if (!Array.isArray(itens) || !itens.length) {
    return "<li>Não informado.</li>";
  }
  return itens.map((item) => `<li>${escaparHtml(item)}</li>`).join("");
}

function respostasHtml(areas = []) {
  return areas.map((area) => {
    const subtemas = (area.subtemas || []).map((sub) => {
      const perguntas = (sub.perguntas || []).map((p) => `
        <tr>
          <td style="padding:7px;border-bottom:1px solid #e5e7eb;">${escaparHtml(p.pergunta)}</td>
          <td style="padding:7px;border-bottom:1px solid #e5e7eb;font-weight:700;">${escaparHtml(p.resposta)}</td>
        </tr>
      `).join("");

      return `
        <h4 style="margin:14px 0 6px;">${escaparHtml(sub.tema)}</h4>
        <table style="width:100%;border-collapse:collapse;">${perguntas}</table>
      `;
    }).join("");

    return `
      <section style="margin:20px 0;">
        <h3 style="margin:0 0 4px;color:#17233D;">${escaparHtml(area.area)} — ${escaparHtml(area.score)}/100</h3>
        ${subtemas}
      </section>
    `;
  }).join("");
}

async function enviarEmail({ to, subject, html, replyTo }) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  const data = await r.json().catch(() => null);

  if (!r.ok) {
    throw new Error(
      data?.message ||
      data?.error?.message ||
      `Falha no envio de e-mail (${r.status})`
    );
  }

  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ sucesso: false, error: "Método não permitido." });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ sucesso: false, error: "RESEND_API_KEY não configurada." });
  }

  const { responsavel = {}, empresa = {}, perfil = {}, resultado = {} } = req.body || {};

  if (!empresa.razao) {
    return res.status(400).json({ sucesso: false, error: "Dados insuficientes para enviar o relatório." });
  }

  const diagnostico = resultado.diagnosticoGeral || {};
  const areas = resultado.areas || [];
  const respostas = resultado.respostas || [];

  const areasHtml = areas.map((a) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escaparHtml(a.area)}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:700;">${escaparHtml(a.score)}/100</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escaparHtml(a.nivel || "")}</td>
    </tr>
  `).join("");

  const htmlFinder = `
    <div style="font-family:Arial,sans-serif;color:#17233D;max-width:760px;margin:auto;">
      <div style="background:#17233D;color:white;padding:22px;border-radius:10px;">
        <h1 style="margin:0 0 6px;font-size:22px;">Novo Diagnóstico Empresarial</h1>
        <div>${escaparHtml(empresa.razao)}</div>
      </div>

      <h2>Lead</h2>
      <p>
        <strong>Responsável:</strong> ${escaparHtml(responsavel.nome)}<br>
        <strong>Cargo:</strong> ${escaparHtml(responsavel.cargo)}<br>
        <strong>WhatsApp:</strong> ${escaparHtml(responsavel.telefone)}<br>
        <strong>E-mail:</strong> ${escaparHtml(responsavel.email)}<br>
        <strong>Consentimento para e-mail:</strong> ${responsavel.consentimentoEmail ? "Sim" : "Não"}
      </p>

      <h2>Empresa</h2>
      <p>
        <strong>CNPJ:</strong> ${escaparHtml(empresa.cnpj)}<br>
        <strong>CNAE:</strong> ${escaparHtml(empresa.cnae)}<br>
        <strong>Categoria:</strong> ${escaparHtml(empresa.categoria)}<br>
        <strong>Segmento:</strong> ${escaparHtml(empresa.segmento)}<br>
        <strong>Porte:</strong> ${escaparHtml(empresa.porte)}
      </p>

      <h2>Perfil</h2>
      <p>
        <strong>Faturamento:</strong> ${escaparHtml(perfil.faturamento)}<br>
        <strong>Colaboradores:</strong> ${escaparHtml(perfil.colaboradores)}<br>
        <strong>Regime:</strong> ${escaparHtml(perfil.regime)}<br>
        <strong>Áreas:</strong> ${escaparHtml((perfil.areasSelecionadas || []).join(", "))}
      </p>

      <h2>Resultado</h2>
      <p>
        <strong>Score geral:</strong> ${escaparHtml(resultado.scoreGeral)}/100<br>
        <strong>Nível:</strong> ${escaparHtml(resultado.nivelGeral)}
      </p>

      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#E9EDF5;">
            <th style="padding:8px;text-align:left;">Área</th>
            <th style="padding:8px;text-align:left;">Score</th>
            <th style="padding:8px;text-align:left;">Nível</th>
          </tr>
        </thead>
        <tbody>${areasHtml}</tbody>
      </table>

      <h2>Resumo executivo</h2>
      <p>${escaparHtml(diagnostico.resumoExecutivo || "Não disponível.")}</p>

      <h3>Principais dores</h3>
      <ul>${listaHtml(diagnostico.principaisDores)}</ul>

      <h3>Pontos fortes</h3>
      <ul>${listaHtml(diagnostico.pontosFortes)}</ul>

      <h3>Prioridades imediatas</h3>
      <ol>${listaHtml(diagnostico.prioridadesImediatas)}</ol>

      <h3>Oportunidades</h3>
      <ul>${listaHtml(diagnostico.oportunidades)}</ul>

      <h2>Observação do participante</h2>
      <p>${escaparHtml(perfil.observacao || "Nenhuma.")}</p>

      <h2>Formulário completo</h2>
      ${respostasHtml(respostas)}
    </div>
  `;

  const htmlLead = `
    <div style="font-family:Arial,sans-serif;color:#17233D;max-width:700px;margin:auto;">
      <div style="background:#17233D;color:white;padding:24px;border-radius:12px;">
        <div style="font-size:12px;letter-spacing:1px;">FINDER OF SOLUTIONS</div>
        <h1 style="margin:8px 0 4px;font-size:24px;">Seu Diagnóstico Empresarial</h1>
        <div>${escaparHtml(empresa.razao)}</div>
      </div>

      <div style="padding:18px 0;">
        <p>Olá, <strong>${escaparHtml(responsavel.nome)}</strong>.</p>
        <p>
          Obrigado por participar do Diagnóstico Empresarial Finder.
          Abaixo está o resumo do resultado obtido a partir das respostas fornecidas.
        </p>

        <div style="background:#FFF3EF;border-left:4px solid #FF6B4A;padding:14px;border-radius:8px;">
          <div style="font-size:34px;font-weight:800;color:#FF6B4A;">${escaparHtml(resultado.scoreGeral)}/100</div>
          <strong>${escaparHtml(resultado.nivelGeral)}</strong>
        </div>

        <h2>Resumo executivo</h2>
        <p>${escaparHtml(diagnostico.resumoExecutivo || "Seu diagnóstico foi concluído com sucesso.")}</p>

        <h2>Principais pontos de atenção</h2>
        <ul>${listaHtml(diagnostico.principaisDores)}</ul>

        <h2>Pontos fortes</h2>
        <ul>${listaHtml(diagnostico.pontosFortes)}</ul>

        <h2>Prioridades recomendadas</h2>
        <ol>${listaHtml(diagnostico.prioridadesImediatas)}</ol>

        <h2>Oportunidades</h2>
        <ul>${listaHtml(diagnostico.oportunidades)}</ul>

        <div style="background:#17233D;color:white;padding:16px;border-radius:10px;margin-top:22px;">
          <strong>Quer aprofundar seu diagnóstico?</strong>
          <p style="margin:6px 0 0;">
            Fale com um especialista Finder:
            <a href="https://wa.me/5541989049616" style="color:white;font-weight:700;">(41) 98904-9616</a>
          </p>
        </div>

        <p style="font-size:11px;color:#5B667A;margin-top:22px;">
          Este diagnóstico possui caráter preliminar e foi elaborado com base nas respostas fornecidas.
          Recomenda-se análise individualizada para validação das oportunidades identificadas.
        </p>
      </div>
    </div>
  `;

  try {
    const envioFinder = await enviarEmail({
      to: EMAIL_FINDER,
      subject: `Novo diagnóstico — ${empresa.razao} — ${resultado.scoreGeral}/100`,
      html: htmlFinder,
      replyTo: responsavel.email || undefined,
    });

    let envioLead = null;

    if (
      responsavel.consentimentoEmail &&
      responsavel.email &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(responsavel.email)
    ) {
      envioLead = await enviarEmail({
        to: responsavel.email,
        subject: `Seu Diagnóstico Empresarial Finder — ${empresa.razao}`,
        html: htmlLead,
        replyTo: EMAIL_FINDER,
      });
    }

    return res.status(200).json({
      sucesso: true,
      finder: Boolean(envioFinder),
      lead: Boolean(envioLead),
    });
  } catch (error) {
    console.error("Erro ao enviar relatório:", error);
    return res.status(500).json({
      sucesso: false,
      error: error.message || "Erro ao enviar relatório.",
    });
  }
}
