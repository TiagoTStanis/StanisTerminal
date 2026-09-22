# Comece por aqui

Para abrir mais rápido, use **Stanis Terminal.exe** na pasta **StanisTerminal** da entrega, ou o atalho na Área de Trabalho. Essa pasta já contém todos os componentes; mantenha os arquivos juntos.

Também há a versão de arquivo único **StanisTerminal-1.2.0-win-x64.exe**. Ela extrai os componentes antes de abrir e pode levar cerca de um minuto nesta máquina. Deixe o programa em uma pasta sua, como Documentos, com espaço livre e permissão de escrita.

## Minha primeira conexão

Em **Nova sessão**, dê um nome fácil de reconhecer, como “Laboratório Linux”. Escolha SSH, preencha o endereço e o usuário e salve. Clique no perfil para conectar. A senha é pedida nesse momento.

Na primeira conexão SSH aparece a impressão digital da chave do servidor. Compare com a chave informada pelo administrador antes de confiar. Nas próximas conexões, o programa verifica a chave salva. Se ela mudar, a conexão será bloqueada até você esclarecer a mudança.

Uma chave privada pode ser escolhida pelo caminho completo no perfil. A frase secreta é solicitada na conexão. Para usar um servidor de entrada, salve primeiro o perfil dele e depois escolha esse perfil em **Gateway SSH**.

## Terminais e arquivos

- **Ctrl + Shift + T:** abrir outro PowerShell.
- **Ctrl + Shift + F:** buscar texto na saída do terminal.
- **Ctrl + Shift + C / V:** copiar seleção ou colar.
- **Ctrl + Shift + W:** fechar a aba atual.
- **Dividir:** mostrar até quatro sessões lado a lado.
- **Gravar saída:** escolher um arquivo de log; clique novamente para parar.

Colagens com várias linhas pedem revisão, pois uma quebra de linha pode executar um comando. A multiexecução só envia o comando às sessões que você marcar.

Em **Arquivos**, escolha **Local** para este computador ou **SFTP** para a aba SSH selecionada. Clique em uma pasta para entrar ou em um texto para editar. O menu **⋯** permite renomear e excluir; pastas só são excluídas quando estão vazias. O programa pede confirmação antes de excluir ou substituir um arquivo remoto no envio.

Para FTP/FTPS, informe o servidor em **FTP/S**. Mantenha TLS marcado se o servidor aceitar FTPS explícito. Para editar um arquivo FTP, baixe-o e envie a versão revisada.

## Aplicativos gráficos Linux

1. Salve e abra uma sessão do tipo **Servidor X11 local**.
2. Salve outra sessão do tipo **SSH com aplicativos X11**, informando o servidor Linux e o usuário.
3. Conecte e execute o aplicativo gráfico instalado no Linux. A janela aparece na aba X11; use **Dividir** para ver o terminal e a janela juntos.

O servidor SSH precisa permitir encaminhamento X11 e ter `xauth` disponível. O X11 local usa um cookie de autenticação temporário, removido ao encerrar a sessão. Não desative o controle de acesso com `xhost +`. O servidor X pode escutar conexões TCP na porta do display (6030–6059); mantenha a proteção do firewall. O encaminhamento usa apenas o destino local pelo SSH.

**XDMCP** é separado: use somente com um servidor de login gráfico já configurado e uma rede confiável. Não há criptografia do desktop nesse protocolo.

## Área de trabalho remota

RDP usa o cliente nativo do Windows dentro da aba. Prefira o nome DNS presente no certificado do servidor; certificados não confiáveis ou nomes diferentes são recusados. Não é preciso desativar essa verificação para usar os outros recursos.

VNC solicita as credenciais que o servidor exigir. O suporte a métodos de autenticação depende do noVNC incluído. A opção mais segura para servidores sem transporte protegido é encaminhar a porta por um túnel SSH e conectar em `127.0.0.1`.

## Backup e troca de computador

Feche o programa e copie o executável e a pasta **StanisTerminal-data** juntos. Nela ficam `config.json` (perfis, preferências e comandos), `known-hosts.json` (chaves SSH conhecidas) e `credentials.json` (senhas SSH criptografadas, se você pediu para lembrar).

As senhas guardadas dependem da conta Windows que as criptografou; em outro computador, digite novamente. As chaves privadas e os logs ficam no caminho escolhido por você e precisam de backup separado.

**Ferramentas → Exportar sessões** salva um JSON sem as credenciais. A importação atual recupera os perfis de sessão; para restaurar também preferências e comandos, use o backup completo da pasta de dados.

## Quando algo não conectar

| Mensagem ou situação | O que conferir |
| --- | --- |
| Componente não instalado | Git Bash ou WSL precisa ser instalado separadamente; PowerShell e CMD vêm com o Windows |
| Connection refused / conexão recusada | Endereço, porta e serviço de destino |
| Tempo limite | VPN, rota, firewall e disponibilidade do servidor |
| Authentication failed / falha na autenticação | Usuário, senha, chave e permissões no servidor |
| A chave do servidor mudou | Confirme a mudança com o administrador; só então remova a entrada correspondente em `known-hosts.json`, com o programa fechado |
| Arquivo não encontrado | Caminho atual, permissão e existência do arquivo |
| X11 não inicializa | Consulte `x11.log` na pasta de dados e confira se os componentes acompanham o aplicativo |
| Configuração não pode ser lida | Feche o aplicativo, preserve uma cópia de `config.json` e restaure seu backup; renomear o arquivo permite começar uma configuração nova |

Use **Ferramentas → Teste TCP** para distinguir porta inacessível de um problema de autenticação. Em conexão serial, confira a porta COM e a velocidade do equipamento; esta versão usa 8 bits, sem paridade e 1 bit de parada.

Para acompanhar o que realmente foi verificado nesta entrega, consulte `VALIDACAO.md`. Um teste local aprovado não comprova acesso a servidores da sua empresa.
