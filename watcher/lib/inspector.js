'use strict';
/*
 * inspector.js — produit un "snapshot" complet d'un depot, pret a envoyer au navigateur.
 *
 * Le snapshot decrit, pour chaque depot :
 *   identity      : { name, email }                 (qui signe les commits)
 *   head          : { branch, detached, unborn, sha }
 *   status        : etat des 3 zones (null pour un depot bare, pas de working dir)
 *                   { clean, staged[], unstaged[], untracked[], conflicted[], aheadBehind }
 *   branches[]    : branches locales (+ upstream, ahead/behind, courante)
 *   remoteBranches[] / tags[] / remotes[] / stashes[]
 *   commits[]     : pour dessiner le graphe (sha, parents, auteur, date, refs, sujet)
 */
const { git, gitFull, US } = require('./git');

// --- helpers -----------------------------------------------------------------
function splitLines(s) {
  return s ? s.split('\n').filter((l) => l.length > 0) : [];
}

const CODE_LABEL = {
  M: 'modifie', A: 'ajoute', D: 'supprime', R: 'renomme',
  C: 'copie', T: 'type', U: 'non-fusionne', '?': 'non-suivi',
};
function label(code) { return CODE_LABEL[code] || code; }

// --- parsing de `git status --porcelain=v2 --branch` -------------------------
function parseStatus(text) {
  const staged = [];
  const unstaged = [];
  const untracked = [];
  const conflicted = [];
  let aheadBehind = null;
  let upstream = null;
  let branchHead = null;

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
      // 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
      // 2 <XY> ... <X><score> <path>\t<orig>
      const parts = line.split(' ');
      const xy = parts[1];
      const X = xy[0]; // index (staged)
      const Y = xy[1]; // worktree (unstaged)
      // chemin = tout ce qui suit le 8e (type 1) ou gere la tabulation (type 2)
      let pathStr;
      if (type === '1') {
        pathStr = parts.slice(8).join(' ');
      } else {
        const rest = parts.slice(9).join(' ');
        pathStr = rest.split('\t')[0]; // nouveau nom
      }
      if (X !== '.') staged.push({ path: pathStr, code: X, label: label(X) });
      if (Y !== '.') unstaged.push({ path: pathStr, code: Y, label: label(Y) });
    } else if (type === 'u') {
      // u <xy> ... <path>
      const parts = line.split(' ');
      const pathStr = parts.slice(10).join(' ');
      conflicted.push({ path: pathStr, code: 'U', label: 'conflit' });
    } else if (type === '?') {
      untracked.push({ path: line.slice(2), code: '?', label: 'non-suivi' });
    }
    // '!' (ignores) volontairement omis
  }

  const clean =
    staged.length === 0 && unstaged.length === 0 &&
    untracked.length === 0 && conflicted.length === 0;

  return { clean, staged, unstaged, untracked, conflicted, aheadBehind, upstream, branchHead };
}

// --- branches locales --------------------------------------------------------
function parseTrack(track) {
  // track = "[ahead 2, behind 1]" | "[gone]" | ""
  if (!track) return null;
  if (/gone/.test(track)) return { gone: true };
  const a = track.match(/ahead (\d+)/);
  const b = track.match(/behind (\d+)/);
  if (!a && !b) return null;
  return { ahead: a ? parseInt(a[1], 10) : 0, behind: b ? parseInt(b[1], 10) : 0 };
}

// --- inspection principale ---------------------------------------------------
async function inspectRepo(repo) {
  const snap = {
    id: repo.id || repo.path,
    name: repo.name,
    path: repo.path,
    type: repo.type, // 'normal' | 'bare'
    identity: { name: '', email: '' },
    head: { branch: null, detached: false, unborn: false, sha: null },
    status: null,
    branches: [],
    remoteBranches: [],
    tags: [],
    remotes: [],
    stashes: [],
    commits: [],
    error: null,
  };

  try {
    // Identite
    snap.identity.name = await git(repo, ['config', 'user.name']);
    snap.identity.email = await git(repo, ['config', 'user.email']);

    // HEAD
    const headRef = await gitFull(repo, ['symbolic-ref', '--short', 'HEAD']);
    if (headRef.code === 0) {
      snap.head.branch = headRef.stdout.trim();
    } else {
      snap.head.detached = true;
    }
    const headSha = await gitFull(repo, ['rev-parse', '--short', 'HEAD']);
    if (headSha.code === 0) snap.head.sha = headSha.stdout.trim();
    else snap.head.unborn = true;

    // Statut (uniquement pour les depots avec working directory)
    if (repo.type === 'normal') {
      const st = await git(repo, ['status', '--porcelain=v2', '--branch']);
      snap.status = parseStatus(st);
      if (snap.status.branchHead && snap.status.branchHead !== '(detached)') {
        snap.head.branch = snap.status.branchHead;
      }
    }

    // Branches locales
    const brFmt = ['%(refname:short)', '%(objectname:short)', '%(upstream:short)',
      '%(upstream:track)', '%(HEAD)'].join(US);
    const brOut = await git(repo, ['for-each-ref', `--format=${brFmt}`, 'refs/heads']);
    for (const line of splitLines(brOut)) {
      const [name, sha, up, track, headMark] = line.split(US);
      snap.branches.push({
        name, sha,
        upstream: up || null,
        track: parseTrack(track),
        isHead: headMark === '*',
      });
    }

    // Branches distantes
    const rbOut = await git(repo, ['for-each-ref',
      `--format=%(refname:short)${US}%(objectname:short)`, 'refs/remotes']);
    for (const line of splitLines(rbOut)) {
      const [name, sha] = line.split(US);
      if (/\/HEAD$/.test(name)) continue;
      snap.remoteBranches.push({ name, sha });
    }

    // Tags
    const tagOut = await git(repo, ['for-each-ref',
      `--format=%(refname:short)${US}%(objectname:short)`, 'refs/tags']);
    for (const line of splitLines(tagOut)) {
      const [name, sha] = line.split(US);
      snap.tags.push({ name, sha });
    }

    // Remotes
    const remOut = await git(repo, ['remote', '-v']);
    const seenRem = new Set();
    for (const line of splitLines(remOut)) {
      const m = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)/);
      if (m && !seenRem.has(m[1])) { seenRem.add(m[1]); snap.remotes.push({ name: m[1], url: m[2] }); }
    }

    // Stashes (depots normaux uniquement)
    if (repo.type === 'normal') {
      const stOut = await git(repo, ['stash', 'list', `--format=%gd${US}%gs`]);
      for (const line of splitLines(stOut)) {
        const [ref, message] = line.split(US);
        snap.stashes.push({ ref, message });
      }
    }

    // Commits (pour le graphe) : toutes les refs, ordre topo/chrono
    const logFmt = ['%H', '%h', '%P', '%an', '%ae', '%at', '%D', '%s'].join(US);
    const logRes = await gitFull(repo, ['log', '--all', '--date-order',
      '-n', '400', `--pretty=format:${logFmt}`]);
    if (logRes.code === 0) {
      for (const line of splitLines(logRes.stdout)) {
        const f = line.split(US);
        snap.commits.push({
          sha: f[0],
          short: f[1],
          parents: f[2] ? f[2].split(' ').filter(Boolean) : [],
          author: f[3],
          email: f[4],
          at: parseInt(f[5], 10) || 0,
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
