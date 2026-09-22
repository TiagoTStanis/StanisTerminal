const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { profile } = require('../src/config.cjs');
const { Files } = require('../src/files.cjs');
const { Transfers } = require('../src/transfers.cjs');
const { RemoteFiles } = require('../src/remotefiles.cjs');

test('perfil VNC aceita remoteOS windows/linux; outros tipos ignoram o campo', () => {
  const vnc = profile({ type: 'vnc', name: 'V', host: 'servidor', remoteOS: 'linux' });
  assert.equal(vnc.remoteOS, 'linux');
  const vncSemOS = profile({ type: 'vnc', name: 'V', host: 'servidor' });
  assert.equal(vncSemOS.remoteOS, undefined);
  const vncInvalido = profile({ type: 'vnc', name: 'V', host: 'servidor', remoteOS: 'macos' });
  assert.equal(vncInvalido.remoteOS, undefined);
  const rdp = profile({ type: 'rdp', name: 'R', host: 'servidor', remoteOS: 'linux' });
  assert.equal(rdp.remoteOS, undefined);
});

test('Files.transfer kind local copia arquivo nos dois sentidos (compartilhamento de rede)', async () => {
  const a = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-net-a-'));
  const b = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-net-b-'));
  const source = path.join(a, 'arquivo.txt'); fs.writeFileSync(source, 'conteúdo');
  const files = new Files({}, () => {});
  const dest = path.join(b, 'copia.txt');
  await files.transfer('local', '', 'upload', source, dest);
  assert.equal(fs.readFileSync(dest, 'utf8'), 'conteúdo');
  const back = path.join(a, 'volta.txt');
  await files.transfer('local', '', 'download', back, dest);
  assert.equal(fs.readFileSync(back, 'utf8'), 'conteúdo');
});

test('fila de transferências aceita kind local (pastas inteiras)', async () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-net-src-'));
  fs.mkdirSync(path.join(src, 'sub')); fs.writeFileSync(path.join(src, 'sub', 'x.txt'), 'X');
  const destRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-net-dst-'));
  const dest = path.join(destRoot, 'pasta');
  const t = new Transfers({}, () => {});
  const wait = async id => { for (let i = 0; i < 100; i++) { const j = t.list().find(x => x.id === id); if (j && !['na fila', 'enviando', 'baixando'].includes(j.status)) return j; await new Promise(r => setTimeout(r, 50)); } throw new Error('tempo'); };
  const job = await wait(t.add({ kind: 'local', id: '', direction: 'upload', local: src, remote: dest }));
  assert.strictEqual(job.status, 'concluída', job.error);
  assert.equal(fs.readFileSync(path.join(dest, 'sub', 'x.txt'), 'utf8'), 'X');
});

test('RemoteFiles.open pergunta o sistema operacional só uma vez e não altera sessão avulsa não salva', async () => {
  const asked = [];
  const ask = async question => { asked.push(question); return { remoteOS: 'linux' }; };
  const fakeConfig = { value: { profiles: [] }, putProfile() { throw new Error('não deveria salvar perfil avulso'); } };
  const fakeSsh = { connect: async () => { throw new Error('sem SSH real neste teste'); } };
  const fakeTerminals = { items: new Map(), close() {} };
  const rf = new RemoteFiles(fakeTerminals, fakeSsh, null, ask, fakeConfig);
  const vncProfile = profile({ type: 'vnc', name: 'V', host: '127.0.0.1', username: 'user' });
  await assert.rejects(rf.open(vncProfile), /sem SSH real/);
  assert.equal(asked.length, 1);
});

test('RemoteFiles.open não pergunta de novo quando remoteOS já está salvo no perfil', async () => {
  const ask = async () => { throw new Error('não deveria perguntar'); };
  const fakeConfig = { value: { profiles: [] } };
  const fakeSsh = { connect: async () => { throw new Error('não deveria usar SSH para um perfil Windows'); } };
  const fakeTerminals = { items: new Map(), close() {} };
  const rf = new RemoteFiles(fakeTerminals, fakeSsh, null, ask, fakeConfig);
  rf.openWindows = async () => ({ kind: 'local', id: '', path: '\\\\127.0.0.1\\c$', os: 'windows', unc: '\\\\127.0.0.1\\c$' });
  const vncProfile = profile({ type: 'vnc', name: 'V', host: '127.0.0.1', username: 'user', remoteOS: 'windows' });
  const info = await rf.open(vncProfile);
  assert.equal(info.os, 'windows');
});
