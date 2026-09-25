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

// ---------- Prompt e comando digitado ----------
// Prompt no começo da linha, em negrito: equipamento de rede (SW-CORE> / SW-CORE# / SW(config-if)#),
// Huawei/HP (<SW>, [SW], [~SW-GigabitEthernet0/0/1]) e shells Unix (usuario@host:/caminho$).
// O modo privilegiado (#) fica laranja, o de usuário (>) verde e o "(config…)" amarelo.
// Cores da paleta ANSI (verde, amarelo, azul, magenta): cada tema do app ajusta o tom, então ficam legíveis
// no claro e no escuro. O comando digitado vai só em negrito, na cor normal do texto.
const C = { host: '\x1b[1;32m', priv: '\x1b[1;33m', config: '\x1b[1;35m', path: '\x1b[1;34m', off: '\x1b[22;39m' };
const COMMAND = '\x1b[1m', COMMAND_OFF = '\x1b[22m';
const PROMPTS = [
  // usuario@host:caminho$ ou #
  { regex: /^([\w.-]+@[\w.-]+)(:)([^\s$#]*)([$#]) /, render: m => `${C.host}${m[1]}${C.off}${m[2]}${C.path}${m[3]}${C.off}${m[4] === '#' ? C.priv : ''}${m[4]}${C.off} ` },
  // <Huawei> [Huawei] [~Huawei-GigabitEthernet0/0/1] — o comando vem colado no prompt.
  { regex: /^(<[\w.\-/]{1,63}>|\[[~*]?[\w.\-/:]{1,80}\])/, render: m => `${C.host}${m[1]}${C.off}` },
  // Cisco, Aruba, HP, Juniper, Mikrotik: HOST> HOST# HOST(config-if)# — também sem espaço antes do comando.
  { regex: /^([A-Za-z][\w.\-/@]{0,62})(\((?:config|conf|vlan|cfg)[^)]{0,40}\))?([#>])/, render: m => `${m[3] === '#' ? C.priv : C.host}${m[1]}${C.off}${m[2] ? C.config + m[2] + C.off : ''}${m[3] === '#' ? C.priv : C.host}${m[3]}${C.off}` },
];
function matchPrompt(line) {
  for (const prompt of PROMPTS) { const m = prompt.regex.exec(line); if (m) return [prompt.render(m), m[0].length]; }
  return null;
}

// ---------- Saída em pedaços (como o ChromaTerm) ----------
// A saída do servidor chega picotada: uma palavra ("GigabitEthernet1/0/1") ou um código de cor do próprio servidor
// cortado entre dois pedaços não era reconhecido, e a mesma saída saía às vezes colorida, às vezes não. Aqui as
// linhas completas são coloridas na hora; o fim de linha cortado espera o resto (enquanto continuar chegando, até
// maxHoldMs) antes de colorir — vale também para serial/Telnet lentos, que mandam tudo em pedaços pequenos.
// Logo depois de a pessoa digitar (interactive()), o fim de linha sai na hora: o eco não pode atrasar.
const INCOMPLETE_ESCAPE = /\x1b(?:\[[0-?]*[ -/]*|\][^\x07\x1b]*)?$/;
export function createHighlightStream({ color, write, interactive = () => false, waitMs = 12, maxHoldMs = 100 }) {
  let pending = '', timer = null, holdSince = 0;
  const flush = () => { clearTimeout(timer); timer = null; holdSince = 0; if (pending) { const text = pending; pending = ''; write(color(text)); } };
  return {
    push(data) {
      clearTimeout(timer); timer = null;
      const buffer = pending + data; pending = '';
      const lastBreak = Math.max(buffer.lastIndexOf('\n'), buffer.lastIndexOf('\r'));
      const complete = buffer.slice(0, lastBreak + 1); let tail = buffer.slice(lastBreak + 1);
      if (complete) { holdSince = 0; write(color(complete)); }
      if (!tail) return;
      // Código de escape cortado no fim: nunca é colorido nem mostrado pela metade.
      const cut = INCOMPLETE_ESCAPE.exec(tail)?.[0] || '';
      if (interactive() && data.length <= 32 && !cut) { holdSince = 0; write(color(tail)); return; } // eco de tecla: pedaço pequeno logo após digitar
      const now = Date.now(); if (!holdSince) holdSince = now;
      if (now - holdSince >= maxHoldMs) { const ready = tail.slice(0, tail.length - cut.length); if (ready) write(color(ready)); tail = cut; holdSince = cut ? now : 0; }
      pending = tail; if (pending) timer = setTimeout(flush, waitMs);
    },
    flush,
  };
}

// state (um objeto por sessão) lembra, entre um pedaço de saída e outro, se estamos no começo de uma linha e se
// o cursor está depois de um prompt: o que o servidor ecoa dali em diante é o comando digitado, em destaque
// até o Enter. Sem state, cada chamada começa no início de uma linha.
export function highlight(data, set = 'network', state = null) {
  const rules = SETS[set] || SETS.network;
  const st = state || {}; if (st.lineStart === undefined) st.lineStart = true;
  let result = '', last = 0;
  const piece = text => {
    let out = '';
    for (const part of text.split(/([\r\n]+)/)) {
      if (!part) continue;
      if (/^[\r\n]+$/.test(part)) { st.command = false; st.lineStart = true; out += part; continue; }
      let rest = part;
      if (st.lineStart) { const prompt = matchPrompt(part); if (prompt) { out += prompt[0]; rest = part.slice(prompt[1]); st.command = true; } }
      st.lineStart = false;
      out += st.command ? (rest ? COMMAND + rest + COMMAND_OFF : '') : colorText(rest, rules);
    }
    return out;
  };
  for (const escape of data.matchAll(ESCAPE)) {
    result += piece(data.slice(last, escape.index)) + escape[0];
    last = escape.index + escape[0].length;
  }
  return result + piece(data.slice(last));
}
