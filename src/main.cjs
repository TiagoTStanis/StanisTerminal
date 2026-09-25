const { app, BrowserWindow, ipcMain, dialog, safeStorage, clipboard, protocol, net: electronNet, session, Menu, shell } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { Config, profile, groupPath, text, host: validHost, port: validPort, readJSON, writeJSON } = require('./config.cjs');
const { checkMany } = require('./reach.cjs');
const { SSH } = require('./ssh.cjs');
const { Sessions } = require('./sessions.cjs');
const { Files } = require('./files.cjs');
const { Network, inside } = require('./network.cjs');
const { Graphics } = require('./graphics.cjs');
const { Transfers } = require('./transfers.cjs');
const { Mirror } = require('./mirror.cjs');
const { Tools } = require('./tools.cjs');
const { Vault } = require('./vault.cjs');
const { RemoteFiles } = require('./remotefiles.cjs');
const { scanImports, importFile, importRdpFolder, prepareImport } = require('./importers.cjs');
const { uploadZmodem, downloadZmodem } = require('./zmodemio.cjs');
const { Packages, ID: PACKAGE_ID } = require('./packages.cjs');
const { MsysPackages, NAME: MSYS_NAME } = require('./msyspkg.cjs');
const { execFile } = require('node:child_process');
const { startVnc, cleanupStale } = require('./vncserver.cjs');
const { SerialPort } = require('serialport');

