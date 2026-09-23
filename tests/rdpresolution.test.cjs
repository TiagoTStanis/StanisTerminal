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
