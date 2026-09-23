# Componentes de terceiros

A licença MIT na raiz se aplica ao código próprio do Stanis Terminal. Os componentes abaixo conservam suas licenças e autoria; não são código próprio deste projeto.

| Componente | Papel | Origem |
| --- | --- | --- |
| Electron | Aplicativo de desktop | https://github.com/electron/electron |
| xterm.js e addons | Emulação do terminal | https://github.com/xtermjs/xterm.js |
| node-pty | Processo de terminal local | https://github.com/microsoft/node-pty |
| ssh2 | SSH, SFTP e encaminhamento | https://github.com/mscdex/ssh2 |
| noVNC | Cliente VNC | https://github.com/novnc/noVNC |
| basic-ftp | FTP e FTPS | https://github.com/patrickjuchli/basic-ftp |
| serialport | Portas seriais | https://github.com/serialport/node-serialport |
| @xmldom/xmldom | Leitura local do XML exportado pelo mRemoteNG | https://github.com/xmldom/xmldom |
| VcXsrv 21.1.16.1 | Servidor X11, executado como processo separado | https://github.com/marchaesen/vcxsrv/releases/tag/21.1.16.1 |
| IronRDP (ironrdp-web), compilado em `vendor/ironrdp-wasm` | Cliente RDP em WebAssembly, desenha num `<canvas>` no renderer | https://github.com/Devolutions/IronRDP |
| ws | Servidor WebSocket do proxy local do RDP | https://github.com/websockets/ws |

Os textos de licença dos pacotes estão em `docs/licencas`. A distribuição Electron também inclui `LICENSE.electron.txt` e `LICENSES.chromium.html` no aplicativo extraído.

`vendor/ironrdp-wasm` é compilado localmente (não é o pacote npm `ironrdp-wasm`, que ficou parado em abril/2026 sem correções importantes de decodificação de PDU mescladas em julho/agosto/setembro) a partir do commit `9b151c4c2e47c6014e1e8e55909d4180aa8bdb99` de `github.com/Devolutions/IronRDP` (branch master, 2026-09-22), usando a receita de build de `github.com/electerm/ironrdp-wasm` (`wasm-pack build --target web --out-dir pkg --release`). Para atualizar: clone `electerm/ironrdp-wasm`, rode o build (exige Rust + wasm-pack + destino `wasm32-unknown-unknown`; no Windows também precisa do MSVC Build Tools para compilar o próprio `wasm-pack`) e copie `pkg/rdp_client.js`, `pkg/rdp_client_bg.wasm` e `pkg/rdp_client.d.ts` para `vendor/ironrdp-wasm/`.

O VcXsrv contém diversos componentes do X.Org e bibliotecas com suas próprias licenças. Seu repositório oficial e as fontes correspondentes estão em https://github.com/marchaesen/vcxsrv. O binário é incluído sem modificações. Consulte a licença GPL e os avisos do projeto em `docs/licencas/vcxsrv-COPYING` e no repositório oficial. Esta entrega é local; para redistribuição pública dos binários, prepare também a disponibilização das fontes correspondentes e dos avisos de todos os componentes.
