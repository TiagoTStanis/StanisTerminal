// Sessão do tipo Link: só http/https, host e porta tirados do endereço (para o status online).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { profile } = require('../src/config.cjs');

test('link https com porta, http sem porta e endereços recusados', () => {
  const a = profile({ type: 'web', name: 'Firewall', url: 'https://10.0.0.1:8443/admin' });
  assert.deepEqual([a.url, a.host, a.port], ['https://10.0.0.1:8443/admin', '10.0.0.1', 8443]);
  const b = profile({ type: 'web', name: 'Switch', url: 'http://switch-core.local' });
  assert.deepEqual([b.host, b.port], ['switch-core.local', 80]);
  assert.throws(() => profile({ type: 'web', name: 'x', url: 'javascript:alert(1)' }), /http/);
  assert.throws(() => profile({ type: 'web', name: 'x', url: 'file:///C:/Windows' }), /http/);
  assert.throws(() => profile({ type: 'web', name: 'x', url: 'não é link' }), /endereço válido/);
});
