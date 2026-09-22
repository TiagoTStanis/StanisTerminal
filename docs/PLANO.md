# Plano: fechar as lacunas de `docs/COMPARACAO.md`

## Feito na 1.4.0

5. **X/Y/ZMODEM** — feito, com uma solução diferente da originalmente cogitada (ver histórico abaixo): em vez de mexer no canal de dados do terminal interativo, a transferência roda sobre um **canal SSH separado** (`client.exec` de `rz`/`sz`), que já é binário de ponta a ponta. Testado com um servidor SSH real e interoperabilidade confirmada contra a própria `zmodem.js` fazendo o papel do outro lado, além de teste completo pela interface (enviar e baixar, conteúdo binário íntegro).

## Feito na 1.2.0 / 1.3.0
1. ~~Autocompletar/histórico~~ — já existia (sugestões do histórico).
2. **Links clicáveis** — `@xterm/addon-web-links` (MIT), com confirmação antes de abrir no navegador. Feito e testado.
6. **Proxy SOCKS5 para a própria conexão SSH** — pacote `socks` (MIT). Feito e testado com servidor SOCKS5 + SSH reais.
8. **Varredura de portas e Wake-on-LAN** — feito e testado (TCP connect scan; pacote mágico UDP).
9. **Senha mestra / bloqueio de tela** — feito e testado de ponta a ponta (scrypt local, bloqueio automático por tempo ocioso, sem depender de recarregar a página).
10. **Importar sessões do PuTTY e do `~/.ssh/config`** — feito; `~/.ssh/config` testado com arquivo real, PuTTY só testado quanto a não quebrar (sem PuTTY instalado aqui).
11. **Encaminhamento do agente SSH** — opção adicionada (`agentForward`); sem teste contra servidor real que o utilize.
- **Ambiente Unix completo com pacman** (MSYS2) — feito na 1.2.0, testado de ponta a ponta.

## Adiado, com o motivo

- **X/Y/ZMODEM pelo próprio terminal interativo**: continua fora de cogitação. O canal `terminal:data` (SSH/serial → interface) passa por `StringDecoder('utf8')` e por IPC como texto JavaScript; qualquer sequência ZMODEM que não seja UTF-8 válido seria corrompida ali. Em vez de refazer esse canal (mudança de arquitetura, arriscada para todos os tipos de sessão), o ZMODEM foi implementado sobre um **canal SSH dedicado** (`src/zmodemio.cjs`), que não tem esse problema porque nunca passa pelo `StringDecoder`. Essa via só funciona para sessões SSH — Telnet, serial e Rlogin/Rsh continuam sem ZMODEM, porque são um único fluxo sem como abrir um segundo canal.
- **ProxyCommand (WindTerm/OpenSSH)**: deliberadamente não implementado. É execução de um comando arbitrário definido no perfil; abrir essa porta contradiz o modelo de segurança do app (nenhuma execução de processo local a partir de um campo de configuração). O proxy SOCKS5 cobre o caso de uso mais comum (conectar através de um proxy) sem esse risco.
- **SCP**: não implementado como protocolo separado porque o SFTP (já suportado) cobre o mesmo caso de uso com mais recursos (listagem, edição). Documentado como decisão, não como lacuna.

## Ainda falta

- **Assinatura Authenticode do `.exe`** — pendente de um certificado de assinatura de código. A candidatura ao SignPath Foundation (gratuito para código aberto) ficou preenchida mas não enviada, aguardando o projeto ganhar algum histórico de uso. A obtenção do certificado (do SignPath, comprado, ou um da própria máquina) fica a critério do Tiago; o passo a passo de como usá-lo depois de tê-lo em mãos (gerar/exportar se for local, ligar ao `electron-builder`, assinar o `.exe`) já está documentado em [`docs/ASSINATURA-AUTHENTICODE.md`](ASSINATURA-AUTHENTICODE.md). Ver `docs/VERIFICAR-ASSINATURA.md` para a assinatura GPG já existente, que é diferente disso (não substitui o Authenticode).
- **Testes reais que exigem infraestrutura que não há nesta máquina**: RDP contra um servidor real, agente SSH real do Windows (o serviço está desativado aqui), encaminhamento de agente contra servidor real, painel SFTP seguindo uma sessão SSH real, importação real de sessões do PuTTY.
- Realce de palavras-chave na saída do terminal — baixo valor percebido frente ao esforço (teria que lidar com decorações do xterm.js linha a linha); não priorizado.
- Restaurar layout de divisão de painéis junto com as sessões (hoje restaura as sessões, mas não se estavam divididas) — pequeno, pode entrar numa próxima versão.
