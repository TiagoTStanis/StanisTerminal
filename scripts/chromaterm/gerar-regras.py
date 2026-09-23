"""Gera src/ui/chromaterm-rules.js a partir das regras originais do ChromaTerm (MIT)."""
# Uso: python gerar-regras.py <pasta com default_config.py, cisco.yml, generic-networking.yml, juniper.yml> src/ui/chromaterm-rules.js
import json
import re
import sys
import types

here = sys.argv[1]
out = sys.argv[2]

# --- Regras padrão: executa default_config.py com stubs de Rule/Color/Palette ---
palette = {}


class Palette:
    def add_color(self, name, value):
        palette[name] = value


class Color:
    def __init__(self, color, palette=None):
        self.color = color


class Rule:
    def __init__(self, regex, color, description='', exclusive=False):
        self.regex, self.description, self.exclusive = regex, description, exclusive
        self.color = color if isinstance(color, Color) else color[0]


stub = types.ModuleType('chromaterm')
stub.Color, stub.Palette, stub.Rule = Color, Palette, Rule
sys.modules['chromaterm'] = stub
yaml_stub = types.ModuleType('yaml'); yaml_stub.add_representer = lambda *a, **k: None; sys.modules['yaml'] = yaml_stub
ns = {}
exec(open(f'{here}/default_config.py', encoding='utf-8').read(), ns)
order = ['RULE_NUMBERS', 'RULE_URL', 'RULE_IPV4', 'RULE_IPV6', 'RULE_MAC', 'RULE_DATE', 'RULE_TIME', 'RULE_SIZE',
         'RULE_GENERIC_BAD', 'RULE_GENERIC_AMBIGIOUS_BAD', 'RULE_GENERIC_NOT_TOO_BAD', 'RULE_GENERIC_AMBIGIOUS_GOOD',
         'RULE_GENERIC_GOOD']
default_rules = [dict(description=ns[n].description, regex=ns[n].regex, color=ns[n].color.color,
                      exclusive=ns[n].exclusive) for n in order]


# --- Regras de rede: YAML simples (description/regex/color/exclusive) ---
def load_yaml(path):
    rules, cur = [], None
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        m = re.match(r'^- description: (.*)$', line)
        if m:
            cur = {'description': m.group(1), 'exclusive': False}
            rules.append(cur)
            continue
        m = re.match(r'^  (regex|color|exclusive): (.*)$', line)
        if m and cur is not None:
            key, value = m.groups()
            cur[key] = (value == 'true') if key == 'exclusive' else value
    return rules


sets = {
    'default': default_rules,
    'cisco': load_yaml(f'{here}/cisco.yml'),
    'networking': load_yaml(f'{here}/generic-networking.yml'),
    'juniper': load_yaml(f'{here}/juniper.yml'),
}


def strip_verbose(src):
    """Remove espaços e comentários do modo verboso (?x) do Python, respeitando escapes e [classes]."""
    res, i, in_class = [], 0, False
    while i < len(src):
        c = src[i]
        if c == '\\':
            res.append(src[i:i + 2]); i += 2; continue
        if in_class:
            if c == ']': in_class = False
            res.append(c); i += 1; continue
        if c == '[':
            in_class = True; res.append(c); i += 1; continue
        if c in ' \t\r\n':
            i += 1; continue
        if c == '#':
            while i < len(src) and src[i] != '\n': i += 1
            continue
        res.append(c); i += 1
    return ''.join(res)


def to_js(regex):
    flags = ''
    m = re.match(r'^\(\?([aiLmsux]+)\)', regex)
    if m:
        flags = m.group(1)
        regex = regex[m.end():]
    if 'x' in flags:
        regex = strip_verbose(regex)
    regex = regex.replace('(?P<', '(?<')
    regex = re.sub(r'\(\?P=(\w+)\)', r'\\k<\1>', regex)
    return regex, ('i' if 'i' in flags else '')


def color_of(spec):
    spec = spec.strip()
    kind, _, value = spec.partition('.') if '.' in spec and not spec.startswith(('f#', 'b#')) else (spec[0], '', spec[1:])
    if value in palette:
        value = palette[value]
    return {'fg' if kind == 'f' else 'bg': value.lstrip('#')}


result = {}
for name, rules in sets.items():
    converted = []
    for r in rules:
        source, flags = to_js(r['regex'])
        converted.append({'name': r['description'], 'source': source, 'flags': flags,
                          **color_of(r['color']), 'exclusive': bool(r['exclusive'])})
    result[name] = converted

header = """// Regras de realce do ChromaTerm (https://github.com/hSaria/ChromaTerm), licença MIT, Copyright (c) 2020 Saria H.
// Arquivo GERADO por scripts de conversão a partir de chromaterm/default_config.py e contrib/rules/{cisco,
// generic-networking,juniper}.yml: não edite à mão. Regex convertidas de Python para JavaScript ((?i) vira a
// flag "i", o modo verboso (?x) teve espaços/comentários removidos, (?P<n>) vira (?<n>)).
"""
with open(out, 'w', encoding='utf-8', newline='\n') as f:
    f.write(header)
    f.write('export const RULE_SETS = ' + json.dumps(result, ensure_ascii=False, indent=1) + ';\n')
print({k: len(v) for k, v in result.items()})
