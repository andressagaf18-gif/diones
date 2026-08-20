export default function handler(req, res) {
  res.status(200).json({
    sucesso: true,
    rota: "/api/dashboard",
    mensagem: "Dashboard API funcionando",
    timestamp: new Date().toISOString(),
  });
}
