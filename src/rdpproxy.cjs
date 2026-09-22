// Proxy RDCleanPath: WebSocket (canvas WASM no renderer) <-> TLS <-> TCP (servidor RDP).
// Estrutura portada de electerm/electerm (src/app/server/rdp-proxy.js, MIT) — a codificação/decodificação
// ASN.1 DER do RDCleanPath é a mesma; a camada TLS foi reescrita para usar o módulo nativo do Node
// (rejectUnauthorized:false) em vez de node-forge: testado e confirmado que node-forge só implementa
// TLS 1.1 de fato (a constante TLS_1_2 existe mas o ClientHello gerado não inclui a extensão
// signature_algorithms exigida pelo TLS 1.2, e servidores estritos recusam o handshake). O Node nativo
// completa o handshake normalmente (inclusive TLS 1.3) contra certificados autoassinados típicos de RDP.
const net = require('node:net');
const tls = require('node:tls');

const VERSION_1 = 3390; // 3389 + 1
const TAG_SEQUENCE = 0x30, TAG_INTEGER = 0x02, TAG_OCTET_STRING = 0x04, TAG_UTF8STRING = 0x0c;
const TAG_CTX = n => 0xa0 + n;

function derEncodeLength(length) {
  if (length < 0x80) return Buffer.from([length]);
  const bytes = []; let temp = length;
  while (temp > 0) { bytes.unshift(temp & 0xff); temp >>= 8; }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}
