const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { parseRdp, importFile, importRdpFolder } = require('../src/importers.cjs');
const { profile } = require('../src/config.cjs');

const USER = String.raw`EMPRESA\usuario`; // domínio\usuário, com barra invertida literal
const REMOTEAPP = [
  'screen mode id:i:2', 'full address:s:rds01.empresa.local:3390', 'username:s:' + USER,
  'remoteapplicationmode:i:1', 'remoteapplicationprogram:s:||calc', 'remoteapplicationname:s:Calculadora',
  'remoteapplicationcmdline:s:/modo simples', 'shell working directory:s:%USERPROFILE%', 'gatewayhostname:s:rdg.empresa.com',
  'loadbalanceinfo:s:tsv://MS Terminal Services Plugin.1.Colecao'
].join('\r\n');

test('.rdp de RemoteApp: servidor, porta, usuário com domínio e programa', () => {
  const row = parseRdp(REMOTEAPP, 'C:/x/Calc.rdp');
  assert.deepEqual({ name: row.name, host: row.host, port: row.port, username: row.username, group: row.group },
    { name: 'Calculadora', host: 'rds01.empresa.local', port: 3390, username: USER, group: 'RemoteApps' });
  assert.deepEqual(row.remoteApp, { program: '||calc', name: 'Calculadora', args: '/modo simples', workdir: '%USERPROFILE%' });
  assert.equal(row.gateway, 'rdg.empresa.com');
  assert.equal(row.loadBalanceInfo, 'tsv://MS Terminal Services Plugin.1.Colecao');
});

test('.rdp comum (sem RemoteApp), IPv6 e "server port"', () => {
  const plain = parseRdp('full address:s:servidor\r\nserver port:i:3391', 'Servidor.rdp');
  assert.deepEqual([plain.name, plain.host, plain.port, plain.remoteApp], ['Servidor', 'servidor', 3391, undefined]);
  const v6 = parseRdp('full address:s:[::1]:3390', 'v6.rdp');
  assert.deepEqual([v6.host, v6.port], ['::1', 3390]);
  assert.throws(() => parseRdp('username:s:x', 'vazio.rdp'), /full address/);
});

test('arquivo .rdp em UTF-16 com BOM e pasta de RemoteApps passam pela revisão da importação', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rdp-'));
  try {
    fs.writeFileSync(path.join(dir, 'Calc.rdp'), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(REMOTEAPP, 'utf16le')]));
    fs.writeFileSync(path.join(dir, 'Servidor.rdp'), 'full address:s:10.0.0.5');
    fs.writeFileSync(path.join(dir, 'quebrado.rdp'), 'isto não é um rdp');
    fs.writeFileSync(path.join(dir, 'leia.txt'), 'full address:s:ignorado');
    const single = await importFile(path.join(dir, 'Calc.rdp'));
    assert.equal(single.rows.length, 1); assert.equal(single.rows[0].remoteApp.program, '||calc');
    assert.ok(single.warnings.some(w => /RD Gateway/.test(w)), 'deve avisar que RD Gateway não é suportado');
    const folder = await importRdpFolder(dir);
    assert.deepEqual(folder.rows.map(r => r.name).sort(), ['Calculadora', 'Servidor']);
    assert.ok(folder.warnings.some(w => /1 arquivo/.test(w)), 'deve contar o .rdp que não pôde ser lido');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('perfil RDP guarda o RemoteApp e descarta programa vazio ou com quebra de linha', () => {
  const p = profile({ type: 'rdp', name: 'Calc', host: 'rds01', remoteApp: { program: '||calc', name: 'Calculadora' } });
  assert.deepEqual(p.remoteApp, { program: '||calc', name: 'Calculadora', args: '', workdir: '' });
  assert.equal(profile({ type: 'rdp', name: 'R', host: 'rds01', remoteApp: { program: '  ' } }).remoteApp, undefined);
  assert.throws(() => profile({ type: 'rdp', name: 'R', host: 'rds01', remoteApp: { program: '||a\nb' } }));
  assert.equal(profile({ type: 'ssh', name: 'S', host: 'h', remoteApp: { program: '||calc' } }).remoteApp, undefined);
});

test('perfil RDP guarda o loadbalanceinfo (ASCII imprimível, até 238) e recusa valor inválido', () => {
  assert.equal(profile({ type: 'rdp', name: 'R', host: 'rds01', loadBalanceInfo: ' tsv://MS Terminal Services Plugin.1.Colecao ' }).loadBalanceInfo, 'tsv://MS Terminal Services Plugin.1.Colecao');
  assert.equal(profile({ type: 'rdp', name: 'R', host: 'rds01', loadBalanceInfo: '' }).loadBalanceInfo, undefined);
  assert.throws(() => profile({ type: 'rdp', name: 'R', host: 'rds01', loadBalanceInfo: 'x'.repeat(239) }), /Load balance/);
  assert.throws(() => profile({ type: 'rdp', name: 'R', host: 'rds01', loadBalanceInfo: 'coleção' }), /Load balance/);
  assert.equal(profile({ type: 'ssh', name: 'S', host: 'h', loadBalanceInfo: 'tsv://x' }).loadBalanceInfo, undefined);
});
