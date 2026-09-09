import { neon } from "@neondatabase/serverless";
import { exigirAutenticacao } from "./lib/auth.js";

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
  await sql`ALTER TABLE asaas_pagamentos ADD COLUMN IF NOT EXISTS valor_original NUMERIC(12,2)`;
  await sql`ALTER TABLE asaas_pagamentos ADD COLUMN IF NOT EXISTS desconto NUMERIC(12,2) NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE asaas_pagamentos ADD COLUMN IF NOT EXISTS cupom_codigo TEXT`;
  await sql`ALTER TABLE asaas_pagamentos ADD COLUMN IF NOT EXISTS cliente_nome TEXT`;
  await sql`ALTER TABLE asaas_pagamentos ADD COLUMN IF NOT EXISTS cliente_email TEXT`;
  await sql`ALTER TABLE asaas_pagamentos ADD COLUMN IF NOT EXISTS cliente_documento TEXT`;
  await sql`ALTER TABLE asaas_pagamentos ADD COLUMN IF NOT EXISTS forma_pagamento TEXT DEFAULT 'PIX'`;
  await sql`ALTER TABLE asaas_pagamentos ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC(12,2)`;
  await sql`ALTER TABLE asaas_pagamentos ADD COLUMN IF NOT EXISTS taxa NUMERIC(12,2)`;
  await sql`ALTER TABLE asaas_pagamentos ADD COLUMN IF NOT EXISTS confirmado_em TIMESTAMPTZ`;
  await sql`
    CREATE TABLE IF NOT EXISTS asaas_cupons (
      codigo TEXT PRIMARY KEY,
      descricao TEXT,
      tipo TEXT NOT NULL CHECK (tipo IN ('PERCENTUAL','FIXO')),
      valor NUMERIC(12,2) NOT NULL,
      planos TEXT[] NOT NULL DEFAULT ARRAY['INICIAL','COMPLETO','ESPECIALISTA'],
      valor_minimo NUMERIC(12,2) NOT NULL DEFAULT 0,
      inicio_em TIMESTAMPTZ,
      fim_em TIMESTAMPTZ,
      limite_total INTEGER,
      limite_documento INTEGER NOT NULL DEFAULT 1,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS asaas_eventos (
      evento_id TEXT PRIMARY KEY,
      payment_id TEXT,
      evento TEXT NOT NULL,
      status TEXT,
      payload JSONB,
      recebido_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE asaas_cupons ADD COLUMN IF NOT EXISTS descontos_planos JSONB NOT NULL DEFAULT '{}'::jsonb`;
  await sql`CREATE INDEX IF NOT EXISTS asaas_eventos_payment_idx ON asaas_eventos (payment_id, recebido_em DESC)`;
}

