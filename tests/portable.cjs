const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const root = path.resolve(__dirname, '..');
  const executable = path.join(root, `dist/StanisTerminal-${require('../package.json').version}-win-x64.exe`);
  const probe = net.createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening'); const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(executable, ['--test-mode', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=' + port], { env, windowsHide: true, stdio: 'ignore' });
  const finished = once(child, 'exit'); let browser;
  try {
    const deadline = Date.now() + 120000; let available = false;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error('O portátil encerrou antes de abrir a interface.');
      try { const response = await fetch(`http://127.0.0.1:${port}/json/version`); if (response.ok) { available = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert(available, 'O lançador portátil não abriu o aplicativo em 120 segundos.');
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const context = browser.contexts()[0]; let page = context.pages().find(p => p.url().startsWith('stanis://'));
    if (!page) { page = await context.waitForEvent('page'); await page.waitForURL('stanis://app/index.html'); }
    await page.waitForSelector('#welcome-local');
    const state = await page.evaluate(() => window.api.call('init')); assert.equal(state.version, require('../package.json').version); assert.equal(state.testMode, true);
    assert(!state.dataPath.includes('StanisTerminal-data'), 'O teste portátil usou dados reais.');
    await page.click('#welcome-local'); await page.waitForSelector('.xterm-helper-textarea');
    await page.waitForFunction(() => document.querySelector('.xterm-rows').textContent.includes('PS '));
    await page.locator('.xterm-helper-textarea').pressSequentially("Write-Output ('PORTABLE_' + 'OK')", { delay: 15 }); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.xterm-rows').textContent.includes('PORTABLE_OK'));
    await page.screenshot({ path: path.join(root, 'test-results/portable.png') });
    await page.close();
    await Promise.race([finished, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Lançador não encerrou')), 30000); timer.unref(); })]);
    console.log('PASS: lançador portátil extrai, abre a versão atual, executa PowerShell real em dados isolados e encerra.');
  } finally {
    if (browser) await browser.close();
    if (child.exitCode === null) child.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
