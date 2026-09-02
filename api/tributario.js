import { neon } from "@neondatabase/serverless";
import { createHash } from "node:crypto";
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
              arquivado BOOLEAN NOT NULL DEFAULT FALSE,
              arquivado_em TIMESTAMPTZ,
              arquivado_por_nome TEXT NOT NULL DEFAULT '',
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
          ALTER TABLE tax_projects
          ADD COLUMN IF NOT EXISTS arquivado BOOLEAN NOT NULL DEFAULT FALSE
        `;

        await sql`
          ALTER TABLE tax_projects
          ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ
        `;

        await sql`
          ALTER TABLE tax_projects
          ADD COLUMN IF NOT EXISTS arquivado_por_nome TEXT NOT NULL DEFAULT ''
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

        await sql`
          CREATE TABLE IF NOT EXISTS
            tax_documents (
              id BIGSERIAL PRIMARY KEY,
              projeto_id TEXT NOT NULL DEFAULT '',
              cnpj TEXT NOT NULL DEFAULT '',
              tipo_projeto TEXT NOT NULL DEFAULT '',
              categoria TEXT NOT NULL DEFAULT '',
              filename TEXT NOT NULL DEFAULT '',
              mime_type TEXT NOT NULL DEFAULT '',
              bytes INTEGER NOT NULL DEFAULT 0,
              sha256 TEXT NOT NULL DEFAULT '',
              file_base64 TEXT NOT NULL DEFAULT '',
              ativo BOOLEAN NOT NULL DEFAULT TRUE,
              criado_por_id TEXT NOT NULL DEFAULT '',
              criado_por_nome TEXT NOT NULL DEFAULT '',
              removido_por_nome TEXT NOT NULL DEFAULT '',
              criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              removido_em TIMESTAMPTZ
            )
        `;

        await sql`
          CREATE INDEX IF NOT EXISTS
            idx_tax_documents_cnpj
          ON tax_documents (
            cnpj,
            ativo,
            criado_em DESC
          )
        `;

        await sql`
          CREATE INDEX IF NOT EXISTS
            idx_tax_documents_projeto
          ON tax_documents (
            projeto_id,
            ativo,
            criado_em DESC
          )
        `;

        await sql`
          CREATE INDEX IF NOT EXISTS
            idx_tax_documents_hash
          ON tax_documents (
            cnpj,
            sha256
          )
        `;

        await sql`
          CREATE TABLE IF NOT EXISTS
            tax_project_snapshots (
              id BIGSERIAL PRIMARY KEY,
              projeto_id TEXT NOT NULL,
              versao INTEGER NOT NULL DEFAULT 1,
              tipo_projeto TEXT NOT NULL DEFAULT '',
              status TEXT NOT NULL DEFAULT '',
              cnpj TEXT NOT NULL DEFAULT '',
              cliente_nome TEXT NOT NULL DEFAULT '',
              projeto JSONB NOT NULL DEFAULT '{}'::jsonb,
              documentos JSONB NOT NULL DEFAULT '[]'::jsonb,
              criado_por_id TEXT NOT NULL DEFAULT '',
              criado_por_nome TEXT NOT NULL DEFAULT '',
              criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `;

        await sql`
          CREATE UNIQUE INDEX IF NOT EXISTS
            idx_tax_project_snapshots_versao
          ON tax_project_snapshots (
            projeto_id,
            versao
          )
        `;

        await sql`
          CREATE INDEX IF NOT EXISTS
            idx_tax_project_snapshots_projeto
          ON tax_project_snapshots (
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

async function criarSnapshotProjeto({
  projetoId,
  tipoProjeto,
  status,
  cnpj,
  clienteNome,
  body,
  user,
}) {
  await ensureSchema();

  const cnpjLimpo = txt(cnpj, 30).replace(/\D/g, "");

  const versoes = await sql`
    SELECT COALESCE(MAX(versao), 0)::int AS max
    FROM tax_project_snapshots
    WHERE projeto_id = ${projetoId}
  `;

  const versao = Number(versoes?.[0]?.max || 0) + 1;

  const docs = await sql`
    SELECT
      id,
      projeto_id,
      cnpj,
      tipo_projeto,
      categoria,
      filename,
      mime_type,
      bytes,
      sha256,
      ativo,
      criado_por_nome,
      criado_em
    FROM tax_documents
    WHERE
      ativo = TRUE
      AND (
        (${cnpjLimpo} <> '' AND cnpj = ${cnpjLimpo})
        OR
        projeto_id = ${projetoId}
      )
    ORDER BY criado_em ASC
  `;

  const documentos = docs.map((row) => ({
    id: row.id,
    projetoId: row.projeto_id,
    cnpj: row.cnpj,
    tipoProjeto: row.tipo_projeto,
    categoria: row.categoria,
    filename: row.filename,
    mimeType: row.mime_type,
    bytes: row.bytes,
    sha256: row.sha256,
    ativo: Boolean(row.ativo),
    criadoPorNome: row.criado_por_nome,
    criadoEm: row.criado_em,
  }));

  await sql`
    INSERT INTO tax_project_snapshots (
      projeto_id,
      versao,
      tipo_projeto,
      status,
      cnpj,
      cliente_nome,
      projeto,
      documentos,
      criado_por_id,
      criado_por_nome
    )
    VALUES (
      ${projetoId},
      ${versao},
      ${txt(tipoProjeto, 80)},
      ${txt(status, 80)},
      ${cnpjLimpo},
      ${txt(clienteNome, 300)},
      ${JSON.stringify(jsonSeguro(body) || {})},
      ${JSON.stringify(documentos)},
      ${txt(user?.sub, 200)},
      ${txt(user?.nome || user?.login || "Usuário", 200)}
    )
  `;

  return { versao, documentos };
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

  const backup = await criarSnapshotProjeto({
    projetoId: id,
    tipoProjeto: body.tipoProjeto,
    status: body.status || "EM_ANALISE",
    cnpj,
    clienteNome,
    body,
    user,
  });

  await addHistory(
    id,
    "BACKUP_AUTOMATICO",
    `Backup automático V${backup.versao} salvo.`,
    {
      versao: backup.versao,
      documentos: backup.documentos.map((d) => ({
        id: d.id,
        filename: d.filename,
        sha256: d.sha256,
      })),
    },
    user
  );

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
      backup: {
        versao: backup.versao,
        documentos: backup.documentos.length,
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

  const arquivamento =
    txt(
      req.query?.arquivamento ||
      "ATIVOS",
      30
    ).toUpperCase();

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
        arquivado,
        arquivado_em,
        arquivado_por_nome,
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
        AND (
          ${arquivamento} = 'TODOS'
          OR (
            ${arquivamento} = 'ARQUIVADOS'
            AND arquivado = TRUE
          )
          OR (
            ${arquivamento} = 'ATIVOS'
            AND arquivado = FALSE
          )
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
            arquivado:
              Boolean(row.arquivado),
            arquivadoEm:
              row.arquivado_em,
            arquivadoPorNome:
              row.arquivado_por_nome,
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


  const backups = await sql`
    SELECT
      id,
      versao,
      tipo_projeto,
      status,
      cnpj,
      cliente_nome,
      projeto,
      documentos,
      criado_por_nome,
      criado_em
    FROM tax_project_snapshots
    WHERE projeto_id = ${id}
    ORDER BY versao DESC
    LIMIT 50
  `;

  const cnpjProjeto = txt(row.cnpj || "", 30).replace(/\D/g, "");

  const documentosAtuais = await sql`
    SELECT
      id,
      projeto_id,
      cnpj,
      tipo_projeto,
      categoria,
      filename,
      mime_type,
      bytes,
      sha256,
      ativo,
      criado_por_nome,
      criado_em
    FROM tax_documents
    WHERE
      ativo = TRUE
      AND (
        projeto_id = ${id}
        OR (
          ${cnpjProjeto} <> ''
          AND cnpj = ${cnpjProjeto}
        )
      )
    ORDER BY criado_em DESC
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
        arquivado:
          Boolean(row.arquivado),
        arquivadoEm:
          row.arquivado_em,
        arquivadoPorNome:
          row.arquivado_por_nome,
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

        backups:
          backups.map((b) => ({
            id: b.id,
            versao: b.versao,
            tipoProjeto: b.tipo_projeto,
            status: b.status,
            cnpj: b.cnpj,
            clienteNome: b.cliente_nome,
            projeto: b.projeto || {},
            documentos: b.documentos || [],
            criadoPorNome: b.criado_por_nome,
            criadoEm: b.criado_em,
          })),

        documentos:
          documentosAtuais.map((d) => ({
            id: d.id,
            projetoId: d.projeto_id,
            cnpj: d.cnpj,
            tipoProjeto: d.tipo_projeto,
            categoria: d.categoria,
            filename: d.filename,
            mimeType: d.mime_type,
            bytes: d.bytes,
            sha256: d.sha256,
            ativo: Boolean(d.ativo),
            criadoPorNome: d.criado_por_nome,
            criadoEm: d.criado_em,
          })),

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

