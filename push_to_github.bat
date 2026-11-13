@echo off
title GORSY - Push to GitHub
echo ======================================================================
echo  GORSY B2B MANUFACTURING - PUSH TO GITHUB REPOSITORY
echo  Target: https://github.com/chahadmaqsood786-beep/be-times-sports.git
echo ======================================================================
echo.

cd /d "%~dp0"

echo Staging all project files...
"C:\Users\Saleem\git\cmd\git.exe" add .

echo Committing updates...
"C:\Users\Saleem\git\cmd\git.exe" commit -m "GORSY Sports & Activewear Website - Multi-page architecture & 3D Studio" 2>nul

echo.
echo Pushing to GitHub (main branch)...
echo If a GitHub sign-in window opens, please click 'Sign in with your browser' or enter credentials.
echo.

"C:\Users\Saleem\git\cmd\git.exe" push -u origin main

echo.
if %ERRORLEVEL% EQU 0 (
    echo ======================================================================
    echo  [SUCCESS] All files successfully pushed to your repository!
    echo  View online: https://github.com/chahadmaqsood786-beep/be-times-sports
    echo ======================================================================
) else (
    echo ======================================================================
    echo  [NOTE] If authentication failed, you can also use a GitHub Token.
    echo ======================================================================
)

echo.
pause
