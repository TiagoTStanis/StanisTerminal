const net = require('node:net');
const dns = require('node:dns/promises');
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const { host, port } = require('./config.cjs');
const servers = require('./servers.cjs');
const execute = promisify(execFile);
function inside(root, file) { const relative = path.relative(root, file); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); }
class Network {
  constructor(sessions, emit) { this.sessions = sessions; this.emit = emit; this.servers = new Map(); this.sockets = new Set(); }
  async diagnostic(options) {
    const target = host(options.host);
    if (options.tool === 'dns') return JSON.stringify(await dns.lookup(target, { all: true }), null, 2);
    if (options.tool === 'tcp') {
      const started = Date.now();
      return new Promise(resolve => {
        const socket = net.createConnection({ host: target, port: port(options.port) });
        socket.setTimeout(4000);
        socket.once('connect', () => { socket.destroy(); resolve(`Porta aberta em ${Date.now() - started} ms.`); });
        socket.once('timeout', () => { socket.destroy(); resolve('Sem resposta (timeout).'); });
        socket.once('error', error => resolve(`Conexão falhou: ${error.message}`));
      });
    }
    const commands = { ping: ['ping.exe', ['-n', '4', target]], trace: ['tracert.exe', ['-d', '-h', '12', '-w', '500', target]] };
    if (!commands[options.tool]) throw new Error('Ferramenta inválida.');
    const [command, args] = commands[options.tool];
    try { const result = await execute(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', command), args, { windowsHide: true, timeout: 30000 }); return result.stdout; }
    catch (error) { return error.stdout || error.message; }
  }
  track(socket) { this.sockets.add(socket); socket.on('error', () => socket.destroy()); socket.once('close', () => this.sockets.delete(socket)); return socket; }
  async tunnel(options) {
    const item = this.sessions.get(options.session);
    if (!item.client || item.ended) throw new Error('Selecione uma sessão SSH ativa.');
    const target = host(options.host), targetPort = port(options.port), bindPort = port(options.localPort);
    const id = crypto.randomUUID();
    const connections = new Set();
    const track = socket => { connections.add(socket); socket.once('close', () => connections.delete(socket)); return this.track(socket); };
    const server = net.createServer(socket => {
      track(socket);
      item.client.forwardOut('127.0.0.1', socket.remotePort || 0, target, targetPort, (error, stream) => {
        if (error) { socket.destroy(); this.emit('notice', error.message); return; }
        if (socket.destroyed) { stream.destroy(); return; }
        track(stream); socket.pipe(stream).pipe(socket); socket.on('close', () => stream.destroy()); stream.on('close', () => socket.destroy());
      });
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(bindPort, '127.0.0.1', resolve); });
    const info = { id, name: `127.0.0.1:${bindPort} → ${target}:${targetPort}`, server, connections, kind: 'tunnel' };
    this.servers.set(id, info); item.client.once('close', () => this.stop(id)); return { id, name: info.name };
  }
  // Proxy SOCKS5 (sem autenticação, só 127.0.0.1) que sai pela sessão SSH — equivalente a "ssh -D".
  async socks(options) {
    const item = this.sessions.get(options.session);
    if (!item.client || item.ended) throw new Error('Selecione uma sessão SSH ativa.');
    const bindPort = port(options.localPort, 1080); const id = crypto.randomUUID(); const connections = new Set();
    const track = socket => { connections.add(socket); socket.once('close', () => connections.delete(socket)); return this.track(socket); };
    const server = net.createServer(socket => {
      track(socket); let stage = 0, buffer = Buffer.alloc(0);
      const onData = chunk => {
        buffer = Buffer.concat([buffer, chunk]);
        if (stage === 0) {
          if (buffer.length < 2) return; if (buffer[0] !== 5 || buffer.length < 2 + buffer[1]) return socket.destroy();
          socket.write(Buffer.from([5, 0])); buffer = buffer.subarray(2 + buffer[1]); stage = 1;
        }
        if (stage === 1) {
          if (buffer.length < 5) return; const type = buffer[3]; let target, end;
          if (type === 1) { if (buffer.length < 10) return; target = [...buffer.subarray(4, 8)].join('.'); end = 8; }
          else if (type === 3) { end = 5 + buffer[4]; if (buffer.length < end + 2) return; target = buffer.subarray(5, end).toString(); }
          else if (type === 4) { if (buffer.length < 22) return; target = buffer.subarray(4, 20).toString('hex').match(/.{4}/g).join(':'); end = 20; }
          else { socket.end(Buffer.from([5, 8, 0, 1, 0, 0, 0, 0, 0, 0])); return; }
          const targetPort = buffer.readUInt16BE(end); const rest = buffer.subarray(end + 2); stage = 2; socket.removeListener('data', onData); socket.pause();
          if (buffer[1] !== 1) { socket.end(Buffer.from([5, 7, 0, 1, 0, 0, 0, 0, 0, 0])); return; }
          item.client.forwardOut('127.0.0.1', 0, target, targetPort, (error, stream) => {
            if (error || socket.destroyed) { socket.end(Buffer.from([5, 5, 0, 1, 0, 0, 0, 0, 0, 0])); return; }
            track(stream); socket.write(Buffer.from([5, 0, 0, 1, 0, 0, 0, 0, 0, 0]));
            if (rest.length) stream.write(rest); socket.pipe(stream).pipe(socket); socket.resume(); socket.on('close', () => stream.destroy()); stream.on('close', () => socket.destroy());
          });
        }
      };
      socket.on('data', onData);
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(bindPort, '127.0.0.1', resolve); });
    const info = { id, name: `SOCKS5 127.0.0.1:${bindPort} via ${item.profile.name}`, server, connections, kind: 'socks' };
    this.servers.set(id, info); item.client.once('close', () => this.stop(id)); return { id, name: info.name };
  }
  // Túnel remoto ("ssh -R"): o servidor abre uma porta que chega em host:porta deste computador.
  async remoteTunnel(options) {
    const item = this.sessions.get(options.session);
    if (!item.client || item.ended) throw new Error('Selecione uma sessão SSH ativa.');
    const remotePort = Number(options.remotePort), target = host(options.host), targetPort = port(options.port);
    if (!Number.isInteger(remotePort) || remotePort < 1 || remotePort > 65535) throw new Error('Porta remota inválida.');
    const id = crypto.randomUUID(); const connections = new Set();
    await new Promise((resolve, reject) => item.client.forwardIn('127.0.0.1', remotePort, error => error ? reject(error) : resolve()));
    const handler = (info, accept, reject) => {
      if (info.destPort !== remotePort) return;
      const stream = accept(); const socket = net.createConnection({ host: target, port: targetPort });
      connections.add(stream); connections.add(socket); this.track(socket);
      socket.on('error', () => stream.destroy()); stream.on('error', () => socket.destroy()); stream.on('close', () => socket.destroy()); socket.on('close', () => stream.destroy());
      socket.on('connect', () => { stream.pipe(socket).pipe(stream); });
    };
    item.client.on('tcp connection', handler);
    const info = { id, name: `Remoto ${item.profile.name}:${remotePort} → ${target}:${targetPort}`, kind: 'remote', connections, server: { close: () => { item.client.removeListener('tcp connection', handler); if (!item.ended) item.client.unforwardIn('127.0.0.1', remotePort, () => {}); }, closeAllConnections() {} } };
    this.servers.set(id, info); item.client.once('close', () => this.stop(id)); return { id, name: info.name };
  }
  // Servidores TFTP, FTP e SFTP restritos a 127.0.0.1 sobre a pasta escolhida.
  async host(options) {
    const kind = options.kind; if (!['tftp', 'ftp', 'sftp'].includes(kind)) throw new Error('Servidor inválido.');
    const root = await fsp.realpath(options.directory); const bindPort = port(options.port, { tftp: 6969, ftp: 2121, sftp: 2222 }[kind]); const writable = !!options.writable;
    let handle;
    if (kind === 'sftp') {
      if (!options.username || !options.password || options.password.length < 8) throw new Error('Informe usuário e senha (mínimo 8 caracteres) para o SFTP.');
      handle = await servers.sftpServer({ root, port: bindPort, username: options.username, password: options.password, writable, overwrite: process.env.STANIS_TEST_OVERWRITE === '1' });
    } else handle = await servers[kind]({ root, port: bindPort, writable });
    const id = crypto.randomUUID(), name = `${kind.toUpperCase()} 127.0.0.1:${bindPort} — ${root}${writable ? ' (leitura e gravação)' : ' (somente leitura)'}`;
    this.servers.set(id, { id, name, kind, server: { close: () => handle.close(), closeAllConnections() {} } }); return { id, name };
  }
  async serve(options) {
    const root = await fsp.realpath(options.directory); const bindPort = port(options.port, 8080);
    const server = http.createServer(async (req, res) => {
      try {
        if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        let candidate = path.resolve(root, '.' + pathname.replaceAll('/', path.sep));
        if (!inside(root, candidate)) { res.writeHead(403).end(); return; }
        candidate = await fsp.realpath(candidate);
        if (!inside(root, candidate)) { res.writeHead(403).end(); return; }
        let stat = await fsp.stat(candidate);
        if (stat.isDirectory()) {
          candidate = await fsp.realpath(path.join(candidate, 'index.html'));
          if (!inside(root, candidate)) { res.writeHead(403).end(); return; }
          stat = await fsp.stat(candidate);
        }
        res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Content-Security-Policy', "default-src 'self'; object-src 'none'");
        const types = { '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
        res.setHeader('Content-Type', types[path.extname(candidate).toLowerCase()] || 'application/octet-stream'); res.setHeader('Content-Length', stat.size);
        if (req.method === 'HEAD') { res.end(); return; }
        fs.createReadStream(candidate).on('error', () => res.destroy()).pipe(res);
      } catch { if (!res.headersSent) res.writeHead(404); res.end('Arquivo não encontrado.'); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(bindPort, '127.0.0.1', resolve); });
    const id = crypto.randomUUID(), name = `HTTP http://127.0.0.1:${bindPort} — ${root}`;
    this.servers.set(id, { id, name, server, kind: 'http' }); return { id, name };
  }
  list() { return [...this.servers.values()].map(({ id, name, kind }) => ({ id, name, kind })); }
  stop(id) { const entry = this.servers.get(id); if (entry) { for (const socket of entry.connections || []) socket.destroy(); entry.server.close(); entry.server.closeAllConnections?.(); this.servers.delete(id); } }
  closeAll() { for (const socket of this.sockets) socket.destroy(); for (const id of this.servers.keys()) this.stop(id); }
}
module.exports = { Network, inside };