async function arquivarProjeto(req,res){
  await ensureSchema();
  const body=req.body||{};
  const id=txt(body.id,200);
  const arquivado=body.arquivado!==false;
  const user=authUser(req);

  if(!id) return send(res,400,{sucesso:false,error:"ID do projeto é obrigatório."});

  const rows=await sql`SELECT id, cliente_nome FROM tax_projects WHERE id=${id} LIMIT 1`;
  if(!rows?.[0]) return send(res,404,{sucesso:false,error:"Projeto não encontrado."});

  await sql`
    UPDATE tax_projects
    SET
      arquivado=${arquivado},
      arquivado_em=${arquivado ? new Date() : null},
      arquivado_por_nome=${arquivado ? txt(user?.nome||user?.login||"Usuário",200) : ""},
      atualizado_em=NOW()
    WHERE id=${id}
  `;

  await addHistory(
    id,
    arquivado ? "PROJETO_ARQUIVADO" : "PROJETO_REATIVADO",
    arquivado ? "Inteligência tributária arquivada." : "Inteligência tributária reativada.",
    {},
    user
  );

  return send(res,200,{sucesso:true,arquivado});
}

async function excluirProjeto(req,res){
  await ensureSchema();
  const body=req.body||{};
  const id=txt(body.id,200);
  const confirmacao=txt(body.confirmacao,300);
  const user=authUser(req);

  if(!id) return send(res,400,{sucesso:false,error:"ID do projeto é obrigatório."});

  const rows=await sql`SELECT id, cliente_nome, cnpj FROM tax_projects WHERE id=${id} LIMIT 1`;
  const projeto=rows?.[0];
  if(!projeto) return send(res,404,{sucesso:false,error:"Projeto não encontrado."});

  if(confirmacao!=="EXCLUIR"){
    return send(res,400,{sucesso:false,error:'Para excluir definitivamente, envie confirmação "EXCLUIR".'});
  }

  // Exclusão definitiva e transacional: histórico/diagnósticos pertencem ao projeto.
  await sql`DELETE FROM tax_diagnostics WHERE projeto_id=${id}`;
  await sql`DELETE FROM tax_history WHERE projeto_id=${id}`;
  await sql`DELETE FROM tax_projects WHERE id=${id}`;

  console.log("[tributario][excluir-projeto]",{
    id,
    cliente:projeto.cliente_nome,
    cnpj:projeto.cnpj,
    usuario:user?.nome||user?.login||"Usuário"
  });

  return send(res,200,{sucesso:true,id});
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

async function enviarBufferOpenAI({
  buffer,
  filename,
  mimeType,
}) {
  const form = new FormData();

  form.append("purpose", "user_data");
  form.append("expires_after[anchor]", "created_at");
  form.append("expires_after[seconds]", "86400");
  form.append(
    "file",
    new Blob(
      [buffer],
      { type: mimeType || "application/octet-stream" }
    ),
    filename
  );

  const response = await fetch(
    `${OPENAI_URL}/files`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: form,
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.id) {
    console.error("[tributario][upload-openai]", data);
    throw new Error(
      data?.error?.message ||
      "A OpenAI não aceitou o documento."
    );
  }

  return data.id;
}

async function salvarDocumentoBanco({
  projetoId,
  cnpj,
  tipoProjeto,
  categoria,
  filename,
  mimeType,
  buffer,
  user,
}) {
  await ensureSchema();

  const hash = createHash("sha256")
    .update(buffer)
    .digest("hex");

  const cnpjLimpo = txt(cnpj, 30).replace(/\D/g, "");

  const existente = await sql`
    SELECT
      id,
      projeto_id,
      cnpj,
      tipo_projeto,
      categoria,
      filename,
      mime_type,
      bytes,
      sha256,
      criado_por_nome,
      criado_em
    FROM tax_documents
    WHERE
      cnpj = ${cnpjLimpo}
      AND sha256 = ${hash}
      AND ativo = TRUE
    ORDER BY criado_em DESC
    LIMIT 1
  `;

  if (existente?.[0]) {
    return {
      documento: {
        id: existente[0].id,
        projetoId: existente[0].projeto_id,
        cnpj: existente[0].cnpj,
        tipoProjeto: existente[0].tipo_projeto,
        categoria: existente[0].categoria,
        filename: existente[0].filename,
        mimeType: existente[0].mime_type,
        bytes: existente[0].bytes,
        sha256: existente[0].sha256,
        criadoPorNome: existente[0].criado_por_nome,
        criadoEm: existente[0].criado_em,
      },
      duplicado: true,
    };
  }

  const inserted = await sql`
    INSERT INTO tax_documents (
      projeto_id,
      cnpj,
      tipo_projeto,
      categoria,
      filename,
      mime_type,
      bytes,
      sha256,
      file_base64,
      criado_por_id,
      criado_por_nome
    )
    VALUES (
      ${txt(projetoId, 200)},
      ${cnpjLimpo},
      ${txt(tipoProjeto, 80)},
      ${txt(categoria || tipoProjeto || "tributario", 120)},
      ${txt(filename, 500)},
      ${txt(mimeType, 200)},
      ${buffer.length},
      ${hash},
      ${buffer.toString("base64")},
      ${txt(user?.sub, 200)},
      ${txt(user?.nome || user?.login || "Usuário", 200)}
    )
    RETURNING
      id,
      projeto_id,
      cnpj,
      tipo_projeto,
      categoria,
      filename,
      mime_type,
      bytes,
      sha256,
      criado_por_nome,
      criado_em
  `;

  const row = inserted?.[0];

  if (projetoId) {
    await addHistory(
      projetoId,
      "DOCUMENTO_ADICIONADO",
      `Documento ${filename} adicionado ao arquivo do cliente.`,
      {
        documentoId: row?.id || null,
        filename,
        bytes: buffer.length,
        categoria: categoria || tipoProjeto || "tributario",
      },
      user
    );
  }

  return {
    documento: {
      id: row?.id,
      projetoId: row?.projeto_id,
      cnpj: row?.cnpj,
      tipoProjeto: row?.tipo_projeto,
      categoria: row?.categoria,
      filename: row?.filename,
      mimeType: row?.mime_type,
      bytes: row?.bytes,
      sha256: row?.sha256,
      criadoPorNome: row?.criado_por_nome,
      criadoEm: row?.criado_em,
    },
    duplicado: false,
  };
}

async function uploadFile(req, res) {
  const {
    filename,
    mimeType,
    fileData,
    projetoId = "",
    cnpj = "",
    tipoProjeto = "",
    categoria = "",
    persistir = true,
  } = req.body || {};

  if (!filename || !fileData) {
    return send(res, 400, {
      sucesso: false,
      error: "Arquivo e nome do arquivo são obrigatórios.",
    });
  }

  const buffer = Buffer.from(
    stripDataUrl(fileData),
    "base64"
  );

  if (!buffer.length) {
    return send(res, 400, {
      sucesso: false,
      error: "Arquivo vazio.",
    });
  }

  if (buffer.length > MAX_FILE_BYTES) {
    return send(res, 413, {
      sucesso: false,
      error: `${filename} ultrapassa 3 MB. Reduza ou divida o arquivo.`,
    });
  }

  let documento = null;
  let duplicado = false;

  if (persistir !== false && (txt(cnpj, 30) || txt(projetoId, 200))) {
    const saved = await salvarDocumentoBanco({
      projetoId,
      cnpj,
      tipoProjeto,
      categoria,
      filename,
      mimeType,
      buffer,
      user: authUser(req),
    });

    documento = saved.documento;
    duplicado = saved.duplicado;
  }

  const fileId = await enviarBufferOpenAI({
    buffer,
    filename,
    mimeType,
  });

  return send(res, 200, {
    sucesso: true,
    fileId,
    filename,
    bytes: buffer.length,
    documentoId: documento?.id || null,
    documento,
    duplicado,
  });
}

async function listarDocumentos(req, res) {
  await ensureSchema();

  const projetoId = txt(req.query?.projetoId, 200);
  const cnpj = txt(req.query?.cnpj, 30).replace(/\D/g, "");
  const tipoProjeto = txt(req.query?.tipoProjeto, 80);
  const incluirRemovidos =
    txt(req.query?.incluirRemovidos, 10).toLowerCase() === "true";

  if (!projetoId && !cnpj) {
    return send(res, 400, {
      sucesso: false,
      error: "Informe projetoId ou CNPJ para listar documentos.",
    });
  }

  const rows = await sql`
    SELECT
      id,
      projeto_id,
      cnpj,
      tipo_projeto,
      categoria,
      filename,
      mime_type,
      bytes,
      sha256,
      ativo,
      criado_por_nome,
      removido_por_nome,
      criado_em,
      removido_em
    FROM tax_documents
    WHERE
      (
        (
          ${cnpj} <> ''
          AND cnpj = ${cnpj}
        )
        OR
        (
          ${projetoId} <> ''
          AND projeto_id = ${projetoId}
        )
      )
      AND (
        ${tipoProjeto} = ''
        OR tipo_projeto = ${tipoProjeto}
        OR tipo_projeto = ''
      )
      AND (
        ${incluirRemovidos} = TRUE
        OR ativo = TRUE
      )
    ORDER BY
      ativo DESC,
      criado_em DESC
    LIMIT 500
  `;

  return send(res, 200, {
    sucesso: true,
    documentos: rows.map((row) => ({
      id: row.id,
      projetoId: row.projeto_id,
      cnpj: row.cnpj,
      tipoProjeto: row.tipo_projeto,
      categoria: row.categoria,
      filename: row.filename,
      mimeType: row.mime_type,
      bytes: row.bytes,
      sha256: row.sha256,
      ativo: Boolean(row.ativo),
      criadoPorNome: row.criado_por_nome,
      removidoPorNome: row.removido_por_nome,
      criadoEm: row.criado_em,
      removidoEm: row.removido_em,
    })),
  });
}

async function removerDocumento(req, res) {
  await ensureSchema();

  const id = Number(req.body?.id || 0);
  const user = authUser(req);

  if (!id) {
    return send(res, 400, {
      sucesso: false,
      error: "ID do documento é obrigatório.",
    });
  }

  const rows = await sql`
    SELECT id, projeto_id, filename
    FROM tax_documents
    WHERE id = ${id}
    LIMIT 1
  `;

  if (!rows?.[0]) {
    return send(res, 404, {
      sucesso: false,
      error: "Documento não encontrado.",
    });
  }

  await sql`
    UPDATE tax_documents
    SET
      ativo = FALSE,
      removido_em = NOW(),
      removido_por_nome = ${txt(user?.nome || user?.login || "Usuário", 200)}
    WHERE id = ${id}
  `;

  if (rows[0].projeto_id) {
    await addHistory(
      rows[0].projeto_id,
      "DOCUMENTO_REMOVIDO",
      `Documento ${rows[0].filename} removido do arquivo ativo do cliente.`,
      { documentoId: id },
      user
    );
  }

  return send(res, 200, { sucesso: true, id });
}

async function prepararDocumentosIa(req, res) {
  await ensureSchema();

  const ids = Array.isArray(req.body?.documentoIds)
    ? req.body.documentoIds
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v) && v > 0)
    : [];

  if (!ids.length) {
    return send(res, 400, {
      sucesso: false,
      error: "Selecione ao menos um documento do arquivo do cliente.",
    });
  }

  const rows = await sql`
    SELECT
      id,
      filename,
      mime_type,
      bytes,
      file_base64
    FROM tax_documents
    WHERE
      id = ANY(${ids})
      AND ativo = TRUE
    ORDER BY criado_em ASC
  `;

  if (!rows.length) {
    return send(res, 404, {
      sucesso: false,
      error: "Nenhum documento ativo encontrado para análise.",
    });
  }

  const arquivos = [];

  for (const row of rows) {
    const buffer = Buffer.from(row.file_base64 || "", "base64");

    if (!buffer.length) {
      continue;
    }

    const fileId = await enviarBufferOpenAI({
      buffer,
      filename: row.filename,
      mimeType: row.mime_type,
    });

    arquivos.push({
      documentId: row.id,
      fileId,
      filename: row.filename,
      bytes: row.bytes,
    });
  }

  return send(res, 200, {
    sucesso: true,
    arquivos,
  });
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
    statusBase: { type: "string", enum: ["COMPLETA", "PARCIAL", "INSUFICIENTE"] },
    confiancaGeral: { type: "string", enum: ["ALTA", "MEDIA", "BAIXA"] },
    regimeAtualConfirmado: { type: "string" },
    podeCompararRegimes: { type: "boolean" },
    resumo: { type: "string" },
    alteracoesDetectadas: { type: "array", items: { type: "string" } },
    dadosConfirmados: { type: "array", items: { type: "string" } },
    pontosValidacao: { type: "array", items: { type: "string" } },
    dadosFaltantes: { type: "array", items: { type: "string" } },
    naoAplicaveis: { type: "array", items: { type: "string" } },
    periodosNaoExigiveis: { type: "array", items: { type: "string" } },
    alertasCalculo: { type: "array", items: { type: "string" } },
    qualidadeBase: {
      type: "object",
      properties: {
        documentalPct: { type: "number" },
        cadastralPct: { type: "number" },
        manualPct: { type: "number" },
        calculadoPct: { type: "number" },
        pendentePct: { type: "number" },
        observacao: { type: "string" }
      },
      required: ["documentalPct","cadastralPct","manualPct","calculadoPct","pendentePct","observacao"],
      additionalProperties: false
    },
    premissas: { type: "array", items: { type: "string" } },
    beneficiosFiscais: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nome: { type: "string" },
          tributo: { type: "string" },
          situacao: { type: "string", enum: ["APLICAVEL","POTENCIAL_VALIDAR","NAO_APLICAVEL","NAO_IDENTIFICADO"] },
          descricao: { type: "string" },
          requisitos: { type: "array", items: { type: "string" } },
          fundamentoLegal: { type: "string" },
          artigo: { type: "string" },
          vigencia: { type: "string" },
          fonteOficial: { type: "string" },
          jurisprudencia: { type: "string" },
          efeitoFinanceiro: { type: ["number","null"] },
          observacao: { type: "string" }
        },
        required: ["nome","tributo","situacao","descricao","requisitos","fundamentoLegal","artigo","vigencia","fonteOficial","jurisprudencia","efeitoFinanceiro","observacao"],
        additionalProperties: false
      }
    },
    riscosTributarios: { type: "array", items: { type: "string" } },
    oportunidades: { type: "array", items: { type: "string" } },
    planoAcao: {
      type: "object",
      properties: {
        imediato: { type: "array", items: { type: "string" } },
        antesMudancaRegime: { type: "array", items: { type: "string" } },
        acompanhamento: { type: "array", items: { type: "string" } }
      },
      required: ["imediato","antesMudancaRegime","acompanhamento"],
      additionalProperties: false
    }
  },
  required: ["statusBase","confiancaGeral","regimeAtualConfirmado","podeCompararRegimes","resumo","alteracoesDetectadas","dadosConfirmados","pontosValidacao","dadosFaltantes","naoAplicaveis","periodosNaoExigiveis","alertasCalculo","qualidadeBase","premissas","beneficiosFiscais","riscosTributarios","oportunidades","planoAcao"],
  additionalProperties: false
};

