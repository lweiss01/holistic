#!/usr/bin/env sh
ROOT='C:\Users\lweis\Documents\holistic'
REMOTE='origin'
STATE_BRANCH='holistic/state'
if ! git -C "$ROOT" diff --quiet -- HOLISTIC.md AGENTS.md .holistic 2>/dev/null; then
  echo 'Holistic restore skipped because local Holistic files are dirty.'
  exit 0
fi
if ! git -C "$ROOT" fetch "$REMOTE" "$STATE_BRANCH" 2>/dev/null; then
  echo 'Holistic restore skipped because remote state branch is unavailable.'
  exit 0
fi
git -C "$ROOT" checkout FETCH_HEAD -- HOLISTIC.md AGENTS.md .holistic 2>/dev/null || true
