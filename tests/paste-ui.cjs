// Colar no terminal: (1) switch de laboratório com buffer pequeno (Telnet, localhost) recebe todas as linhas;
// (2) copiar no terminal e colar em seguida cola o texto recém-copiado. Nada é digitado fora do app.
const { _electron: electron } = require('playwright');
const net = require('node:net');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

(async () => {
  // Descarta o que passar de 256 bytes chegando em menos de 20 ms, como um switch com buffer de entrada pequeno.
  let received = '', windowStart = 0, inWindow = 0, dropped = 0;
  const server = net.createServer(s => { s.on('error', () => {}); s.write('SW-LAB#'); s.on('data', d => {
    const now = Date.now(); if (now - windowStart > 20) { windowStart = now; inWindow = 0; }
    const room = Math.max(0, 256 - inWindow); received += d.subarray(0, room).toString('latin1'); dropped += Math.max(0, d.length - room); inWindow += d.length; }); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  let app;
  try {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({ executablePath: require('electron'), args: [root, '--test-mode'], env });
    const page = await app.firstWindow(); await page.waitForSelector('#sessions-list .tree-section');
    const setClip = text => app.evaluate(({ clipboard }, t) => clipboard.writeText(t), text);

    await page.click('#new-session'); await page.locator('[name=name]').fill('SW buffer'); await page.locator('[name=type]').selectOption('telnet'); await page.locator('[name=host]').fill('127.0.0.1');
    await page.locator('#dialog-advanced summary').click(); await page.locator('[name=port]').fill(String(server.address().port)); await page.click('#dialog-ok');
    await page.locator('.tree-row.session .tree-main').filter({ hasText: 'SW buffer' }).click(); await page.waitForTimeout(1500);
    const config = Array.from({ length: 40 }, (_, i) => `interface GigabitEthernet1/0/${i + 1}\r\n description PORTA-${String(i + 1).padStart(2, '0')}`).join('\r\n');
    await setClip(config); await page.locator('.xterm').first().click(); await page.keyboard.press('Control+V'); await page.locator('#dialog-ok').click();
    await page.waitForFunction(() => true); await new Promise(r => setTimeout(r, 6000));
    const got = received.split('\r').filter(Boolean), expected = config.split('\r\n');
    assert.equal(dropped, 0, `o "switch" descartou ${dropped} bytes`);
    assert.deepEqual(expected.filter(line => !got.includes(line)), [], 'todas as linhas chegam inteiras');
    console.log('PASS: colar 80 linhas num switch com buffer pequeno (Telnet) chega tudo, linha por linha.');

    await page.click('#welcome-local').catch(() => page.click('#add-tab'));
    await page.waitForFunction(() => [...document.querySelectorAll('.pane:not([hidden]) .xterm-rows')].some(r => r.textContent.includes('PS ')), null, { timeout: 20000 });
    for (let i = 0; i < 8; i++) {
      const token = `TOKEN${i}X${Date.now() % 10000}`;
      await setClip(`Write-Output ${token}`); await page.locator('.pane:not([hidden]) .xterm').click(); await page.keyboard.press('Control+V'); await page.keyboard.press('Enter');
      await page.waitForFunction(t => [...document.querySelectorAll('.pane:not([hidden]) .xterm-rows > div')].some(r => r.textContent.trim() === t), token, { timeout: 5000 });
      await setClip('TEXTO-ANTIGO');
      const row = await page.locator('.pane:not([hidden]) .xterm-rows > div').filter({ hasText: new RegExp(`^${token}\\s*$`) }).last().boundingBox();
      await page.mouse.dblclick(row.x + 20, row.y + row.height / 2);
      await page.keyboard.press('Control+C'); await page.keyboard.press('Control+V'); await page.waitForTimeout(400);
      const line = await page.evaluate(() => { const rows = [...document.querySelectorAll('.pane:not([hidden]) .xterm-rows > div')].map(r => r.textContent.trimEnd()).filter(Boolean); return rows[rows.length - 1]; });
      assert.ok(line.includes(token) && !line.includes('TEXTO-ANTIGO'), `colou o texto recém-copiado: ${line}`);
      await page.keyboard.press('Control+C'); await page.waitForTimeout(300);
    }
    console.log('PASS: copiar no terminal e colar em seguida cola o texto recém-copiado (8/8).');
  } finally { await app?.close().catch(() => {}); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
