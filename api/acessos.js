import { neon } from "@neondatabase/serverless";
import crypto from "crypto";

const sql = neon(process.env.DATABASE_URL);
let schemaPromise = null;

function txt(v, n = 1000) { return String(v ?? "").trim().slice(0, n); }
function jsonSeguro(v) { try { return JSON.parse(JSON.stringify(v ?? null)); } catch { return null; } }
function base64url(v) { return Buffer.from(v).toString("base64url"); }
function segredo() { return process.env.AUTH_SECRET || process.env.ADMIN_TOKEN || process.env.ADMIN_PASSWORD || ""; }
function assinar(payload) {
  const body = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", segredo()).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function validarToken(token) {
  try {
    const [body, sig] = String(token || "").split(".");
    if (!body || !sig || !segredo()) return null;
    const esperado = crypto.createHmac("sha256", segredo()).update(body).digest("base64url");
    const a = Buffer.from(sig); const b = Buffer.from(esperado);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload?.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}
function tokenReq(req) {
  const h = req.headers?.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
}
function hashSenha(senha, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(senha), salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}
function confereSenha(senha, gravada) {
  try {
    const [salt, hash] = String(gravada).split(":");
    const calc = hashSenha(senha, salt).split(":")[1];
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(calc));
  } catch { return false; }
}
async function schema() {
  if (!schemaPromise) schemaPromise = (async () => {
    await sql`CREATE TABLE IF NOT EXISTS finder_usuarios (
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
    )`;
    await sql`CREATE TABLE IF NOT EXISTS finder_auditoria (
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
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_finder_auditoria_data ON finder_auditoria (criado_em DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_finder_auditoria_usuario ON finder_auditoria (usuario_id, criado_em DESC)`;
  })();
  return schemaPromise;
}
async function auditar(req, u, dados = {}) {
  await schema();
  await sql`INSERT INTO finder_auditoria (
    id, usuario_id, usuario_nome, usuario_login, tipo_acesso, acao, modulo, recurso, recurso_id,
    descricao, antes, depois, detalhes, ip, user_agent
  ) VALUES (
    ${crypto.randomUUID()}, ${u?.sub || null}, ${u?.nome || ""}, ${u?.login || ""}, ${u?.tipo || ""},
    ${txt(dados.acao,120) || "ACAO"}, ${txt(dados.modulo,120)}, ${txt(dados.recurso,160)}, ${txt(dados.recursoId,160)},
    ${txt(dados.descricao,2000)}, ${JSON.stringify(jsonSeguro(dados.antes))}::jsonb,
    ${JSON.stringify(jsonSeguro(dados.depois))}::jsonb, ${JSON.stringify(jsonSeguro(dados.detalhes))}::jsonb,
    ${txt(req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress,200)}, ${txt(req.headers?.["user-agent"],500)}
  )`;
}
function adminLegacy(req) {
  const legacy = process.env.ADMIN_TOKEN || process.env.ADMIN_PASSWORD || "";
  return Boolean(legacy && tokenReq(req) === legacy);
}
function exigir(req, res, admin = false) {
  if (adminLegacy(req)) return { sub:null, nome:"Administrador", login:"legacy", perfil:"ADMIN", tipo:"SISTEMA", legacy:true };
  const u = validarToken(tokenReq(req));
  if (!u) { res.status(401).json({ sucesso:false, error:"Sessão inválida ou expirada." }); return null; }
  if (admin && u.perfil !== "ADMIN") { res.status(403).json({ sucesso:false, error:"Acesso exclusivo do administrador." }); return null; }
  return u;
}

