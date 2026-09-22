const net = require('node:net');
const dgram = require('node:dgram');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const ssh2 = require('ssh2');

function inside(root, file) { const r = path.relative(root, file); return r === '' || (!r.startsWith('..' + path.sep) && r !== '..' && !path.isAbsolute(r)); }
// Todos os servidores escutam só em 127.0.0.1 e são somente leitura, salvo quando "writable" for marcado.
function resolveIn(root, name) {
  const file = path.resolve(root, '.' + path.sep + String(name).replaceAll('\\', '/').replace(/^\/+/, ''));
  if (!inside(root, file)) throw new Error('Fora da pasta.');
  return file;
}
function listen(server, bindPort) { return new Promise((resolve, reject) => { server.once('error', reject); server.listen(bindPort, '127.0.0.1', resolve); }); }

// TFTP (RFC 1350): leitura e, se permitido, gravação de arquivos novos, blocos de 512 bytes.
async function tftp({ root, port, writable }) {
  const socket = dgram.createSocket('udp4'); const children = new Set();
  socket.on('message', (msg, rinfo) => {
    if (msg.length < 4) return;
    const op = msg.readUInt16BE(0); if (op !== 1 && op !== 2) return;
    const name = msg.subarray(2).toString('latin1').split('\0')[0];
    const child = dgram.createSocket('udp4'); children.add(child); child.on('close', () => children.delete(child));
    const fail = (code, text) => { const b = Buffer.alloc(5 + text.length); b.writeUInt16BE(5, 0); b.writeUInt16BE(code, 2); b.write(text, 4, 'latin1'); child.send(b, rinfo.port, rinfo.address, () => child.close()); };
    child.bind(0, '127.0.0.1', async () => {
      const timer = setTimeout(() => child.close(), 30000); child.on('close', () => clearTimeout(timer));
      let file; try { file = resolveIn(root, name); } catch { return fail(2, 'Acesso negado'); }
      try {
        if (op === 1) {
          const data = await fsp.readFile(file); let block = 1;
          const send = () => child.send(Buffer.concat([Buffer.from([0, 3, block >> 8, block & 255]), data.subarray((block - 1) * 512, block * 512)]), rinfo.port, rinfo.address);
          child.on('message', ack => {
            if (ack.length < 4 || ack.readUInt16BE(0) !== 4 || ack.readUInt16BE(2) !== block) return;
            if (data.length - (block - 1) * 512 < 512) { child.close(); return; }
            block++; send();
          });
          send();
        } else {
          if (!writable) return fail(2, 'Somente leitura');
          if (fs.existsSync(file)) return fail(6, 'Arquivo já existe');
          const chunks = []; let expected = 1, size = 0;
          child.send(Buffer.from([0, 4, 0, 0]), rinfo.port, rinfo.address);
          child.on('message', async m => {
            if (m.length < 4 || m.readUInt16BE(0) !== 3) return;
            const n = m.readUInt16BE(2);
            if (n === expected) { const d = m.subarray(4); size += d.length; if (size > 64 * 1024 * 1024) return fail(3, 'Limite de 64 MiB'); chunks.push(d); expected++; if (d.length < 512) { await fsp.writeFile(file, Buffer.concat(chunks), { flag: 'wx' }).catch(() => {}); } }
            child.send(Buffer.from([0, 4, n >> 8, n & 255]), rinfo.port, rinfo.address);
            if (n === expected - 1 && m.length < 516) setTimeout(() => child.close(), 500);
          });
        }
      } catch { fail(1, 'Arquivo não encontrado'); }
    });
  });
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.bind(port, '127.0.0.1', resolve); });
  return { close: () => { socket.close(); for (const c of children) c.close(); } };
}

