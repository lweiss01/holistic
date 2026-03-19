$ErrorActionPreference = 'Stop'
$node = 'C:\Program Files\nodejs\node.exe'
$daemon = 'C:\Users\lweis\Documents\holistic\src\daemon.ts'
$working = 'C:\Users\lweis\Documents\holistic'
& 'C:\Users\lweis\Documents\holistic\.holistic\system\restore-state.ps1'
& $node --experimental-strip-types $daemon --interval 30 --agent unknown
