// Sessão Link numa aba: página de laboratório (localhost) com login por cookie que expira por inatividade.
// Confere: abre dentro do app, certificado próprio pergunta uma vez, e o "manter ativa" renova o login no
// servidor e gera atividade real na página (demora ~70 s por causa do intervalo mínimo de 1 minuto).
const { _electron: electron } = require('playwright');
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

function labSite(IDLE_MS) {
  const sessions = new Map(), log = [];
  const handler = (req, res) => {
    // /largura: a página mostra no título a largura que enxerga (innerWidth), para conferir a lupa.
    if (req.url.startsWith('/largura')) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end('<title>W</title><script>const t = () => { document.title = "W" + innerWidth; }; addEventListener("resize", t); t();</script>'); }
    const sid = /sid=(\w+)/.exec(req.headers.cookie || '')?.[1];
    const alive = sid && sessions.has(sid) && Date.now() - sessions.get(sid) < IDLE_MS;
    log.push({ at: Date.now(), sid: alive ? sid : null, url: req.url });
    if (alive) sessions.set(sid, Date.now());
    const headers = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' };
    if (!alive) { const id = Math.random().toString(36).slice(2); sessions.set(id, Date.now()); headers['set-cookie'] = `sid=${id}; Path=/; HttpOnly`; }
    // A página conta movimentos de mouse reais (isTrusted) no título.
    res.writeHead(200, headers);
    res.end(`<!doctype html><title>${alive ? 'LOGADO' : 'LOGIN'}</title><body style="height:100vh">
      <h1 id="s">${alive ? 'LOGADO' : 'LOGIN'}</h1><script>let n = 0; addEventListener('mousemove', e => { if (e.isTrusted) document.title = document.title.split(' ')[0] + ' movimentos=' + (++n); });</script>`);
  };
  return { handler, log, sessions };
}

