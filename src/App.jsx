{step === "resultado" && empresaPrincipal && gruposSelecionados.length > 0 && areaMaisFraca && (
  <div
    style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
    }}
  >

    {/* ===================================================== */}
    {/* CABEÇALHO DO RESULTADO */}
    {/* ===================================================== */}

    <div
      style={{
        background: tierDe(areaMaisFraca.score).bg,
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
        display: "flex",
        gap: 10,
      }}
    >
      <Flame
        size={18}
        color={tierDe(areaMaisFraca.score).color}
        style={{
          flexShrink: 0,
          marginTop: 1,
        }}
      />

      <p
        style={{
          fontSize: 12,
          color: tierDe(areaMaisFraca.score).color,
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        A área que mais merece atenção hoje é{" "}
        <strong>{areaMaisFraca.label}</strong>.

        {" "}

        O resultado indica nível{" "}
        <strong>
          {tierDe(areaMaisFraca.score).label.toUpperCase()}
        </strong>{" "}
        nessa área, com sinais que podem estar afetando
        resultado, organização ou capacidade de crescimento.
      </p>
    </div>

    {/* ===================================================== */}
    {/* SCORE */}
    {/* ===================================================== */}

    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "6px 0 14px",
      }}
    >
      <ScoreRing
        score={score}
        color={tierGeral.color}
      />

      <span
        style={{
          ...badgeStyle,
          background: tierGeral.bg,
          color: tierGeral.color,
          marginTop: 10,
          fontWeight: 700,
        }}
      >
        {tierGeral.label}
      </span>
    </div>

    <p
      style={{
        fontSize: 12,
        color: MUTED,
        textAlign: "center",
        margin: "0 0 4px",
        fontWeight: 700,
      }}
    >
      {empresaPrincipal.razao}
    </p>

    <p
      style={{
        fontSize: 11,
        color: "#9AA3B5",
        textAlign: "center",
        margin: "0 0 18px",
        lineHeight: 1.4,
      }}
    >
      {categoriaPrincipal}

      {" · "}

      {colaboradores} colaboradores

      {" · "}

      {gruposSelecionados
        .map((g) => g.label)
        .join(", ")}
    </p>

    {/* ===================================================== */}
    {/* O QUE ENTENDEMOS DO NEGÓCIO */}
    {/* ===================================================== */}

    <p style={sectionTitleStyle}>
      O que entendemos sobre o seu negócio
    </p>

    <div
      style={{
        background: "#F7F8FB",
        borderRadius: 12,
        padding: 13,
        marginBottom: 14,
        border: "1px solid #E6E9EF",
      }}
    >
      <p
        style={{
          fontSize: 11.8,
          color: NAVY,
          margin: 0,
          lineHeight: 1.55,
        }}
      >
        <strong>
          {negocioInterpretado?.subsegmento ||
            negocioInterpretado?.segmento ||
            categoriaPrincipal}
        </strong>

        {negocioInterpretado?.modeloOperacional
          ? ` — ${negocioInterpretado.modeloOperacional}`
          : ""}.
      </p>

      {descricaoNegocio && (
        <p
          style={{
            fontSize: 11.2,
            color: MUTED,
            margin: "7px 0 0",
            lineHeight: 1.5,
          }}
        >
          Com base no que você informou, entendemos sua
          operação como: {descricaoNegocio}.
        </p>
      )}
    </div>

    {/* ===================================================== */}
    {/* RESUMO EXECUTIVO */}
    {/* ===================================================== */}

    {resumoExecutivo && (
      <>
        <p style={sectionTitleStyle}>
          Leitura executiva
        </p>

        <div
          style={{
            background: "#FFF3EF",
            borderLeft: `4px solid ${CORAL}`,
            borderRadius: 10,
            padding: 13,
            marginBottom: 14,
          }}
        >
          <p
            style={{
              fontSize: 12,
              color: NAVY,
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            {resumoExecutivo}
          </p>
        </div>
      </>
    )}

    {/* ===================================================== */}
    {/* CONEXÃO COM A DOR */}
    {/* ===================================================== */}

    {leituraDaDorIa && (
      <>
        <p style={sectionTitleStyle}>
          O que suas respostas estão mostrando
        </p>

        <div
          style={{
            background: WHITE,
            border: "1px solid #DDE2EA",
            borderRadius: 12,
            padding: 13,
            marginBottom: 12,
          }}
        >
          <p
            style={{
              fontSize: 12,
              color: NAVY,
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            {leituraDaDorIa}
          </p>
        </div>
      </>
    )}

    {/* ===================================================== */}
    {/* CONEXÕES IMPORTANTES */}
    {/* ===================================================== */}

    {causasProvaveisIa.length > 0 && (
      <>
        <p style={sectionTitleStyle}>
          Conexões que merecem atenção
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 15,
          }}
        >
          {causasProvaveisIa
            .slice(0, 3)
            .map((item, i) => (
              <div
                key={i}
                style={{
                  background: "#F7F8FB",
                  borderRadius: 10,
                  padding: 11,
                  border: "1px solid #E6E9EF",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 9,
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "#FFF3EF",
                      color: CORAL,
                      fontSize: 11,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>

                  <p
                    style={{
                      fontSize: 11.7,
                      color: NAVY,
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    {item}
                  </p>
                </div>
              </div>
            ))}
        </div>
      </>
    )}

    {/* ===================================================== */}
    {/* IMPACTOS POSSÍVEIS */}
    {/* ===================================================== */}

    {impactosIa.length > 0 && (
      <>
        <p style={sectionTitleStyle}>
          Onde isso pode estar impactando
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 7,
            marginBottom: 15,
          }}
        >
          {impactosIa
            .slice(0, 4)
            .map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                }}
              >
                <AlertTriangle
                  size={14}
                  color="#993C1D"
                  style={{
                    marginTop: 2,
                    flexShrink: 0,
                  }}
                />

                <p
                  style={{
                    fontSize: 11.7,
                    color: NAVY,
                    margin: 0,
                    lineHeight: 1.45,
                  }}
                >
                  {item}
                </p>
              </div>
            ))}
        </div>
      </>
    )}

    {/* ===================================================== */}
    {/* PONTOS FORTES */}
    {/* ===================================================== */}

    {pontosFortesIa.length > 0 && (
      <>
        <p style={sectionTitleStyle}>
          O que já está funcionando a seu favor
        </p>

        <div
          style={{
            background: "#E1F5EE",
            borderRadius: 11,
            padding: 12,
            marginBottom: 15,
          }}
        >
          {pontosFortesIa
            .slice(0, 3)
            .map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  marginTop: i ? 7 : 0,
                }}
              >
                <CheckCircle2
                  size={14}
                  color="#0F6E56"
                  style={{
                    marginTop: 2,
                    flexShrink: 0,
                  }}
                />

                <p
                  style={{
                    fontSize: 11.7,
                    color: "#0F6E56",
                    margin: 0,
                    lineHeight: 1.45,
                  }}
                >
                  {item}
                </p>
              </div>
            ))}
        </div>
      </>
    )}

    {/* ===================================================== */}
    {/* ALERTA ESTRATÉGICO */}
    {/* ===================================================== */}

    {alertaEstrategicoIa && (
      <>
        <p style={sectionTitleStyle}>
          Alerta estratégico
        </p>

        <div
          style={{
            background: "#FAEEDA",
            borderRadius: 11,
            padding: 13,
            marginBottom: 15,
          }}
        >
          <p
            style={{
              fontSize: 11.8,
              color: "#70410A",
              margin: 0,
              lineHeight: 1.55,
              fontWeight: 600,
            }}
          >
            {alertaEstrategicoIa}
          </p>
        </div>
      </>
    )}

    {/* ===================================================== */}
    {/* PRIORIDADES */}
    {/* ===================================================== */}

    <p style={sectionTitleStyle}>
      Prioridades identificadas
    </p>

    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        marginBottom: 16,
      }}
    >
      {(prioridadesIa.length
        ? prioridadesIa.slice(0, 3)
        : recomendacoesFinal
            .slice(0, 3)
            .map((item) => item.dica)
      ).map((item, i) => (
        <div
          key={i}
          style={{
            background: WHITE,
            border: "1px solid #E1E5EC",
            borderRadius: 10,
            padding: 11,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 9,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                minWidth: 24,
                height: 24,
                borderRadius: 7,
                background: NAVY,
                color: WHITE,
                fontSize: 11,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {i + 1}
            </div>

            <div>
              <p
                style={{
                  fontSize: 11.8,
                  fontWeight: 700,
                  color: NAVY,
                  margin: "1px 0 3px",
                  lineHeight: 1.45,
                }}
              >
                {item}
              </p>

              <p
                style={{
                  fontSize: 10.5,
                  color: MUTED,
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                Esta prioridade merece aprofundamento antes
                da definição do plano de implementação.
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* ===================================================== */}
    {/* OBSERVAÇÃO DO PARTICIPANTE */}
    {/* ===================================================== */}

    {observacao.trim() && (
      <>
        <p style={sectionTitleStyle}>
          Sua observação
        </p>

        <div
          style={{
            background: ICE,
            borderRadius: 10,
            padding: 11,
            marginBottom: 15,
          }}
        >
          <p
            style={{
              fontSize: 11.5,
              color: NAVY,
              margin: 0,
              lineHeight: 1.45,
              fontStyle: "italic",
            }}
          >
            "{observacao.trim()}"
          </p>
        </div>
      </>
    )}

    {/* ===================================================== */}
    {/* POSICIONAMENTO CONSULTIVO */}
    {/* ===================================================== */}

    <div
      style={{
        background: NAVY,
        color: WHITE,
        borderRadius: 14,
        padding: 16,
        marginBottom: 15,
      }}
    >
      <p
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: 17,
          fontWeight: 700,
          margin: "0 0 6px",
        }}
      >
        O diagnóstico identificou mais do que um score.
      </p>

      <p
        style={{
          fontSize: 11.5,
          color: "#D7DDEA",
          margin: "0 0 10px",
          lineHeight: 1.5,
        }}
      >
        As respostas permitiram identificar relações entre
        sintomas, possíveis causas e áreas que merecem
        aprofundamento.

        {" "}

        O próximo passo é validar essas hipóteses e transformar
        as prioridades em um plano de ação adequado à realidade
        da empresa.
      </p>

      <p
        style={{
          fontSize: 10.5,
          color: "#AEB8CA",
          margin: 0,
          lineHeight: 1.45,
        }}
      >
        A análise técnica completa permanece disponível para
        aprofundamento com um especialista da Finder.
      </p>
    </div>

    {/* ===================================================== */}
    {/* STATUS DE REGISTRO */}
    {/* ===================================================== */}

    {envioRelatorio === "sent" && (
      <div
        style={{
          background: "#E1F5EE",
          borderRadius: 10,
          padding: 10,
          marginBottom: 14,
        }}
      >
        <p
          style={{
            fontSize: 11,
            color: "#0F6E56",
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          Seu diagnóstico foi registrado com sucesso.
        </p>
      </div>
    )}

    {envioRelatorio === "error" && (
      <div
        style={{
          background: "#FAECE7",
          borderRadius: 10,
          padding: 10,
          marginBottom: 14,
        }}
      >
        <p
          style={{
            fontSize: 11,
            color: "#993C1D",
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          Seu diagnóstico foi concluído. Houve uma falha em uma
          etapa de envio, mas o resultado permanece disponível
          nesta tela.
        </p>
      </div>
    )}

    {/* ===================================================== */}
    {/* CTA */}
    {/* ===================================================== */}

    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <PrimaryButton
        style={{
          background: NAVY,
          padding: "14px 16px",
        }}
        onClick={() => {
          const numero = "5541989049616";

          const mensagem = encodeURIComponent(
            `Olá! Acabei de realizar o Diagnóstico Empresarial Finder.

Empresa: ${empresaPrincipal?.razao || ""}
Responsável: ${nome || ""}
Score: ${score}/100
Área que mais merece atenção: ${areaMaisFraca?.label || ""}

O resultado fez sentido para mim e gostaria de entender melhor as causas e o plano de ação.`
          );

          window.open(
            `https://wa.me/${numero}?text=${mensagem}`,
            "_blank"
          );
        }}
      >
        <CalendarCheck size={15} />

        Quero entender meu diagnóstico
      </PrimaryButton>

      <button
        onClick={reiniciar}
        style={{
          background: "none",
          border: "none",
          color: MUTED,
          fontSize: 11.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: 7,
          cursor: "pointer",
        }}
      >
        <RotateCcw size={12} />

        Fazer um novo diagnóstico
      </button>
    </div>

    <p
      style={{
        fontSize: 9.8,
        color: "#9AA3B5",
        fontStyle: "italic",
        margin: "14px 0 0",
        lineHeight: 1.45,
        textAlign: "center",
      }}
    >
      Diagnóstico empresarial preliminar elaborado a partir
      das informações fornecidas pelo participante. Os achados
      devem ser validados em análise profissional individualizada.
    </p>

  </div>
)}
