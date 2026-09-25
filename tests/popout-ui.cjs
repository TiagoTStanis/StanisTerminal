// Sessão em janela separada: o painel vai vivo para outra janela (sem reconectar), recebe teclado lá e volta
// pelo botão "Trazer janelas" ou ao fechar a janela. Servidores de laboratório em localhost.
const { _electron: electron } = require('playwright');
const path = require('node:path');
const assert = require('node:assert/strict');
const { labServer } = require('./tightvnc-lab.cjs');
const root = path.resolve(__dirname, '..');

(async () => {
  const lab = await labServer({ password: '', rfb: true });
  let app;
  try {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({ executablePath: require('electron'), args: [root, '--test-mode'], env });
    const page = await app.firstWindow(); await page.waitForSelector('#sessions-list .tree-section');
    const errors = []; page.on('pageerror', error => { if (!/Invalid guestInstanceId/.test(error.message)) errors.push(error.message); });
    await page.click('#new-session'); await page.locator('[name=name]').fill('VNC destacar'); await page.locator('[name=type]').selectOption('vnc'); await page.locator('[name=host]').fill('127.0.0.1');
    await page.locator('#dialog-advanced summary').click(); await page.locator('[name=port]').fill(String(lab.port)); await page.click('#dialog-ok');
    await page.locator('.tree-row.session .tree-main').filter({ hasText: 'VNC destacar' }).click();
    await page.waitForFunction(() => document.querySelector('#status').textContent === 'VNC conectado.', null, { timeout: 15000 });
    await page.click('#welcome-local').catch(() => page.click('#add-tab')); await page.waitForFunction(() => document.querySelectorAll('#tabs .tab').length === 2);

    // Destaca a sessão VNC pelo botão da aba.
    const opened = app.waitForEvent('window');
    await page.locator('#tabs .tab', { hasText: 'VNC destacar' }).hover(); await page.locator('#tabs .tab', { hasText: 'VNC destacar' }).locator('.tab-detach').click();
    const child = await opened; await child.waitForSelector('.graphic-mount canvas');
    assert.equal(await page.locator('#panes .graphic-mount').count(), 0, 'o painel VNC saiu da janela principal');
    assert.ok(await page.locator('#dock-all').isVisible(), 'botão "Trazer janelas" aparece');
    assert.match(await child.title(), /VNC destacar/);
    // A tela continua viva lá (não reconectou) e o teclado vai para o servidor.
    await child.locator('.graphic-mount canvas').click(); lab.keys.length = 0;
    await child.keyboard.type('ab'); await child.waitForTimeout(300);
    assert.deepEqual(lab.keys, ['61:1', '61:0', '62:1', '62:0'], 'teclas digitadas na janela separada chegam ao servidor');
    // Redimensionar a janela separada reajusta a tela (modo ajustar).
    const before = await child.evaluate(() => document.querySelector('.graphic-mount canvas').getBoundingClientRect().width);
    await child.setViewportSize({ width: 1000, height: 700 }); await child.waitForTimeout(500);
    const after = await child.evaluate(() => document.querySelector('.graphic-mount canvas').getBoundingClientRect().width);
    assert.notEqual(Math.round(before), Math.round(after), 'a tela acompanha o tamanho da janela separada');
    console.log('PASS: sessão VNC em janela separada, viva, com teclado e ajuste ao tamanho da janela.');

    // "Trazer janelas" devolve e fecha a janela separada.
    await page.click('#dock-all');
    await page.waitForSelector('#panes .graphic-mount canvas');
    await page.waitForFunction(() => document.querySelector('#dock-all').hidden);
    assert.equal(app.windows().length, 1, 'a janela separada fecha');
    console.log('PASS: "Trazer janelas" devolve a sessão para as abas.');

    // Destaca o terminal e fecha a janela pelo X: a sessão volta (não é encerrada).
    const opened2 = app.waitForEvent('window');
    await page.locator('#tabs .tab', { hasText: /PowerShell|Terminal|cmd/i }).first().hover(); await page.locator('#tabs .tab', { hasText: /PowerShell|Terminal|cmd/i }).first().locator('.tab-detach').click();
    const child2 = await opened2; await child2.waitForSelector('.xterm');
    await child2.close();
    await page.waitForFunction(() => document.querySelectorAll('#panes .xterm').length === 1 && document.querySelectorAll('#tabs .tab').length === 2);
    console.log('PASS: fechar a janela separada devolve o terminal sem encerrar a sessão.');
    // Sessão do tipo Link: selo WEB na lista, abre numa aba; o botão 🌐 leva ao navegador padrão (interceptado aqui).
    const http = require('node:http'); const site = http.createServer((q, r) => r.end('<title>painel</title>ok')); await new Promise(r => site.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${site.address().port}/admin`;
    await app.evaluate(({ shell }) => { global.openedLinks = []; shell.openExternal = async url => { global.openedLinks.push(url); }; });
    await page.click('#new-session'); await page.locator('[name=name]').fill('Painel do firewall'); await page.locator('[name=type]').selectOption('web');
    await page.locator('[name=url]').fill(url); await page.click('#dialog-ok');
    const row = page.locator('.tree-row.session', { hasText: 'Painel do firewall' });
    assert.equal(await row.locator('.badge').textContent(), 'WEB');
    await row.locator('.tree-main').click();
    await page.waitForFunction(() => document.querySelector('.pane:not([hidden]) webview')?.getTitle() === 'painel', null, { timeout: 15000 });
    assert.equal(await page.locator('#tabs .tab', { hasText: 'Painel do firewall' }).count(), 1, 'link abre numa aba');
    await page.locator('.web-toolbar button', { hasText: 'Navegador' }).click(); await page.waitForTimeout(300);
    assert.deepEqual(await app.evaluate(() => global.openedLinks), [url]);
    site.close();
    console.log('PASS: sessão Link com selo WEB abre numa aba e o botão 🌐 leva ao navegador padrão.');
    assert.deepEqual(errors, [], 'sem erros no renderer');
  } finally { await app?.close().catch(() => {}); lab.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
