# Stanis Terminal

Um terminal para organizar as conexões do dia a dia no Windows. Abra o PowerShell, conecte aos servidores e transfira arquivos sem ficar alternando entre vários programas.

O projeto se inspira no uso de sessões do MobaXterm e do WindTerm. É um aplicativo independente, sem vínculo com esses produtos, sem serviços de IA e sem conta obrigatória.

## Para usar

Baixe **StanisTerminal-1.1.0-win-x64.exe** na página de [Releases](https://github.com/TiagoTStanis/StanisTerminal/releases) e abra. Ele extrai os componentes antes de iniciar e demora um pouco mais na primeira vez. Não precisa instalar Node.js, Python ou Electron. Use Windows 10/11 de 64 bits e uma pasta em que você possa salvar arquivos, como Documentos. Confira o SHA-256 informado na página do release.

1. Clique em **Abrir PowerShell** para trabalhar neste computador.
2. Para acessar um servidor, clique em **Nova sessão**, escolha o protocolo e preencha nome, endereço e usuário. Salve e clique no perfil na barra lateral.
3. Em uma conexão SSH, abra **Arquivos → SFTP** para ver os arquivos do servidor. O botão **Enviar** escolhe um arquivo local; a seta ao lado de um arquivo remoto faz o download.
4. Use **Dividir** para trabalhar com até quatro painéis visíveis. É possível manter até 24 sessões abertas.

O [manual de uso](docs/LEIA-ME.md) explica backups, X11, atalhos e mensagens comuns. Os [resultados de validação](docs/VALIDACAO.md) separam o que foi testado das conexões que dependem do seu ambiente.

## Recursos

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
- Digitar em todos os painéis visíveis, macros gravadas e reproduzidas, histórico de comandos com sugestões (Ctrl+Espaço) e busca (Ctrl+Shift+H). Senhas digitadas nunca entram no histórico nem nas macros.
- Temas Escuro, Claro, Dracula, Nord, Solarized e Monokai; sincronização de sessões, comandos e macros por uma pasta sua (OneDrive, Dropbox, repositório Git). Senhas nunca são sincronizadas.
- Scripts em Lua (VM local, sem acesso a arquivos, rede ou sistema; com limite de instruções e memória): `send`, `sendln`, `wait`, `expect`, `log`.
- Login SSH pelo agente do Windows (OpenSSH ou Pageant): a chave privada nunca passa pelo aplicativo.
- Painel SFTP que acompanha a pasta do terminal (OSC 7) e espelho contínuo local → servidor (nunca apaga nem sobrescreve arquivo mais novo).
- Ferramentas verificadas: o BusyBox (grep, awk, sed, tar, vi…) é baixado só depois da sua confirmação, de uma origem oficial fixa, por HTTPS, com SHA-256 conferido; arquivo diferente do esperado é descartado. Nenhum dado seu vai na requisição. Ele aparece como um shell local “BusyBox (Unix)”.
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
| `pnpm test:connections` | Testar conexões em servidores locais descartáveis |
| `pnpm test:portable` | Conferir abertura e PowerShell no lançador de arquivo único |
| `pnpm build` | Gerar o executável portátil em `dist` |

Para testar a distribuição extraída, defina `STANIS_TEST_EXE` com o caminho completo de `dist/win-unpacked/Stanis Terminal.exe` antes de rodar os testes de interface e conexões. Os testes usam uma pasta temporária de dados, separada dos seus perfis.

O servidor X11 fica em `vendor/vcxsrv` e deve acompanhar o código para que o build tenha os mesmos recursos. Veja a origem e as licenças em [componentes de terceiros](docs/TERCEIROS.md). O diretório `vendor/7zip` é apenas uma ferramenta de preparação anterior; não é necessário para usar o aplicativo.

## Organização

`src/main.cjs` recebe as ações da interface; `sessions.cjs` gerencia terminais; `ssh.cjs` autentica e verifica chaves; `files.cjs` cuida dos arquivos; `network.cjs` mantém diagnósticos e túneis; `graphics.cjs` gerencia as sessões gráficas. A interface editável está em `src/ui/renderer.js`; `app.js` é gerado pelo build.

## Limites

Pacotes cobrem o Windows (winget); não há gerenciador de pacotes Unix (apt/pacman) dentro do app, só a lista fixa de “Ferramentas verificadas”. Não há API de plugins além dos scripts Lua. A sincronização de configurações é manual, por botão. O editor é para texto UTF-8 de até 2 MiB.

O executável não tem assinatura digital de editor. A primeira abertura pode ser sinalizada pelo Windows. A entrega inclui um SHA-256 para conferir se o arquivo foi alterado.
