const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { sftpCall } = require('./ssh.cjs');

const MAX_ITEMS = 20000;
// Fila de transferências: uma por vez, com cancelamento e progresso. Arquivos e pastas inteiras, SFTP e FTP.
class Transfers {
  constructor(files, emit) { this.files = files; this.emit = emit; this.jobs = new Map(); this.running = false; }
  list() { return [...this.jobs.values()].map(({ id, name, direction, status, done, total, error }) => ({ id, name, direction, status, done, total, error })); }
  push() { this.emit('transfer:state', this.list()); }
  add({ kind, id, direction, local, remote }) {
    if (!['sftp', 'ftp', 'local'].includes(kind)) throw new Error('Transferência disponível para SFTP, FTP e Rede.');
    if (!['upload', 'download'].includes(direction)) throw new Error('Direção inválida.');
    const job = { id: randomUUID(), kind, session: id, direction, local, remote, name: path.basename(direction === 'upload' ? local : remote) || remote, status: 'na fila', done: 0, total: 0, cancelled: false };
    this.jobs.set(job.id, job); this.push(); this.next(); return job.id;
  }
  cancel(id) { const job = this.jobs.get(id); if (job) { job.cancelled = true; if (job.status === 'na fila') { job.status = 'cancelada'; } this.push(); } }
  clear() { for (const [id, job] of this.jobs) if (!['na fila', 'enviando', 'baixando'].includes(job.status)) this.jobs.delete(id); this.push(); }
  async next() {
    if (this.running) return; this.running = true;
    try {
      for (;;) {
        const job = [...this.jobs.values()].find(j => j.status === 'na fila'); if (!job) break;
        job.status = job.direction === 'upload' ? 'enviando' : 'baixando'; this.push();
        try { await this.run(job); job.status = job.cancelled ? 'cancelada' : 'concluída'; }
        catch (error) { job.status = job.cancelled ? 'cancelada' : 'erro'; job.error = error.message; }
        this.push();
      }
    } finally { this.running = false; }
  }
  async run(job) {
    const stat = job.direction === 'upload' ? await fs.stat(job.local) : null;
    if (job.kind === 'local') {
      const [from, to] = job.direction === 'upload' ? [job.local, job.remote] : [job.remote, job.local];
      await fs.cp(from, to, { recursive: true }); job.done = job.total = 1; return;
    }
    if (job.kind === 'sftp') {
      const sftp = await this.files.remote(job.session);
      if (job.direction === 'upload') return stat.isDirectory() ? this.uploadTree(job, sftp) : this.tick(job, await this.putOne(job, sftp, job.local, job.remote));
      const info = await sftpCall(sftp, 'stat', job.remote);
      return info.isDirectory() ? this.downloadTree(job, sftp) : this.tick(job, await this.getOne(job, sftp, job.remote, job.local));
    }
    const ftp = this.files.ftp.get(job.session); if (!ftp) throw new Error('FTP desconectado.');
    if (job.direction === 'upload') { if (stat.isDirectory()) await ftp.uploadFromDir(job.local, job.remote); else await ftp.uploadFrom(job.local, job.remote); }
    else { const isDir = (await ftp.list(path.posix.dirname(job.remote))).some(x => x.name === path.posix.basename(job.remote) && x.isDirectory); if (isDir) await fs.mkdir(job.local, { recursive: true }), await ftp.downloadToDir(job.local, job.remote); else await ftp.downloadTo(job.local, job.remote); }
    job.done = job.total = 1;
  }
  tick(job, bytes) { job.done += 1; job.total = Math.max(job.total, job.done); void bytes; this.push(); }
  async putOne(job, sftp, local, remote) {
    if (job.cancelled) throw new Error('Cancelada.');
    await sftpCall(sftp, 'fastPut', local, remote); return 0;
  }
  async getOne(job, sftp, remote, local) {
    if (job.cancelled) throw new Error('Cancelada.');
    await fs.mkdir(path.dirname(local), { recursive: true }); await sftpCall(sftp, 'fastGet', remote, local); return 0;
  }
  async mkdirRemote(sftp, dir) {
    try { await sftpCall(sftp, 'mkdir', dir); } catch (error) { const info = await sftpCall(sftp, 'stat', dir).catch(() => null); if (!info?.isDirectory()) throw error; }
  }
  async uploadTree(job, sftp) {
    const items = []; const walk = async (dir, rel) => {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue; if (items.length > MAX_ITEMS) throw new Error(`Pasta com mais de ${MAX_ITEMS} itens.`);
        const relative = rel ? rel + '/' + entry.name : entry.name;
        items.push({ dir: entry.isDirectory(), local: path.join(dir, entry.name), remote: path.posix.join(job.remote, relative) });
        if (entry.isDirectory()) await walk(path.join(dir, entry.name), relative);
      }
    };
    await walk(job.local, ''); job.total = items.filter(x => !x.dir).length; await this.mkdirRemote(sftp, job.remote);
    for (const item of items) { if (job.cancelled) throw new Error('Cancelada.'); if (item.dir) await this.mkdirRemote(sftp, item.remote); else { await this.putOne(job, sftp, item.local, item.remote); job.done++; this.push(); } }
  }
  async downloadTree(job, sftp) {
    const items = []; const walk = async (dir, rel) => {
      for (const entry of await sftpCall(sftp, 'readdir', dir)) {
        if (entry.attrs.isSymbolicLink()) continue; if (items.length > MAX_ITEMS) throw new Error(`Pasta com mais de ${MAX_ITEMS} itens.`);
        if (/[\\/]/.test(entry.filename) || ['.', '..'].includes(entry.filename)) continue; // nome remoto malicioso não escapa da pasta de destino
        const relative = rel ? rel + '/' + entry.filename : entry.filename;
        const isDir = entry.attrs.isDirectory(); items.push({ dir: isDir, remote: path.posix.join(dir, entry.filename), rel: relative });
        if (isDir) await walk(path.posix.join(dir, entry.filename), relative);
      }
    };
    await walk(job.remote, ''); job.total = items.filter(x => !x.dir).length; await fs.mkdir(job.local, { recursive: true });
    for (const item of items) {
      if (job.cancelled) throw new Error('Cancelada.');
      const target = path.join(job.local, ...item.rel.split('/'));
      if (path.relative(job.local, target).startsWith('..')) continue;
      if (item.dir) await fs.mkdir(target, { recursive: true }); else { await this.getOne(job, sftp, item.remote, target); job.done++; this.push(); }
    }
  }
}
module.exports = { Transfers };
