# Stanis Terminal

Um terminal para organizar as conexões do dia a dia no Windows. Abra o PowerShell, conecte aos servidores e transfira arquivos sem ficar alternando entre vários programas.

O projeto se inspira no uso de sessões do MobaXterm e do WindTerm. É um aplicativo independente, sem vínculo com esses produtos, sem serviços de IA e sem conta obrigatória.

## Para usar

Para abrir rapidamente, use a distribuição em pasta: extraia **StanisTerminal-1.18.2-win-x64.zip** uma vez para uma pasta local e abra **Stanis Terminal.exe** dentro dela. Mantenha os arquivos juntos; crie um atalho para esse executável. O comando `pnpm build:zip` gera esse pacote em `dist`.

**Evite a versão de arquivo único** (`StanisTerminal-*-win-x64-PORTATIL-LENTO-usar-o-zip.exe`): ela extrai os componentes a cada execução — não só na primeira — e pode levar mais de um minuto toda vez que você abrir. Use-a apenas para testar rapidamente em um computador onde você não vai instalar nada; para uso do dia a dia, use sempre o ZIP extraído. Não precisa instalar Node.js, Python ou Electron em nenhuma das distribuições. Use Windows 10/11 de 64 bits e uma pasta em que você possa salvar arquivos, como Documentos. Consulte os arquivos já publicados em [Releases](https://github.com/TiagoTStanis/StanisTerminal/releases); gerar um pacote local não o publica automaticamente. Para arquivos publicados, confira o SHA-256 e a assinatura GPG do release (veja [como verificar](docs/VERIFICAR-ASSINATURA.md); impressão digital `A345 44C3 43F2 E16B EF64  C7A4 95A1 3721 ED00 B9E6`).

1. Clique em **Abrir PowerShell** para trabalhar neste computador.
2. Para acessar um servidor, clique em **Nova sessão**, escolha o protocolo e preencha nome, endereço e usuário. Porta, pastas, chave SSH, agente, proxy e gateway ficam em **Avançados**. Salve e clique no perfil na barra lateral.
3. Em uma conexão SSH, abra **Arquivos → SFTP** para ver os arquivos do servidor. O botão **Enviar** escolhe um arquivo local; a seta ao lado de um arquivo remoto faz o download.
4. Use **Dividir** para trabalhar com até quatro painéis visíveis. É possível manter até 24 sessões abertas.

O [manual de uso](docs/LEIA-ME.md) explica backups, X11, atalhos e mensagens comuns. Os [resultados de validação](docs/VALIDACAO.md) separam o que foi testado das conexões que dependem do seu ambiente.

## Recursos

**Novo na 1.18.2 (cores do terminal sempre iguais):** a saída do equipamento chega picotada, e quando uma palavra (ex.: GigabitEthernet1/0/1) ou um código de cor do próprio servidor era cortado entre dois pedaços, a mesma saída saía às vezes colorida, às vezes não, e às vezes com lixo como "[32m" na tela. Agora, como no ChromaTerm, as linhas completas são coloridas na hora e o fim de linha cortado espera o resto (no máximo 100 ms) antes de colorir, inclusive em serial e Telnet lentos. O eco do que se digita continua saindo na hora. Nos testes, a mesma saída picotada de 1 a 300 bytes sai idêntica à saída inteira.

**Na 1.18.1 (colar confiável em equipamentos, janela separada):** colar em SSH, Telnet ou serial agora manda o texto linha por linha, com uma pequena pausa, como o SecureCRT e o PuTTY. Switches e roteadores têm buffer de entrada pequeno e descartavam caracteres ou linhas quando o texto chegava de uma vez: num teste com 80 linhas, antes chegavam 9 inteiras e agora chegam as 80. Copiar e colar no terminal usam o mesmo caminho, em ordem, e o que se digita durante a colagem espera e entra depois. Com texto selecionado, o clique direito copia e avisa "Copiado". Num terminal em janela separada, a confirmação de várias linhas aparece na própria janela. Na janela separada, a barra da sessão (lupa, tela cheia, colar, arquivos) aparece com o mouse no topo; a janela principal avisa quando todas as sessões estão fora e oferece trazê-las de volta; as abas não ficam mais espremidas.

**Na 1.18.0 (aba de Link em janela separada):** a aba de link agora também vai para outra janela ou monitor, pelo botão ⧉ da aba ou arrastando a aba para fora, como as outras sessões. A janela nova continua logada, porque usa o mesmo perfil, e mantém a lupa e o "manter ativa". O menu no topo tem Voltar, Avançar, Recarregar (F5), Zoom, Navegador e "Trazer de volta para o Stanis Terminal". Fechar a janela, o botão ⧈ da aba ou "⧈ Trazer janelas" devolvem a página para a aba, no endereço em que estava.

**Na 1.17.1 (lupa da aba de Link):** sites que viravam "tela de celular" em abas estreitas agora usam o layout de computador. A lupa (🔍) da aba vem em "Automático": se a aba for mais estreita que 1280 px, a página é reduzida para o site enxergar uma tela de 1280 px. Também há "Como uma tela de 1366/1600/1920 px" e zoom fixo de 50% a 150%. Ctrl + roda do mouse e Ctrl +/−/0 dentro da página ajustam o zoom. A escolha fica salva por sessão.

**Na 1.17.0 (sessão Link numa aba, sem deslogar):** a sessão Link abre a página dentro do app, numa aba como as outras, com voltar, avançar, recarregar, o endereço atual e um botão para abrir no navegador externo. Os logins ficam guardados num perfil separado, só dessas páginas. "Manter ativa" vem ligado por padrão, a cada 4 minutos (configurável de 1 a 60): a página recebe um movimento de mouse real e uma requisição silenciosa à própria página com o login atual, o que zera o contador de inatividade da página e do servidor. As páginas não são pausadas quando a aba fica em segundo plano. Para certificado próprio (switch, firewall, iDRAC…), o app pergunta uma vez e lembra a confiança por host e impressão digital; se o certificado mudar, pergunta de novo.

**Na 1.16.0 (janelas separadas, lupa do VNC, sessão Link):** qualquer sessão (terminal, SSH, VNC, RDP) pode ir para uma janela separada, para levar a outro monitor: use o botão ⧉ da aba ou arraste a aba para fora do app. A sessão continua conectada. O botão "⧈ Trazer janelas" na barra devolve todas, e fechar a janela separada também devolve a sessão, sem encerrá-la. No VNC, a lupa (🔍) oferece ajustar à janela, à largura ou à altura, esta última boa para duas telas, e zoom de 50% a 200%; Ctrl + roda do mouse aproxima e afasta. A lupa fica salva por sessão. O novo tipo de sessão "Link" guarda o endereço de uma página de servidor ou equipamento (http/https) e a abre no navegador padrão, com o selo WEB e o status online na lista.

**Na 1.15.0 (teclado do VNC/RDP, tela cheia, prompts coloridos):** no VNC (TightVNC), o Shift deixou de se embaralhar no servidor: antes o "1" podia virar "!" e vice-versa. Para teclas que geram caractere, o app manda só o caractere e o servidor aplica o Shift; teclas em rajada saem com um intervalo mínimo, para o TightVNC não trocar a ordem. Colar do Windows espera o servidor pôr o texto no clipboard remoto antes do V, e voltar para o app já sincroniza o clipboard. No RDP/RemoteApp, o estado do Caps Lock e do Num Lock do teclado local vai para o servidor ao entrar na sessão, como no mstsc: o Caps não fica mais invertido e o teclado numérico funciona. Ao sair da janela, o app solta as teclas que estavam apertadas no servidor. O botão Tela cheia das sessões gráficas voltou a funcionar. No terminal, prompts de switch, roteador e Linux ficam coloridos, com cores que acompanham o tema, e o comando digitado aparece em negrito. As sugestões do histórico foram para o canto superior direito.

**Na 1.14.2 (copiar e colar confiável):** o Ctrl+V falhava de vez em quando porque o texto era lido do clipboard de forma assíncrona e as teclas digitadas logo depois (um Enter, por exemplo) chegavam antes da colagem. No terminal, o Ctrl+V e o Shift+Insert agora usam o colar nativo do Chromium, como o terminal do VS Code com o xterm.js, e o texto entra na ordem das teclas. No VNC e no RDP, o texto é enviado ao servidor primeiro e as teclas digitadas nesse meio esperam numa fila e seguem na ordem. O Shift+Insert também cola no VNC e no RDP. Uma linha única copiada com a quebra no fim cola sem a pergunta de várias linhas, como no Windows Terminal.

**Na 1.14.1 (status online leve):** listas com centenas de sessões não atrasam mais. O teste continua sendo só um toque na porta do serviço, mas agora 64 hosts são testados ao mesmo tempo, com timeout de 1,5 s. Cada selo muda de cor assim que o seu host responde, começando pelas sessões visíveis na lista. O DNS fica em cache e faz no máximo 3 consultas ao mesmo tempo, então não trava o resto do app. Nos testes, 400 hosts levaram menos de 2 s.

**Na 1.14.0 (painel Arquivos segue a sessão):** o painel mostra os arquivos da aba ativa: VNC abre pelo TightVNC, SSH pelo SFTP e RDP pela rede do host, com um botão **Conectar**. As outras abas abrem este computador. O topo mostra "Arquivos de: <sessão> · modo" e permite trocar a origem à mão. Cada sessão lembra a última pasta aberta. O caminho aparece em partes clicáveis; clique no espaço vazio para digitar. Os itens têm ícone, tamanho e data, e baixar, renomear e excluir ficam visíveis em cada linha. Duplo clique abre o arquivo ou baixa, no caso do TightVNC. Há um filtro da pasta. No TightVNC, os envios, os downloads e as pastas inteiras (também arrastadas do Explorer) passam pela fila de transferências, com porcentagem e cancelamento. Na barra da aba, o que não cabe vai para o menu **⋯**, sem barra de rolagem.

**Na 1.13.1 (arquivos do TightVNC):** o erro `TightVNC: Access denied.` agora vem explicado. Quando roda como serviço (o normal em empresas), o TightVNC só libera arquivos com **um usuário logado e a tela desbloqueada** na máquina remota. Não funciona na tela de login, na tela de bloqueio nem com uma janela do UAC aberta, e ele confere isso a cada pedido. Desbloqueie a sessão pela tela do VNC e tente de novo. É uma proteção do servidor e vale também para o TightVNC Viewer. O botão do Viewer passou a se chamar "TightVNC Viewer (janela separada)", porque ele abre o programa oficial numa janela própria, fora das abas.

**Da 1.13.0 — transferência de arquivos do TightVNC dentro do app:** o botão **"📁 Arquivos"** da barra do VNC abre o painel Arquivos usando a transferência de arquivos do próprio TightVNC, a mesma do TightVNC Viewer. Dá para navegar pelos discos e pastas da máquina remota, enviar, baixar, criar pasta, renomear e excluir. Ela usa uma conexão VNC separada e "compartilhada", que não pede imagem, então a tela da sessão continua aberta durante a transferência. A senha digitada ao abrir o VNC fica só na memória durante a sessão e é reaproveitada, sem pedir de novo. Se o servidor não for TightVNC, ou tiver a transferência desativada, o botão cai no modo anterior (compartilhamento `C$` no Windows, SSH no Linux). O protocolo foi implementado a partir do código-fonte do TightVNC 2.8.88 (segurança "Tight", mensagens `0xFC0001xx`).

**Da 1.12.1 — VNC com TightVNC:**
- **Colar texto com travessão, aspas curvas e reticências:** o clipboard do VNC clássico (TightVNC, UltraVNC) só aceita Latin-1, e esses caracteres, comuns em textos do Word, Outlook e Teams, viravam `?`. Agora são trocados pelos equivalentes simples (— vira -, “ ” vira ", … vira ...). Acentos continuam como estão.
- **Abrir no TightVNC Viewer:** botão na barra do VNC e item no menu da sessão. Abre a mesma conexão no cliente oficial do TightVNC, numa janela própria, com a transferência de arquivos e as opções do próprio TightVNC. Usa o Viewer instalado no Windows; se não houver, usa o do pacote oficial que o app já baixa (hash e assinatura conferidos). A senha é pedida pelo próprio Viewer: nenhuma senha passa por linha de comando nem por arquivo.

**Da 1.12.0 — realce de sintaxe com as regras prontas do ChromaTerm:** o realce caseiro da 1.10.3 foi substituído pelas regras do [ChromaTerm](https://github.com/hSaria/ChromaTerm) (MIT), um colorizador de terminal mantido pela comunidade. Em Preferências → "Realce de sintaxe" há três opções:
- **Rede** (padrão): regras da comunidade para Cisco, Juniper e rede (interfaces, up/down, err-disabled, syslog por severidade, OSPF/BGP/EIGRP, spanning tree, contadores de erro) + as gerais.
- **Geral:** IPs, MACs, datas, horas, números, tamanhos (10G, 1.5Gbps), URLs e palavras boas/ruins.
- **Desligado.**

As regras são convertidas automaticamente do repositório original (`scripts/chromaterm/gerar-regras.py`), não reescritas à mão. O realce continua só nos terminais remotos, sem mexer no que o equipamento recebe nem nas cores que o servidor já manda. As cores do ChromaTerm foram pensadas para fundo escuro, e ficam mais nítidas nos temas escuros.

**Da 1.11.5 — copiar e colar nos terminais como no Windows Terminal e no PuTTY:** em todos os terminais (PowerShell, cmd, SSH, Telnet, serial…):
- **Colar:** Ctrl+V, Ctrl+Shift+V, Shift+Insert ou botão direito (sem seleção). Antes, só o Ctrl+Shift+V colava, e o Ctrl+V mandava `^V` para o shell.
- **Copiar:** Ctrl+C **com texto selecionado** (sem seleção continua sendo o Ctrl+C que interrompe o comando), Ctrl+Shift+C, Ctrl+Insert ou botão direito com seleção.
- O texto é colado uma única vez. Colagens com várias linhas continuam pedindo confirmação antes.

**Da 1.11.4 — SSH em switches e roteadores antigos:** equipamentos legados que só falam criptografia antiga (`diffie-hellman-group1-sha1`/`group14-sha1`, chaves `ssh-dss`, cifras `aes-cbc`/`3des-cbc`, `hmac-sha1-96`/`hmac-md5`) falhavam com `Handshake failed: no matching key exchange algorithm`. Esses algoritmos agora entram no **fim** da lista de preferência, como no PuTTY: equipamentos modernos continuam negociando os fortes, e os antigos só são usados quando o servidor não oferece nada melhor. Quando isso acontece, o terminal mostra um aviso em amarelo com os algoritmos fracos usados.

**Da 1.11.3 — login SSH em switches:**
- Muitos switches (Cisco, HP/Aruba, Huawei) só aceitam o login "keyboard-interactive", em que o equipamento pergunta `Password:`. O app abria um segundo diálogo pedindo a senha de novo. Agora responde sozinho com a senha já digitada, como o PuTTY e o MobaXterm fazem. O diálogo só aparece para outras perguntas, como um código de 2 fatores.
- Sessão sem usuário: o app pede usuário e senha juntos (sem usuário, o servidor sempre recusa).
- No lugar de `All configured authentication methods failed`, a mensagem diz "Usuário ou senha recusados por host:porta (usuário …)" e quais métodos o servidor aceita. Se a senha estava salva e foi recusada, ela é esquecida para a próxima conexão pedir de novo.

**Da 1.11.2 (correção):** um IP com zero à esquerda, como `10.0.0.07` ou `192.168.001.010` (comum em planilhas de rede), falhava com `getaddrinfo ENOTFOUND`. O Node não o reconhecia como IP e tentava resolvê-lo no DNS. Agora cada parte é lida em decimal (`10.0.0.7`), em todas as sessões (SSH, Telnet, RDP, VNC…), inclusive as já salvas e a conexão rápida. Um endereço com alguma parte acima de 255 é recusado com uma mensagem clara.

**Da 1.11.1 (correção do RemoteApp/RDS):** alguns servidores Windows (Connection Broker / RD Session Host) medem a latência (Auto-Detect RTT) logo depois do licenciamento, no mesmo canal dos pedidos de Multitransport. O IronRDP tratava qualquer pacote nesse canal como Multitransport e abortava com `MultitransportRequestPdu ... received 10 bytes, expected 28`. Agora o pedido de Auto-Detect é respondido, como na fase anterior da conexão, e outros pacotes inesperados nesse canal são ignorados em vez de derrubar a conexão.

**Da 1.11.0 — status online das sessões (como o mRemoteNG):** na lista de sessões, o fundo do selo (RDP, SSH, VNC, TEL…) fica **verde** quando a porta da sessão responde e **vermelho** quando não responde. O resto da lista não muda, e o tooltip do selo mostra o host e a porta testados. O teste só abre uma conexão TCP na porta e a fecha, sem enviar nada nem fazer login. Roda ao abrir o app, quando uma sessão nova é salva e depois a cada 2 minutos, só com a janela em foco, poucas conexões por vez e cada host+porta uma única vez, para não parecer varredura a um IPS. Sessões locais, seriais e as que passam por gateway SSH ou proxy ficam sem cor. Pode ser desligado em Preferências.

**Da 1.10.5 — RemoteApp com redirecionamento do Connection Broker:** num ambiente RDS com Connection Broker, o Broker recebe a conexão e redireciona o cliente para o servidor da coleção que roda o programa. O IronRDP não avisava o servidor de que aceita redirecionamento, nem sabia seguir um. Por isso a sessão abria no próprio Broker, onde o programa não está publicado, e o servidor recusava ("programa não publicado / fora da lista permitida"). Agora o app avisa que aceita redirecionamento (como o `mstsc`), lê o pacote de redirecionamento (Server Redirection PDU) e reconecta sozinho ao servidor indicado, levando o token e o ID da sessão (até 3 redirecionamentos). A regra segue o FreeRDP: com token novo, volta ao endereço original; sem token, ou se o Broker redirecionar de novo, vai ao FQDN/IP indicado. Isso só vale em sessões RemoteApp ou com `loadbalanceinfo`; o RDP comum não muda.

**Da 1.10.4 (correção do RemoteApp):** o programa do RemoteApp (ex.: `||alias`) agora também vai como "alternate shell" no início da sessão, como o `mstsc` e o FreeRDP fazem. O IronRDP o omitia no modo RemoteApp, e servidores RDS que só permitem programas publicados podiam recusar a abertura.

**Da 1.10.3 — realce de sintaxe para switches e roteadores:** switches quase nunca mandam cor, então nos terminais remotos (SSH, Telnet, serial, Rlogin, Rsh) o app colore na tela, no estilo do MobaXterm:
- **verde:** `up`, `connected`, `full`, `forwarding`, `established`;
- **vermelho:** `down`, `notconnect`, `err-disabled`, `blocking`, `failed`, `error`;
- **amarelo:** `administratively down`, `half`, `warning`;
- **ciano:** IPs (v4 e v6) e MACs (Cisco, HP/Huawei e com dois-pontos);
- **azul:** interfaces (`GigabitEthernet1/0/1`, `Gi1/0/1`, `Te1/1/1`, `Port-channel1`, `Vlan10`, `ge-0/0/0`…);
- **magenta:** o prompt do equipamento (`SW-CORE#`, `R1(config-if)#`, `<HUAWEI>`).

O realce só colore o que aparece na tela. Nada muda no que o equipamento recebe, e as cores que o próprio servidor manda continuam intactas. Os terminais locais (PowerShell, cmd) ficam sem realce. Liga e desliga em Preferências.

**Da 1.10.2 — RemoteApp com Connection Broker:**
- O `loadbalanceinfo` do `.rdp` (ex.: `tsv://MS Terminal Services Plugin.1.<Coleção>`) agora é lido na importação e enviado na conexão, como faz o `mstsc`. Ele diz ao Connection Broker em qual coleção abrir o programa. Sem ele, o servidor recusava o RemoteApp por o programa não estar publicado naquela coleção. Nas sessões criadas à mão, o campo fica em Avançados ("Load balance info").
- A mensagem de recusa mostra o motivo real do servidor, mesmo quando o nome do programa tem parênteses, como `||Programa (1)`.

**Da 1.10.1 — VNC com duas telas:** botão **"⤢ Tamanho real" / "⤡ Ajustar à janela"** na barra do VNC. "Ajustar" mostra a tela remota inteira encolhida no painel (como antes). "Tamanho real" mostra 100%, com barras de rolagem horizontal e vertical, para percorrer duas telas (ex.: 3840×1080) com o texto legível. Nesse modo o app também não pede ao servidor para redimensionar a sessão, para não reorganizar a área de trabalho remota. A escolha é lembrada por sessão.

**Da 1.10.0 — RemoteApp dentro do Stanis Terminal:**
- **Importar → "Pasta de RemoteApps (.rdp)":** aponte a pasta com os arquivos `.rdp` (os que o RD Web ou a pasta "Work Resources" geram). Cada arquivo vira uma sessão na pasta **RemoteApps**, com o selo **APP**. "Escolher arquivo" também aceita um `.rdp` avulso. Senhas não são importadas.
- **Clicou, abriu na aba:** o servidor abre só o programa (modo RemoteApp do RDP), desenhado dentro da aba do Stanis Terminal, com mouse, teclado e clipboard.
- Também dá para criar à mão: em Nova sessão → RDP → Avançados, preencha "Programa RemoteApp" (ex.: `||calc`).
- **Requisitos e limites:** o servidor precisa oferecer RemoteApp (Windows Server com Serviços de Área de Trabalho Remota publicando o programa, ou RemoteApp liberado no registro). Se não oferecer, a mensagem diz isso. RD Gateway ainda não é suportado (a importação avisa). Nesta primeira versão o programa aparece dentro da aba, não como janela solta no desktop.

**Da 1.9.2 — VNC com clipboard nos dois sentidos e arquivos à mão; terminais locais limpos:**
- **Copiar no Windows e colar no VNC funciona:** o que você copia no Windows vai sozinho para o servidor VNC (a cada segundo, só com a aba VNC ativa e a janela em foco, e só quando o texto muda). O **Ctrl+V** comum dentro da tela VNC manda o texto antes das teclas de colar. Antes, o Ctrl+V colava o clipboard antigo da máquina remota.
- **Botão "📁 Arquivos" na barra do VNC:** abre o painel Arquivos pelo canal de arquivos do mesmo host (compartilhamento `C$` no Windows, SSH no Linux). O protocolo VNC em si não transfere arquivos.
- **Oh My Posh removido** do catálogo de Ferramentas (a cópia instalada é apagada ao abrir o app). O app também não injeta mais um prompt colorido no PowerShell e no cmd locais: eles ficam como o Windows entrega.
- **Cores (ANSI) nos terminais remotos:** o destaque de erros e avisos agora vale só para SSH, Telnet, serial, Rlogin e Rsh. As cores que o próprio servidor manda continuam aparecendo normalmente.

**Da 1.9.1 — RDP conecta em servidores Windows reais (correção importante):**
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
- **Destaque automático de erros e avisos** nos terminais remotos (SSH, Telnet, serial, Rlogin, Rsh): "error"/"erro", "failed"/"falhou" e "warning"/"aviso" ficam coloridos automaticamente. Pode ser desligado em Preferências.
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
