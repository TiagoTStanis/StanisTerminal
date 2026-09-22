# Plano: fechar as lacunas de `docs/COMPARACAO.md`

Ordem sugerida, do mais simples ao mais trabalhoso. Cada item cita o pacote pronto quando existe um.

1. **Autocompletar/histórico melhor e paleta de comandos** — evoluir o que já existe em `src/ui/extras.js`.
2. **Links clicáveis no terminal** — addon oficial `@xterm/addon-web-links` (MIT), já mantido pelo mesmo projeto do xterm.js que o app usa.
3. **Realce de palavras-chave na saída** — regras simples sobre o texto renderizado; não exige pacote novo.
4. **Restaurar sessões/abas ao abrir** — guardar quais abas estavam abertas e reabri-las; usa a infraestrutura já existente.
5. **X/Y/ZMODEM** — pacote `zmodem.js` (Apache-2.0) integra ao xterm.js; roda por cima da sessão SSH/serial já existente.
6. **Proxy SOCKS5/HTTP para a própria conexão SSH** (diferente do túnel de saída que já existe) — pacote `socks` (MIT) cobre o cliente.
7. **SCP** — o `ssh2` já usado tem suporte a exec; ou reaproveitar SFTP como o app já faz e destacar isso em vez de reimplementar.
8. **Varredura de portas e Wake-on-LAN** — pacotes simples (`Nmap`-like scan de TCP já dá para montar com `net`; WoL é um pacote UDP simples). Não depende de binário externo.
9. **Senha mestra / bloqueio de tela** — trava a interface com uma senha antes de mostrar sessões; guarda o hash com o DPAPI já usado no cofre.
10. **Importar sessões do PuTTY/`~/.ssh/config`** — leitura de arquivo, sem pacote externo.
11. **Encaminhamento do agente SSH e ProxyCommand controlado** — ProxyCommand exige cuidado (é execução de comando arbitrário); avaliar antes de implementar.
12. **Assinatura Authenticode do `.exe`** — pedir ao SignPath Foundation (gratuito para código aberto), depois que o repositório tiver alguma tração/histórico, conforme os termos deles.
13. **Testes reais que faltam** — RDP contra um servidor real, agente SSH real do Windows, painel SFTP seguindo uma sessão SSH real.

Este arquivo é o rastreamento; ele deve ser atualizado à medida que cada item avançar.
