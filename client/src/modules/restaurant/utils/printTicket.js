/**
 * Restaurant Thermal Print Utility
 * Prints thermal pre-accounts, split tickets, and waiter shift summary vouchers via invisible iframe
 */

function executeIframePrint(bodyHtml, title = 'Impresión Térmica') {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8" />
            <title>${title}</title>
            <style>
                @page { margin: 0; size: auto; }
                body {
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 11px;
                    line-height: 1.25;
                    margin: 0;
                    padding: 8px;
                    color: #000;
                    background: #fff;
                    width: 58mm;
                }
                .ticket {
                    margin-bottom: 20px;
                    padding-bottom: 12px;
                    border-bottom: 1px dashed #444;
                }
                .ticket:last-child {
                    border-bottom: none;
                }
                .ticket-page-break {
                    page-break-after: always;
                }
                .center { text-align: center; }
                .right { text-align: right; }
                .bold { font-weight: bold; }
                .flex { display: flex; justify-content: space-between; align-items: flex-start; }
                .divider { border-top: 1px dashed #666; margin: 5px 0; }
                .text-sm { font-size: 11px; }
                .text-xs { font-size: 9px; }
                .text-muted { color: #555; }
                .total-row { font-size: 12px; margin-top: 2px; }
                .items-list { margin: 4px 0; }
                .item-row { margin-bottom: 2px; }
                .item-name { max-width: 70%; word-break: break-word; }
                .signature-box { margin-top: 22px; text-align: center; }
                .signature-line { border-top: 1px solid #000; width: 80%; margin: 0 auto 3px auto; }
            </style>
        </head>
        <body>
            ${bodyHtml}
        </body>
        </html>
    `);
    doc.close();

    setTimeout(() => {
        try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        } catch (e) {
            console.error('Print error:', e);
        } finally {
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 1500);
        }
    }, 250);
}

export function printThermalTickets(tickets = []) {
    if (!tickets || tickets.length === 0) return;

    const ticketsHtml = tickets.map((t, idx) => `
        <div class="ticket ${idx < tickets.length - 1 ? 'ticket-page-break' : ''}">
            <div class="center bold text-sm uppercase">${t.companyName || 'RESTAURANTE'}</div>
            <div class="center bold text-xs">*** PRE-CUENTA ***</div>
            <div class="center text-xs text-muted">NO VÁLIDO COMO FACTURA TRIBUTARIA</div>
            <div class="divider"></div>
            <div class="flex"><span>MESA:</span><strong>${t.tableName}</strong></div>
            <div class="flex"><span>COMANDA:</span><span>#${t.orderId}</span></div>
            <div class="flex"><span>DETALLE:</span><strong>${t.title}</strong></div>
            ${t.waiterName ? `<div class="flex"><span>MESERO:</span><span>${t.waiterName}</span></div>` : ''}
            <div class="flex text-xs text-muted"><span>${t.dateStr}</span><span>${t.timeStr}</span></div>
            <div class="divider"></div>

            ${Array.isArray(t.items) && t.items.length > 0 ? `
                <div class="items-list">
                    ${t.items.map(item => `
                        <div class="flex item-row">
                            <span class="item-name">${item.quantity}x ${item.product_name}</span>
                            <span class="bold">$${(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="divider"></div>
            ` : ''}

            <div class="flex"><span>SUBTOTAL:</span><span>$${Number(t.subtotal || 0).toFixed(2)}</span></div>
            ${Number(t.discountAmount || 0) > 0 ? `
                <div class="flex"><span>DESCUENTO:</span><span>-$${Number(t.discountAmount).toFixed(2)}</span></div>
                <div class="flex"><span>SUBTOTAL NETO:</span><span>$${Number(t.netSubtotal !== undefined ? t.netSubtotal : (t.subtotal - t.discountAmount)).toFixed(2)}</span></div>
            ` : ''}
            <div class="flex"><span>PROPINA (${t.tipPercentage || 10}%):</span><span>$${Number(t.tipAmount || 0).toFixed(2)}</span></div>
            <div class="flex bold total-row"><span>TOTAL SUGERIDO:</span><span>$${Number(t.total || 0).toFixed(2)}</span></div>
            <div class="divider"></div>
            <div class="center text-xs text-muted">Propina voluntaria sugerida.<br/>¡Muchas gracias por su visita!</div>
        </div>
    `).join('');

    executeIframePrint(ticketsHtml, 'Pre-cuentas');
}

export function printShiftSummaryThermalTicket({ companyName, waiterName, dateStr, timeStr, metrics = {}, orders = [] }) {
    const grossSales = Number(metrics.gross_sales || ((metrics.net_sales || 0) + (metrics.total_discounts || 0))).toFixed(2);
    const totalDiscounts = Number(metrics.total_discounts || 0).toFixed(2);
    const netSales = Number(metrics.net_sales || 0).toFixed(2);
    const totalTips = Number(metrics.total_tips || 0).toFixed(2);
    const totalCollected = Number(metrics.total_collected || ((metrics.net_sales || 0) + (metrics.total_tips || 0))).toFixed(2);

    const ticketHtml = `
        <div class="ticket">
            <div class="center bold text-sm uppercase">${companyName || 'RESTAURANTE'}</div>
            <div class="center bold text-xs">*** CORTE DE TURNO Y ARQUEO ***</div>
            <div class="center text-xs text-muted">LIQUIDACIÓN DE VENTAS Y PROPINAS</div>
            <div class="divider"></div>
            <div class="flex"><span>MESERO:</span><strong>${waiterName || 'Staff'}</strong></div>
            <div class="flex"><span>FECHA:</span><span>${dateStr}</span></div>
            <div class="flex"><span>HORA IMPRESIÓN:</span><span>${timeStr}</span></div>
            <div class="divider"></div>

            <div class="bold text-xs" style="margin-bottom: 4px;">DETALLE DE COMANDAS (${orders.length}):</div>
            <div class="items-list">
                ${orders.map(o => `
                    <div class="flex item-row">
                        <span class="item-name">${o.table_number || o.customer_name || 'Llevar'} (#${o.id})</span>
                        <span class="bold">$${Number(o.total_with_tip || o.subtotal || 0).toFixed(2)}</span>
                    </div>
                    <div class="flex text-xs text-muted" style="margin-bottom: 4px;">
                        <span>Prop: $${Number(o.tip_amount || 0).toFixed(2)}</span>
                        ${Number(o.discount_amount || 0) > 0 ? `<span style="color:#b91c1c; font-weight:bold;">Cort: -$${Number(o.discount_amount).toFixed(2)}</span>` : ''}
                    </div>
                `).join('')}
            </div>
            <div class="divider"></div>

            <div class="flex"><span>COMANDAS PAGADAS:</span><span>${metrics.closed_orders || orders.length}</span></div>
            <div class="flex"><span>VENTAS BRUTAS:</span><span>$${grossSales}</span></div>
            ${Number(totalDiscounts) > 0 ? `
                <div class="flex"><span>CORTESÍAS / DESCUENTOS:</span><span>-$${totalDiscounts}</span></div>
            ` : ''}
            <div class="flex bold"><span>VENTAS NETAS:</span><span>$${netSales}</span></div>
            <div class="divider"></div>
            <div class="flex bold total-row" style="font-size: 13px;">
                <span>PROPINAS A LIQUIDAR:</span>
                <span>$${totalTips}</span>
            </div>
            <div class="flex bold" style="margin-top: 3px;">
                <span>TOTAL RECAUDADO:</span>
                <span>$${totalCollected}</span>
            </div>
            <div class="divider"></div>

            <div class="signature-box">
                <div class="signature-line"></div>
                <div class="bold text-xs">FIRMA DEL MESERO</div>
                <div class="text-xs text-muted">${waiterName || ''}</div>
            </div>

            <div class="signature-box" style="margin-top: 24px;">
                <div class="signature-line"></div>
                <div class="bold text-xs">FIRMA CAJERO / SUPERVISOR</div>
                <div class="text-xs text-muted">LIQUIDADO Y CONFORME</div>
            </div>

            <div class="divider" style="margin-top: 15px;"></div>
            <div class="center text-xs text-muted">*** FIN DE LIQUIDACIÓN ***</div>
        </div>
    `;

    executeIframePrint(ticketHtml, `Corte_${waiterName || 'Mesero'}_${dateStr}`);
}
