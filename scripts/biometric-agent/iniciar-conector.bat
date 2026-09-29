@echo off
title Conector Marcador Biometrico ZKTeco - SIPE WEB
color 0A
cd /d "%~dp0"

echo ======================================================================
echo   CONECTOR LOCAL MARCADOR DIGITAL ZKTECO - RECURSOS HUMANOS (SIPE)    
echo ======================================================================
echo Carpeta actual: %cd%
echo.

echo [1/4] Verificando instalacion de Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH del sistema.
  echo.
  echo Descargue e instale Node.js (LTS) gratis desde: https://nodejs.org
  echo Luego de instalarlo, vuelva a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)
echo [OK] Node.js detectado correctamente.
echo.

echo [2/4] Verificando archivos del conector...
if not exist "biometric-agent.js" (
  echo [ERROR] No se encuentra el archivo 'biometric-agent.js' en esta carpeta.
  echo.
  echo Asegurese de colocar 'iniciar-conector.bat', 'biometric-agent.js' y 'config.json'
  echo en la MISMA carpeta (por ejemplo C:\SIPE-Biometrico o scripts\biometric-agent).
  echo.
  pause
  exit /b 1
)
echo [OK] biometric-agent.js encontrado.
echo.

echo [3/4] Verificando archivo de configuracion (config.json)...
if not exist "config.json" (
  for %%f in (config-*.json) do (
    echo [INFO] Detectado %%f, configurando como config.json...
    copy "%%f" "config.json" >nul
  )
)
if not exist "config.json" (
  if exist "config.json.example" (
    echo [INFO] Copiando config.json.example a config.json...
    copy "config.json.example" "config.json" >nul
  ) else (
    echo [ADVERTENCIA] No se encontro config.json. Descarguelo desde el sistema SIPE.
  )
)
if exist "config.json" (
  echo [OK] config.json listo.
)
echo.

echo [4/4] Verificando libreria de conexion ZKTeco...
if not exist "node_modules\node-zklib" (
  echo [INFO] Primera ejecucion: instalando libreria node-zklib...
  call npm install node-zklib --no-audit --no-fund
  if %errorlevel% neq 0 (
    echo [ERROR] No se pudo instalar la libreria node-zklib. Verifique su conexion a Internet.
    pause
    exit /b 1
  )
)
echo [OK] Librerias listas.
echo.

echo ======================================================================
echo   INICIANDO CONECTOR BIOMETRICO EN TIEMPO REAL...
echo   (No cierre esta ventana mientras el reloj este en operacion)
echo ======================================================================
echo.

node biometric-agent.js

echo.
echo ======================================================================
echo   El conector se ha detenido.
echo   Revise los mensajes anteriores para ver la causa.
echo ======================================================================
echo.
pause
