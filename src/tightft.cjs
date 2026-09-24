const net = require('node:net');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const fs = require('node:fs');

// Transferência de arquivos do TightVNC (extensão própria dele, a mesma do TightVNC Viewer), numa conexão
// VNC separada e "compartilhada": não pede imagem de tela, então não interfere na sessão que está aberta.
// Formatos conferidos no código-fonte do TightVNC 2.8.88 (ft-common/FTMessage.h, ft-server-lib e
// rfb-sconn/RfbInitializer.cpp): o servidor só habilita arquivos quando a conexão escolhe a segurança
// "Tight" (16). Números em big-endian; strings = UINT32 tamanho + UTF-8.
const FT = {
  FILE_LIST_REQUEST: 0xFC000102, FILE_LIST_REPLY: 0xFC000103,
  UPLOAD_START_REQUEST: 0xFC000106, UPLOAD_START_REPLY: 0xFC000107,
  UPLOAD_DATA_REQUEST: 0xFC000108, UPLOAD_DATA_REPLY: 0xFC000109,
  UPLOAD_END_REQUEST: 0xFC00010A, UPLOAD_END_REPLY: 0xFC00010B,
  DOWNLOAD_START_REQUEST: 0xFC00010C, DOWNLOAD_START_REPLY: 0xFC00010D,
  DOWNLOAD_DATA_REQUEST: 0xFC00010E, DOWNLOAD_DATA_REPLY: 0xFC00010F, DOWNLOAD_END_REPLY: 0xFC000110,
  MKDIR_REQUEST: 0xFC000111, MKDIR_REPLY: 0xFC000112,
  REMOVE_REQUEST: 0xFC000113, REMOVE_REPLY: 0xFC000114,
  RENAME_REQUEST: 0xFC000115, RENAME_REPLY: 0xFC000116,
  LAST_REQUEST_FAILED_REPLY: 0xFC000119,
};
const CHUNK = 64 * 1024;
// O servidor devolve erros do Windows como "Error code N": traduz os mais comuns.
const WIN_ERRORS = { 2: 'arquivo não encontrado', 3: 'pasta não encontrada', 5: 'acesso negado', 32: 'o arquivo está em uso por outro programa', 80: 'já existe um arquivo com esse nome', 145: 'a pasta não está vazia', 183: 'já existe um item com esse nome' };
const explain = message => { const code = /Error code (\d+)/.exec(message)?.[1]; return 'TightVNC: ' + (WIN_ERRORS[code] || message); };

// Resposta ao desafio da autenticação VNC: DES com a senha (8 bytes) de bits invertidos como chave.
function vncResponse(password, challenge) {
  const reverse = byte => { let r = 0; for (let i = 0; i < 8; i++) if (byte & (1 << i)) r |= 128 >> i; return r; };
  const key = Buffer.alloc(8); Buffer.from(password || '', 'latin1').copy(key, 0, 0, 8);
  const cipher = crypto.createCipheriv('des-ecb', Buffer.from([...key].map(reverse)), null); cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(challenge), cipher.final()]);
}

const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; };
const utf8 = text => { const bytes = Buffer.from(text, 'utf8'); return Buffer.concat([u32(bytes.length), bytes]); };

class TightFT {
  constructor(socket) { this.socket = socket; this.buffer = Buffer.alloc(0); this.waiters = []; this.closed = null; this.queue = Promise.resolve(); }

  static connect({ host, port, password, timeout = 15000 }) {
    return new Promise((resolve, reject) => {
      const socket = net.connect({ host, port });
      const client = new TightFT(socket);
      socket.setTimeout(timeout, () => socket.destroy(new Error('O servidor VNC não respondeu a tempo.')));
      socket.on('data', data => { client.buffer = Buffer.concat([client.buffer, data]); client.pump(); });
      socket.on('error', error => client.fail(error));
      socket.on('close', () => client.fail(new Error('Conexão de arquivos do VNC encerrada.')));
      socket.once('connect', () => client.handshake(password).then(() => { socket.setTimeout(0); resolve(client); }, error => { socket.destroy(); reject(error); }));
    });
  }

