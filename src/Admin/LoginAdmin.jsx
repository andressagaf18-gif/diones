import React, { useState } from "react";
import { KeyRound } from "lucide-react";

const NAVY = "#17233D";
const CORAL = "#FF6B4A";
const MUTED = "#5B667A";
const WHITE = "#FFFFFF";
const BG = "#F3F5F8";
const BODY_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const DISPLAY_FONT = "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif";

function Botao({ children, onClick, disabled = false, secundario = false, style = {} }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: secundario ? "1px solid #D8DEEA" : "none",
        background: secundario ? WHITE : CORAL,
        color: secundario ? NAVY : WHITE,
        borderRadius: 10,
        padding: "10px 14px",
        fontFamily: BODY_FONT,
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export default function LoginAdmin({ onLogin }) {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [modoLegado, setModoLegado] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    if (!senha.trim() || (!modoLegado && !login.trim())) {
      setErro(modoLegado ? "Digite a senha administrativa." : "Digite seu login e senha.");
      return;
    }
    setCarregando(true);
    setErro("");
    try {
      if (modoLegado) {
        const valor = senha.trim();
        const resposta = await fetch("/api/diagnosticos?action=listar&limite=1", {
          headers: { Authorization: `Bearer ${valor}` },
        });
        const data = await resposta.json().catch(() => null);
        if (!resposta.ok || !data?.sucesso) throw new Error(data?.error || "Senha administrativa inválida.");
        sessionStorage.setItem("finder_admin_token", valor);
        sessionStorage.setItem("finder_admin_user", JSON.stringify({ nome: "Administrador", login: "legacy", perfil: "ADMIN", tipo: "SISTEMA", legacy: true }));
        onLogin(valor);
        return;
      }
      const resposta = await fetch("/api/acessos?action=login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ login: login.trim(), senha, tipo: "SISTEMA" }),
      });
      const data = await resposta.json().catch(() => null);
      if (!resposta.ok || !data?.sucesso || !data?.token) throw new Error(data?.error || "Login ou senha inválidos.");
      sessionStorage.setItem("finder_admin_token", data.token);
      sessionStorage.setItem("finder_admin_user", JSON.stringify(data.usuario || {}));
      onLogin(data.token);
    } catch (error) {
      setErro(error?.message || "Não foi possível acessar o painel.");
    } finally {
      setCarregando(false);
    }
  }

  const inputStyle = { width: "100%", boxSizing: "border-box", border: "1px solid #D8DEEA", borderRadius: 10, padding: "12px 13px", fontFamily: BODY_FONT, fontSize: 14, color: NAVY, marginBottom: 12 };

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", justifyContent: "center", alignItems: "center", padding: 20, fontFamily: BODY_FONT }}>
      <div style={{ width: "100%", maxWidth: 430, background: WHITE, borderRadius: 20, padding: 30, boxShadow: "0 24px 60px rgba(23,35,61,0.14)" }}>
        <img src="/finder-logo.png" alt="Finder of Solutions" style={{ width: 180, maxWidth: "70%", objectFit: "contain", marginBottom: 22 }} />
        <h1 style={{ fontFamily: DISPLAY_FONT, color: NAVY, fontSize: 28, margin: "0 0 7px" }}>Painel Administrativo</h1>
        <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.5, margin: "0 0 22px" }}>Acesso individual e auditado ao sistema Finder.</p>
        {!modoLegado && (
          <>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 7 }}>Login ou e-mail</label>
            <input value={login} onChange={(e) => { setLogin(e.target.value); setErro(""); }} autoComplete="username" placeholder="seu.login" style={inputStyle} />
          </>
        )}
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 7 }}>{modoLegado ? "Senha administrativa atual" : "Senha"}</label>
        <input type="password" value={senha} onChange={(e) => { setSenha(e.target.value); setErro(""); }} onKeyDown={(e) => e.key === "Enter" && entrar()} autoComplete="current-password" placeholder={modoLegado ? "ADMIN_TOKEN" : "Sua senha"} style={inputStyle} />
        {erro && <div style={{ background: "#FAECE7", color: "#993C1D", borderRadius: 9, padding: 10, fontSize: 12, marginBottom: 12 }}>{erro}</div>}
        <Botao onClick={entrar} disabled={carregando} style={{ width: "100%" }}><KeyRound size={15} />{carregando ? "Validando..." : "Entrar no painel"}</Botao>
        <button onClick={() => { setModoLegado((v) => !v); setErro(""); setLogin(""); setSenha(""); }} style={{ width: "100%", marginTop: 12, border: 0, background: "transparent", color: MUTED, cursor: "pointer", fontSize: 12 }}>
          {modoLegado ? "Voltar ao login individual" : "Acesso de contingência com ADMIN_TOKEN"}
        </button>
      </div>
    </div>
  );
}
