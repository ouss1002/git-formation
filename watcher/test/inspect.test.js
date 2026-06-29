'use strict';
/*
 * inspect.test.js — verifie le "mecanisme d'observation" (scanner + inspector).
 *
 * Cree un mini terrain de jeu jetable dans un dossier temporaire, le met dans
 * plusieurs etats connus, puis verifie que scanRepos()/inspectRepo() rapportent
 * EXACTEMENT ce qu'on attend (bare vs normal, staging vs working, ahead/behind,
 * branches, fichier a la fois staged ET modifie, etc.).
 *
 *   node test/inspect.test.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { scanRepos } = require('../lib/scanner');
const { inspectRepo } = require('../lib/inspector');

// --- mini framework d'assertions --------------------------------------------
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  \x1b[32m✓\x1b[0m', name); }
  else { fail++; console.error('  \x1b[31m✗\x1b[0m', name, extra != null ? '->' + JSON.stringify(extra) : ''); }
}

// --- helpers git -------------------------------------------------------------
function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}
function write(p, content) { fs.writeFileSync(p, content); }
function ident(repo, name, email) {
  git(repo, ['config', 'user.name', name]);
  git(repo, ['config', 'user.email', email]);
  git(repo, ['config', 'core.autocrlf', 'false']);
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gitform-test-'));
  console.log('Terrain de test :', root, '\n');

  const azure = path.join(root, 'AZURE_REPO');
  const founder = path.join(root, '__founder');
  const alice = path.join(root, 'Alice');
  const bob = path.join(root, 'Bob');

  try {
    // 1) QG bare
    git(root, ['init', '--bare', '-b', 'main', azure]);

    // 2) Fondateur : contenu initial + branche feature, push
    git(root, ['init', '-b', 'main', founder]);
    ident(founder, 'Founder', 'founder@test');
    write(path.join(founder, 'app.py'), 'X = 1\n');
    write(path.join(founder, 'README.md'), '# Test\n');
    git(founder, ['add', '-A']);
    git(founder, ['commit', '-q', '-m', 'init']);
    git(founder, ['remote', 'add', 'origin', azure]);
    git(founder, ['push', '-q', '-u', 'origin', 'main']);
    git(founder, ['switch', '-c', 'feature', '-q']);
    write(path.join(founder, 'feature.txt'), 'wip\n');
    git(founder, ['add', '-A']);
    git(founder, ['commit', '-q', '-m', 'feat']);
    git(founder, ['push', '-q', '-u', 'origin', 'feature']);

    // 3) Deux clones
    git(root, ['clone', '--quiet', '-c', 'core.autocrlf=false', azure, alice]);
    git(root, ['clone', '--quiet', '-c', 'core.autocrlf=false', azure, bob]);
    ident(alice, 'Alice', 'alice@test');
    ident(bob, 'Bob', 'bob@test');

    // 4) Bob avance le QG (commit + push) -> Alice sera "behind" apres fetch
    write(path.join(bob, 'README.md'), '# Test\nLigne de Bob\n');
    git(bob, ['commit', '-q', '-am', 'bob update']);
    git(bob, ['push', '-q', 'origin', 'main']);

    // 5) Alice : un fichier A LA FOIS staged et modifie (MM), + un untracked, puis fetch
    write(path.join(alice, 'app.py'), 'X = 2\n');         // modif
    git(alice, ['add', 'app.py']);                        // -> staged
    write(path.join(alice, 'app.py'), 'X = 3\n');         // re-modif -> MM
    write(path.join(alice, 'brouillon.txt'), 'perso\n');  // untracked
    git(alice, ['fetch', '-q']);                          // pour voir le "behind"

    // === Verifications ========================================================
    console.log('\n[scanner]');
    const repos = scanRepos(root);
    const byName = Object.fromEntries(repos.map((r) => [r.name, r]));
    check('trouve AZURE_REPO', !!byName['AZURE_REPO']);
    check('trouve Alice', !!byName['Alice']);
    check('trouve Bob', !!byName['Bob']);
    check('AZURE_REPO classe BARE', byName['AZURE_REPO'] && byName['AZURE_REPO'].type === 'bare', byName['AZURE_REPO']?.type);
    check('Alice classee NORMAL', byName['Alice'] && byName['Alice'].type === 'normal', byName['Alice']?.type);
    check('__founder aussi detecte comme normal', !!byName['__founder']);

    console.log('\n[inspector — QG bare]');
    const qg = await inspectRepo(byName['AZURE_REPO']);
    check('QG: type bare', qg.type === 'bare');
    check('QG: pas de status (pas de working dir)', qg.status === null);
    check('QG: a des commits', qg.commits.length >= 2, qg.commits.length);
    check('QG: branche main presente', qg.branches.some((b) => b.name === 'main'));
    check('QG: branche feature presente', qg.branches.some((b) => b.name === 'feature'));

    console.log('\n[inspector — Alice (staging vs working)]');
    const a = await inspectRepo(byName['Alice']);
    check('Alice: identite = Alice', a.identity.name === 'Alice', a.identity.name);
    check('Alice: email = alice@test', a.identity.email === 'alice@test', a.identity.email);
    check('Alice: app.py est STAGED', a.status.staged.some((f) => f.path === 'app.py'), a.status.staged);
    check('Alice: app.py est AUSSI modifie (working)', a.status.unstaged.some((f) => f.path === 'app.py'), a.status.unstaged);
    check('Alice: brouillon.txt non-suivi', a.status.untracked.some((f) => f.path === 'brouillon.txt'), a.status.untracked);
    check('Alice: pas propre', a.status.clean === false);
    check('Alice: behind 1 vs origin/main', a.status.aheadBehind && a.status.aheadBehind.behind === 1, a.status.aheadBehind);
    check('Alice: HEAD sur main', a.head.branch === 'main', a.head.branch);

    console.log('\n[inspector — Bob (ahead)]');
    const b = await inspectRepo(byName['Bob']);
    check('Bob: propre', b.status.clean === true, b.status);
    check('Bob: commit pousse visible dans le graphe', b.commits.some((c) => c.subject === 'bob update'));

  } finally {
    // nettoyage
    try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  console.log(`\n=== Resultat : ${pass} OK, ${fail} KO ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
