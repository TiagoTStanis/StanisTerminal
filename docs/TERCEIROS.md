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
| VcXsrv 21.1.16.1 | Servidor X11, executado como processo separado | https://github.com/marchaesen/vcxsrv/releases/tag/21.1.16.1 |

Os textos de licença dos pacotes estão em `docs/licencas`. A distribuição Electron também inclui `LICENSE.electron.txt` e `LICENSES.chromium.html` no aplicativo extraído.

O VcXsrv contém diversos componentes do X.Org e bibliotecas com suas próprias licenças. Seu repositório oficial e as fontes correspondentes estão em https://github.com/marchaesen/vcxsrv. O binário é incluído sem modificações. Consulte a licença GPL e os avisos do projeto em `docs/licencas/vcxsrv-COPYING` e no repositório oficial. Esta entrega é local; para redistribuição pública dos binários, prepare também a disponibilização das fontes correspondentes e dos avisos de todos os componentes.
