/**
 * Retransmission Controller
 * Regenera el DTE desde los datos originales de la venta usando el mismo
 * generador que una venta nueva, y lo reenvía a Hacienda.
 */

const dteGenerator = require('../services/dteGenerator');
const signatureService = require('../services/signature/signatureService');
const transmissionService = require('../transmission/transmissionService');
const pool = require('../../config/db');
const { sanitizeText, cleanNumbers } = require('../utils/text');

/**
 * Reconstruye el payload que generateDTE() espera a partir de los datos
 * originales de la venta (sales_headers, sales_items, customers, etc.)
 */
async function buildPayloadFromSale(dteRecord, newReceptor, companyId) {
    const ventaId = dteRecord.venta_id;

    // 1. Obtener cabecera de venta
    const [headers] = await pool.query(
        'SELECT * FROM sales_headers WHERE id = ? AND company_id = ?',
        [ventaId, companyId]
    );
    if (headers.length === 0) throw new Error(`Venta ${ventaId} no encontrada`);
    const sale = headers[0];

    // 2. Obtener items
    const [items] = await pool.query(
        'SELECT * FROM sales_items WHERE sale_id = ? ORDER BY id',
        [ventaId]
    );

    // 3. Obtener pagos
    const [payments] = await pool.query(
        'SELECT * FROM sales_payments WHERE sale_id = ?',
        [ventaId]
    );

    // 4. Obtener cliente (si existe)
    let customer = null;
    if (sale.customer_id) {
        const [custRows] = await pool.query(
            'SELECT * FROM customers WHERE id = ? AND company_id = ?',
            [sale.customer_id, companyId]
        );
        if (custRows.length > 0) customer = custRows[0];
    }

    // 5. Obtener datos de sucursal para el emisor_adicional
    const [pos] = await pool.query(
        'SELECT codigo FROM points_of_sale WHERE id = ?',
        [sale.pos_id]
    );

    // 6. Obtener datos de la empresa (actividad económica)
    const [companies] = await pool.query(
        `SELECT c.*, cat.description as actividad_economica 
         FROM companies c
         LEFT JOIN cat_019_actividad_economica cat ON c.codigo_actividad = cat.code
         WHERE c.id = ?`,
        [companyId]
    );
    const company = companies[0];

    // 7. Construir receptor (con posibilidad de sobreescribir con newReceptor)
    const mergedRec = {
        nombre: customer?.nombre || newReceptor?.nombre || sale.cliente_nombre || 'Consumidor Final',
        nit: customer?.nit || newReceptor?.nit || null,
        nrc: customer?.nrc || newReceptor?.nrc || null,
        numDocumento: customer?.num_documento || newReceptor?.numDocumento || null,
        tipoDocumento: customer?.tipo_documento || newReceptor?.tipoDocumento || null,
        correo: customer?.correo || newReceptor?.correo || null,
        telefono: customer?.telefono || newReceptor?.telefono || null,
        nombreComercial: customer?.nombre_comercial || newReceptor?.nombreComercial || null,
        tipo_persona: parseInt(customer?.tipo_persona || newReceptor?.tipo_persona) || 1,
        pais_code: customer?.pais_code || newReceptor?.pais_code || null,
        pais_name: customer?.pais_name || newReceptor?.pais_name || null,
        codActividad: customer?.codigo_actividad || newReceptor?.codActividad || '10005',
        descActividad: customer?.actividad_economica || newReceptor?.descActividad || 'Otros',
        direccion: customer?.direccion ? {
            departamento: customer.departamento || '06',
            municipio: customer.municipio || '01',
            complemento: customer.direccion || 'Direccion de entrega'
        } : (newReceptor?.direccion || null)
    };

    // Si se proveyó newReceptor, sobreescribe todo lo que venga
    if (newReceptor) {
        Object.keys(newReceptor).forEach(k => {
            if (newReceptor[k] !== undefined && newReceptor[k] !== null) {
                mergedRec[k] = newReceptor[k];
            }
        });
    }

    // 8. Mapear items al formato que espera calculateItem()
    const mappedItems = items.map((item, idx) => {
        const isExento = item.venta_exenta > 0 && item.venta_gravada === 0;
        let tributos = [];
        try {
            const parsed = typeof item.tributos === 'string' ? JSON.parse(item.tributos) : item.tributos;
            if (Array.isArray(parsed)) tributos = parsed;
        } catch (e) { /* ignore */ }

        return {
            numItem: idx + 1,
            descripcion: item.descripcion || `Item ${idx + 1}`,
            codigo: item.codigo || null,
            cantidad: parseFloat(item.cantidad) || 0,
            precioUnitario: parseFloat(item.precio_unitario) || 0,
            montoDescu: parseFloat(item.monto_descuento) || 0,
            ventaGravada: parseFloat(item.venta_gravada) || 0,
            ventaExenta: parseFloat(item.venta_exenta) || 0,
            tributos: tributos,
            tipoItem: isExento ? 2 : 1, // 1: Gravado, 2: Exento
            exento: isExento
        };
    });

    // 9. Mapear pagos
    const mappedPayments = payments.map(p => ({
        codigo: p.metodo_pago || '01',
        monto: parseFloat(p.monto) || 0,
        referencia: p.referencia || null
    }));

    // 10. Construir payload completo para generateDTE
    return {
        venta_id: ventaId,
        tipoDte: dteRecord.tipo_dte,
        companyId: companyId,
        branchId: dteRecord.branch_id,
        userId: dteRecord.usuario_id || 0,
        items: mappedItems,
        receptor: mergedRec,
        pagos: mappedPayments,
        condicionOperacion: sale.condicion_operacion || 1,
        emisor_adicional: {
            descActividad: company?.actividad_economica || 'Actividad no definida',
            codPuntoVentaMH: pos.length > 0 ? pos[0].codigo : null
        },
        exportacion: dteRecord.tipo_dte === '11' ? {
            tipoItemExpor: sale.export_item_type || 3,
            recintoFiscal: sale.fiscal_enclosure || null,
            regimen: sale.export_regime || null,
            codPaisDestino: customer?.pais_code || sale.dest_country_code || '',
            incoterms: sale.incoterms || '01',
            descIncoterms: sale.desc_incoterms || 'EXW- En fabrica',
            flete: sale.flete || 0,
            seguro: sale.seguro || 0,
            observaciones: sale.observaciones || ''
        } : null
    };
}

