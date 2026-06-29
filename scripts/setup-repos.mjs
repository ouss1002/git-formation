// setup-repos.mjs — construit le terrain de jeu Git (multiplateforme : Windows / macOS / Linux).
//
//   node scripts/setup-repos.mjs [dossier_cible]
//
// Lit scripts/config.json (noms, emails, états). Crée :
//   AZURE_REPO/  -> dépôt BARE (origin)   +   1 clone par personne, chacun dans un état différent.
// Historique partagé : ~18 commits (7 auteurs), 1 merge, 5 branches, 2 tags.
// Ré-exécutable : supprime puis recrée entièrement le dossier cible.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const cfg = JSON.parse(fs.readFileSync(path.join(HERE, 'config.json'), 'utf8'));

const PG   = path.resolve(process.cwd(), process.argv[2] || path.join(ROOT, cfg.playgroundDir));
const BARE = path.join(PG, cfg.bareName);
const BR   = cfg.defaultBranch;
const FEAT = cfg.featureBranch;
const P    = cfg.people;

// ---------- utilitaires ------------------------------------------------------
function git(args, env) {
  return execFileSync('git', args, {
    env: env || process.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
}
const g = (repo, ...args) => git(['-C', repo, ...args]);            // git dans un dépôt

function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

function rmTree(dir) {
  for (let i = 0; i < 6; i++) {
    try { fs.rmSync(dir, { recursive: true, force: true }); return; }
    catch (e) {
      if (i === 5) {
        console.error(`\n!! Impossible de supprimer : ${dir}`);
        console.error("   Un programme garde un fichier ouvert (watcher 'node' encore lancé ?");
        console.error("   VS Code / GitLens qui surveille le playground ?). Ferme-le puis relance.\n");
        throw e;
      }
      sleep(500);
    }
  }
}

const isoDaysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 19); // yyyy-MM-ddTHH:mm:ss

function write(repo, rel, content) {
  const fp = path.join(repo, rel);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, content);                                    // UTF-8, sans BOM
}
const append = (repo, rel, content) => fs.appendFileSync(path.join(repo, rel), content);

// Commit signé par une personne, à une date donnée (jours dans le passé).
function commitAs(repo, person, daysAgo, message) {
  g(repo, 'add', '-A');
  const stamp = isoDaysAgo(daysAgo);
  git(['-C', repo, '-c', `user.name=${person.name}`, '-c', `user.email=${person.email}`,
    'commit', '-q', '-m', message],
    { ...process.env, GIT_AUTHOR_DATE: stamp, GIT_COMMITTER_DATE: stamp });
}

// ---------- contenu du mini-projet (données de démo) -------------------------
const primePy = (taux) => `# Calcul de prime simplifie -- projet bac a sable pour experimenter avec Git

TAUX_BASE = ${taux}
MAJORATION_SENIOR = 0.02

def prime(capital, age):
    surcharge = MAJORATION_SENIOR if age > 60 else 0.0
    return round(capital * (TAUX_BASE + surcharge), 2)

if __name__ == "__main__":
    print("Prime estimee :", prime(100000, 65))
`;

const FILES = {
  readme: `# Projet Tarif Express

Petit projet bac a sable pour manipuler Git : commits, branches et depot distant (origin).
Un mini-calcul de prime, juste assez de code pour experimenter.
`,
  gitignore: `__pycache__/
*.pyc
.env
*.xlsx
`,
  changelog: `# Journal de bord

## v0.1
- Premiere version du calcul de prime.
`,
  parametres: `# Parametres du tarif (baremes, plafonds)
PLAFOND_CAPITAL = 1000000

MAJORATION_AGE = {
    "senior": 0.02,   # > 60 ans
    "jeune":  0.03,   # < 25 ans
}

FRANCHISE = 150
`,
  utils: `# Petites fonctions utilitaires
def arrondi(valeur, n=2):
    return round(valeur, n)

def valide_capital(capital):
    if capital <= 0:
        raise ValueError("Le capital doit etre strictement positif")
    return True
`,
  baremes: `tranche_age,coefficient
0-25,1.30
26-40,1.00
41-60,1.10
61-99,1.25
`,
  testPrime: `# Tests basiques (a lancer avec pytest)
from prime import prime

def test_senior():
    assert prime(100000, 65) > 0

def test_non_senior():
    assert prime(100000, 30) == round(100000 * 0.05, 2)
`,
  hypotheses: `# Hypotheses

- Taux de base : 5 % du capital.
- Majoration senior (> 60 ans) : +2 points.
- A challenger : un modele 2026 (cf. branche experimentation).
`,
  exportSkeleton: `# Export des primes au format CSV
import csv
from prime import prime
`,
  exportFull: `# Export des primes au format CSV
import csv
from prime import prime

def exporter(profils, chemin="primes.csv"):
    with open(chemin, "w", newline="") as fichier:
        writer = csv.writer(fichier)
        writer.writerow(["capital", "age", "prime"])
        for capital, age in profils:
            writer.writerow([capital, age, prime(capital, age)])
`,
  primeJeune: `# Calcul de prime simplifie -- projet bac a sable pour experimenter avec Git

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
`,
  testJeune: `from prime import prime

def test_jeune_plus_cher():
    assert prime(100000, 20) > prime(100000, 30)
`,
  utilsFix: `# Petites fonctions utilitaires
def arrondi(valeur, n=2):
    # fix: forcer un arrondi a 2 decimales meme sur des entiers
    return round(float(valeur), n)

def valide_capital(capital):
    if capital <= 0:
        raise ValueError("Le capital doit etre strictement positif")
    return True
`,
  primeExp: `# MODELE 2026 (experimental) -- NE PAS utiliser en production
TAUX_BASE = 0.04

def prime(capital, age, profil="standard"):
    base = capital * TAUX_BASE
    facteur = {"standard": 1.0, "risque": 1.4, "prudent": 0.9}.get(profil, 1.0)
    return round(base * facteur, 2)
`,
};

