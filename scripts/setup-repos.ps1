<#
  setup-repos.ps1
  -----------------------------------------------------------------------------
  Construit le "terrain de jeu" de la formation Git dans  ..\playground\ :

    AZURE_REPO/   -> depot BARE (le "QG" / origin sur Azure, sans working dir)
    Oussama/ Jorge/ Anya/ Elsa/ Zaka/ Thomas/ Othmane/
                  -> 7 clones locaux, chacun avec sa propre identite git,
                     volontairement laisses dans des etats DIFFERENTS pour que
                     le watcher soit visuellement riche des le depart.

  Historique partage : ~18 commits signes par les 7 personnes, etales sur ~3
  semaines, un projet multi-fichiers, une fusion (merge), 5 branches et 2 tags.

  Le script est re-jouable : il supprime puis recree entierement ..\playground\.
  Lancement :  powershell -ExecutionPolicy Bypass -File scripts\setup-repos.ps1
#>

param([string]$Path)   # dossier cible (defaut : ..\playground) - utile pour tester ailleurs
$ErrorActionPreference = 'Stop'

# --- Chemins -----------------------------------------------------------------
$root  = Split-Path $PSScriptRoot -Parent
$pg    = if ($Path) { $Path } else { Join-Path $root 'playground' }
$azure = Join-Path $pg 'AZURE_REPO'

# Suppression robuste : reessaie (verrous antivirus transitoires), et donne un
# message clair si un programme garde un depot ouvert (souvent VS Code / GitLens).
function Remove-Tree {
    param([string]$Target)
    for ($i = 0; $i -lt 6; $i++) {
        try { Remove-Item -Recurse -Force $Target -ErrorAction Stop; return }
        catch { Start-Sleep -Milliseconds 500 }
    }
    Write-Host ""
    Write-Host "!! Impossible de supprimer : $Target" -ForegroundColor Red
    Write-Host "   Un programme garde un fichier ouvert. Pistes :" -ForegroundColor Yellow
    Write-Host "   - un watcher 'node' encore lance ? -> ferme-le." -ForegroundColor Yellow
    Write-Host "   - VS Code / GitLens surveille les depots du playground ?" -ForegroundColor Yellow
    Write-Host "     -> Palette > 'Git: Close Repository' sur les depots playground," -ForegroundColor Yellow
    Write-Host "        ou recharge la fenetre VS Code, puis relance ce script." -ForegroundColor Yellow
    throw "Playground verrouille (voir ci-dessus)."
}

Write-Host "==> Terrain de jeu : $pg" -ForegroundColor Cyan
if (Test-Path $pg) {
    Write-Host "    (le dossier existe deja : on le recree de zero)" -ForegroundColor DarkYellow
    Remove-Tree $pg
}
New-Item -ItemType Directory -Force -Path $pg | Out-Null

# --- Petits utilitaires ------------------------------------------------------
function Write-Utf8 {
    param([string]$Path, [string]$Content)
    $dir = Split-Path $Path -Parent
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    [System.IO.File]::WriteAllText($Path, $Content)   # UTF-8 sans BOM (git-friendly)
}

function Set-Identity {
    param([string]$Repo, [string]$Name, [string]$Email)
    git -C $Repo config user.name  $Name
    git -C $Repo config user.email $Email
    git -C $Repo config core.autocrlf false   # silence les warnings CRLF sous Windows
}

# Commit signe par une personne donnee, a une date donnee ("22 days ago").
function Commit-As {
    param([string]$Repo, [string]$Author, [string]$Email, [double]$DaysAgo, [string]$Message)
    git -C $Repo add -A
    # GIT_*_DATE exige un format STRICT (pas de "22 days ago") : on calcule une date absolue (ISO).
    $stamp = (Get-Date).AddDays(-$DaysAgo).ToString("yyyy-MM-ddTHH:mm:ss")
    $env:GIT_AUTHOR_DATE    = $stamp
    $env:GIT_COMMITTER_DATE = $stamp
    git -C $Repo -c "user.name=$Author" -c "user.email=$Email" commit -q -m $Message | Out-Null
    Remove-Item Env:GIT_AUTHOR_DATE    -ErrorAction SilentlyContinue
    Remove-Item Env:GIT_COMMITTER_DATE -ErrorAction SilentlyContinue
}

# Contenu de prime.py parametre par le taux de base (sert au "paradoxe" Jorge/Anya).
function Get-PrimePy {
    param([string]$Taux)
    return @"
# Calcul de prime simplifie -- projet de demo (formation Git)
# (juste assez de code pour jouer avec les checkpoints)

TAUX_BASE = $Taux
MAJORATION_SENIOR = 0.02

def prime(capital, age):
    surcharge = MAJORATION_SENIOR if age > 60 else 0.0
    return round(capital * (TAUX_BASE + surcharge), 2)

if __name__ == "__main__":
    print("Prime estimee :", prime(100000, 65))
"@
}

# =============================================================================
# 1) Le QG : depot BARE
# =============================================================================
Write-Host "==> 1/4  Creation du depot BARE  AZURE_REPO (le QG)" -ForegroundColor Green
git init --bare -b main $azure | Out-Null
Write-Utf8 (Join-Path $azure 'description') "QG / origin de la formation (Azure) - depot bare"

