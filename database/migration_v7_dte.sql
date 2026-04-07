-- DTE Specific Tables
USE db_sistema_saas;

-- Certificates for companies
CREATE TABLE IF NOT EXISTS certificates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    nit VARCHAR(17) NOT NULL,
    password VARCHAR(255) NOT NULL,
    bundle LONGBLOB NOT NULL, -- The .p12 or .crt file
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY (company_id, nit)
);

-- DTE Records
CREATE TABLE IF NOT EXISTS dtes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_generacion VARCHAR(36) NOT NULL UNIQUE, -- UUID v4
    numero_control VARCHAR(31) NOT NULL UNIQUE,
    tipo_dte VARCHAR(2) NOT NULL, -- From cat_002
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    usuario_id INT NOT NULL,
    status ENUM('PENDING', 'VALIDATED', 'SIGNED', 'SENT', 'ACCEPTED', 'REJECTED', 'ERROR', 'CONTINGENCY') DEFAULT 'PENDING',
    ambiente ENUM('00', '01') DEFAULT '00', -- 00: Test, 01: Prod
    json_original JSON,
    json_firmado TEXT, -- The JWS string
    sello_recepcion VARCHAR(255),
    fh_procesamiento DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE
);

-- DTE Events (Audit Log)
CREATE TABLE IF NOT EXISTS dte_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dte_id INT NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- GENERATED, VALIDATED, SIGNED, TRANSMITTED, etc.
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dte_id) REFERENCES dtes(id) ON DELETE CASCADE
);

-- Hacienda Responses (Full Log)
CREATE TABLE IF NOT EXISTS dte_responses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dte_id INT NOT NULL,
    status_code INT,
    response_body JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dte_id) REFERENCES dtes(id) ON DELETE CASCADE
);

-- Transmission Queue
CREATE TABLE IF NOT EXISTS transmission_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dte_id INT NOT NULL,
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 5,
    next_attempt_at DATETIME,
    last_error TEXT,
    status ENUM('WAITING', 'PROCESSING', 'FAILED', 'COMPLETED') DEFAULT 'WAITING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (dte_id) REFERENCES dtes(id) ON DELETE CASCADE
);

-- DTE Errors (Standardized Validation Errors)
CREATE TABLE IF NOT EXISTS dte_errors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dte_id INT,
    codigo_error VARCHAR(20),
    mensaje_error TEXT,
    detalles JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dte_id) REFERENCES dtes(id) ON DELETE CASCADE
);
