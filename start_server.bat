@echo off
title GORSY GARMENTS 3D Customizer Server
echo Starting GORSY Garments Local Server on http://localhost:3000 ...
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause