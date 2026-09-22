# Stanis Terminal

Um terminal para organizar as conexões do dia a dia no Windows. Abra o PowerShell, conecte aos servidores e transfira arquivos sem ficar alternando entre vários programas.

O projeto se inspira no uso de sessões do MobaXterm e do WindTerm. É um aplicativo independente, sem vínculo com esses produtos, sem serviços de IA e sem conta obrigatória.

## Para usar

Para abrir rapidamente, use a distribuição em pasta: extraia **StanisTerminal-1.6.3-win-x64.zip** uma vez para uma pasta local e abra **Stanis Terminal.exe** dentro dela. Mantenha os arquivos juntos; crie um atalho para esse executável. O comando `pnpm build:zip` gera esse pacote em `dist`.

**Evite a versão de arquivo único** (`StanisTerminal-*-win-x64-PORTATIL-LENTO-usar-o-zip.exe`): ela extrai os componentes a cada execução — não só na primeira — e pode levar mais de um minuto toda vez que você abrir. Use-a apenas para testar rapidamente em um computador onde você não vai instalar nada; para uso do dia a dia, use sempre o ZIP extraído. Não precisa instalar Node.js, Python ou Electron em nenhuma das distribuições. Use Windows 10/11 de 64 bits e uma pasta em que você possa salvar arquivos, como Documentos. Consulte os arquivos já publicados em [Releases](https://github.com/TiagoTStanis/StanisTerminal/releases); gerar um pacote local não o publica automaticamente. Para arquivos publicados, confira o SHA-256 e a assinatura GPG do release (veja [como verificar](docs/VERIFICAR-ASSINATURA.md); impressão digital `A345 44C3 43F2 E16B EF64  C7A4 95A1 3721 ED00 B9E6`).

1. Clique em **Abrir PowerShell** para trabalhar neste computador.
2. Para acessar um servidor, clique em **Nova sessão**, escolha o protocolo e preencha nome, endereço e usuário. Porta, pastas, chave SSH, agente, proxy e gateway ficam em **Avançados**. Salve e clique no perfil na barra lateral.
3. Em uma conexão SSH, abra **Arquivos → SFTP** para ver os arquivos do servidor. O botão **Enviar** escolhe um arquivo local; a seta ao lado de um arquivo remoto faz o download.
4. Use **Dividir** para trabalhar com até quatro painéis visíveis. É possível manter até 24 sessões abertas.

O [manual de uso](docs/LEIA-ME.md) explica backups, X11, atalhos e mensagens comuns. Os [resultados de validação](docs/VALIDACAO.md) separam o que foi testado das conexões que dependem do seu ambiente.

## Recursos

**Novo na 1.6.3 (correção, confiança parcial — veja abaixo):** RDP conectando mas sem mostrar a tela (ficava travado em "Conectando à área de trabalho…"). Duas causas prováveis corrigidas: (1) o controle ActiveX só vincula corretamente sua superfície de vídeo se a janela já estiver visível e com tamanho real *antes* de `Connect()` — agora ela é mostrada com um tamanho provisório assim que a conexão começa, corrigida para o tamanho exato do painel logo em seguida; (2) a janela nativa agora é explicitamente trazida para o topo da ordem de empilhamento sempre que exibida, para não ficar renderizada atrás do conteúdo do Electron. **Não foi possível validar contra um servidor RDP real neste ambiente** (sem servidor de teste disponível) — se ainda não aparecer a tela, avise com detalhes (a mensagem de erro, se houver).

**Da 1.6.2:**
- **Transferência de arquivos e clipboard no RDP sem precisar do compartilhamento C$:** o controle agora liga os dois canais virtuais oficiais do RDP — `RedirectClipboard` (copiar/colar texto e arquivos entre local e remoto, direto no Explorer) e `RedirectDrives` (suas unidades locais aparecem como `\\tsclient\` dentro da sessão remota). É o mesmo mecanismo usado por qualquer área de trabalho remota corporativa (e, por baixo dos panos, pelo próprio RustDesk para RDP) — não afeta login nem outras sessões conectadas ao servidor. A aba **Rede** continua existindo como alternativa (útil para VNC, que não tem esse recurso no protocolo).
- **Prompt colorido** nos terminais locais (PowerShell, cmd, bash/WSL/MSYS2): usuário, host e pasta atual em cores, no estilo MobaXterm. Pode ser desligado em Preferências.
- **Destaque automático de erros e avisos** na saída do terminal: palavras como "error"/"erro", "failed"/"falhou" e "warning"/"aviso" ficam coloridas automaticamente, mesmo em comandos que não colorem a própria saída. Pode ser desligado em Preferências.

**Da 1.6.1 (correções):**
- **RDP travando sem tela e sem aviso:** o controle exigia que o certificado do servidor fosse validado por uma autoridade confiável (`AuthenticationLevel = 1`); como a maioria dos servidores domésticos/administrativos usa certificado autoassinado, a conexão nunca prosseguia e nada era avisado. Agora tenta autenticar mas permite prosseguir (`AuthenticationLevel = 2`, igual ao mstsc padrão), e um monitor de conexão avisa com uma mensagem clara (e encerra a aba) se a conexão falhar ou expirar em vez de ficar travada.
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
