// DESTINO: /api/asaas/webhook.js

export default async function handler(req, res) {
  // Permite verificar pelo navegador se a função está funcionando.
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "asaas-webhook",
      message: "Webhook disponível. O Asaas deve enviar requisições POST."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      message: "Método não permitido."
    });
  }

  try {
    const tokenEsperado = process.env.ASAAS_WEBHOOK_TOKEN;
    const tokenRecebido = req.headers["asaas-access-token"];

    if (!tokenEsperado) {
      console.error("ASAAS_WEBHOOK_TOKEN não configurado.");

      return res.status(500).json({
        ok: false,
        message: "Webhook não configurado no servidor."
      });
    }

    if (!tokenRecebido || tokenRecebido !== tokenEsperado) {
      console.warn("Webhook recebido com token inválido.");

      return res.status(401).json({
        ok: false,
        message: "Token de autenticação inválido."
      });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

    const evento = body.event;
    const pagamento = body.payment || {};
    const eventoId = body.id || null;

    console.log("Webhook Asaas recebido:", {
      eventoId,
      evento,
      pagamentoId: pagamento.id || null,
      status: pagamento.status || null,
      valor: pagamento.value || null,
      referencia: pagamento.externalReference || null
    });

    switch (evento) {
      case "PAYMENT_RECEIVED":
        /*
         * Aqui será feita a liberação do relatório:
         *
         * 1. Localizar o diagnóstico usando pagamento.externalReference;
         * 2. Confirmar que pagamento.value corresponde ao plano;
         * 3. Salvar statusPagamento = "PAGO";
         * 4. Salvar relatorioLiberado = true;
         * 5. Registrar eventoId para impedir processamento duplicado.
         */
        break;

      case "PAYMENT_OVERDUE":
        // Manter o relatório bloqueado.
        break;

      case "PAYMENT_REFUNDED":
      case "PAYMENT_DELETED":
        /*
         * Revogar o acesso:
         * statusPagamento = "CANCELADO";
         * relatorioLiberado = false;
         */
        break;

      default:
        console.log("Evento ignorado:", evento);
    }

    // O Asaas exige resposta 2xx para confirmar o recebimento.
    return res.status(200).json({
      ok: true,
      received: true
    });
  } catch (error) {
    console.error("Erro ao processar webhook do Asaas:", error);

    return res.status(500).json({
      ok: false,
      message: "Erro interno no processamento do webhook."
    });
  }
}
