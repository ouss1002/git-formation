# 🕹️ Formation Git — Kit complet (démo live + tableau de bord visuel)

Tout le matériel pour animer une **formation Git de 2 h** en français, pensée pour des
**actuaires qui débutent en code** : métaphores *voyage dans le temps* + *jeu vidéo*, un
terrain de jeu multi-dépôts réaliste, et un **tableau de bord web temps réel** qui rend
visible ce que Git fait d'habitude en coulisses.

> Ce fichier (`README.md`) est le **document de processus** : il explique comment toutes
> les pièces s'emboîtent et comment tout lancer. Le **support de cours** est dans
> [`docs/FORMATION.md`](docs/FORMATION.md) et l'antisèche dans [`docs/CHEATSHEET.md`](docs/CHEATSHEET.md).

---

## 1. Les 3 composants (et comment ils s'articulent)

```mermaid
flowchart TB
    subgraph DOCS["📄 Support de cours (FR)"]
        F["docs/FORMATION.md<br/>cours 2h + 7 scénarios de démo"]
        C["docs/CHEATSHEET.md<br/>antisèche + bouton panique"]
    end

    subgraph PLAY["🎮 Terrain de jeu (généré)"]
        AZ["AZURE_REPO<br/>(bare = le QG / origin)"]
        R1["Oussama · Jorge · Anya<br/>Elsa · Zaka · Thomas · Othmane<br/>(7 clones, identités propres)"]
        R1 -- "push / pull" --> AZ
    end

    subgraph WATCH["📺 Watcher (Node + navigateur)"]
        SRV["server.js<br/>scan + git + chokidar + WebSocket"]
        UI["http://localhost:4242<br/>3 zones · graphe · métadonnées"]
        SRV --> UI
    end

    SCRIPT["scripts/setup-repos.ps1"] --> PLAY
    PLAY -- "observé en direct par" --> SRV
    F -. "le formateur tape les commandes,<br/>la classe regarde le watcher" .-> UI
```

- **Tu** (le formateur) tapes les commandes Git de [`docs/FORMATION.md`](docs/FORMATION.md) dans les dépôts du terrain de jeu.
- Le **watcher** observe ce dossier et **anime** en direct l'effet de chaque commande (fichier qui passe de l'établi au sas, nouveau commit dans le graphe, badges ahead/behind…).
- La classe **regarde l'écran** ; à la fin, ils pratiquent entre eux sur un vrai dépôt Azure (hors de ce kit).

---

## 2. Prérequis

| Outil | Version testée | Vérifier |
|---|---|---|
| Git | 2.43+ | `git --version` |
| Node.js | 18+ (testé sur 25) | `node --version` |
| PowerShell | Windows | (déjà là) |

---

## 3. Démarrage rapide (3 étapes)

```powershell
# 1) Construire le terrain de jeu (bare AZURE_REPO + 7 clones + historique de démo)
powershell -ExecutionPolicy Bypass -File scripts\setup-repos.ps1

# 2) Installer et lancer le tableau de bord
cd watcher
npm install
node server.js ../playground

# 3) Ouvrir le navigateur
#    http://localhost:4242
```

> 💡 Astuce de démo : mets le **navigateur (watcher)** et un **terminal** côte à côte.
> Tu tapes à gauche, la magie opère à droite.

Pour **tester** que tout marche (sans rien casser) :

```powershell
cd watcher
npm test            # 21 assertions sur le scanner + l'inspecteur
npm run simulate    # joue une petite histoire git en direct (regarde le watcher !)
```

---

## 4. Le terrain de jeu (`playground/`)

Généré par `scripts/setup-repos.ps1`. **Re-jouable** : relancer le script efface et
recrée tout (`scripts/teardown.ps1` pour juste supprimer).

