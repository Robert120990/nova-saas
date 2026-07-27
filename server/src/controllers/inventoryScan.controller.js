const pool = require('../config/db');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { broadcastToCompany } = require('../services/websocket.service');
const notificationService = require('../services/notification.service');

const createScanSession = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { nombre_sesion } = req.body;
        const physical_inventory_id = req.body.physical_inventory_id || req.params.id;
        const companyId = req.company_id;
        const userId = req.user.id;

        if (!physical_inventory_id || !nombre_sesion) {
            return res.status(400).json({ message: 'physical_inventory_id y nombre_sesion son requeridos' });
        }

        // Verificar que el conteo existe, está en estado PENDIENTE y pertenece a la empresa/sucursal
        const [inventory] = await connection.query(
            `SELECT id, branch_id, status FROM physical_inventories 
             WHERE id = ? AND company_id = ?`,
            [physical_inventory_id, companyId]
        );

        if (inventory.length === 0) {
            return res.status(404).json({ message: 'Conteo físico no encontrado' });
        }

        if (inventory[0].status !== 'PENDIENTE') {
            return res.status(400).json({ message: 'Solo se pueden generar sesiones de escaneo en conteos PENDIENTES' });
        }

        const branchId = inventory[0].branch_id;

        // Generar token seguro único
        let token;
        let tokenExists = true;
        while (tokenExists) {
            token = crypto.randomBytes(32).toString('hex');
            const [existing] = await connection.query(
                'SELECT id FROM physical_inventory_scan_sessions WHERE token = ?',
                [token]
            );
            tokenExists = existing.length > 0;
        }

        // Crear sesión
        const [result] = await connection.query(
            `INSERT INTO physical_inventory_scan_sessions 
             (company_id, physical_inventory_id, branch_id, token, nombre_sesion, created_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [companyId, physical_inventory_id, branchId, token, nombre_sesion, userId]
        );

        const sessionId = result.insertId;

        // Generar URL pública y QR code
        const origin = req.headers.origin || `${req.protocol}://${req.get('host')}` || process.env.FRONTEND_URL || 'http://localhost:3000';
        const publicUrl = `${origin}/scan/${token}`;
        const qrCodeBase64 = await QRCode.toDataURL(publicUrl, {
            width: 256,
            margin: 2,
            color: { dark: '#1e293b', light: '#ffffff' }
        });

        res.status(201).json({
            id: sessionId,
            token,
            nombre_sesion,
            public_url: publicUrl,
            qr_code: qrCodeBase64,
            branch_id: branchId,
            physical_inventory_id,
            message: 'Sesión de escaneo creada correctamente'
        });

    } catch (error) {
        console.error('Error creating scan session:', error);
        res.status(500).json({ message: 'Error al crear sesión de escaneo' });
    } finally {
        connection.release();
    }
};

