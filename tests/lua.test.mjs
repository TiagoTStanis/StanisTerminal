import test from 'node:test';
import assert from 'node:assert';
import { runLua } from '../src/ui/lua.js';

function fakeTerminal(reply = {}) {
  const sent = [], logs = [];
  return { sent, logs, api: { send: async text => { sent.push(text); }, expect: async text => text in reply ? reply[text] : true, log: text => logs.push(text) } };
}

test('script envia comandos, espera saída e registra mensagens', async () => {
  const t = fakeTerminal({ 'login:': true, 'nunca': false });
  await runLua(`
    sendln('ls -la')
    wait(5)
    if expect('login:', 100) then send('admin') end
    if not expect('nunca', 100) then log('não apareceu') end
    for i = 1, 3 do sendln('n=' .. i) end
  `, t.api);
  assert.deepStrictEqual(t.sent, ['ls -la\r', 'admin', 'n=1\r', 'n=2\r', 'n=3\r']);
  assert.deepStrictEqual(t.logs, ['não apareceu']);
});

test('sandbox: sem os, io, require, load, debug, package', async () => {
  for (const code of ["os.execute('calc')", "io.open('C:/x','w')", "require('os')", "load('return 1')()", "debug.getinfo(1)", "package.loadlib('a','b')", "dofile('x')", "print('x')"]) {
    await assert.rejects(runLua(code, fakeTerminal().api), undefined, code);
  }
});

test('loop infinito e explosão de memória são interrompidos', async () => {
  await assert.rejects(runLua('while true do end', fakeTerminal().api), /limite de instruções/);
  await assert.rejects(runLua("local s = string.rep('x', 100000000)", fakeTerminal().api), /excede o limite/);
});

test('erro de sintaxe e de tempo de execução chegam como mensagem', async () => {
  await assert.rejects(runLua('send(', fakeTerminal().api), /script/);
  await assert.rejects(runLua("error('falhou de propósito')", fakeTerminal().api), /falhou de propósito/);
  await assert.rejects(runLua('send({})', fakeTerminal().api), /texto esperado/);
});

test('cancelamento interrompe a espera', async () => {
  const controller = new AbortController(); const t = fakeTerminal();
  const run = runLua('wait(60000)', t.api, controller.signal);
  setTimeout(() => controller.abort(), 50);
  await assert.rejects(run, /cancelado/);
});
