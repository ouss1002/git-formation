'use strict';
/*
 * server.js — serveur du tableau de bord.
 *
 *   node server.js <dossier>
 *
 * 1. Scanne <dossier> pour trouver les depots (normaux + bare).
 * 2. Sert l'UI (public/) sur http://localhost:4242
 * 3. Pousse en LIVE (WebSocket) un snapshot a chaque changement, grace a :
 *      - chokidar  -> reaction instantanee aux modifs fichiers / .git
 *      - un poll de securite (toutes les 3s) -> rattrape ce que chokidar raterait
 *    On ne diffuse que si le snapshot a REELLEMENT change (comparaison de hash),
 *    donc pas de scintillement.
 */
const http = require('http');
const path = require('path');
const express = require('express');
const chokidar = require('chokidar');
const { WebSocketServer } = require('ws');

const { scanRepos } = require('./lib/scanner');
const { inspectRepo } = require('./lib/inspector');

// --- config ------------------------------------------------------------------
const PORT = parseInt(process.env.PORT || '4242', 10);
const argDir = process.argv[2] || process.env.WATCH_DIR || path.join('..', 'playground');
const ROOT = path.resolve(process.cwd(), argDir);

// --- etat --------------------------------------------------------------------
let reposIndex = [];                 // descripteurs (scanner)
const snapshots = new Map();         // id -> snapshot
const hashes = new Map();            // id -> hash (json)
const debounceTimers = new Map();    // id -> timeout
const lastPulse = new Map();         // id -> ts (throttle ticker)
let rescanTimer = null;

// --- WebSocket ---------------------------------------------------------------
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/repos', (_req, res) =>
  res.json({ root: ROOT, repos: orderedSnapshots() }));
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, root: ROOT, count: reposIndex.length }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'snapshot', root: ROOT, repos: orderedSnapshots() }));
});

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

function orderedSnapshots() {
  return reposIndex.map((r) => snapshots.get(r.id)).filter(Boolean);
}

// --- inspection / diffusion --------------------------------------------------
async function refreshRepo(repo) {
  let snap;
  try { snap = await inspectRepo(repo); }
  catch (e) { return; }
  const h = JSON.stringify(snap);
  if (hashes.get(repo.id) === h) return false;   // rien de neuf -> silence
  hashes.set(repo.id, h);
  snapshots.set(repo.id, snap);
  broadcast({ type: 'update', repo: snap });
  return true;
}

function scheduleRefresh(repo) {
  if (debounceTimers.has(repo.id)) clearTimeout(debounceTimers.get(repo.id));
  debounceTimers.set(repo.id, setTimeout(() => {
    debounceTimers.delete(repo.id);
    refreshRepo(repo);
  }, 180));
}

async function fullRescan() {
  const found = scanRepos(ROOT);
  const newIds = new Set(found.map((r) => r.id));
  const oldIds = new Set(reposIndex.map((r) => r.id));

  // suppressions
  for (const id of oldIds) {
    if (!newIds.has(id)) {
      snapshots.delete(id); hashes.delete(id);
      broadcast({ type: 'remove', id });
    }
  }
  reposIndex = found;

  // (re)inspection de tout le monde
  let membershipChanged = newIds.size !== oldIds.size;
  for (const id of newIds) if (!oldIds.has(id)) membershipChanged = true;
  await Promise.all(found.map((r) => refreshRepo(r)));

  if (membershipChanged) {
    broadcast({ type: 'snapshot', root: ROOT, repos: orderedSnapshots() });
  }
}

function scheduleRescan() {
  if (rescanTimer) clearTimeout(rescanTimer);
  rescanTimer = setTimeout(() => { rescanTimer = null; fullRescan(); }, 350);
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

// --- "ticker" d'activite (pour le fun) --------------------------------------
function maybePulse(repo, filePath) {
  const now = Date.now();
  if ((now - (lastPulse.get(repo.id) || 0)) < 150) return;
  lastPulse.set(repo.id, now);
  broadcast({
    type: 'pulse',
    repoId: repo.id,
    repoName: repo.name,
    file: path.basename(filePath),
  });
}

// --- watcher chokidar --------------------------------------------------------
function ignored(p) {
  return /[\\/](objects|node_modules|\.idea|\.vscode)[\\/]/.test(p) || p.endsWith('.lock');
}

function startWatcher() {
  const watcher = chokidar.watch(ROOT, {
    ignored,
    ignoreInitial: true,
    persistent: true,
    usePolling: process.env.WATCH_POLL === '1',
    interval: 250,
    depth: 20,
  });

  const onEvent = (eventPath) => {
    const repo = repoForPath(eventPath);
    if (repo) { maybePulse(repo, eventPath); scheduleRefresh(repo); }
    else { scheduleRescan(); }            // dossier hors depot connu -> peut-etre un nouveau clone
  };

  watcher
    .on('add', onEvent)
    .on('change', onEvent)
    .on('unlink', onEvent)
    .on('addDir', (p) => { if (!repoForPath(p)) scheduleRescan(); })
    .on('unlinkDir', () => scheduleRescan())
    .on('error', (e) => console.error('[watch] erreur:', e.message));

  return watcher;
}

// --- demarrage ---------------------------------------------------------------
async function main() {
  console.log('\x1b[36m%s\x1b[0m', '┌──────────────────────────────────────────────┐');
  console.log('\x1b[36m%s\x1b[0m', '│   GIT FORMATION — Tableau de bord live        │');
  console.log('\x1b[36m%s\x1b[0m', '└──────────────────────────────────────────────┘');
  console.log('  Dossier observe :', ROOT);

  await fullRescan();
  if (reposIndex.length === 0) {
    console.log('\x1b[33m%s\x1b[0m', '  ⚠  Aucun depot trouve. Lance d\'abord scripts/setup-repos.ps1');
  } else {
    console.log('  Depots detectes :', reposIndex.length);
    for (const r of reposIndex) {
      console.log(`    - ${r.name}  [${r.type}]`);
    }
  }

  startWatcher();
  setInterval(() => { for (const r of reposIndex) refreshRepo(r); }, 3000); // filet de securite
  setInterval(fullRescan, 9000);                                            // ajout/suppression de depots

  server.listen(PORT, () => {
    console.log('\x1b[32m%s\x1b[0m', `\n  ▶  Ouvre  http://localhost:${PORT}\n`);
  });
}

main();