const getScanSession = async (req, res) => {
    try {
        const { token } = req.params;

        // Buscar sesión activa
        const [sessions] = await pool.query(
            `SELECT s.*, pi.status as inventory_status, pi.branch_id
             FROM physical_inventory_scan_sessions s
             JOIN physical_inventories pi ON s.physical_inventory_id = pi.id
             WHERE s.token = ? AND s.is_active = TRUE`,
            [token]
        );

        if (sessions.length === 0) {
            return res.status(404).json({ message: 'Sesión de escaneo no encontrada o inactiva' });
        }

        const session = sessions[0];

        // Verificar que el conteo asociado sigue PENDIENTE
        if (session.inventory_status !== 'PENDIENTE') {
            return res.status(400).json({ 
                message: 'Este conteo ya fue aplicado o anulado. La sesión de escaneo ha expirado.',
                expired: true
            });
        }

        // Obtener productos válidos para este conteo (solo los cargados en physical_inventory_items)
        const [products] = await pool.query(
            `SELECT pi.id as item_id, pi.product_id, pi.stock_sistema, pi.costo,
                    p.codigo, p.nombre
             FROM physical_inventory_items pi
             JOIN products p ON pi.product_id = p.id
             WHERE pi.physical_inventory_id = ?`,
            [session.physical_inventory_id]
        );

        // Obtener últimos escaneos de esta sesión
        const [scans] = await pool.query(
            `SELECT sc.id, sc.codigo_barras, sc.cantidad_fisica, sc.created_at, sc.escaneado_por_nombre,
                    p.codigo, p.nombre
             FROM physical_inventory_scans sc
             JOIN products p ON sc.product_id = p.id
             WHERE sc.session_id = ?
             ORDER BY sc.created_at DESC
             LIMIT 10`,
            [session.id]
        );

        // Crear mapa para búsqueda rápida por código/barcode
        const productMap = {};
        products.forEach(p => {
            if (p.codigo) productMap[p.codigo.toUpperCase()] = p;
        });

        res.json({
            session: {
                id: session.id,
                nombre_sesion: session.nombre_sesion,
                physical_inventory_id: session.physical_inventory_id,
                branch_id: session.branch_id,
                is_active: session.is_active
            },
            inventory_status: session.inventory_status,
            products: products.map(p => ({
                product_id: p.product_id,
                item_id: p.item_id,
                codigo: p.codigo,
                nombre: p.nombre,
                stock_sistema: p.stock_sistema,
                costo: p.costo
            })),
            productMap, // para validación rápida en frontend
            scans: scans.map(s => ({
                id: s.id,
                codigo: s.codigo,
                nombre: s.nombre,
                codigo_barras: s.codigo_barras,
                cantidad_fisica: s.cantidad_fisica,
                created_at: s.created_at,
                escaneado_por_nombre: s.escaneado_por_nombre
            }))
        });

    } catch (error) {
        console.error('Error getting scan session:', error);
        res.status(500).json({ message: 'Error al obtener sesión de escaneo' });
    }
};

