const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { randomUUID } = require('node:crypto');
const execute = promisify(execFile);

// Canal de arquivos paralelo para sessões VNC/RDP: o protocolo gráfico não transfere arquivos,
// então abrimos um compartilhamento administrativo (Windows) ou uma conexão SSH oculta (Linux)
// para o mesmo host, e reaproveitamos o painel de Arquivos existente (modos "local"/"sftp").
class RemoteFiles {
  constructor(terminals, ssh, vault, ask, config) {
    this.terminals = terminals; this.ssh = ssh; this.vault = vault; this.ask = ask; this.config = config;
    this.channels = new Map(); // profile.id -> { kind, id, path, os, unc }
  }
  async open(profile) {
    const existing = this.channels.get(profile.id);
    if (existing) return existing;
    let remoteOS = profile.type === 'rdp' ? 'windows' : profile.remoteOS;
    if (!remoteOS) {
      const answer = await this.ask({ title: 'Sistema do host', message: 'Para transferir arquivos por VNC preciso saber o sistema operacional deste host.', fields: [{ name: 'remoteOS', label: 'Sistema operacional', options: [{ value: 'windows', label: 'Windows' }, { value: 'linux', label: 'Linux' }] }] });
      if (!answer) throw new Error('Identificação do sistema cancelada.');
      remoteOS = answer.remoteOS;
      // Só grava no perfil salvo; sessões avulsas (não salvas) usam remoteOS apenas nesta conexão.
      if (this.config.value.profiles.some(p => p.id === profile.id)) { try { this.config.putProfile({ ...profile, remoteOS }); } catch { /* ignora falha ao persistir */ } }
    }
    const info = remoteOS === 'windows' ? await this.openWindows(profile) : await this.openLinux(profile);
    this.channels.set(profile.id, info); return info;
  }
  async openWindows(profile) {
    const unc = `\\\\${profile.host}\\c$`;
    const run = password => {
      const args = ['use', unc, password || '']; if (profile.username) args.push('/user:' + profile.username); args.push('/persistent:no');
      return execute('net', args, { windowsHide: true, timeout: 15000 });
    };
    let password = this.vault?.get(profile);
    try {
      if (password === null || password === undefined) throw new Error('sem senha salva');
      await run(password);
    } catch {
      const canRemember = !!this.vault?.available();
      const credentials = await this.ask({ title: `Rede — ${profile.username ? profile.username + ' @ ' : ''}${profile.host}`, fields: [{ name: 'password', label: 'Senha (compartilhamento administrativo C$)', type: 'password' }], remember: canRemember });
      if (!credentials) throw new Error('Conexão de rede cancelada.');
      try { await run(credentials.password); }
      catch (error) { throw new Error(this.explainNetUse(error)); }
      password = credentials.password;
      if (canRemember && credentials.remember) this.vault.set(profile, password);
    }
    return { kind: 'local', id: '', path: unc, os: 'windows', unc };
  }
  explainNetUse(error) {
    const text = String(error?.stderr || error?.message || '');
    if (/multiple connections|várias conexões|1219/i.test(text)) return 'Já existe uma conexão de rede com este host usando outro usuário. Desligue-a (net use \\\\host\\c$ /delete) e tente de novo.';
    if (/1326|senha incorreta|logon failure/i.test(text)) return 'Usuário ou senha incorretos para o compartilhamento administrativo (\\\\host\\c$).';
    if (/53|rede não pode|network path/i.test(text)) return 'Caminho de rede não encontrado. Confirme que o host está ligado e que o compartilhamento C$ está habilitado.';
    return 'Não foi possível conectar ao compartilhamento de rede: ' + (text.split('\n')[0] || 'erro desconhecido');
  }
  async openLinux(profile) {
    const sshProfile = { id: profile.id, name: profile.name, type: 'ssh', host: profile.host, port: 22, username: profile.username, keyPath: '', useAgent: false, agentForward: false, jumpId: '', group: profile.group };
    const client = await this.ssh.connect(sshProfile);
    const id = randomUUID();
    const item = { id, profile: sshProfile, ended: false, log: null, pending: [], activated: true, client, kill: () => client.end() };
    this.terminals.items.set(id, item);
    client.once('close', () => { item.ended = true; this.terminals.items.delete(id); this.channels.delete(profile.id); });
    return { kind: 'sftp', id, path: '.', os: 'linux' };
  }
  close(profileId) {
    const info = this.channels.get(profileId); if (!info) return;
    if (info.os === 'windows') execute('net', ['use', info.unc, '/delete', '/y'], { windowsHide: true }).catch(() => {});
    else if (info.id) { try { this.terminals.close(info.id); } catch { /* já encerrada */ } }
    this.channels.delete(profileId);
  }
  closeAll() { for (const id of this.channels.keys()) this.close(id); }
}
module.exports = { RemoteFiles };
