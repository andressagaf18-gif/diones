import crypto from "crypto";

function tokenReq(req) {
  const authorization =
    req.headers?.authorization || "";

  return authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
}

function segredo() {
  return (
    process.env.AUTH_SECRET ||
    process.env.ADMIN_TOKEN ||
    process.env.ADMIN_PASSWORD ||
    ""
  );
}

function validarTokenAssinado(token) {
  try {
    const [body, assinatura] =
      String(token || "").split(".");

    if (!body || !assinatura || !segredo()) {
      return null;
    }

    const esperada = crypto
      .createHmac("sha256", segredo())
      .update(body)
      .digest("base64url");

    const recebidoBuffer =
      Buffer.from(assinatura);

    const esperadoBuffer =
      Buffer.from(esperada);

    if (
      recebidoBuffer.length !==
      esperadoBuffer.length
    ) {
      return null;
    }

    if (
      !crypto.timingSafeEqual(
        recebidoBuffer,
        esperadoBuffer
      )
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(
        body,
        "base64url"
      ).toString("utf8")
    );

    if (
      !payload?.exp ||
      Date.now() > payload.exp
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function usuarioAutenticado(req) {
  const token = tokenReq(req);

  const legacy =
    process.env.ADMIN_TOKEN ||
    process.env.ADMIN_PASSWORD ||
    "";

  // Mantém o acesso administrativo antigo
  // como contingência.
  if (
    legacy &&
    token === legacy
  ) {
    return {
      sub: null,
      nome: "Administrador",
      login: "legacy",
      perfil: "ADMIN",
      tipo: "SISTEMA",
      legacy: true,
    };
  }

  // Login individual criado pelo novo
  // sistema de usuários.
  return validarTokenAssinado(token);
}

export function exigirAutenticacao(
  req,
  res,
  {
    admin = false,
  } = {}
) {
  const usuario =
    usuarioAutenticado(req);

  if (!usuario) {
    res.status(401).json({
      sucesso: false,
      error:
        "Sessão inválida ou expirada.",
    });

    return null;
  }

  if (
    admin &&
    usuario.perfil !== "ADMIN"
  ) {
    res.status(403).json({
      sucesso: false,
      error:
        "Acesso exclusivo do administrador.",
    });

    return null;
  }

  return usuario;
}
