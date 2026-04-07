-- Migración V12: Módulo de Gastos (Expenses)

-- 1. Catálogo de Tipos de Gasto
CREATE TABLE IF NOT EXISTS cat_expense_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 2. Cabecera de Gastos
CREATE TABLE IF NOT EXISTS expense_headers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    usuario_id INT NOT NULL,
    provider_id INT NOT NULL,
    fecha DATE NOT NULL,
    numero_documento VARCHAR(50) NOT NULL,
    tipo_documento_id VARCHAR(10) NOT NULL,
    condicion_operacion_id VARCHAR(10) NOT NULL,
    observaciones TEXT,
    total_nosujeta DECIMAL(18, 6) DEFAULT 0,
    total_exenta DECIMAL(18, 6) DEFAULT 0,
    total_gravada DECIMAL(18, 6) DEFAULT 0,
    iva DECIMAL(18, 6) DEFAULT 0,
    retencion DECIMAL(18, 6) DEFAULT 0,
    percepcion DECIMAL(18, 6) DEFAULT 0,
    fovial DECIMAL(18, 6) DEFAULT 0,
    cotrans DECIMAL(18, 6) DEFAULT 0,
    monto_total DECIMAL(18, 6) NOT NULL,
    status ENUM('ACTIVO', 'ANULADO') DEFAULT 'ACTIVO',
    period_year INT,
    period_month INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Detalle de Gastos
CREATE TABLE IF NOT EXISTS expense_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    expense_id INT NOT NULL,
    concept VARCHAR(255) NOT NULL,
    expense_type_id INT,
    cantidad DECIMAL(18, 6) DEFAULT 1,
    precio_unitario DECIMAL(18, 6) NOT NULL,
    tipo_operacion INT DEFAULT 1 COMMENT '1: GRAVADA, 2: EXENTA, 3: NO SUJETA',
    total DECIMAL(18, 6) NOT NULL,
    FOREIGN KEY (expense_id) REFERENCES expense_headers(id) ON DELETE CASCADE,
    FOREIGN KEY (expense_type_id) REFERENCES cat_expense_types(id) ON DELETE SET NULL
);

-- 4. Sembrar tipos de gasto por defecto (Para la empresa demo o como referencia inicial)
-- Nota: La lógica de la aplicación debería permitir crear estos por empresa.
-- Pero para el inicio, insertamos algunos básicos si existen empresas.
INSERT INTO cat_expense_types (company_id, name, description) 
SELECT id, 'Administración', 'Gastos administrativos generales' FROM companies;
INSERT INTO cat_expense_types (company_id, name, description) 
SELECT id, 'Ventas', 'Gastos relacionados a ventas' FROM companies;
INSERT INTO cat_expense_types (company_id, name, description) 
SELECT id, 'Financieros', 'Gastos bancarios o financieros' FROM companies;
INSERT INTO cat_expense_types (company_id, name, description) 
SELECT id, 'Otros', 'Gastos diversos' FROM companies;
