-- Migration v152: Módulo Trupput (prepago por galonaje)

-- 1. Flag de cliente Trupput
ALTER TABLE customers
  ADD COLUMN es_trupput BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Tabla maestra de clientes Trupput (recargas de galones)
CREATE TABLE IF NOT EXISTS gas_station_trupput (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  branch_id INT DEFAULT NULL,
  numero VARCHAR(7) NOT NULL DEFAULT '',
  fecha DATE NOT NULL,
  cliente_id INT DEFAULT NULL,
  cliente_nombre VARCHAR(255) NOT NULL DEFAULT '',
  galones DECIMAL(12,5) NOT NULL DEFAULT 0,
  precio DECIMAL(12,2) NOT NULL DEFAULT 0,
  monto DECIMAL(12,2) NOT NULL DEFAULT 0,
  galones_disponibles DECIMAL(12,5) NOT NULL DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (cliente_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabla detalle: despachos Trupput en cierre de lecturas
CREATE TABLE IF NOT EXISTS gas_station_closeout_trupput_despachos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  closeout_id INT NOT NULL,
  cliente_id INT DEFAULT NULL,
  cliente_nombre VARCHAR(255) NOT NULL DEFAULT '',
  documento VARCHAR(50) NOT NULL DEFAULT '',
  producto_codigo VARCHAR(50) NOT NULL DEFAULT '',
  producto_descripcion VARCHAR(255) NOT NULL DEFAULT '',
  despachador_id INT DEFAULT NULL,
  galones DECIMAL(12,5) NOT NULL DEFAULT 0,
  precio DECIMAL(12,2) NOT NULL DEFAULT 0,
  monto DECIMAL(12,2) NOT NULL DEFAULT 0,
  placa VARCHAR(20) DEFAULT '',
  kilometraje VARCHAR(20) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (closeout_id) REFERENCES gas_station_closeouts(id) ON DELETE CASCADE,
  FOREIGN KEY (cliente_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Marcar como Trupput clientes con recargas o despachos registrados
UPDATE customers c
SET c.es_trupput = TRUE
WHERE c.id IN (
  SELECT DISTINCT gt.cliente_id FROM gas_station_trupput gt WHERE gt.cliente_id IS NOT NULL
)
OR c.id IN (
  SELECT DISTINCT gtd.cliente_id FROM gas_station_closeout_trupput_despachos gtd WHERE gtd.cliente_id IS NOT NULL
);

-- 5. Agregar menú para el módulo Trupput (hijo de Gasolinera = id 75)
INSERT INTO menu_items (id, parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
VALUES (172, 75, 'Trupput (Galonaje)', '/gas-station/trupput', 'Fuel', 'manage_gas_trupput', 5, 1, 0)
ON DUPLICATE KEY UPDATE label = VALUES(label), path = VALUES(path), icon = VALUES(icon), permission_key = VALUES(permission_key), sort_order = VALUES(sort_order);

-- 6. Otorgar el permiso manage_gas_trupput a los roles que ya tienen manage_gas_advances
UPDATE roles
SET permissions =
  CASE
    WHEN permissions IS NULL OR permissions = '' OR permissions = '[]' THEN JSON_ARRAY('manage_gas_trupput')
    WHEN JSON_CONTAINS(permissions, JSON_QUOTE('manage_gas_trupput')) THEN permissions
    ELSE JSON_ARRAY_APPEND(permissions, '$', 'manage_gas_trupput')
  END
WHERE JSON_CONTAINS(permissions, JSON_QUOTE('manage_gas_advances'))
  AND NOT JSON_CONTAINS(permissions, JSON_QUOTE('manage_gas_trupput'));
