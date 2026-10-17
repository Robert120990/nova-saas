/**
 * Transforma cualquier captura de pantalla (Canvas, File/Blob o DataURL PNG/JPG)
 * al formato más liviano posible (WebP comprimido con redimensionamiento inteligente,
 * con fallback automático a JPEG optimizado).
 */

export function getBase64SizeKb(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return 0;
    const base64Length = dataUrl.split(',')[1]?.length || 0;
    const bytes = (base64Length * 3) / 4;
    return Math.max(1, Math.round(bytes / 1024));
}

function canvasToLightestDataUrl(canvas, maxDimension = 1600, quality = 0.76) {
    try {
        let targetCanvas = canvas;
        const w = canvas.width || 1280;
        const h = canvas.height || 720;

        if (w > maxDimension || h > maxDimension) {
            const ratio = Math.min(maxDimension / w, maxDimension / h);
            const newW = Math.round(w * ratio);
            const newH = Math.round(h * ratio);
            const scaled = document.createElement('canvas');
            scaled.width = newW;
            scaled.height = newH;
            const ctx = scaled.getContext('2d');
            if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(canvas, 0, 0, newW, newH);
                targetCanvas = scaled;
            }
        }

        // Intentar primero WebP (formato más liviano posible, ~85% menos peso que PNG)
        let outUrl = targetCanvas.toDataURL('image/webp', quality);
        if (!outUrl || !outUrl.startsWith('data:image/webp')) {
            outUrl = targetCanvas.toDataURL('image/jpeg', quality);
        }

        // Si aún supera ~4.5 MB, recomprimir con menor calidad para garantizar < 6 MB en servidor
        if (getBase64SizeKb(outUrl) > 4500) {
            outUrl = targetCanvas.toDataURL('image/jpeg', 0.55);
        }

        return outUrl;
    } catch {
        return null;
    }
}

export function compressTicketCanvas(canvas, options = {}) {
    if (!canvas) return null;
    const { maxDimension = 1600, quality = 0.76 } = options;
    return canvasToLightestDataUrl(canvas, maxDimension, quality);
}

export function compressTicketImage(source, options = {}) {
    const { maxDimension = 1600, quality = 0.76 } = options;

    return new Promise((resolve) => {
        try {
            if (!source) return resolve(null);

            if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
                return resolve(canvasToLightestDataUrl(source, maxDimension, quality));
            }

            const processDataUrl = (rawUrl) => {
                if (typeof rawUrl !== 'string' || !rawUrl.startsWith('data:image/')) {
                    return resolve(null);
                }
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth || img.width || 1280;
                        canvas.height = img.naturalHeight || img.height || 720;
                        const ctx = canvas.getContext('2d');
                        if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        resolve(canvasToLightestDataUrl(canvas, maxDimension, quality) || rawUrl);
                    } catch {
                        resolve(rawUrl);
                    }
                };
                img.onerror = () => resolve(rawUrl);
                img.src = rawUrl;
            };

            if (typeof source === 'string') {
                return processDataUrl(source);
            }

            if (typeof Blob !== 'undefined' && source instanceof Blob) {
                const reader = new FileReader();
                reader.onload = (ev) => processDataUrl(ev.target?.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(source);
                return;
            }

            resolve(null);
        } catch {
            resolve(null);
        }
    });
}
