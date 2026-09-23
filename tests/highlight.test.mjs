import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlight } from '../src/ui/highlight.js';

// Lista [cor, texto] de cada trecho que o realce coloriu.
const OPEN = { '\x1b[1;95m': 'prompt', '\x1b[1;94m': 'iface', '\x1b[36m': 'ciano', '\x1b[93m': 'amarelo', '\x1b[91m': 'vermelho', '\x1b[92m': 'verde' };
function colored(output) {
  const found = [];
  for (const m of output.matchAll(/(\x1b\[(?:1;95|1;94|36|93|91|92)m)(.*?)\x1b\[(?:22;)?39m/g)) found.push([OPEN[m[1]], m[2]]);
  return found;
}
const plain = output => output.replace(/\x1b\[[0-9;]*m/g, '');

test('show ip interface brief (Cisco): interfaces, IPs e estados', () => {
  const out = 'Interface              IP-Address      OK? Method Status                Protocol\r\n' +
    'GigabitEthernet1/0/1   10.0.0.1        YES NVRAM  up                    up\r\n' +
    'Gi1/0/2                unassigned      YES unset  administratively down down\r\n' +
    'Vlan10                 192.168.10.1/24 YES NVRAM  up                    up\r\n' +
    'SW-CORE#';
  const found = colored(highlight(out));
  assert.deepEqual(found.filter(([c]) => c === 'iface').map(([, t]) => t), ['GigabitEthernet1/0/1', 'Gi1/0/2', 'Vlan10']);
  assert.deepEqual(found.filter(([c]) => c === 'ciano').map(([, t]) => t), ['10.0.0.1', '192.168.10.1/24']);
  assert.ok(found.some(([c, t]) => c === 'amarelo' && t === 'administratively down'));
  assert.equal(found.filter(([c, t]) => c === 'verde' && t === 'up').length, 4);
  assert.ok(found.some(([c, t]) => c === 'vermelho' && t === 'down'));
  assert.deepEqual(found.filter(([c]) => c === 'prompt').map(([, t]) => t), ['SW-CORE#']);
  assert.equal(plain(highlight(out)), out, 'o texto em si não pode mudar');
});

test('show interfaces status, MACs nos três formatos e prompts de outros fabricantes', () => {
  const found = colored(highlight('Te1/1/1  uplink  connected  trunk  full  10G\r\nGi1/0/5  notconnect  1  auto\r\nFa0/3  err-disabled\r\n'));
  assert.deepEqual(found.map(([c, t]) => `${c}:${t}`), ['iface:Te1/1/1', 'verde:connected', 'verde:full', 'iface:Gi1/0/5', 'vermelho:notconnect', 'iface:Fa0/3', 'vermelho:err-disabled']);
  const macs = colored(highlight('0011.2233.4455 aa:bb:cc:dd:ee:ff 0011-2233-4455 AA-BB-CC-DD-EE-FF')).map(([, t]) => t);
  assert.deepEqual(macs, ['0011.2233.4455', 'aa:bb:cc:dd:ee:ff', '0011-2233-4455', 'AA-BB-CC-DD-EE-FF']);
  for (const prompt of ['R1(config-if)#', 'switch>', '<HUAWEI>', '[~HUAWEI]']) assert.deepEqual(colored(highlight('\r\n' + prompt)), [['prompt', prompt]]);
  assert.deepEqual(colored(highlight('ge-0/0/0.0  up  ae1')).map(([c, t]) => `${c}:${t}`), ['iface:ge-0/0/0.0', 'verde:up', 'iface:ae1']);
});

test('não colore o que não deve', () => {
  // Horário não é IPv6; palavras que só contêm "up"/"down" não contam; "Se 3" em português não é interface.
  assert.deepEqual(colored(highlight('Uptime 10:22:33, setup, download, Se 3 dias, versão 15.2.4')), []);
  assert.deepEqual(colored(highlight('fe80::1 2001:db8::/32')).map(([, t]) => t), ['fe80::1', '2001:db8::/32']);
  assert.deepEqual(colored(highlight('%SYS-5: running-config changed, down-link ok')), []);
});

test('prompt colado no comando também é colorido', () => {
  assert.deepEqual(colored(highlight('\r\nSW-CORE#show ip interface brief')), [['prompt', 'SW-CORE#']]);
  assert.deepEqual(colored(highlight('\r\nR1(config)#interface Gi0/1')).map(([c, t]) => `${c}:${t}`), ['prompt:R1(config)#', 'iface:Gi0/1']);
});

test('cores e escapes que o servidor já mandou ficam intactos', () => {
  const fromServer = '\x1b[01;34mdown\x1b[0m \x1b]0;titulo up\x07 \x1b[2K\x1b[1Gup';
  const out = highlight(fromServer);
  // As sequências originais continuam iguais e na mesma ordem.
  assert.deepEqual(out.match(/\x1b\[01;34m|\x1b\[0m|\x1b\]0;titulo up\x07|\x1b\[2K|\x1b\[1G/g), ['\x1b[01;34m', '\x1b[0m', '\x1b]0;titulo up\x07', '\x1b[2K', '\x1b[1G']);
  // "up" dentro do título (OSC) não é tocado; o texto fora das sequências é realçado.
  assert.deepEqual(colored(out).map(([c, t]) => `${c}:${t}`), ['vermelho:down', 'verde:up']);
});
