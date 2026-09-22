// Gera capturas de tela em test-results/ com dados de exemplo (para revisar o visual).
const { _electron: electron } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');
(async () => {
  const root = path.resolve(__dirname, '..'); const out = path.join(root, 'test-results'); fs.mkdirSync(out, { recursive: true });
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const theme = process.argv[2] || 'light';
  const app = await electron.launch({ executablePath: require('electron'), args: [root, '--test-mode'], env, timeout: 30000 });
  const page = await app.firstWindow(); await page.setViewportSize({ width: 1360, height: 820 });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  try {
    await page.waitForSelector('#sessions-list .tree-section');
    const call = (...a) => page.evaluate(a => window.api.call(...a), a);
    for (const p of [
      { name: 'Servidor web', group: 'Clientes/Acme', type: 'ssh', host: 'web.acme.com', username: 'deploy' },
      { name: 'Banco de dados', group: 'Clientes/Acme', type: 'ssh', host: '10.0.0.12', username: 'admin' },
      { name: 'Área de trabalho', group: 'Clientes/Beta', type: 'rdp', host: 'desk.beta.local', username: 'ana', password: 'x' },
      { name: 'Câmera do laboratório', group: 'Laboratório', type: 'vnc', host: '192.168.0.50' },
      { name: 'Switch core', group: 'Laboratório', type: 'telnet', host: '192.168.0.1' }]) await call('profile:save', p);
    await call('folder:create', 'Pessoal/Estudos');
    await page.evaluate(theme => window.api.call('settings:save', { fontSize: 14, theme, scrollback: 10000 }), theme);
    await page.reload(); await page.waitForSelector('#sessions-list .tree-section');
    await page.click('#welcome-local'); await page.waitForFunction(() => document.querySelector('.xterm-rows')?.textContent.includes('PS '), { timeout: 20000 });
    await page.locator('.xterm-helper-textarea').first().pressSequentially('Get-ChildItem | Select-Object -First 5', { delay: 5 }); await page.keyboard.press('Enter'); await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(out, `ui-${theme}-main.png`) });
    await page.click('#open-packages'); await page.waitForSelector('#packages-dialog[open]');
    await page.screenshot({ path: path.join(out, `ui-${theme}-packages.png`) });
    await page.click('#packages-dialog .tab-btn:has-text("Listas")'); await page.waitForTimeout(200);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await page.click('#new-session'); await page.waitForSelector('#form-dialog[open]'); await page.selectOption('[name=type]', 'rdp'); await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(out, `ui-${theme}-form.png`) });
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    await page.locator('.tree-row.folder').first().click({ button: 'right' }); await page.waitForSelector('.ctx-menu');
    await page.screenshot({ path: path.join(out, `ui-${theme}-menu.png`) });
    console.log('ok', theme);
  } finally { await app.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
