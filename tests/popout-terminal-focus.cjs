// Regressão dos 3 problemas relatados em janela separada / split:
// 1) o terminal (xterm.js) parava de receber teclado depois que a janela separada perdia e
//    recuperava o foco (só voltava clicando dentro de novo) — o VNC não sofria disso porque o
//    clique no canvas já basta; o xterm.js depende de focar a textarea escondida dele de novo.
// 2) mesma causa: "jogar para outra tela e clicar na janela separada" não devolvia o teclado à sessão.
// 3) o split sempre escolhia sozinho quais sessões apareciam nos painéis (a ativa + as primeiras
//    abertas), sem deixar escolher. Servidor SSH de laboratório (eco), sem depender de PowerShell/cmd
//    (Windows-only), para rodar em qualquer plataforma.
const { _electron: electron } = require('playwright');
const { Server } = require('ssh2');
const crypto = require('node:crypto');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

// Abre uma sessão SSH pela UI (como um usuário faria) e confirma que está pronta mandando um
// nonce único pelo eco do servidor de laboratório — sem depender de nenhum banner específico.
async function openSsh(page, name, port) {
  await page.click('#new-session');
  await page.locator('[name=name]').fill(name);
  await page.locator('[name=type]').selectOption('ssh');
  await page.locator('[name=host]').fill('127.0.0.1');
  await page.locator('[name=username]').fill('tester');
  await page.locator('#dialog-advanced summary').click();
  await page.locator('[name=port]').fill(String(port));
  await page.click('#dialog-ok');
  await page.locator('.tree-row.session .tree-main').filter({ hasText: name }).click();
  // A senha e depois "Confiar nesta chave" (primeira conexão a este host:porta) aparecem em momentos
  // diferentes do handshake assíncrono — isVisible() sozinho não espera nada, só olha o estado atual.
  // Por isso os dois ficam dentro do MESMO laço de sondagem, repetido até a aba aparecer.
  const password = page.locator('#form-dialog [name=password]');
  const trust = page.getByRole('button', { name: 'Confiar nesta chave' });
  const tab = page.locator('#tabs .tab', { hasText: name });
  for (let i = 0; i < 40 && !(await tab.count()); i++) {
    if (await password.isVisible().catch(() => false)) { await password.fill('lab-only'); await page.click('#dialog-ok'); }
    if (await trust.isVisible().catch(() => false)) await trust.click();
    await page.waitForTimeout(500);
  }
  await tab.waitFor({ timeout: 15000 });
  const id = await tab.getAttribute('data-id');
  const nonce = 'READY-' + id;
  await page.evaluate(() => { window.labOutput = ''; });
  await page.evaluate(({ id, nonce }) => window.api.call('terminal:write', id, nonce + '\r'), { id, nonce });
  await page.waitForFunction(nonce => window.labOutput?.includes(nonce), nonce, { timeout: 15000 });
  return id;
}

