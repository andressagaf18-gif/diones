import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const PLANOS = Object.freeze({
  INICIAL: { nome: "Diagnóstico Inicial", valor: 29.90 },
  COMPLETO: { nome: "Diagnóstico Completo", valor: 299.90 },
  ESPECIALISTA: { nome: "Diagnóstico com Visão Especialista", valor: 799.90 },
});

const txt = (v, n = 500) => String(v ?? "").trim().slice(0, n);
const digits = (v) => String(v ?? "").replace(/\D/g, "");
const money = (v) => Math.round(Number(v || 0) * 100) / 100;

function bodyOf(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

function dueDate(days = 1) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function ensureSchema() {
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
  await sql`CREATE INDEX IF NOT EXISTS asaas_pagamentos_diagnostico_idx ON asaas_pagamentos (diagnostico_id)`;
}

function cfg() {
  const key = process.env.ASAAS_API_KEY;
  const url = (process.env.ASAAS_API_URL || "https://api.asaas.com/v3").replace(/\/+$/, "");
  if (!key) throw new Error("ASAAS_API_KEY não configurada.");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");
  return { key, url };
}

async function asaas(path, options = {}) {
  const { key, url } = cfg();
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "user-agent": "FinderDiagnostico/1.0",
      access_token: key,
      ...(options.headers || {}),
    },
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
  if (!response.ok) {
    const error = new Error(data?.errors?.[0]?.description || data?.message || `Erro ${response.status} no Asaas.`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function customerFor(cliente, diagnosticoId) {
  const name = txt(cliente?.nome);
  const cpfCnpj = digits(cliente?.cpfCnpj);
  const email = txt(cliente?.email);
  const mobilePhone = digits(cliente?.telefone);
  if (!name) throw new Error("Informe o nome do pagador.");
  if (![11, 14].includes(cpfCnpj.length)) throw new Error("Informe um CPF ou CNPJ válido.");

  const found = await asaas(`/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}&limit=1`, { method: "GET" });
  if (found?.data?.[0]) return found.data[0];

  return asaas("/customers", {
    method: "POST",
    body: JSON.stringify({
      name,
      cpfCnpj,
      ...(email ? { email } : {}),
      ...(mobilePhone ? { mobilePhone } : {}),
      externalReference: `diagnostico:${diagnosticoId}`,
    }),
  });
}

async function createCharge(req, res) {
  await ensureSchema();
  const body = bodyOf(req);
  const diagnosticoId = txt(body.diagnosticoId, 100);
  const planCode = txt(body.plano, 30).toUpperCase();
  const plan = PLANOS[planCode];
  if (!diagnosticoId) return res.status(400).json({ ok: false, error: "diagnosticoId é obrigatório." });
  if (!plan) return res.status(400).json({ ok: false, error: "Plano inválido." });

  const diagnostic = await sql`SELECT id FROM diagnosticos WHERE id::text = ${diagnosticoId} LIMIT 1`;
  if (!diagnostic?.length) return res.status(404).json({ ok: false, error: "Diagnóstico não encontrado." });

  const existing = await sql`
    SELECT payment_id, status FROM asaas_pagamentos
    WHERE diagnostico_id = ${diagnosticoId} AND plano = ${planCode}
      AND status NOT IN ('REFUNDED','DELETED','OVERDUE')
    ORDER BY criado_em DESC LIMIT 1
  `;
  if (existing?.[0]?.payment_id) {
    const payment = await asaas(`/payments/${encodeURIComponent(existing[0].payment_id)}`, { method: "GET" });
    const qr = await asaas(`/payments/${encodeURIComponent(existing[0].payment_id)}/pixQrCode`, { method: "GET" });
    return res.status(200).json(formatCharge(payment, qr, diagnosticoId, planCode, plan));
  }

  const customer = await customerFor(body.cliente, diagnosticoId);
  const nonce = Date.now().toString(36);
  const externalReference = `${diagnosticoId}:${planCode}:${nonce}`;
  const payment = await asaas("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customer.id,
      billingType: "PIX",
      value: plan.valor,
      dueDate: dueDate(1),
      description: `${plan.nome} — Finder of Solutions`,
      externalReference,
    }),
  });
  const qr = await asaas(`/payments/${encodeURIComponent(payment.id)}/pixQrCode`, { method: "GET" });

  await sql`
    INSERT INTO asaas_pagamentos
      (payment_id, diagnostico_id, plano, valor, customer_id, status, external_reference)
    VALUES
      (${payment.id}, ${diagnosticoId}, ${planCode}, ${plan.valor}, ${customer.id}, ${payment.status || "PENDING"}, ${externalReference})
    ON CONFLICT (payment_id) DO NOTHING
  `;
  return res.status(201).json(formatCharge(payment, qr, diagnosticoId, planCode, plan));
}

function formatCharge(payment, qr, diagnosticoId, planCode, plan) {
  return {
    ok: true,
    diagnosticoId,
    plano: planCode,
    nomePlano: plan.nome,
    valor: plan.valor,
    paymentId: payment.id,
    status: payment.status,
    invoiceUrl: payment.invoiceUrl || null,
    pix: {
      payload: qr.payload || null,
      encodedImage: qr.encodedImage || null,
      expirationDate: qr.expirationDate || null,
    },
  };
}