async function retransmit(req, res) {
    try {
        const { codigoGeneracion, receptor: newReceptor } = req.body;

        // 1. Get existing DTE record
        const [rows] = await pool.query(
            'SELECT * FROM dtes WHERE codigo_generacion = ? AND company_id = ?',
            [codigoGeneracion, req.company_id]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'DTE no encontrado' });

        const dteRecord = rows[0];
        let dteJson;

        // 2. Regenerar DTE desde los datos originales de la venta si existe venta_id
        if (dteRecord.venta_id) {
            console.log(`[Retransmit] Regenerando DTE desde venta ${dteRecord.venta_id}...`);
            const payload = await buildPayloadFromSale(dteRecord, newReceptor, req.company_id);
            dteJson = await dteGenerator.generateDTE(payload);
            // Preservar datos de identificación originales (Hacienda espera los mismos)
            dteJson.identificacion.codigoGeneracion = dteRecord.codigo_generacion;
            dteJson.identificacion.numeroControl = dteRecord.numero_control;
            // Mantener fecEmi/horEmi originales si existen
            if (dteRecord.json_original) {
                const origJson = typeof dteRecord.json_original === 'string'
                    ? JSON.parse(dteRecord.json_original)
                    : dteRecord.json_original;
                if (origJson.identificacion) {
                    dteJson.identificacion.fecEmi = origJson.identificacion.fecEmi;
                    dteJson.identificacion.horEmi = origJson.identificacion.horEmi;
                }
            }
            console.log(`[Retransmit] DTE regenerado exitosamente: ${dteJson.identificacion.codigoGeneracion}`);
        } else {
            // Fallback: usar el json_original guardado (sin venta asociada)
            dteJson = typeof dteRecord.json_original === 'string'
                ? JSON.parse(dteRecord.json_original)
                : dteRecord.json_original;

            // Si hay nuevo receptor, actualizarlo manualmente
            if (newReceptor) {
                console.log(`[Retransmit] Actualizando receptor (sin venta_id) para DTE ${codigoGeneracion}`);
                dteJson.receptor = { ...dteJson.receptor, ...newReceptor };
            }
        }

        console.log('--- FINAL DTE JSON FOR TRANSMISSION GENERATED ---');

        // 3. Get Company credentials
        const [company] = await pool.query(
            'SELECT nit, api_user, api_password, certificate_path, certificate_password, ambiente FROM companies WHERE id = ?',
            [req.company_id]
        );
        const certPass = company[0].certificate_password;

        // 4. Sign Document
        const signResult = await signatureService.signDTE(dteJson, {
            certificatePath: company[0].certificate_path,
            certificatePassword: certPass,
            nit: company[0].nit
        });

        if (!signResult.success) {
            throw new Error(`Falla en firma de retransmisión: ${signResult.message}`);
        }

        // 5. Authenticate with Hacienda
        const auth = await transmissionService.authenticate(company[0].api_user, company[0].api_password);
        if (!auth.success) {
            throw new Error(`Error MH Auth: ${auth.message}`);
        }

        // 6. Transmit to Hacienda
        let jwsString = typeof signResult.jws === 'string' ? signResult.jws : signResult.jws?.body || JSON.stringify(signResult.jws);
        jwsString = jwsString.replace(/^"|"$/g, '').trim();

        const tipoDte = dteJson.identificacion?.tipoDte || dteRecord.tipo_dte;
        const version = (tipoDte === '01' || tipoDte === '11' || tipoDte === '07') ? 1 : 3;

        const txResult = await transmissionService.transmitDTE(auth.token, jwsString, {
            ambiente: company[0].ambiente === 'produccion' ? '01' : '00',
            tipoDte: tipoDte,
            codigoGeneracion: codigoGeneracion,
            version: version
        });

        // 7. Update Database
        const dbStatus = txResult.success && txResult.status === 'PROCESADO' ? 'ACCEPTED' : 'REJECTED';
        const haciendaError = txResult.error || txResult.data;

        let formattedDate = txResult.fhProcesamiento || null;
        if (formattedDate && formattedDate.includes('/')) {
            const [datePart, timePart] = formattedDate.split(' ');
            const [day, month, year] = datePart.split('/');
            formattedDate = `${year}-${month}-${day} ${timePart}`;
        }

        await pool.query(
            'UPDATE dtes SET status = ?, json_original = ?, json_firmado = ?, sello_recepcion = ?, fh_procesamiento = ?, respuesta_hacienda = ? WHERE id = ?',
            [
                dbStatus,
                JSON.stringify(dteJson),
                jwsString,
                txResult.selloRecepcion || null,
                formattedDate,
                haciendaError ? JSON.stringify(haciendaError) : null,
                dteRecord.id
            ]
        );

        res.json({
            success: dbStatus === 'ACCEPTED',
            codigoGeneracion,
            estadoHacienda: txResult.status || 'REJECTED',
            data: txResult.data || txResult.error
        });

    } catch (error) {
        console.error('Retransmit Error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
}

module.exports = { retransmit };
