import { neon } from "@neondatabase/serverless";
import { usuarioAutenticado } from "./lib/auth.js";

const sql =
  neon(
    process.env.DATABASE_URL
  );

const OPENAI_URL =
  "https://api.openai.com/v1";

const MODEL =
  process.env.OPENAI_TRIBUTARIO_MODEL ||
  "gpt-5.6";

const MAX_FILE_BYTES =
  3 * 1024 * 1024;

let schemaPromise =
  null;

function send(
  res,
  status,
  body
) {
  return res
    .status(status)
    .json(body);
}

function txt(
  value,
  limit = 2000
) {
  return String(
    value ?? ""
  )
    .trim()
    .slice(
      0,
      limit
    );
}

function jsonSeguro(
  value
) {
  try {
    return JSON.parse(
      JSON.stringify(
        value ?? null
      )
    );
  } catch {
    return null;
  }
}

function stripDataUrl(
  value
) {
  const text =
    String(
      value || ""
    );

  const idx =
    text.indexOf(
      "base64,"
    );

  return idx >= 0
    ? text.slice(
        idx + 7
      )
    : text;
}

function outputText(
  data
) {
  if (
    typeof data?.output_text ===
    "string"
  ) {
    return data.output_text;
  }

  const texts = [];

  for (
    const item of
      data?.output ||
      []
  ) {
    for (
      const part of
        item?.content ||
        []
    ) {
      if (
        typeof part?.text ===
        "string"
      ) {
        texts.push(
          part.text
        );
      }
    }
  }

  return texts.join(
    "\n"
  );
}

function authUser(
  req
) {
  return (
    usuarioAutenticado(
      req
    ) || {
      sub: "",
      nome:
        "Usuário não identificado",
      login: "",
      perfil: "",
    }
  );
}

async function ensureSchema() {
  if (
    !schemaPromise
  ) {
    schemaPromise =
      (async () => {
        await sql`
          CREATE TABLE IF NOT EXISTS
            tax_projects (
              id TEXT PRIMARY KEY,
              tipo_projeto TEXT NOT NULL DEFAULT '',
              estrutura TEXT NOT NULL DEFAULT '',
              modalidade TEXT NOT NULL DEFAULT '',
              responsavel_finder TEXT NOT NULL DEFAULT '',
              origem_cliente TEXT NOT NULL DEFAULT '',
              contato_nome TEXT NOT NULL DEFAULT '',
              contato_email TEXT NOT NULL DEFAULT '',
              contato_telefone TEXT NOT NULL DEFAULT '',
              observacao_origem TEXT NOT NULL DEFAULT '',
              cliente_nome TEXT NOT NULL DEFAULT '',
              cnpj TEXT NOT NULL DEFAULT '',
              empresas JSONB NOT NULL DEFAULT '[]'::jsonb,
              atividades JSONB NOT NULL DEFAULT '{}'::jsonb,
              dados_manuais JSONB NOT NULL DEFAULT '{}'::jsonb,
              status TEXT NOT NULL DEFAULT 'EM_ANALISE',
              versao_atual INTEGER NOT NULL DEFAULT 0,
              criado_por_id TEXT NOT NULL DEFAULT '',
              criado_por_nome TEXT NOT NULL DEFAULT '',
              validado_por_id TEXT NOT NULL DEFAULT '',
              validado_por_nome TEXT NOT NULL DEFAULT '',
              validado_em TIMESTAMPTZ,
              criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `;

        await sql`
          CREATE INDEX IF NOT EXISTS
            idx_tax_projects_responsavel
          ON tax_projects (
            responsavel_finder,
            atualizado_em DESC
          )
        `;

        await sql`
          CREATE INDEX IF NOT EXISTS
            idx_tax_projects_tipo
          ON tax_projects (
            tipo_projeto,
            atualizado_em DESC
          )
        `;

        await sql`
          CREATE TABLE IF NOT EXISTS
            tax_diagnostics (
              id BIGSERIAL PRIMARY KEY,
              projeto_id TEXT NOT NULL,
              versao INTEGER NOT NULL,
              tipo_projeto TEXT NOT NULL DEFAULT '',
              diagnostico JSONB NOT NULL DEFAULT '{}'::jsonb,
              documentos JSONB NOT NULL DEFAULT '[]'::jsonb,
              modelo TEXT NOT NULL DEFAULT '',
              usage JSONB,
              criado_por_id TEXT NOT NULL DEFAULT '',
              criado_por_nome TEXT NOT NULL DEFAULT '',
              criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE (
                projeto_id,
                versao
              )
            )
        `;

        await sql`
          CREATE INDEX IF NOT EXISTS
            idx_tax_diagnostics_projeto
          ON tax_diagnostics (
            projeto_id,
            versao DESC
          )
        `;

        await sql`
          CREATE TABLE IF NOT EXISTS
            tax_history (
              id BIGSERIAL PRIMARY KEY,
              projeto_id TEXT NOT NULL,
              tipo TEXT NOT NULL DEFAULT '',
              descricao TEXT NOT NULL DEFAULT '',
              detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
              usuario_id TEXT NOT NULL DEFAULT '',
              usuario_nome TEXT NOT NULL DEFAULT '',
              criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `;

        await sql`
          CREATE INDEX IF NOT EXISTS
            idx_tax_history_projeto
          ON tax_history (
            projeto_id,
            criado_em DESC
          )
        `;
      })();
  }

  await schemaPromise;
}

async function addHistory(
  projetoId,
  tipo,
  descricao,
  detalhes,
  user
) {
  await sql`
    INSERT INTO tax_history (
      projeto_id,
      tipo,
      descricao,
      detalhes,
      usuario_id,
      usuario_nome
    )
    VALUES (
      ${txt(projetoId, 200)},
      ${txt(tipo, 100)},
      ${txt(descricao, 1000)},
      ${JSON.stringify(
        jsonSeguro(
          detalhes || {}
        )
      )},
      ${txt(user?.sub, 200)},
      ${txt(
        user?.nome ||
        user?.login ||
        "Usuário",
        200
      )}
    )
  `;
}

