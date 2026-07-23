$logFile = Join-Path (Split-Path $PSScriptRoot) 'server' 'logs' 'client.log'
$logDir = Split-Path $logFile -Parent
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

npm run dev *>&1 | ForEach-Object {
    $line = "$([DateTime]::Now.ToString('o')) [CLIENT] $_"
    $line | Out-File -FilePath $logFile -Append -Encoding utf8
    $_
}
