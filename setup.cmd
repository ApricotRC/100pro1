@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18以上をインストールしてください。
  exit /b 1
)

node scripts\setup.mjs
exit /b %errorlevel%
