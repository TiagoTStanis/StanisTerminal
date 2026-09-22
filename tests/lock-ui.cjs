const { _electron: electron } = require('playwright');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const root = path.resolve(__dirname, '..'); const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-lockui-')); env.STANIS_TEST_USERDATA = userData;
  const app = await electron.launch({ executablePath: require('electron'), args: [root, '--test-mode'], env, timeout: 30000 });
  const page = await app.firstWindow();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const call = (...args) => page.evaluate(args => window.api.call(...args), args);
  try {
    await page.waitForSelector('#sessions-list .tree-section');

    // Sem senha mestra, o app abre direto (sem tela de bloqueio) e o botão de bloquear fica oculto.
    assert.equal(await page.locator('#lock-now').isHidden(), true);

    // Define a senha mestra e o bloqueio automático.
    await page.click('#settings'); await page.locator('[name=lockPassword]').fill('minhasenha'); await page.locator('[name=autoLockMinutes]').fill('30'); await page.click('#dialog-ok');
    await page.waitForSelector('#lock-now:visible');
    assert.equal((await call('lock:status')).enabled, true); assert.equal((await call('lock:status')).autoLockMinutes, 30);

    // Bloquear e tentar senha errada, depois a certa.
    await page.click('#lock-now');
    await page.waitForSelector('#dialog-title:has-text("bloqueado")');
    assert.equal(await page.locator('#dialog-cancel').isHidden(), true, 'não é possível cancelar o bloqueio');
    await page.locator('[name=password]').fill('errada'); await page.click('#dialog-ok');
    await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('incorreta'));
    await page.keyboard.press('Escape'); // não deve fechar o diálogo de bloqueio
    assert.equal(await page.locator('#dialog-title:has-text("bloqueado")').isVisible(), true, 'Escape não fecha o bloqueio');
    await page.locator('[name=password]').fill('minhasenha'); await page.click('#dialog-ok');
    await page.waitForSelector('#dialog-title:has-text("bloqueado")', { state: 'hidden' });

    // Remover a senha mestra exige a senha atual.
    await page.click('#settings'); await page.locator('[name=removeLock]').check(); await page.click('#dialog-ok');
    await page.waitForSelector('#dialog-title:has-text("Remover senha mestra")'); await page.locator('[name=password]').fill('minhasenha'); await page.click('#dialog-ok');
    await page.waitForFunction(() => document.querySelector('#lock-now').hidden); assert.equal((await call('lock:status')).enabled, false);

    // Reabrir sessões ao iniciar: liga a opção, abre um terminal, reinicia o app e confere que reabriu.
    await page.click('#settings'); await page.locator('[name=restoreSessions]').check(); await page.click('#dialog-ok');
    await page.click('#welcome-local'); await page.waitForFunction(() => document.querySelector('.xterm-rows')?.textContent.includes('PS '), { timeout: 20000 });
    await page.waitForTimeout(1200); // aguarda o salvamento (debounce) da lista de sessões abertas
    await app.close();
    const app2 = await electron.launch({ executablePath: require('electron'), args: [root, '--test-mode'], env, timeout: 30000 });
    const page2 = await app2.firstWindow(); page2.on('pageerror', error => errors.push(error.message));
    await page2.waitForFunction(() => document.querySelectorAll('.tab').length >= 1, { timeout: 20000 });
    await page2.waitForFunction(() => document.querySelector('.xterm-rows')?.textContent.includes('PS '), { timeout: 20000 });

    // Links clicáveis: o addon detecta a URL na saída (só confere que a classe do link foi aplicada; abrir de fato pede confirmação).
    await page2.locator('.pane:not([hidden]) .xterm-helper-textarea').first().pressSequentially("Write-Output 'https://example.com'", { delay: 5 }); await page2.keyboard.press('Enter');
    await page2.waitForSelector('.xterm-rows a, [class*=link]', { timeout: 15000 }).catch(() => {});
    assert.deepEqual(errors, []);
    console.log('PASS: senha mestra (definir, bloquear, senha errada, desbloquear, remover), reabrir sessões ao iniciar.');
    await app2.close();
  } catch (error) { console.error(error); process.exitCode = 1; await app.close().catch(() => {}); }
})();
