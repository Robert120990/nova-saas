@echo off
title Conector Wayne Fusion FFC - SIPE WEB
color 0A
cd /d "%~dp0"

echo ================================================================
echo      CONECTOR LOCAL WAYNE FUSION FFC - SIPE WEB NOVASAAS        
echo ================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR CRITICO] No se encontro Node.js en esta computadora.
    echo.
    echo Para conectar con Fusion FFC, instale Node.js (v20 o superior):
    echo Descarga: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Si fusion-agent.js no existe, intentar recuperarlo de Descargas o corregir extension .txt
if not exist "fusion-agent.js" (
    if exist "fusion-agent.js.txt" (
        ren "fusion-agent.js.txt" "fusion-agent.js"
        echo [INFO] Archivo fusion-agent.js.txt corregido a fusion-agent.js
    ) else if exist "%USERPROFILE%\Downloads\fusion-agent.js" (
        copy /y "%USERPROFILE%\Downloads\fusion-agent.js" "fusion-agent.js" >nul
        echo [INFO] Se copio fusion-agent.js desde la carpeta Descargas.
    ) else if exist "%USERPROFILE%\Descargas\fusion-agent.js" (
        copy /y "%USERPROFILE%\Descargas\fusion-agent.js" "fusion-agent.js" >nul
        echo [INFO] Se copio fusion-agent.js desde la carpeta Descargas.
    )
)

if not exist "fusion-agent.js" (
    color 0C
    echo [ERROR] Falta el archivo 'fusion-agent.js' en esta carpeta:
    echo %~dp0
    echo.
    echo Asegurese de colocar juntos los 3 archivos:
    echo  1. fusion-agent.js
    echo  2. config.json
    echo  3. iniciar-agente.bat
    echo.
    echo Si lo descargo recientemente, busquelo en su carpeta de Descargas
    echo y peguelo en esta carpeta (%~dp0).
    echo.
    pause
    exit /b 1
)

echo [INFO] Node.js detectado correctamente.
echo [INFO] Iniciando puente de comunicacion segura con el SaaS...
echo.

node fusion-agent.js

if %errorlevel% neq 0 (
    echo.
    color 0C
    echo [AVISO] El conector se detuvo.
    pause
)