protocol.registerSchemesAsPrivileged([{ scheme: 'stanis', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
const testMode = process.argv.includes('--test-mode');
// Modo de teste: pasta de dados nova a cada execução (o Windows reaproveita números de processo, e uma pasta
// antiga com o mesmo número fazia um teste abrir as sessões salvas de outro), apagada ao sair.
const testData = testMode && !process.env.STANIS_TEST_USERDATA ? fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-terminal-test-')) : null;
if (testMode) app.setPath('userData', process.env.STANIS_TEST_USERDATA || testData);
if (testData) app.on('will-quit', () => { try { fs.rmSync(testData, { recursive: true, force: true }); } catch { /* arquivos em uso: o sistema limpa a pasta temporária */ } });
else if (process.env.PORTABLE_EXECUTABLE_DIR) app.setPath('userData', path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'StanisTerminal-data'));
else if (app.isPackaged) app.setPath('userData', path.join(path.dirname(app.getPath('exe')), 'StanisTerminal-data'));
if (!testMode && !app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
let window, config, terminals, files, network, graphics, transfers, tools, vault, packages, msys, remoteFiles;
const questions = new Map();
// Rede de segurança: um erro não tratado no processo principal (ex.: config de TLS que o BoringSSL do
// Electron rejeita) por padrão derruba o app inteiro, fechando todas as sessões abertas. Registra e
// segue — muito melhor que perder tudo por causa de um erro isolado numa única conexão.
process.on('uncaughtException', error => {
  console.error('Exceção não tratada no processo principal:', error);
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'crash.log'), `[${new Date().toISOString()}] ${error.stack || error.message}\n`); } catch { /* userData pode não estar pronto ainda */ }
});
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
    config.value.settings = { fontSize: Math.max(10, Math.min(28, Number(value.fontSize) || 14)), theme: THEMES.includes(value.theme) ? value.theme : 'light', restoreSessions: value.restoreSessions === undefined ? previous.restoreSessions === true : !!value.restoreSessions, scrollback: Math.max(1000, Math.min(100000, Number(value.scrollback) || 10000)),
      syncFolder: value.syncFolder === undefined ? previous.syncFolder || '' : text(value.syncFolder || '', 2048), autocomplete: value.autocomplete === undefined ? previous.autocomplete !== false : !!value.autocomplete,
      highlightErrors: value.highlightErrors === undefined ? previous.highlightErrors !== false : !!value.highlightErrors,
      checkOnline: value.checkOnline === undefined ? previous.checkOnline !== false : !!value.checkOnline,
      highlightSet: ['network', 'general'].includes(value.highlightSet) ? value.highlightSet : previous.highlightSet || 'network' };
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
  // Senha mestra / bloqueio de tela: PBKDF2 (scrypt) local, independente do DPAPI. Protege contra alguém
  // com acesso à sua sessão Windows já aberta ver a lista de sessões; não protege contra quem tem sua senha do Windows.
  handle('lock:status', () => ({ enabled: !!config.value.lock, autoLockMinutes: config.value.lock?.autoLockMinutes || 0 }));
  handle('lock:set', ({ password, autoLockMinutes }) => {
    if (typeof password !== 'string' || password.length < 4 || password.length > 200) throw new Error('A senha mestra precisa ter ao menos 4 caracteres.');
    const salt = crypto.randomBytes(16); const hash = crypto.scryptSync(password, salt, 32);
    config.value.lock = { salt: salt.toString('base64'), hash: hash.toString('base64'), autoLockMinutes: Math.max(0, Math.min(180, Number(autoLockMinutes) || 0)) };
    config.save(); return true;
  });
  handle('lock:clear', password => {
    if (!config.value.lock) return true;
    const salt = Buffer.from(config.value.lock.salt, 'base64'); const hash = crypto.scryptSync(String(password || ''), salt, 32);
    if (!crypto.timingSafeEqual(hash, Buffer.from(config.value.lock.hash, 'base64'))) throw new Error('Senha mestra incorreta.');
    delete config.value.lock; config.save(); return true;
  });
  handle('lock:autolock', minutes => { if (config.value.lock) { config.value.lock.autoLockMinutes = Math.max(0, Math.min(180, Number(minutes) || 0)); config.save(); } return config.value.lock?.autoLockMinutes || 0; });
  handle('lock:check', password => {
    if (!config.value.lock) return true;
    const salt = Buffer.from(config.value.lock.salt, 'base64'); const hash = crypto.scryptSync(String(password || ''), salt, 32);
    return crypto.timingSafeEqual(hash, Buffer.from(config.value.lock.hash, 'base64'));
  });
  handle('session:saveOpen', list => {
    if (!Array.isArray(list) || list.length > 24) throw new Error('Lista de sessões abertas inválida.');
    const clean = list.map(item => ({ profile: item.profile.type === 'local' ? { type: 'local', shell: profile({ type: 'local', shell: item.profile.shell, name: 'x', group: 'g' }).shell, name: text(item.profile.name), group: 'Local', cwd: text(item.profile.cwd || '', 2048) } : profile(item.profile) }));
    writeJSON(path.join(config.directory, 'open-sessions.json'), clean); return true;
  });
  handle('session:loadOpen', () => readJSON(path.join(config.directory, 'open-sessions.json'), []));
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
  handle('graphics:close', id => { const item = graphics.items.get(id); graphics.close(id); if (item) remoteFiles.close(item.profile.id); });
  handle('network:filesOpen', id => { const item = graphics.items.get(id); if (!item) throw new Error('Sessão gráfica não encontrada.'); return remoteFiles.open(item.profile); });
  handle('rdp:lastFailure', destination => require('./rdpproxy.cjs').lastFailure(String(destination)));
  handle('rdp:log', () => {
    const file = path.join(app.getPath('userData'), 'rdp-proxy.log');
    if (!fs.existsSync(file)) return 'Nenhuma tentativa de conexão RDP registrada ainda.';
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    return lines.slice(-40).join('\n');
  });
  // Transferência de arquivo do RDP (canal CLIPRDR, via extensão do ironrdp-wasm): o renderer não tem
  // acesso a fs (contextIsolation/sandbox), então cada leitura/gravação passa por aqui.
  handle('rdp:pickUpload', async () => {
    const result = await dialog.showOpenDialog(window, { properties: ['openFile', 'multiSelections'] });
    if (result.canceled) return [];
    return result.filePaths.map(filePath => ({ name: path.basename(filePath), size: fs.statSync(filePath).size, path: filePath }));
  });
  handle('rdp:readChunk', async (filePath, position, size) => {
    const handle = await fsp.open(filePath, 'r');
    try { const buffer = Buffer.alloc(size); const { bytesRead } = await handle.read(buffer, 0, size, position); return buffer.subarray(0, bytesRead); }
    finally { await handle.close(); }
  });
  handle('rdp:saveDownload', async (suggestedName, data) => {
    const result = await dialog.showSaveDialog(window, { defaultPath: text(suggestedName, 255) });
    if (result.canceled) return null;
    await fsp.writeFile(result.filePath, Buffer.from(data));
    return result.filePath;
  });
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
  handle('files:tightvnc', options => files.tightConnect(options));
  handle('files:tightClose', id => files.tightClose(String(id)));
  // ZMODEM sobre um canal SSH dedicado (client.exec de rz/sz), independente do terminal interativo.
  const sshClientOf = id => { const item = terminals.get(id); if (!item.client || item.ended) throw new Error('Selecione uma sessão SSH ativa.'); return item.client; };
  handle('zmodem:upload', async id => {
    const client = sshClientOf(id); const result = await dialog.showOpenDialog(window, { properties: ['openFile'] }); if (result.canceled) return null;
    const onProgress = (sent, total) => emit('zmodem:progress', { id, direction: 'upload', sent, total });
    const info = await uploadZmodem(client, result.filePaths[0], { onProgress }); return { file: info.file, bytes: info.bytes };
  });
  handle('zmodem:download', async (id, remoteCommand) => {
    const client = sshClientOf(id); const command = text(remoteCommand, 4096); if (!command.trim()) throw new Error('Informe o comando remoto (ex.: sz arquivo.log).');
    const result = await dialog.showOpenDialog(window, { properties: ['openDirectory'] }); if (result.canceled) return null;
    const onProgress = (received, total) => emit('zmodem:progress', { id, direction: 'download', received, total });
    const info = await downloadZmodem(client, command, result.filePaths[0], { onProgress }); return { file: info.file, bytes: info.bytes };
  });
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
  // Envio (vários arquivos) ou download de um arquivo pela fila, com progresso no painel.
  handle('transfer:pick', async (kind, id, direction, remote) => {
    remote = text(remote, 4096); const join = kind === 'local' ? path.join : path.posix.join;
    if (direction === 'upload') {
      const result = await dialog.showOpenDialog(window, { properties: ['openFile', 'multiSelections'], title: 'Arquivos a enviar' }); if (result.canceled) return 0;
      const chosen = result.filePaths.slice(0, 200); for (const local of chosen) transfers.add({ kind, id, direction, local, remote: join(remote, path.basename(local)) });
      return chosen.length;
    }
    const result = await dialog.showSaveDialog(window, { defaultPath: path.win32.basename(remote) }); if (result.canceled) return 0;
    transfers.add({ kind, id, direction: 'download', local: result.filePath, remote }); return 1;
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
  // Abre a sessão VNC no TightVNC Viewer (janela própria, com a transferência de arquivos do TightVNC):
  // usa o instalado no Windows; senão, o do pacote oficial que o app já baixa (assinatura conferida).
  // Só host e porta: a senha é pedida pelo próprio Viewer, sem passar por linha de comando nem arquivo.
  handle('vnc:openViewer', async value => {
    const p = profile(value); if (p.type !== 'vnc') throw new Error('Só para sessões VNC.');
    const installed = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean).map(dir => path.join(dir, 'TightVNC', 'tvnviewer.exe')).find(file => fs.existsSync(file));
    let viewer = installed;
    if (!viewer) { await tools.install('tightvnc'); viewer = path.join(tools.root, 'tightvnc', 'PFiles', 'TightVNC', 'tvnviewer.exe'); }
    if (!fs.existsSync(viewer)) throw new Error('TightVNC Viewer não encontrado.');
    const target = p.host.includes(':') ? `[${p.host}]::${p.port}` : `${p.host}::${p.port}`;
    require('node:child_process').spawn(viewer, [target], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
    return { viewer: installed ? 'instalado' : 'do app' };
  });
  handle('vnc:start', async options => {
    const vncPort = Number(options?.port) || 5900; const exe = await tools.install('tightvnc');
    const server = await startVnc({ exe, port: vncPort, password: typeof options?.password === 'string' ? options.password : '' });
    const id = crypto.randomUUID(), name = `VNC 127.0.0.1:${server.port} — sua tela (${server.authenticated ? 'com senha' : 'SEM senha, só local'})`;
    network.servers.set(id, { id, name, kind: 'vnc', server: { close: () => server.close(), closeAllConnections() {} } });
    return { id, name, port: server.port };
  });
  const backend = source => source === 'msys2' ? msys : packages;
  handle('packages:search', (query, source) => backend(source).search(query, source));
  handle('packages:installed', source => backend(source).installed());
  handle('packages:upgrades', source => backend(source).upgrades());
  handle('packages:operate', (action, id, source) => backend(source).operate(action, id, source));
  handle('packages:cancel', () => { packages.cancel(); msys.cancel(); });
  const cleanLists = values => {
    if (!Array.isArray(values) || values.length > 100) throw new Error('Limite de 100 listas.');
    return values.map(list => {
      if (!Array.isArray(list.items) || list.items.length > 500) throw new Error('Lista inválida.');
      return { name: text(list.name), items: list.items.map(item => { const source = ['msstore', 'msys2'].includes(item.source) ? item.source : 'winget'; if (!(source === 'msys2' ? MSYS_NAME : PACKAGE_ID).test(item.id || '')) throw new Error(`Identificador inválido: ${String(item.id).slice(0, 40)}`); return { id: item.id, name: text(item.name || item.id, 200), source }; }) };
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
  handle('tools:path', id => { const key = text(id, 40); return tools.installed(key) ? tools.file(key) : null; });
  handle('tools:install', async id => { await tools.install(text(id, 40)); return tools.list(); });
  handle('tools:remove', async id => { await tools.remove(text(id, 40)); return tools.list(); });
  handle('transfer:cancel', id => transfers.cancel(id));
  handle('transfer:clear', () => transfers.clear());
  handle('transfer:list', () => transfers.list());
  handle('import:scan', () => scanImports());
  handle('import:file', async () => {
    const result = await dialog.showOpenDialog(window, { title: 'Escolher arquivo de conexões', filters: [{ name: 'mRemoteNG XML / Stanis Terminal JSON / Área de Trabalho Remota (.rdp)', extensions: ['xml', 'json', 'rdp'] }, { name: 'OpenSSH config / todos os arquivos', extensions: ['*'] }], properties: ['openFile'] });
    if (result.canceled) return null;
    return importFile(result.filePaths[0]);
  });
  handle('import:rdpFolder', async () => {
    const result = await dialog.showOpenDialog(window, { title: 'Escolher a pasta com os RemoteApps (.rdp)', properties: ['openDirectory'] });
    if (result.canceled) return null;
    return importRdpFolder(result.filePaths[0]);
  });
  handle('import:apply', rows => {
    const prepared = prepareImport(rows, config.value.profiles);
    if (prepared.added) {
      const next = { ...config.value, profiles: prepared.profiles };
      writeJSON(config.file, next); config.value = next;
    }
    return { config: config.value, added: prepared.added, skipped: prepared.skipped };
  });
  // Sessão do tipo Link salva pela própria pessoa: abre no navegador padrão sem perguntar de novo.
  handle('links:openProfile', async id => {
    const saved = config.value.profiles.find(p => p.id === text(id, 80) && p.type === 'web');
    if (!saved) throw new Error('Sessão de link não encontrada.');
    await shell.openExternal(saved.url); return saved.url;
  });
  handle('links:open', async url => {
    let parsed; try { parsed = new URL(text(url, 2048)); } catch { throw new Error('Endereço inválido.'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Só é permitido abrir links http:// ou https://.');
    const answer = await ask({ title: 'Abrir link no navegador?', message: parsed.toString(), fields: [], accept: 'Abrir' });
    if (answer) await shell.openExternal(parsed.toString());
  });
  // Status online das sessões (como o mRemoteNG): só abre uma conexão TCP na porta da sessão e fecha,
  // sem enviar nada nem autenticar. Poucas por vez, para não parecer varredura a um IPS.
  // Status online: os resultados chegam aos poucos (lotes a cada 200 ms) pelo evento network:reach.
  handle('network:reachable', async targets => {
    if (!Array.isArray(targets) || targets.length > 5000) throw new Error('Lista de hosts inválida.');
    const list = targets.map(t => ({ host: validHost(t?.host), port: validPort(t?.port) }));
    let batch = {}, timer = null;
    const flush = () => { timer = null; if (Object.keys(batch).length) { emit('network:reach', batch); batch = {}; } };
    const results = await checkMany(list, { onResult: (i, online) => { batch[`${list[i].host}:${list[i].port}`] = online; timer ??= setTimeout(flush, 200); } });
    clearTimeout(timer); flush(); return results;
  });
  handle('network:portscan', options => network.portScan(options));
  handle('network:wol', options => network.wakeOnLan(options));
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
    // Só a tela cheia (botão das sessões gráficas) é liberada; o resto das permissões do navegador fica negado.
    session.defaultSession.setPermissionRequestHandler((_, permission, callback) => callback(permission === 'fullscreen'));
    session.defaultSession.setPermissionCheckHandler((_, permission) => permission === 'fullscreen');
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (details, callback) => {
      // Única exceção: o proxy RDCleanPath local (WebSocket -> TLS -> TCP) que o cliente RDP em
      // WASM usa para alcançar o servidor de verdade — nunca sai da máquina, porta é dinâmica.
      const allowed = graphics?.rdpProxyPort && details.url === `ws://127.0.0.1:${graphics.rdpProxyPort}/`;
      callback({ cancel: !allowed });
    });
    window = new BrowserWindow({ width: 1440, height: 900, minWidth: 900, minHeight: 600, show: false, backgroundColor: '#0c111b', title: 'Stanis Terminal', icon: path.join(__dirname, 'ui/icon.ico'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false, webviewTag: true } });
    Menu.setApplicationMenu(null);
    // Só a janela de sessão destacada (about:blank com nome stanis-popout-…) pode abrir: é o próprio app movendo
    // o painel de uma sessão para outra janela/monitor. Qualquer outro window.open continua negado.
    window.webContents.setWindowOpenHandler(({ url, frameName }) => url === 'about:blank' && /^stanis-popout-[\w-]{1,80}$/.test(frameName)
      ? { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: '#0c111b', icon: path.join(__dirname, 'ui/icon.ico'), minWidth: 360, minHeight: 240 } }
      : { action: 'deny' });
    // Sessões do tipo Link: <webview> só com http/https, no perfil isolado persist:stanis-web, sem preload
    // nem Node, e sem pausar os timers da página em segundo plano (senão o próprio "manter ativa" da página parava).
    const guardWebview = (event, webPreferences, params) => {
      delete webPreferences.preload;
      Object.assign(webPreferences, { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false, webviewTag: false });
      if (!/^https?:\/\//i.test(params.src || '') || params.partition !== WEB_PARTITION) event.preventDefault();
    };
    window.webContents.on('will-attach-webview', guardWebview);
    window.webContents.on('did-create-window', child => {
      child.setMenu(null);
      child.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      child.webContents.on('will-navigate', event => event.preventDefault());
      child.webContents.on('will-attach-webview', guardWebview); // aba de Link destacada: mesmas regras
    });
    window.webContents.on('will-navigate', event => event.preventDefault());
    const ssh = new SSH(config, ask, safeStorage); terminals = new Sessions(ssh, emit); files = new Files(terminals, ask); transfers = new Transfers(files, emit); tools = new Tools(config.directory, ask, { afterInstall: async (id, file) => {
      // Primeiro uso do MSYS2: inicializa o chaveiro do pacman (o próprio MSYS2 consulta o servidor de chaves nessa etapa).
      if (id === 'msys2') await new Promise((resolve, reject) => execFile(file, ['-lc', 'exit'], { env: { ...process.env, MSYSTEM: 'MSYS', CHERE_INVOKING: '1' }, windowsHide: true, timeout: 600000 }, error => error ? reject(new Error('Não foi possível inicializar o MSYS2: ' + error.message)) : resolve()));
    } });
    packages = new Packages(emit); msys = new MsysPackages(emit, () => tools.installed('msys2') ? path.join(tools.root, 'msys2', 'msys64') : null); terminals.toolPath = id => tools.file(id); network = new Network(terminals, emit); vault = new Vault(config.directory, safeStorage); graphics = new Graphics(window, emit, ask, app.isPackaged, vault, id => config.value.profiles.some(p => p.id === id));
    remoteFiles = new RemoteFiles(terminals, ssh, vault, ask, config);
    terminals.getX11 = () => graphics.getX11();
    if (tools.installed('tightvnc')) cleanupStale(tools.file('tightvnc')).catch(() => {});
    // Oh My Posh saiu do catálogo na 1.9.2: apaga a cópia que tenha sido instalada antes.
    fs.promises.rm(path.join(tools.root, 'ohmyposh'), { recursive: true, force: true }).catch(() => {});
    register();
    let closing = false;
    window.on('close', event => {
      if (!closing && !testMode && (terminals.items.size || graphics.items.size)) {
        event.preventDefault();
        dialog.showMessageBox(window, { type: 'question', message: 'Encerrar o aplicativo e todas as sessões?', buttons: ['Continuar trabalhando', 'Encerrar'], defaultId: 0, cancelId: 0 }).then(result => { if (result.response === 1) { closing = true; window.close(); } });
      }
    });
    window.on('closed', () => { remoteFiles?.closeAll(); terminals.closeAll(); graphics.closeAll(); packages?.closeAll(); msys?.closeAll(); files.closeAll(); network.closeAll(); for (const q of questions.values()) { clearTimeout(q.timer); q.resolve(null); } questions.clear(); app.quit(); });
    await window.loadURL('stanis://app/index.html'); window.show();
  } catch (error) { console.error(error); dialog.showErrorBox('Stanis Terminal', error.message); app.quit(); }
});
app.on('window-all-closed', () => app.quit());

// ---------- Navegador das sessões Link ----------
const WEB_PARTITION = 'persist:stanis-web';
app.on('web-contents-created', (_, contents) => {
  if (contents.getType() !== 'webview') return;
  const web = url => /^https?:\/\//i.test(url);
  // Links que abririam outra janela (target=_blank) abrem na própria aba; esquemas estranhos são barrados.
  contents.setWindowOpenHandler(({ url }) => { if (web(url)) contents.loadURL(url); return { action: 'deny' }; });
  contents.on('will-navigate', (event, url) => { if (!web(url)) event.preventDefault(); });
  // Zoom da página (Ctrl + roda, Ctrl +/-/0): quem aplica é a aba, que guarda a escolha da sessão.
  contents.on('zoom-changed', (_, direction) => emit('web:zoom', { id: contents.id, step: direction === 'in' ? 1 : -1 }));
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !input.control || input.alt || input.meta) return;
    const step = ['=', '+'].includes(input.key) ? 1 : input.key === '-' ? -1 : input.key === '0' ? 0 : null;
    if (step !== null) { event.preventDefault(); emit('web:zoom', { id: contents.id, step }); }
  });
});
app.whenReady().then(() => {
  const web = session.fromPartition(WEB_PARTITION);
  web.setPermissionRequestHandler((_, permission, callback) => callback(['fullscreen', 'clipboard-sanitized-write'].includes(permission)));
});
// Certificado próprio (comum em páginas de switch, firewall, iDRAC…): pergunta uma vez e lembra por host +
// impressão digital, como a chave de um servidor SSH. Um certificado diferente depois pergunta de novo.
// ---------- Aba de Link em janela separada ----------
// O <webview> não funciona na janela filha usada pelas outras sessões, então a aba de Link vai para uma janela
// própria, no mesmo perfil isolado (continua logada), com a mesma lupa e o mesmo "manter ativa". Fechar a janela
// (ou "Trazer de volta") devolve a página para a aba, no endereço em que estava.
const webPopouts = new Map(); // sessão → { win, mode, timer, silent }
const webPopoutIds = new Set(); // webContents dessas janelas (para o certificado próprio)
function webZoomFactor(win, mode) {
  const width = win.getContentBounds().width || 1200;
  const factor = mode === 'auto' ? Math.min(1, width / 1280) : typeof mode === 'string' ? width / Number(mode.slice(1)) : Number(mode) || 1;
  return Math.max(0.25, Math.min(3, factor));
}
function openWebPopout(options) {
  const sessionId = text(options?.session, 120), url = text(options?.url, 2048);
  if (!/^https?:\/\//i.test(url)) throw new Error('Endereço inválido.');
  if (webPopouts.has(sessionId)) { webPopouts.get(sessionId).win.focus(); return true; }
  const mode = options.zoom === 'auto' || /^w\d{3,4}$/.test(options.zoom) ? options.zoom : Math.max(0.25, Math.min(3, Number(options.zoom) || 1));
  const at = options.at && Number.isFinite(options.at.x) && Number.isFinite(options.at.y) ? { x: Math.round(options.at.x - 60), y: Math.round(options.at.y - 20) } : {};
  const win = new BrowserWindow({ width: Math.max(800, Number(options.width) || 1200), height: Math.max(560, Number(options.height) || 800), ...at, title: text(options.title || 'Link', 200), icon: path.join(__dirname, 'ui/icon.ico'), backgroundColor: '#ffffff',
    webPreferences: { partition: WEB_PARTITION, sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, spellcheck: false } });
  const entry = { win, mode, timer: null, silent: false, url };
  webPopouts.set(sessionId, entry); webPopoutIds.add(win.webContents.id);
  const contents = win.webContents, web = link => /^https?:\/\//i.test(link);
  const apply = () => { try { contents.setZoomFactor(webZoomFactor(win, entry.mode)); } catch { /* carregando */ } };
  const setMode = next => { entry.mode = typeof next === 'number' ? Math.round(Math.max(0.25, Math.min(3, next)) * 100) / 100 : next; apply(); buildMenu(); };
  const step = direction => direction === 0 ? setMode('auto') : setMode(webZoomFactor(win, entry.mode) * (direction > 0 ? 1.1 : 1 / 1.1));
  const buildMenu = () => {
    const zoomItem = (value, label) => ({ label, type: 'radio', checked: entry.mode === value, click: () => setMode(value) });
    win.setMenu(Menu.buildFromTemplate([
      { label: '← Voltar', click: () => contents.navigationHistory.canGoBack() && contents.navigationHistory.goBack() },
      { label: '→ Avançar', click: () => contents.navigationHistory.canGoForward() && contents.navigationHistory.goForward() },
      { label: '↻ Recarregar', accelerator: 'F5', click: () => contents.reload() },
      { label: `🔍 Zoom (${Math.round(webZoomFactor(win, entry.mode) * 100)}%)`, submenu: [
        zoomItem('auto', 'Automático (layout de computador, mín. 1280 px)'), { type: 'separator' },
        zoomItem('w1366', 'Como uma tela de 1366 px'), zoomItem('w1600', 'Como uma tela de 1600 px'), zoomItem('w1920', 'Como uma tela de 1920 px (Full HD)'), { type: 'separator' },
        ...[0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5].map(z => zoomItem(z, z === 1 ? '100% (tamanho real)' : `${Math.round(z * 100)}%`)),
      ] },
      { label: '🌐 Navegador', click: () => { const current = contents.getURL(); if (web(current)) shell.openExternal(current); } },
      { label: '⧈ Trazer de volta para o Stanis Terminal', click: () => win.close() },
    ]));
  };
  buildMenu();
  contents.setWindowOpenHandler(({ url: link }) => { if (web(link)) contents.loadURL(link); return { action: 'deny' }; });
  contents.on('will-navigate', (event, link) => { if (!web(link)) event.preventDefault(); });
  contents.on('zoom-changed', (_, direction) => step(direction === 'in' ? 1 : -1));
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !input.control || input.alt || input.meta) return;
    const direction = ['=', '+'].includes(input.key) ? 1 : input.key === '-' ? -1 : input.key === '0' ? 0 : null;
    if (direction !== null) { event.preventDefault(); step(direction); }
  });
  contents.on('did-finish-load', apply); contents.on('did-navigate', apply); win.on('resize', () => { apply(); buildMenu(); });
  contents.on('page-title-updated', (event, title) => { event.preventDefault(); win.setTitle(`${title} — ${text(options.title || 'Link', 200)}`); });
  // Manter ativa: o mesmo sinal da aba (movimento de mouse real + requisição à própria página com o login).
  if (options.keepAlive) entry.timer = setInterval(() => {
    if (contents.isDestroyed()) return;
    const x = 5 + Math.floor(Math.random() * 20), y = 5 + Math.floor(Math.random() * 20);
    contents.sendInputEvent({ type: 'mouseMove', x, y }); contents.sendInputEvent({ type: 'mouseMove', x: x + 1, y: y + 1 });
    contents.executeJavaScript("fetch(location.href, { credentials: 'include', cache: 'no-store' }).then(() => true, () => false)", false).catch(() => {});
  }, Math.max(1, Math.min(60, Number(options.minutes) || 4)) * 60000);
  win.on('close', () => { try { entry.url = contents.getURL() || entry.url; } catch { /* já fechando */ } });
  win.on('closed', () => {
    clearInterval(entry.timer); webPopouts.delete(sessionId); webPopoutIds.delete(entry.contentsId);
    if (!entry.silent) emit('web:docked', { session: sessionId, url: web(entry.url) ? entry.url : url, zoom: entry.mode });
  });
  entry.contentsId = contents.id;
  win.loadURL(url);
  return true;
}
handle('web:popout', options => openWebPopout(options));
handle('web:dock', id => { webPopouts.get(text(id, 120))?.win.close(); return true; });
handle('web:focus', id => { const entry = webPopouts.get(text(id, 120)); if (entry) { if (entry.win.isMinimized()) entry.win.restore(); entry.win.focus(); } return !!entry; });
handle('web:closePopout', id => { const entry = webPopouts.get(text(id, 120)); if (entry) { entry.silent = true; entry.win.close(); } return true; });

app.on('certificate-error', (event, contents, url, error, certificate, callback) => {
  if (contents.getType() !== 'webview' && !webPopoutIds.has(contents.id)) return callback(false);
  event.preventDefault();
  let hostPort; try { hostPort = new URL(url).host; } catch { return callback(false); }
  const trusted = config.value.trustedWebCerts || {};
  if (trusted[hostPort] === certificate.fingerprint) return callback(true);
  ask({ title: 'Certificado não confiável', message: `${hostPort}\n${error}\nEmitido para: ${certificate.subjectName}\nEmitido por: ${certificate.issuerName}\nImpressão digital: ${certificate.fingerprint}\n\nPáginas de equipamentos costumam usar certificado próprio. Confiar neste certificado para ${hostPort}?`, fields: [], accept: 'Confiar' })
    .then(answer => { if (answer) { config.value.trustedWebCerts = { ...trusted, [hostPort]: certificate.fingerprint }; config.save(); } callback(!!answer); })
    .catch(() => callback(false));
});
