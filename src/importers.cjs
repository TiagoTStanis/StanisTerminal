const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);

// Leitura de sessões do PuTTY (registro do Windows) e do ~/.ssh/config. Somente leitura; nunca lê senhas
// (o PuTTY não guarda senha em texto puro no registro) nem escreve nada nesses locais.
async function importPutty() {
  if (process.platform !== 'win32') return [];
  const reg = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe');
  let stdout; try { ({ stdout } = await run(reg, ['query', 'HKCU\\Software\\SimonTatham\\PuTTY\\Sessions'], { windowsHide: true })); }
  catch { return []; }
  const names = [...stdout.matchAll(/HKEY_CURRENT_USER\\Software\\SimonTatham\\PuTTY\\Sessions\\(.+)/g)].map(m => m[1].trim());
  const sessions = [];
  for (const name of names) {
    let out; try { ({ stdout: out } = await run(reg, ['query', `HKCU\\Software\\SimonTatham\\PuTTY\\Sessions\\${name}`], { windowsHide: true })); } catch { continue; }
    const value = key => out.match(new RegExp(String.raw`^\s*${key}\s+REG_\w+\s+(.*)$`, 'm'))?.[1].trim();
    const host = value('HostName'); if (!host) continue;
    const port = Number(value('PortNumber')) || 22; const username = value('UserName') || '';
    const keyFile = value('PublicKeyFile') || '';
    sessions.push({ name: decodeURIComponent(name.replace(/%(\d{2})/g, '%$1')), group: 'Importado do PuTTY', type: 'ssh', host, port, username, keyPath: keyFile });
  }
  return sessions;
}
// `~/.ssh/config`: entende Host, HostName, User, Port, IdentityFile e ProxyJump (só se o alvo também estiver no arquivo).
function parseSshConfig(text) {
  const blocks = []; let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
    const m = line.match(/^(\S+)\s+(.*)$/); if (!m) continue;
    const [, key, value] = m; const k = key.toLowerCase();
    if (k === 'host') { for (const alias of value.split(/\s+/)) if (!alias.includes('*') && !alias.includes('?')) { current = { name: alias, host: alias }; blocks.push(current); } else current = null; continue; }
    if (!current) continue;
    if (k === 'hostname') current.host = value.replace(/^"|"$/g, '');
    else if (k === 'user') current.username = value;
    else if (k === 'port') current.port = Number(value) || 22;
    else if (k === 'identityfile') current.keyPath = value.replace(/^~[/\\]/, os.homedir() + path.sep).replace(/^"|"$/g, '');
    else if (k === 'proxyjump') current.jumpName = value.split(',')[0];
  }
  return blocks;
}
async function importSshConfig(file = path.join(os.homedir(), '.ssh', 'config')) {
  let text; try { text = await fs.promises.readFile(file, 'utf8'); } catch { return []; }
  if (text.length > 2 * 1024 * 1024) throw new Error('Arquivo ~/.ssh/config maior que o esperado.');
  const blocks = parseSshConfig(text); const byName = new Map(blocks.map(b => [b.name, b]));
  return blocks.map(b => ({ name: b.name, group: 'Importado do SSH config', type: 'ssh', host: b.host, port: b.port || 22, username: b.username || '', keyPath: b.keyPath || '', jumpName: b.jumpName && byName.has(b.jumpName) ? b.jumpName : '' }));
}
module.exports = { importPutty, importSshConfig, parseSshConfig };
