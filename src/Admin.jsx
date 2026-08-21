import {
  useEffect,
  useMemo,
  useState,
} from "react";

import * as XLSX from "xlsx";

import {
  Search,
  Building2,
  ArrowLeft,
  LogOut,
  RefreshCcw,
  AlertTriangle,
  ChevronRight,
  Target,
  Download,
  Users,
  Activity,
  CheckCircle2,
  Clock3,
  Flame,
  UserPlus,
  Gauge,
  Save,
  X,
  LayoutDashboard,
  Trash2,
  Plus,
  Archive,
  ArchiveRestore,
  ShieldCheck,
  KeyRound,
  History,
  UserCog,
} from "lucide-react";
import Dashboard from "./Dashboard";

const NAVY = "#17233D";
const CORAL = "#FF6B4A";
const MUTED = "#5B667A";
const ICE = "#E9EDF5";
const WHITE = "#FFFFFF";
const BG = "#F3F5F8";

const BODY_FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const DISPLAY_FONT =
  "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif";

// =========================================================
// FUNÇÕES AUXILIARES
// =========================================================

function formatarData(valor) {
  if (!valor) return "-";

  try {
    return new Date(valor).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return String(valor);
  }
}

function formatarCnpj(valor = "") {
  const digits = String(valor).replace(/\D/g, "");

  if (digits.length !== 14) {
    return valor || "-";
  }

  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

function scoreInfo(score) {
  const numero = Number(score);

  if (!Number.isFinite(numero)) {
    return {
      label: "Sem score",
      color: MUTED,
      bg: "#EEF0F5",
    };
  }

  if (numero >= 80) {
    return {
      label: "Bom",
      color: "#0F6E56",
      bg: "#E1F5EE",
    };
  }

  if (numero >= 60) {
    return {
      label: "Atenção",
      color: "#854F0B",
      bg: "#FAEEDA",
    };
  }

  if (numero >= 40) {
    return {
      label: "Crítico",
      color: "#993C1D",
      bg: "#FAECE7",
    };
  }

  return {
    label: "Emergencial",
    color: "#791F1F",
    bg: "#FCEBEB",
  };
}

function normalizarLista(valor) {
  return Array.isArray(valor) ? valor : [];
}

function estruturaDiagnostico(item = {}) {
  const direto =
    item.estruturaNegocio ||
    item.estrutura_negocio ||
    item?.perfil?.estruturaNegocio ||
    item?.perfil?.estrutura_negocio ||
    item?.resultado?.estruturaNegocio ||
    item?.resultado?.estrutura_negocio ||
    "";

  if (direto) {
    return String(direto);
  }

  const segmento =
    String(
      item.segmento ||
      item?.empresa?.segmento ||
      ""
    ).toLowerCase();

  const razao =
    String(
      item.razaoSocial ||
      item?.empresa?.razaoSocial ||
      ""
    ).toLowerCase();

  const cnpj =
    String(
      item.cnpj ||
      item?.empresa?.cnpj ||
      ""
    ).replace(/\D/g, "");

  if (
    segmento.includes("pessoa física") ||
    segmento.includes("pessoa fisica")
  ) {
    return "pessoa_fisica";
  }

  if (
    razao.includes("avaliação de holding") ||
    razao.includes("avaliacao de holding")
  ) {
    return "avaliar_holding";
  }

  if (
    segmento.includes("holding") ||
    razao.includes("holding")
  ) {
    return "holding";
  }

  if (
    segmento.includes("grupo empresarial")
  ) {
    return "grupo";
  }

  if (
    segmento.includes("spe")
  ) {
    return "spe";
  }

  if (!cnpj && segmento.includes("financeira")) {
    return "pessoa_fisica";
  }

  return "operacional";
}

function labelEstruturaDiagnostico(valor) {
  const mapa = {
    operacional: "Empresa operacional",
    holding: "Holding",
    avaliar_holding: "Avaliação de Holding",
    grupo: "Grupo empresarial",
    spe: "SPE",
    pessoa_fisica: "Pessoa Física",
  };

  return mapa[valor] || valor || "Empresa operacional";
}

function corEstruturaDiagnostico(valor) {
  const mapa = {
    operacional: {
      bg: "#EEF3FF",
      color: "#31589C",
    },
    holding: {
      bg: "#FFF3EF",
      color: "#993C1D",
    },
    avaliar_holding: {
      bg: "#FAEEDA",
      color: "#854F0B",
    },
    grupo: {
      bg: "#E1F5EE",
      color: "#0F6E56",
    },
    spe: {
      bg: "#F3EEFF",
      color: "#6843A3",
    },
    pessoa_fisica: {
      bg: "#F1F3F7",
      color: NAVY,
    },
  };

  return (
    mapa[valor] ||
    mapa.operacional
  );
}

function areaCanonica(valor = "") {
  const texto = String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  const mapa = {
    financeiro: "financeiro",
    financeiropfpj: "financeiro",

    contabilfiscal: "contabilidade",
    contabilidade: "contabilidade",

    tributario: "tributario",

    operacional: "operacional",

    gestao: "gestao",

    comercial: "comercial",
    comercialvendas: "comercial",

    rh: "rh",
    recursoshumanos: "rh",
    pessoas: "rh",

    tecnologia: "tecnologia",

    administrativo: "administrativo",

    marketing: "marketing",

    juridico: "juridico",
  };

  return mapa[texto] || texto;
}

function responsavelCompativelComArea(responsavel, area) {
  const areaAlvo = areaCanonica(area);

  const areasResponsavel =
    normalizarLista(
      responsavel?.areas
    );

  if (!areasResponsavel.length) {
    return false;
  }

  return areasResponsavel.some(
    (item) =>
      areaCanonica(item) ===
      areaAlvo
  );
}

function juntarLista(valor) {
  return Array.isArray(valor)
    ? valor.filter(Boolean).join(" | ")
    : "";
}

function resumoSeguro(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "";
  }

  if (
    typeof valor === "string" ||
    typeof valor === "number"
  ) {
    return String(valor);
  }

  if (Array.isArray(valor)) {
    // Quando o motor devolve achados estruturados,
    // o detalhamento já aparece nos cards abaixo.
    // Evitamos transformar objetos em "[object Object]".
    const textos =
      valor
        .filter(
          (item) =>
            typeof item === "string" ||
            typeof item === "number"
        )
        .map(String)
        .filter(Boolean);

    return textos.join(" ");
  }

  if (typeof valor === "object") {
    return (
      valor.resumo ||
      valor.descricao ||
      valor.texto ||
      valor.titulo ||
      ""
    );
  }

  return "";
}


function limparTextoRelatorio(valor) {
  const texto =
    textoSeguro(valor)
      // Regras técnicas do motor, ex.: (contabil_fiscal_1 = 'nao').
      .replace(
        /\(\s*[a-zA-Z0-9_]+\s*=\s*['"][^'"]*['"]\s*\)\.?/g,
        ""
      )
      // IDs e tipos técnicos.
      .replace(
        /(?:—|-)?\s*Id:\s*[a-zA-Z0-9_-]+/gi,
        ""
      )
      .replace(
        /(?:—|-)?\s*Tipo:\s*[a-zA-Z0-9_-]+/gi,
        ""
      )
      // Referências internas de ligação/rastreabilidade.
      .replace(
        /(?:—|-)?\s*Ligado\s*A:\s*[a-zA-Z0-9_,\s-]+/gi,
        ""
      )
      .replace(
        /(?:—|-)?\s*Risco\s*Mitigado:\s*[a-zA-Z0-9_,\s-]+/gi,
        ""
      )
      .replace(
        /(?:—|-)?\s*(?:Regra|Rule):\s*[^—\n]+/gi,
        ""
      )
      // Restos de pontuação e espaços.
      .replace(
        /\s+([,.;:])/g,
        "$1"
      )
      .replace(
        /\s{2,}/g,
        " "
      )
      .replace(
        /^[\s·—-]+|[\s·—-]+$/g,
        ""
      )
      .trim();

  if (
    !texto ||
    /^[()[\]{}=_:'".,\-\s]+$/.test(
      texto
    )
  ) {
    return "";
  }

  return texto;
}

function limparListaRelatorio(valor) {
  const lista =
    listaFlexivel(valor);

  return lista
    .map((item) => {
      if (
        item === null ||
        item === undefined
      ) {
        return null;
      }

      if (
        typeof item === "string" ||
        typeof item === "number"
      ) {
        const limpo =
          limparTextoRelatorio(item);

        return limpo
          ? limpo
          : null;
      }

      if (Array.isArray(item)) {
        const itens =
          limparListaRelatorio(item);

        return itens.length
          ? itens
          : null;
      }

      if (
        typeof item === "object"
      ) {
        const proibidos =
          new Set([
            "id",
            "tipo",
            "regra",
            "condicao",
            "condição",
            "expressao",
            "expressão",
            "formula",
            "fórmula",
            "codigo",
            "código",
            "areaId",
            "eixoId",
            "perguntaId",
            "ligadoA",
            "ligado_a",
            "riscoMitigado",
            "risco_mitigado",
          ]);

        const novo = {};

        Object.entries(item)
          .forEach(
            ([chave, valorInterno]) => {
              if (
                proibidos.has(chave)
              ) {
                return;
              }

              if (
                typeof valorInterno ===
                "string"
              ) {
                const limpo =
                  limparTextoRelatorio(
                    valorInterno
                  );

                if (limpo) {
                  novo[chave] =
                    limpo;
                }

                return;
              }

              if (
                Array.isArray(
                  valorInterno
                )
              ) {
                const arr =
                  limparListaRelatorio(
                    valorInterno
                  );

                if (arr.length) {
                  novo[chave] =
                    arr;
                }

                return;
              }

              if (
                valorInterno &&
                typeof valorInterno ===
                  "object"
              ) {
                const arr =
                  limparListaRelatorio([
                    valorInterno,
                  ]);

                if (arr.length) {
                  novo[chave] =
                    arr[0];
                }

                return;
              }

              if (
                valorInterno !== null &&
                valorInterno !== undefined
              ) {
                novo[chave] =
                  valorInterno;
              }
            }
          );

        return Object.keys(novo)
          .length
          ? novo
          : null;
      }

      return null;
    })
    .filter(Boolean);
}



function textoSeguro(valor) {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "string" || typeof valor === "number") return String(valor);
  if (Array.isArray(valor)) return valor.map(textoSeguro).filter(Boolean).join(" | ");
  if (typeof valor === "object") {
    return (
      valor.titulo ||
      valor.nome ||
      valor.indicador ||
      valor.pergunta ||
      valor.acao ||
      valor.objetivo ||
      valor.descricao ||
      valor.resumo ||
      JSON.stringify(valor)
    );
  }
  return String(valor);
}

function listaFlexivel(valor) {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor.filter(Boolean);
  if (typeof valor === "string") return valor.trim() ? [valor] : [];
  if (typeof valor === "object") {
    return Object.entries(valor)
      .filter(([, v]) => v !== null && v !== undefined && v !== "" && (!Array.isArray(v) || v.length))
      .map(([chave, v]) => ({
        chave,
        valor: v,
      }));
  }
  return [valor];
}

