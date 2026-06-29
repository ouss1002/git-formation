# Git — Antisèche

> Règle pratique : lire `git status` avant et après chaque commande. Tout ce qui est **commité** est récupérable.

---

## Termes essentiels

| Terme | Signification |
|---|---|
| working directory | tes fichiers de travail (modifications locales) |
| staging area (index) | ce qui sera inclus dans le prochain commit |
| commit | enregistrement figé de l'état du projet |
| HEAD | commit courant (ta position) |
| branch | ligne de développement (pointeur mobile) |
| merge | fusionner une branche dans une autre |
| conflict | deux modifications incompatibles sur les mêmes lignes |
| remote / origin | dépôt distant (serveur partagé) |
| fetch | récupérer les commits distants, sans les intégrer |
| pull | fetch + merge (récupérer et intégrer) |
| push | envoyer tes commits vers le distant |
| stash | mise de côté temporaire des modifications non commitées |
| reset | déplacer HEAD (réécrit l'historique local) |
| revert | annuler un commit via un nouveau commit inverse |
| rebase | rejouer des commits sur une autre base (historique linéaire) |

## Le flux

```text
working dir ──git add──▶ index ──git commit──▶ dépôt local ──git push──▶ distant
     ▲                     ▲                         ▲                       │
     └──git restore────────┴────────git reset───────┘        git fetch/pull─┘
```

---

## Configuration initiale

```bash
git config --global user.name  "Ton Prénom"
git config --global user.email "toi@exemple.com"
git config --global core.editor "code --wait"   # éditeur = VS Code (évite Vim)
git config --global init.defaultBranch main
git config --list --show-origin                  # config effective + origine
```

---

## Commandes pour commencer un projet

```bash
git init                                          # créer un dépôt
git clone <url>                                   # cloner un dépôt distant
```

## Cycle quotidien

```bash
git status                       # état des fichiers (à lire avant/après)
git add <fichier>                # indexer un fichier
git add .                        # tout indexer (vérifier avec status)
git add -p                       # indexer morceau par morceau (interactif)
git commit -m "message"          # créer un commit
git commit --amend               # modifier le dernier commit (pas après push)
git log --oneline --graph --all  # historique de toutes les branches
```

## Naviguer / annuler

```bash
git switch -                     # revenir à la branche précédente
git switch --detach <sha>        # se placer sur un commit (detached HEAD)
git restore <fichier>            # annuler les modifs non commitées d'un fichier (destructif)
git restore --staged <fichier>   # désindexer (garde les modifs)
git reset --soft  HEAD~1         # annule le commit, garde tout indexé
git reset --mixed HEAD~1         # annule le commit, désindexe (défaut)
git reset --hard  HEAD~1         # annule le commit et écrase les modifs (destructif)
git revert <sha>                 # annule un commit via un commit inverse (sûr après push)
git reflog                       # journal des positions de HEAD (retrouver un commit)
```

Effet de `reset` :

| mode | historique (HEAD) | index | working dir |
|---|---|---|---|
| `--soft` | reculé | conservé | conservé |
| `--mixed` (défaut) | reculé | vidé | conservé |
| `--hard` | reculé | vidé | ⚠️ écrasé |

## Branches & merge

```bash
git branch                       # lister (★ = courante)
git switch -c <branche>          # créer + basculer
git switch <branche>             # changer de branche
git merge <branche>              # fusionner <branche> dans la courante
git merge --abort                # annuler une fusion en cours
git branch -d <branche>          # supprimer une branche fusionnée
```

Résoudre un conflit : `git status` → ouvrir le fichier → choisir entre `<<<<<<<` / `=======` / `>>>>>>>`, supprimer les marqueurs → `git add <fichier>` → `git commit`. *(VS Code : « Resolve in Merge Editor ».)*

## Rebase

```bash
git rebase main                  # rejouer la branche courante sur main (historique linéaire)
git rebase -i HEAD~4             # édition interactive : reword / squash / fixup / drop / réordonner
git rebase --continue            # reprendre après résolution d'un conflit
git rebase --abort               # annuler le rebase en cours
git pull --rebase                # pull sans commit de fusion (historique linéaire)
```

Verbes de `rebase -i` : `pick` garder · `reword` renommer le message · `squash` fusionner (garde msg) · `fixup` fusionner (jette msg) · `edit` s'arrêter · `drop` supprimer · réordonner les lignes = réordonner les commits.

⚠️ Ne **jamais** rebaser des commits déjà poussés/partagés (réécrit l'historique des autres). Rebase uniquement le local.

## Remote (dépôt distant)

```bash
git remote -v                    # lister les distants
git fetch                        # récupérer les commits distants (sans intégrer)
git pull                         # fetch + merge
git push                         # envoyer les commits
git push -u origin main          # 1re fois : lier la branche locale au distant
```

Règle : `git pull` avant `git push`. (« ahead » → push ; « behind » → pull.)

## Diffs

```bash
git diff                         # working dir vs index (modifs non indexées)
git diff --staged                # index vs dernier commit (ce qui sera commité)
git diff <brancheA> <brancheB>   # comparer deux branches
git diff <shaA> <shaB>           # comparer deux commits
git diff --stat                  # résumé (lignes modifiées par fichier)
```

Lecture : `-` = ligne supprimée · `+` = ligne ajoutée · sans préfixe = contexte.

## Stash

```bash
git stash                        # mettre de côté les modifs en cours
git stash list                   # lister les stashs
git stash pop                    # restaurer + retirer de la pile
git stash apply                  # restaurer sans retirer
git stash drop                   # supprimer un stash
```

## Inspecter

```bash
git log --oneline                # historique compact
git lg                           # graphe coloré (alias, voir plus bas)
git show <sha>                   # détail d'un commit
git blame <fichier>              # auteur de chaque ligne
```

---

## Dépannage rapide

| Problème | Commande |
|---|---|
| annuler les modifs d'un fichier (non commité) | `git restore <fichier>` |
| coincé dans Vim (`commit` sans `-m`) | `Échap` puis `:wq` (sauver) ou `:q!` (annuler) |
| commit prématuré (garder le travail) | `git reset --soft HEAD~1` |
| annuler un commit déjà poussé | `git revert <sha>` |
| fichier indexé par erreur | `git restore --staged <fichier>` |
| mauvaise branche (pas encore commité) | `git stash` → `git switch <branche>` → `git stash pop` |
| commit perdu (après `reset --hard`) | `git reflog` → `git reset --hard <sha>` |
| fusion à annuler | `git merge --abort` |
| rebase à annuler | `git rebase --abort` |
| push refusé (rejected) | `git pull`, résoudre, puis `git push` |

⚠️ Tant qu'un travail est **commité**, il est récupérable via `reflog`. Seul le travail **jamais commité** est réellement perdu.

---

## Alias

**1. Les définir (une fois) — à copier-coller :**

```bash
git config --global alias.alias "config --get-regexp ^alias\."
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.lg "log --color --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"
git config --global alias.glog "log --oneline --graph --all --decorate"
git config --global alias.fp "log --oneline --first-parent"
git config --global alias.ac "!git add . && git commit -m"
git config --global alias.acm "!git add . && git commit --amend -m"
git config --global alias.fa fetch
git config --global alias.amnd "!git add . && git commit --amend --no-edit"
git config --global alias.follow "glog --follow"
```

**2. Ce que fait chaque alias :**

| Alias | Ce que ça fait |
|---|---|
| `git alias` | liste tous les alias configurés |
| `git st` | état des fichiers (`status`) |
| `git co` | changer de branche ou restaurer un fichier (`checkout`) |
| `git br` | lister · créer · supprimer des branches (`branch`) |
| `git ci` | créer un commit (`commit`) |
| `git lg` | historique en graphe coloré (branche courante) : hash · refs · message · âge · auteur |
| `git glog` | graphe de toutes les branches, une ligne par commit |
| `git fp` | historique linéaire : suit le 1er parent, masque le détail des merges |
| `git ac "msg"` | indexer tout puis committer avec un message, en une commande |
| `git acm "msg"` | indexer tout puis réécrire le dernier commit avec un nouveau message |
| `git fa` | récupérer les commits distants, sans intégrer (`fetch`) |
| `git amnd` | indexer tout puis l'ajouter au dernier commit (message inchangé) |
| `git follow <fichier>` | historique d'un fichier, à travers ses renommages |

> ⚠️ `acm` / `amnd` réécrivent le dernier commit (`--amend`) : à éviter s'il est déjà **poussé**.

---

> À retenir : `git status` avant et après chaque commande.
