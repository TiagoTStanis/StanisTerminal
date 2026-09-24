// Transferência de arquivos do TightVNC contra o servidor de laboratório de tests/tightvnc-lab.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { TightFT } = require('../src/tightft.cjs');
const { labServer } = require('./tightvnc-lab.cjs');

test('lista, envia (vários pedaços), baixa e traduz os erros do servidor', async () => {
  const { server, port, files } = await labServer();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tightft-'));
  try {
    const ft = await TightFT.connect({ host: '127.0.0.1', port, password: 'lab123' });
    assert.deepEqual((await ft.list('/C:/pasta')).map(r => r.name), ['antigo.txt']);
    const local = path.join(dir, 'grande.bin'), bytes = crypto.randomBytes(200 * 1024 + 5); fs.writeFileSync(local, bytes);
    await ft.upload(local, '/C:/pasta/grande.bin', true);
    assert.equal(Buffer.compare(files.get('/C:/pasta/grande.bin'), bytes), 0, 'upload em pedaços chega inteiro');
    const back = path.join(dir, 'volta.bin'); await ft.download('/C:/pasta/grande.bin', back);
    assert.equal(Buffer.compare(fs.readFileSync(back), bytes), 0, 'download volta idêntico');
    await assert.rejects(ft.download('/C:/pasta/nao-existe.txt', path.join(dir, 'x')), /arquivo não encontrado/);
    await assert.rejects(ft.list('/C:/outra'), /pasta não encontrada/);
    await assert.rejects(ft.list('/C:/bloqueado'), /usuário logado e a tela desbloqueada/);
    ft.close();
  } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('senha errada e servidor sem transferência de arquivos dão mensagens claras', async () => {
  const a = await labServer();
  await assert.rejects(TightFT.connect({ host: '127.0.0.1', port: a.port, password: 'errada' }), /Senha do VNC recusada/);
  a.server.close();
  const b = await labServer({ fileTransfer: false });
  await assert.rejects(TightFT.connect({ host: '127.0.0.1', port: b.port, password: 'lab123' }), /desativada/);
  b.server.close();
});

test('fila de transferências: pasta inteira ida e volta pelo TightVNC, com progresso em bytes', async () => {
  const { Transfers } = require('../src/transfers.cjs');
  const { server, port, files } = await labServer();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tightft-fila-'));
  const ft = await TightFT.connect({ host: '127.0.0.1', port, password: 'lab123' });
  try {
    const states = []; const queue = new Transfers({ tightClient: () => ft }, (_, list) => states.push(list));
    const wait = id => new Promise(resolve => { const check = () => { const job = queue.jobs.get(id); if (['na fila', 'enviando', 'baixando'].includes(job.status)) setTimeout(check, 20); else resolve(job); }; check(); });
    const origem = path.join(dir, 'origem'), big = crypto.randomBytes(300 * 1024);
    fs.mkdirSync(path.join(origem, 'sub'), { recursive: true }); fs.writeFileSync(path.join(origem, 'a.txt'), 'A'); fs.writeFileSync(path.join(origem, 'sub', 'b.bin'), big);
    let job = await wait(queue.add({ kind: 'tightvnc', id: 'x', direction: 'upload', local: origem, remote: '/C:/pasta/origem' }));
    assert.equal(job.status, 'concluída', job.error); assert.equal(job.total, 2);
    assert.equal(files.get('/C:/pasta/origem/a.txt').toString(), 'A');
    assert.equal(Buffer.compare(files.get('/C:/pasta/origem/sub/b.bin'), big), 0, 'subpasta enviada inteira');
    const volta = path.join(dir, 'volta');
    job = await wait(queue.add({ kind: 'tightvnc', id: 'x', direction: 'download', local: volta, remote: '/C:/pasta/origem' }));
    assert.equal(job.status, 'concluída', job.error);
    assert.equal(fs.readFileSync(path.join(volta, 'a.txt'), 'utf8'), 'A');
    assert.equal(Buffer.compare(fs.readFileSync(path.join(volta, 'sub', 'b.bin')), big), 0, 'pasta baixada inteira');
    job = await wait(queue.add({ kind: 'tightvnc', id: 'x', direction: 'download', local: path.join(dir, 'um.txt'), remote: '/C:/pasta/antigo.txt' }));
    assert.equal(fs.readFileSync(path.join(dir, 'um.txt'), 'utf8'), 'conteúdo antigo', 'arquivo avulso pela fila');
    assert.ok(states.some(list => list.some(j => j.size > 0 && j.bytes > 0)), 'a interface recebe progresso em bytes');
  } finally { ft.close(); server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
