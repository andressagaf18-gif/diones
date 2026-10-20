// Cada tela fornece exclusivamente o histórico da sua própria auditoria.
export function clientesSemAuditoria(clientes, historico, campoCodigo = "codigo") {
  const existentes = new Set(historico.map(c => String(c[campoCodigo])));
  return clientes.filter(c => !existentes.has(String(c.codigo)));
}
