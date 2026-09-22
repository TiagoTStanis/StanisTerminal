const { _electron: electron } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const root = path.resolve(__dirname, '..');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ executablePath: require('electron'), args: [root, '--test-mode'], env, timeout: 30000 });
  const page = await app.firstWindow();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const call = (...args) => page.evaluate(args => window.api.call(...args), args);
  const cfg = async () => (await call('init')).config;
  const userData = await app.evaluate(({ app }) => app.getPath('userData'));
  try {
    await page.waitForSelector('#sessions-list .tree-section');
    assert.equal((await cfg()).settings.theme, 'light', 'tema padrão é o claro');

    // Pastas: criar pela interface, subpasta pelo menu e nomes inválidos recusados no servidor.
    await page.click('#new-folder'); await page.locator('[name=name]').fill('Clientes'); await page.click('#dialog-ok');
    await page.waitForSelector('.tree-row.folder:has-text("Clientes")');
    await page.locator('.tree-row.folder:has-text("Clientes")').click({ button: 'right' }); await page.click('.ctx-item:has-text("Nova subpasta")');
    await page.locator('[name=name]').fill('Acme'); await page.click('#dialog-ok'); await page.waitForSelector('.tree-row.folder:has-text("Acme")');
    assert.deepEqual((await cfg()).folders.sort(), ['Clientes', 'Clientes/Acme']);
    await assert.rejects(call('folder:create', 'a/b/c/d/e/f/g'), /Pasta inválida/); await assert.rejects(call('folder:create', 'x/../y'), /Pasta inválida/);

    // Sessões: criar dentro de uma pasta (formulário já vem com a pasta), com senha; a senha nunca vai para o config.json.
    await page.locator('.tree-row.folder:has-text("Acme")').click({ button: 'right' }); await page.click('.ctx-item:has-text("Nova sessão aqui")');
    assert.equal(await page.locator('[name=group]').inputValue(), 'Clientes/Acme');
    await page.locator('[name=name]').fill('Desktop Acme'); await page.selectOption('[name=type]', 'rdp'); await page.locator('[name=host]').fill('desk.acme.local');
    await page.locator('[name=username]').fill('ana'); await page.locator('[name=password]').fill('SenhaSecreta9'); await page.click('#dialog-ok');
    await page.waitForSelector('.tree-name:text("Desktop Acme")');
    const stored = await cfg(); assert.equal(stored.profiles[0].group, 'Clientes/Acme'); assert.ok(!JSON.stringify(stored).includes('SenhaSecreta9'), 'senha fora do config.json');
    const secretsFile = fs.readFileSync(path.join(userData, 'credentials.json'), 'utf8'); assert.ok(!secretsFile.includes('SenhaSecreta9'), 'senha criptografada no disco');
    assert.equal((await call('profile:secrets'))[stored.profiles[0].id], true); await page.waitForSelector('.tree-row.session:has-text("🔒")');

    // Arrastar e soltar entre pastas + criar sessão em outra pasta por nova pasta digitada.
    await page.click('#new-session'); await page.locator('[name=name]').fill('Router'); await page.selectOption('[name=type]', 'telnet'); await page.locator('[name=host]').fill('192.168.0.1');
    await page.locator('[name=newGroup]').fill('Lab/Rede'); await page.click('#dialog-ok'); await page.waitForSelector('.tree-name:text("Router")');
    assert.equal((await cfg()).profiles.find(p => p.name === 'Router').group, 'Lab/Rede');
    await page.locator('.tree-row.session:has-text("Router")').dragTo(page.locator('.tree-row.folder:has-text("Acme")'));
    await page.waitForFunction(async () => (await window.api.call('init')).config.profiles.find(p => p.name === 'Router').group === 'Clientes/Acme');

    // Renomear pasta reescreve o caminho das sessões; excluir move o conteúdo para cima (com segundo clique no item do menu).
    await page.locator('.tree-row.folder:has-text("Acme")').click({ button: 'right' }); await page.click('.ctx-item:has-text("Renomear")');
    await page.locator('[name=name]').fill('Acme Corp'); await page.click('#dialog-ok');
    await page.waitForFunction(async () => (await window.api.call('init')).config.profiles.every(p => p.group === 'Clientes/Acme Corp'));
    await page.locator('.tree-row.folder:has-text("Acme Corp")').click({ button: 'right' });
    await page.click('.ctx-item.danger'); assert.ok(await page.locator('.ctx-item.danger[data-armed]').count(), 'pede o segundo clique no item');
    assert.equal((await cfg()).profiles.length, 2, 'primeiro clique não exclui'); await page.click('.ctx-item.danger');
    await page.waitForFunction(async () => (await window.api.call('init')).config.profiles.every(p => p.group === 'Clientes'));
    assert.ok(!(await cfg()).folders.some(f => f.includes('Acme')));
    await assert.rejects(call('folder:rename', 'Clientes', 'Clientes/Sub'), /dentro dela mesma/);

    // Esquecer senha pelo menu: o RDP volta a pedir; nenhum diálogo de confirmação extra.
    await page.locator('.tree-row.session:has-text("Desktop Acme")').click({ button: 'right' }); await page.click('.ctx-item:has-text("Esquecer senha")');
    await page.waitForFunction(async () => Object.values(await window.api.call('profile:secrets')).every(v => v === false));

    // Conexão rápida entende esquema://host:porta e recusa texto inválido.
    await page.locator('#quick-input').fill('telnet://127.0.0.1:9'); await page.click('#quick-go');
    await page.waitForSelector('.tab:has-text("127.0.0.1")', { timeout: 15000 }); // abriu a sessão Telnet; a recusa aparece dentro do terminal
    await page.locator('#quick-input').fill('isso nao vale'); await page.click('#quick-go'); await page.waitForFunction(() => /formato/i.test(document.querySelector('#toast').textContent));

    // Pacotes: abrir não consulta a rede sozinho; listas salvas aparecem, validam IDs e excluem com segundo clique.
    await page.click('#open-packages'); await page.waitForSelector('#packages-dialog[open]');
    assert.ok(/Digite o nome/.test(await page.locator('.pk-empty').textContent()), 'sem busca automática');
    await assert.rejects(call('packages:lists:save', [{ name: 'ruim', items: [{ id: '--source=evil' }] }]), /inválido/);
    const saved = await call('packages:lists:save', [{ name: 'Dev', items: [{ id: 'Git.Git', name: 'Git' }, { id: '7zip.7zip', name: '7-Zip' }] }]); assert.equal(saved[0].items.length, 2);
    await page.evaluate(() => { document.querySelector('#packages-dialog').close(); }); await page.reload(); await page.waitForSelector('#sessions-list .tree-section');
    await page.click('#open-packages'); await page.click('#packages-dialog .tab-btn:has-text("Listas")');
    await page.waitForSelector('.pk-list-card:has-text("Dev")'); assert.ok((await page.locator('.pk-list-items').textContent()).includes('7-Zip'));
    const del = page.locator('.pk-list-card .pk-actions button').last(); await del.click();
    await page.waitForFunction(() => document.querySelector('.pk-list-card .pk-actions button:last-child')?.textContent === 'Confirmar?'); assert.equal((await cfg()).packageLists.length, 1, 'primeiro clique não exclui'); await del.click();
    await page.waitForSelector('.pk-list-card', { state: 'detached' }); assert.equal((await cfg()).packageLists.length, 0);

    await page.screenshot({ path: path.join(root, 'test-results/organize.png') });
    assert.deepEqual(errors, []);
    console.log('PASS: pastas e subpastas (criar, arrastar, renomear, excluir), sessão com senha criptografada, esquecer senha, conexão rápida, listas de pacotes.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
