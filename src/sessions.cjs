const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { StringDecoder } = require('node:string_decoder');
const { randomUUID } = require('node:crypto');
const pty = require('node-pty');
const { SerialPort } = require('serialport');
const { Telnet } = require('./telnet.cjs');

function localCommand(profile, toolPath) {
  const win = process.env.SystemRoot || 'C:\\Windows';
  const commands = {
    powershell: [path.join(win, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoLogo']],
    cmd: [path.join(win, 'System32', 'cmd.exe'), []],
    wsl: [path.join(win, 'System32', 'wsl.exe'), []],
    bash: [path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'), ['--login', '-i']]
  };
  if (profile.shell === 'busybox' && toolPath) commands.busybox = [toolPath('busybox'), ['sh']];
  if (profile.shell === 'msys2' && toolPath) commands.msys2 = [toolPath('msys2'), ['--login', '-i'], { MSYSTEM: 'MSYS', CHERE_INVOKING: '1' }];
  return commands[profile.shell];
}
class Sessions {
  constructor(ssh, emit) { this.ssh = ssh; this.emit = emit; this.items = new Map(); }
  async open(profile, cols = 100, rows = 30) {
    const id = randomUUID();
    const item = { id, profile, ended: false, log: null, pending: [], activated: false };
    const data = value => {
      if (item.log) item.log.write(value);
      if (item.activated) this.emit('terminal:data', { id, data: value });
      else item.pending.push(value);
    };
    const end = code => { if (item.ended) return; item.ended = true; item.exitCode = code; item.log?.end(); item.log = null; if (item.activated) this.emit('terminal:exit', { id, code }); };
    this.items.set(id, item);
    try {
      if (profile.type === 'local') {
        const [command, args, extraEnv] = localCommand(profile, this.toolPath);
        if (!fs.existsSync(command)) throw new Error(`Componente não instalado: ${command}`);
        const cwd = profile.cwd || os.homedir();
        if (!fs.statSync(cwd).isDirectory()) throw new Error('Pasta inicial inválida.');
        const env = { ...process.env, ...extraEnv, TERM: 'xterm-256color', COLORTERM: 'truecolor' };
        delete env.ELECTRON_RUN_AS_NODE;
        const processPty = pty.spawn(command, args, { name: 'xterm-256color', cols, rows, cwd, env, useConpty: true });
        item.write = value => processPty.write(value); item.resize = (c, r) => processPty.resize(c, r); item.kill = () => processPty.kill();
        processPty.onData(data); processPty.onExit(event => end(event.exitCode));
      } else if (profile.type === 'ssh' || profile.type === 'ssh-x11') {
        const client = await this.ssh.connect(profile); item.client = client; item.kill = () => client.end();
        if (client.legacyAlgorithms?.length) data(`\x1b[93mAviso: este equipamento só aceita criptografia antiga (${client.legacyAlgorithms.join(', ')}). A conexão funciona, mas é mais fraca; se possível, atualize o firmware ou habilite algoritmos modernos no equipamento.\x1b[0m\r\n`);
        const x11 = profile.type === 'ssh-x11' ? this.getX11() : null;
        if (x11) client.on('x11', (info, accept) => { const channel = accept(); const socket = net.createConnection({ host: '127.0.0.1', port: 6000 + x11.display }); socket.on('error', () => channel.destroy()); channel.on('error', () => socket.destroy()); socket.pipe(channel).pipe(socket); channel.on('close', () => socket.destroy()); client.once('close', () => socket.destroy()); });
        const window = { term: 'xterm-256color', cols, rows };
        if (x11) window.x11 = { single: false, protocol: 'MIT-MAGIC-COOKIE-1', cookie: x11.cookie, screen: 0 };
        const stream = await new Promise((resolve, reject) => client.shell(window, (error, stream) => error ? reject(error) : resolve(stream)));
        const decoder = new StringDecoder('utf8');
        stream.on('data', bytes => data(decoder.write(bytes))); stream.stderr.on('data', bytes => data(bytes.toString()));
        stream.on('close', () => { data(decoder.end()); end(0); client.end(); });
        client.on('error', error => data(`\r\n${error.message}\r\n`)); client.on('close', () => end(-1));
        item.write = value => stream.write(value); item.resize = (c, r) => stream.setWindow(r, c, 0, 0);
      } else if (profile.type === 'telnet') {
        const socket = net.createConnection({ host: profile.host, port: profile.port });
        const telnet = new Telnet(value => socket.write(value)); const decoder = new StringDecoder('utf8');
        item.kill = () => socket.destroy(); item.write = value => socket.write(telnet.encode(value));
        socket.setTimeout(15000, () => socket.destroy(new Error('Tempo limite Telnet.')));
        socket.on('connect', () => socket.setTimeout(0));
        socket.on('data', bytes => data(decoder.write(telnet.decode(bytes))));
        socket.on('error', error => data(`\r\n${error.message}\r\n`)); socket.on('close', () => { data(decoder.end()); end(0); });
      } else if (profile.type === 'rlogin' || profile.type === 'rsh') {
        // Rlogin (RFC 1282) e Rsh: protocolos sem criptografia; o servidor confia no usuário informado.
        const socket = net.createConnection({ host: profile.host, port: profile.port });
        const decoder = new StringDecoder('utf8'); const local = profile.username || 'stanis'; let handshake = false;
        item.kill = () => socket.destroy();
        item.write = value => socket.write(value);
        if (profile.type === 'rlogin') item.resize = (c, r) => { const b = Buffer.alloc(12); b.set([0xff, 0xff, 0x73, 0x73]); b.writeUInt16BE(r, 4); b.writeUInt16BE(c, 6); if (handshake) socket.write(b); };
        socket.setTimeout(15000, () => socket.destroy(new Error('Tempo limite.')));
        socket.on('connect', () => {
          socket.setTimeout(0);
          const parts = profile.type === 'rlogin' ? ['', local, local, 'xterm-256color/38400'] : ['', local, local, profile.command || ''];
          socket.write(Buffer.from(parts.join('\0') + '\0', 'utf8'));
        });
        socket.on('data', bytes => {
          if (!handshake) { handshake = true; if (bytes[0] !== 0) data('\r\nServidor recusou o handshake.\r\n'); bytes = bytes.subarray(1); if (profile.type === 'rlogin') item.resize(cols, rows); }
          if (bytes.length) data(decoder.write(bytes));
        });
        socket.on('error', error => data(`\r\n${error.message}\r\n`)); socket.on('close', () => { data(decoder.end()); end(0); });
      } else if (profile.type === 'serial') {
        const serial = new SerialPort({ path: profile.device, baudRate: profile.baudRate, autoOpen: false });
        await new Promise((resolve, reject) => serial.open(error => error ? reject(error) : resolve()));
        const decoder = new StringDecoder('utf8');
        item.kill = () => { if (serial.isOpen) serial.close(); }; item.write = value => serial.write(value);
        serial.on('data', bytes => data(decoder.write(bytes))); serial.on('error', error => data(`\r\n${error.message}\r\n`)); serial.on('close', () => end(0));
      } else throw new Error('Este tipo usa uma janela externa.');
      return { id, name: profile.name, profile };
    } catch (error) { item.kill?.(); this.items.delete(id); throw error; }
  }
  activate(id) {
    const item = this.get(id); item.activated = true;
    for (const data of item.pending) this.emit('terminal:data', { id, data });
    item.pending = []; if (item.ended) this.emit('terminal:exit', { id, code: item.exitCode });
  }
  get(id) { const item = this.items.get(id); if (!item) throw new Error('Sessão não encontrada.'); return item; }
  close(id) { const item = this.get(id); item.log?.end(); item.kill?.(); this.items.delete(id); }
  closeAll() { for (const id of this.items.keys()) { try { this.close(id); } catch { /* Processo já terminou. */ } } }
}
module.exports = { Sessions, localCommand };
