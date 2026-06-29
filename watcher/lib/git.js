'use strict';
/*
 * git.js — petit wrapper autour de la commande `git`.
 *
 *  - On NE shell pas : execFile (pas d'injection, pas de quoting).
 *  - Depot NORMAL  -> args prefixes par  -C <path>
 *  - Depot BARE    -> prefixes par        --git-dir <path>
 *    (indispensable si `safe.bareRepository = explicit`).
 *  - core.quotePath=false : noms de fichiers accentues affiches tels quels.
 *  - timeout : un `git` qui bloque est tue (WATCH_GIT_TIMEOUT_MS, defaut 20s).
 *  - chronometrage : chaque appel est mesure ; les appels lents sont logues
 *    (utile pour diagnostiquer un antivirus/EDR qui ralentit chaque spawn).
 */
const { execFile } = require('child_process');
const { dbg, warn } = require('./log');

const US = '\x1f';
const RS = '\x1e';
const GIT_TIMEOUT = parseInt(process.env.WATCH_GIT_TIMEOUT_MS || '20000', 10);
const SLOW_MS     = parseInt(process.env.WATCH_GIT_SLOW_MS || '600', 10);

// GIT_OPTIONAL_LOCKS=0 : on n'inspecte qu'en LECTURE. Sans ça, `git status` peut
// reecrire l'index (pour rafraichir son cache), ce qui ferait "bouger" .git a
// chaque poll et casserait le saut d'inspection base sur les dates de fichiers.
const GIT_ENV = Object.assign({}, process.env, { GIT_OPTIONAL_LOCKS: '0' });

let _calls = 0, _totalMs = 0, _slow = 0, _timeouts = 0;
function gitStats() { return { calls: _calls, totalMs: _totalMs, slow: _slow, timeouts: _timeouts }; }
function resetStats() { _calls = 0; _totalMs = 0; _slow = 0; _timeouts = 0; }

/** Construit les arguments de base selon le type de depot. */
function baseArgs(repo) {
  const common = ['-c', 'core.quotePath=false', '-c', 'color.ui=false'];
  if (repo.type === 'bare' || repo.type === 'gitdir') {
    return common.concat(['--git-dir', repo.path]);
  }
  return common.concat(['-C', repo.path]);
}

function shorten(args) {
  const s = args.filter((a) => a !== '-c' && !a.startsWith('core.') && !a.startsWith('color.')).join(' ');
  return s.length > 100 ? s.slice(0, 100) + '…' : s;
}

/** Lance git et resout TOUJOURS avec { code, stdout, stderr, ms }. */
function runRaw(args, opts = {}) {
  return new Promise((resolve) => {
    const t = Date.now();
    execFile(
      'git', args,
      { maxBuffer: 32 * 1024 * 1024, windowsHide: true, timeout: GIT_TIMEOUT, killSignal: 'SIGKILL', env: GIT_ENV, ...opts },
      (err, stdout, stderr) => {
        const ms = Date.now() - t;
        _calls++; _totalMs += ms;
        if (err && (err.killed || err.signal)) {
          _timeouts++; warn(`git TIMEOUT (${ms}ms) : git ${shorten(args)}`);
        } else if (ms >= SLOW_MS) {
          _slow++; dbg(`git lent ${ms}ms : git ${shorten(args)}`);
        }
        resolve({
          code: err ? (typeof err.code === 'number' ? err.code : 1) : 0,
          stdout: stdout || '', stderr: stderr || '', ms,
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

/** Comme git() mais renvoie l'objet complet { code, stdout, stderr, ms }. */
async function gitFull(repo, args, opts = {}) {
  return runRaw(baseArgs(repo).concat(args), opts);
}

module.exports = { git, gitFull, runRaw, baseArgs, gitStats, resetStats, US, RS };
