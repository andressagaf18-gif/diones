// src/lgpd/PortaoTermos.jsx
// Tela de aceite OBRIGATÓRIO dos Termos de Uso. É renderizada NO LUGAR do aplicativo (não por cima):
// enquanto a pessoa não aceitar, não existe formulário, botão ou campo atrás dela para alcançar
// pelo teclado, por leitor de tela ou apagando um aviso no navegador.

import { useEffect, useRef, useState } from "react";

const NAVY = "#17233D";
const WHITE = "#FFFFFF";
const DISPLAY_FONT = "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif";
const BODY_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const FUNDO = "radial-gradient(circle at 18% -10%, rgba(79,124,255,.20), transparent 42%), radial-gradient(circle at 85% 110%, rgba(255,107,74,.14), transparent 45%), #0A0E17";

const AVISO = {
  primeiro: "",
  nova_versao: "Atualizamos os Termos de Uso. Para continuar, leia e aceite a nova versão.",
  sem_registro: "Precisamos registrar o seu aceite dos Termos de Uso para continuar.",
};

const palco = { background: FUNDO, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, boxSizing: "border-box", fontFamily: BODY_FONT };
const cartao = { width: 440, maxWidth: "100%", maxHeight: "88vh", background: WHITE, borderRadius: 20, boxShadow: "0 30px 70px rgba(0,0,0,.35)", display: "flex", flexDirection: "column", overflow: "hidden" };

export default function PortaoTermos({ texto, versao, motivo = "primeiro", onAceitar, carregando = false }) {
  const [recusou, setRecusou] = useState(false);
  const [aceitando, setAceitando] = useState(false);
  const botao = useRef(null);

  useEffect(() => {
    if (!carregando) botao.current?.focus?.();
  }, [carregando, recusou]);

  if (carregando) return <div style={palco} aria-busy="true" />;

  function aceitar() {
    if (aceitando) return; // um clique só: evita registrar o aceite duas vezes
    setAceitando(true);
    onAceitar?.();
  }

  if (recusou) {
    return (
      <div style={palco}>
        <div role="alertdialog" aria-modal="true" aria-labelledby="termos-recusa-titulo" style={{ ...cartao, padding: "26px 24px" }}>
          <h1 id="termos-recusa-titulo" style={{ fontFamily: DISPLAY_FONT, fontSize: 19, margin: "0 0 10px", color: NAVY }}>Não é possível continuar sem o aceite</h1>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: NAVY, margin: "0 0 18px" }}>
            Para usar o diagnóstico é necessário aceitar os Termos de Uso. Como você não aceitou, nenhum cadastro foi criado. Se mudar de ideia, é só voltar aos termos.
          </p>
          <button ref={botao} type="button" onClick={() => setRecusou(false)} style={botaoPrimario(false)}>
            Voltar aos termos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={palco}>
      <div role="dialog" aria-modal="true" aria-labelledby="termos-titulo" style={cartao} data-versao-termos={versao}>
        <div style={{ padding: "20px 24px 14px", borderBottom: "1px solid #EEF0F4" }}>
          <h1 id="termos-titulo" style={{ fontFamily: DISPLAY_FONT, fontSize: 18, fontWeight: 700, color: NAVY, margin: 0 }}>
            Termos e condições de uso
          </h1>
          {AVISO[motivo] ? (
            <p role="status" style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "#8A4A00", background: "#FFF4E0", borderRadius: 8, padding: "7px 10px" }}>
              {AVISO[motivo]}
            </p>
          ) : null}
        </div>

        <div tabIndex={0} aria-label="Texto dos Termos de Uso" style={{ padding: "18px 24px", overflowY: "auto", fontSize: 12.5, lineHeight: 1.7, color: NAVY, whiteSpace: "pre-wrap" }}>
          {texto}
        </div>

        <div style={{ padding: "14px 24px 20px", borderTop: "1px solid #EEF0F4", display: "grid", gap: 8 }}>
          <button ref={botao} type="button" onClick={aceitar} disabled={aceitando} style={botaoPrimario(aceitando)}>
            {aceitando ? "Registrando..." : "Aceitar e continuar"}
          </button>
          <button type="button" onClick={() => setRecusou(true)} disabled={aceitando} style={{ background: "none", border: 0, color: "#5B667A", fontSize: 12.5, fontWeight: 700, cursor: aceitando ? "default" : "pointer", padding: "6px 0", fontFamily: BODY_FONT }}>
            Não aceito
          </button>
        </div>
      </div>
    </div>
  );
}

function botaoPrimario(desligado) {
  return {
    width: "100%",
    minHeight: 48,
    padding: "13px 16px",
    borderRadius: 12,
    border: "none",
    background: desligado ? "#D8DEEA" : "linear-gradient(135deg,#4F7CFF,#8B6BFF 55%,#FF6B4A)",
    boxShadow: desligado ? "none" : "0 10px 24px rgba(79,124,255,.28)",
    color: WHITE,
    fontFamily: BODY_FONT,
    fontSize: 15,
    fontWeight: 800,
    cursor: desligado ? "not-allowed" : "pointer",
  };
}