const planejamentoAnaliseSchema = {
  type:"object",
  properties:{
    resumoExecutivo:{type:"string"}, regimeAtual:{type:"string"}, regimeMenorCargaMatematica:{type:"string"},
    statusRecomendacao:{type:"string",enum:["RECOMENDADO","TENDENCIA","INCONCLUSIVO"]},
    regimeRecomendado:{type:"string"},
    motivosRecomendacao:{type:"array",items:{type:"string"}},
    recomendacao:{type:"string"}, justificativa:{type:"string"}, fatorR:{type:"string"},
    riscos:{type:"array",items:{type:"string"}}, oportunidades:{type:"array",items:{type:"string"}},
    validacoesNecessarias:{type:"array",items:{type:"string"}}, dadosFaltantes:{type:"array",items:{type:"string"}},
    ressalvas:{type:"array",items:{type:"string"}}, proximosPassos:{type:"array",items:{type:"string"}},
    confiancaGeral:{type:"string",enum:["ALTA","MEDIA","BAIXA"]}
  },
  required:["resumoExecutivo","regimeAtual","regimeMenorCargaMatematica","statusRecomendacao","regimeRecomendado","motivosRecomendacao","recomendacao","justificativa","fatorR","riscos","oportunidades","validacoesNecessarias","dadosFaltantes","ressalvas","proximosPassos","confiancaGeral"],
  additionalProperties:false
};

