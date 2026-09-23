# Stanis Terminal

Um terminal para organizar as conexões do dia a dia no Windows. Abra o PowerShell, conecte aos servidores e transfira arquivos sem ficar alternando entre vários programas.

O projeto se inspira no uso de sessões do MobaXterm e do WindTerm. É um aplicativo independente, sem vínculo com esses produtos, sem serviços de IA e sem conta obrigatória.

## Para usar

Para abrir rapidamente, use a distribuição em pasta: extraia **StanisTerminal-1.9.1-win-x64.zip** uma vez para uma pasta local e abra **Stanis Terminal.exe** dentro dela. Mantenha os arquivos juntos; crie um atalho para esse executável. O comando `pnpm build:zip` gera esse pacote em `dist`.

**Evite a versão de arquivo único** (`StanisTerminal-*-win-x64-PORTATIL-LENTO-usar-o-zip.exe`): ela extrai os componentes a cada execução — não só na primeira — e pode levar mais de um minuto toda vez que você abrir. Use-a apenas para testar rapidamente em um computador onde você não vai instalar nada; para uso do dia a dia, use sempre o ZIP extraído. Não precisa instalar Node.js, Python ou Electron em nenhuma das distribuições. Use Windows 10/11 de 64 bits e uma pasta em que você possa salvar arquivos, como Documentos. Consulte os arquivos já publicados em [Releases](https://github.com/TiagoTStanis/StanisTerminal/releases); gerar um pacote local não o publica automaticamente. Para arquivos publicados, confira o SHA-256 e a assinatura GPG do release (veja [como verificar](docs/VERIFICAR-ASSINATURA.md); impressão digital `A345 44C3 43F2 E16B EF64  C7A4 95A1 3721 ED00 B9E6`).

1. Clique em **Abrir PowerShell** para trabalhar neste computador.
2. Para acessar um servidor, clique em **Nova sessão**, escolha o protocolo e preencha nome, endereço e usuário. Porta, pastas, chave SSH, agente, proxy e gateway ficam em **Avançados**. Salve e clique no perfil na barra lateral.
3. Em uma conexão SSH, abra **Arquivos → SFTP** para ver os arquivos do servidor. O botão **Enviar** escolhe um arquivo local; a seta ao lado de um arquivo remoto faz o download.
4. Use **Dividir** para trabalhar com até quatro painéis visíveis. É possível manter até 24 sessões abertas.

O [manual de uso](docs/LEIA-ME.md) explica backups, X11, atalhos e mensagens comuns. Os [resultados de validação](docs/VALIDACAO.md) separam o que foi testado das conexões que dependem do seu ambiente.

## Recursos

**Novo na 1.9.1 — RDP conecta em servidores Windows reais (correção importante):**
- Em servidores Windows a conexão falhava com `RDCleanPath error (code 1) / HTTP 502`. O registro mostrava `Handshake TLS falhou: KEY_USAGE_BIT_INCORRECT`. **Não era firewall:** o certificado que o Windows gera para o RDP declara a chave só para "Key Encipherment", e a biblioteca TLS do Electron (BoringSSL) recusa esse certificado na negociação moderna (ECDHE/TLS 1.3), mesmo sem validar o certificado. O `mstsc` tolera isso. Agora, quando isso acontece, o Stanis Terminal refaz a conexão em TLS 1.2 com troca de chaves RSA, que usa exatamente o que o certificado permite.
- **Erro real na tela:** no lugar do "502" genérico, a mensagem diz o motivo: conexão recusada, tempo esgotado (firewall/VPN), nome não encontrado (DNS) ou problema de certificado/TLS.
- Teste novo `pnpm test:tls`, que roda o handshake no mesmo BoringSSL do Electron, com um certificado igual ao do RDP do Windows.

**Da 1.9.0 — visual novo, mais área para a sessão:**
- Visual inspirado no Material Design 3 do Google: cores tonais nos temas claro e escuro, cantos e espaçamentos consistentes, abas com indicador, foco visível pelo teclado e tipografia Segoe UI Variable.
- **Mais espaço para o terminal ou a tela remota:** faixas superiores mais finas, e as abas e as ações da sessão agora dividem uma única faixa. Numa janela de 1424×860, a área útil passou de 1156×710 para 1156×767.
- **Lateral recolhível** (botão ☰ ou **Ctrl+Shift+B**; o estado é lembrado): a sessão ganha toda a largura. O Ctrl+B continua livre para o tmux e para a sessão remota.
- **Modo foco** (botão, **F11** ou duplo clique na aba): a sessão ocupa a janela inteira. "Sair do foco" aparece com o mouse no topo.
- **Barra de RDP/VNC** (Ctrl+Alt+Del, colar, arquivos, tela cheia) no topo central, como no RDP do Windows: aparece só com o mouse perto da borda de cima e não cobre o botão de fechar das janelas remotas.
- A barra da sessão mostra só o que faz sentido: numa sessão gráfica, somem Buscar, Gravar saída, Multiexecução, Digitar em todos, Macros e Scripts.

**Da 1.8.3 — acesso remoto RDP estável e com a tela inteira:**
- **A conexão caía no primeiro clique ou tecla** em servidores como o RDP embutido do VirtualBox (VRDE): o cliente mandava input no formato "fast-path" mesmo quando o servidor não o anuncia, e o servidor fechava a conexão (`read frame: not enough bytes`). Agora o Stanis Terminal usa o formato clássico (slow-path) quando o servidor não aceita fast-path.
- **Blocos pretos na tela:** atualizações de imagem que passavam um pouco da borda da tela eram descartadas inteiras; agora são recortadas e desenhadas.
- **Tela cortada ou deslocada:** a imagem remota agora é sempre escalada para caber no painel, mantendo a proporção e centralizada, e acompanha se o servidor mudar de resolução. O mouse é convertido para as coordenadas reais do servidor.
- **Nova opção "Resolução da tela remota"** no perfil RDP (padrão: ajustar à janela). Use-a quando o servidor não se adapta ao tamanho pedido — por exemplo, uma VM do VirtualBox sem Guest Additions acessada pelo VRDE: escolha a resolução do convidado (ex.: 1024 × 768) para ver a tela inteira, com a barra de tarefas.

**Da 1.8.2 (correção):** tela do RDP "quadriculada"/com blocos velhos sobrepostos. Causa: um bug documentado do IronRDP — quando o servidor redimensiona a saída gráfica (algo que passou a acontecer mais desde a 1.8.1, que passou a pedir a resolução exata do painel), pedaços da tela antiga ficam sobrepostos porque o cache de bitmap é limpo incorretamente e o canvas não resincroniza direito com a imagem decodificada. Já existe uma correção completa pra isso, só que ainda não foi aceita no repositório oficial do IronRDP (PR aberto) — compilamos com essa correção (de um fork) em vez de esperar. **Validado contra a VM de teste**: conexão só com o IP (sem usuário), tela de login renderizada limpa, sem blocos sobrepostos. Pode sobrar algum bloco escuro na borda inferior durante o carregamento; avise se a tela quadriculada continuar.

**Da 1.8.1 (correção):** a resolução da tela do RDP ficava errada/desproporcional. Causa: o app calculava a resolução a pedir ao servidor lendo o tamanho do painel *antes* dele ter sido dimensionado de verdade pela interface — pegava `0` ou um tamanho de sessão anterior, caía num valor padrão (1280×800) e nunca mais corrigia depois, só escalava por CSS. Agora o painel é dimensionado primeiro; a resolução pedida ao servidor bate com o tamanho real da janela.

**Da 1.8.0 — RDP conectando e mostrando a tela de verdade:** o pacote `ironrdp-wasm` do npm (usado desde a 1.7.0) foi compilado em abril/2026 e nunca mais foi atualizado — ficou sem três correções importantes do IronRDP mescladas em julho/agosto/setembro, entre elas exatamente o tipo de erro que travava conexões reais ("Font Map" vazio, PDUs com tamanho subdeclarado). Agora o Stanis Terminal compila sua própria versão do IronRDP (`vendor/ironrdp-wasm`, receita documentada em `docs/TERCEIROS.md`) direto do código-fonte mais recente da Devolutions. **Testado contra uma VM real (VirtualBox) com sucesso**: login completo, negociação do protocolo inteira, e a tela desenhou de verdade (confirmado pixel a pixel, não só "não deu erro"). Ainda dá pra cair depois de alguma interação em certos casos — se acontecer, mande a mensagem de erro exata.

**Da 1.7.2 (correção crítica):** a flexibilização de TLS da 1.7.1 (`ciphers: 'DEFAULT@SECLEVEL=0'`) usava uma sintaxe específica do OpenSSL que o **BoringSSL do Electron empacotado não entende** — derrubava o app inteiro (`INVALID_COMMAND`, exceção não tratada no processo principal), fechando todas as sessões abertas. Corrigido: removida essa configuração (o `minVersion` baixo sozinho já cobre a compatibilidade), e `tls.connect()` agora está dentro de um `try/catch` — qualquer configuração de TLS problemática no futuro vai falhar só naquela conexão RDP, nunca mais o app inteiro. Também foi adicionada uma rede de segurança geral no processo principal (`uncaughtException`) para qualquer outro erro não previsto não derrubar o app.

**Da 1.7.1:** o proxy do RDP (1.7.0) aceitava só TLS 1.2+, e o `node-tls` moderno recusa até isso sem flexibilização explícita em alguns casos — servidores RDP mais antigos ou com "Enhanced RDP Security" configurado de forma legada só falam TLS 1.0/1.1 e a conexão falhava com um erro genérico ("general error, HTTP 502"), sem detalhe nenhum. Agora o proxy aceita TLS 1.0+ (a validação de certificado já era flexível desde a 1.7.0) e **grava um log** (`rdp-proxy.log`, na pasta de dados do app) com o motivo real de cada falha — acesse em **Ferramentas → Registro de conexões RDP**.

**Da 1.7.0 — RDP reescrito do zero (canvas/WASM, sem ActiveX):** as versões 1.6.1–1.6.3 tentaram consertar o RDP mantendo o controle ActiveX do Windows embutido via processo separado (`SetParent`), mas essa técnica esbarra num problema conhecido do Windows 11: o DWM não sincroniza corretamente janelas de outro processo reparentadas, e a tela nunca aparecia. A solução foi trocar de abordagem: o RDP agora roda como o VNC sempre rodou — um cliente que desenha direto num `<canvas>` dentro do próprio app (biblioteca [IronRDP](https://github.com/Devolutions/IronRDP) da Devolutions, compilada para WebAssembly, a mesma usada por Cloudflare Access e Teleport para RDP no navegador), conectado por um proxy local que o próprio app sobe (WebSocket ↔ TLS ↔ TCP até o servidor). Sem ActiveX, sem janela nativa, sem o bug do DWM.
- Suporta teclado, mouse, roda do mouse e Ctrl+Alt+Del.
- Clipboard de texto sincronizado nos dois sentidos.
- `RedirectClipboard`/`RedirectDrives` (arquivos via Explorer e unidades locais como `\\tsclient\`) continuam funcionando — são recursos do próprio protocolo RDP, não do controle ActiveX.
- **Prompt colorido** nos terminais locais: se o **Oh My Posh** estiver instalado (Ferramentas → Ferramentas verificadas), usa o tema dele (git, ícones, cores — o mesmo estilo do oh-my-zsh, mas para PowerShell/bash no Windows); senão usa um prompt simples `usuário@host:pasta`. Pode ser desligado em Preferências.
- **Destaque automático de erros e avisos** na saída do terminal: "error"/"erro", "failed"/"falhou" e "warning"/"aviso" ficam coloridos automaticamente. Pode ser desligado em Preferências.
- Validado com testes automatizados reais: handshake TLS completo contra um servidor RDP simulado, e a sessão RDP real pela interface (carrega o WASM, conecta ao proxy, negocia o protocolo, mostra erro limpo sem travar). Login bem-sucedido contra um servidor RDP de verdade não foi possível testar neste ambiente — avise se encontrar algum problema.

**Da 1.6.0:** copiar e colar no VNC, aba **Rede** para transferência de arquivos por VNC/RDP quando o compartilhamento `C$`/SSH estiver disponível.
- **VNC dando erro sem nunca pedir senha:** quando o servidor exige um tipo de autenticação (ex.: MS-Logon do UltraVNC, RSA-AES) e a negociação falha antes da etapa de senha, o app agora mostra o motivo técnico retornado pelo servidor em vez de uma mensagem genérica — ajuda a identificar se é incompatibilidade de protocolo ou outra causa.

**Da 1.6.0:** copiar e colar texto funcionando em sessões VNC (Ctrl+Shift+V ou colar direto na tela; o que o servidor copia também chega no seu clipboard do Windows) e transferência de arquivos por VNC/RDP através da aba **Rede** no painel de Arquivos. Ao clicar em **Rede** com uma sessão VNC ou RDP ativa, o app abre um canal paralelo para o mesmo host — compartilhamento administrativo `\\host\c$` se for Windows, ou uma conexão SSH oculta na porta 22 se for Linux — e reaproveita o mesmo painel de Enviar/Baixar/Editar já usado no SFTP. Na primeira vez com um host VNC, o app pergunta se o sistema é Windows ou Linux e guarda a resposta no perfil. Requisitos: Windows precisa do compartilhamento `C$` habilitado e um usuário com permissão administrativa; Linux precisa de um servidor SSH ativo na porta 22. Senhas tentam a credencial já salva primeiro; se falhar, pedem uma vez, com opção de lembrar.

**Da 1.5.0:** formulário de conexão simples com opções em **Avançados**, importação do XML do mRemoteNG e revisão antes de salvar. O botão **De outro app** permite escolher um arquivo ou procurar PuTTY, OpenSSH e mRemoteNG nos locais padrão, mostrando o resultado de cada origem. A importação preserva protocolos e pastas, ignora duplicatas e não importa senhas. Veja os formatos e limites no [manual](docs/LEIA-ME.md#trazer-conexões-de-outro-programa).

**Da 1.4.0:** transferência de arquivos por ZMODEM (`rz`/`sz`) sobre um canal SSH dedicado, independente do terminal interativo — funciona mesmo sem SFTP no servidor, desde que ele tenha `rz`/`sz` (pacote `lrzsz`).

**Da versão anterior:** links clicáveis no terminal (com confirmação antes de abrir no navegador), proxy SOCKS5 de saída e encaminhamento do agente para a conexão SSH, varredura de portas e Wake-on-LAN, importar sessões do PuTTY e do `~/.ssh/config`, reabrir sessões ao iniciar (opcional), e senha mestra com bloqueio automático por tempo ocioso.


**Organização:** sessões em pastas e subpastas (arraste para mover, botão direito para renomear, exportar ou excluir), conexão rápida por `usuario@servidor` (RDP, SSH, VNC ou Telnet) e tema claro por padrão.

**RDP de um clique:** guarde a senha uma vez (criptografada pela sua conta Windows) e conecte sem diálogos. “Esquecer senha” fica no menu da sessão.

**Pacotes (winget):** buscar, instalar, atualizar e remover programas do catálogo oficial do Windows; listas de programas que você salva, exporta e importa. Nada é consultado até você pedir.


- PowerShell, CMD, Git Bash e WSL; abas, painéis, busca e gravação da saída.
- SSH com senha ou chave privada, gateway SSH e SFTP na mesma conexão.
- RDP e VNC dentro da janela; Telnet e serial 8N1.
- Servidor X11 incluído, encaminhamento X11 por SSH e cliente XDMCP.
- FTP/FTPS, editor de texto UTF-8, comandos rápidos e execução em destinos selecionados.
- Túneis SSH locais, remotos (`-R`) e proxy SOCKS5 dinâmico (`-D`); ping, DNS, traceroute, teste TCP, SHA-256 e geração de chave RSA protegida.
- Rlogin e Rsh (sem criptografia, para equipamentos antigos).
- Servidores locais em 127.0.0.1: HTTP, TFTP, FTP e SFTP (somente leitura por padrão; nunca sobrescrevem arquivos).
- Transferência de pastas inteiras por SFTP/FTP, com fila, cancelamento e arrastar-e-soltar do Explorer.
- Transferência ZMODEM (`rz`/`sz`) por um canal SSH próprio, sem passar pelo texto do terminal — útil quando o servidor não tem SFTP.
- Digitar em todos os painéis visíveis, macros gravadas e reproduzidas, histórico de comandos com sugestões (Ctrl+Espaço) e busca (Ctrl+Shift+H). Senhas digitadas nunca entram no histórico nem nas macros.
- Temas Escuro, Claro, Dracula, Nord, Solarized e Monokai; sincronização de sessões, comandos e macros por uma pasta sua (OneDrive, Dropbox, repositório Git). Senhas nunca são sincronizadas.
- Scripts em Lua (VM local, sem acesso a arquivos, rede ou sistema; com limite de instruções e memória): `send`, `sendln`, `wait`, `expect`, `log`.
- Login SSH pelo agente do Windows (OpenSSH ou Pageant): a chave privada nunca passa pelo aplicativo.
- Painel SFTP que acompanha a pasta do terminal (OSC 7) e espelho contínuo local → servidor (nunca apaga nem sobrescreve arquivo mais novo).
- Ferramentas verificadas: o BusyBox (grep, awk, sed, tar, vi…) é baixado só depois da sua confirmação, de uma origem oficial fixa, por HTTPS, com SHA-256 conferido; arquivo diferente do esperado é descartado. Nenhum dado seu vai na requisição. Ele aparece como um shell local “BusyBox (Unix)”.
- Ambiente Unix completo com gerenciador de pacotes (MSYS2 + pacman): bash, coreutils, gcc, git e milhares de pacotes, tudo dentro da pasta do app. A tela de Pacotes tem uma aba “Unix (MSYS2)” ao lado da do Windows.
- Servidor VNC (TightVNC, baixado com hash e assinatura digital conferidos): escuta só em 127.0.0.1, com senha opcional de até 8 caracteres. Para outro computador ver sua tela, use um túnel SSH remoto para a porta escolhida. Sem senha, qualquer programa da sua conta Windows consegue se conectar.

Git Bash e WSL são opcionais e precisam estar instalados no Windows. A conexão serial precisa do equipamento e do driver. RDP usa o controle nativo do Windows e exige uma identidade de servidor válida.

## Seus dados

Na versão portátil, a pasta **StanisTerminal-data** fica ao lado do executável. Feche o aplicativo antes de copiar essa pasta para backup. Os perfis não guardam a senha; quando você escolhe lembrar uma senha SSH, ela fica criptografada pela conta Windows. Em outro computador ou outra conta, informe a senha novamente.

O aplicativo só abre conexões solicitadas por você. Não há telemetria, sincronização em nuvem ou atualizador automático implementado. Telnet, FTP sem TLS, XDMCP e certos modos de VNC não oferecem a proteção de uma conexão SSH: use-os apenas no ambiente adequado.

## Trabalhar no código

Requisitos de desenvolvimento: Windows x64, Node.js 20 ou superior, pnpm e .NET Framework 4.x com o compilador `csc.exe`. O compilador gera os pequenos componentes de RDP e incorporação de janelas X11.

| Comando | Finalidade |
| --- | --- |
| `pnpm install --frozen-lockfile` | Instalar as dependências das versões registradas |
| `pnpm start` | Preparar a interface e abrir o aplicativo |
| `pnpm test` | Testar regras e operações de arquivos/rede |
| `pnpm test:ui` | Testar a interface com PowerShell real |
| `pnpm test:import` | Testar formulário simples/avançado e importação XML pela interface |
| `pnpm test:connections` | Testar conexões em servidores locais descartáveis |
| `pnpm test:portable` | Conferir abertura e PowerShell no lançador de arquivo único |
| `pnpm build` | Gerar o executável único e o ZIP para abertura rápida em `dist` |
| `pnpm build:zip` | Gerar somente o ZIP; extraia uma vez e abra o executável interno |

Para testar a distribuição extraída, defina `STANIS_TEST_EXE` com o caminho completo de `dist/win-unpacked/Stanis Terminal.exe` antes de rodar os testes de interface e conexões. Os testes usam uma pasta temporária de dados, separada dos seus perfis.

O servidor X11 fica em `vendor/vcxsrv` e deve acompanhar o código para que o build tenha os mesmos recursos. Veja a origem e as licenças em [componentes de terceiros](docs/TERCEIROS.md). O diretório `vendor/7zip` é apenas uma ferramenta de preparação anterior; não é necessário para usar o aplicativo.

## Organização

`src/main.cjs` recebe as ações da interface; `sessions.cjs` gerencia terminais; `ssh.cjs` autentica e verifica chaves; `files.cjs` cuida dos arquivos; `network.cjs` mantém diagnósticos e túneis; `graphics.cjs` gerencia as sessões gráficas. A interface editável está em `src/ui/renderer.js`; `app.js` é gerado pelo build.

## Limites

Não há API de plugins além dos scripts Lua. A sincronização de configurações é manual, por botão. O editor é para texto UTF-8 de até 2 MiB.

O executável não tem assinatura digital de editor. A primeira abertura pode ser sinalizada pelo Windows. A entrega inclui um SHA-256 para conferir se o arquivo foi alterado.
