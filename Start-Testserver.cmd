@echo off
cd /d "%~dp0"
node server\demo.mjs
if errorlevel 1 (
  echo Node.js und npm ci --omit=dev werden fuer den lokalen Server benoetigt.
  pause
)
