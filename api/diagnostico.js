// api/diagnostico.js
// Finder — diagnóstico v2 separado por operação.

import {
  obterMotor,
  normalizarEstrutura,
  contratoSaida,
  instrucoesDoMotor,
} from "./lib/diagnostic-engine.js";

function extrairOutputText(data) {
  if (
    typeof data?.output_text === "string" &&
    data.output_text.trim()
  ) {
    return data.output_text.trim();
  }

  if (!Array.isArray(data?.output)) return "";

  for (const item of data.output) {
    if (
      item?.type !== "message" ||
      !Array.isArray(item.content)
    ) continue;

    for (const content of item.content) {
      if (
        content?.type === "output_text" &&
        content.text
      ) {
        return String(content.text).trim();
      }
    }
  }

  return "";
}

function limparJson(texto) {
  return String(texto || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function objeto(v) {
  return v && typeof v === "object" && !Array.isArray(v)
    ? v
    : {};
}

function lista(v) {
  return Array.isArray(v) ? v : [];
}



function limparCodigoInternoRelatorio(
  valor
) {
  return String(
    valor ||
    ""
  )
    .replace(
      /\s*\(\s*resposta\s*:\s*['"][^'"]*['"]\s+para\s+[a-z0-9_:-]+\s*\)/gi,
      ""
    )
    .replace(
      /\s*[—-]\s*Id\s*:\s*[a-z0-9_:-]+/gi,
      ""
    )
    .replace(
      /\s*[—-]\s*Tipo\s*:\s*[a-z0-9_:-]+/gi,
      ""
    )
    .replace(
      /\s*[—-]\s*Ligado\s*A\s*:\s*[a-z0-9_:-]+/gi,
      ""
    )
    .replace(
      /\s*[—-]\s*Risco\s*Mitigado\s*:\s*[a-z0-9_:-]+/gi,
      ""
    )
    .replace(
      /\s*\([a-z0-9_]+\s*=\s*['"][^'"]*['"]\s*\)/gi,
      ""
    )
    .replace(
      /\s*[—-]\s*(?:ref|c[oó]digo|codigo)\s*:\s*[a-z0-9_:-]+/gi,
      ""
    )
    .replace(
      /\s{2,}/g,
      " "
    )
    .replace(
      /\s+([.,;:])/g,
      "$1"
    )
    .trim();
}

function textoSeguroIa(
  valor,
  fallback = ""
) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return fallback;
  }

  if (
    typeof valor ===
    "string"
  ) {
    return limparCodigoInternoRelatorio(
      valor
    );
  }

  if (
    typeof valor ===
      "number" ||
    typeof valor ===
      "boolean"
  ) {
    return String(valor);
  }

  if (
    typeof valor ===
    "object"
  ) {
    const candidatos = [
      valor.texto,
      valor.descricao,
      valor.titulo,
      valor.label,
      valor.nome,
      valor.item,
      valor.risco,
      valor.recomendacao,
      valor.acao,
      valor.tema,
      valor.motivo,
      valor.resumo,
      valor.achado,
      valor.impacto,
      valor.causa,
    ];

    const encontrado =
      candidatos.find(
        (item) =>
          typeof item ===
            "string" &&
          item.trim()
      );

    if (encontrado) {
      return limparCodigoInternoRelatorio(
        encontrado
      );
    }

    try {
      return JSON.stringify(
        valor
      );
    } catch {
      return fallback;
    }
  }

  return String(valor);
}

function listaTextoIa(
  valor
) {
  return lista(valor)
    .map(
      (item) =>
        textoSeguroIa(
          item
        )
    )
    .filter(Boolean);
}

