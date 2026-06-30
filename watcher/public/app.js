/* =========================================================================
   app.js — client du tableau de bord : WebSocket + rendu.
   ========================================================================= */
(function () {
  'use strict';

  const state = { order: [], byId: new Map(), selected: null, root: '' };
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const timeAgo = (ts) => window.GitGraph.timeAgo(ts);

  // ---------- couleurs / avatars ----------
  function hue(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
  function avatarStyle(snap) {
    if (snap.type === 'bare')
      return 'background:linear-gradient(135deg,#f5d472,#d99a00);';
    const h = hue(snap.name);
    return `background:linear-gradient(135deg,hsl(${h},75%,60%),hsl(${(h + 40) % 360},75%,48%));`;
  }
  function initials(snap) {
    if (snap.type === 'bare') return (snap.name.slice(0, 2) || '?').toUpperCase();
    return (snap.name[0] || '?').toUpperCase();
  }

  // ---------- sidebar ----------
  function renderSidebar() {
    $('repoCount').textContent = state.order.length;
    const html = state.order.map((id) => {
      const s = state.byId.get(id);
      if (!s) return '';
      const active = id === state.selected ? ' active' : '';
      const bare = s.type === 'bare' ? ' bare' : '';
      const st = s.status;
      let counts = '';
      if (s.type === 'bare') {
        counts = `<span class="cnt clean">exchange only</span>`;
      } else if (st) {
        const c = [];
        if (st.conflicted.length) c.push(`<span class="cnt conflict">⚠ ${st.conflicted.length}</span>`);
        if (st.staged.length) c.push(`<span class="cnt staged">✚ ${st.staged.length}</span>`);
        if (st.unstaged.length) c.push(`<span class="cnt modified">● ${st.unstaged.length}</span>`);
        if (st.untracked.length) c.push(`<span class="cnt untracked">? ${st.untracked.length}</span>`);
        if (st.aheadBehind) {
          if (st.aheadBehind.ahead) c.push(`<span class="cnt ahead">↑${st.aheadBehind.ahead}</span>`);
          if (st.aheadBehind.behind) c.push(`<span class="cnt behind">↓${st.aheadBehind.behind}</span>`);
        }
        if (!c.length) c.push(`<span class="cnt clean">✓ clean</span>`);
        if (s.stashes.length) c.push(`<span class="cnt untracked">⊟ ${s.stashes.length}</span>`);
        counts = c.join('');
      }
      const branch = s.head.detached
        ? `<span class="branch-chip">detached @ ${esc(s.head.sha || '')}</span>`
        : `<span class="branch-chip">⌥ ${esc(s.head.branch || '?')}</span>`;
      const badge = s.type === 'bare'
        ? `<span class="badge qg">remote</span>`
        : `<span class="badge local">local</span>`;
      return `
        <div class="repo-card${active}${bare}" data-id="${esc(id)}">
          <div class="avatar${s.type === 'bare' ? ' qg' : ''}" style="${avatarStyle(s)}">${initials(s)}</div>
          <div class="repo-meta">
            <div class="repo-name">${esc(s.name)} ${badge}</div>
            <div class="repo-sub">${branch}</div>
            <div class="dots">${counts}</div>
          </div>
        </div>`;
    }).join('');
    $('repoList').innerHTML = html;
    document.querySelectorAll('.repo-card').forEach((el) =>
      el.addEventListener('click', () => select(el.dataset.id)));
  }

  // ---------- detail : 3 zones ----------
  function chip(cls, tag, name) {
    return `<div class="chip ${cls}"><span class="tag">${tag}</span>${esc(name)}</div>`;
  }
  function zonesCard(s) {
    const st = s.status;
    if (s.type === 'bare') {
      return `
      <div class="card" data-zone>
        <h2>Remote (bare repo)</h2>
        <p class="hint">Pas de <b>working directory</b> ici : un repo <b>bare</b> ne sert qu'à
        <b>échanger</b> l'historique. C'est la cible des <code>push</code> et la source des
        <code>fetch</code>/<code>pull</code> de tout le monde.</p>
        <div class="note">Branches publiées : ${
          s.branches.length ? s.branches.map((b) => `<span class="bl-item">${esc(b.name)}</span>`).join(' ') : '—'
        }</div>
      </div>`;
    }
    const workChips =
      st.conflicted.map((f) => chip('conflict', 'conflict', f.path)).join('') +
      st.unstaged.map((f) => chip('modified', f.label, f.path)).join('') +
      st.untracked.map((f) => chip('untracked', 'untracked', f.path)).join('');
    const stageChips = st.staged.map((f) => chip('staged', f.label, f.path)).join('');

    const head = s.commits[0];
    const repoChip = head
      ? `<div class="chip commit"><span class="tag">HEAD</span><b>${esc(head.short)}</b> ${esc(head.subject.slice(0, 40))}</div>`
      : `<div class="vide">no commit</div>`;

    let remoteInner = '<div class="vide">no upstream</div>';
    const ab = st.aheadBehind;
    if (st.upstream) {
      const parts = [`<div class="note" style="margin-bottom:6px">↔ ${esc(st.upstream)}</div>`];
      if (ab && ab.ahead) parts.push(`<div class="chip staged"><span class="tag">ahead</span>↑ ${ab.ahead} commit(s)</div>`);
      if (ab && ab.behind) parts.push(`<div class="chip modified"><span class="tag">behind</span>↓ ${ab.behind} commit(s)</div>`);
      if (ab && !ab.ahead && !ab.behind) parts.push(`<div class="chip staged"><span class="tag">sync</span>up to date ✓</div>`);
      remoteInner = parts.join('');
    }

    const zN = (n) => `<span class="n">${n}</span>`;
    return `
      <div class="card" data-zone>
        <h2>Les 3 zones (+ Remote)</h2>
        <p class="hint">Le parcours d'une modif : tu travailles dans le <b>Working Directory</b>, tu choisis
        quoi passer en <b>Staging</b> (<code>git add</code>), tu crées un <b>commit</b> (<code>git commit</code>),
        puis tu l'envoies vers le <b>Remote</b> (<code>git push</code>).</p>
        <div class="zones">
          <div class="zone working">
            <div class="zone-head"><span><span class="zone-name">🛠️ Working Dir</span> <span class="zone-sub">working directory</span></span>${zN(st.conflicted.length + st.unstaged.length + st.untracked.length)}</div>
            <div class="chips">${workChips || '<div class="vide">clean</div>'}</div>
          </div>
          <div class="arrow"><span class="lbl">git add</span><span class="gt">⟶</span></div>
          <div class="zone staging">
            <div class="zone-head"><span><span class="zone-name">📦 Staging</span> <span class="zone-sub">staging area</span></span>${zN(st.staged.length)}</div>
            <div class="chips">${stageChips || '<div class="vide">empty</div>'}</div>
          </div>
          <div class="arrow"><span class="lbl">git commit</span><span class="gt">⟶</span></div>
          <div class="zone repo">
            <div class="zone-head"><span><span class="zone-name">💾 Repository</span> <span class="zone-sub">HEAD</span></span></div>
            <div class="chips">${repoChip}</div>
          </div>
          <div class="arrow"><span class="lbl">git push</span><span class="gt">⟶</span></div>
          <div class="zone remote">
            <div class="zone-head"><span><span class="zone-name">☁️ Remote</span> <span class="zone-sub">origin</span></span></div>
            <div class="chips">${remoteInner}</div>
          </div>
        </div>
      </div>`;
  }

  // ---------- detail : metadata ----------
  function metaCard(s) {
    const branchList = s.branches.map((b) => {
      let ab = '';
      if (b.track && (b.track.ahead || b.track.behind)) {
        ab = ` <span class="ab">` +
          (b.track.ahead ? `<span class="a">↑${b.track.ahead}</span>` : '') +
          (b.track.behind ? `<span class="b">↓${b.track.behind}</span>` : '') + `</span>`;
      } else if (b.track && b.track.gone) { ab = ` <span class="ab">(gone)</span>`; }
      return `<span class="bl-item${b.isHead ? ' head' : ''}">${b.isHead ? '★ ' : ''}${esc(b.name)}${ab}</span>`;
    }).join('');

    const tags = s.tags.length ? s.tags.map((t) => `<span class="bl-item">⚑ ${esc(t.name)}</span>`).join(' ') : '<span class="note">—</span>';
    const remotes = s.remotes.length ? s.remotes.map((r) => `${esc(r.name)} → <span class="note">${esc(r.url)}</span>`).join('<br>') : '<span class="note">aucun</span>';
    const idName = s.identity.name || '<span class="note">(non configurée)</span>';
    const idMail = s.identity.email ? ` <small>&lt;${esc(s.identity.email)}&gt;</small>` : '';

    return `
      <div class="card" data-meta>
        <h2>Métadonnées</h2>
        <div class="meta-grid">
          <div class="meta"><div class="k">Identité (qui signe)</div><div class="v mono">${idName}${idMail}</div></div>
          <div class="meta"><div class="k">HEAD</div><div class="v mono">${s.head.detached ? 'detached @ ' + esc(s.head.sha) : '⌥ ' + esc(s.head.branch || '?')}</div></div>
          <div class="meta"><div class="k">Type</div><div class="v">${s.type === 'bare' ? 'bare' : 'normal'}</div></div>
          <div class="meta"><div class="k">Commits</div><div class="v">${s.commits.length}</div></div>
          <div class="meta"><div class="k">Stash</div><div class="v">${s.stashes.length}</div></div>
          <div class="meta"><div class="k">Tags</div><div class="v" style="font-size:13px">${tags}</div></div>
        </div>
        <div style="margin-top:12px"><div class="k" style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px">Branches locales</div>
          <div class="branch-list" style="margin-top:6px">${branchList || '<span class="note">aucune</span>'}</div></div>
        <div style="margin-top:12px"><div class="k" style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px">Remotes</div>
          <div class="mono" style="font-size:12px;margin-top:6px">${remotes}</div></div>
        ${s.stashes.length ? `<div style="margin-top:10px" class="note">Stash : ${s.stashes.map((x) => esc(x.message)).join(' · ')}</div>` : ''}
      </div>`;
  }

  function renderDetail(s, flash) {
    const det = $('detail');
    if (!s) {
      det.innerHTML = `<div class="empty"><div class="big">⏳</div><p>Sélectionne un repo à gauche.</p></div>`;
      return;
    }
    det.innerHTML = `
      <div class="detail-head">
        <div class="avatar${s.type === 'bare' ? ' qg' : ''}" style="${avatarStyle(s)}">${initials(s)}</div>
        <div class="detail-title">
          <h1>${esc(s.name)} ${s.type === 'bare' ? '<span class="badge qg">remote · bare</span>' : '<span class="badge local">local repo</span>'}</h1>
          <div class="id">${esc(s.path)}</div>
        </div>
      </div>
      ${zonesCard(s)}
      ${metaCard(s)}
      <div class="card" data-graph>
        <h2>Commit graph — toutes les branches</h2>
        <p class="hint">Chaque colonne colorée = une branche. ★ = HEAD.</p>
        <div class="graph-wrap"><div id="graph"></div></div>
      </div>`;
    window.GitGraph.render($('graph'), s.commits, s.head.sha);

    if (flash) {
      det.querySelectorAll('.card').forEach((c) => {
        c.classList.add('flash');
        setTimeout(() => c.classList.remove('flash'), 1000);
      });
    }
  }

  // ---------- selection ----------
  function select(id) {
    state.selected = id;
    renderSidebar();
    renderDetail(state.byId.get(id), false);
  }

  function autoSelect() {
    if (state.selected && state.byId.has(state.selected)) return;
    const firstNormal = state.order.find((id) => state.byId.get(id)?.type === 'normal');
    state.selected = firstNormal || state.order[0] || null;
  }

  // ---------- ticker ----------
  let tickerTimer = null;
  function pulse(ev) {
    const t = $('ticker');
    t.innerHTML = `<span class="ev">⚡ <b>${esc(ev.repoName)}</b> a touché <b>${esc(ev.file)}</b></span>`;
    t.style.opacity = '1';
    if (tickerTimer) clearTimeout(tickerTimer);
    tickerTimer = setTimeout(() => { t.style.opacity = '.25'; }, 2200);
  }

  // ---------- websocket ----------
  function setConn(on, label) {
    const c = $('conn');
    c.classList.toggle('on', on);
    c.querySelector('.conn-label').textContent = label;
  }

  function applySnapshot(msg) {
    state.root = msg.root;
    $('rootPath').textContent = msg.root;
    state.order = msg.repos.map((r) => r.id);
    state.byId = new Map(msg.repos.map((r) => [r.id, r]));
    autoSelect();
    renderSidebar();
    renderDetail(state.byId.get(state.selected), false);
  }

  function applyUpdate(snap) {
    const isNew = !state.byId.has(snap.id);
    state.byId.set(snap.id, snap);
    if (isNew && !state.order.includes(snap.id)) state.order.push(snap.id);
    autoSelect();
    renderSidebar();
    const card = document.querySelector(`.repo-card[data-id="${CSS.escape(snap.id)}"]`);
    if (card) { card.classList.add('flash'); setTimeout(() => card.classList.remove('flash'), 950); }
    if (snap.id === state.selected) renderDetail(snap, true);
  }

  function applyRemove(id) {
    state.byId.delete(id);
    state.order = state.order.filter((x) => x !== id);
    if (state.selected === id) state.selected = null;
    autoSelect();
    renderSidebar();
    renderDetail(state.byId.get(state.selected), false);
  }

  // ---------- chargement initial via HTTP (marche meme si le WebSocket est bloque) ----------
  let wsFails = 0, httpTimer = null;

  async function loadViaHttp() {
    try {
      const res = await fetch('/api/repos', { cache: 'no-store' });
      const data = await res.json();
      console.log(`[watcher] snapshot via HTTP : ${data.repos ? data.repos.length : 0} repo(s)`);
      applySnapshot(data);
      return true;
    } catch (e) {
      console.warn('[watcher] HTTP /api/repos a échoué :', e.message);
      return false;
    }
  }
  function startHttpFallback() {
    if (httpTimer) return;
    console.warn('[watcher] WebSocket indisponible → bascule HTTP (rafraîchissement toutes les 5 s, pas de "live").');
    setConn(false, 'HTTP (sans live)');
    httpTimer = setInterval(loadViaHttp, 5000);
  }
  function stopHttpFallback() {
    if (httpTimer) { clearInterval(httpTimer); httpTimer = null; }
  }

  function connect() {
    let ws;
    try { ws = new WebSocket(`ws://${location.host}`); }
    catch (e) {
      console.warn('[watcher] création WebSocket impossible :', e.message);
      startHttpFallback(); setTimeout(connect, 2000); return;
    }
    ws.onopen = () => {
      console.log('[watcher] WebSocket connecté ✔ (mises à jour live actives)');
      wsFails = 0; stopHttpFallback(); setConn(true, 'connecté');
    };
    ws.onmessage = (e) => {
      let msg; try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === 'snapshot') applySnapshot(msg);
      else if (msg.type === 'update') applyUpdate(msg.repo);
      else if (msg.type === 'remove') applyRemove(msg.id);
      else if (msg.type === 'pulse') pulse(msg);
    };
    ws.onerror = () => { console.warn('[watcher] erreur WebSocket'); try { ws.close(); } catch { /* */ } };
    ws.onclose = () => {
      wsFails++;
      console.warn(`[watcher] WebSocket fermé (échec n°${wsFails}) — reconnexion dans 1,5 s`);
      setConn(false, 'reconnexion…');
      if (wsFails >= 3) startHttpFallback();   // WS visiblement bloqué -> on garde l'affichage via HTTP
      setTimeout(connect, 1500);
    };
  }

  console.log('[watcher] app démarrée — ouvre la console (F12) pour suivre les logs [watcher].');
  (async () => { await loadViaHttp(); connect(); })();
})();