| Dépôt | Type | État au démarrage (pour un dashboard vivant) |
|---|---|---|
| **AZURE_REPO** | **bare** (QG) | `main` + `feature/calcul-prime`, reçoit les push |
| Oussama | normal | propre, **en retard de 1** (un `git pull` suffit) |
| Jorge | normal | à jour, vient de **pousser** le taux 0.055 |
| Anya | normal | **divergent** (ahead 1 / behind 1) → `git pull` = **paradoxe** (conflit prêt) |
| Elsa | normal | un changement **dans le sas** (staged, pas commité) |
| Zaka | normal | **établi sale** (modif non préparée + fichier non suivi) |
| Thomas | normal | sur la branche **`feature/calcul-prime`** |
| Othmane | normal | un **stash** en poche, établi propre |

Chaque clone a sa propre identité (`user.name` / `user.email` = `<prénom>@formation.git`),
donc le graphe montre **qui a fait quoi**.

> Le mini-projet versionné (`prime.py`, `README.md`, `CHANGELOG.md`, `.gitignore`) est
> volontairement minuscule : assez pour jouer, sans noyer les débutants sous du code.

---

## 5. Comment marche le watcher (architecture)

```
watcher/
├─ server.js            # HTTP + WebSocket + chokidar (orchestration)
├─ lib/
│  ├─ scanner.js        # trouve les dépôts ; classe normal vs bare (système de fichiers)
│  ├─ inspector.js      # construit le "snapshot" d'un dépôt via la CLI git
│  └─ git.js            # wrapper git (execFile) : -C pour normal, --git-dir pour bare
├─ public/              # l'UI (sans build : HTML/CSS/JS vanilla)
│  ├─ index.html · style.css
│  ├─ app.js            # WebSocket + rendu (sidebar, 3 zones, métadonnées)
│  └─ graph.js          # graphe de commits en SVG (algorithme de "lanes")
└─ test/
   ├─ inspect.test.js   # assertions automatiques
   └─ simulate.js       # simulateur d'activité (démo/observation)
```

**Boucle temps réel :**
1. `scanner` liste les dépôts sous le dossier observé (profondeur bornée, ignore `node_modules`/`objects`).
2. `inspector` lance des commandes git (`status --porcelain=v2`, `for-each-ref`, `log --all`, `stash list`…) et en fait un objet JSON.
3. `chokidar` surveille les fichiers **et** les internes `.git` (HEAD, index, refs, logs) → à tout changement, on ré-inspecte le dépôt concerné (anti-rebond ~180 ms).
4. Un **poll de sécurité** (toutes les 3 s) ré-inspecte tout au cas où un événement fichier serait manqué.
5. On ne diffuse par **WebSocket** que si le snapshot a **réellement** changé (comparaison de hash) → **zéro scintillement**.

**Indépendant de la configuration** : le watcher ne sait rien des noms Oussama/Jorge/… Il
prend **un dossier** en argument, y **découvre** les dépôts, et **déduit** lesquels sont
bare vs normaux. Pointe-le sur n'importe quel dossier :

```powershell
node server.js "C:\chemin\vers\un\autre\dossier"
# ou
$env:WATCH_DIR="C:\..."; node server.js
```

---

## 6. Lire le tableau de bord

- **Barre du haut** : dossier observé, **ticker** d'activité (⚡ qui a touché quel fichier), pastille de connexion.
- **Sidebar (gauche)** : une carte par dépôt — avatar/identité, badge **QG (bare)** ou **local**, branche courante, compteurs (✚ staged, ● modifié, ? non-suivi, ⚠ conflit, ↑ahead / ↓behind, ⊟ stash).
- **Panneau (droite)** quand on sélectionne un dépôt :
  - **Les 3 zones (+ QG)** : 🛠️ Établi → 📦 Sas → 💾 Dépôt → ☁️ QG, avec les flèches `git add` / `git commit` / `git push`. **C'est la matérialisation du modèle mental du cours.**
  - **Métadonnées** : identité, HEAD, branches (avec ahead/behind), tags, stashes, remotes.
  - **Graphe temporel** : tous les commits / toutes les branches en colonnes colorées (= timelines), ★ = HEAD.

---

## 7. Déroulé suggéré (2 h)

