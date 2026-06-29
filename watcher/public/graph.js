/* =========================================================================
   graph.js — dessine le graphe de commits (DAG) en SVG.
   Algorithme de "lanes" facon `git log --graph` : chaque branche = une colonne
   coloree (= une ligne temporelle / un univers parallele).
   ========================================================================= */
(function () {
  'use strict';

  const LANE_COLORS = [
    '#38bdf8', '#3fb950', '#a371f7', '#f778ba', '#e3a008',
    '#f85149', '#2dd4bf', '#facc15', '#60a5fa', '#fb923c',
  ];
  const ROW_H = 34;
  const COL_W = 22;
  const PAD_L = 22;
  const PAD_T = 22;
  const DOT_R = 6;

  function laneColor(i) { return LANE_COLORS[i % LANE_COLORS.length]; }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function timeAgo(ts) {
    if (!ts) return '';
    const s = Math.floor(Date.now() / 1000 - ts);
    if (s < 60) return 'à l\'instant';
    const m = Math.floor(s / 60); if (m < 60) return `il y a ${m} min`;
    const h = Math.floor(m / 60); if (h < 24) return `il y a ${h} h`;
    const d = Math.floor(h / 24); if (d < 30) return `il y a ${d} j`;
    const mo = Math.floor(d / 30); if (mo < 12) return `il y a ${mo} mois`;
    return `il y a ${Math.floor(mo / 12)} an(s)`;
  }

  /* Assigne (row, col) a chaque commit. commits = du plus recent au plus ancien. */
  function layout(commits) {
    const rowOf = new Map();
    commits.forEach((c, i) => rowOf.set(c.sha, i));
    const colOf = new Map();
    const lanes = []; // lanes[i] = sha attendu dans cette colonne, ou null

    function firstFree() {
      for (let i = 0; i < lanes.length; i++) if (lanes[i] === null) return i;
      lanes.push(null); return lanes.length - 1;
    }

    let maxCol = 0;
    commits.forEach((c) => {
      let col = lanes.indexOf(c.sha);
      if (col === -1) col = firstFree();
      // libere les autres colonnes qui attendaient ce meme commit (fusion de lignes)
      for (let i = 0; i < lanes.length; i++) if (lanes[i] === c.sha && i !== col) lanes[i] = null;
      colOf.set(c.sha, col);
      maxCol = Math.max(maxCol, col);

      const parents = c.parents.filter((p) => rowOf.has(p));
      if (parents.length === 0) {
        lanes[col] = null;
      } else {
        lanes[col] = parents[0]; // 1er parent : meme colonne
        for (let k = 1; k < parents.length; k++) {
          const p = parents[k];
          if (lanes.indexOf(p) === -1) lanes[firstFree()] = p; // parents de merge -> nouvelles colonnes
        }
      }
    });

    return { rowOf, colOf, maxCol };
  }

  function x(col) { return PAD_L + col * COL_W; }
  function y(row) { return PAD_T + row * ROW_H; }

  function edgePath(from, to) {
    const x1 = x(from.col), y1 = y(from.row);
    const x2 = x(to.col), y2 = y(to.row);
    if (x1 === x2) return `M${x1},${y1} L${x2},${y2}`;
    const my = (y1 + y2) / 2;
    return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
  }

  function refChip(ref, xPos, yPos) {
    let cls = 'branch', txt = ref, fill = '#a371f7', stroke = 'rgba(163,113,247,.5)';
    let isHead = false;
    if (ref.startsWith('HEAD -> ')) { isHead = true; txt = ref.slice(8); fill = '#3fb950'; stroke = 'rgba(63,185,80,.6)'; }
    else if (ref === 'HEAD') { txt = 'HEAD'; fill = '#3fb950'; stroke = 'rgba(63,185,80,.6)'; }
    else if (ref.startsWith('tag: ')) { txt = '⚑ ' + ref.slice(5); fill = '#e3b341'; stroke = 'rgba(227,179,65,.6)'; }
    else if (ref.includes('/')) { fill = '#e3a008'; stroke = 'rgba(227,160,8,.5)'; } // origin/...
    const w = txt.length * 7.2 + 14;
    const head = isHead ? `<tspan font-weight="700">★ </tspan>` : '';
    return {
      svg:
        `<g transform="translate(${xPos},${yPos})">` +
        `<rect x="0" y="-10" rx="5" height="18" width="${w}" fill="${fill}22" stroke="${stroke}"/>` +
        `<text x="7" y="3" font-size="11" fill="${fill}">${head}${esc(txt)}</text>` +
        `</g>`,
      width: w,
    };
  }

  function render(container, commits, headSha) {
    if (!commits || commits.length === 0) {
      container.innerHTML = '<p class="note">Aucun commit pour le moment (univers vierge).</p>';
      return;
    }
    const { rowOf, colOf, maxCol } = layout(commits);
    const lanesWidth = PAD_L + (maxCol + 1) * COL_W + 10;
    const textX = lanesWidth + 6;
    const height = PAD_T * 2 + commits.length * ROW_H;
    const width = Math.max(900, textX + 700);

    let edges = '';
    let nodes = '';
    let texts = '';

    // aretes
    commits.forEach((c) => {
      const from = { row: rowOf.get(c.sha), col: colOf.get(c.sha) };
      c.parents.forEach((p) => {
        if (!colOf.has(p)) return;
        const to = { row: rowOf.get(p), col: colOf.get(p) };
        const color = laneColor(Math.min(from.col, to.col));
        edges += `<path d="${edgePath(from, to)}" fill="none" stroke="${color}" stroke-width="2" opacity="0.85"/>`;
      });
    });

    // noeuds + texte
    commits.forEach((c) => {
      const row = rowOf.get(c.sha), col = colOf.get(c.sha);
      const cx = x(col), cy = y(row);
      const color = laneColor(col);
      const isHead = headSha && c.sha.startsWith(headSha);
      const isMerge = c.parents.length > 1;
      nodes +=
        (isHead ? `<circle cx="${cx}" cy="${cy}" r="${DOT_R + 4}" fill="none" stroke="${color}" stroke-width="1.5" opacity=".5"/>` : '') +
        `<circle cx="${cx}" cy="${cy}" r="${DOT_R}" fill="${isMerge ? '#0b0f17' : color}" stroke="${color}" stroke-width="2.5"/>`;

      // refs (branches/tags) puis sha + sujet
      let tx = textX;
      (c.refs || []).forEach((ref) => {
        const chip = refChip(ref, tx, cy);
        texts += chip.svg;
        tx += chip.width + 6;
      });
      const subj = c.subject.length > 64 ? c.subject.slice(0, 63) + '…' : c.subject;
      texts +=
        `<text x="${tx}" y="${cy + 4}" font-size="12">` +
        `<tspan fill="${color}">${esc(c.short)}</tspan> ` +
        `<tspan fill="#e6edf6">${esc(subj)}</tspan> ` +
        `<tspan fill="#8aa0bd" font-size="11">· ${esc(c.author)} · ${esc(timeAgo(c.at))}</tspan>` +
        `</text>`;
    });

    container.innerHTML =
      `<svg width="${width}" height="${height}" style="overflow: initial;" viewBox="0 0 ${width} ${height}">` +
      edges + nodes + texts + `</svg>`;
  }

  window.GitGraph = { render, timeAgo };
})();
