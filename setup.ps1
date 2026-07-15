$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js 18以上をインストールしてください。"
    exit 1
}

node scripts/setup.mjs
exit $LASTEXITCODE
