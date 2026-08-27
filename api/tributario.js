const OPENAI_URL =
  "https://api.openai.com/v1";

const MODEL =
  process.env.OPENAI_TRIBUTARIO_MODEL ||
  "gpt-5.6";

const MAX_FILE_BYTES =
  3 * 1024 * 1024;

function send(
  res,
  status,
  body
) {
  return res
    .status(status)
    .json(body);
}

function stripDataUrl(
  value
) {
  const text =
    String(
      value || ""
    );

  const idx =
    text.indexOf(
      "base64,"
    );

  return idx >= 0
    ? text.slice(
        idx + 7
      )
    : text;
}

function outputText(
  data
) {
  if (
    typeof data?.output_text ===
    "string"
  ) {
    return data.output_text;
  }

  const texts = [];

  for (
    const item of
      data?.output ||
      []
  ) {
    for (
      const part of
        item?.content ||
        []
    ) {
      if (
        typeof part?.text ===
        "string"
      ) {
        texts.push(
          part.text
        );
      }
    }
  }

  return texts.join(
    "\n"
  );
}

async function uploadFile(
  req,
  res
) {
  const {
    filename,
    mimeType,
    fileData,
  } =
    req.body ||
    {};

  if (
    !filename ||
    !fileData
  ) {
    return send(
      res,
      400,
      {
        sucesso: false,
        error:
          "Arquivo e nome do arquivo são obrigatórios.",
      }
    );
  }

  const buffer =
    Buffer.from(
      stripDataUrl(
        fileData
      ),
      "base64"
    );

  if (
    !buffer.length
  ) {
    return send(
      res,
      400,
      {
        sucesso: false,
        error:
          "Arquivo vazio.",
      }
    );
  }

  if (
    buffer.length >
    MAX_FILE_BYTES
  ) {
    return send(
      res,
      413,
      {
        sucesso: false,
        error:
          `${filename} ultrapassa 3 MB. Nesta versão, reduza o arquivo ou divida-o.`,
      }
    );
  }

  const form =
    new FormData();

  form.append(
    "purpose",
    "user_data"
  );

  form.append(
    "expires_after[anchor]",
    "created_at"
  );

  form.append(
    "expires_after[seconds]",
    "86400"
  );

  form.append(
    "file",
    new Blob(
      [buffer],
      {
        type:
          mimeType ||
          "application/octet-stream",
      }
    ),
    filename
  );

  const response =
    await fetch(
      `${OPENAI_URL}/files`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: form,
      }
    );

  const data =
    await response
      .json()
      .catch(
        () => null
      );

  if (
    !response.ok ||
    !data?.id
  ) {
    console.error(
      "[tributario][upload]",
      data
    );

    return send(
      res,
      response.status ||
        500,
      {
        sucesso: false,
        error:
          data?.error?.message ||
          "A OpenAI não aceitou o documento.",
      }
    );
  }

  return send(
    res,
    200,
    {
      sucesso: true,
      fileId:
        data.id,
      filename,
      bytes:
        buffer.length,
    }
  );
}

const schema = {
  type: "object",

  properties: {
    resumoExecutivo: {
      type: "string",
    },

    documentosAnalisados: {
      type: "array",
      items: {
        type: "string",
      },
    },

    dadosExtraidos: {
      type: "array",

      items: {
        type: "object",

        properties: {
          campo: {
            type: "string",
          },

          valor: {
            type: "string",
          },

          fonte: {
            type: "string",
          },

          confianca: {
            type: "string",

            enum: [
              "ALTA",
              "MEDIA",
              "BAIXA",
            ],
          },
        },

        required: [
          "campo",
          "valor",
          "fonte",
          "confianca",
        ],

        additionalProperties:
          false,
      },
    },

    pontosAnalise: {
      type: "array",

      items: {
        type: "string",
      },
    },

    riscos: {
      type: "array",

      items: {
        type: "string",
      },
    },

    oportunidades: {
      type: "array",

      items: {
        type: "string",
      },
    },

    divergencias: {
      type: "array",

      items: {
        type: "string",
      },
    },

    dadosFaltantes: {
      type: "array",

      items: {
        type: "string",
      },
    },

    perguntasValidacao: {
      type: "array",

      items: {
        type: "string",
      },
    },

    recomendacaoPreliminar: {
      type: "string",
    },

    confiancaGeral: {
      type: "string",

      enum: [
        "ALTA",
        "MEDIA",
        "BAIXA",
      ],
    },
  },

  required: [
    "resumoExecutivo",
    "documentosAnalisados",
    "dadosExtraidos",
    "pontosAnalise",
    "riscos",
    "oportunidades",
    "divergencias",
    "dadosFaltantes",
    "perguntasValidacao",
    "recomendacaoPreliminar",
    "confiancaGeral",
  ],

  additionalProperties:
    false,
};

