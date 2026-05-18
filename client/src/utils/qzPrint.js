/**
 * QZ Tray Print Utility
 * Requiere QZ Tray instalado + llaves de firma configuradas.
 *
 * PASOS PARA CONFIGURAR (una sola vez por PC):
 * 1. QZ Tray > clic derecho > Advanced > Site Manager
 * 2. Botón "+" > Create New > Yes a todo
 * 3. Carpeta "QZ Tray Demo Cert" aparece en el Escritorio
 * 4. Copiar los archivos a client/public/signing/
 *    - digital-certificate.txt
 *    - private-key.pem
 * 5. Reiniciar QZ Tray y el navegador
 */

let qz;
let qzReady = false;

async function getQZ() {
    if (!qz) {
        qz = await import('qz-tray');
    }
    return qz;
}

async function initQZ() {
    if (qzReady) return true;
    try {
        const qzModule = await getQZ();

        // Promesa del certificado (carga digital-certificate.txt)
        qzModule.security.setCertificatePromise((resolve) => {
            fetch('/signing/digital-certificate.txt', { cache: 'no-store' })
                .then(r => r.text())
                .then(resolve)
                .catch(() => resolve(null));
        });

        // Promesa de firma (usa private-key.pem via backend)
        qzModule.security.setSignatureAlgorithm('SHA512');
        qzModule.security.setSignaturePromise((toSign) => {
            return function (resolve) {
                fetch('/signing/private-key.pem', { cache: 'no-store' })
                    .then(r => r.text())
                    .then(async (pemKey) => {
                        // Firmar usando Web Crypto API (RSA-SHA512)
                        const pemData = pemKey
                            .replace('-----BEGIN PRIVATE KEY-----', '')
                            .replace('-----END PRIVATE KEY-----', '')
                            .replace(/\s/g, '');
                        const keyData = Uint8Array.from(atob(pemData), c => c.charCodeAt(0));
                        const key = await crypto.subtle.importKey(
                            'pkcs8', keyData,
                            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
                            false, ['sign']
                        );
                        const encoder = new TextEncoder();
                        const sig = await crypto.subtle.sign(
                            'RSASSA-PKCS1-v1_5', key,
                            encoder.encode(toSign)
                        );
                        resolve(btoa(String.fromCharCode(...new Uint8Array(sig))));
                    })
                    .catch(() => resolve(null));
            };
        });

        // Conectar (ws:// localhost)
        if (!qzModule.websocket.isActive()) {
            await qzModule.websocket.connect({
                host: 'localhost',
                port: 8182,
                usingSecure: false,
                retries: 2,
                delay: 1
            });
        }
        qzReady = true;
        return true;
    } catch (e) {
        console.warn('[QZ] Init failed:', e.message);
        return false;
    }
}

export async function qzPrint(html, printerName) {
    try {
        const ready = await initQZ();
        if (!ready) return { success: false, error: 'QZ Tray no disponible' };

        const qzModule = await getQZ();
        const printers = await qzModule.printers.find();
        const printer = printers.find(p =>
            p.name && p.name.toLowerCase().includes(printerName.toLowerCase())
        );

        if (!printer) {
            return { success: false, error: `Impresora "${printerName}" no encontrada` };
        }

        const config = qzModule.configs.create(printer.name, {
            size: { width: 80, height: 200 },
            units: 'mm',
            orientation: 'portrait'
        });

        const data = [{
            type: 'html',
            format: 'plain',
            data: `<html><body style="font-family:monospace;font-size:10px;margin:0;padding:5px;width:280px;">${html}</body></html>`
        }];

        await qzModule.print(config, data);
        return { success: true };
    } catch (error) {
        console.error('[QZPrint] Error:', error.message);
        return { success: false, error: error.message };
    }
}

export async function printTicket(html, printerName, { fallbackFn } = {}) {
    if (!printerName) {
        return fallbackFn ? fallbackFn() : null;
    }
    const result = await qzPrint(html, printerName);
    if (!result.success && fallbackFn) {
        console.warn('[QZPrint] Fallback a window.print():', result.error);
        return fallbackFn();
    }
    return result;
}
