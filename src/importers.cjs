const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const { profile } = require('./config.cjs');
const { parseMremote, MAX_BYTES } = require('./mremote.cjs');

// Leitura de sessões do PuTTY (registro do Windows) e do ~/.ssh/config. Somente leitura; nunca lê senhas
// (o PuTTY não guarda senha em texto puro no registro) nem escreve nada nesses locais.
async function importPutty(execute = run) {
  if (process.platform !== 'win32') return [];
  const reg = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe');
  let stdout; try { ({ stdout } = await execute(reg, ['query', 'HKCU\\Software\\SimonTatham\\PuTTY\\Sessions'], { windowsHide: true, timeout: 5000, maxBuffer: MAX_BYTES })); }
  catch (error) {
    if (/unable to find|cannot find|não.*(encontr|localiz)|n.o.*(encontr|localiz)/i.test(error.stderr || '')) return [];
    throw new Error('Não foi possível consultar as sessões do PuTTY no Registro do Windows.');
  }
  const names = [...stdout.matchAll(/HKEY_CURRENT_USER\\Software\\SimonTatham\\PuTTY\\Sessions\\(.+)/g)].map(m => m[1].trim());
  const sessions = [];
  for (const name of names) {
    if (sessions.length >= 500) throw new Error('O PuTTY tem sessões demais. Limite de 500 por importação.');
    let out; try { ({ stdout: out } = await execute(reg, ['query', `HKCU\\Software\\SimonTatham\\PuTTY\\Sessions\\${name}`], { windowsHide: true, timeout: 5000, maxBuffer: MAX_BYTES })); } catch { throw new Error('Uma sessão do PuTTY não pôde ser lida. Verifique as permissões do Registro.'); }
    const value = key => out.match(new RegExp(String.raw`^\s*${key}\s+REG_\w+\s+(.*)$`, 'm'))?.[1].trim();
    const host = value('HostName'); if (!host) continue;
    const protocol = (value('Protocol') || 'ssh').toLowerCase();
    if (!['ssh', 'telnet', 'rlogin'].includes(protocol)) continue;
    const port = Number(value('PortNumber')) || { ssh: 22, telnet: 23, rlogin: 513 }[protocol]; const username = value('UserName') || '';
    const keyFile = value('PublicKeyFile') || '';
    let decoded; try { decoded = decodeURIComponent(name); } catch { decoded = name; }
    sessions.push({ name: decoded, group: 'Importado do PuTTY', type: protocol, host, port, username, keyPath: keyFile });
  }
  return sessions;
}
// `~/.ssh/config`: entende Host, HostName, User, Port, IdentityFile e ProxyJump (só se o alvo também estiver no arquivo).
function parseSshConfig(text) {
  const blocks = []; let current = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
    const m = line.match(/^([^\s=]+)\s*(?:=\s*|\s+)(.*)$/); if (!m) continue;
    const [, key, value] = m; const k = key.toLowerCase();
    if (k === 'host') { current = value.split(/\s+/).filter(alias => !/[*!?]/.test(alias)).map(alias => ({ name: alias, host: alias })); blocks.push(...current); continue; }
    if (k === 'match') { current = []; continue; }
    for (const entry of current) {
      const clean = value.replace(/^"|"$/g, '');
      if (k === 'hostname') entry.host = clean;
      else if (k === 'user') entry.username = clean;
      else if (k === 'port') entry.port = Number(clean) || 22;
      else if (k === 'identityfile') entry.keyPath = clean.replace(/^~[/\\]/, os.homedir() + path.sep);
      else if (k === 'proxyjump') entry.jumpName = clean.split(',')[0];
    }
  }
  return blocks;
}
async function importSshConfig(file = path.join(os.homedir(), '.ssh', 'config')) {
  let text; try { text = await readLimited(file, 2 * 1024 * 1024); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const blocks = parseSshConfig(text); const byName = new Map(blocks.map(b => [b.name, b]));
  return blocks.map(b => ({ name: b.name, group: 'Importado do SSH config', type: 'ssh', host: b.host, port: b.port || 22, username: b.username || '', keyPath: b.keyPath || '', jumpName: b.jumpName && byName.has(b.jumpName) ? b.jumpName : '' }));
}
async function readLimited(file, limit = MAX_BYTES) {
  const handle = await fs.promises.open(file, 'r');
  try {
    if ((await handle.stat()).size > limit) throw new Error('Arquivo maior que o esperado. Limite: ' + (limit / 1024 / 1024) + ' MiB.');
    const bytes = Buffer.alloc(limit + 1); let length = 0;
    while (length < bytes.length) { const { bytesRead } = await handle.read(bytes, length, bytes.length - length, null); if (!bytesRead) break; length += bytesRead; }
    if (length > limit) throw new Error('Arquivo maior que o esperado.');
    const buffer = bytes.subarray(0, length);
    if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString('utf16le');
    if (buffer[0] === 0xfe && buffer[1] === 0xff) return buffer.subarray(2).swap16().toString('utf16le');
    return buffer.toString('utf8').replace(/^\uFEFF/, '');
  } finally { await handle.close(); }
}

function previewRows(rows, source, warnings = []) {
  if (!Array.isArray(rows) || rows.length > 500) throw new Error('Limite de 500 conexões por importação.');
  const clean = []; let skipped = 0;
  for (const row of rows) {
    try { const p = profile(row); delete p.id; clean.push({ ...p, ...(row.id ? { sourceId: row.id } : {}), ...(row.jumpId ? { sourceJumpId: row.jumpId } : {}), ...(row.jumpName ? { jumpName: row.jumpName } : {}) }); }
    catch { skipped++; }
  }
  if (skipped) warnings.push(`${skipped} conexão(ões) ignorada(s) por dados inválidos.`);
  return { rows: clean, warnings, source };
}

async function importFile(file) {
  const contents = await readLimited(file);
  if (contents.trimStart().startsWith('<') || /\.xml$/i.test(file)) return parseMremote(contents);
  if (contents.trimStart().startsWith('{') || /\.json$/i.test(file)) {
    let value; try { value = JSON.parse(contents); } catch { throw new Error('JSON inválido. Escolha uma exportação do Stanis Terminal.'); }
    if (!Array.isArray(value.profiles)) throw new Error('O JSON não contém uma lista de sessões do Stanis Terminal.');
    return previewRows(value.profiles, 'Stanis Terminal JSON', ['Somente conexões são importadas; preferências e comandos salvos não são alterados.']);
  }
  if (!/^\s*Host\s+[^\r\n]+/im.test(contents)) throw new Error('Formato não reconhecido. Escolha XML do mRemoteNG, JSON do Stanis Terminal ou config do OpenSSH.');
  return previewRows(await importSshConfig(file), 'OpenSSH config', ['Somente blocos Host explícitos são importados; Include, Match, curingas e ProxyCommand não são aplicados.']);
}

async function scanImports() {
  const candidates = [...new Set([
    process.env.APPDATA && path.join(process.env.APPDATA, 'mRemoteNG', 'confCons.xml'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'mRemoteNG', 'confCons.xml')
  ].filter(Boolean))];
  const sources = [
    ['PuTTY (Registro do Windows)', async () => previewRows(await importPutty(), 'PuTTY')],
    ['OpenSSH (~/.ssh/config)', async () => previewRows(await importSshConfig(), 'OpenSSH', ['OpenSSH: Include, Match e curingas não são aplicados.'])],
    ...candidates.map(file => ['mRemoteNG (' + file + ')', async () => { try { return await importFile(file); } catch (error) { if (error.code === 'ENOENT') return { rows: [], warnings: [] }; throw error; } }])
  ];
  const results = await Promise.all(sources.map(async ([source, read]) => {
    try { return { source, ...await read() }; }
    catch (error) { return { source, rows: [], warnings: [], error: error.message }; }
  }));
  const allRows = results.flatMap(r => r.rows), warnings = results.flatMap(r => r.rows.length ? r.warnings : []);
  if (allRows.length > 500) warnings.push('A busca encontrou mais de 500 conexões; apenas as primeiras 500 estão nesta revisão. Importe os demais arquivos separadamente.');
  return { rows: allRows.slice(0, 500), warnings,
    diagnostics: results.map(r => `${r.source}: ${r.error || (r.rows.length ? r.rows.length + ' conexão(ões) encontrada(s).' : 'nenhuma conexão compatível encontrada.' + (r.warnings.length ? ' ' + r.warnings.join(' ') : ''))}`),
    source: 'Busca neste computador' };
}

function prepareImport(rows, existing) {
  if (!Array.isArray(rows) || rows.length > 500) throw new Error('Limite de 500 conexões por importação.');
  const allowed = ['ssh', 'ssh-x11', 'rdp', 'vnc', 'telnet', 'rlogin', 'rsh', 'local', 'serial', 'x11', 'xdmcp'];
  const fingerprint = p => JSON.stringify([p.name, p.group, p.type, p.host, p.port, p.username, p.shell, p.cwd, p.device]);
  const known = new Map(existing.map(p => [fingerprint(p), p]));
  const byName = new Map(), bySourceId = new Map(), added = [];
  let skipped = 0;
  for (const row of rows) {
    if (!allowed.includes(row?.type)) throw new Error('Protocolo de importação inválido.');
    const p = profile({ ...row, id: undefined, jumpId: '' });
    const key = fingerprint(p), previous = known.get(key);
    if (row.sourceId) bySourceId.set(row.sourceId, previous?.id || p.id);
    if (previous) { byName.set(row.name, previous.id); skipped++; continue; }
    known.set(key, p); byName.set(row.name, p.id); added.push({ p, jumpName: row.jumpName, sourceJumpId: row.sourceJumpId });
  }
  for (const { p, jumpName, sourceJumpId } of added) {
    if (!jumpName && !sourceJumpId) continue;
    const gateway = sourceJumpId ? bySourceId.get(sourceJumpId) : byName.get(jumpName);
    if (!gateway) throw new Error('Selecione também o gateway SSH usado pelas conexões escolhidas. Nenhuma conexão foi importada.');
    p.jumpId = gateway;
  }
  if (existing.length + added.length > 1000) throw new Error('Limite de 1000 sessões salvas. Nenhuma conexão foi importada.');
  return { profiles: existing.concat(added.map(item => item.p)), added: added.length, skipped };
}

module.exports = { importPutty, importSshConfig, parseSshConfig, parseMremote, importFile, scanImports, prepareImport };