| ⏱️ | Section (FORMATION.md) | Sur le watcher |
|---|---|---|
| 0–10 | Pourquoi Git · Pierre de Rosette | Vue d'ensemble des 8 dépôts |
| 10–25 | **Les 3 zones** · identité · bare | Zaka (établi sale), Elsa (sas), badge bare d'AZURE_REPO |
| 25–45 | Cycle `status → add → commit` · log | Scénario (a) et (b) en live |
| 45–65 | Voyager sans peur · reset/revert/reflog | Scénario (f) « j'ai tout cassé » |
| 65–85 | Branches · merge · **conflit** | Thomas (feature) ; provoquer Anya `git pull` → paradoxe |
| 85–100 | QG : fetch/pull/push · ahead-behind | Oussama `pull`, push → AZURE_REPO grandit |
| 100–110 | diffs · stash · .gitignore · alias · GitLens | Othmane (stash) ; GitLens dans VS Code |
| 110–120 | Récap · lancement de l'exercice Azure | Cheatsheet + bouton panique |

> Les **7 scénarios pas-à-pas** (avec « 👀 ce qu'on doit voir dans le watcher ») sont en
> annexe de [`docs/FORMATION.md`](docs/FORMATION.md#17--annexe--scénarios-de-démo-pas-à-pas).
>
> 🔀 **Rebase (§8)** est un bonus « pour aller plus loin » : à caser dans le créneau 100–110
> si le rythme le permet (idéal sur la branche de Thomas / une branche bien divergente pour
> voir le graphe se redresser), sinon à pointer dans la cheatsheet.

---

## 8. Réinitialiser entre deux essais

```powershell
# Tout remettre à l'état de départ (après avoir bidouillé pendant une répét) :
powershell -ExecutionPolicy Bypass -File scripts\setup-repos.ps1

# Ou juste supprimer le terrain de jeu :
powershell -ExecutionPolicy Bypass -File scripts\teardown.ps1
```

Le watcher détecte la disparition/réapparition des dépôts tout seul (rescan automatique).

---

## 9. Dépannage

| Souci | Cause / solution |
|---|---|
| `cannot use bare repository … safe.bareRepository is 'explicit'` | Config git de sécurité. **Déjà géré** : le watcher attaque les dépôts bare avec `--git-dir`. (Si tu scriptes toi-même, fais pareil.) |
| Le port 4242 est pris | `set PORT=4300` (cmd) / `$env:PORT="4300"` (PowerShell) puis relancer. |
| Rien ne bouge en direct (lecteur réseau, VM) | Lancer avec `$env:WATCH_POLL="1"` pour forcer le polling fichiers. |
| Fausses « modifs » de fins de ligne sous Windows | `setup-repos.ps1` force déjà `core.autocrlf=false` au clone. |
| Le `push` du simulateur est « rejected » | Normal si le dépôt est *behind* : le simulateur fait un `pull --ff-only` d'abord ; sinon c'est un excellent prétexte à démo « pull avant push ». |

---

## 10. Arborescence

```
git_form/
├─ README.md                 ← tu es ici (document de processus)
├─ docs/
│  ├─ FORMATION.md           ← support de cours (FR, document vivant)
│  └─ CHEATSHEET.md          ← antisèche imprimable (FR)
├─ scripts/
│  ├─ setup-repos.ps1        ← génère playground/ (bare + 7 clones + démo)
│  └─ teardown.ps1
├─ watcher/                  ← tableau de bord (voir §5)
└─ playground/               ← généré (non versionné)
```

---

## 11. Pour itérer

C'est un **point de départ** conçu pour être ajusté après tes tests. Quelques pistes faciles :
- Le **thème visuel** est dans `watcher/public/style.css` (variables de couleur en haut).
- Les **données collectées** par dépôt : `watcher/lib/inspector.js`.
- Les **états de départ** des dépôts : la section « Mise en scène » de `scripts/setup-repos.ps1`.
- Le **support de cours** est un document vivant : enrichis `docs/FORMATION.md` au fil de tes répétitions.

Dis-moi ce que tu veux voir différemment dans le watcher (zones, graphe, animations, infos
en plus) et on l'ajuste.
