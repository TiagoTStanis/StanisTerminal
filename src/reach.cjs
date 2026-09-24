const net = require('node:net');
const dns = require('node:dns').promises;

// Status online das sessões: só um SYN na porta do serviço (connect TCP), fechado na hora.
// Leve para centenas de hosts: muitas tentativas em paralelo (cada uma é só um socket esperando),
// timeout curto e DNS com cache e poucas consultas simultâneas — o dns.lookup usa o mesmo pool de
// 4 threads do libuv que o acesso a disco, e centenas de nomes de uma vez travavam o app inteiro.
const DNS_OK_MS = 10 * 60000, DNS_FAIL_MS = 60000, DNS_PARALLEL = 3;
const dnsCache = new Map(); let dnsRunning = 0; const dnsQueue = [];

async function resolve(host) {
  if (net.isIP(host)) return host;
  const cached = dnsCache.get(host);
  if (cached && Date.now() < cached.until) return cached.address;
  if (dnsRunning >= DNS_PARALLEL) await new Promise(wake => dnsQueue.push(wake));
  dnsRunning++;
  try {
    const { address } = await dns.lookup(host);
    dnsCache.set(host, { address, until: Date.now() + DNS_OK_MS }); return address;
  } catch {
    dnsCache.set(host, { address: null, until: Date.now() + DNS_FAIL_MS }); return null;
  } finally { dnsRunning--; dnsQueue.shift()?.(); }
}

function probe(host, port, timeout) {
  return new Promise(done => {
    const socket = net.connect({ host, port }); let settled = false;
    const finish = ok => { if (settled) return; settled = true; clearTimeout(timer); socket.destroy(); done(ok); };
    const timer = setTimeout(() => finish(false), timeout);
    socket.once('connect', () => finish(true)); socket.once('error', () => finish(false));
  });
}

// onResult(índice, online) é chamado assim que cada host responde, para a lista pintar aos poucos.
async function checkMany(targets, { parallel = 64, timeout = 1500, onResult = () => {} } = {}) {
  const results = new Array(targets.length); let next = 0;
  const worker = async () => {
    while (next < targets.length) {
      const i = next++, { host, port } = targets[i];
      const address = await resolve(host);
      results[i] = address ? await probe(address, port, timeout) : false;
      onResult(i, results[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, targets.length) }, worker));
  return results;
}

module.exports = { checkMany, resolve, dnsCache };
