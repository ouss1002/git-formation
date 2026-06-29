# Lanceur Windows — délègue à l'implémentation multiplateforme (Node).
# Équivalent direct : node scripts\teardown.mjs
node "$PSScriptRoot\teardown.mjs" @args
exit $LASTEXITCODE
