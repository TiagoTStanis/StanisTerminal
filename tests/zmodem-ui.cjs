// ZMODEM de ponta a ponta pela interface real: sessão SSH real, botões "Enviar/Baixar por ZMODEM"
// clicados de verdade, com os diálogos nativos de arquivo substituídos apenas no processo de teste.
const { _electron: electron } = require('playwright');
const { Server } = require('ssh2');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const Zmodem = require('zmodem.js');

const root = path.resolve(__dirname, '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-zmodem-ui-'));
async function listen(server) { server.listen(0, '127.0.0.1'); await once(server, 'listening'); return server.address().port; }

// Servidor faz o papel do `rz` real: anuncia-se com ZRINIT e recebe o que o cliente enviar.
function serverReceives(channel, onDone) {
  const session = new Zmodem.Session.Receive();
  session.set_sender(octets => channel.write(Buffer.from(octets)));
  channel.on('data', chunk => { try { session.consume(Array.from(chunk)); } catch { /* fim do canal */ } });
  session.start().then(offer => {
    if (!offer) return; const chunks = []; const details = offer.get_details();
    return offer.accept({ on_input: c => chunks.push(Buffer.from(c)) }).then(() => onDone({ name: details.name, data: Buffer.concat(chunks) }));
  }).catch(() => {});
}
// Servidor faz o papel do `sz` real: dispara um ZRQINIT e envia o arquivo pedido.
function serverSends(channel, { name, data }) {
  const sentry = new Zmodem.Sentry({
    to_terminal() {}, sender(octets) { channel.write(Buffer.from(octets)); }, on_retract() {},
    on_detect(detection) {
      const session = detection.confirm();
      session.send_offer({ name, size: data.length, mtime: new Date() }).then(offer => { if (offer) { offer.send(data); return offer.end(); } }).catch(() => {});
    }
  });
  channel.on('data', chunk => sentry.consume(Array.from(chunk)));
  channel.write(Buffer.from(Zmodem.Header.build('ZRQINIT').to_hex()));
}

(async () => {
  let app, ssh; let received = null;
  try {
    const uploadData = crypto.randomBytes(30000);
    const downloadData = crypto.randomBytes(40000);
    const hostKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs1', format: 'pem' });
    ssh = new Server({ hostKeys: [hostKey] }, client => {
      client.on('authentication', ctx => ctx.method === 'password' && ctx.username === 'tester' && ctx.password === 'lab-only' ? ctx.accept() : ctx.reject());
      client.on('ready', () => client.on('session', accept => {
        const session = accept();
        session.on('pty', accept2 => accept2()); session.on('window-change', accept2 => accept2?.());
        session.on('shell', accept2 => { const stream = accept2(); stream.write('SSH_LAB_READY\r\n'); stream.on('data', bytes => stream.write(bytes)); });
        session.on('exec', (accept2, reject2, info) => {
          const channel = accept2();
          if (info.command === 'rz') serverReceives(channel, r => { received = r; });
          else if (info.command === 'sz relatorio-servidor.log') serverSends(channel, { name: 'relatorio-servidor.log', data: downloadData });
          else { channel.stderr.write('comando desconhecido\n'); channel.exit(127); channel.end(); }
        });
      }));
    });
    const sshPort = await listen(ssh);

    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({ executablePath: require('electron'), args: [root, '--test-mode'], env, timeout: 30000 });
    const page = await app.firstWindow(); const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.waitForSelector('#sessions-list .tree-section');

    await page.fill('#quick-input', `ssh://tester@127.0.0.1:${sshPort}`); await page.click('#quick-go');
    await page.locator('#form-dialog [name=password]').fill('lab-only'); await page.click('#dialog-ok');
    await page.getByRole('button', { name: 'Confiar nesta chave' }).click();
    await page.waitForFunction(() => document.querySelector('.xterm-rows')?.textContent.includes('SSH_LAB_READY'), { timeout: 20000 });
    await page.click('#open-tools'); await page.waitForSelector('#tools-dialog[open]');

    // Upload: escolhe o arquivo local via diálogo nativo substituído; o servidor (rz) recebe.
    const localFile = path.join(scratch, 'envio.bin'); fs.writeFileSync(localFile, uploadData);
    await app.evaluate(async ({ dialog }, { localFile }) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [localFile] }); }, { localFile });
    await page.click('button:has-text("Enviar por ZMODEM")');
    await page.selectOption('[name=session]', { index: 0 }); await page.click('#dialog-ok');
    await page.waitForFunction(() => /Enviado:/.test(document.querySelector('#tools-output')?.textContent || ''), { timeout: 20000 });
    assert.ok(received, 'o servidor recebeu o arquivo'); assert.strictEqual(received.name, 'envio.bin'); assert.ok(received.data.equals(uploadData), 'conteúdo enviado é idêntico ao original');

    // Download: escolhe a pasta de destino via diálogo nativo substituído; o servidor (sz) envia.
    const destDir = fs.mkdtempSync(path.join(scratch, 'dest-'));
    await app.evaluate(async ({ dialog }, { destDir }) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [destDir] }); }, { destDir });
    await page.click('button:has-text("Baixar por ZMODEM")');
    await page.selectOption('[name=session]', { index: 0 });
    await page.fill('[name=command]', 'sz relatorio-servidor.log'); await page.click('#dialog-ok');
    await page.waitForFunction(() => /Salvo:/.test(document.querySelector('#tools-output')?.textContent || ''), { timeout: 20000 });
    const savedFile = path.join(destDir, 'relatorio-servidor.log');
    assert.ok(fs.existsSync(savedFile), 'arquivo baixado existe'); assert.ok(fs.readFileSync(savedFile).equals(downloadData), 'conteúdo baixado é idêntico ao do servidor');

    assert.deepEqual(errors, []);
    console.log('PASS: ZMODEM de ponta a ponta pela interface real (enviar e baixar), canal SSH dedicado, conteúdo binário íntegro.');
  } finally { await app?.close(); ssh?.close(); fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5 }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
