const pool = require('../config/db');
const bcrypt = require('bcryptjs');

const getUsers = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const companyId = req.user?.company_id || null;

        let query = `
            SELECT u.id, u.username, u.nombre, u.email, u.status, ue.role_id, r.name as role_name 
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
    const { username, password, nombre, email, role_id, branches } = req.body;
    const companyId = req.user.company_id;
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
            const [userResult] = await connection.query(
                'INSERT INTO users (username, password, nombre, email) VALUES (?, ?, ?, ?)',
                [username, hashedPassword, nombre, email]
            );
            userId = userResult.insertId;
        }


        await connection.commit();
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
    const { username, nombre, email, role_id, status, branches, password } = req.body;
    const companyId = req.user.company_id;
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const updates = [];
        const params = [];

        if (username !== undefined) { updates.push('username = ?'); params.push(username); }
        if (nombre !== undefined) { updates.push('nombre = ?'); params.push(nombre); }
        if (email !== undefined) { updates.push('email = ?'); params.push(email); }
        if (status !== undefined) { updates.push('status = ?'); params.push(status); }

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
             WHERE ue.has_access = 1`
        );

        const summary = await Promise.all(accesses.map(async (acc) => {
            const [branches] = await pool.query(
                `SELECT b.id, b.nombre 
                 FROM usuario_sucursal us
                 JOIN branches b ON us.sucursal_id = b.id
                 WHERE us.usuario_id = ? AND b.company_id = ?`,
                [acc.user_id, acc.company_id]
            );
            return { ...acc, branches: branches.map(b => ({ id: b.id, nombre: b.nombre })) };
        }));

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

module.exports = { 
    getUsers, 
    createUser, 
    updateUser, 
    updateProfile, 
    getAllUsers, 
    assignCompanyAccess, 
    getAccessSummary, 
    deleteCompanyAccess,
    deleteUser
};
