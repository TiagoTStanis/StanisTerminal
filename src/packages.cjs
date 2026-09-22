const path = require('node:path');
const { spawn, execFile } = require('node:child_process');

// Gerenciador de pacotes do Windows por cima do winget (Microsoft): buscar, instalar, atualizar e remover.
// O app só executa o winget com argumentos validados (sem shell). As consultas vão ao catálogo do winget e nada mais é enviado.
const ID = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/;
const SOURCES = ['winget', 'msstore'];
const COMMON = ['--accept-source-agreements', '--disable-interactivity'];

// Tira sequências de controle, barras de progresso e o "spinner" (linhas com só um - \ | /) da saída do winget.
function clean(text) {
  return text.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '').replace(/\r(?!\n)/g, '\n').replace(/[▀-▟]+/g, '')
    .split('\n').filter(line => !/^\s*[-\\|/]\s*$/.test(line)).join('\n');
}
// Lê a tabela do winget. Todo cabeçalho é uma palavra só, então as colunas nascem das posições das palavras (qualquer idioma).
function parseTable(text, kind) {
  const lines = clean(text).split('\n').map(l => l.replace(/\s+$/, ''));
  const sep = lines.findIndex(l => /^-{10,}$/.test(l.trim())); if (sep < 1) return [];
  const header = lines[sep - 1]; const starts = []; const re = /\S+/g; let m; while ((m = re.exec(header))) starts.push(m.index);
  if (starts.length < 3) return [];
  const cell = (line, i) => line.slice(starts[i], starts[i + 1] ?? undefined).trim();
  const names = kind === 'search' ? ['name', 'id', 'version', 'match'] : starts.length >= 5 ? ['name', 'id', 'version', 'available', 'source'] : ['name', 'id', 'version', 'source'];
  const rows = [];
  for (const line of lines.slice(sep + 1)) {
    if (!line.trim() || line.startsWith('<') || /^\d+ (pacote|package|upgrade|atualiza)/i.test(line.trim()) || line.length < starts[1]) continue;
    const row = {}; names.forEach((n, i) => { row[n] = cell(line, i); });
    if (!row.id) continue;
    row.actionable = ID.test(row.id); rows.push(row);
  }
  return rows;
}
function validate(id, source) {
  if (typeof id !== 'string' || !ID.test(id)) throw new Error('Identificador de pacote inválido.');
  if (source !== undefined && source !== '' && !SOURCES.includes(source)) throw new Error('Origem inválida.');
}

class Packages {
  constructor(emit, { command = 'winget', spawnFn = spawn, execFn = execFile } = {}) { this.emit = emit; this.command = command; this.spawn = spawnFn; this.exec = execFn; this.current = null; }
  run(args, timeout = 120000) {
    return new Promise((resolve, reject) => {
      this.exec(this.command, args, { encoding: 'buffer', windowsHide: true, timeout, maxBuffer: 20 * 1024 * 1024 }, (error, stdout) => {
        if (error && error.code === 'ENOENT') return reject(new Error('O winget não foi encontrado. Instale o “Instalador de Aplicativo” pela Microsoft Store.'));
        const out = stdout.toString('utf8');
        if (error && !out.trim()) return reject(new Error(`O winget falhou (código ${error.code ?? 'desconhecido'}).`));
        resolve(out);
      });
    });
  }
  async search(query, source = 'winget') {
    if (typeof query !== 'string' || !query.trim() || query.length > 100 || query.trim().startsWith('-') || /[\x00-\x1f]/.test(query)) throw new Error('Digite uma busca válida (até 100 caracteres, sem começar por “-”).');
    if (!SOURCES.includes(source)) throw new Error('Origem inválida.');
    return parseTable(await this.run(['search', '--query', query.trim(), '--source', source, '--count', '40', ...COMMON]), 'search').map(r => ({ ...r, source }));
  }
  async installed() { return parseTable(await this.run(['list', ...COMMON]), 'list'); }
  async upgrades() { return parseTable(await this.run(['upgrade', ...COMMON]), 'upgrade'); }
  // Instala, atualiza ou remove um pacote, uma operação por vez, mandando o progresso para a interface.
  operate(action, id, source = 'winget') {
    if (!['install', 'upgrade', 'uninstall'].includes(action)) throw new Error('Ação inválida.');
    validate(id, source); if (this.current) throw new Error('Já existe uma operação em andamento. Aguarde ou cancele.');
    const args = [action, '--id', id, '--exact', '--silent', ...COMMON];
    if (action !== 'uninstall') args.push('--accept-package-agreements', '--source', SOURCES.includes(source) ? source : 'winget');
    return new Promise(resolve => {
      const child = this.spawn(this.command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      this.current = { child, id, action }; let tail = '';
      const forward = chunk => { const text = clean(chunk.toString('utf8')); tail = (tail + text).slice(-4000); for (const line of text.split('\n')) if (line.trim()) this.emit('packages:log', { id, action, line: line.trim().slice(0, 300) }); };
      child.stdout?.on('data', forward); child.stderr?.on('data', forward);
      const finish = result => { if (this.current?.child === child) this.current = null; resolve({ id, action, ...result, log: tail.trim().split('\n').slice(-6).join('\n') }); };
      child.once('error', error => finish({ ok: false, code: null, message: error.code === 'ENOENT' ? 'O winget não foi encontrado.' : error.message }));
      child.once('close', (code, signal) => finish({ ok: code === 0, code, message: signal ? 'Cancelado.' : code === 0 ? 'Concluído.' : `O winget terminou com o código ${code}.` }));
    });
  }
  cancel() { this.current?.child.kill(); }
  closeAll() { this.cancel(); }
}
module.exports = { Packages, parseTable, ID };
