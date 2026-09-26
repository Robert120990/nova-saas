-- Migración v216: Módulo de Metas, Comisiones y Simulador con Tope de $1,000 para Vendedores de Huevo Industrial e Integración a Planilla RH

-- 1. Agregar columnas employee_id e is_egg_seller a la tabla sellers para vincular vendedor con empleado de nómina
SET @dbname = DATABASE();
SET @tablename = "sellers";
SET @columnname = "employee_id";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE sellers ADD COLUMN employee_id INT NULL AFTER pos_id, ADD CONSTRAINT fk_sellers_employee FOREIGN KEY (employee_id) REFERENCES rh_empleados(id) ON DELETE SET NULL;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = "is_egg_seller";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE sellers ADD COLUMN is_egg_seller TINYINT(1) NOT NULL DEFAULT 0 AFTER employee_id;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2. Agregar columna seller_id a egg_customer_orders para acreditar pedidos al vendedor
SET @tablename = "egg_customer_orders";
SET @columnname = "seller_id";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE egg_customer_orders ADD COLUMN seller_id INT NULL AFTER customer_branch_id, ADD CONSTRAINT fk_egg_orders_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE SET NULL;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 3. Tabla de Metas por Vendedor / Empleado
CREATE TABLE IF NOT EXISTS egg_seller_goals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    seller_id INT NOT NULL,
    employee_id INT NULL,
    period_year INT NOT NULL,
    period_month INT NOT NULL,
    target_volume_lbs DECIMAL(12,2) NOT NULL DEFAULT 60000.00,
    target_amount_usd DECIMAL(12,2) NOT NULL DEFAULT 78000.00,
    target_min_price_lb DECIMAL(6,4) NOT NULL DEFAULT 1.2500,
    commission_rate_per_lb DECIMAL(6,4) NOT NULL DEFAULT 0.0150,
    commission_cap_usd DECIMAL(10,2) NOT NULL DEFAULT 1000.00,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_egg_seller_goals_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_egg_seller_goals_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE,
    CONSTRAINT fk_egg_seller_goals_employee FOREIGN KEY (employee_id) REFERENCES rh_empleados(id) ON DELETE SET NULL,
    UNIQUE KEY uk_seller_goal_period (company_id, seller_id, period_year, period_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabla de Comisiones Liquidadas con Tope de $1,000 y Estado para Planilla
CREATE TABLE IF NOT EXISTS egg_seller_commissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    seller_id INT NOT NULL,
    employee_id INT NULL,
    period_year INT NOT NULL,
    period_month INT NOT NULL,
    quincena ENUM('primera', 'segunda', 'mensual') NOT NULL DEFAULT 'segunda',
    total_orders_count INT NOT NULL DEFAULT 0,
    total_lbs_delivered DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_sales_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    avg_price_per_lb DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
    commission_rate_used DECIMAL(6,4) NOT NULL DEFAULT 0.0150,
    raw_commission_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    capped_commission_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    is_capped TINYINT(1) NOT NULL DEFAULT 0,
    status ENUM('borrador', 'aprobado', 'transferido_planilla', 'pagado') NOT NULL DEFAULT 'borrador',
    transferred_to_planilla_id INT NULL,
    transferred_at DATETIME NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_egg_seller_comm_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_egg_seller_comm_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE,
    CONSTRAINT fk_egg_seller_comm_employee FOREIGN KEY (employee_id) REFERENCES rh_empleados(id) ON DELETE SET NULL,
    CONSTRAINT fk_egg_seller_comm_planilla FOREIGN KEY (transferred_to_planilla_id) REFERENCES rh_planillas(id) ON DELETE SET NULL,
    UNIQUE KEY uk_seller_comm_period (company_id, seller_id, period_year, period_month, quincena)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
