# Como verificar o download

Cada release traz três arquivos de verificação ao lado do `.exe`:

- `SHA256SUMS`: o SHA-256 do executável.
- `SHA256SUMS.asc`: assinatura GPG (destacada) do arquivo acima.
- `StanisTerminal-<versão>-win-x64.exe.asc`: assinatura GPG (destacada) do próprio executável.

A chave pública está em [`docs/chave-publica-release.asc`](chave-publica-release.asc).

**Chave:** `Stanis Terminal Releases <70165676+TiagoTStanis@users.noreply.github.com>`
**Impressão digital (fingerprint):** `A345 44C3 43F2 E16B EF64  C7A4 95A1 3721 ED00 B9E6`
**Validade:** até 21/09/2028

## Passo a passo (PowerShell com o GPG do Git, ou Gpg4win)

```powershell
# 1. Importe a chave e CONFIRA a impressão digital acima (compare com a do repositório)
gpg --import chave-publica-release.asc
gpg --fingerprint "Stanis Terminal Releases"

# 2. Confira a assinatura da lista de hashes e o hash do executável
gpg --verify SHA256SUMS.asc SHA256SUMS
gpg --verify StanisTerminal-1.1.0-win-x64.exe.asc StanisTerminal-1.1.0-win-x64.exe
(Get-FileHash .\StanisTerminal-1.1.0-win-x64.exe -Algorithm SHA256).Hash.ToLower()   # deve bater com o SHA256SUMS
```

Procure por `Good signature from "Stanis Terminal Releases …"`. O GPG também avisa “this key is not certified”: é esperado, porque você ainda não marcou a chave como confiável. O que importa é a **impressão digital** bater.

## O que isto garante (e o que não garante)

- Garante que o arquivo é o mesmo que foi assinado com esta chave e que não foi alterado depois.
- Não é a assinatura de editor do Windows (Authenticode): o SmartScreen pode continuar avisando. A assinatura Authenticode depende de um certificado de terceiros e está prevista para uma versão futura.
- Se a chave for comprometida, será publicado um certificado de revogação neste repositório.
