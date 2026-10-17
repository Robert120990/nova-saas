@echo off
title Detener Conector Marcador Biometrico ZKTeco - SIPE WEB
color 0C
cd /d "%~dp0"

echo ======================================================================
echo   DETENIENDO CONECTOR MARCADOR BIOMETRICO ZKTECO (SIPE WEB)
echo ======================================================================
echo.

echo [1/2] Cerrando ventana del conector...
taskkill /fi "WINDOWTITLE eq Conector Marcador Biometrico*" /f /t >nul 2>nul

echo [2/2] Cerrando procesos en segundo plano de biometric-agent...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*biometric-agent*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>nul

echo.
echo ======================================================================
echo   [OK] El conector biometrico ha sido detenido exitosamente.
echo ======================================================================
echo.
pause
