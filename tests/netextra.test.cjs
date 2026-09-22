const test = require('node:test');
const assert = require('node:assert');
const net = require('node:net');
const dgram = require('node:dgram');
const { Network } = require('../src/network.cjs');

test('varredura de portas acha a porta aberta e ignora as fechadas', async () => {
  const srv = net.createServer(s => s.destroy()); await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port; const net_ = new Network({}, () => {});
  const open = await net_.portScan({ host: '127.0.0.1', ports: `${port - 1}-${port + 1}` });
  assert.deepStrictEqual(open, [port]); srv.close();
});

test('varredura recusa intervalo grande demais e portas inválidas', async () => {
  const net_ = new Network({}, () => {});
  await assert.rejects(net_.portScan({ host: '127.0.0.1', ports: '1-70000' }), /entre 1 e 65535/);
  await assert.rejects(net_.portScan({ host: '127.0.0.1', ports: '1-9999' }), /Limite de 3000/);
  await assert.rejects(net_.portScan({ host: '127.0.0.1', ports: 'abc' }), /inválido/);
});

test('Wake-on-LAN monta o pacote mágico correto e recusa MAC inválido', async () => {
  const server = dgram.createSocket('udp4'); const received = new Promise(resolve => server.once('message', resolve));
  await new Promise(r => server.bind(0, '127.0.0.1', r)); const port = server.address().port;
  const net_ = new Network({}, () => {});
  const message = await net_.wakeOnLan({ mac: 'AA:BB:CC:DD:EE:FF', port, broadcast: '127.0.0.1' });
  assert.match(message, /AABBCCDDEEFF/);
  const packet = await received; assert.strictEqual(packet.length, 102); assert.ok(packet.subarray(0, 6).every(b => b === 0xff));
  for (let i = 0; i < 16; i++) assert.deepStrictEqual(packet.subarray(6 + i * 6, 12 + i * 6), Buffer.from('AABBCCDDEEFF', 'hex'));
  await assert.rejects(net_.wakeOnLan({ mac: 'nao-e-mac' }), /MAC inválido/); server.close();
});
