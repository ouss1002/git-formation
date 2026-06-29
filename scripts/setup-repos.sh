#!/usr/bin/env bash
# Lanceur macOS / Linux — délègue à l'implémentation multiplateforme (Node).
# Nécessite Node.js (déjà requis pour le watcher). Config : scripts/config.json
# Équivalent direct : node scripts/setup-repos.mjs
exec node "$(dirname "$0")/setup-repos.mjs" "$@"
