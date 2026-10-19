// server/pasta-engine.js
// Finder — Auditoria de pastas de clientes (Inteligência Tributária).
//
// Motor PURO (sem rede, sem banco, sem Node-only): recebe a lista de arquivos
// e pastas de um cliente (vinda de um ZIP, de uma pasta arrastada no navegador
// ou, no futuro, da API do Google Drive) e devolve achados objetivos: o que
// falta, o que está no lugar errado, o que venceu e o que não bate entre os
// documentos. A IA entra depois, só para interpretar e sugerir melhorias.
//
// Roda tanto no navegador quanto no servidor. Fica em server/ para não
// consumir função serverless (limite de 12 da Vercel).

// ---------------------------------------------------------
// PADRÃO DE PASTAS DO ESCRITÓRIO (ajustável)
// ---------------------------------------------------------
export const PADRAO_PASTAS = {
  raizCliente: /^(\d+)\s*-\s*(.+)$/,
  topo: [
    { chave: "cnds", nome: "CNDS e RELATORIOS", subpastas: ["ESTADUAL", "MUNICIPAL"] },
    { chave: "empresa", nome: "DOCS DA EMPRESA", subpastas: ["CERTIFICADO DIGITAL"] },
    { chave: "socios", nome: "DOCS DOS SOCIOS", subpastas: [] },
    {
      chave: "fiscal",
      nome: "DOCS FISCAL-CONTABIL",
      subpastas: [
        "- PARCELAMENTOS - GUIAS E RELATORIOS",
        "ACORDOS CLIENTES E FORNECEDORES",
        "BANCOS E COMPROVANTES",
        "DARF MENSAL - GUIAS",
        "DASN-SIMEI",
        "DECL. DCTF MENSAL",
        "DECL. DIRF ANUAL",
        "DECL. DMED - DIMOB - OUTROS ANUAIS",
        "DECL. SIMPLES NACIONAL E GUIA",
        "DECL. SPED CONTABIL",
        "DECL. SPED CONTRIBUIÇÕES - PIS-COFINS",
        "DECL. SPED EFD-REINF",
        "DECL. SPED FISCAL - ICMS-IPI",
        "DECL. SPED FISCO-CONTABIL",
        "LIVROS CONTABEIS",
        "NOTAS FISCAIS",
        "PROCESSOS ADMNISTRATIVOS",
      ],
    },
  ],
  // Para onde cada tipo de arquivo deveria ir (palavra-chave da pasta de destino).
  destinos: [
    { re: /dctf/i, pasta: "DECL. DCTF MENSAL", rotulo: "DCTF/DCTFWeb" },
    { re: /\birpf\b|irpf-a-|^\d{11}-irpf/i, pasta: "DOCS DOS SOCIOS", rotulo: "IRPF do sócio" },
    { re: /\b(cnh|rg|identidade)\b/i, pasta: "DOCS DOS SOCIOS", rotulo: "documento pessoal do sócio" },
    { re: /pgdas|pgd\d+|simples nacional/i, pasta: "DECL. SIMPLES NACIONAL E GUIA", rotulo: "documento do Simples Nacional" },
    { re: /\bcnd\b|certid[aã]o|extrato fiscal/i, pasta: "CNDS e RELATORIOS", rotulo: "certidão/relatório de situação fiscal" },
    { re: /darf/i, pasta: "DARF MENSAL - GUIAS", rotulo: "DARF" },
    { re: /\.pfx$|\.p12$/i, pasta: "CERTIFICADO DIGITAL", rotulo: "certificado digital" },
    { re: /altera[cç][aã]o contratual|contrato social|consolida[cç][aã]o/i, pasta: "DOCS DA EMPRESA", rotulo: "documento societário" },
    { re: /\bqsa\b|inscri[cç][aã]o (municipal|estadual)/i, pasta: "DOCS DA EMPRESA", rotulo: "cadastro da empresa" },
    { re: /\bsped\b|\becd\b|\becf\b/i, pasta: "DECL. SPED", rotulo: "SPED" },
    { re: /extrato banc|comprovante de pagamento|comprovante pix/i, pasta: "BANCOS E COMPROVANTES", rotulo: "comprovante bancário" },
  ],
};


// O que cada pasta deve conter e quando a obrigação existe, por regime.
// "esp" = esperada · "pos" = possível (depende do caso) · "nao" = em regra não se aplica
export const GUIA_PASTAS = {
  "CNDS e RELATORIOS": { conteudo: "Certidões negativas (federal, estadual e municipal) dentro da validade e relatórios de situação fiscal (e-CAC, extrato do Simples).", r: { SIMPLES: "esp", MEI: "esp", PRESUMIDO: "esp", REAL: "esp" } },
  "DOCS DA EMPRESA": { conteudo: "Cartão CNPJ, QSA, contrato social e alterações, inscrições estadual/municipal, alvará e certificado digital.", r: { SIMPLES: "esp", MEI: "esp", PRESUMIDO: "esp", REAL: "esp" } },
  "DOCS DOS SOCIOS": { conteudo: "Documento de identificação e CPF dos sócios, comprovante de residência e declaração de IRPF.", r: { SIMPLES: "esp", MEI: "esp", PRESUMIDO: "esp", REAL: "esp" } },
  "DOCS FISCAL-CONTABIL": { conteudo: "Declarações, guias, notas, livros e comprovantes da rotina fiscal e contábil, organizados nas subpastas abaixo.", r: { SIMPLES: "esp", MEI: "esp", PRESUMIDO: "esp", REAL: "esp" } },
  "- PARCELAMENTOS - GUIAS E RELATORIOS": { conteudo: "Uma subpasta por parcelamento (PCTO - LOCAL - IMPOSTO - NÚMERO), com termo, guias mensais por MM.AAAA e comprovantes.", r: { SIMPLES: "pos", MEI: "pos", PRESUMIDO: "pos", REAL: "pos" } },
  "ACORDOS CLIENTES E FORNECEDORES": { conteudo: "Contratos e acordos comerciais relevantes para a contabilidade.", r: { SIMPLES: "pos", MEI: "pos", PRESUMIDO: "pos", REAL: "pos" } },
  "BANCOS E COMPROVANTES": { conteudo: "Extratos bancários e comprovantes de pagamento das guias de impostos.", r: { SIMPLES: "esp", MEI: "pos", PRESUMIDO: "esp", REAL: "esp" } },
  "DARF MENSAL - GUIAS": { conteudo: "DARFs de IRPJ, CSLL, PIS, COFINS, IRRF e demais tributos federais fora do Simples.", r: { SIMPLES: "nao", MEI: "nao", PRESUMIDO: "esp", REAL: "esp" } },
  "DASN-SIMEI": { conteudo: "Declaração anual do MEI e recibos.", r: { SIMPLES: "nao", MEI: "esp", PRESUMIDO: "nao", REAL: "nao" } },
  "DECL. DCTF MENSAL": { conteudo: "Recibos da DCTF/DCTFWeb mensal.", r: { SIMPLES: "pos", MEI: "nao", PRESUMIDO: "esp", REAL: "esp" } },
  "DECL. DIRF ANUAL": { conteudo: "DIRF anual (até 2024) e comprovantes de rendimentos. A partir de 2025 a informação segue pela EFD-Reinf.", r: { SIMPLES: "pos", MEI: "nao", PRESUMIDO: "pos", REAL: "pos" } },
  "DECL. DMED - DIMOB - OUTROS ANUAIS": { conteudo: "DMED, DIMOB, DeSTDA e outras declarações anuais que se apliquem.", r: { SIMPLES: "pos", MEI: "nao", PRESUMIDO: "pos", REAL: "pos" } },
  "DECL. SIMPLES NACIONAL E GUIA": { conteudo: "Por mês (MM.AAAA): declaração e recibo do PGDAS-D, extrato e guia DAS. Também DEFIS anual.", r: { SIMPLES: "esp", MEI: "nao", PRESUMIDO: "nao", REAL: "nao" } },
  "DECL. SPED CONTABIL": { conteudo: "ECD (escrituração contábil digital) e recibos.", r: { SIMPLES: "nao", MEI: "nao", PRESUMIDO: "esp", REAL: "esp" } },
  "DECL. SPED CONTRIBUIÇÕES - PIS-COFINS": { conteudo: "EFD-Contribuições mensal e recibos.", r: { SIMPLES: "nao", MEI: "nao", PRESUMIDO: "pos", REAL: "esp" } },
  "DECL. SPED EFD-REINF": { conteudo: "Eventos da EFD-Reinf (retenções) e recibos.", r: { SIMPLES: "pos", MEI: "nao", PRESUMIDO: "esp", REAL: "esp" } },
  "DECL. SPED FISCAL - ICMS-IPI": { conteudo: "EFD ICMS/IPI mensal e recibos (empresas de comércio/indústria).", r: { SIMPLES: "pos", MEI: "nao", PRESUMIDO: "pos", REAL: "pos" } },
  "DECL. SPED FISCO-CONTABIL": { conteudo: "ECF e demais obrigações do bloco fisco-contábil.", r: { SIMPLES: "nao", MEI: "nao", PRESUMIDO: "esp", REAL: "esp" } },
  "LIVROS CONTABEIS": { conteudo: "Balancetes, balanço, DRE, livro diário e razão.", r: { SIMPLES: "pos", MEI: "nao", PRESUMIDO: "esp", REAL: "esp" } },
  "NOTAS FISCAIS": { conteudo: "XML e PDF das notas emitidas e recebidas, por competência.", r: { SIMPLES: "esp", MEI: "pos", PRESUMIDO: "esp", REAL: "esp" } },
  "PROCESSOS ADMNISTRATIVOS": { conteudo: "Processos, notificações e autos de infração com seus andamentos.", r: { SIMPLES: "pos", MEI: "pos", PRESUMIDO: "pos", REAL: "pos" } },
};

