import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import RFB from '@novnc/novnc';
import { setup } from './extras.js';
import { setupPackages } from './packages.js';
import { setupTree } from './tree.js';

const $ = id => document.getElementById(id);
const api = window.api;
const call = (name, ...args) => api.call(name, ...args);
let state, activeId, split = false, toastTimer, editor = null, extras = null;
const sessions = new Map();
const fileState = { kind: 'local', id: '', path: '', parent: '' };
const dialogQueue = [];
let currentDialog = null;
const PALETTES = {
  dark: { background: '#0d1420', foreground: '#d2e0ef', cursor: '#50d8bc', selectionBackground: '#315365', black: '#172231', red: '#ee7d8b', green: '#6cd6a1', yellow: '#e8c47b', blue: '#7ab8f4', magenta: '#c298e8', cyan: '#64d4dd', white: '#e1e9f1' },
  light: { background: '#ffffff', foreground: '#1f2933', cursor: '#2563eb', selectionBackground: '#cfe0ff', selectionForeground: '#1f2933', black: '#1f2933', red: '#c62828', green: '#1b7f4b', yellow: '#946200', blue: '#1d4fd0', magenta: '#8b3fb5', cyan: '#0c7a8a', white: '#8a94a3', brightBlack: '#6b7785', brightRed: '#e53935', brightGreen: '#2e9e63', brightYellow: '#b57a00', brightBlue: '#3b6fe8', brightMagenta: '#a557cf', brightCyan: '#1596a8', brightWhite: '#4b5563' },
  dracula: { background: '#282a36', foreground: '#f8f8f2', cursor: '#f8f8f2', selectionBackground: '#44475a', black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c', blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2' },
  nord: { background: '#2e3440', foreground: '#d8dee9', cursor: '#88c0d0', selectionBackground: '#434c5e', black: '#3b4252', red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b', blue: '#81a1c1', magenta: '#b48ead', cyan: '#88c0d0', white: '#e5e9f0' },
  solarized: { background: '#002b36', foreground: '#93a1a1', cursor: '#93a1a1', selectionBackground: '#073642', black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900', blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5' },
  monokai: { background: '#272822', foreground: '#f8f8f2', cursor: '#f8f8f0', selectionBackground: '#49483e', black: '#272822', red: '#f92672', green: '#a6e22e', yellow: '#f4bf75', blue: '#66d9ef', magenta: '#ae81ff', cyan: '#a1efe4', white: '#f8f8f2' }
};
const theme = () => PALETTES[state.config.settings.theme] || PALETTES.light;
function toast(message) { $('status').textContent = message; $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 6500); }
function safe(fn) { return (...args) => Promise.resolve().then(() => fn(...args)).catch(error => toast(error.message)); }
function button(label, action, className = '') { const el = document.createElement('button'); el.type = 'button'; el.textContent = label; el.className = className; el.onclick = safe(action); return el; }
function elem(tag, text, className = '') { const el = document.createElement(tag); el.textContent = text; el.className = className; return el; }
function current() { return sessions.get(activeId); }

function form(spec) { return new Promise(resolve => { dialogQueue.push({ spec, resolve }); showNextDialog(); }); }
function showNextDialog() {
  if (currentDialog || !dialogQueue.length) return;
  currentDialog = dialogQueue.shift(); const { spec } = currentDialog;
  $('dialog-title').textContent = spec.title;
  $('dialog-message').textContent = spec.message || '';
  $('dialog-ok').textContent = spec.accept || 'Confirmar';
  $('dialog-cancel').hidden = $('dialog-x').hidden = !!spec.noCancel;
  const fields = [...(spec.fields || [])];
  if (spec.remember) fields.push({ name: 'remember', label: 'Guardar com criptografia da minha conta Windows', type: 'checkbox', wide: true });
  $('dialog-fields').replaceChildren();
  for (const field of fields) {
    const label = elem('label', '', 'field' + (field.wide ? ' wide' : '') + (field.type === 'checkbox' ? ' checkbox' : ''));
    label.dataset.field = field.name;
    label.append(elem('span', field.label));
    const input = document.createElement(field.options ? 'select' : field.type === 'textarea' ? 'textarea' : 'input');
    input.name = field.name;
    if (field.options) for (const option of field.options) { const item = typeof option === 'string' ? { value: option, label: option } : option; const optionEl = elem('option', item.label); optionEl.value = item.value; input.append(optionEl); }
    else if (field.type !== 'textarea') input.type = field.type || 'text';
    if (field.type === 'checkbox') input.checked = !!field.value; else input.value = field.value ?? '';
    if (field.required) input.required = true;
    if (field.min !== undefined) input.min = field.min;
    if (field.max !== undefined) input.max = field.max;
    input.autocomplete = 'off'; label.append(input); $('dialog-fields').append(label);
  }
  if (spec.onChange) { $('dialog-fields').onchange = () => spec.onChange($('dialog-form')); spec.onChange($('dialog-form')); } else $('dialog-fields').onchange = null;
  $('form-dialog').showModal(); updateNativeBounds();
}
function finishDialog(value) { if (!currentDialog) return; if (value === null && currentDialog.spec.noCancel) return; const { resolve } = currentDialog; currentDialog = null; $('form-dialog').close(); resolve(value); showNextDialog(); updateNativeBounds(); }
$('dialog-form').onsubmit = event => { event.preventDefault(); const value = Object.fromEntries(new FormData(event.target)); for (const check of event.target.querySelectorAll('[type=checkbox]')) value[check.name] = check.checked; finishDialog(value); };
$('dialog-cancel').onclick = $('dialog-x').onclick = () => finishDialog(null);
$('form-dialog').addEventListener('cancel', event => { event.preventDefault(); finishDialog(null); });
api.on('question', safe(async spec => { const value = await form(spec); await call('answer', spec.id, value); }));
api.on('notice', toast);