const submitScan = async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const { token } = req.params;
        const { codigo_barras, cantidad_fisica, escaneado_por_nombre, observaciones } = req.body;

        if (!codigo_barras || cantidad_fisica === undefined || cantidad_fisica === '') {
            await connection.rollback();
            return res.status(400).json({ message: 'codigo_barras y cantidad_fisica son requeridos' });
        }

        const qty = parseFloat(cantidad_fisica);
        if (isNaN(qty) || qty < 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Cantidad física inválida' });
        }

        // Buscar sesión activa
        const [sessions] = await connection.query(
            `SELECT s.*, pi.status as inventory_status, pi.branch_id
             FROM physical_inventory_scan_sessions s
             JOIN physical_inventories pi ON s.physical_inventory_id = pi.id
             WHERE s.token = ? AND s.is_active = TRUE`,
            [token]
        );

        if (sessions.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Sesión de escaneo no encontrada o inactiva' });
        }

        const session = sessions[0];

        if (session.inventory_status !== 'PENDIENTE') {
            await connection.rollback();
            return res.status(400).json({ 
                message: 'Este conteo ya fue aplicado o anulado',
                expired: true
            });
        }

        // Buscar producto en los items del conteo (solo productos cargados)
        const searchCode = codigo_barras.trim().toUpperCase();
        const [productItems] = await connection.query(
            `SELECT pi.id as item_id, pi.product_id, pi.stock_sistema, pi.costo,
                    p.codigo, p.nombre
             FROM physical_inventory_items pi
             JOIN products p ON pi.product_id = p.id
             WHERE pi.physical_inventory_id = ? 
               AND UPPER(p.codigo) = ?
             LIMIT 1`,
            [session.physical_inventory_id, searchCode]
        );

        if (productItems.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Producto no encontrado en este conteo' });
        }

        const product = productItems[0];

        // Guardar escaneo
        const [result] = await connection.query(
            `INSERT INTO physical_inventory_scans 
             (session_id, product_id, codigo_barras, cantidad_fisica, escaneado_por_nombre, observaciones)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [session.id, product.product_id, codigo_barras.trim(), qty, escaneado_por_nombre || 'Escáner Móvil', observaciones || '']
        );

        await connection.commit();

        // Notificar en tiempo real
        if (session.company_id) {
            broadcastToCompany(session.company_id, 'scan_submitted', {
                physical_inventory_id: session.physical_inventory_id,
                product: { codigo: product.codigo, nombre: product.nombre },
                cantidad_fisica: qty,
                escaneado_por_nombre
            });
        }

        res.status(201).json({
            id: result.insertId,
            product: {
                codigo: product.codigo,
                nombre: product.nombre,
                stock_sistema: product.stock_sistema
            },
            cantidad_fisica: qty,
            escaneado_por_nombre,
            message: 'Escaneo registrado correctamente'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error submitting scan:', error);
        res.status(500).json({ message: 'Error al registrar escaneo' });
    } finally {
        connection.release();
    }
};

const getSessionScans = async (req, res) => {
    try {
        const { id } = req.params; // physical_inventory_id
        const companyId = req.company_id;

        // Verificar que el conteo pertenece a la empresa
        const [inventory] = await pool.query(
            'SELECT id FROM physical_inventories WHERE id = ? AND company_id = ?',
            [id, companyId]
        );

        if (inventory.length === 0) {
            return res.status(404).json({ message: 'Conteo no encontrado' });
        }

        // Obtener todas las sesiones y sus escaneos
        const [sessions] = await pool.query(
            `SELECT s.id, s.token, s.nombre_sesion, s.is_active, s.physical_inventory_id,
                    s.created_by, s.created_at as session_created_at,
                    u.nombre as created_by_nombre
             FROM physical_inventory_scan_sessions s
             LEFT JOIN users u ON s.created_by = u.id
             WHERE s.physical_inventory_id = ? AND s.is_active = TRUE
             ORDER BY s.created_at DESC`,
            [id]
        );

        if (sessions.length === 0) {
            return res.json({ sessions: [], scans: [] });
        }

        const sessionIds = sessions.map(s => s.id);
        const placeholders = sessionIds.map(() => '?').join(',');

        const [scans] = await pool.query(
            `SELECT sc.*, p.codigo, p.nombre,
                    COALESCE(pii.stock_sistema, 0) as stock_sistema
             FROM physical_inventory_scans sc
             JOIN products p ON sc.product_id = p.id
             JOIN physical_inventory_scan_sessions s ON sc.session_id = s.id
             LEFT JOIN physical_inventory_items pii ON pii.physical_inventory_id = s.physical_inventory_id AND pii.product_id = sc.product_id
             WHERE sc.session_id IN (${placeholders})
             ORDER BY sc.created_at DESC`,
            sessionIds
        );

        // Agrupar escaneos por sesión
        const scansBySession = {};
        scans.forEach(scan => {
            if (!scansBySession[scan.session_id]) scansBySession[scan.session_id] = [];
            scansBySession[scan.session_id].push(scan);
        });

        const sessionsWithScans = sessions.map(s => ({
            ...s,
            scans: scansBySession[s.id] || []
        }));

        res.json({ sessions: sessionsWithScans });

    } catch (error) {
        console.error('Error getting session scans:', error);
        res.status(500).json({ message: 'Error al obtener escaneos' });
    }
};

const applyScans = async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const { id } = req.params; // physical_inventory_id
        const { scan_ids } = req.body; // array de IDs de escaneos a aplicar
        const companyId = req.company_id;

        if (!scan_ids || !Array.isArray(scan_ids) || scan_ids.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Debe seleccionar al menos un escaneo para aplicar' });
        }

        // Verificar conteo
        const [inventory] = await connection.query(
            'SELECT id, status FROM physical_inventories WHERE id = ? AND company_id = ?',
            [id, companyId]
        );

        if (inventory.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Conteo no encontrado' });
        }

        if (inventory[0].status !== 'PENDIENTE') {
            await connection.rollback();
            return res.status(400).json({ message: 'Solo se pueden aplicar escaneos en conteos PENDIENTES' });
        }

        const placeholders = scan_ids.map(() => '?').join(',');
        
        // Obtener escaneos PENDIENTES seleccionados con info del producto
        const [scans] = await connection.query(
            `SELECT sc.*, p.codigo, p.nombre
             FROM physical_inventory_scans sc
             JOIN products p ON sc.product_id = p.id
             WHERE sc.id IN (${placeholders}) AND sc.estado = 'PENDIENTE'`,
            scan_ids
        );

        if (scans.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'No hay escaneos válidos pendientes para aplicar' });
        }

        // Agrupar por producto (sumar cantidades si hay múltiples escaneos del mismo producto)
        const qtyByProduct = {};
        scans.forEach(scan => {
            if (!qtyByProduct[scan.product_id]) {
                qtyByProduct[scan.product_id] = {
                    total: 0,
                    scans: []
                };
            }
            qtyByProduct[scan.product_id].total += parseFloat(scan.cantidad_fisica);
            qtyByProduct[scan.product_id].scans.push(scan.id);
        });

        // Actualizar physical_inventory_items: SUMAR al stock_fisico existente
        for (const [productId, data] of Object.entries(qtyByProduct)) {
            await connection.query(
                `UPDATE physical_inventory_items 
                 SET stock_fisico = COALESCE(stock_fisico, 0) + ?,
                     diferencia = COALESCE(stock_fisico, 0) + ? - stock_sistema,
                     total = (COALESCE(stock_fisico, 0) + ? - stock_sistema) * costo
                 WHERE physical_inventory_id = ? AND product_id = ?`,
                [data.total, data.total, data.total, id, productId]
            );
        }

        // Marcar escaneos como APLICADO
        await connection.query(
            `UPDATE physical_inventory_scans SET estado = 'APLICADO' WHERE id IN (${placeholders})`,
            scan_ids
        );

        // Desactivar todas las sesiones de escaneo de este conteo (expiran al aplicar)
        await connection.query(
            `UPDATE physical_inventory_scan_sessions SET is_active = FALSE WHERE physical_inventory_id = ?`,
            [id]
        );

        await connection.commit();

        broadcastToCompany(companyId, 'scans_applied', {
            physical_inventory_id: parseInt(id),
            scans_applied: scans.length,
            products_updated: Object.keys(qtyByProduct).length
        });

        notificationService.notify('physical_inventory_applied', req.company_id, req.user.branch_id, {
            inventario_fisico_id: parseInt(id),
            escaneos_aplicados: scans.length,
            productos_actualizados: Object.keys(qtyByProduct).length,
            sucursal: req.branch_name || ''
        }).catch(() => {});

        res.json({ 
            message: `${scans.length} escaneo(s) aplicado(s) correctamente`,
            products_updated: Object.keys(qtyByProduct).length,
            scans_applied: scans.length
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error applying scans:', error);
        res.status(500).json({ message: 'Error al aplicar escaneos' });
    } finally {
        connection.release();
    }
};

const rejectScans = async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const { id } = req.params;
        const { scan_ids } = req.body;
        if (!scan_ids || !Array.isArray(scan_ids) || scan_ids.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Debe seleccionar al menos un escaneo' });
        }

        const placeholders = scan_ids.map(() => '?').join(',');
        await connection.query(
            `UPDATE physical_inventory_scans SET estado = 'RECHAZADO' WHERE id IN (${placeholders})`,
            scan_ids
        );

        await connection.commit();

        if (req.company_id) {
            broadcastToCompany(req.company_id, 'scans_rejected', {
                physical_inventory_id: id ? parseInt(id) : null,
                scans: scan_ids.length
            });
        }

        res.json({ message: `${scan_ids.length} escaneo(s) rechazado(s)` });
    } catch (error) {
        await connection.rollback();
        console.error('Error rejecting scans:', error);
        res.status(500).json({ message: 'Error al rechazar escaneos' });
    } finally {
        connection.release();
    }
};

const deleteScanSession = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id;

        // Verificar que la sesión pertenece a la empresa
        const [sessions] = await pool.query(
            `SELECT s.id, s.physical_inventory_id
             FROM physical_inventory_scan_sessions s
             JOIN physical_inventories pi ON s.physical_inventory_id = pi.id
             WHERE s.id = ? AND pi.company_id = ?`,
            [id, companyId]
        );

        if (sessions.length === 0) {
            return res.status(404).json({ message: 'Sesión de escaneo no encontrada' });
        }

        // Verificar que no tiene escaneos
        const [scans] = await pool.query(
            'SELECT COUNT(*) as count FROM physical_inventory_scans WHERE session_id = ?',
            [id]
        );

        if (scans[0].count > 0) {
            return res.status(400).json({ message: 'No se puede eliminar una sesión que tiene escaneos registrados' });
        }

        await pool.query('DELETE FROM physical_inventory_scan_sessions WHERE id = ?', [id]);

        res.json({ message: 'Sesión de escaneo eliminada correctamente' });

    } catch (error) {
        console.error('Error deleting scan session:', error);
        res.status(500).json({ message: 'Error al eliminar sesión de escaneo' });
    }
};

module.exports = {
    createScanSession,
    getScanSession,
    submitScan,
    getSessionScans,
    applyScans,
    rejectScans,
    deleteScanSession
};