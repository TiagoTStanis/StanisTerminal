// Realce de sintaxe para terminais remotos (SSH, Telnet, serial…), no estilo do MobaXterm: switches e
// roteadores quase nunca mandam cor, então o app colore na tela palavras de estado, IPs, MACs, interfaces
// e o prompt. Só insere códigos ANSI de cor de texto: nada muda no que o equipamento recebe ou envia.

// Sequências de escape que o servidor já mandou (CSI, OSC, ESC + 1 caractere) ficam intactas: o realce
// só age no texto entre elas, então cores do próprio servidor e movimentos de cursor não quebram.
const ESCAPE = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[@-Z\\-_])/g;

const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const HEX = '[0-9a-f]{1,4}';
// Um grupo por categoria; a ordem importa ("administratively down" antes de "down", MAC antes de IPv6).
const PATTERN = new RegExp([
  // Prompt no começo da linha, sozinho ou já com o comando: SW-CORE#, SW-CORE#show run, switch>,
  // R1(config-if)#, <HUAWEI>, [HUAWEI], [~HUAWEI]
  '(?<prompt>(?:^|(?<=[\\r\\n]))(?:[\\w.\\-]+(?:\\([\\w.\\-]+\\))?[#>]|(?:<[\\w.\\-]+>|\\[~?[\\w.\\-]+\\])(?=\\s|$)))',
  // Interfaces: GigabitEthernet1/0/1, Gi1/0/1, Te1/1/1, Port-channel1, Vlan10, Loopback0, ge-0/0/0, ae1…
  '(?<iface>\\b(?:(?:(?:Hundred|FortyGig|TwentyFive|Twenty|TenGig|Ten|Five|Two)?Gig(?:abit)?(?:Ethernet|E)|FastEthernet|Ethernet|Port-channel|Bundle-Ether|Vlan-interface|Vlanif|Vlan|Loopback|Tunnel|Serial|Management|mgmt)\\s?|Gi|Fa|Te|Tw|Fo|Hu|Eth|Et|Po|Vl|Lo|Tu|Se|Ma)\\d+(?:[/:]\\d+)*(?:\\.\\d+)?\\b|\\b(?:(?:ge|xe|et|fe)-|ae|irb|em|fxp)\\d+(?:[/:]\\d+)*(?:\\.\\d+)?\\b)',
  // MAC: aa:bb:cc:dd:ee:ff, aa-bb-…, aabb.ccdd.eeff (Cisco) e aabb-ccdd-eeff (HP/Huawei)
  '(?<mac>\\b[0-9a-f]{2}(?:[:-][0-9a-f]{2}){5}\\b|\\b[0-9a-f]{4}(?<sep>[.-])[0-9a-f]{4}\\k<sep>[0-9a-f]{4}\\b)',
  // IPv4 (com /máscara opcional) e IPv6 (8 grupos ou forma com ::, que não se confunde com horários)
  `(?<ip>\\b${OCTET}(?:\\.${OCTET}){3}(?:/\\d{1,2})?\\b|\\b${HEX}(?::${HEX}){7}\\b|(?:\\b${HEX}(?::${HEX}){0,6})?::(?:${HEX}(?::${HEX}){0,6}\\b)?(?:/\\d{1,3})?)`,
  // Estados — palavra inteira e não seguida de hífen (running-config, down-link não são estado)
  '(?<warn>\\badministratively down\\b|\\b(?:warning|warn|aviso|atenção|deprecated|half|learning|listening|degraded|standby|notpresent)(?![\\w-]))',
  '(?<bad>\\b(?:down|notconnect|not connected|err-disabled|errdisable|disabled|blocking|failed|failure|error|errors|erro|falhou|falha|fatal|panic|exception|denied|unreachable|timeout|timed out|inactive|shutdown|invalid|incomplete|critical)(?![\\w-]))',
  '(?<good>\\b(?:up|connected|enabled|forwarding|established|full|active|reachable|success|successful|sucesso|online|running)(?![\\w-]))',
].join('|'), 'gi');

const COLOR = {
  prompt: ['\x1b[1;95m', '\x1b[22;39m'],
  iface: ['\x1b[1;94m', '\x1b[22;39m'],
  mac: ['\x1b[36m', '\x1b[39m'],
  ip: ['\x1b[36m', '\x1b[39m'],
  warn: ['\x1b[93m', '\x1b[39m'],
  bad: ['\x1b[91m', '\x1b[39m'],
  good: ['\x1b[92m', '\x1b[39m'],
};

function colorText(text) {
  return text.replace(PATTERN, (match, ...args) => {
    const groups = args[args.length - 1];
    const kind = Object.keys(COLOR).find(name => groups[name] !== undefined);
    if (!kind || !match) return match;
    const [open, close] = COLOR[kind];
    return open + match + close;
  });
}

export function highlight(data) {
  let result = '', last = 0;
  for (const escape of data.matchAll(ESCAPE)) {
    result += colorText(data.slice(last, escape.index)) + escape[0];
    last = escape.index + escape[0].length;
  }
  return result + colorText(data.slice(last));
}
