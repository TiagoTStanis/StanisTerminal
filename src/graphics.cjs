const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { randomUUID, randomBytes } = require('node:crypto');
const readline = require('node:readline');
class Graphics {
  constructor(window, emit, ask, packaged, vault, isSaved = () => false) { this.window = window; this.emit = emit; this.ask = ask; this.packaged = packaged; this.vault = vault; this.isSaved = isSaved; this.items = new Map(); }
  async open(profile) {
    const id = randomUUID();
    if (['x11', 'xdmcp'].includes(profile.type)) return this.openX11(id, profile);
    if (profile.type === 'vnc') {
      const socket = net.createConnection({ host: profile.host, port: profile.port }); socket.pause();
      const item = { socket, profile }; this.items.set(id, item);
      socket.on('data', data => this.emit('graphics:data', { id, data: data.toString('base64') }));
      socket.on('error', error => this.emit('graphics:state', { id, type: 'error', message: error.message }));
      socket.on('close', () => this.emit('graphics:state', { id, type: 'close' }));
      try { await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); socket.setTimeout(15000, () => socket.destroy(new Error('Tempo limite VNC.'))); }); }
      catch (error) { this.close(id); throw error; }
      socket.setTimeout(0); return { id, profile, name: profile.name };
    }
    // Com senha guardada, conecta direto. Sem ela, pergunta uma vez e oferece lembrar (só para perfis salvos).
    let password = this.vault?.get(profile);
    if (password === null || password === undefined) {
      const canRemember = !!this.vault?.available() && this.isSaved(profile.id);
      const credentials = await this.ask({ title: `${profile.username ? profile.username + ' @ ' : ''}${profile.host}`, fields: [{ name: 'password', label: 'Senha', type: 'password' }], remember: canRemember });
      if (!credentials) throw new Error('Conexão cancelada.');
      password = credentials.password || '';
      if (canRemember && credentials.remember) this.vault.set(profile, password);
    }
    const executable = this.packaged ? path.join(process.resourcesPath, 'native', 'RdpHost.exe') : path.join(__dirname, 'native', 'RdpHost.exe');
    if (!fs.existsSync(executable)) throw new Error('Compile o componente nativo: pnpm prepare:app.');
    const hwnd = this.window.getNativeWindowHandle().readBigUInt64LE().toString();
    const child = spawn(executable, [hwnd], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const item = { child, profile }; this.items.set(id, item);
    const ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Controle RDP não respondeu.')), 15000);
      child.on('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Controle RDP foi encerrado.')); });
      readline.createInterface({ input: child.stdout }).on('line', line => {
        try {
          const event = JSON.parse(line);
          if (event.type === 'ready') { clearTimeout(timer); resolve(); }
          if (event.type === 'error') { clearTimeout(timer); reject(new Error(event.message)); }
          this.emit('graphics:state', { id, ...event });
        } catch { /* Saída não estruturada do componente nativo. */ }
      });
    });
    child.stdin.on('error', () => {});
    child.on('exit', () => this.emit('graphics:state', { id, type: 'close' }));
    try { await ready; child.stdin.write(JSON.stringify({ cmd: 'connect', host: profile.host, port: profile.port, username: profile.username, password }) + '\n'); }
    catch (error) { this.close(id); throw error; }
    return { id, name: profile.name, profile };
  }
  async openX11(id, profile) {
    if ([...this.items.values()].some(x => x.xserver)) throw new Error('Já existe um servidor X11 ativo. Feche a aba X11 antes de iniciar outro.');
    const root = this.packaged ? path.join(process.resourcesPath, 'vcxsrv') : path.join(__dirname, '..', 'vendor', 'vcxsrv');
    const executable = path.join(root, 'vcxsrv.exe');
    if (!fs.existsSync(executable)) throw new Error('Componente VcXsrv não incluído na distribuição.');
    let display = 30;
    for (; display < 60; display++) {
      const free = await new Promise(resolve => { const check = net.createServer(); check.once('error', () => resolve(false)); check.listen(6000 + display, '127.0.0.1', () => check.close(() => resolve(true))); });
      if (free) break;
    }
    if (display === 60) throw new Error('Nenhuma porta X11 livre entre 6030 e 6059.');
    const cookie = randomBytes(16).toString('hex');
    const authFile = path.join(require('electron').app.getPath('userData'), 'Xauthority-' + id);
    const field = value => { const data = Buffer.isBuffer(value) ? value : Buffer.from(value); const size = Buffer.alloc(2); size.writeUInt16BE(data.length); return Buffer.concat([size, data]); };
    fs.mkdirSync(path.dirname(authFile), { recursive: true });
    fs.writeFileSync(authFile, Buffer.concat([Buffer.from([255, 255]), field(''), field(String(display)), field('MIT-MAGIC-COOKIE-1'), field(Buffer.from(cookie, 'hex'))]), { mode: 0o600 });
    const args = [':' + display, '-screen', '0', '1280x800', '-nodecoration', '-noreset', '-listen', 'tcp', '-auth', authFile, '-logfile', path.join(require('electron').app.getPath('userData'), 'x11.log')];
    if (profile.type === 'xdmcp') args.push('-query', profile.host);
    const xserver = spawn(executable, args, { cwd: root, windowsHide: true, stdio: 'ignore' });
    const xError = new Promise((_, reject) => { xserver.once('error', reject); xserver.once('exit', code => reject(new Error('Servidor X11 encerrou com código ' + code))); });
    const embed = this.packaged ? path.join(process.resourcesPath, 'native', 'EmbedHost.exe') : path.join(__dirname, 'native', 'EmbedHost.exe');
    const child = spawn(embed, [this.window.getNativeWindowHandle().readBigUInt64LE().toString(), String(xserver.pid)], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.items.set(id, { profile, child, xserver, authFile, display, cookie });
    child.stdin.on('error', () => {}); xserver.on('exit', () => this.emit('graphics:state', { id, type: 'close' }));
    try {
      await Promise.race([xError, new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Servidor X11 não inicializou. Consulte x11.log.')), 20000);
        child.once('error', error => { clearTimeout(timer); reject(error); });
        readline.createInterface({ input: child.stdout }).on('line', line => { try { const event = JSON.parse(line); clearTimeout(timer); if (event.type === 'ready') resolve(); else reject(new Error(event.message)); } catch (error) { reject(error); } });
      })]);
    } catch (error) { this.close(id); throw error; }
    return { id, name: profile.name, profile };
  }
  getX11() { const item = [...this.items.values()].find(x => x.xserver && x.profile.type === 'x11'); if (!item) throw new Error('Abra o servidor X11 na mesma janela primeiro.'); return { display: item.display, cookie: item.cookie }; }
  activate(id) { this.items.get(id)?.socket?.resume(); }
  write(id, data) { this.items.get(id)?.socket?.write(Buffer.from(data, 'base64')); }
  bounds(id, bounds) {
    const item = this.items.get(id);
    if (!item?.child || item.child.killed) return;
    const scale = this.window.webContents.getZoomFactor() * require('electron').screen.getDisplayMatching(this.window.getBounds()).scaleFactor;
    const value = { cmd: 'bounds', visible: !!bounds.visible };
    for (const field of ['x', 'y', 'width', 'height']) value[field] = Math.round(Math.max(0, Math.min(20000, Number(bounds[field]) || 0)) * scale);
    item.child.stdin.write(JSON.stringify(value) + '\n');
  }
  close(id) { const item = this.items.get(id); item?.socket?.destroy(); item?.xserver?.kill(); if (item?.authFile) { try { fs.unlinkSync(item.authFile); } catch {} } if (item?.child) { item.child.stdin.end(); setTimeout(() => { if (item.child.exitCode === null) item.child.kill(); }, 1000).unref(); } this.items.delete(id); }
  closeAll() { for (const id of this.items.keys()) this.close(id); }
}
module.exports = { Graphics };
