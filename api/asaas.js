import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const PLANOS = Object.freeze({
  INICIAL: {
    nome: "Diagnóstico Inicial",
    valor: 29.90,
  },
  COMPLETO: {
    nome: "Diagnóstico Completo",
    valor: 299.90,
  },
  ESPECIALISTA: {
    nome: "Diagnóstico com Visão Especialista",
    valor: 799.90,
  },
});

const txt = (valor, limite = 500) =>
  String(valor ?? "").trim().slice(0, limite);

const somenteNumeros = (valor) =>
  String(valor ?? "").replace(/\D/g, "");

const normalizarValor = (valor) =>
  Math.round(Number(valor || 0) * 100) / 100;

function obterBody(req) {
  if (!req.body) return {};

  if (typeof req.body === "object") {
    return req.body;
  }

  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function calcularVencimento(dias = 1) {
  const data = new Date();
  data.setUTCDate(data.getUTCDate() + dias);

  return data.toISOString().slice(0, 10);
}

async function garantirTabela() {
  await sql`
    CREATE TABLE IF NOT EXISTS asaas_pagamentos (
      payment_id TEXT PRIMARY KEY,
      diagnostico_id TEXT NOT NULL,
      plano TEXT NOT NULL,
      valor NUMERIC(12,2) NOT NULL,
      customer_id TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      external_reference TEXT NOT NULL UNIQUE,
      evento_id TEXT,
      pago_em TIMESTAMPTZ,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS
      asaas_pagamentos_diagnostico_idx
    ON asaas_pagamentos (diagnostico_id)
  `;
}

function obterConfiguracao() {
  const apiKey = process.env.ASAAS_API_KEY;

  const apiUrl = (
    process.env.ASAAS_API_URL ||
    "https://api.asaas.com/v3"
  ).replace(/\/+$/, "");

  if (!apiKey) {
    throw new Error(
      "ASAAS_API_KEY não configurada."
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL não configurada."
    );
  }

  return {
    apiKey,
    apiUrl,
  };
}

async function chamarAsaas(caminho, opcoes = {}) {
  const {
    apiKey,
    apiUrl,
  } = obterConfiguracao();

  const resposta = await fetch(
    `${apiUrl}${caminho}`,
    {
      ...opcoes,

      headers: {
        "content-type": "application/json",
        "user-agent": "FinderDiagnostico/1.0",
        access_token: apiKey,
        ...(opcoes.headers || {}),
      },
    }
  );

  const conteudo = await resposta.text();

  let dados = {};

  try {
    dados = conteudo
      ? JSON.parse(conteudo)
      : {};
  } catch {
    dados = {
      message: conteudo,
    };
  }

  if (!resposta.ok) {
    const erro = new Error(
      dados?.errors?.[0]?.description ||
      dados?.message ||
      `Erro ${resposta.status} no Asaas.`
    );

    erro.status = resposta.status;

    throw erro;
  }

  return dados;
}

async function localizarOuCriarCliente(
  cliente,
  diagnosticoId
) {
  const nome = txt(cliente?.nome);
  const cpfCnpj = somenteNumeros(
    cliente?.cpfCnpj
  );
  const email = txt(cliente?.email);
  const telefone = somenteNumeros(
    cliente?.telefone
  );

  if (!nome) {
    throw new Error(
      "Informe o nome do pagador."
    );
  }

  if (![11, 14].includes(cpfCnpj.length)) {
    throw new Error(
      "Informe um CPF ou CNPJ válido."
    );
  }

  const busca = await chamarAsaas(
    `/customers?cpfCnpj=${encodeURIComponent(
      cpfCnpj
    )}&limit=1`,
    {
      method: "GET",
    }
  );

  if (
    Array.isArray(busca?.data) &&
    busca.data[0]
  ) {
    return busca.data[0];
  }

  return chamarAsaas(
    "/customers",
    {
      method: "POST",

      body: JSON.stringify({
        name: nome,
        cpfCnpj,

        ...(email
          ? {
              email,
            }
          : {}),

        ...(telefone
          ? {
              mobilePhone: telefone,
            }
          : {}),

        externalReference:
          `diagnostico:${diagnosticoId}`,
      }),
    }
  );
}

function formatarCobranca(
  pagamento,
  qrCode,
  diagnosticoId,
  codigoPlano,
  plano
) {
  return {
    ok: true,
    diagnosticoId,

    plano: codigoPlano,
    nomePlano: plano.nome,
    valor: plano.valor,

    paymentId: pagamento.id,
    status: pagamento.status,

    invoiceUrl:
      pagamento.invoiceUrl || null,

    pix: {
      payload:
        qrCode.payload || null,

      encodedImage:
        qrCode.encodedImage || null,

      expirationDate:
        qrCode.expirationDate || null,
    },
  };
}

async function criarCobranca(req, res) {
  await garantirTabela();

  const body = obterBody(req);

  const diagnosticoId = txt(
    body.diagnosticoId,
    100
  );

  const codigoPlano = txt(
    body.plano,
    30
  ).toUpperCase();

  const plano = PLANOS[codigoPlano];

  if (!diagnosticoId) {
    return res.status(400).json({
      ok: false,
      error:
        "diagnosticoId é obrigatório.",
    });
  }

  if (!plano) {
    return res.status(400).json({
      ok: false,
      error: "Plano inválido.",
    });
  }

  const diagnostico = await sql`
    SELECT id
    FROM diagnosticos
    WHERE id::text = ${diagnosticoId}
    LIMIT 1
  `;

  if (!diagnostico?.length) {
    return res.status(404).json({
      ok: false,
      error:
        "Diagnóstico não encontrado.",
    });
  }

  const cobrancaExistente = await sql`
    SELECT
      payment_id,
      status
    FROM asaas_pagamentos
    WHERE
      diagnostico_id = ${diagnosticoId}
      AND plano = ${codigoPlano}
      AND status NOT IN (
        'REFUNDED',
        'DELETED',
        'OVERDUE'
      )
    ORDER BY criado_em DESC
    LIMIT 1
  `;

  if (
    cobrancaExistente?.[0]?.payment_id
  ) {
    const paymentId =
      cobrancaExistente[0].payment_id;

    const pagamento =
      await chamarAsaas(
        `/payments/${encodeURIComponent(
          paymentId
        )}`,
        {
          method: "GET",
        }
      );

    const qrCode =
      await chamarAsaas(
        `/payments/${encodeURIComponent(
          paymentId
        )}/pixQrCode`,
        {
          method: "GET",
        }
      );

    return res.status(200).json(
      formatarCobranca(
        pagamento,
        qrCode,
        diagnosticoId,
        codigoPlano,
        plano
      )
    );
  }

  const cliente =
    await localizarOuCriarCliente(
      body.cliente,
      diagnosticoId
    );

  const identificador =
    Date.now().toString(36);

  const referencia =
    `${diagnosticoId}:${codigoPlano}:${identificador}`;

  const pagamento =
    await chamarAsaas(
      "/payments",
      {
        method: "POST",

        body: JSON.stringify({
          customer:
            cliente.id,

          billingType:
            "PIX",

          value:
            plano.valor,

          dueDate:
            calcularVencimento(1),

          description:
            `${plano.nome} — Finder of Solutions`,

          externalReference:
            referencia,
        }),
      }
    );

  const qrCode =
    await chamarAsaas(
      `/payments/${encodeURIComponent(
        pagamento.id
      )}/pixQrCode`,
      {
        method: "GET",
      }
    );

  await sql`
    INSERT INTO asaas_pagamentos (
      payment_id,
      diagnostico_id,
      plano,
      valor,
      customer_id,
      status,
      external_reference
    )
    VALUES (
      ${pagamento.id},
      ${diagnosticoId},
      ${codigoPlano},
      ${plano.valor},
      ${cliente.id},
      ${pagamento.status || "PENDING"},
      ${referencia}
    )
    ON CONFLICT (payment_id)
    DO NOTHING
  `;

  return res.status(201).json(
    formatarCobranca(
      pagamento,
      qrCode,
      diagnosticoId,
      codigoPlano,
      plano
    )
  );
}

async function consultarPagamento(
  req,
  res
) {
  await garantirTabela();

  const paymentId = txt(
    req.query?.id,
    100
  );

  if (
    !paymentId.startsWith("pay_")
  ) {
    return res.status(400).json({
      ok: false,
      error:
        "Pagamento inválido.",
    });
  }

  const rows = await sql`
    SELECT
      payment_id,
      diagnostico_id,
      plano,
      valor,
      status,
      pago_em
    FROM asaas_pagamentos
    WHERE payment_id = ${paymentId}
    LIMIT 1
  `;

  if (!rows?.length) {
    return res.status(404).json({
      ok: false,
      error:
        "Pagamento não encontrado.",
    });
  }

  const pagamento = rows[0];

  const pago = [
    "RECEIVED",
    "CONFIRMED",
    "RECEIVED_IN_CASH",
  ].includes(pagamento.status);

  return res.status(200).json({
    ok: true,

    paymentId:
      pagamento.payment_id,

    diagnosticoId:
      pagamento.diagnostico_id,

    plano:
      pagamento.plano,

    valor:
      Number(pagamento.valor),

    status:
      pagamento.status,

    pago,

    relatorioLiberado:
      pago,

    pagoEm:
      pagamento.pago_em,
  });
}

async function receberWebhook(
  req,
  res
) {
  const tokenEsperado =
    process.env.ASAAS_WEBHOOK_TOKEN;

  const tokenRecebido =
    req.headers["asaas-access-token"];

  if (!tokenEsperado) {
    return res.status(500).json({
      ok: false,
      error:
        "Webhook sem token configurado.",
    });
  }

  if (
    !tokenRecebido ||
    tokenRecebido !== tokenEsperado
  ) {
    return res.status(401).json({
      ok: false,
      error: "Token inválido.",
    });
  }

  await garantirTabela();

  const body = obterBody(req);

  const eventoId = txt(
    body.id,
    180
  );

  const evento = txt(
    body.event,
    80
  ).toUpperCase();

  const pagamento =
    body.payment || {};

  const paymentId = txt(
    pagamento.id,
    100
  );

  if (!evento || !paymentId) {
    return res.status(200).json({
      ok: true,
      ignored: true,
    });
  }

  const rows = await sql`
    SELECT *
    FROM asaas_pagamentos
    WHERE payment_id = ${paymentId}
    LIMIT 1
  `;

  if (!rows?.length) {
    return res.status(200).json({
      ok: true,
      ignored: true,
      reason:
        "Pagamento externo.",
    });
  }

  const pagamentoSalvo =
    rows[0];

  if (
    pagamentoSalvo.evento_id &&
    pagamentoSalvo.evento_id === eventoId
  ) {
    return res.status(200).json({
      ok: true,
      duplicate: true,
    });
  }

  if (
    evento === "PAYMENT_RECEIVED" ||
    evento === "PAYMENT_CONFIRMED"
  ) {
    const plano =
      PLANOS[pagamentoSalvo.plano];

    const valorRecebido =
      normalizarValor(
        pagamento.value
      );

    const valorEsperado =
      normalizarValor(
        plano?.valor
      );

    if (
      !plano ||
      valorRecebido !== valorEsperado
    ) {
      console.error(
        "Valor do pagamento divergente",
        {
          paymentId,
          recebido:
            pagamento.value,

          esperado:
            plano?.valor,
        }
      );

      return res.status(200).json({
        ok: true,
        blocked: true,
        reason:
          "Valor divergente.",
      });
    }

    await sql`
      UPDATE asaas_pagamentos
      SET
        status = ${
          pagamento.status ||
          "RECEIVED"
        },
        evento_id = ${eventoId},
        pago_em = COALESCE(
          pago_em,
          NOW()
        ),
        atualizado_em = NOW()
      WHERE payment_id = ${paymentId}
    `;
  } else if (
    [
      "PAYMENT_OVERDUE",
      "PAYMENT_REFUNDED",
      "PAYMENT_DELETED",
    ].includes(evento)
  ) {
    const status =
      pagamento.status ||
      evento.replace(
        "PAYMENT_",
        ""
      );

    await sql`
      UPDATE asaas_pagamentos
      SET
        status = ${status},
        evento_id = ${eventoId},
        atualizado_em = NOW()
      WHERE payment_id = ${paymentId}
    `;
  }

  return res.status(200).json({
    ok: true,
    received: true,
  });
}

export default async function handler(
  req,
  res
) {
  try {
    const acao = txt(
      req.query?.acao,
      30
    ).toLowerCase();

    if (
      req.method === "GET" &&
      !acao
    ) {
      return res.status(200).json({
        ok: true,

        service:
          "Finder Diagnóstico + Asaas",

        environment:
          process.env.ASAAS_API_URL
            ?.includes("sandbox")
            ? "sandbox"
            : "production",
      });
    }

    if (
      req.method === "POST" &&
      acao === "criar"
    ) {
      return await criarCobranca(
        req,
        res
      );
    }

    if (
      req.method === "GET" &&
      acao === "consultar"
    ) {
      return await consultarPagamento(
        req,
        res
      );
    }

    if (
      req.method === "POST" &&
      acao === "webhook"
    ) {
      return await receberWebhook(
        req,
        res
      );
    }

    return res.status(404).json({
      ok: false,
      error:
        "Operação não encontrada.",
    });
  } catch (error) {
    console.error(
      "[asaas]",
      error
    );

    return res
      .status(
        error?.status || 500
      )
      .json({
        ok: false,
        error:
          error?.message ||
          "Erro interno.",
      });
  }
}
