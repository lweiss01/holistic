$ErrorActionPreference = 'Stop'
$root = 'C:\Users\lweis\Documents\holistic'
$remote = 'origin'
$stateBranch = 'holistic/state'
$branch = git -c core.hooksPath=NUL -C $root rev-parse --abbrev-ref HEAD
if ($LASTEXITCODE -ne 0) { throw 'Unable to determine current branch.' }
git -c core.hooksPath=NUL -C $root push $remote $branch
$tmp = Join-Path $env:TEMP ('holistic-state-' + [guid]::NewGuid().ToString())
git -c core.hooksPath=NUL -C $root worktree add --force $tmp | Out-Null
try {
  Push-Location $tmp
  git -c core.hooksPath=NUL switch $stateBranch 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    git -c core.hooksPath=NUL switch --orphan $stateBranch | Out-Null
  }
  Get-ChildItem -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
  Copy-Item -Path (Join-Path $root 'HOLISTIC.md') -Destination (Join-Path $tmp 'HOLISTIC.md') -Force
  Copy-Item -Path (Join-Path $root 'AGENTS.md') -Destination (Join-Path $tmp 'AGENTS.md') -Force
  Copy-Item -Path (Join-Path $root 'CLAUDE.md') -Destination (Join-Path $tmp 'CLAUDE.md') -Force
  Copy-Item -Path (Join-Path $root 'GEMINI.md') -Destination (Join-Path $tmp 'GEMINI.md') -Force
  Copy-Item -Path (Join-Path $root 'HISTORY.md') -Destination (Join-Path $tmp 'HISTORY.md') -Force
  Copy-Item -Path (Join-Path $root '.holistic') -Destination (Join-Path $tmp '.holistic') -Recurse -Force
  git -c core.hooksPath=NUL add HOLISTIC.md AGENTS.md CLAUDE.md GEMINI.md HISTORY.md .holistic
  git -c core.hooksPath=NUL diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    git -c core.hooksPath=NUL commit -m 'chore(holistic): sync portable state' | Out-Null
  }
  git -c core.hooksPath=NUL push $remote HEAD:$stateBranch
} finally {
  Pop-Location
  git -c core.hooksPath=NUL -C $root worktree remove --force $tmp | Out-Null
}
