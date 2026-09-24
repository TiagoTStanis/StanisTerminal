// Transferência de arquivos do TightVNC contra um servidor de laboratório que segue o protocolo do
// TightVNC 2.8 (segurança Tight + autenticação VNC + mensagens 0xFC0001xx), com arquivos em memória.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { TightFT, vncResponse, FT } = require('../src/tightft.cjs');

function labServer({ password = 'lab123', fileTransfer = true } = {}) {
  const files = new Map([['/C:/pasta/antigo.txt', Buffer.from('conteúdo antigo')]]);
  const server = net.createServer(socket => {
    let buf = Buffer.alloc(0); const waiters = [];
    socket.on('data', d => { buf = Buffer.concat([buf, d]); pump(); }); socket.on('error', () => {});
    const pump = () => { while (waiters.length && buf.length >= waiters[0].n) { const w = waiters.shift(); w.resolve(buf.subarray(0, w.n)); buf = buf.subarray(w.n); } };
    const read = n => new Promise(resolve => { waiters.push({ n, resolve }); pump(); });
    const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
    const str = async () => (await read((await read(4)).readUInt32BE())).toString('utf8');
    const cap = code => Buffer.concat([u32(code), Buffer.alloc(12)]);
    (async () => {
      socket.write('RFB 003.008\n'); await read(12);
      socket.write(Buffer.from([2, 2, 16])); assert.equal((await read(1))[0], 16);
      socket.write(u32(0)); socket.write(Buffer.concat([u32(1), cap(2)])); assert.equal((await read(4)).readUInt32BE(), 2);
      const challenge = crypto.randomBytes(16); socket.write(challenge);
      const ok = Buffer.compare(await read(16), vncResponse(password, challenge)) === 0;
      socket.write(u32(ok ? 0 : 1)); if (!ok) { socket.write(Buffer.concat([u32(4), Buffer.from('nope')])); socket.end(); return; }
      assert.equal((await read(1))[0], 1, 'ClientInit compartilhado');
      const name = Buffer.from('lab'); socket.write(Buffer.concat([Buffer.alloc(20), u32(name.length), name]));
      const client = fileTransfer ? [FT.FILE_LIST_REQUEST, FT.UPLOAD_START_REQUEST, FT.DOWNLOAD_START_REQUEST] : [];
      const hdr = Buffer.alloc(8); hdr.writeUInt16BE(0, 0); hdr.writeUInt16BE(client.length, 2); socket.write(Buffer.concat([hdr, ...client.map(cap)]));
      socket.write(Buffer.from([2])); // um "sino" no meio, que o cliente deve ignorar
      let upload = null, download = null;
      for (;;) {
        const id = (await read(4)).readUInt32BE();
        const fail = message => socket.write(Buffer.concat([u32(FT.LAST_REQUEST_FAILED_REPLY), u32(Buffer.byteLength(message)), Buffer.from(message)]));
        if (id === FT.FILE_LIST_REQUEST) {
          await read(1); const folder = await str();
          const entries = [...new Set([...files.keys()].filter(f => path.posix.dirname(f) === folder).map(f => path.posix.basename(f)))];
          if (!entries.length && folder !== '/C:/pasta') { fail('Error code 3'); continue; }
          const body = Buffer.concat([u32(entries.length), ...entries.map(e => { const n = Buffer.from(e); const meta = Buffer.alloc(18); meta.writeBigUInt64BE(BigInt(files.get(folder + '/' + e).length)); meta.writeUInt16BE(0, 16); return Buffer.concat([meta, u32(n.length), n]); })]);
          socket.write(Buffer.concat([u32(FT.FILE_LIST_REPLY), Buffer.from([0]), u32(body.length), u32(body.length), body]));
        } else if (id === FT.UPLOAD_START_REQUEST) {
          upload = { name: await str(), chunks: [] }; await read(9); socket.write(u32(FT.UPLOAD_START_REPLY));
        } else if (id === FT.UPLOAD_DATA_REQUEST) {
          await read(1); const size = (await read(4)).readUInt32BE(); await read(4); upload.chunks.push(Buffer.from(await read(size))); socket.write(u32(FT.UPLOAD_DATA_REPLY));
        } else if (id === FT.UPLOAD_END_REQUEST) {
          await read(10); files.set(upload.name, Buffer.concat(upload.chunks)); socket.write(u32(FT.UPLOAD_END_REPLY));
        } else if (id === FT.DOWNLOAD_START_REQUEST) {
          const name = await str(); await read(8);
          if (!files.has(name)) { fail('Error code 2'); continue; }
          download = { data: files.get(name), at: 0 }; socket.write(u32(FT.DOWNLOAD_START_REPLY));
        } else if (id === FT.DOWNLOAD_DATA_REQUEST) {
          await read(1); const size = (await read(4)).readUInt32BE();
          if (download.at >= download.data.length) { socket.write(Buffer.concat([u32(FT.DOWNLOAD_END_REPLY), Buffer.alloc(9)])); continue; }
          const part = download.data.subarray(download.at, download.at + size); download.at += part.length;
          socket.write(Buffer.concat([u32(FT.DOWNLOAD_DATA_REPLY), Buffer.from([0]), u32(part.length), u32(part.length), part]));
        } else { socket.end(); return; }
      }
    })().catch(() => socket.destroy());
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, files })));
}

test('lista, envia (vários pedaços), baixa e traduz os erros do servidor', async () => {
  const { server, port, files } = await labServer();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tightft-'));
  try {
    const ft = await TightFT.connect({ host: '127.0.0.1', port, password: 'lab123' });
    assert.deepEqual((await ft.list('/C:/pasta')).map(r => r.name), ['antigo.txt']);
    const local = path.join(dir, 'grande.bin'), bytes = crypto.randomBytes(200 * 1024 + 5); fs.writeFileSync(local, bytes);
    await ft.upload(local, '/C:/pasta/grande.bin', true);
    assert.equal(Buffer.compare(files.get('/C:/pasta/grande.bin'), bytes), 0, 'upload em pedaços chega inteiro');
    const back = path.join(dir, 'volta.bin'); await ft.download('/C:/pasta/grande.bin', back);
    assert.equal(Buffer.compare(fs.readFileSync(back), bytes), 0, 'download volta idêntico');
    await assert.rejects(ft.download('/C:/pasta/nao-existe.txt', path.join(dir, 'x')), /arquivo não encontrado/);
    await assert.rejects(ft.list('/C:/outra'), /pasta não encontrada/);
    ft.close();
  } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('senha errada e servidor sem transferência de arquivos dão mensagens claras', async () => {
  const a = await labServer();
  await assert.rejects(TightFT.connect({ host: '127.0.0.1', port: a.port, password: 'errada' }), /Senha do VNC recusada/);
  a.server.close();
  const b = await labServer({ fileTransfer: false });
  await assert.rejects(TightFT.connect({ host: '127.0.0.1', port: b.port, password: 'lab123' }), /desativada/);
  b.server.close();
});