export default async function handler(req, res) {
  try {
    await schema();
    const action = txt(req.query?.action || req.body?.action, 80).toLowerCase();

    if (action === "login" && req.method === "POST") {
      const login = txt(req.body?.login, 180).toLowerCase();
      const senha = String(req.body?.senha || "");
      const tipo = txt(req.body?.tipo || "SISTEMA", 30).toUpperCase();
      const rows = await sql`SELECT * FROM finder_usuarios WHERE (LOWER(login)=${login} OR LOWER(email)=${login}) AND ativo=TRUE LIMIT 1`;
      const user = rows?.[0];
      if (!user || !confereSenha(senha, user.senha_hash) || (tipo && user.tipo_acesso !== tipo && user.tipo_acesso !== "AMBOS")) {
        res.status(401).json({ sucesso:false, error:"Login ou senha inválidos para este acesso." }); return;
      }
      const payload = { sub:user.id, nome:user.nome, login:user.login, perfil:user.perfil, tipo:user.tipo_acesso, permissoes:user.permissoes || {}, exp:Date.now()+8*60*60*1000 };
      const token = assinar(payload);
      await sql`UPDATE finder_usuarios SET ultimo_acesso_em=NOW() WHERE id=${user.id}`;
      await auditar(req, payload, { acao:"LOGIN", modulo:"AUTENTICACAO", descricao:`Login realizado no ${tipo}` });
      res.json({ sucesso:true, token, usuario:payload }); return;
    }

    if (action === "bootstrap" && req.method === "POST") {
      const adminToken = process.env.ADMIN_TOKEN || process.env.ADMIN_PASSWORD || "";
      if (!adminToken || tokenReq(req) !== adminToken) { res.status(401).json({sucesso:false,error:"ADMIN_TOKEN necessário para criar o primeiro administrador."}); return; }
      const qtd = await sql`SELECT COUNT(*)::int AS total FROM finder_usuarios`;
      if (Number(qtd?.[0]?.total || 0) > 0) { res.status(409).json({sucesso:false,error:"Já existem usuários cadastrados."}); return; }
      const id = crypto.randomUUID();
      const nome = txt(req.body?.nome || "Administrador Finder",180);
      const email = txt(req.body?.email,180).toLowerCase();
      const login = txt(req.body?.login,120).toLowerCase();
      const senha = String(req.body?.senha || "");
      if (!email || !login || senha.length < 8) { res.status(400).json({sucesso:false,error:"Informe e-mail, login e senha com pelo menos 8 caracteres."}); return; }
      await sql`INSERT INTO finder_usuarios (id,nome,email,login,senha_hash,tipo_acesso,perfil,permissoes) VALUES (${id},${nome},${email},${login},${hashSenha(senha)},'AMBOS','ADMIN',${JSON.stringify({tudo:true})}::jsonb)`;
      res.json({sucesso:true,id}); return;
    }

    if (action === "me" && req.method === "GET") {
      const u = exigir(req,res,false); if (!u) return;
      res.json({sucesso:true,usuario:u}); return;
    }

    if (action === "auditar" && req.method === "POST") {
      const u = exigir(req,res,false); if (!u) return;
      await auditar(req,u,req.body || {}); res.json({sucesso:true}); return;
    }

    if (action === "usuarios" && req.method === "GET") {
      const u = exigir(req,res,true); if (!u) return;
      const rows = await sql`SELECT id,nome,email,login,tipo_acesso,perfil,permissoes,ativo,criado_em,atualizado_em,ultimo_acesso_em FROM finder_usuarios ORDER BY nome`;
      res.json({sucesso:true,usuarios:rows}); return;
    }

    if (action === "criar-usuario" && req.method === "POST") {
      const u = exigir(req,res,true); if (!u) return;
      const id=crypto.randomUUID(), nome=txt(req.body?.nome,180), email=txt(req.body?.email,180).toLowerCase(), login=txt(req.body?.login,120).toLowerCase();
      const senha=String(req.body?.senha||""), tipo=txt(req.body?.tipoAcesso||"SISTEMA",30).toUpperCase(), perfil=txt(req.body?.perfil||"CONSULTOR",40).toUpperCase();
      if(!nome||!email||!login||senha.length<8){res.status(400).json({sucesso:false,error:"Preencha nome, e-mail, login e senha com no mínimo 8 caracteres."});return;}
      await sql`INSERT INTO finder_usuarios (id,nome,email,login,senha_hash,tipo_acesso,perfil,permissoes) VALUES (${id},${nome},${email},${login},${hashSenha(senha)},${tipo},${perfil},${JSON.stringify(jsonSeguro(req.body?.permissoes)||{})}::jsonb)`;
      await auditar(req,u,{acao:"CRIAR_USUARIO",modulo:"USUARIOS",recurso:"usuario",recursoId:id,depois:{nome,email,login,tipo,perfil}});
      res.json({sucesso:true,id}); return;
    }

    if (action === "alterar-usuario" && req.method === "POST") {
      const u = exigir(req,res,true); if (!u) return;
      const id=txt(req.body?.id,100); const antigos=await sql`SELECT id,nome,email,login,tipo_acesso,perfil,permissoes,ativo FROM finder_usuarios WHERE id=${id} LIMIT 1`;
      if(!antigos?.[0]){res.status(404).json({sucesso:false,error:"Usuário não encontrado."});return;}
      const a=antigos[0];
      const nome=txt(req.body?.nome ?? a.nome,180), email=txt(req.body?.email ?? a.email,180).toLowerCase(), login=txt(req.body?.login ?? a.login,120).toLowerCase();
      const tipo=txt(req.body?.tipoAcesso ?? a.tipo_acesso,30).toUpperCase(), perfil=txt(req.body?.perfil ?? a.perfil,40).toUpperCase(), ativo=req.body?.ativo===undefined?a.ativo:Boolean(req.body.ativo);
      const permissoes=jsonSeguro(req.body?.permissoes ?? a.permissoes)||{}; const senha=String(req.body?.senha||"");
      if(senha){ if(senha.length<8){res.status(400).json({sucesso:false,error:"A nova senha deve ter no mínimo 8 caracteres."});return;} await sql`UPDATE finder_usuarios SET nome=${nome},email=${email},login=${login},tipo_acesso=${tipo},perfil=${perfil},permissoes=${JSON.stringify(permissoes)}::jsonb,ativo=${ativo},senha_hash=${hashSenha(senha)},atualizado_em=NOW() WHERE id=${id}`; }
      else await sql`UPDATE finder_usuarios SET nome=${nome},email=${email},login=${login},tipo_acesso=${tipo},perfil=${perfil},permissoes=${JSON.stringify(permissoes)}::jsonb,ativo=${ativo},atualizado_em=NOW() WHERE id=${id}`;
      await auditar(req,u,{acao:"ALTERAR_USUARIO",modulo:"USUARIOS",recurso:"usuario",recursoId:id,antes:a,depois:{nome,email,login,tipo_acesso:tipo,perfil,permissoes,ativo}});
      res.json({sucesso:true}); return;
    }

    if (action === "auditoria" && req.method === "GET") {
      const u = exigir(req,res,true); if (!u) return;
      const limite=Math.min(500,Math.max(1,Number(req.query?.limite||200)));
      const rows=await sql`SELECT * FROM finder_auditoria ORDER BY criado_em DESC LIMIT ${limite}`;
      res.json({sucesso:true,eventos:rows}); return;
    }

    res.status(404).json({sucesso:false,error:"Ação não encontrada."});
  } catch (e) {
    console.error("[acessos]", e);
    if (String(e?.message||"").includes("unique")) res.status(409).json({sucesso:false,error:"E-mail ou login já cadastrado."});
    else res.status(500).json({sucesso:false,error:e?.message||"Erro interno."});
  }
}
