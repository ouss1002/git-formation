'use strict';
/*
 * inspector.js — produit un "snapshot" complet d'un depot, pret a envoyer au navigateur.
 *
 * Optimise pour les machines ou chaque spawn `git` est lent (antivirus/EDR) :
 * on regroupe les appels. Compte d'appels git par depot NORMAL : 6
 *   1) git config --list            (identite + remotes)
 *   2) git status --porcelain=v2    (3 zones + branche courante + ahead/behind)
 *   3) git rev-parse --short HEAD    (sha de HEAD)
 *   4) git for-each-ref heads+remotes+tags  (branches/remotes/tags d'un coup)
 *   5) git stash list
 *   6) git log --all                 (le graphe)
 * Un depot BARE : 5 (status remplace par symbolic-ref, pas de stash).
 */
const { git, gitFull, US } = require('./git');

const LOG_LIMIT = parseInt(process.env.WATCH_LOG_LIMIT || '300', 10);

function splitLines(s) { return s ? s.split('\n').filter((l) => l.length > 0) : []; }

const CODE_LABEL = {
  M: 'modified', A: 'added', D: 'deleted', R: 'renamed',
  C: 'copied', T: 'typechange', U: 'unmerged', '?': 'untracked',
};
function label(code) { return CODE_LABEL[code] || code; }

// --- parsing de `git status --porcelain=v2 --branch` -------------------------
function parseStatus(text) {
  const staged = [], unstaged = [], untracked = [], conflicted = [];
  let aheadBehind = null, upstream = null, branchHead = null;

  for (const line of splitLines(text)) {
    if (line.startsWith('# ')) {
      const m = line.slice(2);
      if (m.startsWith('branch.head ')) branchHead = m.slice('branch.head '.length);
      else if (m.startsWith('branch.upstream ')) upstream = m.slice('branch.upstream '.length);
      else if (m.startsWith('branch.ab ')) {
        const mm = m.match(/\+(-?\d+)\s+-(-?\d+)/);
        if (mm) aheadBehind = { ahead: parseInt(mm[1], 10), behind: parseInt(mm[2], 10) };
      }
      continue;
    }
    const type = line[0];
    if (type === '1' || type === '2') {
      const parts = line.split(' ');
      const X = parts[1][0], Y = parts[1][1];
      let pathStr;
      if (type === '1') pathStr = parts.slice(8).join(' ');
      else pathStr = parts.slice(9).join(' ').split('\t')[0];
      if (X !== '.') staged.push({ path: pathStr, code: X, label: label(X) });
      if (Y !== '.') unstaged.push({ path: pathStr, code: Y, label: label(Y) });
    } else if (type === 'u') {
      conflicted.push({ path: line.split(' ').slice(10).join(' '), code: 'U', label: 'conflict' });
    } else if (type === '?') {
      untracked.push({ path: line.slice(2), code: '?', label: 'untracked' });
    }
  }
  const clean = !staged.length && !unstaged.length && !untracked.length && !conflicted.length;
  return { clean, staged, unstaged, untracked, conflicted, aheadBehind, upstream, branchHead };
}

function parseTrack(track) {
  if (!track) return null;
  if (/gone/.test(track)) return { gone: true };
  const a = track.match(/ahead (\d+)/), b = track.match(/behind (\d+)/);
  if (!a && !b) return null;
  return { ahead: a ? parseInt(a[1], 10) : 0, behind: b ? parseInt(b[1], 10) : 0 };
}

// --- inspection principale ---------------------------------------------------
async function inspectRepo(repo) {
  const snap = {
    id: repo.id || repo.path, name: repo.name, path: repo.path, type: repo.type,
    identity: { name: '', email: '' },
    head: { branch: null, detached: false, unborn: false, sha: null },
    status: null, branches: [], remoteBranches: [], tags: [], remotes: [],
    stashes: [], commits: [], error: null,
  };

  try {
    // 1) identite + remotes en UN appel (git config --list)
    const cfg = await git(repo, ['config', '--list']);
    for (const line of splitLines(cfg)) {
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const key = line.slice(0, eq), val = line.slice(eq + 1);
      if (key === 'user.name') snap.identity.name = val;
      else if (key === 'user.email') snap.identity.email = val;
      else {
        const m = key.match(/^remote\.(.+)\.url$/);
        if (m && !snap.remotes.some((r) => r.name === m[1])) snap.remotes.push({ name: m[1], url: val });
      }
    }

    // 2) branche courante + 3 zones
    if (repo.type === 'normal') {
      const st = await git(repo, ['status', '--porcelain=v2', '--branch']);
      snap.status = parseStatus(st);
      if (snap.status.branchHead === '(detached)') snap.head.detached = true;
      else if (snap.status.branchHead) snap.head.branch = snap.status.branchHead;
    } else {
      const hr = await gitFull(repo, ['symbolic-ref', '--short', 'HEAD']);
      if (hr.code === 0) snap.head.branch = hr.stdout.trim(); else snap.head.detached = true;
    }

    // 3) sha de HEAD
    const headSha = await gitFull(repo, ['rev-parse', '--short', 'HEAD']);
    if (headSha.code === 0) snap.head.sha = headSha.stdout.trim(); else snap.head.unborn = true;

    // 4) branches + remotes + tags en UN for-each-ref
    const fmt = ['%(refname)', '%(objectname:short)', '%(upstream:short)', '%(upstream:track)', '%(HEAD)'].join(US);
    const refs = await git(repo, ['for-each-ref', `--format=${fmt}`, 'refs/heads', 'refs/remotes', 'refs/tags']);
    for (const line of splitLines(refs)) {
      const [refname, sha, up, track, headMark] = line.split(US);
      if (refname.startsWith('refs/heads/')) {
        snap.branches.push({ name: refname.slice(11), sha, upstream: up || null, track: parseTrack(track), isHead: headMark === '*' });
      } else if (refname.startsWith('refs/remotes/')) {
        const name = refname.slice(13);
        if (!/\/HEAD$/.test(name)) snap.remoteBranches.push({ name, sha });
      } else if (refname.startsWith('refs/tags/')) {
        snap.tags.push({ name: refname.slice(10), sha });
      }
    }

    // 5) stash (depots normaux)
    if (repo.type === 'normal') {
      const stOut = await git(repo, ['stash', 'list', `--format=%gd${US}%gs`]);
      for (const line of splitLines(stOut)) { const [ref, message] = line.split(US); snap.stashes.push({ ref, message }); }
    }

    // 6) graphe (toutes les refs)
    const logFmt = ['%H', '%h', '%P', '%an', '%ae', '%at', '%D', '%s'].join(US);
    const logRes = await gitFull(repo, ['log', '--all', '--date-order', '-n', String(LOG_LIMIT), `--pretty=format:${logFmt}`]);
    if (logRes.code === 0) {
      for (const line of splitLines(logRes.stdout)) {
        const f = line.split(US);
        snap.commits.push({
          sha: f[0], short: f[1],
          parents: f[2] ? f[2].split(' ').filter(Boolean) : [],
          author: f[3], email: f[4], at: parseInt(f[5], 10) || 0,
          refs: f[6] ? f[6].split(',').map((s) => s.trim()).filter(Boolean) : [],
          subject: f[7] || '',
        });
      }
    }
  } catch (e) {
    snap.error = String(e && e.message ? e.message : e);
  }

  return snap;
}

module.exports = { inspectRepo, parseStatus };
