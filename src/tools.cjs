const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const https = require('node:https');
const http = require('node:http');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);

// Ferramentas de terceiros instaladas sob demanda. Cada entrada fixa a origem oficial e o SHA-256 esperado.
// O app só baixa o que está nesta lista, só depois da sua confirmação, só por HTTPS e recusa o arquivo se o hash não bater.
// A requisição não leva nenhum dado seu: é um GET simples, sem cookies e com um User-Agent fixo.
const CATALOG = {
  busybox: {
    name: 'BusyBox (comandos Unix: grep, awk, sed, tar, vi, sh…)', version: 'FRP-6075-g169694ebd', license: 'GPL-2.0',
    url: 'https://frippery.org/files/busybox/busybox-w64-FRP-6075-g169694ebd.exe',
    sha256: '07bb1e5b095b00d68a695481f9240879f33c5724b40aa2308f999d54ed78f075', maxBytes: 5 * 1024 * 1024, file: 'busybox.exe',
    source: 'https://frippery.org/busybox/ — hash do SHA256SUM assinado (GPG) por Ron Yorston, chave B43E 244B 92A8 1389 CAAA A171 690E 10A0 513D A84B'
  },
  tightvnc: {
    name: 'TightVNC (servidor VNC para compartilhar esta tela)', version: '2.8.88', license: 'GPL-2.0',
    url: 'https://www.tightvnc.com/download/2.8.88/tightvnc-2.8.88-gpl-setup-64bit.msi',
    sha256: 'fa86d817ac29c5ffe1e8e7095e738d9ba5ca28aa62304ac234580916622a8ca2', maxBytes: 6 * 1024 * 1024,
    msi: true, file: path.join('PFiles', 'TightVNC', 'tvnserver.exe'), signer: 'OOO GlavSoft',
    verify: [path.join('PFiles', 'TightVNC', 'tvnserver.exe'), path.join('PFiles', 'TightVNC', 'screenhooks64.dll'), path.join('PFiles', 'TightVNC', 'hookldr.exe')],
    source: 'https://www.tightvnc.com/ — hash calculado sobre o instalador com assinatura Authenticode válida de OOO GlavSoft; a assinatura dos executáveis é conferida de novo após extrair'
  },
  msys2: {
    name: 'MSYS2 (ambiente Unix com pacman: bash, coreutils, gcc, git, etc.)', version: '20260611', license: 'BSD/GPL/vários',
    url: 'https://repo.msys2.org/distrib/x86_64/msys2-base-x86_64-20260611.sfx.exe',
    sha256: 'c105946e64e08f099ac0e4647461ce762b95333ad211777666476a9a41451d65', maxBytes: 80 * 1024 * 1024,
    sfx: true, file: path.join('msys64', 'usr', 'bin', 'bash.exe'),
    source: 'https://www.msys2.org/ — assinatura GPG de Christoph Reiter conferida; impressão digital primária 0EBF 782C 5D53 F7E5 FB02 A667 46BD 761F 7A49 B0EC (a mesma publicada na documentação do MSYS2). Download de ~53 MB, ~400 MB em disco.'
  }
};

// Extrai o MSI sem instalar nada (instalação administrativa: só descompacta arquivos) e confere a assinatura digital.
async function extractMsi(msi, target) {
  await run(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'msiexec.exe'), ['/a', msi, '/qn', `TARGETDIR=${target}`], { windowsHide: true, timeout: 120000 });
}
async function extractSelfExtracting(exe, target) {
  await run(exe, ['-y', '-o' + target], { windowsHide: true, timeout: 600000, maxBuffer: 20 * 1024 * 1024 });
}
async function signatureOf(file) {
  const script = "$s = Get-AuthenticodeSignature -LiteralPath $env:STANIS_FILE; if ($s.Status -ne 'Valid') { 'INVALID:' + $s.Status } else { $s.SignerCertificate.Subject }";
  const { stdout } = await run(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 60000, env: { ...process.env, STANIS_FILE: file } });
  return stdout.trim();
}

