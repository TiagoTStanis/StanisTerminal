const { app, BrowserWindow, ipcMain, dialog, safeStorage, clipboard, protocol, net: electronNet, session, Menu } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { Config, profile, groupPath, text, readJSON, writeJSON } = require('./config.cjs');
const { SSH } = require('./ssh.cjs');
const { Sessions } = require('./sessions.cjs');
const { Files } = require('./files.cjs');
const { Network, inside } = require('./network.cjs');
const { Graphics } = require('./graphics.cjs');
const { Transfers } = require('./transfers.cjs');
const { Mirror } = require('./mirror.cjs');
const { Tools } = require('./tools.cjs');
const { Vault } = require('./vault.cjs');
const { Packages, ID: PACKAGE_ID } = require('./packages.cjs');
const { startVnc, cleanupStale } = require('./vncserver.cjs');
const { SerialPort } = require('serialport');

protocol.registerSchemesAsPrivileged([{ scheme: 'stanis', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
const testMode = process.argv.includes('--test-mode');
if (testMode) app.setPath('userData', path.join(os.tmpdir(), 'stanis-terminal-test-' + process.pid));
else if (process.env.PORTABLE_EXECUTABLE_DIR) app.setPath('userData', path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'StanisTerminal-data'));
else if (app.isPackaged) app.setPath('userData', path.join(path.dirname(app.getPath('exe')), 'StanisTerminal-data'));
if (!testMode && !app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
let window, config, terminals, files, network, graphics, transfers, tools, vault, packages;
const questions = new Map();
const emit = (channel, value) => { if (window && !window.isDestroyed()) window.webContents.send(channel, value); };
function ask(question) {
  return new Promise(resolve => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => { questions.delete(id); resolve(null); }, 180000);
    questions.set(id, { resolve, timer }); emit('question', { id, ...question });
  });
}
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || !event.senderFrame.url.startsWith('stanis://app/')) throw new Error('Origem IPC recusada.');
    return fn(...args);
  });
}
function register() {
  handle('init', () => ({ config: config.value, home: os.homedir(), dataPath: config.directory, version: app.getVersion(), testMode }));
  handle('answer', (id, answer) => { const item = questions.get(id); if (item) { clearTimeout(item.timer); questions.delete(id); item.resolve(answer); } });
  handle('profile:save', value => {
    const saved = config.putProfile(value);
    if (typeof value.password === 'string' && value.password && ['rdp', 'ssh', 'ssh-x11'].includes(saved.type)) vault.set(saved, value.password);
    return { ...saved, hasPassword: vault.has(saved) };
  });
  const inTree = (group, root) => group === root || group.startsWith(root + '/');
  const withPrefix = (group, from, to) => inTree(group, from) ? to + group.slice(from.length) : group;
  const parentOf = path => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : 'Minhas sessões';
  const folderSet = () => new Set(config.value.folders || []);
  handle('folder:create', path => {
    const clean = groupPath(path); const folders = folderSet(); folders.add(clean); if (folders.size > 300) throw new Error('Limite de 300 pastas.');
    config.value.folders = [...folders]; config.save(); return config.value;
  });
  handle('folder:rename', (from, to) => {
    const source = groupPath(from), target = groupPath(to); if (source === target) return config.value;
    if (inTree(target, source)) throw new Error('Uma pasta não pode ser movida para dentro dela mesma.');
    config.value.profiles = config.value.profiles.map(p => ({ ...p, group: withPrefix(p.group, source, target) }));
    config.value.folders = [...new Set([...(config.value.folders || []).map(f => withPrefix(f, source, target)), target])];
    config.save(); return config.value;
  });
  handle('folder:delete', path => {
    const root = groupPath(path); const parent = parentOf(root);
    config.value.profiles = config.value.profiles.map(p => inTree(p.group, root) ? { ...p, group: parent } : p);
    config.value.folders = (config.value.folders || []).filter(f => !inTree(f, root)); config.save(); return config.value;
  });
  handle('profile:move', (id, group) => {
    const p = config.value.profiles.find(x => x.id === text(id, 80)); if (!p) throw new Error('Sessão não encontrada.');
    p.group = groupPath(group); config.value.folders = [...new Set([...(config.value.folders || []), p.group])]; config.save(); return config.value;
  });
  handle('folder:export', async path => {
    const root = groupPath(path); const profiles = config.value.profiles.filter(p => inTree(p.group, root));
    const result = await dialog.showSaveDialog(window, { defaultPath: `${root.replace(/[^\w.-]+/g, '_')}.stanis-sessoes.json`, filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (result.canceled) return 0; writeJSON(result.filePath, { version: 1, profiles, folders: (config.value.folders || []).filter(f => inTree(f, root)), snippets: [] }); return profiles.length;
  });
  handle('profile:secrets', () => Object.fromEntries(config.value.profiles.map(p => [p.id, vault.has(p)])));
  handle('profile:forget', id => { vault.forget(text(id, 80)); });
  handle('profile:delete', id => {
    config.value.profiles = config.value.profiles.filter(p => p.id !== id); config.save();
    const filename = path.join(config.directory, 'credentials.json');
    const secrets = readJSON(filename, {}); delete secrets[id]; writeJSON(filename, secrets);
  });
  handle('config:export', async () => {
    const result = await dialog.showSaveDialog(window, { defaultPath: 'stanis-sessoes.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!result.canceled) writeJSON(result.filePath, config.value);
    return !result.canceled;
  });
  handle('config:import', async () => {
    const result = await dialog.showOpenDialog(window, { filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] });
    if (result.canceled) return null;
    if ((await fsp.stat(result.filePaths[0])).size > 2 * 1024 * 1024) throw new Error('Arquivo de configuração muito grande.');
    const imported = readJSON(result.filePaths[0], {});
    if (!Array.isArray(imported.profiles) || imported.profiles.length > 1000) throw new Error('Configuração inválida.');
    const profiles = imported.profiles.map(profile);
    for (const item of profiles) config.putProfile(item);
    if (Array.isArray(imported.folders)) config.value.folders = [...new Set([...(config.value.folders || []), ...imported.folders.slice(0, 300).map(groupPath)])].slice(0, 300);
    for (const item of profiles) config.value.folders = [...new Set([...(config.value.folders || []), item.group])];
    config.save();
    return config.value;
  });
  const THEMES = ['dark', 'light', 'dracula', 'nord', 'solarized', 'monokai'];
  handle('settings:save', value => {
    const previous = config.value.settings || {};
    config.value.settings = { fontSize: Math.max(10, Math.min(28, Number(value.fontSize) || 14)), theme: THEMES.includes(value.theme) ? value.theme : 'light', scrollback: Math.max(1000, Math.min(100000, Number(value.scrollback) || 10000)),
      syncFolder: value.syncFolder === undefined ? previous.syncFolder || '' : text(value.syncFolder || '', 2048), autocomplete: value.autocomplete === undefined ? previous.autocomplete !== false : !!value.autocomplete };
    config.save(); return config.value.settings;
  });
  handle('macros:save', values => {
    if (!Array.isArray(values) || values.length > 100) throw new Error('Limite de 100 macros.');
    config.value.macros = values.map(v => {
      if (!Array.isArray(v.steps) || v.steps.length > 500) throw new Error('Macro inválida.');
      return { name: text(v.name), steps: v.steps.map(x => ({ text: text(x.text, 20000), delay: Math.max(0, Math.min(10000, Number(x.delay) || 0)) })) };
    });
    config.save(); return config.value.macros;
  });
  handle('scripts:save', values => {
    if (!Array.isArray(values) || values.length > 100) throw new Error('Limite de 100 scripts.');
    config.value.scripts = values.map(v => ({ name: text(v.name), code: text(v.code, 100000) })); config.save(); return config.value.scripts;
  });
  handle('history:load', () => readJSON(path.join(config.directory, 'history.json'), []));
  handle('history:save', values => {
    if (!Array.isArray(values)) throw new Error('Histórico inválido.');
    const clean = [...new Set(values.filter(v => typeof v === 'string' && v.length < 2000 && !/[\x00-\x1f]/.test(v)))].slice(-2000);
    writeJSON(path.join(config.directory, 'history.json'), clean); return clean;
  });
  // Sincronização por pasta: aponte para OneDrive, Dropbox, Syncthing ou um repositório Git local. Nunca inclui senhas.
  handle('sync:push', () => {
    const folder = config.value.settings.syncFolder; if (!folder) throw new Error('Defina a pasta de sincronização em Preferências.');
    fs.mkdirSync(folder, { recursive: true });
    writeJSON(path.join(folder, 'stanis-sync.json'), { version: 1, savedAt: new Date().toISOString(), profiles: config.value.profiles, snippets: config.value.snippets || [], macros: config.value.macros || [], history: readJSON(path.join(config.directory, 'history.json'), []) });
    return path.join(folder, 'stanis-sync.json');
  });
  handle('sync:pull', () => {
    const folder = config.value.settings.syncFolder; if (!folder) throw new Error('Defina a pasta de sincronização em Preferências.');
    const file = path.join(folder, 'stanis-sync.json'); if (!fs.existsSync(file)) throw new Error('Nenhum arquivo de sincronização nessa pasta.');
    if (fs.statSync(file).size > 8 * 1024 * 1024) throw new Error('Arquivo de sincronização muito grande.');
    const data = readJSON(file, {}); if (!Array.isArray(data.profiles) || data.profiles.length > 1000) throw new Error('Arquivo de sincronização inválido.');
    for (const item of data.profiles.map(profile)) config.putProfile(item);
    if (Array.isArray(data.snippets)) config.value.snippets = data.snippets.slice(0, 200).map(v => ({ name: text(v.name), command: text(v.command, 20000) }));
    if (Array.isArray(data.macros)) config.value.macros = data.macros.slice(0, 100).map(v => ({ name: text(v.name), steps: v.steps.slice(0, 500).map(x => ({ text: text(x.text, 20000), delay: Math.max(0, Math.min(10000, Number(x.delay) || 0)) })) }));
    config.save(); return config.value;
  });
  handle('credentials:clear', () => { writeJSON(path.join(config.directory, 'credentials.json'), {}); });
  handle('snippets:save', values => {
    if (!Array.isArray(values) || values.length > 200) throw new Error('Limite de 200 comandos rápidos.');
    config.value.snippets = values.map(v => ({ name: text(v.name), command: text(v.command, 20000) })); config.save(); return config.value.snippets;
  });
  handle('terminal:open', value => terminals.open(profile(value)));
  handle('terminal:activate', id => terminals.activate(id));
  handle('terminal:write', (id, value) => { if (typeof value !== 'string' || value.length > 1000000) throw new Error('Entrada inválida.'); const item = terminals.get(id); if (!item.ended) item.write(value); });
  handle('terminal:resize', (id, cols, rows) => { const item = terminals.get(id); if (!item.ended && Number.isInteger(cols) && Number.isInteger(rows) && cols > 0 && rows > 0 && cols < 1000 && rows < 1000) item.resize?.(cols, rows); });
  handle('terminal:close', id => terminals.close(id));
  handle('terminal:log', async id => {
    const item = terminals.get(id);
    if (item.log) { item.log.end(); item.log = null; return false; }
    const result = await dialog.showSaveDialog(window, { defaultPath: `terminal-${Date.now()}.log` });
    if (result.canceled) return false;
    item.log = fs.createWriteStream(result.filePath, { flags: 'a' });
    item.log.on('error', error => { emit('notice', error.message); item.log = null; }); return true;
  });
  handle('graphics:open', value => graphics.open(profile(value)));
  handle('graphics:activate', id => graphics.activate(id));
  handle('graphics:write', (id, data) => { if (typeof data === 'string' && data.length < 1000000) graphics.write(id, data); });
  handle('graphics:bounds', (id, bounds) => graphics.bounds(id, bounds));
  handle('graphics:close', id => graphics.close(id));
  handle('serial:list', () => SerialPort.list());
  handle('clipboard:read', () => clipboard.readText());
  handle('clipboard:write', value => { if (typeof value === 'string' && value.length < 5000000) clipboard.writeText(value); });
  handle('select:folder', async () => { const result = await dialog.showOpenDialog(window, { properties: ['openDirectory'] }); return result.canceled ? null : result.filePaths[0]; });
  handle('select:file', async () => { const result = await dialog.showOpenDialog(window, { properties: ['openFile'] }); return result.canceled ? null : result.filePaths[0]; });
  handle('files:list', (kind, id, directory) => files.list(kind, id, text(directory, 4096)));
  handle('files:read', (kind, id, filename) => files.read(kind, id, text(filename, 4096)));
  handle('files:write', (kind, id, filename, content) => files.write(kind, id, text(filename, 4096), content));
  handle('files:change', (kind, id, action, filename, destination) => files.change(kind, id, action, text(filename, 4096), destination ? text(destination, 4096) : undefined));
  handle('files:ftp', options => files.ftpConnect(options));
  handle('files:transfer', async (kind, id, direction, remote) => {
    let result, local;
    if (direction === 'upload') {
      result = await dialog.showOpenDialog(window, { properties: ['openFile'] }); if (result.canceled) return null;
      local = result.filePaths[0]; remote = path.posix.join(remote, path.basename(local));
      try {
        const listing = await files.list(kind, id, path.posix.dirname(remote));
        if (listing.rows.some(x => x.path === remote) && !await ask({ title: 'Substituir arquivo remoto?', message: remote, fields: [], accept: 'Substituir' })) return null;
      } catch (error) { throw new Error(`Não foi possível verificar destino: ${error.message}`); }
    } else if (direction === 'download') {
      result = await dialog.showSaveDialog(window, { defaultPath: path.posix.basename(remote) }); if (result.canceled) return null; local = result.filePath;
    } else throw new Error('Direção de transferência inválida.');
    await files.transfer(kind, id, direction, local, remote); return local;
  });
  handle('transfer:add', options => {
    if (!options || typeof options.local !== 'string' || typeof options.remote !== 'string') throw new Error('Transferência inválida.');
    return transfers.add({ kind: options.kind, id: options.id, direction: options.direction, local: text(options.local, 4096), remote: text(options.remote, 4096) });
  });
  handle('transfer:folder', async (kind, id, direction, remote) => {
    const result = direction === 'upload' ? await dialog.showOpenDialog(window, { properties: ['openDirectory'] }) : await dialog.showOpenDialog(window, { properties: ['openDirectory', 'createDirectory'], title: 'Escolha a pasta de destino' });
    if (result.canceled) return null;
    const chosen = result.filePaths[0];
    return transfers.add(direction === 'upload' ? { kind, id, direction, local: chosen, remote: path.posix.join(remote, path.basename(chosen)) } : { kind, id, direction, local: path.join(chosen, path.posix.basename(remote)), remote });
  });
  handle('mirror:start', async options => {
    const local = await dialog.showOpenDialog(window, { properties: ['openDirectory'], title: 'Pasta local a espelhar' }); if (local.canceled) return null;
    const remote = text(options.remote, 4096); if (!remote.startsWith('/')) throw new Error('Informe um caminho remoto absoluto.');
    const mirror = await new Mirror(files, emit).start({ session: options.session, local: local.filePaths[0], remote });
    const name = `Espelho ${local.filePaths[0]} → ${remote}`;
    network.servers.set(mirror.id, { id: mirror.id, name, kind: 'mirror', server: { close: () => mirror.stop(), closeAllConnections() {} } });
    return { id: mirror.id, name };
  });
  handle('vnc:start', async options => {
    const vncPort = Number(options?.port) || 5900; const exe = await tools.install('tightvnc');
    const server = await startVnc({ exe, port: vncPort, password: typeof options?.password === 'string' ? options.password : '' });
    const id = crypto.randomUUID(), name = `VNC 127.0.0.1:${server.port} — sua tela (${server.authenticated ? 'com senha' : 'SEM senha, só local'})`;
    network.servers.set(id, { id, name, kind: 'vnc', server: { close: () => server.close(), closeAllConnections() {} } });
    return { id, name, port: server.port };
  });
  handle('packages:search', (query, source) => packages.search(query, source));
  handle('packages:installed', () => packages.installed());
  handle('packages:upgrades', () => packages.upgrades());
  handle('packages:operate', (action, id, source) => packages.operate(action, id, source));
  handle('packages:cancel', () => packages.cancel());
  const cleanLists = values => {
    if (!Array.isArray(values) || values.length > 100) throw new Error('Limite de 100 listas.');
    return values.map(list => {
      if (!Array.isArray(list.items) || list.items.length > 500) throw new Error('Lista inválida.');
      return { name: text(list.name), items: list.items.map(item => { if (!PACKAGE_ID.test(item.id || '')) throw new Error(`Identificador inválido: ${String(item.id).slice(0, 40)}`); return { id: item.id, name: text(item.name || item.id, 200), source: item.source === 'msstore' ? 'msstore' : 'winget' }; }) };
    });
  };
  handle('packages:lists:save', values => { config.value.packageLists = cleanLists(values); config.save(); return config.value.packageLists; });
  handle('packages:lists:export', async index => {
    const list = (config.value.packageLists || [])[index]; if (!list) throw new Error('Lista não encontrada.');
    const result = await dialog.showSaveDialog(window, { defaultPath: `${list.name.replace(/[^\w.-]+/g, '_')}.stanis-pacotes.json`, filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (result.canceled) return false; writeJSON(result.filePath, { format: 'stanis-terminal-packages', version: 1, ...list }); return true;
  });
  handle('packages:lists:import', async () => {
    const result = await dialog.showOpenDialog(window, { filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] }); if (result.canceled) return null;
    if ((await fsp.stat(result.filePaths[0])).size > 1024 * 1024) throw new Error('Arquivo muito grande.');
    const data = readJSON(result.filePaths[0], {}); const [list] = cleanLists([{ name: data.name, items: data.items }]);
    config.value.packageLists = cleanLists([...(config.value.packageLists || []), list]); config.save(); return config.value.packageLists;
  });
  handle('tools:list', () => tools.list());
  handle('tools:install', async id => { await tools.install(text(id, 40)); return tools.list(); });
  handle('tools:remove', async id => { await tools.remove(text(id, 40)); return tools.list(); });
  handle('transfer:cancel', id => transfers.cancel(id));
  handle('transfer:clear', () => transfers.clear());
  handle('transfer:list', () => transfers.list());
  handle('network:diagnostic', options => network.diagnostic(options));
  handle('network:tunnel', options => network.tunnel(options));
  handle('network:serve', options => network.serve(options));
  handle('network:socks', options => network.socks(options));
  handle('network:remote', options => network.remoteTunnel(options));
  handle('network:host', options => network.host(options));
  handle('network:list', () => network.list());
  handle('network:stop', id => network.stop(id));
  handle('tools:hash', async () => {
    const result = await dialog.showOpenDialog(window, { properties: ['openFile'] }); if (result.canceled) return null;
    const digest = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(result.filePaths[0])) digest.update(chunk);
    return { file: result.filePaths[0], sha256: digest.digest('hex') };
  });
  handle('tools:keygen', async () => {
    const result = await dialog.showSaveDialog(window, { defaultPath: path.join(os.homedir(), '.ssh', 'stanis_rsa') }); if (result.canceled) return null;
    if (fs.existsSync(result.filePath) || fs.existsSync(result.filePath + '.pub')) throw new Error('Escolha um nome novo para não sobrescrever chaves.');
    const { generateKeyPairSync } = require('node:crypto');
    const answer = await ask({ title: 'Nova chave RSA 3072', fields: [{ name: 'password', label: 'Frase secreta obrigatória', type: 'password' }] });
    if (!answer) return null;
    if (!answer.password || answer.password.length < 8) throw new Error('Use uma frase secreta com pelo menos 8 caracteres.');
    const pair = generateKeyPairSync('rsa', { modulusLength: 3072 });
    const privateKey = pair.privateKey.export({ type: 'pkcs1', format: 'pem', cipher: 'aes-256-cbc', passphrase: answer.password });
    const jwk = pair.publicKey.export({ format: 'jwk' });
    const field = bytes => { const length = Buffer.alloc(4); length.writeUInt32BE(bytes.length); return Buffer.concat([length, bytes]); };
    const integer = value => { let bytes = Buffer.from(value, 'base64url'); if (bytes[0] & 128) bytes = Buffer.concat([Buffer.from([0]), bytes]); return field(bytes); };
    const publicKey = `ssh-rsa ${Buffer.concat([field(Buffer.from('ssh-rsa')), integer(jwk.e), integer(jwk.n)]).toString('base64')} stanis-terminal\n`;
    await fsp.mkdir(path.dirname(result.filePath), { recursive: true }); await fsp.writeFile(result.filePath, privateKey, { flag: 'wx', mode: 0o600 }); await fsp.writeFile(result.filePath + '.pub', publicKey, { flag: 'wx' }); return result.filePath;
  });
}
app.whenReady().then(async () => {
  try {
    config = new Config(app.getPath('userData'));
    const root = path.join(__dirname, 'ui');
    protocol.handle('stanis', request => {
      const url = new URL(request.url); const filename = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      if (url.host !== 'app' || !inside(root, filename)) return new Response('Forbidden', { status: 403 });
      return electronNet.fetch(pathToFileURL(filename).toString());
    });
    session.defaultSession.setPermissionRequestHandler((_, __, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_, callback) => callback({ cancel: true }));
    window = new BrowserWindow({ width: 1440, height: 900, minWidth: 900, minHeight: 600, show: false, backgroundColor: '#0c111b', title: 'Stanis Terminal', icon: path.join(__dirname, 'ui/icon.ico'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false } });
    Menu.setApplicationMenu(null);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    const ssh = new SSH(config, ask, safeStorage); terminals = new Sessions(ssh, emit); files = new Files(terminals, ask); transfers = new Transfers(files, emit); tools = new Tools(config.directory, ask); packages = new Packages(emit); terminals.toolPath = id => tools.file(id); network = new Network(terminals, emit); vault = new Vault(config.directory, safeStorage); graphics = new Graphics(window, emit, ask, app.isPackaged, vault, id => config.value.profiles.some(p => p.id === id));
    terminals.getX11 = () => graphics.getX11();
    if (tools.installed('tightvnc')) cleanupStale(tools.file('tightvnc')).catch(() => {});
    register();
    let closing = false;
    window.on('close', event => {
      if (!closing && !testMode && (terminals.items.size || graphics.items.size)) {
        event.preventDefault();
        dialog.showMessageBox(window, { type: 'question', message: 'Encerrar o aplicativo e todas as sessões?', buttons: ['Continuar trabalhando', 'Encerrar'], defaultId: 0, cancelId: 0 }).then(result => { if (result.response === 1) { closing = true; window.close(); } });
      }
    });
    window.on('closed', () => { terminals.closeAll(); graphics.closeAll(); packages?.closeAll(); files.closeAll(); network.closeAll(); for (const q of questions.values()) { clearTimeout(q.timer); q.resolve(null); } questions.clear(); app.quit(); });
    await window.loadURL('stanis://app/index.html'); window.show();
  } catch (error) { console.error(error); dialog.showErrorBox('Stanis Terminal', error.message); app.quit(); }
});
app.on('window-all-closed', () => app.quit());
