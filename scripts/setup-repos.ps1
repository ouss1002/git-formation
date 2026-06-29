<#
  setup-repos.ps1
  -----------------------------------------------------------------------------
  Construit le "terrain de jeu" de la formation Git dans  ..\playground\ :

    AZURE_REPO/   -> depot BARE (le "QG" / origin sur Azure, sans working dir)
    Oussama/ Jorge/ Anya/ Elsa/ Zaka/ Thomas/ Othmane/
                  -> 7 clones locaux, chacun avec sa propre identite git,
                     volontairement laisses dans des etats DIFFERENTS pour que
                     le watcher soit visuellement riche des le depart.

  Le script est re-jouable : il supprime puis recree entierement ..\playground\.
  Lancement :  powershell -ExecutionPolicy Bypass -File scripts\setup-repos.ps1
#>

$ErrorActionPreference = 'Stop'

# --- Chemins -----------------------------------------------------------------
$root = Split-Path $PSScriptRoot -Parent
$pg   = Join-Path $root 'playground'
$azure = Join-Path $pg 'AZURE_REPO'

Write-Host "==> Terrain de jeu : $pg" -ForegroundColor Cyan
if (Test-Path $pg) {
    Write-Host "    (le dossier playground existe deja : on le recree de zero)" -ForegroundColor DarkYellow
    Remove-Item -Recurse -Force $pg
}
New-Item -ItemType Directory -Force -Path $pg | Out-Null

# --- Petits utilitaires ------------------------------------------------------
function Write-Utf8 {
    param([string]$Path, [string]$Content)
    # UTF-8 sans BOM (git-friendly)
    [System.IO.File]::WriteAllText($Path, $Content)
}

function Set-Identity {
    param([string]$Repo, [string]$Name, [string]$Email)
    git -C $Repo config user.name  $Name
    git -C $Repo config user.email $Email
    git -C $Repo config core.autocrlf false   # silence les warnings CRLF sous Windows
}

# Contenu de prime.py parametre par le taux de base (sert aux variantes)
function Get-PrimePy {
    param([string]$Taux)
    return @"
# Calcul de prime simplifie -- projet de demo (formation Git)
# (juste assez de code pour jouer avec les checkpoints)

TAUX_BASE = $Taux

def prime(capital, age):
    surcharge = 0.02 if age > 60 else 0.0
    return capital * (TAUX_BASE + surcharge)

if __name__ == "__main__":
    print("Prime estimee :", prime(100000, 65))
"@
}

# =============================================================================
# 1) Le QG : depot BARE
# =============================================================================
Write-Host "==> 1/4  Creation du depot BARE  AZURE_REPO (le QG)" -ForegroundColor Green
git init --bare -b main $azure | Out-Null
# Une petite description lisible dans l'UI
Write-Utf8 (Join-Path $azure 'description') "QG / origin de la formation (Azure) - depot bare"

# =============================================================================
# 2) Le "fondateur" : pousse le contenu initial + une branche feature
#    (depot jetable, supprime ensuite)
# =============================================================================
Write-Host "==> 2/4  Amorcage du projet (commits initiaux + branche feature)" -ForegroundColor Green
$founder = Join-Path $pg '__founder_tmp'
git init -b main $founder | Out-Null
Set-Identity $founder 'Formateur Git' 'prof@formation.git'
git -C $founder remote add origin $azure   # rattacher le QG (bug-fix : indispensable pour push)

Write-Utf8 (Join-Path $founder 'README.md') @"
# Projet Tarif Express 🚀⏳

Projet bac a sable pour la **formation Git**.
Un mini-calcul de prime, juste assez pour jouer avec les checkpoints
(commits), les lignes temporelles (branches) et le QG (Azure).
"@
Write-Utf8 (Join-Path $founder 'prime.py') (Get-PrimePy '0.05')
Write-Utf8 (Join-Path $founder '.gitignore') @"
__pycache__/
*.pyc
.env
*.xlsx
"@
Write-Utf8 (Join-Path $founder 'CHANGELOG.md') @"
# Journal de bord ⏳

## v0.1
- Premiere version du calcul de prime.
"@

git -C $founder add -A
git -C $founder commit -q -m "Initial: structure du projet (README, prime.py, .gitignore)"

# 2e commit sur main
Add-Content -Path (Join-Path $founder 'README.md') -Value "`n## Utilisation`n``python prime.py``  affiche une prime estimee.`n"
git -C $founder add -A
git -C $founder commit -q -m "docs: ajouter la section Utilisation au README"

# Branche feature (sans toucher TAUX_BASE -> fusion propre possible en demo)
git -C $founder switch -c feature/calcul-prime -q
Write-Utf8 (Join-Path $founder 'prime.py') @"
# Calcul de prime simplifie -- projet de demo (formation Git)
# (juste assez de code pour jouer avec les checkpoints)

TAUX_BASE = 0.05
MAJORATION_JEUNE = 0.03   # nouveau : jeune conducteur

def prime(capital, age):
    surcharge = 0.02 if age > 60 else 0.0
    if age < 25:
        surcharge += MAJORATION_JEUNE
    return capital * (TAUX_BASE + surcharge)

