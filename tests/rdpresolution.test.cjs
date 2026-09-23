const { test } = require('node:test');
const assert = require('node:assert/strict');
const { profile } = require('../src/config.cjs');

test('perfil RDP guarda só resoluções da lista; outros tipos ignoram o campo', () => {
  assert.equal(profile({ type: 'rdp', name: 'R', host: 'vm', resolution: '1024x768' }).resolution, '1024x768');
  assert.equal(profile({ type: 'rdp', name: 'R', host: 'vm' }).resolution, undefined);
  assert.equal(profile({ type: 'rdp', name: 'R', host: 'vm', resolution: '99999x1' }).resolution, undefined);
  assert.equal(profile({ type: 'rdp', name: 'R', host: 'vm', resolution: '1024x768;calc' }).resolution, undefined);
  assert.equal(profile({ type: 'vnc', name: 'V', host: 'vm', resolution: '1024x768' }).resolution, undefined);
});

test('IPv4 com zero à esquerda vira decimal (senão o Node tenta DNS e dá ENOTFOUND)', () => {
  const { host } = require('../src/config.cjs');
  assert.equal(host('192.168.001.010'), '192.168.1.10');
  assert.equal(host('10.0.0.07'), '10.0.0.7');
  assert.equal(host('10.0.0.7'), '10.0.0.7');
  assert.equal(host('switch-01.empresa.local'), 'switch-01.empresa.local');
  assert.throws(() => host('10.0.0.256'));
  assert.equal(profile({ type: 'ssh', name: 'SW', host: '172.016.000.001' }).host, '172.16.0.1');
});
