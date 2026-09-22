const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const dgram = require('node:dgram');
const { Client: FtpClient } = require('basic-ftp');
const { Client: SshClient } = require('ssh2');
const { Network } = require('../src/network.cjs');

const free = () => new Promise(resolve => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const udpFree = () => new Promise(resolve => { const s = dgram.createSocket('udp4'); s.bind(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
function folder() { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-srv-')); fs.writeFileSync(path.join(d, 'oi.txt'), 'olá mundo'); return d; }

test('servidor FTP lista e baixa, e recusa gravação por padrão', async () => {
  const dir = folder(); const net_ = new Network({}, () => {}); const port = await free();
  await net_.host({ kind: 'ftp', directory: dir, port });
  const c = new FtpClient(); await c.access({ host: '127.0.0.1', port, user: 'anonymous', password: 'x' });
  assert.ok((await c.list()).some(x => x.name === 'oi.txt'));
  const out = path.join(dir, '..', 'baixado-' + process.pid + '.txt'); await c.downloadTo(out, 'oi.txt'); assert.strictEqual(fs.readFileSync(out, 'utf8'), 'olá mundo'); fs.unlinkSync(out);
  await assert.rejects(c.uploadFrom(out.replace('baixado', 'x'), 'novo.txt'));
  await assert.rejects(c.downloadTo(out, '../../etc/passwd'));
  c.close(); net_.closeAll();
});

test('servidor FTP grava quando permitido e não sobrescreve', async () => {
  const dir = folder(); const net_ = new Network({}, () => {}); const port = await free();
  await net_.host({ kind: 'ftp', directory: dir, port, writable: true });
  const src = path.join(dir, 'oi.txt'); const c = new FtpClient(); await c.access({ host: '127.0.0.1', port });
  await c.uploadFrom(src, 'copia.txt'); assert.strictEqual(fs.readFileSync(path.join(dir, 'copia.txt'), 'utf8'), 'olá mundo');
  await assert.rejects(c.uploadFrom(src, 'oi.txt')); c.close(); net_.closeAll();
});

test('servidor TFTP entrega arquivo em blocos e bloqueia saída da pasta', async () => {
  const dir = folder(); fs.writeFileSync(path.join(dir, 'grande.bin'), Buffer.alloc(1200, 7));
  const net_ = new Network({}, () => {}); const port = await udpFree();
  await net_.host({ kind: 'tftp', directory: dir, port });
  const get = name => new Promise((resolve, reject) => {
    const s = dgram.createSocket('udp4'); const parts = []; const t = setTimeout(() => { s.close(); reject(new Error('timeout')); }, 4000);
    s.on('message', (m, r) => { const op = m.readUInt16BE(0); if (op === 5) { clearTimeout(t); s.close(); return resolve(null); } if (op === 3) { parts.push(m.subarray(4)); s.send(Buffer.from([0, 4, m[2], m[3]]), r.port, r.address); if (m.length < 516) { clearTimeout(t); s.close(); resolve(Buffer.concat(parts)); } } });
    s.send(Buffer.concat([Buffer.from([0, 1]), Buffer.from(name + '\0octet\0')]), port, '127.0.0.1');
  });
  assert.strictEqual((await get('grande.bin')).length, 1200);
  assert.strictEqual((await get('oi.txt')).toString(), 'olá mundo');
  assert.strictEqual(await get('../../Windows/win.ini'), null);
  net_.closeAll();
});

test('servidor SFTP exige senha correta e lista arquivos', async () => {
  const dir = folder(); const net_ = new Network({}, () => {}); const port = await free();
  await net_.host({ kind: 'sftp', directory: dir, port, username: 'ana', password: 'senha-forte-1' });
  const connect = password => new Promise((resolve, reject) => { const c = new SshClient(); c.on('ready', () => resolve(c)).on('error', reject).connect({ host: '127.0.0.1', port, username: 'ana', password, readyTimeout: 5000 }); });
  await assert.rejects(connect('errada-123456'));
  const c = await connect('senha-forte-1');
  const sftp = await new Promise((resolve, reject) => c.sftp((e, s) => e ? reject(e) : resolve(s)));
  const list = await new Promise((resolve, reject) => sftp.readdir('/', (e, l) => e ? reject(e) : resolve(l)));
  assert.ok(list.some(x => x.filename === 'oi.txt'));
  await assert.rejects(new Promise((resolve, reject) => sftp.unlink('/oi.txt', e => e ? reject(e) : resolve())));
  c.end(); net_.closeAll();
});

test('SFTP sem senha forte é recusado', async () => {
  const net_ = new Network({}, () => {});
  await assert.rejects(net_.host({ kind: 'sftp', directory: folder(), port: await free(), username: 'a', password: '123' }));
});

test('SOCKS5 encaminha pelo cliente SSH da sessão', async () => {
  const echo = net.createServer(s => s.on('data', d => s.write(Buffer.concat([Buffer.from('eco:'), d])))); await new Promise(r => echo.listen(0, '127.0.0.1', r));
  const target = echo.address().port;
  const fakeClient = Object.assign(new (require('node:events'))(), { forwardOut: (a, b, host, p, cb) => { const s = net.createConnection({ host, port: p }); s.once('connect', () => cb(null, s)); s.once('error', cb); } });
  const item = { client: fakeClient, ended: false, profile: { name: 'teste' } };
  const net_ = new Network({ get: () => item }, () => {}); const socksPort = await free();
  await net_.socks({ session: 'x', localPort: socksPort });
  const reply = await new Promise((resolve, reject) => {
    const s = net.createConnection({ host: '127.0.0.1', port: socksPort }); let stage = 0;
    s.on('connect', () => s.write(Buffer.from([5, 1, 0])));
    s.on('data', d => {
      if (stage === 0) { stage = 1; const req = Buffer.alloc(10); req.set([5, 1, 0, 1, 127, 0, 0, 1]); req.writeUInt16BE(target, 8); s.write(req); }
      else if (stage === 1) { assert.strictEqual(d[1], 0); stage = 2; s.write('ping'); }
      else { s.destroy(); resolve(d.toString()); }
    });
    s.on('error', reject);
  });
  assert.strictEqual(reply, 'eco:ping'); net_.closeAll(); echo.close();
});

test('fila de transferências envia e baixa pastas inteiras por SFTP', async () => {
  const { Transfers } = require('../src/transfers.cjs');
  const remoteDir = folder(); const net_ = new Network({}, () => {}); const port = await free();
  await net_.host({ kind: 'sftp', directory: remoteDir, port, username: 'ana', password: 'senha-forte-1', writable: true });
  const client = await new Promise((resolve, reject) => { const c = new SshClient(); c.on('ready', () => resolve(c)).on('error', reject).connect({ host: '127.0.0.1', port, username: 'ana', password: 'senha-forte-1' }); });
  const sftp = await new Promise((resolve, reject) => client.sftp((e, s) => e ? reject(e) : resolve(s)));
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-up-')); fs.mkdirSync(path.join(src, 'sub')); fs.writeFileSync(path.join(src, 'a.txt'), 'A'); fs.writeFileSync(path.join(src, 'sub', 'b.txt'), 'B');
  const states = []; const t = new Transfers({ remote: async () => sftp, ftp: new Map() }, s => states.push(s));
  const wait = async id => { for (let i = 0; i < 100; i++) { const j = t.list().find(x => x.id === id); if (j && !['na fila', 'enviando', 'baixando'].includes(j.status)) return j; await new Promise(r => setTimeout(r, 50)); } throw new Error('tempo'); };
  const up = await wait(t.add({ kind: 'sftp', id: 'x', direction: 'upload', local: src, remote: '/pasta' }));
  assert.strictEqual(up.status, 'concluída', up.error); assert.strictEqual(fs.readFileSync(path.join(remoteDir, 'pasta', 'sub', 'b.txt'), 'utf8'), 'B'); assert.strictEqual(up.total, 2);
  const dest = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-down-')), 'volta');
  const down = await wait(t.add({ kind: 'sftp', id: 'x', direction: 'download', local: dest, remote: '/pasta' }));
  assert.strictEqual(down.status, 'concluída', down.error); assert.strictEqual(fs.readFileSync(path.join(dest, 'a.txt'), 'utf8'), 'A'); assert.strictEqual(fs.readFileSync(path.join(dest, 'sub', 'b.txt'), 'utf8'), 'B');
  const cancelled = t.add({ kind: 'sftp', id: 'x', direction: 'upload', local: src, remote: '/pasta2' }); t.cancel(cancelled); await wait(cancelled);
  assert.throws(() => t.add({ kind: 'bogus', id: 'x', direction: 'upload', local: src, remote: '/x' }));
  client.end(); net_.closeAll();
});

test('espelho envia novos e alterados, nunca apaga nem sobrescreve arquivo mais novo no servidor', async () => {
  process.env.STANIS_TEST_OVERWRITE = '1'; // só o processo de teste habilita sobrescrita no servidor SFTP de apoio
  const { Mirror } = require('../src/mirror.cjs');
  const remoteDir = folder(); const net_ = new Network({}, () => {}); const port = await free();
  await net_.host({ kind: 'sftp', directory: remoteDir, port, username: 'ana', password: 'senha-forte-1', writable: true });
  const client = await new Promise((resolve, reject) => { const c = new SshClient(); c.on('ready', () => resolve(c)).on('error', reject).connect({ host: '127.0.0.1', port, username: 'ana', password: 'senha-forte-1' }); });
  const sftp = await new Promise((resolve, reject) => client.sftp((e, s) => e ? reject(e) : resolve(s)));
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-mir-')); fs.mkdirSync(path.join(src, 'sub')); fs.writeFileSync(path.join(src, 'a.txt'), 'A1'); fs.writeFileSync(path.join(src, 'sub', 'b.txt'), 'B1');
  fs.mkdirSync(path.join(remoteDir, 'esp')); fs.writeFileSync(path.join(remoteDir, 'esp', 'so-remoto.txt'), 'fica');
  const notices = []; const mirror = await new Mirror({ remote: async () => sftp }, (c, m) => notices.push(m)).start({ session: 'x', local: src, remote: '/esp', interval: 300 });
  const read = f => fs.readFileSync(path.join(remoteDir, 'esp', f), 'utf8');
  assert.strictEqual(read('a.txt'), 'A1'); assert.strictEqual(read('sub/b.txt'), 'B1');
  fs.writeFileSync(path.join(src, 'a.txt'), 'A2-alterado'); fs.writeFileSync(path.join(src, 'novo.txt'), 'N');
  const ready = () => { try { return read('a.txt') === 'A2-alterado' && read('novo.txt') === 'N'; } catch { return false; } };
  for (let i = 0; i < 60 && !ready(); i++) await new Promise(r => setTimeout(r, 100));
  assert.strictEqual(read('a.txt'), 'A2-alterado'); assert.strictEqual(read('novo.txt'), 'N');
  fs.unlinkSync(path.join(src, 'novo.txt')); await new Promise(r => setTimeout(r, 900));
  assert.strictEqual(read('novo.txt'), 'N', 'não pode apagar no servidor'); assert.strictEqual(read('so-remoto.txt'), 'fica');
  mirror.stop(); fs.writeFileSync(path.join(src, 'a.txt'), 'A3-depois-de-parar'); await new Promise(r => setTimeout(r, 800));
  assert.strictEqual(read('a.txt'), 'A2-alterado', 'parado não envia mais'); client.end(); net_.closeAll(); delete process.env.STANIS_TEST_OVERWRITE;
});