function localProfile(shell = 'powershell') { return { type: 'local', shell, name: { powershell: 'PowerShell', cmd: 'CMD', bash: 'Git Bash', wsl: 'WSL', busybox: 'BusyBox (Unix)', msys2: 'Unix (MSYS2)' }[shell], group: 'Local', cwd: state.home }; }
async function sessionForm(existing = {}) {
  const type = existing.type || 'ssh';
  const result = await form({ title: existing.id ? 'Editar sessão' : 'Nova sessão', accept: 'Salvar sessão', fields: [
    { name: 'name', label: 'Nome', value: existing.name || '', required: true }, { name: 'group', label: 'Pasta', value: existing.group || 'Minhas sessões', options: [...new Set(['Minhas sessões', ...(state.config.folders || []), ...state.config.profiles.map(p => p.group)])].sort((a, b) => a.localeCompare(b)).map(f => ({ value: f, label: f })) },
    { name: 'type', label: 'Protocolo', value: type, options: [{ value: 'ssh', label: 'SSH + SFTP' }, { value: 'local', label: 'Terminal local' }, { value: 'rdp', label: 'RDP integrado' }, { value: 'vnc', label: 'VNC integrado' }, { value: 'telnet', label: 'Telnet' }, { value: 'serial', label: 'Serial (8N1)' }, { value: 'x11', label: 'Servidor X11 local' }, { value: 'ssh-x11', label: 'SSH com aplicativos X11' }, { value: 'xdmcp', label: 'Área de trabalho XDMCP' }, { value: 'rlogin', label: 'Rlogin (sem criptografia)' }, { value: 'rsh', label: 'Rsh — executar comando (sem criptografia)' }] },
    { name: 'shell', label: 'Shell local', value: existing.shell || 'powershell', options: ['powershell', 'cmd', 'bash', 'wsl', 'busybox', 'msys2'] },
    { name: 'cwd', label: 'Pasta inicial', value: existing.cwd || state.home, wide: true },
    { name: 'host', label: 'Host / IP', value: existing.host || '' }, { name: 'port', label: 'Porta (vazio = padrão)', type: 'number', value: existing.port || '', min: 1, max: 65535 },
    { name: 'username', label: 'Usuário / domínio\\usuário', value: existing.username || '' },
    { name: 'password', label: state.secrets?.[existing.id] ? 'Senha (guardada; deixe vazio para manter)' : 'Senha (opcional; guardada com criptografia do Windows)', type: 'password', wide: true },
    { name: 'keyPath', label: 'Arquivo de chave privada SSH (opcional)', value: existing.keyPath || '', wide: true },
    { name: 'useAgent', label: 'Usar o agente SSH do Windows (chaves ficam no agente, sem senha)', type: 'checkbox', value: !!existing.useAgent, wide: true },
    { name: 'agentForward', label: 'Encaminhar o agente para o servidor (permite pular deste servidor para outro com a mesma chave)', type: 'checkbox', value: !!existing.agentForward, wide: true },
    { name: 'proxyHost', label: 'Proxy SOCKS5 para alcançar o servidor (opcional)', value: existing.proxyHost || '', wide: true },
    { name: 'proxyPort', label: 'Porta do proxy', type: 'number', value: existing.proxyPort || 1080 },
    { name: 'jumpId', label: 'Gateway SSH (opcional)', value: existing.jumpId || '', wide: true, options: [{ value: '', label: 'Conexão direta' }, ...state.config.profiles.filter(p => p.type === 'ssh' && p.id !== existing.id).map(p => ({ value: p.id, label: p.name }))] },
    { name: 'newGroup', label: 'Ou criar nova pasta (use / para subpastas)', value: '', wide: true },
    { name: 'command', label: 'Comando remoto (Rsh)', value: existing.command || '', wide: true },
    { name: 'device', label: 'Porta serial', value: existing.device || 'COM1' }, { name: 'baudRate', label: 'Velocidade (baud)', type: 'number', value: existing.baudRate || 115200 }
  ], onChange: f => {
    const selected = f.elements.type.value;
    const show = ['name', 'group', 'newGroup', 'type', ...(selected === 'x11' ? [] : selected === 'xdmcp' ? ['host'] : selected === 'local' ? ['shell', 'cwd'] : selected === 'serial' ? ['device', 'baudRate'] : ['ssh', 'ssh-x11'].includes(selected) ? ['host', 'port', 'username', 'password', 'keyPath', 'useAgent', 'agentForward', 'proxyHost', 'proxyPort', 'jumpId'] : selected === 'rdp' ? ['host', 'port', 'username', 'password'] : selected === 'rlogin' ? ['host', 'port', 'username'] : selected === 'rsh' ? ['host', 'port', 'username', 'command'] : ['host', 'port'])];
    for (const field of $('dialog-fields').children) { field.hidden = !show.includes(field.dataset.field); for (const input of field.querySelectorAll('input,select')) input.disabled = field.hidden; }
  } });
  if (!result) return;
  const saved = await call('profile:save', { ...result, group: (result.newGroup || '').trim() || result.group, id: existing.id });
  state.secrets = await call('profile:secrets'); state.config.profiles = state.config.profiles.filter(p => p.id !== saved.id).concat(saved); renderProfiles(); toast('Sessão salva. Clique nela para conectar.');
}
let tree = null;
function renderProfiles() { tree ??= setupTree({ $, call, form, toast, safe, elem, state: () => state, openSession, sessionForm, localProfile }); tree.render(); }
let saveOpenTimer;
function scheduleSaveOpen() { clearTimeout(saveOpenTimer); saveOpenTimer = setTimeout(() => call('session:saveOpen', [...sessions.values()].map(s => ({ profile: s.profile }))).catch(() => {}), 800); }
async function openSession(profile) {
  if (sessions.size >= 24) throw new Error('Limite de 24 sessões nesta versão.');
  if (profile.type === 'local' && ['busybox', 'msys2'].includes(profile.shell)) { if (profile.shell === 'msys2') toast('Preparando o ambiente Unix (MSYS2). Na primeira vez pode levar alguns minutos…'); await call('tools:install', profile.shell); }
  toast(`Abrindo ${profile.name}…`);
  const graphical = ['rdp', 'vnc', 'x11', 'xdmcp'].includes(profile.type);
  const result = await call(graphical ? 'graphics:open' : 'terminal:open', profile);
  const item = { ...result, graphical, ended: false };
  item.pane = elem('section', '', 'pane'); item.pane.dataset.session = item.id;
  item.pane.addEventListener('mousedown', () => { activeId = item.id; renderTabs(); });
  sessions.set(item.id, item); $('panes').append(item.pane);
  if (!graphical) {
    const mount = elem('div', '', 'terminal-mount'); item.pane.append(mount);
    const terminal = new Terminal({ fontFamily: 'Cascadia Code, Consolas, monospace', fontSize: state.config.settings.fontSize, scrollback: state.config.settings.scrollback, cursorBlink: true, theme: theme(), allowProposedApi: false });
    item.terminal = terminal; item.fit = new FitAddon(); item.search = new SearchAddon(); terminal.loadAddon(item.fit); terminal.loadAddon(item.search); terminal.open(mount);
    terminal.loadAddon(new WebLinksAddon((_, uri) => safe(() => call('links:open', uri))())); extras.attach(item);
    terminal.onData(data => extras.input(item, data));
    terminal.onResize(safe(size => call('terminal:resize', item.id, size.cols, size.rows)));
    terminal.attachCustomKeyEventHandler(event => {
      if (event.type !== 'keydown') return true;
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyC') { safe(() => call('clipboard:write', terminal.getSelection()))(); return false; }
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyV') { safe(async () => paste(item, await call('clipboard:read')))(); return false; }
      if (extras.key(item, event)) return false;
      if (event.ctrlKey && event.shiftKey && ['KeyT', 'KeyF', 'KeyW'].includes(event.code)) return false;
      return true;
    });
    // Intercepta colagem nativa para evitar executar várias linhas sem revisão.
    mount.addEventListener('paste', event => { event.preventDefault(); event.stopPropagation(); safe(() => paste(item, event.clipboardData.getData('text/plain')))(); }, true);
    await call('terminal:activate', item.id);
  } else {
    item.mount = elem('div', '', 'graphic-mount'); item.pane.append(item.mount);
    if (profile.type === 'vnc') {
      const channel = { readyState: 1, protocol: '', binaryType: 'arraybuffer', onopen: null, onerror: null, onmessage: null, onclose: null,
        send(bytes) { let binary = ''; for (const b of new Uint8Array(bytes.buffer || bytes, bytes.byteOffset || 0, bytes.byteLength)) binary += String.fromCharCode(b); safe(() => call('graphics:write', item.id, btoa(binary)))(); },
        close() { this.readyState = 3; safe(() => call('graphics:close', item.id))(); }
      };
      item.channel = channel; item.rfb = new RFB(item.mount, channel); item.rfb.scaleViewport = true; item.rfb.resizeSession = true;
      item.rfb.addEventListener('credentialsrequired', safe(async () => {
        const credentials = await form({ title: 'Autenticação VNC', fields: [{ name: 'username', label: 'Usuário (quando exigido)' }, { name: 'password', label: 'Senha', type: 'password' }] });
        if (credentials) item.rfb.sendCredentials(credentials); else await closeSession(item.id, true);
      }));
      item.rfb.addEventListener('connect', () => toast('VNC conectado.'));
      item.rfb.addEventListener('disconnect', event => { item.ended = true; toast(event.detail.clean ? 'VNC desconectado.' : 'Conexão VNC interrompida.'); renderTabs(); });
      item.rfb.addEventListener('securityfailure', event => toast(event.detail.reason || 'Autenticação VNC falhou.'));
      await call('graphics:activate', item.id);
    } else item.mount.append(elem('div', profile.type === 'rdp' ? 'Conectando à área de trabalho…' : 'Servidor X11 ativo. Abra uma sessão SSH com aplicativos X11 para exibir as janelas aqui.', 'graphic-message'));
  }
  activeId = item.id; layout(); toast(`${profile.name} aberta.`); item.terminal?.focus(); scheduleSaveOpen();
}
async function paste(item, text) {
  if (!text) return;
  if (/[\r\n]/.test(text) && !await form({ title: 'Colar várias linhas?', message: 'A colagem pode executar comandos. Confira o conteúdo antes de continuar.', fields: [{ name: 'preview', label: 'Conteúdo', type: 'textarea', value: text, wide: true }], accept: 'Colar conteúdo' }).then(answer => { if (!answer) return false; text = answer.preview; return true; })) return;
  item.terminal.paste(text);
}
async function closeSession(id, force = false) {
  const item = sessions.get(id); if (!item) return;
  if (!force && !item.ended && !await form({ title: 'Encerrar sessão?', message: item.name, fields: [], accept: 'Encerrar' })) return;
  await call(item.graphical ? 'graphics:close' : 'terminal:close', id);
  item.rfb?.disconnect(); item.terminal?.dispose(); item.pane.remove(); sessions.delete(id);
  if (activeId === id) activeId = [...sessions.keys()].at(-1);
  layout(); scheduleSaveOpen();
}
function renderTabs() {
  $('tabs').replaceChildren();
  for (const item of sessions.values()) {
    const tab = elem('div', '', 'tab' + (item.id === activeId ? ' active' : '')); tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String(item.id === activeId));
    tab.append(elem('span', (item.ended ? '○ ' : '● ') + item.name));
    const close = button('✕', event => { event.stopPropagation(); return closeSession(item.id); }); close.title = 'Fechar sessão'; tab.append(close);
    tab.onclick = () => { activeId = item.id; layout(); item.terminal?.focus(); }; $('tabs').append(tab);
    item.pane.classList.toggle('selected', item.id === activeId);
  }
  const item = current(); $('session-label').textContent = item ? `${item.profile.type.toUpperCase()}  /  ${item.profile.host || item.profile.shell || item.profile.device || 'Local'}  /  ${item.name}` : 'Pronto para conectar';
  $('session-count').textContent = `${sessions.size} sessões`; $('log').textContent = item?.logging ? '● Parar gravação' : 'Gravar saída';
}
function layout() {
  renderTabs(); $('welcome').hidden = sessions.size > 0;
  const ids = [...sessions.keys()]; const selected = split ? [activeId, ...ids.filter(id => id !== activeId)].slice(0, 4) : [activeId];
  $('panes').classList.toggle('split', split && sessions.size > 1); $('panes').classList.toggle('many', split && selected.length > 2);
  for (const item of sessions.values()) item.pane.hidden = !selected.includes(item.id);
  requestAnimationFrame(() => { for (const item of sessions.values()) if (!item.pane.hidden) item.fit?.fit(); updateNativeBounds(); });
}
function updateNativeBounds() {
  const modal = !!document.querySelector('dialog[open]');
  for (const item of sessions.values()) if (['rdp', 'x11', 'xdmcp'].includes(item.profile.type)) {
    const bounds = item.pane.getBoundingClientRect();
    safe(() => call('graphics:bounds', item.id, { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, visible: !item.pane.hidden && !modal }))();
  }
}
api.on('terminal:data', ({ id, data }) => { const item = sessions.get(id); if (item?.terminal) { item.terminal.write(data); extras?.output(item, data); } });
api.on('terminal:exit', ({ id, code }) => { const item = sessions.get(id); if (item) { item.ended = true; item.terminal.writeln(`\r\n\x1b[90m[Sessão encerrada: ${code}]\x1b[0m`); renderTabs(); } });
api.on('graphics:data', ({ id, data }) => { const item = sessions.get(id); if (item?.channel) item.channel.onmessage?.({ data: Uint8Array.from(atob(data), char => char.charCodeAt(0)).buffer }); });
api.on('graphics:state', ({ id, type, message }) => {
  const item = sessions.get(id);
  if (message) toast(message);
  if (type === 'close' && item) { item.ended = true; item.channel?.onclose?.({ code: 1000, reason: '', wasClean: true }); renderTabs(); }
});
new ResizeObserver(layout).observe($('workspace'));

