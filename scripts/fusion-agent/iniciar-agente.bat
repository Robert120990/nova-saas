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