(async () => {
  const site = labSite(75000);
  const plain = http.createServer(site.handler); await new Promise(r => plain.listen(0, '127.0.0.1', r));
  const tls = https.createServer({ key: fs.readFileSync(path.join(__dirname, 'fixtures/localhost-key.pem')), cert: fs.readFileSync(path.join(__dirname, 'fixtures/localhost-cert.pem')) }, site.handler);
  await new Promise(r => tls.listen(0, '127.0.0.1', r));
  let app;
  try {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({ executablePath: require('electron'), args: [root, '--test-mode'], env });
    const page = await app.firstWindow(); await page.waitForSelector('#sessions-list .tree-section');
    // O Electron 44 relata "Invalid guestInstanceId" ao remover um <webview> já descartado (o conteúdo é liberado
    // normalmente, conferido no processo principal); não é erro do app.
    const errors = []; page.on('pageerror', error => { if (!/Invalid guestInstanceId/.test(error.message)) errors.push(error.message); });
    const newLink = async (name, url, minutes) => {
      await page.click('#new-session'); await page.locator('[name=name]').fill(name); await page.locator('[name=type]').selectOption('web');
      await page.locator('[name=url]').fill(url); await page.locator('[name=keepAliveMinutes]').fill(String(minutes)); await page.click('#dialog-ok');
      await page.locator('.tree-row.session .tree-main').filter({ hasText: name }).click();
    };

    // HTTPS com certificado próprio: pergunta, confia, abre na aba; na segunda vez não pergunta.
    await newLink('Firewall lab', `https://127.0.0.1:${tls.address().port}/`, 4);
    await page.locator('#dialog-title', { hasText: 'Certificado não confiável' }).waitFor({ timeout: 15000 });
    await page.click('#dialog-ok');
    const webTitle = () => page.evaluate(() => document.querySelector('.pane:not([hidden]) webview')?.getTitle());
    await page.waitForFunction(() => /LOGIN|LOGADO/.test(document.querySelector('.pane:not([hidden]) webview')?.getTitle() || ''), null, { timeout: 15000 });
    assert.equal(await page.locator('#tabs .tab', { hasText: 'Firewall lab' }).count(), 1, 'o link abre numa aba');
    await page.locator('#tabs .tab', { hasText: 'Firewall lab' }).locator('button', { hasText: '✕' }).click();
    await page.locator('#dialog-ok').click().catch(() => {}); await page.waitForTimeout(1000);
    assert.deepEqual(await app.evaluate(({ webContents }) => webContents.getAllWebContents().filter(w => w.getType() === 'webview' && !w.isDestroyed()).length), 0, 'fechar a aba libera a página');
    await page.locator('.tree-row.session .tree-main').filter({ hasText: 'Firewall lab' }).click();
    await page.waitForFunction(() => /LOGADO/.test(document.querySelector('.pane:not([hidden]) webview')?.getTitle() || ''), null, { timeout: 15000 });
    assert.equal(await page.locator('#dialog-title', { hasText: 'Certificado' }).isVisible().catch(() => false), false, 'certificado já confiado não pergunta de novo');
    console.log('PASS: link HTTPS com certificado próprio abre numa aba; confiança lembrada e login (cookie) mantido ao reabrir.');

    // Lupa: com a aba estreita, "Automático" faz o site enxergar 1280 px; "tela de 1920" e 100% também.
    await page.setViewportSize({ width: 1150, height: 760 });
    await newLink('Largura lab', `http://127.0.0.1:${plain.address().port}/largura`, 4);
    const seen = async () => { await page.waitForTimeout(700); return Number((await webTitle()).slice(1)); };
    await page.waitForFunction(() => /^W\d+/.test(document.querySelector('.pane:not([hidden]) webview')?.getTitle() || ''), null, { timeout: 15000 });
    const paneWidth = await page.evaluate(() => document.querySelector('.pane:not([hidden]) .web-mount').clientWidth);
    assert.ok(paneWidth < 1280, `aba estreita no teste (${paneWidth})`);
    let width = await seen(); assert.ok(Math.abs(width - 1280) <= 4, `automático: o site enxerga ~1280 px (viu ${width})`);
    const zoomTo = async label => { await page.locator('.pane:not([hidden]) .web-toolbar button', { hasText: '🔍' }).click(); await page.locator('.ctx-item', { hasText: label }).click(); };
    await zoomTo('1920'); width = await seen(); assert.ok(Math.abs(width - 1920) <= 6, `tela de 1920: viu ${width}`);
    await zoomTo('100% (tamanho real)'); width = await seen(); assert.ok(Math.abs(width - paneWidth) <= 4, `100%: viu ${width}, aba ${paneWidth}`);
    // Ctrl − dentro da página diminui o zoom (o site passa a enxergar mais largura).
    await page.evaluate(() => { const v = document.querySelector('.pane:not([hidden]) webview'); v.focus(); v.sendInputEvent({ type: 'keyDown', keyCode: '-', modifiers: ['control'] }); v.sendInputEvent({ type: 'keyUp', keyCode: '-', modifiers: ['control'] }); });
    width = await seen(); assert.ok(width > paneWidth + 40, `Ctrl−: viu ${width}, aba ${paneWidth}`);
    assert.match(await page.locator('.pane:not([hidden]) .web-toolbar button', { hasText: '🔍' }).textContent(), /91%|90%/);
    console.log('PASS: lupa da aba de link: automático (1280 px), tela de 1920, 100% e Ctrl−.');

    // Janela separada: a aba de link vai para uma janela própria, continua logada (mesmo perfil), e volta ao fechar.
    const opened = app.waitForEvent('window');
    await page.locator('#tabs .tab', { hasText: 'Firewall lab' }).hover(); await page.locator('#tabs .tab', { hasText: 'Firewall lab' }).locator('.tab-detach').click();
    const popWin = await opened; await popWin.waitForLoadState();
    await popWin.waitForFunction(() => /LOGADO/.test(document.title), null, { timeout: 15000 });
    assert.equal(await page.locator('.pane webview').count(), 1, 'a página saiu da aba (fica só a de largura)');
    assert.ok(await page.locator('#dock-all').isVisible(), 'botão "Trazer janelas" aparece');
    await popWin.close();
    await page.waitForFunction(() => document.querySelectorAll('.pane webview').length === 2, null, { timeout: 10000 });
    await page.waitForFunction(() => [...document.querySelectorAll('.pane webview')].some(v => { try { return /LOGADO/.test(v.getTitle()); } catch { return false; } }), null, { timeout: 15000 });
    // "Trazer janelas" também devolve.
    const opened2 = app.waitForEvent('window');
    await page.locator('#tabs .tab', { hasText: 'Firewall lab' }).hover(); await page.locator('#tabs .tab', { hasText: 'Firewall lab' }).locator('.tab-detach').click();
    await opened2; await page.click('#dock-all');
    await page.waitForFunction(() => document.querySelectorAll('.pane webview').length === 2 && document.querySelector('#dock-all').hidden, null, { timeout: 10000 });
    console.log('PASS: aba de link em janela separada, ainda logada; volta ao fechar a janela e pelo "Trazer janelas".');

    // Manter ativa: sem nenhuma interação, o app renova o login e move o mouse na página a cada 1 minuto.
    await newLink('Switch lab', `http://127.0.0.1:${plain.address().port}/`, 1);
    await page.waitForFunction(() => /LOGIN|LOGADO/.test(document.querySelector('.pane:not([hidden]) webview')?.getTitle() || ''), null, { timeout: 15000 });
    const firstAt = Date.now(); await page.mouse.move(5, 5);
    await page.waitForFunction(() => /movimentos=\d+/.test(document.querySelector('.pane:not([hidden]) webview')?.getTitle() || ''), null, { timeout: 80000, polling: 1000 });
    const renew = site.log.filter(entry => entry.at > firstAt + 30000 && entry.sid);
    assert.ok(renew.length >= 1, `o servidor recebeu a renovação com o login: ${JSON.stringify(site.log.slice(-3))}`);
    assert.ok(await page.locator('.pane:not([hidden]) .web-toolbar button', { hasText: 'Manter ativa: 1 min' }).count(), 'botão mostra o intervalo');
    console.log(`PASS: manter ativa renovou o login no servidor e gerou movimento real na página (${await webTitle()}).`);
    assert.deepEqual(errors, [], 'sem erros no renderer');
  } finally { await app?.close().catch(() => {}); plain.close(); tls.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
