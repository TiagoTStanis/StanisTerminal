const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { profile, Config, host, port } = require('../src/config.cjs');
const { Telnet } = require('../src/telnet.cjs');
const { inside, Network } = require('../src/network.cjs');
test('perfis recusam injeção de opções e portas fora do intervalo', () => {
  for (const value of ['-oProxyCommand=calc', 'host;calc', 'a\r\nb', 'https://server']) assert.throws(() => host(value));
  for (const value of [0, -1, 65536, 1.5, 'abc']) assert.throws(() => port(value));
  assert.equal(host('2001:db8::1'), '2001:db8::1');
  assert.equal(host('::1'), '::1');
  assert.equal(profile({ type: 'rdp', name: 'RDP', host: 'servidor' }).port, 3389);
});

test('renomear preserva o arquivo que já existe no destino', async () => {
  const { Files } = require('../src/files.cjs');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-rename-'));
  const source = path.join(directory, 'origem.txt'), destination = path.join(directory, 'destino.txt');
  fs.writeFileSync(source, 'origem'); fs.writeFileSync(destination, 'destino');
  const files = new Files({}, () => {});
  await assert.rejects(files.change('local', '', 'rename', source, destination), /Já existe/);
  assert.equal(fs.readFileSync(source, 'utf8'), 'origem');
  assert.equal(fs.readFileSync(destination, 'utf8'), 'destino');
});

test('editor recusa binário e texto acima de 2 MiB', async () => {
  const { Files } = require('../src/files.cjs');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-editor-'));
  const binary = path.join(directory, 'bin.dat'); fs.writeFileSync(binary, Buffer.from([1, 0, 2]));
  const files = new Files({}, () => {});
  await assert.rejects(files.read('local', '', binary), /binário/);
  await assert.rejects(files.write('local', '', binary, 'x'.repeat(2 * 1024 * 1024 + 1)), /limite/);
  assert.deepEqual(fs.readFileSync(binary), Buffer.from([1, 0, 2]));
});

test('X11 e SSH com X11 preservam os campos necessários do perfil', () => {
  assert.equal(profile({ type: 'x11', name: 'Gráficos' }).type, 'x11');
  const p = profile({ type: 'ssh-x11', name: 'Linux', host: '127.0.0.1', username: 'teste', keyPath: 'C:\\chave.pem' });
  assert.equal(p.port, 22); assert.equal(p.keyPath, 'C:\\chave.pem');
});
test('configuração não persiste senha enviada no perfil', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-config-'));
  const config = new Config(directory);
  const result = config.putProfile({ type: 'ssh', name: 'Teste', host: 'localhost', password: 'NEVER_STORE_ME' });
  assert(result.id); assert(!fs.readFileSync(config.file, 'utf8').includes('NEVER_STORE_ME'));
  assert.equal(new Config(directory).value.profiles.length, 1);
});
test('Telnet negocia opções fragmentadas e IAC literal sem perder bytes', () => {
  const replies = [], telnet = new Telnet(data => replies.push([...data]));
  assert.deepEqual([...telnet.decode(Buffer.from([65, 255, 251]))], [65]);
  assert.deepEqual([...telnet.decode(Buffer.from([1, 66, 255, 255]))], [66, 255]);
  assert.deepEqual(replies, [[255, 253, 1]]);
  telnet.decode(Buffer.from([255, 253, 99])); assert.deepEqual(replies[1], [255, 252, 99]);
});
test('contenção de caminho distingue prefixo de pasta e pasta irmã', () => {
  const root = path.resolve('fixtures'); assert(inside(root, path.join(root, 'file')));
  assert(!inside(root, path.resolve(root, '../secret'))); assert(!inside(root, root + '-evil/file'));
});
test('HTTP local serve arquivos e recusa métodos de escrita', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-http-')); fs.writeFileSync(path.join(directory, 'index.html'), 'LOCAL_ONLY');
  const network = new Network({}, () => {});
  const net = require('node:net');
  const probe = net.createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r));
  try {
    await network.serve({ directory, port });
    const result = await fetch(`http://127.0.0.1:${port}/`); assert.equal(await result.text(), 'LOCAL_ONLY');
    const denied = await fetch(`http://127.0.0.1:${port}/`, { method: 'POST' }); assert.equal(denied.status, 405);
  } finally { network.closeAll(); }
});
