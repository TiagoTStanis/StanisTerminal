// Handshake completo (TCP + upgrade TLS real, TLS 1.2 mínimo em ambos os lados) contra um servidor
// RDP fake — valida a parte mais arriscada do código portado: o proxy RDCleanPath e o relay TLS.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const tls = require('node:tls');
const forge = require('node-forge');
const { WebSocket, WebSocketServer } = require('ws');
const { handleConnection } = require('../src/rdpproxy.cjs');

function derWrap(tag, content) {
  const len = content.length < 0x80 ? Buffer.from([content.length]) : (() => { const b = []; let t = content.length; while (t > 0) { b.unshift(t & 0xff); t >>= 8; } return Buffer.from([0x80 | b.length, ...b]); })();
  return Buffer.concat([Buffer.from([tag]), len, content]);
}
function derInt(value) { return derWrap(0x02, Buffer.from([value >> 8, value & 0xff])); }
function derUtf8(str) { return derWrap(0x0c, Buffer.from(str, 'utf8')); }
function derOctet(buf) { return derWrap(0x04, buf); }
function derCtx(n, content) { return derWrap(0xa0 + n, content); }
function buildRDCleanPathRequest(destination, x224Bytes) {
  const parts = [derCtx(0, derInt(3390)), derCtx(2, derUtf8(destination)), derCtx(6, derOctet(x224Bytes))];
  return derWrap(0x30, Buffer.concat(parts));
}

function selfSigned(extensions) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey; cert.serialNumber = '01';
  cert.validity.notBefore = new Date(); cert.validity.notAfter = new Date(Date.now() + 3600000);
  const attrs = [{ name: 'commonName', value: 'rdp-lab' }];
  cert.setSubject(attrs); cert.setIssuer(attrs);
  if (extensions) cert.setExtensions(extensions);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return { cert: forge.pki.certificateToPem(cert), key: forge.pki.privateKeyToPem(keys.privateKey) };
}

async function handshakeAndEcho(pem) {

  const rdpServer = net.createServer(socket => {
    socket.once('data', () => {
      socket.write(Buffer.from('X224RESP'));
      // RDP de verdade não oferece TLS 1.3 na camada de segurança do protocolo; node-forge (usado no
      // proxy) também só fala até TLS 1.2 — force isso aqui pra simular um alvo real, não a falha de
      // interoperabilidade genérica com TLS 1.3 que não é o cenário que estamos validando.
      // Sem afrouxar nada aqui: TLS 1.2 mínimo, política padrão do OpenSSL/Node — simula um servidor
      // Windows moderno e estrito, exatamente o cenário que preocupava.
      const tlsSocket = new tls.TLSSocket(socket, { isServer: true, cert: pem.cert, key: pem.key, minVersion: 'TLSv1.2' });
      tlsSocket.on('data', data => tlsSocket.write(Buffer.concat([Buffer.from('eco:'), data])));
      tlsSocket.on('error', () => {});
    });
  });
  await new Promise(resolve => rdpServer.listen(0, '127.0.0.1', resolve));
  const rdpPort = rdpServer.address().port;

  const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise(resolve => wss.once('listening', resolve));
  wss.on('connection', ws => handleConnection(ws, { readyTimeout: 5000 }));
  const wsPort = wss.address().port;

  const client = new WebSocket(`ws://127.0.0.1:${wsPort}/`);
  await new Promise((resolve, reject) => { client.once('open', resolve); client.once('error', reject); });

  const firstMessage = new Promise(resolve => client.once('message', resolve));
  client.send(buildRDCleanPathRequest(`127.0.0.1:${rdpPort}`, Buffer.from('X224REQ')));
  const rdCleanPathResponse = await firstMessage;
  assert.ok(Buffer.isBuffer(rdCleanPathResponse) && rdCleanPathResponse.length > 0, 'deve receber a resposta RDCleanPath (com a cadeia de certificados)');

  const echoed = new Promise(resolve => client.once('message', resolve));
  client.send(Buffer.from('OLA_DENTRO_DO_TLS'));
  const echo = await echoed;
  assert.equal(echo.toString(), 'eco:OLA_DENTRO_DO_TLS', 'o texto deve ir cifrado até o servidor fake, ser ecoado, e voltar decifrado até o cliente WS');

  client.close(); wss.close(); rdpServer.close();
}

test('handshake completo: TCP + X.224 + TLS + relay bidirecional', () => handshakeAndEcho(selfSigned()));

// Certificado igual ao que o próprio Windows gera para o RDP: Key Usage só "Key Encipherment, Data
// Encipherment", sem "Digital Signature". O BoringSSL do Electron recusa esse certificado numa troca
// de chaves ECDHE/TLS 1.3 (KEY_USAGE_BIT_INCORRECT) mesmo com rejectUnauthorized:false — o proxy
// precisa conectar mesmo assim, como o mstsc. Só reproduz rodando no Node do Electron
// (ELECTRON_RUN_AS_NODE=1 electron --test ...); no Node comum (OpenSSL) passa de qualquer jeito.
test('certificado RDP do Windows (Key Usage só Key Encipherment) conecta', () => handshakeAndEcho(selfSigned([
  { name: 'keyUsage', critical: true, keyEncipherment: true, dataEncipherment: true },
  { name: 'extKeyUsage', serverAuth: true },
])));
