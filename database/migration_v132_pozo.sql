-- Migration v132: Control de Pozo - Servicios, Despachos y Cortes

CREATE TABLE IF NOT EXISTS pozo_servicios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    branch_id INT NOT NULL DEFAULT 0,
    codigo VARCHAR(50) NOT NULL,
    descripcion VARCHAR(255) NOT NULL DEFAULT '',
    monto DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pozo_servicios (company_id, branch_id, codigo),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pozo_despachos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    branch_id INT NOT NULL DEFAULT 0,
    numero VARCHAR(50) NOT NULL DEFAULT '',
    fecha DATE NOT NULL,
    encargado VARCHAR(255) NOT NULL DEFAULT '',
    cliente VARCHAR(255) NOT NULL DEFAULT '',
    placa VARCHAR(50) NOT NULL DEFAULT '',
    hora_entrada TIME NULL,
    hora_salida TIME NULL,
    odometro_inicial INT NULL,
    odometro_final INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_pozo_despachos_fecha (company_id, branch_id, fecha),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pozo_despacho_servicios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    despacho_id INT NOT NULL,
    servicio_id INT NULL,
    cantidad DECIMAL(10,2) NOT NULL DEFAULT 1,
    monto DECIMAL(12,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (despacho_id) REFERENCES pozo_despachos(id) ON DELETE CASCADE,
    FOREIGN KEY (servicio_id) REFERENCES pozo_servicios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pozo_cortes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    branch_id INT NOT NULL DEFAULT 0,
    fecha DATE NOT NULL,
    encargado VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pozo_cortes (company_id, branch_id, fecha),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pozo_corte_gastos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    corte_id INT NOT NULL,
    descripcion VARCHAR(255) NOT NULL DEFAULT '',
    monto DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (corte_id) REFERENCES pozo_cortes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
