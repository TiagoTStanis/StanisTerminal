const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { importSshConfig, parseSshConfig, importPutty } = require('../src/importers.cjs');

test('lê Host, HostName, User, Port, IdentityFile e ProxyJump do ~/.ssh/config', () => {
  const text = `
# comentário
Host web
  HostName web.exemplo.com
  User deploy
  Port 2222
  IdentityFile ~/.ssh/id_web

Host db
  HostName 10.0.0.5
  ProxyJump web

Host *.wildcard
  User ignorado
`;
  const rows = parseSshConfig(text);
  assert.deepStrictEqual(rows.map(r => r.name), ['web', 'db']);
  assert.strictEqual(rows[0].host, 'web.exemplo.com'); assert.strictEqual(rows[0].username, 'deploy'); assert.strictEqual(rows[0].port, 2222);
  assert.ok(/[\\/]\.ssh[\\/]id_web$/.test(rows[0].keyPath), rows[0].keyPath); assert.strictEqual(rows[1].jumpName, 'web');
});

test('importSshConfig lê o arquivo real, resolve o alvo do ProxyJump e ignora se não existir', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-sshcfg-')); const file = path.join(dir, 'config');
  fs.writeFileSync(file, 'Host a\n  HostName 1.2.3.4\nHost b\n  HostName 5.6.7.8\n  ProxyJump a\nHost c\n  HostName 9.9.9.9\n  ProxyJump nao-existe\n');
  const rows = await importSshConfig(file); assert.strictEqual(rows.find(r => r.name === 'b').jumpName, 'a'); assert.strictEqual(rows.find(r => r.name === 'c').jumpName, '');
});

test('arquivo inexistente ou vazio não quebra; limite de tamanho é respeitado', async () => {
  assert.deepStrictEqual(await importSshConfig('/caminho/que/nao/existe/config'), []);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-sshcfg-')); const file = path.join(dir, 'config'); fs.writeFileSync(file, '');
  assert.deepStrictEqual(await importSshConfig(file), []);
  fs.writeFileSync(file, 'x'.repeat(3 * 1024 * 1024)); await assert.rejects(importSshConfig(file), /maior que o esperado/);
});

test('importPutty não quebra quando não há sessões (ambiente sem PuTTY)', async () => {
  const rows = await importPutty(); assert.ok(Array.isArray(rows));
});
