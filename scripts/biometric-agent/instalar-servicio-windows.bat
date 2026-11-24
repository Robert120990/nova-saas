@echo off
setlocal enabledelayedexpansion
title Instalar Servicio Automatico - Conector Biometrico ZKTeco (SIPE WEB)
color 0B
cd /d "%~dp0"

echo ======================================================================
echo   INSTALADOR DE ARRANQUE AUTOMATICO - CONECTOR ZKTECO (SIPE WEB)
echo ======================================================================
echo Carpeta actual: %cd%
echo.

:: Verificar Node.js
set "NODE_EXE="
for /f "delims=" %%i in ('where node 2^>nul') do (
    if not defined NODE_EXE set "NODE_EXE=%%i"
)
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"

if not defined NODE_EXE (
    color 0C
    echo [ERROR] Node.js no encontrado. Instale Node.js LTS desde https://nodejs.org
    pause
    exit /b 1
)

if not exist "biometric-agent.js" (
    color 0C
    echo [ERROR] Falta biometric-agent.js en %cd%
    pause
    exit /b 1
)

if not exist "node_modules\node-zklib" (
    echo [INFO] Instalando dependencia node-zklib...
    call npm install node-zklib --no-audit --no-fund --omit=dev
)

:: Crear lanzador silencioso VBS para ejecutar en segundo plano sin ventana negra abierta
set "VBS_PATH=%cd%\run-hidden.vbs"
(
    echo Set WshShell = CreateObject("WScript.Shell"^)
    echo WshShell.CurrentDirectory = "%cd%"
    echo WshShell.Run """%NODE_EXE%"" ""%cd%\biometric-agent.js""", 0, False
) > "%VBS_PATH%"

:: Registrar tarea programada al iniciar sesion (no requiere permisos de administrador)
schtasks /Delete /TN "SIPE_Conector_Biometrico_ZKTeco" /F >nul 2>nul
schtasks /Create /TN "SIPE_Conector_Biometrico_ZKTeco" /TR "wscript.exe \"%VBS_PATH%\"" /SC ONLOGON /RL LIMITED /F

if %errorlevel% neq 0 (
    color 0E
    echo [AVISO] No se pudo registrar la tarea programada automaticamente.
    echo Puede copiar "%VBS_PATH%" a shell:startup manualmente.
    pause
    exit /b 1
)

echo.
echo [OK] Tarea programada "SIPE_Conector_Biometrico_ZKTeco" registrada correctamente.
echo [INFO] Iniciando el conector en segundo plano ahora mismo...
start "" wscript.exe "%VBS_PATH%"

echo.
echo El conector biometrico ya esta corriendo en segundo plano y se iniciara
echo automaticamente cada vez que encienda esta PC.
echo Para detenerlo en cualquier momento, ejecute detener-conector.bat
echo.
pause
exit /b 0
