const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

(async () => {
  const root = path.resolve(__dirname, '..'), scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-isolation-'));
  const target = path.join(scratch, 'test-data'), portable = path.join(scratch, 'portable');
  const env = { ...process.env, STANIS_TEST_USERDATA: target, PORTABLE_EXECUTABLE_DIR: portable }; delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await electron.launch({ executablePath: process.env.STANIS_TEST_EXE || require('electron'), args: process.env.STANIS_TEST_EXE ? ['--test-mode'] : [root, '--test-mode'], env });
    const page = await app.firstWindow(); await page.waitForSelector('#welcome-local');
    const state = await page.evaluate(() => window.api.call('init'));
    assert.equal(path.resolve(state.dataPath), target, 'pasta explícita do teste tem prioridade sobre o portátil');
    assert.equal(path.resolve(state.home), path.join(target, 'test-home'));
    assert.equal(fs.existsSync(portable), false, 'teste não cria dados na pasta do usuário do portátil');
    await page.click('#welcome-local');
    await page.waitForFunction(() => document.querySelector('.xterm-rows')?.textContent.includes('test-home'));
    await page.click('#toggle-files'); await page.waitForSelector('.file-row');
    assert.deepEqual(await page.locator('.file-name').allTextContents(), ['exemplo.txt']);
    console.log('PASS: dados, terminal e painel de arquivos de teste isolados das pastas reais.');
  } finally { await app?.close(); fs.rmSync(scratch, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