async function consult(req, res) {
  await ensureSchema();
  const paymentId = txt(req.query?.id, 100);
  if (!paymentId.startsWith("pay_")) return res.status(400).json({ ok: false, error: "Pagamento inválido." });
  const rows = await sql`
    SELECT payment_id, diagnostico_id, plano, valor, customer_id, status,
      external_reference, pago_em
    FROM asaas_pagamentos WHERE payment_id = ${paymentId} LIMIT 1
  `;
  if (!rows?.length) return res.status(404).json({ ok: false, error: "Pagamento não encontrado." });
  let row = rows[0];

  // O webhook continua sendo a confirmação principal, mas a consulta também
  // reconcilia o pagamento diretamente no Asaas. Assim, uma falha temporária
  // no webhook não mantém bloqueado um cliente que já pagou.
  const paidStatuses = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];
  if (!paidStatuses.includes(String(row.status || "").toUpperCase())) {
    const payment = await asaas(`/payments/${encodeURIComponent(paymentId)}`, { method: "GET" });
    const remoteStatus = txt(payment?.status, 40).toUpperCase();
    const sameReference = txt(payment?.externalReference, 500) === row.external_reference;
    const sameCustomer = !row.customer_id || txt(payment?.customer, 100) === row.customer_id;
    const sameValue = money(payment?.value) === money(row.valor);

    if (!sameReference || !sameCustomer || !sameValue) {
      console.error("Pagamento não corresponde ao registro local", {
        paymentId,
        sameReference,
        sameCustomer,
        sameValue,
      });
      return res.status(409).json({
        ok: false,
        error: "Pagamento não corresponde ao diagnóstico informado.",
      });
    }

    if (paidStatuses.includes(remoteStatus)) {
      await sql`
        UPDATE asaas_pagamentos
        SET status = ${remoteStatus}, pago_em = COALESCE(pago_em, NOW()), atualizado_em = NOW()
        WHERE payment_id = ${paymentId}
      `;
    } else if (["PENDING", "OVERDUE", "REFUNDED", "DELETED", "CANCELLED"].includes(remoteStatus)) {
      await sql`
        UPDATE asaas_pagamentos SET status = ${remoteStatus}, atualizado_em = NOW()
        WHERE payment_id = ${paymentId}
      `;
    }

    const refreshed = await sql`
      SELECT payment_id, diagnostico_id, plano, valor, customer_id, status,
        external_reference, pago_em
      FROM asaas_pagamentos WHERE payment_id = ${paymentId} LIMIT 1
    `;
    row = refreshed[0];
  }

  const paid = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(row.status);
  return res.status(200).json({
    ok: true,
    paymentId: row.payment_id,
    diagnosticoId: row.diagnostico_id,
    plano: row.plano,
    valor: Number(row.valor),
    status: row.status,
    pago: paid,
    relatorioLiberado: paid,
    pagoEm: row.pago_em,
  });
}

async function webhook(req, res) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  const received = req.headers["asaas-access-token"];
  if (!expected) return res.status(500).json({ ok: false, error: "Webhook sem token configurado." });
  if (!received || received !== expected) return res.status(401).json({ ok: false, error: "Token inválido." });

  await ensureSchema();
  const body = bodyOf(req);
  const eventId = txt(body.id, 180);
  const event = txt(body.event, 80).toUpperCase();
  const payment = body.payment || {};
  const paymentId = txt(payment.id, 100);
  if (!event || !paymentId) return res.status(200).json({ ok: true, ignored: true });

  const rows = await sql`SELECT * FROM asaas_pagamentos WHERE payment_id = ${paymentId} LIMIT 1`;
  if (!rows?.length) return res.status(200).json({ ok: true, ignored: true, reason: "Pagamento externo." });
  const stored = rows[0];
  if (stored.evento_id && stored.evento_id === eventId) return res.status(200).json({ ok: true, duplicate: true });

  if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
    const expectedPlan = PLANOS[stored.plano];
    if (!expectedPlan || money(payment.value) !== money(expectedPlan.valor)) {
      console.error("Valor do pagamento divergente", { paymentId, recebido: payment.value, esperado: expectedPlan?.valor });
      return res.status(200).json({ ok: true, blocked: true, reason: "Valor divergente." });
    }
    await sql`
      UPDATE asaas_pagamentos SET status = ${payment.status || "RECEIVED"}, evento_id = ${eventId},
        pago_em = COALESCE(pago_em, NOW()), atualizado_em = NOW()
      WHERE payment_id = ${paymentId}
    `;
  } else if (["PAYMENT_OVERDUE", "PAYMENT_REFUNDED", "PAYMENT_DELETED"].includes(event)) {
    await sql`
      UPDATE asaas_pagamentos SET status = ${payment.status || event.replace("PAYMENT_", "")},
        evento_id = ${eventId}, atualizado_em = NOW()
      WHERE payment_id = ${paymentId}
    `;
  }
  return res.status(200).json({ ok: true, received: true });
}

export default async function handler(req, res) {
  try {
    const action = txt(req.query?.acao, 30).toLowerCase();
    if (req.method === "GET" && !action) {
      return res.status(200).json({ ok: true, service: "Finder Diagnóstico + Asaas", environment: process.env.ASAAS_API_URL?.includes("sandbox") ? "sandbox" : "production" });
    }
    if (req.method === "POST" && action === "criar") return await createCharge(req, res);
    if (req.method === "GET" && action === "consultar") return await consult(req, res);
    if (req.method === "POST" && action === "webhook") return await webhook(req, res);
    return res.status(404).json({ ok: false, error: "Operação não encontrada." });
  } catch (error) {
    console.error("[asaas]", error);
    return res.status(error?.status || 500).json({ ok: false, error: error?.message || "Erro interno." });
  }
}
