// Tela de Pacotes (winget): buscar, instalar, atualizar, remover e guardar listas de programas.
// Instalar e atualizar acontecem com um clique; só remover pede uma segunda confirmação, no próprio botão.
export function setupPackages(ctx) {
  const { $, api, call, form, toast, safe, elem, button, state } = ctx;
  const ui = { tab: 'search', source: 'winget', needsUnix: false, rows: [], selected: new Map(), busy: false, query: '', message: '' };
  const dialog = document.createElement('dialog'); dialog.id = 'packages-dialog'; dialog.className = 'wide';
  const head = elem('div', '', 'dialog-heading'); head.append(elem('h2', 'Pacotes'), button('✕', () => dialog.close(), 'icon-btn'));
  const tabs = elem('div', '', 'tabs-row'); const toolbar = elem('div', '', 'pk-toolbar'); const list = elem('div', '', 'pk-list'); const footer = elem('div', '', 'pk-footer');
  const log = elem('pre', '', 'pk-log'); log.hidden = true;
  const seg = elem('div', '', 'seg-row'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Origem dos pacotes');
  dialog.append(head, seg, tabs, toolbar, list, log, footer); document.body.append(dialog);

  const TABS = [['search', 'Buscar'], ['installed', 'Instalados'], ['updates', 'Atualizações'], ['lists', 'Listas']];
  const lists = () => state().config.packageLists || (state().config.packageLists = []);
  const setBusy = value => { ui.busy = value; render(); };
  const writeLog = line => { log.hidden = false; log.textContent = (log.textContent + '\n' + line).trim().split('\n').slice(-40).join('\n'); log.scrollTop = log.scrollHeight; };
  api.on('packages:log', ({ id, line }) => writeLog(`${id}: ${line}`));

  async function load(tab = ui.tab) {
    ui.tab = tab; ui.rows = []; ui.message = ''; ui.needsUnix = false; render();
    if (ui.source === 'msys2' && tab !== 'lists') { const tools = await call('tools:list'); if (!tools.find(t => t.id === 'msys2')?.installed) { ui.needsUnix = true; ui.message = 'O ambiente Unix (MSYS2) ainda não está instalado. Ele traz bash, coreutils, gcc, git e o gerenciador pacman.'; return render(); } }
    if (tab === 'lists') return;
    if (tab === 'search' && !ui.query) { ui.message = 'Digite o nome de um programa e pressione Enter.'; return render(); }
    setBusy(true);
    try {
      ui.rows = tab === 'search' ? await call('packages:search', ui.query, ui.source) : tab === 'installed' ? await call('packages:installed', ui.source) : await call('packages:upgrades', ui.source);
      if (tab === 'installed') ui.rows.sort((a, b) => Number(!!b.available) - Number(!!a.available) || a.name.localeCompare(b.name));
      ui.message = ui.rows.length ? '' : tab === 'updates' ? 'Tudo em dia.' : 'Nenhum resultado.';
    } catch (error) { ui.message = error.message; }
    setBusy(false);
  }

  // Executa uma fila de operações, uma por vez, mostrando o progresso; atualiza a lista no fim.
  async function operate(action, items) {
    log.textContent = ''; log.hidden = false; setBusy(true); const done = [], failed = [];
    for (const item of items) {
      writeLog(`— ${{ install: 'Instalando', upgrade: 'Atualizando', uninstall: 'Removendo' }[action]} ${item.name || item.id}…`);
      try { const result = await call('packages:operate', action, item.id, item.source || ui.source); (result.ok ? done : failed).push(item); writeLog(`${result.ok ? '✔' : '✘'} ${item.id}: ${result.message}`); if (result.message === 'Cancelado.') break; }
      catch (error) { failed.push(item); writeLog(`✘ ${item.id}: ${error.message}`); }
    }
    toast(failed.length ? `${done.length} concluído(s), ${failed.length} com erro. Veja o registro.` : `${done.length} concluído(s).`);
    ui.selected.clear(); ui.busy = false; if (ui.tab !== 'lists') await load(); else render();
  }
  const two = (label, action, className = '') => { // botão que exige um segundo clique em até 3 s (sem janela de confirmação)
    const el = button(label, () => { if (el.dataset.armed) return action(); el.dataset.armed = '1'; el.textContent = 'Confirmar?'; el.classList.add('danger'); setTimeout(() => { delete el.dataset.armed; el.textContent = label; el.classList.remove('danger'); }, 3000); }, className);
    return el;
  };
  const key = row => row.id;
  const pick = (row, on) => { if (on) ui.selected.set(key(row), { id: row.id, name: row.name, source: row.source || 'winget' }); else ui.selected.delete(key(row)); renderFooter(); };

  function renderRows() {
    list.replaceChildren();
    if (ui.message) list.append(elem('p', ui.message, 'pk-empty'));
    if (ui.needsUnix) list.append(button('Instalar ambiente Unix (download de ~53 MB)', safe(async () => { setBusy(true); toast('Instalando o ambiente Unix. Na primeira vez pode levar alguns minutos…'); try { await call('tools:install', 'msys2'); toast('Ambiente Unix instalado.'); } finally { ui.busy = false; } await load(); }), 'primary pk-install-unix'));
    for (const row of ui.rows) {
      const line = elem('div', '', 'pk-row'); const box = document.createElement('input'); box.type = 'checkbox'; box.disabled = !row.actionable || ui.busy; box.checked = ui.selected.has(key(row)); box.setAttribute('aria-label', `Selecionar ${row.name}`); box.onchange = () => pick(row, box.checked);
      const info = elem('div', '', 'pk-info'); info.append(elem('strong', row.name), elem('small', row.description || row.id)); info.title = row.id;
      const version = elem('span', row.available ? `${row.version} → ${row.available}` : row.version, 'pk-version' + (row.available ? ' has-update' : ''));
      const actions = elem('div', '', 'pk-actions');
      if (row.actionable) {
        if (ui.tab === 'search') actions.append(row.installed ? two('Remover', () => operate('uninstall', [row]), 'small') : button('Instalar', () => operate('install', [row]), 'primary small'));
        if (row.available || ui.tab === 'updates') actions.append(button('Atualizar', () => operate('upgrade', [row]), 'primary small'));
        if (ui.tab === 'installed') actions.append(two('Remover', () => operate('uninstall', [row]), 'small'));
        for (const el of actions.children) el.disabled = ui.busy;
      } else actions.append(elem('small', 'Gerenciado pelo Windows', 'muted'));
      line.append(box, info, version, actions); list.append(line);
    }
  }
  function renderLists() {
    list.replaceChildren(); const saved = lists();
    if (!saved.length) list.append(elem('p', 'Nenhuma lista ainda. Marque programas em Buscar ou Instalados e use “Salvar seleção em lista”.', 'pk-empty'));
    saved.forEach((entry, index) => {
      const card = elem('div', '', 'pk-list-card'); const title = elem('div', '', 'pk-list-title'); title.append(elem('strong', entry.name), elem('small', `${entry.items.length} programa(s)`));
      const items = elem('div', entry.items.map(i => i.name || i.id).join(' · '), 'pk-list-items'); const actions = elem('div', '', 'pk-actions');
      actions.append(button('Instalar todos', () => operate('install', entry.items), 'primary small'), button('Exportar', async () => { if (await call('packages:lists:export', index)) toast('Lista exportada.'); }, 'small'),
        button('Renomear', async () => { const answer = await form({ title: 'Renomear lista', fields: [{ name: 'name', label: 'Nome', value: entry.name, required: true, wide: true }], accept: 'Salvar' }); if (answer) { state().config.packageLists = await call('packages:lists:save', saved.map((l, i) => i === index ? { ...l, name: answer.name } : l)); render(); } }, 'small'),
        two('Excluir', async () => { state().config.packageLists = await call('packages:lists:save', saved.filter((_, i) => i !== index)); render(); }, 'small'));
      for (const el of actions.children) if (el.textContent === 'Instalar todos') el.disabled = ui.busy;
      card.append(title, items, actions); list.append(card);
    });
  }
  async function saveSelection() {
    const items = [...ui.selected.values()]; if (!items.length) throw new Error('Marque ao menos um programa.');
    const saved = lists(); const answer = await form({ title: 'Salvar em lista', fields: [{ name: 'target', label: 'Lista', wide: true, options: [{ value: '', label: 'Nova lista…' }, ...saved.map((l, i) => ({ value: String(i), label: l.name }))] }, { name: 'name', label: 'Nome da nova lista', wide: true }], accept: 'Salvar' });
    if (!answer) return; const next = saved.map(l => ({ ...l, items: [...l.items] }));
    if (answer.target === '') { if (!answer.name.trim()) throw new Error('Dê um nome à lista.'); next.push({ name: answer.name.trim(), items }); }
    else { const target = next[Number(answer.target)]; for (const item of items) if (!target.items.some(x => x.id === item.id)) target.items.push(item); }
    state().config.packageLists = await call('packages:lists:save', next); ui.selected.clear(); toast('Lista salva.'); render();
  }
  function renderFooter() {
    footer.replaceChildren(); const count = ui.selected.size;
    if (ui.busy) { footer.append(elem('span', 'Trabalhando…', 'muted'), button('Cancelar operação', () => call('packages:cancel'), 'small')); return; }
    if (ui.tab === 'lists') { footer.append(button('Importar lista…', safe(async () => { const result = await call('packages:lists:import'); if (result) { state().config.packageLists = result; render(); toast('Lista importada.'); } }), 'small')); return; }
    footer.append(elem('span', count ? `${count} selecionado(s)` : 'Marque programas para agir em lote.', 'muted'));
    if (count) {
      const chosen = () => [...ui.selected.values()];
      if (ui.tab === 'search') footer.append(button('Instalar selecionados', () => operate('install', chosen()), 'primary small'));
      if (ui.tab !== 'search') footer.append(button('Atualizar selecionados', () => operate('upgrade', chosen()), 'primary small'));
      footer.append(button('Salvar seleção em lista…', saveSelection, 'small'), button('Limpar', () => { ui.selected.clear(); render(); }, 'small'));
    }
  }
  function render() {
    seg.replaceChildren(); for (const [id, label] of [['winget', 'Windows (winget)'], ['msys2', 'Unix (MSYS2)']]) { const b = button(label, () => { if (ui.source === id) return; ui.source = id; ui.rows = []; ui.selected.clear(); return load(ui.tab === 'lists' ? 'search' : ui.tab); }, 'seg-btn' + (ui.source === id ? ' active' : '')); b.setAttribute('aria-pressed', String(ui.source === id)); b.disabled = ui.busy; seg.append(b); }
    tabs.replaceChildren(); for (const [id, label] of TABS) { const t = button(label, () => load(id), 'tab-btn' + (ui.tab === id ? ' active' : '')); t.setAttribute('role', 'tab'); t.disabled = ui.busy && ui.tab !== id; tabs.append(t); }
    toolbar.replaceChildren(); toolbar.hidden = ui.tab !== 'search' && ui.tab !== 'installed' && ui.tab !== 'updates';
    if (ui.tab === 'search') { const input = document.createElement('input'); input.type = 'search'; input.placeholder = 'Buscar programas (ex.: 7zip, vscode, chrome)'; input.value = ui.query; input.setAttribute('aria-label', 'Buscar programas'); input.onkeydown = event => { if (event.key === 'Enter') { ui.query = input.value.trim(); safe(() => load('search'))(); } }; toolbar.append(input, button('Buscar', () => { ui.query = input.value.trim(); return load('search'); }, 'primary')); }
    else toolbar.append(button('Atualizar lista', () => load(ui.tab), 'small'), ui.tab === 'updates' && ui.rows.length ? button('Atualizar tudo', () => ui.source === 'msys2' ? operate('upgrade-all', [{ id: '*', name: 'todo o sistema Unix', source: 'msys2' }]) : operate('upgrade', ui.rows.filter(r => r.actionable)), 'primary small') : elem('span', ''));
    if (ui.tab === 'lists') renderLists(); else renderRows(); renderFooter();
  }

  const open = $('open-packages');
  open.onclick = safe(async () => { dialog.showModal(); ctx.updateNativeBounds?.(); await load(ui.tab); }); // sem consulta de rede automática: a aba inicial só mostra a dica
  dialog.addEventListener('close', () => ctx.updateNativeBounds?.());
  return { open: () => open.click() };
}