async function salvarProjeto(
  req,
  res
) {
  await ensureSchema();

  const body =
    req.body ||
    {};

  const user =
    authUser(req);

  const id =
    txt(
      body.id,
      200
    );

  if (!id) {
    return send(
      res,
      400,
      {
        sucesso: false,
        error:
          "ID do projeto é obrigatório.",
      }
    );
  }

  const empresas =
    Array.isArray(
      body.empresas
    )
      ? body.empresas
      : [];

  const empresaPrincipal =
    empresas[0] ||
    {};

  const clienteNome =
    txt(
      empresaPrincipal.razaoSocial ||
      empresaPrincipal.nomeFantasia ||
      body.contatoNome ||
      "Cliente",
      300
    );

  const cnpj =
    txt(
      empresaPrincipal.cnpj ||
      "",
      30
    );

  await sql`
    INSERT INTO tax_projects (
      id,
      tipo_projeto,
      estrutura,
      modalidade,
      responsavel_finder,
      origem_cliente,
      contato_nome,
      contato_email,
      contato_telefone,
      observacao_origem,
      cliente_nome,
      cnpj,
      empresas,
      atividades,
      dados_manuais,
      status,
      criado_por_id,
      criado_por_nome,
      atualizado_em
    )
    VALUES (
      ${id},
      ${txt(body.tipoProjeto, 80)},
      ${txt(body.estrutura, 80)},
      ${txt(body.modalidade, 80)},
      ${txt(body.responsavelFinder, 200)},
      ${txt(body.origemCliente, 120)},
      ${txt(body.contatoNome, 200)},
      ${txt(body.contatoEmail, 250)},
      ${txt(body.contatoTelefone, 100)},
      ${txt(body.observacaoOrigem, 1000)},
      ${clienteNome},
      ${cnpj},
      ${JSON.stringify(
        jsonSeguro(
          empresas
        ) || []
      )},
      ${JSON.stringify(
        jsonSeguro(
          body.atividades ||
          {}
        ) || {}
      )},
      ${JSON.stringify(
        jsonSeguro(
          body.dadosManuais ||
          {}
        ) || {}
      )},
      ${txt(
        body.status ||
        "EM_ANALISE",
        80
      )},
      ${txt(user?.sub, 200)},
      ${txt(
        user?.nome ||
        user?.login ||
        "Usuário",
        200
      )},
      NOW()
    )
    ON CONFLICT (id)
    DO UPDATE SET
      tipo_projeto =
        EXCLUDED.tipo_projeto,
      estrutura =
        EXCLUDED.estrutura,
      modalidade =
        EXCLUDED.modalidade,
      responsavel_finder =
        EXCLUDED.responsavel_finder,
      origem_cliente =
        EXCLUDED.origem_cliente,
      contato_nome =
        EXCLUDED.contato_nome,
      contato_email =
        EXCLUDED.contato_email,
      contato_telefone =
        EXCLUDED.contato_telefone,
      observacao_origem =
        EXCLUDED.observacao_origem,
      cliente_nome =
        EXCLUDED.cliente_nome,
      cnpj =
        EXCLUDED.cnpj,
      empresas =
        EXCLUDED.empresas,
      atividades =
        EXCLUDED.atividades,
      dados_manuais =
        EXCLUDED.dados_manuais,
      status =
        EXCLUDED.status,
      atualizado_em =
        NOW()
  `;

  await addHistory(
    id,
    "PROJETO_SALVO",
    "Projeto tributário salvo/atualizado.",
    {
      tipoProjeto:
        body.tipoProjeto,
      status:
        body.status ||
        "EM_ANALISE",
      responsavelFinder:
        body.responsavelFinder,
    },
    user
  );

  return send(
    res,
    200,
    {
      sucesso: true,
      projeto: {
        id,
        clienteNome,
        cnpj,
      },
    }
  );
}

async function salvarDiagnostico(
  req,
  res
) {
  await ensureSchema();

  const body =
    req.body ||
    {};

  const user =
    authUser(req);

  const projetoId =
    txt(
      body.projetoId,
      200
    );

  if (
    !projetoId ||
    !body.diagnostico
  ) {
    return send(
      res,
      400,
      {
        sucesso: false,
        error:
          "projetoId e diagnóstico são obrigatórios.",
      }
    );
  }

  const rows =
    await sql`
      SELECT
        COALESCE(
          MAX(versao),
          0
        )::int AS max
      FROM tax_diagnostics
      WHERE projeto_id =
        ${projetoId}
    `;

  const versao =
    Number(
      rows?.[0]?.max ||
      0
    ) + 1;

  const projetoRows =
    await sql`
      SELECT
        tipo_projeto
      FROM tax_projects
      WHERE id =
        ${projetoId}
      LIMIT 1
    `;

  const tipoProjeto =
    txt(
      projetoRows?.[0]?.tipo_projeto ||
      body.tipoProjeto ||
      "",
      80
    );

  const inserted =
    await sql`
      INSERT INTO tax_diagnostics (
        projeto_id,
        versao,
        tipo_projeto,
        diagnostico,
        documentos,
        modelo,
        usage,
        criado_por_id,
        criado_por_nome
      )
      VALUES (
        ${projetoId},
        ${versao},
        ${tipoProjeto},
        ${JSON.stringify(
          jsonSeguro(
            body.diagnostico
          ) || {}
        )},
        ${JSON.stringify(
          jsonSeguro(
            body.documentos ||
            []
          ) || []
        )},
        ${txt(body.modelo, 120)},
        ${JSON.stringify(
          jsonSeguro(
            body.usage
          )
        )},
        ${txt(user?.sub, 200)},
        ${txt(
          user?.nome ||
          user?.login ||
          "Usuário",
          200
        )}
      )
      RETURNING
        id,
        versao,
        criado_em
    `;

  await sql`
    UPDATE tax_projects
    SET
      versao_atual =
        ${versao},
      status =
        'DIAGNOSTICO_GERADO',
      atualizado_em =
        NOW()
    WHERE id =
      ${projetoId}
  `;

  await addHistory(
    projetoId,
    "DIAGNOSTICO_GERADO",
    `Diagnóstico tributário V${versao} gerado.`,
    {
      versao,
      modelo:
        body.modelo ||
        "",
      documentos:
        Array.isArray(
          body.documentos
        )
          ? body.documentos.length
          : 0,
    },
    user
  );

  return send(
    res,
    200,
    {
      sucesso: true,
      versao,
      diagnostico:
        inserted?.[0] ||
        null,
    }
  );
}