// ============================================================================
console.log(`==> Terrain de jeu : ${PG}`);
if (fs.existsSync(PG)) { console.log('    (le dossier existe déjà : on le recrée de zéro)'); rmTree(PG); }
fs.mkdirSync(PG, { recursive: true });

// 1) dépôt BARE
console.log(`==> 1/4  Dépôt BARE  ${cfg.bareName} (origin)`);
git(['init', '--bare', '-b', BR, BARE]);
write(BARE, 'description', 'origin du playground - depot bare');

// 2) historique partagé, construit dans un dépôt "fondateur" jetable
console.log('==> 2/4  Historique partagé (18 commits, 5 branches, 2 tags)');
const F = path.join(PG, '__founder_tmp');
git(['init', '-b', BR, F]);
g(F, 'config', 'core.autocrlf', 'false');
g(F, 'remote', 'add', 'origin', BARE);

write(F, 'README.md', FILES.readme);
write(F, 'prime.py', primePy('0.05'));
write(F, '.gitignore', FILES.gitignore);
write(F, 'CHANGELOG.md', FILES.changelog);
commitAs(F, P[0], 22, 'Initial: structure du projet (README, prime.py, .gitignore)');

append(F, 'README.md', '\n## Utilisation\n`python prime.py` affiche une prime estimee.\n');
commitAs(F, P[0], 21, 'docs: ajouter la section Utilisation au README');

write(F, 'parametres.py', FILES.parametres);
commitAs(F, P[1], 19, 'feat: parametres.py (baremes, plafonds, franchise)');

write(F, 'utils.py', FILES.utils);
commitAs(F, P[2], 18, 'feat: utils.py (arrondi, validation du capital)');
g(F, 'tag', 'v0.1');

write(F, 'data/baremes.csv', FILES.baremes);
commitAs(F, P[3], 16, "data: bareme par tranche d'age (CSV)");

write(F, 'tests/test_prime.py', FILES.testPrime);
commitAs(F, P[4], 15, 'test: premiers tests du calcul de prime');

write(F, 'docs/hypotheses.md', FILES.hypotheses);
commitAs(F, P[5], 13, 'docs: noter les hypotheses');

append(F, '.gitignore', '.venv/\n*.log\ndata/raw/\nprimes.csv\n');
commitAs(F, P[6], 11, 'chore: enrichir le .gitignore');

// branche feature/export-csv (sera fusionnée dans main)
g(F, 'switch', '-c', 'feature/export-csv', '-q');
write(F, 'export.py', FILES.exportSkeleton);
commitAs(F, P[1], 10, "feat(export): squelette de l'export CSV");
write(F, 'export.py', FILES.exportFull);
commitAs(F, P[1], 9, 'feat(export): ecrire entete + lignes');

// main : commit 9 puis MERGE --no-ff (vraie bulle de fusion)
g(F, 'switch', BR, '-q');
append(F, 'CHANGELOG.md', '\n## v0.2\n- parametres.py, utils.py, tests, bareme CSV.\n');
commitAs(F, P[2], 8, 'docs: mettre a jour le CHANGELOG (v0.2)');
{
  const stamp = isoDaysAgo(7);
  git(['-C', F, '-c', `user.name=${P[0].name}`, '-c', `user.email=${P[0].email}`,
    'merge', '--no-ff', 'feature/export-csv', '-q', '-m', "merge: integrer l'export CSV dans main"],
    { ...process.env, GIT_AUTHOR_DATE: stamp, GIT_COMMITTER_DATE: stamp });
}

