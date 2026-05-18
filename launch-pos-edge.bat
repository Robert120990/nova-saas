@echo off
REM ============================================
REM NOVA POS - Modo Impresion Directa (Edge)
REM Inicia Edge sin dialogo de impresion
REM ============================================
REM 
REM Requisitos previos:
REM 1. La impresora termica debe ser la PREDETERMINADA en Windows
REM 2. El POS debe tener "Impresion directa" activado en NOVA
REM
REM Cierra TODAS las ventanas de Edge antes de ejecutar este script
REM ============================================

taskkill /F /IM msedge.exe 2>nul
timeout /t 2 /nobreak >nul

start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --disable-print-preview --kiosk-printing http://localhost:3000

echo Edge iniciado con impresion directa.
pause