if __name__ == "__main__":
    print("Prime estimee :", prime(100000, 65))
"@
Add-Content -Path (Join-Path $founder 'CHANGELOG.md') -Value "`n## (branche feature)`n- Majoration jeune conducteur.`n"
git -C $founder add -A
git -C $founder commit -q -m "feat: majoration jeune conducteur (sur la branche feature)"

# Pousser main + feature vers le QG
git -C $founder push -q -u origin main
git -C $founder push -q -u origin feature/calcul-prime
git -C $founder switch main -q

Remove-Item -Recurse -Force $founder

# =============================================================================
# 3) Les 7 clones, un par personne, avec identite propre
# =============================================================================
Write-Host "==> 3/4  Clonage des 7 depots locaux (identites individuelles)" -ForegroundColor Green
$players = @(
    @{ Name = 'Oussama'; Email = 'oussama@formation.git' },
    @{ Name = 'Jorge';   Email = 'jorge@formation.git'   },
    @{ Name = 'Anya';    Email = 'anya@formation.git'    },
    @{ Name = 'Elsa';    Email = 'elsa@formation.git'    },
    @{ Name = 'Zaka';    Email = 'zaka@formation.git'    },
    @{ Name = 'Thomas';  Email = 'thomas@formation.git'  },
    @{ Name = 'Othmane'; Email = 'othmane@formation.git' }
)
foreach ($p in $players) {
    $dest = Join-Path $pg $p.Name
    # -c core.autocrlf=false des le clone : evite les fausses "modifs" de fins de ligne sous Windows
    git clone --quiet -c core.autocrlf=false $azure $dest
    Set-Identity $dest $p.Name $p.Email
    Write-Host ("    - {0,-8} clone + identite OK" -f $p.Name)
}

# =============================================================================
# 4) Mise en scene : chaque repo dans un etat DIFFERENT
# =============================================================================
Write-Host "==> 4/4  Mise en scene des etats (pour un dashboard vivant)" -ForegroundColor Green

$Oussama = Join-Path $pg 'Oussama'
$Jorge   = Join-Path $pg 'Jorge'
$Anya    = Join-Path $pg 'Anya'
$Elsa    = Join-Path $pg 'Elsa'
$Zaka    = Join-Path $pg 'Zaka'
$Thomas  = Join-Path $pg 'Thomas'
$Othmane = Join-Path $pg 'Othmane'

# Jorge : modifie TAUX_BASE -> 0.055, commit, PUSH (fait avancer le QG)
Write-Utf8 (Join-Path $Jorge 'prime.py') (Get-PrimePy '0.055')
git -C $Jorge commit -q -am "fix: relever le taux de base a 0.055"
git -C $Jorge push -q origin main

# Oussama : a jour mais n'a pas encore son fetch -> on fetch pour montrer "en retard de 1"
git -C $Oussama fetch -q

# Anya : modifie la MEME ligne -> 0.06 en local (non poussee) + fetch
#        => divergence ahead1/behind1, et un pull provoquera un PARADOXE (conflit)
Write-Utf8 (Join-Path $Anya 'prime.py') (Get-PrimePy '0.06')
git -C $Anya commit -q -am "tune: passer le taux de base a 0.06"
git -C $Anya fetch -q

# Elsa : changement STAGED uniquement (dans le sas, pas encore commite)
Add-Content -Path (Join-Path $Elsa 'README.md') -Value "`n> Note d'Elsa : penser a documenter les hypotheses.`n"
git -C $Elsa add README.md

# Zaka : working directory SALE -> modif non preparee + fichier non suivi
Add-Content -Path (Join-Path $Zaka 'prime.py') -Value "`n# TODO Zaka: gerer le cas capital negatif`n"
Write-Utf8 (Join-Path $Zaka 'notes.txt') "Brouillon perso de Zaka (non suivi par git)."

# Thomas : voyage vers la ligne temporelle feature/calcul-prime
git -C $Thomas switch feature/calcul-prime -q

# Othmane : range un changement dans la poche dimensionnelle (stash)
Add-Content -Path (Join-Path $Othmane 'CHANGELOG.md') -Value "`n## (brouillon Othmane)`n- Idee a creuser.`n"
git -C $Othmane stash push -q -m "brouillon d'Othmane"

# =============================================================================
# Recapitulatif
# =============================================================================
Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host " Terrain de jeu pret :  $pg" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host @"
  AZURE_REPO  bare (QG)   main + feature/calcul-prime
  Oussama     propre, EN RETARD de 1 (un simple 'git pull' suffit)
  Jorge       a jour, vient de PUSHER le taux 0.055
  Anya        DIVERGENT (ahead1/behind1) -> 'git pull' = PARADOXE (conflit pret)
  Elsa        un changement dans le SAS (staged, pas commite)
  Zaka        working dir SALE (modif non preparee + notes.txt non suivi)
  Thomas      sur la branche feature/calcul-prime
  Othmane     a un STASH en poche, working dir propre

  Etape suivante :
    cd watcher
    npm install
    node server.js ../playground
    puis ouvrir  http://localhost:4242
"@ -ForegroundColor Gray
