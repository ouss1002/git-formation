# 🎤 Guide d'animation — Formation Git (2 h, démo live)

> Le **script du réalisateur** : par où commencer, comment raconter l'histoire, quels
> sondages Teams lancer, comment dérouler chaque scénario. Le **contenu** est dans
> [`FORMATION.md`](./FORMATION.md) / [`FORMATION-MINI.md`](./FORMATION-MINI.md) ;
> le **montage technique** dans [`../README.md`](../README.md).
>
> 🎯 Fil rouge unique : **« Git = une machine à voyager dans le temps pour ton travail. »**
> Tout le reste s'y raccroche.

---

## 0. ✅ Pré-vol

**La veille (J-1)**
- [ ] Répéter **une fois** le déroulé en entier, chrono en main (les démos live débordent toujours).
- [ ] Pré-créer les **sondages** dans Microsoft Forms (voir §3) pour les lancer en 1 clic depuis Teams.
- [ ] Vérifier que `node`, `git` et VS Code (+ GitLens) sont OK.

**10 min avant**
- [ ] `powershell -ExecutionPolicy Bypass -File scripts\setup-repos.ps1` → terrain **remis à neuf**.
- [ ] `cd watcher && node server.js ../playground` → ouvrir **http://localhost:4242**.
- [ ] Disposer l'écran : **navigateur (watcher) à gauche**, **terminal à droite**, **VS Code** prêt en 3e onglet.
- [ ] **Grossir les polices** : terminal ≥ 18 pt, navigateur zoom 125 %. Thème sombre partout.
- [ ] Ouvrir [`FORMATION-MINI.md`](./FORMATION-MINI.md) en **aperçu** comme antisèche perso.
- [ ] Tester le **partage d'écran** Teams + le lancement d'un sondage.

