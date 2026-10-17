/**
 * Certificate Synchronization Utility
 * Automatically synchronizes uploaded .CRT certificates to:
 * 1. Docker firmador containers (/uploads/<cleanNit>.crt)
 * 2. Local fallback directories for native signing
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

/**
 * Copies a CRT file to all running MH firmador Docker containers
 * @param {string} crtFilePath Absolute path to the .crt file
 * @param {string} nit Taxpayer NIT
 */
function syncCertToFirmador(crtFilePath, nit) {
    if (!crtFilePath || !fs.existsSync(crtFilePath)) return;

    const cleanNit = (nit || '').replace(/\D/g, '');
    if (!cleanNit) return;

    const targetFilename = `${cleanNit}.crt`;

    // 1. Sincronizar hacia carpeta de dte-api si existe
    try {
        const dteApiCrtDir = path.resolve(__dirname, '../../../dte-api/certificados-crt');
        if (fs.existsSync(path.dirname(dteApiCrtDir))) {
            if (!fs.existsSync(dteApiCrtDir)) fs.mkdirSync(dteApiCrtDir, { recursive: true });
            const dteDest = path.join(dteApiCrtDir, targetFilename);
            fs.copyFileSync(crtFilePath, dteDest);
        }
    } catch {
        // Fallback silencioso
    }

    // 2. Sincronizar automáticamente hacia los contenedores Docker del firmador (puertos 8113 y 8114)
    exec('docker ps --format "{{.Names}}"', (err, stdout) => {
        if (err || !stdout) return;

        const containers = stdout.split(/\r?\n/).map(c => c.trim()).filter(Boolean);
        const firmadorContainers = containers.filter(c => 
            c.toLowerCase().includes('firmador') || 
            c.toLowerCase().includes('svfe') || 
            c.toLowerCase().includes('signer')
        );

        firmadorContainers.forEach(containerName => {
            const dockerCpCmd = `docker cp "${crtFilePath}" "${containerName}:/uploads/${targetFilename}"`;
            exec(dockerCpCmd, (cpErr) => {
                if (cpErr) {
                    console.warn(`[CertSync] No se pudo copiar ${targetFilename} a ${containerName}: ${cpErr.message}`);
                } else {
                    console.log(`[CertSync] Sincronizado automáticamente: ${targetFilename} -> ${containerName}:/uploads/`);
                }
            });
        });
    });
}

/**
 * Scans server/certificados-crt and syncs all existing CRT certificates into running Docker containers
 */
function syncAllCrtCertificates() {
    const certsDir = path.join(__dirname, '..', '..', 'certificados-crt');
    if (!fs.existsSync(certsDir)) return;

    fs.readdir(certsDir, (err, files) => {
        if (err || !files) return;

        const crtFiles = files.filter(f => f.toLowerCase().endsWith('.crt'));
        if (crtFiles.length === 0) return;

        console.log(`[CertSync] Sincronizando ${crtFiles.length} certificado(s) CRT existentes con Docker...`);
        crtFiles.forEach(file => {
            const cleanNit = path.basename(file, path.extname(file)).replace(/\D/g, '');
            const fullPath = path.join(certsDir, file);
            syncCertToFirmador(fullPath, cleanNit);
        });
    });
}

module.exports = {
    syncCertToFirmador,
    syncAllCrtCertificates
};
