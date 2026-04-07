-- Migration: V6 Multi-Tenant Refactor
-- Run this on db_sistema_saas

-- 1. Create new tables
CREATE TABLE IF NOT EXISTS usuario_empresa (
    usuario_id INT NOT NULL,
    empresa_id INT NOT NULL,
    role_id INT NOT NULL,
    has_access BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, empresa_id),
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (empresa_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS usuario_sucursal (
    usuario_id INT NOT NULL,
    sucursal_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, sucursal_id),
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (sucursal_id) REFERENCES branches(id) ON DELETE CASCADE
);

-- 2. Migrate basic user access (from users table)
INSERT IGNORE INTO usuario_empresa (usuario_id, empresa_id, role_id)
SELECT id, company_id, role_id FROM users;

-- 3. Migrate specific branch access (from user_access table)
-- If branch_id was specified, insert it.
INSERT IGNORE INTO usuario_sucursal (usuario_id, sucursal_id)
SELECT user_id, branch_id FROM user_access WHERE branch_id IS NOT NULL;

-- If branch_id was NULL (ALL branches), insert all branches of that company for that user
INSERT IGNORE INTO usuario_sucursal (usuario_id, sucursal_id)
SELECT ua.user_id, b.id 
FROM user_access ua
JOIN branches b ON ua.company_id = b.company_id
WHERE ua.branch_id IS NULL;

-- 4. Clean up old structures
-- Remove foreign keys first (need to know their names, usually they are generated)
-- Or just drop and recreate if needed? No, let's just drop columns if possible.

ALTER TABLE users DROP FOREIGN KEY users_ibfk_1; -- Assuming standard naming
ALTER TABLE users DROP FOREIGN KEY users_ibfk_2;
ALTER TABLE users DROP COLUMN company_id;
ALTER TABLE users DROP COLUMN role_id;

ALTER TABLE roles DROP FOREIGN KEY roles_ibfk_1;
ALTER TABLE roles DROP COLUMN company_id;

-- Drop old user_access table
DROP TABLE IF EXISTS user_access;
