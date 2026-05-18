/**
 * QZ Tray Print Utility
 * Imprime tickets directo a impresora térmica sin diálogo del navegador.
 * Requiere QZ Tray instalado y corriendo en la PC local.
 */

let qz;

async function getQZ() {
    if (!qz) {
        qz = await import('qz-tray');
    }
    return qz;
}

/**
 * Imprime contenido HTML/texto a una impresora específica vía QZ Tray.
 * @param {string} html - Contenido HTML a imprimir
 * @param {string} printerName - Nombre exacto de la impresora configurada en QZ Tray
 * @returns {object} { success: boolean, error?: string }
 */
export async function qzPrint(html, printerName) {
    try {
        const qzModule = await getQZ();

        // Conectar al servicio QZ Tray local
        if (!qzModule.websocket.isActive()) {
            await qzModule.websocket.connect();
        }

        // Buscar la impresora por nombre
        const printers = await qzModule.printers.find();
        const printer = printers.find(p =>
            p.name && p.name.toLowerCase().includes(printerName.toLowerCase())
        );

        if (!printer) {
            return { success: false, error: `Impresora "${printerName}" no encontrada en QZ Tray` };
        }

        // Configurar la impresión
        const config = qzModule.configs.create(printer.name, {
            size: { width: 80, height: 200 }, // 80mm ancho ticket térmico
            units: 'mm',
            orientation: 'portrait'
        });

        // Enviar HTML como datos de impresión
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

/**
 * Imprime usando QZ Tray si está disponible; si no, fallback a window.print()
 * @param {string} html - Contenido HTML
 * @param {string} printerName - Nombre de impresora configurada
 * @param {object} options - { fallbackFn } función a llamar si QZ falla
 */
export async function printTicket(html, printerName, { fallbackFn } = {}) {
    if (!printerName) {
        // Sin impresora configurada → fallback
        return fallbackFn ? fallbackFn() : null;
    }

    const result = await qzPrint(html, printerName);

    if (!result.success && fallbackFn) {
        console.warn('[QZPrint] Fallback a window.print():', result.error);
        return fallbackFn();
    }

    return result;
}
