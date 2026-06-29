'use strict';
/*
 * simulate.js — joue des SCÉNARIOS git pas-à-pas, à observer dans le watcher.
 *
 *   node test/simulate.js [scénario]      (défaut : cycle)
 *   node test/simulate.js list            (liste les scénarios)
 *   npm run simulate -- conflit           (via npm)
 *
 * Variables d'environnement :
 *   DELAY=5000        pause (ms) entre chaque étape          (défaut 5000)
 *   PLAYGROUND=...    dossier du terrain de jeu              (défaut ../playground)
 *   REPO=Anya         dépôt cible (sinon celui du scénario)
 *
 * NB : ça modifie réellement les dépôts. Pour tout remettre à zéro :
 *      node scripts/setup-repos.mjs
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DELAY = parseInt(process.env.DELAY || '5000', 10);
const DIR = path.resolve(process.cwd(), process.env.PLAYGROUND || path.join('..', 'playground'));
const stamp = Date.now().toString().slice(-6);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const C = { cyan: '\x1b[36m', mag: '\x1b[35m', grn: '\x1b[32m', red: '\x1b[31m', yel: '\x1b[33m', dim: '\x1b[2m', rst: '\x1b[0m' };

function execGit(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function makeCtx(repoName) {
  const repo = path.join(DIR, repoName);
  return {
    dir: DIR, repo, repoName, stamp, mem: {},
    git: (...a) => execGit(repo, a),
    tryGit: (...a) => { try { return execGit(repo, a); } catch { return null; } },
    gitIn: (name, ...a) => execGit(path.join(DIR, name), a),
    write: (rel, c) => fs.writeFileSync(path.join(repo, rel), c),
    append: (rel, c) => fs.appendFileSync(path.join(repo, rel), c),
    head: () => execGit(repo, ['rev-parse', '--short', 'HEAD']).trim(),
  };
}

// contenu prime.py "résolu" (pour le scénario conflit)
const primeResolved = `# Calcul de prime simplifie -- projet bac a sable pour experimenter avec Git

TAUX_BASE = 0.06
MAJORATION_SENIOR = 0.02

def prime(capital, age):
    surcharge = MAJORATION_SENIOR if age > 60 else 0.0
    return round(capital * (TAUX_BASE + surcharge), 2)

if __name__ == "__main__":
    print("Prime estimee :", prime(100000, 65))
`;

// ---------------------------------------------------------------- scénarios
const scenarios = {
  cycle: {
    repo: 'Oussama',
    title: 'Cycle de base : status → add → commit → branche → push',
    steps: [
      { e: '🔄', m: 'git pull --ff-only  (se synchroniser d’abord)', w: 'si le dépôt était en retard, il rattrape le distant.',
        run: (c) => c.tryGit('pull', '--ff-only', '-q') },
      { e: '📝', m: `créer un fichier note_${stamp}.md`, w: 'il apparaît en NON-SUIVI (working directory).',
        run: (c) => c.write(`note_${stamp}.md`, `# Note ${stamp}\n`) },
      { e: '📦', m: `git add note_${stamp}.md`, w: 'le fichier passe du working directory à l’INDEX (staged, vert).',
        run: (c) => c.git('add', `note_${stamp}.md`) },
      { e: '💾', m: 'git commit -m "..."', w: 'un nouveau commit apparaît, HEAD avance, l’index se vide.',
        run: (c) => c.git('commit', '-q', '-m', `docs: note ${stamp}`) },
      { e: '🛠️', m: 'modifier README.md sans l’indexer', w: 'README apparaît en MODIFIÉ (non indexé).',
        run: (c) => c.append('README.md', `\n- ligne ${stamp}\n`) },
      { e: '📦', m: 'git add -A puis git commit', w: '2e commit, le working directory redevient propre.',
        run: (c) => { c.git('add', '-A'); c.git('commit', '-q', '-m', `docs: maj README ${stamp}`); } },
      { e: '🌿', m: `git switch -c essai-${stamp} + un commit`, w: 'une nouvelle branche/colonne apparaît dans le graphe.',
        run: (c) => { c.git('switch', '-c', `essai-${stamp}`, '-q'); c.write(`essai_${stamp}.txt`, 'test\n'); c.git('add', '-A'); c.git('commit', '-q', '-m', `feat: essai ${stamp}`); } },
      { e: '↩️', m: 'git switch main', w: 'HEAD revient sur main ; la branche essai reste visible.',
        run: (c) => c.git('switch', 'main', '-q') },
      { e: '☁️', m: 'git push origin main', w: 'le distant (AZURE_REPO) reçoit les commits et grandit.',
        run: (c) => c.tryGit('push', '-q', 'origin', 'main') },
    ],
  },

  branche: {
    repo: 'Oussama',
    title: 'Branche + merge (vraie bulle de fusion)',
    steps: [
      { e: '🔄', m: 'git pull --ff-only', w: 'le dépôt est à jour.', run: (c) => c.tryGit('pull', '--ff-only', '-q') },
      { e: '🌿', m: `git switch -c feature-${stamp} + un commit`, w: 'la branche feature part de main.',
        run: (c) => { c.git('switch', '-c', `feature-${stamp}`, '-q'); c.write(`feature_${stamp}.txt`, 'travail sur la feature\n'); c.git('add', '-A'); c.git('commit', '-q', '-m', `feat: ${stamp}`); } },
      { e: '↩️', m: 'git switch main + un commit sur main', w: 'main avance de son côté → les deux branches divergent.',
        run: (c) => { c.git('switch', 'main', '-q'); c.append('CHANGELOG.md', `\n- correction main ${stamp}\n`); c.git('add', '-A'); c.git('commit', '-q', '-m', `fix: main ${stamp}`); } },
      { e: '🔗', m: `git merge feature-${stamp} --no-edit`, w: 'un COMMIT DE FUSION relie les deux colonnes (merge visible).',
        run: (c) => c.git('merge', `feature-${stamp}`, '--no-edit', '-q') },
    ],
  },

  conflit: {
    repo: 'Anya',
    title: 'Conflit : git pull sur un dépôt divergent → résolution',
    steps: [
      { e: '🧭', m: 'git status  (Anya est ahead 1 / behind 1)', w: 'le dépôt est DIVERGENT du distant.',
        run: (c) => process.stdout.write(C.dim + '   ' + c.git('status', '-sb').split('\n')[0] + C.rst + '\n') },
      { e: '💥', m: 'git pull  → CONFLIT sur prime.py', w: 'le fichier passe en CONFLIT (les deux ont changé la même ligne).',
        run: (c) => c.tryGit('pull', '--no-rebase', '-q') },
      { e: '🔍', m: 'ouvrir prime.py : marqueurs <<<<<<< ======= >>>>>>>', w: 'on voit les deux versions à départager.',
        run: () => process.stdout.write(C.dim + '   (marqueurs de conflit présents dans prime.py)' + C.rst + '\n') },
      { e: '✅', m: 'résoudre (garder TAUX_BASE = 0.06) + git add', w: 'le fichier résolu passe dans l’index.',
        run: (c) => { c.write('prime.py', primeResolved); c.git('add', 'prime.py'); } },
      { e: '💾', m: 'git commit --no-edit  (valide la fusion)', w: 'un commit de fusion relie les deux historiques.',
        run: (c) => c.git('commit', '--no-edit', '-q') },
    ],
  },

  annuler: {
    repo: 'Oussama',
    title: 'Annuler / récupérer : reset --hard puis reflog',
    steps: [
      { e: '🔄', m: 'git pull --ff-only', w: 'point de départ propre.', run: (c) => c.tryGit('pull', '--ff-only', '-q') },
      { e: '💾', m: 'créer 2 commits (wip A, wip B)', w: 'HEAD avance de 2 crans.',
        run: (c) => { c.write(`a_${stamp}.txt`, 'A\n'); c.git('add', '-A'); c.git('commit', '-q', '-m', `wip A ${stamp}`); c.write(`b_${stamp}.txt`, 'B\n'); c.git('add', '-A'); c.git('commit', '-q', '-m', `wip B ${stamp}`); c.mem.saved = c.head(); } },
      { e: '💣', m: 'git reset --hard HEAD~2  (on "perd" les 2 commits)', w: 'le graphe RECULE : les 2 commits disparaissent de la vue.',
        run: (c) => c.git('reset', '--hard', 'HEAD~2') },
      { e: '🔦', m: 'git reflog  (le journal des positions de HEAD)', w: 'les commits "perdus" y figurent encore.',
        run: (c) => process.stdout.write(C.dim + c.git('reflog', '-n', '3').trim().split('\n').map((l) => '   ' + l).join('\n') + C.rst + '\n') },
      { e: '✨', m: (c) => `git reset --hard ${c.mem.saved}  (récupération)`, w: 'les 2 commits RÉAPPARAISSENT dans le graphe.',
        run: (c) => c.git('reset', '--hard', c.mem.saved) },
    ],
  },

  stash: {
    repo: 'Oussama',
    title: 'Stash : mettre de côté puis restaurer',
    steps: [
      { e: '🛠️', m: 'modifier prime.py (travail en cours)', w: 'prime.py apparaît MODIFIÉ (non indexé).',
        run: (c) => c.append('prime.py', `\n# WIP ${stamp}\n`) },
      { e: '📥', m: 'git stash  (mettre de côté)', w: 'le working directory redevient propre ; le compteur STASH monte.',
        run: (c) => c.git('stash', 'push', '-q', '-m', `wip ${stamp}`) },
      { e: '📋', m: 'git stash list', w: 'le stash est bien dans la pile.',
        run: (c) => process.stdout.write(C.dim + '   ' + (c.git('stash', 'list').split('\n')[0] || '') + C.rst + '\n') },
      { e: '📤', m: 'git stash pop  (restaurer)', w: 'la modification REVIENT ; le compteur STASH redescend.',
        run: (c) => c.git('stash', 'pop', '-q') },
    ],
  },

  amend: {
    repo: 'Oussama',
    title: 'Amend : corriger le dernier commit (fichier oublié)',
    steps: [
      { e: '🔄', m: 'git pull --ff-only', w: 'point de départ à jour.', run: (c) => c.tryGit('pull', '--ff-only', '-q') },
      { e: '💾', m: 'commit d’un fichier (on oublie le test)', w: '1 nouveau commit.',
        run: (c) => { c.write(`calc_${stamp}.py`, 'def f(): return 42\n'); c.git('add', '-A'); c.git('commit', '-q', '-m', `feat: calc ${stamp}`); } },
      { e: '🩹', m: 'ajouter le test oublié + git commit --amend --no-edit', w: 'le DERNIER commit change de contenu (même message) — pas de commit en plus.',
        run: (c) => { c.write(`test_${stamp}.py`, 'def test_f(): assert True\n'); c.git('add', '-A'); c.git('commit', '--amend', '--no-edit', '-q'); } },
    ],
  },

  remote: {
    repo: 'Oussama',
    title: 'Remote : Oussama pousse, Jorge récupère',
    steps: [
      { e: '🔄', m: '[Oussama] git pull --ff-only', w: 'Oussama se synchronise.', run: (c) => c.tryGit('pull', '--ff-only', '-q') },
      { e: '💾', m: '[Oussama] un commit', w: 'Oussama a 1 commit d’avance (ahead 1).',
        run: (c) => { c.write(`shared_${stamp}.md`, `# partagé ${stamp}\n`); c.git('add', '-A'); c.git('commit', '-q', '-m', `docs: partage ${stamp}`); } },
      { e: '☁️', m: '[Oussama] git push origin main', w: 'AZURE_REPO grandit ; Oussama repasse à jour.',
        run: (c) => c.git('push', '-q', 'origin', 'main') },
      { e: '🔭', m: '[Jorge] git fetch', w: 'Jorge se voit maintenant EN RETARD de 1 (behind).',
        run: (c) => c.gitIn('Jorge', 'fetch', '-q') },
      { e: '🔄', m: '[Jorge] git pull', w: 'le commit d’Oussama apparaît chez Jorge ; il repasse à jour.',
        run: (c) => c.gitIn('Jorge', 'pull', '--ff-only', '-q') },
    ],
  },
};

// ---------------------------------------------------------------- runner
function listScenarios() {
  console.log('\nScénarios disponibles :');
  for (const [k, s] of Object.entries(scenarios)) {
    console.log(`  ${C.cyan}${k.padEnd(9)}${C.rst} ${s.title}  ${C.dim}(dépôt : ${s.repo})${C.rst}`);
  }
  console.log(`\nExemples : node test/simulate.js conflit   ·   DELAY=8000 node test/simulate.js branche\n`);
}

async function run(key) {
  const sc = scenarios[key];
  if (!sc) { console.error(`${C.red}Scénario inconnu : "${key}"${C.rst}`); listScenarios(); process.exit(1); }
  const repoName = process.env.REPO || sc.repo;
  const ctx = makeCtx(repoName);
  if (!fs.existsSync(ctx.repo)) {
    console.error(`${C.red}Dépôt introuvable : ${ctx.repo}${C.rst}`);
    console.error('Lance d’abord :  node scripts/setup-repos.mjs');
    process.exit(1);
  }
  console.log(`${C.mag}=== Scénario "${key}" — ${sc.title} ===${C.rst}`);
  console.log(`Dépôt : ${C.cyan}${repoName}${C.rst}  ·  pause ${DELAY} ms entre les étapes.`);
  console.log(`Ouvre http://localhost:4242 et sélectionne "${repoName}" avant de continuer.`);
  await sleep(DELAY);

  for (const st of sc.steps) {
    console.log(`\n${st.e}  ${typeof st.m === 'function' ? st.m(ctx) : st.m}`);
    try { st.run(ctx); } catch { console.log(`   ${C.dim}(git a signalé quelque chose — souvent normal, ex. conflit)${C.rst}`); }
    if (st.w) console.log(`   ${C.cyan}👉 Watcher : ${typeof st.w === 'function' ? st.w(ctx) : st.w}${C.rst}`);
    await sleep(DELAY);
  }
  console.log(`\n${C.grn}✔ Scénario terminé.${C.rst}  Pour tout réinitialiser : node scripts/setup-repos.mjs\n`);
}

const arg = process.argv[2];
if (arg === 'list' || arg === '--list' || arg === '-l') { listScenarios(); process.exit(0); }
run(arg || 'cycle').catch((e) => { console.error(e); process.exit(1); });
