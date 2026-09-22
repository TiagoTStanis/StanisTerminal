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
  const type = async text => { await page.locator('.pane:not([hidden]) .xterm-helper-textarea').first().pressSequentially(text, { delay: 15 }); };
  const screen = () => page.evaluate(() => [...document.querySelectorAll('.xterm-rows')].map(x => x.textContent));
  try {
    await page.waitForSelector('#sessions-list .tree-section');
    await page.click('#welcome-local'); await page.waitForFunction(() => document.querySelector('.xterm-rows')?.textContent.includes('PS '), { timeout: 20000 });

    // Histórico + sugestão: um comando executado passa a ser sugerido pelo prefixo.
    await type("Write-Output 'HIST_ALFA'"); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.xterm-rows').textContent.includes('HIST_ALFA'));
    await type("Write-Output 'HIST"); await page.waitForSelector('.suggest:not([hidden]) .suggest-item');
    assert.ok((await page.locator('.suggest-item').first().textContent()).includes("HIST_ALFA"));
    await page.keyboard.press('Control+Space'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => (document.querySelector('.xterm-rows').textContent.match(/HIST_ALFA/g) || []).length >= 3);

    // Senhas não entram no histórico: prompt com "password:" antes da digitação.
    const history = () => page.evaluate(() => window.api.call('history:load'));
    await type("Read-Host 'Password'"); await page.keyboard.press('Enter');
    await page.waitForFunction(() => /Password:\s*$/.test(document.querySelector('.xterm-rows').textContent.trim()) || document.querySelector('.xterm-rows').textContent.includes('Password:'));
    await type('segredo123'); await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 2500));
    assert.ok(!(await history()).includes('segredo123'), 'senha não pode ir para o histórico');
    assert.ok((await history()).some(c => c.includes('HIST_ALFA')));

    // Digitar em todos os painéis visíveis.
    await page.click('#add-tab'); await page.waitForFunction(() => document.querySelectorAll('.tab').length === 2);
    await page.waitForFunction(() => [...document.querySelectorAll('.xterm-rows')].every(x => x.textContent.includes('PS ')));
    await page.click('#split'); await page.waitForSelector('#panes.split');
    await page.click('#broadcast-live'); await page.waitForSelector('#broadcast-live.on');
    await page.locator('.pane:not([hidden]) .xterm-helper-textarea').first().focus();
    await type("Write-Output ('ECO_' + 'TODOS')"); await page.keyboard.press('Enter');
    await page.waitForFunction(() => [...document.querySelectorAll('.xterm-rows')].filter(x => x.textContent.includes('ECO_TODOS')).length >= 2, { timeout: 15000 });
    await page.click('#broadcast-live');

    // Macro: gravar e executar.
    await page.click('#macros'); await page.selectOption('[name=action]', 'record'); await page.click('#dialog-ok');
    await page.waitForSelector('#macros.on');
    await page.locator('.pane:not([hidden]) .xterm-helper-textarea').first().focus();
    await type("Write-Output ('MACRO_' + 'UM')"); await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 400));
    await page.click('#macros'); await page.locator('[name=name]').fill('minha macro'); await page.click('#dialog-ok');
    await page.waitForFunction(() => window.api.call('init').then(s => s.config.macros?.length === 1));
    await page.click('#macros'); await page.selectOption('[name=action]', 'play:0'); await page.click('#dialog-ok');
    await page.waitForSelector('#dialog-ok:visible'); await page.click('#dialog-ok');
    await page.waitForFunction(() => (document.querySelector('.pane:not([hidden]) .xterm-rows, .xterm-rows').textContent.match(/MACRO_UM/g) || []).length >= 1, { timeout: 15000 });

    // Script Lua: criar, confirmar e executar no PowerShell real (com expect).
    await page.click('#scripts'); await page.selectOption('[name=action]', 'new'); await page.click('#dialog-ok');
    await page.locator('[name=name]').fill('lua teste');
    await page.locator('[name=code]').fill("sendln(\"Write-Output ('LUA_' + 'OK')\")\nif expect('LUA_OK', 8000) then log('achou') end\nsendln(\"Write-Output ('LUA_' + 'FIM')\")");
    await page.click('#dialog-ok');
    await page.waitForFunction(() => window.api.call('init').then(s => s.config.scripts?.length === 1));
    await page.locator('.pane:not([hidden]) .xterm-helper-textarea').first().focus();
    await page.click('#scripts'); await page.selectOption('[name=action]', 'run:0'); await page.click('#dialog-ok');
    await page.waitForSelector('#dialog-ok:visible'); await page.click('#dialog-ok');
    await page.waitForFunction(() => [...document.querySelectorAll('.xterm-rows')].some(x => (x.textContent.match(/LUA_FIM/g) || []).length >= 1), { timeout: 20000 });

    // Ferramentas novas, temas e sessões Rlogin/Rsh.
    await page.click('#open-tools');
    const names = await page.locator('#tool-grid button').allTextContents();
    for (const expected of ['Proxy SOCKS5', 'Túnel SSH remoto', 'Servidor TFTP', 'Servidor FTP', 'Servidor SFTP', 'Sincronizar (enviar)', 'Servidor VNC', 'Ferramentas verificadas']) assert.ok(names.some(n => n.includes(expected)), expected);
    await page.click('#tools-close');
    await page.click('#settings'); await page.locator('[name=theme]').selectOption('dracula'); await page.click('#dialog-ok');
    await page.waitForSelector('body.t-dracula');
    await page.click('#new-session'); await page.locator('[name=name]').fill('Legado'); await page.locator('[name=type]').selectOption('rsh');
    await page.locator('[name=host]').fill('127.0.0.1'); await page.locator('[name=command]').fill('uname -a'); await page.click('#dialog-ok');
    await page.waitForSelector('.tree-name:text("Legado")');
    const saved = (await page.evaluate(() => window.api.call('init'))).config.profiles.find(p => p.name === 'Legado');
    assert.equal(saved.type, 'rsh'); assert.equal(saved.port, 514); assert.equal(saved.command, 'uname -a');
    await page.screenshot({ path: path.join(root, 'test-results/extras.png') });
    assert.deepEqual(errors, []);
    console.log('PASS: histórico e sugestões (sem senhas), digitação em todos os painéis, macros, ferramentas novas, temas, Rsh.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
