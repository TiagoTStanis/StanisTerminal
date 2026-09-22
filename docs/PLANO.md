# Plano: fechar as lacunas de `docs/COMPARACAO.md`

## Feito na 1.2.0 / 1.3.0
1. ~~Autocompletar/histórico~~ — já existia (sugestões do histórico).
2. **Links clicáveis** — `@xterm/addon-web-links` (MIT), com confirmação antes de abrir no navegador. Feito e testado.
5. ~~X/Y/ZMODEM~~ — avaliado e **adiado por motivo técnico**, veja abaixo.
6. **Proxy SOCKS5 para a própria conexão SSH** — pacote `socks` (MIT). Feito e testado com servidor SOCKS5 + SSH reais.
8. **Varredura de portas e Wake-on-LAN** — feito e testado (TCP connect scan; pacote mágico UDP).
9. **Senha mestra / bloqueio de tela** — feito e testado de ponta a ponta (scrypt local, bloqueio automático por tempo ocioso, sem depender de recarregar a página).
10. **Importar sessões do PuTTY e do `~/.ssh/config`** — feito; `~/.ssh/config` testado com arquivo real, PuTTY só testado quanto a não quebrar (sem PuTTY instalado aqui).
11. **Encaminhamento do agente SSH** — opção adicionada (`agentForward`); sem teste contra servidor real que o utilize.
- **Ambiente Unix completo com pacman** (MSYS2) — feito na 1.2.0, testado de ponta a ponta.

## Adiado, com o motivo

- **X/Y/ZMODEM (`zmodem.js`)**: exigiria um canal de dados binário seguro entre o processo principal e a interface. Hoje esse canal (`terminal:data`, SSH/serial → interface) passa por `StringDecoder('utf8')` e por IPC como texto JavaScript; qualquer sequência ZMODEM que não seja UTF-8 válido seria corrompida antes de chegar à interface. Implementar direito exige um canal paralelo binário (por exemplo, `ArrayBuffer` por IPC ou uma codificação base64 dedicada) para todos os tipos de sessão que usam esse caminho (SSH, serial, Telnet, Rlogin/Rsh), o que é uma mudança de arquitetura, não um recurso isolado. Registrado aqui para uma versão futura dedicada a isso.
- **ProxyCommand (WindTerm/OpenSSH)**: deliberadamente não implementado. É execução de um comando arbitrário definido no perfil; abrir essa porta contradiz o modelo de segurança do app (nenhuma execução de processo local a partir de um campo de configuração). O proxy SOCKS5 cobre o caso de uso mais comum (conectar através de um proxy) sem esse risco.
- **SCP**: não implementado como protocolo separado porque o SFTP (já suportado) cobre o mesmo caso de uso com mais recursos (listagem, edição). Documentado como decisão, não como lacuna.

## Ainda falta

- **Assinatura Authenticode do `.exe`** — pendente de um certificado de assinatura de código. A candidatura ao SignPath Foundation (gratuito para código aberto) ficou preenchida mas não enviada, aguardando o projeto ganhar algum histórico de uso. A obtenção do certificado (do SignPath, comprado, ou um da própria máquina) fica a critério do Tiago; o passo a passo de como usá-lo depois de tê-lo em mãos (gerar/exportar se for local, ligar ao `electron-builder`, assinar o `.exe`) já está documentado em [`docs/ASSINATURA-AUTHENTICODE.md`](ASSINATURA-AUTHENTICODE.md). Ver `docs/VERIFICAR-ASSINATURA.md` para a assinatura GPG já existente, que é diferente disso (não substitui o Authenticode).
- **Testes reais que exigem infraestrutura que não há nesta máquina**: RDP contra um servidor real, agente SSH real do Windows (o serviço está desativado aqui), encaminhamento de agente contra servidor real, painel SFTP seguindo uma sessão SSH real, importação real de sessões do PuTTY.
- Realce de palavras-chave na saída do terminal — baixo valor percebido frente ao esforço (teria que lidar com decorações do xterm.js linha a linha); não priorizado.
- Restaurar layout de divisão de painéis junto com as sessões (hoje restaura as sessões, mas não se estavam divididas) — pequeno, pode entrar numa próxima versão.