(async () => {
  const key = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs1', format: 'pem' });
  const ssh = new Server({ hostKeys: [key] }, client => {
    client.on('authentication', ctx => ctx.method === 'password' && ctx.username === 'tester' && ctx.password === 'lab-only' ? ctx.accept() : ctx.reject());
    client.on('ready', () => client.on('session', accept => {
      const session = accept();
      session.on('pty', accept => accept()); session.on('window-change', accept => accept?.());
      session.on('shell', accept => { const stream = accept(); stream.on('data', bytes => stream.write(bytes)); });
    }));
  });
  await new Promise(resolve => ssh.listen(0, '127.0.0.1', resolve));
  const port = ssh.address().port;
  let app;
  try {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({ executablePath: require('electron'), args: [root, '--test-mode'], env });
    const page = await app.firstWindow(); await page.waitForSelector('#sessions-list .tree-section');
    const errors = []; page.on('pageerror', error => { if (!/Invalid guestInstanceId/.test(error.message)) errors.push(error.message); });
    await page.evaluate(() => { window.labOutput = ''; window.api.on('terminal:data', data => { window.labOutput += data.data; }); });

    const idA = await openSsh(page, 'Foco A', port);

    // ---------- Tópicos 1 e 2: foco do terminal depois de separar a janela ----------
    const opened = app.waitForEvent('window');
    await page.locator('#tabs .tab', { hasText: 'Foco A' }).hover();
    await page.locator('#tabs .tab', { hasText: 'Foco A' }).locator('.tab-detach').click();
    const child = await opened; await child.waitForSelector('.xterm');
    await child.locator('.xterm').click();
    await page.evaluate(() => { window.labOutput = ''; });
    await child.keyboard.type('ab'); await child.waitForTimeout(300);
    assert.match(await page.evaluate(() => window.labOutput), /ab/, 'digitar logo após separar a janela chega ao servidor (baseline)');
    console.log('PASS: terminal recebe teclado normalmente logo após ser separado para outra janela.');

    // Reproduz o sintoma relatado: algo (troca de monitor, perder e recuperar o foco da janela) tira
    // o foco da textarea escondida do xterm. Sem o listener de 'focus' que adicionamos em popOut(),
    // nada devolve o teclado ao terminal — o usuário só via voltar clicando lá dentro de novo.
    const focusedBefore = await child.evaluate(() => document.activeElement?.classList.contains('xterm-helper-textarea'));
    assert.ok(focusedBefore, 'a textarea do xterm deveria estar focada depois do clique');
    await child.evaluate(() => document.activeElement.blur());
    const blurred = await child.evaluate(() => document.activeElement?.classList.contains('xterm-helper-textarea'));
    assert.ok(!blurred, 'depois do blur, o foco não deveria mais estar na textarea (reproduz o sintoma)');
    // Isto é o que a janela separada recebe de verdade quando volta a ganhar foco do sistema
    // operacional (trocar de monitor e clicar nela de novo): o evento 'focus' do objeto window.
    await child.evaluate(() => window.dispatchEvent(new Event('focus')));
    const refocused = await child.evaluate(() => document.activeElement?.classList.contains('xterm-helper-textarea'));
    assert.ok(refocused, 'o listener novo (child.addEventListener("focus", ...)) deveria devolver o foco ao terminal');
    await page.evaluate(() => { window.labOutput = ''; });
    await child.keyboard.type('cd'); await child.waitForTimeout(300);
    assert.match(await page.evaluate(() => window.labOutput), /cd/, 'depois de recuperar o foco da janela, digitar sem clicar de novo já chega ao servidor');
    console.log('PASS: a janela separada devolve o teclado ao terminal quando volta a ganhar foco (correção dos tópicos 1 e 2).');

    await page.click('#dock-all'); await page.waitForSelector('#panes .xterm');

    // ---------- Tópico 3: escolher manualmente quais sessões aparecem no split ----------
    const idB = await openSsh(page, 'Split B', port);
    const idC = await openSsh(page, 'Split C', port);
    // 3 sessões abertas agora: Foco A (a primeira), Split B, Split C. Ativa = Split C (a última aberta).
    await page.click('#split');
    await page.waitForFunction(() => document.querySelectorAll('.pane:not([hidden])').length > 1);
    // Fixa Foco A e Split B — propositalmente SEM a sessão ativa (Split C) — pra provar que a escolha
    // manual manda mais que "sessão ativa + ordem de abertura".
    await page.locator('#tabs .tab', { hasText: 'Foco A' }).hover();
    await page.locator('#tabs .tab', { hasText: 'Foco A' }).locator('.tab-pin').click();
    await page.locator('#tabs .tab', { hasText: 'Split B' }).hover();
    await page.locator('#tabs .tab', { hasText: 'Split B' }).locator('.tab-pin').click();
    await page.waitForFunction(([a, b]) => !document.querySelector(`.pane[data-session="${a}"]`).hidden && !document.querySelector(`.pane[data-session="${b}"]`).hidden, [idA, idB]);
    assert.equal(await page.locator(`.pane[data-session="${idC}"]`).isHidden(), true, 'a sessão não fixada (Split C, mesmo sendo a ativa) não deveria aparecer no split');
    assert.equal(await page.locator('.pane:not([hidden])').count(), 2, 'só os 2 painéis fixados deveriam estar visíveis');
    console.log('PASS: com sessões fixadas (📌), o split mostra exatamente as escolhidas, não a ativa + ordem de abertura.');

    // Tirar o pino de uma delas atualiza o split na hora.
    await page.locator('#tabs .tab', { hasText: 'Foco A' }).locator('.tab-pin').click();
    await page.waitForFunction(a => document.querySelector(`.pane[data-session="${a}"]`).hidden, idA);
    console.log('PASS: tirar o pino de uma sessão a remove do split imediatamente.');

    assert.deepEqual(errors, [], 'sem erros no renderer');
  } finally { await app?.close().catch(() => {}); ssh.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
