const pool = require('../config/db');
const path = require('path');
const fs = require('fs');

const getCompanies = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT c.*, 
                   d.description AS departamento_nombre,
                   m.description AS municipio_nombre,
                   a.description AS actividad_nombre,
                   env.description AS ambiente_nombre,
                   tp.description AS tipo_persona_nombre
            FROM companies c
            LEFT JOIN cat_012_departamento d ON c.departamento = d.code
            LEFT JOIN cat_013_municipio m ON c.municipio = m.code AND c.departamento = m.dep_code
            LEFT JOIN cat_019_actividad_economica a ON c.codigo_actividad = a.code
            LEFT JOIN cat_001_ambiente env ON c.ambiente = env.code
            LEFT JOIN cat_029_tipo_persona tp ON c.tipo_persona = tp.code
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener empresas' });
    }
};

const handleFileUploads = (req, data) => {
    if (!req.files) return;

    const nit = (req.body.nit || 'temp').replace(/-/g, '');

    // 1. Logo
    if (req.files.logo) {
        data.logo_url = '/uploads/' + req.files.logo[0].filename;
    }

    // 2. Certificado P12/PFX
    if (req.files.certificate) {
        const file = req.files.certificate[0];
        const newFilename = nit + path.extname(file.originalname);
        const destDir = path.join(process.cwd(), 'certificados-p12pfx');
        const newPath = path.join(destDir, newFilename);
        
        if (fs.existsSync(file.path)) {
            fs.renameSync(file.path, newPath);
            data.certificate_path = newPath;
        }
    }

    // 3. Certificado CRT
    if (req.files.certificate_crt) {
        const file = req.files.certificate_crt[0];
        const newFilename = nit + path.extname(file.originalname);
        const destDir = path.join(process.cwd(), 'certificados-crt');
        const newPath = path.join(destDir, newFilename);
        
        if (fs.existsSync(file.path)) {
            fs.renameSync(file.path, newPath);
            data.certificate_crt_path = newPath;
        }
    }
};

const createCompany = async (req, res) => {
    const validColumns = [
        'nit', 'nrc', 'razon_social', 'nombre_comercial', 'codigo_actividad', 
        'direccion', 'departamento', 'municipio', 'correo', 'telefono', 
        'tipo_persona', 'tipo_contribuyente', 'api_user', 'api_password', 
        'ambiente', 'logo_url', 'certificate_path', 'certificate_password', 
        'clave_privada', 'certificate_crt_path', 'dte_active'
    ];
    
    const data = {};
    Object.keys(req.body).forEach(key => {
        if (validColumns.includes(key)) {
            let val = req.body[key];
            if ((key === 'nit' || key === 'nrc') && typeof val === 'string') {
                val = val.trim();
            }
            data[key] = val === '' ? null : val;
        }
    });

    if (data.nit) {
        const nitRegex = /^\d{4}-\d{6}-\d{3}-\d{1}$/;
        if (!nitRegex.test(data.nit)) {
            return res.status(400).json({ message: 'Formato de NIT inválido (0000-000000-000-0)' });
        }
    }

    handleFileUploads(req, data);

    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const [result] = await connection.query('INSERT INTO companies SET ?', [data]);
        const companyId = result.insertId;

        // 1. Vincular al creador con el rol de SuperAdmin
        if (req.user && req.user.id) {
            await connection.query(
                'INSERT INTO usuario_empresa (usuario_id, empresa_id, role_id) VALUES (?, ?, ?)',
                [req.user.id, companyId, 1]
            );
        }

        // 2. Crear sucursal por defecto
        const [branchResult] = await connection.query(
            'INSERT INTO branches (company_id, codigo, nombre, direccion, tipo_establecimiento, es_casa_matriz) VALUES (?, ?, ?, ?, ?, ?)',
            [companyId, '0001', 'Sede Central', 'Dirección a definir', '01', 1]
        );
        const branchId = branchResult.insertId;

        // 3. Vincular al creador a la sucursal por defecto
        if (req.user && req.user.id) {
            await connection.query(
                'INSERT INTO usuario_sucursal (usuario_id, sucursal_id) VALUES (?, ?)',
                [req.user.id, branchId]
            );
        }

        await connection.commit();
        res.status(201).json({ id: companyId, ...data });
    } catch (error) {
        await connection.rollback();
        console.error('Error al crear empresa:', error.message);
        res.status(500).json({ message: 'Error al crear empresa' });
    } finally {
        connection.release();
    }
};

const updateCompany = async (req, res) => {
    const { id } = req.params;
    const validColumns = [
        'nit', 'nrc', 'razon_social', 'nombre_comercial', 'codigo_actividad', 
        'direccion', 'departamento', 'municipio', 'correo', 'telefono', 
        'tipo_persona', 'tipo_contribuyente', 'api_user', 'api_password', 
        'ambiente', 'logo_url', 'certificate_path', 'certificate_password', 
        'clave_privada', 'certificate_crt_path', 'dte_active'
    ];
    
    const data = {};
    Object.keys(req.body).forEach(key => {
        if (validColumns.includes(key)) {
            let val = req.body[key];
            if ((key === 'nit' || key === 'nrc') && typeof val === 'string') {
                val = val.trim();
            }
            data[key] = val === '' ? null : val;
        }
    });

    if (data.nit) {
        const nitRegex = /^\d{4}-\d{6}-\d{3}-\d{1}$/;
        if (!nitRegex.test(data.nit)) {
            return res.status(400).json({ message: 'Formato de NIT inválido (0000-000000-000-0)' });
        }
    }

    handleFileUploads(req, data);

    try {
        await pool.query('UPDATE companies SET ? WHERE id = ?', [data, id]);
        res.json({ message: 'Empresa actualizada' });
    } catch (error) {
        console.error('Error al actualizar empresa:', error.message);
        res.status(500).json({ message: 'Error al actualizar empresa' });
    }
};

const deleteCompany = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM companies WHERE id = ?', [id]);
        res.json({ message: 'Empresa eliminada' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar empresa' });
    }
};

module.exports = { getCompanies, createCompany, updateCompany, deleteCompany };
