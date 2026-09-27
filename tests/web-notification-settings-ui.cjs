'use strict';
const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const root = path.resolve(__dirname, '..');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.STANIS_TEST_USERDATA;
  const app = await electron.launch({ executablePath: require('electron'), args: [root, '--test-mode'], env });
  try {
    const page = await app.firstWindow(); await page.waitForSelector('#welcome-local'); await page.click('#welcome-local');
    await page.click('#settings');
    await page.waitForSelector('#form-dialog[open]', { timeout: 5000 });
    const enabled = page.locator('[name=webNotifications]');
    assert.equal(await enabled.isChecked(), false, 'notificações desligadas por padrão');
    await enabled.check(); await page.click('#dialog-ok');
    await page.click('#settings');
    assert.equal(await page.locator('[name=webNotifications]').isChecked(), true, 'preferência salva e reaberta');
    await page.locator('[name=webNotifications]').uncheck();
    await page.locator('[name=resetWebNotificationPermissions]').check();
    await page.click('#dialog-ok');
    await page.click('#settings');
    assert.equal(await page.locator('[name=webNotifications]').isChecked(), false, 'desativar suspende os avisos');
    await page.click('#dialog-cancel');
    console.log('PASS: notificação começa desligada, ativa/desativa e opção de redefinir aparecem em Preferências.');
  } finally { await app.close().catch(() => {}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
