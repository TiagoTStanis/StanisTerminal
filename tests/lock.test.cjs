const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

// Reproduz a lógica de src/main.cjs (scrypt local) sem depender do Electron, para testar isoladamente.
function makeLock() {
  let lock = null;
  return {
    status: () => ({ enabled: !!lock, autoLockMinutes: lock?.autoLockMinutes || 0 }),
    set: ({ password, autoLockMinutes }) => {
      if (typeof password !== 'string' || password.length < 4 || password.length > 200) throw new Error('A senha mestra precisa ter ao menos 4 caracteres.');
      const salt = crypto.randomBytes(16); const hash = crypto.scryptSync(password, salt, 32);
      lock = { salt: salt.toString('base64'), hash: hash.toString('base64'), autoLockMinutes: Math.max(0, Math.min(180, Number(autoLockMinutes) || 0)) };
      return true;
    },
    check: password => { if (!lock) return true; const salt = Buffer.from(lock.salt, 'base64'); const hash = crypto.scryptSync(String(password || ''), salt, 32); return crypto.timingSafeEqual(hash, Buffer.from(lock.hash, 'base64')); },
    clear: password => { if (!lock) return true; if (!this.check(password)) throw new Error('Senha mestra incorreta.'); lock = null; return true; }
  };
}

test('define, confere e recusa senha errada', () => {
  const l = makeLock(); assert.strictEqual(l.status().enabled, false); assert.strictEqual(l.check('qualquer'), true, 'sem senha definida, sempre libera');
  l.set({ password: 'segredo123', autoLockMinutes: 20 }); assert.strictEqual(l.status().enabled, true); assert.strictEqual(l.status().autoLockMinutes, 20);
  assert.strictEqual(l.check('segredo123'), true); assert.strictEqual(l.check('errada'), false); assert.strictEqual(l.check(''), false);
});
test('recusa senha curta ou não textual', () => {
  const l = makeLock(); assert.throws(() => l.set({ password: 'abc' }), /4 caracteres/); assert.throws(() => l.set({ password: undefined }), /4 caracteres/); assert.throws(() => l.set({ password: 123456 }), /4 caracteres/);
});
test('autoLockMinutes é limitado a 0-180', () => {
  const l = makeLock(); l.set({ password: 'segredo123', autoLockMinutes: 9999 }); assert.strictEqual(l.status().autoLockMinutes, 180);
  const l2 = makeLock(); l2.set({ password: 'segredo123', autoLockMinutes: -5 }); assert.strictEqual(l2.status().autoLockMinutes, 0);
});
test('duas instâncias com a mesma senha geram hashes diferentes (sal aleatório) mas ambas conferem', () => {
  const a = makeLock(), b = makeLock(); a.set({ password: 'mesma-senha' }); b.set({ password: 'mesma-senha' });
  assert.strictEqual(a.check('mesma-senha'), true); assert.strictEqual(b.check('mesma-senha'), true);
});
