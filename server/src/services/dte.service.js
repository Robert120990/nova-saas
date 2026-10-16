const jwt = require('jsonwebtoken');

/**
 * Servicio para conectar con la API interna de DTE (dte-api).
 */
class DteService {
    /**
     * Llama a la dte-api para emitir un documento oficial.
     * @param {Object} company Contexto de la empresa
     * @param {Object} payload Datos originales de la terminal
     * @returns {Object} Resultado de la emisión
     */
     async emitDTE(company, payload, ventaId = null, extraContext = {}) {
        if (!company.dte_active) {
            return { success: false, skip: true };
        }

        const DTE_API_URL = process.env.DTE_API_URL || 'http://localhost:5000/api';
        const DTE_JWT_SECRET = process.env.DTE_JWT_SECRET || process.env.JWT_SECRET;

        try {
            // 1. Generar Token para la API interna
            const token = jwt.sign({
                id: payload.header.user_id || 0,
                username: 'system_pos',
                company_id: company.id,
                branch_id: payload.header.branch_id || null
            }, DTE_JWT_SECRET, { expiresIn: '1m' });

            // 2. Mapear datos al formato esperado por dte-api
            // dte-api espera: { tipoDte, receptor, items, pagos, totalLetras, taxes }
            let receptor;
            if (payload.receptor) {
                receptor = payload.receptor;
            } else if (payload.header.provider_id) {
                receptor = await this._getProviderReceptorData(payload.header.provider_id, payload.header.provider_nombre || payload.header.cliente_nombre);
            } else {
                receptor = await this._getReceptorData(payload.header.customer_id, payload.header.cliente_nombre || null, payload.header.customer_branch_id || null);
            }

            // Guardia: cliente seleccionado debe tener dirección completa (Hacienda rechaza 096)
            if (payload.header.customer_id && payload.header.dte_type !== '11' && payload.header.dte_type !== '14') {
                const totalSale = parseFloat(payload.header.total_pagar || payload.header.total || 0);
                const isFacturaMinor = payload.header.dte_type === '01' && totalSale < 200;

                if (!isFacturaMinor) {
                    const addressError = await this.validateCustomerAddress(
                        payload.header.customer_id,
                        payload.header.customer_branch_id || null
                    );
                    if (addressError) {
                        return { success: false, error: addressError };
                    }
                }
            }

            // Calcular impuestos de cabecera si vienen por separado (Combustibles)
            const extraTaxes = [];
            if (payload.header.fovial > 0 || payload.header.total_fovial > 0) {
                extraTaxes.push({
                    codigo: 'D1',
                    descripcion: 'FEFE (FOVIAL)',
                    valor: parseFloat(payload.header.fovial || payload.header.total_fovial)
                });
            }
            if (payload.header.cotrans > 0 || payload.header.total_cotrans > 0) {
                extraTaxes.push({
                    codigo: 'C8',
                    descripcion: 'COTRANS',
                    valor: parseFloat(payload.header.cotrans || payload.header.total_cotrans)
                });
            }

            const dteBody = {
                venta_id: ventaId || payload.venta_id || payload.header?.sale_id || null,
                compra_id: extraContext.compra_id || payload.compra_id || payload.header?.compra_id || null,
                gasto_id: extraContext.gasto_id || payload.gasto_id || payload.header?.gasto_id || null,
                tipoDte: payload.header.dte_type,
                receptor: receptor,
                emisor_adicional: payload.emisor_adicional || null,
                identificacionExtra: payload.identificacionExtra || undefined,
                condicionOperacion: payload.header.condicion_operacion || 1, // 1: Contado, 2: Crédito
                dias_credito: payload.dias_credito != null ? parseInt(payload.dias_credito) || 15
                            : (payload.header.dias_credito != null ? parseInt(payload.header.dias_credito) || 15 : 15),
                retencion: parseFloat(payload.header.total_retencion ?? payload.header.iva_retenido ?? payload.header.retencion ?? 0),
                percepcion: parseFloat(payload.header.total_percepcion ?? payload.header.iva_percibido ?? 0),
                total_compra: payload.total_compra ?? payload.header?.total_compra ?? payload.header?.monto_total ?? payload.header?.total ?? 0,
                retencion_renta: payload.retencion_renta ?? payload.header?.retencion_renta ?? payload.header?.retencion ?? 0,
                subtotal: payload.subtotal ?? payload.header?.subtotal ?? payload.header?.monto_sujeto ?? 0,
                total_pagar: payload.total_pagar ?? payload.header?.total_pagar ?? payload.header?.monto_total ?? 0,
                descuento_general: parseFloat(payload.header.descuento_general ?? payload.header.total_descuento ?? payload.descuento_general ?? 0),
                descuGravada: payload.header.descuGravada !== undefined ? parseFloat(payload.header.descuGravada) : undefined,
                porcentajeDescuento: (payload.header.porcentajeDescuento !== undefined && payload.header.porcentajeDescuento !== null)
                    ? parseFloat(payload.header.porcentajeDescuento)
                    : ((payload.header.porcentaje_descuento !== undefined && payload.header.porcentaje_descuento !== null)
                        ? parseFloat(payload.header.porcentaje_descuento)
                        : ((payload.porcentaje_descuento !== undefined && payload.porcentaje_descuento !== null)
                            ? parseFloat(payload.porcentaje_descuento)
                            : undefined)),
                items: payload.header.dte_type === '07' 
                    ? (payload.linkedDocuments || []).map(doc => ({
                        tipoDte: doc.doc_type || '03',
                        tipoGeneracion: doc.generation_type || 1,
                        numDocumento: doc.doc_number || '',
                        fechaEmision: doc.emission_date || '',
                        montoSujetoGrav: doc.montoSujeto || doc.monto_sujeto || 0,
                        ivaRetenido: doc.ivaRetenido || doc.iva_retenido || 0,
                        descripcion: doc.descripcion || `RETENCION AL DOCUMENTO ${doc.doc_number || ''}`
                    }))
                    : (payload.header.dte_type === '14'
                        ? (payload.items || []).map((item, idx) => ({
                            numItem: idx + 1,
                            tipo_item: parseInt(item.tipo_item || (item.tipoItem === 'servicio' || item.tipo_item === 2 ? 2 : 1), 10) || 1,
                            descripcion: item.descripcion || item.description || item.nombre || 'Compra / Servicio',
                            cantidad: parseFloat(item.cantidad || item.quantity || 1),
                            precio_unitario: parseFloat(item.precio_unitario || item.precio || item.unit_price || item.total || 0),
                            descuento: parseFloat(item.descuento || item.monto_descuento || 0),
                            compra: parseFloat(item.compra || item.total || (parseFloat(item.cantidad || 1) * parseFloat(item.precio_unitario || item.precio || item.unit_price || item.total || 0))),
                            unidad_medida: item.unidad_medida || item.uniMedida || 59,
                            codigo: item.codigo || null
                        }))
                        : (payload.items || []).map(item => {
                            const fallbackRef = (payload.header?.dte_type === '05' && payload.linkedDocuments && payload.linkedDocuments.length === 1)
                                ? payload.linkedDocuments[0].doc_number
                                : null;
                            const isItemExento = Boolean(
                                item.exento ||
                                item.tipoItem === 2 ||
                                item.tipo_item === 2 ||
                                payload.customer?.exento_iva === 1 ||
                                payload.customer?.exento_iva === true ||
                                payload.customer?.condicion_fiscal === 'exento IVA'
                            );
                            const cleanTributos = (item.tributos && Array.isArray(item.tributos))
                                ? item.tributos.filter(t => (typeof t === 'object' ? t.codigo : String(t)) !== '20')
                                : [];
                            return {
                                descripcion: item.descripcion || item.nombre,
                                codigo: item.codigo,
                                cantidad: item.cantidad,
                                precioUnitario: item.precio_unitario || item.precio,
                                montoDescu: item.monto_descuento || item.descuento || 0,
                                referencedDoc: (payload.header?.dte_type === '05' && fallbackRef)
                                    ? (item.referencedDoc || fallbackRef)
                                    : (item.referencedDoc || null),
                                noGravado: parseFloat(item.noGravado || item.no_gravado || 0) || 0,
                                exento: isItemExento,
                                tributos: payload.header.dte_type === '11' ? []
                                    : (isItemExento
                                        ? cleanTributos
                                        : (item.tributos && Array.isArray(item.tributos) && item.tributos.length > 0 ? item.tributos : ["20"])),
                                tipoItem: payload.header.dte_type === '11' ? 1 : (isItemExento ? 2 : 1) // 1: Gravado, 2: Exento
                            };
                        })),
                totalNoGravado: parseFloat(payload.header?.totalNoGravado || payload.header?.total_no_gravado || payload.header?.tip_amount || payload.header?.propina || payload.totalNoGravado || payload.propina || 0) || 0,
                pagos: payload.payments || [],
                totalLetras: payload.header.total_letras || '',
                taxes: [...(payload.header.taxes || []), ...extraTaxes],
                // Datos adicionales para Multi-DTE
                exportacion: payload.header.dte_type === '11' ? {
                    tipoItemExpor: payload.header.export_item_type || 1,
                    recintoFiscal: payload.header.fiscal_enclosure || '00',
                    tipoRegimen: (payload.header.export_regime && String(payload.header.export_regime).toUpperCase().startsWith('EX')) ? 'EX-1' : (payload.header.export_regime || 'EX-1'),
                    regimen: (payload.header.export_customs_regime || (payload.header.export_regime && !String(payload.header.export_regime).toUpperCase().startsWith('EX') ? payload.header.export_regime : null)),
                    codPaisDestino: payload.header.dest_country_code,
                    incoterms: payload.header.incoterms || '01',
                    descIncoterms: payload.header.desc_incoterms || 'EXW- En fabrica',
                    flete: payload.header.flete || 0,
                    seguro: payload.header.seguro || 0,
                    observaciones: payload.header.observaciones || 'Exportación'
                } : null,
                transporte: payload.header.dte_type === '04' ? {
                    bienTitulo: payload.header.remission_type || '02',
                    nombreChofer: payload.header.transporter_name,
                    numPlaca: payload.header.vehicle_plate
                } : null,
                documentoRelacionado: (payload.linkedDocuments || []).map(doc => {
                    const rawDocNum = String(doc.doc_number || doc.numeroDocumento || '').trim().toUpperCase();
                    const isUUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(rawDocNum);
                    return {
                        tipoDocumento: doc.doc_type || doc.tipoDocumento || '03',
                        tipoGeneracion: doc.generation_type || (isUUID ? 1 : 2),
                        numeroDocumento: rawDocNum,
                        fechaEmision: doc.emission_date || doc.fechaEmision
                    };
                })
            };

            console.log(`[DteService] Llamando a dte-api para emisión...`);

            const response = await fetch(`${DTE_API_URL}/dte/emit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(dteBody)
            });

            const result = await response.json();

            if (result.success) {
                return {
                    success: true,
                    contingency: Boolean(result.contingency),
                    data: {
                        codigo_generacion: result.codigoGeneracion,
                        numero_control: result.numeroControl,
                        sello_recepcion: result.data?.selloRecibido || null,
                        fh_procesamiento: result.data?.fhProcesamiento || null,
                        contingency: Boolean(result.contingency)
                    }
                };
            } else {
                // Si la dte-api devolvió 200 pero success: false, es un rechazo de Hacienda
                // El error puede venir en result.message o en result.data.descripcionMsg
                let errorMessage = result.message || 'Error desconocido en dte-api';
                if (result.data && result.data.descripcionMsg) {
                    errorMessage = result.data.descripcionMsg;
                }

                return {
                    success: false,
                    codigo_generacion: result.codigoGeneracion || null,
                    numero_control: result.numeroControl || null,
                    error: errorMessage,
                    details: result.details || null
                };
            }
        } catch (error) {
            console.error('[DteService] Error conectando con dte-api:', error.message);
            return {
                success: false,
                error: 'Error de conexión con servicio DTE'
            };
        }
    }

    async retransmitDTE(company, codigoGeneracion, newReceptor = null) {
        if (!company.dte_active) {
            return { success: false, skip: true };
        }

        const DTE_API_URL = process.env.DTE_API_URL || 'http://localhost:5000/api';
        const DTE_JWT_SECRET = process.env.DTE_JWT_SECRET || process.env.JWT_SECRET;

        try {
            const token = jwt.sign({
                id: 0,
                username: 'system_pos',
                company_id: company.company_id || company.id
            }, DTE_JWT_SECRET, { expiresIn: '1m' });

            const response = await fetch(`${DTE_API_URL}/retransmission/retransmit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    codigoGeneracion,
                    receptor: newReceptor
                })
            });

            const result = await response.json();

            if (result.success) {
                return {
                    success: true,
                    data: {
                        codigo_generacion: result.codigoGeneracion,
                        estado: result.estadoHacienda,
                        sello_recepcion: result.data?.selloRecibido || null,
                        fh_procesamiento: result.data?.fhProcesamiento || null
                    }
                };
            } else {
                return {
                    success: false,
                    error: result.data || result.message || 'Error en retransmisión DTE',
                    details: result.details || null
                };
            }
        } catch (error) {
            console.error('[DteService] Error en retransmisión:', error.message);
            return { success: false, error: 'Error de conexión con servicio DTE' };
        }
    }

    async invalidateDTE(saleOrCompany, payload) {
        if (!saleOrCompany.dte_active) {
            return { success: false, skip: true };
        }

        const DTE_API_URL = process.env.DTE_API_URL || 'http://localhost:5000/api';
        const DTE_JWT_SECRET = process.env.DTE_JWT_SECRET || process.env.JWT_SECRET;

        try {
            // 1. Generar Token para la API interna
            const token = jwt.sign({
                id: payload.user_id || 0,
                username: 'system_pos',
                company_id: saleOrCompany.company_id || saleOrCompany.id
            }, DTE_JWT_SECRET, { expiresIn: '1m' });

            // dte-api espera: { codigoGeneracion, motivo, descripcion, nombreResponsable, ... }
            console.log(`[DteService] Llamando a dte-api para invalidación...`);

            const response = await fetch(`${DTE_API_URL}/invalidation/invalidate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                return {
                    success: true,
                    data: result.data
                };
            } else {
                return {
                    success: false,
                    error: result.message || 'Error desconocido en dte-api durante invalidación'
                };
            }
        } catch (error) {
            console.error('[DteService] Error conectando con dte-api para invalidación:', error.message);
            return {
                success: false,
                error: 'Error de conexión con servicio DTE para invalidación'
            };
        }
    }

    async _getReceptorData(customerId, manualName = null, customerBranchId = null) {
        if (!customerId) return { 
            nombre: manualName || 'PUBLICO GENERAL', 
            nit: null, 
            tipoDocumento: '37' 
        };
        
        const pool = require('../config/db');
        const [rows] = await pool.query('SELECT * FROM customers WHERE id = ?', [customerId]);
        if (rows.length === 0) return { nombre: 'RECEPTOR NO ENCONTRADO' };
        
        const c = rows[0];

        let codActividad = c.codigo_actividad ? String(c.codigo_actividad).trim() : null;
        if (codActividad && codActividad.length === 4 && /^\d+$/.test(codActividad)) {
            codActividad = codActividad.padStart(5, '0');
        }

        // Resolver nombre oficial de actividad económica desde cat_019 cuando
        // el cliente no tiene actividad_nombre/giro (evita el fallback "Otros")
        let descActividad = c.actividad_nombre || c.giro || null;
        if (!descActividad && codActividad) {
            try {
                const [actRows] = await pool.query(
                    'SELECT description FROM cat_019_actividad_economica WHERE code = ?',
                    [codActividad]
                );
                if (actRows.length > 0) descActividad = actRows[0].description;
            } catch (e) {
                console.warn('[DteService] Error resolviendo actividad económica del receptor:', e.message);
            }
        }

        let direccion = null;
        const hasAddressData = c.departamento || c.municipio || c.distrito || c.direccion || customerBranchId;
        if (hasAddressData) {
            let departamento = String(c.departamento || '06').padStart(2, '0');
            let municipio = String(c.municipio || '23').padStart(2, '0');
            let distrito = String(c.distrito || '14').padStart(2, '0');
            let complemento = c.direccion || 'San Salvador';

            if (customerBranchId) {
                const [branches] = await pool.query('SELECT * FROM customer_branches WHERE id = ? AND customer_id = ?', [customerBranchId, customerId]);
                if (branches.length > 0) {
                    const b = branches[0];
                    departamento = (b.departamento && String(b.departamento).trim()) ? String(b.departamento).trim().padStart(2, '0') : departamento;
                    municipio = (b.municipio && String(b.municipio).trim()) ? String(b.municipio).trim().padStart(2, '0') : municipio;
                    distrito = (b.distrito && String(b.distrito).trim()) ? String(b.distrito).trim().padStart(2, '0') : distrito;
                    complemento = (b.direccion && String(b.direccion).trim()) || complemento;
                }
            }

            // Asegurar que la combinación de depto, municipio y distrito sea válida en CAT-008
            try {
                const [validDist] = await pool.query(
                    'SELECT code, dep_code, muni_code FROM cat_008_distrito WHERE dep_code = ? AND muni_code = ? AND code = ?',
                    [departamento, municipio, distrito]
                );
                if (validDist.length === 0) {
                    // Si el distrito no es válido para ese municipio, buscar por municipio o cabecera
                    const [muniDist] = await pool.query(
                        'SELECT code FROM cat_008_distrito WHERE dep_code = ? AND muni_code = ? ORDER BY code LIMIT 1',
                        [departamento, municipio]
                    );
                    if (muniDist.length > 0) {
                        distrito = muniDist[0].code;
                    } else if (departamento === '06') {
                        municipio = '23';
                        distrito = '14';
                    }
                }
            } catch (e) {
                console.warn('[DteService] Error verificando cat_008_distrito:', e.message);
            }

            direccion = {
                departamento,
                municipio,
                distrito,
                complemento
            };
        }

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        let safeCorreo = (c.correo && String(c.correo).trim()) || null;
        if (safeCorreo && !emailRegex.test(safeCorreo)) {
            safeCorreo = null;
        }

        return {
            nombre: c.nombre,
            nit: c.nit,
            nrc: c.nrc,
            tipoDocumento: c.tipo_documento || '36',
            numDocumento: c.numero_documento,
            correo: safeCorreo,
            telefono: c.telefono,
            codActividad: codActividad,
            descActividad: descActividad,
            tipo_persona: c.tipo_persona || 1,
            pais_code: c.pais_code || c.pais || null,
            pais_name: c.pais_name || null,
            direccion
        };
    }

    async _getProviderReceptorData(providerId, manualName = null) {
        if (!providerId) return { 
            nombre: manualName || 'SUJETO EXCLUIDO', 
            tipoDocumento: '13',
            numDocumento: '000000000'
        };
        
        const pool = require('../config/db');
        const [rows] = await pool.query('SELECT * FROM providers WHERE id = ?', [providerId]);
        if (rows.length === 0) return { nombre: manualName || 'SUJETO EXCLUIDO', tipoDocumento: '13', numDocumento: '000000000' };
        
        const p = rows[0];
        let docType = p.tipo_documento || (p.numero_documento ? '13' : (p.nit ? '36' : '13'));
        let docNum = p.numero_documento || p.nit || '000000000';
        
        let departamento = String(p.departamento || '06').padStart(2, '0');
        let municipio = String(p.municipio || '14').padStart(2, '0');
        let distrito = String(p.distrito || '01').padStart(2, '0');
        let complemento = p.direccion || 'San Salvador';
        
        return {
            nombre: p.nombre,
            tipoDocumento: docType,
            numDocumento: docNum,
            codActividad: p.codigo_actividad || null,
            descActividad: p.giro || null,
            direccion: {
                departamento,
                municipio,
                distrito,
                complemento
            },
            telefono: p.telefono || null,
            correo: p.correo || null
        };
    }

    /**
     * Valida que un cliente seleccionado tenga departamento, municipio y distrito
     * (requisito Hacienda para el receptor del DTE). Toma en cuenta la sucursal
     * del cliente como respaldo por campo.
     * @returns {Promise<null|string>} null si es válido, o un mensaje de error
     */
    async validateCustomerAddress(customerId, customerBranchId = null) {
        if (!customerId) return null;

        const pool = require('../config/db');
        const [rows] = await pool.query(
            'SELECT departamento, municipio, distrito FROM customers WHERE id = ?',
            [customerId]
        );
        if (rows.length === 0) return null;

        const c = rows[0];
        let b = {};
        if (customerBranchId) {
            const [branches] = await pool.query(
                'SELECT departamento, municipio, distrito FROM customer_branches WHERE id = ? AND customer_id = ?',
                [customerBranchId, customerId]
            );
            b = branches[0] || {};
        }

        const missing = [];
        if (!((b.departamento && String(b.departamento).trim()) || (c.departamento && String(c.departamento).trim()))) missing.push('Departamento');
        if (!((b.municipio && String(b.municipio).trim()) || (c.municipio && String(c.municipio).trim()))) missing.push('Municipio');
        if (!((b.distrito && String(b.distrito).trim()) || (c.distrito && String(c.distrito).trim()))) missing.push('Distrito');

        if (missing.length === 0) return null;
        return `El cliente seleccionado no tiene ${missing.join(', ')}. Complételos antes de facturar.`;
    }
}

module.exports = new DteService();
