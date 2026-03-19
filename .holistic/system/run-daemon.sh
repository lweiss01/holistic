#!/usr/bin/env sh
cd 'C:\Users\lweis\Documents\holistic' || exit 1
'C:\Users\lweis\Documents\holistic\.holistic\system\restore-state.sh' || true
'C:\Program Files\nodejs\node.exe' --experimental-strip-types 'C:\Users\lweis\Documents\holistic\src\daemon.ts' --interval 30 --agent unknown
