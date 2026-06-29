'use strict';
/*
 * scanner.js — trouve les depots git dans un dossier.
 *
 * Detection 100% systeme de fichiers (rapide, pas d'appel git) :
 *   - depot NORMAL : contient une entree `.git` (dossier ou fichier).
 *   - depot BARE   : pas de `.git`, mais contient HEAD + objects/ + refs/
 *                    (et `bare = true` dans config). C'est la forme du "QG".
 *
 * On descend recursivement (profondeur bornee) MAIS on n'entre jamais dans un
 * depot deja detecte, et on ignore node_modules / dossiers caches lourds.
 */
const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = new Set(['node_modules', '.idea', '.vscode', 'objects']);

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

/** Classe un dossier : renvoie un descripteur de depot, ou null. */
function classify(dir) {
  const name = path.basename(dir);

  // Depot normal : presence d'un `.git`
  if (exists(path.join(dir, '.git'))) {
    return { name, path: dir, type: 'normal' };
  }

  // Depot bare : HEAD + objects + refs, sans `.git`
  const looksLikeGitDir =
    exists(path.join(dir, 'HEAD')) &&
    exists(path.join(dir, 'objects')) &&
    exists(path.join(dir, 'refs'));

  if (looksLikeGitDir) {
    let bare = true;
    try {
      const cfg = fs.readFileSync(path.join(dir, 'config'), 'utf8');
      if (/\bbare\s*=\s*false\b/i.test(cfg)) bare = false;
    } catch { /* pas de config lisible : on suppose bare */ }
    return { name, path: dir, type: bare ? 'bare' : 'gitdir' };
  }

  return null;
}

/**
 * Scanne `root` et renvoie la liste des depots trouves.
 * @param {string} root
 * @param {number} maxDepth profondeur max de descente (defaut 3)
 */
function scanRepos(root, maxDepth = 3) {
  const found = [];
  const seen = new Set();

  function add(repo) {
    if (seen.has(repo.path)) return;
    seen.add(repo.path);
    repo.id = repo.path;            // identifiant stable = chemin absolu
    found.push(repo);
  }

  function walk(dir, depth) {
    const cls = classify(dir);
    if (cls) { add(cls); return; }            // on n'entre pas dans un depot
    if (depth >= maxDepth) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith('.') || IGNORE_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), depth + 1);
    }
  }

  // Le root lui-meme peut etre un depot
  const rootCls = classify(root);
  if (rootCls) { add(rootCls); return found; }

  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); }
  catch { return found; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('.') || IGNORE_DIRS.has(e.name)) continue;
    walk(path.join(root, e.name), 1);
  }

  // Tri : les depots bare (QG) d'abord, puis alphabetique
  found.sort((a, b) => {
    const ra = a.type === 'bare' ? 0 : 1;
    const rb = b.type === 'bare' ? 0 : 1;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
  return found;
}

module.exports = { scanRepos, classify };