function mesclarContrato(base, ia) {
  const saida = {
    ...base,
    ...objeto(ia),
  };

  const eixosIA = lista(ia?.eixos);

  saida.eixos = base.eixos.map((eixoBase) => {
    const encontrado =
      eixosIA.find(
        (x) =>
          String(x?.id || "").toLowerCase() ===
          String(eixoBase.id).toLowerCase()
      ) || {};

    return {
      ...eixoBase,
      ...objeto(encontrado),
      achados:
        listaTextoIa(
          encontrado.achados
        ),
      riscos:
        listaTextoIa(
          encontrado.riscos
        ),
      pontosFortes:
        listaTextoIa(
          encontrado.pontosFortes
        ),
      recomendacoes:
        listaTextoIa(
          encontrado.recomendacoes
        ),
    };
  });

  saida.leituraExecutiva =
    textoSeguroIa(
      saida.leituraExecutiva
    );

  saida.nivelGeral =
    textoSeguroIa(
      saida.nivelGeral
    );

  saida.objetivosDeclarados = listaTextoIa(saida.objetivosDeclarados);
  saida.doresPrincipais = listaTextoIa(saida.doresPrincipais);
  saida.impactos = listaTextoIa(saida.impactos);
  saida.causasProvaveis = listaTextoIa(saida.causasProvaveis);
  saida.riscosPrioritarios = listaTextoIa(saida.riscosPrioritarios);
  saida.pontosFortes = listaTextoIa(saida.pontosFortes);
  saida.prioridades = listaTextoIa(saida.prioridades);
  saida.recomendacoes = listaTextoIa(saida.recomendacoes);
  saida.quickWins = listaTextoIa(saida.quickWins);
  saida.indicadores = listaTextoIa(saida.indicadores);
  saida.informacoesFaltantes = listaTextoIa(saida.informacoesFaltantes);
  saida.proximosPassos = listaTextoIa(saida.proximosPassos);

  saida.plano90Dias = {
    dias30:
      listaTextoIa(
        saida?.plano90Dias?.dias30
      ),
    dias60:
      listaTextoIa(
        saida?.plano90Dias?.dias60
      ),
    dias90:
      listaTextoIa(
        saida?.plano90Dias?.dias90
      ),
  };

  saida.visaoAdministracao = {
    oportunidades:
      listaTextoIa(
        saida?.visaoAdministracao?.oportunidades
      ),
    aprofundamentos:
      listaTextoIa(
        saida?.visaoAdministracao?.aprofundamentos
      ),
    riscosComerciais:
      listaTextoIa(
        saida?.visaoAdministracao?.riscosComerciais
      ),
    departamentosSugeridos:
      listaTextoIa(
        saida?.visaoAdministracao?.departamentosSugeridos
      ),
  };

  return saida;
}


function normalizarAreaOperacionalId(
  id
) {
  const valor =
    String(
      id ||
      ""
    )
      .trim()
      .toLowerCase();

  const mapa = {
    contabilidade:
      "contabil_fiscal",
    contabil:
      "contabil_fiscal",
    fiscal:
      "contabil_fiscal",
    contabilidade_fiscal:
      "contabil_fiscal",
    recursos_humanos:
      "rh",
    vendas:
      "comercial",
    comercial_vendas:
      "comercial",
  };

  return (
    mapa[valor] ||
    valor
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      sucesso: false,
      error: "Método não permitido.",
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      sucesso: false,
      error: "OPENAI_API_KEY não configurada.",
    });
  }

  const body = req.body || {};

  const estrutura = normalizarEstrutura(
    body.estruturaNegocio ||
    body?.contextoEstrutura?.estruturaNegocio ||
    body?.perfil?.estruturaNegocio
  );

  const motor =
    obterMotor(estrutura);

  // O checklist e o relatório da Empresa Operacional precisam usar
  // exatamente os departamentos selecionados pelo usuário.
  const eixosSolicitados =
    Array.isArray(
      body?.eixosObrigatorios
    )
      ? body.eixosObrigatorios
          .map(
            (item) =>
              normalizarAreaOperacionalId(
                item?.id ||
                item ||
                ""
              )
          )
          .filter(
            (id) =>
              motor.eixos.includes(
                id
              )
          )
      : [];

  const eixosDasRespostas =
    Array.isArray(
      body?.areas
    )
      ? body.areas
          .map(
            (item) =>
              normalizarAreaOperacionalId(
                item?.id ||
                item?.areaId ||
                ""
              )
          )
          .filter(
            (id) =>
              motor.eixos.includes(
                id
              )
          )
      : [];

  const eixosOperacionais =
    estrutura ===
      "operacional"
      ? [
          ...new Set([
            ...eixosSolicitados,
            ...eixosDasRespostas,
          ]),
        ]
      : null;

  const contrato =
    contratoSaida(
      estrutura,
      eixosOperacionais
    );


  if (
    estrutura ===
      "operacional" &&
    (!eixosOperacionais ||
      eixosOperacionais.length ===
        0)
  ) {
    return res.status(400).json({
      sucesso: false,
      error:
        "Nenhum departamento selecionado para gerar o relatório da Empresa Operacional.",
    });
  }

  if (
    motor.exigeCnpj &&
    !body.cnaePrincipal &&
    !body.cnpj &&
    !body?.empresa?.cnpj
  ) {
    // Não bloqueia o diagnóstico; apenas registra a lacuna.
    contrato.informacoesFaltantes.push(
      "CNPJ/CNAE não informado para uma estrutura empresarial."
    );
  }

  const prompt = `
Você é o motor de diagnóstico consultivo da Finder of Solutions.

${instrucoesDoMotor(
  estrutura,
  eixosOperacionais
)}

OBJETIVO:
Produzir um diagnóstico profundo, útil e acionável.
Não use um relatório empresarial genérico para estruturas diferentes.

CONTRATO DE SAÍDA OBRIGATÓRIO:
${JSON.stringify(contrato, null, 2)}

DADOS RECEBIDOS:
${JSON.stringify(body, null, 2)}

ESCOPO EFETIVO DO RELATÓRIO:
${
  estrutura === "operacional"
    ? (
        eixosOperacionais?.length
          ? eixosOperacionais.join(", ")
          : "Nenhum departamento válido identificado"
      )
    : motor.eixos.join(", ")
}

${
  estrutura === "operacional"
    ? `REGRA CRÍTICA PARA EMPRESA OPERACIONAL:
