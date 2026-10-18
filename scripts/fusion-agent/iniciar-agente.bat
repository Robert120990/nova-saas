@echo off
title Conector Wayne Fusion FFC - SIPE WEB
color 0A
cd /d "%~dp0"

echo ================================================================
echo      CONECTOR LOCAL WAYNE FUSION FFC - SIPE WEB NOVASAAS
echo ================================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto NO_NODE

echo [INFO] Cerrando instancias anteriores del conector en memoria...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe' AND CommandLine LIKE '%fusion-agent%'\" | Invoke-CimMethod -MethodName Terminate" >nul 2>nul

if exist "fusion-agent.js" goto RUN_AGENT
if exist "fusion-agent.js.txt" copy /y "fusion-agent.js.txt" "fusion-agent.js" >nul
for %%F in ("fusion-agent*.js") do if not exist "fusion-agent.js" copy /y "%%~fF" "fusion-agent.js" >nul
if not exist "fusion-agent.js" if exist "C:\fusion-agent\fusion-agent.js" copy /y "C:\fusion-agent\fusion-agent.js" "fusion-agent.js" >nul
for %%F in ("%USERPROFILE%\Downloads\fusion-agent*.js") do if not exist "fusion-agent.js" copy /y "%%~fF" "fusion-agent.js" >nul
for %%F in ("%USERPROFILE%\Descargas\fusion-agent*.js") do if not exist "fusion-agent.js" copy /y "%%~fF" "fusion-agent.js" >nul
if not exist "fusion-agent.js" goto NO_SCRIPT

:RUN_AGENT
echo [INFO] Node.js detectado correctamente.
echo [INFO] Iniciando puente de comunicacion segura con el SaaS...
echo.
node "fusion-agent.js"
echo.
color 0C
echo [AVISO] El conector se detuvo.
pause
exit /b 0

:NO_NODE
color 0C
echo [ERROR CRITICO] No se encontro Node.js en esta computadora.
echo Descarga: https://nodejs.org
echo.
pause
exit /b 1

:NO_SCRIPT
color 0C
echo [ERROR] Falta el archivo 'fusion-agent.js' en esta carpeta: %~dp0
echo Asegurese de colocar juntos fusion-agent.js, config.json e iniciar-agente.bat.
echo.
pause
exit /b 1