class Tools {
  constructor(directory, ask, { catalog = CATALOG, allowInsecure = false, extract = extractMsi, signature = signatureOf, extractSfx = extractSelfExtracting, afterInstall = null } = {}) { this.root = path.join(directory, 'tools'); this.ask = ask; this.catalog = catalog; this.allowInsecure = allowInsecure; this.extract = extract; this.signature = signature; this.extractSfx = extractSfx; this.afterInstall = afterInstall; }
  entry(id) { const item = Object.hasOwn(this.catalog, id) ? this.catalog[id] : null; if (!item) throw new Error('Ferramenta desconhecida.'); return item; }
  file(id) { return path.join(this.root, id, this.entry(id).file); }
  installed(id) { return fs.existsSync(this.file(id)); }
  list() { return Object.entries(this.catalog).map(([id, item]) => ({ id, name: item.name, version: item.version, license: item.license, source: item.source, url: item.url, installed: this.installed(id) })); }
  download(url, maxBytes, redirects = 0) {
    return new Promise((resolve, reject) => {
      const target = new URL(url);
      if (target.protocol !== 'https:' && !(this.allowInsecure && target.protocol === 'http:')) return reject(new Error('Só é permitido HTTPS.'));
      const lib = target.protocol === 'https:' ? https : http;
      const request = lib.get(target, { headers: { 'User-Agent': 'StanisTerminal-ToolInstaller', Accept: 'application/octet-stream' }, timeout: 30000 }, response => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
          response.resume(); if (redirects >= 3 || !response.headers.location) return reject(new Error('Redirecionamento inválido.'));
          const next = new URL(response.headers.location, target); if (next.hostname !== target.hostname) return reject(new Error('Redirecionamento para outro domínio recusado.'));
          return this.download(next.toString(), maxBytes, redirects + 1).then(resolve, reject);
        }
        if (response.statusCode !== 200) { response.resume(); return reject(new Error(`Servidor respondeu ${response.statusCode}.`)); }
        const chunks = []; let size = 0, done = false; const hash = crypto.createHash('sha256');
        const finish = (fn, value) => { if (!done) { done = true; fn(value); } };
        response.on('data', chunk => {
          size += chunk.length;
          if (size > maxBytes) { finish(reject, new Error('Arquivo maior que o esperado.')); request.destroy(); return; }
          hash.update(chunk); chunks.push(chunk);
        });
        response.on('end', () => response.complete ? finish(resolve, { bytes: Buffer.concat(chunks), sha256: hash.digest('hex') }) : finish(reject, new Error('Download incompleto.')));
        response.on('error', error => finish(reject, error));
        response.on('close', () => finish(reject, new Error('Conexão encerrada antes do fim do download.')));
      });
      request.on('timeout', () => request.destroy(new Error('Tempo esgotado no download.'))); request.on('error', reject);
    });
  }
  async install(id) {
    const item = this.entry(id); if (this.installed(id)) return this.file(id);
    const ok = await this.ask({ title: `Instalar ${item.name}?`, message: `Origem: ${item.url}\nVersão: ${item.version} · Licença: ${item.license}\nSHA-256 esperado: ${item.sha256}\nO app baixa somente este arquivo, confere o hash e o descarta se for diferente. Nenhum dado seu é enviado.`, fields: [], accept: 'Baixar e verificar' });
    if (!ok) throw new Error('Instalação cancelada.');
    const { bytes, sha256 } = await this.download(item.url, item.maxBytes);
    if (sha256 !== item.sha256) throw new Error(`Hash SHA-256 diferente do esperado (recebido ${sha256}). Arquivo descartado.`);
    const folder = path.join(this.root, id); await fsp.mkdir(folder, { recursive: true });
    if (item.msi) return this.installMsi(id, item, folder, bytes);
    if (item.sfx) return this.installSfx(id, item, folder, bytes);
    const temp = path.join(folder, item.file + '.' + crypto.randomUUID() + '.part'); await fsp.writeFile(temp, bytes, { mode: 0o755 }); await fsp.rename(temp, this.file(id));
    return this.file(id);
  }
  // Pacote autoextraível (7-Zip SFX, como o do MSYS2): extrai para uma pasta de preparo e só depois move para o lugar final.
  async installSfx(id, item, folder, bytes) {
    const stage = path.join(this.root, id + '.stage-' + crypto.randomUUID()); await fsp.mkdir(stage, { recursive: true });
    try {
      const exe = path.join(stage, 'pacote.exe'); await fsp.writeFile(exe, bytes, { mode: 0o755 });
      const out = path.join(stage, 'x'); await this.extractSfx(exe, out);
      const top = item.file.split(path.sep)[0];
      if (!fs.existsSync(path.join(out, item.file))) throw new Error('O pacote extraído não tem o conteúdo esperado. Instalação descartada.');
      await fsp.rm(folder, { recursive: true, force: true }); await fsp.mkdir(folder, { recursive: true });
      await fsp.rename(path.join(out, top), path.join(folder, top));
      if (this.afterInstall) await this.afterInstall(id, this.file(id));
      return this.file(id);
    } catch (error) { await fsp.rm(folder, { recursive: true, force: true }); throw error; }
    finally { await fsp.rm(stage, { recursive: true, force: true }); }
  }
  async installMsi(id, item, folder, bytes) {
    const stage = path.join(this.root, id + '.stage-' + crypto.randomUUID()); await fsp.mkdir(stage, { recursive: true });
    try {
      const msi = path.join(stage, 'pacote.msi'); await fsp.writeFile(msi, bytes);
      const out = path.join(stage, 'x'); await this.extract(msi, out);
      for (const relative of item.verify) {
        const signer = await this.signature(path.join(out, relative));
        if (!signer.includes(item.signer)) throw new Error(`Assinatura digital inválida em ${relative} (${signer}). Instalação descartada.`);
      }
      await fsp.rm(folder, { recursive: true, force: true }); await fsp.mkdir(path.dirname(path.join(folder, item.file)), { recursive: true });
      await fsp.cp(path.join(out, path.dirname(item.file)), path.join(folder, path.dirname(item.file)), { recursive: true });
      return this.file(id);
    } catch (error) { await fsp.rm(folder, { recursive: true, force: true }); throw error; }
    finally { await fsp.rm(stage, { recursive: true, force: true }); }
  }
  async remove(id) { this.entry(id); await fsp.rm(path.join(this.root, id), { recursive: true, force: true }); }
}
module.exports = { Tools, CATALOG };
