const path = require('node:path');
const { readJSON, writeJSON } = require('./config.cjs');

// Senhas guardadas com a criptografia da conta Windows (safeStorage/DPAPI). Nada vai para config.json nem para sincronização.
// Cada senha só vale para o destino em que foi salva: mudou host, porta ou usuário, ela é ignorada.
class Vault {
  constructor(directory, safeStorage) { this.file = path.join(directory, 'credentials.json'); this.safeStorage = safeStorage; }
  available() { return this.safeStorage.isEncryptionAvailable(); }
  scope(profile) {
    if (profile.type === 'rdp') return JSON.stringify([profile.host, profile.port, profile.username]);
    return JSON.stringify([profile.host, profile.port, profile.username, profile.keyPath || '', profile.jumpId || '']);
  }
  get(profile) {
    if (!this.available()) return null;
    const saved = readJSON(this.file, {})[profile.id]; if (!saved) return null;
    try { const value = JSON.parse(this.safeStorage.decryptString(Buffer.from(saved, 'base64'))); return value.scope === this.scope(profile) ? value.password : null; }
    catch { return null; /* outra conta Windows ou dado antigo: pedir de novo */ }
  }
  has(profile) { return this.get(profile) !== null; }
  set(profile, password) {
    if (!this.available()) throw new Error('A criptografia do Windows não está disponível; a senha não foi guardada.');
    const secrets = readJSON(this.file, {});
    secrets[profile.id] = this.safeStorage.encryptString(JSON.stringify({ scope: this.scope(profile), password })).toString('base64');
    writeJSON(this.file, secrets);
  }
  forget(id) { const secrets = readJSON(this.file, {}); if (id in secrets) { delete secrets[id]; writeJSON(this.file, secrets); } }
}
module.exports = { Vault };
