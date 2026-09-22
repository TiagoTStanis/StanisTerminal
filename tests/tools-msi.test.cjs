const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { Tools, CATALOG } = require('../src/tools.cjs');

const sha = buffer => crypto.createHash('sha256').update(buffer).digest('hex');

test('pacote MSI: extrai, confere assinatura e descarta tudo se a assinatura for inválida', async () => {
  const MSI = Buffer.from('pacote-msi-falso'); const rel = path.join('PFiles', 'App', 'app.exe');
  const srv = http.createServer((req, res) => res.end(MSI)); await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const catalog = { m: { name: 'M', version: '1', license: 'MIT', url: `http://127.0.0.1:${srv.address().port}/x.msi`, sha256: sha(MSI), maxBytes: 1000, msi: true, file: rel, verify: [rel], signer: 'Fabricante Confiavel', source: 'x' } };
  const extract = async (msi, target) => { assert.deepStrictEqual(fs.readFileSync(msi), MSI); fs.mkdirSync(path.join(target, 'PFiles', 'App'), { recursive: true }); fs.writeFileSync(path.join(target, rel), 'exe'); };
  const make = signature => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-msi-')); return { dir, tools: new Tools(dir, async () => ({}), { catalog, allowInsecure: true, extract, signature }) }; };

  const bad = make(async () => 'CN=Impostor'); await assert.rejects(bad.tools.install('m'), /Assinatura digital inválida/);
  assert.ok(!bad.tools.installed('m')); assert.deepStrictEqual(fs.readdirSync(path.join(bad.dir, 'tools')), [], 'nada sobra após falha');
  const unsigned = make(async () => 'INVALID:NotSigned'); await assert.rejects(unsigned.tools.install('m'), /Assinatura digital inválida/);

  const good = make(async () => 'E=x, CN=Fabricante Confiavel, O=Fabricante Confiavel');
  const file = await good.tools.install('m'); assert.strictEqual(fs.readFileSync(file, 'utf8'), 'exe'); assert.ok(good.tools.installed('m'));
  assert.deepStrictEqual(fs.readdirSync(path.join(good.dir, 'tools')), ['m'], 'sem pastas temporárias');
  await good.tools.remove('m'); assert.ok(!good.tools.installed('m')); srv.close();
});

test('catálogo do TightVNC exige assinatura do fabricante nos executáveis', () => {
  const t = CATALOG.tightvnc; assert.strictEqual(t.signer, 'OOO GlavSoft'); assert.ok(t.verify.length >= 3 && t.verify.includes(t.file)); assert.ok(t.msi);
  assert.match(t.sha256, /^[0-9a-f]{64}$/); assert.match(t.url, /^https:\/\/www\.tightvnc\.com\//);
});
