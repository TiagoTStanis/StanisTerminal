// Recursos extras da interface: digitação em vários painéis, macros, histórico com sugestões,
// fila de transferências, servidores locais, túneis SOCKS/remotos e sincronização por pasta.
import { runLua } from './lua.js';
const PASSWORD_PROMPT = /(pass(word|phrase)?|senha|secret|token|pin|c[oó]digo|verification)[^\n]*[:?]\s*$/i;

export function setup(ctx) {
  const { $, api, call, form, toast, safe, elem, button, sessions, state, current, tool } = ctx;
  const live = { broadcast: false, recording: null, history: [], transfers: [] };

  // ---------- Histórico e sugestões ----------
  call('history:load').then(list => { live.history = Array.isArray(list) ? list : []; }).catch(() => {});
  let saveTimer;
  const saveHistory = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => safe(async () => { live.history = await call('history:save', live.history); })(), 1500); };
  const sensitive = item => PASSWORD_PROMPT.test(item.tail || '');
  const autocompleteOn = () => state().config.settings.autocomplete !== false;

  function suggestions(item) {
    const line = item.line || ''; if (!autocompleteOn() || line.length < 2) return [];
    const lower = line.toLowerCase();
    const fromSnippets = (state().config.snippets || []).map(s => s.command.split('\n')[0]);
    const pool = [...live.history].reverse().concat(fromSnippets);
    return [...new Set(pool.filter(c => c.toLowerCase().startsWith(lower) && c !== line))].slice(0, 5);
  }
  function renderSuggest(item) {
    if (!item.suggestEl) { item.suggestEl = elem('div', '', 'suggest'); item.suggestEl.hidden = true; item.pane.append(item.suggestEl); }
    const list = suggestions(item); item.suggestEl.replaceChildren(); item.suggestEl.hidden = !list.length;
    for (const command of list) item.suggestEl.append(button(command, () => accept(item, command), 'suggest-item'));
    if (list.length) item.suggestEl.append(elem('small', 'Ctrl+Espaço aceita a primeira'));
  }
  function accept(item, command) {
    const rest = command.slice(item.line.length); if (!rest) return;
    call('terminal:write', item.id, rest); item.line = command; renderSuggest(item); item.terminal?.focus();
  }
  function track(item, data) {
    // Mantém uma cópia aproximada da linha digitada; sequências de escape (setas etc.) invalidam a linha.
    data = data.replace(/\x1b\[(?:I|O|200~|201~)/g, ''); // relato de foco e marcadores de colagem não editam a linha
    for (const ch of data) {
      if (ch === '\r' || ch === '\n') {
        const line = (item.line || '').trim();
        if (line && !item.lineDirty && !item.lineSensitive) {
          live.history = live.history.filter(x => x !== line).concat(line).slice(-2000); saveHistory();
          if (live.recording) live.recording.steps.push({ text: line, delay: Math.min(10000, Date.now() - live.recording.last) }), live.recording.last = Date.now();
        } else if (live.recording && item.lineSensitive) toast('Entrada de senha ignorada na gravação da macro.');
        item.line = ''; item.lineDirty = false; item.lineSensitive = false;
      } else if (ch === '\x7f' || ch === '\b') item.line = (item.line || '').slice(0, -1);
      else if (ch === '\x03' || ch === '\x15' || ch === '\x04') { item.line = ''; item.lineDirty = false; }
      else if (ch === '\x1b') item.lineDirty = true;
      else if (ch >= ' ' && !item.lineDirty) { if (!item.line) item.lineSensitive = sensitive(item); item.line = (item.line || '') + ch; }
    }
    if (item.terminal) renderSuggest(item);
  }
  // Guarda o fim da saída sem sequências de controle para reconhecer pedidos de senha.
  function output(item, data) {
    const clean = data.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x09\x0b-\x1f]/g, '');
    item.tail = ((item.tail || '') + clean).slice(-200); item.buf = ((item.buf || '') + clean).slice(-20000);
    for (const waiter of [...(item.waiters || [])]) if (item.buf.includes(waiter.text)) { item.waiters.delete(waiter); waiter.resolve(true); }
  }

  // Chamado pelo terminal em cada digitação: envia, alimenta histórico/macro e replica quando "Digitar em todos" está ativo.
  function input(item, data) {
    const targets = live.broadcast ? [...sessions.values()].filter(s => s.terminal && !s.ended && !s.pane.hidden) : [item];
    if (!targets.includes(item)) targets.push(item);
    for (const target of targets) call('terminal:write', target.id, data);
    track(item, data);
  }
  function key(item, event) {
    if (event.ctrlKey && !event.shiftKey && event.code === 'Space') { const first = suggestions(item)[0]; if (first) accept(item, first); return true; }
    if (event.ctrlKey && event.shiftKey && event.code === 'KeyH') { safe(() => historyDialog(item))(); return true; }
    return false;
  }
  async function historyDialog(item) {
    const answer = await form({ title: 'Histórico de comandos', message: 'Comandos digitados neste aplicativo (senhas nunca são gravadas). O escolhido é inserido sem pressionar Enter.', fields: [
      { name: 'filter', label: 'Filtro (opcional)', wide: true },
      { name: 'command', label: 'Comando', wide: true, options: [...live.history].reverse().slice(0, 200).map(c => ({ value: c, label: c.slice(0, 120) })) },
      { name: 'clear', label: 'Apagar todo o histórico', type: 'checkbox', wide: true }], accept: 'Inserir' });
    if (!answer) return;
    if (answer.clear) { live.history = await call('history:save', []); toast('Histórico apagado.'); return; }
    if (answer.command && item?.terminal) { item.terminal.paste(answer.command); item.terminal.focus(); }
  }

  // ---------- Digitar em todos os painéis visíveis ----------
  const liveButton = button('Digitar em todos', () => {
    live.broadcast = !live.broadcast; liveButton.classList.toggle('on', live.broadcast);
    liveButton.textContent = live.broadcast ? '● Digitando em todos' : 'Digitar em todos';
    toast(live.broadcast ? 'Tudo o que você digitar vai para os painéis visíveis. Use Dividir para escolher quais.' : 'Digitação simultânea desligada.');
  });
  liveButton.id = 'broadcast-live'; liveButton.classList.add('term-only'); $('broadcast').after(liveButton);

  // ---------- Macros ----------
  const macros = () => state().config.macros || (state().config.macros = []);
  async function playMacro(macro, item) {
    if (!item?.terminal || item.ended) throw new Error('Selecione um terminal ativo.');
    const ok = await form({ title: `Executar macro “${macro.name}”?`, message: 'Os comandos abaixo serão digitados e executados no terminal ativo.', fields: [{ name: 'preview', label: 'Passos', type: 'textarea', value: macro.steps.map(s => s.text).join('\n'), wide: true }], accept: 'Executar' });
    if (!ok) return;
    for (const step of macro.steps) { await new Promise(r => setTimeout(r, Math.max(150, Math.min(step.delay, 5000)))); if (item.ended) break; await call('terminal:write', item.id, step.text + '\r'); }
    toast(`Macro “${macro.name}” concluída.`);
  }
  const macroButton = button('Macros', async () => {
    if (live.recording) {
      const rec = live.recording; live.recording = null; macroButton.textContent = 'Macros'; macroButton.classList.remove('on');
      if (!rec.steps.length) { toast('Nenhum comando gravado.'); return; }
      const named = await form({ title: 'Salvar macro', message: `${rec.steps.length} comandos gravados.`, fields: [{ name: 'name', label: 'Nome', required: true, wide: true }] });
      if (named) { state().config.macros = await call('macros:save', [...macros(), { name: named.name, steps: rec.steps }]); toast('Macro salva.'); }
      return;
    }
    const list = macros();
    const answer = await form({ title: 'Macros', fields: [{ name: 'action', label: 'Ação', wide: true, options: [{ value: 'record', label: 'Gravar nova macro' }, ...list.flatMap((m, i) => [{ value: 'play:' + i, label: `Executar: ${m.name} (${m.steps.length} passos)` }, { value: 'delete:' + i, label: `Excluir: ${m.name}` }])] }] });
    if (!answer) return;
    if (answer.action === 'record') { live.recording = { steps: [], last: Date.now() }; macroButton.textContent = '● Parar gravação'; macroButton.classList.add('on'); toast('Gravando: digite os comandos e clique de novo para parar.'); return; }
    const [op, index] = answer.action.split(':'); const macro = list[Number(index)];
    if (op === 'play') await playMacro(macro, current());
    if (op === 'delete') state().config.macros = await call('macros:save', list.filter((_, i) => i !== Number(index)));
  });
  macroButton.id = 'macros'; macroButton.classList.add('term-only'); liveButton.after(macroButton);

  // ---------- Scripts Lua (locais, em sandbox) ----------
  const scripts = () => state().config.scripts || (state().config.scripts = []);
  const HELP = '-- API: send(texto)  sendln(texto)  wait(ms)  expect(texto, ms) -> true/false  log(texto)\n-- Sem acesso a arquivos, rede ou sistema. Limite de instruções e de memória.\nsendln("whoami")\nif expect("$", 5000) then log("pronto") end\n';
  let running = null;
  async function runScript(script, item) {
    if (running) throw new Error('Já existe um script em execução. Cancele-o antes.');
    if (!item?.terminal || item.ended) throw new Error('Selecione um terminal ativo.');
    const ok = await form({ title: `Executar “${script.name}”?`, message: 'O script vai digitar e executar comandos no terminal ativo. Confira o código.', fields: [{ name: 'code', label: 'Código Lua', type: 'textarea', value: script.code, wide: true }], accept: 'Executar' });
    if (!ok) return;
    const controller = new AbortController(); running = controller; scriptButton.textContent = '● Cancelar script'; scriptButton.classList.add('on');
    const terminalApi = {
      send: text => item.ended ? Promise.reject(new Error('A sessão terminou.')) : call('terminal:write', item.id, text),
      expect: (text, timeout) => new Promise(resolve => {
        item.waiters ||= new Set(); item.buf = '';
        const waiter = { text, resolve }; item.waiters.add(waiter);
        setTimeout(() => { if (item.waiters.delete(waiter)) resolve(false); }, timeout);
      }),
      log: message => toast(`[${script.name}] ${message}`)
    };
    try { await runLua(ok.code, terminalApi, controller.signal); toast(`Script “${script.name}” concluído.`); }
    finally { running = null; scriptButton.textContent = 'Scripts'; scriptButton.classList.remove('on'); }
  }
  const scriptButton = button('Scripts', async () => {
    if (running) { running.abort(); return; }
    const list = scripts();
    const answer = await form({ title: 'Scripts Lua', message: 'Automação local. Nada sai deste computador.', fields: [{ name: 'action', label: 'Ação', wide: true, options: [{ value: 'new', label: 'Novo script' }, ...list.flatMap((s, i) => [{ value: 'run:' + i, label: `Executar: ${s.name}` }, { value: 'edit:' + i, label: `Editar: ${s.name}` }, { value: 'delete:' + i, label: `Excluir: ${s.name}` }])] }] });
    if (!answer) return;
    const save = async (index, value) => { const next = [...list]; if (index === null) next.push(value); else next[index] = value; state().config.scripts = await call('scripts:save', next); toast('Script salvo.'); };
    if (answer.action === 'new') { const v = await form({ title: 'Novo script Lua', fields: [{ name: 'name', label: 'Nome', required: true, wide: true }, { name: 'code', label: 'Código', type: 'textarea', value: HELP, wide: true }], accept: 'Salvar' }); if (v) await save(null, v); return; }
    const [op, index] = answer.action.split(':'); const script = list[Number(index)];
    if (op === 'run') await runScript(script, current());
    if (op === 'edit') { const v = await form({ title: 'Editar script', fields: [{ name: 'name', label: 'Nome', value: script.name, required: true, wide: true }, { name: 'code', label: 'Código', type: 'textarea', value: script.code, wide: true }], accept: 'Salvar' }); if (v) await save(Number(index), v); }
    if (op === 'delete') state().config.scripts = await call('scripts:save', list.filter((_, i) => i !== Number(index)));
  });
  scriptButton.id = 'scripts'; scriptButton.classList.add('term-only'); macroButton.after(scriptButton);

  // ---------- Painel de arquivos que acompanha o terminal (OSC 7) ----------
  let follow = false;
  const followButton = button('Seguir terminal', () => {
    follow = !follow; followButton.classList.toggle('on', follow);
    toast(follow ? 'O painel SFTP vai abrir a pasta atual do terminal SSH. Se nada acontecer, use “Ativar rastreio” e cole a linha no servidor.' : 'O painel deixou de seguir o terminal.');
  });
  const trackButton = button('Ativar rastreio', async () => {
    const item = current(); if (!item?.terminal || item.ended) throw new Error('Selecione um terminal ativo.');
    const line = 'PROMPT_COMMAND=\'printf "\\033]7;file://%s%s\\007" "$HOSTNAME" "$PWD"\'';
    const ok = await form({ title: 'Ativar rastreio de pasta (bash/zsh)', message: 'Esta linha faz o shell informar a pasta atual a cada comando. Ela será colada no terminal sem executar; confira e pressione Enter.', fields: [{ name: 'line', label: 'Linha', type: 'textarea', value: line, wide: true }], accept: 'Colar' });
    if (ok) { item.terminal.paste(ok.line); item.terminal.focus(); }
  });
  followButton.id = 'files-follow'; trackButton.id = 'files-track'; $('files-upload').after(followButton, trackButton);
  function attach(item) {
    item.terminal.parser.registerOscHandler(7, data => {
      try {
        if (data.length > 4096) return true; const url = new URL(data); if (url.protocol !== 'file:') return true;
        item.cwd = decodeURIComponent(url.pathname);
        if (follow && !$('file-panel').hidden && ctx.fileState.kind === 'sftp' && ctx.fileState.id === item.id && item.cwd !== ctx.fileState.path) safe(() => ctx.reloadFiles(item.cwd))();
      } catch { /* sequência inválida: ignorar */ }
      return true;
    });
  }

  // ---------- Fila de transferências e pastas ----------
  const panel = elem('div', '', 'transfers'); panel.hidden = true; $('file-status').before(panel);
  function renderTransfers() {
    panel.replaceChildren(); panel.hidden = !live.transfers.length; if (!live.transfers.length) return;
    const head = elem('div', 'TRANSFERÊNCIAS', 'transfers-head'); head.append(button('Limpar', () => call('transfer:clear'))); panel.append(head);
    for (const job of live.transfers.slice(-8)) {
      const row = elem('div', '', 'transfer ' + job.status.replace(/\s/g, '-'));
      row.append(elem('span', `${job.direction === 'upload' ? '↑' : '↓'} ${job.name}`, 'transfer-name'));
      row.append(elem('small', job.error ? `${job.status}: ${job.error}` : job.total > 1 ? `${job.status} ${job.done}/${job.total}` : job.status));
      if (['na fila', 'enviando', 'baixando'].includes(job.status)) row.append(button('✕', () => call('transfer:cancel', job.id)));
      panel.append(row);
    }
  }
  api.on('transfer:state', list => {
    const before = live.transfers; live.transfers = list; renderTransfers();
    const finished = list.some(j => j.status === 'concluída' && !before.some(b => b.id === j.id && b.status === 'concluída'));
    if (finished) safe(() => ctx.reloadFiles())();
  });
  const uploadFolder = button('Enviar pasta', async () => { const fs_ = ctx.fileState; if (fs_.kind === 'local') throw new Error('Escolha SFTP ou FTP para enviar pastas.'); await call('transfer:folder', fs_.kind, fs_.id, 'upload', fs_.path); toast('Pasta na fila de transferência.'); });
  uploadFolder.id = 'files-upload-folder'; $('files-upload').after(uploadFolder);
  ctx.setFileMode = kind => { uploadFolder.hidden = kind === 'local'; followButton.hidden = trackButton.hidden = kind !== 'sftp'; };
  uploadFolder.hidden = followButton.hidden = trackButton.hidden = true;
  ctx.downloadFolder = entry => { const fs_ = ctx.fileState; return call('transfer:folder', fs_.kind, fs_.id, 'download', entry.path).then(id => id && toast('Pasta na fila de transferência.')); };

  // Arrastar arquivos e pastas do Explorer para a lista envia por SFTP/FTP.
  const dropZone = $('file-list');
  dropZone.addEventListener('dragover', event => { event.preventDefault(); dropZone.classList.add('drop'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drop'));
  dropZone.addEventListener('drop', safe(async event => {
    event.preventDefault(); dropZone.classList.remove('drop'); const fs_ = ctx.fileState;
    if (fs_.kind === 'local') throw new Error('Abra SFTP ou FTP para enviar arquivos arrastados.');
    const files = [...event.dataTransfer.files].slice(0, 50); if (!files.length) return;
    if (!await form({ title: `Enviar ${files.length} item(ns)?`, message: `Destino: ${fs_.path}\n${files.map(f => f.name).join('\n')}`, fields: [], accept: 'Enviar' })) return;
    for (const file of files) call('transfer:add', { kind: fs_.kind, id: fs_.id, direction: 'upload', local: api.pathFor(file), remote: fs_.path.replace(/\/$/, '') + '/' + file.name }).catch(error => toast(error.message));
  }));

  // ---------- Ferramentas: túneis e servidores ----------
  const sshSessions = () => [...sessions.values()].filter(s => ['ssh', 'ssh-x11'].includes(s.profile.type) && !s.ended).map(s => ({ value: s.id, label: s.name }));
  tool('Proxy SOCKS5 (ssh -D)', 'Túnel dinâmico pela sessão SSH', async () => {
    const options = sshSessions(); if (!options.length) throw new Error('Abra uma sessão SSH primeiro.');
    const result = await form({ title: 'Proxy SOCKS5 dinâmico', message: 'Configure o navegador ou aplicativo para usar SOCKS5 em 127.0.0.1 na porta abaixo.', fields: [{ name: 'session', label: 'Sessão', options, wide: true }, { name: 'localPort', label: 'Porta local', type: 'number', value: 1080, wide: true }], accept: 'Iniciar' });
    if (result) return call('network:socks', result);
  });
  tool('Túnel SSH remoto (ssh -R)', 'Expor uma porta local no servidor', async () => {
    const options = sshSessions(); if (!options.length) throw new Error('Abra uma sessão SSH primeiro.');
    const result = await form({ title: 'Túnel remoto', message: 'O servidor SSH passa a escutar em 127.0.0.1:porta remota e encaminha para o destino visto por este computador.', fields: [{ name: 'session', label: 'Sessão', options, wide: true }, { name: 'remotePort', label: 'Porta no servidor', type: 'number', value: 8080 }, { name: 'host', label: 'Destino local', value: '127.0.0.1' }, { name: 'port', label: 'Porta de destino', type: 'number', value: 3000 }], accept: 'Iniciar' });
    if (result) return call('network:remote', result);
  });
  for (const [kind, label, detail, defaultPort] of [['tftp', 'Servidor TFTP', 'UDP, para gravar firmware/configs de equipamentos', 6969], ['ftp', 'Servidor FTP', 'Anônimo, somente em 127.0.0.1', 2121], ['sftp', 'Servidor SFTP', 'Usuário e senha, sem shell', 2222]]) {
    tool(label, detail, async () => {
      const directory = await call('select:folder'); if (!directory) return;
      const fields = [{ name: 'port', label: 'Porta local', type: 'number', value: defaultPort, wide: kind !== 'sftp' }, { name: 'writable', label: 'Permitir receber arquivos novos (nunca sobrescreve)', type: 'checkbox', wide: true }];
      if (kind === 'sftp') fields.splice(1, 0, { name: 'username', label: 'Usuário', value: 'stanis', required: true }, { name: 'password', label: 'Senha (mínimo 8 caracteres)', type: 'password', required: true, wide: true });
      const result = await form({ title: label, message: `${directory}\nEscuta somente em 127.0.0.1 e é somente leitura por padrão.`, fields, accept: 'Iniciar' });
      if (result) return call('network:host', { ...result, kind, directory });
    });
  }
  tool('Varredura de portas', 'TCP connect, sem privilégio de administrador', async () => {
    const result = await form({ title: 'Varredura de portas', fields: [{ name: 'host', label: 'Host / IP', required: true, wide: true }, { name: 'ports', label: 'Portas (ex.: 1-1024 ou 22,80,443)', value: '1-1024', wide: true }] });
    if (!result) return; toast('Varrendo…'); const open = await call('network:portscan', result);
    return open.length ? `Portas abertas em ${result.host}: ${open.join(', ')}` : `Nenhuma porta aberta encontrada em ${result.host} no intervalo informado.`;
  });
  tool('Wake-on-LAN', 'Enviar pacote mágico para ligar um computador', async () => {
    const result = await form({ title: 'Wake-on-LAN', fields: [{ name: 'mac', label: 'Endereço MAC (AA:BB:CC:DD:EE:FF)', required: true, wide: true }, { name: 'broadcast', label: 'Endereço de broadcast', value: '255.255.255.255' }, { name: 'port', label: 'Porta', type: 'number', value: 9 }] });
    if (result) return call('network:wol', result);
  });
  tool('Espelhar pasta (local → servidor)', 'Envia alterações continuamente por SFTP; nunca apaga', async () => {
    const options = sshSessions(); if (!options.length) throw new Error('Abra uma sessão SSH primeiro.');
    const result = await form({ title: 'Espelho por SFTP', message: 'Depois você escolhe a pasta local. Arquivos novos e alterados são enviados sozinhos. Nada é apagado no servidor e arquivos mais novos lá não são sobrescritos.', fields: [{ name: 'session', label: 'Sessão', options, wide: true }, { name: 'remote', label: 'Pasta remota (caminho absoluto)', value: '/tmp/espelho', required: true, wide: true }], accept: 'Escolher pasta local' });
    if (result) return call('mirror:start', result);
  });
  tool('Enviar por ZMODEM (rz)', 'Canal SSH dedicado; não passa pelo terminal', async () => {
    const options = sshSessions(); if (!options.length) throw new Error('Abra uma sessão SSH primeiro.');
    const result = await form({ title: 'Enviar por ZMODEM', message: 'O servidor precisa ter “rz” (pacote lrzsz) instalado. Abre um canal separado da conexão; a sessão interativa continua livre.', fields: [{ name: 'session', label: 'Sessão', options, wide: true }], accept: 'Escolher arquivo' });
    if (!result) return; toast('Enviando…'); const sent = await call('zmodem:upload', result.session);
    return sent ? `Enviado: ${sent.file} (${sent.bytes} bytes).` : undefined;
  });
  tool('Baixar por ZMODEM (sz)', 'Canal SSH dedicado; não passa pelo terminal', async () => {
    const options = sshSessions(); if (!options.length) throw new Error('Abra uma sessão SSH primeiro.');
    const result = await form({ title: 'Baixar por ZMODEM', message: 'Informe o comando que o servidor deve executar (ex.: sz caminho/arquivo.log).', fields: [{ name: 'session', label: 'Sessão', options, wide: true }, { name: 'command', label: 'Comando remoto', value: 'sz ', required: true, wide: true }], accept: 'Escolher pasta de destino' });
    if (!result) return; toast('Baixando…'); const received = await call('zmodem:download', result.session, result.command);
    return received ? `Salvo: ${received.file} (${received.bytes} bytes).` : undefined;
  });
  tool('Servidor VNC (compartilhar esta tela)', 'TightVNC preso a 127.0.0.1; senha opcional', async () => {
    const result = await form({ title: 'Servidor VNC local', message: 'Escuta somente em 127.0.0.1: nada fica exposto na rede. Para outro computador ver a tela, use “Túnel SSH remoto” apontando para esta porta. Sem senha, qualquer programa desta conta Windows pode se conectar.', fields: [{ name: 'port', label: 'Porta local', type: 'number', value: 5900, min: 1024, max: 65535 }, { name: 'password', label: 'Senha (opcional, até 8 caracteres)', type: 'password' }], accept: 'Iniciar' });
    if (!result) return; const started = await call('vnc:start', result);
    return `${started.name}. Para abrir aqui: crie uma sessão VNC para 127.0.0.1 na porta ${started.port}.`;
  });
  tool('Ferramentas verificadas', 'BusyBox e TightVNC: instalar ou remover (hash conferido)', async () => {
    const list = await call('tools:list');
    const answer = await form({ title: 'Ferramentas de terceiros', message: 'Baixadas só da origem oficial, com SHA-256 conferido e somente depois da sua confirmação. Nenhum dado seu é enviado.', fields: [{ name: 'action', label: 'Ação', wide: true, options: list.map(t => ({ value: (t.installed ? 'remove:' : 'install:') + t.id, label: `${t.installed ? 'Remover' : 'Instalar'}: ${t.name} — ${t.version} (${t.license})` })) }], accept: 'Continuar' });
    if (!answer) return; const [op, id] = answer.action.split(':');
    const result = await call(op === 'install' ? 'tools:install' : 'tools:remove', id);
    return result.map(t => `${t.installed ? '✔ instalado' : '○ não instalado'}  ${t.name} — origem: ${t.source}`).join(' | ');
  });
  tool('Registro de conexões RDP', 'Mostra as últimas tentativas de conexão e o motivo de falhas', async () => call('rdp:log'));
  tool('Sincronizar (enviar)', 'Gravar sessões, macros e comandos na pasta de sincronização', async () => `Salvo em ${await call('sync:push')}`);
  tool('Sincronizar (receber)', 'Mesclar a pasta de sincronização com este computador', async () => { state().config = await call('sync:pull'); ctx.refresh(); return 'Sessões, comandos rápidos e macros atualizados. Senhas nunca são sincronizadas.'; });

  // Agrupa as ferramentas por categoria, com um título antes de cada grupo.
  const GROUPS = [
    ['Diagnóstico', ['Ping', 'Consulta DNS', 'Traceroute', 'Teste TCP', 'Portas seriais', 'SHA-256', 'Varredura de portas', 'Wake-on-LAN']],
    ['Túneis e espelho', ['Túnel SSH local', 'Proxy SOCKS5 (ssh -D)', 'Túnel SSH remoto (ssh -R)', 'Espelhar pasta (local → servidor)', 'Enviar por ZMODEM (rz)', 'Baixar por ZMODEM (sz)']],
    ['Servidores locais', ['Servidor HTTP local', 'Servidor TFTP', 'Servidor FTP', 'Servidor SFTP', 'Servidor VNC (compartilhar esta tela)']],
    ['Chaves e sessões', ['Gerar chave SSH', 'Exportar sessões', 'Importar sessões', 'Registro de conexões RDP', 'Sincronizar (enviar)', 'Sincronizar (receber)']],
    ['Sistema', ['Ferramentas verificadas', 'Ajuda rápida']]
  ];
  const grid = $('tool-grid'); const byName = new Map([...grid.children].map(el => [el.firstChild?.textContent, el]));
  grid.replaceChildren();
  for (const [title, names] of GROUPS) {
    const found = names.map(n => byName.get(n)).filter(Boolean); if (!found.length) continue;
    grid.append(elem('h3', title, 'tool-group'), ...found); for (const n of names) byName.delete(n);
  }
  if (byName.size) grid.append(elem('h3', 'Outras', 'tool-group'), ...byName.values());

  return { attach, input, output, key, renderSuggest, downloadFolder: entry => ctx.downloadFolder(entry), fileMode: kind => ctx.setFileMode(kind) };
}
