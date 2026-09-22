const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const store = path.join(root, 'node_modules/.pnpm');
const target = path.join(root, 'docs/licencas/pacotes');
fs.mkdirSync(target, { recursive: true });
let count = 0;
function collect(directory, prefix) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isFile() && /^(licen[sc]e|copying|notice)(\.|$)/i.test(entry.name)) {
      fs.copyFileSync(path.join(directory, entry.name), path.join(target, prefix + '-' + entry.name)); count++;
    }
  }
}
for (const slot of fs.readdirSync(store, { withFileTypes: true })) {
  const modules = path.join(store, slot.name, 'node_modules');
  if (!slot.isDirectory() || !fs.existsSync(modules)) continue;
  for (const entry of fs.readdirSync(modules, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('@')) {
      for (const item of fs.readdirSync(path.join(modules, entry.name), { withFileTypes: true })) {
        if (item.isDirectory()) collect(path.join(modules, entry.name, item.name), slot.name + '-' + item.name);
      }
    } else collect(path.join(modules, entry.name), slot.name);
  }
}
console.log(`${count} avisos de licença copiados para docs/licencas/pacotes.`);