> 🧯 **Règle de sécurité n°1 :** si une démo plante en live, ne t'acharne pas → bascule sur
> `npm run simulate` (l'histoire scriptée) ou re-`setup-repos.ps1`, et continue. Personne ne le verra.

---

## 1. 🎬 L'arc narratif (l'histoire en 6 actes)

| Acte | Le message | Émotion visée |
|---|---|---|
| **1. Le chaos** | « `rapport_final_v7_VRAIMENT_final.xlsx`… ça vous parle ? » | rire jaune, on se reconnaît |
| **2. La machine** | Git range *toutes* les versions, invisible mais accessible. Les **3 zones**. | curiosité, « ah, c'est donc ça » |
| **3. Premiers pas** | Le cycle `status → add → commit`. Faire un checkpoint. | confiance, « je peux le faire » |
| **4. Sans peur** | Branches, conflits, et surtout : **on récupère presque tout**. | soulagement, « je peux casser » |
| **5. En équipe** | Le QG (Azure) : push / pull. Jouer à plusieurs. | projection, « utile pour nous » |
| **6. À vous** | 20 min de pratique sur un vrai dépôt Azure. | autonomie, « j'essaie » |

**Par où commencer (les 3 premières minutes) :** écran **déjà partagé sur le watcher** (les 8 dépôts
colorés à l'écran = accroche visuelle). Tu ne l'expliques pas encore. Tu lances le **sondage d'accueil**,
puis tu racontes le drame du `rapport_final`. Et tu promets : *« À la fin, ce tableau de bord, vous le
lirez les yeux fermés — et vous n'aurez plus jamais peur de perdre votre travail. »*

---

## 2. ⏱️ Déroulé minute par minute

> 100 min de contenu + 20 min de pratique. **(h) rebase est un bonus** : à couper en premier si tu débordes.

| ⏱️ | Acte / Section | Ce que tu fais | 📊 Sur le watcher | 🗳️ Sondage |
|---|---|---|---|---|
| 0–08 | Accueil + chaos | Sondage niveau · histoire `rapport_final` · la promesse | tour d'horizon des 8 dépôts | **P0** niveau |
| 08–15 | Vocabulaire | **P1** (commandes inconnues) · les 6 verbes EN↔FR | — | **P1** connu/inconnu |
| 15–30 | Les 3 zones | Établi / Sas / Dépôt + QG · identité · c'est quoi *bare* | montre **Zaka** (établi sale), **Elsa** (sas), badge **bare** d'AZURE_REPO | — |
| 30–48 | Cycle de base | **Scénarios (a)** puis **(b)** | fichier Établi→Sas→graphe, en direct | **P2**, **P3** prédiction |
| 48–65 | Branches & conflit | **(c)** branche+merge · **(d)** conflit **local** | **Thomas** est déjà sur `feature` ; graphe qui diverge/rejoint | **P4**, **P5** |
| 65–80 | Voyager sans peur | **(f)** « j'ai tout cassé » → reflog | le graphe recule puis **ressuscite** | **P6** vrai/faux |
| 80–95 | Le QG (équipe) | **(e)** push/pull · reprise du conflit **à distance** sur **Anya** · **(g)** stash sur **Othmane** | AZURE_REPO grandit ; badges ahead/behind ; compteur de stash | **P7** |
| 95–100 | Récap | Bouton panique · teaser **GitLens** dans VS Code · *(bonus (h) rebase si le temps)* | — | **P8** confiance |
| 100–120 | À vous de jouer | Pratique Azure en binômes (voir §6) | (ils ferment le watcher) | **P9** clôture |

---

## 3. 🗳️ Les sondages Teams (quand & pourquoi)

**Comment :** pré-crée-les dans **Microsoft Forms**, puis dans la réunion Teams → **Apps → Polls/Forms →
Launch**. Garde-les **courts** (≤ 20 s) pour ne pas casser le rythme.

**Trois usages :** 🧭 *calibrer* (savoir où en est la salle) · 🎯 *prédire* (rendre le public actif
avant une démo) · ✅ *vérifier* (ancrer une règle juste après).

| # | Quand | Type | Question | Options / Réponse |
|---|---|---|---|---|
| **P0** | 0–02 | 🧭 calibrer | « Ta relation avec Git aujourd'hui ? » | jamais entendu · vaguement · je clone/commit · je gère branches & merge · je rebase tranquille |
| **P1** | 08 | 🧭 calibrer | « Coche les commandes que tu n'as **jamais** vues ni entendues » | `clone` `status` `add` `commit` `push` `pull` `fetch` `branch` `merge` `stash` `reflog` `rebase` *(multi)* |
| **P2** | avant (a) | 🎯 prédire | « Après `git add`, ton fichier est-il sauvegardé pour toujours ? » | Oui / **Non** *(juste préparé)* |
| **P3** | pendant (b) | 🎯 prédire | « Si j'`add` **un seul** fichier puis commit, les autres modifs partent aussi ? » | Oui / **Non** |
| **P4** | avant (c) | 🎯 prédire | « Si je casse tout dans une branche, `main` est abîmé ? » | Oui / **Non** |
| **P5** | avant (d) | 🎯 prédire | « 2 versions de la **même ligne** se rencontrent. Git… » | choisit la mienne · choisit l'autre · **me demande** · plante |
| **P6** | pendant (f) | ✅ vérifier | « Un `reset --hard` qui efface 2 commits = perdus à jamais ? » | Vrai / **Faux** *(reflog !)* |
| **P7** | avant (e) | 🎯 prédire | « `fetch` et `pull`, c'est pareil ? » | Oui / **Non** *(pull = fetch + merge)* |
| **P8** | 95 | 🧭 calibrer | « Capable de : cloner, commit, push tout seul ? » | oui · presque · pas encore |
| **P9** | 118 | 🎉 clôture | « Git en **un mot** ? » | *nuage de mots (texte libre)* |

> 💡 **Exploite les résultats à voix haute.** P1 : « 80 % n'ont jamais vu `reflog` ? Parfait, c'est
> justement le bouton magique de tout à l'heure. » P6 : « La moitié a dit *Vrai*… surprise dans 10 secondes. »
> Le sondage n'est utile que si tu **réagis** à ce qu'il révèle.

---

## 4. 🍳 La recette d'un scénario (à appliquer aux 8)

Chaque scénario se raconte en **4 temps** — toujours les mêmes :

1. **🎭 Le problème humain** (1 phrase) — une galère que *eux* vivront. Pas de jargon.
2. **🎯 La prédiction** — un sondage *ou* un « à votre avis ? » à main levée. Ils s'engagent.
3. **⌨️ La démo** — tu tapes **lentement**, tu **annonces** la commande (« je prépare… »), puis tu
   **te tais 2 secondes** et tu **montres le watcher** qui réagit. Le silence laisse le visuel parler.
4. **🛡️ La règle** — *une* phrase à retenir (tirée des « règles d'or par commande »).

> 🐢 **Le tempo, c'est tout :** *annonce → tape → SILENCE → le tableau de bord bouge → la règle.*
> Ne commente jamais par-dessus l'animation : laisse-les voir le fichier sauter de zone.

---

## 5. 🎭 Les 8 scénarios, racontés

> Chaque scénario s'appuie sur un **dépôt déjà préparé** du terrain de jeu. Commandes exactes :
> annexe de [`FORMATION.md`](./FORMATION.md#17--annexe--scénarios-de-démo-pas-à-pas).

### (a) 🥇 Premier checkpoint
- **Problème :** « Tu viens d'écrire ton premier calcul. Comment le graver dans le marbre ? »
- **Prédiction :** **P2** (« add = sauvegardé ? » → non).
- **Démo (dépôt Oussama) :** `status` → crée un fichier → `add` → `commit`. Montre le fichier **sauter** Établi → Sas → un **nœud** dans le graphe, signé *Oussama*.
- **Règle :** 🧭 `status` avant/après · 💾 le commit, c'est le checkpoint.

### (b) 🧺 Staging sélectif — *le cœur du sujet*
- **Problème :** « Tu as bossé sur **2 choses** différentes. Tu veux 2 sauvegardes **propres**, pas un fourre-tout. »
- **Prédiction :** **P3**.
- **Démo :** modifie 2 fichiers → `add` **un seul** → `commit` → `add` l'autre → `commit`. Deux checkpoints thématiques.
- **Règle :** 🛡️ le **sas te laisse CHOISIR**. *C'est ça*, la staging area — le concept que tout le monde rate.

### (c) 🌌 Branche + merge
- **Problème :** « Tu veux tester une idée risquée **sans casser** la version qui marche. »
- **Prédiction :** **P4** (« casser une branche abîme `main` ? » → non).
- **Démo :** `switch -c experimentation` → commit → `switch main` → `merge`. Montre la **colonne** qui naît puis **rejoint** main. *(Bonus : pointe **Thomas**, déjà sur `feature/calcul-prime`, dans le dashboard.)*
- **Règle :** 🛡️ les branches = **univers parallèles gratuits et jetables**.

### (d) ⚡ Conflit (paradoxe temporel) — *climax 1*
- **Problème :** « Deux personnes ont changé la **même ligne**. Drame ?… Non. Juste une question. »
- **Prédiction :** **P5** (« Git fait quoi ? » → *me demande*).
- **Démo (local) :** 2 branches qui modifient la même ligne → `merge` → **conflit**. Ouvre le fichier (les `<<<<<<<`), **choisis**, supprime les balises, `add`, `commit` → **nœud de fusion**.
- **Dédramatise :** montre **`git merge --abort`** = « et hop, comme si rien ne s'était passé ».
- **Règle :** 🛡️ un conflit = Git te **passe poliment la main**.

### (e) 🛰️ Push / fetch / pull — *l'équipe*
- **Problème :** « Comment envoyer mon travail au QG **sans écraser** celui des autres ? »
- **Prédiction :** **P7** (fetch ≠ pull).
- **Démo (dépôt Oussama, déjà *behind 1*) :** `status` (behind) → `pull` → modifie/`commit` (ahead) → `push`. Sur le watcher : **AZURE_REPO grandit**, badges **ahead/behind** qui bougent. Puis **Jorge** `fetch` + `pull`.
- **Reprise du conflit, version réelle :** sur **Anya** (divergente), lance `git pull` → **même paradoxe, mais à distance**. Boucle bouclée avec le scénario (d).
- **Règle :** 🛡️ **`pull` avant `push`, toujours.**

### (f) 🆘 « J'ai tout cassé » → reflog — *climax 2, le pic émotionnel*
- **Problème :** « LE moment de panique : *‘j'ai tout perdu’*. Joue la panique pour de vrai. »
- **Prédiction :** **P6** (reset --hard = perdu à jamais ? → Faux).
- **Démo :** `reset --hard HEAD~2` → 😱 « ils ont disparu » (le graphe **recule**) → `reflog` → `reset --hard <sha>` → ✨ « **résurrection** » (les commits **réapparaissent**).
- **Règle :** 🛟 **Git oublie rarement. Commite souvent.** C'est le cœur de toute la formation.

### (g) 🎒 Stash (poche dimensionnelle)
- **Problème :** « **Urgence !** Tu dois changer de tâche, mais ton travail est à moitié fini. »
- **Démo (dépôt Othmane, qui a déjà un stash) :** modifie → `stash` (établi **propre**, compteur +1) → `stash pop` (ça **revient**, compteur −1).
- **Règle :** 🛡️ la poche pour **mettre de côté sans commit**.

### (h) 🔀 Rebase interactif — *bonus, « pour aller plus loin »*
- **Problème :** « 5 commits brouillons *‘wip’, ‘wip2’*… Avant de les **montrer**, fais le ménage. »
- **Démo :** fabrique 3 commits brouillons → `rebase -i HEAD~3` → `squash` → **1 checkpoint propre**. (L'éditeur s'ouvre dans **VS Code** — clin d'œil au réglage `core.editor`.)
- **Règle :** 🛡️ **jamais** sur des commits **déjà poussés**. C'est le *director's cut* de ton historique.

---

## 6. 🤝 Le final — 20 min de pratique sur Azure

- **Transition :** « Vous avez vu la machine. Maintenant, **vous** pilotez. »
- **Mise en place :** chacun **clone** le dépôt Azure que tu leur fournis. **En binômes** (un pilote, un copilote qui lit la cheatsheet) → moins de blocages, plus d'entraide.
- **La mission (au tableau) :**
  1. `clone` puis `git config user.name/email`.
  2. Crée un fichier à ton nom, `add` + `commit`.
  3. `push`. (Si « rejected » → 🎉 occasion d'or : `pull` d'abord !)
  4. `pull` le travail d'un binôme voisin.
  5. **Défi bonus :** provoquez (et résolvez) un **paradoxe** ensemble sur la même ligne.
- **Pendant ce temps :** tu circules (ou tu observes les dépôts qui poussent). Garde la **cheatsheet** et le
  **bouton panique** affichés.
- **Clôture :** sondage **P9** (« Git en un mot »), puis : *« Vous savez sauvegarder, voyager, et vous
  rattraper. Le reste, c'est de la pratique. Et souvenez-vous : presque tout se récupère. »*

---

## 7. 🧯 Plans de secours

| Souci | Réaction |
|---|---|
| Une démo plante en live | Ne t'acharne pas → `npm run simulate` (histoire scriptée) **ou** re-`setup-repos.ps1`. |
| Le watcher se fige | Rafraîchis l'onglet (la reconnexion est auto) ; en dernier recours, relance `node server.js`. |
| Tu débordes (retard) | Coupe dans l'ordre : **(h) rebase** → **(g) stash** → le 2e exemple de chaque scénario. |
| Un sondage tombe à plat | Enchaîne sans t'attarder ; passe au « à main levée ». |
| Question très avancée | « Excellente — je la note au *parking* » (garde un coin d'écran pour les questions hors-scope). |
| Quelqu'un est perdu | Reviens **toujours** à `git status` et au schéma des **3 zones**. C'est la bouée. |

---

## 8. 💬 Punchlines à dégainer

- 🕰️ « Git, c'est une **machine à voyager dans le temps** pour ton travail. »
- 🧭 « `git status` **avant et après**. C'est gratuit, et ça t'évite 95 % des paniques. »
- 🧺 « Le **sas**, c'est ton **panier de courses** : tu choisis ce qui passe en caisse. »
- ⚡ « Un conflit, ce n'est pas Git qui t'engueule — c'est Git qui te **demande poliment** de trancher. »
- 🛟 « **Git oublie rarement.** Tant que tu avais commité, c'est récupérable. »
- 💾 « Le seul travail vraiment fragile, c'est celui que tu **n'as jamais commité**. Donc : commite **souvent**. »
- 🚀 « N'aie pas peur de **casser** — va voir, va tester, va rembobiner. C'est *fait pour ça*. »

---

> 🎬 **Bon spectacle.** Ton vrai job aujourd'hui n'est pas d'apprendre Git à des gens —
> c'est de leur enlever la **peur** de Git. Le reste suivra tout seul.
