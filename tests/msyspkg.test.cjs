const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { MsysPackages, parseSearch, parseInstalled, parseUpgrades, NAME } = require('../src/msyspkg.cjs');

// Trechos reais do pacman do MSYS2 (20260611) capturados nesta máquina.
const SEARCH = 'msys/tree 2.3.2-1\n    A directory listing program displaying a depth indented list of files\nclangarm64/mingw-w64-clang-aarch64-7zip 26.03-1\n    A file archiver with a high compression ratio (mingw-w64)\nmsys/bash 5.3.015-1 (base) [installed]\n    The GNU Bourne Again shell\nmsys/gcc 15.2.0-1 [installed: 14.0.0-1]\n    The GNU Compiler Collection\n';
const QUERY = 'base 2022.06-1\nbash 5.3.015-1\nbash-completion 2.17.0-2\nlinha estranha com muitas palavras\n';
const UPDATES = 'bash-completion 2.17.0-2 -> 2.18.0-1\ncurl 8.20.0-1 -> 8.22.0-1\n';

test('busca: só o repositório msys, com versão, descrição e marca de instalado', () => {
  const rows = parseSearch(SEARCH); assert.deepStrictEqual(rows.map(r => r.id), ['tree', 'bash', 'gcc']);
  assert.strictEqual(rows[0].description.startsWith('A directory listing'), true); assert.strictEqual(rows[0].installed, false);
  assert.strictEqual(rows[1].installed, true); assert.strictEqual(rows[2].installed, true); assert.ok(rows.every(r => r.source === 'msys2' && r.actionable));
});
test('instalados e atualizações', () => {
  assert.deepStrictEqual(parseInstalled(QUERY).map(r => r.id), ['base', 'bash', 'bash-completion']);
  const up = parseUpgrades(UPDATES); assert.deepStrictEqual([up[0].id, up[0].version, up[0].available], ['bash-completion', '2.17.0-2', '2.18.0-1']); assert.strictEqual(up.length, 2);
  assert.deepStrictEqual(parseSearch(''), []); assert.deepStrictEqual(parseUpgrades('nada'), []);
});
test('nomes de pacote: aceita os do pacman e recusa injeção', () => {
  for (const ok of ['tree', 'bash-completion', 'libstdc++', 'python3.12', 'gcc-libs']) assert.match(ok, NAME, ok);
  for (const bad of ['--sysroot=/x', '-Syu', 'a b', 'x;calc', '../x', '', 'a'.repeat(101), 'a/b', 'a\\b']) assert.doesNotMatch(bad, NAME, bad);
});

function fakeSpawn(behavior) {
  const calls = []; const fn = (command, args, options) => {
    calls.push({ command, args, options }); const c = new EventEmitter(); c.stdout = new EventEmitter(); c.stderr = new EventEmitter(); c.kill = () => c.emit('close', null, 'SIGTERM');
    setImmediate(() => behavior(c)); return c;
  };
  fn.calls = calls; return fn;
}
const fakeRoot = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-msysfake-')); fs.mkdirSync(path.join(d, 'usr', 'bin'), { recursive: true }); fs.mkdirSync(path.join(d, 'var', 'lib', 'pacman', 'sync'), { recursive: true }); return d; };

test('operações usam argumentos fixos, ambiente MSYS e reportam o progresso', async () => {
  const root = fakeRoot(); const logs = []; const spawnFn = fakeSpawn(c => { c.stdout.emit('data', Buffer.from('resolving dependencies...\r\n[##########] 100%\r\ninstalling tree...\r\n')); c.emit('close', 0, null); });
  const p = new MsysPackages((ch, l) => logs.push(l), () => root, { spawnFn });
  const r = await p.operate('install', 'tree'); assert.ok(r.ok); assert.deepStrictEqual(spawnFn.calls[0].args, ['-S', '--needed', '--noconfirm', 'tree']);
  assert.strictEqual(spawnFn.calls[0].options.env.MSYSTEM, 'MSYS'); assert.ok(spawnFn.calls[0].options.env.PATH.startsWith(path.join(root, 'usr', 'bin')));
  assert.ok(logs.some(l => l.line.includes('installing tree'))); assert.ok(!logs.some(l => l.line.includes('####')));
  await p.operate('uninstall', 'tree'); assert.deepStrictEqual(spawnFn.calls[1].args, ['-Rns', '--noconfirm', 'tree']);
  await p.operate('upgrade-all'); assert.deepStrictEqual(spawnFn.calls[2].args, ['-Syu', '--noconfirm']);
});
test('recusa entradas perigosas, sem ambiente instalado e operações simultâneas', async () => {
  const root = fakeRoot(); const spawnFn = fakeSpawn(() => {}); const p = new MsysPackages(() => {}, () => root, { spawnFn });
  for (const bad of ['--overwrite=*', 'a b', 'x;calc', null]) assert.throws(() => p.operate('install', bad), /inválido/, String(bad));
  assert.throws(() => p.operate('format', 'tree'), /Ação inválida/); assert.strictEqual(spawnFn.calls.length, 0);
  for (const q of ['--help', '', 'a'.repeat(101)]) await assert.rejects(p.search(q), /busca válida/);
  const first = p.operate('install', 'tree'); assert.throws(() => p.operate('install', 'gcc'), /em andamento/); p.cancel(); assert.match((await first).message, /Cancelado/);
  await assert.rejects(new MsysPackages(() => {}, () => null).installed(), /ainda não está instalado/);
  await assert.rejects(new MsysPackages(() => {}, () => path.join(os.tmpdir(), 'nao-existe-xyz')).installed(), /ainda não está instalado/);
});
test('busca escapa regex, sincroniza o catálogo na primeira vez e não repete', async () => {
  const root = fakeRoot(); const calls = []; const execFn = (cmd, args, opt, cb) => { calls.push(args); if (args[0] === '-Sy') fs.writeFileSync(path.join(root, 'var', 'lib', 'pacman', 'sync', 'msys.db'), 'x'); cb(null, args[0] === '-Ss' ? SEARCH : '', ''); };
  const p = new MsysPackages(() => {}, () => root, { execFn }); const rows = await p.search('libstdc++'); assert.strictEqual(rows.length, 3);
  assert.deepStrictEqual(calls.map(a => a[0]), ['-Sy', '-Ss']); assert.strictEqual(calls[1][1], 'libstdc\\+\\+'); await p.search('tree'); assert.deepStrictEqual(calls.map(a => a[0]), ['-Sy', '-Ss', '-Ss']);
  await p.upgrades(); assert.deepStrictEqual(calls.slice(-2).map(a => a[0]), ['-Sy', '-Qu']);
});