async function respostaPlanejamentoIA({content,schema,nomeSchema,effort="medium",webSearch=false}) {
  const payload={
    model:MODEL,
    input:[{role:"user",content}],
    reasoning:{effort},
    text:{format:{type:"json_schema",name:nomeSchema,strict:true,schema}}
  };

  if(webSearch){
    payload.tools=[{
      type:"web_search",
      search_context_size:"high",
      filters:{
        allowed_domains:[
          "gov.br",
          "receita.fazenda.gov.br",
          "normas.receita.fazenda.gov.br",
          "planalto.gov.br",
          "fazenda.pr.gov.br",
          "legislacao.pr.gov.br",
          "confaz.fazenda.gov.br"
        ]
      }
    }];
  }

  const response = await fetch(`${OPENAI_URL}/responses`, {
    method:"POST",
    headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"content-type":"application/json"},
    body:JSON.stringify(payload)
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
21. O período jan..dez representa o ANO/PERÍODO efetivamente presente no documento. NÃO force 2026. Se a planilha trouxer 2027, use jan..dez de 2027 e registre o ano nas fontes/observação geral.
22. Em planilhas/checklists, examine TODAS as abas relevantes, não apenas a primeira.
23. Se houver aba equivalente a "Dados Básicos", extraia CNPJ, razão social, CNAE principal e secundários.
24. Se houver aba equivalente a "Receita", classifique cada linha pela natureza real: indústria, comércio ou serviços. Não some a mesma receita em mais de um grupo.
25. Se houver aba "Compras/Insumos", valores explicitamente mensais de insumos fabris devem alimentar custos.industria.insumos; compras de mercadoria para revenda devem alimentar custos.comercio.compras; serviços terceirizados diretamente ligados à produção/prestação podem alimentar GGF/gastos diretos quando a classificação estiver clara.
26. Se houver aba "Despesas", valor rotulado como MENSAL pode ser replicado em jan..dez do período analisado, porque o próprio documento afirma recorrência mensal. Classifique aluguel/energia/água/internet em ocupação/administrativas; marketing em comerciais; fretes/logística em logistica; contabilidade/financeiro/software em administrativas; demais itens conforme natureza. Registre a regra de rateio/classificação em fontes.
27. Se houver aba "Folha", valor rotulado como folha bruta MENSAL deve alimentar folha.folha13 nos 12 meses do cenário atual; pró-labore deve ir em folha.proLabore; INSS/FGTS em folha.inssFgts; encargos patronais em folha.encargosPatronais. NÃO use o cenário futuro de aumento de produção como folha atual sem identificá-lo como projeção.
28. Se o documento trouxer "cenário atual" e "cenário futuro/projetado", a BASE principal deve usar o atual; projeções devem ser registradas em fontes/observações para uso em cenários, sem substituir silenciosamente o atual.
29. Não transforme total anual em valor mensal e não replique valor pontual como recorrente sem indicação explícita.
30. Se houver várias fontes para o mesmo campo, priorize documento fiscal/contábil oficial sobre checklist gerencial e registre divergência.
31. Se o CNPJ estiver em qualquer documento, extraia-o mesmo que o usuário não tenha informado CNPJ antes do upload.
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
1. A data de referência é a data atual do servidor: ${new Date().toISOString().slice(0,10)}.
2. Nunca classifique mês futuro como dado faltante. Coloque-o em periodosNaoExigiveis.
3. Mês corrente ainda não encerrado não deve ser exigido como faturamento definitivo.
4. Se CNAE, descrição operacional ou outro dado já estiver preenchido na BASE ATUAL/ATIVIDADES, não o repita como pendência; registre como dado manual quando não houver documento.
5. Diferencie: DADO FALTANTE, NÃO APLICÁVEL, PERÍODO NÃO EXIGÍVEL e DADO INFORMADO MANUALMENTE.
6. Alteração manual não é erro; registre-a para rastreabilidade.
7. Não exija estoque de empresa sem operação com estoque. Não exija ICMS/IPI quando não aplicáveis.
8. Custos, despesas, folha, retenções e créditos só são pendências quando materialmente necessários ao regime/operação.
9. Se faltarem custos/despesas/créditos relevantes, alerte que o Lucro Real pode estar distorcido.
10. Se o Simples usar somente alíquota observada histórica, registre a limitação.
11. Incompatibilidade entre CNAE e atividade real deve ir para validação e pode bloquear recomendação final.
12. podeCompararRegimes pode ser true em base PARCIAL apenas para simulação preliminar.
13. qualidadeBase representa cobertura/origem dos dados, não uma falsa precisão estatística. Explique a metodologia.
14. Registre em premissas a competência de corte, dados manuais, projeções e limitações.
15. Benefício fiscal nunca pode ser afirmado apenas pelo CNAE. Considere atividade real, operação, município/UF, regime e requisitos.
16. Não invente lei, artigo, jurisprudência, súmula, tema, processo, solução de consulta ou fonte.
17. Só marque benefício como APLICAVEL quando houver fundamento jurídico identificável e requisitos compatíveis.
18. Sem fonte jurídica verificável no contexto, use POTENCIAL_VALIDAR ou NAO_IDENTIFICADO e escreva "Pesquisa jurídica externa necessária".
19. fonteOficial deve identificar o órgão/fonte, mas não invente URL.
20. jurisprudencia só deve conter precedente conhecido no contexto; caso contrário: "Não pesquisada nesta etapa".
21. efeitoFinanceiro deve ser null sem base objetiva suficiente.
22. Não misture IBS/CBS/Reforma Tributária nesta conferência.
23. Riscos, oportunidades e plano de ação devem decorrer somente dos dados disponíveis.
24. Nunca transforme ausência documental em zero.
25. Quando não houver suporte, declare a necessidade de validação/pesquisa.
26. Faça pesquisa jurídica externa em fontes OFICIAIS para benefícios fiscais, regimes especiais, créditos presumidos, diferimentos, reduções de base, isenções e tratamentos setoriais potencialmente relacionados à atividade REAL/CNAEs/UF/município.
27. Não pesquise benefício apenas pelo CNAE. Cruze produto/serviço, NCM quando disponível, CFOP/operação, destino, regime, estabelecimento industrial/comercial e requisitos objetivos.
28. Para cada benefício potencial, indique situação, requisitos, fundamento legal, vigência e fonte oficial. Se a pesquisa oficial não confirmar, marque NAO_IDENTIFICADO ou POTENCIAL_VALIDAR.
29. Procure também oportunidades legítimas de redução de carga que não sejam "benefício fiscal": segregação correta de receitas, créditos válidos, regime de apuração, retenções, compensações, enquadramento por atividade, organização societária e melhoria documental — sem criar operação artificial.
30. Dê prioridade a legislação vigente na data atual e sinalize regra futura/revogada separadamente.`,
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
8. O campo statusRecomendacao deve ser:
   - RECOMENDADO somente quando a base é suficiente e existe vantagem técnica defensável;
   - TENDENCIA quando há um regime provável, mas faltam validações materiais;
   - INCONCLUSIVO quando não há base para decisão.
9. regimeRecomendado deve conter SIMPLES_NACIONAL, LUCRO_PRESUMIDO, LUCRO_REAL ou vazio quando INCONCLUSIVO.
10. Explique em motivosRecomendacao por que o regime é ou não vantajoso, incluindo carga, margem, folha, créditos, natureza das receitas, obrigações e riscos.
11. Para Lucro Real, IRPJ/CSLL não incidem sobre faturamento: avalie o lucro fiscal estimado antes de IRPJ/CSLL e ressalve adições, exclusões e compensações.
12. Para Lucro Presumido, não aceite presunção única em atividade mista. Confira a segregação indústria/comércio/serviços e o período trimestral do adicional de IRPJ.
13. Para Simples, crescimento pode alterar RBT12/faixa/alíquota efetiva; não congele a alíquota histórica quando houver Anexo e RBT12 suficientes.
`}];
  try{
    const {result,usage}=await respostaPlanejamentoIA({content,schema:planejamentoAnaliseSchema,nomeSchema:"finder_planejamento_analise",effort:"high"});
    return send(res,200,{sucesso:true,modelo:MODEL,analise:result,usage});
  }catch(error){console.error("[tributario][planejamento-analisar]",error);return send(res,500,{sucesso:false,error:error?.message||"Não foi possível interpretar o planejamento."});}
}



