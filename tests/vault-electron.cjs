// Executado dentro do Electron: confere o cofre com o DPAPI real do Windows.
const { app, safeStorage } = require('electron');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Vault } = require('../src/vault.cjs');
app.whenReady().then(() => {
  let code = 0;
  try {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-vault-real-')); const vault = new Vault(dir, safeStorage);
    const profile = { id: 'r1', type: 'rdp', host: 'srv.local', port: 3389, username: 'ana' };
    assert.ok(vault.available(), 'DPAPI disponível'); vault.set(profile, 'S3nha-real!'); assert.strictEqual(vault.get(profile), 'S3nha-real!');
    assert.ok(!fs.readFileSync(path.join(dir, 'credentials.json'), 'utf8').includes('S3nha-real!'), 'não pode haver texto puro');
    assert.strictEqual(vault.get({ ...profile, host: 'outro' }), null); vault.forget('r1'); assert.strictEqual(vault.get(profile), null);
    fs.rmSync(dir, { recursive: true, force: true }); console.log('PASS: cofre com DPAPI real (guardar, ler, escopo, esquecer, sem texto puro).');
  } catch (error) { console.error('FALHA:', error.message); code = 1; }
  app.exit(code);
});
