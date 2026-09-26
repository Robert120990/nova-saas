@echo off
powershell -NoProfile -Command "$p = Get-Process redis-server -ErrorAction SilentlyContinue; if ($p) { Write-Host '>>> Redis esta ACTIVO (PID: ' $p.Id ')' -ForegroundColor Green; Get-NetTCPConnection -LocalPort 6379 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, State } else { Write-Host '>>> Redis NO esta en ejecucion.' -ForegroundColor Yellow }"
