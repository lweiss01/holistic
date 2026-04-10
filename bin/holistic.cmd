@echo off
setlocal
set SCRIPT_DIR=%~dp0
node --experimental-strip-types "%SCRIPT_DIR%..\src\cli.ts" %*
if errorlevel 1 exit /b %errorlevel%

rem Holistic: Sync logic is now handled inside the Node CLI or gated behind explicit flags.
rem This wrapper is kept simple to avoid shell variable injection vulnerabilities.