function derWrap(tag, content) { return Buffer.concat([Buffer.from([tag]), derEncodeLength(content.length), content]); }
function derEncodeInteger(value) {
  if (value === 0) return derWrap(TAG_INTEGER, Buffer.from([0]));
  const bytes = []; let temp = value;
  while (temp > 0) { bytes.unshift(temp & 0xff); temp >>= 8; }
  if (bytes[0] & 0x80) bytes.unshift(0);
  return derWrap(TAG_INTEGER, Buffer.from(bytes));
}
function derEncodeUtf8String(str) { return derWrap(TAG_UTF8STRING, Buffer.from(str, 'utf-8')); }
function derEncodeOctetString(buf) { return derWrap(TAG_OCTET_STRING, buf); }
function derWrapContext(tagNum, content) { return derWrap(TAG_CTX(tagNum), content); }
function derDecodeLength(buf, offset) {
  const first = buf[offset];
  if (first < 0x80) return { length: first, bytesRead: 1 };
  const numBytes = first & 0x7f; let length = 0;
  for (let i = 0; i < numBytes; i++) length = (length << 8) | buf[offset + 1 + i];
  return { length, bytesRead: 1 + numBytes };
}
function derDecodeTLV(buf, offset) {
  const tag = buf[offset]; const { length, bytesRead } = derDecodeLength(buf, offset + 1);
  const headerLen = 1 + bytesRead;
  return { tag, value: buf.slice(offset + headerLen, offset + headerLen + length), totalLength: headerLen + length };
}
function derDecodeInteger(buf) { let val = 0; for (let i = 0; i < buf.length; i++) val = (val << 8) | buf[i]; return val; }
function derDecodeChildren(buf) {
  const children = []; let offset = 0;
  while (offset < buf.length) { const tlv = derDecodeTLV(buf, offset); children.push(tlv); offset += tlv.totalLength; }
  return children;
}
function parseRDCleanPathRequest(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const outer = derDecodeTLV(buf, 0);
  if (outer.tag !== TAG_SEQUENCE) throw new Error(`Esperava SEQUENCE (0x30), veio 0x${outer.tag.toString(16)}`);
  const children = derDecodeChildren(outer.value);
  let version = null, destination = null, x224ConnectionRequest = null;
  for (const child of children) {
    const ctxTag = child.tag & 0x1f;
    if (ctxTag === 0) { const t = derDecodeTLV(child.value, 0); version = derDecodeInteger(t.value); }
    else if (ctxTag === 2) { const t = derDecodeTLV(child.value, 0); destination = t.value.toString('utf-8'); }
    else if (ctxTag === 6) { const t = derDecodeTLV(child.value, 0); x224ConnectionRequest = t.value; }
  }
  if (version !== VERSION_1) throw new Error(`Versão RDCleanPath não suportada: ${version} (esperado ${VERSION_1})`);
  if (!destination) throw new Error('Faltou o destino na requisição RDCleanPath.');
  if (!x224ConnectionRequest) throw new Error('Faltou o x224_connection_pdu na requisição RDCleanPath.');
  return { destination, x224ConnectionRequest };
}
function buildRDCleanPathResponse(serverAddr, x224Response, certChain) {
  const parts = [
    derWrapContext(0, derEncodeInteger(VERSION_1)),
    derWrapContext(6, derEncodeOctetString(x224Response)),
    derWrapContext(7, derWrap(TAG_SEQUENCE, Buffer.concat(certChain.map(cert => derEncodeOctetString(cert))))),
    derWrapContext(9, derEncodeUtf8String(serverAddr))
  ];
  return derWrap(TAG_SEQUENCE, Buffer.concat(parts));
}
function buildRDCleanPathError(errorCode, httpStatusCode) {
  const errParts = [derWrapContext(0, derEncodeInteger(errorCode))];
  if (httpStatusCode != null) errParts.push(derWrapContext(1, derEncodeInteger(httpStatusCode)));
  const errSeq = derWrap(TAG_SEQUENCE, Buffer.concat(errParts));
  const parts = [derWrapContext(0, derEncodeInteger(VERSION_1)), derWrapContext(1, errSeq)];
  return derWrap(TAG_SEQUENCE, Buffer.concat(parts));
}
function parseDestination(destination) {
  if (destination.startsWith('[')) {
    const bracketEnd = destination.indexOf(']');
    if (bracketEnd === -1) throw new Error(`Destino IPv6 inválido: ${destination}`);
    const host = destination.slice(1, bracketEnd); const rest = destination.slice(bracketEnd + 1);
    return { host, port: rest.startsWith(':') ? parseInt(rest.slice(1), 10) : 3389 };
  }
  const lastColon = destination.lastIndexOf(':');
  if (lastColon === -1) return { host: destination, port: 3389 };
  const host = destination.slice(0, lastColon); const port = parseInt(destination.slice(lastColon + 1), 10);
  return isNaN(port) ? { host: destination, port: 3389 } : { host, port };
}
function certChainOf(tlsSocket) {
  const chain = []; let cert = tlsSocket.getPeerCertificate(true);
  const seen = new Set();
  while (cert && cert.raw && !seen.has(cert.fingerprint256)) {
    seen.add(cert.fingerprint256); chain.push(cert.raw);
    cert = cert.issuerCertificate === cert ? null : cert.issuerCertificate;
  }
  return chain;
}
async function performRDPHandshake(host, port, x224Request, options = {}) {
  const tcpSocket = await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => { socket.write(x224Request); resolve(socket); });
    socket.once('error', error => reject(new Error(`Falha na conexão TCP: ${error.message}`)));
  });
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (error, result) => { if (settled) return; settled = true; error ? reject(error) : resolve(result); };
    tcpSocket.once('error', error => settle(new Error(`Falha na conexão TCP: ${error.message}`)));
    tcpSocket.once('data', x224Response => {
      if (x224Response.length === 0) { tcpSocket.destroy(); settle(new Error('O servidor RDP encerrou a conexão sem responder ao X.224.')); return; }
      tcpSocket.removeAllListeners('error');
      // Servidores RDP usam certificado autoassinado por padrão — rejectUnauthorized:false aceita
      // qualquer certificado (igual à autenticação nível 2 que já usávamos com o ActiveX do Windows).
      const tlsSocket = tls.connect({ socket: tcpSocket, rejectUnauthorized: false, minVersion: 'TLSv1.2' }, () => {
        tcpSocket.setTimeout(0); tcpSocket.setNoDelay(true); tcpSocket.setKeepAlive(true, 10000);
        settle(null, { x224Response: Buffer.from(x224Response), certChain: certChainOf(tlsSocket), tlsSocket });
      });
      tlsSocket.once('error', error => settle(new Error(`Handshake TLS falhou: ${error.message}`)));
    });
    tcpSocket.setTimeout(options.readyTimeout || 15000, () => { tcpSocket.destroy(); settle(new Error('Tempo limite ao conectar por RDP.')); });
  });
}
function setupTlsRelay(ws, tlsSocket) {
  const cleanup = () => { if (!tlsSocket.destroyed) tlsSocket.destroy(); if (ws.readyState === 1) try { ws.close(); } catch { /* já fechado */ } };
  tlsSocket.on('data', data => { try { if (ws.readyState === 1) ws.send(data); } catch { /* WS fechado */ } });
  ws.on('message', data => { try { tlsSocket.write(Buffer.isBuffer(data) ? data : Buffer.from(data)); } catch { /* TLS já fechado */ } });
  tlsSocket.on('end', cleanup); tlsSocket.on('error', cleanup); tlsSocket.on('close', cleanup);
  ws.on('close', cleanup); ws.on('error', cleanup);
}
function handleConnection(ws, options = {}) {
  ws.once('message', async data => {
    try {
      const request = parseRDCleanPathRequest(Buffer.isBuffer(data) ? data : Buffer.from(data));
      const { host, port } = parseDestination(request.destination);
      const { x224Response, certChain, tlsSocket } = await performRDPHandshake(host, port, request.x224ConnectionRequest, options);
      ws.send(buildRDCleanPathResponse(`${host}:${port}`, x224Response, certChain));
      setupTlsRelay(ws, tlsSocket);
    } catch (error) {
      try { ws.send(buildRDCleanPathError(1, 502)); } catch { /* WS já fechado */ }
      try { ws.close(); } catch { /* já fechado */ }
    }
  });
}
module.exports = { handleConnection, parseRDCleanPathRequest, parseDestination };