// FTP mínimo (RFC 959): acesso anônimo, passivo, LIST/RETR e STOR (se permitido).
async function ftp({ root, port, writable }) {
  const sockets = new Set(), passives = new Set();
  const track = s => { sockets.add(s); s.on('close', () => sockets.delete(s)); s.on('error', () => s.destroy()); return s; };
  const server = net.createServer(control => {
    track(control); let cwd = '/', pasv = null, buffer = '';
    const say = line => { if (!control.destroyed) control.write(line + '\r\n'); };
    const real = p => resolveIn(root, path.posix.resolve(cwd, p || '.'));
    const data = () => new Promise((resolve, reject) => {
      if (!pasv) return reject(new Error('sem PASV'));
      if (pasv.queue.length) return resolve(pasv.queue.shift());
      const t = setTimeout(() => reject(new Error('tempo')), 10000); pasv.once('conn', s => { clearTimeout(t); pasv.queue.shift(); resolve(s); });
    });
    say('220 Stanis FTP local');
    control.on('data', async chunk => {
      buffer += chunk.toString('utf8'); let i;
      while ((i = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, i).trim(); buffer = buffer.slice(i + 1);
        const [cmd, ...rest] = line.split(' '); const arg = rest.join(' ');
        try {
          switch (cmd.toUpperCase()) {
            case 'USER': say('331 Senha'); break;
            case 'PASS': say('230 Entrou'); break;
            case 'SYST': say('215 UNIX Type: L8'); break;
            case 'FEAT': say('211 Sem extensões'); break;
            case 'OPTS': case 'NOOP': case 'TYPE': say('200 OK'); break;
            case 'PWD': say(`257 "${cwd}"`); break;
            case 'CWD': { if (!(await fsp.stat(real(arg))).isDirectory()) throw new Error(); cwd = path.posix.resolve(cwd, arg); say('250 OK'); break; }
            case 'CDUP': cwd = path.posix.dirname(cwd); say('250 OK'); break;
            case 'PASV': {
              pasv?.server.close();
              const emitter = new EventEmitter(); emitter.queue = []; const srv = net.createServer(s => { track(s); emitter.queue.push(s); emitter.emit('conn', s); });
              emitter.server = srv; passives.add(srv); srv.on('close', () => passives.delete(srv)); pasv = emitter; await listen(srv, 0);
              const p = srv.address().port; say(`227 Entering Passive Mode (127,0,0,1,${p >> 8},${p & 255})`); break;
            }
            case 'LIST': case 'NLST': {
              const target = real(arg && !arg.startsWith('-') ? arg : '.'); const entries = await fsp.readdir(target, { withFileTypes: true });
              say('150 Listando'); const s = await data();
              const rows = await Promise.all(entries.map(async e => { const st = await fsp.stat(path.join(target, e.name)).catch(() => ({ size: 0 })); return `${e.isDirectory() ? 'd' : '-'}rw-r--r-- 1 u g ${st.size} Jan 01 00:00 ${e.name}`; }));
              s.end(rows.join('\r\n') + '\r\n'); s.once('close', () => say('226 Pronto')); break;
            }
            case 'RETR': { const p = real(arg); if (!(await fsp.stat(p)).isFile()) throw new Error(); say('150 Enviando'); const s = await data(); fs.createReadStream(p).pipe(s); s.once('close', () => say('226 Pronto')); break; }
            case 'STOR': {
              if (!writable) { say('550 Somente leitura'); break; }
              const p = real(arg); if (fs.existsSync(p)) { say('550 Já existe'); break; }
              say('150 Recebendo'); const s = await data(); let n = 0; const out = fs.createWriteStream(p, { flags: 'wx' });
              s.on('data', d => { n += d.length; if (n > 256 * 1024 * 1024) s.destroy(); }); s.pipe(out); out.once('close', () => say('226 Pronto')); break;
            }
            case 'SIZE': say('213 ' + (await fsp.stat(real(arg))).size); break;
            case 'QUIT': say('221 Tchau'); control.end(); break;
            default: say('502 Não implementado');
          }
        } catch { say('550 Falhou'); }
      }
    });
  });
  await listen(server, port);
  return { close: () => { server.close(); for (const s of passives) s.close(); for (const s of sockets) s.destroy(); } };
}