async function loadFiles(directory = fileState.path) {
  $('file-status').textContent = 'Carregando…';
  try {
    const result = await call('files:list', fileState.kind, fileState.id, directory);
    fileState.path = result.path; fileState.parent = result.parent; $('file-path').value = result.path; $('file-list').replaceChildren();
    result.rows.sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name));
    for (const entry of result.rows) {
      const row = elem('div', '', 'file-row'); const open = button(`${entry.directory ? '▸' : '·'} ${entry.name}`, () => entry.directory ? loadFiles(entry.path) : editFile(entry), 'file-open'); open.title = entry.name; row.append(open);
      if (entry.directory && fileState.kind !== 'local') row.append(button('↓', () => extras.downloadFolder(entry)));
      if (!entry.directory) { row.append(elem('small', entry.size > 1048576 ? `${(entry.size / 1048576).toFixed(1)} M` : `${Math.ceil(entry.size / 1024)} K`)); if (fileState.kind !== 'local') row.append(button('↓', async () => { toast('Baixando arquivo…'); const result = await call('files:transfer', fileState.kind, fileState.id, 'download', entry.path); if (result) toast(`Salvo: ${result}`); })); }
      if (fileState.kind !== 'ftp') row.append(button('⋯', () => fileActions(entry)));
      $('file-list').append(row);
    }
    $('file-status').textContent = `${result.rows.length} itens · ${fileState.kind.toUpperCase()}`;
  } catch (error) { $('file-status').textContent = error.message; throw error; }
}
async function fileActions(entry) {
  const result = await form({ title: entry.name, fields: [{ name: 'action', label: 'Ação', options: [{ value: 'rename', label: 'Renomear' }, { value: 'delete', label: 'Excluir arquivo ou pasta vazia' }] }] });
  if (!result) return;
  let destination;
  if (result.action === 'rename') {
    const answer = await form({ title: 'Renomear', fields: [{ name: 'name', label: 'Novo nome', value: entry.name, required: true, wide: true }] });
    if (!answer) return; if (/[\\/]/.test(answer.name) || ['.', '..'].includes(answer.name)) throw new Error('Informe apenas o nome, sem pastas.');
    destination = joinFilePath(answer.name);
  } else if (!await form({ title: 'Excluir permanentemente?', message: entry.path, fields: [], accept: 'Excluir' })) return;
  await call('files:change', fileState.kind, fileState.id, result.action, entry.path, destination); await loadFiles();
}
function joinFilePath(name) { return fileState.path.replace(/[\\/]$/, '') + (fileState.kind === 'local' ? '\\' : '/') + name; }
async function editFile(entry) {
  const content = await call('files:read', fileState.kind, fileState.id, entry.path);
  editor = { ...fileState, filename: entry.path, original: content };
  $('editor-title').textContent = entry.name; $('editor-text').value = content; $('editor-dialog').showModal(); updateNativeBounds();
}
$('editor-save').onclick = safe(async () => {
  const latest = await call('files:read', editor.kind, editor.id, editor.filename);
  if (latest !== editor.original && !await form({ title: 'Arquivo alterado fora do editor', message: 'Substituir o conteúdo atual no disco/servidor?', fields: [], accept: 'Substituir' })) return;
  await call('files:write', editor.kind, editor.id, editor.filename, $('editor-text').value); editor.original = $('editor-text').value; toast('Arquivo salvo.');
});
async function closeEditor() { if (editor && $('editor-text').value !== editor.original && !await form({ title: 'Descartar alterações?', fields: [], accept: 'Descartar' })) return; $('editor-dialog').close(); editor = null; updateNativeBounds(); }
$('editor-close').onclick = safe(closeEditor); $('editor-dialog').addEventListener('cancel', event => { event.preventDefault(); safe(closeEditor)(); });
async function setFileMode(kind) {
  if (kind === 'sftp') { const item = current(); if (!['ssh', 'ssh-x11'].includes(item?.profile.type) || item.ended) throw new Error('Selecione uma aba SSH ativa.'); fileState.id = item.id; }
  if (kind === 'ftp') {
    const options = await form({ title: 'FTP / FTPS', fields: [{ name: 'host', label: 'Servidor', required: true }, { name: 'port', label: 'Porta', type: 'number', value: 21 }, { name: 'username', label: 'Usuário', value: 'anonymous' }, { name: 'secure', label: 'Usar TLS (FTPS explícito)', type: 'checkbox', value: true }] });
    if (!options) return; fileState.id = await call('files:ftp', options);
  }
  fileState.kind = kind; extras?.fileMode(kind); fileState.path = kind === 'local' ? state.home : kind === 'sftp' ? '.' : '/';
  for (const type of ['local', 'sftp', 'ftp']) $('files-' + type).classList.toggle('selected', kind === type);
  $('files-upload').hidden = kind === 'local'; $('files-mkdir').hidden = kind === 'ftp'; await loadFiles();
}
$('toggle-files').onclick = safe(async () => { $('file-panel').hidden = !$('file-panel').hidden; layout(); if (!$('file-panel').hidden) await loadFiles(fileState.path || state.home); });
$('close-files').onclick = () => { $('file-panel').hidden = true; layout(); };
for (const kind of ['local', 'sftp', 'ftp']) $('files-' + kind).onclick = safe(() => setFileMode(kind));
$('files-up').onclick = safe(() => loadFiles(fileState.parent)); $('files-refresh').onclick = safe(() => loadFiles());
$('file-path').onkeydown = event => { if (event.key === 'Enter') safe(() => loadFiles(event.target.value))(); };
$('files-upload').onclick = safe(async () => { toast('Preparando envio…'); const result = await call('files:transfer', fileState.kind, fileState.id, 'upload', fileState.path); if (result) { toast('Transferência concluída.'); await loadFiles(); } });
$('files-mkdir').onclick = safe(async () => { const result = await form({ title: 'Nova pasta', fields: [{ name: 'name', label: 'Nome', required: true, wide: true }] }); if (!result) return; if (/[\\/]/.test(result.name) || ['.', '..'].includes(result.name)) throw new Error('Nome inválido.'); await call('files:change', fileState.kind, fileState.id, 'mkdir', joinFilePath(result.name)); await loadFiles(); });

