import React, { useMemo } from "react";
import { qrcode } from "./qrcode.js";

// QR Code gerado no próprio navegador (SVG nítido, sem imagem fixa).
// Biblioteca: qrcode-generator (MIT) em ./qrcode.js.
export function gerarModulosQr(texto, nivel = "M") {
  const qr = qrcode(0, nivel);
  qr.addData(String(texto || ""));
  qr.make();
  const n = qr.getModuleCount();
  const linhas = [];
  for (let r = 0; r < n; r++) {
    const linha = [];
    for (let c = 0; c < n; c++) linha.push(qr.isDark(r, c));
    linhas.push(linha);
  }
  return linhas;
}

// Link do evento aberto: mesmo endereço e mesma origem que a pessoa está usando.
export function linkDoEventoAtual(origem = "") {
  try {
    const url = new URL(window.location.href);
    const base = new URL(url.origin + url.pathname);
    const o = String(origem || url.searchParams.get("origem") || "").trim();
    if (o && !["direto", "link-direto"].includes(o)) base.searchParams.set("origem", o);
    return base.toString();
  } catch {
    return "";
  }
}

export default function QrLink({ valor, tamanho = 190, cor = "#000000", fundo = "#FFFFFF", titulo = "QR Code" }) {
  const dados = useMemo(() => {
    try {
      return valor ? gerarModulosQr(valor) : null;
    } catch {
      return null;
    }
  }, [valor]);

  if (!dados) return null;
  const n = dados.length;
  const margem = 2;
  const total = n + margem * 2;
  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (dados[r][c]) d += `M${c + margem} ${r + margem}h1v1h-1z`;
    }
  }
  return (
    <svg
      role="img"
      aria-label={titulo}
      data-qr-valor={valor}
      viewBox={`0 0 ${total} ${total}`}
      width={tamanho}
      height={tamanho}
      shapeRendering="crispEdges"
      style={{ display: "block" }}
    >
      <title>{titulo}</title>
      <rect width={total} height={total} fill={fundo} />
      <path d={d} fill={cor} />
    </svg>
  );
}
