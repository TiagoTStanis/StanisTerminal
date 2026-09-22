// Árvore de sessões: pastas com subpastas, arrastar e soltar, menu de contexto e busca.
const SVG = 'http://www.w3.org/2000/svg';
const ICONS = {
  chevron: 'M6 4l4 4-4 4',
  folder: 'M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 1.5h4.5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z',
  more: 'M3 8h.01M8 8h.01M13 8h.01'
};
export function icon(name, size = 14) {
  const svg = document.createElementNS(SVG, 'svg'); svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('width', size); svg.setAttribute('height', size); svg.setAttribute('aria-hidden', 'true'); svg.classList.add('ic', 'ic-' + name);
  const path = document.createElementNS(SVG, 'path'); path.setAttribute('d', ICONS[name]); path.setAttribute('fill', name === 'folder' ? 'currentColor' : 'none'); path.setAttribute('fill-opacity', '.18'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', name === 'more' ? '2.2' : '1.3'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
  svg.append(path); return svg;
}
const BADGE = { local: '>_', ssh: 'SSH', 'ssh-x11': 'X11', rdp: 'RDP', vnc: 'VNC', serial: 'COM', telnet: 'TEL', rlogin: 'RLG', rsh: 'RSH', x11: 'X11', xdmcp: 'XDM' };
const ROOT = 'Minhas sessões';

export function setupTree(ctx) {
  const { $, call, form, toast, safe, elem, state, openSession, sessionForm, localProfile } = ctx;
  const collapsed = new Set(['@local']); // terminais locais começam recolhidos; o que você abrir ou fechar depois é lembrado
  try { const saved = localStorage.getItem('stanis.collapsed'); if (saved) { collapsed.clear(); for (const item of JSON.parse(saved)) collapsed.add(item); } } catch { /* sem armazenamento local: padrão */ }
  const persist = () => { try { localStorage.setItem('stanis.collapsed', JSON.stringify([...collapsed])); } catch { /* opcional */ } };
  let dragging = null, menu = null;

  // ---------- Menu de contexto (itens perigosos pedem o segundo clique no próprio item) ----------
  function closeMenu() { menu?.remove(); menu = null; }
  function openMenu(x, y, items) {
    closeMenu(); menu = elem('div', '', 'ctx-menu'); menu.setAttribute('role', 'menu');
    for (const item of items) {
      if (item === '-') { menu.append(elem('div', '', 'ctx-sep')); continue; }
      const el = elem('button', item.label, 'ctx-item' + (item.danger ? ' danger' : '')); el.type = 'button'; el.setAttribute('role', 'menuitem');
      el.onclick = event => {
        event.stopPropagation();
        if (item.danger && !el.dataset.armed) { el.dataset.armed = '1'; el.textContent = 'Clique de novo para confirmar'; return; }
        closeMenu(); safe(item.action)();
      };
      menu.append(el);
    }
    document.body.append(menu);
    const box = menu.getBoundingClientRect(); menu.style.left = Math.max(4, Math.min(x, innerWidth - box.width - 4)) + 'px'; menu.style.top = Math.max(4, Math.min(y, innerHeight - box.height - 4)) + 'px';
    menu.querySelector('button')?.focus();
  }
  document.addEventListener('mousedown', event => { if (menu && !menu.contains(event.target)) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  window.addEventListener('blur', closeMenu);

  const apply = config => { state().config = config; };
  const refresh = async () => { state().secrets = await call('profile:secrets'); render(); };
  const allFolders = () => [...new Set([...(state().config.folders || []), ...state().config.profiles.map(p => p.group)])].sort((a, b) => a.localeCompare(b));

  async function promptName(title, value = '') {
    const answer = await form({ title, fields: [{ name: 'name', label: 'Nome', value, required: true, wide: true }], accept: 'Salvar' }); return answer?.name.trim() || null;
  }
  const folderActions = path => [
    { label: 'Nova sessão aqui…', action: () => sessionForm({ group: path }) },
    { label: 'Nova subpasta…', action: async () => { const name = await promptName('Nova subpasta'); if (name) { apply(await call('folder:create', path + '/' + name)); collapsed.delete(path); persist(); render(); } } },
    { label: 'Renomear…', action: async () => { const name = await promptName('Renomear pasta', path.split('/').pop()); if (name) { const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) + '/' : ''; apply(await call('folder:rename', path, parent + name)); render(); } } },
    { label: 'Exportar pasta…', action: async () => { const count = await call('folder:export', path); if (count) toast(`${count} sessão(ões) exportada(s). Senhas não são exportadas.`); } },
    '-',
    { label: 'Excluir pasta (o conteúdo sobe um nível)', danger: true, action: async () => { apply(await call('folder:delete', path)); render(); } }
  ];
  const sessionActions = p => [
    { label: 'Conectar', action: () => openSession(p) },
    { label: 'Editar…', action: () => sessionForm(p) },
    { label: 'Duplicar', action: async () => { const { id, ...copy } = p; const saved = await call('profile:save', { ...copy, name: p.name + ' (cópia)' }); state().config.profiles.push(saved); await refresh(); } },
    { label: 'Mover para…', action: async () => {
      const answer = await form({ title: 'Mover sessão', fields: [{ name: 'group', label: 'Pasta', value: p.group, wide: true, options: allFolders().map(f => ({ value: f, label: f })) }, { name: 'created', label: 'Ou nova pasta (use / para subpastas)', wide: true }], accept: 'Mover' });
      if (answer) { apply(await call('profile:move', p.id, (answer.created || '').trim() || answer.group)); render(); }
    } },
    ...(state().secrets?.[p.id] ? [{ label: 'Esquecer senha guardada', action: async () => { await call('profile:forget', p.id); await refresh(); toast('Senha esquecida.'); } }] : []),
    '-',
    { label: 'Excluir sessão', danger: true, action: async () => { await call('profile:delete', p.id); state().config.profiles = state().config.profiles.filter(x => x.id !== p.id); await refresh(); } }
  ];

  // ---------- Montagem da árvore ----------
  function build(profiles, folders) {
    const root = { name: '', path: '', children: new Map(), profiles: [] };
    const ensure = path => { let node = root, acc = ''; for (const part of path.split('/')) { acc = acc ? acc + '/' + part : part; if (!node.children.has(part)) node.children.set(part, { name: part, path: acc, children: new Map(), profiles: [] }); node = node.children.get(part); } return node; };
    for (const folder of folders) ensure(folder);
    for (const profile of profiles) ensure(profile.group).profiles.push(profile);
    return root;
  }
  const count = node => node.profiles.length + [...node.children.values()].reduce((sum, child) => sum + count(child), 0);
  const matches = (p, filter) => `${p.name} ${p.host || ''} ${p.group} ${p.username || ''}`.toLowerCase().includes(filter);
  const subtreeMatches = (node, filter) => node.profiles.some(p => matches(p, filter)) || [...node.children.values()].some(child => subtreeMatches(child, filter));

  function sessionRow(p, depth, saved) {
    const row = elem('div', '', 'tree-row session'); row.style.setProperty('--depth', depth); row.draggable = !!p.id; row.dataset.id = p.id || '';
    const open = elem('button', '', 'tree-main'); open.type = 'button'; open.title = `${p.name}${p.host ? ' — ' + p.host : ''}`;
    const info = elem('span', '', 'tree-label'); info.append(elem('span', p.name, 'tree-name'), elem('small', p.type === 'local' ? { powershell: 'PowerShell', cmd: 'Prompt de comando', bash: 'Git Bash', wsl: 'Linux (WSL)', busybox: 'Comandos Unix' }[p.shell] : p.type === 'serial' ? `${p.device} · ${p.baudRate}` : p.host ? `${p.username ? p.username + '@' : ''}${p.host}${saved ? ' 🔒' : ''}` : ''));
    open.append(elem('span', BADGE[p.type] || p.type.toUpperCase(), 'badge badge-' + p.type), info); open.onclick = safe(() => openSession(p));
    row.append(open);
    if (p.id) {
      const more = elem('button', '', 'tree-more'); more.type = 'button'; more.setAttribute('aria-label', `Opções de ${p.name}`); more.append(icon('more')); more.onclick = event => { event.stopPropagation(); const r = more.getBoundingClientRect(); openMenu(r.left, r.bottom + 2, sessionActions(p)); };
      row.append(more);
      row.oncontextmenu = event => { event.preventDefault(); openMenu(event.clientX, event.clientY, sessionActions(p)); };
      row.ondragstart = event => { dragging = p; event.dataTransfer.setData('text/plain', p.id); event.dataTransfer.effectAllowed = 'move'; $('sessions-list').classList.add('dragging'); };
      row.ondragend = () => { dragging = null; $('sessions-list').classList.remove('dragging'); for (const el of document.querySelectorAll('.drop-over')) el.classList.remove('drop-over'); };
    }
    return row;
  }
  function moveTo(path) { if (dragging && dragging.group !== path) { const id = dragging.id; dragging = null; safe(async () => { apply(await call('profile:move', id, path)); render(); })(); } }
  function folderRow(node, depth, isCollapsed, filtering) {
    const row = elem('div', '', 'tree-row folder'); row.style.setProperty('--depth', depth); row.dataset.path = node.path;
    const toggle = elem('button', '', 'tree-main'); toggle.type = 'button'; toggle.setAttribute('aria-expanded', String(!isCollapsed));
    const chevron = icon('chevron'); chevron.classList.toggle('open', !isCollapsed);
    toggle.append(chevron, icon('folder', 15), elem('span', node.name, 'tree-name'), elem('small', String(count(node)), 'tree-count'));
    toggle.onclick = () => { if (filtering) return; if (collapsed.has(node.path)) collapsed.delete(node.path); else collapsed.add(node.path); persist(); render(); };
    const more = elem('button', '', 'tree-more'); more.type = 'button'; more.setAttribute('aria-label', `Opções da pasta ${node.name}`); more.append(icon('more')); more.onclick = event => { event.stopPropagation(); const r = more.getBoundingClientRect(); openMenu(r.left, r.bottom + 2, folderActions(node.path)); };
    row.append(toggle, more); row.oncontextmenu = event => { event.preventDefault(); openMenu(event.clientX, event.clientY, folderActions(node.path)); };
    row.ondragover = event => { if (dragging) { event.preventDefault(); row.classList.add('drop-over'); } };
    row.ondragleave = () => row.classList.remove('drop-over');
    row.ondrop = event => { event.preventDefault(); event.stopPropagation(); row.classList.remove('drop-over'); moveTo(node.path); };
    return row;
  }
  function renderNode(node, depth, into, filter) {
    for (const child of [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name))) {
      if (filter && !subtreeMatches(child, filter)) continue;
      const isCollapsed = !filter && collapsed.has(child.path); into.append(folderRow(child, depth, isCollapsed, !!filter));
      if (!isCollapsed) renderNode(child, depth + 1, into, filter);
    }
    for (const p of node.profiles.sort((a, b) => a.name.localeCompare(b.name))) if (!filter || matches(p, filter)) into.append(sessionRow(p, depth, state().secrets?.[p.id]));
  }
  function section(title, key, build2) {
    const head = elem('button', '', 'tree-section'); head.type = 'button'; const open = !collapsed.has(key); const chevron = icon('chevron', 12); chevron.classList.toggle('open', open); head.append(chevron, elem('span', title));
    head.onclick = () => { if (collapsed.has(key)) collapsed.delete(key); else collapsed.add(key); persist(); render(); }; return { head, open, build: build2 };
  }

  function render() {
    const list = $('sessions-list'); list.replaceChildren(); const filter = $('filter-sessions').value.trim().toLowerCase();
    const locals = ['powershell', 'cmd', 'bash', 'wsl', 'busybox'].map(localProfile).filter(p => !filter || matches(p, filter));
    if (locals.length) { const s = section('Terminais locais', '@local'); list.append(s.head); if (s.open || filter) for (const p of locals) list.append(sessionRow(p, 0)); }
    const tree = build(state().config.profiles, state().config.folders || []);
    const mine = section('Minhas conexões', '@mine'); const body = document.createElement('div'); renderNode(tree, 0, body, filter);
    list.append(mine.head); if (mine.open || filter) list.append(body);
    if (!state().config.profiles.length && !(state().config.folders || []).length && !filter) list.append(elem('p', 'Nenhuma conexão salva. Use “Nova sessão” ou digite usuario@servidor na barra acima.', 'empty-list'));
    if (filter && !body.children.length && !locals.length) list.append(elem('p', 'Nada encontrado.', 'empty-list'));
    // Soltar no espaço vazio tira a sessão da pasta.
    list.ondragover = event => { if (dragging) event.preventDefault(); };
    list.ondrop = event => { event.preventDefault(); moveTo(ROOT); };
  }
  $('new-folder').onclick = safe(async () => { const name = await promptName('Nova pasta'); if (name) { apply(await call('folder:create', name)); collapsed.delete('@mine'); persist(); render(); } });
  $('sessions-list').oncontextmenu = event => { if (event.target === $('sessions-list')) { event.preventDefault(); openMenu(event.clientX, event.clientY, [{ label: 'Nova sessão…', action: () => sessionForm() }, { label: 'Nova pasta…', action: () => $('new-folder').click() }]); } };
  return { render };
}
