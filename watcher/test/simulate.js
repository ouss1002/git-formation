'use strict';
/*
 * simulate.js — "joue" une petite histoire git, etape par etape, avec des pauses,
 * pour que tu puisses REGARDER le tableau de bord reagir en direct.
 *
 *   node test/simulate.js [dossier_playground] [nom_du_depot]
 *   ex:  node test/simulate.js ../playground Oussama
 *
 * Variables d'env :
 *   DELAY=4000   -> millisecondes de pause entre chaque etape (defaut 3500)
 *
 * NB : ca modifie reellement le depot choisi. Pour tout remettre a zero :
 *      powershell -ExecutionPolicy Bypass -File scripts/setup-repos.ps1
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const folder = path.resolve(process.cwd(), process.argv[2] || path.join('..', 'playground'));
const repoName = process.argv[3] || 'Oussama';
const repo = path.join(folder, repoName);
const DELAY = parseInt(process.env.DELAY || '3500', 10);
const stamp = Date.now().toString().slice(-6);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function git(args) {
  return execFileSync('git', ['-C', repo].concat(args), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}
function say(emoji, msg) { console.log(`\n${emoji}  ${msg}`); }
function watch(msg) { console.log(`   \x1b[36m👉 Regarde le watcher : ${msg}\x1b[0m`); }
async function step(fn) { fn(); await sleep(DELAY); }

async function main() {
  if (!fs.existsSync(repo)) {
    console.error(`\x1b[31mDepot introuvable : ${repo}\x1b[0m`);
    console.error(`Lance d'abord :  powershell -ExecutionPolicy Bypass -File scripts/setup-repos.ps1`);
    process.exit(1);
  }
  console.log(`\x1b[35m=== Simulation d'activite sur "${repoName}" (pause ${DELAY}ms) ===\x1b[0m`);
  console.log(`Ouvre http://localhost:4242 et selectionne "${repoName}" avant de continuer.`);
  await sleep(DELAY);

  const journal = path.join(repo, `journal_${stamp}.md`);

  await step(() => {
    say('🔄', `git pull --ff-only  (je me synchronise d'abord avec le QG)`);
    try {
      git(['pull', '--ff-only', '-q']);
      watch(`si "${repoName}" était en retard, son graphe rattrape le QG (et le push final passera).`);
    } catch (e) {
      watch(`déjà à jour, ou divergence : on continue quand même.`);
    }
  });

  await step(() => {
    say('📝', `Je cree un nouveau fichier journal_${stamp}.md`);
    fs.writeFileSync(journal, `# Journal ${stamp}\n\n- Première entrée.\n`);
    watch(`il apparaît dans l'ÉTABLI (working dir), en "non-suivi".`);
  });

  await step(() => {
    say('📦', `git add journal_${stamp}.md`);
    git(['add', `journal_${stamp}.md`]);
    watch(`le fichier passe de l'Établi au SAS (staging), en vert.`);
  });

  await step(() => {
    say('💾', `git commit -m "journal: première entrée"`);
    git(['commit', '-q', '-m', `journal: première entrée (${stamp})`]);
    watch(`un nouveau CHECKPOINT apparaît dans le graphe, HEAD avance, le SAS se vide.`);
  });

  await step(() => {
    say('🛠️', `Je modifie README.md sans le préparer`);
    fs.appendFileSync(path.join(repo, 'README.md'), `\n> Note ${stamp} ajoutée en direct.\n`);
    watch(`README.md apparaît dans l'Établi en "modifié" (orange), PAS dans le sas.`);
  });

  await step(() => {
    say('📦', `git add -A  puis  git commit`);
    git(['add', '-A']);
    git(['commit', '-q', '-m', `docs: note ${stamp}`]);
    watch(`2e checkpoint, l'Établi redevient propre.`);
  });

  await step(() => {
    say('🌌', `git switch -c feature/demo-${stamp}  (nouvelle ligne temporelle)`);
    git(['switch', '-c', `feature/demo-${stamp}`, '-q']);
    fs.writeFileSync(path.join(repo, `experiment_${stamp}.txt`), 'essai\n');
    git(['add', '-A']);
    git(['commit', '-q', '-m', `feat: experiment ${stamp}`]);
    watch(`une nouvelle branche/colonne apparaît dans le graphe ; HEAD est dessus.`);
  });

  await step(() => {
    say('↩️', `git switch main  (retour à la ligne principale)`);
    git(['switch', 'main', '-q']);
    watch(`HEAD revient sur main ; la branche feature reste visible dans le graphe.`);
  });

  await step(() => {
    say('☁️', `git push origin main  (envoi des checkpoints au QG)`);
    try {
      git(['push', '-q', 'origin', 'main']);
      watch(`la zone QG passe à "à jour", et le graphe d'AZURE_REPO grandit !`);
    } catch (e) {
      watch(`push refusé (le QG a peut-être avancé). Essaie 'git pull' en démo — c'est l'occasion d'un PARADOXE.`);
    }
  });

  console.log(`\n\x1b[32m✔ Simulation terminée.\x1b[0m`);
  console.log(`Pour tout réinitialiser : powershell -ExecutionPolicy Bypass -File scripts/setup-repos.ps1\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
