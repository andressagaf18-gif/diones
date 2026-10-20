import test from 'node:test';
import assert from 'node:assert/strict';
import { clientesSemAuditoria } from '../src/tributario/clientes-auditoria.js';
test('filtra pelo código, sem refazer auditorias já salvas ou incompletas', () => {
 const clientes = [{ codigo: 21 }, { codigo: '22' }, { codigo: '23' }];
 assert.deepEqual(clientesSemAuditoria(clientes, [{codigo:'21'}, {codigo:22, incompleto:'true'}]), [{codigo:'23'}]);
 assert.deepEqual(clientesSemAuditoria(clientes, [{cliente_codigo:'21'}], 'cliente_codigo'), clientes.slice(1));
 assert.deepEqual(clientesSemAuditoria(clientes, []), clientes);
 assert.deepEqual(clientesSemAuditoria([], []), []);
});
