// "Aprende com login": sem IA, só repetição. Servidor SSH de laboratório (eco com prompt "lab$ ") registra o que chega.
// Cobre: pergunta só na 3ª conexão, recusar não pergunta de novo, aceitar grava o script no perfil e ele roda sozinho,
// "continua o raciocínio" (passo novo depois do script), segredo nunca vira passo e o script é editável/apagável.
const { _electron: electron } = require('playwright');
const { Server } = require('ssh2');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

(async () => {
  const key = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs1', format: 'pem' });
  const connections = [];
  const ssh = new Server({ hostKeys: [key] }, client => {
    const seen = []; connections.push(seen);
    client.on('authentication', ctx => ctx.method === 'password' && ctx.username === 'tester' && ctx.password === 'lab-only' ? ctx.accept() : ctx.reject());
    client.on('ready', () => client.on('session', accept => {
      const session = accept(); session.on('pty', accept => accept()); session.on('window-change', accept => accept?.());
      session.on('shell', accept => {
        const stream = accept(); let line = ''; stream.write('Bem-vindo\r\nlab$ ');
        stream.on('data', bytes => { for (const ch of bytes.toString()) {
          if (ch === '\r') { seen.push(line); stream.write(`\r\nresultado:${line}\r\nlab$ `); line = ''; } else { line += ch; stream.write(ch); }
        } });
      });
    }));
  });
  await new Promise(resolve => ssh.listen(0, '127.0.0.1', resolve));
  const port = ssh.address().port;
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-learn-'));
  const env = { ...process.env, STANIS_TEST_USERDATA: path.join(scratch, 'data') }; delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await electron.launch({ executablePath: require('electron'), args: [root, '--test-mode'], env });
    const page = await app.firstWindow(); await page.waitForSelector('#sessions-list .tree-section');
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const save = profile => page.evaluate(p => window.api.call('profile:save', p), { host: '127.0.0.1', port, username: 'tester', type: 'ssh', ...profile });
    await save({ name: 'Lab A' }); await save({ name: 'Lab B' }); await save({ name: 'Lab C' });
    await page.reload(); await page.waitForSelector('#sessions-list .tree-section');
    await page.evaluate(() => { window.labOutput = ''; window.api.on('terminal:data', data => { window.labOutput += data.data; }); });
    const profiles = () => page.evaluate(async () => (await window.api.call('init')).config.profiles);
    const offer = page.locator('#dialog-title', { hasText: 'Automatizar o login' });

    // Conecta pela árvore como o usuário; senha e "confiar na chave" aparecem em momentos diferentes do handshake.
    async function connect(name) {
      const before = connections.length; await page.evaluate(() => { window.labOutput = ''; });
      await page.locator('.tree-row.session .tree-main').filter({ hasText: name }).click();
      const password = page.locator('#form-dialog [name=password]'), trust = page.getByRole('button', { name: 'Confiar nesta chave' }), tab = page.locator('#tabs .tab', { hasText: name });
      for (let i = 0; i < 40 && !(await tab.count()); i++) {
        if (await password.isVisible().catch(() => false)) { await password.fill('lab-only'); await page.click('#dialog-ok'); }
        if (await trust.isVisible().catch(() => false)) await trust.click();
        await page.waitForTimeout(400);
      }
      await tab.waitFor({ timeout: 15000 });
      await page.waitForFunction(() => window.labOutput.includes('lab$ '), null, { timeout: 15000 });
      await page.waitForTimeout(400);
      return connections[before] ?? connections.at(-1);
    }
    async function type(command) {
      const seen = connections.at(-1).length;
      await page.locator('.pane:not([hidden]) .xterm').click(); await page.keyboard.type(command, { delay: 15 }); await page.keyboard.press('Enter');
      await page.waitForFunction(text => window.labOutput.includes('resultado:' + text), command, { timeout: 10000 });
      assert.equal(connections.at(-1).length, seen + 1);
    }
    async function close(name) {
      await page.locator('#tabs .tab', { hasText: name }).locator('button', { hasText: '✕' }).click(); await page.click('#dialog-ok');
      await page.locator('#tabs .tab', { hasText: name }).waitFor({ state: 'detached' });
    }
    // Uma conexão: digita os comandos e diz se a pergunta de automatizar apareceu (espera um pouco para dar tempo).
    async function visit(name, commands) {
      await connect(name); for (const command of commands) await type(command);
      const asked = await offer.waitFor({ timeout: 1500 }).then(() => true, () => false);
      return asked;
    }
    async function answer(choice) {
      await page.locator('#form-dialog [name=choice]').selectOption(choice); const code = await page.locator('#form-dialog [name=code]').inputValue(); await page.click('#dialog-ok');
      await offer.waitFor({ state: 'hidden' }); return code;
    }
    const scriptOf = async name => (await profiles()).find(p => p.name === name).loginScript;

    // ---------- Lab A: só na 3ª conexão; "agora não" não pergunta de novo na hora ----------
    assert.equal(await visit('Lab A', ['echo oi']), false, '1ª conexão: ainda não pergunta');
    await close('Lab A');
    assert.equal(await visit('Lab A', ['echo oi']), false, '2ª conexão: ainda não pergunta');
    await close('Lab A');
    assert.equal(await visit('Lab A', ['echo oi']), true, '3ª conexão com o mesmo comando: pergunta');
    const proposed = await answer('later'); assert.match(proposed, /sendln\('echo oi'\)/); assert.match(proposed, /expect\('lab\$', 15000\)/, 'espera o prompt aprendido antes de digitar');
    await close('Lab A');
    assert.equal(await visit('Lab A', ['echo oi']), false, 'depois de "agora não", não pergunta de novo em seguida');
    await close('Lab A');
    assert.equal(await scriptOf('Lab A'), undefined, 'recusar não grava script');
    console.log('PASS: pergunta só na 3ª conexão e recusar não gera spam.');

    // ---------- Lab B: aceitar grava o script; ele roda sozinho; passo novo depois do script é oferecido ----------
    for (let i = 0; i < 2; i++) { assert.equal(await visit('Lab B', ['echo oi']), false); await close('Lab B'); }
    assert.equal(await visit('Lab B', ['echo oi']), true); await answer('yes'); await close('Lab B');
    assert.match(await scriptOf('Lab B'), /sendln\('echo oi'\)/, 'aceitar grava o script no perfil');
    const auto = await connect('Lab B');
    await page.waitForFunction(() => window.labOutput.includes('resultado:echo oi'), null, { timeout: 15000 });
    assert.deepEqual(auto, ['echo oi'], 'o script de login digitou o comando sozinho ao conectar');
    await close('Lab B');
    for (let i = 0; i < 2; i++) { assert.equal(await visit('Lab B', ['uptime']), false, 'passo novo ainda não repetiu 3 vezes'); await close('Lab B'); }
    assert.equal(await visit('Lab B', ['uptime']), true, 'passo novo repetido 3 vezes: pergunta de novo');
    const appended = await answer('yes'); assert.match(appended, /echo oi[\s\S]*sendln\('uptime'\)/, 'anexa ao script existente');
    await close('Lab B');
    const both = await connect('Lab B');
    await page.waitForFunction(() => window.labOutput.includes('resultado:uptime'), null, { timeout: 20000 });
    assert.deepEqual(both, ['echo oi', 'uptime'], 'os dois passos rodam sozinhos, na ordem');
    await close('Lab B');
    console.log('PASS: aceitar grava o script, ele roda ao conectar e o passo seguinte é anexado.');

    // ---------- Segredo nunca vira passo ----------
    for (let i = 0; i < 3; i++) { assert.equal(await visit('Lab C', ['mysql -psegredo123']), false, 'comando com segredo não é oferecido'); await close('Lab C'); }
    console.log('PASS: comandos com senha/token embutidos nunca são gravados nem oferecidos.');

    // ---------- Ver, editar e apagar ----------
    await page.locator('.tree-row.session', { hasText: 'Lab B' }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Editar…' }).or(page.locator('.ctx-menu button, [role=menu] button', { hasText: 'Editar…' })).first().click();
    await page.locator('#dialog-advanced summary').click();
    const box = page.locator('#form-dialog [name=loginScript]');
    assert.match(await box.inputValue(), /echo oi[\s\S]*uptime/, 'o usuário vê os comandos salvos');
    await box.fill(''); await page.click('#dialog-ok');
    await page.waitForFunction(async () => !(await window.api.call('init')).config.profiles.find(p => p.name === 'Lab B').loginScript);
    console.log('PASS: script de login visível em Editar sessão e removível.');
    assert.deepEqual(errors, [], 'sem erros no renderer');
  } finally { await app?.close(); ssh.close(); fs.rmSync(scratch, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
