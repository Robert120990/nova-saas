@echo off
REM ============================================
REM NOVA POS - Modo Impresion Directa
REM Inicia Chrome sin dialogo de impresion
REM ============================================
REM 
REM Requisitos previos:
REM 1. La impresora termica debe ser la PREDETERMINADA en Windows
REM 2. El POS debe tener "Impresion directa" activado en NOVA
REM
REM Cierra TODAS las ventanas de Chrome antes de ejecutar este script
REM ============================================

taskkill /F /IM chrome.exe 2>nul
timeout /t 2 /nobreak >nul

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --new-window http://localhost:3000

echo Chrome iniciado con impresion directa.
echo Si no funciona, verifica que Chrome esta en: C:\Program Files\Google\Chrome\Application\chrome.exe
pause
