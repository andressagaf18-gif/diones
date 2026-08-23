import { neon } from "@neondatabase/serverless";
import { put, del } from "@vercel/blob";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import crypto from "crypto";
import { usuarioAutenticado } from "../api/lib/auth.js";

const sql = neon(process.env.DATABASE_URL);

let schemaPromise = null;

const MAX_ARQUIVO_BYTES =
  3 * 1024 * 1024;

const MAX_TEXTO_DOCUMENTO =
  120000;

const MAX_TEXTO_ANALISE =
  50000;

// =========================================================
// HELPERS
// =========================================================

function txt(valor, limite = 1000) {
  return String(valor ?? "")
    .trim()
    .slice(0, limite);
}

function usuario(req) {
  return usuarioAutenticado(req);
}

function jsonSeguro(valor, fallback = null) {
  try {
    return JSON.parse(
      JSON.stringify(valor)
    );
  } catch {
    return fallback;
  }
}

function gerarId(prefixo) {
  return `${prefixo}_${crypto.randomUUID()}`;
}

function nomeSeguro(nome = "") {
  return String(nome || "documento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 150);
}

function bufferBase64(base64) {
  const valor =
    String(base64 || "")
      .replace(
        /^data:[^;]+;base64,/,
        ""
      )
      .trim();

  return Buffer.from(
    valor,
    "base64"
  );
}

function extensao(nome = "") {
  const partes =
    String(nome)
      .toLowerCase()
      .split(".");

  return partes.length > 1
    ? partes.pop()
    : "";
}

function tipoDocumentoValido(valor) {
  const permitidos = [
    "CONTRATO",
    "BALANCETE",
    "DRE",
    "EXTRATO",
    "NOTA_FISCAL",
    "FOLHA",
    "CONTRATO_SOCIAL",
    "RELATORIO_FISCAL",
    "PARCELAMENTO",
    "CERTIDAO",
    "SOCIETARIO",
    "TRIBUTARIO",
    "FINANCEIRO",
    "OUTRO",
  ];

  const tipo =
    txt(
      valor ||
      "OUTRO",
      60
    ).toUpperCase();

  return permitidos.includes(tipo)
    ? tipo
    : "OUTRO";
}

async function schema() {
  if (!schemaPromise) {
    schemaPromise =
      (async () => {
        await sql`
          CREATE TABLE IF NOT EXISTS
            crm_documentos_cliente (
              id TEXT PRIMARY KEY,
              lead_id TEXT NOT NULL DEFAULT '',
              diagnostico_id TEXT NOT NULL DEFAULT '',
              atendimento_id TEXT NOT NULL DEFAULT '',
              cliente_cnpj TEXT NOT NULL DEFAULT '',
              nome_arquivo TEXT NOT NULL,
              tipo_documento TEXT NOT NULL DEFAULT 'OUTRO',
              mime_type TEXT NOT NULL DEFAULT '',
              tamanho_bytes INTEGER NOT NULL DEFAULT 0,
              blob_url TEXT NOT NULL DEFAULT '',
              blob_pathname TEXT NOT NULL DEFAULT '',
              status_analise TEXT NOT NULL DEFAULT 'AGUARDANDO_ANALISE',
              texto_extraido TEXT NOT NULL DEFAULT '',
              texto_extraido_chars INTEGER NOT NULL DEFAULT 0,
              observacoes TEXT NOT NULL DEFAULT '',
              anexado_por_id TEXT NOT NULL DEFAULT '',
              anexado_por_nome TEXT NOT NULL DEFAULT '',
              metadados JSONB NOT NULL DEFAULT '{}'::jsonb,
              criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `;

        await sql`
          CREATE INDEX IF NOT EXISTS
            idx_crm_documentos_cliente_atendimento
          ON crm_documentos_cliente (
            atendimento_id,
            criado_em DESC
          )
        `;

        await sql`
          CREATE INDEX IF NOT EXISTS
            idx_crm_documentos_cliente_lead
          ON crm_documentos_cliente (
            lead_id,
            criado_em DESC
          )
        `;

        await sql`
          CREATE TABLE IF NOT EXISTS
            crm_analises_documentais (
              id TEXT PRIMARY KEY,
              lead_id TEXT NOT NULL DEFAULT '',
              diagnostico_id TEXT NOT NULL DEFAULT '',
              atendimento_id TEXT NOT NULL DEFAULT '',
              documentos_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
              tipo_analise TEXT NOT NULL DEFAULT 'PREVIA_CONSULTOR',
              resumo TEXT NOT NULL DEFAULT '',
              achados JSONB NOT NULL DEFAULT '[]'::jsonb,
              divergencias JSONB NOT NULL DEFAULT '[]'::jsonb,
              riscos JSONB NOT NULL DEFAULT '[]'::jsonb,
              pontos_validacao JSONB NOT NULL DEFAULT '[]'::jsonb,
              oportunidades JSONB NOT NULL DEFAULT '[]'::jsonb,
              dados_faltantes JSONB NOT NULL DEFAULT '[]'::jsonb,
              confianca TEXT NOT NULL DEFAULT 'MEDIA',
              resposta_completa JSONB NOT NULL DEFAULT '{}'::jsonb,
              gerado_por_id TEXT NOT NULL DEFAULT '',
              gerado_por_nome TEXT NOT NULL DEFAULT '',
              criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `;

        await sql`
          CREATE INDEX IF NOT EXISTS
            idx_crm_analises_documentais_atendimento
          ON crm_analises_documentais (
            atendimento_id,
            criado_em DESC
          )
        `;
      })();
  }

  return schemaPromise;
}

// =========================================================
// EXTRAÇÃO DE TEXTO
// =========================================================

async function extrairTexto({
  buffer,
  nomeArquivo,
  mimeType,
}) {
  const ext =
    extensao(
      nomeArquivo
    );

  try {
    if (
      mimeType ===
        "application/pdf" ||
      ext === "pdf"
    ) {
      const resultado =
        await pdf(buffer);

      return txt(
        resultado?.text ||
        "",
        MAX_TEXTO_DOCUMENTO
      );
    }

    if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === "docx"
    ) {
      const resultado =
        await mammoth
          .extractRawText({
            buffer,
          });

      return txt(
        resultado?.value ||
        "",
        MAX_TEXTO_DOCUMENTO
      );
    }

    if (
      [
        "xlsx",
        "xls",
      ].includes(ext)
    ) {
      const workbook =
        XLSX.read(
          buffer,
          {
            type: "buffer",
          }
        );

      const partes = [];

      for (
        const nomeAba of
        workbook.SheetNames
      ) {
        const sheet =
          workbook.Sheets[
            nomeAba
          ];

        const csv =
          XLSX.utils
            .sheet_to_csv(
              sheet
            );

        partes.push(
          `### ABA: ${nomeAba}\n${csv}`
        );
      }

      return txt(
        partes.join(
          "\n\n"
        ),
        MAX_TEXTO_DOCUMENTO
      );
    }

    if (
      [
        "txt",
        "csv",
        "json",
        "xml",
        "md",
      ].includes(ext) ||
      String(
        mimeType ||
        ""
      ).startsWith(
        "text/"
      )
    ) {
      return txt(
        buffer.toString(
          "utf8"
        ),
        MAX_TEXTO_DOCUMENTO
      );
    }

    return "";
  } catch (error) {
    console.warn(
      "[documentos] extração falhou",
      nomeArquivo,
      error?.message ||
      error
    );

    return "";
  }
}

