#!/usr/bin/env sh
ROOT='C:\Users\lweis\Documents\holistic'
REMOTE='origin'
STATE_BRANCH='holistic/state'
BRANCH=$(git -C "$ROOT" rev-parse --abbrev-ref HEAD) || exit 1
git -C "$ROOT" push "$REMOTE" "$BRANCH" || exit 1
TMPDIR=$(mktemp -d 2>/dev/null || mktemp -d -t holistic-state)
git -C "$ROOT" worktree add --force "$TMPDIR" >/dev/null 2>&1 || exit 1
cleanup() { git -C "$ROOT" worktree remove --force "$TMPDIR" >/dev/null 2>&1; }
trap cleanup EXIT
cd "$TMPDIR" || exit 1
git switch "$STATE_BRANCH" >/dev/null 2>&1 || git switch --orphan "$STATE_BRANCH" >/dev/null 2>&1 || exit 1
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp "$ROOT/HOLISTIC.md" ./HOLISTIC.md
cp "$ROOT/AGENTS.md" ./AGENTS.md
cp -R "$ROOT/.holistic" ./.holistic
git add HOLISTIC.md AGENTS.md .holistic
git diff --cached --quiet || git commit -m 'chore(holistic): sync portable state' >/dev/null 2>&1
git push "$REMOTE" HEAD:"$STATE_BRANCH"