  fail(error) { if (this.closed) return; this.closed = error; for (const w of this.waiters.splice(0)) w.reject(error); }
  pump() {
    while (this.waiters.length && this.buffer.length >= this.waiters[0].n) {
      const { n, resolve } = this.waiters.shift(); resolve(this.buffer.subarray(0, n)); this.buffer = this.buffer.subarray(n);
    }
  }
  read(n) {
    if (this.closed && this.buffer.length < n) return Promise.reject(this.closed);
    return new Promise((resolve, reject) => { this.waiters.push({ n, resolve, reject }); this.pump(); });
  }
  async readU8() { return (await this.read(1))[0]; }
  async readU16() { return (await this.read(2)).readUInt16BE(); }
  async readU32() { return (await this.read(4)).readUInt32BE(); }
  async readU64() { return Number((await this.read(8)).readBigUInt64BE()); }
  async readUtf8() { return (await this.read(await this.readU32())).toString('utf8').replace(/\0+$/, ''); }
  write(...parts) { this.socket.write(Buffer.concat(parts)); }

  async handshake(password) {
    const version = (await this.read(12)).toString('latin1');
    if (!/^RFB 003\.\d{3}\n$/.test(version)) throw new Error('O servidor não fala o protocolo VNC.');
    this.write(Buffer.from('RFB 003.008\n', 'latin1'));
    const count = await this.readU8();
    if (count === 0) throw new Error('Servidor VNC recusou a conexão: ' + await this.readUtf8());
    const types = [...await this.read(count)];
    // Tight (16) é o que habilita a transferência de arquivos no TightVNC.
    if (!types.includes(16)) throw new Error('Este servidor VNC não oferece a transferência de arquivos do TightVNC.');
    this.write(Buffer.from([16]));
    const tunnels = await this.readU32(); if (tunnels) { await this.read(tunnels * 16); this.write(u32(0)); }
    const auths = await this.readU32();
    if (auths) {
      const caps = await this.read(auths * 16); const codes = [];
      for (let i = 0; i < auths; i++) codes.push(caps.readUInt32BE(i * 16));
      if (!codes.includes(2)) throw new Error('O servidor pede uma autenticação VNC que o app não suporta.');
      this.write(u32(2));
      this.write(vncResponse(password, await this.read(16)));
    }
    if (await this.readU32() !== 0) throw new Error('Senha do VNC recusada na conexão de arquivos.');
    this.write(Buffer.from([1])); // ClientInit "compartilhado": não derruba a sessão de tela já aberta
    await this.read(20); await this.read(await this.readU32()); // ServerInit + nome da área de trabalho
    const srv = await this.readU16(), cl = await this.readU16(), enc = await this.readU16(); await this.read(2);
    const all = await this.read((srv + cl + enc) * 16);
    const clientMessages = [];
    for (let i = 0; i < cl; i++) clientMessages.push(all.readUInt32BE((srv + i) * 16));
    if (!clientMessages.includes(FT.FILE_LIST_REQUEST)) throw new Error('A transferência de arquivos está desativada neste servidor TightVNC (ou a senha é só de visualização).');
  }

  // Próxima resposta de arquivo; ignora mensagens comuns do VNC (sino, clipboard) que o servidor mande.
  async reply(expected) {
    for (;;) {
      const first = await this.readU8();
      if (first === 0xFC) {
        const id = ((first << 24) | ((await this.read(3)).readUIntBE(0, 3))) >>> 0;
        if (id === FT.LAST_REQUEST_FAILED_REPLY) throw new Error(explain(await this.readUtf8()));
        if (id !== expected) throw new Error(`Resposta inesperada do TightVNC (0x${id.toString(16)}).`);
        return;
      }
      if (first === 2) continue; // Bell
      if (first === 3) { await this.read(3); await this.read(await this.readU32()); continue; } // ServerCutText
      throw new Error(`Mensagem VNC inesperada na conexão de arquivos (${first}).`);
    }
  }
  async block() {
    const level = await this.readU8(), compressed = await this.readU32(), size = await this.readU32();
    const data = await this.read(compressed);
    return level ? zlib.inflateSync(data, { finishFlush: zlib.constants.Z_SYNC_FLUSH }).subarray(0, size) : Buffer.from(data);
  }
  // Uma operação por vez na conexão (o protocolo é pergunta/resposta).
  run(task) { const next = this.queue.then(task, task); this.queue = next.catch(() => {}); return next; }