// Servidor SFTP: sem shell; usuário e senha definidos ao iniciar; somente leitura por padrão.
async function sftpServer({ root, port, username, password, writable, overwrite = false }) {
  const S = ssh2.utils.sftp.STATUS_CODE, M = ssh2.utils.sftp.OPEN_MODE;
  const key = crypto.generateKeyPairSync('rsa', { modulusLength: 3072 }).privateKey.export({ type: 'pkcs1', format: 'pem' });
  const clients = new Set();
  const server = new ssh2.Server({ hostKeys: [key] }, client => {
    clients.add(client); client.on('close', () => clients.delete(client)); client.on('error', () => {});
    client.on('authentication', ctx => {
      const a = Buffer.from(ctx.method === 'password' ? ctx.password : ''), b = Buffer.from(password);
      const ok = ctx.method === 'password' && ctx.username === username && a.length === b.length && crypto.timingSafeEqual(a, b);
      ok ? ctx.accept() : ctx.reject(['password']);
    });
    client.on('ready', () => client.on('session', accept => accept().on('sftp', accept2 => {
      const sftp = accept2(); const handles = new Map(); let next = 0;
      const handle = v => { const b = Buffer.alloc(4); b.writeUInt32BE(++next); handles.set(b.toString('hex'), v); return b; };
      const get = b => handles.get(b.toString('hex'));
      const safe = name => resolveIn(root, name);
      const attrs = st => ({ mode: st.mode, uid: 0, gid: 0, size: st.size, atime: Math.floor(st.atimeMs / 1000), mtime: Math.floor(st.mtimeMs / 1000) });
      const guard = fn => async (id, ...args) => { try { await fn(id, ...args); } catch { sftp.status(id, S.NO_SUCH_FILE); } };
      sftp.on('REALPATH', guard((id, p) => { const rel = '/' + path.relative(root, safe(p)).replaceAll('\\', '/'); sftp.name(id, [{ filename: rel, longname: rel, attrs: {} }]); }));
      sftp.on('STAT', guard(async (id, p) => sftp.attrs(id, attrs(await fsp.stat(safe(p))))));
      sftp.on('LSTAT', guard(async (id, p) => sftp.attrs(id, attrs(await fsp.lstat(safe(p))))));
      sftp.on('OPENDIR', guard(async (id, p) => {
        const dir = safe(p); const list = await fsp.readdir(dir);
        const rows = (await Promise.all(list.map(async n => { const st = await fsp.stat(path.join(dir, n)).catch(() => null); return st && { filename: n, longname: n, attrs: attrs(st) }; }))).filter(Boolean);
        sftp.handle(id, handle({ dir: rows, sent: false }));
      }));
      sftp.on('READDIR', (id, hd) => { const x = get(hd); if (!x?.dir || x.sent) return sftp.status(id, S.EOF); x.sent = true; sftp.name(id, x.dir); });
      sftp.on('OPEN', guard(async (id, p, flags) => {
        const write = flags & (M.WRITE | M.CREAT | M.TRUNC | M.APPEND); const file = safe(p);
        if (write && (!writable || (!overwrite && fs.existsSync(file)))) return sftp.status(id, S.PERMISSION_DENIED);
        sftp.handle(id, handle({ fd: await fsp.open(file, write ? (overwrite ? 'w' : 'wx') : 'r') }));
      }));
      sftp.on('READ', guard(async (id, hd, offset, length) => { const x = get(hd); if (!x?.fd) return sftp.status(id, S.FAILURE); const buf = Buffer.alloc(length); const { bytesRead } = await x.fd.read(buf, 0, length, offset); bytesRead ? sftp.data(id, buf.subarray(0, bytesRead)) : sftp.status(id, S.EOF); }));
      sftp.on('WRITE', guard(async (id, hd, offset, chunk) => { const x = get(hd); if (!x?.fd || !writable) return sftp.status(id, S.FAILURE); await x.fd.write(chunk, 0, chunk.length, offset); sftp.status(id, S.OK); }));
      sftp.on('CLOSE', guard(async (id, hd) => { await get(hd)?.fd?.close(); handles.delete(hd.toString('hex')); sftp.status(id, S.OK); }));
      sftp.on('FSTAT', guard(async (id, hd) => { const x = get(hd); if (!x?.fd) return sftp.status(id, S.FAILURE); sftp.attrs(id, attrs(await x.fd.stat())); }));
      sftp.on('MKDIR', guard(async (id, p) => { if (!writable) return sftp.status(id, S.PERMISSION_DENIED); await fsp.mkdir(safe(p)); sftp.status(id, S.OK); }));
      for (const op of ['SETSTAT', 'FSETSTAT']) sftp.on(op, id => sftp.status(id, writable ? S.OK : S.PERMISSION_DENIED));
      for (const op of ['REMOVE', 'RMDIR', 'RENAME']) sftp.on(op, id => sftp.status(id, S.PERMISSION_DENIED));
    })));
  });
  await listen(server, port);
  return { close: () => { server.close(); for (const c of clients) c.end(); } };
}
module.exports = { tftp, ftp, sftpServer, resolveIn };