async function diagnostico(
  req,
  res
) {
  const body =
    req.body ||
    {};

  const arquivos =
    Array.isArray(
      body.arquivos
    )
      ? body.arquivos
      : [];

  const content =
    [];

  for (
    const arquivo of
      arquivos
  ) {
    if (
      !arquivo?.fileId
    ) {
      continue;
    }

    const item = {
      type:
        "input_file",

      file_id:
        arquivo.fileId,
    };

    if (
      String(
        arquivo.filename ||
        ""
      )
        .toLowerCase()
        .endsWith(
          ".pdf"
        )
    ) {
      item.detail =
        "high";
    }

    content.push(
      item
    );
  }

  const contexto = {
    tipoProjeto:
      body.tipoProjeto,

    estrutura:
      body.estrutura,

    modalidade:
      body.modalidade,

    cliente:
      body.cliente,

    empresas:
      body.empresas,

    atividades:
      body.atividades,

    dadosManuais:
      body.dadosManuais,

    arquivos:
      arquivos.map(
        (arquivo) => ({
          filename:
            arquivo.filename,

          bytes:
            arquivo.bytes,
        })
      ),
  };

  content.push({
    type:
      "input_text",

    text: `
Você é o Finder Tax AI, assistente técnico para contadores e consultores tributários no Brasil.

TIPO:
${
  body.tipoProjeto ===
  "reforma"
    ? "Análise de impacto da Reforma Tributária"
    : "Planejamento Tributário"
}

CONTEXTO:
${JSON.stringify(
  contexto,
  null,
  2
)}

TAREFA:

1. Leia TODOS os arquivos enviados.

2. Identifique quais documentos foram efetivamente analisados.

3. Extraia dados tributários, fiscais, contábeis e financeiros relevantes.

4. Cruze os documentos entre si e também com:
   - dados do CNPJ;
   - CNAE principal cadastrado;
   - CNAEs secundários;
   - CNAEs selecionados;
   - atividade principal REAL;
   - descrição real da operação;
   - dados manuais.

5. Nunca invente valores.

6. Quando houver conflito entre documentos, registre em divergencias.

7. Quando um dado necessário não estiver suportado, registre em dadosFaltantes.

8. Para Planejamento Tributário:
   - indique o que precisa ser comparado entre Simples Nacional, Lucro Presumido e Lucro Real;
   - avalie Fator R quando pertinente;
   - avalie folha;
   - pró-labore;
   - retenções;
   - compras;
   - despesas dedutíveis;
   - margens;
   - composição das receitas;
   - segregação das receitas por atividade;
   - impacto dos CNAEs;
   - possibilidade de enquadramento em anexos diferentes;
   - impactos previdenciários;
   - possíveis créditos tributários;
   - riscos fiscais;
   - NÃO declare um regime vencedor sem memória de cálculo suficiente.

9. Para Reforma Tributária:
   - avalie IBS;
   - CBS;
   - possibilidade de créditos;
   - perfil B2B/B2C;
   - cadeia de fornecedores;
   - cadeia de clientes;
   - contratos;
   - margem;
   - precificação;
   - impactos no fluxo de caixa;
   - riscos operacionais;
   - necessidade de adaptação de sistema;
   - possíveis impactos sobre Simples Nacional;
   - NÃO invente alíquotas específicas.

10. Separe claramente:
   - fatos encontrados;
   - dados extraídos;
   - divergências;
   - hipóteses;
   - oportunidades;
   - recomendações.

11. Gere perguntas objetivas para o consultor validar.

12. A recomendação deve ser PRELIMINAR e deixar claro o que ainda deve ser calculado ou confirmado.

FONTES:

No campo "fonte" de cada dado extraído, informe o nome do documento que sustentou o valor.

QUALIDADE:

Se os documentos não forem suficientes, diga isso claramente.

Não trate um CNAE cadastrado na Receita Federal automaticamente como atividade efetivamente exercida.

A atividade principal REAL informada pelo cliente ou consultor deve ser considerada em conjunto com os documentos.

Não invente faturamento, folha, despesas, margem ou tributos.

Quando houver números conflitantes entre documentos, não escolha arbitrariamente um deles.

Informe a divergência e solicite validação.
`,
  });

  const payload = {
    model:
      MODEL,

    input: [
      {
        role:
          "user",

        content,
      },
    ],

    reasoning: {
      effort:
        "medium",
    },

    text: {
      format: {
        type:
          "json_schema",

        name:
          "finder_tax_diagnostico",

        strict:
          true,

        schema,
      },
    },
  };

  const response =
    await fetch(
      `${OPENAI_URL}/responses`,
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${process.env.OPENAI_API_KEY}`,

          "content-type":
            "application/json",
        },

        body:
          JSON.stringify(
            payload
          ),
      }
    );

  const data =
    await response
      .json()
      .catch(
        () => null
      );

  if (
    !response.ok
  ) {
    console.error(
      "[tributario][responses]",
      data
    );

    return send(
      res,
      response.status ||
        500,
      {
        sucesso:
          false,

        error:
          data?.error?.message ||
          "Falha na análise com IA.",
      }
    );
  }

  const text =
    outputText(
      data
    );

  let result;

  try {
    result =
      JSON.parse(
        text
      );
  } catch {
    console.error(
      "[tributario][json]",
      text
    );

    return send(
      res,
      500,
      {
        sucesso:
          false,

        error:
          "A IA respondeu, mas o diagnóstico não veio em formato válido.",
      }
    );
  }

  return send(
    res,
    200,
    {
      sucesso:
        true,

      modelo:
        MODEL,

      diagnostico: {
        ...result,

        pontos:
          result.pontosAnalise ||
          [],

        conclusao:
          result.resumoExecutivo ||
          "",
      },

      usage:
        data?.usage ||
        null,
    }
  );
}

export default async function handler(
  req,
  res
) {
  if (
    req.method !==
    "POST"
  ) {
    return send(
      res,
      405,
      {
        sucesso:
          false,

        error:
          "Método não permitido.",
      }
    );
  }

  if (
    !process.env
      .OPENAI_API_KEY
  ) {
    return send(
      res,
      500,
      {
        sucesso:
          false,

        error:
          "OPENAI_API_KEY não configurada na Vercel.",
      }
    );
  }

  const action =
    String(
      req.query?.action ||
      ""
    );

  try {
    if (
      action ===
      "upload-file"
    ) {
      return await uploadFile(
        req,
        res
      );
    }

    if (
      action ===
      "diagnostico"
    ) {
      return await diagnostico(
        req,
        res
      );
    }

    return send(
      res,
      400,
      {
        sucesso:
          false,

        error:
          "Ação tributária inválida.",
      }
    );
  } catch (
    error
  ) {
    console.error(
      "[tributario]",
      error
    );

    return send(
      res,
      500,
      {
        sucesso:
          false,

        error:
          error?.message ||
          "Erro interno no módulo tributário.",
      }
    );
  }
}
