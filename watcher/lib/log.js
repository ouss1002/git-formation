'use strict';
/*
 * log.js — petit logger horodate (secondes depuis le demarrage).
 *   - log()  : toujours affiche
 *   - dbg()  : seulement si WATCH_DEBUG=1 (ou --debug)
 *   - warn() : avertissements (toujours)
 * Active les logs detailles :  set WATCH_DEBUG=1   (cmd)
 *                              $env:WATCH_DEBUG="1" (PowerShell)
 */
const START = Date.now();
const DEBUG = process.env.WATCH_DEBUG === '1' || process.argv.includes('--debug');

function stamp() { return ((Date.now() - START) / 1000).toFixed(2).padStart(7) + 's'; }
function log(...a)  { console.log(`[${stamp()}]`, ...a); }
function dbg(...a)  { if (DEBUG) console.log(`[${stamp()}] ·`, ...a); }
function warn(...a) { console.warn(`[${stamp()}] ⚠ `, ...a); }

module.exports = { log, dbg, warn, DEBUG };
