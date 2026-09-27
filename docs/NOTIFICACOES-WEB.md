# Notificações de páginas web

As abas Link podem exibir notificações do sistema que o próprio site enviar pelo recurso de notificações do navegador. Isso serve para sites de e-mail, mensagens e chamados que implementam a API Notification/Web Push.

## Ativar e escolher sites

1. Abra **Preferências** e marque **Receber notificações das páginas web**.
2. Ao abrir um site que pedir essa permissão, escolha **Permitir** ou **Bloquear** na confirmação do Stanis Terminal. A decisão fica salva localmente por origem (protocolo, host e porta).
3. Para apagar as escolhas, marque **Esquecer permissões dos sites e perguntar novamente** em Preferências.
4. Desmarcar a opção geral suspende todas as notificações sem apagar as escolhas por site.

Por segurança, o padrão é desligado; páginas HTTP públicas, subframes e origens inválidas não recebem permissão. HTTPS é recomendado. HTTP é aceito somente em `localhost` para desenvolvimento local.

## Limite

O aplicativo recebe notificações que a página realmente envia ao navegador. Ele não consegue inferir de forma universal um contador, bolinha, linha nova ou estado “não lido” desenhado dentro de cada site. Esses indicadores dependem de cada sistema e exigiriam integração específica. A exibição final também depende das permissões e configurações de notificações do Windows.
