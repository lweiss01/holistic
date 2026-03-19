$ErrorActionPreference = 'Stop'
$root = 'C:\Users\lweis\Documents\holistic'
$remote = 'origin'
$stateBranch = 'holistic/state'
$branch = git -C $root rev-parse --abbrev-ref HEAD
if ($LASTEXITCODE -ne 0) { throw 'Unable to determine current branch.' }
git -C $root push $remote $branch
$tmp = Join-Path $env:TEMP ('holistic-state-' + [guid]::NewGuid().ToString())
git -C $root worktree add --force $tmp | Out-Null
try {
  Push-Location $tmp
  git switch $stateBranch 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    git switch --orphan $stateBranch | Out-Null
  }
  Get-ChildItem -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
  Copy-Item -Path (Join-Path $root 'HOLISTIC.md') -Destination (Join-Path $tmp 'HOLISTIC.md') -Force
  Copy-Item -Path (Join-Path $root 'AGENTS.md') -Destination (Join-Path $tmp 'AGENTS.md') -Force
  Copy-Item -Path (Join-Path $root '.holistic') -Destination (Join-Path $tmp '.holistic') -Recurse -Force
  git add HOLISTIC.md AGENTS.md .holistic
  git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    git commit -m 'chore(holistic): sync portable state' | Out-Null
  }
  git push $remote HEAD:$stateBranch
} finally {
  Pop-Location
  git -C $root worktree remove --force $tmp | Out-Null
}
