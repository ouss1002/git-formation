'use strict';
/*
 * server.js — serveur du tableau de bord.
 *
 *   node server.js <dossier>            (defaut : ../playground)
 *   $env:WATCH_DEBUG="1"; node server.js ../playground   -> logs detailles
 *
 * Points cles (pensés pour les machines lentes / antivirus d'entreprise) :
 *  - Le serveur ECOUTE D'ABORD : la page s'affiche tout de suite, meme si
 *    l'inspection des depots est lente. Les depots apparaissent au fur et a mesure.
 *  - Auto-diagnostic au demarrage : on chronometre `git` (si chaque spawn est lent,
 *    c'est presque toujours un antivirus/EDR qui inspecte git.exe).
 *  - Tout est logue avec un horodatage. WATCH_DEBUG=1 pour le detail (appels git lents...).
 *
 * Variables d'environnement utiles :
 *   PORT=4242                 port HTTP
 *   WATCH_DEBUG=1             logs detailles
 *   WATCH_POLL_MS=5000        intervalle de re-inspection de securite (0 = desactive)
 *   WATCH_RESCAN_MS=15000     intervalle de re-scan (ajout/suppression de depots)
 *   WATCH_FS_POLLING=1        chokidar en mode polling (lecteurs reseau / VM)
 *   WATCH_LOG_LIMIT=300       nb de commits charges pour le graphe
 *   WATCH_GIT_TIMEOUT_MS=20000  tue un `git` qui bloque
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const chokidar = require('chokidar');
const { WebSocketServer } = require('ws');

const { scanRepos } = require('./lib/scanner');
const { inspectRepo } = require('./lib/inspector');
const { runRaw, gitStats } = require('./lib/git');
const { log, dbg, warn, DEBUG } = require('./lib/log');

// --- config ------------------------------------------------------------------
const PORT = parseInt(process.env.PORT || '4242', 10);
const POLL_MS = parseInt(process.env.WATCH_POLL_MS || '5000', 10);
const RESCAN_MS = parseInt(process.env.WATCH_RESCAN_MS || '15000', 10);
const USE_POLLING = process.env.WATCH_FS_POLLING === '1';
const CONCURRENCY = Math.max(1, parseInt(process.env.WATCH_CONCURRENCY || '4', 10));
const argDir = process.argv.find((a, i) => i >= 2 && !a.startsWith('-')) || process.env.WATCH_DIR || path.join('..', 'playground');
const ROOT = path.resolve(process.cwd(), argDir);

// --- etat --------------------------------------------------------------------
let reposIndex = [];
const snapshots = new Map();
const hashes = new Map();
const debounceTimers = new Map();
const lastPulse = new Map();
const lastSig = new Map();   // id -> signature (dates de .git) pour sauter les inspections inutiles
let rescanTimer = null;
let polling = false, rescanning = false;
let clientSeq = 0;

// --- app / serveur -----------------------------------------------------------
const app = express();

// journal HTTP : voir si la page et ses ressources sont bien servies
app.use((req, res, next) => {
  const t = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - t;
    if (DEBUG || req.url.startsWith('/api') || ms > 300) {
      log(`HTTP ${res.statusCode} ${req.method} ${req.url} (${ms}ms)`);
    }
  });
  next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/repos', (_req, res) => res.json({ root: ROOT, repos: orderedSnapshots() }));
app.get('/api/health', (_req, res) => res.json({ ok: true, root: ROOT, count: reposIndex.length, git: gitStats() }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws._id = ++clientSeq;
  log(`WS+ client #${ws._id} connecté (${wss.clients.size} au total)`);
  try { ws.send(JSON.stringify({ type: 'snapshot', root: ROOT, repos: orderedSnapshots() })); } catch { /* ignore */ }
  ws.on('close', () => log(`WS- client #${ws._id} parti (${wss.clients.size} restant·s)`));
  ws.on('error', (e) => warn(`WS erreur client #${ws._id}: ${e.message}`));
});

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  let n = 0;
  for (const c of wss.clients) if (c.readyState === 1) { c.send(msg); n++; }
  if (obj.type !== 'pulse') dbg(`broadcast ${obj.type}${obj.repo ? ' ' + obj.repo.name : ''} -> ${n} client·s`);
}

function orderedSnapshots() {
  return reposIndex.map((r) => snapshots.get(r.id)).filter(Boolean);
}

// Execute fn sur chaque item avec au plus `limit` en parallele (pour que les
// spawns git lents se CHEVAUCHENT au lieu de s'enchainer un par un).
async function runLimited(items, limit, fn) {
  const queue = items.slice();
  const workers = Array.from({ length: Math.min(limit, queue.length || 1) }, async () => {
    while (queue.length) { const it = queue.shift(); await fn(it); }
  });
  await Promise.all(workers);
}

