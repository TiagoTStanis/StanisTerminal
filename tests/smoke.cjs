const { _electron: electron } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const root = path.resolve(__dirname, '..');
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const executablePath = process.env.STANIS_TEST_EXE || require('electron');
  const app = await electron.launch({ executablePath, args: process.env.STANIS_TEST_EXE ? ['--test-mode'] : [root, '--test-mode'], env, timeout: 30000 });
  const page = await app.firstWindow();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.waitForSelector('#sessions-list .tree-section');
    await page.screenshot({ path: path.join(root, 'test-results/welcome.png') });
    await page.click('#welcome-local');
    await page.waitForSelector('.xterm');
    await page.waitForFunction(() => document.querySelector('.xterm-rows')?.textContent.includes('PS '), { timeout: 20000 });
    await page.locator('.xterm-helper-textarea').fill('');
    await page.locator('.xterm-helper-textarea').pressSequentially("Write-Output ('STANIS_' + 'PTY_OK')", { delay: 20 });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.xterm-rows')?.textContent.includes('STANIS_PTY_OK'));
    // Ctrl+V seguido de Enter na hora: o texto colado tem de chegar ao shell antes do Enter (antes, às vezes
    // o Enter passava na frente). Linha com quebra no fim cola sem perguntar.
    for (let round = 0; round < 10; round++) {
      await app.evaluate(({ clipboard }, n) => clipboard.writeText(`Write-Output ('COLA_' + '${n}')` + (n % 2 ? '\r\n' : '')), round);
      await page.keyboard.press('Control+V'); await page.keyboard.press('Enter');
      await page.waitForFunction(n => document.querySelector('.xterm-rows')?.textContent.includes(`COLA_${n}`) && !document.querySelector('dialog[open]'), round, { timeout: 5000 });
    }
    console.log('PASS: Ctrl+V + Enter no terminal cola na ordem (10/10) e sem perguntar para uma linha só.');
    await page.click('#add-tab'); await page.waitForFunction(() => document.querySelectorAll('.tab').length === 2);
    await page.click('#split'); await page.waitForSelector('#panes.split');
    assert.equal(await page.locator('.pane:visible').count(), 2);
    await page.click('#toggle-files'); await page.waitForSelector('.file-row');
    await page.screenshot({ path: path.join(root, 'test-results/terminal.png') });
    await page.click('#new-session');
    await page.locator('[name=name]').fill('Servidor de teste'); await page.locator('[name=host]').fill('127.0.0.1'); await page.locator('[name=username]').fill('tester'); await page.click('#dialog-ok');
    await page.waitForSelector('.tree-name:text("Servidor de teste")');
    const config = await page.evaluate(() => window.api.call('init'));
    assert.equal(config.config.profiles.length, 1);
    assert.equal(config.config.profiles[0].host, '127.0.0.1');
    assert(!JSON.stringify(config.config).includes('password'));
    const isolated = await page.evaluate(() => ({ require: typeof window.require, process: typeof window.process }));
    assert.deepEqual(isolated, { require: 'undefined', process: 'undefined' });
    await page.click('#settings');
    await page.locator('[name=theme]').selectOption('light'); await page.locator('[name=fontSize]').fill('16'); await page.click('#dialog-ok');
    await page.waitForSelector('body.light');
    await page.click('#add-snippet'); await page.locator('[name=name]').fill('Ver diretório'); await page.locator('[name=command]').fill('Get-Location'); await page.click('#dialog-ok');
    await page.waitForSelector('#snippets button:has-text("Ver diretório")');
    const persisted = await app.evaluate(({ app }) => JSON.parse(process.getBuiltinModule('fs').readFileSync(process.getBuiltinModule('path').join(app.getPath('userData'), 'config.json'), 'utf8')));
    assert.equal(persisted.settings.theme, 'light'); assert.equal(persisted.settings.fontSize, 16); assert.equal(persisted.snippets[0].command, 'Get-Location');
    await page.click('#settings'); await page.locator('[name=theme]').selectOption('dark'); await page.click('#dialog-ok');
    await page.screenshot({ path: path.join(root, 'test-results/terminal.png') });
    assert.deepEqual(errors, []);
    console.log('PASS: executável inicia, PowerShell interativo, saída PTY, abas, divisão, arquivos, perfil/preferências/comando rápido persistidos, tema claro/escuro, renderer isolado.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
