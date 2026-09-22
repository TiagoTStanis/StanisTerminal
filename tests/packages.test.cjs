const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const { Packages, parseTable } = require('../src/packages.cjs');

// Saídas reais do winget 1.29 (pt-BR), capturadas nesta máquina.
const SEARCH = 'Nome               ID                      Versão     Correspondência\r\n---------------------------------------------------------------------\r\nGit                Git.Git                 2.55.0.3   \r\nGit                Microsoft.Git           2.55.0.0.8 \r\nOpenCherry Desktop 4nrry.OpenCherryDesktop 0.0.1      Tag: git\r\n<entradas adicionais truncadas devido ao limite de resultado>\r\n';
const LIST = 'Nome                                             ID                                        Versão           Disponível Origem\r\n-----------------------------------------------------------------------------------------------------------------------------\r\nGit                                              Git.Git                                   2.53.0           2.55.0.3   winget\r\nMicrosoft 365 Apps para Grandes Empresas - pt-br ARP\\Machine\\X64\\O365ProPlusRetail - pt-br 16.0.20326.20158            \r\nObsidian                                         Obsidian.Obsidian                         1.12.4           1.13.7     winget\r\n';
const LIST_NO_UPDATE = 'Name        Id           Version Source\r\n-------------------------------------\r\nNode        OpenJS.NodeJS 22.1.0 winget\r\n';

test('lê a busca e ignora a linha de truncamento', () => {
  const rows = parseTable(SEARCH, 'search'); assert.deepStrictEqual(rows.map(r => r.id), ['Git.Git', 'Microsoft.Git', '4nrry.OpenCherryDesktop']);
  assert.strictEqual(rows[0].name, 'Git'); assert.strictEqual(rows[0].version, '2.55.0.3'); assert.strictEqual(rows[2].match, 'Tag: git');
});

test('lê os instalados: com atualização disponível, IDs ARP não são acionáveis', () => {
  const rows = parseTable(LIST, 'list'); assert.strictEqual(rows.length, 3);
  assert.deepStrictEqual([rows[0].id, rows[0].version, rows[0].available, rows[0].source, rows[0].actionable], ['Git.Git', '2.53.0', '2.55.0.3', 'winget', true]);
  assert.strictEqual(rows[1].actionable, false, 'ARP\\Machine\\... não pode virar argumento'); assert.strictEqual(rows[2].id, 'Obsidian.Obsidian');
});

test('funciona em outro idioma (cabeçalhos em inglês) e sem coluna de atualização', () => {
  const rows = parseTable(LIST_NO_UPDATE, 'list'); assert.strictEqual(rows.length, 1); assert.strictEqual(rows[0].id, 'OpenJS.NodeJS'); assert.strictEqual(rows[0].source, 'winget'); assert.strictEqual(rows[0].available, undefined);
  assert.deepStrictEqual(parseTable('nada', 'list'), []); assert.deepStrictEqual(parseTable('', 'search'), []);
});

function fakeSpawn(behavior) {
  const calls = []; const fn = (command, args) => {
    calls.push({ command, args }); const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = () => child.emit('close', null, 'SIGTERM');
    setImmediate(() => behavior(child)); return child;
  };
  fn.calls = calls; return fn;
}

test('instalar usa argumentos fixos, sem shell, e reporta progresso', async () => {
  const logs = []; const spawnFn = fakeSpawn(child => { child.stdout.emit('data', Buffer.from('Encontrado Git [Git.Git]\r\n██████  50%\r\n')); child.emit('close', 0, null); });
  const p = new Packages((channel, l) => logs.push(l), { spawnFn }); const result = await p.operate('install', 'Git.Git');
  assert.ok(result.ok); assert.deepStrictEqual(spawnFn.calls[0].args.slice(0, 4), ['install', '--id', 'Git.Git', '--exact']); assert.ok(spawnFn.calls[0].args.includes('--silent'));
  assert.ok(logs.some(l => l.line.includes('Encontrado Git'))); assert.ok(!logs.some(l => l.line.includes('█')));
});

test('recusa IDs e ações perigosas antes de executar qualquer coisa', async () => {
  const spawnFn = fakeSpawn(child => child.emit('close', 0, null)); const p = new Packages(() => {}, { spawnFn });
  for (const bad of ['--source=evil', 'a b', 'x;calc', '../x', '', 'a'.repeat(200), 'Git.Git --override', null, 'ARP\\Machine\\X']) assert.throws(() => p.operate('install', bad), /inválido/, String(bad));
  assert.throws(() => p.operate('format', 'Git.Git'), /Ação inválida/); assert.throws(() => p.operate('install', 'Git.Git', 'http://evil'), /Origem inválida/);
  assert.strictEqual(spawnFn.calls.length, 0);
  for (const q of ['--help', ' -x', '', 'a'.repeat(101), 'a\nb']) await assert.rejects(p.search(q), /busca válida/, JSON.stringify(q));
  await assert.rejects(p.search('git', 'evil'), /Origem inválida/);
});

test('uma operação por vez; cancelar interrompe; erro do winget vira mensagem', async () => {
  const spawnFn = fakeSpawn(() => {}); const p = new Packages(() => {}, { spawnFn });
  const first = p.operate('install', 'Git.Git'); assert.throws(() => p.operate('upgrade', 'Git.Git'), /em andamento/); p.cancel();
  const r = await first; assert.strictEqual(r.ok, false); assert.match(r.message, /Cancelado/);
  const failing = new Packages(() => {}, { spawnFn: fakeSpawn(c => c.emit('close', 2316632084, null)) }); const f = await failing.operate('uninstall', 'Git.Git'); assert.strictEqual(f.ok, false); assert.match(f.message, /código/);
  const missing = new Packages(() => {}, { spawnFn: () => { const c = new EventEmitter(); c.stdout = c.stderr = new EventEmitter(); setImmediate(() => c.emit('error', Object.assign(new Error('x'), { code: 'ENOENT' }))); return c; } });
  assert.match((await missing.operate('install', 'Git.Git')).message, /não foi encontrado/);
});

test('busca e listagens passam pelo winget com argumentos em lista', async () => {
  const calls = []; const execFn = (command, args, options, cb) => { calls.push(args); cb(null, Buffer.from(SEARCH)); };
  const p = new Packages(() => {}, { execFn }); const rows = await p.search('git'); assert.strictEqual(rows[0].source, 'winget');
  assert.deepStrictEqual(calls[0].slice(0, 4), ['search', '--query', 'git', '--source']); await p.installed(); await p.upgrades(); assert.strictEqual(calls[1][0], 'list'); assert.strictEqual(calls[2][0], 'upgrade');
  const noWinget = new Packages(() => {}, { execFn: (c, a, o, cb) => cb(Object.assign(new Error('x'), { code: 'ENOENT' }), Buffer.alloc(0)) }); await assert.rejects(noWinget.installed(), /winget não foi encontrado/);
});
