const test = require('node:test'); const assert = require('node:assert');
const P = require('../src/web-site-permissions.cjs');
test('permissão por site: padrão pergunta, salva por origem e redefine', () => {
  const s = {};
  assert.equal(P.stateOf(s, 'https://a.com', 'camera'), 'ask');
  assert.ok(P.setState(s, 'https://a.com/pagina', 'camera', 'allow'));
  assert.equal(P.stateOf(s, 'https://a.com', 'camera'), 'allow');
  assert.equal(P.stateOf(s, 'https://b.com', 'camera'), 'ask');
  assert.equal(P.setState(s, 'https://a.com', 'inexistente', 'allow'), false);
  assert.equal(P.setState(s, 'file:///x', 'camera', 'allow'), false);
  P.setState(s, 'https://a.com', 'popups', 'allow'); P.setState(s, 'https://a.com', 'notifications', 'block');
  assert.equal(P.stateOf(s, 'https://a.com', 'notifications'), 'block');
  P.resetSite(s, 'https://a.com');
  assert.equal(P.stateOf(s, 'https://a.com', 'camera'), 'ask'); assert.equal(P.stateOf(s, 'https://a.com', 'notifications'), 'ask');
});
test('media vira câmera e/ou microfone', () => {
  assert.deepEqual(P.keysFor('media', { mediaTypes: ['audio'] }), ['microphone']);
  assert.deepEqual(P.keysFor('media', { mediaTypes: ['video', 'audio'] }), ['camera', 'microphone']);
  assert.equal(P.keysFor('openExternal', {}), null);
});
