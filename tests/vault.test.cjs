const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Vault } = require('../src/vault.cjs');

// safeStorage de mentira: só ofusca. O teste real com o DPAPI do Windows roda dentro do Electron (tests/vault-electron.cjs).
const fake = { isEncryptionAvailable: () => true, encryptString: text => Buffer.from('enc:' + Buffer.from(text).toString('base64')), decryptString: buffer => { const t = buffer.toString(); if (!t.startsWith('enc:')) throw new Error('inválido'); return Buffer.from(t.slice(4), 'base64').toString(); } };
const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-vault-'));
const rdp = { id: 'a1', type: 'rdp', host: 'pc.local', port: 3389, username: 'ana' };

test('guarda e devolve a senha, sem gravar texto puro no disco', () => {
  const d = dir(); const vault = new Vault(d, fake);
  assert.strictEqual(vault.get(rdp), null); vault.set(rdp, 'S3nha!'); assert.strictEqual(vault.get(rdp), 'S3nha!'); assert.ok(vault.has(rdp));
  assert.ok(!fs.readFileSync(path.join(d, 'credentials.json'), 'utf8').includes('S3nha!'));
});

test('senha só vale para o destino em que foi salva', () => {
  const vault = new Vault(dir(), fake); vault.set(rdp, 'x');
  for (const change of [{ host: 'outro.local' }, { port: 3390 }, { username: 'bia' }]) assert.strictEqual(vault.get({ ...rdp, ...change }), null, JSON.stringify(change));
});

test('esquecer remove; senha vazia é uma senha válida; sem criptografia recusa gravar', () => {
  const vault = new Vault(dir(), fake); vault.set(rdp, ''); assert.strictEqual(vault.get(rdp), ''); assert.ok(vault.has(rdp));
  vault.forget('a1'); assert.strictEqual(vault.get(rdp), null); vault.forget('nao-existe');
  const off = new Vault(dir(), { ...fake, isEncryptionAvailable: () => false }); assert.throws(() => off.set(rdp, 'x'), /não está disponível/); assert.strictEqual(off.get(rdp), null);
});

test('formato SSH é compatível com o de ssh.cjs (mesmo escopo)', () => {
  const vault = new Vault(dir(), fake); const ssh = { id: 's1', type: 'ssh', host: 'h', port: 22, username: 'u', keyPath: '', jumpId: '' };
  vault.set(ssh, 'p'); assert.strictEqual(vault.get(ssh), 'p'); assert.strictEqual(vault.scope(ssh), JSON.stringify(['h', 22, 'u', '', '']));
});
