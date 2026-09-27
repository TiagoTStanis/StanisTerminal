const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { labServer } = require('./tightvnc-lab.cjs');

(async () => {
  const root = path.resolve(__dirname, '..'), lab = await labServer({ password: '', rfb: true });
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.STANIS_TEST_USERDATA;
  let app;
  try {
    app = await electron.launch({ executablePath: process.env.STANIS_TEST_EXE || require('electron'), args: process.env.STANIS_TEST_EXE ? ['--test-mode'] : [root, '--test-mode'], env });
    const page = await app.firstWindow(); await page.waitForSelector('#new-session');
    await page.click('#new-session'); await page.locator('[name=name]').fill('VNC produtividade');
    await page.locator('[name=type]').selectOption('vnc'); await page.locator('[name=host]').fill('127.0.0.1');
    await page.locator('#dialog-advanced summary').click(); await page.locator('[name=port]').fill(String(lab.port)); await page.click('#dialog-ok');
    await page.locator('.tree-row.session .tree-main').filter({ hasText: 'VNC produtividade' }).click();
    await page.waitForFunction(() => document.querySelector('#status').textContent === 'VNC conectado.');
    const mounted = page.locator('.graphic-mount'), bar = page.locator('.graphic-toolbar');
    const screenBox = await mounted.boundingBox(), barBox = await bar.boundingBox();
    assert.ok(barBox.y + barBox.height <= screenBox.y + 1, 'barra fixa não cobre a tela remota');
    await app.evaluate(({ clipboard }) => clipboard.writeText('COLAGEM-LOCAL'));
    lab.keys.length = 0;
    await bar.getByRole('button', { name: '📋 Colar texto', exact: true }).click();
    await page.waitForTimeout(800);
    assert.ok(lab.clipboards.includes('COLAGEM-LOCAL'), 'botão envia conteúdo');
    assert.ok(lab.keys.includes('76:1') && lab.keys.includes('76:0'), 'botão também envia o comando de colar');
    await page.click('#add-tab'); await page.waitForSelector('.xterm');
    await app.evaluate(({ clipboard }) => clipboard.writeText('LOCAL-PRESERVADO'));
    lab.sendClipboard('REMOTO-EM-SEGUNDO-PLANO'); await page.waitForTimeout(500);
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), 'LOCAL-PRESERVADO');
    assert.ok(!lab.clipboards.includes('LOCAL-PRESERVADO'), 'sessão oculta não recebe clipboard local');
    await page.locator('#tabs .tab').first().click();
    assert.equal(await page.evaluate(() => document.activeElement.tagName), 'CANVAS', 'trocar de aba devolve foco ao remoto');
    lab.sendClipboard('REMOTO-ATIVO'); await page.waitForTimeout(400);
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), 'REMOTO-ATIVO');
    await page.keyboard.press('Control+Tab');
    assert.ok(await page.locator('.pane:not([hidden]) .xterm').count());
    await page.keyboard.press('Control+Shift+Tab');
    await page.keyboard.type('a'); await page.waitForTimeout(250);
    assert.ok(lab.keys.includes('61:1'), 'teclado funciona após alternar por atalho');
    await bar.getByRole('button', { name: '⛶ Tela cheia', exact: true }).click();
    await page.waitForFunction(() => !!document.fullscreenElement);
    await page.keyboard.press('Control+Tab');
    await page.waitForFunction(() => !document.fullscreenElement && !!document.querySelector('.pane:not([hidden]) .xterm'));
    console.log('PASS: trocar de aba sai da tela cheia sem deixar o painel vazio.');
    console.log('PASS: barra sem sobreposição, botão colar, isolamento de clipboard entre abas e foco VNC.');
  } finally { await app?.close(); lab.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
