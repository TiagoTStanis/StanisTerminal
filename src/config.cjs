const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const TYPES = ['local', 'ssh', 'telnet', 'serial', 'rdp', 'vnc', 'ssh-x11', 'x11', 'xdmcp', 'rlogin', 'rsh'];
function text(value, max = 256) {
  if (typeof value !== 'string' || value.length > max || /[\x00-\x08\x0b-\x1f]/.test(value)) throw new Error('Texto inválido.');
  return value.trim();
}
// Pasta de sessões: caminho com "/" (ex.: Clientes/Acme). Até 6 níveis, nomes de até 60 caracteres, sem vazios.
function groupPath(value) {
  const parts = text(typeof value === 'string' && value.trim() ? value : 'Minhas sessões', 1024).split(/[\\/]/).map(s => s.trim()).filter(Boolean);
  if (!parts.length || parts.length > 6 || parts.some(s => s.length > 60 || s === '.' || s === '..')) throw new Error('Pasta inválida: use até 6 níveis separados por “/”, nomes de até 60 caracteres.');
  return parts.join('/');
}
function host(value) {
  value = text(value);
  if (!require('node:net').isIP(value) && !/^[a-zA-Z0-9][a-zA-Z0-9.:%_-]*$/.test(value)) throw new Error('Host inválido. Use nome DNS ou IP, sem opções de comando.');
  return value;
}
function port(value, fallback = 22) {
  const result = Number(value === '' || value === undefined || value === null ? fallback : value);
  if (!Number.isInteger(result) || result < 1 || result > 65535) throw new Error('Porta deve estar entre 1 e 65535.');
  return result;
}
// Resoluções fixas aceitas no RDP; sem valor = acompanha o tamanho do painel.
const RDP_RESOLUTIONS = ['1024x768', '1280x720', '1280x800', '1366x768', '1440x900', '1600x900', '1920x1080'];
function profile(input) {
  if (!input || !TYPES.includes(input.type)) throw new Error('Tipo de sessão inválido.');
  const p = { id: /^[a-zA-Z0-9-]{1,80}$/.test(input.id || '') ? input.id : randomUUID(), name: text(input.name || 'Sessão'), group: groupPath(input.group), type: input.type };
  if (p.type === 'x11') return p;
  if (p.type === 'local') {
    if (!['powershell', 'cmd', 'bash', 'wsl', 'busybox', 'msys2'].includes(input.shell)) throw new Error('Shell inválido.');
    p.shell = input.shell; p.cwd = text(input.cwd || '', 2048);
  } else if (p.type === 'serial') {
    if (!/^COM\d+$/i.test(input.device || '')) throw new Error('Use uma porta COM válida.');
    p.device = input.device.toUpperCase(); p.baudRate = Number(input.baudRate || 115200);
    if (!Number.isInteger(p.baudRate) || p.baudRate < 50 || p.baudRate > 4000000) throw new Error('Baud rate inválido.');
  } else {
    p.host = host(input.host); p.port = port(input.port, p.type === 'rdp' ? 3389 : p.type === 'vnc' ? 5900 : p.type === 'telnet' ? 23 : p.type === 'rlogin' ? 513 : p.type === 'rsh' ? 514 : 22);
    p.username = text(input.username || '', 128);
    if (p.username && !/^[a-zA-Z0-9_.@\\-]+$/.test(p.username)) throw new Error('Usuário inválido.');
    if (p.type === 'rsh') p.command = text(input.command || '', 4096);
    p.keyPath = text(input.keyPath || '', 2048); p.useAgent = !!input.useAgent; p.agentForward = !!input.useAgent && !!input.agentForward;
    p.jumpId = text(input.jumpId || '', 80); if (input.proxyHost) { if (p.jumpId) throw new Error('Use gateway SSH ou proxy SOCKS5, não os dois.'); p.proxyHost = host(input.proxyHost); p.proxyPort = port(input.proxyPort, 1080); }
    if (p.type === 'vnc' && ['windows', 'linux'].includes(input.remoteOS)) p.remoteOS = input.remoteOS;
    if (p.type === 'rdp' && RDP_RESOLUTIONS.includes(input.resolution)) p.resolution = input.resolution;
    // RemoteApp: abre só o programa (canal RAIL) em vez da área de trabalho; program vem do .rdp (ex.: ||calc).
    const app = input.remoteApp;
    if (p.type === 'rdp' && app && typeof app.program === 'string' && app.program.trim()) {
      const line = (value, max) => { const v = text(value || '', max); if (/[\r\n]/.test(v)) throw new Error('RemoteApp inválido.'); return v; };
      p.remoteApp = { program: line(app.program.trim(), 1024), name: line(app.name, 200), args: line(app.args, 2048), workdir: line(app.workdir, 1024) };
    }
    // loadbalanceinfo do .rdp, enviado no X.224 como routing token: ASCII imprimível, até 238 caracteres.
    const lb = typeof input.loadBalanceInfo === 'string' ? input.loadBalanceInfo.trim() : '';
    if (p.type === 'rdp' && lb) {
      if (lb.length > 238 || !/^[\x20-\x7e]+$/.test(lb)) throw new Error('Load balance info inválido (use só caracteres ASCII, até 238).');
      p.loadBalanceInfo = lb;
    }
  }
  return p;
}
function readJSON(filename, fallback) {
  try { return JSON.parse(fs.readFileSync(filename, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw new Error(`Não foi possível ler ${filename}: ${error.message}`); }
}
function writeJSON(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const temp = filename + '.' + randomUUID() + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temp, filename);
}
class Config {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, 'config.json');
    this.value = readJSON(this.file, { version: 1, profiles: [], snippets: [], folders: [], macros: [], scripts: [], packageLists: [], tools: {}, settings: { fontSize: 14, theme: 'light', scrollback: 10000, restoreSessions: false, highlightErrors: true } });
    this.value.profiles = (this.value.profiles || []).map(profile);
  }
  save() { writeJSON(this.file, this.value); }
  putProfile(value) {
    const p = profile(value);
    this.value.profiles = this.value.profiles.filter(x => x.id !== p.id).concat(p);
    this.save(); return p;
  }
}
module.exports = { Config, TYPES, profile, groupPath, text, host, port, readJSON, writeJSON };
