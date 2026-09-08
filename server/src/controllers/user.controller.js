const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const notificationService = require('../services/notification.service');

const getUsers = async (req, res) => {
    try {
        const { search, page = 1, limit = 15 } = req.query;
        const offset = (page - 1) * limit;
        const companyId = req.user?.company_id || null;

        let query = `
            SELECT u.id, u.username, u.nombre, u.email, u.telefono, u.status, u.allowed_ips, ue.role_id, r.name as role_name 
            FROM users u 
            LEFT JOIN usuario_empresa ue ON u.id = ue.usuario_id AND ue.empresa_id = ?
            LEFT JOIN roles r ON ue.role_id = r.id
            WHERE 1=1
        `;
        let params = [companyId];

        if (search) {
            query += ` AND (u.nombre LIKE ? OR u.username LIKE ? OR u.email LIKE ?) `;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        // Count total for pagination
        const countQuery = `SELECT COUNT(*) as total FROM (${query}) as sub`;
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        // Final query with pagination
        query += ` ORDER BY u.nombre ASC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [users] = await pool.query(query, params);

        res.json({
            users,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener usuarios' });
    }
};

const createUser = async (req, res) => {
    const { username, password, nombre, email, telefono, role_id, branches, allowed_ips } = req.body;
    const companyId = req.user.company_id;

    if (telefono && !/^\d{4}-\d{4}$/.test(telefono)) {
        return res.status(400).json({ message: 'El teléfono debe tener el formato 0000-0000' });
    }

    console.log('DEBUG: createUser', { username, role_id, companyId, user: req.user });
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        // 1. Verificar si el usuario ya existe
        const [existing] = await connection.query('SELECT id FROM users WHERE username = ?', [username]);
        let userId;

        if (existing.length > 0) {
            userId = existing[0].id;
            // Verificar si ya está vinculado a esta empresa
            if (companyId) {
                const [link] = await connection.query(
                    'SELECT * FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ?',
                    [userId, companyId]
                );
                if (link.length > 0) {
                    await connection.rollback();
                    return res.status(400).json({ message: 'El usuario ya tiene acceso a esta empresa' });
                }
            }
        } else {
            // Crear nuevo usuario
            const hashedPassword = await bcrypt.hash(password, 10);
            const ipArray = allowed_ips ? (Array.isArray(allowed_ips) ? allowed_ips : allowed_ips.split('\n').map(s => s.trim()).filter(Boolean)) : [];
            const [userResult] = await connection.query(
                'INSERT INTO users (username, password, nombre, email, telefono, allowed_ips) VALUES (?, ?, ?, ?, ?, ?)',
                [username, hashedPassword, nombre, email, telefono || null, ipArray.length > 0 ? JSON.stringify(ipArray) : null]
            );
            userId = userResult.insertId;
        }


        await connection.commit();
        notificationService.notify('user_created', companyId, req.user?.branch_id, {
            usuario_id: userId,
            nombre: nombre || '',
            username: username || '',
            email: email || ''
        }).catch(() => {});
        res.status(201).json({ 
            id: userId, 
            username, 
            message: existing.length > 0 ? 'Usuario vinculado exitosamente' : 'Usuario creado' 
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error in createUser:', error);
        console.error('Stack:', error.stack);
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

const updateUser = async (req, res) => {
    const { id } = req.params;
    const { username, nombre, email, telefono, role_id, status, branches, password, allowed_ips } = req.body;
    const companyId = req.user.company_id;

    if (telefono && !/^\d{4}-\d{4}$/.test(telefono)) {
        return res.status(400).json({ message: 'El teléfono debe tener el formato 0000-0000' });
    }
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const updates = [];
        const params = [];

        if (username !== undefined) { updates.push('username = ?'); params.push(username); }
        if (nombre !== undefined) { updates.push('nombre = ?'); params.push(nombre); }
        if (email !== undefined) { updates.push('email = ?'); params.push(email); }
        if (telefono !== undefined) { updates.push('telefono = ?'); params.push(telefono || null); }
        if (status !== undefined) { updates.push('status = ?'); params.push(status); }
        if (allowed_ips !== undefined) {
            const ipArray = Array.isArray(allowed_ips) ? allowed_ips : allowed_ips.split('\n').map(s => s.trim()).filter(Boolean);
            updates.push('allowed_ips = ?');
            params.push(ipArray.length > 0 ? JSON.stringify(ipArray) : null);
        }

        if (password && password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(password, 10);
            updates.push('password = ?');
            params.push(hashedPassword);
        }

        if (updates.length > 0) {
            const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
            params.push(id);
            await connection.query(query, params);
        }

        // Actualizar rol en ESTA empresa (SOLO si se provee y hay contexto)
        if (role_id && companyId) {
            await connection.query(
                'UPDATE usuario_empresa SET role_id = ? WHERE usuario_id = ? AND empresa_id = ?',
                [role_id, id, companyId]
            );
        }

        // Actualizar Sucursales en ESTA empresa (SOLO si se proveen y hay contexto)
        if (branches !== undefined && Array.isArray(branches) && companyId) {
            // 1. Borrar sucursales del usuario que pertenecen a esta empresa
            await connection.query(
                `DELETE us FROM usuario_sucursal us 
                 JOIN branches b ON us.sucursal_id = b.id 
                 WHERE us.usuario_id = ? AND b.company_id = ?`,
                [id, companyId]
            );

            // 2. Insertar nuevas
            if (branches.length > 0) {
                const values = branches.map(branchId => [id, branchId]);
                await connection.query('INSERT INTO usuario_sucursal (usuario_id, sucursal_id) VALUES ?', [values]);
            }
        }

        await connection.commit();
        res.json({ message: 'Usuario actualizado' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

const getAllUsers = async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, username, nombre, email, status FROM users');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener todos los usuarios' });
    }
};

const assignCompanyAccess = async (req, res) => {
    const { userId, companyId, roleId, branches } = req.body;
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        // 1. Manejar usuario_empresa (Insert o Update)
        const [existing] = await connection.query(
            'SELECT * FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ?',
            [userId, companyId]
        );

        if (existing.length > 0) {
            await connection.query(
                'UPDATE usuario_empresa SET role_id = ?, has_access = 1 WHERE usuario_id = ? AND empresa_id = ?',
                [roleId, userId, companyId]
            );
        } else {
            await connection.query(
                'INSERT INTO usuario_empresa (usuario_id, empresa_id, role_id, has_access) VALUES (?, ?, ?, 1)',
                [userId, companyId, roleId]
            );
        }

        // 2. Manejar usuario_sucursal
        // Limpiar accesos previos de este usuario en ESTA empresa
        await connection.query(
            `DELETE us FROM usuario_sucursal us 
             JOIN branches b ON us.sucursal_id = b.id 
             WHERE us.usuario_id = ? AND b.company_id = ?`,
            [userId, companyId]
        );

        // Insertar nuevos
        if (branches && Array.isArray(branches) && branches.length > 0) {
            const values = branches.map(branchId => [userId, branchId]);
            await connection.query('INSERT INTO usuario_sucursal (usuario_id, sucursal_id) VALUES ?', [values]);
        }

        await connection.commit();
        res.json({ message: 'Acceso asignado correctamente' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ message: 'Error al asignar acceso' });
    } finally {
        connection.release();
    }
};

const updateProfile = async (req, res) => {
    const userId = req.user.id;
    const { nombre, email, username, password } = req.body;
    console.log('--- UPDATE PROFILE START ---');
    console.log('User ID:', userId);
    console.log('Incoming Data:', { nombre, email, username });
    
    try {
        if (password && password.trim() !== '') {
            console.log('Updating with password hash...');
            const hashed = await bcrypt.hash(password, 10);
            await pool.query(
                'UPDATE users SET nombre = ?, email = ?, username = ?, password = ? WHERE id = ?',
                [nombre, email, username, hashed, userId]
            );
        } else {
            console.log('Updating WITHOUT password...');
            const results = await pool.query(
                'UPDATE users SET nombre = ?, email = ?, username = ? WHERE id = ?',
                [nombre, email, username, userId]
            );
            console.log('Update result:', results[0]?.affectedRows, 'rows affected');
        }
        // Get updated user (excluding password)
        const [rows] = await pool.query(
            'SELECT id, username, nombre, email FROM users WHERE id = ?',
            [userId]
        );
        console.log('Fetched updated user from DB:', rows[0]);
        console.log('--- UPDATE PROFILE END ---');
        res.json(rows[0]);
    } catch (error) {
        console.error('--- UPDATE PROFILE ERROR ---');
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'El nombre de usuario o correo ya están en uso por otro usuario.' });
        }
        res.status(500).json({ message: 'Error al actualizar perfil: ' + (error.message || '') });
    }
};

const getAccessSummary = async (req, res) => {
    try {
        const [accesses] = await pool.query(
            `SELECT 
                u.id as user_id, u.nombre as user_name, u.username,
                c.id as company_id, c.razon_social as company_name,
                r.id as role_id, r.name as role_name
             FROM usuario_empresa ue
             JOIN users u ON ue.usuario_id = u.id
             JOIN companies c ON ue.empresa_id = c.id
             JOIN roles r ON ue.role_id = r.id
             WHERE ue.has_access = 1
             ORDER BY u.nombre ASC, c.razon_social ASC`
        );

        const [allUserBranches] = await pool.query(
            `SELECT us.usuario_id, b.company_id, b.id, b.nombre 
             FROM usuario_sucursal us
             JOIN branches b ON us.sucursal_id = b.id`
        );

        const branchesMap = {};
        allUserBranches.forEach(b => {
            const key = `${b.usuario_id}-${b.company_id}`;
            if (!branchesMap[key]) branchesMap[key] = [];
            branchesMap[key].push({ id: b.id, nombre: b.nombre });
        });

        const summary = accesses.map(acc => {
            const key = `${acc.user_id}-${acc.company_id}`;
            return {
                ...acc,
                branches: branchesMap[key] || []
            };
        });

        res.json(summary);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener resumen de accesos' });
    }
};

const deleteCompanyAccess = async (req, res) => {
    const { userId, companyId } = req.params;
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        // Eliminar vínculo de sucursales de esa empresa
        await connection.query(
            `DELETE us FROM usuario_sucursal us 
             JOIN branches b ON us.sucursal_id = b.id 
             WHERE us.usuario_id = ? AND b.company_id = ?`,
            [userId, companyId]
        );

        // Eliminar vínculo de empresa
        await connection.query(
            'DELETE FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ?',
            [userId, companyId]
        );

        await connection.commit();
        res.json({ message: 'Acceso eliminado correctamente' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error(error);
        res.status(500).json({ message: 'Error al eliminar acceso' });
    } finally {
        if (connection) connection.release();
    }
};

const getCompaniesWithBranchesTree = async (req, res) => {
    try {
        const [companies] = await pool.query(
            `SELECT id, razon_social, nombre_comercial, nit FROM companies ORDER BY razon_social ASC`
        );
        const [branches] = await pool.query(
            `SELECT id, company_id, codigo, nombre, direccion FROM branches ORDER BY company_id, nombre ASC`
        );

        const branchesByCompany = {};
        branches.forEach(b => {
            if (!branchesByCompany[b.company_id]) {
                branchesByCompany[b.company_id] = [];
            }
            branchesByCompany[b.company_id].push({
                id: b.id,
                codigo: b.codigo,
                nombre: b.nombre,
                direccion: b.direccion
            });
        });

        const tree = companies.map(c => ({
            id: c.id,
            razon_social: c.razon_social,
            nombre_comercial: c.nombre_comercial,
            nit: c.nit,
            branches: branchesByCompany[c.id] || []
        }));

        res.json(tree);
    } catch (error) {
        console.error('Error getting companies with branches tree:', error);
        res.status(500).json({ message: 'Error al obtener empresas y sucursales' });
    }
};

const assignBulkAccess = async (req, res) => {
    const { userIds, assignments } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: 'Debe seleccionar al menos un usuario' });
    }
    if (!Array.isArray(assignments) || assignments.length === 0) {
        return res.status(400).json({ message: 'Debe especificar al menos una empresa con rol' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        for (const userId of userIds) {
            for (const assignment of assignments) {
                const { companyId, roleId, branches } = assignment;
                if (!companyId || !roleId) continue;

                // 1. usuario_empresa
                await connection.query(
                    `INSERT INTO usuario_empresa (usuario_id, empresa_id, role_id, has_access)
                     VALUES (?, ?, ?, 1)
                     ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), has_access = 1`,
                    [userId, companyId, roleId]
                );

                // 2. Limpiar sucursales previas en esta empresa
                await connection.query(
                    `DELETE us FROM usuario_sucursal us
                     JOIN branches b ON us.sucursal_id = b.id
                     WHERE us.usuario_id = ? AND b.company_id = ?`,
                    [userId, companyId]
                );

                // 3. Insertar nuevas sucursales
                if (Array.isArray(branches) && branches.length > 0) {
                    const branchValues = branches.map(branchId => [userId, branchId]);
                    await connection.query(
                        `INSERT IGNORE INTO usuario_sucursal (usuario_id, sucursal_id) VALUES ?`,
                        [branchValues]
                    );
                }
            }
        }

        await connection.commit();
        res.json({
            message: `Accesos asignados exitosamente a ${userIds.length} usuario(s) en ${assignments.length} empresa(s)`
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error in assignBulkAccess:', error);
        res.status(500).json({ message: 'Error al procesar asignación masiva: ' + (error.message || '') });
    } finally {
        if (connection) connection.release();
    }
};

const cloneUserAccess = async (req, res) => {
    const { sourceUserId, targetUserIds, mode = 'merge' } = req.body;

    if (!sourceUserId) {
        return res.status(400).json({ message: 'Debe especificar el usuario origen' });
    }
    if (!Array.isArray(targetUserIds) || targetUserIds.length === 0) {
        return res.status(400).json({ message: 'Debe seleccionar al menos un usuario destino' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        // Obtener accesos de empresa del usuario origen
        const [sourceCompanies] = await connection.query(
            `SELECT empresa_id, role_id FROM usuario_empresa WHERE usuario_id = ? AND has_access = 1`,
            [sourceUserId]
        );

        if (sourceCompanies.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'El usuario origen no tiene accesos configurados para clonar' });
        }

        // Obtener sucursales del usuario origen con su company_id
        const [sourceBranches] = await connection.query(
            `SELECT us.sucursal_id, b.company_id
             FROM usuario_sucursal us
             JOIN branches b ON us.sucursal_id = b.id
             WHERE us.usuario_id = ?`,
            [sourceUserId]
        );

        for (const targetId of targetUserIds) {
            if (parseInt(targetId) === parseInt(sourceUserId)) continue;

            if (mode === 'replace') {
                // Limpiar todo lo anterior del destino
                await connection.query(`DELETE FROM usuario_sucursal WHERE usuario_id = ?`, [targetId]);
                await connection.query(`DELETE FROM usuario_empresa WHERE usuario_id = ?`, [targetId]);
            }

            // Asignar empresas
            for (const sc of sourceCompanies) {
                await connection.query(
                    `INSERT INTO usuario_empresa (usuario_id, empresa_id, role_id, has_access)
                     VALUES (?, ?, ?, 1)
                     ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), has_access = 1`,
                    [targetId, sc.empresa_id, sc.role_id]
                );

                if (mode === 'merge') {
                    // Limpiar sucursales de esta empresa para el destino antes de reinsertar las del origen
                    await connection.query(
                        `DELETE us FROM usuario_sucursal us
                         JOIN branches b ON us.sucursal_id = b.id
                         WHERE us.usuario_id = ? AND b.company_id = ?`,
                        [targetId, sc.empresa_id]
                    );
                }
            }

            // Insertar sucursales clonadas
            if (sourceBranches.length > 0) {
                const branchValues = sourceBranches.map(sb => [targetId, sb.sucursal_id]);
                await connection.query(
                    `INSERT IGNORE INTO usuario_sucursal (usuario_id, sucursal_id) VALUES ?`,
                    [branchValues]
                );
            }
        }

        await connection.commit();
        res.json({ message: `Accesos clonados exitosamente a ${targetUserIds.length} usuario(s)` });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error in cloneUserAccess:', error);
        res.status(500).json({ message: 'Error al clonar accesos: ' + (error.message || '') });
    } finally {
        if (connection) connection.release();
    }
};

const bulkUpdateRole = async (req, res) => {
    const { items, newRoleId } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Debe seleccionar al menos un registro' });
    }
    if (!newRoleId) {
        return res.status(400).json({ message: 'Debe seleccionar el nuevo rol' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        for (const item of items) {
            const { userId, companyId } = item;
            if (userId && companyId) {
                await connection.query(
                    `UPDATE usuario_empresa SET role_id = ? WHERE usuario_id = ? AND empresa_id = ?`,
                    [newRoleId, userId, companyId]
                );
            }
        }

        await connection.commit();
        res.json({ message: `Rol actualizado en ${items.length} acceso(s)` });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error in bulkUpdateRole:', error);
        res.status(500).json({ message: 'Error al actualizar roles masivamente' });
    } finally {
        if (connection) connection.release();
    }
};

const bulkDeleteAccess = async (req, res) => {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Debe seleccionar al menos un registro' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        for (const item of items) {
            const { userId, companyId } = item;
            if (userId && companyId) {
                // 1. Eliminar sucursales de esa empresa
                await connection.query(
                    `DELETE us FROM usuario_sucursal us
                     JOIN branches b ON us.sucursal_id = b.id
                     WHERE us.usuario_id = ? AND b.company_id = ?`,
                    [userId, companyId]
                );
                // 2. Eliminar vínculo de empresa
                await connection.query(
                    `DELETE FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ?`,
                    [userId, companyId]
                );
            }
        }

        await connection.commit();
        res.json({ message: `${items.length} acceso(s) eliminado(s) correctamente` });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error in bulkDeleteAccess:', error);
        res.status(500).json({ message: 'Error al eliminar accesos masivamente' });
    } finally {
        if (connection) connection.release();
    }
};

const deleteUser = async (req, res) => {
    const { id } = req.params;
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        // 1. Eliminar sucursales
        await connection.query('DELETE FROM usuario_sucursal WHERE usuario_id = ?', [id]);
        
        // 2. Eliminar vínculos a empresas
        await connection.query('DELETE FROM usuario_empresa WHERE usuario_id = ?', [id]);
        
        // 3. Eliminar usuario
        const [result] = await connection.query('DELETE FROM users WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        await connection.commit();
        res.json({ message: 'Usuario eliminado correctamente' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ message: 'Error al eliminar usuario' });
    } finally {
        connection.release();
    }
};

const getConnectedSessions = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        const ownSessionId = req.user.session_id;

        const [sessions] = await pool.query(
            `SELECT us.id, us.user_id, us.branch_id, us.ip_address, us.user_agent, 
                    us.logged_in_at, us.last_heartbeat,
                    u.nombre, u.username,
                    b.nombre as branch_name
             FROM user_sessions us
             JOIN users u ON us.user_id = u.id
             LEFT JOIN branches b ON us.branch_id = b.id
             WHERE us.company_id = ? AND us.is_active = 1 
               AND us.last_heartbeat > NOW() - INTERVAL 2 MINUTE
             ORDER BY us.last_heartbeat DESC`,
            [companyId]
        );

        const rows = sessions.map(s => ({
            ...s,
            is_own_session: s.id === ownSessionId,
            elapsed_seconds: Math.floor((Date.now() - new Date(s.last_heartbeat).getTime()) / 1000)
        }));

        res.json({ sessions: rows });
    } catch (error) {
        console.error('Error getting connected sessions:', error);
        res.status(500).json({ message: 'Error al obtener sesiones conectadas' });
    }
};

const terminateSession = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.user.company_id;

        const [sessions] = await pool.query(
            `SELECT us.id FROM user_sessions us
             JOIN users u ON us.user_id = u.id
             WHERE us.id = ? AND us.company_id = ?`,
            [id, companyId]
        );

        if (sessions.length === 0) {
            return res.status(404).json({ message: 'Sesión no encontrada' });
        }

        await pool.query('UPDATE user_sessions SET is_active = 0 WHERE id = ?', [id]);
        res.json({ message: 'Sesión finalizada' });
    } catch (error) {
        console.error('Error terminating session:', error);
        res.status(500).json({ message: 'Error al finalizar sesión' });
    }
};

module.exports = { 
    getUsers, 
    createUser, 
    updateUser, 
    updateProfile, 
    getAllUsers, 
    assignCompanyAccess, 
    getAccessSummary, 
    deleteCompanyAccess,
    deleteUser,
    getConnectedSessions,
    terminateSession,
    getCompaniesWithBranchesTree,
    assignBulkAccess,
    cloneUserAccess,
    bulkUpdateRole,
    bulkDeleteAccess
};
