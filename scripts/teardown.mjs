// teardown.mjs — supprime le terrain de jeu (multiplateforme).
//   node scripts/teardown.mjs [dossier_cible]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const cfg = JSON.parse(fs.readFileSync(path.join(HERE, 'config.json'), 'utf8'));
const PG = path.resolve(process.cwd(), process.argv[2] || path.join(ROOT, cfg.playgroundDir));

function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

if (!fs.existsSync(PG)) { console.log(`Rien à supprimer (${PG} n'existe pas).`); process.exit(0); }

for (let i = 0; i < 6; i++) {
  try { fs.rmSync(PG, { recursive: true, force: true }); console.log(`Supprimé : ${PG}`); process.exit(0); }
  catch { sleep(500); }
}
console.error(`!! Impossible de supprimer ${PG} : un programme garde un dépôt ouvert`);
console.error("   (watcher 'node' encore lancé ? VS Code / GitLens ?). Ferme-le puis relance.");
process.exit(1);
