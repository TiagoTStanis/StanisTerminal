const test = require('node:test');
const assert = require('node:assert');
const net = require('node:net');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const { Tools } = require('../src/tools.cjs');
const { startVnc, encryptPassword } = require('../src/vncserver.cjs');

const ROOT_KEY = 'HKCU\\Software\\TightVNC';
const rev = b => { let r = 0; for (let i = 0; i < 8; i++) if (b & (1 << i)) r |= 128 >> i; return r; };
const des = (key, data) => { const c = crypto.createCipheriv('des-ecb', key, null); c.setAutoPadding(false); return Buffer.concat([c.update(data), c.final()]); };
const pad = p => { const b = Buffer.alloc(8); Buffer.from(p, 'latin1').copy(b, 0, 0, 8); return b; };

// Cliente RFB mínimo: devolve o resultado da autenticação e as dimensões da área de trabalho anunciadas pelo servidor.
function rfb(port, password) {
  return new Promise(resolve => {
    const s = net.createConnection({ host: '127.0.0.1', port }); let stage = 0, buf = Buffer.alloc(0), types = [];
    const done = value => { s.destroy(); resolve(value); };
    s.on('data', d => {
      buf = Buffer.concat([buf, d]);
      if (stage === 0 && buf.length >= 12) { s.write('RFB 003.008\n'); buf = buf.subarray(12); stage = 1; }
      if (stage === 1 && buf.length >= 1) {
        const n = buf[0]; if (buf.length < 1 + n) return; types = [...buf.subarray(1, 1 + n)]; buf = buf.subarray(1 + n);
        if (password === null) { if (!types.includes(1)) return done({ types, result: 'sem opção sem senha' }); s.write(Buffer.from([1])); stage = 3; }
        else { if (!types.includes(2)) return done({ types, result: 'sem VNC auth' }); s.write(Buffer.from([2])); stage = 2; }
      }
      if (stage === 2 && buf.length >= 16) { const key = Buffer.from([...pad(password)].map(rev)); s.write(Buffer.concat([des(key, buf.subarray(0, 8)), des(key, buf.subarray(8, 16))])); buf = buf.subarray(16); stage = 3; }
      if (stage === 3 && buf.length >= 4) { const ok = buf.readUInt32BE(0) === 0; buf = buf.subarray(4); if (!ok) return done({ types, result: 'recusada' }); s.write(Buffer.from([1])); stage = 4; }
      if (stage === 4 && buf.length >= 4) done({ types, result: 'autenticado', width: buf.readUInt16BE(0), height: buf.readUInt16BE(2) });
    });
    s.on('error', e => done({ types, result: 'erro: ' + e.message })); setTimeout(() => done({ types, result: 'tempo' }), 8000);
  });
}
const registryHas = () => { try { cp.execFileSync('reg.exe', ['query', ROOT_KEY], { stdio: 'ignore' }); return true; } catch { return false; } };
const running = () => cp.execFileSync('tasklist.exe', ['/FI', 'IMAGENAME eq tvnserver.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8' }).toLowerCase().includes('tvnserver.exe');
const wait = ms => new Promise(r => setTimeout(r, ms));

test('formato da senha VNC tem 8 bytes e depende da senha', () => {
  assert.strictEqual(encryptPassword('segredo1').length, 8); assert.deepStrictEqual(encryptPassword('segredo1'), encryptPassword('segredo1'));
  assert.notDeepStrictEqual(encryptPassword('segredo1'), encryptPassword('segredo2'));
});

test('servidor VNC real: só loopback, senha opcional, limpeza completa', { skip: process.env.STANIS_TEST_NETWORK !== '1' || process.platform !== 'win32' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stanis-vnc-')); const asked = [];
  const tools = new Tools(dir, async q => { asked.push(q.title); return {}; });
  const exe = await tools.install('tightvnc'); assert.ok(fs.existsSync(exe)); assert.ok(asked[0].includes('TightVNC'));
  assert.ok(!registryHas() && !running(), 'ambiente limpo antes do teste');
  try {
    // Sem senha: aceita quem chega por 127.0.0.1 e anuncia uma área de trabalho real.
    let server = await startVnc({ exe, port: 5931 }); const open = await rfb(5931, null);
    assert.strictEqual(open.result, 'autenticado'); assert.ok(open.width > 100 && open.height > 100, 'ServerInit com dimensões reais');
    const lan = Object.values(os.networkInterfaces()).flat().find(i => i.family === 'IPv4' && !i.internal);
    if (lan) await assert.rejects(new Promise((resolve, reject) => { const s = net.createConnection({ host: lan.address, port: 5931 }); s.setTimeout(3000); s.on('connect', () => { s.destroy(); resolve(); }); s.on('error', reject); s.on('timeout', () => { s.destroy(); reject(new Error('sem resposta')); }); }), undefined, 'não pode aceitar conexões pelo IP da rede');
    server.close(); await wait(800); assert.ok(!registryHas(), 'registro removido'); assert.ok(!running(), 'processo encerrado');
    // Com senha: certa autentica, errada é recusada.
    server = await startVnc({ exe, port: 5932, password: 'segredo1' });
    assert.strictEqual((await rfb(5932, 'segredo1')).result, 'autenticado'); assert.strictEqual((await rfb(5932, 'errada12')).result, 'recusada');
    server.close(); await wait(800); assert.ok(!registryHas() && !running());
    // Não mexe numa configuração alheia do TightVNC.
    cp.execFileSync('reg.exe', ['add', ROOT_KEY + '\\Server', '/v', 'RfbPort', '/t', 'REG_DWORD', '/d', '5900', '/f'], { stdio: 'ignore' });
    await assert.rejects(startVnc({ exe, port: 5933 }), /configuração própria/); assert.ok(registryHas(), 'configuração alheia preservada');
    cp.execFileSync('reg.exe', ['delete', ROOT_KEY, '/f'], { stdio: 'ignore' });
    await assert.rejects(startVnc({ exe, port: 80 }), /porta entre/); await assert.rejects(startVnc({ exe, password: 'nove-chars' }), /até 8/);
  } finally {
    try { cp.execFileSync('taskkill.exe', ['/F', '/IM', 'tvnserver.exe'], { stdio: 'ignore' }); } catch { /* nada rodando */ }
    try { cp.execFileSync('reg.exe', ['delete', ROOT_KEY, '/f'], { stdio: 'ignore' }); } catch { /* nada a remover */ }
    await wait(1000); // deixa o Windows liberar os arquivos do executável encerrado
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 }); } catch { /* pasta temporária; não mascarar o resultado do teste */ }
  }
});
