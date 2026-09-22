// Servidores de laboratório, restritos a localhost e encerrados no finally.
const { _electron: electron } = require('playwright');
const { Server } = require('ssh2');
const { utils: { sftp: { STATUS_CODE } } } = require('ssh2');
const crypto = require('node:crypto');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const root = path.resolve(__dirname, '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-connections-'));
const sockets = new Set();
function track(socket) { sockets.add(socket); socket.on('error', () => {}); socket.on('close', () => sockets.delete(socket)); return socket; }
async function listen(server) { server.listen(0, '127.0.0.1'); await once(server, 'listening'); return server.address().port; }
function sftpServer(sftp) {
  const contents = new Map([['/hello.txt', Buffer.from('Olá do SFTP de laboratório!')]]);
  const handles = new Map(); let sequence = 0;
  const attrs = file => ({ mode: file === '/' ? 0o40755 : 0o100644, uid: 0, gid: 0, size: contents.get(file)?.length || 0, atime: 1, mtime: 1 });
  const stat = (id, file) => file === '/' || contents.has(file) ? sftp.attrs(id, attrs(file)) : sftp.status(id, STATUS_CODE.NO_SUCH_FILE);
  sftp.on('REALPATH', (id, file) => sftp.name(id, [{ filename: file === '.' ? '/' : file, longname: '', attrs: attrs(file) }]));
  sftp.on('STAT', stat); sftp.on('LSTAT', stat);
  sftp.on('OPENDIR', (id, file) => { const key = String(++sequence); handles.set(key, { file, directory: true }); sftp.handle(id, Buffer.from(key)); });
  sftp.on('READDIR', (id, handle) => {
    const item = handles.get(handle.toString());
    if (item.read) return sftp.status(id, STATUS_CODE.EOF);
    item.read = true; sftp.name(id, [...contents.keys()].map(file => ({ filename: path.posix.basename(file), longname: '', attrs: attrs(file) })));
  });
  sftp.on('OPEN', (id, file, flags) => {
    if (flags & 8) { if (!contents.has(file) || flags & 16) contents.set(file, Buffer.alloc(0)); }
    if (!contents.has(file)) return sftp.status(id, STATUS_CODE.NO_SUCH_FILE);
    const key = String(++sequence); handles.set(key, { file }); sftp.handle(id, Buffer.from(key));
  });
  sftp.on('FSTAT', (id, handle) => stat(id, handles.get(handle.toString()).file));
  sftp.on('READ', (id, handle, offset, length) => {
    const bytes = contents.get(handles.get(handle.toString()).file);
    if (offset >= bytes.length) return sftp.status(id, STATUS_CODE.EOF);
    sftp.data(id, bytes.subarray(offset, offset + length));
  });
  sftp.on('WRITE', (id, handle, offset, bytes) => {
    const file = handles.get(handle.toString()).file, old = contents.get(file);
    const next = Buffer.alloc(Math.max(old.length, offset + bytes.length)); old.copy(next); bytes.copy(next, offset); contents.set(file, next); sftp.status(id, STATUS_CODE.OK);
  });
  sftp.on('CLOSE', (id, handle) => { handles.delete(handle.toString()); sftp.status(id, STATUS_CODE.OK); });
  sftp.on('RENAME', (id, before, after) => { contents.set(after, contents.get(before)); contents.delete(before); sftp.status(id, STATUS_CODE.OK); });
  sftp.on('REMOVE', (id, file) => { contents.delete(file); sftp.status(id, STATUS_CODE.OK); });
}
(async () => {
  let app, ssh, telnet, echo, vnc, ftp, vncSocket;
  const vncClipboardReceived = [];
  try {
    echo = net.createServer(socket => { track(socket); socket.pipe(socket); }); const echoPort = await listen(echo);
    const key = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs1', format: 'pem' });
    ssh = new Server({ hostKeys: [key] }, client => {
      track(client);
      client.on('authentication', ctx => ctx.method === 'password' && ctx.username === 'tester' && ctx.password === 'lab-only' ? ctx.accept() : ctx.reject());
      client.on('ready', () => {
        client.on('session', accept => {
          const session = accept();
          session.on('pty', accept => accept()); session.on('window-change', accept => accept?.());
          session.on('shell', accept => { const stream = accept(); stream.write('SSH_LAB_READY\r\n'); stream.on('data', bytes => stream.write(bytes)); });
          session.on('sftp', accept => sftpServer(accept()));
        });
        client.on('tcpip', (accept, reject, info) => {
          if (info.destIP !== '127.0.0.1' || info.destPort !== echoPort) return reject();
          const upstream = track(net.createConnection({ host: '127.0.0.1', port: echoPort }));
          upstream.once('connect', () => { const stream = accept(); upstream.pipe(stream).pipe(upstream); stream.on('close', () => upstream.destroy()); });
        });
      });
    }); const sshPort = await listen(ssh);
    telnet = net.createServer(socket => { track(socket); socket.write('TELNET_LAB_READY\r\n'); socket.on('data', bytes => socket.write(bytes)); }); const telnetPort = await listen(telnet);
    // RFB 3.8 mínimo, sem autenticação, para validar transporte e framebuffer no noVNC.
    vnc = net.createServer(socket => {
      track(socket); vncSocket = socket; let stage = 0, buffer = Buffer.alloc(0); socket.write('RFB 003.008\n');
      socket.on('data', chunk => {
        buffer = Buffer.concat([buffer, chunk]);
        if (stage === 0 && buffer.length >= 12) { buffer = buffer.subarray(12); stage = 1; socket.write(Buffer.from([1, 1])); }
        if (stage === 1 && buffer.length >= 1) { buffer = buffer.subarray(1); stage = 2; socket.write(Buffer.alloc(4)); }
        if (stage === 2 && buffer.length >= 1) {
          buffer = buffer.subarray(1); stage = 3; const name = Buffer.from('VNC de laboratório'); const header = Buffer.alloc(24);
          header.writeUInt16BE(64, 0); header.writeUInt16BE(64, 2); header[4] = 32; header[5] = 24; header[7] = 1;
          header.writeUInt16BE(255, 8); header.writeUInt16BE(255, 10); header.writeUInt16BE(255, 12); header[14] = 16; header[15] = 8; header.writeUInt32BE(name.length, 20);
          socket.write(Buffer.concat([header, name]));
        }
        if (stage === 3) {
          while (buffer.length) {
            const type = buffer[0];
            const length = type === 0 ? 20 : type === 2 && buffer.length >= 4 ? 4 + buffer.readUInt16BE(2) * 4
              : type === 3 ? 10 : type === 4 ? 8 : type === 5 ? 6 : type === 6 && buffer.length >= 8 ? 8 + buffer.readUInt32BE(4) : 0;
            if (!length || buffer.length < length) break;
            const message = buffer.subarray(0, length); buffer = buffer.subarray(length);
            if (type === 3) {
              const header = Buffer.alloc(16); header.writeUInt16BE(1, 2); header.writeUInt16BE(64, 8); header.writeUInt16BE(64, 10);
              const pixels = Buffer.alloc(64 * 64 * 4); for (let i = 0; i < pixels.length; i += 4) { pixels[i] = 80; pixels[i + 1] = 160; pixels[i + 2] = 40; }
              socket.write(Buffer.concat([header, pixels]));
            }
            if (type === 6) vncClipboardReceived.push(message.subarray(8).toString('latin1'));
          }
        }
      });
    }); const vncPort = await listen(vnc);
    function sendServerCutText(text) { const body = Buffer.from(text, 'latin1'); const header = Buffer.alloc(8); header[0] = 3; header.writeUInt32BE(body.length, 4); vncSocket.write(Buffer.concat([header, body])); }
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({ executablePath: process.env.STANIS_TEST_EXE || require('electron'), args: process.env.STANIS_TEST_EXE ? ['--test-mode'] : [root, '--test-mode'], env, timeout: 45000 });
    const page = await app.firstWindow(); await page.waitForSelector('#sessions-list .tree-section');
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.evaluate(() => { window.labOutput = ''; window.api.on('terminal:data', data => { window.labOutput += data.data; }); });
    const connection = page.evaluate(port => window.api.call('terminal:open', { id: 'lab-ssh', name: 'SSH laboratório', type: 'ssh', host: '127.0.0.1', port, username: 'tester' }), sshPort);
    await page.locator('#form-dialog [name=password]').fill('lab-only'); await page.locator('[name=remember]').check(); await page.click('#dialog-ok');
    await page.getByRole('button', { name: 'Confiar nesta chave' }).click();
    const terminal = await connection;
    await page.evaluate(id => window.api.call('terminal:activate', id), terminal.id);
    await page.waitForFunction(() => window.labOutput.includes('SSH_LAB_READY'));
    await page.evaluate(id => window.api.call('terminal:write', id, 'SSH_ECHO_OK\r'), terminal.id);
    await page.waitForFunction(() => window.labOutput.includes('SSH_ECHO_OK'));
    const listing = await page.evaluate(id => window.api.call('files:list', 'sftp', id, '.'), terminal.id); assert.equal(listing.rows[0].name, 'hello.txt');
    assert.equal(await page.evaluate(id => window.api.call('files:read', 'sftp', id, '/hello.txt'), terminal.id), 'Olá do SFTP de laboratório!');
    await page.evaluate(id => window.api.call('files:write', 'sftp', id, '/hello.txt', 'Edição SFTP confirmada'), terminal.id);
    assert.equal(await page.evaluate(id => window.api.call('files:read', 'sftp', id, '/hello.txt'), terminal.id), 'Edição SFTP confirmada');
    const local = path.join(scratch, 'transfer.txt'); fs.writeFileSync(local, 'Transferência binária e texto: ç 123');
    await app.evaluate(async ({ dialog }, { local }) => {
      // A transferência gráfica abre diálogos nativos; os testes usam o mesmo handler
      // com os seletores de arquivo substituídos apenas no processo de laboratório.
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [local] });
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: local + '.download' });
    }, { local });
    await page.evaluate(id => window.api.call('files:transfer', 'sftp', id, 'upload', '/'), terminal.id);
    await page.evaluate(id => window.api.call('files:transfer', 'sftp', id, 'download', '/transfer.txt'), terminal.id);
    assert.deepEqual(fs.readFileSync(local + '.download'), fs.readFileSync(local));
    ftp = await require('./ftp-lab.cjs').createFTP();
    const ftpConnect = page.evaluate(port => window.api.call('files:ftp', { host: '127.0.0.1', port, username: 'tester', secure: false }), ftp.port);
    await page.locator('#form-dialog [name=password]').fill('lab-only'); await page.click('#dialog-ok'); const ftpId = await ftpConnect;
    const ftpListing = await page.evaluate(id => window.api.call('files:list', 'ftp', id, '/'), ftpId); assert.equal(ftpListing.rows[0].name, 'hello.txt');
    await page.evaluate(id => window.api.call('files:transfer', 'ftp', id, 'upload', '/'), ftpId);
    fs.unlinkSync(local + '.download');
    await page.evaluate(id => window.api.call('files:transfer', 'ftp', id, 'download', '/transfer.txt'), ftpId);
    assert.deepEqual(fs.readFileSync(local + '.download'), fs.readFileSync(local));
    console.log('PASS: FTP em localhost, autenticação, listagem, upload e download com conferência dos bytes.');
    const probe = net.createServer(); const tunnelPort = await listen(probe); await new Promise(resolve => probe.close(resolve));
    const tunnel = await page.evaluate(options => window.api.call('network:tunnel', options), { session: terminal.id, host: '127.0.0.1', port: echoPort, localPort: tunnelPort });
    const tunnelClient = track(net.createConnection({ host: '127.0.0.1', port: tunnelPort })); await once(tunnelClient, 'connect');
    const reply = once(tunnelClient, 'data'); tunnelClient.write('TUNNEL_OK'); assert.equal((await reply)[0].toString(), 'TUNNEL_OK');
    const closed = once(tunnelClient, 'close'); await page.evaluate(id => window.api.call('network:stop', id), tunnel.id); await closed;
    console.log('PASS: SSH real em localhost, confiança da chave, terminal, SFTP listar/editar/upload/download, túnel e encerramento das conexões.');
    const secret = await app.evaluate(({ app, safeStorage }) => {
      const fs = process.getBuiltinModule('fs'), path = process.getBuiltinModule('path');
      const entries = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'credentials.json'), 'utf8'));
      return { encrypted: entries['lab-ssh'], decrypted: safeStorage.decryptString(Buffer.from(entries['lab-ssh'], 'base64')) };
    });
    assert.equal(JSON.parse(secret.decrypted).password, 'lab-only'); assert(!secret.encrypted.includes('lab-only'));
    const originalHosts = await app.evaluate(({ app }) => {
      const fs = process.getBuiltinModule('fs'), path = process.getBuiltinModule('path'); const file = path.join(app.getPath('userData'), 'known-hosts.json');
      const original = fs.readFileSync(file, 'utf8'); const modified = JSON.parse(original); for (const key of Object.keys(modified)) modified[key] = 'SHA256:CHANGED'; fs.writeFileSync(file, JSON.stringify(modified)); return original;
    });
    const rejected = await page.evaluate(async port => {
      try { await window.api.call('terminal:open', { id: 'lab-ssh', name: 'Chave alterada', type: 'ssh', host: '127.0.0.1', port, username: 'tester' }); return ''; }
      catch (error) { return error.message; }
    }, sshPort); assert.match(rejected, /MUDOU/);
    await app.evaluate(({ app }, original) => { process.getBuiltinModule('fs').writeFileSync(process.getBuiltinModule('path').join(app.getPath('userData'), 'known-hosts.json'), original); }, originalHosts);
    const changedUser = page.evaluate(async port => {
      try { await window.api.call('terminal:open', { id: 'lab-ssh', name: 'Outro usuário', type: 'ssh', host: '127.0.0.1', port, username: 'other' }); return ''; }
      catch (error) { return error.message; }
    }, sshPort);
    await page.locator('#form-dialog [name=password]').waitFor(); await page.click('#dialog-cancel'); assert.match(await changedUser, /cancelada/);
    console.log('PASS: senha SSH criptografada, bloqueio de chave alterada e nova autenticação ao mudar usuário/destino do perfil.');
    const tel = await page.evaluate(port => window.api.call('terminal:open', { name: 'Telnet laboratório', type: 'telnet', host: '127.0.0.1', port }), telnetPort);
    await page.evaluate(id => window.api.call('terminal:activate', id), tel.id); await page.waitForFunction(() => window.labOutput.includes('TELNET_LAB_READY'));
    await page.evaluate(id => window.api.call('terminal:write', id, 'TELNET_ECHO_OK\r'), tel.id); await page.waitForFunction(() => window.labOutput.includes('TELNET_ECHO_OK'));
    console.log('PASS: conexão Telnet e troca de dados reais em localhost.');
    await page.click('#new-session'); await page.locator('[name=name]').fill('VNC laboratório'); await page.locator('[name=type]').selectOption('vnc'); await page.locator('[name=host]').fill('127.0.0.1');
    await page.locator('#dialog-advanced summary').click(); await page.locator('[name=port]').fill(String(vncPort)); await page.click('#dialog-ok');
    await page.locator('.tree-row.session .tree-main').filter({ hasText: 'VNC laboratório' }).click(); await page.waitForFunction(() => document.querySelector('#status').textContent === 'VNC conectado.');
    await page.waitForFunction(() => [...document.querySelectorAll('.graphic-mount canvas')].some(canvas => canvas.width === 64 && canvas.height === 64 && canvas.getContext('2d').getImageData(0, 0, 1, 1).data[1] === 160));
    console.log('PASS: VNC negocia RFB, conecta no noVNC e renderiza o framebuffer recebido.');
    // Clipboard do servidor VNC chega no clipboard do Windows.
    await app.evaluate(({ clipboard }) => clipboard.writeText('')); sendServerCutText('Veio do servidor VNC de laboratório');
    await page.waitForFunction(async () => { const text = await window.api.call('clipboard:read'); return text === 'Veio do servidor VNC de laboratório'; });
    console.log('PASS: clipboard do servidor VNC (ServerCutText) chega no clipboard do Windows.');
    // Ctrl+Shift+V manda o clipboard do Windows para o servidor VNC.
    await app.evaluate(({ clipboard }) => clipboard.writeText('Indo para o servidor VNC de laboratório'));
    await page.locator('.graphic-mount canvas').click();
    await page.keyboard.press('Control+Shift+V');
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.ok(vncClipboardReceived.includes('Indo para o servidor VNC de laboratório'), `ClientCutText não chegou ao servidor. Recebido: ${JSON.stringify(vncClipboardReceived)}`);
    console.log('PASS: Ctrl+Shift+V manda o clipboard do Windows para o servidor VNC (ClientCutText).');
    // Colar direto na tela (evento nativo "paste") também deve funcionar.
    vncClipboardReceived.length = 0;
    await app.evaluate(({ clipboard }) => clipboard.writeText('Colado direto na tela VNC'));
    await page.evaluate(async () => {
      const canvas = document.querySelector('.graphic-mount canvas'); canvas.focus();
      const data = new DataTransfer(); data.setData('text/plain', 'Colado direto na tela VNC');
      canvas.closest('.graphic-mount').dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.ok(vncClipboardReceived.includes('Colado direto na tela VNC'), `Evento paste não chegou ao servidor. Recebido: ${JSON.stringify(vncClipboardReceived)}`);
    console.log('PASS: colar direto na tela VNC (evento paste) também manda o texto para o servidor.');
    // Teste do controle nativo RDP sem tentar acessar um servidor externo.
    const closedPortProbe = net.createServer(); const closedPort = await listen(closedPortProbe); await new Promise(resolve => closedPortProbe.close(resolve));
    const rdpEvents = await app.evaluate(async ({ app, BrowserWindow }, closedPort) => {
      const { spawn } = process.getBuiltinModule('child_process'); const path = process.getBuiltinModule('path');
      const file = app.isPackaged ? path.join(process.resourcesPath, 'native/RdpHost.exe') : path.join(app.getAppPath(), 'src/native/RdpHost.exe');
      const child = spawn(file, [BrowserWindow.getAllWindows()[0].getNativeWindowHandle().readBigUInt64LE().toString()], { windowsHide: true });
      const events = []; let buffer = '';
      child.stdout.on('data', bytes => {
        buffer += bytes;
        let index; while ((index = buffer.indexOf('\n')) !== -1) { const line = buffer.slice(0, index); buffer = buffer.slice(index + 1); if (line.trim()) events.push(JSON.parse(line)); }
      });
      await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('RDP não respondeu ao carregar')), 15000); const check = setInterval(() => { if (events.some(e => e.type === 'ready')) { clearTimeout(timer); clearInterval(check); resolve(); } }, 100); child.once('error', reject); });
      // Sem servidor RDP escutando nessa porta: deve falhar rápido (watchdog de conexão), nunca ficar travado sem aviso.
      child.stdin.write(JSON.stringify({ cmd: 'connect', host: '127.0.0.1', port: closedPort, username: 'tester', password: 'x' }) + '\n');
      await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Nenhum evento de erro/fechamento chegou em 30s: possível travamento silencioso.')), 30000); const check = setInterval(() => { if (events.some(e => e.type === 'error') || child.exitCode !== null) { clearTimeout(timer); clearInterval(check); resolve(); } }, 100); });
      await new Promise(resolve => setTimeout(resolve, 500));
      child.stdin.end(); try { child.kill(); } catch { /* já pode ter encerrado sozinho */ }
      return events;
    }, closedPort);
    assert.equal(rdpEvents[0].type, 'ready', rdpEvents[0] && rdpEvents[0].message);
    assert.ok(rdpEvents.some(e => e.type === 'error' && e.message && e.message.length > 10), `Nenhum erro descritivo foi emitido ao falhar a conexão RDP. Eventos: ${JSON.stringify(rdpEvents)}`);
    console.log('PASS: componente RDP inicializa, carrega o ActiveX oficial do Windows, e avisa com erro (sem travar) quando a conexão falha. Login remoto bem-sucedido não faz parte deste teste.');
    await page.click('#new-session'); await page.locator('[name=name]').fill('X11 laboratório'); await page.locator('[name=type]').selectOption('x11'); await page.click('#dialog-ok');
    await page.locator('.tree-row.session .tree-main').filter({ hasText: 'X11 laboratório' }).click();
    await page.waitForSelector('.tab:has-text("X11 laboratório")', { timeout: 30000 });
    const x11 = await app.evaluate(async ({ app }) => {
      const fs = process.getBuiltinModule('fs'); const path = process.getBuiltinModule('path'); const { execFile } = process.getBuiltinModule('child_process');
      const data = app.getPath('userData'), auth = fs.readdirSync(data).find(name => name.startsWith('Xauthority-'));
      if (!auth) throw new Error('Cookie X11 não foi criado.');
      const bytes = fs.readFileSync(path.join(data, auth)); let offset = 2; const fields = [];
      while (offset < bytes.length) { const length = bytes.readUInt16BE(offset); offset += 2; fields.push(bytes.subarray(offset, offset + length)); offset += length; }
      const file = app.isPackaged ? path.join(process.resourcesPath, 'vcxsrv/xwininfo.exe') : path.join(app.getAppPath(), 'vendor/vcxsrv/xwininfo.exe');
      return new Promise((resolve, reject) => execFile(file, ['-display', '127.0.0.1:' + fields[1].toString(), '-root'], { windowsHide: true, env: { ...process.env, XAUTHORITY: path.join(data, auth) }, timeout: 15000 }, (error, stdout, stderr) => error ? reject(new Error(stderr || error.message)) : resolve(stdout)));
    }); assert.match(x11, /Width:|width/i);
    console.log('PASS: servidor X11 inicia dentro da aba, aceita autenticação pelo cookie e responde ao xwininfo.');
    await page.screenshot({ path: path.join(root, 'test-results/connections.png') });
    assert.deepEqual(errors, []);
  } finally {
    if (app) await app.close();
    for (const socket of sockets) socket.destroy?.();
    for (const server of [ssh, telnet, echo, vnc]) if (server) server.close();
    ftp?.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
