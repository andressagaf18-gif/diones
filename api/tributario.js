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
              mercado: { type: "string", enum: ["INTERNO","EXTERNO"] },
              natureza: { type: "string", enum: ["NAO_IDENTIFICADA","COMERCIO","INDUSTRIA","SERVICOS"] }
            },
            required: ["competencia","receita","mercado","natureza"],
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
            naoSegregado: planejamentoMesesSchema,
            industria: planejamentoMesesSchema,
            comercio: planejamentoMesesSchema,
            servicos: planejamentoMesesSchema
          },
          required: ["naoSegregado","industria","comercio","servicos"],
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
- faturamento: naoSegregado, industria, comercio, servicos, por mês;
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
8.0. Inclua também a competência atual do PGDAS e crie uma entrada por atividade quando o item 3 discriminar comércio, indústria ou serviços; a soma dessas entradas deve coincidir com o RPA.
8.1. Para cada item histórico, informe natureza=NAO_IDENTIFICADA quando o PGDAS trouxer apenas o total; use COMERCIO, INDUSTRIA ou SERVICOS somente quando o próprio documento discriminar a natureza.
8.2. No ano da competência analisada, transporte receitas históricas sem natureza para base.faturamento.naoSegregado. Não rateie, estime ou duplique em indústria/comércio/serviços.
9. PGDAS-D pode sustentar receita, RBT12, Anexo, alíquota efetiva e DAS.
10. DRE/balancete/razão podem sustentar receitas, custos, despesas e resultado.
11. Folha/eSocial/pró-labore podem sustentar massa salarial e encargos.
12. EFD/SPED/XML/apurações podem sustentar ICMS, IPI, PIS, COFINS e créditos.
13. Registre fonte, competência e confiança de cada dado relevante.
14. Registre divergências e dados faltantes.
15. Se a declaração disser expressamente prestação de serviços, preencha base.faturamento.servicos. Não duplique a receita em outros grupos.
16. Preencha parametros.simplesDas na competência correspondente.
16.1. A composição do DAS pertence a simplesNacional.composicaoDas. Não copie PIS, COFINS, ICMS ou IPI contidos no DAS para base.tributos, pois essas parcelas não representam os débitos do regime normal.
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
29.1. Nunca crie projeções de comércio ou indústria para preencher meses ausentes. Meses futuros sem documento devem permanecer null.
30. Se houver várias fontes para o mesmo campo, priorize documento fiscal/contábil oficial sobre checklist gerencial e registre divergência.
31. Se o CNPJ estiver em qualquer documento, extraia-o mesmo que o usuário não tenha informado CNPJ antes do upload.
`});
  try{
    const {result,usage}=await respostaPlanejamentoIA({content,schema:planejamentoExtracaoSchema,nomeSchema:"finder_planejamento_extracao",effort:"medium"});
    return send(res,200,{sucesso:true,modelo:MODEL,extracao:result,usage});
  }catch(error){console.error("[tributario][planejamento-extrair]",error);return send(res,500,{sucesso:false,error:error?.message||"Não foi possível extrair a base do planejamento."});}
}

async function planejamentoConferir(req,res){
  const body=req.body||{};
  const content=[{type:"input_text",text:`
Você é o Finder Tax AI atuando como CONFERENTE de planejamento tributário.
Não recalcule livremente e nunca invente valores.

CLIENTE:\n${JSON.stringify(body.cliente||{},null,2)}
ATIVIDADES:\n${JSON.stringify(body.atividades||{},null,2)}
EXTRAÇÃO DOCUMENTAL:\n${JSON.stringify(body.extracaoOriginal||{},null,2).slice(0,70000)}
BASE ATUAL:\n${JSON.stringify(body.base||{},null,2).slice(0,90000)}

