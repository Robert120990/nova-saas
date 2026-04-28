/**
 * Retransmission Controller
 */

const signatureService = require('../services/signature/signatureService');
const transmissionService = require('../transmission/transmissionService');
const pool = require('../../config/db');
const { round, getAmountInWords } = require('../utils/calculations');
const { sanitizeText, cleanNumbers } = require('../utils/text');

async function retransmit(req, res) {
    try {
        const { codigoGeneracion, receptor: newReceptor } = req.body;
        
        // 1. Get existing DTE
        const [rows] = await pool.query('SELECT * FROM dtes WHERE codigo_generacion = ? AND company_id = ?', [codigoGeneracion, req.company_id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'DTE no encontrado' });

        const dteRecord = rows[0];
        let dteJson = dteRecord.json_original;
        
        // If it's a string, parse it
        if (typeof dteJson === 'string') {
            dteJson = JSON.parse(dteJson);
        }

        // 2. Update receptor if provided
        if (newReceptor) {
            console.log(`[Retransmit] Updating receptor for DTE ${codigoGeneracion}`);
            
            // SANITIZATION: Hacienda strictly forbids dashes in NIT, NRC and Phone numbers
            const sanitizedRec = { ...newReceptor };
            if (sanitizedRec.nit) sanitizedRec.nit = cleanNumbers(sanitizedRec.nit);
            if (sanitizedRec.nrc) sanitizedRec.nrc = cleanNumbers(sanitizedRec.nrc);
            if (sanitizedRec.telefono) sanitizedRec.telefono = cleanNumbers(sanitizedRec.telefono);

            dteJson.receptor = {
                ...dteJson.receptor,
                ...sanitizedRec
            };
        }

        // 3. RECOVER PERSISTED METADATA if venta_id exists
        if (dteRecord.venta_id) {
            console.log(`[Retransmit] Recovering persisted metadata for venta ${dteRecord.venta_id}`);
            
            // Get Terminal code
            const [sales] = await pool.query(`
                SELECT h.pos_id, p.codigo as terminal_codigo
                FROM sales_headers h
                LEFT JOIN points_of_sale p ON h.pos_id = p.id
                WHERE h.id = ?
            `, [dteRecord.venta_id]);
            
            if (sales.length > 0 && sales[0].terminal_codigo && dteRecord.tipo_dte !== '05') {
                dteJson.emisor.codPuntoVentaMH = sales[0].terminal_codigo;
            }

            // Get Item codes
            const [items] = await pool.query('SELECT descripcion, codigo FROM sales_items WHERE sale_id = ?', [dteRecord.venta_id]);
            const itemCodeMap = {};
            items.forEach(it => {
                if (it.codigo) itemCodeMap[it.descripcion] = it.codigo;
            });

            if (dteJson.cuerpoDocumento && Array.isArray(dteJson.cuerpoDocumento)) {
                dteJson.cuerpoDocumento.forEach(item => {
                    if (itemCodeMap[item.descripcion]) {
                        item.codigo = itemCodeMap[item.descripcion];
                    }
                });
            }
        }

        // 4. REPAIR ITEMS: Previous rejected documents might have invalid uniMedida or tributos
        if (dteJson.cuerpoDocumento && Array.isArray(dteJson.cuerpoDocumento)) {
            console.log(`[Retransmit] Repairing corpoItems codes for DTE ${codigoGeneracion}`);
            // Ensure receptor data is fully cleaned
            if (dteJson.receptor) {
                if (dteJson.receptor.nombre) {
                    dteJson.receptor.nombre = sanitizeText(dteJson.receptor.nombre);
                }
                if (dteJson.receptor.direccion && dteJson.receptor.direccion.complemento) {
                    dteJson.receptor.direccion.complemento = sanitizeText(dteJson.receptor.direccion.complemento);
                }
            }
            dteJson.cuerpoDocumento.forEach(item => {
                // Fix uniMedida for fuel if it was generic (59)
                const desc = (item.descripcion || '').toLowerCase();
                if (item.uniMedida === 59) {
                    if (desc.includes('gasolin') || desc.includes('diesel') || desc.includes('combust')) {
                        item.uniMedida = 55; // Galones
                    }
                }

                // Sanitize tributos: must be strings, no nulls
                if (item.tributos && Array.isArray(item.tributos)) {
                    item.tributos = item.tributos
                        .map(t => typeof t === 'object' ? t.codigo : String(t))
                        .filter(t => t && t !== 'null' && t !== 'undefined' && t.trim() !== '');
                    // ESPECIAL COMBUSTIBLES: Históricamente el POS incluye impuestos en el precio unitario base,
                    // por lo que reportaremos únicamente el IVA ("20") al Ministerio para cuadrar el monto pagado.
                    if (dteRecord.tipo_dte === '03' || dteRecord.tipo_dte === '05') {
                        item.tributos = item.tributos.filter(t => t !== 'D1' && t !== 'C8');
                        if (item.tributos.length === 0) {
                            item.tributos = ["20"];
                        }
                    }

                    item.tributos = [...new Set(item.tributos)];
                } else if (!item.tributos && dteRecord.tipo_dte === '03') {
                    item.tributos = ["20"]; // Default IVA if missing
                }
            });
        }

        // 3. Robustness: Ensure CCF/Factura has correct taxes and RECALCULATE totals
        if (dteJson.resumen) {
            const isCCF = dteRecord.tipo_dte === '03' || dteRecord.tipo_dte === '05';
            const isFactura = dteRecord.tipo_dte === '01';
            
            if (isCCF) {
                // Ensure IVA is present in summary taxes
                if (!dteJson.resumen.tributos) dteJson.resumen.tributos = [];
                const totalGravada = dteJson.resumen.totalGravada || 0;
                const calculatedIva = round(totalGravada * 0.13);

                dteJson.resumen.tributos = [{
                    codigo: '20',
                    descripcion: 'IVA 13%',
                    valor: calculatedIva
                }];
            } else {
                dteJson.resumen.tributos = []; // Factura doesn't use it
            }

            // RECALCULATE EVERYTHING to ensure perfect precision
            const resumen = dteJson.resumen;
            
            // Clean summary taxes to only include valid and non-zero taxes
            resumen.tributos = (resumen.tributos || []).filter(t => t && t.codigo && t.valor > 0);
            const totalTaxes = resumen.tributos.reduce((sum, t) => round(sum + (t.valor || 0)), 0);
            
            resumen.subTotalVentas = round(
                (resumen.totalNoSuj || 0) + 
                (resumen.totalExenta || 0) + 
                (resumen.totalGravada || 0)
            );

            resumen.totalDescu = round(resumen.totalDescu || 0);
            resumen.subTotal = round(resumen.subTotalVentas - resumen.totalDescu);
            
            resumen.montoTotalOperacion = round(
                resumen.subTotal + 
                totalTaxes + 
                (resumen.totalNoGravado || 0)
            );
            
            if (isFactura) {
                resumen.totalIva = round((resumen.totalGravada || 0) * 0.13);
            }

            resumen.totalPagar = round(
                resumen.montoTotalOperacion - 
                (resumen.ivaRete1 || 0) - 
                (resumen.reteRenta || 0)
            );
            
            resumen.totalLetras = getAmountInWords(resumen.totalPagar);

            // CORRECTION: Ensure payments sum matches totalPagar exactly
            if (resumen.pagos && resumen.pagos.length > 0) {
                if (resumen.pagos.length === 1) {
                    resumen.pagos[0].montoPago = resumen.totalPagar;
                } else {
                    // If multiple payments, adjust the last one to fix rounding differences
                    let currentSum = 0;
                    for (let i = 0; i < resumen.pagos.length - 1; i++) {
                        currentSum = round(currentSum + resumen.pagos[i].montoPago);
                    }
                    resumen.pagos[resumen.pagos.length - 1].montoPago = round(resumen.totalPagar - currentSum);
                }
            }
            
            console.log(`[Retransmit] Summary recalibrated: totalGravada=${resumen.totalGravada}, totalTaxes=${totalTaxes}, totalPagar=${resumen.totalPagar}`);
        }

        // 3. Get Company/Branch credentials
        const [company] = await pool.query('SELECT nit, api_user, api_password, certificate_path, certificate_password, ambiente FROM companies WHERE id = ?', [req.company_id]);
        const certPass = company[0].certificate_password;

        // 2.3 Ensure receptor data is fully cleaned (Accents and special chars cause 099 errors in MH)
        if (dteJson.receptor) {
            if (dteJson.receptor.nombre) {
                dteJson.receptor.nombre = sanitizeText(dteJson.receptor.nombre);
            }
            if (dteJson.receptor.direccion && dteJson.receptor.direccion.complemento) {
                dteJson.receptor.direccion.complemento = sanitizeText(dteJson.receptor.direccion.complemento);
            }
        }
        
        if (dteRecord.tipo_dte === '05') {
            console.log(`[Retransmit] Applying strict schema cleanup for NC (05)`);
            // Emisor cleanup
            delete dteJson.emisor.codEstableMH;
            delete dteJson.emisor.codEstable;
            delete dteJson.emisor.codPuntoVentaMH;
            delete dteJson.emisor.codPuntoVenta;

            // Resumen cleanup
            if (dteJson.resumen) {
                delete dteJson.resumen.porcentajeDescuento;
                delete dteJson.resumen.totalNoGravado;
                delete dteJson.resumen.totalPagar;
                delete dteJson.resumen.saldoFavor;
                delete dteJson.resumen.pagos;
                delete dteJson.resumen.numPagoElectronico;
            }

            // Items cleanup
            if (dteJson.cuerpoDocumento) {
                const relatedDocId = (dteJson.documentoRelacionado && dteJson.documentoRelacionado.length > 0)
                    ? dteJson.documentoRelacionado[0].numeroDocumento
                    : ".";

                dteJson.cuerpoDocumento.forEach(item => {
                    delete item.psv;
                    delete item.noGravado;
                    delete item.ivaItem;
                    item.numeroDocumento = relatedDocId;
                });
            }

            // Root cleanup
            delete dteJson.otrosDocumentos;
        }
        
        console.log('--- FINAL DTE JSON FOR TRANSMISSION GENERATED ---');

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

        const txResult = await transmissionService.transmitDTE(auth.token, jwsString, {
            ambiente: company[0].ambiente === 'produccion' ? '01' : '00',
            tipoDte: dteRecord.tipo_dte,
            codigoGeneracion: codigoGeneracion,
            version: dteRecord.tipo_dte === '01' ? 1 : 3
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
