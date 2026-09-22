const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

(async () => {
  const root = path.resolve(__dirname, '..');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-import-ui-'));
  const file = path.join(temporary, 'mremote.xml');
  fs.writeFileSync(file, `<?xml version="1.0"?><Connections ConfVersion="2.6" FullFileEncryption="False">
    <Node Name="Laboratório" Type="Container" Username="ana" Domain="LAB">
      <Node Name="Desktop XML" Type="Connection" Protocol="RDP" Hostname="192.0.2.10" Port="3391" InheritUsername="True" InheritDomain="True" Password="SEGREDO_NAO_IMPORTAR"/>
      <Node Name="Linux XML" Type="Connection" Protocol="SSH2" Hostname="192.0.2.11" Port="2222" Username="operador"/>
      <Node Name="Site ignorado" Type="Connection" Protocol="HTTP" Hostname="example.test"/>
    </Node></Connections>`);
  const env = { ...process.env, STANIS_TEST_USERDATA: path.join(temporary, 'data') }; delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ executablePath: process.env.STANIS_TEST_EXE || require('electron'), args: process.env.STANIS_TEST_EXE ? ['--test-mode'] : [root, '--test-mode'], env });
  const page = await app.firstWindow();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const call = (...args) => page.evaluate(args => window.api.call(...args), args);
  const config = async () => (await call('init')).config;
  const selectFile = async selected => app.evaluate(({ dialog }, selected) => { dialog.showOpenDialog = async () => ({ canceled: !selected, filePaths: selected ? [selected] : [] }); }, selected);
  try {
    await page.waitForSelector('#sessions-list .tree-section');
    await page.click('#new-session');
    assert.equal(await page.locator('#dialog-advanced').evaluate(el => el.open), false);
    assert.equal(await page.locator('[name=host]').isVisible(), true);
    assert.equal(await page.locator('[name=keyPath]').isVisible(), false);
    assert.equal(await page.locator('[name=proxyHost]').isVisible(), false);
    assert.equal(await page.locator('[name=port]').isVisible(), false);
    await page.locator('[name=name]').fill('SSH simples'); await page.locator('[name=host]').fill('simple.local');
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'test-results/conexao-simples.png') });
    await page.click('#dialog-ok'); await page.waitForSelector('.tree-name:text("SSH simples")');
    assert.equal((await config()).profiles[0].port, 22);
    await page.locator('.tree-row.session:has-text("SSH simples")').click({ button: 'right' });
    await page.click('.ctx-item:has-text("Editar")');
    await page.click('#dialog-advanced summary');
    await page.locator('[name=port]').fill('2222'); await page.locator('[name=keyPath]').fill('C:\\keys\\id_ed25519');
    await page.locator('[name=useAgent]').check(); await page.locator('[name=agentForward]').check();
    await page.locator('[name=newGroup]').fill('Meus servidores');
    await page.screenshot({ path: path.join(root, 'test-results/conexao-avancada.png') });
    await page.click('#dialog-advanced summary'); await page.click('#dialog-ok');
    await page.waitForSelector('.tree-row.folder:has-text("Meus servidores")');
    let ssh = (await config()).profiles.find(p => p.name === 'SSH simples');
    assert.equal(ssh.port, 2222); assert.equal(ssh.useAgent, true); assert.equal(ssh.agentForward, true);
    assert.equal(ssh.keyPath, 'C:\\keys\\id_ed25519'); assert.equal(ssh.group, 'Meus servidores');
    await page.locator('.tree-row.session:has-text("SSH simples")').click({ button: 'right' }); await page.click('.ctx-item:has-text("Editar")');
    assert.equal(await page.locator('#dialog-advanced').evaluate(el => el.open), false);
    await page.locator('[name=name]').fill('SSH renomeada'); await page.click('#dialog-ok');
    await page.waitForSelector('.tree-name:text("SSH renomeada")');
    ssh = (await config()).profiles.find(p => p.name === 'SSH renomeada'); assert.equal(ssh.port, 2222); assert.equal(ssh.keyPath, 'C:\\keys\\id_ed25519');
    await page.click('#new-session'); await page.locator('[name=name]').fill('RDP simples'); await page.selectOption('[name=type]', 'rdp');
    await page.locator('[name=host]').fill('desktop.local'); await page.click('#dialog-ok'); await page.waitForSelector('.tree-name:text("RDP simples")');
    assert.equal((await config()).profiles.find(p => p.name === 'RDP simples').port, 3389);

    // O seletor nativo é substituído; arquivo, parser, revisão, IPC e persistência são reais.
    await selectFile(file); await page.click('#import-sessions');
    await page.waitForSelector('#dialog-title:text("Revisar 2")');
    assert.match(await page.locator('#dialog-message').textContent(), /HTTP/);
    assert.equal((await config()).profiles.length, 2);
    await page.screenshot({ path: path.join(root, 'test-results/importacao-mremote.png') });
    await page.click('#dialog-cancel'); assert.equal((await config()).profiles.length, 2);
    await page.click('#import-sessions'); await page.waitForSelector('#dialog-title:text("Revisar 2")'); await page.click('#dialog-ok');
    await page.waitForSelector('.tree-name:text("Desktop XML")');
    let cfg = await config(); const rdp = cfg.profiles.find(p => p.name === 'Desktop XML');
    assert.equal(rdp.type, 'rdp'); assert.equal(rdp.port, 3391); assert.equal(rdp.username, 'LAB\\ana'); assert.equal(rdp.group, 'Laboratório');
    assert(!JSON.stringify(cfg).includes('SEGREDO_NAO_IMPORTAR'));
    assert(!fs.readFileSync(path.join(temporary, 'data/config.json'), 'utf8').includes('SEGREDO_NAO_IMPORTAR'));
    await page.click('#import-sessions'); await page.waitForSelector('#dialog-title:text("Revisar 2")'); await page.click('#dialog-ok');
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('sem duplicar'));
    assert.equal((await config()).profiles.length, 4);
    const snapshot = JSON.stringify(await config());
    await assert.rejects(call('import:apply', [{ type: 'ssh', name: 'Boa', host: 'ok.local' }, { type: 'rdp', name: 'Ruim', host: '' }]), /Host/);
    assert.equal(JSON.stringify(await config()), snapshot);

    fs.writeFileSync(file, '<Connections FullFileEncryption="True">cifrado</Connections>');
    await page.click('#import-sessions'); await page.waitForFunction(() => document.querySelector('#import-status').textContent.includes('criptografado'));
    fs.writeFileSync(file, '<Connections><Node></Connections>');
    await page.click('#import-file'); await page.waitForFunction(() => document.querySelector('#import-status').textContent.includes('XML inválido'));
    await selectFile(null); await page.click('#import-file'); await page.waitForFunction(() => document.querySelector('#import-status').textContent.includes('Nenhum arquivo selecionado'));
    await page.click('#import-scan');
    await page.waitForFunction(() => !document.querySelector('#import-scan').disabled);
    // A máquina de teste pode ter sessões reais; a busca apenas revisa, nunca importa sozinha.
    assert.equal(JSON.stringify(await config()), snapshot);
    assert.deepEqual(errors, []);
    console.log('PASS: conexão simples/avançada, edição preservada, portas por protocolo, XML real com revisão/cancelamento, RDP/SSH/pastas/domínio, duplicatas, lote atômico, erro de XML/cifra, seleção cancelada e busca sem gravação automática.');
  } finally { await app.close(); fs.rmSync(temporary, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
