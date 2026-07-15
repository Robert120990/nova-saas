import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { buildCloseoutPrintHtml } from './closeoutPrint';

async function pdfFromHtml(html) {
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '794px';
    container.style.background = '#fff';
    document.body.appendChild(container);

    try {
        await new Promise(resolve => setTimeout(resolve, 500));

        const canvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            logging: false,
            width: 794,
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const contentWidth = pdfWidth - margin * 2;
        const contentHeight = pdfHeight - margin * 2;
        const fullHeight = (canvas.height / canvas.width) * contentWidth;
        let pos = 0;

        while (pos < fullHeight) {
            if (pos > 0) pdf.addPage();
            pdf.addImage(imgData, 'PNG', margin, margin - pos, contentWidth, fullHeight);
            pos += contentHeight;
        }

        return pdf.output('blob');
    } finally {
        document.body.removeChild(container);
    }
}

export async function downloadCloseoutPdf(data) {
    const html = buildCloseoutPrintHtml(data);
    const blob = await pdfFromHtml(html);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
}

export async function generateCloseoutPdfBlob(data) {
    const html = buildCloseoutPrintHtml(data);
    const blob = await pdfFromHtml(html);
    const url = URL.createObjectURL(blob);
    return url;
}