Analise SOMENTE os departamentos acima.
Não inclua financeiro, tributário, contábil/fiscal, comercial,
marketing, gestão, RH, operacional ou tecnologia se o respectivo
departamento não estiver no escopo efetivo.`
    : ""
}

INSTRUÇÕES DE QUALIDADE:
1. "leituraExecutiva" deve ser escrita especificamente para ${motor.label}.
2. Todos os eixos listados no CONTRATO DE SAÍDA devem existir na saída.
   Na Empresa Operacional, NÃO crie departamentos que não foram selecionados.
3. Se não houver dados suficientes para pontuar um eixo, não invente:
   use score 0 e explique a lacuna nos achados/informacoesFaltantes.
4. Para Pessoa Física, jamais critique ausência de CNAE, faturamento,
   margem, sócios ou estrutura societária.
5. Para Avaliação de Holding, preencha obrigatoriamente
   "viabilidadeHolding" com nível:
   ALTA, MEDIA, BAIXA ou DADOS_INSUFICIENTES.
6. "visaoAdministracao" é interna e pode conter oportunidades comerciais;
   a leitura executiva e recomendações principais devem ser consultivas.
7. O plano 30/60/90 deve ser compatível com a estrutura.
8. Não prescreva produtos financeiros específicos.
9. Não dê certeza jurídica/tributária quando depender de documentos.
10. NUNCA exponha códigos internos, IDs de perguntas, nomes de variáveis, chaves técnicas ou rastreadores no texto exibido ao cliente.
11. NUNCA escreva expressões como "(resposta: 'sim' para fin_q1)", "Id: c1", "Tipo: fato", "Ligado A:", "Risco Mitigado:" ou similares.
12. Use as respostas apenas para construir uma conclusão natural em português. Exemplo: escreva "A conciliação bancária é realizada parcialmente" e NÃO "A conciliação é parcial (resposta: 'parcialmente' para fin_q2)".
`;

  try {
    const resposta = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model:
            process.env.OPENAI_MODEL ||
            "gpt-5-mini",
          input: prompt,
          text: {
            format: {
              type: "json_object",
            },
          },
        }),
      }
    );

    const data = await resposta.json();

    if (!resposta.ok) {
      console.error("[diagnostico-v2] OpenAI:", data);

      return res.status(502).json({
        sucesso: false,
        error: "Falha ao gerar diagnóstico.",
      });
    }

    const texto = extrairOutputText(data);

    if (!texto) {
      return res.status(502).json({
        sucesso: false,
        error: "A IA não retornou conteúdo.",
      });
    }

    let ia;

    try {
      ia = JSON.parse(
        limparJson(texto)
      );
    } catch (error) {
      console.error(
        "[diagnostico-v2] JSON inválido:",
        texto
      );

      return res.status(502).json({
        sucesso: false,
        error: "Diagnóstico retornou JSON inválido.",
      });
    }

    const diagnostico =
      mesclarContrato(
        contrato,
        ia
      );

    diagnostico.estrutura =
      estrutura;

    diagnostico.estruturaLabel =
      motor.label;

    return res.status(200).json({
      sucesso: true,
      estrutura,
      motor: motor.tipo,

      // Contrato principal atual
      diagnostico,

      // Compatibilidade com versões antigas do frontend
      resultado:
        diagnostico,

      escopoRelatorio:
        contrato.eixos.map(
          (eixo) =>
            eixo.id
        ),

      uso:
        data?.usage ||
        null,
    });
  } catch (error) {
    console.error(
      "[diagnostico-v2]",
      error
    );

    return res.status(500).json({
      sucesso: false,
      error:
        "Não foi possível gerar o diagnóstico.",
    });
  }
}
