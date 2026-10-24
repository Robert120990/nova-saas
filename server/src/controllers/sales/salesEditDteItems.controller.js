const { mailerService, pool } = require('./salesUtils');

/**
 * Permite editar, agregar o eliminar ítems descriptivos (sin código de producto)
 * en un DTE ya emitido y aceptado, actualizando tanto sales_items como json_original en dtes.
 */
const editDTEItems = async (req, res) => {
    const { id } = req.params;
    const { items } = req.body;

    if (!Array.isArray(items)) {
        return res.status(400).json({ message: 'items es requerido' });
    }

    try {
        const [sales] = await pool.query(
            `SELECT h.*, COALESCE(d_v.status, d_c.status) as dte_status, COALESCE(d_v.json_original, d_c.json_original) as json_original
             FROM sales_headers h
             LEFT JOIN dtes d_v ON d_v.venta_id = h.id AND d_v.company_id = h.company_id
             LEFT JOIN dtes d_c ON d_c.codigo_generacion = h.codigo_generacion AND d_c.company_id = h.company_id
             WHERE h.id = ? AND h.company_id = ? AND (d_v.id IS NOT NULL OR d_c.id IS NOT NULL)`,
            [id, req.company_id]
        );

        if (sales.length === 0) {
            return res.status(404).json({ message: 'Venta no encontrada' });
        }

        const sale = sales[0];

        if (sale.estado === 'anulado') {
            return res.status(400).json({ message: 'La venta está anulada' });
        }

        if (sale.dte_status !== 'ACCEPTED') {
            return res.status(400).json({ message: 'Solo se pueden editar DTE aceptados' });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const [existingItems] = await connection.query(
                'SELECT id, codigo FROM sales_items WHERE sale_id = ? ORDER BY id ASC',
                [id]
            );

            const existingWithoutCodigo = existingItems.filter((i) => !i.codigo);
            const existingIds = existingWithoutCodigo.map((i) => i.id);

            const incomingIds = items
                .filter((i) => i.sales_item_id)
                .map((i) => Number(i.sales_item_id));

            const toDelete = existingIds.filter((eid) => !incomingIds.includes(Number(eid)));

            if (toDelete.length > 0) {
                await connection.query(
                    `DELETE FROM sales_items WHERE id IN (${toDelete.map(() => '?').join(',')}) AND codigo IS NULL`,
                    toDelete
                );
            }

            for (const item of items) {
                if (item.sales_item_id) {
                    await connection.query(
                        'UPDATE sales_items SET descripcion = ?, cantidad = ? WHERE id = ? AND codigo IS NULL AND sale_id = ?',
                        [item.descripcion, Number(item.cantidad) || 1, item.sales_item_id, id]
                    );
                }
            }

            for (const item of items) {
                if (!item.sales_item_id) {
                    await connection.query('INSERT INTO sales_items SET ?', [{
                        sale_id: parseInt(id, 10),
                        product_id: null,
                        codigo: null,
                        descripcion: item.descripcion,
                        cantidad: Number(item.cantidad) || 1,
                        precio_unitario: 0,
                        monto_descuento: 0,
                        venta_gravada: 0,
                        venta_exenta: 0,
                        tributos: '[]'
                    }]);
                }
            }

            const [updatedItems] = await connection.query(
                'SELECT * FROM sales_items WHERE sale_id = ? ORDER BY id ASC',
                [id]
            );

            const json = typeof sale.json_original === 'string'
                ? JSON.parse(sale.json_original)
                : (sale.json_original || {});
            const originalCuerpo = json.cuerpoDocumento || [];

            const updWithCodigo = [];
            const updWithoutCodigo = [];
            updatedItems.forEach((item) => {
                if (item.codigo) {
                    updWithCodigo.push(item);
                } else {
                    updWithoutCodigo.push(item);
                }
            });

            const newCuerpo = [];
            let withIdx = 0;
            let withoutIdx = 0;

            for (const origEntry of originalCuerpo) {
                if (origEntry.codigo) {
                    const upd = updWithCodigo[withIdx];
                    if (upd) {
                        newCuerpo.push({ ...origEntry });
                    }
                    withIdx++;
                } else {
                    const upd = updWithoutCodigo[withoutIdx];
                    if (upd) {
                        newCuerpo.push({
                            ...origEntry,
                            descripcion: upd.descripcion,
                            cantidad: parseFloat(upd.cantidad)
                        });
                    }
                    withoutIdx++;
                }
            }

            while (withoutIdx < updWithoutCodigo.length) {
                const upd = updWithoutCodigo[withoutIdx];
                newCuerpo.push({
                    numItem: 0,
                    tipoItem: 1,
                    numeroDocumento: null,
                    codigo: null,
                    codTributo: null,
                    descripcion: upd.descripcion,
                    cantidad: parseFloat(upd.cantidad),
                    uniMedida: 59,
                    precioUni: 0,
                    montoDescu: 0,
                    ventaNoSuj: 0,
                    ventaExenta: 0,
                    ventaGravada: 0,
                    tributos: null,
                    psv: 0,
                    noGravado: 0
                });
                withoutIdx++;
            }

            newCuerpo.forEach((entry, idx) => { entry.numItem = idx + 1; });
            json.cuerpoDocumento = newCuerpo;

            await connection.query(
                `UPDATE dtes
                 SET json_original = ?
                 WHERE (venta_id = ? OR (codigo_generacion = ? AND codigo_generacion IS NOT NULL AND codigo_generacion != ''))
                   AND company_id = ?`,
                [JSON.stringify(json), id, sale.codigo_generacion || '', req.company_id]
            );

            await connection.commit();
            connection.release();

            mailerService.queueDTEEmail(id, req.company_id).catch((err) => {
                console.error('[editDTEItems] Error enqueuing email:', err.message);
            });

            res.json({ success: true, message: 'Items actualizados correctamente' });
        } catch (err) {
            await connection.rollback();
            connection.release();
            throw err;
        }
    } catch (error) {
        console.error('[editDTEItems] Error:', error);
        res.status(500).json({ message: 'Error al editar items del DTE', error: error.message });
    }
};

module.exports = { editDTEItems };
