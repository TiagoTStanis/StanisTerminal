# Componentes de terceiros

A licença MIT na raiz se aplica ao código próprio do Stanis Terminal. Os componentes abaixo conservam suas licenças e autoria; não são código próprio deste projeto.

| Componente | Papel | Origem |
| --- | --- | --- |
| Electron | Aplicativo de desktop | https://github.com/electron/electron |
| xterm.js e addons | Emulação do terminal | https://github.com/xtermjs/xterm.js |
| node-pty | Processo de terminal local | https://github.com/microsoft/node-pty |
| Regras do ChromaTerm (MIT) | Realce de sintaxe dos terminais remotos: padrão + Cisco, Juniper e rede (`src/ui/chromaterm-rules.js`, gerado por `scripts/chromaterm/gerar-regras.py` a partir do repositório original) | https://github.com/hSaria/ChromaTerm — licença em `docs/licencas/chromaterm-LICENSE` |
| ssh2 | SSH, SFTP e encaminhamento | https://github.com/mscdex/ssh2 |
| noVNC | Cliente VNC | https://github.com/novnc/noVNC |
| basic-ftp | FTP e FTPS | https://github.com/patrickjuchli/basic-ftp |
| serialport | Portas seriais | https://github.com/serialport/node-serialport |
| @xmldom/xmldom | Leitura local do XML exportado pelo mRemoteNG | https://github.com/xmldom/xmldom |
| VcXsrv 21.1.16.1 | Servidor X11, executado como processo separado | https://github.com/marchaesen/vcxsrv/releases/tag/21.1.16.1 |
| IronRDP (ironrdp-web), compilado em `vendor/ironrdp-wasm` | Cliente RDP em WebAssembly, desenha num `<canvas>` no renderer | https://github.com/Devolutions/IronRDP |
| ws | Servidor WebSocket do proxy local do RDP | https://github.com/websockets/ws |

Os textos de licença dos pacotes estão em `docs/licencas`. A distribuição Electron também inclui `LICENSE.electron.txt` e `LICENSES.chromium.html` no aplicativo extraído.

`vendor/ironrdp-wasm` é compilado localmente com a receita de `github.com/electerm/ironrdp-wasm` (`wasm-pack build --target web --out-dir pkg --release`; exige Rust + wasm-pack + destino `wasm32-unknown-unknown` e, no Windows, MSVC Build Tools). Desde a 1.8.3 a fonte do IronRDP é o fork `github.com/juanjiTech/IronRDP`, branch `upstream-egfx-reset-fix`, commit `50303b73c86e457fe0856547025d4c1b768998d6` (correção de tearing ainda não aceita no oficial), mais o patch `vendor/ironrdp-wasm/patches/0001-stanis-terminal.patch`: input slow-path quando o servidor não anuncia fast-path (o VirtualBox VRDP derrubava a conexão no primeiro clique); recorte de bitmaps que passam da borda da tela em vez de descartá-los; e, desde a 1.10.0, RemoteApp no cliente web (o `RailClient` do `ironrdp-client` copiado para `ironrdp-web/src/rail.rs`, mais a extensão `remote_app`). Para atualizar: clone o fork nesse commit, aplique o patch com `git apply`, aponte `ironrdp-web` no `Cargo.toml` do `electerm/ironrdp-wasm` para `crates/ironrdp-web` do clone (`path = ...`), rode o build e copie `pkg/rdp_client.js`, `pkg/rdp_client_bg.wasm` e `pkg/rdp_client.d.ts` para `vendor/ironrdp-wasm/`.

O VcXsrv contém diversos componentes do X.Org e bibliotecas com suas próprias licenças. Seu repositório oficial e as fontes correspondentes estão em https://github.com/marchaesen/vcxsrv. O binário é incluído sem modificações. Consulte a licença GPL e os avisos do projeto em `docs/licencas/vcxsrv-COPYING` e no repositório oficial. Esta entrega é local; para redistribuição pública dos binários, prepare também a disponibilização das fontes correspondentes e dos avisos de todos os componentes.
