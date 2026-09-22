const net = require('node:net');
const crypto = require('node:crypto');
const path = require('node:path');
const { spawn, execFile, execFileSync } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);

// Servidor VNC (TightVNC em modo aplicativo, sem serviço nem administrador) preso a 127.0.0.1.
// Para acessar de outro computador use um túnel SSH remoto: nada fica exposto na rede.
const KEY = 'HKCU\\Software\\TightVNC\\Server', ROOT_KEY = 'HKCU\\Software\\TightVNC';
const FIXED = Buffer.from([23, 82, 107, 6, 35, 78, 88, 7]); // chave fixa do formato de senha do VNC
const reverseBits = byte => { let r = 0; for (let i = 0; i < 8; i++) if (byte & (1 << i)) r |= 128 >> i; return r; };
const reg = (...args) => run(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe'), args, { windowsHide: true });

// Formato de senha do VNC: até 8 caracteres, cifrados em DES com a chave fixa (bits invertidos), guardados em REG_BINARY.
function encryptPassword(password) {
  const block = Buffer.alloc(8); Buffer.from(password, 'latin1').copy(block, 0, 0, 8);
  const cipher = crypto.createCipheriv('des-ecb', Buffer.from([...FIXED].map(reverseBits)), null); cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(block), cipher.final()]);
}
const removeConfigSync = () => { try { execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe'), ['delete', ROOT_KEY, '/f'], { windowsHide: true, stdio: 'ignore' }); } catch { /* já removida */ } };
async function keyExists(key) { try { await reg('query', key); return true; } catch { return false; } }
async function isManaged() { try { const { stdout } = await reg('query', KEY, '/v', 'StanisManaged'); return /StanisManaged\s+REG_DWORD\s+0x1/i.test(stdout); } catch { return false; } }
async function processRunning(exe) {
  try { const { stdout } = await run(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tasklist.exe'), ['/FI', `IMAGENAME eq ${path.basename(exe)}`, '/FO', 'CSV', '/NH'], { windowsHide: true }); return stdout.toLowerCase().includes(path.basename(exe).toLowerCase()); }
  catch { return false; }
}
// Remove a configuração deixada por uma execução anterior deste app que terminou sem limpar (só se for nossa e não houver servidor ativo).
async function cleanupStale(exe) { if (await keyExists(ROOT_KEY) && await isManaged() && !await processRunning(exe)) await reg('delete', ROOT_KEY, '/f'); }
const listening = (port, timeout = 12000) => new Promise((resolve, reject) => {
  const deadline = Date.now() + timeout;
  const attempt = () => {
    const socket = net.createConnection({ host: '127.0.0.1', port }); socket.setTimeout(1000);
    socket.once('connect', () => { socket.destroy(); resolve(); });
    const retry = () => { socket.destroy(); if (Date.now() > deadline) reject(new Error('O servidor VNC não respondeu a tempo.')); else setTimeout(attempt, 250); };
    socket.once('error', retry); socket.once('timeout', retry);
  };
  attempt();
});

async function startVnc({ exe, port = 5900, password = '' }) {
  if (process.platform !== 'win32') throw new Error('Servidor VNC disponível somente no Windows.');
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Use uma porta entre 1024 e 65535.');
  if (typeof password !== 'string' || password.length > 8 || /[^\x20-\x7e]/.test(password)) throw new Error('A senha VNC aceita até 8 caracteres ASCII.');
  if (await processRunning(exe)) throw new Error('Já existe um servidor TightVNC em execução nesta conta. Feche-o antes.');
  await cleanupStale(exe);
  if (await keyExists(ROOT_KEY)) throw new Error('Existe uma configuração própria do TightVNC nesta conta (HKCU\\Software\\TightVNC). Não vou alterá-la; remova-a ou use outra conta.');
  const values = { StanisManaged: 1, AcceptRfbConnections: 1, RfbPort: port, LoopbackOnly: 1, AllowLoopback: 1, UseVncAuthentication: password ? 1 : 0, AcceptHttpConnections: 0, UseControlAuthentication: 0, RunControlInterface: 0, AlwaysShared: 1, RemoveWallpaper: 0 };
  let child = null;
  const cleanup = () => { try { child?.kill(); } catch { /* já terminou */ } removeConfigSync(); };
  try {
    await reg('add', KEY, '/f');
    for (const [name, value] of Object.entries(values)) await reg('add', KEY, '/v', name, '/t', 'REG_DWORD', '/d', String(value), '/f');
    if (password) await reg('add', KEY, '/v', 'Password', '/t', 'REG_BINARY', '/d', encryptPassword(password).toString('hex'), '/f');
    child = spawn(exe, ['-run'], { windowsHide: true, stdio: 'ignore' });
    const exited = new Promise((_, reject) => child.once('exit', code => reject(new Error(`O servidor VNC encerrou (código ${code}).`))));
    exited.catch(() => {}); // evita rejeição sem tratamento quando o servidor encerrar depois de iniciar
    await Promise.race([listening(port), exited]);
  } catch (error) { cleanup(); throw error; }
  child.on('exit', removeConfigSync);
  return { port, authenticated: !!password, close: cleanup };
}
module.exports = { startVnc, cleanupStale, encryptPassword };
