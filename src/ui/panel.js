// Painel: todas as sessões salvas numa grade com status online (o mesmo teste TCP da árvore), filtro por pasta e conexão com um clique.
const LABEL = { local: 'Local', ssh: 'SSH', 'ssh-x11': 'SSH X11', rdp: 'RDP', vnc: 'VNC', serial: 'Serial', telnet: 'Telnet', rlogin: 'Rlogin', rsh: 'Rsh', x11: 'X11', xdmcp: 'XDMCP', web: 'Web' };
const ROOT = 'Minhas sessões';

export function setupPanel(ctx) {
  const { $, api, elem, button, state, openSession, tree } = ctx;
  const dialog = document.createElement('dialog'); dialog.id = 'panel-dialog'; dialog.className = 'wide';
  const head = elem('div', '', 'dialog-heading'); head.append(elem('h2', 'Painel'), button('✕', () => dialog.close(), 'icon-btn'));
  const folder = document.createElement('select'); folder.id = 'panel-folder'; folder.setAttribute('aria-label', 'Filtrar por pasta');
  const filter = document.createElement('input'); filter.id = 'panel-filter'; filter.type = 'search'; filter.placeholder = 'Filtrar por nome, protocolo ou host…'; filter.setAttribute('aria-label', 'Filtrar sessões');
  const toolbar = elem('div', '', 'pk-toolbar'); toolbar.append(folder, filter, button('Atualizar status', () => refresh(), 'small'));
  const list = elem('div', '', 'pk-list panel-list'); list.id = 'panel-list';
  const footer = elem('div', '', 'pk-footer'); const summary = elem('span', '', 'muted'); summary.id = 'panel-summary'; footer.append(summary);
  dialog.append(head, toolbar, list, footer); document.body.append(dialog);
  let timer = null, rows = [];

  const folderOf = p => p.group || ROOT;
  const inFolder = (p, path) => !path || folderOf(p) === path || folderOf(p).startsWith(path + '/');
  const status = p => {
    if (state().config.settings.checkOnline === false) return ['off-check', 'Desativado'];
    const key = tree().target(p); if (!key) return ['none', 'Sem teste'];
    const online = tree().reach.get(key); return online === undefined ? ['wait', 'Verificando…'] : online ? ['on', 'Online'] : ['off', 'Offline'];
  };
  function paint(row, p) { const [kind, text] = status(p), cell = row.querySelector('.panel-status'); cell.className = 'panel-status ' + kind; cell.replaceChildren(elem('i', ''), document.createTextNode(text)); }
  function updateSummary() {
    const count = { on: 0, off: 0 }; for (const { p } of rows) { const [kind] = status(p); if (kind in count) count[kind]++; }
    summary.textContent = `${rows.length} sessão(ões) · ${count.on} online · ${count.off} offline`;
  }
  function render() {
    const profiles = state().config.profiles, keep = folder.value;
    const parts = path => path.split('/').map((_, i, all) => all.slice(0, i + 1).join('/'));
    const folders = [...new Set([...(state().config.folders || []), ...profiles.map(folderOf)].flatMap(parts))].sort((a, b) => a.localeCompare(b));
    folder.replaceChildren(new Option('Todas as pastas', '')); for (const name of folders) folder.append(new Option(name, name)); folder.value = folders.includes(keep) ? keep : '';
    const query = filter.value.trim().toLocaleLowerCase(); list.replaceChildren(); rows = [];
    const shown = profiles.filter(p => inFolder(p, folder.value) && `${p.name} ${LABEL[p.type] || p.type} ${p.host || ''}`.toLocaleLowerCase().includes(query))
      .sort((a, b) => folderOf(a).localeCompare(folderOf(b)) || a.name.localeCompare(b.name));
    for (const p of shown) {
      const row = document.createElement('button'); row.type = 'button'; row.className = 'panel-row'; row.dataset.id = p.id; row.title = `Conectar a ${p.name}`;
      const key = tree().target(p);
      row.append(elem('strong', p.name, 'panel-name'), elem('span', LABEL[p.type] || p.type, 'badge badge-' + p.type), elem('span', p.type === 'local' || p.type === 'serial' ? p.shell || p.device || '—' : key || p.host || '—', 'panel-host'), elem('span', folderOf(p), 'panel-folder-name'), elem('span', '', 'panel-status'));
      row.onclick = () => { dialog.close(); openSession(p); }; paint(row, p); list.append(row); rows.push({ row, p, key });
    }
    if (!rows.length) list.append(elem('p', profiles.length ? 'Nenhuma sessão encontrada.' : 'Nenhuma conexão salva ainda.', 'pk-empty'));
    updateSummary();
  }
  function refresh() { render(); return tree().checkOnline(true); }

  // Faixa ao vivo estilo bolsa: nome + status passando em loop, atualizada a cada resposta de rede.
  const ticker = $('ticker'), track = ticker.firstElementChild; let tickerSignature = '';
  const tickerOn = () => { try { return localStorage.getItem('stanis.ticker') !== 'off'; } catch { return true; } };
  function renderTicker() {
    ticker.hidden = !tickerOn() || state().config.settings.checkOnline === false;
    if (ticker.hidden) { tickerSignature = ''; return; }
    const items = state().config.profiles.map(p => [p, status(p)]).filter(([, [kind]]) => kind === 'on' || kind === 'off' || kind === 'wait').sort((a, b) => a[0].name.localeCompare(b[0].name));
    const signature = items.map(([p, [kind]]) => p.id + kind).join(); if (signature === tickerSignature) return; tickerSignature = signature;
    if (!items.length) { ticker.hidden = true; return; }
    const entry = (p, kind, text) => {
      const el = document.createElement('button'); el.type = 'button'; el.className = 'ticker-item ' + kind; el.title = `Conectar a ${p.name}`;
      el.append(elem('i', kind === 'on' ? '▲' : kind === 'off' ? '▼' : '•'), elem('b', p.name), elem('span', text.replace('…', '').toUpperCase())); el.onclick = () => openSession(p); return el;
    };
    track.replaceChildren(...items.map(([p, [kind, text]]) => entry(p, kind, text)), ...items.map(([p, [kind, text]]) => entry(p, kind, text))); // segunda cópia emenda o loop sem salto
    track.style.setProperty('--ticker-time', Math.max(20, track.scrollWidth / 2 / 55) + 's');
  }
  let tickerTimer = null;
  const scheduleTicker = () => { clearTimeout(tickerTimer); tickerTimer = setTimeout(renderTicker, 250); };
  const tickerToggle = button('', () => { try { localStorage.setItem('stanis.ticker', tickerOn() ? 'off' : 'on'); } catch { /* opcional */ } tickerToggle.textContent = tickerOn() ? 'Ocultar faixa ao vivo' : 'Mostrar faixa ao vivo'; renderTicker(); }, 'small');
  tickerToggle.id = 'panel-ticker-toggle'; tickerToggle.textContent = tickerOn() ? 'Ocultar faixa ao vivo' : 'Mostrar faixa ao vivo'; toolbar.append(tickerToggle);

  // Só repinta as células dos hosts que acabaram de responder.
  api.on('network:reach', batch => {
    scheduleTicker();
    if (!dialog.open) return;
    for (const { row, p, key } of rows) if (key && key in batch) paint(row, p);
    updateSummary();
  });
  folder.onchange = filter.oninput = render;
  $('open-panel').onclick = () => { filter.value = ''; folder.value = ''; render(); dialog.showModal(); filter.focus(); tree().checkOnline(true); clearInterval(timer); timer = setInterval(() => tree().checkOnline(true), 60000); };
  dialog.addEventListener('close', () => { clearInterval(timer); timer = null; ctx.updateNativeBounds?.(); });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const entries = [...list.querySelectorAll('.panel-row')], at = entries.indexOf(document.activeElement); if (!entries.length) return;
    event.preventDefault(); entries[(at + (event.key === 'ArrowDown' ? 1 : -1) + entries.length) % entries.length].focus();
  });
}
