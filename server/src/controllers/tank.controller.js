const pool = require('../config/db');

const TABLE = 'gas_station_tanks';

exports.getTanks = async (req, res) => {
    try {
        const { search, page = 1, limit = 15 } = req.query;
        const offset = (page - 1) * limit;
        let where = 'WHERE company_id = ?';
        let params = [req.company_id];

        const isSuperAdmin = req.user?.role === 'SuperAdmin' || req.user?.role?.toLowerCase() === 'superadmin';
        const targetBranchId = req.headers['x-branch-id'] ? parseInt(req.headers['x-branch-id']) : (req.branch_id || req.user?.branch_id);

        if (!isSuperAdmin && targetBranchId) {
            where += ' AND (branch_id = ? OR branch_id IS NULL)';
            params.push(targetBranchId);
        } else if (isSuperAdmin && targetBranchId) {
            where += ' AND (branch_id = ? OR branch_id IS NULL)';
            params.push(targetBranchId);
        }

        if (search) {
            where += ' AND (codigo LIKE ? OR descripcion LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM ${TABLE} ${where}`, params);
        const total = countResult[0].total;
        const [rows] = await pool.query(`SELECT t.*, COALESCE(t.tipo_combustible, 0) as tipo_combustible FROM ${TABLE} t ${where} ORDER BY t.codigo ASC LIMIT ? OFFSET ?`, [...params, parseInt(limit), parseInt(offset)]);
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        console.error('Error getTanks:', error);
        res.status(500).json({ message: 'Error al obtener tanques' });
    }
};

exports.createTank = async (req, res) => {
    try {
        const branchId = req.body.branch_id || (req.headers['x-branch-id'] ? parseInt(req.headers['x-branch-id']) : null) || req.branch_id || req.user?.branch_id || null;
        const data = { ...req.body, company_id: req.company_id, branch_id: branchId };
        const [result] = await pool.query(`INSERT INTO ${TABLE} SET ?`, [data]);
        res.status(201).json({ id: result.insertId, ...data });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Ya existe un tanque con ese código' });
        console.error('Error createTank:', error);
        res.status(500).json({ message: 'Error al crear tanque' });
    }
};

exports.updateTank = async (req, res) => {
    try {
        const { id } = req.params;
        const isSuperAdmin = req.user?.role === 'SuperAdmin' || req.user?.role?.toLowerCase() === 'superadmin';

        let where = 'WHERE id = ? AND company_id = ?';
        let params = [req.body, id, req.company_id];

        if (!isSuperAdmin) {
            const targetBranchId = req.headers['x-branch-id'] ? parseInt(req.headers['x-branch-id']) : (req.branch_id || req.user?.branch_id);
            if (targetBranchId) {
                where += ' AND (branch_id = ? OR branch_id IS NULL)';
                params.push(targetBranchId);
            }
        }

        const [result] = await pool.query(`UPDATE ${TABLE} SET ? ${where}`, params);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Tanque no encontrado o no tiene permisos para modificarlo' });
        }
        res.json({ message: 'Tanque actualizado' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Ya existe un tanque con ese código' });
        console.error('Error updateTank:', error);
        res.status(500).json({ message: 'Error al actualizar tanque' });
    }
};

exports.deleteTank = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        const isSuperAdmin = req.user?.role === 'SuperAdmin' || req.user?.role?.toLowerCase() === 'superadmin';

        // 1. Validar privilegios de usuario para eliminar tanques
        let hasPrivilege = isSuperAdmin;
        if (!hasPrivilege && req.user?.role) {
            const [roleRows] = await connection.query('SELECT permissions FROM roles WHERE name = ?', [req.user.role]);
            if (roleRows.length > 0) {
                const perms = typeof roleRows[0].permissions === 'string' ? JSON.parse(roleRows[0].permissions) : roleRows[0].permissions;
                if (Array.isArray(perms) && perms.includes('manage_gas_tanks')) {
                    hasPrivilege = true;
                }
            }
        }
        if (!hasPrivilege) {
            connection.release();
            return res.status(403).json({ message: 'No tiene privilegios para eliminar tanques' });
        }

        // 2. Verificar existencia del tanque en la empresa
        const [tanks] = await connection.query(
            `SELECT * FROM ${TABLE} WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (tanks.length === 0) {
            connection.release();
            return res.status(404).json({ message: 'Tanque no encontrado' });
        }
        const tank = tanks[0];

        // 3. Validar sucursal para usuarios no SuperAdmin
        if (!isSuperAdmin) {
            const targetBranchId = req.headers['x-branch-id'] ? parseInt(req.headers['x-branch-id']) : (req.branch_id || req.user?.branch_id);
            if (targetBranchId && tank.branch_id && tank.branch_id != targetBranchId) {
                connection.release();
                return res.status(403).json({ message: 'No tiene privilegios para eliminar tanques de otra sucursal' });
            }
        }

        await connection.beginTransaction();

        // 4. Limpiar lecturas en turnos abiertos para este tanque (para que no bloqueen el cierre del turno)
        await connection.query(`
            DELETE r FROM gas_station_closeout_tank_readings r
            JOIN gas_station_closeouts c ON r.closeout_id = c.id
            WHERE r.tank_id = ? AND c.estado = 'abierto'
        `, [id]);

        // 5. En turnos cerrados, desvincular tank_id (SET NULL) para preservar el historial con codigo y descripcion
        await connection.query(`
            UPDATE gas_station_closeout_tank_readings
            SET tank_id = NULL
            WHERE tank_id = ?
        `, [id]);

        // 6. Eliminar el tanque físicamente
        const [deleteResult] = await connection.query(
            `DELETE FROM ${TABLE} WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );

        if (deleteResult.affectedRows === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ message: 'Tanque no encontrado para eliminar' });
        }

        await connection.commit();
        connection.release();
        res.json({ message: 'Tanque eliminado exitosamente' });
    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('Error deleteTank:', error);
        res.status(500).json({ message: error.message || 'Error al eliminar tanque' });
    }
};
