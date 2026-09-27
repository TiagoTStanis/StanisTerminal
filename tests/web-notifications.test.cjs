'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { originOf, isGranted, remember } = require('../src/web-notifications.cjs');

test('notificações web ficam desativadas por padrão e exigem permissão explícita da origem', () => {
  const settings = {};
  assert.equal(isGranted(settings, 'https://mail.example'), false);
  settings.webNotifications = true;
  assert.equal(isGranted(settings, 'https://mail.example'), false);
  assert.equal(remember(settings, 'https://mail.example/inbox', true), true);
  assert.equal(isGranted(settings, 'https://mail.example'), true);
  assert.equal(isGranted(settings, 'https://chat.example'), false);
  settings.webNotifications = false;
  assert.equal(isGranted(settings, 'https://mail.example'), false);
});

test('as regras são isoladas por origem e rejeitam esquemas ou credenciais inválidas', () => {
  assert.equal(originOf('https://user:pass@mail.example/inbox'), null);
  assert.equal(originOf('file:///tmp/page.html'), null);
  assert.equal(originOf('http://mail.example'), null);
  assert.equal(originOf('http://localhost:8080'), 'http://localhost:8080');
  assert.equal(originOf('https://mail.example:8443/inbox'), 'https://mail.example:8443');
  const settings = { webNotifications: true };
  assert.equal(remember(settings, 'file:///tmp/page.html', true), false);
  assert.equal(remember(settings, 'https://mail.example', false), true);
  assert.equal(isGranted(settings, 'https://mail.example'), false);
});

test('a lista de permissões permanece limitada a 100 origens', () => {
  const settings = { webNotificationPermissions: Object.fromEntries(Array.from({ length: 100 }, (_, n) => [`https://site${n}.example`, true])) };
  assert.equal(remember(settings, 'https://new.example', true), true);
  assert.equal(Object.keys(settings.webNotificationPermissions).length, 100);
  assert.equal(settings.webNotificationPermissions['https://site0.example'], undefined);
  assert.equal(settings.webNotificationPermissions['https://new.example'], true);
});
