// Status online com centenas de sessões: resultados aos poucos, timeouts em paralelo e DNS com cache.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { checkMany, dnsCache } = require('../src/reach.cjs');

test('400 hosts (online, porta fechada, nome inexistente, sem resposta) terminam em poucos segundos', async () => {
  const server = net.createServer(socket => socket.destroy()); await new Promise(r => server.listen(0, '127.0.0.1', r));
  const closed = net.createServer(); await new Promise(r => closed.listen(0, '127.0.0.1', r)); const closedPort = closed.address().port; closed.close();
  const targets = [
    ...Array.from({ length: 100 }, () => ({ host: '127.0.0.1', port: server.address().port, expect: true })),
    ...Array.from({ length: 100 }, () => ({ host: '127.0.0.1', port: closedPort, expect: false })),
    // 100 sessões em só 4 nomes: o cache evita 100 consultas de DNS.
    ...Array.from({ length: 100 }, (_, i) => ({ host: `sessao-${i % 4}.invalid`, port: 22, expect: false })),
    // Endereço reservado para documentação (TEST-NET-1): não responde, cai no timeout.
    ...Array.from({ length: 100 }, (_, i) => ({ host: `192.0.2.${i + 1}`, port: 3389, expect: false })),
  ];
  const streamed = []; const started = Date.now();
  const results = await checkMany(targets, { timeout: 800, onResult: (i, online) => streamed.push([i, online]) });
  const elapsed = Date.now() - started;
  server.close();
  targets.forEach((t, i) => assert.equal(results[i], t.expect, `${t.host}:${t.port}`));
  assert.equal(streamed.length, targets.length, 'cada resultado é avisado assim que sai');
  assert.ok(streamed.findIndex(([i]) => i >= 300) > 0, 'os primeiros resultados chegam antes dos timeouts');
  assert.ok(elapsed < 6000, `levou ${elapsed} ms`);
  assert.ok(['sessao-0.invalid', 'sessao-3.invalid'].every(h => dnsCache.has(h)), 'nomes que falharam ficam em cache');
});
