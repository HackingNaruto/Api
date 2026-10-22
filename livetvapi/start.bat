@echo off
title StreamX Live TV API Local Tester
cd /d "%~dp0"
echo Starting local test server on http://localhost:8080 ...
node server.js
pause