function renderSnippets() {
  $('snippets').replaceChildren();
  for (const snippet of state.config.snippets) $('snippets').append(button(snippet.name, async () => {
    const answer = await form({ title: snippet.name, message: 'Inserir no terminal ativo sem pressionar Enter.', fields: [{ name: 'command', label: 'Comando', type: 'textarea', value: snippet.command, wide: true }, { name: 'remove', label: 'Excluir este comando rápido', type: 'checkbox', wide: true }], accept: 'Aplicar' });
    if (!answer) return;
    if (answer.remove) { state.config.snippets = await call('snippets:save', state.config.snippets.filter(s => s !== snippet)); renderSnippets(); return; }
    const item = current(); if (!item?.terminal) throw new Error('Abra um terminal.'); item.terminal.paste(answer.command); item.terminal.focus();
  }));
}
$('add-snippet').onclick = safe(async () => { const answer = await form({ title: 'Novo comando rápido', message: 'Guarde comandos reutilizáveis. Não inclua senhas.', fields: [{ name: 'name', label: 'Nome', required: true, wide: true }, { name: 'command', label: 'Comando', type: 'textarea', required: true, wide: true }] }); if (answer) { state.config.snippets = await call('snippets:save', [...state.config.snippets, answer]); renderSnippets(); } });
$('broadcast').onclick = safe(async () => {
  const targets = [...sessions.values()].filter(s => s.terminal && !s.ended);
  if (!targets.length) throw new Error('Abra terminais para usar multiexecução.');
  const answer = await form({ title: 'Executar em várias sessões', message: 'Selecione explicitamente os destinos. O comando será executado com Enter.', fields: [{ name: 'command', label: 'Comando', type: 'textarea', required: true, wide: true }, ...targets.map(s => ({ name: s.id, label: s.name, type: 'checkbox', value: false, wide: true }))], accept: 'Executar nos selecionados' });
  if (!answer) return; for (const item of targets) if (answer[item.id]) await call('terminal:write', item.id, answer.command + '\r');
});

async function services() {
  $('active-services').replaceChildren();
  for (const item of await call('network:list')) { const row = elem('div', item.name); row.append(button('Parar', async () => { await call('network:stop', item.id); await services(); })); $('active-services').append(row); }
}
function tool(name, detail, action) { const el = button(name, async () => { try { const result = await action(); if (result !== undefined && result !== null) $('tools-output').textContent = typeof result === 'string' ? result : JSON.stringify(result, null, 2); await services(); } catch (error) { $('tools-output').textContent = error.message; throw error; } }); el.append(elem('small', detail)); $('tool-grid').append(el); }
for (const [name, label] of [['ping', 'Ping'], ['dns', 'Consulta DNS'], ['trace', 'Traceroute'], ['tcp', 'Teste TCP']]) tool(label, 'Diagnóstico de um destino', async () => {
  const result = await form({ title: label, fields: [{ name: 'host', label: 'Host / IP', value: '', required: true, wide: name !== 'tcp' }, ...(name === 'tcp' ? [{ name: 'port', label: 'Porta', type: 'number', value: 22 }] : [])] });
  if (result) { $('tools-output').textContent = 'Executando…'; return call('network:diagnostic', { ...result, tool: name }); }
});
tool('Túnel SSH local', 'Encaminhamento por sessão ativa', async () => {
  const options = [...sessions.values()].filter(s => s.profile.type === 'ssh' && !s.ended).map(s => ({ value: s.id, label: s.name })); if (!options.length) throw new Error('Abra uma sessão SSH primeiro.');
  const result = await form({ title: 'Novo túnel SSH', fields: [{ name: 'session', label: 'Sessão', options, wide: true }, { name: 'localPort', label: 'Porta local (127.0.0.1)', type: 'number', value: 13389 }, { name: 'host', label: 'Destino visto pelo SSH', value: '127.0.0.1' }, { name: 'port', label: 'Porta de destino', type: 'number', value: 3389 }] }); if (result) return call('network:tunnel', result);
});
tool('Servidor HTTP local', 'Compartilhar pasta em localhost', async () => {
  const directory = await call('select:folder'); if (!directory) return;
  const result = await form({ title: 'Servidor HTTP', message: directory + '\nSomente leitura. Restrito a 127.0.0.1. Para abrir a raiz, inclua um index.html.', fields: [{ name: 'port', label: 'Porta local', type: 'number', value: 8080, wide: true }], accept: 'Iniciar' }); if (result) return call('network:serve', { ...result, directory });
});
tool('SHA-256', 'Calcular hash de arquivo', () => call('tools:hash'));
tool('Gerar chave SSH', 'RSA 3072 protegida por frase secreta', () => call('tools:keygen'));
tool('Portas seriais', 'Listar dispositivos COM', () => call('serial:list'));
tool('Exportar sessões', 'Backup JSON sem credenciais', async () => (await call('config:export')) ? 'Backup salvo. Senhas não são exportadas.' : undefined);
tool('Importar sessões', 'Adicionar perfis de backup JSON', async () => { const result = await call('config:import'); if (result) { state.config = result; renderProfiles(); return 'Sessões importadas.'; } });
tool('Ajuda rápida', 'Primeiros passos e recursos disponíveis', () => 'Para começar, abra o PowerShell ou salve um servidor em Nova sessão. Clique no perfil para conectar.\n\nArquivos → SFTP usa a aba SSH selecionada. Para aplicativos Linux com interface gráfica, abra primeiro uma sessão Servidor X11 local e depois SSH com aplicativos X11.\n\nCtrl+Shift+T: novo terminal. Ctrl+Shift+F: buscar. Ctrl+Shift+C/V: copiar e colar. Ctrl+Shift+W: fechar aba.\n\nDisponíveis: SSH/SFTP, RDP, VNC, Telnet, serial 8N1, FTP/FTPS, X11/XDMCP, editor, túneis locais e diagnósticos. Git Bash e WSL precisam estar instalados no Windows.\n\nConsulte o LEIA-ME junto do programa para backup, solução de problemas e limites desta versão.');
$('open-tools').onclick = safe(async () => { $('tools-dialog').showModal(); updateNativeBounds(); await services(); });
$('tools-close').onclick = () => { $('tools-dialog').close(); updateNativeBounds(); };
$('tools-dialog').addEventListener('close', updateNativeBounds);
$('settings').onclick = safe(async () => {
  const lock = await call('lock:status');
  const values = await form({ title: 'Preferências', message: 'Dados locais: ' + state.dataPath, fields: [{ name: 'fontSize', label: 'Fonte do terminal', type: 'number', value: state.config.settings.fontSize, min: 10, max: 28 }, { name: 'theme', label: 'Tema', value: state.config.settings.theme, options: [{ value: 'dark', label: 'Escuro' }, { value: 'light', label: 'Claro' }, { value: 'dracula', label: 'Dracula' }, { value: 'nord', label: 'Nord' }, { value: 'solarized', label: 'Solarized escuro' }, { value: 'monokai', label: 'Monokai' }] }, { name: 'scrollback', label: 'Linhas no histórico', type: 'number', value: state.config.settings.scrollback }, { name: 'syncFolder', label: 'Pasta de sincronização (OneDrive, Dropbox, repositório Git…)', value: state.config.settings.syncFolder || '', wide: true }, { name: 'autocomplete', label: 'Sugerir comandos do histórico enquanto digito', type: 'checkbox', value: state.config.settings.autocomplete !== false, wide: true }, { name: 'restoreSessions', label: 'Reabrir as sessões ao iniciar o aplicativo', type: 'checkbox', value: !!state.config.settings.restoreSessions, wide: true },
    { name: 'lockPassword', label: lock.enabled ? 'Trocar a senha mestra (deixe vazio para manter; “remover” abaixo tira a proteção)' : 'Definir senha mestra (bloqueia a lista de sessões ao abrir o app)', type: 'password', wide: true },
    { name: 'autoLockMinutes', label: 'Bloquear automaticamente após (minutos, 0 = nunca)', type: 'number', value: lock.autoLockMinutes || 15, min: 0, max: 180 },
    ...(lock.enabled ? [{ name: 'removeLock', label: 'Remover a senha mestra (pede a senha atual)', type: 'checkbox', wide: true }] : []),
    { name: 'clear', label: 'Apagar senhas SSH guardadas', type: 'checkbox', wide: true }] });
  if (!values) return; state.config.settings = await call('settings:save', values); if (values.clear) await call('credentials:clear');
  if (values.removeLock) { const answer = await form({ title: 'Remover senha mestra', fields: [{ name: 'password', label: 'Senha mestra atual', type: 'password', required: true, wide: true }] }); if (answer) { await call('lock:clear', answer.password); $('lock-now').hidden = true; } }
  else if (values.lockPassword) { await call('lock:set', { password: values.lockPassword, autoLockMinutes: values.autoLockMinutes }); $('lock-now').hidden = false; toast('Senha mestra definida.'); }
  else if (lock.enabled) await call('lock:autolock', values.autoLockMinutes);
  applySettings();
});
$('lock-now').onclick = safe(() => unlockOverlay());
function applySettings() { const t = state.config.settings.theme; document.body.classList.toggle('light', t === 'light'); for (const name of ['dark', 'dracula', 'nord', 'solarized', 'monokai']) document.body.classList.toggle('t-' + name, t === name); for (const item of sessions.values()) if (item.terminal) { item.terminal.options.fontSize = state.config.settings.fontSize; item.terminal.options.theme = theme(); item.terminal.options.scrollback = state.config.settings.scrollback; } layout(); }
$('new-session').onclick = safe(() => sessionForm()); $('welcome-ssh').onclick = safe(() => sessionForm());
for (const id of ['local-shell', 'add-tab', 'welcome-local']) $(id).onclick = safe(() => openSession(localProfile()));
$('filter-sessions').oninput = renderProfiles;
// Conexão rápida: [usuário@]servidor[:porta], sem formulário. RDP por padrão; ssh://, rdp://, vnc:// e telnet:// escolhem o protocolo.
$('quick-go').onclick = safe(async () => {
  let text = $('quick-input').value.trim(); if (!text) return;
  let type = $('quick-type').value; const scheme = text.match(/^(rdp|ssh|vnc|telnet):\/\//i); if (scheme) { type = scheme[1].toLowerCase(); text = text.slice(scheme[0].length); }
  const match = text.match(/^(?:([^@\s]+)@)?([A-Za-z0-9._%-]+)(?::(\d{1,5}))?$/); if (!match) throw new Error('Use o formato usuário@servidor ou servidor:porta.');
  const [, username = '', host, port = ''] = match;
  await openSession({ type, name: host, group: 'Conexões rápidas', host, port, username });
  $('quick-input').value = '';
});
$('quick-input').onkeydown = event => { if (event.key === 'Enter') $('quick-go').click(); };
$('split').onclick = () => { split = !split; layout(); };
$('find').onclick = () => { $('findbar').hidden = !$('findbar').hidden; $('find-input').focus(); layout(); };
$('find-close').onclick = () => { $('findbar').hidden = true; layout(); };
$('find-next').onclick = () => current()?.search?.findNext($('find-input').value);
$('find-prev').onclick = () => current()?.search?.findPrevious($('find-input').value);
$('find-input').oninput = () => current()?.search?.findNext($('find-input').value);
$('find-input').onkeydown = event => { if (event.key === 'Enter') current()?.search?.findNext(event.target.value); };
$('log').onclick = safe(async () => { const item = current(); if (!item?.terminal) throw new Error('Selecione um terminal.'); item.logging = await call('terminal:log', item.id); renderTabs(); });
$('reconnect').onclick = safe(async () => { const item = current(); if (item) { const p = item.profile; await closeSession(item.id); if (!sessions.has(item.id)) await openSession(p); } });
$('import-system').onclick = safe(async () => {
  const found = await call('import:scan'); const rows = [...found.putty, ...found.sshConfig];
  if (!rows.length) { toast('Nenhuma sessão encontrada no PuTTY ou em ~/.ssh/config.'); return; }
  const answer = await form({ title: `Importar ${rows.length} sessão(ões)`, message: 'Revise antes de importar. Senhas nunca são lidas nem importadas.', fields: rows.map((r, i) => ({ name: String(i), label: `${r.name} — ${r.username ? r.username + '@' : ''}${r.host}:${r.port} (${r.group})`, type: 'checkbox', value: true, wide: true })), accept: 'Importar selecionadas' });
  if (!answer) return; const chosen = rows.filter((_, i) => answer[String(i)]);
  if (!chosen.length) return; state.config = await call('import:apply', chosen); renderProfiles(); toast(`${chosen.length} sessão(ões) importada(s).`);
});
$('import-sessions').onclick = safe(async () => { const result = await call('config:import'); if (result) { state.config = result; renderProfiles(); } });
document.addEventListener('keydown', event => {
  if (!event.ctrlKey || !event.shiftKey || document.querySelector('dialog[open]')) return;
  if (event.code === 'KeyT') { event.preventDefault(); safe(() => openSession(localProfile()))(); }
  if (event.code === 'KeyF') { event.preventDefault(); $('find').click(); }
  if (event.code === 'KeyW' && activeId) { event.preventDefault(); safe(() => closeSession(activeId))(); }
});
extras = setup({ $, api, call, form, toast, safe, elem, button, sessions, state: () => state, current, tool, fileState, reloadFiles: directory => loadFiles(directory), refresh: () => { renderProfiles(); renderSnippets(); applySettings(); } });
setupPackages({ $, api, call, form, toast, safe, elem, button, state: () => state, updateNativeBounds });
async function init() { state = await call('init'); state.secrets = await call('profile:secrets'); $('version').textContent = state.version; fileState.path = state.home; $('files-upload').hidden = true; renderProfiles(); renderSnippets(); applySettings(); }
async function restoreOpenSessions() {
  if (!state.config.settings.restoreSessions) return;
  const list = await call('session:loadOpen'); if (!list.length) return;
  toast(`Reabrindo ${list.length} sessão(ões)…`);
  for (const item of list) { try { await openSession(item.profile); } catch (error) { toast(`Não foi possível reabrir “${item.profile.name}”: ${error.message}`); } }
}
async function unlockOverlay() {
  for (;;) {
    const answer = await form({ title: 'Stanis Terminal bloqueado', message: 'Digite a senha mestra para continuar.', fields: [{ name: 'password', label: 'Senha mestra', type: 'password', required: true, wide: true }], accept: 'Desbloquear', noCancel: true });
    if (answer && await call('lock:check', answer.password)) return;
    toast('Senha incorreta.');
  }
}
let idleTimer;
function armAutoLock(minutes) {
  clearTimeout(idleTimer); if (!minutes) return;
  const reset = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => safe(() => unlockOverlay())(), minutes * 60000); };
  for (const type of ['mousemove', 'mousedown', 'keydown']) document.addEventListener(type, reset, { passive: true });
  reset();
}
async function boot() {
  const lock = await call('lock:status');
  if (lock.enabled) { await unlockOverlay(); armAutoLock(lock.autoLockMinutes); }
  $('lock-now').hidden = !lock.enabled;
  await init(); await restoreOpenSessions();
}
safe(boot)();
