// Realce de sintaxe para terminais remotos (SSH, Telnet, serial…) com as regras prontas do ChromaTerm
// (https://github.com/hSaria/ChromaTerm, MIT): padrão (IPs, MACs, datas, horas, números, tamanhos, URLs e
// palavras boas/ruins) e, no modo "rede", também as regras da comunidade para Cisco, Juniper e rede em geral.
// Só insere códigos ANSI de cor na tela: nada muda no que o equipamento recebe ou envia.
import { RULE_SETS } from './chromaterm-rules.js';

// Sequências de escape que o servidor já mandou (CSI, OSC, ESC + 1 caractere) ficam intactas: o realce
// só age no texto entre elas, então cores do próprio servidor e movimentos de cursor não quebram.
const ESCAPE = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[@-Z\\-_])/g;

const rgb = hex => [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).join(';');
function compile(rules) {
  return rules.map(rule => ({
    regex: new RegExp(rule.source, 'gm' + rule.flags),
    exclusive: rule.exclusive,
    open: rule.fg ? `\x1b[38;2;${rgb(rule.fg)}m` : `\x1b[48;2;${rgb(rule.bg)}m`,
    close: rule.fg ? '\x1b[39m' : '\x1b[49m',
  }));
}
// Como no ChromaTerm, um trecho de regra "exclusiva" (IP, MAC, interface…) não é recolorido por outra regra;
// por isso as exclusivas vão primeiro. As regras de rede vêm antes das gerais.
const ordered = rules => [...rules.filter(r => r.exclusive), ...rules.filter(r => !r.exclusive)];
const SETS = {
  network: compile(ordered([...RULE_SETS.cisco, ...RULE_SETS.networking, ...RULE_SETS.juniper, ...RULE_SETS.default])),
  general: compile(ordered(RULE_SETS.default)),
};

function colorText(text, rules) {
  if (!text) return text;
  const spans = [];
  const free = (start, end) => spans.every(s => end <= s.start || start >= s.end);
  for (const rule of rules) {
    rule.regex.lastIndex = 0;
    for (const match of text.matchAll(rule.regex)) {
      const start = match.index, end = start + match[0].length;
      if (end > start && free(start, end)) spans.push({ start, end, rule });
    }
  }
  if (!spans.length) return text;
  spans.sort((a, b) => a.start - b.start);
  let result = '', last = 0;
  for (const { start, end, rule } of spans) {
    result += text.slice(last, start) + rule.open + text.slice(start, end) + rule.close;
    last = end;
  }
  return result + text.slice(last);
}

export function highlight(data, set = 'network') {
  const rules = SETS[set] || SETS.network;
  let result = '', last = 0;
  for (const escape of data.matchAll(ESCAPE)) {
    result += colorText(data.slice(last, escape.index), rules) + escape[0];
    last = escape.index + escape[0].length;
  }
  return result + colorText(data.slice(last), rules);
}
