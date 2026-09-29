param([int]$Port = 3000)
$ErrorActionPreference = 'Stop'
$studioRoot = $PSScriptRoot
$studioNodeCommand = Get-Command node -ErrorAction SilentlyContinue
$studioNodePath = if ($studioNodeCommand) { $studioNodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (!(Test-Path -LiteralPath $studioNodePath)) { throw 'Instale Node.js 22 ou superior antes de iniciar.' }
if (!(Test-Path -LiteralPath (Join-Path $studioRoot 'node_modules/next/dist/bin/next'))) { throw 'Instale as dependências com pnpm install, conforme o README.' }
$studioUrl = "http://127.0.0.1:$Port"
$studioExisting = $null
try { $studioExisting = Invoke-WebRequest -Uri $studioUrl -TimeoutSec 2 } catch { }
if ($studioExisting) {
  if ($studioExisting.Content -match '<title>Granistone Mail Studio</title>') { Start-Process $studioUrl; exit 0 }
  throw "A porta $Port já está em uso por outro aplicativo. Execute com -Port 3001."
}
Push-Location -LiteralPath $studioRoot
try {
  if (!(Test-Path -LiteralPath '.next/BUILD_ID')) {
    & $studioNodePath 'node_modules/next/dist/bin/next' build
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível compilar o aplicativo.' }
  }
  $studioProcess = Start-Process -FilePath $studioNodePath -ArgumentList 'node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', $Port -WorkingDirectory $studioRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $studioRoot 'studio-server.log') -RedirectStandardError (Join-Path $studioRoot 'studio-server-error.log') -PassThru
  for ($studioAttempt = 0; $studioAttempt -lt 30; $studioAttempt++) {
    try { $studioResponse = Invoke-WebRequest -Uri $studioUrl -TimeoutSec 2; if ($studioResponse.StatusCode -eq 200) { Start-Process $studioUrl; Write-Output "Studio aberto em $studioUrl. Processo: $($studioProcess.Id)"; exit 0 } } catch { }
    Start-Sleep -Milliseconds 500
  }
  throw 'O aplicativo não respondeu. Confira studio-server-error.log.'
} finally { Pop-Location }
