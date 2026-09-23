const { test } = require('node:test');
const assert = require('node:assert/strict');
const { WebSocket, WebSocketServer } = require('ws');
const { parseDestination, parseRDCleanPathRequest, handleConnection, explainFailure } = require('../src/rdpproxy.cjs');

test('parseDestination: host:porta, IPv6 e porta padrão 3389', () => {
  assert.deepEqual(parseDestination('192.168.1.10:3390'), { host: '192.168.1.10', port: 3390 });
  assert.deepEqual(parseDestination('meuhost'), { host: 'meuhost', port: 3389 });
  assert.deepEqual(parseDestination('[::1]:3391'), { host: '::1', port: 3391 });
  assert.deepEqual(parseDestination('[::1]'), { host: '::1', port: 3389 });
});

test('parseRDCleanPathRequest recusa bytes que não são uma SEQUENCE ASN.1 válida', () => {
  assert.throws(() => parseRDCleanPathRequest(Buffer.from([0xff, 0x01, 0x02])), /SEQUENCE/);
});

test('handleConnection: mensagem inválida gera resposta de erro e fecha a conexão, sem travar o processo', async () => {
  const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise(resolve => wss.once('listening', resolve));
  const port = wss.address().port;
  wss.on('connection', ws => handleConnection(ws, { readyTimeout: 2000 }));
  const client = new WebSocket(`ws://127.0.0.1:${port}/`);
  await new Promise((resolve, reject) => { client.once('open', resolve); client.once('error', reject); });
  const closed = new Promise(resolve => client.once('close', resolve));
  const gotMessage = new Promise(resolve => client.once('message', data => resolve(data)));
  client.send(Buffer.from('isso não é um RDCleanPath válido', 'utf8'));
  const response = await gotMessage;
  assert.ok(Buffer.isBuffer(response) && response.length > 0, 'deve responder com um PDU de erro, não travar em silêncio');
  await closed;
  wss.close();
});

test('falhas do proxy viram mensagens claras em português', () => {
  assert.match(explainFailure('Falha na conexão TCP: connect ECONNREFUSED 10.0.0.1:3389'), /recusada/);
  assert.match(explainFailure('Tempo limite ao conectar por RDP.'), /tempo esgotado/);
  assert.match(explainFailure('Falha na conexão TCP: getaddrinfo ENOTFOUND servidor'), /DNS/);
  assert.match(explainFailure('Handshake TLS falhou: error:1000012e:SSL routines:OPENSSL_internal:KEY_USAGE_BIT_INCORRECT'), /Key Usage/);
  assert.equal(explainFailure('algo inesperado'), 'algo inesperado');
});
