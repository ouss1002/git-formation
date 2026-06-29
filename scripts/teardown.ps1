<#
  teardown.ps1
  Supprime entierement le terrain de jeu ..\playground\ (ou -Path).
  Lancement : powershell -ExecutionPolicy Bypass -File scripts\teardown.ps1
#>
param([string]$Path)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$pg   = if ($Path) { $Path } else { Join-Path $root 'playground' }

if (-not (Test-Path $pg)) {
    Write-Host "Rien a supprimer ($pg n'existe pas)." -ForegroundColor DarkGray
    return
}

for ($i = 0; $i -lt 6; $i++) {
    try { Remove-Item -Recurse -Force $pg -ErrorAction Stop; Write-Host "Supprime : $pg" -ForegroundColor Yellow; return }
    catch { Start-Sleep -Milliseconds 500 }
}
Write-Host "!! Impossible de supprimer $pg : un programme garde un depot ouvert" -ForegroundColor Red
Write-Host "   (watcher 'node' encore lance ? VS Code / GitLens qui surveille le playground ?)." -ForegroundColor Yellow
Write-Host "   Ferme-les (ou 'Git: Close Repository' dans VS Code), puis relance." -ForegroundColor Yellow
throw "Playground verrouille."
