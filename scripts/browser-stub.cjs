// Substitui módulos do Node que o fengari referencia mas o renderer nunca usa (io/os do Lua ficam desligados).
module.exports = { platform: () => 'linux', EOL: '\n', tmpdir: () => '/tmp' };
