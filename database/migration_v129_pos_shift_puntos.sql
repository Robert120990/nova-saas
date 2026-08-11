-- Migration v129: Canje de puntos en arqueo de turnos POS
-- Registro de canjes/uso de puntos con descripcion y monto que restan del
-- efectivo esperado del turno (igual que gastos y remesas).

CREATE TABLE IF NOT EXISTS pos_shift_puntos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shift_id INT NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT '',
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_shift_puntos_shift (shift_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE pos_shifts
    ADD COLUMN total_puntos DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER arqueado;
