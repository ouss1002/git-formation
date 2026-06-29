# 🃏 Git — Antisèche du Voyageur Temporel

> **Règle d'or :** 🧭 *« `git status` avant et après, toujours. »* — et 🛟 *« Avec Git, presque tout se récupère. »*

---

## 🪨 Vocabulaire express (la Pierre de Rosette)

| Git | En clair | Image |
|---|---|---|
| working directory | l'établi | 🛠️ ton brouillon (le présent) |
| staging area | le panier | 🧺 ce que tu vas figer |
| commit | checkpoint | 💾 sauvegarde signée |
| HEAD | « TU ES ICI » | 📍 ta position |
| branch | timeline | 🌌 univers parallèle |
| merge | fusion | 🔗 réunir 2 timelines |
| conflict | paradoxe | ⚡ 2 modifs sur la même ligne |
| remote / origin | le QG | 🛰️ serveur Azure |
| fetch | télécharger (recon) | 🔭 sans rien changer |
| pull | fetch + merge | 🔄 télécharger + synchro |
| push | envoyer | 📤 upload au QG |
| stash | poche dimensionnelle | 🎒 mettre de côté |
| reset | rembobiner | ⏪ réécrit l'histoire |
| revert | anti-checkpoint | ↩️ annule sans réécrire |
| rebase | rejouer / réécrire | 🔀 remonter le film proprement |
| rebase -i | table de montage | 🎬 réordonner / fusionner / renommer |

**Verbes :** fetch = télécharger · pull = télécharger+synchroniser · push = envoyer · commit = sauvegarder · add = préparer · merge = fusionner.

---

## 🚀 Démarrer

```bash
git config --global user.name "Oussama"          # ta signature
git config --global user.email "oussama@formation.git"
git config --global core.editor "code --wait"    # éditeur = VS Code (anti-Vim !)
git config --global init.defaultBranch main      # nouvelles repos → branche "main"
git config --list --show-origin                  # voir toute la config (et d'où elle vient)
git init                                          # créer un dépôt (vaisseau)
git clone <url>                                   # copier tout l'univers depuis le QG
```

## 🔁 Le cycle quotidien

```bash
git status                       # 🧭 LA BOUSSOLE (avant ET après)
git add <fichier>                # 🧺 préparer un fichier
git add .                        # tout préparer (⚠️ vérifie avec status)
git add -p                       # préparer morceau par morceau (chirurgien)
git commit -m "message clair"    # 💾 checkpoint
git commit --amend               # corriger le DERNIER checkpoint (pas après push)
git log --oneline --graph --all  # 📜 voir toutes les timelines
```

## ⏪ Voyager / Annuler

```bash
git switch -                     # revenir à la branche précédente
git switch --detach <sha>        # visiter un ancien checkpoint (detached HEAD)
git restore <fichier>            # ⚠️ jeter mes modifs NON commitées d'un fichier
git restore --staged <fichier>   # retirer du panier (garde les modifs)
git reset --soft  HEAD~1         # défait le commit, garde tout au panier
git reset --mixed HEAD~1         # défait le commit, vide le panier (défaut)
git reset --hard  HEAD~1         # ⚠️ rembobine TOUT (établi écrasé)
git revert <sha>                 # ↩️ anti-checkpoint (sûr après push)
git reflog                       # 🆘 journal secret → retrouver un commit perdu
```

**Que touche `reset` ?**

| mode | historique | panier | établi |
|---|---|---|---|
| `--soft` | ⏪ | gardé | gardé |
| `--mixed` | ⏪ | vidé | gardé |
| `--hard` | ⏪ | vidé | ⚠️ écrasé |

## 🌌 Branches & Merge

```bash
git branch                       # lister (★ = courante)
git switch -c <branche>          # créer + y aller
git switch main                  # changer de branche
git merge <branche>              # fusionner <branche> DANS la courante
git merge --abort                # 🆘 annuler une fusion en cours
git branch -d <branche>          # supprimer une branche fusionnée
```

**Résoudre un conflit ⚡ :** `git status` → ouvrir le fichier → choisir entre `<<<<<<<` / `=======` / `>>>>>>>`, supprimer les 3 balises → `git add <fichier>` → `git commit`. *(Ou, dans **VS Code** : « Resolve in Merge Editor » → vue Current / Incoming / Résultat.)*