// =========================================================
// REFORMA TRIBUTÁRIA V2 — EXTRAÇÃO DOCUMENTAL
// ADIÇÃO INCREMENTAL: não altera Planejamento Tributário nem rotas validadas.
// =========================================================

const reformaExtracaoSchema = {
  type: "object",
  properties: {
    identificacao: {
      type: "object",
      properties: {
        cnpj: { type: ["string", "null"] },
        razaoSocial: { type: ["string", "null"] },
        nomeFantasia: { type: ["string", "null"] },
        municipio: { type: ["string", "null"] },
        uf: { type: ["string", "null"] },
        regime: { type: ["string", "null"] },
        competencia: { type: ["string", "null"] },
        periodoInicial: { type: ["string", "null"] },
        periodoFinal: { type: ["string", "null"] }
      },
      required: [
        "cnpj","razaoSocial","nomeFantasia","municipio","uf","regime",
        "competencia","periodoInicial","periodoFinal"
      ],
      additionalProperties: false
    },

    operacao: {
      type: "object",
      properties: {
        descricao: { type: ["string", "null"] },
        setorAtividade: { type: ["string", "null"] },
        tipoEstabelecimento: { type: ["string", "null"] },
        b2bPct: { type: ["number", "null"] },
        b2cPct: { type: ["number", "null"] },
        exportacaoPct: { type: ["number", "null"] },
        possuiFiliais: { type: ["boolean", "null"] },
        quantidadeEstabelecimentos: { type: ["number", "null"] },
        municipiosOperacao: { type: "array", items: { type: "string" } },
        ufsOperacao: { type: "array", items: { type: "string" } }
      },
      required: [
        "descricao","setorAtividade","tipoEstabelecimento","b2bPct","b2cPct",
        "exportacaoPct","possuiFiliais","quantidadeEstabelecimentos",
        "municipiosOperacao","ufsOperacao"
      ],
      additionalProperties: false
    },

    economicos: {
      type: "object",
      properties: {
        receitaPeriodo: { type: ["number", "null"] },
        faturamentoAnual: { type: ["number", "null"] },
        faturamentoMensalMedio: { type: ["number", "null"] },
        comprasPeriodo: { type: ["number", "null"] },
        servicosTomadosPeriodo: { type: ["number", "null"] },
        custosDespesasPeriodo: { type: ["number", "null"] },
        custosDespesasAnuais: { type: ["number", "null"] },
        margemLucroPct: { type: ["number", "null"] },
        folhaMensal: { type: ["number", "null"] },
        proLaboreMensal: { type: ["number", "null"] },
        folha12Meses: { type: ["number", "null"] },
        rbt12: { type: ["number", "null"] }
      },
      required: [
        "receitaPeriodo","faturamentoAnual","faturamentoMensalMedio",
        "comprasPeriodo","servicosTomadosPeriodo","custosDespesasPeriodo",
        "custosDespesasAnuais","margemLucroPct","folhaMensal","proLaboreMensal",
        "folha12Meses","rbt12"
      ],
      additionalProperties: false
    },

    simples: {
      type: "object",
      properties: {
        anexo: { type: ["string", "null"] },
        faixa: { type: ["string", "null"] },
        aliquotaEfetivaPct: { type: ["number", "null"] },
        dasPeriodo: { type: ["number", "null"] },
        fatorRPct: { type: ["number", "null"] },
        fatorRAplicavel: { type: ["boolean", "null"] }
      },
      required: [
        "anexo","faixa","aliquotaEfetivaPct","dasPeriodo","fatorRPct","fatorRAplicavel"
      ],
      additionalProperties: false
    },

    tributos: {
      type: "object",
      properties: {
        totalPeriodo: { type: ["number", "null"] },
        pis: { type: ["number", "null"] },
        cofins: { type: ["number", "null"] },
        icms: { type: ["number", "null"] },
        iss: { type: ["number", "null"] },
        ipi: { type: ["number", "null"] },
        cpp: { type: ["number", "null"] },
        irpj: { type: ["number", "null"] },
        csll: { type: ["number", "null"] },
        outros: { type: ["number", "null"] },
        aliquotaIssPct: { type: ["number", "null"] },
        aliquotaIcmsPct: { type: ["number", "null"] },
        creditosAtuais: { type: ["number", "null"] }
      },
      required: [
        "totalPeriodo","pis","cofins","icms","iss","ipi","cpp","irpj","csll",
        "outros","aliquotaIssPct","aliquotaIcmsPct","creditosAtuais"
      ],
      additionalProperties: false
    },

    tratamentos: {
      type: "object",
      properties: {
        incentivoPisCofins: { type: ["string", "null"] },
        incentivoIcms: { type: ["string", "null"] },
        incentivoIss: { type: ["string", "null"] },
        beneficioSetorial: { type: ["string", "null"] },
        presuncaoHospitalarIndicadaDocumento: { type: ["boolean", "null"] },
        observacoes: { type: "array", items: { type: "string" } }
      },
      required: [
        "incentivoPisCofins","incentivoIcms","incentivoIss","beneficioSetorial",
        "presuncaoHospitalarIndicadaDocumento","observacoes"
      ],
      additionalProperties: false
    },

    documentosReconhecidos: {
      type: "array",
      items: { type: "string" }
    },

    fontes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          campo: { type: "string" },
          valor: { type: "string" },
          documento: { type: "string" },
          paginaOuReferencia: { type: ["string", "null"] },
          confianca: { type: "string", enum: ["ALTA","MEDIA","BAIXA"] }
        },
        required: ["campo","valor","documento","paginaOuReferencia","confianca"],
        additionalProperties: false
      }
    },

    divergencias: {
      type: "array",
      items: { type: "string" }
    },

    dadosNaoComprovados: {
      type: "array",
      items: { type: "string" }
    },

    sugestoesPreenchimentoManual: {
      type: "array",
      items: { type: "string" }
    },

    confiancaGeral: {
      type: "string",
      enum: ["ALTA","MEDIA","BAIXA"]
    }
  },

  required: [
    "identificacao","operacao","economicos","simples","tributos","tratamentos",
    "documentosReconhecidos","fontes","divergencias","dadosNaoComprovados",
    "sugestoesPreenchimentoManual","confiancaGeral"
  ],

  additionalProperties: false
};

