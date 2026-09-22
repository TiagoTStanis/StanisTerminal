const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const ssh2 = require('ssh2');
const Zmodem = require('zmodem.js');
const { uploadZmodem, downloadZmodem } = require('../src/zmodemio.cjs');

// Servidor SSH real cujo `exec` interpreta rz/sz com a própria zmodem.js do "outro lado" — prova de
// interoperabilidade sem depender dos binários reais (lrzsz), que não existem nesta máquina Windows.
function startServer({ onExec }) {
  const hostKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs1', format: 'pem' });
  const server = new ssh2.Server({ hostKeys: [hostKey] }, client => {
    client.on('authentication', ctx => ctx.method === 'password' ? ctx.accept() : ctx.reject(['password']));
    client.on('ready', () => client.on('session', accept => {
      const session = accept();
      session.on('exec', (accept2, reject2, info) => { const channel = accept2(); onExec(info.command, channel); });
    }));
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}
function connectClient(port) {
  return new Promise((resolve, reject) => { const c = new ssh2.Client(); c.on('ready', () => resolve(c)).on('error', reject).connect({ host: '127.0.0.1', port, username: 'ana', password: 'x', readyTimeout: 5000 }); });
}
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-zmodem-'));

// Servidor faz o papel do `rz` real: anuncia-se com ZRINIT e recebe o que o cliente enviar.
function serverReceives(channel) {
  return new Promise((resolve, reject) => {
    const session = new Zmodem.Session.Receive();
    session.set_sender(octets => channel.write(Buffer.from(octets)));
    channel.on('data', chunk => { try { session.consume(Array.from(chunk)); } catch (error) { reject(error); } });
    channel.on('error', reject);
    session.start().then(offer => {
      if (!offer) return reject(new Error('Nenhuma oferta recebida.'));
      const chunks = []; const details = offer.get_details();
      offer.accept({ on_input: c => chunks.push(Buffer.from(c)) }).then(() => resolve({ name: details.name, data: Buffer.concat(chunks) }), reject);
    }, reject);
  });
}
// Servidor faz o papel do `sz` real: dispara um ZRQINIT (usando a própria zmodem.js) e envia o arquivo pedido.
function serverSends(channel, { name, data }) {
  return new Promise((resolve, reject) => {
    let session = null;
    const sentry = new Zmodem.Sentry({
      to_terminal() {}, sender(octets) { channel.write(Buffer.from(octets)); }, on_retract() { reject(new Error('retract')); },
      on_detect(detection) {
        session = detection.confirm();
        session.send_offer({ name, size: data.length, mtime: new Date() }).then(offer => {
          if (!offer) return reject(new Error('Cliente recusou o arquivo.'));
          offer.send(data); return offer.end();
        }).then(resolve, reject);
      }
    });
    channel.on('data', chunk => sentry.consume(Array.from(chunk)));
    channel.on('error', reject);
    channel.write(Buffer.from(Zmodem.Header.build('ZRQINIT').to_hex()));
  });
}

test('envia um arquivo local para o servidor (rz) e o conteúdo chega intacto', async () => {
  const dir = tmpDir(); const local = path.join(dir, 'origem.bin'); const data = crypto.randomBytes(50000);
  fs.writeFileSync(local, data);
  let received;
  const server = await startServer({ onExec: (cmd, channel) => { assert.strictEqual(cmd, 'rz'); serverReceives(channel).then(r => { received = r; }, () => {}); } });
  const client = await connectClient(server.address().port);
  const result = await uploadZmodem(client, local);
  await new Promise(r => setTimeout(r, 200));
  assert.strictEqual(result.bytes, data.length); assert.strictEqual(received.name, 'origem.bin'); assert.ok(received.data.equals(data), 'conteúdo recebido é idêntico ao enviado');
  client.end(); server.close();
});

test('baixa um arquivo do servidor (sz) e salva com o mesmo conteúdo', async () => {
  const dir = tmpDir(); const data = crypto.randomBytes(70000);
  const server = await startServer({ onExec: (cmd, channel) => { assert.strictEqual(cmd, 'sz relatorio.log'); serverSends(channel, { name: 'relatorio.log', data }); } });
  const client = await connectClient(server.address().port);
  const result = await downloadZmodem(client, 'sz relatorio.log', dir);
  assert.strictEqual(result.file, path.join(dir, 'relatorio.log'));
  assert.ok(fs.readFileSync(result.file).equals(data), 'arquivo salvo é idêntico ao enviado pelo servidor');
  client.end(); server.close();
});

test('download recusa sobrescrever arquivo já existente e nome com barras', async () => {
  const dir = tmpDir(); fs.writeFileSync(path.join(dir, 'ja-existe.txt'), 'antigo');
  const server = await startServer({ onExec: (cmd, channel) => { serverSends(channel, { name: 'ja-existe.txt', data: Buffer.from('novo') }).catch(() => {}); } });
  const client = await connectClient(server.address().port);
  await assert.rejects(downloadZmodem(client, 'sz ja-existe.txt', dir), /Já existe/);
  assert.strictEqual(fs.readFileSync(path.join(dir, 'ja-existe.txt'), 'utf8'), 'antigo');
  client.end(); server.close();

  const server2 = await startServer({ onExec: (cmd, channel) => { serverSends(channel, { name: '../../malicioso.txt', data: Buffer.from('x') }).catch(() => {}); } });
  const client2 = await connectClient(server2.address().port);
  const result = await downloadZmodem(client2, 'sz x', dir);
  assert.strictEqual(path.dirname(result.file), dir, 'nome com travessia de caminho é contido na pasta de destino');
  client2.end(); server2.close();
});

test('upload recusa arquivo maior que o limite e pasta em vez de arquivo', async () => {
  const dir = tmpDir(); const server = await startServer({ onExec: () => {} });
  const client = await connectClient(server.address().port);
  await assert.rejects(uploadZmodem(client, dir), /Escolha um arquivo/);
  client.end(); server.close();
});

test('quando o comando remoto não fala ZMODEM, dá erro claro em vez de travar', async () => {
  const server = await startServer({ onExec: (cmd, channel) => { channel.write('comando não encontrado\n'); channel.exit(127); channel.end(); } });
  const client = await connectClient(server.address().port);
  const dir = tmpDir(); const local = path.join(dir, 'a.txt'); fs.writeFileSync(local, 'x');
  await assert.rejects(uploadZmodem(client, local, { timeoutMs: 2000 }), /ZMODEM|encerrado/);
  client.end(); server.close();
});
