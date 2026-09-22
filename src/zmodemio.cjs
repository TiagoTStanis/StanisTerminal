const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const Zmodem = require('zmodem.js');

// ZMODEM sobre um canal SSH dedicado (client.exec de "rz"/"sz"), independente do terminal interativo.
// O canal de exec do ssh2 é binário (Buffer) de ponta a ponta: nada passa pelo StringDecoder UTF-8
// que a sessão interativa usa, então não há risco de corromper a transferência. Como não há shell
// entre o app e o comando remoto, não é preciso "farejar" a saída (Sentry) para achar o início do
// protocolo — mas usamos o Sentry mesmo assim porque é a via documentada e testada da biblioteca.
const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB por transferência

function execChannel(client, command) {
  return new Promise((resolve, reject) => client.exec(command, (error, channel) => error ? reject(error) : resolve(channel)));
}

function runSentry(channel, { onSend, onReceive }, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => { if (settled) return; settled = true; clearTimeout(timer); fn(value); };
    const timer = setTimeout(() => finish(reject, new Error('Tempo esgotado aguardando o início do ZMODEM. O comando remoto (rz/sz) pode não existir.')), timeoutMs);
    const sentry = new Zmodem.Sentry({
      to_terminal() { /* canal dedicado ao ZMODEM: não deveria haver texto de shell aqui */ },
      sender(octets) { channel.write(Buffer.from(octets)); },
      on_retract() { finish(reject, new Error('ZMODEM não foi detectado no canal (o comando remoto pode ter falhado).')); },
      on_detect(detection) {
        const session = detection.confirm();
        const handler = session.type === 'send' ? onSend : onReceive;
        handler(session).then(value => finish(resolve, value), error => finish(reject, error));
      }
    });
    channel.on('data', chunk => { try { sentry.consume(Array.from(chunk)); } catch (error) { finish(reject, error); } });
    channel.stderr?.on('data', () => {}); // mensagens do lrzsz para o usuário; não fazem parte do protocolo
    channel.on('close', () => finish(reject, new Error('O canal foi encerrado antes de concluir o ZMODEM.')));
    channel.on('error', error => finish(reject, error));
  });
}

// Envia um arquivo local para o servidor via `rz` remoto (o servidor recebe).
async function uploadZmodem(client, localPath, { onProgress, timeoutMs = 20000 } = {}) {
  const stat = await fsp.stat(localPath); if (!stat.isFile()) throw new Error('Escolha um arquivo, não uma pasta.');
  if (stat.size > MAX_BYTES) throw new Error('Limite de 2 GiB por transferência ZMODEM.');
  const channel = await execChannel(client, 'rz');
  return runSentry(channel, {
    onReceive: async () => { throw new Error('O servidor está oferecendo um arquivo (sz); use “Baixar por ZMODEM”.'); },
    onSend: async session => {
      const offer = await session.send_offer({ name: path.basename(localPath), size: stat.size, mtime: stat.mtime, mode: 0o644 });
      if (!offer) throw new Error('O servidor recusou receber o arquivo (talvez já exista no destino).');
      const fh = await fsp.open(localPath, 'r'); const CHUNK = 8192; const buffer = Buffer.alloc(CHUNK); let sent = 0;
      try {
        for (;;) {
          const { bytesRead } = await fh.read(buffer, 0, CHUNK, null); if (!bytesRead) break;
          offer.send(buffer.subarray(0, bytesRead)); sent += bytesRead; onProgress?.(sent, stat.size);
        }
      } finally { await fh.close(); }
      await offer.end(); channel.close();
      return { bytes: sent, file: localPath };
    }
  }, timeoutMs);
}

// Recebe um arquivo do servidor executando `remoteCommand` (ex.: "sz caminho/arquivo"); salva em localDir.
async function downloadZmodem(client, remoteCommand, localDir, { onProgress, timeoutMs = 20000 } = {}) {
  const channel = await execChannel(client, remoteCommand);
  return runSentry(channel, {
    onSend: async () => { throw new Error('O servidor está pronto para receber (rz); use “Enviar por ZMODEM”.'); },
    onReceive: async session => {
      const offer = await session.start(); if (!offer) throw new Error('O servidor não ofereceu nenhum arquivo.');
      const details = offer.get_details();
      const name = path.basename(String(details.name || 'arquivo-zmodem').replace(/[\\/]/g, '_'));
      if (!name || name === '.' || name === '..') throw new Error('O servidor ofereceu um nome de arquivo inválido.');
      if (details.size > MAX_BYTES) { offer.skip(); throw new Error('Limite de 2 GiB por transferência ZMODEM.'); }
      const target = path.join(localDir, name);
      if (fs.existsSync(target)) { offer.skip(); throw new Error(`Já existe um arquivo chamado “${name}” no destino.`); }
      const out = fs.createWriteStream(target, { flags: 'wx' }); let received = 0;
      try { await offer.accept({ on_input: chunk => { out.write(Buffer.from(chunk)); received += chunk.length; onProgress?.(received, details.size); } }); }
      catch (error) { out.destroy(); await fsp.rm(target, { force: true }); throw error; }
      await new Promise((resolve, reject) => out.end(error => error ? reject(error) : resolve()));
      channel.close();
      return { bytes: received, file: target };
    }
  }, timeoutMs);
}
module.exports = { uploadZmodem, downloadZmodem };
