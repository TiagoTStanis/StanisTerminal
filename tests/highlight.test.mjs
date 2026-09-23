import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlight } from '../src/ui/highlight.js';

// Lista [cor hex, texto] de cada trecho colorido (cor de texto 38;2;r;g;b).
function colored(output) {
  const hex = rgb => rgb.split(';').map(n => Number(n).toString(16).padStart(2, '0')).join('');
  return [...output.matchAll(/\x1b\[38;2;([\d;]+)m(.*?)\x1b\[39m/g)].map(m => [hex(m[1]), m[2]]);
}
const plain = output => output.replace(/\x1b\[[0-9;]*m/g, '');
const IPV4 = '00e0d1', CISCO_IFACE = '03d28d', CISCO_GOOD = '28c501', CISCO_BAD = 'c71800';

test('show ip interface brief (Cisco) com as regras do ChromaTerm', () => {
  const out = 'Interface              IP-Address      OK? Method Status                Protocol\r\n' +
    'GigabitEthernet1/0/1   10.0.0.1        YES NVRAM  up                    up\r\n' +
    'Vlan10                 192.168.10.1    YES NVRAM  down                  down\r\n';
  const found = colored(highlight(out));
  assert.equal(plain(highlight(out)), out, 'o texto em si não pode mudar');
  assert.ok(found.some(([c, t]) => c === CISCO_IFACE && t === 'GigabitEthernet1/0/1'));
  assert.ok(found.some(([c, t]) => c === CISCO_IFACE && t === 'Vlan10'));
  assert.deepEqual(found.filter(([c]) => c === IPV4).map(([, t]) => t), ['10.0.0.1', '192.168.10.1'], 'IP inteiro numa cor só');
  assert.equal(found.filter(([c, t]) => c === CISCO_GOOD && t === 'up').length, 2);
  assert.equal(found.filter(([c, t]) => c === CISCO_BAD && t === 'down').length, 2);
});

test('modo geral: IPs, MACs e bom/ruim, sem as regras de Cisco', () => {
  const found = colored(highlight('link up on 10.1.2.3 mac 0011.2233.4455 GigabitEthernet1/0/1 failed', 'general'));
  const texts = found.map(([, t]) => t);
  assert.ok(texts.includes('10.1.2.3') && texts.includes('0011.2233.4455') && texts.includes('up') && texts.includes('failed'));
  assert.ok(!texts.includes('GigabitEthernet1/0/1'), 'interface Cisco só no modo rede');
});

test('cores e escapes que o servidor já mandou ficam intactos', () => {
  const fromServer = '\x1b[01;34mdown\x1b[0m \x1b]0;titulo up\x07 \x1b[2K\x1b[1Gup';
  const out = highlight(fromServer);
  assert.deepEqual(out.match(/\x1b\[01;34m|\x1b\[0m|\x1b\]0;titulo up\x07|\x1b\[2K|\x1b\[1G/g), ['\x1b[01;34m', '\x1b[0m', '\x1b]0;titulo up\x07', '\x1b[2K', '\x1b[1G']);
  assert.deepEqual(colored(out).map(([, t]) => t), ['down', 'up'], '"up" dentro do título (OSC) não é tocado');
});
