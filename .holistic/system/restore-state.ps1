$ErrorActionPreference = 'Stop'
$root = 'C:\Users\lweis\Documents\holistic'
$remote = 'origin'
$stateBranch = 'holistic/state'
$tracked = @('HOLISTIC.md','AGENTS.md','.holistic')
$status = git -C $root status --porcelain -- HOLISTIC.md AGENTS.md .holistic 2>$null
if ($LASTEXITCODE -ne 0) { exit 0 }
if ($status) { Write-Host 'Holistic restore skipped because local Holistic files are dirty.'; exit 0 }
git -C $root fetch $remote $stateBranch 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host 'Holistic restore skipped because remote state branch is unavailable.'; exit 0 }
git -C $root checkout FETCH_HEAD -- HOLISTIC.md AGENTS.md .holistic 2>$null | Out-Null