async function listarProjetos(
  req,
  res
) {
  await ensureSchema();

  const busca =
    txt(
      req.query?.busca,
      250
    );

  const tipo =
    txt(
      req.query?.tipo,
      80
    );

  const responsavel =
    txt(
      req.query?.responsavel,
      200
    );

  const status =
    txt(
      req.query?.status,
      80
    );

  const like =
    `%${busca}%`;

  const rows =
    await sql`
      SELECT
        id,
        tipo_projeto,
        responsavel_finder,
        origem_cliente,
        cliente_nome,
        cnpj,
        status,
        versao_atual,
        criado_por_nome,
        validado_por_nome,
        criado_em,
        atualizado_em
      FROM tax_projects
      WHERE
        (
          ${busca} = ''
          OR cliente_nome
            ILIKE ${like}
          OR cnpj
            ILIKE ${like}
        )
        AND (
          ${tipo} = ''
          OR tipo_projeto =
            ${tipo}
        )
        AND (
          ${responsavel} = ''
          OR responsavel_finder =
            ${responsavel}
        )
        AND (
          ${status} = ''
          OR status =
            ${status}
        )
      ORDER BY
        atualizado_em DESC
      LIMIT 300
    `;

  return send(
    res,
    200,
    {
      sucesso: true,
      projetos:
        rows.map(
          (row) => ({
            id:
              row.id,
            tipoProjeto:
              row.tipo_projeto,
            responsavelFinder:
              row.responsavel_finder,
            origemCliente:
              row.origem_cliente,
            clienteNome:
              row.cliente_nome,
            cnpj:
              row.cnpj,
            status:
              row.status,
            versaoAtual:
              row.versao_atual,
            criadoPorNome:
              row.criado_por_nome,
            validadoPorNome:
              row.validado_por_nome,
            criadoEm:
              row.criado_em,
            atualizadoEm:
              row.atualizado_em,
          })
        ),
    }
  );
}

async function obterProjeto(
  req,
  res
) {
  await ensureSchema();

  const id =
    txt(
      req.query?.id,
      200
    );

  if (!id) {
    return send(
      res,
      400,
      {
        sucesso: false,
        error:
          "ID do projeto é obrigatório.",
      }
    );
  }

  const rows =
    await sql`
      SELECT *
      FROM tax_projects
      WHERE id =
        ${id}
      LIMIT 1
    `;

  const row =
    rows?.[0];

  if (!row) {
    return send(
      res,
      404,
      {
        sucesso: false,
        error:
          "Projeto não encontrado.",
      }
    );
  }

  const diagnosticos =
    await sql`
      SELECT
        id,
        versao,
        tipo_projeto,
        diagnostico,
        documentos,
        modelo,
        usage,
        criado_por_nome,
        criado_em
      FROM tax_diagnostics
      WHERE projeto_id =
        ${id}
      ORDER BY
        versao DESC
    `;

  const historico =
    await sql`
      SELECT
        id,
        tipo,
        descricao,
        detalhes,
        usuario_nome,
        criado_em
      FROM tax_history
      WHERE projeto_id =
        ${id}
      ORDER BY
        criado_em DESC
    `;

  return send(
    res,
    200,
    {
      sucesso: true,
      projeto: {
        id:
          row.id,
        tipoProjeto:
          row.tipo_projeto,
        estrutura:
          row.estrutura,
        modalidade:
          row.modalidade,
        responsavelFinder:
          row.responsavel_finder,
        origemCliente:
          row.origem_cliente,
        contatoNome:
          row.contato_nome,
        contatoEmail:
          row.contato_email,
        contatoTelefone:
          row.contato_telefone,
        observacaoOrigem:
          row.observacao_origem,
        clienteNome:
          row.cliente_nome,
        cnpj:
          row.cnpj,
        empresas:
          row.empresas ||
          [],
        atividades:
          row.atividades ||
          {},
        dadosManuais:
          row.dados_manuais ||
          {},
        status:
          row.status,
        versaoAtual:
          row.versao_atual,
        criadoPorNome:
          row.criado_por_nome,
        validadoPorNome:
          row.validado_por_nome,
        validadoEm:
          row.validado_em,
        criadoEm:
          row.criado_em,
        atualizadoEm:
          row.atualizado_em,

        diagnosticos:
          diagnosticos.map(
            (diag) => ({
              id:
                diag.id,
              versao:
                diag.versao,
              tipoProjeto:
                diag.tipo_projeto,
              diagnostico:
                diag.diagnostico ||
                {},
              documentos:
                diag.documentos ||
                [],
              modelo:
                diag.modelo,
              usage:
                diag.usage,
              criadoPorNome:
                diag.criado_por_nome,
              criadoEm:
                diag.criado_em,
            })
          ),

        historico:
          historico.map(
            (evento) => ({
              id:
                evento.id,
              tipo:
                evento.tipo,
              descricao:
                evento.descricao,
              detalhes:
                evento.detalhes ||
                {},
              usuarioNome:
                evento.usuario_nome,
              criadoEm:
                evento.criado_em,
            })
          ),
      },
    }
  );
}

async function validarProjeto(
  req,
  res
) {
  await ensureSchema();

  const body =
    req.body ||
    {};

  const id =
    txt(
      body.id,
      200
    );

  const user =
    authUser(req);

  if (!id) {
    return send(
      res,
      400,
      {
        sucesso: false,
        error:
          "ID do projeto é obrigatório.",
      }
    );
  }

  await sql`
    UPDATE tax_projects
    SET
      status =
        'VALIDADO',
      validado_por_id =
        ${txt(user?.sub, 200)},
      validado_por_nome =
        ${txt(
          user?.nome ||
          user?.login ||
          "Usuário",
          200
        )},
      validado_em =
        NOW(),
      atualizado_em =
        NOW()
    WHERE id =
      ${id}
  `;

  await addHistory(
    id,
    "VALIDADO",
    "Diagnóstico validado pelo responsável.",
    {},
    user
  );

  return send(
    res,
    200,
    {
      sucesso: true,
    }
  );
}

