const fs = require('node:fs/promises');
const { TightFT } = require('./tightft.cjs');
const path = require('node:path');
const { Client } = require('basic-ftp');
const { randomUUID } = require('node:crypto');
const { sftpCall } = require('./ssh.cjs');
const { host, port } = require('./config.cjs');

class Files {
  constructor(sessions, ask) { this.sessions = sessions; this.ask = ask; this.ftp = new Map(); this.tight = new Map(); }
  // Arquivos pela extensão do TightVNC (conexão própria, compartilhada, sem imagem de tela).
  async tightConnect(options) {
    const ft = await TightFT.connect({ host: host(options.host), port: port(options.port, 5900), password: typeof options.password === 'string' ? options.password : '' });
    const id = randomUUID(); this.tight.set(id, ft); return { id, path: '/' };
  }
  tightClient(id) { const ft = this.tight.get(id); if (!ft) throw new Error('Conexão de arquivos do TightVNC encerrada. Abra de novo pelo botão Arquivos.'); return ft; }
  async remote(id) {
    const item = this.sessions.get(id);
    if (!item.client || item.ended) throw new Error('Abra uma sessão SSH ativa para acessar SFTP.');
    if (!item.sftp) item.sftp = await sftpCall(item.client, 'sftp');
    return item.sftp;
  }
  async ftpConnect(options) {
    const client = new Client(30000);
    const answer = await this.ask({ title: options.secure ? 'FTPS (TLS)' : 'FTP — conexão sem criptografia', fields: [{ name: 'password', label: 'Senha', type: 'password' }] });
    if (!answer) throw new Error('Conexão cancelada.');
    try { await client.access({ host: host(options.host), port: port(options.port, 21), user: options.username || 'anonymous', password: answer.password, secure: !!options.secure }); }
    catch (error) { client.close(); throw error; }
    const id = randomUUID(); this.ftp.set(id, client); return id;
  }
  async list(kind, id, directory) {
    if (kind === 'tightvnc') {
      // Caminhos no formato do TightVNC: "/" lista os discos, "/C:/pasta" é uma pasta.
      const folder = !directory || directory === '/' ? '/' : '/' + directory.replace(/^\/+|\/+$/g, '');
      const rows = await this.tightClient(id).list(folder);
      return { path: folder, parent: folder === '/' ? '/' : path.posix.dirname(folder), rows: rows.map(x => ({ name: x.name, path: path.posix.join(folder, x.name), directory: x.directory, size: x.size })) };
    }
    if (kind === 'local') {
      const absolute = path.resolve(directory);
      const entries = await fs.readdir(absolute, { withFileTypes: true });
      const rows = await Promise.all(entries.map(async entry => {
        const filename = path.join(absolute, entry.name);
        let info; try { info = await fs.stat(filename); } catch { info = { size: 0 }; }
        return { name: entry.name, path: filename, directory: entry.isDirectory(), size: info.size, link: entry.isSymbolicLink() };
      }));
      return { path: absolute, parent: path.dirname(absolute), rows };
    }
    if (kind === 'sftp') {
      const sftp = await this.remote(id);
      const real = await sftpCall(sftp, 'realpath', directory || '.');
      const rows = await sftpCall(sftp, 'readdir', real);
      return { path: real, parent: path.posix.dirname(real), rows: rows.map(x => ({ name: x.filename, path: path.posix.join(real, x.filename), directory: x.attrs.isDirectory(), size: x.attrs.size, link: x.attrs.isSymbolicLink() })) };
    }
    const ftp = this.ftp.get(id); if (!ftp) throw new Error('Conexão FTP não encontrada.');
    await ftp.cd(directory || '/'); const real = await ftp.pwd();
    return { path: real, parent: path.posix.dirname(real), rows: (await ftp.list()).map(x => ({ name: x.name, path: path.posix.join(real, x.name), directory: x.isDirectory, size: x.size })) };
  }
  async read(kind, id, filename) {
    if (kind === 'tightvnc') throw new Error('Para editar um arquivo pelo TightVNC, baixe-o primeiro (↓).');
    if (kind === 'ftp') throw new Error('Para editar um arquivo FTP, baixe-o primeiro.');
    const stat = kind === 'local' ? await fs.stat(filename) : await sftpCall(await this.remote(id), 'stat', filename);
    if (stat.size > 2 * 1024 * 1024) throw new Error('Editor limitado a arquivos de texto de 2 MiB.');
    const bytes = kind === 'local' ? await fs.readFile(filename) : await sftpCall(await this.remote(id), 'readFile', filename);
    if (bytes.includes(0)) throw new Error('Arquivo binário: use baixar em vez de editar.');
    return bytes.toString('utf8');
  }
  async write(kind, id, filename, content) {
    if (typeof content !== 'string' || Buffer.byteLength(content) > 2 * 1024 * 1024) throw new Error('Texto excede o limite do editor.');
    if (kind === 'local') await fs.writeFile(filename, content, 'utf8');
    else if (kind === 'sftp') await sftpCall(await this.remote(id), 'writeFile', filename, content);
    else throw new Error('Editor não disponível para FTP.');
  }
  async transfer(kind, id, direction, local, remote) {
    if (kind === 'tightvnc') return direction === 'upload' ? this.tightClient(id).upload(local, remote, true) : this.tightClient(id).download(remote, local);
    if (kind === 'local') return direction === 'upload' ? fs.copyFile(local, remote) : fs.copyFile(remote, local);
    if (kind === 'sftp') return sftpCall(await this.remote(id), direction === 'upload' ? 'fastPut' : 'fastGet', direction === 'upload' ? local : remote, direction === 'upload' ? remote : local);
    const ftp = this.ftp.get(id); if (!ftp) throw new Error('FTP desconectado.');
    if (direction === 'upload') await ftp.uploadFrom(local, remote); else await ftp.downloadTo(local, remote);
  }
  async change(kind, id, action, filename, destination) {
    if (kind === 'tightvnc') {
      const ft = this.tightClient(id);
      if (action === 'mkdir') return ft.mkdir(filename);
      if (action === 'rename') return ft.rename(filename, destination);
      if (action === 'delete') return ft.remove(filename);
      throw new Error('Operação de arquivos inválida.');
    }
    if (kind === 'local') {
      if (action === 'mkdir') return fs.mkdir(filename);
      if (action === 'rename') {
        try { await fs.lstat(destination); throw new Error('Já existe um item com esse nome. Escolha outro nome.'); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        return fs.rename(filename, destination);
      }
      if (action === 'delete') { const info = await fs.lstat(filename); return info.isDirectory() ? fs.rmdir(filename) : fs.unlink(filename); }
    } else if (kind === 'sftp') {
      const sftp = await this.remote(id);
      if (action === 'mkdir') return sftpCall(sftp, 'mkdir', filename);
      if (action === 'rename') {
        try { await sftpCall(sftp, 'lstat', destination); throw new Error('Já existe um item com esse nome. Escolha outro nome.'); }
        catch (error) { if (error.code !== 2 && error.code !== 'ENOENT') throw error; }
        return sftpCall(sftp, 'rename', filename, destination);
      }
      if (action === 'delete') { const info = await sftpCall(sftp, 'lstat', filename); return sftpCall(sftp, info.isDirectory() ? 'rmdir' : 'unlink', filename); }
    } else throw new Error('Use upload/download para FTP nesta versão.');
    throw new Error('Operação de arquivos inválida.');
  }
  closeAll() { for (const ftp of this.ftp.values()) ftp.close(); this.ftp.clear(); for (const ft of this.tight.values()) ft.close(); this.tight.clear(); }
}
module.exports = { Files };
