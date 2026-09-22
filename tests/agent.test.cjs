const test = require('node:test');
const assert = require('node:assert');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const ssh2 = require('ssh2');
const { SSH } = require('../src/ssh.cjs');

const field = buf => { const l = Buffer.alloc(4); l.writeUInt32BE(buf.length); return Buffer.concat([l, buf]); };
const message = (type, body = Buffer.alloc(0)) => { const l = Buffer.alloc(4); l.writeUInt32BE(body.length + 1); return Buffer.concat([l, Buffer.from([type]), body]); };

// Agente SSH mínimo (protocolo OpenSSH): lista a identidade e assina desafios com a chave que só ele conhece.
function startAgent(pipe, key) {
  const blob = key.getPublicSSH(); let signed = 0;
  const server = net.createServer(socket => {
    let buffer = Buffer.alloc(0);
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 4 && buffer.length >= 4 + buffer.readUInt32BE(0)) {
        const size = buffer.readUInt32BE(0); const type = buffer[4]; const body = buffer.subarray(5, 4 + size); buffer = buffer.subarray(4 + size);
        if (type === 11) { const count = Buffer.alloc(4); count.writeUInt32BE(1); socket.write(message(12, Buffer.concat([count, field(blob), field(Buffer.from('teste'))]))); }
        else if (type === 13) {
          const keyLen = body.readUInt32BE(0); const dataLen = body.readUInt32BE(4 + keyLen); const data = body.subarray(8 + keyLen, 8 + keyLen + dataLen);
          signed++; socket.write(message(14, field(Buffer.concat([field(Buffer.from(key.type)), field(key.sign(data))]))));
        } else socket.write(message(5));
      }
    });
    socket.on('error', () => {});
  });
  return new Promise(resolve => server.listen(pipe, () => resolve({ server, signed: () => signed })));
}

test('login por agente SSH: sem pedir senha e sem a chave privada no app', async () => {
  const { private: privatePem } = ssh2.utils.generateKeyPairSync('ed25519'); const key = ssh2.utils.parseKey(privatePem);
  const pipe = process.platform === 'win32' ? `\\\\.\\pipe\\stanis-agent-${process.pid}` : path.join(os.tmpdir(), `stanis-agent-${process.pid}.sock`);
  const agent = await startAgent(pipe, key); process.env.SSH_AUTH_SOCK = pipe;
  const hostKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs1', format: 'pem' });
  let authenticatedWith = null;
  const server = new ssh2.Server({ hostKeys: [hostKey] }, client => {
    client.on('authentication', ctx => {
      if (ctx.method !== 'publickey') return ctx.reject(['publickey']);
      if (!ctx.key.data.equals(key.getPublicSSH())) return ctx.reject();
      if (ctx.signature && !key.verify(ctx.blob, ctx.signature, ctx.hashAlgo)) return ctx.reject();
      if (ctx.signature) authenticatedWith = 'publickey'; ctx.accept();
    });
    client.on('ready', () => {}); client.on('error', () => {});
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-cfg-'));
  const asked = [];
  const ssh = new SSH({ directory: dir, value: { profiles: [] } }, async q => { asked.push(q.title); return q.fields?.length ? { password: '' } : {}; }, { isEncryptionAvailable: () => false });
  const profile = { id: 'p1', host: '127.0.0.1', port: server.address().port, username: 'ana', useAgent: true };
  const client = await ssh.connect(profile);
  assert.strictEqual(authenticatedWith, 'publickey'); assert.strictEqual(agent.signed(), 1);
  assert.ok(!asked.some(t => t.startsWith('Autenticação')), 'não deve pedir senha quando usa o agente');
  client.end(); server.close(); agent.server.close();
});
