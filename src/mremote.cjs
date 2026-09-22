const { DOMParser } = require('@xmldom/xmldom');
const { profile } = require('./config.cjs');

const MAX_BYTES = 5 * 1024 * 1024;
const PROTOCOLS = { SSH2: 'ssh', SSH: 'ssh', RDP: 'rdp', VNC: 'vnc', TELNET: 'telnet', RLOGIN: 'rlogin' };

// Lê apenas os campos de conexão. Password e RDGatewayPassword nunca saem do parser.
function parseMremote(xml) {
  if (typeof xml !== 'string' || Buffer.byteLength(xml, 'utf8') > MAX_BYTES) throw new Error('XML muito grande: limite de 5 MiB.');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('XML com DTD ou entidades externas não é aceito.');
  if ((xml.match(/</g) || []).length > 20000) throw new Error('XML com elementos demais. Exporte uma pasta menor.');
  const problems = [];
  let doc;
  try {
    doc = new DOMParser({ errorHandler: { warning: () => problems.push(true), error: () => problems.push(true), fatalError: () => problems.push(true) } }).parseFromString(xml, 'application/xml');
  } catch { throw new Error('XML inválido. Exporte novamente pelo mRemoteNG.'); }
  if (problems.length || !doc?.documentElement) throw new Error('XML inválido. Exporte novamente pelo mRemoteNG.');
  const root = doc.documentElement;
  if (root.nodeName !== 'Connections') throw new Error('Este XML não é uma exportação de conexões do mRemoteNG (raiz Connections ausente).');
  if (/^true$/i.test(root.getAttribute('FullFileEncryption'))) throw new Error('O XML inteiro está criptografado. No mRemoteNG, exporte as conexões em XML sem criptografia do arquivo e sem senhas.');
  const rows = [], warnings = [];
  const addWarning = message => { if (!warnings.includes(message) && warnings.length < 30) warnings.push(message); };
  const stack = [{ node: root, folders: [], inherited: {}, depth: 0 }];
  let connections = 0, skipped = 0;
  while (stack.length) {
    const { node, folders, inherited, depth } = stack.pop();
    if (depth > 64) throw new Error('XML com pastas aninhadas demais.');
    const attr = key => node.getAttribute(key) || '';
    const effective = {};
    for (const key of ['Username', 'Domain', 'Protocol', 'Port']) {
      effective[key] = /^true$/i.test(attr('Inherit' + key)) ? inherited[key] || '' : attr(key);
    }
    const kind = attr('Type').toLowerCase();
    let nextFolders = folders;
    if (node !== root && node.nodeName === 'Node' && kind === 'container') {
      const rawName = attr('Name') || 'Sem nome';
      const folder = rawName.replace(/[\\/]/g, ' - ').replace(/[\x00-\x1f]/g, '').trim().slice(0, 60) || 'Sem nome';
      nextFolders = [...folders, ['.', '..'].includes(folder) ? 'Sem nome' : folder];
      if (folder !== rawName) addWarning('Alguns nomes de pastas foram ajustados para o formato do Stanis Terminal.');
    } else if (node !== root && node.nodeName === 'Node' && kind === 'connection') {
      connections++;
      if (connections > 500) throw new Error('Limite de 500 conexões por importação. Exporte uma pasta menor.');
      const protocol = effective.Protocol.toUpperCase();
      const type = PROTOCOLS[protocol];
      if (!type) { skipped++; addWarning(`Protocolo não suportado: ${protocol.slice(0, 40) || '(vazio)'}.`); }
      else {
        try {
          let username = effective.Username;
          if (type === 'rdp' && username && effective.Domain && !/[\\@]/.test(username)) username = effective.Domain + '\\' + username;
          const p = profile({ type, name: attr('Name') || attr('Hostname'), host: attr('Hostname'), port: effective.Port || undefined,
            username, group: folders.join('/') || 'Importado do mRemoteNG' });
          delete p.id;
          rows.push(p);
          if (attr('RDGatewayHostname') && attr('RDGatewayUsageMethod') !== 'Never') addWarning('Gateway RDP não é importado; confira o acesso a esses destinos antes de conectar.');
          if (attr('PuttySession') && attr('PuttySession') !== 'Default Settings') addWarning('Personalizações de sessões do PuTTY referenciadas no XML não são importadas.');
        } catch (error) { skipped++; addWarning(`Conexão ignorada: ${error.message}`); }
      }
    }
    for (let child = node.lastChild; child; child = child.previousSibling) {
      if (child.nodeType === 1) stack.push({ node: child, folders: nextFolders, inherited: effective, depth: depth + 1 });
    }
  }
  if (!connections) addWarning('O XML não contém nós de conexão. Exporte as conexões ou uma pasta que contenha sessões.');
  if (skipped) warnings.unshift(`${skipped} conexão(ões) ignorada(s) por protocolo ou dados incompatíveis.`);
  return { rows, warnings, source: 'mRemoteNG XML' };
}

module.exports = { parseMremote, MAX_BYTES };
