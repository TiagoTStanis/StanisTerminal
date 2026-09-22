// Scripts Lua 100% locais (VM fengari em JavaScript). Sem acesso a arquivos, rede, processos ou ao sistema:
// só as bibliotecas base (reduzida), string, table, math, utf8 e coroutine, mais a API do terminal abaixo.
import fengari from 'fengari';
const { lua, lauxlib, lualib, to_luastring, to_jsstring } = fengari;

const HOOK_EVERY = 100000, MAX_HOOKS = 300; // ~30 milhões de instruções no total
const MAX_STRING = 1 << 20;

export async function runLua(source, api, signal) {
  if (typeof source !== 'string' || source.length > 100000) throw new Error('Script muito grande.');
  const L = lauxlib.luaL_newstate();
  const open = (name, fn) => { lauxlib.luaL_requiref(L, to_luastring(name), fn, 1); lua.lua_pop(L, 1); };
  open('_G', lualib.luaopen_base); open('string', lualib.luaopen_string); open('table', lualib.luaopen_table);
  open('math', lualib.luaopen_math); open('utf8', lualib.luaopen_utf8); open('coroutine', lualib.luaopen_coroutine);
  for (const name of ['dofile', 'loadfile', 'load', 'loadstring', 'require', 'collectgarbage', 'rawset', 'rawget', 'print']) { lua.lua_pushnil(L); lua.lua_setglobal(L, to_luastring(name)); }
  // Limita string.rep e string.format para não esgotar a memória.
  lauxlib.luaL_dostring(L, to_luastring(`
    local rep = string.rep
    string.rep = function(s, n, sep) if #s * n > ${MAX_STRING} then error('string.rep excede o limite') end return rep(s, n, sep) end
  `));

  let hooks = 0;
  const co = lua.lua_newthread(L);
  const fail = message => { throw new Error(message); };
  const register = (name, fn) => { lua.lua_pushjsfunction(co, fn); lua.lua_setglobal(co, to_luastring(name)); };
  const timers = new Set();
  let pending = null; // promessa que o script aguarda; a coroutine cede até ela terminar
  const suspend = (promise, convert) => { pending = { promise, convert }; return lua.lua_yield(co, 0); };
  const str = (index, name) => { if (!lua.lua_isstring(co, index)) return lauxlib.luaL_error(co, to_luastring(`${name}: texto esperado`)); const value = to_jsstring(lua.lua_tolstring(co, index)); if (value.length > 20000) return lauxlib.luaL_error(co, to_luastring(`${name}: texto muito longo`)); return value; };
  const num = (index, fallback, max) => Math.max(0, Math.min(max, lua.lua_isnumber(co, index) ? lua.lua_tonumber(co, index) : fallback));

  register('send', () => { const text = str(1, 'send'); return suspend(api.send(text)); });
  register('sendln', () => { const text = str(1, 'sendln'); return suspend(api.send(text + '\r')); });
  register('wait', () => { const ms = num(1, 0, 60000); return suspend(new Promise(resolve => { const t = setTimeout(() => { timers.delete(t); resolve(); }, ms); timers.add(t); })); });
  register('expect', () => { const text = str(1, 'expect'); const timeout = num(2, 10000, 120000); return suspend(api.expect(text, timeout), ok => lua.lua_pushboolean(co, ok)); });
  register('log', () => { api.log(str(1, 'log')); return 0; });
  register('clear_line', () => suspend(api.send('\x15')));

  lua.lua_sethook(co, () => { if (++hooks > MAX_HOOKS) lauxlib.luaL_error(co, to_luastring('Script interrompido: excedeu o limite de instruções.')); }, lua.LUA_MASKCOUNT, HOOK_EVERY);
  const loaded = lauxlib.luaL_loadbuffer(co, to_luastring(source), source.length, to_luastring('=script'));
  if (loaded !== lua.LUA_OK) fail(to_jsstring(lua.lua_tostring(co, -1)));

  let nargs = 0;
  try { for (;;) {
    if (signal?.aborted) fail('Script cancelado.');
    const status = lua.lua_resume(co, null, nargs); nargs = 0;
    if (status === lua.LUA_OK) return;
    if (status !== lua.LUA_YIELD) fail(to_jsstring(lua.lua_tostring(co, -1)));
    const { promise, convert } = pending; pending = null;
    const value = await Promise.race([promise, new Promise((_, reject) => signal?.addEventListener('abort', () => reject(new Error('Script cancelado.')), { once: true }))]);
    if (convert) { convert(value); nargs = 1; }
  } } finally { for (const t of timers) clearTimeout(t); }
}
