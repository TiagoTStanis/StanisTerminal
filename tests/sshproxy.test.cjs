const test = require('node:test');
const assert = require('node:assert');
const net = require('node:net');
const crypto = require('node:crypto');
const ssh2 = require('ssh2');
const { SSH } = require('../src/ssh.cjs');

// Servidor SOCKS5 mínimo (sem autenticação), só para provar que a conexão passa por ele.
function socksServer() {
  let connections = 0;
  const server = net.createServer(socket => {
    let stage = 0, buf = Buffer.alloc(0);
    socket.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      if (stage === 0 && buf.length >= 2) { socket.write(Buffer.from([5, 0])); buf = buf.subarray(2 + buf[1]); stage = 1; return; }
      if (stage === 1 && buf.length >= 10) {
        connections++; const host = [...buf.subarray(4, 8)].join('.'); const port = buf.readUInt16BE(8);
        const upstream = net.createConnection({ host, port }, () => {
          socket.write(Buffer.from([5, 0, 0, 1, 0, 0, 0, 0, 0, 0]));
          upstream.pipe(socket); socket.pipe(upstream);
        });
        upstream.on('error', () => socket.destroy()); stage = 2;
      }
    });
    socket.on('error', () => {});
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, connections: () => connections })));
}

test('conexão SSH pelo proxy SOCKS5: autentica e o proxy vê a conexão', async () => {
  const hostKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs1', format: 'pem' });
  let clientAddress = null;
  const sshServer = new ssh2.Server({ hostKeys: [hostKey] }, client => {
    client.on('authentication', ctx => ctx.method === 'password' && ctx.username === 'ana' && ctx.password === 'segredo' ? ctx.accept() : ctx.reject(['password']));
    client.on('ready', () => client.on('session', accept => { const session = accept(); session.once('shell', a => a().end()); }));
  });
  await new Promise(r => sshServer.listen(0, '127.0.0.1', r));
  sshServer.on('connection', socket => { clientAddress = socket.remoteAddress; });
  const socks = await socksServer();
  const known = { directory: require('node:os').tmpdir() + '/stanis-proxy-test', value: { profiles: [] } };
  require('node:fs').mkdirSync(known.directory, { recursive: true });
  const ssh = new SSH(known, async q => q.fields?.length ? { password: 'segredo' } : {}, { isEncryptionAvailable: () => false });
  const profile = { id: 'p', type: 'ssh', host: '127.0.0.1', port: sshServer.address().port, username: 'ana', proxyHost: '127.0.0.1', proxyPort: socks.port };
  const client = await ssh.connect(profile);
  assert.strictEqual(socks.connections(), 1, 'a conexão passou pelo proxy'); client.end(); sshServer.close(); socks.server.close();
});

test('não deixa configurar gateway SSH e proxy SOCKS5 ao mesmo tempo', () => {
  const { profile } = require('../src/config.cjs');
  assert.throws(() => profile({ type: 'ssh', name: 'x', host: 'h', jumpId: 'g', proxyHost: '127.0.0.1', proxyPort: 1080 }), /gateway SSH ou proxy/);
});
