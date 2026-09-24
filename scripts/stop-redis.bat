@echo off
powershell -NoProfile -Command "Stop-Process -Name redis-server -Force -ErrorAction SilentlyContinue"
echo Redis ha sido detenido correctamente.
