# Assinatura Authenticode do executável

O `.exe` do Stanis Terminal ainda não tem assinatura de editor do Windows (Authenticode), por isso o SmartScreen pode avisar na primeira abertura. Isso é diferente da [assinatura GPG dos releases](VERIFICAR-ASSINATURA.md), que já existe e comprova a origem do arquivo, mas não é reconhecida pelo Windows.

Conseguir um certificado de assinatura de código (do SignPath Foundation, comprado de uma autoridade, ou um autoassinado da própria máquina) é uma escolha do mantenedor do projeto — não é feito por padrão. Este documento é o passo a passo para **quando você já tiver um certificado em mãos**, qualquer que seja a origem.

## 1. Formato do certificado

O `electron-builder` (usado neste projeto) assina com um arquivo `.pfx`/`.p12` (certificado + chave privada) ou com um certificado já instalado no repositório de certificados do Windows (`certmgr.msc`), identificado pela impressão digital (thumbprint).

- Se você recebeu um `.pfx` (comum em certificados comprados) ou exportou um autoassinado, use o método do arquivo.
- Se o certificado já está instalado no Windows (comum com certificados de hardware/token, ou após importar), use o método pela impressão digital.

## 2. Gerar um certificado autoassinado (só se você optar por essa via)

Só necessário se você decidir usar um certificado da própria máquina em vez de um de terceiros. Gera o par de chaves e exporta para `.pfx`:

```powershell
$cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Tiago Torres Stanis" -CertStoreLocation Cert:\CurrentUser\My -NotAfter (Get-Date).AddYears(3)
$password = Read-Host -AsSecureString "Senha para o .pfx"
Export-PfxCertificate -Cert $cert -FilePath "$HOME\stanis-terminal-codesign.pfx" -Password $password
```

Um certificado autoassinado **não remove o aviso do SmartScreen** para quem baixa o programa — o Windows só confia nele nas máquinas onde ele for instalado manualmente como confiável (`Import-Certificate -CertStoreLocation Cert:\LocalMachine\Root`, que exige administrador). Serve para testar o processo de assinatura ou para distribuição interna, não para o público em geral.

## 3. Ligar o certificado ao `electron-builder`

Hoje `package.json` tem, em `build.win`:

```json
"win": { "target": ["portable"], "icon": "src/ui/icon.ico", "signExecutable": false }
```

`"signExecutable": false` faz o build pular a assinatura de propósito. Para assinar:

1. Remova `"signExecutable": false` (ou mude para `true`) de `build.win` no `package.json`.
2. Informe o certificado por variável de ambiente (evita colocar a senha no `package.json` ou no histórico do git):

   **Com arquivo `.pfx`:**
   ```powershell
   $env:CSC_LINK = "C:\caminho\para\o\certificado.pfx"
   $env:CSC_KEY_PASSWORD = "a-senha-do-pfx"
   pnpm build
   ```

   **Com certificado já no repositório do Windows (por impressão digital):**
   ```powershell
   $env:WIN_CSC_LINK = ""   # deixe vazio para usar o certmgr.msc em vez de um arquivo
   ```
   e configure em `package.json` → `build.win.certificateSha1` com a impressão digital (`(Get-ChildItem Cert:\CurrentUser\My\CodeSigning).Thumbprint`).

3. Rode `pnpm build` normalmente. O log do `electron-builder` deixa de mostrar `file signing skipped via signExecutable configuration` e passa a mostrar a etapa de assinatura.

## 4. Assinar um `.exe` já existente, sem rebuildar

Útil para testar o certificado antes de mudar o processo de build:

```powershell
& "C:\Program Files (x86)\Windows Kits\10\bin\<versão>\x64\signtool.exe" sign /fd sha256 /f "C:\caminho\para\o\certificado.pfx" /p "a-senha" /tr http://timestamp.digicert.com /td sha256 "dist\StanisTerminal-<versão>-win-x64.exe"
```

Se `signtool.exe` não existir na máquina, o Windows SDK o instala: `winget install Microsoft.WindowsSDK`.

## 5. Conferir a assinatura depois de aplicada

```powershell
(Get-AuthenticodeSignature "dist\StanisTerminal-<versão>-win-x64.exe").Status   # deve ser "Valid"
```

## 6. Depois de assinar de verdade

- Publique o novo `.exe` assinado como um novo release (o hash muda; gere e assine também um novo `SHA256SUMS`/GPG, seguindo `VERIFICAR-ASSINATURA.md`).
- Atualize o README removendo o aviso de "executável não tem assinatura digital de editor".
- Se o certificado vier do SignPath Foundation, a candidatura em `docs/PLANO.md` deve ser retomada e enviada antes desta etapa (é o próprio SignPath quem assina, através do pipeline deles, não localmente como descrito aqui).
