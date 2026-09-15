/**
 * Extracts the total page count from a PDF Blob or URL without external dependencies.
 * Reads the binary ArrayBuffer and parses the PDF catalog objects.
 *
 * @param {string} url - Blob URL or accessible URL of the PDF
 * @returns {Promise<number>} - Total page count (defaults to 1 if unknown)
 */
export async function extractPdfPageCount(url) {
    if (!url) return 1;
    try {
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        // Convert bytes to string in chunks to avoid call stack limits
        let text = '';
        const chunkSize = 32768;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            text += String.fromCharCode.apply(null, chunk);
        }

        // Method 1: match /Type /Pages ... /Count N (PDFKit standard)
        const countMatches = [...text.matchAll(/\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/g)];
        if (countMatches.length > 0) {
            const counts = countMatches.map(m => parseInt(m[1], 10));
            const max = Math.max(...counts);
            if (max > 0) return max;
        }

        // Method 2: count individual /Type /Page objects (excluding /Pages)
        const pageMatches = [...text.matchAll(/\/Type\s*\/Page\b(?!\s*s)/g)];
        if (pageMatches.length > 0) {
            return pageMatches.length;
        }

        return 1;
    } catch (err) {
        console.warn('[extractPdfPageCount] No se pudo determinar el número de páginas del PDF:', err);
        return 1;
    }
}
