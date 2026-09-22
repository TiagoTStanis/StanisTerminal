const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');

// Pacotes Unix (pacman do MSYS2) instalados dentro da pasta do app. Só argumentos validados, sem shell.
// O pacman consulta os espelhos oficiais do MSYS2; nada do seu computador é enviado além do nome do pacote pedido.
const NAME = /^[A-Za-z0-9][A-Za-z0-9@._+-]{0,99}$/;
const REPO = 'msys'; // o shell do app é o ambiente MSYS; pacotes mingw* pertencem a outros ambientes

// Saída de `pacman -Ss`: "repo/nome versão [(grupo)] [[installed]]" seguida da descrição indentada.
function parseSearch(text) {
  const rows = []; const lines = text.replace(/\r/g, '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\S+?)\/(\S+)\s+(\S+)(?:\s+\(([^)]*)\))?(?:\s+\[(installed[^\]]*)\])?\s*$/);
    if (!m || m[1] !== REPO) continue;
    rows.push({ name: m[2], id: m[2], version: m[3], source: 'msys2', installed: !!m[5], description: (lines[i + 1] || '').trim(), actionable: NAME.test(m[2]) });
  }
  return rows;
}
// `pacman -Q`: "nome versão". `pacman -Qu`: "nome antiga -> nova".
function parseInstalled(text) {
  return text.replace(/\r/g, '').split('\n').map(l => l.trim().split(/\s+/)).filter(p => p.length === 2).map(([name, version]) => ({ name, id: name, version, source: 'msys2', actionable: NAME.test(name) }));
}
function parseUpgrades(text) {
  return text.replace(/\r/g, '').split('\n').map(l => l.trim().match(/^(\S+)\s+(\S+)\s+->\s+(\S+)$/)).filter(Boolean).map(m => ({ name: m[1], id: m[1], version: m[2], available: m[3], source: 'msys2', actionable: NAME.test(m[1]) }));
}
const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

class MsysPackages {
  constructor(emit, getRoot, { spawnFn = spawn, execFn = execFile } = {}) { this.emit = emit; this.getRoot = getRoot; this.spawn = spawnFn; this.exec = execFn; this.current = null; }
  paths() {
    const root = this.getRoot(); if (!root || !fs.existsSync(root)) throw new Error('O ambiente Unix (MSYS2) ainda não está instalado. Use “Instalar ambiente Unix”.');
    const usr = path.join(root, 'usr', 'bin'); return { root, pacman: path.join(usr, 'pacman.exe'), env: { ...process.env, MSYSTEM: 'MSYS', LANG: 'C.UTF-8', PATH: usr + ';' + process.env.PATH } };
  }
  run(args, timeout = 300000) {
    const { pacman, root, env } = this.paths();
    return new Promise((resolve, reject) => {
      this.exec(pacman, args, { env, cwd: root, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error && !stdout) return reject(new Error(`O pacman falhou: ${(stderr || error.message).trim().split('\n').slice(-2).join(' ')}`));
        resolve(stdout);
      });
    });
  }
  synced() { const { root } = this.paths(); return fs.existsSync(path.join(root, 'var', 'lib', 'pacman', 'sync', 'msys.db')); }
  async sync() { await this.run(['-Sy', '--noconfirm']); }
  async search(query) {
    if (typeof query !== 'string' || !query.trim() || query.length > 100 || query.trim().startsWith('-') || /[\x00-\x1f]/.test(query)) throw new Error('Digite uma busca válida (até 100 caracteres, sem começar por “-”).');
    if (!this.synced()) await this.sync();
    return parseSearch(await this.run(['-Ss', escapeRegex(query.trim())])).slice(0, 60);
  }
  async installed() { return parseInstalled(await this.run(['-Q'])); }
  async upgrades() { await this.sync(); return parseUpgrades(await this.run(['-Qu'])); }
  // install | uninstall | upgrade (um pacote) | upgrade-all (pacman -Syu)
  operate(action, id) {
    if (!['install', 'uninstall', 'upgrade', 'upgrade-all'].includes(action)) throw new Error('Ação inválida.');
    if (action !== 'upgrade-all' && (typeof id !== 'string' || !NAME.test(id))) throw new Error('Identificador de pacote inválido.');
    if (this.current) throw new Error('Já existe uma operação em andamento. Aguarde ou cancele.');
    const { pacman, root, env } = this.paths();
    const args = { install: ['-S', '--needed', '--noconfirm', id], uninstall: ['-Rns', '--noconfirm', id], upgrade: ['-S', '--noconfirm', id], 'upgrade-all': ['-Syu', '--noconfirm'] }[action];
    return new Promise(resolve => {
      const child = this.spawn(pacman, args, { env, cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      const label = action === 'upgrade-all' ? 'sistema' : id; this.current = { child, id: label, action }; let tail = '';
      const forward = chunk => { const text = chunk.toString('utf8').replace(/\r/g, '\n'); tail = (tail + text).slice(-4000); for (const line of text.split('\n')) if (line.trim() && !/#{4,}|^\s*[-=]{3,}/.test(line)) this.emit('packages:log', { id: label, action, line: line.trim().slice(0, 300) }); };
      child.stdout?.on('data', forward); child.stderr?.on('data', forward);
      const finish = result => { if (this.current?.child === child) this.current = null; resolve({ id: label, action, ...result, log: tail.trim().split('\n').slice(-6).join('\n') }); };
      child.once('error', error => finish({ ok: false, code: null, message: error.message }));
      child.once('close', (code, signal) => finish({ ok: code === 0, code, message: signal ? 'Cancelado.' : code === 0 ? 'Concluído.' : `O pacman terminou com o código ${code}.` }));
    });
  }
  cancel() { this.current?.child.kill(); }
  closeAll() { this.cancel(); }
}
module.exports = { MsysPackages, parseSearch, parseInstalled, parseUpgrades, NAME };