# =============================================================================
# 2) Le "fondateur" : construit tout l'historique partage, puis pousse.
#    (depot jetable, supprime ensuite)
# =============================================================================
Write-Host "==> 2/4  Construction de l'historique partage (18 commits, 5 branches, 2 tags)" -ForegroundColor Green
$f = Join-Path $pg '__founder_tmp'
git init -b main $f | Out-Null
git -C $f config core.autocrlf false
git -C $f remote add origin $azure

# --- main : commit 1 (structure initiale) ---
Write-Utf8 (Join-Path $f 'README.md') @"
# Projet Tarif Express 🚀⏳

Projet bac a sable pour la **formation Git**.
Un mini-calcul de prime, juste assez pour jouer avec les checkpoints
(commits), les lignes temporelles (branches) et le QG (Azure).
"@
Write-Utf8 (Join-Path $f 'prime.py') (Get-PrimePy '0.05')
Write-Utf8 (Join-Path $f '.gitignore') @"
__pycache__/
*.pyc
.env
*.xlsx
"@
Write-Utf8 (Join-Path $f 'CHANGELOG.md') @"
# Journal de bord ⏳

## v0.1
- Premiere version du calcul de prime.
"@
Commit-As $f 'Oussama' 'oussama@formation.git' '22' "Initial: structure du projet (README, prime.py, .gitignore)"

# --- main : commit 2 (doc) ---
Add-Content -Path (Join-Path $f 'README.md') -Value "`n## Utilisation`n``python prime.py``  affiche une prime estimee.`n"
Commit-As $f 'Oussama' 'oussama@formation.git' '21' "docs: ajouter la section Utilisation au README"

# --- main : commit 3 (parametres) ---
Write-Utf8 (Join-Path $f 'parametres.py') @"
# Parametres du tarif (baremes, plafonds)
PLAFOND_CAPITAL = 1000000

MAJORATION_AGE = {
    "senior": 0.02,   # > 60 ans
    "jeune":  0.03,   # < 25 ans
}

FRANCHISE = 150
"@
Commit-As $f 'Jorge' 'jorge@formation.git' '19' "feat: parametres.py (baremes, plafonds, franchise)"

# --- main : commit 4 (utils) + tag v0.1 ---
Write-Utf8 (Join-Path $f 'utils.py') @"
# Petites fonctions utilitaires
def arrondi(valeur, n=2):
    return round(valeur, n)

def valide_capital(capital):
    if capital <= 0:
        raise ValueError("Le capital doit etre strictement positif")
    return True
"@
Commit-As $f 'Anya' 'anya@formation.git' '18' "feat: utils.py (arrondi, validation du capital)"
git -C $f tag v0.1

# --- main : commit 5 (donnees CSV) ---
Write-Utf8 (Join-Path $f 'data/baremes.csv') @"
tranche_age,coefficient
0-25,1.30
26-40,1.00
41-60,1.10
61-99,1.25
"@
Commit-As $f 'Elsa' 'elsa@formation.git' '16' "data: bareme par tranche d'age (CSV)"

# --- main : commit 6 (tests) ---
Write-Utf8 (Join-Path $f 'tests/test_prime.py') @"
# Tests basiques (a lancer avec pytest)
from prime import prime

def test_senior():
    assert prime(100000, 65) > 0

def test_non_senior():
    assert prime(100000, 30) == round(100000 * 0.05, 2)
"@
Commit-As $f 'Zaka' 'zaka@formation.git' '15' "test: premiers tests du calcul de prime"

# --- main : commit 7 (hypotheses) ---
Write-Utf8 (Join-Path $f 'docs/hypotheses.md') @"
# Hypotheses actuarielles ⏳

- Taux de base : 5 % du capital.
- Majoration senior (> 60 ans) : +2 points.
- A challenger : un modele 2026 (cf. branche experimentation).
"@
Commit-As $f 'Thomas' 'thomas@formation.git' '13' "docs: noter les hypotheses actuarielles"

# --- main : commit 8 (gitignore enrichi) ---
Add-Content -Path (Join-Path $f '.gitignore') -Value ".venv/`n*.log`ndata/raw/`nprimes.csv`n"
Commit-As $f 'Othmane' 'othmane@formation.git' '11' "chore: enrichir le .gitignore"

# --- branche feature/export-csv (sera FUSIONNEE dans main) ---
git -C $f switch -c feature/export-csv -q
Write-Utf8 (Join-Path $f 'export.py') @"
# Export des primes au format CSV
import csv
from prime import prime
"@
Commit-As $f 'Jorge' 'jorge@formation.git' '10' "feat(export): squelette de l'export CSV"
Write-Utf8 (Join-Path $f 'export.py') @"
# Export des primes au format CSV
import csv
from prime import prime

def exporter(profils, chemin="primes.csv"):
    with open(chemin, "w", newline="") as fichier:
        writer = csv.writer(fichier)
        writer.writerow(["capital", "age", "prime"])
        for capital, age in profils:
            writer.writerow([capital, age, prime(capital, age)])