async function uploadFile(
  req,
  res
) {
  const {
    filename,
    mimeType,
    fileData,
  } =
    req.body ||
    {};

  if (
    !filename ||
    !fileData
  ) {
    return send(
      res,
      400,
      {
        sucesso: false,
        error:
          "Arquivo e nome do arquivo são obrigatórios.",
      }
    );
  }

  const buffer =
    Buffer.from(
      stripDataUrl(
        fileData
      ),
      "base64"
    );

  if (
    !buffer.length
  ) {
    return send(
      res,
      400,
      {
        sucesso: false,
        error:
          "Arquivo vazio.",
      }
    );
  }

  if (
    buffer.length >
    MAX_FILE_BYTES
  ) {
    return send(
      res,
      413,
      {
        sucesso: false,
        error:
          `${filename} ultrapassa 3 MB. Reduza ou divida o arquivo.`,
      }
    );
  }

  const form =
    new FormData();

  form.append(
    "purpose",
    "user_data"
  );

  form.append(
    "expires_after[anchor]",
    "created_at"
  );

  form.append(
    "expires_after[seconds]",
    "86400"
  );

  form.append(
    "file",
    new Blob(
      [buffer],
      {
        type:
          mimeType ||
          "application/octet-stream",
      }
    ),
    filename
  );

  const response =
    await fetch(
      `${OPENAI_URL}/files`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: form,
      }
    );

  const data =
    await response
      .json()
      .catch(
        () => null
      );

  if (
    !response.ok ||
    !data?.id
  ) {
    console.error(
      "[tributario][upload]",
      data
    );

    return send(
      res,
      response.status ||
        500,
      {
        sucesso: false,
        error:
          data?.error?.message ||
          "A OpenAI não aceitou o documento.",
      }
    );
  }

  return send(
    res,
    200,
    {
      sucesso: true,
      fileId:
        data.id,
      filename,
      bytes:
        buffer.length,
    }
  );
}

const diagnosticSchema = {
  type: "object",

  properties: {
    resumoExecutivo: {
      type: "string",
    },

    documentosAnalisados: {
      type: "array",
      items: {
        type: "string",
      },
    },

    dadosExtraidos: {
      type: "array",

      items: {
        type: "object",

        properties: {
          campo: {
            type: "string",
          },

          valor: {
            type: "string",
          },

          fonte: {
            type: "string",
          },

          confianca: {
            type: "string",
            enum: [
              "ALTA",
              "MEDIA",
              "BAIXA",
            ],
          },
        },

        required: [
          "campo",
          "valor",
          "fonte",
          "confianca",
        ],

        additionalProperties:
          false,
      },
    },

    pontosAnalise: {
      type: "array",
      items: {
        type: "string",
      },
    },

    riscos: {
      type: "array",
      items: {
        type: "string",
      },
    },

    oportunidades: {
      type: "array",
      items: {
        type: "string",
      },
    },

    divergencias: {
      type: "array",
      items: {
        type: "string",
      },
    },

    dadosFaltantes: {
      type: "array",
      items: {
        type: "string",
      },
    },

    perguntasValidacao: {
      type: "array",
      items: {
        type: "string",
      },
    },

    recomendacaoPreliminar: {
      type: "string",
    },

    confiancaGeral: {
      type: "string",
      enum: [
        "ALTA",
        "MEDIA",
        "BAIXA",
      ],
    },
  },

  required: [
    "resumoExecutivo",
    "documentosAnalisados",
    "dadosExtraidos",
    "pontosAnalise",
    "riscos",
    "oportunidades",
    "divergencias",
    "dadosFaltantes",
    "perguntasValidacao",
    "recomendacaoPreliminar",
    "confiancaGeral",
  ],

  additionalProperties:
    false,
};

