// Consumo de RAM: o rodapé mostra a memória do aplicativo (com detalhe por processo) e o renderer pode
// forçar a coleta de lixo depois de fechar sessões (senão o Chromium segura a memória dos terminais fechados).
const { _electron: electron } = require('playwright');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const root = path.resolve(__dirname, '..'), scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-memory-'));
  const env = { ...process.env, STANIS_TEST_USERDATA: path.join(scratch, 'data') }; delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await electron.launch({ executablePath: process.env.STANIS_TEST_EXE || require('electron'), args: process.env.STANIS_TEST_EXE ? ['--test-mode'] : [root, '--test-mode'], env, timeout: 30000 });
    const page = await app.firstWindow(); await page.waitForSelector('#sessions-list .tree-section');
    await page.waitForFunction(() => /RAM \d+ MB/.test(document.querySelector('#memory').textContent), null, { timeout: 15000 });
    const title = await page.locator('#memory').getAttribute('title');
    assert.match(title, /Browser: \d+ MB/, 'detalhe por processo no tooltip');
    assert.match(title, /Tab: \d+ MB/);
    assert.equal(await page.evaluate(() => typeof window.gc), 'function', 'gc() exposto para liberar memória depois de fechar sessões');
    const { total } = await page.evaluate(() => window.api.call('app:memory'));
    assert.ok(total > 50 && total < 4000, `total plausível (${total} MB)`);
    console.log(`PASS: indicador de RAM no rodapé (${total} MB) e coleta de lixo disponível.`);
  } finally { await app?.close(); fs.rmSync(scratch, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
