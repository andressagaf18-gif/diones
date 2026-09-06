// DESTINO: /api/asaas.js
// Integração unificada Asaas: saúde, cobrança Pix, consulta e webhook.

const PLANOS = Object.freeze({
  INICIAL: {
    nome: "Diagnóstico Inicial",
    valor: 29.90
  },
  COMPLETO: {
    nome: "Diagnóstico Completo",
    valor: 299.90
  },
  ESPECIALISTA: {
    nome: "Diagnóstico com Visão Especialista",
    valor: 799.90
  }
});

function somenteNumeros(valor) {
  return String(valor ?? "").replace(/\D/g, "");
}

function texto(valor) {
  return String(valor ?? "").trim();
}

function dataVencimento(dias = 1) {
  const data = new Date();
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

function obterBody(req) {
  if (!req.body) return {};

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return req.body;
}

function configuracaoAsaas() {
  const apiKey = process.env.ASAAS_API_KEY;
  const apiUrl =
    process.env.ASAAS_API_URL || "https://api.asaas.com/v3";

  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não configurada na Vercel.");
  }

  return {
    apiKey,
    apiUrl: apiUrl.replace(/\/+$/, "")
  };
}

async function requisicaoAsaas(caminho, opcoes = {}) {
  const { apiKey, apiUrl } = configuracaoAsaas();

  const resposta = await fetch(`${apiUrl}${caminho}`, {
    ...opcoes,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "FinderDiagnostico/1.0",
      access_token: apiKey,
      ...(opcoes.headers || {})
    }
  });

  const conteudo = await resposta.text();

  let dados = {};

  if (conteudo) {
    try {
      dados = JSON.parse(conteudo);
    } catch {
      dados = {
        message: conteudo
      };
    }
  }

  if (!resposta.ok) {
    const erro = new Error(
      dados?.errors?.[0]?.description ||
        dados?.message ||
        `Erro ${resposta.status} na API do Asaas.`
    );

    erro.status = resposta.status;
    erro.dados = dados;

    throw erro;
  }

  return dados;
}

async function localizarOuCriarCliente(cliente, diagnosticoId) {
  const nome = texto(cliente?.nome);
  const email = texto(cliente?.email);
  const cpfCnpj = somenteNumeros(cliente?.cpfCnpj);
  const telefone = somenteNumeros(cliente?.telefone);

  if (!nome) {
    throw new Error("Informe o nome do cliente.");
  }

  if (![11, 14].includes(cpfCnpj.length)) {
    throw new Error("Informe um CPF ou CNPJ válido.");
  }

  const busca = await requisicaoAsaas(
    `/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}&limit=1`,
    {
      method: "GET"
    }
  );

  if (Array.isArray(busca.data) && busca.data.length > 0) {
    return busca.data[0];
  }

  const novoCliente = {
    name: nome,
    cpfCnpj,
    externalReference: texto(diagnosticoId),
    notificationDisabled: false
  };

  if (email) {
    novoCliente.email = email;
  }

  if (telefone) {
    novoCliente.mobilePhone = telefone;
  }

  return requisicaoAsaas("/customers", {
    method: "POST",
    body: JSON.stringify(novoCliente)
  });
}

async function criarCobranca(req, res) {
  const body = obterBody(req);

  const planoCodigo = texto(body.plano).toUpperCase();
  const diagnosticoId = texto(body.diagnosticoId);
  const plano = PLANOS[planoCodigo];

  if (!plano) {
    return res.status(400).json({
      ok: false,
      message: "Plano inválido.",
      planosPermitidos: Object.keys(PLANOS)
    });
  }

  if (!diagnosticoId) {
    return res.status(400).json({
      ok: false,
      message: "diagnosticoId é obrigatório."
    });
  }

  /*
   * O preço não é recebido do frontend.
   * Ele é definido exclusivamente pela tabela PLANOS do servidor.
   */
  const cliente = await localizarOuCriarCliente(
    body.cliente,
    diagnosticoId
  );

  const referencia = `${diagnosticoId}:${planoCodigo}`;

  const cobranca = await requisicaoAsaas("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: cliente.id,
      billingType: "PIX",
      value: plano.valor,
      dueDate: dataVencimento(1),
      description: `${plano.nome} — Finder of Solutions`,
      externalReference: referencia
    })
  });

  const qrCode = await requisicaoAsaas(
    `/payments/${encodeURIComponent(cobranca.id)}/pixQrCode`,
    {
      method: "GET"
    }
  );

  /*
   * IMPORTANTE:
   * Aqui o sistema deve salvar no banco:
   *
   * diagnosticoId
   * planoCodigo
   * plano.valor
   * cliente.id
   * cobranca.id
   * referencia
   * statusPagamento: "PENDENTE"
   * relatorioLiberado: false
   */

  return res.status(201).json({
    ok: true,
    diagnosticoId,
    plano: planoCodigo,
    nomePlano: plano.nome,
    valor: plano.valor,
    customerId: cliente.id,
    paymentId: cobranca.id,
    status: cobranca.status,
    dueDate: cobranca.dueDate,
    externalReference: referencia,
    invoiceUrl: cobranca.invoiceUrl || null,
    pix: {
      payload: qrCode.payload || null,
      encodedImage: qrCode.encodedImage || null,
      expirationDate: qrCode.expirationDate || null
    }
  });
}

