// Servidor de laboratório que segue o protocolo do TightVNC 2.8 (segurança Tight + autenticação VNC +
// mensagens de arquivos 0xFC0001xx), com arquivos e pastas em memória. Com { rfb: true } também oferece
// a segurança "None": o noVNC escolhe essa e recebe uma tela 64x64, enquanto o canal de arquivos do app
// escolhe a Tight — como um TightVNC de verdade atendendo a tela e os arquivos na mesma porta.
const net = require('node:net');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { vncResponse, FT } = require('../src/tightft.cjs');

function labServer({ password = 'lab123', fileTransfer = true, rfb = false } = {}) {
  const files = new Map([['/C:/pasta/antigo.txt', Buffer.from('conteúdo antigo')]]); const dirs = new Set(['/C:/pasta']);
  const sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket));
    let buf = Buffer.alloc(0); const waiters = [];
    socket.on('data', d => { buf = Buffer.concat([buf, d]); pump(); }); socket.on('error', () => {});
    const pump = () => { while (waiters.length && buf.length >= waiters[0].n) { const w = waiters.shift(); w.resolve(buf.subarray(0, w.n)); buf = buf.subarray(w.n); } };
    const read = n => new Promise(resolve => { waiters.push({ n, resolve }); pump(); });
    const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
    const str = async () => (await read((await read(4)).readUInt32BE())).toString('utf8');
    const cap = code => Buffer.concat([u32(code), Buffer.alloc(12)]);
    const serverInit = () => {
      const name = Buffer.from('lab'), header = Buffer.alloc(24);
      header.writeUInt16BE(64, 0); header.writeUInt16BE(64, 2); header[4] = 32; header[5] = 24; header[7] = 1;
      header.writeUInt16BE(255, 8); header.writeUInt16BE(255, 10); header.writeUInt16BE(255, 12); header[14] = 16; header[15] = 8; header.writeUInt32BE(name.length, 20);
      return Buffer.concat([header, name]);
    };
    // Tela mínima para o noVNC: responde pedidos de atualização com um quadro verde e ignora o resto.
    const screen = async () => {
      socket.write(u32(0)); await read(1); socket.write(serverInit());
      for (;;) {
        const type = (await read(1))[0];
        if (type === 0) await read(19);
        else if (type === 2) { const head = await read(3); await read(head.readUInt16BE(1) * 4); }
        else if (type === 3) {
          await read(9); const header = Buffer.alloc(16); header.writeUInt16BE(1, 2); header.writeUInt16BE(64, 8); header.writeUInt16BE(64, 10);
          const pixels = Buffer.alloc(64 * 64 * 4); for (let i = 0; i < pixels.length; i += 4) pixels[i + 1] = 160;
          socket.write(Buffer.concat([header, pixels]));
        } else if (type === 4) await read(7);
        else if (type === 5) await read(5);
        else if (type === 6) { const head = await read(7); await read(head.readUInt32BE(3)); }
        else return socket.end();
      }
    };
    (async () => {
      socket.write('RFB 003.008\n'); await read(12);
      socket.write(Buffer.from(rfb ? [2, 1, 16] : [2, 2, 16]));
      const chosen = (await read(1))[0]; if (rfb && chosen === 1) return screen();
      assert.equal(chosen, 16);
      socket.write(u32(0)); socket.write(Buffer.concat([u32(1), cap(2)])); assert.equal((await read(4)).readUInt32BE(), 2);
      const challenge = crypto.randomBytes(16); socket.write(challenge);
      const ok = Buffer.compare(await read(16), vncResponse(password, challenge)) === 0;
      socket.write(u32(ok ? 0 : 1)); if (!ok) { socket.write(Buffer.concat([u32(4), Buffer.from('nope')])); socket.end(); return; }
      assert.equal((await read(1))[0], 1, 'ClientInit compartilhado');
      socket.write(serverInit());
      const client = fileTransfer ? [FT.FILE_LIST_REQUEST, FT.UPLOAD_START_REQUEST, FT.DOWNLOAD_START_REQUEST] : [];
      const hdr = Buffer.alloc(8); hdr.writeUInt16BE(0, 0); hdr.writeUInt16BE(client.length, 2); socket.write(Buffer.concat([hdr, ...client.map(cap)]));
      socket.write(Buffer.from([2])); // um "sino" no meio, que o cliente deve ignorar
      let upload = null, download = null;
      for (;;) {
        const id = (await read(4)).readUInt32BE();
        const fail = message => socket.write(Buffer.concat([u32(FT.LAST_REQUEST_FAILED_REPLY), u32(Buffer.byteLength(message)), Buffer.from(message)]));
        if (id === FT.FILE_LIST_REQUEST) {
          await read(1); const folder = await str();
          if (folder === '/C:/bloqueado') { fail('Access denied.'); continue; } // sessão remota bloqueada/sem usuário
          const entries = [...new Set([...files.keys()].filter(f => path.posix.dirname(f) === folder).map(f => path.posix.basename(f)))];
          const subdirs = [...dirs].filter(d => path.posix.dirname(d) === folder && d !== folder).map(d => path.posix.basename(d));
          if (folder === '/') subdirs.push(...[...dirs].map(d => d.split('/')[1]).filter((d, i, all) => all.indexOf(d) === i));
          if (!entries.length && !subdirs.length && !dirs.has(folder)) { fail('Error code 3'); continue; }
          const row = (e, size, flags) => { const n = Buffer.from(e); const meta = Buffer.alloc(18); meta.writeBigUInt64BE(BigInt(size)); meta.writeBigUInt64BE(BigInt(Date.UTC(2026, 8, 1, 12)), 8); meta.writeUInt16BE(flags, 16); return Buffer.concat([meta, u32(n.length), n]); };
          const body = Buffer.concat([u32(entries.length + subdirs.length), ...entries.map(e => row(e, files.get(folder + '/' + e).length, 0)), ...subdirs.map(d => row(d, 0, 1))]);
          socket.write(Buffer.concat([u32(FT.FILE_LIST_REPLY), Buffer.from([0]), u32(body.length), u32(body.length), body]));
        } else if (id === FT.MKDIR_REQUEST) {
          dirs.add(await str()); socket.write(u32(FT.MKDIR_REPLY));
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
  const close = () => { for (const socket of sockets) socket.destroy(); server.close(); };
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, files, dirs, close })));
}
module.exports = { labServer };
