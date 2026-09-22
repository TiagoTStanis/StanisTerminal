# Validação da versão 1.1.0

Ambiente: Windows x64 desta máquina. Os testes de conexão usam servidores temporários em `127.0.0.1`; nenhum servidor da empresa é acessado.

## Testes automatizados

- Regras: portas e perfis, preservação de arquivo ao renomear, limite e recusa de binários no editor, perfis X11, ausência de senha nos perfis, negociação Telnet, proteção de caminhos e servidor HTTP restrito a leitura.
- Interface: abertura, PowerShell real com leitura e escrita, abas, painéis divididos, arquivos locais, perfil salvo, preferências, comandos rápidos, temas e isolamento do processo de interface.
- Conexões: autenticação SSH, senha criptografada vinculada ao destino/usuário, bloqueio de chave alterada, SFTP e FTP (listar, enviar e baixar), edição SFTP, túnel SSH com tráfego real e encerramento, Telnet e VNC com framebuffer visível.
- Componentes Windows: inicialização do controle RDP oficial; servidor X11 incorporado com consulta autenticada pelo `xwininfo`.

Os scripts estão em `tests/`. O fechamento dos aplicativos de teste encerra as sessões e servidores. A configuração do laboratório usa pasta temporária e não altera os perfis do usuário.

## Novidades da 1.1.0: o que foi testado

- Servidores TFTP, FTP e SFTP locais (limites de pasta, recusa de escrita por padrão), SOCKS5, fila de transferência de pastas e espelho local → servidor (nunca apaga; não sobrescreve arquivo mais novo).
- Scripts Lua em sandbox (sem arquivos, rede ou sistema; limite de instruções e memória) e execução no PowerShell real.
- Login por agente SSH com um agente de teste que fala o protocolo OpenSSH sobre pipe nomeado.
- Instalador de ferramentas verificadas: hash, tamanho, HTTPS, redirecionamento e assinatura digital; BusyBox e TightVNC baixados pela lista fixa, com verificação real. Servidor VNC autenticado por RFB, preso a 127.0.0.1, com senha opcional e limpeza do registro.
- Cofre de senhas (RDP/SSH) com o DPAPI real do Windows; escopo por servidor e usuário; nada em texto puro no disco.
- Pastas e subpastas de sessões (criar, arrastar, renomear, excluir), conexão rápida, listas de pacotes e a tela de Pacotes na interface real.
- Pacotes: leitura da saída real do winget (busca, instalados e atualizações) e validação de identificadores; instalação, atualização e remoção testadas com o processo simulado.

Rode `pnpm test`, `pnpm test:ui`, `pnpm test:extras`, `pnpm test:organize`, `pnpm test:connections` e `pnpm test:vault`. O teste real do VNC baixa o instalador e só roda com `STANIS_TEST_NETWORK=1`.

## Não verificado nesta máquina

- Instalar, atualizar e remover programas de verdade pelo winget: instaladores podem pedir a confirmação do Windows (UAC), que o aplicativo não controla.
- Conexão RDP real com senha guardada (não há servidor RDP aqui; o controle inicializa e o cofre foi testado).
- Agente SSH real do Windows (o serviço `ssh-agent` está desativado nesta máquina) e painel SFTP que segue o terminal com uma sessão SSH real.
- Abrir o shell BusyBox pela interface, e iniciar o servidor VNC pelo botão da interface (o caminho de código foi testado).

## O que depende do seu ambiente

- Login RDP completo em um servidor com certificado válido.
- Equipamento serial físico e driver correspondente.
- Git Bash e distribuição WSL instalada.
- FTPS com certificado TLS e particularidades do servidor FTP de destino.
- Encaminhamento de um aplicativo X11 instalado no Linux e servidor XDMCP real.
- Regras de VPN, firewall, domínio, gateway e autenticação específicas de cada servidor.

Não são afirmadas compatibilidade universal, paridade com MobaXterm/WindTerm ou validação em outra máquina. Consulte o registro de entrega ao lado do executável para os comandos executados e seus resultados nesta versão.