  list(folder) {
    return this.run(async () => {
      this.write(u32(FT.FILE_LIST_REQUEST), Buffer.from([0]), utf8(folder));
      await this.reply(FT.FILE_LIST_REPLY);
      const data = await this.block(); let at = 4; const rows = [];
      for (let i = 0, count = data.readUInt32BE(0); i < count; i++) {
        const size = Number(data.readBigUInt64BE(at)), modified = Number(data.readBigUInt64BE(at + 8)), flags = data.readUInt16BE(at + 16);
        const length = data.readUInt32BE(at + 18); const name = data.subarray(at + 22, at + 22 + length).toString('utf8').replace(/\0+$/, '');
        at += 22 + length; rows.push({ name, size, modified, directory: !!(flags & 1) });
      }
      return rows;
    });
  }
  download(remote, local) {
    return this.run(async () => {
      this.write(u32(FT.DOWNLOAD_START_REQUEST), utf8(remote), u64(0));
      await this.reply(FT.DOWNLOAD_START_REPLY);
      const out = fs.createWriteStream(local); // o diálogo de salvar já confirmou a substituição
      try {
        for (;;) {
          this.write(u32(FT.DOWNLOAD_DATA_REQUEST), Buffer.from([0]), u32(CHUNK));
          const first = await this.peekEnd();
          if (first === 'end') break;
          const data = await this.block(); if (!out.write(data)) await new Promise(r => out.once('drain', r));
        }
      } finally { await new Promise(r => out.end(r)); }
    });
  }
  // Depois de DOWNLOAD_DATA_REQUEST vem DATA_REPLY (mais dados) ou END_REPLY (acabou).
  async peekEnd() {
    for (;;) {
      const first = await this.readU8();
      if (first === 2) continue;
      if (first === 3) { await this.read(3); await this.read(await this.readU32()); continue; }
      if (first !== 0xFC) throw new Error(`Mensagem VNC inesperada na conexão de arquivos (${first}).`);
      const id = ((first << 24) | ((await this.read(3)).readUIntBE(0, 3))) >>> 0;
      if (id === FT.LAST_REQUEST_FAILED_REPLY) throw new Error(explain(await this.readUtf8()));
      if (id === FT.DOWNLOAD_END_REPLY) { await this.read(9); return 'end'; }
      if (id === FT.DOWNLOAD_DATA_REPLY) return 'data';
      throw new Error(`Resposta inesperada do TightVNC (0x${id.toString(16)}).`);
    }
  }
  upload(local, remote, overwrite = false) {
    return this.run(async () => {
      const info = await fs.promises.stat(local);
      this.write(u32(FT.UPLOAD_START_REQUEST), utf8(remote), Buffer.from([overwrite ? 1 : 0]), u64(0));
      await this.reply(FT.UPLOAD_START_REPLY);
      const handle = await fs.promises.open(local, 'r');
      try {
        const chunk = Buffer.alloc(CHUNK);
        for (let offset = 0; offset < info.size;) {
          const { bytesRead } = await handle.read(chunk, 0, CHUNK, offset); if (!bytesRead) break;
          this.write(u32(FT.UPLOAD_DATA_REQUEST), Buffer.from([0]), u32(bytesRead), u32(bytesRead), chunk.subarray(0, bytesRead));
          await this.reply(FT.UPLOAD_DATA_REPLY); offset += bytesRead;
        }
      } finally { await handle.close(); }
      const flags = Buffer.alloc(2); this.write(u32(FT.UPLOAD_END_REQUEST), flags, u64(Math.round(info.mtimeMs)));
      await this.reply(FT.UPLOAD_END_REPLY);
    });
  }
  mkdir(folder) { return this.run(async () => { this.write(u32(FT.MKDIR_REQUEST), utf8(folder)); await this.reply(FT.MKDIR_REPLY); }); }
  remove(target) { return this.run(async () => { this.write(u32(FT.REMOVE_REQUEST), utf8(target)); await this.reply(FT.REMOVE_REPLY); }); }
  rename(from, to) { return this.run(async () => { this.write(u32(FT.RENAME_REQUEST), utf8(from), utf8(to)); await this.reply(FT.RENAME_REPLY); }); }
  close() { this.socket.destroy(); }
}
module.exports = { TightFT, vncResponse, FT };
