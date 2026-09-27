# Produtividade e correções — 1.19.0

## Uso rápido

| Ação | Como usar |
| --- | --- |
| Próxima / anterior | Ctrl+Tab / Ctrl+Shift+Tab |
| Buscar sessão aberta | Ctrl+Shift+P ou ▾ ao lado de ＋; digite, use setas e Enter |
| Percorrer abas | Roda do mouse sobre a barra; a aba selecionada aparece automaticamente |
| Mais espaço | F11 mantém as abas e recolhe os demais painéis; F11 retorna |
| Barra remota | Fica fixa acima do desktop; “Barra: fixa” permite ocultação automática |
| Colar no remoto | “Colar texto” envia o conteúdo e o comando de colar |
| Janela estreita | Pacotes e Ferramentas ficam no ⋯ superior; Preferências e Arquivos continuam acessíveis |

Os atalhos de troca são do aplicativo, inclusive dentro das sessões VNC/RDP e páginas web. As janelas destacadas são localizadas pela busca. Para alternar abas a partir de uma sessão em tela cheia, Ctrl+Tab sai da tela cheia e seleciona a próxima.

## Problemas corrigidos

- Nova aba fora da área visível: reproduzido com 12 terminais; rolagem acompanha a seleção e o redimensionamento.
- Abas inacessíveis no modo foco: a faixa compacta permanece visível; sair do foco não cobre o desktop.
- Botões fora da janela: controles frequentes preservados e ações adicionais em menus acessíveis.
- Tela remota encoberta por ferramentas: barra fixa ocupa espaço próprio; a opção flutuante continua disponível.
- Botão de colar só sincronizava texto: agora também envia o atalho de colagem.
- Clipboard remoto em segundo plano sobrescrevia o local: atualizações restritas à sessão ativa, visível e com a janela em foco, fora de diálogos.
- Troca de aba exigia outro clique para digitar: foco devolvido ao terminal, canvas remoto ou página.
- Seleção em tela dividida não atualizava todos os controles: a origem dos arquivos e as ferramentas acompanham a seleção.
- Retorno de páginas destacadas: o comando “Trazer janelas” usa o fluxo próprio da sessão web.
- Testes com diretório explícito podiam usar dados do portátil: corrigida a precedência; terminal e arquivos de teste abrem em pasta sintética.

## Validação e limites

- Suíte de regras: 108 aprovados, nenhum reprovado, 1 teste de VNC real não executado.
- Interface, importação, conexões locais, TLS, ferramentas, organização, cofre Windows, ZMODEM, bloqueio, VNC simulado, janelas, páginas web e colagem exercitados pelas suítes existentes.
- Nova suíte `npm run test:productivity`: 12 abas, janela de 820 px, busca, modo foco, atalho dentro de página web, foco VNC, botão de colar, clipboard entre abas, saída de tela cheia e isolamento dos dados de teste.
- O teste isolado do cofre apresentou falha intermitente ao encerrar o Electron após validar o DPAPI. A saída imediata foi substituída pelo encerramento normal; três execuções seguidas terminaram com código zero.
- VNC usa servidor simulado em loopback. A colagem no terminal usa PowerShell real e um servidor Telnet local com buffer limitado. Não equivalem a homologação em máquinas de trabalho.
- A alteração do botão de colar RDP e a compatibilidade com servidores RDP reais precisam de validação no destino. Serial físico, X11/XDMCP e particularidades de servidores externos não foram homologados nesta rodada.

## Dados e distribuição

O código-fonte desta versão acompanha a tag correspondente no GitHub. O pacote portátil validado permanece local até que a assinatura de distribuição possa ser gerada.

Os testes usam dados sintéticos e servidores locais. Arquivos `.env`, `.rdp`, credenciais, sondagens e pastas de dados/distribuições locais são ignorados pelo Git. Isso reduz inclusão acidental; não impede inclusão forçada nem detecta todo tipo de segredo.

O clipboard continua sendo compartilhado com o destino ativo quando a função é usada. O aplicativo não impede que um servidor remoto receba o texto que você enviar. Perfis, histórico, credenciais e cookies ficam na pasta local `StanisTerminal-data`; nunca inclua essa pasta em um ZIP para publicar. O ZIP de distribuição deve ser gerado pelo build, antes de copiar dados de uso pessoal.
