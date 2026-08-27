import { useState } from "react";
import {
  Sparkles,
  Search,
  Calculator,
  TrendingUp,
  Info,
  Printer,
  ChevronDown,
  ChevronUp,
  Award,
} from "lucide-react";

import { finderTheme } from "../Theme";
import { montarComparativo, ANEXOS, CRONOGRAMA_REFORMA } from "./engine";

const C = finderTheme.colors;

const BODY_FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const DISPLAY_FONT =
  "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif";

const fmtMoney = (v) =>
  (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const fmtPct = (v) => `${(v * 100).toFixed(1)}%`;

// ---------------------------------------------------------
// PRIMITIVOS DE UI
// ---------------------------------------------------------

function Campo({ label, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label
        style={{
          fontFamily: BODY_FONT,
          fontSize: 12.5,
          fontWeight: 700,
          color: C.textDark,
        }}
      >
        {label}
      </label>
      {children}
      {hint ? (
        <span
          style={{
            fontFamily: BODY_FONT,
            fontSize: 10.5,
            color: C.mutedDark,
            lineHeight: 1.3,
          }}
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}

const inputStyle = {
  border: `1px solid ${C.borderLight}`,
  borderRadius: 9,
  padding: "9px 11px",
  fontFamily: BODY_FONT,
  fontSize: 13.5,
  color: C.textDark,
  outline: "none",
  background: C.white,
};

function NumInput({ value, onChange, prefix }) {
  return (
    <div style={{ position: "relative" }}>
      {prefix ? (
        <span
          style={{
            position: "absolute",
            left: 11,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 12.5,
            color: C.mutedDark,
            fontFamily: BODY_FONT,
          }}
        >
          {prefix}
        </span>
      ) : null}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        style={{
          ...inputStyle,
          width: "100%",
          paddingLeft: prefix ? 30 : 11,
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function Selo({ children, tone = "cyan" }) {
  const bg = tone === "success" ? C.success : tone === "coral" ? C.coral : C.cyan;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: `${bg}1A`,
        color: bg,
        fontFamily: BODY_FONT,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0.4,
        padding: "4px 10px",
        borderRadius: 999,
      }}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------
// MÓDULO PRINCIPAL
// ---------------------------------------------------------

export default function SimuladorFiscal({ token }) {
  const [cnpj, setCnpj] = useState("");
  const [empresa, setEmpresa] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState("");

  const [ano, setAno] = useState(2027);
  const [anexoKey, setAnexoKey] = useState("III");

  const [rbt12, setRbt12] = useState(1200000);
  const [rba, setRba] = useState(600000);
  const [folha12, setFolha12] = useState(300000);
  const [receitaMes, setReceitaMes] = useState(150000);

  const [pctVendasComCredito, setPctVendasComCredito] = useState(60);
  const [vendasAliqZero, setVendasAliqZero] = useState(0);
  const [vendasReducao60, setVendasReducao60] = useState(0);
  const [vendasIcmsSt, setVendasIcmsSt] = useState(0);
  const [servicosIssRetido, setServicosIssRetido] = useState(0);
  const [comprasFornecedoresMes, setComprasFornecedoresMes] = useState(20000);
  const [custoExtraMes, setCustoExtraMes] = useState(300);

  const [perfilPresumido, setPerfilPresumido] = useState("servicos");
  const [aliqIcmsIssPresumido, setAliqIcmsIssPresumido] = useState(0.05);

  const [premissasAbertas, setPremissasAbertas] = useState(false);
  const [resultado, setResultado] = useState(null);

  async function buscarCnpj() {
    const limpo = cnpj.replace(/\D/g, "");
    if (limpo.length !== 14) {
      setErroBusca("Informe um CNPJ válido (14 dígitos).");
      return;
    }
    setBuscando(true);
    setErroBusca("");
    try {
      const r = await fetch(`/api/cnpj?cnpj=${limpo}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.sucesso) {
        throw new Error(d?.error || "Não foi possível localizar o CNPJ.");
      }
      setEmpresa(d.empresa || null);
    } catch (e) {
      setErroBusca(e.message);
    } finally {
      setBuscando(false);
    }
  }

  function calcular() {
    const r = montarComparativo({
      anexoKey,
      rbt12,
      folha12,
      receitaMes,
      ano,
      pctVendasComCredito,
      vendasAliqZero,
      vendasReducao60,
      vendasIcmsSt,
      servicosIssRetido,
      comprasFornecedoresMes,
      custoExtraMes,
      perfilPresumido,
      aliqIcmsIssPresumido,
    });
    setResultado(r);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* -------------------- HERO -------------------- */}
      <div
        style={{
          background: `linear-gradient(135deg, ${C.textDark} 0%, #0A1424 100%)`,
          borderRadius: 18,
          padding: "26px 28px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Selo tone="success">
          <Sparkles size={12} /> NOVO · SIMULADOR FISCAL
        </Selo>
        <h1
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: 26,
            color: C.white,
            margin: "10px 0 6px",
          }}
        >
          Reforma Tributária &amp; Planejamento
        </h1>
        <p
          style={{
            fontFamily: BODY_FONT,
            fontSize: 13,
            color: C.muted,
            maxWidth: 640,
            margin: 0,
          }}
        >
          Compare, mês a mês, Guia Única (Simples), regime híbrido (pagar por
          fora) e Lucro Presumido — já considerando a transição do IBS/CBS.
          Módulo independente, pensado para a conversa comercial com o
          cliente.
        </p>
      </div>

      {/* -------------------- DADOS DA EMPRESA -------------------- */}
      <Bloco titulo="1 · Dados da empresa" icon={<Search size={14} />}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 260px" }}>
            <Campo label="CNPJ" hint="Opcional — preenche dados automaticamente">
              <input
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0000-00"
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
              />
            </Campo>
          </div>
          <button
            type="button"
            onClick={buscarCnpj}
            disabled={buscando}
            style={{
              border: "none",
              background: C.coral,
              color: C.white,
              borderRadius: 9,
              padding: "10px 16px",
              fontFamily: BODY_FONT,
              fontSize: 13,
              fontWeight: 700,
              cursor: buscando ? "not-allowed" : "pointer",
              opacity: buscando ? 0.6 : 1,
            }}
          >
            {buscando ? "Buscando..." : "Buscar dados"}
          </button>

          <div style={{ flex: "0 1 180px" }}>
            <Campo label="Ano da simulação">
              <select
                value={ano}
                onChange={(e) => setAno(Number(e.target.value))}
                style={{ ...inputStyle, width: "100%" }}
              >
                {Object.keys(CRONOGRAMA_REFORMA).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </Campo>
          </div>
        </div>

        {erroBusca ? (
          <p style={{ color: C.danger, fontFamily: BODY_FONT, fontSize: 12, marginTop: 8 }}>
            {erroBusca}
          </p>
        ) : null}

        {empresa ? (
          <div
            style={{
              marginTop: 10,
              background: C.panelLight,
              borderRadius: 10,
              padding: "10px 14px",
              fontFamily: BODY_FONT,
              fontSize: 12.5,
              color: C.textDark,
            }}
          >
            <strong>{empresa.razaoSocial || empresa.nomeFantasia}</strong>
            {empresa.municipio ? ` · ${empresa.municipio}/${empresa.uf}` : ""}
          </div>
        ) : null}
      </Bloco>

      {/* -------------------- NÚMEROS BASE -------------------- */}
      <Bloco titulo="2 · Números do cliente" icon={<Calculator size={14} />}>
        <Grid cols={4}>
          <Campo label="Receita bruta 12 meses (RBT12)">
            <NumInput value={rbt12} onChange={setRbt12} prefix="R$" />
          </Campo>
          <Campo label="Receita acumulada no ano (RBA)">
            <NumInput value={rba} onChange={setRba} prefix="R$" />
          </Campo>
          <Campo label="Folha 12 meses (Fator R)">
            <NumInput value={folha12} onChange={setFolha12} prefix="R$" />
          </Campo>
          <Campo label="Receita do mês (simulação)">
            <NumInput value={receitaMes} onChange={setReceitaMes} prefix="R$" />
          </Campo>
        </Grid>

        <div style={{ marginTop: 12 }}>
          <Campo label="Anexo do Simples Nacional" hint="Se marcar Anexo V, o Fator R decide automaticamente se cai no III.">
            <select
              value={anexoKey}
              onChange={(e) => setAnexoKey(e.target.value)}
              style={{ ...inputStyle, maxWidth: 320 }}
            >
              {Object.entries(ANEXOS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </Campo>
        </div>
      </Bloco>

      {/* -------------------- VENDAS E CRÉDITOS -------------------- */}
      <Bloco titulo="3 · Vendas, créditos e custos" icon={<TrendingUp size={14} />}>
        <Grid cols={3}>
          <Campo label="Vendas para PJ que aproveitam crédito" hint="% do faturamento do mês">
            <NumInput value={pctVendasComCredito} onChange={setPctVendasComCredito} />
          </Campo>
          <Campo label="Vendas com alíquota zero/suspensão" hint="R$/mês">
            <NumInput value={vendasAliqZero} onChange={setVendasAliqZero} prefix="R$" />
          </Campo>
          <Campo label="Vendas com redução de 60%" hint="R$/mês">
            <NumInput value={vendasReducao60} onChange={setVendasReducao60} prefix="R$" />
          </Campo>
          <Campo label="Vendas com ICMS já recolhido por ST" hint="R$/mês">
            <NumInput value={vendasIcmsSt} onChange={setVendasIcmsSt} prefix="R$" />
          </Campo>
          <Campo label="Serviços com ISS retido na fonte" hint="R$/mês">
            <NumInput value={servicosIssRetido} onChange={setServicosIssRetido} prefix="R$" />
          </Campo>
          <Campo label="Compras de fornecedores por mês" hint="R$/mês">
            <NumInput value={comprasFornecedoresMes} onChange={setComprasFornecedoresMes} prefix="R$" />
          </Campo>
          <Campo label="Custo extra para pagar por fora" hint="Contador/sistema, R$/mês">
            <NumInput value={custoExtraMes} onChange={setCustoExtraMes} prefix="R$" />
          </Campo>
        </Grid>
      </Bloco>

      {/* -------------------- PREMISSAS AVANÇADAS -------------------- */}
      <Bloco
        titulo="Premissas avançadas"
        icon={<Info size={14} />}
        acao={
          <button
            type="button"
            onClick={() => setPremissasAbertas((v) => !v)}
            style={{
              border: "none",
              background: "transparent",
              color: C.primary,
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontFamily: BODY_FONT,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {premissasAbertas ? "Ocultar" : "Ajustar"}
            {premissasAbertas ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        }
      >
        {premissasAbertas ? (
          <>
            <Grid cols={3}>
              <Campo label="Perfil no Lucro Presumido">
                <select
                  value={perfilPresumido}
                  onChange={(e) => setPerfilPresumido(e.target.value)}
                  style={{ ...inputStyle, width: "100%" }}
                >
                  <option value="comercio">Comércio</option>
                  <option value="industria">Indústria</option>
                  <option value="servicos">Serviços</option>
                </select>
              </Campo>
              <Campo label="ICMS/ISS estimado no Presumido" hint="% sobre a receita, antes da redução da transição">
                <NumInput
                  value={aliqIcmsIssPresumido * 100}
                  onChange={(v) => setAliqIcmsIssPresumido(v / 100)}
                />
              </Campo>
            </Grid>
            <p style={{ fontFamily: BODY_FONT, fontSize: 11, color: C.mutedDark, marginTop: 8 }}>
              O cronograma da transição (CBS/IBS por ano) usa percentuais aproximados
              da EC 132/2023. São estimativas — ajuste por cliente e confirme a base
              legal antes de apresentar qualquer número como definitivo.
            </p>
          </>
        ) : (
          <p style={{ fontFamily: BODY_FONT, fontSize: 12, color: C.mutedDark, margin: 0 }}>
            Perfil no Presumido, alíquota de ICMS/ISS estimada e composição do DAS —
            ajuste por cliente e confirme a base legal.
          </p>
        )}
      </Bloco>

      {/* -------------------- CALCULAR -------------------- */}
      <div>
        <button
          type="button"
          onClick={calcular}
          style={{
            border: "none",
            background: C.textDark,
            color: C.white,
            borderRadius: 10,
            padding: "12px 22px",
            fontFamily: BODY_FONT,
            fontSize: 14,
            fontWeight: 800,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
          }}
        >
          <Calculator size={16} /> Calcular e comparar regimes
        </button>
      </div>

      {/* -------------------- RESULTADO -------------------- */}
      {resultado ? <Resultado r={resultado} ano={ano} /> : null}
    </div>
  );
}

// ---------------------------------------------------------
// COMPONENTES DE APOIO
// ---------------------------------------------------------

function Bloco({ titulo, icon, acao, children }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.borderLight}`,
        borderRadius: 16,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: C.primary }}>{icon}</span>
          <h3
            style={{
              fontFamily: BODY_FONT,
              fontSize: 13.5,
              fontWeight: 800,
              color: C.textDark,
              margin: 0,
              letterSpacing: 0.2,
            }}
          >
            {titulo}
          </h3>
        </div>
        {acao}
      </div>
      {children}
    </div>
  );
}

function Grid({ cols = 3, children }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: 14,
      }}
    >
      {children}
    </div>
  );
}

function LinhaBreakdown({ label, valor }) {
  if (!valor) return null;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontFamily: BODY_FONT,
        fontSize: 12,
        color: C.mutedDark,
        padding: "4px 0",
      }}
    >
      <span>{label}</span>
      <span style={{ fontWeight: 700, color: C.textDark }}>{fmtMoney(valor)}</span>
    </div>
  );
}

function CardRegime({ titulo, dados, destaque, breakdownExtra }) {
  return (
    <div
      style={{
        background: destaque ? C.textDark : C.panelLight,
        borderRadius: 14,
        padding: 18,
        position: "relative",
        border: destaque ? `1px solid ${C.success}` : `1px solid ${C.borderLight}`,
      }}
    >
      {destaque ? (
        <div style={{ position: "absolute", top: 12, right: 14 }}>
          <Selo tone="success"><Award size={11} /> MAIS BARATO</Selo>
        </div>
      ) : null}
      <div
        style={{
          fontFamily: BODY_FONT,
          fontSize: 11.5,
          fontWeight: 800,
          letterSpacing: 0.4,
          color: destaque ? C.success : C.mutedDark,
          textTransform: "uppercase",
        }}
      >
        {titulo}
      </div>
      <div
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: 24,
          fontWeight: 700,
          color: destaque ? C.white : C.textDark,
          margin: "6px 0 12px",
        }}
      >
        {fmtMoney(dados.total)}
        <span style={{ fontSize: 12, fontFamily: BODY_FONT, fontWeight: 400, color: destaque ? C.muted : C.mutedDark }}>
          {" "}/mês
        </span>
      </div>

      <div style={{ borderTop: `1px solid ${destaque ? "rgba(255,255,255,.12)" : C.borderLight}`, paddingTop: 8 }}>
        {[
          ["IBS/CBS", dados.ibsCbs],
          ["IRPJ", dados.irpj],
          ["CSLL", dados.csll],
          ["CPP/INSS", dados.cpp],
          ["ICMS", dados.icms],
          ["ISS", dados.iss],
          ["IPI", dados.ipi],
          ["Custo extra", dados.custoExtra],
        ].map(([label, valor]) =>
          valor ? (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: BODY_FONT,
                fontSize: 11.5,
                color: destaque ? C.muted : C.mutedDark,
                padding: "3px 0",
              }}
            >
              <span>{label}</span>
              <span style={{ fontWeight: 700, color: destaque ? C.white : C.textDark }}>
                {fmtMoney(valor)}
              </span>
            </div>
          ) : null
        )}
        {dados.creditoClientePJ ? (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: BODY_FONT,
              fontSize: 11.5,
              color: destaque ? C.success : C.success,
              padding: "6px 0 0",
              fontWeight: 800,
            }}
          >
            <span>Crédito ao cliente PJ</span>
            <span>{fmtMoney(dados.creditoClientePJ)}</span>
          </div>
        ) : null}
      </div>
      {breakdownExtra}
    </div>
  );
}

function Resultado({ r, ano }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          background: `${C.cyan}14`,
          border: `1px solid ${C.cyan}55`,
          borderRadius: 12,
          padding: "12px 16px",
          fontFamily: BODY_FONT,
          fontSize: 12.5,
          color: C.textDark,
        }}
      >
        <strong>Em {ano}:</strong> {r.fase.fase}. IBS/CBS combinados em{" "}
        {fmtPct(r.fase.cbs + r.fase.ibs)}, com {fmtPct(r.fase.pctAntigos)} do
        ICMS/ISS tradicional ainda em vigor.
        {" "}Fator R apurado em {fmtPct(r.fatorR.percentual)}
        {r.anexoEfetivo !== undefined ? ` · tributado como ${ANEXOS[r.anexoEfetivo]?.label}.` : "."}
      </div>

      <Grid cols={3}>
        <CardRegime titulo="Guia única · Simples tradicional" dados={r.guiaUnica} destaque={r.maisBarato === "guia-unica"} />
        <CardRegime titulo="Pagar por fora · regime híbrido" dados={r.porFora} destaque={r.maisBarato === "pagar-por-fora"} />
        <CardRegime titulo="Lucro Presumido" dados={r.presumido} destaque={r.maisBarato === "lucro-presumido"} />
      </Grid>

      <Grid cols={2}>
        <div style={{ background: C.panelLight, borderRadius: 12, padding: 16 }}>
          <div style={{ fontFamily: BODY_FONT, fontSize: 11.5, color: C.mutedDark, fontWeight: 700 }}>
            DIFERENÇA DE CUSTO (por fora × guia única)
          </div>
          <div style={{ fontFamily: DISPLAY_FONT, fontSize: 22, color: C.textDark, marginTop: 4 }}>
            {fmtMoney(Math.abs(r.diferencaPorForaXGuiaUnica))}
            <span style={{ fontFamily: BODY_FONT, fontSize: 12, color: C.mutedDark }}>
              {" "}{r.diferencaPorForaXGuiaUnica >= 0 ? "mais caro" : "mais barato"} por fora
            </span>
          </div>
        </div>
        <div style={{ background: C.panelLight, borderRadius: 12, padding: 16 }}>
          <div style={{ fontFamily: BODY_FONT, fontSize: 11.5, color: C.mutedDark, fontWeight: 700 }}>
            CRÉDITO EXTRA PARA OS CLIENTES (regime híbrido)
          </div>
          <div style={{ fontFamily: DISPLAY_FONT, fontSize: 22, color: C.textDark, marginTop: 4 }}>
            {fmtMoney(r.porFora.creditoClientePJ)}
          </div>
        </div>
      </Grid>

      <div
        style={{
          background: "#FFF8E8",
          border: "1px solid #F4D98B",
          borderRadius: 12,
          padding: "14px 16px",
          fontFamily: BODY_FONT,
          fontSize: 12.5,
          color: "#7A5B12",
        }}
      >
        <strong>Recomendação orientativa: </strong>
        {r.recomendacao}
      </div>

      <div>
        <button
          type="button"
          onClick={() => window.print()}
          style={{
            border: `1px solid ${C.borderLight}`,
            background: C.white,
            color: C.textDark,
            borderRadius: 9,
            padding: "9px 16px",
            fontFamily: BODY_FONT,
            fontSize: 12.5,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            cursor: "pointer",
          }}
        >
          <Printer size={14} /> Gerar relatório (PDF)
        </button>
      </div>
    </div>
  );
}
