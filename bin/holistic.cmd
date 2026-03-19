@echo off
setlocal
set SCRIPT_DIR=%~dp0
node --experimental-strip-types "%SCRIPT_DIR%..\src\cli.ts" %*
if errorlevel 1 exit /b %errorlevel%
if /I "%~1"=="handoff" (
  set PENDING_FILE=%CD%\.holistic\context\pending-commit.txt
  if exist "%PENDING_FILE%" (
    set /p COMMIT_MSG=<"%PENDING_FILE%"
    if defined COMMIT_MSG (
      git add -- HOLISTIC.md AGENTS.md .holistic
      if not errorlevel 1 (
        git commit -m "%COMMIT_MSG%"
        if not errorlevel 1 (
          if exist "%CD%\.holistic\system\sync-state.ps1" (
            powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\.holistic\system\sync-state.ps1"
          )
          node --experimental-strip-types "%SCRIPT_DIR%..\src\cli.ts" internal-mark-commit --message "%COMMIT_MSG%"
        )
      )
    )
  )
)