// --- signature bon marche d'un depot (dates de fichiers .git, sans lancer git) -
function statMs(p) { try { return fs.statSync(p).mtimeMs; } catch { return 0; } }
function repoSignature(repo) {
  const g = repo.type === 'normal' ? path.join(repo.path, '.git') : repo.path;
  let s = 0;
  // fichiers qui changent a chaque commit / add / switch / merge / stash / fetch
  for (const rel of ['HEAD', 'index', 'packed-refs', 'ORIG_HEAD', 'MERGE_HEAD', 'FETCH_HEAD']) {
    const m = statMs(path.join(g, rel)); if (m > s) s = m;
  }
  // dossiers de refs/logs (leur mtime bouge quand une ref est ajoutee/supprimee)
  for (const rel of ['refs', 'refs/heads', 'refs/tags', 'refs/remotes', 'logs']) {
    const m = statMs(path.join(g, rel.split('/').join(path.sep))); if (m > s) s = m;
  }
  return s;
}

// --- inspection / diffusion --------------------------------------------------
// refreshRepo = inspection FORCEE (lance git). Memorise la signature au passage.
async function refreshRepo(repo) {
  let snap;
  try { snap = await inspectRepo(repo); }
  catch (e) { warn(`inspection ${repo.name} a échoué: ${e.message}`); return false; }
  lastSig.set(repo.id, repoSignature(repo));
  const h = JSON.stringify(snap);
  if (hashes.get(repo.id) === h) return false;
  hashes.set(repo.id, h);
  snapshots.set(repo.id, snap);
  broadcast({ type: 'update', repo: snap });
  return true;
}

// maybeRefresh = inspection PARESSEUSE : ne lance git que si .git a bougé.
// Renvoie 'skip' si rien n'a changé (aucun git lancé), sinon le resultat de refreshRepo.
async function maybeRefresh(repo) {
  if (hashes.has(repo.id) && lastSig.get(repo.id) === repoSignature(repo)) return 'skip';
  return refreshRepo(repo);
}

function scheduleRefresh(repo) {
  if (debounceTimers.has(repo.id)) clearTimeout(debounceTimers.get(repo.id));
  debounceTimers.set(repo.id, setTimeout(() => { debounceTimers.delete(repo.id); refreshRepo(repo); }, 180));
}

async function fullRescan(initial = false) {
  if (rescanning) { dbg('rescan: saute (deja en cours)'); return; }
  rescanning = true;
  const t = Date.now();
  try {
    const found = scanRepos(ROOT);
    const newIds = new Set(found.map((r) => r.id));
    const oldIds = new Set(reposIndex.map((r) => r.id));
    for (const id of oldIds) if (!newIds.has(id)) {
      snapshots.delete(id); hashes.delete(id);
      log(`depot retiré: ${id}`); broadcast({ type: 'remove', id });
    }
    let membershipChanged = newIds.size !== oldIds.size;
    for (const id of newIds) if (!oldIds.has(id)) membershipChanged = true;
    reposIndex = found;

    if (initial) {
      log(`${found.length} depot(s) trouvé(s): ${found.map((r) => `${r.name}(${r.type})`).join(', ') || '— aucun —'}`);
      // inspection avec concurrence limitee + diffusion incrementale : les depots
      // apparaissent au fur et a mesure (par paquets de WATCH_CONCURRENCY).
      await runLimited(found, CONCURRENCY, async (r) => {
        const s = Date.now();
        await refreshRepo(r);
        log(`  inspecté ${r.name} en ${Date.now() - s}ms`);
      });
    } else {
      await Promise.all(found.map((r) => maybeRefresh(r)));   // paresseux : git seulement si .git a bougé
    }

    if (membershipChanged) broadcast({ type: 'snapshot', root: ROOT, repos: orderedSnapshots() });
  } finally {
    rescanning = false;
    dbg(`rescan terminé en ${Date.now() - t}ms`);
  }
}

function scheduleRescan() {
  if (rescanTimer) clearTimeout(rescanTimer);
  rescanTimer = setTimeout(() => { rescanTimer = null; fullRescan(false); }, 350);
}

async function pollAll() {
  if (polling || rescanning) { dbg('poll: saute (occupé)'); return; }
  polling = true;
  const t = Date.now();
  try {
    let changed = 0, inspected = 0;
    for (const r of reposIndex) {
      const res = await maybeRefresh(r);   // ne lance git que si .git a bougé
      if (res === 'skip') continue;
      inspected++; if (res) changed++;
    }
    dbg(`poll: ${inspected}/${reposIndex.length} inspectés (reste sauté, .git inchangé), ${changed} changement·s en ${Date.now() - t}ms`);
  } finally { polling = false; }
}

