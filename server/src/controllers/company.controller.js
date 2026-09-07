const pool = require('../config/db');
const path = require('path');
const fs = require('fs');
const notificationService = require('../services/notification.service');

const getCompanies = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT c.*, 
                   d.description AS departamento_nombre,
                   m.description AS municipio_nombre,
                   dist.description AS distrito_nombre,
                   a.description AS actividad_nombre,
                   env.description AS ambiente_nombre,
                   tp.description AS tipo_persona_nombre
            FROM companies c
            LEFT JOIN cat_012_departamento d ON c.departamento = d.code
            LEFT JOIN cat_013_municipio m ON c.municipio = m.code AND c.departamento = m.dep_code
            LEFT JOIN cat_008_distrito dist ON c.distrito = dist.code AND c.departamento = dist.dep_code
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
        'direccion', 'departamento', 'municipio', 'distrito', 'correo', 'telefono', 
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
        const duiRegex = /^\d{8}-\d{1}$/;
        if (!nitRegex.test(data.nit) && !duiRegex.test(data.nit)) {
            return res.status(400).json({ message: 'Formato de NIT o DUI inválido' });
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
        notificationService.notify('company_created', companyId, null, {
            empresa_id: companyId,
            razon_social: data.razon_social || '',
            nit: data.nit || '',
            usuario_creador: req.user?.nombre || ''
        }).catch(() => {});
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
        'direccion', 'departamento', 'municipio', 'distrito', 'correo', 'telefono', 
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
        const duiRegex = /^\d{8}-\d{1}$/;
        if (!nitRegex.test(data.nit) && !duiRegex.test(data.nit)) {
            return res.status(400).json({ message: 'Formato de NIT o DUI inválido' });
        }
    }

    handleFileUploads(req, data);

    if (req.body.remove_logo === '1' && !req.files?.logo) {
        const [current] = await pool.query('SELECT logo_url FROM companies WHERE id = ?', [id]);
        if (current.length > 0 && current[0].logo_url) {
            const oldPath = path.join(process.cwd(), current[0].logo_url);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        data.logo_url = null;
    }

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

const AVAILABLE_MODULES = [
    { id: 'sales', name: 'Ventas y Facturación DTE', category: 'Core', icon: 'Receipt', description: 'Terminal punto de venta, facturación electrónica MH, cotizaciones y caja' },
    { id: 'purchases', name: 'Compras y Proveedores', category: 'Core', icon: 'ShoppingBag', description: 'Registro de compras DTE, retenciones, gastos y cuentas por pagar' },
    { id: 'inventory', name: 'Inventario y Kardex', category: 'Core', icon: 'Package', description: 'Control de existencias, traslados, ajustes y valoración física' },
    { id: 'gas_station', name: 'Estación de Servicio / Gasolinera', category: 'Verticales', icon: 'Fuel', description: 'Cierre de turnos, lecturas de bombas, tanques, despachadores y trupput' },
    { id: 'pozo', name: 'Pozo de Agua / Cisternas', category: 'Verticales', icon: 'Droplets', description: 'Despacho de pipas de agua, cortes de pozo y entregas de efectivo' },
    { id: 'egg_industrial', name: 'Huevo Industrial (Ovoproductos)', category: 'Verticales', icon: 'Sparkles', description: 'Recepción MP, pasteurización, silos, empaque, formulación y SCADA' },
    { id: 'crm', name: 'CRM (Acuerdos Comerciales)', category: 'Comercial', icon: 'Handshake', description: 'Gestión de precios pactados con clientes, volúmenes y contratos' },
    { id: 'accounting', name: 'Contabilidad Formal', category: 'Finanzas', icon: 'BookOpen', description: 'Catálogo de cuentas, partidas, correlativos y reportes financieros' },
    { id: 'human_resources', name: 'Recursos Humanos y Planillas', category: 'Gestión', icon: 'Users', description: 'Expedientes de empleados, cálculo de planillas, ISSS, AFP y renta' }
];

const getCompanyModulesMatrix = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT id, nit, nrc, razon_social, nombre_comercial, codigo_actividad, logo_url, enabled_modules
            FROM companies
            ORDER BY id ASC
        `);

        const formatted = rows.map(c => {
            let modules = [];
            try {
                modules = typeof c.enabled_modules === 'string' ? JSON.parse(c.enabled_modules) : (c.enabled_modules || []);
            } catch (e) {
                modules = [];
            }
            if (!Array.isArray(modules)) modules = [];
            return {
                ...c,
                enabled_modules: modules
            };
        });

        res.json({
            available_modules: AVAILABLE_MODULES,
            companies: formatted
        });
    } catch (error) {
        console.error('Error al obtener matriz de módulos por empresa:', error);
        res.status(500).json({ message: 'Error interno al consultar módulos de empresas' });
    }
};

const updateCompanyModules = async (req, res) => {
    try {
        const { id } = req.params;
        const { modules } = req.body;

        if (!Array.isArray(modules)) {
            return res.status(400).json({ message: 'El formato de módulos debe ser un array' });
        }

        await pool.query(
            'UPDATE companies SET enabled_modules = ? WHERE id = ?',
            [JSON.stringify(modules), id]
        );

        res.json({
            message: 'Módulos actualizados exitosamente para la empresa',
            company_id: parseInt(id, 10),
            enabled_modules: modules
        });
    } catch (error) {
        console.error('Error al actualizar módulos de empresa:', error);
        res.status(500).json({ message: 'Error interno al actualizar módulos' });
    }
};

module.exports = { 
    getCompanies, 
    createCompany, 
    updateCompany, 
    deleteCompany,
    getCompanyModulesMatrix,
    updateCompanyModules
};