async function calcularCupom(codigoRecebido, plano, documento) {
  const codigo = txt(codigoRecebido, 50).toUpperCase();
  if (!codigo) return { codigo: null, desconto: 0, valorFinal: plano.valor };
  const rows = await sql`
    SELECT * FROM asaas_cupons
    WHERE codigo = ${codigo} AND ativo = TRUE
      AND (inicio_em IS NULL OR inicio_em <= NOW())
      AND (fim_em IS NULL OR fim_em >= NOW())
    LIMIT 1
  `;
  if (!rows.length) throw new Error("Cupom inválido, inativo ou vencido.");
  const cupom = rows[0];
  if (!Array.isArray(cupom.planos) || !cupom.planos.includes(plano.codigo)) throw new Error("Cupom não permitido para este plano.");
  if (money(plano.valor) < money(cupom.valor_minimo)) throw new Error("Valor mínimo do cupom não atingido.");
  const usados = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH'))::int AS total,
      COUNT(*) FILTER (WHERE status IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH') AND cliente_documento = ${documento})::int AS documento
    FROM asaas_pagamentos WHERE cupom_codigo = ${codigo}
  `;
  if (cupom.limite_total !== null && usados[0].total >= cupom.limite_total) throw new Error("Limite de utilizações do cupom atingido.");
  if (cupom.limite_documento !== null && usados[0].documento >= cupom.limite_documento) throw new Error("Este CPF/CNPJ já utilizou o cupom.");
  const regraPlano = Number(cupom.descontos_planos?.[plano.codigo]);
  const valorRegra = Number.isFinite(regraPlano) && regraPlano > 0 ? regraPlano : Number(cupom.valor);
  const desconto = cupom.tipo === "PERCENTUAL"
    ? money(plano.valor * valorRegra / 100)
    : money(valorRegra);
  const valorFinal = money(plano.valor - desconto);
  if (desconto <= 0 || valorFinal < 1) throw new Error("Cupom gera um valor de cobrança inválido.");
  return { codigo, desconto, valorFinal };
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
  const planBase = PLANOS[planCode];
  if (!diagnosticoId) return res.status(400).json({ ok: false, error: "diagnosticoId é obrigatório." });
  if (!planBase) return res.status(400).json({ ok: false, error: "Plano inválido." });

  const diagnostic = await sql`SELECT id FROM diagnosticos WHERE id::text = ${diagnosticoId} LIMIT 1`;
  if (!diagnostic?.length) return res.status(404).json({ ok: false, error: "Diagnóstico não encontrado." });

  const documento = digits(body.cliente?.cpfCnpj);
  if (![11, 14].includes(documento.length)) {
    return res.status(400).json({ ok: false, error: "Informe um CPF ou CNPJ válido." });
  }

  // O cupom precisa ser validado antes da busca por cobrança existente.
  // Caso contrário, um Pix antigo sem desconto sempre seria reutilizado.
  const cupom = await calcularCupom(body.cupom, { ...planBase, codigo: planCode }, documento);
  const plan = { ...planBase, valor: cupom.valorFinal };

  const existing = await sql`
    SELECT payment_id, status, valor, valor_original, desconto, cupom_codigo
    FROM asaas_pagamentos
    WHERE diagnostico_id = ${diagnosticoId} AND plano = ${planCode}
      AND status NOT IN ('REFUNDED','DELETED','OVERDUE')
    ORDER BY criado_em DESC LIMIT 1
  `;
  if (existing?.[0]?.payment_id) {
    const anterior = existing[0];
    const payment = await asaas(`/payments/${encodeURIComponent(anterior.payment_id)}`, { method: "GET" });
    const statusRemoto = txt(payment.status, 40).toUpperCase();
    const pago = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(statusRemoto);
    const mesmoCupom = txt(anterior.cupom_codigo, 50).toUpperCase() === txt(cupom.codigo, 50).toUpperCase();
    const mesmoValor = money(payment.value) === money(plan.valor);

    if (pago || (mesmoCupom && mesmoValor)) {
      const qr = pago ? {} : await asaas(`/payments/${encodeURIComponent(anterior.payment_id)}/pixQrCode`, { method: "GET" });
      return res.status(200).json({
        ...formatCharge(payment, qr, diagnosticoId, planCode, { ...planBase, valor: money(payment.value) }),
        valorOriginal: money(anterior.valor_original || planBase.valor),
        desconto: money(anterior.desconto),
        cupom: anterior.cupom_codigo || null,
      });
    }

    // A cobrança ainda não foi paga e o cupom/valor mudou: cancela o Pix
    // anterior antes de gerar outro, evitando duas cobranças abertas.
    await asaas(`/payments/${encodeURIComponent(anterior.payment_id)}`, { method: "DELETE" });
    await sql`
      UPDATE asaas_pagamentos
      SET status = 'DELETED', atualizado_em = NOW()
      WHERE payment_id = ${anterior.payment_id}
    `;
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
      description: `${plan.nome} — Finder of Solutions${cupom.codigo ? ` — Cupom ${cupom.codigo}` : ""}`,
      externalReference,
    }),
  });
  const qr = await asaas(`/payments/${encodeURIComponent(payment.id)}/pixQrCode`, { method: "GET" });

  await sql`
    INSERT INTO asaas_pagamentos
      (payment_id, diagnostico_id, plano, valor, valor_original, desconto, cupom_codigo,
       customer_id, cliente_nome, cliente_email, cliente_documento, forma_pagamento,
       status, external_reference)
    VALUES
      (${payment.id}, ${diagnosticoId}, ${planCode}, ${plan.valor}, ${planBase.valor},
       ${cupom.desconto}, ${cupom.codigo}, ${customer.id}, ${txt(body.cliente?.nome)},
       ${txt(body.cliente?.email)}, ${documento}, 'PIX', ${payment.status || "PENDING"},
       ${externalReference})
    ON CONFLICT (payment_id) DO NOTHING
  `;
  return res.status(201).json({
    ...formatCharge(payment, qr, diagnosticoId, planCode, plan),
    valorOriginal: planBase.valor,
    desconto: cupom.desconto,
    cupom: cupom.codigo,
  });
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

  await sql`
    INSERT INTO asaas_eventos (evento_id, payment_id, evento, status, payload)
    VALUES (${eventId}, ${paymentId}, ${event}, ${txt(payment.status, 40)}, ${JSON.stringify(body)}::jsonb)
    ON CONFLICT (evento_id) DO NOTHING
  `;

  if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
    if (money(payment.value) !== money(stored.valor)) {
      console.error("Valor do pagamento divergente", { paymentId, recebido: payment.value, esperado: stored.valor });
      return res.status(200).json({ ok: true, blocked: true, reason: "Valor divergente." });
    }
    await sql`
      UPDATE asaas_pagamentos SET status = ${payment.status || "RECEIVED"}, evento_id = ${eventId},
        pago_em = COALESCE(pago_em, NOW()), confirmado_em = COALESCE(confirmado_em, NOW()),
        valor_liquido = ${money(payment.netValue)}, taxa = ${money(Number(payment.value || 0) - Number(payment.netValue || 0))},
        forma_pagamento = ${txt(payment.billingType || "PIX", 40)}, atualizado_em = NOW()
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

async function validateCoupon(req, res) {
  await ensureSchema();
  const body = bodyOf(req);
  const planCode = txt(body.plano, 30).toUpperCase();
  const plan = PLANOS[planCode];
  if (!plan) return res.status(400).json({ ok: false, error: "Plano inválido." });
  const documento = digits(body.cpfCnpj);
  if (![11, 14].includes(documento.length)) return res.status(400).json({ ok: false, error: "Informe o CPF/CNPJ antes de aplicar o cupom." });
  const result = await calcularCupom(body.cupom, { ...plan, codigo: planCode }, documento);
  return res.status(200).json({
    ok: true,
    cupom: result.codigo,
    valorOriginal: plan.valor,
    desconto: result.desconto,
    valorFinal: result.valorFinal,
  });
}

async function syncPaymentRow(row) {
  const payment = await asaas(`/payments/${encodeURIComponent(row.payment_id)}`, { method: "GET" });
  if (txt(payment.externalReference, 500) !== row.external_reference) throw new Error("Referência externa divergente.");
  if (money(payment.value) !== money(row.valor)) throw new Error("Valor divergente.");
  const status = txt(payment.status, 40).toUpperCase() || row.status;
  const paid = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(status);
  await sql`
    UPDATE asaas_pagamentos SET
      status = ${status},
      forma_pagamento = ${txt(payment.billingType || row.forma_pagamento || "PIX", 40)},
      valor_liquido = ${payment.netValue == null ? row.valor_liquido : money(payment.netValue)},
      taxa = ${payment.netValue == null ? row.taxa : money(Number(payment.value) - Number(payment.netValue))},
      confirmado_em = ${paid ? (payment.confirmedDate || payment.paymentDate || new Date().toISOString()) : row.confirmado_em},
      pago_em = ${paid ? (row.pago_em || new Date().toISOString()) : row.pago_em},
      atualizado_em = NOW()
    WHERE payment_id = ${row.payment_id}
  `;
  return status;
}

async function adminDashboard(req, res) {
  if (!exigirAutenticacao(req, res, { admin: true })) return;
  await ensureSchema();
  const status = txt(req.query?.status, 40).toUpperCase();
  const plano = txt(req.query?.plano, 30).toUpperCase();
  const busca = txt(req.query?.busca, 100);
  const inicio = txt(req.query?.inicio, 20);
  const fim = txt(req.query?.fim, 20);
  const pagamentos = await sql`
    SELECT payment_id, diagnostico_id, plano, valor, valor_original, desconto,
      cupom_codigo, customer_id, cliente_nome, cliente_email, cliente_documento,
      forma_pagamento, valor_liquido, taxa, status, external_reference,
      evento_id, pago_em, confirmado_em, criado_em, atualizado_em
    FROM asaas_pagamentos
    WHERE (${status} = '' OR status = ${status})
      AND (${plano} = '' OR plano = ${plano})
      AND (${inicio} = '' OR criado_em >= ${inicio || null}::date)
      AND (${fim} = '' OR criado_em < (${fim || null}::date + INTERVAL '1 day'))
      AND (${busca} = '' OR payment_id ILIKE ${`%${busca}%`}
        OR diagnostico_id ILIKE ${`%${busca}%`}
        OR COALESCE(cliente_nome,'') ILIKE ${`%${busca}%`}
        OR COALESCE(cliente_documento,'') ILIKE ${`%${busca}%`})
    ORDER BY criado_em DESC LIMIT 500
  `;
  const resumo = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH'))::int AS recebidos,
      COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pendentes,
      COUNT(*) FILTER (WHERE status IN ('OVERDUE','CANCELLED','DELETED'))::int AS nao_concluidos,
      COUNT(*) FILTER (WHERE status = 'REFUNDED')::int AS estornados,
      COALESCE(SUM(valor) FILTER (WHERE status IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH')),0) AS bruto,
      COALESCE(SUM(valor_liquido) FILTER (WHERE status IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH')),0) AS liquido,
      COALESCE(SUM(taxa) FILTER (WHERE status IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH')),0) AS taxas,
      COALESCE(SUM(desconto),0) AS descontos
    FROM asaas_pagamentos
  `;
  const eventos = await sql`
    SELECT evento_id, payment_id, evento, status, recebido_em
    FROM asaas_eventos ORDER BY recebido_em DESC LIMIT 100
  `;
  return res.status(200).json({ ok: true, resumo: resumo[0], pagamentos, eventos, atualizadoEm: new Date().toISOString() });
}

async function adminFinance(req, res) {
  if (!exigirAutenticacao(req, res, { admin: true })) return;
  const inicio = txt(req.query?.inicio, 10);
  const fim = txt(req.query?.fim, 10);
  const offset = Math.max(0, Number(req.query?.offset) || 0);
  const params = new URLSearchParams({ offset: String(offset), limit: "100" });
  if (inicio) params.set("date[ge]", inicio);
  if (fim) params.set("date[le]", fim);
  const [saldoResult, extratoResult] = await Promise.allSettled([
    asaas("/finance/balance", { method: "GET" }),
    asaas(`/financialTransactions?${params.toString()}`, { method: "GET" }),
  ]);
  return res.status(200).json({
    ok: true,
    saldo: saldoResult.status === "fulfilled" ? saldoResult.value : null,
    extrato: extratoResult.status === "fulfilled" ? extratoResult.value : { data: [] },
    avisos: [
      ...(saldoResult.status === "rejected" ? [`Saldo: ${saldoResult.reason.message}`] : []),
      ...(extratoResult.status === "rejected" ? [`Extrato: ${extratoResult.reason.message}`] : []),
    ],
    atualizadoEm: new Date().toISOString(),
  });
}

async function adminSync(req, res) {
  if (!exigirAutenticacao(req, res, { admin: true })) return;
  await ensureSchema();
  const body = bodyOf(req);
  const paymentId = txt(body.paymentId, 100);
  const rows = paymentId
    ? await sql`SELECT * FROM asaas_pagamentos WHERE payment_id = ${paymentId} LIMIT 1`
    : await sql`SELECT * FROM asaas_pagamentos WHERE status NOT IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH','REFUNDED','DELETED') ORDER BY atualizado_em ASC LIMIT 50`;
  let atualizados = 0;
  const erros = [];
  for (const row of rows) {
    try { await syncPaymentRow(row); atualizados += 1; }
    catch (error) { erros.push({ paymentId: row.payment_id, erro: error.message }); }
  }
  return res.status(200).json({ ok: true, atualizados, erros });
}

async function adminCoupons(req, res) {
  if (!exigirAutenticacao(req, res, { admin: true })) return;
  await ensureSchema();
  if (req.method === "GET") {
    const cupons = await sql`
      SELECT c.*,
        COUNT(p.payment_id) FILTER (WHERE p.status IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH'))::int AS usos,
        COALESCE(SUM(p.desconto) FILTER (WHERE p.status IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH')),0) AS desconto_concedido
      FROM asaas_cupons c LEFT JOIN asaas_pagamentos p ON p.cupom_codigo = c.codigo
      GROUP BY c.codigo ORDER BY c.criado_em DESC
    `;
    return res.status(200).json({ ok: true, cupons });
  }
  const body = bodyOf(req);
  const codigo = txt(body.codigo, 50).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const tipo = txt(body.tipo, 20).toUpperCase();
  const valor = money(body.valor);
  const planos = (Array.isArray(body.planos) ? body.planos : []).map(v => txt(v, 30).toUpperCase()).filter(v => PLANOS[v]);
  const descontosPlanos = Object.fromEntries(planos.map((plano) => [
    plano,
    body.descontosPlanos?.[plano] === "" || body.descontosPlanos?.[plano] == null
      ? valor
      : money(body.descontosPlanos[plano]),
  ]));
  if (codigo.length < 3) return res.status(400).json({ ok: false, error: "Código deve ter pelo menos 3 caracteres." });
  if (!["PERCENTUAL", "FIXO"].includes(tipo)) return res.status(400).json({ ok: false, error: "Tipo inválido." });
  if (valor <= 0 || (tipo === "PERCENTUAL" && valor > 90)) return res.status(400).json({ ok: false, error: "Desconto inválido. Percentual máximo: 90%." });
  if (!planos.length) return res.status(400).json({ ok: false, error: "Selecione ao menos um plano." });
  if (Object.values(descontosPlanos).some(v => v <= 0 || (tipo === "PERCENTUAL" && v > 90))) return res.status(400).json({ ok: false, error: "Informe descontos válidos por plano. Percentual máximo: 90%." });
  await sql`
    INSERT INTO asaas_cupons
      (codigo, descricao, tipo, valor, planos, descontos_planos, valor_minimo, inicio_em, fim_em,
       limite_total, limite_documento, ativo, atualizado_em)
    VALUES (${codigo}, ${txt(body.descricao, 200)}, ${tipo}, ${valor},
      string_to_array(${planos.join(",")}, ','), ${JSON.stringify(descontosPlanos)}::jsonb, ${money(body.valorMinimo)},
      ${body.inicioEm || null}, ${body.fimEm || null},
      ${body.limiteTotal === "" || body.limiteTotal == null ? null : Math.max(1, Number(body.limiteTotal))},
      ${Math.max(1, Number(body.limiteDocumento) || 1)}, ${body.ativo !== false}, NOW())
    ON CONFLICT (codigo) DO UPDATE SET
      descricao = EXCLUDED.descricao, tipo = EXCLUDED.tipo, valor = EXCLUDED.valor,
      planos = EXCLUDED.planos, descontos_planos = EXCLUDED.descontos_planos, valor_minimo = EXCLUDED.valor_minimo,
      inicio_em = EXCLUDED.inicio_em, fim_em = EXCLUDED.fim_em,
      limite_total = EXCLUDED.limite_total, limite_documento = EXCLUDED.limite_documento,
      ativo = EXCLUDED.ativo, atualizado_em = NOW()
  `;
  return res.status(200).json({ ok: true, codigo });
}

async function adminDeleteCoupon(req, res) {
  if (!exigirAutenticacao(req, res, { admin: true })) return;
  await ensureSchema();
  const codigo = txt(bodyOf(req).codigo, 50).toUpperCase();
  const removidos = await sql`DELETE FROM asaas_cupons WHERE codigo = ${codigo} RETURNING codigo`;
  if (!removidos.length) return res.status(404).json({ ok: false, error: "Cupom não encontrado." });
  return res.status(200).json({ ok: true, codigo: removidos[0].codigo });
}

async function adminToggleCoupon(req, res) {
  if (!exigirAutenticacao(req, res, { admin: true })) return;
  await ensureSchema();
  const body = bodyOf(req);
  const codigo = txt(body.codigo, 50).toUpperCase();
  const changed = await sql`
    UPDATE asaas_cupons SET ativo = ${Boolean(body.ativo)}, atualizado_em = NOW()
    WHERE codigo = ${codigo} RETURNING codigo, ativo
  `;
  if (!changed.length) return res.status(404).json({ ok: false, error: "Cupom não encontrado." });
  return res.status(200).json({ ok: true, cupom: changed[0] });
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
    if (req.method === "POST" && action === "validar-cupom") return await validateCoupon(req, res);
    if (req.method === "GET" && action === "admin-painel") return await adminDashboard(req, res);
    if (req.method === "GET" && action === "admin-financeiro") return await adminFinance(req, res);
    if (req.method === "POST" && action === "admin-sincronizar") return await adminSync(req, res);
    if (["GET","POST"].includes(req.method) && action === "admin-cupons") return await adminCoupons(req, res);
    if (req.method === "POST" && action === "admin-cupom-status") return await adminToggleCoupon(req, res);
    if (req.method === "DELETE" && action === "admin-cupom") return await adminDeleteCoupon(req, res);
    return res.status(404).json({ ok: false, error: "Operação não encontrada." });
  } catch (error) {
    console.error("[asaas]", error);
    return res.status(error?.status || 500).json({ ok: false, error: error?.message || "Erro interno." });
  }
}
