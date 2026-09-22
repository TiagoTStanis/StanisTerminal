const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Client } = require('ssh2');
const { readJSON, writeJSON } = require('./config.cjs');

// A mesma conexão atende ao terminal e ao SFTP. Nenhuma senha entra em config.json.
class SSH {
  constructor(config, ask, safeStorage) {
    this.config = config; this.ask = ask; this.safeStorage = safeStorage;
    this.knownFile = path.join(config.directory, 'known-hosts.json');
    this.secretsFile = path.join(config.directory, 'credentials.json');
  }
  async connect(profile, chain = []) {
    if (chain.includes(profile.id) || chain.length > 3) throw new Error('Gateway SSH circular ou com mais de três saltos.');
    const secrets = readJSON(this.secretsFile, {});
    const scope = JSON.stringify([profile.host, profile.port, profile.username, profile.keyPath || '', profile.jumpId || '']);
    let password = '';
    if (secrets[profile.id] && this.safeStorage.isEncryptionAvailable()) {
      try {
        const saved = JSON.parse(this.safeStorage.decryptString(Buffer.from(secrets[profile.id], 'base64')));
        if (saved.scope === scope) password = saved.password;
      } catch { /* Perfil antigo ou outra conta Windows: pedir novamente. */ }
    }
    let credentials = { password, remember: false };
    const agent = profile.useAgent ? (process.env.SSH_AUTH_SOCK || '\\\\.\\pipe\\openssh-ssh-agent') : undefined;
    if (!password && !agent) credentials = await this.ask({ title: `Autenticação — ${profile.username}@${profile.host}`, fields: [{ name: 'password', label: profile.keyPath ? 'Frase secreta da chave (vazio se não houver)' : 'Senha SSH', type: 'password' }], remember: true });
    if (!credentials) throw new Error('Conexão cancelada.');
    let parent, sock;
    if (profile.jumpId) {
      const gateway = this.config.value.profiles.find(p => p.id === profile.jumpId && p.type === 'ssh');
      if (!gateway) throw new Error('Gateway SSH não encontrado.');
      parent = await this.connect(gateway, chain.concat(profile.id));
      try { sock = await new Promise((resolve, reject) => parent.forwardOut('127.0.0.1', 0, profile.host, profile.port, (err, stream) => err ? reject(err) : resolve(stream))); }
      catch (error) { parent.end(); throw error; }
    }
    const client = new Client();
    const address = `${profile.host}:${profile.port}`;
    let ready = false;
    return new Promise((resolve, reject) => {
      client.on('error', error => { if (!ready) reject(error); });
      client.on('close', () => { parent?.end(); if (!ready) reject(new Error('Conexão SSH encerrada antes da autenticação.')); });
      client.on('keyboard-interactive', async (name, instructions, lang, prompts, finish) => {
        const answer = await this.ask({ title: name || 'Autenticação SSH', message: instructions, fields: prompts.map((p, i) => ({ name: String(i), label: p.prompt, type: p.echo ? 'text' : 'password' })) });
        if (!answer) { client.end(); return; }
        finish(prompts.map((_, i) => answer[String(i)] || ''));
      });
      client.on('ready', () => {
        try {
          if (credentials.remember && this.safeStorage.isEncryptionAvailable()) {
            secrets[profile.id] = this.safeStorage.encryptString(JSON.stringify({ scope, password: credentials.password || '' })).toString('base64');
            writeJSON(this.secretsFile, secrets);
          }
          ready = true; resolve(client);
        } catch (error) { client.end(); reject(error); }
      });
      try {
        client.connect({ host: profile.host, port: profile.port, username: profile.username,
          agent, agentForward: false,
          password: profile.keyPath || agent ? undefined : credentials.password,
          privateKey: profile.keyPath ? fs.readFileSync(profile.keyPath) : undefined,
          passphrase: profile.keyPath ? credentials.password || undefined : undefined,
          sock, readyTimeout: 30000, keepaliveInterval: 15000, keepaliveCountMax: 3, tryKeyboard: true,
          hostVerifier: (key, verify) => {
            (async () => {
              const fingerprint = 'SHA256:' + crypto.createHash('sha256').update(key).digest('base64').replace(/=+$/, '');
              const known = readJSON(this.knownFile, {});
              if (known[address] === fingerprint) return true;
              if (known[address]) throw new Error(`A chave de ${address} MUDOU. Conexão bloqueada. Confira a chave com o administrador antes de remover a entrada em known-hosts.json.`);
              const answer = await this.ask({ title: 'Primeira conexão SSH', message: `${address}\n${fingerprint}\nCompare esta impressão digital com a fornecida pelo administrador. Confiar e guardar?`, fields: [], accept: 'Confiar nesta chave' });
              if (!answer) return false;
              known[address] = fingerprint; writeJSON(this.knownFile, known); return true;
            })().then(verify).catch(error => { reject(error); verify(false); client.end(); });
          }
        });
      } catch (error) { parent?.end(); client.end(); reject(error); }
    });
  }
}
function sftpCall(sftp, method, ...args) {
  return new Promise((resolve, reject) => sftp[method](...args, (error, value) => error ? reject(error) : resolve(value)));
}
module.exports = { SSH, sftpCall };
