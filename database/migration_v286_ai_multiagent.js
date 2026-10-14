const pool = require('../server/src/config/db');

async function up() {
    console.log('[Migration v286] Creando tablas para arquitectura multi-agente...');

    // 1. Tabla de agentes registrados
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ai_agents (
            id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(50) NOT NULL UNIQUE,
            name VARCHAR(100) NOT NULL,
            description TEXT NOT NULL,
            system_prompt_template TEXT NULL,
            required_permission VARCHAR(100) NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Tabla de sesiones conversacionales multi-turno
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ai_agent_sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            channel ENUM('web', 'telegram') NOT NULL,
            external_chat_id VARCHAR(100) NOT NULL,
            company_id INT NOT NULL,
            branch_id INT NULL,
            user_id INT NULL,
            active_agent_code VARCHAR(50) NOT NULL DEFAULT 'supervisor',
            last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_channel_chat (channel, external_chat_id),
            KEY idx_session_company (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. Tabla de mensajes de historial
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ai_agent_messages (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            session_id INT NOT NULL,
            role ENUM('user', 'assistant', 'system', 'tool') NOT NULL,
            agent_code VARCHAR(50) NOT NULL,
            content MEDIUMTEXT NULL,
            tool_calls JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES ai_agent_sessions(id) ON DELETE CASCADE,
            KEY idx_msg_session (session_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Tabla de auditoría y Human-in-the-Loop
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ai_agent_actions_audit (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            session_id INT NULL,
            company_id INT NOT NULL,
            branch_id INT NULL,
            agent_code VARCHAR(50) NOT NULL,
            action_type VARCHAR(100) NOT NULL,
            description VARCHAR(255) NOT NULL DEFAULT '',
            payload JSON NOT NULL,
            status ENUM('pending_approval', 'approved', 'rejected', 'executed', 'failed') NOT NULL DEFAULT 'pending_approval',
            approved_by_user_id INT NULL,
            approved_via ENUM('telegram', 'web') NULL,
            execution_result JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            executed_at TIMESTAMP NULL,
            KEY idx_audit_status (status),
            KEY idx_audit_company (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. Sembrar catálogo base de 7 agentes
    const defaultAgents = [
        {
            code: 'supervisor',
            name: 'Supervisor de Inteligencia de Negocios',
            description: 'Orquesta y delega solicitudes hacia los agentes especializados según la intención y permisos.',
            required_permission: null
        },
        {
            code: 'accounting',
            name: 'Contador General (CPA)',
            description: 'Generación de partidas contables automáticas (ventas, compras, cxc, cxp) e independientes (ajustes, depreciaciones).',
            required_permission: 'manage_accounting_entries'
        },
        {
            code: 'dte',
            name: 'Especialista Fiscal & DTE',
            description: 'Normativa de Facturación Electrónica de El Salvador (SVFE), eventos de invalidación, contingencia y diagnósticos MH.',
            required_permission: 'view_sales_dte'
        },
        {
            code: 'sales',
            name: 'Especialista Comercial & Ventas',
            description: 'Seguimiento de ventas, ticket promedio, comparativas, cortes de caja y detección de ventas atípicas.',
            required_permission: 'view_sales_reports'
        },
        {
            code: 'inventory',
            name: 'Especialista de Inventario & Kardex',
            description: 'Existencias físicas, productos bajo stock mínimo, rotación de kardex y valoración de inventario.',
            required_permission: 'view_inventory'
        },
        {
            code: 'gas',
            name: 'Especialista en Combustibles & Pista',
            description: 'Niveles de tanques, cierres de turno de gasolinera, lecturas de bombas y solicitudes de reapertura.',
            required_permission: 'view_gas_closeouts'
        },
        {
            code: 'operations',
            name: 'Agente de Operaciones & Automatización',
            description: 'Ejecución de acciones operativas aprobadas por supervisores (HitL) y monitoreo en segundo plano.',
            required_permission: null
        }
    ];

    for (const agent of defaultAgents) {
        await pool.query(`
            INSERT INTO ai_agents (code, name, description, required_permission)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                description = VALUES(description),
                required_permission = VALUES(required_permission)
        `, [agent.code, agent.name, agent.description, agent.required_permission]);
    }

    console.log('[Migration v286] Migración completada exitosamente.');
}

module.exports = { up };
