import test from 'node:test';
import assert from 'node:assert/strict';
import { varrerComLimite, criarCacheFatos } from '../server/drive-performance.js';

test('varredura preserva caminhos, limita concorrência e respeita limite', async () => {
  let ativos = 0, pico = 0;
  const listar = async (id) => {
    ativos++; pico = Math.max(pico, ativos);
    await new Promise(r => setTimeout(r, 2));
    ativos--;
    return id === 'root' ? Array.from({ length: 6 }, (_, i) => ({ id: String(i), name: `p${i}`, mimeType: 'pasta' })) : [{ id: `f${id}`, name: 'a.pdf', size: '12', modifiedTime: 'v1', mimeType: 'pdf' }];
  };
  const saida = [];
  await varrerComLimite('root', '', saida, 9, listar, 'pasta');
  assert.equal(saida.length, 9);
  assert.equal(pico, 4);
  assert.equal(saida[6].caminho, 'p0/a.pdf');
  assert.equal(saida[6].modificadoEm, 'v1');
  assert.equal(saida[6].tamanho, 12);
});

test('falhas de listagem são propagadas, sem auditoria silenciosamente incompleta', async () => {
  await assert.rejects(varrerComLimite('root', '', [], 10, async () => { throw Error('Drive'); }, 'pasta'), /Drive/);
});

test('cache expira, limita tamanho e isola objetos reutilizados', () => {
  let tempo = 0;
  const cache = criarCacheFatos({ maximo: 2, ttlMs: 10, agora: () => tempo });
  cache.salvar('a', { valor: 1 });
  const copia = cache.obter('a'); copia.valor = 9;
  assert.equal(cache.obter('a').valor, 1);
  cache.salvar('b', {}); cache.salvar('c', {});
  assert.equal(cache.obter('a'), undefined);
  tempo = 10;
  assert.equal(cache.obter('c'), undefined);
  assert.equal(cache.obter('outra-versao'), undefined);
});

test('cache não reutiliza resultados de outro arquivo, caminho ou versão', () => {
  const cache = criarCacheFatos();
  const chave = (id, caminho, versao) => JSON.stringify(['cliente', 'pasta', id, caminho, versao, 12]);
  cache.salvar(chave('1', 'a.pdf', 'v1'), { nome: 'a.pdf' });
  assert.equal(cache.obter(chave('1', 'a.pdf', 'v2')), undefined);
  assert.equal(cache.obter(chave('1', 'b.pdf', 'v1')), undefined);
  assert.equal(cache.obter(chave('2', 'a.pdf', 'v1')), undefined);
  assert.deepEqual(cache.obter(chave('1', 'a.pdf', 'v1')), { nome: 'a.pdf' });
});