// =========================================================
// CONTEXTO DO CLIENTE
// =========================================================

async function contextoAtendimento(
  atendimentoId
) {
  const atendimentos =
    await sql`
      SELECT
        a.*,
        l.razao_social,
        l.nome,
        l.cnpj,
        l.origem,
        l.campanha,
        l.status_comercial,
        l.score_comercial,
        l.prioridade_comercial,
        l.temperatura_comercial,
        l.intencao,
        l.estrutura_negocio,
        l.contexto_cliente

      FROM
        crm_atendimentos_departamento a

      LEFT JOIN
        diagnostico_leads l
      ON
        l.id =
          a.lead_id

      WHERE
        a.id =
          ${atendimentoId}

      LIMIT 1
    `;

  const atendimento =
    atendimentos?.[0] ||
    null;

  if (!atendimento) {
    return null;
  }

  let diagnostico =
    null;

  if (
    atendimento
      .diagnostico_id
  ) {
    try {
      const rows =
        await sql`
          SELECT *
          FROM diagnosticos
          WHERE
            id =
              ${atendimento.diagnostico_id}
          LIMIT 1
        `;

      diagnostico =
        rows?.[0] ||
        null;
    } catch (error) {
      console.warn(
        "[documentos] diagnóstico não carregado",
        error?.message ||
        error
      );
    }
  }

  return {
    atendimento,
    diagnostico,
  };
}

