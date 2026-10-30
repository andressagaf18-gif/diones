// src/simulador/VisaoPlanoSimulador.jsx
// Prévia, no painel da administração, do que o CLIENTE do Simulador da Reforma
// vê em cada plano (R$ 29,90 / R$ 299,90 / R$ 799,90). Segue as regras da tela
// do cliente (App.jsx):
//   INICIAL      → resultado e comparativo, premissas e próximos passos (sem tabelas
//                  de memória de cálculo, transição, leitura da IA e PDF)
//   COMPLETO     → tudo do Inicial + como chegamos ao resultado, o que significa,
//                  transição 2026–2033, pontos a confirmar, leitura da IA e PDF
//   ESPECIALISTA → tudo do Completo + análise individual com especialista Finder
// Somente leitura e de uso interno: não altera diagnóstico nem pagamento.

import React from "react";
import RelatorioClienteSimulador from "./RelatorioClienteSimulador.jsx";

const NAVY = "#17233D";
const CORAL = "#FF6B4A";
const MUTED = "#5B667A";
const BORDER = "#E3E7EF";

export const PLANOS_SIMULADOR = {
  INICIAL: { nome: "Simulação Inicial", valor: "R$ 29,90", nivel: 1 },
  COMPLETO: { nome: "Simulação Completa", valor: "R$ 299,90", nivel: 2 },
  ESPECIALISTA: { nome: "Simulação + Especialista", valor: "R$ 799,90", nivel: 3 },
};

export default function VisaoPlanoSimulador({ plano, snapshot, geradoEm, planoPago = "", onIrParaAdministracao }) {
  const def = PLANOS_SIMULADOR[plano] || PLANOS_SIMULADOR.INICIAL;
  const completo = def.nivel >= 2;
  const especialista = def.nivel >= 3;

  const bloqueados = [
    "Como chegamos ao resultado (tabelas hoje × reforma)",
    "O que isso significa para a empresa",
    "Transição de 2026 a 2033 ano a ano",
    "Pontos a confirmar",
    "Leitura da IA sobre a simulação",
    "PDF executivo da simulação",
  ];

  return (
    <div>
      <div style={{ background: "#EEF3FF", border: "1px solid #D5E0FA", borderRadius: 12, padding: "11px 14px", marginBottom: 14, fontSize: 12, lineHeight: 1.55, color: NAVY }}>
        <b>Prévia do plano {def.nome} ({def.valor}).</b> Mostra o que o cliente vê neste plano, com base na simulação salva — não importa se ele pagou.{" "}
        {planoPago && PLANOS_SIMULADOR[planoPago] ? (
          <span>Este cliente pagou: <b>{PLANOS_SIMULADOR[planoPago].nome} ({PLANOS_SIMULADOR[planoPago].valor})</b>.</span>
        ) : (
          <span>Este cliente <b>ainda não tem pagamento confirmado</b>.</span>
        )}
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: "18px 20px" }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: CORAL, letterSpacing: 0.7, marginBottom: 6 }}>{def.nome.toUpperCase()}</div>

        <RelatorioClienteSimulador snapshot={snapshot} geradoEm={geradoEm} resumido={!completo} />

        {completo ? (
          <div style={{ marginTop: 16, background: "#F7F8FB", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 13 }}>
            <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.7, color: "#31589C", margin: "0 0 4px" }}>LEITURA DA IA · PDF EXECUTIVO</p>
            <p style={{ fontSize: 11.5, color: NAVY, margin: 0, lineHeight: 1.55 }}>
              Neste plano o cliente também recebe, na tela dele, a leitura da IA sobre a simulação e libera o PDF executivo. A análise consultiva interna, mais completa, fica na aba <b>Relatório Administração</b>.
            </p>
          </div>
        ) : (
          <div style={{ marginTop: 18, border: `1px dashed ${CORAL}`, borderRadius: 12, padding: 12, background: "#FFFBF9" }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: NAVY, margin: "0 0 5px" }}>Bloqueado neste plano (o cliente vê o convite para fazer upgrade)</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {bloqueados.map((t) => (
                <li key={t} style={{ fontSize: 12, lineHeight: 1.55, color: NAVY }}>{t}</li>
              ))}
            </ul>
          </div>
        )}

        {especialista ? (
          <div style={{ marginTop: 18, background: NAVY, color: "#fff", borderRadius: 14, padding: 16 }}>
            <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.7, color: "#FFB9A6", margin: "0 0 5px" }}>ACOMPANHAMENTO DO CONSULTOR</p>
            <p style={{ fontSize: 15, fontFamily: "Georgia, serif", margin: "0 0 6px" }}>Análise individual com especialista Finder</p>
            <p style={{ fontSize: 11.5, color: "#D7DDEA", margin: 0, lineHeight: 1.5 }}>
              Além da simulação completa, o cliente deste plano tem uma análise individual com um especialista da Finder, que valida premissas, créditos e enquadramento e monta o plano de preparação para a reforma.
            </p>
          </div>
        ) : null}
      </div>

      {especialista ? (
        <div style={{ margin: "12px 0 0", background: "#fff", border: `1px solid ${BORDER}`, borderLeft: "4px solid #31589C", borderRadius: 12, padding: "12px 16px", fontSize: 12, lineHeight: 1.55, color: NAVY }}>
          <b>Para o consultor (interno):</b> a análise consultiva com IA, feita para a simulação deste cliente, fica na aba <b>Relatório Administração</b>.
          {onIrParaAdministracao ? (
            <button type="button" onClick={onIrParaAdministracao} style={{ marginLeft: 8, border: "1px solid #D8DEEA", background: "#fff", color: NAVY, borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              Abrir
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
