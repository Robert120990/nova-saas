@echo off
setlocal enabledelayedexpansion
title Conector Marcador Biometrico ZKTeco - SIPE WEB
color 0A
cd /d "%~dp0"

echo ======================================================================
echo   CONECTOR LOCAL MARCADOR DIGITAL ZKTECO - RECURSOS HUMANOS (SIPE)    
echo ======================================================================
echo Carpeta actual: %cd%
echo.

echo [1/4] Verificando instalacion de Node.js...

set "NODE_CMD="

:: 1. Buscar en PATH
where node >nul 2>nul
if %errorlevel% equ 0 (
    set "NODE_CMD=node"
    goto found_node
)

:: 2. Buscar en rutas estandar de 64-bit y 32-bit
if exist "%ProgramFiles%\nodejs\node.exe" (
    set "NODE_CMD=%ProgramFiles%\nodejs\node.exe"
    goto found_node
)
if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    set "NODE_CMD=%ProgramFiles(x86)%\nodejs\node.exe"
    goto found_node
)
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    set "NODE_CMD=%LOCALAPPDATA%\Programs\nodejs\node.exe"
    goto found_node
)

:: Si no se encontro Node.js
echo.
echo [ERROR] Node.js no esta instalado en este equipo.
echo Se requiere Node.js para que el conector pueda comunicarse con el reloj biometrico.
echo.
echo Descargue el instalador LTS desde https://nodejs.org
echo Abriendo pagina oficial de Node.js en su navegador...
start https://nodejs.org
echo.
echo Despues de instalarlo, vuelva a ejecutar este archivo iniciar-conector.bat
echo.
pause
exit /b 1

:found_node
echo [OK] Node.js detectado: %NODE_CMD%
echo.

echo [2/4] Verificando archivos del conector...
if not exist "biometric-agent.js" goto missing_agent
echo [OK] Archivo biometric-agent.js presente.
goto check_config

:missing_agent
echo.
echo [ERROR] No se encuentra el archivo 'biometric-agent.js' en esta carpeta.
echo Por favor asegurese de colocar 'iniciar-conector.bat', 'biometric-agent.js'
echo y 'config.json' en la misma carpeta.
echo Puede descargarlos todos desde el sistema SIPE WEB en Marcador Digital.
echo.
pause
exit /b 1

:check_config
echo.
echo [3/4] Verificando archivo de configuracion (config.json)...
if exist "config.json" goto config_ok

:: Si se descargo como config (1).json o similar
for %%f in (config*.json) do (
    echo [INFO] Detectado %%f, configurando como config.json...
    copy "%%f" "config.json" >nul 2>nul
    goto config_ok
)

if exist "config.json.example" (
    echo [INFO] Usando config.json.example como base...
    copy "config.json.example" "config.json" >nul 2>nul
    goto config_ok
)

echo [ADVERTENCIA] No se encontro config.json.
echo Descarguelo desde SIPE WEB en Marcador Digital - Conector Local.
echo.

:config_ok
echo [OK] Configuracion lista.
echo.

echo [4/4] Verificando librerias de conexion (node-zklib)...
if exist "node_modules\node-zklib" goto ready_to_run

echo [INFO] Primera ejecucion: instalando libreria node-zklib...
echo Esto tomara unos segundos, por favor espere...
echo.

:: Asegurar que exista un package.json minimo para npm
if not exist "package.json" (
    echo {"name":"sipe-biometric-agent","version":"1.0.0","private":true} > package.json
)

:: Detectar comando npm
set "NPM_CMD=npm"
where npm >nul 2>nul
if %errorlevel% neq 0 (
    if defined NODE_CMD (
        for %%i in ("%NODE_CMD%") do (
            if exist "%%~dpi\npm.cmd" set "NPM_CMD=%%~dpi\npm.cmd"
        )
    )
)

call "!NPM_CMD!" install node-zklib --no-audit --no-fund --omit=dev
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] No se pudo instalar la libreria node-zklib.
    echo Verifique su conexion a Internet e intente nuevamente.
    echo.
    pause
    exit /b 1
)

:ready_to_run
echo [OK] Librerias listas.
echo.
echo ======================================================================
echo   INICIANDO CONECTOR BIOMETRICO EN TIEMPO REAL...
echo   (Mantenga esta ventana abierta para sincronizar con SIPE)
echo ======================================================================
echo.

"%NODE_CMD%" biometric-agent.js

echo.
echo ======================================================================
echo   El conector se ha detenido.
echo   Revise los mensajes anteriores para ver el detalle.
echo ======================================================================
echo.
pause
