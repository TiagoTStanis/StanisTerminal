// Painel de status: lista todas as sessões salvas (não só as abertas), pinta online/offline pelo teste TCP
// existente, filtra por pasta/texto e conecta com um clique. Servidor TCP local de laboratório, sem depender de Windows.
const { _electron: electron } = require('playwright');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const root = path.resolve(__dirname, '..'), scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-panel-'));
  const env = { ...process.env, STANIS_TEST_USERDATA: path.join(scratch, 'data'), PORTABLE_EXECUTABLE_DIR: path.join(scratch, 'portable') }; delete env.ELECTRON_RUN_AS_NODE;
  let accepted = 0;
  const lab = net.createServer(socket => { accepted++; socket.on('error', () => {}); });
  await new Promise(resolve => lab.listen(0, '127.0.0.1', resolve));
  const closed = net.createServer(); await new Promise(resolve => closed.listen(0, '127.0.0.1', resolve));
  const closedPort = closed.address().port; await new Promise(resolve => closed.close(resolve));
  let app;
  try {
    app = await electron.launch({ executablePath: process.env.STANIS_TEST_EXE || require('electron'), args: process.env.STANIS_TEST_EXE ? ['--test-mode'] : [root, '--test-mode'], env, timeout: 30000 });
    const page = await app.firstWindow(); await page.waitForSelector('#sessions-list .tree-section');
    const save = profile => page.evaluate(p => window.api.call('profile:save', p), { host: '127.0.0.1', username: 'tester', ...profile });
    await save({ name: 'Lab Online', type: 'telnet', port: lab.address().port, group: 'Lab/A' });
    await save({ name: 'Lab Offline', type: 'telnet', port: closedPort, group: 'Lab/B' });
    await save({ name: 'Solta', type: 'ssh', port: closedPort, group: 'Minhas sessões' });
    await page.reload(); await page.waitForSelector('#sessions-list .tree-section');

    await page.click('#open-panel'); await page.waitForSelector('#panel-dialog[open]');
    assert.equal(await page.locator('.panel-row').count(), 3, 'lista todas as sessões salvas, mesmo sem nenhuma aberta');
    const row = name => page.locator('.panel-row', { hasText: name });
    await page.waitForFunction(() => document.querySelectorAll('.panel-status.on, .panel-status.off').length === 3, null, { timeout: 15000 });
    assert.match(await row('Lab Online').locator('.panel-status').textContent(), /Online/);
    assert.match(await row('Lab Offline').locator('.panel-status').textContent(), /Offline/);
    assert.match(await page.locator('#panel-summary').textContent(), /3 sessão.*1 online.*2 offline/);

    await page.waitForSelector('#ticker:not([hidden]) .ticker-item.on');
    const names = await page.locator('#ticker .ticker-item b').allTextContents();
    assert.equal(names.length, 6, 'faixa ao vivo repete a lista duas vezes para o loop contínuo');
    assert.match(await page.locator('#ticker .ticker-item.on').first().textContent(), /▲.*Lab Online.*ONLINE/);
    assert.match(await page.locator('#ticker .ticker-item.off').first().textContent(), /▼.*OFFLINE/);
    assert.notEqual(await page.locator('.ticker-track').evaluate(el => getComputedStyle(el).animationName), 'none', 'faixa está rolando');
    await page.click('#panel-ticker-toggle'); assert.equal(await page.locator('#ticker').isHidden(), true, 'botão oculta a faixa');
    await page.click('#panel-ticker-toggle'); await page.waitForSelector('#ticker:not([hidden])');

    await page.selectOption('#panel-folder', 'Lab');
    assert.deepEqual(await page.locator('.panel-name').allTextContents(), ['Lab Online', 'Lab Offline'], 'pasta pai inclui as subpastas');
    await page.selectOption('#panel-folder', 'Lab/B');
    assert.deepEqual(await page.locator('.panel-name').allTextContents(), ['Lab Offline']);
    await page.selectOption('#panel-folder', ''); await page.fill('#panel-filter', 'ssh');
    assert.deepEqual(await page.locator('.panel-name').allTextContents(), ['Solta'], 'filtro por protocolo');
    await page.fill('#panel-filter', '');

    await row('Lab Online').click();
    await page.waitForSelector('#panel-dialog', { state: 'hidden' });
    await page.locator('#tabs .tab', { hasText: 'Lab Online' }).waitFor({ timeout: 15000 });
    assert.ok(accepted >= 2, 'o clique conectou de verdade (além do teste de status)');
    console.log('PASS: painel lista tudo, pinta status, filtra por pasta/texto e conecta com um clique.');
  } finally { await app?.close(); lab.close(); fs.rmSync(scratch, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