"@
Commit-As $f 'Jorge' 'jorge@formation.git' '9' "feat(export): ecrire entete + lignes"

# --- main : commit 9, puis MERGE de feature/export-csv (--no-ff = vraie bulle) ---
git -C $f switch main -q
Add-Content -Path (Join-Path $f 'CHANGELOG.md') -Value "`n## v0.2`n- parametres.py, utils.py, tests, bareme CSV.`n"
Commit-As $f 'Anya' 'anya@formation.git' '8' "docs: mettre a jour le CHANGELOG (v0.2)"

$mstamp = (Get-Date).AddDays(-7).ToString("yyyy-MM-ddTHH:mm:ss")
$env:GIT_AUTHOR_DATE = $mstamp; $env:GIT_COMMITTER_DATE = $mstamp
git -C $f -c "user.name=Oussama" -c "user.email=oussama@formation.git" merge --no-ff feature/export-csv -q -m "merge: integrer l'export CSV dans main" | Out-Null
Remove-Item Env:GIT_AUTHOR_DATE,Env:GIT_COMMITTER_DATE -ErrorAction SilentlyContinue

# --- main : commit 10 + tag v1.0 ---
Add-Content -Path (Join-Path $f 'parametres.py') -Value "`n# NB: valeurs a revoir pour le millesime 2026`n"
Commit-As $f 'Elsa' 'elsa@formation.git' '6' "style: commenter parametres.py"
git -C $f tag v1.0

# --- branche feature/calcul-prime (NON fusionnee : le terrain de Thomas) ---
git -C $f switch -c feature/calcul-prime -q
Write-Utf8 (Join-Path $f 'prime.py') @"
# Calcul de prime simplifie -- projet de demo (formation Git)
# (juste assez de code pour jouer avec les checkpoints)

TAUX_BASE = 0.05
MAJORATION_SENIOR = 0.02
MAJORATION_JEUNE = 0.03   # nouveau : jeune conducteur (< 25 ans)

def prime(capital, age):
    surcharge = MAJORATION_SENIOR if age > 60 else 0.0
    if age < 25:
        surcharge += MAJORATION_JEUNE
    return round(capital * (TAUX_BASE + surcharge), 2)

if __name__ == "__main__":
    print("Prime estimee :", prime(100000, 65))
"@
Commit-As $f 'Thomas' 'thomas@formation.git' '5' "feat: majoration jeune conducteur"
Write-Utf8 (Join-Path $f 'tests/test_jeune.py') @"
from prime import prime

def test_jeune_plus_cher():
    assert prime(100000, 20) > prime(100000, 30)
"@
Commit-As $f 'Thomas' 'thomas@formation.git' '4' "test: cas du jeune conducteur"

# --- branche fix/arrondi (NON fusionnee) ---
git -C $f switch main -q
git -C $f switch -c fix/arrondi -q
Write-Utf8 (Join-Path $f 'utils.py') @"
# Petites fonctions utilitaires
def arrondi(valeur, n=2):
    # fix: forcer un arrondi a 2 decimales meme sur des entiers
    return round(float(valeur), n)

def valide_capital(capital):
    if capital <= 0:
        raise ValueError("Le capital doit etre strictement positif")
    return True
"@
Commit-As $f 'Elsa' 'elsa@formation.git' '3' "fix: arrondi systematique a 2 decimales"

# --- branche experimentation/modele-2026 (NON fusionnee, bien divergente) ---
git -C $f switch main -q
git -C $f switch -c experimentation/modele-2026 -q
Write-Utf8 (Join-Path $f 'prime.py') @"
# MODELE 2026 (experimental) -- NE PAS utiliser en production
TAUX_BASE = 0.04

def prime(capital, age, profil="standard"):
    base = capital * TAUX_BASE
    facteur = {"standard": 1.0, "risque": 1.4, "prudent": 0.9}.get(profil, 1.0)
    return round(base * facteur, 2)
"@
Commit-As $f 'Anya' 'anya@formation.git' '4.5' "wip: nouveau modele de tarification 2026"
Add-Content -Path (Join-Path $f 'docs/hypotheses.md') -Value "`n## Modele 2026 (brouillon)`n- Ponderation par profil (standard / risque / prudent).`n"
Commit-As $f 'Anya' 'anya@formation.git' '1.5' "wip: ponderation par profil"

# --- Pousser TOUT vers le QG (toutes les branches + les tags) ---
git -C $f switch main -q
git -C $f push -q origin --all
git -C $f push -q origin --tags

Remove-Item -Recurse -Force $f

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

# Oussama : a jour mais pas encore son fetch -> on fetch pour montrer "en retard de 1"
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
  Historique partage : ~18 commits (7 auteurs), 1 fusion, tags v0.1 / v1.0
  Branches au QG     : main, feature/calcul-prime, feature/export-csv (fusionnee),
                       fix/arrondi, experimentation/modele-2026
  Fichiers           : README, prime.py, parametres.py, utils.py, export.py,
                       CHANGELOG, .gitignore, data/baremes.csv, tests/, docs/

  Etats des depots :
  AZURE_REPO  bare (QG)   toutes les branches + tags
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