const CATEGORIA_PARA_PASTA = {
  "Certidões": "CNDS e RELATORIOS",
  "Documentos da empresa": "DOCS DA EMPRESA",
  "Certificado digital": "CERTIFICADO DIGITAL",
  "Documentos dos sócios": "DOCS DOS SOCIOS",
  "Simples Nacional": "DECL. SIMPLES NACIONAL E GUIA",
  "Parcelamentos": "- PARCELAMENTOS - GUIAS E RELATORIOS",
  "Notas fiscais": "NOTAS FISCAIS",
  "Pagamentos": "BANCOS E COMPROVANTES",
  "DCTFWeb": "DECL. DCTF MENSAL",
};

// ---------------------------------------------------------
// UTILITÁRIOS
// ---------------------------------------------------------
export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const IGNORAR = [/(^|\/)\.ds_store$/i, /(^|\/)__macosx(\/|$)/i, /(^|\/)thumbs\.db$/i, /(^|\/)desktop\.ini$/i, /(^|\/)~\$/];

export function ignorado(caminho) {
  return IGNORAR.some((re) => re.test(caminho));
}

function partes(caminho) {
  return String(caminho).split("/").filter((p) => p !== "");
}

function nomeArquivo(caminho) {
  const p = partes(caminho);
  return p[p.length - 1] || "";
}

const ISO = (d) => d.toISOString().slice(0, 10);
const doisDigitos = (n) => String(n).padStart(2, "0");
const chaveMes = (ano, mes) => `${ano}-${doisDigitos(mes)}`;
const rotuloMes = (chave) => `${chave.slice(5, 7)}/${chave.slice(0, 4)}`;

function mesesEntre(inicio, fim) {
  const out = [];
  let [a, m] = inicio.split("-").map(Number);
  const [fa, fm] = fim.split("-").map(Number);
  let guarda = 0;
  while ((a < fa || (a === fa && m <= fm)) && guarda++ < 400) {
    out.push(chaveMes(a, m));
    m += 1;
    if (m > 12) { m = 1; a += 1; }
  }
  return out;
}

