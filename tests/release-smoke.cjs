const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

(async () => {
  const executablePath = process.env.STANIS_TEST_EXE;
  assert.ok(executablePath && fs.existsSync(executablePath), 'defina STANIS_TEST_EXE para a pasta do release já extraída');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-release-smoke-'));
  const data = path.join(scratch, 'StanisTerminal-data'); fs.mkdirSync(data);
  const site = http.createServer((request, response) => { response.setHeader('Content-Type', 'text/html'); response.end('<title>Release synthetic smoke</title><p>ok</p>'); });
  await new Promise(resolve => site.listen(0, '127.0.0.1', resolve));
  const config = { version: 1, profiles: [{ id: 'smoke-local', name: 'Perfil sintético', type: 'web', group: 'Teste', url: `http://127.0.0.1:${site.address().port}/` }], snippets: [], folders: [], macros: [], scripts: [], packageLists: [], tools: {}, settings: { fontSize: 14, theme: 'light', scrollback: 1000, restoreSessions: false, highlightErrors: false } };
  fs.writeFileSync(path.join(data, 'config.json'), JSON.stringify(config));
  const env = { ...process.env, PORTABLE_EXECUTABLE_DIR: scratch, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' }; delete env.ELECTRON_RUN_AS_NODE; delete env.STANIS_TEST_USERDATA;
  let app;
  try {
    app = await electron.launch({ executablePath, args: [], env, timeout: 45000 });
    const page = await app.firstWindow(); await page.waitForSelector('#sessions-list .tree-section', { timeout: 30000 });
    const state = await page.evaluate(() => window.api.call('init'));
    assert.equal(state.version, require('../package.json').version);
    assert.equal(path.resolve(state.dataPath), data, 'a distribuição usa a pasta de dados portátil configurada');
    assert.equal(state.config.profiles.length, 1);
    assert.equal(await page.locator('.tree-row.session').filter({ hasText: 'Perfil sintético' }).count(), 1, 'renderizou um perfil local fictício');
    await page.locator('.tree-row.session').filter({ hasText: 'Perfil sintético' }).locator('.tree-main').click();
    await page.waitForFunction(() => document.querySelectorAll('#tabs .tab').length === 1);
    await page.keyboard.press('Control+Shift+P');
    assert.equal(await page.locator('#session-picker').isVisible(), true, 'busca abre no executável do release');
    await page.locator('#session-filter').fill('sintético');
    assert.equal(await page.locator('#session-results button').count(), 1);
    console.log('PASS: ZIP extraído executa o Electron empacotado, carrega dados isolados e pesquisa um perfil sintético.');
  } finally {
    await app?.close(); site.close(); fs.rmSync(scratch, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