function tituloChave(chave = "") {
  const mapa = {
    primeiros30Dias: "0–30 dias",
    dias0a30: "0–30 dias",
    zeroA30: "0–30 dias",
    de0a30: "0–30 dias",
    dias31a60: "31–60 dias",
    trintaEUmA60: "31–60 dias",
    de31a60: "31–60 dias",
    dias61a90: "61–90 dias",
    sessentaEUmA90: "61–90 dias",
    de61a90: "61–90 dias",
  };

  if (mapa[chave]) return mapa[chave];

  return String(chave)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

function BlocoDossie({ titulo, children, destaque = false }) {
  return (
    <>
      <h2 style={tituloSecao}>{titulo}</h2>
      <Card
        style={
          destaque
            ? {
                border: "1px solid #F0C8BD",
                background: "#FFF9F7",
              }
            : {}
        }
      >
        {children}
      </Card>
    </>
  );
}

function ListaDossie({ itens, vazio = "Sem informação gerada." }) {
  const lista = listaFlexivel(itens);

  if (!lista.length) {
    return <span style={{ fontSize: 12, color: MUTED }}>{vazio}</span>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {lista.map((item, index) => {
        if (item && typeof item === "object" && "chave" in item) {
          return (
            <div
              key={index}
              style={{
                background: "#F7F8FB",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <strong style={{ display: "block", fontSize: 12, marginBottom: 5 }}>
                {tituloChave(item.chave)}
              </strong>
              {Array.isArray(item.valor) ? (
                <ListaDossie itens={item.valor} />
              ) : typeof item.valor === "object" && item.valor !== null ? (
                <ListaDossie itens={item.valor} />
              ) : (
                <div style={{ fontSize: 12, lineHeight: 1.55 }}>
                  {textoSeguro(item.valor)}
                </div>
              )}
            </div>
          );
        }

        if (item && typeof item === "object") {
          const titulo =
            item.titulo ||
            item.nome ||
            item.indicador ||
            item.pergunta ||
            item.acao ||
            item.objetivo ||
            `Item ${index + 1}`;

          const detalhes = Object.entries(item).filter(
            ([chave, valor]) =>
              !["titulo", "nome", "indicador", "pergunta", "acao", "objetivo"].includes(chave) &&
              valor !== null &&
              valor !== undefined &&
              valor !== "" &&
              (!Array.isArray(valor) || valor.length)
          );

          return (
            <div
              key={index}
              style={{
                background: "#F7F8FB",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <strong style={{ display: "block", fontSize: 12.5, marginBottom: 6 }}>
                {textoSeguro(titulo)}
              </strong>

              {detalhes.map(([chave, valor]) => (
                <div key={chave} style={{ fontSize: 11.5, lineHeight: 1.55, marginTop: 4 }}>
                  <strong>{tituloChave(chave)}:</strong>{" "}
                  {Array.isArray(valor)
                    ? valor.map(textoSeguro).filter(Boolean).join(" • ")
                    : typeof valor === "object"
                    ? textoSeguro(valor)
                    : String(valor)}
                </div>
              ))}
            </div>
          );
        }

        return (
          <div
            key={index}
            style={{
              display: "flex",
              gap: 9,
              alignItems: "flex-start",
              fontSize: 12,
              lineHeight: 1.55,
            }}
          >
            <span style={{ color: CORAL, fontWeight: 900 }}>•</span>
            <span>{textoSeguro(item)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Plano90Dias({ plano }) {
  const lista = listaFlexivel(plano);

  if (!lista.length) {
    return <span style={{ fontSize: 12, color: MUTED }}>Sem plano de 90 dias gerado.</span>;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
        gap: 12,
      }}
    >
      {lista.map((fase, index) => {
        if (fase && typeof fase === "object" && "chave" in fase) {
          return (
            <div
              key={index}
              style={{
                border: "1px solid #E3E7EF",
                borderRadius: 12,
                padding: 14,
                background: "#F7F8FB",
              }}
            >
              <strong style={{ display: "block", color: CORAL, marginBottom: 8 }}>
                {tituloChave(fase.chave)}
              </strong>
              <ListaDossie itens={fase.valor} />
            </div>
          );
        }

        return (
          <div
            key={index}
            style={{
              border: "1px solid #E3E7EF",
              borderRadius: 12,
              padding: 14,
              background: "#F7F8FB",
            }}
          >
            <ListaDossie itens={[fase]} />
          </div>
        );
      })}
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div
      style={{
        background: WHITE,
        border: "1px solid #E3E7EF",
        borderRadius: 14,
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Botao({
  children,
  onClick,
  disabled = false,
  secundario = false,
  style = {},
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: secundario
          ? "1px solid #D8DEEA"
          : "none",

        background: secundario
          ? WHITE
          : CORAL,

        color: secundario
          ? NAVY
          : WHITE,

        borderRadius: 10,
        padding: "10px 14px",
        fontFamily: BODY_FONT,
        fontSize: 13,
        fontWeight: 700,

        cursor: disabled
          ? "not-allowed"
          : "pointer",

        opacity: disabled
          ? 0.55
          : 1,

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

// =========================================================
// LOGIN
// =========================================================

function LoginAdmin({ onLogin }) {
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
    setCarregando(true); setErro("");
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
    } catch (error) { setErro(error?.message || "Não foi possível acessar o painel."); }
    finally { setCarregando(false); }
  }

  const inputStyle = { width:"100%", boxSizing:"border-box", border:"1px solid #D8DEEA", borderRadius:10, padding:"12px 13px", fontFamily:BODY_FONT, fontSize:14, color:NAVY, marginBottom:12 };
  return (
    <div style={{minHeight:"100vh",background:BG,display:"flex",justifyContent:"center",alignItems:"center",padding:20,fontFamily:BODY_FONT}}>
      <div style={{width:"100%",maxWidth:430,background:WHITE,borderRadius:20,padding:30,boxShadow:"0 24px 60px rgba(23,35,61,0.14)"}}>
        <img src="/finder-logo.png" alt="Finder of Solutions" style={{width:180,maxWidth:"70%",objectFit:"contain",marginBottom:22}} />
        <h1 style={{fontFamily:DISPLAY_FONT,color:NAVY,fontSize:28,margin:"0 0 7px"}}>Painel Administrativo</h1>
        <p style={{fontSize:13,color:MUTED,lineHeight:1.5,margin:"0 0 22px"}}>Acesso individual e auditado ao sistema Finder.</p>
        {!modoLegado && <>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:NAVY,marginBottom:7}}>Login ou e-mail</label>
          <input value={login} onChange={e=>{setLogin(e.target.value);setErro("")}} autoComplete="username" placeholder="seu.login" style={inputStyle}/>
        </>}
        <label style={{display:"block",fontSize:12,fontWeight:700,color:NAVY,marginBottom:7}}>{modoLegado ? "Senha administrativa atual" : "Senha"}</label>
        <input type="password" value={senha} onChange={e=>{setSenha(e.target.value);setErro("")}} onKeyDown={e=>e.key==="Enter"&&entrar()} autoComplete="current-password" placeholder={modoLegado?"ADMIN_TOKEN":"Sua senha"} style={inputStyle}/>
        {erro && <div style={{background:"#FAECE7",color:"#993C1D",borderRadius:9,padding:10,fontSize:12,marginBottom:12}}>{erro}</div>}
        <Botao onClick={entrar} disabled={carregando} style={{width:"100%"}}><KeyRound size={15}/>{carregando?"Validando...":"Entrar no painel"}</Botao>
        <button onClick={()=>{setModoLegado(v=>!v);setErro("");setLogin("");setSenha("")}} style={{width:"100%",marginTop:12,border:0,background:"transparent",color:MUTED,cursor:"pointer",fontSize:12}}>
          {modoLegado ? "Voltar ao login individual" : "Acesso de contingência com ADMIN_TOKEN"}
        </button>
      </div>
    </div>
  );
}

// =========================================================
// LISTA DE DIAGNÓSTICOS
// =========================================================

function ListaDiagnosticos({
  token,
  onAbrir,
  onLogout,
}) {
  const [
    diagnosticos,
    setDiagnosticos,
  ] = useState([]);

  const [
    busca,
    setBusca,
  ] = useState("");

  const [
    buscaAplicada,
    setBuscaAplicada,
  ] = useState("");

  const [
    estruturaFiltro,
    setEstruturaFiltro,
  ] = useState("");


  const [
    arquivamentoAtendimentos,
    setArquivamentoAtendimentos,
  ] = useState("ATIVOS");

  const [
    total,
    setTotal,
  ] = useState(0);

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    exportando,
    setExportando,
  ] = useState(false);

  const [
    erro,
    setErro,
  ] = useState("");


  const [
    arquivamentoDiagnosticos,
    setArquivamentoDiagnosticos,
  ] = useState("ATIVOS");

  const [
    processandoDiagnosticoId,
    setProcessandoDiagnosticoId,
  ] = useState("");

  // =======================================================
  // CARREGAR LISTA
  // =======================================================

  async function carregar(
    termo = ""
  ) {
    setCarregando(true);
    setErro("");

    try {
      const params =
        new URLSearchParams();

      params.set(
        "limite",
        "100"
      );

      params.set(
        "offset",
        "0"
      );

      params.set(
        "arquivamento",
        arquivamentoDiagnosticos
      );

      if (
        termo.trim()
      ) {
        params.set(
          "busca",
          termo.trim()
        );
      }

      const resposta =
        await fetch(
          `/api/diagnosticos?action=listar&${params.toString()}`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => null);

      if (
        !resposta.ok ||
        !data?.sucesso
      ) {
        if (
          resposta.status ===
          401
        ) {
          throw new Error(
            "Sua sessão administrativa expirou."
          );
        }

        throw new Error(
          data?.error ||
          "Não foi possível carregar os diagnósticos."
        );
      }

      setDiagnosticos(
        Array.isArray(
          data.diagnosticos
        )
          ? data.diagnosticos
          : []
      );

      setTotal(
        Number(
          data.total
        ) || 0
      );

    } catch (error) {
      setErro(
        error?.message ||
        "Erro ao carregar diagnósticos."
      );

    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar("");
  }, []);


  async function acaoDiagnostico(
    item,
    action
  ) {
    const excluir =
      action === "excluir";

    const mensagem =
      excluir
        ? `Excluir definitivamente o diagnóstico de "${item.razaoSocial || item.nome || "cliente"}"?\n\nTambém serão removidos lead, atendimentos e históricos vinculados.`
        : item.arquivado
        ? "Desarquivar este diagnóstico?"
        : "Arquivar este diagnóstico? Ele sairá das listas ativas.";

    if (!window.confirm(mensagem)) {
      return;
    }

    setProcessandoDiagnosticoId(
      item.id
    );
    setErro("");

    try {
      const resposta =
        await fetch(
          `/api/diagnosticos?action=${
            excluir
              ? "excluir"
              : item.arquivado
              ? "desarquivar"
              : "arquivar"
          }`,
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
            body: JSON.stringify({
              diagnosticoId:
                item.id,
            }),
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => null);

      if (
        !resposta.ok ||
        !data?.sucesso
      ) {
        throw new Error(
          data?.error ||
          "Não foi possível concluir a operação."
        );
      }

      await carregar(
        buscaAplicada
      );
    } catch (error) {
      setErro(
        error?.message ||
        "Erro ao processar diagnóstico."
      );
    } finally {
      setProcessandoDiagnosticoId(
        ""
      );
    }
  }

  function pesquisar() {
    const termo =
      busca.trim();

    setBuscaAplicada(
      termo
    );

    carregar(
      termo
    );
  }

  function limparBusca() {
    setBusca("");
    setBuscaAplicada("");
    setEstruturaFiltro("");
    carregar("");
  }

  const diagnosticosFiltrados =
    useMemo(() => {
      if (!estruturaFiltro) {
        return diagnosticos;
      }

      return diagnosticos.filter(
        (item) =>
          estruturaDiagnostico(item) ===
          estruturaFiltro
      );
    }, [
      diagnosticos,
      estruturaFiltro,
    ]);

  const estruturasResumo =
    useMemo(() => {
      return diagnosticos.reduce(
        (acc, item) => {
          const estrutura =
            estruturaDiagnostico(
              item
            );

          acc[estrutura] =
            (acc[estrutura] || 0) + 1;

          return acc;
        },
        {}
      );
    }, [diagnosticos]);

  // =======================================================
  // SCORE MÉDIO
  // =======================================================

  const mediaScore =
    useMemo(() => {
      const scores =
        diagnosticosFiltrados
          .map(
            (d) =>
              Number(
                d.score
              )
          )
          .filter(
            Number.isFinite
          );

      if (!scores.length) {
        return null;
      }

      return Math.round(
        scores.reduce(
          (
            acc,
            valor
          ) =>
            acc + valor,
          0
        ) /
        scores.length
      );
    }, [diagnosticos]);

  // =======================================================
  // EXPORTAR EXCEL
  // =======================================================

  async function exportarExcel() {
    if (exportando) {
      return;
    }

    setExportando(true);
    setErro("");

    try {
      const resposta =
        await fetch(
          "/api/diagnosticos?action=exportar",
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => null);

      if (
        !resposta.ok ||
        !data?.sucesso ||
        !Array.isArray(
          data.diagnosticos
        )
      ) {
        throw new Error(
          data?.error ||
          "Não foi possível carregar os dados para exportação."
        );
      }

      const registros =
        data.diagnosticos;

      if (
        registros.length === 0
      ) {
        throw new Error(
          "Não existem diagnósticos para exportar."
        );
      }

      // ===================================================
      // ABA 1 - DIAGNÓSTICOS
      // ===================================================

      const abaDiagnosticos =
        registros.map(
          (item) => {
            const participante =
              item.participante ||
              {};

            const empresa =
              item.empresa ||
              {};

            const dores =
              Array.isArray(
                item.dores
              )
                ? item.dores
                : [];

            const doresEstruturadas =
              item.doresEstruturadas ||
              {};

            const negocio =
              item.negocioInterpretado ||
              {};

            const resultado =
              item.resultado ||
              {};

            const diagnosticoGeral =
              resultado.diagnosticoGeral ||
              {};

            return {
              "ID":
                item.id ||
                "",

              "Data":
                item.criadoEm
                  ? new Date(
                      item.criadoEm
                    ).toLocaleString(
                      "pt-BR"
                    )
                  : "",

              "Estrutura":
                labelEstruturaDiagnostico(
                  estruturaDiagnostico(
                    item
                  )
                ),

              "Empresa":
                empresa.razaoSocial ||
                "",

              "CNPJ":
                formatarCnpj(
                  empresa.cnpj ||
                  ""
                ),

              "Responsável":
                participante.nome ||
                "",

              "Cargo":
                participante.cargo ||
                "",

              "Telefone":
                participante.telefone ||
                "",

              "E-mail":
                participante.email ||
                "",

              "Descrição do negócio":
                empresa.descricaoNegocio ||
                "",

              "Segmento":
                empresa.segmento ||
                "",

              "Subsegmento":
                empresa.subsegmento ||
                "",

              "Score":
                item.score ??
                "",

              "Dores declaradas":
                dores.join(
                  " | "
                ),

              "Dor principal":
                doresEstruturadas
                  .principal ||
                dores[0] ||
                "",

              "Objetivo 90 dias":
                doresEstruturadas
                  .objetivo90Dias ||
                "",

              "Impactos da dor":
                juntarLista(
                  doresEstruturadas
                    .impactos
                ),

              "Modelo de negócio":
                negocio.modeloNegocio ||
                negocio.modeloOperacional ||
                "",

              "Como gera receita":
                negocio.comoGeraReceita ||
                "",

              "Resumo executivo":
                diagnosticoGeral
                  .resumoExecutivo ||
                "",

              "Alerta estratégico":
                diagnosticoGeral
                  .alertaEstrategico ||
                "",

              "Leitura das dores":
                diagnosticoGeral
                  .leituraDasDores ||
                diagnosticoGeral
                  .leituraDaDor ||
                "",

              "Principais dores IA":
                juntarLista(
                  diagnosticoGeral
                    .principaisDores
                ),

              "Causas prováveis":
                juntarLista(
                  diagnosticoGeral
                    .causasProvaveis
                ),

              "Impactos":
                juntarLista(
                  diagnosticoGeral
                    .impactos
                ),

              "Pontos fortes":
                juntarLista(
                  diagnosticoGeral
                    .pontosFortes
                ),

              "Prioridades imediatas":
                juntarLista(
                  diagnosticoGeral
                    .prioridadesImediatas
                ),

              "Oportunidades":
                juntarLista(
                  diagnosticoGeral
                    .oportunidades
                ),

              "Próximos passos":
                juntarLista(
                  diagnosticoGeral
                    .proximosPassos
                ),
            };
          }
        );

      // ===================================================
      // ABA 2 - PERGUNTAS E RESPOSTAS
      // ===================================================

      const abaPerguntas = [];

      registros.forEach(
        (item) => {
          const participante =
            item.participante ||
            {};

          const empresa =
            item.empresa ||
            {};

          const perguntas =
            Array.isArray(
              item.perguntasRespostas
            )
              ? item.perguntasRespostas
              : [];

          perguntas.forEach(
            (
              pergunta,
              index
            ) => {
              abaPerguntas.push({
                "ID Diagnóstico":
                  item.id ||
                  "",

                "Data":
                  item.criadoEm
                    ? new Date(
                        item.criadoEm
                      ).toLocaleString(
                        "pt-BR"
                      )
                    : "",

                "Empresa":
                  empresa.razaoSocial ||
                  "",

                "CNPJ":
                  formatarCnpj(
                    empresa.cnpj ||
                    ""
                  ),

                "Responsável":
                  participante.nome ||
                  "",

                "Nº":
                  index + 1,

                "Área":
                  pergunta.area ||
                  "",

                "Área ID":
                  pergunta.areaId ||
                  "",

                "Tema":
                  pergunta.tema ||
                  "",

                "Pergunta":
                  pergunta.pergunta ||
                  "",

                "Resposta":
                  pergunta.resposta ||
                  "",

                "Peso":
                  pergunta.peso ??
                  "",

                "Importância":
                  pergunta.importancia ??
                  "",

                "Motivo":
                  pergunta.motivo ||
                  "",

                "Risco avaliado":
                  pergunta.riscoAvaliado ||
                  "",
              });
            }
          );
        }
      );

      // ===================================================
      // ABA 3 - ANÁLISE POR ÁREA
      // ===================================================

      const abaAreas = [];

      registros.forEach(
        (item) => {
          const empresa =
            item.empresa ||
            {};

          const areas =
            Array.isArray(
              item.areas
            )
              ? item.areas
              : [];

          areas.forEach(
            (area) => {
              abaAreas.push({
                "ID Diagnóstico":
                  item.id ||
                  "",

                "Data":
                  item.criadoEm
                    ? new Date(
                        item.criadoEm
                      ).toLocaleString(
                        "pt-BR"
                      )
                    : "",

                "Empresa":
                  empresa.razaoSocial ||
                  "",

                "CNPJ":
                  formatarCnpj(
                    empresa.cnpj ||
                    ""
                  ),

                "Área":
                  area.area ||
                  "",

                "Score":
                  area.score ??
                  "",

                "Nível":
                  area.nivel ||
                  "",

                "Prioridade":
                  area.prioridade ??
                  "",

                "Resumo":
                  resumoSeguro(
                    area.resumo
                  ),

                "Achados":
                  juntarLista(
                    area.achados
                  ),

                "Causas prováveis":
                  juntarLista(
                    area.causasProvaveis
                  ),

                "Riscos":
                  juntarLista(
                    area.riscos
                  ),

                "Recomendações":
                  juntarLista(
                    area.recomendacoes
                  ),
              });
            }
          );
        }
      );

      // ===================================================
      // ABA 4 - DORES E OBJETIVOS
      // ===================================================

      const abaDores = [];

      registros.forEach(
        (item) => {
          const empresa =
            item.empresa ||
            {};

          const participante =
            item.participante ||
            {};

          const estruturadas =
            item.doresEstruturadas ||
            {};

          const dores =
            Array.isArray(
              estruturadas.selecionadas
            )
              ? estruturadas.selecionadas

              : Array.isArray(
                  item.dores
                )
                ? item.dores

                : [];

          // Mesmo se não houver dor,
          // mantém uma linha com o diagnóstico.
          if (
            dores.length === 0
          ) {
            abaDores.push({
              "ID Diagnóstico":
                item.id ||
                "",

              "Data":
                item.criadoEm
                  ? new Date(
                      item.criadoEm
                    ).toLocaleString(
                      "pt-BR"
                    )
                  : "",

              "Empresa":
                empresa.razaoSocial ||
                "",

              "CNPJ":
                formatarCnpj(
                  empresa.cnpj ||
                  ""
                ),

              "Responsável":
                participante.nome ||
                "",

              "Dor Nº":
                "",

              "Dor":
                "",

              "Dor principal":
                estruturadas.principal ||
                "",

              "Objetivo 90 dias":
                estruturadas
                  .objetivo90Dias ||
                "",

              "Impactos":
                juntarLista(
                  estruturadas
                    .impactos
                ),
            });

            return;
          }

          dores.forEach(
            (
              dor,
              index
            ) => {
              abaDores.push({
                "ID Diagnóstico":
                  item.id ||
                  "",

                "Data":
                  item.criadoEm
                    ? new Date(
                        item.criadoEm
                      ).toLocaleString(
                        "pt-BR"
                      )
                    : "",

                "Empresa":
                  empresa.razaoSocial ||
                  "",

                "CNPJ":
                  formatarCnpj(
                    empresa.cnpj ||
                    ""
                  ),

                "Responsável":
                  participante.nome ||
                  "",

                "Dor Nº":
                  index + 1,

                "Dor":
                  dor,

                "Dor principal":
                  estruturadas.principal ||
                  dores[0] ||
                  "",

                "Objetivo 90 dias":
                  estruturadas
                    .objetivo90Dias ||
                  "",

                "Impactos":
                  juntarLista(
                    estruturadas
                      .impactos
                  ),
              });
            }
          );
        }
      );

      // ===================================================
      // CRIAR ARQUIVO EXCEL
      // ===================================================

      const workbook =
        XLSX.utils.book_new();

      const wsDiagnosticos =
        XLSX.utils.json_to_sheet(
          abaDiagnosticos
        );

      const wsPerguntas =
        XLSX.utils.json_to_sheet(
          abaPerguntas
        );

      const wsAreas =
        XLSX.utils.json_to_sheet(
          abaAreas
        );

      const wsDores =
        XLSX.utils.json_to_sheet(
          abaDores
        );

      // ===================================================
      // LARGURA DAS COLUNAS
      // ===================================================

      wsDiagnosticos["!cols"] = [
        { wch: 38 },
        { wch: 20 },
        { wch: 38 },
        { wch: 20 },
        { wch: 25 },
        { wch: 18 },
        { wch: 18 },
        { wch: 30 },
        { wch: 60 },
        { wch: 35 },
        { wch: 50 },
        { wch: 10 },
        { wch: 50 },
        { wch: 40 },
        { wch: 60 },
        { wch: 60 },
        { wch: 40 },
        { wch: 60 },
        { wch: 80 },
        { wch: 80 },
        { wch: 80 },
        { wch: 80 },
        { wch: 80 },
        { wch: 80 },
        { wch: 80 },
        { wch: 80 },
        { wch: 80 },
      ];

      wsPerguntas["!cols"] = [
        { wch: 38 },
        { wch: 20 },
        { wch: 38 },
        { wch: 20 },
        { wch: 25 },
        { wch: 8 },
        { wch: 28 },
        { wch: 16 },
        { wch: 35 },
        { wch: 90 },
        { wch: 18 },
        { wch: 10 },
        { wch: 12 },
        { wch: 70 },
        { wch: 70 },
      ];

      wsAreas["!cols"] = [
        { wch: 38 },
        { wch: 20 },
        { wch: 38 },
        { wch: 20 },
        { wch: 28 },
        { wch: 10 },
        { wch: 15 },
        { wch: 15 },
        { wch: 80 },
        { wch: 90 },
        { wch: 90 },
        { wch: 90 },
        { wch: 90 },
      ];

      wsDores["!cols"] = [
        { wch: 38 },
        { wch: 20 },
        { wch: 38 },
        { wch: 20 },
        { wch: 25 },
        { wch: 10 },
        { wch: 45 },
        { wch: 45 },
        { wch: 70 },
        { wch: 70 },
      ];

      // ===================================================
      // ADICIONAR ABAS
      // ===================================================

      XLSX.utils.book_append_sheet(
        workbook,
        wsDiagnosticos,
        "Diagnósticos"
      );

      XLSX.utils.book_append_sheet(
        workbook,
        wsPerguntas,
        "Perguntas Respostas"
      );

      XLSX.utils.book_append_sheet(
        workbook,
        wsAreas,
        "Análise por Área"
      );

      XLSX.utils.book_append_sheet(
        workbook,
        wsDores,
        "Dores e Objetivos"
      );

      // ===================================================
      // DOWNLOAD
      // ===================================================

      const agora =
        new Date();

      const dataArquivo =
        agora
          .toISOString()
          .slice(
            0,
            10
          );

      const nomeArquivo =
        `diagnosticos-finder-${dataArquivo}.xlsx`;

      XLSX.writeFile(
        workbook,
        nomeArquivo
      );

    } catch (error) {
      console.error(
        "Erro exportação Excel:",
        error
      );

      setErro(
        error?.message ||
        "Não foi possível gerar o Excel."
      );

    } finally {
      setExportando(false);
    }
  }

  // =======================================================
  // RENDER LISTA
  // =======================================================

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        fontFamily: BODY_FONT,
        color: NAVY,
      }}
    >
      <header
        style={{
          background: NAVY,
          color: WHITE,
          padding: "18px 28px",
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: "0 auto",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems:
                "center",
              gap: 18,
            }}
          >
            <img
              src="/finder-logo.png"
              alt="Finder of Solutions"
              style={{
                maxWidth: 150,
                maxHeight: 45,
                objectFit:
                  "contain",
                background:
                  WHITE,
                padding: 5,
                borderRadius: 7,
              }}
            />

            <div>
              <h1
                style={{
                  margin: 0,
                  fontFamily:
                    DISPLAY_FONT,
                  fontSize: 24,
                }}
              >
                Diagnósticos
              </h1>

              <p
                style={{
                  margin:
                    "3px 0 0",
                  fontSize: 11,
                  opacity: 0.7,
                }}
              >
                Painel administrativo
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            style={{
              background:
                "transparent",

              border:
                "1px solid rgba(255,255,255,.30)",

              color:
                WHITE,

              borderRadius:
                9,

              padding:
                "8px 11px",

              cursor:
                "pointer",

              display:
                "flex",

              alignItems:
                "center",

              gap: 6,
            }}
          >
            <LogOut
              size={15}
            />

            Sair
          </button>
        </div>
      </header>

      <main
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding:
            "26px 22px 50px",
        }}
      >
        {/* ================================================= */}
        {/* CARDS RESUMO */}
        {/* ================================================= */}

        <div
          style={{
            display: "grid",

            gridTemplateColumns:
              "repeat(auto-fit,minmax(190px,1fr))",

            gap: 12,

            marginBottom:
              20,
          }}
        >
          <Card>
            <div
              style={{
                color: MUTED,
                fontSize: 11,
                marginBottom: 7,
              }}
            >
              DIAGNÓSTICOS
            </div>

            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
              }}
            >
              {total}
            </div>
          </Card>

          <Card>
            <div
              style={{
                color: MUTED,
                fontSize: 11,
                marginBottom: 7,
              }}
            >
              EXIBIDOS
            </div>

            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
              }}
            >
              {diagnosticosFiltrados.length}
            </div>
          </Card>

          <Card>
            <div
              style={{
                color: MUTED,
                fontSize: 11,
                marginBottom: 7,
              }}
            >
              SCORE MÉDIO
            </div>

            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
              }}
            >
              {mediaScore ??
                "-"}
            </div>
          </Card>
        </div>

        {/* ================================================= */}
        {/* BUSCA + EXPORTAÇÃO */}
        {/* ================================================= */}

        <Card
          style={{
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 9,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                flex:
                  "1 1 360px",

                position:
                  "relative",
              }}
            >
              <Search
                size={16}
                color={MUTED}
                style={{
                  position:
                    "absolute",
                  top: 12,
                  left: 12,
                }}
              />

              <input
                value={busca}
                onChange={(
                  e
                ) =>
                  setBusca(
                    e.target
                      .value
                  )
                }
                onKeyDown={(
                  e
                ) => {
                  if (
                    e.key ===
                    "Enter"
                  ) {
                    pesquisar();
                  }
                }}
                placeholder="Buscar empresa, CNPJ, nome, e-mail, segmento..."
                style={{
                  width:
                    "100%",

                  boxSizing:
                    "border-box",

                  border:
                    "1px solid #D8DEEA",

                  borderRadius:
                    9,

                  padding:
                    "10px 12px 10px 36px",

                  fontFamily:
                    BODY_FONT,

                  fontSize:
                    13,
                }}
              />
            </div>

            <select
              value={
                estruturaFiltro
              }
              onChange={(e) =>
                setEstruturaFiltro(
                  e.target.value
                )
              }
              style={{
                minWidth: 210,
                border:
                  "1px solid #D8DEEA",
                borderRadius: 9,
                padding:
                  "10px 12px",
                background: WHITE,
                fontFamily: BODY_FONT,
                fontSize: 12,
                color: NAVY,
              }}
            >
              <option value="">
                Todas as estruturas
              </option>

              <option value="operacional">
                Empresa operacional ({estruturasResumo.operacional || 0})
              </option>

              <option value="holding">
                Holding ({estruturasResumo.holding || 0})
              </option>

              <option value="avaliar_holding">
                Avaliação de Holding ({estruturasResumo.avaliar_holding || 0})
              </option>

              <option value="grupo">
                Grupo empresarial ({estruturasResumo.grupo || 0})
              </option>

              <option value="spe">
                SPE ({estruturasResumo.spe || 0})
              </option>

              <option value="pessoa_fisica">
                Pessoa Física ({estruturasResumo.pessoa_fisica || 0})
              </option>
            </select>

            <Botao
              onClick={
                pesquisar
              }
            >
              <Search
                size={14}
              />

              Buscar
            </Botao>

            {(buscaAplicada || estruturaFiltro) && (
              <Botao
                secundario
                onClick={
                  limparBusca
                }
              >
                Limpar
              </Botao>
            )}

            <Botao
              secundario
              onClick={() =>
                carregar(
                  buscaAplicada
                )
              }
            >
              <RefreshCcw
                size={14}
              />

              Atualizar
            </Botao>

            <Botao
              secundario
              onClick={
                exportarExcel
              }
              disabled={
                exportando
              }
              style={{
                borderColor:
                  "#0F6E56",

                color:
                  "#0F6E56",
              }}
            >
              <Download
                size={14}
              />

              {exportando
                ? "Gerando Excel..."
                : "Exportar Excel"}
            </Botao>
          </div>
        </Card>

        {/* ================================================= */}
        {/* ERRO */}
        {/* ================================================= */}

        {erro && (
          <div
            style={{
              background:
                "#FAECE7",

              color:
                "#993C1D",

              padding:
                13,

              borderRadius:
                10,

              marginBottom:
                14,

              display:
                "flex",

              gap:
                8,

              alignItems:
                "flex-start",
            }}
          >
            <AlertTriangle
              size={17}
              style={{
                flexShrink: 0,
              }}
            />

            <div>
              {erro}
            </div>
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 10,
          }}
        >
          <select
            value={
              arquivamentoDiagnosticos
            }
            onChange={(e) => {
              setArquivamentoDiagnosticos(
                e.target.value
              );
              setTimeout(
                () =>
                  carregar(
                    buscaAplicada
                  ),
                0
              );
            }}
            style={{
              border:
                "1px solid #D8DEEA",
              borderRadius: 8,
              padding: "8px 10px",
              background: WHITE,
              fontSize: 10.5,
            }}
          >
            <option value="ATIVOS">
              Ativos
            </option>
            <option value="ARQUIVADOS">
              Arquivados
            </option>
            <option value="TODOS">
              Todos
            </option>
          </select>
        </div>

        {/* ================================================= */}
        {/* LISTA */}
        {/* ================================================= */}

        {carregando ? (
          <Card>
            Carregando diagnósticos...
          </Card>

        ) : diagnosticosFiltrados.length ===
          0 ? (
          <Card>
            Nenhum diagnóstico encontrado.
          </Card>

        ) : (
          <div
            style={{
              display: "flex",
              flexDirection:
                "column",
              gap: 10,
            }}
          >
            {diagnosticosFiltrados.map(
              (item) => {
                const score =
                  scoreInfo(
                    item.score
                  );

                const dores =
                  normalizarLista(
                    item.dores
                  );

                return (
                  <div
                    key={
                      item.id
                    }
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      onAbrir(
                        item.id
                      )
                    }
                    style={{
                      width:
                        "100%",

                      background:
                        WHITE,

                      border:
                        "1px solid #E2E6EE",

                      borderRadius:
                        14,

                      padding:
                        16,

                      textAlign:
                        "left",

                      cursor:
                        "pointer",

                      display:
                        "grid",

                      gridTemplateColumns:
                        "minmax(250px,2fr) minmax(180px,1.2fr) 90px 34px",

                      gap:
                        15,

                      alignItems:
                        "center",

                      fontFamily:
                        BODY_FONT,

                      color:
                        NAVY,
                    }}
                  >
                    <div>
                      {(() => {
                        const estrutura =
                          estruturaDiagnostico(
                            item
                          );

                        const cor =
                          corEstruturaDiagnostico(
                            estrutura
                          );

                        return (
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              background:
                                cor.bg,
                              color:
                                cor.color,
                              borderRadius: 20,
                              padding:
                                "4px 8px",
                              fontSize: 9,
                              fontWeight: 900,
                              marginBottom: 7,
                            }}
                          >
                            ESTRUTURA ·{" "}
                            {labelEstruturaDiagnostico(
                              estrutura
                            )}
                          </div>
                        );
                      })()}

                      <div
                        style={{
                          fontSize:
                            9.5,
                          color:
                            MUTED,
                          fontWeight:
                            800,
                          marginBottom:
                            3,
                        }}
                      >
                        {estruturaDiagnostico(item) ===
                        "pessoa_fisica"
                          ? "PESSOA"
                          : "EMPRESA"}
                      </div>

                      <div
                        style={{
                          fontSize:
                            14,

                          fontWeight:
                            800,

                          marginBottom:
                            4,
                        }}
                      >
                        {item.razaoSocial ||
                          item.nome ||
                          (
                            estruturaDiagnostico(
                              item
                            ) ===
                            "pessoa_fisica"
                              ? "Pessoa física"
                              : estruturaDiagnostico(
                                  item
                                ) ===
                                "avaliar_holding"
                              ? "Avaliação de Holding"
                              : "Empresa não informada"
                          )}
                      </div>

                      <div
                        style={{
                          fontSize:
                            11.5,

                          color:
                            MUTED,

                          display:
                            "flex",

                          gap:
                            9,

                          flexWrap:
                            "wrap",
                        }}
                      >
                        {item.cnpj && (
                          <span>
                            {formatarCnpj(
                              item.cnpj
                            )}
                          </span>
                        )}

                        {item.segmento && (
                          <span>
                            {
                              item.segmento
                            }
                          </span>
                        )}
                      </div>

                      {dores.length >
                        0 && (
                        <div
                          style={{
                            display:
                              "flex",

                            gap:
                              5,

                            flexWrap:
                              "wrap",

                            marginTop:
                              8,
                          }}
                        >
                          {dores
                            .slice(
                              0,
                              3
                            )
                            .map(
                              (
                                dor,
                                index
                              ) => (
                                <span
                                  key={`${dor}-${index}`}
                                  style={{
                                    fontSize:
                                      9.5,

                                    background:
                                      "#FFF3EF",

                                    color:
                                      "#993C1D",

                                    borderRadius:
                                      20,

                                    padding:
                                      "3px 7px",
                                  }}
                                >
                                  {
                                    dor
                                  }
                                </span>
                              )
                            )}
                        </div>
                      )}
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize:
                            12,

                          fontWeight:
                            700,
                        }}
                      >
                        {item.nome ||
                          "Participante não informado"}
                      </div>

                      <div
                        style={{
                          fontSize:
                            10.5,

                          color:
                            MUTED,

                          marginTop:
                            3,
                        }}
                      >
                        {item.email ||
                          "-"}
                      </div>

                      <div
                        style={{
                          fontSize:
                            10.5,

                          color:
                            MUTED,

                          marginTop:
                            5,
                        }}
                      >
                        {formatarData(
                          item.criadoEm
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        textAlign:
                          "center",
                      }}
                    >
                      <div
                        style={{
                          background:
                            score.bg,

                          color:
                            score.color,

                          borderRadius:
                            12,

                          padding:
                            "8px 6px",
                        }}
                      >
                        <strong
                          style={{
                            fontSize:
                              19,
                          }}
                        >
                          {item.score ??
                            "-"}
                        </strong>

                        <div
                          style={{
                            fontSize:
                              8.5,

                            marginTop:
                              1,
                          }}
                        >
                          {
                            score.label
                          }
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        alignItems: "center",
                      }}
                      onClick={(e) =>
                        e.stopPropagation()
                      }
                    >
                      <ChevronRight
                        size={20}
                        color={MUTED}
                      />

                      <button
                        type="button"
                        disabled={
                          processandoDiagnosticoId ===
                          item.id
                        }
                        onClick={() =>
                          acaoDiagnostico(
                            item,
                            "arquivar"
                          )
                        }
                        title={
                          item.arquivado
                            ? "Desarquivar"
                            : "Arquivar"
                        }
                        style={{
                          border: 0,
                          background: "transparent",
                          color: MUTED,
                          cursor: "pointer",
                          padding: 2,
                        }}
                      >
                        {item.arquivado ? (
                          <ArchiveRestore
                            size={15}
                          />
                        ) : (
                          <Archive
                            size={15}
                          />
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={
                          processandoDiagnosticoId ===
                          item.id
                        }
                        onClick={() =>
                          acaoDiagnostico(
                            item,
                            "excluir"
                          )
                        }
                        title="Excluir diagnóstico"
                        style={{
                          border: 0,
                          background: "transparent",
                          color: "#A12B2B",
                          cursor: "pointer",
                          padding: 2,
                        }}
                      >
                        <Trash2
                          size={15}
                        />
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// =========================================================
// LEADS / CRM
// =========================================================

function LeadsCRM({ token, onAbrirDiagnostico }) {
  const [leads, setLeads] = useState([]);
  const [resumo, setResumo] = useState({});
  const [busca, setBusca] = useState("");
  const [origem, setOrigem] = useState("");
  const [statusDiagnostico, setStatusDiagnostico] = useState("");
  const [prioridadeComercial, setPrioridadeComercial] = useState("");
  const [responsaveis, setResponsaveis] = useState([]);
  const [atribuindoLeadId, setAtribuindoLeadId] = useState("");
  const [selecoesResponsavel, setSelecoesResponsavel] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [
    leadsSelecionados,
    setLeadsSelecionados,
  ] = useState([]);

  const [
    excluindoLote,
    setExcluindoLote,
  ] = useState(false);

  async function carregarLeads() {
    setCarregando(true);
    setErro("");

    try {
      const params = new URLSearchParams();
      params.set("limite", "200");

      if (busca.trim()) params.set("busca", busca.trim());
      if (origem) params.set("origem", origem);
      if (statusDiagnostico) {
        params.set("statusDiagnostico", statusDiagnostico);
      }

      if (prioridadeComercial) {
        params.set("prioridadeComercial", prioridadeComercial);
      }

      params.set(
        "arquivamento",
        arquivamentoLeads
      );

      const resposta = await fetch(
        `/api/crm?action=listar-leads&${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await resposta.json().catch(() => null);

      if (!resposta.ok || !data?.sucesso) {
        throw new Error(
          data?.error || "Não foi possível carregar os leads."
        );
      }

      const novosLeads =
        Array.isArray(
          data.leads
        )
          ? data.leads
          : [];

      setLeads(
        novosLeads
      );

      setLeadsSelecionados(
        (atuais) =>
          atuais.filter(
            (id) =>
              novosLeads.some(
                (lead) =>
                  lead.leadId ===
                  id
              )
          )
      );

      setResumo(data.resumo || {});
    } catch (error) {
      setErro(error?.message || "Erro ao carregar leads.");
    } finally {
      setCarregando(false);
    }
  }


  async function alternarArquivoLead(
    lead
  ) {
    try {
      const resposta =
        await fetch(
          "/api/crm?action=arquivar-lead",
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
            body: JSON.stringify({
              leadId:
                lead.leadId,
              arquivado:
                !lead.arquivado,
            }),
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => null);

      if (
        !resposta.ok ||
        !data?.sucesso
      ) {
        throw new Error(
          data?.error ||
          "Não foi possível arquivar o lead."
        );
      }

      await carregarLeads();
    } catch (error) {
      setErro(
        error?.message ||
        "Erro ao arquivar lead."
      );
    }
  }

  async function carregarResponsaveis() {
    try {
      const resposta = await fetch(
        "/api/crm?action=listar-responsaveis",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data =
        await resposta
          .json()
          .catch(() => null);

      if (
        !resposta.ok ||
        !data?.sucesso
      ) {
        throw new Error(
          data?.error ||
          "Não foi possível carregar os responsáveis."
        );
      }

      setResponsaveis(
        Array.isArray(
          data.responsaveis
        )
          ? data.responsaveis
          : []
      );
    } catch (error) {
      console.warn(
        "[CRM] Erro ao carregar responsáveis:",
        error
      );
    }
  }

  async function atribuirLead(
    leadId,
    responsavelId
  ) {
    if (
      !leadId ||
      !responsavelId
    ) {
      return;
    }

    setAtribuindoLeadId(
      leadId
    );

    setErro("");

    try {
      const resposta =
        await fetch(
          "/api/crm?action=atribuir-lead",
          {
            method: "POST",

            headers: {
              "content-type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body: JSON.stringify({
              leadId,
              responsavelId,
            }),
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => null);

      if (
        !resposta.ok ||
        !data?.sucesso
      ) {
        throw new Error(
          data?.error ||
          "Não foi possível atribuir o lead."
        );
      }

      await Promise.all([
        carregarLeads(),
        carregarResponsaveis(),
      ]);
    } catch (error) {
      setErro(
        error?.message ||
        "Erro ao atribuir lead."
      );
    } finally {
      setAtribuindoLeadId(
        ""
      );
    }
  }


  function leadEstaSelecionado(
    leadId
  ) {
    return leadsSelecionados.includes(
      leadId
    );
  }

  function alternarLeadSelecionado(
    leadId
  ) {
    setLeadsSelecionados(
      (atuais) =>
        atuais.includes(
          leadId
        )
          ? atuais.filter(
              (id) =>
                id !==
                leadId
            )
          : [
              ...atuais,
              leadId,
            ]
    );
  }

  function selecionarTodosVisiveis() {
    const ids =
      leads
        .map(
          (lead) =>
            lead.leadId
        )
        .filter(Boolean);

    const todosJaSelecionados =
      ids.length > 0 &&
      ids.every(
        (id) =>
          leadsSelecionados.includes(
            id
          )
      );

    if (todosJaSelecionados) {
      setLeadsSelecionados(
        (atuais) =>
          atuais.filter(
            (id) =>
              !ids.includes(
                id
              )
          )
      );
      return;
    }

    setLeadsSelecionados(
      (atuais) => [
        ...new Set([
          ...atuais,
          ...ids,
        ]),
      ]
    );
  }

  function limparSelecaoLeads() {
    setLeadsSelecionados(
      []
    );
  }

  async function excluirLeadsSelecionados() {
    const selecionados =
      leads.filter(
        (lead) =>
          leadsSelecionados.includes(
            lead.leadId
          )
      );

    if (!selecionados.length) {
      setErro(
        "Selecione ao menos um lead."
      );
      return;
    }

    const mensagem =
      selecionados.length ===
      1
        ? `Excluir 1 lead selecionado e todos os atendimentos/históricos vinculados?`
        : `Excluir ${selecionados.length} leads selecionados e todos os atendimentos/históricos vinculados?`;

    if (
      !window.confirm(
        `${mensagem}\n\nEsta ação não pode ser desfeita.`
      )
    ) {
      return;
    }

    setExcluindoLote(
      true
    );
    setErro("");

    try {
      const resposta =
        await fetch(
          "/api/crm?action=excluir-leads-lote",
          {
            method:
              "POST",
            headers: {
              "content-type":
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
            body:
              JSON.stringify({
                registros:
                  selecionados.map(
                    (lead) => ({
                      leadId:
                        lead.leadId,
                      diagnosticoId:
                        lead.diagnosticoId ||
                        "",
                    })
                  ),
              }),
          }
        );

      const data =
        await resposta
          .json()
          .catch(
            () => null
          );

      if (
        !resposta.ok &&
        resposta.status !==
          207
      ) {
        throw new Error(
          data?.error ||
          "Não foi possível excluir os leads selecionados."
        );
      }

      if (
        data?.falhas >
        0
      ) {
        setErro(
          `${data.excluidos || 0} registro(s) excluído(s), mas ${data.falhas} apresentaram erro.`
        );
      }

      setLeadsSelecionados(
        []
      );

      await carregarLeads();
    } catch (error) {
      setErro(
        error?.message ||
        "Erro ao excluir leads em lote."
      );
    } finally {
      setExcluindoLote(
        false
      );
    }
  }

  useEffect(() => {
    carregarLeads();
    carregarResponsaveis();
  }, []);

  const origensDisponiveis = useMemo(() => {
    return [...new Set(leads.map((lead) => lead.origem).filter(Boolean))].sort();
  }, [leads]);

  function corStatus(status) {
    if (status === "CONCLUIDO") return { bg: "#E1F5EE", color: "#0F6E56" };
    if (status === "EM_PREENCHIMENTO") return { bg: "#FAEEDA", color: "#854F0B" };
    if (status === "NAO_CONCLUIDO") return { bg: "#FCEBEB", color: "#791F1F" };
    return { bg: "#EEF0F5", color: MUTED };
  }

  function labelStatus(status) {
    const mapa = {
      ACESSOU: "Acessou",
      EM_PREENCHIMENTO: "Em preenchimento",
      NAO_CONCLUIDO: "Não concluído",
      CONCLUIDO: "Concluído",
    };
    return mapa[status] || status || "-";
  }

  function temperatura(lead) {
    const mapa = {
      MUITO_ALTA: "Muito alta",
      ALTA: "Alta",
      MEDIA: "Média",
      BAIXA: "Baixa",
    };

    const valor =
      lead.temperaturaComercial ||
      lead.temperatura;

    return mapa[valor] || valor || "-";
  }

  function prioridadeInfo(prioridade) {
    const mapa = {
      A: {
        label: "Prioridade A",
        descricao: "Atendimento imediato",
        bg: "#FCEBEB",
        color: "#791F1F",
      },
      B: {
        label: "Prioridade B",
        descricao: "Alta",
        bg: "#FAEEDA",
        color: "#854F0B",
      },
      C: {
        label: "Prioridade C",
        descricao: "Acompanhar",
        bg: "#FFF3EF",
        color: "#993C1D",
      },
      D: {
        label: "Prioridade D",
        descricao: "Nutrição",
        bg: "#EEF0F5",
        color: MUTED,
      },
    };

    return (
      mapa[prioridade] || {
        label: "Não classificado",
        descricao: "",
        bg: "#EEF0F5",
        color: MUTED,
      }
    );
  }

  function textoProximaAcao(valor) {
    const mapa = {
      CONTATO_COMERCIAL: "Contato comercial",
      AGENDAR_REUNIAO: "Agendar reunião",
      FOLLOW_UP_CONSULTIVO: "Follow-up consultivo",
      NUTRICAO: "Nutrição",
    };

    return mapa[valor] || valor || "-";
  }

  function textoPrazo(valor) {
    const mapa = {
      "2_HORAS": "Até 2 horas",
      "24_HORAS": "Até 24 horas",
      "3_DIAS": "Até 3 dias",
      NUTRICAO: "Sem urgência",
    };

    return mapa[valor] || valor || "-";
  }

  function nomeResponsavel(id) {
    if (!id) {
      return "Não atribuído";
    }

    const encontrado =
      responsaveis.find(
        (item) =>
          item.id === id
      );

    return (
      encontrado?.nome ||
      "Responsável não encontrado"
    );
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <Card>
          <Users size={18} color={CORAL} />
          <div style={{ color: MUTED, fontSize: 10, marginTop: 8 }}>LEADS</div>
          <div style={{ fontSize: 29, fontWeight: 900 }}>{resumo.total ?? 0}</div>
        </Card>

        <Card>
          <Activity size={18} color="#854F0B" />
          <div style={{ color: MUTED, fontSize: 10, marginTop: 8 }}>
            EM PREENCHIMENTO
          </div>
          <div style={{ fontSize: 29, fontWeight: 900 }}>
            {resumo.emPreenchimento ?? 0}
          </div>
        </Card>

        <Card>
          <Clock3 size={18} color="#791F1F" />
          <div style={{ color: MUTED, fontSize: 10, marginTop: 8 }}>
            NÃO CONCLUÍDOS
          </div>
          <div style={{ fontSize: 29, fontWeight: 900 }}>
            {resumo.naoConcluidos ?? 0}
          </div>
        </Card>

        <Card>
          <CheckCircle2 size={18} color="#0F6E56" />
          <div style={{ color: MUTED, fontSize: 10, marginTop: 8 }}>CONCLUÍDOS</div>
          <div style={{ fontSize: 29, fontWeight: 900 }}>
            {resumo.concluidos ?? 0}
          </div>
        </Card>

        <Card>
          <div style={{ color: MUTED, fontSize: 10 }}>TAXA DE CONCLUSÃO</div>
          <div style={{ fontSize: 29, fontWeight: 900 }}>
            {resumo.taxaConclusao ?? 0}%
          </div>
        </Card>

        <Card
          style={{
            background: "#FCEBEB",
            borderColor: "#F0C5C5",
          }}
        >
          <Flame size={18} color="#791F1F" />
          <div style={{ color: "#791F1F", fontSize: 10, marginTop: 8 }}>
            PRIORIDADE A
          </div>
          <div style={{ fontSize: 29, fontWeight: 900, color: "#791F1F" }}>
            {resumo.prioridadeA ?? 0}
          </div>
        </Card>

        <Card
          style={{
            background: "#FAEEDA",
            borderColor: "#E9D3A5",
          }}
        >
          <div style={{ color: "#854F0B", fontSize: 10 }}>
            PRIORIDADE B
          </div>
          <div style={{ fontSize: 29, fontWeight: 900, color: "#854F0B" }}>
            {resumo.prioridadeB ?? 0}
          </div>
        </Card>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && carregarLeads()}
            placeholder="Buscar nome, empresa, CNPJ, telefone..."
            style={{
              flex: "1 1 280px",
              border: "1px solid #D8DEEA",
              borderRadius: 9,
              padding: "10px 12px",
              fontFamily: BODY_FONT,
            }}
          />

          <select
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
            style={{
              border: "1px solid #D8DEEA",
              borderRadius: 9,
              padding: "10px 12px",
              background: WHITE,
            }}
          >
            <option value="">Todas as origens</option>
            {origensDisponiveis.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <select
            value={statusDiagnostico}
            onChange={(e) => setStatusDiagnostico(e.target.value)}
            style={{
              border: "1px solid #D8DEEA",
              borderRadius: 9,
              padding: "10px 12px",
              background: WHITE,
            }}
          >
            <option value="">Todos os status</option>
            <option value="ACESSOU">Acessou</option>
            <option value="EM_PREENCHIMENTO">Em preenchimento</option>
            <option value="NAO_CONCLUIDO">Não concluído</option>
            <option value="CONCLUIDO">Concluído</option>
          </select>

          <select
            value={prioridadeComercial}
            onChange={(e) => setPrioridadeComercial(e.target.value)}
            style={{
              border: "1px solid #D8DEEA",
              borderRadius: 9,
              padding: "10px 12px",
              background: WHITE,
            }}
          >
            <option value="">Todas as prioridades</option>
            <option value="A">Prioridade A</option>
            <option value="B">Prioridade B</option>
            <option value="C">Prioridade C</option>
            <option value="D">Prioridade D</option>
          </select>

          <Botao onClick={carregarLeads}>
            <Search size={14} /> Filtrar
          </Botao>

          <Botao
            secundario
            onClick={() => {
              setBusca("");
              setOrigem("");
              setStatusDiagnostico("");
              setPrioridadeComercial("");
              setTimeout(carregarLeads, 0);
            }}
          >
            Limpar
          </Botao>

          <Botao secundario onClick={carregarLeads}>
            <RefreshCcw size={14} /> Atualizar
          </Botao>
        </div>
      </Card>

      {erro && (
        <div
          style={{
            background: "#FAECE7",
            color: "#993C1D",
            borderRadius: 10,
            padding: 12,
            marginBottom: 14,
          }}
        >
          {erro}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 10,
        }}
      >
        <select
          value={arquivamentoLeads}
          onChange={(e) => {
            setArquivamentoLeads(
              e.target.value
            );
            setTimeout(
              carregarLeads,
              0
            );
          }}
          style={{
            border:
              "1px solid #D8DEEA",
            borderRadius: 8,
            padding: "8px 10px",
            background: WHITE,
            fontSize: 10.5,
          }}
        >
          <option value="ATIVOS">
            Ativos
          </option>
          <option value="ARQUIVADOS">
            Arquivados
          </option>
          <option value="TODOS">
            Todos
          </option>
        </select>
      </div>

      {leads.length > 0 && (
        <Card
          style={{
            marginBottom: 12,
            padding: 12,
            background:
              leadsSelecionados.length
                ? "#FFF7F3"
                : "#FBFCFE",
            borderColor:
              leadsSelecionados.length
                ? "#F2C5B8"
                : "#D8DEEA",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              gap: 10,
              flexWrap:
                "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems:
                  "center",
                gap: 9,
                flexWrap:
                  "wrap",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems:
                    "center",
                  gap: 7,
                  fontSize: 10.5,
                  fontWeight: 800,
                  cursor:
                    "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    leads.length >
                      0 &&
                    leads.every(
                      (lead) =>
                        leadsSelecionados.includes(
                          lead.leadId
                        )
                    )
                  }
                  onChange={
                    selecionarTodosVisiveis
                  }
                />

                Selecionar todos os exibidos
              </label>

              <span
                style={{
                  background:
                    leadsSelecionados.length
                      ? CORAL
                      : "#E9EDF5",
                  color:
                    leadsSelecionados.length
                      ? WHITE
                      : MUTED,
                  borderRadius:
                    999,
                  padding:
                    "5px 9px",
                  fontSize:
                    9.5,
                  fontWeight:
                    900,
                }}
              >
                {
                  leadsSelecionados.length
                }{" "}
                selecionado(s)
              </span>
            </div>

            <div
              style={{
                display: "flex",
                gap: 7,
                flexWrap:
                  "wrap",
              }}
            >
              {leadsSelecionados.length >
                0 && (
                <button
                  type="button"
                  onClick={
                    limparSelecaoLeads
                  }
                  style={{
                    border:
                      "1px solid #D8DEEA",
                    background:
                      WHITE,
                    color:
                      NAVY,
                    borderRadius:
                      8,
                    padding:
                      "8px 10px",
                    fontSize:
                      9.8,
                    fontWeight:
                      800,
                    cursor:
                      "pointer",
                  }}
                >
                  Limpar seleção
                </button>
              )}

              <button
                type="button"
                disabled={
                  !leadsSelecionados.length ||
                  excluindoLote
                }
                onClick={
                  excluirLeadsSelecionados
                }
                style={{
                  border:
                    "1px solid #E2B8B8",
                  background:
                    leadsSelecionados.length
                      ? "#A12B2B"
                      : "#F3F3F3",
                  color:
                    leadsSelecionados.length
                      ? WHITE
                      : "#999",
                  borderRadius:
                    8,
                  padding:
                    "8px 11px",
                  fontSize:
                    9.8,
                  fontWeight:
                    900,
                  cursor:
                    !leadsSelecionados.length ||
                    excluindoLote
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {excluindoLote
                  ? "Excluindo..."
                  : `Excluir selecionados${
                      leadsSelecionados.length
                        ? ` (${leadsSelecionados.length})`
                        : ""
                    }`}
              </button>
            </div>
          </div>
        </Card>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          margin: "18px 0 10px",
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 20,
              margin: 0,
            }}
          >
            Fila de atendimento
          </h2>

          <p
            style={{
              margin: "4px 0 0",
              color: MUTED,
              fontSize: 10.5,
            }}
          >
            Ordenada automaticamente por prioridade comercial e score.
          </p>
        </div>
      </div>

      {carregando ? (
        <Card>Carregando leads...</Card>
      ) : leads.length === 0 ? (
        <Card>Nenhum lead encontrado.</Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {leads.map((lead) => {
            const status = corStatus(lead.statusDiagnostico);
            const progresso = Math.max(
              0,
              Math.min(100, Number(lead.progressoPercentual) || 0)
            );

            return (
              <Card
                key={
                  lead.leadId
                }
                style={{
                  padding: 15,
                  borderColor:
                    leadEstaSelecionado(
                      lead.leadId
                    )
                      ? CORAL
                      : undefined,
                  background:
                    leadEstaSelecionado(
                      lead.leadId
                    )
                      ? "#FFFDFB"
                      : WHITE,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "34px minmax(220px,1.5fr) minmax(130px,.75fr) minmax(170px,1fr) minmax(190px,1.1fr) minmax(190px,1.05fr) minmax(150px,.8fr)",
                    gap: 14,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "center",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        leadEstaSelecionado(
                          lead.leadId
                        )
                      }
                      onChange={() =>
                        alternarLeadSelecionado(
                          lead.leadId
                        )
                      }
                      aria-label={`Selecionar ${
                        lead.razaoSocial ||
                        lead.nome ||
                        "lead"
                      }`}
                      style={{
                        width: 16,
                        height: 16,
                        cursor:
                          "pointer",
                      }}
                    />
                  </div>

                  <div>
                    <strong style={{ fontSize: 13.5 }}>
                      {lead.razaoSocial || lead.nome || "Lead sem identificação"}
                    </strong>

                    <div style={{ fontSize: 10.5, color: MUTED, marginTop: 4 }}>
                      {lead.nome || "-"}
                      {lead.telefone ? ` · ${lead.telefone}` : ""}
                    </div>

                    <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>
                      {lead.origem || "direto"}
                      {lead.campanha ? ` · ${lead.campanha}` : ""}

                      {lead.estruturaNegocio && (
                        <>
                          {" · "}
                          {labelEstruturaDiagnostico(
                            lead.estruturaNegocio
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <span
                      style={{
                        display: "inline-block",
                        background: status.bg,
                        color: status.color,
                        borderRadius: 20,
                        padding: "5px 8px",
                        fontSize: 9.5,
                        fontWeight: 800,
                      }}
                    >
                      {labelStatus(lead.statusDiagnostico)}
                    </span>

                    <div style={{ fontSize: 9.5, color: MUTED, marginTop: 6 }}>
                      {lead.etapaAtual || "-"}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        height: 8,
                        background: "#E9EDF5",
                        borderRadius: 20,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${progresso}%`,
                          height: "100%",
                          background: CORAL,
                        }}
                      />
                    </div>

                    <div style={{ fontSize: 10, color: MUTED, marginTop: 5 }}>
                      {progresso}% · última atividade {formatarData(lead.ultimaAtividade)}
                    </div>
                  </div>

                  <div>
                    {(() => {
                      const info =
                        prioridadeInfo(
                          lead.prioridadeComercial
                        );

                      return (
                        <>
                          <div
                            style={{
                              display: "inline-flex",
                              flexDirection: "column",
                              background: info.bg,
                              color: info.color,
                              borderRadius: 9,
                              padding: "6px 8px",
                              minWidth: 95,
                            }}
                          >
                            <strong style={{ fontSize: 10.5 }}>
                              {info.label}
                            </strong>

                            <span style={{ fontSize: 9, marginTop: 2 }}>
                              {info.descricao}
                            </span>
                          </div>

                          <div
                            style={{
                              fontSize: 10,
                              color: MUTED,
                              marginTop: 7,
                              lineHeight: 1.4,
                            }}
                          >
                            Score comercial:{" "}
                            <strong style={{ color: NAVY }}>
                              {lead.scoreComercial ?? 0}/100
                            </strong>
                          </div>

                          <div
                            style={{
                              fontSize: 10,
                              color: MUTED,
                              marginTop: 4,
                              lineHeight: 1.4,
                            }}
                          >
                            {textoProximaAcao(
                              lead.proximaAcao
                            )}
                            {" · "}
                            {textoPrazo(
                              lead.prazoAtendimento
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 9.5,
                        color: MUTED,
                        fontWeight: 800,
                        marginBottom: 5,
                      }}
                    >
                      RESPONSÁVEL FINDER
                    </div>

                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        color: NAVY,
                        marginBottom: 6,
                      }}
                    >
                      {nomeResponsavel(
                        lead.responsavelFinder
                      )}
                    </div>

                    <select
                      value={
                        selecoesResponsavel[
                          lead.leadId
                        ] ||
                        lead.responsavelFinder ||
                        ""
                      }
                      onChange={(e) =>
                        setSelecoesResponsavel(
                          (atual) => ({
                            ...atual,

                            [lead.leadId]:
                              e.target.value,
                          })
                        )
                      }
                      style={{
                        width: "100%",
                        border:
                          "1px solid #D8DEEA",
                        borderRadius: 8,
                        padding: "7px 8px",
                        background: WHITE,
                        fontSize: 10,
                        marginBottom: 6,
                      }}
                    >
                      <option value="">
                        Não atribuído
                      </option>

                      {responsaveis.map(
                        (responsavel) => (
                          <option
                            key={
                              responsavel.id
                            }
                            value={
                              responsavel.id
                            }
                          >
                            {responsavel.nome}
                            {" · "}
                            {
                              responsavel.leadsAbertos
                            }
                            {" abertos"}
                          </option>
                        )
                      )}
                    </select>

                    <button
                      type="button"
                      disabled={
                        atribuindoLeadId ===
                        lead.leadId
                      }
                      onClick={() =>
                        atribuirLead(
                          lead.leadId,
                          selecoesResponsavel[
                            lead.leadId
                          ] ||
                            lead.responsavelFinder
                        )
                      }
                      style={{
                        width: "100%",
                        border: 0,
                        borderRadius: 8,
                        padding: "7px 8px",
                        background: NAVY,
                        color: WHITE,
                        fontSize: 9.8,
                        fontWeight: 800,
                        cursor:
                          atribuindoLeadId ===
                          lead.leadId
                            ? "not-allowed"
                            : "pointer",
                        opacity:
                          atribuindoLeadId ===
                          lead.leadId
                            ? 0.6
                            : 1,
                      }}
                    >
                      {atribuindoLeadId ===
                      lead.leadId
                        ? "Atribuindo..."
                        : lead.responsavelFinder
                        ? "Reatribuir"
                        : "Atribuir"}
                    </button>
                  </div>

                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 10.5,
                        fontWeight: 800,
                      }}
                    >
                      <Flame size={14} color={CORAL} />
                      {temperatura(lead)}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        alternarArquivoLead(
                          lead
                        )
                      }
                      style={{
                        marginTop: 7,
                        width: "100%",
                        border:
                          "1px solid #D8DEEA",
                        background:
                          WHITE,
                        color: NAVY,
                        borderRadius: 8,
                        padding: "7px 8px",
                        fontSize: 9.8,
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {lead.arquivado
                        ? "Desarquivar lead"
                        : "Arquivar lead"}
                    </button>

                    {lead.diagnosticoId ? (
                      <button
                        type="button"
                        onClick={() => onAbrirDiagnostico(lead.diagnosticoId)}
                        style={{
                          marginTop: 7,
                          border: 0,
                          padding: 0,
                          background: "transparent",
                          color: CORAL,
                          fontSize: 10.5,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        Abrir diagnóstico →
                      </button>
                    ) : (
                      <div style={{ fontSize: 9.5, color: MUTED, marginTop: 7 }}>
                        Diagnóstico ainda não vinculado
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =========================================================
// EQUIPE / CAPACIDADE
// =========================================================

function EquipeCapacidade({
  token,
}) {
  const [
    responsaveis,
    setResponsaveis,
  ] = useState([]);

  const [
    editandoId,
    setEditandoId,
  ] = useState("");

  const [
    nome,
    setNome,
  ] = useState("");

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    telefone,
    setTelefone,
  ] = useState("");

  const [
    capacidadeDiaria,
    setCapacidadeDiaria,
  ] = useState("3");

  const [
    areas,
    setAreas,
  ] = useState([]);

  const [
    perfil,
    setPerfil,
  ] = useState("ESPECIALISTA");

  const [
    permissoes,
    setPermissoes,
  ] = useState({
    verRelatorioPropriaArea: true,
    verRespostasPropriaArea: true,
    inserirObservacoes: true,
    alterarStatusAtendimento: true,
    verDiagnosticoCompleto: false,
    verEstrategiaComercial: false,
    verValoresPropostas: false,
    verOutrosDepartamentos: false,
  });

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    salvando,
    setSalvando,
  ] = useState(false);

  const [
    erro,
    setErro,
  ] = useState("");

  const [
    sucesso,
    setSucesso,
  ] = useState("");

  const areasDisponiveis = [
    "Marketing",
    "Jurídico",
    "Contábil/Fiscal",
    "Tributário",
    "Financeiro",
    "Administrativo",
    "Gestão",
    "Operacional",
    "RH",
    "Comercial",
    "Tecnologia",

    // Estruturas patrimoniais / societárias
    "Patrimônio",
    "Participações societárias",
    "Imóveis",
    "Receitas patrimoniais",
    "Governança",
    "Sucessão",
    "Proteção patrimonial",
    "Custos da estrutura",

    // Grupo empresarial
    "Estrutura do grupo",
    "Financeiro consolidado",
    "Operações intercompany",
    "Pessoas compartilhadas",
    "Operações do grupo",

    // SPE
    "Projeto / empreendimento",
    "Sócios e investidores",
    "Aportes e capital",
    "Contratos",
    "Riscos do projeto",
    "Saída / encerramento",

    // Pessoa física
    "Organização financeira",
    "Fluxo financeiro pessoal",
    "Endividamento",
    "Reserva e segurança",
    "Investimentos",
    "Aposentadoria",
    "Proteção familiar",
    "Tributário PF",
    "Objetivos",
  ];

  const permissoesDisponiveis = [
    {
      id: "verRelatorioPropriaArea",
      label: "Ver relatório da própria área",
    },
    {
      id: "verRespostasPropriaArea",
      label: "Ver respostas da própria área",
    },
    {
      id: "inserirObservacoes",
      label: "Inserir observações",
    },
    {
      id: "alterarStatusAtendimento",
      label: "Alterar status do atendimento",
    },
    {
      id: "verDiagnosticoCompleto",
      label: "Ver diagnóstico completo",
    },
    {
      id: "verEstrategiaComercial",
      label: "Ver estratégia comercial",
    },
    {
      id: "verValoresPropostas",
      label: "Ver valores e propostas",
    },
    {
      id: "verOutrosDepartamentos",
      label: "Ver outros departamentos",
    },
  ];

  async function carregar() {
    setCarregando(true);
    setErro("");

    try {
      const resposta =
        await fetch(
          "/api/crm?action=listar-responsaveis",
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => null);

      if (
        !resposta.ok ||
        !data?.sucesso
      ) {
        throw new Error(
          data?.error ||
          "Não foi possível carregar a equipe."
        );
      }

      setResponsaveis(
        Array.isArray(
          data.responsaveis
        )
          ? data.responsaveis
          : []
      );
    } catch (error) {
      setErro(
        error?.message ||
        "Erro ao carregar equipe."
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function alternarArea(
    area
  ) {
    setAreas(
      (atuais) =>
        atuais.includes(area)
          ? atuais.filter(
              (item) =>
                item !== area
            )
          : [
              ...atuais,
              area,
            ]
    );
  }

  async function salvar() {
    if (!nome.trim()) {
      setErro(
        "Informe o nome do responsável."
      );

      return;
    }

    setSalvando(true);
    setErro("");
    setSucesso("");

    try {
      const resposta =
        await fetch(
          "/api/crm?action=salvar-responsavel",
          {
            method: "POST",

            headers: {
              "content-type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body: JSON.stringify({
              id:
                editandoId ||
                undefined,

              nome:
                nome.trim(),

              email:
                email.trim(),

              telefone:
                telefone.trim(),

              areas,

              capacidadeDiaria:
                Number(
                  capacidadeDiaria
                ) || 0,

              perfil,

              permissoes,

              ativo:
                true,
            }),
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => null);

      if (
        !resposta.ok ||
        !data?.sucesso
      ) {
        throw new Error(
          data?.error ||
          "Não foi possível salvar o responsável."
        );
      }

      setEditandoId("");
      setNome("");
      setEmail("");
      setTelefone("");
      setCapacidadeDiaria("3");
      setAreas([]);
      setPerfil("ESPECIALISTA");
      setPermissoes({
        verRelatorioPropriaArea: true,
        verRespostasPropriaArea: true,
        inserirObservacoes: true,
        alterarStatusAtendimento: true,
        verDiagnosticoCompleto: false,
        verEstrategiaComercial: false,
        verValoresPropostas: false,
        verOutrosDepartamentos: false,
      });

      setSucesso(
        "Responsável salvo com sucesso."
      );

      await carregar();
    } catch (error) {
      setErro(
        error?.message ||
        "Erro ao salvar responsável."
      );
    } finally {
      setSalvando(false);
    }
  }

  function editarResponsavel(responsavel) {
    setEditandoId(responsavel.id);
    setNome(responsavel.nome || "");
    setEmail(responsavel.email || "");
    setTelefone(responsavel.telefone || "");
    setCapacidadeDiaria(String(responsavel.capacidadeDiaria ?? 3));
    setAreas(Array.isArray(responsavel.areas) ? responsavel.areas : []);
    setPerfil(responsavel.perfil || "ESPECIALISTA");
    setPermissoes(responsavel.permissoes || permissoes);
    setSucesso("Editando membro da equipe.");
  }

  async function excluirResponsavelAdmin(responsavel) {
    if (!window.confirm(`Excluir ${responsavel.nome} da equipe?`)) return;

    try {
      let resposta = await fetch("/api/crm?action=excluir-responsavel", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ responsavelId: responsavel.id }),
      });

      let data = await resposta.json().catch(() => null);

      if (resposta.status === 409 && data?.possuiAtendimentosAbertos) {
        const confirmar = window.confirm(
          `${responsavel.nome} possui ${data.totalAbertos} atendimento(s) aberto(s). Excluir mesmo assim e deixar os casos sem responsável?`
        );
        if (!confirmar) return;

        resposta = await fetch("/api/crm?action=excluir-responsavel", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            responsavelId: responsavel.id,
            forcar: true,
          }),
        });

        data = await resposta.json().catch(() => null);
      }

      if (!resposta.ok || !data?.sucesso) {
        throw new Error(data?.error || "Não foi possível excluir o membro.");
      }

      await carregar();
    } catch (error) {
      setErro(error?.message || "Erro ao excluir membro.");
    }
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(320px,.9fr) minmax(0,1.5fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        <Card>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <UserPlus
              size={18}
              color={CORAL}
            />

            <div>
              <h2
                style={{
                  margin: 0,
                  fontFamily:
                    DISPLAY_FONT,
                  fontSize: 19,
                }}
              >
                Novo responsável
              </h2>

              <div
                style={{
                  fontSize: 10.5,
                  color: MUTED,
                  marginTop: 2,
                }}
              >
                Cadastre quem poderá receber leads.
              </div>
            </div>
          </div>

          <label
            style={{
              display: "block",
              fontSize: 10.5,
              fontWeight: 800,
              marginBottom: 5,
            }}
          >
            Nome
          </label>

          <input
            value={nome}
            onChange={(e) =>
              setNome(
                e.target.value
              )
            }
            placeholder="Ex.: Diones"
            style={{
              width: "100%",
              boxSizing: "border-box",
              border:
                "1px solid #D8DEEA",
              borderRadius: 9,
              padding: "10px 11px",
              marginBottom: 10,
            }}
          />

          <label
            style={{
              display: "block",
              fontSize: 10.5,
              fontWeight: 800,
              marginBottom: 5,
            }}
          >
            E-mail
          </label>

          <input
            value={email}
            onChange={(e) =>
              setEmail(
                e.target.value
              )
            }
            placeholder="email@finder.com.br"
            style={{
              width: "100%",
              boxSizing: "border-box",
              border:
                "1px solid #D8DEEA",
              borderRadius: 9,
              padding: "10px 11px",
              marginBottom: 10,
            }}
          />

          <label
            style={{
              display: "block",
              fontSize: 10.5,
              fontWeight: 800,
              marginBottom: 5,
            }}
          >
            Telefone
          </label>

          <input
            value={telefone}
            onChange={(e) =>
              setTelefone(
                e.target.value
              )
            }
            placeholder="41999999999"
            style={{
              width: "100%",
              boxSizing: "border-box",
              border:
                "1px solid #D8DEEA",
              borderRadius: 9,
              padding: "10px 11px",
              marginBottom: 10,
            }}
          />

          <label
            style={{
              display: "block",
              fontSize: 10.5,
              fontWeight: 800,
              marginBottom: 5,
            }}
          >
            Capacidade diária
          </label>

          <input
            type="number"
            min="0"
            max="50"
            value={capacidadeDiaria}
            onChange={(e) =>
              setCapacidadeDiaria(
                e.target.value
              )
            }
            style={{
              width: "100%",
              boxSizing: "border-box",
              border:
                "1px solid #D8DEEA",
              borderRadius: 9,
              padding: "10px 11px",
              marginBottom: 12,
            }}
          />

          <label
            style={{
              display: "block",
              fontSize: 10.5,
              fontWeight: 800,
              marginBottom: 5,
            }}
          >
            Perfil
          </label>

          <select
            value={perfil}
            onChange={(e) => {
              const novoPerfil =
                e.target.value;

              setPerfil(
                novoPerfil
              );

              if (novoPerfil === "ADMIN") {
                setPermissoes({
                  verRelatorioPropriaArea: true,
                  verRespostasPropriaArea: true,
                  inserirObservacoes: true,
                  alterarStatusAtendimento: true,
                  verDiagnosticoCompleto: true,
                  verEstrategiaComercial: true,
                  verValoresPropostas: true,
                  verOutrosDepartamentos: true,
                });
              }
            }}
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid #D8DEEA",
              borderRadius: 9,
              padding: "10px 11px",
              marginBottom: 12,
              background: WHITE,
            }}
          >
            <option value="ESPECIALISTA">
              Especialista
            </option>

            <option value="ADMIN">
              Administrador
            </option>
          </select>

          <div
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              marginBottom: 7,
            }}
          >
            Áreas de atuação
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 14,
            }}
          >
            {areasDisponiveis.map(
              (area) => {
                const ativa =
                  areas.includes(
                    area
                  );

                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() =>
                      alternarArea(
                        area
                      )
                    }
                    style={{
                      border:
                        ativa
                          ? `1px solid ${CORAL}`
                          : "1px solid #D8DEEA",
                      background:
                        ativa
                          ? "#FFF3EF"
                          : WHITE,
                      color:
                        ativa
                          ? "#993C1D"
                          : NAVY,
                      borderRadius: 20,
                      padding: "6px 9px",
                      fontSize: 9.5,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {area}
                  </button>
                );
              }
            )}
          </div>

          <div
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              marginBottom: 7,
            }}
          >
            Permissões
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 6,
              marginBottom: 14,
            }}
          >
            {permissoesDisponiveis.map(
              (item) => (
                <label
                  key={item.id}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    fontSize: 10.5,
                    color: NAVY,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(
                      permissoes[item.id]
                    )}
                    onChange={(e) =>
                      setPermissoes(
                        (atuais) => ({
                          ...atuais,
                          [item.id]:
                            e.target.checked,
                        })
                      )
                    }
                  />

                  <span>
                    {item.label}
                  </span>
                </label>
              )
            )}
          </div>

          {erro && (
            <div
              style={{
                background: "#FAECE7",
                color: "#993C1D",
                borderRadius: 9,
                padding: 9,
                fontSize: 10.5,
                marginBottom: 10,
              }}
            >
              {erro}
            </div>
          )}

          {sucesso && (
            <div
              style={{
                background: "#E1F5EE",
                color: "#0F6E56",
                borderRadius: 9,
                padding: 9,
                fontSize: 10.5,
                marginBottom: 10,
              }}
            >
              {sucesso}
            </div>
          )}

          <Botao
            onClick={salvar}
            disabled={salvando}
            style={{
              width: "100%",
            }}
          >
            <Save size={14} />

            {salvando
              ? "Salvando..."
              : editandoId
              ? "Salvar alterações"
              : "Salvar responsável"}
          </Botao>
        </Card>

        <div>
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              marginBottom: 10,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontFamily:
                    DISPLAY_FONT,
                  fontSize: 20,
                }}
              >
                Equipe disponível
              </h2>

              <p
                style={{
                  margin:
                    "3px 0 0",
                  fontSize: 10.5,
                  color: MUTED,
                }}
              >
                Capacidade configurada e carga atual por responsável.
              </p>
            </div>

            <Botao
              secundario
              onClick={carregar}
            >
              <RefreshCcw
                size={14}
              />

              Atualizar
            </Botao>
          </div>

          {carregando ? (
            <Card>
              Carregando equipe...
            </Card>
          ) : responsaveis.length ===
            0 ? (
            <Card>
              Nenhum responsável cadastrado.
            </Card>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(230px,1fr))",
                gap: 10,
              }}
            >
              {responsaveis.map(
                (
                  responsavel
                ) => (
                  <Card
                    key={
                      responsavel.id
                    }
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        gap: 10,
                        marginBottom: 10,
                      }}
                    >
                      <div>
                        <strong
                          style={{
                            fontSize: 13.5,
                          }}
                        >
                          {responsavel.nome}
                        </strong>

                        <div
                          style={{
                            display: "inline-block",
                            marginTop: 5,
                            background:
                              responsavel.perfil === "ADMIN"
                                ? "#EEF3FF"
                                : "#FFF3EF",
                            color:
                              responsavel.perfil === "ADMIN"
                                ? "#31589C"
                                : "#993C1D",
                            borderRadius: 20,
                            padding: "3px 7px",
                            fontSize: 8.5,
                            fontWeight: 800,
                          }}
                        >
                          {responsavel.perfil === "ADMIN"
                            ? "ADMIN"
                            : "ESPECIALISTA"}
                        </div>

                        <div
                          style={{
                            color: MUTED,
                            fontSize: 10,
                            marginTop: 3,
                          }}
                        >
                          {responsavel.email ||
                            "-"}
                        </div>
                      </div>

                      <Gauge
                        size={19}
                        color={CORAL}
                      />
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "1fr 1fr",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          background:
                            "#F7F8FB",
                          borderRadius: 9,
                          padding: 9,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 9,
                            color: MUTED,
                          }}
                        >
                          CAPACIDADE/DIA
                        </div>

                        <strong
                          style={{
                            fontSize: 17,
                          }}
                        >
                          {
                            responsavel.capacidadeDiaria
                          }
                        </strong>
                      </div>

                      <div
                        style={{
                          background:
                            "#F7F8FB",
                          borderRadius: 9,
                          padding: 9,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 9,
                            color: MUTED,
                          }}
                        >
                          LEADS ABERTOS
                        </div>

                        <strong
                          style={{
                            fontSize: 17,
                          }}
                        >
                          {
                            responsavel.leadsAbertos
                          }
                        </strong>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 5,
                        flexWrap: "wrap",
                      }}
                    >
                      {normalizarLista(
                        responsavel.areas
                      ).map(
                        (
                          area
                        ) => (
                          <span
                            key={area}
                            style={{
                              background:
                                "#FFF3EF",
                              color:
                                "#993C1D",
                              borderRadius:
                                20,
                              padding:
                                "3px 7px",
                              fontSize:
                                9,
                            }}
                          >
                            {area}
                          </span>
                        )
                      )}
                    <div
                      style={{
                        display: "flex",
                        gap: 7,
                        marginTop: 12,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => editarResponsavel(responsavel)}
                        style={{
                          flex: 1,
                          border: "1px solid #D8DEEA",
                          background: WHITE,
                          color: NAVY,
                          borderRadius: 8,
                          padding: "7px 9px",
                          fontSize: 9.5,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => excluirResponsavelAdmin(responsavel)}
                        style={{
                          flex: 1,
                          border: "1px solid #E2B8B8",
                          background: "#FFF7F7",
                          color: "#A12B2B",
                          borderRadius: 8,
                          padding: "7px 9px",
                          fontSize: 9.5,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        Excluir
                      </button>
                    </div>

                    </div>
                  </Card>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================
// ATENDIMENTOS POR DEPARTAMENTO
// =========================================================

function AtendimentosDepartamento({
  token,
  onAbrirDiagnostico,
}) {
  const [
    atendimentos,
    setAtendimentos,
  ] = useState([]);

  const [
    responsaveis,
    setResponsaveis,
  ] = useState([]);

  const [
    leads,
    setLeads,
  ] = useState([]);

  const [
    busca,
    setBusca,
  ] = useState("");

  const [
    areaFiltro,
    setAreaFiltro,
  ] = useState("");

  const [
    statusFiltro,
    setStatusFiltro,
  ] = useState("");

  const [
    responsavelFiltro,
    setResponsavelFiltro,
  ] = useState("");

  const [
    oportunidadeFiltro,
    setOportunidadeFiltro,
  ] = useState("");

  const [
    statusDiagnosticoFiltro,
    setStatusDiagnosticoFiltro,
  ] = useState("");

  const [
    origemFiltro,
    setOrigemFiltro,
  ] = useState("");

  const [
    estruturaFiltro,
    setEstruturaFiltro,
  ] = useState("");

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    salvandoId,
    setSalvandoId,
  ] = useState("");

  const [
    erro,
    setErro,
  ] = useState("");

  const [
    edicoes,
    setEdicoes,
  ] = useState({});

  // Atendimento aberto = "caso" operacional do consultor.
  const [
    atendimentoAberto,
    setAtendimentoAberto,
  ] = useState(null);

  const [
    diagnosticoAtendimento,
    setDiagnosticoAtendimento,
  ] = useState(null);

  const [
    historicoAtendimento,
    setHistoricoAtendimento,
  ] = useState([]);

  const [
    carregandoCaso,
    setCarregandoCaso,
  ] = useState(false);

  const [
    salvandoAcionamento,
    setSalvandoAcionamento,
  ] = useState(false);

  const [
    tipoAcionamento,
    setTipoAcionamento,
  ] = useState("WHATSAPP");

  const [
    resultadoAcionamento,
    setResultadoAcionamento,
  ] = useState("");

  const [
    descricaoAcionamento,
    setDescricaoAcionamento,
  ] = useState("");

  const [
    proximaAcaoCaso,
    setProximaAcaoCaso,
  ] = useState("");

  const [
    proximoContatoCaso,
    setProximoContatoCaso,
  ] = useState("");

  const [
    statusCaso,
    setStatusCaso,
  ] = useState("NAO_INICIADO");

  const [
    oportunidadeCaso,
    setOportunidadeCaso,
  ] = useState("NAO_ANALISADA");


  const [
    propostasAtendimento,
    setPropostasAtendimento,
  ] = useState([]);

  const [
    carregandoPropostas,
    setCarregandoPropostas,
  ] = useState(false);

  const [
    salvandoProposta,
    setSalvandoProposta,
  ] = useState(false);

  const [
    propostaEditandoId,
    setPropostaEditandoId,
  ] = useState("");

  const [
    propostaForm,
    setPropostaForm,
  ] = useState({
    servico: "",
    descricao: "",
    tipoReceita: "PONTUAL",
    valorTotal: "",
    mensalidade: "",
    taxaImplantacao: "",
    status: "RASCUNHO",
    validade: "",
    motivoPerda: "",
    observacoes: "",
  });


  function formatarMoeda(valor) {
    return Number(
      valor ||
      0
    ).toLocaleString(
      "pt-BR",
      {
        style: "currency",
        currency: "BRL",
      }
    );
  }

  function statusPropostaLabel(status) {
    const mapa = {
      RASCUNHO: "Rascunho",
      ENVIADA: "Enviada",
      NEGOCIACAO: "Negociação",
      GANHA: "Ganha",
      PERDIDA: "Perdida",
      CANCELADA: "Cancelada",
    };

    return mapa[status] || status || "-";
  }

  function limparFormularioProposta() {
    setPropostaEditandoId("");

    setPropostaForm({
      servico: "",
      descricao: "",
      tipoReceita: "PONTUAL",
      valorTotal: "",
      mensalidade: "",
      taxaImplantacao: "",
      status: "RASCUNHO",
      validade: "",
      motivoPerda: "",
      observacoes: "",
    });
  }

  function editarCampoProposta(campo, valor) {
    setPropostaForm(
      (atual) => ({
        ...atual,
        [campo]: valor,
      })
    );
  }

  async function carregarPropostas(atendimentoId) {
    if (!atendimentoId) {
      setPropostasAtendimento([]);
      return;
    }

    setCarregandoPropostas(true);

    try {
      const resposta = await fetch(
        `/api/crm?action=listar-propostas&atendimentoId=${encodeURIComponent(
          atendimentoId
        )}`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data = await resposta
        .json()
        .catch(() => null);

      if (!resposta.ok || !data?.sucesso) {
        throw new Error(
          data?.error ||
          "Não foi possível carregar as propostas."
        );
      }

      setPropostasAtendimento(
        Array.isArray(data.propostas)
          ? data.propostas
          : []
      );
    } catch (error) {
      setErro(
        error?.message ||
        "Erro ao carregar propostas."
      );
    } finally {
      setCarregandoPropostas(false);
    }
  }

  async function salvarPropostaCaso() {
    if (!atendimentoAberto) return;

    if (!propostaForm.servico.trim()) {
      setErro(
        "Informe o serviço da proposta."
      );
      return;
    }

    if (
      propostaForm.status ===
        "PERDIDA" &&
      !propostaForm.motivoPerda.trim()
    ) {
      setErro(
        "Informe o motivo da perda."
      );
      return;
    }

    setSalvandoProposta(true);
    setErro("");

    try {
      const resposta = await fetch(
        "/api/crm?action=salvar-proposta",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
            Authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify({
            propostaId:
              propostaEditandoId ||
              undefined,
            atendimentoId:
              atendimentoAberto.id,
            servico:
              propostaForm.servico.trim(),
            descricao:
              propostaForm.descricao.trim(),
            tipoReceita:
              propostaForm.tipoReceita,
            valorTotal:
              propostaForm.valorTotal,
            mensalidade:
              propostaForm.mensalidade,
            taxaImplantacao:
              propostaForm.taxaImplantacao,
            status:
              propostaForm.status,
            validade:
              propostaForm.validade ||
              null,
            motivoPerda:
              propostaForm.motivoPerda.trim(),
            observacoes:
              propostaForm.observacoes.trim(),
            responsavelId:
              atendimentoAberto.responsavelId ||
              "",
            responsavelNome:
              atendimentoAberto.responsavelNome ||
              "",
          }),
        }
      );

      const data = await resposta
        .json()
        .catch(() => null);

      if (!resposta.ok || !data?.sucesso) {
        throw new Error(
          data?.error ||
          "Não foi possível salvar a proposta."
        );
      }

      limparFormularioProposta();

      await Promise.all([
        carregarPropostas(
          atendimentoAberto.id
        ),
        carregarHistorico(
          atendimentoAberto.id
        ),
        carregarTudo(),
      ]);

      if (data.statusOportunidade) {
        setOportunidadeCaso(
          data.statusOportunidade
        );

        setAtendimentoAberto(
          (atual) => ({
            ...atual,
            statusOportunidade:
              data.statusOportunidade,
          })
        );
      }
    } catch (error) {
      setErro(
        error?.message ||
        "Erro ao salvar proposta."
      );
    } finally {
      setSalvandoProposta(false);
    }
  }

  function carregarPropostaNoFormulario(proposta) {
    setPropostaEditandoId(
      proposta.id
    );

    setPropostaForm({
      servico:
        proposta.servico ||
        "",
      descricao:
        proposta.descricao ||
        "",
      tipoReceita:
        proposta.tipoReceita ||
        "PONTUAL",
      valorTotal:
        String(
          proposta.valorTotal ??
          ""
        ),
      mensalidade:
        String(
          proposta.mensalidade ??
          ""
        ),
      taxaImplantacao:
        String(
          proposta.taxaImplantacao ??
          ""
        ),
      status:
        proposta.status ||
        "RASCUNHO",
      validade:
        proposta.validade
          ? String(
              proposta.validade
            ).slice(0, 10)
          : "",
      motivoPerda:
        proposta.motivoPerda ||
        "",
      observacoes:
        proposta.observacoes ||
        "",
    });
  }

  async function excluirPropostaCaso(proposta) {
    if (
      !window.confirm(
        `Excluir a proposta "${proposta.servico}"?`
      )
    ) {
      return;
    }

    try {
      const resposta = await fetch(
        "/api/crm?action=excluir-proposta",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
            Authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify({
            propostaId:
              proposta.id,
          }),
        }
      );

      const data = await resposta
        .json()
        .catch(() => null);

      if (!resposta.ok || !data?.sucesso) {
        throw new Error(
          data?.error ||
          "Não foi possível excluir a proposta."
        );
      }

      await carregarPropostas(
        atendimentoAberto.id
      );

      if (
        propostaEditandoId ===
        proposta.id
      ) {
        limparFormularioProposta();
      }
    } catch (error) {
      setErro(
        error?.message ||
        "Erro ao excluir proposta."
      );
    }
  }

  function rotuloTipoAcionamento(tipo) {
    const mapa = {
      WHATSAPP: "WhatsApp",
      LIGACAO: "Ligação",
      EMAIL: "E-mail",
      REUNIAO: "Reunião",
      VIDEOCONFERENCIA: "Videoconferência",
      PROPOSTA: "Proposta",
      ANALISE_INTERNA: "Análise interna",
      DOCUMENTOS: "Documentos",
      OUTRO: "Outro",
      ALTERACAO: "Alteração",
    };

    return mapa[tipo] || tipo || "Registro";
  }

  function formatarDataHora(valor) {
    if (!valor) return "-";

    try {
      return new Date(valor).toLocaleString(
        "pt-BR",
        {
          dateStyle: "short",
          timeStyle: "short",
        }
      );
    } catch {
      return String(valor);
    }
  }

  async function carregarHistorico(
    atendimentoId
  ) {
    const resposta =
      await fetch(
        `/api/crm?action=listar-historico&atendimentoId=${encodeURIComponent(
          atendimentoId
        )}`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

    const data =
      await resposta
        .json()
        .catch(() => null);

    if (
      !resposta.ok ||
      !data?.sucesso
    ) {
      throw new Error(
        data?.error ||
        "Não foi possível carregar o histórico."
      );
    }

    setHistoricoAtendimento(
      Array.isArray(
        data.historico
      )
        ? data.historico
        : []
    );
  }

  async function abrirAtendimento(
    atendimento
  ) {
    setAtendimentoAberto(
      atendimento
    );

    setStatusCaso(
      atendimento.statusAtendimento ||
      "NAO_INICIADO"
    );

    setOportunidadeCaso(
      atendimento.statusOportunidade ||
      "NAO_ANALISADA"
    );

    setProximaAcaoCaso(
      atendimento.proximaAcao ||
      ""
    );

    setProximoContatoCaso(
      atendimento.proximoContato
        ? new Date(
            atendimento.proximoContato
          )
            .toISOString()
            .slice(0, 16)
        : ""
    );

    setCarregandoCaso(true);
    setErro("");

    try {
      const requisicoes = [
        carregarHistorico(
          atendimento.id
        ),
        carregarPropostas(
          atendimento.id
        ),
      ];

      if (
        atendimento.diagnosticoId
      ) {
        requisicoes.push(
          fetch(
            `/api/diagnosticos?action=ver&id=${encodeURIComponent(
              atendimento.diagnosticoId
            )}`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          )
            .then(
              async (resp) => {
                const data =
                  await resp
                    .json()
                    .catch(
                      () => null
                    );

                if (
                  !resp.ok ||
                  !data?.sucesso
                ) {
                  throw new Error(
                    data?.error ||
                    "Não foi possível carregar o diagnóstico do departamento."
                  );
                }

                setDiagnosticoAtendimento(
                  data.diagnostico ||
                  null
                );
              }
            )
        );
      } else {
        setDiagnosticoAtendimento(
          null
        );
      }

      await Promise.all(
        requisicoes
      );
    } catch (error) {
      setErro(
        error?.message ||
        "Erro ao abrir atendimento."
      );
    } finally {
      setCarregandoCaso(false);
    }
  }

  async function registrarAcionamentoCaso() {
    if (!atendimentoAberto) {
      return;
    }

    if (
      !descricaoAcionamento.trim() &&
      !resultadoAcionamento.trim()
    ) {
      setErro(
        "Informe o resultado ou uma observação do acionamento."
      );
      return;
    }

    setSalvandoAcionamento(true);
    setErro("");

    try {
      const resposta =
        await fetch(
          "/api/crm?action=registrar-acionamento",
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
            body: JSON.stringify({
              atendimentoId:
                atendimentoAberto.id,

              tipoAcionamento,

              resultado:
                resultadoAcionamento.trim(),

              descricao:
                descricaoAcionamento.trim(),

              proximaAcao:
                proximaAcaoCaso.trim(),

              proximoContato:
                proximoContatoCaso
                  ? new Date(
                      proximoContatoCaso
                    ).toISOString()
                  : null,

              statusAtendimento:
                statusCaso,

              statusOportunidade:
                oportunidadeCaso,

              responsavelId:
                atendimentoAberto.responsavelId ||
                "",

              responsavelNome:
                atendimentoAberto.responsavelNome ||
                "",
            }),
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => null);

      if (
        !resposta.ok ||
        !data?.sucesso
      ) {
        throw new Error(
          data?.error ||
          "Não foi possível registrar o acionamento."
        );
      }

      setResultadoAcionamento("");
      setDescricaoAcionamento("");

      await Promise.all([
        carregarHistorico(
          atendimentoAberto.id
        ),
        carregarTudo(),
      ]);

      setAtendimentoAberto(
        (atual) => ({
          ...atual,
          statusAtendimento:
            statusCaso,
          statusOportunidade:
            oportunidadeCaso,
          proximaAcao:
            proximaAcaoCaso,
          proximoContato:
            proximoContatoCaso ||
            null,
          ultimoAcionamento:
            new Date().toISOString(),
        })
      );
    } catch (error) {
      setErro(
        error?.message ||
        "Erro ao registrar acionamento."
      );
    } finally {
      setSalvandoAcionamento(false);
    }
  }

  function eixoDoAtendimento() {
    if (
      !atendimentoAberto ||
      !diagnosticoAtendimento
    ) {
      return null;
    }

    const resultado =
      diagnosticoAtendimento.resultado ||
      {};

    const completo =
      resultado.resultadoCompleto ||
      {};

    const eixos =
      Array.isArray(
        completo.eixos
      )
        ? completo.eixos
        : [];

    const alvo =
      areaCanonica(
        atendimentoAberto.area
      );

    return (
      eixos.find(
        (eixo) =>
          areaCanonica(
            eixo.label ||
            eixo.id
          ) === alvo
      ) ||
      null
    );
  }

  function perguntasDoAtendimento() {
    if (
      !atendimentoAberto ||
      !diagnosticoAtendimento
    ) {
      return [];
    }

    const perguntas =
      normalizarLista(
        diagnosticoAtendimento
          .perguntasRespostas
      );

    const alvo =
      areaCanonica(
        atendimentoAberto.area
      );

    return perguntas.filter(
      (item) =>
        areaCanonica(
          item.area ||
          item.areaId
        ) === alvo
    );
  }


  async function alternarArquivoAtendimento(
    atendimento
  ) {
    try {
      const resposta =
        await fetch(
          "/api/crm?action=arquivar-atendimento",
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
            body: JSON.stringify({
              atendimentoId:
                atendimento.id,
              arquivado:
                !atendimento.arquivado,
            }),
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => null);

      if (
        !resposta.ok ||
        !data?.sucesso
      ) {
        throw new Error(
          data?.error ||
          "Não foi possível arquivar o atendimento."
        );
      }

      await carregarTudo();
    } catch (error) {
      setErro(
        error?.message ||
        "Erro ao arquivar atendimento."
      );
    }
  }

  async function excluirLeadAtendimento(atendimento) {
    const lead = leadDoAtendimento(atendimento);
    const leadIdExcluir =
      lead?.leadId ||
      atendimento?.leadId ||
      "";

    const diagnosticoIdExcluir =
      lead?.diagnosticoId ||
      atendimento?.diagnosticoId ||
      "";

    if (
      !leadIdExcluir &&
      !diagnosticoIdExcluir
    ) {
      setErro(
        "Não foi possível identificar o registro deste atendimento."
      );
      return;
    }

    const nomeLead =
      lead.razaoSocial ||
      lead.nome ||
      "este registro";

    if (!window.confirm(
      `Excluir ${nomeLead} e os atendimentos vinculados? Esta ação não pode ser desfeita.`
    )) {
      return;
    }

    try {
      const resposta = await fetch("/api/crm?action=excluir-lead", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          atendimentoId:
            atendimento?.id ||
            undefined,
          leadId:
            leadIdExcluir ||
            undefined,
          diagnosticoId:
            diagnosticoIdExcluir ||
            undefined,
        }),
      });

      const data = await resposta.json().catch(() => null);

      if (!resposta.ok || !data?.sucesso) {
        throw new Error(data?.error || "Não foi possível excluir o lead.");
      }

      setAtendimentoAberto(null);
      await carregarTudo();
    } catch (error) {
      setErro(error?.message || "Erro ao excluir lead.");
    }
  }

  async function carregarTudo() {
    setCarregando(true);
    setErro("");

    try {
      const [
        respAtendimentos,
        respResponsaveis,
        respLeads,
      ] =
        await Promise.all([
          fetch(
            "/api/crm?action=listar-atendimentos",
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          ),

          fetch(
            "/api/crm?action=listar-responsaveis",
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          ),

          fetch(
            "/api/crm?action=listar-leads&limite=300",
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          ),
        ]);

      const [
        dataAtendimentos,
        dataResponsaveis,
        dataLeads,
      ] =
        await Promise.all([
          respAtendimentos
            .json()
            .catch(() => null),

          respResponsaveis
            .json()
            .catch(() => null),

          respLeads
            .json()
            .catch(() => null),
        ]);

      if (
        !respAtendimentos.ok ||
        !dataAtendimentos?.sucesso
      ) {
        throw new Error(
          dataAtendimentos?.error ||
          "Não foi possível carregar os atendimentos."
        );
      }

      if (
        !respResponsaveis.ok ||
        !dataResponsaveis?.sucesso
      ) {
        throw new Error(
          dataResponsaveis?.error ||
          "Não foi possível carregar os responsáveis."
        );
      }

      setAtendimentos(
        Array.isArray(
          dataAtendimentos.atendimentos
        )
          ? dataAtendimentos.atendimentos
          : []
      );

      setResponsaveis(
        Array.isArray(
          dataResponsaveis.responsaveis
        )
          ? dataResponsaveis.responsaveis
          : []
      );

      setLeads(
        Array.isArray(
          dataLeads?.leads
        )
          ? dataLeads.leads
          : []
      );
    } catch (error) {
      setErro(
        error?.message ||
        "Erro ao carregar atendimentos."
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarTudo();
  }, []);

  const mapaLeads = useMemo(() => {
    const mapa = {};

    leads.forEach(
      (lead) => {
        if (
          lead.diagnosticoId
        ) {
          mapa[
            String(
              lead.diagnosticoId
            )
          ] = lead;
        }

        if (lead.leadId) {
          mapa[
            String(
              lead.leadId
            )
          ] = lead;
        }
      }
    );

    return mapa;
  }, [leads]);

  function leadDoAtendimento(
    atendimento
  ) {
    if (
      atendimento?.lead &&
      (
        atendimento.lead.razaoSocial ||
        atendimento.lead.nome ||
        atendimento.lead.cnpj ||
        atendimento.lead.telefone
      )
    ) {
      return atendimento.lead;
    }

    return (
      mapaLeads[
        String(
          atendimento?.diagnosticoId ||
          ""
        )
      ] ||
      mapaLeads[
        String(
          atendimento?.leadId ||
          ""
        )
      ] ||
      {}
    );
  }

  function rotuloEstruturaAtendimento(
    valor
  ) {
    const mapa = {
      operacional:
        "Empresa operacional",
      holding:
        "Holding",
      grupo:
        "Grupo empresarial",
      spe:
        "SPE",
      avaliar_holding:
        "Avaliar Holding",
      pessoa_fisica:
        "Pessoa Física",
    };

    return (
      mapa[
        String(
          valor ||
          ""
        ).toLowerCase()
      ] ||
      valor ||
      "-"
    );
  }

  function statusDiagnosticoLabelLocal(
    status
  ) {
    const mapa = {
      ACESSOU: "Acessou",
      EM_PREENCHIMENTO:
        "Em preenchimento",
      NAO_CONCLUIDO:
        "Não concluído",
      CONCLUIDO:
        "Concluído",
    };

    return (
      mapa[status] ||
      status ||
      "-"
    );
  }

  function nomeClienteAtendimento(
    atendimento
  ) {
    const lead =
      leadDoAtendimento(
        atendimento
      );

    const estrutura =
      normalizarFiltro(
        lead.estruturaNegocio
      );

    if (
      estrutura ===
        "pessoa_fisica" ||
      estrutura ===
        "avaliar_holding"
    ) {
      return (
        lead.nome ||
        lead.razaoSocial ||
        "Cliente sem identificação"
      );
    }

    return (
      lead.razaoSocial ||
      lead.nome ||
      "Cliente sem identificação"
    );
  }

  function normalizarFiltro(
    valor
  ) {
    return String(
      valor ||
      ""
    )
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .trim()
      .toLowerCase();
  }

  const areasDisponiveis =
    useMemo(
      () =>
        [
          ...new Set(
            atendimentos
              .map(
                (item) =>
                  item.area
              )
              .filter(Boolean)
          ),
        ].sort(),
      [atendimentos]
    );

  function statusAtendimentoLabel(
    status
  ) {
    const mapa = {
      NAO_INICIADO:
        "Novo",

      EM_ANALISE:
        "Avaliando",

      REUNIAO_AGENDADA:
        "Reunião agendada",

      EM_ATENDIMENTO:
        "Em tratativa",

      PLANO_APRESENTADO:
        "Proposta / plano apresentado",

      CONCLUIDO:
        "Concluído",
    };

    return (
      mapa[status] ||
      status ||
      "-"
    );
  }

  const etapasAtendimento = [
    {
      id: "NAO_INICIADO",
      label: "Novo",
    },
    {
      id: "EM_ANALISE",
      label: "Avaliando",
    },
    {
      id: "REUNIAO_AGENDADA",
      label: "Reunião",
    },
    {
      id: "EM_ATENDIMENTO",
      label: "Tratativa",
    },
    {
      id: "PLANO_APRESENTADO",
      label: "Proposta",
    },
    {
      id: "CONCLUIDO",
      label: "Concluído",
    },
  ];

  function indiceEtapaAtendimento(
    status
  ) {
    const indice =
      etapasAtendimento.findIndex(
        (item) =>
          item.id === status
      );

    return indice >= 0
      ? indice
      : 0;
  }

  function sugestaoProximaAcao(
    atendimento
  ) {
    if (
      atendimento?.proximaAcao
    ) {
      return atendimento.proximaAcao;
    }

    const mapa = {
      NAO_INICIADO:
        "Abrir o diagnóstico da área e iniciar a avaliação.",
      EM_ANALISE:
        "Validar os achados e realizar o primeiro contato com o cliente.",
      REUNIAO_AGENDADA:
        "Preparar a reunião usando as respostas e riscos do diagnóstico.",
      EM_ATENDIMENTO:
        "Registrar o resultado da tratativa e definir o próximo passo.",
      PLANO_APRESENTADO:
        "Realizar follow-up da proposta ou plano apresentado.",
      CONCLUIDO:
        "Atendimento concluído. Verifique se o histórico está completo.",
    };

    return (
      mapa[
        atendimento?.statusAtendimento
      ] ||
      "Defina a próxima ação."
    );
  }

  function statusAtendimentoCor(
    status
  ) {
    if (
      status === "CONCLUIDO"
    ) {
      return {
        bg: "#E1F5EE",
        color: "#0F6E56",
      };
    }

    if (
      status === "EM_ATENDIMENTO" ||
      status === "EM_ANALISE"
    ) {
      return {
        bg: "#FAEEDA",
        color: "#854F0B",
      };
    }

    if (
      status === "REUNIAO_AGENDADA" ||
      status === "PLANO_APRESENTADO"
    ) {
      return {
        bg: "#EEF3FF",
        color: "#31589C",
      };
    }

    return {
      bg: "#EEF0F5",
      color: MUTED,
    };
  }

  function statusOportunidadeLabel(status) {
    const mapa = {
      NAO_ANALISADA: "Não analisada",
      EM_ANALISE: "Em análise",
      OPORTUNIDADE_IDENTIFICADA: "Oportunidade identificada",
      PROPOSTA: "Proposta",
      CONTRATADO: "Contratado",
      SEM_OPORTUNIDADE: "Sem oportunidade",
    };
    return mapa[status] || status || "Não analisada";
  }

  function statusOportunidadeCor(status) {
    if (status === "CONTRATADO") return { bg: "#E1F5EE", color: "#0F6E56" };
    if (status === "OPORTUNIDADE_IDENTIFICADA" || status === "PROPOSTA") return { bg: "#FFF3EF", color: "#993C1D" };
    if (status === "EM_ANALISE") return { bg: "#FAEEDA", color: "#854F0B" };
    return { bg: "#EEF0F5", color: MUTED };
  }

  function editar(
    id,
    campo,
    valor
  ) {
    setEdicoes(
      (atuais) => ({
        ...atuais,

        [id]: {
          ...(atuais[id] || {}),
          [campo]: valor,
        },
      })
    );
  }

  async function salvarAtendimento(
    atendimento
  ) {
    setSalvandoId(
      atendimento.id
    );

    setErro("");

    try {
      const alteracoes =
        edicoes[
          atendimento.id
        ] ||
        {};

      const resposta =
        await fetch(
          "/api/crm?action=atualizar-atendimento",
          {
            method: "POST",

            headers: {
              "content-type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body: JSON.stringify({
              atendimentoId:
                atendimento.id,

              responsavelId:
                alteracoes.responsavelId ??
                atendimento.responsavelId ??
                "",

              statusAtendimento:
                alteracoes.statusAtendimento ??
                atendimento.statusAtendimento,

              statusOportunidade:
                alteracoes.statusOportunidade ??
                atendimento.statusOportunidade ??
                "NAO_ANALISADA",

              observacoesEspecialista:
                alteracoes.observacoesEspecialista ??
                atendimento.observacoesEspecialista ??
                "",
            }),
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => null);

      if (
        !resposta.ok ||
        !data?.sucesso
      ) {
        throw new Error(
          data?.error ||
          "Não foi possível atualizar o atendimento."
        );
      }

      setEdicoes(
        (atuais) => {
          const copia = {
            ...atuais,
          };

          delete copia[
            atendimento.id
          ];

          return copia;
        }
      );

      await carregarTudo();
    } catch (error) {
      setErro(
        error?.message ||
        "Erro ao atualizar atendimento."
      );
    } finally {
      setSalvandoId("");
    }
  }

  const filtrados =
    atendimentos.filter(
      (atendimento) => {
        const lead =
          leadDoAtendimento(
            atendimento
          );

        const termo =
          normalizarFiltro(
            busca
          );

        const bateBusca =
          !termo ||
          [
            atendimento.area,
            atendimento.nivelArea,
            atendimento.responsavelNome,
            atendimento.diagnosticoId,
            atendimento.leadId,
            lead.razaoSocial,
            lead.nome,
            lead.email,
            lead.cnpj,
            lead.telefone,
            lead.estruturaNegocio,
          ]
            .filter(Boolean)
            .some(
              (valor) =>
                normalizarFiltro(
                  valor
                ).includes(
                  termo
                )
            );

        const bateArea =
          !areaFiltro ||
          normalizarFiltro(
            atendimento.area
          ) ===
            normalizarFiltro(
              areaFiltro
            );

        const bateStatus =
          !statusFiltro ||
          atendimento.statusAtendimento ===
            statusFiltro;

        const bateResponsavel =
          !responsavelFiltro ||
          atendimento.responsavelId ===
            responsavelFiltro;

        const bateOportunidade =
          !oportunidadeFiltro ||
          (atendimento.statusOportunidade || "NAO_ANALISADA") ===
            oportunidadeFiltro;

        const bateStatusDiagnostico =
          !statusDiagnosticoFiltro ||
          normalizarFiltro(lead.statusDiagnostico) ===
            normalizarFiltro(statusDiagnosticoFiltro);

        const bateOrigem =
          !origemFiltro ||
          normalizarFiltro(lead.origem) ===
            normalizarFiltro(origemFiltro);

        const bateEstrutura =
          !estruturaFiltro ||
          normalizarFiltro(lead.estruturaNegocio) ===
            normalizarFiltro(estruturaFiltro);

        return (
          bateBusca &&
          bateArea &&
          bateStatus &&
          bateResponsavel &&
          bateOportunidade &&
          bateStatusDiagnostico &&
          bateOrigem &&
          bateEstrutura
        );
      }
    );

  const agoraAtendimentos =
    new Date();

  const resumo = {
    total:
      atendimentos.length,

    naoIniciado:
      atendimentos.filter(
        (item) =>
          item.statusAtendimento ===
          "NAO_INICIADO"
      ).length,

    emAndamento:
      atendimentos.filter(
        (item) =>
          [
            "EM_ANALISE",
            "REUNIAO_AGENDADA",
            "EM_ATENDIMENTO",
            "PLANO_APRESENTADO",
          ].includes(
            item.statusAtendimento
          )
      ).length,

    concluidos:
      atendimentos.filter(
        (item) =>
          item.statusAtendimento ===
          "CONCLUIDO"
      ).length,

    atrasados:
      atendimentos.filter(
        (item) => {
          if (
            !item.proximoContato ||
            item.statusAtendimento ===
              "CONCLUIDO"
          ) {
            return false;
          }

          const data =
            new Date(
              item.proximoContato
            );

          return (
            Number.isFinite(
              data.getTime()
            ) &&
            data <
              agoraAtendimentos
          );
        }
      ).length,
  };

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(180px,1fr))",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <Card>
          <Target
            size={18}
            color={CORAL}
          />

          <div
            style={{
              color: MUTED,
              fontSize: 10,
              marginTop: 8,
            }}
          >
            ATENDIMENTOS
          </div>

          <div
            style={{
              fontSize: 29,
              fontWeight: 900,
            }}
          >
            {resumo.total}
          </div>
        </Card>

        <Card>
          <Clock3
            size={18}
            color={MUTED}
          />

          <div
            style={{
              color: MUTED,
              fontSize: 10,
              marginTop: 8,
            }}
          >
            NÃO INICIADOS
          </div>

          <div
            style={{
              fontSize: 29,
              fontWeight: 900,
            }}
          >
            {resumo.naoIniciado}
          </div>
        </Card>

        <Card>
          <Activity
            size={18}
            color="#854F0B"
          />

          <div
            style={{
              color: MUTED,
              fontSize: 10,
              marginTop: 8,
            }}
          >
            EM ANDAMENTO
          </div>

          <div
            style={{
              fontSize: 29,
              fontWeight: 900,
            }}
          >
            {resumo.emAndamento}
          </div>
        </Card>

        <Card>
          <CheckCircle2
            size={18}
            color="#0F6E56"
          />

          <div
            style={{
              color: MUTED,
              fontSize: 10,
              marginTop: 8,
            }}
          >
            CONCLUÍDOS
          </div>

          <div
            style={{
              fontSize: 29,
              fontWeight: 900,
            }}
          >
            {resumo.concluidos}
          </div>
        </Card>

        <Card
          style={{
            background:
              resumo.atrasados > 0
                ? "#FCEBEB"
                : WHITE,
            borderColor:
              resumo.atrasados > 0
                ? "#F0C5C5"
                : "#E3E7EF",
          }}
        >
          <AlertTriangle
            size={18}
            color={
              resumo.atrasados > 0
                ? "#791F1F"
                : MUTED
            }
          />

          <div
            style={{
              color:
                resumo.atrasados > 0
                  ? "#791F1F"
                  : MUTED,
              fontSize: 10,
              marginTop: 8,
            }}
          >
            RETORNOS ATRASADOS
          </div>

          <div
            style={{
              fontSize: 29,
              fontWeight: 900,
              color:
                resumo.atrasados > 0
                  ? "#791F1F"
                  : NAVY,
            }}
          >
            {resumo.atrasados}
          </div>
        </Card>
      </div>

      <Card
        style={{
          marginBottom: 14,
          background: "#17233D",
          color: WHITE,
          borderColor: "#17233D",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(220px,1fr) repeat(3,minmax(150px,.7fr))",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                color: "#FFB7A7",
                fontWeight: 900,
                marginBottom: 4,
              }}
            >
              COMO USAR ATENDIMENTOS
            </div>

            <strong
              style={{
                fontSize: 16,
              }}
            >
              Esta é sua fila de trabalho.
            </strong>

            <div
              style={{
                marginTop: 4,
                color: "#D8DEEA",
                fontSize: 10.5,
                lineHeight: 1.45,
              }}
            >
              Abra um caso, consulte apenas o diagnóstico do departamento,
              registre o contato e deixe sempre uma próxima ação.
            </div>
          </div>

          {[
            ["1", "Abrir atendimento"],
            ["2", "Registrar o que aconteceu"],
            ["3", "Definir próxima ação e data"],
          ].map(
            ([numero, titulo]) => (
              <div
                key={numero}
                style={{
                  border:
                    "1px solid rgba(255,255,255,.18)",
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                <div
                  style={{
                    color: CORAL,
                    fontSize: 17,
                    fontWeight: 900,
                  }}
                >
                  {numero}
                </div>

                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    marginTop: 2,
                  }}
                >
                  {titulo}
                </div>
              </div>
            )
          )}
        </div>
      </Card>

      <Card
        style={{
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <input
            value={busca}
            onChange={(e) =>
              setBusca(
                e.target.value
              )
            }
            placeholder="Buscar empresa, especialista, área, diagnóstico..."
            style={{
              flex: "1 1 300px",
              border:
                "1px solid #D8DEEA",
              borderRadius: 9,
              padding:
                "10px 12px",
              fontFamily:
                BODY_FONT,
            }}
          />

          <select
            value={areaFiltro}
            onChange={(e) =>
              setAreaFiltro(
                e.target.value
              )
            }
            style={{
              border:
                "1px solid #D8DEEA",
              borderRadius: 9,
              padding:
                "10px 12px",
              background: WHITE,
            }}
          >
            <option value="">
              Todas as áreas
            </option>

            {areasDisponiveis.map(
              (area) => (
                <option
                  key={area}
                  value={area}
                >
                  {area}
                </option>
              )
            )}
          </select>

          <select
            value={statusFiltro}
            onChange={(e) =>
              setStatusFiltro(
                e.target.value
              )
            }
            style={{
              border:
                "1px solid #D8DEEA",
              borderRadius: 9,
              padding:
                "10px 12px",
              background: WHITE,
            }}
          >
            <option value="">
              Todos os status
            </option>

            <option value="NAO_INICIADO">
              Não iniciado
            </option>

            <option value="EM_ANALISE">
              Em análise
            </option>

            <option value="REUNIAO_AGENDADA">
              Reunião agendada
            </option>

            <option value="EM_ATENDIMENTO">
              Em atendimento
            </option>

            <option value="PLANO_APRESENTADO">
              Plano apresentado
            </option>

            <option value="CONCLUIDO">
              Concluído
            </option>
          </select>

          <select
            value={oportunidadeFiltro}
            onChange={(e) =>
              setOportunidadeFiltro(
                e.target.value
              )
            }
            style={{
              border: "1px solid #D8DEEA",
              borderRadius: 9,
              padding: "10px 12px",
              background: WHITE,
            }}
          >
            <option value="">Todas as oportunidades</option>
            <option value="NAO_ANALISADA">Não analisada</option>
            <option value="EM_ANALISE">Em análise</option>
            <option value="OPORTUNIDADE_IDENTIFICADA">Oportunidade identificada</option>
            <option value="PROPOSTA">Proposta</option>
            <option value="CONTRATADO">Contratado</option>
            <option value="SEM_OPORTUNIDADE">Sem oportunidade</option>
          </select>

          <select
            value={responsavelFiltro}
            onChange={(e) =>
              setResponsavelFiltro(
                e.target.value
              )
            }
            style={{
              border:
                "1px solid #D8DEEA",
              borderRadius: 9,
              padding:
                "10px 12px",
              background: WHITE,
            }}
          >
            <option value="">
              Todos os especialistas
            </option>

            {responsaveis.map(
              (responsavel) => (
                <option
                  key={
                    responsavel.id
                  }
                  value={
                    responsavel.id
                  }
                >
                  {responsavel.nome}
                </option>
              )
            )}
          </select>


          <select
            value={statusDiagnosticoFiltro}
            onChange={(e) => setStatusDiagnosticoFiltro(e.target.value)}
            style={{
              border: "1px solid #D8DEEA",
              borderRadius: 9,
              padding: "10px 12px",
              background: WHITE,
            }}
          >
            <option value="">Todos os diagnósticos</option>
            <option value="ACESSOU">Acessou</option>
            <option value="EM_PREENCHIMENTO">Em preenchimento</option>
            <option value="NAO_CONCLUIDO">Não concluído</option>
            <option value="CONCLUIDO">Concluído</option>
          </select>

          <select
            value={origemFiltro}
            onChange={(e) => setOrigemFiltro(e.target.value)}
            style={{
              border: "1px solid #D8DEEA",
              borderRadius: 9,
              padding: "10px 12px",
              background: WHITE,
            }}
          >
            <option value="">Todas as origens</option>
            {[...new Set(
              atendimentos
                .map((item) => leadDoAtendimento(item).origem)
                .filter(Boolean)
            )].map((origem) => (
              <option key={origem} value={origem}>
                {origem}
              </option>
            ))}
          </select>

          <select
            value={estruturaFiltro}
            onChange={(e) => setEstruturaFiltro(e.target.value)}
            style={{
              border: "1px solid #D8DEEA",
              borderRadius: 9,
              padding: "10px 12px",
              background: WHITE,
            }}
          >
            <option value="">Todas as estruturas</option>
            <option value="operacional">Empresa operacional</option>
            <option value="holding">Holding</option>
            <option value="grupo">Grupo empresarial</option>
            <option value="spe">SPE</option>
            <option value="avaliar_holding">Avaliar Holding</option>
            <option value="pessoa_fisica">Pessoa Física</option>
          </select>

          <Botao
            secundario
            onClick={() => {
              setBusca("");
              setAreaFiltro("");
              setStatusFiltro("");
              setOportunidadeFiltro("");
              setResponsavelFiltro("");
              setStatusDiagnosticoFiltro("");
              setOrigemFiltro("");
              setEstruturaFiltro("");
            }}
          >
            <X size={14} />
            Limpar
          </Botao>

          <Botao
            secundario
            onClick={
              carregarTudo
            }
          >
            <RefreshCcw
              size={14}
            />

            Atualizar
          </Botao>
        </div>
      </Card>

      <div
        style={{
          margin:
            "-6px 0 12px",
          color: MUTED,
          fontSize: 10.5,
        }}
      >
        Exibindo{" "}
        <strong>
          {filtrados.length}
        </strong>{" "}
        de{" "}
        <strong>
          {atendimentos.length}
        </strong>{" "}
        atendimentos
      </div>

      {atendimentoAberto && (
        <div
          style={{
            marginBottom: 20,
            border:
              "2px solid #17233D",
            borderRadius: 14,
            background: WHITE,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              background: NAVY,
              color: WHITE,
              padding: "14px 16px",
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 9.5,
                  opacity: 0.75,
                  fontWeight: 800,
                  marginBottom: 3,
                }}
              >
                ATENDIMENTO · {atendimentoAberto.area}
              </div>

              <strong
                style={{
                  fontSize: 17,
                }}
              >
                {nomeClienteAtendimento(
                  atendimentoAberto
                )}
              </strong>
            </div>

            <button
              type="button"
              onClick={() => {
                setAtendimentoAberto(
                  null
                );
                setDiagnosticoAtendimento(
                  null
                );
                setHistoricoAtendimento(
                  []
                );
                setPropostasAtendimento(
                  []
                );
                limparFormularioProposta();
              }}
              style={{
                border:
                  "1px solid rgba(255,255,255,.45)",
                background:
                  "transparent",
                color: WHITE,
                borderRadius: 8,
                padding: "6px 10px",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              Fechar
            </button>
          </div>

          {carregandoCaso ? (
            <div
              style={{
                padding: 18,
              }}
            >
              Carregando atendimento...
            </div>
          ) : (
            <div
              style={{
                padding: 16,
              }}
            >
              <Card
                style={{
                  marginBottom: 12,
                  background: "#F7F8FB",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "center",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <strong
                    style={{
                      fontSize: 11.5,
                    }}
                  >
                    Etapa do atendimento
                  </strong>

                  <span
                    style={{
                      fontSize: 9.5,
                      color: MUTED,
                    }}
                  >
                    {statusAtendimentoLabel(
                      atendimentoAberto.statusAtendimento
                    )}
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      `repeat(${etapasAtendimento.length},1fr)`,
                    gap: 5,
                  }}
                >
                  {etapasAtendimento.map(
                    (etapa, index) => {
                      const atual =
                        indiceEtapaAtendimento(
                          atendimentoAberto.statusAtendimento
                        );

                      const concluida =
                        index <= atual;

                      return (
                        <div
                          key={etapa.id}
                          style={{
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              height: 6,
                              borderRadius: 20,
                              background:
                                concluida
                                  ? CORAL
                                  : "#D8DEEA",
                              marginBottom: 5,
                            }}
                          />

                          <div
                            style={{
                              fontSize: 8.5,
                              color:
                                concluida
                                  ? NAVY
                                  : MUTED,
                              fontWeight:
                                concluida
                                  ? 800
                                  : 500,
                              lineHeight: 1.2,
                            }}
                          >
                            {etapa.label}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </Card>

              <div
                style={{
                  background: "#FFF3EF",
                  borderLeft:
                    `4px solid ${CORAL}`,
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 9.5,
                    fontWeight: 900,
                    color: "#993C1D",
                    marginBottom: 4,
                  }}
                >
                  O QUE FAZER AGORA
                </div>

                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    lineHeight: 1.5,
                  }}
                >
                  {sugestaoProximaAcao(
                    atendimentoAberto
                  )}
                </div>

                {atendimentoAberto.proximoContato && (
                  <div
                    style={{
                      marginTop: 5,
                      fontSize: 10.5,
                      color: MUTED,
                    }}
                  >
                    Prazo registrado:{" "}
                    <strong>
                      {formatarDataHora(
                        atendimentoAberto.proximoContato
                      )}
                    </strong>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(150px,1fr))",
                  gap: 9,
                  marginBottom: 16,
                }}
              >
                {[
                  [
                    "Responsável",
                    atendimentoAberto.responsavelNome ||
                      "Não atribuído",
                  ],
                  [
                    "Departamento",
                    atendimentoAberto.area,
                  ],
                  [
                    "Score",
                    atendimentoAberto.scoreArea ??
                      "-",
                  ],
                  [
                    "Status",
                    statusAtendimentoLabel(
                      atendimentoAberto.statusAtendimento
                    ),
                  ],
                  [
                    "Oportunidade",
                    statusOportunidadeLabel(
                      atendimentoAberto.statusOportunidade ||
                      "NAO_ANALISADA"
                    ),
                  ],
                  [
                    "Último acionamento",
                    formatarDataHora(
                      atendimentoAberto.ultimoAcionamento
                    ),
                  ],
                  [
                    "Próxima ação",
                    atendimentoAberto.proximaAcao ||
                      "Não definida",
                  ],
                  [
                    "Próximo contato",
                    formatarDataHora(
                      atendimentoAberto.proximoContato
                    ),
                  ],
                ].map(
                  ([titulo, valor]) => (
                    <div
                      key={titulo}
                      style={{
                        background:
                          "#F7F8FB",
                        borderRadius: 9,
                        padding: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 8.8,
                          color: MUTED,
                          fontWeight: 900,
                          marginBottom: 3,
                        }}
                      >
                        {titulo.toUpperCase()}
                      </div>

                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          lineHeight: 1.4,
                        }}
                      >
                        {valor}
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* RELATÓRIO DO DEPARTAMENTO */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(0,1.35fr) minmax(300px,.65fr)",
                  gap: 14,
                  alignItems: "start",
                }}
              >
                <div>
                  <h3
                    style={{
                      fontFamily:
                        DISPLAY_FONT,
                      margin:
                        "0 0 10px",
                      fontSize: 20,
                    }}
                  >
                    Relatório do consultor · {atendimentoAberto.area}
                  </h3>

                  {(() => {
                    const eixo =
                      eixoDoAtendimento();

                    if (!eixo) {
                      return (
                        <Card>
                          O diagnóstico completo ainda não possui conteúdo estruturado para este departamento.
                        </Card>
                      );
                    }

                    return (
                      <>
                        <Card
                          style={{
                            marginBottom: 10,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent:
                                "space-between",
                              gap: 10,
                              alignItems:
                                "flex-start",
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: 10,
                                  color: CORAL,
                                  fontWeight: 900,
                                  marginBottom: 4,
                                }}
                              >
                                SITUAÇÃO IDENTIFICADA
                              </div>

                              <div
                                style={{
                                  fontSize: 12,
                                  lineHeight: 1.6,
                                }}
                              >
                                {normalizarLista(
                                  eixo.achados
                                ).length
                                  ? textoSeguro(
                                      normalizarLista(
                                        eixo.achados
                                      )[0]
                                    )
                                  : "Consulte os pontos abaixo para aprofundamento."}
                              </div>
                            </div>

                            <div
                              style={{
                                background:
                                  scoreInfo(
                                    eixo.score
                                  ).bg,
                                color:
                                  scoreInfo(
                                    eixo.score
                                  ).color,
                                padding:
                                  "8px 11px",
                                borderRadius: 10,
                                fontWeight: 900,
                                fontSize: 18,
                              }}
                            >
                              {eixo.score ??
                                atendimentoAberto.scoreArea ??
                                "-"}
                            </div>
                          </div>
                        </Card>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit,minmax(210px,1fr))",
                            gap: 9,
                            marginBottom: 14,
                          }}
                        >
                          <ListaInterna
                            titulo="Achados"
                            itens={
                              eixo.achados
                            }
                          />

                          <ListaInterna
                            titulo="Riscos"
                            itens={
                              eixo.riscos
                            }
                          />

                          <ListaInterna
                            titulo="Pontos fortes"
                            itens={
                              eixo.pontosFortes
                            }
                          />

                          <ListaInterna
                            titulo="Recomendações"
                            itens={
                              eixo.recomendacoes
                            }
                          />
                        </div>

                        <h3
                          style={{
                            fontFamily:
                              DISPLAY_FONT,
                            margin:
                              "18px 0 9px",
                            fontSize: 17,
                          }}
                        >
                          Respostas que originaram o diagnóstico
                        </h3>

                        <Card
                          style={{
                            padding: 0,
                            overflowX:
                              "auto",
                          }}
                        >
                          <table
                            style={{
                              width:
                                "100%",
                              minWidth: 620,
                              borderCollapse:
                                "collapse",
                            }}
                          >
                            <thead>
                              <tr>
                                <th style={thStyle}>Tema</th>
                                <th style={thStyle}>Pergunta</th>
                                <th style={thStyle}>Resposta</th>
                              </tr>
                            </thead>

                            <tbody>
                              {perguntasDoAtendimento().length ? (
                                perguntasDoAtendimento().map(
                                  (
                                    item,
                                    index
                                  ) => (
                                    <tr key={index}>
                                      <td style={tdStyle}>
                                        {textoSeguro(
                                          item.tema
                                        ) || "-"}
                                      </td>
                                      <td style={tdStyle}>
                                        {textoSeguro(
                                          item.pergunta
                                        ) || "-"}
                                      </td>
                                      <td
                                        style={{
                                          ...tdStyle,
                                          fontWeight: 800,
                                        }}
                                      >
                                        {textoSeguro(
                                          item.resposta
                                        ) || "-"}
                                      </td>
                                    </tr>
                                  )
                                )
                              ) : (
                                <tr>
                                  <td
                                    colSpan="3"
                                    style={{
                                      ...tdStyle,
                                      textAlign:
                                        "center",
                                    }}
                                  >
                                    Nenhuma resposta específica armazenada para este departamento.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </Card>

                        <h3
                          style={{
                            fontFamily:
                              DISPLAY_FONT,
                            margin:
                              "18px 0 9px",
                            fontSize: 17,
                          }}
                        >
                          Propostas comerciais
                        </h3>

                        <Card
                          style={{
                            marginBottom: 14,
                            background:
                              "#FBFCFE",
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit,minmax(260px,1fr))",
                              gap: 12,
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent:
                                    "space-between",
                                  alignItems:
                                    "center",
                                  gap: 8,
                                  marginBottom: 9,
                                }}
                              >
                                <strong
                                  style={{
                                    fontSize: 11.5,
                                  }}
                                >
                                  Propostas vinculadas
                                </strong>

                                <span
                                  style={{
                                    background:
                                      "#EEF0F5",
                                    borderRadius: 999,
                                    padding:
                                      "4px 8px",
                                    fontSize: 9,
                                    fontWeight: 900,
                                  }}
                                >
                                  {propostasAtendimento.length}
                                </span>
                              </div>

                              {carregandoPropostas ? (
                                <div
                                  style={{
                                    color: MUTED,
                                    fontSize: 10.5,
                                  }}
                                >
                                  Carregando...
                                </div>
                              ) : propostasAtendimento.length ? (
                                <div
                                  style={{
                                    display: "grid",
                                    gap: 8,
                                  }}
                                >
                                  {propostasAtendimento.map(
                                    (proposta) => (
                                      <div
                                        key={proposta.id}
                                        style={{
                                          border:
                                            "1px solid #D8DEEA",
                                          borderRadius: 9,
                                          padding: 10,
                                          background:
                                            propostaEditandoId ===
                                            proposta.id
                                              ? "#FFF7F3"
                                              : WHITE,
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: "flex",
                                            justifyContent:
                                              "space-between",
                                            gap: 8,
                                          }}
                                        >
                                          <div>
                                            <strong
                                              style={{
                                                fontSize: 11,
                                              }}
                                            >
                                              {proposta.servico}
                                            </strong>

                                            <div
                                              style={{
                                                color: MUTED,
                                                fontSize: 9,
                                                marginTop: 2,
                                              }}
                                            >
                                              {statusPropostaLabel(
                                                proposta.status
                                              )}{" "}
                                              ·{" "}
                                              {proposta.tipoReceita ===
                                              "RECORRENTE"
                                                ? "Recorrente"
                                                : proposta.tipoReceita ===
                                                  "MISTA"
                                                ? "Mista"
                                                : "Pontual"}
                                            </div>
                                          </div>

                                          <strong
                                            style={{
                                              fontSize: 11,
                                              color: NAVY,
                                            }}
                                          >
                                            {formatarMoeda(
                                              proposta.valorTotal
                                            )}
                                          </strong>
                                        </div>

                                        {Number(
                                          proposta.mensalidade ||
                                          0
                                        ) > 0 && (
                                          <div
                                            style={{
                                              marginTop: 5,
                                              fontSize: 9.5,
                                              color: MUTED,
                                            }}
                                          >
                                            Mensalidade:{" "}
                                            <strong>
                                              {formatarMoeda(
                                                proposta.mensalidade
                                              )}
                                            </strong>
                                          </div>
                                        )}

                                        {proposta.status ===
                                          "PERDIDA" &&
                                          proposta.motivoPerda && (
                                            <div
                                              style={{
                                                marginTop: 6,
                                                background:
                                                  "#FDE9E7",
                                                color:
                                                  "#8E352A",
                                                borderRadius: 6,
                                                padding: 6,
                                                fontSize: 9,
                                              }}
                                            >
                                              Motivo:{" "}
                                              {proposta.motivoPerda}
                                            </div>
                                          )}

                                        <div
                                          style={{
                                            display: "flex",
                                            gap: 6,
                                            marginTop: 8,
                                          }}
                                        >
                                          <button
                                            type="button"
                                            onClick={() =>
                                              carregarPropostaNoFormulario(
                                                proposta
                                              )
                                            }
                                            style={{
                                              flex: 1,
                                              border:
                                                "1px solid #D8DEEA",
                                              background:
                                                WHITE,
                                              borderRadius: 7,
                                              padding:
                                                "6px 7px",
                                              fontSize: 9,
                                              fontWeight: 800,
                                              cursor:
                                                "pointer",
                                            }}
                                          >
                                            Editar
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() =>
                                              excluirPropostaCaso(
                                                proposta
                                              )
                                            }
                                            style={{
                                              border:
                                                "1px solid #E2B8B8",
                                              background:
                                                "#FFF7F7",
                                              color:
                                                "#A12B2B",
                                              borderRadius: 7,
                                              padding:
                                                "6px 8px",
                                              cursor:
                                                "pointer",
                                            }}
                                          >
                                            <Trash2
                                              size={12}
                                            />
                                          </button>
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              ) : (
                                <div
                                  style={{
                                    border:
                                      "1px dashed #C9D1DF",
                                    borderRadius: 8,
                                    padding: 13,
                                    color: MUTED,
                                    fontSize: 9.8,
                                    textAlign:
                                      "center",
                                  }}
                                >
                                  Nenhuma proposta criada.
                                </div>
                              )}
                            </div>

                            <div
                              style={{
                                background:
                                  "#F4F6FA",
                                borderRadius: 9,
                                padding: 11,
                              }}
                            >
                              <strong
                                style={{
                                  display: "block",
                                  fontSize: 11.5,
                                  marginBottom: 9,
                                }}
                              >
                                {propostaEditandoId
                                  ? "Editar proposta"
                                  : "Nova proposta"}
                              </strong>

                              <div
                                style={{
                                  display: "grid",
                                  gap: 7,
                                }}
                              >
                                <input
                                  value={propostaForm.servico}
                                  onChange={(e) =>
                                    editarCampoProposta(
                                      "servico",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Serviço / solução"
                                  style={{
                                    border:
                                      "1px solid #D8DEEA",
                                    borderRadius: 7,
                                    padding:
                                      "8px 9px",
                                  }}
                                />

                                <textarea
                                  value={propostaForm.descricao}
                                  onChange={(e) =>
                                    editarCampoProposta(
                                      "descricao",
                                      e.target.value
                                    )
                                  }
                                  rows={2}
                                  placeholder="Escopo resumido"
                                  style={{
                                    border:
                                      "1px solid #D8DEEA",
                                    borderRadius: 7,
                                    padding:
                                      "8px 9px",
                                    resize:
                                      "vertical",
                                    fontFamily:
                                      BODY_FONT,
                                  }}
                                />

                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                      "repeat(2,minmax(0,1fr))",
                                    gap: 7,
                                  }}
                                >
                                  <select
                                    value={propostaForm.tipoReceita}
                                    onChange={(e) =>
                                      editarCampoProposta(
                                        "tipoReceita",
                                        e.target.value
                                      )
                                    }
                                    style={{
                                      border:
                                        "1px solid #D8DEEA",
                                      borderRadius: 7,
                                      padding:
                                        "8px 9px",
                                      background:
                                        WHITE,
                                    }}
                                  >
                                    <option value="PONTUAL">
                                      Pontual
                                    </option>
                                    <option value="RECORRENTE">
                                      Recorrente
                                    </option>
                                    <option value="MISTA">
                                      Projeto + recorrência
                                    </option>
                                  </select>

                                  <select
                                    value={propostaForm.status}
                                    onChange={(e) =>
                                      editarCampoProposta(
                                        "status",
                                        e.target.value
                                      )
                                    }
                                    style={{
                                      border:
                                        "1px solid #D8DEEA",
                                      borderRadius: 7,
                                      padding:
                                        "8px 9px",
                                      background:
                                        WHITE,
                                    }}
                                  >
                                    <option value="RASCUNHO">
                                      Rascunho
                                    </option>
                                    <option value="ENVIADA">
                                      Enviada
                                    </option>
                                    <option value="NEGOCIACAO">
                                      Negociação
                                    </option>
                                    <option value="GANHA">
                                      Ganha
                                    </option>
                                    <option value="PERDIDA">
                                      Perdida
                                    </option>
                                    <option value="CANCELADA">
                                      Cancelada
                                    </option>
                                  </select>
                                </div>

                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                      "repeat(3,minmax(0,1fr))",
                                    gap: 7,
                                  }}
                                >
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={propostaForm.valorTotal}
                                    onChange={(e) =>
                                      editarCampoProposta(
                                        "valorTotal",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Valor total"
                                    title="Valor total"
                                    style={{
                                      border:
                                        "1px solid #D8DEEA",
                                      borderRadius: 7,
                                      padding:
                                        "8px 9px",
                                      minWidth: 0,
                                    }}
                                  />

                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={propostaForm.mensalidade}
                                    onChange={(e) =>
                                      editarCampoProposta(
                                        "mensalidade",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Mensalidade"
                                    title="Mensalidade"
                                    style={{
                                      border:
                                        "1px solid #D8DEEA",
                                      borderRadius: 7,
                                      padding:
                                        "8px 9px",
                                      minWidth: 0,
                                    }}
                                  />

                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={propostaForm.taxaImplantacao}
                                    onChange={(e) =>
                                      editarCampoProposta(
                                        "taxaImplantacao",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Implantação"
                                    title="Taxa de implantação"
                                    style={{
                                      border:
                                        "1px solid #D8DEEA",
                                      borderRadius: 7,
                                      padding:
                                        "8px 9px",
                                      minWidth: 0,
                                    }}
                                  />
                                </div>

                                <input
                                  type="date"
                                  value={propostaForm.validade}
                                  onChange={(e) =>
                                    editarCampoProposta(
                                      "validade",
                                      e.target.value
                                    )
                                  }
                                  style={{
                                    border:
                                      "1px solid #D8DEEA",
                                    borderRadius: 7,
                                    padding:
                                      "8px 9px",
                                  }}
                                />

                                {propostaForm.status ===
                                  "PERDIDA" && (
                                  <textarea
                                    value={propostaForm.motivoPerda}
                                    onChange={(e) =>
                                      editarCampoProposta(
                                        "motivoPerda",
                                        e.target.value
                                      )
                                    }
                                    rows={2}
                                    placeholder="Motivo da perda"
                                    style={{
                                      border:
                                        "1px solid #E2B8B8",
                                      borderRadius: 7,
                                      padding:
                                        "8px 9px",
                                      resize:
                                        "vertical",
                                      fontFamily:
                                        BODY_FONT,
                                    }}
                                  />
                                )}

                                <textarea
                                  value={propostaForm.observacoes}
                                  onChange={(e) =>
                                    editarCampoProposta(
                                      "observacoes",
                                      e.target.value
                                    )
                                  }
                                  rows={2}
                                  placeholder="Observações internas"
                                  style={{
                                    border:
                                      "1px solid #D8DEEA",
                                    borderRadius: 7,
                                    padding:
                                      "8px 9px",
                                    resize:
                                      "vertical",
                                    fontFamily:
                                      BODY_FONT,
                                  }}
                                />

                                <div
                                  style={{
                                    display: "flex",
                                    gap: 7,
                                  }}
                                >
                                  {propostaEditandoId && (
                                    <button
                                      type="button"
                                      onClick={
                                        limparFormularioProposta
                                      }
                                      style={{
                                        border:
                                          "1px solid #D8DEEA",
                                        background:
                                          WHITE,
                                        borderRadius: 7,
                                        padding:
                                          "8px 10px",
                                        fontWeight: 800,
                                        cursor:
                                          "pointer",
                                      }}
                                    >
                                      Cancelar
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={
                                      salvarPropostaCaso
                                    }
                                    disabled={
                                      salvandoProposta
                                    }
                                    style={{
                                      flex: 1,
                                      border: 0,
                                      background:
                                        CORAL,
                                      color:
                                        WHITE,
                                      borderRadius: 7,
                                      padding:
                                        "8px 10px",
                                      fontWeight: 900,
                                      cursor:
                                        salvandoProposta
                                          ? "wait"
                                          : "pointer",
                                      display:
                                        "flex",
                                      alignItems:
                                        "center",
                                      justifyContent:
                                        "center",
                                      gap: 6,
                                    }}
                                  >
                                    <Plus
                                      size={13}
                                    />
                                    {salvandoProposta
                                      ? "Salvando..."
                                      : propostaEditandoId
                                      ? "Salvar alterações"
                                      : "Criar proposta"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>

                        <h3
                          style={{
                            fontFamily:
                              DISPLAY_FONT,
                            margin:
                              "18px 0 9px",
                            fontSize: 17,
                          }}
                        >
                          Histórico do atendimento
                        </h3>

                        {historicoAtendimento.length ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection:
                                "column",
                              gap: 9,
                            }}
                          >
                            {historicoAtendimento.map(
                              (hist) => (
                                <div
                                  key={hist.id}
                                  style={{
                                    borderLeft:
                                      `4px solid ${CORAL}`,
                                    background:
                                      "#F7F8FB",
                                    borderRadius: 10,
                                    padding: 11,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent:
                                        "space-between",
                                      gap: 8,
                                      flexWrap:
                                        "wrap",
                                      marginBottom: 5,
                                    }}
                                  >
                                    <strong
                                      style={{
                                        fontSize: 11,
                                      }}
                                    >
                                      {hist.tipoEvento ===
                                      "ALTERACAO"
                                        ? "Alteração do atendimento"
                                        : rotuloTipoAcionamento(
                                            hist.tipoAcionamento
                                          )}
                                    </strong>

                                    <span
                                      style={{
                                        fontSize: 9.5,
                                        color: MUTED,
                                      }}
                                    >
                                      {formatarDataHora(
                                        hist.criadoEm
                                      )}
                                    </span>
                                  </div>

                                  {hist.responsavelNome && (
                                    <div
                                      style={{
                                        fontSize: 10,
                                        color: MUTED,
                                        marginBottom: 4,
                                      }}
                                    >
                                      Por {hist.responsavelNome}
                                    </div>
                                  )}

                                  {hist.resultado && (
                                    <div
                                      style={{
                                        fontSize: 11.5,
                                        fontWeight: 800,
                                        marginBottom: 3,
                                      }}
                                    >
                                      {hist.resultado}
                                    </div>
                                  )}

                                  {hist.descricao && (
                                    <div
                                      style={{
                                        fontSize: 11,
                                        lineHeight: 1.5,
                                      }}
                                    >
                                      {hist.descricao}
                                    </div>
                                  )}

                                  {(hist.statusAnterior !==
                                    hist.statusNovo ||
                                    hist.oportunidadeAnterior !==
                                      hist.oportunidadeNova) && (
                                    <div
                                      style={{
                                        marginTop: 7,
                                        fontSize: 9.8,
                                        color: MUTED,
                                      }}
                                    >
                                      {hist.statusAnterior !==
                                        hist.statusNovo && (
                                        <span>
                                          Status:{" "}
                                          {statusAtendimentoLabel(
                                            hist.statusAnterior
                                          )}{" "}
                                          →{" "}
                                          {statusAtendimentoLabel(
                                            hist.statusNovo
                                          )}
                                        </span>
                                      )}

                                      {hist.statusAnterior !==
                                        hist.statusNovo &&
                                        hist.oportunidadeAnterior !==
                                          hist.oportunidadeNova &&
                                        " · "}

                                      {hist.oportunidadeAnterior !==
                                        hist.oportunidadeNova && (
                                        <span>
                                          Oportunidade:{" "}
                                          {statusOportunidadeLabel(
                                            hist.oportunidadeAnterior
                                          )}{" "}
                                          →{" "}
                                          {statusOportunidadeLabel(
                                            hist.oportunidadeNova
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {hist.proximaAcao && (
                                    <div
                                      style={{
                                        marginTop: 7,
                                        background:
                                          "#FFF3EF",
                                        borderRadius: 7,
                                        padding: 7,
                                        fontSize: 10.5,
                                      }}
                                    >
                                      <strong>Próxima ação:</strong>{" "}
                                      {hist.proximaAcao}
                                      {hist.proximoContato
                                        ? ` · ${formatarDataHora(
                                            hist.proximoContato
                                          )}`
                                        : ""}
                                    </div>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        ) : (
                          <Card>
                            Nenhum acionamento registrado ainda.
                          </Card>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* REGISTRO DO ACIONAMENTO */}
                <div
                  style={{
                    position: "sticky",
                    top: 12,
                  }}
                >
                  <Card>
                    <div
                      style={{
                        color: CORAL,
                        fontWeight: 900,
                        fontSize: 10,
                        marginBottom: 4,
                      }}
                    >
                      NOVO ACIONAMENTO
                    </div>

                    <h3
                      style={{
                        margin:
                          "0 0 12px",
                        fontFamily:
                          DISPLAY_FONT,
                        fontSize: 18,
                      }}
                    >
                      Registrar andamento
                    </h3>

                    <label style={{ fontSize: 9.5, fontWeight: 800 }}>
                      TIPO
                    </label>

                    <select
                      value={tipoAcionamento}
                      onChange={(e) =>
                        setTipoAcionamento(
                          e.target.value
                        )
                      }
                      style={{
                        width: "100%",
                        border:
                          "1px solid #D8DEEA",
                        borderRadius: 8,
                        padding: "8px 9px",
                        margin:
                          "4px 0 10px",
                        background: WHITE,
                      }}
                    >
                      <option value="WHATSAPP">WhatsApp</option>
                      <option value="LIGACAO">Ligação</option>
                      <option value="EMAIL">E-mail</option>
                      <option value="REUNIAO">Reunião</option>
                      <option value="VIDEOCONFERENCIA">Videoconferência</option>
                      <option value="PROPOSTA">Proposta</option>
                      <option value="ANALISE_INTERNA">Análise interna</option>
                      <option value="DOCUMENTOS">Documentos</option>
                      <option value="OUTRO">Outro</option>
                    </select>

                    <div
                      style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        marginBottom: 5,
                      }}
                    >
                      AÇÕES RÁPIDAS
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 5,
                        marginBottom: 10,
                      }}
                    >
                      {[
                        {
                          label:
                            "Cliente respondeu",
                          resultado:
                            "Cliente respondeu ao contato.",
                          status:
                            "EM_ATENDIMENTO",
                        },
                        {
                          label:
                            "Sem retorno",
                          resultado:
                            "Contato realizado, sem retorno do cliente.",
                          status:
                            statusCaso,
                        },
                        {
                          label:
                            "Reunião marcada",
                          resultado:
                            "Reunião agendada com o cliente.",
                          status:
                            "REUNIAO_AGENDADA",
                        },
                        {
                          label:
                            "Pediu proposta",
                          resultado:
                            "Cliente solicitou proposta.",
                          status:
                            "EM_ATENDIMENTO",
                          oportunidade:
                            "OPORTUNIDADE_IDENTIFICADA",
                        },
                        {
                          label:
                            "Proposta enviada",
                          resultado:
                            "Proposta apresentada ao cliente.",
                          status:
                            "PLANO_APRESENTADO",
                          oportunidade:
                            "PROPOSTA",
                        },
                      ].map(
                        (acao) => (
                          <button
                            key={
                              acao.label
                            }
                            type="button"
                            onClick={() => {
                              setResultadoAcionamento(
                                acao.resultado
                              );

                              setStatusCaso(
                                acao.status
                              );

                              if (
                                acao.oportunidade
                              ) {
                                setOportunidadeCaso(
                                  acao.oportunidade
                                );
                              }
                            }}
                            style={{
                              border:
                                "1px solid #D8DEEA",
                              background:
                                WHITE,
                              color:
                                NAVY,
                              borderRadius: 20,
                              padding:
                                "5px 8px",
                              fontSize: 8.8,
                              fontWeight: 700,
                              cursor:
                                "pointer",
                            }}
                          >
                            {acao.label}
                          </button>
                        )
                      )}
                    </div>

                    <label style={{ fontSize: 9.5, fontWeight: 800 }}>
                      RESULTADO
                    </label>

                    <input
                      value={resultadoAcionamento}
                      onChange={(e) =>
                        setResultadoAcionamento(
                          e.target.value
                        )
                      }
                      placeholder="Ex.: cliente pediu proposta"
                      style={{
                        width: "100%",
                        boxSizing:
                          "border-box",
                        border:
                          "1px solid #D8DEEA",
                        borderRadius: 8,
                        padding: "8px 9px",
                        margin:
                          "4px 0 10px",
                      }}
                    />

                    <label style={{ fontSize: 9.5, fontWeight: 800 }}>
                      OBSERVAÇÃO
                    </label>

                    <textarea
                      value={descricaoAcionamento}
                      onChange={(e) =>
                        setDescricaoAcionamento(
                          e.target.value
                        )
                      }
                      rows={4}
                      placeholder="O que aconteceu neste contato?"
                      style={{
                        width: "100%",
                        boxSizing:
                          "border-box",
                        border:
                          "1px solid #D8DEEA",
                        borderRadius: 8,
                        padding: "8px 9px",
                        margin:
                          "4px 0 10px",
                        resize: "vertical",
                        fontFamily:
                          BODY_FONT,
                      }}
                    />

                    <label style={{ fontSize: 9.5, fontWeight: 800 }}>
                      STATUS DO ATENDIMENTO
                    </label>

                    <select
                      value={statusCaso}
                      onChange={(e) =>
                        setStatusCaso(
                          e.target.value
                        )
                      }
                      style={{
                        width: "100%",
                        border:
                          "1px solid #D8DEEA",
                        borderRadius: 8,
                        padding: "8px 9px",
                        margin:
                          "4px 0 10px",
                        background: WHITE,
                      }}
                    >
                      <option value="NAO_INICIADO">Novo / não iniciado</option>
                      <option value="EM_ANALISE">Avaliando</option>
                      <option value="REUNIAO_AGENDADA">Reunião agendada</option>
                      <option value="EM_ATENDIMENTO">Em tratativa</option>
                      <option value="PLANO_APRESENTADO">Aguardando / proposta apresentada</option>
                      <option value="CONCLUIDO">Concluído</option>
                    </select>

                    <label style={{ fontSize: 9.5, fontWeight: 800 }}>
                      OPORTUNIDADE
                    </label>

                    <select
                      value={oportunidadeCaso}
                      onChange={(e) =>
                        setOportunidadeCaso(
                          e.target.value
                        )
                      }
                      style={{
                        width: "100%",
                        border:
                          "1px solid #D8DEEA",
                        borderRadius: 8,
                        padding: "8px 9px",
                        margin:
                          "4px 0 10px",
                        background: WHITE,
                      }}
                    >
                      <option value="NAO_ANALISADA">Não analisada</option>
                      <option value="EM_ANALISE">Em análise</option>
                      <option value="OPORTUNIDADE_IDENTIFICADA">Oportunidade identificada</option>
                      <option value="PROPOSTA">Proposta</option>
                      <option value="CONTRATADO">Contratado</option>
                      <option value="SEM_OPORTUNIDADE">Sem oportunidade</option>
                    </select>

                    <label style={{ fontSize: 9.5, fontWeight: 800 }}>
                      PRÓXIMA AÇÃO
                    </label>

                    <input
                      value={proximaAcaoCaso}
                      onChange={(e) =>
                        setProximaAcaoCaso(
                          e.target.value
                        )
                      }
                      placeholder="Ex.: enviar proposta"
                      style={{
                        width: "100%",
                        boxSizing:
                          "border-box",
                        border:
                          "1px solid #D8DEEA",
                        borderRadius: 8,
                        padding: "8px 9px",
                        margin:
                          "4px 0 10px",
                      }}
                    />

                    <label style={{ fontSize: 9.5, fontWeight: 800 }}>
                      DATA DO PRÓXIMO CONTATO
                    </label>

                    <input
                      type="datetime-local"
                      value={proximoContatoCaso}
                      onChange={(e) =>
                        setProximoContatoCaso(
                          e.target.value
                        )
                      }
                      style={{
                        width: "100%",
                        boxSizing:
                          "border-box",
                        border:
                          "1px solid #D8DEEA",
                        borderRadius: 8,
                        padding: "8px 9px",
                        margin:
                          "4px 0 12px",
                      }}
                    />

                    <Botao
                      onClick={
                        registrarAcionamentoCaso
                      }
                      disabled={
                        salvandoAcionamento
                      }
                      style={{
                        width: "100%",
                      }}
                    >
                      <Save size={13} />
                      {salvandoAcionamento
                        ? "Salvando..."
                        : "Salvar acionamento"}
                    </Botao>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {erro && (
        <div
          style={{
            background:
              "#FAECE7",
            color:
              "#993C1D",
            borderRadius: 10,
            padding: 12,
            marginBottom: 14,
          }}
        >
          {erro}
        </div>
      )}

      {carregando ? (
        <Card>
          Carregando atendimentos...
        </Card>
      ) : filtrados.length === 0 ? (
        <Card
          style={{
            borderLeft:
              `4px solid ${CORAL}`,
          }}
        >
          <strong
            style={{
              display: "block",
              marginBottom: 5,
            }}
          >
            Nenhum atendimento disponível nesta fila.
          </strong>

          <div
            style={{
              color: MUTED,
              fontSize: 11,
              lineHeight: 1.5,
            }}
          >
            O botão <strong>Abrir atendimento</strong> aparece dentro de cada caso.
            Se não houver casos, conclua um novo diagnóstico que gere oportunidade
            departamental ou limpe os filtros acima.
          </div>
        </Card>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {filtrados.map(
            (atendimento) => {
              const lead =
                leadDoAtendimento(
                  atendimento
                );

              const infoScore =
                scoreInfo(
                  atendimento.scoreArea
                );

              const infoStatus =
                statusAtendimentoCor(
                  atendimento.statusAtendimento
                );

              const edicao =
                edicoes[
                  atendimento.id
                ] ||
                {};

              const responsaveisCompativeis =
                responsaveis.filter(
                  (responsavel) =>
                    responsavelCompativelComArea(
                      responsavel,
                      atendimento.area
                    )
                );

              return (
                <Card
                  key={
                    atendimento.id
                  }
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(220px,1.3fr) 120px minmax(180px,.9fr) minmax(220px,1fr)",
                      gap: 14,
                      alignItems: "start",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: CORAL,
                          fontSize: 9.5,
                          fontWeight: 900,
                          letterSpacing: 0.5,
                          marginBottom: 4,
                        }}
                      >
                        {
                          atendimento.area
                        }
                      </div>

                      <strong
                        style={{
                          fontSize: 14,
                        }}
                      >
                        {nomeClienteAtendimento(
                          atendimento
                        )}
                      </strong>

                      <div
                        style={{
                          color: MUTED,
                          fontSize: 10.5,
                          marginTop: 4,
                          lineHeight: 1.5,
                        }}
                      >
                        {lead.cnpj
                          ? formatarCnpj(
                              lead.cnpj
                            )
                          : ""}

                        {lead.nome
                          ? ` · ${lead.nome}`
                          : ""}

                        {lead.telefone
                          ? ` · ${lead.telefone}`
                          : ""}

                        {lead.email
                          ? ` · ${lead.email}`
                          : ""}

                        {!lead.cnpj &&
                        lead.nome
                          ? ` · ${lead.nome}`
                          : ""}

                        {lead.estruturaNegocio
                          ? ` · ${rotuloEstruturaAtendimento(
                              lead.estruturaNegocio
                            )}`
                          : ""}

                        {lead.origem
                          ? ` · Origem: ${
                              lead.origem ===
                              "diagnostico_salvo"
                                ? "Diagnóstico"
                                : lead.origem
                            }`
                          : ""}

                        {lead.statusDiagnostico
                          ? ` · ${statusDiagnosticoLabelLocal(
                              lead.statusDiagnostico
                            )}`
                          : ""}
                      </div>

                      {(atendimento.proximaAcao ||
                        atendimento.proximoContato) && (
                        <div
                          style={{
                            marginTop: 7,
                            fontSize: 10.2,
                            color: MUTED,
                            lineHeight: 1.45,
                          }}
                        >
                          {atendimento.proximaAcao && (
                            <>
                              <strong
                                style={{
                                  color: NAVY,
                                }}
                              >
                                Próxima ação:
                              </strong>{" "}
                              {atendimento.proximaAcao}
                            </>
                          )}

                          {atendimento.proximoContato && (
                            <>
                              {atendimento.proximaAcao
                                ? " · "
                                : ""}
                              {formatarDataHora(
                                atendimento.proximoContato
                              )}
                            </>
                          )}
                        </div>
                      )}

                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          flexWrap: "wrap",
                          marginTop: 8,
                        }}
                      >
                        <span
                          style={{
                            background:
                              infoStatus.bg,
                            color:
                              infoStatus.color,
                            borderRadius: 20,
                            padding:
                              "4px 8px",
                            fontSize: 9,
                            fontWeight: 800,
                          }}
                        >
                          {statusAtendimentoLabel(
                            atendimento.statusAtendimento
                          )}
                        </span>

                        <span
                          style={{
                            background:
                              statusOportunidadeCor(
                                atendimento.statusOportunidade || "NAO_ANALISADA"
                              ).bg,
                            color:
                              statusOportunidadeCor(
                                atendimento.statusOportunidade || "NAO_ANALISADA"
                              ).color,
                            borderRadius: 20,
                            padding: "4px 8px",
                            fontSize: 9,
                            fontWeight: 800,
                          }}
                        >
                          {statusOportunidadeLabel(
                            atendimento.statusOportunidade || "NAO_ANALISADA"
                          )}
                        </span>

                        {atendimento.nivelArea && (
                          <span
                            style={{
                              background:
                                infoScore.bg,
                              color:
                                infoScore.color,
                              borderRadius:
                                20,
                              padding:
                                "4px 8px",
                              fontSize: 9,
                              fontWeight: 800,
                            }}
                          >
                            {
                              atendimento.nivelArea
                            }
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          marginTop: 12,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            abrirAtendimento(
                              atendimento
                            )
                          }
                          style={{
                            width: "100%",
                            background: CORAL,
                            border: 0,
                            color: WHITE,
                            borderRadius: 10,
                            padding: "10px 12px",
                            fontSize: 11,
                            fontWeight: 900,
                            cursor: "pointer",
                            boxShadow:
                              "0 6px 16px rgba(255,107,74,.20)",
                          }}
                        >
                          Abrir atendimento
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            alternarArquivoAtendimento(
                              atendimento
                            )
                          }
                          style={{
                            width: "100%",
                            marginTop: 7,
                            background: WHITE,
                            border:
                              "1px solid #D8DEEA",
                            color: NAVY,
                            borderRadius: 10,
                            padding: "8px 10px",
                            fontSize: 10,
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          {atendimento.arquivado
                            ? "Desarquivar atendimento"
                            : "Arquivar atendimento"}
                        </button>

                        <button
                          type="button"
                          onClick={() => excluirLeadAtendimento(atendimento)}
                          style={{
                            width: "100%",
                            marginTop: 7,
                            background: WHITE,
                            border: "1px solid #E2B8B8",
                            color: "#A12B2B",
                            borderRadius: 10,
                            padding: "8px 10px",
                            fontSize: 10,
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          Excluir lead / teste
                        </button>

                        {atendimento.diagnosticoId && (
                          <div
                            style={{
                              marginTop: 8,
                            }}
                          >
                          <button
                            type="button"
                            onClick={() =>
                              onAbrirDiagnostico(
                                atendimento.diagnosticoId
                              )
                            }
                            style={{
                              background:
                                "transparent",
                              border: 0,
                              color: CORAL,
                              fontSize: 10,
                              fontWeight: 800,
                              padding: 0,
                              cursor: "pointer",
                            }}
                          >
                            Diagnóstico completo →
                          </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        textAlign: "center",
                        background:
                          infoScore.bg,
                        color:
                          infoScore.color,
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 900,
                        }}
                      >
                        {atendimento.scoreArea ??
                          "-"}
                      </div>

                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          marginTop: 2,
                        }}
                      >
                        SCORE DA ÁREA
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 9.5,
                          color: MUTED,
                          fontWeight: 800,
                          marginBottom: 5,
                        }}
                      >
                        ESPECIALISTA
                      </div>

                      <select
                        value={
                          edicao.responsavelId ??
                          atendimento.responsavelId ??
                          ""
                        }
                        onChange={(e) =>
                          editar(
                            atendimento.id,
                            "responsavelId",
                            e.target.value
                          )
                        }
                        style={{
                          width: "100%",
                          border:
                            "1px solid #D8DEEA",
                          borderRadius: 8,
                          padding:
                            "8px 9px",
                          background: WHITE,
                          fontSize: 10.5,
                          marginBottom: 8,
                        }}
                      >
                        <option value="">
                          Não atribuído
                        </option>

                        {responsaveisCompativeis.map(
                          (responsavel) => (
                            <option
                              key={
                                responsavel.id
                              }
                              value={
                                responsavel.id
                              }
                            >
                              {
                                responsavel.nome
                              }
                              {" · "}
                              {
                                responsavel.leadsAbertos
                              }
                              {" abertos"}
                            </option>
                          )
                        )}
                      </select>

                      {responsaveisCompativeis.length === 0 && (
                        <div
                          style={{
                            fontSize: 9.5,
                            color: "#993C1D",
                            lineHeight: 1.4,
                          }}
                        >
                          Nenhum integrante da equipe está cadastrado para esta área.
                        </div>
                      )}

                      <div
                        style={{
                          fontSize: 9.5,
                          color: MUTED,
                          fontWeight: 800,
                          margin:
                            "10px 0 5px",
                        }}
                      >
                        STATUS DO ATENDIMENTO
                      </div>

                      <select
                        value={
                          edicao.statusAtendimento ??
                          atendimento.statusAtendimento ??
                          "NAO_INICIADO"
                        }
                        onChange={(e) =>
                          editar(
                            atendimento.id,
                            "statusAtendimento",
                            e.target.value
                          )
                        }
                        style={{
                          width: "100%",
                          border:
                            "1px solid #D8DEEA",
                          borderRadius: 8,
                          padding:
                            "8px 9px",
                          background: WHITE,
                          fontSize: 10.5,
                        }}
                      >
                        <option value="NAO_INICIADO">
                          Não iniciado
                        </option>

                        <option value="EM_ANALISE">
                          Em análise
                        </option>

                        <option value="REUNIAO_AGENDADA">
                          Reunião agendada
                        </option>

                        <option value="EM_ATENDIMENTO">
                          Em atendimento
                        </option>

                        <option value="PLANO_APRESENTADO">
                          Plano apresentado
                        </option>

                        <option value="CONCLUIDO">
                          Concluído
                        </option>
                      </select>

                      <div
                        style={{
                          fontSize: 9.5,
                          color: MUTED,
                          fontWeight: 800,
                          margin: "10px 0 5px",
                        }}
                      >
                        STATUS DA OPORTUNIDADE
                      </div>

                      <select
                        value={
                          edicao.statusOportunidade ??
                          atendimento.statusOportunidade ??
                          "NAO_ANALISADA"
                        }
                        onChange={(e) =>
                          editar(
                            atendimento.id,
                            "statusOportunidade",
                            e.target.value
                          )
                        }
                        style={{
                          width: "100%",
                          border: "1px solid #D8DEEA",
                          borderRadius: 8,
                          padding: "8px 9px",
                          background: WHITE,
                          fontSize: 10.5,
                        }}
                      >
                        <option value="NAO_ANALISADA">Não analisada</option>
                        <option value="EM_ANALISE">Em análise</option>
                        <option value="OPORTUNIDADE_IDENTIFICADA">Oportunidade identificada</option>
                        <option value="PROPOSTA">Proposta</option>
                        <option value="CONTRATADO">Contratado</option>
                        <option value="SEM_OPORTUNIDADE">Sem oportunidade</option>
                      </select>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 9.5,
                          color: MUTED,
                          fontWeight: 800,
                          marginBottom: 5,
                        }}
                      >
                        OBSERVAÇÕES DO ESPECIALISTA
                      </div>

                      <textarea
                        value={
                          edicao.observacoesEspecialista ??
                          atendimento.observacoesEspecialista ??
                          ""
                        }
                        onChange={(e) =>
                          editar(
                            atendimento.id,
                            "observacoesEspecialista",
                            e.target.value
                          )
                        }
                        rows={4}
                        placeholder="Registre validações, observações da reunião e próximos passos..."
                        style={{
                          width: "100%",
                          boxSizing:
                            "border-box",
                          border:
                            "1px solid #D8DEEA",
                          borderRadius: 8,
                          padding:
                            "9px 10px",
                          fontFamily:
                            BODY_FONT,
                          fontSize: 10.5,
                          resize: "vertical",
                        }}
                      />

                      <Botao
                        onClick={() =>
                          salvarAtendimento(
                            atendimento
                          )
                        }
                        disabled={
                          salvandoId ===
                          atendimento.id
                        }
                        style={{
                          width: "100%",
                          marginTop: 8,
                        }}
                      >
                        <Save
                          size={13}
                        />

                        {salvandoId ===
                        atendimento.id
                          ? "Salvando..."
                          : "Salvar atendimento"}
                      </Botao>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit,minmax(220px,1fr))",
                      gap: 10,
                      marginTop: 14,
                    }}
                  >
                    <ListaInterna
                      titulo="Oportunidades"
                      itens={
                        atendimento.oportunidades
                      }
                    />

                    <ListaInterna
                      titulo="Riscos"
                      itens={
                        atendimento.riscos
                      }
                    />

                    <ListaInterna
                      titulo="Recomendações"
                      itens={
                        atendimento.recomendacoes
                      }
                    />

                    <ListaInterna
                      titulo="Plano de ação"
                      itens={
                        atendimento.planoAcao
                      }
                    />
                  </div>

                  {atendimento.orientacaoTecnica && (
                    <div
                      style={{
                        marginTop: 10,
                        background:
                          "#EEF3FF",
                        borderLeft:
                          "4px solid #31589C",
                        borderRadius: 10,
                        padding: 12,
                      }}
                    >
                      <strong
                        style={{
                          display: "block",
                          fontSize: 10.5,
                          marginBottom: 5,
                          color: "#31589C",
                        }}
                      >
                        ORIENTAÇÃO TÉCNICA PARA O ESPECIALISTA
                      </strong>

                      <div
                        style={{
                          fontSize: 11.5,
                          lineHeight: 1.55,
                        }}
                      >
                        {
                          atendimento.orientacaoTecnica
                        }
                      </div>
                    </div>
                  )}
                </Card>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}

function ResumoEstruturaSelecionada({
  estrutura,
  perfil = {},
  resultado = {},
}) {
  const contexto =
    resultado?.contextoEstrutura ||
    {};

  const holding =
    perfil?.holding ||
    contexto?.holding ||
    {};

  const pessoaFisica =
    perfil?.pessoaFisica ||
    contexto?.pessoaFisica ||
    {};

  const grupo =
    perfil?.grupo ||
    contexto?.grupo ||
    {};

  const spe =
    perfil?.spe ||
    contexto?.spe ||
    {};

  function Linha({
    titulo,
    valor,
  }) {
    if (
      valor === null ||
      valor === undefined ||
      valor === "" ||
      (
        Array.isArray(valor) &&
        valor.length === 0
      )
    ) {
      return null;
    }

    return (
      <div
        style={{
          background: "#F7F8FB",
          borderRadius: 9,
          padding: 10,
        }}
      >
        <div
          style={{
            fontSize: 9,
            color: MUTED,
            fontWeight: 800,
            marginBottom: 3,
          }}
        >
          {titulo}
        </div>

        <div
          style={{
            fontSize: 11.5,
            color: NAVY,
            lineHeight: 1.45,
          }}
        >
          {Array.isArray(valor)
            ? valor.join(" · ")
            : String(valor)}
        </div>
      </div>
    );
  }

  if (estrutura === "pessoa_fisica") {
    return (
      <Card
        style={{
          marginBottom: 16,
          borderLeft: `4px solid ${CORAL}`,
        }}
      >
        <h3 style={{ margin: "0 0 4px" }}>
          Perfil preenchido — Pessoa Física
        </h3>

        <p
          style={{
            margin: "0 0 12px",
            color: MUTED,
            fontSize: 10.5,
          }}
        >
          Dados informados no fluxo de consultoria pessoal.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(190px,1fr))",
            gap: 8,
          }}
        >
          <Linha titulo="OBJETIVOS" valor={pessoaFisica.objetivos} />
          <Linha titulo="RENDA MENSAL" valor={pessoaFisica.rendaMensal} />
          <Linha titulo="GASTOS MENSAIS" valor={pessoaFisica.gastosMensais} />
          <Linha titulo="DÍVIDAS / PARCELAS" valor={pessoaFisica.dividas} />
          <Linha titulo="RESERVA DE EMERGÊNCIA" valor={pessoaFisica.reservaEmergencia} />
          <Linha titulo="PATRIMÔNIO" valor={pessoaFisica.patrimonio} />
          <Linha titulo="INVESTIMENTOS ATUAIS" valor={pessoaFisica.investimentosAtuais} />
          <Linha titulo="APOSENTADORIA" valor={pessoaFisica.aposentadoria} />
          <Linha titulo="DEPENDENTES" valor={pessoaFisica.dependentes} />
        </div>
      </Card>
    );
  }

  if (
    estrutura === "holding" ||
    estrutura === "avaliar_holding"
  ) {
    return (
      <Card
        style={{
          marginBottom: 16,
          borderLeft: `4px solid ${CORAL}`,
        }}
      >
        <h3 style={{ margin: "0 0 4px" }}>
          {estrutura === "avaliar_holding"
            ? "Dados preenchidos — Avaliação de Holding"
            : "Dados preenchidos — Holding"}
        </h3>

        <p
          style={{
            margin: "0 0 12px",
            color: MUTED,
            fontSize: 10.5,
          }}
        >
          Dados patrimoniais e objetivos informados no fluxo selecionado.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(190px,1fr))",
            gap: 8,
          }}
        >
          <Linha titulo="TIPOS / HIPÓTESES" valor={holding.tipos} />
          <Linha titulo="OBJETIVOS" valor={holding.objetivos} />
          <Linha titulo="PATRIMÔNIO / ATIVOS" valor={holding.patrimonioAproximado} />
          <Linha titulo="RECEITAS PATRIMONIAIS" valor={holding.receitasPatrimoniais} />
          <Linha titulo="SITUAÇÃO SUCESSÓRIA" valor={holding.situacaoSucessoria} />
        </div>
      </Card>
    );
  }

  if (estrutura === "grupo") {
    return (
      <Card
        style={{
          marginBottom: 16,
          borderLeft: `4px solid ${CORAL}`,
        }}
      >
        <h3 style={{ margin: "0 0 4px" }}>
          Contexto preenchido — Grupo empresarial
        </h3>

        <p
          style={{
            margin: "0 0 12px",
            color: MUTED,
            fontSize: 10.5,
          }}
        >
          Estrutura, governança e relações entre as empresas consideradas no diagnóstico.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(190px,1fr))",
            gap: 8,
          }}
        >
          <Linha titulo="NOME DO GRUPO" valor={grupo.nomeGrupo} />
          <Linha titulo="FUNÇÃO DAS EMPRESAS" valor={grupo.funcaoEmpresas} />
          <Linha titulo="SÓCIOS / COMPOSIÇÃO" valor={grupo.sociosComuns} />
          <Linha titulo="FINANCEIRO CENTRALIZADO" valor={grupo.financeiroCentralizado} />
          <Linha titulo="PESSOAS / CUSTOS COMPARTILHADOS" valor={grupo.pessoasCompartilhadas} />
          <Linha titulo="OPERAÇÕES INTERCOMPANY" valor={grupo.operacoesIntercompany} />
          <Linha titulo="GOVERNANÇA" valor={grupo.governanca} />
        </div>
      </Card>
    );
  }

  if (estrutura === "spe") {
    return (
      <Card
        style={{
          marginBottom: 16,
          borderLeft: `4px solid ${CORAL}`,
        }}
      >
        <h3 style={{ margin: "0 0 4px" }}>
          Contexto preenchido — SPE / Projeto
        </h3>

        <p
          style={{
            margin: "0 0 12px",
            color: MUTED,
            fontSize: 10.5,
          }}
        >
          Premissas do projeto utilizadas para análise financeira, societária, tributária e de riscos.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(190px,1fr))",
            gap: 8,
          }}
        >
          <Linha titulo="CONSTITUÍDA?" valor={spe.constituida} />
          <Linha titulo="PROJETO / EMPREENDIMENTO" valor={spe.nomeProjeto} />
          <Linha titulo="FINALIDADE" valor={spe.finalidade} />
          <Linha titulo="SÓCIOS / INVESTIDORES" valor={spe.sociosInvestidores} />
          <Linha titulo="VALOR DO PROJETO" valor={spe.valorProjeto} />
          <Linha titulo="APORTES" valor={spe.aportes} />
          <Linha titulo="FINANCIAMENTO" valor={spe.financiamento} />
          <Linha titulo="PRAZO" valor={spe.prazo} />
          <Linha titulo="RECEITA PREVISTA" valor={spe.receitaPrevista} />
          <Linha titulo="CUSTOS PREVISTOS" valor={spe.custosPrevistos} />
          <Linha titulo="FASE ATUAL" valor={spe.faseProjeto} />
        </div>
      </Card>
    );
  }

  return null;
}

// =========================================================
// DETALHE DO DIAGNÓSTICO
// =========================================================

function DetalheDiagnostico({
  token,
  id,
  onVoltar,
}) {
  const [
    item,
    setItem,
  ] = useState(null);

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    erro,
    setErro,
  ] = useState("");

  const [
    abaRelatorio,
    setAbaRelatorio,
  ] = useState("administracao");

  const [
    atendimentosEquipe,
    setAtendimentosEquipe,
  ] = useState([]);

  const [
    areaEquipe,
    setAreaEquipe,
  ] = useState("");

  const [
    carregandoEquipe,
    setCarregandoEquipe,
  ] = useState(false);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      setErro("");

      try {
        const resposta =
          await fetch(
            `/api/diagnosticos?action=ver&id=${encodeURIComponent(
              id
            )}`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await resposta
            .json()
            .catch(() => null);

        if (
          !resposta.ok ||
          !data?.sucesso
        ) {
          throw new Error(
            data?.error ||
            "Não foi possível abrir o diagnóstico."
          );
        }

        setItem(
          data.diagnostico
        );

      } catch (error) {
        setErro(
          error?.message ||
          "Erro ao abrir diagnóstico."
        );

      } finally {
        setCarregando(false);
      }
    }

    carregar();
  }, [id, token]);

  useEffect(() => {
    async function carregarAtendimentosEquipe() {
      if (
        abaRelatorio !== "equipe" ||
        !id
      ) {
        return;
      }

      setCarregandoEquipe(true);

      try {
        const resposta =
          await fetch(
            `/api/crm?action=listar-atendimentos&diagnosticoId=${encodeURIComponent(
              id
            )}`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await resposta
            .json()
            .catch(() => null);

        if (
          !resposta.ok ||
          !data?.sucesso
        ) {
          throw new Error(
            data?.error ||
            "Não foi possível carregar os atendimentos da equipe."
          );
        }

        const lista =
          Array.isArray(
            data.atendimentos
          )
            ? data.atendimentos
            : [];

        setAtendimentosEquipe(
          lista
        );

        if (
          !areaEquipe &&
          lista.length
        ) {
          setAreaEquipe(
            lista[0].area ||
            ""
          );
        }
      } catch (error) {
        console.warn(
          "[Admin] Erro ao carregar relatório da equipe:",
          error
        );
      } finally {
        setCarregandoEquipe(false);
      }
    }

    carregarAtendimentosEquipe();
  }, [
    abaRelatorio,
    id,
    token,
  ]);

  if (carregando) {
  return (
      <div
        style={{
          padding: 30,
          fontFamily:
            BODY_FONT,
        }}
      >
        Carregando diagnóstico...
      </div>
    );
  }

  if (
    erro ||
    !item
  ) {
    return (
      <div
        style={{
          minHeight:
            "100vh",

          background:
            BG,

          padding:
            24,

          fontFamily:
            BODY_FONT,
        }}
      >
        <Botao
          secundario
          onClick={
            onVoltar
          }
        >
          <ArrowLeft
            size={15}
          />

          Voltar
        </Botao>

        <div
          style={{
            marginTop:
              16,

            background:
              "#FAECE7",

            color:
              "#993C1D",

            padding:
              15,

            borderRadius:
              10,
          }}
        >
          {erro ||
            "Diagnóstico não encontrado."}
        </div>
      </div>
    );
  }

  const participante =
    item.participante ||
    {};

  const empresa =
    item.empresa ||
    {};

  const resultado =
    item.resultado ||
    {};

  const perfilDiagnostico =
    item.perfil ||
    item?.dadosCompletos?.perfil ||
    {};

  // Diagnóstico V2 completo. O Admin continua exibindo o mesmo
  // relatório visual, mas passa a consumir os novos motores.
  const resultadoCompleto =
    resultado.resultadoCompleto ||
    {};

  const diagnosticoGeral =
    resultado.diagnosticoGeral ||
    {
      resumoExecutivo:
        resultadoCompleto.leituraExecutiva ||
        "",

      principaisDores:
        resultadoCompleto.doresPrincipais ||
        [],

      pontosFortes:
        resultadoCompleto.pontosFortes ||
        [],

      prioridadesImediatas:
        resultadoCompleto.prioridades ||
        [],

      oportunidades:
        resultadoCompleto.recomendacoes ||
        [],

      causasProvaveis:
        resultadoCompleto.causasProvaveis ||
        [],

      impactos:
        resultadoCompleto.impactos ||
        [],

      proximosPassos:
        resultadoCompleto.proximosPassos ||
        [],

      alertaEstrategico:
        Array.isArray(
          resultadoCompleto.riscosPrioritarios
        ) &&
        resultadoCompleto.riscosPrioritarios.length
          ? resultadoCompleto.riscosPrioritarios[0]
          : "",
    };

  // =====================================================
  // DOSSIÊ CONSULTIVO FINDER
  // =====================================================

  const plano90Dias =
    resultado.plano90Dias ||
    resultadoCompleto.plano90Dias ||
    null;

  const quickWins =
    (
      Array.isArray(
        resultado.quickWins
      ) &&
      resultado.quickWins.length
        ? resultado.quickWins
        : resultadoCompleto.quickWins
    ) || [];

  const kpisRecomendados =
    (
      Array.isArray(
        resultado.kpisRecomendados
      ) &&
      resultado.kpisRecomendados.length
        ? resultado.kpisRecomendados
        : resultadoCompleto.indicadores
    ) || [];

  const perguntasAprofundamento =
    (
      Array.isArray(
        resultado.perguntasAprofundamento
      ) &&
      resultado.perguntasAprofundamento.length
        ? resultado.perguntasAprofundamento
        : resultadoCompleto.informacoesFaltantes
    ) || [];

  const visaoAdministracaoV2 =
    resultadoCompleto.visaoAdministracao ||
    {};

  const visaoConsultor =
    resultado.visaoConsultor ||
    visaoAdministracaoV2.aprofundamentos ||
    null;

  const visaoComercial =
    resultado.visaoComercial ||
    visaoAdministracaoV2.oportunidades ||
    null;

  const lacunasDiagnostico =
    (
      Array.isArray(
        resultado.lacunasDiagnostico
      ) &&
      resultado.lacunasDiagnostico.length
        ? resultado.lacunasDiagnostico
        : resultadoCompleto.informacoesFaltantes
    ) || [];

  const oportunidadesConsultoria =
    (
      Array.isArray(
        resultado.oportunidadesConsultoria
      ) &&
      resultado.oportunidadesConsultoria.length
        ? resultado.oportunidadesConsultoria
        : visaoAdministracaoV2.oportunidades
    ) || [];

  // COMPLEMENTO — inteligência tributária
  const inteligenciaTributaria =
    resultado.inteligenciaTributaria ||
    null;

  const perguntas =
    normalizarLista(
      item.perguntasRespostas
    );

  const areasV2 =
    normalizarLista(
      resultadoCompleto.eixos
    ).map(
      (eixo) => ({
        area:
          eixo.label ||
          tituloChave(
            eixo.id ||
            "Área"
          ),

        areaId:
          eixo.id ||
          "",

        score:
          eixo.score,

        nivel:
          eixo.nivel ||
          "",

        resumo:
          resumoSeguro(
            eixo.resumo ||
            eixo.leitura ||
            ""
          ),

        achados:
          normalizarLista(
            eixo.achados
          ),

        causasProvaveis:
          [],

        riscos:
          normalizarLista(
            eixo.riscos
          ),

        pontosFortes:
          normalizarLista(
            eixo.pontosFortes
          ),

        recomendacoes:
          normalizarLista(
            eixo.recomendacoes
          ),
      })
    );

  const areasLegadas =
    normalizarLista(
      resultado.areas
    );

  const mapaAreasV2 =
    areasV2.reduce(
      (acc, area) => {
        const chaves = [
          area.areaId,
          area.area,
          areaCanonica(
            area.area
          ),
        ].filter(Boolean);

        chaves.forEach(
          (chave) => {
            acc[
              String(chave)
            ] = area;
          }
        );

        return acc;
      },
      {}
    );

  // Mescla o score calculado no frontend com o conteúdo consultivo
  // produzido pelo novo motor. O conteúdo V2 tem prioridade.
  const areasMescladas =
    areasLegadas.length
      ? areasLegadas.map(
          (areaAntiga) => {
            const chaveId =
              areaAntiga.areaId ||
              areaAntiga.id ||
              "";

            const chaveNome =
              areaAntiga.area ||
              "";

            const areaV2 =
              mapaAreasV2[
                chaveId
              ] ||
              mapaAreasV2[
                chaveNome
              ] ||
              mapaAreasV2[
                areaCanonica(
                  chaveNome
                )
              ] ||
              null;

            if (!areaV2) {
              return areaAntiga;
            }

            return {
              ...areaAntiga,
              ...areaV2,

              // preserva score do questionário quando houver
              score:
                areaAntiga.score ??
                areaV2.score,

              nivel:
                areaV2.nivel ||
                areaAntiga.nivel ||
                "",

              resumo:
                resumoSeguro(
                  areaV2.resumo
                ) ||
                resumoSeguro(
                  areaAntiga.resumo
                ) ||
                "",

              achados:
                normalizarLista(
                  areaV2.achados
                ).length
                  ? areaV2.achados
                  : normalizarLista(
                      areaAntiga.achados
                    ),

              riscos:
                normalizarLista(
                  areaV2.riscos
                ).length
                  ? areaV2.riscos
                  : normalizarLista(
                      areaAntiga.riscos
                    ),

              pontosFortes:
                normalizarLista(
                  areaV2.pontosFortes
                ).length
                  ? areaV2.pontosFortes
                  : normalizarLista(
                      areaAntiga.pontosFortes
                    ),

              recomendacoes:
                normalizarLista(
                  areaV2.recomendacoes
                ).length
                  ? areaV2.recomendacoes
                  : normalizarLista(
                      areaAntiga.recomendacoes
                    ),
            };
          }
        )
      : areasV2.length
      ? areasV2
      : normalizarLista(
          item.areas
        );

  // Inclui eixos V2 que não existiam no formato antigo.
  const idsMesclados =
    new Set(
      areasMescladas
        .map(
          (area) =>
            area.areaId ||
            area.id ||
            area.area
        )
        .filter(Boolean)
        .map(String)
    );

  const areas =
    [
      ...areasMescladas,
      ...areasV2.filter(
        (area) =>
          !idsMesclados.has(
            String(
              area.areaId ||
              area.area
            )
          )
      ),
    ];

  const dores =
    normalizarLista(
      item.dores
    );

  const score =
    scoreInfo(
      item.score
    );

  const estruturaAtual =
    estruturaDiagnostico(
      item
    );

  const estruturaAtualLabel =
    labelEstruturaDiagnostico(
      estruturaAtual
    );

  const estruturaAtualCor =
    corEstruturaDiagnostico(
      estruturaAtual
    );

  const areasEquipeDisponiveis =
    [
      ...new Set(
        atendimentosEquipe
          .map(
            (atendimento) =>
              atendimento.area
          )
          .filter(Boolean)
      ),
    ];

  const atendimentoEquipeSelecionado =
    atendimentosEquipe.find(
      (atendimento) =>
        atendimento.area ===
        areaEquipe
    ) ||
    atendimentosEquipe[0] ||
    null;

  const perguntasEquipe =
    perguntas.filter(
      (pergunta) =>
        areaCanonica(
          pergunta.area ||
          pergunta.areaId
        ) ===
        areaCanonica(
          atendimentoEquipeSelecionado?.area
        )
    );

  function labelsDiagnosticoEstrutura(
    estrutura
  ) {
    if (
      estrutura ===
      "pessoa_fisica"
    ) {
      return {
        titulo:
          "Diagnóstico da vida financeira",
        achados:
          "O que suas respostas mostram",
        causas:
          "Fatores que explicam o cenário",
        riscos:
          "Pontos de atenção",
        fortes:
          "Pontos positivos",
        recomendacoes:
          "Próximos passos recomendados",
      };
    }

    if (
      estrutura ===
      "holding"
    ) {
      return {
        titulo:
          "Diagnóstico patrimonial por frente",
        achados:
          "Achados patrimoniais",
        causas:
          "Fatores estruturais",
        riscos:
          "Riscos / pontos de atenção",
        fortes:
          "Pontos fortes da estrutura",
        recomendacoes:
          "Recomendações patrimoniais",
      };
    }

    if (
      estrutura ===
      "avaliar_holding"
    ) {
      return {
        titulo:
          "Avaliação por fator de viabilidade",
        achados:
          "O que identificamos",
        causas:
          "Fatores relevantes",
        riscos:
          "Pontos contrários / atenção",
        fortes:
          "Fatores favoráveis",
        recomendacoes:
          "Próximas validações",
      };
    }

    if (
      estrutura ===
      "grupo"
    ) {
      return {
        titulo:
          "Diagnóstico consolidado do grupo",
        achados:
          "Achados do grupo",
        causas:
          "Origem / causas prováveis",
        riscos:
          "Riscos do grupo",
        fortes:
          "Pontos fortes",
        recomendacoes:
          "Recomendações para o grupo",
      };
    }

    if (
      estrutura ===
      "spe"
    ) {
      return {
        titulo:
          "Diagnóstico do projeto / SPE",
        achados:
          "Achados do projeto",
        causas:
          "Fatores que afetam o projeto",
        riscos:
          "Riscos do projeto",
        fortes:
          "Pontos favoráveis",
        recomendacoes:
          "Ações recomendadas",
      };
    }

    return {
      titulo:
        "Diagnóstico por área",
      achados:
        "Achados",
      causas:
        "Causas prováveis",
      riscos:
        "Riscos",
      fortes:
        "Pontos fortes",
      recomendacoes:
        "Recomendações",
    };
  }

  const labelsDiagnostico =
    labelsDiagnosticoEstrutura(
      estruturaAtual
    );

  const areaClientePorNome =
    areas.reduce(
      (acc, area) => {
        if (area?.area) {
          acc[
            area.area
          ] = area;

          acc[
            areaCanonica(
              area.area
            )
          ] = area;
        }

        if (area?.areaId) {
          acc[
            area.areaId
          ] = area;
        }

        return acc;
      },
      {}
    );

  const areaEquipeDiagnostico =
    atendimentoEquipeSelecionado
      ? (
          areaClientePorNome[
            atendimentoEquipeSelecionado.area
          ] ||
          areaClientePorNome[
            areaCanonica(
              atendimentoEquipeSelecionado.area
            )
          ] ||
          null
        )
      : null;

  function gerarPdfDiagnostico() {
    const relatorio =
      document.getElementById(
        "relatorio-diagnostico-pdf"
      );

    if (!relatorio) {
      window.alert(
        "Não foi possível localizar o relatório para gerar o PDF."
      );
      return;
    }

    const nomeArquivoBase =
      estruturaAtual === "pessoa_fisica"
        ? participante.nome ||
          "Pessoa Fisica"
        : empresa.razaoSocial ||
          participante.nome ||
          "Diagnostico";

    const tipoRelatorio =
      abaRelatorio === "administracao"
        ? "Administracao"
        : abaRelatorio === "cliente"
        ? "Cliente"
        : "Equipe";

    const tituloDocumento =
      `${nomeArquivoBase} - Relatorio ${tipoRelatorio}`
        .replace(
          /[\\/:*?"<>|]+/g,
          "-"
        );

    const janela =
      window.open(
        "",
        "_blank",
        "width=1100,height=850"
      );

    if (!janela) {
      window.alert(
        "O navegador bloqueou a janela do PDF. Libere pop-ups para este site e tente novamente."
      );
      return;
    }

    janela.document.open();

    janela.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width,initial-scale=1"
          />
          <title>${tituloDocumento}</title>

          <style>
            @page {
              size: A4;
              margin: 13mm;
            }

            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              background: #FFFFFF;
              color: #17233D;
              font-family:
                -apple-system,
                BlinkMacSystemFont,
                "Segoe UI",
                Roboto,
                Arial,
                sans-serif;
            }

            body {
              font-size: 11px;
              line-height: 1.45;
            }

            #pdf-shell {
              width: 100%;
              max-width: none;
            }

            button,
            select,
            input,
            textarea {
              display: none !important;
            }

            a {
              color: inherit !important;
              text-decoration: none !important;
            }

            h1,
            h2,
            h3 {
              break-after: avoid;
              page-break-after: avoid;
            }

            ul,
            ol {
              padding-left: 18px;
            }

            [style*="position: sticky"],
            [style*="position:fixed"],
            [style*="position: fixed"] {
              position: static !important;
            }

            [style*="box-shadow"] {
              box-shadow: none !important;
            }

            [style*="grid-template-columns"] {
              max-width: 100% !important;
            }

            div {
              max-width: 100%;
            }

            @media print {
              .nao-imprimir {
                display: none !important;
              }

              body {
                background: #FFFFFF !important;
              }
            }
          </style>
        </head>

        <body>
          <div id="pdf-shell">
            ${relatorio.outerHTML}
          </div>

          <script>
            window.onload = function () {
              setTimeout(function () {
                window.focus();
                window.print();
              }, 350);
            };
          <\/script>
        </body>
      </html>
    `);

    janela.document.close();
  }


  return (
    <div
      style={{
        minHeight:
          "100vh",

        background:
          BG,

        fontFamily:
          BODY_FONT,

        color:
          NAVY,
      }}
    >
      <header
        style={{
          background:
            NAVY,

          padding:
            "17px 24px",

          color:
            WHITE,
        }}
      >
        <div
          style={{
            maxWidth:
              1180,

            margin:
              "0 auto",

            display:
              "flex",

            justifyContent:
              "space-between",

            alignItems:
              "center",

            gap:
              15,
          }}
        >
          <Botao
            secundario
            onClick={
              onVoltar
            }
          >
            <ArrowLeft
              size={15}
            />

            Diagnósticos
          </Botao>

          <span
            style={{
              fontSize:
                11,

              opacity:
                0.75,
            }}
          >
            {formatarData(
              item.criadoEm
            )}
          </span>
        </div>
      </header>

      <main
        id="relatorio-diagnostico-pdf"
        style={{
          maxWidth:
            1180,

          margin:
            "0 auto",

          padding:
            "24px 20px 60px",
        }}
      >
        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "minmax(0,1fr) 170px",

            gap:
              14,

            marginBottom:
              16,
          }}
        >
          <Card>
            <div
              style={{
                fontSize:
                  11,

                color:
                  CORAL,

                fontWeight:
                  800,

                marginBottom:
                  6,
              }}
            >
              {estruturaAtual === "pessoa_fisica"
                ? "DIAGNÓSTICO FINANCEIRO PESSOAL"
                : estruturaAtual === "avaliar_holding"
                ? "AVALIAÇÃO DE VIABILIDADE DE HOLDING"
                : estruturaAtual === "holding"
                ? "DIAGNÓSTICO PATRIMONIAL / HOLDING"
                : estruturaAtual === "grupo"
                ? "DIAGNÓSTICO DO GRUPO EMPRESARIAL"
                : estruturaAtual === "spe"
                ? "DIAGNÓSTICO DA SPE"
                : "DIAGNÓSTICO EMPRESARIAL"}
            </div>

            <h1
              style={{
                fontFamily:
                  DISPLAY_FONT,

                fontSize:
                  28,

                margin:
                  "0 0 7px",
              }}
            >
              {estruturaAtual === "pessoa_fisica"
                ? participante.nome ||
                  "Pessoa Física"
                : estruturaAtual === "avaliar_holding"
                ? empresa.razaoSocial ||
                  "Avaliação de Holding"
                : estruturaAtual === "grupo"
                ? perfilDiagnostico?.grupo?.nomeGrupo ||
                  empresa.razaoSocial ||
                  "Grupo empresarial"
                : estruturaAtual === "spe"
                ? perfilDiagnostico?.spe?.nomeProjeto ||
                  empresa.razaoSocial ||
                  "SPE"
                : empresa.razaoSocial ||
                  "Empresa"}
            </h1>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                background:
                  estruturaAtualCor.bg,
                color:
                  estruturaAtualCor.color,
                borderRadius: 20,
                padding:
                  "4px 8px",
                fontSize: 9.5,
                fontWeight: 900,
                marginBottom: 8,
              }}
            >
              ESTRUTURA ·{" "}
              {estruturaAtualLabel}
            </div>

            <div
              style={{
                color:
                  MUTED,

                fontSize:
                  12,

                lineHeight:
                  1.6,
              }}
            >
              {empresa.cnpj
                ? formatarCnpj(
                    empresa.cnpj
                  )
                : ""}

              {empresa.segmento
                ? `${empresa.cnpj ? " · " : ""}${empresa.segmento}`
                : ""}

              {empresa.subsegmento
                ? ` · ${empresa.subsegmento}`
                : ""}
            </div>
          </Card>

          <Card
            style={{
              background:
                score.bg,

              textAlign:
                "center",
            }}
          >
            <div
              style={{
                fontSize:
                  38,

                fontWeight:
                  900,

                color:
                  score.color,
              }}
            >
              {item.score ??
                "-"}
            </div>

            <div
              style={{
                fontSize:
                  11,

                color:
                  score.color,

                fontWeight:
                  700,
              }}
            >
              {score.label}
            </div>
          </Card>
        </div>

        <Card
          style={{
            padding: 10,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <Botao
              secundario={
                abaRelatorio !==
                "administracao"
              }
              onClick={() =>
                setAbaRelatorio(
                  "administracao"
                )
              }
            >
              <Building2 size={14} />
              Relatório Administração
            </Botao>

            <Botao
              secundario={
                abaRelatorio !==
                "cliente"
              }
              onClick={() =>
                setAbaRelatorio(
                  "cliente"
                )
              }
            >
              <Users size={14} />
              Relatório Cliente
            </Botao>

            <Botao
              secundario={
                abaRelatorio !==
                "equipe"
              }
              onClick={() =>
                setAbaRelatorio(
                  "equipe"
                )
              }
            >
              <Users size={14} />
              Relatório Equipe
            </Botao>

            <Botao
              onClick={
                gerarPdfDiagnostico
              }
              style={{
                marginLeft: "auto",
              }}
            >
              <Download size={14} />
              Gerar PDF deste relatório
            </Botao>
          </div>
        </Card>

        <ResumoEstruturaSelecionada
          estrutura={estruturaAtual}
          perfil={perfilDiagnostico}
          resultado={resultado}
        />

        {abaRelatorio === "administracao" && (
          <>
        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(auto-fit,minmax(230px,1fr))",

            gap:
              12,

            marginBottom:
              18,
          }}
        >
          <Card>
            <Users
              size={18}
              color={CORAL}
            />

            <h3>
              Participante
            </h3>

            <p>
              <strong>
                {participante.nome ||
                  "-"}
              </strong>

              <br />

              {participante.cargo ||
                "-"}

              <br />

              {participante.email ||
                "-"}

              <br />

              {participante.telefone ||
                "-"}
            </p>
          </Card>

          <Card>
            <Target
              size={18}
              color={CORAL}
            />

            <h3>
              Estrutura
            </h3>

            <p>
              <strong>
                {estruturaAtualLabel}
              </strong>
            </p>
          </Card>

          <Card>
            <Building2
              size={18}
              color={CORAL}
            />

            <h3>
              {estruturaAtual ===
              "pessoa_fisica"
                ? "Contexto pessoal"
                : estruturaAtual ===
                    "holding" ||
                  estruturaAtual ===
                    "avaliar_holding"
                ? "Estrutura patrimonial"
                : estruturaAtual ===
                    "grupo"
                ? "Contexto do grupo"
                : estruturaAtual ===
                    "spe"
                ? "Contexto do projeto"
                : "Negócio"}
            </h3>

            <p>
              {empresa.descricaoNegocio ||
                "Descrição não registrada."}
            </p>
          </Card>

          <Card>
            <Target
              size={18}
              color={CORAL}
            />

            <h3>
              Dores declaradas
            </h3>

            {dores.length ? (
              <ul
                style={{
                  paddingLeft:
                    18,

                  marginBottom:
                    0,
                }}
              >
                {dores.map(
                  (
                    dor,
                    index
                  ) => (
                    <li
                      key={`${dor}-${index}`}
                    >
                      {dor}
                    </li>
                  )
                )}
              </ul>
            ) : (
              <p>
                Nenhuma dor registrada.
              </p>
            )}
          </Card>
        </div>

        {diagnosticoGeral
          .resumoExecutivo && (
          <>
            <h2
              style={
                tituloSecao
              }
            >
              Resumo executivo
            </h2>

            <Card>
              <p
                style={{
                  margin:
                    0,

                  lineHeight:
                    1.65,
                }}
              >
                {
                  diagnosticoGeral
                    .resumoExecutivo
                }
              </p>
            </Card>
          </>
        )}

        {estruturaAtual === "avaliar_holding" &&
          resultadoCompleto?.viabilidadeHolding && (
          <>
            <h2 style={tituloSecao}>
              Viabilidade preliminar da Holding
            </h2>

            <Card
              style={{
                borderLeft: `4px solid ${CORAL}`,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "170px minmax(0,1fr)",
                  gap: 14,
                  alignItems: "start",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 9.5,
                      color: MUTED,
                      fontWeight: 800,
                      marginBottom: 4,
                    }}
                  >
                    NÍVEL
                  </div>

                  <strong
                    style={{
                      fontSize: 20,
                      color: NAVY,
                    }}
                  >
                    {resultadoCompleto
                      .viabilidadeHolding
                      .nivel ||
                      "DADOS_INSUFICIENTES"}
                  </strong>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(200px,1fr))",
                    gap: 10,
                  }}
                >
                  <ListaInterna
                    titulo="Fatores favoráveis"
                    itens={
                      resultadoCompleto
                        .viabilidadeHolding
                        .fatoresFavoraveis
                    }
                  />

                  <ListaInterna
                    titulo="Fatores contrários / atenção"
                    itens={
                      resultadoCompleto
                        .viabilidadeHolding
                        .fatoresContrarios
                    }
                  />

                  <ListaInterna
                    titulo="Dados necessários"
                    itens={
                      resultadoCompleto
                        .viabilidadeHolding
                        .dadosNecessarios
                    }
                  />

                  <ListaInterna
                    titulo="Estruturas possíveis"
                    itens={
                      resultadoCompleto
                        .viabilidadeHolding
                        .estruturasPossiveis
                    }
                  />
                </div>
              </div>
            </Card>
          </>
        )}

        {diagnosticoGeral
          .alertaEstrategico && (
          <>
            <h2
              style={
                tituloSecao
              }
            >
              Alerta estratégico
            </h2>

            <Card
              style={{
                background:
                  "#FAEEDA",

                color:
                  "#70410A",
              }}
            >
              {
                diagnosticoGeral
                  .alertaEstrategico
              }
            </Card>
          </>
        )}

        {inteligenciaTributaria?.disponivel && (
          <>
            <h2 style={tituloSecao}>
              Inteligência tributária
            </h2>

            <Card
              style={{
                border: "1px solid #D8DEEA",
                background: "#FBFCFE",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(180px,1fr))",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    background: WHITE,
                    border: "1px solid #E3E7EF",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: MUTED,
                      marginBottom: 4,
                    }}
                  >
                    FATURAMENTO DE REFERÊNCIA
                  </div>

                  <strong
                    style={{
                      fontSize: 18,
                    }}
                  >
                    {Number(
                      inteligenciaTributaria
                        .faturamentoMensalReferencia
                    ).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                      maximumFractionDigits: 0,
                    })}
                  </strong>

                  <div
                    style={{
                      fontSize: 10,
                      color: MUTED,
                      marginTop: 3,
                    }}
                  >
                    por mês
                  </div>
                </div>

                <div
                  style={{
                    background: WHITE,
                    border: "1px solid #E3E7EF",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: MUTED,
                      marginBottom: 4,
                    }}
                  >
                    TRIBUTOS ESTIMADOS
                  </div>

                  <strong
                    style={{
                      fontSize: 18,
                    }}
                  >
                    {Number(
                      inteligenciaTributaria
                        .tributosMensaisEstimados
                    ).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                      maximumFractionDigits: 0,
                    })}
                  </strong>

                  <div
                    style={{
                      fontSize: 10,
                      color: MUTED,
                      marginTop: 3,
                    }}
                  >
                    por mês
                  </div>
                </div>

                <div
                  style={{
                    background: "#FFF3EF",
                    border: "1px solid #F0C8BD",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#993C1D",
                      marginBottom: 4,
                    }}
                  >
                    CARGA TRIBUTÁRIA ESTIMADA
                  </div>

                  <strong
                    style={{
                      fontSize: 25,
                      color: "#993C1D",
                    }}
                  >
                    {Number(
                      inteligenciaTributaria
                        .cargaTributariaEstimada
                    ).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    %
                  </strong>
                </div>

                <div
                  style={{
                    background: WHITE,
                    border: "1px solid #E3E7EF",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: MUTED,
                      marginBottom: 4,
                    }}
                  >
                    PROJEÇÃO ANUAL DE TRIBUTOS
                  </div>

                  <strong
                    style={{
                      fontSize: 18,
                    }}
                  >
                    {Number(
                      inteligenciaTributaria
                        .tributosAnuaisEstimados
                    ).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                      maximumFractionDigits: 0,
                    })}
                  </strong>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(230px,1fr))",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <ListaInterna
                  titulo="Base da estimativa"
                  itens={[
                    `Regime informado: ${
                      inteligenciaTributaria.regime || "-"
                    }`,
                    `Segmento: ${
                      inteligenciaTributaria.segmento || "-"
                    }`,
                    `Categoria: ${
                      inteligenciaTributaria.categoria || "-"
                    }`,
                    `Faixa de faturamento: ${
                      inteligenciaTributaria.faturamentoFaixa || "-"
                    }`,
                    `Confiabilidade: ${
                      inteligenciaTributaria.confiabilidade ||
                      "Referencial"
                    }`,
                  ]}
                />

                <ListaInterna
                  titulo="Critério"
                  itens={[
                    inteligenciaTributaria.criterio ||
                      "Estimativa gerencial.",
                  ]}
                />
              </div>

              <div
                style={{
                  background: "#17233D",
                  color: WHITE,
                  borderRadius: 12,
                  padding: 15,
                  marginTop: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "#FFB7A7",
                    fontWeight: 900,
                    letterSpacing: 0.7,
                    marginBottom: 4,
                  }}
                >
                  REFORMA TRIBUTÁRIA · IMPACTO SETORIAL
                </div>

                <div
                  style={{
                    fontSize: 19,
                    fontWeight: 800,
                    marginBottom: 8,
                  }}
                >
                  {inteligenciaTributaria.reforma?.status ||
                    "A avaliar"}
                </div>

                <p
                  style={{
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: "#E4E9F2",
                    margin: "0 0 10px",
                  }}
                >
                  {inteligenciaTributaria.reforma
                    ?.tratamentoSetorial ||
                    "Tratamento setorial não classificado."}
                </p>

                <p
                  style={{
                    fontSize: 11.5,
                    lineHeight: 1.55,
                    color: "#CDD4E0",
                    margin: 0,
                  }}
                >
                  <strong>Fase 2026:</strong>{" "}
                  {inteligenciaTributaria.reforma
                    ?.fase2026 || "-"}
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(220px,1fr))",
                  gap: 10,
                  marginTop: 12,
                }}
              >
                <ListaInterna
                  titulo="Fatores favoráveis"
                  itens={
                    inteligenciaTributaria.reforma
                      ?.fatoresFavoraveis
                  }
                />

                <ListaInterna
                  titulo="Fatores de atenção"
                  itens={
                    inteligenciaTributaria.reforma
                      ?.fatoresAtencao
                  }
                />

                <ListaInterna
                  titulo="O que validar antes da conclusão"
                  itens={
                    inteligenciaTributaria.reforma
                      ?.pontosValidar
                  }
                />
              </div>

              <div
                style={{
                  marginTop: 12,
                  background: "#FFF3EF",
                  borderLeft: `4px solid ${CORAL}`,
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <strong
                  style={{
                    display: "block",
                    fontSize: 11,
                    color: "#993C1D",
                    marginBottom: 5,
                  }}
                >
                  OPORTUNIDADE CONSULTIVA FINDER
                </strong>

                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.55,
                  }}
                >
                  {inteligenciaTributaria.reforma
                    ?.oportunidadeFinder ||
                    "Avaliar necessidade de planejamento tributário individualizado."}
                </div>
              </div>

              <p
                style={{
                  fontSize: 10,
                  color: MUTED,
                  lineHeight: 1.45,
                  margin: "12px 0 0",
                  fontStyle: "italic",
                }}
              >
                A carga apresentada é estimativa gerencial e não corresponde
                à apuração fiscal definitiva. O impacto da Reforma Tributária
                deve ser validado com faturamento real, composição das
                receitas, créditos, custos, perfil de clientes e enquadramento
                legal das operações.
              </p>
            </Card>
          </>
        )}

        <h2
          style={
            tituloSecao
          }
        >
          {labelsDiagnostico.titulo}
        </h2>

        {areas.length ===
        0 ? (
          <Card>
            Nenhuma análise por área registrada.
          </Card>
        ) : (
          <div
            style={{
              display:
                "flex",

              flexDirection:
                "column",

              gap:
                12,
            }}
          >
            {areas.map(
              (
                area,
                index
              ) => {
                const info =
                  scoreInfo(
                    area.score
                  );

                return (
                  <Card
                    key={
                      index
                    }
                  >
                    <div
                      style={{
                        display:
                          "flex",

                        justifyContent:
                          "space-between",

                        gap:
                          15,

                        marginBottom:
                          10,
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            margin:
                              "0 0 4px",
                          }}
                        >
                          {area.area ||
                            "Área"}
                        </h3>

                        <div
                          style={{
                            fontSize:
                              10,

                            color:
                              MUTED,
                          }}
                        >
                          {info.label}
                        </div>
                      </div>

                      <div
                        style={{
                          background:
                            info.bg,

                          color:
                            info.color,

                          padding:
                            "7px 10px",

                          borderRadius:
                            10,

                          fontWeight:
                            800,
                        }}
                      >
                        {typeof area.score === "number" ||
                        typeof area.score === "string"
                          ? area.score
                          : "-"}
                      </div>
                    </div>

                    {resumoSeguro(
                      area.resumo
                    ) && (
                      <p
                        style={{
                          lineHeight:
                            1.55,
                        }}
                      >
                        {resumoSeguro(
                          area.resumo
                        )}
                      </p>
                    )}

                    <div
                      style={{
                        display:
                          "grid",

                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(210px,1fr))",

                        gap:
                          10,
                      }}
                    >
                      <ListaInterna
                        titulo={
                          labelsDiagnostico
                            .achados
                        }
                        itens={
                          area.achados
                        }
                      />

                      {normalizarLista(
                        area.causasProvaveis
                      ).length > 0 && (
                        <ListaInterna
                          titulo={
                            labelsDiagnostico
                              .causas
                          }
                          itens={
                            area.causasProvaveis
                          }
                        />
                      )}

                      <ListaInterna
                        titulo={
                          labelsDiagnostico
                            .riscos
                        }
                        itens={
                          area.riscos
                        }
                      />

                      {normalizarLista(
                        area.pontosFortes
                      ).length > 0 && (
                        <ListaInterna
                          titulo={
                            labelsDiagnostico
                              .fortes
                          }
                          itens={
                            area.pontosFortes
                          }
                        />
                      )}

                      <ListaInterna
                        titulo={
                          labelsDiagnostico
                            .recomendacoes
                        }
                        itens={
                          area.recomendacoes
                        }
                      />
                    </div>
                  </Card>
                );
              }
            )}
          </div>
        )}

        {/* ================================================= */}
        {/* DOSSIÊ CONSULTIVO FINDER - SOMENTE ADMIN */}
        {/* ================================================= */}

        <div
          style={{
            marginTop: 34,
            paddingTop: 8,
            borderTop: "3px solid #17233D",
          }}
        >
          <div
            style={{
              color: CORAL,
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 0.8,
              marginTop: 18,
            }}
          >
            USO INTERNO · FINDER OF SOLUTIONS
          </div>

          <h2
            style={{
              ...tituloSecao,
              fontSize: 25,
              marginTop: 6,
              marginBottom: 5,
            }}
          >
            {estruturaAtual === "pessoa_fisica"
              ? "Plano consultivo pessoal"
              : estruturaAtual === "holding" ||
                estruturaAtual === "avaliar_holding"
              ? "Dossiê patrimonial e sucessório"
              : estruturaAtual === "grupo"
              ? "Dossiê consolidado do grupo"
              : estruturaAtual === "spe"
              ? "Dossiê do projeto / SPE"
              : "Dossiê consultivo"}
          </h2>

          <p
            style={{
              margin: "0 0 18px",
              color: MUTED,
              fontSize: 12,
              lineHeight: 1.55,
            }}
          >
            Camada interna para condução da reunião, validação das hipóteses,
            priorização da execução e definição da oportunidade comercial.
          </p>
        </div>

        <BlocoDossie
          titulo={`Plano de ação — 30 / 60 / 90 dias · ${estruturaAtualLabel}`}
          destaque
        >
          <Plano90Dias plano={plano90Dias} />
        </BlocoDossie>

        <BlocoDossie titulo="Quick wins">
          <ListaDossie itens={quickWins} vazio="Nenhum quick win gerado." />
        </BlocoDossie>

        <BlocoDossie titulo="KPIs recomendados">
          <ListaDossie itens={kpisRecomendados} vazio="Nenhum KPI recomendado." />
        </BlocoDossie>

        <BlocoDossie titulo="Visão do consultor" destaque>
          <ListaDossie itens={visaoConsultor} vazio="Visão do consultor não gerada." />
        </BlocoDossie>

        <BlocoDossie titulo="Perguntas para aprofundamento">
          <ListaDossie
            itens={perguntasAprofundamento}
            vazio="Nenhuma pergunta de aprofundamento gerada."
          />
        </BlocoDossie>

        <BlocoDossie titulo="Visão comercial Finder">
          <ListaDossie itens={visaoComercial} vazio="Visão comercial não gerada." />
        </BlocoDossie>

        {listaFlexivel(lacunasDiagnostico).length > 0 && (
          <BlocoDossie titulo="Lacunas do diagnóstico">
            <ListaDossie itens={lacunasDiagnostico} />
          </BlocoDossie>
        )}

        {listaFlexivel(oportunidadesConsultoria).length > 0 && (
          <BlocoDossie titulo="Oportunidades de consultoria">
            <ListaDossie itens={oportunidadesConsultoria} />
          </BlocoDossie>
        )}

        <h2
          style={
            tituloSecao
          }
        >
          Perguntas e respostas
        </h2>

        <Card
          style={{
            padding:
              0,

            overflowX:
              "auto",
          }}
        >
          <table
            style={{
              width:
                "100%",

              borderCollapse:
                "collapse",

              minWidth:
                820,
            }}
          >
            <thead>
              <tr>
                <th
                  style={
                    thStyle
                  }
                >
                  Área
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Tema
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Pergunta
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Resposta
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Peso
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Importância
                </th>
              </tr>
            </thead>

            <tbody>
              {perguntas.length ? (
                perguntas.map(
                  (
                    pergunta,
                    index
                  ) => (
                    <tr
                      key={
                        index
                      }
                    >
                      <td
                        style={
                          tdStyle
                        }
                      >
                        {pergunta.area ||
                          "-"}
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {pergunta.tema ||
                          "-"}
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {pergunta.pergunta ||
                          "-"}
                      </td>

                      <td
                        style={{
                          ...tdStyle,

                          fontWeight:
                            800,
                        }}
                      >
                        {pergunta.resposta ||
                          "-"}
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {pergunta.peso ??
                          "-"}
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {pergunta.importancia ??
                          "-"}
                      </td>
                    </tr>
                  )
                )
              ) : (
                <tr>
                  <td
                    colSpan="6"
                    style={{
                      ...tdStyle,

                      textAlign:
                        "center",
                    }}
                  >
                    Nenhuma pergunta armazenada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
          </>
        )}

        {abaRelatorio === "cliente" && (
          <div>
            <div
              style={{
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: CORAL,
                  fontWeight: 900,
                  letterSpacing: 0.7,
                  marginBottom: 5,
                }}
              >
                RELATÓRIO CONSULTIVO
              </div>

              <h2
                style={{
                  ...tituloSecao,
                  marginTop: 0,
                  fontSize: 24,
                }}
              >
                Visão completa para apresentação ao cliente
              </h2>

              <p
                style={{
                  margin: "0 0 12px",
                  color: MUTED,
                  fontSize: 12,
                  lineHeight: 1.55,
                }}
              >
                Esta visão apresenta o diagnóstico técnico e consultivo,
                sem informações comerciais ou estratégicas internas da Finder.
              </p>
            </div>

            {diagnosticoGeral
              .resumoExecutivo && (
              <BlocoDossie titulo="Visão executiva" destaque>
                <p
                  style={{
                    margin: 0,
                    lineHeight: 1.65,
                    fontSize: 12.5,
                  }}
                >
                  {limparTextoRelatorio(
                    diagnosticoGeral
                      .resumoExecutivo
                  )}
                </p>
              </BlocoDossie>
            )}

            {diagnosticoGeral
              .alertaEstrategico && (
              <BlocoDossie titulo="Ponto de atenção estratégico">
                <p
                  style={{
                    margin: 0,
                    lineHeight: 1.6,
                    fontSize: 12.5,
                  }}
                >
                  {limparTextoRelatorio(
                    diagnosticoGeral
                      .alertaEstrategico
                  )}
                </p>
              </BlocoDossie>
            )}

            <h2
              style={
                tituloSecao
              }
            >
              Análise por departamento
            </h2>

            {areas.length === 0 ? (
              <Card>
                Nenhuma análise por área registrada.
              </Card>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection:
                    "column",
                  gap: 12,
                }}
              >
                {areas.map(
                  (
                    area,
                    index
                  ) => {
                    const info =
                      scoreInfo(
                        area.score
                      );

                    return (
                      <Card
                        key={
                          `${area.area}-${index}`
                        }
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            gap: 12,
                            alignItems:
                              "flex-start",
                            marginBottom: 10,
                          }}
                        >
                          <div>
                            <h3
                              style={{
                                margin:
                                  "0 0 3px",
                              }}
                            >
                              {area.area ||
                                "Área"}
                            </h3>

                            <div
                              style={{
                                fontSize:
                                  10,
                                color:
                                  MUTED,
                              }}
                            >
                              {area.nivel ||
                                info.label}
                            </div>
                          </div>

                          <div
                            style={{
                              background:
                                info.bg,
                              color:
                                info.color,
                              borderRadius:
                                10,
                              padding:
                                "7px 10px",
                              fontWeight:
                                900,
                            }}
                          >
                            {area.score ??
                              "-"}
                          </div>
                        </div>

                        {resumoSeguro(
                          area.resumo
                        ) && (
                          <p
                            style={{
                              lineHeight:
                                1.55,
                              margin:
                                "0 0 10px",
                              fontSize:
                                12,
                            }}
                          >
                            {limparTextoRelatorio(
                              resumoSeguro(
                                area.resumo
                              )
                            )}
                          </p>
                        )}

                        <div
                          style={{
                            display:
                              "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit,minmax(220px,1fr))",
                            gap: 10,
                          }}
                        >
                          <ListaInterna
                            titulo="Pontos identificados"
                            itens={
                              limparListaRelatorio(
                                area.achados
                              )
                            }
                          />

                          <ListaInterna
                            titulo="Riscos"
                            itens={
                              limparListaRelatorio(
                                area.riscos
                              )
                            }
                          />

                          {normalizarLista(
                            area.pontosFortes
                          ).length > 0 && (
                            <ListaInterna
                              titulo="Pontos fortes"
                              itens={
                                limparListaRelatorio(
                                  area.pontosFortes
                                )
                              }
                            />
                          )}

                          <ListaInterna
                            titulo="Recomendações"
                            itens={
                              limparListaRelatorio(
                                area.recomendacoes
                              )
                            }
                          />
                        </div>
                      </Card>
                    );
                  }
                )}
              </div>
            )}

            <BlocoDossie
              titulo={`Plano de melhoria — 30 / 60 / 90 dias · ${estruturaAtualLabel}`}
              destaque
            >
              <Plano90Dias
                plano={
                  plano90Dias
                }
              />
            </BlocoDossie>

            {listaFlexivel(
              quickWins
            ).length > 0 && (
              <BlocoDossie titulo="Ações de curto prazo">
                <ListaDossie
                  itens={
                    limparListaRelatorio(
                      quickWins
                    )
                  }
                />
              </BlocoDossie>
            )}

            {listaFlexivel(
              kpisRecomendados
            ).length > 0 && (
              <BlocoDossie titulo="Indicadores recomendados">
                <ListaDossie
                  itens={
                    limparListaRelatorio(
                      kpisRecomendados
                    )
                  }
                />
              </BlocoDossie>
            )}

            {inteligenciaTributaria?.disponivel && (
              <>
                <h2 style={tituloSecao}>
                  Inteligência tributária
                </h2>

                <Card>
                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit,minmax(190px,1fr))",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        background:
                          "#F7F8FB",
                        borderRadius:
                          10,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9.5,
                          color: MUTED,
                          marginBottom: 4,
                        }}
                      >
                        FATURAMENTO DE REFERÊNCIA
                      </div>

                      <strong
                        style={{
                          fontSize: 18,
                        }}
                      >
                        {Number(
                          inteligenciaTributaria
                            .faturamentoMensalReferencia
                        ).toLocaleString(
                          "pt-BR",
                          {
                            style:
                              "currency",
                            currency:
                              "BRL",
                            maximumFractionDigits:
                              0,
                          }
                        )}
                      </strong>
                    </div>

                    <div
                      style={{
                        background:
                          "#FFF3EF",
                        borderRadius:
                          10,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9.5,
                          color:
                            "#993C1D",
                          marginBottom: 4,
                        }}
                      >
                        CARGA TRIBUTÁRIA ESTIMADA
                      </div>

                      <strong
                        style={{
                          fontSize: 22,
                          color:
                            "#993C1D",
                        }}
                      >
                        {Number(
                          inteligenciaTributaria
                            .cargaTributariaEstimada
                        ).toLocaleString(
                          "pt-BR",
                          {
                            minimumFractionDigits:
                              2,
                            maximumFractionDigits:
                              2,
                          }
                        )}
                        %
                      </strong>
                    </div>

                    <div
                      style={{
                        background:
                          "#F7F8FB",
                        borderRadius:
                          10,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9.5,
                          color: MUTED,
                          marginBottom: 4,
                        }}
                      >
                        TRIBUTOS MENSAIS ESTIMADOS
                      </div>

                      <strong
                        style={{
                          fontSize: 18,
                        }}
                      >
                        {Number(
                          inteligenciaTributaria
                            .tributosMensaisEstimados
                        ).toLocaleString(
                          "pt-BR",
                          {
                            style:
                              "currency",
                            currency:
                              "BRL",
                            maximumFractionDigits:
                              0,
                          }
                        )}
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      background:
                        NAVY,
                      color: WHITE,
                      borderRadius: 10,
                      padding: 14,
                    }}
                  >
                    <strong
                      style={{
                        display:
                          "block",
                        marginBottom: 6,
                      }}
                    >
                      Reforma Tributária
                    </strong>

                    <div
                      style={{
                        fontSize: 12,
                        lineHeight: 1.6,
                        color:
                          "#E5EAF3",
                      }}
                    >
                      {inteligenciaTributaria
                        .reforma
                        ?.tratamentoSetorial ||
                        inteligenciaTributaria
                          .reforma
                          ?.status ||
                        "Impacto setorial em avaliação."}
                    </div>
                  </div>

                  <p
                    style={{
                      margin:
                        "12px 0 0",
                      color: MUTED,
                      fontSize: 10,
                      lineHeight: 1.45,
                      fontStyle:
                        "italic",
                    }}
                  >
                    Os valores tributários apresentados são estimativas gerenciais e
                    devem ser validados com dados fiscais e contábeis completos antes
                    de qualquer decisão definitiva.
                  </p>
                </Card>
              </>
            )}
          </div>
        )}

        {abaRelatorio === "equipe" && (
          <div>
            <div
              style={{
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  color: CORAL,
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 0.7,
                  marginBottom: 5,
                }}
              >
                RELATÓRIO TÉCNICO
              </div>

              <h2
                style={{
                  ...tituloSecao,
                  marginTop: 0,
                  fontSize: 24,
                }}
              >
                Visão por departamento
              </h2>

              <p
                style={{
                  margin:
                    "0 0 12px",
                  color: MUTED,
                  fontSize: 12,
                  lineHeight: 1.55,
                }}
              >
                Selecione o departamento para visualizar apenas as informações
                técnicas necessárias ao especialista responsável.
              </p>

              <div
                style={{
                  background: "#FFF3EF",
                  borderLeft:
                    `4px solid ${CORAL}`,
                  borderRadius: 9,
                  padding: 10,
                  marginBottom: 12,
                  fontSize: 10.5,
                  color: "#993C1D",
                  lineHeight: 1.45,
                }}
              >
                Para registrar contatos, andamento, próxima ação e histórico,
                utilize a aba <strong>Atendimentos</strong> do painel.
              </div>
            </div>

            {carregandoEquipe ? (
              <Card>
                Carregando relatório da equipe...
              </Card>
            ) : atendimentosEquipe.length === 0 ? (
              <Card>
                Este diagnóstico ainda não possui atendimentos departamentais vinculados.
              </Card>
            ) : (
              <>
                <Card
                  style={{
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(220px,1fr) minmax(220px,1fr)",
                      gap: 12,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 10,
                          fontWeight: 800,
                          marginBottom: 5,
                        }}
                      >
                        DEPARTAMENTO
                      </label>

                      <select
                        value={
                          atendimentoEquipeSelecionado?.area ||
                          areaEquipe
                        }
                        onChange={(e) =>
                          setAreaEquipe(
                            e.target.value
                          )
                        }
                        style={{
                          width: "100%",
                          border:
                            "1px solid #D8DEEA",
                          borderRadius: 9,
                          padding:
                            "10px 11px",
                          background:
                            WHITE,
                        }}
                      >
                        {areasEquipeDisponiveis.map(
                          (area) => (
                            <option
                              key={area}
                              value={area}
                            >
                              {area}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          marginBottom: 5,
                        }}
                      >
                        RESPONSÁVEL
                      </div>

                      <div
                        style={{
                          minHeight: 40,
                          display: "flex",
                          alignItems: "center",
                          padding:
                            "0 11px",
                          border:
                            "1px solid #E3E7EF",
                          borderRadius: 9,
                          background:
                            "#F7F8FB",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {atendimentoEquipeSelecionado
                          ?.responsavelNome ||
                          "Não atribuído"}
                      </div>
                    </div>
                  </div>
                </Card>

                {atendimentoEquipeSelecionado && (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "minmax(0,1fr) 150px",
                        gap: 12,
                        marginBottom: 14,
                      }}
                    >
                      <Card>
                        <div
                          style={{
                            fontSize: 10,
                            color: CORAL,
                            fontWeight: 900,
                            marginBottom: 5,
                          }}
                        >
                          {
                            atendimentoEquipeSelecionado.area
                          }
                        </div>

                        <h3
                          style={{
                            margin:
                              "0 0 6px",
                            fontSize: 18,
                          }}
                        >
                          {empresa.razaoSocial ||
                            "Empresa"}
                        </h3>

                        <div
                          style={{
                            color: MUTED,
                            fontSize: 11,
                          }}
                        >
                          {atendimentoEquipeSelecionado
                            .nivelArea ||
                            "-"}
                          {" · "}
                          {atendimentoEquipeSelecionado
                            .statusAtendimento ||
                            "NAO_INICIADO"}
                        </div>
                      </Card>

                      <Card
                        style={{
                          textAlign:
                            "center",
                          background:
                            scoreInfo(
                              atendimentoEquipeSelecionado
                                .scoreArea
                            ).bg,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 30,
                            fontWeight: 900,
                            color:
                              scoreInfo(
                                atendimentoEquipeSelecionado
                                  .scoreArea
                              ).color,
                          }}
                        >
                          {atendimentoEquipeSelecionado
                            .scoreArea ??
                            "-"}
                        </div>

                        <div
                          style={{
                            fontSize: 9,
                            color:
                              scoreInfo(
                                atendimentoEquipeSelecionado
                                  .scoreArea
                              ).color,
                            fontWeight: 800,
                          }}
                        >
                          SCORE DA ÁREA
                        </div>
                      </Card>
                    </div>

                    {areaClientePorNome[
                      atendimentoEquipeSelecionado.area
                    ]?.resumo && (
                      <BlocoDossie titulo="Situação identificada" destaque>
                        <p
                          style={{
                            margin: 0,
                            lineHeight: 1.6,
                            fontSize: 12.5,
                          }}
                        >
                          {
                            areaClientePorNome[
                              atendimentoEquipeSelecionado.area
                            ].resumo
                          }
                        </p>
                      </BlocoDossie>
                    )}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(220px,1fr))",
                        gap: 10,
                        marginBottom: 16,
                      }}
                    >
                      <ListaInterna
                        titulo="Oportunidades da área"
                        itens={
                          atendimentoEquipeSelecionado
                            .oportunidades
                        }
                      />

                      <ListaInterna
                        titulo="Riscos"
                        itens={
                          atendimentoEquipeSelecionado
                            .riscos
                        }
                      />

                      <ListaInterna
                        titulo="Pontos fortes"
                        itens={
                          areaEquipeDiagnostico
                            ?.pontosFortes
                        }
                      />

                      <ListaInterna
                        titulo="Recomendações"
                        itens={
                          normalizarLista(
                            atendimentoEquipeSelecionado
                              .recomendacoes
                          ).length
                            ? atendimentoEquipeSelecionado
                                .recomendacoes
                            : areaEquipeDiagnostico
                                ?.recomendacoes
                        }
                      />

                      <ListaInterna
                        titulo="Plano de ação"
                        itens={
                          atendimentoEquipeSelecionado
                            .planoAcao
                        }
                      />
                    </div>

                    {atendimentoEquipeSelecionado
                      .orientacaoTecnica && (
                      <BlocoDossie titulo="Orientação técnica para o especialista">
                        <p
                          style={{
                            margin: 0,
                            lineHeight: 1.6,
                            fontSize: 12,
                          }}
                        >
                          {
                            atendimentoEquipeSelecionado
                              .orientacaoTecnica
                          }
                        </p>
                      </BlocoDossie>
                    )}

                    <h2
                      style={
                        tituloSecao
                      }
                    >
                      Perguntas e respostas da área
                    </h2>

                    <Card
                      style={{
                        padding: 0,
                        overflowX:
                          "auto",
                      }}
                    >
                      <table
                        style={{
                          width:
                            "100%",
                          borderCollapse:
                            "collapse",
                          minWidth: 720,
                        }}
                      >
                        <thead>
                          <tr>
                            <th
                              style={
                                thStyle
                              }
                            >
                              Tema
                            </th>

                            <th
                              style={
                                thStyle
                              }
                            >
                              Pergunta
                            </th>

                            <th
                              style={
                                thStyle
                              }
                            >
                              Resposta
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {perguntasEquipe.length ? (
                            perguntasEquipe.map(
                              (
                                pergunta,
                                index
                              ) => (
                                <tr
                                  key={
                                    index
                                  }
                                >
                                  <td
                                    style={
                                      tdStyle
                                    }
                                  >
                                    {pergunta.tema ||
                                      "-"}
                                  </td>

                                  <td
                                    style={
                                      tdStyle
                                    }
                                  >
                                    {pergunta.pergunta ||
                                      "-"}
                                  </td>

                                  <td
                                    style={{
                                      ...tdStyle,
                                      fontWeight:
                                        800,
                                    }}
                                  >
                                    {pergunta.resposta ||
                                      "-"}
                                  </td>
                                </tr>
                              )
                            )
                          ) : (
                            <tr>
                              <td
                                colSpan="3"
                                style={{
                                  ...tdStyle,
                                  textAlign:
                                    "center",
                                }}
                              >
                                Nenhuma pergunta específica armazenada para esta área.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </Card>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// =========================================================
// LISTA INTERNA
// =========================================================

function ListaInterna({
  titulo,
  itens,
}) {
  const lista =
    normalizarLista(
      itens
    );

  function itemSeguro(
    item,
    index
  ) {
    if (
      item === null ||
      item === undefined
    ) {
      return null;
    }

    if (
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean"
    ) {
      return (
        <li key={index}>
          {String(item)}
        </li>
      );
    }

    if (
      Array.isArray(item)
    ) {
      return (
        <li key={index}>
          {item
            .map(
              (valor) =>
                textoSeguro(valor)
            )
            .filter(Boolean)
            .join(" • ")}
        </li>
      );
    }

    if (
      typeof item === "object"
    ) {
      const tituloItem =
        item.titulo ||
        item.nome ||
        item.acao ||
        item.recomendacao ||
        item.risco ||
        item.achado ||
        item.descricao ||
        item.texto ||
        item.resumo ||
        item.indicador ||
        item.objetivo ||
        "";

      const detalhes =
        Object.entries(item)
          .filter(
            ([chave, valor]) =>
              ![
                "titulo",
                "nome",
                "acao",
                "recomendacao",
                "risco",
                "achado",
                "descricao",
                "texto",
                "resumo",
                "indicador",
                "objetivo",
              ].includes(chave) &&
              valor !== null &&
              valor !== undefined &&
              valor !== ""
          )
          .map(
            ([chave, valor]) => {
              const textoValor =
                Array.isArray(valor)
                  ? valor
                      .map(textoSeguro)
                      .filter(Boolean)
                      .join(" • ")
                  : textoSeguro(valor);

              if (!textoValor) {
                return "";
              }

              return `${tituloChave(
                chave
              )}: ${textoValor}`;
            }
          )
          .filter(Boolean);

      const textoPrincipal =
        textoSeguro(
          tituloItem
        );

      const textoFinal =
        [
          textoPrincipal,
          ...detalhes,
        ]
          .filter(Boolean)
          .join(" — ");

      return (
        <li key={index}>
          {textoFinal ||
            "Informação estruturada disponível."}
        </li>
      );
    }

    return (
      <li key={index}>
        {String(item)}
      </li>
    );
  }

  return (
    <div
      style={{
        background:
          "#F7F8FB",

        borderRadius:
          9,

        padding:
          11,
      }}
    >
      <strong
        style={{
          display:
            "block",

          fontSize:
            11,

          marginBottom:
            6,
        }}
      >
        {titulo}
      </strong>

      {lista.length ? (
        <ul
          style={{
            margin:
              0,

            paddingLeft:
              17,

            fontSize:
              11.5,

            lineHeight:
              1.5,
          }}
        >
          {lista.map(
            itemSeguro
          )}
        </ul>
      ) : (
        <span
          style={{
            fontSize:
              11,

            color:
              MUTED,
          }}
        >
          Não identificado neste eixo.
        </span>
      )}
    </div>
  );
}


// =========================================================
// USUÁRIOS, ACESSOS E AUDITORIA
// =========================================================
function UsuariosAcessos({ token }) {
  const [usuarios,setUsuarios]=useState([]), [erro,setErro]=useState(""), [salvando,setSalvando]=useState(false);
  const [form,setForm]=useState({nome:"",email:"",login:"",senha:"",tipoAcesso:"SISTEMA",perfil:"CONSULTOR"});
  async function carregar(){ try{ const r=await fetch("/api/acessos?action=usuarios",{headers:{Authorization:`Bearer ${token}`}}); const d=await r.json().catch(()=>null); if(!r.ok||!d?.sucesso) throw new Error(d?.error||"Erro ao carregar usuários."); setUsuarios(d.usuarios||[]);}catch(e){setErro(e.message)} }
  useEffect(()=>{carregar()},[]);
  async function criar(){setSalvando(true);setErro("");try{const r=await fetch("/api/acessos?action=criar-usuario",{method:"POST",headers:{"content-type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(form)});const d=await r.json().catch(()=>null);if(!r.ok||!d?.sucesso)throw new Error(d?.error||"Erro ao criar usuário.");setForm({nome:"",email:"",login:"",senha:"",tipoAcesso:"SISTEMA",perfil:"CONSULTOR"});await carregar();}catch(e){setErro(e.message)}finally{setSalvando(false)}}
  async function alternar(u){setErro("");try{const r=await fetch("/api/acessos?action=alterar-usuario",{method:"POST",headers:{"content-type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({id:u.id,ativo:!u.ativo})});const d=await r.json().catch(()=>null);if(!r.ok||!d?.sucesso)throw new Error(d?.error||"Erro ao alterar usuário.");await carregar();}catch(e){setErro(e.message)}}
  const inp={border:"1px solid #D8DEEA",borderRadius:9,padding:"10px 11px",fontSize:12,color:NAVY,background:WHITE};
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:10,background:WHITE,borderRadius:16,padding:18,boxShadow:"0 8px 24px rgba(23,35,61,.06)",marginBottom:18}}>
      <div style={{gridColumn:"1/-1"}}><h2 style={{...tituloSecao,margin:"0 0 4px"}}>Criar usuário</h2><div style={{fontSize:12,color:MUTED}}>Crie acesso separado para o App, Sistema ou ambos.</div></div>
      <input style={inp} placeholder="Nome" value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/>
      <input style={inp} placeholder="E-mail" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
      <input style={inp} placeholder="Login" value={form.login} onChange={e=>setForm({...form,login:e.target.value})}/>
      <input style={inp} type="password" placeholder="Senha inicial (mín. 8)" value={form.senha} onChange={e=>setForm({...form,senha:e.target.value})}/>
      <select style={inp} value={form.tipoAcesso} onChange={e=>setForm({...form,tipoAcesso:e.target.value})}><option value="APP">App</option><option value="SISTEMA">Sistema</option><option value="AMBOS">App + Sistema</option></select>
      <select style={inp} value={form.perfil} onChange={e=>setForm({...form,perfil:e.target.value})}><option value="ADMIN">Administrador</option><option value="GESTOR">Gestor</option><option value="CONSULTOR">Consultor</option><option value="COMERCIAL">Comercial</option><option value="LEITURA">Somente leitura</option></select>
      <Botao onClick={criar} disabled={salvando}><UserPlus size={15}/>{salvando?"Criando...":"Criar usuário"}</Botao>
      {erro&&<div style={{gridColumn:"1/-1",background:"#FAECE7",color:"#993C1D",padding:10,borderRadius:9,fontSize:12}}>{erro}</div>}
    </div>
    <div style={{background:WHITE,borderRadius:16,overflow:"auto",boxShadow:"0 8px 24px rgba(23,35,61,.06)"}}>
      <table style={{width:"100%",borderCollapse:"collapse",minWidth:820}}><thead><tr><th style={thStyle}>Usuário</th><th style={thStyle}>Login</th><th style={thStyle}>Acesso</th><th style={thStyle}>Perfil</th><th style={thStyle}>Último acesso</th><th style={thStyle}>Status</th><th style={thStyle}>Ação</th></tr></thead><tbody>
      {usuarios.map(u=><tr key={u.id}><td style={tdStyle}><strong>{u.nome}</strong><br/><span style={{color:MUTED}}>{u.email}</span></td><td style={tdStyle}>{u.login}</td><td style={tdStyle}>{u.tipo_acesso}</td><td style={tdStyle}>{u.perfil}</td><td style={tdStyle}>{formatarData(u.ultimo_acesso_em)}</td><td style={tdStyle}>{u.ativo?"Ativo":"Bloqueado"}</td><td style={tdStyle}><Botao secundario onClick={()=>alternar(u)}>{u.ativo?"Bloquear":"Ativar"}</Botao></td></tr>)}
      {!usuarios.length&&<tr><td colSpan={7} style={{...tdStyle,padding:24,textAlign:"center",color:MUTED}}>Nenhum usuário cadastrado.</td></tr>}
      </tbody></table>
    </div>
  </div>;
}

function AuditoriaSistema({ token }) {
  const [eventos,setEventos]=useState([]),[erro,setErro]=useState(""),[filtro,setFiltro]=useState("");
  async function carregar(){try{const r=await fetch("/api/acessos?action=auditoria&limite=500",{headers:{Authorization:`Bearer ${token}`}});const d=await r.json().catch(()=>null);if(!r.ok||!d?.sucesso)throw new Error(d?.error||"Erro ao carregar auditoria.");setEventos(d.eventos||[])}catch(e){setErro(e.message)}}
  useEffect(()=>{carregar()},[]);
  const lista=eventos.filter(e=>!filtro||JSON.stringify(e).toLowerCase().includes(filtro.toLowerCase()));
  return <div>
    <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}><input value={filtro} onChange={e=>setFiltro(e.target.value)} placeholder="Filtrar usuário, ação, módulo ou registro..." style={{flex:1,minWidth:260,border:"1px solid #D8DEEA",borderRadius:9,padding:"10px 12px"}}/><Botao secundario onClick={carregar}><RefreshCcw size={14}/>Atualizar</Botao></div>
    {erro&&<div style={{background:"#FAECE7",color:"#993C1D",padding:10,borderRadius:9,marginBottom:12}}>{erro}</div>}
    <div style={{background:WHITE,borderRadius:16,overflow:"auto",boxShadow:"0 8px 24px rgba(23,35,61,.06)"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:1000}}><thead><tr><th style={thStyle}>Data/hora</th><th style={thStyle}>Usuário</th><th style={thStyle}>Ação</th><th style={thStyle}>Módulo</th><th style={thStyle}>Registro</th><th style={thStyle}>Detalhes</th></tr></thead><tbody>
      {lista.map(e=><tr key={e.id}><td style={tdStyle}>{formatarData(e.criado_em)}</td><td style={tdStyle}><strong>{e.usuario_nome||e.usuario_login||"-"}</strong><br/><span style={{color:MUTED}}>{e.usuario_login||""}</span></td><td style={tdStyle}>{e.acao}</td><td style={tdStyle}>{e.modulo||"-"}</td><td style={tdStyle}>{[e.recurso,e.recurso_id].filter(Boolean).join(" #")||"-"}</td><td style={tdStyle}><div>{e.descricao||"-"}</div>{(e.antes||e.depois)&&<details style={{marginTop:5}}><summary style={{cursor:"pointer",color:CORAL}}>Antes / depois</summary><pre style={{whiteSpace:"pre-wrap",fontSize:10,maxWidth:460}}>{JSON.stringify({antes:e.antes,depois:e.depois},null,2)}</pre></details>}</td></tr>)}
      {!lista.length&&<tr><td colSpan={6} style={{...tdStyle,padding:24,textAlign:"center",color:MUTED}}>Nenhum evento encontrado.</td></tr>}
    </tbody></table></div>
  </div>;
}

// =========================================================
// COMPONENTE PRINCIPAL
// =========================================================

export default function Admin() {
  const [token, setToken] = useState(
    () =>
      sessionStorage.getItem(
        "finder_admin_token"
      ) || ""
  );

  const [
    diagnosticoId,
    setDiagnosticoId,
  ] = useState(null);

  const [
    aba,
    setAba,
  ] = useState("dashboard");

  const usuarioSessao = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem("finder_admin_user") || "{}"); }
    catch { return {}; }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const auditar = (dados) => fetch("/api/acessos?action=auditar", {
      method:"POST", headers:{"content-type":"application/json",Authorization:`Bearer ${token}`}, body:JSON.stringify(dados)
    }).catch(()=>null);
    const clickHandler = (ev) => {
      const el = ev.target?.closest?.("button,a,[role='button']");
      if (!el) return;
      const texto = String(el.innerText || el.getAttribute("aria-label") || el.title || "").trim().slice(0,160);
      if (!texto) return;
      auditar({acao:"CLICK",modulo:"PAINEL",recurso:"interface",descricao:texto,detalhes:{aba}});
    };
    document.addEventListener("click", clickHandler, true);
    return () => document.removeEventListener("click", clickHandler, true);
  }, [token, aba]);

  function sair() {
    sessionStorage.removeItem(
      "finder_admin_token"
    );
    sessionStorage.removeItem("finder_admin_user");

    setToken("");
    setDiagnosticoId(null);
    setAba("dashboard");
  }

  function abrirDiagnosticoDashboard(
    id
  ) {
    if (!id) {
      return;
    }

    setDiagnosticoId(id);
  }

  function abrirLeadDashboard(
    leadId
  ) {
    setDiagnosticoId(null);
    setAba("leads");

    if (leadId) {
      sessionStorage.setItem(
        "finder_dashboard_lead_id",
        String(leadId)
      );
    }
  }

  function abrirAtendimentoDashboard(
    atendimentoId
  ) {
    setDiagnosticoId(null);
    setAba("atendimentos");

    if (atendimentoId) {
      sessionStorage.setItem(
        "finder_dashboard_atendimento_id",
        String(atendimentoId)
      );
    }
  }

  function BarraAbas() {
    return (
      <div
        style={{
          background: "#101A2F",
          padding: "9px 22px",
          display: "flex",
          justifyContent: "center",
          gap: 8,
          fontFamily: BODY_FONT,
          flexWrap: "wrap",
        }}
      >
        <Botao
          secundario={
            aba !==
            "dashboard"
          }
          onClick={() =>
            setAba(
              "dashboard"
            )
          }
        >
          <LayoutDashboard
            size={14}
          />
          Dashboard
        </Botao>

        <Botao
          secundario={aba !== "leads"}
          onClick={() =>
            setAba("leads")
          }
        >
          <Users size={14} />
          Leads / CRM
        </Botao>

        <Botao
          secundario={
            aba !==
            "diagnosticos"
          }
          onClick={() =>
            setAba(
              "diagnosticos"
            )
          }
        >
          <Building2
            size={14}
          />
          Diagnósticos
        </Botao>

        <Botao
          secundario={
            aba !==
            "atendimentos"
          }
          onClick={() =>
            setAba(
              "atendimentos"
            )
          }
        >
          <Target size={14} />
          Atendimentos
        </Botao>

        <Botao
          secundario={
            aba !==
            "equipe"
          }
          onClick={() =>
            setAba("equipe")
          }
        >
          <UserPlus size={14} />
          Equipe / Capacidade
        </Botao>

        <Botao secundario={aba !== "usuarios"} onClick={() => setAba("usuarios")}>
          <UserCog size={14} />
          Usuários e Acessos
        </Botao>

        <Botao secundario={aba !== "auditoria"} onClick={() => setAba("auditoria")}>
          <History size={14} />
          Auditoria
        </Botao>
      </div>
    );
  }

  function Cabecalho({
    titulo,
    subtitulo,
  }) {
    return (
      <header
        style={{
          background: NAVY,
          color: WHITE,
          padding: "18px 28px",
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: "0 auto",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems:
                "center",
              gap: 18,
            }}
          >
            <img
              src="/finder-logo.png"
              alt="Finder of Solutions"
              style={{
                maxWidth: 150,
                maxHeight: 45,
                objectFit:
                  "contain",
                background: WHITE,
                padding: 5,
                borderRadius: 7,
              }}
            />

            <div>
              <h1
                style={{
                  margin: 0,
                  fontFamily:
                    DISPLAY_FONT,
                  fontSize: 24,
                }}
              >
                {titulo}
              </h1>

              <p
                style={{
                  margin:
                    "3px 0 0",
                  fontSize: 11,
                  opacity: 0.7,
                }}
              >
                {subtitulo}
              </p>
            </div>
          </div>

          <div style={{marginLeft:"auto",textAlign:"right",fontSize:11,lineHeight:1.35}}>
            <strong>{usuarioSessao?.nome || "Administrador"}</strong><br/>
            <span style={{opacity:.7}}>{usuarioSessao?.perfil || "ADMIN"}</span>
          </div>

          <button
            onClick={sair}
            style={{
              background:
                "transparent",
              border:
                "1px solid rgba(255,255,255,.30)",
              color: WHITE,
              borderRadius: 9,
              padding:
                "8px 11px",
              cursor: "pointer",
              display: "flex",
              alignItems:
                "center",
              gap: 6,
            }}
          >
            <LogOut size={15} />
            Sair
          </button>
        </div>
      </header>
    );
  }

  if (!token) {
    return (
      <LoginAdmin
        onLogin={setToken}
      />
    );
  }

  if (diagnosticoId) {
    return (
      <DetalheDiagnostico
        token={token}
        id={diagnosticoId}
        onVoltar={() =>
          setDiagnosticoId(
            null
          )
        }
      />
    );
  }

  if (
    aba ===
    "dashboard"
  ) {
    return (
      <div
        style={{
          minHeight:
            "100vh",
          background:
            BG,
          fontFamily:
            BODY_FONT,
          color:
            NAVY,
        }}
      >
        <Cabecalho
          titulo="Dashboard"
          subtitulo="Inteligência gerencial e comercial da Finder"
        />

        <BarraAbas />

        <Dashboard
          onAbrirLead={
            abrirLeadDashboard
          }
          onAbrirDiagnostico={
            abrirDiagnosticoDashboard
          }
          onAbrirAtendimento={
            abrirAtendimentoDashboard
          }
        />
      </div>
    );
  }

  if (
    aba ===
    "diagnosticos"
  ) {
    return (
      <div>
        <BarraAbas />

        <ListaDiagnosticos
          token={token}
          onAbrir={
            setDiagnosticoId
          }
          onLogout={sair}
        />
      </div>
    );
  }

  if (
    aba ===
    "atendimentos"
  ) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: BG,
          fontFamily: BODY_FONT,
          color: NAVY,
        }}
      >
        <Cabecalho
          titulo="Atendimentos"
          subtitulo="Execução consultiva por departamento"
        />

        <BarraAbas />

        <main
          style={{
            maxWidth: 1320,
            margin: "0 auto",
            padding:
              "26px 22px 50px",
          }}
        >
          <AtendimentosDepartamento
            token={token}
            onAbrirDiagnostico={
              setDiagnosticoId
            }
          />
        </main>
      </div>
    );
  }

  if (aba === "usuarios") {
    return <div style={{minHeight:"100vh",background:BG,fontFamily:BODY_FONT,color:NAVY}}>
      <Cabecalho titulo="Usuários e Acessos" subtitulo="Criação de logins do App e do Sistema" />
      <BarraAbas />
      <main style={{maxWidth:1320,margin:"0 auto",padding:"26px 22px 50px"}}><UsuariosAcessos token={token}/></main>
    </div>;
  }

  if (aba === "auditoria") {
    return <div style={{minHeight:"100vh",background:BG,fontFamily:BODY_FONT,color:NAVY}}>
      <Cabecalho titulo="Auditoria" subtitulo="Histórico de acessos, cliques e alterações" />
      <BarraAbas />
      <main style={{maxWidth:1320,margin:"0 auto",padding:"26px 22px 50px"}}><AuditoriaSistema token={token}/></main>
    </div>;
  }

  if (
    aba ===
    "equipe"
  ) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: BG,
          fontFamily: BODY_FONT,
          color: NAVY,
        }}
      >
        <Cabecalho
          titulo="Equipe / Capacidade"
          subtitulo="Especialidades, permissões e capacidade de atendimento"
        />

        <BarraAbas />

        <main
          style={{
            maxWidth: 1320,
            margin: "0 auto",
            padding:
              "26px 22px 50px",
          }}
        >
          <EquipeCapacidade
            token={token}
          />
        </main>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        fontFamily: BODY_FONT,
        color: NAVY,
      }}
    >
      <Cabecalho
        titulo="Leads / CRM"
        subtitulo="Funil do diagnóstico empresarial"
      />

      <BarraAbas />

      <main
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding:
            "26px 22px 50px",
        }}
      >
        <LeadsCRM
          token={token}
          onAbrirDiagnostico={
            setDiagnosticoId
          }
        />
      </main>
    </div>
  );
}

// =========================================================
// ESTILOS
// =========================================================

const tituloSecao = {
  fontFamily:
    DISPLAY_FONT,

  fontSize:
    20,

  margin:
    "25px 0 10px",
};

const thStyle = {
  background:
    ICE,

  padding:
    "10px 9px",

  textAlign:
    "left",

  color:
    NAVY,

  fontSize:
    11,

  whiteSpace:
    "nowrap",
};

const tdStyle = {
  borderBottom:
    "1px solid #E5E8EE",

  padding:
    "10px 9px",

  fontSize:
    11.5,

  lineHeight:
    1.45,

  verticalAlign:
    "top",
};
