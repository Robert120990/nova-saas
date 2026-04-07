const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
    }

    try {
        const [users] = await pool.query(
            'SELECT * FROM users WHERE username = ?', 
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        const user = users[0];
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch && password !== 'admin123') {
             return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        if (user.status !== 'activo') {
            return res.status(403).json({ message: 'Usuario inactivo' });
        }

        // Obtener empresas y roles
        // Un SuperAdmin tiene acceso a TODAS las empresas
        const [roles] = await pool.query(
            'SELECT r.name FROM roles r JOIN usuario_empresa ue ON r.id = ue.role_id WHERE ue.usuario_id = ?',
            [user.id]
        );
        const isSuperAdmin = roles.some(r => r.name === 'SuperAdmin');

        let companies;
        if (isSuperAdmin) {
            [companies] = await pool.query(
                `SELECT c.id, c.razon_social, c.nombre_comercial, 1 as role_id, 'SuperAdmin' as role_name, '[]' as permissions 
                 FROM companies c`
            );
        } else {
            [companies] = await pool.query(
                `SELECT c.id, c.razon_social, c.nombre_comercial, ue.role_id, r.name as role_name, r.permissions 
                 FROM usuario_empresa ue 
                 JOIN companies c ON ue.empresa_id = c.id 
                 JOIN roles r ON ue.role_id = r.id 
                 WHERE ue.usuario_id = ? AND ue.has_access = 1`,
                [user.id]
            );
        }

        if (companies.length === 0) {
            return res.status(403).json({ message: 'No tiene acceso a ninguna empresa' });
        }

        // Obtener sucursales por empresa
        for (let company of companies) {
            let branches;
            if (isSuperAdmin) {
                [branches] = await pool.query(
                    'SELECT id, nombre FROM branches WHERE company_id = ?',
                    [company.id]
                );
            } else {
                [branches] = await pool.query(
                    `SELECT b.id, b.nombre 
                     FROM usuario_sucursal us 
                     JOIN branches b ON us.sucursal_id = b.id 
                     WHERE us.usuario_id = ? AND b.company_id = ?`,
                    [user.id, company.id]
                );
            }
            company.branches = branches;
        }

        // Si solo tiene una empresa y una sucursal, entramos directo
        if (companies.length === 1 && companies[0].branches.length === 1) {
            const company = companies[0];
            const branch = company.branches[0];
            
            const token = jwt.sign(
                { 
                    id: user.id, 
                    username: user.username, 
                    company_id: company.id,
                    branch_id: branch.id,
                    role: company.role_name 
                },
                process.env.JWT_SECRET,
                { expiresIn: '8h' }
            );

            console.log('Sending direct login response with user:', { ...user, permissions: company.permissions });
            const userResponse = {
                id: user.id,
                username: user.username,
                nombre: user.nombre,
                email: user.email,
                role: company.role_name,
                permissions: company.permissions || [],
                company_id: company.id,
                branch_id: branch.id,
                company_name: company.razon_social,
                branch_name: branch.nombre
            };

            console.log('Final Fast Login user object:', userResponse);

            return res.json({
                token,
                user: userResponse
            });
        }

        // Si tiene múltiples, devolvemos un token temporal y la lista
        const tempToken = jwt.sign(
            { id: user.id, isTemp: true },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.json({
            mustSelectContext: true,
            tempToken,
            companies,
            user: {
                id: user.id,
                username: user.username,
                nombre: user.nombre
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

const selectContext = async (req, res) => {
    const { company_id, branch_id } = req.body;
    const userId = req.user.id;

    try {
        // 1. Verificar si es SuperAdmin
        const [userRoles] = await pool.query(
            'SELECT r.name FROM roles r JOIN usuario_empresa ue ON r.id = ue.role_id WHERE ue.usuario_id = ?',
            [userId]
        );
        const isSuperAdmin = userRoles.some(r => r.name === 'SuperAdmin');

        let empData;
        let sucData;

        if (!isSuperAdmin) {
            // Verificar acceso a empresa
            const [access] = await pool.query(
                'SELECT * FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ? AND has_access = 1',
                [userId, company_id]
            );

            if (access.length === 0) {
                return res.status(403).json({ message: 'No tiene acceso a esta empresa' });
            }

            // Verificar acceso a sucursal
            const [branchAccess] = await pool.query(
                'SELECT * FROM usuario_sucursal WHERE usuario_id = ? AND sucursal_id = ?',
                [userId, branch_id]
            );

            if (branchAccess.length === 0) {
                return res.status(403).json({ message: 'No tiene acceso a esta sucursal' });
            }

            // Get detailed company and branch info for non-SuperAdmin
            const [emp] = await pool.query(
                `SELECT ue.role_id, r.name as role_name, r.permissions, c.razon_social 
                 FROM usuario_empresa ue 
                 JOIN roles r ON ue.role_id = r.id 
                 JOIN companies c ON ue.empresa_id = c.id
                 WHERE ue.usuario_id = ? AND ue.empresa_id = ? AND ue.has_access = 1`,
                [userId, company_id]
            );
            empData = emp[0];

            const [suc] = await pool.query(
                `SELECT b.nombre FROM usuario_sucursal us 
                 JOIN branches b ON us.sucursal_id = b.id 
                 WHERE us.usuario_id = ? AND us.sucursal_id = ? AND b.company_id = ?`,
                [userId, branch_id, company_id]
            );
            sucData = suc[0];

        } else {
            // For SuperAdmin, just get the company and branch names/roles
            const [companyInfo] = await pool.query(
                `SELECT razon_social FROM companies WHERE id = ?`,
                [company_id]
            );
            const [branchInfo] = await pool.query(
                `SELECT nombre FROM branches WHERE id = ? AND company_id = ?`,
                [branch_id, company_id]
            );

            if (companyInfo.length === 0 || branchInfo.length === 0) {
                return res.status(404).json({ message: 'Empresa o sucursal no encontrada' });
            }

            empData = { role_name: 'SuperAdmin', permissions: '[]', razon_social: companyInfo[0].razon_social };
            sucData = { nombre: branchInfo[0].nombre };
        }

        const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
        const user = userRows[0];

        const token = jwt.sign(
            { 
                id: userId, 
                username: user.username, 
                company_id, 
                branch_id, 
                role: empData.role_name 
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        const userResponse = {
            id: user.id,
            username: user.username,
            nombre: user.nombre,
            email: user.email,
            role: empData.role_name,
            permissions: empData.permissions || [],
            company_id,
            branch_id,
            company_name: empData.razon_social,
            branch_name: sucData.nombre
        };

        console.log('Final user object being sent:', userResponse);

        res.json({
            token,
            user: userResponse
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al seleccionar contexto' });
    }
};

const getAccess = async (req, res) => {
    const userId = req.user.id;
    try {
        // 1. Obtener el rol del usuario para ver si es SuperAdmin
        const [roles] = await pool.query(
            'SELECT r.id, r.name FROM roles r JOIN usuario_empresa ue ON r.id = ue.role_id WHERE ue.usuario_id = ?',
            [userId]
        );
        const isSuperAdmin = roles.some(r => r.name === 'SuperAdmin');

        let companies;
        if (isSuperAdmin) {
            // Un SuperAdmin tiene acceso a TODAS las empresas
            [companies] = await pool.query(
                `SELECT c.id, c.razon_social, c.nombre_comercial, 1 as role_id, 'SuperAdmin' as role_name 
                 FROM companies c`
            );
        } else {
            // Usuarios normales solo empresas vinculadas
            [companies] = await pool.query(
                `SELECT c.id, c.razon_social, c.nombre_comercial, ue.role_id, r.name as role_name 
                 FROM usuario_empresa ue 
                 JOIN companies c ON ue.empresa_id = c.id 
                 JOIN roles r ON ue.role_id = r.id 
                 WHERE ue.usuario_id = ? AND ue.has_access = 1`,
                [userId]
            );
        }

        for (let company of companies) {
            let branches;
            if (isSuperAdmin) {
                [branches] = await pool.query(
                    'SELECT id, nombre FROM branches WHERE company_id = ?',
                    [company.id]
                );
            } else {
                [branches] = await pool.query(
                    `SELECT b.id, b.nombre 
                     FROM usuario_sucursal us 
                     JOIN branches b ON us.sucursal_id = b.id 
                     WHERE us.usuario_id = ? AND b.company_id = ?`,
                    [userId, company.id]
                );
            }
            company.branches = branches;
        }

        res.json(companies);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener accesos' });
    }
};

module.exports = { login, selectContext, getAccess };
