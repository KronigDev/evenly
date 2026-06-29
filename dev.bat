@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Evenly - Dev Steuerung

REM ============================================================
REM  Evenly - Dev-Launcher fuer den Docker-Stack
REM  (App + PostgreSQL + Mailpit)
REM ============================================================

REM --- .env automatisch anlegen, falls nicht vorhanden ---------
if not exist ".env" (
  if exist ".env.example" (
    copy /y ".env.example" ".env" >nul
    echo [Setup] .env wurde aus .env.example erstellt.
  ) else (
    echo [Warnung] .env.example nicht gefunden - es wird nur mit Docker-Standardwerten gestartet.
  )
  timeout /t 2 >nul
)

REM --- Pruefen ob Docker laeuft --------------------------------
docker version >nul 2>&1
if errorlevel 1 (
  echo.
  echo [Fehler] Docker ist nicht erreichbar.
  echo Bitte starte "Docker Desktop" und fuehre dev.bat erneut aus.
  echo.
  pause
  exit /b 1
)

:menu
cls
set "RUNCOUNT=0"
for /f %%s in ('docker compose ps --services --status running 2^>nul') do set /a RUNCOUNT+=1
echo ============================================================
echo                  E V E N L Y  -  Dev
echo ============================================================
echo   Laufende Dienste: !RUNCOUNT! / 3
echo   App:     http://localhost:3001
echo   Mailpit: http://localhost:8025
echo ------------------------------------------------------------
echo.
echo   [1]  Starten             (Stack hochfahren, baut bei Bedarf)
echo   [2]  Neu bauen / Update  (App-Image neu bauen + starten)
echo   [3]  Stoppen             (Container stoppen, Daten bleiben)
echo   [4]  App neu starten
echo   [5]  Logs anzeigen       (eigenes Fenster, mit STRG+C beenden)
echo   [6]  Status
echo   [7]  Datenbank zuruecksetzen   (Volumes loeschen + neu seeden)
echo   [8]  Im Browser oeffnen  (App / Mailpit)
echo   [9]  ALLES loeschen      (Container + Volumes + Image)
echo   [0]  Beenden
echo.
set "choice="
set /p choice=Auswahl:

if "%choice%"=="1" goto start
if "%choice%"=="2" goto rebuild
if "%choice%"=="3" goto stop
if "%choice%"=="4" goto restart
if "%choice%"=="5" goto logs
if "%choice%"=="6" goto status
if "%choice%"=="7" goto resetdb
if "%choice%"=="8" goto browser
if "%choice%"=="9" goto nuke
if "%choice%"=="0" goto end
echo Ungueltige Auswahl.
timeout /t 1 >nul
goto menu

:start
echo.
echo Starte Evenly... (erster Start kann einige Minuten dauern - Image wird gebaut)
docker compose up -d
if errorlevel 1 ( echo. & echo [Fehler] Start fehlgeschlagen. & pause & goto menu )
call :urls
pause
goto menu

:rebuild
echo.
echo Baue App-Image neu und starte (Update nach Code-Aenderungen)...
docker compose up -d --build
if errorlevel 1 ( echo. & echo [Fehler] Build/Start fehlgeschlagen. & pause & goto menu )
call :urls
pause
goto menu

:stop
echo.
echo Stoppe Container (Daten bleiben erhalten)...
docker compose stop
echo Gestoppt.
pause
goto menu

:restart
echo.
echo Starte die App neu...
docker compose restart app
echo Fertig.
pause
goto menu

:logs
echo.
echo Oeffne App-Logs in einem neuen Fenster (STRG+C beendet die Logs)...
start "Evenly Logs" cmd /k docker compose logs -f app
timeout /t 1 >nul
goto menu

:status
echo.
docker compose ps
echo.
pause
goto menu

:resetdb
echo.
echo [Achtung] Dies LOESCHT die Datenbank und hochgeladene Dateien
echo und seedet danach frische Demo-Daten.
set "ok="
set /p ok=Wirklich zuruecksetzen? (j/n):
if /i not "%ok%"=="j" ( echo Abgebrochen. & timeout /t 1 >nul & goto menu )
echo.
echo Entferne Volumes und starte neu...
docker compose down -v
docker compose up -d
if errorlevel 1 ( echo. & echo [Fehler] Zuruecksetzen fehlgeschlagen. & pause & goto menu )
echo Datenbank wurde zurueckgesetzt und neu geseedet.
call :urls
pause
goto menu

:browser
echo.
echo Oeffne App und Mailpit im Browser...
start "" http://localhost:3001
start "" http://localhost:8025
timeout /t 1 >nul
goto menu

:nuke
echo.
echo [Achtung] Dies entfernt ALLE Evenly-Container, Volumes (Daten!)
echo und das lokal gebaute App-Image.
set "ok="
set /p ok=Wirklich ALLES loeschen? (j/n):
if /i not "%ok%"=="j" ( echo Abgebrochen. & timeout /t 1 >nul & goto menu )
echo.
docker compose down -v --rmi local --remove-orphans
echo Alles entfernt. Mit [1] oder [2] kannst du neu starten.
pause
goto menu

:urls
echo.
echo ------------------------------------------------------------
echo   Evenly laeuft:
echo     App      ^> http://localhost:3001   (Login: ada@evenly.app / password123)
echo     Mailpit  ^> http://localhost:8025   (alle E-Mails landen hier)
echo ------------------------------------------------------------
exit /b 0

:end
endlocal
exit /b 0
