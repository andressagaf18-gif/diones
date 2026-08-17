import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Search,
  Building2,
  User,
  Calendar,
  ArrowLeft,
  LogOut,
  RefreshCcw,
  AlertTriangle,
  ChevronRight,
  Activity,
  FileText,
  Target,
} from "lucide-react";

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

function LoginAdmin({ onLogin }) {
  const [token, setToken] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    const valor = token.trim();

    if (!valor) {
      setErro("Digite a senha administrativa.");
      return;
    }

    setCarregando(true);
    setErro("");

    try {
      const resposta = await fetch(
        "/api/listar-diagnosticos?limite=1",
        {
          headers: {
            Authorization: `Bearer ${valor}`,
          },
        }
      );

      const data = await resposta.json().catch(() => null);

      if (!resposta.ok || !data?.sucesso) {
        throw new Error(
          data?.error || "Senha administrativa inválida."
        );
      }

      sessionStorage.setItem(
        "finder_admin_token",
        valor
      );

      onLogin(valor);
    } catch (error) {
      setErro(
        error?.message ||
          "Não foi possível acessar o painel."
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        fontFamily: BODY_FONT,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          background: WHITE,
          borderRadius: 20,
          padding: 30,
          boxShadow:
            "0 24px 60px rgba(23,35,61,0.14)",
        }}
      >
        <img
          src="/finder-logo.png"
          alt="Finder of Solutions"
          style={{
            width: 180,
            maxWidth: "70%",
            objectFit: "contain",
            marginBottom: 22,
          }}
        />

        <h1
          style={{
            fontFamily: DISPLAY_FONT,
            color: NAVY,
            fontSize: 28,
            margin: "0 0 7px",
          }}
        >
          Painel de Diagnósticos
        </h1>

        <p
          style={{
            fontSize: 13,
            color: MUTED,
            lineHeight: 1.5,
            margin: "0 0 22px",
          }}
        >
          Área restrita da Finder para consulta dos
          diagnósticos empresariais realizados.
        </p>

        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 700,
            color: NAVY,
            marginBottom: 7,
          }}
        >
          Senha administrativa
        </label>

        <input
          type="password"
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            setErro("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") entrar();
          }}
          autoComplete="current-password"
          placeholder="Digite o ADMIN_TOKEN"
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid #D8DEEA",
            borderRadius: 10,
            padding: "12px 13px",
            fontFamily: BODY_FONT,
            fontSize: 14,
            color: NAVY,
            marginBottom: 12,
          }}
        />

        {erro && (
          <div
            style={{
              background: "#FAECE7",
              color: "#993C1D",
              borderRadius: 9,
              padding: 10,
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            {erro}
          </div>
        )}

        <Botao
          onClick={entrar}
          disabled={carregando}
          style={{
            width: "100%",
          }}
        >
          {carregando
            ? "Validando..."
            : "Entrar no painel"}
        </Botao>
      </div>
    </div>
  );
}

function ListaDiagnosticos({
  token,
  onAbrir,
  onLogout,
}) {
  const [diagnosticos, setDiagnosticos] =
    useState([]);

  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] =
    useState("");

  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] =
    useState(true);

  const [erro, setErro] = useState("");

  async function carregar(termo = "") {
    setCarregando(true);
    setErro("");

    try {
      const params = new URLSearchParams();

      params.set("limite", "100");
      params.set("offset", "0");

      if (termo.trim()) {
        params.set(
          "busca",
          termo.trim()
        );
      }

      const resposta = await fetch(
        `/api/listar-diagnosticos?${params.toString()}`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data =
        await resposta.json().catch(() => null);

      if (!resposta.ok || !data?.sucesso) {
        if (resposta.status === 401) {
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
        Array.isArray(data.diagnosticos)
          ? data.diagnosticos
          : []
      );

      setTotal(
        Number(data.total) || 0
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

  function pesquisar() {
    const termo = busca.trim();
    setBuscaAplicada(termo);
    carregar(termo);
  }

  function limparBusca() {
    setBusca("");
    setBuscaAplicada("");
    carregar("");
  }

  const mediaScore = useMemo(() => {
    const scores = diagnosticos
      .map((d) => Number(d.score))
      .filter(Number.isFinite);

    if (!scores.length) {
      return null;
    }

    return Math.round(
      scores.reduce(
        (acc, valor) => acc + valor,
        0
      ) / scores.length
    );
  }, [diagnosticos]);

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
            justifyContent: "space-between",
            alignItems: "center",
            gap: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
            }}
          >
            <img
              src="/finder-logo.png"
              alt="Finder of Solutions"
              style={{
                maxWidth: 150,
                maxHeight: 45,
                objectFit: "contain",
                background: WHITE,
                padding: 5,
                borderRadius: 7,
              }}
            />

            <div>
              <h1
                style={{
                  margin: 0,
                  fontFamily: DISPLAY_FONT,
                  fontSize: 24,
                }}
              >
                Diagnósticos
              </h1>

              <p
                style={{
                  margin: "3px 0 0",
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
              background: "transparent",
              border:
                "1px solid rgba(255,255,255,.30)",
              color: WHITE,
              borderRadius: 9,
              padding: "8px 11px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <LogOut size={15} />
            Sair
          </button>
        </div>
      </header>

      <main
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding: "26px 22px 50px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(190px,1fr))",
            gap: 12,
            marginBottom: 20,
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
              {diagnosticos.length}
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
              {mediaScore ?? "-"}
            </div>
          </Card>
        </div>

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
                flex: "1 1 360px",
                position: "relative",
              }}
            >
              <Search
                size={16}
                color={MUTED}
                style={{
                  position: "absolute",
                  top: 12,
                  left: 12,
                }}
              />

              <input
                value={busca}
                onChange={(e) =>
                  setBusca(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    pesquisar();
                  }
                }}
                placeholder="Buscar empresa, CNPJ, nome, e-mail, segmento..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border:
                    "1px solid #D8DEEA",
                  borderRadius: 9,
                  padding:
                    "10px 12px 10px 36px",
                  fontFamily: BODY_FONT,
                  fontSize: 13,
                }}
              />
            </div>

            <Botao onClick={pesquisar}>
              <Search size={14} />
              Buscar
            </Botao>

            {buscaAplicada && (
              <Botao
                secundario
                onClick={limparBusca}
              >
                Limpar
              </Botao>
            )}

            <Botao
              secundario
              onClick={() =>
                carregar(buscaAplicada)
              }
            >
              <RefreshCcw size={14} />
              Atualizar
            </Botao>
          </div>
        </Card>

        {erro && (
          <div
            style={{
              background: "#FAECE7",
              color: "#993C1D",
              padding: 13,
              borderRadius: 10,
              marginBottom: 14,
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
            }}
          >
            <AlertTriangle
              size={17}
              style={{ flexShrink: 0 }}
            />

            <div>{erro}</div>
          </div>
        )}

        {carregando ? (
          <Card>
            Carregando diagnósticos...
          </Card>
        ) : diagnosticos.length === 0 ? (
          <Card>
            Nenhum diagnóstico encontrado.
          </Card>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {diagnosticos.map((item) => {
              const score =
                scoreInfo(item.score);

              const dores =
                normalizarLista(
                  item.dores
                );

              return (
                <button
                  key={item.id}
                  onClick={() =>
                    onAbrir(item.id)
                  }
                  style={{
                    width: "100%",
                    background: WHITE,
                    border:
                      "1px solid #E2E6EE",
                    borderRadius: 14,
                    padding: 16,
                    textAlign: "left",
                    cursor: "pointer",
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(250px,2fr) minmax(180px,1.2fr) 90px 34px",
                    gap: 15,
                    alignItems: "center",
                    fontFamily: BODY_FONT,
                    color: NAVY,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        marginBottom: 4,
                      }}
                    >
                      {item.razaoSocial ||
                        "Empresa não informada"}
                    </div>

                    <div
                      style={{
                        fontSize: 11.5,
                        color: MUTED,
                        display: "flex",
                        gap: 9,
                        flexWrap: "wrap",
                      }}
                    >
                      <span>
                        {formatarCnpj(
                          item.cnpj
                        )}
                      </span>

                      {item.segmento && (
                        <span>
                          {item.segmento}
                        </span>
                      )}
                    </div>

                    {dores.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          gap: 5,
                          flexWrap: "wrap",
                          marginTop: 8,
                        }}
                      >
                        {dores
                          .slice(0, 3)
                          .map(
                            (
                              dor,
                              index
                            ) => (
                              <span
                                key={`${dor}-${index}`}
                                style={{
                                  fontSize: 9.5,
                                  background:
                                    "#FFF3EF",
                                  color:
                                    "#993C1D",
                                  borderRadius: 20,
                                  padding:
                                    "3px 7px",
                                }}
                              >
                                {dor}
                              </span>
                            )
                          )}
                      </div>
                    )}
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {item.nome ||
                        "Participante não informado"}
                    </div>

                    <div
                      style={{
                        fontSize: 10.5,
                        color: MUTED,
                        marginTop: 3,
                      }}
                    >
                      {item.email || "-"}
                    </div>

                    <div
                      style={{
                        fontSize: 10.5,
                        color: MUTED,
                        marginTop: 5,
                      }}
                    >
                      {formatarData(
                        item.criadoEm
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        background:
                          score.bg,
                        color:
                          score.color,
                        borderRadius: 12,
                        padding:
                          "8px 6px",
                      }}
                    >
                      <strong
                        style={{
                          fontSize: 19,
                        }}
                      >
                        {item.score ??
                          "-"}
                      </strong>

                      <div
                        style={{
                          fontSize: 8.5,
                          marginTop: 1,
                        }}
                      >
                        {score.label}
                      </div>
                    </div>
                  </div>

                  <ChevronRight
                    size={20}
                    color={MUTED}
                  />
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function DetalheDiagnostico({
  token,
  id,
  onVoltar,
}) {
  const [item, setItem] =
    useState(null);

  const [carregando, setCarregando] =
    useState(true);

  const [erro, setErro] =
    useState("");

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      setErro("");

      try {
        const resposta =
          await fetch(
            `/api/ver-diagnostico?id=${encodeURIComponent(
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
  }, [id]);

  if (carregando) {
    return (
      <div
        style={{
          padding: 30,
          fontFamily: BODY_FONT,
        }}
      >
        Carregando diagnóstico...
      </div>
    );
  }

  if (erro || !item) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: BG,
          padding: 24,
          fontFamily: BODY_FONT,
        }}
      >
        <Botao
          secundario
          onClick={onVoltar}
        >
          <ArrowLeft size={15} />
          Voltar
        </Botao>

        <div
          style={{
            marginTop: 16,
            background: "#FAECE7",
            color: "#993C1D",
            padding: 15,
            borderRadius: 10,
          }}
        >
          {erro ||
            "Diagnóstico não encontrado."}
        </div>
      </div>
    );
  }

  const participante =
    item.participante || {};

  const empresa =
    item.empresa || {};

  const resultado =
    item.resultado || {};

  const diagnosticoGeral =
    resultado.diagnosticoGeral ||
    {};

  const perguntas =
    normalizarLista(
      item.perguntasRespostas
    );

  const areas =
    normalizarLista(
      resultado.areas
    );

  const dores =
    normalizarLista(item.dores);

  const score =
    scoreInfo(item.score);

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
          padding: "17px 24px",
          color: WHITE,
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
          }}
        >
          <Botao
            secundario
            onClick={onVoltar}
          >
            <ArrowLeft size={15} />
            Diagnósticos
          </Botao>

          <span
            style={{
              fontSize: 11,
              opacity: 0.75,
            }}
          >
            {formatarData(
              item.criadoEm
            )}
          </span>
        </div>
      </header>

      <main
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "24px 20px 60px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0,1fr) 170px",
            gap: 14,
            marginBottom: 16,
          }}
        >
          <Card>
            <div
              style={{
                fontSize: 11,
                color: CORAL,
                fontWeight: 800,
                marginBottom: 6,
              }}
            >
              DIAGNÓSTICO EMPRESARIAL
            </div>

            <h1
              style={{
                fontFamily:
                  DISPLAY_FONT,
                fontSize: 28,
                margin: "0 0 7px",
              }}
            >
              {empresa.razaoSocial ||
                "Empresa"}
            </h1>

            <div
              style={{
                color: MUTED,
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              {formatarCnpj(
                empresa.cnpj
              )}

              {empresa.segmento
                ? ` · ${empresa.segmento}`
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
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 38,
                fontWeight: 900,
                color:
                  score.color,
              }}
            >
              {item.score ?? "-"}
            </div>

            <div
              style={{
                fontSize: 11,
                color:
                  score.color,
                fontWeight: 700,
              }}
            >
              {score.label}
            </div>
          </Card>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(230px,1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <Card>
            <User
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
            <Building2
              size={18}
              color={CORAL}
            />

            <h3>
              Negócio
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
                  paddingLeft: 18,
                  marginBottom: 0,
                }}
              >
                {dores.map(
                  (dor, index) => (
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

        {diagnosticoGeral.resumoExecutivo && (
          <>
            <h2 style={tituloSecao}>
              Resumo executivo
            </h2>

            <Card>
              <p
                style={{
                  margin: 0,
                  lineHeight: 1.65,
                }}
              >
                {
                  diagnosticoGeral.resumoExecutivo
                }
              </p>
            </Card>
          </>
        )}

        {diagnosticoGeral.alertaEstrategico && (
          <>
            <h2 style={tituloSecao}>
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
                diagnosticoGeral.alertaEstrategico
              }
            </Card>
          </>
        )}

        <h2 style={tituloSecao}>
          Diagnóstico por área
        </h2>

        {areas.length === 0 ? (
          <Card>
            Nenhuma análise por área
            registrada.
          </Card>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {areas.map(
              (area, index) => {
                const info =
                  scoreInfo(
                    area.score
                  );

                return (
                  <Card key={index}>
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        gap: 15,
                        marginBottom: 10,
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
                          {area.nivel ||
                            ""}
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
                        {area.score ??
                          "-"}
                      </div>
                    </div>

                    {area.resumo && (
                      <p
                        style={{
                          lineHeight:
                            1.55,
                        }}
                      >
                        {area.resumo}
                      </p>
                    )}

                    <div
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(210px,1fr))",
                        gap: 10,
                      }}
                    >
                      <ListaInterna
                        titulo="Achados"
                        itens={
                          area.achados
                        }
                      />

                      <ListaInterna
                        titulo="Causas prováveis"
                        itens={
                          area.causasProvaveis
                        }
                      />

                      <ListaInterna
                        titulo="Riscos"
                        itens={
                          area.riscos
                        }
                      />

                      <ListaInterna
                        titulo="Recomendações"
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

        <h2 style={tituloSecao}>
          Perguntas e respostas
        </h2>

        <Card
          style={{
            padding: 0,
            overflowX: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse:
                "collapse",
              minWidth: 720,
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>
                  Área
                </th>

                <th style={thStyle}>
                  Tema
                </th>

                <th style={thStyle}>
                  Pergunta
                </th>

                <th style={thStyle}>
                  Resposta
                </th>

                <th style={thStyle}>
                  Peso
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
                    <tr key={index}>
                      <td
                        style={tdStyle}
                      >
                        {pergunta.area ||
                          "-"}
                      </td>

                      <td
                        style={tdStyle}
                      >
                        {pergunta.tema ||
                          "-"}
                      </td>

                      <td
                        style={tdStyle}
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
                        style={tdStyle}
                      >
                        {pergunta.peso ||
                          "-"}
                      </td>
                    </tr>
                  )
                )
              ) : (
                <tr>
                  <td
                    colSpan="5"
                    style={{
                      ...tdStyle,
                      textAlign:
                        "center",
                    }}
                  >
                    Nenhuma pergunta
                    armazenada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </main>
    </div>
  );
}

function ListaInterna({
  titulo,
  itens,
}) {
  const lista =
    normalizarLista(itens);

  return (
    <div
      style={{
        background: "#F7F8FB",
        borderRadius: 9,
        padding: 11,
      }}
    >
      <strong
        style={{
          display: "block",
          fontSize: 11,
          marginBottom: 6,
        }}
      >
        {titulo}
      </strong>

      {lista.length ? (
        <ul
          style={{
            margin: 0,
            paddingLeft: 17,
            fontSize: 11.5,
            lineHeight: 1.5,
          }}
        >
          {lista.map(
            (item, index) => (
              <li key={index}>
                {item}
              </li>
            )
          )}
        </ul>
      ) : (
        <span
          style={{
            fontSize: 11,
            color: MUTED,
          }}
        >
          Sem informação.
        </span>
      )}
    </div>
  );
}

export default function Admin() {
  const [token, setToken] =
    useState(
      () =>
        sessionStorage.getItem(
          "finder_admin_token"
        ) || ""
    );

  const [diagnosticoId, setDiagnosticoId] =
    useState(null);

  function sair() {
    sessionStorage.removeItem(
      "finder_admin_token"
    );

    setToken("");
    setDiagnosticoId(null);
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
          setDiagnosticoId(null)
        }
      />
    );
  }

  return (
    <ListaDiagnosticos
      token={token}
      onAbrir={setDiagnosticoId}
      onLogout={sair}
    />
  );
}

const tituloSecao = {
  fontFamily: DISPLAY_FONT,
  fontSize: 20,
  margin: "25px 0 10px",
};

const thStyle = {
  background: ICE,
  padding: "10px 9px",
  textAlign: "left",
  color: NAVY,
  fontSize: 11,
};

const tdStyle = {
  borderBottom:
    "1px solid #E5E8EE",
  padding: "10px 9px",
  fontSize: 11.5,
  lineHeight: 1.45,
  verticalAlign: "top",
};
