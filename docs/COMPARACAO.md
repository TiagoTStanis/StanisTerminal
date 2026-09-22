# Comparação: Stanis Terminal × MobaXterm × WindTerm

Fontes consultadas em setembro de 2026: página de recursos e documentação do MobaXterm (mobaxterm.mobatek.net) e README do WindTerm (github.com/kingToolbox/WindTerm). A coluna do Stanis Terminal descreve o que foi **testado** neste repositório.

Legenda: ✅ tem · 🟡 parcial · ❌ não tem · ➖ não se aplica · **?** a fonte consultada não menciona (não afirmo nem nego)

## Protocolos e conexões

| Recurso | Stanis | MobaXterm | WindTerm |
|---|---|---|---|
| SSH (senha, chave, keyboard-interactive) | ✅ | ✅ | ✅ |
| SSH gateway / ProxyJump | ✅ | ✅ | ✅ |
| Agente SSH | ✅ (agente do Windows) | ? | ✅ |
| Encaminhamento do agente | 🟡 (opção existe; sem teste contra servidor real) | ? | ✅ |
| Proxy SOCKS/HTTP para conectar | ✅ (SOCKS5, testado) | ✅ (SOCKS) | ✅ (HTTP, SOCKS5) |
| ProxyCommand | ❌ (decisão deliberada: risco de execução arbitrária; o SOCKS5 cobre o caso comum) | ? | ✅ |
| Telnet | ✅ | ✅ | ✅ |
| Rlogin / Rsh | ✅ (sem teste contra servidor real) | ✅ | ? |
| Serial | 🟡 (8N1; sem paridade/fluxo) | ✅ | ✅ |
| RDP | ✅ (senha guardada; sem teste em servidor real) | ✅ | ❌ |
| VNC | ✅ (cliente noVNC + servidor TightVNC) | ✅ | ❌ |
| XDMCP / servidor X11 | ✅ (VcXsrv) | ✅ | 🟡 (só X11 forwarding) |
| FTP / FTPS / SFTP | ✅ | ✅ | SFTP |
| SCP | ❌ (decisão: SFTP já cobre o caso de uso) | ✅ | ✅ |
| ZMODEM (rz/sz) | ✅ (canal SSH dedicado; testado com servidor real) | ? | ✅ |
| XMODEM / YMODEM | ❌ | ? | ✅ |
| Túneis local / remoto / dinâmico | ✅ | ✅ | ✅ |
| tmux integrado | ❌ | ? | ✅ |

## Terminal e produtividade

| Recurso | Stanis | MobaXterm | WindTerm |
|---|---|---|---|
| Abas, painéis divididos, busca | ✅ | ✅ | ✅ |
| Digitar em vários painéis | ✅ | ✅ (MultiExec) | ✅ (Sync Input) |
| Macros | ✅ | ✅ | ? |
| Scripts | ✅ (Lua em sandbox) | ? | ? |
| Autocompletar / histórico | 🟡 (sugestões do histórico) | 🟡 (Ctrl+R) | ✅ |
| Paleta de comandos | ❌ | ? | ✅ |
| Realce de palavras-chave | ❌ | ✅ | ? |
| Links clicáveis | ✅ (com confirmação antes de abrir) | ✅ (Ctrl+clique) | ? |
| Unicode 13 / emoji | 🟡 | ? | ✅ |
| Restaurar sessões ao abrir | ✅ (opcional; testado com reinício real do app) | ? | ✅ |
| Temas / cores | ✅ (6 temas) | ? | ✅ |

## Arquivos, servidores e ferramentas

| Recurso | Stanis | MobaXterm | WindTerm |
|---|---|---|---|
| Navegador SFTP com arrastar e soltar | ✅ | ✅ | ✅ |
| Painel de arquivos que segue o `cd` | 🟡 (via OSC 7; sem teste com SSH real) | ? | ? |
| Transferência de pastas com fila | ✅ | ? | ? |
| Editor de texto remoto | ✅ (UTF-8, até 2 MiB) | ✅ | ? |
| Servidores locais (HTTP/TFTP/FTP/SFTP/VNC) | ✅ (só 127.0.0.1) | ✅ | ❌ |
| Ambiente Unix + gerenciador de pacotes | ✅ (MSYS2 + pacman, testado de ponta a ponta) | ✅ (MobApt) | ❌ |
| Pacotes do Windows (winget) + listas | ✅ | ❌ | ❌ |
| Ferramentas de rede (ping, DNS, traceroute, TCP) | ✅ | ✅ | ? |
| Varredura de portas | ✅ (TCP connect) | ✅ | ? |
| Wake-on-LAN | ✅ | ✅ | ? |
| Gerador de chaves | 🟡 (RSA 3072) | ✅ (MobaKeyGen) | ? |

## Sessões e segurança

| Recurso | Stanis | MobaXterm | WindTerm |
|---|---|---|---|
| Pastas e subpastas de sessões | ✅ | ✅ (barra lateral) | ✅ |
| Sincronização de sessões | 🟡 (por pasta, manual) | ? | ? |
| Importar de PuTTY / `~/.ssh/config` | ✅ (`~/.ssh/config` testado; PuTTY sem dados reais para testar) | ? | ? |
| Senha mestra / bloqueio de tela | ✅ (senha mestra + bloqueio automático, testado) | ✅ (senha mestra) | ✅ (bloqueio de tela) |
| Assinatura de editor no executável | ❌ (assinatura GPG do release) | ? | ? |
| Telemetria / conta / nuvem | Nenhuma | ? | ? |
| Licença | MIT (código aberto) | Gratuito + Professional | Gratuito; parte do código aberto |

## Onde o Stanis já é melhor
- Código totalmente aberto (MIT), sem edição paga.
- Gerenciador de pacotes do Windows (winget) com listas salvas, exportáveis e importáveis; nenhum dos dois documenta algo equivalente.
- Scripts em Lua com sandbox e limites de instrução e memória.
- Verificação por hash e assinatura de tudo o que baixa (BusyBox, TightVNC, MSYS2).
- Servidores locais presos a 127.0.0.1 e somente leitura por padrão.
- Ambiente Unix completo (MSYS2 + pacman) e gerenciador do Windows (winget) na mesma tela de Pacotes.

## Onde ainda perde
- **Maturidade:** ambos têm anos de uso; este projeto é novo e vários caminhos ainda não foram testados contra servidores reais (RDP, agente SSH, painel que segue o terminal).
- **Executável sem assinatura de editor** (o SmartScreen avisa; o release tem assinatura GPG).
- Lacunas marcadas ❌ e 🟡 acima, tratadas em `docs/PLANO.md`.
