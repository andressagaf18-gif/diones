import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('salva e atualiza painel por cliente, sem esperar o lote ou duplicar versões', async () => {
  const fonte = readFileSync(new URL('../src/tributario/AuditoriaPastas.jsx', import.meta.url), 'utf8');
  const corpo = fonte.split('  async function auditarDrive() {')[1].split('\n  async function aoSoltar')[0];
  const eventos = [];
  let liberar;
  const pendente = new Promise(resolve => { liberar = resolve; });
  const contexto = {
    setErro: () => {}, setSalvo: () => {}, setAviso: () => {}, setLendo: v => eventos.push(['lendo', v]), setProgresso: () => {},
    driveUm: 'todos', driveLista: { clientes: [{ codigo: '1' }, { codigo: '2' }] },
    auditarUmDrive: async c => { if (c.codigo === '2') await pendente; return { auditoria: { codigo: c.codigo } }; },
    salvarVersoes: async lista => { eventos.push(['salvo', lista[0].codigo]); return { [lista[0].codigo]: 'id' }; },
    carregarPainel: async () => { eventos.push(['painel']); },
  };
  const executar = new Function(...Object.keys(contexto), `return (async function () {${corpo}).call(null)`);
  const tarefa = executar(...Object.values(contexto));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(eventos, [['lendo', true], ['salvo', '1'], ['painel']]);
  liberar();
  await tarefa;
  assert.deepEqual(eventos, [['lendo', true], ['salvo', '1'], ['painel'], ['salvo', '2'], ['painel'], ['lendo', false]]);
});
