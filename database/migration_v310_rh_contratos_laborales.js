const pool = require('../server/src/config/db');

async function migrate() {
    console.log('--- Migration v310: Creating rh_contratos_laborales, extending rh_config & registering menu item ---');

    // 1. Create rh_contratos_laborales table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS rh_contratos_laborales (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            empleado_id INT NULL,
            codigo VARCHAR(30) NOT NULL,
            trabajador_nombre VARCHAR(200) NOT NULL,
            fecha_nacimiento DATE NULL,
            edad INT NULL,
            sexo VARCHAR(30) DEFAULT 'MASCULINO',
            estado_civil VARCHAR(50) DEFAULT 'SOLTERO',
            profesion_oficio VARCHAR(150) DEFAULT 'ESTUDIANTE',
            direccion VARCHAR(255) NULL,
            nacionalidad VARCHAR(80) DEFAULT 'SALVADOREÑO',
            num_dui VARCHAR(20) NULL,
            dui_extendido_en VARCHAR(120) NULL,
            num_nit VARCHAR(25) NULL,
            num_isss VARCHAR(50) NULL,
            cargo_laboral VARCHAR(150) NOT NULL,
            obligaciones VARCHAR(255) NULL,
            lugar_trabajo VARCHAR(150) NULL,
            jefe_inmediato VARCHAR(150) NULL,
            plazo_contrato VARCHAR(100) DEFAULT 'TIEMPO INDEFINIDO',
            fecha_inicio DATE NULL,
            lugar_creacion VARCHAR(120) DEFAULT 'SAN SALVADOR',
            fecha_creacion DATE NOT NULL,
            salario_mensual DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
            lugar_pago VARCHAR(150) DEFAULT 'BANCO PROMERICA',
            forma_pago VARCHAR(120) DEFAULT 'TRANFERENCIA BANCARIA',
            horario_dia_inicio VARCHAR(30) DEFAULT 'LUNES',
            horario_dia_fin VARCHAR(30) DEFAULT 'VIERNES',
            horario_manana_desde VARCHAR(30) DEFAULT '8:00 A.M.',
            horario_manana_hasta VARCHAR(30) DEFAULT '12:00 P.M.',
            horario_tarde_desde VARCHAR(30) DEFAULT '1:00 P.M.',
            horario_tarde_hasta VARCHAR(30) DEFAULT '5:00 P.M.',
            horario_dia_extra VARCHAR(30) DEFAULT 'SABADO',
            horario_extra_desde VARCHAR(30) DEFAULT '8:00 A.M.',
            horario_extra_hasta VARCHAR(30) DEFAULT '12:00 P.M.',
            total_horas_semana INT DEFAULT 44,
            dependientes JSON NULL,
            patrono_nombre VARCHAR(200) NULL,
            patrono_edad INT NULL,
            patrono_sexo VARCHAR(30) DEFAULT 'MASCULINO',
            patrono_estado_civil VARCHAR(50) DEFAULT 'CASADO',
            patrono_profesion VARCHAR(150) DEFAULT 'ESTUDIANTE',
            patrono_direccion VARCHAR(255) NULL,
            patrono_nacionalidad VARCHAR(80) DEFAULT 'SALVADOREÑA',
            patrono_dui VARCHAR(20) NULL,
            patrono_dui_extendido VARCHAR(120) DEFAULT 'SAN SALVADOR',
            patrono_nit VARCHAR(25) NULL,
            herramientas_materiales TEXT NULL,
            otras_estipulaciones TEXT NULL,
            estado ENUM('vigente', 'finalizado', 'anulado') NOT NULL DEFAULT 'vigente',
            observaciones TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_rh_cl_company (company_id),
            INDEX idx_rh_cl_empleado (empleado_id),
            INDEX idx_rh_cl_fecha (fecha_creacion)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla rh_contratos_laborales creada/verificada.');

    // 2. Extend rh_config with Patrono default fields if not present
    const patronoCols = [
        { name: 'patrono_nombre', def: "VARCHAR(200) NULL DEFAULT ''" },
        { name: 'patrono_edad', def: 'INT NULL DEFAULT 58' },
        { name: 'patrono_sexo', def: "VARCHAR(30) NULL DEFAULT 'MASCULINO'" },
        { name: 'patrono_estado_civil', def: "VARCHAR(50) NULL DEFAULT 'CASADO'" },
        { name: 'patrono_profesion', def: "VARCHAR(150) NULL DEFAULT 'ESTUDIANTE'" },
        { name: 'patrono_direccion', def: "VARCHAR(255) NULL DEFAULT ''" },
        { name: 'patrono_nacionalidad', def: "VARCHAR(80) NULL DEFAULT 'SALVADOREÑA'" },
        { name: 'patrono_dui', def: "VARCHAR(20) NULL DEFAULT ''" },
        { name: 'patrono_dui_extendido', def: "VARCHAR(120) NULL DEFAULT 'SAN SALVADOR'" },
        { name: 'patrono_nit', def: "VARCHAR(25) NULL DEFAULT ''" }
    ];

    const [existingCfgCols] = await pool.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rh_config'
    `);
    const existingSet = new Set(existingCfgCols.map(c => c.COLUMN_NAME));

    for (const col of patronoCols) {
        if (!existingSet.has(col.name)) {
            await pool.query(`ALTER TABLE rh_config ADD COLUMN ${col.name} ${col.def}`);
        }
    }
    console.log('✅ Columnas de datos del patrono verificadas en rh_config.');

    // Populate default patrono data for company 2 (Raul Rafael Sosa Castellanos) & company 1
    await pool.query(`
        UPDATE rh_config
        SET patrono_nombre = CASE WHEN patrono_nombre IS NULL OR patrono_nombre = '' THEN 'RAUL RAFAEL SOSA CASTELLANOS' ELSE patrono_nombre END,
            patrono_edad = COALESCE(patrono_edad, 58),
            patrono_sexo = COALESCE(NULLIF(patrono_sexo, ''), 'MASCULINO'),
            patrono_estado_civil = COALESCE(NULLIF(patrono_estado_civil, ''), 'CASADO'),
            patrono_profesion = COALESCE(NULLIF(patrono_profesion, ''), 'ESTUDIANTE'),
            patrono_direccion = CASE WHEN patrono_direccion IS NULL OR patrono_direccion = '' THEN 'LOMAS DE SAN FRANCISCO 3a ETAPA AV. 3. # 9 B' ELSE patrono_direccion END,
            patrono_nacionalidad = COALESCE(NULLIF(patrono_nacionalidad, ''), 'SALVADOREÑA'),
            patrono_dui = CASE WHEN patrono_dui IS NULL OR patrono_dui = '' THEN '00497414-6' ELSE patrono_dui END,
            patrono_dui_extendido = COALESCE(NULLIF(patrono_dui_extendido, ''), 'SAN SALVADOR'),
            patrono_nit = CASE WHEN patrono_nit IS NULL OR patrono_nit = '' THEN '0614-140268-004-3' ELSE patrono_nit END
        WHERE company_id IN (1, 2)
    `);

    // 3. Seed sample contract from reference PDF if not already present
    const [existingContracts] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM rh_contratos_laborales WHERE company_id = 2`
    );
    if ((existingContracts[0]?.cnt || 0) === 0) {
        const [empRows] = await pool.query(
            `SELECT id FROM rh_empleados WHERE company_id = 2 AND num_dui = '02166258-2' LIMIT 1`
        );
        const empId = empRows.length > 0 ? empRows[0].id : null;
        const dependientesSample = JSON.stringify([
            {
                nombre: 'MIRIAN CRISTINA',
                apellido: 'HERNANDEZ',
                fecha_nacimiento: '1982-01-01',
                edad: 44,
                direccion: 'ATIQUIZAYA, CANTON EL ROBLE'
            }
        ]);

        await pool.query(
            `INSERT INTO rh_contratos_laborales (
                company_id, empleado_id, codigo, trabajador_nombre,
                fecha_nacimiento, edad, sexo, estado_civil, profesion_oficio,
                direccion, nacionalidad, num_dui, dui_extendido_en, num_nit, num_isss,
                cargo_laboral, obligaciones, lugar_trabajo, jefe_inmediato,
                plazo_contrato, fecha_inicio, lugar_creacion, fecha_creacion,
                salario_mensual, lugar_pago, forma_pago,
                horario_dia_inicio, horario_dia_fin,
                horario_manana_desde, horario_manana_hasta,
                horario_tarde_desde, horario_tarde_hasta,
                horario_dia_extra, horario_extra_desde, horario_extra_hasta,
                total_horas_semana, dependientes,
                patrono_nombre, patrono_edad, patrono_sexo, patrono_estado_civil,
                patrono_profesion, patrono_direccion, patrono_nacionalidad,
                patrono_dui, patrono_dui_extendido, patrono_nit,
                herramientas_materiales, otras_estipulaciones, estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                2, empId, 'CT-2025-0001', 'NELSON IVAN RIVERA HERNANDEZ',
                '1984-10-13', 42, 'MASCULINO', 'SOLTERO', 'ESTUDIANTE',
                'ATIQUIZAYA, CANTON EL ROBLE', 'SALVADOREÑO', '02166258-2', 'AHUACHAPAN', '0101-131084-104-3', '109840280',
                'AGENTE DE PISTA', 'ATENCION AL CLIENTE, ORDEN Y LIMPIEZA', 'SHELL CHALCHUAPA', 'OSCAR RUIZ',
                'TIEMPO INDEFINIDO', '2007-12-14', 'SAN SALVADOR', '2025-10-15',
                409.00, 'BANCO PROMERICA', 'TRANFERENCIA BANCARIA',
                'LUNES', 'VIERNES',
                '8:00 A.M.', '12:00 P.M.',
                '1:00 P.M.', '5:00 P.M.',
                'SABADO', '8:00 A.M.', '12:00 P.M.',
                44, dependientesSample,
                'RAUL RAFAEL SOSA CASTELLANOS', 58, 'MASCULINO', 'CASADO',
                'ESTUDIANTE', 'LOMAS DE SAN FRANCISCO 3a ETAPA AV. 3. # 9 B', 'SALVADOREÑA',
                '00497414-6', 'SAN SALVADOR', '0614-140268-004-3',
                'las herramientas y utensilios necesarios para el buen desempeño de sus funciones.',
                'CUANDO POR LA NATURALEZA DEL NEGOCIO TENGA QUE EL TRABAJAR EL DIA DOMINGO, SE SUSTITUIRA EL DIA DE DESCANDO SEMANAL POR CUALQUIER DIA DE LA SEMANA, PREVIO ACUERDO ENTRE AMBAS PARTES.',
                'vigente'
            ]
        );
        console.log('✅ Contrato de ejemplo (NELSON IVAN RIVERA HERNANDEZ) sembrado en company_id = 2.');
    }

    // 4. Register menu item under Recursos Humanos
    const [rhParent] = await pool.query(
        `SELECT id FROM menu_items WHERE label = 'Recursos Humanos' AND parent_id IS NULL LIMIT 1`
    );
    const parentId = rhParent.length > 0 ? rhParent[0].id : 94;

    const [existingMenu] = await pool.query(
        `SELECT id FROM menu_items WHERE path = '/rh/contratos-laborales' OR permission_key = 'manage_rh_contratos_laborales'`
    );

    if (existingMenu.length === 0) {
        await pool.query(
            `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
             VALUES (?, 'Contrato Laboral', '/rh/contratos-laborales', 'ScrollText', 'manage_rh_contratos_laborales', 3, 1, 0)`,
            [parentId]
        );
        console.log('✅ Opción "Contrato Laboral" agregada en menu_items.');
    } else {
        await pool.query(
            `UPDATE menu_items
             SET parent_id = ?, label = 'Contrato Laboral', path = '/rh/contratos-laborales',
                 icon = 'ScrollText', permission_key = 'manage_rh_contratos_laborales', is_active = 1, hide_in_menu = 0
             WHERE id = ?`,
            [parentId, existingMenu[0].id]
        );
        console.log('✅ Opción "Contrato Laboral" actualizada en menu_items.');
    }

    // 5. Grant permission to Admin/SuperAdmin and roles that have manage_rh_empleados or manage_rh_acciones_personal
    const [roles] = await pool.query(`SELECT id, name, permissions FROM roles`);
    for (const role of roles) {
        let perms = [];
        try {
            perms = typeof role.permissions === 'string' ? JSON.parse(role.permissions) : (role.permissions || []);
        } catch {
            perms = [];
        }
        if (!Array.isArray(perms)) perms = [];

        const isAdminRole = ['SuperAdmin', 'Admin', 'Administrador'].includes(role.name);
        const hasRhAccess = perms.includes('manage_rh_empleados') || perms.includes('manage_rh_acciones_personal') || perms.includes('manage_rh_planillas');

        if ((isAdminRole || hasRhAccess) && !perms.includes('manage_rh_contratos_laborales')) {
            perms.push('manage_rh_contratos_laborales');
            await pool.query(`UPDATE roles SET permissions = ? WHERE id = ?`, [JSON.stringify(perms), role.id]);
            console.log(`  → Permiso 'manage_rh_contratos_laborales' asignado al rol: ${role.name}`);
        }
    }

    console.log('--- Migration v310 completed successfully ---');
}

module.exports = migrate;

