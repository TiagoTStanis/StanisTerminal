// Login SSH como em switches: servidor que só aceita keyboard-interactive com o prompt "Password:".
const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { Server, utils } = require('ssh2');
const { SSH } = require('../src/ssh.cjs');

function labServer({ methods, password = 'segredo' }) {
  const hostKey = utils.generateKeyPairSync('ed25519').private;
  const seen = [];
  const server = new Server({ hostKeys: [hostKey] }, client => {
    client.on('authentication', ctx => {
      seen.push(`${ctx.method}:${ctx.username}`);
      if (ctx.method === 'keyboard-interactive' && methods.includes('keyboard-interactive')) {
        return ctx.prompt([{ prompt: 'Password: ', echo: false }], 'Switch', '', answers => answers[0] === password ? ctx.accept() : ctx.reject(methods));
      }
      if (ctx.method === 'password' && methods.includes('password')) return ctx.password === password ? ctx.accept() : ctx.reject(methods);
      ctx.reject(methods);
    });
    client.on('ready', () => client.end());
    client.on('error', () => {});
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, seen })));
}

function sshWith(answers) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sshauth-'));
  const asked = [];
  // Confia na chave na primeira conexão e responde os diálogos na ordem dada.
  const ask = async question => { asked.push(question); if (!question.fields.length) return {}; return answers.shift() ?? null; };
  const ssh = new SSH({ directory, value: { profiles: [] } }, ask, { isEncryptionAvailable: () => false });
  return { ssh, asked, cleanup: () => fs.rmSync(directory, { recursive: true, force: true }) };
}

test('switch só com keyboard-interactive: usa a senha já digitada, sem segundo diálogo', async () => {
  const { server, port, seen } = await labServer({ methods: ['keyboard-interactive'] });
  const { ssh, asked, cleanup } = sshWith([{ password: 'segredo' }]);
  try {
    const client = await ssh.connect({ id: 'sw', type: 'ssh', host: '127.0.0.1', port, username: 'admin' });
    client.end();
    assert.deepEqual(asked.filter(q => q.fields.length).map(q => q.fields.map(f => f.name)), [['password']], 'só o diálogo inicial de senha');
    assert.ok(seen.includes('keyboard-interactive:admin'));
  } finally { server.close(); cleanup(); }
});

test('senha errada: mensagem clara com os métodos que o servidor aceita', async () => {
  const { server, port } = await labServer({ methods: ['keyboard-interactive'] });
  // Segunda rodada do keyboard-interactive (a senha automática falhou): o usuário cancela.
  const { ssh, cleanup } = sshWith([{ password: 'errada' }, null]);
  try {
    await assert.rejects(ssh.connect({ id: 'sw', type: 'ssh', host: '127.0.0.1', port, username: 'admin' }), /recusados|encerrada/);
  } finally { server.close(); cleanup(); }
});

test('servidor só com password e senha errada: diz que foi recusado e o que o servidor aceita', async () => {
  const { server, port } = await labServer({ methods: ['password'] });
  const { ssh, cleanup } = sshWith([{ password: 'errada' }]);
  try {
    await assert.rejects(ssh.connect({ id: 'sw', type: 'ssh', host: '127.0.0.1', port, username: 'admin' }), /Usuário ou senha recusados .*admin.*password/);
  } finally { server.close(); cleanup(); }
});

test('sessão sem usuário: pede usuário e senha juntos', async () => {
  const { server, port, seen } = await labServer({ methods: ['password'] });
  const { ssh, asked, cleanup } = sshWith([{ username: 'operador', password: 'segredo' }]);
  try {
    const client = await ssh.connect({ id: 'sw', type: 'ssh', host: '127.0.0.1', port, username: '' });
    client.end();
    assert.deepEqual(asked.find(q => q.fields.length).fields.map(f => f.name), ['username', 'password']);
    assert.ok(seen.includes('password:operador'));
  } finally { server.close(); cleanup(); }
});

test('switch legado (só diffie-hellman-group1-sha1 + aes128-cbc + hmac-sha1) conecta e avisa; servidor moderno não', async () => {
  const hostKey = utils.generateKeyPairSync('rsa', { bits: 2048 }).private;
  const start = algorithms => new Promise(resolve => {
    const server = new Server({ hostKeys: [hostKey], algorithms }, client => {
      client.on('authentication', ctx => ctx.method === 'password' && ctx.password === 'segredo' ? ctx.accept() : ctx.reject(['password']));
      client.on('ready', () => client.end()); client.on('error', () => {});
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  const legacy = await start({ kex: ['diffie-hellman-group1-sha1'], cipher: ['aes128-cbc'], hmac: ['hmac-sha1'], serverHostKey: ['ssh-rsa'] });
  const modern = await start(undefined);
  try {
    for (const [server, expectWeak] of [[legacy, true], [modern, false]]) {
      const { ssh, cleanup } = sshWith([{ password: 'segredo' }]);
      try {
        const client = await ssh.connect({ id: 'sw', type: 'ssh', host: '127.0.0.1', port: server.address().port, username: 'admin' });
        client.end();
        if (expectWeak) assert.ok(client.legacyAlgorithms.includes('diffie-hellman-group1-sha1') && client.legacyAlgorithms.includes('aes128-cbc'), JSON.stringify(client.legacyAlgorithms));
        else assert.deepEqual(client.legacyAlgorithms, []);
      } finally { cleanup(); }
    }
  } finally { legacy.close(); modern.close(); }
});
