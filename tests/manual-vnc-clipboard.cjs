// Script manual (não faz parte de "pnpm test"): sobe um TightVNC real em loopback
// e conecta o Stanis Terminal nele, para conferir o clipboard contra um servidor de verdade.
const { _electron: electron } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { Tools } = require('../src/tools.cjs');
const { startVnc } = require('../src/vncserver.cjs');
const root = path.resolve(__dirname, '..');

(async () => {
  let app, server;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-manual-vnc-'));
  try {
    const tools = new Tools(dir, async () => ({}));
    console.log('Instalando/localizando TightVNC…');
    const exe = await tools.install('tightvnc');
    console.log('Subindo servidor TightVNC real em 127.0.0.1:5939, senha "segredo1"…');
    server = await startVnc({ exe, port: 5939, password: 'segredo1' });
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({ executablePath: process.env.STANIS_TEST_EXE || require('electron'), args: process.env.STANIS_TEST_EXE ? ['--test-mode'] : [root, '--test-mode'], env, timeout: 45000 });
    const page = await app.firstWindow(); await page.waitForSelector('#sessions-list .tree-section');
    await page.click('#new-session'); await page.locator('[name=name]').fill('TightVNC real'); await page.locator('[name=type]').selectOption('vnc'); await page.locator('[name=host]').fill('127.0.0.1');
    await page.locator('#dialog-advanced summary').click(); await page.locator('[name=port]').fill('5939'); await page.click('#dialog-ok');
    await page.locator('.tree-row.session .tree-main').filter({ hasText: 'TightVNC real' }).click();
    await page.locator('#form-dialog [name=password]').fill('segredo1'); await page.click('#dialog-ok');
    await page.waitForFunction(() => document.querySelector('#status').textContent === 'VNC conectado.', { timeout: 15000 });
    console.log('PASS: conectou no TightVNC real.');

    // Servidor (TightVNC, que enxerga o clipboard real deste Windows) -> app: escreve via PowerShell (fora do Electron) e espera o app perceber via ServerCutText.
    execFileSync('powershell', ['-NoProfile', '-Command', 'Set-Clipboard -Value "PROVA_SERVIDOR_PARA_APP"'], { windowsHide: true });
    await page.waitForFunction(async () => { const text = await window.api.call('clipboard:read'); return text === 'PROVA_SERVIDOR_PARA_APP'; }, { timeout: 10000 })
      .then(() => console.log('PASS: mudança de clipboard (fora do Electron) chegou ao app via ServerCutText do TightVNC real.'))
      .catch(() => console.log('FALHA: clipboard não sincronizou via TightVNC real dentro de 10s (ServerCutText não chegou ou TightVNC não está monitorando clipboard).'));

    // App -> servidor: muda o clipboard pelo Electron e manda com Ctrl+Shift+V; confere se a sessão continua viva (sem erro de protocolo).
    await app.evaluate(({ clipboard }) => clipboard.writeText('PROVA_APP_PARA_SERVIDOR'));
    await page.locator('.graphic-mount canvas').click();
    await page.keyboard.press('Control+Shift+V');
    await new Promise(resolve => setTimeout(resolve, 1000));
    const status = await page.locator('#status').textContent();
    assert.ok(!status.includes('interrompida') && !status.includes('falhou'), `Sessão VNC teve problema após enviar clipboard: ${status}`);
    const clipboardNow = execFileSync('powershell', ['-NoProfile', '-Command', 'Get-Clipboard'], { windowsHide: true }).toString().trim();
    console.log(`Clipboard do Windows após o envio (mesma máquina, então já era esse valor antes): "${clipboardNow}"`);
    console.log('PASS: enviar clipboard para o TightVNC real (Ctrl+Shift+V) não quebrou a sessão nem causou erro de protocolo.');
  } finally {
    if (app) await app.close();
    server?.close();
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 }); } catch { /* ignora */ }
  }
})().catch(error => { console.error('ERRO:', error); process.exit(1); });
