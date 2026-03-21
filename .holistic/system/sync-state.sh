#!/usr/bin/env sh
ROOT='C:\Users\lweis\Documents\holistic'
REMOTE='origin'
STATE_BRANCH='holistic/state'
BRANCH=$(git -c core.hooksPath=/dev/null -C "$ROOT" rev-parse --abbrev-ref HEAD) || exit 1
git -c core.hooksPath=/dev/null -C "$ROOT" push "$REMOTE" "$BRANCH" || exit 1
TMPDIR=$(mktemp -d 2>/dev/null || mktemp -d -t holistic-state)
git -c core.hooksPath=/dev/null -C "$ROOT" worktree add --force "$TMPDIR" >/dev/null 2>&1 || exit 1
cleanup() { git -c core.hooksPath=/dev/null -C "$ROOT" worktree remove --force "$TMPDIR" >/dev/null 2>&1; }
trap cleanup EXIT
cd "$TMPDIR" || exit 1
git -c core.hooksPath=/dev/null switch "$STATE_BRANCH" >/dev/null 2>&1 || git -c core.hooksPath=/dev/null switch --orphan "$STATE_BRANCH" >/dev/null 2>&1 || exit 1
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp "$ROOT/HOLISTIC.md" ./HOLISTIC.md
cp "$ROOT/AGENTS.md" ./AGENTS.md
cp "$ROOT/CLAUDE.md" ./CLAUDE.md
cp "$ROOT/GEMINI.md" ./GEMINI.md
cp "$ROOT/HISTORY.md" ./HISTORY.md
cp -R "$ROOT/.holistic" ./.holistic
git -c core.hooksPath=/dev/null add HOLISTIC.md AGENTS.md CLAUDE.md GEMINI.md HISTORY.md .holistic
git -c core.hooksPath=/dev/null diff --cached --quiet || git -c core.hooksPath=/dev/null commit -m 'chore(holistic): sync portable state' >/dev/null 2>&1
git -c core.hooksPath=/dev/null push "$REMOTE" HEAD:"$STATE_BRANCH"
