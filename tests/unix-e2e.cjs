// Ponta a ponta na interface real: instala o ambiente Unix (MSYS2), instala um pacote pela tela de Pacotes e o usa no shell Unix.
// Baixa ~53 MB e usa a rede: só roda com STANIS_TEST_NETWORK=1.
const { _electron: electron } = require('playwright');
const path = require('node:path');
const assert = require('node:assert/strict');
if (process.env.STANIS_TEST_NETWORK !== '1') { console.log('SKIP: defina STANIS_TEST_NETWORK=1 para rodar (baixa o MSYS2).'); process.exit(0); }
(async () => {
  const root = path.resolve(__dirname, '..'); const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ executablePath: process.env.STANIS_TEST_EXE || require('electron'), args: process.env.STANIS_TEST_EXE ? ['--test-mode'] : [root, '--test-mode'], env, timeout: 30000 });
  const page = await app.firstWindow();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.waitForSelector('#sessions-list .tree-section');
    await page.click('#open-packages');
    await page.click('#packages-dialog .seg-btn:has-text("Unix")');
    await page.waitForSelector('.pk-install-unix');
    assert.ok((await page.locator('.pk-empty').textContent()).includes('ainda não está instalado'));

    // Instalação com confirmação única (mostra origem, versão e hash antes de baixar).
    await page.click('.pk-install-unix');
    await page.waitForSelector('#dialog-title:has-text("MSYS2")');
    assert.ok((await page.locator('#dialog-message').textContent()).includes('c105946e'));
    await page.click('#dialog-ok');
    await page.waitForFunction(() => !document.querySelector('.pk-install-unix'), null, { timeout: 540000 });

    // Buscar e instalar um pacote pequeno pela interface.
    await page.fill('#packages-dialog input[type=search]', 'tree');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.pk-row:has-text("tree")', { timeout: 180000 });
    await page.locator('.pk-row', { has: page.locator('.pk-info strong', { hasText: /^tree$/ }) }).locator('button:has-text("Instalar")').click();
    await page.waitForFunction(() => /Concluído/.test(document.querySelector('.pk-log')?.textContent || ''), null, { timeout: 240000 });
    await page.click('#packages-dialog .tab-btn:has-text("Instalados")');
    await page.waitForSelector('.pk-row:has-text("tree")', { timeout: 60000 });
    await page.keyboard.press('Escape');

    // Shell Unix: o programa instalado roda.
    await page.click('#sessions-list .tree-section:has-text("Terminais locais")');
    await page.click('.tree-row.session:has-text("Unix (MSYS2)") .tree-main');
    await page.waitForFunction(() => document.querySelector('.xterm-rows')?.textContent.includes('$'), null, { timeout: 120000 });
    await page.locator('.xterm-helper-textarea').first().pressSequentially('mkdir -p /tmp/e2e/dir1/dir2 && tree /tmp/e2e | tail -3 && echo FIM_' + 'UNIX', { delay: 5 });
    await page.keyboard.press('Enter');
    try {
      await page.waitForFunction(() => /dir2[\s\S]*FIM_UNIX/.test(document.querySelector('.xterm-rows')?.textContent || ''), null, { timeout: 30000 });
    } catch (error) {
      await page.screenshot({ path: path.join(root, 'test-results/unix-e2e-falha.png') });
      console.log('TEXTO DO TERMINAL:', JSON.stringify(await page.evaluate(() => document.querySelector('.xterm-rows')?.textContent)).slice(0, 700));
      throw error;
    }
    await page.screenshot({ path: path.join(root, 'test-results/unix-e2e.png') });
    assert.deepEqual(errors, []);
    console.log('PASS: MSYS2 instalado pela interface (hash conferido), pacote instalado pela tela de Pacotes e usado no shell Unix.');
  } finally { await app.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