async function reformaExtrair(
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
      ? body.arquivos.filter(
          (a) =>
            a?.fileId
        )
      : [];

  if (
    !arquivos.length
  ) {
    return send(
      res,
      400,
      {
        sucesso: false,
        error:
          "Envie ao menos um documento para extração da Reforma Tributária.",
      }
    );
  }

  const content = [];

  for (
    const arquivo of
      arquivos
  ) {
    content.push({
      type:
        "input_file",
      file_id:
        arquivo.fileId,
    });
  }

  content.push({
    type:
      "input_text",

    text: `
Você é o Finder Tax AI atuando SOMENTE como extrator documental do módulo Reforma Tributária.

OBJETIVO:
Ler todos os documentos anexados e extrair SOMENTE informações comprovadas nos arquivos.

DOCUMENTOS:
${JSON.stringify(
  arquivos.map(
    (a) => ({
      filename:
        a.filename,
      bytes:
        a.bytes,
    })
  ),
  null,
  2
)}

REGRAS OBRIGATÓRIAS:
1. Leia TODOS os arquivos em conjunto e consolide os dados por empresa/período.
2. Identifique CNPJ, razão social, nome fantasia, município, UF, regime e períodos quando comprovados.
3. NÃO invente CNAE. O CNPJ será usado depois pelo sistema para consultar CNAEs oficiais.
4. Reconheça PGDAS-D, DAS, DEFIS, DRE, balancete, razão, SPED/EFD, NF-e, NFS-e, apurações, relatórios de faturamento/compras/vendas/folha e demais documentos fiscais/contábeis.
5. Preencha a OPERAÇÃO quando houver suporte documental: descrição, setor, empresa única/múltiplos estabelecimentos, municípios/UFs, B2B/B2C e exportação.
6. Preencha DADOS ECONÔMICOS sempre que o documento permitir: receita do período, faturamento anual/RBT12, média mensal, compras, serviços tomados, custos/despesas, margem, folha, pró-labore e folha 12 meses.
7. Se houver PGDAS/DAS, extraia Anexo, faixa quando comprovável, alíquota efetiva, DAS e Fator R. O campo simples.anexo SOMENTE pode ser preenchido quando o documento declarar expressamente o Anexo aplicável àquela receita/atividade (ex.: "Anexo III"). NÃO deduza Anexo por CNAE, descrição da atividade, alíquota, Fator R ou conhecimento geral. Se houver receitas enquadradas em anexos diferentes, não escolha um único Anexo: use null em simples.anexo e registre a divergência/necessidade de segregação. NÃO calcule Fator R sem bases suficientes.
8. Extraia tributos separadamente: PIS, Cofins, ICMS, ISS, IPI, CPP, IRPJ, CSLL, outros, total e créditos atuais.
9. Se houver alíquota de ISS/ICMS documental, extraia. Não estime alíquota ausente.
10. Identifique incentivos/benefícios SOMENTE se constarem nos documentos. Não conclua aplicabilidade jurídica nesta etapa.
11. Margem de lucro só pode ser preenchida quando houver DRE/balancete ou dados suficientes e objetivos. Caso contrário use null.
12. Faturamento anual pode ser preenchido por valor anual explícito ou RBT12 comprovado. Não anualize um único mês como fato documental.
13. B2B/B2C somente com documento que permita identificação objetiva dos clientes/vendas. Caso contrário null.
14. Zero só quando o documento demonstrar zero. Ausência de dado = null.
15. Para CADA campo relevante preenchido, registre fonte, documento, página/referência se disponível e confiança.
16. Registre divergências entre documentos, especialmente faturamento, regime, tributos e período.
17. Em sugestoesPreenchimentoManual, liste os dados importantes para a simulação que não puderam ser comprovados (ex.: margem, folha, pró-labore, B2B/B2C, compras, despesas, alíquota atual).
18. NÃO faça cálculo de IBS/CBS, recomendação de regime ou pesquisa legal nesta etapa.
19. NÃO invente benefício, alíquota, lei, artigo, NCM, NBS, classificação fiscal ou jurisprudência.
20. Todos os campos do schema devem existir.
21. Campo não comprovado = null, false somente quando comprovadamente falso, ou array vazio.
`,
  });

  try {
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
            JSON.stringify({
              model:
                MODEL,

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
                    "finder_reforma_extracao",
                  strict:
                    true,
                  schema:
                    reformaExtracaoSchema,
                },
              },
            }),
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
        "[tributario][reforma-extrair]",
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
            "Falha na interpretação documental da Reforma Tributária.",
        }
      );
    }

    const raw =
      outputText(
        data
      );

    let extracao;

    try {
      extracao =
        JSON.parse(
          raw
        );
    } catch {
      console.error(
        "[tributario][reforma-extrair][json]",
        raw
      );

      return send(
        res,
        500,
        {
          sucesso:
            false,

          error:
            "A IA respondeu, mas a extração da Reforma Tributária veio em formato inválido.",
        }
      );
    }

    return send(
      res,
      200,
      {
        sucesso: true,
        modelo:
          MODEL,
        extracao,
        usage:
          data?.usage ||
          null,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "[tributario][reforma-extrair]",
      error
    );

    return send(
      res,
      500,
      {
        sucesso: false,
        error:
          error?.message ||
          "Não foi possível interpretar os documentos da Reforma Tributária.",
      }
    );
  }
}