// =========================================================
// OPENAI — ANÁLISE PRÉVIA
// =========================================================

function extrairOutputText(data) {
  if (
    typeof data?.output_text ===
    "string"
  ) {
    return data.output_text;
  }

  const textos = [];

  for (
    const item of
      data?.output ||
      []
  ) {
    for (
      const content of
        item?.content ||
        []
    ) {
      if (
        typeof content?.text ===
        "string"
      ) {
        textos.push(
          content.text
        );
      }
    }
  }

  return textos.join(
    "\n"
  );
}

function limparJsonResposta(texto) {
  const bruto =
    String(
      texto ||
      ""
    ).trim();

  const semFence =
    bruto
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /\s*```$/,
        ""
      )
      .trim();

  return JSON.parse(
    semFence
  );
}

async function gerarComIA({
  contexto,
  documentos,
}) {
  if (
    !process.env
      .OPENAI_API_KEY
  ) {
    throw new Error(
      "OPENAI_API_KEY não configurada."
    );
  }

  const atendimento =
    contexto
      ?.atendimento ||
    {};

  const diagnostico =
    contexto
      ?.diagnostico ||
    {};

  const textos =
    documentos
      .map(
        (doc) => ({
          id: doc.id,
          nome:
            doc.nome_arquivo,
          tipo:
            doc.tipo_documento,
          texto:
            txt(
              doc.texto_extraido,
              18000
            ),
        })
      )
      .filter(
        (doc) =>
          doc.texto
      );

  if (
    !textos.length
  ) {
    throw new Error(
      "Nenhum dos documentos possui texto extraível. Nesta versão, use PDF com texto, DOCX, XLS/XLSX, CSV, TXT, JSON ou XML."
    );
  }

  const prompt = `
Você é um analista sênior apoiando um consultor empresarial da Finder.

Sua tarefa NÃO é emitir parecer definitivo. Gere uma ANÁLISE PRÉVIA INTERNA para o consultor, cruzando:
1. o diagnóstico já realizado;
2. o contexto do lead;
3. o atendimento/departamento;
4. os documentos anexados.

Regras obrigatórias:
- Não invente números, fatos, débitos, alíquotas ou obrigações.
- Diferencie claramente "o cliente relatou" de "o documento evidencia".
- Quando houver divergência, descreva exatamente o que deve ser validado.
- Se faltarem períodos, páginas, documentos ou contexto, diga.
- Não trate amostra parcial como retrato completo da empresa.
- Aponte oportunidade comercial apenas quando houver base no material.
- A análise é interna e deve servir como preparação do consultor.
- Use linguagem técnica, prática e objetiva.
- Confiança ALTA somente quando os documentos são suficientes e coerentes.
- Retorne SOMENTE JSON válido, sem markdown.

Formato obrigatório:
{
  "resumo": "texto",
  "achados": ["..."],
  "divergencias": ["..."],
  "riscos": ["..."],
  "pontosValidacao": ["..."],
  "oportunidades": ["..."],
  "dadosFaltantes": ["..."],
  "confianca": "ALTA|MEDIA|BAIXA"
}

CONTEXTO DO ATENDIMENTO:
${JSON.stringify(
  {
    area:
      atendimento.area,
    scoreArea:
      atendimento.score_area,
    nivelArea:
      atendimento.nivel_area,
    oportunidades:
      atendimento.oportunidades,
    riscos:
      atendimento.riscos,
    recomendacoes:
      atendimento.recomendacoes,
    planoAcao:
      atendimento.plano_acao,
    orientacaoTecnica:
      atendimento.orientacao_tecnica,
    razaoSocial:
      atendimento.razao_social,
    cnpj:
      atendimento.cnpj,
    origem:
      atendimento.origem,
    statusComercial:
      atendimento.status_comercial,
    scoreComercial:
      atendimento.score_comercial,
    prioridade:
      atendimento.prioridade_comercial,
    temperatura:
      atendimento.temperatura_comercial,
    intencao:
      atendimento.intencao,
    estrutura:
      atendimento.estrutura_negocio,
    contextoCliente:
      atendimento.contexto_cliente,
  },
  null,
  2
).slice(
  0,
  20000
)}

DIAGNÓSTICO DISPONÍVEL:
${JSON.stringify(
  diagnostico,
  null,
  2
).slice(
  0,
  30000
)}

DOCUMENTOS E TEXTOS EXTRAÍDOS:
${JSON.stringify(
  textos,
  null,
  2
).slice(
  0,
  MAX_TEXTO_ANALISE
)}
`;

  const resposta =
    await fetch(
      "https://api.openai.com/v1/responses",
      {
        method:
          "POST",

        headers: {
          "content-type":
            "application/json",

          Authorization:
            `Bearer ${process.env.OPENAI_API_KEY}`,
        },

        body:
          JSON.stringify({
            model:
              process.env
                .OPENAI_DOCUMENT_MODEL ||
              "gpt-5.4-mini",

            input:
              prompt,
          }),
      }
    );

  const data =
    await resposta
      .json()
      .catch(
        () => null
      );

  if (
    !resposta.ok
  ) {
    throw new Error(
      data?.error
        ?.message ||
      "Erro ao gerar análise documental."
    );
  }

  const output =
    extrairOutputText(
      data
    );

  return limparJsonResposta(
    output
  );
}

// =========================================================
// LISTAR DOCUMENTOS
// =========================================================

async function listarDocumentos(
  req,
  res
) {
  const u =
    usuario(req);

  if (!u) {
    return res
      .status(401)
      .json({
        sucesso: false,
        error:
          "Não autorizado.",
      });
  }

  const atendimentoId =
    txt(
      req.query
        ?.atendimentoId,
      160
    );

  if (!atendimentoId) {
    return res
      .status(400)
      .json({
        sucesso: false,
        error:
          "atendimentoId é obrigatório.",
      });
  }

  const documentos =
    await sql`
      SELECT
        id,
        lead_id,
        diagnostico_id,
        atendimento_id,
        cliente_cnpj,
        nome_arquivo,
        tipo_documento,
        mime_type,
        tamanho_bytes,
        status_analise,
        texto_extraido_chars,
        observacoes,
        anexado_por_id,
        anexado_por_nome,
        criado_em,
        atualizado_em

      FROM
        crm_documentos_cliente

      WHERE
        atendimento_id =
          ${atendimentoId}

      ORDER BY
        criado_em DESC
    `;

  const analises =
    await sql`
      SELECT
        id,
        documentos_ids,
        tipo_analise,
        resumo,
        achados,
        divergencias,
        riscos,
        pontos_validacao,
        oportunidades,
        dados_faltantes,
        confianca,
        gerado_por_id,
        gerado_por_nome,
        criado_em

      FROM
        crm_analises_documentais

      WHERE
        atendimento_id =
          ${atendimentoId}

      ORDER BY
        criado_em DESC

      LIMIT 10
    `;

  return res
    .status(200)
    .json({
      sucesso: true,

      documentos:
        (documentos || [])
          .map(
            (d) => ({
              id: d.id,
              leadId:
                d.lead_id,
              diagnosticoId:
                d.diagnostico_id,
              atendimentoId:
                d.atendimento_id,
              cnpj:
                d.cliente_cnpj,
              nomeArquivo:
                d.nome_arquivo,
              tipoDocumento:
                d.tipo_documento,
              mimeType:
                d.mime_type,
              tamanhoBytes:
                d.tamanho_bytes,
              statusAnalise:
                d.status_analise,
              textoExtraidoChars:
                d.texto_extraido_chars,
              observacoes:
                d.observacoes,
              anexadoPor:
                d.anexado_por_nome,
              criadoEm:
                d.criado_em,
            })
          ),

      analises:
        (analises || [])
          .map(
            (a) => ({
              id:
                a.id,
              documentosIds:
                a.documentos_ids ||
                [],
              tipoAnalise:
                a.tipo_analise,
              resumo:
                a.resumo,
              achados:
                a.achados ||
                [],
              divergencias:
                a.divergencias ||
                [],
              riscos:
                a.riscos ||
                [],
              pontosValidacao:
                a.pontos_validacao ||
                [],
              oportunidades:
                a.oportunidades ||
                [],
              dadosFaltantes:
                a.dados_faltantes ||
                [],
              confianca:
                a.confianca,
              geradoPor:
                a.gerado_por_nome,
              criadoEm:
                a.criado_em,
            })
          ),
    });
}

// =========================================================
// UPLOAD
// =========================================================

async function uploadDocumento(
  req,
  res
) {
  const u =
    usuario(req);

  if (!u) {
    return res
      .status(401)
      .json({
        sucesso: false,
        error:
          "Não autorizado.",
      });
  }

  if (
    req.method !== "POST"
  ) {
    return res
      .status(405)
      .json({
        sucesso: false,
        error:
          "Método inválido.",
      });
  }

  if (
    !process.env
      .BLOB_READ_WRITE_TOKEN &&
    !process.env
      .VERCEL_OIDC_TOKEN
  ) {
    return res
      .status(500)
      .json({
        sucesso: false,
        error:
          "Vercel Blob ainda não está configurado no projeto.",
      });
  }

  const body =
    req.body ||
    {};

  const atendimentoId =
    txt(
      body.atendimentoId,
      160
    );

  const nomeArquivo =
    txt(
      body.nomeArquivo,
      180
    );

  const mimeType =
    txt(
      body.mimeType,
      180
    );

  const tipoDocumento =
    tipoDocumentoValido(
      body.tipoDocumento
    );

  const observacoes =
    txt(
      body.observacoes,
      2000
    );

  if (
    !atendimentoId ||
    !nomeArquivo ||
    !body.base64
  ) {
    return res
      .status(400)
      .json({
        sucesso: false,
        error:
          "atendimentoId, nomeArquivo e arquivo são obrigatórios.",
      });
  }

  const contexto =
    await contextoAtendimento(
      atendimentoId
    );

  if (!contexto) {
    return res
      .status(404)
      .json({
        sucesso: false,
        error:
          "Atendimento não encontrado.",
      });
  }

  const buffer =
    bufferBase64(
      body.base64
    );

  if (
    !buffer.length
  ) {
    return res
      .status(400)
      .json({
        sucesso: false,
        error:
          "Arquivo vazio.",
      });
  }

  if (
    buffer.length >
    MAX_ARQUIVO_BYTES
  ) {
    return res
      .status(413)
      .json({
        sucesso: false,
        error:
          "Nesta versão, cada arquivo pode ter no máximo 3 MB.",
      });
  }

  const id =
    gerarId(
      "doc"
    );

  const leadId =
    txt(
      contexto
        .atendimento
        .lead_id,
      160
    );

  const diagnosticoId =
    txt(
      contexto
        .atendimento
        .diagnostico_id,
      160
    );

  const cnpj =
    txt(
      contexto
        .atendimento
        .cnpj,
      30
    );

  const path =
    `clientes/${cnpj || leadId || "sem-cnpj"}/${atendimentoId}/${id}-${nomeSeguro(
      nomeArquivo
    )}`;

  const textoExtraido =
    await extrairTexto({
      buffer,
      nomeArquivo,
      mimeType,
    });

  const blob =
    await put(
      path,
      buffer,
      {
        access:
          "private",

        contentType:
          mimeType ||
          "application/octet-stream",

        addRandomSuffix:
          true,
      }
    );

  await sql`
    INSERT INTO
      crm_documentos_cliente (
        id,
        lead_id,
        diagnostico_id,
        atendimento_id,
        cliente_cnpj,
        nome_arquivo,
        tipo_documento,
        mime_type,
        tamanho_bytes,
        blob_url,
        blob_pathname,
        status_analise,
        texto_extraido,
        texto_extraido_chars,
        observacoes,
        anexado_por_id,
        anexado_por_nome,
        metadados
      )

    VALUES (
      ${id},
      ${leadId},
      ${diagnosticoId},
      ${atendimentoId},
      ${cnpj},
      ${nomeArquivo},
      ${tipoDocumento},
      ${mimeType},
      ${buffer.length},
      ${blob?.url || ""},
      ${blob?.pathname || ""},
      ${
        textoExtraido
          ? "PRONTO_PARA_ANALISE"
          : "SEM_TEXTO_EXTRAIVEL"
      },
      ${textoExtraido},
      ${textoExtraido.length},
      ${observacoes},
      ${txt(u?.sub, 160)},
      ${txt(
        u?.nome ||
        u?.login ||
        "Usuário",
        180
      )},
      ${JSON.stringify({
        origemUpload:
          "ATENDIMENTO",
        extensao:
          extensao(
            nomeArquivo
          ),
      })}::jsonb
    )
  `;

  await sql`
    INSERT INTO
      crm_atendimento_historico (
        id,
        atendimento_id,
        diagnostico_id,
        lead_id,
        tipo_evento,
        tipo_acionamento,
        resultado,
        descricao,
        responsavel_id,
        responsavel_nome
      )

    VALUES (
      ${gerarId("hist")},
      ${atendimentoId},
      ${diagnosticoId},
      ${leadId},
      'DOCUMENTO',
      'DOCUMENTOS',
      'Documento anexado',
      ${`Arquivo anexado: ${nomeArquivo} (${tipoDocumento})`},
      ${txt(u?.sub, 160)},
      ${txt(
        u?.nome ||
        u?.login ||
        "Usuário",
        180
      )}
    )
  `;

  return res
    .status(200)
    .json({
      sucesso: true,

      documento: {
        id,
        nomeArquivo,
        tipoDocumento,
        tamanhoBytes:
          buffer.length,
        textoExtraidoChars:
          textoExtraido.length,
        statusAnalise:
          textoExtraido
            ? "PRONTO_PARA_ANALISE"
            : "SEM_TEXTO_EXTRAIVEL",
      },
    });
}

// =========================================================
// EXCLUIR
// =========================================================

async function excluirDocumento(
  req,
  res
) {
  const u =
    usuario(req);

  if (!u) {
    return res
      .status(401)
      .json({
        sucesso: false,
        error:
          "Não autorizado.",
      });
  }

  const documentoId =
    txt(
      req.body
        ?.documentoId,
      160
    );

  if (!documentoId) {
    return res
      .status(400)
      .json({
        sucesso: false,
        error:
          "documentoId é obrigatório.",
      });
  }

  const rows =
    await sql`
      SELECT *
      FROM
        crm_documentos_cliente
      WHERE
        id =
          ${documentoId}
      LIMIT 1
    `;

  const doc =
    rows?.[0];

  if (!doc) {
    return res
      .status(404)
      .json({
        sucesso: false,
        error:
          "Documento não encontrado.",
      });
  }

  if (
    doc.blob_url
  ) {
    try {
      await del(
        doc.blob_url
      );
    } catch (error) {
      console.warn(
        "[documentos] blob não removido",
        error?.message ||
        error
      );
    }
  }

  await sql`
    DELETE FROM
      crm_documentos_cliente
    WHERE
      id =
        ${documentoId}
  `;

  await sql`
    INSERT INTO
      crm_atendimento_historico (
        id,
        atendimento_id,
        diagnostico_id,
        lead_id,
        tipo_evento,
        tipo_acionamento,
        resultado,
        descricao,
        responsavel_id,
        responsavel_nome
      )

    VALUES (
      ${gerarId("hist")},
      ${doc.atendimento_id},
      ${doc.diagnostico_id},
      ${doc.lead_id},
      'DOCUMENTO',
      'DOCUMENTOS',
      'Documento removido',
      ${`Arquivo removido: ${doc.nome_arquivo}`},
      ${txt(u?.sub, 160)},
      ${txt(
        u?.nome ||
        u?.login ||
        "Usuário",
        180
      )}
    )
  `;

  return res
    .status(200)
    .json({
      sucesso: true,
    });
}

// =========================================================
// GERAR ANÁLISE
// =========================================================

async function gerarAnalise(
  req,
  res
) {
  const u =
    usuario(req);

  if (!u) {
    return res
      .status(401)
      .json({
        sucesso: false,
        error:
          "Não autorizado.",
      });
  }

  const atendimentoId =
    txt(
      req.body
        ?.atendimentoId,
      160
    );

  if (!atendimentoId) {
    return res
      .status(400)
      .json({
        sucesso: false,
        error:
          "atendimentoId é obrigatório.",
      });
  }

  const contexto =
    await contextoAtendimento(
      atendimentoId
    );

  if (!contexto) {
    return res
      .status(404)
      .json({
        sucesso: false,
        error:
          "Atendimento não encontrado.",
      });
  }

  const documentos =
    await sql`
      SELECT *
      FROM
        crm_documentos_cliente

      WHERE
        atendimento_id =
          ${atendimentoId}

      ORDER BY
        criado_em ASC
    `;

  if (
    !documentos?.length
  ) {
    return res
      .status(400)
      .json({
        sucesso: false,
        error:
          "Anexe pelo menos um documento antes de gerar a análise.",
      });
  }

  await sql`
    UPDATE
      crm_documentos_cliente

    SET
      status_analise =
        'ANALISANDO',
      atualizado_em =
        NOW()

    WHERE
      atendimento_id =
        ${atendimentoId}
      AND texto_extraido_chars >
        0
  `;

  try {
    const analise =
      await gerarComIA({
        contexto,
        documentos,
      });

    const id =
      gerarId(
        "analise"
      );

    const leadId =
      txt(
        contexto
          .atendimento
          .lead_id,
        160
      );

    const diagnosticoId =
      txt(
        contexto
          .atendimento
          .diagnostico_id,
        160
      );

    const docIds =
      documentos.map(
        (doc) =>
          doc.id
      );

    await sql`
      INSERT INTO
        crm_analises_documentais (
          id,
          lead_id,
          diagnostico_id,
          atendimento_id,
          documentos_ids,
          tipo_analise,
          resumo,
          achados,
          divergencias,
          riscos,
          pontos_validacao,
          oportunidades,
          dados_faltantes,
          confianca,
          resposta_completa,
          gerado_por_id,
          gerado_por_nome
        )

      VALUES (
        ${id},
        ${leadId},
        ${diagnosticoId},
        ${atendimentoId},
        ${JSON.stringify(
          docIds
        )}::jsonb,
        'PREVIA_CONSULTOR',
        ${txt(
          analise.resumo,
          12000
        )},
        ${JSON.stringify(
          jsonSeguro(
            analise.achados,
            []
          )
        )}::jsonb,
        ${JSON.stringify(
          jsonSeguro(
            analise.divergencias,
            []
          )
        )}::jsonb,
        ${JSON.stringify(
          jsonSeguro(
            analise.riscos,
            []
          )
        )}::jsonb,
        ${JSON.stringify(
          jsonSeguro(
            analise.pontosValidacao,
            []
          )
        )}::jsonb,
        ${JSON.stringify(
          jsonSeguro(
            analise.oportunidades,
            []
          )
        )}::jsonb,
        ${JSON.stringify(
          jsonSeguro(
            analise.dadosFaltantes,
            []
          )
        )}::jsonb,
        ${txt(
          analise.confianca ||
          "MEDIA",
          20
        ).toUpperCase()},
        ${JSON.stringify(
          jsonSeguro(
            analise,
            {}
          )
        )}::jsonb,
        ${txt(u?.sub, 160)},
        ${txt(
          u?.nome ||
          u?.login ||
          "Usuário",
          180
        )}
      )
    `;

    await sql`
      UPDATE
        crm_documentos_cliente

      SET
        status_analise =
          'ANALISADO',
        atualizado_em =
          NOW()

      WHERE
        atendimento_id =
          ${atendimentoId}
        AND texto_extraido_chars >
          0
    `;

    await sql`
      INSERT INTO
        crm_atendimento_historico (
          id,
          atendimento_id,
          diagnostico_id,
          lead_id,
          tipo_evento,
          tipo_acionamento,
          resultado,
          descricao,
          responsavel_id,
          responsavel_nome
        )

      VALUES (
        ${gerarId("hist")},
        ${atendimentoId},
        ${diagnosticoId},
        ${leadId},
        'ANALISE_DOCUMENTAL',
        'ANALISE_INTERNA',
        'Análise documental gerada',
        ${`Análise prévia gerada com ${documentos.length} documento(s). Confiança: ${txt(
          analise.confianca ||
          "MEDIA",
          20
        )}.`},
        ${txt(u?.sub, 160)},
        ${txt(
          u?.nome ||
          u?.login ||
          "Usuário",
          180
        )}
      )
    `;

    return res
      .status(200)
      .json({
        sucesso: true,

        analise: {
          id,
          ...analise,
          documentosIds:
            docIds,
        },
      });
  } catch (error) {
    await sql`
      UPDATE
        crm_documentos_cliente

      SET
        status_analise =
          CASE
            WHEN texto_extraido_chars >
              0
              THEN 'ERRO_ANALISE'
            ELSE status_analise
          END,
        atualizado_em =
          NOW()

      WHERE
        atendimento_id =
          ${atendimentoId}
    `;

    throw error;
  }
}

// =========================================================
// HANDLER
// =========================================================

export default async function documentosHandler(
  req,
  res
) {
  try {
    if (
      !process.env
        .DATABASE_URL
    ) {
      return res
        .status(500)
        .json({
          sucesso: false,
          error:
            "DATABASE_URL não configurada.",
        });
    }

    await schema();

    const action =
      txt(
        req.query
          ?.action,
        80
      ).toLowerCase();

    switch (action) {
      case "listar-documentos":
        return listarDocumentos(
          req,
          res
        );

      case "upload-documento":
        return uploadDocumento(
          req,
          res
        );

      case "excluir-documento":
        return excluirDocumento(
          req,
          res
        );

      case "gerar-analise-documental":
        return gerarAnalise(
          req,
          res
        );

      default:
        return res
          .status(400)
          .json({
            sucesso: false,
            error:
              "Ação documental inválida.",
          });
    }
  } catch (error) {
    console.error(
      "[documentos]",
      error
    );

    return res
      .status(500)
      .json({
        sucesso: false,
        error:
          error?.message ||
          "Não foi possível processar os documentos.",
      });
  }
}
