const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { sftpCall } = require('./ssh.cjs');

const MAX_ITEMS = 20000;
// Espelho contínuo local → servidor por SFTP. Só envia arquivos novos ou alterados; NUNCA apaga nada no servidor
// nem sobrescreve um arquivo remoto mais novo que o local. Tudo passa pela sua sessão SSH: nada vai a terceiros.
class Mirror {
  constructor(files, emit) { this.files = files; this.emit = emit; }
  async start({ session, local, remote, interval = 5000 }) {
    const root = await fsp.realpath(local); if (!(await fsp.stat(root)).isDirectory()) throw new Error('Escolha uma pasta local.');
    const sftp = await this.files.remote(session);
    const id = randomUUID(); const seen = new Map(); const state = { stopped: false, running: false, timer: null, watcher: null, sent: 0 };
    const mkdirp = async dir => {
      const parts = dir.split('/').filter(Boolean); let current = dir.startsWith('/') ? '' : '.';
      for (const part of parts) { current = current === '.' ? part : current + '/' + part; try { await sftpCall(sftp, 'mkdir', current); } catch { const info = await sftpCall(sftp, 'stat', current).catch(() => null); if (!info?.isDirectory()) throw new Error(`Não foi possível criar ${current}`); } }
    };
    const walk = async (dir, rel, out) => {
      for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue; if (out.length > MAX_ITEMS) throw new Error(`Pasta com mais de ${MAX_ITEMS} itens.`);
        const relative = rel ? rel + '/' + entry.name : entry.name;
        if (entry.isDirectory()) await walk(path.join(dir, entry.name), relative, out); else out.push({ local: path.join(dir, entry.name), rel: relative });
      }
    };
    const pass = async () => {
      if (state.stopped || state.running) return; state.running = true;
      try {
        const items = []; await walk(root, '', items); await mkdirp(remote);
        for (const item of items) {
          if (state.stopped) return;
          const info = await fsp.stat(item.local).catch(() => null); if (!info) continue; const key = `${info.size}:${info.mtimeMs}`;
          if (seen.get(item.rel) === key) continue;
          const target = path.posix.join(remote, item.rel);
          const remoteInfo = await sftpCall(sftp, 'stat', target).catch(() => null);
          if (remoteInfo && !seen.has(item.rel) && remoteInfo.size === info.size && remoteInfo.mtime * 1000 >= Math.floor(info.mtimeMs / 1000) * 1000) { seen.set(item.rel, key); continue; }
          if (remoteInfo && remoteInfo.mtime * 1000 > info.mtimeMs + 2000 && !seen.has(item.rel)) { this.emit('notice', `Espelho: ${item.rel} é mais novo no servidor; não foi sobrescrito.`); seen.set(item.rel, key); continue; }
          await mkdirp(path.posix.dirname(target)); await sftpCall(sftp, 'fastPut', item.local, target); seen.set(item.rel, key); state.sent++;
        }
      } catch (error) { this.emit('notice', `Espelho: ${error.message}`); }
      finally { state.running = false; }
    };
    state.timer = setInterval(pass, interval);
    try { state.watcher = fs.watch(root, { recursive: true }, () => { clearTimeout(state.debounce); state.debounce = setTimeout(pass, 800); }); state.watcher.on('error', () => {}); } catch { /* sem watch: fica só o intervalo */ }
    await pass();
    return { id, sent: () => state.sent, stop: () => { state.stopped = true; clearInterval(state.timer); clearTimeout(state.debounce); state.watcher?.close(); } };
  }
}
module.exports = { Mirror };
