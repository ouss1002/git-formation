# Lanceur Windows — délègue à l'implémentation multiplateforme (Node).
# Nécessite Node.js (déjà requis pour le watcher). Config : scripts/config.json
# Équivalent direct : node scripts\setup-repos.mjs
node "$PSScriptRoot\setup-repos.mjs" @args
exit $LASTEXITCODE
