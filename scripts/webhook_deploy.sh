#!/usr/bin/env bash
# ==============================================================================
# SIPEWEBgas Automatic Deployment Script (triggered via GitHub Webhook)
# ==============================================================================

set -e

APP_DIR="/home/rsboosted/SIPEWEBgas"
LOG_FILE="$APP_DIR/deploy.log"
LOCK_FILE="/tmp/sipewebgas_deploy.lock"

# Asegurar entorno y PATH
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/rsboosted/.local/bin"
export HOME="/home/rsboosted"

exec 200>"$LOCK_FILE"
if ! flock -n 200; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ALERTA] Despliegue en curso. Solicitud omitida para evitar colisiones." >> "$LOG_FILE"
    exit 0
fi

echo "==========================================================" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INICIO] Recibido webhook de GitHub. Iniciando despliegue de SIPEWEBgas..." >> "$LOG_FILE"
echo "==========================================================" >> "$LOG_FILE"

cd "$APP_DIR"

# 1. Pull de Git descartando cambios temporales locales
echo "[$(date '+%Y-%m-%d %H:%M:%S')] [PULL] Actualizando repositorio git desde origin main..." >> "$LOG_FILE"
git checkout -- . >> "$LOG_FILE" 2>&1 || true
git fetch origin main >> "$LOG_FILE" 2>&1
git reset --hard origin/main >> "$LOG_FILE" 2>&1

# 2. Actualizar dependencias backend si fuera necesario
echo "[$(date '+%Y-%m-%d %H:%M:%S')] [NPM] Actualizando dependencias backend..." >> "$LOG_FILE"
cd "$APP_DIR/server" && npm install --omit=dev --prefer-offline >> "$LOG_FILE" 2>&1 || true
cd "$APP_DIR/dte-api" && npm install --omit=dev --prefer-offline >> "$LOG_FILE" 2>&1 || true

# 3. Ejecutar migraciones de base de datos
echo "[$(date '+%Y-%m-%d %H:%M:%S')] [DB] Ejecutando migraciones de base de datos..." >> "$LOG_FILE"
cd "$APP_DIR/database"
node run_migration_v167.js >> "$LOG_FILE" 2>&1 || true
node run_migration_v168.js >> "$LOG_FILE" 2>&1 || true
node run_migration_v170.js >> "$LOG_FILE" 2>&1 || true

# 4. Compilar frontend de producción
echo "[$(date '+%Y-%m-%d %H:%M:%S')] [BUILD] Compilando frontend cliente Vite..." >> "$LOG_FILE"
cd "$APP_DIR/client"
npm install --prefer-offline >> "$LOG_FILE" 2>&1 || true
npm run build >> "$LOG_FILE" 2>&1

# 5. Reiniciar servicios en PM2
echo "[$(date '+%Y-%m-%d %H:%M:%S')] [PM2] Reiniciando servicios..." >> "$LOG_FILE"
cd "$APP_DIR"
pm2 restart sipewebgas-server || pm2 restart server || true
pm2 restart sipewebgas-dte || pm2 restart dte-api || true

CURRENT_COMMIT=$(git rev-parse --short HEAD)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] [EXITO] Despliegue completado! Version activa: $CURRENT_COMMIT" >> "$LOG_FILE"
echo "==========================================================" >> "$LOG_FILE"
