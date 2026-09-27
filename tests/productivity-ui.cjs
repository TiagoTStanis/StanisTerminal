const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');

(async () => {
  const root = path.resolve(__dirname, '..');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.STANIS_TEST_USERDATA;
  const app = await electron.launch({ executablePath: process.env.STANIS_TEST_EXE || require('electron'), args: process.env.STANIS_TEST_EXE ? ['--test-mode'] : [root, '--test-mode'], env });
  const site = http.createServer((req, res) => res.end('<title>Lab produtividade</title><input autofocus>'));
  let page;
  try {
    page = await app.firstWindow();
    await page.waitForSelector('#welcome-local');
    await page.setViewportSize({ width: 1100, height: 720 });
    await page.click('#welcome-local');
    for (let i = 1; i < 12; i++) { await page.click('#add-tab'); await page.waitForFunction(n => document.querySelectorAll('#tabs .tab').length === n, i + 1); }
    const geometry = await page.evaluate(() => {
      const box = document.querySelector('#tabs').getBoundingClientRect(), active = document.querySelector('#tabs .active').getBoundingClientRect();
      return { visible: active.left >= box.left - 1 && active.right <= box.right + 1, width: active.width, available: box.width };
    });
    console.log('Abas:', JSON.stringify(geometry));
    assert.ok(geometry.visible, 'nova aba ativa deve estar inteiramente visível');
    const lastId = await page.locator('#tabs .active').getAttribute('data-id');
    await page.keyboard.press('Control+Tab');
    await page.waitForFunction(() => document.querySelector('#tabs .tab')?.classList.contains('active'));
    await page.keyboard.press('Control+Shift+Tab');
    assert.equal(await page.locator('#tabs .active').getAttribute('data-id'), lastId);
    await page.keyboard.press('F11');
    assert.ok(await page.locator('.tabbar').isVisible(), 'modo foco preserva acesso às abas');
    await page.click('#session-switcher');
    await page.locator('#session-filter').fill('não existe');
    assert.equal(await page.locator('#session-results button').count(), 0);
    await page.locator('#session-filter').fill('PowerShell');
    assert.equal(await page.locator('#session-results button').count(), 12);
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#session-picker').isVisible(), false);
    await page.keyboard.press('F11');
    await page.setViewportSize({ width: 820, height: 620 });
    await page.waitForTimeout(250);
    assert.ok(await page.locator('#session-switcher').isVisible());
    assert.ok(await page.locator('#add-tab').isVisible());
    for (const id of ['settings', 'toggle-files', 'topbar-more', 'toolbar-more', 'session-switcher']) {
      const box = await page.locator('#' + id).boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= 820, `${id} cabe na janela estreita`);
    }
    await page.screenshot({ path: path.join(root, 'test-results/productivity.png') });
    await new Promise(resolve => site.listen(0, '127.0.0.1', resolve));
    await page.click('#new-session'); await page.locator('[name=name]').fill('Web produtividade');
    await page.locator('[name=type]').selectOption('web'); await page.locator('[name=url]').fill(`http://127.0.0.1:${site.address().port}/`); await page.click('#dialog-ok');
    await page.locator('.tree-row.session .tree-main').filter({ hasText: 'Web produtividade' }).click();
    await page.waitForFunction(() => document.querySelector('.pane:not([hidden]) webview')?.getTitle() === 'Lab produtividade');
    await page.evaluate(() => {
      const view = document.querySelector('.pane:not([hidden]) webview'); view.focus();
      view.sendInputEvent({ type: 'keyDown', keyCode: 'Tab', modifiers: ['control'] });
      view.sendInputEvent({ type: 'keyUp', keyCode: 'Tab', modifiers: ['control'] });
    });
    await page.waitForFunction(() => !!document.querySelector('.pane:not([hidden]) .xterm'));
    await page.keyboard.press('Control+Shift+Tab');
    await page.waitForFunction(() => !!document.querySelector('.pane:not([hidden]) webview'));
    console.log('PASS: Ctrl+Tab dentro da página web troca a sessão do aplicativo.');
    console.log('PASS: 12 abas, seleção visível, atalhos, busca, modo foco e janela estreita.');
  } finally {
    await page?.evaluate(async () => {
      const ids = [...document.querySelectorAll('#tabs .tab')].map(tab => tab.dataset.id);
      await Promise.all(ids.map(id => window.api.call('terminal:close', id).catch(() => {})));
      for (const view of document.querySelectorAll('webview')) view.remove();
    }).catch(() => {});
    await app.close(); site.closeAllConnections?.(); site.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
