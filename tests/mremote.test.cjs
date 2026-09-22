const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseMremote, importFile, prepareImport, parseSshConfig, importPutty } = require('../src/importers.cjs');
const wrap = content => `<?xml version="1.0" encoding="utf-8"?><Connections ConfVersion="2.6" FullFileEncryption="False">${content}</Connections>`;
const connection = (extra = '') => `<Node Type="Connection" Name="Servidor" Hostname="server.local" Protocol="RDP" Port="3389" ${extra}/>`;

test('mRemoteNG: pastas, entidades, herança e domínio RDP; senhas nunca saem do parser', () => {
  const result = parseMremote(wrap(`<Node Type="Container" Name="Clientes &amp; Lab" Username="ana" Domain="LAB" Protocol="RDP" Port="3390">
    <Node Type="Container" Name="Produção" InheritUsername="True" InheritDomain="True" InheritProtocol="True" InheritPort="True">
      <Node Type="Connection" Name="Área &#49;" Hostname="192.0.2.10" Username="ignorar" InheritUsername="True" InheritDomain="True" InheritProtocol="True" InheritPort="True" Password="SEGREDO" RDGatewayPassword="OUTROSEGREDO"/>
    </Node></Node>`));
  assert.equal(result.rows.length, 1);
  const p = result.rows[0];
  assert.equal(p.group, 'Clientes & Lab/Produção'); assert.equal(p.name, 'Área 1');
  assert.equal(p.type, 'rdp'); assert.equal(p.port, 3390); assert.equal(p.username, 'LAB\\ana');
  assert(!JSON.stringify(result).includes('SEGREDO'));
});

test('mRemoteNG: mantém SSH2, VNC, Telnet e Rlogin; não transforma RDP em SSH', () => {
  const xml = ['SSH2', 'RDP', 'VNC', 'Telnet', 'Rlogin'].map(p => `<Node Type="Connection" Name="${p}" Protocol="${p}" Hostname="host.local"/>`).join('');
  const rows = parseMremote(wrap(xml)).rows;
  assert.deepEqual(rows.map(p => [p.type, p.port]), [['ssh', 22], ['rdp', 3389], ['vnc', 5900], ['telnet', 23], ['rlogin', 513]]);
  const prepared = prepareImport(rows, []);
  assert.equal(prepared.profiles[1].type, 'rdp');
  assert.equal(prepareImport(rows, prepared.profiles).added, 0);
  assert.equal(prepareImport(rows, prepared.profiles).skipped, 5);
});

test('mRemoteNG: informa protocolos incompatíveis e dados inválidos; mantém conexões válidas', () => {
  const result = parseMremote(wrap(connection() + '<Node Type="Connection" Name="Site" Protocol="HTTP" Hostname="site.local"/>' + '<Node Type="Connection" Name="Vazia" Protocol="SSH2"/>'));
  assert.equal(result.rows.length, 1); assert.match(result.warnings.join(' '), /2 conexão/); assert.match(result.warnings.join(' '), /HTTP/);
  assert.match(parseMremote(wrap('')).warnings.join(' '), /não contém/);
});

test('mRemoteNG: recusa XML quebrado, DTD, raiz incorreta, arquivo cifrado e limites', () => {
  assert.throws(() => parseMremote('<Connections><Node></Connections>'), /inválido/);
  assert.throws(() => parseMremote('<OutraRaiz/>'), /não é uma exportação/);
  assert.throws(() => parseMremote('<!DOCTYPE Connections [<!ENTITY segredo SYSTEM "file:///teste">]><Connections/>'), /DTD/);
  assert.throws(() => parseMremote('<Connections FullFileEncryption="True">cifrado</Connections>'), /criptografado/);
  assert.throws(() => parseMremote(wrap(connection().repeat(501))), /500/);
  assert.throws(() => parseMremote('x'.repeat(5 * 1024 * 1024 + 1)), /grande/);
});

test('arquivo: reconhece XML UTF-8/UTF-16 e JSON; erro claro para outro formato', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-import-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const encoding of ['utf8', 'utf16le']) {
    const file = path.join(dir, encoding + '.xml');
    fs.writeFileSync(file, '\uFEFF' + wrap(connection()), encoding);
    assert.equal((await importFile(file)).rows[0].type, 'rdp');
  }
  const file = path.join(dir, 'backup.json');
  fs.writeFileSync(file, JSON.stringify({ profiles: [{ type: 'ssh', name: 'SSH', host: 'host.local', password: 'NAOIMPORTAR' }] }));
  assert(!JSON.stringify(await importFile(file)).includes('NAOIMPORTAR'));
  fs.writeFileSync(file, '{invalido'); await assert.rejects(importFile(file), /JSON inválido/);
  const other = path.join(dir, 'outro.txt'); fs.writeFileSync(other, 'qualquer texto'); await assert.rejects(importFile(other), /Formato não reconhecido/);
});

test('importação em lote valida tudo antes de alterar a configuração e preserva gateway', () => {
  const existing = [{ id: 'old', type: 'ssh', name: 'Anterior', group: 'Local', host: 'old.local', port: 22, username: '' }];
  const original = JSON.stringify(existing);
  assert.throws(() => prepareImport([{ type: 'ssh', name: 'Boa', host: 'ok.local' }, { type: 'rdp', name: 'Ruim', host: '' }], existing), /Host/);
  assert.equal(JSON.stringify(existing), original);
  const rows = [{ type: 'ssh', name: 'Gateway', host: 'gw.local', sourceId: 'g' }, { type: 'ssh', name: 'Destino', host: 'dst.local', sourceJumpId: 'g' }];
  const result = prepareImport(rows, []);
  assert.equal(result.profiles[1].jumpId, result.profiles[0].id);
  assert.throws(() => prepareImport(rows.slice(1), []), /gateway SSH/);
});

test('OpenSSH: múltiplos aliases recebem os mesmos campos; aceita chave=valor', () => {
  const rows = parseSshConfig('Host primeiro segundo\n HostName=host.local\n User="ana"\n Port=2222\n IdentityFile "~/.ssh/id_ed25519"\n');
  assert.equal(rows.length, 2);
  for (const row of rows) { assert.equal(row.host, 'host.local'); assert.equal(row.username, 'ana'); assert.equal(row.port, 2222); assert(row.keyPath.startsWith(os.homedir())); }
});

test('PuTTY: diferencia ausência de erro de acesso e preserva protocolo Telnet', { skip: process.platform !== 'win32' }, async () => {
  await assert.rejects(importPutty(async () => { throw { stderr: 'ERROR: Access is denied.' }; }), /Não foi possível/);
  assert.deepEqual(await importPutty(async () => { throw { stderr: 'ERROR: The system was unable to find the specified registry key or value.' }; }), []);
  const rows = await importPutty(async (_, args) => ({ stdout: args[1].endsWith('Sessions') ? 'HKEY_CURRENT_USER\\Software\\SimonTatham\\PuTTY\\Sessions\\Meu%20Switch' : ' HostName REG_SZ switch.local\n Protocol REG_SZ telnet\n PortNumber REG_DWORD 0x17\n' }));
  assert.equal(rows[0].name, 'Meu Switch'); assert.equal(rows[0].type, 'telnet'); assert.equal(rows[0].port, 23);
});