REGRAS OBRIGATÓRIAS:
1. Receita histórica do PGDAS sem natureza deve permanecer como NÃO SEGREGADA; nunca rateie entre comércio e indústria.
2. Receita segregada no próprio PA deve permanecer na natureza documental.
3. Não some receita não segregada novamente às receitas segregadas do mesmo mês.
4. Não crie projeções para meses futuros.
5. Comércio e indústria usam, em regra, 8% de presunção para IRPJ e 12% para CSLL; a falta de divisão entre essas duas naturezas não impede o cálculo federal quando estiver comprovado que não há serviços.
6. ICMS de 19,5% no Paraná é somente débito interno preliminar; exija validação de créditos, ST, benefícios e destino.
7. IPI depende de NCM/TIPI. Sem NCM confirmado, mantenha-o pendente.
8. No Lucro Real, se o lucro fiscal do período for zero ou negativo, IRPJ, adicional e CSLL devem ser zero.
9. Compare todos os regimes no mesmo período e sobre a mesma receita.
10. Informe claramente tudo que impedir recomendação conclusiva.
`}];
  try{
    const {result,usage}=await respostaPlanejamentoIA({content,schema:planejamentoConferenciaSchema,nomeSchema:"finder_planejamento_conferencia",effort:"medium",webSearch:false});
    return send(res,200,{sucesso:true,modelo:MODEL,conferencia:result,usage});
  }catch(error){
    console.error("[tributario][planejamento-conferir]",error);
    return send(res,500,{sucesso:false,error:error?.message||"Não foi possível conferir o planejamento."});
  }
}

async function planejamentoAnalisar(req,res){
  const body=req.body||{};
  const content=[{type:"input_text",text:`
Você é o Finder Tax AI. Interprete o cálculo determinístico abaixo e emita uma análise técnica prudente.

CLIENTE:\n${JSON.stringify(body.cliente||{},null,2)}
ATIVIDADES:\n${JSON.stringify(body.atividades||{},null,2)}
BASE:\n${JSON.stringify(body.base||{},null,2).slice(0,90000)}
CÁLCULOS DO MOTOR:\n${JSON.stringify(body.calculos||{},null,2).slice(0,90000)}
CRESCIMENTO SELECIONADO: ${Number(body.crescimento||0)}%

REGRAS:
1. Não substitua os valores calculados pelo motor.
2. Não recomende regime quando períodos, receitas ou premissas não forem comparáveis.
3. No Simples, os componentes são informativos e já estão dentro do DAS.
4. No Presumido, diferencie tributos sobre receita de IRPJ/CSLL sobre bases presumidas.
5. No Real, IRPJ/CSLL somente existem sobre lucro fiscal positivo; prejuízo implica zero desses tributos no período.
6. ICMS estimado por alíquota interna não equivale a imposto líquido. Ressalve créditos, ST, benefícios e operações interestaduais.
7. IPI sem NCM/TIPI confirmado é pendência material.
8. Menor carga matemática não é automaticamente o melhor regime.
9. Destaque riscos, dados faltantes e validações necessárias.
`}];
  try{
    const {result,usage}=await respostaPlanejamentoIA({content,schema:planejamentoAnaliseSchema,nomeSchema:"finder_planejamento_analise",effort:"high",webSearch:false});
    return send(res,200,{sucesso:true,modelo:MODEL,analise:result,usage});
  }catch(error){
    console.error("[tributario][planejamento-analisar]",error);
    return send(res,500,{sucesso:false,error:error?.message||"Não foi possível analisar o planejamento."});
  }
}

export default async function handler(req,res){
  if(req.method==="OPTIONS")return res.status(204).end();
  const action=txt(req.query?.action,100);
  const routes={
    "salvar-projeto":salvarProjeto,
    "salvar-diagnostico":salvarDiagnostico,
    "listar-projetos":listarProjetos,
    "obter-projeto":obterProjeto,
    "arquivar-projeto":arquivarProjeto,
    "excluir-projeto":excluirProjeto,
    "validar-projeto":validarProjeto,
    "upload-file":uploadFile,
    "listar-documentos":listarDocumentos,
    "remover-documento":removerDocumento,
    "preparar-documentos-ia":prepararDocumentosIa,
    "diagnostico":diagnostico,
    "planejamento-extrair":planejamentoExtrair,
    "planejamento-conferir":planejamentoConferir,
    "planejamento-analisar":planejamentoAnalisar
  };
  const route=routes[action];
  if(!route)return send(res,404,{sucesso:false,error:"Ação tributária não encontrada."});
  try{return await route(req,res)}
  catch(error){
    console.error(`[tributario][${action}]`,error);
    return send(res,500,{sucesso:false,error:error?.message||"Erro interno no módulo tributário."});
  }
}
