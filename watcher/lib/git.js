'use strict';
/*
 * git.js — petit wrapper autour de la commande `git`.
 *
 * Particularites importantes pour ce projet :
 *  - On NE shell pas : on passe par execFile (pas d'injection, pas de quoting foireux).
 *  - Depot NORMAL  -> on prefixe les args avec  -C <path>
 *  - Depot BARE    -> on prefixe avec           --git-dir <path>
 *    (indispensable si l'utilisateur a `safe.bareRepository = explicit`, sinon git
 *     refuse de travailler sur un depot bare decouvert implicitement.)
 *  - core.quotePath=false : pour afficher les noms de fichiers accentues (francais)
 *    tels quels au lieu de les echapper en octal.
 */
const { execFile } = require('child_process');

const US = '\x1f'; // separateur d'unite, delimiteur de champs improbable dans du texte
const RS = '\x1e'; // separateur d'enregistrement

/** Construit les arguments de base selon le type de depot. */
function baseArgs(repo) {
  const common = ['-c', 'core.quotePath=false', '-c', 'color.ui=false'];
  if (repo.type === 'bare' || repo.type === 'gitdir') {
    return common.concat(['--git-dir', repo.path]);
  }
  return common.concat(['-C', repo.path]);
}

/**
 * Lance git et resout TOUJOURS (jamais de rejet) avec { code, stdout, stderr }.
 * Cela simplifie l'appelant : on inspecte `code` au lieu de gerer des exceptions.
 */
function runRaw(args, opts = {}) {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      { maxBuffer: 32 * 1024 * 1024, windowsHide: true, ...opts },
      (err, stdout, stderr) => {
        resolve({
          code: err ? (typeof err.code === 'number' ? err.code : 1) : 0,
          stdout: stdout || '',
          stderr: stderr || '',
        });
      }
    );
  });
}

/** Lance une commande git dans le contexte d'un depot et renvoie stdout (trim). */
async function git(repo, args, opts = {}) {
  const res = await runRaw(baseArgs(repo).concat(args), opts);
  return res.stdout.replace(/\s+$/, '');
}

/** Comme git() mais renvoie l'objet complet { code, stdout, stderr }. */
async function gitFull(repo, args, opts = {}) {
  return runRaw(baseArgs(repo).concat(args), opts);
}

module.exports = { git, gitFull, runRaw, baseArgs, US, RS };
