-- Migration v25: Accounting Module

-- Tipos de cuenta contable (Activo, Pasivo, Patrimonio, Ingreso, Gasto, etc.)
CREATE TABLE IF NOT EXISTS account_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    code VARCHAR(10) NOT NULL,
    name VARCHAR(100) NOT NULL,
    nature ENUM('debit', 'credit') NOT NULL DEFAULT 'debit', -- Naturaleza: deudora o acreedora
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Tipos de partida contable (Diario, Ingreso, Gasto, Apertura, Cierre, Ajuste)
CREATE TABLE IF NOT EXISTS entry_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    code VARCHAR(10) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Catálogo de cuentas contables
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    account_type_id INT NOT NULL,
    parent_id INT DEFAULT NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    allows_entries BOOLEAN DEFAULT TRUE, -- Si permite asientos directos (cuentas de detalle)
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (account_type_id) REFERENCES account_types(id) ON DELETE RESTRICT,
    FOREIGN KEY (parent_id) REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
    INDEX idx_parent (parent_id),
    INDEX idx_type (account_type_id)
);

-- Encabezado de partidas contables
CREATE TABLE IF NOT EXISTS accounting_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    branch_id INT,
    entry_type_id INT NOT NULL,
    number VARCHAR(30) NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    status ENUM('draft', 'posted', 'voided') DEFAULT 'draft',
    total_debit DECIMAL(14,2) DEFAULT 0,
    total_credit DECIMAL(14,2) DEFAULT 0,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (entry_type_id) REFERENCES entry_types(id) ON DELETE RESTRICT,
    INDEX idx_date (date),
    INDEX idx_status (status)
);

-- Líneas de partida contable (débito/crédito)
CREATE TABLE IF NOT EXISTS accounting_entry_lines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entry_id INT NOT NULL,
    account_id INT NOT NULL,
    description TEXT,
    debit DECIMAL(14,2) DEFAULT 0,
    credit DECIMAL(14,2) DEFAULT 0,
    FOREIGN KEY (entry_id) REFERENCES accounting_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    INDEX idx_entry (entry_id)
);

-- Seed: tipos de cuenta por defecto
INSERT INTO account_types (company_id, code, name, nature) VALUES 
(1, '1', 'Activo', 'debit'),
(1, '2', 'Pasivo', 'credit'),
(1, '3', 'Patrimonio', 'credit'),
(1, '4', 'Ingreso', 'credit'),
(1, '5', 'Costo', 'debit'),
(1, '6', 'Gasto', 'debit');

-- Seed: tipos de partida por defecto
INSERT INTO entry_types (company_id, code, name) VALUES 
(1, 'DIARIO', 'Partida Diaria'),
(1, 'INGRESO', 'Partida de Ingreso'),
(1, 'GASTO', 'Partida de Gasto'),
(1, 'APERTURA', 'Partida de Apertura'),
(1, 'CIERRE', 'Partida de Cierre'),
(1, 'AJUSTE', 'Partida de Ajuste');
