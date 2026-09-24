// Painel Arquivos numa sessão VNC, de ponta a ponta pela interface: a tela vem pelo noVNC e os arquivos
// pelo protocolo do TightVNC, do mesmo servidor de laboratório (localhost). Nada é digitado na máquina real.
// Rodar com node --openssl-legacy-provider (o laboratório calcula o DES da autenticação VNC).
const { _electron: electron } = require('playwright');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { labServer } = require('./tightvnc-lab.cjs');
const root = path.resolve(__dirname, '..');

(async () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-tightui-'));
  const lab = await labServer({ password: '', rfb: true });
  let app;
  try {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({ executablePath: require('electron'), args: [root, '--test-mode'], env });
    const page = await app.firstWindow(); await page.waitForSelector('#sessions-list .tree-section');
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const local = path.join(scratch, 'enviado.txt'); fs.writeFileSync(local, 'enviado pelo painel');
    await app.evaluate(({ dialog }, { local, saved }) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [local] });
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: saved });
    }, { local, saved: path.join(scratch, 'baixado.txt') });

    await page.click('#new-session'); await page.locator('[name=name]').fill('VNC arquivos'); await page.locator('[name=type]').selectOption('vnc'); await page.locator('[name=host]').fill('127.0.0.1');
    await page.locator('#dialog-advanced summary').click(); await page.locator('[name=port]').fill(String(lab.port)); await page.click('#dialog-ok');
    await page.locator('.tree-row.session .tree-main').filter({ hasText: 'VNC arquivos' }).click();
    await page.waitForFunction(() => document.querySelector('#status').textContent === 'VNC conectado.', null, { timeout: 15000 });

    // Abrir o painel pela barra de cima (não pelo botão da sessão): tem de ir para o TightVNC, não para a rede.
    await page.click('#toggle-files');
    await page.locator('#file-list .file-row', { hasText: 'C:' }).waitFor({ timeout: 10000 });
    assert.equal(await page.locator('#file-origin-kind').textContent(), 'TIGHTVNC');
    assert.equal(await page.locator('#file-origin-name').textContent(), 'VNC arquivos');
    console.log('PASS: o painel Arquivos aberto pela barra segue a sessão VNC ativa (TightVNC, não a rede).');

    await page.locator('#file-list .file-row', { hasText: 'C:' }).locator('.file-open').click();
    await page.locator('#file-list .file-row', { hasText: 'pasta' }).locator('.file-open').click();
    await page.locator('#file-list .file-row', { hasText: 'antigo.txt' }).waitFor();
    assert.deepEqual(await page.locator('#file-crumbs button').allTextContents(), ['/', 'C:', 'pasta']);
    assert.match(await page.locator('.file-row', { hasText: 'antigo.txt' }).locator('.file-meta').textContent(), /B · 01\/09\/2026/);
    console.log('PASS: navegação por clique, caminho em migalhas, tamanho e data da listagem do TightVNC.');

    await page.click('#files-upload');
    await page.locator('#file-list .file-row', { hasText: 'enviado.txt' }).waitFor({ timeout: 10000 });
    assert.equal(lab.files.get('/C:/pasta/enviado.txt').toString(), 'enviado pelo painel');
    await page.locator('.file-row', { hasText: 'antigo.txt' }).locator('.file-open').dblclick();
    await page.waitForFunction(() => [...document.querySelectorAll('.transfer')].some(row => row.textContent.includes('antigo.txt') && row.textContent.includes('concluída')), null, { timeout: 10000 });
    assert.equal(fs.readFileSync(path.join(scratch, 'baixado.txt'), 'utf8'), 'conteúdo antigo');
    console.log('PASS: enviar pela fila e baixar com duplo clique, com o progresso no painel.');
    fs.mkdirSync(path.join(root, 'test-results', 'ui'), { recursive: true }); await page.screenshot({ path: path.join(root, 'test-results', 'ui', '20-painel-vnc.png') });

    await page.fill('#file-filter', 'envi');
    assert.equal(await page.locator('#file-list .file-row:visible').count(), 1, 'o filtro deixa só o que combina');
    await page.fill('#file-filter', '');
    await page.locator('#file-crumbs button', { hasText: 'C:' }).click();
    await page.locator('#file-list .file-row', { hasText: 'pasta' }).waitFor();
    console.log('PASS: filtro da pasta e volta pelas migalhas.');

    // Trocar para uma aba local e voltar: a origem acompanha e a pasta da sessão é lembrada.
    await page.click('#add-tab').catch(() => {}); await page.waitForTimeout(1500);
    await page.waitForFunction(() => document.querySelector('#file-origin-kind').textContent === 'LOCAL', null, { timeout: 10000 });
    await page.locator('#tabs .tab', { hasText: 'VNC arquivos' }).click();
    await page.waitForFunction(() => document.querySelector('#file-origin-kind').textContent === 'TIGHTVNC', null, { timeout: 10000 });
    await page.locator('#file-list .file-row', { hasText: 'pasta' }).waitFor({ timeout: 10000 });
    console.log('PASS: trocar de aba troca a origem, e ao voltar para o VNC a última pasta dele reaparece.');
    assert.deepEqual(errors, [], 'sem erros no renderer');
  } finally {
    await app?.close().catch(() => {}); lab.close(); fs.rmSync(scratch, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
