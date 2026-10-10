-- Migration v262: Ingreso de tarjetas en arqueo de turnos POS
-- Registro de comprobantes / vouchers de tarjeta con descripción (banco/emisor), no. autorización, no. tarjeta y monto.

CREATE TABLE IF NOT EXISTS pos_shift_tarjetas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shift_id INT NOT NULL,
    num_tarjeta VARCHAR(20) NOT NULL DEFAULT '',
    num_autorizacion VARCHAR(50) NOT NULL DEFAULT '',
    description VARCHAR(255) NOT NULL DEFAULT '',
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_shift_tarjetas_shift (shift_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