const reformaAnaliseSchema = {
  type: "object",
  properties: {
    dataBase: { type: "string" },
    confianca: { type: "string", enum: ["ALTA","MEDIA","BAIXA"] },
    resumo: { type: "string" },
    impactos: { type: "array", items: { type: "string" } },
    creditos: { type: "array", items: { type: "string" } },
    precificacao: { type: "array", items: { type: "string" } },
    transicao: { type: "array", items: { type: "string" } },
    riscos: { type: "array", items: { type: "string" } },
    oportunidades: { type: "array", items: { type: "string" } },
    adequacoes: { type: "array", items: { type: "string" } },
    dadosFaltantes: { type: "array", items: { type: "string" } },
    fundamentacao: { type: "array", items: { type: "string" } },
    planoAcao: { type: "array", items: { type: "string" } },
    matrizImpacto: {
      type: "array",
      items: {
        type: "object",
        properties: {
          area: { type: "string" },
          nivel: { type: "string", enum: ["ALTO","MEDIO","BAIXO","NAO_AVALIADO"] },
          diagnostico: { type: "string" }
        },
        required: ["area","nivel","diagnostico"],
        additionalProperties: false
      }
    }
  },
  required: ["dataBase","confianca","resumo","impactos","creditos","precificacao","transicao","riscos","oportunidades","adequacoes","dadosFaltantes","fundamentacao","planoAcao","matrizImpacto"],
  additionalProperties: false
};

