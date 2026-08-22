import { neon } from "@neondatabase/serverless";
import crypto from "crypto";

const sql = neon(process.env.DATABASE_URL);
let schemaPromise = null;

// =========================================================
// HELPERS
// =========================================================

function txt(v, n = 1000) {
  return String(v ?? "")
    .trim()
    .slice(0, n);
}

function jsonSeguro(v) {
  try {
    return JSON.parse(
      JSON.stringify(
        v ?? null
      )
    );
  } catch {
    return null;
  }
}

function base64url(v) {
  return Buffer
    .from(v)
    .toString("base64url");
}

function segredo() {
  return (
    process.env.AUTH_SECRET ||
    process.env.ADMIN_TOKEN ||
    process.env.ADMIN_PASSWORD ||
    ""
  );
}

function assinar(payload) {
  const body =
    base64url(
      JSON.stringify(payload)
    );

  const sig =
    crypto
      .createHmac(
        "sha256",
        segredo()
      )
      .update(body)
      .digest("base64url");

  return `${body}.${sig}`;
}

function validarToken(token) {
  try {
    const [body, sig] =
      String(
        token || ""
      ).split(".");

    if (
      !body ||
      !sig ||
      !segredo()
    ) {
      return null;
    }

    const esperado =
      crypto
        .createHmac(
          "sha256",
          segredo()
        )
        .update(body)
        .digest("base64url");

    const a =
      Buffer.from(sig);

    const b =
      Buffer.from(esperado);

    if (
      a.length !== b.length ||
      !crypto.timingSafeEqual(
        a,
        b
      )
    ) {
      return null;
    }

    const payload =
      JSON.parse(
        Buffer.from(
          body,
          "base64url"
        ).toString(
          "utf8"
        )
      );

    if (
      !payload?.exp ||
      Date.now() >
        payload.exp
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function tokenReq(req) {
  const h =
    req.headers
      ?.authorization ||
    "";

  return h.startsWith(
    "Bearer "
  )
    ? h.slice(7)
    : "";
}

function hashSenha(
  senha,
  salt =
    crypto
      .randomBytes(16)
      .toString("hex")
) {
  const hash =
    crypto
      .pbkdf2Sync(
        String(senha),
        salt,
        120000,
        32,
        "sha256"
      )
      .toString("hex");

  return `${salt}:${hash}`;
}

function confereSenha(
  senha,
  gravada
) {
  try {
    const [salt, hash] =
      String(
        gravada
      ).split(":");

    if (!salt || !hash) {
      return false;
    }

    const calc =
      hashSenha(
        senha,
        salt
      ).split(":")[1];

    const a =
      Buffer.from(hash);

    const b =
      Buffer.from(calc);

    if (
      a.length !== b.length
    ) {
      return false;
    }

    return crypto
      .timingSafeEqual(
        a,
        b
      );
  } catch {
    return false;
  }
}

function slugOrigem(valor) {
  return String(
    valor || ""
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    )
    .slice(0, 80);
}

function dataOuNull(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  const d =
    new Date(valor);

  if (
    Number.isNaN(
      d.getTime()
    )
  ) {
    return null;
  }

  return d.toISOString();
}

// =========================================================
// BANCO / SCHEMA
// =========================================================

async function schema() {
  if (!schemaPromise) {
    schemaPromise =
      (async () => {

        // -----------------------------
        // USUÁRIOS
        // -----------------------------
        await sql`
          CREATE TABLE IF NOT EXISTS
            finder_usuarios (
              id UUID PRIMARY KEY,
              nome TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              login TEXT NOT NULL UNIQUE,
              senha_hash TEXT NOT NULL,
              tipo_acesso TEXT NOT NULL DEFAULT 'SISTEMA',
              perfil TEXT NOT NULL DEFAULT 'CONSULTOR',
              permissoes JSONB NOT NULL DEFAULT '{}'::jsonb,
              ativo BOOLEAN NOT NULL DEFAULT TRUE,
              criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              ultimo_acesso_em TIMESTAMPTZ
            )
        `;

        // -----------------------------
        // AUDITORIA
        // -----------------------------
        await sql`
          CREATE TABLE IF NOT EXISTS
            finder_auditoria (
              id UUID PRIMARY KEY,
              usuario_id UUID,
              usuario_nome TEXT,
              usuario_login TEXT,
              tipo_acesso TEXT,
              acao TEXT NOT NULL,
              modulo TEXT,
              recurso TEXT,
              recurso_id TEXT,
              descricao TEXT,
              antes JSONB,
              depois JSONB,
              detalhes JSONB,
              ip TEXT,
              user_agent TEXT,
              criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `;

        await sql`
          CREATE INDEX IF NOT EXISTS
            idx_finder_auditoria_data
          ON finder_auditoria (
            criado_em DESC
          )
        `;

        await sql`
          CREATE INDEX IF NOT EXISTS
            idx_finder_auditoria_usuario
          ON finder_auditoria (
            usuario_id,
            criado_em DESC
          )
        `;

        // -----------------------------
        // EVENTOS E ORIGENS
        // -----------------------------
        await sql`
          CREATE TABLE IF NOT EXISTS
            finder_eventos_origens (
              id UUID PRIMARY KEY,
              nome TEXT NOT NULL,
              origem TEXT NOT NULL UNIQUE,
              codigo_hash TEXT NOT NULL,
              campanha TEXT,
              responsavel TEXT,
              descricao TEXT,
              data_inicio TIMESTAMPTZ,
              data_fim TIMESTAMPTZ,
              ativo BOOLEAN NOT NULL DEFAULT TRUE,
              criado_por UUID,
              criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `;

        await sql`
          CREATE INDEX IF NOT EXISTS
            idx_finder_eventos_origens_ativo
          ON finder_eventos_origens (
            ativo,
            origem
          )
        `;

        await sql`
          CREATE INDEX IF NOT EXISTS
            idx_finder_eventos_origens_data
          ON finder_eventos_origens (
            criado_em DESC
          )
        `;
      })();
  }

  return schemaPromise;
}

// =========================================================
// AUDITORIA
// =========================================================

async function auditar(
  req,
  u,
  dados = {}
) {
  await schema();

  await sql`
    INSERT INTO
      finder_auditoria (
        id,
        usuario_id,
        usuario_nome,
        usuario_login,
        tipo_acesso,
        acao,
        modulo,
        recurso,
        recurso_id,
        descricao,
        antes,
        depois,
        detalhes,
        ip,
        user_agent
      )
    VALUES (
      ${crypto.randomUUID()},
      ${u?.sub || null},
      ${u?.nome || ""},
      ${u?.login || ""},
      ${u?.tipo || ""},
      ${txt(
        dados.acao,
        120
      ) || "ACAO"},
      ${txt(
        dados.modulo,
        120
      )},
      ${txt(
        dados.recurso,
        160
      )},
      ${txt(
        dados.recursoId,
        160
      )},
      ${txt(
        dados.descricao,
        2000
      )},
      ${JSON.stringify(
        jsonSeguro(
          dados.antes
        )
      )}::jsonb,
      ${JSON.stringify(
        jsonSeguro(
          dados.depois
        )
      )}::jsonb,
      ${JSON.stringify(
        jsonSeguro(
          dados.detalhes
        )
      )}::jsonb,
      ${txt(
        req.headers?.[
          "x-forwarded-for"
        ] ||
        req.socket
          ?.remoteAddress,
        200
      )},
      ${txt(
        req.headers?.[
          "user-agent"
        ],
        500
      )}
    )
  `;
}

// =========================================================
// AUTENTICAÇÃO
// =========================================================

function adminLegacy(req) {
  const legacy =
    process.env
      .ADMIN_TOKEN ||
    process.env
      .ADMIN_PASSWORD ||
    "";

  return Boolean(
    legacy &&
    tokenReq(req) ===
      legacy
  );
}

function exigir(
  req,
  res,
  admin = false
) {
  if (
    adminLegacy(req)
  ) {
    return {
      sub: null,
      nome:
        "Administrador",
      login:
        "legacy",
      perfil:
        "ADMIN",
      tipo:
        "SISTEMA",
      legacy:
        true,
    };
  }

  const u =
    validarToken(
      tokenReq(req)
    );

  if (!u) {
    res
      .status(401)
      .json({
        sucesso:
          false,
        error:
          "Sessão inválida ou expirada.",
      });

    return null;
  }

  if (
    admin &&
    u.perfil !== "ADMIN"
  ) {
    res
      .status(403)
      .json({
        sucesso:
          false,
        error:
          "Acesso exclusivo do administrador.",
      });

    return null;
  }

  return u;
}

// =========================================================
// EVENTOS - HELPERS
// =========================================================

function eventoPublico(
  row
) {
  if (!row) {
    return null;
  }

  return {
    id:
      row.id,

    nome:
      row.nome,

    origem:
      row.origem,

    campanha:
      row.campanha ||
      "",

    responsavel:
      row.responsavel ||
      "",

    descricao:
      row.descricao ||
      "",

    dataInicio:
      row.data_inicio ||
      null,

    dataFim:
      row.data_fim ||
      null,

    ativo:
      Boolean(
        row.ativo
      ),

    criadoEm:
      row.criado_em ||
      null,

    atualizadoEm:
      row.atualizado_em ||
      null,
  };
}

function eventoEstaValido(
  row
) {
  if (
    !row ||
    row.ativo !== true
  ) {
    return {
      valido: false,
      motivo:
        "Evento inativo.",
    };
  }

  const agora =
    Date.now();

  if (
    row.data_inicio
  ) {
    const inicio =
      new Date(
        row.data_inicio
      ).getTime();

    if (
      Number.isFinite(inicio) &&
      agora < inicio
    ) {
      return {
        valido: false,
        motivo:
          "Este evento ainda não iniciou.",
      };
    }
  }

  if (
    row.data_fim
  ) {
    const fim =
      new Date(
        row.data_fim
      ).getTime();

    if (
      Number.isFinite(fim) &&
      agora > fim
    ) {
      return {
        valido: false,
        motivo:
          "Este evento já foi encerrado.",
      };
    }
  }

  return {
    valido: true,
    motivo: "",
  };
}

// =========================================================
// HANDLER
// =========================================================

export default async function handler(
  req,
  res
) {
  try {
    await schema();

    const action =
      txt(
        req.query?.action ||
        req.body?.action,
        80
      ).toLowerCase();

    // =====================================================
    // LOGIN
    // =====================================================

    if (
      action === "login" &&
      req.method === "POST"
    ) {
      const login =
        txt(
          req.body?.login,
          180
        ).toLowerCase();

      const senha =
        String(
          req.body?.senha ||
          ""
        );

      const tipo =
        txt(
          req.body?.tipo ||
          "SISTEMA",
          30
        ).toUpperCase();

      const rows =
        await sql`
          SELECT *
          FROM finder_usuarios
          WHERE
            (
              LOWER(login) =
                ${login}
              OR LOWER(email) =
                ${login}
            )
            AND ativo = TRUE
          LIMIT 1
        `;

      const user =
        rows?.[0];

      if (
        !user ||
        !confereSenha(
          senha,
          user.senha_hash
        ) ||
        (
          tipo &&
          user.tipo_acesso !==
            tipo &&
          user.tipo_acesso !==
            "AMBOS"
        )
      ) {
        res
          .status(401)
          .json({
            sucesso:
              false,
            error:
              "Login ou senha inválidos para este acesso.",
          });

        return;
      }

      const payload = {
        sub:
          user.id,

        nome:
          user.nome,

        login:
          user.login,

        perfil:
          user.perfil,

        tipo:
          user.tipo_acesso,

        permissoes:
          user.permissoes ||
          {},

        exp:
          Date.now() +
          8 *
          60 *
          60 *
          1000,
      };

      const token =
        assinar(
          payload
        );

      await sql`
        UPDATE finder_usuarios
        SET
          ultimo_acesso_em =
            NOW()
        WHERE
          id =
            ${user.id}
      `;

      await auditar(
        req,
        payload,
        {
          acao:
            "LOGIN",
          modulo:
            "AUTENTICACAO",
          descricao:
            `Login realizado no ${tipo}`,
        }
      );

      res.json({
        sucesso:
          true,

        token,

        usuario:
          payload,
      });

      return;
    }

    // =====================================================
    // BOOTSTRAP
    // =====================================================

    if (
      action === "bootstrap" &&
      req.method === "POST"
    ) {
      const adminToken =
        process.env
          .ADMIN_TOKEN ||
        process.env
          .ADMIN_PASSWORD ||
        "";

      if (
        !adminToken ||
        tokenReq(req) !==
          adminToken
      ) {
        res
          .status(401)
          .json({
            sucesso:
              false,
            error:
              "ADMIN_TOKEN necessário para criar o primeiro administrador.",
          });

        return;
      }

      const qtd =
        await sql`
          SELECT
            COUNT(*)::int
              AS total
          FROM
            finder_usuarios
        `;

      if (
        Number(
          qtd?.[0]
            ?.total ||
          0
        ) > 0
      ) {
        res
          .status(409)
          .json({
            sucesso:
              false,
            error:
              "Já existem usuários cadastrados.",
          });

        return;
      }

      const id =
        crypto
          .randomUUID();

      const nome =
        txt(
          req.body?.nome ||
          "Administrador Finder",
          180
        );

      const email =
        txt(
          req.body?.email,
          180
        ).toLowerCase();

      const login =
        txt(
          req.body?.login,
          120
        ).toLowerCase();

      const senha =
        String(
          req.body?.senha ||
          ""
        );

      if (
        !email ||
        !login ||
        senha.length < 8
      ) {
        res
          .status(400)
          .json({
            sucesso:
              false,
            error:
              "Informe e-mail, login e senha com pelo menos 8 caracteres.",
          });

        return;
      }

      await sql`
        INSERT INTO
          finder_usuarios (
            id,
            nome,
            email,
            login,
            senha_hash,
            tipo_acesso,
            perfil,
            permissoes
          )
        VALUES (
          ${id},
          ${nome},
          ${email},
          ${login},
          ${hashSenha(
            senha
          )},
          'AMBOS',
          'ADMIN',
          ${JSON.stringify({
            tudo: true,
          })}::jsonb
        )
      `;

      res.json({
        sucesso:
          true,
        id,
      });

      return;
    }

    // =====================================================
    // ME
    // =====================================================

    if (
      action === "me" &&
      req.method === "GET"
    ) {
      const u =
        exigir(
          req,
          res,
          false
        );

      if (!u) {
        return;
      }

      res.json({
        sucesso:
          true,
        usuario:
          u,
      });

      return;
    }

    // =====================================================
    // AUDITAR
    // =====================================================

    if (
      action === "auditar" &&
      req.method === "POST"
    ) {
      const u =
        exigir(
          req,
          res,
          false
        );

      if (!u) {
        return;
      }

      await auditar(
        req,
        u,
        req.body ||
        {}
      );

      res.json({
        sucesso:
          true,
      });

      return;
    }

    // =====================================================
    // USUÁRIOS - LISTAR
    // =====================================================

    if (
      action === "usuarios" &&
      req.method === "GET"
    ) {
      const u =
        exigir(
          req,
          res,
          true
        );

      if (!u) {
        return;
      }

      const rows =
        await sql`
          SELECT
            id,
            nome,
            email,
            login,
            tipo_acesso,
            perfil,
            permissoes,
            ativo,
            criado_em,
            atualizado_em,
            ultimo_acesso_em
          FROM
            finder_usuarios
          ORDER BY
            nome
        `;

      res.json({
        sucesso:
          true,
        usuarios:
          rows,
      });

      return;
    }

    // =====================================================
    // USUÁRIOS - CRIAR
    // =====================================================

    if (
      action ===
        "criar-usuario" &&
      req.method === "POST"
    ) {
      const u =
        exigir(
          req,
          res,
          true
        );

      if (!u) {
        return;
      }

      const id =
        crypto
          .randomUUID();

      const nome =
        txt(
          req.body?.nome,
          180
        );

      const email =
        txt(
          req.body?.email,
          180
        ).toLowerCase();

      const login =
        txt(
          req.body?.login,
          120
        ).toLowerCase();

      const senha =
        String(
          req.body?.senha ||
          ""
        );

      const tipo =
        txt(
          req.body
            ?.tipoAcesso ||
          "SISTEMA",
          30
        ).toUpperCase();

      const perfil =
        txt(
          req.body?.perfil ||
          "CONSULTOR",
          40
        ).toUpperCase();

      if (
        !nome ||
        !email ||
        !login ||
        senha.length < 8
      ) {
        res
          .status(400)
          .json({
            sucesso:
              false,
            error:
              "Preencha nome, e-mail, login e senha com no mínimo 8 caracteres.",
          });

        return;
      }

      await sql`
        INSERT INTO
          finder_usuarios (
            id,
            nome,
            email,
            login,
            senha_hash,
            tipo_acesso,
            perfil,
            permissoes
          )
        VALUES (
          ${id},
          ${nome},
          ${email},
          ${login},
          ${hashSenha(
            senha
          )},
          ${tipo},
          ${perfil},
          ${JSON.stringify(
            jsonSeguro(
              req.body
                ?.permissoes
            ) ||
            {}
          )}::jsonb
        )
      `;

      await auditar(
        req,
        u,
        {
          acao:
            "CRIAR_USUARIO",
          modulo:
            "USUARIOS",
          recurso:
            "usuario",
          recursoId:
            id,
          depois: {
            nome,
            email,
            login,
            tipo,
            perfil,
          },
        }
      );

      res.json({
        sucesso:
          true,
        id,
      });

      return;
    }

    // =====================================================
    // USUÁRIOS - ALTERAR
    // =====================================================

    if (
      action ===
        "alterar-usuario" &&
      req.method === "POST"
    ) {
      const u =
        exigir(
          req,
          res,
          true
        );

      if (!u) {
        return;
      }

      const id =
        txt(
          req.body?.id,
          100
        );

      const antigos =
        await sql`
          SELECT
            id,
            nome,
            email,
            login,
            tipo_acesso,
            perfil,
            permissoes,
            ativo
          FROM
            finder_usuarios
          WHERE
            id =
              ${id}
          LIMIT 1
        `;

      if (
        !antigos?.[0]
      ) {
        res
          .status(404)
          .json({
            sucesso:
              false,
            error:
              "Usuário não encontrado.",
          });

        return;
      }

      const a =
        antigos[0];

      const nome =
        txt(
          req.body?.nome ??
          a.nome,
          180
        );

      const email =
        txt(
          req.body?.email ??
          a.email,
          180
        ).toLowerCase();

      const login =
        txt(
          req.body?.login ??
          a.login,
          120
        ).toLowerCase();

      const tipo =
        txt(
          req.body
            ?.tipoAcesso ??
          a.tipo_acesso,
          30
        ).toUpperCase();

      const perfil =
        txt(
          req.body?.perfil ??
          a.perfil,
          40
        ).toUpperCase();

      const ativo =
        req.body?.ativo ===
        undefined
          ? a.ativo
          : Boolean(
              req.body
                .ativo
            );

      const permissoes =
        jsonSeguro(
          req.body
            ?.permissoes ??
          a.permissoes
        ) ||
        {};

      const senha =
        String(
          req.body?.senha ||
          ""
        );

      if (senha) {
        if (
          senha.length < 8
        ) {
          res
            .status(400)
            .json({
              sucesso:
                false,
              error:
                "A nova senha deve ter no mínimo 8 caracteres.",
            });

          return;
        }

        await sql`
          UPDATE
            finder_usuarios
          SET
            nome =
              ${nome},
            email =
              ${email},
            login =
              ${login},
            tipo_acesso =
              ${tipo},
            perfil =
              ${perfil},
            permissoes =
              ${JSON.stringify(
                permissoes
              )}::jsonb,
            ativo =
              ${ativo},
            senha_hash =
              ${hashSenha(
                senha
              )},
            atualizado_em =
              NOW()
          WHERE
            id =
              ${id}
        `;
      } else {
        await sql`
          UPDATE
            finder_usuarios
          SET
            nome =
              ${nome},
            email =
              ${email},
            login =
              ${login},
            tipo_acesso =
              ${tipo},
            perfil =
              ${perfil},
            permissoes =
              ${JSON.stringify(
                permissoes
              )}::jsonb,
            ativo =
              ${ativo},
            atualizado_em =
              NOW()
          WHERE
            id =
              ${id}
        `;
      }

      await auditar(
        req,
        u,
        {
          acao:
            "ALTERAR_USUARIO",
          modulo:
            "USUARIOS",
          recurso:
            "usuario",
          recursoId:
            id,
          antes:
            a,
          depois: {
            nome,
            email,
            login,
            tipo_acesso:
              tipo,
            perfil,
            permissoes,
            ativo,
            senhaAlterada:
              Boolean(senha),
          },
        }
      );

      res.json({
        sucesso:
          true,
      });

      return;
    }

    // =====================================================
    // EVENTOS E ORIGENS - LISTAR
    // GET /api/acessos?action=eventos
    // =====================================================

    if (
      action === "eventos" &&
      req.method === "GET"
    ) {
      const u =
        exigir(
          req,
          res,
          true
        );

      if (!u) {
        return;
      }

      const rows =
        await sql`
          SELECT
            id,
            nome,
            origem,
            campanha,
            responsavel,
            descricao,
            data_inicio,
            data_fim,
            ativo,
            criado_em,
            atualizado_em
          FROM
            finder_eventos_origens
          ORDER BY
            criado_em DESC
        `;

      res.json({
        sucesso:
          true,
        eventos:
          rows.map(
            eventoPublico
          ),
      });

      return;
    }

    // =====================================================
    // EVENTOS E ORIGENS - CRIAR
    // POST /api/acessos?action=criar-evento
    // =====================================================

    if (
      action ===
        "criar-evento" &&
      req.method === "POST"
    ) {
      const u =
        exigir(
          req,
          res,
          true
        );

      if (!u) {
        return;
      }

      const id =
        crypto
          .randomUUID();

      const nome =
        txt(
          req.body?.nome,
          180
        );

      const origem =
        slugOrigem(
          req.body?.origem ||
          nome
        );

      const codigo =
        String(
          req.body?.codigo ||
          ""
        ).trim();

      const campanha =
        txt(
          req.body
            ?.campanha,
          180
        );

      const responsavel =
        txt(
          req.body
            ?.responsavel,
          180
        );

      const descricao =
        txt(
          req.body
            ?.descricao,
          1500
        );

      const dataInicio =
        dataOuNull(
          req.body
            ?.dataInicio
        );

      const dataFim =
        dataOuNull(
          req.body
            ?.dataFim
        );

      if (
        !nome ||
        !origem ||
        codigo.length < 4
      ) {
        res
          .status(400)
          .json({
            sucesso:
              false,
            error:
              "Informe nome, origem e um código de acesso com pelo menos 4 caracteres.",
          });

        return;
      }

      if (
        dataInicio &&
        dataFim &&
        new Date(
          dataFim
        ) <
        new Date(
          dataInicio
        )
      ) {
        res
          .status(400)
          .json({
            sucesso:
              false,
            error:
              "A data final não pode ser anterior à data inicial.",
          });

        return;
      }

      await sql`
        INSERT INTO
          finder_eventos_origens (
            id,
            nome,
            origem,
            codigo_hash,
            campanha,
            responsavel,
            descricao,
            data_inicio,
            data_fim,
            ativo,
            criado_por
          )
        VALUES (
          ${id},
          ${nome},
          ${origem},
          ${hashSenha(
            codigo
          )},
          ${campanha},
          ${responsavel},
          ${descricao},
          ${dataInicio},
          ${dataFim},
          TRUE,
          ${u?.sub || null}
        )
      `;

      await auditar(
        req,
        u,
        {
          acao:
            "CRIAR_EVENTO_ORIGEM",
          modulo:
            "EVENTOS_ORIGENS",
          recurso:
            "evento_origem",
          recursoId:
            id,
          depois: {
            nome,
            origem,
            campanha,
            responsavel,
            dataInicio,
            dataFim,
            ativo:
              true,
          },
        }
      );

      res.json({
        sucesso:
          true,
        id,
        evento: {
          id,
          nome,
          origem,
          campanha,
          responsavel,
          descricao,
          dataInicio,
          dataFim,
          ativo:
            true,
        },
      });

      return;
    }

    // =====================================================
    // EVENTOS E ORIGENS - ALTERAR
    // POST /api/acessos?action=alterar-evento
    // =====================================================

    if (
      action ===
        "alterar-evento" &&
      req.method === "POST"
    ) {
      const u =
        exigir(
          req,
          res,
          true
        );

      if (!u) {
        return;
      }

      const id =
        txt(
          req.body?.id,
          100
        );

      const antigos =
        await sql`
          SELECT *
          FROM
            finder_eventos_origens
          WHERE
            id =
              ${id}
          LIMIT 1
        `;

      const a =
        antigos?.[0];

      if (!a) {
        res
          .status(404)
          .json({
            sucesso:
              false,
            error:
              "Evento/origem não encontrado.",
          });

        return;
      }

      const nome =
        txt(
          req.body?.nome ??
          a.nome,
          180
        );

      const origem =
        slugOrigem(
          req.body?.origem ??
          a.origem
        );

      const campanha =
        txt(
          req.body
            ?.campanha ??
          a.campanha,
          180
        );

      const responsavel =
        txt(
          req.body
            ?.responsavel ??
          a.responsavel,
          180
        );

      const descricao =
        txt(
          req.body
            ?.descricao ??
          a.descricao,
          1500
        );

      const ativo =
        req.body?.ativo ===
        undefined
          ? Boolean(
              a.ativo
            )
          : Boolean(
              req.body
                .ativo
            );

      const dataInicio =
        req.body
          ?.dataInicio ===
        undefined
          ? (
              a.data_inicio
                ? new Date(
                    a.data_inicio
                  ).toISOString()
                : null
            )
          : dataOuNull(
              req.body
                ?.dataInicio
            );

      const dataFim =
        req.body
          ?.dataFim ===
        undefined
          ? (
              a.data_fim
                ? new Date(
                    a.data_fim
                  ).toISOString()
                : null
            )
          : dataOuNull(
              req.body
                ?.dataFim
            );

      const novoCodigo =
        String(
          req.body?.codigo ||
          ""
        ).trim();

      if (
        !nome ||
        !origem
      ) {
        res
          .status(400)
          .json({
            sucesso:
              false,
            error:
              "Nome e origem são obrigatórios.",
          });

        return;
      }

      if (
        novoCodigo &&
        novoCodigo.length < 4
      ) {
        res
          .status(400)
          .json({
            sucesso:
              false,
            error:
              "O novo código deve ter pelo menos 4 caracteres.",
          });

        return;
      }

      if (
        dataInicio &&
        dataFim &&
        new Date(
          dataFim
        ) <
        new Date(
          dataInicio
        )
      ) {
        res
          .status(400)
          .json({
            sucesso:
              false,
            error:
              "A data final não pode ser anterior à data inicial.",
          });

        return;
      }

      if (novoCodigo) {
        await sql`
          UPDATE
            finder_eventos_origens
          SET
            nome =
              ${nome},
            origem =
              ${origem},
            codigo_hash =
              ${hashSenha(
                novoCodigo
              )},
            campanha =
              ${campanha},
            responsavel =
              ${responsavel},
            descricao =
              ${descricao},
            data_inicio =
              ${dataInicio},
            data_fim =
              ${dataFim},
            ativo =
              ${ativo},
            atualizado_em =
              NOW()
          WHERE
            id =
              ${id}
        `;
      } else {
        await sql`
          UPDATE
            finder_eventos_origens
          SET
            nome =
              ${nome},
            origem =
              ${origem},
            campanha =
              ${campanha},
            responsavel =
              ${responsavel},
            descricao =
              ${descricao},
            data_inicio =
              ${dataInicio},
            data_fim =
              ${dataFim},
            ativo =
              ${ativo},
            atualizado_em =
              NOW()
          WHERE
            id =
              ${id}
        `;
      }

      await auditar(
        req,
        u,
        {
          acao:
            "ALTERAR_EVENTO_ORIGEM",
          modulo:
            "EVENTOS_ORIGENS",
          recurso:
            "evento_origem",
          recursoId:
            id,
          antes: {
            id:
              a.id,
            nome:
              a.nome,
            origem:
              a.origem,
            campanha:
              a.campanha,
            responsavel:
              a.responsavel,
            descricao:
              a.descricao,
            dataInicio:
              a.data_inicio,
            dataFim:
              a.data_fim,
            ativo:
              a.ativo,
          },
          depois: {
            id,
            nome,
            origem,
            campanha,
            responsavel,
            descricao,
            dataInicio,
            dataFim,
            ativo,
            codigoAlterado:
              Boolean(
                novoCodigo
              ),
          },
        }
      );

      res.json({
        sucesso:
          true,
      });

      return;
    }

    // =====================================================
    // EVENTOS E ORIGENS - VALIDAR CÓDIGO
    // PÚBLICO
    //
    // POST /api/acessos?action=validar-evento
    //
    // body:
    // {
    //   origem: "xbusiness",
    //   codigo: "XB2026"
    // }
    // =====================================================

    if (
      action ===
        "validar-evento" &&
      req.method === "POST"
    ) {
      const origem =
        slugOrigem(
          req.body?.origem
        );

      const codigo =
        String(
          req.body?.codigo ||
          ""
        ).trim();

      if (
        !origem ||
        !codigo
      ) {
        res
          .status(400)
          .json({
            sucesso:
              false,
            error:
              "Informe a origem e o código do evento.",
          });

        return;
      }

      const rows =
        await sql`
          SELECT *
          FROM
            finder_eventos_origens
          WHERE
            origem =
              ${origem}
          LIMIT 1
        `;

      const evento =
        rows?.[0];

      if (!evento) {
        res
          .status(404)
          .json({
            sucesso:
              false,
            error:
              "Evento/origem não encontrado.",
          });

        return;
      }

      const situacao =
        eventoEstaValido(
          evento
        );

      if (
        !situacao.valido
      ) {
        res
          .status(403)
          .json({
            sucesso:
              false,
            error:
              situacao.motivo,
          });

        return;
      }

      if (
        !confereSenha(
          codigo,
          evento
            .codigo_hash
        )
      ) {
        res
          .status(401)
          .json({
            sucesso:
              false,
            error:
              "Código de acesso inválido.",
          });

        return;
      }

      const sessaoEvento = {
        eventoId:
          evento.id,

        eventoNome:
          evento.nome,

        origem:
          evento.origem,

        campanha:
          evento.campanha ||
          "",

        responsavel:
          evento.responsavel ||
          "",

        exp:
          Date.now() +
          12 *
          60 *
          60 *
          1000,
      };

      // Token específico de evento.
      // Não concede acesso ao sistema administrativo.
      const tokenEvento =
        assinar({
          ...sessaoEvento,
          escopo:
            "EVENTO_DIAGNOSTICO",
        });

      // Auditoria anônima do acesso ao evento.
      await auditar(
        req,
        {
          sub: null,
          nome:
            "Participante",
          login:
            evento.origem,
          tipo:
            "EVENTO",
        },
        {
          acao:
            "VALIDAR_EVENTO",
          modulo:
            "EVENTOS_ORIGENS",
          recurso:
            "evento_origem",
          recursoId:
            evento.id,
          descricao:
            `Código validado para ${evento.nome}`,
          detalhes: {
            origem:
              evento.origem,
            campanha:
              evento.campanha ||
              "",
          },
        }
      );

      res.json({
        sucesso:
          true,

        tokenEvento,

        evento:
          eventoPublico(
            evento
          ),
      });

      return;
    }

    // =====================================================
    // EVENTOS E ORIGENS - IDENTIFICAR PELA ORIGEM
    // PÚBLICO
    //
    // GET /api/acessos?action=evento-publico&origem=xbusiness
    //
    // Não revela código.
    // =====================================================

    if (
      action ===
        "evento-publico" &&
      req.method === "GET"
    ) {
      const origem =
        slugOrigem(
          req.query?.origem
        );

      if (!origem) {
        res
          .status(400)
          .json({
            sucesso:
              false,
            error:
              "Origem não informada.",
          });

        return;
      }

      const rows =
        await sql`
          SELECT
            id,
            nome,
            origem,
            campanha,
            responsavel,
            descricao,
            data_inicio,
            data_fim,
            ativo,
            criado_em,
            atualizado_em
          FROM
            finder_eventos_origens
          WHERE
            origem =
              ${origem}
          LIMIT 1
        `;

      const evento =
        rows?.[0];

      if (!evento) {
        res
          .status(404)
          .json({
            sucesso:
              false,
            error:
              "Origem não encontrada.",
          });

        return;
      }

      const situacao =
        eventoEstaValido(
          evento
        );

      if (
        !situacao.valido
      ) {
        res
          .status(403)
          .json({
            sucesso:
              false,
            error:
              situacao.motivo,
          });

        return;
      }

      res.json({
        sucesso:
          true,
        evento:
          eventoPublico(
            evento
          ),
      });

      return;
    }

    // =====================================================
    // AUDITORIA - LISTAR
    // =====================================================

    if (
      action === "auditoria" &&
      req.method === "GET"
    ) {
      const u =
        exigir(
          req,
          res,
          true
        );

      if (!u) {
        return;
      }

      const limite =
        Math.min(
          500,
          Math.max(
            1,
            Number(
              req.query
                ?.limite ||
              200
            )
          )
        );

      const rows =
        await sql`
          SELECT *
          FROM
            finder_auditoria
          ORDER BY
            criado_em DESC
          LIMIT
            ${limite}
        `;

      res.json({
        sucesso:
          true,
        eventos:
          rows,
      });

      return;
    }

    res
      .status(404)
      .json({
        sucesso:
          false,
        error:
          "Ação não encontrada.",
      });

  } catch (e) {
    console.error(
      "[acessos]",
      e
    );

    const mensagem =
      String(
        e?.message ||
        ""
      );

    if (
      mensagem
        .toLowerCase()
        .includes(
          "unique"
        )
    ) {
      res
        .status(409)
        .json({
          sucesso:
            false,
          error:
            "Já existe um cadastro com estes dados. Verifique login, e-mail ou origem do evento.",
        });

      return;
    }

    res
      .status(500)
      .json({
        sucesso:
          false,
        error:
          e?.message ||
          "Erro interno.",
      });
  }
}