// --- mapping chemin -> depot -------------------------------------------------
function repoForPath(p) {
  const rp = path.resolve(p);
  let best = null, bestLen = -1;
  for (const r of reposIndex) {
    const base = path.resolve(r.path);
    if (rp === base || rp.startsWith(base + path.sep)) {
      if (base.length > bestLen) { best = r; bestLen = base.length; }
    }
  }
  return best;
}

function maybePulse(repo, filePath) {
  const now = Date.now();
  if ((now - (lastPulse.get(repo.id) || 0)) < 150) return;
  lastPulse.set(repo.id, now);
  broadcast({ type: 'pulse', repoId: repo.id, repoName: repo.name, file: path.basename(filePath) });
}

// --- watcher chokidar --------------------------------------------------------
function ignored(p) {
  return /[\\/](objects|node_modules|\.idea|\.vscode)[\\/]/.test(p) || p.endsWith('.lock');
}

function startWatcher() {
  const watcher = chokidar.watch(ROOT, {
    ignored, ignoreInitial: true, persistent: true,
    usePolling: USE_POLLING, interval: 250, depth: 20,
  });
  const onEvent = (eventPath) => {
    const repo = repoForPath(eventPath);
    if (repo) { maybePulse(repo, eventPath); scheduleRefresh(repo); }
    else scheduleRescan();
  };
  watcher
    .on('add', onEvent).on('change', onEvent).on('unlink', onEvent)
    .on('addDir', (p) => { if (!repoForPath(p)) scheduleRescan(); })
    .on('unlinkDir', () => scheduleRescan())
    .on('ready', () => dbg('chokidar prêt (surveillance active)'))
    .on('error', (e) => warn(`chokidar: ${e.message}`));
  return watcher;
}

// --- demarrage ---------------------------------------------------------------
process.on('unhandledRejection', (e) => warn('unhandledRejection:', e && e.message ? e.message : e));
process.on('uncaughtException', (e) => warn('uncaughtException:', e && e.message ? e.message : e));

async function main() {
  log('────────────────────────────────────────────────');
  log('GIT FORMATION — tableau de bord live');
  log(`Node ${process.version} · ${process.platform} · debug=${DEBUG}`);
  log(`Dossier observé : ${ROOT}`);
  log(`Config : PORT=${PORT} POLL=${POLL_MS}ms RESCAN=${RESCAN_MS}ms FS_POLLING=${USE_POLLING} CONCURRENCY=${CONCURRENCY}`);

  // 1) ECOUTER D'ABORD : la page doit s'afficher immediatement.
  server.listen(PORT, () => {
    log(`\x1b[32m✔ Serveur prêt → http://localhost:${PORT}\x1b[0m`);
    log('  (la page doit s\'afficher tout de suite ; les dépôts arrivent ensuite)');
  });

  // 2) Auto-diagnostic : combien de temps pour lancer `git` ?
  const v = await runRaw(['--version']);
  log(`git : ${v.stdout.trim() || '??'} — un spawn a pris ${v.ms}ms`);
  if (v.ms > 1500) {
    warn(`Lancer 'git' est LENT (${v.ms}ms par spawn).`);
    warn(`  -> Cause probable : antivirus / EDR d'entreprise qui inspecte chaque git.exe.`);
    warn(`  -> Chaque dépôt demande ~6 'git'. Le 1er affichage peut prendre du temps,`);
    warn(`     mais la page elle-même est déjà servie. Patiente, ça se remplit.`);
  }

  // 3) Inspection initiale (incrementale).
  const t = Date.now();
  await fullRescan(true);
  const st = gitStats();
  log(`Inspection initiale : ${reposIndex.length} dépôt(s) en ${Date.now() - t}ms ` +
      `(${st.calls} appels git, ${st.totalMs}ms cumulés, ${st.slow} lents, ${st.timeouts} timeouts)`);
  if (reposIndex.length === 0) {
    warn(`Aucun dépôt trouvé. Lance d'abord scripts/setup-repos.ps1, ou vérifie le chemin : ${ROOT}`);
  }

  // 4) Live : watcher + filets de securite.
  startWatcher();
  // Auto-planification (setTimeout en chaîne) : on attend l'intervalle APRÈS la fin
  // de chaque cycle. Sur une machine lente, ça garantit un vrai temps de repos entre
  // deux inspections (jamais d'empilement), au lieu d'un setInterval rigide.
  (function loopPoll() {
    if (POLL_MS <= 0) { log('poll de sécurité désactivé (WATCH_POLL_MS=0)'); return; }
    setTimeout(async () => { await pollAll(); loopPoll(); }, POLL_MS);
  })();
  (function loopRescan() {
    if (RESCAN_MS <= 0) return;
    setTimeout(async () => { await fullRescan(false); loopRescan(); }, RESCAN_MS);
  })();
}

main();