async function reformaAnalisar(req,res){
  if(!process.env.OPENAI_API_KEY){
    return send(res,500,{sucesso:false,error:"OPENAI_API_KEY não configurada."});
  }

  const body=req.body||{};
  const baseAtual=jsonSeguro(body.base||{});
  const dataBase=new Date().toISOString().slice(0,10);

  const prompt=`Você é o motor técnico do módulo Finder Intelligence — Reforma Tributária do Consumo brasileira.

DATA-BASE DA ANÁLISE: ${dataBase}

OBJETIVO:
Produzir diagnóstico empresarial de IBS, CBS e transição, SEM inventar números, alíquotas, créditos, benefícios, leis ou jurisprudência.

BASE ATUAL INFORMADA:
${JSON.stringify(baseAtual,null,2)}

DOCUMENTOS REGISTRADOS:
${JSON.stringify(jsonSeguro(body.documentos||[]),null,2)}

REGRAS OBRIGATÓRIAS:
1. Considere CNAE apenas como indício cadastral; atividade real e operação prevalecem para diagnóstico.
2. Diferencie B2B e B2C e explique impactos sobre crédito, repasse, preço e margem apenas qualitativamente quando faltarem dados.
3. Não presuma direito a crédito IBS/CBS. Aponte quais aquisições precisam ser classificadas/validadas.
4. Não invente alíquota-padrão definitiva, carga líquida ou economia.
5. Não trate ausência de informação como zero.
6. Não trate período futuro como pendência.
7. Identifique impactos em precificação, margem, caixa, contratos, ERP, documentos fiscais, cadastro de itens, fornecedores e clientes.
8. Para transição, somente afirme marcos jurídicos que você tenha segurança de que estão vigentes na data-base. Quando houver dúvida, escreva "validar na legislação vigente".
9. Fundamentação: não invente lei, artigo, ato, nota técnica, solução de consulta, jurisprudência ou URL.
10. Quando a fonte jurídica não estiver disponível no contexto, escreva "Pesquisa jurídica externa necessária".
11. Não use blogs como autoridade jurídica.
12. Dados faltantes devem conter somente informações materialmente necessárias à análise da empresa.
13. Gere matriz para: Carga tributária, Créditos, Precificação, Margem, Caixa, Contratos, ERP/Faturamento, Cadastro de produtos/serviços, Fornecedores, Clientes B2B/B2C e Benefícios atuais.
14. Classifique impacto ALTO/MEDIO/BAIXO somente quando a base permitir; caso contrário NAO_AVALIADO.
15. O relatório é diagnóstico preliminar e não substitui validação profissional/legal.
16. Não misture o comparativo Simples/Presumido/Real do módulo Planejamento Tributário; aqui o foco é Reforma Tributária do Consumo.
`;

  try{
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL||"gpt-5-mini",
        input:prompt,
        text:{
          format:{
            type:"json_schema",
            name:"finder_reforma_tributaria",
            strict:true,
            schema:reformaAnaliseSchema
          }
        }
      })
    });

    const raw=await response.json();
    if(!response.ok) throw new Error(raw?.error?.message||"Falha ao analisar Reforma Tributária.");

    const outputText=
      raw.output_text ||
      raw.output?.flatMap(x=>x.content||[]).find(x=>x.type==="output_text")?.text ||
      "";

    const analise=JSON.parse(outputText);
    return send(res,200,{sucesso:true,analise,usage:raw.usage||null});
  }catch(error){
    console.error("[tributario][reforma-analisar]",error);
    return send(res,500,{sucesso:false,error:error?.message||"Não foi possível gerar o diagnóstico da Reforma Tributária."});
  }
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
      "arquivar-projeto" &&
      req.method ===
      "POST"
    ) {
      return await arquivarProjeto(req,res);
    }

    if (
      action ===
      "excluir-projeto" &&
      req.method ===
      "POST"
    ) {
      return await excluirProjeto(req,res);
    }

    if (
      action ===
      "reforma-extrair" &&
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

      return await reformaExtrair(
        req,
        res
      );
    }

    if (
      action ===
      "reforma-analisar" &&
      req.method ===
      "POST"
    ) {
      return await reformaAnalisar(req,res);
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
      action === "listar-documentos" &&
      req.method === "GET"
    ) {
      return await listarDocumentos(req, res);
    }

    if (
      action === "remover-documento" &&
      req.method === "POST"
    ) {
      return await removerDocumento(req, res);
    }

    if (
      action === "preparar-documentos-ia" &&
      req.method === "POST"
    ) {
      if (!process.env.OPENAI_API_KEY) {
        return send(res, 500, {
          sucesso: false,
          error: "OPENAI_API_KEY não configurada.",
        });
      }

      return await prepararDocumentosIa(req, res);
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
