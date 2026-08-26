import jsPDF from "jspdf";

function texto(valor = "") {
  return String(valor ?? "").trim();
}

function dinheiro(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dataBR(valor) {
  if (!valor) return "-";

  const data = new Date(
    String(valor).length === 10
      ? `${valor}T12:00:00`
      : valor
  );

  if (Number.isNaN(data.getTime())) {
    return String(valor);
  }

  return data.toLocaleDateString("pt-BR");
}

function quebrar(doc, conteudo, largura) {
  return doc.splitTextToSize(
    texto(conteudo) || "-",
    largura
  );
}

async function carregarLogo() {
  try {
    const resposta = await fetch("/finder-logo.png");
    if (!resposta.ok) return null;

    const blob = await resposta.blob();

    return await new Promise((resolve) => {
      const leitor = new FileReader();
      leitor.onloadend = () => resolve(leitor.result);
      leitor.onerror = () => resolve(null);
      leitor.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function novaPagina(doc, y, altura = 25) {
  if (y + altura <= 277) {
    return y;
  }

  doc.addPage();
  return 20;
}

function tituloSecao(doc, titulo, y) {
  y = novaPagina(doc, y, 18);

  doc.setFillColor(23, 35, 61);
  doc.roundedRect(15, y, 180, 9, 2, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(titulo.toUpperCase(), 20, y + 6);

  doc.setTextColor(23, 35, 61);
  return y + 15;
}

function paragrafo(doc, conteudo, y, opcoes = {}) {
  const {
    largura = 170,
    tamanho = 10,
    negrito = false,
    espacamento = 5,
  } = opcoes;

  const linhas = quebrar(doc, conteudo, largura);
  const altura = linhas.length * espacamento;

  y = novaPagina(doc, y, altura + 5);

  doc.setFont(
    "helvetica",
    negrito ? "bold" : "normal"
  );
  doc.setFontSize(tamanho);
  doc.setTextColor(39, 50, 71);
  doc.text(linhas, 20, y);

  return y + altura + 3;
}

function campo(doc, label, valor, x, y, largura = 80) {
  doc.setTextColor(91, 102, 122);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(label.toUpperCase(), x, y);

  doc.setTextColor(23, 35, 61);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const linhas = quebrar(doc, valor, largura);
  doc.text(linhas, x, y + 5);
}

export async function gerarPropostaPDF({
  proposta,
  atendimento,
  lead,
}) {
  if (!proposta) {
    throw new Error("Proposta não informada.");
  }

  const doc = new jsPDF({
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const logo = await carregarLogo();

  doc.setFillColor(23, 35, 61);
  doc.rect(0, 0, 210, 52, "F");

  if (logo) {
    try {
      doc.addImage(
        logo,
        "PNG",
        15,
        9,
        43,
        18,
        undefined,
        "FAST"
      );
    } catch {}
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.text("PROPOSTA COMERCIAL", 15, 38);

  const numero =
    proposta.numeroProposta ||
    proposta.id ||
    "-";

  const versao =
    proposta.versaoAtual ||
    proposta.versao ||
    1;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    `${numero} · Versão ${versao}`,
    195,
    17,
    { align: "right" }
  );
  doc.text(
    `Emissão: ${dataBR(new Date())}`,
    195,
    23,
    { align: "right" }
  );

  if (proposta.validade) {
    doc.text(
      `Validade: ${dataBR(proposta.validade)}`,
      195,
      29,
      { align: "right" }
    );
  }

  let y = 64;

  y = tituloSecao(doc, "Cliente", y);

  const nomeCliente =
    texto(
      lead?.razaoSocial ||
      lead?.nome ||
      atendimento?.lead?.razaoSocial ||
      atendimento?.lead?.nome ||
      "Cliente"
    );

  doc.setFillColor(247, 248, 251);
  doc.roundedRect(15, y - 4, 180, 32, 3, 3, "F");

  campo(doc, "Cliente", nomeCliente, 20, y + 2, 105);
  campo(
    doc,
    "CNPJ",
    lead?.cnpj ||
      atendimento?.lead?.cnpj ||
      "-",
    132,
    y + 2,
    55
  );
  campo(
    doc,
    "Área / atendimento",
    proposta.area ||
      atendimento?.area ||
      "-",
    20,
    y + 17,
    75
  );
  campo(
    doc,
    "Responsável Finder",
    proposta.responsavelNome ||
      atendimento?.responsavelNome ||
      "-",
    102,
    y + 17,
    85
  );

  y += 39;

  y = tituloSecao(doc, "Solução proposta", y);

  y = paragrafo(
    doc,
    proposta.tituloProposta ||
      proposta.servico,
    y,
    {
      tamanho: 15,
      negrito: true,
      espacamento: 6,
    }
  );

  if (proposta.resumoExecutivo) {
    y = paragrafo(
      doc,
      proposta.resumoExecutivo,
      y
    );
  }

  y = tituloSecao(doc, "Escopo", y + 3);

  y = paragrafo(
    doc,
    proposta.escopo ||
      proposta.descricao ||
      "Escopo a ser definido.",
    y
  );

  if (proposta.entregaveis) {
    y = tituloSecao(doc, "Entregáveis", y + 3);
    y = paragrafo(doc, proposta.entregaveis, y);
  }

  y = tituloSecao(doc, "Investimento", y + 4);
  y = novaPagina(doc, y, 44);

  doc.setFillColor(255, 243, 239);
  doc.roundedRect(15, y - 3, 180, 37, 3, 3, "F");

  const colunas = [
    ["Valor total", dinheiro(proposta.valorTotal), 20],
    ["Implantação", dinheiro(proposta.taxaImplantacao), 79],
    ["Mensalidade", dinheiro(proposta.mensalidade), 138],
  ];

  colunas.forEach(([label, valor, x]) => {
    doc.setTextColor(153, 60, 29);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(label.toUpperCase(), x, y + 3);

    doc.setTextColor(23, 35, 61);
    doc.setFontSize(13);
    doc.text(valor, x, y + 13);
  });

  doc.setTextColor(91, 102, 122);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Modelo: ${
      proposta.tipoReceita === "RECORRENTE"
        ? "Recorrente"
        : proposta.tipoReceita === "MISTA"
        ? "Projeto + recorrência"
        : "Pontual"
    }`,
    20,
    y + 27
  );

  y += 43;

  y = tituloSecao(doc, "Condições comerciais", y);

  y = paragrafo(
    doc,
    `Forma de pagamento: ${
      proposta.condicoesPagamento ||
      "A combinar"
    }`,
    y,
    { tamanho: 9.5 }
  );

  y = paragrafo(
    doc,
    `Prazo de execução: ${
      proposta.prazoExecucao ||
      "Conforme cronograma definido após aprovação"
    }`,
    y,
    { tamanho: 9.5 }
  );

  y = paragrafo(
    doc,
    `Validade da proposta: ${
      proposta.validade
        ? dataBR(proposta.validade)
        : "A combinar"
    }`,
    y,
    { tamanho: 9.5 }
  );

  if (proposta.observacoes) {
    y = tituloSecao(doc, "Observações", y + 2);
    y = paragrafo(
      doc,
      proposta.observacoes,
      y,
      { tamanho: 9.5 }
    );
  }

  y = novaPagina(doc, y + 8, 55);
  y = tituloSecao(doc, "Aceite", y);

  y = paragrafo(
    doc,
    "Ao aprovar esta proposta, o cliente declara ciência do escopo e das condições comerciais aqui apresentadas. O detalhamento contratual poderá ser formalizado em instrumento próprio.",
    y,
    { tamanho: 9 }
  );

  y += 12;

  doc.setDrawColor(150, 158, 174);
  doc.line(20, y, 90, y);
  doc.line(115, y, 185, y);

  doc.setFontSize(8);
  doc.setTextColor(91, 102, 122);
  doc.text("Cliente / responsável", 20, y + 5);
  doc.text("Data / aceite", 115, y + 5);

  const totalPaginas = doc.getNumberOfPages();

  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    doc.setPage(pagina);
    doc.setDrawColor(221, 227, 236);
    doc.line(15, 286, 195, 286);

    doc.setTextColor(91, 102, 122);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");

    doc.text("FINDER OF SOLUTIONS", 15, 291);
    doc.text(
      `Proposta ${numero} · v${versao}`,
      105,
      291,
      { align: "center" }
    );
    doc.text(
      `Página ${pagina}/${totalPaginas}`,
      195,
      291,
      { align: "right" }
    );
  }

  const arquivo =
    `${numero}_V${versao}.pdf`
      .replace(/[^a-zA-Z0-9_.-]/g, "_");

  doc.save(arquivo);
}

export default function PropostaPDFButton({
  proposta,
  atendimento,
  lead,
  children = "Gerar PDF",
  style = {},
  onErro,
}) {
  async function gerar() {
    try {
      await gerarPropostaPDF({
        proposta,
        atendimento,
        lead,
      });
    } catch (error) {
      onErro?.(
        error?.message ||
        "Não foi possível gerar o PDF."
      );
    }
  }

  return (
    <button
      type="button"
      onClick={gerar}
      style={{
        border: "1px solid #D8DEEA",
        background: "#FFFFFF",
        color: "#17233D",
        borderRadius: 8,
        padding: "8px 10px",
        cursor: "pointer",
        fontWeight: 800,
        fontSize: 10,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
