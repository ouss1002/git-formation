#!/usr/bin/env bash
# Lanceur macOS / Linux — délègue à l'implémentation multiplateforme (Node).
# Équivalent direct : node scripts/teardown.mjs
exec node "$(dirname "$0")/teardown.mjs" "$@"