## 🔀 Rebase (réécrire proprement)

```bash
git rebase main                  # rejouer MA branche par-dessus main (historique linéaire)
git rebase -i HEAD~4             # 🎬 table de montage : reword / squash / fixup / drop / réordonner
git rebase --continue            # reprendre après avoir résolu un conflit
git rebase --abort               # 🆘 tout annuler, revenir avant le rebase
git pull --rebase                # pull SANS commit de fusion (garde l'histoire linéaire)
```

**Verbes de `rebase -i` :** `pick` garder · `reword` renommer le msg · `squash` fusionner (garde msg) · `fixup` fusionner (jette msg) · `edit` s'arrêter · `drop` supprimer · réordonner les lignes = réordonner les commits.

⚠️ **Règle d'or :** ne rebase **jamais** des commits **déjà poussés / partagés** (tu réécrirais l'histoire des autres). Rebase seulement ton **local**.

## 🛰️ Remote (le QG)

```bash
git remote -v                    # voir les QG connectés
git fetch                        # 🔭 télécharger les news (sans toucher l'établi)
git pull                         # 🔄 fetch + merge (télécharger + synchroniser)
git push                         # 📤 envoyer mes checkpoints
git push -u origin main          # 1re fois : lier la branche au QG
```

🥇 **Workflow en or : `git pull` AVANT `git push`.** (« ahead » → push ; « behind » → pull.)

## 🔍 Diffs

```bash
git diff                         # établi vs panier (modifs pas préparées)
git diff --staged                # panier vs dernier commit (ce qui va partir)
git diff <brancheA> <brancheB>   # comparer 2 timelines
git diff <shaA> <shaB>           # comparer 2 checkpoints
git diff --stat                  # résumé compact (lignes/fichier)
```

Lecture : `-` rouge = supprimé · `+` vert = ajouté · sans préfixe = contexte.

## 🎒 Stash (poche dimensionnelle)

```bash
git stash                        # ranger les modifs en cours (établi propre)
git stash list                   # voir la poche
git stash pop                    # ressortir + retirer de la poche
git stash apply                  # ressortir mais garder dans la poche
git stash drop                   # jeter un élément
```

## 🔎 Inspecter

```bash
git log --oneline                # historique compact
git lg                           # joli graphe (alias, voir ci-dessous)
git show <sha>                   # détail d'un checkpoint
git blame <fichier>              # qui a écrit chaque ligne
git status                       # 🧭 toujours, toujours
```

---

## 🆘 BOUTON PANIQUE

| 😱 « J'ai… » | ✅ Tape ça |
|---|---|
| **modifié un fichier et je veux annuler** (pas commité) | `git restore <fichier>` |
| **coincé dans Vim** (`commit` sans `-m`) | `Échap` puis `:wq` (sauver) ou `:q!` (annuler) + `Entrée` |
| **commité trop tôt** (garder le travail) | `git reset --soft HEAD~1` |
| **commité un truc à jeter** (déjà push) | `git revert <sha>` |
| **mis un fichier au panier par erreur** | `git restore --staged <fichier>` |
| **je suis sur la mauvaise branche** (pas encore commité) | `git stash` → `git switch <bonne>` → `git stash pop` |
| **perdu un commit** (après reset --hard) | `git reflog` → `git reset --hard <sha>` |
| **un merge qui part en vrille** | `git merge --abort` |
| **un rebase qui part en vrille** | `git rebase --abort` |
| **un push refusé** (rejected) | `git pull` d'abord, résous, puis `git push` |

> 🛟 Tant que c'était **commité**, c'est récupérable via `reflog`. Seul le travail **jamais commité** est vraiment fragile → **commite souvent.**

---

## ⚡ Alias prêts à copier-coller

```bash
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.last "log -1 HEAD"
git config --global alias.unstage "restore --staged"
git config --global alias.visual "log --oneline --graph --all --decorate"
git config --global alias.lg "log --oneline --graph --all --decorate --color"
```

Ensuite : `git st` · `git co` · `git br` · `git ci -m "..."` · `git last` · `git unstage <f>` · `git lg` ✨

---

> 🧭 **Et si tu ne dois retenir qu'une seule chose :** `git status` **avant et après, toujours.**