// main : commit 10 + tag v1.0
append(F, 'parametres.py', '\n# NB: valeurs a revoir pour le millesime 2026\n');
commitAs(F, P[3], 6, 'style: commenter parametres.py');
g(F, 'tag', 'v1.0');

// branche feature/calcul-prime (NON fusionnée)
g(F, 'switch', '-c', FEAT, '-q');
write(F, 'prime.py', FILES.primeJeune);
commitAs(F, P[5], 5, 'feat: majoration jeune conducteur');
write(F, 'tests/test_jeune.py', FILES.testJeune);
commitAs(F, P[5], 4, 'test: cas du jeune conducteur');

// branche fix/arrondi (NON fusionnée)
g(F, 'switch', BR, '-q'); g(F, 'switch', '-c', 'fix/arrondi', '-q');
write(F, 'utils.py', FILES.utilsFix);
commitAs(F, P[3], 3, 'fix: arrondi systematique a 2 decimales');

// branche experimentation/modele-2026 (NON fusionnée, bien divergente)
g(F, 'switch', BR, '-q'); g(F, 'switch', '-c', 'experimentation/modele-2026', '-q');
write(F, 'prime.py', FILES.primeExp);
commitAs(F, P[2], 4.5, 'wip: nouveau modele de tarification 2026');
append(F, 'docs/hypotheses.md', '\n## Modele 2026 (brouillon)\n- Ponderation par profil.\n');
commitAs(F, P[2], 1.5, 'wip: ponderation par profil');

// pousser tout (branches + tags), puis supprimer le fondateur
g(F, 'switch', BR, '-q');
g(F, 'push', '-q', 'origin', '--all');
g(F, 'push', '-q', 'origin', '--tags');
rmTree(F);

// 3) un clone par personne, avec identité propre
console.log('==> 3/4  Clones locaux (identités individuelles)');
for (const p of P) {
  const dest = path.join(PG, p.name);
  git(['clone', '--quiet', '-c', 'core.autocrlf=false', BARE, dest]);
  g(dest, 'config', 'user.name', p.name);
  g(dest, 'config', 'user.email', p.email);
  g(dest, 'config', 'core.autocrlf', 'false');
  console.log(`    - ${p.name.padEnd(8)} clone + identité OK`);
}

// 4) mise en scène : chaque dépôt dans un état différent
console.log('==> 4/4  Mise en scène des états');
const repoOf = (p) => path.join(PG, p.name);

// "pushed" d'abord (fait avancer origin), pour que "behind"/"diverged" voient le retard
for (const p of P.filter((x) => x.state === 'pushed')) {
  write(repoOf(p), 'prime.py', primePy('0.055'));
  g(repoOf(p), 'commit', '-q', '-am', 'fix: relever le taux de base a 0.055');
  g(repoOf(p), 'push', '-q', 'origin', BR);
}
for (const p of P) {
  const r = repoOf(p);
  switch (p.state) {
    case 'pushed': break;
    case 'behind': g(r, 'fetch', '-q'); break;
    case 'diverged':
      write(r, 'prime.py', primePy('0.06'));
      g(r, 'commit', '-q', '-am', 'tune: passer le taux de base a 0.06');
      g(r, 'fetch', '-q'); break;
    case 'staged':
      append(r, 'README.md', '\n> Note : documenter les hypotheses.\n');
      g(r, 'add', 'README.md'); break;
    case 'dirty':
      append(r, 'prime.py', '\n# TODO: gerer le cas capital negatif\n');
      write(r, 'notes.txt', 'Brouillon perso (non suivi par git).'); break;
    case 'on-feature':
      g(r, 'switch', FEAT, '-q'); break;
    case 'stash':
      append(r, 'CHANGELOG.md', '\n## (brouillon)\n- Idee a creuser.\n');
      g(r, 'stash', 'push', '-q', '-m', 'brouillon en cours'); break;
    default:
      console.warn(`    ⚠ état inconnu pour ${p.name} : "${p.state}" (ignoré)`);
  }
}

// récapitulatif
console.log(`
===========================================================
 Terrain de jeu prêt :  ${PG}
===========================================================
  Historique : ~18 commits (${P.length} auteurs), 1 merge, tags v0.1 / v1.0
  Branches   : ${BR}, ${FEAT}, feature/export-csv (fusionnée), fix/arrondi, experimentation/modele-2026
  États      :
${P.map((p) => `    ${p.name.padEnd(8)} ${p.state}`).join('\n')}

  Étape suivante :
    cd watcher && npm install && node server.js ../${cfg.playgroundDir}
    puis ouvrir  http://localhost:4242
`);
