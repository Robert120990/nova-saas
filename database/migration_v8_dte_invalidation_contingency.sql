-- DTE Invalidation and Contingency Tables
USE db_sistema_saas;

-- Update DTE statuses
ALTER TABLE dtes MODIFY COLUMN status ENUM(
    'PENDING', 
    'VALIDATED', 
    'SIGNED', 
    'SENT', 
    'ACCEPTED', 
    'REJECTED', 
    'ERROR', 
    'INVALIDADO', 
    'CONTINGENCIA_PENDIENTE', 
    'RETRANSMITIDO'
) DEFAULT 'PENDING';

-- DTE Invalidation Events
CREATE TABLE IF NOT EXISTS dte_invalidations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_generacion_dte VARCHAR(36) NOT NULL,
    tipo_documento VARCHAR(2) NOT NULL,
    motivo VARCHAR(2) NOT NULL, -- CAT-024
    descripcion TEXT,
    estado ENUM('PENDING', 'SIGNED', 'SENT', 'ACCEPTED', 'REJECTED', 'ERROR') DEFAULT 'PENDING',
    json_enviado JSON,
    json_firmado TEXT,
    respuesta_hacienda JSON,
    fecha_envio DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (codigo_generacion_dte) REFERENCES dtes(codigo_generacion) ON DELETE CASCADE
);

-- Contingency Events (Periods)
CREATE TABLE IF NOT EXISTS dte_contingencies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fecha_inicio DATETIME NOT NULL,
    fecha_fin DATETIME,
    motivo TEXT NOT NULL,
    estado ENUM('OPEN', 'CLOSED') DEFAULT 'OPEN',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- DTEs issued during Contingency
CREATE TABLE IF NOT EXISTS dte_contingency_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_generacion VARCHAR(36) NOT NULL,
    tipo_documento VARCHAR(2) NOT NULL,
    json_dte JSON,
    json_firmado TEXT,
    estado_envio ENUM('PENDING', 'SENT', 'FAILED') DEFAULT 'PENDING',
    fecha_generacion DATETIME NOT NULL,
    fecha_envio_hacienda DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY (codigo_generacion)
);
