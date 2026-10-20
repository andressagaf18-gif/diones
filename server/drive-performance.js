// Consultas concorrentes com saída determinística e limite estrito de entradas.
export async function varrerComLimite(pastaId, prefixo, saida, limite, listar, pastaMime) {
  const fila = [{ id: pastaId, caminho: prefixo }];
  while (fila.length && saida.length < limite) {
    const lote = fila.splice(0, 4);
    const resultados = await Promise.all(lote.map(({ id }) => listar(id)));
    for (let i = 0; i < lote.length; i++) {
      for (const f of resultados[i]) {
        // Não inclui a pasta arquivada nem agenda a leitura dos seus descendentes.
        if (f.mimeType === pastaMime && String(f.name).trim().toLocaleUpperCase("pt-BR") === "BAIXADOS E RESCINDIDOS") continue;
        if (saida.length >= limite) return;
        const caminho = lote[i].caminho ? `${lote[i].caminho}/${f.name}` : f.name;
        if (f.mimeType === pastaMime) {
          saida.push({ caminho, tipo: "pasta" });
          fila.push({ id: f.id, caminho });
        } else {
          saida.push({ caminho, tipo: "arquivo", tamanho: Number(f.size || 0), modificadoEm: f.modifiedTime, _id: f.id, _mime: f.mimeType });
        }
      }
    }
  }
}

// Cache por instância, sem armazenar PDFs. A listagem continua fresca em cada auditoria.
export function criarCacheFatos({ maximo = 500, ttlMs = 15 * 60 * 1000, agora = Date.now } = {}) {
  const itens = new Map();
  return {
    obter(chave) {
      const item = itens.get(chave);
      if (!item) return undefined;
      if (agora() >= item.expira) { itens.delete(chave); return undefined; }
      itens.delete(chave);
      itens.set(chave, item);
      return structuredClone(item.valor);
    },
    salvar(chave, valor) {
      itens.delete(chave);
      itens.set(chave, { valor: structuredClone(valor), expira: agora() + ttlMs });
      while (itens.size > maximo) itens.delete(itens.keys().next().value);
    },
  };
}
