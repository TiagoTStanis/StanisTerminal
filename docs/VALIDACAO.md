# Validação da versão 1.4.0

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

## Novidades da 1.2.0: o que foi testado

- Ambiente Unix completo (MSYS2 + pacman) instalado sob demanda com hash e assinatura GPG conferidos; teste real de ponta a ponta pela interface: instalar o ambiente, buscar e instalar um pacote (`tree`) pela tela de Pacotes, e usá-lo no shell Unix.
- Abas separadas na tela de Pacotes para Windows (winget) e Unix (MSYS2), cada uma com busca, instalados, atualizações e listas.
- Release assinado com GPG (chave dedicada); veja `docs/VERIFICAR-ASSINATURA.md`.

## Novidades da 1.3.0: o que foi testado

- Links clicáveis no terminal (addon oficial do xterm.js), com confirmação antes de abrir no navegador padrão; só http/https.
- Proxy SOCKS5 de saída para a conexão SSH: teste real com um servidor SOCKS5 e um servidor SSH, provando que o tráfego passa pelo proxy.
- Varredura de portas (TCP connect) e Wake-on-LAN: testados contra um servidor TCP real e conferindo a estrutura exata do pacote mágico UDP.
- Importar sessões do `~/.ssh/config` (Host, HostName, User, Port, IdentityFile, ProxyJump): testado com arquivo real, incluindo resolução do ProxyJump e limite de tamanho. A leitura do PuTTY (registro do Windows) foi testada apenas quanto a não quebrar quando não há sessões salvas (não havia PuTTY instalado nesta máquina).
- Reabrir sessões ao iniciar (opcional) e senha mestra com bloqueio automático: testados de ponta a ponta pela interface real, incluindo reinício completo do processo do aplicativo, tentativa de senha errada, Escape não contornando o bloqueio, e remoção da senha exigindo a senha atual.

## Novidades da 1.4.0: o que foi testado

- Transferência ZMODEM (`rz`/`sz`) sobre um canal SSH dedicado (`client.exec`), independente do terminal interativo — o canal do `ssh2` é binário de ponta a ponta, então não passa pelo `StringDecoder` UTF-8 que corromperia dados binários.
- Teste de interoperabilidade: um servidor SSH real cuja contraparte fala ZMODEM com a própria biblioteca `zmodem.js` (papéis de `rz` e `sz`), provando que a implementação troca cabeçalhos e dados corretamente com uma implementação real e independente da nossa integração.
- Teste de ponta a ponta pela interface real: sessão SSH real, clique nos botões "Enviar por ZMODEM" e "Baixar por ZMODEM", com os diálogos nativos de arquivo substituídos apenas no processo de teste; conteúdo binário (30–70 KB, aleatório) conferido byte a byte nos dois sentidos.
- Proteções testadas: recusa de sobrescrever arquivo existente no destino, nome de arquivo remoto com travessia de caminho (`../../`) contido na pasta de destino, limite de 2 GiB por transferência, e erro claro quando o comando remoto não fala ZMODEM (em vez de travar).

Rode `pnpm test:zmodem` para o teste de ponta a ponta (não precisa de rede; usa um servidor SSH local).

## Não verificado nesta máquina

- Instalar, atualizar e remover programas de verdade pelo winget: instaladores podem pedir a confirmação do Windows (UAC), que o aplicativo não controla. (O pacman do MSYS2 foi testado de ponta a ponta e não pede UAC.)
- Conexão RDP real com senha guardada (não há servidor RDP aqui; o controle inicializa e o cofre foi testado).
- Agente SSH real do Windows (o serviço `ssh-agent` está desativado nesta máquina) e painel SFTP que segue o terminal com uma sessão SSH real.
- Importação real de sessões do PuTTY (não havia PuTTY instalado nesta máquina para gerar dados reais).
- Encaminhamento do agente SSH (`agentForward`) contra um servidor real que o utilize.
- Abrir o shell BusyBox pela interface, e iniciar o servidor VNC pelo botão da interface (o caminho de código foi testado).

## O que depende do seu ambiente

- Login RDP completo em um servidor com certificado válido.
- Equipamento serial físico e driver correspondente.
- Git Bash e distribuição WSL instalada.
- FTPS com certificado TLS e particularidades do servidor FTP de destino.
- Encaminhamento de um aplicativo X11 instalado no Linux e servidor XDMCP real.
- Regras de VPN, firewall, domínio, gateway e autenticação específicas de cada servidor.

Não são afirmadas compatibilidade universal, paridade com MobaXterm/WindTerm ou validação em outra máquina. Consulte o registro de entrega ao lado do executável para os comandos executados e seus resultados nesta versão.