function mesAnterior(hoje) {
  const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 1));
  return chaveMes(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

function diasEntre(deData, ateData) {
  return Math.floor((ateData.getTime() - deData.getTime()) / 86400000);
}

function parseDataBr(texto) {
  const m = String(texto || "").match(/(\d{2})[./](\d{2})[./](\d{4})/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function brl(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function paraNumero(texto) {
  if (texto === null || texto === undefined) return null;
  const limpo = String(texto).replace(/[^\d,.-]/g, "");
  if (!limpo) return null;
  const n = Number(limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo);
  return Number.isFinite(n) ? n : null;
}

// Mês (AAAA-MM) a partir de um segmento de pasta: "09.2026", "2019.01", "09-2026".
export function mesDoSegmento(segmento) {
  const s = String(segmento).trim();
  let m = s.match(/^(0[1-9]|1[0-2])[.\-/](\d{4})$/);
  if (m) return chaveMes(Number(m[2]), Number(m[1]));
  m = s.match(/^(\d{4})[.\-/](0[1-9]|1[0-2])$/);
  if (m) return chaveMes(Number(m[1]), Number(m[2]));
  return null;
}

function mesDoCaminho(caminhoPartes, nome) {
  for (let i = caminhoPartes.length - 1; i >= 0; i--) {
    const mes = mesDoSegmento(caminhoPartes[i]);
    if (mes) return mes;
  }
  const m = String(nome).match(/_(0[1-9]|1[0-2])_(\d{4})\b/);
  if (m) return chaveMes(Number(m[2]), Number(m[1]));
  return null;
}

// PA gravado no nome dos arquivos do PGDAS-D: <CNPJ8><AAAAMM><seq>.
export function paDoNomePgdas(nome) {
  const m = String(nome).match(/(\d{8})(20\d{2})(0[1-9]|1[0-2])\d{3}\./);
  return m ? chaveMes(Number(m[2]), Number(m[3])) : null;
}

// ---------------------------------------------------------
// CLASSIFICAÇÃO DE ARQUIVOS DO SIMPLES
// ---------------------------------------------------------
export function tipoDocSimples(nome) {
  const n = String(nome);
  if (/PGDASD-DECLARACAO/i.test(n)) return "declaracao";
  if (/PGDASD-RECIBO/i.test(n)) return "recibo";
  if (/PGDASD-EXTRATO/i.test(n) || /^simples nacional\.pdf$/i.test(n)) return "extrato";
  if (/PGDASD-DAS|\bDAS\b|^PGD\w*_TR|^PGD\d/i.test(n)) return "das";
  return "outro";
}

// ---------------------------------------------------------
// EXTRAÇÃO DE FATOS A PARTIR DO TEXTO DOS DOCUMENTOS
// (o texto vem do pdf.js no navegador, ou do pdf-parse no servidor)
// ---------------------------------------------------------
const RE_CNPJ = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;

export function extrairCnpjs(texto) {
  const out = [];
  const t = String(texto || "");
  let m;
  RE_CNPJ.lastIndex = 0;
  while ((m = RE_CNPJ.exec(t))) {
    const antes = t.slice(Math.max(0, m.index - 45), m.index);
    // "CNPJ do certificado" é o de quem emitiu, não o do cliente.
    if (/certificado/i.test(antes)) continue;
    out.push(m[0].replace(/\D/g, ""));
  }
  return [...new Set(out)];
}

export function extrairFatosDeTexto(nome, texto) {
  const t = String(texto || "");
  const fatos = { nome, legivel: t.replace(/\s+/g, "").length > 30 };
  if (!fatos.legivel) return fatos;

  fatos.cnpjs = extrairCnpjs(t);

  // Recibo do PGDAS-D: "09/2026  17176998202609001  R$ 23.000,00  R$ 702,42 ..."
  const rec = t.match(/(0[1-9]|1[0-2])\/(\d{4})\s+(\d{17})\s+R\$\s*([\d.]+,\d{2})\s+R\$\s*([\d.]+,\d{2})/);
  if (rec) {
    fatos.pa = chaveMes(Number(rec[2]), Number(rec[1]));
    fatos.receita = paraNumero(rec[4]);
    fatos.debitoDeclarado = paraNumero(rec[5]);
  }

  // Declaração: "Período de Apuração: 01/09/2026 a 30/09/2026" + RPA.
  const per = t.match(/Per[ií]odo de Apura[cç][aã]o:?\s*\d{2}\/(0[1-9]|1[0-2])\/(\d{4})/i);
  if (per && !fatos.pa) fatos.pa = chaveMes(Number(per[2]), Number(per[1]));
  const rpa = t.match(/Receita Bruta do PA[^\n]*?([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})/i);
  if (rpa && fatos.receita === undefined) {
    fatos.receita = paraNumero(rpa[3]);
    fatos.receitaExterno = paraNumero(rpa[2]);
  }

  // Guia DAS: vencimento e valor.
  if (/Documento de Arrecada[cç][aã]o/i.test(t) && /Simples Nacional/i.test(t)) {
    const venc = t.match(/Data de Vencimento[\s\S]{0,160}?(\d{2}\/\d{2}\/\d{4})/i);
    if (venc) fatos.vencimento = ISO(parseDataBr(venc[1]) || new Date(0));
    const val = t.match(/Valor Total do Docum\w*[\s\S]{0,200}?([\d.]+,\d{2})/i);
    if (val) fatos.valorGuia = paraNumero(val[1]);
    const pa = t.match(/(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*\/\s*(\d{4})/i);
    if (pa && !fatos.pa) {
      const idx = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
        .indexOf(normalizar(pa[1]));
      if (idx >= 0) fatos.pa = chaveMes(Number(pa[2]), idx + 1);
    }
    fatos.ehGuiaSimples = true;
    if (/PARCMEI|PARCSN|parcelamento/i.test(t)) {
      const parc = t.match(/Parcela:?\s*(\d+)\s*\/\s*(\d+)/i);
      if (parc) fatos.parcela = { atual: Number(parc[1]), total: Number(parc[2]) };
      fatos.ehParcelamento = true;
    }
  }

  // Validade de certidões.
  const val = t.match(/(?:v[aá]lid[ao]\s+at[eé]|validade)[:\s]*?(\d{2}\/\d{2}\/\d{4})/i);
  if (val) fatos.validade = ISO(parseDataBr(val[1]) || new Date(0));

  // DCTFWeb.
  if (/DCTFWeb/i.test(t)) {
    const pa = t.match(/Per[ií]odo de apura[cç][aã]o\s+(0[1-9]|1[0-2])\/(\d{4})/i);
    if (pa) { fatos.pa = chaveMes(Number(pa[2]), Number(pa[1])); fatos.ehDctfWeb = true; }
  }

  // Extrato fiscal: opções pelo Simples (inclusão/exclusão).
  if (/Op[cç][aã]o pelo Simples Nacional/i.test(t)) {
    const bloco = t.split(/Op[cç][aã]o pelo SIMEI/i)[0].split(/Op[cç][aã]o pelo Simples Nacional/i)[1] || "";
    const datas = [...bloco.matchAll(/\d{2}\/\d{2}\/\d{4}/g)].map((x) => x[0]).slice(0, 8);
    if (datas.length) fatos.opcoesSimples = datas;
  }
  return fatos;
}

export function extrairFatosNota(nome, xml) {
  const x = String(xml || "");
  if (!/<(NFSe|nfeProc|NFe|infNFe|infNFSe)/.test(x)) return null;
  const emit = (x.match(/<emit>[\s\S]*?<CNPJ>(\d{14})<\/CNPJ>/) || [])[1] || null;
  const valorTxt = (x.match(/<vServ>([\d.]+)<\/vServ>/) || x.match(/<vNF>([\d.]+)<\/vNF>/) || x.match(/<vBC>([\d.]+)<\/vBC>/) || x.match(/<vLiq>([\d.]+)<\/vLiq>/) || [])[1];
  const data = (x.match(/<dCompet>(\d{4})-(\d{2})-\d{2}<\/dCompet>/) || x.match(/<dhEmi>(\d{4})-(\d{2})-\d{2}/) || x.match(/<dEmi>(\d{4})-(\d{2})-\d{2}/) || []);
  if (!data[1]) return null;
  return {
    nome,
    ehNota: true,
    cnpjEmitente: emit,
    valor: valorTxt ? Number(valorTxt) : null,
    mes: chaveMes(Number(data[1]), Number(data[2])),
    tomador: ((x.match(/<toma>[\s\S]*?<xNome>([^<]+)<\/xNome>/) || x.match(/<dest>[\s\S]*?<xNome>([^<]+)<\/xNome>/) || [])[1] || "").slice(0, 80),
  };
}

// ---------------------------------------------------------
// SEPARAÇÃO DE CLIENTES
// ---------------------------------------------------------
// entradas: [{ caminho: "232 - NOME/DOCS.../arq.pdf", tipo: "arquivo"|"pasta", tamanho, modificadoEm }]
export function separarClientes(entradasBrutas) {
  const entradas = (Array.isArray(entradasBrutas) ? entradasBrutas : [])
    .map((e) => ({ ...e, caminho: partes(e.caminho).join("/") }))
    .filter((e) => e.caminho && !ignorado(e.caminho));

  const raizes = (lista) => [...new Set(lista.map((e) => partes(e.caminho)[0]))];

  let nivel = entradas;
  let prefixo = [];
  // Desce enquanto houver uma única pasta-raiz que não seja um cliente.
  for (let i = 0; i < 4; i++) {
    const rs = raizes(nivel);
    if (rs.length === 1 && !PADRAO_PASTAS.raizCliente.test(rs[0]) && nivel.some((e) => partes(e.caminho).length > 1)) {
      prefixo.push(rs[0]);
      nivel = nivel
        .map((e) => ({ ...e, caminho: partes(e.caminho).slice(1).join("/") }))
        .filter((e) => e.caminho);
    } else break;
  }

  const porRaiz = new Map();
  const foraDoPadrao = new Set();
  for (const e of nivel) {
    const raiz = partes(e.caminho)[0];
    if (!PADRAO_PASTAS.raizCliente.test(raiz)) { foraDoPadrao.add(raiz); continue; }
    if (!porRaiz.has(raiz)) porRaiz.set(raiz, []);
    porRaiz.get(raiz).push({ ...e, caminho: partes(e.caminho).slice(1).join("/") });
  }

  const clientes = [...porRaiz.entries()]
    .map(([raiz, lista]) => {
      const m = raiz.match(PADRAO_PASTAS.raizCliente);
      return { raiz, codigo: m[1], nome: m[2].trim(), entradas: lista.filter((e) => e.caminho) };
    })
    .sort((a, b) => Number(a.codigo) - Number(b.codigo));

  return { clientes, foraDoPadrao: [...foraDoPadrao], prefixo };
}

// ---------------------------------------------------------
// AUDITORIA DE UM CLIENTE
// ---------------------------------------------------------
const SEV = { critico: 0, atencao: 1, info: 2 };

export function auditarCliente({ cliente, regime = "AUTO", fatos = {}, hoje = new Date(), inicioObrigacoes = "", temPastasVazias = true } = {}) {
  const achados = [];
  let seq = 0;
  const add = (severidade, categoria, titulo, detalhe, extra = {}) =>
    achados.push({ id: `a${++seq}`, severidade, categoria, titulo, detalhe, ...extra });

  const hojeUtc = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
  const entradas = (cliente?.entradas || []).filter((e) => !ignorado(e.caminho));
  const arquivos = entradas.filter((e) => e.tipo !== "pasta");

  // Pastas = declaradas + inferidas dos caminhos dos arquivos.
  const pastasSet = new Set();
  for (const e of entradas) {
    const p = partes(e.caminho);
    const limite = e.tipo === "pasta" ? p.length : p.length - 1;
    for (let i = 1; i <= limite; i++) pastasSet.add(p.slice(0, i).join("/"));
  }
  const pastas = [...pastasSet];
  const arquivosPor = (prefixo) => arquivos.filter((a) => a.caminho === prefixo || a.caminho.startsWith(`${prefixo}/`));
  const achaPasta = (nomePadrao, base = "") => {
    const alvo = normalizar(nomePadrao);
    return pastas.find((p) => {
      if (base && !p.startsWith(`${base}/`)) return false;
      const resto = base ? p.slice(base.length + 1) : p;
      return !resto.includes("/") && normalizar(resto) === alvo;
    });
  };

  const topo = {};
  for (const t of PADRAO_PASTAS.topo) topo[t.chave] = achaPasta(t.nome);

  // 1) Estrutura padrão -------------------------------------------------
  for (const t of PADRAO_PASTAS.topo) {
    if (!topo[t.chave]) {
      add("atencao", "Estrutura", `Pasta padrão ausente: ${t.nome}`, "A pasta não existe no cliente (ou está com outro nome).", { sugestao: `Criar a pasta “${t.nome}” e organizar os documentos nela.` });
      continue;
    }
    for (const sub of t.subpastas) {
      if (!achaPasta(sub, topo[t.chave])) {
        add(t.chave === "fiscal" ? "atencao" : "info", "Estrutura", `Subpasta padrão ausente: ${t.nome} / ${sub}`, "A subpasta do padrão do escritório não foi encontrada.", { sugestao: `Criar “${sub}” dentro de “${t.nome}”.` });
      }
    }
  }
  const topoNomes = new Set(Object.values(topo).filter(Boolean).map((p) => normalizar(p)));
  const extras = pastas.filter((p) => !p.includes("/") && !topoNomes.has(normalizar(p)));
  for (const p of extras) add("info", "Estrutura", `Pasta fora do padrão: ${p}`, "Existe uma pasta de primeiro nível que não faz parte do padrão do escritório.", { caminho: p });
  const arquivosSoltosRaiz = arquivos.filter((a) => !a.caminho.includes("/"));
  for (const a of arquivosSoltosRaiz) {
    const credencial = /acesso|senha|login|password|credencia/i.test(a.caminho);
    if (!credencial) add("info", "Organização", `Arquivo solto na raiz do cliente: ${nomeArquivo(a.caminho)}`, "Documentos devem ficar dentro de uma das pastas padrão.", { caminho: a.caminho });
  }

  const fiscal = topo.fiscal || "";
  const subFiscal = (nome) => (fiscal ? achaPasta(nome, fiscal) : undefined);

  // 2) Segurança e higiene ---------------------------------------------
  for (const a of arquivos) {
    const nome = nomeArquivo(a.caminho);
    if (/(acesso|senha|login|password|credencia)/i.test(nome) && /\.(txt|doc|docx|xls|xlsx|csv)$/i.test(nome)) {
      add("atencao", "Segurança", `Possível credencial em texto simples: ${nome}`, "Arquivos de acesso/senha dentro da pasta do cliente ficam expostos a quem tiver acesso ao Drive.", { caminho: a.caminho, sugestao: "Mover para um gerenciador de senhas e apagar o arquivo da pasta." });
    }
    if (/\.(pfx|p12)$/i.test(nome)) {
      const semData = nome.replace(/\d{2}[.\-]\d{2}[.\-]\d{4}/g, "");
      if (/(^|[\s_-])\d{4,10}([\s_.-]|$)/.test(semData.replace(/\.(pfx|p12)$/i, ""))) {
        add("atencao", "Segurança", `Possível senha no nome do certificado digital: ${nome}`, "O nome do arquivo parece conter a senha do certificado.", { caminho: a.caminho, sugestao: "Renomear sem a senha e guardá-la em um gerenciador de senhas." });
      }
    }
  }

  // 3) Documentos da empresa e dos sócios ------------------------------
  if (topo.empresa) {
    const docs = arquivosPor(topo.empresa);
    const tem = (re) => docs.some((d) => re.test(nomeArquivo(d.caminho)));
    const exigidos = [
      [/cnpj/i, "Cartão CNPJ", "atencao"],
      [/qsa/i, "QSA (quadro societário)", "info"],
      [/inscri[cç][aã]o.*municipal|\bim\b/i, "Inscrição municipal", "info"],
      [/altera[cç][aã]o|contrato social|consolida/i, "Contrato social / alteração contratual", "atencao"],
    ];
    for (const [re, rotulo, sev] of exigidos) {
      if (!tem(re)) add(sev, "Documentos da empresa", `Documento não localizado: ${rotulo}`, "Não há arquivo com esse nome em DOCS DA EMPRESA.", { sugestao: `Anexar ${rotulo} atualizado.` });
    }
    const cert = docs.filter((d) => /\.(pfx|p12)$/i.test(d.caminho));
    if (!cert.length) {
      add("atencao", "Certificado digital", "Certificado digital não localizado", "Não há arquivo .pfx/.p12 na pasta do cliente.", { sugestao: "Se o escritório usa procuração eletrônica (e-CAC), registrar isso; caso contrário, guardar o certificado." });
    } else {
      const datas = cert.map((c) => parseDataBr(nomeArquivo(c.caminho))).filter(Boolean).sort((a, b) => b - a);
      if (datas[0]) {
        const dias = diasEntre(hojeUtc, datas[0]);
        if (dias < 0) add("critico", "Certificado digital", `Certificado digital vencido em ${ISO(datas[0]).split("-").reverse().join("/")}`, `Venceu há ${-dias} dia(s).`, { sugestao: "Renovar o certificado e atualizar a pasta." });
        else if (dias <= 60) add("atencao", "Certificado digital", `Certificado digital vence em ${dias} dia(s)`, `Validade informada no nome do arquivo: ${ISO(datas[0]).split("-").reverse().join("/")}.`, { sugestao: "Programar a renovação." });
      } else add("info", "Certificado digital", "Validade do certificado não está no nome do arquivo", "Não foi possível conferir o vencimento.", { sugestao: "Incluir a data de vencimento no nome (ex.: ... - 31.08.2027.pfx)." });
    }
  }
  if (topo.socios) {
    if (!arquivosPor(topo.socios).length) add("atencao", "Documentos dos sócios", "Nenhum documento de sócio na pasta", "DOCS DOS SOCIOS está vazia.", { sugestao: "Anexar documento de identificação (CNH/RG) e CPF de cada sócio." });
  }

  // 4) Certidões ---------------------------------------------------------
  if (topo.cnds) {
    const docs = arquivosPor(topo.cnds);
    const tipoCnd = (c) => {
      const t = normalizar(c.caminho);
      if (/estadual/.test(t)) return "estadual";
      if (/municipal/.test(t)) return "municipal";
      if (/federal|rfb|pgfn|uniao/.test(t)) return "federal";
      return "";
    };
    const porTipo = { federal: [], estadual: [], municipal: [] };
    for (const d of docs) {
      const t = tipoCnd(d);
      if (!t) continue;
      const nome = nomeArquivo(d.caminho);
      let validade = null;
      const mNome = nome.match(/vcto[^\d]*(\d{2}[.\-/]\d{2}[.\-/]\d{4})/i);
      if (mNome) validade = parseDataBr(mNome[1]);
      const f = fatos[d.caminho];
      if (!validade && f?.validade) validade = parseDataBr(f.validade.split("-").reverse().join("/"));
      porTipo[t].push({ caminho: d.caminho, validade });
    }
    const rotuloTipo = { federal: "federal (RFB/PGFN)", estadual: "estadual", municipal: "municipal" };
    for (const t of ["federal", "estadual", "municipal"]) {
      const lista = porTipo[t];
      if (!lista.length) {
        add(t === "federal" ? "atencao" : "info", "Certidões", `CND ${rotuloTipo[t]} não localizada`, "Nenhuma certidão desse tipo na pasta.", { sugestao: `Emitir e anexar a CND ${rotuloTipo[t]}.` });
        continue;
      }
      const comData = lista.filter((x) => x.validade).sort((a, b) => b.validade - a.validade);
      if (!comData.length) {
        add("info", "Certidões", `CND ${rotuloTipo[t]}: validade não identificada`, "O nome do arquivo não traz o vencimento e o texto não foi lido.", { caminho: lista[0].caminho, sugestao: "Incluir “VCTO dd.mm.aaaa” no nome do arquivo." });
        continue;
      }
      const dias = diasEntre(hojeUtc, comData[0].validade);
      const dataTxt = ISO(comData[0].validade).split("-").reverse().join("/");
      if (dias < 0) add("critico", "Certidões", `CND ${rotuloTipo[t]} vencida em ${dataTxt}`, `A certidão mais recente venceu há ${-dias} dia(s).`, { caminho: comData[0].caminho, sugestao: `Emitir nova CND ${rotuloTipo[t]}.` });
      else if (dias <= 30) add("atencao", "Certidões", `CND ${rotuloTipo[t]} vence em ${dias} dia(s)`, `Validade: ${dataTxt}.`, { caminho: comData[0].caminho, sugestao: "Programar a renovação." });
    }
    const extrato = docs.find((d) => /extrato fiscal/i.test(d.caminho));
    if (extrato) {
      const mod = extrato.modificadoEm ? new Date(extrato.modificadoEm) : null;
      const mCnd = fatos[extrato.caminho];
      void mod; void mCnd;
    }
  }

  // 5) Simples Nacional: competências -----------------------------------
  const pastaSimples = subFiscal("DECL. SIMPLES NACIONAL E GUIA");
  const meses = new Map();
  let detectouPgdas = false;
  if (pastaSimples) {
    for (const a of arquivosPor(pastaSimples)) {
      const nome = nomeArquivo(a.caminho);
      const p = partes(a.caminho);
      const mesPasta = mesDoCaminho(p, nome);
      const paNome = paDoNomePgdas(nome);
      const f = fatos[a.caminho] || {};
      const mes = mesPasta || paNome || f.pa;
      const tipo = tipoDocSimples(nome);
      if (/pgdasd/i.test(nome)) detectouPgdas = true;
      if (!mes) {
        add("info", "Simples Nacional", `Arquivo sem competência identificável: ${nome}`, "Está fora de uma subpasta MM.AAAA e o nome não indica o período.", { caminho: a.caminho, sugestao: "Colocar na subpasta do mês correto (MM.AAAA)." });
        continue;
      }
      if (!meses.has(mes)) meses.set(mes, { mes, declaracao: false, recibo: false, extrato: false, das: false, arquivos: [], receita: null, debito: null, vencimento: null, valorGuia: null });
      const reg = meses.get(mes);
      reg.arquivos.push(a.caminho);
      if (tipo !== "outro") reg[tipo] = true;
      if (f.receita !== undefined && f.receita !== null && (tipo === "recibo" || reg.receita === null)) reg.receita = f.receita;
      if (f.debitoDeclarado !== undefined && f.debitoDeclarado !== null) reg.debito = f.debitoDeclarado;
      if (f.vencimento) reg.vencimento = f.vencimento;
      if (f.valorGuia !== undefined && f.valorGuia !== null) reg.valorGuia = f.valorGuia;

      // Documento em mês diferente do indicado na pasta/nome.
      const paConteudo = f.pa || paNome;
      if (mesPasta && paConteudo && paConteudo !== mesPasta && (tipo !== "outro" || f.ehGuiaSimples)) {
        add("critico", "Simples Nacional", `Documento de outra competência na pasta ${rotuloMes(mesPasta)}: ${nome}`, `O arquivo é do período ${rotuloMes(paConteudo)}, mas está na pasta ${rotuloMes(mesPasta)}.`, { caminho: a.caminho, sugestao: "Mover para a subpasta correta." });
      }
    }
  }

  const regimeDetectado = regime !== "AUTO" ? regime : detectouPgdas ? "SIMPLES" : arquivosPor(subFiscal("DASN-SIMEI") || "__").length ? "MEI" : "NAO_IDENTIFICADO";

  const listaMeses = [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  const tabelaMeses = [];
  if (regimeDetectado === "SIMPLES" && listaMeses.length) {
    const primeiro = inicioObrigacoes && /^\d{4}-\d{2}$/.test(inicioObrigacoes) ? inicioObrigacoes : listaMeses[0].mes;
    const ultimoEsperado = mesAnterior(hojeUtc);
    const esperados = primeiro <= ultimoEsperado ? mesesEntre(primeiro, ultimoEsperado) : [];
    const pendentes = [];
    const incompletos = [];
    for (const mes of esperados) {
      const reg = meses.get(mes);
      const [ano, m] = mes.split("-").map(Number);
      const vencimentoPrazo = new Date(Date.UTC(m === 12 ? ano + 1 : ano, m === 12 ? 0 : m, 20));
      const diasParaPrazo = diasEntre(hojeUtc, vencimentoPrazo);
      const linha = { mes, rotulo: rotuloMes(mes), declaracao: !!reg?.declaracao, recibo: !!reg?.recibo, extrato: !!reg?.extrato, das: !!reg?.das, receita: reg?.receita ?? null, debito: reg?.debito ?? null, vencimento: reg?.vencimento || null, valorGuia: reg?.valorGuia ?? null, prazo: ISO(vencimentoPrazo), situacao: "ok" };
      if (!reg || (!reg.declaracao && !reg.recibo)) {
        linha.situacao = diasParaPrazo < 0 ? "faltando" : "no_prazo";
        pendentes.push({ mes, diasParaPrazo });
      } else {
        const semMovimento = reg.debito === 0 || (reg.receita === 0 && reg.debito === null && reg.recibo && !reg.das);
        const faltam = [];
        if (!reg.declaracao) faltam.push("declaração");
        if (!reg.recibo) faltam.push("recibo");
        if (!semMovimento) {
          if (!reg.das) faltam.push("guia DAS");
          if (!reg.extrato) faltam.push("extrato");
        }
        linha.semMovimento = !!semMovimento;
        if (faltam.length) { linha.situacao = "incompleto"; linha.faltam = faltam; incompletos.push({ mes, faltam }); }
      }
      tabelaMeses.push(linha);
    }
    const atrasados = pendentes.filter((p) => p.diasParaPrazo < 0);
    const noPrazo = pendentes.filter((p) => p.diasParaPrazo >= 0);
    if (atrasados.length) {
      add("critico", "Simples Nacional", `Declaração/guia do Simples não encontrada: ${atrasados.map((p) => rotuloMes(p.mes)).join(", ")}`, "A competência já passou do prazo de apuração (dia 20 do mês seguinte) e não há PGDAS-D, recibo nem guia na pasta.", { sugestao: "Verificar no portal do Simples se foi entregue e anexar os comprovantes (ou registrar que a empresa estava sem movimento)." });
    }
    if (noPrazo.length) {
      add("atencao", "Simples Nacional", `Competência ainda sem declaração, dentro do prazo: ${noPrazo.map((p) => `${rotuloMes(p.mes)} (${p.diasParaPrazo} dia(s) para o prazo)`).join(", ")}`, "O prazo ainda não venceu, mas nada foi anexado.", { sugestao: "Transmitir o PGDAS-D e anexar declaração, recibo e guia." });
    }
    if (incompletos.length) {
      add("atencao", "Simples Nacional", `Competências incompletas: ${incompletos.map((i) => `${rotuloMes(i.mes)} (sem ${i.faltam.join(" e ")})`).join("; ")}`, "O padrão do escritório é manter declaração, recibo, extrato e guia DAS em cada mês (guia e extrato só dispensados em mês sem movimento).", { sugestao: "Completar os documentos de cada mês." });
    }
    const [anoPrimeiro, mesPrimeiro] = primeiro.split("-").map(Number);
    if (!inicioObrigacoes && mesPrimeiro > 1) {
      add("info", "Simples Nacional", `A primeira competência na pasta é ${rotuloMes(primeiro)}`, `Não há registro de ${mesesEntre(chaveMes(anoPrimeiro, 1), mesAnterior(new Date(Date.UTC(anoPrimeiro, mesPrimeiro - 1, 1)))).map(rotuloMes).join(", ")}. Se a empresa já era optante nesses meses, faltam documentos.`, { sugestao: "Confirmar a data de opção pelo Simples (informe o início das obrigações na análise)." });
    }
    // Comprovantes de pagamento
    const bancos = subFiscal("BANCOS E COMPROVANTES");
    const guiasVencidas = listaMeses.filter((r) => r.vencimento && r.vencimento < ISO(hojeUtc) && (r.valorGuia ?? 1) > 0);
    if (bancos && !arquivosPor(bancos).length && guiasVencidas.length) {
      add("atencao", "Pagamentos", `Sem comprovantes de pagamento: ${guiasVencidas.length} guia(s) do Simples já venceram e BANCOS E COMPROVANTES está vazia`, `Guias vencidas: ${guiasVencidas.map((g) => `${rotuloMes(g.mes)} (${g.vencimento.split("-").reverse().join("/")}${g.valorGuia ? `, ${brl(g.valorGuia)}` : ""})`).join("; ")}.`, { sugestao: "Anexar os comprovantes ou conferir a situação no extrato do Simples/e-CAC. A pasta não prova que a guia foi paga nem que ficou em aberto." });
    }
    // Valor da guia x débito declarado
    for (const r of listaMeses) {
      if (r.debito !== null && r.valorGuia !== null && Math.abs(r.debito - r.valorGuia) > 0.05) {
        add("atencao", "Simples Nacional", `Guia de ${rotuloMes(r.mes)} não bate com o débito declarado`, `Débito declarado ${brl(r.debito)} × guia ${brl(r.valorGuia)}.`, { sugestao: "Conferir se a guia é de uma retificação ou se o arquivo é de outro período." });
      }
    }
    // DEFIS
    const anoPassado = hojeUtc.getUTCFullYear() - 1;
    const tevePgdasAnoPassado = listaMeses.some((r) => r.mes.startsWith(String(anoPassado)));
    if (tevePgdasAnoPassado && hojeUtc >= new Date(Date.UTC(hojeUtc.getUTCFullYear(), 3, 1))) {
      const temDefis = arquivos.some((a) => /defis/i.test(a.caminho));
      if (!temDefis) add("atencao", "Simples Nacional", `DEFIS ${anoPassado} não localizada`, `Há competências de ${anoPassado} no Simples e o prazo da DEFIS (31/03) já passou.`, { sugestao: "Anexar o recibo da DEFIS ou registrar por que não era devida." });
    }
  } else if (regimeDetectado === "SIMPLES" && pastaSimples) {
    add("atencao", "Simples Nacional", "Nenhuma competência do Simples identificada", "A pasta existe, mas não há arquivos em subpastas de mês.", { sugestao: "Organizar por MM.AAAA." });
  }

  // 6) Parcelamentos ------------------------------------------------------
  const pastaParc = subFiscal("- PARCELAMENTOS - GUIAS E RELATORIOS");
  const parcelamentos = [];
  if (pastaParc) {
    const filhos = pastas.filter((p) => p.startsWith(`${pastaParc}/`) && !p.slice(pastaParc.length + 1).includes("/"));
    for (const pasta of filhos) {
      const nome = pasta.slice(pastaParc.length + 1);
      if (!/^pcto/i.test(nome)) continue;
      const mesesP = new Set();
      let parcelaMax = null;
      for (const a of arquivosPor(pasta)) {
        const m = mesDoCaminho(partes(a.caminho), nomeArquivo(a.caminho));
        if (m) mesesP.add(m);
        const f = fatos[a.caminho];
        if (f?.parcela) parcelaMax = parcelaMax && parcelaMax.atual > f.parcela.atual ? parcelaMax : f.parcela;
      }
      const ordenados = [...mesesP].sort();
      const info = { pasta: nome, meses: ordenados, parcela: parcelaMax, faltando: [] };
      if (ordenados.length) {
        const ate = ordenados[ordenados.length - 1] >= mesAnterior(hojeUtc) ? ordenados[ordenados.length - 1] : mesAnterior(hojeUtc);
        info.faltando = mesesEntre(ordenados[0], ate).filter((m) => !mesesP.has(m));
        if (info.faltando.length) {
          add("atencao", "Parcelamentos", `Parcelamento “${nome}”: guia(s) não encontrada(s) em ${info.faltando.map(rotuloMes).join(", ")}`, `Há guias de ${ordenados.map(rotuloMes).join(", ")}, mas faltam meses no meio${ate > ordenados[ordenados.length - 1] ? " e/ou o mês mais recente" : ""}.`, { sugestao: "Emitir a guia do mês e anexar o comprovante de pagamento (parcela em atraso gera juros e pode levar à rescisão do parcelamento)." });
        }
      } else {
        add("info", "Parcelamentos", `Parcelamento “${nome}” sem subpastas de mês`, "Não foi possível conferir a continuidade das parcelas.", { sugestao: "Organizar as guias por MM.AAAA." });
      }
      if (!/^pcto\s+\S+\s+\S+\s+\S+/i.test(nome)) {
        add("info", "Organização", `Nome fora do padrão: pasta “${nome}”`, "O modelo do escritório é: PCTO - LOCAL - IMPOSTO - NÚMERO DO PARCELAMENTO (ou ano, se não tiver).", { caminho: pasta, sugestao: "Renomear, por exemplo: PCTO RFB SIMPLES NACIONAL 5." });
      }
      if (/mei/i.test(nome) && regimeDetectado === "SIMPLES") {
        add("info", "Parcelamentos", `Parcelamento de MEI em empresa do Simples Nacional: “${nome}”`, "O CNPJ tem parcelamento do período em que foi MEI. Conferir se a empresa já foi desenquadrada do SIMEI e se todas as parcelas estão sendo pagas.", { caminho: pasta });
      }
      parcelamentos.push(info);
    }
  }

  // 7) Notas fiscais x receita ----------------------------------------------
  const pastaNf = subFiscal("NOTAS FISCAIS");
  if (pastaNf) {
    const porMes = new Map();
    let notas = 0;
    for (const a of arquivosPor(pastaNf)) {
      const f = fatos[a.caminho];
      if (f?.ehNota && f.mes) {
        notas += 1;
        porMes.set(f.mes, (porMes.get(f.mes) || 0) + (f.valor || 0));
      } else if (!/\.xml$/i.test(a.caminho) && /\.pdf$/i.test(a.caminho)) {
        // PDF da mesma nota (par do XML) não conta como nota separada.
      }
    }
    const comReceita = listaMeses.filter((r) => (r.receita || 0) > 0);
    const semNota = comReceita.filter((r) => !porMes.has(r.mes));
    const xmlLidos = [...Object.values(fatos)].some((f) => f?.ehNota);
    if (comReceita.length && !arquivosPor(pastaNf).length) {
      add("atencao", "Notas fiscais", "Pasta NOTAS FISCAIS vazia, mas há receita declarada no PGDAS-D", `Receita declarada em ${comReceita.map((r) => `${rotuloMes(r.mes)} (${brl(r.receita)})`).join("; ")}.`, { sugestao: "Anexar as notas fiscais (XML e PDF) que sustentam a receita declarada." });
    } else if (comReceita.length && xmlLidos && semNota.length) {
      const total = semNota.reduce((a, r) => a + (r.receita || 0), 0);
      add("atencao", "Notas fiscais", `Receita declarada sem nota fiscal na pasta: ${semNota.map((r) => rotuloMes(r.mes)).join(", ")}`, `${brl(total)} declarados no PGDAS-D nesses meses, sem XML de nota na pasta.`, { sugestao: "Anexar as notas ou documentar a origem da receita (ex.: exportação de serviços, nota emitida em outro sistema)." });
    }
    for (const [mes, valor] of porMes) {
      const reg = meses.get(mes);
      if (!reg && regimeDetectado === "SIMPLES") {
        add("atencao", "Notas fiscais", `Nota fiscal de ${rotuloMes(mes)} (${brl(valor)}) sem PGDAS-D desse mês na pasta`, "Há nota emitida em um mês cuja declaração do Simples não está na pasta.", { sugestao: "Conferir em que competência essa receita foi declarada (a receita é por competência/emissão)." });
      } else if (reg && reg.receita !== null && Math.abs(reg.receita - valor) > 1) {
        add("atencao", "Notas fiscais", `Notas de ${rotuloMes(mes)} (${brl(valor)}) não batem com a receita declarada (${brl(reg.receita)})`, "A soma das notas na pasta difere da receita do PGDAS-D.", { sugestao: "Conferir se faltam notas na pasta ou se a receita foi declarada a maior/menor." });
      }
    }
    if (notas === 0 && arquivosPor(pastaNf).length && !xmlLidos) {
      add("info", "Notas fiscais", "Conteúdo das notas não foi lido", "Só há PDFs ou os XMLs não puderam ser lidos, então o confronto com a receita não foi feito.");
    }
  }

  // 8) CNPJ dos documentos ---------------------------------------------------
  const contagem = new Map();
  const cnpjPorArquivo = new Map();
  for (const [caminho, f] of Object.entries(fatos)) {
    const lista = f?.cnpjs || (f?.cnpjEmitente ? [f.cnpjEmitente] : []);
    if (!lista.length) continue;
    const topoDoc = partes(caminho)[0] || "";
    if (normalizar(topoDoc) === normalizar(PADRAO_PASTAS.topo[2].nome)) continue; // docs dos sócios
    const principal = lista[0];
    cnpjPorArquivo.set(caminho, principal);
    if (/pgdasd|das|simples|recibo|declara/i.test(caminho) || f.ehNota) {
      const raiz = principal.slice(0, 8);
      contagem.set(raiz, (contagem.get(raiz) || 0) + 1);
    }
  }
  let cnpjEsperado = "";
  if (contagem.size) cnpjEsperado = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0][0];
  if (cnpjEsperado) {
    const outros = [...cnpjPorArquivo.entries()].filter(([, c]) => c.slice(0, 8) !== cnpjEsperado);
    for (const [caminho, c] of outros) {
      add("critico", "Pasta do cliente", `Documento de outro CNPJ na pasta: ${nomeArquivo(caminho)}`, `O documento é do CNPJ ${c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}, diferente do cliente (raiz ${cnpjEsperado.replace(/^(\d{2})(\d{3})(\d{3})$/, "$1.$2.$3")}).`, { caminho, sugestao: "Mover para a pasta do cliente correto." });
    }
  }

  // 9) Arquivos no lugar errado -----------------------------------------------
  for (const a of arquivos) {
    const nome = nomeArquivo(a.caminho);
    const alvo = normalizar(a.caminho);
    for (const d of PADRAO_PASTAS.destinos) {
      if (!d.re.test(nome)) continue;
      const pastaOk = normalizar(d.pasta);
      // Já está em uma pasta compatível? (qualquer ancestral com o nome-alvo)
      if (alvo.includes(pastaOk)) break;
      if (d.pasta === "DECL. SPED" && /sped/.test(alvo)) break;
      if (/pcto|parcelamento/.test(alvo) && /pgdas|simples nacional|das|recibo/i.test(nome)) break;
      if (d.pasta === "CNDS e RELATORIOS" && /extrato fiscal/i.test(nome) && /relatorios/.test(alvo)) break;
      if (d.pasta === "DECL. SIMPLES NACIONAL E GUIA" && /^ExibirDAS/i.test(nome)) break; // guias de parcelamento ficam em PCTO
      if (d.pasta === "DECL. SIMPLES NACIONAL E GUIA" && /parcel|pcto/i.test(alvo)) break;
      const sensivel = d.pasta === "DOCS DOS SOCIOS";
      add(sensivel ? "atencao" : "atencao", "Arquivo no lugar errado", `${nome} deveria estar em ${d.pasta}`, `É ${d.rotulo}, mas está em “${partes(a.caminho).slice(0, -1).join(" / ") || "raiz do cliente"}”.${sensivel ? " Contém dados pessoais do sócio." : ""}`, { caminho: a.caminho, sugestao: `Mover para ${d.pasta}.` });
      break;
    }
  }

  // 10) Pastas vazias relevantes ------------------------------------------------
  if (temPastasVazias && fiscal) {
    const exigePorRegime = {
      "DASN-SIMEI": regimeDetectado === "MEI",
      "DECL. DCTF MENSAL": ["PRESUMIDO", "REAL"].includes(regimeDetectado),
      "DARF MENSAL - GUIAS": ["PRESUMIDO", "REAL"].includes(regimeDetectado),
      "DECL. SPED CONTABIL": ["PRESUMIDO", "REAL"].includes(regimeDetectado),
      "DECL. SPED CONTRIBUIÇÕES - PIS-COFINS": ["REAL"].includes(regimeDetectado),
      "LIVROS CONTABEIS": ["PRESUMIDO", "REAL"].includes(regimeDetectado),
    };
    const vazias = [];
    for (const sub of PADRAO_PASTAS.topo[3].subpastas) {
      const caminho = achaPasta(sub, fiscal);
      if (!caminho || arquivosPor(caminho).length) continue;
      vazias.push(sub);
      if (exigePorRegime[sub]) add("atencao", "Pastas vazias", `Pasta vazia, mas esperada para o regime: ${sub}`, `No regime ${regimeDetectado.toLowerCase()} esta obrigação costuma existir.`, { caminho, sugestao: "Anexar os documentos ou registrar que não há obrigação no período." });
    }
    if (vazias.length) add("info", "Pastas vazias", `${vazias.length} pasta(s) padrão vazia(s) em DOCS FISCAL-CONTABIL`, `${vazias.join(", ")}. Confirme em cada caso se a obrigação existe para este cliente.`, { sugestao: "Se não se aplica, registrar “não aplicável” (ex.: um arquivo .txt) para a IA não alertar de novo." });
  }

  // 11) DCTFWeb ------------------------------------------------------------------
  const pas = [...Object.values(fatos)].filter((f) => f?.ehDctfWeb && f.pa).map((f) => f.pa).sort();
  if (pas.length) {
    const unicos = [...new Set(pas)];
    const faltando = mesesEntre(unicos[0], mesAnterior(hojeUtc)).filter((m) => !unicos.includes(m));
    if (faltando.length) {
      add("info", "DCTFWeb", `Recibos de DCTFWeb só de ${unicos.map(rotuloMes).join(", ")}`, `Não há recibo para ${faltando.map(rotuloMes).join(", ")}. Se a empresa tem eSocial/EFD-Reinf ou retenções, a entrega mensal é obrigatória; caso contrário, pode não haver obrigação.`, { sugestao: "Confirmar a obrigatoriedade e anexar os recibos na pasta DECL. DCTF MENSAL." });
    }
  }

  // 12) Arquivos ilegíveis ------------------------------------------------------------
  const falhas = Object.entries(fatos).filter(([, f]) => f && f.erro);
  const ilegiveis = Object.entries(fatos).filter(([, f]) => f && f.legivel === false && !f.erro).map(([c]) => nomeArquivo(c));
  if (falhas.length) {
    add("atencao", "Leitura dos documentos", `${falhas.length} arquivo(s) não puderam ser baixados/lidos — o resultado pode estar incompleto`, `${falhas.slice(0, 5).map(([c, f]) => `${nomeArquivo(c)} (${f.erro})`).join("; ")}${falhas.length > 5 ? "…" : ""}`, { sugestao: "Rode a auditoria novamente só para este cliente. Se persistir, o motivo acima mostra o que o Drive respondeu." });
  }
  if (ilegiveis.length) {
    add("info", "Leitura dos documentos", `${ilegiveis.length} PDF(s) sem texto (digitalizados) não puderam ser conferidos`, ilegiveis.slice(0, 8).join(", ") + (ilegiveis.length > 8 ? "…" : ""), { sugestao: "Se for importante validar o conteúdo, salve versões em PDF com texto (baixadas do portal) ou ative leitura por OCR." });
  }

  // 13) Série de Simples + extrato fiscal -------------------------------------------------
  const opcoes = Object.values(fatos).find((f) => f?.opcoesSimples)?.opcoesSimples || null;

  achados.sort((a, b) => SEV[a.severidade] - SEV[b.severidade]);
  const resumo = {
    critico: achados.filter((a) => a.severidade === "critico").length,
    atencao: achados.filter((a) => a.severidade === "atencao").length,
    info: achados.filter((a) => a.severidade === "info").length,
  };
  const saude = Math.round(100 * Math.exp(-(resumo.critico * 0.25 + resumo.atencao * 0.05 + Math.min(resumo.info, 10) * 0.01)));



  // Inventário documento a documento: o que é, de quando é e se está válido.
  const dmy = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
  const classificarDoc = (a) => {
    const nome = nomeArquivo(a.caminho);
    const alvo = normalizar(a.caminho);
    const f = fatos[a.caminho] || {};
    const ext = (nome.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() || "";
    const doc = { nome, caminho: a.caminho, ext, tamanho: a.tamanho || 0, alteradoEm: a.modificadoEm ? new Date(a.modificadoEm).toISOString().slice(0, 10) : "", tipo: "Documento", competencia: "", validade: "", situacao: "sem_prazo", detalhe: "" };
    const mes = mesDoCaminho(partes(a.caminho), nome) || paDoNomePgdas(nome) || f.pa || "";
    if (mes) doc.competencia = mes;
    const certidao = /\b(cnd|cpen)\b|certidao/.test(alvo) && /\.pdf$/i.test(nome) && !/extrato fiscal/i.test(nome);
    if (certidao) {
      const nivelCnd = /estadual/.test(alvo) ? "estadual" : /municipal/.test(alvo) ? "municipal" : /federal|rfb|pgfn/.test(alvo) ? "federal" : "";
      doc.tipo = `Certidão negativa${nivelCnd ? ` ${nivelCnd}` : ""}`;
      let val = null;
      const mNome = nome.match(/vcto[^\d]*(\d{2}[.\-/]\d{2}[.\-/]\d{4})/i);
      if (mNome) val = parseDataBr(mNome[1]);
      if (!val && f.validade) val = parseDataBr(dmy(f.validade));
      if (val) {
        doc.validade = ISO(val);
        const dias = diasEntre(hojeUtc, val);
        if (dias < 0) { doc.situacao = "vencido"; doc.detalhe = `Venceu em ${dmy(doc.validade)} (há ${-dias} dia(s))`; }
        else if (dias <= 30) { doc.situacao = "vence_em_breve"; doc.detalhe = `Vence em ${dmy(doc.validade)} (${dias} dia(s))`; }
        else { doc.situacao = "valido"; doc.detalhe = `Válida até ${dmy(doc.validade)} (${dias} dias)`; }
      } else if (f.legivel === false) { doc.situacao = "nao_lido"; doc.detalhe = f.erro ? `Não foi possível ler (${f.erro})` : "PDF digitalizado: validade não pôde ser lida"; }
      else { doc.situacao = "sem_validade"; doc.detalhe = "Validade não identificada (inclua “VCTO dd.mm.aaaa” no nome)"; }
    } else if (/extrato fiscal/i.test(nome)) {
      doc.tipo = "Extrato fiscal / situação fiscal"; doc.detalhe = doc.alteradoEm ? `Arquivo de ${dmy(doc.alteradoEm)}` : "Relatório sem prazo de validade";
    } else if (/\.(pfx|p12)$/i.test(nome)) {
      doc.tipo = "Certificado digital";
      const val = parseDataBr(nome);
      if (val) {
        doc.validade = ISO(val);
        const dias = diasEntre(hojeUtc, val);
        doc.situacao = dias < 0 ? "vencido" : dias <= 60 ? "vence_em_breve" : "valido";
        doc.detalhe = dias < 0 ? `Venceu em ${dmy(doc.validade)} (há ${-dias} dia(s))` : `Válido até ${dmy(doc.validade)} (${dias} dias)`;
      } else { doc.situacao = "sem_validade"; doc.detalhe = "Validade não consta no nome do arquivo"; }
    } else if (/\.xml$/i.test(nome) && f.ehNota) {
      doc.tipo = "Nota fiscal (XML)"; doc.competencia = f.mes || doc.competencia;
      doc.detalhe = `Emitida em ${rotuloMes(f.mes)}${f.valor ? ` · ${brl(f.valor)}` : ""}`;
    } else if (/\.xml$/i.test(nome)) { doc.tipo = "XML"; doc.detalhe = "Conteúdo não reconhecido como nota"; }
    else if (/pcto|parcelamento/.test(alvo) && /\.pdf$/i.test(nome) && (f.ehParcelamento || f.parcela || /exibirdas/i.test(nome))) {
      doc.tipo = "Guia de parcelamento";
      doc.detalhe = [f.parcela ? `Parcela ${f.parcela.atual}/${f.parcela.total}` : "", f.vencimento ? `vence ${dmy(f.vencimento)}` : "", f.valorGuia ? brl(f.valorGuia) : ""].filter(Boolean).join(" · ");
    } else if (tipoDocSimples(nome) !== "outro" || f.ehGuiaSimples) {
      const t = tipoDocSimples(nome);
      doc.tipo = ({ declaracao: "PGDAS-D — declaração", recibo: "PGDAS-D — recibo", extrato: "PGDAS-D — extrato", das: "Guia DAS" })[t] || "Documento do Simples";
      const partesDet = [doc.competencia ? `Competência ${rotuloMes(doc.competencia)}` : "", f.receita !== undefined && f.receita !== null ? `receita ${brl(f.receita)}` : "", f.debitoDeclarado !== undefined && f.debitoDeclarado !== null ? `débito ${brl(f.debitoDeclarado)}` : "", f.vencimento ? `vence ${dmy(f.vencimento)}` : "", f.valorGuia ? brl(f.valorGuia) : ""].filter(Boolean);
      doc.detalhe = partesDet.join(" · ");
      if (t === "das" || f.ehGuiaSimples) {
        if (f.vencimento && f.vencimento < ISO(hojeUtc)) { doc.situacao = "aviso"; doc.detalhe += " — vencimento já passou, confirme o pagamento"; }
      }
    } else if (f.ehDctfWeb || /dctf/i.test(nome)) { doc.tipo = "Recibo DCTFWeb"; doc.detalhe = f.pa ? `Competência ${rotuloMes(f.pa)}` : ""; }
    else if (/irpf/i.test(nome)) { doc.tipo = "IRPF do sócio"; }
    else if (/cnpj/i.test(nome) && !/\.pdf$/i.test("x")) { doc.tipo = "Cartão CNPJ"; }
    else if (/cart[aã]o cnpj|comprovante.*inscri/i.test(nome) || /^cnpj/i.test(nome)) { doc.tipo = "Cartão CNPJ"; }
    else if (/qsa/i.test(nome)) { doc.tipo = "QSA"; }
    else if (/altera[cç][aã]o|contrato social|consolida/i.test(nome)) { doc.tipo = "Contrato social / alteração"; }
    else if (/inscri[cç][aã]o/i.test(nome)) { doc.tipo = "Inscrição cadastral"; }
    else if (/acesso|senha/i.test(nome) && /\.(txt|docx?|xlsx?)$/i.test(nome)) { doc.tipo = "Arquivo de acesso"; }
    if (doc.situacao === "sem_prazo" && /\.pdf$/i.test(nome)) {
      if (f.erro) { doc.situacao = "nao_lido"; doc.detalhe = `Não foi possível ler (${f.erro})`; }
      else if (f.legivel === false) { doc.situacao = "nao_lido"; doc.detalhe = doc.detalhe || "PDF digitalizado (sem texto): conteúdo não conferido"; }
      else if (!fatos[a.caminho]) { doc.situacao = "nao_lido"; doc.detalhe = doc.detalhe || "Conteúdo não lido nesta análise"; }
    }
    if (f.vencimento) doc.vencimento = f.vencimento;
    if (f.valorGuia !== undefined && f.valorGuia !== null) doc.valor = f.valorGuia;
    const alertas = achados.filter((x) => x.caminho === a.caminho);
    if (alertas.length) {
      doc.alertas = alertas.map((x) => ({ severidade: x.severidade, titulo: x.titulo }));
      if (doc.situacao === "sem_prazo" || doc.situacao === "valido") doc.situacao = "aviso";
    }
    return doc;
  };
  const ORDEM_SIT = { vencido: 0, vence_em_breve: 1, aviso: 2, nao_lido: 3, sem_validade: 4, valido: 5, sem_prazo: 6 };
  const docsDe = (lista) => lista.map(classificarDoc).sort((x, y) => (ORDEM_SIT[x.situacao] - ORDEM_SIT[y.situacao]) || x.caminho.localeCompare(y.caminho)).slice(0, 400);

  // Análise pasta a pasta (padrão + subpastas).
  const regimeChave = ["SIMPLES", "MEI", "PRESUMIDO", "REAL"].includes(regimeDetectado) ? regimeDetectado : "SIMPLES";
  const sevDe = (ids) => (ids.some((a) => a.severidade === "critico") ? "critico" : ids.some((a) => a.severidade === "atencao") ? "atencao" : ids.length ? "info" : "ok");
  const listaPastasPadrao = [];
  const noDe = (nomePadrao, caminho, nivel, topoNome) => {
    const guia = GUIA_PASTAS[nomePadrao] || { conteudo: "", r: {} };
    const existe = !!caminho;
    const dentro = existe ? arquivosPor(caminho) : [];
    const diretos = existe ? dentro.filter((a) => partes(a.caminho).length === partes(caminho).length + 1) : [];
    const filhas = existe ? pastas.filter((p) => p.startsWith(`${caminho}/`) && !p.slice(caminho.length + 1).includes("/")) : [];
    const datas = dentro.map((a) => Number(new Date(a.modificadoEm || 0))).filter((n) => n > 0);
    const obrigacao = guia.r[regimeChave] || "pos";
    const relacionados = achados.filter((a) => {
      if (a.caminho && existe && (a.caminho === caminho || a.caminho.startsWith(`${caminho}/`))) return true;
      const alvo = CATEGORIA_PARA_PASTA[a.categoria];
      if (alvo === nomePadrao) return true;
      if (a.categoria === "Segurança" && nomePadrao === "DOCS DA EMPRESA" && /certificado|pfx/i.test(a.titulo)) return true;
      if (a.categoria === "Segurança" && !a.caminho?.includes("/") && nivel === 0 && nomePadrao === "DOCS DA EMPRESA") return false;
      if (nomePadrao.startsWith("DECL. SPED") && /sped/i.test(a.titulo) && !a.caminho) return false;
      return false;
    });
    let status;
    if (!existe) status = obrigacao === "esp" ? "ausente" : "ausente_ok";
    else if (!dentro.length) status = obrigacao === "esp" ? "vazia_esperada" : obrigacao === "pos" ? "vazia_verificar" : "vazia_ok";
    else status = "ok";
    return {
      nome: nomePadrao, nivel, topo: topoNome, caminho: caminho || "", existe, obrigacao, conteudoEsperado: guia.conteudo, status,
      arquivos: dentro.length, diretos: diretos.length,
      subpastas: filhas.map((f) => ({ nome: f.slice(caminho.length + 1), arquivos: arquivosPor(f).length })),
      documentos: docsDe(nivel === 0 ? diretos : dentro),
      resumoDocs: (() => { const l = (nivel === 0 ? diretos : dentro).map(classificarDoc); return { validos: l.filter((d) => d.situacao === "valido").length, vencidos: l.filter((d) => d.situacao === "vencido").length, vencendo: l.filter((d) => d.situacao === "vence_em_breve").length, naoLidos: l.filter((d) => d.situacao === "nao_lido").length }; })(),
      ultimaAlteracao: datas.length ? new Date(Math.max(...datas)).toISOString().slice(0, 10) : "",
      gravidade: sevDe(relacionados),
      achadoIds: relacionados.map((a) => a.id),
    };
  };
  for (const t of PADRAO_PASTAS.topo) {
    listaPastasPadrao.push(noDe(t.nome, topo[t.chave], 0, t.nome));
    if (t.chave === "empresa" && topo.empresa) {
      // certificado digital é subpasta específica
    }
    for (const sub of t.subpastas) listaPastasPadrao.push(noDe(sub, topo[t.chave] ? achaPasta(sub, topo[t.chave]) : undefined, 1, t.nome));
  }
  const nomesTopo = new Set(PADRAO_PASTAS.topo.map((t) => normalizar(topo[t.chave] || t.nome)));
  const fora = arquivos.filter((a) => { const p = partes(a.caminho); return p.length === 1 || !nomesTopo.has(normalizar(p[0])); });
  if (fora.length) {
    const rel = achados.filter((a) => fora.some((x) => x.caminho === a.caminho));
    listaPastasPadrao.push({ nome: "Fora do padrão (raiz e pastas extras)", nivel: 0, topo: "", caminho: "", existe: true, obrigacao: "pos", conteudoEsperado: "Arquivos que não estão em nenhuma das 4 pastas padrão. O ideal é mover cada um para a pasta correta.", status: "ok", arquivos: fora.length, diretos: fora.length, subpastas: [], documentos: docsDe(fora), resumoDocs: { validos: 0, vencidos: 0, vencendo: 0, naoLidos: 0 }, ultimaAlteracao: "", gravidade: sevDe(rel), achadoIds: rel.map((a) => a.id) });
  }
  const arvore = listaPastasPadrao;

  // Inventário por pasta.
  const inventario = [];
  for (const t of PADRAO_PASTAS.topo) {
    const base = topo[t.chave];
    if (!base) { inventario.push({ pasta: t.nome, arquivos: 0, existe: false }); continue; }
    inventario.push({ pasta: t.nome, arquivos: arquivosPor(base).length, existe: true });
  }

  return {
    cliente: { codigo: cliente?.codigo || "", nome: cliente?.nome || "", raiz: cliente?.raiz || "" },
    geradoEm: hojeUtc.toISOString(),
    regime: regimeDetectado,
    cnpj: cnpjEsperado ? cnpjEsperado : "",
    totalArquivos: arquivos.length,
    resumo,
    saude,
    achados,
    meses: tabelaMeses,
    parcelamentos,
    inventario,
    arvore,
    opcoesSimples: opcoes,
  };
}

// Resumo enxuto (sem nomes de arquivo pessoais, sem CPF) para a camada de IA.
export function resumoParaIa(auditoria) {
  const a = auditoria || {};
  return {
    cliente: a.cliente?.nome || "",
    regime: a.regime,
    saude: a.saude,
    totais: a.resumo,
    achados: (a.achados || []).slice(0, 40).map((x) => ({ severidade: x.severidade, categoria: x.categoria, titulo: x.titulo, detalhe: x.detalhe })),
    competenciasSimples: (a.meses || []).map((m) => ({ mes: m.rotulo, situacao: m.situacao, receita: m.receita, debito: m.debito, semMovimento: !!m.semMovimento })),
    parcelamentos: (a.parcelamentos || []).map((p) => ({ pasta: p.pasta, meses: p.meses, faltando: p.faltando, parcela: p.parcela })),
    opcoesSimples: a.opcoesSimples,
    inventario: a.inventario,
  };
}


// Versão compacta de uma auditoria para o painel (todas as empresas de uma vez).
const RE_FALTA = /n[aã]o localizad|n[aã]o encontrad|ausente|sem comprovantes|sem declara|sem documentos|vazia|incompleta|sem nota|sem pgdas|nenhum documento|sem nota fiscal/i;
export function resumoPainel(a) {
  const out = {
    codigo: a?.cliente?.codigo || "", nome: a?.cliente?.nome || "", regime: a?.regime || "", saude: a?.saude ?? 0,
    resumo: a?.resumo || { critico: 0, atencao: 0, info: 0 }, geradoEm: a?.geradoEm || "", totalArquivos: a?.totalArquivos || 0, driveId: a?.cliente?.driveId || "",
    achados: (a?.achados || []).slice(0, 80).map((x) => ({ severidade: x.severidade, categoria: x.categoria, titulo: x.titulo, sugestao: x.sugestao || "", falta: RE_FALTA.test(x.titulo) })),
    vencimentos: [], pastasPendentes: [],
  };
  for (const n of a?.arvore || []) {
    if (n.status === "vazia_esperada" || n.status === "ausente") out.pastasPendentes.push({ nome: n.nome, status: n.status });
    for (const d of n.documentos || []) {
      if (/^Certid/.test(d.tipo) || d.tipo === "Certificado digital") {
        out.vencimentos.push({ categoria: d.tipo === "Certificado digital" ? "Certificado digital" : "Certidão", tipo: d.tipo, nome: d.nome, pasta: n.nome, data: d.validade || "", situacao: d.situacao, detalhe: d.detalhe });
      } else if (/^Guia/.test(d.tipo) && d.vencimento && String(d.vencimento).slice(0, 10) >= String(a.geradoEm || "").slice(0, 10)) {
        out.vencimentos.push({ categoria: "Guia a vencer", tipo: d.tipo, nome: d.nome, pasta: n.nome, data: d.vencimento, situacao: "guia", detalhe: [d.competencia ? `Competência ${d.competencia.slice(5, 7)}/${d.competencia.slice(0, 4)}` : "", d.valor ? brl(d.valor) : ""].filter(Boolean).join(" · ") });
      }
    }
  }
  // Para cada tipo de certidão/certificado, só a mais recente conta (as antigas foram substituídas).
  const porTipo = new Map();
  const resto = [];
  for (const v of out.vencimentos) {
    if (v.categoria === "Guia a vencer") { resto.push(v); continue; }
    const k = v.tipo;
    const atual = porTipo.get(k);
    if (!atual || (v.data && (!atual.data || v.data > atual.data))) porTipo.set(k, v);
  }
  out.vencimentos = [...porTipo.values(), ...resto];
  return out;
}
