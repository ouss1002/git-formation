<#
  teardown.ps1
  Supprime entierement le terrain de jeu ..\playground\.
  Lancement : powershell -ExecutionPolicy Bypass -File scripts\teardown.ps1
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$pg   = Join-Path $root 'playground'
if (Test-Path $pg) {
    Remove-Item -Recurse -Force $pg
    Write-Host "Supprime : $pg" -ForegroundColor Yellow
} else {
    Write-Host "Rien a supprimer ($pg n'existe pas)." -ForegroundColor DarkGray
}
