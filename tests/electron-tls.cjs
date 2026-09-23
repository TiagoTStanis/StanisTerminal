// Roda os testes de handshake do proxy RDP dentro do Node do Electron (BoringSSL). O Node comum usa
// OpenSSL, que não aplica a regra de Key Usage que derrubava conexões em servidores Windows reais.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const result = spawnSync(require('electron'), ['--test', path.join(__dirname, 'rdpproxy-handshake.test.cjs')], { stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, timeout: 120000 });
if (result.status === 0) console.log('PASS: handshake TLS do proxy RDP no BoringSSL do Electron, inclusive certificado RDP do Windows (Key Usage só Key Encipherment).');
process.exit(result.status ?? 1);
