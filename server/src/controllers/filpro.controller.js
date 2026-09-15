const pool = require('../config/db');
const { encrypt, decrypt } = require('../utils/crypto');
const filproExtractor = require('../services/filproExtractor.service');
const filproIngestion = require('../services/filproIngestion.service');

/**
 * Run tasks concurrently with a maximum pool of parallel workers
 * @param {Array} items
 * @param {number} concurrency
 * @param {Function} workerFn async (item, index) => void
 */
async function runConcurrentPool(items, concurrency, workerFn) {
    let cursor = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length || 1) }, async () => {
        while (cursor < items.length) {
            const index = cursor++;
            const item = items[index];
            await workerFn(item, index);
        }
    });
    await Promise.all(workers);
}

/**
 * Controller for FilPro Integration & DTE Synchronization
 */
const filproController = {
    /**
     * Get connection configuration for the authenticated company
     */
    async getConnection(req, res) {
        try {
            const companyId = req.company_id;
            const [rows] = await pool.query(
                'SELECT id, company_id, branch_id, portal_url, filpro_email, filpro_password, filpro_company_id, filpro_establishment_code, auto_sync, last_sync_date, last_sync_at FROM filpro_connections WHERE company_id = ? LIMIT 1',
                [companyId]
            );

            if (rows.length === 0) {
                return res.json({
                    configured: false,
                    portal_url: 'https://api-filpro-service.apiconsumofel.com/api',
                    filpro_email: '',
                    filpro_password: '',
                    branch_id: null,
                    filpro_company_id: null,
                    filpro_establishment_code: ''
                });
            }

            const config = {
                ...rows[0],
                filpro_password: decrypt(rows[0].filpro_password)
            };
            return res.json({
                configured: true,
                ...config
            });
        } catch (error) {
            console.error('Error fetching FilPro connection:', error);
            return res.status(500).json({ message: error.message || 'Error al obtener configuración de FilPro' });
        }
    },

    /**
     * Save or update connection configuration for the company
     */
    async saveConnection(req, res) {
        try {
            const companyId = req.company_id;
            const {
                portal_url,
                filpro_email,
                filpro_password,
                branch_id,
                filpro_company_id,
                filpro_establishment_code,
                auto_sync
            } = req.body;

            if (!filpro_email) {
                return res.status(400).json({ message: 'El usuario/correo de FilPro es obligatorio.' });
            }

            const [existing] = await pool.query(
                'SELECT id, filpro_password FROM filpro_connections WHERE company_id = ? LIMIT 1',
                [companyId]
            );

            let encryptedPassword = '';
            if (filpro_password) {
                encryptedPassword = encrypt(filpro_password);
            } else if (existing.length > 0) {
                encryptedPassword = existing[0].filpro_password;
            } else {
                return res.status(400).json({ message: 'La contraseña de FilPro es requerida para la primera configuración.' });
            }

            const dataToSave = {
                company_id: companyId,
                branch_id: branch_id || null,
                portal_url: portal_url || 'https://api-filpro-service.apiconsumofel.com/api',
                filpro_email: filpro_email.trim(),
                filpro_password: encryptedPassword,
                filpro_company_id: filpro_company_id || null,
                filpro_establishment_code: (filpro_establishment_code || '').trim() || null,
                auto_sync: auto_sync ? 1 : 0
            };

            if (existing.length > 0) {
                await pool.query('UPDATE filpro_connections SET ? WHERE id = ?', [dataToSave, existing[0].id]);
            } else {
                await pool.query('INSERT INTO filpro_connections SET ?', [dataToSave]);
            }

            return res.json({ message: 'Configuración de FilPro guardada exitosamente.', success: true });
        } catch (error) {
            console.error('Error saving FilPro connection:', error);
            return res.status(500).json({ message: error.message || 'Error al guardar configuración de FilPro' });
        }
    },

    /**
     * Test connection to FilPro API using provided or saved credentials
     */
    async testConnection(req, res) {
        try {
            const companyId = req.company_id;
            let email = (req.body.filpro_email || '').trim();
            let password = req.body.filpro_password || '';
            let forcedCompanyId = req.body.filpro_company_id || null;

            if (!email || !password) {
                const [saved] = await pool.query(
                    'SELECT filpro_email, filpro_password, filpro_company_id FROM filpro_connections WHERE company_id = ? LIMIT 1',
                    [companyId]
                );
                if (saved.length > 0) {
                    if (!email) email = saved[0].filpro_email;
                    if (!password) password = saved[0].filpro_password;
                    if (!forcedCompanyId) forcedCompanyId = saved[0].filpro_company_id;
                }
            }

            if (!email || !password) {
                return res.status(400).json({ message: 'Credenciales incompletas para probar la conexión.' });
            }

            const session = await filproExtractor.getValidSession(companyId, email, password);
            const establishments = await filproExtractor.getEstablishments(companyId, email, password, forcedCompanyId);

            return res.json({
                success: true,
                message: 'Conexión exitosa con FilPro.',
                filproCompanyId: session.filproCompanyId,
                establishments
            });
        } catch (error) {
            console.error('FilPro connection test failed:', error);
            return res.status(400).json({
                success: false,
                message: error.message || 'Fallo al autenticar contra FilPro'
            });
        }
    },

    /**
     * Preview DTEs for a specific date (YYYY-MM-DD)
     */
    async previewDay(req, res) {
        try {
            const companyId = req.company_id;
            const dateStr = req.body.date || req.query.date;
            const establishmentCode = req.body.establishment_code || req.query.establishment_code || '';

            if (!dateStr) {
                return res.status(400).json({ message: 'La fecha a consultar es obligatoria (formato YYYY-MM-DD).' });
            }

            const [configRows] = await pool.query(
                'SELECT * FROM filpro_connections WHERE company_id = ? LIMIT 1',
                [companyId]
            );

            if (configRows.length === 0) {
                return res.status(400).json({
                    message: 'No hay credenciales de FilPro configuradas para esta empresa. Configure las credenciales primero.'
                });
            }

            const config = configRows[0];
            const estCode = establishmentCode || config.filpro_establishment_code || '';

            const documents = await filproExtractor.getDocumentsForDay(
                companyId,
                config.filpro_email,
                config.filpro_password,
                dateStr,
                estCode,
                config.filpro_company_id
            );

            // Cross-reference with existing DTEs in Nova SaaS to mark what's already imported
            const uuids = documents.map(d => d.uuid).filter(Boolean);
            const existingMap = new Map();

            if (uuids.length > 0) {
                const [existingInDb] = await pool.query(
                    'SELECT codigo_generacion, status, numero_control, venta_id FROM dtes WHERE company_id = ? AND codigo_generacion IN (?)',
                    [companyId, uuids]
                );

                for (const row of existingInDb) {
                    existingMap.set(row.codigo_generacion, row);
                }
            }

            let totalNew = 0;
            let totalAlreadyImported = 0;
            let totalAnulados = 0;
            let totalAmount = 0;

            const enrichedDocs = documents.map(doc => {
                const existing = existingMap.get(doc.uuid);
                const isImported = !!existing;
                const isAnulado = doc.status === 'ANULADO' || doc.status === 'INVALIDADO';

                if (isImported) {
                    totalAlreadyImported++;
                } else if (!isAnulado) {
                    totalNew++;
                }

                if (isAnulado) {
                    totalAnulados++;
                } else {
                    totalAmount += doc.monto_total || 0;
                }

                return {
                    ...doc,
                    is_already_imported: isImported,
                    local_sale_id: existing?.venta_id || null,
                    local_status: existing?.status || null
                };
            });

            return res.json({
                success: true,
                date: dateStr,
                summary: {
                    totalFound: documents.length,
                    totalNew,
                    totalAlreadyImported,
                    totalAnulados,
                    totalAmount: parseFloat(totalAmount.toFixed(2))
                },
                documents: enrichedDocs
            });

        } catch (error) {
            console.error('Error previewing FilPro day:', error);
            return res.status(500).json({ message: error.message || 'Error al consultar documentos en FilPro' });
        }
    },

    /**
     * Execute full sync/ingestion for a specific single day (YYYY-MM-DD)
     * Processes with 8 concurrent workers for 8x speedup
     */
    async syncDay(req, res) {
        try {
            const companyId = req.company_id;
            const userId = req.user?.id || 1;
            const dateStr = req.body.date;
            const branchId = req.body.branch_id || req.user?.branch_id;
            const establishmentCode = req.body.establishment_code || '';

            if (!dateStr) {
                return res.status(400).json({ message: 'La fecha es obligatoria (formato YYYY-MM-DD).' });
            }
            if (!branchId) {
                return res.status(400).json({ message: 'Debe especificar la sucursal de destino en Nova SaaS.' });
            }

            const [configRows] = await pool.query(
                'SELECT * FROM filpro_connections WHERE company_id = ? LIMIT 1',
                [companyId]
            );

            if (configRows.length === 0) {
                return res.status(400).json({ message: 'Configure las credenciales de FilPro antes de sincronizar.' });
            }

            const config = configRows[0];
            const estCode = establishmentCode || config.filpro_establishment_code || '';

            // 1. Fetch daily documents from FilPro
            const documents = await filproExtractor.getDocumentsForDay(
                companyId,
                config.filpro_email,
                config.filpro_password,
                dateStr,
                estCode,
                config.filpro_company_id
            );

            let totalImported = 0;
            let totalSkipped = 0;
            let totalErrors = 0;
            const results = [];

            // 2. Process documents concurrently with 8 parallel workers
            const CONCURRENCY = 8;
            await runConcurrentPool(documents, CONCURRENCY, async (doc) => {
                try {
                    // Check if already in DB
                    const [exists] = await pool.query(
                        'SELECT id, status FROM dtes WHERE codigo_generacion = ? AND company_id = ? LIMIT 1',
                        [doc.uuid, companyId]
                    );

                    const isAnulado = (doc.status === 'ANULADO' || doc.status === 'INVALIDADO');

                    // Per user rule: do not ingest anulado documents if not already in DB
                    if (exists.length === 0 && isAnulado) {
                        totalSkipped++;
                        results.push({
                            uuid: doc.uuid,
                            numero_control: doc.numero_control,
                            status: 'skipped',
                            message: 'Documento anulado en FilPro (omitido)'
                        });
                        return;
                    }

                    // If already imported and status has not changed, skip immediately without downloading JSON
                    if (exists.length > 0 && (!isAnulado || exists[0].status === 'INVALIDADO')) {
                        totalSkipped++;
                        results.push({
                            uuid: doc.uuid,
                            numero_control: doc.numero_control,
                            status: 'skipped',
                            message: 'Ya importado previamente'
                        });
                        return;
                    }

                    // Download official JSON from Infile certifier
                    const officialJson = await filproExtractor.downloadOfficialDteJson(doc.uuid);

                    // Ingest into Nova SaaS
                    const outcome = await filproIngestion.ingestDte({
                        companyId,
                        branchId,
                        userId,
                        dteSummary: doc,
                        officialJson
                    });

                    if (outcome.status === 'imported') {
                        totalImported++;
                    } else if (outcome.status === 'skipped') {
                        totalSkipped++;
                    } else if (outcome.status === 'updated_anulado') {
                        totalImported++;
                    }

                    results.push(outcome);

                } catch (docError) {
                    console.error(`Error importing DTE ${doc.uuid}:`, docError.message);
                    totalErrors++;
                    results.push({
                        uuid: doc.uuid,
                        numero_control: doc.numero_control,
                        status: 'error',
                        message: docError.message
                    });
                }
            });

            // 3. Record Audit Log
            await pool.query('INSERT INTO filpro_sync_logs SET ?', [{
                company_id: companyId,
                branch_id: branchId,
                sync_date: dateStr,
                total_found: documents.length,
                total_imported: totalImported,
                total_skipped: totalSkipped,
                total_errors: totalErrors,
                details: JSON.stringify({
                    summary: { totalImported, totalSkipped, totalErrors },
                    resultsCount: results.length
                }),
                created_at: new Date()
            }]);

            // 4. Update last sync date on connection
            await pool.query(
                'UPDATE filpro_connections SET last_sync_date = ?, last_sync_at = NOW() WHERE id = ?',
                [dateStr, config.id]
            );

            return res.json({
                success: true,
                syncDate: dateStr,
                totalFound: documents.length,
                totalImported,
                totalSkipped,
                totalErrors,
                results
            });

        } catch (error) {
            console.error('Error syncing FilPro day:', error);
            return res.status(500).json({ message: error.message || 'Error en la sincronización de DTEs' });
        }
    },

    /**
     * Execute full sync/ingestion with Server-Sent Events (SSE) streaming progress
     * Concurrency: 8 workers
     */
    async syncDayStream(req, res) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        });

        const sendEvent = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        try {
            const companyId = req.company_id;
            const userId = req.user?.id || 1;
            const dateStr = req.body.date;
            const branchId = req.body.branch_id || req.user?.branch_id;
            const establishmentCode = req.body.establishment_code || '';

            if (!dateStr) {
                sendEvent({ type: 'error', message: 'La fecha es obligatoria (formato YYYY-MM-DD).' });
                return res.end();
            }
            if (!branchId) {
                sendEvent({ type: 'error', message: 'Debe especificar la sucursal de destino en Nova SaaS.' });
                return res.end();
            }

            const [configRows] = await pool.query(
                'SELECT * FROM filpro_connections WHERE company_id = ? LIMIT 1',
                [companyId]
            );

            if (configRows.length === 0) {
                sendEvent({ type: 'error', message: 'Configure las credenciales de FilPro antes de sincronizar.' });
                return res.end();
            }

            const config = configRows[0];
            const estCode = establishmentCode || config.filpro_establishment_code || '';

            sendEvent({ type: 'status', message: `Consultando DTEs emitidos el ${dateStr} en FilPro...` });

            const documents = await filproExtractor.getDocumentsForDay(
                companyId,
                config.filpro_email,
                config.filpro_password,
                dateStr,
                estCode,
                config.filpro_company_id
            );

            const total = documents.length;
            sendEvent({
                type: 'start',
                total,
                message: `Se encontraron ${total} DTEs en FilPro. Iniciando procesamiento concurrente (8 hilos)...`
            });

            if (total === 0) {
                sendEvent({
                    type: 'complete',
                    totalFound: 0,
                    totalImported: 0,
                    totalSkipped: 0,
                    totalErrors: 0,
                    message: 'No se encontraron documentos emitidos en FilPro para esta fecha.'
                });
                return res.end();
            }

            let processedCount = 0;
            let totalImported = 0;
            let totalSkipped = 0;
            let totalErrors = 0;
            const results = [];

            const CONCURRENCY = 8;

            await runConcurrentPool(documents, CONCURRENCY, async (doc) => {
                let outcome = null;
                try {
                    const [exists] = await pool.query(
                        'SELECT id, status FROM dtes WHERE codigo_generacion = ? AND company_id = ? LIMIT 1',
                        [doc.uuid, companyId]
                    );

                    const isAnulado = (doc.status === 'ANULADO' || doc.status === 'INVALIDADO');

                    if (exists.length === 0 && isAnulado) {
                        totalSkipped++;
                        outcome = {
                            uuid: doc.uuid,
                            numero_control: doc.numero_control,
                            status: 'skipped',
                            tipoDte: doc.tipo_dte,
                            total: doc.monto_total || 0,
                            message: 'Documento anulado en FilPro (omitido)'
                        };
                    } else if (exists.length > 0 && (!isAnulado || exists[0].status === 'INVALIDADO')) {
                        totalSkipped++;
                        outcome = {
                            uuid: doc.uuid,
                            numero_control: doc.numero_control,
                            status: 'skipped',
                            tipoDte: doc.tipo_dte,
                            total: doc.monto_total || 0,
                            message: 'Ya importado previamente'
                        };
                    } else {
                        const officialJson = await filproExtractor.downloadOfficialDteJson(doc.uuid);
                        outcome = await filproIngestion.ingestDte({
                            companyId,
                            branchId,
                            userId,
                            dteSummary: doc,
                            officialJson
                        });

                        if (outcome.status === 'imported' || outcome.status === 'updated_anulado') {
                            totalImported++;
                        } else {
                            totalSkipped++;
                        }
                    }
                } catch (docError) {
                    console.error(`Error importing DTE ${doc.uuid}:`, docError.message);
                    totalErrors++;
                    outcome = {
                        uuid: doc.uuid,
                        numero_control: doc.numero_control,
                        status: 'error',
                        tipoDte: doc.tipo_dte,
                        total: doc.monto_total || 0,
                        message: docError.message
                    };
                }

                processedCount++;
                results.push(outcome);

                // Send real-time progress event
                sendEvent({
                    type: 'progress',
                    current: processedCount,
                    total,
                    imported: totalImported,
                    skipped: totalSkipped,
                    errors: totalErrors,
                    pct: Math.round((processedCount / total) * 100),
                    item: {
                        uuid: outcome.uuid,
                        numero_control: outcome.numero_control,
                        status: outcome.status,
                        saleId: outcome.saleId || null,
                        total: outcome.total || 0,
                        tipoDte: outcome.tipoDte || doc.tipo_dte,
                        message: outcome.message || ''
                    }
                });
            });

            // Record Audit Log
            await pool.query('INSERT INTO filpro_sync_logs SET ?', [{
                company_id: companyId,
                branch_id: branchId,
                sync_date: dateStr,
                total_found: total,
                total_imported: totalImported,
                total_skipped: totalSkipped,
                total_errors: totalErrors,
                details: JSON.stringify({
                    summary: { totalImported, totalSkipped, totalErrors },
                    resultsCount: results.length
                }),
                created_at: new Date()
            }]);

            // Update last sync date on connection
            await pool.query(
                'UPDATE filpro_connections SET last_sync_date = ?, last_sync_at = NOW() WHERE id = ?',
                [dateStr, config.id]
            );

            sendEvent({
                type: 'complete',
                totalFound: total,
                totalImported,
                totalSkipped,
                totalErrors,
                message: `Sincronización completada exitosamente: ${totalImported} importados, ${totalSkipped} omitidos, ${totalErrors} errores.`
            });

            res.end();

        } catch (fatalError) {
            console.error('Fatal error in syncDayStream:', fatalError);
            sendEvent({ type: 'error', message: fatalError.message || 'Error fatal durante la sincronización' });
            res.end();
        }
    },


    /**
     * Get recent sync audit logs for the company
     */
    async getLogs(req, res) {
        try {
            const companyId = req.company_id;
            const [logs] = await pool.query(`
                SELECT l.*, b.nombre as branch_name 
                FROM filpro_sync_logs l
                LEFT JOIN branches b ON l.branch_id = b.id
                WHERE l.company_id = ?
                ORDER BY l.id DESC 
                LIMIT 30
            `, [companyId]);

            return res.json(logs);
        } catch (error) {
            console.error('Error fetching FilPro logs:', error);
            return res.status(500).json({ message: error.message || 'Error al obtener registros de sincronización' });
        }
    },

    /**
     * Get official DTE details for modal preview
     */
    async getDteDetail(req, res) {
        try {
            const companyId = req.company_id;
            const { uuid } = req.params;
            if (!uuid) {
                return res.status(400).json({ message: 'UUID de DTE es obligatorio' });
            }

            let officialJson = null;
            let localDteInfo = null;

            // 1. Check if already stored locally in dtes
            const [localRows] = await pool.query(
                'SELECT id, status, venta_id, numero_control, tipo_dte, json_original, created_at FROM dtes WHERE codigo_generacion = ? AND company_id = ? LIMIT 1',
                [uuid, companyId]
            );

            if (localRows.length > 0) {
                localDteInfo = {
                    id: localRows[0].id,
                    status: localRows[0].status,
                    venta_id: localRows[0].venta_id,
                    numero_control: localRows[0].numero_control,
                    tipo_dte: localRows[0].tipo_dte
                };

                if (localRows[0].json_original) {
                    try {
                        officialJson = typeof localRows[0].json_original === 'string'
                            ? JSON.parse(localRows[0].json_original)
                            : localRows[0].json_original;
                    } catch (e) {
                        console.warn('Error parsing local json_original:', e);
                    }
                }
            }

            // 2. If not found locally or json_original was null, download from Infile certifier
            if (!officialJson) {
                officialJson = await filproExtractor.downloadOfficialDteJson(uuid);
            }

            const pdfUrl = `https://certificador.infile.com.sv/api/v1/reporte/reporte_documento?uuid=${encodeURIComponent(uuid)}&formato=pdf`;

            return res.json({
                success: true,
                uuid,
                localDte: localDteInfo,
                dte: officialJson,
                pdfUrl
            });
        } catch (error) {
            console.error('Error fetching DTE detail:', error);
            return res.status(500).json({ message: error.message || 'Error al obtener detalle del DTE' });
        }
    },

    /**
     * Get all product code mappings for the company
     */
    async getMappings(req, res) {
        try {
            const companyId = req.company_id;
            const [rows] = await pool.query(`
                SELECT m.id, m.company_id, m.filpro_code, m.filpro_description, m.product_id,
                       p.codigo as product_code, p.nombre as product_name, p.status as product_status,
                       m.created_at, m.updated_at
                FROM filpro_product_mappings m
                JOIN products p ON m.product_id = p.id
                WHERE m.company_id = ?
                ORDER BY m.id DESC
            `, [companyId]);

            return res.json(rows);
        } catch (error) {
            console.error('Error fetching FilPro mappings:', error);
            return res.status(500).json({ message: error.message || 'Error al obtener mapeos de códigos' });
        }
    },

    /**
     * Save or update a product code mapping
     */
    async saveMapping(req, res) {
        try {
            const companyId = req.company_id;
            const { id, filpro_code, filpro_description, product_id } = req.body;

            if (!filpro_code || !filpro_code.trim()) {
                return res.status(400).json({ message: 'El código de FilPro es obligatorio.' });
            }
            if (!product_id) {
                return res.status(400).json({ message: 'Debe seleccionar un producto del sistema.' });
            }

            const cleanCode = filpro_code.trim();
            const cleanDesc = (filpro_description || '').trim() || null;

            // Verify product belongs to company
            const [prod] = await pool.query(
                'SELECT id, codigo, nombre FROM products WHERE id = ? AND company_id = ? LIMIT 1',
                [product_id, companyId]
            );
            if (prod.length === 0) {
                return res.status(400).json({ message: 'El producto seleccionado no pertenece a su empresa.' });
            }

            if (id) {
                await pool.query(
                    'UPDATE filpro_product_mappings SET filpro_code = ?, filpro_description = ?, product_id = ? WHERE id = ? AND company_id = ?',
                    [cleanCode, cleanDesc, product_id, id, companyId]
                );
            } else {
                await pool.query(`
                    INSERT INTO filpro_product_mappings (company_id, filpro_code, filpro_description, product_id)
                    VALUES (?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE product_id = VALUES(product_id), filpro_description = VALUES(filpro_description)
                `, [companyId, cleanCode, cleanDesc, product_id]);
            }

            return res.json({ success: true, message: 'Mapeo guardado exitosamente.' });
        } catch (error) {
            console.error('Error saving FilPro mapping:', error);
            return res.status(500).json({ message: error.message || 'Error al guardar mapeo de producto' });
        }
    },

    /**
     * Delete a product code mapping
     */
    async deleteMapping(req, res) {
        try {
            const companyId = req.company_id;
            const { id } = req.params;

            await pool.query(
                'DELETE FROM filpro_product_mappings WHERE id = ? AND company_id = ?',
                [id, companyId]
            );

            return res.json({ success: true, message: 'Mapeo eliminado correctamente.' });
        } catch (error) {
            console.error('Error deleting FilPro mapping:', error);
            return res.status(500).json({ message: error.message || 'Error al eliminar mapeo de producto' });
        }
    },

    /**
     * Revert / Delete a single imported DTE and its corresponding sale
     */
    async revertDte(req, res) {
        try {
            const companyId = req.company_id;
            const userId = req.user?.id || null;
            const { uuid, sale_id } = req.body;

            if (!uuid && !sale_id) {
                return res.status(400).json({ message: 'El UUID del DTE o ID de la venta es requerido para revertir.' });
            }

            const outcome = await filproIngestion.revertDte({
                companyId,
                uuid,
                saleId: sale_id ? parseInt(sale_id, 10) : null,
                userId
            });

            return res.json(outcome);
        } catch (error) {
            console.error('Error reverting FilPro DTE:', error);
            return res.status(500).json({ message: error.message || 'Error al revertir venta importada' });
        }
    },

    /**
     * Revert / Delete all imported FilPro sales for a specific day
     */
    async revertDay(req, res) {
        try {
            const companyId = req.company_id;
            const userId = req.user?.id || null;
            const { date, branch_id } = req.body;

            if (!date) {
                return res.status(400).json({ message: 'La fecha es obligatoria (formato YYYY-MM-DD).' });
            }

            const outcome = await filproIngestion.revertDay({
                companyId,
                dateStr: date,
                branchId: branch_id ? parseInt(branch_id, 10) : null,
                userId
            });

            return res.json(outcome);
        } catch (error) {
            console.error('Error reverting FilPro day:', error);
            return res.status(500).json({ message: error.message || 'Error al revertir sincronización del día' });
        }
    }
};

module.exports = filproController;
