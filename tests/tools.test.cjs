const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { Tools, CATALOG } = require('../src/tools.cjs');

const sha = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const GOOD = Buffer.from('conteudo-legitimo'), BAD = Buffer.from('conteudo-adulterado');
function server() {
  const seen = [];
  const srv = http.createServer((req, res) => {
    seen.push({ url: req.url, headers: req.headers });
    if (req.url === '/bom') return res.end(GOOD);
    if (req.url === '/ruim') return res.end(BAD);
    if (req.url === '/grande') return res.end(Buffer.alloc(5000, 1));
    if (req.url === '/redir-fora') { res.writeHead(302, { Location: 'http://outro.example/x' }); return res.end(); }
    if (req.url === '/redir-ok') { res.writeHead(302, { Location: '/bom' }); return res.end(); }
    res.writeHead(404).end();
  });
  return new Promise(resolve => srv.listen(0, '127.0.0.1', () => resolve({ srv, seen, base: `http://127.0.0.1:${srv.address().port}` })));
}
const make = (base, route, extra = {}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-tools-')); const questions = [];
  const catalog = { t: { name: 'Teste', version: '1', license: 'MIT', url: base + route, sha256: sha(GOOD), maxBytes: 1000, file: 't.exe', source: 'x', ...extra } };
  return { dir, questions, tools: new Tools(dir, async q => { questions.push(q); return {}; }, { catalog, allowInsecure: true }) };
};

test('instala quando o hash confere, mostra origem e não envia dados do usuário', async () => {
  const s = await server(); const { tools, questions } = make(s.base, '/bom');
  const file = await tools.install('t'); assert.deepStrictEqual(fs.readFileSync(file), GOOD); assert.ok(tools.installed('t'));
  assert.ok(questions[0].message.includes(s.base)); assert.ok(questions[0].message.includes(sha(GOOD)));
  const headers = s.seen[0].headers; assert.strictEqual(headers['user-agent'], 'StanisTerminal-ToolInstaller'); assert.ok(!headers.cookie && !headers.authorization && !headers.referer);
  assert.strictEqual(fs.readdirSync(path.dirname(file)).length, 1, 'sem arquivos temporários'); s.srv.close();
});

test('descarta arquivo com hash diferente e nada é gravado', async () => {
  const s = await server(); const { tools, dir } = make(s.base, '/ruim');
  await assert.rejects(tools.install('t'), /Hash SHA-256 diferente/); assert.ok(!tools.installed('t')); assert.ok(!fs.existsSync(path.join(dir, 'tools', 't')));
  s.srv.close();
});

test('recusa arquivo maior que o limite, redirecionamento para outro domínio, 404 e ferramenta fora da lista', async () => {
  const s = await server();
  await assert.rejects(make(s.base, '/grande').tools.install('t'), /maior que o esperado/);
  await assert.rejects(make(s.base, '/redir-fora').tools.install('t'), /outro domínio/);
  await assert.rejects(make(s.base, '/nao-existe').tools.install('t'), /404/);
  await assert.doesNotReject(make(s.base, '/redir-ok').tools.install('t'));
  const { tools } = make(s.base, '/bom');
  await assert.rejects(tools.install('desconhecida'), /desconhecida/); await assert.rejects(tools.install('__proto__'), /desconhecida/); await assert.rejects(tools.install('constructor'), /desconhecida/);
  s.srv.close();
});

test('cancelar a confirmação não baixa nada; HTTP puro é recusado em produção', async () => {
  const s = await server(); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-tools-'));
  const catalog = { t: { name: 'T', version: '1', license: 'MIT', url: s.base + '/bom', sha256: sha(GOOD), maxBytes: 1000, file: 't.exe', source: 'x' } };
  await assert.rejects(new Tools(dir, async () => null, { catalog, allowInsecure: true }).install('t'), /cancelada/); assert.strictEqual(s.seen.length, 0);
  await assert.rejects(new Tools(dir, async () => ({}), { catalog }).install('t'), /HTTPS/); assert.strictEqual(s.seen.length, 0);
  s.srv.close();
});

test('catálogo oficial só tem HTTPS, hash de 64 hex e limite de tamanho', () => {
  for (const [id, item] of Object.entries(CATALOG)) { assert.match(item.url, /^https:\/\//, id); assert.match(item.sha256, /^[0-9a-f]{64}$/, id); assert.ok(item.maxBytes > 0 && item.maxBytes <= 100 * 1024 * 1024, id); }
});