async function consultarPagamento(req, res) {
  const paymentId = texto(req.query?.id);

  if (!paymentId || !paymentId.startsWith("pay_")) {
    return res.status(400).json({
      ok: false,
      message: "Informe um ID de pagamento válido."
    });
  }

  const pagamento = await requisicaoAsaas(
    `/payments/${encodeURIComponent(paymentId)}`,
    {
      method: "GET"
    }
  );

  const pago = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(
    pagamento.status
  );

  return res.status(200).json({
    ok: true,
    paymentId: pagamento.id,
    status: pagamento.status,
    pago,
    valor: pagamento.value,
    descricao: pagamento.description,
    externalReference: pagamento.externalReference,
    dueDate: pagamento.dueDate,
    paymentDate: pagamento.paymentDate || null,
    clientPaymentDate: pagamento.clientPaymentDate || null
  });
}

async function receberWebhook(req, res) {
  const tokenEsperado = process.env.ASAAS_WEBHOOK_TOKEN;
  const tokenRecebido = req.headers["asaas-access-token"];

  if (!tokenEsperado) {
    console.error("ASAAS_WEBHOOK_TOKEN não configurado.");

    return res.status(500).json({
      ok: false,
      message: "Token do webhook não configurado."
    });
  }

  if (!tokenRecebido || tokenRecebido !== tokenEsperado) {
    console.warn("Webhook Asaas recusado: token inválido.");

    return res.status(401).json({
      ok: false,
      message: "Token inválido."
    });
  }

  const body = obterBody(req);
  const eventoId = texto(body.id);
  const evento = texto(body.event);
  const pagamento = body.payment || {};

  if (!evento) {
    return res.status(400).json({
      ok: false,
      message: "Evento não informado."
    });
  }

  console.log("Webhook Asaas:", {
    eventoId: eventoId || null,
    evento,
    paymentId: pagamento.id || null,
    status: pagamento.status || null,
    valor: pagamento.value ?? null,
    externalReference: pagamento.externalReference || null
  });

  switch (evento) {
    case "PAYMENT_RECEIVED":
      /*
       * LIBERAR RELATÓRIO:
       *
       * 1. Verificar se eventoId já foi processado;
       * 2. Separar diagnosticoId e plano:
       *
       * const [diagnosticoId, plano] =
       *   pagamento.externalReference.split(":");
       *
       * 3. Localizar o diagnóstico no banco;
       * 4. Confirmar paymentId, plano e valor;
       * 5. Salvar:
       *
       * statusPagamento: "PAGO"
       * relatorioLiberado: true
       * asaasPaymentId: pagamento.id
       * dataPagamento: new Date().toISOString()
       * webhookEventoId: eventoId
       */
      break;

    case "PAYMENT_OVERDUE":
      /*
       * Manter bloqueado:
       *
       * statusPagamento: "VENCIDO"
       * relatorioLiberado: false
       */
      break;

    case "PAYMENT_REFUNDED":
      /*
       * Revogar acesso:
       *
       * statusPagamento: "ESTORNADO"
       * relatorioLiberado: false
       */
      break;

    case "PAYMENT_DELETED":
      /*
       * Cancelar:
       *
       * statusPagamento: "CANCELADO"
       * relatorioLiberado: false
       */
      break;

    default:
      console.log(`Evento ignorado: ${evento}`);
  }

  return res.status(200).json({
    ok: true,
    received: true
  });
}

export default async function handler(req, res) {
  try {
    const acao = texto(req.query?.acao).toLowerCase();

    // Teste pelo navegador:
    // GET /api/asaas
    if (req.method === "GET" && !acao) {
      return res.status(200).json({
        ok: true,
        service: "Finder Diagnóstico + Asaas",
        environment:
          process.env.ASAAS_API_URL?.includes("sandbox")
            ? "sandbox"
            : "production",
        actions: {
          criar: "POST /api/asaas?acao=criar",
          consultar: "GET /api/asaas?acao=consultar&id=pay_xxx",
          webhook: "POST /api/asaas?acao=webhook"
        }
      });
    }

    if (req.method === "POST" && acao === "criar") {
      return await criarCobranca(req, res);
    }

    if (req.method === "GET" && acao === "consultar") {
      return await consultarPagamento(req, res);
    }

    if (req.method === "POST" && acao === "webhook") {
      return await receberWebhook(req, res);
    }

    return res.status(404).json({
      ok: false,
      message: "Operação não encontrada."
    });
  } catch (error) {
    console.error("Erro na integração Asaas:", {
      message: error?.message,
      status: error?.status,
      dados: error?.dados
    });

    return res.status(
      Number.isInteger(error?.status) &&
        error.status >= 400 &&
        error.status <= 599
        ? error.status
        : 500
    ).json({
      ok: false,
      message: error?.message || "Erro interno na integração com o Asaas."
    });
  }
}
