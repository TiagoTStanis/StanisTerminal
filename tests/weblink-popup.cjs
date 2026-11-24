// window.open() em aba de Link: *.cruzeirodosul.edu.br abre o popup (o portal da faculdade trava com alert se vier null);
// outro domínio continua sem popup (window.open devolve null). O DNS do teste é desviado para o servidor local.
const { _electron: electron } = require('playwright');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

(async () => {
  const server = https.createServer({ key: fs.readFileSync(path.join(__dirname, 'fixtures/localhost-key.pem')), cert: fs.readFileSync(path.join(__dirname, 'fixtures/localhost-cert.pem')) }, (req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(req.url.startsWith('/blank') ? '<title>BL</title><script>const w = window.open(""); document.title = w ? "ABRIU" : "BLOQUEADO";</script>' : req.url.startsWith('/popup') ? '<title>POPUP</title>ok' : '<title>X</title><script>const w = window.open("/popup", "_blank"); document.title = w ? "ABRIU" : "BLOQUEADO";</script>');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  let app;
  try {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({ executablePath: require('electron'), args: ['--host-resolver-rules=MAP *.cruzeirodosul.edu.br 127.0.0.1, MAP outro.example 127.0.0.1', root, '--test-mode'], env });
    const page = await app.firstWindow(); await page.waitForSelector('#sessions-list .tree-section');
    const open = async (name, url) => {
      await page.click('#new-session'); await page.locator('[name=name]').fill(name); await page.locator('[name=type]').selectOption('web');
      await page.locator('[name=url]').fill(url); await page.click('#dialog-ok');
      await page.locator('.tree-row.session .tree-main').filter({ hasText: name }).click();
      if (await page.locator('#dialog-title', { hasText: 'Certificado não confiável' }).waitFor({ timeout: 4000 }).then(() => true, () => false)) await page.click('#dialog-ok');
      await page.waitForFunction(() => /ABRIU|BLOQUEADO|POPUP/.test(document.querySelector('.pane:not([hidden]) webview')?.getTitle() || ''), null, { timeout: 15000 });
      return page.evaluate(() => document.querySelector('.pane:not([hidden]) webview').getTitle());
    };
    assert.equal(await open('Portal', `https://novoportal.cruzeirodosul.edu.br:${port}/home/6`), 'ABRIU', 'popup do domínio da faculdade abre');
    const popups = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
    assert.ok(popups >= 2, 'a janela do popup foi criada');
    console.log('PASS: window.open no domínio cruzeirodosul.edu.br devolve a janela (sem alert) e o popup abre.');
    assert.equal(await open('Portal2', `https://novoportal.cruzeirodosul.edu.br:${port}/blank`), 'ABRIU', 'window.open vazio também abre');
    const before = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
    // Fora do domínio o popup não abre: a URL é carregada na própria aba (título POPUP, sem nova janela).
    assert.notEqual(await open('Outro', `https://outro.example:${port}/`), 'ABRIU', 'outro domínio segue sem popup');
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), before, 'nenhuma janela nova');
    console.log('PASS: outro domínio continua sem popup por padrão.');
  } finally { await app?.close().catch(() => {}); server.close(); }
})().catch(error => { console.error(error); process.exit(1); });