async function diagnostico(
  req,
  res
) {
  const body =
    req.body ||
    {};

  const arquivos =
    Array.isArray(
      body.arquivos
    )
      ? body.arquivos
      : [];

  const content =
    [];

  for (
    const arquivo of
      arquivos
  ) {
    if (
      !arquivo?.fileId
    ) {
      continue;
    }

    content.push({
      type:
        "input_file",
      file_id:
        arquivo.fileId,
    });
  }

  const isReforma =
    body.tipoProjeto ===
    "reforma";

  const foco =
    isReforma
      ? `
FOCO EXCLUSIVO — REFORMA TRIBUTÁRIA:
- IBS e CBS;
- transição;
- perfil B2B/B2C;
- cadeia de clientes e fornecedores;
- potencial de créditos;
- impacto em preço e margem;
- contratos;
- fluxo de caixa;
- cadastros fiscais;
- riscos operacionais;
- medidas de preparação.

NÃO transforme esta análise em comparação de regime para redução de carga.
`
      : `
FOCO EXCLUSIVO — PLANEJAMENTO TRIBUTÁRIO:
- regime tributário atual;
- redução LEGAL da carga tributária;
- eficiência tributária;
- Simples Nacional;
- Fator R;
- Lucro Presumido;
- Lucro Real;
- composição das receitas;
- folha e pró-labore;
- retenções;
- compras e despesas;
- margens;
- despesas dedutíveis;
- segregação de receitas;
- riscos de enquadramento.

NÃO transforme esta análise em um diagnóstico de Reforma Tributária.
`;

  const contexto = {
    tipoProjeto:
      body.tipoProjeto,
    estrutura:
      body.estrutura,
    modalidade:
      body.modalidade,
    cliente:
      body.cliente,
    empresas:
      body.empresas,
    atividades:
      body.atividades,
    dadosManuais:
      body.dadosManuais,
    arquivos:
      arquivos.map(
        (a) => ({
          filename:
            a.filename,
          bytes:
            a.bytes,
        })
      ),
  };

  content.push({
    type:
      "input_text",

    text: `
Você é o Finder Tax AI, assistente técnico para contadores e consultores tributários no Brasil.

${foco}

CONTEXTO:
${JSON.stringify(
  contexto,
  null,
  2
)}

REGRAS:
1. Leia todos os documentos enviados.
2. Cruze documentos, CNPJ, CNAEs, atividade principal REAL e dados manuais.
3. Nunca invente valores.
4. Registre divergências entre documentos.
5. Dados sem suporte devem entrar em dadosFaltantes.
6. Informe a fonte documental de cada dado extraído.
7. Não declare conclusão definitiva se faltar memória de cálculo ou confirmação.
8. Gere perguntas objetivas para validação profissional.
9. A recomendação é preliminar.
`,
  });

  const payload = {
    model: MODEL,

    input: [
      {
        role:
          "user",
        content,
      },
    ],

    reasoning: {
      effort:
        "medium",
    },

    text: {
      format: {
        type:
          "json_schema",
        name:
          "finder_tax_diagnostico",
        strict:
          true,
        schema:
          diagnosticSchema,
      },
    },
  };

  const response =
    await fetch(
      `${OPENAI_URL}/responses`,
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${process.env.OPENAI_API_KEY}`,

          "content-type":
            "application/json",
        },

        body:
          JSON.stringify(
            payload
          ),
      }
    );

  const data =
    await response
      .json()
      .catch(
        () => null
      );

  if (
    !response.ok
  ) {
    console.error(
      "[tributario][responses]",
      data
    );

    return send(
      res,
      response.status ||
        500,
      {
        sucesso:
          false,

        error:
          data?.error?.message ||
          "Falha na análise com IA.",
      }
    );
  }

  const text =
    outputText(
      data
    );

  let result;

  try {
    result =
      JSON.parse(
        text
      );
  } catch {
    return send(
      res,
      500,
      {
        sucesso:
          false,

        error:
          "A IA respondeu, mas o diagnóstico não veio em formato válido.",
      }
    );
  }

  return send(
    res,
    200,
    {
      sucesso:
        true,

      modelo:
        MODEL,

      diagnostico: {
        ...result,

        pontos:
          result.pontosAnalise ||
          [],

        conclusao:
          result.resumoExecutivo ||
          "",
      },

      usage:
        data?.usage ||
        null,
    }
  );
}

// =========================================================
// PLANEJAMENTO TRIBUTÁRIO V2 — BASEADO NA PLANILHA FS®
// ESCOPO: somente Planejamento Tributário. NÃO trata IBS/CBS/transição.
// =========================================================

const planejamentoMesesSchema = {
  type: "object",
  properties: {
    jan: { type: ["number", "null"] },
    fev: { type: ["number", "null"] },
    mar: { type: ["number", "null"] },
    abr: { type: ["number", "null"] },
    mai: { type: ["number", "null"] },
    jun: { type: ["number", "null"] },
    jul: { type: ["number", "null"] },
    ago: { type: ["number", "null"] },
    set: { type: ["number", "null"] },
    out: { type: ["number", "null"] },
    nov: { type: ["number", "null"] },
    dez: { type: ["number", "null"] },
  },
  required: [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ],
  additionalProperties: false,
};

const planejamentoExtracaoSchema = {
  type: "object",
  properties: {
    identificacao: {
      type: "object",
      properties: {
        cnpj: { type: ["string", "null"] },
        razaoSocial: { type: ["string", "null"] },
        dataAbertura: { type: ["string", "null"] },
        municipio: { type: ["string", "null"] },
        uf: { type: ["string", "null"] },
        regimeAtual: { type: ["string", "null"] },
        regimeApuracao: { type: ["string", "null"] },
        optanteSimples: { type: ["boolean", "null"] },
        possuiFiliais: { type: ["boolean", "null"] }
      },
      required: ["cnpj","razaoSocial","dataAbertura","municipio","uf","regimeAtual","regimeApuracao","optanteSimples","possuiFiliais"],
      additionalProperties: false
    },
    simplesNacional: {
      type: "object",
      properties: {
        competencia: { type: ["string", "null"] },
        rpa: { type: ["number", "null"] },
        rbt12: { type: ["number", "null"] },
        rba: { type: ["number", "null"] },
        rbaa: { type: ["number", "null"] },
        dasTotal: { type: ["number", "null"] },
        aliquotaEfetivaObservada: { type: ["number", "null"] },
        anexo: { type: ["string", "null"] },
        atividadeTributada: { type: ["string", "null"] },
        fatorR: { type: ["string", "null"] },
        fatorRAplicavel: { type: ["boolean", "null"] },
        mercadoExterno: { type: ["number", "null"] },
        issMunicipio: { type: ["string", "null"] },
        composicaoDas: {
          type: "object",
          properties: {
            irpj: { type: ["number", "null"] },
            csll: { type: ["number", "null"] },
            cofins: { type: ["number", "null"] },
            pis: { type: ["number", "null"] },
            cppInss: { type: ["number", "null"] },
            icms: { type: ["number", "null"] },
            ipi: { type: ["number", "null"] },
            iss: { type: ["number", "null"] }
          },
          required: ["irpj","csll","cofins","pis","cppInss","icms","ipi","iss"],
          additionalProperties: false
        },
        receitasHistoricas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              competencia: { type: "string" },
              receita: { type: ["number", "null"] },
              mercado: { type: "string", enum: ["INTERNO","EXTERNO"] }
            },
            required: ["competencia","receita","mercado"],
            additionalProperties: false
          }
        }
      },
      required: ["competencia","rpa","rbt12","rba","rbaa","dasTotal","aliquotaEfetivaObservada","anexo","atividadeTributada","fatorR","fatorRAplicavel","mercadoExterno","issMunicipio","composicaoDas","receitasHistoricas"],
      additionalProperties: false
    },
    base: {
      type: "object",
      properties: {
        faturamento: {
          type: "object",
          properties: {
            industria: planejamentoMesesSchema,
            comercio: planejamentoMesesSchema,
            servicos: planejamentoMesesSchema
          },
          required: ["industria","comercio","servicos"],
          additionalProperties: false
        },
        tributos: {
          type: "object",
          properties: {
            pis: planejamentoMesesSchema,
            cofins: planejamentoMesesSchema,
            icms: planejamentoMesesSchema,
            ipi: planejamentoMesesSchema,
            iss: planejamentoMesesSchema
          },
          required: ["pis","cofins","icms","ipi","iss"],
          additionalProperties: false
        },
        custos: {
          type: "object",
          properties: {
            industria: {
              type: "object",
              properties: {
                estoqueInicial: planejamentoMesesSchema,
                insumos: planejamentoMesesSchema,
                maoObraDireta: planejamentoMesesSchema,
                ggf: planejamentoMesesSchema,
                estoqueFinal: planejamentoMesesSchema
              },
              required: ["estoqueInicial","insumos","maoObraDireta","ggf","estoqueFinal"],
              additionalProperties: false
            },
            comercio: {
              type: "object",
              properties: {
                estoqueInicial: planejamentoMesesSchema,
                compras: planejamentoMesesSchema,
                estoqueFinal: planejamentoMesesSchema
              },
              required: ["estoqueInicial","compras","estoqueFinal"],
              additionalProperties: false
            },
            servicos: {
              type: "object",
              properties: {
                servicosInicial: planejamentoMesesSchema,
                maoObraDireta: planejamentoMesesSchema,
                gastosDiretos: planejamentoMesesSchema,
                gastosIndiretos: planejamentoMesesSchema,
                servicosFinal: planejamentoMesesSchema
              },
              required: ["servicosInicial","maoObraDireta","gastosDiretos","gastosIndiretos","servicosFinal"],
              additionalProperties: false
            }
          },
          required: ["industria","comercio","servicos"],
          additionalProperties: false
        },
        despesas: {
          type: "object",
          properties: {
            operacionais: planejamentoMesesSchema,
            comerciais: planejamentoMesesSchema,
            administrativas: planejamentoMesesSchema,
            tributarias: planejamentoMesesSchema,
            diretoria: planejamentoMesesSchema,
            logistica: planejamentoMesesSchema,
            ocupacao: planejamentoMesesSchema,
            outras: planejamentoMesesSchema
          },
          required: ["operacionais","comerciais","administrativas","tributarias","diretoria","logistica","ocupacao","outras"],
          additionalProperties: false
        },
        folha: {
          type: "object",
          properties: {
            folha13: planejamentoMesesSchema,
            proLabore: planejamentoMesesSchema,
            inssFgts: planejamentoMesesSchema,
            outros: planejamentoMesesSchema,
            encargosPatronais: planejamentoMesesSchema
          },
          required: ["folha13","proLabore","inssFgts","outros","encargosPatronais"],
          additionalProperties: false
        },
        creditos: {
          type: "object",
          properties: {
            pis: planejamentoMesesSchema,
            cofins: planejamentoMesesSchema,
            icms: planejamentoMesesSchema,
            ipi: planejamentoMesesSchema
          },
          required: ["pis","cofins","icms","ipi"],
          additionalProperties: false
        },
        parametros: {
          type: "object",
          properties: {
            regimeAtual: { type: ["string", "null"] },
            simplesAliquotaEfetiva: { type: ["number", "null"] },
            simplesDas: planejamentoMesesSchema
          },
          required: ["regimeAtual","simplesAliquotaEfetiva","simplesDas"],
          additionalProperties: false
        }
      },
      required: ["faturamento","tributos","custos","despesas","folha","creditos","parametros"],
      additionalProperties: false
    },
    fontes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          campo: { type: "string" },
          valor: { type: "string" },
          documento: { type: "string" },
          competencia: { type: "string" },
          confianca: { type: "string", enum: ["ALTA","MEDIA","BAIXA"] },
          observacao: { type: "string" }
        },
        required: ["campo","valor","documento","competencia","confianca","observacao"],
        additionalProperties: false
      }
    },
    divergencias: { type: "array", items: { type: "string" } },
    dadosFaltantes: { type: "array", items: { type: "string" } },
    documentosAnalisados: { type: "array", items: { type: "string" } },
    observacaoGeral: { type: "string" }
  },
  required: ["identificacao","simplesNacional","base","fontes","divergencias","dadosFaltantes","documentosAnalisados","observacaoGeral"],
  additionalProperties: false
};

const planejamentoConferenciaSchema = {
  type: "object",
  properties: {
    statusBase: {
      type: "string",
      enum: ["COMPLETA", "PARCIAL", "INSUFICIENTE"]
    },
    confiancaGeral: {
      type: "string",
      enum: ["ALTA", "MEDIA", "BAIXA"]
    },
    regimeAtualConfirmado: { type: "string" },
    podeCompararRegimes: { type: "boolean" },
    resumo: { type: "string" },
    alteracoesDetectadas: {
      type: "array",
      items: { type: "string" }
    },
    dadosConfirmados: {
      type: "array",
      items: { type: "string" }
    },
    pontosValidacao: {
      type: "array",
      items: { type: "string" }
    },
    dadosFaltantes: {
      type: "array",
      items: { type: "string" }
    },
    alertasCalculo: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: [
    "statusBase",
    "confiancaGeral",
    "regimeAtualConfirmado",
    "podeCompararRegimes",
    "resumo",
    "alteracoesDetectadas",
    "dadosConfirmados",
    "pontosValidacao",
    "dadosFaltantes",
    "alertasCalculo"
  ],
  additionalProperties: false
};

const planejamentoAnaliseSchema = {
  type:"object",
  properties:{
    resumoExecutivo:{type:"string"}, regimeAtual:{type:"string"}, regimeMenorCargaMatematica:{type:"string"},
    recomendacao:{type:"string"}, justificativa:{type:"string"}, fatorR:{type:"string"},
    riscos:{type:"array",items:{type:"string"}}, oportunidades:{type:"array",items:{type:"string"}},
    validacoesNecessarias:{type:"array",items:{type:"string"}}, dadosFaltantes:{type:"array",items:{type:"string"}},
    ressalvas:{type:"array",items:{type:"string"}}, proximosPassos:{type:"array",items:{type:"string"}},
    confiancaGeral:{type:"string",enum:["ALTA","MEDIA","BAIXA"]}
  },
  required:["resumoExecutivo","regimeAtual","regimeMenorCargaMatematica","recomendacao","justificativa","fatorR","riscos","oportunidades","validacoesNecessarias","dadosFaltantes","ressalvas","proximosPassos","confiancaGeral"],
  additionalProperties:false
};

async function respostaPlanejamentoIA({content,schema,nomeSchema,effort="medium"}) {
  const response = await fetch(`${OPENAI_URL}/responses`, {
    method:"POST",
    headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"content-type":"application/json"},
    body:JSON.stringify({model:MODEL,input:[{role:"user",content}],reasoning:{effort},text:{format:{type:"json_schema",name:nomeSchema,strict:true,schema}}})
  });
  const data = await response.json().catch(()=>null);
  if(!response.ok) throw new Error(data?.error?.message || "Falha na análise estruturada pela IA.");
  const raw = outputText(data);
  let result;
  try { result = JSON.parse(raw); }
  catch { console.error("[tributario][planejamento][json]",raw); throw new Error("A IA respondeu, mas a estrutura do planejamento veio inválida."); }
  return {result,usage:data?.usage||null};
}

async function planejamentoExtrair(req,res){
  const body=req.body||{};
  const arquivos=Array.isArray(body.arquivos)?body.arquivos.filter(a=>a?.fileId):[];
  if(!arquivos.length) return send(res,400,{sucesso:false,error:"Envie ao menos um documento para extração."});
  const content=[];
  for(const arquivo of arquivos) content.push({type:"input_file",file_id:arquivo.fileId});
  content.push({type:"input_text",text:`
Você é o Finder Tax AI. Extraia SOMENTE a base necessária para PLANEJAMENTO TRIBUTÁRIO. NÃO analise IBS, CBS ou transição da Reforma Tributária.

CLIENTE:\n${JSON.stringify(body.cliente||{},null,2)}
ATIVIDADES:\n${JSON.stringify(body.atividades||{},null,2)}
DOCUMENTOS:\n${JSON.stringify(arquivos.map(a=>({filename:a.filename,bytes:a.bytes})),null,2)}

Estrutura inspirada na planilha FS® - Planejamento Tributário:
- faturamento: industria, comercio, servicos, por mês;
- tributos: pis, cofins, icms, ipi, iss;
- custos.industria: estoqueInicial, insumos, maoObraDireta, ggf, estoqueFinal;
- custos.comercio: estoqueInicial, compras, estoqueFinal;
- custos.servicos: servicosInicial, maoObraDireta, gastosDiretos, gastosIndiretos, servicosFinal;
- despesas: operacionais, comerciais, administrativas, tributarias, diretoria, logistica, ocupacao, outras;
- folha: folha13, proLabore, inssFgts, outros, encargosPatronais;
- creditos: pis, cofins, icms, ipi;
- parametros quando comprovados: regimeAtual, simplesAliquotaEfetiva, simplesDas.
Meses: jan, fev, mar, abr, mai, jun, jul, ago, set, out, nov, dez.

REGRAS:
1. Nunca invente valores.
2. Como o schema é estrito, todas as chaves devem existir.
3. Quando um valor não estiver comprovado, retorne null.
4. Zero só pode ser usado quando o documento comprovar valor zero.
5. Diferencie faturamento bruto de base tributável.
6. Em identificacao extraia CNPJ, razão social, abertura, município, UF, regime e regime de apuração.
7. Em simplesNacional extraia competência, RPA, RBT12, RBA, RBAA, DAS, Anexo, atividade, Fator R e composição do DAS.
8. Em receitasHistoricas liste TODAS as competências encontradas no formato MM/AAAA.
9. PGDAS-D pode sustentar receita, RBT12, Anexo, alíquota efetiva e DAS.
10. DRE/balancete/razão podem sustentar receitas, custos, despesas e resultado.
11. Folha/eSocial/pró-labore podem sustentar massa salarial e encargos.
12. EFD/SPED/XML/apurações podem sustentar ICMS, IPI, PIS, COFINS e créditos.
13. Registre fonte, competência e confiança de cada dado relevante.
14. Registre divergências e dados faltantes.
15. Se a declaração disser expressamente prestação de serviços, preencha base.faturamento.servicos. Não duplique a receita em outros grupos.
16. Preencha parametros.simplesDas na competência correspondente.
17. aliquotaEfetivaObservada = DAS total / receita do PA * 100, quando ambos estiverem comprovados.
18. Se o documento disser "Fator r = Não se aplica", retorne fatorRAplicavel=false e fatorR="Não se aplica".
19. Se constar "Folha de Salários Anteriores: Nenhuma", não conclua que a folha contábil é zero. Registre folha/pró-labore como dado faltante para planejamento, salvo documento específico que comprove zero.
20. CNAE não deve ser inventado.
21. Em base.faturamento use jan..dez de 2026 quando esses valores estiverem disponíveis; meses sem comprovação devem ser null.
`});
  try{
    const {result,usage}=await respostaPlanejamentoIA({content,schema:planejamentoExtracaoSchema,nomeSchema:"finder_planejamento_extracao",effort:"medium"});
    return send(res,200,{sucesso:true,modelo:MODEL,extracao:result,usage});
  }catch(error){console.error("[tributario][planejamento-extrair]",error);return send(res,500,{sucesso:false,error:error?.message||"Não foi possível extrair a base do planejamento."});}
}

async function planejamentoConferir(
  req,
  res
) {
  const body =
    req.body ||
    {};

  const content = [
    {
      type: "input_text",
      text: `
Você é o Finder Tax AI atuando como CONFERENTE de um Planejamento Tributário.

IMPORTANTE:
- NÃO trate IBS, CBS ou transição da Reforma Tributária.
- NÃO recalcule tributos livremente.
- NÃO invente valores.
- Compare a extração documental original com a BASE ATUAL, que pode ter sido alterada manualmente pelo consultor.
- Sua função é dizer se a base atual continua coerente para seguir ao comparativo Simples x Presumido x Real.

CLIENTE:
${JSON.stringify(body.cliente || {}, null, 2)}

ATIVIDADES:
${JSON.stringify(body.atividades || {}, null, 2)}

EXTRAÇÃO ORIGINAL DOS DOCUMENTOS:
${JSON.stringify(body.extracaoOriginal || {}, null, 2).slice(0, 70000)}

BASE ATUAL APÓS ALTERAÇÕES:
${JSON.stringify(body.base || {}, null, 2).slice(0, 90000)}

RESPONSÁVEL:
${String(body.responsavel || "")}

ORIGEM:
${String(body.origem || "")}

REGRAS:
1. Identifique mudanças relevantes entre a extração original e a base atual.
2. Alteração manual não é erro por si só; deve ser registrada para rastreabilidade.
3. Confirme o que está suportado por documento, consulta cadastral ou preenchimento manual.
4. Aponte divergências de faturamento, regime, folha, Fator R, custos, despesas e créditos.
5. Se faltarem custos/despesas/créditos, diga que Lucro Real pode estar distorcido.
6. Se Simples estiver baseado apenas em alíquota observada do DAS, registre essa limitação.
7. Se CNAE/atividade real estiverem inconsistentes, bloqueie a conclusão.
8. "podeCompararRegimes" só pode ser true quando houver base mínima razoável para comparação.
9. Mesmo que possa comparar, deixe claro o que ainda precisa validação profissional.
10. O status:
   - COMPLETA = base suficientemente documentada/conferida;
   - PARCIAL = pode avançar com ressalvas;
   - INSUFICIENTE = não deve servir para recomendação final.
`,
    },
  ];

  try {
    const {
      result,
      usage,
    } =
      await respostaPlanejamentoIA({
        content,
        schema:
          planejamentoConferenciaSchema,
        nomeSchema:
          "finder_planejamento_conferencia",
        effort:
          "medium",
      });

    return send(
      res,
      200,
      {
        sucesso: true,
        modelo: MODEL,
        conferencia: result,
        usage,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "[tributario][planejamento-conferir]",
      error
    );

    return send(
      res,
      500,
      {
        sucesso: false,
        error:
          error?.message ||
          "Não foi possível gerar a nova Conferência IA.",
      }
    );
  }
}

async function planejamentoAnalisar(req,res){
  const body=req.body||{};
  const content=[{type:"input_text",text:`
Você é um consultor tributário sênior da Finder of Solutions. Faça SOMENTE PLANEJAMENTO TRIBUTÁRIO para redução LEGAL e eficiência tributária. NÃO analise IBS, CBS ou transição da Reforma Tributária.

CLIENTE:\n${JSON.stringify(body.cliente||{},null,2)}
ATIVIDADES:\n${JSON.stringify(body.atividades||{},null,2)}
BASE:\n${JSON.stringify(body.base||{},null,2).slice(0,85000)}
RESULTADOS DO MOTOR:\n${JSON.stringify(body.calculos||{},null,2).slice(0,85000)}
CENÁRIO: ${JSON.stringify(body.crescimento??0)}

REGRAS:
1. Não recomende automaticamente o regime de menor carga.
2. Diferencie menor carga matemática de recomendação técnica.
3. Questione CNAEs/atividade real, segregação de receitas, folha/pró-labore/Fator R, créditos, custos, despesas, margens, retenções, ICMS/IPI/ISS, encargos e adicional de IRPJ.
4. Se o Simples estiver baseado apenas em alíquota efetiva informada, ressalve.
5. Se o Lucro Real estiver sem custos/despesas/créditos suficientes, reduza a confiança.
6. Nunca invente benefício, crédito, fundamento ou enquadramento.
7. A recomendação deve deixar claro o que depende de conferência profissional.
`}];
  try{
    const {result,usage}=await respostaPlanejamentoIA({content,schema:planejamentoAnaliseSchema,nomeSchema:"finder_planejamento_analise",effort:"high"});
    return send(res,200,{sucesso:true,modelo:MODEL,analise:result,usage});
  }catch(error){console.error("[tributario][planejamento-analisar]",error);return send(res,500,{sucesso:false,error:error?.message||"Não foi possível interpretar o planejamento."});}
}

export default async function handler(
  req,
  res
) {
  const action =
    txt(
      req.query?.action,
      100
    );

  try {
    if (
      action ===
      "listar-projetos" &&
      req.method ===
      "GET"
    ) {
      return await listarProjetos(
        req,
        res
      );
    }

    if (
      action ===
      "obter-projeto" &&
      req.method ===
      "GET"
    ) {
      return await obterProjeto(
        req,
        res
      );
    }

    if (
      action ===
      "salvar-projeto" &&
      req.method ===
      "POST"
    ) {
      return await salvarProjeto(
        req,
        res
      );
    }

    if (
      action ===
      "salvar-diagnostico" &&
      req.method ===
      "POST"
    ) {
      return await salvarDiagnostico(
        req,
        res
      );
    }

    if (
      action ===
      "validar-projeto" &&
      req.method ===
      "POST"
    ) {
      return await validarProjeto(
        req,
        res
      );
    }

    if (
      action ===
      "upload-file" &&
      req.method ===
      "POST"
    ) {
      if (
        !process.env
          .OPENAI_API_KEY
      ) {
        return send(
          res,
          500,
          {
            sucesso:
              false,
            error:
              "OPENAI_API_KEY não configurada.",
          }
        );
      }

      return await uploadFile(
        req,
        res
      );
    }

    if (
      action ===
      "diagnostico" &&
      req.method ===
      "POST"
    ) {
      if (
        !process.env
          .OPENAI_API_KEY
      ) {
        return send(
          res,
          500,
          {
            sucesso:
              false,
            error:
              "OPENAI_API_KEY não configurada.",
          }
        );
      }

      return await diagnostico(
        req,
        res
      );
    }

    if (
      action ===
      "planejamento-extrair" &&
      req.method ===
      "POST"
    ) {
      if (!process.env.OPENAI_API_KEY) return send(res,500,{sucesso:false,error:"OPENAI_API_KEY não configurada."});
      return await planejamentoExtrair(req,res);
    }

    if (
      action ===
      "planejamento-conferir" &&
      req.method ===
      "POST"
    ) {
      if (
        !process.env
          .OPENAI_API_KEY
      ) {
        return send(
          res,
          500,
          {
            sucesso:
              false,
            error:
              "OPENAI_API_KEY não configurada.",
          }
        );
      }

      return await planejamentoConferir(
        req,
        res
      );
    }

    if (
      action ===
      "planejamento-analisar" &&
      req.method ===
      "POST"
    ) {
      if (!process.env.OPENAI_API_KEY) return send(res,500,{sucesso:false,error:"OPENAI_API_KEY não configurada."});
      return await planejamentoAnalisar(req,res);
    }

    return send(
      res,
      400,
      {
        sucesso:
          false,

        error:
          "Ação tributária inválida.",
      }
    );
  } catch (
    error
  ) {
    console.error(
      "[tributario]",
      error
    );

    return send(
      res,
      500,
      {
        sucesso:
          false,

        error:
          error?.message ||
          "Erro interno no módulo tributário.",
      }
    );
  }
}
