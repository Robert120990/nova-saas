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
     async emitDTE(company, payload, ventaId = null) {
        if (!company.dte_active) {
            return { success: false, skip: true };
        }

        const DTE_API_URL = process.env.DTE_API_URL || 'http://localhost:5000/api';
        const DTE_JWT_SECRET = process.env.DTE_JWT_SECRET || 'saas_dte_api_secret_2024';

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
            const receptor = await this._getReceptorData(payload.header.customer_id, payload.header.cliente_nombre || null);

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
                venta_id: ventaId,
                tipoDte: payload.header.dte_type,
                receptor: receptor,
                emisor_adicional: payload.emisor_adicional || null,
                condicionOperacion: payload.header.condicion_operacion || 1, // 1: Contado, 2: Crédito
                items: payload.items.map(item => ({
                    descripcion: item.descripcion || item.nombre,
                    codigo: item.codigo,
                    cantidad: item.cantidad,
                    precioUnitario: item.precio_unitario || item.precio,
                    montoDescu: item.monto_descuento || item.descuento || 0,
                    // Preservar tributos específicos o usar IVA por defecto
                    tributos: item.tributos && Array.isArray(item.tributos) && item.tributos.length > 0
                        ? item.tributos 
                        : (item.exento ? [] : ["20"]),
                    tipoItem: item.exento ? 2 : 1 // 1: Gravado, 2: Exento
                })),
                pagos: payload.payments || [],
                totalLetras: payload.header.total_letras || '',
                taxes: [...(payload.header.taxes || []), ...extraTaxes],
                // Datos adicionales para Multi-DTE
                exportacion: payload.header.dte_type === '11' ? {
                    tipoItemExpor: payload.header.export_item_type || 1,
                    recintoFiscal: payload.header.fiscal_enclosure,
                    regimen: payload.header.export_regime,
                    codPaisDestino: payload.header.dest_country_code
                } : null,
                transporte: payload.header.dte_type === '04' ? {
                    bienTitulo: payload.header.remission_type || '02',
                    nombreChofer: payload.header.transporter_name,
                    numPlaca: payload.header.vehicle_plate
                } : null,
                documentoRelacionado: (payload.linkedDocuments || []).map(doc => ({
                    tipoDocumento: doc.doc_type,
                    tipoGeneracion: doc.generation_type || 1,
                    numeroDocumento: doc.doc_number,
                    fechaEmision: doc.emission_date
                }))
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
                    data: {
                        codigo_generacion: result.codigoGeneracion,
                        numero_control: result.numeroControl,
                        sello_recepcion: result.data?.selloRecibido || null,
                        fh_procesamiento: result.data?.fhProcesamiento || null
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
        const DTE_JWT_SECRET = process.env.DTE_JWT_SECRET || 'saas_dte_api_secret_2024';

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
                    error: result.data || result.message || 'Error en retransmisión DTE'
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
        const DTE_JWT_SECRET = process.env.DTE_JWT_SECRET || 'saas_dte_api_secret_2024';

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

    async _getReceptorData(customerId, manualName = null) {
        if (!customerId) return { 
            nombre: manualName || 'PUBLICO GENERAL', 
            nit: null, 
            tipoDocumento: '37' 
        };
        
        const pool = require('../config/db');
        const [rows] = await pool.query('SELECT * FROM customers WHERE id = ?', [customerId]);
        if (rows.length === 0) return { nombre: 'RECEPTOR NO ENCONTRADO' };
        
        const c = rows[0];
        return {
            nombre: c.nombre,
            nit: c.nit,
            nrc: c.nrc,
            tipoDocumento: c.tipo_documento || '36',
            numDocumento: c.numero_documento,
            correo: c.correo,
            telefono: c.telefono,
            codActividad: c.codigo_actividad,
            descActividad: c.actividad_nombre || c.giro,
            direccion: {
                departamento: c.departamento || '06',
                municipio: c.municipio || '14',
                complemento: c.direccion || 'San Salvador'
            }
        };
    }
}

module.exports = new DteService();
